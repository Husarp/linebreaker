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
  const { window } = new JSDOM('<main id="menu-overlay"><canvas></canvas></main><main id="settings-overlay"><div><section class="settings-section"></section></div></main>',
    { url: 'https://linebreaker.test', runScripts: 'outside-only' });
  windows.push(window);
  let time = 0;
  Object.defineProperty(window.performance, 'now', { value: () => time });
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
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
  const banner = game.select('.lb-update-banner');
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
  expect(restarted.select('.lb-update-banner').hidden).toBe(true);
});

it('honors opt-out and only reports a check failure after manual action', async () => {
  const offline = () => { throw Error('Low-level network error'); };
  const automatic = await launch(offline);
  expect(automatic.select('[data-result]').textContent).toBe('');
  const manual = await launch(offline, 'off');
  manual.focus();
  await settle();
  expect(checks(manual.invoke)).toHaveLength(0);
  manual.select('[data-check]').click();
  await settle();
  expect(checks(manual.invoke)).toHaveLength(1);
  expect(manual.select('[data-result]').textContent).toMatch(/internet connection/);
});

it('shows size and speed, retries without opening GitHub, and drains queued saves before handoff', async () => {
  let attempts = 0;
  let releaseSave;
  const game = await launch((command, args) => {
    if (command === 'check_desktop_update') return newer;
    if (command === 'download_desktop_update') {
      if (++attempts === 1) throw Error('Download failed');
      game.advance(1000);
      args.onProgress.onmessage({ done: 1048576, total: newer.size });
      expect(game.select('[data-status]').textContent).toBe('1.0 MiB / 2.0 MiB · 1.0 MiB/s');
    }
  });
  game.window.flushLinebreakerSave = () => new Promise(resolve => { releaseSave = resolve; });
  game.select('[data-open]').click();
  expect(game.select('[data-summary]').textContent).toBe('Update 0.10.0 · 2.0 MiB');
  const install = game.select('[data-install]');
  install.click();
  await settle();
  expect(install.textContent).toBe('TRY AGAIN');
  expect(game.invoke.mock.calls.some(([command]) => command === 'plugin:opener|open_url')).toBe(false);
  install.click();
  await settle();
  expect(game.invoke.mock.calls.some(([command]) => command === 'install_desktop_update')).toBe(false);
  releaseSave();
  await settle();
  expect(game.invoke).toHaveBeenLastCalledWith('install_desktop_update', { version: newer.version });
});

it('shows release notes for one Windows startup and suppresses them when a newer update is available', async () => {
  const saved = { 'lb149:desktop': '0.8.0', 'lb149:desktop-pending-notes:version': '0.9.0', 'lb149:desktop-pending-notes': '<b>New</b>' };
  const upgraded = await launch(() => null, 'off', saved);
  const notice = upgraded.select('.lb149-banner button');
  expect(notice.hidden).toBe(false);
  expect(notice.textContent).toBe("What's new in 0.9.0 ›");
  notice.click();
  expect(upgraded.select('[data-notes]').textContent).toBe('<b>New</b>');
  const reopened = await launch(() => null, 'off', Object.fromEntries(Object.entries(upgraded.window.localStorage)));
  expect(reopened.select('.lb149-banner').hidden).toBe(true);
  const superseded = await launch(() => newer, undefined, saved);
  expect(superseded.select('.lb149-banner').hidden).toBe(true);
});

it('keeps version mirrors in sync and requires a stable Windows-compatible version', async () => {
  expect(stableVersion((await readVersions()).config.version)).toBe(true);
  expect(stableVersion('3.10.0')).toBe(true);
  for (const invalid of ['01.2.3', '3.10', '3.10.0-beta', '65536.0.0']) expect(stableVersion(invalid)).toBe(false);
});
