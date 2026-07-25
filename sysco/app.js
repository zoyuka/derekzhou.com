import { scoreOperator, VERDICT_LABELS, describeVerdict } from './engine/score.js';

const BAND_ORDER = ['no-evidence', 'weak', 'possible', 'likely', 'confirmed'];

const els = {
  q: document.getElementById('q'),
  minband: document.getElementById('minband'),
  hidesynth: document.getElementById('hidesynth'),
  results: document.getElementById('results'),
  count: document.getElementById('count'),
};

let scored = [];

async function loadJson(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) return { operators: [] };
    return await res.json();
  } catch {
    return { operators: [] };
  }
}

async function init() {
  const [seed, usasp] = await Promise.all([
    loadJson('data.seed.json'),
    loadJson('data.usaspending.json'),
  ]);

  const operators = [...(seed.operators || []), ...(usasp.operators || [])];
  scored = operators
    .map((o) => ({
      ...scoreOperator(o),
      synthetic: !!o.synthetic,
      state: o.state,
      totalAwardsFound: o.totalAwardsFound,
    }))
    .sort((a, b) => b.probability - a.probability);

  render();
}

function render() {
  const q = els.q.value.trim().toLowerCase();
  const minBand = els.minband.value;
  const hideSynth = els.hidesynth.checked;
  const minIdx = minBand === 'all' ? -1 : BAND_ORDER.indexOf(minBand);

  const rows = scored.filter((r) => {
    if (hideSynth && r.synthetic) return false;
    if (minIdx >= 0 && BAND_ORDER.indexOf(r.verdict) < minIdx) return false;
    if (q && !r.name.toLowerCase().includes(q)) return false;
    return true;
  });

  els.count.textContent = `${rows.length} of ${scored.length} operators shown`;
  els.results.replaceChildren(...rows.map(card));

  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No operators match. That means nothing about whether they use Sysco — only that this corpus has no record.';
    els.results.replaceChildren(li);
  }
}

// Built with createElement throughout. No innerHTML anywhere: every string here
// originates in a public record or a user submission, so it is untrusted by default.
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

function card(r) {
  const li = el('li', 'card');

  const top = el('div', 'card-top');
  const left = el('div');
  const h = el('h3', 'name', r.name);
  if (r.synthetic) h.append(el('span', 'synth', 'demo fixture'));
  left.append(h);
  // Never let a cap be silent: if the corpus truncated correlated repeats, say so,
  // otherwise the card implies the record is thinner than it is.
  const evLabel = r.totalAwardsFound
    ? `${r.evidenceCount} of ${r.totalAwardsFound} records shown`
    : `${r.evidenceCount} evidence item${r.evidenceCount === 1 ? '' : 's'}`;
  left.append(el('p', 'meta', [r.state, r.segment, evLabel].filter(Boolean).join(' · ')));
  top.append(left);
  top.append(el('span', `badge b-${r.verdict}`, VERDICT_LABELS[r.verdict]));
  li.append(top);

  const bar = el('div', 'bar');
  const fill = el('i');
  fill.style.width = `${Math.round(r.probability * 100)}%`;
  bar.append(fill);
  li.append(bar);

  li.append(el('p', 'reason',
    `${Math.round(r.probability * 100)}% · ${r.verdictReason}`));
  li.append(el('p', 'reason', describeVerdict(r)));

  if (r.contributions.length) {
    const d = el('details');
    d.append(el('summary', null, 'Evidence and how it was weighed'));
    const ul = el('ul', 'ev');

    for (const c of r.contributions) {
      const item = el('li');
      const head = el('div', 'ev-h');
      head.append(el('strong', null, c.label));
      head.append(el('span', 'tier', c.tier));
      const impact = el('span', `impact ${c.impact >= 0 ? 'pos' : 'neg'}`,
        `${c.impact >= 0 ? '+' : ''}${c.impact} log-odds`);
      head.append(impact);
      item.append(head);

      if (c.note) item.append(el('div', 'note', c.note));

      const detail = el('div', 'note',
        `LR ${c.rawLr} · recency weight ${c.decay} · identity match ${c.resolution}` +
        (c.dampen < 1 ? ` · correlation damping ×${c.dampen}` : '') +
        (c.observedAt ? ` · observed ${c.observedAt.slice(0, 10)}` : ' · undated'));
      item.append(detail);

      if (c.sourceUrl) {
        const p = el('div');
        const a = el('a', null, c.sourceLabel || 'source');
        a.href = c.sourceUrl;
        a.rel = 'noopener noreferrer nofollow';
        a.target = '_blank';
        p.append(a);
        item.append(p);
      }
      ul.append(item);
    }
    d.append(ul);
    li.append(d);
  }

  return li;
}

els.q.addEventListener('input', render);
els.minband.addEventListener('change', render);
els.hidesynth.addEventListener('change', render);

init();
