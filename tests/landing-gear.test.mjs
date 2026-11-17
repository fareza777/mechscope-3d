import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import descriptor from '../src/mechanisms/landing-gear/index.js';
import { G, AXIS, LEG0, J, E0, TIP0, GROUND, SERVICE_LIFT, sample, poseAtStroke, tipAt } from '../src/mechanisms/landing-gear/kinematics.js';
import { createModel } from '../src/mechanisms/landing-gear/model.js';
import { createGeometryKit } from '../src/mechanisms/landing-gear/geometry.js';

const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const vectorNear = (a, b, eps = 1e-8) => a.forEach((n, i) => near(n, b[i], eps));
const world = node => node.getWorldPosition(new THREE.Vector3()).toArray();
const get = (m, name) => {
  const node = m.group.getObjectByName(name);
  assert.ok(node, `Missing ${name}`);
  return node;
};
const partMeshes = (m, id) => m.pickables.filter(mesh => mesh.userData.partId === id);
const usingModel = fn => {
  const m = createModel();
  try { return fn(m); } finally { m.dispose(); }
};

function independentTip(stroke) {
  const n = Math.sqrt(2.36), l = Math.sqrt(2.64);
  const axis = new THREE.Vector3(1 / n, -0.6 / n, -1 / n);
  const v = axis.clone().multiplyScalar(0.3).add(new THREE.Vector3(0.5 / l, -0.5 / l, 0.4 / l));
  const theta = stroke * Math.PI;
  const rotated = v.clone().multiplyScalar(Math.cos(theta))
    .addScaledVector(new THREE.Vector3().crossVectors(axis, v), Math.sin(theta))
    .addScaledVector(axis, axis.dot(v) * (1 - Math.cos(theta)));
  // Independent source tangent offset and a separate, fixed 420 mm service lift.
  const sourceGround = 0.205 + 0.1365 + 0.18 / n + 0.5 / l;
  return rotated.add(new THREE.Vector3(0.22, -0.1365 + sourceGround + 0.42, 0));
}

function transforms(m) {
  const nodes = [];
  m.group.traverse(node => {
    nodes.push([node.name, ...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()]);
    if (node.isInstancedMesh) nodes.push(Array.from(node.instanceMatrix.array));
  });
  return nodes;
}

function independentlyCount(m) {
  const stats = { components: 0, triangles: 0, drawCallsEstimate: 0 };
  m.group.traverseVisible(mesh => {
    if (!mesh.isMesh) return;
    const n = mesh.isInstancedMesh ? mesh.count : 1;
    stats.components += n;
    stats.triangles += n * (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
    stats.drawCallsEstimate += Array.isArray(mesh.material) ? mesh.geometry.groups.length : 1;
    assert.ok(mesh.material.forceSinglePass);
  });
  return stats;
}

test('descriptor exposes the requested standalone mechanism contract', async () => {
  assert.equal(descriptor.id, 'cessna-gear');
  assert.equal(descriptor.title, 'VECTOR RG–2');
  assert.equal(descriptor.family, 'Retractable Landing Gear');
  assert.equal(descriptor.collection, '004');
  assert.deepEqual(descriptor.defaultInputs, { cadence: 0.16, strokeScale: 1 });
  assert.equal(descriptor.cycleLabel, 'RETRACTION CYCLE');
  assert.deepEqual(descriptor.controls.map(c => [c.key, c.min, c.max, c.step, c.unit, c.precision]), [
    ['cadence', 0.05, 0.4, 0.01, 'Hz', 2], ['strokeScale', 0.1, 1, 0.01, 'ratio', 2],
  ]);
  assert.deepEqual(descriptor.specs, [{ value: '201', label: 'TRAVEL · MM' }, { value: '32', label: 'PINION TEETH' }]);
  assert.equal(descriptor.lessons.length, 5);
  for (const l of descriptor.lessons) {
    for (const key of ['title', 'short', 'text', 'fact']) assert.ok(l[key].length > 5);
    assert.ok(['home', 'top', 'side', 'detail'].includes(l.view));
    assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode));
    assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  const m = await descriptor.createModel();
  assert.deepEqual(Object.keys(m).sort(), ['dispose', 'group', 'parts', 'pickables', 'stats', 'update']);
  m.dispose();
});

test('reference dimensions and the nominal pitch rounding are explicit', () => {
  assert.equal(G.teeth, 32); assert.equal(G.module, 0.004);
  assert.equal(G.pinionR, 0.064); assert.equal(G.stroke, 0.201);
  near(G.teeth * G.module, 2 * G.pinionR);
  near(AXIS.length(), 1); near(LEG0.length(), 1);
  near(J.distanceTo(E0), 0.3); near(E0.distanceTo(TIP0), 0.5);
  near(TIP0.y + GROUND - G.wheelR, 0, 1e-12); // Preserve source-ground provenance.
  assert.equal(SERVICE_LIFT, 0.42);
  near(TIP0.y + GROUND + SERVICE_LIFT - G.wheelR, 0.42);
  near(poseAtStroke(0).wheelCenters.right[1], 0.625);
  vectorNear(sample(0).body.position, [0, 0.205 + 0.1365 + 0.18 / Math.sqrt(2.36) + 0.5 / Math.sqrt(2.64) + 0.42, 0]);
  const full = sample(0.5 / 0.16);
  near(full.metrics.rackTravelMm, 201); near(full.metrics.pinionAngleDeg, 180);
  near(full.metrics.idealRackTravelMm, Math.PI * 128 / 2);
  near(full.metrics.nominalPitchErrorMm, 0.06192982974676, 1e-10);
  assert.notEqual(full.metrics.rackTravelMm, full.metrics.idealRackTravelMm, 'Do not conceal the source rounding');
});

test('smooth cosine travel is deterministic, periodic and scaled at every stroke', () => {
  for (const cadence of [0.05, 0.16, 0.4]) for (const strokeScale of [0.1, 0.37, 1]) {
    const input = { cadence, strokeScale };
    const T = 1 / cadence;
    for (const phase of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
      const s = sample(phase * T, input);
      near(s.stroke, strokeScale * (1 - Math.cos(2 * Math.PI * phase)) / 2);
      near(s.stroke, sample((1 - phase) * T, input).stroke);
      near(s.stroke, sample((phase + 8) * T, input).stroke);
      near(s.stroke, sample((phase - 4) * T, input).stroke);
      assert.ok(s.phase >= 0 && s.phase < 1);
      near(s.rackTravel, s.stroke * 0.201);
      near(s.pinionAngle, s.stroke * Math.PI);
      vectorNear(s.wheelCenters.right, independentTip(s.stroke).toArray());
      vectorNear(s.wheelCenters.left, [-s.wheelCenters.right[0], s.wheelCenters.right[1], s.wheelCenters.right[2]]);
    }
    for (const phase of [0, 0.5, 1]) {
      const t = phase * T, h = 1e-5;
      const left = (sample(t, input).stroke - sample(t - h, input).stroke) / h;
      const right = (sample(t + h, input).stroke - sample(t, input).stroke) / h;
      near(left, right, 7e-5);
    }
  }
  const snapshot = sample(3.1);
  sample(13.6); sample(-27);
  assert.deepEqual(sample(3.1), snapshot);
});

test('negative controls reject invalid inputs and distinguish the oblique path from a planar hinge', () => {
  const invalid = sample(NaN, { cadence: Infinity, strokeScale: NaN });
  assert.deepEqual(invalid, sample(0));
  near(descriptor.cycleHz({ cadence: -1 }), 0.05);
  near(descriptor.cycleHz({ cadence: 80 }), 0.4);
  near(sample(0.5 / 0.16, { strokeScale: -4 }).stroke, 0.1);
  near(sample(0.5 / 0.16, { strokeScale: 4 }).stroke, 1);
  near(poseAtStroke(-0.5).stroke, 0); near(poseAtStroke(8).stroke, 1);
  near(poseAtStroke(Infinity).stroke, 0);
  const theta = Math.PI / 2;
  const wrongPlanar = TIP0.clone().sub(J).applyAxisAngle(new THREE.Vector3(1, 0, 0), theta).add(J);
  assert.ok(wrongPlanar.distanceTo(tipAt(theta)) > 0.2);
  // The unchanged path still dips below its deployed tangent plane, now lifted
  // 420 mm for inspection rather than clamped or heaved to follow the floor.
  const dipped = poseAtStroke(0.25).wheelCenters.right[1];
  assert.ok(dipped < G.wheelR + 0.42);
  assert.ok(dipped > G.wheelR);
  near(dipped, independentTip(0.25).y);
});

test('one supplied stroke poses rack, shaft and mirrored wheel centres without heave', () => usingModel(m => {
  const body = get(m, 'Fixed assembly datum');
  const bodyAtStart = world(body);
  for (let i = 0; i <= 60; i++) {
    const state = sample(i / (60 * 0.16), { strokeScale: 0.83 });
    m.update({ ...state, driveAngle: 999, body: { position: [40, 40, 40] } }, { explode: 0 });
    vectorNear(world(body), bodyAtStart);
    vectorNear(world(body), state.body.position);
    near(world(body)[1], GROUND + 0.42);
    near(state.metrics.wheelCentreHeightMm, world(get(m, 'right wheel centre'))[1] * 1000);
    vectorNear(world(get(m, 'right wheel centre')), independentTip(state.stroke).toArray());
    vectorNear(world(get(m, 'left wheel centre')), state.wheelCenters.left);
    near(get(m, 'Output shaft assembly').rotation.x, state.stroke * Math.PI);
    near(get(m, 'Rod-end assembly').position.z, 0.32 - state.stroke * 0.201);
    near(get(m, 'rack.teeth').position.z, 0.13 - state.stroke * 0.201);
    vectorNear(get(m, 'right oblique rotation').quaternion.toArray(), new THREE.Quaternion().setFromAxisAngle(AXIS, state.stroke * Math.PI).toArray());
    near(get(m, 'actuator.rod').scale.y, 0.556);
  }
  m.update({ stroke: 0.6 });
  const retained = transforms(m);
  m.update(undefined, { mode: 'xray' });
  assert.deepEqual(transforms(m), retained);
}));

test('suspended deployment and actual world bounds clear the floor throughout every display mode', t => usingModel(m => {
  const assembled = new THREE.Box3().setFromObject(m.group);
  near(assembled.min.y, 0, 1e-7); // Only the new stand feet meet the studio floor.
  for (const side of ['left', 'right']) {
    near(new THREE.Box3().setFromObject(get(m, `${side}.wheel.tyre`)).min.y, 0.42, 1e-7);
  }
  assert.ok(assembled.getSize(new THREE.Vector3()).x < 1.7);
  const measured = [0, 0.5, 1].map(explode => ({ explode, all: new THREE.Box3(), assembly: new THREE.Box3() }));
  const body = get(m, 'Fixed assembly datum');
  for (const quality of ['low', 'balanced', 'high']) for (const mode of ['solid', 'xray', 'cutaway']) {
    for (let i = 0; i <= 240; i++) for (const result of measured) {
      const { explode } = result;
      m.update({ stroke: i / 240 }, { explode, quality, mode });
      // Use the submitted world geometry, including instanced hoses and the stand,
      // not wheel centres/radii. Unclipped Box3 also bounds x-ray and cutaway conservatively.
      const bounds = new THREE.Box3().setFromObject(m.group);
      const size = bounds.getSize(new THREE.Vector3());
      const label = `${quality}/${mode}, stroke ${i}/240, explode ${explode}`;
      assert.ok(bounds.min.y >= -0.002, `${label}: floor penetration ${bounds.min.y}`);
      assert.ok(bounds.max.y <= 2.1 && size.y <= 2.1, `${label}: height ${bounds.max.y}`);
      assert.ok(size.x <= 2.8 && size.z <= 2.8, `${label}: ${size.toArray()}`);
      assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
      result.all.union(bounds);
      result.assembly.union(new THREE.Box3().setFromObject(body));
    }
  }
  for (const { explode, all, assembly } of measured) {
    t.diagnostic(`explode=${explode}: world y=[${all.min.y.toFixed(9)}, ${all.max.y.toFixed(9)}] m; lifted assembly y=[${assembly.min.y.toFixed(9)}, ${assembly.max.y.toFixed(9)}] m (240 stroke intervals, all qualities/modes)`);
  }
}));

test('fixed service posts and grounded feet join the cradle outside the entire moving sweep', t => usingModel(m => {
  const supports = get(m, 'Grounded cradle supports');
  const supportBounds = new THREE.Box3().setFromObject(supports);
  const posts = get(m, 'frame.supportPosts'), feet = get(m, 'frame.feet');
  assert.equal(posts.count, 2); assert.equal(feet.count, 2);
  const matrix = new THREE.Matrix4();
  const instanceBounds = (mesh, index) => {
    mesh.getMatrixAt(index, matrix);
    return mesh.geometry.boundingBox.clone().applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld);
  };
  for (let i = 0; i < 2; i++) {
    const post = instanceBounds(posts, i), foot = instanceBounds(feet, i);
    near(foot.min.y, 0, 1e-7); near(foot.max.y, 0.024, 1e-7);
    vectorNear(foot.getSize(new THREE.Vector3()).toArray(), [0.24, 0.024, 0.30], 1e-7);
    near(post.getSize(new THREE.Vector3()).x, 0.030, 1e-7);
    near(post.getSize(new THREE.Vector3()).z, 0.040, 1e-7);
    near(post.min.y, foot.max.y, 1e-7);
    // Ray-test actual original frame geometry to establish a seated post top.
    const origin = post.getCenter(new THREE.Vector3()); origin.y = post.max.y - 0.01;
    const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, 1, 0)).intersectObject(get(m, 'frame.cradle'));
    assert.ok(hits.length);
    near(hits[0].point.y, post.max.y, 1e-7);
  }
  const fixed = [world(supports), Array.from(posts.instanceMatrix.array), Array.from(feet.instanceMatrix.array)];
  const swept = new THREE.Box3();
  for (let i = 0; i <= 240; i++) for (const explode of [0, 0.5, 1]) {
    m.update({ stroke: i / 240 }, { explode, quality: 'high' });
    assert.deepEqual([world(supports), Array.from(posts.instanceMatrix.array), Array.from(feet.instanceMatrix.array)], fixed);
    for (const side of ['left', 'right']) {
      swept.union(new THREE.Box3().setFromObject(get(m, `${side} mirrored side`)));
      swept.union(new THREE.Box3().setFromObject(get(m, `${side}.brake.flex`)));
    }
    for (const name of ['Rack assembly', 'Output shaft assembly', 'Rod-end assembly']) {
      assert.ok(!supportBounds.intersectsBox(new THREE.Box3().setFromObject(get(m, name))), `${name} must clear the stand`);
    }
  }
  assert.ok(!supportBounds.intersectsBox(swept), 'Stand must clear the union of both complete moving sides, not just wheel centres');
  const clearance = supportBounds.min.z - swept.max.z;
  assert.ok(clearance > 0.20, `Stand/wheel swept-envelope gap ${clearance}`);
  t.diagnostic(`stand-to-moving-sweep longitudinal clearance: ${clearance.toFixed(9)} m`);
}));

test('service lift preserves exact rigid lengths and independent wheel positions over the full stroke', () => usingModel(m => {
  for (let i = 0; i <= 240; i++) for (const explode of [0, 0.5, 1]) {
    const stroke = i / 240;
    m.update({ stroke }, { explode });
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? -1 : 1;
      const joint = new THREE.Vector3(...world(get(m, `${side} oblique rotation`)));
      const root = new THREE.Vector3(...world(get(m, `${side} spring root`)));
      const wheel = new THREE.Vector3(...world(get(m, `${side} wheel centre`)));
      near(joint.distanceTo(root), 0.3, 1e-12);
      near(root.distanceTo(wheel), 0.5, 1e-12);
      const expected = independentTip(stroke);
      expected.x = sign * (expected.x + 0.16 * explode);
      expected.y -= 0.12 * explode;
      vectorNear(wheel.toArray(), expected.toArray(), 1e-12);
    }
  }
}));

test('lesson and fixture/tire metadata describe suspended inspection rather than floor contact', () => usingModel(m => {
  assert.match(descriptor.lessons[0].text, /suspended service inspection cradle/i);
  assert.match(descriptor.lessons[0].text, /420 mm above its deployed ground datum/);
  for (const id of ['frame.cradle', 'left.wheel.tyre', 'right.wheel.tyre']) {
    const p = m.parts.find(p => p.id === id);
    assert.match(`${p.function} ${p.detail}`, /420 mm/);
    assert.match(`${p.function} ${p.detail}`, /deployed ground datum/);
  }
  assert.match(m.parts.find(p => p.id === 'frame.supportPosts').detail, /outside the full assembled and exploded wheel sweep/);
  assert.match(m.parts.find(p => p.id === 'frame.feet').how, /lower faces at y = 0/);
}));

test('all meaningful visible meshes and instances resolve to rich metadata', () => usingModel(m => {
  assert.ok(m.parts.length >= 35);
  const ids = new Set(m.parts.map(p => p.id));
  assert.equal(ids.size, m.parts.length);
  for (const p of m.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) {
    assert.equal(typeof p[key], 'string'); assert.ok(p[key].length);
  }
  const referenced = new Set();
  m.group.traverse(node => {
    if (!node.isMesh) return;
    assert.ok(m.pickables.includes(node));
    assert.ok(ids.has(node.userData.partId));
    referenced.add(node.userData.partId);
    if (node.isInstancedMesh) {
      assert.equal(node.userData.instanceParts.length, node.count);
      for (let i = 0; i < node.count; i++) {
        assert.ok(ids.has(node.userData.instanceParts[i]));
        const matrix = new THREE.Matrix4(); node.getMatrixAt(i, matrix);
        assert.ok(matrix.determinant() > 0, 'Instance reflection must be on the parent, not the instance matrix');
      }
    }
    const pos = node.geometry.attributes.position;
    for (let i = 0; i < pos.array.length; i++) assert.ok(Number.isFinite(pos.array[i]));
    assert.ok(node.geometry.boundingSphere.radius > 0);
  });
  assert.deepEqual(referenced, ids);
}));

test('statistics are measured from submitted geometry at every quality and mode', () => usingModel(m => {
  const totals = [];
  for (const quality of ['low', 'balanced', 'high']) {
    for (const mode of ['solid', 'xray', 'cutaway']) {
      m.update({ stroke: 0.52 }, { quality, mode, selectedId: 'right.brake.disc', explode: 0.7 });
      assert.deepEqual(m.stats, independentlyCount(m));
      if (quality === 'balanced') {
        assert.ok(m.stats.drawCallsEstimate <= 150);
        assert.ok(m.stats.triangles <= 180_000);
      }
    }
    totals.push(m.stats.triangles);
  }
  assert.ok(totals[0] < totals[1] && totals[1] < totals[2]);
  m.update(undefined, { quality: 'not-a-tier', mode: 'not-a-mode', explode: NaN });
  assert.deepEqual(m.stats, independentlyCount(m));
  near(get(m, 'Plate assembly').position.y, 0);
  assert.equal(partMeshes(m, 'plate.main')[0].material.clippingPlanes, null);
}));

test('service explosion preserves source assembly offsets and reverses with no drift', () => usingModel(m => {
  m.update({ stroke: 0.423 }, { explode: 0 });
  const assembled = transforms(m);
  m.update(undefined, { explode: 1 });
  near(get(m, 'Plate assembly').position.y, 0.16);
  near(get(m, 'Actuator assembly').position.y, 0.36);
  near(get(m, 'Rod-end assembly').position.y, 0.36);
  near(get(m, 'Rack assembly').position.y, 0.06);
  near(get(m, 'Output shaft assembly').position.y, -0.1365 - 0.12);
  vectorNear(get(m, 'left mirrored side').position.toArray(), [-0.16, -0.12, 0]);
  vectorNear(get(m, 'right mirrored side').position.toArray(), [0.16, -0.12, 0]);
  const exploded = transforms(m);
  assert.notDeepEqual(exploded, assembled);
  for (const e of [0, 0.36, 0.8, 0.12, 1]) m.update(undefined, { explode: e });
  assert.deepEqual(transforms(m), exploded);
  m.update(undefined, { explode: 0 });
  assert.deepEqual(transforms(m), assembled);
}));

test('x-ray reveals rack, piston and brakes while selection materials remain isolated', () => usingModel(m => {
  const uniqueMaterials = new Set(m.pickables.map(mesh => mesh.material));
  assert.equal(uniqueMaterials.size, m.pickables.length);
  m.update({ stroke: 0.4 }, { mode: 'xray' });
  for (const id of ['plate.main', 'rack.housing', 'actuator.barrel', 'right.wheel.tyre', 'right.wheel.rim', 'right.brake.caliper']) {
    for (const mesh of partMeshes(m, id)) { near(mesh.material.opacity, 0.12); assert.equal(mesh.material.depthWrite, false); }
  }
  for (const id of ['rack.teeth', 'actuator.piston', 'right.brake.disc', 'right.brake.pads', 'right.wheel.bearings']) {
    for (const mesh of partMeshes(m, id)) { near(mesh.material.opacity, 1); assert.equal(mesh.material.depthWrite, true); }
  }
  m.update(undefined, { selectedId: 'right.brake.caliper', highlight: true });
  const selected = partMeshes(m, 'right.brake.caliper')[0];
  const counterpart = partMeshes(m, 'left.brake.caliper')[0];
  near(selected.material.opacity, 0.36); near(counterpart.material.opacity, 0.12);
  assert.ok(selected.material.emissiveIntensity > 0);
  near(counterpart.material.emissiveIntensity, 0);
  for (const p of m.parts) {
    m.update(undefined, { selectedId: p.id, mode: 'solid' });
    assert.ok(partMeshes(m, p.id).every(mesh => mesh.material.emissiveIntensity > 0));
    assert.ok(m.pickables.filter(mesh => mesh.userData.partId !== p.id).every(mesh => mesh.material.emissiveIntensity === 0));
  }
  m.update(undefined, { selectedId: 'right.brake.caliper', highlight: false, mode: 'solid' });
  assert.ok(m.pickables.every(mesh => mesh.material.emissiveIntensity === 0 && mesh.material.opacity === 1 && !mesh.material.transparent));
}));

test('cutaway planes follow transformed model and moving wheels; internals remain unclipped', () => usingModel(m => {
  m.group.position.set(1.3, 0.6, -2.1); m.group.rotation.set(0.2, 0.5, -0.1); m.group.scale.setScalar(1.4);
  m.update({ stroke: 0.63 }, { mode: 'cutaway', explode: 0.5 });
  const body = get(m, 'Fixed assembly datum');
  const plane = partMeshes(m, 'plate.main')[0].material.clippingPlanes[0];
  near(plane.distanceToPoint(body.localToWorld(new THREE.Vector3(0, 0.2, -0.3))), 0);
  assert.ok(plane.distanceToPoint(body.localToWorld(new THREE.Vector3(0.1, 0, 0))) < 0);
  assert.ok(plane.distanceToPoint(body.localToWorld(new THREE.Vector3(-0.1, 0, 0))) > 0);
  for (const side of ['left', 'right']) {
    const wheel = get(m, `${side} wheel centre`);
    const wheelPlane = partMeshes(m, `${side}.wheel.tyre`)[0].material.clippingPlanes[0];
    near(wheelPlane.distanceToPoint(wheel.localToWorld(new THREE.Vector3(0.03, 0.05, 0))), 0);
    assert.ok(wheelPlane.distanceToPoint(wheel.localToWorld(new THREE.Vector3(0, 0, 0.05))) < 0);
    assert.equal(partMeshes(m, `${side}.brake.disc`)[0].material.clippingPlanes, null);
  }
}));

test('CPU picking respects clipped plate and mirrored tire/fastener geometry', () => usingModel(m => {
  const ray = new THREE.Raycaster();
  const plate = partMeshes(m, 'plate.main')[0];
  ray.set(new THREE.Vector3(1, GROUND + 0.42 - 0.013, 0.5), new THREE.Vector3(-1, 0, 0));
  const solid = ray.intersectObject(plate, false);
  assert.ok(solid.length && solid[0].point.x > 0);
  m.update(undefined, { mode: 'cutaway' });
  const cut = ray.intersectObject(plate, false);
  assert.ok(cut.length && cut.every(hit => hit.point.x < 1e-7));
  m.update({ stroke: 0 }, { mode: 'solid' });
  for (const side of ['left', 'right']) {
    const sign = side === 'left' ? -1 : 1;
    const centre = get(m, `${side} wheel centre`).getWorldPosition(new THREE.Vector3());
    ray.set(centre.clone().add(new THREE.Vector3(sign * 0.5, 0.17, 0)), new THREE.Vector3(-sign, 0, 0));
    assert.ok(ray.intersectObject(partMeshes(m, `${side}.wheel.tyre`)[0], false).length);
    const fasteners = partMeshes(m, `${side}.wheel.fasteners`)[0];
    const local = new THREE.Vector3(0.041, 0.080, 0.003).applyMatrix4(fasteners.matrixWorld);
    ray.set(local.clone().add(new THREE.Vector3(sign * 0.25, 0, 0)), new THREE.Vector3(-sign, 0, 0));
    const hits = ray.intersectObject(fasteners, false);
    assert.ok(hits.length, `${side} instanced fasteners should be pickable`);
    assert.equal(fasteners.userData.instanceParts[hits[0].instanceId], `${side}.wheel.fasteners`);
  }
}));

test('moving brake service loops retain their fixed and rotating endpoints', () => usingModel(m => {
  const matrix = new THREE.Matrix4();
  const end = (mesh, index, y) => {
    mesh.getMatrixAt(index, matrix);
    return new THREE.Vector3(0, y, 0).applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld);
  };
  for (const stroke of [0, 0.17, 0.5, 0.83, 1]) for (const explode of [0, 0.4, 1]) {
    m.update({ stroke }, { explode });
    for (const side of ['left', 'right']) {
      const sign = side === 'left' ? -1 : 1;
      const hose = partMeshes(m, `${side}.brake.flex`)[0];
      const start = new THREE.Vector3(sign * 0.155, 0.01 + 0.16 * explode, 0.17);
      get(m, 'Fixed assembly datum').localToWorld(start);
      const inlet = AXIS.clone().multiplyScalar(0.07).add(new THREE.Vector3(0, 0.034, 0.023));
      get(m, `${side} oblique rotation`).localToWorld(inlet);
      assert.ok(end(hose, 0, -0.5).distanceTo(start) < 0.0003);
      assert.ok(end(hose, hose.count - 1, 0.5).distanceTo(inlet) < 0.0003);
      const terminal = partMeshes(m, `${side}.brake.hose`).find(mesh => mesh.isInstancedMesh);
      const caliperPort = get(m, `${side} caliper extraction`).localToWorld(new THREE.Vector3(-0.030, 0.10, -0.028));
      assert.ok(end(terminal, terminal.count - 1, 0.5).distanceTo(caliperPort) < 0.0003);
    }
  }
}));

test('geometry kit rejects unregistered types instead of silently using a toy primitive', () => {
  const kit = createGeometryKit();
  try {
    assert.throws(() => kit.get('unknown-replacement'), /Unknown gear geometry/);
    assert.throws(() => kit.register('pinion', () => new THREE.BoxGeometry()), /Duplicate gear geometry/);
  } finally { kit.dispose(); }
});

test('all quality resources and instances dispose exactly once and detach cleanly', () => {
  const m = createModel();
  const scene = new THREE.Scene(); scene.add(m.group);
  const geometries = new Set(), materials = new Set(), instances = new Set();
  let disposedGeometries = 0, disposedMaterials = 0, disposedInstances = 0;
  for (const quality of ['low', 'balanced', 'high']) {
    m.update({ stroke: 0.8 }, { quality });
    for (const mesh of m.pickables) {
      if (!geometries.has(mesh.geometry)) { mesh.geometry.addEventListener('dispose', () => disposedGeometries++); geometries.add(mesh.geometry); }
      if (!materials.has(mesh.material)) { mesh.material.addEventListener('dispose', () => disposedMaterials++); materials.add(mesh.material); }
      if (mesh.isInstancedMesh && !instances.has(mesh)) { mesh.addEventListener('dispose', () => disposedInstances++); instances.add(mesh); }
    }
  }
  m.dispose(); m.dispose(); m.update({ stroke: 1 }, { quality: 'high' });
  assert.equal(disposedGeometries, geometries.size);
  assert.equal(disposedMaterials, materials.size);
  assert.equal(disposedInstances, instances.size);
  assert.equal(m.group.parent, null); assert.equal(m.group.children.length, 0);
  assert.equal(m.pickables.length, 0);
  assert.deepEqual(m.stats, { components: 0, triangles: 0, drawCallsEstimate: 0 });
});
