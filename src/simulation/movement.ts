import type { Combatant } from './types';

// Convert the existing formation coordinates into the same metres used by the 3D view.
export const FIELD_X = 1.55;
export const FIELD_Z = 1.25;
export function combatDistance(a: Combatant, b: Combatant): number { return Math.hypot((a.x-b.x)*FIELD_X,(a.z-b.z)*FIELD_Z); }
export function contactRange(a: Combatant, b: Combatant): number { return a.radius+b.radius+a.attackRange; }
export function inAttackRange(a: Combatant, b: Combatant): boolean { return combatDistance(a,b)<=contactRange(a,b)+.04; }
export function nearest(actor: Combatant, candidates: Combatant[]): Combatant | undefined {
  return candidates.filter(other=>other.alive).sort((a,b)=>combatDistance(actor,a)-combatDistance(actor,b))[0];
}

/** Steer toward a contact slot. Body spacing is a 2D battle rule, not mesh physics. */
export function approach(actor: Combatant, target: Combatant, formation: Combatant[], dt: number, dash=false): boolean {
  const distance=combatDistance(actor,target), stop=contactRange(actor,target);
  if(distance<=stop+.025)return false;
  let goalX=target.x*FIELD_X,goalZ=target.z*FIELD_Z;
  if(actor.attackMode==='melee'){
    // Keep opposing bodies on opposite sides; several attackers fan along a contact arc.
    const attackers=formation.filter(other=>other.alive&&other.side===actor.side&&other.attackMode==='melee'&&other.targetId===target.id).sort((a,b)=>a.id.localeCompare(b.id));
    const index=Math.max(0,attackers.findIndex(other=>other.id===actor.id));
    const angle=attackers.length>1?(index/(attackers.length-1)-.5)*1.25:0;
    goalX+=(actor.side==='ally'?-1:1)*Math.cos(angle)*stop*.99;goalZ+=Math.sin(angle)*stop*.99;
  }
  const goalDistance=Math.hypot(goalX-actor.x*FIELD_X,goalZ-actor.z*FIELD_Z);
  if(goalDistance<.001)return false;
  const directionX=(goalX-actor.x*FIELD_X)/goalDistance,directionZ=(goalZ-actor.z*FIELD_Z)/goalDistance;
  const step=Math.min(actor.moveSpeed*(dash?1.7:1)*dt,actor.attackMode==='melee'?goalDistance:distance-stop);
  let nextX=actor.x*FIELD_X+directionX*step,nextZ=actor.z*FIELD_Z+directionZ*step;
  // Gently spread nearby bodies instead of letting several actors occupy the target's centre.
  for(const other of formation){
    if(other.id===actor.id||!other.alive)continue;
    const dx=nextX-other.x*FIELD_X,dz=nextZ-other.z*FIELD_Z,separation=Math.hypot(dx,dz),minimum=actor.radius+other.radius+.035;
    if(separation>=minimum)continue;
    const push=Math.min(minimum-separation,actor.moveSpeed*dt*.9);
    const fallback=actor.z<=other.z?-1:1;
    if(other.id===target.id){nextX+=dx/Math.max(separation,.001)*push;nextZ+=dz/Math.max(separation,.001)*push;}
    else{nextX+=separation>.001?dx/separation*push:0;nextZ+=separation>.001?dz/separation*push:fallback*push;}
  }
  actor.x=nextX/FIELD_X;actor.z=nextZ/FIELD_Z;return true;
}
