// Sysco entity resolution.
//
// Sysco does not appear in public records as "Sysco". It appears as ~70 operating
// companies plus specialty subsidiaries, each with its own legal name. Bankruptcy
// schedules show "Sysco Food Service Portland" and "Sysco Baltimore"; federal award
// data shows "SYSCO IOWA, INC." and "SYSCO CONNECTICUT, LLC". A matcher that greps
// for "sysco" alone is both too narrow (misses FreshPoint, Greco & Sons, Buckhead
// Meat) and too broad (hits unrelated firms and, critically, competitors in text
// that merely mentions Sysco).

// Subsidiaries that are Sysco-owned but do not carry the Sysco name. Presence of
// these in a filing is genuine Sysco evidence, though weaker for "broadline"
// purposes since several are specialty/produce houses.
const SUBSIDIARIES = [
  { pattern: /\bfreshpoint\b/i, unit: 'FreshPoint', kind: 'produce' },
  { pattern: /\bbuckhead\s+(meat|pride)\b/i, unit: 'Buckhead Meat', kind: 'protein' },
  { pattern: /\bnewport\s+(meat|pride)\b/i, unit: 'Newport Meat', kind: 'protein' },
  { pattern: /\bgreco\s*(&|and)?\s*sons\b/i, unit: 'Greco & Sons', kind: 'italian' },
  { pattern: /\beuropean\s+imports\b/i, unit: 'European Imports', kind: 'specialty' },
  { pattern: /\bguest\s+supply\b/i, unit: 'Guest Supply', kind: 'non-food' },
  { pattern: /\bthe\s+smart\s+barn\b/i, unit: 'The SMART Barn', kind: 'specialty' },
  { pattern: /\bsupplies\s+on\s+the\s+fly\b/i, unit: 'Supplies on the Fly', kind: 'non-food' },
];

// Competitors. These exist to *reject* matches, not to find them. A menu page or
// news article that says "we switched from Sysco to US Foods" must not score as
// Sysco evidence, and the negative-evidence path needs to recognise them.
const COMPETITORS = [
  { pattern: /\bus\s*foods?\b/i, name: 'US Foods' },
  { pattern: /\bperformance\s+food\s+group\b|\bpfg\b/i, name: 'Performance Food Group' },
  { pattern: /\bgordon\s+food\s+service\b|\bgfs\b/i, name: 'Gordon Food Service' },
  { pattern: /\bben\s*e\.?\s*keith\b/i, name: 'Ben E. Keith' },
  { pattern: /\bshamrock\s+foods?\b/i, name: 'Shamrock Foods' },
  { pattern: /\bcheney\s+brothers\b/i, name: 'Cheney Brothers' },
  { pattern: /\bmclane\b/i, name: 'McLane' },
];

// Strings that contain "sysco" but are not the distributor. Kept explicit because
// a false positive here silently poisons every downstream score.
const FALSE_FRIENDS = [
  /\bsysco\s*aire\b/i,
  /\bcisco\b/i, // OCR of scanned court filings confuses Cisco/Sysco constantly
];

const SYSCO_CORE = /\bsysco\b/i;

/**
 * Classify a raw party name from a public record.
 * Returns { isSysco, unit, kind, confidence, reason }.
 *
 * `confidence` here is about *identity resolution* (is this string Sysco?), and is
 * deliberately kept separate from evidentiary confidence (does this restaurant use
 * Sysco?). Conflating the two is the most common way these pipelines go wrong.
 */
export function resolveParty(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return { isSysco: false, reason: 'empty' };

  for (const ff of FALSE_FRIENDS) {
    if (ff.test(name)) {
      return { isSysco: false, reason: `matched known false friend: ${ff}` };
    }
  }

  const competitor = COMPETITORS.find((c) => c.pattern.test(name));

  if (SYSCO_CORE.test(name)) {
    // "Sysco" plus a competitor in the same string almost always means prose
    // ("Sysco and US Foods both bid"), not a party name. Refuse to guess.
    if (competitor) {
      return {
        isSysco: false,
        reason: `ambiguous: names both Sysco and ${competitor.name}`,
      };
    }
    return {
      isSysco: true,
      unit: normalizeOpCo(name),
      kind: 'broadline',
      confidence: 0.98,
      reason: 'direct Sysco operating-company name',
    };
  }

  for (const sub of SUBSIDIARIES) {
    if (sub.pattern.test(name)) {
      return {
        isSysco: true,
        unit: sub.unit,
        kind: sub.kind,
        // Lower than a direct match: these names are less distinctive and a
        // local "Newport Meat Co" may predate or sit outside Sysco ownership.
        confidence: 0.85,
        reason: `Sysco subsidiary (${sub.unit})`,
      };
    }
  }

  if (competitor) {
    return { isSysco: false, competitor: competitor.name, reason: 'competitor distributor' };
  }

  return { isSysco: false, reason: 'no match' };
}

/** Collapse "SYSCO FOOD SERVICES OF PORTLAND, INC." -> "Sysco Portland". */
export function normalizeOpCo(name) {
  const cleaned = String(name)
    .replace(/[.,]/g, ' ')
    .replace(/\b(inc|llc|lp|llp|corp|corporation|co|company|division|a\s+division\s+of)\b/gi, ' ')
    .replace(/\bfood\s+services?\b/gi, ' ')
    .replace(/\bof\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export { COMPETITORS, SUBSIDIARIES };
