import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import descriptor, { descriptor as namedDescriptor } from '../src/mechanisms/v8/index.js';
import { E, BANK, CYL, FIRE, ORDER, S_TDC, VALVE, piston, sample, cycleHz } from '../src/mechanisms/v8/kin.js';
import { createModel, DISPLAY_SCALE } from '../src/mechanisms/v8/model.js';
import { buildEngine } from '../src/mechanisms/v8/engine.js';

const near = (a, b, epsilon = 1e-8) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function submitted(model) {
  let triangles = 0, instances = 0, calls = 0;
  const geometries = new Set(), ids = new Set();
  model.group.traverseVisible(mesh => {
    if (!mesh.isMesh || !mesh.count) return;
    assert.ok(mesh.isInstancedMesh);
    assert.equal(mesh.userData.instanceParts.length, mesh.count);
    assert.ok(mesh.material.forceSinglePass);
    assert.ok(!mesh.material.transmission);
    instances += mesh.count; calls++;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * mesh.count;
    geometries.add(mesh.geometry);
    mesh.userData.instanceParts.forEach(id => ids.add(id));
  });
  return { triangles, instances, drawCallsEstimate: calls, geometries: geometries.size, visibleParts: ids.size };
}
function poseSnapshot(model) {
  return model.pickables.filter(m => m.visible && m.count).map(m => ({
    ids: [...m.userData.instanceParts],
    matrices: [...m.instanceMatrix.array.slice(0, m.count * 16)],
    world: [...m.matrixWorld.elements],
  }));
}
// Box3.setFromObject is conservative for InstancedMesh even with precise=true.
// Measure actual transformed vertices for normalization/floor assertions instead.
function exactBounds(model) {
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  const instance = new THREE.Matrix4(), matrix = new THREE.Matrix4();
  model.group.updateWorldMatrix(true, true);
  model.group.traverseVisible(mesh => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position;
    for (let n = 0; n < mesh.count; n++) {
      mesh.getMatrixAt(n, instance); matrix.multiplyMatrices(mesh.matrixWorld, instance);
      for (let i = 0; i < positions.count; i++) bounds.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(matrix));
    }
  });
  return bounds;
}

test('V8 descriptor and sampler provide the common contract', async () => {
  assert.equal(descriptor, namedDescriptor);
  assert.equal(descriptor.id, 'crossplane-v8');
  assert.equal(descriptor.title, 'IGNIS V8');
  assert.equal(descriptor.collection, '002');
  assert.equal(descriptor.lessons.length, 5);
  assert.deepEqual(descriptor.controls[0], { key: 'rpm', label: 'Crank speed', min: 6, max: 120, step: 1, unit: 'rpm', precision: 0 });
  for (const lesson of descriptor.lessons) {
    for (const key of ['title', 'short', 'text', 'fact', 'view', 'mode']) assert.equal(typeof lesson[key], 'string');
    assert.ok(lesson.explode >= 0 && lesson.explode <= 1);
  }
  for (const rpm of [6, 30, 120]) for (const t of [-123.4, 0, 0.1, 99]) {
    const s = descriptor.sample(t, { rpm });
    near(cycleHz({ rpm }), rpm / 120);
    near(s.driveAngle, t * rpm * Math.PI / 30);
    near(s.metrics.camRpm, rpm / 2);
    near(s.metrics.cycleSeconds, 120 / rpm);
    assert.ok(s.phase >= 0 && s.phase < 1);
    assert.equal(s.cylinders.length, 8);
    assert.ok(Object.values(s.metrics).every(Number.isFinite));
  }
  const m = await descriptor.createModel();
  assert.deepEqual(Object.keys(m).sort(), ['dispose', 'group', 'parts', 'pickables', 'stats', 'update']);
  m.dispose();
});

test('all eight exact slider-cranks retain rod length, stroke, firing phase and periodicity', () => {
  for (let angle = -720; angle <= 1440; angle += 2) {
    const s = sample(angle / 180);
    CYL.forEach((cy, i) => {
      const p = piston(i, angle), c = s.cylinders[i], B = BANK[cy.bank];
      near(Math.hypot(p.P[0] - p.pin[0], p.P[1] - p.pin[1]), E.rod);
      near(p.pin[0] * B.b[1] - p.pin[1] * B.b[0], 0);
      assert.ok(c.displacementMm >= -1e-9 && c.displacementMm <= 89 + 1e-9);
      for (const lift of [c.intakeLiftMm, c.exhaustLiftMm]) assert.ok(lift >= 0 && lift <= VALVE.lift);
      near(c.displacementMm, S_TDC - p.s);
      near(piston(i, angle + 720).s, p.s);
    });
  }
  ORDER.forEach((c, i) => {
    near(FIRE[c], i * 90);
    near(piston(c - 1, FIRE[c]).s, S_TDC);
    const state = sample(FIRE[c] / 180);
    assert.equal(state.metrics.lastFiredCylinder, c);
    assert.equal(state.cylinders[c - 1].stroke, 'POWER');
    assert.ok(state.cylinders[c - 1].firing);
  });
  const a = sample(1.234), b = sample(1.234 + 4);
  a.cylinders.forEach((c, i) => near(c.displacementMm, b.cylinders[i].displacementMm));
});

test('original live rig follows sampled pins, valve lift and the completed gear ratios', () => {
  const rig = buildEngine({ quality: 'low' });
  try {
    for (const angle of [0, 17, 90, 260, 460, 719, 1080]) {
      rig.update(angle, { arrows: 0 });
      const s = sample(angle / 180);
      rig.cyl.forEach((c, i) => {
        const p = piston(i, angle);
        near(rig.pist[i].g.position.y, p.s);
        near(rig.pist[i].beam.scale.y + 30, E.rod);
        near(rig.pist[i].big.position.y, -E.rod / 2);
        near(rig.pist[i].small.position.y, E.rod / 2);
        c.valves.forEach(v => {
          const lift = v.kind === 'in' ? s.cylinders[i].intakeLiftMm : s.cylinders[i].exhaustLiftMm;
          near(v.vg.position.y, -lift);
          near(v.spring.scale.y, (48 - lift) / 48);
        });
        near(c.charge.scale.y, E.deck - p.s - E.comp);
      });
      near(rig.camGears[0].rotation.z, -angle * Math.PI / 360);
      near(rig.idlers[0].gg.rotation.z, angle * Math.PI / 180 * 24 / 80);
      near(rig.flywheel.rotation.z, -angle * Math.PI / 180);
      rig.idlers.forEach(({ gg }, i) => {
        near(Math.hypot(gg.position.x, gg.position.y), 156);
        near(Math.hypot(gg.position.x - rig.camGears[i].position.x, gg.position.y - rig.camGears[i].position.y), 192);
      });
    }
  } finally {
    const geometries = new Set(), materials = new Set(rig.materials);
    rig.root.traverse(m => { if (m.isMesh) { geometries.add(m.geometry); materials.add(m.material); } });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
  }
});

test('complete selectable anatomy, accurate dynamic budgets and reversible quality/mode changes', () => {
  const m = createModel();
  try {
    assert.ok(m.parts.length >= 40);
    const ids = new Set(m.parts.map(p => p.id));
    assert.equal(ids.size, m.parts.length);
    for (const p of m.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[key] === 'string' && p[key].length);
    for (const quality of ['low', 'balanced', 'high', 'balanced']) for (const mode of ['solid', 'xray', 'cutaway']) {
      m.update(sample(1.23), { quality, mode, explode: 0, selectedId: 'cylinder.1.piston' });
      const actual = submitted(m);
      for (const [key, value] of Object.entries(actual)) assert.equal(m.stats[key], value);
      if (quality === 'balanced') { assert.ok(actual.triangles <= 200000); assert.ok(actual.drawCallsEstimate <= 180); }
      for (const mesh of m.pickables) {
        for (const id of mesh.userData.instanceParts) assert.ok(ids.has(id));
        assert.equal(!!mesh.material.clippingPlanes?.length, mode === 'cutaway');
      }
    }
    for (const part of m.parts) {
      m.update(sample(1.23), { selectedId: part.id, mode: 'xray', quality: 'balanced', explode: 0 });
      assert.ok(m.stats.drawCallsEstimate <= 180);
      assert.ok(m.stats.triangles <= 200000);
    }
    m.update(sample(1.23), { selectedId: null, mode: 'solid', quality: 'balanced', explode: 0 });
    const snapshot = poseSnapshot(m), stats = { ...m.stats };
    m.update(sample(9.87), { explode: 1, mode: 'xray' });
    assert.ok(m.stats.instances < stats.instances); // Eight live charge columns hidden during separation.
    m.update(sample(1.23), { explode: 0, mode: 'solid' });
    assert.deepEqual(poseSnapshot(m), snapshot);
    assert.deepEqual(m.stats, stats);
  } finally { m.dispose(); }
});

test('selection is isolated, pickable and respects the source section plane', () => {
  const m = createModel();
  try {
    m.update(sample(0.11), { mode: 'xray' });
    const baseline = new Map(m.pickables.map(mesh => [mesh.material, mesh.material.color.getHex()]));
    m.update(sample(0.11), { selectedId: 'cylinder.1.piston' });
    for (const [material, color] of baseline) assert.equal(material.color.getHex(), color);
    const selected = m.pickables.find(mesh => mesh.visible && mesh.name === 'V8 isolated selection');
    assert.ok(selected && selected.userData.instanceParts.includes('cylinder.1.piston'));
    const matrix = new THREE.Matrix4(), centre = new THREE.Vector3();
    selected.getMatrixAt(0, matrix); matrix.premultiply(selected.matrixWorld); centre.setFromMatrixPosition(matrix);
    const ray = new THREE.Raycaster(centre.clone().add(new THREE.Vector3(0, 0, 3)), new THREE.Vector3(0, 0, -1));
    const hits = ray.intersectObject(selected);
    assert.ok(hits.length);
    assert.equal(hits[0].object.userData.instanceParts[hits[0].instanceId], 'cylinder.1.piston');
    m.group.position.set(0.2, 0.3, -0.1); m.group.rotation.y = 0.4;
    m.update(sample(0.11), { mode: 'cutaway' });
    const clip = selected.material.clippingPlanes[0];
    const expected = new THREE.Vector3(0, 0, 0.179).applyMatrix4(m.group.children[0].matrixWorld);
    near(clip.distanceToPoint(expected), 0);
    m.update(undefined, { highlight: false });
    assert.ok(m.pickables.filter(mesh => mesh.name === 'V8 isolated selection').every(mesh => mesh.count === 0));
  } finally { m.dispose(); }
});

test('actual geometry is grounded and fits the entire normalized exploded envelope', () => {
  const m = createModel();
  try {
    for (const explode of [0, 0.25, 0.5, 0.75, 1]) {
      m.update(sample(1.23), { explode });
      const bounds = exactBounds(m), size = bounds.getSize(new THREE.Vector3());
      assert.ok(bounds.min.y >= -1e-6);
      assert.ok(bounds.min.y < 0.001);
      assert.ok(size.x <= 2.8 && size.z <= 2.8 && bounds.max.y <= 2);
    }
    // A rendered piston centre reconciles with the pure solver, including display normalization.
    m.update(sample(1.23), { explode: 0 });
    const mesh = m.pickables.find(mesh => mesh.userData.instanceParts.includes('cylinder.1.piston'));
    const index = mesh.userData.instanceParts.indexOf('cylinder.1.piston');
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
    near(matrix.elements[12], (piston(0, 1.23 * 180).s - 1) * BANK.L.b[0] * 0.001, 1e-7);
    near(m.group.children[0].scale.x, DISPLAY_SCALE);
  } finally { m.dispose(); }
});

test('dispose releases rendered resources once and future updates are harmless', () => {
  const m = createModel();
  m.update(sample(0.2), { selectedId: 'cylinder.1.piston' });
  const geometries = new Set(), materials = new Set();
  m.group.traverse(mesh => { if (mesh.isMesh) { geometries.add(mesh.geometry); materials.add(mesh.material); } });
  const counts = new Map();
  for (const r of [...geometries, ...materials]) { counts.set(r, 0); r.addEventListener('dispose', () => counts.set(r, counts.get(r) + 1)); }
  m.dispose(); m.dispose(); m.update(sample(20));
  assert.equal(m.group.children.length, 0);
  assert.equal(m.pickables.length, 0);
  assert.equal(m.stats.triangles, 0);
  for (const count of counts.values()) assert.equal(count, 1);
});

test('real WebGL main-pass budgets, modes and picking', { skip: !process.env.V8_RENDER_TEST, timeout: 120000 }, async () => {
  const { chromium } = await import('@playwright/test');
  const { createServer } = await import('node:http');
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const { resolve, sep } = await import('node:path');
  const root = fileURLToPath(new URL('..', import.meta.url));
  const html = `<!doctype html><html><body style="margin:0;background:#eef0ec"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js"}}</script><script type="module">
    import * as T from 'three';
    import { RoomEnvironment } from '/node_modules/three/examples/jsm/environments/RoomEnvironment.js';
    import descriptor from '/src/mechanisms/v8/index.js';
    const model = await descriptor.createModel();
    const renderer = new T.WebGLRenderer({antialias:true}); renderer.setSize(900,700); renderer.setPixelRatio(1);
    renderer.localClippingEnabled = true; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.18;
    document.body.append(renderer.domElement);
    const scene = new T.Scene(); scene.background = new T.Color('#eef0ec'); scene.add(model.group);
    const pmrem = new T.PMREMGenerator(renderer), room = new RoomEnvironment(), env = pmrem.fromScene(room,0.045);
    scene.environment = env.texture; scene.environmentIntensity = 0.78; room.dispose(); pmrem.dispose();
    scene.add(new T.HemisphereLight(0xffffff,0x8a9891,1.25));
    const key = new T.DirectionalLight(0xfff2dc,3.5); key.position.set(-3.5,6,4); scene.add(key);
    const rim = new T.DirectionalLight(0xc6e7f4,3.2); rim.position.set(4,3.2,-4); scene.add(rim);
    const camera = new T.PerspectiveCamera(35,900/700,0.035,40);
    camera.position.set(2.4,1.8,3); camera.lookAt(0,0.6,0);
    window.check = (options={}) => { model.update(descriptor.sample(0.11),options); renderer.render(scene,camera); return {stats:{...model.stats}, calls:renderer.info.render.calls, triangles:renderer.info.render.triangles, geometries:renderer.info.memory.geometries}; };
    window.pick = () => { const ray = new T.Raycaster(); const ids = new Set(); for(let y=-0.5;y<=0.5;y+=0.1) for(let x=-0.5;x<=0.5;x+=0.1) {ray.setFromCamera(new T.Vector2(x,y),camera); for(const hit of ray.intersectObjects(model.pickables)) { const material=hit.object.material; if(material.clippingPlanes?.some(p=>p.distanceToPoint(hit.point)<0) || material.transparent&&material.opacity<0.2) continue; ids.add(hit.object.userData.instanceParts[hit.instanceId]); break; }} return [...ids]; };
    window.finish = () => { model.dispose(); env.dispose(); renderer.dispose(); };
    window.check(); window.ready = true;
  </script></body></html>`;
  const server = createServer(async (request, response) => {
    try {
      if (request.url === '/') { response.setHeader('Content-Type', 'text/html'); response.end(html); return; }
      if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
      const path = resolve(root, `.${decodeURIComponent(new URL(request.url, 'http://localhost').pathname)}`);
      if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) { response.writeHead(403); response.end(); return; }
      response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile(path));
    } catch { response.writeHead(404); response.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.V8_BROWSER_CHANNEL || undefined, args: ['--use-angle=swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text()); });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForFunction(() => window.ready, { timeout: 60000 });
    for (const options of [
      { quality: 'balanced', mode: 'solid', explode: 0 },
      { mode: 'xray', selectedId: 'cylinder.1.piston' },
      { mode: 'cutaway' },
      { mode: 'solid', explode: 1, selectedId: null },
      { quality: 'low', mode: 'xray', explode: 0 },
      { quality: 'high', mode: 'solid' },
      { quality: 'balanced', mode: 'xray', selectedId: null },
    ]) {
      const result = await page.evaluate(options => window.check(options), options);
      assert.equal(result.calls, result.stats.drawCallsEstimate);
      assert.equal(result.triangles, result.stats.triangles);
      console.log('V8 WebGL', JSON.stringify({ options, ...result }));
    }
    assert.ok((await page.evaluate(() => window.pick())).length > 5);
    if (process.env.V8_SCREENSHOT) {
      for (const mode of ['solid', 'xray', 'cutaway']) {
        await page.evaluate(mode => window.check({ mode }), mode);
        await page.screenshot({ path: process.env.V8_SCREENSHOT.replace(/\.png$/, '') + `-${mode}.png` });
      }
    }
    await page.evaluate(() => window.finish());
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
