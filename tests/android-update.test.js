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

async function boot({ platform = 'android', native = {}, version = '0.1.1', safe = true, saved = {}, plugins = {}, startup = false } = {}) {
  const { window } = new JSDOM('<main id="menu-overlay"></main><div id="settings-updates"><section id="settings-whats-new"></section></div><span data-update-version></span>', {
    url: 'https://localhost/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  windows.push(window);
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
    download: vi.fn(async () => {}), restart: vi.fn(async () => {}), check: vi.fn(async () => {}),
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
    async redraw() { callbacks.get('updateAvailable')?.(); await flush(); },
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
  expect(game.ota.addListener).toHaveBeenCalledTimes(6);
  game.frames.shift()();
  expect(game.ota.appReady).not.toHaveBeenCalled();
  expect(game.window.resumeLinebreakerOtaWrites).not.toHaveBeenCalled();
  game.frames.shift()();
  await flush();
  expect(game.ota.appReady).toHaveBeenCalledWith({ version: '0.1.1', token: 'session', checkNotices: true });
  expect(game.window.resumeLinebreakerOtaWrites).toHaveBeenCalledOnce();
});

it('shows a plain-language check failure with retry and help after game readiness', async () => {
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
  expect(notice.hidden).toBe(false);
  expect(notice.querySelector('[data-title]').textContent).toBe('Could not check for updates');
  expect(notice.textContent).not.toContain('firewall');
  notice.querySelector('[data-actions] button:nth-child(2)').click();
  expect(game.get('dialog[aria-label="Update check help"]').open).toBe(true);
  game.get('dialog[aria-label="Update check help"] [data-close]').click();
  game.get('[data-section-actions] button').click();
  await game.redraw();
  expect(game.ota.check).toHaveBeenCalledOnce();
  expect(game.ota.claimCheckNotice).toHaveBeenCalledOnce();
  expect(notice.hidden).toBe(true);
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
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('App update available');
  expect(game.get('.lb184-banner [data-actions] button').textContent).toBe('Get update 1.0.3');
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
  expect(game.get('dialog[open]')).toBeNull();
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Update installed');
});

it('exposes Android policy and shell actions directly in the Updates section', async () => {
  const game = await boot();
  await game.restoreSave();
  await game.ready();
  const section = game.get('.lb149-settings');
  expect(section.querySelector('h2').textContent).toBe('Updates');
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
  expect(game.get('.lb184-banner').textContent).toContain('2.0 KiB');
  game.get('.lb184-banner [data-dismiss]').click(); await game.redraw();
  expect(game.get('.lb184-banner').hidden).toBe(true);
  game.state.available = { version: '0.3.0', needsShell: true };
  await game.redraw();
  expect(game.get('.lb184-banner').textContent).toContain('Install the app update first');
  expect(game.get('.lb184-banner [data-actions] button').textContent).toBe('Details');
  expect(game.ota.download).not.toHaveBeenCalled();
});

it('queues the installed banner with an offer and shows literal release notes only once', async () => {
  const updated = { to: '0.1.1', notes: '<img src=fake>\nNew theme' };
  const game = await boot({ native: { updated, available: { version: '0.2.0', size: 12 } } });
  await game.restoreSave(); await game.ready();
  const banner = game.get('.lb184-banner');
  expect(banner.querySelector('[data-title]').textContent).toBe('Update available');
  banner.querySelector('[data-dismiss]').click();
  expect(banner.querySelector('[data-title]').textContent).toBe('Update installed');
  banner.querySelector('[data-actions] button').click();
  expect(game.get('[data-notes]').textContent).toBe(updated.notes);
  expect(game.get('[data-notes] img')).toBeNull();
  const reopened = await boot({ native: { updated }, saved: Object.fromEntries(Object.entries(game.window.localStorage)) });
  await reopened.restoreSave(); await reopened.ready();
  expect(reopened.get('.lb184-banner').hidden).toBe(true);
  expect(reopened.get('#settings-whats-new').textContent).toContain(updated.notes);
});

it('keeps progress in the same slot and switches Get to Install when ready', async () => {
  const game = await boot({ native: { available: { version: '0.2.0', size: 100 } } });
  await game.restoreSave(); await game.ready();
  const button = game.get('.lb149-settings [data-get]');
  expect(button.textContent).toBe('Get update 0.2.0');
  Object.assign(game.state, { available: null, webDownloadVersion: '0.2.0', busy: true, webTransfer: { done: 42, total: 100 } });
  await game.redraw();
  const progress = game.get('.lb149-settings progress');
  expect(progress.value).toBe(42);
  expect(game.get('.lb149-settings [data-percent]').textContent).toBe('42%');
  expect(game.get('.lb184-banner [data-title]').textContent).toBe('Downloading update');
  Object.assign(game.state, { busy: false, staged: { version: '0.2.0' } });
  await game.redraw();
  expect(progress.hidden).toBe(true);
  expect(button.textContent).toBe('Install update 0.2.0');
  expect(game.get('.lb184-banner [data-actions] button').textContent).toBe(button.textContent);
});
