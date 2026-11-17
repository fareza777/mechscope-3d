import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/strandbeest/index.js';
import { createModel } from '../src/mechanisms/strandbeest/model.js';
import { TAU, HOLY, LINKS, CFG, SCALE, PAD, SOLE_TRAVEL, STRIDE, FOOT_MIN, FOOT_MAX, solveLeg, solveMirror, circleIntersection, legAt, phaseOf, legZ, bodyAt, poseAt, sample, sailPoint } from '../src/mechanisms/strandbeest/kinematics.js';

const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const withModel = fn => { const model = createModel(); try { fn(model); } finally { model.dispose(); } };
function snapshot(model) {
  const rows = [], matrix = new THREE.Matrix4();
  for (const mesh of model.pickables) if (mesh.visible) for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, matrix);
    rows.push(`${mesh.userData.instanceParts[i]}:${mesh.geometry.type}:${Array.from(matrix.elements).join(',')}`);
  }
  return rows.sort();
}
function vertexBounds(model) {
  const bounds = new THREE.Box3(), matrix = new THREE.Matrix4(), p = new THREE.Vector3();
  for (const mesh of model.pickables) if (mesh.visible) {
    const positions = mesh.geometry.attributes.position;
    for (let instance = 0; instance < mesh.count; instance++) {
      mesh.getMatrixAt(instance, matrix);
      for (let i = 0; i < positions.count; i++) bounds.expandByPoint(p.fromBufferAttribute(positions, i).applyMatrix4(matrix));
    }
  }
  return bounds;
}

test('source solver fixtures match MIT jansen.js, including mirrored assembly branch', () => {
  // Captured directly from the supplied Teardown reference; no reference runtime dependency.
  const fixtures = [
    [0, [-43.16011052410467, -91.75693292612323], [33.72972953816961, -73.51709740981947]],
    [1.234, [-13.987339695112365, -91.26237847028904], [4.005518377454223, -89.23350941737941]],
    [Math.PI, [-33.72972953816961, -73.51709740981947], [43.16011052410467, -91.75693292612323]],
  ];
  for (const [angle, left, right] of fixtures) for (let i = 0; i < 2; i++) {
    near(solveLeg(angle).F[i], left[i]); near(solveMirror(angle).F[i], right[i]);
  }
  assert.throws(() => circleIntersection([0, 0], 1, [8, 0], 1, a => a), RangeError);
  assert.throws(() => circleIntersection([0, 0], 1, [0, 0], 1, a => a), RangeError);
});

test('every source circle closure and all eleven moving lengths stay rigid', () => {
  assert.equal(LINKS.length + 1, 11);
  for (let n = 0; n < 1440; n++) {
    const angle = n * TAU / 1440;
    const left = solveLeg(angle), right = solveMirror(angle);
    for (const joints of [left, right]) {
      for (const [a, b, key] of LINKS) near(distance(joints[a], joints[b]), HOLY[key]);
      near(distance(joints.O, joints.A), HOLY.m);
      assert.ok(Object.values(joints).flat().every(Number.isFinite));
    }
    near(distance(left.A, right.A), 0);
  }
});

test('ten correctly indexed stations coordinate twenty mirrored feet', () => {
  const state = sample(1.23);
  assert.equal(state.legs.length, 20);
  assert.equal(new Set(state.legs.map(l => l.id)).size, 20);
  for (let s = 0; s < CFG.stations; s++) {
    near(phaseOf(s), -s * TAU / 10);
    for (let side = 0; side < 2; side++) {
      const leg = state.legs[s * 2 + side], expected = legAt(s, side, state.driveAngle);
      assert.deepEqual(leg.joints, expected);
      near(leg.foot[2], legZ(s, side) * SCALE);
    }
  }
});

test('sampler is pure, periodic, reversible and bounded at arbitrary times', () => {
  for (const cadence of [0.08, 0.3, 0.75]) for (const t of [-300, -1.234, 0, 1.23, 92.654, 100000]) {
    const a = sample(t, { cadence });
    sample(-98765, { cadence: 0.75 });
    assert.deepEqual(sample(t, { cadence }), a);
    const b = sample(t + 1 / cadence, { cadence });
    for (let i = 0; i < 20; i++) for (let j = 0; j < 3; j++) near(a.legs[i].foot[j], b.legs[i].foot[j], 2e-9);
    assert.ok(Math.abs(a.body.position[0]) < 0.025);
  }
  for (const t of [NaN, Infinity, -Infinity]) assert.ok(Number.isFinite(sample(t).driveAngle));
  for (const cadence of [undefined, NaN, Infinity, -8, 9]) assert.ok(Number.isFinite(sample(1, { cadence }).metrics.crankRpm));
  const eps = 1e-7, a = poseAt(-eps), b = poseAt(eps);
  for (let i = 0; i < 20; i++) for (let j = 0; j < 3; j++) near(a.legs[i].foot[j], b.legs[i].foot[j], 1e-6);
});

test('grounded stance markers are actual analytic pad contacts, with bounded compliance', () => {
  let minContacts = Infinity, maxContacts = 0;
  for (let n = 0; n < 720; n++) {
    const state = poseAt(n * TAU / 720), contacts = state.legs.filter(l => l.stance).length;
    minContacts = Math.min(minContacts, contacts); maxContacts = Math.max(maxContacts, contacts);
    for (const leg of state.legs) {
      assert.ok(leg.foot[1] >= 0);
      assert.ok(leg.compliance >= 0 && leg.compliance <= SOLE_TRAVEL * SCALE + 1e-9);
      if (leg.stance) near(leg.foot[1], 0);
      const extent = Math.hypot(3.4 * Math.sin(leg.angle), PAD * Math.cos(leg.angle)) * SCALE;
      near(leg.padCenter[1] - extent, leg.foot[1]);
      // Transform analytic world support back to the ellipsoid's local XY frame.
      const dx = (leg.foot[0] - leg.padCenter[0]) / SCALE, dy = -extent / SCALE;
      const x = Math.cos(leg.angle) * dx + Math.sin(leg.angle) * dy;
      const y = -Math.sin(leg.angle) * dx + Math.cos(leg.angle) * dy;
      near((x / 3.4) ** 2 + (y / PAD) ** 2, 1);
    }
  }
  assert.ok(minContacts >= 6 && maxContacts <= 20);
});

test('source body integration and displayed numerical metrics reconcile', () => {
  for (const angle of [-15, 0, 1.23, 28]) {
    const a = bodyAt(angle), b = bodyAt(angle + TAU);
    near(b.x - a.x, STRIDE); near(a.inPlaceX, b.inPlaceX);
  }
  const state = sample(2, { cadence: 0.45 });
  near(state.metrics.stride, Math.abs(STRIDE) * SCALE);
  near(state.metrics.groundSpeed, state.metrics.stride * 0.45);
  near(state.metrics.footLift, (FOOT_MAX - FOOT_MIN) * SCALE);
  near(state.metrics.crankRpm, 27); near(state.metrics.cycleSeconds, 1 / 0.45);
  near(state.metrics.bodyHeight, state.body.position[1]);
  assert.equal(state.metrics.contacts, state.legs.filter(l => l.stance).length);
});

test('source sail outline, camber and descriptor contract are complete', async () => {
  near(sailPoint(0, 1)[0], 30); near(sailPoint(0, 1)[1], 94); near(sailPoint(0, 1)[2], 0);
  assert.equal(descriptor.id, 'strandbeest'); assert.equal(descriptor.collection, '003');
  assert.equal(descriptor.title, 'VENTUS J20'); assert.equal(descriptor.lessons.length, 5);
  near(descriptor.cycleHz(descriptor.defaultInputs), 0.3);
  assert.deepEqual(descriptor.sample(0), sample(0));
  for (const lesson of descriptor.lessons) {
    for (const key of ['title', 'short', 'text', 'fact', 'view', 'mode']) assert.equal(typeof lesson[key], 'string');
    assert.ok(lesson.explode >= 0 && lesson.explode <= 1);
  }
  const model = await descriptor.createModel(); assert.ok(model.group.isGroup); model.dispose();
});

test('all visible instances map to complete, unique selectable metadata', () => withModel(model => {
  const ids = new Set(model.parts.map(p => p.id)), used = new Set();
  assert.equal(ids.size, model.parts.length); assert.ok(ids.size >= 40);
  for (const part of model.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof part[key] === 'string' && part[key].length);
  model.group.traverse(object => {
    if (!object.isMesh || !object.visible) return;
    assert.ok(model.pickables.includes(object));
    for (let i = 0; i < object.count; i++) {
      const id = object.userData.instanceParts[i]; assert.ok(ids.has(id), id); used.add(id);
    }
  });
  assert.equal(used.size, ids.size);
}));

test('main colour-pass statistics are exact through quality, selection and modes', () => withModel(model => {
  for (const quality of ['low', 'balanced', 'high']) for (const mode of ['solid', 'xray', 'cutaway']) {
    model.update(sample(0.42), { quality, mode, selectedId: 'leg.01.L.h' });
    let components = 0, triangles = 0, draws = 0;
    for (const mesh of model.pickables) if (mesh.visible) {
      components += mesh.count; triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3 * mesh.count; draws++;
      assert.ok(mesh.material.forceSinglePass); assert.ok(!Array.isArray(mesh.material));
    }
    assert.equal(model.stats.components, components); assert.equal(model.stats.triangles, triangles); assert.equal(model.stats.drawCallsEstimate, draws);
    assert.ok(draws <= 150); if (quality === 'balanced') assert.ok(triangles <= 180000);
  }
}));

test('full machine stays in the normalized envelope and geometry never crosses ground', () => withModel(model => {
  for (let n = 0; n < 16; n++) {
    model.update(poseAt(n * TAU / 16));
    const b = vertexBounds(model), size = b.getSize(new THREE.Vector3());
    assert.ok(b.min.y >= -1e-6, `ground penetration: ${b.min.y}`);
    assert.ok(b.max.y <= 2.2, `height: ${b.max.y}`);
    assert.ok(Math.max(size.x, size.z) <= 3.05, `footprint: ${size.toArray()}`);
  }
}));

test('exploded views, selection and quality switching restore every original matrix', () => withModel(model => {
  const s = sample(1.456), untouched = structuredClone(s);
  model.update(s); const original = snapshot(model);
  model.update(s, { explode: 1, mode: 'xray', selectedId: 'leg.01.L.h', quality: 'high' });
  assert.notDeepEqual(snapshot(model), original);
  model.update(s, { explode: 0, mode: 'solid', selectedId: null, quality: 'balanced' });
  assert.deepEqual(snapshot(model), original); assert.deepEqual(s, untouched);
  model.update(undefined); assert.deepEqual(snapshot(model), original);
  model.update({ driveAngle: s.driveAngle }); assert.deepEqual(snapshot(model), original);
  model.update(s, { selectedId: 'leg.01.L.h' });
  assert.ok(model.pickables.some(m => m.visible && m.material.name.includes('selected')));
  assert.deepEqual(snapshot(model), original);
  model.update(s, { highlight: false }); assert.deepEqual(snapshot(model), original);
  assert.ok(model.pickables.filter(m => m.visible).every(m => !m.material.name.includes('selected')));
}));

test('x-ray only ghosts shells; cutaway uses a root-transformed real clipping plane', () => withModel(model => {
  model.update(undefined, { mode: 'xray' });
  const visible = model.pickables.filter(m => m.visible);
  assert.ok(visible.some(m => m.material.transparent)); assert.ok(visible.some(m => !m.material.transparent));
  for (const mesh of visible) assert.equal(mesh.material.transparent, !!mesh.material.userData.outer);
  model.group.position.set(0.7, 0.1, -0.2); model.group.rotation.y = 0.4;
  model.update(undefined, { mode: 'cutaway' });
  const localOrigin = new THREE.Vector3(0, 1, 0).applyMatrix4(model.group.matrixWorld);
  for (const mesh of model.pickables.filter(m => m.visible)) {
    assert.equal(mesh.material.clippingPlanes.length, 1);
    near(mesh.material.clippingPlanes[0].distanceToPoint(localOrigin), 0);
    assert.ok(mesh.material.clipShadows); assert.ok(!mesh.material.transparent);
  }
  const localFront = new THREE.Vector3(4, 1, 0).applyMatrix4(model.group.matrixWorld);
  const direction = localOrigin.clone().sub(localFront).normalize();
  const hits = new THREE.Raycaster(localFront, direction).intersectObjects(model.pickables);
  assert.ok(hits.length > 0);
  for (const hit of hits) assert.ok(hit.object.material.clippingPlanes[0].distanceToPoint(hit.point) >= -1e-7);
  model.update(undefined, { mode: 'solid' });
  for (const mesh of model.pickables) assert.equal(mesh.material.clippingPlanes, null);
}));

test('sail vertex and normal buffers remain untouched over an arbitrary sequence', () => withModel(model => {
  const sail = model.pickables.find(m => m.name === 'sail / sail'), geo = sail.geometry;
  const positions = geo.attributes.position.array.slice(), normals = geo.attributes.normal.array.slice();
  const version = geo.attributes.normal.version;
  for (const t of [24, 0, -17, 1.2, 8]) model.update(sample(t));
  assert.equal(sail.geometry, geo); assert.deepEqual(geo.attributes.position.array, positions); assert.deepEqual(geo.attributes.normal.array, normals);
  assert.equal(geo.attributes.normal.version, version);
}));

test('dispose frees instantiated geometry/materials/meshes once and is idempotent', () => {
  const model = createModel(); model.update(undefined, { selectedId: 'leg.01.L.h' });
  const resources = new Set(model.pickables.flatMap(m => [m, m.geometry, m.material]));
  const calls = new Map();
  for (const resource of resources) resource.addEventListener('dispose', () => calls.set(resource, (calls.get(resource) ?? 0) + 1));
  model.dispose(); model.dispose(); model.update(sample(2));
  for (const resource of resources) assert.equal(calls.get(resource), 1);
  assert.equal(model.group.children.length, 0); assert.equal(model.pickables.length, 0);
});
