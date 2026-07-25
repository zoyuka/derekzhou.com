import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreOperator, decayFactor, DEFAULT_PRIOR } from './score.js';
import { resolveParty, normalizeOpCo } from './entities.js';

const NOW = '2026-07-25T00:00:00Z';
const op = (evidence, segment = 'independent') => ({
  id: 't', name: 'Test Kitchen', segment, evidence,
});

test('no evidence returns the prior, not zero', () => {
  const r = scoreOperator(op([]), { asOf: NOW });
  assert.equal(r.verdict, 'no-evidence');
  assert.ok(Math.abs(r.probability - DEFAULT_PRIOR) < 1e-6);
});

test('fresh bankruptcy schedule confirms', () => {
  const r = scoreOperator(
    op([{ type: 'bankruptcy_creditor', observedAt: '2026-04-01T00:00:00Z' }]),
    { asOf: NOW }
  );
  assert.equal(r.verdict, 'confirmed');
  assert.ok(r.probability > 0.95);
});

test('weak signals alone can never reach confirmed, however many are stacked', () => {
  const evidence = Array.from({ length: 30 }, (_, i) => ({
    type: i % 2 ? 'job_posting' : 'photo_evidence',
    observedAt: NOW,
  }));
  evidence.push({ type: 'menu_private_label', observedAt: NOW });

  const r = scoreOperator(op(evidence), { asOf: NOW });
  assert.notEqual(r.verdict, 'confirmed', 'circumstantial evidence must never confirm');
  assert.equal(r.capped, true);
  assert.match(r.verdictReason, /documentary/);
});

test('repeated same-type evidence has diminishing returns', () => {
  const one = scoreOperator(
    op([{ type: 'gov_contract', observedAt: NOW }]), { asOf: NOW });
  const many = scoreOperator(
    op(Array.from({ length: 40 }, () => ({ type: 'gov_contract', observedAt: NOW }))),
    { asOf: NOW }
  );
  // More evidence should still mean more confidence...
  assert.ok(many.probability >= one.probability);
  // ...but 40 orders on one contract vehicle must not count as 40 independent facts.
  const naive = 40 * one.contributions[0].impact;
  const actual = many.contributions.reduce((s, c) => s + c.impact, 0);
  assert.ok(actual < naive * 0.35, `damping should cut the naive sum sharply (${actual} vs ${naive})`);
  assert.equal(many.contributions[0].dampen, 1);
  assert.ok(many.contributions.at(-1).dampen < 0.05);
});

test('damping is per-type, so diverse evidence outweighs repetitive evidence', () => {
  const repetitive = scoreOperator(
    op(Array.from({ length: 4 }, () => ({ type: 'photo_evidence', observedAt: NOW }))),
    { asOf: NOW }
  );
  const diverse = scoreOperator(
    op([
      { type: 'photo_evidence', observedAt: NOW },
      { type: 'job_posting', observedAt: NOW },
      { type: 'menu_private_label', observedAt: NOW },
      { type: 'supplier_disclosure', observedAt: NOW },
    ]),
    { asOf: NOW }
  );
  assert.ok(diverse.probability > repetitive.probability);
});

test('stale documentary evidence is capped below confirmed', () => {
  const r = scoreOperator(
    op([{ type: 'ucc_filing', observedAt: '2013-01-01T00:00:00Z' }]),
    { asOf: NOW }
  );
  assert.notEqual(r.verdict, 'confirmed');
  assert.ok(r.probability < 0.9);
});

test('decay shrinks toward zero information but never flips sign', () => {
  const r = scoreOperator(
    op([{ type: 'ucc_filing', observedAt: '1995-01-01T00:00:00Z' }]),
    { asOf: NOW }
  );
  const c = r.contributions[0];
  assert.ok(c.impact >= 0, 'aged positive evidence must not become negative');
  assert.ok(r.probability >= DEFAULT_PRIOR - 1e-9);
});

test('competitor disclosure lowers but does not zero the probability', () => {
  const r = scoreOperator(
    op([{ type: 'competitor_disclosure', observedAt: NOW }]),
    { asOf: NOW }
  );
  assert.ok(r.probability < DEFAULT_PRIOR, 'should drop');
  assert.ok(r.probability > 0.02, 'multi-sourcing means it must not collapse to zero');
});

test('identity resolution confidence scales evidence weight', () => {
  const sure = scoreOperator(
    op([{ type: 'ucc_filing', observedAt: NOW, resolution: 1 }]), { asOf: NOW });
  const unsure = scoreOperator(
    op([{ type: 'ucc_filing', observedAt: NOW, resolution: 0.4 }]), { asOf: NOW });
  assert.ok(unsure.probability < sure.probability);
});

test('half-life decay is correct at exactly one half-life', () => {
  // ucc_filing half-life is 5 years.
  const f = decayFactor('2021-07-25T00:00:00Z', NOW, 5);
  assert.ok(Math.abs(f - 0.5) < 0.01, `expected ~0.5, got ${f}`);
});

test('segment priors apply', () => {
  const indie = scoreOperator(op([], 'independent'), { asOf: NOW });
  const edu = scoreOperator(op([], 'education'), { asOf: NOW });
  assert.ok(edu.probability > indie.probability);
});

// --- entity resolution ---

test('resolves real Sysco operating-company names seen in filings', () => {
  for (const n of ['SYSCO IOWA, INC.', 'SYSCO CONNECTICUT, LLC', 'Sysco Baltimore',
                   'Sysco Food Service Portland']) {
    assert.equal(resolveParty(n).isSysco, true, n);
  }
});

test('resolves non-Sysco-named subsidiaries', () => {
  assert.equal(resolveParty('FreshPoint Southern California').unit, 'FreshPoint');
  assert.equal(resolveParty('Greco and Sons').unit, 'Greco & Sons');
});

test('rejects competitors and OCR false friends', () => {
  assert.equal(resolveParty('US Foods, Inc.').isSysco, false);
  assert.equal(resolveParty('Cisco Systems').isSysco, false);
  assert.equal(resolveParty('Gordon Food Service').competitor, 'Gordon Food Service');
});

test('refuses to guess when a string names both Sysco and a competitor', () => {
  const r = resolveParty('Sysco and US Foods both submitted bids');
  assert.equal(r.isSysco, false);
  assert.match(r.reason, /ambiguous/);
});

test('normalizeOpCo collapses legal boilerplate', () => {
  assert.equal(normalizeOpCo('SYSCO FOOD SERVICES OF PORTLAND, INC.'), 'Sysco Portland');
});
