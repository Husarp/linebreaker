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
            return { icon: '🧩', label: `+1 Part: ${partName(item.key)}`, rarity: item.cat === 'ghostColor' ? 'epic' : 'common' };
        });
        const universal = plan.universal + plan.parts - items.length;
        addUniversal(universal);
        cards.push({ icon: '⭐', label: `+${universal} Universal Part${universal === 1 ? '' : 's'}`, rarity: 'rare' });
        const booster = boosterInfo[plan.booster];
        for (let count = 0; count < plan.boosters; count++) addBooster(plan.booster);
        cards.push({ ...booster, label: `${plan.boosters} × ${booster.label}` });
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
        const button = element('button', 'lb43-action', text);
        button.type = 'button';
        return button;
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

    function showDailyGift(rarity, plan, streak, cards, onClose) {
        const overlay = element('div', 'lb-reward-overlay lb43-gift-overlay');
        overlay.id = 'daily-gift-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'lb43-gift-title');
        const panel = element('div', 'lb43-gift-panel');
        const title = element('h2', '', 'Daily Gift');
        title.id = 'lb43-gift-title';
        const streakText = `${streak}-day gift streak${plan.bonus ? ` · +${plan.bonus} bonus universal ${plan.bonus === 1 ? 'part' : 'parts'}` : ''}`;
        const preOpen = element('div', 'lb43-pre-open');
        const open = action('Open crate');
        preOpen.append(open);
        const rewards = element('div');
        rewards.style.display = 'none';
        const grid = element('div', 'lb-reward-grid lb43-gift-grid');
        for (const reward of cards) {
            const card = element('div', 'lb-reward-card lb43-gift-card');
            card.dataset.rarity = reward.rarity;
            const icon = element('span', 'lb43-gift-icon', reward.icon);
            icon.setAttribute('aria-hidden', 'true');
            card.append(icon, element('strong', '', reward.label), element('div', 'lb-reward-rarity', reward.rarity));
            grid.append(card);
        }
        const done = action('Done');
        rewards.append(grid, done);
        panel.append(title, element('p', 'lb43-gift-streak', streakText), preOpen, rewards);
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

    function mountDailyGift({ button, getSave, ready, save, grant, onClose }) {
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
        button.addEventListener('click', () => {
            if (!ready() || button.closest('.hidden') || document.querySelector('.lb-reward-overlay')) return;
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
            showDailyGift(rarity, plan, state.streak, cards, () => {
                button.focus({ preventScroll: true });
                onClose();
            });
        });
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
        return { refresh, isOpen };
    }

    window.LBCrates = Object.freeze({ giftStatus, observeTime, rollRarity, giftContents, levelRarity, missionRarity, grantDailyGift, bindReveal, mountDailyGift });
})();
