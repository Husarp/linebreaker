import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, expect, it, vi } from 'vitest';
import { config } from '../scripts/ota-config.mjs';
import { deltaFiles } from '../scripts/ota-bundle.mjs';

const tools = readFileSync(new URL('../update-tools.js', import.meta.url), 'utf8');
const source = readFileSync(new URL('../ota-android.js', import.meta.url), 'utf8');
const watchdog = readFileSync(new URL('../boot.js', import.meta.url), 'utf8');
const windows = [];
const flush = () => new Promise(resolve => setImmediate(resolve));
const defaults = { setupAnswered: true, smallFixes: true, majorUpdates: false, shellUpdates: true, wifiLimitMb: 20, mobileLimitMb: 5, checkFrequency: '6h' };

async function boot({ platform = 'android', native = {}, version = '0.1.1', safe = true, saved = {}, plugins = {}, startup = false, briefTimers = [] } = {}) {
  const { window } = new JSDOM('<main id="menu-overlay"></main><div id="settings-updates"><section id="settings-whats-new"></section></div><span data-update-version></span>', {
    url: 'https://localhost/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  windows.push(window);
  const schedule = window.setTimeout.bind(window);
  window.setTimeout = (action, ms) => ms === 5000 ? briefTimers.push(action) : schedule(action, ms);
  Object.entries(saved).forEach(([key, value]) => window.localStorage.setItem(key, value));
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  const state = { token: 'session', webVersion: version, shellVersion: '0.1.0', shellApi: 1,
    status: 'Ready', shellStatus: 'No shell update', updateSettings: { ...defaults }, ...native };
  const callbacks = new Map();
  const frames = [];
  window.requestAnimationFrame = callback => frames.push(callback);
  window.linebreakerCanInterrupt = () => safe;
  window.resumeLinebreakerOtaWrites = vi.fn(async () => {});
  const ota = {
    addListener: vi.fn(async (type, callback) => callbacks.set(type, callback)),
    info: vi.fn(async () => state), getState: vi.fn(async () => state),
    setSafeToInterrupt: vi.fn(async () => {}), appReady: vi.fn(async () => ({ accepted: true })),
    setUpdateSettings: vi.fn(async partial => Object.assign(state.updateSettings, partial)),
    download: vi.fn(async () => {}), downloadShell: vi.fn(async () => {}), restart: vi.fn(async () => {}), installShell: vi.fn(async () => {}), check: vi.fn(async () => {}),
    claimCheckNotice: vi.fn(async () => ({})),
  };
  window.Capacitor = { getPlatform: () => platform, Plugins: { Ota: ota, ...plugins } };
  window.BUNDLE = { version };
  if (startup) {
    const schedule = window.setTimeout.bind(window);
    window.setTimeout = (action, ms) => schedule(action, ms === 3000 ? 10 : ms);
    window.eval(watchdog);
    window.LBStartup.finish();
  }
  window.eval(tools);
  window.eval(source);
  return { window, ota, frames, state, setSafe: value => { safe = value; },
    get: selector => window.document.querySelector(selector),
    click: text => Array.from(window.document.querySelectorAll('button')).find(button => button.textContent === text).click(),
    emit: (type, data) => callbacks.get(type)?.(data),
    async redraw() { callbacks.get('updateStateChanged')?.(); await flush(); },
    async restoreSave() { window.dispatchEvent(new window.Event('linebreaker-update-ready')); await flush(); },
    async ready() { frames.shift()?.(); frames.shift()?.(); await flush(); },
  };
}

afterEach(() => { while (windows.length) windows.pop().close(); });

it('separates Android channels from the stable desktop/installer release', () => {
  expect(config.appId).toBe('com.husarp.linebreaker');
  expect(config.urls.bundle).toBe('https://github.com/Husarp/linebreaker/releases/download/channel/manifest.json');
  expect(config.urls.shell).toBe('https://github.com/Husarp/linebreaker/releases/download/shell-channel/shell.json');
  expect(config.bundle.sourceDir).toBe('dist-web');
});

it('stages reverted file content when any supported APK embeds different bytes', () => {
  const shared = { path: 'index.html', sha256: 'shared' };
  const reverted = { path: 'style.css', sha256: 'old' };
  const added = { path: 'new.js', sha256: 'new' };
  const first = [shared, reverted];
  const second = [shared, { ...reverted, sha256: 'different' }, { path: 'removed.js', sha256: 'removed' }];
  expect(deltaFiles([shared, reverted, added], [first, second])).toEqual([reverted, added]);
});

it('only mounts with Android OTA native support', async () => {
  const game = await boot({ platform: 'web' });
  await game.restoreSave();
  expect(game.ota.info).not.toHaveBeenCalled();
  expect(game.get('.lb184-banner')?.hidden ?? true).toBe(true);
});

it('acknowledges the actual bundle and native token only after save restoration and two frames', async () => {
  const game = await boot();
  expect(game.ota.info).not.toHaveBeenCalled();
  await game.restoreSave();
  expect(game.ota.addListener).toHaveBeenCalledTimes(7);
  game.frames.shift()();
  expect(game.ota.appReady).not.toHaveBeenCalled();
  expect(game.window.resumeLinebreakerOtaWrites).not.toHaveBeenCalled();
  game.frames.shift()();
  await flush();
  expect(game.ota.appReady).toHaveBeenCalledWith({ version: '0.1.1', token: 'session', checkNotices: true });
  expect(game.window.resumeLinebreakerOtaWrites).toHaveBeenCalledOnce();
});

it('suppresses background connection failures and shows retry and help after a manual check', async () => {
  const message = "Can't check for updates — connection blocked (firewall?)";
  const game = await boot({ native: { updateChecks: { noticePending: true, failed: true, summary: message } } });
  game.ota.claimCheckNotice.mockImplementationOnce(async () => {
    game.state.updateChecks.noticePending = false;
    return { message };
  });
  await game.restoreSave();
  expect(game.ota.claimCheckNotice).not.toHaveBeenCalled();
  await game.ready();
  expect(game.ota.claimCheckNotice).toHaveBeenCalledWith({ token: 'session' });
  const notice = game.get('.lb184-banner');
  expect(notice.hidden).toBe(true);
  game.ota.check.mockImplementationOnce(async () => { game.state.updateChecks.noticePending = true; });
  game.ota.claimCheckNotice.mockResolvedValueOnce({}).mockImplementationOnce(async () => {
    game.state.updateChecks.noticePending = false;
    return { message };
  });
  game.get('[data-section-actions] button').click();
  await game.redraw();
  expect(game.ota.check).toHaveBeenCalledOnce();
  expect(notice.hidden).toBe(false);
  expect(notice.querySelector('[data-title]').textContent).toBe('Could not check for updates');
  expect(notice.textContent).not.toContain('firewall');
  notice.querySelector('[data-actions] button:nth-child(2)').click();
  expect(game.get('dialog[aria-label="Update check help"]').open).toBe(true);
  game.get('dialog[aria-label="Update check help"] [data-close]').click();
  expect(game.get('.lb149-settings [data-status]').textContent).toBe('Could not check for updates');
  expect(game.get('.lb149-settings details')).toBeNull();
  expect(game.get('[data-policy] input')).not.toBeNull();
  game.state.updateChecks = { summary: 'Last checked: 10:05 AM' };
  await game.redraw();
  expect(game.get('.lb149-settings [data-status]').textContent).toBe('No update ready');
  expect(game.get('[data-section-actions] button').textContent).toBe('Check for updates');
});

it('never marks a mismatched web bundle ready', async () => {
  const game = await boot({ native: { webVersion: '0.2.0' } });
  await game.restoreSave();
  await game.ready();
  expect(game.ota.appReady).not.toHaveBeenCalled();
  expect(game.window.resumeLinebreakerOtaWrites).not.toHaveBeenCalled();
});

it('acknowledges readiness without forcing an unanswered setup dialog or hiding a shell offer', async () => {
  const game = await boot({ native: { updateSettings: { ...defaults, setupAnswered: false }, shellAvailable: { version: '1.0.3', versionCode: 1003, size: 100 } } });
  await game.restoreSave();
  expect(game.get('dialog[open]')).toBeNull();
  await game.ready();
  expect(game.ota.appReady).toHaveBeenCalledOnce();
  expect(game.get('dialog[open]')).toBeNull();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('App update 1.0.3 · 100 B');
  expect(game.get('.lb184-banner [data-actions] button').textContent).toBe('Download update 1.0.3');
  expect(game.ota.setSafeToInterrupt).toHaveBeenLastCalledWith({ safe: true });
  game.click('Finish update setup');
  expect(game.get('dialog[open]').getAttribute('aria-label')).toBe('How should updates work?');
  expect(game.ota.setSafeToInterrupt).toHaveBeenLastCalledWith({ safe: false });
  game.click('Recommended');
  await flush();
  expect(game.ota.setUpdateSettings).toHaveBeenCalledWith(defaults);
  expect(game.ota.setSafeToInterrupt).toHaveBeenLastCalledWith({ safe: true });
});

it('does not resume writes or offer setup when the shell ignores a ready signal', async () => {
  const game = await boot({ native: { updateSettings: { ...defaults, setupAnswered: false } } });
  game.ota.appReady.mockResolvedValue({ accepted: false });
  await game.restoreSave();
  await game.ready();
  expect(game.ota.appReady).toHaveBeenCalledOnce();
  expect(game.window.resumeLinebreakerOtaWrites).not.toHaveBeenCalled();
  expect(game.get('dialog[open]')).toBeNull();
});

it('reports a stalled OTA bridge and never resumes unconfirmed trial writes', async () => {
  const game = await boot({ startup: true, native: { trial: true } });
  game.ota.info.mockImplementation(() => new Promise(() => {}));
  await game.restoreSave();
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(game.ota.appReady).not.toHaveBeenCalled();
  expect(game.window.resumeLinebreakerOtaWrites).not.toHaveBeenCalled();
  expect(game.get('.lb184-banner').textContent).toContain('Saving is paused');
  expect(game.get('dialog[open]')).toBeNull();
});

it('acknowledges readiness and retains notes when Preferences never replies', async () => {
  const preferences = { get: vi.fn(() => new Promise(() => {})) };
  const game = await boot({ startup: true, plugins: { Preferences: preferences, LocalNotifications: {} },
    native: { updateSettings: { ...defaults, setupAnswered: false }, updated: { to: '0.1.1', notes: 'New notes' } } });
  await game.restoreSave();
  await game.ready();
  expect(game.ota.appReady).toHaveBeenCalledOnce();
  expect(game.window.resumeLinebreakerOtaWrites).toHaveBeenCalledOnce();
  expect(preferences.get).toHaveBeenCalledOnce();
  expect(game.get('dialog[data-release-notes][open] [data-notes]').textContent).toBe('New notes');
  expect(game.get('.lb184-banner').hidden).toBe(true);
});

it('exposes Android policy and shell actions directly in the Updates section', async () => {
  const game = await boot();
  await game.restoreSave();
  await game.ready();
  const section = game.get('.lb149-settings');
  expect(section.querySelector('[data-get]').hidden).toBe(true);
  expect(section.querySelector('.lb184-toolbar button:last-child').textContent).toBe('GitHub releases');
  expect(section.querySelector('.lb184-toolbar button:last-child svg')).not.toBeNull();
  expect(section.firstElementChild.matches('.lb184-toolbar')).toBe(true);
  section.querySelector('[data-auto]').click();
  await flush();
  expect(game.ota.setUpdateSettings).toHaveBeenLastCalledWith({ checkFrequency: 'manual' });
  expect(section.querySelector('select, [data-address]')).toBeNull();
  const mobile = section.querySelector('[role="group"][aria-label="Mobile download limit"] button');
  mobile.click();
  await flush();
  expect(game.ota.setUpdateSettings).toHaveBeenLastCalledWith({ mobileLimitMb: 0 });
  expect(mobile.getAttribute('aria-pressed')).toBe('true');
  game.click('Check for updates');
  await flush();
  expect(game.ota.check).toHaveBeenCalledOnce();
  game.click('Open app shell');
  expect(game.get('dialog[open]').getAttribute('aria-label')).toBe('Update logs');
  expect(game.get('dialog[open] [data-address]').readOnly).toBe(true);
});

it('opts into background notices without scheduling any in the foreground and clears only update IDs', async () => {
  const preferences = { get: vi.fn(async () => ({ value: null })), set: vi.fn(async () => {}) };
  let display = 'prompt';
  const system = {
    checkPermissions: vi.fn(async () => ({ display })), requestPermissions: vi.fn(async () => ({ display: (display = 'granted') })),
    schedule: vi.fn(async () => {}), removeDeliveredNotifications: vi.fn(async () => {}),
  };
  const game = await boot({ native: { available: { version: '0.1.2', size: 500 }, updated: { to: '0.1.1' } },
    plugins: { Preferences: preferences, LocalNotifications: system } });
  await game.restoreSave();
  await game.ready();
  expect(system.requestPermissions).not.toHaveBeenCalled();
  const input = game.get('[data-notifications]');
  input.click();
  await flush();
  expect(system.requestPermissions).toHaveBeenCalledOnce();
  await game.redraw();
  expect(system.schedule).not.toHaveBeenCalled();
  expect(system.removeDeliveredNotifications).toHaveBeenCalledOnce();
  game.window.document.dispatchEvent(new game.window.Event('visibilitychange'));
  expect(system.removeDeliveredNotifications).toHaveBeenCalledTimes(2);
  input.click();
  await flush();
  expect(preferences.set).toHaveBeenLastCalledWith({ key: 'linebreaker-update-notifications', value: 'off' });
  expect(system.removeDeliveredNotifications).toHaveBeenLastCalledWith({ notifications: [{ id: 701 }, { id: 15401 }, { id: 15402 }, { id: 15403 }] });
});

it('never restarts automatically and guards the versioned install action during play', async () => {
  const game = await boot({ safe: false, native: { staged: { version: '0.2.0' }, autoRestart: true } });
  await game.restoreSave(); await game.ready();
  expect(game.get('.lb184-banner [data-actions] button').textContent).toBe('Install update 0.2.0');
  game.get('.lb149-settings [data-get]').click();
  await flush();
  expect(game.ota.restart).not.toHaveBeenCalled();
  game.setSafe(true);
  await game.redraw();
  await game.window.LBAndroidUpdates.syncSafety();
  expect(game.ota.setSafeToInterrupt).toHaveBeenLastCalledWith({ safe: true });
  expect(game.ota.restart).not.toHaveBeenCalled();
  game.get('.lb149-settings [data-get]').click();
  await flush();
  expect(game.ota.restart).toHaveBeenCalledOnce();
});

it('keeps dismissal scoped to the offered version and shows when the app needs updating first', async () => {
  const game = await boot({ native: { available: { version: '0.2.0', size: 2048 } } });
  await game.restoreSave(); await game.ready();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Update 0.2.0 · 2.0 kB');
  game.get('.lb184-banner [data-dismiss]').click(); await game.redraw();
  expect(game.get('.lb184-banner').hidden).toBe(true);
  game.state.available = { version: '0.3.0', needsShell: true };
  await game.redraw();
  expect(game.get('.lb184-banner').textContent).toContain('Install the app update first');
  expect(game.get('.lb184-banner [data-actions] button').textContent).toBe('Details');
  expect(game.ota.download).not.toHaveBeenCalled();
});

it('does not show a made-up number when an older shell omits offer size', async () => {
  const game = await boot({ native: { available: { version: '0.2.0' } } });
  await game.restoreSave(); await game.ready();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Update 0.2.0');
});

it('shows literal release notes once without a duplicate installed banner, then resumes queued offers', async () => {
  const updated = { to: '0.1.1', notes: '<img src=fake>\nNew theme' };
  const game = await boot({ native: { updated, available: { version: '0.2.0', size: 12 } } });
  await game.restoreSave(); await game.ready();
  const banner = game.get('.lb184-banner');
  expect(banner.hidden).toBe(true);
  expect(game.get('[data-notes]').textContent).toBe(updated.notes);
  expect(game.get('[data-notes] img')).toBeNull();
  expect(game.get('[data-release-notes] .lb-block-topbar .lb-topbar-crumb > h1.lb-topbar-title').textContent).toBe("What's new");
  expect(game.get('[data-release-notes] .lb-topbar-kicker').textContent).toBe('Version 0.1.1');
  expect(game.get('[data-release-notes] header button').textContent).toBe('Details');
  game.get('[data-release-notes] [data-close]').click();
  expect(banner.querySelector('[data-title]').textContent).toBe('Update 0.2.0 · 12 B');
  const reopened = await boot({ native: { updated }, saved: Object.fromEntries(Object.entries(game.window.localStorage)) });
  await reopened.restoreSave(); await reopened.ready();
  expect(reopened.get('.lb184-banner').hidden).toBe(true);
  expect(reopened.get('#settings-whats-new .lb-block-topbar .lb-topbar-crumb > h2.lb-topbar-title').textContent).toBe("What's new");
  expect(reopened.get('#settings-whats-new').textContent).toContain(updated.notes);
});

it('keeps progress in the same slot and switches Download to Install when ready', async () => {
  const game = await boot({ native: { available: { version: '0.2.0', size: 100 } } });
  await game.restoreSave(); await game.ready();
  const button = game.get('.lb149-settings [data-get]');
  expect(button.textContent).toBe('Download update 0.2.0');
  button.click(); await flush();
  expect(game.ota.download).toHaveBeenCalledWith({ downloadOnly: true });
  Object.assign(game.state, { available: null, webDownloadVersion: '0.2.0', busy: true, webTransfer: { done: 42, total: 100, speed: 2_400_000 } });
  await game.redraw();
  const progress = game.get('.lb149-settings progress');
  expect(progress.value).toBe(42);
  expect(game.get('.lb149-settings [data-percent]').textContent).toBe('42%');
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Downloading update');
  expect(game.get('.lb184-banner [data-speed]').textContent).toBe('2.4 MB/s');
  Object.assign(game.state, { busy: false, staged: { version: '0.2.0' } });
  await game.redraw();
  expect(progress.hidden).toBe(true);
  expect(button.textContent).toBe('Install update 0.2.0');
  expect(game.get('.lb184-banner [data-actions] button').textContent).toBe(button.textContent);
});

it.each(['bundle', 'apk'])('runs 1.4.0 → 1.4.1 for a %s without hiding or replaying earlier phases', async kind => {
  const from = '1.4.0', version = '1.4.1';
  const apk = kind === 'apk';
  const offer = apk ? { shellAvailable: { version, versionCode: 1401, size: 7_600_000 } } : { available: { version, size: 7_600_000 } };
  const staged = apk ? { shellReady: offer.shellAvailable } : { staged: { version } };
  const game = await boot({ version: from, native: { shellVersion: from, runningShellVersionCode: 1400, ...offer } });
  const animate = vi.fn();
  game.window.Element.prototype.animate = animate;
  await game.restoreSave(); await game.ready();
  const banner = game.get('.lb184-banner');
  const expectBanner = (title, label) => {
    expect(game.get('.lb184-banner')).toBe(banner);
    expect(banner.hidden).toBe(false);
    expect(banner.querySelector('[data-title]').textContent).toBe(title);
    expect(banner.querySelector('[data-actions] button')?.textContent).toBe(label);
  };
  expectBanner(`${apk ? 'App update' : 'Update'} ${version} · 7.6 MB`, `Download update ${version}`);
  banner.querySelector('[data-actions] button').click();
  expectBanner('Downloading update');
  await game.redraw();
  expectBanner('Downloading update');
  expect(apk ? game.ota.downloadShell : game.ota.download).toHaveBeenCalledExactlyOnceWith({ downloadOnly: true });

  const transfer = { done: 42, total: 100 };
  const downloading = apk ? { shellDownloadVersion: version, shellDownloading: true, shellTransfer: transfer }
    : { webDownloadVersion: version, busy: true, webTransfer: transfer };
  Object.assign(game.state, downloading);
  await game.redraw();
  expectBanner('Downloading update');
  expect(banner.querySelector('progress').value).toBe(42);
  transfer.done = 21;
  await game.redraw();
  expect(banner.querySelector('progress').value).toBe(42);
  Object.assign(game.state, { shellDownloadVersion: null, shellDownloading: false, busy: false, webDownloadVersion: null });
  await game.redraw();
  expectBanner('Downloading update');
  Object.assign(game.state, staged);
  await game.redraw();
  const readyTitle = apk ? 'App update ready' : 'Update ready';
  expectBanner(readyTitle, `Install update ${version}`);
  Object.assign(game.state, downloading, { shellReady: null, staged: null });
  game.emit('updateAvailable', { version });
  await game.redraw();
  expectBanner(readyTitle, `Install update ${version}`);

  banner.querySelector('[data-actions] button').click();
  expectBanner('Installing…');
  await game.redraw();
  expectBanner('Installing…');
  expect(apk ? game.ota.installShell : game.ota.restart).toHaveBeenCalledOnce();
  Object.assign(game.state, staged, { installingVersion: version });
  game.emit(apk ? 'shellUpdateReady' : 'updateStaged', { version });
  await game.redraw();
  Object.assign(game.state, offer, { installingVersion: null, shellReady: null, staged: null });
  await game.redraw();
  expectBanner('Installing…');
  game.ota.getState.mockResolvedValue({ token: 'next-launch', ...offer });
  await game.redraw();
  expectBanner('Installing…');
  expect(animate).toHaveBeenCalledTimes(1);

  const briefTimers = [];
  const saved = Object.fromEntries(Object.entries(game.window.localStorage));
  const next = await boot({ version, saved, briefTimers, native: { ...offer, ...staged, ...downloading, token: 'next-launch',
    shellVersion: apk ? version : from, runningShellVersionCode: apk ? 1401 : 1400, updated: apk ? undefined : { to: version },
    installingVersion: version, installingChannel: apk ? 'shell' : 'web', installingShellVersionCode: apk ? 1401 : undefined } });
  await next.restoreSave(); await next.ready();
  next.emit('updated', { to: version });
  await next.redraw();
  expect(next.get('[data-release-notes][open] .lb-topbar-kicker').textContent).toBe(`Version ${version}`);
  expect(briefTimers).toHaveLength(0);
  next.get('[data-release-notes] [data-close]').click();
  expect(next.get('.lb184-banner').hidden).toBe(true);
});

it('keeps an accepted install visible if its first state refresh fails', async () => {
  const game = await boot({ version: '1.4.0', native: { staged: { version: '1.4.1' } } });
  await game.restoreSave(); await game.ready();
  game.ota.getState.mockRejectedValueOnce(new Error('Bridge busy during restart'));
  game.click('Install update 1.4.1');
  await flush();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Installing…');
  await game.redraw();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Installing…');
});

it('unlocks a staged APK after Android rejects the install permission', async () => {
  const version = '1.4.1';
  const game = await boot({ version: '1.4.0', native: { shellVersion: '1.4.0', shellReady: { version, versionCode: 1401 } } });
  await game.restoreSave(); await game.ready();
  game.click(`Install update ${version}`);
  await game.redraw();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Installing…');
  game.state.shellStatus = 'App install failed: Android install permission was not granted';
  await game.redraw();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Could not update');
  game.get('.lb184-banner [data-dismiss]').click();
  expect(game.get('.lb184-banner [data-actions] button').textContent).toBe(`Install update ${version}`);
  game.click(`Install update ${version}`);
  Object.assign(game.state, { installingVersion: version, installingChannel: 'shell', shellStatus: `Installing app ${version}` });
  await game.redraw();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Installing…');
  Object.assign(game.state, { installingVersion: null, shellStatus: 'App install failed: Android install permission was not granted' });
  await game.redraw();
  expect(game.get('.lb184-banner [data-actions] button').textContent).toBe(`Install update ${version}`);
});

it.each(['bundle', 'apk'])('keeps the %s install banner visible through duplicate events and the handoff', async kind => {
  const version = '1.4.0';
  const offer = kind === 'apk' ? { shellReady: { version, versionCode: 1400 } } : { staged: { version } };
  const game = await boot({ native: offer });
  await game.restoreSave(); await game.ready();
  const banner = game.get('.lb184-banner');
  banner.querySelector('[data-actions] button').click();
  expect(banner.hidden).toBe(false);
  expect(banner.querySelector('[data-title]').textContent).toBe('Installing…');
  await flush();
  expect(kind === 'apk' ? game.ota.installShell : game.ota.restart).toHaveBeenCalledOnce();
  Object.assign(game.state, { installingVersion: version, shellDownloading: true, available: { version } });
  await game.redraw();
  expect(banner.querySelector('[data-title]').textContent).toBe('Installing…');
  expect(banner.querySelector('[data-dismiss]').hidden).toBe(true);
  const title = banner.querySelector('[data-title]').firstChild;
  game.emit('updateAvailable', { version });
  game.emit('shellUpdateReady', { version });
  await flush();
  expect(banner.querySelector('[data-title]').firstChild).toBe(title);
  game.ota.getState.mockResolvedValue({ token: 'next-launch', available: { version } });
  await game.redraw();
  expect(banner.querySelector('[data-title]').textContent).toBe('Installing…');
});

it('reads a new snapshot if the install event arrives during an older state read', async () => {
  const game = await boot({ native: { shellReady: { version: '1.4.0', versionCode: 1400 } } });
  await game.restoreSave(); await game.ready();
  let resolve;
  game.ota.getState.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  game.emit('updateStateChanged');
  game.emit('updateStateChanged');
  resolve({ ...game.state });
  game.state.installingVersion = '1.4.0';
  await flush();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Installing…');
});

it('expires the completion notice and does not reopen it or offer the installed version after restart', async () => {
  const briefTimers = [], version = '1.4.2';
  const native = { updated: { to: version }, available: { version }, staged: { version } };
  const game = await boot({ version, native, briefTimers });
  await game.restoreSave(); await game.ready();
  const banner = game.get('.lb184-banner');
  expect(banner.querySelector('[data-title]').textContent).toBe(`Updated to ${version}`);
  await game.redraw();
  expect(briefTimers).toHaveLength(1);
  const saved = Object.fromEntries(Object.entries(game.window.localStorage));
  briefTimers[0]();
  expect(banner.hidden).toBe(true);
  const restarted = await boot({ version, native: { ...native, token: 'second-start' }, saved });
  await restarted.restoreSave(); await restarted.ready();
  expect(restarted.get('.lb184-banner').hidden).toBe(true);
});
