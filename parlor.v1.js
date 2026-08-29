/* The Parlor — a pachinko machine at rest.
   Full-viewport WebGL2 scene: domain-warped aurora, 7-fold quasicrystal
   mandala, and 328 lamps on a golden-angle phyllotaxis spiral running
   mean-field Kuramoto dynamics. The machine's choreography (idle, reach,
   jackpot, decay) is not scripted — it emerges as the coupling K(t) tides
   across the exact critical threshold Kc = 2*gamma every 233 s. The order
   parameter r is the single master signal: bloom, hue ladder
   (indigo -> teal -> gold -> iridescent), mandala contrast, zoom.
   Date-seeded and clocked from local midnight: same day, same edition,
   mid-cycle on load, for every visitor.

   THE CALM ENVELOPE (CI-greppable; any change must keep all of these true):
   - two hue families at any instant; global palette drift <= 0.15 deg/s
   - fastest single-lamp modulation 0.23 Hz; fastest full-field 0.1 Hz
   - every lamp ramp >= 500 ms; no square waves; springs/overshoot banned
   - additive cap 0.35 per lamp; white ceiling #f2e8d5; matte typography
   - r_disp lives in [0.10, 0.78] — never parked at 1.0
   - >= 35% of the frame stays <= 0.03 luminance (the black budget)
   - text sits in a radial luminance well clamped <= 0.06, plus a CSS scrim
   - pause button ships wherever the loop ships (WCAG 2.2.2)
   - prefers-reduced-motion: one analytically converged frame, no loop
   - no Math.random / no Date.now in the render path; date read once at init
   - zero network; two draw calls; no libraries */

(function () {
  'use strict';

  /* ---------------- CONFIG ---------------- */

  var N_SPIRAL = 360;         // spiral indices
  var HOLE = 32;              // indices skipped -> inner hole at 0.30 R
  var GA = 2.399963229728653; // golden angle, rad
  var OMEGA0 = 0.5236;        // mean natural frequency (2*pi/12 s)
  var GAMMA = 0.12;           // Lorentzian half-width
  var KC = 2 * GAMMA;         // exact critical coupling
  var TIDE_S = 233;           // K(t) tide period      (Fibonacci family)
  var QC_DRIFT_S = 144;       // quasicrystal phase drift base
  var HUE_ROT_S = 377;        // global palette rotation period
  var BREATH_S = 10;          // global breath
  var COMET_S = [55, 89, 144];
  var ROSARY_STEP_S = 2.5;    // theater-chase descendant, mod-8 rings
  var CASCADE_V = 110;        // px/s, click ring speed
  var CASCADE_MAX = 3;
  var CLICK_MIN_MS = 350;
  var POINTER_SIGMA = 150;    // px, warmth falloff
  var LAMP_ADD_CAP = 0.35;
  var EMA_TAU = 1.5;          // r_disp smoothing, s
  var SUBSTEP = 1 / 60;
  var DT_CLAMP = 0.1;
  var IDLE_DIM_S = 180;
  var DPR_CAP = 1.5;
  var MOBILE_W = 700;         // below: N->180 (skip 16), folds 5, DPR 1.25

  /* ---------------- PRNG + seed streams (fixed draw order) ------------- */

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

  var now0 = new Date();                       // the only Date read
  var daySeed = xmur3(now0.getFullYear() + '-' + (now0.getMonth() + 1) + '-' + now0.getDate())();
  var midnightS = now0.getHours() * 3600 + now0.getMinutes() * 60 + now0.getSeconds();
  var stream = function (n) { return sm32((daySeed ^ Math.imul(n + 1, 0x9E3779B9)) >>> 0); };
  var sQphi = stream(5), sSpark = stream(6);   // 1-4 derived where used

  /* ---------------- DOM ---------------- */

  var canvas = document.getElementById('parlor');
  var pauseBtn = document.getElementById('pl-pause');
  if (!canvas) return;
  var doc = document.documentElement;

  var mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
  function listenMq(mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  }

  /* ---------------- WebGL2 ---------------- */

  var gl = canvas.getContext('webgl2', {
    alpha: false, depth: false, stencil: false, antialias: false,
    powerPreference: 'low-power', preserveDrawingBuffer: false
  });
  if (!gl) {                        // typography over the dark ground
    canvas.parentNode.removeChild(canvas);
    doc.classList.add('pl-ready');
    return;
  }

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  /* IGN dither — last statement of both fragment shaders */
  var DITHER =
    'float ign(vec2 v){return fract(52.9829189*fract(dot(v,vec2(0.06711056,0.00583715))));}\n';

  var FIELD_V = '#version 300 es\nlayout(location=0) in vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}';

  function fieldFsrc(octaves, warp, folds) {
    return [
      '#version 300 es',
      'precision mediump float;',
      'uniform vec2 uRes;uniform float uT;uniform sampler2D uN;',
      'uniform float uBloom;uniform float uBreath;uniform float uZoom;',
      'uniform vec2 uKdir[7];uniform float uKphi[7];',
      'uniform vec3 uWell;',            // cx, cy (gl coords), min(W,H)
      'uniform vec3 uA0;uniform vec3 uA1;uniform vec3 uA2;',  // aurora ladder
      'uniform vec3 uQcol;',            // mandala color
      'out vec4 O;',
      DITHER,
      'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);',
      ' return texture(uN,(i+f+0.5)/256.0).r;}',
      'float fbm(vec2 p){float a=0.5,s=0.0;',
      ' mat2 R=mat2(0.8253,0.5646,-0.5646,0.8253);',      // 0.6 rad
      ' for(int i=0;i<' + octaves + ';i++){s+=a*vn(p);p=R*p*2.0+11.7;a*=0.5;}return s;}',
      'void main(){',
      ' vec2 fc=gl_FragCoord.xy;',
      ' float mwh=uWell.z;',
      ' vec2 cp=(fc-uWell.xy)*uZoom;',
      ' float rho=length(fc-uWell.xy);',
      // luminance well: field dims to 18% inside the text plateau
      ' float ws=mix(0.18,1.0,smoothstep(0.22*mwh,0.34*mwh,rho));',
      // aurora
      ' vec2 p=fc*(3.0/mwh);',
      warp
        ? ' vec2 q=vec2(fbm(p+vec2(0.0,uT*0.010)),fbm(p+vec2(5.2,1.3)-uT*0.008));\n' +
          ' float m=fbm(p+1.5*q+vec2(0.0,-uT*0.006));'
        : ' float m=fbm(p+vec2(0.0,uT*0.008));vec2 q=vec2(m);',
      ' float m2=fbm(p*1.7-q+vec2(uT*0.005,0.0));',
      ' vec3 col=uA0;',
      ' col=mix(col,uA1,smoothstep(0.42,0.82,m)*0.70);',
      ' col+=uA2*smoothstep(0.62,0.95,m2)*0.45;',
      ' col*=uBreath;',
      // quasicrystal mandala — only constructive peaks glow
      ' float z=0.0;',
      ' for(int j=0;j<' + folds + ';j++){z+=cos(dot(uKdir[j],cp)+uKphi[j]);}',
      ' float zn=clamp(z/' + (folds === 7 ? '3.74' : '3.16') + ',-1.0,1.0);',
      ' float I=smoothstep(0.62,0.95,0.5+0.5*zn);',
      /* ring envelope: the mandala lives in the annulus around the text
         well, like the lamp bed around a machine's central screen */
      ' float rn=(rho-0.36*mwh)/(0.30*mwh);',
      ' float env=exp(-rn*rn);',
      ' col+=uQcol*(I*env*(0.22+0.55*uBloom));',
      ' col*=ws;',
      // vignette + black budget
      ' float vr=length((fc-0.5*uRes)/uRes.y);',
      ' col*=1.0-0.38*vr*vr;',
      ' col+=vec3((ign(fc)-0.5)/255.0);',
      ' O=vec4(col,1.0);}'
    ].join('\n');
  }

  var LAMP_V = [
    '#version 300 es',
    'layout(location=0) in vec4 aS;',   // x, y (css px), size (css px), well
    'layout(location=1) in vec2 aD;',   // L, theta
    'uniform vec2 uRes;uniform float uScale;',
    'out float vL;out float vTh;',
    'void main(){',
    ' vL=aD.x*aS.w;vTh=aD.y;',
    ' vec2 clip=(aS.xy*uScale)/uRes*2.0-1.0;',
    ' gl_Position=vec4(clip.x,-clip.y,0.,1.);',
    ' gl_PointSize=aS.z*uScale;}'
  ].join('\n');

  var LAMP_F = [
    '#version 300 es',
    'precision mediump float;',
    'in float vL;in float vTh;',
    'uniform vec3 uC0;uniform vec3 uC1;uniform float uIrid;',
    'out vec4 O;',
    DITHER,
    'void main(){',
    ' vec2 d2=gl_PointCoord-0.5;float d=length(d2)*2.0;',
    ' float core=exp(-d*d/0.2048);',                 // 2*0.32^2
    ' float halo=0.30*exp(-d/0.64);',
    ' float g=(core+halo)*vL;',
    ' vec3 col=mix(uC0,uC1,uIrid*(0.5+0.5*sin(vTh)));',
    ' col=min(col,vec3(0.949,0.910,0.835));',        // #f2e8d5 ceiling
    ' col*=g;',
    ' col+=vec3((ign(gl_FragCoord.xy)-0.5)/255.0);',
    ' O=vec4(col,g);}'                               // premultiplied additive
  ].join('\n');

  /* ---------------- palette (from CSS tokens where present) ------------ */

  function cssColor(name, fb) {
    var v = getComputedStyle(doc).getPropertyValue(name).trim();
    var m = /^#([0-9a-f]{6})$/i.exec(v || '');
    var h = m ? m[1] : fb;
    return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
  }
  var LADDER = [cssColor('--pl-indigo', '8e9ad7'), cssColor('--pl-teal', '48b7bd'), cssColor('--pl-gold', 'd3b460')];
  var AUR = [cssColor('--pl-aur0', '0b0e1a'), cssColor('--pl-aur1', '084150'), cssColor('--pl-aur2', '3f2551')];

  function rotHue(c, deg) {              // small-angle RGB hue rotation
    var a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    var m = 1 / 3, rt = Math.sqrt(1 / 3) * sn;
    var A = cs + (1 - cs) * m, B = m * (1 - cs) - rt, C = m * (1 - cs) + rt;
    return [
      c[0] * A + c[1] * B + c[2] * C,
      c[0] * C + c[1] * A + c[2] * B,
      c[0] * B + c[1] * C + c[2] * A
    ];
  }
  function mix3(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }
  function smoothstep(a, b, x) {
    var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  /* ---------------- geometry + oscillators ---------------- */

  var W = 0, H = 0, mwh = 0, pixelScale = 1;
  var N = 0, skip = HOLE;
  var lampX, lampY, lampRho, lampArm, lampRing, lampWell, lampSize;
  var theta, omega, alphaLat, kick, warm;
  var staticBuf, dynBuf;
  var maxPoint = 64;

  function buildLamps() {
    /* geometry only — never touches oscillator state */
    var mobile = W < MOBILE_W;
    var nSpiral = mobile ? 180 : N_SPIRAL;
    skip = mobile ? 16 : HOLE;
    N = nSpiral - skip;
    var Rout = 0.5 * Math.sqrt(W * W + H * H);
    var c = Rout / Math.sqrt(nSpiral);
    var cx = W * 0.5, cy = H * 0.46;
    lampX = new Float32Array(N); lampY = new Float32Array(N);
    lampRho = new Float32Array(N); lampArm = new Uint8Array(N);
    lampRing = new Uint8Array(N); lampWell = new Float32Array(N);
    lampSize = new Float32Array(N);
    var i, n, r, an;
    for (i = 0; i < N; i++) {
      n = i + skip;
      r = c * Math.sqrt(n + 0.5);
      an = n * GA;
      lampX[i] = cx + r * Math.cos(an);
      lampY[i] = cy + r * Math.sin(an);
      lampRho[i] = r;
      lampArm[i] = n % 13;
      lampRing[i] = n % 8;
      lampSize[i] = Math.max(28, Math.min(64, 1.5 * c));
      if (lampSize[i] * pixelScale > maxPoint) lampSize[i] = maxPoint / pixelScale;
      lampWell[i] = smoothstep(0.22 * mwh, 0.34 * mwh, Math.hypot(lampX[i] - cx, lampY[i] - cy));
      lampWell[i] = 0.10 + 0.90 * lampWell[i];
    }
  }

  var oscN = -1;
  function initOscillators() {
    /* deterministic from the day seed — identical however often it runs.
       Called once per lamp-count regime; a rung change or resize within
       a regime never resets phases (the parlor keeps its moment). */
    var s2 = stream(2), s3 = stream(3), s4 = stream(4);
    theta = new Float32Array(N); omega = new Float32Array(N);
    alphaLat = new Float32Array(N); kick = new Float32Array(N);
    warm = new Float32Array(N);
    var om = new Float32Array(N), i;
    for (i = 0; i < N; i++) {
      var u = 0.04 + 0.92 * (i + 0.5) / N;
      om[i] = OMEGA0 + GAMMA * Math.tan(Math.PI * (u - 0.5));
    }
    for (i = N - 1; i > 0; i--) {
      var j = (s2() * (i + 1)) | 0, tmp = om[i]; om[i] = om[j]; om[j] = tmp;
    }
    for (i = 0; i < N; i++) {
      omega[i] = om[i];
      theta[i] = s3() * 2 * Math.PI;
      alphaLat[i] = s4() * 2 * Math.PI;
    }
    oscN = N;
  }

  /* ---------------- choreography state ---------------- */

  var qphi0 = [], qdir = [], cometArm = [];
  (function () {
    var i;
    for (i = 0; i < 7; i++) qphi0.push(sQphi() * 2 * Math.PI);
    var pool = [];
    for (i = 0; i < 13; i++) pool.push(i);
    for (i = 0; i < 3; i++) cometArm.push(pool.splice((sQphi() * pool.length) | 0, 1)[0]);
  })();

  var cascades = [];   // {x, y, t0}
  var i0;
  for (i0 = 0; i0 < CASCADE_MAX; i0++) cascades.push({ x: 0, y: 0, t0: -1e9 });
  var sparkNext = 0, sparkLamp = new Int16Array(8), sparkT = new Float64Array(8), sparkHead = 0;
  (function () { var i; for (i = 0; i < 8; i++) sparkT[i] = -1e9; })();

  var ptrX = -1e5, ptrY = -1e5, ptrEnv = 0, ptrTarget = 0;

  /* K(t) tide: 90 trough / 40 rise / 50 climb / 25 crest / 28 release */
  function tideW(ts) {
    var t = ts % TIDE_S;
    if (t < 90) return -1;
    if (t < 130) return -1 + 1.2 * smoother((t - 90) / 40);
    if (t < 180) return 0.2 + 0.8 * smoother((t - 130) / 50);
    if (t < 205) return 1;
    return 1 - 2 * smoother((t - 205) / 28);
  }

  /* ---------------- GL objects ---------------- */

  var pField, pLamp, vao, lampVao, triBuf, sBuf, dBuf, noiseTex;
  var FU = {}, LU = {};
  var folds = 7, octaves = 4, warpOn = true;

  function initGL() {
    pField = program(FIELD_V, fieldFsrc(octaves, warpOn, folds));
    pLamp = program(LAMP_V, LAMP_F);
    ['uRes', 'uT', 'uN', 'uBloom', 'uBreath', 'uZoom', 'uKdir', 'uKphi', 'uWell', 'uA0', 'uA1', 'uA2', 'uQcol']
      .forEach(function (n) { FU[n] = gl.getUniformLocation(pField, n); });
    ['uRes', 'uScale', 'uC0', 'uC1', 'uIrid']
      .forEach(function (n) { LU[n] = gl.getUniformLocation(pLamp, n); });

    vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    triBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, triBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    lampVao = gl.createVertexArray();
    gl.bindVertexArray(lampVao);
    sBuf = gl.createBuffer();
    dBuf = gl.createBuffer();

    noiseTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    var bytes = new Uint8Array(256 * 256), i;
    var sn = stream(1);                       // stream 1, re-derived: stable
    for (i = 0; i < bytes.length; i++) bytes[i] = (sn() * 256) | 0;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 256, 0, gl.RED, gl.UNSIGNED_BYTE, bytes);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    var range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    maxPoint = range[1] || 64;
  }

  function uploadStatic() {
    staticBuf = new Float32Array(N * 4);
    dynBuf = new Float32Array(N * 2);
    var i;
    for (i = 0; i < N; i++) {
      staticBuf[i * 4] = lampX[i];
      staticBuf[i * 4 + 1] = lampY[i];
      staticBuf[i * 4 + 2] = lampSize[i];
      staticBuf[i * 4 + 3] = lampWell[i];
    }
    gl.bindVertexArray(lampVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, sBuf);
    gl.bufferData(gl.ARRAY_BUFFER, staticBuf, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, dBuf);
    gl.bufferData(gl.ARRAY_BUFFER, dynBuf, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8, 0);
  }

  var resLadder = 1;
  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    mwh = Math.min(W, H);
    var dprCap = W < MOBILE_W ? 1.25 : DPR_CAP;
    pixelScale = Math.min(window.devicePixelRatio || 1, dprCap) * resLadder;
    canvas.width = Math.round(W * pixelScale);
    canvas.height = Math.round(H * pixelScale);
    if (W < MOBILE_W && folds !== 5) { folds = 5; rebuildField(); }
    buildLamps();
    if (N !== oscN) initOscillators();
    uploadStatic();
  }

  function rebuildField() {
    pField = program(FIELD_V, fieldFsrc(octaves, warpOn, folds));
    ['uRes', 'uT', 'uN', 'uBloom', 'uBreath', 'uZoom', 'uKdir', 'uKphi', 'uWell', 'uA0', 'uA1', 'uA2', 'uQcol']
      .forEach(function (n) { FU[n] = gl.getUniformLocation(pField, n); });
  }

  /* ---------------- simulation ---------------- */

  var rDisp = 0.05, R = 0, PSI = 0;
  var acc = 0, lastT = -1;

  function stepKuramoto(dt, tScene) {
    acc += Math.min(dt, DT_CLAMP);
    var K = KC * (1.45 + 1.05 * tideW(tScene));
    while (acc >= SUBSTEP) {
      acc -= SUBSTEP;
      var sr = 0, si = 0, i;
      for (i = 0; i < N; i++) { sr += Math.cos(theta[i]); si += Math.sin(theta[i]); }
      R = Math.hypot(sr, si) / N;
      PSI = Math.atan2(si, sr);
      var sp = Math.sin(PSI), cp = Math.cos(PSI);
      for (i = 0; i < N; i++) {
        var Ki = K * (1 + 0.5 * warm[i] * ptrEnv) + kick[i];
        var st = Math.sin(theta[i]), ct = Math.cos(theta[i]);
        theta[i] += (omega[i] + Ki * R * (sp * ct - cp * st)) * SUBSTEP;
        if (theta[i] > 6.2832) theta[i] -= 6.2832;
        else if (theta[i] < 0) theta[i] += 6.2832;
        kick[i] *= 0.998;                 // exp(-gamma*h): ~17 s melt
      }
    }
    var a = 1 - Math.exp(-dt / EMA_TAU);
    rDisp += (R - rDisp) * a;
  }

  /* per-lamp luminance for frame at scene time t */
  function composeL(t, bloom, breath, dimmed) {
    var i, k;
    /* rosary ring chase */
    var rosCh = Math.floor(t / ROSARY_STEP_S) % 8;
    var rosF = (t / ROSARY_STEP_S) % 1;
    /* comets: position along arm in rho */
    var cometRho = [], cometTail = [];
    var Rout = 0.5 * Math.sqrt(W * W + H * H);
    for (k = 0; k < 3; k++) {
      var pr = (t / COMET_S[k]) % 1;
      cometRho.push(pr * (Rout + 200) - 100);
      cometTail.push(Rout / COMET_S[k] * 3);   // 3 s tail in px
    }
    for (i = 0; i < N; i++) {
      var b = 0.5 + 0.5 * Math.cos(theta[i]);
      b = b * b;
      var L = 0.06 + b * (0.20 + 0.20 * bloom);
      /* rosary (fades out as coherence takes over) */
      var dch = Math.abs(lampRing[i] - (rosCh + rosF));
      if (dch > 4) dch = 8 - dch;
      if (dch < 1.5) L += 0.12 * (1 - bloom) * Math.pow(Math.cos(Math.PI * dch / 3), 2);
      /* comets */
      for (k = 0; k < 3; k++) {
        if (lampArm[i] !== cometArm[k]) continue;
        var d = cometRho[k] - lampRho[i];
        if (d >= 0 && d < cometTail[k] * 4) L += 0.20 * Math.exp(-d / cometTail[k]);
        else if (d < 0 && d > -30) L += 0.20 * (1 + d / 30);
      }
      /* cascades */
      for (k = 0; k < CASCADE_MAX; k++) {
        var tc = t - cascades[k].t0;
        if (tc < 0 || tc > 8) continue;
        var rr = Math.hypot(lampX[i] - cascades[k].x, lampY[i] - cascades[k].y);
        var dd = rr - CASCADE_V * tc;
        var sg = dd > 0 ? 50 : 110;
        L += 0.35 * Math.sqrt(60 / (rr + 60)) * Math.exp(-dd * dd / (2 * sg * sg)) * Math.exp(-tc / 7);
        if (Math.abs(dd) < 120) kick[i] = Math.max(kick[i], 1.2 * KC);
      }
      /* sparkles */
      for (k = 0; k < 8; k++) {
        if (sparkLamp[k] !== i) continue;
        var ts = t - sparkT[k];
        if (ts < 0 || ts > 3) continue;
        var env = ts < 0.8 ? Math.pow(ts / 0.8, 3) : Math.pow(1 - (ts - 0.8) / 2.2, 5);
        L += 0.22 * env;
      }
      /* pointer warmth: brightness half of coupling effect */
      L *= 1 + 0.06 * warm[i] * ptrEnv;
      L *= breath * dimmed;
      if (L > LAMP_ADD_CAP) L = LAMP_ADD_CAP;
      dynBuf[i * 2] = L;
      dynBuf[i * 2 + 1] = theta[i];
    }
  }

  /* ---------------- render ---------------- */

  var hueDrift = 0;

  function render(tScene, bloom, breath) {
    var i;
    /* palette: ladder by rDisp, global +-25 deg drift over 377 s */
    hueDrift = 25 * Math.sin(2 * Math.PI * tScene / HUE_ROT_S);
    var lc = rDisp < 0.45
      ? mix3(LADDER[0], LADDER[1], smoothstep(0.20, 0.45, rDisp))
      : mix3(LADDER[1], LADDER[2], smoothstep(0.45, 0.65, rDisp));
    lc = rotHue(lc, hueDrift);
    var lc2 = rotHue(lc, 15);
    var aur1 = rotHue(AUR[1], hueDrift * 0.6);
    var aur2 = rotHue(AUR[2], hueDrift * 0.6);
    /* indigo -> gold avoids the olive midpoint a teal -> gold lerp hits */
    var qcol = rotHue(mix3(LADDER[0], [0.85, 0.66, 0.31], bloom), hueDrift);
    var irid = smoothstep(0.68, 0.75, rDisp);

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.BLEND);
    gl.useProgram(pField);
    gl.bindVertexArray(vao);
    gl.uniform2f(FU.uRes, canvas.width, canvas.height);
    gl.uniform1f(FU.uT, tScene);
    gl.uniform1f(FU.uBloom, bloom);
    gl.uniform1f(FU.uBreath, breath);
    gl.uniform1f(FU.uZoom, 1 / (1 + 0.03 * bloom));
    var kd = new Float32Array(14), kp = new Float32Array(7);
    var q = 2 * Math.PI / (120 * (mwh / 800)) / pixelScale;
    for (i = 0; i < 7; i++) {
      var an = Math.PI * i / 7;
      kd[i * 2] = Math.cos(an) * q;
      kd[i * 2 + 1] = Math.sin(an) * q;
      kp[i] = qphi0[i] + tScene * 2 * Math.PI / QC_DRIFT_S * (0.6 + 0.13 * i);
    }
    gl.uniform2fv(FU.uKdir, kd);
    gl.uniform1fv(FU.uKphi, kp);
    gl.uniform3f(FU.uWell, W * 0.5 * pixelScale, H * 0.54 * pixelScale, mwh * pixelScale);
    gl.uniform3fv(FU.uA0, AUR[0]);
    gl.uniform3fv(FU.uA1, aur1);
    gl.uniform3fv(FU.uA2, aur2);
    gl.uniform3fv(FU.uQcol, qcol);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(FU.uN, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(pLamp);
    gl.bindVertexArray(lampVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, dBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dynBuf);
    gl.uniform2f(LU.uRes, canvas.width, canvas.height);
    gl.uniform1f(LU.uScale, pixelScale);
    gl.uniform3fv(LU.uC0, lc);
    gl.uniform3fv(LU.uC1, lc2);
    gl.uniform1f(LU.uIrid, irid);
    gl.drawArrays(gl.POINTS, 0, N);
  }

  /* ---------------- benchmark ladder ---------------- */

  var bench = { deltas: [], period: 16.7, learned: false, window: [], cooldown: 0, rung: 0, cleanSince: 0, stepped: false };
  try { bench.rung = Math.min(4, parseInt(localStorage.getItem('pl-rung') || '0', 10) || 0); } catch (e) {}

  function applyRung() {
    resLadder = bench.rung >= 2 ? 0.5 : bench.rung === 1 ? 0.75 : 1;
    var wantOct = bench.rung >= 3 ? 3 : 4;
    var wantWarp = bench.rung < 3;
    if (wantOct !== octaves || wantWarp !== warpOn) {
      octaves = wantOct; warpOn = wantWarp;
      rebuildField();
    }
    fpsCapBench = bench.rung >= 4 ? 30 : 0;
    layout();
  }

  var fpsCapBench = 0;

  function benchTick(delta, tms) {
    if (!bench.learned) {
      bench.deltas.push(delta);
      if (bench.deltas.length >= 20) {
        bench.deltas.sort(function (a, b) { return a - b; });
        bench.period = Math.max(4, Math.min(50, bench.deltas[10]));
        bench.learned = true;
      }
      return;
    }
    bench.window.push(delta > 1.6 * bench.period ? 1 : 0);
    if (bench.window.length > 120) bench.window.shift();
    if (tms < bench.cooldown || bench.window.length < 120) return;
    var jank = bench.window.reduce(function (a, b) { return a + b; }, 0) / 120;
    if (jank > 0.2 && bench.rung < 4) {
      bench.rung++;
      bench.cleanSince = 0;
      applyRung();
      try { localStorage.setItem('pl-rung', String(bench.rung)); } catch (e) {}
      bench.window.length = 0;
      bench.cooldown = tms + 5000;
    } else if (jank < 0.05) {
      if (!bench.cleanSince) bench.cleanSince = tms;
      if (tms - bench.cleanSince > 60000 && bench.rung > 0 && !bench.stepped) {
        bench.rung--; bench.stepped = true;
        applyRung();
        try { localStorage.setItem('pl-rung', String(bench.rung)); } catch (e) {}
        bench.window.length = 0;
        bench.cooldown = tms + 5000;
      }
    } else bench.cleanSince = 0;
  }

  /* ---------------- main loop + lifecycle ---------------- */

  var raf = 0, paused = false, hiddenAt = 0, pauseShiftMs = 0;
  var clock0 = 0;                    // rAF ms at scene start
  var lastInput = 0, idleDim = 1, blurCap = 0;
  var nextFrameAt = 0;

  function sceneTime(tms) { return midnightS + (tms - clock0 - pauseShiftMs) / 1000; }

  function frame(tms) {
    raf = 0;
    if (!clock0) clock0 = tms;
    var fpsCap = Math.max(fpsCapBench, blurCap, idleDim < 1 ? 30 : 0);
    if (fpsCap && tms < nextFrameAt) { raf = requestAnimationFrame(frame); return; }
    if (fpsCap) nextFrameAt = Math.max(nextFrameAt + 1000 / fpsCap, tms);
    var dt = lastT < 0 ? 0.016 : (tms - lastT) / 1000;
    var delta = lastT < 0 ? 16.7 : tms - lastT;
    lastT = tms;
    var t = sceneTime(tms);

    /* idle dim: ease toward 0.6 after 3 min without input, back over 2 s */
    var idleTarget = (tms - lastInput > IDLE_DIM_S * 1000) ? 0.6 : 1;
    idleDim += (idleTarget - idleDim) * Math.min(1, dt / 2);
    ptrEnv += (ptrTarget - ptrEnv) * Math.min(1, dt / 1.5);

    stepKuramoto(dt, t);
    var bloom = smoother(smoothstep(0.10, 0.75, rDisp)) * idleDim;
    var breath = 1 + 0.18 * 0.5 * (1 - Math.cos(2 * Math.PI * t / BREATH_S));
    /* sparkle scheduling (deterministic next-event) */
    if (t >= sparkNext) {
      var lam = 1.2 * (1 - rDisp);
      sparkNext = t + (-Math.log(Math.max(1e-6, sSpark())) / Math.max(0.05, lam));
      sparkLamp[sparkHead] = (sSpark() * N) | 0;
      sparkT[sparkHead] = t;
      sparkHead = (sparkHead + 1) & 7;
    }
    composeL(t, bloom, breath, idleDim);
    /* pointer warmth falloff (updated on move; cheap refresh here) */
    render(t, bloom, breath);
    benchTick(delta, tms);
    if (!paused && !document.hidden) raf = requestAnimationFrame(frame);
  }

  function start() { if (!raf && !paused && !document.hidden && !mqReduce.matches) { lastT = -1; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  /* one analytically converged frame: Ott–Antonsen Möbius map, r=0.707 */
  function stillFrame() {
    var z = 0.707, i;
    for (i = 0; i < N; i++) {
      var ca = Math.cos(alphaLat[i]), sa = Math.sin(alphaLat[i]);
      /* e^{i th} = (z + e^{ia}) / (1 + z e^{ia}), z real */
      var nr = z + ca, ni = sa;
      var dr = 1 + z * ca, di = z * sa;
      var den = dr * dr + di * di;
      theta[i] = Math.atan2((ni * dr - nr * di) / den, (nr * dr + ni * di) / den);
      if (theta[i] < 0) theta[i] += 6.2832;
    }
    R = z; rDisp = z;
    var t = midnightS;
    composeL(t, smoother(smoothstep(0.10, 0.75, z)), 1, 1);
    render(t, smoother(smoothstep(0.10, 0.75, z)), 1);
  }

  /* ---------------- events ---------------- */

  function markInput() { lastInput = performance.now(); }

  document.addEventListener('pointermove', function (e) {
    markInput();
    if (paused || mqReduce.matches) return;
    ptrX = e.clientX; ptrY = e.clientY; ptrTarget = 1;
    var i;
    for (i = 0; i < N; i++) {
      var d2 = (lampX[i] - ptrX) * (lampX[i] - ptrX) + (lampY[i] - ptrY) * (lampY[i] - ptrY);
      warm[i] = Math.exp(-d2 / (2 * POINTER_SIGMA * POINTER_SIGMA));
    }
  }, { passive: true });
  document.addEventListener('pointerleave', function () { ptrTarget = 0; });

  var lastClick = 0;
  document.addEventListener('click', function (e) {
    markInput();
    if (paused || mqReduce.matches || !raf && document.hidden) return;
    if (e.target.closest('a, button')) return;
    var now = performance.now();
    if (now - lastClick < CLICK_MIN_MS) return;
    lastClick = now;
    /* refresh the oldest slot */
    var k = 0, i;
    for (i = 1; i < CASCADE_MAX; i++) if (cascades[i].t0 < cascades[k].t0) k = i;
    cascades[k].x = e.clientX;
    cascades[k].y = e.clientY;
    cascades[k].t0 = sceneTime(now);
    start();
  });

  document.addEventListener('keydown', markInput, { passive: true });
  document.addEventListener('scroll', markInput, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hiddenAt = performance.now(); stop(); }
    else if (!paused && !mqReduce.matches) {
      if (hiddenAt) { pauseShiftMs += performance.now() - hiddenAt; hiddenAt = 0; }
      start();
    }
  });
  window.addEventListener('blur', function () { blurCap = 30; });
  window.addEventListener('focus', function () { blurCap = 0; markInput(); });

  var pausedAtMs = 0;
  function setPaused(p) {
    paused = p;
    if (pauseBtn) pauseBtn.textContent = p ? 'Play motion' : 'Pause motion';
    try { localStorage.setItem('pl-paused', p ? '1' : ''); } catch (e) {}
    if (p) { pausedAtMs = performance.now(); stop(); }
    else {
      if (pausedAtMs) { pauseShiftMs += performance.now() - pausedAtMs; pausedAtMs = 0; }
      start();
    }
  }
  if (pauseBtn) pauseBtn.addEventListener('click', function () { setPaused(!paused); });

  var rsTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rsTimer);
    rsTimer = setTimeout(function () {
      layout();
      if (paused || mqReduce.matches) {
        if (mqReduce.matches) stillFrame();
        else { composeL(sceneTime(performance.now()), 0.3, 1, 1); render(sceneTime(performance.now()), 0.3, 1); }
      }
    }, 150);
  });

  listenMq(mqReduce, function () {
    if (mqReduce.matches) {
      stop();
      if (pauseBtn) pauseBtn.classList.remove('pl-show');
      layout();
      stillFrame();
    } else {
      if (pauseBtn) pauseBtn.classList.add('pl-show');
      layout();
      if (!paused) start();
    }
  });

  canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); stop(); }, false);
  canvas.addEventListener('webglcontextrestored', function () {
    initGL();
    applyRung();
    if (mqReduce.matches) stillFrame(); else start();
  }, false);

  /* ---------------- boot ---------------- */

  try { paused = localStorage.getItem('pl-paused') === '1'; } catch (e) {}
  if (pauseBtn && paused) pauseBtn.textContent = 'Play motion';

  /* GL init waits for the first frame after paint: shader compilation is
     synchronous and must never sit between the parser and first text. */
  requestAnimationFrame(function () {
    initGL();
    applyRung();
    markInput();

    if (mqReduce.matches) {
      stillFrame();
    } else {
      if (pauseBtn) pauseBtn.classList.add('pl-show');
      if (paused) {
        stillFrame();                        // paused-at-load: one converged frame
      } else {
        start();
      }
    }
    doc.classList.add('pl-ready');           // canvas fade-up gates on this
  });
})();
