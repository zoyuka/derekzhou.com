/* The ink garden — a hand-drawn day, clocked from local midnight.
   2D canvas, no libraries, no network. Every stroke is a wobbly polyline
   redrawn with fresh jitter a few times a second (the hand-drawn "boil"),
   so the page feels like ink held in a steady hand, never like a machine.

   The garden is date-seeded and grows with the day: sparse at dawn, in
   full bloom by evening — the same garden for every visitor, all day.
   Branches draw themselves in; an ochre thread dangles from the top edge
   and wanders down to the footer links, ending in a small spiral; a
   margin of embroidered x-stitches appears one by one; and a matchbox
   pachinko machine drops one ink mark through stitch-pegs every little
   while, its landings accumulating into a thumb-sized bell of ticks.
   Click anywhere open: a seed is planted and a new sprig grows there.

   THE CALM ENVELOPE (any change must keep all of this true):
   - boil rate <= 6 fps; no motion faster than the thread's 0.08 Hz sway
     except the falling mark (one at a time, ~9 s apart, <= 90 px/s)
   - strokes and stitches only — never clustered dots (hard rule)
   - ink alphas <= 0.85; paper #f2ede3; palette fixed to the six inks
   - prefers-reduced-motion: the day's garden fully drawn, zero boil,
     rAF never starts; live listener both directions
   - pause button freezes the frame and all clocks; persists (ink-paused)
   - JS off / canvas failure: typography on paper, nothing lost
   - no Math.random, no Date.now in the render path; date read once
   - one 2D canvas, one rAF loop that sleeps between boil frames */

(function () {
  'use strict';

  /* ---------------- config ---------------- */

  var BOIL_FPS = 5;            // hand-tremor redraw rate
  var JITTER = 1.6;            // px, wobble amplitude
  var GROW_MS = 2600;          // self-draw time per branch generation
  var THREAD_SWAY_HZ = 0.08;
  var DROP_EVERY_S = 9;        // pachinko mark cadence
  var DROP_V = 85;             // px/s fall speed
  var INK = {
    line:   '#3a3733',
    dim:    '#6f6a62',
    ochre:  '#b0852f',
    verm:   '#c34a33',
    sage:   '#7a8a6d',
    slate:  '#5a6b8c'
  };
  var PAPER = '#f2ede3';

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
                    col: rng() < 0.55 ? INK.sage : (rng() < 0.6 ? INK.verm : INK.ochre),
                    gen: gen + 1, key: (segs.length + 1) * 397 });
      }
      var kids = depth === 0 ? 3 : (rng() < 0.6 ? 2 : 1), k;
      for (k = 0; k < kids; k++) {
        grow(cx, cy, a + (rng() - 0.5) * 1.5, len * (0.55 + rng() * 0.2), depth + 1, gen + 1);
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
    /* the day decides how much has grown: 0 at 05:00, full at 21:00 */
    var dayFrac = Math.max(0, Math.min(1, (midnightS / 3600 - 5) / 16));
    var total = 2 + Math.round(dayFrac * 4);          // 2..6 sprigs
    var i, x, y, ang;
    for (i = 0; i < total; i++) {
      var narrow = W < 700;
      var side = r();
      if (narrow) {                        // phone: the garden hangs from the top
        x = W * (0.45 + side * 0.45); y = 4; ang = Math.PI / 2 + (r() - 0.5) * 0.4;
      } else if (side < 0.45) {            // bottom bed, left of the text column
        x = W * (0.28 + r() * 0.13); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.5;
      } else if (side < 0.75) {            // bottom-right, clear of the pause button
        x = W * (0.72 + r() * 0.12); y = H - 6; ang = -Math.PI / 2 + (r() - 0.5) * 0.5;
      } else {                             // top-right corner, hanging in
        x = W * (0.84 + r() * 0.1); y = 4; ang = Math.PI / 2 + (r() - 0.5) * 0.4;
      }
      var sc = (narrow ? 0.55 : 0.8) + r() * (narrow ? 0.2 : 0.5);
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
    if (threadNarrow) return;      // edge thread runs off-page; no spiral
    /* the little spiral at the end */
    var ex = pts[pts.length - 1][0], ey = pts[pts.length - 1][1];
    var sp = [], a, rr;
    for (i = 0; i <= 24; i++) {
      a = i * 0.52; rr = 1 + i * 0.30;
      sp.push([ex + 10 + Math.cos(a) * rr, ey - 4 + Math.sin(a) * rr * 0.9]);
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
      var appear = i * 0.8 - 1;                       // one by one after load
      if (tNow < appear) continue;
      var col = i === 4 ? INK.verm : (i % 2 ? INK.dim : INK.slate);
      xstitch(x + (r() - 0.5) * 3, y, 4.5, col, 0.7, 6000 + i * 89);
    }
  }

  /* ---------------- the matchbox pachinko ---------------- */

  var mk = { bins: null, nextDrop: 0, drop: null, rng: null };

  function machineRect() {
    var small = W < 700;
    return { x: anchors ? anchors.machineX : W * 0.82, y: anchors ? anchors.machineY : H * 0.6,
             w: small ? 64 : 84, h: small ? 92 : 118 };
  }

  function initMachine() {
    mk.bins = new Uint8Array(5);
    mk.rng = stream(6);
    /* the day's accumulated landings, replayed deterministically */
    var drops = Math.floor(Math.max(0, midnightS - 7 * 3600) / 3600 * 2);  // 2 marks/hour of daylight
    drops = Math.min(drops, 30);
    var i, k, b;
    for (i = 0; i < drops; i++) {
      b = 0;
      for (k = 0; k < 4; k++) if (mk.rng() < 0.5) b++;
      if (mk.bins[b] < 10) mk.bins[b]++;
    }
    mk.nextDrop = 2.5;
    mk.drop = null;
  }

  function drawMachine(tNow, dt, animating) {
    var m = machineRect();
    /* hand-drawn box */
    stroke([[m.x, m.y], [m.x + m.w, m.y]], INK.line, 1.4, 0.75, 1, 7001);
    stroke([[m.x + m.w, m.y], [m.x + m.w, m.y + m.h]], INK.line, 1.4, 0.75, 1, 7002);
    stroke([[m.x + m.w, m.y + m.h], [m.x, m.y + m.h]], INK.line, 1.4, 0.75, 1, 7003);
    stroke([[m.x, m.y + m.h], [m.x, m.y]], INK.line, 1.4, 0.75, 1, 7004);
    /* stitch pegs, quincunx rows */
    var sc = m.w / 84;
    var rows = 4, r, c, px, py;
    for (r = 0; r < rows; r++) {
      var cols = 3 + (r % 2);
      for (c = 0; c < cols; c++) {
        px = m.x + m.w / 2 + (c - (cols - 1) / 2) * 16 * sc;
        py = m.y + 20 * sc + r * 14 * sc;
        xstitch(px, py, 2.2 * sc, INK.dim, 0.6, 7100 + r * 31 + c * 7);
      }
    }
    /* funnel + drop slot at the top */
    stroke([[m.x + m.w * 0.32, m.y - 9], [m.x + m.w * 0.46, m.y - 1]], INK.dim, 1.3, 0.7, 1, 7050);
    stroke([[m.x + m.w * 0.68, m.y - 9], [m.x + m.w * 0.54, m.y - 1]], INK.dim, 1.3, 0.7, 1, 7051);
    /* landed marks: tick strokes stacked into a thumb-sized bell */
    var b, i2, bx, by;
    var floorY = m.y + m.h - 5;
    var ceilY = m.y + 20 * sc + rows * 14 * sc + 12;
    for (b = 0; b < 5; b++) {
      bx = m.x + m.w / 2 + (b - 2) * 13 * sc;
      for (i2 = 0; i2 < mk.bins[b]; i2++) {
        by = floorY - i2 * 4;
        if (by < ceilY) break;
        stroke([[bx - 3.2, by], [bx + 3.2, by - 1.3]], INK.dim, 1.3, 0.65, 1, 7300 + b * 41 + i2 * 13);
      }
    }
    /* the falling mark */
    if (animating) {
      if (!mk.drop && tNow >= mk.nextDrop) {
        var bb = 0, k;
        for (k = 0; k < 4; k++) if (mk.rng() < 0.5) bb++;
        mk.drop = { t0: tNow, bin: bb };
        mk.nextDrop = tNow + DROP_EVERY_S * (0.8 + mk.rng() * 0.5);
      }
      if (mk.drop) {
        var e = tNow - mk.drop.t0;
        var yy = m.y + 8 + e * DROP_V;
        var land = m.y + m.h - 6 - mk.bins[mk.drop.bin] * 3.4;
        var xx = m.x + m.w / 2 + Math.sin(e * 5.1) * 12 * Math.min(1, e * 1.5)
               + (mk.drop.bin - 2) * 13 * Math.min(1, Math.max(0, (yy - m.y) / m.h));
        if (yy >= land) {
          if (mk.bins[mk.drop.bin] < 24) mk.bins[mk.drop.bin]++;
          mk.drop = null;
        } else {
          stroke([[xx - 2.5, yy], [xx + 2.5, yy - 1.2]], INK.verm, 1.6, 0.85, 1, 7999);
        }
      }
    }
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
    var links = document.querySelector('footer a');
    var a = { nameRight: W * 0.72, nameTop: H * 0.2, footerX: W * 0.12, footerY: H - 60,
              machineX: W * 0.82, machineY: H * 0.58 };
    if (name) {
      var r = name.getBoundingClientRect();
      a.nameRight = r.right; a.nameTop = r.top;
    }
    if (links) {
      var r2 = links.getBoundingClientRect();
      a.footerX = r2.right + 26; a.footerY = r2.top + 4;
    }
    var stack = document.querySelector('.stack');
    a.stackLeft = W * 0.3;
    if (stack) {
      var r3 = stack.getBoundingClientRect();
      a.stackLeft = r3.left;
      if (W < 700) {
        a.machineX = W * 0.62;
        a.machineY = Math.min(H - 210, r3.bottom + 20);
      } else {
        a.machineX = Math.min(W - 130, r3.right + 48);
        a.machineY = H * 0.52;
      }
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
  }

  var clock0 = 0, pauseShift = 0, pausedAt = 0, hiddenAt = 0;
  var paused = false, raf = 0, lastBoil = -1;

  function sceneT(tms) { return (tms - clock0 - pauseShift) / 1000; }

  function render(tNow, animating) {
    ctx.clearRect(0, 0, W, H);
    drawFlecks();
    drawStitches(tNow);
    var i;
    for (i = 0; i < sprigs.length; i++) drawSprig(sprigs[i], tNow);
    drawThread(animating ? tNow : 0);
    drawMachine(tNow, 0, animating);
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
    initMachine();
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
