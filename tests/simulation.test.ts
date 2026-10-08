import { describe, expect, it } from 'vitest';
import { GameEngine, HEROES, SAVE_KEY, SUMMON_COST, SUMMON_TEN_COST, parseSave } from '../src/simulation';
import type { StorageLike } from '../src/simulation';

function storage(): StorageLike {
  const entries = new Map<string, string>();
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value); }, removeItem: key => { entries.delete(key); } };
}
function seeded(seed = 32): () => number {
  let value = seed;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
}
function engine(seed = 32): GameEngine { return new GameEngine({ storage: null, random: seeded(seed), now: () => 1_700_000_000_000 }); }
function fight(game: GameEngine, stageId: number): void {
  expect(game.startBattle(stageId)).toBe(true);
  game.setAuto(true);
  for (let i = 0; i < 1200 && game.state.battle?.status === 'fighting'; i += 1) game.update(0.25);
}

describe('roster, equipment and currency transactions', () => {
  it('begins with the two story leads and buys a specific hero exactly once', () => {
    const game = engine();
    expect(game.state.profile.party).toEqual(['kael', 'lyra']);
    const before = game.state.profile.gems;
    expect(game.buyHero('nova')).toBe(true);
    expect(game.state.profile.ownedHeroes).toContain('nova');
    expect(game.state.profile.gems).toBe(before - HEROES.find(hero => hero.id === 'nova')!.price);
    const after = game.state.profile.gems;
    expect(game.buyHero('nova')).toBe(false);
    expect(game.buyHero('seraphina')).toBe(false);
    expect(game.buyHero('__proto__')).toBe(false);
    expect(game.state.profile.gems).toBe(after);
  });

  it('summons equipment only and guarantees at least a rare item in a ten-pull', () => {
    const game = new GameEngine({ storage: null, random: () => 0.99 });
    const before = game.state.profile.gems;
    const roster = [...game.state.profile.ownedHeroes];
    const items = game.summonEquipment(10);
    expect(items).toHaveLength(10);
    expect(items.filter(item => item.rarity === 'rare')).toHaveLength(1);
    expect(new Set(items.map(item => item.id)).size).toBe(10);
    expect(game.state.profile.gems).toBe(before - SUMMON_TEN_COST);
    expect(game.state.profile.ownedHeroes).toEqual(roster);
    expect(game.state.profile.summons).toBe(10);
  });

  it('guarantees a legendary on the fiftieth pull and rejects unaffordable purchases atomically', () => {
    const game = new GameEngine({ storage: null, random: () => 0.99 });
    game.state.profile.legendaryPity = 49;
    expect(game.summonEquipment(1)[0].rarity).toBe('legendary');
    expect(game.state.profile.legendaryPity).toBe(0);
    game.state.profile.gems = SUMMON_COST - 1;
    const saved = JSON.stringify(game.state.profile);
    expect(game.summonEquipment(1)).toEqual([]);
    expect(JSON.stringify(game.state.profile)).toBe(saved);
  });

  it('transfers equipment between heroes without duplicating its bonuses', () => {
    const game = engine();
    const blade = game.state.profile.inventory.find(item => item.slot === 'weapon')!;
    const beforeKael = game.getHeroStats('kael').attack;
    const beforeLyra = game.getHeroStats('lyra').attack;
    expect(game.equip('lyra', blade.id)).toBe(true);
    expect(game.state.profile.equipped.kael.weapon).toBeUndefined();
    expect(game.state.profile.equipped.lyra.weapon).toBe(blade.id);
    expect(game.getHeroStats('kael').attack).toBe(beforeKael - blade.attack);
    expect(game.getHeroStats('lyra').attack).toBe(beforeLyra + blade.attack);
    expect(() => parseSave(game.exportSave())).not.toThrow();
  });

  it('validates party membership and preserves the active battle loadout', () => {
    const game = engine();
    expect(game.setParty(['kael', 'kael'])).toBe(false);
    expect(game.setParty(['kael', 'riven'])).toBe(false);
    expect(game.setParty([])).toBe(false);
    expect(game.startBattle(1)).toBe(true);
    expect(game.setParty(['lyra'])).toBe(false);
    expect(game.buyHero('nova')).toBe(false);
    expect(game.upgradeHero('kael')).toBe(false);
    expect(game.state.profile.party).toEqual(['kael', 'lyra']);
  });

  it('trains a hero with gold and increases combat stats', () => {
    const game = engine();
    const before = game.getHeroStats('kael');
    const gold = game.state.profile.gold;
    const cost = game.getUpgradeCost('kael');
    expect(game.upgradeHero('kael')).toBe(true);
    expect(game.state.profile.gold).toBe(gold - cost);
    expect(game.getHeroStats('kael').level).toBe(2);
    expect(game.getHeroStats('kael').maxHp).toBeGreaterThan(before.maxHp);
    expect(game.getHeroStats('kael').attack).toBeGreaterThan(before.attack);
  });
});

describe('real-time combat and progression', () => {
  it('reports the actual support recipients and area targets for skill presentation', () => {
    const game=engine();game.startBattle(1);
    const battle=game.state.battle!;battle.allies[0].hp-=200;
    expect(game.castSkill('lyra',0)).toBe(true);
    const heal=battle.effects.find(effect=>effect.type==='skill'&&effect.sourceId==='lyra')!;
    expect(heal).toMatchObject({skillId:'starlight',skillSlot:0,targetId:'kael',targetIds:['kael']});
    expect(battle.effects.find(effect=>effect.type==='heal')?.targetId).toBe(heal.targetId);
    const targets=battle.enemies.filter(enemy=>enemy.alive).map(enemy=>enemy.id);
    expect(game.castSkill('kael',2)).toBe(true);
    expect(battle.effects.find(effect=>effect.skillId==='horizon')?.targetIds).toEqual(targets);
  });

  it('responds to a manual skill tap during an attack animation exactly once', () => {
    const game = engine();
    game.startBattle(1);
    game.update(0.5);
    const battle = game.state.battle!;
    const kael = battle.allies.find(ally => ally.heroId === 'kael')!;
    expect(kael.action).toBe('attack');
    expect(kael.actionTimer).toBeGreaterThan(0.25);
    const remainingHp = () => battle.enemies.reduce((sum, enemy) => sum + enemy.hp, 0);
    const before = remainingHp();
    expect(game.castSkill('kael', 0)).toBe(true);
    const after = remainingHp();
    expect(after).toBeLessThan(before);
    expect(kael.action).toBe('skill');
    expect(kael.energy).toBe(80);
    expect(game.castSkill('kael', 0)).toBe(false);
    expect(remainingHp()).toBe(after);
    expect(kael.energy).toBe(80);
    expect(battle.effects.filter(effect => effect.type === 'skill' && effect.sourceId === 'kael')).toHaveLength(1);
  });

  it('applies skill energy and cooldown rules; pause freezes simulation and speed scales time', () => {
    const game = engine();
    game.startBattle(1);
    expect(game.castSkill('kael', 0)).toBe(true);
    const kael = game.state.battle!.allies[0];
    expect(kael.energy).toBe(80);
    expect(kael.cooldowns[0]).toBe(7);
    expect(game.castSkill('kael', 0)).toBe(false);
    game.setPaused(true);
    const before = JSON.stringify(game.state.battle);
    game.update(0.5);
    expect(JSON.stringify(game.state.battle)).toBe(before);
    expect(game.castSkill('lyra', 0)).toBe(false);
    game.setPaused(false);
    game.setSpeed(2);
    game.update(0.5);
    expect(game.state.battle!.elapsed).toBeCloseTo(1, 5);
    expect(kael.cooldowns[0]).toBeCloseTo(6, 5);
  });

  it('clears all three waves with starter heroes and awards the story mage exactly once', () => {
    const game = engine();
    const before = game.state.profile.gems;
    fight(game, 1);
    expect(game.state.battle!.status).toBe('won');
    expect(game.state.battle!.wave).toBe(3);
    expect(game.state.profile.wins).toEqual([1]);
    expect(game.state.profile.unlockedStage).toBe(2);
    expect(game.state.profile.party).toEqual(['kael', 'lyra', 'seraphina']);
    expect(game.state.battle!.rewards?.hero).toBe('seraphina');
    const rewardedGems = game.state.profile.gems;
    expect(rewardedGems).toBeGreaterThan(before);
    expect(game.claimRewards()).not.toBeNull();
    expect(game.claimRewards()).toBeNull();
    game.update(0.5);
    expect(game.state.profile.gems).toBe(rewardedGems);
    game.returnHome();
    fight(game, 1);
    expect(game.state.battle!.status).toBe('won');
    expect(game.state.battle!.rewards?.firstClear).toBe(false);
    expect(game.state.battle!.rewards?.hero).toBeUndefined();
    expect(game.state.profile.ownedHeroes.filter(id => id === 'seraphina')).toHaveLength(1);
  });

  it('recruits the fourth story hero after stage two and keeps later stages locked', () => {
    const game = engine();
    expect(game.startBattle(3)).toBe(false);
    fight(game, 1);
    game.returnHome();
    fight(game, 2);
    expect(game.state.battle!.status).toBe('won');
    expect(game.state.profile.party).toEqual(['kael', 'lyra', 'seraphina', 'riven']);
    expect(game.state.profile.unlockedStage).toBe(3);
    expect(() => parseSave(game.exportSave())).not.toThrow();
  });

  it('grants no rewards after defeat or abandoning a fight', () => {
    const game = engine();
    const original = JSON.stringify(game.state.profile);
    game.startBattle(1);
    for (const ally of game.state.battle!.allies) { ally.hp = 1; ally.attack = 0; ally.defense = 0; }
    for (let i = 0; i < 200 && game.state.battle!.status === 'fighting'; i += 1) game.update(0.25);
    expect(game.state.battle!.status).toBe('lost');
    expect(game.claimRewards()).toBeNull();
    expect(JSON.stringify(game.state.profile)).toBe(original);
    game.returnHome();
    game.startBattle(1);
    game.returnHome();
    expect(JSON.stringify(game.state.profile)).toBe(original);
  });
});

describe('save durability and untrusted backup validation', () => {
  it('restores purchases and victory rewards after a reload with no claim required', () => {
    const memory = storage();
    const game = new GameEngine({ storage: memory, random: seeded() });
    game.buyHero('nova');
    fight(game, 1);
    expect(game.state.battle!.status).toBe('won');
    const restored = new GameEngine({ storage: memory });
    expect(restored.state.profile).toEqual(game.state.profile);
    expect(restored.state.battle).toBeNull();
    expect(restored.claimRewards()).toBeNull();
  });

  it('exports and restores a canonical backup without sharing mutable references', () => {
    const game = engine();
    game.buyHero('astrid');
    const backup = game.exportSave();
    const restored = engine();
    expect(restored.importSave(backup)).toBe(true);
    expect(restored.state.profile).toEqual(game.state.profile);
    restored.state.profile.gems += 1;
    expect(restored.state.profile.gems).not.toBe(game.state.profile.gems);
  });

  it.each([
    (p: Record<string, unknown>) => { p.gems = -1; },
    (p: Record<string, unknown>) => { p.gems = 1.5; },
    (p: Record<string, unknown>) => { p.party = ['kael', 'kael']; },
    (p: Record<string, unknown>) => { p.party = ['__proto__']; },
    (p: Record<string, unknown>) => { p.heroLevels = { kael: 100, lyra: 1 }; },
    (p: Record<string, unknown>) => { p.unlockedStage = 5; },
    (p: Record<string, unknown>) => { p.legendaryPity = 50; },
    (p: Record<string, unknown>) => { p.inventory = [{ key: 'dawnbringer', id: 'hack', slot: 'weapon', rarity: 'legendary', hp: 120, defense: 5, attack: 9999 }]; },
    (p: Record<string, unknown>) => { p.equipped = { kael: { weapon: 'starter-kael-weapon' }, lyra: { weapon: 'starter-kael-weapon' } }; },
  ])('rejects an invalid backup atomically (case %#)', tamper => {
    const game = engine();
    const original = JSON.stringify(game.state.profile);
    const profile = JSON.parse(original) as Record<string, unknown>;
    tamper(profile);
    expect(game.importSave(JSON.stringify(profile))).toBe(false);
    expect(JSON.stringify(game.state.profile)).toBe(original);
  });

  it('does not crash or erase an unreadable stored save on startup', () => {
    const memory = storage();
    memory.setItem(SAVE_KEY, '{broken');
    const game = new GameEngine({ storage: memory });
    expect(game.state.profile.ownedHeroes).toEqual(['kael', 'lyra']);
    expect(game.state.notice).toContain('could not be read');
    expect(memory.getItem(SAVE_KEY)).toBe('{broken');
  });

  it('continues play and warns when browser storage is unavailable', () => {
    const memory: StorageLike = { getItem: () => null, setItem: () => { throw new Error('quota exceeded'); }, removeItem: () => {} };
    const game = new GameEngine({ storage: memory });
    expect(game.buyHero('nova')).toBe(true);
    expect(game.state.notice).toContain('could not be saved');
    expect(() => parseSave(game.exportSave())).not.toThrow();
  });
});
