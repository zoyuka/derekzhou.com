// Relationship graph and evidence propagation.
//
// The single biggest gap in a per-restaurant model is that supply relationships are
// not signed per restaurant. They are signed by an operating entity, a management
// company, or a franchise system, and then apply across every location underneath.
// So a UCC filing naming one LLC is evidence about a dozen storefronts, and a
// franchise agreement naming a designated distributor is evidence about hundreds.
//
// This module builds the operator graph and propagates evidence across it with
// attenuation per edge type and per hop.
//
// The hard rule, enforced in score.js: propagated evidence is NEVER documentary.
// Inheriting a sibling's bankruptcy schedule tells you something real about this
// restaurant, but it is an inference about a different legal person, and it must not
// be able to produce a "confirmed" verdict.

/**
 * Edge types and how much of an evidence signal survives crossing them.
 *
 * These are attenuation factors in 0..1 applied to the identity-resolution weight
 * of the propagated evidence, not to its likelihood ratio. Crossing an edge makes
 * us less sure the evidence is *about this operator*, which is exactly what the
 * resolution term already models.
 */
export const EDGE_TYPES = {
  same_legal_entity: {
    weight: 0.95,
    label: 'same legal entity',
    basis:
      'Two trade names filed under one legal entity. A distributor account is opened by ' +
      'the entity, so this is very nearly the same customer.',
  },
  franchise_designated_supplier: {
    weight: 0.92,
    label: 'franchise system designates this supplier',
    basis:
      'FDD Item 8 requires franchisors to disclose suppliers a franchisee must buy from, ' +
      'and to identify any required purchasing cooperative. Where the FDD names Sysco, ' +
      'every franchisee in the system is contractually pushed to it. Registration states ' +
      'publish FDDs — Wisconsin DFI hosts them free.',
  },
  shared_management_company: {
    weight: 0.75,
    label: 'shared management company',
    basis: 'A management company typically consolidates purchasing across the properties it runs.',
  },
  co_debtor: {
    weight: 0.8,
    label: 'joint bankruptcy filing',
    basis: 'Affiliated debtors filing together are usually one purchasing organisation.',
  },
  shared_owner: {
    weight: 0.6,
    label: 'shared owner or officer',
    basis:
      'A person listed as owner/officer of both entities. Common purchasing is likely but ' +
      'far from certain — operators run different concepts with different suppliers.',
  },
  shared_phone: {
    weight: 0.5,
    label: 'shared phone number',
    basis: 'A shared business line usually indicates a shared back office.',
  },
  same_address: {
    weight: 0.45,
    label: 'same premises',
    basis:
      'Same building. Can mean one operator behind two concepts, or merely a food hall ' +
      'or a shared commissary, so it is treated cautiously.',
  },
  shared_registered_agent: {
    weight: 0.12,
    label: 'shared registered agent',
    basis:
      'Deliberately near-worthless on its own. Commercial agents like CT Corporation are ' +
      'listed on hundreds of thousands of unrelated filings. Kept only because a small ' +
      'local agent shared by two restaurants is mildly informative — which is what the ' +
      'degree penalty below is for.',
  },
};

/** Per-hop attenuation applied on top of edge weights, so long chains die out. */
export const HOP_DECAY = 0.6;
export const MAX_HOPS = 3;
export const MIN_ATTENUATION = 0.05; // below this, propagation is noise

/**
 * Effective weight of an edge, penalised by how many operators the connecting
 * entity touches.
 *
 * This is the graph analogue of inverse document frequency, and it is what stops
 * hub nodes from wiring the whole dataset together. A registered agent on 400
 * companies, or a management company running 200 restaurants, says much less about
 * any particular pair than a person who appears on exactly two filings.
 */
export function edgeWeight(edge) {
  const type = EDGE_TYPES[edge.type];
  if (!type) throw new Error(`Unknown edge type: ${edge.type}`);
  const degree = Math.max(2, edge.viaDegree ?? 2);
  return type.weight / Math.sqrt(degree / 2);
}

/** Build an adjacency map from an edge list. Edges are undirected. */
export function buildAdjacency(edges) {
  const adj = new Map();
  const add = (a, b, edge) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a).push({ to: b, edge, weight: edgeWeight(edge) });
  };
  for (const e of edges) {
    add(e.from, e.to, e);
    add(e.to, e.from, e);
  }
  return adj;
}

/**
 * Best (highest-attenuation) path from `source` to every reachable node.
 *
 * Uses max-product search rather than summing over paths. Summing would double-count
 * one underlying fact that happens to be reachable by several routes — the same
 * independence error that correlation damping fixes for repeated evidence.
 */
export function bestPaths(adj, source, { maxHops = MAX_HOPS, minAttenuation = MIN_ATTENUATION } = {}) {
  const best = new Map([[source, { attenuation: 1, hops: 0, path: [] }]]);
  // Small graphs: a simple relaxation loop is clearer than a priority queue and
  // bounded by maxHops anyway.
  let frontier = [source];

  for (let hop = 1; hop <= maxHops; hop++) {
    const next = [];
    for (const node of frontier) {
      const cur = best.get(node);
      for (const { to, edge, weight } of adj.get(node) || []) {
        const attenuation = cur.attenuation * weight * HOP_DECAY;
        if (attenuation < minAttenuation) continue;
        const existing = best.get(to);
        if (!existing || attenuation > existing.attenuation) {
          best.set(to, { attenuation, hops: hop, path: [...cur.path, { edge, to }] });
          next.push(to);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }

  best.delete(source);
  return best;
}

/**
 * Propagate evidence across the graph.
 *
 * @param {Array} operators - each { id, evidence: [...] }
 * @param {Array} edges - each { from, to, type, via?, viaDegree? }
 * @returns a new operator array with inherited evidence appended
 */
export function propagateEvidence(operators, edges, opts = {}) {
  const adj = buildAdjacency(edges);
  const byId = new Map(operators.map((o) => [o.id, o]));

  // Only evidence that was directly observed may propagate. Propagated evidence
  // must not propagate onward: that would let a single fact ripple through the
  // graph gaining apparent independence at every hop.
  const result = operators.map((o) => ({ ...o, evidence: [...(o.evidence || [])] }));
  const resultById = new Map(result.map((o) => [o.id, o]));

  for (const source of operators) {
    const direct = (source.evidence || []).filter((e) => !e.propagated);
    if (!direct.length) continue;

    for (const [targetId, { attenuation, hops, path }] of bestPaths(adj, source.id, opts)) {
      const target = resultById.get(targetId);
      if (!target) continue;

      for (const item of direct) {
        // Negative evidence propagates too — a sibling's verified local sourcing
        // is mild evidence about this one — but attenuates identically.
        target.evidence.push({
          ...item,
          propagated: true,
          resolution: (item.resolution ?? 1) * attenuation,
          via: {
            fromId: source.id,
            fromName: byId.get(source.id)?.name || source.id,
            hops,
            attenuation: Number(attenuation.toFixed(3)),
            chain: path.map((p) => EDGE_TYPES[p.edge.type]?.label || p.edge.type),
          },
        });
      }
    }
  }

  return result;
}

/**
 * Derive edges from raw operator records.
 *
 * The fields consumed here are exactly what public sources expose: NYC's Legally
 * Operating Businesses dataset carries legal `business_name` alongside
 * `dba_trade_name`, plus building identifiers and contact phone, which is the
 * legal-name-to-trade-name join that per-restaurant matching otherwise lacks.
 */
export function deriveEdges(operators) {
  const edges = [];
  const groupBy = (key) => {
    const m = new Map();
    for (const o of operators) {
      const v = o[key];
      if (!v) continue;
      const k = String(v).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!k) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(o);
    }
    return m;
  };

  const pairsFrom = (map, type) => {
    for (const group of map.values()) {
      if (group.length < 2) continue;
      // Degree is the size of the group: a value shared by many operators is a hub
      // and gets penalised by edgeWeight.
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          edges.push({
            from: group[i].id, to: group[j].id, type,
            via: group[i][fieldFor(type)], viaDegree: group.length,
          });
        }
      }
    }
  };

  pairsFrom(groupBy('legalEntity'), 'same_legal_entity');
  pairsFrom(groupBy('managementCompany'), 'shared_management_company');
  pairsFrom(groupBy('phone'), 'shared_phone');
  pairsFrom(groupBy('registeredAgent'), 'shared_registered_agent');
  pairsFrom(groupBy('addressKey'), 'same_address');

  // Owners are a list per operator, so they need their own inversion.
  const ownerMap = new Map();
  for (const o of operators) {
    for (const owner of o.owners || []) {
      const k = String(owner).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!k) continue;
      if (!ownerMap.has(k)) ownerMap.set(k, []);
      ownerMap.get(k).push(o);
    }
  }
  for (const [owner, group] of ownerMap) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        edges.push({
          from: group[i].id, to: group[j].id, type: 'shared_owner',
          via: owner, viaDegree: group.length,
        });
      }
    }
  }

  return edges;
}

function fieldFor(type) {
  return {
    same_legal_entity: 'legalEntity',
    shared_management_company: 'managementCompany',
    shared_phone: 'phone',
    shared_registered_agent: 'registeredAgent',
    same_address: 'addressKey',
  }[type];
}
