(() => {
    'use strict';

    const rarities = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    const weights = [70, 22, 6.5, 1.3, 0.2];
    const DAILY_GIFT_TAPS = 3;
    const DAILY_GIFT_UPGRADE_CHANCE = 0.25;
    const DAILY_GIFT_MAX_RARITY = 'epic';
    const DAILY_GIFT_SHAKE_MS = 230;
    const contents = [
        { parts: 2, universal: 1, booster: '1.25x_game', boosters: 1 },
        { parts: 3, universal: 1, booster: '1.5x_game', boosters: 1 },
        { parts: 5, universal: 2, booster: '1.5x_game', boosters: 2 },
        { parts: 7, universal: 3, booster: '2xp_game', boosters: 2 },
        { parts: 10, universal: 5, booster: '2xp_game', boosters: 3 },
    ];
    const rankTiers = ['common', 'rare', 'rare', 'epic', 'epic', 'legendary', 'legendary', 'legendary', 'mythic'];
    const dailyTiers = { 6: 'common', 9: 'common', 12: 'rare' };
    const weeklyTiers = { 60: 'rare', 90: 'epic', 120: 'epic' };
    const rollbackTolerance = 10 * 60_000;

    function giftStatus(save, now = new Date()) {
        const day = LBSave.localDate(now);
        if (save.lastSeenTime - now.getTime() > rollbackTolerance || save.lastDailyGift > day || save.pendingDailyGift?.day > day) {
            return { day, status: 'clock-blocked' };
        }
        if (save.pendingDailyGift) return { day, status: 'in-progress' };
        return { day, status: save.lastDailyGift === day ? 'claimed' : 'available' };
    }

    function shakeGift(gift, roll = Math.random()) {
        const index = rarities.indexOf(gift.rarity);
        return { day: gift.day, taps: gift.taps + 1, rarity: rarities[
            Math.min(rarities.indexOf(DAILY_GIFT_MAX_RARITY), index + Number(roll < DAILY_GIFT_UPGRADE_CHANCE))
        ] };
    }

    function restoreGift(gift, lastClaimed, date) {
        const day = date(gift?.day);
        const index = rarities.indexOf(gift?.rarity);
        if (!day || (lastClaimed && day <= lastClaimed) || !Number.isInteger(gift.taps) || gift.taps < 0 || gift.taps >= DAILY_GIFT_TAPS
            || index < 0 || index > Math.min(gift.taps, rarities.indexOf(DAILY_GIFT_MAX_RARITY))) return null;
        return { day, taps: gift.taps, rarity: gift.rarity };
    }

    function observeTime(save, now = Date.now()) {
        if (now <= (save.lastSeenTime || 0)) return false;
        save.lastSeenTime = now;
        return true;
    }

    const partWeights = [60, 25, 10, 4, 1];
    function rollWeightedRarity(weights, roll) {
        let cutoff = 0;
        for (const [index, weight] of weights.entries()) {
            cutoff += weight;
            if (roll < cutoff / 100) return rarities[index];
        }
        return 'mythic';
    }
    function rollRarity(roll = Math.random()) { return rollWeightedRarity(weights, roll); }
    function rollPartRarity(roll = Math.random()) { return rollWeightedRarity(partWeights, roll); }

    function grantPartDrops(count, { eligibleParts, addPart, partName, partCost, partRarity, addUniversal }, guaranteed = null) {
        const cards = [];
        const universal = Object.fromEntries(rarities.map(rarity => [rarity, 0]));
        if (guaranteed) universal[guaranteed.rarity] = guaranteed.amount;
        const pools = Object.fromEntries(rarities.map(rarity => [rarity, []]));
        for (const item of eligibleParts()) pools[partRarity(item.key)].push(item);
        for (let slot = 0; slot < count; slot++) {
            const rarity = rollPartRarity();
            const pool = pools[rarity];
            if (!pool.length) {
                universal[rarity]++;
                continue;
            }
            const [{ key }] = pool.splice(Math.floor(Math.random() * pool.length), 1);
            const owned = addPart(key, 1);
            cards.push({ type: 'parts', key, label: `${partName(key)} Part`, amount: 1, rarity, desc: `${owned}/${partCost(key)} parts` });
        }
        for (const rarity of rarities) {
            if (!universal[rarity]) continue;
            addUniversal(universal[rarity], rarity);
            cards.push({ type: 'universal_parts', label: universalPartName(rarity), amount: universal[rarity], rarity });
        }
        return cards;
    }

    function universalPartName(rarity, amount = 1) {
        if (!rarities.includes(rarity)) rarity = 'common';
        return `${rarity[0].toUpperCase()}${rarity.slice(1)} Universal Part${amount === 1 ? '' : 's'}`;
    }

    function giftContents(rarity) {
        return { ...(contents[rarities.indexOf(rarity)] || contents[0]) };
    }

    function grantCrate(data, rarity, details = {}) {
        if (!rarities.includes(rarity)) return false;
        (data.storedCrates ??= []).push({ ...details, rarity });
        document.dispatchEvent(new CustomEvent('lb-crate-added', { detail: { data, rarity } }));
        return true;
    }

    function migratePendingCrates(data) {
        const paid = [data.pendingLevelBox, ...(data.pendingLevelBoxes || []), data.pendingMilestoneReward];
        for (const box of paid.filter(Boolean)) {
            (data.storedCrates ??= []).push({ rarity: levelRarity(box.level), source: 'legacy', rewards: box.rewards });
        }
        for (const level of data.pendingMilestoneBoxes || []) {
            (data.storedCrates ??= []).push({ rarity: levelRarity(level), source: 'level' });
        }
        for (const key of ['pendingLevelBox', 'pendingLevelBoxes', 'pendingMilestoneReward', 'pendingMilestoneBoxes']) delete data[key];
    }

    function levelRarity(level) {
        return rankTiers[Math.min(rankTiers.length - 1, Math.floor((Math.max(1, level) - 1) / 10))];
    }

    function missionRarity(points, weekly) {
        return (weekly ? weeklyTiers : dailyTiers)[points] || 'common';
    }

    function grantDailyGift(data, plan, hooks, daily = true, rarity = 'common') {
        const { addBooster, boosterInfo } = hooks;
        const cards = grantPartDrops(plan.parts, hooks, { rarity, amount: plan.universal });
        const booster = boosterInfo[plan.booster];
        for (let count = 0; count < plan.boosters; count++) addBooster(plan.booster);
        cards.push({ type: 'booster', key: plan.booster, label: booster.label, amount: plan.boosters, rarity: booster.rarity });
        if (daily) data.stats.rareItemsFromDailyBox = (Number(data.stats.rareItemsFromDailyBox) || 0)
            + cards.reduce((total, card) => total + (card.rarity === 'common' ? 0 : card.amount), 0);
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
            image.src = reward.type === 'crate' ? `assets/ui/crates/${reward.rarity}.png`
                : isPart ? (reward.type === 'parts' ? window.LBArtPack.itemPart(reward.rarity) : window.LBArtPack.universalPart(reward.rarity))
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

    function crateArt(rarity) {
        const art = element('figure', 'lb43-crate');
        const sprite = element('div', 'lb43-crate-sprite');
        for (const layer of ['body', 'lid']) {
            const image = element('img', `lb43-crate-${layer}`);
            image.alt = '';
            sprite.append(image);
        }
        art.append(sprite, element('figcaption'));
        setCrateArt(art, rarity);
        return art;
    }

    function setCrateArt(art, rarity) {
        art.dataset.rarity = rarity;
        for (const image of art.querySelectorAll('img')) image.src = `assets/ui/crates/${rarity}.png`;
        art.querySelector('figcaption').textContent = crateLabel(rarity);
    }

    const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function animateReveal(art, rewards, grid) {
        const done = rewards.querySelector('button');
        grid.classList.add('lb43-crate-cards');
        for (const [index, card] of Array.from(grid.children).entries()) {
            card.style.setProperty('--lb43-card-delay', `${Math.min(index, 8) * 36}ms`);
        }
        const reveal = () => {
            if (!art.isConnected) return;
            art.hidden = true;
            rewards.hidden = false;
            done.focus({ preventScroll: true });
        };
        if (reducedMotion()) reveal();
        else {
            art.classList.remove('lb43-crate-shaking');
            art.classList.add('lb43-crate-opening');
            window.setTimeout(reveal, 490);
        }
    }

    const crateLabel = rarity => `${rarity[0].toUpperCase()}${rarity.slice(1)} crate`;

    function renderLocker(container, crates, onOpen) {
        const list = container.querySelector('.lb43-locker-list');
        list.replaceChildren();
        const openAll = container.querySelector('.lb43-open-all');
        openAll.hidden = crates.length < 2;
        openAll.onclick = () => onOpen();
        for (const rarity of rarities) {
            const count = crates.filter(crate => crate.rarity === rarity).length;
            if (!count) continue;
            const row = element('div', 'lb-block-card lb-exchange-row lb43-locker-row');
            const art = element('img', 'lb43-locker-art');
            art.src = `assets/ui/crates/${rarity}.png`;
            art.alt = '';
            const detail = element('div', 'lb-exchange-row-detail');
            detail.append(element('strong', '', `${crateLabel(rarity)}s`));
            const open = element('button', 'lb-block-btn', 'Open');
            open.type = 'button';
            open.dataset.crateRarity = rarity;
            open.setAttribute('aria-label', `Open ${crateLabel(rarity).toLowerCase()}`);
            open.onclick = () => onOpen(rarity);
            row.append(art, detail, element('span', '', `×${count}`), open);
            list.append(row);
        }
        if (!crates.length) list.append(element('div', 'lb-block-card lb-collection-empty', 'No crates in storage.'));
    }

    function showCrateReveal(rarity, count, grid, onClose, gift) {
        const overlay = element('div', 'lb-reward-overlay lb64-crate-overlay');
        overlay.id = gift ? 'daily-gift-crate-overlay' : 'inventory-crate-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'lb43-crate-title');
        overlay.tabIndex = -1;
        const panel = element('div', 'lb64-crate-panel lb-block-dialog');
        const title = element('h2', 'lb64-crate-title', gift ? 'Daily Gift' : count > 1 ? `${count} crates opened` : crateLabel(rarity));
        title.id = 'lb43-crate-title';
        const art = crateArt(rarity);
        const rewards = element('div');
        rewards.hidden = true;
        const done = action('Done');
        rewards.append(done);
        panel.append(title, art, rewards);
        overlay.append(panel);
        document.body.append(overlay);
        let shake;
        const reveal = result => {
            if (!result.childElementCount) result.append(element('p', '', 'These rewards were already added to your inventory.'));
            rewards.prepend(result);
            animateReveal(art, rewards, result);
        };
        const close = () => {
            overlay.remove();
            onClose();
        };
        done.addEventListener('click', close);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Tab') {
                event.preventDefault();
                (rewards.hidden ? shake && !shake.disabled ? shake : overlay : done).focus();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close();
            }
        });
        if (!gift) {
            overlay.focus({ preventScroll: true });
            reveal(grid);
            return;
        }
        const status = element('p', 'lb43-gift-progress');
        status.setAttribute('role', 'status');
        const updateStatus = state => {
            status.textContent = `${crateLabel(state.rarity)} · ${state.taps} / ${DAILY_GIFT_TAPS} shakes`;
        };
        updateStatus(gift.state);
        shake = action('Shake crate');
        rewards.before(status, shake);
        shake.addEventListener('click', () => {
            const result = gift.onShake();
            if (!result) return close();
            setCrateArt(art, result.state.rarity);
            updateStatus(result.state);
            if (!reducedMotion()) {
                art.classList.remove('lb43-crate-shaking');
                void art.offsetWidth;
                art.classList.add('lb43-crate-shaking');
            }
            if (!result.grid) return;
            shake.disabled = true;
            overlay.focus({ preventScroll: true });
            const finish = () => {
                if (!overlay.isConnected) return;
                status.remove();
                shake.remove();
                title.textContent = crateLabel(result.state.rarity);
                reveal(result.grid);
            };
            if (reducedMotion()) finish();
            else window.setTimeout(finish, DAILY_GIFT_SHAKE_MS);
        });
        shake.focus({ preventScroll: true });
    }

    function mountDailyGift({ button, getSave, ready, save, claimAfterPaint, onShake, openGift }) {
        const text = document.getElementById(button.getAttribute('aria-describedby'));
        let clockCheckpoint;
        function refresh() {
            const state = giftStatus(getSave());
            const status = ready() ? state.status : 'loading';
            const actionable = status === 'available' || status === 'in-progress';
            button.dataset.status = actionable ? 'available' : status;
            button.setAttribute('aria-disabled', String(!actionable));
            text.textContent = {
                available: 'Gift ready', claimed: 'Claimed',
                'in-progress': 'Gift in progress',
                'clock-blocked': 'Check system clock', loading: 'Checking save…',
            }[status];
            return state;
        }
        function claim() {
            if (!ready() || button.closest('.hidden') || document.querySelector('.lb-reward-overlay')) return;
            const state = refresh();
            if (!['available', 'in-progress'].includes(state.status)) return;
            return claimAfterPaint(button, () => {
                if (!ready() || document.querySelector('.lb-reward-overlay')) return;
                const state = refresh();
                if (!['available', 'in-progress'].includes(state.status)) return;
                const data = getSave();
                data.pendingDailyGift ??= { day: state.day, taps: 0, rarity: 'common' };
                save();
                refresh();
                showCrateReveal(data.pendingDailyGift.rarity, 1, null, () => button.focus({ preventScroll: true }), {
                    state: data.pendingDailyGift,
                    onShake() {
                        if (data !== getSave() || giftStatus(data).status !== 'in-progress') return null;
                        onShake();
                        const next = shakeGift(data.pendingDailyGift);
                        let grid;
                        if (next.taps === DAILY_GIFT_TAPS) {
                            data.lastDailyGift = next.day;
                            data.pendingDailyGift = null;
                            grid = openGift(next.rarity);
                        } else data.pendingDailyGift = next;
                        save();
                        refresh();
                        return { state: next, grid };
                    },
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
        return { refresh, claim };
    }

    window.LBCrates = Object.freeze({ rarities: Object.freeze(rarities), giftStatus, observeTime, rollRarity, rollPartRarity, shakeGift, restoreGift, giftContents, levelRarity, missionRarity, universalPartName, grantPartDrops, grantDailyGift, grantCrate, migratePendingCrates, rewardGrid, renderLocker, showCrateReveal, crateLabel, mountDailyGift });
})();
