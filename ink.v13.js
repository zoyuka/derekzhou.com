/* The ink garden, at night — a hand-drawn day, clocked from local midnight.
   2D canvas, no libraries, no network. A still drawing that answers touch.

   THE PLACE is date-seeded and grows with the day: sparse at dawn, in
   full bloom by evening, held through the small hours until dawn clears
   it — the same garden for every visitor, all day. It is ALREADY THERE
   as the door opens, drawn and still, except the youngest sprig, which
   is finishing its last generation (born YOUNG_BORN = -genStart(4): it
   draws over 0–2.6 s and its tips blossom at 3.64 s — growth in progress,
   never an event).
   By 4 s the ink has settled and nothing moves. Every stroke is a
   wobbly polyline; while the garden is awake it is redrawn with fresh
   jitter five times a second — the hand-drawn boil, and the page's only
   frame rate, so everything moves in stop-motion, the way a flip-book
   does. At rest it is one still drawing in the day's own hand.

   TOUCH is the only weather after that, and an answer takes as long as
   it takes — nothing is hurried to beat a clock:
   - tap open ground: a seed is pressed into it and a sprig draws itself
     in there — the first shoot within a second (GEN0), then generation
     by generation at 2.6 s each (children take symmetric coin-flip slots, so canopies
     settle toward binomial silhouettes; blossom inks come from the
     day's Polya urn)
   - tap a tree: it rings slowly (0.9 Hz, 3 px, gone by ~5 s) and a few
     seeds let go and flutter down at 82 px/s —
     each air-row a coin-flip step mean-reverting to the release column
     (a discrete Ornstein-Uhlenbeck walk: pachinko with the pegs made of
     air) — and a grass blade takes root where each lands, so the stand
     under every shaken tree settles toward the bell (de Moivre-Laplace,
     drawn as meadow)
   - tap the sky: a skein of birds — marks in the hand's own zigzag —
     MEANDERS across at 12 px/s, the lead bird already at the frame's
     edge so it is visible within a second, a crossing bounded to 80 s so
     it reads the same on a phone and on a wide screen: membership a
     coin-flip sum, the lead's undulation echoed down the line, wing-beats
     detuned per bird under 1 Hz, altitude from a golden-ratio sequence,
     direction a Markov flip. The band is whichever is taller — the sky
     above the name (desktop) or the open zone between the text and the
     meadow (phones) — so a skein always has somewhere to fly
   - tap the meadow: a gust rolls out from the touch at 55 px/s through
     the whole garden — grass leans blade by blade as it passes, canopies
     shear, falling seeds drift, birds bob: one motion, many small marks
   Every tap also sends a small gust. Nothing else ever moves by itself.

   WHY THERE IS NO PAUSE CONTROL: WCAG 2.2.2 asks for one only where
   motion (1) starts AUTOMATICALLY and (2) lasts longer than five
   seconds. Only the opening starts by itself, and it is over within 4 s
   of the first frame — nothing else is ever scheduled. Everything else
   is started by the visitor, which the criterion does not cover at all,
   so an answer is free to take its own slow time, and does. Keep the
   OPENING under five seconds and keep nothing else automatic: that is
   the whole reason the footer has no button, and it is NOT a reason to
   hurry anything the visitor started. Under prefers-reduced-motion
   nothing animates at all: the day's garden is one still frame, and a
   tap on open ground plants a finished sprig.

   THE WEATHER is visit-seeded — the one =rand() cell on the page: ONE
   entropy read at init, layered over the day seed; never stored, never
   shown, never in the URL, never reseeded by a tap, a resize or a
   returning tab. It owns HOW the garden answers, never whether: the
   gust's strength (breeze), how many birds tend to fly (traffic), how
   many seeds a shake loosens (tempo), the hand's tremor while awake
   (hand), and the wind's lean and phase. The visitor's taps choose
   where and when.

   THE CALM ENVELOPE (any change must keep all of this true):
   - at rest: zero motion, zero CPU — no loop runs; the resting frame is
     drawn in the day's hand (jitter 1.6, offset 0): the day's garden
     plus whatever this visit has landed or planted
   - awake: 5 frames a second, and the boil re-rolls at its own 5 Hz (two
     constants, never one: raising the frame rate must not speed up the
     hand); nothing is smooth, everything is stop-motion; jitter <= 1.6 px
     (1.2–1.6 per visit, and 0.4 of that on a flying bird, whose mark is
     small and moving); an answer runs until it is genuinely finished
   - the opening is the ONE automatic waking: 4 s, once per load, never
     on a resize or a returning tab. Nothing else is ever scheduled
   - gusts roll from the touch at 55 px/s, pass a point in 3.5 s and die
     out by 900 px (GUST_LIFE, the one lifetime every wake uses); they SUM,
     so the field is clamped to +/-1 and the gains below are true ceilings
     however fast a visitor taps: grass 1.3 px, canopy 2.4 px
     (scaled by distance from the root), seed drift 2 px, bird bob
     2.5 px, breath 0.15; a shaken tree rings at 0.9 Hz, 3 px, gone by
     ~5 s
   - seeds fall at 82 px/s; a whole sprig draws in in SPRIG_S ~13.9 s; a
     skein glides at 12 px/s and a crossing is capped at SKEIN_MAX 80 s
     (so a wide screen glides a little faster rather than running for
     minutes), wing-beats under 1 Hz, one at a time — these are the
     page's calm speeds, and nothing may be sped up to fit a clock
   - every answer must SHOW something within about a second of the tap:
     a bird at the frame's edge, a shoot from the planted seed, the
     grass leaning where the finger landed. An answer nobody can see is
     the same as no answer — that is how the skein came to be unusable
     on phones (it entered 95 px off-frame and took 8-20 s to appear)
   - strokes only — never clustered dots (hard rule); no fills, no arcs;
     ink alphas <= 0.85; night ground #181410; palette fixed to the six
     inks
   - no ink under the measured typography or footer boxes, ever: taps
     there do nothing; seeds let go only from tips whose fall stays clear
     (below the text, or down the right margin in hang mode); planted
     sprigs are scale-clamped near the boxes; when a viewport has no room
     the garden rests: nothing is drawn, taps do nothing
   - prefers-reduced-motion / forced-colors: the still frame, no opening,
     no answers but a finished sprig on open ground; live listener both
     directions
   - JS off / canvas failure: typography on the night ground
   - ONE clock read and ONE entropy read, both at init above the INIT-END
     marker; nothing below it reads the wall clock or unseeded randomness
     (performance.now deltas only); no state persisted at all
   - the tab title and the favicon never change; nothing listens for the
     pointer's position, keys, idling or focus loss; a hidden tab settles
     the garden at once, and so does pagehide (bfcache must never restore
     a skein parked mid-sky); a return after >= 8 min shows only a statically fuller garden
     (the day's own replay continued) — nothing animates on return
   - rejected: a parked flock, toasts, hints, a visible seed, sound,
     custom cursors, any URL hook; CI greps enforce the absences */

(function () {
  'use strict';

  /* ---------------- config ---------------- */

  var FPS = 5;                 // frames a second while awake
  var BOIL_FPS = 5;            // the hand's tremor re-rolls this often (independent of FPS:
                               // raising the frame rate must never speed up the boil)
  var JITTER = 1.6;            // px, wobble ceiling (the resting hand)
  var GROW_S = 2.6;            // s per branch generation — a branch takes its time
  var GEN0 = 0.35;             // the first shoot is quicker (0.35 * GROW_S), so a planted
                               // seed shows something within a second; then it slows down
  var OPEN_S = 4.0;            // s, the opening: the one automatic motion
  var FLY_V = 12;              // px/s, a skein's glide — a distant, unhurried crossing
  var SKEIN_MAX = 80;          // s, the longest a crossing may take: on a wide screen the
                               // skein glides a little faster so a crossing reads the same
                               // everywhere and a stray tap never commits minutes of motion
  var SKEIN_EDGE = 10;         // px beyond the frame the lead bird starts: it must be
                               // VISIBLE within a second of the tap, not 8 s later
  var DROP_V = 82;             // px/s, a seed's fall
  var GUST_V = 55;             // px/s, a gust's travel from the touch
  var GUST_T = 3.5;            // s, a gust's passage over a point
  var GUST_R = 900;            // px, where a gust has died out
  var GUST_LIFE = GUST_T + GUST_R / GUST_V;   // s, when a gust is certainly over
  var GUST_MAX = 24;           // live gusts kept; the sum is clamped below in any case

  /* when generation `gen` starts drawing, and how long it takes */
  function genStart(gen) { return gen ? (GEN0 + gen - 1) * GROW_S : 0; }
  function genDur(gen) { return gen ? GROW_S : GEN0 * GROW_S; }
  var SPRIG_S = genStart(5) + GROW_S;         // s for a whole sprig, blossoms included
  var YOUNG_BORN = -genStart(4);              // the opening's youngest sprig: its last
                                              // generation starts drawing exactly at t = 0
  var INK = {
    line:   '#d8d2c4',
    dim:    '#8f887b',
    ochre:  '#c79a3d',
    verm:   '#d05a40',
    sage:   '#8fa284',
    slate:  '#8b9cbd'
  };

  /* ---------------- seeded randomness ---------------- */

  function xmur3(str) {
    var h = 1779033703 ^ str.length, i;
    for (i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
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
  var now0 = new Date();                     // the only clock read
  var daySeed = xmur3(now0.getFullYear() + '-' + (now0.getMonth() + 1) + '-' + now0.getDate())();
  var midnightS = now0.getHours() * 3600 + now0.getMinutes() * 60 + now0.getSeconds();
  /* DAY streams — the place: 1 noise table, 2 day sprigs, 3 planted
     sprigs, 6 meadow replay, 8 urn */
  var stream = function (n) { return sm32((daySeed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0); };

  /* =rand(): the one entropy read. */
  var visitSeed = (function () {
    try { if (self.crypto && crypto.getRandomValues) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] >>> 0; } } catch (e) {}
    return ((performance.now() * 1000) ^ daySeed) >>> 0;
  })();
  /* VISIT streams — the weather: 6 seeds let go, 9 skein, 11 weather
     record, 12 wind, 15 hand */
  var vstream = function (n) { return sm32((visitSeed ^ daySeed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0); };

  /* the weather record: ONE front, four facets, quiet hours. A still
     visit is still everywhere — soft gusts, few birds, few seeds, a
     steadier hand — and a breezy one breezy everywhere. */
  var wr = vstream(11);
  var front = (wr() + wr()) / 2;
  function facet() { return 0.7 * front + 0.3 * wr(); }
  var fBreeze = facet(), fTraffic = facet(), fTempo = facet(), fHand = facet();
  var night = midnightS >= 23 * 3600 || midnightS < 5 * 3600;
  var breeze = (0.2 + 0.8 * fBreeze) * (night ? 0.85 : 1);           // [0.17, 1.0]: the gust's strength
  var traffic = fTraffic;                                             // how many birds tend to fly
  var seedsPerShake = 2 + (fTempo > 0.45 ? 1 : 0) + (fTempo > 0.8 ? 1 : 0);   // 2..4
  var handJitter = 1.2 + 0.4 * fHand;                                 // px: [1.2, 1.6]

  var wv = vstream(12);
  var windPhVisit = wv() * 6.283;
  var windDir = wv() < 0.5 ? -1 : 1;                                  // which way this visit's gusts lean

  var hv = vstream(15);
  var tremorOff = (hv() * 4096) | 0;

  var initNow = performance.now();

  /* ---- INIT-END: no clock or entropy reads below this line ---- */

  var NOISE_N = 4096;
  var noiseTab = new Float32Array(NOISE_N);
  (function () { var r = stream(1), i; for (i = 0; i < NOISE_N; i++) noiseTab[i] = r() * 2 - 1; })();
  function nz(i) { return noiseTab[(i | 0) & (NOISE_N - 1)]; }

  /* ---------------- the wind ----------------
     feng is wind, shui is water. A gust is a single hump that runs out
     from the touch both ways at GUST_V, passing each point in GUST_T and
     dying out by GUST_R — so it visibly travels: grass bends blade by
     blade as it passes, then the tree above it. While the garden is
     awake a faint breath sways everything too; at rest the wind is zero. */
  var gusts = [];
  var breath = 0;
  function wind(x, t) {
    var w = breath, i, g, d, u;
    for (i = 0; i < gusts.length; i++) {
      g = gusts[i]; d = Math.abs(x - g.x0);
      if (d >= GUST_R) continue;
      u = t - g.t0 - d / GUST_V;
      if (u > 0 && u < GUST_T) w += g.dir * g.amp * (1 - d / GUST_R) * Math.sin(Math.PI * u / GUST_T);
    }
    /* gusts SUM, so a fast tapper could stack them; the gains below are stated
       as ceilings, so the field itself is clamped to one gust's worth */
    return w < -1 ? -1 : (w > 1 ? 1 : w);
  }
  function addGust(x0, t0, amp) {
    if (gusts.length >= GUST_MAX) gusts.shift();
    gusts.push({ x0: x0, t0: t0, amp: amp, dir: windDir });
  }
  function pruneGusts(t) { while (gusts.length && t > gusts[0].t0 + GUST_LIFE) gusts.shift(); }

  /* ---------------- DOM ---------------- */

  var canvas = document.getElementById('ink');
  if (!canvas) return;
  var doc = document.documentElement;
  var ctx = canvas.getContext('2d');
  if (!ctx) { canvas.parentNode.removeChild(canvas); doc.classList.add('ink-ready'); return; }

  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  var mqForced = matchMedia('(forced-colors: active)');   // the canvas is hidden by CSS: treat as still
  function still() { return mqReduce.matches || mqForced.matches; }
  function resting() { return !!anchors && anchors.mode === 'rest'; }
  function listenMq(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  var W = 0, H = 0, DPR = 1;
  var anchors = null;

  /* ---------------- stroke machinery ---------------- */

  var boilPhase = 0;
  var animatingNow = false;    // awake frames use this visit's hand; the resting frame the day's

  /* jscale trims the hand's wobble for a mark that is small and moving: a bird
     glides ~2-7 px a frame, so a full 1.6 px re-roll on every point reads as a
     shiver rather than flight */
  function stroke(pts, color, width, alpha, t, key, jscale) {
    var n = pts.length;
    if (n < 2) return;
    var upto = Math.max(2, Math.ceil(n * (t === undefined ? 1 : t)));
    var jit = (animatingNow ? handJitter : JITTER) * (jscale === undefined ? 1 : jscale);
    var off = animatingNow ? tremorOff : 0;
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha === undefined ? 0.85 : alpha;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    var i, jx, jy, k;
    for (i = 0; i < upto; i++) {
      k = (key || 0) + i * 7 + boilPhase * 131 + off;
      jx = nz(k) * jit;
      jy = nz(k + 61) * jit;
      if (i === 0) ctx.moveTo(pts[0][0] + jx, pts[0][1] + jy);
      else ctx.lineTo(pts[i][0] + jx, pts[i][1] + jy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function starburst(x, y, r, color, key) {
    var i, a;
    for (i = 0; i < 7; i++) {
      a = i * Math.PI * 2 / 7 + 0.35;
      stroke([[x + Math.cos(a) * r * 0.35, y + Math.sin(a) * r * 0.35],
              [x + Math.cos(a) * r, y + Math.sin(a) * r]],
             color, 1.2, 0.8, 1, key + i * 53);
    }
  }

  /* ---------------- the garden (branches + blossoms) ---------------- */

  var urn = (function () {
    var r = stream(8);
    var w = [1 + r() * 1.2, 0.5 + r() * 0.9, 0.45 + r() * 0.8];  // sage, verm, ochre
    return function (rng) {
      var s = w[0] + w[1] + w[2], u = rng() * s;
      var i = u < w[0] ? 0 : (u < w[0] + w[1] ? 1 : 2);
      w[i] += 0.3;
      return i === 0 ? INK.sage : (i === 1 ? INK.verm : INK.ochre);
    };
  })();

  function buildSprig(x0, y0, ang0, scale, rng, born) {
    var segs = [], tips = [];
    var bx0 = x0, by0 = y0, bx1 = x0, by1 = y0;
    function grow(x, y, ang, len, depth, gen) {
      if (depth > 4 || len < 6) return;
      var pts = [[x, y]], steps = 6, i;
      var bend = (rng() - 0.5) * 0.7;
      var cx = x, cy = y, a = ang;
      for (i = 1; i <= steps; i++) {
        a += bend / steps + (rng() - 0.5) * 0.12;
        cx += Math.cos(a) * (len / steps);
        cy += Math.sin(a) * (len / steps);
        pts.push([cx, cy]);
        if (cx < bx0) bx0 = cx; if (cx > bx1) bx1 = cx; if (cy < by0) by0 = cy; if (cy > by1) by1 = cy;
      }
      segs.push({ pts: pts, w: Math.max(0.8, 2.2 - depth * 0.45), gen: gen, key: (segs.length + 1) * 397 });
      if (depth >= 2 && rng() < 0.75) {
        segs.push({ tip: [cx, cy], kind: rng() < 0.5 ? 'petal' : 'burst',
                    col: urn(rng), gen: gen + 1, key: (segs.length + 1) * 397 });
        tips.push([cx, cy]);
      }
      var kids = depth === 0 ? 3 : (rng() < 0.6 ? 2 : 1), k;
      for (k = 0; k < kids; k++) {
        var slot = kids === 1 ? (rng() < 0.5 ? -1 : 1) * 0.35
                              : (k - (kids - 1) / 2) * (kids === 3 ? 0.8 : 1.15);
        grow(cx, cy, a + slot + (rng() - 0.5) * 0.25, len * (0.55 + rng() * 0.2), depth + 1, gen + 1);
      }
    }
    grow(x0, y0, ang0, 64 * scale, 0, 0);
    return { segs: segs, tips: tips, born: born, ox: x0, oy: y0, shakeT: -100,
             x0: bx0 - 8, y0: by0 - 8, x1: bx1 + 8, y1: by1 + 8 };
  }

  function drawSprig(sprig, tNow) {
    /* the canopy shears with the wind — most at the far tips, nothing at
       the rooted base — and rings when shaken */
    var wv = wind(sprig.ox, tNow) * 2.4;
    var u = tNow - sprig.shakeT;
    /* a shaken tree rings slowly and dies away: 0.9 Hz, 3 px, gone by ~5 s */
    if (u > 0 && u < 5.5) wv += 3 * Math.sin(u * 5.65) * Math.exp(-u * 0.8);
    var el = tNow - sprig.born;
    var i, s, g, t, j, d, pts2, tx, ty;
    for (i = 0; i < sprig.segs.length; i++) {
      s = sprig.segs[i];
      g = (el - genStart(s.gen)) / genDur(s.gen);
      if (g <= 0) continue;
      t = Math.min(1, g);
      if (s.pts) {
        pts2 = [];
        for (j = 0; j < s.pts.length; j++) {
          d = Math.min(1, Math.abs(s.pts[j][1] - sprig.oy) / 190);
          pts2.push([s.pts[j][0] + wv * d, s.pts[j][1]]);
        }
        stroke(pts2, INK.line, s.w, 0.8, t, s.key);
      } else if (t > 0.4) {
        d = Math.min(1, Math.abs(s.tip[1] - sprig.oy) / 190);
        tx = s.tip[0] + wv * d; ty = s.tip[1];
        if (s.kind === 'petal') {
          stroke([[tx - 3, ty], [tx + 1, ty - 4]], s.col, 2.2, 0.75, 1, s.key);
          stroke([[tx + 1, ty - 1], [tx + 4, ty + 2]], s.col, 2.0, 0.7, 1, s.key + 11);
        } else {
          starburst(tx, ty, 5, s.col, s.key);
        }
      }
    }
  }

  var sprigs = [];             // day sprigs first (sprigs[0] is the anchor), planted sprigs after
  var seedRng = stream(3);
  var gardenRng = null;
  var dayCount = 0;
  var dayPlanted = 0;

  var awayS = 0;
  function dayS() { return midnightS + awayS; }
  /* the day decides how much has grown: 0 at 05:00, full at 21:00 —
     eased logistically (smootherstep) — and the small hours keep the
     evening's fullness until dawn clears it */
  function dayFrac() {
    var h = dayS() / 3600;
    if (h < 5) return 1;
    var lin = Math.min(1, (h - 5) / 16);
    return lin * lin * (3 - 2 * lin);
  }
  function daySprigs() { return 2 + Math.round(dayFrac() * 4); }   // 2..6

  function plantOne(i, r, born) {
    var narrow = W < 700;
    var mode = anchors.mode;
    var x, y, ang, sc, cap;
    var side = r();
    if (narrow && mode === 'hang') {
      /* a phone: the anchor hangs top-right when the sky allows, else it
         stands on the strip above the footer; companions hang or stand by
         whichever fits (both fit: a coin decides). No tree fits at all:
         nothing is planted — seeds then come from beyond the top edge */
      if (!anchors.canopy && !anchors.stand) { dayPlanted++; return; }
      var hangs = anchors.canopy && (i === 0 || !anchors.stand || side < 0.5);
      if (hangs) {
        x = i === 0 ? W * 0.88 : W * (0.45 + side * 0.4);
        y = 4; ang = Math.PI / 2 + (r() - 0.5) * (i === 0 ? 0.3 : 0.4);
        sc = (i === 0 ? 0.7 : 0.55) + r() * 0.25; cap = anchors.hangCap;
      } else {
        var slot = r();
        x = i === 0 ? W * (0.72 + r() * 0.1) : (slot < 0.55 ? W * (0.14 + r() * 0.16) : W * (0.4 + r() * 0.14));
        y = anchors.stripY; ang = -Math.PI / 2 + (r() - 0.5) * 0.5;
        sc = (i === 0 ? 0.8 : 0.65) + r() * 0.25; cap = anchors.standCap;
      }
      sc = Math.min(sc, cap);
      dayPlanted++;
      if (sc < 0.3) return;
      sprigs.splice(dayCount, 0, buildSprig(x, y, ang, sc, r, born));
      dayCount++;
      return;
    }
    var hangThis = mode === 'hang' || (mode === 'beds' && i > 0 && side >= 0.75);
    if (i === 0) {                       // the anchor sprig: the day's meadow grows under it
      if (mode === 'hang') { x = W * 0.9; y = 4; ang = Math.PI / 2 + (r() - 0.5) * 0.3; }
      else { x = W * (0.74 + r() * 0.08); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.4; }
      sc = (mode === 'hang' ? 0.7 : 1.0) + r() * 0.25;
    } else if (hangThis) {               // hanging from the top edge
      x = mode === 'hang' ? W * (0.45 + side * 0.4) : W * (0.84 + r() * 0.1);
      y = 4; ang = Math.PI / 2 + (r() - 0.5) * 0.4;
      sc = 0.6 + r() * 0.25;
    } else if (side < 0.6) {             // bottom bed, left of the text column
      x = W * (0.28 + r() * 0.13); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.5;
      sc = 0.8 + r() * 0.5;
    } else {                             // bottom-right bed
      x = W * (0.72 + r() * 0.12); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.5;
      sc = 0.8 + r() * 0.5;
    }
    sc = Math.min(sc, y > 4 ? anchors.bedCap : anchors.hangCap);
    dayPlanted++;
    if (sc < 0.3) return;
    sprigs.splice(dayCount, 0, buildSprig(x, y, ang, sc, r, born));
    dayCount++;
  }

  /* opening: the day's garden is already grown, except the youngest sprig,
     which is still drawing its last generation as the door opens (born
     YOUNG_BORN = -genStart(4), so that generation draws over 0..GROW_S and
     its tips blossom at genStart(5) + 0.4*GROW_S - genStart(4) = 3.64 s —
     growth in progress, never an event, and inside OPEN_S). Otherwise: all
     grown. daySprigs() is 2..6, so there is always a youngest to leave. */
  function plantDayGarden(opening) {
    sprigs.length = 0;
    dayCount = 0; dayPlanted = 0; gardenRng = null;
    if (!anchors || anchors.mode === 'rest') return;
    gardenRng = stream(2);
    var total = daySprigs(), i;
    for (i = 0; i < total; i++) {
      plantOne(i, gardenRng, (opening && i === total - 1) ? YOUNG_BORN : -100);
    }
  }

  /* ---------------- the skein ---------------- */

  var GLYPHS = [
    { pts: [[0, 0], [2, 6], [9, 5], [11, 12], [19, 11]] },
    { pts: [[0, 0], [2, 5], [8, 4], [9, 10], [16, 9]] },
    { pts: [[0, 0], [2, 5], [8, 4], [10, 10], [15, 9], [26, 20]] }  // long tail
  ];
  (function () {
    var g, i, p, m;
    for (g = 0; g < GLYPHS.length; g++) {
      p = GLYPHS[g]; m = 0;
      for (i = 0; i < p.pts.length; i++) m += p.pts[i][1];
      p.mid = m / p.pts.length;
      p.w = p.pts[p.pts.length - 1][0];
    }
  })();

  var flight = null;
  var skeinRng = vstream(9), skeinA0 = skeinRng(), skeinK = 0, prevDir = 0;

  /* who flies: usually a coin-flip skein of 2..6 (a busy visit's sky
     leans larger), sometimes a loner, rarely a great skein of 7..8 */
  function startFlight(t0) {
    var r = skeinRng, u = r();
    var n = u < 0.15 ? 1
          : u < 0.22 ? 7 + (r() < 0.5 ? 1 : 0)
          : 2 + (r() < 0.6 ? 1 : 0) + (r() < 0.45 ? 1 : 0) + (r() < 0.3 ? 1 : 0)
              + (r() < 0.18 ? 1 : 0) + (traffic > 0.6 && r() < 0.5 ? 1 : 0);
    var birds = [], back = 0, i;
    for (i = 0; i < n; i++) {
      if (i) back += 26 + r() * 16;
      if (i === n - 1 && n > 2 && r() < 0.3) back += 55 + r() * 40;  // the straggler
      birds.push({
        g: GLYPHS[i === 0 && r() < 0.5 ? 2 : (r() * 2) | 0],
        sc: 0.8 + r() * 0.35,
        back: back,
        side: (i % 2 ? 1 : -1) * (6 + r() * 15) * (i ? 1 : 0.3),
        beatF: 0.68 + r() * 0.27,
        beatPh: r() * 7
      });
    }
    if (!prevDir) prevDir = r() < 0.5 ? -1 : 1;
    var dir = r() < 0.72 ? -prevDir : prevDir;
    prevDir = dir;
    /* the lead bird starts just off the frame, so it is VISIBLE within a
       second of the tap; the crossing is bounded so a wide screen reads the
       same as a phone and a stray tap never commits minutes of motion */
    var len = back + 30, span = W + len + 2 * SKEIN_EDGE;
    var dur = Math.min(SKEIN_MAX, span / FLY_V);
    flight = {
      birds: birds, len: len, t0: t0, dur: dur, end: t0 + dur, dir: dir,
      span: span, v: span / dur,
      yj: 0.12 + 0.72 * ((skeinA0 + skeinK * 0.6180339887) % 1),
      yj2: 0.12 + 0.72 * r(),
      ph: r() * 6.283, ph2: r() * 6.283
    };
    skeinK++;
  }

  /* Where can a skein fly? Two bands are ever clear of the words: the sky
     above the name, and the open zone between the text and the meadow. Take
     whichever is taller — on a phone the sky above the name is a sliver (and
     full of hanging sprigs), so the lower zone wins; on a desktop the sky
     wins. Margins are thin on purpose: a 25 px band still carries a 14 px
     bird, and a band that does not exist means a tap that does nothing. */
  function skeinBand() {
    if (!anchors || anchors.mode === 'rest') return null;
    var sc = anchors.mode === 'hang' ? 0.62 : 0.85, glyphH = 22 * sc;
    var aTop = 10, aBot = anchors.nameTop - 16 - glyphH;
    var bTop = anchors.stackBottom + 10, bBot = (fall.baseY || H - 60) - 10 - glyphH;
    var a = aBot - aTop, b = bBot - bTop;
    var top = { sc: sc, yTop: aTop, yBot: aBot }, low = { sc: sc, yTop: bTop, yBot: bBot };
    /* the sky above the name is the classic band and wins whenever it is
       both clear and tall enough; it is NOT clear when the garden hangs
       from the top edge, and on a phone it is often a sliver, so those
       visits get the open zone between the text and the meadow instead */
    var topFree = !(anchors.mode === 'hang' && anchors.canopy);
    if (topFree && a >= 24) return top;
    if (b >= 20) return low;
    if (topFree && a >= 6) return top;
    if (b >= 6) return low;
    return null;
  }

  function skeinWave(t, bandH) {
    var A = Math.min(14, bandH * 0.22);
    return Math.sin(t * 0.20 + flight.ph) * A + Math.sin(t * 0.083 + flight.ph2) * A * 0.7;
  }

  function drawFlock(tNow) {
    if (!flight) return;
    var band = skeinBand();
    if (!band) { flight = null; return; }
    var prog = (tNow - flight.t0) / flight.dur;
    if (prog < 0) return;
    if (prog > 1) { flight = null; return; }
    var sc = band.sc, yTop = band.yTop, yBot = band.yBot;
    var sideMax = Math.max(5, Math.min(20, (yBot - yTop) * 0.35));
    var headX = flight.dir > 0
      ? W + SKEIN_EDGE - flight.span * prog
      : -SKEIN_EDGE - flight.len + flight.span * prog;
    var drift = prog * prog * (3 - 2 * prog);
    var yBase = yTop + (yBot - yTop) * (flight.yj + (flight.yj2 - flight.yj) * drift);
    var b, i, p, bd, pts, px, py, amp, bx, by;
    for (b = 0; b < flight.birds.length; b++) {
      bd = flight.birds[b]; p = bd.g;
      amp = Math.floor(tNow * bd.beatF + bd.beatPh) % 2 ? 1 : 0.5;    // stop-motion wing-beat
      by = yBase + Math.max(-sideMax, Math.min(sideMax, bd.side)) + skeinWave(tNow - bd.back / flight.v, yBot - yTop);
      bx = flight.dir < 0
        ? headX + flight.len - bd.back - p.w * sc * bd.sc
        : headX + bd.back;
      by += wind(bx, tNow) * 2.5;
      by = Math.max(yTop, Math.min(yBot, by));
      pts = [];
      for (i = 0; i < p.pts.length; i++) {
        px = p.pts[i][0];
        py = p.mid + (p.pts[i][1] - p.mid) * amp;
        if (flight.dir < 0) px = p.w - px;
        pts.push([bx + px * sc * bd.sc, by + py * sc * bd.sc]);
      }
      stroke(pts, INK.line, 1.9, 0.78, 1, 9100 + b * 97 + (amp === 1 ? 0 : 13), 0.4);
    }
  }

  /* ---------------- the seedfall and the meadow ---------------- */

  var fall = { rng: null, vrng: null, tips: [], x0: 0, baseY: 0, lo: 0, hi: 0,
               blades: [], cells: {}, replayed: 0, hang: false, laneX: 0, laneMin: 0, drops: [] };

  /* the descent, one waypoint per 26 px air-row: a coin-flip step pulled
     gently back toward the aim column; in hang mode a release above the
     text keeps to the right margin while beside it, then drifts free */
  function fallPath(rx, ry, aim, rng) {
    var pts = [[rx, ry]], x = rx, y = ry;
    while (y < fall.baseY - 1) {
      y = Math.min(fall.baseY, y + 26);
      var inLane = fall.hang && anchors && y < anchors.stackBottom + 12;
      var a = inLane ? fall.laneX : aim;
      var pull = inLane ? 0.5 : (fall.hang ? 0.35 : 0.06);
      var sig = inLane ? 2.5 : (fall.hang ? 9 : 10);
      x += (a - x) * pull + (rng() * 2 - 1) * sig;
      pts.push([x, y]);
    }
    pts[pts.length - 1][0] = Math.max(fall.lo, Math.min(fall.hi, x));
    return pts;
  }

  function addBlade(x, born, rng) {
    var c = Math.round(x / 6);
    var n = fall.cells[c] || 0;
    fall.cells[c] = n + 1;
    /* repeat landings thicken the tuft upward, never denser sideways */
    if (n >= 7 || fall.blades.length >= 96) return;
    var bx = c * 6 + (rng() - 0.5) * 3.2;
    var h = 6 + n * 2.0 + rng() * 1.5;
    var lean = (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.45);
    fall.blades.push({ x: bx, h: h, lean: lean, born: born,
                       col: rng() < 0.82 ? INK.sage : INK.dim, grain: rng() < 0.16 });
  }

  /* the day so far: one landing kept per ~8 min of daylight after 06:30;
     the small hours keep the evening's full stand */
  function dayKept() {
    if (!fall.tips.length) return 0;
    if (dayS() < 5 * 3600) return 64;
    return Math.min(64, Math.floor(Math.max(0, dayS() - 6.5 * 3600) / 480));
  }
  /* the day's landings are already there: the meadow never sweeps in */
  function replayLandings(count) {
    var d, tip, p;
    for (d = 0; d < count; d++) {
      tip = fall.tips[(fall.rng() * fall.tips.length) | 0];
      p = fallPath(tip[0], tip[1], fall.x0, fall.rng);
      addBlade(p[p.length - 1][0], -10, fall.rng);
    }
    fall.replayed += count;
  }

  function meadowInit() {
    fall.rng = stream(6);
    fall.vrng = vstream(6);
    fall.blades.length = 0;
    fall.cells = {};
    fall.drops.length = 0;
    fall.tips.length = 0;
    fall.replayed = 0;
    fall.hang = anchors && anchors.mode === 'hang';
    if (anchors && anchors.mode === 'rest') return;
    var s0 = sprigs[0], i;
    var anchorHangs = !!s0 && s0.oy <= 4;
    if (s0) for (i = 0; i < s0.tips.length; i++) fall.tips.push(s0.tips[i]);
    fall.laneMin = (anchors ? anchors.stackRight : W - 24) + 6;
    fall.laneX = Math.min(W - 6, Math.max(W - 14, fall.laneMin + 4));
    if (fall.hang) {
      if (anchorHangs) {
        var laneTips = [];
        for (i = 0; i < fall.tips.length; i++) if (fall.tips[i][0] >= fall.laneMin) laneTips.push(fall.tips[i]);
        fall.tips = laneTips.length ? laneTips : [[fall.laneX, -12]];
      } else if (!fall.tips.length) {
        fall.tips = [[fall.laneX, -12]];     // no tree fits: the canopy is beyond the top edge
      }
    }
    if ((!fall.hang || !anchorHangs) && fall.tips.length > 3) fall.tips = upperHalf(fall.tips);
    var trunkX = s0 ? s0.ox : W * 0.75;
    fall.x0 = fall.hang ? W * 0.62 : trunkX;
    fall.baseY = fall.hang ? ((anchors ? anchors.footerTop : H - 46) - 28) : H - 6;
    fall.lo = fall.hang ? Math.max(18, W * 0.30) : Math.max(18, (anchors ? anchors.footerRight : 160) + 30);
    fall.hi = W - 22;
    replayLandings(dayKept());
  }

  function upperHalf(tips) {
    var loY = Infinity, hiY = -Infinity, keep = [], i;
    for (i = 0; i < tips.length; i++) { loY = Math.min(loY, tips[i][1]); hiY = Math.max(hiY, tips[i][1]); }
    for (i = 0; i < tips.length; i++) if (tips[i][1] <= loY + (hiY - loY) * 0.5) keep.push(tips[i]);
    return keep.length ? keep : tips;
  }

  /* tips a shaken sprig may release from: only where the fall stays clear
     of the words — below the text, or in the right-margin lane in hang
     mode; the aim column is the sprig's own trunk, kept inside the meadow */
  function releaseTips(sprig) {
    var i, out = [], tips = sprig.tips;
    if (sprig.oy <= 4) {
      if (!fall.hang) return [];
      for (i = 0; i < tips.length; i++) if (tips[i][0] >= fall.laneMin) out.push(tips[i]);
      return out;
    }
    for (i = 0; i < tips.length; i++) if (!anchors || tips[i][1] >= anchors.stackBottom + 12) out.push(tips[i]);
    return upperHalf(out);
  }

  /* returns when the blade it plants has finished growing */
  function letGo(tip, aim, t0) {
    var pts = fallPath(tip[0], tip[1], aim, fall.vrng);
    fall.drops.push({ t0: t0, pts: pts, ry: tip[1], v: DROP_V });
    return t0 + Math.max(20, fall.baseY - tip[1]) / DROP_V + 0.6;
  }

  /* returns when this answer is over: the ring has died away and the last
     seed has landed and grown its blade */
  function shake(sprig, t) {
    sprig.shakeT = t;
    var done = t + 5.5;
    var tips = releaseTips(sprig), i, k, tip, end;
    if (!tips.length) return done;
    k = Math.min(seedsPerShake, tips.length);
    var aim = sprig.oy <= 4 ? fall.x0 : Math.max(fall.lo + 30, Math.min(fall.hi - 30, sprig.ox));
    for (i = 0; i < k; i++) {
      tip = tips[(fall.vrng() * tips.length) | 0];
      end = letGo(tip, aim, t + 0.4 + 0.9 * i + 0.5 * fall.vrng());
      if (end > done) done = end;
    }
    return done;
  }

  function drawMeadow(tNow) {
    var i, b, t, by, tx, ty, wv;
    for (i = 0; i < fall.blades.length; i++) {
      b = fall.blades[i];
      t = Math.min(1, (tNow - b.born) / 0.6);
      if (t <= 0) continue;
      wv = wind(b.x, tNow) * 1.3;
      by = fall.baseY + nz(i * 17) * 1.5;
      tx = b.x + b.lean * b.h * 0.45 + wv; ty = by - b.h;
      stroke([[b.x, by],
              [b.x + b.lean * b.h * 0.18 + wv * 0.5, by - b.h * 0.55],
              [tx, ty]],
             b.col, 1.3, 0.7, t, 7300 + i * 67);
      if (b.grain && t === 1) {
        stroke([[tx - 1.5, ty - 1.5], [tx + 2, ty - 3]], INK.ochre, 1.5, 0.7, 1, 7301 + i * 67);
      }
    }
  }

  function drawSeeds(tNow) {
    var i = 0, d, yNow, last, idx, i0, f, x, a, ca, sa;
    while (i < fall.drops.length) {
      d = fall.drops[i];
      if (tNow < d.t0) { i++; continue; }
      yNow = d.ry + (tNow - d.t0) * d.v;
      last = d.pts.length - 1;
      idx = (yNow - d.ry) / 26;
      if (yNow >= fall.baseY || idx >= last) {
        addBlade(d.pts[last][0], tNow, fall.vrng);
        fall.drops.splice(i, 1);
        continue;
      }
      i0 = idx | 0; f = idx - i0;
      x = d.pts[i0][0] + (d.pts[i0 + 1][0] - d.pts[i0][0]) * f;
      x += wind(x, tNow) * 2;
      a = Math.sin(yNow / 15) * 0.55 + 0.25;
      ca = Math.cos(a); sa = Math.sin(a);
      stroke([[x - 3.5 * ca, yNow - 3.5 * sa], [x + 3.5 * ca, yNow + 3.5 * sa]], INK.verm, 1.6, 0.85, 1, 7999 + i * 13);
      stroke([[x + 2 * ca, yNow + 2 * sa], [x + 2 * ca - 3 * sa, yNow + 2 * sa + 3 * ca]], INK.verm, 1.2, 0.7, 1, 7998 + i * 13);
      i++;
    }
  }

  /* ---------------- layout ---------------- */

  function measureAnchors() {
    var name = document.querySelector('h1');
    var links = document.querySelectorAll('footer a');
    var a = { nameTop: H * 0.2, footerTop: H - 46, footerRight: 160, stackLeft: W * 0.3, stackBottom: H * 0.6 };
    if (name) a.nameTop = name.getBoundingClientRect().top;
    if (links.length) {
      a.footerTop = links[0].getBoundingClientRect().top;
      a.footerRight = links[links.length - 1].getBoundingClientRect().right;
    }
    var stack = document.querySelector('.stack');
    if (stack) {
      var r3 = stack.getBoundingClientRect();
      a.stackLeft = r3.left;
      a.stackRight = r3.right;
      a.stackTop = r3.top;
      a.stackBottom = r3.bottom;
    } else {
      a.stackRight = W * 0.7; a.stackTop = H * 0.25;
    }
    /* Where is there room? Standing trees need ~210*scale+20 px below the
       text; hanging ones ~140*scale+8 above it. On a phone the meadow
       strip above the footer can carry standing trees too (standCap), and
       even without any tree the seeds can still fall into the strip when
       the band between the text and the footer is 60 px or more. When
       nothing fits (short landscape viewports), the garden rests. */
    a.bedCap = (H - a.stackBottom - 44) / 210;
    a.hangCap = (a.nameTop - 32) / 140;
    a.stripY = a.footerTop - 30;
    a.standCap = (a.stripY - a.stackBottom - 22) / 210;
    a.canopy = a.hangCap >= 0.42;
    a.stand = W < 700 && a.standCap >= 0.32;
    var band = a.footerTop - a.stackBottom;
    a.mode = W < 700 ? ((a.canopy || a.stand || band >= 60) ? 'hang' : 'rest')
                     : (a.bedCap >= 0.5 ? 'beds'
                        : (a.canopy ? 'hang' : 'rest'));
    anchors = a;
  }

  /* plants the place; `opening` leaves the youngest branch mid-draw */
  function layout(opening) {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    measureAnchors();
    plantDayGarden(opening);
    meadowInit();
    flight = null;
    gusts.length = 0;
  }

  /* ---------------- frames: awake and at rest ---------------- */

  var clock0 = 0, raf = 0, tmr = 0, lastFr = -1, aliveUntil = 0;
  function nowT() { return clock0 ? (performance.now() - clock0) / 1000 : 0; }

  function render(tNow, live) {
    animatingNow = live;
    breath = live ? 0.15 * Math.sin(tNow * 0.19 + windPhVisit) : 0;
    if (live) pruneGusts(tNow);
    ctx.clearRect(0, 0, W, H);
    drawFlock(tNow);
    drawMeadow(tNow);
    var i;
    for (i = 0; i < sprigs.length; i++) drawSprig(sprigs[i], tNow);
    drawSeeds(tNow);
  }

  function frame(tms) {
    raf = 0;
    if (!clock0) clock0 = tms;
    var t = (tms - clock0) / 1000;
    if (t >= aliveUntil) { settle(); return; }
    var fr = Math.floor(t * FPS);
    if (fr !== lastFr) {
      lastFr = fr;
      boilPhase = Math.floor(t * BOIL_FPS);   // the boil keeps its own rate
      render(t, true);
    }
    var wait = Math.max(4, ((fr + 1) / FPS - t) * 1000 + 1);
    tmr = setTimeout(function () { tmr = 0; raf = requestAnimationFrame(frame); }, wait);
  }
  function start() {
    if (!raf && !tmr && !still() && !resting() && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (tmr) { clearTimeout(tmr); tmr = 0; }
  }
  function wake(until) {
    if (until > aliveUntil) aliveUntil = until;
    start();
  }
  /* the garden comes to rest: every answer completes at once (seeds land,
     the skein has passed, the gusts are gone, the growth is finished) and
     one still frame is drawn in the day's hand */
  function settle() {
    stop();
    aliveUntil = 0;
    var i, d;
    for (i = 0; i < fall.drops.length; i++) {
      d = fall.drops[i];
      addBlade(d.pts[d.pts.length - 1][0], -10, fall.vrng);
    }
    fall.drops.length = 0;
    flight = null;
    gusts.length = 0;
    for (i = 0; i < sprigs.length; i++) { sprigs[i].born = -100; sprigs[i].shakeT = -100; }
    for (i = 0; i < fall.blades.length; i++) fall.blades[i].born = -10;
    restFrame();
  }
  function restFrame() {
    boilPhase = 3;
    if (resting()) { ctx.clearRect(0, 0, W, H); return; }
    render(1e4, false);
  }

  /* ---------------- touch ---------------- */

  function hitSprig(x, y) {
    var i, s;
    for (i = sprigs.length - 1; i >= 0; i--) {
      s = sprigs[i];
      if (x >= s.x0 - 6 && x <= s.x1 + 6 && y >= s.y0 - 6 && y <= s.y1 + 6) return s;
    }
    return null;
  }
  function onMeadow(x, y) {
    return fall.baseY > 0 && Math.abs(y - fall.baseY + 8) <= 30 && x >= fall.lo - 30 && x <= fall.hi + 30;
  }
  /* the sky is where the birds actually fly, generously padded so a thumb
     finds it; above the name it also takes the whole margin */
  function inSky(y) {
    var band = skeinBand();
    if (!band) return false;
    if (y >= band.yTop - 24 && y <= band.yBot + 24) return true;
    return band.yTop < anchors.stackTop && y > 4 && y < band.yBot + 24;
  }
  /* a seed pressed into open ground: the existing guards — never on or into
     the typography, scaled to the clearance near it, 60 px root spacing,
     a cap that evicts the oldest planted sprig and never a day sprig */
  function plantAt(x, y, born) {
    var sc2 = 0.55 + seedRng() * 0.35;
    /* near the words the sprig is scaled to the clearance, so its canopy can
       never reach the glyphs; too close and nothing is planted at all */
    if (x > anchors.stackLeft - 110 && x < anchors.stackRight + 110) {
      var vGap = (y > H * 0.4 ? y - anchors.stackBottom : anchors.stackTop - y) - 26;
      sc2 = Math.min(sc2, vGap / 185);
      if (sc2 < 0.3) return false;
    }
    var i, dx, dy;
    for (i = 0; i < sprigs.length; i++) {
      dx = sprigs[i].ox - x; dy = sprigs[i].oy - y;
      if (dx * dx + dy * dy < 3600) return false;
    }
    if (sprigs.length >= 14) sprigs.splice(dayCount, 1);
    var upward = y > H * 0.4 ? -Math.PI / 2 : Math.PI / 2;
    sprigs.push(buildSprig(x, y, upward + (seedRng() - 0.5) * 0.6, sc2, seedRng, born));
    return true;
  }

  var lastClick = 0;
  document.addEventListener('click', function (e) {
    if (!anchors || resting()) return;
    if (e.target.closest('a, button')) return;
    var x = e.clientX, y = e.clientY;
    /* The words are for reading and selecting, so a tap ON them is never the
       garden's. Keep that halo TIGHT: it used to be 40 px below the text and
       70 px to the sides, which on a phone is the whole width and swallowed
       the band the birds fly in — a tap that should have sent a skein did
       nothing at all. Clearance from the glyphs is a PLANTING concern, and
       plantAt() enforces it on its own. */
    if (y > anchors.stackTop - 6 && y < anchors.stackBottom + 6 &&
        x > anchors.stackLeft - 6 && x < anchors.stackRight + 6) return;
    if (y > anchors.footerTop - 10 && x < anchors.footerRight + 12) return;
    var now = performance.now();
    if (now - lastClick < 250) return;
    lastClick = now;
    if (still()) {
      /* reduced motion: a finished sprig, nothing moves */
      if (!hitSprig(x, y) && !onMeadow(x, y) && plantAt(x, y, -100)) restFrame();
      return;
    }
    var t = nowT();
    var small = 0.35 * (0.5 + 0.5 * breeze);
    var gustEnd = t + GUST_LIFE;
    var hit = hitSprig(x, y);
    if (hit) {                                  // the tree rings, its seeds fall
      var done = shake(hit, t);
      addGust(x, t, small);
      wake(Math.max(done, gustEnd));
      return;
    }
    /* the sky is checked BEFORE the meadow: on a short phone the two bands
       nearly touch, and the birds are the answer that is hard to find */
    if (inSky(y)) {                             // a skein crosses, unhurried
      if (!flight) startFlight(t + 0.15);
      addGust(x, t, small);
      wake(Math.max(flight ? flight.end : 0, gustEnd));
      return;
    }
    if (onMeadow(x, y)) {                       // a gust travels out through the garden
      addGust(x, t, 0.5 + 0.5 * breeze);
      wake(gustEnd);
      return;
    }
    if (plantAt(x, y, t)) {                     // a sprig draws itself in, generation by generation
      addGust(x, t, small);
      wake(Math.max(t + SPRIG_S + 0.3, gustEnd));
      return;
    }
    /* nowhere to plant (too near the words, too near another root): the
       garden still answers — a tap is never simply swallowed */
    addGust(x, t, small);
    wake(gustEnd);
  });

  /* ---------------- lifecycle ---------------- */

  var hiddenAt = 0;
  var seen = !document.hidden;
  function catchUp() {
    replayLandings(Math.max(0, Math.min(12, dayKept() - fall.replayed)));
    if (gardenRng && anchors && anchors.mode !== 'rest' && dayPlanted < 6 && daySprigs() > dayPlanted) {
      plantOne(dayPlanted, gardenRng, -100);
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      hiddenAt = performance.now();
      if (aliveUntil) settle();          // a hidden garden is at rest
      return;
    }
    if (hiddenAt) {
      var hiddenFor = performance.now() - hiddenAt;
      hiddenAt = 0;
      awayS += hiddenFor / 1000;
      if (!seen) {
        /* opened in a background tab: this first look is the arrival — the
           boot frame (which could not run while hidden) opens the door now */
        seen = true;
      } else if (hiddenFor >= 480e3 && anchors) { catchUp(); restFrame(); }
    }
  });
  /* bfcache: stop() alone would leave a skein parked mid-sky and a seed
     hanging in the air if no visibilitychange follows (Safari back/forward),
     so settle the garden outright — the restored page is then at rest */
  window.addEventListener('pagehide', function () { if (aliveUntil) settle(); else stop(); });

  var rsTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(function () {
      if (!anchors) return;
      stop(); aliveUntil = 0;
      layout(false);                      // re-plants the place, already grown; never re-opens
      restFrame();
    }, 150);
  });
  function onStillChange() {
    if (!anchors) return;
    if (still()) { if (aliveUntil) settle(); else restFrame(); }
  }
  listenMq(mqReduce, onStillChange);
  listenMq(mqForced, onStillChange);

  /* ---------------- boot ---------------- */

  if (!seen) hiddenAt = initNow;

  requestAnimationFrame(function (tms) {
    clock0 = tms;
    if (!seen) { awayS += (performance.now() - initNow) / 1000; seen = true; hiddenAt = 0; }
    if (still()) {
      layout(false);
      restFrame();
    } else {
      layout(true);                 // the youngest branch finishes drawing
      wake(OPEN_S);
    }
    doc.classList.add('ink-ready');
  });
})();
