import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { captureAndroid } from './android-capture.mjs';
const root = path.resolve(import.meta.dirname, '..');
fs.mkdirSync(path.join(root, 'qa'), { recursive: true });
const androidChrome = process.argv.includes('--android-chrome'), android = process.argv.includes('--android');
const device = androidChrome || android;
const quality = process.env.MECHSCOPE_QUALITY || (android ? 'low' : 'balanced');
const prefix = android ? 'android-' : androidChrome ? 'android-chrome-' : '';
const browser = device ? await chromium.connectOverCDP(process.env.MECHSCOPE_CDP || `http://127.0.0.1:${android ? 9223 : 9224}`) : await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11'] });
const context = device ? browser.contexts()[0] : await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = device ? context.pages().find(p => android ? p.url().startsWith('https://appassets.androidplatform.net/assets/web/') : p.url().startsWith('http://127.0.0.1:5174')) : await context.newPage();
assert.ok(page, 'Only the MechScope page may be inspected');
const results = { platform: android ? 'Redmi Note 11 / native MechScope Android WebView' : androidChrome ? 'Redmi Note 11 / Android Chrome — not native APK or monetization validation' : 'Desktop Chrome GPU, mobile viewport — not Android performance', timestamp: new Date().toISOString(), models: [], checks: [], errors: [] };
page.on('pageerror', error => results.errors.push(error.message));
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
async function clearCanvas() {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const overlap = await page.evaluate(() => {
    const canvas = document.querySelector('#viewport canvas').getBoundingClientRect();
    return [...document.querySelectorAll('#workspace button, #workspace input')].filter(el => {
      if (!el.checkVisibility()) return false;
      const r = el.getBoundingClientRect();
      return Math.min(r.right, canvas.right) - Math.max(r.left, canvas.left) > 1 && Math.min(r.bottom, canvas.bottom) - Math.max(r.top, canvas.top) > 1;
    }).map(el => el.id || el.textContent);
  });
  assert.deepEqual(overlap, [], 'No playback, navigation or input overlaps the canvas');
  const legibility = await page.evaluate(() => {
    const selectors = '.machine-title .eyebrow,.timeline-label,.spec-row span,.mode-nav button,.lesson-main p,.lesson-fact,.sim-sliders label>span,.sim-sliders output';
    const small = [...document.querySelectorAll(selectors)].filter(el => el.checkVisibility() && parseFloat(getComputedStyle(el).fontSize) < 12).map(el => el.className || el.tagName);
    const canvas = document.querySelector('#viewport canvas'), r = canvas.getBoundingClientRect();
    return { small, pixels: canvas.width, expected: Math.floor(r.width * Math.min(devicePixelRatio, 3)) };
  });
  assert.deepEqual(legibility.small, [], 'Key labels and reading text must be at least 12 CSS pixels');
  assert.ok(Math.abs(legibility.pixels - legibility.expected) <= 1, 'Canvas must render at screen pixel density, not a blurred upscale');
  if (android) assert.ok(await page.locator('.mode-nav').evaluate(el => parseFloat(getComputedStyle(el).paddingBottom) <= 12), 'Native safe area must not add a second bottom gap');
  const summary = await page.evaluate(() => {
    const panel = document.querySelector('.panel-explore');
    if (!panel || !panel.checkVisibility() || !matchMedia('(max-width:700px) and (orientation:portrait)').matches) return null;
    const r = panel.getBoundingClientRect();
    return { height: r.height, clipped: [...panel.querySelectorAll('.spec-row span')].filter(el => el.checkVisibility() && el.scrollWidth > el.clientWidth + 1).map(el => el.textContent) };
  });
  if (summary) {
    assert.ok(summary.height <= 54, `Statistics must stay compact, not take the viewer space: ${summary.height}px`);
    assert.deepEqual(summary.clipped, [], 'Compact statistics labels remain fully readable');
  }
}
async function shot(name) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  const target = path.join(root, 'qa', `${prefix}${name}.png`);
  if (android) fs.writeFileSync(target, await captureAndroid(page));
  else await page.screenshot({ path: target, animations: 'disabled' });
}
async function canvasImage() { return android ? captureAndroid(page, true) : page.locator('#viewport canvas').screenshot(); }
async function instancePose() {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
  return page.evaluate(() => {
    const { scene, camera } = window.__mechscope.stage;
    const transforms = [], local = camera.matrixWorld.clone(), world = local.clone();
    scene.updateMatrixWorld(true);
    scene.traverse(object => {
      if (!object.isInstancedMesh || !object.count) return;
      const matrices = [];
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, local); world.multiplyMatrices(object.matrixWorld, local); world.toArray(matrices, i * 16);
      }
      transforms.push({ parts: object.userData.instanceParts.slice(0, object.count), matrices });
    });
    return transforms;
  });
}
try {
  await page.addInitScript(quality => { localStorage.setItem('mechscope.onboarded', '1'); localStorage.setItem('mechscope.preferences', JSON.stringify({ quality, theme: 'light', reduced: true })); }, quality);
  results.quality = quality;
  if (android) await page.reload({ waitUntil: 'networkidle' });
  else await page.goto(process.env.MECHSCOPE_URL || 'http://127.0.0.1:5174', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__mechscope, { timeout: 60000 });
  const catalog = await page.evaluate(() => window.__mechscope.catalog);
  assert.equal(catalog.length, 34, 'All thirty-four mechanisms are bundled offline');
  assert.equal(new Set(catalog.map(model => model.id)).size, 34, 'Collection entries are unique');
  const [first, second] = catalog;
  await page.locator('#next-mechanism').click();
  await page.waitForFunction(id => window.__mechscope.state.mechanismId === id && !window.__mechscope.state.switching, second.id, { timeout: 60000 });
  assert.equal((await page.locator('#machine-name').innerText()).trim(), second.title, 'Next steps forward one mechanism');
  await page.locator('#previous-mechanism').click();
  await page.waitForFunction(id => window.__mechscope.state.mechanismId === id && !window.__mechscope.state.switching, first.id, { timeout: 60000 });
  assert.equal((await page.locator('#machine-name').innerText()).trim(), first.title, 'Previous steps back one mechanism');
  await page.locator('#previous-mechanism').click();
  await page.waitForFunction(id => window.__mechscope.state.mechanismId === id && !window.__mechscope.state.switching, catalog.at(-1).id, { timeout: 60000 });
  await page.locator('#next-mechanism').click();
  await page.waitForFunction(id => window.__mechscope.state.mechanismId === id && !window.__mechscope.state.switching, first.id, { timeout: 60000 });
  results.checks.push('On-screen previous/next controls step through the collection and wrap around');
  await page.locator('#collection-switch').click();
  assert.equal(await page.locator('.collection-card').count(), 34, 'Every mechanism is reachable from the collection sheet');
  await page.locator('#close-sheet').click();
  for (const { id, title } of catalog) {
    await page.locator('#collection-switch').click();
    await page.locator(`[data-mechanism="${id}"]`).click();
    await page.waitForFunction(id => window.__mechscope.state.mechanismId === id && !window.__mechscope.state.switching, id, { timeout: 60000 });
    assert.equal((await page.locator('#machine-name').innerText()).trim(), title, 'Header names the active mechanism');
    assert.match(await page.locator('#machine-family').innerText(), /\/ 034$/, 'Header count matches the expanded collection');
    assert.equal(await page.locator('#viewport canvas').count(), 1, 'Only one live graphics canvas');
    await page.evaluate(() => { window.__mechscope.setPlaying(true); window.__mechscope.stage.view('home', true); });
    await page.waitForTimeout(1200);
    const first = await canvasImage();
    const timing = await page.evaluate(() => new Promise(resolve => {
      const samples = []; let before;
      function tick(t) { if (before) samples.push(t - before); before = t; if (samples.length < 120) requestAnimationFrame(tick); else { samples.sort((a,b) => a-b); resolve({ medianMs: samples[60], p95Ms: samples[114], maximumMs: samples.at(-1), averageMs: samples.reduce((sum, n) => sum + n, 0) / samples.length }); } }
      requestAnimationFrame(tick);
    }));
    const second = await canvasImage();
    assert.notEqual(hash(first), hash(second), `${title}: rendered model pixels actually change`);
    await page.evaluate(() => window.__mechscope.seek(.23));
    await page.waitForTimeout(100);
    const frozenTime = await page.evaluate(() => window.__mechscope.state.t);
    const frozenPose = await instancePose();
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => window.__mechscope.state.t), frozenTime, `${id}: pause freezes time`);
    assert.deepEqual(await instancePose(), frozenPose, `${id}: pause freezes actual instance transforms`);
    await page.locator('#step').click();
    await page.waitForTimeout(100);
    assert.notDeepEqual(await instancePose(), frozenPose, `${id}: single-step moves actual geometry`);
    await page.evaluate(() => window.__mechscope.seek(.23));
    await page.waitForTimeout(100);
    const model = { id, title, timing, diagnostics: await page.evaluate(() => window.__mechscope.diagnostics) };
    assert.ok(model.diagnostics.parts >= 35, `${id}: meaningful selectable anatomy`);
    assert.ok(model.diagnostics.triangles > 10000 && model.diagnostics.triangles <= 200000, `${id}: balanced triangle budget`);
    assert.ok(model.diagnostics.calls <= 250, `${id}: total render-call budget including shadow pass`);
    await clearCanvas(); await shot(`collection-${id}`);
    await page.locator('[data-mode="anatomy"]').click();
    for (const mode of ['xray', 'cutaway', 'solid']) {
      await page.locator(`[data-surface="${mode}"]`).click();
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.__mechscope.state.surface), mode);
      if (mode !== 'solid') await shot(`collection-${id}-${mode}`);
      await clearCanvas();
    }
    await page.locator('#browse-parts').click();
    assert.equal(await page.locator('.part-row').count(), model.diagnostics.parts);
    await page.locator('.part-row').first().click();
    assert.ok((await page.locator('.part-description').innerText()).length > 80);
    assert.ok((await page.locator('#part-live').innerText()).length > 5);
    await page.locator('#close-sheet').click();
    await page.locator('[data-mode="explode"]').click();
    await page.locator('#explode-range').evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.waitForFunction(() => window.__mechscope.state.explode === 1);
    assert.notDeepEqual(await instancePose(), frozenPose, `${id}: explosion changes the rendered transforms without changing quality`);
    await shot(`collection-${id}-exploded`); await clearCanvas();
    await page.locator('#assemble').click();
    await page.waitForFunction(() => window.__mechscope.state.explode === 0);
    const reassembled = await instancePose();
    assert.equal(reassembled.length, frozenPose.length);
    for (let i = 0; i < frozenPose.length; i++) {
      assert.deepEqual(reassembled[i].parts, frozenPose[i].parts);
      assert.equal(reassembled[i].matrices.length, frozenPose[i].matrices.length);
      assert.ok(reassembled[i].matrices.every((value, j) => Math.abs(value - frozenPose[i].matrices[j]) < 1e-5), `${id}: all rendered instances return to the assembled pose`);
    }
    await page.locator('[data-mode="simulate"]').click();
    const controls = page.locator('[data-input]');
    assert.ok(await controls.count() > 0);
    for (const control of await controls.all()) {
      await control.evaluate(el => { el.value = el.max; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.waitForTimeout(60);
      await control.evaluate(el => { el.value = el.min; el.dispatchEvent(new Event('input', { bubbles: true })); });
    }
    await clearCanvas();
    await page.locator('#sim-reset').click();
    await page.locator('[data-mode="learn"]').click();
    for (let i=0;i<5;i++) {
      assert.ok((await page.locator('.lesson-main').innerText()).length > 90);
      await clearCanvas();
      await page.locator('#next-lesson').click();
    }
    await page.locator('[data-mode="explore"]').click();
    results.models.push(model); console.log(`PASS ${title}: anatomy, actual motion, materials, explosion, inputs, lessons, single canvas`);
  }
  for (const viewport of device ? [] : [{width:360,height:640},{width:393,height:852},{width:852,height:393},{width:1280,height:900}]) {
    await page.setViewportSize(viewport); await page.waitForTimeout(150);
    for (const mode of ['explore','anatomy','explode','learn','simulate']) {
      await page.locator(`[data-mode="${mode}"]`).click(); await page.waitForTimeout(60); await clearCanvas();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight));
    }
    await page.locator('[data-mode="explore"]').click();
    await shot(`layout-${viewport.width}x${viewport.height}`);
    await page.locator('#focus-mode').click(); await page.waitForTimeout(120); await clearCanvas();
    assert.ok(await page.evaluate(() => document.querySelector('#viewport').clientHeight > innerHeight * .7));
    await page.locator('#focus-mode').click();
  }
  await page.evaluate(() => {
    const b = document.createElement('button'); b.id = 'qa-overlap-negative'; b.textContent = 'negative control'; b.style.cssText = 'position:absolute;top:20px;left:20px;width:100px;height:44px'; document.querySelector('#viewport').append(b);
  });
  await assert.rejects(clearCanvas, /overlaps the canvas/);
  await page.locator('#qa-overlap-negative').evaluate(el => el.remove());
  await clearCanvas(); results.checks.push('Unobstructed canvas, readable labels and screen-resolution rendering pass; intentionally overlapping button is rejected');
  if (android && quality === 'low') {
    results.performancePass = results.models.every(model => model.timing.medianMs <= 20 && model.timing.averageMs <= 25 && model.timing.p95Ms <= 35);
    assert.ok(results.performancePass, 'Native efficient profile must meet median 20 ms, mean 25 ms and p95 35 ms frame budgets');
  }
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.passed = false; results.failure = error.stack; process.exitCode = 1; console.error(error); await shot('collection-failure').catch(() => {});
} finally {
  fs.writeFileSync(path.join(root, 'qa', `${prefix}collection-results.json`), JSON.stringify(results, null, 2));
  await browser.close();
}
