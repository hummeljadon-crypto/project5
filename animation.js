(() => {
  "use strict";

  const canvas = document.querySelector("#scene");
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const intro = document.querySelector("#intro");
  const startButton = document.querySelector("#startButton");
  const playPauseButton = document.querySelector("#playPauseButton");
  const restartButton = document.querySelector("#restartButton");
  const timeline = document.querySelector("#timeline");
  const timeReadout = document.querySelector("#timeReadout");

  const VIEW = { w: 1080, h: 1920 };
  const TOTAL = 192;

  const BEATS = {
    surface: [0, 6],
    kissCrack: [6, 12],
    descent: [12, 90],
    bottomApproach: [90, 98],
    bottomFracture: [98, 105],
    bottomShatter: [105, 112],
    blackout: [112, 117],
    fish: [117, 126],
    whaleReveal: [126, 137],
    whaleApproach: [137, 149],
    eye: [149, 155],
    cosmos: [155, 165],
    earth: [165, 173],
    earthDive: [173, 178],
    return: [178, 186],
    final: [186, 192],
  };

  const PHRASE_TEXT = [
    "always love you",
    "swear",
    "not scared",
    "only when youre not here",
    "this",
    "F O R E V E R",
    "only youuu",
    "us",
    "you my home",
    "fixxing everything in me",
    "a seed",
    "f o r e v e r",
    "do i make myself clear",
    "this for life",
    "soul to keep",
    "one day  a baby",
    "my baby",
    "crazy...",
    "for your loveeee",
    "a blessin from above",
    "to fall in love",
    "is to take risk",
    "im not scared",
    "always loveee youu",
  ];

  const PHRASE_STYLES = [
    "mist", "small", "fracture", "deep", "small", "hero",
    "mist", "small", "home", "deep", "seed", "mist",
    "fracture", "deep", "mist", "deep", "small", "fracture",
    "mist", "deep", "mist", "fracture", "deep", "hero",
  ];

  const DESCENT_START = BEATS.descent[0];
  const DESCENT_END = BEATS.descent[1];
  const PHRASE_SLOT = (DESCENT_END - DESCENT_START) / PHRASE_TEXT.length;
  const PHRASES = PHRASE_TEXT.map((text, index) => {
    const start = DESCENT_START + index * PHRASE_SLOT + 0.26;
    const duration = PHRASE_STYLES[index] === "hero" ? 3.4 : 2.65;
    return {
      text,
      style: PHRASE_STYLES[index],
      start,
      end: Math.min(start + duration, DESCENT_END - 0.2),
      index,
    };
  });

  const LIBRARY_TIME = DESCENT_START + PHRASE_SLOT * 8.1;
  const LIBRARY_DURATION = 1.15;
  const SEED_TIME = DESCENT_START + PHRASE_SLOT * 10.1;

  const state = {
    time: 0,
    playing: false,
    last: 0,
    raf: 0,
    cssW: 0,
    cssH: 0,
    dpr: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const inv = (a, b, v) => clamp((v - a) / (b - a));
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeIn = (t) => t ** 3;
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const easeInOut = (t) => t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2;
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };

  function active(name) {
    const [a, b] = BEATS[name];
    return state.time >= a && state.time <= b;
  }

  function beat(name) {
    const [a, b] = BEATS[name];
    return inv(a, b, state.time);
  }

  function rgba(rgb, a = 1) {
    return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
  }

  function mix(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.cssW = Math.max(1, rect.width);
    state.cssH = Math.max(1, rect.height);
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.cssW * state.dpr);
    canvas.height = Math.round(state.cssH * state.dpr);
    state.scale = Math.max(state.cssW / VIEW.w, state.cssH / VIEW.h);
    state.offsetX = (state.cssW - VIEW.w * state.scale) * 0.5;
    state.offsetY = (state.cssH - VIEW.h * state.scale) * 0.5;
    render();
  }

  function beginVirtual() {
    ctx.setTransform(
      state.dpr * state.scale,
      0,
      0,
      state.dpr * state.scale,
      state.dpr * state.offsetX,
      state.dpr * state.offsetY
    );
  }

  function updateUI() {
    timeline.max = TOTAL;
    timeline.value = state.time.toFixed(2);
    timeline.style.setProperty("--progress", `${(state.time / TOTAL) * 100}%`);
    timeReadout.textContent = `${fmt(state.time)} / ${fmt(TOTAL)}`;
    playPauseButton.textContent = state.playing ? "Pause" : "Play";
  }

  function play() {
    if (state.playing) return;
    state.playing = true;
    state.last = performance.now();
    updateUI();
    state.raf = requestAnimationFrame(tick);
  }

  function pause() {
    state.playing = false;
    cancelAnimationFrame(state.raf);
    updateUI();
  }

  function tick(now) {
    if (!state.playing) return;
    const dt = Math.min((now - state.last) / 1000, 0.05);
    state.last = now;
    state.time += dt;
    if (state.time >= TOTAL) {
      state.time = TOTAL;
      pause();
    }
    updateUI();
    render();
    if (state.playing) state.raf = requestAnimationFrame(tick);
  }

  function fillGradient(top, bottom) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  function drawVignette(strength = 0.42) {
    const g = ctx.createRadialGradient(VIEW.w * 0.5, VIEW.h * 0.48, 180, VIEW.w * 0.5, VIEW.h * 0.5, 930);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  function drawSnow(count = 90, speed = 1, alpha = 0.7) {
    ctx.save();
    for (let i = 0; i < count; i++) {
      const x = (hash(i * 2.1) * VIEW.w + Math.sin(state.time * 0.4 + i) * 20) % VIEW.w;
      const y = (hash(i * 7.7) * VIEW.h + state.time * (10 + hash(i + 9) * 25) * speed) % VIEW.h;
      const r = 1 + hash(i + 12) * 3;
      ctx.globalAlpha = alpha * (0.3 + hash(i + 4) * 0.7);
      ctx.fillStyle = "#f6fbff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAurora(alpha = 0.18) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      for (let x = -40; x <= VIEW.w + 40; x += 18) {
        const nx = x / VIEW.w;
        const y = 170 + band * 72 + Math.sin(nx * 6.2 + state.time * 0.16 + band) * 54 + Math.sin(nx * 12 + band) * 16;
        if (x === -40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 45 - band * 10;
      ctx.strokeStyle = band === 1 ? `rgba(144,255,227,${alpha})` : `rgba(126,199,255,${alpha * 0.82})`;
      ctx.shadowBlur = 45;
      ctx.shadowColor = ctx.strokeStyle;
      ctx.stroke();
    }

    // D easter egg
    ctx.globalAlpha = alpha * 0.32;
    ctx.lineWidth = 12;
    ctx.strokeStyle = "rgba(230,249,255,0.65)";
    ctx.beginPath();
    ctx.moveTo(810, 122);
    ctx.lineTo(810, 218);
    ctx.bezierCurveTo(900, 218, 900, 122, 810, 122);
    ctx.stroke();
    ctx.restore();
  }

  function drawSnowField(horizon = 1220) {
    const g = ctx.createLinearGradient(0, horizon - 80, 0, VIEW.h);
    g.addColorStop(0, "#dceef8");
    g.addColorStop(0.55, "#f6fbff");
    g.addColorStop(1, "#d9eaf4");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, VIEW.h);
    ctx.lineTo(0, horizon + 25);
    ctx.quadraticCurveTo(230, horizon - 38, 520, horizon + 8);
    ctx.quadraticCurveTo(820, horizon + 48, VIEW.w, horizon - 18);
    ctx.lineTo(VIEW.w, VIEW.h);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.strokeStyle = "rgba(118,157,182,0.16)";
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i++) {
      const y = horizon + 70 + i * 66;
      ctx.beginPath();
      ctx.moveTo(-30, y);
      ctx.bezierCurveTo(260, y - 30, 720, y + 35, VIEW.w + 40, y - 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPenguin(x, y, scale, facing = 1, lean = 0, cuddle = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * facing, scale);
    ctx.rotate(lean);

    ctx.fillStyle = "rgba(20,28,36,0.19)";
    ctx.beginPath();
    ctx.ellipse(0, 80, 54, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d59d3a";
    ctx.beginPath();
    ctx.ellipse(-18, 67, 17, 8, -0.08, 0, Math.PI * 2);
    ctx.ellipse(18, 67, 17, 8, 0.08, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(-38, -25, 42, 65);
    body.addColorStop(0, "#26313d");
    body.addColorStop(0.5, "#111821");
    body.addColorStop(1, "#050a10");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 8, 52, 76, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#edf6fb";
    ctx.beginPath();
    ctx.ellipse(8, 18, 34, 53, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111821";
    ctx.beginPath();
    ctx.arc(2, -62, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f4f8fb";
    ctx.beginPath();
    ctx.ellipse(14, -55, 24, 30, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0c1118";
    ctx.beginPath();
    ctx.arc(25, -65, 4.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d89f3e";
    ctx.beginPath();
    ctx.moveTo(32, -51);
    ctx.lineTo(61, -43);
    ctx.lineTo(31, -34);
    ctx.closePath();
    ctx.fill();

    // flipper, moved inward during cuddle
    ctx.fillStyle = "#0b1118";
    ctx.beginPath();
    ctx.ellipse(-43 + cuddle * 21, 8, 15, 45, -0.25 + cuddle * 0.18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawSurfaceScene() {
    fillGradient("#071325", "#9cc8df");
    drawAurora(0.17);
    drawSnow(95, 0.9, 0.72);
    drawSnowField(1220);

    const kissP = beat("kissCrack");
    const slow = smooth(inv(0.05, 0.65, kissP));
    const leftX = lerp(395, 494, slow);
    const rightX = lerp(685, 586, slow);
    const y = 1190;

    drawPenguin(leftX, y, 1.12, 1, lerp(0, 0.12, slow));
    drawPenguin(rightX, y, 1.12, -1, lerp(0, -0.12, slow));

    if (kissP > 0.22) {
      drawOpeningCrack(inv(0.22, 1, kissP));
    }

    if (kissP > 0.38) {
      const a = Math.sin(inv(0.38, 1, kissP) * Math.PI) * 0.34;
      const g = ctx.createRadialGradient(540, 1098, 0, 540, 1098, 180);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(300, 860, 480, 470);
    }

    drawVignette(0.34);
  }

  function drawOpeningCrack(p) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const head = easeOut(p);
    const startX = 540;
    const startY = 1236;
    const points = [
      [startX, startY],
      [516, 1288],
      [548, 1342],
      [505, 1402],
      [544, 1468],
      [486, 1535],
      [521, 1605],
    ];
    const visible = Math.max(1, Math.floor(head * (points.length - 1)) + 1);

    ctx.shadowBlur = 24;
    ctx.shadowColor = "rgba(154,226,255,0.65)";
    ctx.strokeStyle = "rgba(105,176,216,0.9)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < visible; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (visible < points.length) {
      const a = points[visible - 1];
      const b = points[visible];
      const local = head * (points.length - 1) - (visible - 1);
      ctx.lineTo(lerp(a[0], b[0], local), lerp(a[1], b[1], local));
    }
    ctx.stroke();

    // secondary fractures and hidden date shape
    ctx.globalAlpha = clamp(p * 1.8);
    ctx.lineWidth = 2.2;
    const branches = [
      [[531, 1320], [462, 1300], [417, 1328]],
      [[526, 1419], [610, 1390], [651, 1421]],
      [[505, 1517], [423, 1502], [378, 1536]],
    ];
    for (const branch of branches) {
      ctx.beginPath();
      ctx.moveTo(branch[0][0], branch[0][1]);
      ctx.lineTo(branch[1][0], branch[1][1]);
      ctx.lineTo(branch[2][0], branch[2][1]);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.13 * p;
    ctx.fillStyle = "#dff5ff";
    ctx.font = "22px Georgia, serif";
    ctx.fillText("17·03·2026", 574, 1445);
    ctx.restore();
  }

  function drawCrackTransition() {
    // Cross-section reveal: keep surface and penguins above while the camera lowers.
    const p = beat("kissCrack");
    drawSurfaceScene();
    if (p < 0.58) return;

    const reveal = smooth(inv(0.58, 1, p));
    ctx.save();
    const top = lerp(VIEW.h + 40, 760, reveal);
    const iceGradient = ctx.createLinearGradient(0, top, 0, VIEW.h);
    iceGradient.addColorStop(0, "rgba(212,243,255,0.96)");
    iceGradient.addColorStop(0.38, "rgba(126,208,243,0.98)");
    iceGradient.addColorStop(1, "rgba(28,96,154,1)");
    ctx.fillStyle = iceGradient;
    ctx.fillRect(0, top, VIEW.w, VIEW.h - top);

    for (let i = 0; i < 10; i++) {
      const y = top + 35 + i * 90;
      ctx.strokeStyle = `rgba(236,250,255,${0.18 - i * 0.01})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.bezierCurveTo(270, y - 28, 700, y + 30, VIEW.w + 40, y - 5);
      ctx.stroke();
    }

    // Continue the same crack into the revealed iceberg.
    const crackTop = top - 5;
    ctx.strokeStyle = "rgba(140,218,255,0.86)";
    ctx.shadowBlur = 22;
    ctx.shadowColor = "rgba(116,210,255,0.6)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(540, crackTop);
    ctx.lineTo(510, crackTop + 145);
    ctx.lineTo(564, crackTop + 298);
    ctx.lineTo(498, crackTop + 462);
    ctx.lineTo(548, crackTop + 620);
    ctx.lineTo(495, crackTop + 810);
    ctx.stroke();
    ctx.restore();
  }

  function icePalette(depth) {
    const stops = [
      [0.00, [232, 249, 255]],
      [0.18, [187, 235, 252]],
      [0.38, [104, 201, 239]],
      [0.58, [47, 129, 196]],
      [0.78, [15, 60, 124]],
      [1.00, [3, 18, 48]],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      const [pa, ca] = stops[i];
      const [pb, cb] = stops[i + 1];
      if (depth <= pb) return mix(ca, cb, inv(pa, pb, depth));
    }
    return stops.at(-1)[1];
  }

  function descentDepth() {
    return smooth(inv(DESCENT_START, DESCENT_END, state.time));
  }

  function cameraWorldY() {
    const p = descentDepth();
    const drift = Math.sin(p * Math.PI * 7) * 170 + Math.sin(p * Math.PI * 15) * 55;
    return p * 11800 + drift;
  }

  function drawIceFace() {
    const depth = descentDepth();
    const camY = cameraWorldY();
    const base = icePalette(depth);
    const darker = mix(base, [0, 7, 24], 0.42 + depth * 0.2);
    fillGradient(rgba(mix(base, [255, 255, 255], 0.1), 1), rgba(darker, 1));

    // broad, solid glacial bands filling the entire frame
    const bandH = 330;
    const firstBand = Math.floor((camY - 1200) / bandH);
    for (let i = firstBand; i < firstBand + 11; i++) {
      const worldY = i * bandH;
      const sy = worldY - camY + 480;
      const localDepth = clamp(depth + (sy - VIEW.h * 0.5) / 9000, 0, 1);
      const bandBase = icePalette(localDepth);
      const tint = hash(i * 1.41);
      const fill = mix(bandBase, tint > 0.55 ? [255, 255, 255] : [3, 21, 55], tint > 0.55 ? 0.08 : 0.12);

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-80, sy - 80);
      for (let x = -80; x <= VIEW.w + 80; x += 120) {
        const wobble = (hash(i * 21 + x * 0.03) - 0.5) * 64;
        ctx.lineTo(x, sy + wobble);
      }
      for (let x = VIEW.w + 80; x >= -80; x -= 120) {
        const wobble = (hash(i * 39 + x * 0.05) - 0.5) * 55;
        ctx.lineTo(x, sy + bandH + wobble);
      }
      ctx.closePath();
      ctx.fillStyle = rgba(fill, 0.93);
      ctx.fill();

      const edge = ctx.createLinearGradient(0, sy, 0, sy + bandH);
      edge.addColorStop(0, "rgba(255,255,255,0.14)");
      edge.addColorStop(0.18, "rgba(255,255,255,0.02)");
      edge.addColorStop(1, `rgba(0,17,52,${0.1 + localDepth * 0.22})`);
      ctx.fillStyle = edge;
      ctx.fill();
      ctx.restore();
    }

    // solid facets and depth planes
    for (let i = 0; i < 28; i++) {
      const worldY = Math.floor((camY - 1400) / 460) * 460 + i * 430;
      const sy = worldY - camY + 260;
      const x = hash(i * 9.7 + Math.floor(camY / 460)) * 930 - 80;
      const w = 160 + hash(i * 4.3) * 380;
      const h = 180 + hash(i * 2.9) * 390;
      const skew = (hash(i + 88) - 0.5) * 130;
      const light = hash(i + 100) > 0.5;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, sy);
      ctx.lineTo(x + w, sy + skew * 0.25);
      ctx.lineTo(x + w * 0.82, sy + h);
      ctx.lineTo(x - w * 0.08, sy + h + skew * 0.35);
      ctx.closePath();
      ctx.fillStyle = light
        ? `rgba(229,248,255,${0.045 + (1 - depth) * 0.05})`
        : `rgba(2,24,62,${0.08 + depth * 0.1})`;
      ctx.fill();
      ctx.strokeStyle = light ? "rgba(248,254,255,0.08)" : "rgba(14,52,101,0.12)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }

    // old compressed layers and trapped bubbles
    ctx.save();
    for (let i = 0; i < 18; i++) {
      const y = ((i * 127 - camY * (0.72 + (i % 3) * 0.09)) % (VIEW.h + 280) + VIEW.h + 280) % (VIEW.h + 280) - 140;
      ctx.strokeStyle = `rgba(237,250,255,${0.05 + (1 - depth) * 0.09})`;
      ctx.lineWidth = 2 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(-70, y);
      ctx.bezierCurveTo(270, y - 34, 750, y + 35, VIEW.w + 70, y - 12);
      ctx.stroke();
    }
    for (let i = 0; i < 60; i++) {
      const x = hash(i * 7.31) * VIEW.w;
      const y = ((hash(i * 13.2) * 12500 - camY * (0.88 + hash(i) * 0.18)) % (VIEW.h + 100) + VIEW.h + 100) % (VIEW.h + 100) - 50;
      const r = 2 + hash(i + 90) * 7;
      ctx.globalAlpha = lerp(0.24, 0.04, depth) * (0.5 + hash(i + 5));
      ctx.strokeStyle = "#effbff";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    drawHuntingCracks(depth, camY);
    drawLibraryFlash();
    drawSeedPulse();
    drawCurrentPhrase();
    drawVignette(0.26 + depth * 0.36);
  }

  function crackChaseAmount() {
    const p = descentDepth();
    const wave = Math.sin(p * Math.PI * 9 - 0.8) * 0.5 + 0.5;
    const bursts = smooth(inv(0.05, 0.18, p)) * (1 - smooth(inv(0.88, 0.98, p)));
    return clamp(0.18 + wave * 0.8 * bursts);
  }

  function drawHuntingCracks(depth, camY) {
    const chase = crackChaseAmount();
    const headY = lerp(-260, VIEW.h * 0.78, chase);
    const xBase = 520 + Math.sin(state.time * 0.62) * 150 + Math.sin(state.time * 0.19) * 70;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowBlur = 30 + chase * 28;
    ctx.shadowColor = "rgba(122,218,255,0.75)";
    ctx.strokeStyle = `rgba(171,232,255,${0.35 + chase * 0.58})`;
    ctx.lineWidth = 4.5 + chase * 3;

    ctx.beginPath();
    ctx.moveTo(xBase - 110, -80);
    const steps = 13;
    for (let i = 1; i <= steps; i++) {
      const y = lerp(-80, headY, i / steps);
      const x = xBase + Math.sin(i * 1.37 + state.time * 1.08) * (42 + i * 6) + (hash(i + Math.floor(camY / 500)) - 0.5) * 55;
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Branches actually cross the camera path and appear to overtake us.
    for (let b = 0; b < 5; b++) {
      const by = lerp(-40, headY, (b + 2) / 7);
      const dir = b % 2 === 0 ? -1 : 1;
      const bx = xBase + Math.sin(b * 2 + state.time) * 80;
      ctx.lineWidth = 2.1 + chase * 2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + dir * (120 + chase * 130), by + 70);
      ctx.lineTo(bx + dir * (190 + chase * 180), by + 15);
      ctx.stroke();
    }

    if (chase > 0.72) {
      const flash = (chase - 0.72) / 0.28;
      const g = ctx.createRadialGradient(xBase, headY, 0, xBase, headY, 260);
      g.addColorStop(0, `rgba(221,249,255,${flash * 0.42})`);
      g.addColorStop(1, "rgba(221,249,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(xBase - 300, headY - 300, 600, 600);
    }
    ctx.restore();
  }

  function drawLibraryFlash() {
    const p = inv(LIBRARY_TIME, LIBRARY_TIME + LIBRARY_DURATION, state.time);
    if (p <= 0 || p >= 1) return;
    const alpha = Math.sin(p * Math.PI);
    const slide = lerp(220, -180, easeInOut(p));

    ctx.save();
    ctx.globalAlpha = alpha * 0.96;
    ctx.translate(slide, 0);

    const g = ctx.createRadialGradient(600, 910, 40, 600, 910, 430);
    g.addColorStop(0, "rgba(159,209,235,0.25)");
    g.addColorStop(0.55, "rgba(8,24,47,0.65)");
    g.addColorStop(1, "rgba(0,4,12,0)");
    ctx.fillStyle = g;
    ctx.fillRect(170, 420, 860, 980);

    // arch
    ctx.strokeStyle = "rgba(197,229,246,0.35)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(275, 1360);
    ctx.lineTo(275, 760);
    ctx.quadraticCurveTo(600, 430, 930, 760);
    ctx.lineTo(930, 1360);
    ctx.stroke();

    for (let shelf = 0; shelf < 4; shelf++) {
      const x = 330 + shelf * 150;
      ctx.fillStyle = "rgba(17,24,35,0.88)";
      ctx.fillRect(x, 650, 110, 630);
      for (let row = 0; row < 7; row++) {
        const y = 700 + row * 80;
        ctx.fillStyle = "rgba(210,231,241,0.12)";
        ctx.fillRect(x + 8, y, 94, 4);
        for (let book = 0; book < 5; book++) {
          const h = 22 + hash(shelf * 30 + row * 7 + book) * 45;
          ctx.fillStyle = `rgba(${50 + book * 16},${70 + row * 6},${96 + shelf * 10},0.78)`;
          ctx.fillRect(x + 12 + book * 17, y - h, 12, h);
        }
      }
    }

    // Tiny llamas together on a shelf.
    drawTinyLlama(531, 1054, 0.95);
    drawTinyLlama(563, 1058, 0.95);

    ctx.fillStyle = "rgba(238,248,255,0.45)";
    ctx.font = "bold 24px Georgia, serif";
    ctx.fillText("D", 760, 802);

    // pages suspended in ice
    for (let i = 0; i < 8; i++) {
      const x = 300 + hash(i + 6) * 650;
      const y = 610 + hash(i + 26) * 660;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((hash(i + 80) - 0.5) * 1.5);
      ctx.fillStyle = "rgba(241,248,255,0.24)";
      ctx.fillRect(-16, -10, 32, 20);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawTinyLlama(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(230,238,244,0.92)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(10, -23, 8, 23);
    ctx.beginPath();
    ctx.ellipse(18, -24, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-11, 8, 4, 16);
    ctx.fillRect(5, 8, 4, 16);
    ctx.beginPath();
    ctx.moveTo(14, -30);
    ctx.lineTo(16, -40);
    ctx.lineTo(20, -30);
    ctx.fill();
    ctx.restore();
  }

  function drawSeedPulse() {
    const p = inv(SEED_TIME - 0.4, SEED_TIME + 3.2, state.time);
    if (p <= 0 || p >= 1) return;
    const pulseCount = 8;
    const phase = p * pulseCount;
    const pulse = Math.sin((phase % 1) * Math.PI);
    const x = 720;
    const y = 1130;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 130 + pulse * 65);
    g.addColorStop(0, `rgba(244,255,198,${0.95})`);
    g.addColorStop(0.2, `rgba(177,255,188,${0.44 + pulse * 0.24})`);
    g.addColorStop(1, "rgba(91,230,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(x - 220, y - 220, 440, 440);
    ctx.fillStyle = "rgba(247,255,217,0.98)";
    ctx.beginPath();
    ctx.ellipse(x, y, 10 + pulse * 3, 22 + pulse * 5, 0.15, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawCurrentPhrase() {
    const phrase = PHRASES.find((item) => state.time >= item.start && state.time <= item.end);
    if (!phrase) return;
    const p = inv(phrase.start, phrase.end, state.time);
    const alpha = Math.sin(p * Math.PI);
    const depth = descentDepth();
    const xBase = 540 + Math.sin((phrase.index + 1) * 1.9) * 210;
    const yBase = 760 + Math.cos((phrase.index + 1) * 1.47) * 310;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(172,232,255,0.48)";

    let fontSize = 48;
    let letter = 0;
    if (phrase.style === "hero") {
      fontSize = 72;
      letter = 8;
    } else if (phrase.style === "small") {
      fontSize = 38;
    } else if (phrase.style === "deep") {
      fontSize = 50;
    }

    ctx.font = `${phrase.style === "hero" ? "600" : "400"} ${fontSize}px Georgia, serif`;
    ctx.fillStyle = `rgba(235,249,255,${0.72 + (1 - depth) * 0.22})`;

    if (phrase.style === "fracture") {
      const split = 10 + Math.sin(p * Math.PI) * 22;
      const half = Math.ceil(phrase.text.length / 2);
      ctx.textAlign = "right";
      ctx.fillText(phrase.text.slice(0, half), xBase - split, yBase);
      ctx.textAlign = "left";
      ctx.fillText(phrase.text.slice(half), xBase + split, yBase + 8);
      ctx.strokeStyle = "rgba(139,219,255,0.68)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(xBase, yBase - 90);
      ctx.lineTo(xBase - 12, yBase - 30);
      ctx.lineTo(xBase + 10, yBase + 30);
      ctx.lineTo(xBase - 8, yBase + 94);
      ctx.stroke();
    } else if (phrase.style === "seed") {
      ctx.fillText(phrase.text, xBase, yBase - 90);
    } else if (phrase.style === "home") {
      ctx.globalAlpha *= 0.82;
      ctx.fillText(phrase.text, xBase, yBase);
      ctx.strokeStyle = "rgba(236,249,255,0.18)";
      ctx.strokeRect(xBase - 240, yBase - 76, 480, 152);
    } else {
      if (letter > 0) drawSpacedText(phrase.text, xBase, yBase, letter);
      else ctx.fillText(phrase.text, xBase, yBase);
    }
    ctx.restore();
  }

  function drawSpacedText(text, x, y, spacing) {
    const widths = [...text].map((ch) => ctx.measureText(ch).width);
    const total = widths.reduce((sum, width) => sum + width, 0) + spacing * (text.length - 1);
    let cursor = x - total / 2;
    ctx.textAlign = "left";
    for (let i = 0; i < text.length; i++) {
      ctx.fillText(text[i], cursor, y);
      cursor += widths[i] + spacing;
    }
  }

  function drawBottomApproach() {
    const p = beat("bottomApproach");
    fillGradient("#061a3a", "#00040b");

    // the iceberg still dominates the frame
    const undersideY = lerp(1540, 760, easeInOut(p));
    const underside = makeUndersidePath(undersideY, 0);
    const g = ctx.createLinearGradient(0, 0, 0, undersideY + 300);
    g.addColorStop(0, "#0d4a89");
    g.addColorStop(0.55, "#082b5c");
    g.addColorStop(1, "#031326");
    ctx.fillStyle = g;
    ctx.fill(underside);

    ctx.strokeStyle = "rgba(151,218,255,0.24)";
    ctx.lineWidth = 8;
    ctx.stroke(underside);

    drawUnderIceTexture(undersideY);
    drawVignette(0.5);
  }

  function makeUndersidePath(y, fracture = 0) {
    const path = new Path2D();
    path.moveTo(-40, -40);
    path.lineTo(VIEW.w + 40, -40);
    path.lineTo(VIEW.w + 40, y - 160);
    for (let x = VIEW.w + 40; x >= -40; x -= 80) {
      const jag = Math.sin(x * 0.021) * 65 + Math.sin(x * 0.051 + 1.2) * 30;
      const collapse = fracture * (hash(x * 0.03) * 95);
      path.lineTo(x, y + jag + collapse);
    }
    path.closePath();
    return path;
  }

  function drawUnderIceTexture(undersideY) {
    ctx.save();
    for (let i = 0; i < 17; i++) {
      const x = hash(i * 4.1) * VIEW.w;
      const y = hash(i * 7.6) * undersideY;
      const w = 120 + hash(i + 50) * 360;
      const h = 140 + hash(i + 90) * 280;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y - h * 0.2);
      ctx.lineTo(x + w * 0.46, y - h * 0.5);
      ctx.lineTo(x + w * 0.52, y + h * 0.42);
      ctx.lineTo(x - w * 0.4, y + h * 0.55);
      ctx.closePath();
      ctx.fillStyle = `rgba(145,214,250,${0.025 + hash(i) * 0.05})`;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBottomFracture() {
    const p = beat("bottomFracture");
    fillGradient("#04142f", "#000207");
    const undersideY = 760;
    const underside = makeUndersidePath(undersideY, p * 0.2);
    const g = ctx.createLinearGradient(0, 0, 0, undersideY + 180);
    g.addColorStop(0, "#0a3b75");
    g.addColorStop(0.65, "#061f45");
    g.addColorStop(1, "#020b18");
    ctx.fillStyle = g;
    ctx.fill(underside);
    drawUnderIceTexture(undersideY);

    const cx = 560;
    const cy = 660;
    ctx.save();
    ctx.lineCap = "round";
    ctx.shadowBlur = 30;
    ctx.shadowColor = "rgba(114,215,255,0.8)";
    ctx.strokeStyle = `rgba(177,236,255,${0.34 + p * 0.62})`;
    for (let i = 0; i < 8; i++) {
      const startX = lerp(70, 1010, i / 7);
      const startY = 80 + hash(i + 6) * 420;
      const midX = lerp(startX, cx, 0.6) + (hash(i * 2) - 0.5) * 90;
      const midY = lerp(startY, cy, 0.6) + (hash(i * 3) - 0.5) * 70;
      ctx.lineWidth = 3 + p * 3;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(midX, midY);
      ctx.lineTo(cx + (hash(i + 20) - 0.5) * 24, cy + (hash(i + 30) - 0.5) * 20);
      ctx.stroke();
    }
    const pulse = Math.sin(p * Math.PI * 5) * 0.5 + 0.5;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180 + pulse * 90);
    glow.addColorStop(0, `rgba(220,249,255,${p * 0.46})`);
    glow.addColorStop(1, "rgba(116,216,255,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 280, cy - 280, 560, 560);
    ctx.restore();
    drawVignette(0.56);
  }

  const SHARDS = [
    {
      points: [[120, 690], [350, 640], [430, 805], [306, 1010], [94, 918], [42, 780]],
      vx: -115, vy: 590, spin: -0.42, delay: 0.0,
    },
    {
      points: [[390, 610], [650, 580], [738, 766], [602, 975], [430, 854]],
      vx: 38, vy: 660, spin: 0.36, delay: 0.08,
    },
    {
      points: [[700, 650], [1018, 590], [1080, 730], [964, 980], [764, 916]],
      vx: 138, vy: 560, spin: 0.48, delay: 0.18,
    },
    {
      points: [[250, 900], [455, 820], [560, 1040], [392, 1225], [202, 1110]],
      vx: -70, vy: 760, spin: -0.3, delay: 0.28,
    },
  ];

  function drawBottomShatter() {
    const p = beat("bottomShatter");
    fillGradient("#031027", "#000104");
    const undersideY = 720;
    const fixed = makeUndersidePath(undersideY, 0.16 + p * 0.18);
    ctx.fillStyle = "#052248";
    ctx.fill(fixed);

    for (let i = 0; i < SHARDS.length; i++) {
      const shard = SHARDS[i];
      const local = clamp((p - shard.delay) / (1 - shard.delay));
      drawJaggedShard(shard, local, i);
    }

    const dim = smooth(inv(0.55, 1, p));
    ctx.fillStyle = `rgba(0,0,0,${dim * 0.82})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    drawVignette(0.7);
  }

  function drawJaggedShard(shard, p, index) {
    const cx = shard.points.reduce((sum, point) => sum + point[0], 0) / shard.points.length;
    const cy = shard.points.reduce((sum, point) => sum + point[1], 0) / shard.points.length;
    const tx = shard.vx * easeIn(p);
    const ty = shard.vy * easeIn(p);

    ctx.save();
    ctx.translate(cx + tx, cy + ty);
    ctx.rotate(shard.spin * easeInOut(p));
    ctx.translate(-cx, -cy);

    const g = ctx.createLinearGradient(cx - 200, cy - 220, cx + 180, cy + 260);
    g.addColorStop(0, "rgba(116,198,236,0.86)");
    g.addColorStop(0.48, "rgba(40,104,165,0.92)");
    g.addColorStop(1, "rgba(4,26,63,0.98)");
    ctx.fillStyle = g;
    ctx.beginPath();
    shard.points.forEach((point, i) => {
      if (i === 0) ctx.moveTo(point[0], point[1]);
      else ctx.lineTo(point[0], point[1]);
    });
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(211,244,255,0.42)";
    ctx.lineWidth = 6;
    ctx.stroke();

    // Internal fracture facets
    ctx.strokeStyle = "rgba(203,239,255,0.18)";
    ctx.lineWidth = 3;
    for (let j = 0; j < 4; j++) {
      const a = shard.points[j % shard.points.length];
      const b = shard.points[(j + 2) % shard.points.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(lerp(a[0], b[0], 0.55), lerp(a[1], b[1], 0.55));
      ctx.stroke();
    }

    // one shard carries a tiny reflection of the penguins
    if (index === 1 && p > 0.18 && p < 0.72) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = "#f4fbff";
      ctx.beginPath();
      ctx.ellipse(cx - 12, cy + 20, 14, 25, -0.2, 0, Math.PI * 2);
      ctx.ellipse(cx + 14, cy + 20, 14, 25, 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBlackout() {
    const p = beat("blackout");
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    if (p < 0.35) {
      ctx.fillStyle = `rgba(38,92,129,${(0.35 - p) * 0.12})`;
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    }
  }

  function fishPosition(i, t) {
    return {
      x: ((hash(i * 2.7) * 1240 + t * (38 + hash(i + 9) * 55)) % 1380) - 150,
      y: 360 + hash(i * 9.1) * 1050 + Math.sin(t * 0.65 + i) * 90,
      s: 0.55 + hash(i + 20) * 1.1,
    };
  }

  function drawFishSchool(reveal = 1, whaleSpace = false) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 18; i++) {
      const pos = fishPosition(i, state.time);
      const appear = clamp(reveal * 1.55 - i * 0.045);
      if (appear <= 0) continue;
      const x = pos.x;
      const y = pos.y;
      const s = pos.s;
      const glowR = 36 * s;
      const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      g.addColorStop(0, `rgba(178,255,236,${0.78 * appear})`);
      g.addColorStop(0.24, `rgba(88,218,255,${0.35 * appear})`);
      g.addColorStop(1, "rgba(88,218,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - glowR, y - glowR, glowR * 2, glowR * 2);

      ctx.fillStyle = `rgba(215,255,245,${0.92 * appear})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 11 * s, 6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 10 * s, y);
      ctx.lineTo(x - 19 * s, y - 7 * s);
      ctx.lineTo(x - 19 * s, y + 7 * s);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFishScene() {
    const p = beat("fish");
    fillGradient("#01040a", "#000104");
    drawFishSchool(smooth(p));
    drawWaterParticles(0.28 * p);
    drawVignette(0.62);
  }

  function drawWaterParticles(alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#c8f6ff";
    for (let i = 0; i < 95; i++) {
      const x = hash(i * 3.2) * VIEW.w;
      const y = (hash(i * 4.9) * VIEW.h - state.time * (4 + hash(i) * 9)) % VIEW.h;
      ctx.beginPath();
      ctx.arc(x, (y + VIEW.h) % VIEW.h, 0.8 + hash(i + 8) * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function whalePath() {
    const p = new Path2D();
    p.moveTo(-540, 80); // tail connection
    p.bezierCurveTo(-410, -50, -210, -150, 110, -160);
    p.bezierCurveTo(390, -170, 630, -70, 760, 70);
    p.bezierCurveTo(870, 190, 800, 330, 610, 390);
    p.bezierCurveTo(330, 470, 10, 430, -250, 330);
    p.bezierCurveTo(-430, 260, -520, 175, -540, 80);
    p.closePath();
    return p;
  }

  function drawWhale(camera = {}) {
    const scale = camera.scale ?? 1;
    const panX = camera.panX ?? 0;
    const panY = camera.panY ?? 0;
    const reveal = camera.reveal ?? 1;
    const eyeGlow = camera.eyeGlow ?? 0;

    ctx.save();
    ctx.translate(VIEW.w * 0.45 + panX, VIEW.h * 0.58 + panY);
    ctx.scale(scale, scale);

    // tail flukes
    ctx.fillStyle = `rgba(4,13,24,${0.96 * reveal})`;
    ctx.beginPath();
    ctx.moveTo(-520, 75);
    ctx.bezierCurveTo(-650, -20, -760, -120, -840, -40);
    ctx.bezierCurveTo(-760, 20, -690, 65, -610, 100);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-520, 90);
    ctx.bezierCurveTo(-665, 120, -745, 220, -835, 160);
    ctx.bezierCurveTo(-725, 85, -635, 60, -545, 58);
    ctx.closePath();
    ctx.fill();

    const body = ctx.createLinearGradient(-460, -180, 650, 400);
    body.addColorStop(0, `rgba(9,27,43,${0.98 * reveal})`);
    body.addColorStop(0.48, `rgba(18,42,59,${0.98 * reveal})`);
    body.addColorStop(1, `rgba(3,11,20,${0.99 * reveal})`);
    ctx.fillStyle = body;
    const path = whalePath();
    ctx.fill(path);

    // gentle dorsal / fin and underside shape
    ctx.fillStyle = `rgba(2,9,16,${0.98 * reveal})`;
    ctx.beginPath();
    ctx.moveTo(-40, 340);
    ctx.bezierCurveTo(50, 510, 230, 560, 330, 420);
    ctx.bezierCurveTo(185, 438, 70, 404, -40, 340);
    ctx.fill();

    // skin texture and subtle baleen lines
    ctx.save();
    ctx.clip(path);
    for (let i = 0; i < 55; i++) {
      const x = -470 + hash(i * 2.1) * 1130;
      const y = -120 + hash(i * 4.4) * 510;
      const r = 2 + hash(i + 9) * 6;
      ctx.globalAlpha = 0.035 + hash(i) * 0.045;
      ctx.fillStyle = "#a5c0cb";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = "#b9d3dc";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(420 + i * 32, 185);
      ctx.bezierCurveTo(470 + i * 26, 230, 500 + i * 20, 295, 520 + i * 16, 355);
      ctx.stroke();
    }
    ctx.restore();

    // mouth line
    ctx.strokeStyle = `rgba(125,160,176,${0.24 * reveal})`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(370, 200);
    ctx.bezierCurveTo(520, 265, 675, 260, 750, 155);
    ctx.stroke();

    // eye
    const eyeX = 510;
    const eyeY = 60;
    ctx.fillStyle = `rgba(118,155,174,${0.24 + eyeGlow * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(eyeX, eyeY, 27, 16, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#010308";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 9.5, 0, Math.PI * 2);
    ctx.fill();
    if (eyeGlow > 0) {
      const g = ctx.createRadialGradient(eyeX + 8, eyeY - 7, 0, eyeX + 8, eyeY - 7, 52);
      g.addColorStop(0, `rgba(220,251,255,${0.8 * eyeGlow})`);
      g.addColorStop(1, "rgba(130,224,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(eyeX - 50, eyeY - 60, 120, 120);
    }
    ctx.restore();
  }

  function drawWhaleReveal() {
    const p = beat("whaleReveal");
    fillGradient("#01040a", "#000104");
    drawWaterParticles(0.14 + p * 0.16);
    drawWhale({ scale: 0.86, panX: 95, panY: 130, reveal: smooth(p) * 0.95, eyeGlow: clamp((p - 0.65) / 0.35) });
    drawFishSchool(1, true);
    drawVignette(0.66);
  }

  function drawWhaleApproach() {
    const p = beat("whaleApproach");
    fillGradient("#01040a", "#000103");
    drawWaterParticles(0.18);

    // camera glides along the body, then settles near the eye
    const scale = lerp(0.86, 1.62, easeInOut(p));
    const panX = lerp(95, -280, easeInOut(p));
    const panY = lerp(130, 120, easeInOut(p));
    drawWhale({ scale, panX, panY, reveal: 1, eyeGlow: smooth(inv(0.4, 1, p)) });
    drawFishSchool(1 - p * 0.45);

    const targetGlow = ctx.createRadialGradient(742, 1060, 0, 742, 1060, 300);
    targetGlow.addColorStop(0, `rgba(100,218,255,${p * 0.08})`);
    targetGlow.addColorStop(1, "rgba(100,218,255,0)");
    ctx.fillStyle = targetGlow;
    ctx.fillRect(400, 700, 680, 700);
    drawVignette(0.72);
  }

  function drawEyeTransition() {
    const p = beat("eye");
    fillGradient("#000207", "#000000");
    const scale = lerp(1.62, 5.5, easeInOut(p));
    const panX = lerp(-280, -2751, easeInOut(p));
    const panY = lerp(120, -483, easeInOut(p));
    drawWhale({ scale, panX, panY, reveal: 1, eyeGlow: 1 });

    // camera enters the pupil only at the end, instead of the pupil magically expanding by itself
    const darkness = smooth(inv(0.62, 1, p));
    ctx.fillStyle = `rgba(0,0,0,${darkness})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);

    if (p < 0.78) {
      const sx = lerp(770, 546, p / 0.78);
      const sy = lerp(1015, 950, p / 0.78);
      ctx.fillStyle = `rgba(239,251,255,${0.75 * (1 - p / 0.78)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const STAR_FIELD = Array.from({ length: 180 }, (_, i) => ({
    x: hash(i * 2.13) * VIEW.w,
    y: hash(i * 7.27) * VIEW.h,
    r: 0.7 + hash(i + 30) * 2.3,
    twinkle: hash(i + 90) * Math.PI * 2,
  }));

  const ORION = [
    { name: "Betelgeuse", x: -150, y: -210, r: 6.5 },
    { name: "Bellatrix", x: 120, y: -180, r: 5.2 },
    { name: "Alnitak", x: -62, y: 2, r: 4.6 },
    { name: "Alnilam", x: 0, y: 10, r: 4.9 },
    { name: "Mintaka", x: 68, y: 18, r: 4.3 },
    { name: "Saiph", x: -115, y: 245, r: 4.8 },
    { name: "Rigel", x: 150, y: 260, r: 6.3 },
    { name: "Sword1", x: 8, y: 86, r: 2.8 },
    { name: "Sword2", x: 14, y: 128, r: 2.6 },
    { name: "Sword3", x: 20, y: 170, r: 2.2 },
  ];

  function drawStarField(alpha = 1, rotation = 0, drift = 0) {
    ctx.save();
    ctx.translate(VIEW.w * 0.5, VIEW.h * 0.5);
    ctx.rotate(rotation);
    ctx.translate(-VIEW.w * 0.5 + drift, -VIEW.h * 0.5);
    for (let i = 0; i < STAR_FIELD.length; i++) {
      const star = STAR_FIELD[i];
      const twinkle = 0.62 + Math.sin(state.time * 1.7 + star.twinkle) * 0.28;
      ctx.globalAlpha = alpha * twinkle;
      ctx.fillStyle = "#f0f8ff";
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawOrion(alpha = 1, x = 520, y = 850, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.globalCompositeOperation = "screen";

    const byName = Object.fromEntries(ORION.map((s) => [s.name, s]));
    const lines = [
      ["Betelgeuse", "Bellatrix"],
      ["Betelgeuse", "Alnitak"],
      ["Bellatrix", "Mintaka"],
      ["Alnitak", "Alnilam"],
      ["Alnilam", "Mintaka"],
      ["Alnitak", "Saiph"],
      ["Mintaka", "Rigel"],
      ["Saiph", "Rigel"],
      ["Alnilam", "Sword1"],
      ["Sword1", "Sword2"],
      ["Sword2", "Sword3"],
    ];
    ctx.strokeStyle = `rgba(163,216,255,${alpha * 0.18})`;
    ctx.lineWidth = 1.5;
    for (const [a, b] of lines) {
      ctx.beginPath();
      ctx.moveTo(byName[a].x, byName[a].y);
      ctx.lineTo(byName[b].x, byName[b].y);
      ctx.stroke();
    }

    for (const star of ORION) {
      const g = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.r * 6);
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(0.25, `rgba(190,227,255,${alpha * 0.5})`);
      g.addColorStop(1, "rgba(130,210,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r * 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCosmos() {
    const p = beat("cosmos");
    ctx.fillStyle = "#000103";
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    drawStarField(smooth(p), -0.03 * p, -18 * p);

    // Orion's belt appears first, then the rest of Orion.
    const beltAlpha = smooth(inv(0.04, 0.38, p));
    const fullAlpha = smooth(inv(0.28, 0.78, p));
    ctx.save();
    ctx.translate(540, 920);
    ctx.globalCompositeOperation = "screen";
    for (const name of ["Alnitak", "Alnilam", "Mintaka"]) {
      const star = ORION.find((item) => item.name === name);
      const g = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 36);
      g.addColorStop(0, `rgba(255,255,255,${beltAlpha})`);
      g.addColorStop(1, "rgba(149,218,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(star.x, star.y, 36, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    drawOrion(fullAlpha, 540, 920, 1.12);
    drawVignette(0.46);
  }

  function drawEarth(radius, rotation, alpha = 1) {
    const cx = VIEW.w * 0.5;
    const cy = VIEW.h * 0.5;
    ctx.save();
    ctx.globalAlpha = alpha;

    const atmosphere = ctx.createRadialGradient(cx - radius * 0.25, cy - radius * 0.3, radius * 0.15, cx, cy, radius * 1.18);
    atmosphere.addColorStop(0, "rgba(255,255,255,0.12)");
    atmosphere.addColorStop(0.72, "rgba(72,161,255,0.04)");
    atmosphere.addColorStop(0.86, "rgba(65,173,255,0.42)");
    atmosphere.addColorStop(1, "rgba(65,173,255,0)");
    ctx.fillStyle = atmosphere;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    const globe = ctx.createRadialGradient(cx - radius * 0.35, cy - radius * 0.35, radius * 0.08, cx, cy, radius);
    globe.addColorStop(0, "#66c8ff");
    globe.addColorStop(0.48, "#146fb9");
    globe.addColorStop(1, "#061b3f");
    ctx.fillStyle = globe;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    // Stylized continents.
    ctx.fillStyle = "#4f9d63";
    drawContinent(-radius * 0.2, -radius * 0.17, radius, 0.9);
    drawContinent(radius * 0.28, radius * 0.18, radius, -0.5);
    drawContinent(-radius * 0.55, radius * 0.34, radius * 0.72, 0.35);

    // cloud bands
    ctx.strokeStyle = "rgba(244,252,255,0.52)";
    ctx.lineWidth = Math.max(2, radius * 0.025);
    for (let i = -2; i <= 2; i++) {
      const y = i * radius * 0.24;
      ctx.beginPath();
      ctx.bezierCurveTo(-radius, y - 25, -radius * 0.2, y + 42, radius, y - 10);
      ctx.stroke();
    }
    ctx.restore();

    // night-side shading
    const shadow = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    shadow.addColorStop(0.2, "rgba(0,0,0,0)");
    shadow.addColorStop(0.72, "rgba(0,0,0,0.12)");
    shadow.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawContinent(x, y, r, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.beginPath();
    ctx.moveTo(-0.34 * r, -0.1 * r);
    ctx.bezierCurveTo(-0.16 * r, -0.28 * r, 0.08 * r, -0.24 * r, 0.23 * r, -0.07 * r);
    ctx.bezierCurveTo(0.36 * r, 0.06 * r, 0.21 * r, 0.25 * r, 0.04 * r, 0.22 * r);
    ctx.bezierCurveTo(-0.08 * r, 0.32 * r, -0.25 * r, 0.19 * r, -0.34 * r, -0.1 * r);
    ctx.fill();
    ctx.restore();
  }

  function drawEarthScene() {
    const p = beat("earth");
    ctx.fillStyle = "#000103";
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    const rotation = lerp(-0.08, 0.22, easeInOut(p));
    drawStarField(1, rotation * 0.32, -40 * p);
    drawOrion(1 - p * 0.42, 350, 640, 0.72);
    const radius = lerp(28, 235, easeOut(p));
    drawEarth(radius, rotation, smooth(p));
    drawVignette(0.38);
  }

  function drawEarthDive() {
    const p = beat("earthDive");
    ctx.fillStyle = "#000103";
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    drawStarField(1 - p * 0.8, p * 0.16, -60 * p);
    const radius = lerp(235, 1450, easeIn(p));
    drawEarth(radius, lerp(0.22, 0.48, p), 1);

    // Atmosphere turns into white snow light.
    const white = smooth(inv(0.58, 1, p));
    ctx.fillStyle = `rgba(235,248,255,${white})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  function drawReturnScene(final = false) {
    const p = final ? 1 : beat("return");
    fillGradient("#091729", "#9cc7dc");
    drawAurora(0.12 + p * 0.05);
    drawSnow(105, 0.55, 0.76);
    drawSnowField(1220);

    const settle = easeOut(p);
    const leftX = lerp(430, 486, settle);
    const rightX = lerp(650, 594, settle);
    const y = 1190;
    drawPenguin(leftX, y, 1.13, 1, 0.06, settle);
    drawPenguin(rightX, y, 1.13, -1, -0.06, settle);

    // shared soft glow, no crack now
    const g = ctx.createRadialGradient(540, 1095, 0, 540, 1095, 250);
    g.addColorStop(0, `rgba(255,255,255,${0.09 + settle * 0.08})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(260, 820, 560, 560);

    drawVignette(0.28);
  }

  function drawFinal() {
    const p = beat("final");
    drawReturnScene(true);
    const alpha = smooth(inv(0.08, 0.55, p)) * (1 - smooth(inv(0.82, 1, p)) * 0.12);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(249,253,255,0.96)";
    ctx.shadowBlur = 32;
    ctx.shadowColor = "rgba(157,222,255,0.72)";
    ctx.font = "500 88px Georgia, serif";
    drawSpacedText("forever", 540, 730, 12);
    ctx.restore();
  }

  function render() {
    beginVirtual();
    ctx.clearRect(0, 0, VIEW.w, VIEW.h);

    if (active("surface")) drawSurfaceScene();
    else if (active("kissCrack")) drawCrackTransition();
    else if (active("descent")) drawIceFace();
    else if (active("bottomApproach")) drawBottomApproach();
    else if (active("bottomFracture")) drawBottomFracture();
    else if (active("bottomShatter")) drawBottomShatter();
    else if (active("blackout")) drawBlackout();
    else if (active("fish")) drawFishScene();
    else if (active("whaleReveal")) drawWhaleReveal();
    else if (active("whaleApproach")) drawWhaleApproach();
    else if (active("eye")) drawEyeTransition();
    else if (active("cosmos")) drawCosmos();
    else if (active("earth")) drawEarthScene();
    else if (active("earthDive")) drawEarthDive();
    else if (active("return")) drawReturnScene(false);
    else drawFinal();
  }

  startButton.addEventListener("click", () => {
    intro.classList.add("is-hidden");
    play();
  });

  playPauseButton.addEventListener("click", () => {
    intro.classList.add("is-hidden");
    if (state.playing) pause();
    else play();
  });

  restartButton.addEventListener("click", () => {
    pause();
    state.time = 0;
    updateUI();
    render();
  });

  timeline.addEventListener("input", (event) => {
    state.time = clamp(Number(event.target.value), 0, TOTAL);
    updateUI();
    render();
  });

  window.addEventListener("resize", resize);

  const params = new URLSearchParams(location.search);
  const previewTime = Number(params.get("time"));
  if (Number.isFinite(previewTime)) {
    state.time = clamp(previewTime, 0, TOTAL);
    intro.classList.add("is-hidden");
  }
  if (params.get("autoplay") === "1") {
    intro.classList.add("is-hidden");
    requestAnimationFrame(play);
  }

  resize();
  updateUI();
  render();
})();
