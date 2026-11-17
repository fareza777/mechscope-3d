import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import descriptor from '../src/mechanisms/radial-engine/index.js';
import { R, TAU, DEFAULT_INPUTS, cycleHz, framePoint, pose, sample } from '../src/mechanisms/radial-engine/kin.js';
import { createModel } from '../src/mechanisms/radial-engine/model.js';

const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
const vectorNear = (a, b, e = 1e-7) => a.forEach((v, i) => near(v, b[i], e));
const using = fn => { const m = createModel(); try { return fn(m); } finally { m.dispose(); } };
function entries(m, id) {
  const out = [];
  for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) if (!id || mesh.userData.instanceParts[i] === id) {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    out.push({ mesh, index: i, matrix, id: mesh.userData.instanceParts[i] });
  }
  return out;
}
const centre = e => new THREE.Vector3().setFromMatrixPosition(e.matrix).toArray();
const cylinderEnd = (e, sign) => new THREE.Vector3(0, sign * .5, 0).applyMatrix4(e.matrix).toArray();
function boundsFrom(items) {
  const bounds = new THREE.Box3(), point = new THREE.Vector3();
  for (const e of items) {
    const p = e.mesh.geometry.attributes.position;
    for (let j = 0; j < p.count; j++) bounds.expandByPoint(point.fromBufferAttribute(p, j).applyMatrix4(e.matrix));
  }
  return bounds;
}
const snapshot = m => m.pickables.map(mesh => [mesh.count, [...mesh.userData.instanceParts], ...mesh.instanceMatrix.array.slice(0, mesh.count * 16)]);
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function recursiveNear(a, b, epsilon = 1e-7) {
  if (typeof a === 'number') near(a, b, epsilon);
  else if (a && typeof a === 'object') { assert.deepEqual(Object.keys(a), Object.keys(b)); for (const k of Object.keys(a)) recursiveNear(a[k], b[k], epsilon); }
  else assert.equal(a, b);
}
function clearance(m) {
  // A strict separating axis from actual submitted vertices proves disjointness.
  // This is not a triangle/contact or piston-to-liner fit test.
  const list = entries(m), webs = Array.from({ length: 10 }, (_, i) => boundsFrom(list.filter(e => e.id === `crank.web.${i}`)));
  let gap = Infinity;
  for (let i = 1; i <= 9; i++) {
    const b = boundsFrom(list.filter(e => e.id === `c${i}.rod`));
    for (const w of webs) {
      assert.ok(!b.intersectsBox(w), `Actual rod ${i} intersects a crank-web envelope`);
      gap = Math.min(gap, Math.max(w.min.z - b.max.z, b.min.z - w.max.z));
    }
  }
  assert.ok(gap > .004, `Axial web clearance ${gap}`); return gap;
}

test('ASTRA descriptor, finite periodic sampler and source immutability', async () => {
  assert.equal(descriptor.id, 'radial-engine'); assert.equal(descriptor.title, 'ASTRA R9'); assert.equal(descriptor.collection, '016');
  assert.match(descriptor.description, /axial-staggered/);
  assert.equal(descriptor.lessons.length, 5);
  assert.equal(descriptor.specs.length, 2); descriptor.specs.forEach(s => assert.ok(s.label.length <= 12));
  assert.deepEqual(descriptor.controls.map(c => c.key), ['cadence', 'valveLift']);
  for (const c of descriptor.controls) for (const key of ['key', 'label', 'min', 'max', 'step', 'unit', 'precision']) assert.ok(key in c);
  for (const l of descriptor.lessons) {
    assert.ok(l.title && l.short && l.text.length >= 180 && l.fact.length >= 35);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view));
    assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  assert.ok(Object.isFrozen(DEFAULT_INPUTS));
  for (const cadence of [.04, .12, .3]) for (const valveLift of [.5, 1, 1.3]) {
    const input = freeze({ cadence, valveLift }); near(cycleHz(input), cadence);
    for (const t of [-198.23, -.3, 0, .83, 345.2]) {
      const s = sample(t, input), copy = structuredClone(s);
      assert.ok(s.phase >= 0 && s.phase < 1);
      assert.ok(Object.values(s.metrics).every(Number.isFinite));
      assert.ok(Object.values(s.metrics).slice(0, 3).every(Number.isFinite));
      recursiveNear(s, sample(t + 1 / cadence, input));
      sample(-57, input); assert.deepEqual(sample(t, input), copy);
      freeze(s); using(m => { m.update(s, { explode: .7 }); assert.deepEqual(s, copy); });
    }
  }
  for (const t of [-Number.MAX_VALUE, Number.MAX_VALUE, NaN, Infinity]) {
    const numbers = JSON.stringify(sample(t)); assert.ok(!numbers.includes('null'));
  }
  assert.deepEqual(sample(NaN, { cadence: Infinity, valveLift: NaN }), sample(0));
  const m = await descriptor.createModel(); assert.deepEqual(Object.keys(m).sort(), ['dispose', 'group', 'parts', 'pickables', 'stats', 'update']); m.dispose();
});

test('all nine exact slider-cranks and eighteen valve schedules close over control corners', () => {
  for (const cadence of [.04, .3]) for (const valveLift of [.5, 1.3]) for (let k = 0; k < 360; k++) {
    const s = sample(k / (360 * cadence), { cadence, valveLift });
    for (const c of s.cylinders) {
      const a = c.index * TAU / 9;
      const cr = new THREE.Vector3(...c.crankPin), pin = new THREE.Vector3(...c.pistonPin);
      near(cr.distanceTo(pin), R.rod);
      near(pin.x * Math.cos(a) - (pin.y - R.centreY) * Math.sin(a), 0);
      near(Math.hypot(cr.x, cr.y - R.centreY), R.crank);
      assert.ok(c.distance >= .30 - 1e-9 && c.distance <= .50 + 1e-9);
      for (const v of c.valves) {
        assert.ok(v.lift >= 0 && v.lift <= .018 * valveLift + 1e-10);
        near(new THREE.Vector3(...v.pushStart).distanceTo(new THREE.Vector3(...v.pushEnd)), R.pushrod);
        near(Math.abs(Math.sin(v.rockerAngle)) * R.rocker, v.lift);
      }
    }
  }
  const order = [0, 2, 4, 6, 8, 1, 3, 5, 7];
  order.forEach((c, i) => { const s = pose(i / 9); near(s.cylinders[c].distance, .5); near(Math.min(s.cylinders[c].cycleDegrees, 720 - s.cylinders[c].cycleDegrees), 0, 1e-7); });
  const first = pose(200 / 720), second = pose(560 / 720);
  near(first.cylinders[0].distance, second.cylinders[0].distance);
  assert.notEqual(first.cylinders[0].valves[1].lift, second.cylinders[0].valves[1].lift, 'Valves must remember the second crank revolution');
  assert.notDeepEqual(sample(.7), sample(.9));
});

test('submitted rigid eyes, journals, wrist pins, valve stems and rocker endpoints follow the solver', () => using(m => {
  for (const valveLift of [.5, 1.3]) for (let k = 0; k < 48; k++) {
    const s = pose(k / 48, valveLift); m.update(s, { quality: 'balanced', explode: 0 });
    for (const c of s.cylinders) {
      const id = `c${c.index + 1}`;
      const eyes = entries(m, `${id}.rod`).filter(e => e.mesh.geometry.type === 'TorusGeometry' && e.mesh.material.color.getHex() === 0x8b9da6);
      assert.equal(eyes.length, 2); vectorNear(centre(eyes[0]), c.crankPin); vectorNear(centre(eyes[1]), c.pistonPin);
      near(new THREE.Vector3(...centre(eyes[0])).distanceTo(new THREE.Vector3(...centre(eyes[1]))), .4, 2e-7);
      const wrist = entries(m, `${id}.wrist`).find(e => e.mesh.geometry.type === 'CylinderGeometry');
      vectorNear(centre(wrist), c.pistonPin); near(new THREE.Vector3(...cylinderEnd(wrist, 1)).distanceTo(new THREE.Vector3(...cylinderEnd(wrist, -1))), .126, 1e-7);
      vectorNear(m.group.getObjectByName(`${id}.rod`).scale.toArray(), [1, 1, 1]);
      for (let j = 0; j < 2; j++) {
        const v = c.valves[j], sign = j ? 1 : -1;
        const push = entries(m, `${id}.pushrod.${v.kind}`).find(e => e.mesh.geometry.type === 'CylinderGeometry');
        vectorNear(cylinderEnd(push, -1), v.pushStart); vectorNear(cylinderEnd(push, 1), v.pushEnd);
        const stem = entries(m, `${id}.valve.${v.kind}`).find(e => e.mesh.geometry.type === 'CylinderGeometry' && new THREE.Vector3().setFromMatrixColumn(e.matrix, 1).length() > .12);
        vectorNear(centre(stem), framePoint(c.index, sign * .035, .61 - v.lift, .045));
        const rocker = entries(m, `${id}.rocker.${v.kind}`).find(e => e.mesh.geometry.type === 'CylinderGeometry' && new THREE.Vector3().setFromMatrixColumn(e.matrix, 1).length() > .05);
        const localEnd = cylinderEnd(rocker, -sign);
        const expected = framePoint(c.index, sign * (.065 - .03 * Math.cos(v.rockerAngle)), .675 - v.lift, .045);
        vectorNear(localEnd, expected);
      }
    }
    const journal = entries(m, 'crank.eccentric')[0], jbox = boundsFrom([journal]);
    vectorNear(centre(journal).slice(0, 2), s.cylinders[0].crankPin.slice(0, 2));
    assert.ok(jbox.min.z < -.279 && jbox.max.z > .279, 'Journal must engage every rod lane and both outer webs');
  }
}));

test('actual swept rod geometry clears the web disks; deliberate rendered overlap is rejected', t => using(m => {
  let min = Infinity;
  for (let k = 0; k < 144; k++) { m.update(pose(k / 144, k % 2 ? .5 : 1.3)); min = Math.min(min, clearance(m)); }
  t.diagnostic(`minimum actual rod/web separating-axis clearance: ${min.toFixed(6)} m`);
  m.update(pose(0));
  for (const e of entries(m, 'c1.rod')) { e.matrix.elements[14] -= .03; e.mesh.setMatrixAt(e.index, e.matrix); }
  assert.throws(() => clearance(m), /intersects|clearance/, 'Negative control must move actual submitted geometry into a disk lane');
  m.update(pose(0)); clearance(m);
}));

test('real vertices stay grounded and within the two-metre display envelope', () => using(m => {
  for (const quality of ['low', 'balanced']) for (const explode of [0, .5, 1]) for (const phase of [0, .13, .37, .61, .89]) {
    m.update(pose(phase, 1.3), { quality, explode });
    const b = boundsFrom(entries(m)), size = b.getSize(new THREE.Vector3());
    near(b.min.y, 0, 1e-7); assert.ok(b.max.y <= 2 && size.x <= 2 && size.z <= 2, `${quality}/${explode}: ${size.toArray()} at ${b.max.y}`);
    vectorNear(m.group.position.toArray(), [0, 0, 0]); vectorNear(m.group.scale.toArray(), [1, 1, 1]);
    assert.ok(entries(m).every(e => e.matrix.determinant() > 0));
  }
}));

test('metadata coverage, buffer-count budgets, reversible explosion, selection and material reset', t => using(m => {
  const ids = new Set(m.parts.map(p => p.id)), names = new Set(m.parts.map(p => p.name));
  assert.equal(ids.size, m.parts.length); assert.equal(names.size, m.parts.length);
  assert.ok(m.parts.length >= 90 && m.parts.length <= 200);
  for (const p of m.parts) for (const k of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[k] === 'string' && p[k].length > 0);
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
  const state = freeze(sample(1.137));
  m.update(state, { quality: 'balanced', mode: 'solid', explode: 0, selectedId: null }); const before = snapshot(m);
  m.update(pose(.67), { explode: 1, mode: 'xray' }); assert.notDeepEqual(snapshot(m), before);
  for (const explode of [.25, 1, .7, 0]) m.update(state, { explode, mode: 'solid' }); assert.deepEqual(snapshot(m), before);
  const pickTarget = entries(m, 'c1.piston').find(e => e.mesh.geometry.type === 'CylinderGeometry');
  const ray = new THREE.Raycaster(new THREE.Vector3(...centre(pickTarget)).add(new THREE.Vector3(0, 0, 2)), new THREE.Vector3(0, 0, -1));
  assert.ok(ray.intersectObject(pickTarget.mesh).some(hit => hit.object.userData.instanceParts[hit.instanceId] === 'c1.piston'));
  for (const id of ids) {
    m.update(state, { selectedId: id });
    let selected = 0;
    for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) {
      const color = new THREE.Color(); mesh.getColorAt(i, color);
      const chosen = mesh.userData.instanceParts[i] === id;
      assert.equal(color.getHex(), chosen ? 0x9ceacb : 0xffffff); if (chosen) selected++;
    }
    assert.ok(selected > 0);
  }
  m.update(undefined, { selectedId: 'c1.piston', highlight: false, mode: 'solid' });
  for (const mesh of m.pickables) { assert.equal(mesh.material.opacity, 1); assert.equal(mesh.material.depthWrite, true); for (let i = 0; i < mesh.count; i++) { const c = new THREE.Color(); mesh.getColorAt(i, c); assert.equal(c.getHex(), 0xffffff); } }
  const a = snapshot(m); m.update(sample(1.137 + 1 / cycleHz()), {});
  const b = snapshot(m); recursiveNear(a, b, 3e-7);
}));

test('render resources dispose exactly once and the group is cleared', () => {
  const m = createModel(), resources = new Set();
  for (const mesh of m.pickables) { resources.add(mesh); resources.add(mesh.geometry); resources.add(mesh.material); }
  const counts = new Map([...resources].map(r => [r, 0]));
  for (const r of resources) r.addEventListener('dispose', () => counts.set(r, counts.get(r) + 1));
  m.dispose(); m.dispose(); m.update(sample(9));
  assert.equal(m.group.children.length, 0); assert.equal(m.pickables.length, 0); assert.equal(m.stats.instances, 0);
  for (const count of counts.values()) assert.equal(count, 1);
});
