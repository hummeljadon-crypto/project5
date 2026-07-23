<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
    <meta name="theme-color" content="#020611" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="description" content="A mobile-first animated love story." />
    <link rel="icon" href="%BASE_URL%icons/heart.svg" type="image/svg+xml" />
    <title>My Forever World</title>
  </head>
  <body>
    <main id="app" aria-label="Animated love story">
      <div id="canvas-shell" aria-hidden="true"></div>

      <section id="start-screen" class="overlay">
        <div class="start-card">
          <p class="eyebrow">A little world made for you</p>
          <h1>My forever love</h1>
          <p class="intro">Put on your headphones. Hold your phone upright. Let the rest disappear.</p>
          <button id="start-button" type="button">
            <span>Enter my world</span>
            <span aria-hidden="true">♥</span>
          </button>
          <p id="audio-note" class="microcopy">Music starts only after you tap.</p>
        </div>
      </section>

      <div id="controls" class="controls" hidden>
        <button id="pause-button" type="button" aria-label="Pause animation">Pause</button>
        <button id="restart-button" type="button" aria-label="Restart animation">Restart</button>
      </div>

      <div id="demo-badge" class="demo-badge" hidden>Silent preview — add your audio file</div>
      <div id="rotate-notice" class="rotate-notice">Turn your phone upright for the full scene.</div>
      <div id="loading" class="loading" aria-live="polite">Building the world…</div>
    </main>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
