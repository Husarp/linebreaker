(function () {
  const ota = window.Capacitor?.getPlatform?.() === 'android' && window.Capacitor.Plugins?.Ota;
  const bundle = window.BUNDLE;
  if (!ota || !bundle?.version) return;
  const { startupUpgrade, attachVersion, dialog, size, showNotes, copy, newer } = window.LBUpdateTools;
  const defaults = { smallFixes: true, majorUpdates: false, shellUpdates: true, wifiLimitMb: 20, mobileLimitMb: 5, checkFrequency: '6h' };
  const fields = [
    ['smallFixes', 'Automatically install small fixes'],
    ['majorUpdates', 'Automatically install big fixes and new versions'],
    ['shellUpdates', 'Automatically install shell updates'],
    ['wifiLimitMb', 'Wi-Fi download limit', [[5, '5 MiB'], [20, '20 MiB'], [50, '50 MiB'], [100, '100 MiB'], [-1, 'No limit']]],
    ['mobileLimitMb', 'Mobile download limit', [[0, 'Never'], [5, '5 MiB'], [20, '20 MiB'], [50, '50 MiB'], [-1, 'No limit']]],
    ['checkFrequency', 'Check frequency', [['open', 'When opened'], ['1h', 'Every hour'], ['6h', 'Every 6 hours'], ['24h', 'Every day'], ['manual', 'Manual only']]],
  ];
  const menu = document.getElementById('menu-overlay');
  const settingsHost = document.querySelector('#settings-overlay .settings-section')?.parentElement;
  if (!menu || !settingsHost) return;
  const makeButton = (label, action, primary = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lb-block-btn' + (primary ? ' lb-block-btn--primary' : '');
    button.textContent = label;
    button.onclick = action;
    return button;
  };
  const section = document.createElement('section');
  section.className = 'settings-section lb-block-panel lb149-settings';
  section.innerHTML = '<h2 class="lb-block-section-title">Android updates</h2><p data-update-version></p><p data-status role="status"></p><div class="lb149-actions"></div>';
  const banner = document.createElement('aside');
  banner.className = 'lb-block-panel lb149-banner';
  banner.hidden = true;
  menu.append(banner);
  settingsHost.append(section);
  const diagnostics = dialog('Update diagnostics', `<dl data-versions></dl><p data-state role="status"></p>
    <label class="lb149-choice">Automatic updates <span class="lb-block-switch"><input type="checkbox" role="switch" data-auto><span class="toggle-slider"></span></span></label>
    <div class="lb149-actions" data-actions></div>
    <form data-address><label for="lb149-url">Bundle update address</label><div class="lb149-actions"><input id="lb149-url" type="url" required><button class="lb-block-btn">Save address</button></div></form>
    <label for="lb149-android-log">Update log</label><textarea id="lb149-android-log" readonly></textarea>
    <div class="lb149-actions" data-log-actions><button class="lb-block-btn" data-close>Close</button></div><p data-feedback role="status"></p>`);
  const preferences = dialog('Update settings', '<div data-form></div><p data-feedback role="status"></p><div class="lb149-actions"></div>');
  let state, ready = false, safety, refreshing, notice, shellUpgrade, settingsBusy = false, restartToken;
  let bannerKey;
  const clearBanner = () => { banner.hidden = true; bannerKey = undefined; };
  const canInterrupt = () => ready && window.linebreakerCanInterrupt?.() === true && !settingsBusy;
  const syncSafety = () => {
    const safe = canInterrupt();
    if (safe === safety) return Promise.resolve();
    safety = safe;
    return ota.setSafeToInterrupt({ safe }).catch(() => { if (safety === safe) safety = undefined; });
  };
  window.LBAndroidUpdates = { syncSafety };
  const guardedOverlay = '#pal-edit-modal, .lb-reward-overlay';
  const overlays = new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' || [...record.addedNodes, ...record.removedNodes]
      .some(node => node.matches?.(guardedOverlay)))) void syncSafety();
  });
  overlays.observe(document.body, { childList: true });
  const transferPanel = document.getElementById('transfer-overlay');
  if (transferPanel) overlays.observe(transferPanel, { attributes: true, attributeFilter: ['class'] });
  const status = value => { section.querySelector('[data-status]').textContent = value; };
  const feedback = (panel, value) => { panel.querySelector('[data-feedback]').textContent = value; };
  const guarded = async action => {
    await window.flushLinebreakerSave?.();
    if (!canInterrupt()) { status('Finish the current activity before updating.'); return; }
    await syncSafety();
    if (canInterrupt()) await action();
  };
  const run = async action => {
    try { await action(); await refresh(); }
    catch { status('Update action failed. Try again or open GitHub.'); }
  };
  const openGitHub = () => ota.openReleases();
  const check = () => run(() => ota.check());
  const restart = () => guarded(() => ota.restart());
  const logField = diagnostics.querySelector('textarea');
  const reloadLog = async () => {
    if (!diagnostics.open || document.activeElement === logField) return;
    const log = await ota.getUpdateLog();
    if (diagnostics.open && logField.value !== log.text) logField.value = log.text;
  };
  const auto = diagnostics.querySelector('[data-auto]');
  const address = diagnostics.querySelector('#lb149-url');
  diagnostics.querySelector('[data-address]').onsubmit = async event => {
    event.preventDefault();
    try { await ota.setUpdateSettings({ url: address.value.trim() }); feedback(diagnostics, 'Update address saved.'); await refresh(); }
    catch { feedback(diagnostics, 'Could not save the update address. Use an HTTPS URL.'); }
  };
  auto.onchange = async () => {
    try {
      const on = auto.checked;
      await ota.setUpdateSettings({ checkFrequency: on ? (localStorage.getItem('lb149:checkFrequency') || '6h') : 'manual' });
      feedback(diagnostics, '');
      await refresh();
    } catch { auto.checked = !auto.checked; feedback(diagnostics, 'Could not save update settings.'); }
  };
  diagnostics.querySelector('[data-actions]').append(
    makeButton('Check now', check),
    makeButton('Restart', () => run(restart)),
    makeButton('Reset to built-in version', () => run(() => guarded(() => ota.confirmReset()))),
  );
  diagnostics.querySelector('[data-log-actions]').append(
    makeButton('Copy', async () => {
      try { await copy(logField.value, logField); feedback(diagnostics, 'Log copied.'); }
      catch { feedback(diagnostics, 'Could not copy. Select the log to copy manually.'); }
    }),
    makeButton('Clear', async () => { await ota.clearUpdateLog(); logField.value = ''; feedback(diagnostics, 'Log cleared.'); }),
  );
  const retry = makeButton('Check now', check);
  section.querySelector('.lb149-actions').append(
    makeButton('Update settings', () => openSettings(false, true)),
    retry,
    makeButton('GitHub', () => run(openGitHub)),
  );

  function openSettings(setup, customize) {
    if (!state?.updateSettings) return;
    settingsBusy = true;
    void syncSafety();
    const title = setup ? 'How should updates work?' : 'Update settings';
    preferences.setAttribute('aria-label', title);
    preferences.querySelector('h2').textContent = title;
    const form = preferences.querySelector('[data-form]');
    const actions = preferences.querySelector('.lb149-actions');
    form.replaceChildren(); actions.replaceChildren(); feedback(preferences, '');
    const save = async values => {
      const buttons = [...actions.querySelectorAll('button')];
      buttons.forEach(button => { button.disabled = true; });
      try {
        state.updateSettings = await ota.setUpdateSettings({ ...values, setupAnswered: true });
        preferences.close();
        await refresh();
      } catch { feedback(preferences, 'Could not save. Please try again.'); }
      finally { buttons.forEach(button => { button.disabled = false; }); }
    };
    preferences.oncancel = event => { if (setup) event.preventDefault(); };
    if (!customize) {
      const description = document.createElement('p');
      description.textContent = 'Install small fixes and app updates automatically. Ask before big fixes or new versions. Check every 6 hours, with limits of 20 MiB on Wi-Fi and 5 MiB on mobile data.';
      form.append(description);
      actions.append(makeButton('Recommended', () => save(defaults), true), makeButton('Customize', () => openSettings(true, true)));
    } else {
      const controls = fields.map(([key, label, choices]) => {
        const row = document.createElement('label');
        row.className = 'lb149-choice';
        row.append(label);
        const control = document.createElement(choices ? 'select' : 'input');
        if (choices) {
          for (const [value, text] of choices) control.append(new Option(text, value));
          control.value = state.updateSettings[key];
          row.append(control);
        } else {
          const wrapper = document.createElement('span');
          wrapper.className = 'lb-block-switch';
          const track = document.createElement('span'); track.className = 'toggle-slider';
          control.type = 'checkbox'; control.setAttribute('role', 'switch');
          control.checked = state.updateSettings[key];
          wrapper.append(control, track); row.append(wrapper);
        }
        form.append(row);
        return [key, () => choices ? key.endsWith('Mb') ? Number(control.value) : control.value : control.checked];
      });
      const hint = document.createElement('p');
      hint.textContent = 'Metered Wi-Fi counts as mobile. Manual only disables automatic checks, including critical fixes. Android may still ask before installing an app update.';
      form.append(hint);
      actions.append(makeButton('Save', () => save(Object.fromEntries(controls.map(([key, value]) => [key, value()]))), true),
        makeButton(setup ? 'Back' : 'Cancel', () => setup ? openSettings(true, false) : preferences.close()));
    }
    if (!preferences.open) preferences.showModal();
  }
  preferences.addEventListener('close', () => { settingsBusy = false; void syncSafety(); });

  function offer(current) {
    if (current.trial || !current.updateSettings?.setupAnswered || !canInterrupt()) return null;
    const web = current.available, shell = current.shellReady || current.shellAvailable;
    if (notice && [web?.version, current.staged?.version, current.webDownloadVersion].some(version => newer(version, notice.to))) notice = null;
    if (notice && shell && (shell.versionCode > current.runningShellVersionCode || newer(shell.version, current.shellVersion))) notice = null;
    if (current.rolledBack) {
      const { from, to } = current.rolledBack;
      const key = `rollback:${from}:${to}`;
      if (!localStorage.getItem(`lb149:${key}`)) return { key, text: `Version ${from} didn't start. You're back on ${to}.` };
    }
    const items = [
      current.shellReady && { key: `shell-ready:${shell.versionCode}`, text: `App update ${shell.version} ready`, dates: shell, label: 'Install', close: true, action: () => guarded(() => ota.installShell()) },
      current.staged && { key: `staged:${current.staged.version}`, text: `Fixes downloaded (${current.staged.version})`, dates: current.staged, label: 'Restart', close: true, action: restart },
      current.shellAvailable && { key: `shell:${shell.versionCode}`, text: `App update ${shell.version} · ${size(shell.size)}`, dates: shell, label: 'Update', action: () => ota.downloadShell() },
      web && { key: `web:${web.version}`, text: web.needsShell ? `Version ${web.version} needs an app update first` : `Update ${web.version} · ${size(web.size)}`, dates: web, label: web.needsShell ? undefined : 'Update', action: () => ota.download() },
    ].filter(Boolean);
    if (items.length) return items.find(item => !localStorage.getItem(`lb149:${item.key}`)) || null;
    if (notice) return { key: `notes:${notice.to}`, label: `What's new in ${notice.to} ›`, action: () => showNotes(notice.to, notice.notes, openGitHub) };
    return null;
  }

  function dateRows(dates) {
    return [['Published', 'publishedAt'], ['Available', 'availableAt'], ['Downloaded', 'downloadedAt'], ['Installed', 'installedAt']]
      .filter(([, key]) => dates?.[key] > 0)
      .map(([label, key]) => [label, new Date(dates[key]).toLocaleString()]);
  }

  function render(current) {
    const busy = current.webDownloadVersion || current.shellDownloading;
    const transfer = current.webDownloadVersion ? current.webTransfer : current.shellTransfer;
    const progress = busy && transfer?.total ? ` · ${Math.floor(100 * transfer.done / transfer.total)}% · ${size(transfer.done)} / ${size(transfer.total)} · ${size(transfer.speed)}/s` : '';
    status(`${current.status} · ${current.shellStatus}${progress}`);
    retry.textContent = /fail|error/i.test(`${current.status} ${current.shellStatus}`) ? 'Try again' : 'Check now';
    diagnostics.querySelector('[data-state]').textContent = `${current.trial ? 'Trial' : busy ? 'Downloading' : current.staged || current.shellReady ? 'Ready' : 'No staged update'}: ${section.querySelector('[data-status]').textContent}`;
    if (current.updateSettings) {
      const frequency = current.updateSettings.checkFrequency;
      auto.checked = frequency !== 'manual';
      if (auto.checked) localStorage.setItem('lb149:checkFrequency', frequency);
    }
    const versions = diagnostics.querySelector('[data-versions]');
    const rows = [['Shell', current.shellVersion], ['Web', bundle.version], ['Shell API', current.shellApi],
      ...dateRows(current.shellTimestamps).map(([field, value]) => [`Shell ${field.toLowerCase()}`, value]),
      ...dateRows(current.webTimestamps).map(([field, value]) => [`Web ${field.toLowerCase()}`, value])];
    const versionKey = JSON.stringify(rows);
    if (versions.dataset.rendered !== versionKey) {
      versions.dataset.rendered = versionKey;
      versions.replaceChildren();
      for (const [name, value] of rows) {
        const term = document.createElement('dt'), description = document.createElement('dd');
        term.textContent = name; description.textContent = value; versions.append(term, description);
      }
    }
    if (ready && current.autoRestart && current.staged && !current.busy && canInterrupt() && !document.hidden && restartToken !== current.token) {
      restartToken = current.token;
      void run(restart);
    }
    const item = busy && !canInterrupt() ? null : offer(current);
    if (!item && busy && canInterrupt()) {
      if (bannerKey !== 'download') banner.replaceChildren(document.createElement('span'));
      banner.firstChild.textContent = `Downloading update${progress}`;
      bannerKey = 'download'; banner.hidden = false; return;
    }
    if (!item) { clearBanner(); return; }
    if (bannerKey === item.key) return;
    bannerKey = item.key;
    banner.replaceChildren(); banner.hidden = false;
    if (item.text) { const text = document.createElement('span'); text.textContent = item.text; banner.append(text); }
    if (item.label) banner.append(makeButton(item.label, () => run(item.action), true));
    if (item.text) {
      const dismiss = makeButton(item.close ? '✕' : item.key.startsWith('rollback:') ? 'Dismiss' : 'Later', () => {
        localStorage.setItem(`lb149:${item.key}`, '1'); clearBanner();
      });
      if (item.close) dismiss.setAttribute('aria-label', 'Dismiss update');
      banner.append(dismiss);
    }
    const dates = dateRows(item.dates);
    if (dates.length) {
      const detail = document.createElement('small');
      detail.textContent = dates.map(([label, value]) => `${label}: ${value}`).join(' · ');
      banner.append(detail);
    }
  }
  function refresh() {
    if (!refreshing) refreshing = ota.getState().then(current => {
      state = current;
      if (current.updated?.to === bundle.version && localStorage.getItem('lb149:lastNoticeToken') !== current.token) {
        notice = current.updated;
        localStorage.setItem('lb149:lastNoticeToken', current.token);
      }
      if (shellUpgrade && !notice) notice = { to: shellUpgrade, notes: current.shellNotes };
      shellUpgrade = null;
      render(current);
      return reloadLog();
    }).finally(() => { refreshing = null; });
    return refreshing;
  }
  async function initialize() {
    await Promise.all(['updateAvailable', 'updateStaged', 'updated', 'rolledBack', 'shellUpdateReady', 'updateSettingsChanged']
      .map(event => ota.addListener(event, () => { void refresh().catch(() => {}); })));
    const initial = await ota.info();
    state = initial;
    if (initial.webVersion !== bundle.version || !initial.token) return;
    attachVersion(bundle.version, () => {
      address.value = state.updateSettings.url || '';
      diagnostics.showModal();
      void refresh().catch(() => {});
    });
    if (!initial.updateSettings.setupAnswered) openSettings(true, false);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await window.flushLinebreakerSave?.();
    if (!(await ota.appReady({ version: bundle.version, token: initial.token })).accepted) return;
    await window.resumeLinebreakerOtaWrites?.();
    ready = true;
    shellUpgrade = startupUpgrade(localStorage, 'lb149:shell', initial.shellVersion);
    if (Number.isSafeInteger(initial.runningShellVersionCode)) {
      const previousCode = Number(localStorage.getItem('lb149:shellCode'));
      if (previousCode > 0 && initial.runningShellVersionCode > previousCode) shellUpgrade = initial.shellVersion;
      localStorage.setItem('lb149:shellCode', initial.runningShellVersionCode);
    }
    await syncSafety();
    await refresh();
    setInterval(() => { void syncSafety(); void refresh().catch(() => {}); }, 1000);
  }
  const start = () => initialize().catch(() => status('Updater unavailable. Open GitHub for a standalone APK.'));
  if (window.linebreakerReadyForUpdates) void start();
  else window.addEventListener('linebreaker-update-ready', start, { once: true });
})();
