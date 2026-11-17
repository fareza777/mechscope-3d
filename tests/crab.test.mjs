import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { descriptor } from '../src/mechanisms/crab/index.js';
import { createModel } from '../src/mechanisms/crab/model.js';
import { D, TAU, LEG_ANCHOR, CLAW_ANCHOR, sample, distance, solveKnee } from '../src/mechanisms/crab/kin.js';

const near = (a, b, eps = 2e-8) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const corners = [.12, .75].flatMap(cadence => [0, 1].map(aperture => ({ cadence, aperture })));
const withModel = fn => { const m = createModel(); try { return fn(m); } finally { m.dispose(); } };
function finite(v) { if (typeof v === 'number') assert.ok(Number.isFinite(v)); else if (v && typeof v === 'object') Object.values(v).forEach(finite); }
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function compare(a, b, key = '') {
  if (key === 't') return;
  if (typeof a === 'number') near(a, b, 1e-7);
  else if (a && typeof a === 'object') for (const k of Object.keys(a)) compare(a[k], b[k], k);
  else assert.equal(a, b);
}
const snapshot = m => m.pickables.map(b => [b.count, ...b.instanceMatrix.array.slice(0, b.count * 16)]);
function instances(m, predicate = () => true) {
  const result = [];
  for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) {
    const id = mesh.userData.instanceParts[i]; if (!predicate(id)) continue;
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    result.push({ id, matrix, geometry: mesh.geometry, color: mesh.material.color.getHex() });
  }
  return result;
}
function bounds(items, transform = new THREE.Matrix4()) {
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (const p of items) {
    const positions = p.geometry.attributes.position, mat = transform.clone().multiply(p.matrix);
    for (let j = 0; j < positions.count; j++) box.expandByPoint(v.fromBufferAttribute(positions, j).applyMatrix4(mat));
  }
  return box;
}
function point(m, id, p) { return new THREE.Vector3(...p).applyMatrix4(m.group.getObjectByName(`crab.${id}`).matrixWorld).toArray(); }
function torqueEndpoints(m, id, length, a, b) {
  const rails = instances(m, p => p === `crab.${id}`).filter(p => p.geometry.type === 'CylinderGeometry' && p.color === 0xb28b4d);
  assert.equal(rails.length, 1, `one real pin-to-pin torque tube in ${id}`);
  const start = new THREE.Vector3(0, -.5, 0).applyMatrix4(rails[0].matrix).toArray();
  const end = new THREE.Vector3(0, .5, 0).applyMatrix4(rails[0].matrix).toArray();
  near(distance(start, end), length, 3e-7); near(distance(start, a), 0, 3e-7); near(distance(end, b), 0, 3e-7);
}

// Convex-cylinder interior check used by the deliberately colliding negative control.
function insideCylinder(p, world) {
  const v = world.clone().applyMatrix4(p.matrix.clone().invert());
  if (Math.abs(v.y) >= .5 - 1e-5) return false;
  // Cylinder's inscribed twelve-sided polygon, not an optimistic circular envelope.
  return Math.hypot(v.x, v.z) < Math.cos(Math.PI / 12) - 1e-5;
}

test('CRUSTA descriptor is complete, lazy and renderer-free', async () => {
  assert.equal(descriptor.id, 'crab'); assert.equal(descriptor.collection, '010'); assert.equal(descriptor.title, 'CRUSTA C10');
  assert.deepEqual(Object.keys(descriptor).sort(), ['id', 'title', 'family', 'collection', 'description', 'defaultInputs', 'controls', 'specs', 'cycleLabel', 'cycleHz', 'sample', 'lessons', 'createModel'].sort());
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const s of descriptor.specs) assert.ok(s.label.length <= 12 && s.value);
  for (const c of descriptor.controls) { assert.ok(c.min < c.max && c.step > 0 && c.key in descriptor.defaultInputs); assert.ok(Number.isInteger(c.precision)); }
  for (const l of descriptor.lessons) {
    assert.ok(l.text.length >= 180 && l.fact.length >= 35 && l.title && l.short);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  for (const file of ['index.js', 'kin.js']) assert.doesNotMatch(readFileSync(new URL(`../src/mechanisms/crab/${file}`, import.meta.url), 'utf8'), /from\s+['"]three|from\s+['"].*model/);
  const m = await descriptor.createModel(); assert.ok(m.pickables.length); m.dispose();
});

test('CRUSTA samples are independent, periodic, finite and continuous through wrap and half-cycle', () => {
  for (const input of corners) for (const t of [-12345.231, -.137, 0, .391, 3.141, 9999.73]) {
    const saved = structuredClone(input), s = freeze(sample(t, input)); finite(s);
    assert.ok(s.phase >= 0 && s.phase < 1); near(s.driveAngle, s.phase * TAU);
    sample(200, { aperture: .17 }); assert.deepEqual(sample(t, input), s); assert.deepEqual(input, saved);
    compare(s, sample(t + 1 / input.cadence, input));
    assert.ok(Object.values(s.metrics).slice(0, 3).every(v => typeof v === 'number'));
  }
  for (const v of [NaN, Infinity, -Infinity, Number.MAX_VALUE, null, undefined]) finite(sample(v, { cadence: v, aperture: v }));
  for (const p of [0, .5, .64]) {
    const a = sample((p - 1e-8) / .32), b = sample((p + 1e-8) / .32);
    a.legs.forEach((l, i) => near(distance(l.foot, b.legs[i].foot), 0, 1e-7));
    a.claws.forEach((c, i) => near(distance(c.jaws[0].tip, b.claws[i].jaws[0].tip), 0, 1e-7));
  }
  assert.throws(() => solveKnee([0, 0, 0], [4, 0, 0]), RangeError);
});

test('CRUSTA exact leg, pincer, stalk and sleeve lengths hold over 2,880 control-corner poses', t => {
  let minLeg = Infinity, maxLeg = 0, minClaw = Infinity, maxClaw = 0;
  for (const input of corners) for (let i = 0; i < 720; i++) {
    const s = sample(i / (720 * input.cadence), input);
    assert.equal(s.legs.length, 8); assert.equal(s.claws.length, 2); assert.equal(s.eyes.length, 2);
    assert.ok(s.metrics.supportPads >= 4);
    s.legs.forEach(l => {
      near(distance(l.hip, l.coxa), D.coxa); near(distance(l.coxa, l.knee), D.femur); near(distance(l.knee, l.foot), D.tibia);
      if (l.stance) near(l.foot[1], D.sole); else assert.ok(l.foot[1] >= D.sole - 1e-12);
      near(l.actuatorLength, distance(l.actuatorA, l.actuatorB)); minLeg = Math.min(minLeg, l.actuatorLength); maxLeg = Math.max(maxLeg, l.actuatorLength);
      assert.ok(l.actuatorLength > Math.max(D.barrel, D.piston) + .008 && l.actuatorLength < D.barrel + D.piston - .015);
    });
    for (let j = 0; j < 4; j++) near(Math.abs(s.legs[j].phase - s.legs[j + 4].phase), .5);
    s.claws.forEach(c => {
      near(distance(c.shoulder, c.elbow), D.upper); near(distance(c.elbow, c.wrist), D.forearm); near(distance(c.wrist, c.palmTip), D.palm);
      near((c.jaws[0].yaw + c.jaws[1].yaw) / 2, c.yaw);
      c.jaws.forEach(j => { near(distance(j.pivot, j.knuckle), Math.hypot(.038, .155)); near(distance(j.knuckle, j.tip), Math.hypot(.093, .110)); });
      minClaw = Math.min(minClaw, c.actuatorLength); maxClaw = Math.max(maxClaw, c.actuatorLength);
      assert.ok(c.actuatorLength > .27 && c.actuatorLength < .495);
    });
    s.eyes.forEach(e => near(distance(e.base, e.tip), Math.hypot(.205, .055)));
  }
  t.diagnostic(`Pin distance ranges: leg ${minLeg.toFixed(4)}–${maxLeg.toFixed(4)} m; claw ${minClaw.toFixed(4)}–${maxClaw.toFixed(4)} m`);
});

test('CRUSTA actual instance counts, structural visibility and color batches fit all quality tiers', t => withModel(m => {
  const ids = new Set(m.parts.map(p => p.id)); assert.equal(ids.size, m.parts.length); assert.ok(ids.size >= 100 && ids.size <= 200);
  assert.equal(new Set(m.parts.map(p => p.name)).size, ids.size);
  for (const p of m.parts) for (const k of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[k] === 'string' && p[k].length > 3, `${p.id} ${k}`);
  for (const quality of ['balanced', 'high', 'low']) {
    m.update(sample(.51), { quality }); let instances = 0, triangles = 0, drawCalls = 0; const used = new Set();
    for (const b of m.pickables) {
      assert.ok(b.isInstancedMesh); instances += b.count; triangles += b.count * b.geometry.index.count / 3; if (b.count) drawCalls++;
      for (let i = 0; i < b.count; i++) { assert.ok(ids.has(b.userData.instanceParts[i])); used.add(b.userData.instanceParts[i]); }
    }
    t.diagnostic(`${quality}: ${m.parts.length} assemblies, ${instances} instances, ${triangles} triangles, ${drawCalls} batches`);
    assert.deepEqual(m.stats, { instances, triangles, drawCalls, selectableParts: m.parts.length });
    assert.equal(used.size, ids.size); assert.ok(instances <= 2200 && drawCalls <= 32); assert.ok(triangles <= (quality === 'low' ? 80000 : 200000));
    if (quality !== 'low') assert.ok(instances >= 900);
  }
}));

test('CRUSTA rendered torque tubes, rotated clevis brackets and fixed sleeves meet sampled pins', () => withModel(m => {
  for (const input of corners) for (let i = 0; i < 48; i++) {
    const s = freeze(sample(i / (48 * input.cadence), input)); m.update(s, { quality: i % 2 ? 'low' : 'balanced' });
    for (const l of s.legs) {
      torqueEndpoints(m, `leg.${l.id}.coxa`, D.coxa, l.hip, l.coxa); torqueEndpoints(m, `leg.${l.id}.femur`, D.femur, l.coxa, l.knee); torqueEndpoints(m, `leg.${l.id}.tibia`, D.tibia, l.knee, l.foot);
      near(distance(point(m, `leg.${l.id}.femur`, LEG_ANCHOR), l.actuatorB), 0);
      near(distance(point(m, `leg.${l.id}.lift.clevis`, [0, 0, 0]), l.actuatorB), 0);
      near(Math.abs(m.group.getObjectByName(`crab.leg.${l.id}.lift.clevis`).quaternion.dot(m.group.getObjectByName(`crab.leg.${l.id}.femur`).quaternion)), 1);
      near(distance(point(m, `leg.${l.id}.lift.barrel`, [0, 0, 0]), l.actuatorA), 0); near(distance(point(m, `leg.${l.id}.lift.piston`, [0, 0, 0]), l.actuatorB), 0);
      if (i === 0) {
        const braces = instances(m, id => id === `crab.leg.${l.id}.femur`).filter(p => p.geometry.type === 'CylinderGeometry' && p.color === 0x8b9da6 && distance(new THREE.Vector3(0, .5, 0).applyMatrix4(p.matrix).toArray(), l.actuatorB) < 3e-7);
        assert.equal(braces.length, 2, 'both physical bracket stays reach the transformed anchor');
      }
    }
    for (const c of s.claws) {
      const id = `claw.${c.side < 0 ? 'L' : 'R'}`;
      torqueEndpoints(m, `${id}.upper`, D.upper, c.shoulder, c.elbow); torqueEndpoints(m, `${id}.forearm`, D.forearm, c.elbow, c.wrist);
      near(distance(point(m, `${id}.forearm`, CLAW_ANCHOR), c.actuatorB), 0);
      near(distance(point(m, `${id}.reach.clevis`, [0, 0, 0]), c.actuatorB), 0);
      near(Math.abs(m.group.getObjectByName(`crab.${id}.reach.clevis`).quaternion.dot(m.group.getObjectByName(`crab.${id}.forearm`).quaternion)), 1);
      for (const j of c.jaws) near(distance(point(m, `${id}.jaw.${j.side}`, [-j.side * .055, 0, -.265]), j.tip), 0);
    }
    for (const p of instances(m)) { finite(p.matrix.elements); assert.ok(p.matrix.determinant() > 0); }
    for (const suffix of ['barrel', 'piston']) {
      const n = m.group.getObjectByName(`crab.leg.L1.lift.${suffix}`); assert.deepEqual(n.scale.toArray(), [1, 1, 1]);
    }
  }
}));

test('CRUSTA actual hooked solids and distinct leg lanes separate; a colliding hook negative control fails', t => withModel(m => {
  let minimumHook = Infinity, minimumLane = Infinity;
  const closing = (3 * Math.PI / 2 - .6) / TAU;
  for (const aperture of [0, .5, 1]) for (const phase of [closing, ...Array.from({ length: 96 }, (_, i) => i / 96)]) {
    const s = sample(phase / .32, { cadence: .32, aperture }); m.update(s);
    const all = instances(m);
    for (const c of s.claws) {
      const prefix = `crab.claw.${c.side < 0 ? 'L' : 'R'}.jaw.`;
      const inverse = new THREE.Matrix4().makeRotationY(-c.yaw); inverse.multiply(new THREE.Matrix4().makeTranslation(...c.palmTip.map(v => -v)));
      const a = bounds(all.filter(p => p.id === `${prefix}-1`), inverse), b = bounds(all.filter(p => p.id === `${prefix}1`), inverse);
      const gap = b.min.x - a.max.x; assert.ok(gap > .025, `hook gap ${gap}`); minimumHook = Math.min(minimumHook, gap);
    }
    for (const side of ['L', 'R']) {
      const lanes = Array.from({ length: 4 }, (_, i) => bounds(all.filter(p => p.id.startsWith(`crab.leg.${side}${i + 1}.`))));
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
        const gap = lanes[b].min.z - lanes[a].max.z;
        assert.ok(gap > .003, `distinct ${side}${a + 1}/${b + 1} legs, gap ${gap}`); minimumLane = Math.min(minimumLane, gap);
      }
    }
  }
  // Translate an actual right-finger hook into the left hook's center. This both
  // violates the very same separation gate and puts a point inside a real solid.
  const s = sample(closing / .32); m.update(s);
  const hook = q => instances(m, id => id === `crab.claw.L.jaw.${q}`).find(p => p.geometry.type === 'CylinderGeometry' && Math.abs(new THREE.Vector3().setFromMatrixColumn(p.matrix, 0).length() - .019) < 1e-6);
  const a = hook(-1), b = hook(1); assert.ok(a && b);
  const delta = new THREE.Vector3().setFromMatrixPosition(a.matrix).sub(new THREE.Vector3().setFromMatrixPosition(b.matrix));
  const bad = { ...b, matrix: b.matrix.clone().premultiply(new THREE.Matrix4().makeTranslation(delta.x, delta.y, delta.z)) };
  assert.ok(insideCylinder(a, new THREE.Vector3().setFromMatrixPosition(bad.matrix)));
  assert.throws(() => assert.ok(bounds([bad]).min.x - bounds([a]).max.x > .025));
  t.diagnostic(`Measured minimum hook separation ${minimumHook.toFixed(4)} m; adjacent leg-lane separation ${minimumLane.toFixed(4)} m`);
}));

function obb(p) {
  if (!p.geometry.boundingBox) p.geometry.computeBoundingBox();
  const local = p.geometry.boundingBox, axes = [0, 1, 2].map(i => new THREE.Vector3().setFromMatrixColumn(p.matrix, i));
  const half = local.getSize(new THREE.Vector3()).multiplyScalar(.5).toArray().map((v, i) => v * axes[i].length());
  axes.forEach(a => a.normalize());
  return { ...p, axes, half, center: local.getCenter(new THREE.Vector3()).applyMatrix4(p.matrix) };
}
function separatedOBB(a, b) {
  const delta = b.center.clone().sub(a.center);
  if (delta.length() > Math.hypot(...a.half) + Math.hypot(...b.half) + .0001) return true;
  const separates = axis => {
    const length = axis.length(); if (length < 1e-8) return false;
    const radius = p => p.half.reduce((s, h, i) => s + h * Math.abs(p.axes[i].dot(axis)), 0);
    return Math.abs(delta.dot(axis)) > radius(a) + radius(b) + .0001 * length;
  };
  return [...a.axes, ...b.axes].some(separates) || a.axes.some(x => b.axes.some(y => separates(new THREE.Vector3().crossVectors(x, y))));
}

test('CRUSTA pincer positioning arms and sleeves clear all independently moving walking legs', () => withModel(m => {
  for (const aperture of [0, 1]) for (let i = 0; i < 72; i++) {
    m.update(sample(i / (72 * .32), { cadence: .32, aperture }));
    const all = instances(m, id => id.startsWith('crab.claw.') || id.startsWith('crab.leg.')).map(obb);
    const claws = all.filter(p => p.id.startsWith('crab.claw.')), legs = all.filter(p => p.id.startsWith('crab.leg.'));
    for (const a of claws) for (const b of legs) assert.ok(separatedOBB(a, b), `${a.id}/${a.geometry.type} touches ${b.id}/${b.geometry.type} at ${i}`);
  }
}));

test('CRUSTA real vertices remain above the floor and inside the compact envelope', t => withModel(m => {
  let width = 0, length = 0, height = 0, floor = Infinity;
  for (const input of corners) for (let i = 0; i < 24; i++) {
    m.update(sample(i / (24 * input.cadence), input)); const b = bounds(instances(m)), size = b.getSize(new THREE.Vector3());
    width = Math.max(width, size.x); length = Math.max(length, size.z); height = Math.max(height, b.max.y); floor = Math.min(floor, b.min.y);
    assert.ok(b.min.y >= -1e-7, `floor ${b.min.y}`); assert.ok(size.x <= 2 && size.z <= 3.5 && b.max.y < 1.2, `bounds ${size.toArray()}`);
    assert.deepEqual(m.group.position.toArray(), [0, 0, 0]); assert.deepEqual(m.group.quaternion.toArray(), [0, 0, 0, 1]); assert.deepEqual(m.group.scale.toArray(), [1, 1, 1]);
  }
  t.diagnostic(`Rendered envelope ${width.toFixed(3)} W × ${length.toFixed(3)} L × ${height.toFixed(3)} H m; floor ${floor.toFixed(8)}`);
}));

test('CRUSTA inspection modes, animation, selection and explosion restore EXACT buffers without mutation', () => withModel(m => {
  const s = freeze(sample(.713)), saved = structuredClone(s); m.update(s); const original = snapshot(m);
  const resources = m.pickables.map(b => [b, b.geometry, b.material, b.instanceMatrix.array]);
  for (const explode of [1, .23, .81, .001]) {
    m.update(s, { mode: 'xray', explode, quality: 'low' });
    for (const b of m.pickables) { const shell = b.material.color.getHex() === 0xced5cf; assert.equal(b.material.transparent, shell); near(b.material.opacity, shell ? .13 : 1); assert.equal(b.material.depthWrite, !shell); }
    m.update(s, { mode: 'cutaway', explode: .4 }); for (const b of m.pickables) { assert.equal(b.material.clippingPlanes.length, 1); assert.equal(b.material.side, THREE.DoubleSide); }
    m.update(s); assert.deepEqual(snapshot(m), original);
    for (const b of m.pickables) { assert.equal(b.material.clippingPlanes.length, 0); assert.equal(b.material.side, THREE.FrontSide); assert.equal(b.material.opacity, 1); }
  }
  for (const input of [{ cadence: .75 }, { aperture: 0 }, { aperture: 1 }]) { m.update(sample(.713, input)); assert.notDeepEqual(snapshot(m), original); }
  m.update(s, { selectedId: 'crab.leg.L1.femur' }); const color = new THREE.Color(); let hits = 0;
  for (const b of m.pickables) for (let i = 0; i < b.count; i++) { b.getColorAt(i, color); const selected = b.userData.instanceParts[i] === 'crab.leg.L1.femur'; assert.equal(color.getHex() !== 0xffffff, selected); if (selected) hits++; }
  assert.ok(hits > 0); assert.deepEqual(snapshot(m), original); assert.deepEqual(s, saved);
  resources.forEach(([b, g, mat, array], i) => { assert.equal(m.pickables[i], b); assert.equal(b.geometry, g); assert.equal(b.material, mat); assert.equal(b.instanceMatrix.array, array); });
  m.update(sample(1.31)); const changed = new Set();
  m.pickables.forEach((b, batch) => { for (let i = 0; i < b.count; i++) if (Array.from(b.instanceMatrix.array.slice(i * 16, i * 16 + 16)).some((v, j) => v !== original[batch][1 + i * 16 + j])) changed.add(b.userData.instanceParts[i]); });
  assert.ok(changed.size >= 65, `${changed.size} moving assemblies`);
}));

test('CRUSTA repeated disposal clears root and releases resources only once', () => {
  const m = createModel(), resources = new Set(m.pickables.flatMap(b => [b, b.geometry, b.material])), calls = new Map();
  resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) || 0) + 1)));
  m.dispose(); m.dispose(); m.update(sample(5)); assert.equal(m.group.children.length, 0); assert.equal(m.pickables.length, 0);
  resources.forEach(r => assert.equal(calls.get(r), 1));
});

// The audit found joints whose pin centres matched while transverse journal
// axes disagreed. These gates read the rendered journals, not the solver normals.
function worldAxis(m, id, local) {
  const node = m.group.getObjectByName(`crab.${id}`); assert.ok(node, id);
  const q = new THREE.Quaternion(); node.getWorldQuaternion(q);
  return new THREE.Vector3(...local).applyQuaternion(q).normalize();
}
function journalAxes(m, id, pin) {
  const target = new THREE.Vector3(...pin);
  return instances(m, x => x === `crab.${id}`)
    .filter(x => x.geometry.type === 'CylinderGeometry' && x.color === 0x26343d)
    .map(x => ({ axis: new THREE.Vector3(0, 1, 0).transformDirection(x.matrix).normalize(), center: new THREE.Vector3().applyMatrix4(x.matrix) }))
    .filter(x => x.center.distanceTo(target) < .003);
}
test('CRUSTA rendered journals share the linked hinge axes at every hip, knee and claw pin', t => withModel(m => {
  let checked = 0, worst = 1;
  const pair = (a, av, b, bv, pin) => {
    const A = worldAxis(m, a, av), B = worldAxis(m, b, bv);
    const frames = Math.abs(A.dot(B)); worst = Math.min(worst, frames);
    assert.ok(1 - frames < 1e-9, `${a}/${b} hinge frames diverge: ${(Math.acos(frames) * 180 / Math.PI).toFixed(4)}°`);
    for (const [id, axis] of [[a, A], [b, B]]) {
      const journals = journalAxes(m, id, pin);
      assert.ok(journals.length > 0, `${id}: no rendered journal at the shared pin`);
      for (const j of journals) { const d = Math.abs(j.axis.dot(axis)); worst = Math.min(worst, d); assert.ok(1 - d < 1e-6, `${id}: rendered journal axis diverges`); }
    }
    checked++;
  };
  for (const input of corners) for (let i = 0; i < 12; i++) {
    const s = sample(i / (12 * input.cadence), input); m.update(s); m.group.updateMatrixWorld(true);
    for (const l of s.legs) {
      pair(`leg.${l.id}.hip`, [0, 1, 0], `leg.${l.id}.coxa`, [1, 0, 0], l.hip);
      pair(`leg.${l.id}.coxa`, [0, 0, 1], `leg.${l.id}.femur`, [0, 0, 1], l.coxa);
      pair(`leg.${l.id}.femur`, [0, 0, 1], `leg.${l.id}.tibia`, [0, 0, 1], l.knee);
    }
    for (const c of s.claws) {
      const id = `claw.${c.side < 0 ? 'L' : 'R'}`;
      pair(`${id}.shoulder`, [0, 1, 0], `${id}.upper`, [0, 0, 1], c.shoulder);
      pair(`${id}.upper`, [0, 0, 1], `${id}.forearm`, [0, 0, 1], c.elbow);
    }
  }
  assert.ok(checked >= 4 * 12 * 28, `checked ${checked} joints`);
  assert.ok(1 - Math.cos(.05) > 1e-6, 'negative control: a 2.9° tilt must be detected');
  t.diagnostic(`Worst frame/journal alignment ${(Math.acos(worst) * 180 / Math.PI).toExponential(2)}°, ${checked} joints`);
}));
