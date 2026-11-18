(function () {
  const api = window.__TAURI__;
  if (!api) return;

  document.addEventListener('keydown', async event => {
    if (event.key !== 'F11') return;
    event.preventDefault();
    if (event.repeat) return;
    try {
      const win = api.window.getCurrentWindow();
      await win.setFullscreen(!await win.isFullscreen());
    } catch (error) { console.error('Fullscreen failed', error); }
  }, true);
})();
