// Edge authentication for everything under /private/*.
//
// This runs on Cloudflare's edge before any byte of protected content is served,
// including static assets. It is the only thing standing between the internet and
// /private/, and it is written to fail closed: any missing configuration, malformed
// token, or unexpected error denies the request.
//
// Why this exists on top of a Cloudflare Access policy:
//
//   1. An Access policy attached to derekzhou.com does NOT cover the project's
//      <project>.pages.dev domain, nor its per-deployment <hash>.<project>.pages.dev
//      preview URLs. Those are publicly routable and bypass the policy entirely.
//      This is the single most commonly missed hole in "protected" Pages sites.
//      Middleware runs on every hostname the project answers on, so it closes it.
//
//   2. It independently verifies the Access JWT's signature, audience and issuer
//      rather than trusting a header. A header alone is spoofable if a request ever
//      reaches the origin by another path.
//
//   3. It enforces an email allowlist, so a misconfigured or overly broad Access
//      policy still cannot admit anyone else.
//
// Required environment variables, set as encrypted Pages secrets — never in the repo:
//   ACCESS_TEAM_DOMAIN    e.g. yourteam.cloudflareaccess.com
//   ACCESS_AUD            Application Audience (AUD) tag from the Access app
//   ACCESS_ALLOWED_EMAILS comma-separated allowlist, e.g. derekyz123@gmail.com

const JWKS_TTL_MS = 60 * 60 * 1000; // re-fetch signing keys hourly
const CLOCK_SKEW_S = 60;

// Per-isolate cache. Not shared globally, which is fine: a cold isolate just
// re-fetches. Never cache a *verification result*, only the public keys.
let jwksCache = { keys: null, fetchedAt: 0, domain: null };

function b64urlToBytes(s) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64urlToJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

async function getJwks(teamDomain, fetchImpl = fetch) {
  const now = Date.now();
  if (jwksCache.keys && jwksCache.domain === teamDomain && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetchImpl(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body.keys) || body.keys.length === 0) throw new Error('JWKS empty');
  jwksCache = { keys: body.keys, fetchedAt: now, domain: teamDomain };
  return body.keys;
}

/**
 * Verify a Cloudflare Access JWT.
 * Returns the claims on success; throws on any failure. Never returns a partial
 * or "probably fine" result — the caller treats a throw as deny.
 */
export async function verifyAccessJwt(token, { teamDomain, aud, allowedEmails }, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const now = Math.floor((deps.now ?? Date.now()) / 1000);

  if (!token || typeof token !== 'string') throw new Error('no token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed token');

  const [rawHeader, rawPayload, rawSig] = parts;
  const header = b64urlToJson(rawHeader);
  const claims = b64urlToJson(rawPayload);

  // Pin the algorithm. Accepting alg from the token is the classic JWT forgery
  // vector ("alg": "none", or HS256 signed with the RSA public key).
  if (header.alg !== 'RS256') throw new Error(`unexpected alg: ${header.alg}`);

  const expectedIss = `https://${teamDomain}`;
  if (claims.iss !== expectedIss) throw new Error('issuer mismatch');

  // aud may be a string or an array.
  const audList = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audList.includes(aud)) throw new Error('audience mismatch');

  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < now) throw new Error('token expired');
  if (typeof claims.nbf === 'number' && claims.nbf - CLOCK_SKEW_S > now) throw new Error('token not yet valid');
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > now) throw new Error('token issued in the future');

  const keys = await getJwks(teamDomain, fetchImpl);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('signing key not found');

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(rawSig),
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`)
  );
  if (!ok) throw new Error('bad signature');

  // Authorisation, separate from authentication. A valid token proves who they
  // are; the allowlist decides whether that person may enter.
  const email = String(claims.email || '').toLowerCase().trim();
  if (!email) throw new Error('no email claim');
  if (!allowedEmails.includes(email)) throw new Error('email not allowlisted');

  return claims;
}

function deny(reason) {
  // Deliberately terse and identical for every failure mode. Telling an attacker
  // *why* they were rejected distinguishes "wrong email" from "expired token" and
  // turns the endpoint into an oracle.
  //
  // The reason is attacker-influenced: it can carry fragments of a malformed token,
  // including invalid UTF-8 that decodes to U+FFFD. Header values are ByteStrings,
  // so setting one unsanitised throws — which would turn a deny into an unhandled
  // error. Strip to printable ASCII before it ever reaches a header.
  const safeReason = String(reason).replace(/[^\x20-\x7E]/g, '?').slice(0, 80);
  return new Response('Not found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      // Surfaced only in logs, never in the body.
      'X-Auth-Reason': safeReason,
    },
  });
}

export async function onRequest(context) {
  // Outer guard. Any unexpected throw anywhere below must become a denial, never a
  // stack trace or a 500 that some upstream layer might handle permissively.
  try {
    return await handle(context);
  } catch (err) {
    return deny(err?.message || 'unhandled error');
  }
}

async function handle(context) {
  const { request, env, next } = context;

  const teamDomain = env.ACCESS_TEAM_DOMAIN;
  const aud = env.ACCESS_AUD;
  const allowed = String(env.ACCESS_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.toLowerCase().trim())
    .filter(Boolean);

  // Fail closed. An unconfigured deployment must serve nothing, not everything.
  // Getting this backwards is how private pages quietly become public ones.
  if (!teamDomain || !aud || allowed.length === 0) {
    return deny('middleware not configured');
  }

  const token =
    request.headers.get('Cf-Access-Jwt-Assertion') ||
    getCookie(request, 'CF_Authorization');

  try {
    await verifyAccessJwt(token, { teamDomain, aud, allowedEmails: allowed });
  } catch (err) {
    return deny(err?.message || 'verification failed');
  }

  const response = await next();
  const headers = new Headers(response.headers);

  // Private content must never be stored by a browser, a proxy, or Cloudflare.
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  headers.set('Pragma', 'no-cache');
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  // connect-src 'self' is required here: the site-wide policy sets it to 'none',
  // which would block this app from fetching its own JSON data files.
  headers.set(
    'Content-Security-Policy',
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; " +
      "font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; " +
      "form-action 'none'"
  );

  return new Response(response.body, { status: response.status, headers });
}

function getCookie(request, name) {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}
