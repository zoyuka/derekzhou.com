import test from 'node:test';
import assert from 'node:assert/strict';
import { classifySic, classifyContext, hitToEvidence, searchFilings } from './edgar.js';

// The whole risk in this connector is direction. A filing that mentions Sysco may be
// a customer disclosing a supplier or a rival naming a competitor, and getting that
// backwards turns a supply relationship into a fabricated accusation.

test('classifies filers by industry', () => {
  assert.equal(classifySic('5812'), 'buyer');      // eating places
  assert.equal(classifySic('8062'), 'buyer');      // hospitals
  assert.equal(classifySic('5140'), 'distributor'); // wholesale groceries — Sysco's peers
  assert.equal(classifySic('5141'), 'distributor');
  assert.equal(classifySic('7372'), 'unknown');
});

test('reads supplier language', () => {
  const r = classifyContext('We purchase substantially all of our food from Sysco Corporation.');
  assert.equal(r.verdict, 'supplier');
  assert.ok(r.excerpts.length > 0);
});

test('reads competitor language', () => {
  assert.equal(
    classifyContext('We compete with Sysco, US Foods and other broadline distributors.').verdict,
    'competitor'
  );
});

test('generic nouns must not flip competitor prose into supplier prose', () => {
  // Regression: bare 'distributor' was once a supplier term, so "compete with Sysco
  // and other broadline distributors" fired both registers and the mention was
  // silently dropped as unclear — which still scored downstream.
  for (const s of [
    'We compete with Sysco and other broadline distributors for share.',
    'Our competitors include Sysco, the largest foodservice distributor.',
    'Sysco is a competing vendor in this segment.',
  ]) {
    assert.equal(classifyContext(s).verdict, 'competitor', s);
  }
});

test('prose carrying both registers is reported as mixed, not silently dropped', () => {
  const r = classifyContext('We purchase from Sysco. We also compete with Sysco in some channels.');
  assert.equal(r.verdict, 'mixed');
});

test('a bare mention is unclear', () => {
  assert.equal(classifyContext('Sysco was mentioned once in passing.').verdict, 'unclear');
  assert.equal(classifyContext('no mention here').verdict, 'unclear');
});

// --- evidence gating ---

const hit = (sic) => ({ sic, form: '10-K', filerName: 'Test Co', fileDate: '2025-01-01', docUrl: 'https://sec.gov/x' });

test('a distributor filing is discarded whatever the language says', () => {
  assert.equal(hitToEvidence(hit('5140'), { verdict: 'supplier' }), null);
  assert.equal(hitToEvidence(hit('5141'), { verdict: 'mixed' }), null);
});

test('competitor language is discarded whatever the industry says', () => {
  assert.equal(hitToEvidence(hit('5812'), { verdict: 'competitor' }), null);
});

test('industry and language agreeing scores highest', () => {
  const strong = hitToEvidence(hit('5812'), { verdict: 'supplier', excerpts: ['we purchase from sysco'] });
  const weaker = hitToEvidence(hit('5812'), { verdict: 'unclear' });
  const weakest = hitToEvidence(hit('5812'), { verdict: 'mixed' });
  assert.ok(strong.resolution > weaker.resolution);
  assert.ok(weaker.resolution > weakest.resolution);
  assert.equal(strong.type, 'sec_filing_disclosure');
});

test('an unknown industry needs clear supplier language to count at all', () => {
  assert.ok(hitToEvidence(hit('7372'), { verdict: 'supplier' }));
  assert.equal(hitToEvidence(hit('7372'), { verdict: 'unclear' }), null);
  // Mixed prose from an unidentified filer is as consistent with a rival as a customer.
  assert.equal(hitToEvidence(hit('7372'), { verdict: 'mixed' }), null);
});

test("Sysco's own filings are excluded, and filtering precedes truncation", async () => {
  // Regression: relevance ranking puts ~99 Sysco filings in the first 100 hits, so
  // slicing before filtering returned an empty result set every time.
  const hits = [
    ...Array.from({ length: 99 }, () => ({
      _id: 'a:b', _source: { ciks: ['0000096021'], sics: ['5140'], display_names: ['SYSCO CORP  (SYY)'], form: '10-K' },
    })),
    { _id: 'c-1:d.htm', _source: { ciks: ['0001040328'], sics: ['5810'], display_names: ['CHAMPPS ENTERTAINMENT INC  (CIK 1)'], form: '10-K', file_date: '2004-01-01' } },
  ];
  const fetchImpl = async () => ({
    ok: true, status: 200, headers: { get: () => null },
    body: bodyOf(JSON.stringify({ hits: { hits } })),
  });

  const out = await searchFilings('', { fetchImpl, limit: 10 });
  assert.equal(out.length, 1, 'the one real buyer must survive');
  assert.equal(out[0].filerName, 'CHAMPPS ENTERTAINMENT INC');
  assert.match(out[0].docUrl, /Archives\/edgar\/data\/1040328\/c1\/d\.htm/);
});

function bodyOf(str) {
  const bytes = new TextEncoder().encode(str);
  let sent = false;
  return {
    getReader: () => ({
      read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: bytes })),
      cancel: async () => {},
    }),
  };
}
