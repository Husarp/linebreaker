(async function () {
  const api = window.__TAURI__;
  if (!api) return;
  const { invoke, Channel } = api.core;
  if (await invoke('desktop_smoke_ready', { ready: typeof window.openSettings === 'function' && !!document.querySelector('canvas') })) return;
  const config = await invoke('desktop_update_info');
  const settings = document.getElementById('settings-updates');
  if (!config.enabled || !settings) return;
  const { startupUpgrade, attachVersion, dialog, setReleaseNotes, showReleaseNotice, size, copy, newer,
    notices, queueNotice, getLabel, githubIcon, statusMarkup, setStatus, showNotes } = window.LBUpdateTools;
  const section = document.createElement('section');
  section.className = 'settings-section lb-block-panel lb149-settings';
  section.innerHTML = `<h2 class="lb-block-section-title">Updates</h2>
    <div class="lb149-actions lb184-toolbar">
      <button class="lb-block-btn" data-check>Check for updates</button>
      <button class="lb-block-btn lb-block-btn--primary" data-get hidden></button>
      <button class="lb-block-btn" data-whats-new>What's new</button>
      <button class="lb-block-btn lb-block-btn--icon" data-github aria-label="GitHub releases">${githubIcon}</button>
    </div><p data-update-version></p><div class="lb184-status-slot">${statusMarkup}</div>
    <button class="lb-block-btn lb184-secondary" data-shell>Open app shell</button>
    <label class="lb149-choice">Automatic update checks <span class="lb-block-switch"><input type="checkbox" role="switch" data-auto><span class="toggle-slider"></span></span></label>
    <label class="lb149-choice">In-app update notifications <span class="lb-block-switch"><input type="checkbox" role="switch" data-notifications><span class="toggle-slider"></span></span></label>`;
  settings.prepend(section);
  const diagnostics = dialog('Update logs', `<p data-state></p>
    <label for="lb149-desktop-log">Update log</label><textarea id="lb149-desktop-log" readonly></textarea>
    <div class="lb149-actions"><button class="lb-block-btn" data-copy>Copy</button><button class="lb-block-btn" data-clear>Clear</button><button class="lb-block-btn" data-close>Close</button></div>
    <p data-feedback role="status"></p>`);
  const logKey = 'lb149:desktop-log';
  const notesKey = 'lb149:desktop-pending-notes';
  const notesVersion = localStorage.getItem(`${notesKey}:version`);
  const notes = notesVersion === config.version ? localStorage.getItem(notesKey) : null;
  const upgraded = startupUpgrade(localStorage, 'lb149:desktop', config.version);
  if (newer(config.version, notesVersion)) {
    localStorage.removeItem(`${notesKey}:version`);
    localStorage.removeItem(notesKey);
  }
  const get = section.querySelector('[data-get]');
  const auto = section.querySelector('[data-auto]');
  const show = section.querySelector('[data-notifications]');
  const logField = diagnostics.querySelector('textarea');
  const feedback = diagnostics.querySelector('[data-feedback]');
  const interval = 5 * 60 * 1000;
  let checking, lastCheck = -Infinity, update, ready = false, working = false, percent, outcome = 'No update ready', eventId = 0;
  const log = text => {
    const rows = `${new Date().toISOString()} · ${text}\n${localStorage.getItem(logKey) || ''}`.split('\n').slice(0, 120).join('\n');
    localStorage.setItem(logKey, rows);
    if (document.activeElement !== logField) logField.value = rows;
  };
  const openLogs = () => {
    logField.value = localStorage.getItem(logKey) || '';
    diagnostics.querySelector('[data-state]').textContent = `Installed: ${config.version}`;
    if (!diagnostics.open) diagnostics.showModal();
  };
  const tell = (title, text, actions = [['Details', openLogs]], force = false) => {
    if (show.checked || force) queueNotice('desktop-event', { key: `desktop-event:${++eventId}`, title, text, actions });
  };
  const openReleases = () => invoke('plugin:opener|open_url', { url: config.releases }).catch(error => {
    log(String(error)); tell('Could not open GitHub', 'Try opening the releases page again.', [], true);
  });
  function render() {
    setStatus(section, outcome, percent);
    get.hidden = !update || working;
    get.textContent = update ? getLabel(update.version, ready) : '';
    const key = update && `lb149:desktop-${ready ? 'ready' : 'dismiss'}:${update.version}`;
    notices('desktop-state', !show.checked ? [] : percent !== undefined ? [{ key: `desktop-download:${update.version}`,
      title: 'Downloading update', text: 'You can keep playing.', percent,
    }] : !working && update && !localStorage.getItem(key) ? [{ key,
      title: ready ? 'Update ready' : 'Update available',
      text: ready ? 'Linebreaker will close to finish updating.' : `Version ${update.version}${update.size ? ` · ${size(update.size)}` : ''}`,
      actions: [[get.textContent, act]], dismiss: () => localStorage.setItem(key, '1'),
    }] : []);
    showReleaseNotice(config.version, notes, { upgraded: !!upgraded, suppressed: !show.checked, fallback: openReleases });
  }
  async function check(manual = false) {
    if ((!manual && !auto.checked) || working) return;
    if (!checking && (manual || performance.now() - lastCheck >= interval)) {
      lastCheck = performance.now();
      outcome = 'Checking for updates…';
      render();
      checking = (async () => {
        try {
          const found = await invoke('check_desktop_update');
          if (found?.version !== update?.version) ready = false;
          update = found;
          outcome = ready ? 'Ready to install' : update ? 'Update available' : 'Linebreaker is up to date';
          log(outcome);
        } catch (error) {
          outcome = 'Could not check for updates';
          log(`${outcome}: ${error}`);
          tell(outcome, 'Check your connection and try again.', [['Retry', () => check(true)], ['Details', openLogs]], manual);
        }
        render();
      })().finally(() => { checking = null; });
    }
    if (checking) await checking;
  }
  async function act() {
    if (checking) await checking;
    if (working || !update) return;
    if (ready && (window.linebreakerReadyForUpdates !== true || window.linebreakerCanInterrupt?.() !== true)) {
      tell('Finish playing first', 'You can install the update after returning to the menu.', [], true);
      return;
    }
    working = true;
    try {
      if (!ready) {
        percent = null;
        outcome = 'Downloading';
        render();
        const channel = new Channel();
        const started = performance.now();
        channel.onmessage = ({ done, total }) => {
          total ||= update.size;
          percent = total ? 100 * done / total : null;
          render();
          diagnostics.querySelector('[data-state]').textContent = `${size(done)} / ${size(total)} · ${size(done / Math.max((performance.now() - started) / 1000, .1))}/s`;
        };
        await invoke('download_desktop_update', { version: update.version, onProgress: channel });
        ready = true;
        outcome = 'Ready to install';
        log(`Download verified: ${update.version}`);
      } else {
        outcome = 'Opening installer…';
        render();
        await window.flushLinebreakerSave?.();
        if (window.linebreakerCanInterrupt?.() !== true) throw new Error('Game is busy');
        localStorage.setItem(notesKey, update.notes || '');
        localStorage.setItem(`${notesKey}:version`, update.version);
        await invoke('install_desktop_update', { version: update.version });
      }
    } catch (error) {
      outcome = 'Could not update';
      log(`${outcome}: ${error}`);
      notices('desktop-state', []);
      tell(outcome, 'Try again from Settings → Updates.', [['Details', openLogs]], true);
    } finally {
      percent = undefined;
      working = false;
      render();
    }
  }
  auto.checked = localStorage.getItem('desktop-auto-update') !== 'off';
  auto.onchange = () => { localStorage.setItem('desktop-auto-update', auto.checked ? 'on' : 'off'); if (auto.checked) void check(); };
  show.checked = localStorage.getItem('desktop-update-notifications') !== 'off';
  show.onchange = () => { localStorage.setItem('desktop-update-notifications', show.checked ? 'on' : 'off'); if (!show.checked) notices('desktop-event', []); render(); };
  setReleaseNotes(config.version, notes, openReleases);
  attachVersion(config.version, openLogs);
  section.querySelector('[data-shell]').onclick = openLogs;
  section.querySelector('[data-whats-new]').onclick = () => showNotes(config.version, notes, openReleases);
  section.querySelector('[data-github]').onclick = openReleases;
  section.querySelector('[data-check]').onclick = () => check(true);
  get.onclick = act;
  diagnostics.querySelector('[data-copy]').onclick = async () => {
    try { await copy(logField.value, logField); feedback.textContent = 'Log copied.'; }
    catch { feedback.textContent = 'Could not copy. Select the log to copy manually.'; }
  };
  diagnostics.querySelector('[data-clear]').onclick = () => { localStorage.removeItem(logKey); logField.value = ''; feedback.textContent = 'Log cleared.'; };
  window.addEventListener('focus', () => check());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void check(); });
  render();
  if (auto.checked) await check();
})().catch(error => console.error('Desktop updates unavailable:', error));
