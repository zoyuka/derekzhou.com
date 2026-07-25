// Socrata connector.
//
// The reason this exists rather than a hardcoded list of city datasets: Socrata runs
// a cross-portal discovery API covering every government portal on the platform, so
// the relevant food-establishment and business-licence datasets for a given place can
// be found at query time. That is what makes the tool work in a jurisdiction nobody
// wired up by hand.
//
// Two things it gives us that nothing else does at national scale:
//   - the legal-entity to trade-name join (business licence records carry both),
//     which is the link the ownership graph is built from
//   - address and phone, which are the other edges in that graph
//
// It does not, on its own, say anything about Sysco. It establishes who the operator
// *is* and who it is connected to, so that evidence found elsewhere can be attached
// to the right entity and propagated correctly.

import { fetchJson } from './http.js';

const CATALOG = 'https://api.us.socrata.com/api/catalog/v1';
const DISCOVERY_LIMIT = 8;
const ROWS_PER_DATASET = 25;

// Column-name candidates, most specific first. Socrata schemas are wildly
// inconsistent between jurisdictions — dba, dba_name, facility_name, premise_name,
// establishment_name all mean the same thing — so mapping is by heuristic.
const COLUMN_HINTS = {
  tradeName: ['dba', 'dba_name', 'aka_name', 'dba_trade_name', 'facility_name', 'premise_name',
              'establishment_name', 'restaurant_name', 'business_name', 'name', 'legal_name'],
  legalEntity: ['business_name', 'legal_name', 'owner_name', 'licensee', 'licensee_name',
                'ownership_name', 'company_name'],
  address: ['address', 'address_line_1', 'street_address', 'facility_address', 'site_address',
            'address_building', 'street'],
  city: ['city', 'address_city', 'facility_city', 'municipality'],
  state: ['state', 'address_state', 'facility_state'],
  zip: ['zip', 'zipcode', 'zip_code', 'address_zip', 'postal_code'],
  phone: ['phone', 'contact_phone', 'phone_number', 'telephone'],
};

/** Pick the best matching column for each logical field. */
export function inferColumns(fieldNames = []) {
  const available = new Set(fieldNames);
  const mapping = {};
  for (const [logical, candidates] of Object.entries(COLUMN_HINTS)) {
    const hit = candidates.find((c) => available.has(c));
    if (hit) mapping[logical] = hit;
  }
  // A dataset with no name column is useless to us regardless of what else it has.
  return mapping.tradeName ? mapping : null;
}

/**
 * Find candidate datasets for a place.
 * `where` is a free-text locality hint ("Chicago", "Texas") used to bias discovery.
 */
export async function discoverDatasets(where, { fetchImpl, signalTerms } = {}) {
  const terms = signalTerms || 'restaurant inspections food establishment business license';
  const q = [terms, where].filter(Boolean).join(' ');
  const url = `${CATALOG}?q=${encodeURIComponent(q)}&only=dataset&limit=${DISCOVERY_LIMIT}`;

  const body = await fetchJson(url, { fetchImpl });
  const out = [];

  for (const r of body.results || []) {
    const res = r.resource || {};
    const columns = inferColumns(res.columns_field_name || []);
    if (!columns) continue;
    const domain = r.metadata?.domain;
    if (!domain) continue;
    out.push({
      domain,
      id: res.id,
      name: res.name,
      columns,
      link: r.link || `https://${domain}/d/${res.id}`,
    });
  }
  return out;
}

const escapeLiteral = (s) => String(s).replace(/'/g, "''");

/** Query one dataset for operators whose name matches. */
export async function queryDataset(dataset, name, { fetchImpl, state } = {}) {
  const { domain, id, columns } = dataset;
  const term = escapeLiteral(name.trim().toUpperCase());

  const clauses = [`upper(${columns.tradeName}) like upper('%${term}%')`];
  if (state && columns.state) {
    clauses.push(`upper(${columns.state}) = upper('${escapeLiteral(state)}')`);
  }

  const url =
    `https://${domain}/resource/${id}.json` +
    `?$where=${encodeURIComponent(clauses.join(' AND '))}` +
    `&$limit=${ROWS_PER_DATASET}`;

  const rows = await fetchJson(url, { fetchImpl });
  return Array.isArray(rows) ? rows.map((row) => normalizeRow(row, dataset)) : [];
}

function pick(row, col) {
  if (!col) return null;
  const v = row[col];
  if (v == null) return null;
  if (typeof v === 'object') return v.human_address ? String(v.human_address) : null;
  return String(v).trim() || null;
}

export function normalizeRow(row, dataset) {
  const c = dataset.columns;
  const tradeName = pick(row, c.tradeName);
  const legalEntity = pick(row, c.legalEntity);
  const address = pick(row, c.address);
  const city = pick(row, c.city);
  const st = pick(row, c.state);
  const zip = pick(row, c.zip);
  const phone = pick(row, c.phone);

  return {
    tradeName,
    // Only treat it as a distinct legal entity if it actually differs from the
    // trade name. Many datasets map both logical fields onto the same column.
    legalEntity: legalEntity && legalEntity !== tradeName ? legalEntity : null,
    address,
    city,
    state: st,
    zip,
    phone: phone ? phone.replace(/\D/g, '') || null : null,
    addressKey: address && (zip || city) ? `${address} ${zip || city}`.toLowerCase() : null,
    source: { domain: dataset.domain, dataset: dataset.id, name: dataset.name, link: dataset.link },
  };
}

/**
 * Search every discovered dataset for an operator.
 * Individual dataset failures are tolerated — jurisdictions rate-limit, retire
 * datasets and change schemas constantly, and one bad portal must not take down
 * the whole search. Failures are reported rather than swallowed.
 */
export async function searchOperators(name, { where, state, fetchImpl } = {}) {
  const datasets = await discoverDatasets(where, { fetchImpl });

  const settled = await Promise.allSettled(
    datasets.map((d) => queryDataset(d, name, { fetchImpl, state }))
  );

  const records = [];
  const searched = [];
  const failed = [];

  settled.forEach((result, i) => {
    const d = datasets[i];
    if (result.status === 'fulfilled') {
      searched.push({ name: d.name, domain: d.domain, link: d.link, matches: result.value.length });
      records.push(...result.value);
    } else {
      failed.push({ name: d.name, domain: d.domain, reason: String(result.reason?.message || result.reason) });
    }
  });

  return { records, searched, failed };
}
