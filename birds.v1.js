/* Birds — the dots of samara.com/jobs, drawn as birds.

   Samara's jobs page drops one small black dot per opening onto the page.
   Each shows up at a random moment within the first (count x 500) ms,
   fades in over a second, sets off in a random direction at 0.5 px a
   frame, and bounces off the edges of the window for as long as the page
   is open. This is that, move for move, with two changes: the marks are
   birds in the stroke of Derek's tattoo (GLYPHS — the three marks are the
   alphabet, do not restyle them), and the ground is light.

   The birds are in the HTML (three inline SVGs, hidden until this runs);
   this file only draws their strokes and moves them. It adds no DOM.
     - speed: SPEED px/s (Samara's 0.5 px/frame at 60 fps), time-based so a
       120 Hz screen does not fly them twice as fast
     - a bird faces the way it flies (the glyphs face left; flying right
       mirrors it) and beats its wings in stop-motion, BEAT_HZ per bird
     - prefers-reduced-motion: the birds are placed where they would have
       appeared and stay still (live, both ways)
     - a hidden tab pauses with requestAnimationFrame; the step is clamped
       so a returning tab never jumps the birds across the window */
(function () {
  'use strict';

  var birds = Array.prototype.slice.call(document.querySelectorAll('.bird'));
  if (!birds.length || !window.requestAnimationFrame || !window.matchMedia) return;

  var SPEED = 30;          // px/s
  var STAGGER = 500;       // ms per bird: each appears at random within count x STAGGER
  var SCALE = 1.2;         // glyph units to css px (a 19-26 unit bird is 23-31 px wide)
  var LINE = 1.9;          // stroke width, css px
  var PAD = 2;             // the stroke's half-width and cap around the glyph box
  var BEAT_HZ = [0.68, 0.95];
  var STEP_MAX = 0.05;     // s: the longest step a frame may take

  var GLYPHS = [
    [[0, 0], [2, 6], [9, 5], [11, 12], [19, 11]],
    [[0, 0], [2, 5], [8, 4], [9, 10], [16, 9]],
    [[0, 0], [2, 5], [8, 4], [10, 10], [15, 9], [26, 20]]   // long tail
  ];

  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var flock = [], raf = 0, last = 0, t = 0;

  function extent(pts, k) {
    var i, lo = Infinity, hi = -Infinity;
    for (i = 0; i < pts.length; i++) { lo = Math.min(lo, pts[i][k]); hi = Math.max(hi, pts[i][k]); }
    return [lo, hi];
  }

  /* the polyline for one wing position: amp 1 is the drawn mark, 0.5 the
     wings half-folded toward the body's middle line */
  function points(b, amp) {
    var out = [], i, p;
    for (i = 0; i < b.pts.length; i++) {
      p = b.pts[i];
      out.push(((p[0] - b.x0) * SCALE + PAD).toFixed(2) + ',' + ((b.mid + (p[1] - b.mid) * amp - b.y0) * SCALE + PAD).toFixed(2));
    }
    return out.join(' ');
  }

  function setup(el, i) {
    var pts = GLYPHS[i % GLYPHS.length], xs = extent(pts, 0), ys = extent(pts, 1), m = 0, k;
    for (k = 0; k < pts.length; k++) m += pts[k][1];
    var b = {
      el: el, line: el.querySelector('polyline'), pts: pts,
      x0: xs[0], y0: ys[0], mid: m / pts.length,
      w: (xs[1] - xs[0]) * SCALE + 2 * PAD, h: (ys[1] - ys[0]) * SCALE + 2 * PAD,
      x: 0, y: 0, vx: 0, vy: 0, amp: 1, face: 1,
      hz: BEAT_HZ[0] + Math.random() * (BEAT_HZ[1] - BEAT_HZ[0]), ph: Math.random() * 7,
      shown: false
    };
    el.setAttribute('viewBox', '0 0 ' + b.w.toFixed(2) + ' ' + b.h.toFixed(2));
    el.setAttribute('width', b.w.toFixed(2));
    el.setAttribute('height', b.h.toFixed(2));
    b.line.setAttribute('stroke-width', LINE);
    b.line.setAttribute('points', points(b, 1));
    return b;
  }

  function place(b) {
    b.el.style.transform = 'translate3d(' + b.x.toFixed(2) + 'px,' + b.y.toFixed(2) + 'px,0)' + (b.face < 0 ? ' scaleX(-1)' : '');
  }

  /* Samara's spawn: anywhere in the window, a random direction at full speed */
  function appear(b) {
    if (b.shown) return;
    var a = 2 * Math.random() - 1, c = 2 * Math.random() - 1, n = Math.sqrt(a * a + c * c) || 1;
    b.x = Math.random() * Math.max(0, window.innerWidth - b.w);
    b.y = Math.random() * Math.max(0, window.innerHeight - b.h);
    b.vx = a / n * SPEED; b.vy = c / n * SPEED;
    b.face = b.vx > 0 ? -1 : 1;
    b.shown = true;
    place(b);
    b.el.classList.add('on');
    flock.push(b);
    run();
  }

  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(STEP_MAX, (now - last) / 1000) : 0, W = window.innerWidth, H = window.innerHeight, i, b, amp;
    last = now; t += dt;
    for (i = 0; i < flock.length; i++) {
      b = flock[i];
      /* Samara's bounce: turn back at an edge, then clamp inside the window */
      if ((b.x + b.vx * dt < 0 && b.vx < 0) || (b.x + b.vx * dt + b.w > W && b.vx > 0)) b.vx = -b.vx;
      if ((b.y + b.vy * dt < 0 && b.vy < 0) || (b.y + b.vy * dt + b.h > H && b.vy > 0)) b.vy = -b.vy;
      b.x = Math.min(Math.max(b.x + b.vx * dt, 0), Math.max(0, W - b.w));
      b.y = Math.min(Math.max(b.y + b.vy * dt, 0), Math.max(0, H - b.h));
      b.face = b.vx > 0 ? -1 : 1;
      amp = Math.floor(t * b.hz + b.ph) % 2 ? 1 : 0.5;          // stop-motion wing-beat
      if (amp !== b.amp) { b.amp = amp; b.line.setAttribute('points', points(b, amp)); }
      place(b);
    }
    run();
  }

  function run() {
    if (raf || still.matches || !flock.length) return;
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0; last = 0;
  }

  var all = birds.map(setup);
  if (still.matches) {
    all.forEach(appear);               // placed at once, still: no fade, no flight
  } else {
    all.forEach(function (b) {
      window.setTimeout(function () { appear(b); }, STAGGER * Math.random() * all.length);
    });
  }

  function onPref() {
    if (still.matches) { stop(); all.forEach(function (b) { if (!b.shown) appear(b); }); }
    else run();
  }
  if (still.addEventListener) still.addEventListener('change', onPref);
  else if (still.addListener) still.addListener(onPref);
})();
