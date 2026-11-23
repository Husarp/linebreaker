import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, expect, it, vi } from 'vitest';
import { readVersions, stableVersion } from '../scripts/desktop-release-config.mjs';

const script = readFileSync(new URL('../update-ui.js', import.meta.url), 'utf8');
const tools = readFileSync(new URL('../update-tools.js', import.meta.url), 'utf8');
const info = { enabled: true, version: '0.9.0', releases: 'https://github.com/owner/repo/releases' };
const newer = { version: '0.10.0', size: 2 * 1048576 };
const windows = [];
afterEach(() => windows.splice(0).forEach(window => window.close()));

async function launch(hook, preferences, saved = {}) {
  const { window } = new JSDOM('<main id="menu-overlay"><canvas></canvas></main><main id="settings-updates"><section id="settings-whats-new"></section></main>',
    { url: 'https://linebreaker.test', runScripts: 'outside-only' });
  windows.push(window);
  let time = 0;
  Object.defineProperty(window.performance, 'now', { value: () => time });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
  window.openSettings = () => {};
  window.linebreakerReadyForUpdates = true;
  window.linebreakerCanInterrupt = () => true;
  Object.entries(saved).forEach(([key, value]) => window.localStorage.setItem(key, value));
  if (preferences) window.localStorage.setItem('desktop-auto-update', preferences);
  const invoke = vi.fn(async (command, args) => {
    if (command === 'desktop_smoke_ready') return false;
    if (command === 'desktop_update_info') return info;
    return hook(command, args);
  });
  window.__TAURI__ = { core: { invoke, Channel: class {} } };
  window.eval(tools);
  window.eval(script);
  await settle();
  return {
    select: selector => window.document.querySelector(selector), invoke, window,
    focus: () => window.dispatchEvent(new window.Event('focus')), advance: ms => { time += ms; }
  };
}

const settle = () => new Promise(resolve => setImmediate(resolve));
const checks = invoke => invoke.mock.calls.filter(([command]) => command === 'check_desktop_update');

it('throttles automatic checks, allows manual checks, and remembers a dismissed version across restarts', async () => {
  const game = await launch(() => newer);
  const banner = game.select('.lb184-banner');
  expect(banner.hidden).toBe(false);
  expect(banner.textContent).toContain('0.10.0');
  game.select('[data-dismiss]').click();
  game.focus();
  game.select('[data-check]').click();
  await settle();
  expect(checks(game.invoke)).toHaveLength(2);
  game.advance(5 * 60 * 1000);
  game.focus();
  await settle();
  expect(checks(game.invoke)).toHaveLength(3);
  expect(banner.hidden).toBe(true);
  expect(game.select('[data-get]').hidden).toBe(false);
  const restarted = await launch(() => newer, undefined, Object.fromEntries(Object.entries(game.window.localStorage)));
  expect(restarted.select('.lb184-banner').hidden).toBe(true);
});

it('honors automatic-check opt-out and uses plain language for check failures', async () => {
  const offline = () => { throw Error('Low-level network error'); };
  const automatic = await launch(offline);
  expect(automatic.select('.lb184-banner [data-title]').textContent).toBe('Could not check for updates');
  const manual = await launch(offline, 'off');
  manual.focus();
  await settle();
  expect(checks(manual.invoke)).toHaveLength(0);
  manual.select('[data-check]').click();
  await settle();
  expect(checks(manual.invoke)).toHaveLength(1);
  expect(manual.select('.lb184-banner [data-detail]').textContent).toBe('Check your connection and try again.');
});

it('downloads with stable progress, retries, and waits for an explicit install and save flush', async () => {
  let attempts = 0;
  let releaseSave;
  const game = await launch((command, args) => {
    if (command === 'check_desktop_update') return newer;
    if (command === 'download_desktop_update') {
      if (++attempts === 1) throw Error('Download failed');
      game.advance(1000);
      args.onProgress.onmessage({ done: 1048576, total: newer.size });
      expect(game.select('.lb149-settings [data-status]').textContent).toBe('Downloading');
      expect(game.select('.lb149-settings [data-percent]').textContent).toBe('50%');
      expect(game.select('.lb184-banner [data-speed]').textContent).toBe('1.0 MB/s');
    }
  });
  game.window.flushLinebreakerSave = () => new Promise(resolve => { releaseSave = resolve; });
  expect(game.select('.lb184-banner [data-detail]').textContent).toBe('Version 0.10.0 · 2.0 MiB');
  const action = game.select('[data-get]');
  expect(action.textContent).toBe('Download update 0.10.0');
  action.click();
  await settle();
  expect(game.select('.lb184-banner [data-title]').textContent).toBe('Could not update');
  expect(game.invoke.mock.calls.some(([command]) => command === 'plugin:opener|open_url')).toBe(false);
  game.select('.lb184-banner [data-dismiss]').click();
  action.click();
  await settle();
  expect(action.textContent).toBe('Install update 0.10.0');
  expect(game.invoke.mock.calls.some(([command]) => command === 'install_desktop_update')).toBe(false);
  action.click();
  await settle();
  expect(game.invoke.mock.calls.some(([command]) => command === 'install_desktop_update')).toBe(false);
  releaseSave();
  await settle();
  expect(game.invoke).toHaveBeenLastCalledWith('install_desktop_update', { version: newer.version });
});

it('shows the Windows release sheet once, suppresses competing notices, and retains notes in Settings', async () => {
  const saved = { 'lb149:desktop': '0.8.0', 'lb149:desktop-pending-notes:version': '0.9.0', 'lb149:desktop-pending-notes': '<b>New</b>' };
  const upgraded = await launch(() => null, 'off', saved);
  const persisted = game => Object.fromEntries(Object.entries(game.window.localStorage));
  const notice = upgraded.select('.lb184-banner');
  expect(notice.hidden).toBe(true);
  expect(upgraded.select('[data-notes]').textContent).toBe('<b>New</b>');
  upgraded.select('[data-release-notes] [data-close]').click();
  const reopened = await launch(() => null, 'off', persisted(upgraded));
  expect(reopened.select('.lb184-banner').hidden).toBe(true);
  expect(reopened.select('[data-release-notes][open]')).toBeNull();
  expect(reopened.select('#settings-whats-new p').textContent).toBe('<b>New</b>');
  const superseded = await launch(() => newer, undefined, saved);
  expect(superseded.select('.lb184-banner').hidden).toBe(true);
  superseded.select('[data-release-notes] [data-close]').click();
  expect(superseded.select('.lb184-banner [data-title]').textContent).toBe('Update available');
});

it('measures the recent progress interval, not the average since the download began', async () => {
  const { window } = await launch(() => null, 'off');
  const { measureDownloadSpeed, formatDownloadSpeed } = window.LBUpdateTools;
  const sample = measureDownloadSpeed(100);
  expect(sample(20, 200)).toBeUndefined();
  expect(formatDownloadSpeed(sample(1_200_000, 600))).toBe('2.4 MB/s');
  expect(formatDownloadSpeed(sample(1_250_000, 1100))).toBe('100.0 kB/s');
  expect(formatDownloadSpeed(sample(1_250_000, 1600))).toBe('');
  expect(sample(0, 1650)).toBeUndefined();
});

it('can silence in-app notifications without disabling the real updater', async () => {
  const game = await launch(() => newer);
  game.select('[data-notifications]').click();
  expect(game.select('.lb184-banner').hidden).toBe(true);
  expect(game.select('[data-get]').hidden).toBe(false);
  game.select('[data-check]').click();
  await settle();
  expect(checks(game.invoke)).toHaveLength(2);
  game.select('.lb149-settings [data-shell]').click();
  expect(game.select('dialog[open]').getAttribute('aria-label')).toBe('Update logs');
});

it('validates desktop and web version mirrors separately and requires stable versions', async () => {
  const files = await readVersions();
  expect(stableVersion(files.config.version)).toBe(true);
  expect(files.npm.version).toBe(files.lock.version);
  expect(stableVersion('3.10.0')).toBe(true);
  for (const invalid of ['01.2.3', '3.10', '3.10.0-beta', '65536.0.0']) expect(stableVersion(invalid)).toBe(false);
});
