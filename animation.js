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
 * Change these values first when you want to retime the film.
 */
const FILM = {
  duration: 54,
  scenes: [
    { start: 0, end: 10, label: 'THE ICE' },
    { start: 10, end: 25, label: 'BENEATH' },
    { start: 25, end: 39, label: 'THE DEEP' },
    { start: 39, end: 46, label: 'THE EYE' },
    { start: 46, end: 54, label: 'FOREVER' },
  ],
  words: [
    { start: 12.5, end: 16.4, text: 'until the end' },
    { start: 16.9, end: 21.1, text: 'i love you, always' },
    { start: 21.4, end: 25.2, text: 'never let go' },
    { start: 26.2, end: 30.0, text: 'planting the seed' },
    { start: 31.0, end: 35.8, text: 'my forever...' },
    { start: 43.0, end: 47.1, text: 'my forever love' },
    { start: 48.0, end: 53.5, text: 'now traveling through the stars' },
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

const stars = makeStars(170, 3027);
const motes = makeMotes(85, 1988);
const bubbles = makeBubbles(34, 9127);
const creatures = makeCreatures(13, 4471);

function mulberry32(seed) {
  return function random() {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeStars(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: 0.35 + random() * 1.65,
    speed: 0.25 + random() * 1.4,
    phase: random() * Math.PI * 2,
    depth: 0.3 + random() * 1.7,
  }));
}

function makeMotes(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: 0.5 + random() * 2.6,
    speed: 0.02 + random() * 0.12,
    phase: random() * Math.PI * 2,
    glow: random(),
  }));
}

function makeBubbles(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: 2 + random() * 8,
    speed: 0.018 + random() * 0.055,
    drift: 8 + random() * 25,
    phase: random() * Math.PI * 2,
  }));
}

function makeCreatures(count, seed) {
  const random = mulberry32(seed);
  return Array.from({ length: count }, (_, index) => ({
    x: 0.08 + random() * 0.84,
    y: 0.28 + random() * 0.62,
    size: 0.7 + random() * 1.3,
    speed: 0.03 + random() * 0.08,
    phase: random() * Math.PI * 2,
    hue: index % 3,
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
  const x = clamp((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
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

function drawFrame(time) {
  const frameAlpha = ctx.globalAlpha;
  ctx.globalAlpha = 1;
  drawBase(time);

  const surfaceAlpha = 1 - smoothstep(8.2, 14.0, time);
  const underAlpha = smoothstep(7.4, 12.2, time) * (1 - smoothstep(40.5, 46.5, time));
  const cosmicAlpha = smoothstep(42.0, 47.2, time);

  if (surfaceAlpha > 0.001) drawSurface(time, surfaceAlpha);
  if (underAlpha > 0.001) drawUnderwater(time, underAlpha);
  if (cosmicAlpha > 0.001) drawCosmos(time, cosmicAlpha);

  drawWords(time);
  drawLetterbox(time);
  ctx.globalAlpha = frameAlpha;
}

function drawBase(time) {
  const deepening = smoothstep(8, 25, time);
  const top = mixColor([7, 24, 42], [1, 7, 17], deepening);
  const bottom = mixColor([1, 10, 22], [0, 2, 8], deepening);
  const gradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
  gradient.addColorStop(0, `rgb(${top.join(' ')})`);
  gradient.addColorStop(1, `rgb(${bottom.join(' ')})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cssWidth, cssHeight);
}

function mixColor(a, b, amount) {
  return a.map((value, index) => Math.round(lerp(value, b[index], amount)));
}

function drawSurface(time, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const descent = easeInOutCubic(smoothstep(7.5, 13.8, time));
  const cameraY = lerp(0, -cssHeight * 1.08, descent);
  ctx.translate(0, cameraY);

  drawArcticSky(time);
  drawSnow(time);
  drawIceShelf(time);
  drawPenguins(time);

  ctx.restore();
}

function drawArcticSky(time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
  gradient.addColorStop(0, '#08182b');
  gradient.addColorStop(0.64, '#16344b');
  gradient.addColorStop(1, '#8ec6d6');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const moonX = cssWidth * 0.72;
  const moonY = cssHeight * 0.17;
  const moonRadius = Math.min(cssWidth, cssHeight) * 0.055;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonRadius * 4.5);
  moonGlow.addColorStop(0, 'rgba(234,248,255,0.9)');
  moonGlow.addColorStop(0.18, 'rgba(190,232,255,0.22)');
  moonGlow.addColorStop(1, 'rgba(190,232,255,0)');
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius * 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(237,250,255,0.94)';
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let band = 0; band < 3; band += 1) {
    const y = cssHeight * (0.21 + band * 0.055);
    ctx.beginPath();
    ctx.moveTo(-cssWidth * 0.1, y);
    for (let x = -cssWidth * 0.1; x <= cssWidth * 1.1; x += cssWidth / 7) {
      const wave = Math.sin(x * 0.009 + time * 0.23 + band * 1.4) * (11 + band * 4);
      ctx.quadraticCurveTo(x + cssWidth / 14, y + wave, x + cssWidth / 7, y - wave * 0.55);
    }
    const aurora = ctx.createLinearGradient(0, y - 35, 0, y + 70);
    aurora.addColorStop(0, 'rgba(78,255,216,0)');
    aurora.addColorStop(0.48, `rgba(${band === 1 ? '122,167,255' : '82,245,205'},${0.12 - band * 0.02})`);
    aurora.addColorStop(1, 'rgba(71,227,201,0)');
    ctx.strokeStyle = aurora;
    ctx.lineWidth = 27 + band * 9;
    ctx.stroke();
  }
  ctx.restore();
}

function drawSnow(time) {
  ctx.save();
  ctx.fillStyle = 'rgba(239,250,255,0.65)';
  for (let index = 0; index < 70; index += 1) {
    const seed = index * 19.17;
    const x = ((seed * 27.3 + time * (4 + (index % 5))) % (cssWidth + 40)) - 20;
    const y = ((seed * 13.1 + time * (8 + (index % 7))) % (cssHeight * 0.72));
    const size = 0.7 + (index % 4) * 0.35;
    ctx.globalAlpha = 0.2 + (index % 5) * 0.1;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawIceShelf(time) {
  const horizon = cssHeight * 0.67;

  const iceGradient = ctx.createLinearGradient(0, horizon - 34, 0, cssHeight);
  iceGradient.addColorStop(0, '#ecfbff');
  iceGradient.addColorStop(0.26, '#a6dbe7');
  iceGradient.addColorStop(1, '#1a5b72');

  ctx.fillStyle = iceGradient;
  ctx.beginPath();
  ctx.moveTo(-20, horizon + 12);
  ctx.quadraticCurveTo(cssWidth * 0.18, horizon - 20, cssWidth * 0.36, horizon - 2);
  ctx.quadraticCurveTo(cssWidth * 0.61, horizon - 29, cssWidth * 0.82, horizon - 4);
  ctx.quadraticCurveTo(cssWidth * 0.94, horizon + 8, cssWidth + 20, horizon - 3);
  ctx.lineTo(cssWidth + 20, cssHeight + 20);
  ctx.lineTo(-20, cssHeight + 20);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(246,254,255,0.74)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizon + 2);
  for (let x = 0; x <= cssWidth; x += 24) {
    ctx.lineTo(x, horizon + Math.sin(x * 0.041 + time * 0.32) * 3);
  }
  ctx.stroke();

  const reflection = ctx.createLinearGradient(0, horizon, 0, cssHeight);
  reflection.addColorStop(0, 'rgba(236,251,255,0.2)');
  reflection.addColorStop(1, 'rgba(236,251,255,0)');
  ctx.fillStyle = reflection;
  ctx.fillRect(0, horizon, cssWidth, cssHeight - horizon);
}

function drawPenguins(time) {
  const centerX = cssWidth * 0.5;
  const groundY = cssHeight * 0.66;
  const entrance = easeInOutCubic(smoothstep(0.8, 4.2, time));
  const kiss = easeInOutCubic(smoothstep(4.8, 6.7, time));
  const hold = smoothstep(6.7, 7.4, time);
  const scale = Math.min(cssWidth / 390, cssHeight / 760) * 1.04;

  const leftX = lerp(-70, centerX - 42, entrance) + kiss * 12;
  const rightX = lerp(cssWidth + 70, centerX + 42, entrance) - kiss * 12;
  const leftLean = lerp(-0.04, 0.16, kiss);
  const rightLean = lerp(0.04, -0.16, kiss);
  const floatY = Math.sin(time * 1.4) * 1.2;

  drawPenguin(leftX, groundY + floatY, scale, 1, leftLean, '#f1a6bc');
  drawPenguin(rightX, groundY + floatY, scale, -1, rightLean, '#8fc5ff');

  if (kiss > 0.42) {
    const heartLife = clamp((time - 5.55) / 2.5);
    const heartAlpha = Math.sin(Math.PI * heartLife) * (0.7 + hold * 0.25);
    const heartY = groundY - 155 * scale - heartLife * 26;
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

function drawUnderwater(time, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;

  const eyeTransition = smoothstep(38.2, 44.8, time);
  const motionScale = prefersReducedMotion ? lerp(1, 1.35, eyeTransition) : lerp(1, 4.7, easeInOutCubic(eyeTransition));
  const focusX = cssWidth * 0.56;
  const focusY = cssHeight * 0.59;
  ctx.translate(focusX, focusY);
  ctx.scale(motionScale, motionScale);
  ctx.translate(-focusX, -focusY);

  drawWaterBackground(time);
  drawLightShafts(time);
  drawIceCeiling(time);
  drawMotes(time);
  drawCracks(time);
  drawBubbles(time);
  drawGlowCreatures(time);
  drawWhale(time);

  ctx.restore();
}

function drawWaterBackground(time) {
  const deep = smoothstep(15, 34, time);
  const gradient = ctx.createLinearGradient(0, 0, 0, cssHeight);
  gradient.addColorStop(0, `rgb(${Math.round(lerp(23, 5, deep))} ${Math.round(lerp(70, 19, deep))} ${Math.round(lerp(91, 39, deep))})`);
  gradient.addColorStop(0.45, `rgb(${Math.round(lerp(8, 2, deep))} ${Math.round(lerp(37, 8, deep))} ${Math.round(lerp(60, 23, deep))})`);
  gradient.addColorStop(1, '#01040c');
  ctx.fillStyle = gradient;
  ctx.fillRect(-cssWidth, -cssHeight, cssWidth * 3, cssHeight * 3);
}

function drawLightShafts(time) {
  const strength = 1 - smoothstep(25, 38, time);
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = 0.34 * strength;
  for (let index = 0; index < 5; index += 1) {
    const x = cssWidth * (0.08 + index * 0.21) + Math.sin(time * 0.22 + index) * 18;
    const width = cssWidth * (0.15 + index * 0.012);
    const gradient = ctx.createLinearGradient(x, 0, x, cssHeight * 0.82);
    gradient.addColorStop(0, 'rgba(185,245,255,0.55)');
    gradient.addColorStop(1, 'rgba(93,190,224,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(x - width * 0.2, 0);
    ctx.lineTo(x + width * 0.32, 0);
    ctx.lineTo(x + width, cssHeight * 0.9);
    ctx.lineTo(x - width * 0.7, cssHeight * 0.9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawIceCeiling(time) {
  const ceiling = cssHeight * 0.14;
  const gradient = ctx.createLinearGradient(0, 0, 0, ceiling * 1.5);
  gradient.addColorStop(0, 'rgba(208,248,255,0.96)');
  gradient.addColorStop(0.28, 'rgba(81,161,185,0.72)');
  gradient.addColorStop(1, 'rgba(17,63,80,0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(cssWidth, 0);
  ctx.lineTo(cssWidth, ceiling + 10);
  for (let x = cssWidth; x >= 0; x -= 36) {
    ctx.lineTo(x, ceiling + Math.sin(x * 0.043 + time * 0.14) * 10 + ((x / 36) % 3) * 4);
  }
  ctx.closePath();
  ctx.fill();
}

function drawCracks(time) {
  const reveal = smoothstep(11.2, 19.5, time);
  if (reveal <= 0) return;

  const branches = [
    [[0.49, 0.02], [0.46, 0.08], [0.52, 0.14], [0.47, 0.22], [0.51, 0.29]],
    [[0.47, 0.12], [0.38, 0.17], [0.31, 0.24]],
    [[0.50, 0.14], [0.60, 0.20], [0.67, 0.27]],
    [[0.48, 0.22], [0.41, 0.31], [0.43, 0.38]],
    [[0.52, 0.28], [0.59, 0.35], [0.63, 0.44]],
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.lineCap = 'round';
  branches.forEach((branch, index) => {
    const local = clamp(reveal * 1.25 - index * 0.12);
    if (local <= 0) return;
    drawPartialPolyline(branch, local, 'rgba(199,248,255,0.98)', 1.2 + index * 0.1);
    ctx.shadowColor = 'rgba(113,224,255,0.8)';
    ctx.shadowBlur = 16;
    drawPartialPolyline(branch, local, 'rgba(113,224,255,0.32)', 5);
    ctx.shadowBlur = 0;
  });
  ctx.restore();
}

function drawPartialPolyline(points, progress, color, width) {
  const pixelPoints = points.map(([x, y]) => [x * cssWidth, y * cssHeight]);
  const lengths = [];
  let total = 0;
  for (let index = 1; index < pixelPoints.length; index += 1) {
    const [x0, y0] = pixelPoints[index - 1];
    const [x1, y1] = pixelPoints[index];
    const length = Math.hypot(x1 - x0, y1 - y0);
    lengths.push(length);
    total += length;
  }
  let remaining = total * clamp(progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pixelPoints[0][0], pixelPoints[0][1]);
  for (let index = 1; index < pixelPoints.length && remaining > 0; index += 1) {
    const [x0, y0] = pixelPoints[index - 1];
    const [x1, y1] = pixelPoints[index];
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

function drawMotes(time) {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const mote of motes) {
    const y = ((mote.y + time * mote.speed * 0.02) % 1) * cssHeight;
    const x = mote.x * cssWidth + Math.sin(time * 0.45 + mote.phase) * 10;
    ctx.globalAlpha = 0.08 + mote.glow * 0.25;
    ctx.fillStyle = mote.glow > 0.7 ? '#77dfff' : '#bdeeff';
    ctx.beginPath();
    ctx.arc(x, y, mote.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBubbles(time) {
  const appear = smoothstep(18, 25, time);
  if (appear <= 0) return;
  ctx.save();
  ctx.lineWidth = 1;
  for (const bubble of bubbles) {
    const y = (1 - ((bubble.y + time * bubble.speed) % 1)) * cssHeight;
    const x = bubble.x * cssWidth + Math.sin(time * 0.7 + bubble.phase) * bubble.drift;
    ctx.globalAlpha = appear * 0.18;
    ctx.strokeStyle = '#d8f7ff';
    ctx.beginPath();
    ctx.arc(x, y, bubble.size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = appear * 0.28;
    ctx.beginPath();
    ctx.arc(x - bubble.size * 0.25, y - bubble.size * 0.25, Math.max(0.7, bubble.size * 0.12), 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  ctx.restore();
}

function drawGlowCreatures(time) {
  const appear = smoothstep(23, 30, time) * (1 - smoothstep(39, 43, time));
  if (appear <= 0) return;

  const palettes = [
    ['#8dfff0', '#4bc8ff'],
    ['#cab2ff', '#7f8cff'],
    ['#ffb5de', '#b882ff'],
  ];

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const creature of creatures) {
    const x = ((creature.x + time * creature.speed * 0.015) % 1) * cssWidth;
    const y = creature.y * cssHeight + Math.sin(time * 0.75 + creature.phase) * 18;
    const flap = 0.55 + Math.sin(time * 5.2 + creature.phase) * 0.28;
    const [core, wing] = palettes[creature.hue];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 0.32 + creature.phase) * 0.18);
    ctx.scale(creature.size, creature.size);
    ctx.globalAlpha = appear * 0.72;
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

function drawWhale(time) {
  const appear = smoothstep(29.5, 36.0, time);
  if (appear <= 0) return;

  const x = lerp(cssWidth * 1.2, cssWidth * 0.51, easeInOutCubic(appear));
  const y = cssHeight * 0.61 + Math.sin(time * 0.3) * 8;
  const scale = Math.min(cssWidth / 420, cssHeight / 820) * 1.12;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = appear;

  const bodyGradient = ctx.createLinearGradient(-150, -70, 130, 60);
  bodyGradient.addColorStop(0, '#132b42');
  bodyGradient.addColorStop(0.55, '#071523');
  bodyGradient.addColorStop(1, '#020915');
  ctx.fillStyle = bodyGradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, 132, 54, -0.08, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#091a2b';
  ctx.beginPath();
  ctx.moveTo(-124, -4);
  ctx.quadraticCurveTo(-172, -38, -193, -18);
  ctx.quadraticCurveTo(-169, -2, -192, 21);
  ctx.quadraticCurveTo(-158, 33, -122, 13);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-13, 42);
  ctx.quadraticCurveTo(32, 83, 78, 61);
  ctx.quadraticCurveTo(44, 45, 4, 30);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(110,175,207,0.22)';
  ctx.lineWidth = 1.4;
  for (let index = 0; index < 6; index += 1) {
    ctx.beginPath();
    ctx.moveTo(40 + index * 5, 19 + index * 2.2);
    ctx.quadraticCurveTo(84, 30 + index * 4, 111, 12 + index * 2.4);
    ctx.stroke();
  }

  const eyeX = 78;
  const eyeY = -14;
  const eyePulse = 0.86 + Math.sin(time * 1.2) * 0.1;
  const eyeGlow = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, 24);
  eyeGlow.addColorStop(0, 'rgba(218,250,255,0.95)');
  eyeGlow.addColorStop(0.12, 'rgba(99,218,255,0.98)');
  eyeGlow.addColorStop(0.52, 'rgba(58,116,255,0.32)');
  eyeGlow.addColorStop(1, 'rgba(58,116,255,0)');
  ctx.fillStyle = eyeGlow;
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#dffbff';
  ctx.beginPath();
  ctx.arc(eyeX, eyeY, 4.2 * eyePulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCosmos(time, alpha) {
  ctx.save();
  const portal = smoothstep(41.2, 46.6, time);
  const centerX = cssWidth * 0.56;
  const centerY = cssHeight * 0.59;
  const radius = lerp(4, Math.hypot(cssWidth, cssHeight) * 0.75, easeInOutCubic(portal));

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.clip();

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.max(cssWidth, cssHeight));
  gradient.addColorStop(0, '#17245f');
  gradient.addColorStop(0.38, '#080b2a');
  gradient.addColorStop(1, '#010207');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  const warp = smoothstep(43, 48.3, time) * (1 - smoothstep(49.2, 52.2, time));
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.globalCompositeOperation = 'screen';
  for (const star of stars) {
    const angle = star.x * Math.PI * 2 + star.phase;
    const baseRadius = Math.pow(star.y, 0.68) * Math.max(cssWidth, cssHeight) * 0.76;
    const travel = ((time * 15 * star.speed) % 85);
    const starRadius = baseRadius + travel * warp * star.depth;
    const x = Math.cos(angle) * starRadius;
    const y = Math.sin(angle) * starRadius;
    const streak = 2 + warp * 28 * star.depth;
    ctx.strokeStyle = `rgba(209,232,255,${0.28 + star.depth * 0.24})`;
    ctx.lineWidth = star.size;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(
      x - Math.cos(angle) * streak,
      y - Math.sin(angle) * streak,
    );
    ctx.stroke();
  }
  ctx.restore();

  const nebulaAlpha = smoothstep(47, 51, time);
  if (nebulaAlpha > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = nebulaAlpha * 0.24;
    const nebula = ctx.createRadialGradient(cssWidth * 0.28, cssHeight * 0.44, 0, cssWidth * 0.28, cssHeight * 0.44, cssWidth * 0.6);
    nebula.addColorStop(0, 'rgba(124,109,255,0.9)');
    nebula.addColorStop(0.45, 'rgba(255,116,194,0.25)');
    nebula.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    ctx.restore();
  }

  ctx.restore();
}

function drawWords(time) {
  const moment = FILM.words.find(({ start, end }) => time >= start && time <= end);
  if (!moment) return;

  const midpoint = (moment.start + moment.end) / 2;
  const alpha = bell(moment.start, midpoint, moment.end, time);
  const lift = lerp(13, -9, smoothstep(moment.start, moment.end, time));
  const maxWidth = cssWidth * 0.82;
  const fontSize = Math.min(42, Math.max(26, cssWidth * 0.088));

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cssWidth / 2, cssHeight * 0.47 + lift);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f5fbff';
  ctx.shadowColor = 'rgba(68,173,255,0.75)';
  ctx.shadowBlur = 26;
  ctx.font = `500 ${fontSize}px Georgia, "Times New Roman", serif`;
  drawWrappedText(moment.text, 0, 0, maxWidth, fontSize * 1.18);
  ctx.restore();
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

function drawLetterbox(time) {
  const amount = smoothstep(7.8, 11.0, time) * (1 - smoothstep(45, 49, time));
  if (amount <= 0) return;
  const height = Math.min(14, cssHeight * 0.016) * amount;
  ctx.fillStyle = `rgba(0,0,0,${0.44 * amount})`;
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
  ui.sceneLabel.textContent = FILM.scenes.find(scene => time >= scene.start && time < scene.end)?.label ?? 'FOREVER';
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
