(function () {
  const plugins = window.Capacitor?.Plugins;
  const ota = window.Capacitor?.getPlatform?.() === 'android' && plugins?.Ota;
  const bundle = window.BUNDLE;
  if (!ota || !bundle?.version) return;
  const { startupUpgrade, attachVersion, dialog, size, showNotes, copy, newer } = window.LBUpdateTools;
  const defaults = { smallFixes: true, majorUpdates: false, shellUpdates: true, wifiLimitMb: 20, mobileLimitMb: 5, checkFrequency: '6h' };
  const fields = [
    ['smallFixes', 'Automatically install small fixes'],
    ['majorUpdates', 'Automatically install big fixes and new versions'],
    ['shellUpdates', 'Automatically install shell updates'],
    ['wifiLimitMb', 'Wi-Fi download limit', [[5, '5 MiB'], [20, '20 MiB'], [50, '50 MiB'], [100, '100 MiB'], [-1, 'No limit']]],
    ['mobileLimitMb', 'Mobile download limit', [[0, 'Wi-Fi only'], [5, '5 MiB'], [20, '20 MiB'], [50, '50 MiB'], [-1, 'Any network, no limit']]],
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
  section.innerHTML = `<h2 class="lb-block-section-title">Updates</h2><p data-update-version></p><p data-shell-version></p>
    <label class="lb149-choice">Automatic update checks <span class="lb-block-switch"><input type="checkbox" role="switch" data-auto disabled><span class="toggle-slider"></span></span></label>
    <details><summary>Update policy</summary><div data-policy></div><p>Metered Wi-Fi counts as mobile. Limits apply to automatic downloads.</p>
      <form data-address><label for="lb154-update-address">Bundle update address</label><div class="lb149-actions"><input id="lb154-update-address" type="url" required><button class="lb-block-btn">Save address</button></div></form>
    </details>
    <label class="lb149-choice" hidden>Android update notifications <span class="lb-block-switch"><input type="checkbox" role="switch" data-notifications disabled><span class="toggle-slider"></span></span></label>
    <p data-feedback role="status"></p><p data-status role="status"></p><div class="lb149-actions" data-section-actions></div>`;
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
  const automatic = [section, diagnostics].map(panel => panel.querySelector('[data-auto]'));
  const policy = policyControls(section.querySelector('[data-policy]'));
  const addressForms = [section, diagnostics].map(panel => panel.querySelector('[data-address]'));
  let savingPolicy = false;
  function renderPolicy(current) {
    if (!current || savingPolicy) return;
    const frequency = current.checkFrequency;
    if (frequency !== 'manual') localStorage.setItem('lb149:checkFrequency', frequency);
    for (const input of automatic) { input.checked = frequency !== 'manual'; input.disabled = false; }
    for (const field of policy) field.set(current[field.key]);
    for (const form of addressForms) {
      const input = form.querySelector('input');
      if (!input.dataset.edited) input.value = current.url || '';
    }
  }
  async function updatePolicy(patch, panel, success = '') {
    if (savingPolicy || !state?.updateSettings) return;
    savingPolicy = true;
    const controls = [...automatic, ...policy.map(field => field.control), ...addressForms.flatMap(form => [...form.elements])];
    controls.forEach(control => { control.disabled = true; });
    try {
      state.updateSettings = await ota.setUpdateSettings(patch);
      feedback(panel, success);
      if (patch.url) addressForms.forEach(form => { delete form.querySelector('input').dataset.edited; });
    } catch { feedback(panel, patch.url ? 'Could not save the update address. Use an HTTPS URL.' : 'Could not save update settings.'); }
    finally {
      savingPolicy = false;
      controls.forEach(control => { control.disabled = false; });
      renderPolicy(state.updateSettings);
    }
    void refresh().catch(() => {});
  }
  automatic.forEach((input, index) => { input.onchange = () => updatePolicy({
    checkFrequency: input.checked ? (localStorage.getItem('lb149:checkFrequency') || '6h') : 'manual',
  }, index ? diagnostics : section); });
  for (const field of policy) field.control.onchange = () => updatePolicy({ [field.key]: field.value() }, section);
  addressForms.forEach((form, index) => {
    const input = form.querySelector('input');
    input.oninput = () => { input.dataset.edited = '1'; };
    form.onsubmit = event => { event.preventDefault(); return updatePolicy({ url: input.value.trim() }, index ? diagnostics : section, 'Update address saved.'); };
  });
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
  const retry = makeButton('CHECK NOW', check);
  let currentAction;
  let notify = () => {};
  const getUpdate = makeButton('GET UPDATE', () => currentAction && run(currentAction), true);
  getUpdate.hidden = true;
  const notesButton = makeButton("What's new", () => showNotes(notice?.to || bundle.version, notice ? notice.notes : bundle.message, openGitHub));
  const setupButton = makeButton('Finish update setup', () => openSettings(false));
  setupButton.hidden = true;
  const openShell = () => {
    renderPolicy(state?.updateSettings);
    diagnostics.showModal();
    void refresh().catch(() => {});
  };
  section.querySelector('[data-section-actions]').append(
    retry,
    getUpdate,
    setupButton,
    notesButton,
    makeButton('Open app shell', openShell),
    makeButton('GitHub', () => run(openGitHub)),
  );

  function policyControls(container) {
    return fields.map(([key, label, choices]) => {
      const row = document.createElement('label');
      row.className = 'lb149-choice';
      row.append(label);
      const control = document.createElement(choices ? 'select' : 'input');
      if (choices) {
        for (const [value, text] of choices) control.append(new Option(text, value));
        row.append(control);
      } else {
        const wrapper = document.createElement('span'); wrapper.className = 'lb-block-switch';
        const track = document.createElement('span'); track.className = 'toggle-slider';
        control.type = 'checkbox'; control.setAttribute('role', 'switch');
        wrapper.append(control, track); row.append(wrapper);
      }
      container.append(row);
      return { key, control, set(value) { if (choices) control.value = value; else control.checked = value; },
        value: () => choices ? key.endsWith('Mb') ? Number(control.value) : control.value : control.checked };
    });
  }

  function openSettings(customize) {
    if (!state?.updateSettings) return;
    settingsBusy = true;
    void syncSafety();
    const title = 'How should updates work?';
    preferences.setAttribute('aria-label', title);
    preferences.querySelector('h2').textContent = title;
    const form = preferences.querySelector('[data-form]');
    const actions = preferences.querySelector('.lb149-actions');
    form.replaceChildren(); actions.replaceChildren(); feedback(preferences, '');
    const save = async values => {
      const buttons = [...actions.querySelectorAll('button:not([data-skip])')];
      buttons.forEach(button => { button.disabled = true; });
      try {
        state.updateSettings = await ota.setUpdateSettings({ ...values, setupAnswered: true });
        preferences.close();
        await refresh();
      } catch { feedback(preferences, 'Could not save. Please try again.'); }
      finally { buttons.forEach(button => { button.disabled = false; }); }
    };
    if (!customize) {
      const description = document.createElement('p');
      description.textContent = 'Install small fixes and app updates automatically. Ask before big fixes or new versions. Check every 6 hours, with limits of 20 MiB on Wi-Fi and 5 MiB on mobile data.';
      form.append(description);
      actions.append(makeButton('Recommended', () => save(defaults), true), makeButton('Customize', () => openSettings(true)));
    } else {
      const controls = policyControls(form);
      for (const field of controls) field.set(state.updateSettings[field.key]);
      const hint = document.createElement('p');
      hint.textContent = 'Metered Wi-Fi counts as mobile. Manual only disables automatic checks, including critical fixes. Android may still ask before installing an app update.';
      form.append(hint);
      actions.append(makeButton('Save', () => save(Object.fromEntries(controls.map(field => [field.key, field.value()]))), true),
        makeButton('Back', () => openSettings(false)));
    }
    const later = makeButton('Set up later', () => preferences.close());
    later.dataset.skip = '';
    actions.append(later);
    if (!preferences.open) preferences.showModal();
  }
  preferences.addEventListener('close', () => { settingsBusy = false; void syncSafety(); });

  function offer(current, includeDismissed = false) {
    if (current.trial || !canInterrupt() || (!includeDismissed && !current.updateSettings?.setupAnswered)) return null;
    const web = current.available, shell = current.shellReady || current.shellAvailable;
    if (notice && [web?.version, current.staged?.version, current.webDownloadVersion].some(version => newer(version, notice.to))) notice = null;
    if (notice && shell && (shell.versionCode > current.runningShellVersionCode || newer(shell.version, current.shellVersion))) notice = null;
    if (current.rolledBack && !includeDismissed) {
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
    if (includeDismissed) return items.find(item => item.action) || null;
    if (items.length) return items.find(item => !localStorage.getItem(`lb149:${item.key}`)) || null;
    if (notice) return { key: `notes:${notice.to}`, label: `What's new in ${notice.to} ›`, action: () => showNotes(notice.to, notice.notes, openGitHub) };
    return null;
  }

  function dateRows(dates) {
    return [['Published', 'publishedAt'], ['Available', 'availableAt'], ['Downloaded', 'downloadedAt'], ['Installed', 'installedAt']]
      .filter(([, key]) => dates?.[key] > 0)
      .map(([label, key]) => [label, new Date(dates[key]).toLocaleString()]);
  }

  async function mountNotifications() {
    const preferences = plugins?.Preferences;
    const system = plugins?.LocalNotifications;
    if (!preferences || !system) return;
    const key = 'linebreaker-update-notifications';
    const channelId = 'linebreaker-updates';
    const ids = { web: 15401, shell: 15402, installed: 15403 };
    const input = section.querySelector('[data-notifications]');
    input.closest('label').hidden = false;
    const createChannel = () => system.createChannel({ id: channelId, name: 'Linebreaker updates', importance: 3 });
    let sending = false;
    input.checked = (await preferences.get({ key })).value === 'on';
    input.disabled = false;
    input.onchange = async () => {
      const enable = input.checked;
      input.disabled = true;
      try {
        if (enable) {
          let { display } = await system.checkPermissions();
          if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await system.requestPermissions());
          if (display !== 'granted') {
            input.checked = false;
            feedback(section, 'Allow Linebreaker notifications in Android Settings.');
            return;
          }
          await createChannel();
        }
        await preferences.set({ key, value: enable ? 'on' : 'off' });
        feedback(section, '');
        if (enable) notify(state);
        else await system.cancel({ notifications: Object.values(ids).map(id => ({ id })) });
      } catch {
        input.checked = (await preferences.get({ key }).catch(() => ({}))).value === 'on';
        feedback(section, 'Could not change Android update notifications.');
      } finally { input.disabled = false; }
    };
    notify = current => {
      if (!current || !input.checked || sending || current.trial) return;
      const web = current.staged || current.available;
      const shell = current.shellReady || current.shellAvailable;
      const notices = [
        ['web', web?.version, `Linebreaker update ${web?.version} available`, 'Open Linebreaker to see the update.'],
        ['shell', shell?.versionCode, `Linebreaker app update ${shell?.version} available`, 'Open Linebreaker to see the app update.'],
        ['installed', current.updated?.to === bundle.version ? current.token : null, `Linebreaker updated to ${bundle.version}`, "Open Linebreaker to see what's new."],
      ].filter(([type, token]) => token && localStorage.getItem(`lb154:notification:${type}`) !== String(token));
      if (!notices.length) return;
      sending = true;
      void (async () => {
        if ((await system.checkPermissions()).display !== 'granted' || !input.checked) return;
        await createChannel();
        if (!input.checked) return;
        await system.schedule({ notifications: notices.map(([type, , title, body]) => ({ id: ids[type], title, body, channelId })) });
        for (const [type, token] of notices) localStorage.setItem(`lb154:notification:${type}`, token);
      })().catch(error => console.warn('Update notifications unavailable:', error)).finally(() => { sending = false; });
    };
    notify(state);
  }

  function render(current) {
    const busy = current.webDownloadVersion || current.shellDownloading;
    const transfer = current.webDownloadVersion ? current.webTransfer : current.shellTransfer;
    const progress = busy && transfer?.total ? ` · ${Math.floor(100 * transfer.done / transfer.total)}% · ${size(transfer.done)} / ${size(transfer.total)} · ${size(transfer.speed)}/s` : '';
    status(`${current.status} · ${current.shellStatus}${progress}`);
    diagnostics.querySelector('[data-state]').textContent = `${current.trial ? 'Trial' : busy ? 'Downloading' : current.staged || current.shellReady ? 'Ready' : 'No staged update'}: ${section.querySelector('[data-status]').textContent}`;
    renderPolicy(current.updateSettings);
    section.querySelector('[data-shell-version]').textContent = `App shell ${current.shellVersion}`;
    setupButton.hidden = current.updateSettings?.setupAnswered !== false;
    notify(current);
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
    currentAction = !busy && offer(current, true)?.action;
    getUpdate.hidden = !currentAction;
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
    const initial = await ota.info();
    state = initial;
    if (initial.webVersion !== bundle.version || !initial.token) return;
    attachVersion(bundle.version, openShell);
    render(initial);
    if (!initial.updateSettings.setupAnswered) openSettings(false);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await window.flushLinebreakerSave?.();
    if (!(await ota.appReady({ version: bundle.version, token: initial.token })).accepted) return;
    void window.resumeLinebreakerOtaWrites?.()?.catch(error => console.warn('Could not resume save writes:', error));
    ready = true;
    shellUpgrade = startupUpgrade(localStorage, 'lb149:shell', initial.shellVersion);
    if (Number.isSafeInteger(initial.runningShellVersionCode)) {
      const previousCode = Number(localStorage.getItem('lb149:shellCode'));
      if (previousCode > 0 && initial.runningShellVersionCode > previousCode) shellUpgrade = initial.shellVersion;
      localStorage.setItem('lb149:shellCode', initial.runningShellVersionCode);
    }
    void mountNotifications().catch(() => feedback(section, 'Android update notifications are unavailable.'));
    await syncSafety();
    await refresh();
    setInterval(() => { void syncSafety(); void refresh().catch(() => {}); }, 1000);
  }
  const start = () => {
    void Promise.all(['updateAvailable', 'updateStaged', 'updated', 'rolledBack', 'shellUpdateReady', 'updateSettingsChanged']
      .map(event => ota.addListener(event, () => { if (ready) void refresh().catch(() => {}); }))).catch(() => {});
    return initialize().catch(() => status('Updater unavailable. Open GitHub for a standalone APK.'));
  };
  if (window.linebreakerReadyForUpdates) void start();
  else window.addEventListener('linebreaker-update-ready', start, { once: true });
})();
