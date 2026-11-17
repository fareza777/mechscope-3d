import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/robot-fish/index.js';
import { createModel } from '../src/mechanisms/robot-fish/model.js';
import { F, TAU, DEFAULT_INPUTS, GILL_DATUM, inputsOf, cycleHz, solveGill, transformPoint, caudalPoint, pectoralPoint, poseAt, sample } from '../src/mechanisms/robot-fish/kin.js';

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
    mesh.getMatrixAt(j, matrix); assert.ok(matrix.determinant() > 0, 'positive-determinant instance transform');
    for (let i = 0; i < mesh.geometry.attributes.position.count; i++) box.expandByPoint(p.fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(matrix));
  }
  return box;
}

// Bounds come from rendered geometry and retain each primitive's actual axes;
// the carrier rotates its local Z into opposite world-Y directions on the fish.
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
  if (a.axes.some(x => b.axes.some(y => separates(new THREE.Vector3().crossVectors(x, y))))) return true;
  // The operculum's ellipsoid box includes empty corners. Use actual vertex
  // support on mesh-face normals before reporting a conservative-box overlap.
  const vertices = p => p.vertices ??= Array.from({ length: p.geometry.attributes.position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(p.geometry.attributes.position, i).applyMatrix4(p.matrix));
  const av = vertices(a), bv = vertices(b);
  const meshSeparates = axis => {
    if (axis.lengthSq() < 1e-15) return false;
    axis.normalize();
    const range = points => { let min = Infinity, max = -Infinity; for (const p of points) { const v = p.dot(axis); min = Math.min(min, v); max = Math.max(max, v); } return [min, max]; };
    const ar = range(av), br = range(bv);
    return ar[1] + gap < br[0] || br[1] + gap < ar[0];
  };
  for (const p of [a, b]) {
    const points = vertices(p), index = p.geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const origin = points[index.getX(i)];
      const normal = points[index.getX(i + 1)].clone().sub(origin).cross(points[index.getX(i + 2)].clone().sub(origin));
      if (meshSeparates(normal)) return true;
    }
  }
  return false;
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
// Convex triangle half-spaces prove penetration of the actual disk mesh in the
// coplanar negative control, rather than relying on a bounding-box false positive.
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

test('PISCES descriptor exposes the complete lazy contract, two controls and five measured lessons', async () => {
  assert.equal(descriptor.id, 'robot-fish'); assert.equal(descriptor.title, 'PISCES K9'); assert.equal(descriptor.collection, '009');
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const c of descriptor.controls) {
    assert.ok(c.key in DEFAULT_INPUTS); assert.ok(c.min < c.max && c.step > 0);
    assert.ok(c.label.length && c.unit.length && Number.isInteger(c.precision));
  }
  for (const l of descriptor.lessons) {
    assert.ok(l.title.length > 4 && l.short.length > 4 && l.text.length > 180 && l.fact.length > 30);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view));
    assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  assert.match(descriptor.description, /not a hydrodynamic/);
  assert.deepEqual(descriptor.sample(0), sample(0)); near(descriptor.cycleHz(DEFAULT_INPUTS), 0.45);
  const m = await descriptor.createModel(); assert.ok(m.group.isGroup && m.pickables.length > 0); m.dispose();
});

test('eight exact-length links generate a traveling relative-heading wave across both control extrema', () => {
  for (const cadence of [0.12, 0.45, 1.1]) for (const amplitude of [6, 16, 22]) for (let n = 0; n < 720; n++) {
    const a = n * TAU / 720, p = poseAt(a, { cadence, amplitude }); finite(p);
    assert.equal(p.segments.length, 8); assert.equal(p.points.length, 9); near(p.metrics.spineLength, 1.61);
    let total = 0, yaw = 0;
    p.segments.forEach((s, i) => {
      near(distance(s.start, s.end), F.lengths[i]); total += distance(s.start, s.end);
      const gain = i ? 0.23 + 0.77 * (i / 7) ** 1.5 : 0;
      near(s.jointAngle, amplitude * Math.PI / 180 * gain * Math.sin(a - i * F.phaseLag));
      yaw += s.jointAngle; near(s.yaw, yaw);
      near(distance(s.end, transformPoint(s.start, s.yaw, [0, 0, s.length])), 0);
      assert.deepEqual(s.start, p.points[i]); assert.deepEqual(s.end, p.points[i + 1]);
    });
    near(total, 1.61); near(p.segments[0].yaw, 0); assert.deepEqual(p.points[0], [...F.root]);
    assert.ok(p.metrics.maxJointDeg <= amplitude + 1e-9);
    near(p.pectorals[0].angle + p.pectorals[1].angle, -0.4);
  }
});

test('gill loop lengths and cover datum remain exact rather than interpolated', () => {
  let min = Infinity, max = -Infinity;
  for (let n = 0; n < 1440; n++) {
    const g = solveGill(n * TAU / 1440);
    near(distance(g.crank, F.gillOrigin), F.gillCrank); near(Math.hypot(...g.rocker), F.gillRocker);
    near(distance(g.crank, g.rocker), F.gillRod);
    near(Math.atan2(g.rocker[1], g.rocker[0]) - GILL_DATUM, g.angle);
    min = Math.min(min, -g.angle); max = Math.max(max, -g.angle);
  }
  assert.ok(max - min > 0.25); assert.ok(min > 0, 'cover remains on its open-side assembly branch');
});

test('tendon lengths and reported differentials reconcile with offset guides', () => {
  for (const amplitude of [6, 22]) for (let n = 0; n < 180; n++) {
    const p = poseAt(n * TAU / 180, { amplitude }); let maxDifference = 0;
    p.tendons.forEach(t => {
      const s = p.segments[t.segment], next = p.segments[t.segment + 1];
      const local = [t.side * F.tendonOffset, -0.025, 0.018];
      near(distance(t.a, transformPoint(s.start, s.yaw, local)), 0);
      near(distance(t.b, transformPoint(s.end, next?.yaw ?? s.yaw, local)), 0);
      near(distance(t.a, t.b), t.length); assert.ok(t.length > 0.1 && t.length < 0.28);
    });
    for (let i = 0; i < 8; i++) maxDifference = Math.max(maxDifference, Math.abs(p.tendons[i * 2].length - p.tendons[i * 2 + 1].length));
    near(p.metrics.tendonDifferentialMm, maxDifference * 1000);
    near(p.metrics.tailLateralMm, p.points.at(-1)[0] * 1000); assert.ok(p.metrics.gillResidualMm < 1e-10);
  }
});

test('tail pin speed is the analytic derivative of the same rigid-chain pose', () => {
  for (const amplitude of [6, 16, 22]) for (const cadence of [0.12, 1.1]) for (const a of [0, 0.7, 2.1, 4.8, 6.1]) {
    const input = { amplitude, cadence }, dt = 1e-6;
    const p = poseAt(a, input), before = poseAt(a - TAU * cadence * dt, input), after = poseAt(a + TAU * cadence * dt, input);
    near(p.metrics.tailPeduncleSpeed, distance(before.points.at(-1), after.points.at(-1)) / (2 * dt), 3e-9);
    near(distance(p.tailTip, transformPoint(p.points.at(-1), p.segments.at(-1).yaw + p.tailAngle, caudalPoint(1))), 0);
  }
});

test('pure sampler is deterministic, finite and periodic including reverse time and wrap', () => {
  for (const cadence of [0.12, 1.1]) for (const amplitude of [6, 22]) for (const t of [-9999, -1.23, 0, 0.372, 41, 100000]) {
    const input = { cadence, amplitude }, p = sample(t, input); finite(p); assert.ok(p.phase >= 0 && p.phase < 1);
    sample(555, { amplitude: 11 }); assert.deepEqual(p, sample(t, input));
    const next = sample(t + 1 / cadence, input);
    p.points.forEach((point, i) => near(distance(point, next.points[i]), 0, 5e-9));
    p.gills.forEach((g, i) => near(g.angle, next.gills[i].angle, 5e-9)); near(p.tailAngle, next.tailAngle, 5e-9);
    near(cycleHz(input), cadence);
  }
  for (const t of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) for (const input of [null, {}, { cadence: Infinity, amplitude: NaN }, { cadence: -200, amplitude: 999 }]) finite(sample(t, input));
  assert.deepEqual(inputsOf({ cadence: -100, amplitude: 900 }), { cadence: 0.12, amplitude: 22 });
  const a = sample(-1e-8), b = sample(1e-8); a.points.forEach((p, i) => near(distance(p, b.points[i]), 0, 1e-7));
});

test('fin outlines retain a forked tail, lateral pectorals and tapered body proportions', () => {
  near(caudalPoint(-1)[1], -caudalPoint(1)[1]); near(caudalPoint(-1)[2], caudalPoint(1)[2]);
  assert.ok(caudalPoint(1)[2] - caudalPoint(0)[2] > 0.16);
  assert.ok(pectoralPoint(0.5)[0] > 0.4); assert.ok(pectoralPoint(0.5)[1] < 0);
  assert.ok(F.widths[1] / F.widths.at(-1) > 4.8); assert.ok(F.heights[1] / F.heights.at(-1) > 4.6);
});

test('139 independently selectable assemblies have unique useful metadata and populated instances', () => withModel(model => {
  assert.ok(model.parts.length >= 55); assert.equal(model.parts.length, 139);
  const ids = new Set(model.parts.map(p => p.id)); assert.equal(ids.size, model.parts.length);
  assert.equal(new Set(model.parts.map(p => p.name)).size, ids.size);
  for (const part of model.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof part[key] === 'string' && part[key].length > 2);
  for (const quality of ['low', 'balanced']) {
    model.update(sample(0.2), { quality }); const used = new Set(); let scales = 0;
    for (const m of model.pickables) {
      assert.ok(m.isInstancedMesh);
      for (let i = 0; i < m.count; i++) {
        const id = m.userData.instanceParts[i]; assert.ok(ids.has(id)); used.add(id);
        if (/^spine\.\d+\.armor\./.test(id) && m.geometry.type === 'SphereGeometry') scales++;
      }
    }
    assert.equal(used.size, ids.size); assert.equal(scales, 192);
  }
  assert.equal(model.parts.filter(p => p.id.startsWith('caudal.ray.')).length, 13);
  assert.equal(model.parts.filter(p => /pectoral.*\.ray\./.test(p.id)).length, 14);
}));

test('actual triangles, instances and material-pass draws fit the mobile geometry gates', () => withModel(model => {
  let full;
  for (const quality of ['balanced', 'high', 'low']) for (const mode of ['solid', 'xray', 'cutaway']) {
    model.update(sample(0.34), { quality, mode });
    let instances = 0, triangles = 0, draws = 0;
    for (const m of model.pickables) if (m.count) {
      instances += m.count; triangles += m.count * (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
      draws += m.material.transparent && m.material.side === THREE.DoubleSide && !m.material.forceSinglePass ? 2 : 1;
    }
    assert.equal(model.stats.instances, instances); assert.equal(model.stats.triangles, triangles); assert.equal(model.stats.drawCalls, draws);
    assert.equal(model.stats.selectableParts, model.parts.length);
    assert.ok(triangles <= 110000 && draws <= 48 && instances <= 2000);
    if (quality !== 'low') { assert.ok(instances >= 900); full = instances; } else assert.ok(instances < full);
  }
}));

test('rendered spine, variable cable spans and gill linkage endpoints coincide with the solved pose', () => withModel(model => {
  for (const amplitude of [6, 22]) for (const t of [0, 0.22, 0.9]) {
    const p = sample(t, { amplitude, cadence: 1.1 }); model.update(p); const v = new THREE.Vector3();
    p.segments.forEach((s, i) => {
      const node = model.group.getObjectByName(`spine.${i + 1}.frame`);
      near(distance(v.set(0, 0, 0).applyMatrix4(node.matrixWorld).toArray(), s.start), 0);
      near(distance(v.set(0, 0, s.length).applyMatrix4(node.matrixWorld).toArray(), s.end), 0);
    });
    p.tendons.forEach(tendon => {
      const n = model.group.getObjectByName(`spine.${tendon.segment + 1}.tendon.${tendon.side}`);
      near(distance(v.set(0, 0, 0).applyMatrix4(n.matrixWorld).toArray(), tendon.a), 0);
      near(distance(v.set(0, 1, 0).applyMatrix4(n.matrixWorld).toArray(), tendon.b), 0);
    });
    p.gills.forEach(g => {
      const root = model.group.getObjectByName(`gill.${g.side}.carrier`), link = model.group.getObjectByName(`gill.${g.side}.conrod`);
      near(distance(v.set(0, 0, 0).applyMatrix4(link.matrixWorld).toArray(), v.set(g.crank[0], g.crank[1], F.gillRodZ).applyMatrix4(root.matrixWorld).toArray()), 0);
      near(distance(v.set(0, F.gillRod, 0).applyMatrix4(link.matrixWorld).toArray(), v.set(g.rocker[0], g.rocker[1], F.gillRodZ).applyMatrix4(root.matrixWorld).toArray()), 0);
    });
  }
}));

test('gill rods, eyes and extended journals sweep clear of disks, rockers and operculum covers', () => withModel(model => {
  let coplanarPenetrations = 0, poses = 0;
  for (const cadence of [0.12, 1.1]) for (const amplitude of [6, 16, 22]) for (let n = 0; n <= 720; n++) {
    const state = poseAt(n * TAU / 720, { cadence, amplitude }); model.update(state);
    const rendered = primitives(model, id => id.startsWith('gill.'));
    for (const g of state.gills) {
      const prefix = `gill.${g.side}`, own = suffix => rendered.filter(p => p.id === `${prefix}.${suffix}`);
      const rods = own('conrod'), bushes = rods.filter(brassShaft), eyes = rods.filter(eye);
      const shafts = [...own('crank'), ...own('rocker')].filter(brassShaft);
      assert.equal(bushes.length, 2); assert.equal(eyes.length, 2); assert.equal(shafts.length, 2);
      const root = model.group.getObjectByName(`${prefix}.carrier`);
      const inverse = root.matrixWorld.clone().invert(), normal = new THREE.Vector3(0, 0, 1).transformDirection(root.matrixWorld);
      const centers = eyes.map(e => e.center.clone().applyMatrix4(inverse));
      near(centers[0].z, centers[1].z, 2e-7);
      near(centers[0].distanceTo(centers[1]), 0.105, 2e-7);
      near(Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y), 0.105, 2e-7);
      for (let i = 0; i < 2; i++) {
        const solved = i ? g.rocker : g.crank;
        near(centers[i].x, solved[0], 2e-7); near(centers[i].y, solved[1], 2e-7);
        journalEngaged(shafts[i], bushes[i]);
      }
      const obstacles = [...own('gear'), ...own('rocker').filter(p => !brassShaft(p)),
        ...own('crank').filter(p => !brassShaft(p)), ...own('carrier'), ...own('cover')];
      for (const rod of rods) for (const obstacle of obstacles) {
        assert.ok(separated(rod, obstacle), `${prefix} ${amplitude} deg phase ${n}: ${rod.type} touches ${obstacle.id}/${obstacle.type}`);
      }
      // Cover ribs and their retainers must also clear the extended journals.
      for (const shaft of shafts) for (const cover of own('cover')) assert.ok(separated(shaft, cover), `${prefix} journal touches cover at ${n}`);
      const disk = own('gear').find(brassShaft);
      const rails = rods.filter(p => p.type === 'CylinderGeometry' && p.color === 0x8b9da6);
      assert.equal(rails.length, 2);
      if (rails.some(rail => insidePrimitive(disk, new THREE.Vector3(0, -0.45, 0).applyMatrix4(rail.matrix).addScaledVector(normal, -centers[0].z)))) coplanarPenetrations++;
    }
    poses++;
  }
  assert.equal(poses, 4326); assert.ok(coplanarPenetrations > 0, 'coplanar regression must penetrate a real disk');
}));

test('the supported fish stays above y=0, below 2.2 m, and within a centered three-metre footprint', () => withModel(model => {
  for (const amplitude of [6, 22]) for (let i = 0; i < 16; i++) {
    model.update(poseAt(i * TAU / 16, { amplitude })); const b = bounds(model), size = b.getSize(new THREE.Vector3());
    near(b.min.y, 0, 1e-7); assert.ok(b.max.y <= 2.2, `height ${b.max.y}`);
    assert.ok(Math.max(size.x, size.z) <= 3.05, `footprint ${size.toArray()}`);
    assert.ok(Math.abs((b.min.x + b.max.x) / 2) < 0.36 && Math.abs((b.min.z + b.max.z) / 2) < 0.16, 'centered in-place articulated envelope');
  }
}));

test('exploded hierarchy, quality and view modes restore identical matrices without mutating input', () => withModel(model => {
  const state = sample(0.82), immutable = structuredClone(state); model.update(state); const original = snapshot(model);
  for (let i = 0; i < 4; i++) {
    model.update(state, { explode: 0.84, mode: 'xray', selectedId: 'spine.3.tendon.-1', quality: 'high' });
    assert.notDeepEqual(snapshot(model), original);
    model.update(state, { explode: 0.42, mode: 'cutaway', quality: 'low' });
    model.update(state, { explode: 0, mode: 'solid', quality: 'balanced' }); assert.deepEqual(snapshot(model), original);
  }
  model.update(undefined); assert.deepEqual(snapshot(model), original);
  model.update({ driveAngle: state.driveAngle }); assert.deepEqual(snapshot(model), original); assert.deepEqual(state, immutable);
  model.update(state, { selectedId: 'spine.3.tendon.-1' }); const color = new THREE.Color(); let highlighted = 0;
  for (const m of model.pickables) for (let i = 0; i < m.count; i++) {
    m.getColorAt(i, color); const selected = m.userData.instanceParts[i] === 'spine.3.tendon.-1';
    assert.equal(color.getHex() !== 0xffffff, selected); if (selected) highlighted++;
  }
  assert.ok(highlighted > 0); assert.deepEqual(snapshot(model), original);
  model.update(state);
  for (const m of model.pickables) for (let i = 0; i < m.count; i++) { m.getColorAt(i, color); assert.equal(color.getHex(), 0xffffff); }
}));

test('x-ray ghosts only shell; cutaway and solid restore clipping, opacity, depth and face state', () => withModel(model => {
  model.update(undefined, { mode: 'xray' }); let shells = 0;
  for (const m of model.pickables) {
    const shell = m.material.color.getHex() === 0xced5cf;
    assert.equal(m.material.transparent, shell); near(m.material.opacity, shell ? 0.13 : 1);
    assert.equal(m.material.depthWrite, !shell); if (shell) shells++;
  }
  assert.ok(shells > 0);
  model.update(undefined, { mode: 'cutaway' });
  for (const m of model.pickables) {
    assert.equal(m.material.clippingPlanes.length, 1); assert.equal(m.material.side, THREE.DoubleSide);
    assert.ok(!m.material.transparent && m.material.depthWrite); near(m.material.opacity, 1);
    assert.ok(m.material.clippingPlanes[0].distanceToPoint(new THREE.Vector3(-1, 0, 0)) > 0);
  }
  model.update(undefined, { mode: 'solid' });
  for (const m of model.pickables) {
    assert.equal(m.material.clippingPlanes.length, 0); assert.equal(m.material.side, THREE.FrontSide);
    assert.ok(!m.material.transparent && m.material.depthWrite); near(m.material.opacity, 1);
  }
}));

test('updates reuse all geometry buffers and dispose releases resources once', () => {
  const model = createModel(), resources = new Set(model.pickables.flatMap(m => [m, m.geometry, m.material])), calls = new Map();
  const geometries = model.pickables.map(m => m.geometry), buffers = geometries.map(g => g.attributes.position.array.slice());
  resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) ?? 0) + 1)));
  for (let i = 0; i < 48; i++) model.update(sample(i * 0.071), { explode: i % 2 ? 0.7 : 0, quality: i % 3 ? 'balanced' : 'low' });
  model.pickables.forEach((m, i) => { assert.equal(m.geometry, geometries[i]); assert.deepEqual(m.geometry.attributes.position.array, buffers[i]); finite(Array.from(m.instanceMatrix.array)); });
  model.dispose(); model.dispose(); model.update(sample(2));
  resources.forEach(r => assert.equal(calls.get(r), 1)); assert.equal(model.group.children.length, 0); assert.equal(model.pickables.length, 0);
});
