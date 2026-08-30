# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.v6.css           All styles (versioned name — see Caching)
/site.js                Email obfuscation only
/ink.v6.js              The ink garden — the 2D canvas scene (see Ink garden)
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

Links:

* Email: hello@derekzhou.com (obfuscated in HTML, assembled in JS)
* LinkedIn: https://www.linkedin.com/in/derek-z (plain href, rel="me",
  also listed in the JSON-LD Person sameAs)

Both live in the footer, plus the "Pause motion" button (only visible when
the ink garden is animating).

## Design

One immersive, non-scrolling viewport: typography over "the ink garden" —
a full-viewport 2D-canvas scene of hand-drawn generative ink, at night.
Dark only (color-scheme: dark; no light palette). Type is matte: no
text-shadow, no glow, ever. Tokens: bg #181410 (warm night ground),
text #ece9e4, dimmed #b8b4ac, focus #9db8ff. The six inks live in
ink.v6.js: line #d8d2c4, dim #8f887b, ochre #c79a3d, vermillion #d05a40,
sage #8fa284, slate #8b9cbd (vermillion on ground is the lowest pair,
4.5:1 — do not darken the ground or dim the inks without re-checking).
Text contrast comes from composition, not a scrim: the garden is sparse
line-work and every element is anchored OUTSIDE the measured .stack and
footer boxes (measureAnchors in ink.v6.js). Keep it that way — nothing
may draw under the typography. Two sanctioned exceptions, both
glyph-safe by measurement: in hang mode the falling seed slips down the
right MARGIN beside the text (strictly right of the measured stack box),
and the vermillion star sits in the empty run-out right of the name
GLYPHS (Range-measured; it skips itself when the run-out is too tight).
Click-planted sprigs are scale-clamped near the boxes so their canopies
cannot reach the glyphs either.
The canvas is z-index -1 and pointer-events none, so text and links are
always on top and always clickable. Entrance is pure CSS (ink-rise
keyframes, staggered 0.1–0.7 s, disabled under prefers-reduced-motion).
forced-colors hides the canvas. Print styles hide the scene and footer.

## Ink garden (ink.v6.js)

A hand-drawn day, clocked from local midnight. One 2D canvas, no
libraries, no network. Every stroke is a wobbly polyline redrawn with
fresh jitter a few times a second (the hand-drawn "boil"), so the page
feels like ink held in a steady hand, never like a machine.

The garden is date-seeded (xmur3 day-string seed + splitmix32 streams)
and grows with the day — logistically (smootherstep on the day
fraction): sparse at dawn, in full bloom by evening, the same garden for
every visitor all day. The mathematics is folded into the forms, never
depicted as apparatus:

* Branch sprigs draw themselves in generation by generation; children
  take symmetric ±slots (fair coins), so canopies settle toward
  balanced binomial silhouettes. Blossom inks come from a day-seeded
  Polya urn — colors reinforce themselves, so each day leans warm or
  green from the same six inks.
* THE SEEDFALL (this is the pachinko, folded in): every little while —
  Poisson arrivals, exponential gaps, mean DROP_EVERY_S = 9 s — a seed
  lets go of the anchor sprig (sprigs[0], always planted as the
  seedfall's canopy) and flutters down, each 26 px air-row a coin-flip
  step mean-reverting to its release column (a discrete
  Ornstein-Uhlenbeck walk). Where it lands, a grass blade takes root.
  A day of landings (one kept per ~8 min of daylight, replayed
  deterministically at init) grows a stand of grass whose silhouette
  settles toward the binomial bell: de Moivre-Laplace, drawn as meadow.
  Repeat landings in a 6 px cell thicken the tuft UPWARD (taller
  blades), never denser sideways; past the caps (64 blades, 7 per cell)
  the meadow rests. Blades are single curved strokes with air between
  them — the meadow must never read as texture.
* An ochre thread dangles from the top edge, wanders inside the left
  margin, and ends in an Euler-spiral curl (curvature growing along the
  arc) floating in the gap above the footer links — never on glyphs.
* THE SKEIN: birds in the stepped-zigzag stroke of Derek's tattoo. The
  three tattoo marks are the GLYPH ALPHABET (GLYPHS in ink.v6.js — do
  not restyle them), not a fixed roster: each crossing draws its own
  membership as a coin-flip sum (2..6 birds; the long-tailed glyph
  often leads, and a straggler sometimes trails far behind). The
  drawing IS flight — each mark a wing mid-beat — so they FLY: every
  little while (seeded exponential gaps, ~45 s mean, first crossing a
  few seconds after load) the skein glides across the open band at
  FLY_V = 12 px/s in stop-motion. The mathematics is folded in, never
  depicted: the lead bird carries a slow two-sine undulation and every
  follower echoes it lagged by its distance back over the glide speed
  (the ripple travels down the line, the way real skeins ripple), and
  wing-beats are detuned per bird (0.68–0.95 Hz), so the flock drifts
  in and out of phase across a crossing — emergent beat patterns,
  never a metronome. Direction and altitude are seeded per crossing;
  as drawn the glyphs fly leftward, so rightward crossings mirror.
  Beds mode: the sky band above the typography. Hang mode: the open
  zone between the text and the meadow. Rest: no skein. Reduced motion
  / still frames: a resting pair parked mid-band, as drawn. One
  crossing at a time — never more.

Click anywhere open: a seed is planted and a new sprig grows there
(600 ms debounce, 14-sprig cap; clicks on links, buttons, or anywhere
on/near the measured typography and footer boxes never plant).

LAYOUT MODES (gardenMode in measureAnchors — chosen from measured room,
never from width alone): "beds" when the bottom band below the text fits
standing trees (scale capped by bedCap so canopies stay below the text
and clear of the pause button); "hang" when only the sky above the name
fits (the garden hangs from the top edge, the thread runs along the left
edge off-page on phones, the seed slips down the measured right margin
beside the text before spreading into the open zone below it, landing in
a meadow strip floating above the footer; the flock moves to that open
zone); "rest" when neither fits (short landscape viewports): no sprigs,
no seedfall, no meadow, no flock — thread, starburst and curl
only, and the typography carries the page. Under 700 px the mode is hang
(or rest when even the sky is too shallow).

The calm envelope (header comment of ink.v6.js mirrors this; any change
must keep all of it true):

* Boil rate <= 6 fps (BOIL_FPS = 5); no motion faster than the thread's
  0.08 Hz sway except the falling seed (one at a time, ~9 s apart on
  average, <= 90 px/s total speed — DROP_V = 82 vertical) and the
  flock's crossings (<= 14 px/s glide, stop-motion wing-beats under
  1 Hz, one crossing at a time, long quiet gaps between).
* Strokes only — never clustered dots (hard rule; dot
  clusters read as trypophobia triggers).
* Ink alphas <= 0.85; night ground #181410; palette fixed to the six inks.
* prefers-reduced-motion: the day's garden fully drawn as one still
  frame, zero boil, rAF never starts; live listener both directions.
* Pause button in footer (WCAG 2.2.2): label swap only, freezes the
  frame and all clocks (resume continues the same moment via
  pauseShift), persists (ink-paused) in try/catch. Ships wherever the
  loop ships. Non-negotiable.
* JS off / canvas failure: typography on the night ground, nothing lost.
* No ink under the measured typography or footer boxes; clicks there
  never plant; when a viewport has no room the garden rests to margins
  only (see LAYOUT MODES above).
* No Math.random, no Date.now in the render path; the date is read once
  at init. Zero network. One 2D canvas, one rAF loop that truly sleeps
  between boil frames (setTimeout-scheduled, cancelled on pause/hidden).
* Layout is measured from the real DOM (measureAnchors) and rebuilt on
  resize; visibilitychange shifts the clock like pause so backgrounded
  tabs don't fast-forward.

## CSS

One file: style.v6.css. Plain CSS. Custom properties for theming.
All @font-face declarations (subsets + metric fallbacks) at top of file.
Clamp-based spacing for fluid layout across viewports.
WCAG AA contrast on all dimmed text over the night ground.
The .ink-pause button reserves its layout slot from first paint
(visibility, not display) so revealing it can never shift layout.

## JS

Two files, one job each:

1. site.js — email obfuscation: HTML has href="#" id="email-link", JS
   assembles mailto from split parts at runtime so bots cannot scrape the
   address. A \<noscript\> fallback shows the email in HTML entities.
2. ink.v6.js — the ink garden (see above). Progressive enhancement: with
   JS off, the page is simply the typography on the night ground.

## Fonts + performance

Served fonts are ASCII subsets (.sub2, ~46% smaller; regenerate with
./subset-fonts.sh). The full faces stay in the repo as sources. Neither font
contains U+2192 (the footer arrows) — the system fallback renders it; this is
accepted, do not add a glyph. font-display: optional + the metric-matched
fallbacks give CLS = 0 by construction. All four subsets are preloaded in
index.html and Early-Hinted via Link headers on / in \_headers.

Single dark theme-color (#181410). The favicon is SVG-first
with PNG fallback.

## Caching

HTML: max-age=0, must-revalidate. Everything else: max-age=31536000,
immutable. Immutable means CHANGED BYTES NEED A NEW FILENAME: bump style.vN.css,
ink.v6.js → ink.v6.js, .sub2 → .sub3, and update every reference
(index.html, 404.html, \_headers Link + cache blocks) in the same commit.

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
Trusted Types is NOT enabled, deliberately: Cloudflare Rocket Loader
rewrites the script tags and re-executes them through dynamic .src
assignment — a TT sink — so require-trusted-types-for 'script' kills
site.js AND ink.v6.js on every TT-enforcing browser (verified by
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
