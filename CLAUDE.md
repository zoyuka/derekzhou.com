# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.v3.css           All styles (versioned name — see Caching)
/site.js                Email obfuscation only
/parlor.v1.js           The parlor — the WebGL scene (see Parlor)
/subset-fonts.sh        Regenerates the .sub2 font subsets (manual tooling)
/download-fonts.sh      Fetches the full source fonts (manual tooling)
/404.html               Custom 404 page
/assets/favicon.svg     Adaptive circle favicon (dark in light mode, inverse in dark)
/assets/favicon.png     PNG fallback favicon (32x32)
/assets/apple-touch-icon.png  180x180 iOS icon
/assets/fonts/          Self-hosted WOFF2: full faces (sources) + .sub2 subsets (served)
/robots.txt             Allow search engines, block AI crawlers
/.well-known/security.txt  Vulnerability reporting
/\_headers               Cloudflare Pages security + caching + Early Hints headers
/\_redirects             HTTPS enforcement
/\_routes.json           Scopes Pages Functions to /api/* only
/.github/workflows/validate.yml  CI checks

Side project, publicly reachable but not linked from the home page:

/sysco/                 Sysco Trace app (see sysco/README.md)
/functions/api/         Live search endpoint backing it

Reachable by anyone with the URL. Kept out of search results via X-Robots-Tag in
\_headers plus a noindex meta tag; delete both to make it indexable. It needs
connect-src 'self' in its CSP block because the site-wide policy sets
connect-src 'none', which would block it fetching its own JSON.

The home page stays pure static HTML/CSS/JS with no build step. Functions exist only
to back /sysco/, which \_routes.json enforces by scoping them to /api/\*.

The /api/search menu parameter fetches a URL supplied by the visitor. Every guard in
functions/api/lib/http.js is load-bearing — https only, no private or link-local hosts,
redirects re-validated per hop, byte ceiling while streaming. Without them the endpoint
is an SSRF pivot and an open proxy. Never relax them, and never return the fetched body. If this page ever
needs real access control, it must be enforced at the edge (Cloudflare Access, or a
Pages Function) — never with a client-side password check, because static content
reaches the browser before any client-side check can run.

## Content

Name: Derek Zhou
Role: Product Manager
Bio first sentence (bold): "Derek is a technology leader"
Bio rest (dimmed): "who leads with clarity, empathy, and genuine enthusiasm
for product and the outcomes it enables. He is accountable for solving complex
product challenges across digital platforms with the perfect balance of user
value, business goals, and technical integrity."

Experience (one line, the .credit row):

* Team Lead · Accenture Song · 2022 – Now

Job title, company, and dates only. No per-role project or client lists.

Links:

* Email: hello@derekzhou.com (obfuscated in HTML, assembled in JS)
* LinkedIn: https://www.linkedin.com/in/derek-z (plain href, rel="me",
  also listed in the JSON-LD Person sameAs)

Both live in the footer, plus the "Pause motion" button (only visible when
the parlor is animating).

## Design

One immersive, non-scrolling viewport: typography at the optical center of
"the parlor" — a full-viewport WebGL scene. Dark only (color-scheme: dark;
no light palette). Type is matte: no text-shadow, no glow, ever.
Bg #0b0e1a, text #ece9e4, dimmed #b8b4ac, focus #9db8ff.
cursor: crosshair. Entrance is pure CSS (opacity/transform keyframes,
staggered 250-850 ms, disabled under prefers-reduced-motion).
Text contrast is guaranteed twice: an in-shader radial luminance well
(field clamped low inside 0.22*min(W,H), feather to 0.34) AND a CSS scrim
(radial-gradient div between canvas and content). Never weaken either.
Print styles hide the scene and footer.

## Parlor (parlor.v1.js)

A pachinko machine at rest. Full-viewport WebGL2, two draw calls: a
domain-warped value-noise aurora + 7-fold quasicrystal interference
mandala (one fullscreen triangle), and 328 lamps on a golden-angle
phyllotaxis spiral (gl.POINTS, premultiplied additive). The lamps run
mean-field Kuramoto dynamics; the coupling K(t) tides across the exact
critical threshold Kc = 2*gamma every 233 s, so the machine's escalation
ladder (idle twinkle -> patchy synchrony -> full phase-lock bloom -> decay)
EMERGES from the mathematics — nothing is scripted. The order parameter r
is the single master signal: bloom, hue ladder (indigo -> teal -> gold,
iridescent sheen only above r=0.68), mandala contrast, zoom.
Date-seeded, clocked from local midnight: same day, same edition,
mid-cycle on load. Click = a slow radial cascade carrying a coupling kick
(~17 s melt). Pointer proximity = gentle local coupling warmth.

The calm envelope (header comment of parlor.v1.js mirrors this; any change
must keep all of it true):

* Two hue families at any instant; palette drift <= 0.15 deg/s.
* Fastest single-lamp modulation 0.23 Hz (frequency tails trimmed by
  construction); fastest full-field 0.1 Hz. No square waves, no springs.
* Additive cap 0.35/lamp; white ceiling #f2e8d5; r_disp in [0.10, 0.78].
* >= 35% of the frame stays <= 0.03 luminance (black budget).
* Motion tempo never changes with performance — the benchmark ladder
  lowers resolution/octaves/folds/fps, never the choreography clock.
  Rungs persist in localStorage (pl-rung) in try/catch.
* prefers-reduced-motion: one analytically converged frame (Ott-Antonsen
  Mobius placement at r=0.707), rAF never starts; live listener both ways.
* Pause button in footer (WCAG 2.2.2): label swap only, freezes on the
  last frame, halts all clocks (resume continues the same moment),
  persists (pl-paused). Ships wherever the loop ships. Non-negotiable.
* No WebGL2 / context creation failure: canvas removed, page is pure
  typography over #0b0e1a — identical to the JS-off experience.
* webglcontextlost/restored handled; scene state lives in CPU arrays.
* No Math.random, no Date.now in the render path; the date is read once
  at init. Zero network. Two draw calls. No libraries.

## CSS

One file: style.v3.css. Plain CSS. Custom properties for theming.
All @font-face declarations (subsets + metric fallbacks) at top of file.
Clamp-based spacing for fluid layout across viewports.
WCAG AA contrast on all dimmed text over the scrimmed well.

## JS

Two files, one job each:

1. site.js — email obfuscation: HTML has href="#" id="email-link", JS
   assembles mailto from split parts at runtime so bots cannot scrape the
   address. A \<noscript\> fallback shows the email in HTML entities.
2. parlor.v1.js — the parlor (see above). Progressive enhancement: with JS
   off, the page is simply the typography on the dark ground.

## Fonts + performance

Served fonts are ASCII subsets (.sub2, ~46% smaller; regenerate with
./subset-fonts.sh). The full faces stay in the repo as sources. Neither font
contains U+2192 (the footer arrows) — the system fallback renders it; this is
accepted, do not add a glyph. font-display: optional + the metric-matched
fallbacks give CLS = 0 by construction. All four subsets are preloaded in
index.html and Early-Hinted via Link headers on / in \_headers.

Single dark theme-color (#0b0e1a). The favicon is SVG-first
with PNG fallback.

## Caching

HTML: max-age=0, must-revalidate. Everything else: max-age=31536000,
immutable. Immutable means CHANGED BYTES NEED A NEW FILENAME: bump style.vN.css,
parlor.v1.js → parlor.v2.js, .sub2 → .sub2, and update every reference
(index.html, 404.html, \_headers Link + cache blocks) in the same commit.

## SEO

Canonical URL, Open Graph tags, Twitter card meta, JSON-LD Person schema.
Title: "Derek Zhou — Product Manager".

## Security

All content directly in HTML. No innerHTML. No JS-generated DOM.
External JS and CSS files (enables strict CSP with no unsafe-inline —
CI greps index.html and 404.html for inline style/handlers).
\_headers file: script-src 'self'; style-src 'self'; connect-src 'none';
frame-ancestors 'none'; form-action 'none'; HSTS.
CSP rules are scoped per HTML path with NO overlapping rules: Cloudflare
Pages COMBINES same-named headers from every matching rule (it does not
override), and a doubled CSP means browsers enforce the intersection —
this is exactly how /sysco/ fetches were once silently broken. Never put
Content-Security-Policy on /*.
robots.txt blocks: GPTBot, ClaudeBot, CCBot, Google-Extended, ChatGPT-User,
Bytespider, anthropic-ai, cohere-ai, FacebookBot.

## Deploy

Cloudflare Pages. Auto-deploys on push to main. No build command needed.
