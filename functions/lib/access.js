// Cloudflare Access, checked again at the origin.
//
// The private pages (Sysco Trace at /sysco/ with its /api/*, and the studio at
// /studio/) sit behind Cloudflare Access, which matches a request's path as it
// arrives. Pages serves the path it decodes, so a slash sent encoded
// (/sysco%2Fapp.js, or /sysc%6F%2Fapp.js) passed Access and was served; and the
// project's own pages.dev host has no Access in front of it at all. So every
// request that could reach a private file also comes through the middleware
// (_routes.json sends it everything the home page does not load), and is let on
// only with a valid Access token: a JWT signed with the team's key (RS256), for
// one of its applications here, not expired. Fail closed: no token, a bad one,
// or no keys to check it with, and the answer is 403.

export const TEAM = 'https://icy-scene-dab5.cloudflareaccess.com';
// The application's AUD tag (Zero Trust > Access controls > Applications > the
// app > Overview). If the app is ever recreated its tag changes: add the new one
// here, or the private pages answer 403 even after signing in.
export const AUDS = ['a988fdd7fce661457aba3a2b4e7c87aaee93ef45302d29271840efec69c9e47e'];

const PRIVATE = ['/sysco', '/studio', '/api'];
const LEEWAY = 30;            // s of clock skew allowed on exp and nbf
const KEYS_TTL = 3600e3;      // ms the team's keys are kept (they rotate every six weeks, with overlap)
const KEYS_RETRY = 60e3;      // ms between refetches for a key id not yet seen

/**
 * Could Pages serve this path (as the request carries it) from a private page?
 * Judged on the path as sent and as Pages decodes it, with backslashes as
 * slashes, slashes merged, dot segments resolved and case folded: if any of
 * them is private, it is private.
 */
export function isPrivate(pathname) {
  const raw = String(pathname || '/');
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* malformed: judged as sent */ }
  const forms = [raw, decoded].map((p) => {
    const flat = p.replace(/\\/g, '/').replace(/\/{2,}/g, '/').toLowerCase();
    const segs = [];
    for (const s of flat.split('/')) {
      if (s === '..') segs.pop();
      else if (s !== '.' && s !== '') segs.push(s);
    }
    return [flat, '/' + segs.join('/')];
  }).flat();
  return forms.some((p) => PRIVATE.some((q) => p.startsWith(q)));
}

/** The Access token a request carries: the header Access adds, or its cookie. */
export function tokenOf(request) {
  const h = request.headers.get('Cf-Access-Jwt-Assertion');
  if (h) return h.trim();
  const m = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(request.headers.get('Cookie') || '');
  return m ? m[1].trim() : null;
}

function bytes(b64url) {
  let s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  s += '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const json = (b64url) => JSON.parse(new TextDecoder().decode(bytes(b64url)));

let keyring = { at: 0, tried: 0, keys: new Map() };
export function forgetKeys() { keyring = { at: 0, tried: 0, keys: new Map() }; }

async function keyFor(kid, fetcher, now) {
  const stale = now - keyring.at > KEYS_TTL;
  const unknown = !keyring.keys.has(kid) && now - keyring.tried > KEYS_RETRY;
  if (stale || unknown) {
    keyring.tried = now;
    const res = await fetcher(TEAM + '/cdn-cgi/access/certs');
    if (res.ok) {
      const body = await res.json();
      const keys = new Map();
      for (const k of body.keys || []) {
        if (k.kty !== 'RSA' || !k.kid || !k.n || !k.e) continue;
        keys.set(k.kid, await crypto.subtle.importKey('jwk', { kty: 'RSA', n: k.n, e: k.e, alg: 'RS256', ext: true },
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']));
      }
      if (keys.size) keyring = { at: now, tried: now, keys };
    }
  }
  return keyring.keys.get(kid) || null;
}

/**
 * Does this request carry a valid Access token for this site? Never throws:
 * anything unexpected is a no. (opts.fetch and opts.now are for the tests.)
 */
export async function verify(request, opts = {}) {
  try {
    const token = tokenOf(request);
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const head = json(parts[0]), claims = json(parts[1]);
    if (head.alg !== 'RS256' || !head.kid) return false;
    const nowMs = opts.now !== undefined ? opts.now : Date.now(), now = nowMs / 1000;
    const key = await keyFor(head.kid, opts.fetch || fetch, nowMs);
    if (!key) return false;
    const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
    if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, bytes(parts[2]), signed))) return false;
    if (claims.iss !== TEAM) return false;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    if (!aud.some((a) => AUDS.includes(a))) return false;
    if (typeof claims.exp !== 'number' || claims.exp < now - LEEWAY) return false;
    if (typeof claims.nbf === 'number' && claims.nbf > now + LEEWAY) return false;
    return true;
  } catch {
    return false;
  }
}
