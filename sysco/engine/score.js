// Confidence engine.
//
// Combines evidence in log-odds space, decays each item by age, and caps the final
// verdict by the strongest evidence tier present. The cap is the important part:
// without it, a pile of weak signals (a job posting, a vague photo, a local-sourcing
// absence) sums to a near-certainty, which is exactly the failure mode that would
// make this app defamatory rather than informative.

import { getEvidenceType, TIER } from './evidence.js';

// Prior probability that an operator with no evidence either way buys from Sysco.
// Sysco is the largest US broadline distributor but the market is fragmented across
// US Foods, PFG, Gordon, and a long tail of regional houses and cash-and-carry.
// A defensible prior for an unknown independent is well under a coin flip.
export const DEFAULT_PRIOR = 0.18;

// Segment adjustments. Chains with national distribution agreements and institutional
// operators skew differently from independents.
export const SEGMENT_PRIORS = {
  independent: 0.18,
  'regional-chain': 0.25,
  'national-chain': 0.12, // more likely to run a dedicated/self-distribution network
  education: 0.30,
  healthcare: 0.28,
  hospitality: 0.25,
  government: 0.30,
};

const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));

/**
 * Age-decay factor for an evidence item.
 * Returns 1 for fresh evidence, approaching 0 as it ages past its half-life.
 */
export function decayFactor(observedAt, asOf, halFLifeYears) {
  if (!observedAt) return 0.5; // undated evidence is discounted, not discarded
  const ageMs = new Date(asOf).getTime() - new Date(observedAt).getTime();
  if (Number.isNaN(ageMs)) return 0.5;
  const ageYears = Math.max(0, ageMs / (365.25 * 24 * 3600 * 1000));
  return Math.pow(0.5, ageYears / halFLifeYears);
}

/**
 * Score one operator.
 *
 * @param {object} operator - { id, name, segment, evidence: [...] }
 *        evidence items: { type, observedAt, sourceUrl, sourceLabel, note,
 *                          resolution?: number (0..1 identity-match confidence) }
 * @param {object} opts - { asOf: ISO date }
 */
export function scoreOperator(operator, opts = {}) {
  const asOf = opts.asOf || new Date().toISOString();
  const prior = SEGMENT_PRIORS[operator.segment] ?? DEFAULT_PRIOR;

  let logOdds = logit(prior);
  const contributions = [];
  let bestTier = null;

  // Stage 1: compute each item's undamped weight.
  const items = (operator.evidence || []).map((item) => {
    const type = getEvidenceType(item.type);
    const decay = decayFactor(item.observedAt, asOf, type.halfLifeYears);

    // Identity-resolution confidence scales the evidence. If we are only 60% sure
    // the UCC debtor "JBK Holdings LLC" is this restaurant, the filing should not
    // carry its full weight.
    const resolution = item.resolution ?? 1;

    // Decay and resolution shrink the log-LR toward zero (no information), never
    // past it. A stale positive must not become negative evidence.
    const rawLogLr = Math.log(type.lr);
    return { item, type, decay, resolution, undamped: rawLogLr * decay * resolution };
  });

  // Stage 2: damp correlated evidence.
  //
  // Bayesian updating assumes independent observations. Real corpora violate this
  // badly: 43 delivery orders under one contract vehicle, or the same menu scraped
  // monthly, are one fact observed repeatedly, not 43 facts. Adding them naively
  // drives any operator to certainty regardless of evidence quality.
  //
  // So within each evidence type the strongest item counts fully and the k-th
  // strongest counts at 1/k. Repetition still adds information — a second
  // independent sighting should count for something — but with sharply
  // diminishing returns, and it can never manufacture certainty on its own.
  const byType = new Map();
  for (const e of items) {
    if (!byType.has(e.item.type)) byType.set(e.item.type, []);
    byType.get(e.item.type).push(e);
  }
  for (const group of byType.values()) {
    group.sort((a, b) => Math.abs(b.undamped) - Math.abs(a.undamped));
    group.forEach((e, i) => { e.dampen = 1 / (i + 1); });
  }

  for (const e of items) {
    const { item, type, decay, resolution, undamped, dampen } = e;
    const effectiveLogLr = undamped * dampen;
    logOdds += effectiveLogLr;

    contributions.push({
      type: item.type,
      label: type.label,
      tier: type.tier,
      sourceUrl: item.sourceUrl,
      sourceLabel: item.sourceLabel,
      note: item.note,
      observedAt: item.observedAt,
      rawLr: type.lr,
      decay: Number(decay.toFixed(3)),
      resolution,
      dampen: Number(dampen.toFixed(3)),
      // Positive = raises probability, negative = lowers it.
      impact: Number(effectiveLogLr.toFixed(3)),
    });

    if (type.lr > 1) {
      if (bestTier === null || tierRank(type.tier) < tierRank(bestTier)) bestTier = type.tier;
    }
  }

  const probability = sigmoid(logOdds);
  const verdict = applyTierCap(probability, bestTier, contributions);

  return {
    operatorId: operator.id,
    name: operator.name,
    segment: operator.segment,
    prior,
    probability: Number(probability.toFixed(4)),
    verdict: verdict.band,
    verdictReason: verdict.reason,
    capped: verdict.capped,
    bestTier,
    evidenceCount: contributions.length,
    contributions: contributions.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)),
    asOf,
  };
}

function tierRank(tier) {
  return tier === TIER.A ? 0 : tier === TIER.B ? 1 : 2;
}

/**
 * Map probability to a verdict band, then cap it by evidence quality.
 *
 * The cap encodes a rule that no amount of arithmetic should be allowed to break:
 * you cannot call a restaurant a confirmed Sysco customer without at least one
 * documentary record. Weak signals can suggest; only documents can confirm.
 */
export function applyTierCap(probability, bestTier, contributions) {
  const positives = contributions.filter((c) => c.impact > 0);

  let band;
  if (probability >= 0.9) band = 'confirmed';
  else if (probability >= 0.65) band = 'likely';
  else if (probability >= 0.35) band = 'possible';
  else if (positives.length > 0) band = 'weak';
  else band = 'no-evidence';

  if (band === 'confirmed' && bestTier !== TIER.A) {
    return {
      band: 'likely',
      capped: true,
      reason:
        'Capped below "confirmed": no documentary (Tier A) evidence. Circumstantial signals ' +
        'alone cannot confirm a supply relationship.',
    };
  }

  // A single decayed Tier-A item shouldn't read as freshly confirmed either.
  if (band === 'confirmed') {
    const freshDocumentary = positives.some((c) => c.tier === TIER.A && c.decay > 0.35);
    if (!freshDocumentary) {
      return {
        band: 'likely',
        capped: true,
        reason: 'Capped below "confirmed": all documentary evidence is stale.',
      };
    }
  }

  return { band, capped: false, reason: bandReason(band, positives.length) };
}

function bandReason(band, n) {
  switch (band) {
    case 'confirmed':
      return 'Supported by current documentary evidence.';
    case 'likely':
      return `Multiple corroborating signals (${n}) but short of documentary confirmation.`;
    case 'possible':
      return 'Some supporting evidence; treat as unconfirmed.';
    case 'weak':
      return 'Only weak or heavily aged signals.';
    default:
      return 'No evidence found. This is not a statement that the restaurant avoids Sysco.';
  }
}

export const VERDICT_LABELS = {
  confirmed: 'Confirmed customer',
  likely: 'Likely customer',
  possible: 'Possible customer',
  weak: 'Weak signal only',
  'no-evidence': 'No evidence found',
};

/**
 * Important framing helper. Every verdict describes Sysco as *a* supplier, never the
 * only one. Foodservice operators routinely run a primary broadliner plus produce,
 * protein and specialty houses, so "uses Sysco" never implies "everything is Sysco".
 */
export function describeVerdict(result) {
  if (result.verdict === 'no-evidence') {
    return `No public evidence links ${result.name} to Sysco. Absence of evidence is not evidence of absence — most Sysco customers leave no public trace.`;
  }
  return `Public records indicate ${result.name} ${
    result.verdict === 'confirmed' ? 'has bought' : 'may have bought'
  } from Sysco as one of its suppliers. This says nothing about what share of its menu is Sysco-sourced.`;
}
