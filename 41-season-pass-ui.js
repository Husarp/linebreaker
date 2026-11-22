(() => {
    const { DAY, DAYS, observe, claimStage, storeState, stageStatus, prepareConfig, seasonState, summarizeTrack, exclusiveSkin } = window.LBSeason;
    const title = value => value[0].toUpperCase() + value.slice(1);
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
    const clockDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const points = new Intl.NumberFormat();
    const hour = DAY / 24;
    const minute = hour / 60;
    const stageNumber = value => String(value).padStart(2, '0');
    const icon = name => `<svg class="sp-state-icon" aria-hidden="true"><use href="#${name}"/></svg>`;

    function timeLeft(period, now) {
        const remaining = period.start + DAYS * DAY - now;
        if (!period.id || remaining >= 3 * DAY) return `${period.daysLeft} days left`;
        if (remaining >= DAY) return `${Math.floor(remaining / DAY)} d ${Math.floor(remaining % DAY / hour)} h left`;
        if (remaining < minute) return '<1 m left';
        return `${Math.floor(remaining / hour)} h ${Math.floor(remaining % hour / minute)} m left`;
    }

    function mount({ getSave, save, partName, boosterName, inventory, grant, claimAfterPaint }) {
        const screen = document.getElementById('season-pass-overlay');
        screen.innerHTML = `
            <div class="sp-shell">
                <header class="sp-hero lb-block-feature">
                    <p class="lb-block-kicker" id="sp-season"></p>
                    <h2 id="sp-title">Season progress</h2>
                    <div class="sp-meter" hidden>
                        <span id="sp-progress-text"></span>
                        <progress class="lb-block-progress" aria-label="Season points to next stage" aria-describedby="sp-progress-text" max="1" value="0"></progress>
                    </div>
                </header>
                <p id="sp-notice" class="sp-notice" role="status" hidden></p>
                <div class="sp-track-header">
                    <div><h2 class="lb-block-kicker" id="sp-track-title">Reward track</h2><p id="sp-track-rules" class="sp-sr-only">Stages open when their day arrives and you have enough points.</p></div>
                    <span class="lb-block-kicker" id="sp-stage-range" aria-hidden="true"></span>
                </div>
                <div id="sp-loading" role="status"></div>
                <button type="button" class="sp-retry lb-block-btn" hidden>Retry</button>
                <div class="sp-track lb-scroll-fade" role="region" aria-labelledby="sp-track-title" aria-describedby="sp-track-rules" tabindex="0" hidden><ol role="list"></ol></div>
                <aside class="sp-highlight lb-block-feature">
                    <div><span class="lb-block-kicker">Stage 30 · Exclusive</span><h2>Season Prism</h2><p>Season-exclusive skin</p></div>
                    <span class="sp-prism" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
                </aside>
                <div class="sp-season-details">
                    <div><p id="sp-days"></p><p id="sp-dates"></p></div>
                    <button type="button" class="sp-jump lb-block-btn" hidden></button>
                    <button type="button" class="lb-info-btn" data-help-section="missions" aria-label="About the Season Pass" data-control-tip="About the Season Pass"></button>
                </div>
                <p id="sp-announcement" class="sp-sr-only" role="status"></p>
            </div>`;
        const find = selector => screen.querySelector(selector);
        const track = find('.sp-track');
        const cards = find('ol');
        const range = find('#sp-stage-range');
        const jump = find('.sp-jump');
        const retry = find('.sp-retry');
        const countdown = find('#sp-days');
        const notice = find('#sp-notice');
        const loading = find('#sp-loading');
        const announcement = find('#sp-announcement');
        const menuStage = document.getElementById('lb-menu-season-stage');
        const missionStage = document.getElementById('mq-season-stage');
        let config, configRequest, timer, previous, saveCheckpoint;
        const isOpen = () => !screen.hidden;

        async function updatePreview() {
            await loadConfig();
            if (!config) return;
            const state = seasonState(getSave(), Date.now());
            const { current, next } = summarizeTrack(config.stages, state);
            const stage = current ? `Stage ${stageNumber(current.day)}` : '';
            const requirement = next ? `Next reward at ${points.format(next.points)} SP` : 'All rewards claimed';
            menuStage.textContent = stage ? `${stage} · View rewards` : 'View rewards';
            missionStage.textContent = stage ? `${stage} · ${requirement}` : requirement;
        }

        function rewardLabel(reward) {
            const { type, key, amount, tier, contents } = reward;
            if (type === 'crate') return `${title(tier)} Crate: ${contents.map(rewardLabel).join(', ')}`;
            if (type === 'skin') return `${key === exclusiveSkin.key ? exclusiveSkin.name : key} skin`;
            if (type === 'booster') return `${amount} × ${boosterName(key)}`;
            if (type === 'universal_parts') return `${amount} Universal ${amount === 1 ? 'Part' : 'Parts'}`;
            return `${amount} ${partName(key)} ${amount === 1 ? 'Part' : 'Parts'}`;
        }

        function revealStage(card, focus = false) {
            const first = card.previousElementSibling?.previousElementSibling || cards.firstElementChild;
            track.scrollTop += first.getBoundingClientRect().top - track.getBoundingClientRect().top;
            track.scrollTop += Math.max(0, card.getBoundingClientRect().bottom - track.getBoundingClientRect().bottom);
            if (focus) {
                const rail = track.getBoundingClientRect();
                const viewport = screen.getBoundingClientRect();
                screen.scrollTop += rail.top < viewport.top ? rail.top - viewport.top : Math.max(0, rail.bottom - viewport.bottom);
                card.focus({ preventScroll: true });
            }
        }

        function updateStageRange() {
            const bounds = track.getBoundingClientRect();
            const stages = [...cards.children].filter(card => {
                const row = card.getBoundingClientRect();
                return row.bottom > bounds.top && row.top < bounds.bottom;
            });
            const first = stages[0]?.dataset.stage;
            const last = stages.at(-1)?.dataset.stage;
            range.textContent = first ? `Stage ${stageNumber(first)}${first === last ? '' : `–${stageNumber(last)}`}` : '';
        }

        function render(state, now) {
            const { period, blocked, season, seasonBlockedUntil } = state;
            const label = timeLeft(period, now);
            if (countdown.textContent !== label) countdown.textContent = label;
            if (previous && previous.period.day === period.day && previous.period.id === period.id
                && previous.season === season && previous.points === season.points && previous.config === config
                && previous.blocked === blocked && previous.seasonBlockedUntil === seasonBlockedUntil) return;
            const newTrack = previous?.config !== config || previous?.period.id !== period.id;
            previous = { ...state, points: season.points, config };
            document.getElementById('sp-day').textContent = period.id ? `Day ${period.day} / ${DAYS}` : '';
            find('#sp-season').textContent = period.id ? `Season ${stageNumber(period.id)}` : '30-day season';
            find('#sp-dates').textContent = period.id ? `Started ${date.format(period.start)} (UTC)` : '';
            notice.hidden = !blocked;
            notice.textContent = blocked ? `Season claims are paused. Check your device date and time. Claims resume at ${clockDate.format(seasonBlockedUntil || period.start)} or later.` : '';
            find('.sp-meter').hidden = !config;
            track.hidden = !config;
            if (!config) return;

            const stages = config.stages.map(stage => ({ ...stage, status: stageStatus(stage, state) }));
            const { current, next } = summarizeTrack(stages, state);
            find('#sp-title').textContent = current ? `Stage ${stageNumber(current.day)}` : 'Season progress';
            const progressBar = find('progress');
            progressBar.hidden = !next;
            if (next) {
                progressBar.max = next.points;
                progressBar.value = Math.min(season.points, next.points);
            }
            find('#sp-progress-text').textContent = next
                ? `${points.format(progressBar.value)} / ${points.format(next.points)} SP to stage ${stageNumber(next.day)}`
                : `All ${DAYS} rewards claimed`;
            jump.hidden = !next;
            jump.textContent = next ? `Go to stage ${stageNumber(next.day)}` : '';

            const activeElement = document.activeElement;
            const focused = activeElement?.closest('.sp-card')?.dataset.stage;
            const openDetails = newTrack ? new Set() : new Set([...cards.querySelectorAll('details[open]')].map(detail => detail.closest('.sp-card').dataset.stage));
            const progressBetween = (from, to) => Math.max(0, Math.min(1, (season.points - from) / (to - from)));
            cards.replaceChildren(...stages.map(({ day, tier, points: threshold, status }, index) => {
                const card = document.createElement('li');
                card.className = 'sp-card';
                card.dataset.stage = day;
                card.dataset.tier = tier;
                card.dataset.rarity = tier === 'exclusive' ? 'mythic' : tier;
                card.dataset.state = status;
                if (season.points >= threshold) card.dataset.reached = '';
                if (index < stages.length - 1) {
                    const progress = progressBetween(threshold, stages[index + 1].points);
                    card.style.setProperty('--sp-outgoing', `${100 * Math.min(1, progress * 2)}%`);
                }
                if (index > 0) {
                    const progress = progressBetween(stages[index - 1].points, threshold);
                    card.style.setProperty('--sp-incoming', `${100 * Math.max(0, progress * 2 - 1)}%`);
                }
                card.tabIndex = -1;
                if (day === next?.day) {
                    card.dataset.next = '';
                    card.setAttribute('aria-current', 'step');
                }
                card.innerHTML = `<span class="sp-step" aria-hidden="true">${stageNumber(day)}</span>
                    <div class="sp-row lb-block-card">
                        <img class="sp-reward-icon" src="assets/ui/crates/${tier === 'exclusive' ? 'mythic' : tier}.png" alt="" width="39" height="39" decoding="async">
                        <h3><span class="sp-sr-only">Stage ${day}: </span>${tier === 'exclusive' ? exclusiveSkin.name : `${title(tier)} Crate`}</h3>
                    </div>`;
                const row = card.querySelector('.sp-row');
                if (status === 'claimable') {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'sp-claim lb-block-btn lb-block-btn--primary lb-ledger-claim';
                    button.dataset.spDay = day;
                    button.setAttribute('aria-label', `Claim stage ${day} ${tier} reward`);
                    button.textContent = 'Claim';
                    row.append(button);
                } else {
                    const claimed = status === 'claimed';
                    const requirement = `${points.format(threshold)} SP`;
                    const reason = status === 'future' ? `Locked until day ${day}` : blocked ? 'Claims paused' : 'Needs points';
                    const details = document.createElement('details');
                    details.className = 'sp-state lb-block-expand';
                    details.open = openDetails.has(String(day));
                    const label = claimed ? `Stage ${day} claimed: Show reward` : `Stage ${day}: ${reason}, ${requirement}`;
                    details.innerHTML = `<summary class="lb-ledger-tag" aria-label="${label}">${day === next?.day ? requirement : icon(claimed ? 'lb-reward-check' : 'play-icon-lock')}</summary>
                        <p class="lb-block-expand-body${claimed ? ' sp-receipt' : ''}"></p>`;
                    details.querySelector('p').textContent = claimed ? rewardLabel(season.claimed[day]) : `${reason} · ${requirement}`;
                    row.append(details);
                }
                return card;
            }));
            if (newTrack) revealStage(cards.children[(next?.day ?? DAYS) - 1]);
            updateStageRange();
            if (focused) {
                const card = find(`[data-stage="${focused}"]`);
                const control = activeElement.matches('summary, button') ? card?.querySelector('summary, button') : null;
                (control || card)?.focus({ preventScroll: true });
            }
        }

        function refresh(persist = false) {
            const currentSave = getSave();
            const before = currentSave.seasonBlockedUntil;
            const oldSeason = currentSave.season;
            const now = Date.now();
            const state = observe(currentSave, now);
            if (persist || state.seasonBlockedUntil !== before || state.season !== oldSeason || state.lastSeenTime - saveCheckpoint >= 60_000) {
                saveCheckpoint = state.lastSeenTime;
                save();
            }
            render(state, now);
        }

        function loadConfig() {
            if (config || configRequest) return configRequest;
            retry.hidden = true;
            loading.textContent = 'Loading reward track…';
            const bounded = window.LBStartup?.bounded || ((label, action) => action());
            configRequest = bounded('Season reward track', async () => {
                const response = await fetch('data/season.json');
                if (!response.ok) throw new Error('Could not load the reward track');
                return prepareConfig(await response.json());
            }).then(loaded => {
                config = loaded;
                loading.textContent = '';
                if (isOpen()) refresh();
            }).catch(() => {
                loading.textContent = 'The reward track could not load. Try again.';
                retry.hidden = false;
            }).finally(() => {
                configRequest = null;
            });
            return configRequest;
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
            previous = null;
            announcement.textContent = '';
            refresh(true);
            timer = setInterval(refresh, 1000);
            return loadConfig();
        }
        retry.addEventListener('click', loadConfig);
        track.addEventListener('scroll', updateStageRange, { passive: true });
        jump.addEventListener('click', () => {
            refresh();
            const card = cards.querySelector('[data-next]');
            if (card) revealStage(card, true);
        });
        window.addEventListener('focus', () => { if (isOpen()) refresh(); });
        track.addEventListener('click', event => {
            const button = event.target.closest('[data-sp-day]');
            if (!button || !isOpen() || !config) return;
            const day = Number(button.dataset.spDay);
            claimAfterPaint(button, () => {
                if (!isOpen()) return;
                const currentSave = getSave();
                const result = claimStage(currentSave, config, day, Date.now(), inventory());
                storeState(currentSave, result);
                if (result.reward) {
                    (result.reward.contents || [result.reward]).forEach(grant);
                    announcement.textContent = `Stage ${day} claimed: ${rewardLabel(result.reward)}`;
                }
                refresh(true);
            });
        });
        return { open, close, updatePreview };
    }

    window.LBSeasonUI = { mount };
})();
