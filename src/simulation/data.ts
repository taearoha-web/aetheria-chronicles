import type { EquipmentDefinition, HeroDefinition, StageDefinition } from './types';
import { ACTION_TIMINGS } from './timing';

export const HEROES: HeroDefinition[] = [
  {
    id: 'kael', name: 'Kael', title: 'Dawnblade Knight', role: 'knight', attackMode: 'melee', color: '#72c6ff', modelKey: 'knight', price: 0,
    description: 'อัศวินหนุ่มแห่งรุ่งอรุณ สวมเกราะขาวน้ำเงินและต่อสู้ด้วยดาบ เขายืนแนวหน้าเพื่อปกป้องคำสัญญาที่ให้ไว้กับสหาย',
    baseHp: 1250, baseAttack: 92, baseDefense: 28, attackInterval: 1.45,
    skills: [
      { id: 'dawnstrike', name: 'คมดาบรุ่งอรุณ', icon: '⚔', description: 'เข้าประชิดแล้วฟันกวาดศัตรูด้านหน้า สร้างความเสียหาย 250% ATK เมื่อคมดาบปะทะ', kind: 'cleave', cooldown: 7, cost: 20, power: 2.5, targetShape: 'frontArc', radius: 2.8, timing: ACTION_TIMINGS.kael.skills[0] },
      { id: 'sunward', name: 'คำสัตย์พิทักษ์', icon: '◇', description: 'ยกดาบสร้างเกราะให้เพื่อนร่วมทีมที่ยังมีชีวิตทุกคน ดูดซับความเสียหายเท่ากับ 210% ATK', kind: 'shieldAll', cooldown: 15, cost: 28, power: 2.1, timing: ACTION_TIMINGS.kael.skills[1] },
      { id: 'horizon', name: 'พิพากษารุ่งอรุณ', icon: '✦', description: 'เข้าประชิด กระโดดยกดาบแล้วฟาดลงพื้น สร้างความเสียหาย 320% ATK รอบจุดปะทะ 1 ครั้ง', kind: 'cleave', cooldown: 22, cost: 42, power: 3.2, targetShape: 'targetArea', radius: 2.8, timing: ACTION_TIMINGS.kael.skills[2] },
    ],
    passive: { name: 'ผู้รักษาคำสัตย์', description: 'DEF เพิ่ม 25% และยืนแนวหน้าเพื่อดึงการโจมตีให้ห่างจากผู้เยียวยา' },
  },
  {
    id: 'lyra', name: 'Lyra', title: 'Crystal Priestess', role: 'healer', attackMode: 'ranged', color: '#f3b8fa', modelKey: 'healer', price: 0,
    description: 'นักบวชสาวผู้ถือคทาคริสตัล เธออยู่แนวหลังเพื่อเยียวยาสหาย สร้างม่านคุ้มครอง และใช้แสงพิพากษาศัตรู',
    baseHp: 780, baseAttack: 78, baseDefense: 13, attackInterval: 1.8,
    skills: [
      { id: 'starlight', name: 'คำภาวนาเยียวยา', icon: '✚', description: 'ประสานคำภาวนากับคทา ฟื้นฟู HP ให้เพื่อนร่วมทีมที่ยังมีชีวิตทุกคนเท่ากับ 290% ATK', kind: 'healAll', cooldown: 9, cost: 22, power: 2.9, timing: ACTION_TIMINGS.lyra.skills[0] },
      { id: 'sanctuary', name: 'ม่านคริสตัล', icon: '❋', description: 'ยกคทาให้คริสตัลผลิบาน สร้างเกราะให้ทุกคน ดูดซับความเสียหายเท่ากับ 260% ATK', kind: 'shieldAll', cooldown: 15, cost: 30, power: 2.6, timing: ACTION_TIMINGS.lyra.skills[1] },
      { id: 'astral', name: 'แสงพิพากษา', icon: '✧', description: 'รวบรวมแสงที่ปลายคทาแล้วปล่อยเสาแสง สร้างความเสียหาย 300% ATK แก่ศัตรูทุกตัว 1 ครั้ง', kind: 'blast', cooldown: 23, cost: 42, power: 3, timing: ACTION_TIMINGS.lyra.skills[2] },
    ],
    passive: { name: 'แสงแห่งความเมตตา', description: 'เมื่อการโจมตีปกติโดนเป้าหมาย ฟื้นฟู HP ให้สหายที่บาดเจ็บมากที่สุดเท่ากับ 35% ATK' },
  },
  {
    id: 'seraphina', name: 'Seraphina', title: 'Crimson Phoenix', role: 'mage', attackMode: 'ranged', color: '#fe927f', modelKey: 'seraphina', price: 0, storyStage: 1,
    description: 'An immortal phoenix whose crimson feathers carry the fire of a forgotten citadel.',
    baseHp: 760, baseAttack: 116, baseDefense: 12, attackInterval: 1.85,
    skills: [
      { id: 'ember', name: 'Ember Spear', icon: '➶', description: 'Pierce the nearest enemy for 340% ATK.', kind: 'strike', cooldown: 8, cost: 20, power: 3.4 },
      { id: 'inferno', name: 'Inferno', icon: '♨', description: 'Deal 230% ATK to every enemy.', kind: 'blast', cooldown: 15, cost: 32, power: 2.3 },
      { id: 'phoenix', name: 'Phoenix Fall', icon: '✹', description: 'A fiery comet deals 350% ATK to every enemy.', kind: 'blast', cooldown: 25, cost: 48, power: 3.5 },
    ],
    passive: { name: 'Burning Heart', description: 'Deals 15% more damage while above half HP.' },
  },
  {
    id: 'riven', name: 'Riven', title: 'Abyssal Blademaster', role: 'rogue', attackMode: 'melee', color: '#b9a1ff', modelKey: 'riven', price: 0, storyStage: 2,
    description: 'A winged warrior of the abyss who turns his dark blades against the Eclipse King.',
    baseHp: 840, baseAttack: 104, baseDefense: 17, attackInterval: 1.05,
    skills: [
      { id: 'mooncut', name: 'Moon Cut', icon: '☽', description: 'Strike the weakest enemy for 320% ATK.', kind: 'execute', cooldown: 7, cost: 20, power: 3.2 },
      { id: 'bladedance', name: 'Blade Dance', icon: '⚔', description: 'Sweep through all enemies for 210% ATK.', kind: 'cleave', cooldown: 14, cost: 30, power: 2.1 },
      { id: 'eclipse', name: 'Eclipse', icon: '◈', description: 'Execute the weakest enemy for 580% ATK.', kind: 'execute', cooldown: 23, cost: 45, power: 5.8 },
    ],
    passive: { name: 'Shadow Edge', description: 'Basic attacks have a 30% critical chance instead of 10%.' },
  },
  {
    id: 'astrid', name: 'Astrid', title: 'Crystal Titan', role: 'guardian', attackMode: 'melee', color: '#8ddff4', modelKey: 'astrid', price: 1200,
    description: 'A living crystal titan who protects her companions behind an unbreakable stone guard.',
    baseHp: 1550, baseAttack: 78, baseDefense: 36, attackInterval: 1.65,
    skills: [
      { id: 'frostbite', name: 'Frostbite', icon: '❄', description: 'Deal 330% ATK to the nearest enemy.', kind: 'strike', cooldown: 8, cost: 20, power: 3.3 },
      { id: 'icewall', name: 'Icewall', icon: '◇', description: 'Shield every ally for 350% ATK.', kind: 'shieldAll', cooldown: 15, cost: 28, power: 3.5 },
      { id: 'winter', name: 'Winter Crown', icon: '✵', description: 'Deal 300% ATK to all enemies.', kind: 'blast', cooldown: 24, cost: 44, power: 3 },
    ],
    passive: { name: 'Unbroken', description: 'Takes 15% less damage while below half HP.' },
  },
  {
    id: 'elias', name: 'Elias', title: 'Thunderfang Spirit', role: 'mage', attackMode: 'ranged', color: '#b8a6ff', modelKey: 'elias', price: 1200,
    description: 'A legendary wolf whose fangs and mane crackle with the ancient power of thunder.',
    baseHp: 820, baseAttack: 127, baseDefense: 13, attackInterval: 1.9,
    skills: [
      { id: 'bolt', name: 'Thunderbolt', icon: 'ϟ', description: 'Deal 350% ATK to the nearest enemy.', kind: 'strike', cooldown: 8, cost: 18, power: 3.5 },
      { id: 'chain', name: 'Chain Lightning', icon: '⌁', description: 'Deal 240% ATK to every enemy.', kind: 'blast', cooldown: 14, cost: 30, power: 2.4 },
      { id: 'tempest', name: 'Tempest', icon: '✺', description: 'Deal 360% ATK to every enemy.', kind: 'blast', cooldown: 24, cost: 44, power: 3.6 },
    ],
    passive: { name: 'Static Charge', description: 'Regenerates 2 extra energy per second.' },
  },
  {
    id: 'nova', name: 'Nova', title: 'Wind Monkey King', role: 'ranger', attackMode: 'melee', color: '#a8e5ae', modelKey: 'nova', price: 1200,
    description: 'A fearless monkey king whose enchanted staff commands the winds of the wildwood.',
    baseHp: 880, baseAttack: 110, baseDefense: 16, attackInterval: 1.25,
    skills: [
      { id: 'pierce', name: 'Wind Staff', icon: '➶', description: 'Strike the weakest enemy with the wind staff for 340% ATK.', kind: 'execute', cooldown: 8, cost: 18, power: 3.4 },
      { id: 'volley', name: 'Gale Sweep', icon: '⋮', description: 'Deal 220% ATK to every enemy.', kind: 'cleave', cooldown: 14, cost: 28, power: 2.2 },
      { id: 'hunt', name: 'Final Hunt', icon: '✧', description: 'Deal 620% ATK to the weakest enemy.', kind: 'execute', cooldown: 24, cost: 44, power: 6.2 },
    ],
    passive: { name: 'Keen Eye', description: 'Deals 20% extra damage against bosses.' },
  },
  {
    id: 'lucien', name: 'Lucien', title: 'Radiant Lion Guardian', role: 'paladin', attackMode: 'melee', color: '#f2d38a', modelKey: 'lucien', price: 1200,
    description: 'A golden lion spirit whose radiant mane restores courage and shields his companions.',
    baseHp: 1190, baseAttack: 94, baseDefense: 28, attackInterval: 1.5,
    skills: [
      { id: 'judgement', name: 'Judgement', icon: '⚔', description: 'Deal 310% ATK to the nearest enemy.', kind: 'strike', cooldown: 7, cost: 18, power: 3.1 },
      { id: 'grace', name: 'Golden Grace', icon: '✚', description: 'Restore 230% ATK as HP to every ally.', kind: 'healAll', cooldown: 14, cost: 28, power: 2.3 },
      { id: 'covenant', name: 'Covenant', icon: '◇', description: 'Heal every ally for 280% ATK and grant a small shield.', kind: 'renew', cooldown: 22, cost: 42, power: 2.8 },
    ],
    passive: { name: 'Blessed Steel', description: 'Recovers 15% of basic attack damage as HP.' },
  },
];

export const HERO_BY_ID: Record<string, HeroDefinition> = Object.assign(Object.create(null) as Record<string, HeroDefinition>, Object.fromEntries(HEROES.map(hero => [hero.id, hero])));

export const ENEMY_MODELS = [
  { modelKey: 'tiger', name: 'Crystal Prowler' },
  { modelKey: 'pegasus', name: 'Fallen Skywing' },
  { modelKey: 'peacock', name: 'Galecrest Spirit' },
];
export const BOSS_MODELS = ['boss-earth', 'boss-dark', 'boss-firelion', 'boss-seadragon', 'boss-paladin'];

export const STAGES: StageDefinition[] = [
  { id: 1, name: 'Whispering Grove', subtitle: 'The first ember', description: 'Follow a distant cry into the ancient woods. An unexpected ally is waiting.', location: 'Verdant Reach', boss: 'Thornborn Warden', color: '#85baa3', recommendedLevel: 1, rewardGems: 180, rewardGold: 160 },
  { id: 2, name: 'Moonfall Ruins', subtitle: 'A promise in shadow', description: 'Cross the ruined moon temple and find the stranger watching from its towers.', location: 'Silvermoon Valley', boss: 'Moonstone Revenant', color: '#98a9df', recommendedLevel: 2, rewardGems: 220, rewardGold: 220 },
  { id: 3, name: 'Ember Pass', subtitle: 'Through fire', description: 'The old mountain road burns with a fire that the rain cannot extinguish.', location: 'Ashen Highlands', boss: 'Cindermaw', color: '#dfad88', recommendedLevel: 3, rewardGems: 260, rewardGold: 300 },
  { id: 4, name: 'Crystal Sanctum', subtitle: 'A shattered reflection', description: 'Discover what sleeps beneath the floating sanctuary of the first oracles.', location: 'Luminous Expanse', boss: 'Hollow Seraph', color: '#baaaec', recommendedLevel: 5, rewardGems: 320, rewardGold: 400 },
  { id: 5, name: 'The Fallen Citadel', subtitle: 'A dawn worth fighting for', description: 'Return to the gates where everything began. Break the crown of the Eclipse King.', location: 'Crown of Aetheria', boss: 'Eclipse King', color: '#bfa0c3', recommendedLevel: 7, rewardGems: 420, rewardGold: 550 },
];

export const EQUIPMENT_POOL: EquipmentDefinition[] = [
  { key: 'iron-blade', name: 'Dawnsteel Blade', slot: 'weapon', rarity: 'common', attack: 16, hp: 0, defense: 0 },
  { key: 'woven-robe', name: 'Traveler’s Mantle', slot: 'armor', rarity: 'common', attack: 0, hp: 120, defense: 5 },
  { key: 'copper-ring', name: 'Amber Band', slot: 'accessory', rarity: 'common', attack: 6, hp: 55, defense: 2 },
  { key: 'silver-blade', name: 'Moonlit Edge', slot: 'weapon', rarity: 'rare', attack: 30, hp: 20, defense: 0 },
  { key: 'silver-mail', name: 'Silvermoon Vestment', slot: 'armor', rarity: 'rare', attack: 0, hp: 230, defense: 10 },
  { key: 'sapphire-charm', name: 'Azure Heart', slot: 'accessory', rarity: 'rare', attack: 12, hp: 110, defense: 4 },
  { key: 'ember-blade', name: 'Phoenix Oath', slot: 'weapon', rarity: 'epic', attack: 52, hp: 60, defense: 2 },
  { key: 'astral-coat', name: 'Astral Veil', slot: 'armor', rarity: 'epic', attack: 5, hp: 390, defense: 17 },
  { key: 'star-pendant', name: 'Starseeker’s Tear', slot: 'accessory', rarity: 'epic', attack: 22, hp: 190, defense: 7 },
  { key: 'dawnbringer', name: 'Dawnbringer', slot: 'weapon', rarity: 'legendary', attack: 88, hp: 120, defense: 5 },
  { key: 'celestial-aegis', name: 'Celestial Aegis', slot: 'armor', rarity: 'legendary', attack: 10, hp: 650, defense: 28 },
  { key: 'eternal-star', name: 'The Eternal Star', slot: 'accessory', rarity: 'legendary', attack: 38, hp: 320, defense: 12 },
];

export const SUMMON_COST = 160;
export const SUMMON_TEN_COST = 1440;
export const SUMMON_RATES = { common: 0.5, rare: 0.35, epic: 0.12, legendary: 0.03 } as const;
export const LEGENDARY_PITY = 50;
export const MAX_HERO_LEVEL = 20;
export const SAVE_KEY = 'aetheria-chronicles-save-v1';
