import { afterEach, beforeEach, expect, it } from 'vitest';
import { loadGame } from './loader.js';

let game;
beforeEach(async () => { game = await loadGame(); game.api.setup(); });
afterEach(() => game?.close());

it('dismisses playlist disclosure on scroll or outside activation without closing the playlist', () => {
  const { document, Event } = game.w;
  game.w.openPlaylistPanel();
  const details = document.querySelector('#playlist-overlay details.lb-block-info');
  const summary = details.querySelector('summary');
  summary.click();
  const panel = document.getElementById('disclosure-info-tip');
  expect(details.open).toBe(true);
  expect(panel.hidden).toBe(false);
  document.getElementById('playlist-panel-content').dispatchEvent(new Event('scroll'));
  expect(details.open).toBe(false);
  expect(panel.hidden).toBe(true);
  summary.click();
  document.querySelector('#playlist-overlay h2').click();
  expect(details.open).toBe(false);
  expect(document.getElementById('playlist-overlay').classList.contains('hidden')).toBe(false);
});

it('dismisses settings help and the mission streak info on navigation', () => {
  const { document, MouseEvent } = game.w;
  game.w.openSettings();
  const setting = document.querySelector('.settings-tip').closest('.settings-row');
  setting.dispatchEvent(new MouseEvent('mouseenter'));
  const settingsTip = document.getElementById('settings-info-tip');
  expect(settingsTip.hidden).toBe(false);
  game.w.closeSettings();
  expect(settingsTip.hidden).toBe(true);

  game.w.openMissions();
  document.querySelector('.mq-streak-half').click();
  const missionTip = document.getElementById('mq-streak-panel-tip');
  expect(missionTip.hidden).toBe(false);
  game.w.renderMissionsOverlay('weekly');
  expect(missionTip.hidden).toBe(true);
});

it('anchors formerly native hover labels and dismisses them on scroll', () => {
  const { document, Event, MouseEvent } = game.w;
  const control = document.getElementById('mw-prev');
  expect(control.getAttribute('aria-label')).toBe('Previous');
  expect(control.hasAttribute('title')).toBe(false);
  control.dispatchEvent(new MouseEvent('pointerover', { bubbles: true }));
  const panel = document.getElementById('control-info-tip');
  expect(panel.textContent).toBe('Previous');
  expect(panel.hidden).toBe(false);
  document.dispatchEvent(new Event('scroll'));
  expect(panel.hidden).toBe(true);
});
