const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

const ui = {
  experience: document.querySelector('.experience'),
  startScreen: document.querySelector('#startScreen'),
  startButton: document.querySelector('#startButton'),
  pauseButton: document.querySelector('#pauseButton'),
  restartButton: document.querySelector('#restartButton'),
  progressBar: document.querySelector('#progressBar'),
  timeLabel: document.querySelector('#timeLabel'),
  sceneLabel: document.querySelector('#sceneLabel'),
  reducedMotionNote: document.querySelector('#reducedMotionNote'),
};

/**
 * DIRECTOR SETTINGS
 * Every number below is seconds. Change these before touching the drawing code.
 */
const FILM = {
  duration: 68,
  scenes: [
    { start: 0, end: 9.5, label: 'THE ICE' },
    { start: 9.5, end: 18.5, label: 'THE FALL' },
    { start: 18.5, end: 36, label: 'THE ABYSS' },
    { start: 36, end: 52.5, label: 'THE DEEP' },
    { start: 52.5, end: 58.5, label: 'THE EYE' },
    { start: 58.5, end: 68, label: 'HOME' },
  ],
  words: [
    { start: 18.7, end: 23.7, text: 'until the end', x: 0.42 },
    { start: 23.2, end: 29.3, text: 'i love you, always', x: 0.56 },
    { start: 28.8, end: 34.6, text: 'never let go', x: 0.44 },
    { start: 34.0, end: 40.4, text: 'planting the seed', x: 0.56 },
    { start: 40.0, end: 46.2, text: 'my forever...', x: 0.45 },
    { start: 46.3, end: 51.8, text: 'my forever love', x: 0.53 },
  ],
};

const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (prefersReducedMotion) ui.reducedMotionNote.hidden = false;

let cssWidth = 0;
let cssHeight = 0;
let dpr = 1;
let started = false;
let playing = false;
let elapsed = 0;
let previousFrame = performance.now();
let lastUiUpdate = 0;

const snow = makeSnow(72, 9012);
const plungeStreaks = makePlungeStreaks(46, 5513);
const motes = makeMotes(88, 1988);
const bubbles = makeBubbles(38, 9127);
const fish = makeFish(26, 7219);
const creatures = makeCreatures(12, 4471);
const stars = makeStars(190, 3027);
const continents = makeContinents(7, 8874);

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSnow(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: 0.5 + random() * 1.8,
    speed: 0.035 + random() * 0.09,
    drift: 7 + random() * 18,
    phase: random() * Math.PI * 2,
  }));
}

function makePlungeStreaks(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    length: 20 + random() * 110,
    speed: 0.4 + random() * 1.8,
    width: 0.5 + random() * 2.2,
    alpha: 0.1 + random() * 0.45,
  }));
}

function makeMotes(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: 0.4 + random() * 2.4,
    speed: 0.015 + random() * 0.08,
    phase: random() * Math.PI * 2,
    glow: random(),
  }));
}

function makeBubbles(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: 1.8 + random() * 7.5,
    speed: 0.022 + random() * 0.07,
    drift: 7 + random() * 24,
    phase: random() * Math.PI * 2,
  }));
}

function makeFish(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => ({
    x: 0.06 + random() * 0.88,
    y: 0.2 + random() * 0.69,
    size: 0.55 + random() * 1.35,
    speed: 0.018 + random() * 0.052,
    phase: random() * Math.PI * 2,
    delay: (index % 9) * 0.48 + Math.floor(index / 9) * 0.9,
    direction: random() > 0.35 ? 1 : -1,
    hue: index % 4,
  }));
}

function makeCreatures(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => ({
    x: 0.08 + random() * 0.84,
    y: 0.26 + random() * 0.65,
    size: 0.7 + random() * 1.25,
    speed: 0.03 + random() * 0.07,
    phase: random() * Math.PI * 2,
    delay: index * 0.27,
    hue: index % 3,
  }));
}

function makeStars(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => ({
    x: random(),
    y: random(),
    size: 0.35 + random() * 1.65,
    phase: random() * Math.PI * 2,
    depth: 0.25 + random() * 1.75,
    delay: (index % 31) * 0.055 + Math.floor(index / 31) * 0.18,
  }));
}

function makeContinents(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    angle: random() * Math.PI * 2,
    distance: 0.12 + random() * 0.52,
    width: 0.14 + random() * 0.24,
    height: 0.08 + random() * 0.2,
    rotation: random() * Math.PI,
  }));
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  cssWidth = Math.max(1, rect.width);
  cssHeight = Math.max(1, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
}

new ResizeObserver(resize).observe(canvas);
resize();

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function smoothstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function easeInCubic(value) {
  return value * value * value;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function bell(start, middle, end, value) {
  if (value <= start || value >= end) return 0;
  if (value < middle) return smoothstep(start, middle, value);
  return 1 - smoothstep(middle, end, value);
}

function mixColor(a, b, amount) {
  return a.map((value, index) => Math.round(lerp(value, b[index], amount)));
}

function withAlpha(alpha, callback) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  callback();
  ctx.restore();
}

function drawFrame(time) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawBase(time);

  const surfaceAlpha = 1 - smoothstep(13.2, 17.4, time);
  const plungeAlpha = smoothstep(9.1, 11.0, time) * (1 - smoothstep(19.2, 23.0, time));
  const deepAlpha = smoothstep(17.8, 22.5, time) * (1 - smoothstep(52.2, 56.1, time));
  const cosmosAlpha = smoothstep(56.0, 59.4, time);

  withAlpha(surfaceAlpha, () => drawSurface(time));
  withAlpha(plungeAlpha, () => drawPlunge(time));
  withAlpha(deepAlpha, () => drawDeep(time));

  drawEyeBlackout(time);
  withAlpha(cosmosAlpha, () => drawCosmos(time));

  if (time < 52.3) drawBuoyantWords(time);
  drawVignette(time);
  drawLetterbox(time);
  ctx.restore();
}

function drawBase(time) {
  const darkness = smoothstep(8, 22, time) * (1 - smoothstep(56, 62, time));
  const top = mixColor([7, 25, 43], [0, 2, 8], darkness);
  const bottom = mixColor([2, 9, 20], [0, 0, 3], darkness);
  const gradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
  gradient.addColorStop(0, `rgb(${top.join(' ')})`);
  gradient.addColorStop(1, `rgb(${bottom.join(' ')})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cssWidth, cssHeight);
}

function drawSurface(time) {
  const dive = easeInCubic(smoothstep(8.4, 16.3, time));
  const calmZoom = smoothstep(6.8, 9.3, time);
  const zoom = 1 + calmZoom * 0.12 + dive * (prefersReducedMotion ? 1.05 : 2.65);
  const targetX = cssWidth * lerp(0.5, 0.72, dive);
  const targetY = cssHeight * lerp(0.5, 0.75, dive);
  const roll = (prefersReducedMotion ? 0.008 : 0.045) * Math.sin(dive * Math.PI) + dive * 0.018;
  const shake = prefersReducedMotion ? 0 : smoothstep(10.8, 13.7, time) * (1 - smoothstep(14.2, 16.2, time));
  const shakeX = Math.sin(time * 34) * 3.2 * shake;
  const shakeY = Math.cos(time * 29) * 2.3 * shake;

  ctx.save();
  ctx.translate(cssWidth / 2 + shakeX, cssHeight / 2 + shakeY);
  ctx.rotate(roll);
  ctx.scale(zoom, zoom);
  ctx.translate(-targetX, -targetY);

  drawArcticSky(time);
  drawSnow(time);
  drawOceanSurface(time);
  drawIcebergDropOff(time);
  drawPenguins(time);
  drawSurfaceCracks(time);

  ctx.restore();

  drawDiveLens(time);
}

function drawArcticSky(time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
  gradient.addColorStop(0, '#061426');
  gradient.addColorStop(0.58, '#12344b');
  gradient.addColorStop(1, '#7eb9cb');
  ctx.fillStyle = gradient;
  ctx.fillRect(-cssWidth, -cssHeight, cssWidth * 3, cssHeight * 3);

  const moonX = cssWidth * 0.72;
  const moonY = cssHeight * 0.17;
  const moonRadius = Math.min(cssWidth, cssHeight) * 0.05;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius * 5);
  moonGlow.addColorStop(0, 'rgba(239,251,255,0.95)');
  moonGlow.addColorStop(0.18, 'rgba(177,229,255,0.2)');
  moonGlow.addColorStop(1, 'rgba(177,229,255,0)');
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius * 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(244,252,255,0.96)';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let band = 0; band < 3; band += 1) {
    const y = cssHeight * (0.2 + band * 0.052);
    ctx.beginPath();
    ctx.moveTo(-cssWidth * 0.1, y);
    for (let x = -cssWidth * 0.1; x <= cssWidth * 1.1; x += cssWidth / 8) {
      const wave = Math.sin(x * 0.009 + time * 0.23 + band * 1.35) * (10 + band * 4);
      ctx.quadraticCurveTo(x + cssWidth / 16, y + wave, x + cssWidth / 8, y - wave * 0.45);
    }
    const aurora = ctx.createLinearGradient(0, y - 35, 0, y + 72);
    aurora.addColorStop(0, 'rgba(74,255,214,0)');
    aurora.addColorStop(0.48, band === 1 ? 'rgba(125,165,255,0.11)' : 'rgba(76,241,203,0.12)');
    aurora.addColorStop(1, 'rgba(74,255,214,0)');
    ctx.strokeStyle = aurora;
    ctx.lineWidth = 27 + band * 9;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSnow(time) {
  ctx.save();
  ctx.fillStyle = '#f1fbff';
  for (const flake of snow) {
    const x = ((flake.x + time * flake.speed * 0.08) % 1) * cssWidth + Math.sin(time * 0.6 + flake.phase) * flake.drift;
    const y = ((flake.y + time * flake.speed) % 1) * cssHeight * 0.72;
    ctx.globalAlpha = 0.18 + flake.size * 0.17;
    ctx.beginPath();
    ctx.arc(x, y, flake.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawOceanSurface(time) {
  const horizon = cssHeight * 0.665;
  const gradient = ctx.createLinearGradient(0, horizon, 0, cssHeight);
  gradient.addColorStop(0, '#173e54');
  gradient.addColorStop(0.18, '#071b2e');
  gradient.addColorStop(1, '#010714');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, horizon, cssWidth, cssHeight - horizon);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let line = 0; line < 8; line += 1) {
    const y = horizon + 9 + line * 15;
    ctx.globalAlpha = 0.15 * (1 - line / 9);
    ctx.strokeStyle = '#b8eeff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -20; x <= cssWidth + 20; x += 16) {
      const wave = Math.sin(x * 0.055 + time * (0.55 + line * 0.04)) * (1.2 + line * 0.32);
      if (x === -20) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function drawIcebergDropOff(time) {
  const horizon = cssHeight * 0.665;
  const edgeX = cssWidth * 0.69;
  const crack = smoothstep(9.0, 12.6, time);

  const iceTop = ctx.createLinearGradient(0, horizon - 46, 0, horizon + 24);
  iceTop.addColorStop(0, '#f4fdff');
  iceTop.addColorStop(0.38, '#bbebf3');
  iceTop.addColorStop(1, '#5ba4b7');
  ctx.fillStyle = iceTop;
  ctx.beginPath();
  ctx.moveTo(-40, horizon + 12);
  ctx.quadraticCurveTo(cssWidth * 0.17, horizon - 24, cssWidth * 0.37, horizon - 5);
  ctx.quadraticCurveTo(cssWidth * 0.55, horizon - 25, edgeX - 18, horizon - 4);
  ctx.lineTo(edgeX + 8, horizon + 9);
  ctx.lineTo(edgeX - 12, horizon + 20);
  ctx.lineTo(-40, horizon + 32);
  ctx.closePath();
  ctx.fill();

  const wall = ctx.createLinearGradient(edgeX - 75, horizon, edgeX + 95, cssHeight);
  wall.addColorStop(0, '#8bd2df');
  wall.addColorStop(0.22, '#347b92');
  wall.addColorStop(0.58, '#0c3a52');
  wall.addColorStop(1, '#03111f');
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(edgeX - 12, horizon + 9);
  ctx.lineTo(edgeX + 9, horizon + 12);
  ctx.lineTo(edgeX + 22, horizon + 76);
  ctx.lineTo(edgeX - 2, horizon + 130);
  ctx.lineTo(edgeX + 15, horizon + 198);
  ctx.lineTo(edgeX - 15, cssHeight + 40);
  ctx.lineTo(cssWidth * 0.18, cssHeight + 40);
  ctx.lineTo(cssWidth * 0.09, horizon + 30);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(244,253,255,0.72)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 1);
  ctx.quadraticCurveTo(cssWidth * 0.36, horizon - 9, edgeX - 8, horizon + 3);
  ctx.stroke();

  if (crack > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const points = [
      [edgeX - 66, horizon - 6],
      [edgeX - 45, horizon + 2],
      [edgeX - 51, horizon + 18],
      [edgeX - 27, horizon + 26],
      [edgeX - 19, horizon + 48],
    ];
    drawPartialPath(points, crack, 'rgba(220,252,255,0.96)', 1.3);
    ctx.shadowColor = '#71dcff';
    ctx.shadowBlur = 14;
    drawPartialPath(points, crack, 'rgba(88,204,255,0.35)', 5);
    ctx.restore();
  }

  const depthGlow = ctx.createRadialGradient(edgeX + 18, horizon + 30, 2, edgeX + 18, horizon + 30, cssWidth * 0.38);
  depthGlow.addColorStop(0, 'rgba(37,102,133,0.2)');
  depthGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = depthGlow;
  ctx.fillRect(edgeX - cssWidth * 0.4, horizon - 20, cssWidth * 0.9, cssHeight * 0.7);
}

function drawSurfaceCracks(time) {
  const reveal = smoothstep(9.4, 13.2, time);
  if (reveal <= 0) return;
  const branches = [
    [[0.68, 0.66], [0.64, 0.64], [0.61, 0.61], [0.56, 0.62]],
    [[0.65, 0.64], [0.67, 0.60], [0.66, 0.56]],
    [[0.62, 0.62], [0.60, 0.58], [0.56, 0.55]],
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  branches.forEach((branch, index) => {
    const local = clamp(reveal * 1.3 - index * 0.16);
    drawPartialPolyline(branch, local, 'rgba(225,252,255,0.95)', 1.1);
  });
  ctx.restore();
}

function drawPenguins(time) {
  const centerX = cssWidth * 0.48;
  const groundY = cssHeight * 0.655;
  const entrance = easeInOutCubic(smoothstep(0.7, 4.0, time));
  const kiss = easeInOutCubic(smoothstep(4.6, 6.6, time));
  const hold = smoothstep(6.4, 7.5, time) * (1 - smoothstep(9.2, 11.2, time));
  const scale = Math.min(cssWidth / 390, cssHeight / 760) * 1.02;

  const leftX = lerp(-70, centerX - 42, entrance) + kiss * 12;
  const rightX = lerp(cssWidth + 70, centerX + 42, entrance) - kiss * 12;
  const leftLean = lerp(-0.04, 0.16, kiss);
  const rightLean = lerp(0.04, -0.16, kiss);
  const floatY = Math.sin(time * 1.35) * 1.2;

  drawPenguin(leftX, groundY + floatY, scale, 1, leftLean, '#f1a6bc');
  drawPenguin(rightX, groundY + floatY, scale, -1, rightLean, '#8fc5ff');

  if (kiss > 0.42) {
    const heartLife = clamp((time - 5.4) / 2.8);
    const heartAlpha = Math.sin(Math.PI * heartLife) * (0.72 + hold * 0.22);
    const heartY = groundY - 154 * scale - heartLife * 28;
    drawHeart(centerX, heartY, 10 + heartLife * 4, heartAlpha);
  }
}

function drawPenguin(x, y, scale, facing, lean, accent) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(scale * facing, scale);

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 5, 37, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#08131d';
  ctx.beginPath();
  ctx.ellipse(0, -58, 42, 67, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f2fbff';
  ctx.beginPath();
  ctx.ellipse(8, -50, 27, 49, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#08131d';
  ctx.beginPath();
  ctx.ellipse(5, -116, 32, 31, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f4fcff';
  ctx.beginPath();
  ctx.ellipse(18, -113, 19, 19, 0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1a2730';
  ctx.beginPath();
  ctx.arc(22, -118, 3.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f1a647';
  ctx.beginPath();
  ctx.moveTo(38, -108);
  ctx.lineTo(57, -101);
  ctx.lineTo(38, -96);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(3, -109, 31, Math.PI * 0.98, Math.PI * 1.85);
  ctx.stroke();

  ctx.fillStyle = '#08131d';
  ctx.beginPath();
  ctx.ellipse(-33, -59, 12, 42, 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#e69b3c';
  ctx.beginPath();
  ctx.ellipse(-13, -2, 20, 6, -0.08, 0, Math.PI * 2);
  ctx.ellipse(17, -2, 20, 6, 0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawHeart(x, y, size, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 18, size / 18);
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(255,137,178,0.95)';
  ctx.shadowBlur = 20;
  ctx.fillStyle = '#ff9abc';
  ctx.beginPath();
  ctx.moveTo(0, 15);
  ctx.bezierCurveTo(-18, 4, -19, -11, -8, -13);
  ctx.bezierCurveTo(-2, -14, 1, -9, 0, -5);
  ctx.bezierCurveTo(1, -9, 7, -14, 13, -12);
  ctx.bezierCurveTo(25, -7, 17, 7, 0, 15);
  ctx.fill();
  ctx.restore();
}

function drawDiveLens(time) {
  const hit = bell(10.8, 13.2, 15.7, time);
  if (hit <= 0) return;
  const radius = lerp(cssWidth * 0.08, Math.hypot(cssWidth, cssHeight) * 0.84, easeOutCubic(smoothstep(11.0, 15.5, time)));
  const centerX = cssWidth * 0.7;
  const centerY = cssHeight * 0.72;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = hit * 0.6;
  ctx.strokeStyle = 'rgba(204,248,255,0.75)';
  ctx.lineWidth = Math.max(2, cssWidth * 0.012) * (1 - smoothstep(14, 15.8, time));
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const submerge = smoothstep(12.2, 15.6, time);
  const wash = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.hypot(cssWidth, cssHeight));
  wash.addColorStop(0, `rgba(190,239,255,${0.08 * submerge})`);
  wash.addColorStop(0.36, `rgba(17,86,120,${0.28 * submerge})`);
  wash.addColorStop(1, `rgba(0,5,14,${0.78 * submerge})`);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, cssWidth, cssHeight);
}

function drawPlunge(time) {
  const local = clamp((time - 9.5) / 13.5);
  const speed = smoothstep(10.2, 15.2, time) * (1 - smoothstep(18.4, 22.4, time));
  const darkness = smoothstep(13.2, 20.8, time);

  const gradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
  gradient.addColorStop(0, `rgba(21,83,113,${1 - darkness * 0.82})`);
  gradient.addColorStop(0.38, `rgba(3,24,43,${0.96})`);
  gradient.addColorStop(1, '#00040b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  drawClosingSurfaceLight(time);
  drawIceWalls(time);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const streak of plungeStreaks) {
    const y = ((streak.y - time * streak.speed * 0.14) % 1 + 1) % 1 * (cssHeight + streak.length) - streak.length;
    const x = streak.x * cssWidth + Math.sin(time * 0.9 + streak.x * 11) * 15 * speed;
    ctx.globalAlpha = streak.alpha * speed * (1 - darkness * 0.5);
    ctx.strokeStyle = '#c6f4ff';
    ctx.lineWidth = streak.width;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.sin(streak.x * 17) * 7, y + streak.length * (0.5 + speed));
    ctx.stroke();
  }
  ctx.restore();

  const pressure = bell(14.1, 16.0, 18.8, time);
  if (pressure > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = pressure * 0.18;
    const ringRadius = lerp(cssWidth * 0.1, cssWidth * 0.8, smoothstep(14.1, 18.4, time));
    ctx.strokeStyle = '#8fe6ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cssWidth * 0.5, cssHeight * 0.48, ringRadius, ringRadius * 0.58, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const black = smoothstep(17.3, 21.5, time);
  ctx.fillStyle = `rgba(0,1,5,${black * 0.82})`;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // Tiny air fragments continue upward after almost everything else disappears.
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let index = 0; index < 15; index += 1) {
    const phase = index * 2.4;
    const y = cssHeight * (1 - ((local * (0.9 + (index % 4) * 0.08) + index * 0.09) % 1));
    const x = cssWidth * (0.18 + ((index * 0.217) % 0.64)) + Math.sin(time * 1.7 + phase) * 9;
    ctx.globalAlpha = (1 - black * 0.85) * 0.28;
    ctx.strokeStyle = '#d8f8ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 1.5 + (index % 4), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawClosingSurfaceLight(time) {
  const fall = smoothstep(11.0, 20.2, time);
  const x = cssWidth * lerp(0.69, 0.55, fall);
  const y = cssHeight * lerp(0.08, -0.1, fall);
  const radiusX = cssWidth * lerp(0.55, 0.05, easeInCubic(fall));
  const radiusY = cssHeight * lerp(0.19, 0.018, easeInCubic(fall));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(x, y, 0, x, y, Math.max(radiusX, radiusY) * 2.5);
  glow.addColorStop(0, `rgba(211,249,255,${0.72 * (1 - fall)})`);
  glow.addColorStop(0.28, `rgba(101,208,238,${0.24 * (1 - fall)})`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, cssWidth, cssHeight * 0.45);

  ctx.globalAlpha = 0.55 * (1 - fall);
  ctx.fillStyle = '#d8f9ff';
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, -0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawIceWalls(time) {
  const widen = easeOutCubic(smoothstep(10.3, 16.2, time));
  const fade = 1 - smoothstep(17.2, 21.2, time);
  if (fade <= 0) return;

  ctx.save();
  ctx.globalAlpha = fade;
  const leftInner = lerp(cssWidth * 0.41, -cssWidth * 0.08, widen);
  const rightInner = lerp(cssWidth * 0.62, cssWidth * 1.08, widen);

  const leftGradient = ctx.createLinearGradient(0, 0, leftInner, 0);
  leftGradient.addColorStop(0, '#061829');
  leftGradient.addColorStop(0.72, '#154c68');
  leftGradient.addColorStop(1, '#7fc8db');
  ctx.fillStyle = leftGradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(leftInner + 26, 0);
  ctx.lineTo(leftInner - 18, cssHeight * 0.22);
  ctx.lineTo(leftInner + 14, cssHeight * 0.44);
  ctx.lineTo(leftInner - 28, cssHeight * 0.67);
  ctx.lineTo(leftInner + 12, cssHeight);
  ctx.lineTo(0, cssHeight);
  ctx.closePath();
  ctx.fill();

  const rightGradient = ctx.createLinearGradient(cssWidth, 0, rightInner, 0);
  rightGradient.addColorStop(0, '#061829');
  rightGradient.addColorStop(0.72, '#154c68');
  rightGradient.addColorStop(1, '#7fc8db');
  ctx.fillStyle = rightGradient;
  ctx.beginPath();
  ctx.moveTo(cssWidth, 0);
  ctx.lineTo(rightInner - 20, 0);
  ctx.lineTo(rightInner + 22, cssHeight * 0.19);
  ctx.lineTo(rightInner - 12, cssHeight * 0.38);
  ctx.lineTo(rightInner + 30, cssHeight * 0.63);
  ctx.lineTo(rightInner - 10, cssHeight);
  ctx.lineTo(cssWidth, cssHeight);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDeep(time) {
  const whalePose = getWhalePose(time);
  const zoomProgress = easeInOutCubic(smoothstep(48.4, 53.8, time));
  const zoom = lerp(1, prefersReducedMotion ? 2.2 : 7.7, zoomProgress);
  const cameraX = lerp(cssWidth / 2, whalePose.eyeX, zoomProgress);
  const cameraY = lerp(cssHeight / 2, whalePose.eyeY, zoomProgress);

  ctx.save();
  ctx.translate(cssWidth / 2, cssHeight / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraX, -cameraY);

  drawDeepBackground(time);
  drawDeepLightMemory(time);
  drawMotes(time);
  drawBubbles(time);
  drawLightFish(time);
  drawGlowCreatures(time);
  drawWhale(time, whalePose);

  ctx.restore();
}

function drawDeepBackground(time) {
  const reveal = smoothstep(21.5, 31.5, time);
  const gradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
  gradient.addColorStop(0, `rgb(${Math.round(lerp(0, 3, reveal))} ${Math.round(lerp(2, 13, reveal))} ${Math.round(lerp(8, 27, reveal))})`);
  gradient.addColorStop(0.48, `rgb(${Math.round(lerp(0, 2, reveal))} ${Math.round(lerp(1, 7, reveal))} ${Math.round(lerp(5, 19, reveal))})`);
  gradient.addColorStop(1, '#000106');
  ctx.fillStyle = gradient;
  ctx.fillRect(-cssWidth, -cssHeight, cssWidth * 3, cssHeight * 3);

  const floorGlow = ctx.createRadialGradient(cssWidth * 0.45, cssHeight * 1.04, 0, cssWidth * 0.45, cssHeight * 1.04, cssWidth * 0.9);
  floorGlow.addColorStop(0, `rgba(17,70,92,${0.11 * reveal})`);
  floorGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = floorGlow;
  ctx.fillRect(0, cssHeight * 0.38, cssWidth, cssHeight * 0.7);
}

function drawDeepLightMemory(time) {
  const memory = (1 - smoothstep(23, 31, time)) * smoothstep(18, 22, time);
  if (memory <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = memory * 0.32;
  const x = cssWidth * 0.54;
  const gradient = ctx.createLinearGradient(x, -20, x, cssHeight * 0.75);
  gradient.addColorStop(0, 'rgba(200,247,255,0.7)');
  gradient.addColorStop(1, 'rgba(67,161,199,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(x - cssWidth * 0.06, -20);
  ctx.lineTo(x + cssWidth * 0.06, -20);
  ctx.lineTo(x + cssWidth * 0.28, cssHeight * 0.78);
  ctx.lineTo(x - cssWidth * 0.24, cssHeight * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMotes(time) {
  const appear = smoothstep(20.5, 27, time);
  if (appear <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const mote of motes) {
    const y = ((mote.y + time * mote.speed * 0.022) % 1) * cssHeight;
    const x = mote.x * cssWidth + Math.sin(time * 0.45 + mote.phase) * 10;
    ctx.globalAlpha = appear * (0.04 + mote.glow * 0.17);
    ctx.fillStyle = mote.glow > 0.72 ? '#77dfff' : '#bdeeff';
    ctx.beginPath();
    ctx.arc(x, y, mote.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBubbles(time) {
  const appear = smoothstep(20.8, 27.5, time) * (1 - smoothstep(49.2, 52.7, time));
  if (appear <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const bubble of bubbles) {
    const cycle = ((bubble.y - time * bubble.speed * 0.12) % 1 + 1) % 1;
    const y = cycle * cssHeight;
    const x = bubble.x * cssWidth + Math.sin(time * 0.7 + bubble.phase + cycle * 4) * bubble.drift;
    ctx.globalAlpha = appear * 0.2;
    ctx.strokeStyle = '#c9f6ff';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, bubble.size, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = appear * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - bubble.size * 0.28, y - bubble.size * 0.28, Math.max(0.55, bubble.size * 0.1), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawLightFish(time) {
  const palettes = [
    ['#77f7e3', '#24b4c8'],
    ['#8fdfff', '#4379ff'],
    ['#d0b6ff', '#7658d9'],
    ['#ffb8df', '#9a5bc3'],
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const item of fish) {
    const localAppear = smoothstep(22.0 + item.delay, 25.7 + item.delay, time) * (1 - smoothstep(48.5, 52.1, time));
    if (localAppear <= 0) continue;

    const travel = time * item.speed * item.direction;
    const x = (((item.x + travel) % 1) + 1) % 1 * cssWidth;
    const y = item.y * cssHeight + Math.sin(time * 0.75 + item.phase) * 14;
    const [core, body] = palettes[item.hue];
    const glowRadius = 26 * item.size;

    const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
    glow.addColorStop(0, `${hexToRgba(core, 0.18 * localAppear)}`);
    glow.addColorStop(0.35, `${hexToRgba(core, 0.06 * localAppear)}`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - glowRadius, y - glowRadius, glowRadius * 2, glowRadius * 2);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(item.direction * item.size, item.size);
    ctx.globalAlpha = localAppear * 0.76;
    ctx.shadowColor = core;
    ctx.shadowBlur = 12;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 4.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-15, -6);
    ctx.lineTo(-14, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(5, -0.8, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawGlowCreatures(time) {
  const appear = smoothstep(27.2, 34, time) * (1 - smoothstep(48.5, 52, time));
  if (appear <= 0) return;

  const palettes = [
    ['#8dfff0', '#4bc8ff'],
    ['#cab2ff', '#7f8cff'],
    ['#ffb5de', '#b882ff'],
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const creature of creatures) {
    const local = clamp(appear * 1.3 - creature.delay * 0.08);
    if (local <= 0) continue;
    const x = ((creature.x + time * creature.speed * 0.014) % 1) * cssWidth;
    const y = creature.y * cssHeight + Math.sin(time * 0.75 + creature.phase) * 18;
    const flap = 0.55 + Math.sin(time * 5.2 + creature.phase) * 0.28;
    const [core, wing] = palettes[creature.hue];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 0.32 + creature.phase) * 0.18);
    ctx.scale(creature.size, creature.size);
    ctx.globalAlpha = local * 0.66;
    ctx.shadowColor = core;
    ctx.shadowBlur = 18;

    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.ellipse(-8, -3, 11, 3.5 + flap * 4, -0.32, 0, Math.PI * 2);
    ctx.ellipse(8, -3, 11, 3.5 + flap * 4, 0.32, 0, Math.PI * 2);
    ctx.ellipse(-6, 5, 8, 2.5 + flap * 2.5, 0.26, 0, Math.PI * 2);
    ctx.ellipse(6, 5, 8, 2.5 + flap * 2.5, -0.26, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.6, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function getWhalePose(time) {
  const appear = easeInOutCubic(smoothstep(36.6, 44.4, time));
  const scale = Math.min(cssWidth / 420, cssHeight / 820) * 1.18;
  const x = lerp(cssWidth * 1.35, cssWidth * 0.48, appear);
  const y = cssHeight * 0.63 + Math.sin(time * 0.28) * 7;
  const eyeLocalX = 82;
  const eyeLocalY = -16;
  return {
    appear,
    x,
    y,
    scale,
    eyeX: x + eyeLocalX * scale,
    eyeY: y + eyeLocalY * scale,
  };
}

function drawWhale(time, pose) {
  if (pose.appear <= 0) return;
  const reveal = smoothstep(37, 46, time);

  ctx.save();
  ctx.translate(pose.x, pose.y);
  ctx.scale(pose.scale, pose.scale);
  ctx.globalAlpha = pose.appear;

  const halo = ctx.createRadialGradient(12, -6, 0, 12, -6, 180);
  halo.addColorStop(0, `rgba(37,122,162,${0.1 * reveal})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-220, -180, 440, 360);

  const bodyGradient = ctx.createLinearGradient(-150, -70, 130, 60);
  bodyGradient.addColorStop(0, '#17364e');
  bodyGradient.addColorStop(0.52, '#081826');
  bodyGradient.addColorStop(1, '#020711');
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, 134, 55, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#081827';
  ctx.beginPath();
  ctx.moveTo(-126, -4);
  ctx.quadraticCurveTo(-176, -39, -197, -18);
  ctx.quadraticCurveTo(-171, -1, -195, 23);
  ctx.quadraticCurveTo(-159, 34, -124, 13);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-13, 43);
  ctx.quadraticCurveTo(32, 84, 80, 61);
  ctx.quadraticCurveTo(45, 45, 4, 30);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(125,194,220,0.22)';
  ctx.lineWidth = 1.3;
  for (let index = 0; index < 6; index += 1) {
    ctx.beginPath();
    ctx.moveTo(41 + index * 5, 18 + index * 2.2);
    ctx.quadraticCurveTo(86, 30 + index * 4, 113, 12 + index * 2.4);
    ctx.stroke();
  }

  const eyeX = 82;
  const eyeY = -16;
  const eyeWake = smoothstep(42.5, 47.4, time);
  const eyePulse = 0.94 + Math.sin(time * 1.15) * 0.06;
  const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 32);
  eyeGlow.addColorStop(0, `rgba(224,253,255,${0.92 * eyeWake})`);
  eyeGlow.addColorStop(0.14, `rgba(95,223,255,${0.9 * eyeWake})`);
  eyeGlow.addColorStop(0.48, `rgba(38,111,255,${0.26 * eyeWake})`);
  eyeGlow.addColorStop(1, 'rgba(38,111,255,0)');
  ctx.fillStyle = eyeGlow;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 32, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#bff7ff';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 5.8 * eyePulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000107';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 2.9 * eyePulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawBuoyantWords(time) {
  const moment = FILM.words.find(({ start, end }) => time >= start && time <= end);
  if (!moment) return;

  const life = clamp((time - moment.start) / (moment.end - moment.start));
  const alpha = Math.sin(Math.PI * life);
  const rise = easeOutCubic(life);
  const sway = Math.sin(time * 0.9 + moment.start) * cssWidth * 0.025 + Math.sin(life * Math.PI * 2) * cssWidth * 0.015;
  const x = cssWidth * moment.x + sway;
  const y = lerp(cssHeight * 0.73, cssHeight * 0.37, rise);
  const fontSize = Math.min(39, Math.max(25, cssWidth * 0.082));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(Math.sin(time * 0.42 + moment.start) * 0.018);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.fillStyle = '#f4fbff';
  ctx.shadowColor = 'rgba(90,208,255,0.75)';
  ctx.shadowBlur = 22;
  drawWrappedText(moment.text, 0, 0, cssWidth * 0.82, fontSize * 1.14);

  // Tiny bubbles rise around the phrase so the words feel part of the water.
  ctx.shadowBlur = 9;
  ctx.strokeStyle = 'rgba(197,244,255,0.58)';
  ctx.lineWidth = 0.8;
  for (let index = 0; index < 8; index += 1) {
    const phase = index * 1.73 + moment.start;
    const bubbleLife = (life * (1.2 + (index % 3) * 0.15) + index * 0.11) % 1;
    const bx = Math.sin(phase + life * 5) * (34 + index * 4) + (index % 2 ? 1 : -1) * fontSize * 1.3;
    const by = 30 - bubbleLife * 90;
    const radius = 1.6 + (index % 4) * 1.2;
    ctx.globalAlpha = alpha * (1 - bubbleLife) * 0.7;
    ctx.beginPath();
    ctx.arc(bx, by, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEyeBlackout(time) {
  const start = 52.1;
  const end = 56.0;
  const progress = easeInOutCubic(smoothstep(start, end, time));
  if (progress <= 0) return;

  const radius = lerp(0, Math.hypot(cssWidth, cssHeight) * 0.72, progress);
  ctx.save();
  ctx.fillStyle = '#000006';
  ctx.beginPath();
  ctx.arc(cssWidth / 2, cssHeight / 2, radius, 0, Math.PI * 2);
  ctx.fill();

  const rim = bell(52.0, 53.8, 55.7, time);
  if (rim > 0) {
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = rim * 0.75;
    ctx.strokeStyle = 'rgba(89,222,255,0.85)';
    ctx.lineWidth = Math.max(1.5, cssWidth * 0.008) * (1 - progress * 0.7);
    ctx.shadowColor = '#55dfff';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(cssWidth / 2, cssHeight / 2, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Guarantee a clean, truly black beat before space appears.
  const fullBlack = bell(55.2, 56.4, 58.1, time);
  if (fullBlack > 0) {
    ctx.fillStyle = `rgba(0,0,5,${fullBlack})`;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
  }
}

function drawCosmos(time) {
  const skyReveal = smoothstep(56.8, 60.2, time);
  const gradient = ctx.createRadialGradient(cssWidth * 0.48, cssHeight * 0.48, 0, cssWidth * 0.48, cssHeight * 0.48, Math.max(cssWidth, cssHeight));
  gradient.addColorStop(0, '#070b1f');
  gradient.addColorStop(0.55, '#02040d');
  gradient.addColorStop(1, '#000105');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const star of stars) {
    const local = smoothstep(57.0 + star.delay, 58.4 + star.delay, time);
    if (local <= 0) continue;
    const driftX = Math.sin(time * 0.045 + star.phase) * 6 * star.depth;
    const driftY = (time - 57) * 0.35 * star.depth;
    const x = ((star.x * cssWidth + driftX) % cssWidth + cssWidth) % cssWidth;
    const y = ((star.y * cssHeight + driftY) % cssHeight + cssHeight) % cssHeight;
    const twinkle = 0.55 + Math.sin(time * (0.65 + star.depth * 0.25) + star.phase) * 0.3;
    ctx.globalAlpha = local * skyReveal * (0.3 + twinkle * 0.55);
    ctx.fillStyle = star.depth > 1.35 ? '#dbe9ff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, star.size * (0.7 + star.depth * 0.35), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  drawEarth(time);
}

function drawEarth(time) {
  const appear = easeInOutCubic(smoothstep(60.4, 67.3, time));
  if (appear <= 0) return;

  const targetRadius = Math.min(cssWidth * 0.285, cssHeight * 0.17);
  const radius = lerp(1.5, targetRadius, easeOutCubic(appear));
  const x = cssWidth * 0.53 + Math.sin(time * 0.16) * 3;
  const y = lerp(cssHeight * 0.72, cssHeight * 0.59, easeOutCubic(appear)) + Math.sin(time * 0.2) * 2;
  const rotation = (time - 60) * 0.035;

  ctx.save();
  ctx.translate(x, y);

  const atmosphere = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, radius * 0.7, 0, 0, radius * 1.32);
  atmosphere.addColorStop(0, 'rgba(99,194,255,0)');
  atmosphere.addColorStop(0.68, 'rgba(74,165,255,0.06)');
  atmosphere.addColorStop(0.86, 'rgba(91,204,255,0.28)');
  atmosphere.addColorStop(1, 'rgba(91,204,255,0)');
  ctx.fillStyle = atmosphere;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.34, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.clip();

  const ocean = ctx.createRadialGradient(-radius * 0.34, -radius * 0.38, radius * 0.05, 0, 0, radius * 1.25);
  ocean.addColorStop(0, '#62c9ff');
  ocean.addColorStop(0.35, '#1673c8');
  ocean.addColorStop(0.74, '#07366f');
  ocean.addColorStop(1, '#020d24');
  ctx.fillStyle = ocean;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

  ctx.save();
  ctx.rotate(rotation);
  ctx.fillStyle = '#5cae74';
  ctx.globalAlpha = 0.9;
  for (const land of continents) {
    const lx = Math.cos(land.angle) * land.distance * radius;
    const ly = Math.sin(land.angle) * land.distance * radius;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(land.rotation);
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * land.width, radius * land.height, 0, 0, Math.PI * 2);
    ctx.ellipse(radius * land.width * 0.45, -radius * land.height * 0.25, radius * land.width * 0.55, radius * land.height * 0.52, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  const cloudAlpha = 0.28;
  ctx.fillStyle = `rgba(236,250,255,${cloudAlpha})`;
  for (let index = 0; index < 9; index += 1) {
    const angle = index * 1.75 + rotation * 0.5;
    const cy = Math.sin(angle * 0.7) * radius * 0.65;
    const cx = Math.cos(angle) * radius * 0.46;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius * 0.19, radius * 0.025, angle * 0.14, 0, Math.PI * 2);
    ctx.fill();
  }

  const night = ctx.createLinearGradient(-radius, 0, radius, 0);
  night.addColorStop(0.42, 'rgba(0,2,12,0)');
  night.addColorStop(0.72, 'rgba(0,2,12,0.48)');
  night.addColorStop(1, 'rgba(0,1,8,0.94)');
  ctx.fillStyle = night;
  ctx.fillRect(-radius, -radius, radius * 2, radius * 2);

  ctx.restore();

  ctx.strokeStyle = 'rgba(128,220,255,0.74)';
  ctx.lineWidth = Math.max(1, radius * 0.018);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawPartialPath(points, progress, color, width) {
  const lengths = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const [x0, y0] = points[index - 1];
    const [x1, y1] = points[index];
    const length = Math.hypot(x1 - x0, y1 - y0);
    lengths.push(length);
    total += length;
  }
  let remaining = total * clamp(progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let index = 1; index < points.length && remaining > 0; index += 1) {
    const [x0, y0] = points[index - 1];
    const [x1, y1] = points[index];
    const segment = lengths[index - 1];
    if (remaining >= segment) {
      ctx.lineTo(x1, y1);
      remaining -= segment;
    } else {
      const amount = remaining / segment;
      ctx.lineTo(lerp(x0, x1, amount), lerp(y0, y1, amount));
      remaining = 0;
    }
  }
  ctx.stroke();
}

function drawPartialPolyline(points, progress, color, width) {
  drawPartialPath(points.map(([x, y]) => [x * cssWidth, y * cssHeight]), progress, color, width);
}

function drawWrappedText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => ctx.fillText(line, x, startY + index * lineHeight));
}

function drawVignette(time) {
  const strength = 0.34 + smoothstep(10, 24, time) * 0.3 - smoothstep(57, 64, time) * 0.18;
  const vignette = ctx.createRadialGradient(cssWidth / 2, cssHeight * 0.48, Math.min(cssWidth, cssHeight) * 0.16, cssWidth / 2, cssHeight * 0.48, Math.max(cssWidth, cssHeight) * 0.72);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, `rgba(0,0,5,${strength})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, cssWidth, cssHeight);
}

function drawLetterbox(time) {
  const amount = smoothstep(8.2, 11.2, time) * (1 - smoothstep(57.2, 61.5, time));
  if (amount <= 0) return;
  const height = Math.min(15, cssHeight * 0.017) * amount;
  ctx.fillStyle = `rgba(0,0,0,${0.55 * amount})`;
  ctx.fillRect(0, 0, cssWidth, height);
  ctx.fillRect(0, cssHeight - height, cssWidth, height);
}

function updateUi(time, now) {
  ui.progressBar.style.transform = `scaleX(${clamp(time / FILM.duration)})`;
  if (now - lastUiUpdate < 120) return;
  lastUiUpdate = now;
  const seconds = Math.floor(time % 60).toString().padStart(2, '0');
  const minutes = Math.floor(time / 60).toString().padStart(2, '0');
  ui.timeLabel.textContent = `${minutes}:${seconds}`;
  ui.sceneLabel.textContent = FILM.scenes.find(scene => time >= scene.start && time < scene.end)?.label ?? 'HOME';
}

function animate(now) {
  const deltaSeconds = Math.min((now - previousFrame) / 1000, 0.05);
  previousFrame = now;

  if (started && playing) {
    elapsed += deltaSeconds;
    if (elapsed >= FILM.duration) {
      elapsed = FILM.duration;
      playing = false;
      ui.pauseButton.textContent = 'Replay';
    }
  }

  drawFrame(elapsed);
  updateUi(elapsed, now);
  requestAnimationFrame(animate);
}

function startFilm() {
  started = true;
  playing = true;
  elapsed = 0;
  previousFrame = performance.now();
  ui.experience.classList.add('has-started');
  ui.startScreen.classList.add('is-hidden');
  ui.pauseButton.textContent = 'Pause';
}

function togglePause() {
  if (!started) return;
  if (elapsed >= FILM.duration) {
    elapsed = 0;
    playing = true;
    ui.pauseButton.textContent = 'Pause';
    return;
  }
  playing = !playing;
  previousFrame = performance.now();
  ui.pauseButton.textContent = playing ? 'Pause' : 'Continue';
}

function restartFilm() {
  started = true;
  playing = true;
  elapsed = 0;
  previousFrame = performance.now();
  ui.experience.classList.add('has-started');
  ui.startScreen.classList.add('is-hidden');
  ui.pauseButton.textContent = 'Pause';
}

ui.startButton.addEventListener('click', startFilm);
ui.pauseButton.addEventListener('click', togglePause);
ui.restartButton.addEventListener('click', restartFilm);

document.addEventListener('visibilitychange', () => {
  previousFrame = performance.now();
});

// Director preview: add ?time=30 to the URL to open on a specific second.
// Add &autoplay=1 when you want that preview to continue playing.
const preview = new URLSearchParams(location.search);
if (preview.has('time')) {
  elapsed = clamp(Number(preview.get('time')) || 0, 0, FILM.duration);
  started = true;
  playing = preview.get('autoplay') === '1';
  ui.experience.classList.add('has-started');
  ui.startScreen.classList.add('is-hidden');
  ui.pauseButton.textContent = playing ? 'Pause' : 'Continue';
}

requestAnimationFrame(animate);
