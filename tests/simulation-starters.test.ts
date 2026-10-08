import { describe, expect, it } from 'vitest';
import { GameEngine, HERO_BY_ID, getActionTiming, parseSave } from '../src/simulation';

const STEP=1/30;
function setup() {
  const game=new GameEngine({storage:null,random:()=>0.9});
  game.startBattle(1);
  const battle=game.state.battle!;
  for(const actor of [...battle.allies,...battle.enemies]){actor.attackTimer=999;actor.moveSpeed=0;}
  battle.allies[0].x=-.4;battle.allies[0].z=0;
  battle.allies[1].x=-1.7;battle.allies[1].z=0;
  battle.enemies[0].x=.45;battle.enemies[0].z=0;
  battle.enemies[1].x=.7;battle.enemies[1].z=.6;
  return {game,battle};
}
function advance(game:GameEngine,seconds:number) { for(let i=0;i<Math.floor((seconds+1e-8)/STEP);i++)game.update(STEP); }

describe('authored starter skill timelines',()=>{
  it.each([
    ['kael',0,'damage'],['kael',1,'shield'],['kael',2,'damage'],
    ['lyra',0,'heal'],['lyra',1,'shield'],['lyra',2,'damage'],
  ] as const)('%s slot%i resolves %s once on its authored impact and retains recovery',(heroId,slot,effectType)=>{
    const {game,battle}=setup();
    for(const ally of battle.allies)ally.hp-=300;
    const caster=battle.allies.find(actor=>actor.heroId===heroId)!;
    const skill=HERO_BY_ID[heroId].skills[slot],timing=getActionTiming(heroId,'skill',slot);
    expect(game.castSkill(heroId,slot)).toBe(true);
    expect(caster.energy).toBe(100-skill.cost);
    expect(caster).toMatchObject({activeSkillSlot:slot,actionStartedAt:0,actionDuration:timing.duration,actionImpactAt:timing.impact});
    const cast=battle.effects.find(event=>event.type==='skill'&&event.sourceId===heroId)!;
    expect(cast).toMatchObject({phase:'cast',skillId:skill.id,skillSlot:slot,duration:timing.duration,impactAt:timing.impact});
    // An alternate button cannot replace a paid cast before its recovery ends.
    expect(game.castSkill(heroId,(slot+1)%3)).toBe(false);
    expect(caster.energy).toBe(100-skill.cost);
    advance(game,Math.floor((timing.impact-.001)/STEP)*STEP);
    expect(battle.effects.filter(event=>event.type===effectType&&event.sourceId===heroId)).toHaveLength(0);
    game.update(STEP);
    const impact=battle.effects.find(event=>event.type==='skillImpact'&&event.sourceId===heroId)!;
    expect(impact).toBeDefined();
    expect(impact.createdAt).toBeGreaterThanOrEqual(timing.impact-1e-8);
    expect(impact.createdAt).toBeLessThan(timing.impact+STEP+1e-8);
    expect(impact.actionSeq).toBe(cast.actionSeq);
    const affected=battle.effects.filter(event=>event.type===effectType&&event.sourceId===heroId);
    expect(affected.length).toBeGreaterThan(0);
    expect(new Set(affected.map(event=>event.targetId)).size).toBe(affected.length);
    expect(caster.action).toBe('skill');
    expect(caster.actionTimer).toBeGreaterThan(0);
    advance(game,Math.min(.2,caster.actionTimer/2));
    expect(battle.effects.filter(event=>event.type==='skillImpact'&&event.sourceId===heroId)).toHaveLength(1);
    expect(game.castSkill(heroId,slot)).toBe(false);
  });

  it('uses the same paused battle clock for anticipation, damage and double-speed recovery',()=>{
    const {game,battle}=setup();
    const health=battle.enemies.map(enemy=>enemy.hp);
    expect(game.castSkill('lyra',2)).toBe(true);
    game.setPaused(true);
    const frozen=JSON.stringify(battle);
    game.update(.5);
    expect(JSON.stringify(battle)).toBe(frozen);
    game.setPaused(false);game.setSpeed(2);
    game.update(.4);
    expect(battle.elapsed).toBeCloseTo(.8);
    expect(battle.enemies.map(enemy=>enemy.hp)).toEqual(health);
    game.update(.1);
    expect(battle.elapsed).toBeCloseTo(1);
    expect(battle.enemies.every((enemy,index)=>enemy.hp<health[index])).toBe(true);
    expect(battle.allies[1].actionTimer).toBeCloseTo(.8);
    expect(battle.effects.filter(event=>event.type==='skillImpact')).toHaveLength(1);
  });

  it('cancels an unreleased judgment when its caster dies without refunding the reservation',()=>{
    const {game,battle}=setup();
    const kael=battle.allies[0],enemy=battle.enemies[0];
    kael.hp=1;kael.defense=0;enemy.attack=9999;enemy.attackTimer=0;
    expect(game.castSkill('kael',2)).toBe(true);
    const spent=kael.energy;
    advance(game,1.2);
    expect(kael.alive).toBe(false);
    expect(kael.energy).toBeLessThan(spent+6);
    expect(battle.effects.some(event=>event.type==='skillImpact'&&event.sourceId==='kael')).toBe(false);
    expect(battle.effects.some(event=>event.type==='damage'&&event.sourceId==='kael')).toBe(false);
  });

  it('skips a dead judgment recipient and never retargets a new actor during wind-up',()=>{
    const {game,battle}=setup();
    const kael=battle.allies[0];kael.attack=9999;kael.attackTimer=0;
    battle.enemies[0].hp=100;
    expect(game.castSkill('lyra',2)).toBe(true);
    const late={...battle.enemies[1],id:'late-arrival',x:2,z:1.2};
    battle.enemies.push(late);
    advance(game,1);
    expect(battle.enemies[0].alive).toBe(false);
    const impact=battle.effects.find(event=>event.type==='skillImpact'&&event.sourceId==='lyra')!;
    expect(impact.targetIds).toEqual([battle.enemies[1].id]);
    expect(battle.effects.filter(event=>event.type==='damage'&&event.sourceId==='lyra')).toHaveLength(1);
    expect(late.hp).toBe(late.maxHp);
  });

  it('clears reserved casts at a wave boundary and when the player withdraws',()=>{
    const {game,battle}=setup();
    battle.enemies.splice(1);
    battle.enemies[0].hp=100;
    battle.allies[0].attack=9999;battle.allies[0].attackTimer=0;
    expect(game.castSkill('lyra',2)).toBe(true);
    advance(game,2);
    expect(battle.wave).toBe(2);
    expect(battle.effects.some(event=>event.type==='skillImpact'&&event.sourceId==='lyra')).toBe(false);
    game.returnHome();game.startBattle(1);advance(game,1.1);
    expect(game.state.battle!.effects.some(event=>event.type==='skillImpact')).toBe(false);
  });

  it('front cleave excludes enemies behind the knight and outside its reach',()=>{
    const {game,battle}=setup();
    const rear={...battle.enemies[1],id:'behind-knight',x:-1.5,z:0};
    const distant={...battle.enemies[1],id:'distant-enemy',x:5,z:0};
    battle.enemies.push(rear,distant);
    expect(game.castSkill('kael',0)).toBe(true);
    advance(game,.5);
    const targets=battle.effects.find(event=>event.type==='skillImpact')!.targetIds!;
    expect(targets).toContain(battle.enemies[0].id);
    expect(targets).not.toContain(rear.id);expect(targets).not.toContain(distant.id);
    expect(rear.hp).toBe(rear.maxHp);expect(distant.hp).toBe(distant.maxHp);
  });

  it('priestess basic staff impact triggers Gentle Light once, after the projectile wind-up',()=>{
    const {game,battle}=setup();
    const kael=battle.allies[0],lyra=battle.allies[1];
    kael.hp-=200;lyra.attackTimer=0;
    const before=kael.hp;
    game.update(STEP);
    expect(lyra.action).toBe('attack');
    advance(game,.5);expect(kael.hp).toBe(before);
    game.update(STEP);
    expect(kael.hp).toBe(before+Math.round(lyra.attack*.35));
    expect(battle.effects.filter(event=>event.type==='heal'&&event.sourceId==='lyra')).toHaveLength(1);
  });

  it('preserves old starter saves and lets the unequipped pair finish their first chapter',()=>{
    const game=new GameEngine({storage:null,random:()=>.7});
    const saved=game.exportSave();
    const restored=new GameEngine({storage:null,random:()=>.7});
    expect(restored.importSave(saved)).toBe(true);
    expect(restored.state.profile).toEqual(parseSave(saved));
    expect(restored.state.profile.party).toEqual(['kael','lyra']);
    for(const heroId of ['kael','lyra'])for(const slot of ['weapon','armor','accessory'] as const)restored.unequip(heroId,slot);
    restored.startBattle(1);restored.setAuto(true);
    for(let i=0;i<1200&&restored.state.battle!.status==='fighting';i++)restored.update(.25);
    expect(restored.state.battle!.status).toBe('won');
    expect(restored.state.profile.ownedHeroes).toContain('seraphina');
    expect(restored.state.profile.wins).toEqual([1]);
  });
});
