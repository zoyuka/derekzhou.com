# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.v9.css           All styles (versioned name — see Caching)
/site.js                Email obfuscation only
/birds.v2.js            The birds — Samara's jobs-page dots, as birds (see Birds)
/subset-fonts.sh        Regenerates the .sub2 font subsets (manual tooling)
/download-fonts.sh      Fetches the full source fonts (manual tooling)
/404.html               Custom 404 page
/assets/favicon.svg     Adaptive circle favicon (dark in light mode, inverse in dark)
/assets/favicon.png     PNG fallback favicon (32x32)
/assets/apple-touch-icon.png  180x180 iOS icon
/assets/fonts/          Self-hosted WOFF2: full faces (sources) + three .sub2 subsets
                        (served; DM Sans Medium is unused and not subset)
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
Role: Technology Leader (title/OG identity; the JSON-LD jobTitle stays
"Team Lead" — the literal role at Accenture Song)
Bio first sentence (bold): "Derek is a hands-on technology leader"
Bio rest (dimmed): "who leads with clarity, empathy, and genuine enthusiasm
for AI products and the outcomes they enable. He is accountable for solving
complex design and engineering challenges across systems with the perfect
balance of user value, business goals, and technical integrity."

Experience (one line, the .credit row):

* Team Lead · Accenture Song · 2022 – Now

Job title, company, and dates only. No per-role project or client lists.
The credit row is a serif caption (Newsreader 400, .9375rem, dimmed) —
no uppercase, no tracking; the text is unchanged.

Links:

* Email: hello@derekzhou.com (obfuscated in HTML, assembled in JS)
* LinkedIn: https://www.linkedin.com/in/derek-z (plain href, rel="me",
  also listed in the JSON-LD Person sameAs)

Both live in the footer as the plain underlined words "Email" and
"LinkedIn" (no arrows).

## Design

One non-scrolling viewport: the typography on a light ground, with three
birds drifting across the window. The owner's brief, verbatim: "copy
exactly how they did the dots here on Samara.com/jobs. Except instead of
dots use birds and don't use dark background should be light."

Light only (color-scheme: light). Tokens: bg #f9f8f1 (Samara's cream),
text #000 (19.7:1), dimmed #5f5c56 (6.3:1), focus #8a6417 (a dark
ochre, 5.0:1), selection ground #e6e2d6 under the black text (16.2:1).
Type is matte: no text-shadow, no glow. Links are plain underlined words
(1px, dimmed underline, .18em offset); nothing reacts to hover; OS
cursors only. The type is present at first paint in its final place.
Print hides the birds and the footer.

## Birds (birds.v2.js)

Samara's jobs page (samara.com/jobs, read from its bundle: `body > .dot`
in index.css and the /^\/jobs.*/ block in index.js) drops one 14 px black
dot per opening onto the page; each appears at a random moment within
count x 500 ms, fades in over 1 s (`@keyframes appear`) and drifts about
the window at 0.5 px per frame for as long as the page is open.

KEPT FROM SAMARA: up to three birds (one per glyph), the staggered
appearance and the 1 s fade, the pace (SPEED 30 px/s, time-based — a
120 Hz screen does not fly them faster; each bird 0.9–1.1 of it), forever,
never leaving the window. They are the three inline SVGs at the end of
index.html, hidden until the script shows them (no JS: no birds);
birds.v2.js sets their viewBox and polyline and moves them with a CSSOM
transform. It adds no DOM (CI greps createElement/innerHTML/appendChild).
pointer-events: none, so a link under a bird still takes the click.

THE HAND (the ink garden's birds, restored — this is what makes them
alive; v1 dropped it and they read as frozen icons):
* the tattoo glyphs (GLYPHS — the three stepped-zigzag marks are the
  alphabet, do not restyle them: no tilt, no rotation), 1.9 px round
  strokes, each bird its own size (x1.2 x 0.85–1.15)
* the BOIL: every vertex re-jittered BOIL_FPS (5) times a second by the
  visit's hand (1.2–1.6 px, x0.4 on a bird in flight)
* the stop-motion WING-BEAT: wings half-fold toward the body line and
  open again, detuned per bird (0.68–0.95 Hz)
* the drawing (tremor, wings, facing) changes only on the hand's frames;
  the position glides smoothly between them. A bird faces the way it flies
  (the glyphs face left; flying right mirrors them), with hysteresis, and
  the flip lands on a hand frame.

THE FLIGHT (feng shui: nothing ruled straight, nothing sharp, the words
left clear, the space in balance):
* level-ish cruising, the climb a slow mean-reverting wander (PITCH_TAU
  6 s, width by the visit's breeze, at most PITCH_MAX 28°)
* at a wall, the words, a bird, or a gap too narrow to turn in ahead, ONE
  smooth turnaround loop: the widest turning circle (LOOP_R 18–120 px)
  that fits the open space whole — clear of every edge and word by the
  bird's own radius — over the top or under, keeping to the side it last
  turned while that side has room (narrow columns are climbed in
  switchbacks, like a thermal) and away from other birds. Samara's
  instant bounce survives only as a fail-safe (never fires in normal
  flight — see the simulator below)
* THE WORDS ARE NEVER CROSSED: the .stack box (+WORDS 12 px) and each
  footer link (+LINKS 12 px), grown by the bird's radius, are obstacles;
  a bird near a face above or below (or diving at a corner) is held off
  it by a floor/ceiling on its climb (EASE_V 60 px)
* birds part in height to pass, the one behind eases its pace, a loop
  avoids another bird's patch of sky
* balance: each appears at the best of 32 R2 (low-discrepancy) spots —
  clear of the words, with room to turn round, far from the birds already
  out — facing alternately (a Markov flip, 72 % alternate)
* a small sky holds fewer birds: one per TERRITORY (25 000 px²) of open
  sky, at least one wherever one can fly (ONE_BIRD 5 000 px²), none where
  the words fill the screen (a 320x480 phone). Measured phones: 390x844,
  412x720, 430x740 three; 393x664 two; 360x640, 375x548 one.
* a resize, rotation, scroll or font swap re-measures; a bird the words
  moved onto goes and re-appears in balance (with the fade)

THE WEATHER (=rand()): ONE crypto.getRandomValues at init, above the
INIT-END marker, and no clock read at all; splitmix32 streams from it:
one front and four facets (hand, tempo, breeze, pace: a still visit is
still everywhere) and each bird's own stream. Never Math.random (CI).

prefers-reduced-motion: the birds are placed at once (in balance, clear
of the words) and stay still, the hand at rest, live both ways.
forced-colors: CanvasText. A hidden tab pauses with
requestAnimationFrame; a step is capped at 50 ms.

The birds move for as long as the page is open, as Samara's dots do. That
is automatic motion over five seconds beside content, which WCAG 2.2.2
(AA) answers with a pause control; the owner chose Samara's behaviour
without one. prefers-reduced-motion is the only stop.

VERIFY before changing the flight: a node simulator flies the real file
against a fake DOM with the real page layouts (12 viewports, rotations,
scrolls) for simulated minutes and checks: the drawn strokes never touch
the words or leave the window, no fail-safe bounces, turns under ~170°/s,
pace 27–33 px/s, no long overlaps; then a browser pass checks the same
live plus the hand (~5 redraws/s), the wing-beat and the facing.

## CSS

One file: style.v9.css. Plain CSS. Custom properties for theming.
All @font-face declarations (subsets + metric fallbacks) at top of file.
Clamp-based spacing for fluid layout across viewports.
WCAG AA contrast on all dimmed text over the light ground.
One keyframe, `appear` (a bird's 1 s fade-in, Samara's), off under
prefers-reduced-motion; no transitions. :focus-visible is a 2px ochre
outline, offset 3px, on every focusable.

## JS

Two files, one job each:

1. site.js — email obfuscation: HTML has href="#" id="email-link", JS
   assembles mailto from split parts at runtime so bots cannot scrape the
   address. A \<noscript\> fallback shows the email in HTML entities.
2. birds.v2.js — the birds (see above). Progressive enhancement: with JS
   off, the page is simply the typography on the light ground.

## Fonts + performance

Served fonts are ASCII subsets (.sub2, ~46% smaller; regenerate with
./subset-fonts.sh). The full faces stay in the repo as sources. The home
page uses no glyph outside the subsets (the arrows are gone; both subsets
carry · and –); do not add glyphs. font-display: optional + the
metric-matched fallbacks give CLS = 0 by construction. The three served
subsets (Newsreader 400, Newsreader 500–700, DM Sans 400) are preloaded
in index.html and Early-Hinted via Link headers on / in \_headers.
DM Sans Medium is neither declared, subset, preloaded nor hinted —
nothing on the home page sets DM Sans at 500 (the credit row is
Newsreader 400); its full face stays only as a source. Never preload a
font no rule uses (Chrome warns, and every first visit pays for it).

Single light theme-color (#f9f8f1). The favicon is SVG-first
with PNG fallback.

## Caching

HTML: max-age=0, must-revalidate. Everything else: max-age=31536000,
immutable. Immutable means CHANGED BYTES NEED A NEW FILENAME: bump
style.vN.css → style.vN+1.css, birds.vN.js → birds.vN+1.js, .subN → .subN+1,
and update every reference in the same commit — five files, nine edit
points: index.html (stylesheet, script), 404.html (stylesheet),
\_headers (the style Link preload, the style cache block, the birds cache
block, the "next name" comment), .github/workflows/validate.yml
(required files only — the Absences step resolves the shipped
versioned names itself with ls, so it never needs editing), and this
file (grep it for the old name). validate.yml's
reverse check fails on a leftover old version, so git mv rather than
copy.

## SEO

Canonical URL, Open Graph tags, Twitter card meta, JSON-LD Person schema.
Title: "Derek Zhou — Technology Leader".

## Security

All content directly in HTML. No innerHTML. No JS-generated DOM.
External JS and CSS files (enables strict CSP with no unsafe-inline —
CI greps index.html and 404.html for inline style/handlers).
\_headers file: script-src 'self'; style-src 'self'; connect-src 'none';
frame-ancestors 'none'; form-action 'none'; HSTS with preload;
COOP + CORP same-origin; Referrer-Policy no-referrer; broad
Permissions-Policy denial; X-Permitted-Cross-Domain-Policies none.
CI checks that security.txt has not expired.
CI step "Absences are enforced" (scoped to index.html, 404.html, site.js,
birds.v2.js, plus style.v9.css for cursors — never to this prose) fails
on: arrows/cookie/analytics/Loading/navigation-role vocabulary in the
HTML; any exit, idle, hover-position, key, blur, title, favicon-swap or
storage handler in the JS; any DOM building in birds.v2.js; more or
fewer than one getRandomValues in it, or one below its INIT-END marker;
any Math.random or clock read (Date) in it; any URL hook
(location.search/hash/href, URLSearchParams) or sound (Audio,
AudioContext, <audio>, speechSynthesis) in the JS or HTML; and any
`cursor:` rule in the stylesheet (OS cursors only).
Trusted Types is NOT enabled, deliberately: Cloudflare Rocket Loader
rewrites the script tags and re-executes them through dynamic .src
assignment — a TT sink — so require-trusted-types-for 'script' kills
site.js AND birds.v2.js on every TT-enforcing browser (verified by
reproduction). If Rocket Loader is ever disabled in the Cloudflare
dashboard, re-add to the three home-scope CSP blocks:
  ; require-trusted-types-for 'script'; trusted-types
(and never to /sysco/ — its app renders with innerHTML).
CSP rules are scoped per HTML path with NO overlapping rules: Cloudflare
Pages COMBINES same-named headers from every matching rule (it does not
override), and a doubled CSP means browsers enforce the intersection —
this is exactly how /sysco/ fetches were once silently broken. Never put
Content-Security-Policy on /*.
Because of that scoping, 404 responses for arbitrary paths carry no CSP
header (the /404.html rule matches only direct requests), so 404.html
carries the same policy in a meta http-equiv tag — keep the two in sync;
frame-ancestors cannot ride the meta tag, X-Frame-Options on /* covers
framing.
robots.txt blocks: GPTBot, ClaudeBot, CCBot, Google-Extended, ChatGPT-User,
Bytespider, anthropic-ai, cohere-ai, FacebookBot.

## Deploy

Cloudflare Pages. Auto-deploys on push to main. No build command needed.
