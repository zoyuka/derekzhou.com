import test from 'node:test';
import assert from 'node:assert/strict';
import { isBankruptcyCourt, isSyscoParty, docketToEvidence, searchDockets } from './courtlistener.js';
import { EVIDENCE_TYPES } from '../../../sysco/engine/evidence.js';

// The danger in this connector is that most federal cases mentioning Sysco are suits
// AGAINST Sysco — workplace injuries, employment claims. Treating a plaintiff who
// sued Sysco as a Sysco customer would be a severe and defamatory false positive.
// On a live sample it would have fired on 17 of every 20 results.

test('bankruptcy courts are separated from district and appellate courts', () => {
  for (const c of ['deb', 'txsb', 'mssb', 'flmb', 'nysb', 'cacb']) {
    assert.equal(isBankruptcyCourt(c), true, c);
  }
  for (const c of ['txsd', 'cacd', 'tnmd', 'cand', 'ca9', 'cafc', 'scotus']) {
    assert.equal(isBankruptcyCourt(c), false, c);
  }
});

test('a caption naming Sysco is Sysco being sued, not a customer', () => {
  assert.equal(isSyscoParty('Torres v. Sysco Corporation'), true);
  assert.equal(isSyscoParty('Jesus Cruz v. Sysco Los Angeles, Inc.'), true);
  assert.equal(isSyscoParty('OTB Hospitality, LLC'), false);
});

test('suits against Sysco are rejected, bankruptcies kept', async () => {
  const results = [
    { caseName: 'Torres v. Sysco Corporation', court_id: 'txsd', dateFiled: '2026-07-10' },
    { caseName: 'Jesus Cruz v. Sysco Los Angeles, Inc.', court_id: 'cacd', dateFiled: '2026-07-01' },
    { caseName: 'Writers Guild v. Paramount', court_id: 'cand', dateFiled: '2026-06-01' },
    { caseName: 'OTB Hospitality, LLC, d/b/a On the Border', court_id: 'txsb', dateFiled: '2026-06-19' },
    { caseName: 'VI Land O Lakes, LLC', court_id: 'flmb', dateFiled: '2026-06-10' },
  ];
  const fetchImpl = async () => ok(JSON.stringify({ results }));

  const r = await searchDockets('', { fetchImpl });
  assert.equal(r.dockets.length, 2);
  assert.deepEqual(r.dockets.map((d) => d.caseName).sort(),
    ['OTB Hospitality, LLC, d/b/a On the Border', 'VI Land O Lakes, LLC']);
  assert.equal(r.rejectedNonBankruptcy, 3);
  // Every rejection must be accounted for, so the coverage report can state it.
  assert.equal(r.dockets.length + r.rejectedNonBankruptcy + r.rejectedSyscoParty, r.examined);
});

test('a bankruptcy captioned in Sysco\'s own name is not a customer', async () => {
  const fetchImpl = async () => ok(JSON.stringify({
    results: [{ caseName: 'In re Sysco Holdings LLC', court_id: 'deb', dateFiled: '2026-01-01' }],
  }));
  const r = await searchDockets('', { fetchImpl });
  assert.equal(r.dockets.length, 0);
  assert.equal(r.rejectedSyscoParty, 1);
});

test('docket evidence is scored below a read bankruptcy schedule', () => {
  // bankruptcy_creditor means someone read Schedule E/F and saw a Sysco operating
  // company with a figure beside it. This is a full-text docket hit. Conflating the
  // two would inflate every live result to the strength of a sworn filing.
  assert.ok(EVIDENCE_TYPES.bankruptcy_docket.lr < EVIDENCE_TYPES.bankruptcy_creditor.lr);
  const e = docketToEvidence({
    caseName: 'OTB Hospitality, LLC', courtId: 'txsb', dateFiled: '2026-06-19',
    url: 'https://www.courtlistener.com/docket/1/',
  });
  assert.equal(e.type, 'bankruptcy_docket');
  assert.ok(e.resolution < 1, 'a docket hit is an inference, never certainty');
  assert.match(e.note, /OTB Hospitality/);
  assert.equal(e.observedAt, '2026-06-19T00:00:00Z');
});

test('a docket with no case name is skipped rather than yielding a nameless operator', async () => {
  const fetchImpl = async () => ok(JSON.stringify({
    results: [{ caseName: '', court_id: 'txsb' }, { caseName: '  ', court_id: 'deb' }],
  }));
  const r = await searchDockets('', { fetchImpl });
  assert.equal(r.dockets.length, 0);
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
const ok = (str) => ({ ok: true, status: 200, headers: { get: () => null }, body: bodyOf(str) });
