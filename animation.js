(() => {
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  const intro = document.getElementById("intro");
  const startBtn = document.getElementById("startBtn");
  const playBtn = document.getElementById("playBtn");
  const pauseBtn = document.getElementById("pauseBtn");
  const restartBtn = document.getElementById("restartBtn");
  const scrub = document.getElementById("scrub");
  const timeLabel = document.getElementById("timeLabel");

  const DURATION = 133;

  const SCENES = {
    landscape: [0, 10],
    approach: [10, 22],
    pause: [22, 30],
    kiss: [30, 40],
    drop: [40, 52],
    upperIce: [52, 68],
    pressure: [68, 82],
    library: [82, 96],
    seed: [96, 104],
    chase: [104, 118],
    shatter: [118, 125],
    dark: [125, 129],
    whale: [129, 131],
    eye: [131, 133],
  };

  const PHRASES = [
    { text: "until the end", start: 56, end: 63, mode: "ice" },
    { text: "i love you, always", start: 71, end: 79, mode: "seam" },
    { text: "never let go", start: 86.5, end: 93.5, mode: "library" },
    { text: "planting the seed", start: 98, end: 104, mode: "seed" },
    { text: "my forever...", start: 129.2, end: 131.2, mode: "water" },
    { text: "my forever love", start: 131.2, end: 132.5, mode: "eye" },
  ];

  const state = {
    time: 0,
    playing: false,
    raf: null,
    lastTs: 0,
    w: 0,
    h: 0,
    dpr: Math.min(window.devicePixelRatio || 1, 2),
  };

  const snow = Array.from({ length: 80 }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    r: Math.random() * 2 + 0.6,
    s: 0.1 + Math.random() * 0.4,
    drift: (Math.random() - 0.5) * 0.25,
    phase: Math.random() * Math.PI * 2 + i,
  }));

  const bubbles = Array.from({ length: 48 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 2 + Math.random() * 7,
    s: 0.2 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
  }));

  const fish = Array.from({ length: 12 }, (_, i) => ({
    seed: i * 0.72 + Math.random() * 10,
    scale: 0.8 + Math.random() * 0.7,
  }));

  const pages = Array.from({ length: 12 }, (_, i) => ({
    x: (i + 1) / 13,
    y: 0.25 + Math.random() * 0.45,
    rot: Math.random() * Math.PI,
    drift: 0.4 + Math.random() * 0.8,
  }));

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.w = Math.max(1, rect.width);
    state.h = Math.max(1, rect.height);
    canvas.width = Math.floor(state.w * state.dpr);
    canvas.height = Math.floor(state.h * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function invLerp(a, b, v) {
    return clamp((v - a) / (b - a), 0, 1);
  }

  function smooth(t) {
    return t * t * (3 - 2 * t);
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInCubic(t) {
    return t * t * t;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function sceneProgress(name) {
    const [a, b] = SCENES[name];
    return clamp((state.time - a) / (b - a), 0, 1);
  }

  function sceneActive(name) {
    const [a, b] = SCENES[name];
    return state.time >= a && state.time <= b;
  }

  function mixColor(a, b, t) {
    return `rgba(${Math.round(lerp(a[0], b[0], t))},${Math.round(
      lerp(a[1], b[1], t)
    )},${Math.round(lerp(a[2], b[2], t))},${lerp(
      a[3] ?? 1,
      b[3] ?? 1,
      t
    )})`;
  }

  function fmt(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  }

  function updateUI() {
    scrub.value = state.time.toFixed(2);
    timeLabel.textContent = `${fmt(state.time)} / 2:13`;
  }

  function play() {
    if (state.playing) return;
    state.playing = true;
    state.lastTs = performance.now();
    tick(state.lastTs);
  }

  function pause() {
    state.playing = false;
    if (state.raf) cancelAnimationFrame(state.raf);
  }

  function restart() {
    state.time = 0;
    updateUI();
    render();
  }

  function tick(ts) {
    if (!state.playing) return;
    const dt = (ts - state.lastTs) / 1000;
    state.lastTs = ts;
    state.time += dt;
    if (state.time >= DURATION) {
      state.time = DURATION;
      pause();
    }
    updateUI();
    render();
    state.raf = requestAnimationFrame(tick);
  }

  function clear() {
    ctx.clearRect(0, 0, state.w, state.h);
  }

  function fillBG(top, bottom) {
    const g = ctx.createLinearGradient(0, 0, 0, state.h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.w, state.h);
  }

  function drawSnow(amount = 1) {
    ctx.save();
    for (const p of snow) {
      const x = (p.x * state.w + Math.sin(state.time * 0.4 + p.phase) * 24 * amount) % state.w;
      const y =
        (p.y * state.h +
          ((state.time * 24 * p.s * amount) % (state.h + 80)) -
          40) %
        (state.h + 80);
      ctx.globalAlpha = 0.16 + p.s * 0.28;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(x, y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAurora() {
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let j = 0; j < 3; j++) {
      ctx.beginPath();
      for (let x = 0; x <= state.w; x += 10) {
        const nx = x / state.w;
        const y =
          state.h * (0.12 + j * 0.05) +
          Math.sin(nx * 6 + state.time * 0.2 + j) * 26 +
          Math.sin(nx * 11 + j * 1.4) * 12;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineWidth = 18 - j * 4;
      ctx.strokeStyle = j === 1 ? "rgba(168,255,244,0.32)" : "rgba(121,211,255,0.22)";
      ctx.stroke();
    }

    // Subtle "D" curve hidden in aurora
    ctx.globalAlpha = 0.09;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(230,245,255,0.45)";
    ctx.beginPath();
    const cx = state.w * 0.73;
    const cy = state.h * 0.14;
    ctx.moveTo(cx - 20, cy - 24);
    ctx.lineTo(cx - 20, cy + 24);
    ctx.bezierCurveTo(cx + 28, cy + 18, cx + 28, cy - 18, cx - 20, cy - 24);
    ctx.stroke();
    ctx.restore();
  }

  function drawGround() {
    ctx.save();
    const horizon = state.h * 0.68;
    ctx.fillStyle = "rgba(227,245,255,0.94)";
    ctx.beginPath();
    ctx.moveTo(0, state.h);
    ctx.lineTo(0, horizon + 20);
    ctx.quadraticCurveTo(state.w * 0.25, horizon - 18, state.w * 0.5, horizon + 5);
    ctx.quadraticCurveTo(state.w * 0.76, horizon + 28, state.w, horizon - 10);
    ctx.lineTo(state.w, state.h);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = horizon + 30 + i * 22;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(state.w * 0.3, y - 10, state.w, y + 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFootprints(progress) {
    ctx.save();
    const horizon = state.h * 0.69;
    ctx.fillStyle = "rgba(120,150,170,0.22)";
    const count = Math.floor(10 * progress);
    for (let i = 0; i < count; i++) {
      const t = i / 9;
      const leftX = lerp(state.w * 0.26, state.w * 0.44, t);
      const rightX = lerp(state.w * 0.74, state.w * 0.56, t);
      const y = horizon + Math.sin(t * Math.PI) * 12 + i * 2;
      ctx.beginPath();
      ctx.ellipse(leftX, y, 6, 3, Math.PI * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(rightX, y + 3, 6, 3, -Math.PI * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPenguin(x, y, scale, lean = 0, blink = 0, breathing = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(lean);

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 48, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // feet
    ctx.fillStyle = "#d89f38";
    ctx.beginPath();
    ctx.ellipse(-10, 42, 9, 4, 0.12, 0, Math.PI * 2);
    ctx.ellipse(10, 42, 9, 4, -0.12, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = "#181d24";
    ctx.beginPath();
    ctx.ellipse(0, 6 + breathing, 26, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    // belly
    ctx.fillStyle = "#eef6ff";
    ctx.beginPath();
    ctx.ellipse(0, 12 + breathing, 18, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.fillStyle = "#181d24";
    ctx.beginPath();
    ctx.arc(0, -28, 20, 0, Math.PI * 2);
    ctx.fill();

    // face
    ctx.fillStyle = "#f5fbff";
    ctx.beginPath();
    ctx.ellipse(0, -24, 11, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // beak
    ctx.fillStyle = "#d89f38";
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(18, -18);
    ctx.lineTo(0, -14);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.fillStyle = "#12151a";
    if (blink > 0.85) {
      ctx.fillRect(4, -29, 7, 1.6);
    } else {
      ctx.beginPath();
      ctx.arc(7, -29, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // wing
    ctx.fillStyle = "rgba(8,11,16,0.42)";
    ctx.beginPath();
    ctx.ellipse(-20, 3, 8, 18, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawCrack(progress, aroundKiss = false) {
    if (progress <= 0) return;

    const baseY = state.h * 0.69;
    ctx.save();
    ctx.strokeStyle = aroundKiss
      ? "rgba(134, 191, 222, 0.82)"
      : "rgba(104, 166, 205, 0.88)";
    ctx.lineWidth = aroundKiss ? 2 : 3;
    ctx.shadowBlur = aroundKiss ? 12 : 18;
    ctx.shadowColor = "rgba(140, 220, 255, 0.5)";

    const startX = state.w * 0.5;
    const len = state.w * 0.44 * progress;
    ctx.beginPath();
    ctx.moveTo(startX, baseY + 8);
    ctx.lineTo(startX - len * 0.18, baseY + 12);
    ctx.lineTo(startX - len * 0.36, baseY + 4);
    ctx.lineTo(startX - len * 0.58, baseY + 18);
    ctx.lineTo(startX - len * 0.85, baseY + 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(startX, baseY + 8);
    ctx.lineTo(startX + len * 0.16, baseY + 18);
    ctx.lineTo(startX + len * 0.34, baseY + 12);
    ctx.lineTo(startX + len * 0.6, baseY + 22);
    ctx.lineTo(startX + len * 0.9, baseY + 16);
    ctx.stroke();

    // hidden date in tiny fracture marks
    if (progress > 0.28) {
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = "rgba(240,248,255,0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(startX - 38, baseY + 5);
      ctx.lineTo(startX - 34, baseY - 1);
      ctx.lineTo(startX - 31, baseY + 5); // 1
      ctx.moveTo(startX - 25, baseY + 6);
      ctx.lineTo(startX - 20, baseY - 1);
      ctx.lineTo(startX - 16, baseY + 6); // 7
      ctx.moveTo(startX - 10, baseY + 3);
      ctx.lineTo(startX - 8, baseY + 6); // dot
      ctx.moveTo(startX - 2, baseY + 6);
      ctx.lineTo(startX + 2, baseY - 1);
      ctx.lineTo(startX + 5, baseY + 6); // 0
      ctx.moveTo(startX + 10, baseY + 6);
      ctx.lineTo(startX + 13, baseY - 1);
      ctx.lineTo(startX + 18, baseY + 6); // 3
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawUnderIceEnvironment(stage, localT) {
    const topLight = stage === "upper" ? 0.24 : stage === "pressure" ? 0.16 : 0.1;
    fillBG(
      mixColor([10, 25, 44, 1], [4, 10, 18, 1], localT),
      mixColor([3, 8, 15, 1], [1, 3, 6, 1], localT)
    );

    // Ceiling glow
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, state.h * 0.45);
    g.addColorStop(0, `rgba(193,236,255,${topLight})`);
    g.addColorStop(1, "rgba(193,236,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, state.w, state.h * 0.55);
    ctx.restore();

    const speedBase =
      stage === "upper" ? 0.8 :
      stage === "pressure" ? 1.35 :
      stage === "chase" ? 1.8 : 0.6;

    const timeShift = state.time * speedBase * 90;

    // Ice layers
    for (let i = 0; i < 12; i++) {
      const depth = i / 11;
      const y = -50 + ((timeShift * (0.45 + depth * 0.55) + i * 110) % (state.h + 180)) - 70;
      const alpha = 0.1 + depth * 0.08;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-80, y);
      ctx.quadraticCurveTo(state.w * 0.35, y + 34, state.w + 80, y - 18);
      ctx.lineTo(state.w + 80, y + 34);
      ctx.quadraticCurveTo(state.w * 0.55, y + 68, -80, y + 28);
      ctx.closePath();
      ctx.fillStyle = `rgba(${170 - i * 6}, ${220 - i * 8}, 255, ${alpha})`;
      ctx.fill();
      ctx.restore();
    }

    // Vertical columns / walls
    for (let i = 0; i < 8; i++) {
      const depth = i / 7;
      const x = ((i * 140 + state.time * speedBase * -40 * (1 + depth)) % (state.w + 280)) - 140;
      const h = state.h * (0.55 + depth * 0.35);
      ctx.save();
      ctx.fillStyle = `rgba(130, 190, 230, ${0.04 + depth * 0.08})`;
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x + 24 + depth * 16, -20);
      ctx.lineTo(x + 60 + depth * 22, h);
      ctx.lineTo(x - 10, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Trapped bubbles
    ctx.save();
    for (let i = 0; i < 22; i++) {
      const bx = (i * 97 + state.time * speedBase * -12) % (state.w + 100) - 50;
      const by = (i * 61 + state.time * speedBase * 24) % (state.h + 120) - 60;
      const rr = 2 + (i % 4) * 1.3;
      ctx.strokeStyle = "rgba(233, 247, 255, 0.12)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(bx, by, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Heart bubbles easter egg
    if (state.time > 73 && state.time < 79) {
      ctx.strokeStyle = "rgba(235, 248, 255, 0.28)";
      ctx.beginPath();
      ctx.arc(state.w * 0.66, state.h * 0.32, 7, 0, Math.PI * 2);
      ctx.arc(state.w * 0.68, state.h * 0.32, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // Cracks overhead chasing us
    if (stage === "pressure" || stage === "chase") {
      const chase = stage === "pressure" ? sceneProgress("pressure") : sceneProgress("chase");
      drawOverheadCracks(chase, stage === "chase");
    }

    // Speed streaks
    if (stage === "pressure" || stage === "chase") {
      ctx.save();
      ctx.strokeStyle = `rgba(210, 240, 255, ${stage === "chase" ? 0.16 : 0.12})`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) {
        const x = (i * 97 + state.time * -120) % (state.w + 50);
        const y = (i * 71 + state.time * 48) % (state.h + 30);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 18, y + 42);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawOverheadCracks(chaseProgress, fierce = false) {
    ctx.save();
    ctx.globalAlpha = 0.34 + chaseProgress * 0.28;
    ctx.lineWidth = fierce ? 2.8 : 2;
    ctx.strokeStyle = fierce
      ? "rgba(150,220,255,0.72)"
      : "rgba(136,203,238,0.52)";
    ctx.shadowBlur = fierce ? 16 : 10;
    ctx.shadowColor = "rgba(130,220,255,0.28)";
    const yBase = state.h * 0.08;
    for (let j = 0; j < 4; j++) {
      const startX = lerp(state.w * 0.2, state.w * 0.8, j / 3);
      const drift = state.time * (fierce ? 24 : 12) + j * 40;
      ctx.beginPath();
      ctx.moveTo(startX, yBase - 10);
      for (let i = 0; i < 8; i++) {
        const x = startX + Math.sin(i * 0.8 + drift * 0.04 + j) * 36;
        const y = yBase + i * 28 + Math.cos(i + j) * 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLibrary(progress) {
    fillBG("rgba(5,11,20,1)", "rgba(1,4,8,1)");

    // chamber
    ctx.save();
    const chamber = ctx.createRadialGradient(
      state.w * 0.5,
      state.h * 0.4,
      10,
      state.w * 0.5,
      state.h * 0.48,
      state.w * 0.7
    );
    chamber.addColorStop(0, "rgba(98,164,214,0.15)");
    chamber.addColorStop(0.5, "rgba(57,103,147,0.09)");
    chamber.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = chamber;
    ctx.fillRect(0, 0, state.w, state.h);

    // ice arch
    ctx.fillStyle = "rgba(120,180,230,0.08)";
    ctx.beginPath();
    ctx.moveTo(0, state.h * 0.7);
    ctx.quadraticCurveTo(state.w * 0.2, state.h * 0.18, state.w * 0.5, state.h * 0.18);
    ctx.quadraticCurveTo(state.w * 0.8, state.h * 0.18, state.w, state.h * 0.72);
    ctx.lineTo(state.w, state.h);
    ctx.lineTo(0, state.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // shelves
    const slide = (1 - progress) * 60;
    drawShelf(state.w * 0.12 + slide, state.h * 0.55, 74, 180, true);
    drawShelf(state.w * 0.66 - slide * 0.4, state.h * 0.45, 92, 220, false);
    drawShelf(state.w * 0.42, state.h * 0.62, 110, 160, true);

    // staircase-ish silhouette
    ctx.save();
    ctx.strokeStyle = "rgba(210,225,240,0.10)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(state.w * 0.68, state.h * 0.72);
    for (let i = 0; i < 6; i++) {
      ctx.lineTo(state.w * (0.68 - i * 0.03), state.h * (0.72 - i * 0.045));
      ctx.lineTo(state.w * (0.65 - i * 0.03), state.h * (0.72 - i * 0.045));
    }
    ctx.stroke();
    ctx.restore();

    // drifting pages
    for (const p of pages) {
      const px = p.x * state.w + Math.sin(state.time * p.drift + p.rot) * 26;
      const py = p.y * state.h + Math.cos(state.time * 0.6 + p.rot) * 18;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(p.rot + state.time * 0.3);
      ctx.fillStyle = "rgba(239,246,255,0.26)";
      ctx.fillRect(-9, -6, 18, 12);
      ctx.fillStyle = "rgba(14,18,26,0.18)";
      ctx.fillRect(-5, -2, 10, 1.2);
      ctx.restore();
    }

    // subtle D on book spine
    ctx.save();
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = "rgba(228,241,255,0.8)";
    ctx.font = "bold 14px serif";
    ctx.fillText("D", state.w * 0.19, state.h * 0.44);
    ctx.restore();
  }

  function drawShelf(x, y, w, h, withLlamas = false) {
    ctx.save();
    ctx.fillStyle = "rgba(18,24,33,0.82)";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "rgba(32,39,52,0.82)";
    ctx.fillRect(x - 8, y, 8, h);
    for (let i = 0; i < 5; i++) {
      const sy = y + 18 + i * 30;
      ctx.fillStyle = "rgba(190,210,230,0.10)";
      ctx.fillRect(x + 4, sy, w - 8, 2);
    }
    for (let i = 0; i < 8; i++) {
      const bx = x + 6 + i * ((w - 18) / 8);
      const bh = 14 + (i % 3) * 12;
      ctx.fillStyle = `rgba(${60 + i * 8}, ${78 + i * 4}, ${90 + i * 6}, 0.72)`;
      ctx.fillRect(bx, y + h - bh - 10, 8, bh);
    }

    if (withLlamas) {
      // tiny llama pair
      const ly = y + h - 22;
      drawTinyLlama(x + w * 0.35, ly, 0.7, "rgba(231,236,241,0.85)");
      drawTinyLlama(x + w * 0.52, ly + 1, 0.72, "rgba(213,225,235,0.9)");
    }
    ctx.restore();
  }

  function drawTinyLlama(x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = color;
    ctx.fillRect(-8, -7, 15, 8);
    ctx.fillRect(4, -12, 6, 8);
    ctx.fillRect(-6, 1, 2, 7);
    ctx.fillRect(-1, 1, 2, 7);
    ctx.fillRect(4, 1, 2, 7);
    ctx.fillRect(8, 1, 2, 7);
    ctx.fillRect(8, -10, 3, 2); // ear
    ctx.fillRect(5, -10, 2, 2);
    ctx.restore();
  }

  function drawSeedScene(progress) {
    fillBG("rgba(6,12,22,1)", "rgba(1,4,8,1)");
    drawLibrary(1);

    const x = state.w * 0.5;
    const y = state.h * 0.54;
    const local = sceneProgress("seed");
    const pulses = 8;
    const pulseIndex = Math.floor(local * pulses);
    const pulseFrac = (local * pulses) % 1;
    const pulse = Math.sin(pulseFrac * Math.PI);
    const glowR = 10 + pulse * 20;

    // ice cocoon
    ctx.save();
    ctx.strokeStyle = "rgba(170, 220, 255, 0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, 54, 78, 0.2, 0, Math.PI * 2);
    ctx.stroke();

    const g = ctx.createRadialGradient(x, y, 0, x, y, glowR + 28);
    g.addColorStop(0, "rgba(241,255,191,0.94)");
    g.addColorStop(0.18, "rgba(195,255,158,0.42)");
    g.addColorStop(0.52, "rgba(122,221,255,0.18)");
    g.addColorStop(1, "rgba(122,221,255,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, glowR + 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(245,255,212,0.98)";
    ctx.beginPath();
    ctx.ellipse(x, y, 9, 16, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // pulse marks
    ctx.globalAlpha = 0.22;
    for (let i = 0; i <= pulseIndex; i++) {
      ctx.strokeStyle = "rgba(210,250,255,0.6)";
      ctx.beginPath();
      ctx.arc(x, y, 24 + i * 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShatter(progress) {
    fillBG("rgba(4,8,15,1)", "rgba(1,3,7,1)");

    // giant underside
    ctx.save();
    ctx.fillStyle = "rgba(145, 205, 242, 0.10)";
    ctx.beginPath();
    ctx.moveTo(-40, state.h * 0.25);
    ctx.quadraticCurveTo(state.w * 0.2, state.h * 0.08, state.w * 0.5, state.h * 0.18);
    ctx.quadraticCurveTo(state.w * 0.8, state.h * 0.26, state.w + 40, state.h * 0.12);
    ctx.lineTo(state.w + 40, 0);
    ctx.lineTo(-40, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    drawOverheadCracks(1, true);

    // falling plates / shards
    for (let i = 0; i < 16; i++) {
      const t = (i / 16 + progress * 1.1) % 1;
      const x = lerp(-40, state.w + 40, (i * 0.137) % 1);
      const y = lerp(state.h * 0.14, state.h * 1.1, t);
      const w = 12 + (i % 5) * 10;
      const h = 20 + (i % 4) * 14;
      ctx.save();
      ctx.translate(x + Math.sin(t * 8 + i) * 18, y);
      ctx.rotate(i + progress * 5);
      ctx.fillStyle = `rgba(180, 225, 250, ${0.11 + (1 - t) * 0.2})`;
      ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }

    // tiny reflection nod to penguins
    if (progress > 0.35 && progress < 0.58) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "rgba(240,248,255,0.6)";
      ctx.beginPath();
      ctx.ellipse(state.w * 0.57, state.h * 0.48, 14, 10, 0.2, 0, Math.PI * 2);
      ctx.ellipse(state.w * 0.59, state.h * 0.48, 14, 10, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawDarkTransition(progress) {
    fillBG("rgba(2,4,8,1)", "rgba(0,1,3,1)");
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (const b of bubbles) {
      const x = b.x * state.w + Math.sin(state.time * 0.3 + b.phase) * 8;
      const y = (b.y * state.h - state.time * 24 * b.s) % (state.h + 40);
      ctx.strokeStyle = "rgba(200, 238, 255, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, (y + state.h + 40) % (state.h + 40), b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // optional drifting page
    const px = state.w * 0.54 + Math.sin(state.time * 1.1) * 18;
    const py = state.h * 0.52 - progress * 140;
    ctx.translate(px, py);
    ctx.rotate(state.time * 0.4);
    ctx.fillStyle = "rgba(239,246,255,0.18)";
    ctx.fillRect(-10, -6, 20, 12);
    ctx.restore();
  }

  function drawFishAndWhale(progress) {
    fillBG("rgba(1,4,8,1)", "rgba(0,1,4,1)");

    // glows
    for (const f of fish) {
      const x =
        state.w * (0.14 + ((Math.sin(state.time * 0.35 + f.seed) + 1) * 0.38)) +
        Math.cos(state.time + f.seed) * 22;
      const y =
        state.h * (0.24 + ((Math.cos(state.time * 0.28 + f.seed * 1.6) + 1) * 0.28));
      const body = 8 * f.scale;
      const glow = 24 * f.scale;

      const g = ctx.createRadialGradient(x, y, 0, x, y, glow);
      g.addColorStop(0, "rgba(140,255,230,0.86)");
      g.addColorStop(0.25, "rgba(123,224,255,0.34)");
      g.addColorStop(1, "rgba(123,224,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, glow, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(200,255,245,0.94)";
      ctx.beginPath();
      ctx.ellipse(x, y, body, body * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - body, y);
      ctx.lineTo(x - body - 8, y - 5);
      ctx.lineTo(x - body - 8, y + 5);
      ctx.closePath();
      ctx.fill();
    }

    // whale body revealed by fish
    const reveal = clamp((progress - 0.18) / 0.82, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.18 + reveal * 0.56;
    ctx.fillStyle = "rgba(14, 22, 30, 0.98)";
    ctx.beginPath();
    ctx.ellipse(state.w * 0.58, state.h * 0.58, state.w * 0.32, state.h * 0.16, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(state.w * 0.78, state.h * 0.58);
    ctx.lineTo(state.w * 0.91, state.h * 0.53);
    ctx.lineTo(state.w * 0.9, state.h * 0.65);
    ctx.closePath();
    ctx.fill();

    // eye
    const ex = state.w * 0.43;
    const ey = state.h * 0.55;
    ctx.globalAlpha = 0.25 + reveal * 0.7;
    ctx.fillStyle = "rgba(176, 214, 238, 0.22)";
    ctx.beginPath();
    ctx.ellipse(ex, ey, 20, 12, 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(12,16,24,0.98)";
    ctx.beginPath();
    ctx.arc(ex, ey, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawEyeTransition(progress) {
    fillBG("rgba(0,1,4,1)", "rgba(0,0,0,1)");

    const ex = state.w * 0.48;
    const ey = state.h * 0.54;
    const zoom = easeInOutCubic(progress);
    const eyeW = lerp(70, state.w * 1.2, zoom);
    const eyeH = lerp(40, state.h * 0.75, zoom);

    ctx.save();

    // subtle whale darkness
    ctx.globalAlpha = 1 - progress * 0.4;
    ctx.fillStyle = "rgba(10,16,24,0.96)";
    ctx.beginPath();
    ctx.ellipse(state.w * 0.62, state.h * 0.58, state.w * 0.38, state.h * 0.19, -0.12, 0, Math.PI * 2);
    ctx.fill();

    // eye white / reflection area
    ctx.globalAlpha = 0.34;
    ctx.fillStyle = "rgba(180,208,230,0.24)";
    ctx.beginPath();
    ctx.ellipse(ex, ey, eyeW, eyeH, 0.02, 0, Math.PI * 2);
    ctx.fill();

    // hidden phrase in reflection
    if (progress < 0.72) {
      ctx.globalAlpha = 0.18 * (1 - progress);
      ctx.fillStyle = "rgba(232,242,255,0.85)";
      ctx.font = `${Math.max(18, state.w * 0.04)}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.fillText("my forever love", ex, ey + 4);
    }

    // pupil eats the screen
    const pupilR = lerp(10, Math.max(state.w, state.h) * 1.1, easeInCubic(progress));
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(0,0,0,1)";
    ctx.beginPath();
    ctx.arc(ex, ey, pupilR, 0, Math.PI * 2);
    ctx.fill();

    // last highlight = hint of a star
    if (progress < 0.4) {
      ctx.fillStyle = "rgba(240,248,255,0.94)";
      ctx.beginPath();
      ctx.arc(ex + eyeW * 0.22, ey - eyeH * 0.22, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPhrase() {
    const phrase = PHRASES.find((p) => state.time >= p.start && state.time <= p.end);
    if (!phrase) return;

    const p = invLerp(phrase.start, phrase.end, state.time);
    const alpha = Math.sin(p * Math.PI);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";

    if (phrase.mode === "ice") {
      ctx.fillStyle = "rgba(228, 247, 255, 0.92)";
      ctx.font = `${Math.max(20, state.w * 0.056)}px Georgia, serif`;
      ctx.translate(state.w * 0.5, state.h * 0.28 + Math.sin(state.time * 0.5) * 10);
      ctx.scale(1, 1.08);
      ctx.fillText(phrase.text, 0, 0);
    } else if (phrase.mode === "seam") {
      ctx.fillStyle = "rgba(233, 247, 255, 0.92)";
      ctx.font = `${Math.max(18, state.w * 0.05)}px Georgia, serif`;
      ctx.fillText(phrase.text, state.w * 0.56, state.h * 0.37);
    } else if (phrase.mode === "library") {
      ctx.fillStyle = "rgba(237, 241, 255, 0.9)";
      ctx.font = `${Math.max(19, state.w * 0.052)}px Georgia, serif`;
      ctx.fillText(
        phrase.text,
        state.w * 0.5 + Math.sin(state.time * 0.6) * 14,
        state.h * 0.3
      );
    } else if (phrase.mode === "seed") {
      ctx.fillStyle = "rgba(246, 255, 220, 0.96)";
      ctx.font = `${Math.max(18, state.w * 0.05)}px Georgia, serif`;
      ctx.fillText(phrase.text, state.w * 0.5, state.h * 0.42);
    } else if (phrase.mode === "water") {
      ctx.fillStyle = "rgba(217, 250, 255, 0.86)";
      ctx.font = `${Math.max(18, state.w * 0.054)}px Georgia, serif`;
      const y = state.h * 0.72 - p * 40;
      ctx.fillText(phrase.text, state.w * 0.5 + Math.sin(state.time * 0.9) * 12, y);

      // tiny text bubbles
      for (let i = 0; i < 7; i++) {
        const bx = state.w * 0.42 + i * 18 + Math.sin(state.time + i) * 4;
        const by = y + 28 - p * 26 - i * 6;
        ctx.strokeStyle = "rgba(220,245,255,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(bx, by, 2 + (i % 3), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function renderSurface() {
    fillBG("rgba(14, 22, 36, 1)", "rgba(188, 224, 242, 1)");
    drawAurora();
    drawSnow(1);
    drawGround();

    const approach = sceneProgress("approach");
    const pause = sceneProgress("pause");
    const kiss = sceneProgress("kiss");

    drawFootprints(approach);

    const p1Start = state.w * 0.26;
    const p1End = state.w * 0.46;
    const p2Start = state.w * 0.74;
    const p2End = state.w * 0.54;

    let p1x = p1Start;
    let p2x = p2Start;

    if (sceneActive("approach")) {
      p1x = lerp(p1Start, p1End, easeInOutCubic(approach));
      p2x = lerp(p2Start, p2End, easeInOutCubic(approach));
    } else if (state.time > SCENES.approach[1]) {
      p1x = p1End;
      p2x = p2End;
    }

    const y = state.h * 0.66;
    let slowMo = 0;
    if (sceneActive("kiss")) slowMo = Math.sin(kiss * Math.PI);

    const lean1 = sceneActive("kiss") ? lerp(0, 0.18, smooth(kiss)) : 0;
    const lean2 = sceneActive("kiss") ? lerp(0, -0.18, smooth(kiss)) : 0;
    const breathe = Math.sin(state.time * 2.1) * 1.2;

    // tiny visibility of breath
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 2; i++) {
      const bx = i === 0 ? p1x + 24 : p2x - 24;
      const by = y - 28;
      const puff = 10 + Math.sin(state.time * 1.8 + i) * 2;
      ctx.fillStyle = "rgba(240,248,255,0.24)";
      ctx.beginPath();
      ctx.arc(bx, by, puff, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    drawPenguin(p1x, y, 1.18, lean1, (Math.sin(state.time * 1.4) + 1) / 2, breathe);
    drawPenguin(p2x, y, 1.18, lean2, (Math.cos(state.time * 1.4) + 1) / 2, breathe);

    // kiss slow-motion sparkle / freeze
    if (sceneActive("kiss")) {
      ctx.save();
      ctx.globalAlpha = 0.1 + slowMo * 0.16;
      const g = ctx.createRadialGradient(
        state.w * 0.5,
        y - 28,
        0,
        state.w * 0.5,
        y - 28,
        120
      );
      g.addColorStop(0, "rgba(255,255,255,0.42)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(state.w * 0.5, y - 28, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (state.time >= 32) {
      const crackP = invLerp(32, 40, state.time);
      drawCrack(crackP, true);
    }
  }

  function renderDrop() {
    const p = sceneProgress("drop");
    fillBG("rgba(11, 22, 38, 1)", "rgba(4, 9, 16, 1)");

    // shrinking surface hole
    ctx.save();
    const holeW = lerp(state.w * 0.76, state.w * 0.18, easeOutCubic(p));
    const holeH = lerp(state.h * 0.18, state.h * 0.05, easeOutCubic(p));
    const glow = ctx.createRadialGradient(
      state.w * 0.5,
      state.h * 0.1,
      0,
      state.w * 0.5,
      state.h * 0.1,
      holeW
    );
    glow.addColorStop(0, "rgba(223,244,255,0.48)");
    glow.addColorStop(0.5, "rgba(149,212,255,0.16)");
    glow.addColorStop(1, "rgba(149,212,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(state.w * 0.5, state.h * 0.1, holeW, holeH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // fast passing walls
    for (let i = 0; i < 8; i++) {
      const depth = i / 7;
      const x = i < 4 ? lerp(-50, state.w * 0.2, depth) : lerp(state.w * 0.8, state.w + 50, depth - 0.5);
      const yOff = ((state.time * 220 * (0.6 + depth)) + i * 180) % (state.h + 300) - 150;
      ctx.save();
      ctx.translate(x, yOff);
      ctx.rotate(i < 4 ? -0.18 : 0.18);
      ctx.fillStyle = `rgba(160, 219, 255, ${0.06 + depth * 0.1})`;
      ctx.fillRect(-26, -120, 60, 240);
      ctx.restore();
    }

    // streaks and debris
    ctx.save();
    ctx.strokeStyle = "rgba(219, 243, 255, 0.16)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 18; i++) {
      const x = (i * 63 + state.time * -80) % (state.w + 40);
      const y = (i * 47 + state.time * 180) % (state.h + 100) - 50;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14, y + 50);
      ctx.stroke();
    }
    ctx.restore();

    drawOverheadCracks(p, true);
  }

  function render() {
    clear();

    if (state.time <= SCENES.kiss[1]) {
      renderSurface();
    } else if (sceneActive("drop")) {
      renderDrop();
    } else if (sceneActive("upperIce")) {
      drawUnderIceEnvironment("upper", sceneProgress("upperIce"));
    } else if (sceneActive("pressure")) {
      drawUnderIceEnvironment("pressure", sceneProgress("pressure"));
    } else if (sceneActive("library")) {
      drawLibrary(sceneProgress("library"));
    } else if (sceneActive("seed")) {
      drawSeedScene(sceneProgress("seed"));
    } else if (sceneActive("chase")) {
      drawUnderIceEnvironment("chase", sceneProgress("chase"));
    } else if (sceneActive("shatter")) {
      drawShatter(sceneProgress("shatter"));
    } else if (sceneActive("dark")) {
      drawDarkTransition(sceneProgress("dark"));
    } else if (sceneActive("whale")) {
      drawFishAndWhale(sceneProgress("whale"));
    } else if (sceneActive("eye")) {
      drawEyeTransition(sceneProgress("eye"));
    } else if (state.time >= DURATION) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, state.w, state.h);
    }

    drawPhrase();
  }

  // UI
  startBtn.addEventListener("click", () => {
    intro.classList.add("hidden");
    play();
  });

  playBtn.addEventListener("click", () => {
    intro.classList.add("hidden");
    play();
  });

  pauseBtn.addEventListener("click", pause);

  restartBtn.addEventListener("click", () => {
    pause();
    restart();
  });

  scrub.addEventListener("input", (e) => {
    state.time = clamp(parseFloat(e.target.value), 0, DURATION);
    updateUI();
    render();
  });

  window.addEventListener("resize", () => {
    resize();
    render();
  });

  resize();
  updateUI();
  render();
})();
