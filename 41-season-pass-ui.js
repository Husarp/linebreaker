(() => {
    const { DAY, observe, claimStage, claimBonus, bonusProgress, storeState, stageStatus, prepareConfig, seasonState, summarizeTrack, exclusiveSkin } = window.LBSeason;
    const title = value => value[0].toUpperCase() + value.slice(1);
    const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
    const clockDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const points = new Intl.NumberFormat();
    const hour = DAY / 24;
    const minute = hour / 60;
    const stageNumber = value => String(value).padStart(2, '0');
    const icon = name => `<svg class="sp-state-icon" aria-hidden="true"><use href="#${name}"/></svg>`;
    const crateIcon = tier => `<img class="sp-reward-icon" src="assets/ui/crates/${tier}.png" alt="" width="39" height="39" decoding="async">`;
    const prismIcon = `<span class="sp-reward-icon sp-prism" aria-hidden="true"><span></span><span></span><span></span><span></span></span>`;

    function timeLeft(period, now) {
        if (!period.id) return '';
        const remaining = period.end - now;
        if (remaining >= 3 * DAY) return `${period.daysLeft} days left`;
        if (remaining >= DAY) return `${Math.floor(remaining / DAY)} d ${Math.floor(remaining % DAY / hour)} h left`;
        if (remaining < minute) return '<1 m left';
        return `${Math.floor(remaining / hour)} h ${Math.floor(remaining % hour / minute)} m left`;
    }

    function mount({ getSave, save, partName, boosterName, grantCrate, grantSkin, claimAfterPaint, onNavigate }) {
        const screen = document.getElementById('season-pass-overlay');
        const back = document.getElementById('mq-back');
        const seasonDay = document.getElementById('sp-day');
        document.getElementById('missions-overlay').after(screen);
        screen.className = 'overlay sp-pass';
        screen.setAttribute('data-lb-bar-screen', '');
        screen.setAttribute('aria-labelledby', 'sp-screen-title');
        screen.innerHTML = `
            <header class="lb-header lb-block-topbar mq-header" data-lb-topbar>
                <div class="lb-topbar-crumb">
                    <span class="lb-topbar-kicker" aria-hidden="true">Rewards</span>
                    <h1 class="lb-topbar-title" id="sp-screen-title">Season Pass</h1>
                </div>
            </header>
            <div class="sp-shell">
                <header class="sp-hero lb-block-feature" data-ledger-tone="reward">
                    <p class="lb-block-kicker" id="sp-season"></p>
                    <h2 id="sp-title">Season progress</h2>
                    <div class="sp-meter" hidden>
                        <span id="sp-progress-text"></span>
                        <div class="sp-meter-bar">
                            <progress class="lb-block-progress" aria-label="Season points to next stage" aria-describedby="sp-progress-text" max="1" value="0"></progress>
                            <div class="sp-meter-segments" aria-hidden="true"></div>
                        </div>
                    </div>
                </header>
                <p id="sp-notice" class="sp-notice" role="status" hidden></p>
                <div class="sp-track-header">
                    <div><h2 class="lb-block-kicker" id="sp-track-title">Reward track</h2><p id="sp-track-rules" class="sp-sr-only">Earn Season Points from missions and quests to unlock stages.</p></div>
                    <span class="lb-block-kicker" id="sp-stage-range" aria-hidden="true"></span>
                </div>
                <div class="sp-track-wrap">
                    <div id="sp-loading" role="status"></div>
                    <button type="button" class="sp-retry lb-block-btn" hidden>Retry</button>
                    <div class="sp-track lb-scroll-fade" role="region" aria-labelledby="sp-track-title" aria-describedby="sp-track-rules" tabindex="0" hidden><ol role="list"></ol></div>
                    <button type="button" class="sp-jump lb-block-btn lb-block-btn--icon" hidden>${icon('lb-topbar-arrow')}</button>
                </div>
                <div class="sp-season-details">
                    <div><p id="sp-days"></p><p id="sp-dates"></p></div>
                    <button type="button" class="lb-info-btn" data-help-section="missions" aria-label="About the Season Pass" data-control-tip="About the Season Pass"></button>
                </div>
                <p id="sp-announcement" class="sp-sr-only" role="status"></p>
            </div>`;
        const find = selector => screen.querySelector(selector);
        find('.lb-topbar-crumb').prepend(back);
        find('[data-lb-topbar]').append(seasonDay);
        back.hidden = seasonDay.hidden = false;
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
        let config, configRequest, timer, previous, saveCheckpoint, returnTo;
        const isOpen = () => !screen.hidden;

        async function updatePreview() {
            await loadConfig();
            if (!config) return;
            const state = seasonState(getSave(), Date.now());
            const { current, next } = summarizeTrack(config.stages, state);
            const stage = current ? `Stage ${stageNumber(current.number)}` : '';
            const requirement = next ? `Next reward at ${points.format(next.points)} SP` : `Bonus chest every ${points.format(config.bonusStep)} SP`;
            menuStage.textContent = stage ? `${stage} · View rewards` : 'View rewards';
            missionStage.textContent = stage ? `${stage} · ${requirement}` : requirement;
        }

        function rewardLabel(reward) {
            const { type, key, amount, tier, contents } = reward;
            if (type === 'crate') return `${title(tier)} Crate${contents?.length ? `: ${contents.map(rewardLabel).join(', ')}` : ''}`;
            if (type === 'skin') return `${key === exclusiveSkin.key ? exclusiveSkin.name : key} skin`;
            if (type === 'booster') return `${amount} × ${boosterName(key)}`;
            if (type === 'universal_parts') return `${amount} Universal ${amount === 1 ? 'Part' : 'Parts'}`;
            return `${amount} ${partName(key)} ${amount === 1 ? 'Part' : 'Parts'}`;
        }

        function revealStage(card, focus = false) {
            const first = card.previousElementSibling?.previousElementSibling || cards.firstElementChild;
            track.scrollTop += first.getBoundingClientRect().top - track.getBoundingClientRect().top;
            track.scrollTop += Math.max(0, card.getBoundingClientRect().bottom - track.getBoundingClientRect().bottom);
            if (focus) card.focus({ preventScroll: true });
            updateTrackViewport();
        }

        function updateTrackViewport() {
            const bounds = track.getBoundingClientRect();
            const visible = [...cards.querySelectorAll('[data-stage]')].filter(card => {
                const row = card.getBoundingClientRect();
                return row.bottom > bounds.top && row.top < bounds.bottom;
            });
            const first = visible[0]?.dataset.stage;
            const last = visible.at(-1)?.dataset.stage;
            range.textContent = first ? `Stage ${stageNumber(first)}${first === last ? '' : `–${stageNumber(last)}`}` : '';
            const current = cards.querySelector('[data-next]');
            const row = current?.getBoundingClientRect();
            const direction = !isOpen() || !row || bounds.bottom <= bounds.top ? ''
                : row.bottom <= bounds.top ? 'up' : row.top >= bounds.bottom ? 'down' : '';
            jump.hidden = !direction;
            jump.dataset.direction = direction;
            const target = current?.dataset.stage;
            jump.setAttribute('aria-label', target ? `Scroll to stage ${stageNumber(target)}` : 'Scroll to bonus chest');
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
            seasonDay.textContent = period.id ? `Day ${period.day} / ${period.days}` : '';
            find('#sp-season').textContent = period.id ? `Season ${stageNumber(period.id)}` : 'Monthly season';
            find('#sp-dates').textContent = period.id ? `Ends ${date.format(period.end - 1)}` : '';
            notice.hidden = !blocked;
            notice.textContent = blocked ? `Season claims are paused. Check your device date and time. Claims resume at ${clockDate.format(seasonBlockedUntil || period.start)} or later.` : '';
            find('.sp-meter').hidden = !config;
            track.hidden = !config;
            if (!config) return;

            const stages = config.stages;
            const { current, next } = summarizeTrack(stages, state);
            const target = next ? current || stages[0] : null;
            const nextUnlock = stages[current?.number || 0];
            find('#sp-title').textContent = current ? `Stage ${stageNumber(current.number)}` : 'Season progress';
            const progressBar = find('.sp-meter progress');
            find('.sp-meter-bar').hidden = progressBar.hidden = !nextUnlock;
            if (nextUnlock) {
                progressBar.max = nextUnlock.points;
                progressBar.value = season.points;
                const filledDays = progressBar.value / progressBar.max * period.days;
                find('.sp-meter-segments').innerHTML = Array.from({ length: period.days }, (_, dayIndex) => {
                    const fill = Math.max(0, Math.min(1, filledDays - dayIndex));
                    return `<span style="--sp-day-fill:${fill * 100}%"></span>`;
                }).join('');
            }
            find('#sp-progress-text').textContent = nextUnlock
                ? `${points.format(season.points)} / ${points.format(nextUnlock.points)} SP to stage ${stageNumber(nextUnlock.number)}`
                : `${points.format(season.points)} SP · All stages ${next ? 'unlocked' : 'claimed'}`;

            const activeElement = document.activeElement;
            const focused = activeElement?.closest('.sp-card');
            const openDetails = newTrack ? new Set() : new Set([...cards.querySelectorAll('details[open]')].map(detail => detail.closest('.sp-card').dataset.stage));
            const progressBetween = (from, to) => Math.max(0, Math.min(1, (season.points - from) / (to - from)));
            const rows = stages.map((stage, index) => {
                const { number, tier, points: threshold } = stage;
                const status = stageStatus(stage, state);
                const card = document.createElement('li');
                card.className = 'sp-card';
                card.dataset.stage = number;
                card.dataset.tier = tier;
                card.dataset.rarity = tier;
                card.dataset.state = status;
                if (season.points >= threshold) card.dataset.reached = '';
                const progress = progressBetween(threshold, stages[index + 1]?.points ?? threshold + config.bonusStep);
                card.style.setProperty('--sp-outgoing', `${100 * Math.min(1, progress * 2)}%`);
                if (index > 0) {
                    const progress = progressBetween(stages[index - 1].points, threshold);
                    card.style.setProperty('--sp-incoming', `${100 * Math.max(0, progress * 2 - 1)}%`);
                }
                card.tabIndex = -1;
                if (stage === target) {
                    card.dataset.next = '';
                    card.setAttribute('aria-current', 'step');
                }
                card.innerHTML = `<span class="sp-step" aria-hidden="true">${stageNumber(number)}</span>
                    <div class="sp-row lb-block-card">
                        ${tier === 'exclusive' ? prismIcon : crateIcon(tier)}
                        <h3><span class="sp-sr-only">Stage ${number}: </span>${tier === 'exclusive' ? exclusiveSkin.name : `${title(tier)} Crate`}</h3>
                    </div>`;
                const row = card.querySelector('.sp-row');
                if (status === 'claimable') {
                    row.append(claimButton(number, `Claim stage ${number} ${tier} reward`));
                } else {
                    const claimed = status === 'claimed';
                    const remaining = Math.max(0, threshold - season.points);
                    const requirement = remaining ? `${points.format(remaining)} SP to go` : 'Claims paused';
                    const details = document.createElement('details');
                    details.className = 'sp-state lb-block-expand';
                    details.open = openDetails.has(String(number));
                    const label = claimed ? `Stage ${number} claimed: Show reward` : `Stage ${number}: ${requirement}`;
                    details.innerHTML = `<summary class="lb-ledger-tag" aria-label="${label}">${icon(claimed ? 'lb-reward-check' : 'play-icon-lock')}</summary>
                        <p class="lb-block-expand-body${claimed ? ' sp-receipt' : ''}"></p>`;
                    details.querySelector('p').textContent = claimed ? rewardLabel(season.claimed[number]) : requirement;
                    row.append(details);
                }
                return card;
            });
            const bonus = renderBonus(state, !next, progressBetween(config.bonusStart, config.bonusStart + config.bonusStep));
            cards.replaceChildren(...rows, bonus);
            if (newTrack) revealStage(target ? rows[target.number - 1] : bonus);
            updateTrackViewport();
            if (focused) {
                const card = focused.hasAttribute('data-bonus') ? bonus : rows[Number(focused.dataset.stage) - 1];
                const control = activeElement.matches('summary, button') ? card?.querySelector('summary, button') : null;
                (control || card)?.focus({ preventScroll: true });
            }
        }

        function claimButton(target, label) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'sp-claim lb-block-btn lb-block-btn--primary lb-ledger-claim';
            button.dataset.spClaim = target;
            button.setAttribute('aria-label', label);
            button.textContent = 'Claim';
            return button;
        }

        function renderBonus(state, next, incoming) {
            const { ready, points: progress } = bonusProgress(config, state);
            const step = config.bonusStep;
            const card = document.createElement('li');
            card.className = 'sp-card sp-bonus';
            card.dataset.bonus = '';
            card.dataset.state = ready && !state.blocked ? 'claimable' : 'locked';
            card.tabIndex = -1;
            card.style.setProperty('--sp-incoming', `${100 * Math.max(0, incoming * 2 - 1)}%`);
            if (next) {
                card.dataset.next = '';
                card.setAttribute('aria-current', 'step');
            }
            card.innerHTML = `<span class="sp-step" aria-hidden="true">+</span>
                <div class="sp-row lb-block-card">
                    ${crateIcon('rare')}
                    <div class="sp-bonus-copy">
                        <h3>Bonus chest · every ${points.format(step)} SP</h3>
                        <p><span class="sp-sr-only">Rare crate · </span><span id="sp-bonus-progress">${ready ? `${points.format(ready)} ready · ` : ''}${points.format(progress)} / ${points.format(step)} SP</span></p>
                        <progress class="lb-block-progress" aria-label="Points toward the next rare crate" aria-describedby="sp-bonus-progress" max="${step}" value="${progress}"></progress>
                    </div>
                </div>`;
            if (card.dataset.state === 'claimable') card.querySelector('.sp-row').append(claimButton('bonus', 'Claim rare bonus chest'));
            return card;
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
            onNavigate();
            clearInterval(timer);
            refresh(true);
            screen.hidden = true;
            returnTo.source?.toggleAttribute('inert', returnTo.wasInert);
            returnTo.opener?.focus({ preventScroll: true });
            returnTo = null;
        }

        function open(opener, source) {
            if (isOpen()) return;
            onNavigate();
            returnTo = { opener, source, wasInert: source?.hasAttribute('inert') };
            source?.setAttribute('inert', '');
            screen.style.zIndex = Math.max(1005, (parseInt(source && getComputedStyle(source).zIndex, 10) || 0) + 1);
            const title = source?.querySelector('.lb-topbar-title')?.textContent || 'menu';
            back.setAttribute('aria-label', `Back to ${title}`);
            screen.hidden = false;
            previous = null;
            announcement.textContent = '';
            refresh(true);
            back.focus({ preventScroll: true });
            timer = setInterval(refresh, 1000);
            return loadConfig();
        }
        back.addEventListener('click', close);
        retry.addEventListener('click', loadConfig);
        track.addEventListener('scroll', updateTrackViewport, { passive: true });
        cards.addEventListener('toggle', updateTrackViewport, true);
        if (window.ResizeObserver) new ResizeObserver(updateTrackViewport).observe(track);
        jump.addEventListener('click', () => {
            const card = cards.querySelector('[data-next]');
            if (card) revealStage(card, true);
        });
        window.addEventListener('focus', () => { if (isOpen()) refresh(); });
        track.addEventListener('click', event => {
            const button = event.target.closest('[data-sp-claim]');
            if (!button || !isOpen() || !config) return;
            const target = button.dataset.spClaim;
            claimAfterPaint(button, () => {
                if (!isOpen()) return;
                const currentSave = getSave();
                const now = Date.now();
                const result = target === 'bonus' ? claimBonus(currentSave, config, now, grantCrate)
                    : claimStage(currentSave, config, Number(target), now, grantCrate);
                storeState(currentSave, result);
                if (result.reward) {
                    if (result.reward.type === 'skin') grantSkin(result.reward.key);
                    const label = target === 'bonus' ? 'Bonus chest' : `Stage ${target}`;
                    announcement.textContent = `${label} claimed: ${rewardLabel(result.reward)}`;
                }
                refresh(true);
            });
        });
        return { open, close, isOpen, updatePreview };
    }

    window.LBSeasonUI = { mount };
})();
