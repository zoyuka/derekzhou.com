/* Birds — the dots of samara.com/jobs, drawn as birds, flown in this
   site's own hand.

   SAMARA (kept): one mark per opening, each appearing at a random moment
   within count x 500 ms and fading in over a second (style: @keyframes
   appear), drifting about the window at 0.5 px a frame for as long as the
   page is open and never leaving it. Three birds, one per glyph, at
   SPEED (~30 px/s, Samara's pace at 60 fps), each its own 0.9-1.1 of it.

   THE HAND (restored from the ink garden's birds): the three tattoo
   glyphs (GLYPHS — the alphabet; do not restyle them) in 1.9 px round
   strokes, each bird its own size; the BOIL, every vertex re-jittered
   BOIL_FPS times a second by the visit's hand (1.2-1.6 px, x0.4 on a bird
   in flight); the stop-motion WING-BEAT, the wings half-folding toward the
   body line and opening again, detuned per bird (0.68-0.95 Hz). The
   drawing changes only on the hand's frames — tremor, wings, facing —
   while the bird glides smoothly between them, the way a hand-drawn
   character is carried across a panning shot.

   THE FLIGHT (feng shui: nothing ruled straight, nothing sharp, the words
   left clear, the space held in balance):
   - a bird cruises level-ish, its climb wandering slowly (a mean-reverting
     walk as wide as the visit's breeze, at most PITCH_MAX)
   - when a wall or the words lie ahead it turns back in ONE smooth loop,
     into whichever side has more room, the loop sized to that room —
     Samara's instant bounce survives only as a fail-safe
   - the words are never crossed: the name/bio/credit box and the footer
     links (+ margins, + the bird's own radius) are obstacles above and
     below as well as ahead; a bird drifting close above or below eases
     away (it never tilts: the glyphs are drawn level, as ever)
   - birds give each other room, parting in height to pass
   - they appear in balance: each at the best of a low-discrepancy (R2)
     set of open spots, as far as it can be from the birds already out,
     facing alternately left and right (a Markov flip, 72 % alternate)

   THE WEATHER (=rand()): ONE crypto draw at init, above INIT-END, and no
   clock at all; it seeds splitmix32 streams — one front and its facets
   (hand, tempo, breeze, pace, as before) and each bird's own stream. The
   visit owns HOW the birds fly; the page owns WHERE they may. There is
   no other randomness.

   prefers-reduced-motion: the birds are placed (in balance, clear of the
   words) and stay still, the hand at rest (live, both ways). A hidden tab
   pauses with requestAnimationFrame; a step is capped at STEP_MAX. No DOM
   is built: the three SVGs are in index.html; this draws their strokes
   and moves them. */
(function () {
  'use strict';

  var els = Array.prototype.slice.call(document.querySelectorAll('.bird'));
  if (!els.length || !window.requestAnimationFrame || !window.matchMedia) return;

  var DEG = Math.PI / 180;

  /* ---------------- constants ---------------- */

  var SPEED = 30;              // px/s cruise (Samara: 0.5 px a frame at 60 fps)
  var PACE = [0.9, 1.1];       // each bird's share of it
  var STAGGER = 500;           // ms per bird: each appears within count x STAGGER (Samara)
  var SCALE = 1.2;             // glyph units to css px
  var SIZE = [0.85, 1.15];     // each bird its own size
  var LINE = 1.9;              // stroke width, css px
  var PAD = 3;                 // px around the glyph: the stroke's cap and the boil
  var BOIL_FPS = 5;            // the hand redraws the marks this often
  var HAND = [1.2, 1.6];       // px: the visit's tremor ...
  var JSCALE = 0.4;            // ... trimmed for a small mark in flight
  var BEAT_HZ = [0.68, 0.95];  // stop-motion wing-beat, detuned per bird
  var FACE_HYST = 0.2;         // |cos heading| past this before a bird turns to face the other way
  var PITCH_MAX = 28 * DEG;    // the steepest cruising climb or descent
  var PITCH_TAU = 6;           // s: how slowly the climb wanders
  var PITCH_SD = [8, 18];      // degrees: the wander's width, by the breeze
  var TRACK = 1.2;             // 1/s: how briskly a bird comes onto its course
  var CRUISE_TURN = 0.6;       // rad/s: the tightest turn while cruising
  var LOOP_R = [18, 120];      // px: a turnaround loop's radius, sized to the room
  var PIVOT_R = 10;            // px: the tightest turn (180° in about a second), when not even LOOP_R[0] fits
  var NARROW_LOOK = [20, 40, 60];   // px ahead where a bird checks it could still turn round
  var LOOP_ROOM = 0.45;        // a loop takes at most this share of the room on its side
  var LOOP_LEAD = 20;          // px: a loop starts this far before it must
  var LOOP_DONE = 20 * DEG;    // a loop ends this close to the new course
  var EDGE = 8;                // px kept clear of the window's edges
  var WORDS = 12;              // px kept clear of the words (the name, bio and credit box)
  var LINKS = 12;              // px kept clear of the footer links
  var EASE_V = 60;             // px: closer than this above or below, a bird eases away
  var SEP = 90;                // px: birds give each other this much room (in height)
  var CLOSE = 30;              // px past touching: closer than this, a bird eases its pace
  var PACE_BACK = 0.5, PACE_ON = 0.25;   // the one behind slows by up to this, the one ahead quickens by up to this
  var TERRITORY = 25000;       // px² of open sky each bird needs: a small sky holds fewer birds, never a crowd
  var ONE_BIRD = 5000;         // px² of open sky where one bird still flies (any sky that has room has a bird)
  var SPAWN_CLEAR = 16;        // px of open space a bird needs around it to appear
  var CANDIDATES = 32;         // open spots tried per appearance
  var ALTERNATE = 0.72;        // the next bird faces the other way this often
  var STEP_MAX = 0.05;         // s: the longest step a frame may take

  var GLYPHS = [
    [[0, 0], [2, 6], [9, 5], [11, 12], [19, 11]],
    [[0, 0], [2, 5], [8, 4], [9, 10], [16, 9]],
    [[0, 0], [2, 5], [8, 4], [10, 10], [15, 9], [26, 20]]   // long tail
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
  /* VISIT streams: 1 the hand's noise, 2 placement, 11 the weather record, 20+ each bird */
  function vstream(n) { return sm32((visitSeed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0); }

  /* ONE front, four facets: a still visit is still everywhere (a steady
     hand, slow wings, a narrow wander, an easy pace), a lively one lively */
  var wr = vstream(11);
  var front = (wr() + wr()) / 2;
  function facet() { return 0.7 * front + 0.3 * wr(); }
  var fHand = facet(), fTempo = facet(), fBreeze = facet(), fPace = facet();

  /* ---- INIT-END: no clock or entropy reads below this line ---- */

  var hand = (HAND[0] + (HAND[1] - HAND[0]) * fHand) * JSCALE;       // px
  var pitchSd = (PITCH_SD[0] + (PITCH_SD[1] - PITCH_SD[0]) * fBreeze) * DEG;

  var NOISE_N = 4096;
  var noise = new Float32Array(NOISE_N);
  (function () { var r = vstream(1), i; for (i = 0; i < NOISE_N; i++) noise[i] = r() * 2 - 1; })();
  function nz(i) { return noise[(i | 0) & (NOISE_N - 1)]; }
  /* a unit normal, near enough (Irwin-Hall of three uniforms) */
  function gauss(r) { return (r() + r() + r() - 1.5) * 2; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function wrap(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; }
  function mix(r, lo, hi) { return lo + (hi - lo) * r; }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- the page: the window and the words ---------------- */

  var W = 0, H = 0, obst = [], dirty = true;
  function grow(r, m) { return { l: r.left - m, t: r.top - m, r: r.right + m, b: r.bottom + m }; }
  function measure() {
    W = window.innerWidth; H = window.innerHeight;
    obst = [];
    var s = document.querySelector('.stack'), i, a = document.querySelectorAll('footer a');
    if (s) obst.push(grow(s.getBoundingClientRect(), WORDS));
    for (i = 0; i < a.length; i++) obst.push(grow(a[i].getBoundingClientRect(), LINKS));
    dirty = false;
    capacity = sky();
  }

  /* how many birds this sky holds: the open space (where a typical bird
     could fly and still turn round), over TERRITORY each — and at least
     one wherever a bird can fly at all */
  var capacity = 0;
  function sky() {
    var probe = { rad: 18 }, step = 12, x, y, n = 0;
    for (y = step / 2; y < H; y += step) for (x = step / 2; x < W; x += step) {
      if (!valid(probe, x, y)) continue;
      if (ray(probe, x, y, 0, -1) + ray(probe, x, y, 0, 1) < 2 * LOOP_R[0] + 8) continue;
      n++;
    }
    n *= step * step;
    return Math.min(els.length, Math.max(n >= ONE_BIRD ? 1 : 0, Math.floor(n / TERRITORY)));
  }

  /* the bird's centre must stay inside the window (less EDGE and its
     radius) and outside every obstacle (grown by its radius) */
  function outOfWindow(b, x, y) {
    var e = EDGE + b.rad;
    return x < e || x > W - e || y < e || y > H - e;
  }
  function hitObstacle(b, x, y) {
    var i, o, r = b.rad;
    for (i = 0; i < obst.length; i++) {
      o = obst[i];
      if (x > o.l - r && x < o.r + r && y > o.t - r && y < o.b + r) return o;
    }
    return null;
  }
  function valid(b, x, y) { return !outOfWindow(b, x, y) && !hitObstacle(b, x, y); }

  /* open space around a point: to the window's edges and the nearest obstacle */
  function clearance(b, x, y) {
    var e = EDGE + b.rad, c = Math.min(x - e, W - e - x, y - e, H - e - y), i, o, dx, dy;
    for (i = 0; i < obst.length; i++) {
      o = obst[i];
      dx = Math.max(o.l - b.rad - x, 0, x - (o.r + b.rad));
      dy = Math.max(o.t - b.rad - y, 0, y - (o.b + b.rad));
      c = Math.min(c, Math.sqrt(dx * dx + dy * dy));
    }
    return c;
  }

  /* how far the bird's centre can go along (dx, dy) before it must stop */
  function slab(x, y, dx, dy, l, t, r, b) {
    var tmin = -Infinity, tmax = Infinity, t1, t2;
    if (Math.abs(dx) < 1e-9) { if (x <= l || x >= r) return Infinity; }
    else { t1 = (l - x) / dx; t2 = (r - x) / dx; tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2)); }
    if (Math.abs(dy) < 1e-9) { if (y <= t || y >= b) return Infinity; }
    else { t1 = (t - y) / dy; t2 = (b - y) / dy; tmin = Math.max(tmin, Math.min(t1, t2)); tmax = Math.min(tmax, Math.max(t1, t2)); }
    if (tmax < 0 || tmin > tmax) return Infinity;
    return Math.max(0, tmin);
  }
  function ray(b, x, y, dx, dy) {
    var e = EDGE + b.rad, best = Infinity, i, o, r = b.rad;
    if (dx > 1e-9) best = (W - e - x) / dx; else if (dx < -1e-9) best = (e - x) / dx;
    if (dy > 1e-9) best = Math.min(best, (H - e - y) / dy); else if (dy < -1e-9) best = Math.min(best, (e - y) / dy);
    for (i = 0; i < obst.length; i++) {
      o = obst[i];
      best = Math.min(best, slab(x, y, dx, dy, o.l - r, o.t - r, o.r + r, o.b + r));
    }
    return Math.max(0, best);
  }

  /* ---------------- the birds ---------------- */

  var flock = [], lost = [], raf = 0, last = 0, t = 0, phase = -1;
  var place = vstream(2);
  var r2k = 0, r2x = place(), r2y = place();          // the R2 sequence's offset for this visit
  var lastDir = place() < 0.5 ? -1 : 1;

  function setup(el, i) {
    var pts = GLYPHS[i % GLYPHS.length], r = vstream(20 + i);
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, m = 0, k;
    for (k = 0; k < pts.length; k++) {
      x0 = Math.min(x0, pts[k][0]); x1 = Math.max(x1, pts[k][0]);
      y0 = Math.min(y0, pts[k][1]); y1 = Math.max(y1, pts[k][1]);
      m += pts[k][1];
    }
    var sc = SCALE * mix(r(), SIZE[0], SIZE[1]);
    var gw = (x1 - x0) * sc, gh = (y1 - y0) * sc;
    var b = {
      el: el, line: el.querySelector('polyline'), pts: pts, i: i, rng: r,
      x0: x0, y0: y0, mid: m / pts.length, sc: sc,
      w: gw + 2 * PAD, h: gh + 2 * PAD, rad: 0.5 * Math.sqrt(gw * gw + gh * gh) + 1.5,
      cruise: SPEED * mix(0.6 * fPace + 0.4 * r(), PACE[0], PACE[1]),
      hz: mix(0.6 * fTempo + 0.4 * r(), BEAT_HZ[0], BEAT_HZ[1]), ph: r() * 7,
      key: 9100 + i * 97,
      hand: r() < 0.5 ? -1 : 1,                          // which way it loops when both sides are equal
      x: 0, y: 0, th: 0, dir: 1, pw: 0, loop: 0, loopR: LOOP_R[0], turned: 0, side: 0,
      face: 1, amp: 1, shown: false, due: false
    };
    el.setAttribute('viewBox', '0 0 ' + b.w.toFixed(2) + ' ' + b.h.toFixed(2));
    el.setAttribute('width', b.w.toFixed(2));
    el.setAttribute('height', b.h.toFixed(2));
    b.line.setAttribute('stroke-width', LINE);
    return b;
  }

  /* the course a bird is on: level plus its climb, left or right */
  function course(b, climb) { return b.dir > 0 ? -climb : Math.PI + climb; }

  /* an open spot in balance: the best of CANDIDATES from the R2 sequence,
     clear of the words and as far as it can be from the birds already out */
  function spot(b) {
    var best = null, bestS = -Infinity, k, x, y, c, d, j, o, s;
    for (k = 0; k < CANDIDATES; k++) {
      r2k++;
      x = W * ((r2x + r2k * 0.7548776662466927) % 1);
      y = H * ((r2y + r2k * 0.5698402909980532) % 1);
      if (!valid(b, x, y)) continue;
      c = clearance(b, x, y);
      if (c < SPAWN_CLEAR) continue;
      if (ray(b, x, y, 0, -1) + ray(b, x, y, 0, 1) < 2 * LOOP_R[0] + 8) continue;   // room to turn round
      if (ray(b, x, y, -1, 0) + ray(b, x, y, 1, 0) < 2 * LOOP_R[0] + 8) continue;
      d = 600;
      for (j = 0; j < flock.length; j++) {
        o = flock[j];
        if (o !== b) d = Math.min(d, Math.sqrt((o.x - x) * (o.x - x) + (o.y - y) * (o.y - y)));
      }
      s = d + 0.3 * Math.min(c, 150);
      if (s > bestS) { bestS = s; best = { x: x, y: y }; }
    }
    return best;
  }

  function appear(b) {
    if (b.shown) return;
    b.due = true;
    if (dirty) measure();
    if (flock.length >= capacity) return;                  // the sky is full: it waits for more room
    var p = spot(b);
    if (!p) return;                                        // no room on this screen: try again on the next measure
    b.due = false;
    b.x = p.x; b.y = p.y;
    b.dir = b.rng() < ALTERNATE ? -lastDir : lastDir; lastDir = b.dir;
    b.pw = clamp(gauss(b.rng) * pitchSd, -PITCH_MAX, PITCH_MAX);
    b.th = course(b, b.pw);
    b.face = b.dir > 0 ? -1 : 1;
    b.loop = 0;
    b.shown = true;
    flock.push(b);
    pose(b, 0, still.matches);
    put(b);
    b.el.classList.add('on');
    run();
  }

  function vanish(b) {
    var k = flock.indexOf(b);
    b.shown = false; b.due = true;
    b.el.classList.remove('on');
    if (k >= 0) flock.splice(k, 1);
  }

  /* the drawing, on the hand's frames only: facing, wings, tremor */
  function pose(b, boil, rest) {
    var c = Math.cos(b.th), i, p, k, out = [], jit = rest ? 0 : hand;
    if (b.face > 0 && c > FACE_HYST) b.face = -1;          // turn to face right (mirrored)
    else if (b.face < 0 && c < -FACE_HYST) b.face = 1;     // face left (as drawn)
    b.amp = rest ? 1 : (Math.floor(t * b.hz + b.ph) % 2 ? 1 : 0.5);   // stop-motion wing-beat
    for (i = 0; i < b.pts.length; i++) {
      p = b.pts[i];
      k = b.key + i * 7 + boil * 131;
      out.push(((p[0] - b.x0) * b.sc + PAD + nz(k) * jit).toFixed(2) + ',' +
               ((b.mid + (p[1] - b.mid) * b.amp - b.y0) * b.sc + PAD + nz(k + 61) * jit).toFixed(2));
    }
    b.line.setAttribute('points', out.join(' '));
  }

  function put(b) {
    b.el.style.transform = 'translate3d(' + (b.x - b.w / 2).toFixed(2) + 'px,' + (b.y - b.h / 2).toFixed(2) + 'px,0)' +
      (b.face < 0 ? ' scaleX(-1)' : '');
  }

  /* the widest turning circle, up to rmax, that fits: centred beside the
     bird on the side of the turn (sense +1 turns clockwise on screen), its
     whole round clear of the window's edges and the words by the bird's
     own radius; 0 when not even the tightest fits */
  function loopFit(b, sense, rmax, rmin) {
    var nx = -Math.sin(b.th) * sense, ny = Math.cos(b.th) * sense, r = rmax, cx, cy;
    while (r >= rmin) {
      cx = b.x + nx * r; cy = b.y + ny * r;
      if (valid(b, cx, cy) && clearance(b, cx, cy) >= r + 2) return r;
      r *= 0.85;
    }
    return 0;
  }
  /* a loop that would sweep through another bird's patch of sky counts for
     less: turning back, a bird turns away from the others too */
  function crowded(b, sense, r) {
    var nx = -Math.sin(b.th) * sense, ny = Math.cos(b.th) * sense, cx = b.x + nx * r, cy = b.y + ny * r, j, o;
    for (j = 0; j < flock.length; j++) {
      o = flock[j];
      if (o !== b && Math.sqrt((o.x - cx) * (o.x - cx) + (o.y - cy) * (o.y - cy)) < r + b.rad + o.rad + CLOSE) return true;
    }
    return false;
  }

  /* one step of flight; false when the words have moved onto the bird */
  function fly(b, dt) {
    var up, down, j, o, d, dx, dy, w, e, climb, goal, ahead, fore, pref, rOver, rUnder, sOver, sUnder, r, side, s, px, nx, ny, hit;
    if (!valid(b, b.x, b.y)) return false;
    up = ray(b, b.x, b.y, 0, -1); down = ray(b, b.x, b.y, 0, 1);

    /* the climb: a slow wander, eased away from what is close above or
       below — or ahead along a climb or a dive, which is how a corner of
       the words is seen coming — and away from a bird close by */
    b.pw += -b.pw / PITCH_TAU * dt + pitchSd * Math.sqrt(2 * dt / PITCH_TAU) * gauss(b.rng);
    b.pw = clamp(b.pw, -PITCH_MAX, PITCH_MAX);
    climb = b.pw;
    /* the easing is a floor (or a ceiling) on the climb, not a nudge: a
       bird near the floor climbs at least this much, whatever it wanders */
    e = (down < EASE_V ? 1 - down / EASE_V : 0) - (up < EASE_V ? 1 - up / EASE_V : 0);
    fore = ray(b, b.x, b.y, Math.cos(b.th), Math.sin(b.th));
    if (fore < EASE_V && Math.abs(Math.sin(b.th)) > 0.05) e += (Math.sin(b.th) > 0 ? 1 : -1) * (1 - fore / EASE_V);
    e = clamp(e, -1, 1) * PITCH_MAX;
    if (e > 0) climb = Math.max(climb, e); else if (e < 0) climb = Math.min(climb, e);
    ahead = ray(b, b.x, b.y, b.dir, 0);
    for (j = 0; j < flock.length; j++) {
      o = flock[j];
      if (o === b) continue;
      dx = o.x - b.x; dy = o.y - b.y;
      d = Math.sqrt(dx * dx + dy * dy);
      if (d < SEP) climb += (dy < 0 || (dy === 0 && b.i > o.i) ? -1 : 1) * (1 - d / SEP) * PITCH_MAX * 0.8;
      /* a bird in the way, at its own height, is a wall ahead too */
      if (dx * b.dir > 0 && Math.abs(dy) < b.rad + o.rad + 6) ahead = Math.min(ahead, Math.max(0, Math.abs(dx) - b.rad - o.rad));
    }
    climb = clamp(climb, -PITCH_MAX, PITCH_MAX);

    /* a gap ahead too narrow to turn round in counts as a wall: a bird
       turns back before it, never into it */
    for (j = 0; j < NARROW_LOOK.length && NARROW_LOOK[j] < ahead; j++) {
      px = b.x + b.dir * NARROW_LOOK[j];
      if (ray(b, px, b.y, 0, -1) + ray(b, px, b.y, 0, 1) < 2 * LOOP_R[0] + 8) { ahead = Math.max(0, NARROW_LOOK[j] - 10); break; }
    }

    /* a wall, the words or a bird ahead: turn back in one loop — the
       widest turning circle that fits the open space, over the top or
       under, keeping to the side it last turned while that side still has
       room (so a narrow column is climbed or descended in switchbacks,
       like a thermal, rather than paced) */
    if (!b.loop) {
      pref = clamp(LOOP_ROOM * Math.max(up, down), LOOP_R[0], LOOP_R[1]);
      if (ahead < pref + LOOP_LEAD) {
        rOver = loopFit(b, -b.dir, pref, LOOP_R[0]); rUnder = loopFit(b, b.dir, pref, LOOP_R[0]);
        if (!rOver && !rUnder) { rOver = loopFit(b, -b.dir, LOOP_R[0], PIVOT_R); rUnder = loopFit(b, b.dir, LOOP_R[0], PIVOT_R); }
        sOver = rOver * (rOver && crowded(b, -b.dir, rOver) ? 0.3 : 1);   // turning back, it turns away from the others too
        sUnder = rUnder * (rUnder && crowded(b, b.dir, rUnder) ? 0.3 : 1);
        side = b.side || b.hand;
        if ((side < 0 ? sOver : sUnder) < 0.7 * (side < 0 ? sUnder : sOver)) side = -side;
        r = side < 0 ? rOver : rUnder;
        if (r) {                                            // (no circle fits at all: cruise on; the fail-safe turns it)
          b.side = side;                                    // -1 over the top, +1 under
          b.loopR = r;
          b.loop = side * b.dir;                            // the sense of the turn, in screen angle
          b.dir = -b.dir;
          b.turned = 0;
        }
      }
    }
    /* pace: a bird close behind another eases off, the one ahead quickens,
       so two on one path draw apart along it (birds meeting head-on just
       pass, at their own heights) */
    s = 1;
    for (j = 0; j < flock.length; j++) {
      o = flock[j];
      if (o === b) continue;
      dx = o.x - b.x; dy = o.y - b.y;
      d = Math.sqrt(dx * dx + dy * dy);
      if (d >= b.rad + o.rad + CLOSE || Math.cos(o.th - b.th) < -0.3) continue;
      s += (dx * Math.cos(b.th) + dy * Math.sin(b.th) > 0 ? -PACE_BACK : PACE_ON) * (1 - d / (b.rad + o.rad + CLOSE));
    }
    s = b.cruise * clamp(s, 1 - PACE_BACK, 1 + PACE_ON);

    goal = course(b, climb);
    if (b.loop) {
      s *= 1 - 0.1 * Math.min(1, s / b.loopR);            // a bird slows a little into a turn ...
      w = b.loop * s / b.loopR;                            // ... on the circle it fitted, whatever its pace
      if (Math.abs(wrap(goal - b.th)) < LOOP_DONE || b.turned > 200 * DEG) b.loop = 0;
    } else {
      w = clamp(TRACK * wrap(goal - b.th), -CRUISE_TURN, CRUISE_TURN);
      s *= 1 - 0.1 * Math.min(1, Math.abs(w));
    }
    b.th = wrap(b.th + w * dt);
    b.turned += Math.abs(w * dt);
    nx = b.x + Math.cos(b.th) * s * dt;
    ny = b.y + Math.sin(b.th) * s * dt;

    /* the fail-safe, Samara's bounce: never into the words, never out of the window */
    if (!valid(b, nx, ny)) {
      hit = hitObstacle(b, nx, ny);
      if (outOfWindow(b, nx, b.y)) b.th = wrap(Math.PI - b.th);
      else if (outOfWindow(b, b.x, ny)) b.th = wrap(-b.th);
      else if (hit) {
        if (b.x <= hit.l - b.rad || b.x >= hit.r + b.rad) b.th = wrap(Math.PI - b.th);
        else b.th = wrap(-b.th);
      }
      b.dir = Math.cos(b.th) >= 0 ? 1 : -1;
      b.loop = 0;
      b.pw = 0;                                             // and it levels off, away from the face
      nx = b.x + Math.cos(b.th) * s * dt;
      ny = b.y + Math.sin(b.th) * s * dt;
      if (!valid(b, nx, ny)) { nx = b.x; ny = b.y; }
    }
    b.x = nx; b.y = ny;
    return true;
  }

  /* the words moved onto a bird (a resize, a rotation, a scroll): it goes,
     and comes back in balance where there is room — as it first came */
  function replace(b) { vanish(b); appear(b); }

  function frame(now) {
    raf = 0;
    var dt = last ? Math.min(STEP_MAX, (now - last) / 1000) : 0, i, boil;
    last = now; t += dt;
    if (dirty) remeasure();
    boil = Math.floor(t * BOIL_FPS);
    for (i = 0; i < flock.length; i++) if (!fly(flock[i], dt)) lost.push(flock[i]);
    while (lost.length) replace(lost.pop());
    for (i = 0; i < flock.length; i++) {
      if (boil !== phase) pose(flock[i], boil, false);
      put(flock[i]);
    }
    phase = boil;
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

  /* the page moved or resized: re-measure the words; a bird with nowhere
     left to be goes, a bird that was waiting for room comes */
  function remeasure() {
    measure();
    var i, b;
    for (i = flock.length - 1; i >= 0; i--) {
      b = flock[i];
      if (flock.length > capacity) vanish(b);              // a smaller sky: the last to come go first
      else if (!valid(b, b.x, b.y)) replace(b);            // re-placed in balance, or gone until there is room
    }
    for (i = 0; i < all.length; i++) if (all[i].due && !all[i].shown) appear(all[i]);
  }
  function onLayout() {
    dirty = true;
    if (still.matches || !raf) remeasure();
  }

  measure();
  var all = els.map(setup);
  if (still.matches) {
    all.forEach(appear);                                  // placed at once, still: no fade, no flight
  } else {
    all.forEach(function (b) {
      window.setTimeout(function () { appear(b); }, STAGGER * all.length * place());
    });
  }

  window.addEventListener('resize', onLayout);
  window.addEventListener('scroll', onLayout, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onLayout);

  function onPref() {
    if (still.matches) {
      stop();
      flock.forEach(function (b) { pose(b, 0, true); put(b); });
      all.forEach(function (b) { if (!b.shown) appear(b); });
    } else run();
  }
  if (still.addEventListener) still.addEventListener('change', onPref);
  else if (still.addListener) still.addListener(onPref);
})();
