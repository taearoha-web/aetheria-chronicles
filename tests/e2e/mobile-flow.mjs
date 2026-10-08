import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Run with: node tests/e2e/mobile-flow.mjs
// Isolated browser contexts exercise player-facing UI only. Save reads are diagnostic.
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const artifacts = process.env.QA_ARTIFACTS || path.resolve(project, 'test-results/mobile');
const baseURL = process.env.QA_URL || 'http://127.0.0.1:4174';
const executablePath = process.env.EDGE_PATH || (process.platform === 'win32' ? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' : undefined);
await mkdir(artifacts, { recursive: true });
const report = { baseURL, startedAt: new Date().toISOString(), flows: [], errors: [] };
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless: true, args: ['--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] });

const log = message => console.log(`[${new Date().toISOString()}] ${message}`);
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('aetheria-chronicles-save-v1')));

async function ready(page) {
  await page.waitForFunction(() => window.aetheriaDiagnostics?.().loaded === true, undefined, { timeout: 90000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 90000 });
  assert.equal(await page.locator('#asset-warning').isVisible(), false, '3D assets must load successfully');
  assert.equal(await page.locator('#world canvas').count(), 1, '3D canvas is attached');
}

async function click(page, selector) {
  const locator = page.locator(selector).first();
  // tap performs its own scroll and retries after UI transitions replace a node.
  await locator.tap({ timeout: 15000 });
}

async function verifyNoHorizontalOverflow(page, name) {
  const widths = await page.evaluate(() => ({ screen: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  assert.ok(widths.document <= widths.screen + 1 && widths.body <= widths.screen + 1, `${name} horizontal overflow: ${JSON.stringify(widths)}`);
}

async function flow(name, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await context.newPage();
  const result = { name, viewport, checks: [], consoleErrors: [], pageErrors: [], requestsFailed: [] };
  report.flows.push(result);
  page.on('pageerror', error => result.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') result.consoleErrors.push(message.text()); });
  page.on('requestfailed', request => result.requestsFailed.push({ url: request.url(), error: request.failure()?.errorText }));
  const check = description => { result.checks.push(description); log(`${name}: ${description}`); };

  try {
    log(`${name}: opening local game`);
    await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await ready(page);
    await verifyNoHorizontalOverflow(page, 'home');
    await page.screenshot({ path: path.join(artifacts, `${name}-home.png`) });
    check('Booted with loaded animated GLB assets and no horizontal overflow');

    await click(page, '#nav [data-page="heroes"]');
    await click(page, '.hero-tab[data-id="nova"]');
    await click(page, '[data-action="buyHero"]');
    let profile = await save(page);
    assert.equal(profile.gems, 1200);
    assert.ok(profile.ownedHeroes.includes('nova'));
    assert.ok(profile.party.includes('nova'));
    assert.equal(await page.locator('[data-action="buyHero"]').count(), 0);
    check('Selected and purchased Nova for exactly1200gems; hero joined the party');

    await click(page, '#nav [data-page="forge"]');
    await click(page, '[data-action="summon"][data-count="1"]');
    await page.locator('.result-panel').waitFor({ state: 'visible' });
    profile = await save(page);
    const item = profile.inventory.at(-1);
    assert.equal(profile.gems, 1040);
    assert.equal(profile.summons, 1);
    assert.equal(profile.inventory.length, 4);
    assert.deepEqual(profile.ownedHeroes, ['kael', 'lyra', 'nova']);
    await page.screenshot({ path: path.join(artifacts, `${name}-summon.png`) });
    await click(page, '[data-action="closeResults"]');
    check('Summoned one equipment item for160gems without changing hero ownership');

    await click(page, '#nav [data-page="heroes"]');
    await click(page, '.hero-tab[data-id="lyra"]');
    await click(page, '.equipment-section summary');
    await click(page, `[data-action="equip"][data-id="${item.id}"]`);
    profile = await save(page);
    assert.equal(profile.equipped.lyra[item.slot], item.id);
    assert.equal(Object.values(profile.equipped).flatMap(Object.values).filter(id => id === item.id).length, 1);
    const beforeReload = profile;
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await ready(page);
    assert.deepEqual(await save(page), beforeReload);
    check('Equipped the pulled item to Lyra and preserved full progress across reload');

    await click(page, '#topbar [data-page="settings"]');
    const downloaded = page.waitForEvent('download');
    await click(page, '[data-action="export"]');
    const download = await downloaded;
    const savePath = path.join(artifacts, `${name}-save.json`);
    await download.saveAs(savePath);
    const backup = JSON.parse(await readFile(savePath, 'utf8'));
    assert.deepEqual(backup.profile, await save(page));
    await page.locator('#import-file').setInputFiles(savePath);
    await page.waitForFunction(() => document.querySelector('#toast')?.textContent === 'นำเข้าเซฟสำเร็จ');
    assert.deepEqual(await save(page), beforeReload);
    await page.locator('#import-file').setInputFiles({ name: 'invalid-save.json', mimeType: 'application/json', buffer: Buffer.from('{"version":1,"gems":-999}') });
    await page.waitForFunction(() => document.querySelector('#toast')?.textContent?.includes('invalid'));
    assert.deepEqual(await save(page), beforeReload);
    check('Export/import roundtrip succeeded; invalid imported backup left progress unchanged');

    await click(page, '#nav [data-page="story"]');
    await click(page, '[data-action="startBattle"]');
    await page.locator('.party-hud').waitFor({ state: 'visible' });
    await verifyNoHorizontalOverflow(page, 'battle');
    await click(page, '[data-action="cast"][data-hero="kael"][data-slot="0"]');
    assert.ok(await page.locator('[data-action="cast"][data-hero="kael"][data-slot="0"] b').count() > 0, 'manual skill starts cooldown');
    await click(page, '[data-action="pause"]');
    await page.locator('.pause-layer').waitFor({ state: 'visible' });
    const healthWhilePaused = await page.locator('.party-hud').textContent();
    await page.waitForTimeout(750);
    assert.equal(await page.locator('.party-hud').textContent(), healthWhilePaused, 'paused HP, mana, cooldown display remains fixed');
    await click(page, '.pause-layer [data-action="pause"]');
    await click(page, '[data-action="auto"]');
    await click(page, '[data-action="speed"]');
    assert.equal(await page.locator('[data-action="auto"]').textContent(), 'AUTO ON');
    assert.equal(await page.locator('[data-action="speed"]').textContent(), '2×');
    await page.screenshot({ path: path.join(artifacts, `${name}-battle.png`) });
    check('Manual skill, cooldown, pause/resume, AUTO and2×controls work through touch UI');

    const started = Date.now();
    let lastLoggedWave = 0;
    while (Date.now() - started < 90000) {
      const snapshot = await page.evaluate(() => window.aetheriaDiagnostics());
      if (snapshot.battle.wave !== lastLoggedWave) {
        lastLoggedWave = snapshot.battle.wave;
        log(`${name}: combat reached wave${lastLoggedWave}/3`);
      }
      if (snapshot.battle.status !== 'fighting') break;
      await page.waitForTimeout(1000);
    }
    const battle = await page.evaluate(() => window.aetheriaDiagnostics().battle);
    assert.equal(battle.status, 'won', 'stage1 must be winnable with this real player setup');
    await page.locator('.battle-result.victory').waitFor({ state: 'visible' });
    assert.match(await page.locator('.new-companion').textContent(), /Seraphina/);
    await page.screenshot({ path: path.join(artifacts, `${name}-victory.png`) });
    profile = await save(page);
    assert.equal(profile.gems, 1220);
    assert.equal(profile.unlockedStage, 2);
    assert.ok(profile.ownedHeroes.includes('seraphina'));
    assert.equal(profile.party.length, 4);
    assert.deepEqual(profile.wins, [1]);
    const beforeFinish = profile;
    await click(page, '[data-action="finishBattle"]');
    assert.deepEqual(await save(page), beforeFinish, 'closing victory does not duplicate rewards');
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await ready(page);
    assert.deepEqual(await save(page), beforeFinish);
    check('Won all three waves, recruited Seraphina, unlocked chapter2 and persisted rewards exactly once');

    await click(page, '#nav [data-page="story"]');
    await click(page, '[data-action="startBattle"]');
    await click(page, '[data-action="pause"]');
    await click(page, '[data-action="abandonBattle"]');
    assert.equal(await page.evaluate(() => window.aetheriaDiagnostics().battle), null);
    await click(page, '#nav [data-page="heroes"]');
    await click(page, '.hero-tab[data-id="kael"]');
    const goldBeforeTraining = (await save(page)).gold;
    await click(page, '[data-action="upgrade"]');
    profile = await save(page);
    assert.equal(profile.heroLevels.kael, 2);
    assert.ok(profile.gold < goldBeforeTraining);
    check('Withdrew from a paused fight and immediately trained a hero at camp');

    assert.deepEqual(result.pageErrors, [], 'no unhandled browser exceptions');
    assert.deepEqual(result.requestsFailed.filter(request => !request.error?.includes('ERR_ABORTED')), [], 'no failed asset requests');
    result.status = 'passed';
    check('No unhandled JavaScript errors or failed asset downloads');
  } catch (error) {
    result.status = 'failed';
    result.error = String(error.stack || error);
    await page.screenshot({ path: path.join(artifacts, `${name}-failure.png`), fullPage: true }).catch(() => {});
    report.errors.push(`${name}: ${error.message}`);
    log(`${name}: FAILED: ${error.message}`);
  } finally {
    await context.close();
  }
}

try {
  if (!process.env.QA_VIEWPORT || process.env.QA_VIEWPORT === 'landscape') await flow('mobile-landscape', { width: 844, height: 390 });
  if (!process.env.QA_VIEWPORT || process.env.QA_VIEWPORT === 'portrait') await flow('mobile-portrait', { width: 390, height: 844 });
} finally {
  await browser.close();
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(artifacts, `report${process.env.QA_VIEWPORT ? `-${process.env.QA_VIEWPORT}` : ''}.json`), JSON.stringify(report, null, 2));
}
log(`Result: ${report.flows.filter(result => result.status === 'passed').length}/${report.flows.length} flows passed. Artifacts: ${artifacts}`);
if (report.errors.length) process.exitCode = 1;
