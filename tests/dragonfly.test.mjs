import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/dragonfly/index.js';
import { createModel } from '../src/mechanisms/dragonfly/model.js';
import { D, TAU, DEFAULT_INPUTS, ROCKER_DATUM, inputsOf, cycleHz, solveShoulder, wingPoint, poseAt, sample } from '../src/mechanisms/dragonfly/kin.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const finite = value => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
};
const withModel = fn => { const model = createModel(); try { fn(model); } finally { model.dispose(); } };
function snapshot(model) {
  return model.pickables.map(mesh => ({ ids: mesh.userData.instanceParts.slice(0, mesh.count), matrix: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)) }));
}
function bounds(model) {
  const box = new THREE.Box3(), matrix = new THREE.Matrix4(), p = new THREE.Vector3();
  for (const mesh of model.pickables) for (let j = 0; j < mesh.count; j++) {
    mesh.getMatrixAt(j, matrix);
    assert.ok(matrix.determinant() > 0, 'mirrors must use rotations, not negative instance scale');
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) box.expandByPoint(p.fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(matrix));
  }
  return box;
}

// Read the rendered instances, not the dimension constants: bounds retain each
// primitive's own axes (cylinders are Y-axis geometry, rings are Z-axis geometry).
function primitives(model, accepts) {
  const result = [];
  for (const mesh of model.pickables) {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    for (let i = 0; i < mesh.count; i++) {
      const id = mesh.userData.instanceParts[i]; if (!accepts(id)) continue;
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
      const axes = [0, 1, 2].map(j => new THREE.Vector3().setFromMatrixColumn(matrix, j));
      const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5).toArray().map((v, j) => v * axes[j].length());
      axes.forEach(a => a.normalize());
      result.push({ id, matrix, axes, half, center: box.getCenter(new THREE.Vector3()).applyMatrix4(matrix),
        geometry: mesh.geometry, color: mesh.material.color.getHex(), type: mesh.geometry.type });
    }
  }
  return result;
}
function separated(a, b, gap = 1e-6) {
  const delta = b.center.clone().sub(a.center);
  if (delta.length() > Math.hypot(...a.half) + Math.hypot(...b.half) + gap) return true;
  const separates = axis => {
    const length = axis.length(); if (length < 1e-8) return false;
    const radius = p => p.half.reduce((sum, h, i) => sum + h * Math.abs(p.axes[i].dot(axis)), 0);
    return Math.abs(delta.dot(axis)) > radius(a) + radius(b) + gap * length;
  };
  if ([...a.axes, ...b.axes].some(separates)) return true;
  return a.axes.some(x => b.axes.some(y => separates(new THREE.Vector3().crossVectors(x, y))));
}
const brassShaft = p => p.type === 'CylinderGeometry' && p.color === 0xb28b4d;
const eye = p => p.type === 'TorusGeometry';
function journalEngaged(shaft, bush) {
  const a = new THREE.Vector3(0, -0.5, 0).applyMatrix4(shaft.matrix);
  const b = new THREE.Vector3(0, 0.5, 0).applyMatrix4(shaft.matrix);
  const axis = b.clone().sub(a).normalize(), delta = bush.center.clone().sub(a);
  near(delta.clone().cross(axis).length(), 0, 2e-7);
  near(Math.abs(axis.dot(bush.axes[1])), 1, 2e-6);
  const along = delta.dot(axis);
  assert.ok(along - bush.half[1] >= -2e-7 && along + bush.half[1] <= a.distanceTo(b) + 2e-7, 'journal spans the entire endpoint bush');
}
// A strict point-in-convex-polyhedron check makes the coplanar negative control
// an actual disk penetration, not merely overlapping conservative bounding boxes.
function insidePrimitive(p, worldPoint) {
  const q = worldPoint.clone().applyMatrix4(p.matrix.clone().invert());
  const positions = p.geometry.attributes.position, index = p.geometry.index;
  for (let i = 0; i < index.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 2));
    const normal = b.sub(a).cross(c.sub(a));
    if (normal.lengthSq() > 1e-15 && normal.normalize().dot(q.clone().sub(a)) >= -1e-6) return false;
  }
  return true;
}

test('LIBELLE descriptor exposes two bounded controls, five real lessons and lazy model', async () => {
  assert.equal(descriptor.id, 'dragonfly'); assert.equal(descriptor.title, 'LIBELLE D4'); assert.equal(descriptor.collection, '006');
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const control of descriptor.controls) {
    assert.ok(control.key in DEFAULT_INPUTS); assert.ok(control.min < control.max); assert.ok(control.step > 0);
    for (const key of ['key', 'label', 'unit']) assert.ok(control[key].length);
    assert.ok(Number.isInteger(control.precision));
  }
  for (const lesson of descriptor.lessons) {
    assert.ok(lesson.text.length > 180 && lesson.fact.length > 30 && lesson.short.length > 4);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(lesson.view));
    assert.ok(['solid', 'xray', 'cutaway'].includes(lesson.mode)); assert.ok(lesson.explode >= 0 && lesson.explode <= 1);
  }
  assert.match(descriptor.description, /not a flight/);
  assert.deepEqual(descriptor.sample(0), sample(0)); near(descriptor.cycleHz(DEFAULT_INPUTS), 0.55);
  const model = await descriptor.createModel(); assert.ok(model.group.isGroup && model.pickables.length > 0); model.dispose();
});

test('all four shoulders close rigid crank-rocker loops at every control extreme', () => {
  for (const cadence of [0.15, 0.55, 1.2]) for (const eccentric of [18, 28, 40]) for (let n = 0; n < 720; n++) {
    const p = poseAt(n * TAU / 720, { cadence, eccentric }); finite(p);
    for (const w of p.wings) {
      near(distance(w.crank, D.crankOrigin), eccentric / 1000);
      near(Math.hypot(...w.rocker), D.rocker);
      near(distance(w.crank, w.rocker), D.conrod);
      near(Math.atan2(w.rocker[1], w.rocker[0]) - ROCKER_DATUM, w.angle);
    }
    near(p.wings[0].angle, p.wings[1].angle); near(p.wings[2].angle, p.wings[3].angle);
    near(p.wings[2].phaseAngle - p.wings[0].phaseAngle, Math.PI);
    near(p.wings[0].tip[0], -p.wings[1].tip[0]); near(p.wings[0].tip[1], p.wings[1].tip[1]);
    for (const a of p.abdomen) near(distance(a.start, a.end), D.abdomenLength);
    for (const l of p.legs) D.legLengths.forEach((length, j) => near(distance(l.joints[j], l.joints[j + 1]), length));
    near(p.metrics.abdomenLength, 0.992); assert.ok(p.metrics.linkResidualMm < 1e-10);
  }
});

test('eccentric changes excursion and analytical tip-speed readout follows the actual linkage', () => {
  const excursions = [];
  for (const eccentric of [18, 40]) {
    const angles = Array.from({ length: 720 }, (_, i) => solveShoulder(i * TAU / 720, eccentric).angle);
    excursions.push(Math.max(...angles) - Math.min(...angles));
  }
  assert.ok(excursions[1] > excursions[0] * 1.9);
  for (const eccentric of [18, 28, 40]) for (const a of [0, 0.3, 1.9, 4, 6.1]) {
    const e = 1e-6, s = solveShoulder(a, eccentric);
    near(s.derivative, (solveShoulder(a + e, eccentric).angle - solveShoulder(a - e, eccentric).angle) / (2 * e), 2e-9);
    const input = { cadence: 0.82, eccentric }, p = poseAt(a, input);
    const dt = 1e-6, before = poseAt(a - TAU * input.cadence * dt, input), after = poseAt(a + TAU * input.cadence * dt, input);
    near(p.metrics.foreTipSpeed, distance(before.wings[0].tip, after.wings[0].tip) / (2 * dt), 2e-8);
  }
});

test('sampler is deterministic, periodic, finite, reversible and continuous through cycle wrap', () => {
  for (const cadence of [0.15, 1.2]) for (const eccentric of [18, 40]) for (const t of [-999, -1.234, 0, 0.49, 19, 100000]) {
    const input = { cadence, eccentric }, a = sample(t, input); finite(a);
    assert.ok(a.phase >= 0 && a.phase < 1); sample(t + 700, { eccentric: 22 }); assert.deepEqual(sample(t, input), a);
    const b = sample(t + 1 / cadence, input);
    a.wings.forEach((w, i) => near(distance(w.tip, b.wings[i].tip), 0, 5e-9));
    a.abdomen.forEach((s, i) => near(distance(s.end, b.abdomen[i].end), 0, 5e-9));
    near(cycleHz(input), cadence);
  }
  for (const t of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) for (const input of [null, {}, { cadence: NaN, eccentric: Infinity }, { cadence: -9, eccentric: 999 }]) finite(sample(t, input));
  assert.deepEqual(inputsOf({ cadence: -100, eccentric: 900 }), { cadence: 0.15, eccentric: 40 });
  const a = sample(-1e-8), b = sample(1e-8); a.wings.forEach((w, i) => near(distance(w.tip, b.wings[i].tip), 0, 1e-7));
});

test('wing outlines are highly elongated, tapered and independently separated fore/aft', () => {
  for (const station of [0, 1]) for (const side of [-1, 1]) {
    const root = wingPoint(station, side, 0), tip = wingPoint(station, side, 1);
    near(tip[0] - root[0], D.span);
    near(distance(wingPoint(station, side, 1, -0.5), wingPoint(station, side, 1, 0.5)), 0, 1e-9);
    const width = distance(wingPoint(station, side, 0.5, -0.5), wingPoint(station, side, 0.5, 0.5));
    assert.ok(D.span / width > 4.7);
  }
});

test('all 129 assemblies have unique useful metadata and reachable geometry in both quality tiers', () => withModel(model => {
  assert.ok(model.parts.length >= 55); assert.equal(model.parts.length, 129);
  const ids = new Set(model.parts.map(p => p.id)); assert.equal(ids.size, model.parts.length);
  assert.equal(new Set(model.parts.map(p => p.name)).size, ids.size);
  for (const part of model.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof part[key] === 'string' && part[key].length > 2);
  for (const quality of ['low', 'balanced']) {
    model.update(sample(0.4), { quality }); const used = new Set();
    for (const mesh of model.pickables) {
      assert.ok(mesh.isInstancedMesh);
      for (let i = 0; i < mesh.count; i++) { const id = mesh.userData.instanceParts[i]; assert.ok(ids.has(id)); used.add(id); }
    }
    assert.equal(used.size, ids.size);
  }
  assert.equal(model.parts.filter(p => /venation bay/.test(p.name)).length, 28);
  assert.equal(model.parts.filter(p => p.id.endsWith('.conrod')).length, 4);
}));

test('actual primitive triangle and draw totals remain inside the mobile color-pass budget', () => withModel(model => {
  let fullInstances;
  for (const quality of ['balanced', 'high', 'low']) for (const mode of ['solid', 'xray', 'cutaway']) {
    model.update(sample(0.72), { quality, mode });
    let instances = 0, triangles = 0, draws = 0;
    for (const m of model.pickables) if (m.count) {
      instances += m.count; triangles += m.count * (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
      draws += m.material.transparent && m.material.side === THREE.DoubleSide && !m.material.forceSinglePass ? 2 : 1;
    }
    assert.equal(model.stats.instances, instances); assert.equal(model.stats.triangles, triangles); assert.equal(model.stats.drawCalls, draws);
    assert.equal(model.stats.selectableParts, model.parts.length);
    assert.ok(triangles <= 110000 && draws <= 48 && instances <= 2000);
    if (quality !== 'low') { assert.ok(instances >= 900); fullInstances = instances; } else assert.ok(instances < fullInstances);
  }
}));

test('rendered rigid endpoints agree with the sampled shoulder, leg and abdomen pins', () => withModel(model => {
  const p = sample(0.37, { cadence: 1.2, eccentric: 40 }); model.update(p);
  const v = new THREE.Vector3();
  for (const w of p.wings) {
    const root = model.group.getObjectByName(`wing.${w.id}.housing`), link = model.group.getObjectByName(`wing.${w.id}.conrod`);
    const start = v.set(0, 0, 0).applyMatrix4(link.matrixWorld).toArray();
    const end = v.set(0, D.conrod, 0).applyMatrix4(link.matrixWorld).toArray();
    near(distance(start, v.set(w.crank[0], w.crank[1], D.conrodZ).applyMatrix4(root.matrixWorld).toArray()), 0);
    near(distance(end, v.set(w.rocker[0], w.rocker[1], D.conrodZ).applyMatrix4(root.matrixWorld).toArray()), 0);
  }
  p.abdomen.forEach((s, i) => {
    const n = model.group.getObjectByName(`abdomen.${i + 1}.frame`);
    near(distance(v.set(0, 0, D.abdomenLength).applyMatrix4(n.matrixWorld).toArray(), s.end), 0);
  });
  for (const l of p.legs) for (let j = 0; j < 3; j++) {
    const root = model.group.getObjectByName(`leg.${l.id}.coxa`), link = model.group.getObjectByName(`leg.${l.id}.${['femur', 'tibia', 'tarsus'][j]}`);
    near(distance(v.set(0, D.legLengths[j], 0).applyMatrix4(link.matrixWorld).toArray(), v.fromArray(l.joints[j + 1]).applyMatrix4(root.matrixWorld).toArray()), 0);
  }
}));

test('shoulder rods, eyes and extended journals sweep clear of disks, rockers and adjacent wing frames', () => withModel(model => {
  let coplanarPenetrations = 0, poses = 0;
  for (const cadence of [0.15, 1.2]) for (const eccentric of [18, 28, 40]) for (let n = 0; n <= 720; n++) {
    const state = poseAt(n * TAU / 720, { cadence, eccentric }); model.update(state);
    const rendered = primitives(model, id => id.startsWith('wing.') || id.startsWith('thorax.cover.'));
    for (const w of state.wings) {
      const prefix = `wing.${w.id}`, own = suffix => rendered.filter(p => p.id === `${prefix}.${suffix}`);
      const rods = own('conrod'), bushes = rods.filter(brassShaft), eyes = rods.filter(eye);
      const shafts = [...own('eccentric'), ...own('rocker')].filter(brassShaft);
      assert.equal(bushes.length, 2); assert.equal(eyes.length, 2); assert.equal(shafts.length, 2);
      const root = model.group.getObjectByName(`${prefix}.housing`);
      const inverse = root.matrixWorld.clone().invert(), normal = new THREE.Vector3(0, 0, 1).transformDirection(root.matrixWorld);
      const centers = eyes.map(e => e.center.clone().applyMatrix4(inverse));
      near(centers[0].z, centers[1].z, 2e-7);
      near(centers[0].distanceTo(centers[1]), 0.155, 2e-7);
      near(Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y), 0.155, 2e-7);
      for (let i = 0; i < 2; i++) {
        const solved = i ? w.rocker : w.crank;
        near(centers[i].x, solved[0], 2e-7); near(centers[i].y, solved[1], 2e-7);
        journalEngaged(shafts[i], bushes[i]);
      }
      // Journal/bush engagement is intentional; all other rocker hardware,
      // every gear primitive, housing stay, fairing and wing bay must separate.
      const obstacles = [...own('gear'), ...own('rocker').filter(p => !brassShaft(p)), ...own('housing'),
        ...rendered.filter(p => p.id.startsWith(`${prefix}.bay.`) || p.id === `${prefix}.balance` || p.id.startsWith('thorax.cover.'))];
      for (const rod of rods) for (const obstacle of obstacles) {
        assert.ok(separated(rod, obstacle), `${prefix} ${eccentric} mm phase ${n}: ${rod.type} touches ${obstacle.id}/${obstacle.type}`);
      }
      // Reproduce the old z=0 rails with the actual rendered rail and disk axes.
      const disk = own('gear').find(brassShaft);
      const rails = rods.filter(p => p.type === 'CylinderGeometry' && p.color === 0x8b9da6);
      assert.equal(rails.length, 2);
      if (rails.some(rail => insidePrimitive(disk, new THREE.Vector3(0, -0.45, 0).applyMatrix4(rail.matrix).addScaledVector(normal, -centers[0].z)))) coplanarPenetrations++;
    }
    poses++;
  }
  assert.equal(poses, 4326); assert.ok(coplanarPenetrations > 0, 'coplanar regression must penetrate a real disk');
}));

test('grounded stand and complete moving geometry fit the normalized three-metre envelope', () => withModel(model => {
  for (const eccentric of [18, 40]) for (let i = 0; i < 16; i++) {
    model.update(poseAt(i * TAU / 16, { eccentric })); const b = bounds(model), size = b.getSize(new THREE.Vector3());
    near(b.min.y, 0, 1e-7); assert.ok(b.max.y <= 2.2, `height ${b.max.y}`);
    assert.ok(Math.max(size.x, size.z) <= 3.05, `size ${size.toArray()}`);
    near((b.min.x + b.max.x) / 2, 0, 1e-6); assert.ok(Math.abs((b.min.z + b.max.z) / 2) < 0.1);
  }
}));

test('explosion, section, x-ray, selection and quality reverse without altering any instance matrix', () => withModel(model => {
  const state = sample(0.33), immutable = structuredClone(state); model.update(state); const original = snapshot(model);
  for (let i = 0; i < 4; i++) {
    model.update(state, { explode: 0.83, mode: 'xray', selectedId: 'wing.fore.L.conrod', quality: 'high' });
    assert.notDeepEqual(snapshot(model), original);
    model.update(state, { explode: 0.41, mode: 'cutaway', quality: 'low' });
    model.update(state, { explode: 0, mode: 'solid', quality: 'balanced' }); assert.deepEqual(snapshot(model), original);
  }
  model.update(undefined); assert.deepEqual(snapshot(model), original);
  model.update({ driveAngle: state.driveAngle }); assert.deepEqual(snapshot(model), original);
  assert.deepEqual(state, immutable);
  model.update(state, { selectedId: 'wing.fore.L.conrod' }); const color = new THREE.Color(); let highlighted = 0;
  for (const m of model.pickables) for (let i = 0; i < m.count; i++) {
    m.getColorAt(i, color); const picked = m.userData.instanceParts[i] === 'wing.fore.L.conrod';
    assert.equal(color.getHex() !== 0xffffff, picked); if (picked) highlighted++;
  }
  assert.ok(highlighted > 0); assert.deepEqual(snapshot(model), original);
  model.update(state);
  for (const m of model.pickables) for (let i = 0; i < m.count; i++) { m.getColorAt(i, color); assert.equal(color.getHex(), 0xffffff); }
}));

test('only armor ghosts; clipping, opacity, side and depth state reset on solid', () => withModel(model => {
  model.update(undefined, { mode: 'xray' }); let ghosts = 0;
  for (const m of model.pickables) {
    const shell = m.material.color.getHex() === 0xced5cf;
    assert.equal(m.material.transparent, shell); near(m.material.opacity, shell ? 0.13 : 1);
    assert.equal(m.material.depthWrite, !shell); if (shell) ghosts++;
  }
  assert.ok(ghosts > 0);
  model.update(undefined, { mode: 'cutaway' });
  for (const m of model.pickables) {
    assert.equal(m.material.clippingPlanes.length, 1); assert.equal(m.material.side, THREE.DoubleSide);
    assert.ok(!m.material.transparent && m.material.depthWrite); near(m.material.opacity, 1);
    near(m.material.clippingPlanes[0].distanceToPoint(new THREE.Vector3(0, 1, 1)), 0);
  }
  model.update(undefined, { mode: 'solid' });
  for (const m of model.pickables) {
    assert.equal(m.material.clippingPlanes.length, 0); assert.equal(m.material.side, THREE.FrontSide);
    assert.ok(!m.material.transparent && m.material.depthWrite); near(m.material.opacity, 1);
  }
}));

test('animation retains geometry buffers and disposal releases all resources exactly once', () => {
  const model = createModel();
  const resources = new Set(model.pickables.flatMap(m => [m, m.geometry, m.material])), calls = new Map();
  const geometries = model.pickables.map(m => m.geometry), buffers = geometries.map(g => g.attributes.position.array.slice());
  resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) ?? 0) + 1)));
  for (let i = 0; i < 48; i++) model.update(sample(i * 0.073), { explode: i % 2 ? 0.7 : 0, quality: i % 3 ? 'balanced' : 'low' });
  model.pickables.forEach((m, i) => { assert.equal(m.geometry, geometries[i]); assert.deepEqual(m.geometry.attributes.position.array, buffers[i]); finite(Array.from(m.instanceMatrix.array)); });
  model.dispose(); model.dispose(); model.update(sample(2));
  resources.forEach(r => assert.equal(calls.get(r), 1)); assert.equal(model.group.children.length, 0); assert.equal(model.pickables.length, 0);
});
