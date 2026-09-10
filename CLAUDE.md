# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.v7.css           All styles (versioned name — see Caching)
/site.js                Email obfuscation only
/ink.v10.js              The ink garden — the 2D canvas scene (see Ink garden)
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
"LinkedIn" (no arrows), plus the "Pause the ink" / "Resume the ink"
control (only visible when the ink garden is animating; its aria-label
begins with the visible text — WCAG 2.5.3). Nothing on the page names,
shows or hints at the visit's weather (see THE WEATHER below).

## Design

One immersive, non-scrolling viewport: typography over "the ink garden" —
a full-viewport 2D-canvas scene of hand-drawn generative ink, at night.
A personal page should feel like you have briefly left the rest of the
internet, so the page has none of the internet's body language: no
entrance animation, no hover replies, no loading state, no arrows, no
uppercase-tracked labels, no blue focus ring, no pointer cursor on the
control, nothing that reacts to idling or leaving. CI greps enforce the
absences (see Security).
Dark only (color-scheme: dark; no light palette). Type is matte: no
text-shadow, no glow, ever. Tokens: bg #181410 (warm night ground),
text #ece9e4, dimmed #b8b4ac, focus #c79a3d (the ochre ink, 7.08:1), selection ground #5a554c (under the text colour, 6.11:1 — never
paper-white). The six inks live in
ink.v10.js: line #d8d2c4, dim #8f887b, ochre #c79a3d, vermillion #d05a40,
sage #8fa284, slate #8b9cbd (vermillion on ground is the lowest pair,
4.5:1 — do not darken the ground or dim the inks without re-checking).
Links are plain underlined words (1px, dimmed underline, .18em offset);
nothing reacts to hover; OS cursors only (never cursor:none, never a
custom cursor).
Text contrast comes from composition, not a scrim: the garden is sparse
line-work and every element is anchored OUTSIDE the measured .stack and
footer boxes (measureAnchors in ink.v10.js). Keep it that way — nothing
may draw under the typography. One sanctioned exception, glyph-safe by
measurement: in hang mode the falling seed slips down the right MARGIN
beside the text (strictly right of the measured stack box).
Click-planted sprigs are scale-clamped near the boxes so their canopies
cannot reach the glyphs either.
The canvas is z-index -1 and pointer-events none, so text and links are
always on top and always clickable. No entrance: the type is present at
first paint in its final place; only the canvas eases in (opacity, 1.6 s
after a 0.2 s beat; none under prefers-reduced-motion). Nothing fires
inside that reveal unless it was already underway before the visitor
arrived (see the opening state below).
forced-colors hides the canvas, and ink.v10.js treats it like reduced
motion (no loop, no pause button — a control for nothing). Print styles
hide the scene and footer.

## Ink garden (ink.v10.js)

A hand-drawn day, clocked from local midnight. One 2D canvas, no
libraries, no network. Every stroke is a wobbly polyline redrawn with
fresh jitter a few times a second (the hand-drawn "boil"), so the page
feels like ink held in a steady hand, never like a machine.

THE PLACE is date-seeded (xmur3 day-string seed + splitmix32 streams)
and grows with the day — logistically (smootherstep on the day
fraction): sparse at dawn, in full bloom by evening, held through the
small hours (00:00–05:00 keep the evening's fullness and the full
meadow) until dawn clears it — the same garden for every visitor all
day. The youngest day sprig is still drawing its last
generation at first paint (born -10.4 s: its final generation draws in
over 0–2.6 s, tip blossoms at ~3.6 s — growth in progress, never an
event; the still frame at t = 1e4 is unaffected). The mathematics is
folded into the forms, never depicted as apparatus:

* Branch sprigs draw themselves in generation by generation; children
  take symmetric ±slots (fair coins), so canopies settle toward
  balanced binomial silhouettes. Blossom inks come from a day-seeded
  Polya urn — colors reinforce themselves, so each day leans warm or
  green from the same six inks.
* THE SEEDFALL (this is the pachinko, folded in): every little while —
  Poisson arrivals, exponential gaps, mean dropMean 9–13 s per visit
  (12–16 s in the quiet hours), clamped 5.5–18 s, counted from the
  previous LANDING (not the release — a hang-mode fall lasts ~8 s and
  would otherwise chain straight into the next) — a seed lets go of
  the anchor sprig (sprigs[0], always planted as the seedfall's canopy)
  and flutters down, each 26 px air-row a coin-flip step mean-reverting
  to its release column (a discrete Ornstein-Uhlenbeck walk). Where it
  lands, a grass blade takes root. A day of landings (one kept per
  ~8 min of daylight after 06:30, the full stand through the small
  hours, replayed deterministically from the DAY stream at init) grows
  a stand of grass whose silhouette settles
  toward the binomial bell: de Moivre-Laplace, drawn as meadow. Live
  seeds ride the VISIT stream (arrival, walk, release twig — twigs
  spread by a golden-ratio Kronecker sequence; the coin flips stay a
  fair, unstratified walk so the bell stays honest), so live landings
  never desynchronise the day's replay. Repeat landings in a 6 px cell
  thicken the tuft UPWARD (taller blades), never denser sideways; past
  the caps (64 blades, 7 per cell) the meadow rests. Blades are single
  curved strokes with air between them — the meadow must never read as
  texture.
* THE WIND (feng is wind, shui is water): ONE field, wind(x,t) = sin(t*0.30 + dir*x*0.011 + phase)
  × gust(t), 0.048 Hz, ~570 px wavelength — frequency and wavelength
  fixed. Everything rides it with its own gain as a CEILING — grass
  lean 1.3 px, canopy shear <= 2.4 px (scaled by distance from the
  root), seed drift 2 px, bird bob 2.5 px — times
  this visit's gust envelope in [0.75, 1.0] (breathing over 110–180 s
  windows, incommensurate with the 20.9 s field period; floor 0.75 so
  nothing that should move reads as static). Because the field has spatial phase, the gust
  visibly travels across the garden, in this visit's direction: grass
  bends blade by blade as it passes, then the tree above it. Continuous gentle vitality between events; nothing on the
  page oscillates faster than this field except wing-beats and the
  boil. The still frame rides the DAY's phase at gain 1, direction +1.
* THE SKEIN: birds in the stepped-zigzag stroke of Derek's tattoo. The
  three tattoo marks are the GLYPH ALPHABET (GLYPHS in ink.v10.js — do
  not restyle them), not a fixed roster: each crossing draws its own
  membership: usually a coin-flip sum of 2..6, sometimes a loner (15%),
  rarely a great skein of 7..8 (7%); the long-tailed glyph
  often leads, and a straggler sometimes trails far behind. The
  drawing IS flight — each mark a wing mid-beat — so they FLY: every
  little while (this visit's exponential gaps, mean 26–44 s, 36–54 s in
  the quiet hours, clamped 10–60 s) the skein MEANDERS across the band
  at FLY_V = 12 px/s in stop-motion — altitude drifts between two
  levels (an S-curve, never a straight rush; curved paths gather qi);
  the entry level follows a golden-ratio Kronecker sequence, so
  consecutive crossings never fly the same lane. The lead bird carries
  a slow two-sine undulation and every follower echoes it lagged by its
  distance back over the glide speed (the ripple travels down the line,
  the way real skeins ripple), and wing-beats are detuned per bird
  (0.68–0.95 Hz), so the flock drifts in and out of phase across a
  crossing — emergent beat patterns, never a metronome. Direction and
  altitude are seeded per crossing; as drawn the glyphs fly leftward,
  so rightward crossings mirror; direction is a Markov flip (72%
  alternate), so a visit sees both. The first crossing is the opening
  state (below): sometimes already mid-band as the door opens, else
  entering from beyond the edge at 6–16 s.
  Beds mode: the sky band above the typography. Hang mode: the open
  zone between the text and the meadow. Rest: no skein. Reduced motion
  / still frames: a resting pair parked mid-band, as drawn. One
  crossing at a time — never more.

THE WEATHER (=rand()): the day seed owns the PLACE — the sprigs, the
urn, the meadow replay, the click-sprig stream, and the whole
reduced-motion still frame. A VISIT seed — one crypto
draw at init (Uint32, with a performance.now fallback), never stored,
never shown, never in the URL, never reseeded by a click, a resize or a
returning tab, never contingent on anything the visitor does — owns the
WEATHER, through one coherent front and four facets mapped into narrow,
audited ranges: `front = (u1+u2)/2` (triangular: most visits ordinary,
extremes rare), `facet = 0.7*front + 0.3*u`, drawn in the fixed order
breeze, traffic, tempo, hand. breeze = (0.2 + 0.8*f) (×0.85 in the
quiet hours; so breeze ∈ [0.17, 1.0]) drives the gust envelope
g = 0.75 + 0.25*breeze*(0.7 + 0.3*noise) ∈ [0.75, 1.0] — g, not breeze,
is the gain the wind carries — plus a visit wind phase, a travel direction
(±1) and a gust period (110–180 s); sky traffic sets the skein gap mean
26–44 s; seedfall tempo sets dropMean 9–13 s; hand steadiness sets the
boil jitter 1.2–1.6 px (with a per-visit noise offset; the polylines,
colours and alphas are the day's). The opening state is what is already underway when the
door opens — exactly one thing, never two: 45 % a skein already
mid-crossing (0.2–0.6 of the way across), 20 % a seed: already mid-fall
with >= 2.5 s of air left at t = 0 where the fall is long enough (hang
mode, ~8 s), else — beds mode, where even the canopy's top gives only
~2 s of fall — letting go from the canopy's top at 2.5 s, right after
the 1.8 s reveal (a drop is never scheduled inside the reveal), else
quiet (35 %) with the first seed at 5–9 s and the first skein entering
at 6–16 s (visible ~8 s later). Two loads therefore differ in what is
stirring and in the weather's tempo; the trees and meadow are the
day's. The
roster probabilities, the 1.6 px jitter ceiling, and every envelope cap
are NOT weather. Quiet hours (23:00–05:00) are behaviour only — longer
gaps, breeze ×0.85 — never palette. A still visit is still everywhere
and a breezy one breezy everywhere, never five unrelated dials. Stream
map — DAY (stream): 1 noise table, 2 day sprigs, 3 click sprigs,
6 meadow replay, 8 urn, 10 still-frame wind phase. VISIT (vstream):
6 live seedfall, 9 skein, 11 weather record, 12 wind, 13 opening
state, 15 hand.

Click anywhere open: a seed is planted and a new sprig grows there
(600 ms debounce, 14-sprig cap that evicts the oldest CLICK sprig and
never a day sprig, 60 px root spacing so two trees never crowd into
busy ink; clicks on links, buttons, or anywhere on/near the measured
typography and footer boxes never plant).

LAYOUT MODES (gardenMode in measureAnchors — chosen from measured room,
never from width alone): "beds" when the bottom band below the text fits
standing trees (scale capped by bedCap so canopies stay below the text
and clear of the pause button); "hang" when only the sky above the name
fits (the garden hangs from the top edge, the seed slips down the
measured right margin
beside the text before spreading into the open zone below it, landing in
a meadow strip floating above the footer; the flock moves to that open
zone). On phones (under 700 px) hang mode also uses the strip: when the
band above the footer fits standing trees (standCap = (footerTop - 30 -
stackBottom - 22)/210 >= 0.32) companions stand on the strip — both
fit: a coin decides per sprig; only the strip fits: the anchor stands
there too and releases from its upper canopy like a bed tree; no tree
fits at all but the band between the text and the footer is >= 60 px:
nothing is planted and the seeds enter down the lane from beyond the
top edge (borrowed scenery), rooting in the strip. "rest" when nothing
fits (short landscape viewports): no sprigs,
no seedfall, no meadow, no flock — nothing is drawn, the loop does not
run and the pause button stays hidden (a control for nothing); the
typography carries the page. Under 700 px the mode is hang (or rest
when neither the sky, the strip nor a 60 px band fits).

The calm envelope (header comment of ink.v10.js mirrors this; any change
must keep all of it true):

* Boil rate <= 6 fps (BOIL_FPS = 5), jitter <= 1.6 px (1.2–1.6 per
  visit); THE WIND (0.048 Hz field, ~570 px) is the fastest
  oscillation, driving all lean/shear/bob; its gains (1.3/2.4/2/2.5 px)
  are ceilings scaled by this visit's gust gain in
  [0.75, 1.0] under a 110–180 s gust envelope, travelling leftward or
  rightward per visit; exceptions: the falling seed (one at a time,
  <= 90 px/s total — DROP_V = 82 vertical; the next release is
  scheduled from the LANDING: mean gap 9–13 s, 12–16 s after
  23:00/before 05:00, clamped 5.5–18 s) and skein crossings (<= 14 px/s
  glide,
  stop-motion wing-beats under 1 Hz, one at a time, mean gap 26–44 s,
  36–54 s late, clamped 10–60 s).
* Strokes only — never clustered dots (hard rule; dot
  clusters read as trypophobia triggers). No fills, no arcs. The paper
  flecks are gone (they were the one dot-like field on the page).
* Ink alphas <= 0.85; night ground #181410; palette fixed to the six inks.
* prefers-reduced-motion: the DAY's garden fully drawn as one still
  frame (day wind phase, direction +1, gain 1, jitter 1.6, no weather),
  zero boil, rAF never starts; live listener both directions. The still
  frame is deterministic per day: identical across visits and seeds.
* Pause button in footer (WCAG 2.2.2): label swap only ('Pause the ink'
  / 'Resume the ink', aria-label swapped with it), freezes the frame
  and all clocks (resume continues the same moment via pauseShift; a
  paused LOAD draws the live frame at t = 0 via pausedFrame() — the
  exact frame resume continues from — never the far-future still frame,
  so nothing can vanish and regrow on resume; a span frozen BEFORE the
  first live frame — a paused or reduced-motion load whose tab was
  hidden before Resume — is never added to pauseShift, so the scene
  clock can never start negative), persists (ink-paused) in
  try/catch. Ships wherever the loop ships. Non-negotiable. Pause, a
  hidden tab, reduced motion and a resting viewport share ONE
  freeze/thaw (frozenAt in sync()): the live clock stops at the first of them and restarts at
  the last, so no combination (e.g. reduced motion toggled while
  hidden) can double-count a span or let one fast-forward through.
* JS off / canvas failure: typography on the night ground, nothing lost.
* No ink under the measured typography or footer boxes; clicks there
  never plant; click-planted sprigs keep 60 px root spacing; when a
  viewport has no room the garden rests (see LAYOUT MODES above).
* Every visit-owned facet lives inside an audited range: nothing the
  visit seed does can move ink into the measured boxes, exceed a
  ceiling, or change the palette — verify with comp-audit.js across
  seeds before touching any of them.
* ONE clock read and ONE entropy read, both at init above the INIT-END
  marker in ink.v10.js; no Math.random anywhere, no Date.now, nothing
  below the marker reads the wall clock or entropy (performance.now
  deltas only, for pause/hidden bookkeeping — not a clock read). The
  PLACE is date-seeded, the WEATHER is visit-seeded. Zero network. One
  2D canvas, one rAF loop that truly sleeps between boil frames
  (setTimeout-scheduled, cancelled on pause/hidden).
* Layout is measured from the real DOM (measureAnchors) and rebuilt on
  resize (a resize re-plants the place; it never rerolls the weather);
  visibilitychange shifts the clock like pause so backgrounded tabs
  don't fast-forward.
* Idle is not a state; nothing reacts to leaving; no listeners for the
  pointer's position, keys, focus loss or page teardown (pagehide only
  clears timers — bfcache-friendly); document.title and the favicon
  never change; no state persisted but ink-paused. A return after
  >= 480 s hidden adds only static day-replay blades (<= 12, continuing
  the DAY stream where the init replay stopped) and at most one fully
  grown day sprig — what a fresh visitor at that minute would see;
  nothing animates, fires or is scheduled on return (a frozen still or
  paused frame is redrawn once so the addition shows). A page opened in
  a background tab is clock-honest too: the span from init to its first
  look is counted, and that first look is the arrival — the place is
  planted (or re-planted) at that minute and the opening belongs to it.
  CI greps enforce these absences.

## CSS

One file: style.v7.css. Plain CSS. Custom properties for theming.
All @font-face declarations (subsets + metric fallbacks) at top of file.
Clamp-based spacing for fluid layout across viewports.
WCAG AA contrast on all dimmed text over the night ground.
No keyframes, no transitions on text or links; the only transition is
the canvas opacity ease (1.6 s after a 0.2 s beat; none under
prefers-reduced-motion). :focus-visible is a 2px ochre outline, offset
3px, on every focusable.
The .ink-pause button reserves its layout slot from first paint
(visibility, not display) so revealing it can never shift layout.

## JS

Two files, one job each:

1. site.js — email obfuscation: HTML has href="#" id="email-link", JS
   assembles mailto from split parts at runtime so bots cannot scrape the
   address. A \<noscript\> fallback shows the email in HTML entities.
2. ink.v10.js — the ink garden (see above). Progressive enhancement: with
   JS off, the page is simply the typography on the night ground.

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

Single dark theme-color (#181410). The favicon is SVG-first
with PNG fallback.

## Caching

HTML: max-age=0, must-revalidate. Everything else: max-age=31536000,
immutable. Immutable means CHANGED BYTES NEED A NEW FILENAME: bump
style.vN.css → style.vN+1.css, ink.vN.js → ink.vN+1.js, .subN → .subN+1,
and update every reference in the same commit — five files, nine edit
points: index.html (stylesheet, script), 404.html (stylesheet),
\_headers (the style Link preload, the style cache block, the ink cache
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
ink.v10.js, plus style.v7.css for cursors — never to this prose) fails
on: arrows/cookie/analytics/Loading/navigation-role vocabulary in the
HTML; any exit, idle, hover-position, key, blur, title, favicon-swap or
sessionStorage handler in the JS; any clock or entropy read below
ink.v10.js's INIT-END marker, Math.random anywhere, or a `new Date`
count other than 1; any fill/arc call or globalAlpha literal above 0.85
in ink.v10.js; any URL hook (location.search/hash/href, URLSearchParams
— the seed is never in the URL) or sound (Audio, AudioContext, <audio>,
speechSynthesis) in the JS or HTML; and any `cursor:` rule in the
stylesheet (OS cursors only).
Trusted Types is NOT enabled, deliberately: Cloudflare Rocket Loader
rewrites the script tags and re-executes them through dynamic .src
assignment — a TT sink — so require-trusted-types-for 'script' kills
site.js AND ink.v10.js on every TT-enforcing browser (verified by
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
