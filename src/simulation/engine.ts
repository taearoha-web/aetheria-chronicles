import { BOSS_MODELS, ENEMY_MODELS, EQUIPMENT_POOL, HERO_BY_ID, HEROES, LEGENDARY_PITY, MAX_HERO_LEVEL, SAVE_KEY, STAGES, SUMMON_COST, SUMMON_TEN_COST } from './data';
import { createProfile, parseSave } from './storage';
import { approach, combatDistance, FIELD_X, FIELD_Z, inAttackRange, nearest } from './movement';
import { ACTION_TIMINGS, getActionTiming } from './timing';
import type { ActionTiming } from './timing';
import type { BattleRewards, Combatant, CombatEvent, EngineOptions, EquipmentInstance, EquipmentSlot, GameState, HeroDefinition, Rarity, SkillDefinition, StorageLike } from './types';

const STEP = 1 / 30;
const FRONTLINE = new Set(['knight', 'guardian', 'paladin']);
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export class GameEngine {
  state: GameState;
  latestResults: EquipmentInstance[] = [];
  private storage: StorageLike | null;
  private random: () => number;
  private now: () => number;
  private serial = 0;
  private eventSerial = 0;
  private accumulator = 0;
  private autoDefault = false;
  private speedDefault: 1 | 2 = 1;
  private pendingHits: Array<{ sourceId: string; targetId: string; dueAt: number; sequence: number }> = [];
  private pendingSkills = new Map<string, { skill: SkillDefinition; slot: number; targetId: string }>();
  private pendingImpacts: Array<{ sourceId: string; targetIds: string[]; sequence: number; dueAt: number; skill: SkillDefinition; slot: number; anchor: { x: number; z: number } }> = [];

  constructor(options: EngineOptions = {}) {
    this.random = options.random ?? Math.random;
    this.now = options.now ?? Date.now;
    this.storage = options.storage === undefined ? this.browserStorage() : options.storage;
    this.state = { profile: createProfile(), battle: null, notice: '', revision: 0 };
    this.load();
  }

  private browserStorage(): StorageLike | null {
    try { return typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null; } catch { return null; }
  }

  private roll(): number { const value = this.random(); return Number.isFinite(value) ? clamp(value, 0, 0.999999999) : 0.5; }
  private uid(prefix: string): string {
    let id: string;
    do { id = `${prefix}-${Math.floor(this.now()).toString(36)}-${(++this.serial).toString(36)}-${Math.floor(this.roll() * 1e8).toString(36)}`; }
    while (this.state.profile.inventory.some(item => item.id === id));
    return id;
  }
  private notify(message: string): false { this.state.notice = message; this.state.revision += 1; return false; }
  private changed(message = ''): void {
    this.state.notice = message;
    this.state.revision += 1;
    this.save();
  }
  private idleOnly(): boolean { return this.state.battle === null; }

  load(): boolean {
    if (this.state.battle) return this.notify('Return to camp before loading a save.');
    try {
      const stored = this.storage?.getItem(SAVE_KEY);
      if (!stored) return false;
      const profile = parseSave(stored);
      this.state.profile = profile;
      this.state.revision += 1;
      return true;
    } catch {
      this.state.notice = 'Your existing save could not be read. A fresh session is ready; import a backup to restore progress.';
      return false;
    }
  }

  save(): boolean {
    if (!this.storage) return false;
    try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.state.profile)); return true; }
    catch { this.state.notice = 'Progress could not be saved on this device. Export a backup from Settings.'; return false; }
  }

  exportSave(): string {
    return JSON.stringify({ format: 'aetheria-chronicles', version: 1, exportedAt: new Date(this.now()).toISOString(), profile: this.state.profile }, null, 2);
  }

  importSave(json: string): boolean {
    if (!this.idleOnly()) return this.notify('Return to camp before importing a backup.');
    try {
      const imported = parseSave(json);
      this.state.profile = imported;
      this.latestResults = [];
      this.changed('Your adventure has been restored.');
      return true;
    } catch { return this.notify('This backup is invalid or from an unsupported version. Your progress has not changed.'); }
  }

  resetSave(): boolean {
    if (!this.idleOnly()) return this.notify('Return to camp before starting a new adventure.');
    this.state.profile = createProfile();
    this.latestResults = [];
    this.changed('A new adventure begins.');
    return true;
  }

  getHeroStats(heroId: string): { hp: number; maxHp: number; attack: number; defense: number; level: number } {
    const hero = HERO_BY_ID[heroId];
    if (!hero) return { hp: 0, maxHp: 0, attack: 0, defense: 0, level: 0 };
    const level = this.state.profile.heroLevels[heroId] ?? 1;
    const growth = 1 + (level - 1) * 0.105;
    const equipment = Object.values(this.state.profile.equipped[heroId] ?? {}).map(id => this.state.profile.inventory.find(item => item.id === id)).filter((item): item is EquipmentInstance => Boolean(item));
    const hp = Math.round(hero.baseHp * growth + equipment.reduce((sum, item) => sum + item.hp, 0));
    const attack = Math.round(hero.baseAttack * growth + equipment.reduce((sum, item) => sum + item.attack, 0));
    let defense = Math.round(hero.baseDefense * growth + equipment.reduce((sum, item) => sum + item.defense, 0));
    if (heroId === 'kael') defense = Math.round(defense * 1.25);
    return { hp, maxHp: hp, attack, defense, level };
  }

  getUpgradeCost(heroId: string): number {
    const level = this.state.profile.heroLevels[heroId];
    return level && level < MAX_HERO_LEVEL ? Math.round(60 + level * 35) : 0;
  }

  upgradeHero(heroId: string): boolean {
    if (!this.idleOnly()) return this.notify('Return to camp before training a hero.');
    if (!this.state.profile.ownedHeroes.includes(heroId)) return this.notify('Recruit this hero before training them.');
    const cost = this.getUpgradeCost(heroId);
    if (cost === 0) return this.notify('This hero has reached the maximum level.');
    if (this.state.profile.gold < cost) return this.notify('Not enough gold. Complete stages to earn more.');
    this.state.profile.gold -= cost;
    this.state.profile.heroLevels[heroId] += 1;
    this.changed(`${HERO_BY_ID[heroId].name} reached level ${this.state.profile.heroLevels[heroId]}.`);
    return true;
  }

  buyHero(heroId: string): boolean {
    if (!this.idleOnly()) return this.notify('Return to camp before recruiting a hero.');
    const hero = HERO_BY_ID[heroId];
    if (!hero || hero.price <= 0 || hero.storyStage) return this.notify('This hero joins through the story.');
    if (this.state.profile.ownedHeroes.includes(heroId)) return this.notify('This hero is already in your roster.');
    if (this.state.profile.gems < hero.price) return this.notify('Not enough gems. Complete stages to earn more.');
    this.state.profile.gems -= hero.price;
    this.recruitHero(hero);
    this.changed(`${hero.name} has joined your roster.`);
    return true;
  }

  private recruitHero(hero: HeroDefinition): void {
    const profile = this.state.profile;
    if (profile.ownedHeroes.includes(hero.id)) return;
    profile.ownedHeroes.push(hero.id);
    profile.heroLevels[hero.id] = 1;
    profile.equipped[hero.id] = {};
    if (profile.party.length < 4) profile.party.push(hero.id);
  }

  setParty(heroIds: string[]): boolean {
    if (!this.idleOnly()) return this.notify('Return to camp before changing your party.');
    if (!Array.isArray(heroIds) || heroIds.length < 1 || heroIds.length > 4 || new Set(heroIds).size !== heroIds.length || heroIds.some(id => !this.state.profile.ownedHeroes.includes(id))) return this.notify('Choose one to four different recruited heroes.');
    this.state.profile.party = [...heroIds];
    this.changed('Party updated.');
    return true;
  }

  equip(heroId: string, itemId: string): boolean {
    if (!this.idleOnly()) return this.notify('Return to camp before changing equipment.');
    if (!this.state.profile.ownedHeroes.includes(heroId)) return this.notify('Recruit this hero first.');
    const item = this.state.profile.inventory.find(entry => entry.id === itemId);
    if (!item) return this.notify('This equipment is not in your inventory.');
    // Equipment belongs to exactly one hero. Equipping it transfers it safely.
    for (const slots of Object.values(this.state.profile.equipped)) {
      for (const slot of ['weapon', 'armor', 'accessory'] as EquipmentSlot[]) {
        if (slots[slot] === itemId) delete slots[slot];
      }
    }
    (this.state.profile.equipped[heroId] ??= {})[item.slot] = itemId;
    this.changed(`${item.name} equipped to ${HERO_BY_ID[heroId].name}.`);
    return true;
  }

  unequip(heroId: string, slot: EquipmentSlot): boolean {
    if (!this.idleOnly()) return this.notify('Return to camp before changing equipment.');
    const equipped = this.state.profile.equipped[heroId];
    if (!equipped || !['weapon', 'armor', 'accessory'].includes(slot) || !equipped[slot]) return false;
    delete equipped[slot];
    this.changed('Equipment removed.');
    return true;
  }

  summonEquipment(count: 1 | 10 = 1): EquipmentInstance[] {
    this.latestResults = [];
    if (!this.idleOnly()) { this.notify('Return to camp before summoning equipment.'); return []; }
    if (count !== 1 && count !== 10) { this.notify('Choose a single summon or ten summons.'); return []; }
    const cost = count === 10 ? SUMMON_TEN_COST : SUMMON_COST;
    const profile = this.state.profile;
    if (profile.gems < cost) { this.notify('Not enough gems. Complete stages to earn more.'); return []; }
    if (profile.inventory.length + count > 5000) { this.notify('Your equipment vault is full.'); return []; }
    const items: EquipmentInstance[] = [];
    let hasRare = false;
    for (let i = 0; i < count; i += 1) {
      const roll = this.roll();
      let rarity: Rarity = roll < 0.03 ? 'legendary' : roll < 0.15 ? 'epic' : roll < 0.5 ? 'rare' : 'common';
      if (profile.legendaryPity + 1 >= LEGENDARY_PITY) rarity = 'legendary';
      if (count === 10 && i === 9 && !hasRare && rarity === 'common') rarity = 'rare';
      if (rarity !== 'common') hasRare = true;
      profile.legendaryPity = rarity === 'legendary' ? 0 : profile.legendaryPity + 1;
      const pool = EQUIPMENT_POOL.filter(item => item.rarity === rarity);
      const definition = pool[Math.floor(this.roll() * pool.length)];
      items.push({ ...definition, id: this.uid('gear') });
    }
    profile.gems -= cost;
    profile.summons += count;
    profile.inventory.push(...items);
    this.latestResults = items;
    this.changed(`${count === 1 ? 'A new relic answers' : 'Ten relics answer'} your call.`);
    return items;
  }

  startBattle(stageId: number): boolean {
    if (this.state.battle) return this.notify('Return to camp before starting another battle.');
    if (!Number.isInteger(stageId) || !STAGES.some(stage => stage.id === stageId) || stageId > this.state.profile.unlockedStage) return this.notify('Complete the previous stage first.');
    if (!this.state.profile.party.length) return this.notify('Add a hero to your party first.');
    const allies = this.state.profile.party.map((heroId, index) => this.makeAlly(heroId, index));
    this.accumulator = 0;
    this.clearPendingActions();
    this.state.battle = {
      id: this.uid('battle'), stageId, wave: 1, status: 'fighting', elapsed: 0,
      speed: this.speedDefault, paused: false, auto: this.autoDefault,
      allies, enemies: this.makeEnemies(stageId, 1), effects: [], rewardClaimed: false, waveTransition: 0,
    };
    this.state.notice = '';
    this.state.revision += 1;
    this.event({ type: 'wave', label: 'WAVE 1 / 3' });
    return true;
  }

  private makeAlly(heroId: string, index: number): Combatant {
    const hero = HERO_BY_ID[heroId];
    const stats = this.getHeroStats(heroId);
    return {
      id: heroId, heroId, modelKey: hero.modelKey, name: hero.name, side: 'ally', role: hero.role,
      hp: stats.hp, maxHp: stats.hp, attack: stats.attack, defense: stats.defense,
      x: FRONTLINE.has(hero.role) ? -1 : hero.attackMode === 'melee' ? -1.55 : -2.4,
      z: (index - (this.state.profile.party.length - 1) / 2) * 1.0,
      alive: true, action: 'idle', actionSeq: 0, cooldowns: [0, 0, 0], shield: 0, energy: 100,
      attackTimer: 0.4 + index * 0.12, attackInterval: hero.attackInterval, actionTimer: 0,
      actionStartedAt: 0, actionDuration: 0,
      attackMode: hero.attackMode, attackRange: hero.attackMode === 'melee' ? .24 : 3.45,
      radius: hero.id==='astrid'?.67:hero.id==='lucien'?.72:hero.id==='elias'?.55:.55,moveSpeed:hero.role==='rogue'?3.15:2.5,
    };
  }

  private makeEnemies(stageId: number, wave: number): Combatant[] {
    const stage = STAGES[stageId - 1];
    const scaling = 1 + 0.68 * (stageId - 1) + 0.06 * (stageId - 1) ** 2;
    const count = wave === 3 ? (stageId >= 3 ? 3 : 1) : stageId === 1 ? 2 : 3;
    return Array.from({ length: count }, (_, index) => {
      const boss = wave === 3 && index === 0;
      const creature = ENEMY_MODELS[(stageId + wave + index - 2) % ENEMY_MODELS.length];
      const hp = Math.round((boss ? 1000 : 230 + wave * 35) * scaling);
      return {
        id: `enemy-${wave}-${index}`, modelKey: boss ? BOSS_MODELS[stageId - 1] : creature.modelKey, name: boss ? stage.boss : creature.name,
        side: 'enemy' as const, role: boss ? 'boss' as const : 'monster' as const,
        hp, maxHp: hp, attack: Math.round((boss ? 55 : 25 + wave * 4) * scaling), defense: 7 + stageId * 3 + (boss ? 5 : 0),
        x: boss ? 1.7 : 1.25 + (index % 2) * 0.5,
        z: count === 1 ? 0 : (index - (count - 1) / 2) * 1.2,
        alive: true, action: 'idle' as const, actionSeq: 0, cooldowns: [], shield: 0, energy: 0,
        attackTimer: 1 + index * 0.3, attackInterval: boss ? 1.7 : 2.15 + index * 0.12, actionTimer: 0,
        actionStartedAt: 0, actionDuration: 0,
        attackMode:'melee' as const,attackRange:boss?.34:.23,radius:boss?.86:.64,moveSpeed:boss?1.8:2.15,
      };
    });
  }

  setAuto(enabled: boolean): void { this.autoDefault = enabled; if (this.state.battle) this.state.battle.auto = enabled; this.state.revision += 1; }
  setPaused(paused: boolean): void { if (this.state.battle?.status === 'fighting') { this.state.battle.paused = paused; this.state.revision += 1; } }
  setSpeed(speed: 1 | 2): void { if (speed !== 1 && speed !== 2) return; this.speedDefault = speed; if (this.state.battle) this.state.battle.speed = speed; this.state.revision += 1; }

  castSkill(heroId: string, slot: number): boolean {
    const battle = this.state.battle;
    if (!battle || battle.status !== 'fighting' || battle.paused || battle.waveTransition > 0) return false;
    const caster = battle.allies.find(ally => ally.heroId === heroId);
    const hero = HERO_BY_ID[heroId];
    if (!caster?.alive || !hero || !Number.isInteger(slot) || slot < 0 || slot > 2) return false;
    const skill = hero.skills[slot];
    // Manual taps interrupt a basic attack animation immediately. Damage and
    // resource costs still occur once; the automatic policy retains its gate.
    if (caster.queuedSkill!==undefined || (caster.action==='skill' && caster.actionTimer>0) || caster.cooldowns[slot] > 0 || caster.energy < skill.cost || !battle.enemies.some(enemy => enemy.alive)) return false;
    this.requestSkill(caster, skill, slot);
    this.state.revision += 1;
    this.checkOutcome();
    return true;
  }

  update(dtSeconds: number): void {
    const battle = this.state.battle;
    if (!battle || battle.status !== 'fighting' || battle.paused || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    // A hidden tab never catches up minutes of combat in one frame.
    this.accumulator += Math.min(dtSeconds, 0.5) * battle.speed;
    while (this.accumulator >= STEP && battle.status === 'fighting') {
      this.accumulator -= STEP;
      this.step(STEP);
    }
    this.state.revision += 1;
  }

  private step(dt: number): void {
    const battle = this.state.battle!;
    battle.elapsed += dt;
    battle.effects = battle.effects.filter(effect => battle.elapsed - effect.createdAt < 3.5);
    for (const actor of [...battle.allies, ...battle.enemies]) {
      actor.actionTimer = Math.max(0, actor.actionTimer - dt);
      if (actor.alive && actor.actionTimer === 0 && actor.action!=='move') { actor.action = 'idle'; delete actor.activeSkillSlot; }
      if (actor.alive && actor.side === 'ally') {
        actor.energy = Math.min(100, actor.energy + dt * (actor.heroId === 'elias' ? 8 : 6));
        actor.cooldowns = actor.cooldowns.map(cooldown => Math.max(0, cooldown - dt));
      }
    }
    if (battle.waveTransition > 0) {
      battle.waveTransition = Math.max(0, battle.waveTransition - dt);
      if (battle.waveTransition === 0) {
        battle.wave += 1;
        battle.enemies = this.makeEnemies(battle.stageId, battle.wave);
        for (const ally of battle.allies.filter(item => item.alive)) { ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.08); ally.energy = Math.min(100, ally.energy + 12); }
        this.event({ type: 'wave', label: battle.wave === 3 ? 'BOSS WAVE' : `WAVE ${battle.wave} / 3` });
      }
      return;
    }
    this.resolveHits();
    this.resolveSkillImpacts();
    this.checkOutcome();
    if(battle.status!=='fighting'||battle.waveTransition>0)return;
    for (const ally of battle.allies.filter(item => item.alive)) {
      const queued=this.pendingSkills.get(ally.id);
      if(queued){
        const target=battle.enemies.find(enemy=>enemy.id===queued.targetId&&enemy.alive)??this.selectEnemy(queued.skill.kind==='execute');
        if(target){
          if(inAttackRange(ally,target)){this.pendingSkills.delete(ally.id);delete ally.queuedSkill;this.useSkill(ally,queued.skill,queued.slot,true,target);}
          else this.advance(ally,target,dt,true);
        }
        continue;
      }
      if (battle.auto && ally.actionTimer <= 0.00001) this.autoSkill(ally);
      if (!battle.enemies.some(enemy => enemy.alive)) break;
      if(this.pendingSkills.has(ally.id))continue;
      ally.attackTimer -= dt;
      if(ally.actionTimer>0.00001)continue;
      const target=this.combatTarget(ally);
      if(target && ally.actionTimer<=0.00001 && !inAttackRange(ally,target)){this.advance(ally,target,dt);continue;}
      if(ally.action==='move')this.stopMoving(ally);
      if (ally.attackTimer <= 0 && ally.actionTimer <= 0.00001) {
        if (target) {
          this.animate(ally, 'attack', target.id);
          this.queueHit(ally,target);
          ally.attackTimer = ally.attackInterval;
        }
      }
    }
    this.checkOutcome();
    if (battle.status !== 'fighting' || battle.waveTransition > 0) return;
    for (const enemy of battle.enemies.filter(item => item.alive)) {
      enemy.attackTimer -= dt;
      if(enemy.actionTimer>0.00001)continue;
      const target=this.combatTarget(enemy);
      if(target && enemy.actionTimer<=0.00001 && !inAttackRange(enemy,target)){this.advance(enemy,target,dt);continue;}
      if(enemy.action==='move')this.stopMoving(enemy);
      if (enemy.attackTimer <= 0 && enemy.actionTimer <= 0.00001) {
        if (target) {
          const sweep = enemy.role === 'boss' && enemy.energy >= 3;
          if (sweep) {
            enemy.energy = 0;
            this.useSkill(enemy, { id: 'eclipse-burst', name: 'Eclipse Burst', description: '', icon: '✦', kind: 'blast', cooldown: 0, cost: 0, power: 0.8 }, 2, true, target);
          } else { this.animate(enemy, 'attack', target.id); this.queueHit(enemy,target); enemy.energy += 1; }
          enemy.attackTimer = enemy.attackInterval;
        }
      }
    }
    this.checkOutcome();
  }

  private autoSkill(caster: Combatant): void {
    if(this.pendingSkills.has(caster.id))return;
    const hero = HERO_BY_ID[caster.heroId!];
    const living = this.state.battle!.allies.filter(ally => ally.alive);
    // A priestess preserves healing priority once the frontline is wounded.
    const order = caster.heroId === 'lyra' ? [0, 1, 2] : [2, 1, 0];
    for (const slot of order) {
      const skill = hero.skills[slot];
      if (caster.cooldowns[slot] > 0 || caster.energy < skill.cost) continue;
      if (skill.kind === 'heal' && !living.some(ally => ally.hp / ally.maxHp < 0.73)) continue;
      if ((skill.kind === 'healAll' || skill.kind === 'renew') && !living.some(ally => ally.hp / ally.maxHp < (caster.heroId==='lyra' ? 0.78 : 0.63))) continue;
      if ((skill.kind === 'shieldAll' || skill.kind === 'shield') && living.every(ally => ally.shield > caster.attack)) continue;
      this.requestSkill(caster, skill, slot);
      break;
    }
  }

  private requestSkill(caster:Combatant,skill:SkillDefinition,slot:number):void {
    const target=skill.kind==='execute'?this.selectEnemy(true):this.combatTarget(caster);
    const offensive=['strike','cleave','blast','execute'].includes(skill.kind);
    if(caster.attackMode==='melee'&&offensive&&target&&!inAttackRange(caster,target)){
      caster.cooldowns[slot]=skill.cooldown;caster.energy-=skill.cost;caster.queuedSkill=slot;
      this.pendingSkills.set(caster.id,{skill,slot,targetId:target.id});
      caster.actionTimer=0;this.startMoving(caster,target);return;
    }
    this.useSkill(caster,skill,slot);
  }
  private useSkill(caster: Combatant, skill: SkillDefinition, slot: number, paid=false, lockedTarget?:Combatant): void {
    const battle = this.state.battle!;
    if(!paid){caster.cooldowns[slot] = skill.cooldown;caster.energy -= skill.cost;}
    const target = lockedTarget??(skill.kind === 'execute'?this.selectEnemy(true):this.combatTarget(caster));
    const friendly = caster.side === 'ally' ? battle.allies : battle.enemies;
    const hostile = caster.side === 'ally' ? battle.enemies : battle.allies;
    const anchor = { x: target?.x ?? caster.x, z: target?.z ?? caster.z };
    // Lock recipients at release. A dead recipient is skipped, never retargeted
    // after the wind-up has started. Melee approach may retarget before release.
    const targetIds = skill.kind === 'heal' ? [this.mostWounded()?.id].filter((id): id is string => !!id)
      : ['healAll', 'renew', 'shieldAll'].includes(skill.kind) ? friendly.filter(ally => ally.alive).map(ally => ally.id)
      : skill.kind === 'shield' ? [caster.id]
      : ['cleave', 'blast'].includes(skill.kind) ? hostile.filter(enemy => enemy.alive && this.insideSkillShape(caster, enemy, skill, anchor)).map(enemy => enemy.id)
      : target ? [target.id] : [];
    const timing = skill.timing ?? getActionTiming(caster.heroId, 'skill', slot);
    this.animate(caster, 'skill', targetIds[0], timing, slot);
    const dueAt = battle.elapsed + timing.impact;
    this.event({ type: 'skill', phase: 'cast', sourceId: caster.id, targetId: targetIds[0], targetIds, skillId: skill.id, skillSlot: slot, label: skill.name, actionSeq: caster.actionSeq, duration: timing.duration, impactAt: dueAt });
    this.pendingImpacts.push({ sourceId: caster.id, targetIds, sequence: caster.actionSeq, dueAt, skill, slot, anchor });
  }

  private insideSkillShape(caster: Combatant, target: Combatant, skill: SkillDefinition, anchor: { x: number; z: number }): boolean {
    if (!skill.targetShape) return true;
    const radius = skill.radius ?? 2.8;
    if (skill.targetShape === 'targetArea') return Math.hypot((target.x-anchor.x)*FIELD_X, (target.z-anchor.z)*FIELD_Z) <= radius + target.radius;
    const dx = (target.x-caster.x)*FIELD_X, dz = (target.z-caster.z)*FIELD_Z;
    const ax = (anchor.x-caster.x)*FIELD_X, az = (anchor.z-caster.z)*FIELD_Z;
    const distance = Math.hypot(dx, dz), aimLength = Math.hypot(ax, az);
    return distance <= radius + target.radius && (distance < 0.001 || aimLength < 0.001 || (dx*ax+dz*az)/(distance*aimLength) >= Math.cos(65*Math.PI/180));
  }

  private resolveSkillImpacts(): void {
    const battle = this.state.battle!, actors = [...battle.allies, ...battle.enemies];
    this.pendingImpacts = this.pendingImpacts.filter(impact => {
      const caster = actors.find(actor => actor.id === impact.sourceId);
      if (!caster?.alive || caster.actionSeq !== impact.sequence) return false;
      if (battle.elapsed + 1e-8 < impact.dueAt) return true;
      const { skill } = impact;
      const offensive = ['strike', 'cleave', 'blast', 'execute'].includes(skill.kind);
      const targets = impact.targetIds.map(id => actors.find(actor => actor.id === id)).filter((actor): actor is Combatant => Boolean(actor?.alive)).filter(actor => {
        if (!offensive) return true;
        if (!this.insideSkillShape(caster, actor, skill, impact.anchor)) return false;
        return caster.attackMode !== 'melee' || Boolean(skill.targetShape) || ['cleave','blast'].includes(skill.kind) || inAttackRange(caster, actor);
      });
      if (!targets.length) return false;
      this.event({ type: 'skillImpact', phase: 'impact', sourceId: caster.id, targetId: targets[0].id, targetIds: targets.map(actor => actor.id), skillId: skill.id, skillSlot: impact.slot, label: skill.name, actionSeq: impact.sequence, duration: caster.actionDuration, impactAt: impact.dueAt });
      for (const target of targets) {
        if (['heal', 'healAll', 'renew'].includes(skill.kind)) {
          this.heal(caster, target, caster.attack*skill.power);
          if (skill.kind === 'renew') this.shield(caster, target, caster.attack*1.5);
        } else if (['shield','shieldAll'].includes(skill.kind)) this.shield(caster, target, caster.attack*skill.power);
        else this.damage(caster, target, skill.power, true);
      }
      return false;
    });
  }

  private selectEnemy(weakest = false): Combatant | undefined {
    const enemies = this.state.battle!.enemies.filter(enemy => enemy.alive);
    return enemies.sort((a, b) => weakest ? a.hp - b.hp : a.x - b.x)[0];
  }
  private combatTarget(actor:Combatant):Combatant|undefined {
    const battle=this.state.battle!,opponents=(actor.side==='ally'?battle.enemies:battle.allies).filter(other=>other.alive);
    const retained=opponents.find(other=>other.id===actor.targetId);
    if(retained)return retained;
    const front=actor.side==='enemy'?opponents.filter(other=>FRONTLINE.has(other.role)):[];
    const target=nearest(actor,front.length?front:opponents);if(target)actor.targetId=target.id;return target;
  }
  private startMoving(actor:Combatant,target:Combatant):void {
    actor.targetId=target.id;
    if(actor.action!=='move'){actor.action='move';actor.actionSeq++;actor.actionStartedAt=this.state.battle!.elapsed;actor.actionDuration=0;delete actor.activeSkillSlot;delete actor.actionImpactAt;}
  }
  private stopMoving(actor:Combatant):void {actor.action='idle';actor.actionSeq++;}
  private advance(actor:Combatant,target:Combatant,dt:number,dash=false):void {
    this.startMoving(actor,target);
    approach(actor,target,[...this.state.battle!.allies,...this.state.battle!.enemies],dt,dash);
  }
  private queueHit(source:Combatant,target:Combatant):void {
    const authored = source.heroId && Object.hasOwn(ACTION_TIMINGS,source.heroId);
    const flight=authored?getActionTiming(source.heroId,'attack').impact:source.attackMode==='melee'?.18:Math.min(.34,.16+combatDistance(source,target)/25);
    source.actionImpactAt=this.state.battle!.elapsed+flight;
    this.pendingHits.push({sourceId:source.id,targetId:target.id,dueAt:this.state.battle!.elapsed+flight,sequence:source.actionSeq});
  }
  private resolveHits():void {
    const battle=this.state.battle!,actors=[...battle.allies,...battle.enemies];
    this.pendingHits=this.pendingHits.filter(hit=>{
      const source=actors.find(actor=>actor.id===hit.sourceId),target=actors.find(actor=>actor.id===hit.targetId);
      if(!source?.alive||!target?.alive||source.actionSeq!==hit.sequence)return false;
      if(battle.elapsed+1e-8<hit.dueAt)return true;
      if(!inAttackRange(source,target))return false;
      const damage=this.damage(source,target,1,false);
      if(source.heroId==='lyra'){const wounded=this.mostWounded();if(wounded)this.heal(source,wounded,source.attack*.35);}
      if(source.heroId==='lucien')this.heal(source,source,damage*.15);
      return false;
    });
  }
  private selectAlly(): Combatant | undefined {
    const allies = this.state.battle!.allies.filter(ally => ally.alive);
    const front = allies.filter(ally => FRONTLINE.has(ally.role));
    const pool = front.length > 0 && this.roll() < 0.8 ? front : allies;
    return pool[Math.floor(this.roll() * pool.length)];
  }
  private mostWounded(): Combatant | undefined { return this.state.battle!.allies.filter(ally => ally.alive).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]; }

  private animate(actor: Combatant, action: Combatant['action'], targetId?: string, authored?: ActionTiming, skillSlot?: number): void {
    const timing = authored ?? (action==='attack' ? getActionTiming(actor.heroId,'attack') : { duration: action==='skill'?0.9:0.45, impact:0.18 });
    actor.action = action;
    actor.actionSeq += 1;
    actor.targetId = targetId;
    actor.actionTimer = timing.duration;
    actor.actionDuration = timing.duration;
    actor.actionStartedAt = this.state.battle!.elapsed;
    actor.actionImpactAt = actor.actionStartedAt+timing.impact;
    actor.activeSkillSlot = action==='skill' ? skillSlot : undefined;
  }

  private damage(source: Combatant, target: Combatant, power: number, skill: boolean): number {
    if (!target.alive) return 0;
    const critical = this.roll() < (source.heroId === 'riven' ? 0.3 : 0.1);
    let amount = source.attack * power * (100 / (100 + target.defense * 2));
    if (source.heroId === 'seraphina' && source.hp > source.maxHp / 2) amount *= 1.15;
    if (source.heroId === 'nova' && target.role === 'boss') amount *= 1.2;
    if (target.heroId === 'astrid' && target.hp < target.maxHp / 2) amount *= 0.85;
    amount = Math.max(1, Math.round(amount * (critical ? 1.5 : 1) * (0.95 + this.roll() * 0.1)));
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    const dealt = Math.min(target.hp, amount - absorbed);
    target.hp = Math.max(0, target.hp - dealt);
    this.event({ type: 'damage', sourceId: source.id, targetId: target.id, amount: dealt, critical, label: absorbed > 0 && dealt === 0 ? 'BLOCK' : undefined });
    if (target.hp === 0) {
      target.alive = false; target.shield = 0; target.action = 'dead'; target.actionSeq += 1;
      target.actionStartedAt=this.state.battle!.elapsed;target.actionDuration=1.4;target.actionTimer=1.4;
      delete target.activeSkillSlot;delete target.queuedSkill;delete target.actionImpactAt;this.pendingSkills.delete(target.id);
      this.event({ type: 'death', sourceId: source.id, targetId: target.id });
    } else if (!skill && target.action === 'idle') { this.animate(target, 'hit', source.id, {duration:0.45,impact:0}); }
    return dealt;
  }

  private heal(source: Combatant, target: Combatant, raw: number): void {
    if (!target.alive) return;
    const amount = Math.min(target.maxHp - target.hp, Math.round(raw));
    if (amount <= 0) return;
    target.hp += amount;
    this.event({ type: 'heal', sourceId: source.id, targetId: target.id, amount });
  }
  private shield(source: Combatant, target: Combatant, raw: number): void {
    const amount = Math.round(raw);
    target.shield = Math.min(target.maxHp * 0.65, Math.max(target.shield, amount));
    this.event({ type: 'shield', sourceId: source.id, targetId: target.id, amount });
  }
  private event(event: Omit<CombatEvent, 'id' | 'createdAt'>): void {
    const battle = this.state.battle!;
    battle.effects.push({ ...event, id: ++this.eventSerial, createdAt: battle.elapsed });
    if (battle.effects.length > 48) battle.effects.splice(0, battle.effects.length - 48);
  }

  private checkOutcome(): void {
    const battle = this.state.battle!;
    if (battle.status !== 'fighting') return;
    if (!battle.allies.some(ally => ally.alive)) {
      battle.status = 'lost'; battle.paused = false;
      this.clearPendingActions();
      this.state.notice = 'Your party has fallen. Train your heroes or improve their equipment, then try again.';
      this.state.revision += 1;
      return;
    }
    if (!battle.enemies.some(enemy => enemy.alive)) {
      if (battle.wave < 3) { if (battle.waveTransition === 0) { battle.waveTransition = 1.25; this.clearPendingActions(); } }
      else this.finishVictory();
    }
  }

  private finishVictory(): void {
    const battle = this.state.battle!;
    if (battle.status !== 'fighting') return;
    battle.status = 'won'; battle.paused = false;
    this.clearPendingActions();
    const profile = this.state.profile;
    const stage = STAGES[battle.stageId - 1];
    const firstClear = !profile.wins.includes(stage.id);
    const rewards: BattleRewards = {
      gems: firstClear ? stage.rewardGems : 30 + stage.id * 10,
      gold: stage.rewardGold, firstClear, equipment: [],
    };
    profile.gems += rewards.gems;
    profile.gold += rewards.gold;
    if (firstClear) {
      profile.wins.push(stage.id);
      profile.unlockedStage = Math.min(STAGES.length, stage.id + 1);
      const storyHero = HEROES.find(hero => hero.storyStage === stage.id);
      if (storyHero) {
        this.recruitHero(storyHero);
        profile.recruitedStoryHeroes.push(storyHero.id);
        rewards.hero = storyHero.id;
      }
      if (profile.inventory.length < 5000) {
        const definition = EQUIPMENT_POOL.find(item => item.rarity === (stage.id >= 4 ? 'epic' : 'rare') && item.slot === (stage.id % 2 === 0 ? 'armor' : 'weapon'))!;
        const item = { ...definition, id: this.uid('reward') };
        profile.inventory.push(item);
        rewards.equipment.push(item);
      }
    }
    battle.rewards = rewards;
    // The reward and cleared-stage record are persisted together immediately.
    // The victory button acknowledges that transaction; it never awards twice.
    this.changed(rewards.hero ? `${HERO_BY_ID[rewards.hero].name} joins your journey!` : `${stage.name} cleared!`);
  }

  claimRewards(): BattleRewards | null {
    const battle = this.state.battle;
    if (!battle || battle.status !== 'won' || battle.rewardClaimed || !battle.rewards) return null;
    battle.rewardClaimed = true;
    this.state.revision += 1;
    return battle.rewards;
  }

  returnHome(): boolean {
    if (!this.state.battle) return false;
    this.state.battle = null;
    this.accumulator = 0;
    this.clearPendingActions();
    this.state.revision += 1;
    this.save();
    return true;
  }

  private clearPendingActions(): void {
    this.pendingHits=[];this.pendingSkills.clear();this.pendingImpacts=[];
    for (const actor of this.state.battle?.allies ?? []) delete actor.queuedSkill;
  }
}
