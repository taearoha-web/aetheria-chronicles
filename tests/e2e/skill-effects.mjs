import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const artifacts=process.env.QA_ARTIFACTS||'test-results/skill-effects';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const heroes=['kael','lyra','seraphina','riven','astrid','elias','nova','lucien'].filter(id=>!process.env.QA_HEROES||process.env.QA_HEROES.split(',').includes(id));
const report={device:'Edge mobile viewport/touch emulator; not a physical iPhone',errors:[],checks:[],skills:[],captures:[],peakDrawCalls:0};
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')report.errors.push(msg.text())});page.on('response',r=>{if(r.status()>=400&&/assets\//.test(r.url()))report.errors.push(`${r.status()} ${r.url()}`)});
 await page.goto(process.env.QA_URL||'http://127.0.0.1:4174/',{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.aetheriaDiagnostics?.().loaded,undefined,{timeout:90000});await page.locator('#loading').waitFor({state:'detached'});
 const seed=await page.evaluate(async()=>{const {createProfile}=await import('/src/simulation/storage.ts');const p=createProfile();const ids=['kael','lyra','seraphina','riven','astrid','elias','nova','lucien'];p.ownedHeroes=ids;p.heroLevels=Object.fromEntries(ids.map(id=>[id,1]));p.equipped=Object.fromEntries(ids.map(id=>[id,{}]));p.unlockedStage=5;p.wins=[1,2,3,4];p.recruitedStoryHeroes=['seraphina','riven'];return p;});
 await context.addInitScript(seed=>{const hero=new URL(location.href).searchParams.get('qaHero');if(hero){const profile={...seed,party:hero==='kael'?['kael','lyra']:[hero,'kael']};localStorage.setItem('aetheria-chronicles-save-v1',JSON.stringify(profile));}},seed);
 for(const hero of heroes){
  await page.goto((process.env.QA_URL||'http://127.0.0.1:4174/')+'?qaHero='+hero,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.aetheriaDiagnostics?.().loaded,undefined,{timeout:90000});await page.locator('#loading').waitFor({state:'detached'});
  if(hero==='kael'){await page.locator('[data-page="settings"]').tap();await page.locator('[data-action="sound"]').tap();await page.locator('.brand').tap();}
  await page.locator('#nav [data-page="story"]').tap();await page.locator('[data-action="stage"][data-id="5"]').tap();await page.locator('[data-action="startBattle"]').tap();
  await page.waitForFunction(h=>window.aetheriaDiagnostics().models.actors.some(a=>a.id===h)&&document.querySelector('#character-loading').hidden,hero,{timeout:90000});
  for(let slot=0;slot<3;slot++){
   if(hero==='elias'&&slot===2)await page.setViewportSize({width:390,height:844});
   const before=await page.evaluate(()=>window.aetheriaDiagnostics().effects.totalCasts);const button=page.locator(`[data-action="cast"][data-hero="${hero}"][data-slot="${slot}"]`);await button.tap();
   await page.waitForFunction(count=>window.aetheriaDiagnostics().effects.totalCasts===count+1,before,{timeout:10000});
   const info=await page.evaluate(()=>window.aetheriaDiagnostics().effects);const key=info.recentSkills.at(-1);assert(key.startsWith(hero+':'));report.skills.push(key);report.peakDrawCalls=Math.max(report.peakDrawCalls,info.drawCalls);
   if(slot===2){await page.waitForTimeout(280);await page.screenshot({path:`${artifacts}/${hero}-ultimate.png`});report.captures.push(`${hero}-ultimate`);if(hero==='elias'){await page.screenshot({path:`${artifacts}/portrait-lightning.png`});await page.setViewportSize({width:844,height:390});report.captures.push('portrait-lightning');}}
   if(hero==='kael'&&slot===0){
    await page.locator('[data-action="pause"]').first().tap();const beforePause=await page.evaluate(()=>window.aetheriaDiagnostics().effects.ages);await page.waitForTimeout(350);const afterPause=await page.evaluate(()=>window.aetheriaDiagnostics().effects.ages);assert.deepEqual(afterPause,beforePause,'pause freezes effect timelines');await page.locator('[data-action="pause"]').first().tap();report.checks.push('Pause freezes spell timeline');
   }
  }
  await page.waitForTimeout(1900);assert.equal(await page.evaluate(()=>window.aetheriaDiagnostics().effects.activeCasts),0,'cast resources expire');
  console.log('Skills verified:',hero);
 }
 assert.equal(new Set(report.skills).size,heroes.length*3);report.checks.push(`${report.skills.length} hero skills emit exact identities and render without shader errors`);report.checks.push('Transient spell geometry expires after each hero sequence');
 await page.locator('.brand').tap();await page.locator('[data-page="settings"]').tap();await page.locator('[data-action="effects"]').tap();assert.equal(await page.evaluate(()=>window.aetheriaDiagnostics().effects.reduced),true);await page.locator('[data-action="sound"]').tap();report.checks.push('Light effects and sound toggles work');
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.checks.push('No browser errors or missing assets');await context.close();console.log('SKILL_EFFECTS_QA_PASS');
}finally{await writeFile(`${artifacts}/report.json`,JSON.stringify(report,null,2));await browser.close()}
