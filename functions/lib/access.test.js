import test from 'node:test';
import assert from 'node:assert/strict';
import { isPrivate, verify, forgetKeys, TEAM, AUDS } from './access.js';
import { onRequest, privateCache } from '../_middleware.js';

// The private pages must not be reachable without signing in, however the path
// is spelled: Access matches the path as sent, Pages serves the path it decodes,
// and the project's pages.dev host has no Access at all.

test('private paths, however they are spelled', () => {
  for (const p of [
    '/sysco', '/sysco/', '/sysco/app.js', '/sysco/data.seed.json', '/studio', '/studio/', '/studio/x.js',
    '/api/search', '/api/search/',
    '/sysco%2Fapp.js', '/sysco%2fapp.js', '/sysc%6F%2Fapp.js', '/%73ysco/', '/SYSCO/', '/Sysco%2Fapp.js',
    '/studio%2F', '/%2Fsysco/', '//sysco/', '/./sysco/', '/x/../sysco/app.js', '/assets/..%2Fsysco%2Fapp.js',
    '/assets/%2E%2E%2Fsysco', '/%5Csysco%5Capp.js', '/sysco%E0%A4%A', '/api%2Fsearch',
  ]) assert.equal(isPrivate(p), true, p);
});

test('the public site is not private', () => {
  for (const p of ['/', '/index.html', '/404.html', '/style.v12.css', '/sky.v2.js', '/assets/fonts/x.woff2',
                   '/robots.txt', '/.well-known/security.txt', '/apple-touch-icon.png', '/nonexistent', '/systems']) {
    assert.equal(isPrivate(p), false, p);
  }
});

// A key pair standing in for the team's, its public half served as the team's certs.
const b64u = (buf) => Buffer.from(buf).toString('base64url');
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
let fetches = 0;
const certs = async (url) => { fetches++; assert.equal(url, TEAM + '/cdn-cgi/access/certs'); return new Response(JSON.stringify({ keys: [jwk] }), { status: 200 }); };
const NOW = 1_800_000_000_000;
async function token(claims, { kid = 'k1', alg = 'RS256', key = pair.privateKey } = {}) {
  const h = b64u(JSON.stringify({ alg, kid, typ: 'JWT' }));
  const c = b64u(JSON.stringify({ iss: TEAM, aud: [AUDS[0]], exp: NOW / 1000 + 600, iat: NOW / 1000 - 60, nbf: NOW / 1000 - 60, email: 'owner@example.com', ...claims }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(h + '.' + c));
  return h + '.' + c + '.' + b64u(sig);
}
const req = (headers = {}) => new Request('https://derekzhou.com/sysco/', { headers });
const check = (r) => verify(r, { fetch: certs, now: NOW });

test('a valid token, in the header Access adds or in its cookie', async () => {
  forgetKeys();
  assert.equal(await check(req({ 'Cf-Access-Jwt-Assertion': await token({}) })), true);
  assert.equal(await check(req({ Cookie: 'a=b; CF_Authorization=' + (await token({})) + '; c=d' })), true);
});

test('no token, or a token that is not right, is refused', async () => {
  forgetKeys();
  const bad = [
    {},
    { 'Cf-Access-Jwt-Assertion': 'not-a-token' },
    { 'Cf-Access-Jwt-Assertion': 'a.b.c' },
    { 'Cf-Access-Jwt-Assertion': await token({ aud: ['someone-elses-app'] }) },
    { 'Cf-Access-Jwt-Assertion': await token({ aud: 'someone-elses-app' }) },
    { 'Cf-Access-Jwt-Assertion': await token({ iss: 'https://evil.cloudflareaccess.com' }) },
    { 'Cf-Access-Jwt-Assertion': await token({ exp: NOW / 1000 - 3600 }) },
    { 'Cf-Access-Jwt-Assertion': await token({ exp: undefined }) },
    { 'Cf-Access-Jwt-Assertion': await token({ nbf: NOW / 1000 + 3600 }) },
    { 'Cf-Access-Jwt-Assertion': await token({}, { key: other.privateKey }) },   // signed by another key
    { 'Cf-Access-Jwt-Assertion': await token({}, { kid: 'k-unknown' }) },
    { 'Cf-Access-Jwt-Assertion': await token({}, { alg: 'HS256' }) },
  ];
  for (const h of bad) assert.equal(await check(req(h)), false, JSON.stringify(h).slice(0, 80));
  // a payload changed after signing
  const t = (await token({})).split('.');
  t[1] = b64u(JSON.stringify({ iss: TEAM, aud: [AUDS[0]], exp: NOW / 1000 + 99999 }));
  assert.equal(await check(req({ 'Cf-Access-Jwt-Assertion': t.join('.') })), false);
  // the unsigned alg
  const none = b64u(JSON.stringify({ alg: 'none', kid: 'k1' })) + '.' + b64u(JSON.stringify({ iss: TEAM, aud: [AUDS[0]], exp: NOW / 1000 + 600 })) + '.';
  assert.equal(await check(req({ 'Cf-Access-Jwt-Assertion': none })), false);
});

test('the keys are fetched once and kept; no keys at all is a no', async () => {
  forgetKeys(); fetches = 0;
  for (let i = 0; i < 5; i++) assert.equal(await check(req({ 'Cf-Access-Jwt-Assertion': await token({}) })), true);
  assert.equal(fetches, 1);
  forgetKeys();
  const down = async () => new Response('', { status: 503 });
  assert.equal(await verify(req({ 'Cf-Access-Jwt-Assertion': await token({}) }), { fetch: down, now: NOW }), false);
  const broken = async () => { throw new Error('network'); };
  forgetKeys();
  assert.equal(await verify(req({ 'Cf-Access-Jwt-Assertion': await token({}) }), { fetch: broken, now: NOW }), false);
});

test('the middleware: private refused without a token, public passed straight on', async () => {
  let passed = 0;
  const next = async () => { passed++; return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/html', 'Cache-Control': 'public, max-age=14400' } }); };
  for (const path of ['/sysco/', '/sysco%2Fapp.js', '/sysc%6F%2Fapp.js', '/studio/', '/api/search?q=x']) {
    const r = await onRequest({ request: new Request('https://derekzhou-com.pages.dev' + path), next });
    assert.equal(r.status, 403, path);
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  }
  assert.equal(passed, 0);
  const r = await onRequest({ request: new Request('https://derekzhou.com/nonexistent'), next });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'public, max-age=14400');   // (untouched)
  assert.equal(passed, 1);
  const h = await onRequest({ request: new Request('http://derekzhou.com/sysco/'), next });
  assert.equal(h.status, 301);
  assert.equal(h.headers.get('Location'), 'https://derekzhou.com/sysco/');
});

test('a private response is never kept by a shared cache', () => {
  assert.equal(privateCache(null), 'private, max-age=0, must-revalidate');
  assert.equal(privateCache('public, max-age=300'), 'private, max-age=300');
  assert.equal(privateCache('max-age=0, must-revalidate'), 'private, max-age=0, must-revalidate');
  assert.equal(privateCache('no-store'), 'no-store');
  assert.equal(privateCache('private, max-age=60'), 'private, max-age=60');
});

test('the middleware: a signed-in request passes, kept out of shared caches, with its headers', async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = certs;
  try {
    forgetKeys();
    const now = Date.now() / 1000;
    const t = await token({ exp: now + 600, iat: now - 5, nbf: now - 5 });
    let passed = 0;
    const next = async () => { passed++; return new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=14400' } }); };
    const r = await onRequest({ request: new Request('https://derekzhou.com/sysco/', { headers: { 'Cf-Access-Jwt-Assertion': t } }), next });
    assert.equal(r.status, 200);
    assert.equal(passed, 1);
    assert.equal(r.headers.get('Cache-Control'), 'private, max-age=14400');
    assert.equal(r.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.match(r.headers.get('Content-Security-Policy'), /connect-src 'self'/);
    assert.equal(await r.text(), '<!doctype html>');
  } finally {
    globalThis.fetch = realFetch;
  }
});
