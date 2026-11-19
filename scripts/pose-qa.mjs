import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { MECHANISMS } from '../src/catalog.js';

const selectedId = process.env.MECHSCOPE_MECHANISM;
const mechanisms = selectedId ? MECHANISMS.filter(model => model.id === selectedId) : MECHANISMS.slice(9);
assert.ok(mechanisms.length, `Unknown mechanism: ${selectedId}`);
const root = path.resolve(import.meta.dirname, '..');
fs.mkdirSync(path.join(root, 'qa'), { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--use-angle=d3d11'] });
const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
const page = await context.newPage();
const results = { timestamp: new Date().toISOString(), platform: 'Desktop Chrome / mobile viewport; not Android performance', models: [], errors: [] };
page.on('pageerror', error => results.errors.push(error.message));
const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(resolve)))));
async function projectedBounds() {
  return page.evaluate(() => {
    const { stage } = window.__mechscope;
    const p = stage.camera.position.clone(), matrix = stage.camera.matrixWorld.clone(), world = matrix.clone();
    const extent = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, vertices: 0, behind: 0 };
    stage.scene.updateMatrixWorld(true);
    stage.scene.traverseVisible(mesh => {
      if (!mesh.isInstancedMesh || !mesh.userData.instanceParts || !mesh.material.visible || mesh.material.opacity === 0) return;
      const positions = mesh.geometry.attributes.position;
      for (let instance = 0; instance < mesh.count; instance++) {
        mesh.getMatrixAt(instance, matrix); world.multiplyMatrices(mesh.matrixWorld, matrix);
        for (let vertex = 0; vertex < positions.count; vertex++) {
          p.fromBufferAttribute(positions, vertex).applyMatrix4(world).project(stage.camera);
          extent.minX = Math.min(extent.minX, p.x); extent.maxX = Math.max(extent.maxX, p.x);
          extent.minY = Math.min(extent.minY, p.y); extent.maxY = Math.max(extent.maxY, p.y);
          if (p.z < -1 || p.z > 1) extent.behind++;
          extent.vertices++;
        }
      }
    });
    return extent;
  });
}
function fits(extent) {
  assert.ok(extent.vertices > 0 && extent.behind === 0, 'Moving geometry is in front of the camera');
  assert.ok(extent.minX >= -1.02 && extent.maxX <= 1.02 && extent.minY >= -1.02 && extent.maxY <= 1.02, `Home view clips the moving model: ${JSON.stringify(extent)}`);
}
try {
  await page.addInitScript(() => {
    localStorage.setItem('mechscope.onboarded', '1');
    localStorage.setItem('mechscope.preferences', JSON.stringify({ quality: 'balanced', theme: 'light', reduced: true }));
  });
  await page.goto(process.env.MECHSCOPE_URL || 'http://127.0.0.1:5174', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__mechscope, { timeout: 60000 });
  for (const descriptor of mechanisms) {
    await page.evaluate(id => window.__mechscope.changeMechanism(id), descriptor.id);
    await page.evaluate(() => { window.__mechscope.seek(0); window.__mechscope.stage.view('home', true); });
    const record = { id: descriptor.id, scenarios: [] };
    results.models.push(record);
    for (const scenario of ['default', 'minimum', 'maximum']) {
      await page.locator('[data-mode="simulate"]').click();
      const inputs = { ...descriptor.defaultInputs };
      for (const control of descriptor.controls) {
        const value = scenario === 'minimum' ? control.min : scenario === 'maximum' ? control.max : descriptor.defaultInputs[control.key];
        inputs[control.key] = value;
        await page.locator(`[data-input="${control.key}"]`).evaluate((element, value) => { element.value = String(value); element.dispatchEvent(new Event('input', { bubbles: true })); }, value);
      }
      await page.locator('[data-mode="explore"]').click();
      await page.evaluate(() => window.__mechscope.stage.view('home', true));
      const poses = [];
      record.scenarios.push({ scenario, inputs, poses });
      for (let phase = 0; phase < 8; phase++) {
        await page.evaluate(t => window.__mechscope.seek(t), phase / (8 * descriptor.cycleHz(inputs)));
        await settle();
        const extent = await projectedBounds(); poses.push(extent); fits(extent);
        if (phase === 2 || phase === 6) await page.locator('#viewport').screenshot({ path: path.join(root, 'qa', `pose-${descriptor.id}-${scenario}-${phase}.png`) });
      }
    }
    console.log(`PASS ${descriptor.title}: 24 rendered poses fit the mobile home camera`);
  }
  await page.evaluate(() => { const { camera, controls } = window.__mechscope.stage; camera.position.lerp(controls.target, .95); camera.updateMatrixWorld(true); });
  results.negativeControl = await projectedBounds();
  assert.throws(() => fits(results.negativeControl), /Moving geometry|Home view clips/);
  await page.evaluate(() => window.__mechscope.stage.view('home', true));
  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  results.passed = false; results.failure = error.stack; process.exitCode = 1; console.error(error);
  await page.screenshot({ path: path.join(root, 'qa', 'pose-failure.png') }).catch(() => {});
} finally {
  fs.writeFileSync(path.join(root, 'qa', 'pose-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
