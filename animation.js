(() => {
  "use strict";

  const canvas = document.querySelector("#scene");
  const context = canvas.getContext("2d", { alpha: false, desynchronized: true });
  const intro = document.querySelector("#intro");
  const startButton = document.querySelector("#startButton");
  const playButton = document.querySelector("#playButton");
  const pauseButton = document.querySelector("#pauseButton");
  const restartButton = document.querySelector("#restartButton");
  const scrubber = document.querySelector("#scrubber");
  const clock = document.querySelector("#clock");

  if (!context) {
    throw new Error("This browser does not support Canvas 2D.");
  }

  const TOTAL_DURATION = 198;
  const DESCENT_DURATION = 133;
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const TIMELINE = Object.freeze({
    surface: [0, 6],
    kiss: [6, 10],
    enterIce: [10, 12],
    descent: [12, 145],
    bottomReveal: [145, 151],
    convergence: [151, 158],
    shatter: [158, 164],
    darkness: [164, 169],
    fish: [169, 178],
    whale: [178, 190],
    eye: [190, 198],
  });

  const PHRASES = Object.freeze([
    { text: "until the end", start: 18, end: 25, side: -1, tilt: -0.08 },
    { text: "i love you, always", start: 43, end: 51, side: 1, tilt: 0.06 },
    { text: "never let go", start: 78, end: 85, side: -1, tilt: -0.04 },
    { text: "planting the seed", start: 108, end: 115, side: 1, tilt: 0.05 },
  ]);

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    time: 0,
    playing: false,
    lastFrame: 0,
    frameRequest: 0,
  };

  function mulberry32(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  const random = mulberry32(17032026);

  const snow = Array.from({ length: 110 }, () => ({
    x: random(),
    y: random(),
    radius: 0.45 + random() * 2.1,
    speed: 0.12 + random() * 0.48,
    sway: random() * Math.PI * 2,
  }));

  const suspendedParticles = Array.from({ length: 95 }, () => ({
    x: random(),
    y: random(),
    radius: 0.4 + random() * 2.4,
    speed: 0.15 + random() * 0.7,
    phase: random() * Math.PI * 2,
  }));

  const slabShapes = Array.from({ length: 30 }, (_, slabIndex) => {
    const slabRandom = mulberry32(9000 + slabIndex * 73);
    return {
      rotation: (slabRandom() - 0.5) * 0.25,
      offsetX: (slabRandom() - 0.5) * 0.28,
      offsetY: (slabRandom() - 0.5) * 0.2,
      thickness: 0.08 + slabRandom() * 0.14,
      points: Array.from({ length: 18 }, (_, pointIndex) => {
        const angle = (pointIndex / 18) * Math.PI * 2;
        return {
          angle,
          roughness:
            0.86 +
            slabRandom() * 0.24 +
            Math.sin(angle * (2 + (slabIndex % 3))) * 0.035,
        };
      }),
    };
  });

  const fish = Array.from({ length: 18 }, (_, index) => {
    const fishRandom = mulberry32(301 + index * 19);
    return {
      x: fishRandom(),
      y: 0.22 + fishRandom() * 0.56,
      speed: 0.04 + fishRandom() * 0.1,
      scale: 0.65 + fishRandom() * 0.9,
      phase: fishRandom() * Math.PI * 2,
    };
  });

  const pages = Array.from({ length: 9 }, (_, index) => {
    const pageRandom = mulberry32(1700 + index * 17);
    return {
      x: pageRandom(),
      y: pageRandom(),
      rotation: pageRandom() * Math.PI * 2,
      spin: (pageRandom() - 0.5) * 2,
    };
  });

  function clamp(value, minimum = 0, maximum = 1) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function inverseLerp(start, end, value) {
    return clamp((value - start) / (end - start));
  }

  function smoothstep(value) {
    const x = clamp(value);
    return x * x * (3 - 2 * x);
  }

  function smootherstep(value) {
    const x = clamp(value);
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  function easeOutCubic(value) {
    const x = clamp(value);
    return 1 - Math.pow(1 - x, 3);
  }

  function easeInCubic(value) {
    const x = clamp(value);
    return x * x * x;
  }

  function easeInOutCubic(value) {
    const x = clamp(value);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function pulse(value, start, peak, end) {
    if (value <= start || value >= end) return 0;
    if (value < peak) return smoothstep((value - start) / (peak - start));
    return 1 - smoothstep((value - peak) / (end - peak));
  }

  function fract(value) {
    return value - Math.floor(value);
  }

  function sceneProgress(name) {
    const [start, end] = TIMELINE[name];
    return inverseLerp(start, end, state.time);
  }

  function sceneIsActive(name) {
    const [start, end] = TIMELINE[name];
    return state.time >= start && state.time < end;
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remaining = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${minutes}:${remaining}`;
  }

  function rgba(color, alpha = 1) {
    return `rgba(${Math.round(color[0])}, ${Math.round(color[1])}, ${Math.round(
      color[2]
    )}, ${alpha})`;
  }

  function mixColor(first, second, amount) {
    return [
      lerp(first[0], second[0], amount),
      lerp(first[1], second[1], amount),
      lerp(first[2], second[2], amount),
    ];
  }

  function resize() {
    const rectangle = canvas.getBoundingClientRect();
    state.width = Math.max(1, rectangle.width);
    state.height = Math.max(1, rectangle.height);
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    render();
  }

  function clear(color = "#02050a") {
    context.save();
    context.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    context.fillStyle = color;
    context.fillRect(0, 0, state.width, state.height);
    context.restore();
  }

  function drawVerticalGradient(top, bottom) {
    const gradient = context.createLinearGradient(0, 0, 0, state.height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    context.fillStyle = gradient;
    context.fillRect(0, 0, state.width, state.height);
  }

  function drawVignette(amount = 0.5) {
    const radius = Math.max(state.width, state.height) * 0.78;
    const gradient = context.createRadialGradient(
      state.width * 0.5,
      state.height * 0.48,
      radius * 0.18,
      state.width * 0.5,
      state.height * 0.48,
      radius
    );
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, `rgba(0,0,0,${clamp(amount, 0, 0.9)})`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, state.width, state.height);
  }

  function drawSurfaceSky() {
    drawVerticalGradient("#758ea7", "#d6e8f1");

    const horizonGlow = context.createRadialGradient(
      state.width * 0.5,
      state.height * 0.58,
      0,
      state.width * 0.5,
      state.height * 0.58,
      state.width * 0.85
    );
    horizonGlow.addColorStop(0, "rgba(241,248,252,0.42)");
    horizonGlow.addColorStop(1, "rgba(241,248,252,0)");
    context.fillStyle = horizonGlow;
    context.fillRect(0, 0, state.width, state.height);

    context.save();
    context.globalAlpha = 0.16;
    context.lineCap = "round";
    for (let band = 0; band < 3; band += 1) {
      context.beginPath();
      for (let x = -20; x <= state.width + 20; x += 12) {
        const normalized = x / state.width;
        const y =
          state.height * (0.13 + band * 0.045) +
          Math.sin(normalized * 7 + state.time * 0.16 + band) * 20 +
          Math.sin(normalized * 13 + band * 1.8) * 8;
        if (x === -20) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = band === 1 ? "#b8fff2" : "#a7dcff";
      context.lineWidth = 17 - band * 4;
      context.stroke();
    }

    // Hidden D in the aurora.
    context.globalAlpha = 0.075;
    context.strokeStyle = "#effaff";
    context.lineWidth = 8;
    const dX = state.width * 0.76;
    const dY = state.height * 0.15;
    context.beginPath();
    context.moveTo(dX - 17, dY - 23);
    context.lineTo(dX - 17, dY + 23);
    context.bezierCurveTo(dX + 25, dY + 19, dX + 25, dY - 19, dX - 17, dY - 23);
    context.stroke();
    context.restore();
  }

  function drawSnow() {
    context.save();
    context.fillStyle = "#ffffff";
    for (const flake of snow) {
      const x =
        flake.x * state.width +
        Math.sin(state.time * 0.5 + flake.sway) * 18 * flake.speed;
      const y = fract(flake.y + state.time * 0.018 * flake.speed) * (state.height + 40) - 20;
      context.globalAlpha = 0.18 + flake.speed * 0.34;
      context.beginPath();
      context.arc(x, y, flake.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  function drawIceSurface() {
    const horizon = state.height * 0.67;
    context.save();
    const gradient = context.createLinearGradient(0, horizon, 0, state.height);
    gradient.addColorStop(0, "#e6f2f7");
    gradient.addColorStop(1, "#b8d7e5");
    context.fillStyle = gradient;
    context.beginPath();
    context.moveTo(0, horizon + 12);
    context.quadraticCurveTo(state.width * 0.22, horizon - 18, state.width * 0.48, horizon + 3);
    context.quadraticCurveTo(state.width * 0.74, horizon + 23, state.width, horizon - 7);
    context.lineTo(state.width, state.height);
    context.lineTo(0, state.height);
    context.closePath();
    context.fill();

    context.globalAlpha = 0.22;
    context.strokeStyle = "#ffffff";
    context.lineWidth = 1.2;
    for (let line = 0; line < 8; line += 1) {
      const y = horizon + 26 + line * 18;
      context.beginPath();
      context.moveTo(-20, y);
      context.bezierCurveTo(
        state.width * 0.32,
        y - 12,
        state.width * 0.68,
        y + 13,
        state.width + 20,
        y - 3
      );
      context.stroke();
    }
    context.restore();
  }

  function drawBreath(x, y, direction, strength) {
    context.save();
    for (let puff = 0; puff < 3; puff += 1) {
      const age = fract(state.time * 0.4 + puff / 3);
      context.globalAlpha = (1 - age) * 0.09 * strength;
      context.fillStyle = "#f7fcff";
      context.beginPath();
      context.ellipse(
        x + direction * age * 32,
        y - age * 12,
        7 + age * 11,
        4 + age * 6,
        direction * -0.15,
        0,
        Math.PI * 2
      );
      context.fill();
    }
    context.restore();
  }

  function drawPenguin(x, y, scale, direction, lean, blink) {
    context.save();
    context.translate(x, y);
    context.scale(scale * direction, scale);
    context.rotate(lean * direction);

    const breathing = Math.sin(state.time * 1.65 + x * 0.01) * 0.7;

    context.fillStyle = "rgba(10,14,18,0.18)";
    context.beginPath();
    context.ellipse(0, 49, 23, 7, 0, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#c89242";
    context.beginPath();
    context.ellipse(-8, 42, 8, 3.2, 0.12, 0, Math.PI * 2);
    context.ellipse(8, 42, 8, 3.2, -0.12, 0, Math.PI * 2);
    context.fill();

    const bodyGradient = context.createLinearGradient(-24, -30, 22, 44);
    bodyGradient.addColorStop(0, "#12171d");
    bodyGradient.addColorStop(0.65, "#252d35");
    bodyGradient.addColorStop(1, "#0d1116");
    context.fillStyle = bodyGradient;
    context.beginPath();
    context.ellipse(0, 7 + breathing, 23, 38, -0.04, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#e7edf0";
    context.beginPath();
    context.ellipse(3, 13 + breathing, 14, 28, -0.08, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#161b21";
    context.beginPath();
    context.ellipse(-19, 5, 7, 21, 0.18, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#11161c";
    context.beginPath();
    context.ellipse(0, -29, 18, 20, 0.06, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#e9eef1";
    context.beginPath();
    context.ellipse(6, -26, 9, 12, 0.12, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#15191e";
    if (blink > 0.94) {
      context.fillRect(9, -30, 5, 1);
    } else {
      context.beginPath();
      context.arc(11, -30, 1.45, 0, Math.PI * 2);
      context.fill();
    }

    context.fillStyle = "#c89242";
    context.beginPath();
    context.moveTo(12, -25);
    context.lineTo(24, -21);
    context.lineTo(12, -18);
    context.closePath();
    context.fill();

    context.restore();
  }

  function drawDateCrack(progress, strong = false) {
    if (progress <= 0) return;
    const centerX = state.width * 0.5;
    const baseY = state.height * 0.695;
    const spread = state.width * 0.48 * easeOutCubic(progress);

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = strong ? "rgba(91,168,213,0.95)" : "rgba(85,150,188,0.8)";
    context.lineWidth = strong ? 3.2 : 1.8;
    context.shadowBlur = strong ? 16 : 9;
    context.shadowColor = "rgba(117,207,255,0.55)";

    const drawBranch = (direction) => {
      context.beginPath();
      context.moveTo(centerX, baseY);
      context.lineTo(centerX + direction * spread * 0.16, baseY + 7);
      context.lineTo(centerX + direction * spread * 0.34, baseY - 3);
      context.lineTo(centerX + direction * spread * 0.56, baseY + 12);
      context.lineTo(centerX + direction * spread * 0.78, baseY + 4);
      context.lineTo(centerX + direction * spread, baseY + 15);
      context.stroke();
    };

    drawBranch(-1);
    drawBranch(1);

    // The date is hidden as tiny fracture ticks, not readable title text.
    if (progress > 0.56) {
      context.globalAlpha = 0.14;
      context.strokeStyle = "#f0fbff";
      context.lineWidth = 0.8;
      const marks = [1, 7, 0, 3, 2, 0, 2, 6];
      marks.forEach((digit, index) => {
        const x = centerX - 35 + index * 10;
        const height = 3 + (digit % 4) * 1.5;
        context.beginPath();
        context.moveTo(x, baseY - 3);
        context.lineTo(x + (digit % 2 ? 2 : -2), baseY - 3 - height);
        context.stroke();
      });
    }

    context.restore();
  }

  function renderSurface() {
    drawSurfaceSky();
    drawSnow();
    drawIceSurface();

    const kissProgress = sceneProgress("kiss");
    const sceneProgressValue = inverseLerp(0, 6, state.time);
    const approach = smootherstep(inverseLerp(0.8, 4.2, state.time));
    const lean = smootherstep(inverseLerp(4.0, 8.0, state.time));

    const leftStart = state.width * 0.39;
    const rightStart = state.width * 0.61;
    const leftEnd = state.width * 0.475;
    const rightEnd = state.width * 0.525;
    const leftX = lerp(leftStart, leftEnd, approach);
    const rightX = lerp(rightStart, rightEnd, approach);
    const groundY = state.height * 0.66;
    const scale = clamp(Math.min(state.width / 390, state.height / 780), 0.88, 1.28);

    const slowMotion = sceneIsActive("kiss") ? Math.sin(kissProgress * Math.PI) : 0;
    const headLean = lerp(0, 0.19, lean);

    drawBreath(leftX + 20 * scale, groundY - 31 * scale, 1, 1 - slowMotion * 0.65);
    drawBreath(rightX - 20 * scale, groundY - 31 * scale, -1, 1 - slowMotion * 0.65);

    drawPenguin(
      leftX,
      groundY,
      1.08 * scale,
      1,
      headLean,
      fract(state.time * 0.21)
    );
    drawPenguin(
      rightX,
      groundY,
      1.08 * scale,
      -1,
      headLean,
      fract(state.time * 0.19 + 0.36)
    );

    if (state.time >= 6.25) {
      drawDateCrack(inverseLerp(6.25, 10, state.time), kissProgress > 0.74);
    }

    if (sceneIsActive("kiss")) {
      context.save();
      const glow = context.createRadialGradient(
        state.width * 0.5,
        groundY - 35 * scale,
        0,
        state.width * 0.5,
        groundY - 35 * scale,
        state.width * 0.35
      );
      glow.addColorStop(0, `rgba(255,255,255,${0.09 + slowMotion * 0.08})`);
      glow.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, state.width, state.height);
      context.restore();
    }

    drawVignette(0.24 + sceneProgressValue * 0.05);
  }

  function renderEnterIce() {
    const progress = sceneProgress("enterIce");
    const eased = easeInCubic(progress);

    drawVerticalGradient("#adcfe1", "#06111d");

    const openingWidth = lerp(state.width * 0.75, state.width * 0.11, eased);
    const openingHeight = lerp(state.height * 0.22, state.height * 0.045, eased);
    const openingY = lerp(state.height * 0.5, state.height * 0.08, eased);

    const light = context.createRadialGradient(
      state.width * 0.5,
      openingY,
      0,
      state.width * 0.5,
      openingY,
      openingWidth
    );
    light.addColorStop(0, "rgba(238,250,255,0.95)");
    light.addColorStop(0.3, "rgba(171,222,249,0.48)");
    light.addColorStop(1, "rgba(171,222,249,0)");
    context.fillStyle = light;
    context.beginPath();
    context.ellipse(
      state.width * 0.5,
      openingY,
      openingWidth,
      openingHeight,
      0,
      0,
      Math.PI * 2
    );
    context.fill();

    context.save();
    context.strokeStyle = "rgba(224,246,255,0.22)";
    context.lineWidth = 1.3;
    for (let streak = 0; streak < 20; streak += 1) {
      const x = fract(streak * 0.173 + state.time * 0.09) * state.width;
      const y = fract(streak * 0.119 + progress * 1.8) * state.height;
      context.beginPath();
      context.moveTo(x, y - 18);
      context.lineTo(x + (x - state.width * 0.5) * 0.08, y + 46);
      context.stroke();
    }
    context.restore();

    const frame = context.createRadialGradient(
      state.width * 0.5,
      state.height * 0.42,
      state.width * 0.06,
      state.width * 0.5,
      state.height * 0.42,
      Math.max(state.width, state.height) * 0.72
    );
    frame.addColorStop(0, "rgba(10,31,50,0)");
    frame.addColorStop(0.48, "rgba(9,26,43,0.22)");
    frame.addColorStop(1, `rgba(1,5,10,${0.75 + progress * 0.2})`);
    context.fillStyle = frame;
    context.fillRect(0, 0, state.width, state.height);
  }

  function descentPalette(progress) {
    const stops = [
      { at: 0, ice: [225, 246, 255], edge: [169, 224, 248], dark: [40, 83, 112] },
      { at: 0.22, ice: [157, 228, 255], edge: [80, 182, 232], dark: [18, 68, 108] },
      { at: 0.46, ice: [70, 161, 226], edge: [35, 111, 186], dark: [9, 39, 78] },
      { at: 0.7, ice: [34, 94, 168], edge: [18, 65, 127], dark: [4, 20, 48] },
      { at: 1, ice: [9, 39, 84], edge: [6, 29, 65], dark: [1, 8, 23] },
    ];

    for (let index = 0; index < stops.length - 1; index += 1) {
      const current = stops[index];
      const next = stops[index + 1];
      if (progress >= current.at && progress <= next.at) {
        const local = inverseLerp(current.at, next.at, progress);
        return {
          ice: mixColor(current.ice, next.ice, local),
          edge: mixColor(current.edge, next.edge, local),
          dark: mixColor(current.dark, next.dark, local),
        };
      }
    }

    return stops[stops.length - 1];
  }

  function descentVelocity(seconds, progress) {
    const stageBoost =
      progress < 0.18
        ? 0.72
        : progress < 0.4
        ? 1.0
        : progress < 0.68
        ? 1.24
        : progress < 0.86
        ? 1.48
        : 1.78;
    const tempo = 1 + Math.sin(seconds * 0.22) * 0.13 + Math.sin(seconds * 0.071) * 0.08;
    return stageBoost * tempo;
  }

  function crackPulseData(seconds, progress) {
    const interval = lerp(8.2, 4.4, progress);
    const index = Math.floor(seconds / interval);
    const local = fract(seconds / interval);
    const intensity = pulse(local, 0.03, 0.58, 0.98) * lerp(0.28, 1, progress);
    return { interval, index, local, intensity };
  }

  function drawSolidTunnel(seconds, progress, palette) {
    const velocity = descentVelocity(seconds, progress);
    const travel = seconds * 0.048 * velocity;
    const centerDriftX =
      Math.sin(seconds * 0.19) * state.width * 0.045 +
      Math.sin(seconds * 0.053) * state.width * 0.07;
    const centerDriftY = Math.sin(seconds * 0.11) * state.height * 0.025;
    const maxRadius = Math.hypot(state.width, state.height);

    const visibleSlabs = slabShapes
      .map((shape, index) => {
        const phase = fract(index / slabShapes.length + travel);
        return { shape, index, phase };
      })
      .sort((a, b) => a.phase - b.phase);

    for (const slab of visibleSlabs) {
      const depth = smootherstep(slab.phase);
      const innerRadius = lerp(26, maxRadius * 1.18, depth);
      const thickness = innerRadius * slab.shape.thickness;
      const centerX =
        state.width * 0.5 +
        centerDriftX * (1 - depth * 0.55) +
        slab.shape.offsetX * state.width * (0.34 + depth * 0.18);
      const centerY =
        state.height * 0.45 +
        centerDriftY * (1 - depth * 0.5) +
        slab.shape.offsetY * state.height * (0.24 + depth * 0.12);
      const alpha = clamp(0.24 + depth * 0.76);
      const slabLight = mixColor(palette.ice, palette.edge, slab.index % 3 === 0 ? 0.36 : 0.12);
      const slabDark = mixColor(palette.dark, palette.edge, 0.2);

      const gradient = context.createRadialGradient(
        centerX - innerRadius * 0.2,
        centerY - innerRadius * 0.26,
        innerRadius * 0.12,
        centerX,
        centerY,
        innerRadius + thickness * 2.4
      );
      gradient.addColorStop(0, rgba(slabLight, 0.2 + alpha * 0.22));
      gradient.addColorStop(0.72, rgba(slabLight, 0.54 + alpha * 0.28));
      gradient.addColorStop(1, rgba(slabDark, 0.88));

      context.save();
      context.translate(centerX, centerY);
      context.rotate(slab.shape.rotation + Math.sin(seconds * 0.05 + slab.index) * 0.025);
      context.translate(-centerX, -centerY);

      const ringPath = new Path2D();
      ringPath.rect(-maxRadius, -maxRadius, maxRadius * 2, maxRadius * 2);
      for (let pointIndex = slab.shape.points.length - 1; pointIndex >= 0; pointIndex -= 1) {
        const point = slab.shape.points[pointIndex];
        const radius = innerRadius * point.roughness;
        const x = centerX + Math.cos(point.angle) * radius;
        const y = centerY + Math.sin(point.angle) * radius * 0.74;
        if (pointIndex === slab.shape.points.length - 1) ringPath.moveTo(x, y);
        else ringPath.lineTo(x, y);
      }
      ringPath.closePath();

      context.fillStyle = gradient;
      context.fill(ringPath, "evenodd");

      context.strokeStyle = rgba(palette.ice, 0.11 + alpha * 0.28);
      context.lineWidth = Math.max(1.2, thickness * 0.17);
      context.shadowBlur = Math.min(18, thickness * 0.25);
      context.shadowColor = rgba(palette.edge, 0.24);
      context.beginPath();
      slab.shape.points.forEach((point, pointIndex) => {
        const radius = innerRadius * point.roughness;
        const x = centerX + Math.cos(point.angle) * radius;
        const y = centerY + Math.sin(point.angle) * radius * 0.74;
        if (pointIndex === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.closePath();
      context.stroke();

      // Compression bands make the surfaces read as solid ice.
      context.shadowBlur = 0;
      context.globalAlpha = (1 - depth) * 0.16 + 0.04;
      context.strokeStyle = rgba(palette.dark, 0.55);
      context.lineWidth = 1;
      for (let band = 0; band < 3; band += 1) {
        const bandRadius = innerRadius + thickness * (0.28 + band * 0.28);
        context.beginPath();
        context.ellipse(centerX, centerY, bandRadius, bandRadius * 0.74, 0, 0, Math.PI * 2);
        context.stroke();
      }

      context.restore();
    }
  }

  function drawSurfaceLightDuringDescent(progress) {
    const visibility = Math.pow(1 - progress, 2.1);
    if (visibility <= 0.005) return;

    const radius = lerp(state.width * 0.48, state.width * 0.08, smoothstep(progress * 1.4));
    const gradient = context.createRadialGradient(
      state.width * 0.5,
      state.height * 0.03,
      0,
      state.width * 0.5,
      state.height * 0.03,
      radius * 2.4
    );
    gradient.addColorStop(0, `rgba(235,250,255,${visibility * 0.66})`);
    gradient.addColorStop(0.32, `rgba(154,221,255,${visibility * 0.23})`);
    gradient.addColorStop(1, "rgba(154,221,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, state.width, state.height * 0.62);
  }

  function drawTrappedBubbles(seconds, progress) {
    const amount = clamp(1 - progress * 1.35);
    if (amount <= 0) return;

    context.save();
    context.strokeStyle = "rgba(238,250,255,0.25)";
    context.lineWidth = 1;
    for (let index = 0; index < 28; index += 1) {
      const pseudo = fract(index * 0.61803398875);
      const x = fract(pseudo + seconds * 0.006 * (index % 2 ? 1 : -1)) * state.width;
      const y = fract(index * 0.277 + seconds * 0.011) * state.height;
      const radius = 1.5 + (index % 5) * 1.1;
      context.globalAlpha = amount * (0.08 + (index % 4) * 0.035);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function createCrackPath(seed, fierce) {
    const crackRandom = mulberry32(seed * 917 + 73);
    const points = [];
    let x = state.width * (0.32 + crackRandom() * 0.36);
    let y = -20;
    points.push({ x, y });
    const segmentCount = fierce ? 15 : 11;
    for (let segment = 1; segment < segmentCount; segment += 1) {
      x += (crackRandom() - 0.5) * state.width * (fierce ? 0.22 : 0.17);
      x = clamp(x, state.width * 0.05, state.width * 0.95);
      y += state.height / (segmentCount - 1) * (0.72 + crackRandom() * 0.48);
      points.push({ x, y });
    }
    return points;
  }

  function drawHuntingCracks(seconds, progress) {
    const pulseData = crackPulseData(seconds, progress);
    const fierce = progress > 0.47;
    const points = createCrackPath(pulseData.index, fierce);
    const visibleSegments = Math.max(1, Math.floor((points.length - 1) * easeOutCubic(pulseData.local)));
    const finalFraction = fract((points.length - 1) * easeOutCubic(pulseData.local));

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = `rgba(173,229,255,${0.34 + pulseData.intensity * 0.54})`;
    context.lineWidth = lerp(1.25, 3.1, progress);
    context.shadowBlur = lerp(8, 23, pulseData.intensity);
    context.shadowColor = "rgba(91,192,255,0.9)";
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index <= visibleSegments; index += 1) {
      const point = points[index];
      context.lineTo(point.x, point.y);
    }
    if (visibleSegments < points.length - 1) {
      const from = points[visibleSegments];
      const to = points[visibleSegments + 1];
      context.lineTo(
        lerp(from.x, to.x, finalFraction),
        lerp(from.y, to.y, finalFraction)
      );
    }
    context.stroke();

    // Secondary branches make the fracture hunt instead of reading as one overlay line.
    const branchCount = Math.floor(lerp(1, 5, progress));
    for (let branch = 0; branch < branchCount; branch += 1) {
      const anchorIndex = Math.min(
        visibleSegments,
        2 + ((branch * 3 + pulseData.index) % Math.max(3, points.length - 3))
      );
      const anchor = points[anchorIndex];
      const branchRandom = mulberry32(pulseData.index * 101 + branch * 29);
      context.globalAlpha = 0.32 + pulseData.intensity * 0.42;
      context.beginPath();
      context.moveTo(anchor.x, anchor.y);
      context.lineTo(
        anchor.x + (branchRandom() - 0.5) * state.width * 0.23,
        anchor.y + (0.06 + branchRandom() * 0.14) * state.height
      );
      context.lineTo(
        anchor.x + (branchRandom() - 0.5) * state.width * 0.31,
        anchor.y + (0.15 + branchRandom() * 0.18) * state.height
      );
      context.stroke();
    }

    context.restore();

    if (!REDUCED_MOTION && pulseData.local > 0.54 && pulseData.local < 0.64) {
      const flash = Math.sin(inverseLerp(0.54, 0.64, pulseData.local) * Math.PI);
      context.fillStyle = `rgba(151,220,255,${flash * lerp(0.025, 0.12, progress)})`;
      context.fillRect(0, 0, state.width, state.height);
    }

    return pulseData;
  }

  function drawMovingParticles(seconds, progress) {
    context.save();
    for (const particle of suspendedParticles) {
      const direction = particle.x > 0.5 ? -1 : 1;
      const x =
        fract(particle.x + seconds * 0.004 * direction * particle.speed) *
        state.width;
      const y = fract(particle.y + seconds * 0.012 * particle.speed) * state.height;
      context.globalAlpha = lerp(0.06, 0.17, progress) * particle.speed;
      context.fillStyle = "#d9f2ff";
      context.beginPath();
      context.arc(
        x + Math.sin(seconds + particle.phase) * 9,
        y,
        particle.radius,
        0,
        Math.PI * 2
      );
      context.fill();
    }
    context.restore();
  }

  function drawIcePhrase(seconds, progress) {
    const phrase = PHRASES.find((item) => seconds >= item.start && seconds <= item.end);
    if (!phrase) return;

    const local = inverseLerp(phrase.start, phrase.end, seconds);
    const alpha = Math.sin(local * Math.PI);
    const sideX = phrase.side < 0 ? state.width * 0.28 : state.width * 0.72;
    const passScale = lerp(0.72, 1.45, smootherstep(local));
    const y = lerp(state.height * 0.28, state.height * 0.7, smootherstep(local));

    context.save();
    context.translate(sideX, y);
    context.rotate(phrase.tilt + Math.sin(seconds * 0.18) * 0.015);
    context.scale(passScale, passScale * 0.96);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = `${Math.max(19, state.width * 0.055)}px Georgia, serif`;
    context.fillStyle = `rgba(231,246,255,${alpha * 0.64})`;
    context.shadowColor = `rgba(125,208,255,${alpha * 0.36})`;
    context.shadowBlur = 12;
    context.fillText(phrase.text, 0, 0);

    // A refracted duplicate makes the words feel inside the ice surface.
    context.globalAlpha = alpha * 0.12;
    context.scale(1.03, 1.1);
    context.fillText(phrase.text, 2, 5);
    context.restore();
  }

  function drawTinyLlama(x, y, scale, direction) {
    context.save();
    context.translate(x, y);
    context.scale(scale * direction, scale);
    context.fillStyle = "rgba(225,235,241,0.88)";
    context.fillRect(-8, -6, 15, 8);
    context.fillRect(4, -14, 5, 10);
    context.fillRect(-5, 2, 2, 8);
    context.fillRect(1, 2, 2, 8);
    context.fillRect(6, 2, 2, 8);
    context.beginPath();
    context.moveTo(5, -14);
    context.lineTo(6, -19);
    context.lineTo(8, -14);
    context.moveTo(8, -14);
    context.lineTo(10, -18);
    context.lineTo(11, -13);
    context.fill();
    context.restore();
  }

  function drawLibraryGlimpse(seconds) {
    const start = 68.1;
    const end = 69.35;
    if (seconds < start || seconds > end) return;

    const local = inverseLerp(start, end, seconds);
    const alpha = Math.sin(local * Math.PI);
    const rush = lerp(state.width * 0.7, -state.width * 0.34, smootherstep(local));

    context.save();
    context.globalAlpha = alpha * 0.92;
    context.translate(rush, 0);
    context.transform(1, -0.08, -0.18, 1, 0, 0);

    const chamberX = state.width * 0.28;
    const chamberY = state.height * 0.16;
    const chamberWidth = state.width * 0.88;
    const chamberHeight = state.height * 0.72;

    const clip = new Path2D();
    clip.moveTo(chamberX, chamberY + chamberHeight);
    clip.lineTo(chamberX, chamberY + chamberHeight * 0.34);
    clip.quadraticCurveTo(
      chamberX + chamberWidth * 0.5,
      chamberY - chamberHeight * 0.08,
      chamberX + chamberWidth,
      chamberY + chamberHeight * 0.34
    );
    clip.lineTo(chamberX + chamberWidth, chamberY + chamberHeight);
    clip.closePath();
    context.clip(clip);

    const chamberGradient = context.createLinearGradient(
      chamberX,
      chamberY,
      chamberX + chamberWidth,
      chamberY + chamberHeight
    );
    chamberGradient.addColorStop(0, "rgba(8,21,34,0.96)");
    chamberGradient.addColorStop(0.5, "rgba(28,66,96,0.85)");
    chamberGradient.addColorStop(1, "rgba(2,8,14,0.98)");
    context.fillStyle = chamberGradient;
    context.fillRect(chamberX, chamberY, chamberWidth, chamberHeight);

    // Central aisle and distant arch.
    context.strokeStyle = "rgba(190,225,244,0.2)";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(chamberX + chamberWidth * 0.5, chamberY + chamberHeight);
    context.lineTo(chamberX + chamberWidth * 0.5, chamberY + chamberHeight * 0.25);
    context.stroke();
    context.beginPath();
    context.ellipse(
      chamberX + chamberWidth * 0.5,
      chamberY + chamberHeight * 0.31,
      chamberWidth * 0.12,
      chamberHeight * 0.17,
      0,
      Math.PI,
      0
    );
    context.stroke();

    // Shelf walls.
    for (let side = 0; side < 2; side += 1) {
      const shelfX = side === 0 ? chamberX + chamberWidth * 0.06 : chamberX + chamberWidth * 0.67;
      for (let shelf = 0; shelf < 4; shelf += 1) {
        const shelfY = chamberY + chamberHeight * (0.36 + shelf * 0.13);
        context.fillStyle = "rgba(9,15,23,0.9)";
        context.fillRect(shelfX, shelfY, chamberWidth * 0.27, chamberHeight * 0.09);
        context.fillStyle = "rgba(190,214,228,0.08)";
        context.fillRect(shelfX, shelfY, chamberWidth * 0.27, 2);
        for (let book = 0; book < 9; book += 1) {
          context.fillStyle = `rgba(${35 + book * 5},${47 + book * 4},${61 + book * 4},0.82)`;
          context.fillRect(
            shelfX + 8 + book * (chamberWidth * 0.026),
            shelfY + 9,
            chamberWidth * 0.017,
            chamberHeight * (0.035 + (book % 3) * 0.008)
          );
        }
      }
    }

    // Tiny llamas: deliberately replay-sized.
    drawTinyLlama(
      chamberX + chamberWidth * 0.755,
      chamberY + chamberHeight * 0.575,
      0.65,
      1
    );
    drawTinyLlama(
      chamberX + chamberWidth * 0.79,
      chamberY + chamberHeight * 0.578,
      0.62,
      -1
    );

    // A few pages flash across the chamber.
    context.fillStyle = "rgba(236,244,249,0.3)";
    for (const page of pages) {
      context.save();
      context.translate(
        chamberX + page.x * chamberWidth,
        chamberY + page.y * chamberHeight
      );
      context.rotate(page.rotation + seconds * page.spin);
      context.fillRect(-7, -4, 14, 8);
      context.restore();
    }

    context.restore();

    // Strong lateral streaks keep the library a one-second drive-by, not a scene.
    context.save();
    context.globalAlpha = alpha * 0.2;
    context.strokeStyle = "#d9f4ff";
    for (let line = 0; line < 12; line += 1) {
      const y = (line / 11) * state.height;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(state.width, y + 14);
      context.stroke();
    }
    context.restore();
  }

  function drawSeedEasterEgg(seconds) {
    const start = 108;
    const end = 115;
    if (seconds < start || seconds > end) return;

    const local = inverseLerp(start, end, seconds);
    const pulsePosition = local * 8;
    const pulseNumber = Math.floor(pulsePosition);
    const pulseAmount = Math.sin(fract(pulsePosition) * Math.PI);
    const alpha = Math.sin(local * Math.PI);
    const x = state.width * 0.72;
    const y = state.height * 0.42;

    context.save();
    context.globalAlpha = alpha;
    const glowRadius = 18 + pulseAmount * 21;
    const glow = context.createRadialGradient(x, y, 0, x, y, glowRadius * 2.4);
    glow.addColorStop(0, "rgba(244,255,194,0.96)");
    glow.addColorStop(0.23, "rgba(159,242,178,0.42)");
    glow.addColorStop(1, "rgba(109,211,255,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, glowRadius * 2.4, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "rgba(245,255,213,0.94)";
    context.beginPath();
    context.ellipse(x, y, 7, 12, 0.28, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = alpha * 0.14;
    context.strokeStyle = "rgba(222,251,255,0.9)";
    for (let ring = 0; ring <= Math.min(7, pulseNumber); ring += 1) {
      context.beginPath();
      context.arc(x, y, 22 + ring * 8, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function renderDescent() {
    const seconds = state.time - TIMELINE.descent[0];
    const progress = clamp(seconds / DESCENT_DURATION);
    const palette = descentPalette(progress);
    const pulseData = crackPulseData(seconds, progress);
    const shake = REDUCED_MOTION ? 0 : pulseData.intensity * lerp(1.3, 5.6, progress);
    const roll = REDUCED_MOTION
      ? 0
      : Math.sin(seconds * 0.17) * lerp(0.006, 0.028, progress) +
        Math.sin(seconds * 0.47) * 0.006;

    drawVerticalGradient(rgba(palette.dark), rgba(mixColor(palette.dark, [0, 2, 8], 0.58)));

    context.save();
    context.translate(
      state.width * 0.5 + Math.sin(seconds * 17.3) * shake,
      state.height * 0.5 + Math.cos(seconds * 14.1) * shake
    );
    context.rotate(roll);
    context.translate(-state.width * 0.5, -state.height * 0.5);

    drawSolidTunnel(seconds, progress, palette);
    drawSurfaceLightDuringDescent(progress);
    drawTrappedBubbles(seconds, progress);
    drawMovingParticles(seconds, progress);
    drawIcePhrase(seconds, progress);
    drawSeedEasterEgg(seconds);
    drawLibraryGlimpse(seconds);
    drawHuntingCracks(seconds, progress);

    context.restore();

    // The light changes smoothly from pale blue to near-black over the 133-second fall.
    const darkness = smoothstep(inverseLerp(0.62, 1, progress));
    context.fillStyle = `rgba(0,4,12,${darkness * 0.27})`;
    context.fillRect(0, 0, state.width, state.height);
    drawVignette(lerp(0.3, 0.78, progress));
  }

  function drawIcebergUnderside(lightAmount = 1, crackAmount = 0) {
    drawVerticalGradient("#03101d", "#000207");

    const beam = context.createLinearGradient(0, 0, 0, state.height);
    beam.addColorStop(0, `rgba(127,208,255,${0.34 * lightAmount})`);
    beam.addColorStop(0.48, `rgba(76,150,209,${0.1 * lightAmount})`);
    beam.addColorStop(1, "rgba(20,66,100,0)");
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(state.width * 0.37, 0);
    context.lineTo(state.width * 0.63, 0);
    context.lineTo(state.width * 0.77, state.height);
    context.lineTo(state.width * 0.23, state.height);
    context.closePath();
    context.fill();

    const undersideGradient = context.createLinearGradient(0, 0, 0, state.height * 0.44);
    undersideGradient.addColorStop(0, "#2e78a8");
    undersideGradient.addColorStop(0.22, "#18517b");
    undersideGradient.addColorStop(0.62, "#0a2b48");
    undersideGradient.addColorStop(1, "#03111e");
    context.fillStyle = undersideGradient;
    context.beginPath();
    context.moveTo(-20, -10);
    context.lineTo(state.width + 20, -10);
    context.lineTo(state.width * 0.94, state.height * 0.2);
    context.lineTo(state.width * 0.81, state.height * 0.29);
    context.lineTo(state.width * 0.72, state.height * 0.25);
    context.lineTo(state.width * 0.62, state.height * 0.38);
    context.lineTo(state.width * 0.52, state.height * 0.31);
    context.lineTo(state.width * 0.39, state.height * 0.42);
    context.lineTo(state.width * 0.3, state.height * 0.29);
    context.lineTo(state.width * 0.17, state.height * 0.34);
    context.lineTo(state.width * 0.04, state.height * 0.22);
    context.closePath();
    context.fill();

    context.save();
    context.globalAlpha = 0.16;
    context.strokeStyle = "#b8e8ff";
    for (let ridge = 0; ridge < 9; ridge += 1) {
      const y = state.height * (0.04 + ridge * 0.035);
      context.beginPath();
      context.moveTo(-10, y);
      context.bezierCurveTo(
        state.width * 0.32,
        y + 18,
        state.width * 0.68,
        y - 16,
        state.width + 10,
        y + 6
      );
      context.stroke();
    }
    context.restore();

    if (crackAmount > 0) {
      context.save();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = `rgba(154,226,255,${0.3 + crackAmount * 0.66})`;
      context.lineWidth = 2.6;
      context.shadowBlur = 20;
      context.shadowColor = "rgba(90,203,255,0.9)";
      const centerX = state.width * 0.51;
      const centerY = state.height * 0.25;
      for (let branch = 0; branch < 5; branch += 1) {
        const angle = -Math.PI * 0.94 + branch * (Math.PI * 0.47);
        const length = state.width * (0.22 + branch % 2 * 0.08) * easeOutCubic(crackAmount);
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.lineTo(
          centerX + Math.cos(angle) * length * 0.43,
          centerY + Math.sin(angle) * length * 0.26
        );
        context.lineTo(
          centerX + Math.cos(angle + 0.15) * length * 0.72,
          centerY + Math.sin(angle + 0.15) * length * 0.4
        );
        context.lineTo(
          centerX + Math.cos(angle - 0.1) * length,
          centerY + Math.sin(angle - 0.1) * length * 0.54
        );
        context.stroke();
      }
      context.restore();
    }

    context.save();
    for (const particle of suspendedParticles.slice(0, 42)) {
      context.globalAlpha = 0.08 + particle.speed * 0.12;
      context.fillStyle = "#dff6ff";
      context.beginPath();
      context.arc(
        particle.x * state.width,
        particle.y * state.height,
        particle.radius * 0.72,
        0,
        Math.PI * 2
      );
      context.fill();
    }
    context.restore();

    drawVignette(0.62);
  }

  function renderBottomReveal() {
    const progress = sceneProgress("bottomReveal");
    drawIcebergUnderside(easeOutCubic(progress), 0);

    // The camera settles after the long fall so the scale can land cleanly.
    context.fillStyle = `rgba(0,2,7,${(1 - progress) * 0.52})`;
    context.fillRect(0, 0, state.width, state.height);
  }

  function renderConvergence() {
    const progress = sceneProgress("convergence");
    drawIcebergUnderside(1 - progress * 0.18, progress);

    if (!REDUCED_MOTION) {
      const tremor = Math.sin(progress * Math.PI * 14) * progress * 1.3;
      context.save();
      context.globalAlpha = progress * 0.07;
      context.fillStyle = "#b6eaff";
      context.fillRect(tremor, 0, state.width, state.height);
      context.restore();
    }
  }

  function renderShatter() {
    const progress = sceneProgress("shatter");
    drawVerticalGradient("#06111d", "#000106");

    const pieces = [
      { x: 0.2, y: 0.12, w: 0.48, h: 0.28, rotation: -0.16, fall: 0.78 },
      { x: 0.63, y: 0.08, w: 0.42, h: 0.34, rotation: 0.19, fall: 0.94 },
      { x: 0.46, y: 0.18, w: 0.3, h: 0.24, rotation: -0.04, fall: 1.14 },
    ];

    for (const piece of pieces) {
      const fall = easeInCubic(progress) * state.height * piece.fall;
      context.save();
      context.translate(piece.x * state.width, piece.y * state.height + fall);
      context.rotate(piece.rotation + progress * piece.rotation * 1.4);
      const gradient = context.createLinearGradient(0, 0, 0, piece.h * state.height);
      gradient.addColorStop(0, "rgba(39,111,157,0.94)");
      gradient.addColorStop(1, "rgba(6,25,43,0.98)");
      context.fillStyle = gradient;
      context.beginPath();
      context.moveTo(-piece.w * state.width * 0.5, -piece.h * state.height * 0.5);
      context.lineTo(piece.w * state.width * 0.46, -piece.h * state.height * 0.43);
      context.lineTo(piece.w * state.width * 0.38, piece.h * state.height * 0.44);
      context.lineTo(-piece.w * state.width * 0.42, piece.h * state.height * 0.5);
      context.closePath();
      context.fill();
      context.strokeStyle = "rgba(166,226,255,0.24)";
      context.lineWidth = 2;
      context.stroke();
      context.restore();
    }

    // One clean gap closes the blue light instead of random debris soup.
    context.fillStyle = `rgba(0,0,0,${smoothstep(inverseLerp(0.52, 1, progress))})`;
    context.fillRect(0, 0, state.width, state.height);
  }

  function renderDarkness() {
    const progress = sceneProgress("darkness");
    clear("#000000");

    // Only a final shard glint remains, then true black.
    const glint = 1 - smoothstep(inverseLerp(0, 0.5, progress));
    if (glint > 0) {
      context.save();
      context.globalAlpha = glint * 0.18;
      context.strokeStyle = "#c6edff";
      context.beginPath();
      context.moveTo(state.width * 0.14, state.height * 0.18);
      context.lineTo(state.width * 0.24, state.height * 0.31);
      context.stroke();
      context.restore();
    }
  }

  function drawGlowingFish(item, x, y, scale, alpha) {
    const glowRadius = 24 * scale;
    const glow = context.createRadialGradient(x, y, 0, x, y, glowRadius);
    glow.addColorStop(0, `rgba(175,255,235,${0.82 * alpha})`);
    glow.addColorStop(0.28, `rgba(90,220,255,${0.3 * alpha})`);
    glow.addColorStop(1, "rgba(90,220,255,0)");
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, glowRadius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = `rgba(217,255,245,${0.92 * alpha})`;
    context.beginPath();
    context.ellipse(x, y, 7.5 * scale, 4.2 * scale, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(x - 7 * scale, y);
    context.lineTo(x - 13 * scale, y - 5 * scale);
    context.lineTo(x - 13 * scale, y + 5 * scale);
    context.closePath();
    context.fill();
  }

  function renderFish(showWhale = false, whaleProgress = 0) {
    drawVerticalGradient("#010307", "#000001");
    const fishProgress = sceneIsActive("fish") ? sceneProgress("fish") : 1;
    const visibleCount = Math.max(1, Math.floor(lerp(1, fish.length, easeOutCubic(fishProgress))));

    // The fish light the particles; the background does not simply fade up.
    for (let index = 0; index < suspendedParticles.length; index += 1) {
      const particle = suspendedParticles[index];
      const alpha = 0.02 + fishProgress * 0.045 * particle.speed;
      context.fillStyle = `rgba(172,229,242,${alpha})`;
      context.beginPath();
      context.arc(
        particle.x * state.width,
        particle.y * state.height,
        particle.radius * 0.62,
        0,
        Math.PI * 2
      );
      context.fill();
    }

    let strongestFishX = state.width * 0.42;
    let strongestFishY = state.height * 0.52;

    for (let index = 0; index < visibleCount; index += 1) {
      const item = fish[index];
      const x =
        fract(item.x + (state.time - TIMELINE.fish[0]) * item.speed * 0.08) *
        (state.width + 80) -
        40;
      const y =
        item.y * state.height +
        Math.sin(state.time * 0.7 + item.phase) * state.height * 0.045;
      const reveal = clamp((fishProgress * fish.length - index) / 2);
      drawGlowingFish(item, x, y, item.scale, reveal);
      if (index === 0) {
        strongestFishX = x;
        strongestFishY = y;
      }
    }

    if (showWhale) {
      const reveal = smoothstep(whaleProgress);
      const whaleX = state.width * 0.56;
      const whaleY = state.height * 0.57;
      const whaleWidth = state.width * 0.88;
      const whaleHeight = state.height * 0.24;

      // Fish-driven reveal mask over a whale that was already present.
      const revealGradient = context.createRadialGradient(
        strongestFishX,
        strongestFishY,
        0,
        strongestFishX,
        strongestFishY,
        Math.max(state.width, state.height) * (0.3 + reveal * 0.42)
      );
      revealGradient.addColorStop(0, `rgba(22,36,45,${0.94 * reveal})`);
      revealGradient.addColorStop(0.45, `rgba(11,20,28,${0.7 * reveal})`);
      revealGradient.addColorStop(1, "rgba(0,0,0,0)");

      context.save();
      context.globalCompositeOperation = "screen";
      context.fillStyle = revealGradient;
      context.beginPath();
      context.ellipse(whaleX, whaleY, whaleWidth * 0.5, whaleHeight * 0.5, -0.08, 0, Math.PI * 2);
      context.fill();
      context.restore();

      context.save();
      context.globalAlpha = 0.18 + reveal * 0.62;
      const whaleGradient = context.createLinearGradient(
        whaleX - whaleWidth * 0.4,
        whaleY - whaleHeight * 0.45,
        whaleX + whaleWidth * 0.35,
        whaleY + whaleHeight * 0.45
      );
      whaleGradient.addColorStop(0, "#182833");
      whaleGradient.addColorStop(0.58, "#0a151d");
      whaleGradient.addColorStop(1, "#03080d");
      context.fillStyle = whaleGradient;
      context.beginPath();
      context.ellipse(whaleX, whaleY, whaleWidth * 0.5, whaleHeight * 0.5, -0.08, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(whaleX + whaleWidth * 0.42, whaleY - whaleHeight * 0.03);
      context.lineTo(whaleX + whaleWidth * 0.59, whaleY - whaleHeight * 0.23);
      context.lineTo(whaleX + whaleWidth * 0.56, whaleY + whaleHeight * 0.18);
      context.closePath();
      context.fill();

      const eyeX = state.width * 0.34;
      const eyeY = state.height * 0.54;
      const eyeOpen = smoothstep(inverseLerp(0.44, 0.76, whaleProgress));
      context.globalAlpha = reveal;
      context.fillStyle = "rgba(139,184,207,0.25)";
      context.beginPath();
      context.ellipse(eyeX, eyeY, 18, 10 * eyeOpen, 0.02, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#010205";
      context.beginPath();
      context.arc(eyeX, eyeY, 5.8 * eyeOpen, 0, Math.PI * 2);
      context.fill();
      context.restore();

      if (state.time > 181.5 && state.time < 187.5) {
        const phraseProgress = inverseLerp(181.5, 187.5, state.time);
        context.save();
        context.globalAlpha = Math.sin(phraseProgress * Math.PI) * 0.48;
        context.fillStyle = "#d9f8ff";
        context.font = `${Math.max(21, state.width * 0.06)}px Georgia, serif`;
        context.textAlign = "center";
        context.fillText(
          "my forever...",
          state.width * 0.54 + Math.sin(state.time * 0.5) * 8,
          state.height * 0.77 - phraseProgress * 18
        );
        context.restore();
      }
    }

    drawVignette(0.76);
  }

  function renderEye() {
    const progress = sceneProgress("eye");
    drawVerticalGradient("#010307", "#000000");

    const eased = easeInOutCubic(progress);
    const eyeX = lerp(state.width * 0.34, state.width * 0.5, eased);
    const eyeY = lerp(state.height * 0.54, state.height * 0.5, eased);
    const eyeWidth = lerp(34, state.width * 1.32, eased);
    const eyeHeight = lerp(18, state.height * 0.76, eased);

    context.save();
    context.fillStyle = "#071018";
    context.beginPath();
    context.ellipse(
      state.width * 0.58,
      state.height * 0.58,
      state.width * 0.64,
      state.height * 0.22,
      -0.07,
      0,
      Math.PI * 2
    );
    context.fill();

    context.globalAlpha = 0.36 * (1 - progress * 0.55);
    context.fillStyle = "#87aabd";
    context.beginPath();
    context.ellipse(eyeX, eyeY, eyeWidth, eyeHeight, 0.01, 0, Math.PI * 2);
    context.fill();

    if (progress < 0.54) {
      context.globalAlpha = Math.sin(inverseLerp(0.05, 0.54, progress) * Math.PI) * 0.2;
      context.fillStyle = "#e6f8ff";
      context.font = `${Math.max(20, state.width * 0.052)}px Georgia, serif`;
      context.textAlign = "center";
      context.fillText("my forever love", eyeX, eyeY + 4);
    }

    const pupilRadius = lerp(7, Math.max(state.width, state.height) * 1.2, easeInCubic(progress));
    context.globalAlpha = 1;
    context.fillStyle = "#000000";
    context.beginPath();
    context.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2);
    context.fill();

    // One natural eye reflection survives briefly; no portal ring.
    if (progress < 0.34) {
      context.fillStyle = `rgba(224,249,255,${1 - progress / 0.34})`;
      context.beginPath();
      context.arc(eyeX + eyeWidth * 0.2, eyeY - eyeHeight * 0.18, 2.2, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();

    if (progress > 0.82) {
      context.fillStyle = `rgba(0,0,0,${smoothstep(inverseLerp(0.82, 1, progress))})`;
      context.fillRect(0, 0, state.width, state.height);
    }
  }

  function render() {
    if (state.width === 0 || state.height === 0) return;

    if (sceneIsActive("surface") || sceneIsActive("kiss")) {
      renderSurface();
    } else if (sceneIsActive("enterIce")) {
      renderEnterIce();
    } else if (sceneIsActive("descent")) {
      renderDescent();
    } else if (sceneIsActive("bottomReveal")) {
      renderBottomReveal();
    } else if (sceneIsActive("convergence")) {
      renderConvergence();
    } else if (sceneIsActive("shatter")) {
      renderShatter();
    } else if (sceneIsActive("darkness")) {
      renderDarkness();
    } else if (sceneIsActive("fish")) {
      renderFish(false, 0);
    } else if (sceneIsActive("whale")) {
      renderFish(true, sceneProgress("whale"));
    } else if (sceneIsActive("eye")) {
      renderEye();
    } else {
      clear("#000000");
    }
  }

  function updateInterface() {
    scrubber.value = String(state.time);
    clock.textContent = `${formatTime(state.time)} / ${formatTime(TOTAL_DURATION)}`;
  }

  function pause() {
    state.playing = false;
    if (state.frameRequest) cancelAnimationFrame(state.frameRequest);
    state.frameRequest = 0;
  }

  function play() {
    if (state.playing) return;
    if (state.time >= TOTAL_DURATION) state.time = 0;
    state.playing = true;
    state.lastFrame = performance.now();
    state.frameRequest = requestAnimationFrame(frame);
  }

  function restart() {
    pause();
    state.time = 0;
    updateInterface();
    render();
  }

  function frame(timestamp) {
    if (!state.playing) return;
    const delta = Math.min(0.05, (timestamp - state.lastFrame) / 1000);
    state.lastFrame = timestamp;
    state.time = Math.min(TOTAL_DURATION, state.time + delta);
    updateInterface();
    render();

    if (state.time >= TOTAL_DURATION) {
      pause();
      return;
    }

    state.frameRequest = requestAnimationFrame(frame);
  }

  function begin() {
    intro.classList.add("is-hidden");
    play();
  }

  startButton.addEventListener("click", begin);
  playButton.addEventListener("click", begin);
  pauseButton.addEventListener("click", pause);
  restartButton.addEventListener("click", restart);
  scrubber.addEventListener("input", (event) => {
    state.time = clamp(Number(event.target.value), 0, TOTAL_DURATION);
    updateInterface();
    render();
  });

  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("visibilitychange", () => {
    if (document.hidden) pause();
  });

  const parameters = new URLSearchParams(window.location.search);
  const requestedTime = Number(parameters.get("t") ?? parameters.get("time"));
  if (Number.isFinite(requestedTime)) {
    state.time = clamp(requestedTime, 0, TOTAL_DURATION);
    intro.classList.add("is-hidden");
  }

  resize();
  updateInterface();
  render();

  if (parameters.get("autoplay") === "1") {
    intro.classList.add("is-hidden");
    play();
  }
})();
