import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeUrl, guardedFetch, FetchError } from './http.js';

// The menu analyser fetches a URL supplied by whoever is using the page. Without
// these checks that endpoint is both an SSRF pivot and an open proxy running on
// someone else's domain.

test('rejects non-https schemes', () => {
  for (const u of ['http://example.com', 'file:///etc/passwd', 'ftp://example.com',
                   'gopher://example.com', 'data:text/html,hi']) {
    assert.throws(() => assertSafeUrl(u), FetchError, u);
  }
});

test('rejects loopback, private and link-local hosts', () => {
  for (const u of [
    'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x',
    'https://192.168.1.1/x', 'https://172.16.0.1/x', 'https://172.31.255.1/x',
    'https://169.254.169.254/latest/meta-data/', // cloud metadata
    'https://0.0.0.0/x', 'https://[::1]/x', 'https://foo.internal/x', 'https://bar.local/x',
  ]) {
    assert.throws(() => assertSafeUrl(u), FetchError, u);
  }
});

test('allows a normal public https URL', () => {
  const u = assertSafeUrl('https://example.com/menu.html');
  assert.equal(u.hostname, 'example.com');
});

test('172.32 is public and must not be caught by the 172.16/12 rule', () => {
  assert.doesNotThrow(() => assertSafeUrl('https://172.32.0.1/x'));
});

test('rejects embedded credentials and odd ports', () => {
  assert.throws(() => assertSafeUrl('https://user:pass@example.com/'), FetchError);
  assert.throws(() => assertSafeUrl('https://example.com:8080/'), FetchError);
  assert.doesNotThrow(() => assertSafeUrl('https://example.com:443/'));
});

test('rejects malformed input', () => {
  for (const u of ['', 'not a url', null, undefined, 'javascript:alert(1)']) {
    assert.throws(() => assertSafeUrl(u), FetchError);
  }
});

// --- redirect handling ---

function mockFetch(steps) {
  let i = 0;
  return async () => {
    const step = steps[Math.min(i++, steps.length - 1)];
    return {
      ok: step.status < 400,
      status: step.status,
      headers: { get: (h) => (h.toLowerCase() === 'location' ? step.location || null : null) },
      body: bodyOf(step.body ?? ''),
    };
  };
}

function bodyOf(str) {
  const bytes = new TextEncoder().encode(str);
  let sent = false;
  return {
    getReader: () => ({
      read: async () => (sent ? { done: true } : ((sent = true), { done: false, value: bytes })),
      cancel: async () => {},
    }),
  };
}

test('a redirect to an internal host is blocked, not followed', async () => {
  const fetchImpl = mockFetch([
    { status: 302, location: 'https://169.254.169.254/latest/meta-data/' },
    { status: 200, body: 'SECRET' },
  ]);
  await assert.rejects(
    () => guardedFetch('https://example.com/menu', { userSupplied: true, fetchImpl }),
    (e) => e instanceof FetchError && /not publicly routable/.test(e.message)
  );
});

test('a redirect chain that never settles is capped', async () => {
  const fetchImpl = mockFetch([{ status: 302, location: 'https://example.com/again' }]);
  await assert.rejects(
    () => guardedFetch('https://example.com/menu', { userSupplied: true, fetchImpl }),
    (e) => e instanceof FetchError && /too many redirects/.test(e.message)
  );
});

test('follows a safe redirect and returns the final body', async () => {
  const fetchImpl = mockFetch([
    { status: 302, location: 'https://example.com/final' },
    { status: 200, body: 'MENU TEXT' },
  ]);
  const res = await guardedFetch('https://example.com/menu', { userSupplied: true, fetchImpl });
  assert.equal(res.text, 'MENU TEXT');
  assert.match(res.url, /final/);
});

test('oversized responses are truncated rather than buffered whole', async () => {
  const huge = 'x'.repeat(50_000);
  const fetchImpl = mockFetch([{ status: 200, body: huge }]);
  const res = await guardedFetch('https://example.com/big', {
    userSupplied: true, fetchImpl, maxBytes: 1000,
  });
  assert.ok(res.text.length <= 1000, `expected cap to hold, got ${res.text.length}`);
});

test('upstream errors surface as FetchError, not raw failures', async () => {
  const fetchImpl = mockFetch([{ status: 404 }]);
  await assert.rejects(
    () => guardedFetch('https://example.com/gone', { userSupplied: true, fetchImpl }),
    (e) => e instanceof FetchError && /404/.test(e.message)
  );
});
