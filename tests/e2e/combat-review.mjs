import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.REVIEW_ARTIFACTS || new URL('../../test-results/combat-review/',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE || (process.platform==='win32'?'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe':undefined),headless:true,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
const report={errors:[],failed:[],captures:[],checks:[]};
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});page.on('requestfailed',r=>report.failed.push({url:r.url(),error:r.failure()?.errorText}));
 await page.goto(process.env.REVIEW_URL || 'http://127.0.0.1:4174/quality-review.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.aetheriaReview?.state.ready,{},{timeout:90000});
 const saved=await page.evaluate(()=>JSON.stringify(localStorage));
 assert.equal(await page.evaluate(()=>window.aetheriaReview.state.soundEnabled),false,'Sound should start off');
 await page.locator('#review-sound').tap();assert.equal(await page.evaluate(()=>window.aetheriaReview.state.soundEnabled),true);
 await page.locator('#review-sound').tap();assert.equal(await page.evaluate(()=>window.aetheriaReview.state.soundEnabled),false);
 for(const view of [{name:'landscape',width:844,height:390},{name:'portrait',width:390,height:844}]){
  await page.setViewportSize({width:view.width,height:view.height});await page.waitForTimeout(350);
  for(const [name,time]of [['approach',1.5],['contact',3.42],['heavy-windup',7.26],['heavy-impact',7.50],['healing',11.15],['ready',13]]){
   await page.evaluate(t=>window.aetheriaReview.seek(t),time);await page.waitForTimeout(130);
   await page.screenshot({path:`${out}/${view.name}-${name}.png`});
   report.captures.push({view:view.name,name,...await page.evaluate(()=>window.aetheriaReview.snapshot())});
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Horizontal overflow');
 }
 await page.locator('#review-restart').tap();await page.waitForTimeout(600);await page.locator('#review-play').tap();
 const frozen=await page.evaluate(()=>window.aetheriaReview.snapshot());await page.waitForTimeout(400);assert.deepEqual(await page.evaluate(()=>window.aetheriaReview.snapshot()),frozen,'Pause does not freeze pose and time');
 await page.locator('#review-speed').tap();assert.equal(await page.evaluate(()=>window.aetheriaReview.state.speed),.5);
 await page.locator('#review-play').tap();await page.waitForTimeout(500);assert(await page.evaluate(()=>window.aetheriaReview.state.time)>frozen.time,'Play does not advance');
 assert.equal(await page.evaluate(()=>JSON.stringify(localStorage)),saved,'Review mutated saved data');
 await page.evaluate(()=>window.aetheriaReview.seek(2.27));const arrival=await page.evaluate(()=>window.aetheriaReview.snapshot());
 await page.evaluate(()=>{window.aetheriaReview.seek(12);window.aetheriaReview.seek(2.27);});assert.deepEqual(await page.evaluate(()=>window.aetheriaReview.snapshot()),arrival,'Arrival is not deterministic when seeking');
 assert.equal(report.errors.length,0,JSON.stringify(report.errors));assert.equal(report.failed.length,0,JSON.stringify(report.failed));
 report.checks.push('landscape/portrait captures, pause, restart, half speed, resume, localStorage unchanged, no JS/network errors');report.status='PASS';
 await context.close();
}catch(e){report.status='FAIL';report.failure=e.message;throw e;}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify({status:report.status,captures:report.captures.length,checks:report.checks}));

