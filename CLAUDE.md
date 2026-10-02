# derekzhou.com

Personal site for Derek Zhou. Pure HTML, CSS, JS. No frameworks. No build step.

## Structure

/index.html             Home page
/style.v11.css          All styles (versioned name — see Caching), the still sky of each hour
/site.js                Email obfuscation only
/hour.v1.js             The hour: which time of day the sky opens on (the page's one clock read)
/sky.v2.js              The sky — light and cloud behind the page: thirteen skies in a random order (see Sky)
/birds.v9.js            The birds — a sky in depth: every bird drawn afresh in the tattoo's hand, many kinds flying through it (see Birds)
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
/\_redirects             HTTPS enforcement; /CLAUDE.md and /.github/* redirected to / (exact paths: see Security)
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

One non-scrolling viewport: the typography on a sky, birds crossing it in
flights, light and cloud behind. The owner's briefs, verbatim:
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
the most complex tools etc."; then, of the background, paraphrased (the
reference is a game the owner named; at the owner's word its name stays
out of the repo, its commits and its PRs): make the background as like
that game's luminous sky and cloud as it can be made, from the most
comprehensive research and plan; and, choosing among the plan's options,
every time of day in turn, the opening one by the visitor's own clock
("All. Cycle through. The scene that users starts on depends on their
system time"), the sky behind the words too ("Full sky."), and as close
to the reference as possible ("You can do it - no shortcuts!"). So the
first brief's light ground gives way, at the owner's choice, to a sky
that is dark at dusk and at night. Then, asked to use Unreal Engine and
to go further on every level (environment design, light and colour from
the micro to the macro, a feng shui feel, sound and music, a tool to rig
and tune the environment), and shown the research's answer (the page
cannot run Unreal: no web export; streaming costs a GPU server per
visitor and fails in iOS in-app browsers), the owner chose no Unreal, an
opt-in generative score, and a studio on the site behind Cloudflare
Access (Sysco Trace behind Access too); and, of the plan's flat palette
strips: "All those mocks look so plain wtf. It should be a lot more
complex than a palette lol." with the reference's own creative techniques
(paraphrased: its name stays out), and "Only the starting landing scene
should depend on the system time. The rest should cycle through smoothly
randomly non-time-dependent." Hence thirteen skies in a random order
(see Sky).

The words' colours follow the sky (see Sky). On a light sky: text #000,
the dimmed grey a warm grey worked out for 4.7:1 on the bio's own ground
(never lighter than #5f5c56), focus a dark ochre for 3.3:1, selection
#e6e2d6 under the black text; on a dark sky (dusk, night): text #fdfcf7,
the dimmed grey a cool light grey for 4.7:1, focus a light gold,
selection #3b3f55. The stylesheet carries each hour's colours for its
still sky; the script refines them for the sky it drew (CSSOM custom
properties on the root). bg #f9f8f1 (Samara's cream) stays the paper:
print, and the colour under everything. color-scheme stays light (no
form controls, no scrollbars); theme-color follows the top of the drawn
sky. Type is matte: no text-shadow, no glow. Links are plain underlined
words (1px, dimmed underline, .18em offset); nothing reacts to hover; OS
cursors only. The type is present at first paint in its final place,
in its hour's colours (hour.v1.js runs before the first paint). Print
hides the sky, the birds and the footer, on white.

## Birds (birds.v9.js)

The page is a sky, seen in depth. Birds cross it the way birds cross a
real sky, built from field data (RESEARCH below) and nothing like v1/v2's
dots, which lived inside the window and turned back at its walls, v3's
slow rigid rows, which read as a dashed line, v4's flights of one
identical mark all moving alike ("Y they all look same and move all the
same?"), or v5-v7's flat sky, every lane drawn on the window's own plane
("Y is the movement so 2D though.").

THE SKY IN DEPTH (v8): the window is a camera looking out over a sea of
cloud and up at the sky (FOV 60 degrees across its longer side, pitched so
the horizon lies 0.2 of its height above its bottom edge (v9: HORIZON
-0.2, negative being above), or
lower where the words come down that far: SEA_CLEAR 60 px below their
margin, with SEA_MIN 5% of the height of sea at least), and lends that
camera to the sky (skyAir.aim), so cloud and bird share one air; every
flight flies
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
on the window (a turn seen heading away sweeps round; measured at the
flight's widest birds as well as its leader, v9), and never crawls under
SLOWEST 5 px/s; a path that would slow it below 0.45 of its pace is not
flown. What moves a bird in seconds (its drift, a gust, a glide's sink)
is gentled as far again, and as far as its slowest bird is seen slower
where it heads away (q); and no path is flown on which any bird, as it
will be drawn (drift, wander, gusts and all), turns faster than TURN_MAX
22 degrees a second on the window (the planner's check, every STEP; a
finch's bound and a thermal aside). Two birds of one flight are never closer than SPACE_SEEN 2
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
stroke-opacity; 1 under forced colors). The ink is the words' colour
(--color-text): black on a light sky, near-white on a dark one.

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
birds); birds.v9.js sets each one's viewBox and size (room for the bird
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
eye. v9's raised horizon and turn check: the 10-minute suite on every
viewport and scenario, all passing.

## Sky (sky.v2.js, hour.v1.js)

THE CAMERA is the birds' (above): the window looks out over a sea of
cloud, the horizon a fifth of the way up from its bottom edge, and the
sky is drawn through the camera the birds lend (skyAir.aim; without the
birds, the same worked out here). Units: the sea's tops lie 1 below the
eye; everything a bird flies is nearer than any cloud.

WHAT IS DRAWN (WebGL2, one fragment shader, per pixel, back to front):
the sky's light (a gradient by height above the horizon: 0, 5, 15, 32,
49 degrees, the old 60 degree stop moved down as no window shows it;
warmed toward the light's side, deepened away from it, a haze band toward
the horizon; the sun or the moon, their halos and a wider glow); a high
deck at 5-7 (thin streaks, an overcast with rain under it, or a veil of
ice), fogged toward its own sky; cumulus towers rising out of the sea
(TOWERS 6 slots: a three-sphere core and nine lobes on the dome's
envelope, joined by a smooth minimum and eroded by tiling 3D noise, soft
edged; each builds out of the sea over BUILD 90 s, sinks back in about a
minute (1.6x), and gives way where it would rise behind the words or over
a sun or moon in view; with no room, a slot looks again in 2-5 s); and
the sea of cloud below the eye (a heightfield of domes, round caps
smoothly joined, two sizes, the small only near; ending in the horizon's
haze). Cloud is lit as cloud, the reference's way: light carried on
through it (octaves of scattering, each dimmer, deeper and less forward:
the depth toward the light from two looks along it), its colour the
light's where thin and the sky's own saturated blue where deep (thick,
per sky; never grey), crevices lit by the cloud about them (powder)
rather than darkened, the edge toward the light silvered (a forward
phase), thin cloud beside the sun in pastel (iri). Aerial perspective:
everything fades with distance into the horizon's haze (the near towers
at 0.4 of the sea's fog, so they keep their form; the haze takes a third
of the glow about the sun), and a low mist lies on the sea. And what the
light does in the air, sky by sky (FX): a rainbow and its fainter twin
with the dark band between and the supernumeraries inside, opposite a low
sun, standing on distant showers (bow, curtain); a glory's rings on the
cloud sea about the antisolar point (glory); the 22 degree halo and a sun
dog in a veil of ice (halo, dogs); the Earth's shadow and the Belt of
Venus opposite a low sun (belt); a pillar over it (pillar); noctilucent
wisps low on the side the sun set (nlc); the moon's corona (corona); the
Milky Way, its core low, its dark lanes, and a crowd of faint stars along
it (galaxy, its lie drawn per visit so the band crosses the window); the
aurora, three curtains folding slowly, rayed, green below and red above,
its light on the cloud (aurora); once in a rain's hold, about 26 s of sun
breaking through onto the sea (sbreak); light drifting in the air near
the sun (motes, in the window pass, never over the words); the stars
twinkling slowly. Then light shafts (radial, from the sky seen near the
sun), a soft glow (dual-filter bloom), a shoulder for the highlights by
the brightest channel (a hue keeps its hue as it brightens, and past
white eases toward white), and a triangular dither before the frame is
stored in 8 bits (no bands). The noise (64 cubed 3D, 256 square 2D) is
baked on the GPU over the first nine frames (eight layers a frame). One
wind moves everything the same way (towers, sea, deck; v1 sent the sea
and deck against the towers).

THE SKIES (SCENES, thirteen; no round, no clock): sunrise (lavender
above, peach at the rising sun, mist, the Belt of Venus opposite), the
glory (the sun low behind the eye, the cloud sea lit full on), the cloud
prairie (azure, big round cumulus, shadows the sky's own blue), the halo
(a high veil of ice), silver rain (a light overcast, showers far off),
the rainbow (after the rain, the sun low behind the eye), golden hour
(the sun on the sea, rim-lit towers, rays, a pillar), the afterglow (tops
still pink over a sea in the Earth's shadow, the purple light), the blue
hour (over an amber band, noctilucent wisps, the first stars), a moonlit
sea, the Milky Way, the aurora, and the light before sunrise (tops lit
first). Each has a group (the time of day it belongs to: dawn, day, rain,
sunset, dusk, night), its words (dark or light), a hold of 70-110 s
(x0.9-1.15 by the visit), a change of 55-60 s, and the skies it passes
into most naturally (near). A visit opens on a sky of the visitor's hour
(hour.v1.js: night 21-05, dawn 05-08, day 08-13, rain 13-16, sunset
16-19, dusk 19-21; any landing sky of that group, by the visit's draw),
nine tenths as far through its hold as the hour is through its span; the
light before sunrise is never a landing. After that the order is the
weather's, with no clock (the owner's word): each next sky is drawn from
its near ones, or (FAR 28%) from any, never one of the last RECENT 3.
Colours blend in OKLab; a sun or moon fades where it stands (the outgoing
gone by the middle of a change, the incoming from it); light and sun
directions pass over the top where two skies face apart. A change
between skies of different words passes a twilight waypoint (below); a
change between skies that are not neighbours passes through the cloud
(the sea swells into mist, the towers sink, the deck closes, and it all
clears into the next sky: the reference's own way of passing between its
places); both can be one waypoint. data-sky carries the group (the
stylesheet's still sky and words for it); skyAir.cycle() reports the
sky, the next, the change's progress and the words (read only, for the
score); data-sky-scene on the root (the studio's) opens on a named sky.
Each sky is the page's own, worked out from the light, never taken from
a picture.

THE WORDS on every sky (the veil and the bands): a frame's light where
the words stand is read back (8 numbers: the bio's ground, its mean,
spread, darkest and lightest; the links' ground, darkest and lightest;
the window's top colour for theme-color; a PBO and a fence, never a
stall; one at a time, the next queued) and followed smoothly. Dark words
want their ground no darker than FLIP 0.186, light words no lighter than
HI_MAX (0.167): RATIO 4.7:1, room above WCAG's 4.5 for rounding and
dither. The dimmed grey is worked out for RATIO on the bio's ground
(mean +- 3 sd), the focus ring for RING 3.3:1 on the links' ground (it
is drawn around the links). Where the words stand (the bio and credit
grown WORDS_CORE 8 px, the name NAME_CORE 20 px, as its letters reach
below its box; a Gaussian feather of WORDS_FEATHER 110 px; the links
LINKS_CORE 6, LINKS_FEATHER 40; drawn into a mask texture when the page
moves, a ResizeObserver catching reflows that move no window: text
spacing, zoom) the composite holds the light inside each band, lifting
or dimming only what would break it: contrast holds whatever the
read-back says. A scroll redraws the veil on the next frame. The words'
colours are set only while the drawn sky shows (otherwise the
stylesheet's are left alone); while it fades in over the still sky (2 s)
they take the safer of the two sets (darker on a light sky, lighter on a
dark one). The flip from dark words to light and back happens at a
twilight: any change between skies of different words eases into a
waypoint where the sky behind the words, and the sea under the links,
stand evenly at the crossing (TWILIGHT and TWILIGHT_SEA, calibrated as
drawn: 0.165-0.19 there; its hue the two skies' between, its chroma at
least 0.045, a twilight purple where their hues cancel, so a crossing is
never grey), flips the words there on the change's own time, and eases
out; the bands pinch toward the crossing on
the same schedule, so nothing jumps but the words. Measured (Chromium,
SwiftShader; each text element's own colour against every ground pixel
under its line boxes, the words hidden; the ring against the ground 2-6
px about each link): settled, 3 viewports x 6 hours, every text role
4.6:1 or more and the ring 3.23 or more; through the fade-in (0, 0.7,
1.4 s), 3 viewports x 6 hours, the dimmed grey 4.70 or more, the ring
3.34 or more.

CALM AND COST: the clouds drift with one wind (SEA_DRIFT 0.45-0.8 px/s
where the sea is nearest, less far off, the deck faster aloft; the
distance gone is kept, so a new window changes the wind, never where the
clouds are) and the towers build and sink over minutes; the light
changes over a minute. A cloud frame (the window at SCALE 0.5 of its CSS
px, never over PX_MAX 640,000 px) is drawn in equal row slices over
PERIOD 1.5 s and crossfaded into. The window is drawn (DRAW_FPS) 12
times a second while it rains (on twos), else 6, and after THIN 300 s 4
(the frames over twice the period); the canvas at most CANVAS_DPR 1.25
device px a CSS px. All GPU work happens on those drawing ticks, each
ending with the window drawn (a browser may present the canvas after any
frame that drew at all: WebKit showed black); the frames on show are
kept through a resize until the first new one lands (never a blank
sky). A slow device, read two ways (the frame after a drawing tick
coming late against the display's own pace, learnt and relearnt; and a
fence showing the GPU still busy with one tick's work at the next),
steps down a LADDER (the canvas at 1 device px a CSS px; frames over
twice the period; smaller frames, twice) and back up after EASE 60 s at
ease; slow at its foot for 10 s, it keeps the still sky. A renderer on
the CPU (SwiftShader, llvmpipe and the like, by its name) gets the still
sky from the start. Simulated: steady rates, 120/144 Hz falling to 60,
a 30 fps low-power cap, a stray short frame and 8 s of contention leave
it untouched; a GPU that misses a frame every tick steps down a rung
every ~4 s, and recovers once eased. (Cost, modelled from exact
per-pixel counts: a phone's sky keeps its GPU 1-16% busy, the
composite the larger share.)

FALLBACKS: the canvas shows only once its first frame's read-back looks
like the sky it should be (doubted once, drawn and read again; doubted
twice, a GPU or driver that draws nonsense is let go, its context freed:
the stylesheet's sky stays); a lost context hides it (the still sky of
the hour, its own colours) until restored, then read again and shown;
no WebGL2: the stylesheet's still sky of the hour (data-sky, by
hour.v1.js), its colours and words; no script: the still day sky.
prefers-reduced-motion: the hour's sky, drawn once, still (live both
ways). forced-colors: no sky (and the sky back, read again, when they
end). A hidden tab draws nothing; the sky's clock steps at most 50 ms. A
resize re-aims and redraws. The sky animates for as long as the page is
open, as the birds do: WCAG 2.2.2 asks for a pause control, and the
owner chose none; prefers-reduced-motion is the stop.

THE WEATHER: one crypto.getRandomValues above sky.v2.js's INIT-END
marker (the cloud field, the towers, the wind, the stars, the order of
the skies, the galaxy's lie, the aurora's folds, where the sun breaks
through), and no clock:
hour.v1.js reads the clock, once, and marks the page (data-sky,
data-sky-at). No DOM is built: the canvas is in index.html.

VERIFY before changing the sky: stills of every sky (data-sky-scene
written into the page in flight) and every hour at 1440x900, 390x844,
844x390 and 768x1024 (Chromium with SwiftShader, the page's clock
faked); time-lapses of the random order over 15 minutes and more, and
stepped, frame-exact renders of each flip (the words hidden, the light measured where they stand);
the contrast audit above, settled and through the fade-in; reduced
motion, a lost and restored context, rotation (no blank frame), print,
forced colours, the 404 page, no WebGL, no script; a forced-black sky
(the fallback takes it); the governor on synthetic frame clocks; WebKit
(Safari's engine); the bird suite and the live bird pass with the sky
running. (In the harness, the GPU's name is faked and its fences report
done, or SwiftShader's slowness would rightly get the still sky.)

## CSS

One file: style.v11.css. Plain CSS. Custom properties for theming.
All @font-face declarations (subsets + metric fallbacks) at top of file.
Clamp-based spacing for fluid layout across viewports.
WCAG AA contrast on all text over every sky (the script holds it on the
drawn sky). The still skies: a gradient per hour on the body (the sky to
the horizon at four fifths of the way down, then the sea), :root[data-sky]
choosing it and the words' colours; each sky's colours hold against its
whole gradient, wherever a window puts the words (text and the dimmed
grey 4.7:1 or more, the focus ring 3.3:1; CI samples every gradient as
the browser draws it and fails below 4.5 and 3). The canvas (.sky) is fixed behind
everything (z-index -1), unseen until drawn. One keyframe, `appear` (a
bird's 1 s fade-in, Samara's, off under prefers-reduced-motion; the
sky's 2 s dissolve over the still sky, kept: a dissolve is not motion);
no transitions. :focus-visible is a 2px outline in the focus colour,
offset 3px, on every focusable.

## JS

Four files, one job each:

1. site.js — email obfuscation: HTML has href="#" id="email-link", JS
   assembles mailto from split parts at runtime so bots cannot scrape the
   address. A \<noscript\> fallback shows the email in HTML entities.
2. hour.v1.js — the hour (in the head, before the first paint: tiny,
   Early-Hinted): which time of day the sky opens on.
3. sky.v2.js — the sky (see Sky), deferred, before the birds.
4. birds.v9.js — the birds (see Birds), deferred. Progressive
   enhancement throughout: with JS off, the page is the typography on
   the still day sky.

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

theme-color opens at the top of the hour's still sky (hour.v1.js, before
the first paint) and follows the top of the drawn sky. The favicon is SVG-first with PNG fallback.

## Caching

HTML: max-age=0, must-revalidate. Everything else: max-age=31536000,
immutable. Immutable means CHANGED BYTES NEED A NEW FILENAME: bump
style.vN.css → style.vN+1.css, birds.vN.js → birds.vN+1.js, sky.vN.js →
sky.vN+1.js, hour.vN.js → hour.vN+1.js, .subN → .subN+1, and update every
reference in the same commit — five files: index.html (stylesheet, hour,
sky, birds), 404.html (stylesheet, hour), \_headers (the style and hour
Link preloads, each file's cache block, the "next name" comment),
.github/workflows/validate.yml
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
birds.v9.js, sky.v2.js, hour.v1.js, plus style.v11.css for cursors —
never to this prose) fails on: arrows/cookie/analytics/Loading/
navigation-role vocabulary in the HTML; any exit, idle, hover-position,
key, blur, title, favicon-swap or storage handler in the JS; any DOM
building in the birds, the sky or the hour; more or fewer than one
getRandomValues in the birds or the sky, or one below its INIT-END
marker; any Math.random or clock read (Date) in either; anything in the
hour but its one `new Date(` (no entropy; calls counted, not lines; no
Date() or randomUUID anywhere, no performance.now below a marker); any
URL hook
(location.search/hash/href, URLSearchParams) or sound (Audio,
AudioContext, <audio>, speechSynthesis) in the JS or HTML; and any
`cursor:` rule in the stylesheet (OS cursors only).
Trusted Types is NOT enabled, deliberately: Cloudflare Rocket Loader
rewrites the script tags and re-executes them through dynamic .src
assignment — a TT sink — so require-trusted-types-for 'script' kills
every script on the page on every TT-enforcing browser (verified by
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
The sky needs no CSP change: WebGL2 from a same-origin script, no
workers, no blobs, no fetches. \_redirects sends /CLAUDE.md and
/.github/* to / (they were served as static files). Exact paths only:
Cloudflare matches redirects on the raw path, so a percent-encoded
spelling (/%43LAUDE.md) still reaches the file; the repo is public, so
nothing leaks that GitHub doesn't show. To truly stop serving repo files,
move the site into a folder and set it as the Pages build output
directory (still no build command). The hour's script carries
data-cfasync="false" so Rocket Loader leaves it to run before the first
paint.
robots.txt blocks: GPTBot, ClaudeBot, CCBot, Google-Extended, ChatGPT-User,
Bytespider, anthropic-ai, cohere-ai, FacebookBot.

## Deploy

Cloudflare Pages. Auto-deploys on push to main. No build command needed.
