(() => {
    const { observe, claimStage, storeState, stageStatus, prepareConfig, exclusiveSkin } = window.LBSeason;
    const title = value => value[0].toUpperCase() + value.slice(1);
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
    const clockDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const points = new Intl.NumberFormat();

    function mount({ getSave, save, partName, boosterName, inventory, grant }) {
        const screen = document.getElementById('season-pass-overlay');
        screen.innerHTML = `
            <div class="sp-shell">
                <header class="sp-header">
                    <div><span id="sp-season"></span><h1 id="sp-title">Season Pass</h1></div>
                    <div class="sp-days"><strong id="sp-days"></strong><span id="sp-dates"></span></div>
                </header>
                <div class="sp-points">
                    <div><h2 id="sp-points-title">Season points</h2><p>Claim daily and weekly mission points to earn season points.</p></div>
                    <div class="sp-meter">
                        <span id="sp-progress-text"></span>
                        <progress class="lb-block-progress" aria-labelledby="sp-points-title" aria-describedby="sp-progress-text" max="1" value="0"></progress>
                        <p id="sp-next"></p>
                    </div>
                </div>
                <p id="sp-notice" class="sp-notice" role="status" hidden></p>
                <div class="sp-track-header">
                    <div><h2>Free reward track</h2><p>Stages open when their day arrives and you have enough points.</p></div>
                    <button type="button" class="sp-jump lb-block-btn" hidden></button>
                </div>
                <div id="sp-loading" role="status"></div>
                <button type="button" class="sp-retry lb-block-btn" hidden>Retry</button>
                <div class="sp-track" role="region" aria-label="Season reward stages" tabindex="0" hidden><ol></ol></div>
                <aside class="sp-highlight">
                    <img src="assets/ui/41-season-pass-exclusive.webp" alt="" width="144" height="106">
                    <div><h2>Season Prism</h2><p>Exclusive block skin · Stage 30</p></div>
                </aside>
                <p id="sp-announcement" class="sp-sr-only" role="status"></p>
            </div>`;
        const find = selector => screen.querySelector(selector);
        const track = find('.sp-track');
        const cards = find('ol');
        const jump = find('.sp-jump');
        const retry = find('.sp-retry');
        const countdown = find('#sp-days');
        const notice = find('#sp-notice');
        const loading = find('#sp-loading');
        const announcement = find('#sp-announcement');
        let config, configRequest, timer, previous, centerOnRender, saveCheckpoint;
        const isOpen = () => !screen.hidden;
        const verticalTrack = () => window.matchMedia?.('(orientation: portrait), (max-width: 699px)')?.matches;

        function rewardLabel(reward) {
            const { type, key, amount, tier, contents } = reward;
            if (type === 'crate') return `${title(tier)} Crate: ${contents.map(rewardLabel).join(', ')}`;
            if (type === 'skin') return `${key === exclusiveSkin.key ? exclusiveSkin.name : key} skin`;
            if (type === 'booster') return `${amount} × ${boosterName(key)}`;
            if (type === 'universal_parts') return `${amount} Universal ${amount === 1 ? 'Part' : 'Parts'}`;
            return `${amount} ${partName(key)} ${amount === 1 ? 'Part' : 'Parts'}`;
        }

        function centerStage(focus = false) {
            const card = cards.querySelector('[data-next]');
            if (!card) return;
            const rect = card.getBoundingClientRect();
            if (verticalTrack()) {
                screen.scrollTop += rect.top - screen.getBoundingClientRect().top + (rect.height - screen.clientHeight) / 2;
            } else {
                const area = track.getBoundingClientRect();
                track.scrollLeft += rect.left - area.left + (rect.width - area.width) / 2;
            }
            if (focus) card.focus({ preventScroll: true });
        }

        function render(state) {
            const { period, blocked, season, seasonBlockedUntil } = state;
            if (previous && previous.period.day === period.day && previous.period.id === period.id
                && previous.season === season && previous.points === season.points && previous.config === config
                && previous.blocked === blocked && previous.seasonBlockedUntil === seasonBlockedUntil) return;
            previous = { ...state, points: season.points, config };
            find('#sp-season').textContent = period.id ? `Season ${period.id} · Day ${period.day} / 30` : '30-day season';
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
            if (!config) return;

            const stages = config.stages.map(stage => ({ ...stage, status: stageStatus(stage, state) }));
            const next = stages.find(stage => stage.status !== 'claimed');
            const remaining = next ? Math.max(0, next.points - season.points) : 0;
            jump.hidden = !next;
            jump.textContent = next ? `Go to stage ${next.day}` : '';
            const nextDetail = !next ? 'All 30 rewards claimed'
                : blocked ? 'Claims paused'
                : next.status === 'claimable' ? `Stage ${next.day} ready to claim`
                : next.status === 'future' ? `Stage ${next.day} opens on Day ${next.day}${remaining ? ` · ${points.format(remaining)} pts to go` : ''}`
                : `${points.format(remaining)} more pts to Stage ${next.day}`;
            find('#sp-next').textContent = nextDetail;

            const focused = document.activeElement?.closest('.sp-card')?.dataset.stage;
            cards.replaceChildren(...stages.map(({ day, tier, points: threshold, status }) => {
                const card = document.createElement('li');
                card.className = 'sp-card';
                card.dataset.stage = day;
                card.dataset.tier = tier;
                card.dataset.state = status;
                card.tabIndex = -1;
                if (day === next?.day) {
                    card.dataset.next = '';
                    card.setAttribute('aria-current', 'step');
                }
                card.innerHTML = `<span class="sp-step" aria-hidden="true"></span><h3></h3>
                    ${tier === 'exclusive'
                        ? '<img class="sp-reward-icon" src="assets/ui/41-season-pass-exclusive.webp" alt="" width="64" height="46">'
                        : '<svg class="sp-reward-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5m-9 5v8M7.5 5.5l9 5"/></svg>'}
                    <p class="sp-tier"></p><p class="sp-threshold"></p><p class="sp-state"></p>`;
                card.querySelector('h3').textContent = `Stage ${day}`;
                card.querySelector('.sp-tier').textContent = tier === 'exclusive' ? 'Exclusive skin' : `${title(tier)} reward`;
                card.querySelector('.sp-threshold').textContent = `${points.format(threshold)} pts`;
                card.querySelector('.sp-state').textContent = status === 'claimed' ? '✓ Claimed'
                    : status === 'claimable' ? 'Ready to claim'
                    : status === 'future' ? `Locked · Day ${day}`
                    : blocked ? 'Locked · Claims paused' : 'Locked · Needs points';
                if (status === 'claimed') {
                    const receipt = document.createElement('p');
                    receipt.className = 'sp-receipt';
                    receipt.textContent = rewardLabel(season.claimed[day]);
                    card.append(receipt);
                } else if (status === 'claimable') {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'sp-claim lb-block-btn lb-block-btn--primary';
                    button.dataset.spDay = day;
                    button.setAttribute('aria-label', `Claim stage ${day} ${tier} reward`);
                    button.textContent = 'Claim reward';
                    card.append(button);
                }
                return card;
            }));
            if (focused) (find(`[data-sp-day="${focused}"]`) || find(`[data-stage="${focused}"]`))?.focus({ preventScroll: true });
            if (centerOnRender) {
                centerOnRender = false;
                if (!verticalTrack()) {
                    track.scrollLeft = next ? 0 : track.scrollWidth;
                    if (next?.day > 3) centerStage();
                }
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
            if (!isOpen()) return;
            clearInterval(timer);
            refresh(true);
            screen.hidden = true;
        }

        function open() {
            if (isOpen()) return;
            screen.hidden = false;
            screen.scrollTop = 0;
            centerOnRender = true;
            previous = null;
            announcement.textContent = '';
            refresh(true);
            timer = setInterval(refresh, 1000);
            return loadConfig();
        }
        retry.addEventListener('click', loadConfig);
        jump.addEventListener('click', () => {
            refresh();
            centerStage(true);
        });
        window.addEventListener('focus', () => { if (isOpen()) refresh(); });
        track.addEventListener('click', event => {
            const button = event.target.closest('[data-sp-day]');
            if (!button || !isOpen() || !config) return;
            const currentSave = getSave();
            const day = Number(button.dataset.spDay);
            const result = claimStage(currentSave, config, day, Date.now(), inventory());
            storeState(currentSave, result);
            if (result.reward) {
                (result.reward.contents || [result.reward]).forEach(grant);
                announcement.textContent = `Stage ${day} claimed: ${rewardLabel(result.reward)}`;
            }
            refresh(true);
        });
        return { open, close };
    }

    window.LBSeasonUI = { mount };
})();
