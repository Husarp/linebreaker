import { afterEach, expect, it, vi } from 'vitest';
import '../notifications.js';
import { loadGame } from './loader.js';

const { nextReset, nextStreakReminder } = globalThis.LBNotifications;
let game;
afterEach(() => game?.close());

it('finds the next local midnight across a date and year boundary', () => {
    const now = new Date(2026, 11, 31, 23, 59, 59, 999);
    expect(nextReset(now)).toEqual(new Date(2027, 0, 1));
    expect(nextReset(new Date(2027, 0, 1))).toEqual(new Date(2027, 0, 2));
    expect(now).toEqual(new Date(2026, 11, 31, 23, 59, 59, 999));
});

it('finds ISO-week resets at local Monday midnight, including on a Monday', () => {
    expect(nextReset(new Date(2027, 0, 3, 23, 59), true)).toEqual(new Date(2027, 0, 4));
    expect(nextReset(new Date(2027, 0, 4), true)).toEqual(new Date(2027, 0, 11));
    expect(nextReset(new Date(2026, 11, 31, 12), true)).toEqual(new Date(2027, 0, 4));
});

it('uses local wall-clock times across daylight-saving changes', () => {
    const springSunday = new Date(2026, 2, 8, 0);
    expect(nextReset(springSunday)).toEqual(new Date(2026, 2, 9));
    expect(nextReset(springSunday, true)).toEqual(new Date(2026, 2, 9));
    expect(nextStreakReminder(springSunday, false)).toEqual(new Date(2026, 2, 8, 20));
});

it('only schedules an unmet streak for a still-upcoming 8 p.m.', () => {
    expect(nextStreakReminder(new Date(2026, 10, 18, 19, 59, 59), false)).toEqual(new Date(2026, 10, 18, 20));
    expect(nextStreakReminder(new Date(2026, 10, 18, 20), false)).toBeNull();
    expect(nextStreakReminder(new Date(2026, 10, 18, 21), false)).toBeNull();
    expect(nextStreakReminder(new Date(2026, 10, 18, 12), true)).toBeNull();
});

function android({ display = 'granted', response = 'granted' } = {}) {
    const plugin = {
        checkPermissions: vi.fn(async () => ({ display })),
        requestPermissions: vi.fn(async () => ({ display: response })),
        checkExactNotificationSetting: vi.fn(async () => ({ exact_alarm: 'denied' })),
        schedule: vi.fn(async () => {}),
        cancel: vi.fn(async () => {})
    };
    const capacitor = {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        Plugins: {
            LocalNotifications: plugin,
            App: { async addListener() {} },
            Filesystem: {
                async readFile() { return { data: '{"totalXP":0}' }; },
                async writeFile() {},
                async rename() {}
            }
        }
    };
    return { capacitor, plugin };
}

const toggle = key => game.w.document.querySelector(`[data-reminder="${key}"]`);

it('keeps reminders hidden on web and desktop', async () => {
    for (const invoke of [null, async () => null]) {
        game = await loadGame(true, invoke);
        expect(game.w.document.getElementById('notification-settings').hidden).toBe(true);
        game.close();
        game = undefined;
    }
});

it('only prompts once from an Android settings toggle, not on app start', async () => {
    const { capacitor, plugin } = android({ display: 'prompt', response: 'denied' });
    game = await loadGame(true, null, capacitor, { reminders: { enabled: true } });
    expect(game.w.document.getElementById('notification-settings').hidden).toBe(false);
    expect(toggle('enabled').checked).toBe(true);
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
    expect(plugin.schedule).not.toHaveBeenCalled();

    toggle('enabled').click();
    toggle('enabled').click();
    await vi.waitFor(() => expect(plugin.requestPermissions).toHaveBeenCalledTimes(1));
    toggle('daily').click();
    toggle('daily').click();
    await vi.waitFor(() => expect(plugin.cancel).toHaveBeenCalledTimes(5));
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(1);
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(game.w.document.querySelector('#notification-settings [role="status"]').textContent).toContain('Android Settings');
});

it('schedules recurring local resets and removes the streak reminder after the game meets its goal', async () => {
    const { capacitor, plugin } = android();
    game = await loadGame(true, null, capacitor, { reminders: { enabled: true } });
    expect(plugin.schedule).toHaveBeenCalledTimes(1);
    const { notifications } = plugin.schedule.mock.lastCall[0];
    expect(notifications).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 2001, schedule: { on: { hour: 0, minute: 0, second: 0 } }, isExactNotification: false }),
        expect.objectContaining({ id: 2003, schedule: { on: { weekday: 2, hour: 0, minute: 0, second: 0 } }, isExactNotification: false })
    ]));
    const tonight = new game.w.Date();
    tonight.setHours(20, 0, 0, 0);
    if (tonight > new game.w.Date()) {
        expect(notifications.find(({ id }) => id === 2002)?.schedule.at.getTime()).toBe(tonight.getTime());
    }

    const save = game.api.save;
    save.missions.daily.rawXPToday = game.api.streakThreshold();
    game.api.setup({ save });
    game.api.gameOver();
    await vi.waitFor(() => expect(plugin.schedule).toHaveBeenCalledTimes(2));
    expect(plugin.cancel.mock.lastCall[0].notifications).toContainEqual({ id: 2002 });
    expect(plugin.schedule.mock.lastCall[0].notifications.map(({ id }) => id)).toEqual([2001, 2003]);

    toggle('weekly').click();
    await vi.waitFor(() => expect(plugin.schedule).toHaveBeenCalledTimes(3));
    expect(plugin.schedule.mock.lastCall[0].notifications.map(({ id }) => id)).toEqual([2001]);
    toggle('enabled').click();
    await vi.waitFor(() => expect(plugin.cancel).toHaveBeenCalledTimes(4));
    expect(plugin.schedule).toHaveBeenCalledTimes(3);
    expect(JSON.parse(game.w.localStorage.getItem('linebreaker_settings')).reminders).toMatchObject({ enabled: false, weekly: false });
});
