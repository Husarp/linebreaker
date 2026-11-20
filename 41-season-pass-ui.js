(() => {
    const { observe, claimStage, storeState, stageStatus, prepareConfig, exclusiveSkin } = window.LBSeason;
    const labels = { claimed: 'Claimed', claimable: 'Claimable', locked: 'Locked', future: 'Future' };
    const title = value => value[0].toUpperCase() + value.slice(1);
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
    const clockDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const points = new Intl.NumberFormat();

    function mount({ getSave, save, partName, boosterName, inventory, grant }) {
        const entry = document.getElementById('sp-entry');
        const missions = document.getElementById('missions-overlay');
        const menu = document.getElementById('menu-overlay');
        const screen = document.createElement('section');
        screen.id = 'season-pass-overlay';
        screen.className = 'sp-pass hidden';
        screen.setAttribute('role', 'dialog');
        screen.setAttribute('aria-modal', 'true');
        screen.setAttribute('aria-labelledby', 'sp-title');
        screen.innerHTML = `
            <div class="sp-shell">
                <header class="sp-header">
                    <button type="button" class="sp-button sp-back btn-back lb-block-back" aria-label="Back to missions" title="Back to missions">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <div><span id="sp-season"></span><h1 id="sp-title">Season Pass</h1></div>
                    <div class="sp-days"><strong id="sp-days"></strong><span id="sp-dates"></span></div>
                </header>
                <div class="sp-points">
                    <div><h2 id="sp-points-title">Season points</h2><p>Claim daily and weekly mission points to earn season points.</p></div>
                    <div class="sp-meter"><progress class="lb-progress--pattern" aria-labelledby="sp-points-title" max="1" value="0"></progress><span id="sp-progress-text"></span></div>
                </div>
                <p id="sp-notice" class="sp-notice" role="status" hidden></p>
                <div class="sp-track-header">
                    <div><h2>Free reward track</h2><p>Each claim rolls a reward from the stage’s tier.</p></div>
                    <button type="button" class="sp-button sp-today lb-block-btn" hidden></button>
                </div>
                <div id="sp-loading" role="status"></div>
                <button type="button" class="sp-button sp-retry lb-block-btn" hidden>Retry</button>
                <div class="sp-track" role="region" aria-label="Season reward stages" tabindex="0" hidden><ol></ol></div>
                <aside class="sp-highlight">
                    <img src="assets/ui/41-season-pass-exclusive.webp" alt="" width="144" height="106">
                    <div><h2>Season reward highlight</h2><p>Day 30 features the exclusive Season Prism block skin.</p></div>
                    <button type="button" class="sp-button sp-missions lb-block-btn">Back to missions</button>
                </aside>
                <p id="sp-announcement" class="sp-sr-only" role="status"></p>
            </div>`;
        document.body.appendChild(screen);
        const find = selector => screen.querySelector(selector);
        const track = find('.sp-track');
        const cards = find('ol');
        const today = find('.sp-today');
        const back = find('.sp-back');
        const retry = find('.sp-retry');
        const countdown = find('#sp-days');
        const notice = find('#sp-notice');
        const loading = find('#sp-loading');
        const announcement = find('#sp-announcement');
        let config, configRequest, timer, previous, centerOnRender, saveCheckpoint;
        let inertTargets = [];
        const isOpen = () => !screen.classList.contains('hidden');

        function rewardLabel(reward) {
            const { type, key, amount, tier, contents } = reward;
            if (type === 'crate') return `${title(tier)} Crate: ${contents.map(rewardLabel).join(', ')}`;
            if (type === 'skin') return `${key === exclusiveSkin.key ? exclusiveSkin.name : key} skin`;
            if (type === 'booster') return `${amount} × ${boosterName(key)}`;
            if (type === 'universal_parts') return `${amount} Universal ${amount === 1 ? 'Part' : 'Parts'}`;
            return `${amount} ${partName(key)} ${amount === 1 ? 'Part' : 'Parts'}`;
        }

        function centerToday() {
            const card = cards.querySelector('[aria-current="date"]');
            if (!card) return;
            const rect = card.getBoundingClientRect();
            if (window.matchMedia?.('(orientation: portrait)')?.matches) {
                screen.scrollTop += rect.top + (rect.height - screen.clientHeight) / 2;
            } else {
                const area = track.getBoundingClientRect();
                track.scrollLeft += rect.left - area.left + (rect.width - area.width) / 2;
            }
        }

        function render(state) {
            const { period, blocked, season, seasonBlockedUntil } = state;
            if (previous && previous.period.day === period.day && previous.period.id === period.id
                && previous.season === season && previous.points === season.points && previous.config === config
                && previous.blocked === blocked && previous.seasonBlockedUntil === seasonBlockedUntil) return;
            previous = { ...state, points: season.points, config };
            find('#sp-season').textContent = period.id ? `Season ${period.id} · 30-day season` : '30-day season';
            countdown.textContent = `${period.daysLeft} ${period.daysLeft === 1 ? 'day' : 'days'} left`;
            find('#sp-dates').textContent = period.id ? `Started ${date.format(period.start)} (UTC)` : '';
            notice.hidden = !blocked;
            notice.textContent = blocked ? `Season claims are paused. Check your device date and time. Claims resume at ${clockDate.format(seasonBlockedUntil || period.start)} or later.` : '';
            const maximum = config?.stages.at(-1).points;
            const progressBar = find('progress');
            progressBar.hidden = !config;
            progressBar.max = maximum || 1;
            progressBar.value = Math.min(season.points, progressBar.max);
            find('#sp-progress-text').textContent = maximum ? `${points.format(season.points)} / ${points.format(maximum)} points` : `${points.format(season.points)} points`;
            track.hidden = !config;
            today.hidden = !config || !period.day;
            today.textContent = `Today · Day ${period.day}`;
            if (!config) return;

            const focused = document.activeElement?.dataset.spDay;
            cards.replaceChildren(...config.stages.map(stage => {
                const status = stageStatus(stage, state);
                const card = document.createElement('li');
                card.className = 'sp-card';
                card.dataset.tier = stage.tier;
                card.dataset.state = status;
                if (stage.day === period.day) card.setAttribute('aria-current', 'date');
                card.innerHTML = `<p class="sp-tier"></p><h3></h3>
                    ${stage.tier === 'exclusive'
                        ? '<img class="sp-reward-icon" src="assets/ui/41-season-pass-exclusive.webp" alt="" width="64" height="46">'
                        : '<svg class="sp-reward-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5m-9 5v8M7.5 5.5l9 5"/></svg>'}
                    <p class="sp-threshold"></p><p class="sp-state"></p>`;
                card.querySelector('.sp-tier').textContent = title(stage.tier);
                card.querySelector('h3').textContent = `Day ${stage.day}`;
                const threshold = card.querySelector('.sp-threshold');
                threshold.textContent = `${points.format(stage.points)} season points`;
                const label = card.querySelector('.sp-state');
                label.textContent = status === 'future' ? 'Future · Not yet open' : labels[status];
                if (status === 'claimed') {
                    const receipt = document.createElement('p');
                    receipt.className = 'sp-receipt';
                    receipt.textContent = rewardLabel(season.claimed[stage.day]);
                    card.append(receipt);
                } else if (status === 'claimable') {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'sp-button sp-claim lb-block-btn lb-block-btn--primary';
                    button.dataset.spDay = stage.day;
                    button.setAttribute('aria-label', `Claim day ${stage.day} ${stage.tier} reward`);
                    button.textContent = 'Claim reward';
                    card.append(button);
                }
                return card;
            }));
            if (focused) (find(`[data-sp-day="${focused}"]`) || track).focus({ preventScroll: true });
            if (centerOnRender) {
                centerOnRender = false;
                centerToday();
            }
        }

        function refresh(persist = false) {
            const currentSave = getSave();
            const before = currentSave.seasonBlockedUntil;
            const oldSeason = currentSave.season;
            const state = observe(currentSave);
            if (persist || state.seasonBlockedUntil !== before || state.season !== oldSeason || state.lastSeenTime - saveCheckpoint >= 60_000) {
                saveCheckpoint = state.lastSeenTime;
                save();
            }
            render(state);
        }

        async function loadConfig() {
            if (config || configRequest) return;
            retry.hidden = true;
            loading.textContent = 'Loading reward track…';
            configRequest = (async () => {
                const response = await fetch('data/season.json', { signal: window.AbortSignal?.timeout?.(3000) });
                if (!response.ok) throw new Error('Could not load the reward track');
                return prepareConfig(await response.json());
            })();
            try {
                config = await configRequest;
                loading.textContent = '';
                if (isOpen()) refresh();
            } catch {
                loading.textContent = 'The reward track could not load. Try again.';
                retry.hidden = false;
            } finally {
                configRequest = null;
            }
        }

        function close() {
            clearInterval(timer);
            refresh(true);
            screen.classList.add('hidden');
            inertTargets.forEach(element => element.removeAttribute('inert'));
            entry.focus({ preventScroll: true });
        }

        function open() {
            if (isOpen()) return;
            inertTargets = [missions, menu].filter(element => !element.hasAttribute('inert'));
            inertTargets.forEach(element => element.setAttribute('inert', ''));
            screen.classList.remove('hidden');
            screen.scrollTop = 0;
            centerOnRender = true;
            previous = null;
            announcement.textContent = '';
            back.focus({ preventScroll: true });
            refresh(true);
            timer = setInterval(refresh, 1000);
            return loadConfig();
        }
        entry.addEventListener('click', open);
        back.addEventListener('click', close);
        find('.sp-missions').addEventListener('click', close);
        retry.addEventListener('click', loadConfig);
        today.addEventListener('click', () => {
            refresh();
            centerToday();
        });
        window.addEventListener('focus', () => { if (isOpen()) refresh(); });
        screen.addEventListener('keydown', event => {
            if (event.key !== 'Tab') return;
            const focusable = [...screen.querySelectorAll('button:not([hidden]), .sp-track:not([hidden])')];
            const end = focusable.at(event.shiftKey ? 0 : -1);
            if (document.activeElement === end) {
                event.preventDefault();
                focusable.at(event.shiftKey ? -1 : 0).focus();
            }
        });
        track.addEventListener('click', event => {
            const button = event.target.closest('[data-sp-day]');
            if (!button || !isOpen() || !config) return;
            const currentSave = getSave();
            const day = Number(button.dataset.spDay);
            const result = claimStage(currentSave, config, day, Date.now(), inventory());
            storeState(currentSave, result);
            if (result.reward) {
                (result.reward.contents || [result.reward]).forEach(grant);
                announcement.textContent = `Day ${day} claimed: ${rewardLabel(result.reward)}`;
            }
            refresh(true);
        });
        return { open, close };
    }

    window.LBSeasonUI = { mount };
})();
