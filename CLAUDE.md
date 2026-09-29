# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.v10.css          All styles (versioned name — see Caching)
/site.js                Email obfuscation only
/birds.v8.js            The birds — a sky in depth: every bird drawn afresh in the tattoo's hand, many kinds flying through it (see Birds)
/subset-fonts.sh        Regenerates the .sub2 font subsets (manual tooling)
/download-fonts.sh      Fetches the full source fonts (manual tooling)
/404.html               Custom 404 page
/assets/favicon.svg     Adaptive circle favicon (dark in light mode, inverse in dark)
/assets/favicon.png     PNG fallback favicon (32x32)
/assets/apple-touch-icon.png  180x180 iOS icon
/assets/fonts/          Self-hosted WOFF2: Geist and Geist Mono, full faces (sources)
                        + two .sub2 subsets (served), and OFL.txt (their licence)
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
The credit row is a mono caption (Geist Mono 400, .8125rem, dimmed) —
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
bouncing off the walls." and, of the number of birds, "should b rand";
then, of v3's slow, rigid rows: "Are you sure this is how birds movement
is flying?!"; then, of v4's flights of one identical mark: "Y they all
look same and move all the same? Did you even understand what we're
trying to do?"; then, of v5's pace (a phone's sky crossed in 10-17 s):
"Are you sure everything should be moving this fast tho?"; then, of v7's
flat sky, every lane drawn on the window's plane: "Y is the movement so 2D
though. Did you even research as comprehensively as possible? Test using
the most complex tools etc."

Light only (color-scheme: light). Tokens: bg #f9f8f1 (Samara's cream),
text #000 (19.7:1), dimmed #5f5c56 (6.3:1), focus #8a6417 (a dark
ochre, 5.0:1), selection ground #e6e2d6 under the black text (16.2:1).
Type is matte: no text-shadow, no glow. Links are plain underlined words
(1px, dimmed underline, .18em offset); nothing reacts to hover; OS
cursors only. The type is present at first paint in its final place.
Print hides the birds and the footer.

## Birds (birds.v8.js)

The page is a sky, seen in depth. Birds cross it the way birds cross a
real sky, built from field data (RESEARCH below) and nothing like v1/v2's
dots, which lived inside the window and turned back at its walls, v3's
slow rigid rows, which read as a dashed line, v4's flights of one
identical mark all moving alike ("Y they all look same and move all the
same?"), or v5-v7's flat sky, every lane drawn on the window's own plane
("Y is the movement so 2D though.").

THE SKY IN DEPTH (v8): the window is a camera looking out and up at the
sky (FOV 60 degrees across its longer side, pitched up so the horizon lies
HORIZON 0.08 of its height below its bottom edge), and every flight flies
a path in the air in front of it (x right, y up from the eye's level, z out
along the ground, in px at nearness 1); all that is seen is that air in
perspective (proj: nearness n = f / depth, px on the window a unit in the
air). The camera is aimed when a sky begins and held through small changes
of height (a phone's bar). A path is straight, or (TURNING 40%, gulls and
swallows x1.6 and x1.8) wheels through TURN 20-60 degrees over TURN_T 3-6
s near the middle of the crossing, climbing or sinking a little (its
kind's tilt); it heads across the window (HEAD 0-25 degrees off its plane,
55% of paths), angling away (25-60, 32%) or coming nearer (12-30, 13%),
never more than HEAD_MAX 72 off it, never turning back across it. Depth is
drawn, afresh on every drawing: a bird's size is its span at its nearness,
its pen (LINE) and its ink (TONE) follow; a flight going away shrinks,
slows on the window and sinks toward the horizon, and far off (nearness
FADE 0.54 down to FAR 0.42) fades into the air instead of popping out;
none comes nearer than NEAR_MAX 1.7 in view. A V lies level in the air
(UP_V 0.06 spans up or down), so its arms are nearer and farther:
foreshortened, the near arm larger and higher on the window; a pair flies
one nearer, one farther; a loose flock is a cloud (1.15 root-n spans
aside, 0.45 root-n up and down); a line undulates in the air (FILE_Y up, a
third of it aside). A turning bird banks: its inner wrist drawn lower and
its outer higher (BANK 0.3 at BANK_AT 40 degrees a second of turn on the
window), never a rotation. Storks circle a thermal: a ring in the air
(an ellipse seen from below, no longer drawn flat), drifting downwind and
climbing RISE 1.5-3 px/s, about half its radius a lap. A flight's pace
is its kind's, held (paced) where it passes nearest so it never rushes
across the window, never grows by more than GROW 1.2% of its size a
second (looming captures attention) nor shrinks by more than SHRINK 3%
(receding does not), never turns faster than TURN_SEEN 18 degrees a second
on the window (a turn seen heading away sweeps round), and never crawls
under SLOWEST 5 px/s; a path that would slow it below 0.45 of its pace is
not flown. What moves a bird in seconds (its drift, a gust, a glide's
sink) is gentled as far again, and as far as it is seen slower where it
heads away (q). Two birds of one flight are never closer than SPACE_SEEN 2
px on the window (a near one passing a far one) nor SPACE 4 px in the air.

THE DRAWING (every bird its own): the tattoo is the hand, not a stamp.
Traced from the photo, each of its three birds is an "M" gull stood on a
steep diagonal: from the back, a rise to the first wrist, a drop to the
body, a rise to the second wrist and a long stroke out in front (the
long-tailed one draws its back wing out as a tail); along the diagonal
the rises read as risers and the drops as treads: steps. drawBird draws
every bird afresh in that hand, in its kind's proportions (SORTS: rise,
drop, out, their angles, how often a tail), stood on its diagonal at
about its drops' angle (LEAN -14..+5 degrees: some read more as steps,
some more as gulls). As drawn a bird faces right, rising the way the
tattoo's birds do; flying left mirrors it; never rotated or tilted.
(v2-v4 drew a digitization of the three marks that was the photo upside
down.) Size and ink are distance: SPAN 22 px for a mid bird at nearness 1
on a large window (x0.72-1.12 by the window), each kind crossing at its own
nearness (SORTS depth, 0.6-1.3); a stroke of LINE 1.5-2.5 px by its size on
the window, ink TONE 0.62-1 by its nearness, times its fade (the polyline's
stroke-opacity; 1 under forced colors).

THE KINDS (SORTS, and which patterns each flies: SORT_OF): geese (skeins,
lines), ibis (lines, skeins), gulls (pairs, lone, lines), herons (lone:
near, large, legs trailing), crows (pairs, lone, loose), finches (loose,
pairs: small, bounding), swallows (loose, pairs, lone: tails, wheeling),
storks (soaring). Each has its size and distance, pace, wing-beat,
flapping and paths (tilt 3-8 degrees, wheel, wander). Most of the sky is
the big, slow-beating kinds: of the flights of three or more, skeins
55%, lines 25%, loose 20%; a lone bird is a gull, heron or crow 85% of
the time, a pair a gull, goose or crow 80%; the small quick finches and
swallows come now and then.

THE WINGS: through a beat the wrists swing down toward the bird's own
line and back up (WRIST 1.15 to 0.2: the steps always show, never a
slash), the downstroke the quicker (DOWN 45%), the body lifting BOB 0.04
span on it; a gliding bird holds its wrists at its own set, near the
drawing; a bounding finch folds its wings shut between bursts. By kind
(Pennycuick 2001): geese 2.3-2.7 Hz beating on and on; ibis 2.6-3 flap
and glide, the beat passing back down a line (WAVE_DELAY 0.35-0.8 s a
bird, never a whole number of beats) or, in a V, spatially in phase;
gulls 2.2-2.6, a few beats and long glides, sinking a little on each;
herons 1.9-2.2, slow and deep; crows 2.8-3.2, rowing; finches 5-6 in
short bursts, rising through the beats and falling wings-shut (bounding);
swallows 3.8-4.6 in flickers between glides; storks hold their wings out.
Birds beating each on their own have their rates spread evenly over the
whole of DETUNE (+-5%) and their starting points in the beat spread too,
each on its own schedule of bursts and glides, so a chance meeting in the
beat soon passes (a line keeps its shared wave).

THE PACE (calm): each kind's pace in the wild is in spans a second
(geese 2.4-2.8, gulls 1.9-2.3, herons 1.8-2.1, crows 2.7-3.1, finches
3.2-3.8, swallows 3-3.6), and the page slows every kind alike to its
calm (CALM: a mid bird, REF, crosses the window in about 22 s on a phone
to 52 s at 1440 px and up), so each keeps its place in the order and
nearer, larger birds still fly faster; a soft ceiling (from KNEE 0.75 of
it) keeps any bird from crossing quicker than CROSS 15-36 s, within
SPEED 14-64 px/s where it crosses; then each path holds it as above.
Measured on the window (median, and 2-98%): a phone's birds 16-18 px/s
(10-25), a 1024 px window's 21-25 (9-34), a 1440 px one's 24-25 (15-36);
v7's crossed a 1440 px sky in 52 s. The wings keep their real rates,
never slow motion: the slower pace comes from gliding. A kind that beats
on and on glides between bursts (FLAPS_SLOW), and every kind's glides are
the longer by the root of how far it is slowed (up to HOLD 2.2; not a
finch's bound), so a bird beats a little over half the time. The calm
comes from glides, few birds and empty sky, never from slow wings.

THE PATTERNS (kinematic, never boids: a scripted leader path, every other
bird in a place behind it in the air, following the same path): skeins (a
V, a J or an echelon: ARM_X 1.5-1.9 spans back and ARM_Y 0.9-1.1 aside per
place, JITTER 30%, the arms unequal), lines (FILE 1.6-2.2 spans, uneven,
undulating FILE_Y), pairs (now and then changing sides, SWAP_T 16-24 s),
loose flocks, lone birds, and soaring kettles on a sky at least SOAR_W 700
px wide in a roomy field (LAP 15-21 s, 1-2 laps, drifting WIND 3-6 px/s,
one way round; away one by one on the tangent). Every bird drifts about
its place on its own (DRIFT_L 0.08-0.18 spans along, DRIFT_P 0.15-0.3
aside and up and down, over DRIFT_T 3-6.5 s). Events, on the flight's own
clock from ev0 (a little after its leader comes into view): now and then
(GATHER 40% of skeins and lines) a skein crosses as a ragged file (FILE_G
2-2.4 spans) that fans out into its V, sideways first and then closing
up, the front birds first (GATHER_AT 0.4-0.9 s apart, GATHER_T 6-10 s
each), and a line as a bunch that strings out into single file; or
(LOOSEN 15%) the reverse, a V stringing out into a file; a straggler
catching up (+6-10%); a pair changing sides. Spacing is checked through
every event (fitsAll: every pair, every 0.5 s of it); a gathering that
cannot keep its birds apart does not happen. How many (1-9 by COUNT: 3, 5
and 7 favoured; never a flight of four, and no group of the flights in
the sky ever four birds, so none can leave four behind), which kind,
which pattern, which path: all random, from the visit's weather. If the
pattern does not fit, a flatter V, a smaller one, the same birds as a
line, fewer, one, then (a strip of sky) one in still air.

THE SKY: every flight enters from beyond an edge already flying, or out of
the distance, and leaves beyond an edge, below the window's sill or into
the distance, on one path; now and then (22%) a gull, crow or swallow
alone or in a pair climbs away or comes down (CLIMB 10-20 degrees) on a
sky 700 px or wider. Nothing starts, stops, loops, bounces or turns back
in view: motion onset and sudden reversals are what pull the eye off text
(Abrams & Christ 2003; Howard & Holcombe 2010). Samara's 1 s fade
(`appear`) softens each bird's entry at the edge. A path is planned whole
before its first bird enters: the planner flies the flight forward in
thought (STEP 0.3 s) and every bird's ink box at its nearness (with room
for its bob) must stay WORDS 24 px from the .stack box and LINKS 20 px
from each footer link, EDGE 10 px inside the edges the flight does not
cross, and APART 48 px from every other flight, for the whole crossing;
and one flight to a band (BAND_GAP 24 px between the heights two flights
keep), unless the words stand between them wherever they share heights.
The roomiest of TRIES (16) paths wins; its point in the window is drawn
(R2 low-discrepancy) from the open sky, a level crossing's from the open
bands. On a sky with no open band (a phone turned sideways: the words
stand across it) the planner tries paths in the open sky beside them:
angling away into the distance, coming nearer, and steeper paths across
the window (DIAG 20-60 degrees on the window, solved for their heading
and climb, never over 45 degrees of climb, going away or coming nearer at
up to DIAG_N 0.85 of SHRINK or GROW). Planning is spread over frames
(QUOTA 500 bird-steps a frame, the working-out of each path counted), so
no frame is long.

THE RHYTHM: at most FLIGHTS 2 at once (3 on a sky WIDE 900 px or wider),
never two in one band (but for the words between them); the first enters
within about 1-2 s of load (FIRST, from beyond the edge; on a small sky
three birds at most), the second a few seconds after it (12-25% of the
first's crossing), then GAP 0.3-0.7 of a crossing between flights; with
no room (the bands taken) the sky looks again in RETRY 3-6 s; the season
(65% of visits left to right, the way the words read) sends 65-80% of
flights that way, and any flight may go the other; the sky thins over a
long visit (THIN: the gaps a crossing longer every 6 minutes, up to two).

THE HAND (what makes them alive; v1 dropped it and they read as frozen
icons): the round-capped stroke; the BOIL, every vertex re-jittered
BOIL_FPS (6) times a second by the visit's hand (1.2-1.6 px, x0.4 on a
bird in flight); the drawing (wings, bank, bob, tremor, facing, and the
size, pen and ink of its distance) changes only on the hand's frames
(DRAW_FPS 12, on twos) while the bird glides smoothly between them; a
bird faces the way it flies, with hysteresis, the flip landing on a hand
frame.

THE WEATHER (=rand()): ONE crypto.getRandomValues at init, above the
INIT-END marker, and no clock read at all; splitmix32 streams from it:
one front and five facets (hand, tempo, breeze, pace, traffic: a still
visit is still everywhere), the season, and each flight's own stream
(its kind, its birds and their drawings). Never Math.random (CI).

Twelve inline SVGs at the end of index.html are lent to flights (so at
most twelve birds at once), hidden until a flight shows them (no JS: no
birds); birds.v8.js sets each one's viewBox and size (room for the bird
at its nearest), polyline, stroke width and stroke opacity (attributes,
the last two only when they change), and moves it with a CSSOM
transform. It adds no DOM (CI greps createElement/innerHTML/appendChild).
pointer-events: none, so a link under a bird still takes the click.

prefers-reduced-motion: a still sky, a photograph: one flight (two on a
sky 900 px or wider; a skein, a pair or a lone bird) placed mid-path in
the roomiest open field, every bird caught at its own point in the beat,
the hand at rest, live both ways. forced-colors: CanvasText, full ink. A
hidden tab pauses with requestAnimationFrame; a step is capped at 50 ms.
A resize or rotation starts a new sky (and aims the camera anew). A
scroll, a font swap or a small change of height (on a phone, the
browser's bar coming and going, as it does while the page loads)
re-checks every flight, holding it to half its margin: a flight the words
moved onto goes, and its place is not kept waiting. Into a sky left empty
the next flight comes as the first did, within a second or two (v5 held
it back as if the lost flight were still crossing: on an iPhone the sky
stayed empty for ten seconds and more).

The birds fly for as long as the page is open. That is automatic motion
over five seconds beside content, which WCAG 2.2.2 (Level A) answers
with a pause control; the owner chose a sky without one.
prefers-reduced-motion is the only stop; the calm (glides, empty
spells, a sky that thins) is mitigation, not conformance.

RESEARCH (primary sources read, 2026-09): Pennycuick 2001 and Alerstam
2007 (airspeeds; wing-beat rates by species: gulls 2.9-3.3 Hz, crows
3.8, herons 2.9; 2-3.5 spans a beat); Taylor 2019, Usherwood 2016,
Tobalske 2003, Taylor, Nudds & Thomas 2003 (beat rate nearly fixed per
species; flap and glide; the body's rise and fall; the stroke); Portugal
2014 and Voelkl 2015 (ibis V's: blurred, birds swapping places,
spatially in-phase flapping); Hainsworth 1987-89, Speakman & Banks 1998,
Cutts & Speakman 1994, Newbolt 2024 (geese, cranes and pelicans: uneven
spacing, unlocked wing-beats, no fixed order in lines); Nagy 2010 and
2018, Weinzierl 2016, Akos 2008 (storks in thermals: 13.6 s median lap,
one way round, climbing as they circle); Whitaker & Halas, Preston Blair,
Muybridge (animation: 4-8 drawings a beat, a pose held over ~0.15 s reads
as posing; M, flat, W); Reynolds 1987 and the animators' "twinning"
(identical, in-step motion looks mechanical); Abrams & Christ 2003,
Howard & Holcombe 2010, Bartram 2003 (what motion captures attention);
and for depth (v8): Wallach & O'Connell 1953 (the kinetic depth effect:
shape and depth read from a changing projection), Cutting & Vishton 1995
(which cues give depth at a distance: relative size, height toward the
horizon, motion perspective; occlusion, which the birds never use, as
they never overlap), Franconeri & Simons 2003 (looming captures
attention, receding does not: approaches rare, slow, GROW well under
SHRINK); the ink-painting tradition (few birds, empty sky: liubai, ma).

VERIFY before changing the flight: a node simulator flies the real file
against a fake DOM with the real page layouts (12 viewports, rotations,
scrolls, a phone's browser bar changing the height at load, reduced
motion both ways) for 10 simulated minutes a run and checks: ink never
within 12 px of the words (in practice 21 px or more), birds enter and
leave only across an edge or out of and into the distance (never popping
in or out mid-sky), no reversal and no turn over 25 degrees a second
outside a thermal or a finch's bounding (the path measured without the
bob), birds of a flight never overlapping (through their events), two
flights never within 30 px and never in one band (but for the words
between them), birds beating their wings most of the time and a flock
never in lockstep, the facing, no four birds, at most 2 flights (3 on a
wide sky), the sky seldom empty, the first bird within a few seconds
(within 3 s after the bar at load), short frames. The projection is
checked against three.js's own PerspectiveCamera (every bird's position
in the air re-projected, thermals too: 147,000 positions, worst error
1e-12 px); the depth is measured from the drawn marks alone (size and
speed over a crossing, paths toward the horizon; v7 against v8) and, on
frames rendered in Chromium with the page's clock stepped exactly
(Playwright's fake clock), by OpenCV's dense optical flow (Farneback);
then a browser pass checks the same live (in WebKit, Safari's engine,
too, with the window's height changed as the page loads), and film
strips, time-lapses and whole-page sheets across seeds are looked at by
eye.

## CSS

One file: style.v10.css. Plain CSS. Custom properties for theming.
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
2. birds.v8.js — the sky (see above). Progressive enhancement: with JS
   off, the page is simply the typography on the light ground.

## Type

Two families, three roles. The owner asked for a grotesk and a mono
(Diatype, Neue Haas Grotesk, Monument Grotesk Mono named); Geist and
Geist Mono (Vercel with basement.studio, SIL Open Font License 1.1) are
the free, licensed stand-ins, until a web licence for the Dinamo faces
is bought:

* the name (h1): Geist 500, clamp(2.75rem, 1.9rem + 4vw, 4.75rem), line
  height 1, tracked in -0.045em
* the words (the bio, the links, every paragraph to come): Geist 400,
  1.0625rem, line height 1.55, -0.006em, a 22.5em measure; the bio's
  first sentence 500 in full black, the rest dimmed
* the facts (the credit row; to come: dates, roles, labels, captions,
  code): Geist Mono 400, .8125rem, dimmed; no uppercase, no tracking

As the site grows, new pages reuse these roles and nothing else: two
weights only (400, 500), emphasis made by black against the dimmed
grey rather than by weight; a handful of sizes on the same clamp()s;
long reading at about 65 characters a line. A serif may come back for
long-form writing only, never for the name or the page's frame.

Fonts must be licensed for the web: open-licensed (OFL, like Geist) or
a bought web licence. Never unlicensed copies, and never a desktop
font file: its own terms forbid what a site does to it (Dinamo's:
no modifying, no storing on publicly available servers). To move to
Diatype and Monument Grotesk Mono once licensed: swap the two
@font-face sources, recompute the fallbacks (below), keep the roles.

## Fonts + performance

Served fonts are ASCII subsets (.sub2: Latin basic, · – — ‘ ’ “ ” …).
./download-fonts.sh fetches the sources from Vercel's own geist package
(pinned); ./subset-fonts.sh cuts the subsets. Geist is one variable file
cut to the two weights the site sets, wght 400-500 (10.9 KB, smaller
than a single static weight); Geist Mono Regular is 9.3 KB: 20 KB of
fonts in all (Newsreader and DM Sans were 32 KB). The subsets keep the
copyright and the OFL notice in their name tables (IDs 0, 13, 14), and
assets/fonts/OFL.txt ships beside them. The home page uses no glyph
outside the subsets; do not add glyphs. font-display: optional + the
metric-matched fallbacks give CLS = 0 by construction: 'Geist Fallback'
(Arial) and 'Geist Fallback Android' (Roboto), 400 and 500 apart, their
size-adjust the page's own text set in Geist over the same text in the
system face and their ascent and descent Geist's (1.005, 0.295) over
it; 'Geist Mono Fallback' (Menlo, Courier New) by the advance, 0.6 em.
Checked: with Arial's metric twin standing in, the fallback wraps the
bio in the same lines as Geist, the name within 1%. Both subsets are
preloaded in index.html and Early-Hinted via Link headers on / in
\_headers. Never preload a font no rule uses (Chrome warns, and every
first visit pays for it).

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
birds.v8.js, plus style.v10.css for cursors — never to this prose) fails
on: arrows/cookie/analytics/Loading/navigation-role vocabulary in the
HTML; any exit, idle, hover-position, key, blur, title, favicon-swap or
storage handler in the JS; any DOM building in birds.v8.js; more or
fewer than one getRandomValues in it, or one below its INIT-END marker;
any Math.random or clock read (Date) in it; any URL hook
(location.search/hash/href, URLSearchParams) or sound (Audio,
AudioContext, <audio>, speechSynthesis) in the JS or HTML; and any
`cursor:` rule in the stylesheet (OS cursors only).
Trusted Types is NOT enabled, deliberately: Cloudflare Rocket Loader
rewrites the script tags and re-executes them through dynamic .src
assignment — a TT sink — so require-trusted-types-for 'script' kills
site.js AND birds.v8.js on every TT-enforcing browser (verified by
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
