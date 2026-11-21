(() => {
    'use strict';

    const rarities = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    const weights = [60, 25, 10, 4, 1];
    const contents = [
        { parts: 2, universal: 1, booster: '1.25x_game', boosters: 1 },
        { parts: 3, universal: 1, booster: '1.5x_game', boosters: 1 },
        { parts: 5, universal: 2, booster: '1.5x_game', boosters: 2 },
        { parts: 7, universal: 3, booster: '2xp_game', boosters: 2 },
        { parts: 10, universal: 5, booster: '2xp_game', boosters: 3 },
    ];
    const rankTiers = ['common', 'rare', 'rare', 'epic', 'epic', 'legendary', 'legendary', 'legendary', 'mythic'];
    const dailyTiers = { 6: 'common', 9: 'rare', 12: 'epic' };
    const weeklyTiers = { 60: 'rare', 90: 'epic', 120: 'legendary', 150: 'mythic' };
    const rollbackTolerance = 10 * 60_000;

    function giftStatus(save, now = new Date()) {
        const day = LBSave.localDate(now);
        const previous = new Date(now.getTime());
        previous.setDate(previous.getDate() - 1);
        const streak = save.lastDailyGift === LBSave.localDate(previous)
            ? Math.min(100_000, Math.max(1, save.dailyGiftStreak || 0) + 1) : 1;
        if (save.lastSeenTime - now.getTime() > rollbackTolerance || save.lastDailyGift > day) {
            return { day, streak, status: 'clock-blocked' };
        }
        if (save.lastDailyGift === day) return { day, streak: save.dailyGiftStreak || 1, status: 'claimed' };
        return { day, streak, status: 'available' };
    }

    function observeTime(save, now = Date.now()) {
        if (now <= (save.lastSeenTime || 0)) return false;
        save.lastSeenTime = now;
        return true;
    }

    function rollRarity(roll = Math.random()) {
        let cutoff = 0;
        for (const [index, weight] of weights.entries()) {
            cutoff += weight;
            if (roll < cutoff / 100) return rarities[index];
        }
        return 'mythic';
    }

    function giftContents(rarity, streak) {
        const base = contents[rarities.indexOf(rarity)] || contents[0];
        const bonus = Math.min(3, Math.max(0, streak - 1));
        return { ...base, bonus, universal: base.universal + bonus };
    }

    function levelRarity(level) {
        return rankTiers[Math.min(rankTiers.length - 1, Math.floor((Math.max(1, level) - 1) / 10))];
    }

    function missionRarity(points, weekly) {
        return (weekly ? weeklyTiers : dailyTiers)[points] || 'common';
    }

    function grantDailyGift(data, plan, { pickParts, addPart, partName, addUniversal, addBooster, boosterInfo }) {
        const items = pickParts(plan.parts);
        const cards = items.map(item => {
            addPart(item.key, 1);
            return { type: 'parts', key: item.key, label: `${partName(item.key)} Part`, amount: 1, rarity: item.cat === 'ghostColor' ? 'epic' : 'common' };
        });
        const universal = plan.universal + plan.parts - items.length;
        addUniversal(universal);
        const universalCard = { type: 'universal_parts', label: 'Universal Part', rarity: 'rare' };
        cards.push({ ...universalCard, amount: universal - plan.bonus });
        const booster = boosterInfo[plan.booster];
        for (let count = 0; count < plan.boosters; count++) addBooster(plan.booster);
        cards.push({ type: 'booster', key: plan.booster, label: booster.label, amount: plan.boosters, rarity: booster.rarity });
        if (plan.bonus) cards.push({ ...universalCard, amount: plan.bonus, tag: 'Streak bonus' });
        data.stats.rareItemsFromDailyBox = (Number(data.stats.rareItemsFromDailyBox) || 0) + universal
            + (booster.rarity === 'common' ? 0 : plan.boosters) + items.filter(item => item.cat === 'ghostColor').length;
        return cards;
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    function action(text) {
        const button = element('button', 'lb64-action lb-block-btn lb-block-btn--primary', text);
        button.type = 'button';
        return button;
    }

    function rewardGrid(rewards, formatDescription) {
        const grid = element('div', 'lb-reward-grid lb64-rewards');
        const groups = new Map();
        for (const reward of rewards) {
            const group = JSON.stringify([reward.type, reward.key, reward.label, reward.rarity, reward.tag, reward.desc]);
            const existing = groups.get(group);
            const amount = Number.isFinite(reward.amount) ? reward.amount : 1;
            if (existing) existing.amount += amount;
            else groups.set(group, { ...reward, amount });
        }
        for (const reward of groups.values()) {
            const card = element('div', 'lb-reward-card lb-block-reward');
            card.dataset.rarity = reward.rarity;
            const image = element('img');
            image.alt = '';
            const isPart = reward.type === 'parts' || reward.type === 'universal_parts';
            image.src = isPart ? window.LBArtPack.universalPart
                : (reward.type === 'booster' && window.LBArtPack.boosterToken(reward.key)) || 'assets/ui/64-item-part.svg';
            let art = image;
            if (reward.type === 'parts') {
                art = element('span', 'lb124-part-art');
                art.dataset.partKey = reward.key ?? '';
                art.setAttribute('aria-hidden', 'true');
                art.append(image);
            }
            const quantity = Number(reward.amount.toFixed(1));
            const amount = element('span', 'lb-block-reward-amount', `×${quantity}`);
            amount.setAttribute('aria-label', `Quantity: ${quantity}`);
            card.append(art, element('strong', 'lb64-reward-name', reward.label), amount);
            if (reward.tag) card.append(element('span', 'lb64-reward-tag', reward.tag));
            if (reward.desc) {
                const description = element('small', 'lb64-reward-desc', reward.desc);
                if (formatDescription) description.innerHTML = formatDescription(reward.desc);
                card.append(description);
            }
            card.append(element('span', 'lb-reward-rarity', reward.rarity));
            grid.append(card);
        }
        return grid;
    }

    function streakMeter(streak) {
        const meter = element('div', 'lb43-gift-streak lb64-streak');
        const weekDays = 7;
        const completed = (streak - 1) % weekDays + 1;
        meter.setAttribute('role', 'img');
        meter.setAttribute('aria-label', `${streak}-day gift streak, day ${completed} of ${weekDays} this cycle`);
        const count = element('span', 'lb64-streak-count');
        const flame = element('span', 'mq-streak-flame', '🔥');
        flame.setAttribute('aria-hidden', 'true');
        count.append(flame, element('span', '', streak));
        const dots = element('span', 'lb64-streak-dots');
        for (let day = 1; day <= weekDays; day++) {
            dots.append(element('span', day === completed ? 'lb64-streak-today' : day < completed ? 'lb64-streak-filled' : ''));
        }
        meter.append(count, dots);
        return meter;
    }

    function bindReveal(preOpen, rewards, grid, rarity) {
        const art = element('figure', 'lb43-crate');
        art.dataset.rarity = rarity;
        const sprite = element('div', 'lb43-crate-sprite');
        for (const layer of ['body', 'lid']) {
            const image = element('img', `lb43-crate-${layer}`);
            image.src = `assets/ui/crates/${rarity}.png`;
            image.alt = '';
            sprite.append(image);
        }
        art.append(sprite, element('figcaption', '', `${rarity} crate`));
        preOpen.before(art);

        const open = preOpen.querySelector('button');
        const claim = rewards.querySelector('button');
        grid.classList.add('lb43-crate-cards');
        for (const [index, card] of Array.from(grid.children).entries()) {
            card.style.setProperty('--lb43-card-delay', `${Math.min(index, 8) * 36}ms`);
        }
        open.addEventListener('click', () => {
            const reveal = () => {
                if (!art.isConnected) return;
                art.hidden = preOpen.hidden = true;
                rewards.style.display = 'block';
                claim.focus({ preventScroll: true });
            };
            if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
                reveal();
            } else {
                open.setAttribute('aria-disabled', 'true');
                art.classList.add('lb43-crate-opening');
                window.setTimeout(reveal, 490);
            }
        }, { once: true });
        open.focus({ preventScroll: true });
    }

    function showDailyGift(rarity, streak, cards, onClose) {
        const overlay = element('div', 'lb-reward-overlay lb43-gift-overlay lb64-crate-overlay');
        overlay.id = 'daily-gift-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'lb43-gift-title');
        const panel = element('div', 'lb64-crate-panel lb64-daily-panel lb-block-panel');
        const title = element('h2', 'lb64-crate-title', 'Daily Gift');
        title.id = 'lb43-gift-title';
        const preOpen = element('div', 'lb43-pre-open');
        const open = action('Open crate');
        preOpen.append(open);
        const rewards = element('div');
        rewards.style.display = 'none';
        const grid = rewardGrid(cards);
        const done = action('Done');
        rewards.append(grid, done);
        panel.append(title, streakMeter(streak), preOpen, rewards);
        overlay.append(panel);
        document.body.append(overlay);
        const close = () => {
            overlay.remove();
            onClose();
        };
        done.addEventListener('click', close);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Tab') {
                event.preventDefault();
                (preOpen.hidden ? done : open).focus();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        });
        bindReveal(preOpen, rewards, grid, rarity);
    }

    function mountDailyGift({ button, getSave, ready, save, grant, onClose, claimAfterPaint }) {
        const text = button.querySelector('.lb43-gift-status');
        const isOpen = () => Boolean(document.getElementById('daily-gift-overlay'));
        let clockCheckpoint;
        function refresh() {
            const state = giftStatus(getSave());
            const status = ready() ? state.status : 'loading';
            button.dataset.status = status;
            button.setAttribute('aria-disabled', String(status !== 'available'));
            text.textContent = {
                available: 'Claim free crate', claimed: 'Claimed today',
                'clock-blocked': 'Check system clock', loading: 'Checking save…',
            }[status];
            return state;
        }
        function claim() {
            if (!ready() || button.closest('.hidden') || document.querySelector('.lb-reward-overlay')) return;
            const state = refresh();
            if (state.status !== 'available') return;
            return claimAfterPaint(button, () => {
                if (!ready() || document.querySelector('.lb-reward-overlay')) return;
                const state = refresh();
                if (state.status !== 'available') return;
                const data = getSave();
                const rarity = rollRarity();
                const plan = giftContents(rarity, state.streak);
                data.lastDailyGift = state.day;
                data.dailyGiftStreak = state.streak;
                const cards = grant(plan);
                save();
                refresh();
                showDailyGift(rarity, state.streak, cards, () => {
                    button.focus({ preventScroll: true });
                    onClose();
                });
            });
        }
        button.addEventListener('click', claim);
        function checkpoint() {
            if (ready()) {
                const data = getSave();
                observeTime(data);
                if (data.lastSeenTime !== clockCheckpoint) {
                    clockCheckpoint = data.lastSeenTime;
                    save();
                }
            }
            refresh();
        }
        window.setInterval(checkpoint, 60_000);
        window.addEventListener('pagehide', checkpoint);
        document.addEventListener('visibilitychange', checkpoint);
        window.addEventListener('focus', checkpoint);
        button.addEventListener('focus', refresh);
        return { refresh, isOpen, claim };
    }

    window.LBCrates = Object.freeze({ giftStatus, observeTime, rollRarity, giftContents, levelRarity, missionRarity, grantDailyGift, rewardGrid, bindReveal, mountDailyGift });
})();
