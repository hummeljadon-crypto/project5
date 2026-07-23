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
  const TOTAL = 138;

  // Easy-to-edit story beats. The descent is intentionally paced by emotion, not a song duration.
  const BEATS = {
    surface: [0, 7],
    kiss: [7, 11],
    revealScale: [11, 18],
    descent: [18, 88],
    bottomHold: [88, 97],
    converge: [97, 104],
    shatter: [104, 110],
    blackout: [110, 114],
    fish: [114, 123],
    whale: [123, 132],
    eye: [132, 138],
  };

  // The words remain exactly in the order supplied.
  const PHRASES = [
    ["always love you", 18.0, 20.8, "mist"],
    ["swear", 21.2, 23.0, "small"],
    ["not scared", 23.5, 26.0, "fracture"],
    ["only when youre not here", 26.5, 30.3, "deep"],
    ["this", 30.8, 32.3, "small"],
    ["F O R E V E R", 32.8, 36.8, "hero"],
    ["only youuu", 37.3, 40.2, "mist"],
    ["us", 40.7, 42.2, "small"],
    ["you my home", 42.7, 46.2, "shelf"],
    ["fixxing everything in me", 46.7, 50.4, "deep"],
    ["a seed", 50.9, 53.6, "seed"],
    ["f o r e v e r", 54.1, 57.5, "mist"],
    ["do i make myself clear", 58.0, 61.7, "fracture"],
    ["this for life", 62.2, 65.0, "deep"],
    ["soul to keep", 65.5, 68.3, "mist"],
    ["one day  a baby", 68.8, 72.2, "deep"],
    ["my baby", 72.7, 75.0, "small"],
    ["crazy...", 75.5, 78.0, "fracture"],
    ["for your loveeee", 78.5, 81.5, "mist"],
    ["a blessin from above", 82.0, 85.4, "deep"],
    ["to fall in love", 85.9, 88.7, "mist"],
    ["is to take risk", 89.2, 92.1, "fracture"],
    ["im not scared", 92.6, 95.4, "deep"],
    ["always loveee youu", 95.9, 100.2, "hero"],
  ].map(([text, start, end, style]) => ({ text, start, end, style }));

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
  const easeInOut = (t) => t < 0.5 ? 4 * t ** 3 : 1 - ((-2 * t + 2) ** 3) / 2;
  const easeOut = (t) => 1 - (1 - t) ** 3;
  const easeIn = (t) => t ** 3;
  const hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  };

  function beat(name) {
    const [a, b] = BEATS[name];
    return inv(a, b, state.time);
  }

  function active(name) {
    const [a, b] = BEATS[name];
    return state.time >= a && state.time <= b;
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    state.cssW = Math.max(1, r.width);
    state.cssH = Math.max(1, r.height);
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
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function updateUI() {
    timeline.value = state.time.toFixed(2);
    timeline.style.setProperty("--progress", `${(state.time / TOTAL) * 100}%`);
    timeReadout.textContent = `${fmt(state.time)} / ${fmt(TOTAL)}`;
    playPauseButton.textContent = state.playing ? "Pause" : "Play";
    playPauseButton.setAttribute("aria-label", state.playing ? "Pause animation" : "Play animation");
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

  function depthProgress() {
    if (state.time <= BEATS.revealScale[0]) return 0;
    if (state.time >= BEATS.bottomHold[0]) return 1;
    return smooth(inv(BEATS.revealScale[0], BEATS.bottomHold[0], state.time));
  }

  function cameraDepth() {
    const p = depthProgress();
    // Small natural surges make the camera feel observational, not like a scrolling webpage.
    const surge = Math.sin(p * Math.PI * 5) * 85 + Math.sin(p * Math.PI * 11) * 24;
    return p * 9300 + surge;
  }

  function iceEdge(worldY) {
    const large = Math.sin(worldY * 0.00112) * 94;
    const medium = Math.sin(worldY * 0.0038 + 1.7) * 42;
    const detail = Math.sin(worldY * 0.011 + 0.4) * 18;
    return 720 + large + medium + detail;
  }

  function iceColorAtDepth(p) {
    const stops = [
      [0.00, [221, 246, 255]],
      [0.18, [172, 231, 253]],
      [0.42, [77, 176, 226]],
      [0.68, [22, 74, 136]],
      [0.86, [8, 31, 71]],
      [1.00, [3, 13, 32]],
    ];
    for (let i = 0; i < stops.length - 1; i++) {
      const [aPos, a] = stops[i];
      const [bPos, b] = stops[i + 1];
      if (p <= bPos) {
        const t = inv(aPos, bPos, p);
        return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
      }
    }
    return stops.at(-1)[1];
  }

  function rgba(rgb, a = 1) {
    return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
  }

  function drawOceanBackdrop(p) {
    const upper = iceColorAtDepth(clamp(p * 0.88 + 0.08));
    const lower = iceColorAtDepth(clamp(p * 1.04 + 0.18));
    fillGradient(
      rgba([upper[0] * 0.2, upper[1] * 0.31, upper[2] * 0.42], 1),
      rgba([lower[0] * 0.08, lower[1] * 0.16, lower[2] * 0.28], 1)
    );

    ctx.save();
    const beam = ctx.createLinearGradient(VIEW.w, 0, VIEW.w * 0.34, VIEW.h);
    beam.addColorStop(0, `rgba(184,230,255,${lerp(0.18, 0.015, p)})`);
    beam.addColorStop(0.5, `rgba(104,188,235,${lerp(0.08, 0.008, p)})`);
    beam.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);

    for (let i = 0; i < 80; i++) {
      const x = hash(i + 9) * VIEW.w;
      const y = (hash(i + 40) * VIEW.h + state.time * (6 + hash(i) * 12)) % VIEW.h;
      const r = 0.8 + hash(i + 70) * 2.4;
      ctx.globalAlpha = lerp(0.18, 0.04, p) * (0.4 + hash(i + 13));
      ctx.fillStyle = "#d9f4ff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function icebergPath(camY, bottomExtra = 1600) {
    const path = new Path2D();
    const topWorld = camY - 1300;
    const bottomWorld = camY + VIEW.h + bottomExtra;
    path.moveTo(-220, -300);
    path.lineTo(iceEdge(topWorld), -300);
    for (let sy = -300; sy <= VIEW.h + bottomExtra; sy += 34) {
      const wy = camY + sy - 420;
      path.lineTo(iceEdge(wy), sy);
    }
    path.lineTo(-220, VIEW.h + bottomExtra);
    path.closePath();
    return path;
  }

  function drawSolidIce(camY, p) {
    const path = icebergPath(camY);
    const base = iceColorAtDepth(p);

    ctx.save();
    ctx.clip(path);

    const solid = ctx.createLinearGradient(0, 0, VIEW.w * 0.8, VIEW.h);
    solid.addColorStop(0, rgba([Math.min(255, base[0] + 42), Math.min(255, base[1] + 38), Math.min(255, base[2] + 24)], 1));
    solid.addColorStop(0.45, rgba(base, 1));
    solid.addColorStop(1, rgba([base[0] * 0.4, base[1] * 0.55, base[2] * 0.73], 1));
    ctx.fillStyle = solid;
    ctx.fillRect(-100, -100, VIEW.w + 200, VIEW.h + 200);

    // Dense age bands that stay attached to world-space.
    for (let i = -8; i < 48; i++) {
      const worldY = Math.floor((camY - 1500) / 210) * 210 + i * 210;
      const sy = worldY - camY + 420;
      const wobble = Math.sin(worldY * 0.003) * 35;
      ctx.beginPath();
      ctx.moveTo(-80, sy);
      ctx.bezierCurveTo(230, sy - 30 + wobble, 470, sy + 44 - wobble, 920, sy + 12);
      ctx.lineWidth = 18 + hash(i + 20) * 28;
      ctx.strokeStyle = rgba([
        Math.min(255, base[0] + 24),
        Math.min(255, base[1] + 30),
        Math.min(255, base[2] + 28),
      ], 0.11 + hash(i + 3) * 0.11);
      ctx.stroke();
    }

    // Internal solid facets.
    for (let i = 0; i < 34; i++) {
      const worldY = Math.floor((camY - 2200) / 360) * 360 + i * 360;
      const sy = worldY - camY + 420;
      const x = 80 + hash(i + 120) * 610;
      const w = 140 + hash(i + 160) * 280;
      const h = 90 + hash(i + 180) * 230;
      ctx.save();
      ctx.translate(x, sy);
      ctx.rotate((hash(i + 210) - 0.5) * 0.18);
      const facet = ctx.createLinearGradient(-w, -h, w, h);
      facet.addColorStop(0, "rgba(244,253,255,0.11)");
      facet.addColorStop(0.55, "rgba(114,190,230,0.035)");
      facet.addColorStop(1, "rgba(0,25,62,0.09)");
      ctx.fillStyle = facet;
      ctx.beginPath();
      ctx.moveTo(-w * 0.5, -h * 0.35);
      ctx.lineTo(w * 0.48, -h * 0.5);
      ctx.lineTo(w * 0.35, h * 0.48);
      ctx.lineTo(-w * 0.6, h * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Trapped bubbles and sediment become rarer with depth.
    const bubbleOpacity = lerp(0.28, 0.035, p);
    for (let i = 0; i < 105; i++) {
      const worldY = Math.floor((camY - 1800) / 90) * 90 + i * 90;
      const sy = worldY - camY + 420;
      const x = 70 + hash(i + 330) * 570;
      const r = 2 + hash(i + 360) * 8;
      ctx.strokeStyle = `rgba(244,252,255,${bubbleOpacity * (0.45 + hash(i + 390))})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(x, sy, r, r * (0.7 + hash(i + 410) * 0.7), hash(i + 430), 0, Math.PI * 2);
      ctx.stroke();
    }

    if (p > 0.55) {
      for (let i = 0; i < 24; i++) {
        const worldY = Math.floor((camY - 2400) / 310) * 310 + i * 310;
        const sy = worldY - camY + 420;
        const x = 90 + hash(i + 510) * 570;
        ctx.strokeStyle = `rgba(4,14,34,${0.08 + hash(i + 540) * 0.16})`;
        ctx.lineWidth = 6 + hash(i + 570) * 14;
        ctx.beginPath();
        ctx.moveTo(x - 90, sy - 30);
        ctx.bezierCurveTo(x - 30, sy + 15, x + 25, sy - 20, x + 120, sy + 35);
        ctx.stroke();
      }
    }

    ctx.restore();

    // Hard outside edge and rim light sell solidity.
    ctx.save();
    ctx.strokeStyle = `rgba(214,243,255,${lerp(0.72, 0.16, p)})`;
    ctx.lineWidth = lerp(8, 3, p);
    ctx.shadowColor = `rgba(116,211,255,${lerp(0.45, 0.08, p)})`;
    ctx.shadowBlur = lerp(28, 8, p);
    ctx.beginPath();
    for (let sy = -80; sy <= VIEW.h + 80; sy += 24) {
      const wy = camY + sy - 420;
      const x = iceEdge(wy);
      if (sy === -80) ctx.moveTo(x, sy);
      else ctx.lineTo(x, sy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function crackWorldX(worldY, id) {
    const edge = iceEdge(worldY);
    const inset = 170 + id * 105 + Math.sin(worldY * (0.003 + id * 0.0004) + id) * 65;
    return edge - inset;
  }

  function crackHeadDepth() {
    const p = depthProgress();
    const cam = cameraDepth();
    // The fracture catches up in waves, disappears, then lunges again.
    const lunges =
      Math.max(0, Math.sin(p * Math.PI * 4.5 - 0.6)) * 620 +
      Math.max(0, Math.sin(p * Math.PI * 9.0 + 0.9)) * 180;
    return cam + 160 + lunges;
  }

  function drawHuntingCracks(camY, p) {
    if (state.time < 9.2 || state.time > 106) return;
    const head = crackHeadDepth();
    const revealFade = clamp(inv(9.2, 14, state.time)) * (1 - clamp(inv(102, 108, state.time)));

    for (let id = 0; id < 3; id++) {
      ctx.save();
      ctx.beginPath();
      let started = false;
      const startWorld = Math.max(-200, camY - 1900);
      const endWorld = Math.min(head - id * 90, camY + VIEW.h + 900);
      for (let wy = startWorld; wy <= endWorld; wy += 34) {
        const sy = wy - camY + 420;
        const x = crackWorldX(wy, id);
        if (!started) {
          ctx.moveTo(x, sy);
          started = true;
        } else {
          ctx.lineTo(x, sy);
        }
      }
      const alpha = revealFade * (0.56 - id * 0.1) * (0.65 + Math.max(0, Math.sin(state.time * 1.8 + id)) * 0.35);
      ctx.strokeStyle = `rgba(205,244,255,${alpha})`;
      ctx.lineWidth = 8 - id * 1.6;
      ctx.shadowColor = `rgba(69,195,255,${alpha * 0.9})`;
      ctx.shadowBlur = 24;
      ctx.stroke();

      // Branches explode out only near the crack head.
      for (let b = 0; b < 14; b++) {
        const wy = head - b * 95 - id * 70;
        if (wy < camY - 800 || wy > camY + VIEW.h + 300) continue;
        const sy = wy - camY + 420;
        const x = crackWorldX(wy, id);
        const side = b % 2 ? 1 : -1;
        const len = 40 + hash(b + id * 20) * 145;
        ctx.beginPath();
        ctx.moveTo(x, sy);
        ctx.lineTo(x + side * len * 0.45, sy + 38);
        ctx.lineTo(x + side * len, sy + 70 + hash(b + 90) * 65);
        ctx.strokeStyle = `rgba(216,247,255,${alpha * 0.68})`;
        ctx.lineWidth = 3.4;
        ctx.stroke();
      }
      ctx.restore();
    }

    // Fragments break from the edge when the chase gets close.
    const danger = Math.max(0, Math.sin(p * Math.PI * 5 - 0.3));
    if (danger > 0.32) {
      ctx.save();
      for (let i = 0; i < 14; i++) {
        const x = iceEdge(camY + 900 + i * 80) + 18 + hash(i + 760) * 80;
        const y = (i * 151 + state.time * (110 + hash(i) * 120)) % (VIEW.h + 220) - 110;
        ctx.translate(x, y);
        ctx.rotate(state.time * 0.9 + i);
        ctx.fillStyle = `rgba(177,224,250,${0.1 + danger * 0.18})`;
        ctx.fillRect(-8, -15, 16 + hash(i + 770) * 24, 24 + hash(i + 790) * 50);
        ctx.setTransform(state.dpr * state.scale, 0, 0, state.dpr * state.scale, state.dpr * state.offsetX, state.dpr * state.offsetY);
      }
      ctx.restore();
    }
  }

  function drawPhrase(camY) {
    const item = PHRASES.find((p) => state.time >= p.start && state.time <= p.end);
    if (!item) return;
    const t = inv(item.start, item.end, state.time);
    const fade = Math.sin(t * Math.PI) ** 0.72;
    const p = depthProgress();
    const edge = iceEdge(camY + 380);
    const xBase = clamp(edge - 330, 250, 620);
    const y = 880 + Math.sin(state.time * 0.72) * 22;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = fade;

    let size = 54;
    let spacing = 0;
    let x = xBase;
    let color = `rgba(232,249,255,${lerp(0.88, 0.66, p)})`;

    if (item.style === "hero") {
      size = 72;
      x = 500;
      ctx.shadowColor = "rgba(102,213,255,0.7)";
      ctx.shadowBlur = 34;
    } else if (item.style === "small") {
      size = 48;
      x -= 30;
    } else if (item.style === "deep") {
      size = 51;
      color = "rgba(201,231,255,0.82)";
      ctx.shadowColor = "rgba(22,99,180,0.65)";
      ctx.shadowBlur = 18;
    } else if (item.style === "fracture") {
      size = 54;
      ctx.shadowColor = "rgba(173,237,255,0.58)";
      ctx.shadowBlur = 20;
    } else if (item.style === "seed") {
      size = 50;
      color = "rgba(237,255,210,0.92)";
      ctx.shadowColor = "rgba(192,255,119,0.7)";
      ctx.shadowBlur = 26;
    } else if (item.style === "shelf") {
      size = 52;
      x = 490;
      color = "rgba(237,244,255,0.88)";
    }

    ctx.font = `500 ${size}px Georgia, 'Times New Roman', serif`;
    ctx.fillStyle = color;

    if (item.style === "fracture") {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, x, VIEW.h);
      ctx.clip();
      ctx.fillText(item.text, x + 12, y - 4);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 5, 0, VIEW.w - x, VIEW.h);
      ctx.clip();
      ctx.fillText(item.text, x - 12, y + 6);
      ctx.restore();
    } else if (item.style === "hero" || item.text.includes("f o r e v e r")) {
      // Manual letter-spacing without relying on experimental canvas APIs.
      const chars = [...item.text];
      const widths = chars.map((ch) => ctx.measureText(ch).width);
      spacing = item.style === "hero" ? 11 : 6;
      const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
      let cx = x - total / 2;
      for (let i = 0; i < chars.length; i++) {
        ctx.fillText(chars[i], cx + widths[i] / 2, y);
        cx += widths[i] + spacing;
      }
    } else {
      ctx.fillText(item.text, x, y);
    }

    if (item.style === "seed") {
      const pulseWindow = inv(item.start, item.end, state.time) * 8;
      const completed = Math.floor(pulseWindow);
      const pulse = Math.sin((pulseWindow % 1) * Math.PI);
      const sx = x + 15;
      const sy = y + 105;
      for (let i = 0; i < Math.min(completed + 1, 8); i++) {
        const r = 13 + i * 9 + (i === completed ? pulse * 10 : 0);
        ctx.strokeStyle = `rgba(218,255,177,${0.22 * (1 - i / 10)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(240,255,204,0.98)";
      ctx.beginPath();
      ctx.ellipse(sx, sy, 11, 19, -0.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawLibraryGlimpse(camY) {
    const center = 45.7;
    const span = 0.72;
    const local = 1 - Math.abs(state.time - center) / span;
    if (local <= 0) return;

    const alpha = smooth(clamp(local));
    const edge = iceEdge(camY + 300);
    const chamberX = edge - 440;
    const chamberY = 640;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.roundRect(chamberX - 250, chamberY - 250, 480, 510, 90);
    ctx.clip();

    const g = ctx.createRadialGradient(chamberX, chamberY, 20, chamberX, chamberY, 420);
    g.addColorStop(0, "rgba(45,67,89,0.96)");
    g.addColorStop(0.58, "rgba(10,25,44,0.98)");
    g.addColorStop(1, "rgba(2,7,15,1)");
    ctx.fillStyle = g;
    ctx.fillRect(chamberX - 270, chamberY - 280, 540, 560);

    // Gothic arch.
    ctx.strokeStyle = "rgba(204,233,248,0.22)";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(chamberX - 205, chamberY + 230);
    ctx.lineTo(chamberX - 205, chamberY - 60);
    ctx.quadraticCurveTo(chamberX, chamberY - 320, chamberX + 205, chamberY - 60);
    ctx.lineTo(chamberX + 205, chamberY + 230);
    ctx.stroke();

    // Shelves and books.
    for (let s = 0; s < 3; s++) {
      const sx = chamberX - 190 + s * 132;
      ctx.fillStyle = "rgba(12,16,22,0.92)";
      ctx.fillRect(sx, chamberY - 80, 105, 300);
      for (let row = 0; row < 5; row++) {
        const sy = chamberY - 48 + row * 54;
        ctx.fillStyle = "rgba(196,217,231,0.12)";
        ctx.fillRect(sx + 6, sy, 93, 4);
        for (let b = 0; b < 6; b++) {
          const bh = 20 + hash(s * 50 + row * 10 + b) * 25;
          ctx.fillStyle = `rgba(${35 + b * 10},${48 + row * 6},${62 + s * 8},0.88)`;
          ctx.fillRect(sx + 10 + b * 14, sy - bh, 10, bh);
        }
      }
    }

    ctx.fillStyle = "rgba(235,244,251,0.55)";
    ctx.font = "bold 22px Georgia, serif";
    ctx.fillText("D", chamberX - 150, chamberY + 180);

    // Two tiny llamas on the middle shelf.
    drawTinyLlama(chamberX + 2, chamberY + 145, 1.15);
    drawTinyLlama(chamberX + 42, chamberY + 148, 1.05);

    // Loose pages suspended in the chamber.
    for (let i = 0; i < 8; i++) {
      const x = chamberX - 150 + hash(i + 810) * 320;
      const y = chamberY - 180 + hash(i + 840) * 310;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hash(i + 870) * Math.PI + state.time * 0.3);
      ctx.fillStyle = "rgba(238,245,250,0.25)";
      ctx.fillRect(-15, -9, 30, 18);
      ctx.restore();
    }

    ctx.restore();

    // Ice closes over it immediately.
    ctx.save();
    ctx.globalAlpha = 0.26 * alpha;
    ctx.fillStyle = "rgba(177,229,255,0.76)";
    ctx.fillRect(chamberX - 280, chamberY - 280, 560, 560);
    ctx.restore();
  }

  function drawTinyLlama(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(230,237,242,0.9)";
    ctx.fillRect(-13, -8, 25, 13);
    ctx.fillRect(7, -22, 9, 20);
    ctx.fillRect(-9, 4, 4, 12);
    ctx.fillRect(2, 4, 4, 12);
    ctx.fillRect(9, 4, 4, 12);
    ctx.beginPath();
    ctx.moveTo(9, -20);
    ctx.lineTo(8, -30);
    ctx.lineTo(13, -23);
    ctx.moveTo(15, -20);
    ctx.lineTo(19, -29);
    ctx.lineTo(20, -18);
    ctx.fill();
    ctx.restore();
  }

  function drawSurfaceScene() {
    fillGradient("#17283d", "#b7dbe9");

    // Aurora with a hidden D.
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      for (let x = -40; x <= VIEW.w + 40; x += 18) {
        const y = 160 + band * 74 + Math.sin(x * 0.008 + state.time * 0.18 + band) * 42;
        if (x === -40) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = band === 1 ? "rgba(168,255,231,0.3)" : "rgba(117,211,255,0.25)";
      ctx.lineWidth = 36 - band * 8;
      ctx.stroke();
    }
    ctx.globalAlpha = 0.09;
    ctx.strokeStyle = "rgba(228,249,255,0.9)";
    ctx.lineWidth = 15;
    ctx.beginPath();
    ctx.moveTo(845, 158);
    ctx.lineTo(845, 270);
    ctx.bezierCurveTo(980, 250, 980, 170, 845, 158);
    ctx.stroke();
    ctx.restore();

    // Snowfield and exposed side of iceberg.
    ctx.fillStyle = "rgba(235,249,255,0.98)";
    ctx.beginPath();
    ctx.moveTo(0, 1240);
    ctx.quadraticCurveTo(300, 1135, 620, 1215);
    ctx.quadraticCurveTo(820, 1275, 1080, 1185);
    ctx.lineTo(1080, 1920);
    ctx.lineTo(0, 1920);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 90; i++) {
      const x = hash(i + 900) * VIEW.w;
      const y = (hash(i + 920) * VIEW.h + state.time * (8 + hash(i) * 12)) % VIEW.h;
      ctx.globalAlpha = 0.22 + hash(i + 950) * 0.36;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(x, y, 1 + hash(i + 970) * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const kiss = beat("kiss");
    const slow = active("kiss") ? easeInOut(kiss) : state.time > BEATS.kiss[1] ? 1 : 0;
    const leftX = lerp(425, 493, slow);
    const rightX = lerp(655, 587, slow);
    drawPenguin(leftX, 1180, 1.34, lerp(0, 0.16, slow), false);
    drawPenguin(rightX, 1180, 1.34, lerp(0, -0.16, slow), true);

    if (state.time > 7.8) drawOpeningCrack(inv(7.8, 12, state.time));
  }

  function drawPenguin(x, y, s, lean, mirror) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(mirror ? -s : s, s);
    ctx.rotate(lean);
    const breathe = Math.sin(state.time * 1.5 + x) * 1.2;

    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 62, 36, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#171d24";
    ctx.beginPath();
    ctx.ellipse(0, 12 + breathe, 34, 51, -0.05, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#eef6fa";
    ctx.beginPath();
    ctx.ellipse(5, 18 + breathe, 23, 38, -0.07, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#161c23";
    ctx.beginPath();
    ctx.arc(0, -35, 27, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f3f9fc";
    ctx.beginPath();
    ctx.ellipse(7, -31, 15, 19, -0.08, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dba13c";
    ctx.beginPath();
    ctx.moveTo(18, -30);
    ctx.lineTo(43, -23);
    ctx.lineTo(17, -17);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#12171d";
    ctx.beginPath();
    ctx.arc(12, -37, 2.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(7,10,14,0.42)";
    ctx.beginPath();
    ctx.ellipse(-29, 10, 10, 27, 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#dba13c";
    ctx.beginPath();
    ctx.ellipse(-13, 62, 13, 5, 0.12, 0, Math.PI * 2);
    ctx.ellipse(13, 62, 13, 5, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawOpeningCrack(p) {
    const q = easeOut(clamp(p));
    ctx.save();
    ctx.strokeStyle = "rgba(105,181,221,0.92)";
    ctx.lineWidth = 6;
    ctx.shadowColor = "rgba(119,218,255,0.65)";
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(540, 1260);
    ctx.lineTo(510, 1290);
    ctx.lineTo(560, 1325);
    ctx.lineTo(470 - q * 190, 1380 + q * 90);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(540, 1260);
    ctx.lineTo(585, 1295);
    ctx.lineTo(555, 1340);
    ctx.lineTo(640 + q * 190, 1415 + q * 100);
    ctx.stroke();

    // The date is abstracted into tiny angular branches.
    ctx.globalAlpha = 0.22 * q;
    ctx.lineWidth = 2;
    const digits = [17, 3, 2026];
    digits.forEach((d, i) => {
      const x = 500 + i * 42;
      ctx.beginPath();
      ctx.moveTo(x, 1335 + i * 11);
      ctx.lineTo(x + 10, 1322 + (d % 5));
      ctx.lineTo(x + 19, 1342 - (d % 7));
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawDescent() {
    const p = depthProgress();
    const camY = cameraDepth();
    drawOceanBackdrop(p);
    drawSolidIce(camY, p);
    drawLibraryGlimpse(camY);
    drawHuntingCracks(camY, p);
    drawPhrase(camY);

    // Tiny camera drift creates a documentary tracking-shot feel.
    const vignette = ctx.createRadialGradient(540, 880, 240, 540, 940, 920);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(0.72, "rgba(0,0,0,0.08)");
    vignette.addColorStop(1, `rgba(0,0,0,${lerp(0.24, 0.55, p)})`);
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  function drawBottomHold() {
    const p = beat("bottomHold");
    fillGradient("#061326", "#01040b");

    // The full underside is a single readable shape.
    ctx.save();
    ctx.translate(0, lerp(-130, -40, smooth(p)));
    const g = ctx.createLinearGradient(0, 0, 0, 1040);
    g.addColorStop(0, "rgba(6,20,48,1)");
    g.addColorStop(0.65, "rgba(10,42,84,1)");
    g.addColorStop(1, "rgba(3,13,31,1)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-80, -40);
    ctx.lineTo(1160, -40);
    ctx.lineTo(1050, 410);
    ctx.lineTo(870, 640);
    ctx.lineTo(710, 1030);
    ctx.lineTo(560, 810);
    ctx.lineTo(410, 1100);
    ctx.lineTo(250, 690);
    ctx.lineTo(80, 540);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(129,211,255,0.28)";
    ctx.lineWidth = 7;
    ctx.shadowColor = "rgba(80,190,255,0.34)";
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.restore();

    // One beam and a few tiny fragments establish scale.
    const beam = ctx.createLinearGradient(880, 0, 460, 1500);
    beam.addColorStop(0, "rgba(111,210,255,0.15)");
    beam.addColorStop(1, "rgba(111,210,255,0)");
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(860, 0);
    ctx.lineTo(1050, 0);
    ctx.lineTo(680, 1700);
    ctx.lineTo(520, 1700);
    ctx.closePath();
    ctx.fill();

    for (let i = 0; i < 12; i++) {
      const x = 130 + hash(i + 1100) * 810;
      const y = (hash(i + 1130) * 1800 + state.time * (18 + hash(i) * 25)) % 1900;
      ctx.fillStyle = "rgba(180,226,249,0.15)";
      ctx.fillRect(x, y, 4 + hash(i) * 8, 8 + hash(i + 3) * 16);
    }
  }

  function drawConvergeAndShatter() {
    const converging = active("converge");
    const p = converging ? beat("converge") : beat("shatter");
    drawBottomHold();

    if (converging) {
      const targets = [
        [[110, 410], [500, 755]],
        [[930, 340], [500, 755]],
        [[560, 160], [500, 755]],
        [[320, 270], [500, 755]],
      ];
      ctx.save();
      ctx.strokeStyle = `rgba(206,244,255,${0.24 + p * 0.64})`;
      ctx.lineWidth = 7;
      ctx.shadowColor = "rgba(89,205,255,0.7)";
      ctx.shadowBlur = 30;
      targets.forEach(([a, b], i) => {
        const ex = lerp(a[0], b[0], easeOut(p));
        const ey = lerp(a[1], b[1], easeOut(p));
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(lerp(a[0], ex, 0.45) + Math.sin(i) * 34, lerp(a[1], ey, 0.45));
        ctx.lineTo(ex, ey);
        ctx.stroke();
      });
      ctx.restore();
      return;
    }

    const fall = easeIn(p);
    const slabs = [
      { x: 305, y: 450, w: 250, h: 470, r: -0.12, dx: -80, dy: 1180 },
      { x: 550, y: 540, w: 290, h: 520, r: 0.08, dx: 40, dy: 1260 },
      { x: 765, y: 390, w: 235, h: 430, r: 0.18, dx: 130, dy: 1050 },
    ];
    slabs.forEach((s, i) => {
      ctx.save();
      ctx.translate(s.x + s.dx * fall, s.y + s.dy * fall);
      ctx.rotate(s.r + fall * (i - 1) * 0.28);
      const g = ctx.createLinearGradient(-s.w / 2, -s.h / 2, s.w / 2, s.h / 2);
      g.addColorStop(0, "rgba(61,123,174,0.96)");
      g.addColorStop(1, "rgba(5,24,54,0.98)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-s.w * 0.5, -s.h * 0.48);
      ctx.lineTo(s.w * 0.48, -s.h * 0.34);
      ctx.lineTo(s.w * 0.38, s.h * 0.5);
      ctx.lineTo(-s.w * 0.42, s.h * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(164,225,255,0.25)";
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.restore();
    });

    ctx.fillStyle = `rgba(0,0,0,${smooth(inv(0.52, 1, p))})`;
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  function drawBlackout() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, VIEW.w, VIEW.h);
  }

  const FISH = Array.from({ length: 14 }, (_, i) => ({
    seed: i + 0.37,
    size: 0.65 + hash(i + 1200) * 0.8,
    delay: hash(i + 1240) * 0.65,
  }));

  function drawFishScene() {
    drawBlackout();
    const p = beat("fish");
    for (let i = 0; i < FISH.length; i++) {
      const f = FISH[i];
      const reveal = smooth(clamp((p - f.delay) / 0.35));
      if (reveal <= 0) continue;
      const x = 120 + ((p * 1220 + hash(i + 1280) * 760) % 1240) - 140;
      const y = 350 + hash(i + 1300) * 1050 + Math.sin(state.time * 0.7 + i) * 70;
      drawFish(x, y, 22 * f.size, reveal);
    }
  }

  function drawFish(x, y, size, alpha) {
    ctx.save();
    const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 4.2);
    glow.addColorStop(0, `rgba(164,255,237,${0.75 * alpha})`);
    glow.addColorStop(0.25, `rgba(80,224,255,${0.32 * alpha})`);
    glow.addColorStop(1, "rgba(80,224,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, size * 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(213,255,247,0.94)";
    ctx.beginPath();
    ctx.ellipse(x, y, size, size * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x - size * 1.7, y - size * 0.54);
    ctx.lineTo(x - size * 1.7, y + size * 0.54);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawWhaleScene() {
    drawBlackout();
    const p = beat("whale");

    // Fish light crosses the whale instead of the whale entering frame.
    for (let i = 0; i < 10; i++) {
      const x = lerp(-180, 1220, (p + i * 0.087) % 1.2);
      const y = 430 + hash(i + 1350) * 780;
      drawFish(x, y, 18 + hash(i + 1380) * 18, 0.75);
    }

    const reveal = smooth(inv(0.12, 0.9, p));
    ctx.save();
    ctx.globalAlpha = 0.18 + reveal * 0.68;
    const whaleG = ctx.createLinearGradient(180, 450, 930, 1300);
    whaleG.addColorStop(0, "rgba(27,43,58,0.98)");
    whaleG.addColorStop(1, "rgba(3,9,18,1)");
    ctx.fillStyle = whaleG;
    ctx.beginPath();
    ctx.ellipse(640, 1040, 520, 275, -0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(990, 1020);
    ctx.lineTo(1160, 900);
    ctx.lineTo(1120, 1110);
    ctx.closePath();
    ctx.fill();

    const ex = 420;
    const ey = 950;
    ctx.globalAlpha = reveal;
    ctx.fillStyle = "rgba(137,181,211,0.14)";
    ctx.beginPath();
    ctx.ellipse(ex, ey, 45, 26, 0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,3,8,1)";
    ctx.beginPath();
    ctx.arc(ex, ey, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(233,249,255,0.88)";
    ctx.beginPath();
    ctx.arc(ex + 9, ey - 8, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEyeTransition() {
    const p = beat("eye");
    drawWhaleScene();
    const ex = 420;
    const ey = 950;
    const r = lerp(14, 1550, easeIn(p));
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(ex, ey, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#02060e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    beginVirtual();

    if (state.time < BEATS.revealScale[0]) {
      drawSurfaceScene();
    } else if (state.time < BEATS.bottomHold[0]) {
      drawDescent();
    } else if (active("bottomHold")) {
      drawBottomHold();
    } else if (active("converge") || active("shatter")) {
      drawConvergeAndShatter();
    } else if (active("blackout")) {
      drawBlackout();
    } else if (active("fish")) {
      drawFishScene();
    } else if (active("whale")) {
      drawWhaleScene();
    } else {
      drawEyeTransition();
    }
  }

  startButton.addEventListener("click", () => {
    intro.classList.add("is-hidden");
    play();
  });

  playPauseButton.addEventListener("click", () => {
    intro.classList.add("is-hidden");
    state.playing ? pause() : play();
  });

  restartButton.addEventListener("click", () => {
    pause();
    state.time = 0;
    updateUI();
    render();
  });

  timeline.addEventListener("input", () => {
    state.time = clamp(Number(timeline.value), 0, TOTAL);
    updateUI();
    render();
  });

  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.playing) pause();
  });

  const params = new URLSearchParams(location.search);
  const requested = Number(params.get("time"));
  if (Number.isFinite(requested)) {
    state.time = clamp(requested, 0, TOTAL);
    intro.classList.add("is-hidden");
  }

  resize();
  updateUI();
  render();

  if (params.get("autoplay") === "1") play();
})();
