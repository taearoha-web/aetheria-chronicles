import {SKILLS,ELEMENTS} from './data.js';
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const seed=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const directional=new Set(['line','dash','cone','shot','fan','burst','chain','retreat']);
export function skillSprite(ctx,images,d,x,y,size,angle=0,alpha=1,phase=1){
 const im=images['skills_'+d.classId];if(!im)return;const cw=im.width/5,ch=im.height/4,sx=(d.index%5)*cw,sy=Math.floor(d.index/5)*ch;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(angle);ctx.globalAlpha*=alpha;ctx.imageSmoothingEnabled=false;
 // Reveal through a moving edge instead of flashing an entire static motif on screen.
 if(phase<1){ctx.beginPath();ctx.rect(-size/2,-size/2,size*clamp(phase),size);ctx.clip();}
 ctx.drawImage(im,Math.round(sx+2),Math.round(sy+2),Math.floor(cw-4),Math.floor(ch-4),-size/2,-size/2,size,size);ctx.restore();
}
const iconCache=new Map();
export function skillIcon(images,d){if(iconCache.has(d.id))return iconCache.get(d.id);const c=document.createElement('canvas');c.width=c.height=80;const g=c.getContext('2d');g.fillStyle='#111f32';g.fillRect(0,0,80,80);skillSprite(g,images,d,40,40,78);const url=c.toDataURL();iconCache.set(d.id,url);return url;}
function sparks(c,x,y,color,t,count,scale,id){for(let i=0;i<count;i++){const a=seed(i+id)*TAU,r=(8+seed(i+72)*scale)*t,life=1-t;c.globalAlpha=clamp(life)*(i%3===0?1:.65);c.fillStyle=i%4===0?'#fff4d0':color;const px=Math.round(x+Math.cos(a)*r),py=Math.round(y+Math.sin(a)*r*.6-t*14);c.fillRect(px,py,i%4===0?2:1,i%3===0?3:1);}}
function seal(c,x,y,r,color,t,alpha=.4){c.save();c.translate(x,y);c.scale(1,.5);c.strokeStyle=color;c.globalAlpha=alpha;c.lineWidth=1;for(let j=0;j<2;j++){c.beginPath();for(let i=0;i<=12;i++){const a=i/12*TAU+t*(j?-.15:.15),rr=r*(j?.77:1),xx=Math.cos(a)*rr,yy=Math.sin(a)*rr;i?c.lineTo(xx,yy):c.moveTo(xx,yy);}c.stroke();}for(let i=0;i<8;i++){const a=i/8*TAU+t*.2;c.fillStyle=color;c.fillRect(Math.cos(a)*r-1,Math.sin(a)*r-2,2,4);}c.restore();}
export function drawSkillGround(r,s){const c=r.ctx;
 for(const f of s.effects){if(f.kind!=='skill')continue;const d=SKILLS[f.skillId];if(!d)continue;const v=r.screen(f.aura?s.x:f.x,f.aura?s.y:f.y),t=f.age/(f.life||1),alpha=clamp(f.age*6)*clamp((1-t)*4);if(f.aura&&!(d.shape==='shield'&&s.hero.shield<=0)){c.save();c.globalAlpha=alpha*.65;skillSprite(c,r.images,d,v.x,v.y-(d.id==='warcry'?64:35),108*(.96+Math.sin(s.time*3)*.04));c.restore();}if(f.aura||f.ground||['area','leap','spin'].includes(d.shape)||d.ultimate){seal(c,v.x,v.y,(d.radius||2)*20*(.7+.3*clamp(f.age*4)),ELEMENTS[d.element],s.time,alpha*.36);}}
 if(s.hero.strike?.skill){const a=s.hero.strike,d=a.skill;if(a.time<a.release){const v=r.screen(s.x,s.y),u=a.time/a.release;seal(c,v.x,v.y,12+u*14,ELEMENTS[d.element],s.time,.5);c.save();sparks(c,v.x,v.y-25,ELEMENTS[d.element],1-u,12,32,d.index);c.restore();}}
 if(s.aim){const d=SKILLS[s.aim.id],v=r.screen(s.aim.x,s.aim.y),from=r.screen(s.x,s.y);c.save();c.setLineDash([3,3]);c.strokeStyle=ELEMENTS[d.element];c.globalAlpha=.9;c.beginPath();if(['line','cone','dash','fan'].includes(d.shape)){c.moveTo(from.x,from.y);c.lineTo(v.x,v.y);}else c.ellipse(v.x,v.y,(d.radius||1)*20,(d.radius||1)*10,0,0,TAU);c.stroke();c.setLineDash([]);r.label('ปล่อยเพื่อใช้ · ลากกลับเพื่อยกเลิก',v.x,v.y+20,'#fff0bf',true,7);c.restore();}
}
export function drawSkillEffect(r,s,f){const d=SKILLS[f.skillId];if(!d)return;const c=r.ctx,color=ELEMENTS[d.element]||'#fff0bc',life=f.life||1,t=clamp(f.age/life),fade=clamp(f.age*14)*clamp((1-t)*4),quality=s.p.options.quality||'full';
 if(f.aura&&d.shape==='shield'&&s.hero.shield<=0)return;
 const target=f.targetId?s.enemies.find(e=>e.id===f.targetId):null;if(f.targetId&&(!target||target.dead))return;
 const v=r.screen(f.aura?s.x:target?.x??f.x,f.aura?s.y:target?.y??f.y),from=r.screen(f.fromX??s.x,f.fromY??s.y),foe=f.projectileTarget?s.enemies.find(e=>e.id===f.projectileTarget):null,to=r.screen(foe?.x??f.toX??f.x,foe?.y??f.toY??f.y);
 c.save();
 if(f.kind==='skill-hit'){const u=clamp(f.age/.55);c.translate(v.x,v.y-22);c.globalAlpha=(1-u)*.85;c.strokeStyle=color;c.lineWidth=2;for(let i=0;i<6;i++){const a=i/6*TAU;c.beginPath();c.moveTo(Math.cos(a)*u*9,Math.sin(a)*u*9);c.lineTo(Math.cos(a)*(8+u*22),Math.sin(a)*(8+u*22));c.stroke();}sparks(c,0,0,color,u,quality==='lite'?5:16,f.ultimate?48:28,f.id);c.restore();return;}
 let x=v.x,y=v.y-32,size=d.ultimate?160:['area','leap','field','wall'].includes(d.shape)?140:['shield','buff','orbit','summon','counter'].includes(d.shape)?108:105,angle=0;
 size=Math.min(size,r.width*.8);let show=clamp(f.age*8);
 if(f.projectile){const u=clamp(f.age/.22);x=from.x+(to.x-from.x)*u;y=from.y+(to.y-from.y)*u-26;angle=Math.atan2(to.y-from.y,to.x-from.x);size=d.shape==='summon'?92:d.shape==='chain'?90:85;}
 else if(directional.has(d.shape)){angle=(f.dir||0)*Math.PI/4;if(d.shape==='line'){const u=clamp(f.age/.65),end=r.screen(f.fromX+Math.cos(0)*(f.toX-f.fromX),f.fromY+(f.toY-f.fromY));x=from.x+(end.x-from.x)*u;y=from.y+(end.y-from.y)*u-27;size=d.ultimate?155:110;}else {x+=Math.cos(angle)*27;y+=Math.sin(angle)*18;}}
 else if(['area','leap'].includes(d.shape)){y=v.y-size*.37;show=clamp(f.age*6);if(['judgment','dawnverdict','meteor','thunderpillar','astral'].includes(d.id))y-=Math.max(0,1-f.age*5)*60;}
 else if(f.ground)y=v.y-size*.24;
 if(f.aura){y=v.y-(d.id==='warcry'?64:35);size*=.96+Math.sin(s.time*3)*.04;}
 if(d.id==="dragonblade")angle=0;
 c.globalAlpha=fade*(f.aura?.65:.9);
 // Main colored silhouette + independently timed highlight / impact / debris layers.
 if(f.aura){c.save();c.beginPath();c.rect(x-size/2,y+size*.18,size,size*.32);c.clip();skillSprite(c,r.images,d,x,y,size,angle,.65,show);c.restore();}else skillSprite(c,r.images,d,x,y,size*(.78+.22*clamp(f.age*7)),angle,1,show);
 if(quality!=='lite'){
  const count=quality==='full'?d.ultimate?34:20:9;sparks(c,x,y,color,(f.age*.7)%1,count,size*.52,f.id);
  if(f.age<.18){c.globalAlpha=(1-f.age/.18)*.45;c.globalCompositeOperation='lighter';skillSprite(c,r.images,d,x,y,size,angle);}
 }
 if(['rain','phoenix','blizzard'].includes(d.id)){
  c.globalAlpha=fade*.85;const count=quality==='lite'?5:12;
  for(let i=0;i<count;i++){const u=(f.age*1.5+seed(i+31))%1,xx=v.x+(seed(i+7)-.5)*size,yy=v.y-size*.8+u*size*.8;c.strokeStyle=i%3?'#ffdc80':'#fff9d0';if(d.id==='blizzard')c.strokeStyle='#c7f5ff';c.lineWidth=1;c.beginPath();c.moveTo(xx-3,yy-9);c.lineTo(xx+2,yy+2);c.stroke();c.fillStyle=c.strokeStyle;c.fillRect(Math.round(xx),Math.round(yy),2,3);}
 }
 if(['shield','counter','buff','orbit'].includes(d.shape)&&quality!=='lite'){const v2=r.screen(s.x,s.y);seal(c,v2.x,v2.y,22,color,s.time*1.4,fade*.55);}
 if(d.ultimate){seal(c,v.x,v.y,size*.45*(.6+clamp(f.age)),color,-s.time,fade*.5);}
 c.restore();
}
export function poseFor(d){if(!d)return null;if(d.classId==='sword')return d.shape==='dash'?0:d.shape==='leap'||d.ultimate||d.id==='judgment'?1:['shield','counter','buff'].includes(d.shape)?2:3;if(d.classId==='archer')return d.shape==='retreat'?2:['summon','trap','mines','buff'].includes(d.shape)?3:d.shape==='fan'?1:0;return d.shape==='blink'?3:d.ultimate||d.id==='meteor'?1:['buff','shield','mana','summon'].includes(d.shape)?2:0;}
export function drawSkillActor(r,s,draw){const a=s.hero.strike;if(!a?.skill){draw({});return;}const d=a.skill,u=a.time/a.duration,release=a.release/a.duration,frame=u<release?Math.min(2,Math.floor(u/release*3)):Math.min(5,3+Math.floor((u-release)/(1-release)*3));let lift=0,rotation=0;
 if(['leap','retreat'].includes(d.shape))lift=Math.sin(Math.min(1,u/release)*Math.PI)*15;
 if(d.shape==='mana')lift=Math.sin(s.time*3)*1.5;
 if(d.shape==='dash')rotation=(s.dir>=3&&s.dir<=5?-.1:.1)*Math.sin(u*Math.PI);
 draw({frame,pose:poseFor(d),lift,rotation});
}
