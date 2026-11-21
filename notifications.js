(function (root) {
    const midnight = { hour: 0, minute: 0, second: 0 };
    const monday = 2;
    const streakHour = 20;
    const permissionKey = 'lb_reminderPermissionAsked';
    const defaults = { enabled: false, daily: true, streak: true, weekly: true };
    const reminders = {
        daily: { id: 2001, title: 'New missions are ready', body: 'Your daily missions have refreshed.' },
        streak: { id: 2002, title: 'Your streak ends tonight', body: 'Earn enough gameplay XP today to keep your streak.' },
        weekly: { id: 2003, title: 'New weekly missions are ready', body: 'Your weekly missions have refreshed.' }
    };

    function atLocalHour(now, daysAhead, hour) {
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysAhead, hour);
    }

    function nextReset(now, weekly = false) {
        const daysAhead = weekly ? (monday - 1 - now.getDay() + 7) % 7 || 7 : 1;
        return atLocalHour(now, daysAhead, midnight.hour);
    }

    function nextStreakReminder(now, requirementMet) {
        if (requirementMet) return null;
        const tonight = atLocalHour(now, 0, streakHour);
        return tonight > now ? tonight : null;
    }

    function mount({ getSettings, saveSettings, streakRequirementMet }) {
        const capacitor = root.Capacitor;
        if (!capacitor?.isNativePlatform() || capacitor.getPlatform?.() !== 'android') return;
        const plugin = capacitor.Plugins?.LocalNotifications;
        const section = root.document.getElementById('notification-settings');
        if (!plugin || !section) return;

        const status = section.querySelector('[role="status"]');
        const inputs = section.querySelectorAll('[data-reminder]');
        const reminderIds = Object.values(reminders).map(({ id }) => ({ id }));
        const preferences = () => ({ ...defaults, ...getSettings().reminders });
        const bounded = root.LBStartup?.bounded || ((label, action) => action());
        let queue = Promise.resolve();

        function render() {
            const prefs = preferences();
            for (const input of inputs) {
                const key = input.dataset.reminder;
                input.checked = prefs[key];
                input.disabled = key !== 'enabled' && !prefs.enabled;
            }
        }

        function refresh(fromEnabledToggle = false) {
            render();
            queue = queue.then(async () => {
                await bounded('Cancelling reminders', () => plugin.cancel({ notifications: reminderIds }));
                status.textContent = '';
                const prefs = preferences();
                if (!prefs.enabled || !(prefs.daily || prefs.streak || prefs.weekly)) return;

                let { display } = await bounded('Checking reminder permission', () => plugin.checkPermissions());
                const asked = root.localStorage.getItem(permissionKey);
                if (fromEnabledToggle && !asked && (display === 'prompt' || display === 'prompt-with-rationale')) {
                    root.localStorage.setItem(permissionKey, '1');
                    ({ display } = await bounded('Requesting reminder permission', () => plugin.requestPermissions(), 30000));
                }
                if (display !== 'granted') {
                    status.textContent = display === 'denied' || root.localStorage.getItem(permissionKey)
                        ? 'Allow Linebreaker notifications in Android Settings.'
                        : 'Enable a reminder here to allow notifications.';
                    return;
                }

                const { exact_alarm: exactAlarm } = await bounded('Checking exact alarms', () => plugin.checkExactNotificationSetting());
                const notifications = [];
                const add = (key, schedule) => notifications.push({
                    ...reminders[key], smallIcon: 'ic_stat_linebreaker', schedule, isExactNotification: exactAlarm === 'granted'
                });
                if (prefs.daily) add('daily', { on: midnight });
                if (prefs.weekly) add('weekly', { on: { ...midnight, weekday: monday } });
                if (prefs.streak) {
                    const at = nextStreakReminder(new Date(), streakRequirementMet());
                    if (at) add('streak', { at, allowWhileIdle: true });
                }
                if (notifications.length) await bounded('Scheduling reminders', () => plugin.schedule({ notifications }));
            }).catch(error => {
                status.textContent = 'Could not update reminders.';
                console.warn('Could not update Android reminders:', error);
            });
            return queue;
        }

        for (const input of inputs) {
            input.addEventListener('change', () => {
                getSettings().reminders = { ...preferences(), [input.dataset.reminder]: input.checked };
                saveSettings();
                refresh(input.checked);
            });
        }
        section.hidden = false;
        render();
        return { refresh, render };
    }

    root.LBNotifications = { mount, nextReset, nextStreakReminder };
})(globalThis);
