# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.v9.css           All styles (versioned name — see Caching)
/site.js                Email obfuscation only
/birds.v3.js            The birds — a sky: flights crossing it in patterns (see Birds)
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

One non-scrolling viewport: the typography on a light ground, and a sky:
birds crossing the window in flights. The owner's briefs, verbatim:
first "copy exactly how they did the dots here on Samara.com/jobs.
Except instead of dots use birds and don't use dark background should be
light."; then, of Samara's dots drifting and bouncing inside the window:
"That's not at all how birds move tho. The page should be a sky so like
they're flying across/in patterns/etc. it should feel calm - not
bouncing off the walls." and, of the number of birds, "should b rand".

Light only (color-scheme: light). Tokens: bg #f9f8f1 (Samara's cream),
text #000 (19.7:1), dimmed #5f5c56 (6.3:1), focus #8a6417 (a dark
ochre, 5.0:1), selection ground #e6e2d6 under the black text (16.2:1).
Type is matte: no text-shadow, no glow. Links are plain underlined words
(1px, dimmed underline, .18em offset); nothing reacts to hover; OS
cursors only. The type is present at first paint in its final place.
Print hides the birds and the footer.

## Birds (birds.v3.js)

The page is a sky. Birds cross it the way birds cross a real sky, built
from field data (RESEARCH below) and nothing like v1/v2's dots, which
lived inside the window and turned back at its walls.

THE SKY: every flight enters from beyond one edge already flying and
leaves beyond the far edge, on one gentle lane (a cubic curve: slope at
most TILT 3.5°, a bow of at most 5% of the width, in toward the words and
on past them). Nothing starts, stops, loops, bounces or turns back in
view: motion onset and sudden reversals are what pull the eye off text
(Abrams & Christ 2003; Howard & Holcombe 2010). Samara's 1 s fade
(`appear`) softens each bird's entry at the edge. A lane is planned
whole before its first bird enters: the planner flies the flight forward
in thought (STEP 0.3 s) and every bird's ink box must stay WORDS 24 px
from the .stack box and LINKS 20 px from each footer link, EDGE 10 px
inside the edges the flight does not cross, and APART 48 px from every
other flight, for the whole crossing. The roomiest of TRIES (16) lanes
wins; level lanes are drawn (R2 low-discrepancy) only from the open
bands, the heights where the whole flight clears the words. Planning is
spread over frames (QUOTA 500 bird-steps a frame), so no frame is long.

THE PATTERNS (kinematic, never boids: a scripted leader track, every
other bird in a slot behind it, following the same track):
* skeins: a V, a J or an echelon (J's and echelons are the commoner in
  the wild), ARM_X 1.5–1.85 spans back and ARM_Y 0.85–1.05 aside per
  place; slots breathe along their arm (BREATH, x1.1 per place back);
  the wing-beat is spatially in phase, a bird beating where the one
  ahead beat (delay = lag / speed; Portugal 2014), long bursts with
  short glide spells passing back down the arms; one bird in three
  detuned; now and then a straggler catching up at +6–10%
* lines: single file (FILE 1.6–2.1 spans, a slight slant) through a slow
  wave in the track (WANDER/WAVE) that every bird flies through; birds in
  line beat half a beat apart, glide spells passing down the line
* pairs: the second 0.9–1.4 spans behind and 0.95–1.2 aside, now and then
  changing sides (SWAP_T 16–24 s)
* loose flocks and lone birds: flap-gliding (BURST 2–3 beats, glides
  1.2–2.6x as long), a lone bird sinking up to SINK 9 px on a glide and
  climbing back on its beats
* soaring kettles, on a sky at least SOAR_W 700 px wide and in a roomy
  field only (in a phone's band a circle looks trapped): a glide in, a
  thermal seen from below (a flattened ellipse SOAR_K 0.33–0.44 as tall
  as wide, LAP 15–21 s, 1–2 laps, drifting DRIFT 3–6 px/s downwind, one
  way round), and away one by one on the tangent, a little downhill;
  wings held open but for a few beats reaching and leaving the thermal
* how many (1–9 by COUNT: 3, 5 and 7 favoured; never a flight of four,
  and never four birds in the sky: feng shui), which pattern, which lane:
  all random, from the visit's weather. If the pattern does not fit, the
  same birds fly as a line, then fewer, then one, then (a strip of sky)
  one in still air. Measured: a 390x844 phone flies V's of up to 5–7 in
  the bands above the name and below the credit; 375x548 has room only
  for single birds above the footer; 320x480 has no open sky, no birds.

THE PACE (=calm): speed by crossing time, as a distant flight crosses a
real sky: a mid-depth flight crosses a 1440 px sky in CROSS 58–74 s,
scaled by (width / 1440)^0.5 (a phone's in ~35–40 s), nearer birds
drawn larger and flying faster (depth 0.82–1.15), within SPEED 9–28
px/s. The wing-beat follows the travel (STRIDE 2.3–2.9 spans a beat,
BEAT 0.25–0.5 Hz), so a slow bird beats slowly. Gusts (HEAVE, two slow
sines over 10–16 s) and the track's wander keep turns near 5°/s.

THE RHYTHM: at most FLIGHTS (2) at once, never two in one band (APART);
the first enters within about 1–2 s of load (FIRST, from beyond the
edge), the second once the first is past midway, then GAP 0.35–0.8 of a
crossing between flights; the season (70% of visits left to right, the
way the words read) sends 70–85% of flights that way, and a bird or pair
against it comes only into an empty sky; the sky thins over a long visit
(THIN: the gaps a crossing longer every 6 minutes, up to two).

THE HAND (what makes them alive — v1 dropped it and they read as frozen
icons):
* the tattoo glyphs (GLYPHS — the three stepped-zigzag marks are the
  alphabet, do not restyle them: no tilt, no rotation), 1.9 px round
  strokes at x1.2 and the flight's depth
* the BOIL: every vertex re-jittered BOIL_FPS (5) times a second by the
  visit's hand (1.2–1.6 px, x0.4 on a bird in flight)
* the stop-motion WING-BEAT: open (as drawn, and held so to glide) and
  half-folded toward the body line
* the drawing (tremor, wings, facing) changes only on the hand's frames;
  the position glides smoothly between them. A bird faces the way it
  flies (the glyphs face left; flying right mirrors them), with
  hysteresis, the flip landing on a hand frame.

THE WEATHER (=rand()): ONE crypto.getRandomValues at init, above the
INIT-END marker, and no clock read at all; splitmix32 streams from it:
one front and five facets (hand, tempo, breeze, pace, traffic: a still
visit is still everywhere), the season, and each flight's own stream.
Never Math.random (CI).

Twelve inline SVGs at the end of index.html are lent to flights (so at
most twelve birds at once), hidden until a flight shows them (no JS: no
birds); birds.v3.js sets each one's viewBox and polyline and moves it
with a CSSOM transform. It adds no DOM (CI greps
createElement/innerHTML/appendChild). pointer-events: none, so a link
under a bird still takes the click.

prefers-reduced-motion: a still sky, composed: one flight (a skein, a
pair or a lone bird) placed mid-lane in the roomiest open field, the
hand at rest, live both ways. forced-colors: CanvasText. A hidden tab
pauses with requestAnimationFrame; a step is capped at 50 ms. A resize
or rotation starts a new sky; a scroll or font swap re-checks every
flight, and a flight the words moved onto goes.

The birds fly for as long as the page is open. That is automatic motion
over five seconds beside content, which WCAG 2.2.2 (Level A) answers
with a pause control; the owner chose a sky without one.
prefers-reduced-motion is the only stop; the calm (slow crossings, empty
spells, a sky that thins) is mitigation, not conformance.

RESEARCH (primary sources read, 2026-09): Pennycuick 2001 and Alerstam
2007 (airspeeds, wing-beats, 1.8–3.7 spans a beat); Portugal 2014 and
Voelkl 2015 (ibis V's: statistical shapes, spatially in-phase flapping);
Hainsworth 1987/89 and Cutts & Speakman 1994 (geese: spacing, unlocked
wing-beats); Nagy 2010 and 2018, Weinzierl 2016, Akos 2008 (leadership
delays; storks in thermals: 13.6 s median lap, a kettle turns one way);
Abrams & Christ 2003, Howard & Holcombe 2010, Bartram 2003 (what motion
captures attention); the ink-painting tradition (few birds, one
direction, empty sky: liubai, ma).

VERIFY before changing the flight: a node simulator flies the real file
against a fake DOM with the real page layouts (12 viewports, rotations,
scrolls, reduced motion both ways) for simulated minutes and checks: ink
never within 12 px of the words (in practice 22 px or more), birds enter
and leave only across an edge (never popping in or out mid-sky), no
reversal and no turn over 25°/s outside a thermal, birds of a flight
never overlap, two flights never within 30 px, 9–30 px/s, the facing,
never four birds, the sky seldom empty, the first bird within a few
seconds, short frames; then a browser pass checks the same live.

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
2. birds.v3.js — the sky (see above). Progressive enhancement: with JS
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
birds.v3.js, plus style.v9.css for cursors — never to this prose) fails
on: arrows/cookie/analytics/Loading/navigation-role vocabulary in the
HTML; any exit, idle, hover-position, key, blur, title, favicon-swap or
storage handler in the JS; any DOM building in birds.v3.js; more or
fewer than one getRandomValues in it, or one below its INIT-END marker;
any Math.random or clock read (Date) in it; any URL hook
(location.search/hash/href, URLSearchParams) or sound (Audio,
AudioContext, <audio>, speechSynthesis) in the JS or HTML; and any
`cursor:` rule in the stylesheet (OS cursors only).
Trusted Types is NOT enabled, deliberately: Cloudflare Rocket Loader
rewrites the script tags and re-executes them through dynamic .src
assignment — a TT sink — so require-trusted-types-for 'script' kills
site.js AND birds.v3.js on every TT-enforcing browser (verified by
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
