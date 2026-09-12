# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.v8.css           All styles (versioned name — see Caching)
/site.js                Email obfuscation only
/ink.v13.js              The ink garden — the 2D canvas scene (see Ink garden)
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
"LinkedIn" (no arrows). There is no pause control and none is needed:
nothing on the page moves by itself for longer than five seconds (see
WHY THERE IS NO PAUSE CONTROL below). Nothing on the page names, shows
or hints at the visit's weather (see THE WEATHER below), and nothing
hints that the garden answers touch.

## Design

One immersive, non-scrolling viewport: typography over "the ink garden" —
a full-viewport 2D-canvas scene of hand-drawn generative ink, at night —
a still drawing that answers touch.
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
ink.v13.js: line #d8d2c4, dim #8f887b, ochre #c79a3d, vermillion #d05a40,
sage #8fa284, slate #8b9cbd (vermillion on ground is the lowest pair,
4.5:1 — do not darken the ground or dim the inks without re-checking).
Links are plain underlined words (1px, dimmed underline, .18em offset);
nothing reacts to hover; OS cursors only (never cursor:none, never a
custom cursor).
Text contrast comes from composition, not a scrim: the garden is sparse
line-work and every element is anchored OUTSIDE the measured .stack and
footer boxes (measureAnchors in ink.v13.js). Keep it that way — nothing
may draw under the typography. One sanctioned exception, glyph-safe by
measurement: in hang mode the falling seed slips down the right MARGIN
beside the text (strictly right of the measured stack box).
Click-planted sprigs are scale-clamped near the boxes so their canopies
cannot reach the glyphs either.
The canvas is z-index -1 and pointer-events none, so text and links are
always on top and always clickable (taps reach the document, which is
where the garden listens). No entrance for the type: it is present at
first paint in its final place; the garden draws itself in on the
canvas over the 4 s opening (no CSS fade, nothing under
prefers-reduced-motion). forced-colors hides the canvas, and ink.v13.js
treats it like reduced motion (a still frame, no opening, no answers).
Print styles hide the scene and footer.

## Ink garden (ink.v13.js)

A hand-drawn day, clocked from local midnight. One 2D canvas, no
libraries, no network. A STILL DRAWING THAT ANSWERS TOUCH: nothing on
the page moves by itself except the 4 s opening.

THE PLACE is date-seeded (xmur3 day-string seed + splitmix32 streams)
and grows with the day — logistically (smootherstep on the day
fraction): sparse at dawn, in full bloom by evening, held through the
small hours (00:00–05:00 keep the evening's fullness and the full
meadow) until dawn clears it — the same garden for every visitor all
day. The mathematics is folded into the forms, never depicted as
apparatus:

* Branch sprigs draw themselves in generation by generation (GROW_S
  0.62 s per generation); children take symmetric ±slots (fair coins),
  so canopies settle toward balanced binomial silhouettes. Blossom inks
  come from a day-seeded Polya urn — colors reinforce themselves, so
  each day leans warm or green from the same six inks.
* THE MEADOW: a day of seed landings (one kept per ~8 min of daylight
  after 06:30, the full stand through the small hours, replayed
  deterministically from the DAY stream at init) under the anchor
  sprig (sprigs[0]) — each landing the end of a coin-flip walk down
  26 px air-rows mean-reverting to its release column (a discrete
  Ornstein-Uhlenbeck walk) — grows a stand of grass whose silhouette
  settles toward the binomial bell: de Moivre-Laplace, drawn as meadow.
  Repeat landings in a 6 px cell thicken the tuft UPWARD (taller
  blades), never denser sideways; past the caps (96 blades, 7 per
  cell) the meadow rests. Blades are single curved strokes with air
  between them — the meadow must never read as texture.

THE OPENING (the one automatic motion, once per load, OPEN_S 4 s): the
garden is ALREADY THERE as the door opens — drawn, still, the day's —
except the youngest sprig, which is finishing its last generation (born
YOUNG_BORN = −genStart(4), derived from GROW_S and GEN0 rather than
written as a number, so the two stay in step: that generation draws
over 0–2.6 s and its tips blossom at 3.64 s, inside OPEN_S — growth in
progress, never an event). Nothing else is
underway: no skein, no seed, no blade sweeping in. At 4 s the garden
SETTLES: one resting frame is drawn in the DAY's hand (jitter 1.6,
offset 0, no wind), identical to the reduced-motion still frame, pixel
for pixel, until a visit adds to it. No loop runs at rest: zero motion,
zero CPU. A resize re-plants the place already grown (it never
re-opens); a returning tab never re-opens.

TOUCH is the only weather after that, and AN ANSWER TAKES AS LONG AS IT
TAKES — the five-second rule covers automatic motion only, so nothing
a visitor started is ever hurried to beat a clock. While awake the
garden runs at 5 fps: the boil IS the frame rate, so everything moves
in stop-motion, the way a flip-book does. Where the tap lands decides
the answer (in this order):

* On a tree (a sprig's measured box, +6 px): it RINGS slowly (0.9 Hz,
  3 px at the tips, gone by ~5 s) and 2–4 seeds (seedsPerShake, the
  visit's tempo) let go of its tips about a second apart and flutter
  down in the coin-flip walk at DROP_V 82 px/s; a blade takes root
  where each lands, so the stand
  under every shaken tree settles toward its own bell. Seeds let go
  ONLY from tips whose fall stays clear of the words: tips below the
  text (stackBottom + 12) for standing sprigs, lane-side tips
  (x >= stackRight + 6) for sprigs hanging in hang mode; a sprig
  hanging in the sky of beds mode releases nothing (it only shakes).
  The aim column is the sprig's own trunk, kept 30 px inside the
  meadow's bounds; landings clamp into [lo, hi] (beds: from the
  footer words' right edge + 30 to W − 22; hang: from max(18, 0.3 W)
  to W − 22).
* On the meadow (within 30 px of the strip, inside its bounds): a
  GUST rolls out from the touch both ways at GUST_V 55 px/s, passes
  each point in 3.5 s and dies out by 900 px (about 20 s in all):
  grass leans blade by blade as it passes (1.3 px ceiling), canopies
  shear (2.4 px, scaled by distance from the root), falling seeds
  drift (2 px), birds bob (2.5 px) — one motion, many small marks. Its
  strength is the visit's breeze; its lean is the visit's direction.
* On the sky (the band the birds actually fly in, padded 24 px so a
  thumb finds it; checked BEFORE the meadow, since on a short phone the
  two nearly touch and the birds are the answer that is hard to find):
  a SKEIN MEANDERS across at FLY_V 12 px/s, its lead bird starting
  SKEIN_EDGE 10 px outside the frame so it is VISIBLE within a second
  of the tap, the crossing bounded by SKEIN_MAX 80 s so a wide screen
  glides a little faster instead of running for minutes — birds in the
  stepped-zigzag stroke of Derek's tattoo (GLYPHS — the three
  marks are the alphabet, do not restyle them): membership a coin-flip
  sum of 2..6 (a busy visit's sky leans one larger), a loner 15 %, a
  great skein of 7..8 7 %, the long-tailed glyph often leading, a
  straggler sometimes trailing; the lead's two-sine undulation echoed
  down the line lagged by each bird's distance back over the glide
  speed; stop-motion wing-beats detuned per bird (0.68–0.95 Hz);
  altitude drifting between two levels (an S-curve), the entry level a
  golden-ratio Kronecker sequence, direction a Markov flip (72 %
  alternate). One crossing at a time: a sky tap during one only stirs
  a gust. THE BAND is whichever of the two clear strips is better: the
  sky above the name when nothing hangs in it and it is at least 24 px
  tall (desktops, and phones whose sprigs stand on the strip), else the
  open zone between the text and the meadow (phones whose garden hangs
  from the top edge). A band that does not exist is a tap that does
  nothing, so the margins are thin — 10 px, and a 25 px strip still
  carries a 14 px bird.
* On open ground (anywhere else that is not the words or the footer's
  words): a seed is pressed into it and a SPRIG draws itself in there
  generation by generation: the first shoot quickly (GEN0, 0.35 × GROW_S
  = 0.9 s, so the tap shows something at once) and then 2.6 s a
  generation, blossoms included, SPRIG_S ≈ 13.9 s in all (250 ms
  debounce, 14-sprig cap that evicts the oldest
  PLANTED sprig and never a day sprig, 60 px root spacing, scaled to
  the clearance near the measured boxes so its canopy can never reach
  the glyphs; upward below 40 % of the height, hanging above it).

Every tap also sends a small gust (0.35 of a meadow gust), including a
tap with no other answer (too near the words to plant, too near another
root) — a tap is never simply swallowed. While awake a faint breath
(0.15, 0.03 Hz) sways everything; at rest the wind is zero.

THE GUARDS are deliberately two different sizes. A tap ON the words is
for reading and selecting, so the stack box + 6 px and the footer's
links + 12 px answer nothing at all. CLEARANCE from the glyphs is a
PLANTING concern only, and plantAt() enforces it alone (the ±110 px
window and the vGap scale clamp). Do not widen the first guard into the
second: a 40 px halo below the text is the whole width of a phone, and
it silently swallowed every skein tap until it was found by probing.
In rest mode taps do nothing.

WHY THERE IS NO PAUSE CONTROL: WCAG 2.2.2 requires one only for
motion that (1) starts AUTOMATICALLY, (2) lasts longer than five
seconds and (3) sits beside other content. Only the opening starts by
itself, and it is over within 4 s of the first frame; nothing else is
ever scheduled. Everything else is started by the visitor, which the
criterion does not cover at all, so an answer is free to take its own
slow time and does (a skein crossing runs for minutes). THE RULE TO
KEEP is therefore narrow: the OPENING stays under five seconds and
NOTHING else is automatic. It is not a licence to speed anything up —
an earlier version capped every answer at 4.5 s and had to rush the
birds to 400 px/s, which destroyed the calm the page exists for. Under
prefers-reduced-motion nothing animates at all (no opening, no
answers) and a tap on open ground plants a finished sprig.

THE WEATHER (=rand()): the day seed owns the PLACE — the sprigs, the
urn, the meadow replay, the planted-sprig stream, the resting frame.
A VISIT seed — one crypto draw at init (Uint32, with a
performance.now fallback), never stored, never shown, never in the
URL, never reseeded by a tap, a resize or a returning tab — owns HOW
the garden answers, never whether: one coherent front and four facets
in the fixed order breeze, traffic, tempo, hand (`front = (u1+u2)/2`,
`facet = 0.7*front + 0.3*u`): breeze = (0.2 + 0.8*f) (×0.85 in the
quiet hours 23:00–05:00; ∈ [0.17, 1.0]) is the gust's strength;
traffic > 0.6 lets a skein run one bird larger half the time; tempo
sets seedsPerShake (2 below 0.45, 3 to 0.8, 4 above); hand sets the
boil jitter 1.2–1.6 px while awake (with a per-visit noise offset;
the polylines, colours and alphas are the day's); plus the wind's
lean (±1) and breath phase. The roster probabilities, the 1.6 px
jitter ceiling, and every envelope cap are NOT weather. Stream map —
DAY (stream): 1 noise table, 2 day sprigs, 3 planted sprigs, 6 meadow
replay, 8 urn. VISIT (vstream): 6 seeds let go, 9 skein, 11 weather
record, 12 wind, 15 hand.

LAYOUT MODES (gardenMode in measureAnchors — chosen from measured room,
never from width alone): "beds" when the bottom band below the text fits
standing trees (scale capped by bedCap so canopies stay below the
text); "hang" when only the sky above the name fits (the garden hangs
from the top edge, the seed slips down the measured right margin
beside the text before spreading into the open zone below it, landing
in a meadow strip floating above the footer; the sky band is that
open zone). On phones (under 700 px) hang mode also uses the strip:
when the band above the footer fits standing trees (standCap =
(footerTop − 30 − stackBottom − 22)/210 >= 0.32) companions stand on
the strip — both fit: a coin decides per sprig; only the strip fits:
the anchor stands there too; no tree fits at all but the band between
the text and the footer is >= 60 px: nothing is planted and the day's
seeds are replayed from beyond the top edge (borrowed scenery) into
the strip. "rest" when nothing fits (short landscape viewports): no
sprigs, no meadow, no skein — nothing is drawn, no loop ever runs,
taps do nothing; the typography carries the page. Under 700 px the
mode is hang (or rest when neither the sky, the strip nor a 60 px
band fits).

The calm envelope (header comment of ink.v13.js mirrors this; any
change must keep all of it true):

* At rest: zero motion, zero CPU — no loop runs; the resting frame is
  drawn in the day's hand (jitter 1.6, offset 0): the day's garden plus
  this visit's landings and planted sprigs — nothing else of the visit.
* Awake: 5 fps (FPS), and the boil re-rolls at its own 5 Hz (BOIL_FPS)
  — two constants, never one, so raising the frame rate can never speed
  up the hand. Nothing is smooth; everything is stop-motion. Jitter
  <= 1.6 px (1.2–1.6 per visit), and 0.4 of that on a flying bird,
  whose mark is small and moving and would otherwise shiver more than
  it glides. An answer runs until it is genuinely finished.
* Every answer must SHOW something within about a second of the tap.
  An answer nobody can see is the same as no answer: verify with
  zones.js, which taps down a column at every common phone size and
  reports what each tap produced.
* The opening is the ONE automatic waking: 4 s (OPEN_S), once per
  load, never on a resize or a returning tab. Nothing else is ever
  scheduled.
* Gusts: 55 px/s from the touch, 3.5 s passage, dead by 900 px
  (GUST_LIFE — the one lifetime pruneGusts and every wake use). They
  SUM, so the field is clamped to ±1 and at most GUST_MAX 24 are kept:
  the gains are then true ceilings however fast a visitor taps — grass
  1.3 px, canopy 2.4 px (scaled by distance from the root), seed drift
  2 px, bird bob 2.5 px; breath 0.15 while awake; a shaken tree rings
  0.9 Hz, 3 px, gone by ~5 s.
* Seeds fall at 82 px/s (DROP_V); a branch generation draws in 2.6 s
  (GROW_S), the first shoot in 0.35 of that (GEN0); a skein glides at
  12 px/s (FLY_V), a crossing capped at 80 s (SKEIN_MAX). These are the
  page's calm speeds: nothing may be sped up to fit a clock.
* Strokes only — never clustered dots (hard rule; dot clusters read as
  trypophobia triggers). No fills, no arcs.
* Ink alphas <= 0.85; night ground #181410; palette fixed to the six
  inks.
* prefers-reduced-motion / forced-colors: the DAY's garden as one
  still frame, no opening, no answers but a finished sprig on open
  ground; live listener both directions (a change while awake settles
  the garden at once).
* JS off / canvas failure: typography on the night ground, nothing
  lost.
* No ink under the measured typography or footer boxes; taps there do
  nothing; seeds let go only where the fall stays clear; planted
  sprigs keep 60 px root spacing; when a viewport has no room the
  garden rests (see LAYOUT MODES above).
* Every visit-owned facet lives inside an audited range: nothing the
  visit seed does can move ink into the measured boxes, exceed a
  ceiling, or change the palette — verify with comp-audit.js and
  touch-test.js before touching any of them.
* ONE clock read and ONE entropy read, both at init above the INIT-END
  marker in ink.v13.js; no Math.random anywhere, no Date.now, nothing
  below the marker reads the wall clock or entropy (performance.now
  deltas only). The PLACE is date-seeded, the WEATHER is visit-seeded.
  Zero network. One 2D canvas; while awake, one rAF loop scheduled by
  setTimeout at 5 fps, cancelled the moment the garden settles.
* Layout is measured from the real DOM (measureAnchors) and rebuilt on
  resize (a resize re-plants the place already grown; it never rerolls
  the weather and never re-opens).
* Idle is not a state; nothing reacts to leaving; no listeners for the
  pointer's position, keys, focus loss or page teardown (pagehide
  settles the garden, so bfcache can never restore a skein parked
  mid-sky — it stays bfcache-friendly); document.title and the
  favicon never change; NO state is persisted. A hidden tab settles
  the garden at once. A return after >= 480 s hidden adds only static
  day-replay blades (<= 12, continuing the DAY stream where the init
  replay stopped) and at most one fully grown day sprig — what a fresh
  visitor at that minute would see; nothing animates on return. A page
  opened in a background tab opens its door at the first look (the
  boot frame cannot run while hidden), with the day's clock told how
  long it waited. CI greps enforce these absences.

## CSS

One file: style.v8.css. Plain CSS. Custom properties for theming.
All @font-face declarations (subsets + metric fallbacks) at top of file.
Clamp-based spacing for fluid layout across viewports.
WCAG AA contrast on all dimmed text over the night ground.
No keyframes, no transitions anywhere (the canvas has no fade: the
garden draws itself in). :focus-visible is a 2px ochre outline, offset
3px, on every focusable. body sets touch-action: manipulation so a tap
answers at once (no double-tap-zoom delay); nothing else about touch
is special.

## JS

Two files, one job each:

1. site.js — email obfuscation: HTML has href="#" id="email-link", JS
   assembles mailto from split parts at runtime so bots cannot scrape the
   address. A \<noscript\> fallback shows the email in HTML entities.
2. ink.v13.js — the ink garden (see above): the opening, then a still
   drawing that answers taps. Progressive enhancement: with JS off, the
   page is simply the typography on the night ground.

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
ink.v13.js, plus style.v8.css for cursors — never to this prose) fails
on: arrows/cookie/analytics/Loading/navigation-role vocabulary in the
HTML; any exit, idle, hover-position, key, blur, title, favicon-swap or
sessionStorage handler in the JS; any clock or entropy read below
ink.v13.js's INIT-END marker, Math.random anywhere, or a `new Date`
count other than 1; any fill/arc call or globalAlpha literal above 0.85
in ink.v13.js; any URL hook (location.search/hash/href, URLSearchParams
— the seed is never in the URL) or sound (Audio, AudioContext, <audio>,
speechSynthesis) in the JS or HTML; and any `cursor:` rule in the
stylesheet (OS cursors only).
Trusted Types is NOT enabled, deliberately: Cloudflare Rocket Loader
rewrites the script tags and re-executes them through dynamic .src
assignment — a TT sink — so require-trusted-types-for 'script' kills
site.js AND ink.v13.js on every TT-enforcing browser (verified by
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
