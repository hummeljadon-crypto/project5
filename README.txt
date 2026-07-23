<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
  <meta name="theme-color" content="#020611" />
  <title>My Forever Love</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --safe-top: env(safe-area-inset-top, 0px);
      --safe-right: env(safe-area-inset-right, 0px);
      --safe-bottom: env(safe-area-inset-bottom, 0px);
      --safe-left: env(safe-area-inset-left, 0px);
    }

    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #020611; }
    body { position: fixed; inset: 0; touch-action: manipulation; overscroll-behavior: none; }
    button { font: inherit; }

    #stage, canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
    canvas { display: block; }

    .overlay {
      position: absolute;
      z-index: 10;
      inset: 0;
      display: grid;
      place-items: center;
      padding: calc(28px + var(--safe-top)) calc(22px + var(--safe-right)) calc(28px + var(--safe-bottom)) calc(22px + var(--safe-left));
      background:
        radial-gradient(circle at 50% 31%, rgb(57 125 167 / 30%), transparent 34%),
        linear-gradient(180deg, rgb(2 6 17 / 76%), rgb(2 6 17 / 97%));
      transition: opacity 650ms ease, visibility 650ms ease;
    }

    .overlay.hidden { opacity: 0; visibility: hidden; pointer-events: none; }

    .card {
      width: min(100%, 430px);
      padding: 30px 22px 24px;
      text-align: center;
      border: 1px solid rgb(219 248 255 / 18%);
      border-radius: 28px;
      background: rgb(5 15 31 / 69%);
      box-shadow: 0 30px 100px rgb(0 0 0 / 48%), inset 0 1px rgb(255 255 255 / 8%);
      backdrop-filter: blur(18px);
    }

    .eyebrow { margin: 0 0 12px; color: #8ed8e9; font-size: .72rem; font-weight: 800; letter-spacing: .19em; text-transform: uppercase; }
    h1 { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: clamp(2.55rem, 12vw, 4.8rem); font-weight: 500; line-height: .94; letter-spacing: -.055em; }
    .intro { max-width: 32ch; margin: 21px auto 25px; color: rgb(232 248 255 / 78%); font-size: .98rem; line-height: 1.55; }

    #start {
      width: 100%; min-height: 58px; border: 0; border-radius: 999px;
      color: #03101d; background: linear-gradient(135deg, #f5fdff, #9fe5f2);
      font-weight: 850; cursor: pointer; box-shadow: 0 14px 40px rgb(79 193 218 / 25%);
    }
    #start:active { transform: scale(.985); }
    .micro { margin: 14px 0 0; color: rgb(221 244 255 / 48%); font-size: .74rem; }

    .controls {
      position: absolute; z-index: 7;
      left: calc(14px + var(--safe-left)); right: calc(14px + var(--safe-right)); bottom: calc(13px + var(--safe-bottom));
      display: flex; justify-content: space-between; pointer-events: none;
    }
    .controls[hidden] { display: none; }
    .controls button {
      min-width: 78px; min-height: 43px; padding: 0 16px;
      border: 1px solid rgb(213 247 255 / 18%); border-radius: 999px;
      color: rgb(236 250 255 / 90%); background: rgb(2 9 20 / 48%);
      backdrop-filter: blur(12px); pointer-events: auto;
    }

    #status {
      position: absolute; z-index: 7; top: calc(13px + var(--safe-top)); left: 50%; transform: translateX(-50%);
      max-width: calc(100% - 28px); padding: 8px 13px; border: 1px solid rgb(255 255 255 / 12%);
      border-radius: 999px; background: rgb(2 9 20 / 57%); color: rgb(231 248 255 / 68%);
      font-size: .72rem; white-space: nowrap; backdrop-filter: blur(12px);
    }
    #status[hidden] { display: none; }

    #rotate {
      display: none; position: absolute; z-index: 30; inset: 0; place-items: center;
      padding: 32px; background: #020611; color: #e8faff; text-align: center;
    }
    @media (orientation: landscape) and (max-height: 620px) { #rotate { display: grid; } }
    @media (prefers-reduced-motion: reduce) { .overlay { transition-duration: 1ms; } }
  </style>
</head>
<body>
  <main id="stage" aria-label="An animated love story">
    <canvas id="canvas" aria-hidden="true"></canvas>

    <section class="overlay" id="intro-screen">
      <div class="card">
        <p class="eyebrow">A world made for you</p>
        <h1>My forever love</h1>
        <p class="intro">Put on headphones, turn the lights down, and step into my world.</p>
        <button id="start" type="button">Tap to begin</button>
        <p class="micro">Best viewed vertically. The experience can still run silently while you set up the song.</p>
      </div>
    </section>

    <div id="status" hidden>Silent preview · add audio/scene-1.mp3</div>

    <nav class="controls" id="controls" aria-label="Playback controls" hidden>
      <button id="restart" type="button">Restart</button>
      <button id="pause" type="button">Pause</button>
    </nav>

    <aside id="rotate">Turn your phone upright for the full experience.</aside>
  </main>

  <audio id="music" preload="auto" playsinline src="audio/scene-1.mp3"></audio>

  <script>
    'use strict';

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const introScreen = document.getElementById('intro-screen');
    const startButton = document.getElementById('start');
    const controls = document.getElementById('controls');
    const pauseButton = document.getElementById('pause');
    const restartButton = document.getElementById('restart');
    const statusBadge = document.getElementById('status');
    const music = document.getElementById('music');

    const STORY_DURATION = 78;
    const TEXT_CUES = [
      { at: 13.4, duration: 4.0, text: 'until the end' },
      { at: 18.2, duration: 4.3, text: 'i love you, always' },
      { at: 23.4, duration: 4.0, text: 'never let go' },
      { at: 28.5, duration: 4.6, text: 'planting the seed' },
      { at: 34.5, duration: 5.0, text: 'my forever…' },
      { at: 50.0, duration: 5.0, text: 'my forever love' },
      { at: 60.0, duration: 7.0, text: 'and now, traveling through the stars…' }
    ];

    const bubbles = Array.from({ length: 46 }, (_, i) => ({
      x: fract(Math.sin(i * 17.13) * 43758.5453),
      y: fract(Math.sin(i * 8.71 + 4) * 24634.6345),
      size: 2 + fract(Math.sin(i * 3.7) * 8912.3) * 7,
      speed: 0.025 + fract(Math.sin(i * 5.1) * 6623.2) * 0.06,
      phase: i * 0.71
    }));

    const stars = Array.from({ length: 130 }, (_, i) => ({
      x: fract(Math.sin(i * 19.31) * 35211.87),
      y: fract(Math.sin(i * 7.83 + 2) * 18329.44),
      size: 0.7 + fract(Math.sin(i * 2.33) * 7821.2) * 2.5,
      phase: i * 0.39
    }));

    const creatures = Array.from({ length: 11 }, (_, i) => ({
      x: 0.12 + fract(Math.sin(i * 15.7) * 1371.1) * 0.76,
      y: 0.38 + fract(Math.sin(i * 5.27 + 3) * 9123.2) * 0.43,
      scale: 0.55 + fract(Math.sin(i * 2.9) * 3121.2) * 0.9,
      phase: i * 0.93
    }));

    let width = 0;
    let height = 0;
    let dpr = 1;
    let running = false;
    let paused = false;
    let ended = false;
    let mode = 'idle';
    let silentStart = 0;
    let silentPausedAt = 0;
    let lastFrame = performance.now();

    resize();
    window.addEventListener('resize', resize, { passive: true });
    window.visualViewport?.addEventListener('resize', resize, { passive: true });

    startButton.addEventListener('click', async () => {
      startButton.disabled = true;
      startButton.textContent = 'Opening…';
      music.currentTime = 0;

      try {
        await music.play();
        mode = 'audio';
        statusBadge.hidden = true;
      } catch {
        startSilent();
      }

      running = true;
      paused = false;
      ended = false;
      introScreen.classList.add('hidden');
      controls.hidden = false;
      pauseButton.textContent = 'Pause';
      startButton.disabled = false;
      startButton.textContent = 'Tap to begin';
    });

    pauseButton.addEventListener('click', async () => {
      if (ended) {
        await restart();
        return;
      }
      if (paused) await resume();
      else pause();
    });

    restartButton.addEventListener('click', restart);

    music.addEventListener('ended', () => {
      ended = true;
      paused = true;
      pauseButton.textContent = 'Replay';
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && running && !paused) pause();
    });

    function startSilent() {
      mode = 'silent';
      silentStart = performance.now();
      silentPausedAt = 0;
      statusBadge.hidden = false;
    }

    function currentTime() {
      if (mode === 'audio') return music.currentTime;
      if (mode === 'silent') return paused ? silentPausedAt : (performance.now() - silentStart) / 1000;
      return 0;
    }

    function pause() {
      if (!running || paused) return;
      if (mode === 'audio') music.pause();
      else silentPausedAt = currentTime();
      paused = true;
      pauseButton.textContent = 'Resume';
    }

    async function resume() {
      if (!running || !paused || ended) return;
      if (mode === 'audio') {
        try {
          await music.play();
        } catch {
          silentPausedAt = music.currentTime;
          mode = 'silent';
          silentStart = performance.now() - silentPausedAt * 1000;
          statusBadge.hidden = false;
        }
      } else {
        silentStart = performance.now() - silentPausedAt * 1000;
      }
      paused = false;
      pauseButton.textContent = 'Pause';
    }

    async function restart() {
      ended = false;
      paused = false;
      music.pause();
      music.currentTime = 0;

      if (mode === 'audio') {
        try {
          await music.play();
        } catch {
          startSilent();
        }
      } else {
        startSilent();
      }

      running = true;
      pauseButton.textContent = 'Pause';
    }

    function resize() {
      width = window.visualViewport?.width || window.innerWidth;
      height = window.visualViewport?.height || window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function frame(now) {
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;
      const t = running ? Math.min(currentTime(), STORY_DURATION) : now / 1000;
      draw(t, dt);

      if (running && t >= STORY_DURATION && !ended) {
        ended = true;
        paused = true;
        music.pause();
        pauseButton.textContent = 'Replay';
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    function draw(t) {
      const surface = 1 - smoothstep(8.5, 13, t);
      const underwater = smoothstep(8.5, 15, t) * (1 - smoothstep(54, 60, t));
      const cosmic = smoothstep(54, 61, t);

      ctx.clearRect(0, 0, width, height);
      drawBaseGradient(t, cosmic);

      if (surface > 0.001) drawSurface(t, surface);
      if (underwater > 0.001) drawUnderwater(t, underwater);
      if (cosmic > 0.001) drawCosmic(t, cosmic);

      drawText(t);
      drawVignette();
    }

    function drawBaseGradient(t, cosmic) {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      if (cosmic > 0.4) {
        g.addColorStop(0, '#030414');
        g.addColorStop(0.55, '#071026');
        g.addColorStop(1, '#02030b');
      } else {
        const deep = smoothstep(11, 33, t);
        g.addColorStop(0, mixColor('#9dd8e8', '#031022', deep));
        g.addColorStop(0.35, mixColor('#387a9c', '#051329', deep));
        g.addColorStop(1, '#020611');
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    function drawSurface(t, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;

      const drift = easeInOut(clamp((t - 8.5) / 4.5)) * height * 0.62;
      ctx.translate(0, drift);

      const sky = ctx.createLinearGradient(0, 0, 0, height * 0.62);
      sky.addColorStop(0, '#071428');
      sky.addColorStop(1, '#4f96b5');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height * 0.65);

      ctx.globalAlpha *= 0.45;
      for (let i = 0; i < 40; i++) {
        const x = fract(Math.sin(i * 11.2) * 9912.3) * width;
        const y = fract(Math.sin(i * 4.8 + 2) * 5212.9) * height * 0.48;
        const a = 0.25 + Math.sin(t * 1.8 + i) * 0.18;
        ctx.fillStyle = `rgba(235,252,255,${Math.max(0.05, a)})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + (i % 3) * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;

      const iceY = height * 0.60;
      ctx.fillStyle = '#d9f4f8';
      ctx.beginPath();
      ctx.moveTo(0, iceY + height * 0.06);
      ctx.quadraticCurveTo(width * 0.23, iceY - height * 0.01, width * 0.45, iceY + height * 0.028);
      ctx.quadraticCurveTo(width * 0.70, iceY + height * 0.07, width, iceY + height * 0.015);
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fill();

      const entry = easeOutBack(clamp((t - 0.5) / 3.3));
      const kiss = smoothstep(3.4, 5.1, t);
      const centerX = width * 0.5;
      const baseY = iceY + height * 0.045;
      const separation = width * (0.19 - 0.095 * kiss);
      const penguinScale = Math.min(width / 390, height / 760) * 1.05;

      drawPenguin(centerX - separation, baseY, penguinScale, 1, entry, kiss);
      drawPenguin(centerX + separation, baseY, penguinScale, -1, entry, kiss);

      if (t > 4.3 && t < 7.5) {
        const heartLife = clamp((t - 4.3) / 3.2);
        const heartAlpha = Math.sin(heartLife * Math.PI);
        drawHeart(centerX, baseY - 122 * penguinScale - heartLife * 42, 12 + heartLife * 7, heartAlpha);
      }

      ctx.restore();
    }

    function drawPenguin(x, y, s, facing, entry, kiss) {
      ctx.save();
      const offscreen = facing === 1 ? -width * 0.24 : width * 0.24;
      ctx.translate(x + offscreen * (1 - entry), y);
      ctx.scale(facing * s, s);
      ctx.rotate(facing * (-0.03 - kiss * 0.08));

      ctx.fillStyle = '#101722';
      ellipse(0, -54, 45, 72);
      ctx.fillStyle = '#f0fbfc';
      ellipse(facing * 3, -48, 29, 52);
      ctx.fillStyle = '#101722';
      ellipse(0, -112, 36, 35);

      ctx.fillStyle = '#f0fbfc';
      ellipse(facing * 9, -111, 18, 21);
      ctx.fillStyle = '#17202c';
      ellipse(facing * 14, -118, 3.4, 4.2);

      ctx.fillStyle = '#f6b75b';
      ctx.beginPath();
      ctx.moveTo(facing * 30, -111);
      ctx.lineTo(facing * 52, -104);
      ctx.lineTo(facing * 31, -98);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#111923';
      ctx.save();
      ctx.rotate(facing * (-0.17 + kiss * 0.22));
      ellipse(-facing * 33, -61, 12, 42);
      ctx.restore();

      ctx.fillStyle = '#f6b75b';
      ellipse(-18, 10, 21, 7);
      ellipse(18, 10, 21, 7);
      ctx.restore();
    }

    function drawUnderwater(t, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;

      const drop = easeInOut(clamp((t - 8.8) / 10)) * height * 0.12;
      ctx.translate(0, -drop);

      drawIceCeiling(t);
      drawLightRays(t);
      drawCracks(t);
      drawBubbles(t);
      drawCreatures(t);
      drawWhale(t);
      drawPortal(t);

      ctx.restore();
    }

    function drawIceCeiling(t) {
      const y = height * 0.13;
      const g = ctx.createLinearGradient(0, 0, 0, y + height * 0.14);
      g.addColorStop(0, 'rgba(221,250,255,.96)');
      g.addColorStop(1, 'rgba(90,165,188,.15)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width, 0);
      ctx.lineTo(width, y + 24);
      for (let x = width; x >= 0; x -= width / 8) {
        const bump = Math.sin(x * 0.021 + t * 0.2) * 11;
        ctx.lineTo(x, y + bump);
      }
      ctx.closePath();
      ctx.fill();
    }

    function drawLightRays(t) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const glow = ctx.createLinearGradient(0, height * 0.08, 0, height * 0.83);
      glow.addColorStop(0, 'rgba(190,247,255,.26)');
      glow.addColorStop(1, 'rgba(67,155,186,0)');
      for (let i = 0; i < 4; i++) {
        const sway = Math.sin(t * 0.22 + i * 1.6) * width * 0.04;
        const x = width * (0.16 + i * 0.22) + sway;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.moveTo(x - width * 0.06, height * 0.08);
        ctx.lineTo(x + width * 0.05, height * 0.08);
        ctx.lineTo(x + width * 0.24, height * 0.88);
        ctx.lineTo(x - width * 0.18, height * 0.88);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    function drawCracks(t) {
      const reveal = smoothstep(12.8, 24.5, t);
      if (reveal <= 0) return;
      ctx.save();
      ctx.strokeStyle = `rgba(224,251,255,${0.25 + reveal * 0.55})`;
      ctx.lineWidth = Math.max(1.2, width * 0.004);
      ctx.shadowColor = 'rgba(166,238,255,.8)';
      ctx.shadowBlur = 12;
      const branches = [
        [[.48,.08],[.51,.14],[.46,.20],[.53,.27],[.50,.34]],
        [[.51,.14],[.61,.18],[.67,.25],[.73,.28]],
        [[.46,.20],[.35,.23],[.28,.30],[.22,.32]],
        [[.53,.27],[.61,.34],[.58,.41]],
        [[.35,.23],[.39,.31],[.35,.39]]
      ];
      branches.forEach((points, idx) => {
        const local = clamp(reveal * 1.4 - idx * 0.12);
        strokePartial(points, local);
      });
      ctx.restore();
    }

    function strokePartial(points, progress) {
      if (progress <= 0) return;
      ctx.beginPath();
      ctx.moveTo(points[0][0] * width, points[0][1] * height);
      const last = Math.max(1, Math.ceil((points.length - 1) * progress));
      for (let i = 1; i <= Math.min(last, points.length - 1); i++) {
        const prev = points[i - 1];
        const next = points[i];
        const segmentProgress = i === last ? fract((points.length - 1) * progress) || 1 : 1;
        ctx.lineTo(
          lerp(prev[0], next[0], segmentProgress) * width,
          lerp(prev[1], next[1], segmentProgress) * height
        );
      }
      ctx.stroke();
    }

    function drawBubbles(t) {
      ctx.save();
      ctx.strokeStyle = 'rgba(192,244,255,.34)';
      ctx.lineWidth = 1.2;
      bubbles.forEach((b) => {
        const y = fract(b.y - t * b.speed) * 1.15;
        const x = b.x + Math.sin(t * 0.8 + b.phase) * 0.025;
        ctx.globalAlpha = 0.22 + b.size / 22;
        ctx.beginPath();
        ctx.arc(x * width, y * height, b.size, 0, Math.PI * 2);
        ctx.stroke();
      });
      ctx.restore();
    }

    function drawCreatures(t) {
      const reveal = smoothstep(29.5, 36, t);
      if (reveal <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      creatures.forEach((c, i) => {
        const x = (c.x + Math.sin(t * 0.23 + c.phase) * 0.045) * width;
        const y = (c.y + Math.cos(t * 0.31 + c.phase) * 0.035) * height;
        const flap = Math.sin(t * 6 + c.phase) * 0.55;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t * 0.4 + c.phase) * 0.16);
        ctx.scale(c.scale, c.scale);
        ctx.globalAlpha = reveal * (0.55 + Math.sin(t * 1.7 + c.phase) * 0.18);
        ctx.shadowColor = i % 2 ? '#71e8ff' : '#9c8cff';
        ctx.shadowBlur = 18;
        ctx.fillStyle = i % 2 ? 'rgba(125,237,255,.86)' : 'rgba(184,153,255,.82)';
        ellipse(0, 0, 2.7, 13);
        ctx.save();
        ctx.rotate(flap * 0.45);
        ellipse(-10, -2, 12, 4.5);
        ctx.restore();
        ctx.save();
        ctx.rotate(-flap * 0.45);
        ellipse(10, -2, 12, 4.5);
        ctx.restore();
        ctx.restore();
      });
      ctx.restore();
    }

    function drawWhale(t) {
      const reveal = smoothstep(40.5, 47.5, t);
      const zoom = smoothstep(50.5, 56.5, t);
      if (reveal <= 0) return;

      const x = lerp(width * 1.16, width * 0.58, easeOutCubic(reveal));
      const y = lerp(height * 0.75, height * 0.63, reveal);
      const baseScale = Math.min(width / 390, height / 760);
      const scale = baseScale * (0.8 + reveal * 0.38 + zoom * 4.8);

      ctx.save();
      ctx.translate(lerp(x, width * 0.47, zoom), lerp(y, height * 0.53, zoom));
      ctx.scale(scale, scale);
      ctx.rotate(-0.08 + Math.sin(t * 0.2) * 0.025);
      ctx.globalAlpha = reveal;

      ctx.shadowColor = 'rgba(84,178,215,.35)';
      ctx.shadowBlur = 28;
      ctx.fillStyle = '#071827';
      ctx.beginPath();
      ctx.moveTo(-125, -6);
      ctx.bezierCurveTo(-80, -56, 54, -62, 118, -21);
      ctx.bezierCurveTo(150, 0, 132, 38, 68, 46);
      ctx.bezierCurveTo(-13, 56, -91, 42, -125, 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0c2638';
      ctx.beginPath();
      ctx.moveTo(-112, -4);
      ctx.lineTo(-166, -43);
      ctx.lineTo(-154, 0);
      ctx.lineTo(-169, 39);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#0a2233';
      ctx.beginPath();
      ctx.moveTo(21, 28);
      ctx.quadraticCurveTo(-18, 72, -68, 61);
      ctx.quadraticCurveTo(-24, 43, 11, 13);
      ctx.closePath();
      ctx.fill();

      const eyeX = 78;
      const eyeY = -13;
      ctx.shadowColor = '#90eeff';
      ctx.shadowBlur = 18 + zoom * 28;
      ctx.fillStyle = '#bff8ff';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 4 + zoom * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawPortal(t) {
      const p = smoothstep(52.3, 59.5, t);
      if (p <= 0) return;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const radius = lerp(0, Math.max(width, height) * 1.15, easeInOut(p));
      const g = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, radius);
      g.addColorStop(0, `rgba(207,251,255,${0.9 * (1 - p * 0.45)})`);
      g.addColorStop(0.08, `rgba(98,192,230,${0.58 * (1 - p * 0.2)})`);
      g.addColorStop(0.33, `rgba(49,66,151,${0.36 * p})`);
      g.addColorStop(1, 'rgba(3,4,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    function drawCosmic(t, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;

      const nebula = ctx.createRadialGradient(width * 0.33, height * 0.38, 0, width * 0.33, height * 0.38, Math.max(width, height) * 0.65);
      nebula.addColorStop(0, 'rgba(81,78,170,.23)');
      nebula.addColorStop(0.42, 'rgba(24,106,153,.14)');
      nebula.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, width, height);

      const travel = Math.max(0, t - 58);
      stars.forEach((s) => {
        const dx = s.x - 0.5;
        const dy = s.y - 0.5;
        const expansion = 1 + travel * 0.025;
        const x = (0.5 + dx * expansion) * width;
        const y = (0.5 + dy * expansion) * height;
        const twinkle = 0.42 + Math.sin(t * 2.2 + s.phase) * 0.28;
        ctx.fillStyle = `rgba(226,247,255,${Math.max(0.08, twinkle)})`;
        ctx.beginPath();
        ctx.arc(x, y, s.size * (1 + travel * 0.008), 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.save();
      ctx.translate(width * 0.5, height * 0.46);
      ctx.rotate(t * 0.025);
      ctx.strokeStyle = 'rgba(125,210,255,.11)';
      ctx.lineWidth = 1.1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, width * (0.18 + i * 0.09), height * (0.055 + i * 0.025), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }

    function drawText(t) {
      const cue = TEXT_CUES.find((item) => t >= item.at && t <= item.at + item.duration);
      if (!cue) return;

      const p = (t - cue.at) / cue.duration;
      const fade = smoothstep(0, 0.19, p) * (1 - smoothstep(0.77, 1, p));
      const y = height * (0.49 - (1 - fade) * 0.025);
      const maxFont = Math.min(width * 0.097, 47);

      ctx.save();
      ctx.globalAlpha = fade;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `500 ${maxFont}px Georgia, "Times New Roman", serif`;
      ctx.fillStyle = '#effcff';
      ctx.shadowColor = 'rgba(109,213,244,.7)';
      ctx.shadowBlur = 20;
      wrapText(cue.text, width * 0.5, y, width * 0.82, maxFont * 1.18);
      ctx.restore();
    }

    function drawVignette() {
      const g = ctx.createRadialGradient(width * 0.5, height * 0.46, Math.min(width, height) * 0.18, width * 0.5, height * 0.5, Math.max(width, height) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.68, 'rgba(0,0,0,.08)');
      g.addColorStop(1, 'rgba(0,0,0,.63)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, width, height);
    }

    function drawHeart(x, y, size, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size / 18, size / 18);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#dffaff';
      ctx.shadowColor = '#8beaff';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, 14);
      ctx.bezierCurveTo(-22, 2, -18, -15, -7, -15);
      ctx.bezierCurveTo(-1, -15, 0, -9, 0, -7);
      ctx.bezierCurveTo(0, -9, 1, -15, 7, -15);
      ctx.bezierCurveTo(18, -15, 22, 2, 0, 14);
      ctx.fill();
      ctx.restore();
    }

    function ellipse(x, y, rx, ry) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    function wrapText(text, x, y, maxWidth, lineHeight) {
      const words = text.split(' ');
      const lines = [];
      let line = '';
      words.forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = test;
      });
      lines.push(line);
      const startY = y - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((item, i) => ctx.fillText(item, x, startY + i * lineHeight));
    }

    function fract(n) { return n - Math.floor(n); }
    function clamp(n) { return Math.max(0, Math.min(1, n)); }
    function lerp(a, b, t) { return a + (b - a) * t; }
    function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }
    function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
    function easeOutBack(t) { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }

    function mixColor(a, b, t) {
      const pa = a.match(/\w\w/g).map((x) => parseInt(x, 16));
      const pb = b.match(/\w\w/g).map((x) => parseInt(x, 16));
      return `rgb(${Math.round(lerp(pa[0], pb[0], t))} ${Math.round(lerp(pa[1], pb[1], t))} ${Math.round(lerp(pa[2], pb[2], t))})`;
    }
  </script>
</body>
</html>
