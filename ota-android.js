(function () {
  const plugins = window.Capacitor?.Plugins;
  const ota = window.Capacitor?.getPlatform?.() === 'android' && plugins?.Ota;
  const bundle = window.BUNDLE;
  if (!ota || !bundle?.version) return;
  const startup = window.LBStartup;
  const bounded = startup?.bounded || ((label, action) => action());
  const { startupUpgrade, attachVersion, dialog, size, setReleaseNotes, showReleaseNotice, copy, newer,
    notices, queueNotice, getLabel, githubIcon, statusMarkup, setStatus, showNotes } = window.LBUpdateTools;
  const defaults = { smallFixes: true, majorUpdates: false, shellUpdates: true, wifiLimitMb: 20, mobileLimitMb: 5, checkFrequency: '6h' };
  const fields = [
    ['smallFixes', 'Automatically install small fixes'],
    ['majorUpdates', 'Automatically install big fixes and new versions'],
    ['shellUpdates', 'Automatically install app updates'],
    ['wifiLimitMb', 'Wi-Fi download limit', [[5, '5 MiB'], [20, '20 MiB'], [50, '50 MiB'], [100, '100 MiB'], [-1, 'No limit']]],
    ['mobileLimitMb', 'Mobile download limit', [[0, 'Wi-Fi only'], [5, '5 MiB'], [20, '20 MiB'], [50, '50 MiB'], [-1, 'Any network, no limit']]],
    ['checkFrequency', 'Check frequency', [['open', 'When opened'], ['1h', 'Every hour'], ['6h', 'Every 6 hours'], ['24h', 'Every day'], ['manual', 'Manual only']]],
  ];
  const menu = document.getElementById('menu-overlay');
  const settingsHost = document.getElementById('settings-updates');
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
  section.innerHTML = `<h2 class="lb-block-section-title">Updates</h2><div class="lb149-actions lb184-toolbar" data-section-actions></div>
    <p data-update-version></p><div class="lb184-status-slot">${statusMarkup}</div>
    <div class="lb149-actions" data-secondary></div>
    <label class="lb149-choice">Automatic update checks <span class="lb-block-switch"><input type="checkbox" role="switch" data-auto disabled><span class="toggle-slider"></span></span></label>
    <div data-policy></div><p>Metered Wi-Fi counts as mobile. Limits apply to automatic downloads.</p>
    <label class="lb149-choice" hidden>Android notifications while away <span class="lb-block-switch"><input type="checkbox" role="switch" data-notifications disabled><span class="toggle-slider"></span></span></label>
    <p data-feedback role="status"></p>`;
  const checkHelp = dialog('Update check help', `<ul>
    <li>On public Wi-Fi, sign in to the network first, or try mobile data.</li>
    <li>If the server refuses requests or is busy, wait and retry. If needed, try a network that allows GitHub and its download servers.</li>
    <li>Check your device date and time, then try again.</li>
    </ul><div class="lb149-actions"><button type="button" class="lb-block-btn" data-close>Close</button></div>`);
  settingsHost.prepend(section);
  const diagnostics = dialog('Update logs', `<dl data-versions></dl><p data-state role="status"></p>
    <label class="lb149-choice">Automatic updates <span class="lb-block-switch"><input type="checkbox" role="switch" data-auto><span class="toggle-slider"></span></span></label>
    <div class="lb149-actions" data-actions></div>
    <label for="lb149-url">Update address</label><input id="lb149-url" data-address type="url" readonly>
    <label for="lb149-android-log">Update log</label><textarea id="lb149-android-log" readonly></textarea>
    <div class="lb149-actions" data-log-actions><button class="lb-block-btn" data-close>Close</button></div><p data-feedback role="status"></p>`);
  const preferences = dialog('Update settings', '<div data-form></div><p data-feedback role="status"></p><div class="lb149-actions"></div>');
  let state, ready = false, safety, refreshing, notice, shellUpgrade, settingsBusy = false;
  const canInterrupt = () => ready && window.linebreakerCanInterrupt?.() === true && !settingsBusy;
  const syncSafety = () => {
    if (!ready) return Promise.resolve();
    const safe = canInterrupt();
    if (safe === safety) return Promise.resolve();
    safety = safe;
    return bounded('OTA safety update', () => ota.setSafeToInterrupt({ safe })).catch(() => { if (safety === safe) safety = undefined; });
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
  const status = (value, percent) => setStatus(section, value, percent);
  let eventId = 0;
  const message = (title, text, actions) => queueNotice('android-message', { key: `android-message:${++eventId}`, title, text, actions });
  const unavailable = error => {
    console.warn('Android updater startup:', error);
    status('Updates unavailable');
    message('Please restart Linebreaker', 'Saving is paused until you restart the app.');
  };
  const feedback = (panel, value) => { panel.querySelector('[data-feedback]').textContent = value; };
  const guarded = async action => {
    await bounded('Save flush before update', () => window.flushLinebreakerSave?.());
    if (!canInterrupt()) { message('Finish playing first', 'You can install the update after returning to the menu.'); return; }
    await syncSafety();
    if (canInterrupt()) await action();
  };
  const run = async action => {
    try { await action(); await refresh(); }
    catch (error) { console.warn('Android update action failed:', error); message('Could not update', 'Try again from Settings → Updates.', [['Details', openShell]]); }
  };
  const openGitHub = () => ota.openReleases();
  const check = () => run(() => ota.check());
  const restart = () => guarded(() => ota.restart());
  const logField = diagnostics.querySelector('textarea');
  const reloadLog = async () => {
    if (!diagnostics.open || document.activeElement === logField) return;
    const log = await bounded('Reading Android logs', () => ota.getUpdateLog());
    if (diagnostics.open && logField.value !== log.text) logField.value = log.text;
  };
  const automatic = [section, diagnostics].map(panel => panel.querySelector('[data-auto]'));
  const policy = policyControls(section.querySelector('[data-policy]'));
  let savingPolicy = false;
  function renderPolicy(current) {
    if (!current || savingPolicy) return;
    const frequency = current.checkFrequency;
    if (frequency !== 'manual') localStorage.setItem('lb149:checkFrequency', frequency);
    for (const input of automatic) { input.checked = frequency !== 'manual'; input.disabled = false; }
    for (const field of policy) field.set(current[field.key]);
    diagnostics.querySelector('[data-address]').value = current.url || '';
  }
  async function updatePolicy(patch, panel, success = '') {
    if (savingPolicy || !state?.updateSettings) return;
    savingPolicy = true;
    const controls = [...automatic, ...policy.flatMap(field => field.controls)];
    controls.forEach(control => { control.disabled = true; });
    try {
      state.updateSettings = await ota.setUpdateSettings(patch);
      feedback(panel, success);
    } catch { feedback(panel, 'Could not save update settings.'); }
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
  for (const field of policy) field.change = () => updatePolicy({ [field.key]: field.value() }, section);
  diagnostics.querySelector('[data-actions]').append(
    makeButton('Check for updates', check),
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
  const retry = makeButton('Check for updates', check);
  async function showCheckNotice(current) {
    if (!ready || document.hidden || !current.updateChecks?.noticePending) return;
    const { message } = await bounded('Checking Android update notice', () => ota.claimCheckNotice({ token: current.token })).catch(() => ({}));
    if (!message) return;
    queueNotice('android-check', { key: `android-check:${++eventId}`, title: 'Could not check for updates',
      text: 'Check your connection and try again.', actions: [['Retry', check], ['Details', () => checkHelp.showModal()]] });
  }
  let currentAction;
  let releaseInfo = [];
  const getUpdate = makeButton('', () => currentAction && run(currentAction), true);
  getUpdate.dataset.get = '';
  getUpdate.hidden = true;
  const setupButton = makeButton('Finish update setup', () => openSettings(false));
  setupButton.hidden = true;
  const openShell = () => {
    renderPolicy(state?.updateSettings);
    diagnostics.showModal();
    void refresh().catch(() => {});
  };
  const github = makeButton('GitHub releases', () => run(openGitHub));
  github.insertAdjacentHTML('afterbegin', githubIcon);
  section.querySelector('[data-section-actions]').append(retry, getUpdate,
    makeButton("What's new", () => showNotes(...releaseInfo, openGitHub)), github);
  const shellButton = makeButton('Open app shell', () => typeof ota.settings === 'function' ? run(() => ota.settings()) : openShell());
  shellButton.classList.add('lb184-secondary');
  section.querySelector('[data-secondary]').append(shellButton, setupButton);

  function policyControls(container) {
    return fields.map(([key, label, choices]) => {
      const row = document.createElement(choices ? 'div' : 'label');
      row.className = 'lb149-choice';
      row.append(label);
      const control = document.createElement(choices ? 'div' : 'input');
      let selected;
      const field = { key, controls: [], set(value) {
        if (!choices) { control.checked = value; return; }
        selected = value;
        field.controls.forEach((button, index) => button.setAttribute('aria-pressed', String(choices[index][0] === value)));
      }, value: () => choices ? selected : control.checked };
      if (choices) {
        control.className = 'lb184-segments lb-block-tabs';
        control.setAttribute('role', 'group');
        control.setAttribute('aria-label', label);
        for (const [value, text] of choices) {
          const button = makeButton(text, () => { field.set(value); field.change?.(); });
          button.classList.add('lb-block-tab');
          field.controls.push(button);
          control.append(button);
        }
        row.append(control);
      } else {
        const wrapper = document.createElement('span'); wrapper.className = 'lb-block-switch';
        const track = document.createElement('span'); track.className = 'toggle-slider';
        control.type = 'checkbox'; control.setAttribute('role', 'switch');
        field.controls.push(control);
        control.onchange = () => field.change?.();
        wrapper.append(control, track); row.append(wrapper);
      }
      container.append(row);
      return field;
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
        state.updateSettings = await bounded('Saving update setup', () => ota.setUpdateSettings({ ...values, setupAnswered: true }));
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

  function offers(current) {
    if (current.trial) return [];
    const web = current.available, shell = current.shellReady || current.shellAvailable;
    const rollback = current.rolledBack;
    return [
      rollback && { key: `rollback:${rollback.from}:${rollback.to}`, title: 'Previous version restored', text: `Version ${rollback.from} could not start. You’re back on ${rollback.to}.` },
      current.shellReady && { key: `shell-ready:${shell.versionCode}`, title: 'App update ready', text: `Version ${shell.version} is ready to install.`, label: getLabel(shell.version, true), action: () => guarded(() => ota.installShell()) },
      current.staged && { key: `staged:${current.staged.version}`, title: 'Update ready', text: 'Restart Linebreaker to finish updating.', label: getLabel(current.staged.version, true), action: restart },
      !current.shellReady && shell && { key: `shell:${shell.versionCode}`, title: 'App update available', text: `Version ${shell.version} · ${size(shell.size)}`, label: getLabel(shell.version), action: () => ota.downloadShell({ downloadOnly: true }) },
      !current.staged && web && { key: `web:${web.version}`, title: 'Update available', text: web.needsShell ? `Install the app update first to get version ${web.version}.` : `Version ${web.version} · ${size(web.size)}`, label: getLabel(web.version), action: web.needsShell ? undefined : () => ota.download() },
    ].filter(Boolean);
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
    const input = section.querySelector('[data-notifications]');
    input.closest('label').hidden = false;
    const readPreference = () => bounded('Reading update notification preference', () => preferences.get({ key }));
    const checkPermission = () => bounded('Checking update notification permission', () => system.checkPermissions());
    const clearSystemNotices = () => system.removeDeliveredNotifications?.({ notifications: [701, 15401, 15402, 15403].map(id => ({ id })) });
    const clearForeground = () => { if (!document.hidden) void Promise.resolve(clearSystemNotices()).catch(() => {}); };
    document.addEventListener('visibilitychange', clearForeground);
    clearForeground();
    input.checked = (await readPreference()).value === 'on';
    input.disabled = false;
    input.onchange = async () => {
      const enable = input.checked;
      input.disabled = true;
      try {
        if (enable) {
          let { display } = await checkPermission();
          if (display === 'prompt' || display === 'prompt-with-rationale') ({ display } = await bounded('Requesting update notification permission', () => system.requestPermissions(), 30000));
          if (display !== 'granted') {
            input.checked = false;
            feedback(section, 'Allow Linebreaker notifications in Android Settings.');
            return;
          }
        }
        await bounded('Saving update notification preference', () => preferences.set({ key, value: enable ? 'on' : 'off' }));
        feedback(section, '');
        if (!enable) await clearSystemNotices();
      } catch {
        input.checked = (await readPreference().catch(() => ({}))).value === 'on';
        feedback(section, 'Could not change Android update notifications.');
      } finally { input.disabled = false; }
    };
  }

  function render(current) {
    const webDownloading = current.webDownloadVersion && current.busy !== false;
    const busy = webDownloading || current.shellDownloading;
    const transfer = webDownloading ? current.webTransfer : current.shellTransfer;
    const percent = busy ? (transfer?.total ? 100 * transfer.done / transfer.total : null) : undefined;
    const items = offers(current);
    const action = items.find(item => item.action);
    const failure = [current.status, current.shellStatus].find(value => /^(Download failed|(?:Shell )?Update processing failed|Install failed|App install failed|Restart failed|Could not apply)|Not enough storage/i.test(value));
    status(busy ? 'Downloading' : failure ? 'Could not update' : current.staged || current.shellReady ? 'Ready to install'
      : current.updateChecks?.failed ? 'Could not check for updates' : items.some(item => item.label) ? 'Update available'
      : current.busy ? 'Checking for updates…' : 'No update ready', percent);
    diagnostics.querySelector('[data-state]').textContent = [current.status, current.shellStatus, current.updateChecks?.summary].filter(Boolean).join(' · ');
    renderPolicy(current.updateSettings);
    setupButton.hidden = current.updateSettings?.setupAnswered !== false;
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
    const releaseVersion = newer(current.shellVersion, bundle.version) ? current.shellVersion : bundle.version;
    const releaseText = (notice?.to === releaseVersion ? notice.notes : null) || (releaseVersion === bundle.version
      ? current.updated?.to === bundle.version && current.updated.notes || bundle.message : current.shellNotes);
    setReleaseNotes(releaseVersion, releaseText, openGitHub);
    releaseInfo = [releaseVersion, releaseText];
    currentAction = !busy && action?.action;
    getUpdate.hidden = !currentAction;
    getUpdate.textContent = action?.label || '';
    notices('android-state', !ready ? [] : busy ? [{
      key: `download:${current.webDownloadVersion || 'app'}`, title: 'Downloading update', text: 'You can keep playing.', percent,
    }] : [failure && { key: `android-error:${failure}`, title: 'Could not update', text: 'Try again from Settings → Updates.', actions: [['Details', openShell]] },
      ...items.filter(item => !localStorage.getItem(`lb149:${item.key}`)).map(item => ({ ...item,
        actions: item.action ? [[item.label, () => run(item.action)]] : [['Details', openShell]],
        dismiss: () => localStorage.setItem(`lb149:${item.key}`, '1'),
      }))]);
    if (ready) showReleaseNotice(releaseVersion, releaseText, {
      upgraded: notice?.to === releaseVersion,
      fallback: openGitHub,
    });
  }
  function refresh() {
    if (!refreshing) refreshing = bounded('Reading Android update state', () => ota.getState()).then(current => {
      state = current;
      if (current.updated?.to === bundle.version && localStorage.getItem('lb149:lastNoticeToken') !== current.token) {
        notice = current.updated;
        localStorage.setItem('lb149:lastNoticeToken', current.token);
      }
      if (shellUpgrade && !notice) notice = { to: shellUpgrade, notes: current.shellNotes };
      shellUpgrade = null;
      render(current);
      return Promise.all([reloadLog(), showCheckNotice(current)]);
    }).finally(() => { refreshing = null; });
    return refreshing;
  }
  async function initialize() {
    startup?.step('Reading Android shell info…');
    const initial = await bounded('Android shell info', () => ota.info());
    state = initial;
    if (initial.webVersion !== bundle.version || !initial.token) throw new Error('Android launch version or token did not match');
    await bounded('First menu frame', () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))), 750).catch(() => {});
    startup?.step('Flushing startup save writes…');
    await bounded('Startup save flush', () => window.flushLinebreakerSave?.());
    startup?.step('Acknowledging Android WebView readiness…');
    if (!(await bounded('Android appReady', () => ota.appReady({ version: bundle.version, token: initial.token, checkNotices: true }))).accepted) throw new Error('Shell rejected readiness');
    startup?.step('Android WebView readiness accepted');
    void window.resumeLinebreakerOtaWrites?.()?.catch(error => console.warn('Could not resume save writes:', error));
    ready = true;
    render(initial);
    shellUpgrade = startupUpgrade(localStorage, 'lb149:shell', initial.shellVersion);
    if (Number.isSafeInteger(initial.runningShellVersionCode)) {
      const previousCode = Number(localStorage.getItem('lb149:shellCode'));
      if (previousCode > 0 && initial.runningShellVersionCode > previousCode) shellUpgrade = initial.shellVersion;
      localStorage.setItem('lb149:shellCode', initial.runningShellVersionCode);
    }
    void mountNotifications().catch(() => feedback(section, 'Android update notifications are unavailable.'));
    await syncSafety();
    await refresh().catch(error => console.warn('Could not read Android update state:', error));
    setInterval(() => { void syncSafety(); void refresh().catch(() => {}); }, 1000);
  }
  attachVersion(bundle.version, openShell);
  const start = () => {
    void Promise.all(['updateAvailable', 'updateStaged', 'updated', 'rolledBack', 'shellUpdateReady', 'updateSettingsChanged']
      .map(event => bounded('Listening for ' + event, () => ota.addListener(event, () => { if (ready) void refresh().catch(() => {}); })))).catch(() => {});
    return initialize().catch(unavailable);
  };
  if (window.linebreakerReadyForUpdates) void start();
  else window.addEventListener('linebreaker-update-ready', start, { once: true });
})();
