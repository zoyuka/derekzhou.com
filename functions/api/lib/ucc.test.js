import test from 'node:test';
import assert from 'node:assert/strict';
import { splitDba, isLapsed, evidenceTypeFor, searchLiens, lienToEvidence } from './ucc.js';

const SRC = [{
  state: 'CT', domain: 'data.ct.gov', id: 'x', label: 'CT UCC',
  columns: {
    securedParty: 'sp', debtor: 'db', city: 'city', debtorState: 'st',
    filed: 'filed', lapse: 'lapse', status: 'status', filingType: 'ft', fileNumber: 'fn',
  },
}];

const NOW = '2026-07-25T00:00:00Z';

test('a judgment lien proves more than a routine credit filing', () => {
  // An original financing statement means Sysco extended trade credit. A judgment
  // means Sysco sued over an unpaid account and won, which presupposes goods sold
  // and delivered. Flattening both into "a lien" throws that distinction away.
  assert.equal(evidenceTypeFor('ORIG FIN STMT'), 'ucc_filing');
  assert.equal(evidenceTypeFor('AMENDMENT'), 'ucc_filing');
  assert.equal(evidenceTypeFor('JUDGMENT LIEN'), 'court_collection');
});

test('D/B/A gives the legal-name to trade-name join for free', () => {
  assert.deepEqual(splitDba("BJONDA LLC D/B/A JIMMY'S TOO"),
    { legalEntity: 'BJONDA LLC', tradeName: "JIMMY'S TOO" });
  assert.deepEqual(splitDba('EAST HAVEN HOSPITALITY, LLC dba 95 Bar & Grill'),
    { legalEntity: 'EAST HAVEN HOSPITALITY, LLC', tradeName: '95 Bar & Grill' });
  assert.deepEqual(splitDba('Chuck Barbarie LLC'),
    { legalEntity: 'Chuck Barbarie LLC', tradeName: null });
  assert.deepEqual(splitDba(''), { legalEntity: null, tradeName: null });
});

test('a lapsed filing is no longer perfected', () => {
  assert.equal(isLapsed('2020-01-01', NOW), true);
  assert.equal(isLapsed('2030-01-01', NOW), false);
  assert.equal(isLapsed(null, NOW), false);
  assert.equal(isLapsed('not a date', NOW), false, 'unparseable dates must not silently drop a filing');
});

test('lapsed filings are dropped and counted, not silently discarded', async () => {
  const rows = [
    { sp: 'SYSCO BOSTON, LLC', db: 'ACTIVE DINER LLC', filed: '2025-01-01', lapse: '2030-01-01', ft: 'ORIG FIN STMT' },
    { sp: 'SYSCO BOSTON, LLC', db: 'EXPIRED DINER LLC', filed: '2015-01-01', lapse: '2020-01-01', ft: 'ORIG FIN STMT' },
  ];
  const r = await searchLiens('', { fetchImpl: ok(rows), asOf: NOW, sources: SRC });
  assert.equal(r.liens.length, 1);
  assert.equal(r.liens[0].debtor, 'ACTIVE DINER LLC');
  assert.equal(r.lapsedCount, 1);
});

test('the secured party must survive entity resolution, not just contain "sysco"', async () => {
  const rows = [
    { sp: 'SYSCO CONNECTICUT, LLC', db: 'REAL DINER', filed: '2025-01-01', lapse: '2030-01-01', ft: 'ORIG FIN STMT' },
    // OCR of scanned filings turns Cisco into Sysco constantly.
    { sp: 'Cisco Systems Capital', db: 'NOT A RESTAURANT', filed: '2025-01-01', lapse: '2030-01-01', ft: 'ORIG FIN STMT' },
    { sp: 'US Foods Inc', db: 'COMPETITOR CUSTOMER', filed: '2025-01-01', lapse: '2030-01-01', ft: 'ORIG FIN STMT' },
  ];
  const r = await searchLiens('', { fetchImpl: ok(rows), asOf: NOW, sources: SRC });
  assert.equal(r.liens.length, 1);
  assert.equal(r.liens[0].debtor, 'REAL DINER');
  assert.equal(r.rejectedParty, 2);
});

test('one filing amended repeatedly is one fact, not several', async () => {
  const rows = Array.from({ length: 4 }, () => ({
    sp: 'SYSCO BOSTON, LLC', db: 'NAVIN BROS', filed: '2022-08-19', lapse: '2027-08-30', ft: 'AMENDMENT',
  }));
  const r = await searchLiens('', { fetchImpl: ok(rows), asOf: NOW, sources: SRC });
  assert.equal(r.liens.length, 1);
});

test('a source failure is reported rather than swallowed', async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, headers: { get: () => null }, body: streamOf('') });
  const r = await searchLiens('', { fetchImpl, asOf: NOW, sources: SRC });
  assert.equal(r.liens.length, 0);
  assert.equal(r.failed.length, 1);
  assert.match(r.failed[0].reason, /500/);
});

test('the debtor name is escaped into the SoQL literal', async () => {
  let captured = '';
  const fetchImpl = async (u) => { captured = u; return okResponse('[]'); };
  await searchLiens("O'Malley's", { fetchImpl, asOf: NOW, sources: SRC });
  const decoded = decodeURIComponent(captured);
  assert.match(decoded, /O''Malley''s/);
  const unescaped = decoded.replace(/''/g, '').match(/'/g) || [];
  assert.equal(unescaped.length % 2, 0, 'literals must stay balanced');
});

test('evidence resolution is higher when a trade name was recovered', () => {
  const base = { syscoUnit: 'Sysco Boston', partyConfidence: 0.98, filed: '2025-01-01', evidenceType: 'ucc_filing', debtor: 'X' };
  const withDba = lienToEvidence({ ...base, tradeName: "Jimmy's Too" });
  const without = lienToEvidence({ ...base, tradeName: null });
  assert.ok(withDba.resolution > without.resolution);
  assert.ok(withDba.resolution < 1, 'a filing names a legal entity, never a storefront with certainty');
});

test('a judgment lien says so in its note', () => {
  const e = lienToEvidence({
    evidenceType: 'court_collection', debtor: 'BJONDA LLC', syscoUnit: 'Sysco Boston',
    filed: '2024-03-11', partyConfidence: 0.98, tradeName: "JIMMY'S TOO",
  });
  assert.match(e.note, /judgment/i);
  assert.match(e.note, /goods sold and delivered/);
});

function streamOf(str) {
  const bytes = new TextEncoder().encode(str);
  let sent = false;
  return {
    getReader: () => ({
      read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: bytes })),
      cancel: async () => {},
    }),
  };
}
const okResponse = (str) => ({ ok: true, status: 200, headers: { get: () => null }, body: streamOf(str) });
const ok = (rows) => async () => okResponse(JSON.stringify(rows));
