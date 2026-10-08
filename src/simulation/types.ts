export type HeroRole = 'knight' | 'healer' | 'mage' | 'rogue' | 'guardian' | 'ranger' | 'paladin';
export type EquipmentSlot = 'weapon' | 'armor' | 'accessory';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type Action = 'idle' | 'attack' | 'skill' | 'hit' | 'dead';
export type SkillKind = 'strike' | 'cleave' | 'heal' | 'healAll' | 'shield' | 'shieldAll' | 'blast' | 'execute' | 'renew';

export interface SkillDefinition {
  id: string; name: string; description: string; icon: string; kind: SkillKind;
  cooldown: number; cost: number; power: number;
}
export interface HeroDefinition {
  id: string; name: string; title: string; description: string; role: HeroRole;
  color: string; modelKey: string; price: number; storyStage?: number;
  baseHp: number; baseAttack: number; baseDefense: number; attackInterval: number;
  skills: SkillDefinition[]; passive: { name: string; description: string };
}
export interface StageDefinition {
  id: number; name: string; subtitle: string; description: string;
  location: string; boss: string; color: string; recommendedLevel: number;
  rewardGems: number; rewardGold: number;
}
export interface EquipmentDefinition {
  key: string; name: string; slot: EquipmentSlot; rarity: Rarity;
  attack: number; hp: number; defense: number;
}
export interface EquipmentInstance extends EquipmentDefinition { id: string }
export interface Profile {
  version: 1; gems: number; gold: number; unlockedStage: number;
  ownedHeroes: string[]; party: string[]; heroLevels: Record<string, number>;
  inventory: EquipmentInstance[];
  equipped: Record<string, Partial<Record<EquipmentSlot, string>>>;
  wins: number[]; recruitedStoryHeroes: string[];
  summons: number; legendaryPity: number;
}
export interface Combatant {
  id: string; heroId?: string; modelKey: string; name: string;
  side: 'ally' | 'enemy'; role: HeroRole | 'monster' | 'boss';
  hp: number; maxHp: number; attack: number; defense: number;
  x: number; z: number; alive: boolean; action: Action; actionSeq: number;
  targetId?: string; cooldowns: number[]; shield: number; energy: number;
  attackTimer: number; attackInterval: number; actionTimer: number;
}
export interface CombatEvent {
  id: number; type: 'damage' | 'heal' | 'shield' | 'skill' | 'death' | 'wave';
  sourceId?: string; targetId?: string; amount?: number; critical?: boolean;
  label?: string; createdAt: number;
}
export interface BattleRewards {
  gems: number; gold: number; firstClear: boolean; hero?: string;
  equipment: EquipmentInstance[];
}
export interface BattleState {
  id: string; stageId: number; wave: number; status: 'fighting' | 'won' | 'lost';
  elapsed: number; speed: 1 | 2; paused: boolean; auto: boolean;
  allies: Combatant[]; enemies: Combatant[]; effects: CombatEvent[];
  rewardClaimed: boolean; rewards?: BattleRewards; waveTransition: number;
}
export interface GameState { profile: Profile; battle: BattleState | null; notice: string; revision: number }
export interface StorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
export interface EngineOptions { storage?: StorageLike | null; random?: () => number; now?: () => number }
