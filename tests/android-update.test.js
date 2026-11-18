import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, expect, it, vi } from 'vitest';

const source = readFileSync(new URL('../android-update.js', import.meta.url), 'utf8');
const repo = 'example/linebreaker';
const payload = {
  tag_name: 'v3.10.0',
  assets: [
    { name: 'Windows.exe', size: 9000, browser_download_url: 'https://example.com/windows' },
    { name: 'Renamed-build.APK', size: 2097152, browser_download_url: 'https://github.com/example/linebreaker/releases/download/v3.10.0/Renamed-build.APK' }
  ]
};
const sessions = [];
const flush = () => new Promise(resolve => setImmediate(resolve));

async function boot({ previous, offline, auto = true, platform = 'android', now = 1_000_000, response = payload } = {}) {
  const dom = new JSDOM('<div id="menu-overlay"><div class="menu-scale-wrapper"></div></div><div id="settings-overlay"><div class="settings-section"></div></div>', {
    url: 'https://localhost/', runScripts: 'outside-only'
  });
  sessions.push(dom);
  const { window } = dom;
  const listeners = {};
  const addListener = async (name, callback) => { listeners[name] = callback; };
  const plugin = {
    addListener, getInfo: vi.fn(async () => ({ version: '3.9.0', repo })),
    download: vi.fn(async () => {}), install: vi.fn(async () => {}), openReleases: vi.fn(async () => {})
  };
  window.Capacitor = { getPlatform: () => platform, Plugins: { AppUpdate: plugin, App: { addListener } } };
  const clock = vi.spyOn(window.Date, 'now').mockReturnValue(now);
  window.fetch = vi.fn(async () => {
    if (offline) throw new window.TypeError('Failed to fetch');
    return { ok: true, status: 200, json: async () => response };
  });
  if (previous) window.localStorage.setItem(`android-update-check:${repo}`, previous);
  if (!auto) window.localStorage.setItem('android-auto-update', 'off');
  window.eval(source);
  await flush();
  return { window, clock, plugin, listeners, get: selector => window.document.querySelector(selector) };
}

afterEach(() => {
  while (sessions.length) sessions.pop().window.close();
});

it('mounts only in the Android shell', async () => {
  const { get, plugin, window } = await boot({ platform: 'web' });
  expect(plugin.getInfo).not.toHaveBeenCalled();
  expect(window.fetch).not.toHaveBeenCalled();
  expect(get('.lb-android-update')).toBeNull();
});

it('compares numeric versions, throttles all checks, and dismisses the banner only for this launch', async () => {
  const { window, clock, get, listeners } = await boot();
  expect(window.fetch).toHaveBeenCalledWith(`https://api.github.com/repos/${repo}/releases/latest`, expect.anything());
  expect(get('[data-current]').textContent).toBe('Current version 3.9.0');
  expect(get('aside [data-update-summary]').textContent).toBe('Update 3.10.0 · 2.0 MB');
  get('[data-dismiss]').click();
  get('[data-check]').click();
  listeners.appStateChange({ isActive: true });
  expect(window.fetch).toHaveBeenCalledTimes(1);
  expect(get('aside').hidden).toBe(true);
  expect(get('section [data-update]').hidden).toBe(false);

  clock.mockReturnValue(1_300_000);
  listeners.appStateChange({ isActive: false });
  expect(window.fetch).toHaveBeenCalledTimes(1);
  listeners.appStateChange({ isActive: true });
  await flush();
  expect(window.fetch).toHaveBeenCalledTimes(2);
  expect(get('aside').hidden).toBe(true);

  const previous = window.localStorage.getItem(`android-update-check:${repo}`);
  const restarted = await boot({ previous, now: 1_300_001 });
  expect(restarted.window.fetch).not.toHaveBeenCalled();
  expect(restarted.get('aside').hidden).toBe(false);
});

it('respects disabled automatic checks while still supporting a manual check', async () => {
  const { get, listeners, window } = await boot({ auto: false });
  listeners.appStateChange({ isActive: true });
  expect(window.fetch).not.toHaveBeenCalled();
  get('[data-check]').click();
  await flush();
  expect(window.fetch).toHaveBeenCalledTimes(1);
  expect(get('[data-check-status]').textContent).toBe('An Android update is ready to download.');
});

it('keeps automatic failures silent and explains the same failure on manual check', async () => {
  const { get, window } = await boot({ offline: true });
  const status = get('[data-check-status]');
  expect(status.hidden).toBe(true);
  get('[data-check]').click();
  expect(status.hidden).toBe(false);
  expect(status.textContent).toMatch(/Check your connection, firewall, or VPN/);
  expect(window.fetch).toHaveBeenCalledTimes(1);
});

it('limits a manual check to ten seconds, including response parsing', async () => {
  const { get, window } = await boot({ auto: false });
  let fireTimeout;
  const schedule = vi.spyOn(window, 'setTimeout').mockImplementation(callback => {
    fireTimeout = callback;
    return 1;
  });
  const json = vi.fn();
  window.fetch.mockImplementation(async (url, { signal }) => {
    json.mockImplementation(() => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    return { ok: true, json };
  });
  get('[data-check]').click();
  await flush();
  expect(json).toHaveBeenCalledOnce();
  expect(schedule).toHaveBeenCalledWith(expect.any(Function), 10_000);
  fireTimeout();
  await flush();
  expect(get('[data-check-status]').textContent).toMatch(/GitHub did not respond in time/);
});

it('does not offer a desktop-only release to Android players', async () => {
  const { get } = await boot({ response: { ...payload, assets: [payload.assets[0]] } });
  get('[data-check]').click();
  expect(get('aside').hidden).toBe(true);
  expect(get('section [data-update]').hidden).toBe(true);
  expect(get('[data-check-status]').textContent).toMatch(/does not contain a downloadable Android APK/);
});

it('reports download progress and exposes user-controlled retry and GitHub fallback', async () => {
  const { get, plugin, listeners } = await boot();
  let failDownload;
  plugin.download.mockImplementationOnce(() => new Promise((resolve, reject) => { failDownload = reject; }));
  get('aside [data-update]').click();
  expect(get('#android-update-title').textContent).toBe('Update 3.10.0 · 2.0 MB');
  listeners.downloadProgress({ done: 1048576, total: 2097152 });
  expect(get('progress').value).toBe(50);
  expect(get('[data-stats]').textContent).toMatch(/50% · 1.0 MB \/ 2.0 MB · .*\/s/);
  failDownload(new Error('Download interrupted'));
  await flush();
  expect(get('[data-install-status]').textContent).toBe('Download interrupted');
  expect(get('[data-recovery]').hidden).toBe(false);
  expect(plugin.openReleases).not.toHaveBeenCalled();
  get('[data-recovery] [data-github]').click();
  expect(plugin.openReleases).toHaveBeenCalledTimes(1);
  get('[data-retry]').click();
  await flush();
  expect(plugin.download).toHaveBeenCalledTimes(2);
  expect(plugin.install).toHaveBeenCalledWith({
    version: '3.10.0', size: 2097152, url: payload.assets[1].browser_download_url
  });
});
