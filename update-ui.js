(async function () {
  const api = window.__TAURI__;
  if (!api) return;
  const { invoke, Channel } = api.core;
  if (await invoke('desktop_smoke_ready', { ready: typeof window.openSettings === 'function' && !!document.querySelector('canvas') })) return;
  const config = await invoke('desktop_update_info');
  if (!config.enabled) return;

  const menu = document.getElementById('menu-overlay');
  const settings = document.querySelector('#settings-overlay .settings-section')?.parentElement;
  if (!menu || !settings) return;
  const banner = document.createElement('aside');
  banner.className = 'lb-card lb-update-banner';
  banner.hidden = true;
  banner.innerHTML = `<span data-available></span>
    <button class="lb-btn lb-btn--primary" data-open>UPDATE</button>
    <button class="lb-btn lb-btn--ghost lb-btn--icon" data-dismiss aria-label="Dismiss update">✕</button>`;
  menu.append(banner);

  const section = document.createElement('section');
  section.className = 'lb-card lb-update-settings';
  section.innerHTML = `<h2>Desktop updates</h2><p data-version></p>
    <label class="lb-toggle"><input type="checkbox" data-auto> CHECK FOR UPDATES</label>
    <div class="lb-actions">
      <button class="lb-btn" data-check>CHECK NOW</button>
      <button class="lb-btn lb-btn--primary" data-get hidden>GET UPDATE</button>
      <button class="lb-btn lb-btn--ghost" data-github>GITHUB</button>
    </div><p data-result role="status"></p>`;
  settings.append(section);

  const dialog = document.createElement('dialog');
  dialog.className = 'lb-modal lb-update-dialog';
  dialog.setAttribute('aria-label', 'Linebreaker update');
  dialog.innerHTML = `<h2>Linebreaker update</h2><p data-summary></p>
    <progress class="lb-progress" aria-label="Update download progress" hidden></progress>
    <p data-status role="status"></p><div class="lb-actions">
      <button class="lb-btn lb-btn--primary" data-install>INSTALL UPDATE</button>
      <button class="lb-btn lb-btn--ghost" data-github>GITHUB</button>
      <button class="lb-btn lb-btn--ghost" data-close>CLOSE</button>
    </div>`;
  document.body.append(dialog);

  const auto = section.querySelector('[data-auto]');
  const checkButton = section.querySelector('[data-check]');
  const getButton = section.querySelector('[data-get]');
  const result = section.querySelector('[data-result]');
  const progress = dialog.querySelector('progress');
  const install = dialog.querySelector('[data-install]');
  const close = dialog.querySelector('[data-close]');
  const summary = dialog.querySelector('[data-summary]');
  const status = dialog.querySelector('[data-status]');
  const dismiss = banner.querySelector('[data-dismiss]');
  const interval = 5 * 60 * 1000;
  const size = value => value >= 1048576 ? `${(value / 1048576).toFixed(1)} MB` : `${Math.ceil(value / 1024)} KB`;
  let dismissed = false, checking, lastCheck = -Infinity, outcome = '', update, shownVersion, installing = false;
  auto.checked = localStorage.getItem('desktop-auto-update') !== 'off';
  auto.onchange = () => {
    localStorage.setItem('desktop-auto-update', auto.checked ? 'on' : 'off');
    if (auto.checked) void check();
  };
  section.querySelector('[data-version]').textContent = `Current version: ${config.version}`;
  dismiss.onclick = () => { dismissed = true; banner.hidden = true; };
  dialog.addEventListener('cancel', event => { if (installing) event.preventDefault(); });
  dialog.addEventListener('keydown', event => event.stopPropagation());
  close.onclick = () => dialog.close();
  for (const button of [section, dialog].map(node => node.querySelector('[data-github]'))) {
    button.onclick = () => invoke('plugin:opener|open_url', { url: config.releases }).catch(() => {
      (dialog.open ? status : result).textContent = 'Could not open GitHub in your browser.';
    });
  }
  async function openUpdate() {
    if (checking) await checking;
    if (!update || dialog.open) return;
    if (shownVersion !== update.version) {
      shownVersion = update.version;
      install.textContent = 'INSTALL UPDATE';
      status.textContent = '';
      progress.hidden = true;
    }
    summary.textContent = `Update ${update.version} · ${update.size ? size(update.size) : 'size unavailable'}`;
    dialog.showModal();
  }
  banner.querySelector('[data-open]').onclick = openUpdate;
  getButton.onclick = openUpdate;

  async function check(manual = false) {
    if ((!manual && !auto.checked) || installing || dialog.open) return;
    if (manual && (checking || performance.now() - lastCheck >= interval)) result.textContent = 'Checking for updates…';
    if (!checking && performance.now() - lastCheck >= interval) {
      lastCheck = performance.now();
      checking = (async () => {
        try {
          update = await invoke('check_desktop_update');
          outcome = update ? `Update ${update.version} is available.` : 'Linebreaker is up to date.';
          getButton.hidden = !update;
          banner.hidden = !update || dismissed;
          if (update) banner.querySelector('[data-available]').textContent = `Update ${update.version}`;
        } catch {
          outcome = 'Could not check for updates. Check your internet connection or try GitHub.';
        }
      })().finally(() => { checking = null; });
    }
    if (checking) await checking;
    if (manual) result.textContent = outcome;
  }

  install.onclick = async () => {
    if (installing || !update) return;
    installing = true;
    install.disabled = close.disabled = true;
    progress.hidden = false;
    progress.removeAttribute('value');
    status.textContent = 'Starting download…';
    const started = performance.now();
    const channel = new Channel();
    channel.onmessage = ({ done, total }) => {
      total ||= update.size;
      if (total) { progress.max = total; progress.value = done; }
      const speed = done / Math.max((performance.now() - started) / 1000, 0.1);
      status.textContent = `${size(done)} / ${total ? size(total) : '?'} · ${size(speed)}/s`;
    };
    try {
      await invoke('download_desktop_update', { version: update.version, onProgress: channel });
      status.textContent = 'Starting setup…';
      await window.flushLinebreakerSave?.();
      await invoke('install_desktop_update', { version: update.version });
      return;
    } catch {
      status.textContent = 'Update failed. Check your connection and try again, or get the installer on GitHub.';
      install.textContent = 'TRY AGAIN';
      progress.hidden = true;
      install.disabled = close.disabled = installing = false;
    }
  };
  checkButton.onclick = () => check(true);
  window.addEventListener('focus', () => check());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  await check();
})().catch(error => console.error('Desktop updates unavailable', error));
