// Menu forensics.
//
// A menu is a bill of materials that the operator publishes voluntarily. You cannot
// read the supplier off it, but you can read what the kitchen must be buying, and
// some of those inputs are very hard to obtain except through a broadline
// distributor. That makes the menu the only rich signal available for the
// independent restaurants that no registry, court docket or contract award reaches.
//
// Four inference paths, strongest first:
//
//   1. Sysco private-label brand named outright. Nearly conclusive but rare.
//   2. Signature broadline convenience items. Frozen, portioned, factory-breaded
//      products that essentially do not exist outside foodservice distribution.
//   3. Operational impossibility. Menu breadth and out-of-season produce that a
//      kitchen cannot sustain on farm-direct sourcing alone.
//   4. Verified local sourcing, as negative evidence — but only when the named farm
//      can actually be found in a public registry. Unverifiable "locally sourced"
//      copy is marketing, and is scored as such.

import { SYSCO_PRIVATE_LABELS } from './evidence.js';

// Items that are overwhelmingly bought frozen and pre-made. Any single one proves
// nothing; a cluster is a strong operational tell.
const BROADLINE_SIGNATURES = [
  'mozzarella stick', 'onion ring', 'chicken tender', 'chicken finger', 'jalapeno popper',
  'jalapeño popper', 'potato skin', 'loaded fries', 'boneless wing', 'popcorn shrimp',
  'fried pickle', 'cheese curd', 'sampler platter', 'blooming onion', 'coconut shrimp',
  'crab rangoon', 'egg roll', 'spring roll', 'chicken nugget', 'corn dog',
  'mac and cheese bites', 'pretzel bites', 'tater tot', 'curly fries', 'waffle fries',
];

// Language that indicates genuine scratch production, which cuts the other way.
const SCRATCH_MARKERS = [
  'house-made', 'housemade', 'house made', 'made in house', 'in-house', 'scratch',
  'hand-cut', 'hand cut', 'butchered', 'whole animal', 'dry-aged', 'dry aged',
  'house-milled', 'nixtamal', 'fermented in house', 'cured in house', 'baked daily',
  'our own', 'from our farm',
];

// Portion specs copied from a distributor catalogue. A kitchen breaking down whole
// primals does not describe a steak to the ounce; a kitchen ordering pre-portioned
// case-packed protein does, because the number comes off the spec sheet.
const PORTION_SPEC = /\b\d{1,2}\s*(oz|ounce)\b.{0,24}\b(steak|sirloin|filet|burger|patty|breast|portion|cut)\b/i;

// Produce that is out of season across most of the continental US in deep winter.
// Offering it in January means it arrived through a distribution network.
const WINTER_IMPOSSIBLE = [
  'heirloom tomato', 'vine-ripened tomato', 'fresh berries', 'strawberr', 'raspberr',
  'blueberr', 'peach', 'nectarine', 'watermelon', 'cantaloupe', 'fresh corn',
  'sweet corn', 'asparagus', 'zucchini blossom', 'fresh basil', 'mango', 'papaya',
];

const COLD_WINTER_STATES = new Set([
  'AK','CO','CT','IA','ID','IL','IN','MA','ME','MI','MN','MT','ND','NE','NH','NJ',
  'NY','OH','PA','RI','SD','UT','VT','WA','WI','WV','WY',
]);

const LOCAL_CLAIM = /\b(locally\s+sourced|locally\s+grown|farm[\s-]?to[\s-]?table|from\s+local\s+farms?|local\s+produce|sourced\s+locally|farm\s+fresh|we\s+source\s+from)\b/i;

// "X Farm(s)", "X Ranch", "X Creamery", "X Orchard" — a checkable claim, unlike
// unattributed "locally sourced".
const NAMED_FARM = /\b([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,3})\s+(Farms?|Ranch|Creamery|Orchards?|Dairy|Fishery|Apiary|Gardens?)\b/g;

const norm = (s) => String(s || '').toLowerCase();

/**
 * Analyse menu text and return evidence items ready for the scoring engine.
 *
 * @param {object} menu - { text, itemCount?, cuisineCount?, observedAt, sourceUrl, sourceLabel }
 * @param {object} ctx  - { state?, month? (1-12), verifiedFarms?: string[] }
 *        `verifiedFarms` are farm names confirmed against a public registry —
 *        USDA's Local Food Directories (farmers market / CSA / food hub / on-farm
 *        market) and the USDA Organic INTEGRITY database of certified operations.
 */
export function analyzeMenu(menu, ctx = {}) {
  const text = String(menu.text || '');
  const lower = norm(text);
  const out = [];
  const base = {
    observedAt: menu.observedAt,
    sourceUrl: menu.sourceUrl,
    sourceLabel: menu.sourceLabel || 'Menu',
  };

  // 1. Sysco private labels.
  const labels = SYSCO_PRIVATE_LABELS.filter((b) => lower.includes(norm(b)));
  if (labels.length) {
    out.push({
      ...base,
      type: 'menu_private_label',
      note: `Names Sysco-owned label${labels.length > 1 ? 's' : ''}: ${labels.join(', ')}`,
      resolution: 0.9,
    });
  }

  // 2. Broadline convenience clusters.
  const hits = BROADLINE_SIGNATURES.filter((s) => lower.includes(s));
  if (hits.length >= 3) {
    out.push({
      ...base,
      type: 'menu_broadline_signature',
      note: `${hits.length} factory-prepped items on one menu: ${hits.slice(0, 5).join(', ')}${hits.length > 5 ? '…' : ''}`,
      // More hits means more confidence that this is a pattern and not one outlier.
      resolution: Math.min(0.95, 0.5 + 0.08 * hits.length),
    });
  }

  if (PORTION_SPEC.test(text)) {
    out.push({
      ...base,
      type: 'menu_portion_spec',
      note: 'Protein described by exact case-pack portion weight, as it appears on a distributor spec sheet',
      resolution: 0.7,
    });
  }

  // 3. Operational impossibility.
  const itemCount = menu.itemCount ?? countItems(text);
  const cuisineCount = menu.cuisineCount ?? 1;
  if (itemCount >= 90 || (itemCount >= 60 && cuisineCount >= 3)) {
    out.push({
      ...base,
      type: 'menu_breadth',
      note: `${itemCount} items${cuisineCount >= 3 ? ` spanning ${cuisineCount} cuisines` : ''} — a range that is very hard to hold without broadline distribution`,
      resolution: 0.8,
    });
  }

  const month = ctx.month;
  const isWinter = month != null && (month <= 2 || month === 12);
  if (isWinter && COLD_WINTER_STATES.has(String(ctx.state || '').toUpperCase())) {
    const oos = WINTER_IMPOSSIBLE.filter((p) => lower.includes(p));
    if (oos.length) {
      out.push({
        ...base,
        type: 'menu_out_of_season',
        note: `Offers ${oos.slice(0, 3).join(', ')} in ${ctx.state} in month ${month} — outside any local growing season`,
        resolution: 0.75,
      });
    }
  }

  // 4. Sourcing claims — verified and unverified are scored very differently.
  const farms = extractFarms(text);
  const verified = (ctx.verifiedFarms || []).map(norm);
  const confirmedFarms = farms.filter((f) => verified.includes(norm(f)));

  if (confirmedFarms.length) {
    out.push({
      ...base,
      type: 'menu_verified_local_sourcing',
      note: `Names ${confirmedFarms.length} farm${confirmedFarms.length > 1 ? 's' : ''} confirmed in a public agriculture registry: ${confirmedFarms.slice(0, 3).join(', ')}`,
      resolution: 0.9,
    });
  } else if (LOCAL_CLAIM.test(text)) {
    out.push({
      ...base,
      type: 'menu_unverified_local_claim',
      note: farms.length
        ? `Claims local sourcing and names ${farms.length} farm(s), none matched in a public registry`
        : 'Claims local sourcing without naming a verifiable producer',
      resolution: 0.8,
    });
  }

  const scratch = SCRATCH_MARKERS.filter((m) => lower.includes(m));
  if (scratch.length >= 2) {
    out.push({
      ...base,
      type: 'menu_scratch_markers',
      note: `Scratch-production language: ${scratch.slice(0, 3).join(', ')}`,
      resolution: Math.min(0.9, 0.4 + 0.1 * scratch.length),
    });
  }

  return out;
}

/** Pull "Blue Hill Farm"-style producer names out of menu prose. */
export function extractFarms(text) {
  const found = new Set();
  for (const m of String(text).matchAll(NAMED_FARM)) {
    const name = `${m[1]} ${m[2]}`.replace(/\s+/g, ' ').trim();
    // Guard against sentence-initial capitalisation producing junk like "Our Farm".
    if (/^(our|the|a|local|family|this)\b/i.test(name)) continue;
    found.add(name);
  }
  return [...found];
}

/** Rough menu-item count: lines that look like a dish, i.e. carrying a price. */
export function countItems(text) {
  const lines = String(text).split(/\r?\n/);
  return lines.filter((l) => /\$\s?\d/.test(l) || /\b\d{1,3}\.\d{2}\b/.test(l)).length;
}
