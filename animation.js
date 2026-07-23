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
  const TOTAL = 164;

  const BEATS = {
    surface: [0, 8],
    kiss: [8, 12],
    entry: [12, 18],
    descent: [18, 78],
    bottom: [78, 84],
    fracture: [84, 92],
    blackout: [92, 96],
    fish: [96, 103],
    whale: [103, 114],
    eye: [114, 119],
    space: [119, 128],
    earth: [128, 139],
    atmosphere: [139, 149],
    returnSnow: [149, 164],
  };

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
  const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2);
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

  function fmt(t) {
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function updateUI() {
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

  function rgba(rgb, alpha = 1) {
    return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`;
  }

  function mixColor(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  }

  function fillGradient(top, bottom) {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.h);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  const snow = Array.from({ length: 110 }, (_, i) => ({
    x: hash(i + 1) * VIEW.w,
    y: hash(i + 40) * VIEW.h,
    r: 1 + hash(i + 80) * 4,
    speed: 10 + hash(i + 120) * 28,
    drift: 8 + hash(i + 160) * 22,
    phase: hash(i + 200) * Math.PI * 2,
  }));

  const stars = Array.from({ length: 230 }, (_, i) => ({
    a: hash(i + 301) * Math.PI * 2,
    r: Math.sqrt(hash(i + 601)) * 780,
    size: 0.8 + hash(i + 901) * 3.1,
    alpha: 0.25 + hash(i + 1201) * 0.75,
    twinkle: 0.8 + hash(i + 1501) * 2.2,
  }));

  const fish = Array.from({ length: 15 }, (_, i) => ({
    phase: hash(i + 55) * Math.PI * 2,
    lane: hash(i + 88),
    scale: 0.55 + hash(i + 122) * 0.95,
    speed: 0.55 + hash(i + 166) * 0.7,
  }));

  function makeShard(seed, cx, cy, radius, points) {
    const vertices = [];
    for (let i = 0; i < points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
      const r = radius * (0.58 + hash(seed * 30 + i) * 0.55);
      vertices.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    return {
      cx,
      cy,
      vertices,
      drift: -80 + hash(seed + 1) * 160,
      fall: 520 + hash(seed + 2) * 520,
      spin: (-0.65 + hash(seed + 3) * 1.3) * 1.3,
      delay: hash(seed + 4) * 0.35,
      light: hash(seed + 5),
    };
  }

  const shards = [
    makeShard(1, 188, 480, 155, 7),
    makeShard(2, 438, 420, 205, 8),
    makeShard(3, 726, 500, 180, 7),
    makeShard(4, 920, 420, 128, 6),
    makeShard(5, 330, 650, 90, 7),
    makeShard(6, 620, 670, 112, 7),
    makeShard(7, 830, 700, 78, 6),
    makeShard(8, 120, 730, 68, 6),
  ];

  function drawSnowField(time, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (const flake of snow) {
      const y = (flake.y + time * flake.speed) % (VIEW.h + 120) - 60;
      const x = flake.x + Math.sin(time * 0.45 + flake.phase) * flake.drift;
      ctx.fillStyle = `rgba(246,251,255,${0.32 + flake.r * 0.09})`;
      ctx.beginPath();
      ctx.arc(x, y, flake.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAurora(time, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "screen";
    for (let layer = 0; layer < 4; layer += 1) {
      const yBase = 240 + layer * 78;
      const gradient = ctx.createLinearGradient(0, yBase - 80, 0, yBase + 220);
      gradient.addColorStop(0, "rgba(112,255,216,0)");
      gradient.addColorStop(0.35, layer % 2 ? "rgba(114,209,255,0.18)" : "rgba(112,255,216,0.2)");
      gradient.addColorStop(0.68, "rgba(156,124,255,0.08)");
      gradient.addColorStop(1, "rgba(120,210,255,0)");
      ctx.strokeStyle = gradient;
      ctx.lineWidth = 44 - layer * 5;
      ctx.beginPath();
      for (let x = -40; x <= VIEW.w + 40; x += 24) {
        const nx = x / VIEW.w;
        const y = yBase + Math.sin(nx * 6.2 + time * 0.13 + layer) * 74 + Math.sin(nx * 12.5 + layer * 2.2) * 22;
        if (x === -40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShootingStar(progress, y = 320) {
    if (progress <= 0 || progress >= 1) return;
    const p = easeInOut(progress);
    const x = lerp(-150, VIEW.w + 180, p);
    const yy = y + p * 190;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const gradient = ctx.createLinearGradient(x - 210, yy - 120, x, yy);
    gradient.addColorStop(0, "rgba(255,255,255,0)");
    gradient.addColorStop(0.72, "rgba(175,226,255,0.26)");
    gradient.addColorStop(1, "rgba(255,255,255,0.96)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 210, yy - 120);
    ctx.lineTo(x, yy);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.beginPath();
    ctx.arc(x, yy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPenguin(x, y, scale, facing = 1, lean = 0, hold = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * facing, scale);
    ctx.rotate(lean);

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 58, 38, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d6a348";
    ctx.beginPath();
    ctx.ellipse(-15, 50, 14, 6, 0.12, 0, Math.PI * 2);
    ctx.ellipse(14, 50, 14, 6, -0.12, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(-28, -38, 28, 45);
    body.addColorStop(0, "#151b22");
    body.addColorStop(0.55, "#0b1016");
    body.addColorStop(1, "#1d2530");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 2, 34, 52, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f3f7f7";
    ctx.beginPath();
    ctx.ellipse(4, 10, 24, 39, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#11171e";
    ctx.beginPath();
    ctx.ellipse(4, -43, 29, 27, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f5f8f8";
    ctx.beginPath();
    ctx.ellipse(11, -39, 18, 19, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0b0f14";
    ctx.beginPath();
    ctx.arc(17, -46, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#d79c3d";
    ctx.beginPath();
    ctx.moveTo(22, -38);
    ctx.lineTo(47, -32);
    ctx.lineTo(21, -27);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0b1016";
    ctx.beginPath();
    if (hold) {
      ctx.moveTo(-24, -4);
      ctx.quadraticCurveTo(-54, 8, -67, 25);
      ctx.quadraticCurveTo(-45, 19, -20, 14);
    } else {
      ctx.moveTo(-26, -5);
      ctx.quadraticCurveTo(-43, 10, -38, 34);
      ctx.quadraticCurveTo(-26, 22, -18, 10);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawSurfaceScene(progress, finalPose = false) {
    fillGradient("#102238", "#9cc7dd");
    drawAurora(state.time, finalPose ? 0.88 : 0.18);

    ctx.fillStyle = "rgba(236,247,252,0.92)";
    ctx.beginPath();
    ctx.moveTo(0, 1260);
    ctx.quadraticCurveTo(260, 1180, 520, 1235);
    ctx.quadraticCurveTo(790, 1305, 1080, 1200);
    ctx.lineTo(1080, 1920);
    ctx.lineTo(0, 1920);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(193,220,232,0.22)";
    for (let i = 0; i < 7; i += 1) {
      ctx.beginPath();
      ctx.ellipse(110 + i * 160, 1370 + Math.sin(i) * 28, 120, 22, -0.08 + i * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }

    drawSnowField(state.time, finalPose ? 0.9 : 0.72);

    if (finalPose) {
      drawPenguin(470, 1280, 1.5, 1, 0.02, true);
      drawPenguin(610, 1280, 1.5, -1, -0.02, true);
      ctx.save();
      ctx.strokeStyle = "rgba(20,28,36,0.9)";
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(520, 1290);
      ctx.quadraticCurveTo(540, 1307, 560, 1290);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const kiss = active("kiss") ? beat("kiss") : state.time > BEATS.kiss[1] ? 1 : 0;
    const approach = smooth(progress);
    const leftX = lerp(435, 492, approach);
    const rightX = lerp(645, 588, approach);
    const slow = smooth(kiss);
    drawPenguin(leftX, 1260, 1.42, 1, lerp(0, 0.08, slow));
    drawPenguin(rightX, 1260, 1.42, -1, lerp(0, -0.08, slow));
  }

  function drawOpeningCrack(progress, yOffset = 0) {
    if (progress <= 0) return;
    const p = easeOut(progress);
    ctx.save();
    ctx.translate(0, yOffset);
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(117,210,255,0.55)";
    ctx.strokeStyle = "rgba(95,171,214,0.92)";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    const points = [
      [542, 1290], [520, 1340], [555, 1384], [508, 1436], [548, 1496],
      [498, 1560], [530, 1625], [474, 1690], [506, 1762], [452, 1840], [474, 1938],
    ];
    const visible = Math.max(2, Math.floor(lerp(2, points.length, p)));
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < visible; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.72;
    for (let b = 0; b < visible - 2; b += 2) {
      const [x, y] = points[b + 1];
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (b % 4 ? -1 : 1) * (50 + b * 4), y + 42 + b * 4);
      ctx.lineTo(x + (b % 4 ? -1 : 1) * (78 + b * 4), y + 76 + b * 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function iceColorAtDepth(p) {
    const stops = [
      [0, [225, 247, 255]],
      [0.2, [175, 230, 249]],
      [0.45, [69, 161, 215]],
      [0.7, [18, 68, 132]],
      [0.88, [7, 27, 66]],
      [1, [2, 9, 26]],
    ];
    for (let i = 0; i < stops.length - 1; i += 1) {
      const [ap, ac] = stops[i];
      const [bp, bc] = stops[i + 1];
      if (p <= bp) return mixColor(ac, bc, inv(ap, bp, p));
    }
    return stops.at(-1)[1];
  }

  function drawIceBand(worldY, camY, index, depth) {
    const sy = worldY - camY + 340;
    const wobble = Math.sin(worldY * 0.0017 + index * 1.3) * 56 + Math.sin(worldY * 0.006 + index) * 18;
    const thickness = 150 + hash(index + 20) * 250;
    const base = iceColorAtDepth(depth);
    const lighter = mixColor(base, [255, 255, 255], 0.22);
    const darker = mixColor(base, [0, 9, 24], 0.24);

    const gradient = ctx.createLinearGradient(0, sy - thickness, VIEW.w, sy + thickness);
    gradient.addColorStop(0, rgba(lighter, 0.42));
    gradient.addColorStop(0.45, rgba(base, 0.8));
    gradient.addColorStop(1, rgba(darker, 0.9));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(-120, sy - thickness * 0.55);
    ctx.bezierCurveTo(220, sy - thickness + wobble, 700, sy - thickness * 0.42 - wobble, 1200, sy - thickness * 0.75);
    ctx.lineTo(1200, sy + thickness * 0.65);
    ctx.bezierCurveTo(760, sy + thickness + wobble * 0.4, 290, sy + thickness * 0.35 - wobble * 0.4, -120, sy + thickness * 0.82);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rgba(lighter, 0.2);
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  function drawIceFacets(camY, depth) {
    for (let i = 0; i < 34; i += 1) {
      const worldY = i * 430 - 900;
      const loop = 34 * 430;
      const wrapped = ((worldY - camY * 0.08) % loop + loop) % loop;
      const sy = wrapped - 520;
      const x = hash(i + 44) * VIEW.w;
      const radius = 90 + hash(i + 90) * 240;
      const base = iceColorAtDepth(depth);
      ctx.save();
      ctx.translate(x, sy);
      ctx.rotate((-0.4 + hash(i + 140) * 0.8) + Math.sin(state.time * 0.05 + i) * 0.015);
      ctx.fillStyle = rgba(mixColor(base, [255, 255, 255], hash(i + 160) * 0.25), 0.09 + hash(i + 200) * 0.11);
      ctx.beginPath();
      const points = 5 + (i % 4);
      for (let k = 0; k < points; k += 1) {
        const a = (k / points) * Math.PI * 2;
        const r = radius * (0.6 + hash(i * 20 + k) * 0.5);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r * 0.66;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawTrappedBubbles(camY, depth) {
    if (depth > 0.55) return;
    ctx.save();
    for (let i = 0; i < 48; i += 1) {
      const wy = i * 310 + hash(i + 15) * 180;
      const loop = 48 * 310;
      const sy = ((wy - camY * 0.72) % loop + loop) % loop - 300;
      const x = 80 + hash(i + 60) * 920;
      const r = 4 + hash(i + 100) * 16;
      ctx.strokeStyle = `rgba(238,250,255,${0.08 + (1 - depth) * 0.13})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, sy, r, r * 1.35, hash(i + 140), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function crackX(worldY, branch = 0) {
    return 540 + Math.sin(worldY * 0.00125 + branch * 1.7) * (190 + branch * 34) + Math.sin(worldY * 0.0048 + branch) * 65;
  }

  function drawPursuitCracks(camY, depth, intensity) {
    const cameraFront = camY + 420;
    const pulse = Math.sin(state.time * 0.72) * 420;
    const crackFront = camY + lerp(-350, 1120, intensity) + pulse;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (let branch = 0; branch < 4; branch += 1) {
      ctx.beginPath();
      let started = false;
      for (let wy = Math.max(0, camY - 500); wy <= camY + VIEW.h + 900; wy += 70) {
        if (wy > crackFront - branch * 180) break;
        const sy = wy - camY + 240;
        const x = crackX(wy, branch) + (branch - 1.5) * 70;
        if (!started) {
          ctx.moveTo(x, sy);
          started = true;
        } else {
          ctx.lineTo(x, sy);
        }
      }
      const near = clamp(1 - Math.abs(crackFront - cameraFront) / 1700);
      ctx.shadowBlur = 16 + near * 30;
      ctx.shadowColor = "rgba(117,222,255,0.65)";
      ctx.strokeStyle = `rgba(186,235,255,${0.22 + near * 0.62})`;
      ctx.lineWidth = 2.2 + near * 3.4;
      ctx.stroke();
    }

    if (depth > 0.35) {
      ctx.globalAlpha = 0.18 + intensity * 0.26;
      for (let i = 0; i < 9; i += 1) {
        const wy = camY + 200 + i * 240;
        if (wy > crackFront) continue;
        const sy = wy - camY + 240;
        const x = crackX(wy, i % 3);
        ctx.beginPath();
        ctx.moveTo(x, sy);
        ctx.lineTo(x + (i % 2 ? -1 : 1) * (110 + i * 8), sy + 80);
        ctx.lineTo(x + (i % 2 ? -1 : 1) * (160 + i * 12), sy + 170);
        ctx.strokeStyle = "rgba(189,234,255,0.52)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawIceDescent(progress) {
    const p = smooth(progress);
    const depth = p;
    const camY = p * 13200;
    const sway = Math.sin(p * Math.PI * 5.5) * 70 + Math.sin(p * Math.PI * 13) * 24;
    const tilt = Math.sin(p * Math.PI * 4) * 0.012;
    const base = iceColorAtDepth(depth);
    const top = mixColor(base, [255, 255, 255], lerp(0.12, 0, depth));
    const bottom = mixColor(base, [0, 4, 15], lerp(0.06, 0.48, depth));
    fillGradient(rgba(top), rgba(bottom));

    ctx.save();
    ctx.translate(sway, 0);
    ctx.rotate(tilt);

    for (let i = -4; i < 34; i += 1) {
      drawIceBand(i * 470, camY, i, depth);
    }
    drawIceFacets(camY, depth);
    drawTrappedBubbles(camY, depth);
    drawPursuitCracks(camY, depth, clamp(0.2 + p * 0.95));

    if (depth > 0.7) {
      ctx.save();
      ctx.globalAlpha = inv(0.7, 1, depth) * 0.6;
      for (let i = 0; i < 16; i += 1) {
        const x = hash(i + 401) * VIEW.w;
        const y = ((hash(i + 451) * VIEW.h + state.time * (80 + hash(i + 501) * 110)) % (VIEW.h + 240)) - 120;
        ctx.fillStyle = "rgba(184,225,247,0.2)";
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10 + hash(i + 551) * 22, y + 26 + hash(i + 601) * 34);
        ctx.lineTo(x - 12, y + 38);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();

    const edgeShade = ctx.createRadialGradient(VIEW.w * 0.52, VIEW.h * 0.48, 100, VIEW.w * 0.52, VIEW.h * 0.48, 900);
    edgeShade.addColorStop(0, "rgba(0,0,0,0)");
    edgeShade.addColorStop(1, `rgba(0,4,14,${0.08 + depth * 0.26})`);
    ctx.fillStyle = edgeShade;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  function drawEntry(progress) {
    const p = easeInOut(progress);
    fillGradient("#102338", "#9ec8db");
    const shift = p * 1420;
    ctx.save();
    ctx.translate(0, -shift);
    drawSurfaceScene(1);
    drawOpeningCrack(1, 0);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = smooth(p);
    ctx.translate(0, lerp(1280, 0, p));
    drawIceDescent(p * 0.08);
    ctx.restore();

    const dark = ctx.createLinearGradient(0, 0, 0, VIEW.h);
    dark.addColorStop(0, `rgba(2,8,18,${p * 0.25})`);
    dark.addColorStop(1, `rgba(1,5,13,${p * 0.45})`);
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  function undersidePath() {
    const path = new Path2D();
    path.moveTo(-80, -40);
    path.lineTo(1160, -40);
    path.lineTo(1160, 500);
    path.lineTo(980, 570);
    path.lineTo(850, 520);
    path.lineTo(720, 650);
    path.lineTo(590, 540);
    path.lineTo(460, 690);
    path.lineTo(330, 540);
    path.lineTo(180, 620);
    path.lineTo(-80, 520);
    path.closePath();
    return path;
  }

  function drawBottom(progress, fractureProgress = 0) {
    fillGradient("#07162b", "#00040a");
    ctx.save();
    const path = undersidePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, 720);
    gradient.addColorStop(0, "#1c5c9b");
    gradient.addColorStop(0.5, "#0b3265");
    gradient.addColorStop(1, "#04152e");
    ctx.fillStyle = gradient;
    ctx.fill(path);

    ctx.save();
    ctx.clip(path);
    for (let i = 0; i < 18; i += 1) {
      const y = 40 + i * 38;
      ctx.strokeStyle = `rgba(177,224,250,${0.04 + i * 0.004})`;
      ctx.lineWidth = 8 + (i % 4) * 3;
      ctx.beginPath();
      ctx.moveTo(-80, y + Math.sin(i) * 35);
      ctx.bezierCurveTo(250, y - 45, 710, y + 50, 1160, y - 10);
      ctx.stroke();
    }
    ctx.restore();

    if (fractureProgress > 0) {
      const fp = easeOut(fractureProgress);
      const converge = [
        [[120, 220], [310, 330], [500, 470], [555, 610]],
        [[970, 180], [790, 330], [650, 470], [555, 610]],
        [[540, 60], [565, 230], [540, 400], [555, 610]],
        [[260, 510], [390, 535], [490, 575], [555, 610]],
      ];
      ctx.lineJoin = "round";
      for (const branch of converge) {
        ctx.beginPath();
        ctx.moveTo(branch[0][0], branch[0][1]);
        const visible = Math.max(2, Math.floor(lerp(2, branch.length, fp)));
        for (let i = 1; i < visible; i += 1) ctx.lineTo(branch[i][0], branch[i][1]);
        ctx.shadowBlur = 34;
        ctx.shadowColor = "rgba(136,226,255,0.74)";
        ctx.strokeStyle = "rgba(212,247,255,0.9)";
        ctx.lineWidth = 5;
        ctx.stroke();
      }
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.4;
    for (let i = 0; i < 36; i += 1) {
      const x = hash(i + 820) * VIEW.w;
      const y = 740 + ((hash(i + 870) * 1180 + state.time * (10 + hash(i + 920) * 16)) % 1180);
      ctx.fillStyle = "rgba(193,231,250,0.24)";
      ctx.beginPath();
      ctx.arc(x, y, 1 + hash(i + 970) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawShard(shard, progress, index) {
    const local = clamp((progress - shard.delay) / (1 - shard.delay));
    if (local <= 0) return;
    const p = easeIn(local);
    ctx.save();
    ctx.translate(shard.cx + shard.drift * p, shard.cy + shard.fall * p * p);
    ctx.rotate(shard.spin * p + index * 0.08);

    const gradient = ctx.createLinearGradient(-160, -160, 180, 180);
    gradient.addColorStop(0, "rgba(181,230,253,0.88)");
    gradient.addColorStop(0.42, "rgba(46,117,173,0.82)");
    gradient.addColorStop(1, "rgba(5,28,62,0.92)");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "rgba(222,248,255,0.46)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    shard.vertices.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(240,252,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shard.vertices[0][0], shard.vertices[0][1]);
    ctx.lineTo(0, 0);
    ctx.lineTo(shard.vertices[3 % shard.vertices.length][0], shard.vertices[3 % shard.vertices.length][1]);
    ctx.stroke();
    ctx.restore();
  }

  function drawShatter(progress) {
    drawBottom(1, 1);
    const p = smooth(progress);
    for (let i = 0; i < shards.length; i += 1) drawShard(shards[i], p, i);

    ctx.save();
    ctx.globalAlpha = easeIn(p) * 0.75;
    const dark = ctx.createLinearGradient(0, 450, 0, VIEW.h);
    dark.addColorStop(0, "rgba(0,0,0,0)");
    dark.addColorStop(0.42, "rgba(0,2,7,0.42)");
    dark.addColorStop(1, "rgba(0,0,0,0.98)");
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.restore();
  }

  function drawDeepParticles(alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    for (let i = 0; i < 70; i += 1) {
      const x = hash(i + 1040) * VIEW.w;
      const y = (hash(i + 1100) * VIEW.h - state.time * (3 + hash(i + 1160) * 5) + VIEW.h) % VIEW.h;
      ctx.fillStyle = `rgba(172,222,237,${0.04 + hash(i + 1220) * 0.12})`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + hash(i + 1280) * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFish(progress, includeWhale = false) {
    fillGradient("#01050b", "#000104");
    drawDeepParticles(0.8);
    const p = smooth(progress);
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < fish.length; i += 1) {
      const f = fish[i];
      const local = clamp((p * 1.4 - i * 0.045));
      const x = lerp(-120, VIEW.w + 140, (state.time * 0.025 * f.speed + f.phase) % 1);
      const y = 360 + f.lane * 1050 + Math.sin(state.time * 0.5 + f.phase) * 80;
      const glowR = 42 * f.scale;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      glow.addColorStop(0, `rgba(146,255,235,${0.68 * local})`);
      glow.addColorStop(0.28, `rgba(87,219,255,${0.27 * local})`);
      glow.addColorStop(1, "rgba(75,211,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = local;
      ctx.fillStyle = "rgba(202,255,247,0.94)";
      ctx.beginPath();
      ctx.ellipse(x, y, 12 * f.scale, 6 * f.scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x - 10 * f.scale, y);
      ctx.lineTo(x - 20 * f.scale, y - 8 * f.scale);
      ctx.lineTo(x - 20 * f.scale, y + 8 * f.scale);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (includeWhale) drawWhaleScene(0, 0.24 + p * 0.5);
  }

  function whalePath() {
    const p = new Path2D();
    p.moveTo(-420, -30);
    p.bezierCurveTo(-300, -155, 90, -190, 335, -82);
    p.bezierCurveTo(430, -40, 455, 20, 405, 70);
    p.bezierCurveTo(300, 175, -95, 175, -360, 72);
    p.bezierCurveTo(-430, 42, -455, 2, -420, -30);
    p.closePath();
    return p;
  }

  function drawWhaleLocal(reveal = 1) {
    ctx.save();
    const body = ctx.createLinearGradient(-450, -170, 440, 170);
    body.addColorStop(0, "rgba(1,9,18,0.98)");
    body.addColorStop(0.45, "rgba(8,27,41,0.98)");
    body.addColorStop(0.78, "rgba(18,48,61,0.98)");
    body.addColorStop(1, "rgba(6,18,28,0.98)");
    ctx.globalAlpha = reveal;
    ctx.fillStyle = body;
    ctx.fill(whalePath());

    ctx.fillStyle = "rgba(4,14,22,0.98)";
    ctx.beginPath();
    ctx.moveTo(-410, -10);
    ctx.bezierCurveTo(-515, -120, -585, -105, -630, -28);
    ctx.bezierCurveTo(-570, -10, -520, 16, -430, 20);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-420, 24);
    ctx.bezierCurveTo(-525, 130, -590, 120, -635, 44);
    ctx.bezierCurveTo(-560, 18, -510, 0, -430, 2);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(5,18,27,0.96)";
    ctx.beginPath();
    ctx.moveTo(110, 95);
    ctx.bezierCurveTo(5, 250, -80, 260, -125, 140);
    ctx.bezierCurveTo(-20, 142, 55, 115, 110, 95);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(105,170,189,0.13)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 9; i += 1) {
      ctx.beginPath();
      ctx.moveTo(250 + i * 10, 55);
      ctx.quadraticCurveTo(285 + i * 10, 92, 300 + i * 8, 120);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(110,164,183,0.22)";
    ctx.beginPath();
    ctx.ellipse(297, -38, 26, 15, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,2,5,0.98)";
    ctx.beginPath();
    ctx.ellipse(302, -39, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(221,248,255,0.72)";
    ctx.beginPath();
    ctx.arc(306, -43, 2.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function whalePose(progress) {
    const p = smooth(progress);
    return {
      x: lerp(420, 180, p),
      y: lerp(1050, 1010, p),
      scale: lerp(0.9, 1.34, p),
      rotation: lerp(-0.08, -0.025, p),
    };
  }

  function drawWhaleScene(progress, reveal = 1) {
    fillGradient("#01050a", "#000104");
    drawDeepParticles(0.9);
    const pose = whalePose(progress);
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.rotation);
    ctx.scale(pose.scale, pose.scale);
    drawWhaleLocal(reveal);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 9; i += 1) {
      const x = 180 + ((state.time * 32 + i * 155) % 1100);
      const y = 520 + Math.sin(state.time * 0.55 + i) * 330 + i * 42;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 38);
      glow.addColorStop(0, "rgba(134,255,234,0.72)");
      glow.addColorStop(1, "rgba(70,220,255,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(210,255,247,0.9)";
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEyeApproach(progress) {
    fillGradient("#01050a", "#000104");
    drawDeepParticles(0.45 * (1 - progress));
    const p = easeInOut(progress);
    const eyeLocal = { x: 302, y: -39 };
    const scale = lerp(1.34, 9.5, easeIn(p));
    const rotation = lerp(-0.025, 0, p);
    const x = VIEW.w * 0.5 - eyeLocal.x * scale;
    const y = VIEW.h * 0.5 - eyeLocal.y * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(scale, scale);
    drawWhaleLocal(1);
    ctx.restore();

    const black = smooth(inv(0.72, 1, p));
    ctx.fillStyle = `rgba(0,0,0,${black})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  function drawStars(progress) {
    fillGradient("#000104", "#000000");
    const p = smooth(progress);
    ctx.save();
    ctx.translate(VIEW.w / 2, VIEW.h / 2);
    ctx.rotate(state.time * 0.006);
    for (const star of stars) {
      const appear = clamp((p * 1.45 - star.r / 1500));
      const twinkle = 0.72 + Math.sin(state.time * star.twinkle + star.a * 4) * 0.28;
      ctx.globalAlpha = appear * star.alpha * twinkle;
      ctx.fillStyle = "#eef8ff";
      ctx.beginPath();
      ctx.arc(Math.cos(star.a) * star.r, Math.sin(star.a) * star.r, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    drawShootingStar(inv(0.22, 0.58, p), 300);
    if (p > 0.48) drawEarth(clamp((p - 0.48) / 0.52), 80 + (p - 0.48) * 80);
  }

  function irregularBlob(cx, cy, radius, seed, points = 10) {
    ctx.beginPath();
    for (let i = 0; i < points; i += 1) {
      const a = (i / points) * Math.PI * 2;
      const r = radius * (0.66 + hash(seed * 20 + i) * 0.46);
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r * 0.7;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawEarth(rotationProgress, radius) {
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const glow = ctx.createRadialGradient(cx, cy, radius * 0.78, cx, cy, radius * 1.38);
    glow.addColorStop(0, "rgba(74,171,255,0)");
    glow.addColorStop(0.72, "rgba(75,173,255,0.12)");
    glow.addColorStop(1, "rgba(75,173,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    const ocean = ctx.createRadialGradient(cx - radius * 0.4, cy - radius * 0.45, radius * 0.1, cx, cy, radius * 1.2);
    ocean.addColorStop(0, "#63bbef");
    ocean.addColorStop(0.48, "#1879bd");
    ocean.addColorStop(1, "#05284e");
    ctx.fillStyle = ocean;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    const shift = Math.sin(rotationProgress * Math.PI * 2) * radius * 0.55;
    ctx.fillStyle = "rgba(77,138,83,0.94)";
    irregularBlob(cx - radius * 0.28 + shift, cy - radius * 0.12, radius * 0.34, 10, 11);
    ctx.fill();
    irregularBlob(cx + radius * 0.4 + shift * 0.5, cy + radius * 0.18, radius * 0.28, 12, 9);
    ctx.fill();
    irregularBlob(cx - radius * 0.5 + shift * 0.7, cy + radius * 0.44, radius * 0.18, 14, 8);
    ctx.fill();

    ctx.fillStyle = "rgba(241,249,255,0.78)";
    for (let i = 0; i < 7; i += 1) {
      const x = cx - radius * 0.8 + ((i * 0.31 + rotationProgress * 0.16) % 1.6) * radius;
      const y = cy - radius * 0.62 + i * radius * 0.2;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * (0.24 + (i % 3) * 0.04), radius * 0.07, 0.22, 0, Math.PI * 2);
      ctx.fill();
    }

    const shade = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    shade.addColorStop(0, "rgba(255,255,255,0.24)");
    shade.addColorStop(0.52, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.52)");
    ctx.fillStyle = shade;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.restore();

    ctx.strokeStyle = "rgba(170,224,255,0.72)";
    ctx.lineWidth = Math.max(2, radius * 0.022);
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawEarthApproach(progress) {
    fillGradient("#000104", "#000000");
    const p = easeInOut(progress);
    ctx.save();
    ctx.translate(VIEW.w / 2, VIEW.h / 2);
    ctx.rotate(state.time * 0.004 * (1 - p));
    for (const star of stars) {
      ctx.globalAlpha = (1 - p * 0.78) * star.alpha;
      ctx.fillStyle = "#eef8ff";
      ctx.beginPath();
      ctx.arc(Math.cos(star.a) * star.r, Math.sin(star.a) * star.r, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    drawEarth(p * 0.92, lerp(110, 980, easeIn(p)));
  }

  function drawCloudDive(progress) {
    const p = easeInOut(progress);
    fillGradient("#163e69", "#78b7d4");
    const earthRadius = lerp(980, 1700, clamp(p * 1.15));
    drawEarth(0.92 + p * 0.22, earthRadius);

    ctx.save();
    const cloudP = smooth(inv(0.18, 0.88, p));
    for (let i = 0; i < 22; i += 1) {
      const phase = hash(i + 1800);
      const x = lerp(-240, 1320, (phase + p * (0.28 + hash(i + 1840) * 0.28)) % 1.35);
      const y = 120 + hash(i + 1880) * 1650;
      const scale = lerp(0.5, 2.6, cloudP) * (0.65 + hash(i + 1920));
      const alpha = cloudP * (0.22 + hash(i + 1960) * 0.42);
      ctx.fillStyle = `rgba(248,252,255,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 170 * scale, 70 * scale, hash(i + 2000) * 0.5 - 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + 110 * scale, y + 16 * scale, 130 * scale, 60 * scale, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const white = easeIn(inv(0.72, 1, p));
    ctx.fillStyle = `rgba(255,255,255,${white})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  function drawFinalReturn(progress) {
    const p = smooth(progress);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    ctx.save();
    ctx.globalAlpha = p;
    drawSurfaceScene(1, true);
    drawShootingStar(inv(0.24, 0.48, p), 270);
    ctx.restore();

    const textP = smooth(inv(0.62, 0.9, p));
    if (textP > 0) {
      ctx.save();
      ctx.globalAlpha = textP;
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(245,250,255,0.94)";
      ctx.shadowBlur = 24;
      ctx.shadowColor = "rgba(102,207,255,0.42)";
      ctx.font = "500 82px Georgia, 'Times New Roman', serif";
      ctx.fillText("forever", VIEW.w / 2, 1640);
      ctx.restore();
    }
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#02050a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    beginVirtual();

    if (active("surface")) {
      drawSurfaceScene(beat("surface"));
    } else if (active("kiss")) {
      drawSurfaceScene(1);
      drawOpeningCrack(beat("kiss"));
      const glow = Math.sin(beat("kiss") * Math.PI);
      ctx.fillStyle = `rgba(225,247,255,${glow * 0.06})`;
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
    } else if (active("entry")) {
      drawEntry(beat("entry"));
    } else if (active("descent")) {
      drawIceDescent(beat("descent"));
    } else if (active("bottom")) {
      drawBottom(beat("bottom"), 0);
    } else if (active("fracture")) {
      const p = beat("fracture");
      if (p < 0.47) drawBottom(1, p / 0.47);
      else drawShatter((p - 0.47) / 0.53);
    } else if (active("blackout")) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, VIEW.w, VIEW.h);
      const p = beat("blackout");
      if (p < 0.35) {
        ctx.globalAlpha = 1 - p / 0.35;
        drawDeepParticles(0.2);
        ctx.globalAlpha = 1;
      }
    } else if (active("fish")) {
      drawFish(beat("fish"), true);
    } else if (active("whale")) {
      drawWhaleScene(beat("whale"), 1);
    } else if (active("eye")) {
      drawEyeApproach(beat("eye"));
    } else if (active("space")) {
      drawStars(beat("space"));
    } else if (active("earth")) {
      drawEarthApproach(beat("earth"));
    } else if (active("atmosphere")) {
      drawCloudDive(beat("atmosphere"));
    } else if (active("returnSnow")) {
      drawFinalReturn(beat("returnSnow"));
    } else {
      drawFinalReturn(1);
    }
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

  const params = new URLSearchParams(window.location.search);
  const requestedTime = Number(params.get("time"));
  if (Number.isFinite(requestedTime)) state.time = clamp(requestedTime, 0, TOTAL);

  resize();
  updateUI();
  render();

  if (params.get("autoplay") === "1") {
    intro.classList.add("is-hidden");
    play();
  }
})();
