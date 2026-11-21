(async function () {
  const api = window.__TAURI__;
  if (!api) return;
  const { invoke, Channel } = api.core;
  if (await invoke('desktop_smoke_ready', { ready: typeof window.openSettings === 'function' && !!document.querySelector('canvas') })) return;
  const config = await invoke('desktop_update_info');
  if (!config.enabled) return;
  const { startupUpgrade, attachVersion, dialog: makeDialog, size, showNotes, copy, newer } = window.LBUpdateTools;

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
  section.className = 'settings-section lb-block-panel lb149-settings';
  section.innerHTML = `<h2 class="lb-block-section-title">Desktop updates</h2><p data-update-version></p>
    <label class="lb149-choice">Automatic update checks <span class="lb-block-switch"><input type="checkbox" role="switch" data-auto><span class="toggle-slider"></span></span></label>
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
  const notesButton = document.createElement('button');
  notesButton.className = 'lb-block-btn';
  notesButton.hidden = true;
  const notesBanner = document.createElement('aside');
  notesBanner.className = 'lb-block-panel lb149-banner';
  notesBanner.hidden = true;
  notesBanner.append(notesButton);
  menu.append(notesBanner);
  const diagnostics = makeDialog('Update diagnostics', `<dl><dt>Shell</dt><dd data-shell></dd><dt>Web</dt><dd>Bundled with this installer</dd></dl>
    <p data-state role="status"></p><label class="lb149-choice">Automatic update checks <span class="lb-block-switch"><input type="checkbox" role="switch" data-auto><span class="toggle-slider"></span></span></label>
    <div class="lb149-actions"><button class="lb-block-btn" data-check>Check now</button><button class="lb-block-btn" data-restart>Restart</button></div>
    <label for="lb149-desktop-log">Update log</label><textarea id="lb149-desktop-log" readonly></textarea>
    <div class="lb149-actions"><button class="lb-block-btn" data-copy>Copy</button><button class="lb-block-btn" data-clear>Clear</button><button class="lb-block-btn" data-close>Close</button></div>
    <p data-feedback role="status"></p>`);
  diagnostics.querySelector('[data-shell]').textContent = config.version;
  const logKey = 'lb149:desktop-log';
  const logField = diagnostics.querySelector('textarea');
  const debugAuto = diagnostics.querySelector('[data-auto]');
  const debugState = diagnostics.querySelector('[data-state]');
  const debugFeedback = diagnostics.querySelector('[data-feedback]');
  const notesKey = 'lb149:desktop-pending-notes';
  let whatsNew = startupUpgrade(localStorage, 'lb149:desktop', config.version);
  const notesVersion = localStorage.getItem(`${notesKey}:version`);
  const notes = notesVersion === config.version ? localStorage.getItem(notesKey) : null;
  if (notesVersion === config.version || newer(config.version, notesVersion)) {
    localStorage.removeItem(`${notesKey}:version`);
    localStorage.removeItem(notesKey);
  }
  notesButton.textContent = `What's new in ${config.version} ›`;
  notesButton.onclick = () => showNotes(config.version, notes, () => section.querySelector('[data-github]').click());
  const showWhatsNew = () => { notesBanner.hidden = notesButton.hidden = !whatsNew; };
  function log(text) {
    const rows = `${new Date().toISOString()} · ${text}\n${localStorage.getItem(logKey) || ''}`.split('\n').slice(0, 120).join('\n');
    localStorage.setItem(logKey, rows);
    if (document.activeElement !== logField) logField.value = rows;
  }
  attachVersion(config.version, () => { logField.value = localStorage.getItem(logKey) || ''; diagnostics.showModal(); });
  diagnostics.querySelector('[data-check]').onclick = () => check(true);
  diagnostics.querySelector('[data-restart]').onclick = async () => {
    await window.flushLinebreakerSave?.();
    if (window.linebreakerCanInterrupt?.() !== true || installing) { debugFeedback.textContent = 'Finish the current activity before restarting.'; return; }
    await invoke('restart_desktop').catch(() => { debugFeedback.textContent = 'Restart failed.'; });
  };
  diagnostics.querySelector('[data-copy]').onclick = async () => {
    try { await copy(logField.value, logField); debugFeedback.textContent = 'Log copied.'; }
    catch { debugFeedback.textContent = 'Could not copy. Select the log to copy manually.'; }
  };
  diagnostics.querySelector('[data-clear]').onclick = () => { localStorage.removeItem(logKey); logField.value = ''; debugFeedback.textContent = 'Log cleared.'; };
  const interval = 5 * 60 * 1000;
  let checking, lastCheck = -Infinity, outcome = '', update, shownVersion, installing = false;
  auto.checked = localStorage.getItem('desktop-auto-update') !== 'off';
  debugAuto.checked = auto.checked;
  debugAuto.onchange = () => { auto.checked = debugAuto.checked; auto.onchange(); };
  auto.onchange = () => {
    debugAuto.checked = auto.checked;
    localStorage.setItem('desktop-auto-update', auto.checked ? 'on' : 'off');
    if (auto.checked) void check();
  };
  dismiss.onclick = () => { if (update) localStorage.setItem(`lb149:desktop-dismiss:${update.version}`, '1'); banner.hidden = true; };
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
    if (manual || performance.now() - lastCheck >= interval) debugState.textContent = 'Checking for updates…';
    if (manual) result.textContent = debugState.textContent;
    if (!checking && (manual || performance.now() - lastCheck >= interval)) {
      lastCheck = performance.now();
      checking = (async () => {
        try {
          update = await invoke('check_desktop_update');
          outcome = update ? `Update ${update.version} is available.` : 'Linebreaker is up to date.';
          getButton.hidden = !update;
          banner.hidden = !update || !!localStorage.getItem(`lb149:desktop-dismiss:${update.version}`);
          if (update && newer(update.version, config.version)) whatsNew = null;
          if (update) banner.querySelector('[data-available]').textContent = `Update ${update.version}`;
        } catch {
          outcome = 'Could not check for updates. Check your internet connection or try GitHub.';
        }
        debugState.textContent = outcome;
        log(outcome);
      })().finally(() => { checking = null; });
    }
    if (checking) await checking;
    showWhatsNew();
    if (manual) result.textContent = outcome;
  }

  install.onclick = async () => {
    if (installing || !update) return;
    if (window.linebreakerReadyForUpdates !== true || window.linebreakerCanInterrupt?.() !== true) {
      status.textContent = 'Finish the current activity before installing.';
      return;
    }
    installing = true;
    install.disabled = close.disabled = true;
    progress.hidden = false;
    progress.removeAttribute('value');
    status.textContent = 'Starting download…';
    const started = performance.now();
    let speedText = '';
    log(`Downloading setup ${update.version}`);
    const channel = new Channel();
    channel.onmessage = ({ done, total }) => {
      total ||= update.size;
      if (total) { progress.max = total; progress.value = done; }
      const speed = done / Math.max((performance.now() - started) / 1000, 0.1);
      status.textContent = `${size(done)} / ${total ? size(total) : '?'} · ${size(speed)}/s`;
      debugState.textContent = `Downloading · ${status.textContent}`;
      speedText = status.textContent;
    };
    try {
      await invoke('download_desktop_update', { version: update.version, onProgress: channel });
      log(`Verified setup ${update.version}${speedText ? ` · ${speedText}` : ''}`);
      status.textContent = 'Starting setup…';
      debugState.textContent = 'Installer ready';
      await window.flushLinebreakerSave?.();
      if (window.linebreakerCanInterrupt?.() !== true) throw new Error('Game is busy');
      localStorage.setItem(notesKey, update.notes || '');
      localStorage.setItem(`${notesKey}:version`, update.version);
      await invoke('install_desktop_update', { version: update.version });
      return;
    } catch {
      log(`Update ${update.version} did not install`);
      debugState.textContent = 'Update failed';
      status.textContent = 'Update failed. Check your connection and try again, or get the installer on GitHub.';
      install.textContent = 'TRY AGAIN';
      progress.hidden = true;
      install.disabled = close.disabled = installing = false;
    }
  };
  checkButton.onclick = () => check(true);
  window.addEventListener('focus', () => check());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  debugState.textContent = 'No staged update';
  if (auto.checked) await check();
  else showWhatsNew();
})().catch(error => console.error('Desktop updates unavailable', error));
