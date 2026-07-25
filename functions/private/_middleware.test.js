// Verification tests for the Access JWT middleware.
//
// These sign real RS256 tokens with a generated keypair and assert that every
// tampering path is rejected. The point is not coverage for its own sake: an auth
// check that is wrong in one direction fails silently open, and nothing downstream
// would notice.

import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyAccessJwt, onRequest } from './_middleware.js';

const TEAM = 'testteam.cloudflareaccess.com';
const AUD = 'aud-tag-abc123';
const EMAIL = 'derekyz123@gmail.com';
const NOW_MS = 1_800_000_000_000;

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let keyPair, publicJwk;

async function setup() {
  if (keyPair) return;
  keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  publicJwk.kid = 'test-kid-1';
}

async function makeToken(overrides = {}, { kid = 'test-kid-1', alg = 'RS256', tamper = false } = {}) {
  await setup();
  const header = { alg, kid, typ: 'JWT' };
  const nowS = Math.floor(NOW_MS / 1000);
  const claims = {
    iss: `https://${TEAM}`,
    aud: [AUD],
    email: EMAIL,
    iat: nowS - 60,
    exp: nowS + 3600,
    ...overrides,
  };
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(signingInput)
  );
  let sigPart = b64url(new Uint8Array(sig));
  if (tamper) sigPart = b64url(new Uint8Array(sig).map((b, i) => (i === 0 ? b ^ 0xff : b)));
  return `${signingInput}.${sigPart}`;
}

// Stub JWKS endpoint. Uses a distinct team domain per test group where needed so
// the middleware's key cache doesn't leak between cases.
function jwksFetch(keys) {
  return async () => ({ ok: true, json: async () => ({ keys }) });
}

const opts = (over = {}) => ({
  teamDomain: TEAM, aud: AUD, allowedEmails: [EMAIL], ...over,
});
const deps = async () => {
  await setup();
  return { fetch: jwksFetch([publicJwk]), now: NOW_MS };
};

async function assertDenied(token, options = opts(), why = '') {
  const d = await deps();
  await assert.rejects(
    () => verifyAccessJwt(token, options, d),
    (e) => e instanceof Error,
    why
  );
}

test('accepts a correctly signed, in-date, allowlisted token', async () => {
  const claims = await verifyAccessJwt(await makeToken(), opts(), await deps());
  assert.equal(claims.email, EMAIL);
});

test('rejects a missing token', async () => {
  await assertDenied(null);
  await assertDenied('');
});

test('rejects a malformed token', async () => {
  await assertDenied('not.a.jwt.at.all');
  await assertDenied('onlyonepart');
});

test('rejects a tampered signature', async () => {
  await assertDenied(await makeToken({}, { tamper: true }));
});

test('rejects alg=none and algorithm confusion', async () => {
  // "alg": "none" with an empty signature is the canonical JWT forgery.
  const header = b64url(JSON.stringify({ alg: 'none', kid: 'test-kid-1', typ: 'JWT' }));
  const nowS = Math.floor(NOW_MS / 1000);
  const payload = b64url(JSON.stringify({
    iss: `https://${TEAM}`, aud: [AUD], email: EMAIL, exp: nowS + 3600,
  }));
  await assertDenied(`${header}.${payload}.`);
  // HS256 substitution must be refused before any key handling happens.
  await assertDenied(await makeToken({}, { alg: 'HS256' }));
});

test('rejects an expired token', async () => {
  const nowS = Math.floor(NOW_MS / 1000);
  await assertDenied(await makeToken({ exp: nowS - 3600 }));
});

test('rejects a token that is not yet valid', async () => {
  const nowS = Math.floor(NOW_MS / 1000);
  await assertDenied(await makeToken({ nbf: nowS + 3600 }));
});

test('rejects a wrong audience — this is what blocks a token from another Access app', async () => {
  await assertDenied(await makeToken({ aud: ['some-other-app'] }));
});

test('rejects a wrong issuer', async () => {
  await assertDenied(await makeToken({ iss: 'https://evil.cloudflareaccess.com' }));
});

test('rejects an authenticated but non-allowlisted email', async () => {
  await assertDenied(await makeToken({ email: 'someone.else@gmail.com' }));
});

test('email matching is case-insensitive', async () => {
  const claims = await verifyAccessJwt(
    await makeToken({ email: 'DerekYZ123@Gmail.com' }), opts(), await deps()
  );
  assert.equal(claims.email, 'DerekYZ123@Gmail.com');
});

test('rejects an unknown signing key id', async () => {
  await assertDenied(await makeToken({}, { kid: 'unknown-kid' }));
});

// --- fail-closed behaviour of the request handler itself ---

const req = (headers = {}) => new Request('https://derekzhou.com/private/sysco/', { headers });
const nextOk = async () => new Response('SECRET CONTENT', { status: 200 });

test('denies when the middleware is not configured at all', async () => {
  const res = await onRequest({ request: req(), env: {}, next: nextOk });
  assert.equal(res.status, 404);
  assert.doesNotMatch(await res.text(), /SECRET/);
});

test('denies when configuration is only partial', async () => {
  for (const env of [
    { ACCESS_TEAM_DOMAIN: TEAM },
    { ACCESS_AUD: AUD },
    { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }, // no allowlist
    { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ACCESS_ALLOWED_EMAILS: '' },
  ]) {
    const res = await onRequest({ request: req(), env, next: nextOk });
    assert.equal(res.status, 404, JSON.stringify(env));
    assert.doesNotMatch(await res.text(), /SECRET/);
  }
});

test('denies an unauthenticated request to a fully configured deployment', async () => {
  const res = await onRequest({
    request: req(),
    env: { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ACCESS_ALLOWED_EMAILS: EMAIL },
    next: nextOk,
  });
  assert.equal(res.status, 404);
  assert.doesNotMatch(await res.text(), /SECRET/);
});

test('denial responses are indistinguishable and uncacheable', async () => {
  const a = await onRequest({ request: req(), env: {}, next: nextOk });
  const b = await onRequest({
    request: req({ 'Cf-Access-Jwt-Assertion': 'garbage.token.here' }),
    env: { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ACCESS_ALLOWED_EMAILS: EMAIL },
    next: nextOk,
  });
  assert.equal(a.status, b.status);
  assert.equal(await a.text(), await b.text());
  assert.match(a.headers.get('Cache-Control'), /no-store/);
});
