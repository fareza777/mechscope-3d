import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { descriptor } from '../src/mechanisms/centipede/index.js';
import { createModel } from '../src/mechanisms/centipede/model.js';
import { D, TAU, sample, distance, solveKnee } from '../src/mechanisms/centipede/kin.js';

const near = (a, b, eps = 2e-8) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const corners = [.12, .85].flatMap(cadence => [.25, 1].map(wave => ({ cadence, wave })));
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
function bounds(items) {
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (const p of items) {
    const positions = p.geometry.attributes.position;
    for (let j = 0; j < positions.count; j++) box.expandByPoint(v.fromBufferAttribute(positions, j).applyMatrix4(p.matrix));
  }
  return box;
}
function tube(items, id) {
  const result = items.filter(p => p.id === `centipede.${id}` && p.geometry.type === 'CylinderGeometry' && p.color === 0xb28b4d);
  assert.equal(result.length, 1, `${id} must have a rendered pin-to-pin tube`); return result[0];
}
function endpoints(p, length, a, b) {
  const start = new THREE.Vector3(0, -.5, 0).applyMatrix4(p.matrix).toArray();
  const end = new THREE.Vector3(0, .5, 0).applyMatrix4(p.matrix).toArray();
  near(distance(start, a), 0, 4e-7); near(distance(end, b), 0, 4e-7); near(distance(start, end), length, 4e-7);
}
// Disjoint projections certify all triangles and interiors, not only sample pins.
function separation(a, b) { return Math.max(b.min.x - a.max.x, a.min.x - b.max.x, b.min.y - a.max.y, a.min.y - b.max.y, b.min.z - a.max.z, a.min.z - b.max.z); }
const requireSeparated = (a, b, label) => assert.ok(separation(a, b) > .002, `${label}: separation ${separation(a, b)}`);

test('MYRIA descriptor has two safe controls, five substantial lessons and a lazy renderer', async () => {
  assert.equal(descriptor.id, 'centipede'); assert.equal(descriptor.title, 'MYRIA M24'); assert.equal(descriptor.collection, '011');
  assert.deepEqual(Object.keys(descriptor).sort(), ['id', 'title', 'family', 'collection', 'description', 'defaultInputs', 'controls', 'specs', 'cycleLabel', 'cycleHz', 'sample', 'lessons', 'createModel'].sort());
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const c of descriptor.controls) assert.ok(c.key in descriptor.defaultInputs && c.min < c.max && c.step > 0 && Number.isInteger(c.precision));
  for (const s of descriptor.specs) assert.ok(s.label.length <= 12 && s.value);
  for (const l of descriptor.lessons) {
    assert.ok(l.text.length >= 180 && l.fact.length >= 35 && l.title && l.short);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  for (const file of ['index.js', 'kin.js']) assert.doesNotMatch(readFileSync(new URL(`../src/mechanisms/centipede/${file}`, import.meta.url), 'utf8'), /from\s+['"]three|from\s+['"].*model/);
  const m = await descriptor.createModel(); assert.ok(m.pickables.length); m.dispose();
});

test('MYRIA is deterministic, periodic, finite, sample-independent and continuous at cycle boundaries', () => {
  for (const input of corners) for (const t of [-9999.321, -.137, .041, .7123, 3999.719]) {
    const saved = structuredClone(input), s = freeze(sample(t, input)); finite(s); assert.ok(s.phase >= 0 && s.phase < 1);
    sample(8.41, { wave: .35 }); assert.deepEqual(sample(t, input), s); assert.deepEqual(input, saved); compare(s, sample(t + 1 / input.cadence, input));
    near(s.driveAngle, s.phase * TAU); assert.ok(Object.values(s.metrics).slice(0, 3).every(v => typeof v === 'number'));
  }
  for (const v of [NaN, Infinity, -Infinity, Number.MAX_VALUE, null, undefined]) finite(sample(v, { cadence: v, wave: v }));
  for (const p of [0, .5, .66]) {
    const a = sample((p - 1e-8) / .4), b = sample((p + 1e-8) / .4);
    a.legs.forEach((l, i) => near(distance(l.foot, b.legs[i].foot), 0, 1e-7));
    a.modules.forEach((l, i) => near(distance(l.end, b.modules[i].end), 0, 1e-7));
  }
  assert.throws(() => solveKnee([0, 0, 0], [5, 0, 0]), RangeError);
});

test('MYRIA 72 leg links and twelve serial spine intervals stay exact over 2,880 poses', t => {
  let minSupport = 24, maxYaw = 0, minReachMargin = Infinity;
  for (const input of corners) for (let i = 0; i < 720; i++) {
    const s = sample(i / (720 * input.cadence), input); assert.equal(s.modules.length, 12); assert.equal(s.legs.length, 24);
    assert.equal(new Set(s.legs.map(l => l.id)).size, 24);
    near(distance(s.modules[0].start, [0, .325, -1.17]), 0);
    s.modules.forEach((b, j) => {
      near(distance(b.start, b.end), D.pitch); maxYaw = Math.max(maxYaw, Math.abs(b.yaw));
      if (j) { near(distance(b.start, s.modules[j - 1].end), 0); near(((s.modules[j - 1].phase - b.phase) % 1 + 1) % 1, D.lag); }
    });
    for (const l of s.legs) {
      near(distance(l.hip, l.coxa), D.coxa); near(distance(l.coxa, l.knee), D.femur); near(distance(l.knee, l.foot), D.tibia);
      const reach = distance(l.coxa, l.foot); minReachMargin = Math.min(minReachMargin, D.femur + D.tibia - reach);
      assert.ok(reach < D.femur + D.tibia - .015 && reach > Math.abs(D.femur - D.tibia) + .05);
      if (l.stance) near(l.foot[1], D.sole); assert.ok(l.foot[1] >= D.sole - 1e-12 && l.foot[1] <= D.sole + .060 + 1e-12);
    }
    for (let j = 0; j < 12; j++) near(Math.abs(s.legs[j * 2].phase - s.legs[j * 2 + 1].phase), .5);
    for (const a of s.antennae) { near(distance(a.base, a.elbow), Math.hypot(.042, .025, .11)); near(distance(a.elbow, a.tip), Math.hypot(.028, .012, .10)); }
    minSupport = Math.min(minSupport, s.metrics.supportPads); assert.equal(s.metrics.supportPads, s.legs.filter(l => l.stance).length); assert.ok(s.metrics.supportPads >= 12);
  }
  t.diagnostic(`Minimum support ${minSupport}; maximum yaw ${(maxYaw * 180 / Math.PI).toFixed(3)}°; minimum extension margin ${minReachMargin.toFixed(4)} m`);
});

test('MYRIA actual selectable geometry and color batches meet every tier budget', t => withModel(m => {
  const ids = new Set(m.parts.map(p => p.id)); assert.equal(ids.size, m.parts.length); assert.ok(ids.size >= 100 && ids.size <= 220);
  assert.equal(new Set(m.parts.map(p => p.name)).size, ids.size);
  for (const p of m.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[key] === 'string' && p[key].length > 3, `${p.id} ${key}`);
  for (const quality of ['balanced', 'high', 'low']) {
    m.update(sample(.31), { quality }); const used = new Set(); let instances = 0, triangles = 0, drawCalls = 0;
    for (const b of m.pickables) {
      assert.ok(b.isInstancedMesh); instances += b.count; triangles += b.count * b.geometry.index.count / 3; if (b.count) drawCalls++;
      for (let i = 0; i < b.count; i++) { used.add(b.userData.instanceParts[i]); assert.ok(ids.has(b.userData.instanceParts[i])); }
    }
    t.diagnostic(`${quality}: ${m.parts.length} assemblies, ${instances} instances, ${triangles} triangles, ${drawCalls} batches`);
    assert.deepEqual(m.stats, { instances, triangles, drawCalls, selectableParts: m.parts.length });
    assert.equal(used.size, ids.size); assert.ok(instances <= 2400 && drawCalls <= 32); assert.ok(triangles <= (quality === 'low' ? 80000 : 200000));
    if (quality !== 'low') assert.ok(instances >= 900);
  }
}));

test('MYRIA actual rendered tubes and jointed antennae agree with solved rigid endpoints', () => withModel(m => {
  for (const input of corners) for (let i = 0; i < 48; i++) {
    const s = freeze(sample(i / (48 * input.cadence), input)); m.update(s, { quality: i % 2 ? 'low' : 'balanced' });
    const all = instances(m);
    for (const b of s.modules) endpoints(tube(all, `module.${b.id}.frame`), D.pitch, b.start, b.end);
    for (const l of s.legs) {
      endpoints(tube(all, `leg.${l.id}.coxa`), D.coxa, l.hip, l.coxa);
      endpoints(tube(all, `leg.${l.id}.femur`), D.femur, l.coxa, l.knee);
      endpoints(tube(all, `leg.${l.id}.tibia`), D.tibia, l.knee, l.foot);
    }
    for (const a of s.antennae) for (const [suffix, start, end, radius] of [['root', a.base, a.elbow, .006], ['tip', a.elbow, a.tip, .0035]]) {
      const shafts = all.filter(p => p.id === `centipede.antenna.${a.id}.${suffix}` && p.color === 0x8b9da6 && p.geometry.type === 'CylinderGeometry' && Math.abs(new THREE.Vector3().setFromMatrixColumn(p.matrix, 0).length() - radius) < 1e-7);
      assert.equal(shafts.length, 1); endpoints(shafts[0], distance(start, end), start, end);
    }
    for (const p of all) { finite(p.matrix.elements); assert.ok(p.matrix.determinant() > 0); }
  }
}));

test('MYRIA actual neighboring cartridges and independent appendages retain clearance; bad geometry is rejected', t => withModel(m => {
  let legGap = Infinity, armorGap = Infinity;
  for (const wave of [.25, .65, 1]) for (let i = 0; i < 144; i++) {
    m.update(sample(i / (144 * .4), { cadence: .4, wave })); const all = instances(m);
    const legs = Array.from({ length: 12 }, (_, j) => ['L', 'R'].map(side => ({ id: `${j + 1}.${side}`, box: bounds(all.filter(p => p.id.startsWith(`centipede.leg.${j + 1}.${side}.`))) }))).flat();
    for (let a = 0; a < legs.length; a++) for (let b = a + 1; b < legs.length; b++) {
      const gap = separation(legs[a].box, legs[b].box); requireSeparated(legs[a].box, legs[b].box, `leg ${legs[a].id}/${legs[b].id}, wave ${wave}, phase ${i}`); legGap = Math.min(legGap, gap);
    }
    const cartridges = Array.from({ length: 12 }, (_, j) => bounds(all.filter(p => p.id === `centipede.module.${j + 1}.armor` || p.id === `centipede.module.${j + 1}.stator` || p.id === `centipede.module.${j + 1}.rotor`)));
    for (let j = 0; j < 11; j++) { requireSeparated(cartridges[j], cartridges[j + 1], `cartridge ${j + 1}/${j + 2}`); armorGap = Math.min(armorGap, separation(cartridges[j], cartridges[j + 1])); }
    // All four long feelers are independent appendages, clear of one another.
    const feelers = ['head.L', 'head.R', 'tail.L', 'tail.R'].map(id => bounds(all.filter(p => p.id.startsWith(`centipede.antenna.${id}.`))));
    for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) requireSeparated(feelers[a], feelers[b], `feeler ${a}/${b}`);
  }
  const all = instances(m), a = tube(all, 'leg.1.L.tibia'), b = tube(all, 'leg.3.L.tibia');
  requireSeparated(bounds([a]), bounds([b]), 'unmodified non-neighbor tibiae');
  // Re-place a real second shin onto the first: the same geometric gate must fail.
  const bad = { ...b, matrix: a.matrix.clone() };
  assert.throws(() => requireSeparated(bounds([a]), bounds([bad]), 'deliberately intersecting tibiae'));
  const center = new THREE.Vector3().setFromMatrixPosition(bad.matrix).applyMatrix4(a.matrix.clone().invert());
  assert.ok(Math.abs(center.y) < .49 && Math.hypot(center.x, center.z) < .9, 'negative control center penetrates the actual convex cylinder');
  t.diagnostic(`Measured independent leg separation ${legGap.toFixed(4)} m; neighboring cartridge separation ${armorGap.toFixed(4)} m`);
}));

test('MYRIA rendered vertices remain on or above the floor within 3.5 × 2 metres', t => withModel(m => {
  let width = 0, length = 0, height = 0, floor = Infinity;
  for (const input of corners) for (let i = 0; i < 24; i++) {
    m.update(sample(i / (24 * input.cadence), input)); const b = bounds(instances(m)), size = b.getSize(new THREE.Vector3());
    width = Math.max(width, size.x); length = Math.max(length, size.z); height = Math.max(height, b.max.y); floor = Math.min(floor, b.min.y);
    assert.ok(b.min.y >= -1e-7, `floor ${b.min.y}`); assert.ok(size.x <= 2 && size.z <= 3.5 && b.max.y < .8, `bounds ${size.toArray()}`);
    assert.deepEqual(m.group.position.toArray(), [0, 0, 0]); assert.deepEqual(m.group.quaternion.toArray(), [0, 0, 0, 1]); assert.deepEqual(m.group.scale.toArray(), [1, 1, 1]);
  }
  t.diagnostic(`Rendered envelope ${width.toFixed(3)} W × ${length.toFixed(3)} L × ${height.toFixed(3)} H m; floor ${floor.toFixed(8)}`);
}));

test('MYRIA modes, both controls, selection and explosion restore EXACT matrices without allocating geometry', () => withModel(m => {
  const s = freeze(sample(.731)), saved = structuredClone(s); m.update(s); const original = snapshot(m);
  const resources = m.pickables.map(b => [b, b.geometry, b.material, b.instanceMatrix.array]);
  for (const explode of [.97, .13, 1, .001]) {
    m.update(s, { mode: 'xray', quality: 'low', explode }); assert.notDeepEqual(snapshot(m), original);
    for (const b of m.pickables) { const shell = b.material.color.getHex() === 0xced5cf; assert.equal(b.material.transparent, shell); near(b.material.opacity, shell ? .13 : 1); assert.equal(b.material.depthWrite, !shell); }
    m.update(s, { mode: 'cutaway', explode: .52 }); for (const b of m.pickables) { assert.equal(b.material.clippingPlanes.length, 1); assert.equal(b.material.side, THREE.DoubleSide); }
    m.update(s); assert.deepEqual(snapshot(m), original);
    for (const b of m.pickables) { assert.equal(b.material.clippingPlanes.length, 0); assert.equal(b.material.side, THREE.FrontSide); assert.equal(b.material.opacity, 1); }
  }
  for (const input of [{ cadence: .85 }, { wave: .25 }, { wave: 1 }]) { m.update(sample(.731, input)); assert.notDeepEqual(snapshot(m), original); }
  m.update(s, { selectedId: 'centipede.module.6.armor' }); const color = new THREE.Color(); let hits = 0;
  for (const b of m.pickables) for (let i = 0; i < b.count; i++) { b.getColorAt(i, color); const selected = b.userData.instanceParts[i] === 'centipede.module.6.armor'; assert.equal(color.getHex() !== 0xffffff, selected); if (selected) hits++; }
  assert.ok(hits > 0); assert.deepEqual(snapshot(m), original); assert.deepEqual(s, saved);
  resources.forEach(([b, g, mat, array], i) => { assert.equal(m.pickables[i], b); assert.equal(b.geometry, g); assert.equal(b.material, mat); assert.equal(b.instanceMatrix.array, array); });
  m.update(sample(1.49)); const changed = new Set();
  m.pickables.forEach((b, batch) => { for (let i = 0; i < b.count; i++) if (Array.from(b.instanceMatrix.array.slice(i * 16, i * 16 + 16)).some((v, j) => v !== original[batch][1 + i * 16 + j])) changed.add(b.userData.instanceParts[i]); });
  assert.ok(changed.size >= 180, `${changed.size} actual moving assemblies`);
}));

test('MYRIA disposal is idempotent and clears all logical and batched children', () => {
  const m = createModel(), resources = new Set(m.pickables.flatMap(b => [b, b.geometry, b.material])), calls = new Map();
  resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) || 0) + 1)));
  m.dispose(); m.dispose(); m.update(sample(4)); assert.equal(m.pickables.length, 0); assert.equal(m.group.children.length, 0);
  resources.forEach(r => assert.equal(calls.get(r), 1));
});

// The audit found joints whose pin centres matched while transverse journal
// axes disagreed. These gates read the rendered journals, not the solver normals.
function worldAxis(m, id, local) {
  const node = m.group.getObjectByName(`centipede.${id}`); assert.ok(node, id);
  const q = new THREE.Quaternion(); node.getWorldQuaternion(q);
  return new THREE.Vector3(...local).applyQuaternion(q).normalize();
}
function journalAxes(m, id, pin) {
  const target = new THREE.Vector3(...pin);
  return instances(m, x => x === `centipede.${id}`)
    .filter(x => x.geometry.type === 'CylinderGeometry' && x.color === 0x26343d)
    .map(x => ({ axis: new THREE.Vector3(0, 1, 0).transformDirection(x.matrix).normalize(), center: new THREE.Vector3().applyMatrix4(x.matrix) }))
    .filter(x => x.center.distanceTo(target) < .003);
}
test('MYRIA rendered journals share the linked hinge axes at every hip and knee pin', t => withModel(m => {
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
  for (const input of corners) for (let i = 0; i < 8; i++) {
    const s = sample(i / (8 * input.cadence), input); m.update(s); m.group.updateMatrixWorld(true);
    for (const l of s.legs) {
      pair(`module.${l.station + 1}.frame`, [0, 1, 0], `leg.${l.id}.coxa`, [1, 0, 0], l.hip);
      pair(`leg.${l.id}.coxa`, [0, 0, 1], `leg.${l.id}.femur`, [0, 0, 1], l.coxa);
      pair(`leg.${l.id}.femur`, [0, 0, 1], `leg.${l.id}.tibia`, [0, 0, 1], l.knee);
    }
  }
  assert.ok(checked >= 4 * 8 * 72, `checked ${checked} joints`);
  assert.ok(1 - Math.cos(.05) > 1e-6, 'negative control: a 2.9° tilt must be detected');
  t.diagnostic(`Worst frame/journal alignment ${(Math.acos(worst) * 180 / Math.PI).toExponential(2)}°, ${checked} joints`);
}));
