import { EQUIPMENT_POOL, HEROES, MAX_HERO_LEVEL, STAGES } from './data';
import type { EquipmentInstance, EquipmentSlot, Profile } from './types';

const slots: EquipmentSlot[] = ['weapon', 'armor', 'accessory'];
const heroIds = new Set(HEROES.map(hero => hero.id));
const equipmentByKey = new Map(EQUIPMENT_POOL.map(item => [item.key, item]));
const safeId = /^[a-zA-Z0-9_-]{1,80}$/;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const fail = (): never => { throw new Error('This backup is not a valid Aetheria Chronicles save.'); };

export function createProfile(): Profile {
  const starterBlade = { ...EQUIPMENT_POOL[0], id: 'starter-kael-weapon' };
  const starterArmor = { ...EQUIPMENT_POOL[1], id: 'starter-kael-armor' };
  const starterCharm = { ...EQUIPMENT_POOL[2], id: 'starter-lyra-accessory' };
  return {
    version: 1, gems: 2400, gold: 500, unlockedStage: 1,
    ownedHeroes: ['kael', 'lyra'], party: ['kael', 'lyra'], heroLevels: { kael: 1, lyra: 1 },
    inventory: [starterBlade, starterArmor, starterCharm],
    equipped: { kael: { weapon: starterBlade.id, armor: starterArmor.id }, lyra: { accessory: starterCharm.id } },
    wins: [], recruitedStoryHeroes: [], summons: 0, legendaryPity: 0,
  };
}

/** Copies only known keys and canonical equipment stats. Imported objects never enter live state. */
export function validateProfile(value: unknown): Profile {
  if (!record(value) || value.version !== 1) return fail();
  if (!integer(value.gems, 0, 1_000_000_000) || !integer(value.gold, 0, 1_000_000_000)) return fail();
  if (!integer(value.unlockedStage, 1, STAGES.length) || !integer(value.summons, 0, 10_000_000) || !integer(value.legendaryPity, 0, 49)) return fail();
  const owned = value.ownedHeroes;
  if (!Array.isArray(owned) || owned.length < 2 || owned.length > HEROES.length || owned.some(id => typeof id !== 'string' || !heroIds.has(id)) || new Set(owned).size !== owned.length || !owned.includes('kael') || !owned.includes('lyra')) return fail();
  const party = value.party;
  if (!Array.isArray(party) || party.length < 1 || party.length > 4 || party.some(id => !owned.includes(id)) || new Set(party).size !== party.length) return fail();
  if (!record(value.heroLevels) || !record(value.equipped)) return fail();
  const heroLevels: Profile['heroLevels'] = {};
  const equipped: Profile['equipped'] = {};
  for (const id of owned as string[]) {
    const level = value.heroLevels[id];
    if (!integer(level, 1, MAX_HERO_LEVEL)) return fail();
    heroLevels[id] = level;
  }
  if (!Array.isArray(value.inventory) || value.inventory.length > 5000) return fail();
  const inventory: EquipmentInstance[] = [];
  const itemIds = new Set<string>();
  for (const entry of value.inventory) {
    if (!record(entry) || typeof entry.id !== 'string' || !safeId.test(entry.id) || itemIds.has(entry.id) || typeof entry.key !== 'string') return fail();
    const definition = equipmentByKey.get(entry.key);
    if (!definition || entry.slot !== definition.slot || entry.rarity !== definition.rarity || entry.attack !== definition.attack || entry.hp !== definition.hp || entry.defense !== definition.defense) return fail();
    inventory.push({ ...definition, id: entry.id });
    itemIds.add(entry.id);
  }
  const assigned = new Set<string>();
  for (const id of owned as string[]) {
    const heroEquipment = value.equipped[id] ?? {};
    if (!record(heroEquipment)) return fail();
    equipped[id] = {};
    for (const slot of slots) {
      const itemId = heroEquipment[slot];
      if (itemId === undefined) continue;
      if (typeof itemId !== 'string' || assigned.has(itemId) || !inventory.some(item => item.id === itemId && item.slot === slot)) return fail();
      equipped[id][slot] = itemId;
      assigned.add(itemId);
    }
  }
  const wins = value.wins;
  if (!Array.isArray(wins) || wins.length > STAGES.length || wins.some(id => !integer(id, 1, STAGES.length)) || new Set(wins).size !== wins.length) return fail();
  const orderedWins = [...wins].sort((a, b) => a - b);
  if (orderedWins.some((id, index) => id !== index + 1) || value.unlockedStage !== Math.min(STAGES.length, orderedWins.length + 1)) return fail();
  const recruited = value.recruitedStoryHeroes;
  if (!Array.isArray(recruited) || recruited.some(id => !owned.includes(id) || !HEROES.some(hero => hero.id === id && hero.storyStage && orderedWins.includes(hero.storyStage))) || new Set(recruited).size !== recruited.length) return fail();
  for (const hero of HEROES.filter(item => item.storyStage)) {
    if (hero.storyStage !== undefined && orderedWins.includes(hero.storyStage) && (!owned.includes(hero.id) || !recruited.includes(hero.id))) return fail();
    if (hero.storyStage !== undefined && !orderedWins.includes(hero.storyStage) && owned.includes(hero.id)) return fail();
  }
  return {
    version: 1, gems: value.gems, gold: value.gold, unlockedStage: value.unlockedStage,
    ownedHeroes: [...owned], party: [...party], heroLevels, inventory, equipped,
    wins: orderedWins, recruitedStoryHeroes: [...recruited], summons: value.summons, legendaryPity: value.legendaryPity,
  };
}

export function parseSave(json: string): Profile {
  if (typeof json !== 'string' || json.length > 2_000_000) return fail();
  let value: unknown;
  try { value = JSON.parse(json) as unknown; } catch { return fail(); }
  // Exports include a format label; the stored profile itself is also accepted.
  if (record(value) && value.format === 'aetheria-chronicles') {
    if (value.version !== 1) return fail();
    return validateProfile(value.profile);
  }
  return validateProfile(value);
}
