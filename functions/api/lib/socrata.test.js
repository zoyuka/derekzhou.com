import test from 'node:test';
import assert from 'node:assert/strict';
import { inferColumns, normalizeRow, queryDataset, searchOperators } from './socrata.js';

test('infers columns from a NYC-style inspection schema', () => {
  const m = inferColumns(['camis', 'dba', 'boro', 'building', 'street', 'zipcode', 'phone']);
  assert.equal(m.tradeName, 'dba');
  assert.equal(m.zip, 'zipcode');
  assert.equal(m.phone, 'phone');
});

test('infers columns from a Chicago-style schema', () => {
  const m = inferColumns(['dba_name', 'aka_name', 'license_', 'address', 'city', 'state', 'zip']);
  assert.equal(m.tradeName, 'dba_name');
  assert.equal(m.city, 'city');
  assert.equal(m.state, 'state');
});

test('infers the legal-entity column when a licence dataset carries both names', () => {
  const m = inferColumns(['business_name', 'dba_trade_name', 'contact_phone', 'address_zip']);
  assert.equal(m.legalEntity, 'business_name');
  assert.equal(m.phone, 'contact_phone');
});

test('a dataset with no name column is rejected outright', () => {
  assert.equal(inferColumns(['score', 'violation_code', 'inspection_date']), null);
  assert.equal(inferColumns([]), null);
});

test('legalEntity is dropped when it merely repeats the trade name', () => {
  const ds = { domain: 'd', id: 'x', columns: { tradeName: 'name', legalEntity: 'name' } };
  assert.equal(normalizeRow({ name: 'Joe Diner' }, ds).legalEntity, null);
});

test('phone is reduced to digits so it can key the ownership graph', () => {
  const ds = { domain: 'd', id: 'x', columns: { tradeName: 'n', phone: 'p' } };
  assert.equal(normalizeRow({ n: 'A', p: '(212) 555-0100' }, ds).phone, '2125550100');
});

test('single quotes in a name cannot break out of the SoQL literal', async () => {
  let captured = '';
  const fetchImpl = async (u) => {
    captured = u;
    return { ok: true, status: 200, headers: { get: () => null }, body: body('[]') };
  };
  await queryDataset(
    { domain: 'd.gov', id: 'abcd-1234', columns: { tradeName: 'dba' } },
    "Lou' OR 1=1 --",
    { fetchImpl }
  );
  const decoded = decodeURIComponent(captured);
  // The quote must be doubled — SoQL's escape — so the injected clause stays
  // inert inside the string literal instead of terminating it.
  assert.match(decoded, /LOU'' OR 1=1 --/);

  // The literal must still be balanced: exactly two unescaped quotes, the ones
  // opening and closing upper('...'). Any odd count means a break-out.
  const unescaped = decoded.replace(/''/g, '').match(/'/g) || [];
  assert.equal(unescaped.length, 2, 'the string literal must remain closed');
});

test('one failing portal does not sink the whole search', async () => {
  const catalog = {
    results: [
      { metadata: { domain: 'good.gov' }, resource: { id: 'aaaa-1111', name: 'Good', columns_field_name: ['dba'] } },
      { metadata: { domain: 'bad.gov' }, resource: { id: 'bbbb-2222', name: 'Bad', columns_field_name: ['dba'] } },
    ],
  };
  const fetchImpl = async (u) => {
    if (u.includes('api.us.socrata.com')) return ok(JSON.stringify(catalog));
    if (u.includes('bad.gov')) return { ok: false, status: 500, headers: { get: () => null }, body: body('') };
    return ok(JSON.stringify([{ dba: 'GOOD DINER' }]));
  };

  const { records, searched, failed } = await searchOperators('diner', { fetchImpl });
  assert.equal(records.length, 1);
  assert.equal(records[0].tradeName, 'GOOD DINER');
  assert.equal(searched.length, 1);
  assert.equal(failed.length, 1, 'the failure must be reported, not swallowed');
  assert.match(failed[0].domain, /bad\.gov/);
});

test('datasets without a usable name column are skipped during discovery', async () => {
  const catalog = {
    results: [
      { metadata: { domain: 'a.gov' }, resource: { id: 'aaaa-1111', name: 'Scores only', columns_field_name: ['score'] } },
    ],
  };
  const fetchImpl = async () => ok(JSON.stringify(catalog));
  const { records, searched } = await searchOperators('diner', { fetchImpl });
  assert.equal(records.length, 0);
  assert.equal(searched.length, 0);
});

function body(str) {
  const bytes = new TextEncoder().encode(str);
  let sent = false;
  return {
    getReader: () => ({
      read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: bytes })),
      cancel: async () => {},
    }),
  };
}
const ok = (str) => ({ ok: true, status: 200, headers: { get: () => null }, body: body(str) });
