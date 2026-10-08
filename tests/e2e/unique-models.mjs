import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
const artifacts=process.env.QA_ARTIFACTS||'test-results/unique-models';await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.EDGE_PATH||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const mappings={kael:'knight',lyra:'healer',seraphina:'seraphina',riven:'riven',astrid:'astrid',elias:'elias',nova:'nova',lucien:'lucien'};
const report={errors:[],checks:[],captures:[]};
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});const page=await context.newPage();const requests=[];
 page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/assets\//.test(r.url()))report.errors.push(`${r.status()} ${r.url()}`)});page.on('request',r=>{if(r.url().endsWith('.glb'))requests.push(r.url())});
 await page.goto(process.env.QA_URL||'http://127.0.0.1:4174/',{waitUntil:'domcontentloaded',timeout:90000});
 await page.waitForFunction(()=>window.aetheriaDiagnostics?.().loaded,undefined,{timeout:90000});await page.locator('#loading').waitFor({state:'detached',timeout:90000});
 assert.equal(requests.length,2,'only the starting duo downloads at boot');report.checks.push('Starting duo only at boot');
 await page.locator('#nav [data-page="heroes"]').tap();
 for(const [hero,key] of Object.entries(mappings)){
  await page.locator(`.hero-tab[data-id="${hero}"]`).tap();
  await page.waitForFunction(expected=>window.aetheriaDiagnostics().models.actors.some(a=>a.id==='showcase'&&a.modelKey===expected)&&document.querySelector('#character-loading').hidden,key,{timeout:90000});
  await page.screenshot({path:`${artifacts}/${hero}.png`});report.captures.push(hero);console.log('Preview verified:',hero,key);
 }
 report.checks.push('All eight previews render their exact unique models');
 await page.locator('.hero-tab[data-id="nova"]').tap();await page.locator('[data-action="buyHero"]').tap();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('aetheria-chronicles-save-v1')));assert(saved.ownedHeroes.includes('nova'));assert(saved.party.includes('nova'));assert.equal(saved.gems,1200);
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.aetheriaDiagnostics?.().loaded,undefined,{timeout:90000});await page.locator('#loading').waitFor({state:'detached',timeout:90000});
 await page.waitForFunction(()=>window.aetheriaDiagnostics().models.actors.some(a=>a.id==='companion-nova'&&a.modelKey==='nova'),undefined,{timeout:90000});report.checks.push('Purchase and party survive reload with correct model');
 await page.locator('#nav [data-page="story"]').tap();await page.locator('[data-action="startBattle"]').tap();await page.waitForFunction(()=>window.aetheriaDiagnostics().models.actors.filter(a=>a.id.startsWith('enemy-')).length===2,undefined,{timeout:90000});
 let actors=await page.evaluate(()=>window.aetheriaDiagnostics().models.actors);assert.equal(new Set(actors.map(a=>a.modelKey)).size,actors.length);await page.screenshot({path:`${artifacts}/battle-landscape.png`});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${artifacts}/battle-portrait.png`});await page.setViewportSize({width:844,height:390});
 await page.locator('[data-action="speed"]').tap();
 await page.waitForFunction(()=>window.aetheriaDiagnostics().models.actors.some(a=>a.modelKey==='boss-earth'),undefined,{timeout:120000});report.checks.push('Distinct chapter boss appears after wave transition');
 await page.screenshot({path:`${artifacts}/boss.png`});
 assert.equal(report.errors.length,0);report.checks.push('No missing assets or browser errors');
 await context.close();console.log('UNIQUE_MODEL_QA_PASS');
}finally{await writeFile(`${artifacts}/report.json`,JSON.stringify(report,null,2));await browser.close()}
