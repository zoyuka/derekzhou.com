// Evidence registry.
//
// Each evidence type carries a likelihood ratio: how much more often we expect to
// see this signal for a restaurant that buys from Sysco than for one that does not.
// LR = P(signal | uses Sysco) / P(signal | does not use Sysco).
//
// These are calibrated judgements, not measured values. Nobody outside Sysco can
// measure them, because the ground-truth customer list is a trade secret. They are
// stated explicitly here so they can be argued with and revised, rather than buried
// in a scoring function. `basis` records the reasoning for each.

export const TIER = {
  A: 'documentary', // sworn filing, contract, or registry record
  B: 'circumstantial', // observable but interpretable
  C: 'weak', // suggestive only
};

export const EVIDENCE_TYPES = {
  bankruptcy_creditor: {
    tier: TIER.A,
    lr: 500,
    halfLifeYears: 6,
    label: 'Named Sysco as a creditor in bankruptcy',
    basis:
      'Schedule E/F and the Form 204 top-20 list are filed under penalty of perjury. ' +
      'A Sysco operating company appearing as a trade creditor means the operator bought ' +
      'from Sysco on credit. Observed repeatedly in real filings (Damon\'s: Sysco Baltimore; ' +
      'Restaurants Unlimited: Sysco Portland + Sysco Seattle).',
    falsePositives: 'Debt could be inherited from a predecessor operator at the same address.',
  },

  sysco_publication: {
    tier: TIER.A,
    lr: 1000,
    halfLifeYears: 4,
    label: 'Named as a customer by Sysco itself',
    basis:
      'Sysco case studies, press releases and Sysco Foodie features name operators directly. ' +
      'This is a party admission by the distributor; essentially no false-positive path.',
    falsePositives: 'Relationship may have ended since publication.',
  },

  court_collection: {
    tier: TIER.A,
    lr: 400,
    halfLifeYears: 5,
    label: 'Sued by Sysco over an unpaid account',
    basis:
      'A collection suit captioned "Sysco <OpCo> v. <Operator>" over goods sold and delivered ' +
      'presupposes a supply relationship. Strong, but structurally biased toward operators ' +
      'who stopped paying, so it under-samples healthy customers badly.',
    falsePositives: 'Caption may name a guarantor or landlord rather than the restaurant.',
  },

  gov_contract: {
    tier: TIER.A,
    lr: 300,
    halfLifeYears: 3,
    label: 'Public contract award naming Sysco as supplier',
    basis:
      'School districts, universities, municipalities and federal agencies publish bid awards ' +
      'and obligations. Verified live against the USAspending API. Authoritative and dated, ' +
      'but only covers institutional foodservice, not independent restaurants.',
    falsePositives: 'An awarded contract is not always exercised; cooperative agreements permit but do not compel purchasing.',
  },

  ucc_filing: {
    tier: TIER.A,
    lr: 200,
    // UCC-1s lapse after 5 years unless continued, so the statutory life is the
    // natural half-life. An unterminated filing past 5 years carries little weight.
    halfLifeYears: 5,
    label: 'Sysco holds a UCC lien on the business',
    basis:
      "Sysco's standard credit terms have the customer grant a security interest in all assets " +
      'and irrevocably authorise Sysco to file UCC-1 financing statements. So a credit customer ' +
      'tends to produce a public filing with a Sysco entity as secured party. Searchable by ' +
      'secured party in some states (GA, WA, CO, MN) and via bulk feeds in others (KY).',
    falsePositives:
      'Filing may be terminated or lapsed; the debtor is a legal entity that may not map to the trade name.',
  },

  supplier_disclosure: {
    tier: TIER.A,
    lr: 200,
    halfLifeYears: 2,
    label: 'Restaurant publicly states it uses Sysco',
    basis: 'Self-disclosure on the operator\'s own site or social account. Party admission.',
    falsePositives: 'Stale pages; franchisee statements that do not apply to all locations.',
  },

  menu_private_label: {
    tier: TIER.B,
    lr: 30,
    halfLifeYears: 1.5,
    label: 'Sysco-exclusive private-label brand named on menu',
    basis:
      'Arrezzio, Block & Barrel, Portico, Butcher\'s Block, Casa Solana, Wholesome Farms, ' +
      'Baker\'s Source, Fire River Farms, House Recipe, Jade Mountain, White Marble Farms and ' +
      'Sysco Simply are Sysco-owned labels not sold through competing broadliners. Naming one ' +
      'on a public menu is strong, though operators rarely do it.',
    falsePositives: 'Cash-and-carry and secondary-market purchases; unrelated businesses sharing a brand word.',
  },

  photo_evidence: {
    tier: TIER.B,
    lr: 15,
    halfLifeYears: 2,
    label: 'Verified photo of Sysco packaging or invoice on premises',
    basis:
      'Crowd-submitted images of Sysco cases, invoices or a delivery in progress. Useful because ' +
      'it reaches independents that no registry covers. Weighted well below documentary evidence ' +
      'because cases are reused, travel between kitchens, and are trivially staged.',
    falsePositives: 'Reused boxes; photo taken elsewhere; deliberate misattribution.',
  },

  job_posting: {
    tier: TIER.C,
    lr: 8,
    halfLifeYears: 1,
    label: 'Job posting references Sysco ordering systems',
    basis: 'Postings asking for experience with Sysco Shop or Sysco ordering suggest an active account.',
    falsePositives: 'Generic industry-experience boilerplate copied between postings.',
  },

  // Negative evidence. LR below 1 pushes the posterior down. None of these go to
  // zero: multi-sourcing is the norm in foodservice, so naming another distributor
  // is entirely compatible with also buying from Sysco.
  competitor_disclosure: {
    tier: TIER.B,
    lr: 0.3,
    halfLifeYears: 2,
    label: 'Publicly names a competing primary distributor',
    basis:
      'Operator states US Foods, PFG, Gordon or similar as its distributor. Lowers but does not ' +
      'eliminate the probability, because most operators run a primary plus one or more secondaries.',
    falsePositives: 'Secondary supplier named as if primary.',
  },

  local_sourcing_claim: {
    tier: TIER.C,
    lr: 0.6,
    halfLifeYears: 1.5,
    label: 'Claims exclusively local or farm-direct sourcing',
    basis:
      'Marketing claims of direct-from-farm sourcing. Deliberately weak: this is frequently ' +
      'puffery covering produce only, while dry goods, oil and paper still arrive on a broadline truck.',
    falsePositives: 'Almost always partially true and wholly compatible with a Sysco account.',
  },
};

/** Sysco-owned labels used by the menu scanner. */
export const SYSCO_PRIVATE_LABELS = [
  'Arrezzio', 'Baker\'s Source', 'Block & Barrel', 'Buckhead Pride', 'Butcher\'s Block',
  'Casa Solana', 'Citavo', 'Cutting Edge Solutions', 'Earth Plus', 'Fire River Farms',
  'House Recipe', 'Imperial Fresh', 'Jade Mountain', 'Newport Pride', 'One Planet',
  'Portico', 'Reliance', 'Sysco Classic', 'Sysco Imperial', 'Sysco Simply',
  'White Marble Farms', 'Wholesome Farms',
];

export function getEvidenceType(id) {
  const t = EVIDENCE_TYPES[id];
  if (!t) throw new Error(`Unknown evidence type: ${id}`);
  return t;
}
