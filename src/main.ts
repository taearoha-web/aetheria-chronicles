import './style.css';
import './skill-vfx.css';
import { GameEngine, HEROES, STAGES, SUMMON_COST, SUMMON_TEN_COST, LEGENDARY_PITY } from './simulation';
import type { HeroDefinition, EquipmentInstance } from './simulation/types';
import { WorldView } from './render/WorldView';
import { SkillAudio } from './render/SkillAudio';

type Page = 'home' | 'story' | 'heroes' | 'forge' | 'settings' | 'battle';
const engine = new GameEngine();
let page: Page = 'home';
let selectedHero = 'kael';
let selectedStage = 1;
let selectedSkill = 0;
let results: EquipmentInstance[] = [];
let noticeTimer = 0;
let lastNotice = '';
let lastRevision = -1;
let uiElapsed = 0;
let muted = true;
let battleSignature = '';
let modalSignature = '';
const spellAudio = new SkillAudio();
let reducedEffects = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let skillCueTimer = 0;
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const fmt = (n: number) => new Intl.NumberFormat('en-US').format(Math.round(n));
const icons: Record<string,string> = {
  sword: '<path d="m14 3 7 0 0 7-12 12-7-7L14 3Z"/><path d="m3 21 5-5m-5-3 8 8m2-10 5-5"/>',
  home: '<path d="m3 10 9-7 9 7v11H3Z"/><path d="M9 21v-8h6v8"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16m6-14v16"/>',
  heroes: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-3a7 7 0 0 1 14 0v3m1-17a4 4 0 0 1 0 8m2 4a6 6 0 0 1 3 5"/>',
  crystal: '<path d="m3 8 5-5h8l5 5-9 13Z"/><path d="M3 8h18M8 3l4 18 4-18"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 3-1 3 3 2 3-1 3 2 3-2 3-1 1-4-2-2V6l-4-1-2-3Z"/><circle cx="12" cy="12" r="3"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  star: '<path d="m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/>',
  heart: '<path d="M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13Z"/>',
  spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Zm7 0v4m-2-2h4"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8H9v4h6v4H9m3-10v12"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  check: '<path d="m4 12 5 5L20 6"/>',
  pause: '<path d="M8 4v16m8-16v16"/>',
  play: '<path d="m7 3 14 9-14 9Z"/>',
  sound: '<path d="m3 9 5 0 5-5v16l-5-5H3Zm14-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
};
const icon = (name: string, cls='') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
const roleIcon = (h: HeroDefinition) => ['knight','guardian','paladin'].includes(h.role)?'shield':h.role==='healer'?'heart':h.role==='mage'?'spark':'sword';
const roleName: Record<string,string> = { knight:'อัศวิน', healer:'ผู้เยียวยา', mage:'จอมเวท', rogue:'นักฆ่า', guardian:'ผู้พิทักษ์', ranger:'นักรบกระบอง', paladin:'พาลาดิน' };
const slotName: Record<string,string> = { weapon:'อาวุธ', armor:'ชุดเกราะ', accessory:'เครื่องประดับ' };
const rarityName: Record<string,string> = { common:'ทั่วไป', rare:'หายาก', epic:'มหากาพย์', legendary:'ตำนาน' };

$('#app').innerHTML = `<div id="world" aria-label="ฉากเกมสามมิติ"></div>
  <div class="vignette"></div><div class="grain"></div>
  <header id="topbar"><button class="brand" data-action="nav" data-page="home" aria-label="กลับหน้าหลัก"><span class="brand-mark">A</span><span>AETHERIA<small>CHRONICLES</small></span></button><div class="top-right"><span class="chapter-label">THE AGE OF A NEW DAWN</span><div class="wallet gold">${icon('coin')}<b id="gold"></b></div><div class="wallet gems">${icon('crystal')}<b id="gems"></b></div><button class="round" data-action="nav" data-page="settings" aria-label="ตั้งค่า">${icon('settings')}</button></div></header>
  <main id="content"></main><nav id="nav" aria-label="เมนูหลัก"></nav>
  <div id="battle-ui" hidden></div><div id="skill-cue" hidden aria-hidden="true"></div><div id="modal" hidden></div><div id="toast" role="status"></div>
  <div id="loading"><div class="loading-emblem">A</div><span class="eyebrow">AETHERIA CHRONICLES</span><h1>โลกใบใหม่กำลังตื่นขึ้น</h1><p id="load-message">กำลังเตรียมฉากสามมิติ...</p><div class="load-track"><span></span></div></div>
  <div id="character-loading" hidden role="status">กำลังเรียกสหาย…</div><div id="asset-warning" hidden role="alert"></div><input id="import-file" type="file" accept="application/json,.json" hidden/>`;

let world: WorldView;
try { world = new WorldView($('#world')); }
catch (error) {
  $('#loading').innerHTML = '<div class="loading-emblem">A</div><h1>เปิดฉาก 3D ไม่สำเร็จ</h1><p>เบราว์เซอร์นี้ยังเริ่ม WebGL ไม่ได้<br>ลองเปิดใหม่ใน Safari รุ่นล่าสุด หรือปิดแท็บอื่นแล้วลองอีกครั้ง</p>';
  throw error;
}
const hero = () => HEROES.find(h=>h.id===selectedHero)!;
const toast = (message: string) => { $('#toast').textContent=message; $('#toast').classList.add('show'); noticeTimer=4; };
world.setReducedEffects(reducedEffects);
world.onSkill = cue => {
  if(page!=='battle')return;
  const hero=HEROES.find(hero=>hero.id===cue.heroId), node=$('#skill-cue');
  node.style.setProperty('--spell',cue.color);node.className=cue.slot===2?'ultimate':'';node.hidden=false;
  node.innerHTML=`${hero?`<img src="${import.meta.env.BASE_URL}assets/${hero.modelKey}-portrait.png" alt=""/>`:''}<span><small>${cue.slot===2?'ULTIMATE · ':''}${hero?.name??'BOSS'}</small><b>${escape(cue.name)}</b></span>`;
  skillCueTimer=cue.slot===2?1.25:.85;
  spellAudio.playSkill(cue.heroId,cue.slot,engine.state.battle?.speed??1);
};
function sound(kind='click') {
  if(!muted)spellAudio.playUi(kind==='win');
}
function changePage(next: Page) {
  if(engine.state.battle?.status==='fighting' && next!=='battle') { engine.setPaused(true); toast('การต่อสู้ถูกพักไว้ กลับไปที่การต่อสู้เพื่อเล่นต่อ'); }
  page=next; results=[];
  $('#skill-cue').hidden=true;skillCueTimer=0;spellAudio.stop();
  world.setMode(next==='battle'?'battle':next==='heroes'?'heroes':'home');
  if(next==='heroes')world.preview(selectedHero);
  render();
}
function button(label:string,action:string,cls='primary',extra='') { return `<button class="${cls}" data-action="${action}" ${extra}>${label}</button>`; }
function render() {
  $('#gold').textContent=fmt(engine.state.profile.gold); $('#gems').textContent=fmt(engine.state.profile.gems);
  $('#app').dataset.page=page;
  $('#nav').hidden=page==='battle'; $('#battle-ui').hidden=page!=='battle';
  $('#nav').innerHTML=[['home','home','หน้าหลัก','SANCTUARY'],['story','map','ผจญภัย','ADVENTURE'],['heroes','heroes','ฮีโร่','HEROES'],['forge','spark','อุปกรณ์','STAR FORGE']].map(([id,ic,th,en])=>`<button class="nav-item ${page===id?'active':''}" data-action="nav" data-page="${id}">${icon(ic)}<span>${th}<small>${en}</small></span></button>`).join('');
  $('#content').innerHTML=page==='home'?home():page==='story'?story():page==='heroes'?heroes():page==='forge'?forge():page==='settings'?settings():'';
  if(page==='battle')renderBattle();
  renderModal();
  lastRevision=engine.state.revision;
}
function home() {
  const p=engine.state.profile; const s=STAGES[Math.min(p.unlockedStage-1,STAGES.length-1)];
  return `<section class="home-copy"><div class="eyebrow"><span class="line"></span> YOUR STORY BEGINS</div><h1>Every legend<br>starts with<br><em>a promise.</em></h1><p>รวบรวมสหาย ค้นหาแสงที่สูญหาย<br>แล้วเขียนตำนานบทใหม่ของคุณ</p><div class="home-actions">${button(`ออกเดินทาง ${icon('arrow')}`,'nav','primary large','data-page="story"')}${button('พบเหล่าฮีโร่','nav','text-button','data-page="heroes"')}</div><div class="chapter-preview"><span>CHAPTER ${String(s.id).padStart(2,'0')}</span><b>${s.name}</b><small>${s.subtitle}</small></div></section>
    <div class="location-pill"><span class="live-dot"></span> SANCTUARY OF DAWN <small>ดินแดนแห่งแสงแรก</small></div>
    <aside class="party-mini"><span class="eyebrow">YOUR COMPANIONS</span><div>${p.party.map(id=>{const h=HEROES.find(x=>x.id===id)!;return `<button class="companion" data-action="selectHero" data-id="${id}" style="--hero:${h.color}">${icon(roleIcon(h))}<span>${h.name}<small>Lv. ${p.heroLevels[id]||1}</small></span></button>`}).join('')}<span class="party-count">${p.party.length}<small>/ 4</small></span></div></aside>${engine.state.battle?.status==='fighting'?button('กลับสู่การต่อสู้ที่พักไว้','nav','resume-battle','data-page="battle"'):''}`;
}
function story() {
  const s=STAGES.find(x=>x.id===selectedStage)!; const p=engine.state.profile;
  return `<section class="panel story-panel"><div class="panel-heading"><span class="eyebrow">THE FIRST CHRONICLE</span><h1>เส้นทางแห่งรุ่งอรุณ</h1><p>ห้าบทแห่งการเดินทาง สหายที่รอพบ และคำสัญญาที่ต้องรักษา</p></div><div class="stage-layout"><div class="stage-list">${STAGES.map(x=>`<button class="stage ${x.id===s.id?'selected':''} ${x.id>p.unlockedStage?'locked':''}" data-action="stage" data-id="${x.id}"><span class="stage-number">${x.id>p.unlockedStage?icon('lock'):String(x.id).padStart(2,'0')}</span><span><small>${x.location}</small><b>${x.name}</b></span>${p.wins.includes(x.id)?icon('check'):icon('arrow')}</button>`).join('')}</div><div class="stage-detail" style="--stage:${s.color}"><div class="sigil">${icon('map')}</div><span class="eyebrow">CHAPTER ${String(s.id).padStart(2,'0')}</span><h2>${s.name}</h2><p>${s.description}</p><div class="stage-tags"><span>3 WAVES</span><span>Lv. ${s.recommendedLevel} แนะนำ</span><span>${p.wins.includes(s.id)?'ผ่านแล้ว':'ยังไม่ผ่าน'}</span></div><div class="boss-line">${icon('sword')}<div><small>FINAL ENCOUNTER</small><strong>${s.boss}</strong></div></div><div class="rewards-line"><span>รางวัลผ่านครั้งแรก</span><b>${icon('crystal')}${s.rewardGems}</b><b>${icon('coin')}${s.rewardGold}</b></div>${s.id<=2?`<p class="recruit-note">${icon('heroes')} ${s.id===1?'Seraphina':'Riven'} จะร่วมทีมเมื่อผ่านบทนี้</p>`:''}${button(`เริ่มการต่อสู้ ${icon('arrow')}`,'startBattle','primary wide',s.id>p.unlockedStage?'disabled':'')}<small class="team-note">ทีมปัจจุบัน: ${p.party.map(id=>HEROES.find(h=>h.id===id)!.name).join(' · ')}</small></div></div></section>`;
}
function heroes() {
  const h=hero(); const p=engine.state.profile; const owned=p.ownedHeroes.includes(h.id); const stats=owned?engine.getHeroStats(h.id):{hp:h.baseHp,attack:h.baseAttack,defense:h.baseDefense};
  const inv=p.inventory.filter(i=>!Object.values(p.equipped[h.id]||{}).includes(i.id));
  return `<section class="hero-page"><div class="hero-selector"><span class="eyebrow">COMPANIONS · ${p.ownedHeroes.length}/${HEROES.length}</span>${HEROES.map(x=>`<button class="hero-tab ${h.id===x.id?'selected':''}" data-action="selectHero" data-id="${x.id}" style="--hero:${x.color}"><span class="hero-badge"><img src="${import.meta.env.BASE_URL}assets/${x.modelKey}-portrait.png" alt="" loading="lazy"/></span><span><strong>${x.name}</strong><small>${roleName[x.role]}</small></span>${p.ownedHeroes.includes(x.id)?`<span class="level">${p.party.includes(x.id)?'TEAM':`Lv.${p.heroLevels[x.id]||1}`}</span>`:icon('lock')}</button>`).join('')}</div><div class="hero-nameplate" style="--hero:${h.color}"><span class="eyebrow">${h.title.toUpperCase()}</span><h1>${h.name}</h1><span>${roleName[h.role]} ${owned?`· LEVEL ${p.heroLevels[h.id]||1}`:''}</span></div><aside class="hero-details" style="--hero:${h.color}"><span class="eyebrow">HERO OVERVIEW</span><h2>${h.title}</h2><p>${h.description}</p><div class="stat-row"><div>${icon('heart')}<b>${fmt(stats.hp)}</b><small>HP</small></div><div>${icon('sword')}<b>${fmt(stats.attack)}</b><small>ATK</small></div><div>${icon('shield')}<b>${fmt(stats.defense)}</b><small>DEF</small></div></div><div class="skill-tabs">${h.skills.map((s,i)=>`<button class="skill-tab ${i===selectedSkill?'selected':''}" data-action="skillInfo" data-index="${i}" aria-label="${s.name}">${s.icon}<small>${i+1}</small></button>`).join('')}</div><div class="skill-description"><b>${h.skills[selectedSkill].name}</b><p>${h.skills[selectedSkill].description}</p><small>${h.skills[selectedSkill].cost} MP · ${h.skills[selectedSkill].cooldown}s COOLDOWN</small></div><div class="passive">${icon('spark')}<div><b>${h.passive.name}</b><small>${h.passive.description}</small></div></div>${owned?`<div class="hero-buttons">${button(p.party.includes(h.id)?'นำออกจากทีม':'เพิ่มเข้าทีม','party','secondary wide')}${button(`เพิ่มเลเวล ${icon('coin')} ${engine.getUpgradeCost(h.id)}`,'upgrade','primary wide',(p.heroLevels[h.id]||1)>=20?'disabled':'')}</div><details class="equipment-section"><summary>อุปกรณ์สวมใส่ <span>จัดการ ${icon('arrow')}</span></summary>${(['weapon','armor','accessory'] as const).map(slot=>{const item=p.inventory.find(i=>i.id===p.equipped[h.id]?.[slot]);return `<div class="equipped-item"><span>${slotName[slot]}</span><b class="rarity-${item?.rarity||'common'}">${item?escape(item.name):'ยังไม่ได้สวมใส่'}</b></div>`}).join('')}<div class="inventory-list">${inv.length?inv.map(i=>`<button class="inventory-item rarity-${i.rarity}" data-action="equip" data-id="${i.id}"><span>${icon(i.slot==='weapon'?'sword':i.slot==='armor'?'shield':'crystal')}</span><span><b>${escape(i.name)}</b><small>ATK +${i.attack} · HP +${i.hp} · DEF +${i.defense}</small></span><span>สวมใส่</span></button>`).join(''):'<p class="muted">หาอุปกรณ์จากด่านหรือ Star Forge</p>'}</div></details>`:h.price>0?button(`รับฮีโร่ ${icon('crystal')} ${fmt(h.price)}`,'buyHero','primary wide'):`<div class="unlock-note">${icon('lock')} ปลดล็อกหลังผ่านบทที่ ${h.storyStage||0}</div>`}</aside></section>`;
}
function equipmentCard(i: EquipmentInstance) { return `<div class="equipment-card rarity-${i.rarity}"><span class="item-rarity">${rarityName[i.rarity]}</span><div class="item-art">${icon(i.slot==='weapon'?'sword':i.slot==='armor'?'shield':'crystal')}</div><b>${escape(i.name)}</b><small>${slotName[i.slot]}</small><div class="item-stats">${i.attack?`ATK +${i.attack} `:''}${i.hp?`HP +${i.hp} `:''}${i.defense?`DEF +${i.defense}`:''}</div></div>`; }
function forge() { return `<section class="panel forge-panel"><span class="eyebrow">THE CELESTIAL ARMORY</span><h1>Star Forge</h1><p>ปลุกพลังแห่งดวงดาว แล้วค้นพบอุปกรณ์สำหรับตำนานของคุณ</p><div class="forge-emblem">${icon('crystal')}<span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><i></i></div><span class="forge-label">อาวุธ · ชุดเกราะ · เครื่องประดับ</span><div class="forge-actions">${button(`สุ่ม 1 ครั้ง ${icon('crystal')} ${SUMMON_COST}`,'summon','secondary','data-count="1"')}${button(`สุ่ม 10 ครั้ง ${icon('crystal')} ${fmt(SUMMON_TEN_COST)}`,'summon','primary','data-count="10"')}</div><p class="pity-note">รับอุปกรณ์ระดับตำนานภายในอีก <b>${LEGENDARY_PITY-engine.state.profile.legendaryPity}</b> ครั้ง</p><div class="rate-strip"><span>ทั่วไป <b>50%</b></span><span class="rarity-rare">หายาก <b>35%</b></span><span class="rarity-epic">มหากาพย์ <b>12%</b></span><span class="rarity-legendary">ตำนาน <b>3%</b></span></div><small class="forge-footnote">เพชรหาได้จากการเล่น · สุ่มเฉพาะอุปกรณ์ · ฮีโร่เลือกซื้อได้โดยตรง</small></section>`; }
function settings() { return `<section class="panel settings-panel"><span class="eyebrow">YOUR ADVENTURE, YOUR WAY</span><h1>ตั้งค่า</h1><div class="setting-row"><div><b>เสียงเอฟเฟกต์</b><small>เสียงสกิล การกระแทก และการรับรางวัล</small></div>${button(muted?'ปิด':'เปิด','sound','secondary')}</div><div class="setting-row"><div><b>เอฟเฟกต์สกิล</b><small>โหมดเบาลดอนุภาคและหยุดการสั่นกล้อง</small></div>${button(reducedEffects?'เบา':'เต็ม','effects','secondary')}</div><div class="setting-row"><div><b>สำรองเซฟ</b><small>ดาวน์โหลดความคืบหน้าเก็บไว้ในเครื่อง</small></div>${button(`${icon('download')} ส่งออก`,'export','secondary')}</div><div class="setting-row"><div><b>นำเข้าเซฟ</b><small>นำไฟล์สำรองมาเล่นต่อบนเครื่องนี้</small></div>${button(`${icon('upload')} นำเข้า`,'import','secondary')}</div><div class="save-explanation">ความคืบหน้าบันทึกอัตโนมัติในเบราว์เซอร์นี้ การล้างข้อมูลเว็บไซต์จะลบเซฟด้วย โปรดสำรองก่อนเปลี่ยนเครื่อง</div><div class="about-game"><span>AETHERIA CHRONICLES</span><small>Contact combat · v0.4.0<br>Original world & characters · Inspired by classic party RPGs</small></div></section>`; }
function renderBattle() {
 const b=engine.state.battle;
 if(!b){changePage('story');return;}
 const signature=[b.id,b.wave,b.status,b.paused,b.auto,b.speed,b.allies.map(a=>a.id).join(','),b.enemies.map(a=>a.id).join(',')].join('|');
 if(signature===battleSignature){updateBattleNumbers();renderModal();return;}
 battleSignature=signature;
 const s=STAGES.find(x=>x.id===b.stageId)!;
 const enemy=b.enemies.find(e=>e.role==='boss')||b.enemies.find(e=>e.alive)||b.enemies[0];
 $('#battle-ui').innerHTML=`<div class="battle-top"><div class="battle-title"><small>CHAPTER ${String(b.stageId).padStart(2,'0')} · WAVE ${b.wave}/3</small><strong>${s.name}</strong></div><div class="battle-controls">${button(b.auto?'AUTO ON':'AUTO OFF','auto',`control ${b.auto?'on':''}`)}${button(`${b.speed}×`,'speed','control')}${button(icon(b.paused?'play':'pause'),'pause','control','aria-label="พักหรือเล่นต่อ"')}</div></div>${enemy?`<div class="enemy-hud"><span>${enemy.role==='boss'?'BOSS · ':''}${enemy.name}</span><div class="enemy-hp"><i style="width:${enemy.hp/enemy.maxHp*100}%"></i></div><small>${fmt(enemy.hp)} / ${fmt(enemy.maxHp)}</small></div>`:''}<div class="party-hud">${b.allies.map(a=>{const h=HEROES.find(x=>x.id===a.heroId)!;return `<div class="hero-combat ${!a.alive?'defeated':''}" style="--hero:${h.color}"><div class="combat-name"><b>${h.name}</b><span>${fmt(a.hp)} HP</span></div><div class="hp-track"><i style="width:${a.hp/a.maxHp*100}%"></i></div><div class="mp-track"><i style="width:${a.energy}%"></i></div><div class="combat-skills">${h.skills.map((s,i)=>`<button class="combat-skill ${a.cooldowns[i]>0?'cooling':''}" data-action="cast" data-hero="${h.id}" data-slot="${i}" ${(!a.alive||a.queuedSkill!==undefined||a.energy<s.cost||a.cooldowns[i]>0||b.paused||b.status!=='fighting')?'disabled':''} aria-label="${h.name}: ${s.name}" title="${s.name} · ${s.cost} MP"><span>${s.icon}</span>${a.cooldowns[i]>0?`<b>${Math.ceil(a.cooldowns[i])}</b>`:''}<small>${s.cost}</small></button>`).join('')}</div></div>`}).join('')}</div>${b.paused?`<div class="pause-layer"><span class="eyebrow">TAKE A BREATH</span><h2>พักการต่อสู้</h2>${button('เล่นต่อ','pause','primary')}${button('กลับเขตพักพิง','nav','text-button','data-page="home"')}</div>`:''}`;
 if(b.paused){const pause=$('.pause-layer');const leave=document.createElement('button');leave.className='text-button';leave.dataset.action='abandonBattle';leave.textContent='ถอนตัวจากการต่อสู้';pause.appendChild(leave);}
 updateBattleNumbers();
 renderModal();
}
function updateBattleNumbers() {
 const b=engine.state.battle;if(!b)return;
 const enemy=b.enemies.find(e=>e.role==='boss')||b.enemies.find(e=>e.alive)||b.enemies[0];
 if(enemy&&document.querySelector('.enemy-hud')){ $('.enemy-hud>span').textContent=`${enemy.role==='boss'?'BOSS · ':''}${enemy.name}`;$('.enemy-hp i').style.width=`${enemy.hp/enemy.maxHp*100}%`;$('.enemy-hud small').textContent=`${fmt(enemy.hp)} / ${fmt(enemy.maxHp)}`; }
 document.querySelectorAll<HTMLElement>('.hero-combat').forEach((node,index)=>{const a=b.allies[index];if(!a)return;const h=HEROES.find(x=>x.id===a.heroId)!;node.classList.toggle('defeated',!a.alive);node.querySelector('.combat-name span')!.textContent=`${fmt(a.hp)} HP`;node.querySelector<HTMLElement>('.hp-track i')!.style.width=`${a.hp/a.maxHp*100}%`;node.querySelector<HTMLElement>('.mp-track i')!.style.width=`${a.energy}%`;
  node.querySelectorAll<HTMLButtonElement>('.combat-skill').forEach((btn,i)=>{const remaining=Math.ceil(a.cooldowns[i]);btn.disabled=!a.alive||a.queuedSkill!==undefined||a.energy<h.skills[i].cost||remaining>0||b.paused||b.status!=='fighting';btn.classList.toggle('cooling',remaining>0);let count=btn.querySelector('b');if(remaining>0){if(!count){count=document.createElement('b');btn.appendChild(count);}count.textContent=String(remaining);}else count?.remove();});
 });
}
function renderModal() {
 const b=engine.state.battle; const m=$('#modal');
 const signature=results.length?'items:'+results.map(i=>i.id).join(','):page==='battle'&&b&&b.status!=='fighting'?`battle:${b.id}:${b.status}`:'none';
 if(signature===modalSignature)return;modalSignature=signature;
 if(results.length){m.hidden=false;m.innerHTML=`<div class="modal-backdrop"><section class="result-panel"><span class="eyebrow">A GIFT FROM THE STARS</span><h1>ค้นพบอุปกรณ์</h1><div class="result-items">${results.map(equipmentCard).join('')}</div>${button('เก็บเข้าคลัง','closeResults','primary')}</section></div>`;return;}
 if(page==='battle'&&b&&b.status!=='fighting') { const won=b.status==='won';const r=b.rewards;
  m.hidden=false;m.innerHTML=`<div class="modal-backdrop"><section class="battle-result ${won?'victory':'defeat'}"><div class="result-seal">${icon(won?'star':'shield')}</div><span class="eyebrow">${won?'THE LIGHT ENDURES':'EVERY LEGEND HAS ITS TRIALS'}</span><h1>${won?'VICTORY':'TRY AGAIN'}</h1><p>${won?'อีกหนึ่งก้าวของการเดินทาง':'ปรับทีม เพิ่มเลเวล และกลับมาสู้ใหม่'}</p>${r?`<div class="win-rewards"><span>${icon('crystal')}+${r.gems}</span><span>${icon('coin')}+${r.gold}</span></div>${r.hero?`<div class="new-companion">${icon('heroes')} ${HEROES.find(h=>h.id===r.hero)!.name} เข้าร่วมการเดินทางแล้ว</div>`:''}${r.equipment.map(equipmentCard).join('')}`:''}<div class="result-buttons">${button('กลับสู่การผจญภัย','finishBattle','primary')}${!won?button('ลองอีกครั้ง','retryBattle','secondary'):''}</div><small>${won?'รางวัลและความคืบหน้าบันทึกแล้ว':''}</small></section></div>`;return;
 }
 m.hidden=true;m.innerHTML='';
}
document.addEventListener('click', e=>{
 const el=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(!el)return;
 sound();const d=el.dataset;
 switch(d.action){
  case 'nav': changePage(d.page as Page);break;
  case 'stage': selectedStage=Number(d.id);render();break;
  case 'selectHero': selectedHero=d.id!;selectedSkill=0;changePage('heroes');break;
  case 'skillInfo': selectedSkill=Number(d.index);render();break;
  case 'startBattle': if(engine.startBattle(selectedStage)){changePage('battle');}break;
  case 'cast':engine.castSkill(d.hero!,Number(d.slot));break;
  case 'auto':engine.setAuto(!engine.state.battle?.auto);renderBattle();break;
  case 'speed':engine.setSpeed(engine.state.battle?.speed===1?2:1);renderBattle();break;
  case 'pause':engine.setPaused(!engine.state.battle?.paused);if(engine.state.battle?.paused)spellAudio.stop();renderBattle();break;
  case 'abandonBattle':engine.returnHome();changePage('story');toast('ถอนตัวแล้ว สามารถจัดทีมและอุปกรณ์ก่อนกลับมาสู้ใหม่');break;
  case 'buyHero':engine.buyHero(selectedHero);render();break;
  case 'party': {const ids=engine.state.profile.party;engine.setParty(ids.includes(selectedHero)?ids.filter(id=>id!==selectedHero):[...ids,selectedHero]);render();break;}
  case 'upgrade':engine.upgradeHero(selectedHero);render();break;
  case 'equip':engine.equip(selectedHero,d.id!);render();break;
  case 'summon': results=engine.summonEquipment(Number(d.count) as 1|10);render();if(results.length)sound('win');break;
  case 'closeResults':results=[];renderModal();break;
  case 'finishBattle':engine.returnHome();changePage('story');break;
  case 'retryBattle':{const stage=engine.state.battle!.stageId;engine.returnHome();if(engine.startBattle(stage))changePage('battle');break;}
  case 'sound':muted=!muted;spellAudio.setMuted(muted);render();sound();break;
  case 'effects':reducedEffects=!reducedEffects;world.setReducedEffects(reducedEffects);render();break;
  case 'export': {const url=URL.createObjectURL(new Blob([engine.exportSave()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`aetheria-save-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('ส่งออกไฟล์เซฟแล้ว');break;}
  case 'import':$('#import-file').click();break;
 }
 if(engine.state.notice&&engine.state.notice!==lastNotice){lastNotice=engine.state.notice;toast(lastNotice);}
});
$('#import-file').addEventListener('change',async e=>{const input=e.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;if(file.size>2_000_000){toast('ไฟล์เซฟใหญ่เกินไป');return;}const raw=await file.text();if(engine.importSave(raw)){render();toast('นำเข้าเซฟสำเร็จ');}else toast(engine.state.notice||'ไฟล์เซฟไม่ถูกต้อง');input.value='';});
document.addEventListener('visibilitychange',()=>{if(document.hidden){spellAudio.stop();if(engine.state.battle?.status==='fighting')engine.setPaused(true);}engine.save();});
window.addEventListener('pagehide',()=>{spellAudio.stop();engine.save();});
window.addEventListener('resize',()=>world.resize());
let previous=performance.now();let previousBattleStatus='';
function loop(now:number){const dt=Math.min((now-previous)/1000,0.08);previous=now;const sceneReady=world.prepare(engine.state);if(sceneReady)engine.update(dt);world.render(engine.state,dt);uiElapsed+=dt;
 $('#character-loading').hidden=sceneReady||!!world.loadingError;
 if(world.loadingError&&!$('#asset-warning').textContent){$('#asset-warning').hidden=false;$('#asset-warning').innerHTML=`<b>เรียกสหายไม่สำเร็จ</b><button onclick="location.reload()">ลองใหม่</button>`;}
 if(uiElapsed>0.1){uiElapsed=0;if(page==='battle')renderBattle();else if(lastRevision!==engine.state.revision)render();$('#gold').textContent=fmt(engine.state.profile.gold);$('#gems').textContent=fmt(engine.state.profile.gems);}
 if(engine.state.battle?.status==='won'&&previousBattleStatus!=='won')sound('win');previousBattleStatus=engine.state.battle?.status||'';
 if(noticeTimer>0){noticeTimer-=dt;if(noticeTimer<=0)$('#toast').classList.remove('show');}
 if(skillCueTimer>0&&!engine.state.battle?.paused){skillCueTimer-=dt;if(skillCueTimer<=0)$('#skill-cue').hidden=true;}
 requestAnimationFrame(loop);
}
render();
world.init(message=>{$('#load-message').textContent=message;}).then(()=>{$('#loading').classList.add('loaded');setTimeout(()=>$('#loading').remove(),600);requestAnimationFrame(loop);}).catch(error=>{
 $('#loading').classList.add('loaded');$('#asset-warning').hidden=false;$('#asset-warning').innerHTML=`<b>ยังโหลดโมเดล 3D ไม่สำเร็จ</b><span>${escape(String(error instanceof Error?error.message:error))}</span><button onclick="location.reload()">ลองใหม่</button>`;requestAnimationFrame(loop);
});
// Expose a minimal read-only diagnostic snapshot, never a mutable game instance.
Object.defineProperty(window,'aetheriaDiagnostics',{value:()=>({page,loaded:world.loaded,error:world.loadingError,models:world.modelDiagnostics,effects:world.effectDiagnostics,combat:engine.state.battle?[...engine.state.battle.allies,...engine.state.battle.enemies].map(a=>({id:a.id,side:a.side,heroId:a.heroId,x:a.x,z:a.z,action:a.action,targetId:a.targetId,alive:a.alive,attackMode:a.attackMode,attackRange:a.attackRange,radius:a.radius,queuedSkill:a.queuedSkill})):[],party:[...engine.state.profile.party],battle:engine.state.battle?{status:engine.state.battle.status,wave:engine.state.battle.wave,allies:engine.state.battle.allies.length}:null}),writable:false});
