/* The ink garden, at night — a hand-drawn day, clocked from local midnight.
   2D canvas, no libraries, no network. Every stroke is a wobbly polyline
   redrawn with fresh jitter a few times a second (the hand-drawn "boil"),
   so the page feels like ink held in a steady hand, never like a machine.

   The garden is date-seeded and grows with the day: sparse at dawn, in
   full bloom by evening — the same garden for every visitor, all day.
   Branches draw themselves in; an ochre thread dangles from the top edge
   and wanders down to the footer, ending in a small curl; a margin of
   embroidered x-stitches appears in golden-ratio order; and every little
   while a seed lets go of the tallest sprig and flutters down, each sway
   of its fall a coin toss, planting a grass blade where it lands — a day
   of landings grows a stand of grass whose silhouette settles toward the
   bell curve (de Moivre-Laplace, drawn as meadow). A flock of three
   stepped-zigzag birds — a hand's own mark — crosses the sky once per
   day on the same clock, highest at noon.
   Click anywhere open: a seed is planted and a new sprig grows there.

   THE CALM ENVELOPE (any change must keep all of this true):
   - boil rate <= 6 fps; no motion faster than the thread's 0.08 Hz sway
     except the falling seed (one at a time, ~9 s apart on average,
     <= 90 px/s); the flock's day-migration drifts <= 0.05 px/s
   - strokes and stitches only — never clustered dots (hard rule)
   - ink alphas <= 0.85; night ground #181410; palette fixed to the six inks
   - prefers-reduced-motion: the day's garden fully drawn, zero boil,
     rAF never starts; live listener both directions
   - pause button freezes the frame and all clocks; persists (ink-paused)
   - JS off / canvas failure: typography on the night ground, nothing lost
   - no Math.random, no Date.now in the render path; date read once
   - one 2D canvas, one rAF loop that sleeps between boil frames */

(function () {
  'use strict';

  /* ---------------- config ---------------- */

  var BOIL_FPS = 5;            // hand-tremor redraw rate
  var JITTER = 1.6;            // px, wobble amplitude
  var GROW_MS = 2600;          // self-draw time per branch generation
  var THREAD_SWAY_HZ = 0.08;
  var DROP_EVERY_S = 9;        // mean seconds between seedfalls (Poisson)
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
  var now0 = new Date();                     // the only Date read
  var daySeed = xmur3(now0.getFullYear() + '-' + (now0.getMonth() + 1) + '-' + now0.getDate())();
  var midnightS = now0.getHours() * 3600 + now0.getMinutes() * 60 + now0.getSeconds();
  var stream = function (n) { return sm32((daySeed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0); };

  /* deterministic smooth noise for the boil (indexed, not time-random) */
  var NOISE_N = 4096;
  var noiseTab = new Float32Array(NOISE_N);
  (function () { var r = stream(1), i; for (i = 0; i < NOISE_N; i++) noiseTab[i] = r() * 2 - 1; })();
  function nz(i) { return noiseTab[(i | 0) & (NOISE_N - 1)]; }

  /* ---------------- DOM ---------------- */

  var canvas = document.getElementById('ink');
  var pauseBtn = document.getElementById('ink-pause');
  if (!canvas) return;
  var doc = document.documentElement;
  var ctx = canvas.getContext('2d');
  if (!ctx) { canvas.parentNode.removeChild(canvas); doc.classList.add('ink-ready'); return; }

  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  function listenMq(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  var W = 0, H = 0, DPR = 1;
  var anchors = null;          // positions measured from the real DOM

  /* ---------------- stroke machinery ---------------- */

  var boilPhase = 0;           // increments per boil frame; keys the jitter

  /* draw a polyline with hand wobble; t in [0,1] reveals it progressively */
  function stroke(pts, color, width, alpha, t, key) {
    var n = pts.length;
    if (n < 2) return;
    var upto = Math.max(2, Math.ceil(n * (t === undefined ? 1 : t)));
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha === undefined ? 0.85 : alpha;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    var i, jx, jy, k;
    for (i = 0; i < upto; i++) {
      k = (key || 0) + i * 7 + boilPhase * 131;
      jx = nz(k) * JITTER;
      jy = nz(k + 61) * JITTER;
      if (i === 0) ctx.moveTo(pts[0][0] + jx, pts[0][1] + jy);
      else ctx.lineTo(pts[i][0] + jx, pts[i][1] + jy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function xstitch(x, y, s, color, alpha, key) {
    stroke([[x - s, y - s], [x + s, y + s]], color, 1.3, alpha, 1, key);
    stroke([[x + s, y - s], [x - s, y + s]], color, 1.3, alpha, 1, key + 977);
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
    return { segs: segs, born: born };
  }

  function drawSprig(sprig, tNow) {
    var i, s, g, t;
    for (i = 0; i < sprig.segs.length; i++) {
      s = sprig.segs[i];
      g = (tNow - sprig.born) / (GROW_MS / 1000) - s.gen;    // generations stagger
      if (g <= 0) continue;
      t = Math.min(1, g);
      if (s.pts) {
        stroke(s.pts, INK.line, s.w, 0.8, t, s.key);
      } else if (t > 0.4) {
        if (s.kind === 'petal') {
          stroke([[s.tip[0] - 3, s.tip[1]], [s.tip[0] + 1, s.tip[1] - 4]], s.col, 2.2, 0.75, 1, s.key);
          stroke([[s.tip[0] + 1, s.tip[1] - 1], [s.tip[0] + 4, s.tip[1] + 2]], s.col, 2.0, 0.7, 1, s.key + 11);
        } else {
          starburst(s.tip[0], s.tip[1], 5, s.col, s.key);
        }
      }
    }
  }

  var sprigs = [];
  var seedRng = stream(3);

  function plantDayGarden() {
    sprigs.length = 0;
    var r = stream(2);
    var narrow = W < 700;
    /* the day decides how much has grown: 0 at 05:00, full at 21:00 —
       eased logistically (smootherstep), the way things actually grow */
    var lin = Math.max(0, Math.min(1, (midnightS / 3600 - 5) / 16));
    var dayFrac = lin * lin * (3 - 2 * lin);
    var total = 2 + Math.round(dayFrac * 4);          // 2..6 sprigs
    var i, x, y, ang;
    for (i = 0; i < total; i++) {
      var side = r();
      if (i === 0) {                       // the anchor sprig: the seedfall's canopy
        if (narrow) { x = W * 0.88; y = 4; ang = Math.PI / 2 + (r() - 0.5) * 0.3; }
        else { x = W * (0.74 + r() * 0.08); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.4; }
      } else if (narrow) {                 // phone: the garden hangs from the top
        x = W * (0.45 + side * 0.4); y = 4; ang = Math.PI / 2 + (r() - 0.5) * 0.4;
      } else if (side < 0.45) {            // bottom bed, left of the text column
        x = W * (0.28 + r() * 0.13); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.5;
      } else if (side < 0.75) {            // bottom-right, clear of the pause button
        x = W * (0.72 + r() * 0.12); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.5;
      } else {                             // top-right corner, hanging in
        x = W * (0.84 + r() * 0.1); y = 4; ang = Math.PI / 2 + (r() - 0.5) * 0.4;
      }
      var sc = i === 0 ? (narrow ? 0.7 : 1.0) + r() * 0.25
                       : (narrow ? 0.55 : 0.8) + r() * (narrow ? 0.2 : 0.5);
      sprigs.push(buildSprig(x, y, ang, sc, r, -60 + i * 3));  // born pre-load: already grown
    }
  }

  /* ---------------- the thread ---------------- */

  var threadPts = [];
  function buildThread() {
    threadPts.length = 0;
    if (!anchors) return;
    var r = stream(4);
    var narrow = W < 700;
    var lane = narrow ? 18 : Math.max(60, Math.min(anchors.stackLeft - 70, W * 0.30));
    var x = lane * (0.55 + r() * 0.3), y = -4;
    var tx = narrow ? lane * 0.7 : anchors.footerX;
    var ty = narrow ? H + 20 : anchors.footerY;
    var i, n = 46;
    for (i = 0; i <= n; i++) {
      var f = i / n;
      /* wander inside the left margin; converge to the footer only late */
      var wander = Math.sin(f * 4.6 + r() * 0.2) * lane * 0.35 * (1 - f * f);
      var base = x + (tx - x) * Math.pow(f, 3);
      var clamped = Math.min(base + wander * (f < 0.15 ? f / 0.15 : 1), lane);
      var free = Math.max(0, Math.min(1, (f - 0.78) / 0.22));   // ease into the approach
      free = free * free * (3 - 2 * free);
      var px = clamped + (base - clamped) * free;
      var py = y + (ty - y) * f;
      threadPts.push([px, py]);
    }
  }

  var threadNarrow = false;
  function drawThread(tNow) {
    if (threadPts.length < 2) return;
    /* slow pendulum sway, whole thread */
    var sway = Math.sin(tNow * 2 * Math.PI * THREAD_SWAY_HZ) * 3;
    var pts = [], i, f;
    for (i = 0; i < threadPts.length; i++) {
      f = i / (threadPts.length - 1);
      pts.push([threadPts[i][0] + sway * Math.sin(f * Math.PI), threadPts[i][1]]);
    }
    stroke(pts, INK.ochre, 1.4, 0.8, 1, 5000);
    if (threadNarrow) return;      // edge thread runs off-page; no curl
    /* the end curls like real thread: curvature grows along the arc (an
       Euler spiral), tightening inward instead of coiling evenly */
    var ex = pts[pts.length - 1][0], ey = pts[pts.length - 1][1];
    var sp = [], th = -0.5, kv = 0.16, st = 1.9, cx = ex + 2, cy = ey - 1;
    for (i = 0; i <= 24; i++) {
      sp.push([cx, cy]);
      cx += Math.cos(th) * st; cy += Math.sin(th) * st;
      th += kv; kv *= 1.05; st *= 0.955;
    }
    stroke(sp, INK.ochre, 1.2, 0.8, 1, 5200);
  }

  /* ---------------- margin stitches ---------------- */

  function drawStitches(tNow) {
    if (W < 700) return;           // no margin to stitch on a phone
    var r = stream(5);
    var n = 7, i;
    var x = W * 0.045;
    for (i = 0; i < n; i++) {
      var y = H * 0.18 + i * 26 + (r() - 0.5) * 4;
      var appear = ((i * 0.6180339887) % 1) * 4.8 - 0.5;  // golden-ratio order: fills the column evenly, never top-down
      if (tNow < appear) continue;
      var col = i === 4 ? INK.verm : (i % 2 ? INK.dim : INK.slate);
      xstitch(x + (r() - 0.5) * 3, y, 4.5, col, 0.7, 6000 + i * 89);
    }
  }

  /* ---------------- the flock ----------------
     Three stepped-zigzag birds — Derek's tattoo trio, digitized as drawn:
     the small one above, the pair below, one trailing a long tail. They
     cross the open sky exactly once per day on the garden's clock
     (~0.02 px/s — far under the sway's peak speed), flying highest at
     noon, settling toward the far edge by dusk. Single angular strokes,
     marker-weight, boiled like everything else. */

  var BIRDS = [
    { at: [6, 0],   pts: [[0, 0], [2, 6], [9, 5], [11, 12], [19, 11]] },
    { at: [0, 44],  pts: [[0, 0], [2, 5], [8, 4], [9, 10], [16, 9]] },
    { at: [22, 50], pts: [[0, 0], [2, 5], [8, 4], [10, 10], [15, 9], [26, 20]] }
  ];
  var flockRng = stream(9);
  var flockJY = flockRng() * 26, flockJX = (flockRng() - 0.5) * 40;

  function drawFlock(tNow, animating) {
    if (!anchors) return;
    var narrow = W < 700;
    var s = narrow ? 0.62 : 0.85;
    var bboxW = 48 * s + 10, bboxH = 70 * s;
    var lo, hi, yBase, yRoom;
    if (narrow) {
      /* the open zone between the text and the meadow, left of the seed column */
      var top = anchors.stackBottom + 26;
      var bot = (fall.baseY || H - 60) - 26 - bboxH;
      if (bot - top < 30) return;               // no room on very short viewports
      lo = 22; hi = Math.max(lo + 20, W * 0.45 - bboxW);
      yBase = top + (bot - top) * 0.35;
      yRoom = Math.min(16, (bot - top) * 0.3);
    } else {
      lo = Math.max(W * 0.34, anchors.stackLeft - 60); hi = W * 0.78 - bboxW;
      yBase = 46 + flockJY;
      yRoom = Math.min(18, Math.max(0, anchors.nameTop - 44 - bboxH - yBase));
    }
    /* the day's crossing: same clock as the garden, live within a visit */
    var daySec = midnightS + (animating ? Math.max(0, tNow) : 0);
    var prog = Math.max(0, Math.min(1, (daySec / 3600 - 5) / 16));
    var fx = lo + (hi - lo) * prog + flockJX * (narrow ? 0.3 : 1);
    fx = Math.max(lo, Math.min(hi, fx));
    var fy = yBase - Math.sin(prog * Math.PI) * yRoom;   // highest at noon
    var b, i, p, pts, t;
    for (b = 0; b < 3; b++) {
      t = Math.min(1, (tNow - (1.1 + b * 1.3)) / 0.7);   // draw themselves in, one by one
      if (t <= 0) continue;
      p = BIRDS[b]; pts = [];
      for (i = 0; i < p.pts.length; i++) {
        pts.push([fx + (p.at[0] + p.pts[i][0]) * s, fy + (p.at[1] + p.pts[i][1]) * s]);
      }
      stroke(pts, INK.line, 1.9, 0.78, t, 9100 + b * 97);
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
     memoryless — never a metronome. */

  var fall = { rng: null, next: 0, drop: null, tips: [], x0: 0, baseY: 0,
               lo: 0, hi: 0, blades: [], cells: {} };

  function fallGap() {
    var u = fall.rng();
    return Math.min(15, Math.max(5.5, -Math.log(1 - u) * DROP_EVERY_S));
  }

  /* precomputed descent, one waypoint per 26 px air-row; on phones the
     seed keeps to the right margin while crossing the text, then drifts
     free below it (a channel opening into a spread — still pachinko).
     Desktop pull is light (sigma ~30 px with canopy spread: a real bell);
     the landing clamps into the meadow's bounds — walks stay smooth. */
  function fallPath(rx, ry) {
    var narrow = W < 700;
    var pts = [[rx, ry]], x = rx, y = ry;
    while (y < fall.baseY - 1) {
      y = Math.min(fall.baseY, y + 26);
      var inLane = narrow && anchors && y < anchors.stackBottom + 12;
      var aim = inLane ? W - 12 : fall.x0;
      var pull = inLane ? 0.5 : (narrow ? 0.35 : 0.06);
      var sig = inLane ? 2.5 : (narrow ? 9 : 10);
      x += (aim - x) * pull + (fall.rng() * 2 - 1) * sig;
      pts.push([x, y]);
    }
    pts[pts.length - 1][0] = Math.max(fall.lo, Math.min(fall.hi, x));
    return pts;
  }

  function addBlade(x, born) {
    var c = Math.round((x - fall.x0) / 6);
    var n = fall.cells[c] || 0;
    fall.cells[c] = n + 1;
    /* repeat landings thicken the tuft upward, never denser sideways;
       past the caps the meadow simply rests */
    if (n >= 7 || fall.blades.length >= 64) return;
    var bx = fall.x0 + c * 6 + (fall.rng() - 0.5) * 3.2;
    var h = 6 + n * 2.0 + fall.rng() * 1.5;
    var lean = (fall.rng() < 0.5 ? -1 : 1) * (0.25 + fall.rng() * 0.45);
    fall.blades.push({ x: bx, h: h, lean: lean, born: born,
                       col: fall.rng() < 0.82 ? INK.sage : INK.dim,
                       grain: fall.rng() < 0.16 });
  }

  function meadowInit() {
    fall.rng = stream(6);
    fall.blades.length = 0;
    fall.cells = {};
    fall.drop = null;
    fall.tips.length = 0;
    var narrow = W < 700;
    var s0 = sprigs[0], i;
    if (s0) for (i = 0; i < s0.segs.length; i++) if (s0.segs[i].tip) fall.tips.push(s0.segs[i].tip);
    if (narrow) {
      /* phones: release only from lane-side tips, so the crossing of the
         text zone stays inside the right margin */
      var laneTips = [];
      for (i = 0; i < fall.tips.length; i++) if (fall.tips[i][0] >= W - 30) laneTips.push(fall.tips[i]);
      fall.tips = laneTips.length ? laneTips : [[W - 16, 70]];
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
    fall.x0 = narrow ? W * 0.62 : trunkX;
    fall.baseY = narrow ? ((anchors ? anchors.footerTop : H - 46) - 28) : H - 6;
    var pl = anchors ? anchors.pauseLeft : W - 150;
    fall.lo = narrow ? Math.max(18, W * 0.30) : fall.x0 - 110;
    fall.hi = narrow ? Math.min(W - 14, pl - 20)
                     : Math.min(fall.x0 + 110, pl - 22);
    /* the day so far, replayed: one landing kept per ~8 min of daylight */
    var kept = Math.min(64, Math.floor(Math.max(0, midnightS - 6.5 * 3600) / 480));
    var d, tip, p;
    for (d = 0; d < kept; d++) {
      tip = fall.tips.length ? fall.tips[(fall.rng() * fall.tips.length) | 0] : [fall.x0, H * 0.4];
      p = fallPath(tip[0], tip[1]);
      addBlade(p[p.length - 1][0], -10);
    }
    fall.next = 3.5 + fall.rng() * 3;
  }

  function drawMeadow(tNow) {
    var i, b, t, by, tx, ty;
    for (i = 0; i < fall.blades.length; i++) {
      b = fall.blades[i];
      t = Math.min(1, (tNow - b.born) / 0.6);
      if (t <= 0) continue;
      by = fall.baseY + nz(i * 17) * 1.5;
      tx = b.x + b.lean * b.h * 0.45; ty = by - b.h;
      stroke([[b.x, by],
              [b.x + b.lean * b.h * 0.18, by - b.h * 0.55],
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
      var tip = fall.tips[(fall.rng() * fall.tips.length) | 0];
      fall.drop = { t0: tNow, pts: fallPath(tip[0], tip[1]), ry: tip[1] };
      fall.next = tNow + fallGap();
    }
    if (!fall.drop) return;
    var d = fall.drop;
    var yNow = d.ry + (tNow - d.t0) * DROP_V;
    var last = d.pts.length - 1;
    var idx = (yNow - d.ry) / 26;
    if (yNow >= fall.baseY || idx >= last) {
      addBlade(d.pts[last][0], tNow);
      fall.drop = null;
      return;
    }
    var i0 = idx | 0, f = idx - i0;
    var x = d.pts[i0][0] + (d.pts[i0 + 1][0] - d.pts[i0][0]) * f;
    /* linden-seed rock, keyed to the descent itself (pause-safe) */
    var a = Math.sin(yNow / 15) * 0.55 + 0.25;
    var ca = Math.cos(a), sa = Math.sin(a);
    stroke([[x - 3.5 * ca, yNow - 3.5 * sa], [x + 3.5 * ca, yNow + 3.5 * sa]],
           INK.verm, 1.6, 0.85, 1, 7999);
    stroke([[x + 2 * ca, yNow + 2 * sa], [x + 2 * ca - 3 * sa, yNow + 2 * sa + 3 * ca]],
           INK.verm, 1.2, 0.7, 1, 7998);
  }

  /* ---------------- paper flecks ---------------- */

  function drawFlecks() {
    var r = stream(7), i;
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = INK.dim;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (i = 0; i < 26; i++) {
      var x = r() * W, y = r() * H, a = r() * Math.PI;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 2, y + Math.sin(a) * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- layout + frame ---------------- */

  function measureAnchors() {
    var name = document.querySelector('h1');
    var links = document.querySelectorAll('footer a');
    var a = { nameRight: W * 0.72, nameTop: H * 0.2, footerX: W * 0.12, footerY: H - 60,
              footerTop: H - 46, pauseLeft: W - 150, stackLeft: W * 0.3, stackBottom: H * 0.6 };
    if (name) {
      var r = name.getBoundingClientRect();
      a.nameRight = r.right; a.nameTop = r.top;
    }
    if (links.length) {
      /* The curl (spanning ~footerX+2..+15 plus wobble) must never sit on
         label glyphs: float it above the line, mid-gap when possible. */
      var r2 = links[0].getBoundingClientRect();
      a.footerTop = r2.top;
      a.footerY = r2.top - 14;
      a.footerX = r2.right + 12;
      if (links.length > 1) {
        a.footerX = (r2.right + links[1].getBoundingClientRect().left) / 2 - 10;
      }
    }
    if (pauseBtn) {
      var r4 = pauseBtn.getBoundingClientRect();
      if (r4.width) a.pauseLeft = r4.left;
    }
    var stack = document.querySelector('.stack');
    if (stack) {
      var r3 = stack.getBoundingClientRect();
      a.stackLeft = r3.left;
      a.stackBottom = r3.bottom;
    }
    anchors = a;
  }

  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    measureAnchors();
    plantDayGarden();
    buildThread();
    meadowInit();
  }

  var clock0 = 0, pauseShift = 0, pausedAt = 0, hiddenAt = 0;
  var paused = false, raf = 0, lastBoil = -1;

  function sceneT(tms) { return (tms - clock0 - pauseShift) / 1000; }

  function render(tNow, animating) {
    ctx.clearRect(0, 0, W, H);
    drawFlecks();
    drawStitches(tNow);
    drawFlock(tNow, animating);
    drawMeadow(tNow);
    var i;
    for (i = 0; i < sprigs.length; i++) drawSprig(sprigs[i], tNow);
    drawThread(animating ? tNow : 0);
    drawSeed(tNow, animating);
    /* vermillion star beside the name */
    if (anchors) starburst(Math.min(anchors.nameRight + 24, W - 22), anchors.nameTop + 10, 7, INK.verm, 8500);
  }

  function frame(tms) {
    raf = 0;
    if (!clock0) clock0 = tms;
    var t = sceneT(tms);
    var boil = Math.floor(t * BOIL_FPS);
    if (boil !== lastBoil) {
      lastBoil = boil;
      boilPhase = boil;
      render(t, true);
    }
    if (!paused && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function start() {
    if (!raf && !paused && !document.hidden && !mqReduce.matches) raf = requestAnimationFrame(frame);
  }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  function stillFrame() {
    boilPhase = 3;
    render(1e4, false);   // far future: everything fully grown, thread at rest
  }

  /* ---------------- lifecycle ---------------- */

  function setPaused(p) {
    paused = p;
    if (pauseBtn) pauseBtn.textContent = p ? 'Play motion' : 'Pause motion';
    try { localStorage.setItem('ink-paused', p ? '1' : ''); } catch (e) {}
    if (p) { pausedAt = performance.now(); stop(); }
    else {
      if (pausedAt) { pauseShift += performance.now() - pausedAt; pausedAt = 0; }
      start();
    }
  }
  if (pauseBtn) pauseBtn.addEventListener('click', function () { setPaused(!paused); });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = performance.now(); stop(); }
    else if (!paused && !mqReduce.matches) {
      if (hiddenAt) { pauseShift += performance.now() - hiddenAt; hiddenAt = 0; }
      start();
    }
  });

  var lastClick = 0;
  document.addEventListener('click', function (e) {
    if (paused || mqReduce.matches) return;
    if (e.target.closest('a, button')) return;
    var now = performance.now();
    if (now - lastClick < 600) return;
    lastClick = now;
    if (sprigs.length > 14) sprigs.shift();
    var upward = e.clientY > H * 0.4 ? -Math.PI / 2 : Math.PI / 2;
    sprigs.push(buildSprig(e.clientX, e.clientY, upward + (seedRng() - 0.5) * 0.6,
                           0.55 + seedRng() * 0.35, seedRng, sceneT(now)));
    start();
  });

  var rsTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(function () {
      layout();
      if (paused || mqReduce.matches) stillFrame();
    }, 150);
  });

  listenMq(mqReduce, function () {
    if (mqReduce.matches) { stop(); stillFrame(); if (pauseBtn) pauseBtn.classList.remove('ink-show'); }
    else { if (pauseBtn) pauseBtn.classList.add('ink-show'); if (!paused) start(); }
  });

  /* ---------------- boot ---------------- */

  try { paused = localStorage.getItem('ink-paused') === '1'; } catch (e) {}
  if (pauseBtn && paused) pauseBtn.textContent = 'Play motion';

  requestAnimationFrame(function () {
    layout();
    if (mqReduce.matches) {
      stillFrame();
    } else {
      if (pauseBtn) pauseBtn.classList.add('ink-show');
      if (paused) stillFrame();
      else start();
    }
    doc.classList.add('ink-ready');
  });
})();
