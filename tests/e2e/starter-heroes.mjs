import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const artifacts=process.env.QA_ARTIFACTS||'test-results/starter-heroes';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const url=process.env.QA_URL||'http://127.0.0.1:4174/';
const report={device:'Edge touch/viewport emulation, not physical iPhone or iPad',errors:[],failedRequests:[],checks:[],animations:[],skills:[]};
const timings={kael:[{id:'dawnstrike',impact:.48,duration:1.15},{id:'sunward',impact:.65,duration:1.40},{id:'horizon',impact:1,duration:1.85}],lyra:[{id:'starlight',impact:.58,duration:1.30},{id:'sanctuary',impact:.70,duration:1.50},{id:'astral',impact:.95,duration:1.80}]};
let page;
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 page=await context.newPage();
 page.setDefaultNavigationTimeout(90000); // Slow local software-WebGL startup must not weaken combat timing assertions.
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push({message:m.text(),location:m.location()})});
 page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('response',r=>{if(r.status()>=400&&/assets\//.test(r.url()))report.errors.push(`${r.status()} ${r.url()}`)});
 const ready=async()=>{
  await page.waitForFunction(()=>window.aetheriaDiagnostics?.().loaded&&window.aetheriaDiagnostics().models.actors.some(a=>a.id==='showcase'&&a.jointCount>=20)&&window.aetheriaDiagnostics().models.actors.some(a=>a.id==='companion-lyra'&&a.jointCount>=20),undefined,{timeout:90000});
  await page.locator('#loading').waitFor({state:'detached',timeout:90000});
  // Copy diagnostics once per frame, so short clips cannot pass between Node polls.
  // This observer never changes the game, advances time, or replaces requestAnimationFrame.
  await page.evaluate(()=>{window.__starterQaFrames=[];if(window.__starterQaObserver)return;window.__starterQaObserver=true;const observe=()=>{const d=window.aetheriaDiagnostics?.();if(d){window.__starterQaFrames.push(d);if(window.__starterQaFrames.length>360)window.__starterQaFrames.shift();}requestAnimationFrame(observe);};requestAnimationFrame(observe);});
 };
 const clearFrames=()=>page.evaluate(()=>{window.__starterQaFrames=[];});
 const frames=()=>page.evaluate(()=>window.__starterQaFrames);
 const observeClip=async clip=>{
  await page.waitForFunction(clip=>{const rows=window.__starterQaFrames.flatMap(f=>f.models.actors.filter(a=>a.id==='showcase'&&a.clip===clip));return rows.length>=2&&Math.max(...rows.map(a=>a.currentTime))-Math.min(...rows.map(a=>a.currentTime))>.025;},clip,{timeout:5000});
  const rows=(await frames()).flatMap(f=>f.models.actors.filter(a=>a.id==='showcase'&&a.clip===clip));
  assert(rows.every(a=>a.jointCount>=20),'Every observed clip is driven by the imported skeleton');
  const first=rows[0],last=rows.at(-1);
  return {clip,joints:first.jointCount,firstTime:first.currentTime,lastTime:last.currentTime,socketTravel:Math.hypot(...last.weaponHand.map((v,i)=>v-first.weaponHand[i]))};
 };
 const saveProfile=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('aetheria-chronicles-save-v1')));
 await page.goto(url,{waitUntil:'domcontentloaded'});await ready();
 assert.deepEqual(await page.evaluate(()=>window.aetheriaDiagnostics().party),['kael','lyra']);
 await page.screenshot({path:`${artifacts}/starter-duo-landscape.png`});
 const originalProfile=await saveProfile();
 for(const hero of ['kael','lyra']){
  await page.locator('#nav [data-page="heroes"]').tap();
  await page.locator(`.hero-tab[data-id="${hero}"]`).tap();
  await page.waitForFunction(h=>window.aetheriaDiagnostics().models.actors.some(a=>a.id==='showcase'&&a.modelKey===(h==='kael'?'knight':'healer')&&a.jointCount>=20),hero,{timeout:20000});
  await page.locator('.starter-preview summary').tap();
  for(const clip of ['Idle','Run','Attack_01','Attack_02','Hit','Death','Victory']){
   await clearFrames();
   await page.locator(`[data-action="previewMotion"][data-clip="${clip}"]`).tap();
   report.animations.push({hero,...await observeClip(clip)});
   if(['Run','Attack_01','Victory'].includes(clip))await page.screenshot({path:`${artifacts}/${hero}-${clip}.png`});
  }
  for(let slot=0;slot<3;slot++){
   await page.locator(`[data-action="skillInfo"][data-index="${slot}"]`).tap();
   await clearFrames();
   await page.locator('[data-action="previewSkill"]').tap();
   const clip=`Skill_0${slot+1}`;
   report.animations.push({hero,...await observeClip(clip)});
   await page.waitForTimeout((hero==='kael'?[480,650,1000]:[580,700,950])[slot]+70);
   await page.screenshot({path:`${artifacts}/${hero}-${clip}.png`});
  }
  console.log(`${hero}: ten authored clips observed through touch controls`);
 }
 assert.deepEqual(await saveProfile(),originalProfile,'Preview motions and skills leave the save profile unchanged');
 // Reload creates a new battle, preserving the genuine starting save. Auto is off.
 for(const hero of ['kael','lyra'])for(let slot=0;slot<3;slot++){
  await page.goto(url,{waitUntil:'domcontentloaded'});await ready();
  await page.locator('#nav [data-page="story"]').tap();await page.locator('[data-action="startBattle"]').tap();
  await page.waitForFunction(()=>document.querySelector('#character-loading').hidden&&window.aetheriaDiagnostics().battle?.status==='fighting'&&window.aetheriaDiagnostics().models.actors.length>=4,undefined,{timeout:90000});
  const speed=hero==='kael'&&slot===2?2:1;
  if(speed===2)await page.locator('[data-action="speed"]').tap();
  await clearFrames();
  const before=await page.evaluate(()=>window.aetheriaDiagnostics().effects.totalCasts);
  await page.locator(`[data-action="cast"][data-hero="${hero}"][data-slot="${slot}"]`).tap();
  await page.waitForFunction(({hero,slot,before})=>{const d=window.aetheriaDiagnostics();return d.effects.totalCasts>before&&d.effects.casts.some(c=>c.heroId===hero&&c.slot===slot);},{hero,slot,before},{timeout:15000});
  await page.locator('[data-action="pause"]').first().tap();
  const frozen=await page.evaluate(()=>{const d=window.aetheriaDiagnostics();return {combat:d.combat,ages:d.effects.ages,actors:d.models.actors.map(a=>({id:a.id,clip:a.clip,time:a.currentTime,tip:a.weaponTip})),clock:d.effects.simulationTime};});
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>{const d=window.aetheriaDiagnostics();return {combat:d.combat,ages:d.effects.ages,actors:d.models.actors.map(a=>({id:a.id,clip:a.clip,time:a.currentTime,tip:a.weaponTip})),clock:d.effects.simulationTime};}),frozen,'Pause freezes the simulation, actual skeleton and effects');
  if(hero==='lyra'&&slot===2){
   const casts=await page.evaluate(()=>window.aetheriaDiagnostics().effects.totalCasts);
   await page.locator('.brand').tap();
   await page.locator('.resume-battle').tap();
   await page.waitForFunction(()=>window.aetheriaDiagnostics().effects.casts.some(c=>c.heroId==='lyra'&&c.slot===2),undefined,{timeout:3000});
   assert.equal(await page.evaluate(()=>window.aetheriaDiagnostics().effects.totalCasts),casts,'Resuming a cast does not duplicate the cast event');
   assert.deepEqual(await page.evaluate(()=>window.aetheriaDiagnostics().combat),frozen.combat,'Visiting camp preserves paused skill state');
   report.checks.push('Paused mid-cast survives camp visit and resumes with effects, without replaying a cast');
  }
  await page.locator('[data-action="pause"]').first().tap();
  await page.waitForFunction(({hero,slot})=>window.aetheriaDiagnostics().effects.impacts.some(i=>i.heroId===hero&&i.slot===slot),{hero,slot},{timeout:10000});
  await page.screenshot({path:`${artifacts}/battle-${hero}-${slot+1}.png`});
  const timing=timings[hero][slot];
  await page.waitForFunction(({hero,slot,duration})=>window.__starterQaFrames.some(f=>f.combat.some(a=>a.heroId===hero&&a.activeSkillSlot===slot&&a.action==='skill'&&f.effects.simulationTime-a.actionStartedAt>=duration-.18)),{hero,slot,duration:timing.duration},{timeout:5000});
  const observed=await frames();
  const impact=observed.flatMap(f=>f.effects.impacts).find(i=>i.heroId===hero&&i.slot===slot);
  assert(impact,'The requested skill emits its own confirmed impact');assert.equal(impact.skillId,timing.id);assert(Math.abs(impact.impactDelay-timing.impact)<1e-5);
  assert(impact.age+1e-5>=timing.impact&&impact.age-timing.impact<=.08*speed+.005,'Impact occurs at the authored offset within one simulation frame');
  const active=observed.filter(f=>f.page==='battle').flatMap(f=>f.combat.filter(a=>a.heroId===hero&&a.action==='skill'&&a.activeSkillSlot===slot&&f.models.actors.some(m=>m.id===a.id)).map(a=>({actor:a,model:f.models.actors.find(m=>m.id===a.id),age:f.effects.simulationTime-a.actionStartedAt,cast:f.effects.casts.find(c=>c.heroId===hero&&c.slot===slot)})));
  assert(active.length>0,'The requested hero enters its requested skill');
  for(const sample of active){
   assert.equal(sample.model.clip,`Skill_0${slot+1}`);assert.equal(sample.actor.actionDuration,timing.duration);
   assert(Math.abs(sample.model.currentTime/sample.model.clipDuration*timing.duration-sample.age)<.025,'Skeletal playback follows the authoritative simulation clock');
   if(sample.cast){assert(Math.abs(sample.cast.age-sample.age)<1e-5,'Effects and skeleton share one absolute cast age');if(sample.age<timing.impact-1e-5)assert.equal(sample.cast.impactConfirmed,false,'No visual impact before simulation confirmation');}
  }
  assert(Math.max(...active.map(s=>s.age))>=timing.duration-.18,'Skill retains its authored recovery');
  report.skills.push({hero,slot,speed,skillId:timing.id,impactDelay:timing.impact,confirmedImpactAge:impact.age,duration:timing.duration,lastSkillAge:Math.max(...active.map(s=>s.age)),samples:active.length});
  console.log(`${hero} slot ${slot+1}: exact clip, authored impact, recovery and pause passed (${speed}x)`);
 }
 await page.setViewportSize({width:390,height:844});await page.goto(url,{waitUntil:'domcontentloaded'});await ready();
 await page.screenshot({path:`${artifacts}/starter-duo-portrait.png`});
 await page.locator('#nav [data-page="heroes"]').tap();await page.locator('.hero-tab[data-id="lyra"]').tap();
 await page.locator('[data-action="previewSkill"]').tap();await page.waitForTimeout(650);
 await page.screenshot({path:`${artifacts}/priestess-portrait-skill.png`});
 await page.locator('#nav [data-page="story"]').tap();await page.locator('[data-action="startBattle"]').tap();
 await page.waitForFunction(()=>document.querySelector('#character-loading').hidden&&window.aetheriaDiagnostics().models.actors.length>=4,undefined,{timeout:90000});
 await page.screenshot({path:`${artifacts}/starter-battle-portrait.png`});
 const overflow=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
 assert(overflow.document<=overflow.viewport+1&&overflow.body<=overflow.viewport+1,'Portrait has no horizontal page overflow');
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));
 assert.equal(report.failedRequests.length,0,JSON.stringify(report.failedRequests));
 report.checks.push('Two free starter heroes;20 real UI clips; previews leave save unchanged; six exact combat skills with authored impacts and complete recovery; 1x/2x; skeleton and effects freeze; landscape and portrait; no browser/shader/asset/network errors');
 report.status='PASS';
 console.log('STARTER_HEROES_QA_PASS');await context.close();
}catch(error){report.status='FAIL';report.failure={message:error.message,stack:error.stack};if(page&&!page.isClosed()){try{await page.screenshot({path:`${artifacts}/failure.png`});report.failure.diagnostics=await page.evaluate(()=>window.aetheriaDiagnostics?.());}catch{}}throw error;
}finally{await writeFile(`${artifacts}/report.json`,JSON.stringify(report,null,2));await browser.close();}
