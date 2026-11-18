(async () => {
  const capacitor = window.Capacitor;
  const plugin = capacitor?.Plugins?.AppUpdate;
  const menu = document.querySelector('#menu-overlay .menu-scale-wrapper');
  const settings = document.querySelector('#settings-overlay .settings-section');
  if (capacitor?.getPlatform?.() !== 'android' || !plugin || !menu || !settings) return;

  const { version, repo } = await plugin.getInfo();
  const checkInterval = 5 * 60 * 1000;
  const checkTimeout = 10 * 1000;
  const autoKey = 'android-auto-update';
  const cacheKey = `android-update-check:${repo}`;
  const read = key => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, value); } catch { return; }
  };
  const newPanel = (tag, classes, markup) => {
    const element = document.createElement(tag);
    element.className = classes;
    element.innerHTML = markup;
    return element;
  };

  const banner = newPanel('aside', 'lb-android-update lb-card lb-row', `
    <strong data-update-summary></strong>
    <div class="lb-actions">
      <button type="button" class="lb-btn lb-btn--primary" data-update>UPDATE</button>
      <button type="button" class="lb-btn lb-btn--ghost lb-btn--icon" data-dismiss aria-label="Dismiss update banner">✕</button>
    </div>`);
  banner.hidden = true;
  menu.prepend(banner);

  const section = newPanel('section', 'lb-android-update lb-card lb-stack', `
    <h2 class="settings-title">UPDATES</h2>
    <label class="lb-toggle"><input type="checkbox" data-auto> CHECK FOR UPDATES</label>
    <p class="lb-muted" data-current></p>
    <p data-check-status role="status" hidden></p>
    <strong data-update-summary hidden></strong>
    <div class="lb-actions">
      <button type="button" class="lb-btn" data-check>CHECK NOW</button>
      <button type="button" class="lb-btn lb-btn--primary" data-update hidden>GET UPDATE</button>
      <button type="button" class="lb-btn lb-btn--ghost" data-github>GITHUB</button>
    </div>`);
  settings.before(section);

  const overlay = newPanel('div', 'lb-android-update-overlay hidden', `
    <div class="lb-android-update lb-modal lb-stack" role="dialog" aria-modal="true" aria-labelledby="android-update-title">
      <div class="lb-row">
        <h2 id="android-update-title"></h2>
        <button type="button" class="btn-back lb-btn lb-btn--ghost lb-btn--icon" data-close aria-label="Close update dialog">✕</button>
      </div>
      <p data-install-status role="status"></p>
      <progress class="lb-progress" max="100" value="0" aria-label="APK download progress" hidden></progress>
      <p class="lb-muted" data-stats hidden></p>
      <div class="lb-actions" data-recovery hidden>
        <button type="button" class="lb-btn lb-btn--primary" data-retry>TRY AGAIN</button>
        <button type="button" class="lb-btn lb-btn--ghost" data-github>GITHUB</button>
      </div>
    </div>`);
  overlay.id = 'android-update-overlay';
  document.body.append(overlay);

  const auto = section.querySelector('[data-auto]');
  const checkButton = section.querySelector('[data-check]');
  const checkStatus = section.querySelector('[data-check-status]');
  const getUpdate = section.querySelector('[data-update]');
  const title = overlay.querySelector('h2');
  const close = overlay.querySelector('[data-close]');
  const installStatus = overlay.querySelector('[data-install-status]');
  const progress = overlay.querySelector('progress');
  const stats = overlay.querySelector('[data-stats]');
  const recovery = overlay.querySelector('[data-recovery]');
  const retry = overlay.querySelector('[data-retry]');
  const formatSize = bytes => `${(bytes / 1048576).toFixed(1)} MB`;
  const formatSpeed = bytes => bytes < 1048576 ? `${Math.round(bytes / 1024)} KB/s` : `${formatSize(bytes)}/s`;
  const summary = release => `Update ${release.version} · ${formatSize(release.size)}`;
  section.querySelector('[data-current]').textContent = `Current version ${version}`;
  auto.checked = read(autoKey) !== 'off';

  const stableVersion = /^(?:0|[1-9]\d{0,3})(?:\.(?:0|[1-9]\d{0,2})){2}$/;
  const versionCode = value => {
    if (!stableVersion.test(value)) return 0;
    const [major, minor, patch] = value.split('.').map(Number);
    const code = major * 1000000 + minor * 1000 + patch;
    return code <= 2100000000 ? code : 0;
  };
  const current = versionCode(version);
  const cached = (() => {
    try { return JSON.parse(read(cacheKey)); } catch { return null; }
  })();
  let lastCheck = Number.isFinite(cached?.lastCheck) ? cached.lastCheck : 0;
  let lastResult = cached?.result;

  let candidate = lastResult?.release;
  if (!candidate || versionCode(candidate.version) <= current) candidate = null;
  let dismissed = false;
  let checking = false;
  let manualPending = false;
  let lastError = '';
  let installing = false;
  let downloading = false;
  let startedAt;
  let selected;
  let returnFocus;

  function renderRelease() {
    banner.hidden = !candidate || dismissed;
    getUpdate.hidden = !candidate;
    const detail = section.querySelector('[data-update-summary]');
    detail.hidden = !candidate;
    if (candidate) {
      detail.textContent = summary(candidate);
      banner.querySelector('[data-update-summary]').textContent = summary(candidate);
    }
  }

  function reportCheck(message) {
    checkStatus.textContent = message;
    checkStatus.hidden = !message;
  }

  function reportResult(result) {
    if (!result || versionCode(result.latest) <= current) reportCheck(result ? 'Linebreaker is up to date.' : 'Checked recently. Try again in a few minutes.');
    else if (result.release) reportCheck('An Android update is ready to download.');
    else reportCheck('The latest GitHub release does not contain a downloadable Android APK.');
  }

  async function fetchLatestRelease() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), checkTimeout);
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal
      });
      if (response.status === 404) throw new Error('GitHub has no public release for this repository yet.');
      if ([403, 429].includes(response.status)) throw new Error('GitHub is limiting update checks. Try again later.');
      if (!response.ok) throw new Error('GitHub could not provide the latest release. Try again later.');
      const data = await response.json();
      const latest = String(data.tag_name || '').replace(/^[vV]/, '');
      if (!versionCode(latest)) throw new Error('The latest GitHub release has no stable X.Y.Z version tag.');
      const asset = (Array.isArray(data.assets) ? data.assets : []).find(item =>
        /\.apk$/i.test(item?.name) && Number.isSafeInteger(item.size) && item.size > 0
        && typeof item.browser_download_url === 'string');
      return { latest, release: asset ? { version: latest, size: asset.size, url: asset.browser_download_url } : null };
    } catch (error) {
      if (controller.signal.aborted) throw new Error('GitHub did not respond in time. Check your connection and try again.');
      if (error instanceof TypeError) throw new Error('Could not reach GitHub. Check your connection, firewall, or VPN.');
      if (error instanceof SyntaxError) throw new Error('GitHub returned unreadable release details. Try again later.');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async function checkForUpdates(manual = false) {
    if (!manual && !auto.checked) return;
    if (!repo) {
      if (manual) reportCheck('This build has no GitHub release repository configured.');
      return;
    }
    if (checking) {
      if (manual) {
        manualPending = true;
        checkButton.disabled = true;
        reportCheck('Checking for updates…');
      }
      return;
    }
    const now = Date.now();
    if (lastCheck && now >= lastCheck && now - lastCheck < checkInterval) {
      if (manual) {
        if (lastError) reportCheck(`${lastError} Checks run at most every five minutes.`);
        else reportResult(lastResult);
      }
      return;
    }
    checking = true;
    lastCheck = now;
    lastError = '';
    write(cacheKey, JSON.stringify({ lastCheck, result: lastResult }));
    manualPending = manual;
    if (manual) {
      checkButton.disabled = true;
      reportCheck('Checking for updates…');
    }
    try {
      lastResult = await fetchLatestRelease();
      write(cacheKey, JSON.stringify({ lastCheck, result: lastResult }));
      candidate = versionCode(lastResult.latest) > current ? lastResult.release : null;
      renderRelease();
      if (manualPending) reportResult(lastResult);
    } catch (error) {
      lastError = error.message || 'Could not check GitHub for updates. Try again later.';
      if (manualPending) reportCheck(lastError);
    } finally {
      checking = false;
      manualPending = false;
      checkButton.disabled = false;
    }
  }

  function showProgress(done, total) {
    const percent = Math.min(100, Math.floor(100 * done / total));
    const speed = done / Math.max((performance.now() - startedAt) / 1000, 0.1);
    progress.value = percent;
    stats.textContent = `${percent}% · ${formatSize(done)} / ${formatSize(total)} · ${formatSpeed(speed)}`;
  }

  async function applyUpdate(release, trigger) {
    if (!release && !installing) return;
    overlay.classList.remove('hidden');
    if (trigger && !overlay.contains(trigger)) returnFocus = trigger;
    close.focus();
    if (installing) return;
    selected = release;
    installing = true;
    downloading = true;
    startedAt = performance.now();
    title.textContent = summary(release);
    recovery.hidden = true;
    progress.hidden = false;
    stats.hidden = false;
    showProgress(0, release.size);
    installStatus.textContent = 'Downloading the update…';
    try {
      await plugin.download(release);
      downloading = false;
      showProgress(release.size, release.size);
      installStatus.textContent = 'Handing off to Android…';
      await plugin.install(release);
      installStatus.textContent = 'Update installed. Reopen Linebreaker if it does not restart.';
    } catch (error) {
      installStatus.textContent = error?.message || 'Could not install the update.';
      recovery.hidden = false;
    } finally {
      downloading = false;
      installing = false;
    }
  }

  banner.querySelector('[data-dismiss]').onclick = () => { dismissed = true; renderRelease(); };
  for (const button of [banner.querySelector('[data-update]'), getUpdate]) {
    button.onclick = () => applyUpdate(candidate, button);
  }
  close.onclick = () => {
    overlay.classList.add('hidden');
    returnFocus?.focus();
  };
  retry.onclick = () => applyUpdate(selected);
  auto.onchange = () => {
    write(autoKey, auto.checked ? 'on' : 'off');
    if (auto.checked) void checkForUpdates();
  };
  checkButton.onclick = () => checkForUpdates(true);
  for (const panel of [section, overlay]) {
    panel.querySelector('[data-github]').onclick = () => plugin.openReleases().catch(error => {
      if (panel === section) reportCheck(error.message);
      else installStatus.textContent = error.message;
    });
  }

  renderRelease();
  await Promise.all([
    plugin.addListener('downloadProgress', ({ done, total }) => { if (downloading) showProgress(done, total); }),
    plugin.addListener('installState', ({ phase }) => {
      if (!installing) return;
      installStatus.textContent = phase === 'permission'
        ? 'Allow Linebreaker to install unknown apps, then return to continue.'
        : 'Confirm this update in the Android installer.';
    })
  ]);
  void capacitor.Plugins.App.addListener('appStateChange', ({ isActive }) => {
    if (isActive) void checkForUpdates();
  }).catch(console.error);
  void checkForUpdates();
})().catch(console.error);
