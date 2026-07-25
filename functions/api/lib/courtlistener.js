// CourtListener / RECAP connector.
//
// Free, no authentication, and it makes federal court records live-queryable — which
// matters because bankruptcy schedules are the single strongest evidence class in the
// model and were otherwise reachable only through a hand-curated corpus.
//
// The direction problem here is worse than EDGAR's and is the whole design.
//
// Searching "Sysco" across federal dockets returns ~6,900 cases, and the overwhelming
// majority are suits *against* Sysco: workplace injuries, employment claims, wage
// disputes. An injured warehouse worker's lawsuit says nothing whatsoever about who
// buys from Sysco. Wiring those in naively would attribute a supply relationship to
// every plaintiff who ever sued the company — a severe and defamatory false positive,
// and on a live sample it would have been 17 of every 20 results.
//
// The discriminator is the court. CourtListener bankruptcy court IDs end in "b"
// (deb, txsb, mssb, flmb); district courts end in "d" (txsd, cacd) and appellate
// courts are "ca1".."ca11". In a bankruptcy docket, Sysco is there because the debtor
// owes it money — including preference-clawback proceedings, where the trustee sues
// Sysco to recover payments the debtor made, which is itself proof of purchasing.
// Everywhere else, Sysco is the defendant and the case is irrelevant.

import { fetchJson } from './http.js';

const SEARCH = 'https://www.courtlistener.com/api/rest/v4/search/';

/** Bankruptcy courts end in "b"; district ("...d") and appellate ("ca9") do not. */
export function isBankruptcyCourt(courtId) {
  return /b$/.test(String(courtId || ''));
}

/**
 * A caption naming Sysco as a party is Sysco being sued, not a customer.
 * Bankruptcy captions name the debtor, which is exactly who we want.
 */
export function isSyscoParty(caseName) {
  return /\bsysco\b/i.test(String(caseName || ''));
}

export async function searchDockets(name, { fetchImpl, limit = 20 } = {}) {
  const q = name ? `Sysco "${String(name).replace(/"/g, '')}"` : 'Sysco';
  const url = `${SEARCH}?q=${encodeURIComponent(q)}&type=r&order_by=${encodeURIComponent('dateFiled desc')}`;

  const body = await fetchJson(url, { fetchImpl });
  const results = body?.results || [];

  const kept = [];
  let rejectedNonBankruptcy = 0;
  let rejectedSyscoParty = 0;

  for (const r of results.slice(0, limit)) {
    const courtId = r.court_id || '';
    const caseName = String(r.caseName || '').trim();
    if (!caseName) continue;

    if (!isBankruptcyCourt(courtId)) { rejectedNonBankruptcy++; continue; }

    // A bankruptcy captioned in Sysco's own name would be Sysco as debtor, not a
    // customer. Vanishingly rare, but the check costs nothing.
    if (isSyscoParty(caseName)) { rejectedSyscoParty++; continue; }

    kept.push({
      caseName,
      courtId,
      dateFiled: r.dateFiled || null,
      docketNumber: r.docketNumber || null,
      url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : 'https://www.courtlistener.com/',
    });
  }

  return {
    dockets: kept,
    examined: results.length,
    rejectedNonBankruptcy,
    rejectedSyscoParty,
  };
}

/**
 * Convert a bankruptcy docket into evidence about the debtor.
 *
 * Scored as its own type rather than reusing the curated `bankruptcy_creditor`.
 * That type represents someone having read Schedule E/F and seen a Sysco operating
 * company with a dollar figure next to it. This is a full-text hit somewhere in a
 * docket — strong, because Sysco appears in a bankruptcy for essentially one reason,
 * but not the same thing as a verified schedule entry, and it should not be scored
 * as though it were.
 */
export function docketToEvidence(docket) {
  return {
    type: 'bankruptcy_docket',
    observedAt: docket.dateFiled ? `${docket.dateFiled}T00:00:00Z` : null,
    sourceLabel: `${docket.courtId.toUpperCase()} bankruptcy docket${docket.docketNumber ? ` ${docket.docketNumber}` : ''}`,
    sourceUrl: docket.url,
    note: `Sysco appears in the bankruptcy of ${docket.caseName}`,
    resolution: 0.7,
  };
}

export async function findDocketEvidence(name, opts = {}) {
  const { dockets, examined, rejectedNonBankruptcy, rejectedSyscoParty } =
    await searchDockets(name, opts);

  return {
    matches: dockets.map((d) => ({ debtorName: d.caseName, evidence: docketToEvidence(d) })),
    examined,
    rejectedNonBankruptcy,
    rejectedSyscoParty,
  };
}
