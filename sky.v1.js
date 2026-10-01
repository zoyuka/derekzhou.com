/* The sky — light and cloud behind the page.

   The owner's brief, paraphrased: the background a luminous sky above a
   sea of cloud, as close as it can be made to the light and clouds of a
   world they love, with no shortcuts; every time of day, cycling, the
   visit opening on the visitor's own hour; the whole sky, behind the
   words too.

   ONE CAMERA. The window is the birds' camera (birds.v9.js): it looks
   out and up over a sea of cloud, the horizon a fifth of the window's
   height above its bottom edge (lower where the words come down that
   far). The birds aim it and lend it here (skyAir.aim); everything below
   is drawn through it, so a bird far off fades into the same haze the
   clouds do, and the birds always fly nearer than any cloud.

   WHAT IS DRAWN, back to front, per pixel (WebGL2, one fragment shader):
   the sky's light (a gradient by height above the horizon, warmed toward
   the light's side and deepened away from it; the sun or the moon, their
   halos); a high deck (thin streaks, or a whole overcast with rain under
   it); cumulus towers rising out of the sea (soft-edged volumes: puffs
   joined smoothly and eroded by 3D noise, lit by a wrapped sun, shadowed
   toward it, their bases darker, their thin edges glowing when the light
   is behind them); and the sea of cloud below the eye (soft rounded
   billows, a heightfield of domes thick as cloud: self-shadowed at a low
   sun, rims lit against it). The air between: every cloud fades with
   distance into the haze of the horizon (aerial perspective). Then light
   shafts from the sun through the gaps (radial, from the sky visible
   near it), a soft glow (bloom), and a gentle shoulder for the
   highlights. Shadows take the sky's colour, lit faces the light's.

   THE DAY (the cycle). Six times of day in turn, dawn, day, rain,
   sunset, dusk, night, each held a minute or two and passing into the
   next over about a minute (colours blended in OKLab; the sun and moon
   fade where they stand rather than slide); the round about 14 minutes.
   A visit opens on the visitor's hour (hour.v1.js marks the page), part
   way through it. Each time of day is our own: its colours worked out
   from the light (a low sun golden, the air away from it deep), not
   taken from any picture.

   THE WORDS stay legible on every sky: where they stand, the light is
   held inside a band (the veil: a feathered lift, or a dimming, of only
   what would break it), and the words' colours follow the sky: dark on
   a light sky, light on a dark one, the dimmed grey worked out afresh
   for 4.6:1 on its ground, the focus ring 3:1. The flip from dark words
   to light (dusk) and back (dawn) happens where both read at 4.6:1. The
   ground is read back from what was drawn (8 numbers, without stalling).

   CALM. The clouds drift (well under a pixel a second near the window,
   less far off) and build and dissolve over minutes; the light changes
   over a minute; rain falls on twos (12 drawings a second, as the birds'
   hand). A cloud frame is drawn in slices over about a second and a half
   and crossfaded into, so no frame is long; the sky is drawn 12 times a
   second; a slow device draws it smaller. prefers-reduced-motion: a
   still sky of the visitor's hour, drawn once. A hidden tab draws
   nothing. Forced colours: no sky. No WebGL2: the stylesheet's sky of
   the hour (and with no script at all, its day).

   THE WEATHER: one crypto.getRandomValues at init, above the INIT-END
   marker (the cloud field, the towers, the wind, the stars), and no
   clock (hour.v1.js read it). No DOM is built: the canvas is in
   index.html. */
(function () {
  'use strict';

  var canvas = document.querySelector('canvas.sky');
  if (!canvas || !window.WebGL2RenderingContext) return;

  var visit = new Uint32Array(1);
  window.crypto.getRandomValues(visit);

  /* ---- INIT-END: no entropy and no clock below this line ---- */

  /* ---------------- tunables ---------------- */

  var STEP_MAX = 0.05;        // s: the longest step the sky's clock takes (a hidden tab stops it)
  var PERIOD = 1.5;           // s: a cloud frame is drawn over this, then crossfaded into
  var PERIOD_MAX = 3.5;       // s: ... at most, on a slow device
  var DRAW_FPS = 12;          // the sky is drawn on twos, as the birds' hand
  var SCALE = 0.5;            // cloud frames at this share of the window's CSS px...
  var SCALE_MIN = 0.3;        // ... down to this on a slow device
  var PX_MAX = 640000;        // ... and never more pixels than this
  var CANVAS_DPR = 1.5;       // the canvas at most this many device px a CSS px
  var SEA_DRIFT = [0.45, 0.8];   // px/s: the sea's drift where it is nearest the window
  var TOWERS = 6;             // tower slots
  var BUILD = 90;             // s: a tower building out of the sea, or sinking back
  var WORDS_CORE = 8;         // px: the veil's full hold about the words
  var WORDS_FEATHER = 110;    // px: its feather beyond (a Gaussian's fall)
  var LINKS_CORE = 6, LINKS_FEATHER = 40;
  var RATIO = 4.6;            // the words' contrast on the sky (WCAG, with margin)
  var RING = 3.1;             // the focus ring's
  var FLIP = 0.18;            // the sky's luminance where dark words give way to light
  var DEG = Math.PI / 180;

  /* ---------------- the visit's streams (splitmix32) ---------------- */

  function stream(s) {
    s = s >>> 0;
    return function () {
      s = (s + 0x9e3779b9) >>> 0;
      var z = s;
      z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
      z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
      return ((z ^ (z >>> 16)) >>> 0) / 4294967296;
    };
  }
  var front = stream(visit[0]);
  var rTower = stream(front() * 4294967296), rWind = stream(front() * 4294967296);
  var noiseSeed = (front() * 4294967296) >>> 0, starSeed = Math.floor(front() * 997);
  function mix(a, b, k) { return a + (b - a) * k; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function smooth(k) { k = clamp(k, 0, 1); return k * k * k * (k * (k * 6 - 15) + 10); }

  /* ---------------- colour: OKLCH in, linear sRGB out ---------------- */

  function lab(L, C, h) { return [L, C * Math.cos(h * DEG), C * Math.sin(h * DEG)]; }
  function linOf(c) {
    var l = c[0] + 0.3963377774 * c[1] + 0.2158037573 * c[2],
        m = c[0] - 0.1055613458 * c[1] - 0.0638541728 * c[2],
        s = c[0] - 0.0894841775 * c[1] - 1.2914855480 * c[2];
    l = l * l * l; m = m * m * m; s = s * s * s;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  function lumOf(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function enc(v) { v = clamp(v, 0, 1); return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055; }
  function hex(c) {
    var s = '#', i, v;
    for (i = 0; i < 3; i++) { v = Math.round(enc(c[i]) * 255); s += (v < 16 ? '0' : '') + v.toString(16); }
    return s;
  }
  /* the colour of this hue and chroma whose luminance is Y (by halving on L) */
  function ofLum(Y, C, h) {
    var lo = 0, hi = 1, i, L, c;
    for (i = 0; i < 24; i++) {
      L = (lo + hi) / 2; c = linOf(lab(L, C * Math.min(1, L * 1.6), h));
      c = [clamp(c[0], 0, 1), clamp(c[1], 0, 1), clamp(c[2], 0, 1)];
      if (lumOf(c) < Y) lo = L; else hi = L;
    }
    return c;
  }

  /* ---------------- the times of day ----------------
     sky: horizon, 5, 15, 32, 60 degrees up (OKLCH). light: its colour
     and strength, and where it comes from (az, el in degrees: az across
     the window, + to the right; or the disc's place). disc: the sun or
     moon (x: share of the window's width; el: degrees above the
     horizon, or y: share of its height; r: its radius in degrees; i:
     brightness; halo, haloI, wide: its glow). amb: ambient from above
     (the sky) and below (the cloud); alb: the cloud's own colour. sea:
     how far below the eye its tops lie, their height, softness, and how
     much they vary. fog: the air's density. deck: height, cover,
     opacity, darkening. towers: how many of the slots, how tall. words:
     0 dark on light, 1 light on dark (the opening state; after that the
     drawn sky decides) */
  var DAY = ['dawn', 'day', 'rain', 'sunset', 'dusk', 'night'];
  var SCENES = {
    dawn: {
      hold: 75, move: 55, words: 0,
      sky: [[0.905, 0.046, 50], [0.875, 0.046, 22], [0.83, 0.045, 345], [0.755, 0.054, 304], [0.67, 0.064, 288]],
      tint: [0.935, 0.06, 64], tintAmt: 0.55, tintPow: 3, deep: 0.12,
      lightC: [0.9, 0.065, 58], lightI: 1.0, light: 'disc',
      disc: { x: 0.13, el: 2.4, r: 0.5, i: 5, halo: 60, haloI: 0.4, wide: 0.12, c: [0.96, 0.06, 70] },
      ambU: [0.74, 0.06, 292], ambUI: 0.62, ambD: [0.86, 0.045, 42], ambDI: 0.5, alb: [0.985, 0.008, 60],
      sea: [1, 0.62, 0.05, 0.55], fog: 0.022, mist: 0.55, fogC: [0.89, 0.04, 30],
      deck: [7, 0.32, 0.55, 0.08], deckC: [0.9, 0.045, 25],
      towers: 0.5, tall: 0.75, stars: 0.03, rain: 0, rainC: [0.9, 0.02, 220],
      shafts: 0.32, shaftC: [0.95, 0.06, 65], bloom: 0.2, exposure: 1.0, sat: 1.0
    },
    day: {
      hold: 110, move: 60, words: 0,
      sky: [[0.935, 0.026, 214], [0.895, 0.045, 222], [0.825, 0.074, 230], [0.735, 0.098, 236], [0.645, 0.113, 242]],
      tint: [0.975, 0.02, 100], tintAmt: 0.32, tintPow: 2.5, deep: 0.1,
      lightC: [0.99, 0.022, 88], lightI: 0.85, light: { az: -112, el: 40 },
      disc: null,
      ambU: [0.78, 0.085, 236], ambUI: 0.55, ambD: [0.93, 0.02, 210], ambDI: 0.4, alb: [0.99, 0.005, 220],
      sea: [1, 0.66, 0.07, 0.6], fog: 0.019, mist: 0.5, fogC: [0.925, 0.025, 214],
      deck: [7, 0.24, 0.6, 0], deckC: [0.975, 0.01, 220],
      towers: 0.9, tall: 1.0, stars: 0, rain: 0, rainC: [0.9, 0.02, 220],
      shafts: 0.14, shaftC: [0.99, 0.02, 90], bloom: 0.12, exposure: 1.0, sat: 1.0
    },
    rain: {
      hold: 80, move: 60, words: 0,
      sky: [[0.82, 0.03, 196], [0.775, 0.034, 204], [0.725, 0.038, 212], [0.64, 0.04, 222], [0.56, 0.04, 232]],
      tint: [0.84, 0.03, 190], tintAmt: 0.22, tintPow: 2, deep: 0.05,
      lightC: [0.86, 0.02, 205], lightI: 0.42, light: { az: -12, el: 40 },
      disc: null,
      ambU: [0.66, 0.04, 220], ambUI: 0.72, ambD: [0.72, 0.035, 200], ambDI: 0.55, alb: [0.93, 0.01, 205],
      sea: [1, 0.55, 0.065, 0.5], fog: 0.034, mist: 0.7, fogC: [0.78, 0.03, 200],
      deck: [5, 0.96, 0.9, 0.22], deckC: [0.74, 0.033, 212],
      towers: 0.25, tall: 0.7, stars: 0, rain: 1, rainC: [0.9, 0.025, 200],
      shafts: 0, shaftC: [0.9, 0.02, 200], bloom: 0.05, exposure: 1.0, sat: 1.0
    },
    sunset: {
      hold: 80, move: 60, words: 0,
      sky: [[0.915, 0.066, 76], [0.885, 0.06, 56], [0.835, 0.052, 22], [0.755, 0.05, 347], [0.665, 0.058, 322]],
      tint: [0.945, 0.08, 80], tintAmt: 0.6, tintPow: 3, deep: 0.15,
      lightC: [0.88, 0.095, 68], lightI: 1.05, light: 'disc',
      disc: { x: 0.86, el: 2.2, r: 0.55, i: 6, halo: 45, haloI: 0.55, wide: 0.16, c: [0.96, 0.085, 80] },
      ambU: [0.71, 0.06, 322], ambUI: 0.6, ambD: [0.85, 0.065, 58], ambDI: 0.5, alb: [0.98, 0.02, 70],
      sea: [1, 0.66, 0.05, 0.6], fog: 0.024, mist: 0.5, fogC: [0.88, 0.05, 50],
      deck: [7, 0.36, 0.6, 0.05], deckC: [0.86, 0.065, 40],
      towers: 1.0, tall: 1.0, stars: 0, rain: 0, rainC: [0.9, 0.02, 220],
      shafts: 0.55, shaftC: [0.95, 0.085, 75], bloom: 0.25, exposure: 1.0, sat: 1.0
    },
    dusk: {
      hold: 50, move: 60, words: 1,
      sky: [[0.5, 0.078, 74], [0.39, 0.062, 88], [0.315, 0.048, 110], [0.28, 0.04, 148], [0.25, 0.035, 196]],
      tint: [0.56, 0.09, 72], tintAmt: 0.36, tintPow: 7, deep: 0.12,
      lightC: [0.66, 0.09, 70], lightI: 0.5, light: { az: -24, el: -2.5 },
      disc: { az: -24, el: -2.5, r: 0.5, i: 0, halo: 9, haloI: 0.08, wide: 0.015, c: [0.66, 0.1, 74] },
      ambU: [0.37, 0.04, 158], ambUI: 0.7, ambD: [0.47, 0.05, 82], ambDI: 0.5, alb: [0.86, 0.03, 85],
      sea: [1, 0.6, 0.06, 0.55], fog: 0.03, mist: 0.65, fogC: [0.5, 0.06, 86],
      deck: [7, 0.55, 0.7, 0.2], deckC: [0.32, 0.04, 118],
      towers: 0.7, tall: 0.9, stars: 0.15, rain: 0, rainC: [0.9, 0.02, 220],
      shafts: 0.18, shaftC: [0.66, 0.1, 74], bloom: 0.12, exposure: 1.0, sat: 1.0
    },
    night: {
      hold: 90, move: 60, words: 1,
      sky: [[0.42, 0.07, 256], [0.37, 0.08, 260], [0.32, 0.088, 264], [0.27, 0.088, 266], [0.22, 0.08, 268]],
      tint: [0.38, 0.06, 250], tintAmt: 0.2, tintPow: 2, deep: 0.05,
      lightC: [0.8, 0.03, 250], lightI: 0.38, light: 'disc',
      disc: { x: 0.18, y: 0.1, r: 0.6, i: 1.7, halo: 70, haloI: 0.2, wide: 0.01, c: [0.94, 0.02, 245] },
      ambU: [0.3, 0.08, 265], ambUI: 0.7, ambD: [0.36, 0.06, 255], ambDI: 0.5, alb: [0.95, 0.01, 250],
      sea: [1, 0.62, 0.05, 0.55], fog: 0.02, mist: 0.5, fogC: [0.4, 0.07, 258],
      deck: [7, 0.2, 0.4, 0.05], deckC: [0.38, 0.05, 260],
      towers: 0.5, tall: 0.85, stars: 1, rain: 0, rainC: [0.9, 0.02, 220],
      shafts: 0, shaftC: [0.9, 0.02, 245], bloom: 0.05, exposure: 1.0, sat: 1.0
    }
  };
  var COLOURS = ['tint', 'lightC', 'ambU', 'ambD', 'alb', 'fogC', 'deckC', 'rainC', 'shaftC'];
  var NUMBERS = ['mist', 'tintAmt', 'tintPow', 'deep', 'lightI', 'ambUI', 'ambDI', 'fog', 'towers', 'tall', 'stars', 'rain', 'shafts', 'bloom', 'exposure', 'sat'];
  DAY.forEach(function (n) {
    var S = SCENES[n], k;
    S.skyL = S.sky.map(function (c) { return lab(c[0], c[1], c[2]); });
    for (k = 0; k < COLOURS.length; k++) S[COLOURS[k] + 'L'] = lab(S[COLOURS[k]][0], S[COLOURS[k]][1], S[COLOURS[k]][2]);
    if (S.disc) S.disc.L = lab(S.disc.c[0], S.disc.c[1], S.disc.c[2]);
  });
  var ROUND = 0, starts = [];
  DAY.forEach(function (n) { starts.push(ROUND); ROUND += SCENES[n].hold + SCENES[n].move; });
  /* the twilight between a time of dark words and one of light (sunset to
     dusk, night to dawn): halfway in everything, but the sky where the
     words stand evenly at the crossing (OKLab L 0.56, where dark words
     and light read alike), the glows low. The words flip there, and the
     veil has nothing to hold */
  var TWILIGHT = [0.594, 0.568, 0.553, 0.543, 0.492];   // (as drawn, with the haze and glows, the crossing itself)
  DAY.forEach(function (n, i) {
    var A = SCENES[n], B = SCENES[DAY[(i + 1) % DAY.length]], C = {}, j, f;
    if (A.words === B.words) return;
    C.skyL = A.skyL.map(function (c, j) { var m = lerp3(c, B.skyL[j], 0.5); return [TWILIGHT[j], m[1] * 0.7, m[2] * 0.7]; });
    for (j = 0; j < COLOURS.length; j++) { f = COLOURS[j] + 'L'; C[f] = lerp3(A[f], B[f], 0.5); }
    for (j = 0; j < NUMBERS.length; j++) { f = NUMBERS[j]; C[f] = mix(A[f], B[f], 0.5); }
    C.tintL = [0.6, C.tintL[1] * 0.7, C.tintL[2] * 0.7]; C.tintAmt *= 0.4;
    C.fogCL = [0.62, C.fogCL[1] * 0.8, C.fogCL[2] * 0.8];
    C.deckCL = [0.55, C.deckCL[1] * 0.7, C.deckCL[2] * 0.7];
    C.sea = lerpN(A.sea, B.sea, 0.5); C.deck = lerpN(A.deck, B.deck, 0.5); C.deck[2] *= 0.6;
    C.rain = 0; C.shafts *= 0.4; C.bloom = Math.min(C.bloom, 0.08);
    C.lightI *= 0.4; C.ambUI *= 0.6; C.ambDI *= 0.55;  // (the cloud sea under the links dims to the crossing as well)
    A.twi = C;
  });

  /* where the visit opens: the visitor's hour, part way through it (hour.v1.js) */
  var root = document.documentElement;
  var opening = DAY.indexOf(root.getAttribute('data-sky') || 'day'), openAt = parseFloat(root.getAttribute('data-sky-at'));
  if (opening < 0) opening = 1;
  if (!(openAt >= 0 && openAt <= 1)) openAt = 0.5;
  var t0 = starts[opening] + SCENES[DAY[opening]].hold * openAt * 0.9;

  /* ---------------- the page: the window and the words ---------------- */

  /* the words: the whole stack (the towers keep clear of it), the name,
     the bio and credit (where the dimmed grey is), and the links */
  var W = 0, H = 0, stackR = null, nameR = null, wordsR = null, links = [], dirty = true;
  function measure() {
    W = window.innerWidth; H = window.innerHeight;
    var a = document.querySelectorAll('footer a'), i;
    stackR = rectOf1('.stack'); nameR = rectOf1('.stack h1');
    wordsR = union(rectOf1('.bio'), rectOf1('.credit'));
    links = [];
    for (i = 0; i < a.length && i < 2; i++) if (a[i].getBoundingClientRect().right > a[i].getBoundingClientRect().left) links.push(boxOf(a[i].getBoundingClientRect()));
    dirty = false;
  }
  function boxOf(r) { return [r.left, r.top, r.right, r.bottom]; }
  function rectOf1(sel) { var e = document.querySelector(sel), r; if (!e) return null; r = e.getBoundingClientRect(); return r.right > r.left ? boxOf(r) : null; }
  function union(a, b) { return !a ? b : (!b ? a : [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]); }

  /* ---------------- the camera (the birds', lent; or the same, worked out here) ---------------- */

  var cam = { f: 1, c: 1, s: 0, th: 0, x0: 0, y0: 0, hy: 0, W: 0, H: 0, lent: false };
  function ownCamera() {
    var f = Math.max(W, H) / (2 * Math.tan(30 * DEG));
    var hy = clamp(Math.max(H * 0.8, (stackR ? stackR[3] : 0) + 24 + 60), H * 0.8, H * 0.95);
    setCamera(f, Math.atan((hy - H / 2) / f), W, H);
  }
  function setCamera(f, th, w, h) {
    cam.f = f; cam.th = th; cam.c = Math.cos(th); cam.s = Math.sin(th);
    cam.x0 = w / 2; cam.y0 = h / 2; cam.hy = cam.y0 + f * Math.tan(th); cam.W = w; cam.H = h;
    aimed = true;
  }
  var aimed = false;
  /* a direction in the air (x right, y up, z out) to the window, and back */
  function toWindow(d, o) {
    var yc = d[1] * cam.c - d[2] * cam.s, zc = d[1] * cam.s + d[2] * cam.c;
    o[0] = cam.x0 + cam.f * d[0] / zc; o[1] = cam.y0 - cam.f * yc / zc; o[2] = zc;
    return o;
  }
  function fromWindow(sx, sy) {
    var x = sx - cam.x0, y = cam.y0 - sy, z = cam.f, n;
    var d = [x, y * cam.c + z * cam.s, z * cam.c - y * cam.s];
    n = Math.hypot(d[0], d[1], d[2]);
    return [d[0] / n, d[1] / n, d[2] / n];
  }
  function dirOf(az, el) { return [Math.sin(az * DEG) * Math.cos(el * DEG), Math.sin(el * DEG), Math.cos(az * DEG) * Math.cos(el * DEG)]; }
  /* a disc's direction: by its place on the window (x a share of the width, at el degrees up, or at y a share of the height) */
  function discDir(D) {
    if (D.az !== undefined) return dirOf(D.az, D.el);
    if (D.y !== undefined) return fromWindow(D.x * W, D.y * H);
    var k = (D.x * W - cam.x0) / cam.f, A = Math.cos(D.el * DEG), B = Math.sin(D.el * DEG) * cam.s,
        R = Math.sqrt(1 + k * k * cam.c * cam.c), az = Math.atan(k * cam.c) + Math.asin(clamp(k * B / (A * R), -1, 1));
    return dirOf(az / DEG, D.el);
  }

  /* ---------------- the cycle: where the sky is, blended ---------------- */

  var P = {};                 // the sky now: every field of a scene, blended, and the discs
  function blend(t) {
    var u = ((t0 + t) % ROUND + ROUND) % ROUND, i = 0, A, B, k, j, f;
    while (i < DAY.length - 1 && u >= starts[i + 1]) i++;
    A = SCENES[DAY[i]]; B = SCENES[DAY[(i + 1) % DAY.length]];
    k = clamp((u - starts[i] - A.hold) / A.move, 0, 1);
    var X = A, Y = B, q;                                  // (a change that flips the words eases into its twilight and out:
    if (A.twi) {                                          //  the light lingers where the words flip)
      if (k < 0.5) { Y = A.twi; q = smooth(k * 2); } else { X = A.twi; q = smooth(k * 2 - 1); }
    } else q = k = smooth(k);
    P.k = k; P.a = A; P.b = B; P.name = k < 0.5 ? DAY[i] : DAY[(i + 1) % DAY.length];
    P.sky = [];
    for (j = 0; j < 5; j++) P.sky.push(linOf(lerp3(X.skyL[j], Y.skyL[j], q)));
    for (j = 0; j < COLOURS.length; j++) { f = COLOURS[j]; P[f] = linOf(lerp3(X[f + 'L'], Y[f + 'L'], q)); }
    for (j = 0; j < NUMBERS.length; j++) { f = NUMBERS[j]; P[f] = mix(X[f], Y[f], q); }
    P.sea = lerpN(X.sea, Y.sea, q); P.deck = lerpN(X.deck, Y.deck, q);
    P.words = mix(A.words, B.words, k);
    P.flipW = A.twi ? Math.abs(k - 0.5) * 3 : 1;        // (how far from the twilight the words' flip is)
    var la = A.light === 'disc' ? discDir(A.disc) : dirOf(A.light.az, A.light.el),
        lb = B.light === 'disc' ? discDir(B.disc) : dirOf(B.light.az, B.light.el);
    P.light = norm3(lerp3(la, lb, k));
    P.discA = A.disc ? discOf(A.disc, smooth(1 - 2 * k)) : null;
    P.discB = B.disc ? discOf(B.disc, smooth(2 * k - 1)) : null;
    return P;
  }
  function discOf(D, w) { return { d: discDir(D), r: D.r, i: D.i * w, halo: D.halo, haloI: D.haloI * w, wide: D.wide * w, c: linOf(D.L) }; }
  function lerp3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function lerpN(a, b, k) { var o = [], i; for (i = 0; i < a.length; i++) o.push(a[i] + (b[i] - a[i]) * k); return o; }
  function norm3(a) { var n = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / n, a[1] / n, a[2] / n]; }

  /* ---------------- the wind ---------------- */

  var wind = [0, 0], windDir = (rWind() < 0.65 ? 1 : -1), windPx = mix(SEA_DRIFT[0], SEA_DRIFT[1], rWind()), windSlant = (rWind() * 2 - 1) * 0.25;
  /* in the air's units a second: the sea's nearest tops drift windPx on the window */
  function aimWind() {
    var zNear = 1 / Math.tan(Math.max(1 * DEG, Math.atan((H - cam.hy) / cam.f)));
    var v = windPx * zNear / cam.f;
    wind[0] = windDir * v * Math.cos(windSlant); wind[1] = v * Math.sin(windSlant);
  }

  /* ---------------- the towers: cumulus rising out of the sea ---------------- */

  var towers = [];
  for (var ti = 0; ti < TOWERS; ti++) towers.push({ k: ti, on: false, p: 0, x: 0, z: 0, R: 1, ht: 1, s: [], off: 0, box: [0, 0, 0, 0] });
  function towerBox(T, p) {
    var o = [0, 0, 0], yTop = -1 + T.ht * (0.25 + 0.75 * p) + 0.3 * T.R, a, b, c;
    a = toWindow(norm3([T.x - T.R * 1.75, yTop, T.z]), [0, 0, 0]);
    b = toWindow(norm3([T.x + T.R * 1.75, yTop, T.z]), [0, 0, 0]);
    c = toWindow(norm3([T.x, -1, T.z - T.R]), o);
    return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), c[1]];
  }
  function hitsWords(b) {
    var m = 36;
    if (stackR && b[2] > stackR[0] - m && b[0] < stackR[2] + m && b[3] > stackR[1] - m && b[1] < stackR[3] + m) return true;
    return false;
  }
  function spawn(T) {
    var i, sx, z, x, room, ht, R, d, box, j, ok;
    for (i = 0; i < 16; i++) {
      sx = W * (0.04 + 0.92 * rTower()); z = mix(11, 56, Math.pow(rTower(), 0.8));
      x = (sx - cam.x0) * z * cam.c / cam.f;
      R = 1;
      /* its room: up to the words' foot where it would stand under them, else to near the top */
      room = stackR && sx > stackR[0] - 60 - W * 0.06 && sx < stackR[2] + 60 + W * 0.06 ? stackR[3] + 34 : H * mix(0.1, 0.35, rTower());
      if (room > cam.hy - 12) continue;
      d = fromWindow(sx, room);
      ht = (d[1] / Math.max(d[2], 1e-3) * z + 1) * mix(0.8, 1, rTower());
      if (ht < 0.6) continue;
      ht = Math.min(ht, 9);
      R = clamp(ht * mix(0.42, 0.85, rTower()), 0.45, 5.5);   // (from a towering congestus to a broad mound)
      T.x = x; T.z = z; T.R = R; T.ht = ht;
      box = towerBox(T, 1);
      if (hitsWords(box)) continue;
      ok = true;
      for (j = 0; j < towers.length; j++) {
        var U = towers[j];
        if (U === T || !U.on) continue;
        if (box[2] > U.box[0] - 20 && box[0] < U.box[2] + 20 && Math.abs(U.z - z) < 12) { ok = false; break; }
      }
      if (!ok) continue;
      puffs(T);
      T.on = true; T.p = 0; T.off = rTower() * 40; T.box = box;
      return true;
    }
    return false;
  }
  /* a tower's puffs: a cumulus. A core (two broad spheres, the dome's
     bulk) and ten rounded lobes on the dome's envelope (an upper
     half-ellipsoid as wide as the tower and as tall), more of them high
     up and toward the window, each its own size: a cauliflower crown */
  function puffs(T) {
    var R = T.R, ht = T.ht, a = R * 1.25, b = ht, s = [], i, th, ph, r, k;
    s.push([-0.3 * R, 0.45 * Math.min(b, a), 0, 0.92 * Math.min(R, b * 0.6)]);
    s.push([0.35 * R, 0.35 * Math.min(b, a) + 0.2 * b, mix(-0.2, 0.2, rTower()) * R, 0.85 * Math.min(R, b * 0.55)]);
    s.push([mix(-0.2, 0.2, rTower()) * R, 0.72 * b, 0, 0.62 * Math.min(R, b * 0.5)]);
    for (i = 0; i < 9; i++) {
      k = (i + rTower()) / 9;
      th = Math.acos(1 - k * 0.95) * 0.95;                // from the top down the sides, more near the top
      ph = (i * 2.39996 + rTower()) % (2 * Math.PI);      // around (golden angle), spread
      if (Math.sin(ph) < -0.3) ph = -ph;                  // (lobes mostly on the window's side)
      r = R * mix(0.38, 0.62, rTower()) * (1 - 0.25 * Math.cos(th));
      s.push([a * 0.82 * Math.sin(th) * Math.cos(ph), Math.max(r * 0.6, b * 0.86 * Math.cos(th) + 0.15 * R), a * 0.6 * Math.sin(th) * Math.sin(ph), r]);
    }
    T.s = s;
  }
  function tendTowers(dt, P, still) {
    var i, T, want, b;
    for (i = 0; i < towers.length; i++) {
      T = towers[i];
      want = clamp(P.towers * TOWERS - i, 0, 1);
      if (!T.on) {
        if (want > 0.05 && (still || (T.wait || 0) <= 0)) { if (spawn(T) && still) T.p = want; }
        T.wait = (T.wait || 0) - dt;
        continue;
      }
      T.x += wind[0] * dt; T.z += wind[1] * dt;
      b = towerBox(T, T.p);
      T.box = b;
      if (b[2] < -40 || b[0] > W + 40 || T.z < 8) { T.on = false; T.p = 0; T.wait = 0; continue; }   // gone beyond the edge: free
      if (hitsWords(b)) want = 0;
      if (still) T.p = want;
      else T.p = clamp(T.p + clamp(want - T.p, -1, 1) * dt / BUILD * (want > T.p ? 1 : 1.6), 0, 1);
      if (T.p <= 0 && want === 0) { T.on = false; T.wait = 20 + 40 * rTower(); }
    }
  }

  /* ---------------- GL ---------------- */

  var gl = null, ext = {}, progs = {}, vao = null, tex = {}, fb = {}, ready = false, lost = false;
  var cw = 0, ch = 0, scale = SCALE, period = PERIOD;
  var HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler3D;\n';
  var VERT = '#version 300 es\nvoid main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }';
  var HASH = [
    'uvec3 pcg3(uvec3 v) {',
    '  v = v * 1664525u + 1013904223u;',
    '  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;',
    '  v ^= v >> 16u;',
    '  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;',
    '  return v;',
    '}',
    'vec3 rnd3(vec3 c, uint s) { return vec3(pcg3(uvec3(ivec3(c)) + uvec3(s, s * 7u, s * 13u))) * (1.0 / 4294967295.0); }',
    'float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }'
  ].join('\n');

  /* the 3D noise (64 cubed, tiling): billows (Worley, three octaves), finer billows, smooth noise, fine Worley */
  var BAKE3 = HEAD + HASH + [
    'uniform float uZ; uniform uint uSeed; out vec4 o;',
    'float worley(vec3 p, float per) {',
    '  vec3 i = floor(p), f = fract(p); float d = 9.0;',
    '  for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {',
    '    vec3 g = vec3(float(x), float(y), float(z));',
    '    vec3 r = g + rnd3(mod(i + g, per), uSeed) - f;',
    '    d = min(d, dot(r, r));',
    '  }',
    '  return sqrt(d);',
    '}',
    'float vn(vec3 p, float per) {',
    '  vec3 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);',
    '  float a = rnd3(mod(i, per), uSeed + 5u).x, b = rnd3(mod(i + vec3(1, 0, 0), per), uSeed + 5u).x,',
    '        c = rnd3(mod(i + vec3(0, 1, 0), per), uSeed + 5u).x, d = rnd3(mod(i + vec3(1, 1, 0), per), uSeed + 5u).x,',
    '        e = rnd3(mod(i + vec3(0, 0, 1), per), uSeed + 5u).x, g = rnd3(mod(i + vec3(1, 0, 1), per), uSeed + 5u).x,',
    '        h = rnd3(mod(i + vec3(0, 1, 1), per), uSeed + 5u).x, k = rnd3(mod(i + vec3(1, 1, 1), per), uSeed + 5u).x;',
    '  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, g, u.x), mix(h, k, u.x), u.y), u.z);',
    '}',
    'void main() {',
    '  vec3 q = vec3(gl_FragCoord.xy / 64.0, uZ);',
    '  float w1 = worley(q * 4.0, 4.0), w2 = worley(q * 8.0, 8.0), w3 = worley(q * 16.0, 16.0);',
    '  float v = vn(q * 4.0, 4.0) * 0.5 + vn(q * 8.0, 8.0) * 0.3 + vn(q * 16.0, 16.0) * 0.2;',
    '  float b1 = 1.0 - (w1 * 0.625 + w2 * 0.25 + w3 * 0.125);',
    '  float b2 = 1.0 - (w2 * 0.7 + w3 * 0.3);',
    '  o = vec4(clamp(mix(b1, v, 0.25) * 1.25 - 0.15, 0.0, 1.0), clamp(b2 * 1.2 - 0.1, 0.0, 1.0), v, clamp(1.0 - w3, 0.0, 1.0));',
    '}'
  ].join('\n');

  /* the 2D noise (256 square, tiling): domes (a union of round caps, smoothly joined), small domes, smooth noise, fine noise */
  var BAKE2 = HEAD + HASH + [
    'uniform uint uSeed; out vec4 o;',
    'float domes(vec2 p, float per, float r0, float r1, uint s) {',
    '  vec2 i = floor(p), f = fract(p); float acc = 0.0, k = 0.09;',
    '  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {',
    '    vec2 g = vec2(float(x), float(y));',
    '    vec3 h = rnd3(vec3(mod(i + g, per), 0.0), s);',
    '    vec2 r = g + h.xy - f;',
    '    float rad = mix(r0, r1, h.z), d2 = dot(r, r);',
    '    if (d2 < rad * rad) acc += exp((sqrt(rad * rad - d2) / r1 - 1.0) / k);',
    '  }',
    '  return acc > 0.0 ? clamp(1.0 + k * log(acc), 0.0, 1.0) : 0.0;',
    '}',
    'float vn(vec2 p, float per, uint s) {',
    '  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);',
    '  float a = rnd3(vec3(mod(i, per), 1.0), s).x, b = rnd3(vec3(mod(i + vec2(1, 0), per), 1.0), s).x,',
    '        c = rnd3(vec3(mod(i + vec2(0, 1), per), 1.0), s).x, d = rnd3(vec3(mod(i + vec2(1, 1), per), 1.0), s).x;',
    '  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);',
    '}',
    'void main() {',
    '  vec2 p = gl_FragCoord.xy / 256.0;',
    '  float a = domes(p * 8.0, 8.0, 0.62, 1.0, uSeed);',
    '  float b = domes(p * 24.0, 24.0, 0.55, 0.95, uSeed + 1u);',
    '  float c = vn(p * 4.0, 4.0, uSeed + 2u) * 0.55 + vn(p * 8.0, 8.0, uSeed + 2u) * 0.3 + vn(p * 16.0, 16.0, uSeed + 2u) * 0.15;',
    '  float d = vn(p * 8.0, 8.0, uSeed + 3u) * 0.45 + vn(p * 16.0, 16.0, uSeed + 3u) * 0.3 + vn(p * 32.0, 32.0, uSeed + 3u) * 0.15 + vn(p * 64.0, 64.0, uSeed + 3u) * 0.1;',
    '  o = vec4(a, b, c, d);',
    '}'
  ].join('\n');

  /* the scene: sky, deck, towers and sea, per pixel, in the air's light (linear) */
  var SCENE = [
    'uniform sampler3D uN3; uniform sampler2D uN2;',
    'uniform vec4 uVp; uniform vec4 uCam; uniform vec2 uC0; uniform float uT; uniform vec2 uWind; uniform float uPx;',
    'uniform vec3 uL; uniform vec3 uLC; uniform vec3 uSk[5]; uniform vec3 uTint; uniform vec4 uTintP;',
    'uniform vec4 uDa; uniform vec4 uDaP; uniform vec3 uDaC; uniform vec4 uDb; uniform vec4 uDbP; uniform vec3 uDbC;',
    'uniform vec3 uAmbU; uniform vec3 uAmbD; uniform vec3 uAlb;',
    'uniform vec4 uSea; uniform vec4 uFog; uniform vec3 uFogC; uniform vec4 uDeck; uniform vec3 uDeckC;',
    'uniform int uTwN; uniform vec4 uTw[72]; uniform vec4 uTb[6]; uniform vec4 uTx[6];',
    'out vec4 oC;',
    'const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);',
    /* the sky's light */
    'vec3 grad(float e) {',
    '  e = max(e, 0.0);',
    '  vec3 c = mix(uSk[0], uSk[1], smoothstep(0.0, 5.0, e));',
    '  c = mix(c, uSk[2], smoothstep(5.0, 15.0, e));',
    '  c = mix(c, uSk[3], smoothstep(15.0, 32.0, e));',
    '  return mix(c, uSk[4], smoothstep(32.0, 60.0, e));',
    '}',
    'vec3 halo(vec3 rd, vec4 D, vec4 P, vec3 C) {',
    '  float cg = max(dot(rd, D.xyz), 0.0);',
    '  return C * (P.z * pow(cg, P.y) + P.w * pow(cg, P.y * 0.06));',
    '}',
    'vec3 disc(vec3 rd, vec4 D, vec4 P, vec3 C) {',
    '  float cg = dot(rd, D.xyz), r = 1.0 - D.w;',
    '  float limb = clamp((cg - D.w) / r, 0.0, 1.0);',
    '  return C * P.x * smoothstep(D.w - r * 0.3, D.w + r * 0.15, cg) * (0.75 + 0.25 * sqrt(limb));',
    '}',
    'vec3 sky(vec3 rd) {',
    '  float e = degrees(asin(clamp(rd.y, -1.0, 1.0)));',
    '  vec3 c = grad(e);',
    '  float cg = dot(rd, uL), low = 1.0 - smoothstep(0.0, 40.0, max(e, 0.0));',
    '  c = mix(c, uTint, clamp(uTintP.x * pow(0.5 + 0.5 * cg, uTintP.y) * (0.3 + 0.7 * low), 0.0, 1.0));',
    '  c *= 1.0 - uTintP.z * max(-cg, 0.0) * (1.0 - 0.5 * low);',
    '  c = mix(c, uFogC, 0.5 * (1.0 - smoothstep(0.0, 5.0, max(e, 0.0))));',
    '  return c + halo(rd, uDa, uDaP, uDaC) + halo(rd, uDb, uDbP, uDbC);',
    '}',
    'vec3 haze(vec3 rd) { return sky(normalize(vec3(rd.x, 0.0, rd.z))); }',
    'float fogOf(float t) { return 1.0 - exp(-t * uFog.x); }',
    'float mistOf(float y, float t) { return uFog.y * exp(-max(y + uSea.x - uSea.y * 0.55, 0.0) / uFog.z) * smoothstep(4.0, 24.0, t); }',
    /* the sea of cloud */
    'float seaH(vec2 xz, float lod, float t) {',
    '  vec2 q = xz + uWind * uT;',
    '  float a = textureLod(uN2, q * 0.05, lod).r;',
    '  float fine = 1.0 - smoothstep(10.0, 28.0, t);',
    '  float b = fine > 0.0 ? textureLod(uN2, q * 0.17 + vec2(0.31, 0.67), lod + 1.4).g : 0.5;',
    '  float m = textureLod(uN2, q * 0.011 + vec2(0.71, 0.13), 0.0).b;',
    '  return -uSea.x + uSea.y * (0.84 * a + 0.16 * mix(0.5, b, fine)) * mix(1.0 - uSea.w, 1.0, smoothstep(0.25, 0.75, m));',
    '}',
    'vec3 seaShade(vec3 p, float h, vec3 rd, float t, float den, float lod, vec3 hz) {',
    '  float e = 0.03 + t * uPx * 3.0;',
    '  vec3 n = normalize(vec3(h - seaH(p.xz + vec2(e, 0.0), lod, t), e, h - seaH(p.xz + vec2(0.0, e), lod, t)));',
    '  float hf = clamp((h + uSea.x) / max(uSea.y, 1e-3), 0.0, 1.0);',
    '  float wrap = clamp((dot(n, uL) + 0.5) / 1.5, 0.0, 1.0);',
    '  float lh = max(length(uL.xz), 1e-3); vec2 ld = uL.xz / lh; float tl = uL.y / lh;',
    '  float sh = 1.0;',
    '  for (int i = 1; i <= 2; i++) {',
    '    float s = float(i) * (0.35 + t * 0.008);',
    '    float hq = seaH(p.xz + ld * s, lod + 0.5, t);',
    '    sh *= clamp(1.0 - (hq - (h + s * tl)) * 2.2 / max(uSea.y, 1e-3), 0.3, 1.0);',
    '  }',
    '  vec3 amb = mix(uAmbD, uAmbU, 0.5 + 0.5 * n.y) * mix(0.42, 1.0, hf * hf);',
    '  float fwd = pow(max(dot(rd, uL), 0.0), 6.0);',
    '  vec3 c = uAlb * (uLC * wrap * sh + amb) + uLC * fwd * (1.0 - den * 0.8) * (0.3 + 0.7 * sh) * (0.4 + 0.6 * hf) * 1.3;',
    '  return mix(c, hz, clamp(fogOf(t) + mistOf(p.y, t) * 0.5, 0.0, 1.0));',
    '}',
    'void sea(vec3 rd, vec3 hz, float jit, out vec3 acc, out float T, out float tHit) {',
    '  acc = vec3(0.0); T = 1.0; tHit = 1e6;',
    '  if (rd.y > -0.0004) return;',
    '  float t = (-uSea.x + uSea.y * 1.02) / rd.y;',
    '  t *= 1.0 + jit * 0.02;',
    '  for (int i = 0; i < 64; i++) {',
    '    if (T < 0.015 || t > 600.0) break;',
    '    vec3 p = rd * t;',
    '    float lod = log2(max(t * uPx * 0.05 * 256.0 * 1.5, 1.0));',
    '    float h = seaH(p.xz, lod, t);',
    '    float sf = uSea.z * (1.0 + t * 0.04) + t * uPx * 1.5;',
    '    float d = p.y - h;',
    '    if (d > sf) { t += clamp((d - 0.5 * sf) / -rd.y * 0.6, 0.015 + t * 0.006, 0.25 + t * 0.08); continue; }',
    '    float den = clamp(0.5 - d / (2.0 * sf), 0.0, 1.0);',
    '    float dt = clamp(sf * 0.4 / -rd.y, 0.01, 0.08 + t * 0.03);',
    '    float a = 1.0 - exp(-den * dt * 4.0 / sf);',
    '    if (T > 0.5 && T * (1.0 - a) <= 0.5) tHit = t;',
    '    acc += T * a * seaShade(p, h, rd, t, den, lod, hz);',
    '    T *= 1.0 - a;',
    '    t += dt;',
    '  }',
    '  if (tHit > 1e5) tHit = t;',
    '  acc += T * hz; T = 0.0;',
    '}',
    /* the towers */
    'float smin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }',
    'float tSdf(vec3 p, int k) {',
    '  float d = 1e5;',
    '  for (int i = 0; i < 12; i++) { vec4 s = uTw[k * 12 + i]; if (s.w > 0.0) d = smin(d, length(p - s.xyz) - s.w, s.w * 0.38); }',
    '  return d;',
    '}',
    'float tSdfN(vec3 p, int k, float lod) {',
    '  float R = uTx[k].x, d = tSdf(p, k);',
    '  if (d > R * 0.45) return d;',
    '  vec3 q = p / R * 0.42 + vec3(uTx[k].w, -uT * 0.003, uTx[k].w * 1.7);',
    '  float n = textureLod(uN3, q, lod).r * 0.75 + textureLod(uN3, q * 2.3, lod + 1.5).g * 0.25;',
    '  return d + (0.5 - n) * R * 0.22;',
    '}',
    'vec3 tShade(vec3 p, vec3 rd, int k, float d, float sf, float t, float lod, vec3 hz) {',
    '  float R = uTx[k].x, e = sf * 0.7 + R * 0.025;',
    '  vec2 g = vec2(1.0, -1.0);',
    '  vec3 n = normalize(g.xyy * tSdfN(p + g.xyy * e, k, lod) + g.yyx * tSdfN(p + g.yyx * e, k, lod) + g.yxy * tSdfN(p + g.yxy * e, k, lod) + g.xxx * tSdfN(p + g.xxx * e, k, lod));',
    '  float wrap = clamp((dot(n, uL) + 0.45) / 1.45, 0.0, 1.0);',
    '  float s1 = tSdfN(p + uL * R * 0.3, k, lod + 1.0), s2 = tSdfN(p + uL * R * 0.85, k, lod + 1.5);',
    '  float sh = mix(0.22, 1.0, clamp(0.5 + s1 / (R * 0.3), 0.0, 1.0) * clamp(0.6 + s2 / (R * 0.85), 0.0, 1.0));',
    '  float hgt = clamp((p.y - uTx[k].y) / max(uTx[k].z - uTx[k].y, 1e-3), 0.0, 1.0);',
    '  vec3 amb = mix(uAmbD, uAmbU, 0.5 + 0.5 * n.y) * mix(0.48, 1.0, hgt);',
    '  float fwd = pow(max(dot(rd, uL), 0.0), 7.0), thin = clamp(0.5 + d / (2.0 * sf), 0.0, 1.0);',
    '  vec3 c = uAlb * (uLC * wrap * sh + amb) + uLC * fwd * (0.35 + thin) * 1.5 * sh;',
    '  return mix(c, hz, clamp(fogOf(t) + mistOf(p.y, t), 0.0, 1.0));',
    '}',
    'void tower(int k, vec3 rd, float tMax, vec3 hz, float jit, inout vec3 acc, inout float T) {',
    '  vec4 b = uTb[k];',
    '  float bb = dot(b.xyz, rd), c = dot(b.xyz, b.xyz) - b.w * b.w, q = bb * bb - c;',
    '  if (q <= 0.0) return;',
    '  q = sqrt(q);',
    '  float t1 = min(bb + q, tMax), t = max(bb - q, 0.0);',
    '  if (t >= t1) return;',
    '  float R = uTx[k].x;',
    '  t += jit * R * 0.05;',
    '  for (int i = 0; i < 56; i++) {',
    '    if (t > t1 || T < 0.015) break;',
    '    vec3 p = rd * t;',
    '    float lod = log2(max(t * uPx * 0.45 / R * 64.0, 1.0));',
    '    float sf = R * 0.05 + t * uPx * 1.5;',
    '    float d = tSdfN(p, k, lod) + max(0.0, uTx[k].y + R * 0.35 - p.y) * 0.6;',
    '    if (d > sf) { t += max(d - 0.5 * sf, R * 0.02); continue; }',
    '    float den = clamp(0.5 - d / (2.0 * sf), 0.0, 1.0), dt = sf * 0.6;',
    '    float a = 1.0 - exp(-den * dt * 4.5 / sf);',
    '    acc += T * a * tShade(p, rd, k, d, sf, t, lod, hz);',
    '    T *= 1.0 - a;',
    '    t += dt;',
    '  }',
    '}',
    /* the high deck: streaks, or an overcast */
    'vec4 deck(vec3 rd, vec3 bg) {',
    '  if (rd.y < 0.002 || uDeck.z <= 0.0) return vec4(0.0);',
    '  float t = uDeck.x / rd.y;',
    '  vec2 q = rd.xz * t + uWind * uT * 1.8;',
    '  float lod = log2(max(t * uPx / max(rd.y, 0.05) * 0.05 * 256.0, 1.0));',
    '  float a = textureLod(uN2, q * vec2(0.024, 0.06), lod).a, b = textureLod(uN2, q * vec2(0.075, 0.13) + 0.37, lod + 1.0).b;',
    '  float n = a * 0.72 + b * 0.28;',
    '  float cov = smoothstep(1.0 - uDeck.y, 1.0 - uDeck.y + 0.3, n);',
    '  float fwd = pow(max(dot(rd, uL), 0.0), 5.0);',
    '  vec3 c = uDeckC * (1.0 - uDeck.w * cov) + uLC * fwd * (1.0 - cov * 0.6) * 0.6;',
    '  c = mix(c, bg, 1.0 - exp(-t * uFog.x * 0.6));',
    '  return vec4(c, cov * uDeck.z);',
    '}',
    'void main() {',
    '  vec2 fc = gl_FragCoord.xy / uVp.xy;',
    '  vec2 s = vec2(fc.x * uVp.z, (1.0 - fc.y) * uVp.w);',
    '  vec3 dc = vec3(s.x - uC0.x, uC0.y - s.y, uCam.x);',
    '  vec3 rd = normalize(vec3(dc.x, dc.y * uCam.y + dc.z * uCam.z, dc.z * uCam.y - dc.y * uCam.z));',
    '  float jit = ign(gl_FragCoord.xy);',
    '  vec3 hz = haze(rd);',
    '  vec3 sAcc; float sT, tSea;',
    '  sea(rd, hz, jit, sAcc, sT, tSea);',
    '  vec3 acc = vec3(0.0); float T = 1.0;',
    '  for (int k = 0; k < 6; k++) { if (k >= uTwN) break; tower(k, rd, tSea, hz, jit, acc, T); }',
    '  vec3 sk = sky(rd), bg = sk + disc(rd, uDa, uDaP, uDaC) + disc(rd, uDb, uDbP, uDbC);',
    '  vec4 dk = deck(rd, sk);',
    '  bg = mix(bg, dk.rgb, dk.a);',
    '  vec3 col = acc + T * (sAcc + sT * bg);',
    '  oC = vec4(ENC(col), T * sT * (1.0 - dk.a));',
    '}'
  ].join('\n');

  /* light shafts: from the sky seen near the sun, toward it (half size) */
  var SHAFT = [
    'uniform sampler2D uS; uniform vec2 uRes; uniform vec2 uSun; uniform vec4 uSh; out vec4 o;',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / uRes, d = uSun - uv;',
    '  float L = length(d * vec2(uSh.z, 1.0));',
    '  vec2 st = d / 24.0 * min(1.0, uSh.x * 2.5 / max(L, 1e-4));',
    '  vec2 p = uv + st * ign(gl_FragCoord.xy);',
    '  float w = 1.0, acc = 0.0;',
    '  for (int i = 0; i < 24; i++) {',
    '    float near = 1.0 - smoothstep(0.0, uSh.x, length((p - uSun) * vec2(uSh.z, 1.0)));',
    '    acc += textureLod(uS, p, 0.0).a * near * w;',
    '    w *= uSh.y; p += st;',
    '  }',
    '  o = vec4(acc / 24.0);',
    '}'
  ].join('\n');
  /* the glow: down, by halves, the bright part only on the first (dual filter) */
  var DOWN = [
    'uniform sampler2D uS; uniform vec2 uRes; uniform vec2 uHalf; uniform float uThr; out vec4 o;',
    'vec3 tap(vec2 uv) { return max(DEC(textureLod(uS, uv, 0.0).rgb) - uThr, 0.0); }',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec3 s = tap(uv) * 4.0 + tap(uv - uHalf) + tap(uv + uHalf) + tap(uv + vec2(uHalf.x, -uHalf.y)) + tap(uv - vec2(uHalf.x, -uHalf.y));',
    '  o = vec4(ENC(s / 8.0), 1.0);',
    '}'
  ].join('\n');
  var UP = [
    'uniform sampler2D uS; uniform sampler2D uAdd; uniform vec2 uRes; uniform vec2 uHalf; out vec4 o;',
    'vec3 tap(vec2 uv) { return DEC(textureLod(uS, uv, 0.0).rgb); }',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / uRes, h = uHalf;',
    '  vec3 s = tap(uv + vec2(-2.0 * h.x, 0.0)) + tap(uv + vec2(2.0 * h.x, 0.0)) + tap(uv + vec2(0.0, 2.0 * h.y)) + tap(uv + vec2(0.0, -2.0 * h.y))',
    '         + 2.0 * (tap(uv + h) + tap(uv - h) + tap(uv + vec2(h.x, -h.y)) + tap(uv + vec2(-h.x, h.y)));',
    '  o = vec4(ENC(s / 12.0 + DEC(textureLod(uAdd, uv, 0.0).rgb)), 1.0);',
    '}'
  ].join('\n');
  /* the cloud frame, finished: shafts and glow added, the highlights' shoulder (into an sRGB texture) */
  var FINISH = [
    'uniform sampler2D uS; uniform sampler2D uSh; uniform sampler2D uBl; uniform vec2 uRes; uniform vec3 uShC; uniform vec4 uPost; out vec4 o;',
    'vec3 shoulder(vec3 x) { return mix(x, 0.8 + 0.2 * (1.0 - exp(-(x - 0.8) / 0.2)), step(0.8, x)); }',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec4 s = textureLod(uS, uv, 0.0);',
    '  vec3 c = DEC(s.rgb) + uShC * textureLod(uSh, uv, 0.0).r * uPost.x + DEC(textureLod(uBl, uv, 0.0).rgb) * uPost.y;',
    '  c = shoulder(max(c * uPost.z, 0.0));',
    '  float Y = dot(c, vec3(0.2126, 0.7152, 0.0722));',
    '  o = vec4(clamp(mix(vec3(Y), c, uPost.w), 0.0, 1.0), s.a);',
    '}'
  ].join('\n');
  /* what was drawn where the words stand (and the window's top edge): 8 numbers */
  var STATS = [
    'uniform sampler2D uF; uniform vec4 uRs; out vec4 o;',
    'void main() {',
    '  int i = int(gl_FragCoord.x);',
    '  if (i == 3 || i == 6) {',
    '    vec3 c = vec3(0.0); float y0 = i == 3 ? 0.995 : 0.005;',
    '    for (int x = 0; x < 16; x++) c += textureLod(uF, vec2((float(x) + 0.5) / 16.0, y0), 0.0).rgb;',
    '    c /= 16.0;',
    '    o = vec4(pow(c, vec3(1.0 / 2.2)), 1.0); return;',
    '  }',
    '  vec4 r = uRs;',
    '  float mn = 1.0, mx = 0.0, sm = 0.0, sq = 0.0;',
    '  for (int y = 0; y < 12; y++) for (int x = 0; x < 16; x++) {',
    '    vec2 uv = mix(r.xy, r.zw, (vec2(float(x), float(y)) + 0.5) / vec2(16.0, 12.0));',
    '    float Y = dot(textureLod(uF, uv, 0.0).rgb, vec3(0.2126, 0.7152, 0.0722));',
    '    mn = min(mn, Y); mx = max(mx, Y); sm += Y;',
    '  }',
    '  sm /= 192.0;',
    '  if (i == 4) for (int y = 0; y < 12; y++) for (int x = 0; x < 16; x++) {',
    '    vec2 uv = mix(r.xy, r.zw, (vec2(float(x), float(y)) + 0.5) / vec2(16.0, 12.0));',
    '    float Y = dot(textureLod(uF, uv, 0.0).rgb, vec3(0.2126, 0.7152, 0.0722)) - sm;',
    '    sq += Y * Y;',
    '  }',
    '  float v = i == 0 ? mn : (i == 1 ? mx : (i == 2 ? sm : sqrt(sq / 192.0)));',
    '  o = vec4(sqrt(v), 0.0, 0.0, 1.0);',
    '}'
  ].join('\n');
  /* the window: two cloud frames crossfaded, the stars, the rain, the veil about the words */
  var SHOW = HASH + [
    'uniform sampler2D uA; uniform sampler2D uB; uniform float uK; uniform vec4 uVp;',
    'uniform vec4 uR[4]; uniform vec2 uFe; uniform vec2 uBand; uniform vec2 uBandT;',
    'uniform vec4 uSt; uniform vec4 uRn; uniform vec3 uRnC; out vec4 o;',
    'float box(vec2 p, vec4 r, float fe) { if (r.z <= r.x) return 0.0; vec2 d = max(vec2(r.x - p.x, r.y - p.y), vec2(p.x - r.z, p.y - r.w)); float q = length(max(d, 0.0)) / fe; return exp(-4.5 * q * q); }',
    'vec3 h32(vec2 c, float s) { return rnd3(vec3(mod(c, 4096.0) + 4096.0, s), 17u); }',
    'float stars(vec2 p) {',
    '  vec2 c = floor(p / 23.0);',
    '  vec3 h = h32(c, uSt.y);',
    '  if (h.x > 0.45) return 0.0;',
    '  vec2 sp = (c + 0.15 + 0.7 * h.yz) * 23.0;',
    '  float b = pow(fract(h.x * 7.31 + h.y * 3.17), 6.0) * 0.95 + 0.07;',
    '  float r = mix(0.45, 1.0, b) * uSt.w, d = length(p - sp);',
    '  return b * exp(-d * d / (r * r));',
    '}',
    'float rain(vec2 p, float layer) {',
    '  float sl = uRn.z, cs = cos(sl), sn = sin(sl);',
    '  vec2 q = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);',
    '  float w = mix(9.0, 13.0, layer), col = floor(q.x / w);',
    '  vec3 h = h32(vec2(col, 37.0 + layer * 41.0), 911.0);',
    '  if (h.x > mix(0.32, 0.5, layer)) return 0.0;',
    '  float per = mix(380.0, 640.0, h.y), speed = mix(780.0, 1150.0, layer) * mix(0.85, 1.15, h.z);',
    '  float rel = mod(uRn.y / 12.0 * speed + h.y * per * 3.0 - q.y, per), len = mix(16.0, 30.0, layer);',
    '  float along = rel < len ? 1.0 - rel / len : 0.0;',
    '  float x = q.x - (col + 0.5 + (h.z - 0.5) * 0.5) * w;',
    '  return along * exp(-x * x / mix(0.22, 0.4, layer)) * mix(0.55, 1.0, layer);',
    '}',
    'void main() {',
    '  vec2 fc = gl_FragCoord.xy / uVp.xy;',
    '  vec2 p = vec2(fc.x * uVp.z, (1.0 - fc.y) * uVp.w);',
    '  vec4 c = mix(texture(uA, fc), texture(uB, fc), uK);',
    '  vec3 col = c.rgb;',
    '  float m0 = box(p, uR[0], uFe.x), m1 = max(box(p, uR[1], uFe.x), max(box(p, uR[2], uFe.y), box(p, uR[3], uFe.y))), m = max(m0, m1);',
    '  if (uSt.x > 0.0) col += vec3(0.92, 0.94, 1.0) * stars(p) * uSt.x * c.a * smoothstep(uSt.z + 2.0, uSt.z - 70.0, p.y);',
    '  if (uRn.x > 0.0) { float r = rain(p, 0.0) * 0.6 + rain(p, 1.0); col = mix(col, uRnC, clamp(r * uRn.x * 0.32 * (1.0 - m), 0.0, 1.0)); }',
    '  float Y = dot(col, vec3(0.2126, 0.7152, 0.0722));',
    '  float lo = max(uBand.x * m0, uBandT.x * m1), hi = min(mix(1.0, uBand.y, m0), mix(1.0, uBandT.y, m1));',
    '  if (Y < lo) col *= lo / max(Y, 1e-4);',
    '  else if (Y > hi) col *= hi / Y;',
    '  col = clamp(col, 0.0, 1.0);',
    '  vec3 e = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));',
    '  float n = ign(gl_FragCoord.xy) + ign(gl_FragCoord.xy + vec2(17.0, 59.0)) - 1.0;',
    '  o = vec4(e + n / 255.0, 1.0);',
    '}'
  ].join('\n');

  function setup() {
    gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    if (!gl) return false;
    ext.float = !!gl.getExtension('EXT_color_buffer_float');
    FORMATS = { rgba8: [gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE], rgba16f: [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT], srgb: [gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE] };
    ext.par = gl.getExtension('KHR_parallel_shader_compile');
    var info = gl.getExtension('WEBGL_debug_renderer_info'), who = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(who)) { frozen = true; scale = SCALE_MIN; }   // (drawn on the CPU: the still sky, drawn once)
    var codec = ext.float ? '#define ENC(c) (c)\n#define DEC(c) (c)\n'
                          : '#define ENC(c) sqrt(clamp((c) / (1.0 + (c)), 0.0, 1.0))\n#define DEC(c) ((c) * (c) / max(1.0 - (c) * (c), 1e-4))\n';
    var vs = compile(gl.VERTEX_SHADER, VERT);
    progs.bake3 = link(vs, BAKE3);
    progs.bake2 = link(vs, BAKE2);
    progs.scene = link(vs, HEAD + codec + HASH + '\n' + SCENE);
    progs.shaft = link(vs, HEAD + codec + HASH + '\n' + SHAFT);
    progs.down = link(vs, HEAD + codec + DOWN);
    progs.up = link(vs, HEAD + codec + UP);
    progs.finish = link(vs, HEAD + codec + FINISH);
    progs.stats = link(vs, HEAD + STATS);
    progs.show = link(vs, HEAD + SHOW);
    vao = gl.createVertexArray();
    return true;
  }
  function compile(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  function link(vs, fsrc) {
    var p = gl.createProgram(), fs = compile(gl.FRAGMENT_SHADER, fsrc);
    gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
    p.fs = fs; p.u = {};
    return p;
  }
  /* every program linked? (without waiting, where the browser can say so) */
  function linked() {
    var k, p;
    for (k in progs) {
      p = progs[k];
      if (ext.par && !gl.getProgramParameter(p, ext.par.COMPLETION_STATUS_KHR)) return 0;
    }
    for (k in progs) {
      p = progs[k];
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        if (window.console) console.error('sky: ' + k + ': ' + (gl.getShaderInfoLog(p.fs) || gl.getProgramInfoLog(p)));
        return -1;
      }
    }
    return 1;
  }
  function U(p, name) { if (!(name in p.u)) p.u[name] = gl.getUniformLocation(p, name); return p.u[name]; }
  function texture2(w, h, fmt, filter, wrap) {
    var t = gl.createTexture(), F = FORMATS[fmt];
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, F[0], w, h, 0, F[1], F[2], null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap || gl.CLAMP_TO_EDGE);
    t.w = w; t.h = h;
    return t;
  }
  var FORMATS = {};
  function target(t) {
    var f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    f.t = t;
    return f;
  }
  function draw(p, f, w, h) {
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function bind(p, unit, name, t, kind) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(kind || gl.TEXTURE_2D, t);
    gl.uniform1i(U(p, name), unit);
  }

  /* the noise, baked once on the GPU */
  function bakeNoise() {
    var p = progs.bake3, f = gl.createFramebuffer(), z;
    tex.n3 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, tex.n3);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 64, 64, 64, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.useProgram(p);
    gl.uniform1ui(U(p, 'uSeed'), noiseSeed);
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.viewport(0, 0, 64, 64);
    for (z = 0; z < 64; z++) {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, tex.n3, 0, z);
      gl.uniform1f(U(p, 'uZ'), (z + 0.5) / 64);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindTexture(gl.TEXTURE_3D, tex.n3);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_3D);
    tex.n2 = texture2(256, 256, 'rgba8', gl.LINEAR_MIPMAP_LINEAR, gl.REPEAT);
    f = target(tex.n2);
    p = progs.bake2;
    gl.useProgram(p);
    gl.uniform1ui(U(p, 'uSeed'), noiseSeed + 11);
    draw(p, f, 256, 256);
    gl.bindTexture(gl.TEXTURE_2D, tex.n2);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  /* the frames' textures, for this window */
  function buffers() {
    var w = Math.max(1, Math.round(W * scale)), h = Math.max(1, Math.round(H * scale)), k, dpr;
    if (w * h > PX_MAX) { k = Math.sqrt(PX_MAX / (w * h)); w = Math.round(w * k); h = Math.round(h * k); }
    dpr = Math.min(window.devicePixelRatio || 1, CANVAS_DPR);
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    if (w === cw && h === ch && tex.s) return;
    cw = w; ch = h;
    ['s', 'sh', 'b1', 'b2', 'b3', 'u2', 'u1', 'f0', 'f1', 'f2'].forEach(function (k) { if (tex[k]) gl.deleteTexture(tex[k]); if (fb[k]) gl.deleteFramebuffer(fb[k]); });
    var hdr = ext.float ? 'rgba16f' : 'rgba8';
    tex.s = texture2(cw, ch, hdr, gl.LINEAR); fb.s = target(tex.s);
    tex.sh = texture2(Math.ceil(cw / 2), Math.ceil(ch / 2), 'rgba8', gl.LINEAR); fb.sh = target(tex.sh);
    tex.b1 = texture2(Math.ceil(cw / 2), Math.ceil(ch / 2), hdr, gl.LINEAR); fb.b1 = target(tex.b1);
    tex.b2 = texture2(Math.ceil(cw / 4), Math.ceil(ch / 4), hdr, gl.LINEAR); fb.b2 = target(tex.b2);
    tex.b3 = texture2(Math.ceil(cw / 8), Math.ceil(ch / 8), hdr, gl.LINEAR); fb.b3 = target(tex.b3);
    tex.u2 = texture2(Math.ceil(cw / 4), Math.ceil(ch / 4), hdr, gl.LINEAR); fb.u2 = target(tex.u2);
    tex.u1 = texture2(Math.ceil(cw / 2), Math.ceil(ch / 2), hdr, gl.LINEAR); fb.u1 = target(tex.u1);
    for (k = 0; k < 3; k++) { tex['f' + k] = texture2(cw, ch, 'srgb', gl.LINEAR); fb['f' + k] = target(tex['f' + k]); }
    shown = [null, null]; job = null;
  }

  /* ---------------- a cloud frame: set up, drawn in slices, finished ---------------- */

  var t = 0, job = null, shown = [null, null], doneAt = -1, spare = 0, frames = 0;
  function startJob(fast) {
    var p = progs.scene, S = blend(t + (fast ? 0 : period)), i, k, n = 0, T, list = [], s, lift, R, j;
    gl.useProgram(p);
    gl.uniform4f(U(p, 'uVp'), cw, ch, W, H);
    gl.uniform4f(U(p, 'uCam'), cam.f, cam.c, cam.s, 0);
    gl.uniform2f(U(p, 'uC0'), cam.x0, cam.y0);
    gl.uniform1f(U(p, 'uT'), still ? 0 : t + (fast ? 0 : period));
    gl.uniform2f(U(p, 'uWind'), wind[0], wind[1]);
    gl.uniform1f(U(p, 'uPx'), (W / cw) / cam.f);
    gl.uniform3fv(U(p, 'uL'), S.light);
    gl.uniform3fv(U(p, 'uLC'), scale3(S.lightC, S.lightI));
    gl.uniform3fv(U(p, 'uSk'), flat(S.sky));
    gl.uniform3fv(U(p, 'uTint'), S.tint);
    gl.uniform4f(U(p, 'uTintP'), S.tintAmt, S.tintPow, S.deep, 0);
    discUniforms(p, 'uDa', S.discA); discUniforms(p, 'uDb', S.discB);
    gl.uniform3fv(U(p, 'uAmbU'), scale3(S.ambU, S.ambUI));
    gl.uniform3fv(U(p, 'uAmbD'), scale3(S.ambD, S.ambDI));
    gl.uniform3fv(U(p, 'uAlb'), S.alb);
    gl.uniform4fv(U(p, 'uSea'), S.sea);
    gl.uniform4f(U(p, 'uFog'), S.fog, S.mist, 0.35, 0);
    gl.uniform3fv(U(p, 'uFogC'), S.fogC);
    gl.uniform4fv(U(p, 'uDeck'), S.deck);
    gl.uniform3fv(U(p, 'uDeckC'), S.deckC);
    /* the towers standing now, nearest first, risen as far as they have */
    for (i = 0; i < towers.length; i++) if (towers[i].on && towers[i].p > 0.01) list.push(towers[i]);
    list.sort(function (a, b) { return a.z - b.z; });
    var tw = new Float32Array(72 * 4), tb = new Float32Array(24), tx = new Float32Array(24);
    for (i = 0; i < list.length && i < 6; i++) {
      T = list[i]; lift = T.ht * (1 - T.p) * 0.95; R = T.R * (0.55 + 0.45 * T.p);
      for (j = 0; j < 12; j++) {
        s = T.s[j];
        tw[(i * 12 + j) * 4] = T.x + s[0] * (0.6 + 0.4 * T.p); tw[(i * 12 + j) * 4 + 1] = -1 + s[1] - lift; tw[(i * 12 + j) * 4 + 2] = T.z + s[2];
        tw[(i * 12 + j) * 4 + 3] = s[3] * (0.55 + 0.45 * T.p);
      }
      tb[i * 4] = T.x; tb[i * 4 + 1] = -1 + T.ht * 0.5 - lift; tb[i * 4 + 2] = T.z; tb[i * 4 + 3] = Math.hypot(T.ht * 0.5 + 0.7 * T.R, T.R * 2.0);
      tx[i * 4] = R; tx[i * 4 + 1] = -1 - lift; tx[i * 4 + 2] = -1 + T.ht - lift; tx[i * 4 + 3] = T.off;
      n++;
    }
    gl.uniform1i(U(p, 'uTwN'), n);
    gl.uniform4fv(U(p, 'uTw'), tw); gl.uniform4fv(U(p, 'uTb'), tb); gl.uniform4fv(U(p, 'uTx'), tx);
    job = { row: 0, S: S, fast: !!fast };
  }
  function scale3(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function flat(a) { var o = [], i; for (i = 0; i < a.length; i++) o.push(a[i][0], a[i][1], a[i][2]); return o; }
  function discUniforms(p, n, D) {
    if (!D) { gl.uniform4f(U(p, n), 0, 1, 0, 2); gl.uniform4f(U(p, n + 'P'), 0, 1, 0, 0); gl.uniform3f(U(p, n + 'C'), 0, 0, 0); return; }
    gl.uniform4f(U(p, n), D.d[0], D.d[1], D.d[2], Math.cos(D.r * DEG));
    gl.uniform4f(U(p, n + 'P'), D.i, D.halo, D.haloI, D.wide);
    gl.uniform3fv(U(p, n + 'C'), D.c);
  }
  /* draw rows of the scene: as many as this frame's share */
  function slice(rows) {
    var p = progs.scene, y = job.row, h = Math.min(rows, ch - y);
    if (h <= 0) return;
    gl.useProgram(p);
    bind(p, 0, 'uN3', tex.n3, gl.TEXTURE_3D);
    bind(p, 1, 'uN2', tex.n2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb.s);
    gl.viewport(0, 0, cw, ch);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(0, y, cw, h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.SCISSOR_TEST);
    job.row += h;
  }
  function finishJob() {
    var S = job.S, p, sun = sunOnWindow(S), w2 = tex.sh.w, h2 = tex.sh.h;
    /* the shafts */
    p = progs.shaft; gl.useProgram(p);
    bind(p, 0, 'uS', tex.s);
    gl.uniform2f(U(p, 'uRes'), w2, h2);
    gl.uniform2f(U(p, 'uSun'), sun[0] / W, 1 - sun[1] / H);
    gl.uniform4f(U(p, 'uSh'), 0.32, 0.95, W / H, 0);
    draw(p, fb.sh, w2, h2);
    /* the glow */
    down(tex.s, fb.b1, 0.75); down(tex.b1, fb.b2, 0); down(tex.b2, fb.b3, 0);
    up(tex.b3, tex.b2, fb.u2); up(tex.u2, tex.b1, fb.u1);
    /* finished, into the spare frame */
    var f = nextFinal();
    p = progs.finish; gl.useProgram(p);
    bind(p, 0, 'uS', tex.s); bind(p, 1, 'uSh', tex.sh); bind(p, 2, 'uBl', tex.u1);
    gl.uniform2f(U(p, 'uRes'), cw, ch);
    gl.uniform3fv(U(p, 'uShC'), S.shaftC);
    gl.uniform4f(U(p, 'uPost'), S.shafts * (sun[2] ? 1 : 0), S.bloom, S.exposure, S.sat);
    draw(p, fb[f], cw, ch);
    shown = shown[1] ? [shown[1], f] : [f, f];
    doneAt = t; frames++;
    readStats(tex[f], S);
    job = null;
  }
  function nextFinal() { var k; for (k = 0; k < 3; k++) if (shown[0] !== 'f' + k && shown[1] !== 'f' + k) return 'f' + k; return 'f0'; }
  function down(src, dst, thr) {
    var p = progs.down; gl.useProgram(p);
    bind(p, 0, 'uS', src);
    gl.uniform2f(U(p, 'uRes'), dst.t.w, dst.t.h);
    gl.uniform2f(U(p, 'uHalf'), 0.5 / src.w, 0.5 / src.h);
    gl.uniform1f(U(p, 'uThr'), thr);
    draw(p, dst, dst.t.w, dst.t.h);
  }
  function up(src, add, dst) {
    var p = progs.up; gl.useProgram(p);
    bind(p, 0, 'uS', src); bind(p, 1, 'uAdd', add);
    gl.uniform2f(U(p, 'uRes'), dst.t.w, dst.t.h);
    gl.uniform2f(U(p, 'uHalf'), 0.5 / src.w, 0.5 / src.h);
    draw(p, dst, dst.t.w, dst.t.h);
  }
  /* where the sun stands on the window (or the moon), and whether it is in front of the camera */
  function sunOnWindow(S) {
    var D = S.discA && S.discB ? (S.k < 0.5 ? S.discA : S.discB) : (S.discA || S.discB), o = [0, 0, 0];
    if (!D) { toWindow(S.light, o); return [o[0], o[1], 0]; }
    toWindow(D.d, o);
    return [o[0], o[1], o[2] > 0.05 ? 1 : 0];
  }

  /* ---------------- the window: crossfaded, with stars, rain and the veil ---------------- */

  var lastShow = -1, lastSteer = -1;
  function show(S) {
    var p = progs.show, k = clamp((t - doneAt) / period, 0, 1);
    if (still) k = 1;
    gl.useProgram(p);
    bind(p, 0, 'uA', tex[shown[0]]); bind(p, 1, 'uB', tex[shown[1]]);
    gl.uniform1f(U(p, 'uK'), k);
    gl.uniform4f(U(p, 'uVp'), canvas.width, canvas.height, W, H);
    gl.uniform4fv(U(p, 'uR'), rectOf(wordsR, WORDS_CORE).concat(rectOf(nameR, WORDS_CORE), rectOf(links[0], LINKS_CORE), rectOf(links[1], LINKS_CORE)));
    gl.uniform2f(U(p, 'uFe'), WORDS_FEATHER, LINKS_FEATHER);
    gl.uniform2f(U(p, 'uBand'), band.lo, band.hi);
    gl.uniform2f(U(p, 'uBandT'), band.tlo, band.thi);
    gl.uniform4f(U(p, 'uSt'), S.stars, starSeed, cam.hy, Math.max(0.7, Math.min(1.1, canvas.width / W * 0.6)));
    gl.uniform4f(U(p, 'uRn'), still ? 0 : S.rain, Math.floor(t * DRAW_FPS), 0.18 * windDir, 0);
    gl.uniform3fv(U(p, 'uRnC'), S.rainC);
    draw(p, null, canvas.width, canvas.height);
  }
  function rectOf(r, m) { return r ? [r[0] - m, r[1] - m, r[2] + m, r[3] + m] : [0, 0, 0, 0]; }

  /* ---------------- the words' colours, from what was drawn where they stand ---------------- */

  var pbo = null, sync = null, statsOut = new Uint8Array(32), statsFor = null, meta = document.querySelector('meta[name="theme-color"]');
  var trusted = false, doubts = 0, waited = 0;
  /* the sky's light where the words stand, as the gradient alone would have it */
  function expected(S) {
    var R = wordsR || stackR, d, e, c;
    if (!R || !S) return -1;
    d = fromWindow((R[0] + R[2]) / 2, (R[1] + R[3]) / 2); e = Math.max(0, Math.asin(clamp(d[1], -1, 1)) / DEG);
    c = lerp3(S.sky[0], S.sky[1], sstep(0, 5, e)); c = lerp3(c, S.sky[2], sstep(5, 15, e));
    c = lerp3(c, S.sky[3], sstep(15, 32, e)); c = lerp3(c, S.sky[4], sstep(32, 60, e));
    return lumOf(c);
  }
  function sstep(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function trust(ok) {
    trusted = true;
    if (ok) { canvas.classList.add('on'); return; }
    canvas.classList.remove('on'); unwords(); gl = null;
    if (window.console) console.warn('sky: the drawn sky did not look right; the still sky stays');
  }
  function readStats(src, S) {
    var R = wordsR || stackR;
    if (!R || sync) return;
    statsFor = S;
    var p = progs.stats;
    if (!fb.st) { tex.st = texture2(8, 1, 'rgba8', gl.NEAREST); fb.st = target(tex.st); pbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, 32, gl.STREAM_READ); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); }
    gl.useProgram(p);
    bind(p, 0, 'uF', src);
    gl.uniform4f(U(p, 'uRs'), R[0] / W, 1 - R[1] / H, R[2] / W, 1 - R[3] / H);
    draw(p, fb.st, 8, 1);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.readPixels(0, 0, 8, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
  }
  function pollStats() {
    if (!sync) return;
    var st = gl.clientWaitSync(sync, 0, 0);
    if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) return;
    gl.deleteSync(sync); sync = null;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, statsOut);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    var sq = function (i) { var v = statsOut[i * 4] / 255; return v * v; };
    seenT = { mn: sq(0), mx: sq(1), mean: sq(2), sd: sq(4) };
    if (!trusted) {                                       // the sky drawn as it should be? (a GPU or driver that draws
      var y = expected(statsFor);                         //  nonsense is let go, and the stylesheet's sky stays)
      if (y < 0 || (seenT.mean > y / 4 && seenT.mean < y * 4 + 0.05)) trust(true);
      else if (++doubts >= 2) { trust(false); return; }
    }
    var top = '#', i, v;
    for (i = 0; i < 3; i++) { v = statsOut[12 + i]; top += (v < 16 ? '0' : '') + v.toString(16); }
    if (meta && top !== themeWas) { meta.setAttribute('content', top); themeWas = top; }
  }
  var themeWas = '', TEXT_LIGHT = [0.99, 0.006, 95], TEXT_LIGHT_Y = lumOf(linOf(lab(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2]))), tokensWere = {};
  var HI_MAX = (TEXT_LIGHT_Y + 0.05) / RATIO - 0.05;   // the lightest sky light words read on
  /* the band: the ground the words are held to, followed smoothly from what
     was drawn. Dark words want it no darker than FLIP, light words no
     lighter than HI_MAX; the bio's ground sets its dimmed grey. Near the
     crossing the band pinches toward the one ground both read on, the
     words flip there, and it opens again: nothing jumps but the words */
  var seen = null, seenT = null, band = { lo: FLIP, hi: 1, tlo: FLIP, thi: 1, mode: 0 };
  function steer(dt, S) {
    var f, k, m, lo, hi, w, mode = S.words >= 0.5 ? 1 : 0;   // (the words flip at the twilight, on the cycle's own time)
    if (!seenT) { opened(mode, mode ? 0 : FLIP, mode ? HI_MAX : 1, Math.max(0.004, S.flipW)); return; }
    if (!seen) { seen = {}; for (f in seenT) seen[f] = seenT[f]; }
    k = still ? 1 : 1 - Math.exp(-dt / 0.6);
    for (f in seen) seen[f] += (seenT[f] - seen[f]) * k;
    m = seen.mean; lo = Math.max(seen.mn, m - 3 * seen.sd); hi = Math.min(seen.mx, m + 3 * seen.sd);
    w = Math.max(0.004, S.flipW);
    opened(mode, lo, hi, w);
  }
  function opened(mode, lo, hi, w) {
    band.mode = mode;
    if (mode === 0) {
      band.lo = Math.max(FLIP, lo * 0.97); band.hi = Math.max(band.lo + 0.004, FLIP + w);
      band.tlo = FLIP; band.thi = FLIP + w;
    } else {
      band.hi = Math.min(HI_MAX, hi * 1.03); band.lo = Math.min(band.hi - 0.004, Math.max(0, HI_MAX - w));
      band.tlo = Math.max(0, HI_MAX - w); band.thi = HI_MAX;
    }
  }
  /* the words' colours for the band: black and a grey on a light sky; a near-white and a lighter grey on a dark one */
  function words() {
    var Yd, Yf, tk = {};
    if (band.mode === 0) {
      Yd = Math.min(0.108, (band.lo + 0.05) / RATIO - 0.05);
      Yf = Math.min(0.155, (band.lo + 0.05) / RING - 0.05);
      tk['--color-text'] = '#000000';
      tk['--color-dimmed'] = hex(ofLum(Math.max(Yd, 0), 0.009, 85));
      tk['--color-focus'] = hex(ofLum(Math.max(Yf, 0.004), 0.12, 75));
      tk['--color-selection'] = '#e6e2d6';
    } else {
      Yd = Math.min(TEXT_LIGHT_Y, Math.max(0.4, RATIO * (band.hi + 0.05) - 0.05));
      Yf = Math.min(TEXT_LIGHT_Y, Math.max(0.45, RING * (band.hi + 0.05) - 0.05));
      tk['--color-text'] = hex(linOf(lab(TEXT_LIGHT[0], TEXT_LIGHT[1], TEXT_LIGHT[2])));
      tk['--color-dimmed'] = hex(ofLum(Yd, 0.014, 255));
      tk['--color-focus'] = hex(ofLum(Yf, 0.11, 85));
      tk['--color-selection'] = '#3b3f55';
    }
    for (var k in tk) if (tokensWere[k] !== tk[k]) { root.style.setProperty(k, tk[k]); tokensWere[k] = tk[k]; }
  }
  function unwords() { for (var k in tokensWere) root.style.removeProperty(k); tokensWere = {}; }

  /* ---------------- the loop ---------------- */

  var raf = 0, last = 0, still = false, frozen = false, base = 0, slow = 0, settled = 0, nameWas = '';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)'), forced = window.matchMedia('(forced-colors: active)');
  function frame(now) {
    raf = 0;
    if (lost || forced.matches) return;
    if (!ready) {
      var l = linked();
      if (l < 0) { gl = null; return; }
      if (l === 0) { raf = requestAnimationFrame(frame); return; }
      ready = true; bakeNoise();
    }
    var dt = last ? Math.min((now - last) / 1000, 1) : 0, step = Math.min(dt, STEP_MAX);
    last = now;
    if (dirty) { measure(); if (!cam.lent) ownCamera(); aimWind(); buffers(); }
    if (!still) { t += step; govern(dt); }
    var S = blend(t);
    tendTowers(still ? 0 : step, S, still || frames === 0);
    if (S.name !== nameWas) { root.setAttribute('data-sky', S.name); nameWas = S.name; }
    /* all the GPU's work is done on the sky's drawing ticks (12 a second),
       each ending with the window drawn: a browser may show the canvas
       after any frame that drew at all (until the first sky is drawn, the
       canvas is unseen, and the work goes on every frame) */
    if (!shown[1] || still || now - lastShow >= 1000 / DRAW_FPS - 4) {
      if (!job && (!still || !shown[1])) startJob(!shown[1]);
      if (job) {
        slice(job.fast || still ? Math.ceil(ch / 4) : Math.max(4, Math.ceil(ch * clamp((now - lastShow) / 1000, 0, 0.25) / (period * 0.85))));
        if (job.row >= ch) finishJob();
      }
      pollStats();
      if (!gl) return;
      if (shown[1]) {
        steer(lastSteer < 0 ? 0 : Math.min((now - lastSteer) / 1000, 0.25), S); lastSteer = now;
        words(); show(S); lastShow = now;
        if (!trusted && ++waited > 3 * DRAW_FPS) trust(true);   // (no read-back at all: shown on the veil's word)
      }
    }
    if (!still || job || sync || !trusted) raf = requestAnimationFrame(frame);
  }
  /* a slow device: a longer frame period first, then a smaller frame */
  function govern(dt) {
    if (dt <= 0 || dt > 0.25) return;
    settled += dt;
    base = base ? Math.min(base * 1.002, dt, base) : dt;
    if (settled < 3) return;
    slow = dt > base * 1.6 ? slow + dt : Math.max(0, slow - dt * 0.5);
    if (slow > 2) {
      slow = 0;
      if (period < PERIOD_MAX) period = Math.min(PERIOD_MAX, period * 1.4);
      else if (scale > SCALE_MIN) { scale = Math.max(SCALE_MIN, scale * 0.8); period = PERIOD * 1.4; buffers(); }
      else { frozen = still = true; }                    // (too slow even so: the still sky, as it stands)
    }
  }
  function run() { if (!raf && gl && !lost) raf = requestAnimationFrame(frame); }

  /* the birds lend their camera */
  window.skyAir = {
    aim: function (f, th, w, h) {
      setCamera(f, th, w, h); cam.lent = true;
      if (gl && ready) { aimWind(); job = null; shown[1] && (shown = [shown[1], shown[1]]); }
      run();
    }
  };

  function onLayout() { dirty = true; run(); }
  function onPref() {
    still = reduce.matches || frozen;
    if (forced.matches) { canvas.classList.remove('on'); unwords(); return; }
    job = null; run();
  }

  if (!setup()) return;
  still = reduce.matches || frozen;
  measure();
  if (!aimed) ownCamera();
  aimWind();
  buffers();
  dirty = false;
  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; canvas.classList.remove('on'); unwords(); if (raf) cancelAnimationFrame(raf); raf = 0; });
  canvas.addEventListener('webglcontextrestored', function () {
    lost = false; ready = false; progs = {}; tex = {}; fb = {}; sync = null; pbo = null; cw = ch = 0; job = null; shown = [null, null];
    if (setup()) { buffers(); run(); }
  });
  window.addEventListener('resize', onLayout);
  window.addEventListener('scroll', onLayout, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onLayout);
  if (reduce.addEventListener) { reduce.addEventListener('change', onPref); forced.addEventListener('change', onPref); }
  run();
})();
