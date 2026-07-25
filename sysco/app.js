// Live search client.
//
// All source fan-out happens server-side in /api/search: the portals it queries are
// not reachable under this page's CSP (connect-src 'self'), and proxying keeps schema
// mapping, escaping and rate limiting in one place.

const els = {
  form: document.getElementById('searchform'),
  q: document.getElementById('q'),
  where: document.getElementById('where'),
  state: document.getElementById('state'),
  menu: document.getElementById('menu'),
  go: document.getElementById('go'),
  results: document.getElementById('results'),
  count: document.getElementById('count'),
  coverage: document.getElementById('coverage'),
};

const round3 = (n) => Number(Number(n).toFixed(3));

// Built with createElement throughout. No innerHTML anywhere: every string rendered
// here comes from a government portal, a page the visitor pointed us at, or their own
// input, so all of it is untrusted.
function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

let inFlight = null;

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = els.q.value.trim();
  if (q.length < 3) return;

  // Supersede any running search so a slow portal can't overwrite newer results.
  if (inFlight) inFlight.abort();
  const controller = new AbortController();
  inFlight = controller;

  setBusy(true);
  els.count.textContent = 'Searching public records…';
  els.results.replaceChildren();
  els.coverage.hidden = true;

  const params = new URLSearchParams({ q });
  if (els.where.value.trim()) params.set('where', els.where.value.trim());
  if (els.state.value.trim()) params.set('state', els.state.value.trim());
  if (els.menu.value.trim()) params.set('menu', els.menu.value.trim());

  try {
    const res = await fetch(`/api/search?${params}`, { signal: controller.signal });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Search failed (${res.status})`);
    render(data);
  } catch (err) {
    if (err.name === 'AbortError') return;
    els.count.textContent = '';
    els.results.replaceChildren(errorCard(err.message));
  } finally {
    if (inFlight === controller) { inFlight = null; setBusy(false); }
  }
});

function setBusy(busy) {
  els.go.disabled = busy;
  els.go.textContent = busy ? 'Searching…' : 'Search';
}

function errorCard(message) {
  const li = el('li', 'card');
  li.append(el('h3', 'name', 'Search failed'));
  li.append(el('p', 'reason', message));
  return li;
}

function render(data) {
  const n = data.results.length;
  els.count.textContent =
    `${n} operator${n === 1 ? '' : 's'} matched · ${data.relationships} relationship${data.relationships === 1 ? '' : 's'} derived`;

  els.results.replaceChildren(...data.results.map(card));
  renderCoverage(data);
}

function card(r) {
  const li = el('li', 'card');

  const top = el('div', 'card-top');
  const left = el('div');
  left.append(el('h3', 'name', r.name));
  const meta = [r.city, r.state, r.segment,
    `${r.evidenceCount} evidence item${r.evidenceCount === 1 ? '' : 's'}`].filter(Boolean);
  left.append(el('p', 'meta', meta.join(' · ')));
  if (r.legalEntity) left.append(el('p', 'meta', `Legal entity: ${r.legalEntity}`));
  top.append(left);
  top.append(el('span', `badge b-${r.verdict}`, r.verdictLabel));
  li.append(top);

  const bar = el('div', 'bar');
  const fill = el('i');
  fill.style.width = `${Math.round(r.probability * 100)}%`;
  bar.append(fill);
  li.append(bar);

  li.append(el('p', 'reason', `${Math.round(r.probability * 100)}% · ${r.verdictReason}`));
  li.append(el('p', 'reason', r.description));

  if (r.sources?.length) {
    const p = el('p', 'meta');
    p.append(document.createTextNode('Identified via: '));
    r.sources.forEach((s, i) => {
      if (i) p.append(document.createTextNode(', '));
      const a = el('a', null, s.name || s.domain);
      a.href = s.link; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      p.append(a);
    });
    li.append(p);
  }

  if (r.contributions?.length) li.append(evidenceDetails(r.contributions));
  return li;
}

function evidenceDetails(contributions) {
  const d = el('details');
  d.append(el('summary', null, 'Evidence and how it was weighed'));
  const ul = el('ul', 'ev');

  for (const c of contributions) {
    const item = el('li');
    const head = el('div', 'ev-h');
    head.append(el('strong', null, c.label));
    head.append(el('span', 'tier', c.propagated ? 'inherited' : c.tier));
    head.append(el('span', `impact ${c.impact >= 0 ? 'pos' : 'neg'}`,
      `${c.impact >= 0 ? '+' : ''}${c.impact} log-odds`));
    item.append(head);

    if (c.note) item.append(el('div', 'note', c.note));

    if (c.propagated && c.via) {
      item.append(el('div', 'inherited',
        `Not observed at this location — inherited from ${c.via.fromName} via ` +
        `${c.via.chain.join(' → ')} (${c.via.hops} hop${c.via.hops === 1 ? '' : 's'}, ` +
        `weight ×${c.via.attenuation})`));
    }

    item.append(el('div', 'note',
      `LR ${c.rawLr} · recency weight ${c.decay} · identity match ${round3(c.resolution)}` +
      (c.dampen < 1 ? ` · correlation damping ×${c.dampen}` : '') +
      (c.observedAt ? ` · observed ${String(c.observedAt).slice(0, 10)}` : ' · undated')));

    if (c.sourceUrl) {
      const p = el('div');
      const a = el('a', null, c.sourceLabel || 'source');
      a.href = c.sourceUrl; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
      p.append(a);
      item.append(p);
    }
    ul.append(item);
  }
  d.append(ul);
  return d;
}

/**
 * The coverage report carries as much weight as the results. "Nothing found" is this
 * tool's most common answer and it is only interpretable next to a list of what was
 * actually consulted — otherwise a thin result reads as exoneration.
 */
function renderCoverage(data) {
  els.coverage.replaceChildren();
  els.coverage.hidden = false;

  els.coverage.append(el('h2', null, 'What was actually searched'));
  els.coverage.append(el('p', 'caveat', data.caveat));

  const searched = data.coverage.searched || [];
  if (searched.length) {
    els.coverage.append(el('h3', null, `Sources queried (${searched.length})`));
    const ul = el('ul', 'cov');
    for (const s of searched) {
      const li = el('li');
      const label = s.link ? el('a', null, s.name) : el('span', null, s.name);
      if (s.link) { label.href = s.link; label.target = '_blank'; label.rel = 'noopener noreferrer nofollow'; }
      li.append(label);
      li.append(el('span', s.matches ? 'hit' : 'miss',
        s.error ? ` — ${s.error}` : ` — ${s.matches || 0} match${s.matches === 1 ? '' : 'es'}`));
      ul.append(li);
    }
    els.coverage.append(ul);
  }

  const failed = data.coverage.failed || [];
  if (failed.length) {
    els.coverage.append(el('h3', null, `Sources that failed (${failed.length})`));
    const ul = el('ul', 'cov');
    for (const f of failed) {
      ul.append(el('li', 'miss', `${f.name || f.domain} — ${f.reason}`));
    }
    els.coverage.append(ul);
  }

  const offline = data.coverage.notQueryable || [];
  if (offline.length) {
    els.coverage.append(el('h3', null, `Not checkable live (${offline.length})`));
    els.coverage.append(el('p', 'caveat',
      'These carry the strongest evidence in the whole model, and none of them can be ' +
      'queried in real time. A result here is a floor on what exists, never a ceiling.'));
    const ul = el('ul', 'cov');
    for (const o of offline) ul.append(el('li', 'miss', `${o.label} — ${o.why}`));
    els.coverage.append(ul);
  }
}

// Deep links: /sysco/?q=...&where=... runs the search on load.
const initial = new URLSearchParams(location.search);
if (initial.get('q')) {
  els.q.value = initial.get('q');
  els.where.value = initial.get('where') || '';
  els.state.value = initial.get('state') || '';
  els.menu.value = initial.get('menu') || '';
  els.form.requestSubmit();
}
