import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { expect, it, vi } from 'vitest';
import { checkWebView } from '../scripts/webview-compat.mjs';

const watchdog = readFileSync(new URL('../boot.js', import.meta.url), 'utf8');
const markup = '<div id="ls-inner"><p id="ls-status">Loading…</p><div id="ls-actions" hidden><button id="ls-continue" hidden></button><button id="ls-restart"></button></div></div>';

it('packages every script loaded by the real index at the Chrome 60 floor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lb-webview-release-'));
  const entry = new URL('../index.html', import.meta.url);
  const dom = new JSDOM(readFileSync(entry, 'utf8'));
  try {
    await cp(entry, join(root, 'index.html'));
    for (const script of dom.window.document.querySelectorAll('script[src]')) {
      const source = script.getAttribute('src');
      const destination = join(root, new URL(source, 'https://localhost/').pathname.slice(1));
      await mkdir(dirname(destination), { recursive: true });
      await cp(new URL(source, entry), destination);
    }
    await checkWebView(root, { compile: true });
    await checkWebView(root);
  } finally { dom.window.close(); await rm(root, { recursive: true, force: true }); }
}, 15000);

it('rejects newer syntax in shipped external scripts, inline scripts, and event handlers', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lb-webview-'));
  const index = html => writeFile(join(root, 'index.html'), html);
  try {
    await index('<script src="game.js"></script><script>window.x ??= 1;</script>');
    await writeFile(join(root, 'game.js'), 'window.result = window.value?.key;');
    await expect(checkWebView(root)).rejects.toThrow('game.js must run as written on chrome60');
    await expect(checkWebView(root, { compile: true })).resolves.toBeUndefined();
    await expect(checkWebView(root)).resolves.toBeUndefined();
    await index('<script>window.x ??= 1;</script>');
    await expect(checkWebView(root)).rejects.toThrow('index.html:1 must run as written on chrome60');
    await index('<button onclick="window.value?.run()">Go</button>');
    await expect(checkWebView(root, { compile: true })).rejects.toThrow('onclick must run as written on chrome60');
    await index('<script>window.lookbehind = /(?<=a)b/;</script>');
    await expect(checkWebView(root, { compile: true })).rejects.toThrow('regular expression syntax is unavailable');
    await index('<script src="boot.js"></script>');
    await writeFile(join(root, 'boot.js'), 'window.result = window.value?.key;');
    await expect(checkWebView(root, { compile: true })).rejects.toThrow('boot.js must run as written');
  } finally { await rm(root, { recursive: true, force: true }); }
});

it('offers native recovery after DOMContentLoaded when app.js never runs and forwards startup diagnostics', async () => {
  const { window } = new JSDOM(markup, { runScripts: 'outside-only' });
  try {
    await new Promise(resolve => window.addEventListener('DOMContentLoaded', resolve, { once: true }));
    let watchdogTimer;
    const schedule = window.setTimeout.bind(window);
    window.setTimeout = (callback, delay) => delay === 8000 ? (watchdogTimer = callback, 0) : schedule(callback, delay);
    const ota = { settings: vi.fn(async () => {}), logWebDiagnostic: vi.fn(async () => {}) };
    window.Capacitor = { Plugins: { Ota: ota } };
    window.eval(watchdog);
    watchdogTimer();
    const next = window.document.getElementById('ls-continue');
    expect(next.hidden).toBe(false);
    expect(next.textContent).toBe('Open app shell');
    next.click();
    await Promise.resolve();
    expect(ota.settings).toHaveBeenCalledOnce();
    window.dispatchEvent(new window.ErrorEvent('error', { error: Error('app.js broke') }));
    window.LBStartup.finish();
    const rejection = new window.Event('unhandledrejection');
    rejection.reason = Error('late bridge error');
    window.dispatchEvent(rejection);
    expect(ota.logWebDiagnostic.mock.calls.map(([entry]) => entry.message)).toEqual([
      'LBStartup: Loading app scripts…', expect.stringContaining('Startup is taking too long'),
      expect.stringContaining('app.js broke'), expect.stringContaining('unhandled rejection: Error: late bridge error'),
    ]);
  } finally { window.close(); }
});

it('renders a failure reported before the loader markup exists', async () => {
  const { window } = new JSDOM('', { runScripts: 'outside-only' });
  try {
    window.console.error = vi.fn();
    window.eval(watchdog);
    window.LBStartup.fail(Error('script parse failed'));
    window.document.body.innerHTML = markup;
    await Promise.resolve();
    expect(window.document.getElementById('ls-actions').hidden).toBe(false);
    expect(window.document.getElementById('ls-status').textContent).toContain('Startup failed');
    expect(window.document.getElementById('ls-restart').onclick).toBeTypeOf('function');
  } finally { window.close(); }
});
