import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMenu, extractFarms, countItems } from './menu.js';
import { scoreOperator } from './score.js';

const NOW = '2026-07-25T00:00:00Z';
const types = (r) => r.map((e) => e.type).sort();

test('detects a Sysco private label named on the menu', () => {
  const r = analyzeMenu({ text: 'Grilled Portico shrimp with lemon $24.00', observedAt: NOW });
  assert.ok(types(r).includes('menu_private_label'));
});

test('a cluster of factory-prepped items registers; a single one does not', () => {
  const one = analyzeMenu({ text: 'Onion rings $8', observedAt: NOW });
  assert.ok(!types(one).includes('menu_broadline_signature'));

  const many = analyzeMenu({
    text: 'Mozzarella sticks $9\nOnion rings $8\nBoneless wings $12\nPotato skins $10',
    observedAt: NOW,
  });
  assert.ok(types(many).includes('menu_broadline_signature'));
});

test('more convenience items means higher confidence in the reading', () => {
  const three = analyzeMenu({ text: 'mozzarella stick\nonion ring\npotato skin', observedAt: NOW });
  const seven = analyzeMenu({
    text: 'mozzarella stick\nonion ring\npotato skin\nboneless wing\ncorn dog\negg roll\ntater tot',
    observedAt: NOW,
  });
  const get = (r) => r.find((e) => e.type === 'menu_broadline_signature').resolution;
  assert.ok(get(seven) > get(three));
});

test('portion specs copied off a distributor sheet are detected', () => {
  const r = analyzeMenu({ text: '8 oz center-cut sirloin $28.00', observedAt: NOW });
  assert.ok(types(r).includes('menu_portion_spec'));
});

test('menu breadth flags what no registry would reach', () => {
  const text = Array.from({ length: 95 }, (_, i) => `Dish ${i} $12.00`).join('\n');
  const r = analyzeMenu({ text, observedAt: NOW });
  assert.ok(types(r).includes('menu_breadth'));
});

test('breadth threshold is lower when the menu spans several cuisines', () => {
  const text = Array.from({ length: 65 }, (_, i) => `Dish ${i} $12.00`).join('\n');
  assert.ok(!types(analyzeMenu({ text, observedAt: NOW })).includes('menu_breadth'));
  assert.ok(types(analyzeMenu({ text, cuisineCount: 4, observedAt: NOW })).includes('menu_breadth'));
});

test('out-of-season produce only counts in a cold state in winter', () => {
  const menu = { text: 'Heirloom tomato salad $16.00', observedAt: NOW };
  assert.ok(types(analyzeMenu(menu, { state: 'MN', month: 1 })).includes('menu_out_of_season'));
  assert.ok(!types(analyzeMenu(menu, { state: 'MN', month: 8 })).includes('menu_out_of_season'));
  assert.ok(!types(analyzeMenu(menu, { state: 'FL', month: 1 })).includes('menu_out_of_season'));
});

test('a verified farm is negative evidence; an unverified claim is near-neutral', () => {
  const text = 'We proudly serve produce from Blue Hill Farm and Stone Ridge Orchard. Locally sourced.';

  const verified = analyzeMenu({ text, observedAt: NOW }, { verifiedFarms: ['Blue Hill Farm'] });
  assert.ok(types(verified).includes('menu_verified_local_sourcing'));
  assert.ok(!types(verified).includes('menu_unverified_local_claim'));

  const unverified = analyzeMenu({ text, observedAt: NOW }, { verifiedFarms: [] });
  assert.ok(types(unverified).includes('menu_unverified_local_claim'));
  assert.ok(!types(unverified).includes('menu_verified_local_sourcing'));
});

test('the verified/unverified distinction actually moves the score', () => {
  const text = 'Produce from Blue Hill Farm. Locally sourced, farm-to-table.';
  const mk = (verifiedFarms) => scoreOperator(
    { id: 'x', name: 'X', segment: 'independent', evidence: analyzeMenu({ text, observedAt: NOW }, { verifiedFarms }) },
    { asOf: NOW }
  ).probability;

  assert.ok(mk(['Blue Hill Farm']) < mk([]), 'verifiable sourcing must count for more than a slogan');
});

test('an unverifiable local claim cannot be used to opt out of the dataset', () => {
  // A restaurant with real broadline signals should not be able to erase them by
  // adding "locally sourced" to its About page.
  const damning = 'mozzarella stick $9\nonion ring $8\nboneless wing $12\npotato skin $10';
  const withClaim = `${damning}\nAll our food is locally sourced, farm-to-table.`;

  const a = scoreOperator({ id: 'a', name: 'A', evidence: analyzeMenu({ text: damning, observedAt: NOW }) }, { asOf: NOW });
  const b = scoreOperator({ id: 'b', name: 'B', evidence: analyzeMenu({ text: withClaim, observedAt: NOW }, { verifiedFarms: [] }) }, { asOf: NOW });

  assert.ok(b.probability > a.probability * 0.85, 'a bare slogan must not wipe out operational evidence');
});

test('scratch-cooking language lowers the probability', () => {
  const r = analyzeMenu({
    text: 'Hand-cut fries, house-made pasta, dry-aged ribeye, baked daily',
    observedAt: NOW,
  });
  assert.ok(types(r).includes('menu_scratch_markers'));
  const s = scoreOperator({ id: 'x', name: 'X', evidence: r }, { asOf: NOW });
  assert.ok(s.probability < 0.18);
});

test('menu evidence alone can never confirm', () => {
  const text = [
    'Portico shrimp $24.00', '8 oz center-cut sirloin $28.00',
    'mozzarella stick $9', 'onion ring $8', 'boneless wing $12', 'potato skin $10',
    ...Array.from({ length: 95 }, (_, i) => `Dish ${i} $12.00`),
  ].join('\n');
  const r = analyzeMenu({ text, observedAt: NOW }, { state: 'MN', month: 1 });
  const s = scoreOperator({ id: 'x', name: 'X', evidence: r }, { asOf: NOW });
  assert.notEqual(s.verdict, 'confirmed');
  assert.equal(s.capped, true);
});

test('extractFarms pulls producer names but skips generic phrasing', () => {
  const farms = extractFarms('Beef from Stone Ridge Ranch, greens from Blue Hill Farm, eggs from Our Farm');
  assert.ok(farms.includes('Stone Ridge Ranch'));
  assert.ok(farms.includes('Blue Hill Farm'));
  assert.ok(!farms.some((f) => /^our/i.test(f)));
});

test('countItems counts priced lines', () => {
  assert.equal(countItems('Burger $12.00\nFries $5\nAbout us\nSalad 9.50'), 3);
});

test('contrary evidence is reported as its own finding, not as "no evidence"', () => {
  const r = analyzeMenu(
    { text: 'Produce from Blue Hill Farm. Hand-cut fries, house-made pasta, dry-aged ribeye.', observedAt: NOW },
    { verifiedFarms: ['Blue Hill Farm'] }
  );
  const s = scoreOperator({ id: 'x', name: 'X', evidence: r }, { asOf: NOW });
  assert.equal(s.verdict, 'contrary');
  assert.notEqual(s.verdict, 'no-evidence', 'found-and-points-away differs from found-nothing');
});

test('an operator with genuinely nothing still reads as no-evidence', () => {
  const s = scoreOperator({ id: 'x', name: 'X', evidence: [] }, { asOf: NOW });
  assert.equal(s.verdict, 'no-evidence');
});

test("detects Sysco's own menu-design tooling in the raw document", () => {
  // The giveaway lives in PDF metadata or an asset URL, never in visible copy.
  const raw = '<html><head><meta name="generator" content="Sysco Studio"></head><body>Burger $12</body></html>';
  const r = analyzeMenu({ text: 'Burger $12', raw, observedAt: NOW });
  assert.ok(types(r).includes('menu_sysco_studio'));
});

test('tooling detection reads the raw document, not the stripped text', () => {
  const raw = '<img src="https://syscostudio.com/assets/hero.jpg">Burger $12';
  const stripped = 'Burger $12';
  assert.ok(types(analyzeMenu({ text: stripped, raw, observedAt: NOW })).includes('menu_sysco_studio'));
  // Without the raw document the signal is invisible — which is the whole point.
  assert.ok(!types(analyzeMenu({ text: stripped, observedAt: NOW })).includes('menu_sysco_studio'));
});

test('Sysco tooling outweighs ordinary menu forensics but still cannot confirm', () => {
  const raw = 'Producer: Sysco Studio\nBurger $12.00';
  const s = scoreOperator(
    { id: 'x', name: 'X', evidence: analyzeMenu({ text: 'Burger $12.00', raw, observedAt: NOW }) },
    { asOf: NOW }
  );
  assert.ok(s.probability > 0.85);
  assert.notEqual(s.verdict, 'confirmed', 'tier B evidence must never confirm');
});

test('an ordinary menu triggers no tooling signal', () => {
  const raw = '<html><head><meta name="generator" content="WordPress"></head><body>Burger $12</body></html>';
  assert.ok(!types(analyzeMenu({ text: 'Burger $12', raw, observedAt: NOW })).includes('menu_sysco_studio'));
});
