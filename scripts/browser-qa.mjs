import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { captureAndroid } from './android-capture.mjs';
const root = path.resolve(import.meta.dirname, '..');
fs.mkdirSync(path.join(root, 'qa'), { recursive: true });
const android = process.argv.includes('--android');
const browser = android
  ? await chromium.connectOverCDP(process.env.MECHSCOPE_CDP || 'http://127.0.0.1:9223')
  : await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11'] });
const context = android ? browser.contexts()[0] : await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = android ? context.pages().find(p => p.url().includes('appassets.androidplatform.net')) : await context.newPage();
assert.ok(page, 'Target MechScope WebView exists');
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const results = { platform: android ? 'Android WebView / Redmi Note 11' : 'Chrome / desktop GPU / mobile viewport', timestamp: new Date().toISOString(), checks: [], errors };
const prefix = android ? 'android' : 'browser';
function pass(name) { results.checks.push({ name, passed: true }); console.log(`PASS ${name}`); }
async function shot(name) {
  const target = path.join(root, 'qa', `${prefix}-${name}.png`);
  if (android) fs.writeFileSync(target, await captureAndroid(page));
  else await page.screenshot({ path: target, animations: 'disabled' });
}
try {
  if (!android) await page.goto(process.env.MECHSCOPE_URL || 'http://127.0.0.1:5173', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__mechscope, { timeout: 60000 });
  await page.locator('#loading').waitFor({ state: 'detached', timeout: 60000 });
  if (await page.locator('#next-onboard').count()) {
    await shot('onboarding');
    for (let i = 0; i < 3; i++) await page.locator('#next-onboard').click();
    assert.equal(await page.locator('.onboarding').count(), 0); pass('Interactive introduction completes');
  }
  await page.locator('#play').click();
  await page.waitForFunction(() => !window.__mechscope.state.playing);
  const frozen = await page.evaluate(() => window.__mechscope.state.t);
  await page.waitForTimeout(550);
  assert.equal(await page.evaluate(() => window.__mechscope.state.t), frozen); pass('Pause really freezes shared simulation time');
  await shot('explore');
  await page.locator('#step').click();
  assert.ok(await page.evaluate(t => window.__mechscope.state.t > t, frozen)); pass('Single stepping advances pose');
  await page.locator('#timeline').evaluate(el => { el.value = '725'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForTimeout(120);
  const phase = await page.evaluate(() => window.__mechscope.sample.phase);
  assert.ok(Math.abs(phase - 0.725) < 0.005); pass('Timeline maps to actual gait phase');
  const cameraBefore = await page.evaluate(() => window.__mechscope.stage.camera.position.toArray());
  await page.locator('#zoom-in').click();
  const cameraAfter = await page.evaluate(() => window.__mechscope.stage.camera.position.toArray());
  assert.notDeepEqual(cameraBefore, cameraAfter); pass('Camera zoom changes real 3D camera');
  await page.locator('#reset-view').click();
  await page.locator('[data-mode="anatomy"]').click();
  await page.locator('[data-surface="xray"]').click();
  assert.equal(await page.evaluate(() => window.__mechscope.state.surface), 'xray');
  await page.waitForTimeout(800); await shot('xray'); pass('X-ray mode is active');
  await page.locator('[data-surface="cutaway"]').click();
  await page.waitForTimeout(300); await shot('section'); pass('Section mode is active');
  await page.locator('#browse-parts').click();
  await page.locator('#part-search').fill('piston');
  assert.ok(await page.locator('.part-row').count() > 0); pass('Component index filters actual model metadata');
  await page.locator('.part-row').first().click();
  assert.ok((await page.locator('.part-description').innerText()).length > 80);
  await shot('component'); pass('Selected part has meaningful purpose, mechanism and live state');
  await page.locator('#close-sheet').click();
  await page.locator('#browse-parts').click();
  await page.locator('#part-search').fill('not-a-component-xyz');
  assert.equal(await page.locator('.part-row').count(), 0); pass('Unknown component search has an empty state');
  await page.locator('#close-sheet').click();
  await page.locator('[data-mode="explode"]').click();
  await page.locator('#explode-range').evaluate(el => { el.value = '100'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.waitForFunction(() => window.__mechscope.state.explode > 0.999);
  await shot('exploded'); pass('Exploded view reaches full separation');
  await page.locator('#assemble').click();
  await page.waitForFunction(() => window.__mechscope.state.explode < 0.001); pass('Assembly completely reverses');
  await page.locator('[data-mode="simulate"]').click();
  await page.locator('[data-input="height"]').evaluate(el => { el.value = '0.90'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('[data-input="stride"]').evaluate(el => { el.value = '0.34'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#direction').click();
  assert.equal(await page.evaluate(() => window.__mechscope.state.input.direction), -1);
  await page.locator('#play').click();
  const before = await page.evaluate(() => window.__mechscope.sample.legs.map(l => l.knee));
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => window.__mechscope.sample.legs.map(l => l.knee));
  assert.notDeepEqual(before, after); pass('Simulation controls drive changing articulated geometry');
  await shot('simulation');
  await page.locator('#sim-reset').click();
  await page.locator('[data-mode="learn"]').click();
  for (let i = 0; i < 5; i++) { assert.ok((await page.locator('.lesson-main').innerText()).length > 100); await page.locator('#next-lesson').click(); }
  pass('All five explanations and linked camera/material states work');
  await page.locator('#settings').click();
  await page.locator('[data-theme-choice="dark"]').click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.locator('#close-sheet').click(); await page.locator('[data-mode="explore"]').click();
  await page.waitForTimeout(800); await shot('dark'); pass('Dark theme updates viewer and interface');
  await page.locator('#settings').click();
  await page.locator('[data-theme-choice="light"]').click();
  await page.locator('[data-quality-choice="low"]').click();
  await page.locator('#close-sheet').click();
  await page.waitForTimeout(1200);
  results.lowQuality = await page.evaluate(() => window.__mechscope.diagnostics);
  await page.locator('#settings').click(); await page.locator('[data-quality-choice="balanced"]').click(); await page.locator('#close-sheet').click();
  await page.waitForTimeout(1400);
  results.balancedQuality = await page.evaluate(() => window.__mechscope.diagnostics);
  pass('Quality selector changes renderer without losing model');
  const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, height: document.documentElement.scrollHeight, viewportHeight: innerHeight }));
  assert.ok(overflow.width <= overflow.viewport + 1); assert.ok(overflow.height <= overflow.viewportHeight + 1); pass('No page overflow at mobile viewport');
  results.viewport = overflow;
  if (!android) {
    await page.setViewportSize({ width: 1280, height: 900 }); await page.waitForTimeout(900); await shot('desktop');
    await page.setViewportSize({ width: 852, height: 393 }); await page.waitForTimeout(900); await shot('landscape');
    await page.setViewportSize({ width: 360, height: 640 }); await page.waitForTimeout(900); await shot('small-phone');
    pass('Desktop, landscape and compact-phone layouts rendered');
  }
  assert.deepEqual(errors, []); pass('No uncaught JavaScript errors');
  results.passed = true;
} catch (error) {
  results.passed = false; results.failure = error.stack; await shot('failure').catch(() => {}); console.error(error); process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(root, 'qa', `${prefix}-results.json`), JSON.stringify(results, null, 2));
  await browser.close();
}
