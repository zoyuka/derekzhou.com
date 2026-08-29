/* Quincunx — a date-seeded, deterministic Galton board.
   One decision at a time; the curve shows up anyway.

   Every ball's terminal bin comes from a van der Corput low-discrepancy
   quantile pushed through the inverse Binomial(n, p) CDF, so the sediment
   converges to the bell at O(log N / N) — serenely, never noisily. The peg
   lattice is Pascal's triangle; pegs where C(r, i) is odd (Sierpinski) sit
   a shade darker. The bias p breathes ±0.06 on a 150 s tide. Seeded by the
   date: every visitor sees the same edition on the same day.

   Modes: ANIM (wide viewports), STILL (reduced motion: the converged
   edition, no loop), BAND (narrow viewports: a static horizon of sediment),
   or nothing at all (print, via CSS). No network. No allocation in the hot
   loop. rAF stops whenever nothing moves. */

(function () {
  'use strict';

  /* ---------------- CONFIG — the calm envelope ---------------- */

  var PITCH = 24;            // peg pitch, px — the site's baseline grid
  var HALF = PITCH / 2;      // lateral step per row
  var PEG_R = 1.5;           // peg radius
  var BALL_R = 2.5;          // ball radius
  var DOT_R = 1.6;           // sediment grain radius
  var STACK = 4.5;           // sediment vertical pitch, px per landing
  var ROWS_CHOICES = [12, 10, 8];
  var ENTRY_MS = 500;        // fall-in above row 0
  var ROW_MS = 450;          // per-row segment
  var DESCENT_V = 90;        // px/s max post-lattice descent
  var SPAWN_MS = 1200;       // base spawn interval
  var SPAWN_MIN = 500;       // hard minimum gap
  var TIDE_S = 75;           // spawn-rate tide period
  var BREATH_S = 150;        // bias-breathing period
  var BREATH_AMP = 0.06;     // p = 0.5 ± this
  var AMBIENT_CAP = 8;       // balls in flight, ambient
  var USER_CAP = 12;         // cap while user is clicking
  var GLOW_MS = 400;         // peg-contact glow decay τ
  var TRAIL_N = 18;          // trail samples per ball
  var TRAIL_MS = 33;         // trail sample interval
  var COL_CAP = 110;         // max sediment column height, px
  var CURVE_AFTER = 60;      // landings before the Gaussian whisper appears
  var STILL_N = 420;         // landings pre-run for static editions
  var WIDE_W = 1280;         // ANIM needs at least this viewport width
  var WIDE_H = 620;          // ...and height
  var BAND_H = 120;          // mobile horizon band height
  var FADE_DELAY = 1200;     // ms before first reveal
  var BENCH_FRAMES = 120;    // self-benchmark window
  var BENCH_MS = 12;         // median frame budget before stepping down

  var ALPHA = {
    light: { pegOdd: 0.30, pegEven: 0.18, glow: 0.55, ball: 0.55,
             dot: 0.50, curve: 0.28 },
    dark:  { pegOdd: 0.22, pegEven: 0.13, glow: 0.45, ball: 0.45,
             dot: 0.40, curve: 0.22 }
  };

  /* ---------------- PRNG — deterministic, date-seeded ---------------- */

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

  function splitmix32(a) {
    return function () {
      a = (a + 0x9e3779b9) | 0;
      var t = a ^ (a >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735a2d97);
      return ((t ^ (t >>> 15)) >>> 0) / 4294967296;
    };
  }

  /* Base-2 radical inverse: the van der Corput sequence. */
  function vdc(m) {
    var u = 0, f = 0.5;
    m = m | 0;
    while (m > 0) { u += f * (m & 1); m >>= 1; f *= 0.5; }
    return u;
  }

  var day = new Date();
  var daySeed = xmur3(day.getFullYear() + '-' + (day.getMonth() + 1) + '-' + day.getDate())();
  var breathPhase = (daySeed % 1000) / 1000 * BREATH_S;

  /* ---------------- Binomial engine ---------------- */

  var N_ROWS = 12;             // set by layout
  var cdf = [];                // CDF table for current p
  var cdfP = -1;

  function pmfTable(n, p) {
    var t = [], q = 1 - p, c = Math.pow(q, n), k;
    for (k = 0; k <= n; k++) {
      t.push(c);
      c = c * (n - k) / (k + 1) * (p / q);
    }
    return t;
  }

  function rebuildCdf(p) {
    var pmf = pmfTable(N_ROWS, p), acc = 0, k;
    cdf = [];
    for (k = 0; k <= N_ROWS; k++) { acc += pmf[k]; cdf.push(acc); }
    cdf[N_ROWS] = 1;
    cdfP = p;
  }

  function biasNow(tSec) {
    return 0.5 + BREATH_AMP * Math.sin(2 * Math.PI * (tSec + breathPhase) / BREATH_S);
  }

  function binFor(m, tSec) {
    var p = biasNow(tSec);
    if (Math.abs(p - cdfP) > 0.005) rebuildCdf(p);
    var u = vdc(m), k = 0;
    while (k < N_ROWS && cdf[k] < u) k++;
    return k;
  }

  /* k rights among N_ROWS rows, order shuffled by the ball's substream. */
  function pathBits(m, k) {
    var rng = splitmix32((daySeed ^ Math.imul(m + 1, 0x9E3779B9)) >>> 0);
    var arr = [], i, j, tmp, bits = 0;
    for (i = 0; i < N_ROWS; i++) arr.push(i < k ? 1 : 0);
    for (i = N_ROWS - 1; i > 0; i--) {
      j = (rng() * (i + 1)) | 0;
      tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    for (i = 0; i < N_ROWS; i++) if (arr[i]) bits |= (1 << i);
    return bits;
  }

  /* ---------------- DOM + layout ---------------- */

  var staticC = document.getElementById('pk-static');
  var liveC = document.getElementById('pk-live');
  var pauseBtn = document.getElementById('pk-pause');
  if (!staticC || !liveC) return;
  var sx = staticC.getContext('2d');
  var lx = liveC.getContext('2d');

  var mode = 'none';           // 'anim' | 'still' | 'band' | 'none'
  var dpr = 1;
  var vw = 0, vh = 0;
  var stage = { left: 0, top: 0, w: 0, cx: 0, latticeTop: 0, base: 0 };
  var gamma = 1;               // sediment compression scale
  var colCap = COL_CAP;        // max column height for the current mode
  var bins = new Uint16Array(13);
  var landed = 0;
  var ink = { text: '#111110', dim: '#74746b', a: ALPHA.light };

  var mqDark = matchMedia('(prefers-color-scheme: dark)');
  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  var mqWide = matchMedia('(min-width: ' + WIDE_W + 'px) and (min-height: ' + WIDE_H + 'px)');

  function readInk() {
    var cs = getComputedStyle(document.documentElement);
    ink.text = (cs.getPropertyValue('--color-text') || '#111110').trim();
    ink.dim = (cs.getPropertyValue('--color-dimmed') || '#74746b').trim();
    ink.a = mqDark.matches ? ALPHA.dark : ALPHA.light;
  }

  function sizeCanvas(c, ctx) {
    c.width = Math.round(vw * dpr);
    c.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* Old Safari (<=13) exposes only addListener on MediaQueryList. */
  function listenMq(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  function layout() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, benched.dprCap);
    sizeCanvas(staticC, sx);
    sizeCanvas(liveC, lx);
    cdfP = -1;

    if (mode === 'band') {
      /* The horizon band belongs to the END of the document — where the
         CSS padding-bottom reserves clear space — not to the viewport.
         Anchor the static canvas to the document so the band can never
         sit under text on a scrollable page. */
      var docH = Math.max(vh, document.documentElement.scrollHeight);
      staticC.style.position = 'absolute';
      staticC.style.height = docH + 'px';
      liveC.style.display = 'none';        // unused in band mode
      staticC.width = Math.round(vw * dpr);
      staticC.height = Math.round(docH * dpr);
      sx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var fit = ((vw - 32) / PITCH - 1) | 0;
      N_ROWS = fit >= 12 ? 12 : fit >= 10 ? 10 : 8;
      stage.cx = vw / 2;
      stage.base = docH - 16;
      colCap = BAND_H - 30;
      return;
    }
    staticC.style.position = '';
    staticC.style.height = '';
    liveC.style.display = '';
    if (mode === 'none') return;

    var colRight = vw / 2 + 300;             // 600px column, centered
    stage.left = colRight + 64;
    stage.w = Math.min(336, vw - 48 - stage.left);
    var i, n = 0;
    for (i = 0; i < ROWS_CHOICES.length; i++) {
      if ((ROWS_CHOICES[i] + 1) * PITCH <= stage.w) { n = ROWS_CHOICES[i]; break; }
    }
    N_ROWS = n || 8;
    colCap = COL_CAP;
    stage.cx = stage.left + stage.w / 2;
    var h1 = document.querySelector('h1');
    stage.latticeTop = h1 ? Math.max(64, h1.getBoundingClientRect().top + window.scrollY) : 96;
    stage.base = vh - 24;
  }

  function rowY(r) { return stage.latticeTop + 40 + r * PITCH; }
  function binX(k) { return stage.cx + (k - N_ROWS / 2) * PITCH; }

  /* x offset (px from center) after s completed steps of a path */
  function xAfter(bits, s) {
    var rights = 0, i;
    for (i = 0; i < s; i++) if (bits & (1 << i)) rights++;
    return (2 * rights - s) * HALF;
  }

  /* ---------------- Static layer: pegs, sediment, curve ---------------- */

  function grainRng(k, idx) {
    return splitmix32((daySeed ^ Math.imul(k * 8191 + idx + 1, 0x85EBCA6B)) >>> 0);
  }

  function drawPegs() {
    var r, i, odd, x, y;
    sx.save();
    for (r = 0; r < N_ROWS; r++) {
      for (i = 0; i <= r; i++) {
        odd = (i & (r - i)) === 0;          // C(r, i) odd — Sierpinski
        x = stage.cx + (i - r / 2) * PITCH;
        y = rowY(r);
        sx.globalAlpha = odd ? ink.a.pegOdd : ink.a.pegEven;
        sx.fillStyle = ink.dim;
        sx.beginPath();
        sx.arc(x, y, PEG_R, 0, 6.2832);
        sx.fill();
      }
    }
    sx.restore();
  }

  function drawSedimentDot(k, idx) {
    var rng = grainRng(k, idx);
    var x = binX(k) + (rng() - 0.5) * PITCH * 0.7;
    var y = stage.base - (idx + 0.5) * STACK * gamma;
    sx.globalAlpha = ink.a.dot;
    sx.fillStyle = ink.dim;
    sx.beginPath();
    sx.arc(x, y, DOT_R, 0, 6.2832);
    sx.fill();
    sx.globalAlpha = 1;
  }

  function drawCurve() {
    if (landed < CURVE_AFTER) return;
    var p = 0.5, mu = N_ROWS * p, s2 = N_ROWS * p * (1 - p);
    var lo = binX(0) - PITCH, hi = binX(N_ROWS) + PITCH, x, k, e, y;
    sx.save();
    sx.globalAlpha = ink.a.curve;
    sx.strokeStyle = ink.text;
    sx.lineWidth = 1;
    sx.beginPath();
    for (x = lo; x <= hi; x += 2) {
      k = (x - binX(0)) / PITCH;
      e = landed * Math.exp(-(k - mu) * (k - mu) / (2 * s2)) / Math.sqrt(2 * Math.PI * s2);
      y = stage.base - e * STACK * gamma;
      if (x === lo) sx.moveTo(x, y); else sx.lineTo(x, y);
    }
    sx.stroke();
    sx.restore();
  }

  /* Full sediment repaint, batched into one path (one fill call).
     Per-bin draw cap: beyond ~400 grains a column is visually saturated
     under gamma compression; drawing more is pure cost. The first 400
     per bin have stable substreams, so repaints are pixel-identical. */
  function drawAllSediment() {
    var k, i, n, rng, x, y;
    sx.globalAlpha = ink.a.dot;
    sx.fillStyle = ink.dim;
    sx.beginPath();
    for (k = 0; k <= N_ROWS; k++) {
      n = Math.min(bins[k], 400);
      for (i = 0; i < n; i++) {
        rng = grainRng(k, i);
        x = binX(k) + (rng() - 0.5) * PITCH * 0.7;
        y = stage.base - (i + 0.5) * STACK * gamma;
        sx.moveTo(x + DOT_R, y);
        sx.arc(x, y, DOT_R, 0, 6.2832);
      }
    }
    sx.fill();
    sx.globalAlpha = 1;
  }

  function redrawStatic() {
    sx.clearRect(0, 0, staticC.width, staticC.height);
    if (mode === 'band') { drawBand(); return; }
    drawPegs();
    drawAllSediment();
    drawCurve();
  }

  /* Narrow viewports: a quiet horizon of converged sediment, kept
     inside the bottom band the CSS padding reserves. Geometry comes
     from layout(). */
  function drawBand() {
    drawAllSediment();
    drawCurve();
  }

  /* Pre-run the day's edition to its converged state, no motion. */
  function settle(nBalls) {
    bins = new Uint16Array(N_ROWS + 1);
    landed = 0;
    rebuildCdf(0.5);
    var m, k;
    for (m = 1; m <= nBalls; m++) {   // skip vdc(0)=0, as the live engine does
      k = 0;
      var u = vdc(m);
      while (k < N_ROWS && cdf[k] < u) k++;
      bins[k]++;
      landed++;
    }
    compress();
  }

  function compress() {
    var tallest = 0, k;
    for (k = 0; k <= N_ROWS; k++) if (bins[k] > tallest) tallest = bins[k];
    var want = tallest * STACK > colCap ? colCap / (tallest * STACK) : 1;
    gamma = want;                       // static editions jump straight there
  }

  /* ---------------- Live layer: balls, trails, glows ---------------- */

  var CAP = USER_CAP;
  var ballOn = new Uint8Array(CAP);
  var ballBits = new Int32Array(CAP);
  var ballBin = new Int8Array(CAP);
  var ballT0 = new Float64Array(CAP);   // spawn time, ms
  var ballOu = new Float32Array(CAP);   // Ornstein-Uhlenbeck sway
  var ballRow = new Int8Array(CAP);     // last row crossed (for glows)
  var trailX = new Float32Array(CAP * TRAIL_N);
  var trailY = new Float32Array(CAP * TRAIL_N);
  var trailAge = new Float64Array(CAP * TRAIL_N);
  var trailHead = new Int16Array(CAP);
  var glowX = new Float32Array(32);
  var glowY = new Float32Array(32);
  var glowT = new Float64Array(32);
  var glowHead = 0;
  var nextM = 1;               // vdc(0) = 0 is a degenerate all-left path; start at 1
  var inFlight = 0;
  var ouRng = splitmix32(daySeed ^ 0x5F356495);

  var benched = { dprCap: 2, trails: true, cap: AMBIENT_CAP, done: false,
                  frames: [], };

  function spawn(now) {
    var cap = userBoost > 0 ? USER_CAP : benched.cap;
    if (inFlight >= cap) return;
    var slot = -1, i;
    for (i = 0; i < CAP; i++) if (!ballOn[i]) { slot = i; break; }
    if (slot < 0) return;
    var m = nextM++;
    var k = binFor(m, now / 1000);
    ballOn[slot] = 1;
    ballBin[slot] = k;
    ballBits[slot] = pathBits(m, k);
    ballT0[slot] = now;
    ballOu[slot] = 0;
    ballRow[slot] = -1;
    trailHead[slot] = 0;
    for (i = 0; i < TRAIL_N; i++) trailAge[slot * TRAIL_N + i] = -1;
    inFlight++;
  }

  function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  function land(slot) {
    var k = ballBin[slot];
    bins[k]++;
    if (bins[k] <= 400) drawSedimentDot(k, bins[k] - 1);
    landed++;
    /* Curve rescale cadence backs off geometrically: the relative change
       per landing shrinks as 1/N, so late repaints buy nothing. */
    if (landed === CURVE_AFTER ||
        (landed < 1024 && (landed & 63) === 0) ||
        (landed & 255) === 0) redrawStatic();
    var tallest = 0, i;
    for (i = 0; i <= N_ROWS; i++) if (bins[i] > tallest) tallest = bins[i];
    if (tallest * STACK * gamma > colCap) {
      gamma += (colCap / (tallest * STACK) - gamma) * 0.4;
      redrawStatic();
    }
    ballOn[slot] = 0;
    inFlight--;
  }

  /* Position of a ball at elapsed e (ms). Pure function of time. */
  function ballPos(slot, e, dt, out) {
    var bits = ballBits[slot];
    var x, y, r, tau, x0, x1;
    if (e < ENTRY_MS) {
      tau = e / ENTRY_MS;
      x = stage.cx;
      y = rowY(0) - 36 + 36 * tau * tau;
    } else {
      r = ((e - ENTRY_MS) / ROW_MS) | 0;
      tau = ((e - ENTRY_MS) % ROW_MS) / ROW_MS;
      if (r < N_ROWS) {
        x0 = stage.cx + xAfter(bits, r);
        x1 = stage.cx + xAfter(bits, r + 1);
        x = x0 + (x1 - x0) * smoother(tau);
        y = rowY(r) + PITCH * (0.30 * tau + 0.70 * tau * tau)
            + Math.sin(tau * Math.PI) * 1;
        if (r !== ballRow[slot]) {
          ballRow[slot] = r;
          glowX[glowHead] = x0; glowY[glowHead] = rowY(r);
          glowT[glowHead] = ballT0[slot] + ENTRY_MS + r * ROW_MS;
          glowHead = (glowHead + 1) & 31;
        }
      } else {
        var yTop = rowY(N_ROWS);
        var target = stage.base - (bins[ballBin[slot]] + 0.5) * STACK * gamma - BALL_R;
        var fell = (e - ENTRY_MS - N_ROWS * ROW_MS) / 1000 * DESCENT_V;
        var span = Math.max(1, target - yTop);
        var frac = Math.min(1, fell / span);
        /* linear fall, quadratic ease-out over the last 15% */
        var ease = frac < 0.85 ? frac
                 : 0.85 + 0.15 * (1 - Math.pow(1 - (frac - 0.85) / 0.15, 2));
        x = stage.cx + xAfter(bits, N_ROWS);
        y = yTop + span * ease;
        if (frac >= 1) { out.landed = true; }
      }
    }
    /* OU micro-sway, exact discretization, lattice rows only */
    if (e >= ENTRY_MS && e < ENTRY_MS + N_ROWS * ROW_MS) {
      var th = 3, sg = 1.5, d = Math.min(dt, 100) / 1000;
      var z = (ouRng() + ouRng() + ouRng()) * 2 - 3;   // ~N(0,1)
      var o = ballOu[slot] * Math.exp(-th * d)
            + sg * Math.sqrt((1 - Math.exp(-2 * th * d)) / (2 * th)) * z;
      ballOu[slot] = Math.max(-1.5, Math.min(1.5, o));
      x += ballOu[slot];
    }
    out.x = x; out.y = y;
  }

  var pos = { x: 0, y: 0, landed: false };
  var raf = 0;
  var lastT = 0;
  var running = false;
  var paused = false;
  var userBoost = 0;
  var spawnTimer = 0;
  var spawnRng = splitmix32(daySeed ^ 0x2545F491);

  var TRAIL_BUCKETS = [0.12, 0.24, 0.4];

  function frame(now, once) {
    raf = 0;
    var dt = lastT ? now - lastT : 16;
    lastT = now;
    var f0 = performance.now();

    lx.clearRect(0, 0, vw, vh);
    lx.save();
    lx.beginPath();
    lx.rect(stage.left, 0, vw - stage.left, vh);
    lx.clip();

    var slot, i, e, base, idx, age;
    /* glows */
    for (i = 0; i < 32; i++) {
      if (!glowT[i]) continue;
      age = now - glowT[i];
      if (age < 0 || age > GLOW_MS * 3) { glowT[i] = 0; continue; }
      lx.globalAlpha = ink.a.glow * Math.exp(-age / GLOW_MS);
      lx.fillStyle = ink.dim;
      lx.beginPath();
      lx.arc(glowX[i], glowY[i], PEG_R + 0.5, 0, 6.2832);
      lx.fill();
    }
    /* trails: batched, three age buckets */
    if (benched.trails) {
      var b;
      for (b = 0; b < 3; b++) {
        lx.globalAlpha = ink.a.ball * TRAIL_BUCKETS[b];
        lx.fillStyle = ink.text;
        lx.beginPath();
        for (slot = 0; slot < CAP; slot++) {
          if (!ballOn[slot]) continue;
          base = slot * TRAIL_N;
          for (i = 0; i < TRAIL_N; i++) {
            idx = base + i;
            if (trailAge[idx] < 0) continue;
            age = now - trailAge[idx];
            var bi = age < 200 ? 2 : age < 400 ? 1 : 0;
            if (bi !== b || age > 600) continue;
            lx.moveTo(trailX[idx] + 1.1, trailY[idx]);
            lx.arc(trailX[idx], trailY[idx], 1.1, 0, 6.2832);
          }
        }
        lx.fill();
      }
    }
    /* balls */
    lx.globalAlpha = ink.a.ball;
    lx.fillStyle = ink.text;
    lx.beginPath();
    for (slot = 0; slot < CAP; slot++) {
      if (!ballOn[slot]) continue;
      e = now - ballT0[slot];
      pos.landed = false;
      ballPos(slot, e, dt, pos);
      if (pos.landed) { land(slot); continue; }
      lx.moveTo(pos.x + BALL_R, pos.y);
      lx.arc(pos.x, pos.y, BALL_R, 0, 6.2832);
      base = slot * TRAIL_N;
      idx = base + trailHead[slot];
      if (trailAge[idx] < 0 || now - trailAge[idx] >= TRAIL_MS) {
        trailHead[slot] = (trailHead[slot] + 1) % TRAIL_N;
        idx = base + trailHead[slot];
        trailX[idx] = pos.x; trailY[idx] = pos.y; trailAge[idx] = now;
      }
    }
    lx.fill();
    lx.globalAlpha = 1;
    lx.restore();

    /* self-benchmark: one permanent step-down if we're too slow */
    if (!benched.done) {
      benched.frames.push(performance.now() - f0);
      if (benched.frames.length >= BENCH_FRAMES) {
        benched.frames.sort(function (a, b) { return a - b; });
        if (benched.frames[BENCH_FRAMES >> 1] > BENCH_MS) {
          benched.trails = false;
          benched.cap = 6;
          benched.dprCap = 1.5;
          layout();
          redrawStatic();
        }
        benched.done = true;
        benched.frames = null;
      }
    }

    if (once) { lastT = 0; return; }

    var anyGlow = false;
    for (i = 0; i < 32; i++) if (glowT[i]) { anyGlow = true; break; }
    if (inFlight > 0 || anyGlow) {
      raf = requestAnimationFrame(frame);
    } else {
      running = false;
      lastT = 0;
    }
  }

  function wake() {
    if (!running && mode === 'anim' && !paused && !document.hidden) {
      running = true;
      lastT = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function scheduleSpawn() {
    clearTimeout(spawnTimer);
    if (mode !== 'anim' || paused || document.hidden) return;
    var tide = 1 + 0.4 * Math.sin(2 * Math.PI * (performance.now() / 1000) / TIDE_S);
    var jitter = 0.75 + 0.5 * ((nextM * 0.61803) % 1);
    var gap = Math.max(SPAWN_MIN, SPAWN_MS * jitter / tide);
    spawnTimer = setTimeout(function () {
      if (userBoost > 0) userBoost--;
      spawn(performance.now());
      wake();
      scheduleSpawn();
    }, gap);
  }

  /* ---------------- Modes + lifecycle ---------------- */

  function decideMode() {
    if (!mqWide.matches) return 'band';
    if (mqReduce.matches) return 'still';
    return 'anim';
  }

  function clearFlight() {
    var i;
    for (i = 0; i < CAP; i++) ballOn[i] = 0;
    for (i = 0; i < 32; i++) glowT[i] = 0;
    inFlight = 0;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    running = false;
    lastT = 0;
    lx.clearRect(0, 0, vw, vh);
  }

  function enterMode(m) {
    mode = m;
    clearTimeout(spawnTimer);
    clearFlight();
    readInk();
    layout();
    if (m === 'anim') {
      if (bins.length !== N_ROWS + 1) {
        bins = new Uint16Array(N_ROWS + 1);
        landed = 0;
        gamma = 1;
      }
      redrawStatic();
      if (pauseBtn) pauseBtn.classList.add('pk-show');
      if (!paused) scheduleSpawn();
    } else {
      if (pauseBtn) pauseBtn.classList.remove('pk-show');
      settle(STILL_N);
      redrawStatic();
    }
    document.documentElement.classList.add('pk-ready');
  }

  /* Shift every stored timestamp forward by a frozen duration so time
     appears continuous across pause / tab-hide: balls, glows, AND trails. */
  function shiftClocks(d) {
    var i;
    for (i = 0; i < CAP; i++) if (ballOn[i]) ballT0[i] += d;
    for (i = 0; i < 32; i++) if (glowT[i]) glowT[i] += d;
    for (i = 0; i < CAP * TRAIL_N; i++) if (trailAge[i] >= 0) trailAge[i] += d;
  }

  function setPaused(p) {
    paused = p;
    if (pauseBtn) {
      /* The label alone names the action the button will perform.
         (Label swap + aria-pressed together read contradictorily in
         screen readers, so no aria-pressed.) */
      pauseBtn.textContent = p ? 'Play motion' : 'Pause motion';
    }
    try { localStorage.setItem('pk-paused', p ? '1' : ''); } catch (e) {}
    if (p) { clearTimeout(spawnTimer); if (raf) { cancelAnimationFrame(raf); raf = 0; } running = false; pauseShift = performance.now(); }
    else {
      if (pauseShift) {
        shiftClocks(performance.now() - pauseShift);
        pauseShift = 0;
      }
      wake();
      scheduleSpawn();
    }
  }
  var pauseShift = 0;

  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () { setPaused(!paused); });
  }

  document.addEventListener('visibilitychange', function () {
    if (mode !== 'anim') return;
    if (document.hidden) {
      clearTimeout(spawnTimer);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      running = false;
      hideShift = performance.now();
    } else if (!paused) {
      if (hideShift) {
        shiftClocks(performance.now() - hideShift);
        hideShift = 0;
      }
      wake();
      scheduleSpawn();
    }
  });
  var hideShift = 0;

  /* click-to-drop: the visitor's input is timing, not position, so the
     statistics stay pure. Canvas is pointer-inert; we listen on document. */
  var lastClick = 0;
  document.addEventListener('click', function (e) {
    if (mode !== 'anim' || paused || document.hidden) return;
    if (e.clientX < stage.left || e.target.closest('a, button')) return;
    var now = performance.now();
    if (now - lastClick < SPAWN_MIN) return;   // same >=500ms floor as ambient drops
    lastClick = now;
    userBoost = 4;
    spawn(now);
    wake();
  });

  var resizeTimer = 0, lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var w = window.innerWidth, h = window.innerHeight;
      if (w === lastW && h === lastH) return;
      if (w === lastW) {
        /* Height-only change (iOS URL-bar churn, window height drag):
           refresh backing stores + geometry without clearing flight —
           ball positions derive from width-stable coordinates, and
           stage.base/colCap re-anchor cleanly. Mode flips across the
           620px boundary arrive via the mqWide listener instead. */
        lastH = h;
        layout();
        redrawStatic();
        return;
      }
      lastW = w; lastH = h;
      enterMode(decideMode());
    }, 150);
  });

  function onMedia() { enterMode(decideMode()); }
  listenMq(mqWide, onMedia);
  listenMq(mqReduce, onMedia);
  listenMq(mqDark, function () {
    readInk();
    redrawStatic();
    if (mode === 'anim' && paused && pauseShift) {
      /* Repaint the frozen airborne scene in the new theme's ink:
         advance the frozen clocks to "now", render one frame, and
         re-freeze, so nothing appears to move. */
      shiftClocks(performance.now() - pauseShift);
      pauseShift = performance.now();
      frame(performance.now(), true);
    }
  });

  try { paused = localStorage.getItem('pk-paused') === '1'; } catch (e) {}
  if (pauseBtn && paused) {
    pauseBtn.textContent = 'Play motion';
  }

  setTimeout(function () { enterMode(decideMode()); }, FADE_DELAY);
})();
