import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/tourbillon/index.js';
import { createModel } from '../src/mechanisms/tourbillon/model.js';
import { D, TAU, DEFAULT_INPUTS, GEAR_PHASES, CAGE_PHASE, SPRING_LENGTHS, cycleHz, inputsOf, sample, poseAt } from '../src/mechanisms/tourbillon/kin.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const finite = x => { if (typeof x === 'number') assert.ok(Number.isFinite(x)); else if (x && typeof x === 'object') Object.values(x).forEach(finite); };
const withModel = fn => { const m = createModel(); try { fn(m); } finally { m.dispose(); } };
const snapshot = m => m.pickables.map(b => ({ ids: b.userData.instanceParts.slice(0, b.count), matrix: Array.from(b.instanceMatrix.array.slice(0, b.count * 16)) }));
const angularDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function primitives(model, accepts = () => true) {
  const result = [];
  for (const mesh of model.pickables) {
    mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox;
    for (let i = 0; i < mesh.count; i++) {
      const id = mesh.userData.instanceParts[i]; if (!accepts(id)) continue;
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
      const axes = [0, 1, 2].map(k => new THREE.Vector3().setFromMatrixColumn(matrix, k));
      const half = box.getSize(new THREE.Vector3()).multiplyScalar(.5).toArray().map((v, k) => v * axes[k].length());
      axes.forEach(a => a.normalize());
      result.push({ id, matrix, axes, half, center: box.getCenter(new THREE.Vector3()).applyMatrix4(matrix), geometry: mesh.geometry, type: mesh.geometry.type, color: mesh.material.color.getHex() });
    }
  }
  return result;
}
function separated(a, b) {
  const delta = b.center.clone().sub(a.center);
  if (delta.length() > Math.hypot(...a.half) + Math.hypot(...b.half) + 1e-6) return true;
  const separates = axis => {
    const length = axis.length(); if (length < 1e-8) return false;
    const radius = p => p.half.reduce((sum, h, i) => sum + h * Math.abs(p.axes[i].dot(axis)), 0);
    return Math.abs(delta.dot(axis)) > radius(a) + radius(b) + 1e-6 * length;
  };
  return [...a.axes, ...b.axes].some(separates) || a.axes.some(x => b.axes.some(y => separates(new THREE.Vector3().crossVectors(x, y))));
}
function insideConvex(primitive, point) {
  const q = point.clone().applyMatrix4(primitive.matrix.clone().invert()), positions = primitive.geometry.attributes.position, index = primitive.geometry.index;
  for (let i = 0; i < index.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 2));
    const normal = b.sub(a).cross(c.sub(a));
    if (normal.lengthSq() > 1e-15 && normal.normalize().dot(q.clone().sub(a)) >= -1e-6) return false;
  }
  return true;
}
function bounds(model) {
  const box = new THREE.Box3(), p = new THREE.Vector3();
  for (const item of primitives(model)) {
    assert.ok(item.matrix.determinant() > 0);
    for (let i = 0; i < item.geometry.attributes.position.count; i++) box.expandByPoint(p.fromBufferAttribute(item.geometry.attributes.position, i).applyMatrix4(item.matrix));
  }
  return box;
}
// Radial intervals from actual buffer vertices, with an additional edge-distance
// check for the column's conservative OBB. This is a sufficient separating
// annulus test and does not mistake a torus's empty middle for solid material.
function radialMaximum(items, inverse) {
  let max = 0; const p = new THREE.Vector3();
  for (const item of items) {
    const matrix = inverse.clone().multiply(item.matrix);
    for (let i = 0; i < item.geometry.attributes.position.count; i++) {
      p.fromBufferAttribute(item.geometry.attributes.position, i).applyMatrix4(matrix); max = Math.max(max, Math.hypot(p.x, p.y));
    }
  }
  return max;
}
function radialLowerBound(item, inverse) {
  const center = item.center.clone().applyMatrix4(inverse);
  const radial = new THREE.Vector3(center.x, center.y, 0).normalize();
  const axes = item.axes.map(a => a.clone().transformDirection(inverse));
  return Math.hypot(center.x, center.y) - item.half.reduce((sum, h, i) => sum + h * Math.abs(axes[i].dot(radial)), 0);
}

test('CHRONOS descriptor documents exact train versus illustrative horology and full period', async () => {
  assert.equal(descriptor.id, 'tourbillon'); assert.equal(descriptor.collection, '019'); assert.equal(descriptor.title, 'CHRONOS T3');
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const c of descriptor.controls) { assert.ok(c.key in DEFAULT_INPUTS && c.min < c.max && c.step > 0); assert.ok(c.label && c.unit && Number.isInteger(c.precision)); }
  for (const s of descriptor.specs) assert.ok(s.label.length <= 12);
  for (const l of descriptor.lessons) { assert.ok(l.title && l.short && l.text.length >= 180 && l.fact.length >= 35); assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1); }
  assert.match(descriptor.description, /not dynamical/); assert.match(descriptor.lessons.map(l => l.fact).join(' '), /involute/);
  near(cycleHz(DEFAULT_INPUTS), .005); assert.deepEqual(descriptor.sample(.9), sample(.9));
  const m = await descriptor.createModel(); assert.ok(m.group.isGroup && m.pickables.length); m.dispose();
});

test('integer turns, exact tooth ratios, rigid spring links and alternating prescribed dwells', () => {
  for (const cadence of [.025, .06, .15]) for (const amplitude of [15, 30, 42]) for (let n = 0; n <= 720; n++) {
    const state = poseAt(n * TAU / 720, { cadence, amplitude }); finite(state);
    near((state.gearAngles[0] - GEAR_PHASES[0]) * 60 + (state.gearAngles[1] - GEAR_PHASES[1]) * 40, 0, 1e-10);
    near((state.gearAngles[1] - GEAR_PHASES[1]) * 40 + (state.gearAngles[2] - GEAR_PHASES[2]) * 30, 0, 1e-10);
    near((state.gearAngles[2] - GEAR_PHASES[2]) * 15 + (state.cageAngle - CAGE_PHASE) * 60, 0, 1e-10);
    near(state.minuteAngle, state.hourAngle * 12); assert.ok(Math.abs(state.balanceAngle) <= amplitude * Math.PI / 180 + 1e-12); assert.ok(Math.abs(state.forkAngle) <= .130000001);
    SPRING_LENGTHS.forEach((length, i) => near(distance(state.springPoints[i], state.springPoints[i + 1]), length, 1e-12));
    assert.ok(Object.values(state.metrics).slice(0, 3).every(Number.isFinite));
  }
  for (let tooth = 0; tooth < 144; tooth++) {
    const state = fraction => poseAt((tooth + fraction) * TAU / 144);
    near(state(.1).escapeAngle, state(.6).escapeAngle); assert.ok(state(.9).escapeAngle > state(.6).escapeAngle);
    near(state(.999999).escapeAngle - state(.001).escapeAngle, TAU / 12, 1e-9);
    assert.notEqual(state(.1).lock, poseAt((tooth + 1.1) * TAU / 144).lock);
    near(state(.9999999).escapeAngle, poseAt((tooth + 1.0000001) * TAU / 144).escapeAngle, 1e-10);
  }
  const a = poseAt(TAU / 288, { amplitude: 15 }), b = poseAt(TAU / 288, { amplitude: 42 });
  assert.ok(Math.abs(b.balanceAngle) > Math.abs(a.balanceAngle) * 2.5); assert.notDeepEqual(a.springPoints, b.springPoints);
  assert.notDeepEqual(sample(1, { cadence: .025 }).gearAngles, sample(1, { cadence: .15 }).gearAngles);
});

test('sampler is pure, finite and periodic for every moving assembly, including negative time', () => {
  for (const cadence of [.025, .15]) for (const amplitude of [15, 42]) for (const t of [-991, -1.23, 0, .75, 19, 100000]) {
    const input = Object.freeze({ cadence, amplitude }), a = sample(t, input), b = sample(t + 1 / cycleHz(input), input);
    finite(a); assert.ok(a.phase >= 0 && a.phase < 1); sample(400, {}); assert.deepEqual(sample(t, input), a);
    for (const key of ['cageAngle', 'escapeAngle', 'minuteAngle', 'hourAngle']) near(angularDifference(a[key], b[key]), 0, 2e-8);
    near(a.balanceAngle, b.balanceAngle, 2e-8); near(a.forkAngle, b.forkAngle, 2e-8);
    a.gearAngles.forEach((v, i) => near(angularDifference(v, b.gearAngles[i]), 0, 2e-8));
    a.springPoints.forEach((v, i) => near(distance(v, b.springPoints[i]), 0, 2e-8));
  }
  for (const t of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) for (const input of [null, {}, { cadence: NaN, amplitude: Infinity }, { cadence: -10, amplitude: 999 }]) finite(sample(t, input));
  assert.deepEqual(inputsOf({ cadence: -10, amplitude: 999 }), { cadence: .025, amplitude: 42 });
  for (const turns of [...D.turns, D.cageTurns, 12, 1]) assert.ok(Number.isInteger(turns));
});

test('actual tooth centers establish pitch spacing, mesh phasing and exact rendered gear ratios', () => withModel(model => {
  const observe = angle => {
    model.update(poseAt(angle)); const all = primitives(model);
    return [...[0, 1, 2].map(i => [`train.gear.${i}`, D.teeth[i], D.radii[i], D.gearCenters[i]]),
      ['train.compound', 15, .075, [D.gearCenters[2][0], D.gearCenters[2][1], -.205]], ['cage.gear', 60, .30, [0, D.center[1], -.205]]].map(([id, teeth, radius, center]) => {
      const boxes = all.filter(p => p.id === id && p.type === 'BoxGeometry'); assert.equal(boxes.length, teeth);
      const root = model.group.getObjectByName(id), inverse = root.matrixWorld.clone().invert();
      boxes.forEach(p => { const local = p.center.clone().applyMatrix4(inverse); near(Math.hypot(local.x, local.y), radius, 2e-7); near(p.center.z, center[2], 2e-7); });
      const first = boxes[0].center; return Math.atan2(first.y - center[1], first.x - center[0]);
    });
  };
  const angle = .103, delta = 1e-4, a = observe(angle), b = observe(angle + delta);
  const velocities = a.map((v, i) => angularDifference(b[i], v) / delta);
  [24, -36, 48, 48, -12].forEach((turns, i) => near(velocities[i], turns, .008));
  near(velocities[0] * 60 + velocities[1] * 40, 0, .4); near(velocities[3] * 15 + velocities[4] * 60, 0, .4);
  near(distance(D.gearCenters[0], D.gearCenters[1]), D.radii[0] + D.radii[1]);
  near(distance(D.gearCenters[1], D.gearCenters[2]), D.radii[1] + D.radii[2]);
  near(Math.hypot(D.gearCenters[2][0], D.gearCenters[2][1] - D.center[1]), .375);
  const contact = (thetaA, thetaB, na, nb, from, to) => {
    const line = Math.atan2(to[1] - from[1], to[0] - from[0]);
    near(angularDifference(na * (thetaA - line) + nb * (thetaB - line - Math.PI), Math.PI), 0, 2e-4);
  };
  contact(a[0], a[1], 60, 40, D.gearCenters[0], D.gearCenters[1]);
  contact(a[1], a[2], 40, 30, D.gearCenters[1], D.gearCenters[2]);
  contact(a[3], a[4], 15, 60, D.gearCenters[2], D.center);
}));

test('rendered spring endpoints, oscillator pivot and escapement follow their actual cage frame', () => withModel(model => {
  for (const amplitude of [15, 42]) for (let n = 0; n < 24; n++) {
    const state = poseAt(n * TAU / 137, { amplitude }); model.update(state);
    const cage = model.group.getObjectByName('cage'), inverse = cage.matrixWorld.clone().invert();
    for (let i = 0; i < D.springCount; i++) {
      const segment = model.group.getObjectByName(`hairspring.segment.${i}`), matrix = inverse.clone().multiply(segment.matrixWorld);
      near(distance(new THREE.Vector3().applyMatrix4(matrix).toArray(), state.springPoints[i]), 0, 2e-12);
      near(distance(new THREE.Vector3(0, SPRING_LENGTHS[i], 0).applyMatrix4(matrix).toArray(), state.springPoints[i + 1]), 0, 2e-12);
    }
    const copper = primitives(model, id => id.startsWith('hairspring.')).filter(p => p.color === 0xa86642);
    assert.equal(copper.length, D.springCount);
    copper.forEach((p, i) => {
      const matrix = inverse.clone().multiply(p.matrix), a = new THREE.Vector3(0, -.5, 0).applyMatrix4(matrix), b = new THREE.Vector3(0, .5, 0).applyMatrix4(matrix);
      near(distance(a.toArray(), state.springPoints[i]), 0, 4e-7); near(distance(b.toArray(), state.springPoints[i + 1]), 0, 4e-7);
    });
    for (const [id, pos] of [['escapement.wheel', D.escapeCenter], ['escapement.fork', D.forkCenter], ['balance', [0, 0, .066]]]) {
      const n = model.group.getObjectByName(id); near(distance(new THREE.Vector3().setFromMatrixPosition(n.matrixWorld).applyMatrix4(inverse).toArray(), pos), 0, 1e-12);
    }
    assert.deepEqual(model.group.getObjectByName('balance').parent, cage);
  }
}));

test('buffer-derived swept annuli clear cage columns and actual fork solids at safe amplitudes', () => withModel(model => {
  let minimumGap = Infinity;
  for (const amplitude of [15, 42]) for (let n = 0; n < 192; n++) {
    // Noncommensurate sampling visits balance extrema and rotating cage phases.
    model.update(poseAt(n * TAU / 191, { amplitude }));
    const all = primitives(model, id => /^(balance|hairspring|cage\.column|cage\.cap|escapement\.fork|escapement\.pallet)/.test(id));
    const inverse = model.group.getObjectByName('cage').matrixWorld.clone().invert();
    const moving = all.filter(p => p.id === 'balance' || /^(balance\.(spoke|weight)|hairspring)/.test(p.id));
    const radius = radialMaximum(moving, inverse);
    for (const column of all.filter(p => /^cage\.(column|cap)/.test(p.id))) {
      const gap = radialLowerBound(column, inverse) - radius; minimumGap = Math.min(minimumGap, gap);
      assert.ok(gap > .02, `moving balance/spring intersects ${column.id}: gap ${gap}`);
    }
    const fork = all.filter(p => /^escapement\.(fork|pallet)/.test(p.id));
    for (const p of moving.filter(p => !p.id.startsWith('hairspring.'))) for (const f of fork) assert.ok(separated(p, f), `${p.id} intersects ${f.id}`);
  }
  assert.ok(minimumGap > .02);
  // Negative control moves a rendered cage post onto a rendered balance spoke.
  // Its triangle-defined cylinder must contain the spoke center, so the
  // separating-envelope test is proved capable of rejecting an actual overlap.
  model.update(poseAt(0)); const all = primitives(model);
  const post = all.find(p => p.id === 'cage.column.0' && p.type === 'CylinderGeometry' && p.color === 0x8b9da6);
  const spoke = all.find(p => p.id === 'balance.spoke.0' && p.type === 'CylinderGeometry' && p.color === 0x8b9da6);
  const shifted = { ...post, center: post.center.clone(), matrix: post.matrix.clone() };
  shifted.center.x = spoke.center.x; shifted.center.y = spoke.center.y;
  shifted.matrix.setPosition(shifted.center);
  assert.equal(separated(shifted, spoke), false); assert.ok(insideConvex(shifted, spoke.center));
  const inverse = model.group.getObjectByName('cage').matrixWorld.clone().invert();
  assert.ok(radialLowerBound(shifted, inverse) < radialMaximum([spoke], inverse));
}));

test('rich assembly metadata survives both qualities and real buffer counts meet the budgets', t => withModel(model => {
  const ids = new Set(model.parts.map(p => p.id)); assert.equal(ids.size, model.parts.length); assert.equal(new Set(model.parts.map(p => p.name)).size, ids.size);
  assert.ok(ids.size >= 100 && ids.size <= 200); assert.ok(new Set(model.parts.map(p => p.system)).size >= 12);
  for (const p of model.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[key] === 'string' && p[key].length > 2);
  let full;
  for (const quality of ['balanced', 'low']) {
    model.update(sample(.4), { quality }); const used = new Set(); let triangles = 0, instances = 0, draws = 0;
    for (const m of model.pickables) {
      triangles += m.count * (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; instances += m.count; if (m.count) draws++;
      for (let i = 0; i < m.count; i++) { assert.ok(ids.has(m.userData.instanceParts[i])); used.add(m.userData.instanceParts[i]); }
    }
    assert.equal(used.size, ids.size); assert.equal(model.stats.triangles, triangles); assert.equal(model.stats.instances, instances); assert.equal(model.stats.drawCalls, draws); assert.equal(model.stats.selectableParts, ids.size);
    t.diagnostic(`${quality}: ${ids.size} parts, ${instances} instances, ${triangles} triangles, ${draws} batches`);
    assert.ok(draws <= 32 && instances <= 2200 && triangles <= 135000);
    if (quality === 'balanced') { full = instances; assert.ok(instances >= 1000 && triangles >= 70000); } else { assert.ok(instances < full && triangles <= 80000); }
  }
}));

test('complete rendered movement stays grounded, vertical, open and compact at every phase', () => withModel(model => {
  for (const amplitude of [15, 42]) for (let n = 0; n < 12; n++) {
    model.update(poseAt(n * TAU / 137, { amplitude })); const b = bounds(model), size = b.getSize(new THREE.Vector3());
    near(b.min.y, 0, 2e-7); assert.ok(b.max.y < 2.35); assert.ok(size.x > 1.8 && size.x < 2.3); assert.ok(size.z < 1.0);
  }
  for (let i = 0; i < 3; i++) {
    const hub = primitives(model, id => id === `train.gear.${i}`).find(p => p.type === 'CylinderGeometry');
    assert.ok(hub.half[0] < D.radii[i] * .18, 'moving gear has no massive blank web disk');
  }
  near(model.group.position.length(), 0); near(model.group.quaternion.angleTo(new THREE.Quaternion()), 0); assert.deepEqual(model.group.scale.toArray(), [1, 1, 1]);
}));

test('all modes, highlights, explosion and master-cycle wraps preserve immutable geometry', () => withModel(model => {
  const state = sample(2.33), immutable = structuredClone(state); model.update(state); const original = snapshot(model);
  const geometries = model.pickables.map(m => m.geometry), buffers = geometries.map(g => g.attributes.position.array.slice());
  for (let k = 0; k < 4; k++) {
    model.update(state, { explode: .81, mode: 'xray', quality: 'high', selectedId: 'balance' }); assert.notDeepEqual(snapshot(model), original);
    for (const m of model.pickables) { const shell = m.material.color.getHex() === 0xced5cf; assert.equal(m.material.transparent, shell); near(m.material.opacity, shell ? .13 : 1); assert.equal(m.material.depthWrite, !shell); }
    model.update(state, { explode: .38, mode: 'cutaway', quality: 'low' });
    for (const m of model.pickables) { assert.equal(m.material.clippingPlanes.length, 1); assert.equal(m.material.side, THREE.DoubleSide); assert.ok(m.material.forceSinglePass); }
    model.update(state, { explode: 0, mode: 'solid', quality: 'balanced' }); assert.deepEqual(snapshot(model), original);
    for (const m of model.pickables) { assert.equal(m.material.clippingPlanes.length, 0); assert.equal(m.material.side, THREE.FrontSide); assert.equal(m.material.opacity, 1); assert.ok(m.material.depthWrite && !m.material.transparent); }
  }
  model.update(undefined); assert.deepEqual(snapshot(model), original); model.update({ driveAngle: state.driveAngle }); assert.deepEqual(snapshot(model), original);
  model.update(state, { selectedId: 'balance' }); const color = new THREE.Color(); let highlighted = 0;
  for (const m of model.pickables) for (let i = 0; i < m.count; i++) { m.getColorAt(i, color); const picked = m.userData.instanceParts[i] === 'balance'; assert.equal(color.getHex() !== 0xffffff, picked); if (picked) highlighted++; }
  assert.ok(highlighted); assert.deepEqual(snapshot(model), original); assert.deepEqual(state, immutable);
  model.update(sample(4.9)); assert.notDeepEqual(snapshot(model), original);
  model.pickables.forEach((m, i) => { assert.equal(m.geometry, geometries[i]); assert.deepEqual(m.geometry.attributes.position.array, buffers[i]); });
  for (const amplitude of [15, 42]) {
    model.update(sample(0, { amplitude })); const a = snapshot(model); model.update(sample(1 / cycleHz(DEFAULT_INPUTS), { amplitude })); assert.deepEqual(snapshot(model), a);
    model.update(sample(-1e-8, { amplitude })); const before = snapshot(model); model.update(sample(1e-8, { amplitude })); const after = snapshot(model);
    before.forEach((b, i) => b.matrix.forEach((v, j) => near(v, after[i].matrix[j], 3e-6)));
  }
}));

test('all exposed GPU resources release once, with idempotent teardown and inert later updates', () => {
  const m = createModel(), resources = new Set(m.pickables.flatMap(p => [p, p.geometry, p.material])), calls = new Map();
  resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) ?? 0) + 1)));
  m.dispose(); m.dispose(); m.update(sample(7)); resources.forEach(r => assert.equal(calls.get(r), 1)); assert.equal(m.group.children.length, 0); assert.equal(m.pickables.length, 0);
});

test('rear train clears the rotating cage, staff spans both jewels and escapement/hand supports connect', () => withModel(model => {
  for (const amplitude of [15, 42]) for (let n = 0; n < 24; n++) {
    model.update(poseAt(n * TAU / 91, { amplitude }));
    const all = primitives(model);
    const train = all.filter(p => /^(train\.(gear|spoke|arbor|compound)|cage\.gear)/.test(p.id));
    const columns = all.filter(p => /^cage\.(column|cap)/.test(p.id));
    for (const a of train) for (const c of columns) assert.ok(separated(a, c), `${a.id}/${a.type} hits ${c.id}/${c.type} at ${n}`);
  }
  model.update(poseAt(0)); const all = primitives(model);
  // The old gear plane crossed the rotating columns. Moving a real column into
  // the rear rim must be rejected by the same gate above.
  const column = all.find(p => p.id === 'cage.column.0' && p.type === 'CylinderGeometry' && p.color === 0x8b9da6);
  const tooth = all.find(p => p.id === 'train.gear.0' && p.type === 'BoxGeometry' && p.color === 0xb28b4d);
  const placed = { ...column, center: tooth.center.clone(), matrix: column.matrix.clone() }; placed.matrix.setPosition(placed.center);
  assert.equal(separated(placed, tooth), false, 'a column moved into the rear train must be rejected');
  // The balance staff must occupy the full space between both real jewels.
  const staff = all.find(p => p.id === 'balance' && p.type === 'CylinderGeometry' && p.color === 0x8b9da6 && Math.abs(p.half[1] - .175) < 1e-6);
  assert.ok(staff, 'one continuous balance staff'); near(Math.abs(staff.axes[1].z), 1, 1e-6);
  const ends = [staff.center.clone().addScaledVector(staff.axes[1], -.175), staff.center.clone().addScaledVector(staff.axes[1], .175)];
  near(Math.min(...ends.map(e => e.z)), -.07, .001); near(Math.max(...ends.map(e => e.z)), .28, .001);
  // Fork and escape wheel must share one actual plane, and the fork cock must
  // meet both its pivot and the escape bridge jewel.
  model.group.updateMatrixWorld(true);
  near(model.group.getObjectByName('escapement.wheel').getWorldPosition(new THREE.Vector3()).z, model.group.getObjectByName('escapement.fork').getWorldPosition(new THREE.Vector3()).z, 1e-9);
  const cock = all.filter(p => p.id === 'escapement.bridge' && p.type === 'CylinderGeometry' && p.color === 0x8b9da6 && p.half[1] > .05 && p.half[1] < .09);
  assert.ok(cock.length >= 1, 'fork cock exists');
  const forkPivot = model.group.getObjectByName('escapement.fork').getWorldPosition(new THREE.Vector3());
  const bridgeJewel = all.filter(p => p.id === 'escapement.bridge' && p.type === 'TorusGeometry' && p.color === 0xb28b4d)
    .map(p => p.center).filter(c => c.distanceTo(forkPivot) > .05 && c.distanceTo(forkPivot) < .2)
    .sort((a, b) => a.distanceTo(forkPivot) - b.distanceTo(forkPivot))[0];
  assert.ok(bridgeJewel, 'bridge jewel near the fork pivot');
  assert.ok(cock.some(c => {
    const a = c.center.clone().addScaledVector(c.axes[1], -c.half[1]), b = c.center.clone().addScaledVector(c.axes[1], c.half[1]);
    return (a.distanceTo(forkPivot) < .006 && b.distanceTo(bridgeJewel) < .006) || (b.distanceTo(forkPivot) < .006 && a.distanceTo(bridgeJewel) < .006);
  }), 'fork cock joins its pivot to the escape bridge');
  const collars = all.filter(p => p.id === 'escapement.bridge' && p.type === 'TorusGeometry' && p.color === 0xb28b4d)
    .map(p => p.center).filter(c => Math.abs(Math.hypot(c.x, c.y - 1.18) - .294) < .006);
  assert.equal(collars.length, 2, 'two bridge ends carry real column collars');
  for (const collar of collars) assert.ok(all.some(p => p.id === 'escapement.bridge' && p.type === 'CylinderGeometry' && p.color === 0x8b9da6 && (
    p.center.clone().addScaledVector(p.axes[1], p.half[1]).distanceTo(collar) < .006 ||
    p.center.clone().addScaledVector(p.axes[1], -p.half[1]).distanceTo(collar) < .006
  )), 'a physical stay reaches each column collar');
  // Hand bridge: the rear stay must reach the rotating hand arbor and the foot.
  const arbor = all.find(p => p.id === 'hands.bridge' && p.type === 'CylinderGeometry' && p.color === 0x8b9da6 && Math.abs(p.half[1] - .35) < 1e-6);
  assert.ok(arbor); near(arbor.center.z - arbor.half[1], -.25, .001);
  const stay = all.find(p => p.id === 'hands.bridge' && p.type === 'CylinderGeometry' && p.color === 0x26343d && p.half[1] > .7);
  assert.ok(stay); near(stay.center.z, -.24, .001);
  const footStay = all.find(p => p.id === 'hands.bridge' && p.type === 'CylinderGeometry' && p.color === 0x26343d && p.half[1] < .2 && p.half[1] > .1);
  assert.ok(footStay);
}));
