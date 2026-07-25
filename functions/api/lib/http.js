// Guarded outbound fetch.
//
// One endpoint here takes a URL from the visitor (the menu analyser), which makes
// this an SSRF surface and, if unbounded, an open proxy running on someone else's
// domain. Everything below exists to stop that.

export class FetchError extends Error {}

const ALLOWED_PROTOCOLS = new Set(['https:']);
const DEFAULT_TIMEOUT_MS = 8000;
// Free public APIs (CourtListener, EDGAR, Socrata) return intermittent 5xx and 429
// under load. One bounded retry converts a transient blip into a result instead of a
// reported source failure. Deliberately not more: this is a live request path, and a
// retry storm against a public good is worse than a missing source.
const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 400;
const DEFAULT_MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;

// Literal addresses that must never be reachable. Workers have no private network
// to pivot into, but this code should stay correct if it is ever run anywhere else,
// and blocking them also stops the endpoint being used to probe internal ranges.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,          // link-local, incl. cloud metadata endpoints
  /^0\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i, // unique-local IPv6
  /\.local$/i,
  /\.internal$/i,
];

/**
 * Validate a user-supplied URL before it is ever fetched.
 * Throws rather than returning a flag, so a caller cannot forget to check.
 */
export function assertSafeUrl(raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new FetchError('not a valid URL');
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    // Blocks http:, file:, data:, gopher: and friends.
    throw new FetchError('only https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new FetchError('credentials in URL are not allowed');
  }
  // Non-standard ports are almost always an attempt to reach something internal.
  if (url.port && url.port !== '443') {
    throw new FetchError('non-standard ports are not allowed');
  }
  for (const pattern of BLOCKED_HOST_PATTERNS) {
    if (pattern.test(url.hostname)) {
      throw new FetchError('host is not publicly routable');
    }
  }
  return url;
}

/**
 * Fetch with a timeout, a redirect cap, and a hard byte ceiling.
 *
 * The byte ceiling is enforced while streaming rather than after, so an attacker
 * cannot exhaust memory by pointing this at a huge file — Content-Length can lie
 * or be absent, so trusting it is not enough.
 */
export async function guardedFetch(rawUrl, opts = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBytes = DEFAULT_MAX_BYTES,
    headers = {},
    userSupplied = false,
    fetchImpl = fetch,
  } = opts;

  let url = userSupplied ? assertSafeUrl(rawUrl) : new URL(String(rawUrl));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response;
    let current = url;

    for (let hop = 0; ; hop++) {
      response = await fetchImpl(current.toString(), {
        headers: { 'User-Agent': 'sysco-trace/0.1 (+https://derekzhou.com/sysco/)', ...headers },
        // Follow redirects manually so each hop is re-validated. Automatic
        // following would let a safe-looking URL redirect to an internal one.
        redirect: 'manual',
        signal: controller.signal,
      });

      const location = response.headers.get('location');
      const isRedirect = response.status >= 300 && response.status < 400 && location;
      if (!isRedirect) break;
      if (hop >= MAX_REDIRECTS) throw new FetchError('too many redirects');

      const next = new URL(location, current);
      if (userSupplied) assertSafeUrl(next);
      current = next;
    }

    if (!response.ok) {
      if (RETRY_STATUSES.has(response.status) && (opts._attempt || 0) < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        clearTimeout(timer);
        return guardedFetch(rawUrl, { ...opts, _attempt: (opts._attempt || 0) + 1 });
      }
      throw new FetchError(`upstream returned ${response.status}`);
    }

    const text = await readCapped(response, maxBytes);
    return { text, url: current.toString(), status: response.status };
  } catch (err) {
    if (err.name === 'AbortError') throw new FetchError('upstream timed out');
    throw err instanceof FetchError ? err : new FetchError(err.message || 'fetch failed');
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response, maxBytes) {
  const reader = response.body?.getReader();
  if (!reader) return '';

  const decoder = new TextDecoder();
  let out = '';
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // Stop pulling rather than buffering the rest. Truncation is fine here:
      // the caller only derives signals, it never echoes the body back.
      await reader.cancel();
      out += decoder.decode(value.slice(0, Math.max(0, value.byteLength - (total - maxBytes))));
      break;
    }
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

export async function fetchJson(url, opts = {}) {
  const { text } = await guardedFetch(url, opts);
  try {
    return JSON.parse(text);
  } catch {
    throw new FetchError('upstream did not return JSON');
  }
}
