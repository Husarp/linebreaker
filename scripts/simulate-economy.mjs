import { readFileSync } from 'node:fs';
import { loadGame } from '../tests/loader.js';

const seed = 287;
const load = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const data = { 'data/missions.json': load('data/missions.json'), 'data/season.json': load('data/season.json') };
let date = new Date(2026, 5, 1, 12);
const game = await loadGame(true, null, null, async path => ({ ok: true, json: async () => data[path] ?? [] }), null, window => {
  window.Date = class extends Date {
    constructor(...args) { super(...(args.length ? args : [+date])); }
    static now() { return +date; }
  };
});

try {
  const { api, w: { LBCrates: crates, LBSeason: season } } = game;
  const config = season.prepareConfig(data['data/season.json']);
  const period = season.seasonWindow(+date);
  const proposedShare = [53, 35, 10, 2, 1];
  api.setup({ save: { totalXP: 1_000_000 } });
  api.seed(seed);
  let finishedDay;
  let bonusCrates = 0;
  let bonusBoxCrates = 0;

  for (let day = 1; day <= period.days; day++) {
    date = new Date(2026, 5, day, 12);
    api.refreshMissions();
    const progress = api.save;
    const { daily, weekly } = progress.missions;
    for (const quest of [...daily.quests, daily.secret].filter(Boolean)) quest.completed = true;
    const weekday = (date.getDay() + 6) % 7;
    if (weekly.missions[weekday]) weekly.missions[weekday].completed = true;
    api.setSave(progress);
    api.autoClaimMissions(false);
    api.autoClaimMissions(true);

    const rewards = [];
    let gift = { day, taps: 0, rarity: 'common' };
    for (let tap = 0; tap < 3; tap++) gift = crates.shakeGift(gift);
    rewards.push(gift.rarity);

    const profile = api.save;
    const stored = profile.storedCrates || [];
    const bonusBoxRewards = stored.filter(crate => crate.source === 'bonus');
    profile.storedCrates = stored.filter(crate => crate.source !== 'bonus');
    bonusBoxCrates += bonusBoxRewards.length;
    for (const { number } of config.stages) {
      const result = season.claimStage(profile, config, number, +date);
      if (!result.reward) continue;
      season.storeState(profile, result);
      if (result.reward.type === 'crate') rewards.push(result.reward.tier);
      else {
        finishedDay = day;
        profile.ownedSkins.push(result.reward.key);
      }
    }
    while (season.bonusProgress(config, { season: profile.season }).ready) {
      const result = season.claimBonus(profile, config, +date);
      season.storeState(profile, result);
      rewards.push(result.reward.tier);
      bonusCrates++;
    }
    for (const rarity of rewards) crates.recordCrate(profile, rarity);
    api.setSave(profile);
    for (const { rarity } of bonusBoxRewards) api.generateLevelBoxRewards(rarity);
    for (const rarity of rewards) api.generateLevelBoxRewards(rarity);
  }

  const save = api.save;
  const byRarity = save.stats.cratesCollected;
  const total = Object.values(byRarity).reduce((sum, count) => sum + count, 0);
  const itemParts = Object.fromEntries(crates.rarities.map(rarity => [rarity, 0]));
  for (const [key, count] of Object.entries(save.parts)) itemParts[api.partRarity(key)] += count;
  console.log(`June 2026, seed ${seed}: top-rank player with no starting parts, all daily quests and gifts, one weekly quest per day until complete.`);
  console.log('Includes mission milestones, Bonus Box, and the Season Pass. Excludes XP-dependent level-ups, one-time achievement rewards, and spending.');
  console.log(`${total} crates (proposal ~208), including ${bonusBoxCrates} Bonus Box crate(s); ${save.season.points} SP; track completed on day ${finishedDay ?? 'not reached'} (proposal ~28); ${bonusCrates} Season Pass bonus chest(s).`);
  console.table(crates.rarities.map((rarity, index) => ({
    rarity,
    crates: byRarity[rarity] || 0,
    share: `${((byRarity[rarity] || 0) * 100 / total).toFixed(1)}%`,
    'proposed share': `${proposedShare[index]}%`,
    'item parts': itemParts[rarity],
    'universal parts': save.universalParts[rarity] || 0,
  })));
} finally {
  game.close();
}
