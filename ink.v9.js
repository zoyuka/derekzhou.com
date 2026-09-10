/* The ink garden, at night — a hand-drawn day, clocked from local midnight.
   2D canvas, no libraries, no network. Every stroke is a wobbly polyline
   redrawn with fresh jitter a few times a second (the hand-drawn "boil"),
   so the page feels like ink held in a steady hand, never like a machine.

   THE PLACE is date-seeded and grows with the day: sparse at dawn, in
   full bloom by evening — the same garden for every visitor, all day.
   Branches draw themselves in (the youngest is still drawing its last
   generation as the door opens — growth in progress, never an event);
   every little while a seed lets go of
   the anchor sprig and flutters down, each sway of its fall a coin
   toss, planting a grass blade where it lands — a day of landings grows
   a stand of grass whose silhouette settles toward the bell curve (de
   Moivre-Laplace, drawn as meadow). Every little while, too, a small
   skein of birds — marks in a hand's own zigzag — meanders across the
   open band in stop-motion, wings beating like a flip-book, and leaves
   the sky quiet again. And ONE WIND moves through all of it (feng is
   wind, shui is water): a single slow field that the grass leans into,
   the canopies shear under, the seed drifts on and the skein bobs over — with spatial phase, so the gust visibly
   travels across the garden, in this visit's direction.
   Click anywhere open: a seed is planted and a new sprig grows there.

   THE WEATHER is visit-seeded — the one =rand() cell on the page: ONE
   entropy read at init, layered over the day seed; never stored, never
   shown, never in the URL, never contingent on anything the visitor
   does. It owns only what a day's weather would: a triangular "front"
   and four facets — the breeze (breeze in [0.17, 1.0], applied as the
   gust gain g = 0.75 + 0.25*breeze*(0.7 + 0.3*noise) in [0.75, 1.0],
   with a travel direction), the sky's traffic, the seedfall's tempo,
   the hand's steadiness — plus what is already underway when the door
   opens: a skein mid-crossing (45 %), a seed (20 %: mid-fall where the
   fall is long enough, else letting go right after the reveal), or a
   quiet sky (35 %). The place is the day's; the
   weather is this visit's; the reduced-motion still frame is the day's
   alone.

   THE CALM ENVELOPE (any change must keep all of this true):
   - boil rate <= 6 fps (BOIL_FPS 5); jitter <= 1.6 px (1.2–1.6 per visit)
   - THE WIND is one field w(x,t) at 0.048 Hz (~570 px wavelength), the
     fastest oscillation on the page, driving grass lean (1.3 px),
     canopy shear (<= 2.4 px), seed drift (2 px) and bird bob (2.5 px); those gains are CEILINGS, scaled by this visit's
     gust gain in [0.75, 1.0] (breeze itself spans [0.17, 1.0]) under a
     110–180 s gust envelope, travelling leftward or rightward per visit
   - exceptions: the falling seed (one at a time, <= 90 px/s total,
     DROP_V 82 vertical; the next release is scheduled from the LANDING
     — mean gap 9–13 s, 12–16 s after 23:00 / before 05:00, clamped
     5.5–18 s — so a long phone fall never chains straight into the
     next) and skein crossings (<= 14 px/s glide,
     wing-beats < 1 Hz, one at a time, mean gap 26–44 s, 36–54 s late,
     clamped 10–60 s)
   - strokes only — never clustered dots (hard rule); no fills, no arcs
   - ink alphas <= 0.85; night ground #181410; palette fixed to the six inks
   - prefers-reduced-motion: the DAY's garden fully drawn as one still
     frame (day wind phase, no weather), zero boil, rAF never starts;
     live listener both directions; forced-colors (canvas hidden by
     CSS) is treated the same — no loop, no pause button
   - pause button: label swap only; freezes the frame and all clocks
     (resume continues the same moment via pauseShift — a paused load
     draws the live frame at t = 0, the exact frame resume continues
     from, never the far-future still frame; a span frozen BEFORE the
     first live frame is never a shift, so resume can never run the
     scene clock negative); persists (ink-paused); ships wherever the
     loop ships
   - JS off / canvas failure: typography on the night ground, nothing lost
   - no ink under the measured typography or footer boxes; clicks there
     never plant; click-planted sprigs keep 60 px root spacing; when a
     viewport has no room (short landscape), the garden rests: nothing
     is drawn, the loop does not run and the pause button stays hidden
     (a control for nothing is exactly the body language the page
     refuses); the typography carries the page
   - ONE clock read and ONE entropy read, both at init above the
     INIT-END marker; nothing below it reads the wall clock or unseeded
     randomness (performance.now DELTAS only, for pause / hidden-tab
     bookkeeping — not a clock read)
   - one 2D canvas, one rAF loop that truly sleeps between boil frames
   - the tab title and the favicon never change; nothing listens for the
     pointer's position, idling, focus loss or leaving (pagehide only
     clears the frame timers, so bfcache can keep the page) — idle is
     not a state, leaving is silence
   - a hidden tab freezes the clocks (one frozenAt for pause, hidden and
     reduced motion together, so no path can double-count or skip a
     span); a return after >= 8 min shows only a statically fuller
     garden (the day's own replay continued: <= 12 blades and at most
     one fully grown sprig — a frozen still/paused frame is redrawn
     once to show it); a page opened in a background tab counts the
     span until its first look and plants the place at that minute, the
     first look being the arrival; nothing animates, fires or is
     scheduled on return
   - no state persisted but ink-paused
   - shakkei (borrowed scenery) entries are protected as EXTENT, not
     decoration: the skein enters from beyond the canvas edge
   - rejected: toasts, a visible seed or forecast, easter eggs, a second
     novel system; and grep-enforced by CI (validate.yml, "Absences are
     enforced"): custom cursors, exit/idle/title handlers, any query or
     hash hook on the URL (a ?seed= would be one), any sound, unseeded
     randomness, any clock or entropy read below INIT-END, fills, arcs,
     alphas above 0.85 */

(function () {
  'use strict';

  /* ---------------- config ---------------- */

  var BOIL_FPS = 5;            // hand-tremor redraw rate
  var JITTER = 1.6;            // px, wobble ceiling (the still frame's hand)
  var GROW_MS = 2600;          // self-draw time per branch generation
  var DROP_V = 82;             // px/s fall speed
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
  /* DAY streams — the place: 1 noise table, 2 day sprigs, 3 click sprigs,
     6 meadow replay, 8 urn, 10 still-frame wind phase */
  var stream = function (n) { return sm32((daySeed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0); };

  /* =rand(): the one entropy read. A visit seed, layered over the day
     seed, owns the weather and nothing else. Drawn once, here; never
     persisted, never displayed, never in the URL, never reseeded by a
     click, a resize or a returning tab. Everything downstream is a pure
     function of (daySeed, visitSeed, measured layout, clicks, scene time). */
  var visitSeed = (function () {
    try { if (self.crypto && crypto.getRandomValues) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] >>> 0; } } catch (e) {}
    return ((performance.now() * 1000) ^ daySeed) >>> 0;
  })();
  /* VISIT streams — the weather: 6 live seedfall, 9 skein, 11 weather
     record, 12 wind, 13 opening state, 15 hand */
  var vstream = function (n) { return sm32((visitSeed ^ daySeed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0); };

  /* the weather record: ONE front, four facets, quiet hours. The front is
     triangular (most visits ordinary, extremes rare) and every facet leans
     on it, so a still visit is still everywhere — low breeze, sparse sky,
     slow seeds, steadier hand — and a breezy one breezy everywhere; never
     five unrelated dials. Every draw maps into a designed, audited range. */
  var wr = vstream(11);
  var front = (wr() + wr()) / 2;
  function facet() { return 0.7 * front + 0.3 * wr(); }
  var fBreeze = facet(), fTraffic = facet(), fTempo = facet(), fHand = facet();
  var night = midnightS >= 23 * 3600 || midnightS < 5 * 3600;   // quiet hours: behaviour, never palette
  var breeze = (0.2 + 0.8 * fBreeze) * (night ? 0.85 : 1);      // [0.17, 1.0]
  var skeinMean = (night ? 36 : 26) + 18 * (1 - fTraffic);       // s: [26, 44] ([36, 54] late)
  var dropMean = (night ? 12 : 9) + 4 * (1 - fTempo);            // s: [9, 13] ([12, 16] late)
  var handJitter = 1.2 + 0.4 * fHand;                            // px: [1.2, 1.6]

  /* the wind's visit: its own phase, a travel direction, and a gust
     envelope period (incommensurate with the 20.9 s field period) */
  var windPhDay = stream(10)() * 6.283;      // the still frame's phase: the day's
  var wv = vstream(12);
  var windPhVisit = wv() * 6.283;
  var windDir = wv() < 0.5 ? -1 : 1;
  var gustP = 110 + 70 * wv();               // s per gust sample: 110–180
  var gustOff = (wv() * 4096) | 0;

  /* what is already underway when the door opens — exactly one thing may
     be stirring, never two: a skein mid-crossing (45 %), a seed mid-fall
     (20 %, only where the fall is long enough), or a quiet sky (35 %) */
  var op = vstream(13);
  var u0 = op();
  var opening = u0 < 0.45 ? 'skein' : (u0 < 0.65 ? 'seed' : 'quiet');
  var openU = op();                          // how far along the opening seed already is
  var quietSeedS = 5 + 4 * op();             // a quiet opening's first live seed: 5–9 s

  /* the hand's visit: a steadiness (handJitter) and a tremor offset */
  var hv = vstream(15);
  var tremorOff = (hv() * 4096) | 0;

  /* ---- INIT-END: no clock or entropy reads below this line ---- */

  /* deterministic smooth noise for the boil (indexed, not time-random) */
  var NOISE_N = 4096;
  var noiseTab = new Float32Array(NOISE_N);
  (function () { var r = stream(1), i; for (i = 0; i < NOISE_N; i++) noiseTab[i] = r() * 2 - 1; })();
  function nz(i) { return noiseTab[(i | 0) & (NOISE_N - 1)]; }

  /* ---------------- the wind ----------------
     feng is wind, shui is water. This is the wind made visible: ONE
     slow field moves everything — the grass's lean, the canopies'
     shear, the falling seed's drift, the skein's bob — with a spatial
     phase, so the gust visibly travels across the garden. 0.048 Hz, ~570 px
     wavelength, fixed. The still frame rides the day's phase at gain 1;
     live frames ride this visit's phase, travel direction and gust. */
  var wPh = windPhDay, wDir = 1, wG = 1;    // set at the head of every render()
  function wind(x, t) { return Math.sin(t * 0.30 + wDir * x * 0.011 + wPh) * wG; }
  /* the gust envelope: two day-noise samples per period, smoothstepped —
     1/f-shaped, never faster than the field. Floor 0.75, so nothing
     that should move reads as still. */
  function gust(t) {
    var k = t / gustP, i = Math.floor(k), f = k - i;
    f = f * f * (3 - 2 * f);
    var a = nz(i + gustOff), v = a + (nz(i + 1 + gustOff) - a) * f;
    return 0.75 + 0.25 * breeze * (0.7 + 0.3 * v);                // >= 0.767 (lowest breeze, v = -1); documented floor 0.75, ceiling 1.0
  }

  /* ---------------- DOM ---------------- */

  var canvas = document.getElementById('ink');
  var pauseBtn = document.getElementById('ink-pause');
  if (!canvas) return;
  var doc = document.documentElement;
  var ctx = canvas.getContext('2d');
  if (!ctx) { canvas.parentNode.removeChild(canvas); doc.classList.add('ink-ready'); return; }

  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  /* forced colors hide the canvas (style.css): no loop, no pause button —
     a control for nothing is exactly the body language the page refuses */
  var mqForced = matchMedia('(forced-colors: active)');
  function still() { return mqReduce.matches || mqForced.matches; }
  /* no room for a garden (short landscape): nothing is drawn, so the
     loop does not run and the pause button is not shown */
  function resting() { return !!anchors && anchors.mode === 'rest'; }
  function listenMq(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  var W = 0, H = 0, DPR = 1;
  var anchors = null;          // positions measured from the real DOM

  /* ---------------- stroke machinery ---------------- */

  var boilPhase = 0;           // increments per boil frame; keys the jitter
  var animatingNow = false;    // set by render(): live frames use this visit's hand

  /* draw a polyline with hand wobble; t in [0,1] reveals it progressively.
     The polyline is the day's; only the boil's wobble — its amplitude
     (1.2–1.6 px) and noise offset — is this visit's. The still frame keeps
     the ceiling (1.6 px) and offset 0, so it is the day's alone. */
  function stroke(pts, color, width, alpha, t, key) {
    var n = pts.length;
    if (n < 2) return;
    var upto = Math.max(2, Math.ceil(n * (t === undefined ? 1 : t)));
    var jit = animatingNow ? handJitter : JITTER;
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

  /* The day's temperament: a Polya urn over the blossom inks. Colors drawn
     reinforce themselves, so each day leans warm or green — same six inks,
     different weather. */
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
    var segs = [];
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
      }
      segs.push({ pts: pts, w: Math.max(0.8, 2.2 - depth * 0.45), gen: gen, key: (segs.length + 1) * 397 });
      /* blossoms at the tips */
      if (depth >= 2 && rng() < 0.75) {
        segs.push({ tip: [cx, cy], kind: rng() < 0.5 ? 'petal' : 'burst',
                    col: urn(rng),
                    gen: gen + 1, key: (segs.length + 1) * 397 });
      }
      var kids = depth === 0 ? 3 : (rng() < 0.6 ? 2 : 1), k;
      for (k = 0; k < kids; k++) {
        /* symmetric branching slots (fair coins), so the canopy settles
           toward a balanced, binomial silhouette instead of wandering */
        var slot = kids === 1 ? (rng() < 0.5 ? -1 : 1) * 0.35
                              : (k - (kids - 1) / 2) * (kids === 3 ? 0.8 : 1.15);
        grow(cx, cy, a + slot + (rng() - 0.5) * 0.25, len * (0.55 + rng() * 0.2), depth + 1, gen + 1);
      }
    }
    grow(x0, y0, ang0, 64 * scale, 0, 0);
    return { segs: segs, born: born, ox: x0, oy: y0 };
  }

  function drawSprig(sprig, tNow) {
    /* the canopy shears gently with the wind — most at the far tips,
       nothing at the rooted base */
    var wv = wind(sprig.ox, tNow) * 2.4;
    var i, s, g, t, j, d, pts2, tx, ty;
    for (i = 0; i < sprig.segs.length; i++) {
      s = sprig.segs[i];
      g = (tNow - sprig.born) / (GROW_MS / 1000) - s.gen;    // generations stagger
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

  var sprigs = [];             // day sprigs first (sprigs[0] is the anchor), click sprigs after
  var seedRng = stream(3);
  var gardenRng = null;        // the day's sprig stream, kept alive so a return can continue it
  var dayCount = 0;            // day sprigs present in sprigs[]
  var dayPlanted = 0;          // day slots consumed (a sprig too small to draw still uses its slot)

  /* the day's clock: read once at init; a hidden tab adds the seconds it
     was away, so the place a returning visitor sees is the place a fresh
     visitor at that minute would see — statically, nothing fast-forwards */
  var awayS = 0;
  function dayS() { return midnightS + awayS; }
  /* the day decides how much has grown: 0 at 05:00, full at 21:00 —
     eased logistically (smootherstep), the way things actually grow */
  function dayFrac() {
    var lin = Math.max(0, Math.min(1, (dayS() / 3600 - 5) / 16));
    return lin * lin * (3 - 2 * lin);
  }
  function daySprigs() { return 2 + Math.round(dayFrac() * 4); }   // 2..6

  function plantOne(i, r, born) {
    var narrow = W < 700;
    var mode = anchors.mode;
    var x, y, ang, sc;
    var side = r();
    var hangThis = mode === 'hang' || (mode === 'beds' && i > 0 && side >= 0.75);
    if (i === 0) {                       // the anchor sprig: the seedfall's canopy
      if (mode === 'hang') { x = W * (narrow ? 0.88 : 0.9); y = 4; ang = Math.PI / 2 + (r() - 0.5) * 0.3; }
      else { x = W * (0.74 + r() * 0.08); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.4; }
      sc = (mode === 'hang' ? 0.7 : 1.0) + r() * 0.25;
    } else if (hangThis) {               // hanging from the top edge
      x = mode === 'hang' ? W * (0.45 + side * 0.4) : W * (0.84 + r() * 0.1);
      y = 4; ang = Math.PI / 2 + (r() - 0.5) * 0.4;
      sc = (narrow ? 0.55 : 0.6) + r() * 0.25;
    } else if (side < 0.6) {             // bottom bed, left of the text column
      x = W * (0.28 + r() * 0.13); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.5;
      sc = 0.8 + r() * 0.5;
    } else {                             // bottom-right bed
      x = W * (0.72 + r() * 0.12); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.5;
      sc = 0.8 + r() * 0.5;
    }
    /* fit the tree to the measured room, and keep standing canopies
       clear of the pause button's corner */
    sc = Math.min(sc, y > 4 ? anchors.bedCap : anchors.hangCap);
    if (y > 4) x = Math.min(x, anchors.pauseLeft - 30 - 95 * sc);
    dayPlanted++;
    if (sc < 0.3) return;
    sprigs.splice(dayCount, 0, buildSprig(x, y, ang, sc, r, born));
    dayCount++;
  }

  function plantDayGarden() {
    sprigs.length = 0;
    dayCount = 0; dayPlanted = 0; gardenRng = null;
    if (!anchors || anchors.mode === 'rest') return;   // no room: the garden rests
    gardenRng = stream(2);
    var total = daySprigs(), i;
    for (i = 0; i < total; i++) {
      /* born pre-load, already grown — except the youngest, born at
         -10.4 s: its last generation draws itself in over the first
         2.6 s and its tip blossoms open at ~3.6 s (growth already in
         progress, not an event); at t = 1e4 (the still frame) it is
         complete, so the reduced-motion frame is unchanged */
      plantOne(i, gardenRng, (i === total - 1 && total > 1) ? -10.4 : -60 + i * 3);
    }
  }

  /* ---------------- the skein ----------------
     Birds in the stepped-zigzag stroke of Derek's tattoo — the three
     tattoo marks are the GLYPH ALPHABET, not a roster. Every little
     while (this visit's exponential gaps, mean 26–44 s) a small skein
     crosses the open band in stop-motion:
     - membership is a coin-flip sum per crossing (2..6 birds), some
       crossings a loner, some a strand of six, rarely a great skein;
     - the lead bird carries a slow undulation, and each follower
       echoes it with a lag equal to its distance back over the glide
       speed — the ripple travels down the line, the way real skeins
       ripple;
     - wing-beats are detuned per bird (0.68..0.95 Hz), so the flock
       drifts in and out of phase across a crossing — emergent beat
       patterns, never a metronome;
     - one straggler sometimes trails far behind;
     - entry altitude follows a golden-ratio (Kronecker) sequence, so
       consecutive crossings never fly the same lane.
     Direction is a Markov flip per crossing; as drawn the glyphs fly
     leftward, so rightward crossings mirror. One crossing at a time,
     <= 14 px/s, then the sky is empty again. The first crossing is the
     opening: sometimes already mid-band as the door opens. */

  var FLY_V = 12;              // px/s glide — a distant, unhurried crossing

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

  function nextFlight() {
    var r = flight.rng, first = flight.first;
    flight.first = false;
    var gap = first ? 0 : Math.min(60, Math.max(10, -Math.log(1 - r()) * skeinMean));
    /* who flies: usually a coin-flip skein of 2..6; sometimes a loner,
       rarely a great skein of 7..8 */
    var u = r();
    var n = u < 0.15 ? 1
          : u < 0.22 ? 7 + (r() < 0.5 ? 1 : 0)
          : 2 + (r() < 0.6 ? 1 : 0) + (r() < 0.45 ? 1 : 0)
              + (r() < 0.3 ? 1 : 0) + (r() < 0.18 ? 1 : 0);
    var birds = [], back = 0, i;
    for (i = 0; i < n; i++) {
      if (i) back += 26 + r() * 16;
      if (i === n - 1 && n > 2 && r() < 0.3) back += 55 + r() * 40;  // the straggler
      birds.push({
        g: GLYPHS[i === 0 && r() < 0.5 ? 2 : (r() * 2) | 0],  // long-tail often leads
        sc: 0.8 + r() * 0.35,
        back: back,
        side: (i % 2 ? 1 : -1) * (6 + r() * 15) * (i ? 1 : 0.3),
        beatF: 0.68 + r() * 0.27,
        beatPh: r() * 7
      });
    }
    flight.birds = birds;
    flight.len = back + 30;
    flight.dur = (W + flight.len + 190) / FLY_V;
    /* the first crossing is the opening: either already mid-band when the
       door opens (0.2–0.6 of the way across — never at a band edge, never
       entering at the load instant) or entering from beyond the edge at
       6–16 s (visible ~8 s later at 12 px/s) — never during the reveal */
    if (first) flight.t0 = opening === 'skein' ? -flight.dur * (0.2 + 0.4 * r()) : 6 + 10 * r();
    else flight.t0 = flight.end + gap;
    flight.end = flight.t0 + flight.dur;
    /* direction alternates more often than not (a Markov flip), so a
       visit sees both ways; altitude drifts from one level to another
       across the crossing — a meander, never a straight rush */
    if (!flight.prevDir) flight.prevDir = r() < 0.5 ? -1 : 1;
    flight.dir = r() < 0.72 ? -flight.prevDir : flight.prevDir;
    flight.prevDir = flight.dir;
    /* entry altitude from a Kronecker sequence (golden-ratio steps):
       consecutive crossings are always >= 0.27 of the band apart; the
       drift target stays uniform */
    flight.yj = 0.12 + 0.72 * ((flight.a0 + flight.k * 0.6180339887) % 1);
    flight.k++;
    flight.yj2 = 0.12 + 0.72 * r();
    flight.ph = r() * 6.283;
    flight.ph2 = r() * 6.283;
  }

  function resetFlight() {
    flight = { rng: vstream(9), end: 0, first: true, k: 0 };
    flight.a0 = flight.rng();
    nextFlight();
  }

  /* the shared undulation the skein rides; followers sample it lagged.
     Amplitude scales with the band so wide skies get real meanders. */
  function skeinWave(t, bandH) {
    var A = Math.min(14, bandH * 0.22);
    return Math.sin(t * 0.20 + flight.ph) * A + Math.sin(t * 0.083 + flight.ph2) * A * 0.7;
  }

  function drawFlock(tNow, animating) {
    if (!anchors || anchors.mode === 'rest' || !flight) return;
    var hangMode = anchors.mode === 'hang';
    var s = hangMode ? 0.62 : 0.85;
    var glyphH = 22 * s;
    var yTop, yBot;
    if (hangMode) {
      /* the open zone between the text and the meadow */
      yTop = anchors.stackBottom + 26;
      yBot = (fall.baseY || H - 60) - 26 - glyphH;
      if (yBot - yTop < 24) return;             // no room on very short viewports
    } else {
      yTop = 42;
      yBot = anchors.nameTop - 40 - glyphH;     // the sky band above the name
      if (yBot < yTop) return;
    }
    var sideMax = Math.max(5, Math.min(20, (yBot - yTop) * 0.35));
    var headX, yBase, flying = 0, prog = 0;
    if (!animating) {
      /* still frame: a resting pair mid-band, as drawn */
      headX = W * 0.52; yBase = yTop + (yBot - yTop) * 0.45;
    } else {
      while (tNow > flight.end) nextFlight();
      if (tNow < flight.t0) return;             // quiet sky between crossings
      prog = (tNow - flight.t0) / flight.dur;
      /* dir > 0: leftward as drawn (enters right, lead in front);
         dir < 0: rightward, mirrored (enters left) */
      headX = flight.dir > 0
        ? W + 95 - (W + flight.len + 190) * prog
        : -95 - flight.len + (W + flight.len + 190) * prog;
      var drift = prog * prog * (3 - 2 * prog);
      yBase = yTop + (yBot - yTop) * (flight.yj + (flight.yj2 - flight.yj) * drift);
      flying = 1;
    }
    var birds = flying ? flight.birds : [{ g: GLYPHS[0], sc: 1, back: 0, side: -4, beatF: 0, beatPh: 0 },
                                         { g: GLYPHS[2], sc: 0.95, back: 34, side: 6, beatF: 0, beatPh: 0 }];
    var b, i, p, bd, pts, px, py, amp, bx, by;
    for (b = 0; b < birds.length; b++) {
      bd = birds[b]; p = bd.g;
      /* stop-motion wing-beat, detuned per bird */
      amp = 1;
      if (flying) amp = Math.floor(tNow * bd.beatF + bd.beatPh) % 2 ? 1 : 0.5;
      /* the follower rides the lead's wave, lagged by its distance back,
         and bobs as the wind field passes under it */
      by = yBase + Math.max(-sideMax, Math.min(sideMax, bd.side))
         + (flying ? skeinWave(tNow - bd.back / FLY_V, yBot - yTop) : 0);
      bx = flying && flight.dir < 0
        ? headX + flight.len - bd.back - p.w * s * bd.sc
        : headX + bd.back;
      if (flying) by += wind(bx, tNow) * 2.5;
      by = Math.max(yTop, Math.min(yBot, by));
      pts = [];
      for (i = 0; i < p.pts.length; i++) {
        px = p.pts[i][0];
        py = p.mid + (p.pts[i][1] - p.mid) * amp;
        if (flying && flight.dir < 0) px = p.w - px;   // rightward crossings mirror
        pts.push([bx + px * s * bd.sc, by + py * s * bd.sc]);
      }
      stroke(pts, INK.line, 1.9, 0.78, 1, 9100 + b * 97 + (amp === 1 ? 0 : 13));
    }
  }

  /* ---------------- the seedfall (the garden's own galton board) ----------------
     Every little while a seed lets go of the anchor sprig and flutters
     down. Each row of its fall takes a coin-flip step pulled gently back
     toward its release column (a discrete Ornstein-Uhlenbeck walk) —
     pachinko with the pegs made of air. Where it lands, a grass blade
     takes root. A day of landings grows a stand of grass whose silhouette
     settles toward the binomial bell: de Moivre-Laplace, drawn as meadow.
     Release times are Poisson (exponential gaps), so the rhythm is
     memoryless — never a metronome; the gap is counted from the LANDING,
     so a long fall (hang mode: ~8 s) never chains straight into the next.
     Two streams: the DAY's (fall.rng) replays the meadow so far, identical
     for every visitor at the same minute; this VISIT's (fall.vrng) drives
     every live seed — its arrival, its walk, its release twig — so live
     landings never desynchronise the day's replay. */

  var fall = { rng: null, vrng: null, next: 0, drop: null, tips: [], x0: 0, baseY: 0,
               lo: 0, hi: 0, blades: [], cells: {}, replayed: 0, dayCount: 0, b0: 0, k: 0 };

  function fallGap() {
    var u = fall.vrng();
    return Math.min(18, Math.max(5.5, -Math.log(1 - u) * dropMean));
  }

  /* precomputed descent, one waypoint per 26 px air-row; on phones the
     seed keeps to the right margin while crossing the text, then drifts
     free below it (a channel opening into a spread — still pachinko).
     Desktop pull is light (sigma ~30 px with canopy spread: a real bell);
     the landing clamps into the meadow's bounds — walks stay smooth.
     The coin flips stay genuinely pseudo-random and unstratified: the
     bell must remain honest. */
  function fallPath(rx, ry, rng) {
    var pts = [[rx, ry]], x = rx, y = ry;
    while (y < fall.baseY - 1) {
      y = Math.min(fall.baseY, y + 26);
      var inLane = fall.hang && anchors && y < anchors.stackBottom + 12;
      var aim = inLane ? fall.laneX : fall.x0;
      var pull = inLane ? 0.5 : (fall.hang ? 0.35 : 0.06);
      var sig = inLane ? 2.5 : (fall.hang ? 9 : 10);
      x += (aim - x) * pull + (rng() * 2 - 1) * sig;
      pts.push([x, y]);
    }
    pts[pts.length - 1][0] = Math.max(fall.lo, Math.min(fall.hi, x));
    return pts;
  }

  function addBlade(x, born, rng) {
    var c = Math.round((x - fall.x0) / 6);
    var n = fall.cells[c] || 0;
    fall.cells[c] = n + 1;
    /* repeat landings thicken the tuft upward, never denser sideways;
       past the caps the meadow simply rests */
    if (n >= 7 || fall.blades.length >= 64) return;
    var bx = fall.x0 + c * 6 + (rng() - 0.5) * 3.2;
    var h = 6 + n * 2.0 + rng() * 1.5;
    var lean = (rng() < 0.5 ? -1 : 1) * (0.25 + rng() * 0.45);
    fall.blades.push({ x: bx, h: h, lean: lean, born: born,
                       col: rng() < 0.82 ? INK.sage : INK.dim,
                       grain: rng() < 0.16 });
  }

  /* the day so far: one landing kept per ~8 min of daylight after 06:30 */
  function dayKept() {
    return fall.tips.length ? Math.min(64, Math.floor(Math.max(0, dayS() - 6.5 * 3600) / 480)) : 0;
  }
  function replayLandings(count) {
    var d, tip, p;
    for (d = 0; d < count; d++) {
      tip = fall.tips[(fall.rng() * fall.tips.length) | 0];
      p = fallPath(tip[0], tip[1], fall.rng);
      addBlade(p[p.length - 1][0], -10, fall.rng);
    }
    fall.replayed += count;
  }
  /* live release twigs are spread by a Kronecker sequence (never the same
     twig twice running); the walk below stays a fair coin */
  function releaseTip() {
    var tip = fall.tips[(((fall.b0 + fall.k * 0.6180339887) % 1) * fall.tips.length) | 0];
    fall.k++;
    return tip;
  }

  function meadowInit() {
    fall.rng = stream(6);
    fall.vrng = vstream(6);
    fall.blades.length = 0;
    fall.cells = {};
    fall.drop = null;
    fall.tips.length = 0;
    fall.replayed = 0; fall.dayCount = 0; fall.k = 0; fall.b0 = 0;
    fall.hang = anchors && anchors.mode === 'hang';
    var s0 = sprigs[0], i;
    if (anchors && anchors.mode === 'rest') return;    // no garden, no fall
    if (s0) for (i = 0; i < s0.segs.length; i++) if (s0.segs[i].tip) fall.tips.push(s0.segs[i].tip);
    if (fall.hang) {
      /* hanging garden: release only from lane-side tips, so the crossing
         of the text zone stays strictly right of the measured stack box */
      var laneMin = (anchors ? anchors.stackRight : W - 24) + 6;
      fall.laneX = Math.min(W - 6, Math.max(W - 14, laneMin + 4));
      var laneTips = [];
      for (i = 0; i < fall.tips.length; i++) if (fall.tips[i][0] >= laneMin) laneTips.push(fall.tips[i]);
      fall.tips = laneTips.length ? laneTips : [[fall.laneX, 70]];
    } else if (fall.tips.length > 3) {
      /* release only from the upper canopy, so every fall has real air */
      var loY = Infinity, hiY = -Infinity, keep = [];
      for (i = 0; i < fall.tips.length; i++) {
        loY = Math.min(loY, fall.tips[i][1]); hiY = Math.max(hiY, fall.tips[i][1]);
      }
      for (i = 0; i < fall.tips.length; i++) {
        if (fall.tips[i][1] <= loY + (hiY - loY) * 0.5) keep.push(fall.tips[i]);
      }
      if (keep.length) fall.tips = keep;
    }
    var trunkX = s0 ? s0.segs[0].pts[0][0] : W * 0.75;
    fall.x0 = fall.hang ? W * 0.62 : trunkX;
    fall.baseY = fall.hang ? ((anchors ? anchors.footerTop : H - 46) - 28) : H - 6;
    var pl = anchors ? anchors.pauseLeft : W - 150;
    fall.lo = fall.hang ? Math.max(18, W * 0.30) : fall.x0 - 110;
    fall.hi = fall.hang ? Math.min(W - 14, pl - 20)
                        : Math.min(fall.x0 + 110, pl - 22);
    /* the day so far, replayed from the day's stream */
    replayLandings(dayKept());
    fall.dayCount = fall.blades.length;
    fall.b0 = fall.vrng();
    /* after a resize the live schedule simply resumes from now */
    if (tLast > 0) { fall.next = tLast + fallGap(); return; }
    /* the opening: a seed already mid-fall where the fall is long enough
       (hang mode, ~8 s): >= 2.5 s of air left at t = 0, so it is still
       falling after the 1.8 s reveal and lands as a visible landing,
       never during the reveal. Where the fall is short (beds mode: the
       anchor canopy offers ~2 s at most, even from its top), the seed
       instead LETS GO from the canopy's top at 2.5 s — just after the
       reveal, the moment the eye lands on the page — rather than at a
       quiet opening's 5–9 s. Either way the next release follows its
       landing by a normal gap. */
    if (opening === 'seed' && fall.tips.length) {
      var tip = fall.tips[0];
      if (fall.hang) tip = releaseTip();
      else for (i = 1; i < fall.tips.length; i++) if (fall.tips[i][1] < tip[1]) tip = fall.tips[i];
      var pts = fallPath(tip[0], tip[1], fall.vrng);
      var fallDur = (fall.baseY - tip[1]) / DROP_V;
      var t0 = fallDur >= 2.5 ? -openU * (fallDur - 2.5) : 2.5;
      fall.drop = { t0: t0, pts: pts, ry: tip[1] };
      return;
    }
    fall.next = quietSeedS;                              // quiet: first live seed at 5–9 s
  }

  function drawMeadow(tNow) {
    var i, b, t, by, tx, ty, wv;
    for (i = 0; i < fall.blades.length; i++) {
      b = fall.blades[i];
      t = Math.min(1, (tNow - b.born) / 0.6);
      if (t <= 0) continue;
      /* each blade leans as the gust passes it — the wind made visible */
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

  function drawSeed(tNow, animating) {
    if (!animating) return;
    if (!fall.drop && tNow >= fall.next && fall.tips.length) {
      var tip = releaseTip();
      fall.drop = { t0: tNow, pts: fallPath(tip[0], tip[1], fall.vrng), ry: tip[1] };
    }
    if (!fall.drop) return;
    var d = fall.drop;
    if (tNow < d.t0) return;     // released, but not yet let go (the beds-mode opening)
    var yNow = d.ry + (tNow - d.t0) * DROP_V;
    var last = d.pts.length - 1;
    var idx = (yNow - d.ry) / 26;
    if (yNow >= fall.baseY || idx >= last) {
      addBlade(d.pts[last][0], tNow, fall.vrng);
      fall.drop = null;
      fall.next = tNow + fallGap();     // the gap is counted from the landing
      return;
    }
    var i0 = idx | 0, f = idx - i0;
    var x = d.pts[i0][0] + (d.pts[i0 + 1][0] - d.pts[i0][0]) * f;
    x += wind(x, tNow) * 2;      // the wind carries the seed a little
    /* linden-seed rock, keyed to the descent itself (pause-safe) */
    var a = Math.sin(yNow / 15) * 0.55 + 0.25;
    var ca = Math.cos(a), sa = Math.sin(a);
    stroke([[x - 3.5 * ca, yNow - 3.5 * sa], [x + 3.5 * ca, yNow + 3.5 * sa]],
           INK.verm, 1.6, 0.85, 1, 7999);
    stroke([[x + 2 * ca, yNow + 2 * sa], [x + 2 * ca - 3 * sa, yNow + 2 * sa + 3 * ca]],
           INK.verm, 1.2, 0.7, 1, 7998);
  }

  /* ---------------- layout + frame ---------------- */

  function measureAnchors() {
    var name = document.querySelector('h1');
    var links = document.querySelectorAll('footer a');
    var a = { nameTop: H * 0.2, footerTop: H - 46, pauseLeft: W - 150, stackLeft: W * 0.3, stackBottom: H * 0.6 };
    if (name) a.nameTop = name.getBoundingClientRect().top;
    if (links.length) a.footerTop = links[0].getBoundingClientRect().top;
    if (pauseBtn) {
      var r4 = pauseBtn.getBoundingClientRect();
      if (r4.width) a.pauseLeft = r4.left;
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
       text; hanging ones ~140*scale+8 above it. When neither fits (short
       landscape viewports), the garden rests — nothing is drawn and the
       typography carries the page. */
    a.bedCap = (H - a.stackBottom - 44) / 210;
    a.hangCap = (a.nameTop - 32) / 140;
    a.mode = W < 700 ? (a.hangCap >= 0.42 ? 'hang' : 'rest')
                     : (a.bedCap >= 0.5 ? 'beds'
                        : (a.hangCap >= 0.42 ? 'hang' : 'rest'));
    anchors = a;
  }

  /* a resize re-plants the place; it never rerolls the weather (the visit
     streams restart from their seeds; the opening belongs to t = 0 only) */
  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    measureAnchors();
    plantDayGarden();
    meadowInit();
    resetFlight();
  }

  var clock0 = 0, pauseShift = 0;
  var frozenAt = 0;            // performance.now() when the live clock last froze (pause, hidden tab or reduced motion); 0 while it runs
  var hiddenAt = 0;            // performance.now() when the tab was hidden; only the day's clock is told how long
  var seen = !document.hidden; // false for a page opened in a background tab: its first view is the arrival
  var paused = false, raf = 0, tmr = 0, lastBoil = -1;
  var tLast = 0;               // the last rendered scene time (0 until the loop first runs)

  function sceneT(tms) { return (tms - clock0 - pauseShift) / 1000; }

  function render(tNow, animating) {
    animatingNow = animating;
    if (animating) { wPh = windPhVisit; wDir = windDir; wG = gust(tNow); }
    else { wPh = windPhDay; wDir = 1; wG = 1; }
    ctx.clearRect(0, 0, W, H);
    drawFlock(tNow, animating);
    drawMeadow(tNow);
    var i;
    for (i = 0; i < sprigs.length; i++) drawSprig(sprigs[i], tNow);
    drawSeed(tNow, animating);
  }

  function frame(tms) {
    raf = 0;
    if (!clock0) clock0 = tms;
    var t = sceneT(tms);
    var boil = Math.floor(t * BOIL_FPS);
    if (boil !== lastBoil) {
      lastBoil = boil;
      boilPhase = boil;
      tLast = t;
      render(t, true);
    }
    if (!paused && !document.hidden) {
      /* truly sleep until the next boil frame instead of spinning rAF */
      var wait = Math.max(8, ((boil + 1) / BOIL_FPS - t) * 1000 + 2);
      tmr = setTimeout(function () {
        tmr = 0;
        raf = requestAnimationFrame(frame);
      }, wait);
    }
  }

  function start() {
    if (!raf && !tmr && !paused && !document.hidden && !still() && !resting()) raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (tmr) { clearTimeout(tmr); tmr = 0; }
  }

  function stillFrame() {
    boilPhase = 3;
    render(1e4, false);   // far future: everything fully grown
  }
  /* the paused frame: the live scene at the moment the clock froze (t = 0
     on a paused load — the frame resume continues from, so nothing can
     vanish and regrow on resume) */
  function pausedFrame() {
    boilPhase = Math.max(0, lastBoil);
    render(tLast, true);
  }
  /* the frozen frame, whichever it is, redrawn after the model changed
     under it (a resize, a catch-up): a static re-render is not animation */
  function redrawFrozen() {
    if (resting()) ctx.clearRect(0, 0, W, H);
    else if (still()) stillFrame();
    else if (paused) pausedFrame();
  }
  /* the control ships wherever the loop ships — and only there */
  function showControl() {
    if (!pauseBtn) return;
    if (still() || resting()) pauseBtn.classList.remove('ink-show');
    else pauseBtn.classList.add('ink-show');
  }
  /* ONE freeze/thaw for pause, hidden tab, reduced motion and a resting
     viewport: the live clock stops at the first of them and restarts at
     the last, so no path can double-count a span or let one slip through */
  function sync() {
    if (!paused && !document.hidden && !still() && !resting()) {
      /* a span frozen before the live clock exists is not a shift: the
         first live frame anchors clock0 to the thaw moment, so t = 0 is
         the frame the paused/still load drew (shifting here would push
         scene time NEGATIVE and un-grow the garden for the span) */
      if (frozenAt) { if (clock0) pauseShift += performance.now() - frozenAt; frozenAt = 0; }
      start();
    } else {
      if (!frozenAt) frozenAt = performance.now();
      stop();
    }
  }

  /* ---------------- lifecycle ---------------- */

  function label(p) {
    if (!pauseBtn) return;
    pauseBtn.textContent = p ? 'Resume the ink' : 'Pause the ink';
    pauseBtn.setAttribute('aria-label', (p ? 'Resume' : 'Pause') + ' the ink, the moving drawing behind the text');
  }

  function setPaused(p) {
    paused = p;
    label(p);
    try { localStorage.setItem('ink-paused', p ? '1' : ''); } catch (e) {}
    sync();
  }
  if (pauseBtn) pauseBtn.addEventListener('click', function () { setPaused(!paused); });

  /* returning after >= 8 min hidden: the day moved on. Continue the DAY's
     own replay — the landings and, at most, the one sprig a fresh visitor
     at this minute would already see — fully grown, statically. Nothing
     animates, nothing is scheduled, no flock, no seed. */
  function catchUp() {
    replayLandings(Math.max(0, Math.min(12, dayKept() - fall.replayed)));
    if (gardenRng && anchors && anchors.mode !== 'rest' && dayPlanted < 6 && daySprigs() > dayPlanted) {
      plantOne(dayPlanted, gardenRng, tLast - 60);
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = performance.now(); sync(); return; }
    if (hiddenAt) {
      /* the live clock froze while hidden (sync() below thaws it — no
         fast-forward of wind, skein or seed, whatever else was toggled
         meanwhile); only the day's own clock is told how long it was */
      var hiddenFor = performance.now() - hiddenAt;
      hiddenAt = 0;
      awayS += hiddenFor / 1000;
      if (!seen) {
        /* opened in a background tab: nobody has seen anything yet, so
           this first look IS the arrival — the place is re-planted at
           this minute (the boot frame does it itself if it has not run;
           the weather and the opening still belong to t = 0, which is now) */
        seen = true;
        if (anchors) { layout(); redrawFrozen(); }
      } else if (hiddenFor >= 480e3) { catchUp(); redrawFrozen(); }
    }
    sync();
  });
  window.addEventListener('pagehide', stop);   // timers only; bfcache-friendly

  var lastClick = 0;
  document.addEventListener('click', function (e) {
    if (paused || still() || resting()) return;
    if (e.target.closest('a, button')) return;
    /* never plant on (or into) the typography: the measured stack and
       footer are no-plant zones, and near them the planted sprig is
       scaled to the clearance so its canopy can never reach the glyphs */
    var sc2 = 0.55 + seedRng() * 0.35;
    if (anchors) {
      if (e.clientY > anchors.footerTop - 30) return;
      if (e.clientY > anchors.stackTop - 40 && e.clientY < anchors.stackBottom + 40 &&
          e.clientX > anchors.stackLeft - 70 && e.clientX < anchors.stackRight + 70) return;
      if (e.clientX > anchors.stackLeft - 110 && e.clientX < anchors.stackRight + 110) {
        var vGap = (e.clientY > H * 0.4 ? e.clientY - anchors.stackBottom
                                        : anchors.stackTop - e.clientY) - 26;
        sc2 = Math.min(sc2, vGap / 185);
        if (sc2 < 0.3) return;
      }
    }
    /* 60 px root spacing: two trees never crowd into busy ink — the same
       kind of non-response as the debounce, and just as deterministic */
    var i, dx, dy;
    for (i = 0; i < sprigs.length; i++) {
      dx = sprigs[i].ox - e.clientX; dy = sprigs[i].oy - e.clientY;
      if (dx * dx + dy * dy < 3600) return;
    }
    var now = performance.now();
    if (now - lastClick < 600) return;
    lastClick = now;
    /* the cap evicts the oldest click-planted sprig, never a day sprig
       (sprigs[0] is the anchor the seedfall releases from) */
    if (sprigs.length >= 14) sprigs.splice(dayCount, 1);
    var upward = e.clientY > H * 0.4 ? -Math.PI / 2 : Math.PI / 2;
    sprigs.push(buildSprig(e.clientX, e.clientY, upward + (seedRng() - 0.5) * 0.6,
                           sc2, seedRng, sceneT(now)));
    start();
  });

  var rsTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(function () {
      layout();               // may change the mode (a rotated phone)
      showControl();
      sync();
      redrawFrozen();
    }, 150);
  });

  function onStillChange() {
    sync();                    // freeze or thaw the live clock (never double-counted with a hidden tab)
    showControl();
    redrawFrozen();
  }
  listenMq(mqReduce, onStillChange);
  listenMq(mqForced, onStillChange);

  /* ---------------- boot ---------------- */

  try { paused = localStorage.getItem('ink-paused') === '1'; } catch (e) {}
  if (paused) label(true);
  if (!seen) hiddenAt = performance.now();   // the day's clock will be told the span until the first look

  requestAnimationFrame(function () {
    layout();
    showControl();
    if (still()) stillFrame();
    else if (paused) pausedFrame();
    else start();
    doc.classList.add('ink-ready');
  });
})();
