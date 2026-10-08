import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const artifacts=process.env.QA_ARTIFACTS||'test-results/contact-combat';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const report={device:'Edge mobile viewport/touch emulation, not physical iOS',errors:[],checks:[],captures:[]};
const distance=(a,b)=>Math.hypot((a.x-b.x)*1.55,(a.z-b.z)*1.25);
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();
 page.on('pageerror',error=>report.errors.push(error.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 await page.goto(process.env.QA_URL||'http://127.0.0.1:4174/',{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.aetheriaDiagnostics?.().loaded,undefined,{timeout:90000});await page.locator('#loading').waitFor({state:'detached'});
 const profile=await page.evaluate(async()=>{const {createProfile}=await import('/src/simulation/storage.ts');const p=createProfile(),ids=['kael','lyra','seraphina','riven','astrid','elias','nova','lucien'];p.ownedHeroes=ids;p.heroLevels=Object.fromEntries(ids.map(id=>[id,1]));p.equipped=Object.fromEntries(ids.map(id=>[id,{}]));p.party=['kael','riven','nova','lyra'];p.wins=[1,2,3,4];p.unlockedStage=5;p.recruitedStoryHeroes=['seraphina','riven'];return p;});
 await context.addInitScript(profile=>localStorage.setItem('aetheria-chronicles-save-v1',JSON.stringify(profile)),profile);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.aetheriaDiagnostics?.().loaded,undefined,{timeout:90000});await page.locator('#loading').waitFor({state:'detached'});
 for(const [name,viewport] of [['landscape',{width:844,height:390}],['portrait',{width:390,height:844}]]){
  await page.setViewportSize(viewport);await page.locator('#nav [data-page="story"]').tap();await page.locator('[data-action="stage"][data-id="5"]').tap();await page.locator('[data-action="startBattle"]').tap();
  await page.waitForFunction(()=>document.querySelector('#character-loading').hidden&&window.aetheriaDiagnostics().combat.some(a=>a.action==='move'),undefined,{timeout:90000});
  await page.screenshot({path:`${artifacts}/${name}-approach.png`});
  await page.waitForFunction(()=>{const actors=window.aetheriaDiagnostics().combat;return ['kael','riven','nova'].every(id=>{const a=actors.find(a=>a.id===id),b=actors.find(b=>b.id===a?.targetId);return a&&b&&a.alive&&Math.hypot((a.x-b.x)*1.55,(a.z-b.z)*1.25)<=a.radius+b.radius+a.attackRange+.09})},undefined,{timeout:15000});
  await page.locator('[data-action="pause"]').first().tap();const snapshot=await page.evaluate(()=>window.aetheriaDiagnostics());
  for(const id of ['kael','riven','nova']){const a=snapshot.combat.find(a=>a.id===id),target=snapshot.combat.find(b=>b.id===a.targetId);assert(distance(a,target)<=a.radius+target.radius+a.attackRange+.1);}
  const healer=snapshot.combat.find(a=>a.id==='lyra');assert(healer.x<snapshot.combat.find(a=>a.id==='kael').x-1);
  const frozen=JSON.stringify(snapshot.combat);await page.waitForTimeout(300);assert.equal(JSON.stringify(await page.evaluate(()=>window.aetheriaDiagnostics().combat)),frozen);
  await page.locator('[data-action="pause"]').first().tap();await page.screenshot({path:`${artifacts}/${name}-contact.png`});report.captures.push(`${name}-contact`);report.checks.push(`${name}: three melee heroes reach body/weapon contact; healer stays behind; pause freezes positions`);
  const before=await page.evaluate(()=>window.aetheriaDiagnostics().effects.totalCasts);await page.locator('[data-action="cast"][data-hero="nova"][data-slot="0"]').tap();await page.waitForFunction(count=>window.aetheriaDiagnostics().effects.totalCasts>count,before,{timeout:15000});await page.screenshot({path:`${artifacts}/${name}-staff-skill.png`});
  await page.locator('.brand').tap();await page.locator('.round[data-page="settings"]').tap();await page.locator('.brand').tap();
  // Leaving an active battle pauses it; choose the resume prompt then abandon through the existing pause flow.
  await page.locator('.resume-battle').tap();await page.locator('.pause-layer [data-page="home"]').tap();
  // Reload the isolated fixture to start a fresh encounter in the next orientation.
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.aetheriaDiagnostics?.().loaded,undefined,{timeout:90000});await page.locator('#loading').waitFor({state:'detached'});
 }
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));report.checks.push('No browser or shader errors');await context.close();console.log('CONTACT_COMBAT_QA_PASS');
}finally{await writeFile(`${artifacts}/report.json`,JSON.stringify(report,null,2));await browser.close()}
