// Every request _routes.json sends here (everything the home page does not load)
// passes through this first. A private page (Sysco Trace and its API, the studio)
// answers only to a request carrying a valid Cloudflare Access token, however its
// path is spelled and on whichever host (see lib/access.js); anything else passes
// straight on, as it would have without a Function.

import { isPrivate, verify } from './lib/access.js';

// For the private pages, in case _headers is not applied to a response a
// Function passes on (set only where missing, so _headers wins where it is).
const PRIVATE_HEADERS = {
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};
const PRIVATE_CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'";

const forbidden = () => new Response('Forbidden\n', {
  status: 403,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', ...PRIVATE_HEADERS },
});

// A private response is never kept by a shared cache (Cloudflare's edge would
// otherwise hand a signed-in visitor's copy to anyone asking for that URL).
export function privateCache(cc) {
  if (!cc) return 'private, max-age=0, must-revalidate';
  if (/\b(private|no-store)\b/i.test(cc)) return cc;
  return /\bpublic\b/i.test(cc) ? cc.replace(/\bpublic\b/i, 'private') : 'private, ' + cc;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.protocol === 'http:') {                 // (as _redirects does for the files it serves)
    url.protocol = 'https:';
    return Response.redirect(url.toString(), 301);
  }
  if (!isPrivate(url.pathname)) return context.next();
  if (!(await verify(context.request))) return forbidden();
  const res = await context.next();
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', privateCache(res.headers.get('Cache-Control')));
  for (const [k, v] of Object.entries(PRIVATE_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v);
  if (/^text\/html/i.test(out.headers.get('Content-Type') || '') && !out.headers.has('Content-Security-Policy')) {
    out.headers.set('Content-Security-Policy', PRIVATE_CSP);
  }
  return out;
}
