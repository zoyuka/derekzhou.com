/* Birds — a sky.

   The owner, verbatim: "The page should be a sky so like they're flying
   across/in patterns/etc. it should feel calm - not bouncing off the
   walls." ... "should b rand". Of v3's rows: "Are you sure this is how
   birds movement is flying?!" And of v4: "Y they all look same and move
   all the same?"

   EVERY BIRD ITS OWN DRAWING. The tattoo is the hand, not a stamp. Traced
   from the photo, each of its three birds is an "M" gull stood on a steep
   diagonal: from the back, a rise to the first wrist, a drop to the body,
   a rise to the second wrist, and a long stroke out in front (the
   long-tailed one draws its back wing out as a tail). Along the diagonal
   the rises read as risers and the drops as treads: steps. Every bird is
   drawn afresh in that hand (drawBird): its own strokes, its own lean, now
   and then a tail, in its kind's proportions (a gull long in the wing, a
   finch small and neat, a heron trailing its legs). Size and ink are
   distance: a far skein small and pale, a heron passing near large and
   black.

   EVERY KIND ITS OWN FLIGHT (Pennycuick 2001 and the sources in
   CLAUDE.md): geese beat on and on in V's and J's; ibis flap and glide in
   lines, the glide passing back down the line; gulls flap a few times and
   glide long on gently curving lanes; a heron rows by on slow, deep
   beats; crows row straight; finches bound, a few quick beats up and a
   fall with the wings shut; swallows glide and flicker on lazy S's;
   storks circle a thermal. Speed is in spans a second, so a flapping bird
   covers about its own span a beat (flapping that goes nowhere reads as
   treading air). The calm comes from glides, few birds and empty sky, not
   from slow wings.

   EVERY BIRD MOVES ON ITS OWN: its own rate and point in the beat, its
   own flap-and-glide, its own drift about its place over a few seconds.
   No skein is where a ruler would put it, and none is fixed: now and then
   a scatter gathers into its V as it crosses (the pattern finding them),
   or a V loosens.

   THE SKY. Every flight enters from beyond one edge already flying (a 1 s
   fade softening the entry) and leaves beyond the far edge; nothing
   starts, stops, loops or turns back in view. A lane is planned whole
   before its first bird enters: clear of the name, bio and credit and of
   the footer links for the whole crossing, clear of every other flight,
   one flight to a band.

   THE HAND: every mark drawn afresh 12 times a second (on twos), its
   vertices re-jittered 6 times a second (the boil). Through a beat the
   wrists swing down across the bird's own line and back up (M, flat, W,
   flat, M) and the body lifts a little on the downstroke. As drawn a bird
   faces right, rising the way the tattoo's do; flying left mirrors it.
   Never rotated.

   THE WEATHER (=rand()): ONE crypto draw at init, above INIT-END, and no
   clock at all; splitmix32 streams from it: the front and its facets, the
   season, and every flight's own stream (its kind, its birds, their
   drawings). There is no other randomness.

   prefers-reduced-motion: a still sky, a photograph. A hidden tab pauses
   with requestAnimationFrame; a step is capped at STEP_MAX. No DOM is
   built: the twelve SVGs are in index.html; this draws their strokes and
   moves them. */
(function () {
  'use strict';

  var els = Array.prototype.slice.call(document.querySelectorAll('.bird'));
  if (!els.length || !window.requestAnimationFrame || !window.matchMedia) return;

  var DEG = Math.PI / 180, TAU = 2 * Math.PI;

  /* ---------------- constants ---------------- */

  /* the hand */
  var SPAN = 22;               // px across: a mid-sized bird at middle distance, on a large window
  var SPAN_MIN = 9;            // px: never smaller
  var LINE = [1.5, 2.5];       // stroke width, px: finer far off, bolder near (the pen's pressure)
  var TONE = [0.62, 1];        // the ink: far birds paler (the air between), near ones black
  var PAD = 4;                 // px round a drawing's box: the caps and the boil
  var DRAW_FPS = 12;           // the hand draws each mark afresh this often (on twos) ...
  var BOIL_FPS = 6;            // ... its tremor re-rolled every other drawing
  var HAND = [1.2, 1.6];       // px: the visit's tremor ...
  var JSCALE = 0.4;            // ... trimmed for a small mark in flight
  var BOB = 0.04;              // spans: the body lifts this much on the downstroke
  var DOWN = 0.45;             // the share of a beat that is downstroke (the quicker stroke)
  var WRIST = [1.15, 0.2];     // the wrists: a little above the drawing at the top of the beat, all but flat at the bottom (never a slash: the steps always show)
  var TAIL = [10, 14.5];       // glyph units: a back wing drawn out as a tail ...
  var TAIL_UP = [12, 22];      // ... rising this many degrees off the bird's line
  var LEAN = [-14, 5];         // degrees: a bird stands at about its drops' angle (steps), give or take
  var FACE_HYST = 0.2;         // |cos heading| past this before a bird turns to face the other way

  /* the sky */
  var OUT = 70;                // px beyond the window where a lane begins and ends
  var WORDS = 24;              // px of sky kept clear round the words (the name, bio and credit) ...
  var LINKS = 20;              // ... and round the footer links
  var ROOMY = 60;              // px: a lane this far from the words and the window's edges is as good as any
  var EDGE = 10;               // px kept from each edge of the window a flight does not cross
  var APART = 48;              // px kept between two flights, always
  var FLIGHTS = [2, 3];        // flights in the sky at once, at most: more on a WIDE sky
  var WIDE = 900;              // px
  var STEP = 0.3;              // s: the planner's look-ahead step (a lane is checked whole before a bird enters)
  var TRIES = 16;              // lanes tried per flight
  var QUOTA = 500;             // bird-steps of look-ahead a frame: planning is spread over frames, never a long one ...
  var LEAD = 4;                // s: ... so a flight is planned to set off this far ahead (still beyond the edge)
  var STEP_MAX = 0.05;         // s: the longest step a frame may take

  /* the pace */
  var PACE = [0.94, 1.06];     // the visit's pace, on every kind's own
  var TEMPO = [0.95, 1.05];    // the visit's wing-beat, on every kind's own
  var SPEED = [14, 64];        // px/s: never slower, never faster ...
  var CALM = [22, 52];         // s: a mid bird crosses the window in about this long (a phone's .. 1440 px and up):
                               // the page's calm, slower than the wild, every kind slowed alike, so each keeps its pace ...
  var REF = 2.04;              // ... (a mid bird: its distance, 0.85, times its 2.4 spans a second) ...
  var CROSS = [15, 36];        // s: ... and no bird across it quicker than this ...
  var KNEE = 0.75;             // ... easing toward that from this share of it, so a quick kind stays quicker than a slow one
  var HOLD = 2.2;              // a bird slowed from its wild pace glides the longer between bursts: by the root of how far, up to this
  var DETUNE = 0.05;           // each bird beats its own share faster or slower than its flight
  var GAP = [0.3, 0.7];        // the next flight comes after this share of the last one's crossing in view ...
  var THIN = 360;              // s: ... and the sky thins, the gaps a crossing longer for every THIN s on the page ...
  var THIN_MAX = 2;            // ... up to this many crossings longer
  var FIRST = [0.5, 1.5];      // s: the first flight's leader enters this soon after load
  var RETRY = 3;               // s: no room for a flight now: look again this much later

  /* the lanes */
  var DIAG = [20 * DEG, 60 * DEG];   // steeper lanes, when no level crossing fits (a narrow landscape sky)
  var CLIMB = [10 * DEG, 20 * DEG];  // a lone bird or a pair climbing away or coming down, now and then
  var BOW = [0.015, 0.05];     // a lane's bow, as a share of the window's width, by the breeze: in toward the words
  var WANDER = [3, 7];         // px: the track's slow wander, by the breeze, which every bird of a flight flies through ...
  var WAVE = [260, 480];       // px: ... its wavelength
  var HEAVE = [2, 5];          // px: a gust lifting or dropping the whole flight, by the breeze ...
  var HEAVE_T = [10, 16];      // s: ... this slowly

  /* the patterns */
  var COUNT = [11, 19, 22, 0, 18, 5, 14, 4, 7];   // % of flights of 1, 2 ... 9 birds (never four)
  var ARM_X = [1.5, 1.9];      // spans back, per place along an arm of a V, a J or an echelon
  var ARM_Y = [0.9, 1.1];      // spans aside, per place
  var JITTER = 0.3;            // no slot is where a ruler would put it: each is off by up to this share
  var FILE = [1.6, 2.2];       // spans between birds in a line ...
  var FILE_Y = 0.5;            // ... the line wandering up or down by up to this many spans a bird
  var PAIR_X = [0.9, 1.4], PAIR_Y = [0.95, 1.2];  // spans: the second of a pair, behind and aside
  var LOOSE = [1.5, 2.6];      // spans: a loose flock's spacing
  var DRIFT_L = [0.08, 0.18];  // spans: every bird drifts about its place, forward and back ...
  var DRIFT_P = [0.15, 0.3];   // ... up and down ...
  var DRIFT_T = [3, 6.5];      // s: ... this quickly, each on its own
  var SIZE_VAR = 0.08;         // birds of one flight differ in size by up to this share
  var SPACE = 4;               // px: the least ink-to-ink gap between two birds of a flight
  var BAND_GAP = 24;           // px between the heights two flights keep: one flight to a band
  var GATHER = 0.4;            // of skeins and lines: a scatter that gathers into its pattern as it crosses ...
  var LOOSEN = 0.15;           // ... or a pattern that loosens
  var GATHER_AT = [0.4, 0.9];  // s: each bird setting off for its place this long after the one ahead ...
  var GATHER_T = [6, 10];      // s: ... and taking this long to reach it
  var FILE_G = [2, 2.4];       // spans between birds in the file a V opens out of
  var REL = 0.2;               // no bird moves within its flock faster than this share of the flight's speed (birds never fly backward)
  var GATHER_MAX = 16;         // s: a gathering that would take longer does not happen
  var STRAGGLE = [0.06, 0.1];  // a straggler catches up at this much over the flight's speed ...
  var STRAGGLE_T = [14, 22];   // ... over this many seconds
  var SWAP_T = [16, 24];       // s: a pair changing sides
  var WAVE_DELAY = [0.35, 0.8];   // s: in a line, each bird starts its beats and glides this long after the one ahead
  var FLAPS_SLOW = [[4, 9], [0.8, 2]];  // a kind that beats on and on, held to a slower pace: it glides between bursts instead

  /* the soaring birds */
  var SOAR_W = 700;            // px: a sky this wide or more (a phone's bands would trap a circle)
  var SOAR_R = [55, 110];      // px: a thermal's radius, 38 + 0.05 x the width within this
  var SOAR_K = [0.33, 0.44];   // the circle seen from below: its height over its width
  var LAP = [15, 21];          // s a lap (storks: 13.6 s median, 18 s at most; a little slower on a page)
  var LAPS = [1, 2];           // laps each, before gliding away
  var WIND = [3, 6];           // px/s: the thermal drifting downwind
  var GLIDE_V = 1.3;           // they glide in and out this much faster than they circle, easing over ...
  var EASE_T = 2.5;            // ... this many seconds
  var DESCENT = [2 * DEG, 4 * DEG];   // the glide away, a little downhill

  /* the kinds of bird: their size and distance, pace (spans a second),
     wing-beat (Hz), flapping (beats a burst, glides s), drawing (glyph
     units and degrees: the rises, the drops, the stroke out in front, how
     often a tail), the wrists' set on a glide, and their lanes */
  var SORTS = {
    goose:   { size: 1, depth: [0.6, 1], pace: [2.4, 2.8], hz: [2.3, 2.7], flaps: [[16, 36], [0.4, 0.9]],
               rise: [5.2, 6.6], drop: [3.8, 5], out: [5.6, 7.2], up: [28, 36], down: [34, 42], tail: 0.05, glide: [0.85, 1.05], tilt: 4 },
    ibis:    { size: 1, depth: [0.65, 1.05], pace: [2.2, 2.6], hz: [2.6, 3], flaps: [[4, 10], [0.9, 2.2]], sink: 0.08,
               rise: [5, 6.4], drop: [3.6, 4.8], out: [5.4, 7], up: [28, 36], down: [34, 42], tail: 0.4, glide: [0.8, 1], tilt: 4 },
    gull:    { size: 1.15, depth: [0.75, 1.3], pace: [1.9, 2.3], hz: [2.2, 2.6], flaps: [[3, 7], [1.4, 3.6]], sink: 0.12,
               rise: [6.2, 8], drop: [4.4, 6], out: [6.4, 8.4], up: [22, 30], down: [28, 36], tail: 0, glide: [0.75, 1], tilt: 7, bow: 1.6, wander: 1.5 },
    heron:   { size: 1.35, depth: [0.9, 1.3], pace: [1.8, 2.1], hz: [1.9, 2.2], flaps: [[20, 44], [0.5, 1]],
               rise: [5.8, 7.2], drop: [4.2, 5.4], out: [5.6, 7], up: [30, 38], down: [36, 44], tail: 1, glide: [0.85, 1.05], tilt: 3 },
    crow:    { size: 0.9, depth: [0.75, 1.2], pace: [2.7, 3.1], hz: [2.8, 3.2], flaps: [[14, 30], [0.3, 0.8]],
               rise: [4.8, 6], drop: [3.6, 4.6], out: [5, 6.4], up: [30, 40], down: [36, 46], tail: 0, glide: [0.85, 1.05], tilt: 5 },
    finch:   { size: 0.62, depth: [0.9, 1.3], pace: [3.2, 3.8], hz: [5, 6], flaps: [[2, 4], [0.28, 0.5]], bound: [0.35, 0.55],
               rise: [4, 5.2], drop: [3.2, 4.2], out: [4.2, 5.6], up: [30, 40], down: [36, 46], tail: 0, glide: [0.15, 0.3], tilt: 6 },
    swallow: { size: 0.75, depth: [0.85, 1.25], pace: [3, 3.6], hz: [3.8, 4.6], flaps: [[2, 4], [0.9, 2.2]], sink: 0.1,
               rise: [4.6, 5.8], drop: [3.4, 4.4], out: [6.2, 8], up: [26, 34], down: [30, 40], tail: 1, glide: [0.8, 1.05], tilt: 8, bow: 1.8, wander: 3, wave: 1.3 },
    stork:   { size: 1.25, depth: [0.75, 1.15], pace: [1.6, 2], hz: [1.9, 2.2], flaps: null,
               rise: [6, 7.6], drop: [4.4, 5.8], out: [6.2, 8], up: [22, 30], down: [28, 36], tail: 0.5, glide: [0.75, 1], tilt: 3 }
  };
  /* which kinds fly which patterns, and how often */
  var SORT_OF = {
    skein: [['goose', 75], ['ibis', 25]],
    line: [['ibis', 40], ['goose', 35], ['gull', 25]],
    pair: [['gull', 40], ['goose', 20], ['crow', 20], ['swallow', 10], ['finch', 10]],
    single: [['gull', 35], ['heron', 30], ['crow', 20], ['swallow', 10], ['finch', 5]],   // mostly the big, slow-beating kinds:
    loose: [['crow', 35], ['gull', 30], ['finch', 20], ['swallow', 15]],                 // the small quick ones now and then
    soar: [['stork', 1]]
  };

  /* ---------------- the weather (=rand()) ---------------- */

  function sm32(a) {
    return function () {
      a = (a + 0x9e3779b9) | 0;
      var t = a ^ (a >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735a2d97);
      return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
    };
  }
  /* the one entropy read */
  var visitSeed = (function () {
    try { if (window.crypto && crypto.getRandomValues) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] >>> 0; } } catch (e) {}
    return (performance.now() * 1000) >>> 0;
  })();
  /* VISIT streams: 1 the hand's noise, 2 the lanes' low-discrepancy offsets, 11 the weather, 100+ each flight */
  function vstream(n) { return sm32((visitSeed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0); }

  /* ONE front, five facets: a still visit is still everywhere (a steady
     hand, easy wings, a straight sky, an easy pace, few birds), a lively
     one lively */
  var wr = vstream(11);
  var front = (wr() + wr()) / 2;
  function facet() { return 0.7 * front + 0.3 * wr(); }
  var fHand = facet(), fTempo = facet(), fBreeze = facet(), fPace = facet(), fTraffic = facet();
  var season = wr() < 0.65 ? 1 : -1;       // the way most flights go today (1: left to right, the way the words read)
  var faithful = 0.65 + 0.15 * wr();       // ... and how many of them

  /* ---- INIT-END: no clock or entropy reads below this line ---- */

  var hand = (HAND[0] + (HAND[1] - HAND[0]) * fHand) * JSCALE;       // px
  var pace = mix(fPace, PACE[0], PACE[1]);
  var tempo = mix(fTempo, TEMPO[0], TEMPO[1]);

  var NOISE_N = 4096;
  var noise = new Float32Array(NOISE_N);
  (function () { var r = vstream(1), i; for (i = 0; i < NOISE_N; i++) noise[i] = r() * 2 - 1; })();
  function nz(i) { return noise[(i | 0) & (NOISE_N - 1)]; }
  /* a slow wave in [-1, 1]: two sines, the second 0.618 as fast, their phases from the table (never a jolt) */
  function wave(key, x) { return 0.6 * Math.sin(TAU * x + Math.PI * nz(key)) + 0.4 * Math.sin(TAU * 0.618 * x + Math.PI * nz(key + 1)); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function mix(r, lo, hi) { return lo + (hi - lo) * r; }
  function ease(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function pick(r, a) { return mix(r(), a[0], a[1]); }
  function weighted(r, list) {
    var tot = 0, i, u;
    for (i = 0; i < list.length; i++) tot += list[i][1];
    u = r() * tot;
    for (i = 0; i < list.length; i++) { u -= list[i][1]; if (u < 0) return list[i][0]; }
    return list[list.length - 1][0];
  }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var forced = window.matchMedia('(forced-colors: active)');

  /* ---------------- the page: the window and the words ---------------- */

  var W = 0, H = 0, words = [], dirty = true, wordsY = 0, view = 1;
  function measure() {
    W = window.innerWidth; H = window.innerHeight;
    view = clamp(Math.pow(Math.min(W, 1.6 * H) / 1100, 0.4), 0.72, 1.12);   // a small window shows its birds a little smaller
    words = [];
    var s = document.querySelector('.stack'), a = document.querySelectorAll('footer a'), i, r;
    if (s) { r = s.getBoundingClientRect(); keep(r, WORDS); wordsY = (r.top + r.bottom) / 2; }
    else wordsY = H / 2;
    for (i = 0; i < a.length; i++) keep(a[i].getBoundingClientRect(), LINKS);
    dirty = false;
  }
  function keep(r, m) { if (r.right > r.left && r.bottom > r.top) words.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, m: m }); }
  function across(A) { return clamp(A[0] + (W - 390) * (A[1] - A[0]) / 1050, A[0], A[1]); }
  function topSpeed() { return Math.min(SPEED[1], W / across(CROSS)); }
  /* the page's calm: a bird's wild pace (px/s) times this */
  function calmOf() { return W / across(CALM) / (SPAN * view * REF); }
  /* a speed eased under a ceiling: as it is below KNEE of it, and ever closer to it above */
  function soft(v, top) { var k = KNEE * top; return v <= k ? v : k + (top - k) * (1 - Math.exp(-(v - k) / (top - k))); }
  function maxFlights() { return W >= WIDE ? FLIGHTS[1] : FLIGHTS[0]; }

  /* the ink box (x ± hw, y ± hh) keeps its margin from every word box
     (a flight already flying, when the page moves, half of it) */
  var held = 1;
  function clearOfWords(x, y, hw, hh) {
    for (var i = 0, o, m; i < words.length; i++) {
      o = words[i]; m = o.m * held;
      if (x + hw > o.l - m && x - hw < o.r + m && y + hh > o.t - m && y - hh < o.b + m) return false;
    }
    return true;
  }
  /* edges: 1 left, 2 right, 4 top, 8 bottom — the ones a flight crosses */
  function inView(x, y, hw, hh) { return x + hw > 0 && x - hw < W && y + hh > 0 && y - hh < H; }
  function withinEdges(x, y, hw, hh, e) {
    return (e & 1 || x - hw >= EDGE) && (e & 2 || x + hw <= W - EDGE) &&
           (e & 4 || y - hh >= EDGE) && (e & 8 || y + hh <= H - EDGE);
  }
  /* open sky round the ink box: to the nearest word box, and to the edges the flight does not cross */
  function room(x, y, hw, hh, e) {
    var g = ROOMY, i, o, dx, dy;
    for (i = 0; i < words.length; i++) {
      o = words[i];
      dx = Math.max(o.l - x - hw, x - hw - o.r, 0);
      dy = Math.max(o.t - y - hh, y - hh - o.b, 0);
      g = Math.min(g, Math.sqrt(dx * dx + dy * dy));
    }
    if (!(e & 1)) g = Math.min(g, x - hw);
    if (!(e & 2)) g = Math.min(g, W - x - hw);
    if (!(e & 4)) g = Math.min(g, y - hh);
    if (!(e & 8)) g = Math.min(g, H - y - hh);
    return g;
  }

  /* the heights a level crossing can hold its centre at, the flight
     reaching lo above it and hi below it: the window's height less EDGE,
     less every word box's height (grown by its margin) and every other
     flight's band, as a list of [from, to] intervals */
  function openBands(lo, hi) {
    var out = [[EDGE + lo, H - EDGE - hi]], i, j, o, a, b, next, cut = words.map(function (o) { return [o.t - o.m, o.b + o.m]; });
    for (i = 0; i < flights.length; i++) cut.push([flights[i].yLo - BAND_GAP, flights[i].yHi + BAND_GAP]);   // one flight to a band
    for (i = 0; i < cut.length; i++) {
      o = cut[i]; a = o[0] - hi; b = o[1] + lo;           // a centre in (a, b) puts the flight on the words' line, or in another's band
      next = [];
      for (j = 0; j < out.length; j++) {
        if (out[j][1] <= a || out[j][0] >= b) next.push(out[j]);
        else {
          if (out[j][0] < a) next.push([out[j][0], a]);
          if (out[j][1] > b) next.push([b, out[j][1]]);
        }
      }
      out = next;
    }
    return out.filter(function (v) { return v[1] > v[0]; });
  }
  /* a height in those bands, u of the way through their total length */
  function inBands(B, u) {
    var tot = 0, i;
    for (i = 0; i < B.length; i++) tot += B[i][1] - B[i][0];
    u *= tot;
    for (i = 0; i < B.length; i++) { if (u <= B[i][1] - B[i][0]) return B[i][0] + u; u -= B[i][1] - B[i][0]; }
    return null;
  }

  /* ---------------- the drawing: every bird afresh, in the tattoo's hand ---------------- */

  /* one bird: an M in its own frame (u along its line, back to front; v
     toward its wrists), kept as each vertex's distance along the line from
     the back end to the front end and across it, and the lean that stands
     it on its diagonal */
  function drawBird(r, S) {
    var tail = r() < S.tail, M = [0, 0], u = 0, v = 0, i, d1 = pick(r, S.down), d2 = pick(r, S.down) - pick(r, [2, 10]),
        ex, ey, L, B;
    function go(len, a) { u += len * Math.cos(a * DEG); v += len * Math.sin(a * DEG); M.push(u, v); }
    if (tail) go(pick(r, TAIL), pick(r, TAIL_UP));        // the back wing drawn out long: a tail ...
    else go(pick(r, S.rise), pick(r, S.up));              // ... or the rise to the first wrist
    go(pick(r, S.drop), -d1);                             // down to the body
    go(pick(r, S.rise), pick(r, S.up));                   // up to the front wrist
    go(pick(r, S.out), -d2);                              // and out in front
    ex = M[8]; ey = M[9]; L = Math.sqrt(ex * ex + ey * ey);
    B = { s: [], h: [], ux: ex / L, uy: ey / L, tail: tail };
    for (i = 0; i < 10; i += 2) { B.s.push(M[i] * B.ux + M[i + 1] * B.uy); B.h.push(M[i + 1] * B.ux - M[i] * B.uy); }
    L = ((d1 + d2) / 2 + pick(r, LEAN)) * DEG;           // steps: the drops lie about flat
    B.c = Math.cos(L); B.sn = Math.sin(L);
    return B;
  }
  /* the bird in a pose, into out[10] (x, y down): k sets the wrists (1 up,
     as drawn; 0 on the bird's line; below 0 down past it); shut folds the
     wings (a bounding finch between its bursts) */
  function shape(B, k, shut, out) {
    var i, su, hv, pu, pv, kk;
    for (i = 0; i < 5; i++) {
      kk = i === 1 || i === 3 ? (B.tail && i === 1 ? 0.5 + 0.5 * k : k) : 1;   // (a tail swings half as far)
      su = B.s[i] * (shut ? 0.78 : 1);
      hv = B.h[i] * kk * (shut ? 0.25 : 1);
      pu = su * B.ux - hv * B.uy; pv = su * B.uy + hv * B.ux;
      out[2 * i] = pu * B.c - pv * B.sn;                 // stood on its diagonal, rising to the right
      out[2 * i + 1] = -(pu * B.sn + pv * B.c);
    }
    return out;
  }
  var SH = new Float64Array(10);
  /* a bird at a size: its box over every pose it takes, and its pen */
  function measureBird(B, span, tone) {
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, sc, i, k, gw, gh, lw, poses = [WRIST[0], 0.15, 2];   // (the wrists at their highest and lowest, and shut)
    shape(B, 1, false, SH);
    for (i = 0; i < 10; i += 2) { x0 = Math.min(x0, SH[i]); x1 = Math.max(x1, SH[i]); }
    sc = span / (x1 - x0);
    x0 = y0 = Infinity; x1 = y1 = -Infinity;
    for (k = 0; k < poses.length; k++) {
      shape(B, poses[k] === 2 ? 0.15 : poses[k], poses[k] === 2, SH);
      for (i = 0; i < 10; i += 2) {
        x0 = Math.min(x0, SH[i]); x1 = Math.max(x1, SH[i]);
        y0 = Math.min(y0, SH[i + 1]); y1 = Math.max(y1, SH[i + 1]);
      }
    }
    gw = (x1 - x0) * sc; gh = (y1 - y0) * sc; lw = clamp(1.3 + 0.035 * span, LINE[0], LINE[1]);
    return { B: B, sc: sc, x0: x0, y0: y0, span: span, lw: lw, tone: tone,
             w: gw + 2 * PAD, h: gh + 2 * PAD, hw: gw / 2 + lw / 2 + 0.5, hh: gh / 2 + lw / 2 + 0.5 };
  }

  /* ---------------- the birds (twelve SVGs, lent to flights) ---------------- */

  var slots = els.map(function (el, i) {
    return { el: el, line: el.querySelector('polyline'), key: 9100 + i * 97, busy: false, on: false, face: 1 };
  });
  function freeSlots() { var n = 0, i; for (i = 0; i < slots.length; i++) if (!slots[i].busy) n++; return n; }
  function dress(s, d) {
    s.d = d;
    s.el.setAttribute('viewBox', '0 0 ' + d.w.toFixed(2) + ' ' + d.h.toFixed(2));
    s.el.setAttribute('width', d.w.toFixed(2));
    s.el.setAttribute('height', d.h.toFixed(2));
    s.line.setAttribute('stroke-width', d.lw.toFixed(2));
    s.line.setAttribute('stroke-opacity', forced.matches ? '1' : d.tone.toFixed(2));
  }

  /* ---------------- the lanes: gentle cubic curves, walked by length ---------------- */

  var LUT = 96;
  function bez(P, u, o) {
    var v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
    o.x = a * P[0] + b * P[2] + c * P[4] + d * P[6];
    o.y = a * P[1] + b * P[3] + c * P[5] + d * P[7];
    a = 3 * v * v; b = 6 * v * u; c = 3 * u * u;
    var tx = a * (P[2] - P[0]) + b * (P[4] - P[2]) + c * (P[6] - P[4]);
    var ty = a * (P[3] - P[1]) + b * (P[5] - P[3]) + c * (P[7] - P[5]);
    d = Math.sqrt(tx * tx + ty * ty) || 1;
    o.tx = tx / d; o.ty = ty / d;
    return o;
  }
  function lane(P) {
    var L = { P: P, s: new Float64Array(LUT + 1), len: 0 }, o = {}, i, px = P[0], py = P[1], acc = 0;
    for (i = 1; i <= LUT; i++) {
      bez(P, i / LUT, o);
      acc += Math.sqrt((o.x - px) * (o.x - px) + (o.y - py) * (o.y - py));
      L.s[i] = acc; px = o.x; py = o.y;
    }
    L.len = acc;
    return L;
  }
  /* the point s px along a lane, and the way the lane runs there; past either end it runs on straight */
  function along(L, s, o) {
    var lo = 0, hi = LUT, m;
    if (s <= 0) { bez(L.P, 0, o); o.x += o.tx * s; o.y += o.ty * s; return o; }
    if (s >= L.len) { bez(L.P, 1, o); o.x += o.tx * (s - L.len); o.y += o.ty * (s - L.len); return o; }
    while (hi - lo > 1) { m = (lo + hi) >> 1; if (L.s[m] <= s) lo = m; else hi = m; }
    return bez(L.P, (lo + (s - L.s[lo]) / (L.s[hi] - L.s[lo])) / LUT, o);
  }

  /* ---------------- the wings ---------------- */

  /* a bird's day on the wing: bursts of beats [start, end, start, end ...],
     each followed by a glide (or a bound), from well before the flight to its end */
  function bursts(r, f, how, from, to) {
    var out = [], t = from - r() * 10, b;
    while (t < to) {
      b = Math.round(pick(r, how[0])) / f;
      out.push(t, t + b);
      t += b + pick(r, how[1]);
    }
    return out;
  }
  /* the burst at or before t: its index in the list (even), or -2 before the first */
  function burstAt(segs, t) {
    var lo = 0, hi = segs.length / 2, m;
    if (!segs.length || t < segs[0]) return -2;
    while (hi - lo > 1) { m = (lo + hi) >> 1; if (segs[2 * m] <= t) lo = m; else hi = m; }
    return 2 * lo;
  }
  /* where a bird is in its wing-beat at time t: its phase in [0, 1) (0 the
     wrists up, as drawn), -1 while it glides, -2 while a bounding bird falls
     with its wings shut. Each bird beats at its own rate from its own point
     in the beat; in a line a bird starts its beats and its glides a little
     after the one ahead (its delay) */
  function beat(m, t) {
    var w = m.w, c, k;
    if (!w) return -1;
    t -= m.delay;
    k = burstAt(w.segs, t);
    if (k < 0) return w.bound ? -2 : -1;
    c = m.f * (t - w.segs[k]) - m.half;
    if (c < 0 || c >= Math.round((w.segs[k + 1] - w.segs[k]) * w.f)) return w.bound ? -2 : -1;
    return c - Math.floor(c);
  }
  /* the wrists through a beat: down through DOWN of it and up through the rest, easing at the top and the bottom */
  function wrists(ph) {
    return ph < DOWN ? mix(ease(ph / DOWN), WRIST[0], WRIST[1]) : mix(ease((ph - DOWN) / (1 - DOWN)), WRIST[1], WRIST[0]);
  }
  /* how far a bird is carried off its line by its wings (px, down +): a
     flap-glider sinks a little through each glide and climbs back through
     the next burst; a bounding bird rises through its beats and falls
     through the bound */
  function lift(m, t) {
    var w = m.w, s, k, a, b, n, d, h;
    if (!w || !(w.sinks || w.bound)) return 0;
    s = w.segs; t -= m.delay;
    k = burstAt(s, t);
    if (k < 0) return 0;
    a = s[k]; b = s[k + 1]; n = k + 2 < s.length ? s[k + 2] : b + 1;
    if (w.bound) {
      h = t < b ? (1 - Math.cos(Math.PI * (t - a) / (b - a))) / 2 : (1 + Math.cos(Math.PI * Math.min(1, (t - b) / (n - b)))) / 2;
      return w.bAmp * (0.5 - h);
    }
    if (t < b) {                                          // in a burst: climbing back from the glide before it
      d = k >= 2 ? w.amp * Math.min(1, (a - s[k - 1]) / 3) : 0;
      return d * (1 - ease((t - a) / (b - a)));
    }
    d = w.amp * Math.min(1, (n - b) / 3);                 // in a glide: sinking
    return d * ease((t - b) / (n - b));
  }
  /* how far that can carry it, either way */
  function liftReach(m) { var w = m.w; return !w ? 0 : w.bound ? w.bAmp / 2 : w.sinks ? w.amp : 0; }

  /* ---------------- a flight's shape ---------------- */

  function member(F, lag, lat, rank) {
    var r = F.r, S = F.S, m = {
      lag: lag, lat: lat, rank: rank, gain: Math.min(1.5, 1 + 0.1 * rank),
      d: measureBird(drawBird(r, S), F.span * (1 + SIZE_VAR * (r() * 2 - 1)), F.tone),   // its own drawing, its own size
      /* its own drift about its place, its own wing-beat and glide */
      aL: pick(r, DRIFT_L) * F.span * F.loose, aP: pick(r, DRIFT_P) * F.span * F.loose * F.air, bKey: Math.floor(r() * NOISE_N), bT: pick(r, DRIFT_T) * F.loose,   // (a loose flock drifts wider, and as gently)
      f: F.f * (1 + DETUNE * (r() * 2 - 1)), delay: 0, half: (S.bound ? 0.3 : 1) * r(), rest: r(), glide: pick(r, S.glide), bob: 0,
      w: null, stragL: 0, stragT0: 0, stragT: 1, swapT0: 0, swapT: 0, gT: 0, gT0: 0, lx: 0, ly: 0, s: null
    };
    m.w = F.w || wingsOf(F, m);
    return m;
  }
  /* a bird's own bursts and glides (or bounds), after its kind */
  function wingsOf(F, m) {
    if (!F.flaps) return { segs: [], f: m.f, sinks: false, amp: 0, bound: false, bAmp: 0 };   // (soaring: set by the thermal)
    return { segs: bursts(F.r, m.f, F.flaps, -12, 320), f: m.f, sinks: !!F.S.sink && !F.calm, amp: (F.S.sink || 0) * F.span * F.air,
             bound: !!F.S.bound, bAmp: F.S.bound ? pick(F.r, F.S.bound) * F.span : 0 };
  }

  /* the birds of a flight on a lane, in their places behind the leader:
     never where a ruler would put them, and never still in them */
  function formation(F) {
    var r = F.r, n = F.n, sp = F.span, M = [], k, a, b, arm, dx, dy, u, rank, lag, lat, m, bow;
    function jit() { return r() * 2 - 1; }
    M.push(member(F, 0, 0, 0));
    if (F.kind === 'skein') {
      u = r();                                            // echelon, J or V (J's and echelons are the commoner in the wild)
      if (u < 0.3 || n === 2) { a = n - 1; b = 0; }
      else if (u < 0.65 && n >= 4) { a = Math.ceil((n - 1) / 2) + 1; b = n - 1 - a; }
      else { a = Math.ceil((n - 1) / 2); b = n - 1 - a; }
      arm = r() < 0.5 ? 1 : -1;
      dx = pick(r, ARM_X) * sp * (2 - F.flat); dy = pick(r, ARM_Y) * sp * F.flat;   // (a narrow band: a flatter V)
      bow = r() < 0.3;                                    // a U: the ranks near the apex closer in
      u = mix(r(), 0.3, 0.7);                             // the second arm a part of a place behind the first (no V is symmetric)
      for (k = 1; k < n; k++) {
        rank = k <= a ? k : k - a;
        lag = (rank + (k > a ? u : 0)) * dx * (bow ? 0.85 + 0.075 * rank : 1) * (1 + JITTER * jit());
        lat = (k <= a ? arm : -arm) * (rank * dy * (1 + JITTER * jit()) + 0.5 * JITTER * sp * jit());
        M.push(member(F, lag, lat, rank));
      }
    } else if (F.kind === 'line') {
      dx = pick(r, FILE) * sp; lag = 0; lat = 0;
      for (k = 1; k < n; k++) {
        lag += dx * (1 + 1.5 * JITTER * jit());           // uneven gaps ...
        lat += FILE_Y * sp * jit();                       // ... and the line wanders up and down
        m = member(F, lag, lat, k);
        m.gain = Math.min(1.5, 1 + 0.07 * k);
        M.push(m);
      }
    } else if (F.kind === 'pair') {
      m = member(F, pick(r, PAIR_X) * sp, (r() < 0.5 ? 1 : -1) * pick(r, PAIR_Y) * sp, 1);
      m.gain = 1;
      if (!F.still && r() < 0.4) { m.swapT = pick(r, SWAP_T); m.swapT0 = mix(r(), 4, 14); }
      M.push(m);
    } else if (F.kind === 'loose') {
      for (k = 1; k < n; k++) {
        m = member(F, 0, 0, k);
        m.gain = 1;
        for (u = 0; u < 80; u++) {                        // scattered behind and beside the leader, wider than deep
          m.lag = mix(r(), 0.8, 2 * Math.sqrt(n)) * sp;
          m.lat = jit() * 1.15 * Math.sqrt(n) * sp;
          if (fits(F, M, m, u < 40 ? pick(r, LOOSE) * sp - sp : 0)) break;
        }
        M.push(m);
      }
    }
    /* a straggler, now and then: the tail of a skein of five or more, catching up */
    if (F.kind === 'skein' && n >= 5 && !F.still && r() < 0.33) {
      m = M[0];
      for (k = 1; k < M.length; k++) if (M[k].lag > m.lag) m = M[k];
      m.stragT = pick(r, STRAGGLE_T); m.stragL = pick(r, STRAGGLE) * F.v * m.stragT / 1.5; m.stragT0 = mix(r(), 0, 6);   // (1.5: the ease's steepest)
    }
    return M;
  }
  /* now and then a skein crosses as a ragged file that fans out into its V
     (sideways first, then closing up, the front birds first), or a V that
     strings out into a file; a line as a bunch that strings out into single
     file, or the reverse: never through one another */
  function gatherOf(F) {
    var r = F.r, M = F.m, sp = F.span, i, m, tries, u = r(), order, acc, strag;
    if (F.still || F.calm || F.n < 3 || (F.kind !== 'skein' && F.kind !== 'line') || u >= GATHER + LOOSEN) return;
    F.loosen = u >= GATHER;
    strag = M.map(function (m) { var v = m.stragL; m.stragL = 0; return v; });   // (a gathering flight has no straggler: one change at a time)
    F.latFirst = F.kind === 'skein';
    order = M.slice(1).sort(function (a, b) { return a.lag - b.lag; });
    for (tries = 0; tries < 6; tries++) {
      acc = 0;
      for (i = 0; i < order.length; i++) {
        m = order[i];
        if (F.kind === 'skein') {                         // the file: one behind another, a little ragged
          acc += pick(r, FILE_G) * sp;
          m.lx = acc; m.ly = (r() * 2 - 1) * 0.25 * sp;
        } else {                                          // the bunch: closer, and spread either side
          m.lx = m.lag * mix(r(), 0.45, 0.65);
          m.ly = m.lat + (i % 2 ? 1 : -1) * mix(r(), 0.8, 1.2) * sp;
        }
        m.gT0 = i * pick(r, GATHER_AT);                   // the front birds first ...
        m.gT = Math.max(pick(r, GATHER_T), 2.2 * Math.max(Math.abs(m.lag - m.lx), Math.abs(m.lat - m.ly)) / (REL * F.v));   // ... none faster than REL of the flight's speed
      }
      if (order.every(function (m) { return m.gT <= GATHER_MAX; }) && fitsAll(F)) return;
      for (i = 1; i < M.length; i++) { M[i].lag *= 1.1; M[i].lx *= 1.1; }   // (a little more room, and again)
    }
    for (i = 1; i < M.length; i++) { M[i].gT = 0; M[i].lag /= Math.pow(1.1, tries); M[i].stragL = strag[i]; }   // no way keeps them apart: the pattern as it was
  }

  /* a bird's place in its flight (lag behind the leader, lat aside) at
     flight time tau: its slot, or on its way to it from the scatter, a
     straggler catching up, a pair changing sides */
  var sl = {};
  function slotAt(F, m, tau, o) {
    var lag = m.lag, lat = m.lat, q, a, b, e = tau - F.ev0;   // (the events keep the flight's own clock, from ev0)
    if (m.gT) {                                           // on its way between the scatter and its place: one way leads, the other follows
      q = clamp((e - m.gT0) / m.gT, 0, 1);
      if (F.loosen) q = 1 - q;                            // (loosening is gathering played backwards)
      a = ease(q / 0.7); b = ease((q - 0.3) / 0.7);
      lag = m.lx + (lag - m.lx) * (F.latFirst ? b : a); lat = m.ly + (lat - m.ly) * (F.latFirst ? a : b);
    }
    if (m.stragL) lag += m.stragL * (1 - ease((e - m.stragT0) / m.stragT));
    if (m.swapT) {                                        // back a span, across, and up again
      q = ease((e - m.swapT0) / m.swapT);
      lat *= Math.cos(Math.PI * q);
      lag += F.span * Math.sin(Math.PI * q);
    }
    o.lag = lag; o.lat = lat;
    return o;
  }
  /* the moments worth checking a flight's spacing at: before, through and after its events */
  function eventTimes(F) {
    var end = 0, i, m, T = [], e;
    for (i = 0; i < F.m.length; i++) {
      m = F.m[i];
      if (m.gT) end = Math.max(end, m.gT0 + m.gT);
      if (m.stragL) end = Math.max(end, m.stragT0 + m.stragT);
      if (m.swapT) end = Math.max(end, m.swapT0 + m.swapT);
    }
    for (e = -0.5; e <= end + 0.5; e += 0.5) T.push(F.ev0 + e);
    return T;
  }

  /* can bird m join the others in M (in their slots), ink never nearer than SPACE (+ extra)? */
  function fits(F, M, m, extra) {
    for (var i = 0; i < M.length; i++) if (!pairFits(F, M[i], m, M[i].lag, M[i].lat, m.lag, m.lat, extra || 0)) return false;
    return true;
  }
  /* two birds at these places, whatever their drift, the wander, gusts, glides and bounds between them */
  function pairFits(F, a, b, la, ta, lb, tb, extra) {
    var v = F.v, dl = Math.abs(la - lb),
        gx = dl - a.d.hw - b.d.hw - a.aL - b.aL,
        gy = Math.abs(ta - tb) - a.d.hh - b.d.hh - a.aP - b.aP - BOB * Math.max(a.d.span, b.d.span) -
             F.wAmp * (Math.abs(a.gain - b.gain) + 2 * Math.max(a.gain, b.gain) * Math.min(1, TAU * dl / F.wLam)) -
             2 * F.hAmp * Math.min(1, TAU * dl / (v * F.hT)) -
             (a.w === b.w ? liftReach(a) * Math.min(1, dl / (v * 2)) : liftReach(a) + liftReach(b));
    return Math.max(gx, gy) >= SPACE + extra;
  }
  var slA = {}, slB = {};
  function fitsAll(F) {
    var M = F.m, T = eventTimes(F), x, i, j;
    for (x = 0; x < T.length; x++) {
      for (i = 0; i < M.length; i++) {
        slotAt(F, M[i], T[x], slA);
        for (j = i + 1; j < M.length; j++) {
          slotAt(F, M[j], T[x], slB);
          if (!pairFits(F, M[i], M[j], slA.lag, slA.lat, slB.lag, slB.lat, 0)) return false;
        }
      }
    }
    return true;
  }
  /* the whole flight keeps its birds apart: if not, its places are drawn out along the track */
  function spaced(F) {
    var M = F.m, i, tries;
    for (tries = 0; tries < 8; tries++) {
      if (fitsAll(F)) return true;
      for (i = 1; i < M.length; i++) { M[i].lag *= 1.12; M[i].lx *= 1.12; }
    }
    return false;
  }

  /* ---------------- where a bird is: a pure function of the flight's time ---------------- */

  var tmp = {}, tmp2 = {};
  function spot(F, m, tau, o) {
    if (F.soar) return soarSpot(F, m, tau, o);
    slotAt(F, m, tau, sl);
    var lag = sl.lag + m.aL * wave(m.bKey, tau / m.bT),
        lat = sl.lat + m.aP * wave(m.bKey + 53, tau / m.bT / 1.3), s;
    s = F.s0 + F.v * tau - lag;
    along(F.lane, s, o);
    lat += F.wAmp * wave(F.wKey, s / F.wLam) * m.gain;    // the track's wander: every bird flies through it
    o.x -= o.ty * lat; o.y += o.tx * lat;
    o.y += F.hAmp * wave(F.hKey, (tau - lag / F.v) / F.hT) + lift(m, tau);   // a gust reaches each bird as it reaches that air; its wings carry it
    return o;
  }

  /* a soaring bird: the glide in, the thermal (its centre drifting
     downwind), the glide away — joined where their headings meet */
  function glideDist(x, v0, v1) {
    var q = x / EASE_T;
    return v0 * x + (v1 - v0) * (q < 1 ? EASE_T * (q * q * q - q * q * q * q / 2) : EASE_T / 2 + x - EASE_T);
  }
  function soarSpot(F, m, tau, o) {
    var S = F.soar, th, cx, d;
    if (tau < m.tj) {
      d = glideDist(m.tj - tau, m.vj, m.vIn);
      o.x = m.jx - S.dirIn * d; o.y = m.jy;
    } else if (tau < m.tx) {
      th = S.thj + S.om * (tau - m.tj);
      cx = S.cx + S.dirIn * S.drift * (tau - S.tj0);
      o.x = cx + m.R * Math.cos(th); o.y = S.cy + S.k * m.R * Math.sin(th);
    } else {
      d = glideDist(tau - m.tx, m.vx, m.vOut);
      o.x = m.xx + S.dirOut * d * Math.cos(S.descent); o.y = m.xy + d * Math.sin(S.descent);
    }
    return o;
  }

  /* ---------------- planning a flight ---------------- */

  var flights = [], flightNo = 0;
  var r2 = vstream(2), r2k = 0, r2x = r2(), r2y = r2();
  function r2next(o) {                                     // the R2 low-discrepancy sequence: lanes spread evenly over a visit
    r2k++;
    o.x = (r2x + r2k * 0.7548776662466927) % 1;
    o.y = (r2y + r2k * 0.5698402909980532) % 1;
    return o;
  }

  function newFlight(kind, n, dir, r, calm, flat, stillSky) {
    var sort = weighted(r, SORT_OF[kind]), S = SORTS[sort], depth = pick(r, S.depth), F = {
      kind: kind, sort: sort, S: S, n: n, dir: dir, r: r, soar: null, m: null, lane: null, w: null,
      flat: flat ? 0.6 : 1, calm: !!calm, still: !!stillSky, loose: kind === 'loose' ? 1.4 : 1,
      t0: 0, s0: 0, dur: 0, edges: 3, ev0: 0, loosen: false, latFirst: false,
      wKey: Math.floor(r() * NOISE_N), wLam: pick(r, WAVE) * (S.wave || 1),
      wAmp: mix(fBreeze, WANDER[0], WANDER[1]) * (kind === 'line' ? 1.3 : 1) * (S.wander || 1) * pick(r, [0.7, 1.1]),
      hKey: Math.floor(r() * NOISE_N), hT: pick(r, HEAVE_T), hAmp: mix(fBreeze, HEAVE[0], HEAVE[1]) * pick(r, [0.7, 1.1])
    };
    var v, g;
    if (calm) { F.wAmp *= 0.3; F.hAmp *= 0.3; }          // a narrow strip of sky: still air
    F.span = Math.max(SPAN_MIN, SPAN * view * S.size * depth);        // near or far, and its kind's size
    F.tone = mix(ease((depth - 0.6) / 0.6), TONE[0], TONE[1]);        // and the air between
    v = pace * F.span * pick(r, S.pace);                              // in the wild: spans a second, about a span a beat ...
    F.v = clamp(soft(v * calmOf(), topSpeed()), SPEED[0], SPEED[1]); // ... on the page slowed to its calm
    F.f = pick(r, S.hz) * tempo;
    F.flaps = S.flaps && S.flaps[0][0] > 8 && F.v < 0.8 * F.span * F.f ? FLAPS_SLOW : S.flaps;   // held back: it glides between bursts ...
    g = Math.sqrt(clamp(v / F.v, 1, HOLD));                          // ... and every kind glides the longer, the more it is slowed
    if (F.flaps && !S.bound) F.flaps = [F.flaps[0], [F.flaps[1][0] * g, F.flaps[1][1] * g]];   // (not a finch's bound: its wings shut)
    F.air = Math.sqrt(Math.min(1, F.v / v));            // what moves it in seconds (a gust, its drift, a glide's sink) gentled
    F.hAmp *= F.air;                                     // as it is slowed, so its path turns no sharper for the slower pace
    F.climb = (kind === 'single' || kind === 'pair') && (sort === 'gull' || sort === 'crow' || sort === 'swallow') && W >= SOAR_W && r() < 0.22;
    /* a line (and a skein of ibis) beats and glides together, the beat
       passing back down it; every other flight's birds each on their own */
    if (kind === 'line' || (kind === 'skein' && sort === 'ibis'))
      F.w = { segs: bursts(r, F.f, F.flaps, -12, 320), f: F.f, sinks: !!S.sink && !calm, amp: (S.sink || 0) * F.span * F.air, bound: false, bAmp: 0 };
    if (kind === 'soar') return soarFlight(F);
    F.m = formation(F);
    F.d = F.m[0].d;
    if (!spaced(F)) return null;                        // the pattern keeps its birds apart ...
    gatherOf(F);                                          // ... and so does its gathering, if it gathers
    if (F.w) {
      var wd = pick(r, WAVE_DELAY);
      F.m.forEach(function (m) {
        m.delay = kind === 'line' ? m.rank * wd * pick(r, [0.8, 1.2]) : m.lag / F.v;   // down the line; or where the one ahead beat (ibis in V's)
        m.half = 0.15 * r();
      });
    }
    F.probe = probeOf(F);
    reachOf(F);
    return F;
  }
  /* how far a flight reaches above and below its lane on a level crossing
     (its places through its events, their drift, the wander, the gusts,
     the lift of its wings, the ink) */
  function reachOf(F) {
    var lo = 0, hi = 0, i, m, y, b, T = eventTimes(F), x;
    for (i = 0; i < F.m.length; i++) {
      m = F.m[i];
      b = m.aP + F.wAmp * m.gain + m.d.hh + BOB * m.d.span + liftReach(m);
      for (x = 0; x < T.length; x++) {
        y = slotAt(F, m, T[x], sl).lat * F.dir;
        lo = Math.max(lo, -(y - b)); hi = Math.max(hi, y + b);
      }
    }
    F.lo = lo + F.hAmp; F.hi = hi + F.hAmp;
  }
  /* the birds that bound a formation (its leader, its tail, its outermost
     either side, through its events): a lane is tried on these first, then on them all */
  function probeOf(F) {
    var M = F.m, lo = 0, hi = 0, back = 0, i, x, T = eventTimes(F), out = [0], a = [0, 0, 0];
    for (i = 1; i < M.length; i++) for (x = 0; x < T.length; x++) {
      slotAt(F, M[i], T[x], sl);
      if (sl.lat < a[0]) { a[0] = sl.lat; lo = i; }
      if (sl.lat > a[1]) { a[1] = sl.lat; hi = i; }
      if (sl.lag > a[2]) { a[2] = sl.lag; back = i; }
    }
    [lo, hi, back].forEach(function (k) { if (out.indexOf(k) < 0) out.push(k); });
    return out;
  }

  /* a lane through a point of open sky, entering and leaving beyond the window */
  function laneThrough(F, qx, qy, a) {
    var ux = F.dir * Math.cos(a), uy = Math.sin(a), tin = reach(qx, qy, -ux, -uy), tout = reach(qx, qy, ux, uy),
        x0 = qx - ux * tin, y0 = qy - uy * tin, x3 = qx + ux * tout, y3 = qy + uy * tout,
        nx = -uy, ny = ux, sgn, b, h1, h2;
    /* bowed in toward the words (the lane curves in, and on past them), or now and then a gentle S */
    sgn = ((wordsY - qy) * ny >= 0 ? 1 : -1);
    b = F.r() * mix(fBreeze, BOW[0], BOW[1]) * W * (F.S.bow || 1);
    h1 = sgn * b / 0.75; h2 = F.r() < (F.S.bow ? 0.4 : 0.2) ? -0.6 * h1 : h1;
    F.lane = lane([x0, y0, x0 + (x3 - x0) / 3 + nx * h1, y0 + (y3 - y0) / 3 + ny * h1,
                   x0 + 2 * (x3 - x0) / 3 + nx * h2, y0 + 2 * (y3 - y0) / 3 + ny * h2, x3, y3]);
    F.edges = side(x0, y0) | side(x3, y3);
  }
  /* how far from (x, y) along (ux, uy) to OUT beyond the window */
  function reach(x, y, ux, uy) {
    var t = Infinity;
    if (ux > 1e-9) t = Math.min(t, (W + OUT - x) / ux); else if (ux < -1e-9) t = Math.min(t, (-OUT - x) / ux);
    if (uy > 1e-9) t = Math.min(t, (H + OUT - y) / uy); else if (uy < -1e-9) t = Math.min(t, (-OUT - y) / uy);
    return t;
  }
  function side(x, y) {
    return (x <= -OUT + 1 ? 1 : 0) | (x >= W + OUT - 1 ? 2 : 0) | (y <= -OUT + 1 ? 4 : 0) | (y >= H + OUT - 1 ? 8 : 0);
  }

  /* the soaring birds' flight: which way in, where the thermal is, which way out */
  function soarFlight(F) {
    var r = F.r, S, R, T, i, m, M = [], n = F.n, top = topSpeed();
    R = clamp(38 + 0.05 * W, SOAR_R[0], SOAR_R[1]) * pick(r, [0.9, 1.1]);
    T = pick(r, LAP);
    if (TAU * R / T > top) R = top * T / TAU;
    S = F.soar = {
      R: R, k: pick(r, SOAR_K), om: (r() < 0.5 ? 1 : -1) * TAU / T, T: T, drift: pick(r, WIND),
      laps: Math.round(pick(r, LAPS)), dirIn: F.dir, dirOut: r() < 0.55 ? F.dir : -F.dir,
      descent: pick(r, DESCENT), cx: 0, cy: 0, tj0: 0, thj: 0, thx: 0, top: top
    };
    S.sense = S.om > 0 ? 1 : -1;
    S.thj = S.dirIn === S.sense ? -Math.PI / 2 : Math.PI / 2;    // the top of the circle, or the bottom: where it runs the way the bird comes in
    S.thx = S.dirOut === S.sense ? -Math.PI / 2 : Math.PI / 2;   // ... and where it runs the way the bird will leave
    for (i = 0; i < n; i++) {
      m = member(F, 0, 0, i);
      m.R = R * (i === 1 ? 0.88 : i === 2 ? 1.1 : 1);
      m.gap = i ? (i * T / n) * pick(r, [0.94, 1.06]) : 0;       // they join the thermal a share of a lap apart ...
      M.push(m);                                                 // ... and hold their wings out, but for a few beats
    }
    F.m = M;
    F.d = M[0].d;
    F.edges = 3;
    F.probe = M.map(function (m, i) { return i; });
    F.lo = 0;
    for (i = 0; i < n; i++) F.lo = Math.max(F.lo, S.k * M[i].R + M[i].d.hh + BOB * M[i].d.span);
    F.hi = F.lo;
    return F;
  }
  /* put a soaring flight's thermal at (cx, cy) and time its birds' glides, laps and leaving */
  function soarTimes(F, cx, cy) {
    var S = F.soar, M = F.m, i, m, entry, d, lo, hi, mid, turn, exit;
    S.cx = cx; S.cy = cy;
    entry = S.dirIn > 0 ? -OUT : W + OUT;
    exit = S.dirOut > 0 ? W + OUT : -OUT;
    turn = ((S.thx - S.thj) * S.sense % TAU + TAU) % TAU;
    for (i = 0, lo = hi = S.top; i < M.length; i++) {
      m = M[i];
      m.vj = Math.abs(S.om) * m.R + S.drift;                   // at the join: the circle's speed and the drift together
      m.vx = Math.abs(S.om) * m.R + S.dirIn * S.dirOut * S.drift;
      lo = Math.min(lo, GLIDE_V * m.vj); hi = Math.min(hi, GLIDE_V * m.vx);
    }
    for (i = 0; i < M.length; i++) { M[i].vIn = lo; M[i].vOut = hi; }   // all glide in and away at one pace: one by one, none catching another
    /* the first bird enters from beyond the edge at the start: how long its glide in takes */
    m = M[0];
    d = Math.abs(cx + m.R * Math.cos(S.thj) - entry);
    lo = 0; hi = 600;
    while (hi - lo > 0.01) { mid = (lo + hi) / 2; if (glideDist(mid, m.vj, m.vIn) < d) lo = mid; else hi = mid; }
    S.tj0 = lo;
    for (i = 0; i < M.length; i++) {
      m = M[i];
      m.tj = S.tj0 + m.gap;
      m.jx = cx + S.dirIn * S.drift * (m.tj - S.tj0) + m.R * Math.cos(S.thj);
      m.jy = cy + S.k * m.R * Math.sin(S.thj);
      m.tx = m.tj + (S.laps * TAU + turn) / Math.abs(S.om);
      m.xx = cx + S.dirIn * S.drift * (m.tx - S.tj0) + m.R * Math.cos(S.thx);
      m.xy = cy + S.k * m.R * Math.sin(S.thx);
      m.w.segs = [m.tj - 6, m.tj - 6 + 4 / m.f, m.tx + 0.5, m.tx + 0.5 + 4 / m.f];   // a few beats reaching the thermal, a few leaving it
      m.delay = 0;
      lo = 0; hi = 600;
      d = Math.abs(exit - m.xx) + m.d.hw;
      while (hi - lo > 0.05) { mid = (lo + hi) / 2; if (glideDist(mid, m.vx, m.vOut) * Math.cos(S.descent) < d) lo = mid; else hi = mid; }
      m.done = m.tx + hi;
    }
    F.dur = 0;
    for (i = 0; i < M.length; i++) F.dur = Math.max(F.dur, M[i].done);
    F.edges = (S.dirIn > 0 ? 1 : 2) | (S.dirOut > 0 ? 2 : 1);
  }

  /* where the other flights' birds will be at step k from sky time A.t1:
     worked out when a trial first needs it, and kept for the job's other lanes */
  function aheadRow(A, k) {
    var row = A.rows[k], i, j, G, tau;
    if (row) return row;
    row = A.rows[k] = [];
    for (i = 0; i < flights.length; i++) {
      G = flights[i];
      tau = A.t1 + k * STEP - G.t0;
      if (tau > G.dur) continue;
      for (j = 0; j < G.m.length; j++) {
        spot(G, G.m[j], tau, tmp2);
        A.cost++;
        if (inView(tmp2.x, tmp2.y, G.m[j].d.hw, G.m[j].d.hh)) row.push(tmp2.x, tmp2.y, G.m[j].d.hw, G.m[j].d.hh);
      }
    }
    return row;
  }

  /* fly a planned flight forward in thought, from flight time it.from to its
     end: every bird (only its bounding birds, on the probe pass) clear of
     the words, inside the edges it does not cross, and APART from the other
     flights. Worked in slices of `budget` bird-steps: 0 while unfinished,
     1 when clear all the way (it.near its room: the more, the calmer), -1 */
  function trialRun(F, it, A, budget) {
    var M = F.m, probe = it.probe ? F.probe : null, cnt = probe ? probe.length : M.length,
        c0 = A ? A.cost : 0, i, j, m, row, g, gx, gy, e, tau, hw, hh;
    it.spent = 0;
    for (;;) {
      tau = it.from + it.k * STEP;
      if (tau > F.dur) return 1;
      if (it.spent >= budget) return 0;
      row = A && A.t1 + it.k * STEP <= A.until ? aheadRow(A, it.k) : null;
      for (i = 0; i < cnt; i++) {
        m = M[probe ? probe[i] : i];
        spot(F, m, tau, tmp);
        if (tmp.x !== tmp.x || tmp.y !== tmp.y) return -1;
        hw = m.d.hw; hh = m.d.hh + BOB * m.d.span;        // its ink, and the room its bob takes
        e = F.soar && tau >= m.tj && tau < m.tx ? 0 : F.edges;   // a soaring bird circles wholly inside the window
        if (!inView(tmp.x, tmp.y, hw, hh)) { if (!e) return -1; continue; }
        if (!clearOfWords(tmp.x, tmp.y, hw, hh) || !withinEdges(tmp.x, tmp.y, hw, hh, e)) return -1;
        it.near = Math.min(it.near, room(tmp.x, tmp.y, hw, hh, e));
        it.yLo = Math.min(it.yLo, tmp.y - hh); it.yHi = Math.max(it.yHi, tmp.y + hh);   // the band it flies in
        if (row) for (j = 0; j < row.length; j += 4) {
          gx = Math.abs(tmp.x - row[j]) - hw - row[j + 2];
          gy = Math.abs(tmp.y - row[j + 1]) - hh - row[j + 3];
          g = Math.max(gx, gy);
          if (g < APART) return -1;
          it.apart = Math.min(it.apart, g);
        }
      }
      it.k++;
      it.spent += cnt + (A ? A.cost - c0 : 0);
      c0 = A ? A.cost : 0;
    }
  }
  function trialIt(from, probe) { return { from: from, k: 0, near: ROOMY, apart: 200, probe: probe, spent: 0, yLo: Infinity, yHi: -Infinity }; }
  /* the whole trial at once (a flight re-checked after the page moved) */
  function trial(F, from) {
    var it = trialIt(from, false);
    return trialRun(F, it, null, Infinity) > 0 ? it.near : -1;
  }

  /* how far along its lane a flight is when its first bird comes into view */
  function entering(F) {
    for (var s = 0; s < F.lane.len; s += 4) {
      along(F.lane, s, tmp);
      if (inView(tmp.x, tmp.y, F.d.hw, F.d.hh)) return s;
    }
    return 0;
  }
  function seen(F, tau) {
    for (var i = 0; i < F.m.length; i++) { spot(F, F.m[i], tau, tmp); if (inView(tmp.x, tmp.y, F.m[i].d.hw, F.m[i].d.hh)) return true; }
    return false;
  }
  function allInView(F, tau) {
    for (var i = 0, d; i < F.m.length; i++) {
      spot(F, F.m[i], tau, tmp); d = F.m[i].d;
      if (tmp.x - d.hw < 0 || tmp.x + d.hw > W || tmp.y - d.hh < 0 || tmp.y + d.hh > H) return false;
    }
    return true;
  }
  /* the flight's events (a scatter gathering, a straggler, a pair changing
     sides) begin a little after its leader comes into view */
  function placeEvents(F) {
    var span = Math.max(1, (F.lane.len - 2 * OUT) / F.v), start = (OUT - F.s0) / F.v;
    F.ev0 = F.still ? -1e4 : start + span * mix(F.r(), 0.08, 0.25);
  }
  function snapshot(F, from) {
    return { lane: F.lane, s0: F.s0, dur: F.dur, edges: F.edges, from: from, ev0: F.ev0,
             soar: F.soar ? JSON.parse(JSON.stringify(F.soar)) : null,
             m: F.m.map(function (m) {
               var c = {}, k;
               for (k in m) if (k !== 'w' && k !== 's' && k !== 'd') c[k] = m[k];
               if (F.soar) c.w = { segs: m.w.segs.slice(), f: m.w.f, sinks: m.w.sinks, amp: m.w.amp, bound: m.w.bound, bAmp: m.w.bAmp };
               return c;
             }) };
  }
  function restore(F, k) {
    F.lane = k.lane; F.s0 = k.s0; F.dur = k.dur; F.edges = k.edges; F.from = k.from; F.ev0 = k.ev0; F.yLo = k.yLo; F.yHi = k.yHi;
    if (k.soar) F.soar = k.soar;
    F.m.forEach(function (m, i) { var c = k.m[i], p; for (p in c) m[p] = c[p]; });
  }

  /* how many birds: 1-9 by COUNT (a lively visit leaning larger), never
     four, and never making four with any of the flights in the sky (so
     none can leave four behind when it goes) */
  function makesFour(n, counts) {
    var sums = [0], i, j;
    for (i = 0; i < counts.length; i++) for (j = sums.length - 1; j >= 0; j--) sums.push(sums[j] + counts[i]);
    for (i = 0; i < sums.length; i++) if (n + sums[i] === 4) return true;
    return false;
  }
  function drawCount(r, free, counts) {
    var tries, u, n, acc, i, tot, w = [];
    for (i = 0, tot = 0; i < COUNT.length; i++) { w.push(COUNT[i] * (1 + 0.5 * (fTraffic - 0.5) * (i - 3) / 4)); tot += w[i]; }
    for (tries = 0; tries < 12; tries++) {
      u = r() * tot; acc = 0; n = 1;
      for (i = 0; i < w.length; i++) { acc += w[i]; if (u < acc) { n = i + 1; break; } }
      n = Math.min(n, free);
      if (!makesFour(n, counts)) return n;
    }
    return makesFour(1, counts) ? 0 : 1;
  }
  function drawKind(r, n) {
    var u = r(), wide = W >= SOAR_W;
    if (n === 1) return wide && u < 0.25 ? 'soar' : 'single';
    if (n === 2) return wide && u < 0.15 ? 'soar' : 'pair';
    if (n === 3 && wide && u < 0.1) return 'soar';
    if (u < 0.55) return 'skein';                         // V's, J's and echelons: the flight everyone knows
    if (u < 0.8 || n > 6) return 'line';
    return 'loose';
  }

  /* ---------------- launching: a flight is planned a few lanes a frame ---------------- */

  var job = null, q = {};

  /* a new flight: mode 'first' (it enters soon after load), 'next' (the
     scheduler's), 'still' (the composed still sky) */
  function startJob(mode) {
    var r = vstream(100 + flightNo++), counts = [], free = freeSlots(), n, kind, dir, order, i;
    for (i = 0; i < flights.length; i++) counts.push(flights[i].m.length);
    if (free < 1) return false;
    n = drawCount(r, free, counts);
    if (!n) return false;
    kind = mode === 'still' ? (n >= 3 ? 'skein' : n === 2 ? 'pair' : 'single') : drawKind(r, n);
    dir = r() < faithful ? season : -season;              // most flights go the season's way; now and then one the other
    /* if the pattern finds no room: a flatter V, then a smaller one, then
       the same birds in a line, then fewer, then one; and last, in a narrow
       strip of sky, in still air */
    order = [[kind, n]];
    if (kind === 'soar') order.push([n === 1 ? 'single' : n === 2 ? 'pair' : 'skein', n]);
    if (n >= 3 && kind !== 'line') {
      order.push(['skein', n, 0, 1]);
      for (i = n - 2; i >= 3; i -= 2) order.push(['skein', i === 4 ? 3 : i, 0, 1]);
      order.push(['line', n]);
    }
    if (n >= 5) order.push(['line', n - 2 === 4 ? 3 : n - 2]);
    if (n >= 2) order.push(['single', 1]);
    if (n >= 3) order.push(['line', Math.min(n, 5) === 4 ? 3 : Math.min(n, 5), 1]);
    order.push(['single', 1, 1]);
    job = { mode: mode, r: r, order: order, oi: 0, counts: counts, dir: dir, F: null };
    resetJob();
    return true;
  }
  /* (and again after the page moved: what was tried was tried on the old page) */
  function resetJob() {
    var i, h = 0;
    for (i = 0; i < flights.length; i++) h = Math.max(h, flights[i].dur - (t - flights[i].t0));
    job.t = t + (job.mode === 'next' ? LEAD : 0);           // when the flight sets off
    job.c = 0; job.a = 0; job.best = -1; job.keep = null; job.it = null; job.bands = null;
    job.ahead = job.mode !== 'still' && flights.length ? { t1: job.t, until: t + h, rows: [], cost: 0 } : null;
  }

  /* a lane (or a thermal) for the job's flight; true if it is worth a trial */
  function propose(J) {
    var F = J.F, a, qx, qy, lap = 0;
    J.a++;
    r2next(q);
    J.diag = false;
    if (!J.bands) J.bands = openBands(F.lo, F.hi);
    if (F.soar) {
      qy = inBands(J.bands, q.y);
      if (qy === null) { J.a = 3 * TRIES; return false; } // no band holds the thermal
      soarTimes(F, mix(q.x, 0.08, 0.92) * W, qy);
    } else {
      J.climb = F.climb && J.mode !== 'still' && J.a <= TRIES / 2;    // climbing away or coming down, if it finds room
      J.diag = J.climb || (J.a > TRIES / 2 && J.best < 0) || !J.bands.length;   // no level crossing fits: try the steeper lanes
      qx = q.x * W;
      qy = J.diag ? mix(q.y, 0.04, 0.96) * H : inBands(J.bands, q.y);   // a level crossing: its centre in an open band
      if (!clearOfWords(qx, qy, F.d.hw, F.d.hh)) return false;   // through the words: not a lane
      a = J.diag ? (F.r() < 0.5 ? 1 : -1) * pick(F.r, J.climb ? CLIMB : DIAG) : (F.r() * 2 - 1) * F.S.tilt * DEG;
      laneThrough(F, qx, qy, a);
      if (!J.diag && F.edges !== 3) return false;         // a level crossing enters and leaves by the sides
      F.m.forEach(function (m) { lap = Math.max(lap, Math.max(m.lag, m.lx) + m.stragL + F.span); });
      F.s0 = 0;
      if (J.mode === 'first') F.s0 = entering(F) - F.v * pick(F.r, FIRST);        // the leader enters within a second or two
      else if (J.mode === 'still') F.s0 = (entering(F) + F.lane.len - OUT + lap) / 2;   // composed across the middle of the sky
      F.dur = (F.lane.len + lap - F.s0) / F.v;
      placeEvents(F);
    }
    J.c++;
    J.it = trialIt(0, F.probe.length < F.m.length);
    return true;
  }
  /* a trial passed: keep the roomiest lane */
  function judge(J) {
    var F = J.F, sc = J.it.near, i, G;
    if (J.mode === 'still' && !allInView(F, 0)) return;
    if (F.soar && sc < 40) return;                        // a thermal only in a roomy field: in a narrow band a circle looks trapped
    for (i = 0; i < flights.length; i++) {                // one flight to a band: two in one band read as one long train
      G = flights[i];
      if (J.it.yLo < G.yHi + BAND_GAP && J.it.yHi > G.yLo - BAND_GAP) return;
    }
    sc += 0.25 * J.it.apart + (J.diag && !J.climb ? 0 : 40) + 8 * F.r();
    if (sc > J.best) { J.best = sc; J.keep = snapshot(F, 0); J.keep.yLo = J.it.yLo; J.keep.yHi = J.it.yHi; }
  }

  /* work on the job, `quota` bird-steps' worth; the flight once it is in the
     sky, else null (and job null too when nothing found room) */
  function workJob(quota) {
    var J = job, o, F, res;
    while (job === J && quota > 0) {
      if (!J.F) {
        if (J.oi >= J.order.length) { job = null; return null; }
        o = J.order[J.oi++];
        if (makesFour(o[1], J.counts) || o[1] > freeSlots()) continue;
        J.F = newFlight(o[0], o[1], J.dir, J.r, o[2], o[3], J.mode === 'still');
        J.c = 0; J.a = 0; J.best = -1; J.keep = null; J.it = null; J.bands = null;
        return null;                                      // (drawing a flight is a frame's work: its lanes are tried from the next)
      }
      if (!J.it) {
        if (J.c >= (J.mode === 'first' || J.oi > 1 ? TRIES / 2 : TRIES) || J.a >= 3 * TRIES) {   // (the first flight, and a second choice, in fewer tries)
          if (J.keep) {
            F = J.F; restore(F, J.keep); job = null;
            if (J.mode === 'next' && t > J.t && seen(F, t - J.t)) return null;   // planning overran and it would appear mid-sky: not this one
            commit(F, J.mode === 'first' ? t : J.t);
            return F;
          }
          J.F = null;
          continue;
        }
        quota -= 2;
        propose(J);
        continue;
      }
      res = trialRun(J.F, J.it, J.ahead, quota);
      quota -= J.it.spent + 1;
      if (res === 0) return null;                         // on with it next frame
      if (res > 0 && J.it.probe) { J.it = trialIt(0, false); J.it.near = ROOMY; continue; }   // the bounding birds cleared it: now all of them
      if (res > 0) judge(J);
      J.it = null;
    }
    return null;
  }

  function commit(F, t1) {
    var i, j;
    F.t0 = t1 - F.from;
    for (i = 0, j = 0; i < slots.length && j < F.m.length; i++) {
      if (slots[i].busy) continue;
      slots[i].busy = true;
      F.m[j].s = slots[i];
      dress(slots[i], F.m[j].d);
      j++;
    }
    flights.push(F);
  }

  function land(F) {
    F.m.forEach(function (m) { if (m.s) { hide(m.s); m.s.busy = false; m.s = null; } });
    var k = flights.indexOf(F);
    if (k >= 0) flights.splice(k, 1);
  }
  function clearSky() { while (flights.length) land(flights[0]); }

  /* ---------------- drawing ---------------- */

  function show(s) { if (!s.on) { s.on = true; s.el.classList.add('on'); } }
  function hide(s) { if (s.on) { s.on = false; s.el.classList.remove('on'); } }

  /* the drawing, on the hand's frames only: facing, wings, bob, tremor.
     Through a beat the wrists swing down across the bird's own line and
     back up, the body lifting on the downstroke; a gliding bird holds its
     wrists a little raised, each at its own set; a bounding finch between
     bursts folds its wings shut. A still sky is a photograph: every bird
     caught at its own point in the beat */
  function pose(F, m, tau, boil, rest) {
    var s = m.s, d = s.d, i, j, c, k, out = [], jit = rest ? 0 : hand, ph = rest ? m.rest : beat(m, tau);
    if (ph >= 0) { k = wrists(ph); m.bob = rest ? 0 : -BOB * d.span * (WRIST[0] - k) / (WRIST[0] - WRIST[1]); }
    else { k = ph === -2 ? 0.15 : m.glide; m.bob = 0; }   // (a glide: the wrists at its own set; a bound: shut)
    spot(F, m, tau + 0.25, tmp2);                          // the way it is going
    c = tmp2.x - m.x;
    c = c / (Math.sqrt(c * c + (tmp2.y - m.y) * (tmp2.y - m.y)) || 1);
    if (s.face > 0 && c < -FACE_HYST) s.face = -1;        // turn to face left (mirrored)
    else if (s.face < 0 && c > FACE_HYST) s.face = 1;     // face right (as drawn)
    shape(d.B, k, ph === -2, SH);
    for (i = 0; i < 5; i++) {
      j = s.key + i * 7 + boil * 131;
      out.push(((SH[2 * i] - d.x0) * d.sc + PAD + nz(j) * jit).toFixed(2) + ',' +
               ((SH[2 * i + 1] - d.y0) * d.sc + PAD + nz(j + 61) * jit).toFixed(2));
    }
    s.line.setAttribute('points', out.join(' '));
  }
  function put(m) {
    var s = m.s;
    s.el.style.transform = 'translate3d(' + (m.x - s.d.w / 2).toFixed(2) + 'px,' + (m.y + m.bob - s.d.h / 2).toFixed(2) + 'px,0)' +
      (s.face < 0 ? ' scaleX(-1)' : '');
  }

  /* every bird where it is now, gliding smoothly; drawn afresh on the hand's frames */
  function draw(fresh, boil, rest) {
    var i, j, F, m, tau;
    for (i = flights.length - 1; i >= 0; i--) {
      F = flights[i]; tau = t - F.t0;
      if (tau > F.dur) { land(F); continue; }
      for (j = 0; j < F.m.length; j++) {
        m = F.m[j];
        spot(F, m, tau, tmp);
        m.x = tmp.x; m.y = tmp.y;
        if (!inView(m.x, m.y, m.d.hw, m.d.hh)) { hide(m.s); continue; }
        if (!m.s.on || fresh) {
          if (!m.s.on) { spot(F, m, tau + 0.25, tmp2); m.s.face = tmp2.x < m.x ? -1 : 1; }
          pose(F, m, tau, boil, rest);
        }
        show(m.s);
        put(m);
      }
    }
  }

  /* ---------------- the sky's clock (the page's own time; no clock is read) ---------------- */

  var raf = 0, last = 0, t = 0, phase = -1, tNext = 0, misses = 0, stills = 0;

  /* how long a flight is in view, near enough */
  function inViewFor(F) { return Math.max(4, F.dur - F.from - 2 * OUT / (F.v || SPEED[1])); }
  function gapAfter(F) {
    return inViewFor(F) * pick(F.r, GAP) * (1 + Math.min(THIN_MAX, t / THIN)) * (1.1 - 0.2 * fTraffic);
  }
  /* a job is done: when the next flight comes */
  function planned(F, mode) {
    if (mode === 'still') {                               // the still sky: a second flight on a wide one
      draw(true, 0, true);
      if (F && ++stills < (W >= WIDE ? 2 : 1) && startJob('still')) run();
      return;
    }
    if (F) { misses = 0; tNext = t + (mode === 'first' ? pick(F.r, [0.12, 0.25]) * inViewFor(F) : gapAfter(F)); }   // the second a few seconds after the first
    else { misses++; tNext = t + Math.min(2 * RETRY, RETRY * misses); }   // no room (the bands are taken): look again a little later
  }

  function frame(now) {
    raf = 0;
    var moving = !still.matches, dt = last ? Math.min(STEP_MAX, (now - last) / 1000) : 0, k, F, mode;
    last = now;
    if (moving) t += dt;
    if (dirty) relayout();
    if (!job && moving && t >= tNext && flights.length < maxFlights() && !startJob('next')) planned(null, 'next');
    if (job) {
      mode = job.mode;
      F = workJob(mode === 'first' ? 2 * QUOTA : QUOTA);
      if (F || !job) planned(F, moving ? mode : 'still');
    }
    if (moving) {
      k = Math.floor(t * DRAW_FPS);                       // the hand's drawing, 12 a second ...
      draw(k !== phase, Math.floor(t * BOIL_FPS), false); // ... its tremor re-rolled every other one
      phase = k;
    }
    run();
  }

  function run() {
    if (raf || (still.matches && !job)) return;
    raf = window.requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0; last = 0;
  }

  /* the window resized or the words moved (on a phone, the browser's bar
     coming and going as the page loads): a new sky if the window changed
     shape; otherwise every flight still clear of the words (by half its
     margin) flies on, and a flight the words have moved onto goes; and its
     place is not kept waiting: into a sky left empty the next flight comes
     as the first did, within a second or two, never a long empty spell */
  function relayout() {
    var w0 = W, h0 = H, gone = 0, i, F;
    measure();
    if (W !== w0 || Math.abs(H - h0) > 120) { begin(); return; }
    held = 0.5;
    for (i = flights.length - 1; i >= 0; i--) {
      F = flights[i];
      if (trial(F, t - F.t0) < 0) { land(F); gone++; }
    }
    held = 1;
    if (gone && !flights.length) { job = null; stills = 0; if (!startJob(still.matches ? 'still' : 'first')) tNext = t; }
    else if (gone) tNext = Math.min(tNext, t);
    if (job) resetJob();
  }
  function begin() {
    clearSky();
    job = null; stills = 0;
    startJob(still.matches ? 'still' : 'first');
    run();
  }
  function onLayout() {
    dirty = true;
    if (still.matches) { relayout(); if (!job) draw(true, 0, true); }
    run();
  }

  measure();
  begin();

  window.addEventListener('resize', onLayout);
  window.addEventListener('scroll', onLayout, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onLayout);

  function onPref() {
    if (still.matches) { stop(); if (!job) draw(true, 0, true); }
    else if (!flights.length && !job) begin();
    run();
  }
  if (still.addEventListener) still.addEventListener('change', onPref);
  else if (still.addListener) still.addListener(onPref);
})();
