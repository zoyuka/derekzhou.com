import test from 'node:test';
import assert from 'node:assert/strict';
import { propagateEvidence, deriveEdges, bestPaths, buildAdjacency, edgeWeight } from './graph.js';
import { scoreOperator } from './score.js';

const NOW = '2026-07-25T00:00:00Z';

const ops = (n) => Array.from({ length: n }, (_, i) => ({ id: `o${i}`, name: `Op ${i}`, evidence: [] }));

test('evidence propagates to a sibling under the same legal entity', () => {
  const operators = [
    { id: 'a', name: 'A', evidence: [{ type: 'ucc_filing', observedAt: NOW }] },
    { id: 'b', name: 'B', evidence: [] },
  ];
  const out = propagateEvidence(operators, [{ from: 'a', to: 'b', type: 'same_legal_entity', viaDegree: 2 }]);
  const b = out.find((o) => o.id === 'b');
  assert.equal(b.evidence.length, 1);
  assert.equal(b.evidence[0].propagated, true);
  assert.equal(b.evidence[0].via.fromName, 'A');
});

test('propagated evidence can never confirm, even from a sworn filing', () => {
  const operators = [
    { id: 'a', name: 'A', evidence: [{ type: 'bankruptcy_creditor', observedAt: NOW }] },
    { id: 'b', name: 'B', evidence: [] },
  ];
  const out = propagateEvidence(operators, [{ from: 'a', to: 'b', type: 'same_legal_entity', viaDegree: 2 }]);
  const direct = scoreOperator(out.find((o) => o.id === 'a'), { asOf: NOW });
  const inherited = scoreOperator(out.find((o) => o.id === 'b'), { asOf: NOW });

  assert.equal(direct.verdict, 'confirmed');
  assert.notEqual(inherited.verdict, 'confirmed', 'inheritance must not confirm');
  assert.equal(inherited.bestTier, null, 'propagated evidence must not set an evidence tier');
  assert.ok(inherited.probability < direct.probability);
});

test('the cap fires even when inherited evidence is overwhelming', () => {
  // Three siblings, each with a sworn filing, all feeding one location. Enough to
  // push the raw probability past the confirmation threshold on arithmetic alone.
  const operators = [
    ...['a', 'b', 'c'].map((id) => ({
      id, name: id.toUpperCase(), evidence: [{ type: 'bankruptcy_creditor', observedAt: NOW }],
    })),
    { id: 'target', name: 'Target', evidence: [] },
  ];
  const edges = ['a', 'b', 'c'].map((id) => ({
    from: id, to: 'target', type: 'same_legal_entity', viaDegree: 2,
  }));

  const out = propagateEvidence(operators, edges);
  const t = scoreOperator(out.find((o) => o.id === 'target'), { asOf: NOW });

  assert.ok(t.probability > 0.9, `raw probability should clear the bar (got ${t.probability})`);
  assert.equal(t.verdict, 'likely', 'but the tier cap must hold it below confirmed');
  assert.equal(t.capped, true);
  assert.match(t.verdictReason, /documentary/);
});

test('propagated evidence does not propagate onward', () => {
  const operators = [
    { id: 'a', name: 'A', evidence: [{ type: 'ucc_filing', observedAt: NOW }] },
    { id: 'b', name: 'B', evidence: [] },
    { id: 'c', name: 'C', evidence: [] },
  ];
  const edges = [
    { from: 'a', to: 'b', type: 'same_legal_entity', viaDegree: 2 },
    { from: 'b', to: 'c', type: 'same_legal_entity', viaDegree: 2 },
  ];
  const out = propagateEvidence(operators, edges);
  // C inherits from A directly via a 2-hop path, exactly once — not once from A and
  // again from B's inherited copy.
  const c = out.find((o) => o.id === 'c');
  assert.equal(c.evidence.length, 1);
  assert.equal(c.evidence[0].via.hops, 2);
});

test('attenuation falls with distance', () => {
  const operators = [
    { id: 'a', name: 'A', evidence: [{ type: 'ucc_filing', observedAt: NOW }] },
    { id: 'b', name: 'B', evidence: [] },
    { id: 'c', name: 'C', evidence: [] },
  ];
  const out = propagateEvidence(operators, [
    { from: 'a', to: 'b', type: 'same_legal_entity', viaDegree: 2 },
    { from: 'b', to: 'c', type: 'same_legal_entity', viaDegree: 2 },
  ]);
  const b = out.find((o) => o.id === 'b').evidence[0];
  const c = out.find((o) => o.id === 'c').evidence[0];
  assert.ok(c.resolution < b.resolution);
  assert.ok(scoreOperator(out.find((o) => o.id === 'c'), { asOf: NOW }).probability <
            scoreOperator(out.find((o) => o.id === 'b'), { asOf: NOW }).probability);
});

test('a shared registered agent is nearly worthless, unlike a shared owner', () => {
  const mk = (type, viaDegree) => {
    const operators = [
      { id: 'a', name: 'A', evidence: [{ type: 'ucc_filing', observedAt: NOW }] },
      { id: 'b', name: 'B', evidence: [] },
    ];
    const out = propagateEvidence(operators, [{ from: 'a', to: 'b', type, viaDegree }]);
    return scoreOperator(out.find((o) => o.id === 'b'), { asOf: NOW }).probability;
  };
  assert.ok(mk('shared_owner', 2) > mk('shared_registered_agent', 2));
});

test('hub penalty: a link shared by hundreds of operators barely propagates', () => {
  const small = edgeWeight({ type: 'shared_owner', viaDegree: 2 });
  const hub = edgeWeight({ type: 'shared_owner', viaDegree: 400 });
  assert.ok(hub < small / 10, `hub edge should collapse (${hub} vs ${small})`);
});

test('a registered agent on 400 filings propagates nothing at all', () => {
  const operators = [
    { id: 'a', name: 'A', evidence: [{ type: 'bankruptcy_creditor', observedAt: NOW }] },
    { id: 'b', name: 'B', evidence: [] },
  ];
  const out = propagateEvidence(operators, [
    { from: 'a', to: 'b', type: 'shared_registered_agent', viaDegree: 400 },
  ]);
  assert.equal(out.find((o) => o.id === 'b').evidence.length, 0, 'below the noise floor, so dropped');
});

test('negative evidence propagates too', () => {
  const operators = [
    { id: 'a', name: 'A', evidence: [{ type: 'menu_verified_local_sourcing', observedAt: NOW }] },
    { id: 'b', name: 'B', evidence: [] },
  ];
  const out = propagateEvidence(operators, [{ from: 'a', to: 'b', type: 'same_legal_entity', viaDegree: 2 }]);
  const b = scoreOperator(out.find((o) => o.id === 'b'), { asOf: NOW });
  assert.ok(b.probability < scoreOperator({ id: 'x', name: 'x', evidence: [] }, { asOf: NOW }).probability);
});

test('cycles do not inflate the score', () => {
  const operators = [
    { id: 'a', name: 'A', evidence: [{ type: 'ucc_filing', observedAt: NOW }] },
    { id: 'b', name: 'B', evidence: [] },
    { id: 'c', name: 'C', evidence: [] },
  ];
  // Triangle: b is reachable from a directly and via c.
  const out = propagateEvidence(operators, [
    { from: 'a', to: 'b', type: 'same_legal_entity', viaDegree: 2 },
    { from: 'b', to: 'c', type: 'same_legal_entity', viaDegree: 2 },
    { from: 'a', to: 'c', type: 'same_legal_entity', viaDegree: 2 },
  ]);
  const b = out.find((o) => o.id === 'b');
  assert.equal(b.evidence.length, 1, 'one underlying fact must yield one inherited item');
});

test('bestPaths keeps the strongest route, not the first found', () => {
  const adj = buildAdjacency([
    { from: 'a', to: 'b', type: 'shared_registered_agent', viaDegree: 2 },
    { from: 'a', to: 'b', type: 'same_legal_entity', viaDegree: 2 },
  ]);
  const paths = bestPaths(adj, 'a');
  assert.equal(paths.get('b').path[0].edge.type, 'same_legal_entity');
});

// --- edge derivation from raw records ---

test('derives edges from shared legal entity, owners and phone', () => {
  const operators = [
    { id: '1', legalEntity: 'JBK Holdings LLC', phone: '2125550000', owners: ['Jane Doe'] },
    { id: '2', legalEntity: 'JBK HOLDINGS, L.L.C.', phone: '2125550000', owners: ['Jane Doe'] },
    { id: '3', legalEntity: 'Unrelated Inc', phone: '2125559999', owners: ['John Roe'] },
  ];
  const edges = deriveEdges(operators);
  const between12 = edges.filter((e) => (e.from === '1' && e.to === '2') || (e.from === '2' && e.to === '1'));
  const types = between12.map((e) => e.type).sort();
  assert.deepEqual(types, ['same_legal_entity', 'shared_owner', 'shared_phone']);
  assert.equal(edges.some((e) => e.from === '3' || e.to === '3'), false, 'unrelated operator must stay isolated');
});

test('edge derivation records degree so hubs are penalised downstream', () => {
  const many = ops(6).map((o, i) => ({ ...o, registeredAgent: 'CT Corporation' }));
  const edges = deriveEdges(many);
  assert.ok(edges.length > 0);
  assert.ok(edges.every((e) => e.viaDegree === 6));
});
