(() => {
    'use strict';

    const rarities = ['common', 'rare', 'epic', 'legendary', 'mythic'];
    const DAILY_GIFT_TAPS = 3;
    const DAILY_GIFT_MAX_RARITY = 'epic';
    const DAILY_GIFT_SHAKE_MS = 230;
    const CRATE_AJAR_MS = 120;
    const CRATE_OPEN_MS = 280;
    const REWARD_FLIGHT_MS = 450;
    const REWARD_POP_MS = 110;
    const crateFrames = ['closed', 'ajar', 'open'];
    const crateSparkles = { epic: 6, legendary: 9, mythic: 14 };
    const contents = [
        { parts: 2, minParts: 1, universal: [], booster: '1.25x_game', boosters: 1 },
        { parts: 3, universal: ['rare'], booster: '1.5x_game', boosters: 1 },
        { parts: 5, universal: ['epic'], booster: '1.5x_game', boosters: 2 },
        { parts: 7, universal: ['epic', 'legendary'], booster: '2xp_game', boosters: 2 },
        { parts: 9, universal: ['mythic'], booster: '2xp_game', boosters: 3 },
    ];
    const partWeights = [
        [80, 20], [50, 40, 10], [25, 40, 30, 5], [10, 30, 35, 25], [5, 20, 30, 30, 15],
    ];
    const rankTiers = ['common', 'rare', 'rare', 'epic', 'epic', 'legendary', 'legendary', 'legendary', 'mythic'];
    const dailyTiers = { 6: 'common', 9: 'common', 12: 'rare' };
    const weeklyTiers = { 60: 'rare', 90: 'rare', 120: 'epic' };
    const rollbackTolerance = 10 * 60_000;

    function giftStatus(save, now = new Date()) {
        const day = LBSave.localDate(now);
        if (save.lastSeenTime - now.getTime() > rollbackTolerance || save.lastDailyGift > day || save.pendingDailyGift?.day > day) {
            return { day, status: 'clock-blocked' };
        }
        if (save.pendingDailyGift) return { day, status: 'in-progress' };
        return { day, status: save.lastDailyGift === day ? 'claimed' : 'available' };
    }

    function nextGiftCountdown(now = new Date()) {
        const next = new Date(now);
        next.setHours(24, 0, 0, 0);
        const remaining = next - now;
        return remaining >= 3_600_000 ? `Next in ${Math.floor(remaining / 3_600_000)}h`
            : `Next in ${Math.ceil(remaining / 60_000)}m`;
    }

    function shakeGift(gift, roll = Math.random()) {
        const taps = gift.taps + 1;
        let rarity = gift.rarity;
        if (rarity === 'common' && (taps === 1 && roll < 0.2 || taps === 2 && roll < 0.25)) rarity = 'rare';
        if (rarity === 'rare' && taps === DAILY_GIFT_TAPS && roll < 0.25) rarity = 'epic';
        return { day: gift.day, taps, rarity };
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

    function rollPartRarity(crateRarity, roll = Math.random()) {
        const weights = partWeights[rarities.indexOf(crateRarity)] || partWeights[0];
        let cutoff = 0;
        for (const [index, weight] of weights.entries()) {
            cutoff += weight;
            if (roll < cutoff / 100) return rarities[index];
        }
        return rarities[weights.length - 1];
    }

    function grantPartDrops(crateRarity, { eligibleParts, addPart, partName, partCount, partCost, partRarity, addUniversal }, random = Math.random) {
        const crateTier = Math.max(0, rarities.indexOf(crateRarity));
        const plan = contents[crateTier];
        const count = plan.minParts === undefined ? plan.parts
            : plan.minParts + Math.floor(random() * (plan.parts - plan.minParts + 1));
        const cards = new Map();
        const universals = new Map(plan.universal.map(rarity => [rarity, 1]));
        const pools = Object.fromEntries(rarities.map(rarity => [rarity, []]));
        for (const { key } of eligibleParts()) pools[partRarity(key)]?.push(key);
        function grantItemPart(rolledRarity, bundle) {
            const rolledTier = rarities.indexOf(rolledRarity);
            let tier = rolledTier;
            while (tier >= 0 && !pools[rarities[tier]].length) tier--;
            if (tier < 0) {
                const rarity = rarities[Math.min(rolledTier, crateTier)];
                const amount = universals.get(rarity) || 0;
                if (amount === 0 || (rarity !== 'legendary' && rarity !== 'mythic')) universals.set(rarity, amount + 1);
                return;
            }
            const rarity = rarities[tier];
            const pool = pools[rarity];
            const fullBundle = bundle > 1 ? pool.filter(key => partCost(key) - partCount(key) >= bundle) : pool;
            const candidates = fullBundle.length ? fullBundle : pool;
            const key = candidates[Math.floor(random() * candidates.length)];
            const cost = partCost(key);
            const current = partCount(key);
            const amount = Math.min(bundle, cost - current);
            const owned = addPart(key, amount);
            if (owned >= cost) pool.splice(pool.indexOf(key), 1);
            cards.set(key, { type: 'parts', key, label: `${partName(key)} Part`, amount: (cards.get(key)?.amount || 0) + amount,
                rarity, desc: `${owned}/${cost} parts` });
        }
        if (crateRarity === 'mythic') grantItemPart('mythic', 8);
        for (let slot = 0; slot < count; slot++) grantItemPart(rollPartRarity(crateRarity, random()), 1);
        const rewards = [...cards.values()];
        for (const [rarity, amount] of universals) {
            addUniversal(amount, rarity);
            rewards.push({ type: 'universal_parts', label: universalPartName(rarity), amount, rarity });
        }
        return rewards;
    }

    function universalPartName(rarity, amount = 1) {
        if (!rarities.includes(rarity)) rarity = 'common';
        return `${rarity[0].toUpperCase()}${rarity.slice(1)} Universal Part${amount === 1 ? '' : 's'}`;
    }

    function recordCrate(data, rarity) {
        if (!rarities.includes(rarity)) return;
        const counts = ((data.stats ??= {}).cratesCollected ??= {});
        counts[rarity] = (counts[rarity] || 0) + 1;
    }

    function grantCrate(data, rarity, details = {}) {
        if (!rarities.includes(rarity)) return false;
        (data.storedCrates ??= []).push({ ...details, rarity });
        recordCrate(data, rarity);
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

    function grantGiftCrate(data, rarity, hooks, daily = true) {
        const plan = contents[rarities.indexOf(rarity)] || contents[0];
        const { addBooster, boosterInfo } = hooks;
        const cards = grantPartDrops(rarity, hooks);
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
                : (reward.type === 'booster' && window.LBArtPack.boosterToken(reward.rarity)) || 'assets/ui/64-item-part.svg';
            if (reward.type === 'crate') image.className = 'lb-crate-art';
            if (reward.type === 'booster') image.className = 'lb-booster-token';
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
                const price = reward.type === 'parts' && /^(\d+(?:\.\d+)?)\/(\d+) parts$/.exec(reward.desc);
                if (price) {
                    const icon = image.cloneNode();
                    description.classList.add('lb-item-part-count');
                    description.setAttribute('role', 'img');
                    description.setAttribute('aria-label', `${price[1]} of ${price[2]} parts`);
                    description.replaceChildren(icon, `${price[1]}/${price[2]}`);
                } else if (formatDescription) description.innerHTML = formatDescription(reward.desc);
                card.append(description);
            }
            card.append(element('span', 'lb-reward-rarity', reward.rarity));
            grid.append(card);
        }
        return grid;
    }

    function crateArt(rarity) {
        const art = element('figure', 'lb43-crate');
        art.dataset.frame = 'closed';
        const sprite = element('div', 'lb43-crate-sprite');
        for (const frame of crateFrames) {
            const image = element('img', 'lb43-crate-frame');
            image.dataset.frame = frame;
            image.alt = '';
            sprite.append(image);
        }
        const shine = element('div', 'lb43-crate-shine');
        shine.setAttribute('aria-hidden', 'true');
        sprite.append(element('span', 'lb43-crate-mouth'), shine);
        art.append(sprite, element('figcaption'));
        setCrateArt(art, rarity);
        return art;
    }

    function setCrateArt(art, rarity) {
        if (art.dataset.rarity === rarity) return;
        art.dataset.rarity = rarity;
        for (const image of art.querySelectorAll('img')) image.src = `assets/ui/crates/reveal/${rarity}-${image.dataset.frame}.webp`;
        const shine = art.querySelector('.lb43-crate-shine');
        shine.replaceChildren();
        const count = crateSparkles[rarity] ?? 0;
        for (let index = 0; index < count; index++) {
            const sparkle = element('span', 'lb43-crate-sparkle');
            const angle = (index + .25) * 2 * Math.PI / count;
            const distance = 34 + (index % 4) * 7;
            sparkle.style.setProperty('--lb43-x', `${Math.cos(angle) * distance}%`);
            sparkle.style.setProperty('--lb43-y', `${Math.sin(angle) * distance}%`);
            sparkle.style.setProperty('--lb43-sparkle-delay', `${(index % 4) * 65}ms`);
            sparkle.style.setProperty('--lb43-sparkle-size', `${4 + (index % 3) * 2}px`);
            shine.append(sparkle);
        }
        art.querySelector('figcaption').textContent = crateLabel(rarity);
    }

    function flyReward(overlay, card, mouth) {
        const image = card.querySelector('img');
        const target = image.getBoundingClientRect();
        const flight = element('img', 'lb43-crate-flight');
        flight.alt = '';
        flight.setAttribute('aria-hidden', 'true');
        flight.src = image.src;
        flight.style.left = `${target.left}px`;
        flight.style.top = `${target.top}px`;
        flight.style.width = `${target.width}px`;
        flight.style.height = `${target.height}px`;
        flight.style.setProperty('--lb43-x', `${mouth.left - target.left - target.width / 2}px`);
        flight.style.setProperty('--lb43-y', `${mouth.top - target.top - target.height / 2}px`);
        flight.style.animationDuration = `${REWARD_FLIGHT_MS + REWARD_POP_MS}ms`;
        overlay.append(flight);
        return flight;
    }

    const crateLabel = rarity => `${rarity[0].toUpperCase()}${rarity.slice(1)} crate`;

    function renderLocker(container, crates, onOpen) {
        const list = container.querySelector('.lb43-locker-list');
        const total = container.querySelector('.lb43-locker-total');
        const before = total.dataset.count == null ? null : Number(total.dataset.count);
        total.dataset.count = crates.length;
        const motion = window.LBMotion;
        const paintTotal = value => { total.textContent = `${Math.round(value).toLocaleString()} stored`; };
        if (motion) motion.animateValue(total, before, crates.length, paintTotal);
        else paintTotal(crates.length);
        const counts = new Map();
        for (const { rarity } of crates) counts.set(rarity, (counts.get(rarity) || 0) + 1);
        list.querySelector('.lb-inventory-stock-empty')?.remove();
        function showEmpty() {
            if (!list.children.length) list.append(element('p', 'lb-inventory-stock-empty', 'No crates in stock.'));
        }
        for (const rarity of rarities) {
            const count = counts.get(rarity) || 0;
            let card = list.querySelector(`[data-rarity="${rarity}"]:not([inert])`);
            if (card) {
                if (!count) {
                    card.querySelector('button').disabled = true;
                    const remove = () => { card.remove(); showEmpty(); };
                    if (motion) motion.collapseRow(card, remove);
                    else remove();
                } else {
                    const quantity = card.querySelector('.lb43-locker-count');
                    const paint = value => { quantity.textContent = `×${Math.round(value).toLocaleString()}`; };
                    if (motion) motion.animateValue(quantity, Number(card.dataset.count), count, paint);
                    else paint(count);
                    card.dataset.count = count;
                }
                continue;
            }
            if (!count) continue;
            card = element('article', 'lb-block-card lb43-locker-card');
            card.dataset.rarity = rarity;
            card.dataset.count = count;
            const quantity = element('span', 'lb43-locker-count', `×${count.toLocaleString()}`);
            const art = element('img', 'lb-crate-art lb43-locker-art');
            art.src = `assets/ui/crates/${rarity}.png`;
            art.alt = '';
            const open = element('button', 'lb-block-btn', 'Open');
            open.type = 'button';
            open.dataset.crateRarity = rarity;
            open.setAttribute('aria-label', `Open ${crateLabel(rarity).toLowerCase()}`);
            open.onclick = () => onOpen(rarity);
            card.append(quantity, art, element('h4', 'lb43-locker-name', crateLabel(rarity)), open);
            const successor = [...list.querySelectorAll('[data-rarity]')].find(row => rarities.indexOf(row.dataset.rarity) > rarities.indexOf(rarity));
            list.insertBefore(card, successor || null);
        }
        showEmpty();
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
        const rewards = element('div', 'lb43-crate-result');
        rewards.hidden = true;
        const done = action('Done');
        rewards.append(done);
        panel.append(title, art, rewards);
        overlay.append(panel);
        document.body.append(overlay);
        const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
        const timers = new Set();
        let shake;
        let skip;
        const skipReducedMotion = event => { if (event.matches) skip?.(); };
        const clearAnimation = () => {
            for (const timer of timers) window.clearTimeout(timer);
            timers.clear();
            motion?.removeEventListener?.('change', skipReducedMotion);
            overlay.querySelectorAll('.lb43-crate-flight').forEach(flight => flight.remove());
        };
        const wait = (delay, next) => {
            const timer = window.setTimeout(() => {
                timers.delete(timer);
                if (overlay.isConnected) next();
                else clearAnimation();
            }, delay);
            timers.add(timer);
        };
        const reveal = (result, immediate = false) => {
            clearAnimation();
            if (!result.childElementCount) result.append(element('p', '', 'No matching item parts to collect from this crate.'));
            rewards.prepend(result);
            art.classList.remove('lb43-crate-shaking');
            rewards.hidden = false;
            const cards = [...result.querySelectorAll('.lb-reward-card')];
            const finish = () => {
                clearAnimation();
                skip = null;
                art.dataset.frame = 'open';
                overlay.dataset.reveal = 'revealed';
                result.removeAttribute('aria-hidden');
                cards.forEach(card => card.classList.remove('lb43-reward-pending'));
                done.textContent = 'Done';
                done.focus({ preventScroll: true });
            };
            if (immediate || motion?.matches) return finish();
            skip = finish;
            motion?.addEventListener?.('change', skipReducedMotion);
            overlay.dataset.reveal = 'opening';
            result.setAttribute('aria-hidden', 'true');
            cards.forEach(card => card.classList.add('lb43-reward-pending'));
            done.textContent = 'Skip animation';
            done.focus({ preventScroll: true });
            wait(CRATE_AJAR_MS, () => { art.dataset.frame = 'ajar'; });
            wait(CRATE_OPEN_MS, () => {
                art.dataset.frame = 'open';
                if (!cards.length) {
                    wait(REWARD_FLIGHT_MS, finish);
                    return;
                }
                const mouth = art.querySelector('.lb43-crate-mouth');
                const stagger = Math.min(80, 720 / Math.max(1, cards.length - 1));
                cards.forEach((card, index) => wait(index * stagger, () => {
                    const flight = flyReward(overlay, card, mouth.getBoundingClientRect());
                    wait(REWARD_FLIGHT_MS + REWARD_POP_MS, () => {
                        flight.remove();
                        card.classList.remove('lb43-reward-pending');
                        if (index === cards.length - 1) finish();
                    });
                }));
            });
        };
        const close = () => {
            clearAnimation();
            overlay.remove();
            onClose();
        };
        overlay.addEventListener('click', event => {
            if (!skip) return;
            event.preventDefault();
            event.stopPropagation();
            skip();
        }, true);
        done.addEventListener('click', close);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Tab') {
                event.preventDefault();
                (rewards.hidden ? shake && !shake.disabled ? shake : overlay : done).focus();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                if (skip) skip();
                else close();
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
            if (!motion?.matches) {
                art.classList.remove('lb43-crate-shaking');
                void art.offsetWidth;
                art.classList.add('lb43-crate-shaking');
            }
            if (!result.grid) return;
            const finish = immediate => {
                status.remove();
                shake.remove();
                title.textContent = crateLabel(result.state.rarity);
                reveal(result.grid, immediate);
            };
            if (motion?.matches) finish(true);
            else {
                shake.textContent = 'Skip animation';
                overlay.dataset.reveal = 'opening';
                skip = () => finish(true);
                motion?.addEventListener?.('change', skipReducedMotion);
                wait(DAILY_GIFT_SHAKE_MS, () => finish(false));
            }
        });
        shake.focus({ preventScroll: true });
    }

    function mountDailyGift({ button, getSave, ready, save, claimAfterPaint, onShake, openGift }) {
        const text = document.getElementById(button.getAttribute('aria-describedby'));
        let clockCheckpoint, countdownTimer;
        function refresh() {
            const now = new Date();
            const state = giftStatus(getSave(), now);
            const status = ready() ? state.status : 'loading';
            const actionable = status === 'available' || status === 'in-progress';
            button.dataset.status = actionable ? 'available' : status;
            button.setAttribute('aria-disabled', String(!actionable));
            text.textContent = {
                available: 'Gift ready', claimed: nextGiftCountdown(now),
                'in-progress': 'Gift in progress',
                'clock-blocked': 'Check system clock', loading: 'Checking save…',
            }[status];
            clearTimeout(countdownTimer);
            if (status === 'claimed') countdownTimer = window.setTimeout(refresh, 60_000 - now.getTime() % 60_000);
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

    window.LBCrates = Object.freeze({ rarities: Object.freeze(rarities), giftStatus, nextGiftCountdown, observeTime, rollPartRarity, shakeGift, restoreGift, levelRarity, missionRarity, universalPartName, grantPartDrops, grantGiftCrate, recordCrate, grantCrate, migratePendingCrates, rewardGrid, renderLocker, showCrateReveal, crateLabel, mountDailyGift });
})();
