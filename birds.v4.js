/* Birds — a sky.

   The owner, verbatim: "The page should be a sky so like they're flying
   across/in patterns/etc. it should feel calm - not bouncing off the
   walls." ... "should b rand". And, of v3's slow, rigid rows: "Are you
   sure this is how birds movement is flying?!"

   THE SKY. Birds cross the window as birds cross a sky: every flight
   enters from beyond one edge, already flying (Samara's 1 s fade-in
   softening the entry), crosses on one long, gentle lane, and leaves
   beyond the far edge. Nothing starts, stops, loops or turns back in
   view. A lane is planned whole before its first bird enters: clear of
   the name, bio and credit and of the footer links for the whole
   crossing, clear of every other flight, one flight to a band.

   THE WINGS (what makes a mark read as a bird). Birds beat their wings,
   visibly and on and on: 2-3 beats a second (gulls, crows and geese beat
   ~3 in life), the bigger bird the slower, each bird at its own rate and
   its own point in the beat, never in lockstep. The hand draws each mark
   12 times a second (on twos): through a beat the front riser, the wing,
   swings down past the body line and up again (WINGS) while the body and
   tail hold still, and the body lifts a little on every downstroke. Each
   kind keeps its own rhythm: geese beat on with a short glide now and
   then; ibis and pelicans beat and glide, the glide passing back down the
   line; gulls and crows flap, flap, glide; soaring birds hold their wings
   out but for a few beats.

   THE PATTERNS (field data: Portugal 2014 and Voelkl 2015 on ibis,
   Hainsworth and Cutts & Speakman on geese, Nagy 2018 and Weinzierl 2016
   on storks in thermals), none of them ruled: V's, J's and echelons,
   wandering lines, pairs, loose flocks and loners, every slot off where a
   ruler would put it, every bird swaying about its slot and a little its
   own size; on a wide sky, soaring birds circling a drifting thermal. How
   many birds, which pattern, where: all random, from the visit's weather
   (1-9 birds a flight, and never four).

   THE PACE (=calm): a bird is carried about its own length and a half a
   second (16-31 px/s; nearer = larger = faster). At most two flights at
   once, never two in one band; a bird or pair flying against the season
   comes only into an empty sky; the sky empties between flights and thins
   over a long visit.

   THE HAND: the three tattoo glyphs (GLYPHS — Derek's tattoo trio, the
   alphabet; do not restyle them) in 1.9 px round strokes, never rotated;
   the BOIL, every vertex re-jittered BOIL_FPS times a second by the
   visit's hand. The drawing changes only on the hand's frames (wings,
   bob, tremor, facing) while the bird glides smoothly between them.

   THE WEATHER (=rand()): ONE crypto draw at init, above INIT-END, and no
   clock at all; it seeds splitmix32 streams: the front and its facets
   (hand, tempo, breeze, pace, traffic: a still visit is still
   everywhere), the season (the way most flights go today) and every
   flight's own stream. There is no other randomness.

   prefers-reduced-motion: a still sky, a photograph: one flight in the
   roomiest open field, every bird caught at its own point in the beat,
   the hand at rest (live, both ways). A hidden tab pauses with
   requestAnimationFrame; a step is capped at STEP_MAX. No DOM is built:
   the twelve SVGs are in index.html; this draws their strokes and moves
   them. */
(function () {
  'use strict';

  var els = Array.prototype.slice.call(document.querySelectorAll('.bird'));
  if (!els.length || !window.requestAnimationFrame || !window.matchMedia) return;

  var DEG = Math.PI / 180, TAU = 2 * Math.PI;

  /* ---------------- constants ---------------- */

  /* the hand */
  var SCALE = 1.2;             // glyph units to css px, at mid depth
  var LINE = 1.9;              // stroke width, css px
  var PAD = 3;                 // px around the glyph: the stroke's cap and the boil
  var DRAW_FPS = 12;           // the hand draws each mark afresh this often (on twos): wings, bob, facing ...
  var BOIL_FPS = 6;            // ... its tremor re-rolled every other drawing
  var HAND = [1.2, 1.6];       // px: the visit's tremor ...
  var JSCALE = 0.4;            // ... trimmed for a small mark in flight
  var BOB = 0.05;              // spans: the body rises this much on each downstroke and sinks on the upstroke
  var FACE_HYST = 0.2;         // |cos heading| past this before a bird turns to face the other way

  /* the sky */
  var OUT = 70;                // px beyond the window where a lane begins and ends
  var WORDS = 24;              // px of sky kept clear round the words (the name, bio and credit) ...
  var LINKS = 20;              // ... and round the footer links
  var ROOMY = 60;              // px: a lane this far from the words and the window's edges is as good as any
  var EDGE = 10;               // px kept from each edge of the window a flight does not cross
  var APART = 48;              // px kept between two flights, always
  var FLIGHTS = 2;             // flights in the sky at once, at most
  var STEP = 0.3;              // s: the planner's look-ahead step (a lane is checked whole before a bird enters)
  var TRIES = 16;              // lanes tried per flight
  var QUOTA = 500;             // bird-steps of look-ahead a frame: planning is spread over frames, never a long one ...
  var LEAD = 4;                // s: ... so a flight is planned to set off this far ahead (still beyond the edge)
  var STEP_MAX = 0.05;         // s: the longest step a frame may take

  /* the pace */
  var PACE = [1.2, 1.5];       // spans a second, by the visit's pace: a bird is carried about its own length and a half a second
  var SPEED = [16, 31];        // px/s: never slower, never faster (with sway and gusts, under ~35)
  var BEAT_HZ = [2.1, 3.1];    // wing-beats a second (gull, crow, goose: 2.9-3.8 in life), the bigger bird the slower ...
  var BEAT_REF = 2.6;          // ... this at a 20 px span
  var DETUNE = 0.06;           // each bird beats its own share faster or slower than its flight (never in lockstep)
  var GAP = [0.35, 0.8];       // the next flight comes after this share of the last one's crossing in view ...
  var THIN = 360;              // s: ... and the sky thins, the gaps a crossing longer for every THIN s on the page ...
  var THIN_MAX = 2;            // ... up to this many crossings longer
  var FIRST = [0.5, 1.5];      // s: the first flight's leader enters this soon after it is planned (on load) ...
  var RETRY = 3;               // s: no room for a flight now: look again this much later

  /* the lanes */
  var TILT = 3.5 * DEG;        // a crossing's slope, at most (cruising birds hold within 3°)
  var DIAG = [20 * DEG, 60 * DEG];   // steeper lanes, tried only when no level crossing fits (a narrow landscape sky)
  var BOW = [0.015, 0.05];     // a lane's bow, as a share of the window's width, by the breeze: in toward the words
  var WANDER = [3, 7];         // px: the track's slow wander, by the breeze, which every bird of a flight flies through ...
  var WAVE = [260, 480];       // px: ... its wavelength
  var HEAVE = [2, 5];          // px: a gust lifting or dropping the whole flight, by the breeze ...
  var HEAVE_T = [10, 16];      // s: ... this slowly (a gentle heave, never a jolt: its turn stays under ~5°/s)
  var SINK = 5;                // px: a bird sinks this far on a long glide and climbs back on its beats

  /* the patterns */
  var COUNT = [11, 19, 22, 0, 18, 5, 14, 4, 7];   // % of flights of 1, 2 ... 9 birds (never four)
  var ARM_X = [1.6, 2.0];      // spans back, per place along an arm of a V, a J or an echelon
  var ARM_Y = [0.95, 1.15];    // spans aside, per place (an arm's spread reads as height on the page)
  var JITTER = 0.2;            // no slot is where a ruler would put it: each is off by up to this share
  var FILE = [1.7, 2.3];       // spans between birds in a line ...
  var FILE_Y = 0.55;           // ... the line wandering up or down by up to this many spans a bird
  var PAIR_X = [0.9, 1.4], PAIR_Y = [0.95, 1.2];  // spans: the second of a pair, behind and aside
  var LOOSE = [1.5, 2.6];      // spans: a loose flock's spacing
  var SWAY_A = 0.2, SWAY_L = 0.14;   // spans: every bird drifts about its slot, forward and back, up and down ...
  var SWAY_T = [6, 12];        // s: ... this slowly, each on its own (a flock is never rigid)
  var SIZE_VAR = 0.06;         // birds of one flight differ in size by up to this share
  var SPACE = 4;               // px: the least ink-to-ink gap between two birds of a flight
  var BAND_GAP = 24;           // px between the heights two flights keep: one flight to a band
  /* how each kind flies: wing-beats in a burst, and the glide between (s) */
  var FLAPS = {
    skein: [[10, 26], [0.8, 1.8]],     // geese: beating on and on, a short glide now and then
    line: [[5, 9], [1.2, 2.8]],        // ibis, pelicans: beats and glides passing back down the line
    pair: [[4, 8], [0.8, 2.4]],
    single: [[3, 8], [0.8, 3.2]],      // gull, crow: flap, flap, glide
    loose: [[3, 7], [0.6, 2.4]],       // each on its own wings
    soar: [[3, 5], [0, 0]]             // soaring birds hold their wings out: a few beats reaching and leaving the thermal
  };
  var STRAGGLE = [0.06, 0.1];  // a straggler catches up at this much over the flight's speed ...
  var STRAGGLE_T = [14, 22];   // ... over this many seconds
  var SWAP_T = [16, 24];       // s: a pair changing sides

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

  var GLYPHS = [
    [[0, 0], [2, 6], [9, 5], [11, 12], [19, 11]],
    [[0, 0], [2, 5], [8, 4], [9, 10], [16, 9]],
    [[0, 0], [2, 5], [8, 4], [10, 10], [15, 9], [26, 20]]   // long tail
  ];
  /* the wing-beat, per glyph: how far each vertex swings on the downstroke
     (glyph units). The front riser is the wing (tip, wrist, shoulder); the
     body and the tail hold still. Wings up is the glyph as drawn, and a
     gliding bird holds them so; mid-downstroke the wrist leads and the tip
     swings down past the body line. */
  var WINGS = [
    [10, 5.5, 1, 0, 0],
    [8.5, 4.7, 0.85, 0, 0],
    [9, 5, 0.9, 0, 0, 0]
  ];

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
     hand, slow wings, a straight sky, an easy pace, few birds), a lively
     one lively */
  var wr = vstream(11);
  var front = (wr() + wr()) / 2;
  function facet() { return 0.7 * front + 0.3 * wr(); }
  var fHand = facet(), fTempo = facet(), fBreeze = facet(), fPace = facet(), fTraffic = facet();
  var season = wr() < 0.7 ? 1 : -1;        // the way most flights go today (1: left to right, the way the words read)
  var faithful = 0.7 + 0.15 * wr();        // ... and how many of them

  /* ---- INIT-END: no clock or entropy reads below this line ---- */

  var hand = (HAND[0] + (HAND[1] - HAND[0]) * fHand) * JSCALE;       // px
  var pace = mix(fPace, PACE[0], PACE[1]);                           // a lively visit flies a little faster ...
  var tempo = mix(fTempo, 0.92, 1.08);                               // ... and beats its wings a little faster

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

  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- the page: the window and the words ---------------- */

  var W = 0, H = 0, words = [], dirty = true, wordsY = 0;
  function measure() {
    W = window.innerWidth; H = window.innerHeight;
    words = [];
    var s = document.querySelector('.stack'), a = document.querySelectorAll('footer a'), i, r;
    if (s) { r = s.getBoundingClientRect(); keep(r, WORDS); wordsY = (r.top + r.bottom) / 2; }
    else wordsY = H / 2;
    for (i = 0; i < a.length; i++) keep(a[i].getBoundingClientRect(), LINKS);
    dirty = false;
  }
  function keep(r, m) { if (r.right > r.left && r.bottom > r.top) words.push({ l: r.left, t: r.top, r: r.right, b: r.bottom, m: m }); }

  /* the ink box (x ± hw, y ± hh) keeps its margin from every word box */
  function clearOfWords(x, y, hw, hh) {
    for (var i = 0, o; i < words.length; i++) {
      o = words[i];
      if (x + hw > o.l - o.m && x - hw < o.r + o.m && y + hh > o.t - o.m && y - hh < o.b + o.m) return false;
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
     less every word box's height (grown by its margin), as a list of
     [from, to] intervals */
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

  /* ---------------- the birds (twelve SVGs, lent to flights) ---------------- */

  var slots = els.map(function (el, i) {
    return { el: el, line: el.querySelector('polyline'), key: 9100 + i * 97, busy: false, on: false, face: 1 };
  });
  function freeSlots() { var n = 0, i; for (i = 0; i < slots.length; i++) if (!slots[i].busy) n++; return n; }

  /* a glyph at a size: its measure, and the SVG's box */
  function measureGlyph(g, sc) {
    var pts = GLYPHS[g], x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, m = 0, k;
    for (k = 0; k < pts.length; k++) {
      x0 = Math.min(x0, pts[k][0]); x1 = Math.max(x1, pts[k][0]);
      y0 = Math.min(y0, pts[k][1]); y1 = Math.max(y1, pts[k][1]);
      m += pts[k][1];
    }
    var gw = (x1 - x0) * sc, gh = (y1 - y0) * sc;
    return { g: g, pts: pts, x0: x0, y0: y0, mid: m / pts.length, sc: sc, span: gw,
             w: gw + 2 * PAD, h: gh + 2 * PAD, hw: gw / 2 + LINE, hh: gh / 2 + LINE };
  }
  function dress(s, d) {
    s.d = d;
    s.el.setAttribute('viewBox', '0 0 ' + d.w.toFixed(2) + ' ' + d.h.toFixed(2));
    s.el.setAttribute('width', d.w.toFixed(2));
    s.el.setAttribute('height', d.h.toFixed(2));
    s.line.setAttribute('stroke-width', LINE);
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
     each followed by a glide (s), from well before the flight to its end */
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
     wings up, as drawn; 0.5 down), or -1 while it glides. A bird beats where
     the one ahead of it beat (its delay), half a beat out when it flies in
     line behind, and each at its own rate (never in lockstep) */
  function beat(m, t) {
    var w = m.w, c, k;
    t -= m.delay;
    if (!w) return -1;
    k = burstAt(w.segs, t);
    if (k < 0) return -1;
    c = m.f * (t - w.segs[k]) - m.half;                   // its own beats, begun a touch late ...
    if (c < 0 || c >= Math.round((w.segs[k + 1] - w.segs[k]) * w.f)) return -1;   // ... and all of them finished: gliding
    return c - Math.floor(c);
  }
  /* a flap-glider sinks a little through each glide and climbs back through the next burst */
  function sink(m, t) {
    var w = m.w, s, k, a, b, n, d;
    if (!w || !w.segs || !w.sinks) return 0;
    s = w.segs; t -= m.delay;
    k = burstAt(s, t);
    if (k < 0) return 0;
    a = s[k]; b = s[k + 1];
    if (t < b) {                                          // in a burst: climbing back from the glide before it
      d = k >= 2 ? SINK * Math.min(1, (a - s[k - 1]) / 12) : 0;
      return d * (1 - ease((t - a) / (b - a)));
    }
    n = k + 2 < s.length ? s[k + 2] : b + 12;             // in a glide: sinking
    d = SINK * Math.min(1, (n - b) / 12);
    return d * ease((t - b) / (n - b));
  }

  /* ---------------- a flight's shape ---------------- */

  function member(F, lag, lat, rank) {
    var r = F.r, sp = F.d.span;
    return {
      lag: lag, lat: lat, rank: rank, gain: Math.min(1.5, 1 + 0.1 * rank),
      /* its own sway about its slot, its own size, its own wing-beat */
      bA: SWAY_A * sp, bL: 0, bP: SWAY_L * sp, bKey: Math.floor(r() * NOISE_N), bT: pick(r, SWAY_T),
      d: measureGlyph(F.g, F.d.sc * (1 + SIZE_VAR * (r() * 2 - 1))),
      w: F.w, f: F.f * (1 + DETUNE * (r() * 2 - 1)), delay: 0, half: 0.15 * r(), rest: r(), bob: 0,
      stragL: 0, stragT0: 0, stragT: 1, swapT0: 0, swapT: 0, s: null
    };
  }

  /* the birds of a flight on a lane, in their slots behind the leader:
     never where a ruler would put them, and never still in them */
  function formation(F) {
    var r = F.r, n = F.n, sp = F.d.span, M = [], k, a, b, arm, dx, dy, u, rank, lag, lat, m, bow;
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
        m.half += (k % 2) * 0.5;                          // in line behind: half a beat out
        M.push(m);
      }
    } else if (F.kind === 'pair') {
      m = member(F, pick(r, PAIR_X) * sp, (r() < 0.5 ? 1 : -1) * pick(r, PAIR_Y) * sp, 1);
      m.gain = 1;
      if (r() < 0.4) { m.swapT = pick(r, SWAP_T); m.swapT0 = -1; }   // placed on the lane, once the crossing is known
      M.push(m);
    } else if (F.kind === 'loose') {
      M[0].w = { segs: bursts(r, M[0].f, FLAPS.loose, -200, 400), sinks: true, f: M[0].f };   // each on its own wings
      for (k = 1; k < n; k++) {
        for (u = 0; u < 80; u++) {
          lag = mix(r(), 0.8, 2 * Math.sqrt(n)) * sp;     // scattered behind and beside the leader, wider than deep
          lat = jit() * 1.15 * Math.sqrt(n) * sp;
          m = member(F, lag, lat, k);
          m.gain = 1;
          m.bA = 0.3 * sp; m.bP = 0.22 * sp;              // a loose flock sways more
          m.w = { segs: bursts(r, m.f, FLAPS.loose, -200, 400), sinks: true, f: m.f };
          if (fits(F, M, m, u < 40 ? pick(r, LOOSE) * sp - sp : 0)) break;
        }
        M.push(m);
      }
    }
    /* a straggler, now and then: the tail of a skein of five or more, catching up */
    if (F.kind === 'skein' && n >= 5 && r() < 0.33) {
      m = M[0];
      for (k = 1; k < M.length; k++) if (M[k].lag > m.lag) m = M[k];
      m.stragT = pick(r, STRAGGLE_T); m.stragL = pick(r, STRAGGLE) * F.v * m.stragT / 1.5; m.stragT0 = -1;   // (1.5: the ease's steepest)
    }
    return M;
  }

  /* can bird m join the others in M, ink never nearer than SPACE (+ extra),
     whatever their breathing and the wander, gusts and glides between them? */
  function fits(F, M, m, extra) {
    for (var i = 0; i < M.length; i++) if (!pairFits(F, M[i], m, extra || 0)) return false;
    return true;
  }
  function pairFits(F, a, b, extra) {
    var v = F.v, dl = Math.abs(a.lag - b.lag),
        gx = dl - a.d.hw - b.d.hw - Math.abs(a.bA) - Math.abs(b.bA),
        gy = Math.abs(a.lat - b.lat) - a.d.hh - b.d.hh - Math.abs(a.bL) - Math.abs(b.bL) - Math.abs(a.bP) - Math.abs(b.bP) -
             BOB * Math.max(a.d.span, b.d.span) -
             F.wAmp * (Math.abs(a.gain - b.gain) + 2 * Math.max(a.gain, b.gain) * Math.min(1, TAU * dl / F.wLam)) -
             2 * F.hAmp * Math.min(1, TAU * dl / (v * F.hT)) -
             (a.w && a.w.sinks ? (a.w === b.w ? SINK * Math.min(1, dl / (v * 2)) : SINK) : 0);
    return Math.max(gx, gy) >= SPACE + extra;
  }
  /* the whole flight keeps its birds apart: if not, its slots are drawn out along the track */
  function spaced(F) {
    var M = F.m, i, j, k, tries;
    for (tries = 0; tries < 8; tries++) {
      for (i = 0, k = true; i < M.length && k; i++) for (j = i + 1; j < M.length && k; j++) if (!pairFits(F, M[i], M[j], 0)) k = false;
      if (k) return true;
      for (i = 1; i < M.length; i++) M[i].lag *= 1.12;
    }
    return false;
  }

  /* ---------------- where a bird is: a pure function of the flight's time ---------------- */

  var tmp = {}, tmp2 = {};
  function spot(F, m, tau, o) {
    if (F.soar) return soarSpot(F, m, tau, o);
    var br = wave(m.bKey, tau / m.bT), lag = m.lag + m.bA * br, lat = m.lat + m.bL * br + m.bP * wave(m.bKey + 53, tau / m.bT / 1.3), s, q;
    if (m.stragL) lag += m.stragL * (1 - ease((tau - m.stragT0) / m.stragT));
    if (m.swapT) {                                        // a pair changing sides: back a span, across, and up again
      q = ease((tau - m.swapT0) / m.swapT);
      lat *= Math.cos(Math.PI * q);
      lag += F.d.span * Math.sin(Math.PI * q);
    }
    s = F.s0 + F.v * tau - lag;
    along(F.lane, s, o);
    lat += F.wAmp * wave(F.wKey, s / F.wLam) * m.gain;    // the track's wander: every bird flies through it
    o.x -= o.ty * lat; o.y += o.tx * lat;
    o.y += F.hAmp * wave(F.hKey, (tau - lag / F.v) / F.hT) + sink(m, tau);   // a gust reaches each bird as it reaches that air
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

  var KINDS = { single: 1.08, pair: 1.03, loose: 1, line: 0.96, skein: 0.95 };
  var DEPTH = { single: [0.95, 1.15], pair: [0.9, 1.08], loose: [0.9, 1.05], line: [0.82, 0.98], skein: [0.82, 0.98], soar: [0.9, 1.05] };

  function newFlight(kind, n, dir, r, calm, flat) {
    var d = pick(r, DEPTH[kind]), F = {
      kind: kind, n: n, dir: dir, r: r, soar: null, m: null, lane: null, flat: flat ? 0.6 : 1,
      g: Math.floor(r() * GLYPHS.length), t0: 0, s0: 0, dur: 0, edges: 3,
      wKey: Math.floor(r() * NOISE_N), wLam: pick(r, WAVE),
      wAmp: mix(fBreeze, WANDER[0], WANDER[1]) * (kind === 'line' ? 1.3 : 1) * pick(r, [0.7, 1.1]),
      hKey: Math.floor(r() * NOISE_N), hT: pick(r, HEAVE_T), hAmp: mix(fBreeze, HEAVE[0], HEAVE[1]) * pick(r, [0.7, 1.1])
    };
    if (calm) { F.wAmp *= 0.3; F.hAmp *= 0.3; }          // a narrow strip of sky: still air
    F.d = measureGlyph(F.g, SCALE * d);                  // the flight's typical bird (each its own size about it)
    F.v = clamp(F.d.span * pace * (KINDS[kind] || 1) * pick(r, [0.95, 1.05]), SPEED[0], SPEED[1]);   // nearer = larger = faster
    F.f = clamp(BEAT_REF * Math.pow(20 / F.d.span, 0.35) * tempo, BEAT_HZ[0], BEAT_HZ[1]);            // the bigger, the slower
    /* the wings: skeins beat on and on with a short glide now and then,
       lines and pairs beat and glide together (the glide passing back down
       the line), loners flap and glide, loose flocks each on their own */
    F.w = kind === 'loose' || kind === 'soar' ? null :
      { segs: bursts(r, F.f, FLAPS[kind], -200, 400), sinks: (kind === 'single' || kind === 'pair') && !calm, f: F.f };
    if (kind === 'soar') return soarFlight(F);
    F.m = formation(F);
    F.m.forEach(function (m) { m.delay = m.lag / F.v; });  // spatially in phase: a bird beats where the one ahead beat
    if (!spaced(F)) return null;
    F.probe = probeOf(F.m);
    reachOf(F);
    return F;
  }
  /* how far a flight reaches above and below its lane on a level crossing
     (its slots, their breathing, the wander, the gusts, a glide's sink, the ink) */
  function reachOf(F) {
    var lo = 0, hi = 0, i, m, y, b;
    for (i = 0; i < F.m.length; i++) {
      m = F.m[i];
      y = m.lat * F.dir;
      b = Math.abs(m.bL) + Math.abs(m.bP) + F.wAmp * m.gain + m.d.hh + BOB * m.d.span + (m.w && m.w.sinks ? SINK : 0);
      lo = Math.max(lo, -(y - b)); hi = Math.max(hi, y + b);
      if (m.swapT) { lo = Math.max(lo, Math.abs(m.lat) + b); hi = Math.max(hi, Math.abs(m.lat) + b); }
    }
    F.lo = lo + F.hAmp; F.hi = hi + F.hAmp;
  }
  /* the birds that bound a formation (its leader, its tail, its outermost
     on either side): a lane is tried on these first, then on them all */
  function probeOf(M) {
    var lo = 0, hi = 0, back = 0, i, out = [0];
    for (i = 1; i < M.length; i++) {
      if (M[i].lat < M[lo].lat) lo = i;
      if (M[i].lat > M[hi].lat) hi = i;
      if (M[i].lag > M[back].lag) back = i;
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
    b = F.r() * mix(fBreeze, BOW[0], BOW[1]) * W;
    h1 = sgn * b / 0.75; h2 = F.r() < 0.2 ? -0.6 * h1 : h1;
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
    var r = F.r, S, R, T, i, m, M = [], n = F.n;
    R = clamp(38 + 0.05 * W, SOAR_R[0], SOAR_R[1]) * pick(r, [0.9, 1.1]);
    T = pick(r, LAP);
    if (TAU * R / T > SPEED[1]) R = SPEED[1] * T / TAU;
    S = F.soar = {
      R: R, k: pick(r, SOAR_K), om: (r() < 0.5 ? 1 : -1) * TAU / T, T: T, drift: pick(r, WIND),
      laps: Math.round(pick(r, LAPS)), dirIn: F.dir, dirOut: r() < 0.55 ? F.dir : -F.dir,
      descent: pick(r, DESCENT), cx: 0, cy: 0, tj0: 0, thj: 0, thx: 0
    };
    S.sense = S.om > 0 ? 1 : -1;
    S.thj = S.dirIn === S.sense ? -Math.PI / 2 : Math.PI / 2;    // the top of the circle, or the bottom: where it runs the way the bird comes in
    S.thx = S.dirOut === S.sense ? -Math.PI / 2 : Math.PI / 2;   // ... and where it runs the way the bird will leave
    for (i = 0; i < n; i++) {
      m = member(F, 0, 0, i);
      m.R = R * (i === 1 ? 0.88 : i === 2 ? 1.1 : 1);
      m.gap = i ? (i * T / n) * pick(r, [0.94, 1.06]) : 0;       // they join the thermal a share of a lap apart ...
      m.w = { segs: [], sinks: false, f: m.f };                  // ... and hold their wings out, but for a few beats
      M.push(m);
    }
    F.m = M;
    F.edges = 3;
    F.probe = M.map(function (m, i) { return i; });
    F.lo = F.hi = S.k * R * 1.1 + F.d.hh * (1 + SIZE_VAR) + BOB * F.d.span;
    return F;
  }
  /* put a soaring flight's thermal at (cx, cy) and time its birds' glides, laps and leaving */
  function soarTimes(F, cx, cy) {
    var S = F.soar, M = F.m, i, m, entry, d, lo, hi, mid, turn, exit;
    S.cx = cx; S.cy = cy;
    entry = S.dirIn > 0 ? -OUT : W + OUT;
    exit = S.dirOut > 0 ? W + OUT : -OUT;
    turn = ((S.thx - S.thj) * S.sense % TAU + TAU) % TAU;
    for (i = 0; i < M.length; i++) {
      m = M[i];
      m.vj = Math.abs(S.om) * m.R + S.drift;                   // at the join: the circle's speed and the drift together
      m.vIn = Math.min(SPEED[1], GLIDE_V * m.vj);
      m.vx = Math.abs(S.om) * m.R + S.dirIn * S.dirOut * S.drift;
      m.vOut = Math.min(SPEED[1], GLIDE_V * m.vx);
    }
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
      d = Math.abs(exit - m.xx) + F.d.hw;
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
    for (var i = 0; i < F.m.length; i++) { spot(F, F.m[i], tau, tmp); if (inView(tmp.x, tmp.y, F.d.hw, F.d.hh)) return true; }
    return false;
  }
  function allInView(F, tau) {
    for (var i = 0; i < F.m.length; i++) {
      spot(F, F.m[i], tau, tmp);
      if (tmp.x - F.d.hw < 0 || tmp.x + F.d.hw > W || tmp.y - F.d.hh < 0 || tmp.y + F.d.hh > H) return false;
    }
    return true;
  }
  /* the straggler catches up and the pair changes sides while in view: timed to the lane */
  function placeEvents(F) {
    var span = Math.max(1, (F.lane.len - 2 * OUT) / F.v), start = (OUT - F.s0) / F.v;
    F.m.forEach(function (m) {
      if (m.stragL) m.stragT0 = start + span * mix(F.r(), 0.12, 0.3);
      if (m.swapT) m.swapT0 = start + span * mix(F.r(), 0.3, 0.6);
    });
  }
  function snapshot(F, from) {
    return { lane: F.lane, s0: F.s0, dur: F.dur, edges: F.edges, from: from,
             soar: F.soar ? JSON.parse(JSON.stringify(F.soar)) : null,
             m: F.m.map(function (m) { var c = {}, k; for (k in m) if (k !== 'w' && k !== 's') c[k] = m[k]; c.w = m.w && m.w.segs ? { segs: m.w.segs.slice(), sinks: m.w.sinks, f: m.w.f } : m.w; return c; }) };
  }
  function restore(F, k) {
    F.lane = k.lane; F.s0 = k.s0; F.dur = k.dur; F.edges = k.edges; F.from = k.from; F.yLo = k.yLo; F.yHi = k.yHi;
    if (k.soar) F.soar = k.soar;
    F.m.forEach(function (m, i) { var c = k.m[i], p; for (p in c) m[p] = c[p]; });
  }

  /* how many birds: 1-9 by COUNT (a lively visit leaning larger), never
     four, and never making four in the sky with the birds already there */
  function drawCount(r, free, busy) {
    var tries, u, n, acc, i, tot, w = [];
    for (i = 0, tot = 0; i < COUNT.length; i++) { w.push(COUNT[i] * (1 + 0.5 * (fTraffic - 0.5) * (i - 3) / 4)); tot += w[i]; }
    for (tries = 0; tries < 12; tries++) {
      u = r() * tot; acc = 0; n = 1;
      for (i = 0; i < w.length; i++) { acc += w[i]; if (u < acc) { n = i + 1; break; } }
      n = Math.min(n, free);
      if (n !== 4 && n + busy !== 4) return n;
    }
    return busy === 3 ? 0 : 1;
  }
  function drawKind(r, n) {
    var u = r(), wide = W >= SOAR_W;
    if (n === 1) return wide && u < 0.35 ? 'soar' : 'single';
    if (n === 2) return wide && u < 0.25 ? 'soar' : 'pair';
    if (n === 3 && wide && u < 0.15) return 'soar';
    if (u < 0.6) return 'skein';                          // V's, J's and echelons: the flight everyone knows
    if (u < 0.78 || n > 6) return 'line';
    return 'loose';
  }

  /* ---------------- launching: a flight is planned a few lanes a frame ---------------- */

  var job = null, q = {};

  /* a new flight: mode 'first' (it enters soon after load), 'next' (the
     scheduler's), 'still' (the composed still sky) */
  function startJob(mode) {
    var r = vstream(100 + flightNo++), busy = 0, free = freeSlots(), n, kind, dir, order, i;
    for (i = 0; i < flights.length; i++) busy += flights[i].m.length;
    if (free < 1) return false;
    n = drawCount(r, free, busy);
    if (!n) return false;
    kind = mode === 'still' ? (n >= 3 ? 'skein' : n === 2 ? 'pair' : 'single') : drawKind(r, n);
    dir = season;
    /* against the season: only a lone bird or a pair, and only into an empty sky */
    if (!flights.length && n <= 2 && kind !== 'soar' && r() > faithful) dir = -season;
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
    job = { mode: mode, r: r, order: order, oi: 0, busy: busy, dir: dir, F: null };
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
      J.diag = (J.a > TRIES / 2 && J.best < 0) || !J.bands.length;   // no level crossing fits: try the steeper lanes
      qx = q.x * W;
      qy = J.diag ? mix(q.y, 0.04, 0.96) * H : inBands(J.bands, q.y);   // a level crossing: its centre in an open band
      if (!clearOfWords(qx, qy, F.d.hw, F.d.hh)) return false;   // through the words: not a lane
      a = J.diag ? (F.r() < 0.5 ? 1 : -1) * pick(F.r, DIAG) : (F.r() * 2 - 1) * TILT;
      laneThrough(F, qx, qy, a);
      if (!J.diag && F.edges !== 3) return false;         // a level crossing enters and leaves by the sides
      F.m.forEach(function (m) { lap = Math.max(lap, m.lag + m.stragL + F.d.span); });
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
    sc += 0.25 * J.it.apart + (J.diag ? 0 : 40) + 8 * F.r();
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
        if (o[1] + J.busy === 4 || o[1] > freeSlots()) continue;
        J.F = newFlight(o[0], o[1], J.dir, J.r, o[2], o[3]);
        J.c = 0; J.a = 0; J.best = -1; J.keep = null; J.it = null; J.bands = null;
        quota -= 20;
        continue;
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
     Through a wing-beat the front riser (the wing) swings down past the
     body line and up again (WINGS), the body rising on the downstroke and
     sinking on the upstroke; on a glide the wings are held up and out, as
     drawn. A still sky is a photograph: every bird caught at its own point
     in the beat */
  function pose(F, m, tau, boil, rest) {
    var s = m.s, d = s.d, i, p, k, c, out = [], jit = rest ? 0 : hand, ph = rest ? m.rest : beat(m, tau), down = 0, sw = WINGS[d.g];
    if (ph >= 0) {
      down = (1 - Math.cos(TAU * ph)) / 2;                // 0 wings up (as drawn) .. 1 wings down
      m.bob = rest ? 0 : -BOB * d.span * down;            // the body lifts on the downstroke
    } else m.bob = 0;                                     // gliding: wings held up and out, as drawn
    spot(F, m, tau + 0.25, tmp2);                          // the way it is going
    c = tmp2.x - m.x;
    c = c / (Math.sqrt(c * c + (tmp2.y - m.y) * (tmp2.y - m.y)) || 1);
    if (s.face > 0 && c > FACE_HYST) s.face = -1;         // turn to face right (mirrored)
    else if (s.face < 0 && c < -FACE_HYST) s.face = 1;    // face left (as drawn)
    for (i = 0; i < d.pts.length; i++) {
      p = d.pts[i];
      k = s.key + i * 7 + boil * 131;
      out.push(((p[0] - d.x0) * d.sc + PAD + nz(k) * jit).toFixed(2) + ',' +
               ((p[1] + sw[i] * down - d.y0) * d.sc + PAD + nz(k + 61) * jit).toFixed(2));
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
          if (!m.s.on) { spot(F, m, tau + 0.25, tmp2); m.s.face = tmp2.x > m.x ? -1 : 1; }
          pose(F, m, tau, boil, rest);
        }
        show(m.s);
        put(m);
      }
    }
  }

  /* ---------------- the sky's clock (the page's own time; no clock is read) ---------------- */

  var raf = 0, last = 0, t = 0, phase = -1, tNext = 0, misses = 0;

  /* how long a flight is in view, near enough */
  function inViewFor(F) { return Math.max(4, F.dur - F.from - 2 * OUT / (F.v || SPEED[1])); }
  function gapAfter(F) {
    return inViewFor(F) * pick(F.r, GAP) * (1 + Math.min(THIN_MAX, t / THIN)) * (1.1 - 0.2 * fTraffic);
  }
  /* a job is done: when the next flight comes */
  function planned(F, mode) {
    if (mode === 'still') { draw(true, 0, true); return; }
    if (F) { misses = 0; tNext = t + (mode === 'first' ? pick(F.r, [0.45, 0.7]) * inViewFor(F) : gapAfter(F)); }   // the second once the first is past midway
    else { misses++; tNext = t + Math.min(20, RETRY * misses); }   // no room: look again, less and less often
  }

  function frame(now) {
    raf = 0;
    var moving = !still.matches, dt = last ? Math.min(STEP_MAX, (now - last) / 1000) : 0, k, F, mode;
    last = now;
    if (moving) t += dt;
    if (dirty) relayout();
    if (!job && moving && t >= tNext && flights.length < FLIGHTS && !startJob('next')) planned(null, 'next');
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

  /* the window resized or the words moved: a new sky if the window changed
     shape; otherwise every flight still clear of the words flies on, and a
     flight the words have moved onto goes */
  function relayout() {
    var w0 = W, h0 = H, i, F;
    measure();
    if (W !== w0 || Math.abs(H - h0) > 120) { begin(); return; }
    for (i = flights.length - 1; i >= 0; i--) {
      F = flights[i];
      if (trial(F, t - F.t0) < 0) land(F);
    }
    if (job) resetJob();
  }
  function begin() {
    clearSky();
    job = null;
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
