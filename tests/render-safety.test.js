import { readFileSync } from 'node:fs';
import { IDBFactory } from 'fake-indexeddb';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const markup = `<b data-render-probe>quotes: ' " &amp; \\</b>`;
const invalidColor = `#123456" data-render-probe="invalid`;
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const nativeSave = readFileSync(new URL('../native-save.js', import.meta.url), 'utf8');
let page;
let window;
let document;
let game;

beforeEach(async () => {
  page = new JSDOM(html, { url: 'https://linebreaker.test/', runScripts: 'dangerously' });
  ({ window } = page);
  ({ document } = window);
  window.__LB_TEST__ = true;
  window.indexedDB = new IDBFactory();
  window.showOpenFilePicker = vi.fn();
  window.requestAnimationFrame = () => 0;
  window.cancelAnimationFrame = () => {};
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; },
    set(value) { this.textContent = value; }
  });
  window.HTMLCanvasElement.prototype.getContext = function () {
    return new Proxy({
      canvas: this,
      createLinearGradient: () => ({ addColorStop() {} }),
      createRadialGradient: () => ({ addColorStop() {} })
    }, { get: (context, key) => context[key] ?? (() => {}) });
  };
  window.fetch = async () => ({
    json: async () => ({ menu: [{ file: 'track.mp3', title: markup, artist: markup, tags: [markup] }] })
  });
  for (const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1])) {
    window.eval(src === 'app.js' ? app : readFileSync(new URL('../' + src, import.meta.url), 'utf8'));
  }
  game = window.__lb;
  await vi.waitFor(() => expect(document.getElementById('btn-open-save').onclick).toBeTypeOf('function'));
});

afterEach(() => page.window.close());

it('renders imported scores, dates and pinned notes as literal text', () => {
  const entry = { score: markup, date: markup, note: markup, lines: 1, time: 60, maxSpeed: 2 };
  game.setup({ save: { leaderboard: [entry, entry, entry, entry], pinnedScores: [entry], highscoreHistory: [entry], funLeaderboard: [entry] } });
  for (const [tab, list] of [['leaderboard', 'lb-list'], ['pinned', 'pinned-list'], ['highscores', 'highscores-list'], ['fun', 'fun-list']]) {
    window.statsLbTab(tab);
    const container = document.getElementById(list);
    expect(container.querySelector('.lb-score').textContent).toContain(markup);
    expect(container.querySelector('.lb-date').textContent).toBe(markup);
    expect(container.querySelector('[data-render-probe]')).toBeNull();
  }
  expect(document.querySelector('#pinned-list .lb-details-row').textContent).toContain(markup);
  document.querySelector('#lb-list > div > div').dispatchEvent(new window.MouseEvent('mouseenter'));
  expect(document.querySelector('#lb-tooltip-global').textContent).toContain(markup);
  expect(document.querySelector('#lb-tooltip-global [data-render-probe]')).toBeNull();
});

it('renders achievement claims and saved reward cards as text and rejects an invalid rank color', () => {
  game.setup({ save: {
    pendingAchievementClaims: [{ name: markup, xp: markup, rarity: 'rare' }],
    pendingLevelBox: {
      level: markup, rankName: markup, rankColor: invalidColor,
      rewards: [{ icon: markup, label: markup, desc: markup, rarity: markup }]
    }
  } });
  window.openAchievements();
  const achievements = document.querySelector('#achievements-overlay');
  expect(achievements.textContent).toContain(markup);
  expect(achievements.querySelector('[data-render-probe]')).toBeNull();
  game.showLevelBox();
  const box = document.querySelector('#level-box-overlay');
  expect(box.querySelector('.lb-rank-identity').textContent).toBe(markup);
  expect(box.querySelector('.lb-rank-identity').style.color).toBe('rgb(255, 215, 0)');
  expect([...box.querySelector('.lb-reward-card').children].map(child => child.textContent)).toEqual(Array(4).fill(markup));
  expect(box.querySelector('[data-render-probe]')).toBeNull();
});

it('shows single and tiered achievement dates as literal text in their tooltips', () => {
  const singleDate = `${markup} single`;
  const tierDate = `${markup} tier`;
  game.setup({ save: { achievements: {
    rules_reader: { unlocked: true, unlockedAt: singleDate },
    collector: { tier: 1, tierDates: { 1: tierDate } }
  } } });
  window.toggleAchDates(true);
  window.openAchievements('unlocked');
  const tooltips = [...document.querySelectorAll('#ach-list > div > div:nth-child(2) > div')].map(card => {
    card.dispatchEvent(new window.MouseEvent('mouseenter'));
    const tooltip = document.getElementById('ach-tip');
    expect(tooltip.querySelector('[data-render-probe]')).toBeNull();
    return tooltip.textContent;
  });
  expect(tooltips.some(text => text.includes(singleDate))).toBe(true);
  expect(tooltips.some(text => text.includes(tierDate))).toBe(true);
});

it('keeps imported track metadata as text and passes the unchanged name to the playlist action', () => {
  window.moveTrack = vi.fn();
  window.openPlaylistPanel();
  const playlist = document.querySelector('#playlist-panel-content');
  expect(playlist.textContent).toContain(markup);
  expect(playlist.querySelector('[data-render-probe]')).toBeNull();
  const toggle = [...playlist.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === `menu playlist: ${markup}`);
  expect(toggle).toBeDefined();
  toggle.click();
  expect(window.moveTrack).toHaveBeenCalledWith('menu', markup, false);
});

it('only renders valid hex colors in palette inputs, previews and copy handlers', () => {
  game.setup({ save: {
    customThemeColor: invalidColor,
    customPickerColors: [invalidColor, '#A1b2C3'],
    customPaletteOverrides: { classic: [invalidColor, '#A1b2C3'] }
  } });
  window.inventoryTab('colors');
  const preview = document.querySelector('[data-item-key="classic"] .lb-palette-preview');
  expect(preview.firstElementChild.style.getPropertyValue('--piece-color')).toBe('#00ffff');
  expect(preview.children[1].style.getPropertyValue('--piece-color')).toBe('#A1b2C3');
  window._openPaletteViewModal('classic');
  const copy = document.querySelector('#palette-view-modal [title="Copy hex"]');
  expect(copy.getAttribute('onclick')).toContain("writeText('#00ffff')");
  window._openPaletteEditor('classic');
  expect(document.getElementById('pe-c0-hex').value).toBe('#00ffff');
  window._openCustomPaletteModal();
  expect(document.getElementById('cpm-hex-0').value).toBe('#00ffff');
  window._openColorPickerModal();
  expect(document.getElementById('cp-hex-input').value).toBe('#ff00ff');
  expect(document.querySelector('[data-render-probe]')).toBeNull();
});

it('shows one inventory status, actions and locked-only progress, and counts catalog skins', () => {
  game.setup({ save: { ownedSkins: ['neon', 'neon', 'retro', 'bubble', 'matrix', 'unknown'], parts: { glass: 10, shadow: 2 } } });
  window.openInventory();
  const row = key => document.querySelector(`#owned-skin-btns [data-item-key="${key}"]`);
  const equipped = row('neon');
  const owned = row('retro');
  const locked = row('shadow');
  const ready = row('glass');
  expect(document.getElementById('skin-owned-count').innerText).toBe('(2/8)');
  for (const [card, status] of [[equipped, 'Equipped'], [owned, 'Owned'], [locked, 'Locked'], [ready, 'Locked']]) {
    expect([...card.querySelectorAll('.lb-item-state')].map(chip => chip.textContent)).toEqual([status]);
  }
  expect(equipped.querySelector('button, progress')).toBeNull();
  expect(owned.querySelector('button').textContent).toBe('Equip');
  expect(owned.querySelector('progress')).toBeNull();
  expect(locked.querySelector('progress').value).toBe(2);
  expect(locked.textContent).toContain('2/10 parts');
  expect(locked.querySelector('button')).toBeNull();
  expect(ready.querySelector('progress').value).toBe(10);
  expect(ready.querySelector('button').textContent).toBe('Unlock');
});
