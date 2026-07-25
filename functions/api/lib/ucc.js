// State UCC lien connector.
//
// This closes the gap that mattered most. The other live sources reach public
// companies (EDGAR), bankrupt operators (CourtListener) and government buyers
// (USAspending). None of them reach a healthy independent restaurant — and that is
// who anyone using this tool is most likely to search for.
//
// UCC-1 filings do, and they are the highest-volume documentary source in the whole
// model, because Sysco's standard credit terms have every customer grant a security
// interest in all assets and irrevocably authorise Sysco to file. So an ordinary
// restaurant with a Sysco credit account tends to leave exactly one public trace,
// and this is it.
//
// The retrieval problem was always direction: most state systems index by debtor and
// you need the reverse. Several states publish their UCC index as open data with the
// secured party as a queryable column, which makes the reverse lookup a single query.

import { fetchJson } from './http.js';
import { resolveParty } from '../../../sysco/engine/entities.js';

/**
 * States publishing a UCC index with both parties queryable.
 *
 * Connecticut carries secured party and debtor in one row, so the join is free.
 * Colorado splits filing/debtor/collateral across three datasets keyed by fileid and
 * Oregon splits secured parties from filings, so both need a second request; they are
 * listed here as the natural next additions rather than wired up blind.
 */
export const UCC_SOURCES = [
  {
    state: 'CT',
    domain: 'data.ct.gov',
    id: 'xfev-8smz',
    label: 'Connecticut UCC lien filings',
    columns: {
      securedParty: 'sec_party_nm_bus',
      debtor: 'debtor_nm_bus',
      city: 'debtor_ad_city',
      debtorState: 'debtor_ad_state',
      filed: 'dt_accept',
      lapse: 'dt_lapse',
      status: 'lien_status',
      filingType: 'cd_flng_type',
      fileNumber: 'id_ucc_flng_nbr',
    },
  },
];

const escapeLiteral = (s) => String(s).replace(/'/g, "''");

/**
 * Filing type determines what the record actually proves.
 *
 * An original financing statement is the routine credit-account filing: Sysco
 * extended trade credit and perfected its interest. A judgment lien is a different
 * and stronger fact — Sysco sued over an unpaid account and won, which presupposes
 * goods sold and delivered. Scoring both as a generic "lien" would throw that away.
 */
export function evidenceTypeFor(filingType) {
  const t = String(filingType || '').toUpperCase();
  if (t.includes('JUDGMENT')) return 'court_collection';
  return 'ucc_filing';
}

/**
 * Pull the trade name out of a debtor record.
 * "BJONDA LLC D/B/A JIMMY'S TOO" is the legal-name-to-trade-name join that per-
 * restaurant matching otherwise lacks, handed over for free.
 */
export function splitDba(debtorName) {
  const s = String(debtorName || '').trim();
  const m = s.match(/^(.*?)\s+(?:d\/b\/a|dba|d b a)\s+(.*)$/i);
  if (!m) return { legalEntity: s || null, tradeName: null };
  return { legalEntity: m[1].trim() || null, tradeName: m[2].trim() || null };
}

/** A filing whose lapse date has passed is no longer perfected and proves little. */
export function isLapsed(lapseDate, asOf = new Date()) {
  if (!lapseDate) return false;
  const d = new Date(lapseDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < new Date(asOf).getTime();
}

export async function searchLiens(name, { fetchImpl, asOf, sources = UCC_SOURCES } = {}) {
  const results = await Promise.allSettled(
    sources.map((src) => querySource(src, name, { fetchImpl }))
  );

  const liens = [];
  const searched = [];
  const failed = [];
  let lapsedCount = 0;
  let rejectedParty = 0;

  results.forEach((r, i) => {
    const src = sources[i];
    if (r.status !== 'fulfilled') {
      failed.push({ name: src.label, domain: src.domain, reason: String(r.reason?.message || r.reason) });
      return;
    }
    for (const row of r.value) {
      // The secured party string still has to survive entity resolution. A
      // substring match on "sysco" would also catch OCR noise and unrelated firms.
      const party = resolveParty(row.securedParty);
      if (!party.isSysco) { rejectedParty++; continue; }

      if (isLapsed(row.lapse, asOf)) { lapsedCount++; continue; }

      const { legalEntity, tradeName } = splitDba(row.debtor);
      if (!legalEntity && !tradeName) continue;

      liens.push({
        ...row,
        state: src.state,
        legalEntity,
        tradeName,
        syscoUnit: party.unit,
        partyConfidence: party.confidence,
        evidenceType: evidenceTypeFor(row.filingType),
      });
    }
    searched.push({ name: src.label, domain: src.domain, matches: r.value.length });
  });

  return { liens: dedupe(liens), searched, failed, lapsedCount, rejectedParty };
}

async function querySource(src, name, { fetchImpl }) {
  const c = src.columns;
  const clauses = [`upper(${c.securedParty}) like '%SYSCO%'`];
  if (name) {
    clauses.push(`upper(${c.debtor}) like upper('%${escapeLiteral(name.trim())}%')`);
  }

  const url =
    `https://${src.domain}/resource/${src.id}.json` +
    `?$where=${encodeURIComponent(clauses.join(' AND '))}` +
    `&$order=${encodeURIComponent(`${c.filed} DESC`)}&$limit=50`;

  const rows = await fetchJson(url, { fetchImpl });
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ({
    securedParty: row[c.securedParty] || null,
    debtor: row[c.debtor] || null,
    city: row[c.city] || null,
    debtorState: row[c.debtorState] || null,
    filed: row[c.filed] || null,
    lapse: row[c.lapse] || null,
    status: row[c.status] || null,
    filingType: row[c.filingType] || null,
    fileNumber: row[c.fileNumber] || null,
  }));
}

/** One filing amended twice appears three times; that is one fact, not three. */
function dedupe(liens) {
  const seen = new Set();
  return liens.filter((l) => {
    const key = `${String(l.debtor || '').toLowerCase()}|${l.filed || ''}|${l.filingType || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function lienToEvidence(lien) {
  const isJudgment = lien.evidenceType === 'court_collection';
  return {
    type: lien.evidenceType,
    observedAt: lien.filed ? new Date(lien.filed).toISOString() : null,
    sourceLabel: `${lien.state} UCC index${lien.fileNumber ? ` — filing ${lien.fileNumber}` : ''}`,
    sourceUrl: `https://data.ct.gov/d/xfev-8smz`,
    note: isJudgment
      ? `${lien.syscoUnit || 'Sysco'} holds a judgment lien against ${lien.debtor} — a judgment presupposes goods sold and delivered`
      : `${lien.syscoUnit || 'Sysco'} is the secured party on a ${lien.filingType || 'UCC filing'} against ${lien.debtor}`,
    // High but never certain: the filing names a legal entity, and mapping that to a
    // storefront is the resolution problem this whole model is careful about.
    resolution: (lien.partyConfidence ?? 0.9) * (lien.tradeName ? 0.95 : 0.85),
  };
}

export async function findLienEvidence(name, opts = {}) {
  const { liens, searched, failed, lapsedCount, rejectedParty } = await searchLiens(name, opts);
  return {
    matches: liens.map((l) => ({
      debtorName: l.tradeName || l.legalEntity,
      legalEntity: l.legalEntity,
      city: l.city,
      state: l.debtorState || l.state,
      evidence: lienToEvidence(l),
    })),
    searched, failed, lapsedCount, rejectedParty,
  };
}
