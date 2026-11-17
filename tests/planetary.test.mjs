import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import descriptor from '../src/mechanisms/planetary/index.js';
import { P, TAU, DEFAULT_INPUTS, cycleHz, pose, sample } from '../src/mechanisms/planetary/kin.js';
import { createModel } from '../src/mechanisms/planetary/model.js';

const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
const vectorNear = (a, b, e = 1e-7) => a.forEach((n, i) => near(n, b[i], e));
const using = fn => { const m = createModel(); try { return fn(m); } finally { m.dispose(); } };
function entries(m, id) {
  const out = [];
  for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) if (!id || mesh.userData.instanceParts[i] === id) {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    out.push({ mesh, index: i, matrix, id: mesh.userData.instanceParts[i] });
  }
  return out;
}
const centre = e => new THREE.Vector3().setFromMatrixPosition(e.matrix);
const dimensions = e => [0, 1, 2].map(c => new THREE.Vector3().setFromMatrixColumn(e.matrix, c).length());
const cylinderEnd = (e, sign) => new THREE.Vector3(0, sign * .5, 0).applyMatrix4(e.matrix);
function boundsFrom(items) {
  const b = new THREE.Box3(), point = new THREE.Vector3();
  for (const e of items) { const p = e.mesh.geometry.attributes.position; for (let i = 0; i < p.count; i++) b.expandByPoint(point.fromBufferAttribute(p, i).applyMatrix4(e.matrix)); }
  return b;
}
function pointsFrom(items) {
  const out = [];
  for (const e of items) { const p = e.mesh.geometry.attributes.position; for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(e.matrix)); }
  return out;
}
const snapshot = m => m.pickables.map(mesh => [mesh.count, [...mesh.userData.instanceParts], ...mesh.instanceMatrix.array.slice(0, mesh.count * 16)]);
function recursiveNear(a, b, e = 1e-7) { if (typeof a === 'number') near(a, b, e); else if (a && typeof a === 'object') { assert.deepEqual(Object.keys(a), Object.keys(b)); for (const k of Object.keys(a)) recursiveNear(a[k], b[k], e); } else assert.equal(a, b); }
function freeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; }
function gearPose(m, id) {
  const teeth = entries(m, id).filter(e => e.mesh.geometry.type === 'BoxGeometry' && Math.abs(dimensions(e)[0] - .036) < 1e-6);
  assert.equal(teeth.length, 24);
  const c = teeth.reduce((sum, e) => sum.add(centre(e)), new THREE.Vector3()).divideScalar(24);
  const v = centre(teeth[0]).sub(c);
  teeth.forEach(e => near(centre(e).distanceTo(c), .18, 1e-7));
  return { centre: c, angle: Math.atan2(v.y, v.x) };
}
function assertContactPhases(sun, planets, ringAngle, carrierAngle) {
  for (let i = 0; i < 3; i++) {
    const beta = carrierAngle + i * TAU / 3;
    // At each nominal pitch contact a tooth centre faces a half-pitch gap.
    near(Math.cos(24 * (sun + planets[i] - 2 * beta)), -1, 1e-7);
    near(Math.sin(24 * (sun + planets[i] - 2 * beta)), 0, 3e-5);
    near(Math.cos(72 * (beta - ringAngle) - 24 * (beta - planets[i])), -1, 1e-7);
    near(Math.sin(72 * (beta - ringAngle) - 24 * (beta - planets[i])), 0, 3e-5);
  }
}
function carrierClearance(m) {
  const all = entries(m), carriers = all.filter(e => /^carrier\.(front|rear)\./.test(e.id));
  const gears = all.filter(e => e.id.startsWith('gear.'));
  const gearBox = boundsFrom(gears);
  for (const side of ['front', 'rear']) {
    const b = boundsFrom(carriers.filter(e => e.id.startsWith(`carrier.${side}.`)));
    const gap = side === 'front' ? b.min.z - gearBox.max.z : gearBox.min.z - b.max.z;
    assert.ok(gap > .045, `${side} carrier/gear lane overlap: ${gap}`);
  }
  let outer = 0, inner = Infinity;
  for (const v of pointsFrom(carriers)) outer = Math.max(outer, Math.hypot(v.x, v.y - P.centreY));
  // For each actual rim instance, a circumscribed XY radius supplies a conservative
  // lower bound for every face, not only the distances of its sampled vertices.
  for (const e of all.filter(e => e.id.startsWith('ring.sector.'))) {
    const c = centre(e); let radius = 0;
    for (const v of pointsFrom([e])) radius = Math.max(radius, Math.hypot(v.x - c.x, v.y - c.y));
    inner = Math.min(inner, Math.hypot(c.x, c.y - P.centreY) - radius);
  }
  assert.ok(inner - outer > .10, `Carrier/rim swept envelope overlap: ${inner - outer}`);
  return { radial: inner - outer, gearFront: gearBox.max.z };
}

test('ORBIT descriptor, exact Willis ratio, periodic finite sample and immutable inputs', async () => {
  assert.equal(descriptor.id, 'planetary'); assert.equal(descriptor.title, 'ORBIT P3'); assert.equal(descriptor.collection, '017');
  assert.ok(descriptor.description.length > 100); assert.equal(descriptor.lessons.length, 5);
  assert.equal(descriptor.specs.length, 2); descriptor.specs.forEach(s => assert.ok(s.label.length <= 12));
  assert.deepEqual(descriptor.controls.map(c => c.key), ['cadence', 'sleeve']);
  for (const c of descriptor.controls) for (const key of ['key', 'label', 'min', 'max', 'step', 'unit', 'precision']) assert.ok(key in c);
  for (const l of descriptor.lessons) {
    assert.ok(l.title && l.short && l.text.length >= 180 && l.fact.length >= 35);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view));
    assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  assert.ok(Object.isFrozen(DEFAULT_INPUTS));
  for (const cadence of [.03, .10, .25]) for (const sleeve of [0, .35, 1]) for (const t of [-307.43, -.7, 0, .41, 352.31]) {
    const input = freeze({ cadence, sleeve }), s = sample(t, input), copy = structuredClone(s);
    near(cycleHz(input), cadence); assert.ok(s.phase >= 0 && s.phase < 1);
    assert.ok(Object.values(s.metrics).every(Number.isFinite));
    assert.equal(s.metrics.willisResidual, 0); assert.equal(s.metrics.reduction, 4);
    near(24 * (s.sunAngle - s.carrierAngle) + 72 * (s.ringAngle - s.carrierAngle), 0, 1e-10);
    recursiveNear(s, sample(t + 1 / cadence, input)); sample(-29, input); assert.deepEqual(sample(t, input), copy);
  }
  for (const t of [-Number.MAX_VALUE, Number.MAX_VALUE, NaN, Infinity]) assert.ok(!JSON.stringify(sample(t)).includes('null'));
  assert.deepEqual(sample(NaN, { cadence: Infinity, sleeve: NaN }), sample(0));
  const state = freeze(sample(.93)); using(m => { m.update(state, { explode: .6 }); assert.deepEqual(state, sample(.93)); });
  const m = await descriptor.createModel(); assert.deepEqual(Object.keys(m).sort(), ['dispose', 'group', 'parts', 'pickables', 'stats', 'update']); m.dispose();
});

test('absolute gear ratios and all nominal pitch phases close across the full orbit', () => {
  for (const cadence of [.03, .25]) for (const sleeve of [0, 1]) for (let i = 0; i < 720; i++) {
    const s = sample(i / (720 * cadence), { cadence, sleeve });
    near(s.sunAngle, 4 * s.carrierAngle); near(s.ringAngle, 0);
    for (const p of s.planets) {
      near(p.angle + Math.PI / 24, -2 * s.carrierAngle);
      near(Math.hypot(p.centre[0], p.centre[1] - P.centreY), .36);
      near(p.centre[2], 0);
    }
    assertContactPhases(s.sunAngle, s.planets.map(p => p.angle), 0, s.carrierAngle);
  }
  assert.notDeepEqual(sample(.5), sample(.8));
  assert.notEqual(pose(.2, 0).sleeveZ, pose(.2, 1).sleeveZ);
  assert.deepEqual(pose(.2, 0).planets, pose(.2, 1).planets, 'Service sleeve must not break the gear ratios');
});

test('actual rendered gear centres and tooth phases agree, and pins engage both real carriers', () => using(m => {
  for (const sleeve of [0, 1]) for (let k = 0; k < 96; k++) {
    const s = pose(k / 96, sleeve); m.update(s, { explode: 0, quality: 'balanced' });
    const sun = gearPose(m, 'gear.sun'), planets = [0, 1, 2].map(i => gearPose(m, `gear.planet.${i}`));
    vectorNear(sun.centre.toArray(), [0, P.centreY, 0]);
    near(Math.cos(sun.angle - s.sunAngle), 1);
    planets.forEach((p, i) => {
      vectorNear(p.centre.toArray(), s.planets[i].centre); near(Math.cos(p.angle - s.planets[i].angle), 1);
      const pin = entries(m, `planet.pin.${i}`).find(e => Math.abs(dimensions(e)[1] - .334) < 1e-6);
      vectorNear(centre(pin).toArray(), s.planets[i].centre);
      const z = [cylinderEnd(pin, -1).z, cylinderEnd(pin, 1).z].sort((a, b) => a - b);
      assert.ok(z[0] < -.15 && z[1] > .15);
      for (const side of ['front', 'rear']) {
        const boss = entries(m, `carrier.${side}.${i}`).find(e => e.mesh.geometry.type === 'TorusGeometry');
        vectorNear(centre(boss).toArray().slice(0, 2), p.centre.toArray().slice(0, 2));
        near(centre(boss).z, side === 'front' ? .135 : -.135);
        // Last physical spoke cylinder reaches the very same pin centre.
        const segments = entries(m, `carrier.${side}.${i}`).filter(e => e.mesh.geometry.type === 'CylinderGeometry' && Math.abs(dimensions(e)[0] - .016) < 1e-6);
        assert.equal(segments.length, 16);
        vectorNear(cylinderEnd(segments[15], 1).toArray(), centre(boss).toArray());
      }
    });
    const tooth = entries(m, 'ring.sector.0').find(e => e.mesh.geometry.type === 'BoxGeometry' && Math.abs(dimensions(e)[0] - .041) < 1e-6);
    near(Math.atan2(centre(tooth).y - P.centreY, centre(tooth).x), 0);
    assertContactPhases(sun.angle, planets.map(p => p.angle), 0, s.carrierAngle);
  }
}));

test('inward ring teeth remain open; actual sleeve geometry stays keyed at both travel limits', () => using(m => {
  const all = entries(m), ringItems = all.filter(e => e.id.startsWith('ring.sector.'));
  const teeth = ringItems.filter(e => e.mesh.geometry.type === 'BoxGeometry' && Math.abs(dimensions(e)[0] - .041) < 1e-6);
  assert.equal(teeth.length, 72);
  for (const e of teeth) {
    const c = centre(e); near(Math.hypot(c.x, c.y - P.centreY), .5415, 1e-7);
    const localIn = new THREE.Vector3(-.5, 0, 0).applyMatrix4(e.matrix), localOut = new THREE.Vector3(.5, 0, 0).applyMatrix4(e.matrix);
    near(Math.hypot(localIn.x, localIn.y - P.centreY), .521, 1e-7);
    assert.ok(Math.hypot(localOut.x, localOut.y - P.centreY) > .56);
  }
  assert.ok(ringItems.every(e => e.mesh.geometry.type !== 'CylinderGeometry' || dimensions(e)[0] < .02), 'No filled ring disk');
  for (const sleeve of [0, .5, 1]) for (const phase of [0, .31, .72]) {
    const s = pose(phase, sleeve); m.update(s);
    const shaft = entries(m, 'shaft.output').filter(e => e.mesh.geometry.type === 'BoxGeometry');
    const keys = entries(m, 'output.sleeve').filter(e => e.mesh.geometry.type === 'BoxGeometry' && Math.abs(dimensions(e)[0] - .014) < 1e-6);
    assert.equal(shaft.length, 12); assert.equal(keys.length, 12);
    const shaftBox = boundsFrom(shaft), keyBox = boundsFrom(keys);
    assert.ok(Math.min(shaftBox.max.z, keyBox.max.z) - Math.max(shaftBox.min.z, keyBox.min.z) > .069);
    const a = centre(shaft[0]), b = centre(keys[0]);
    near(Math.cos(Math.atan2(b.y - P.centreY, b.x) - Math.atan2(a.y - P.centreY, a.x)), Math.cos(Math.PI / 12), 1e-6);
    near(m.group.getObjectByName('output.fork').position.z, s.sleeveZ);
    near(m.group.getObjectByName('output.sleeve').position.z, s.sleeveZ);
    near(m.group.getObjectByName('output.fork').rotation.z, 0);
  }
}));

test('actual carrier sweep clears gear faces and rim; rendered lane corruption is rejected', t => using(m => {
  let radial = Infinity;
  for (let i = 0; i < 120; i++) { m.update(pose(i / 120, i % 2)); radial = Math.min(radial, carrierClearance(m).radial); }
  t.diagnostic(`minimum conservative actual carrier/rim radial gap: ${radial.toFixed(6)} m; conceptual box-tooth interference intentionally not tested`);
  m.update(pose(0));
  for (const e of entries(m, 'carrier.front.0')) { e.matrix.elements[14] -= .135; e.mesh.setMatrixAt(e.index, e.matrix); }
  assert.throws(() => carrierClearance(m), /lane overlap/, 'Negative control must place the real carrier into the gear-face lane');
  m.update(pose(0)); carrierClearance(m);
}));

test('submitted vertices stay grounded inside the 2.3 m envelope in both qualities and explosion extremes', () => using(m => {
  for (const quality of ['low', 'balanced']) for (const explode of [0, .5, 1]) for (const phase of [0, .19, .43, .73]) {
    m.update(pose(phase, 1), { quality, explode });
    const b = boundsFrom(entries(m)), size = b.getSize(new THREE.Vector3());
    near(b.min.y, 0, 1e-7); assert.ok(b.max.y <= 2.3 && size.x <= 2.3 && size.z <= 2.3);
    vectorNear(m.group.position.toArray(), [0, 0, 0]); vectorNear(m.group.scale.toArray(), [1, 1, 1]);
    assert.ok(entries(m).every(e => e.matrix.determinant() > 0));
  }
}));

test('metadata, actual stats, rendering modes, selection and exact explosion reversal', t => using(m => {
  const ids = new Set(m.parts.map(p => p.id)), names = new Set(m.parts.map(p => p.name));
  assert.equal(ids.size, m.parts.length); assert.equal(names.size, m.parts.length);
  assert.ok(m.parts.length >= 90 && m.parts.length <= 200);
  for (const p of m.parts) for (const k of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[k] === 'string' && p[k].length);
  for (const quality of ['low', 'balanced']) for (const mode of ['solid', 'xray', 'cutaway']) {
    m.update(pose(.23), { quality, mode, explode: 0 });
    const seen = new Set(), counts = { instances: 0, triangles: 0, drawCalls: 0, selectableParts: m.parts.length };
    for (const mesh of m.pickables) {
      assert.equal(mesh.userData.instanceParts.length, mesh.count); mesh.userData.instanceParts.forEach(id => { assert.ok(ids.has(id)); seen.add(id); });
      counts.instances += mesh.count; counts.triangles += mesh.count * (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      if (mesh.count) counts.drawCalls++;
      assert.equal(!!mesh.material.clippingPlanes?.length, mode === 'cutaway');
      const shell = mesh.material.color.getHex() === 0xced5cf;
      assert.equal(mesh.material.transparent, mode === 'xray' && shell); near(mesh.material.opacity, mode === 'xray' && shell ? .13 : 1);
    }
    assert.deepEqual(seen, ids); assert.deepEqual(m.stats, counts); assert.ok(counts.drawCalls <= 32);
    assert.ok(counts.triangles <= (quality === 'low' ? 80000 : 135000));
    if (quality === 'balanced') assert.ok(counts.instances >= 1000 && counts.instances <= 2200);
    if (mode === 'solid') t.diagnostic(`${quality}: ${JSON.stringify(counts)}`);
  }
  const state = freeze(sample(1.23)); m.update(state, { quality: 'balanced', mode: 'solid', explode: 0, selectedId: null }); const a = snapshot(m);
  m.update(pose(.71), { mode: 'xray', explode: 1 }); assert.notDeepEqual(snapshot(m), a);
  for (const explode of [.5, 1, .2, 0]) m.update(state, { mode: 'solid', explode }); assert.deepEqual(snapshot(m), a);
  const pickTarget = entries(m, 'gear.sun').find(e => e.mesh.geometry.type === 'BoxGeometry');
  const ray = new THREE.Raycaster(centre(pickTarget).add(new THREE.Vector3(0, 0, 2)), new THREE.Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(pickTarget.mesh).some(hit => hit.object.userData.instanceParts[hit.instanceId] === 'gear.sun'));
  for (const id of ids) {
    m.update(state, { selectedId: id }); let highlighted = 0;
    for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) {
      const c = new THREE.Color(); mesh.getColorAt(i, c); const selected = mesh.userData.instanceParts[i] === id;
      assert.equal(c.getHex(), selected ? 0x9ceacb : 0xffffff); if (selected) highlighted++;
    }
    assert.ok(highlighted > 0);
  }
  m.update(undefined, { mode: 'solid', highlight: false });
  for (const mesh of m.pickables) {
    assert.equal(mesh.material.opacity, 1); assert.equal(mesh.material.depthWrite, true);
    for (let i = 0; i < mesh.count; i++) { const c = new THREE.Color(); mesh.getColorAt(i, c); assert.equal(c.getHex(), 0xffffff); }
  }
  const b = snapshot(m); m.update(sample(1.23 + 1 / cycleHz())); recursiveNear(b, snapshot(m), 3e-7);
}));

test('all submitted resources dispose once and updates after disposal are harmless', () => {
  const m = createModel(), resources = new Set();
  for (const mesh of m.pickables) { resources.add(mesh); resources.add(mesh.geometry); resources.add(mesh.material); }
  const counts = new Map([...resources].map(r => [r, 0]));
  for (const r of resources) r.addEventListener('dispose', () => counts.set(r, counts.get(r) + 1));
  m.dispose(); m.dispose(); m.update(sample(4));
  assert.equal(m.group.children.length, 0); assert.equal(m.pickables.length, 0); assert.equal(m.stats.instances, 0);
  for (const count of counts.values()) assert.equal(count, 1);
});
