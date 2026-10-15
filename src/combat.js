// Simulation-owned skill timelines. Rendering never decides damage or resource use.
import {SKILLS,CLASS} from './data.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function facing(dir){const a=dir*Math.PI/4,x=(Math.cos(a)+2*Math.sin(a))/2,y=(2*Math.sin(a)-Math.cos(a))/2,n=Math.hypot(x,y);return{x:x/n,y:y/n};}
export function loadout(p){return p.loadout||CLASS[p.classId].skills.slice(0,6).map(d=>d.id);}
export function setLoadout(s,slot,id){const d=SKILLS[id];if(!Number.isInteger(slot)||slot<0||slot>5||!d||d.classId!==s.p.classId)return 'ช่องสกิลไม่ถูกต้อง';if(d.level>s.p.level)return 'ยังไม่ปลดล็อก';if(!s.map.isTown&&(s.hero.combat||0)>0)return 'เปลี่ยนชุดหลังออกจากการต่อสู้';if(d.ultimate&&slot!==5)return 'อัลติเมตใส่ช่อง 6';const list=[...loadout(s.p)],old=list.indexOf(id);if(old>=0){const swap=SKILLS[list[slot]];if(swap?.ultimate&&old!==5)return 'อัลติเมตใส่ช่อง 6';[list[slot],list[old]]=[list[old],list[slot]];}else list[slot]=id;s.p.loadout=list;return null;}
export function availableTargets(s){return s.enemies.filter(e=>!e.dead&&(!e.boss||s.p.fields[s.map.id]?.shrines.length===3));}
export function skillPoint(s,d,aim,t){const vec=facing(s.dir);let p=aim&&Number.isFinite(aim.x)&&Number.isFinite(aim.y)?{...aim}:t?{x:t.x,y:t.y}:{x:s.x+vec.x*(d.range||2),y:s.y+vec.y*(d.range||2)};const n=distance(s,p);if(n>d.range&&d.range>0){p.x=s.x+(p.x-s.x)/n*d.range;p.y=s.y+(p.y-s.y)/n*d.range;}return p;}
export function beginSkill(s,a,api){const d=a.skill,from={x:s.x,y:s.y},point=a.point||skillPoint(s,d,null,s.enemies.find(e=>e.id===a.target)),delta={x:point.x-s.x,y:point.y-s.y},n=Math.hypot(delta.x,delta.y)||1,vec=n>.01?{x:delta.x/n,y:delta.y/n}:facing(a.dir);
 const attack=api.limits(s.p).attack*(s.hero.buffs?.power?1.25:1)*(s.hero.buffs?.spirit?1.3:1)*(s.hero.buffs?.elements?1.3:1),job={skill:d,from,point,vec,dir:a.dir,target:a.target,age:0,next:0,done:0,damage:attack*d.power,hits:d.hits||1,life:0};
 if(d.shape==='line'){point.x=from.x+vec.x*d.range;point.y=from.y+vec.y*d.range;}
 s.hero.combat=6;s.hero.buffs??={};
 const emit=(x,y,opts={})=>api.effect(s,'skill',x,y,{skillId:d.id,dir:a.dir,fromX:from.x,fromY:from.y,toX:point.x,toY:point.y,life:d.ultimate?2.5:1.05,...opts});
 api.event(s,'release',{id:d.id,element:d.element,ultimate:!!d.ultimate});
 const walk=(v,len)=>{for(let t=0;t<len;t+=.12){const nx=s.x+v.x*.12,ny=s.y+v.y*.12;if(s.world.block(nx,ny))break;s.x=nx;s.y=ny;}};
 if(d.shape==='blink'||d.shape==='dash'||d.shape==='leap'||d.shape==='retreat'){
  const retreat=d.shape==='retreat',v=retreat?{x:-vec.x,y:-vec.y}:vec;
  walk(v,retreat?2.1:Math.min(d.range,n));s.hero.inv=Math.max(s.hero.inv,d.shape==='blink'?.4:.3);
  job.point=d.shape==='leap'?{x:s.x,y:s.y}:point;
  if(d.shape==='blink'){emit(from.x,from.y,{life:.65,variant:'blink-out'});emit(s.x,s.y,{life:.8});return;}
 }
 if(d.shape==='shield'){s.hero.shield=Math.round(api.limits(s.p).hp*.4);s.hero.shieldTime=d.duration;emit(s.x,s.y,{life:d.duration,aura:true});return;}
 if(d.shape==='buff'){s.hero.buffs[d.buff]=d.duration;emit(s.x,s.y,{life:d.duration,aura:true});return;}
 if(d.shape==='counter'){s.hero.buffs.counter=d.duration;s.hero.counterSkill=d.id;emit(s.x,s.y,{life:d.duration,aura:true});return;}
 if(d.shape==='mana'){s.hero.manaChannel={time:d.duration,left:d.duration,total:api.limits(s.p).mp*.35};emit(s.x,s.y,{life:d.duration,aura:true});return;}
 if(d.shape==='mark'){const t=availableTargets(s).find(t=>t.id===a.target);if(t){t.mark=d.duration;emit(t.x,t.y,{life:d.duration,targetId:t.id});}return;}
 if(d.shape==='mines'){
  const perpendicular={x:-vec.y,y:vec.x};for(let i=-1;i<=1;i++){const q={x:point.x+perpendicular.x*i*1.8,y:point.y+perpendicular.y*i*1.8};if(!s.world.block(q.x,q.y)){s.skillJobs.push({...job,point:q,hits:1,life:d.duration,mine:true,damage:job.damage/3});emit(q.x,q.y,{life:d.duration,ground:true,radius:d.radius,mine:true});}}return;
 }
 if(['field','wall','trap'].includes(d.shape)){job.hits=Math.max(1,Math.ceil(d.duration));job.life=d.duration;job.next=d.shape==='trap'?0:.2;emit(point.x,point.y,{life:d.duration,ground:true,radius:d.radius});}
 else if(['orbit','summon'].includes(d.shape)){job.life=d.duration;emit(s.x,s.y,{life:d.duration,aura:true});}
 else if(['shot','fan','burst','chain','retreat'].includes(d.shape)){
  job.next=.12;job.life=Math.max(1,job.hits*.16+.6);
 }else{job.life=d.ultimate?2.3:Math.max(.8,job.hits*.16);emit(['area','leap'].includes(d.shape)?job.point.x:from.x,['area','leap'].includes(d.shape)?job.point.y:from.y,{radius:d.radius});job.next=['area','leap'].includes(d.shape)?d.ultimate?.32:.18:.08;}
 s.skillJobs.push(job);
}
function lineDistance(t,a,b){const x=b.x-a.x,y=b.y-a.y,u=clamp(((t.x-a.x)*x+(t.y-a.y)*y)/(x*x+y*y||1),0,1);return Math.hypot(t.x-a.x-x*u,t.y-a.y-y*u);}
function applyHit(s,t,amount,d,api){
 if(!t||t.dead)return;const before=t.hp;api.damage(s,t,amount*(t.mark>0?1.25:1),d.element);const actual=Math.max(0,before-t.hp);
 if(d.lifesteal&&actual)s.p.hp=Math.min(api.limits(s.p).hp,s.p.hp+actual*d.lifesteal);
 if(d.dot)t.poison={time:d.dot,tick:1,damage:amount*.15};
 if(d.control==='time')t.timeSlow=t.boss?.6:2.5;
 if(d.control==='root')t.root=Math.max(t.root,t.boss?.45:2);
 if(['slow','time'].includes(d.control))t.slow=Math.max(t.slow,t.boss?1:2.5);
 if(d.control==='stun'&&!t.boss){t.phase='stagger';t.timer=.65;}
 api.effect(s,'skill-hit',t.x,t.y,{skillId:d.id,element:d.element,life:.55,ultimate:d.ultimate});
 api.event(s,'skillhit',{id:d.id,element:d.element,ultimate:!!d.ultimate});
}
export function updateSkills(s,dt,api){
 s.skillImpacts??=[];
 for(const hit of s.skillImpacts){hit.delay-=dt;if(hit.delay<=0){const target=s.enemies.find(e=>e.id===hit.target&&!e.dead);if(target){const group=hit.skill.shape==='shot'&&hit.skill.radius>0?availableTargets(s).filter(e=>distance(e,target)<hit.skill.radius):[target];for(const e of group)applyHit(s,e,hit.amount,hit.skill,api);}}}
 s.skillImpacts=s.skillImpacts.filter(h=>h.delay>0);
 const h=s.hero;h.combat=Math.max(0,(h.combat||0)-dt);h.buffs??={};for(const k of Object.keys(h.buffs)){h.buffs[k]-=dt;if(h.buffs[k]<=0)delete h.buffs[k];}
 if(h.manaChannel){if(!h.strike||h.strike.id!=='manastream'){h.manaChannel=null;}else{const m=h.manaChannel;m.left-=dt;s.p.mp=Math.min(api.limits(s.p).mp,s.p.mp+m.total/m.time*dt);if(m.left<=0)h.manaChannel=null;}}
 for(const e of s.enemies){e.mark=Math.max(0,(e.mark||0)-dt);if(e.poison&&!e.dead){e.poison.time-=dt;e.poison.tick-=dt;if(e.poison.tick<=0){api.damage(s,e,e.poison.damage,'nature');e.poison.tick=1;}if(e.poison.time<=0)e.poison=null;}}
 for(const job of s.skillJobs){const d=job.skill;job.age+=dt;if(d.id==="rapid"&&s.hero.strike?.id!=="rapid"){job.finished=true;continue;}const candidates=availableTargets(s);if(job.mine){const t=candidates.find(e=>distance(e,job.point)<=d.radius);if(!t){if(job.age>d.duration)job.finished=true;continue;}api.effect(s,'skill',job.point.x,job.point.y,{skillId:d.id,life:1.3});job.mine=false;}
 if(job.done>=job.hits){job.finished=true;continue;}
 if(job.age<job.next)continue;
 const vec=job.vec,origin=['orbit','spin'].includes(d.shape)?s:job.from;
 let targets=[];const aimed=candidates.find(t=>t.id===job.target),near=candidates.filter(t=>distance(t,origin)<=d.range).sort((a,b)=>distance(a,job.point)-distance(b,job.point));
 if(['shot','retreat','burst','fan','summon'].includes(d.shape)){const t=d.shape==='fan'?near[job.done%Math.max(1,near.length)]:aimed&&distance(aimed,s)<d.range+2?aimed:near[0];if(t)targets=[t];}
 else if(d.shape==='chain'){job.visited??=[];const t=near.find(t=>!job.visited.includes(t.id));if(t){targets=[t];job.visited.push(t.id);}}
 else if(['line','dash','wall'].includes(d.shape))targets=candidates.filter(t=>lineDistance(t,job.from,{x:job.from.x+vec.x*d.range,y:job.from.y+vec.y*d.range})<(d.width||.8));
 else if(d.shape==='cone')targets=candidates.filter(t=>distance(t,origin)<d.range&&((t.x-origin.x)*vec.x+(t.y-origin.y)*vec.y)/(distance(t,origin)||1)>.15);
 else if(['spin','orbit'].includes(d.shape))targets=candidates.filter(t=>distance(t,s)<d.range);
 else targets=candidates.filter(t=>distance(t,job.point)<d.radius);
 const perHit=job.damage/job.hits;
 for(const t of targets){
  const projectile=['shot','fan','burst','retreat','summon'].includes(d.shape);
  if(projectile||d.shape==='line'){s.skillImpacts.push({target:t.id,skill:d,amount:perHit,delay:projectile?.22:distance(t,job.from)/d.range*.65});}else applyHit(s,t,perHit,d,api);
  if(d.control==='pull'&&!t.boss){const n=distance(t,job.point)||1;api.move(s,t,(job.point.x-t.x)/n*.5,(job.point.y-t.y)/n*.5);}
  if(projectile||d.shape==='chain'){
   const from=d.shape==='chain'&&job.lastTarget?job.lastTarget:{x:s.x,y:s.y};api.effect(s,'skill',t.x,t.y,{skillId:d.id,life:.65,fromX:from.x,fromY:from.y,toX:t.x,toY:t.y,projectile:true,projectileTarget:t.id,dir:job.dir});job.lastTarget={x:t.x,y:t.y};
  }
 }

 job.done++;job.next+=['field','wall','trap','orbit','summon'].includes(d.shape)?Math.max(.3,d.duration/job.hits):d.ultimate?.28:.17;
 }
 s.skillJobs=s.skillJobs.filter(j=>!j.finished&&j.age<Math.max(j.life+1,3));
}
