// Desktop-only shell; the browser game needs no Tauri dependencies.
(async () => {
  const api = window.__TAURI__;
  if (!api) return;
  const invoke = api.core.invoke;
  document.addEventListener('keydown', async event => {
    if (event.key !== 'F11') return;
    event.preventDefault();
    if (event.repeat) return;
    try {
      const win = api.window.getCurrentWindow();
      await win.setFullscreen(!await win.isFullscreen());
    } catch (error) { console.error('Fullscreen failed', error); }
  }, true);

  const releases = 'https://github.com/Husarp/linebreaker/releases'; // PLACEHOLDER repository
  const panel = document.createElement('aside');
  panel.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:10000;background:#050510;color:#0ff;border:1px solid #0ff;padding:16px;max-width:360px;font:14px sans-serif';
  panel.hidden = true;
  panel.innerHTML = '<button data-close style="float:right">✕</button><strong>Linebreaker updates</strong><p data-status></p><progress max="100" value="0" hidden></progress><p><button data-check>CHECK NOW</button> <button data-install hidden>INSTALL UPDATE</button> <button data-github>GITHUB</button></p><label><input type="checkbox" data-auto> Check on start and return</label>';
  document.body.append(panel);
  const status = panel.querySelector('[data-status]');
  const install = panel.querySelector('[data-install]');
  const checkButton = panel.querySelector('[data-check]');
  const progress = panel.querySelector('progress');
  const auto = panel.querySelector('[data-auto]');
  auto.checked = localStorage.getItem('desktop-auto-update') !== 'off';
  auto.onchange = () => localStorage.setItem('desktop-auto-update', auto.checked ? 'on' : 'off');
  let dismissed = false, lastCheck = 0, busy = false, update;
  panel.querySelector('[data-close]').onclick = () => { dismissed = true; panel.hidden = true; };
  panel.querySelector('[data-github]').onclick = () => invoke('plugin:opener|open_url', { url: releases }).catch(console.error);
  const bytes = n => `${(n / 1048576).toFixed(1)} MB`;
  async function check(manual = false) {
    if (busy || (!manual && (!auto.checked || Date.now() - lastCheck < 300000))) return;
    busy = true; lastCheck = Date.now();
    if (manual) { dismissed = false; panel.hidden = false; }
    status.textContent = 'Checking for updates…';
    try {
      if (update) await new api.core.Resource(update.rid).close();
      update = await invoke('plugin:updater|check', { timeout: 10000 });
      install.hidden = !update;
      checkButton.textContent = 'CHECK NOW';
      status.textContent = update ? `Update ${update.version} available` : 'You are up to date.';
      if (update) {
        if (!dismissed) panel.hidden = false;
        // GitHub asset metadata provides size before download; failure must not block updates.
        try {
          const response = await fetch('https://api.github.com/repos/Husarp/linebreaker/releases/latest');
          if (response.ok) {
            const release = await response.json();
            const asset = release.assets?.find(a => a.name.endsWith('.exe') && a.name.includes('x64'));
            if (asset) status.textContent += ` · ${bytes(asset.size)}`;
          }
        } catch { /* Progress events still supply total size during download. */ }
      }
    } catch (error) {
      status.textContent = `Update check failed: ${error}`;
      checkButton.textContent = 'TRY AGAIN';
    } finally { busy = false; }
  }
  checkButton.onclick = () => check(true);
  install.onclick = async () => {
    if (busy || !update) return;
    busy = true; install.disabled = true; progress.hidden = false;
    let total = 0, done = 0;
    const start = performance.now();
    const channel = new api.core.Channel();
    channel.onmessage = event => {
      if (event.event === 'Started') total = event.data.contentLength || 0;
      if (event.event === 'Progress') done += event.data.chunkLength;
      progress.value = total ? done / total * 100 : 0;
      status.textContent = `${bytes(done)} / ${total ? bytes(total) : '?'} · ${bytes(done / Math.max((performance.now() - start) / 1000, 0.1))}/s`;
      if (event.event === 'Finished') status.textContent = 'Installing update…';
    };
    try {
      await invoke('plugin:updater|download_and_install', { rid: update.rid, onEvent: channel, restartAfterInstall: true });
      status.textContent = 'Update installed. Restart Linebreaker.';
    } catch (error) {
      status.textContent = `Update failed: ${error}`;
      install.textContent = 'TRY AGAIN';
    } finally { busy = false; install.disabled = false; }
  };
  // Keep update preferences and manual checks in the game's settings.
  const settings = document.getElementById('settings-overlay');
  const button = document.createElement('button');
  button.textContent = 'DESKTOP UPDATES';
  button.onclick = () => { dismissed = false; panel.hidden = false; };
  (settings || document.body).append(button);
  window.addEventListener('focus', () => check());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  await check();
})();
