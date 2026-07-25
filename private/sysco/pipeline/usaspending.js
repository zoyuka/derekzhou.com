// USAspending connector — the one fully public, keyless, national source of
// Tier-A evidence. Free API, no registration.
//
// Direction of the relationship matters here and is easy to get backwards. In this
// dataset Sysco is the *recipient* (it receives the award) and a government agency is
// the *buyer*. So a record proves the awarding agency's foodservice operation buys
// from Sysco. It identifies institutional operators (base dining facilities, VA
// hospitals, federal cafeterias), not independent restaurants.
//
// Run: node pipeline/usaspending.js [--years 5] [--out ../app/data.usaspending.json]

import { writeFile } from 'node:fs/promises';
import { resolveParty } from '../engine/entities.js';

const API = 'https://api.usaspending.gov/api/v2/search/spending_by_award/';
const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety stop; raise deliberately, not by accident

function isoDaysAgo(days) {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

async function fetchPage(page, startDate, endDate) {
  const body = {
    filters: {
      keywords: ['SYSCO'],
      award_type_codes: ['A', 'B', 'C', 'D'], // definitive contracts + IDV children
      time_period: [{ start_date: startDate, end_date: endDate }],
    },
    fields: [
      'Award ID', 'Recipient Name', 'Awarding Agency', 'Awarding Sub Agency',
      'Place of Performance State Code', 'Award Amount', 'Start Date', 'End Date',
    ],
    limit: PAGE_SIZE,
    page,
  };

  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`USAspending ${res.status}: ${await res.text()}`);
  return res.json();
}

/**
 * The keyword filter is a text match, so it returns awards that merely *mention*
 * Sysco as well as awards actually made to Sysco. Every row must pass entity
 * resolution before it becomes evidence — this is where most naive pipelines
 * silently accumulate false positives.
 */
function toEvidence(row) {
  const resolved = resolveParty(row['Recipient Name']);
  if (!resolved.isSysco) return null;

  const buyer = row['Awarding Sub Agency'] || row['Awarding Agency'];
  if (!buyer) return null;

  return {
    operator: {
      // The government buyer is the operator whose kitchen serves Sysco product.
      id: `usasp:${slug(buyer)}:${row['Place of Performance State Code'] || 'XX'}`,
      // Agency + state is the finest granularity this dataset reliably supports.
      // The individual dining facility is not exposed, so this identifies a buying
      // organisation, not a single kitchen.
      name: row['Place of Performance State Code'] ? `${buyer} (${row['Place of Performance State Code']})` : buyer,
      segment: 'government',
      state: row['Place of Performance State Code'] || null,
    },
    evidence: {
      type: 'gov_contract',
      observedAt: row['Start Date'] ? `${row['Start Date']}T00:00:00Z` : null,
      sourceLabel: `USAspending award ${row['Award ID']} — ${resolved.unit}`,
      sourceUrl: row.generated_internal_id
        ? `https://www.usaspending.gov/award/${encodeURIComponent(row.generated_internal_id)}`
        : 'https://www.usaspending.gov/',
      note: `$${Number(row['Award Amount'] || 0).toLocaleString('en-US')} obligated to ${row['Recipient Name']}`,
      resolution: resolved.confidence,
    },
  };
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function ingest({ years = 5, maxEvidence = 12 } = {}) {
  const startDate = isoDaysAgo(Math.round(years * 365.25));
  const endDate = new Date().toISOString().slice(0, 10);

  const operators = new Map();
  let page = 1;
  let scanned = 0;
  let rejected = 0;

  while (page <= MAX_PAGES) {
    const data = await fetchPage(page, startDate, endDate);
    const rows = data.results || [];
    scanned += rows.length;

    for (const row of rows) {
      const mapped = toEvidence(row);
      if (!mapped) { rejected++; continue; }

      const key = mapped.operator.id;
      if (!operators.has(key)) operators.set(key, { ...mapped.operator, evidence: [] });
      operators.get(key).evidence.push(mapped.evidence);
    }

    if (!data.page_metadata?.hasNext) break;
    page++;
  }

  // Keep only the most recent N awards per operator. Correlation damping already
  // reduces the k-th item to 1/k of its weight, so beyond a dozen the tail changes
  // the score by a rounding error while dominating the file size.
  let truncated = 0;
  for (const op of operators.values()) {
    op.evidence.sort((a, b) => String(b.observedAt).localeCompare(String(a.observedAt)));
    if (op.evidence.length > maxEvidence) {
      truncated += op.evidence.length - maxEvidence;
      op.totalAwardsFound = op.evidence.length;
      op.evidence = op.evidence.slice(0, maxEvidence);
    }
  }

  return {
    operators: [...operators.values()],
    stats: { scanned, rejected, truncated, pages: page, window: `${startDate}..${endDate}` },
  };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const years = Number(process.argv[process.argv.indexOf('--years') + 1]) || 5;
  const outIdx = process.argv.indexOf('--out');
  const out = outIdx > -1 ? process.argv[outIdx + 1] : null;

  const meIdx = process.argv.indexOf('--max-evidence');
  const maxEvidence = meIdx > -1 ? Number(process.argv[meIdx + 1]) : 12;

  const result = await ingest({ years, maxEvidence });
  console.error(
    `scanned ${result.stats.scanned} awards, rejected ${result.stats.rejected} on entity ` +
    `resolution, truncated ${result.stats.truncated} correlated repeats, produced ` +
    `${result.operators.length} operators (${result.stats.window})`
  );
  const json = JSON.stringify(result, null, 2);
  if (out) { await writeFile(out, json); console.error(`wrote ${out}`); }
  else console.log(json);
}
