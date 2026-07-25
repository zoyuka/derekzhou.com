// SEC EDGAR full-text search connector.
//
// This is the only Tier A source that can be queried live, which makes it
// disproportionately important: without it, a live search can establish who an
// operator is but never find documentary evidence about its suppliers.
//
// Why the evidence is strong. Public restaurant companies name their distributors in
// 10-K risk factors and supplier-concentration disclosures, and file master
// distribution agreements as material-contract exhibits. A 10-K carries a
// Sarbanes-Oxley certification, so "we purchase substantially all of our food from
// Sysco" is a party admission in a federally filed document.
//
// Why a naive keyword match would be badly wrong. Search "Sysco" on EDGAR and the top
// hits are Sysco's own filings and its competitors' — US Foods names Sysco in every
// 10-K, as a *competitor*. Scoring that as a supply relationship would be exactly
// backwards. Two filters handle it: industry code, then language in context.

import { fetchJson, guardedFetch } from './http.js';

const FTS = 'https://efts.sec.gov/LATEST/search-index';

// SEC requires a descriptive User-Agent with contact information.
const SEC_HEADERS = { 'User-Agent': 'sysco-trace research (+https://derekzhou.com/sysco/)' };

const SYSCO_CIK = '0000096021';

// SIC codes that make a filer a plausible *buyer* of broadline foodservice.
const BUYER_SICS = new Set([
  '5812', // eating places
  '5810', // retail eating and drinking
  '5813', // drinking places
  '7011', // hotels and motels
  '8050', '8051', '8060', '8062', // nursing and hospitals
  '8200', '8211', // educational services
  '7990', '7997', // recreation, membership clubs
]);

// SIC codes that make a filer a distributor — a Sysco mention there is almost
// certainly competitive, not a purchase.
const DISTRIBUTOR_SICS = new Set(['5140', '5141', '5142', '5143', '5147', '5149', '5122']);

// Language windows. Checked against the text surrounding each "Sysco" occurrence.
// Phrase-level, not word-level. Bare 'distributor' and 'vendor' were originally in
// this list and collided head-on with competitor prose — "we compete with Sysco and
// other broadline distributors" fired both registers at once, and the mention was
// dropped as unclear instead of recognised as competitive. Generic nouns cannot
// discriminate here; only phrases that encode the direction of the relationship can.
const SUPPLIER_LANGUAGE = [
  // Bounded-gap, because the canonical disclosure separates the verb from its
  // object: "we purchase substantially all of our food and supplies from Sysco".
  // Literal phrase matching missed precisely the sentence that matters most.
  /\bpurchas\w*\b[^.]{0,80}\bfrom\b/,
  /\bwe\s+buy\b[^.]{0,60}\bfrom\b/,
  /\bsupplied\s+by\b/,
  /\bour\s+(?:primary\s+|principal\s+|main\s+|exclusive\s+)?(?:supplier|distributor)\b/,
  /\b(?:master\s+)?distribution\s+agreement\b/,
  /\bsupply\s+agreement\b/,
  /\bsole\s+source\b/,
  /\bsourced?\s+from\b/,
  /\bprincipal\s+supplier\b/,
  /\b(?:agreement|contract)\s+with\s+sysco\b/,
];
const COMPETITOR_LANGUAGE = [
  /\bcompet(?:e|es|ing|itor|itors|ition|itive)\b/,
  /\bpeer\s+group\b/,
  /\bcomparable\s+companies\b/,
  /\brivals?\b/,
];

/**
 * Search EDGAR full-text for filings mentioning Sysco.
 * `name` biases the query toward a particular filer when supplied.
 */
export async function searchFilings(name, { fetchImpl, forms = '10-K', limit = 10 } = {}) {
  const q = name ? `"Sysco" "${name.replace(/"/g, '')}"` : '"Sysco"';
  const url = `${FTS}?q=${encodeURIComponent(q)}&forms=${encodeURIComponent(forms)}`;

  const body = await fetchJson(url, { fetchImpl, headers: SEC_HEADERS });
  const hits = body?.hits?.hits || [];

  // Filter before truncating. Relevance ranking puts Sysco's own filings on top —
  // an unfiltered "Sysco" search returns ~99 of its own 10-Ks in the first 100 hits —
  // so slicing first throws away every actual customer in the page.
  return hits.map(toHit).filter(Boolean).slice(0, limit);
}

function toHit(h) {
  const s = h._source || {};
  const cik = (s.ciks || [])[0];
  if (!cik || cik === SYSCO_CIK) return null; // Sysco's own filings

  const sic = (s.sics || [])[0] || '';
  const displayName = (s.display_names || [])[0] || '';

  // Strip the "(TICKER) (CIK ...)" suffix EDGAR appends.
  const filerName = displayName.replace(/\s*\(.*$/, '').trim();

  const [adsh, file] = String(h._id || '').split(':');

  return {
    cik, sic, filerName, form: s.form || '', fileDate: s.file_date || null,
    fileDescription: s.file_description || null,
    adsh, file,
    docUrl: adsh && file
      ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${adsh.replace(/-/g, '')}/${file}`
      : null,
    filingUrl: adsh
      ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=${encodeURIComponent(s.form || '')}`
      : null,
  };
}

/** Classify a filer by industry code alone. */
export function classifySic(sic) {
  if (DISTRIBUTOR_SICS.has(sic)) return 'distributor';
  if (BUYER_SICS.has(sic)) return 'buyer';
  return 'unknown';
}

/**
 * Read the language around each "Sysco" mention and decide whether the filing
 * describes a purchase or a rivalry.
 *
 * Deliberately conservative: a document containing both registers is reported as
 * mixed and scored down, rather than resolved by counting. Guessing here produces
 * exactly the false positive that would make this tool defamatory.
 */
export function classifyContext(text, { window = 240 } = {}) {
  const lower = String(text || '').toLowerCase();
  let supplier = 0;
  let competitor = 0;
  let ambiguous = 0;
  let mentions = 0;
  const excerpts = [];

  let idx = lower.indexOf('sysco');
  while (idx !== -1 && mentions < 40) {
    mentions++;
    const start = Math.max(0, idx - window);
    const ctx = lower.slice(start, idx + window);

    const s = SUPPLIER_LANGUAGE.some((re) => re.test(ctx));
    const c = COMPETITOR_LANGUAGE.some((re) => re.test(ctx));
    if (s && c) {
      // Both registers in one window. Recorded, not discarded — dropping it would
      // let genuinely mixed prose masquerade as merely uninformative.
      ambiguous++;
    } else if (s) {
      supplier++;
      if (excerpts.length < 2) excerpts.push(cleanExcerpt(text.slice(start, idx + window)));
    } else if (c) {
      competitor++;
    }
    idx = lower.indexOf('sysco', idx + 5);
  }

  // This function reports what the prose actually says. It does not apply the
  // conservatism — that belongs in hitToEvidence, which also knows the filer's
  // industry. Collapsing "ambiguous" into "competitor" here would be safe but
  // wrong as a description, and would throw away the fact that a restaurant company
  // with mixed language is still overwhelmingly likely to be a buyer: restaurants
  // do not compete with Sysco.
  let verdict;
  if (supplier > 0 && competitor === 0 && ambiguous === 0) verdict = 'supplier';
  else if (competitor > 0 && supplier === 0 && ambiguous === 0) verdict = 'competitor';
  else if (ambiguous > 0 || (supplier > 0 && competitor > 0)) verdict = 'mixed';
  else verdict = 'unclear';

  return { verdict, supplier, competitor, ambiguous, mentions, excerpts };
}

function cleanExcerpt(s) {
  // Filing text is raw SGML/HTML; entities survive tag stripping and read as noise
  // in a quoted excerpt.
  return String(s)
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&(?:ldquo|rdquo|quot);/g, '"')
    .replace(/&(?:lsquo|rsquo|apos);/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/**
 * Turn a hit into a scored evidence item, or null if it should be discarded.
 *
 * `resolution` encodes how sure we are the filing is really about this operator
 * buying from Sysco. It is never 1: EDGAR tells us a document mentions both parties,
 * and even good context classification is an inference about prose.
 */
export function hitToEvidence(hit, context) {
  const sicClass = classifySic(hit.sic);
  if (sicClass === 'distributor') return null; // competitor mention, discard outright

  const ctx = context?.verdict || 'unclear';
  if (ctx === 'competitor') return null;

  // Industry code and language agree → strongest. Either alone → weaker.
  let resolution;
  if (sicClass === 'buyer' && ctx === 'supplier') resolution = 0.9;
  else if (sicClass === 'buyer' && ctx === 'unclear') resolution = 0.55;
  else if (sicClass === 'buyer' && ctx === 'mixed') resolution = 0.4;
  else if (ctx === 'supplier') resolution = 0.5; // unknown industry, clear language
  // Unknown industry plus anything less than clear supplier language proves nothing.
  // That includes 'mixed': without knowing the filer is a buyer, mixed prose is as
  // consistent with a rival naming Sysco as with a customer.
  else return null;

  const note = context?.excerpts?.length
    ? `${hit.form} names Sysco: “${context.excerpts[0]}”`
    : `${hit.form} filed by a foodservice operator names Sysco`;

  return {
    type: 'sec_filing_disclosure',
    observedAt: hit.fileDate ? `${hit.fileDate}T00:00:00Z` : null,
    sourceLabel: `SEC ${hit.form} — ${hit.filerName}`,
    sourceUrl: hit.docUrl || hit.filingUrl,
    note,
    resolution,
  };
}

/**
 * Full pipeline: search, filter by industry, fetch a bounded number of documents to
 * read context, and return evidence keyed by filer name.
 *
 * Document fetches are capped because filings are large and SEC rate-limits. Hits
 * beyond the cap are still returned, scored on industry code alone, and reported as
 * unclassified rather than dropped.
 */
export async function findFilingEvidence(name, { fetchImpl, maxDocs = 3 } = {}) {
  const hits = await searchFilings(name, { fetchImpl });
  const usable = hits.filter((h) => classifySic(h.sic) !== 'distributor');

  const out = [];
  let classified = 0;

  for (const hit of usable) {
    let context = null;
    if (classified < maxDocs && hit.docUrl) {
      try {
        const { text } = await guardedFetch(hit.docUrl, {
          fetchImpl, headers: SEC_HEADERS, maxBytes: 3_000_000,
        });
        context = classifyContext(stripTags(text));
        classified++;
      } catch {
        context = null; // fall through to industry-code-only scoring
      }
    }
    const evidence = hitToEvidence(hit, context);
    if (evidence) out.push({ filerName: hit.filerName, evidence, sic: hit.sic, context: context?.verdict || 'not-fetched' });
  }

  return { evidence: out, examined: hits.length, discarded: hits.length - usable.length, classified };
}

function stripTags(html) {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
}
