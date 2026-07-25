// GET /api/search?q=<name>&where=<city or state>&state=<XX>&menu=<https://...>
//
// Live lookup for an arbitrary operator. Fans out across every source that can be
// queried for a name we have never seen before, resolves the results into operators,
// builds the ownership graph between them, propagates evidence and scores everything.
//
// The coverage report is not decoration. This tool's most common answer is "nothing
// found", and that sentence is only interpretable if the reader can see which sources
// were actually consulted, which matched, which failed, and which cannot be queried
// live at all. Without it, a thin result reads as exoneration.

import { searchOperators } from './lib/socrata.js';
import { guardedFetch, FetchError } from './lib/http.js';
import { scoreOperator, describeVerdict, VERDICT_LABELS } from '../../sysco/engine/score.js';
import { deriveEdges, propagateEvidence } from '../../sysco/engine/graph.js';
import { analyzeMenu } from '../../sysco/engine/menu.js';
import { resolveParty } from '../../sysco/engine/entities.js';

const MAX_OPERATORS = 60;

// Sources that exist and matter, but cannot be hit live from a request. Declared so
// the coverage report can name them instead of quietly pretending they don't exist.
const OFFLINE_SOURCES = [
  { id: 'ucc', label: 'State UCC secured-party filings', why: 'No public API; per-state portals, some requiring paid or bulk access.' },
  { id: 'bankruptcy', label: 'Bankruptcy creditor schedules', why: 'PACER/RECAP requires credentials and per-docket retrieval.' },
  { id: 'fdd', label: 'Franchise Disclosure Documents (Item 8)', why: 'Registration-state portals publish PDFs, not queryable records.' },
  { id: 'checkbook', label: 'State and municipal vendor payments', why: 'Each state runs its own portal with a different interface.' },
  { id: 'courts', label: 'Collection lawsuits', why: 'County-level dockets, no unified public API.' },
  { id: 'usda-farms', label: 'USDA farm registries (Local Food Directories, Organic INTEGRITY)', why: 'Requires an API key, so local-sourcing claims cannot be verified live. See the note on menu results.' },
];

// Local-sourcing claims are only negative evidence when the named farm can be
// confirmed in a public registry. Live requests have no registry access, so every
// such claim is scored as unverified — which is the conservative direction for the
// operator's privacy but biases live scores *upward*, toward Sysco, for exactly the
// restaurants that genuinely do source locally. Saying so is not optional.
const FARM_VERIFICATION_NOTE =
  'Local-sourcing claims on this menu were scored as UNVERIFIED because farm registry ' +
  'lookup is unavailable live. If this operator does have verifiable farm relationships, ' +
  'its real probability is lower than shown.';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Short cache: results change slowly, and this protects the upstream portals
      // from being hammered by repeat searches.
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const where = (url.searchParams.get('where') || '').trim();
  const state = (url.searchParams.get('state') || '').trim().toUpperCase() || null;
  const menuUrl = (url.searchParams.get('menu') || '').trim();

  if (q.length < 3) {
    return json({ error: 'Enter at least 3 characters of an operator name.' }, 400);
  }

  const coverage = { searched: [], failed: [], notQueryable: OFFLINE_SOURCES };
  let operators = [];

  // --- Public records: establishes who the operator is and who it is linked to ---
  try {
    const { records, searched, failed } = await searchOperators(q, { where, state });
    coverage.searched.push(...searched.map((s) => ({ ...s, kind: 'public-records' })));
    coverage.failed.push(...failed);
    operators = toOperators(records);
  } catch (err) {
    coverage.failed.push({ name: 'Socrata discovery', reason: String(err?.message || err) });
  }

  // --- Curated corpus: the documentary findings that cannot be fetched live ---
  try {
    const corpus = await loadCorpus(url.origin);
    const hits = corpus.filter((o) => matches(o.name, q));
    coverage.searched.push({
      name: 'Curated documentary corpus (bankruptcy schedules, UCC, contract awards)',
      kind: 'curated', matches: hits.length,
      link: '/sysco/data.seed.json',
    });
    operators.push(...hits.map((o) => ({ ...o, evidence: [...(o.evidence || [])] })));
  } catch (err) {
    coverage.failed.push({ name: 'Curated corpus', reason: String(err?.message || err) });
  }

  // --- Menu analysis: the one path that works for any operator, anywhere ---
  let menuReport = null;
  if (menuUrl) {
    menuReport = await analyzeMenuUrl(menuUrl, { state });
    const sawLocalClaim = (menuReport.evidence || [])
      .some((e) => e.type === 'menu_unverified_local_claim');
    coverage.searched.push({
      name: 'Menu supplied by you', kind: 'menu',
      matches: menuReport.evidence?.length || 0,
      link: menuReport.ok ? menuUrl : undefined,
      error: menuReport.error,
      note: sawLocalClaim ? FARM_VERIFICATION_NOTE : undefined,
    });
    if (menuReport.ok && menuReport.evidence.length) {
      // Attach to the best-matching operator, or stand one up if records found none.
      const target = operators.find((o) => matches(o.name, q));
      if (target) target.evidence.push(...menuReport.evidence);
      else operators.push({
        id: `query:${slug(q)}`, name: q, segment: 'independent', state,
        evidence: menuReport.evidence,
      });
    }
  }

  // If nothing at all matched, still answer with the prior rather than an empty page.
  if (!operators.length) {
    operators = [{ id: `query:${slug(q)}`, name: q, segment: 'independent', state, evidence: [] }];
  }

  const deduped = dedupe(operators);
  operators = deduped.slice(0, MAX_OPERATORS);
  // No silent caps. A truncated result set that doesn't say so reads as "this is
  // everything", which is the same failure as an unexplained empty result.
  if (deduped.length > MAX_OPERATORS) {
    coverage.truncated = {
      shown: MAX_OPERATORS,
      matched: deduped.length,
      note: `Showing the first ${MAX_OPERATORS} of ${deduped.length} matching operators. Narrow the search with a city or state.`,
    };
  }

  const edges = deriveEdges(operators);
  const propagated = propagateEvidence(operators, edges);
  const results = propagated
    .map((o) => {
      const scored = scoreOperator(o);
      return {
        ...scored,
        verdictLabel: VERDICT_LABELS[scored.verdict],
        description: describeVerdict(scored),
        state: o.state, city: o.city, address: o.address,
        legalEntity: o.legalEntity, sources: o.sources,
      };
    })
    .sort((a, b) => b.probability - a.probability);

  return json({
    query: { q, where, state, menu: menuUrl || null },
    results,
    relationships: edges.length,
    coverage,
    caveat:
      'Absence of evidence is not evidence of absence. Most Sysco customers leave no ' +
      'public trace, and the sources listed under notQueryable cannot be checked live.',
  });
}

/** Group raw records into operators keyed by name+locality. */
function toOperators(records) {
  const byKey = new Map();
  for (const r of records) {
    if (!r.tradeName) continue;
    const key = `${norm(r.tradeName)}|${norm(r.city || r.zip || '')}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        id: `rec:${slug(key)}`,
        name: titleCase(r.tradeName),
        segment: 'independent',
        state: r.state, city: r.city, address: r.address,
        legalEntity: r.legalEntity, phone: r.phone, addressKey: r.addressKey,
        owners: [],
        evidence: [],
        sources: [],
      });
    }
    const op = byKey.get(key);
    op.legalEntity = op.legalEntity || r.legalEntity;
    op.phone = op.phone || r.phone;
    op.addressKey = op.addressKey || r.addressKey;

    // A licence record naming an owner feeds the ownership graph. It is not
    // evidence about Sysco by itself, and must never be scored as such.
    if (r.legalEntity && !op.owners.includes(r.legalEntity)) op.owners.push(r.legalEntity);

    if (r.source && !op.sources.some((s) => s.dataset === r.source.dataset)) {
      op.sources.push(r.source);
    }

    // Guard against a portal that happens to hold a record for Sysco itself.
    if (resolveParty(op.name).isSysco) byKey.delete(key);
  }
  return [...byKey.values()];
}

async function analyzeMenuUrl(menuUrl, { state }) {
  try {
    const { text, url } = await guardedFetch(menuUrl, { userSupplied: true });
    const plain = stripHtml(text);
    const evidence = analyzeMenu(
      {
        text: plain,
        observedAt: new Date().toISOString(),
        sourceUrl: url,
        sourceLabel: 'Menu you supplied',
      },
      { state, month: new Date().getUTCMonth() + 1, verifiedFarms: [] }
    );
    return { ok: true, evidence, chars: plain.length };
  } catch (err) {
    return {
      ok: false,
      evidence: [],
      error: err instanceof FetchError ? err.message : 'could not read that page',
    };
  }
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
}

let corpusCache = null;
async function loadCorpus(origin) {
  if (corpusCache) return corpusCache;
  const { text } = await guardedFetch(`${origin}/sysco/data.seed.json`);
  corpusCache = JSON.parse(text).operators || [];
  return corpusCache;
}

function dedupe(operators) {
  const seen = new Set();
  return operators.filter((o) => {
    const k = `${norm(o.name)}|${norm(o.city || o.state || '')}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const matches = (name, q) => norm(name).includes(norm(q));
// Word-initial only. A naive \b[a-z] also fires after an apostrophe, turning
// "Lou Malnati's" into "Lou Malnati'S".
const titleCase = (s) =>
  String(s).toLowerCase()
    .replace(/(^|[\s\-/(])([a-z])/g, (_, pre, c) => pre + c.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
