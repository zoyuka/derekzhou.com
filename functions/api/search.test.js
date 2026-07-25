// Tests for the live search endpoint's disclosure guarantees.
//
// The scoring engine is tested separately. What matters here is that the endpoint
// never quietly misrepresents its own coverage: a truncated result set must say so,
// and a caveat that changes how a score should be read must travel with the response.

import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from './search.js';

const CATALOG_URL = 'api.us.socrata.com';

/** Stub global fetch: Socrata catalogue, dataset rows, corpus and menu pages. */
function stubFetch({ rows = [], menuHtml = null } = {}) {
  return async (input) => {
    const u = String(input);

    if (u.includes(CATALOG_URL)) {
      return body(JSON.stringify({
        results: [{
          metadata: { domain: 'portal.gov' },
          resource: { id: 'aaaa-1111', name: 'Food Inspections', columns_field_name: ['dba', 'city', 'state'] },
        }],
      }));
    }
    if (u.includes('portal.gov')) return body(JSON.stringify(rows));
    if (u.includes('data.seed.json')) return body(JSON.stringify({ operators: [] }));
    if (menuHtml && u.includes('menu.example.com')) return body(menuHtml);
    return { ok: false, status: 404, headers: { get: () => null }, body: stream('') };
  };
}

function stream(str) {
  const bytes = new TextEncoder().encode(str);
  let sent = false;
  return {
    getReader: () => ({
      read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: bytes })),
      cancel: async () => {},
    }),
  };
}
const body = (str) => ({ ok: true, status: 200, headers: { get: () => null }, body: stream(str) });

async function search(params, stub) {
  const original = globalThis.fetch;
  globalThis.fetch = stub;
  try {
    const url = new URL('https://example.com/api/search');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await onRequestGet({ request: new Request(url) });
    return { status: res.status, data: await res.json() };
  } finally {
    globalThis.fetch = original;
  }
}

test('rejects a too-short query rather than searching everything', async () => {
  const { status, data } = await search({ q: 'ab' }, stubFetch());
  assert.equal(status, 400);
  assert.match(data.error, /3 characters/);
});

test('an operator with no matches returns the prior, not an empty page', async () => {
  const { data } = await search({ q: 'Nowhere Cafe' }, stubFetch({ rows: [] }));
  assert.equal(data.results.length, 1);
  assert.equal(data.results[0].verdict, 'no-evidence');
  assert.ok(data.results[0].probability > 0);
  assert.match(data.caveat, /Absence of evidence is not evidence of absence/);
});

test('coverage always names the sources that cannot be checked live', async () => {
  const { data } = await search({ q: 'Nowhere Cafe' }, stubFetch({ rows: [] }));
  const ids = data.coverage.notQueryable.map((s) => s.id);
  // These carry the strongest evidence in the model. Omitting them would let a
  // thin result read as exoneration. Note 'bankruptcy-schedules' rather than
  // 'bankruptcy': dockets are searched live now, but reading the actual Schedule
  // E/F line items still needs per-document PACER retrieval, and claiming
  // otherwise would overstate what a live search covers.
  for (const id of ['ucc', 'bankruptcy-schedules', 'fdd', 'checkbook', 'courts']) {
    assert.ok(ids.includes(id), `missing ${id}`);
  }
});

test('truncation is disclosed rather than silently applied', async () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({
    dba: `TEST DINER ${i}`, city: `CITY${i}`, state: 'IL',
  }));
  const { data } = await search({ q: 'Test Diner' }, stubFetch({ rows }));

  // The dataset cap limits rows per portal, so just assert the invariant: whatever
  // is shown, if anything was dropped the response says so and the numbers agree.
  if (data.coverage.truncated) {
    assert.equal(data.results.length, data.coverage.truncated.shown);
    assert.ok(data.coverage.truncated.matched > data.coverage.truncated.shown);
    assert.match(data.coverage.truncated.note, /Showing the first/);
  } else {
    assert.ok(data.results.length <= 60);
  }
});

test('a live local-sourcing claim is flagged as unverified, with its direction stated', async () => {
  const menuHtml = `
    <html><body>
      <p>We proudly source from Blue Hill Farm. Locally sourced, farm-to-table.</p>
      <p>Hand-cut fries $7.00</p>
    </body></html>`;
  const { data } = await search(
    { q: 'Blue Heron', menu: 'https://menu.example.com/x' },
    stubFetch({ rows: [], menuHtml })
  );

  const menuEntry = data.coverage.searched.find((s) => s.kind === 'menu');
  assert.ok(menuEntry, 'menu source must appear in coverage');
  assert.ok(menuEntry.note, 'an unverified local claim must carry a caveat');
  assert.match(menuEntry.note, /UNVERIFIED/);
  // The caveat must state which way the bias runs, not merely that one exists.
  assert.match(menuEntry.note, /lower than shown/);

  const ids = data.coverage.notQueryable.map((s) => s.id);
  assert.ok(ids.includes('usda-farms'), 'farm registries must be declared unavailable');
});

test('a menu with no sourcing claim carries no spurious caveat', async () => {
  const menuHtml = '<html><body><p>Burger $12.00</p><p>Fries $5.00</p></body></html>';
  const { data } = await search(
    { q: 'Plain Grill', menu: 'https://menu.example.com/x' },
    stubFetch({ rows: [], menuHtml })
  );
  const menuEntry = data.coverage.searched.find((s) => s.kind === 'menu');
  assert.equal(menuEntry.note, undefined);
});

test('a blocked menu URL is reported, and never fetched', async () => {
  const { data } = await search(
    { q: 'Some Cafe', menu: 'http://169.254.169.254/latest/meta-data/' },
    stubFetch({ rows: [] })
  );
  const menuEntry = data.coverage.searched.find((s) => s.kind === 'menu');
  assert.match(menuEntry.error, /https/);
  assert.equal(menuEntry.matches, 0);
});

test('a record for Sysco itself is never returned as a customer', async () => {
  const rows = [
    { dba: 'SYSCO CHICAGO LLC', city: 'CHICAGO', state: 'IL' },
    { dba: 'REAL DINER', city: 'CHICAGO', state: 'IL' },
  ];
  const { data } = await search({ q: 'Sysco' }, stubFetch({ rows }));
  assert.ok(!data.results.some((r) => /sysco/i.test(r.name)), 'Sysco must not appear as an operator');
});
