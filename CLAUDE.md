# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.v2.css           All styles (versioned name — see Caching)
/site.js                Email obfuscation only
/pachinko.js            The quincunx background artwork (see Quincunx)
/subset-fonts.sh        Regenerates the .sub1 font subsets (manual tooling)
/download-fonts.sh      Fetches the full source fonts (manual tooling)
/404.html               Custom 404 page
/assets/favicon.svg     Adaptive circle favicon (dark in light mode, inverse in dark)
/assets/favicon.png     PNG fallback favicon (32x32)
/assets/apple-touch-icon.png  180x180 iOS icon
/assets/fonts/          Self-hosted WOFF2: full faces (sources) + .sub1 subsets (served)
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

Experience:

* Team Lead @ Accenture Song, 2022 – Now

Job title, company, and dates only. No per-role project or client lists.

Links:

* Email: hello@derekzhou.com (obfuscated in HTML, assembled in JS)
* LinkedIn: https://www.linkedin.com/in/derek-z (plain href, rel="me",
  also listed in the JSON-LD Person sameAs)

Both live in the footer, plus the "Pause motion" button (only visible when the
quincunx is animating).

## Design

Typography-driven minimalism with one generative flourish: the quincunx.
Two fonts: a serif for name/bio (Newsreader), a clean sans for UI text (DM Sans).
Self-hosted as subset WOFF2 with @font-face, plus metric-matched local()
fallback faces (size-adjust/ascent/descent overrides computed from the font
tables) so first paint never shifts.

Light/dark mode via prefers-color-scheme + color-scheme property.
Light: warm off-white (#fafaf8), dimmed #6d6d64 (5.0:1 on the light bg — do
not lighten; 4.5:1 is the AA floor). Dark: near-black (#111110), dimmed #8a8a82.
cursor: crosshair on body.
Mobile responsive. Print styles hide footer and both canvases.
Custom ::selection colors matching the palette.
Focus-visible outlines for keyboard navigation.

## Quincunx (pachinko.js)

A date-seeded, deterministic Galton board staged right of the text column on
wide viewports. Balls take van der Corput quantiles through the inverse
Binomial CDF, so the sediment converges to the Gaussian smoothly, never
noisily. Pegs are Pascal's triangle; odd binomial coefficients (Sierpinski)
sit a shade darker. The bias p breathes ±0.06 on a 150 s tide. Everything is
seeded from the date — same day, same edition, for every visitor.

The calm envelope (constants at the top of pachinko.js — any change must keep
all of these true):

* Motion only at ≥1280x620 viewports; narrower/shorter viewports get a static
  sediment horizon band at the bottom (no rAF ever runs there).
* prefers-reduced-motion: the converged edition renders once, stilled; the
  listener reacts to live changes in both directions.
* ≤8 ambient balls (12 during click bursts), ≥500 ms between drops, descent
  ≤90 px/s, ink alpha ≤0.55, all colors read from the CSS custom properties.
* The animation clips to the stage; a CSS mask fades its left edge. It never
  renders under text.
* rAF stops whenever nothing is airborne, on visibilitychange, on pause, and
  never starts in band/still modes. Frame-time self-benchmark steps down
  (no trails, 6 balls, DPR 1.5) once if the median of the first 120 frames
  exceeds 12 ms.
* Footer "Pause motion" button (WCAG 2.2.2) — aria-pressed, persisted in
  localStorage inside try/catch. Ships wherever the loop ships. Non-negotiable.
* Both canvases: aria-hidden, pointer-events: none. Click-to-drop listens on
  document, only right of the text column, never on links/buttons.
* No Math.random and no Date.now in the render path — time comes from the rAF
  timestamp, randomness from the seeded generators (reproducibility is the
  feature).

## CSS

One file: style.v2.css. Plain CSS. Custom properties for theming.
All @font-face declarations (subsets + metric fallbacks) at top of file.
Clamp-based spacing for fluid layout across viewports.
WCAG AA contrast on all dimmed text in both modes.

## JS

Two files, one job each:

1. site.js — email obfuscation: HTML has href="#" id="email-link", JS
   assembles mailto from split parts at runtime so bots cannot scrape the
   address. A \<noscript\> fallback shows the email in HTML entities.
2. pachinko.js — the quincunx (see above). Progressive enhancement: with JS
   off, the page is simply the typography.

## Fonts + performance

Served fonts are ASCII subsets (.sub1, ~46% smaller; regenerate with
./subset-fonts.sh). The full faces stay in the repo as sources. Neither font
contains U+2192 (the footer arrows) — the system fallback renders it; this is
accepted, do not add a glyph. font-display: optional + the metric-matched
fallbacks give CLS = 0 by construction. All four subsets are preloaded in
index.html and Early-Hinted via Link headers on / in \_headers.

Theme-color metas match the palette in both schemes. The favicon is SVG-first
with PNG fallback.

## Caching

HTML: max-age=0, must-revalidate. Everything else: max-age=31536000,
immutable. Immutable means CHANGED BYTES NEED A NEW FILENAME: bump style.vN.css,
pachinko.js → pachinko.v2.js, .sub1 → .sub2, and update every reference
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
robots.txt blocks: GPTBot, ClaudeBot, CCBot, Google-Extended, ChatGPT-User,
Bytespider, anthropic-ai, cohere-ai, FacebookBot.

## Deploy

Cloudflare Pages. Auto-deploys on push to main. No build command needed.
