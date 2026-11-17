import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/robot-hand/index.js';
import { createModel } from '../src/mechanisms/robot-hand/model.js';
import { D, TAU, DEFAULT_INPUTS, cycleHz, inputsOf, wristWorld, poseAt, sample } from '../src/mechanisms/robot-hand/kin.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const finite = o => { if (typeof o === 'number') assert.ok(Number.isFinite(o)); else if (o && typeof o === 'object') Object.values(o).forEach(finite); };
const using = fn => { const m = createModel(); try { fn(m); } finally { m.dispose(); } };
const snapshot = m => m.pickables.map(p => ({ ids: p.userData.instanceParts.slice(0, p.count), matrices: Array.from(p.instanceMatrix.array.slice(0, p.count * 16)) }));
function primitives(model, accepts = () => true) {
  const out = [];
  for (const mesh of model.pickables) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    for (let i = 0; i < mesh.count; i++) {
      const id = mesh.userData.instanceParts[i]; if (!accepts(id)) continue;
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
      const axes = [0, 1, 2].map(j => new THREE.Vector3().setFromMatrixColumn(matrix, j));
      const half = box.getSize(new THREE.Vector3()).multiplyScalar(.5).toArray().map((v, j) => v * axes[j].length()); axes.forEach(a => a.normalize());
      out.push({ id, matrix, axes, half, center: box.getCenter(new THREE.Vector3()).applyMatrix4(matrix), type: mesh.geometry.type, geometry: mesh.geometry, color: mesh.material.color.getHex() });
    }
  }
  return out;
}
function separated(a, b) {
  const delta = b.center.clone().sub(a.center);
  if (delta.lengthSq() > (Math.hypot(...a.half) + Math.hypot(...b.half)) ** 2) return true;
  const gap = axis => {
    if (axis.lengthSq() < 1e-14) return false;
    const r = p => p.half.reduce((s, h, i) => s + h * Math.abs(p.axes[i].dot(axis)), 0);
    return Math.abs(delta.dot(axis)) > r(a) + r(b) + 1e-7;
  };
  return [...a.axes, ...b.axes].some(gap) || a.axes.some(x => b.axes.some(y => gap(new THREE.Vector3().crossVectors(x, y))));
}
const endpoint = (p, y) => new THREE.Vector3(0, y, 0).applyMatrix4(p.matrix);
function groupBox(ps) {
  const b = new THREE.Box3();
  for (const p of ps) {
    const r = new THREE.Vector3(...[0, 1, 2].map(j => p.half.reduce((sum, h, k) => sum + h * Math.abs(p.axes[k].getComponent(j)), 0)));
    b.expandByPoint(p.center.clone().sub(r)); b.expandByPoint(p.center.clone().add(r));
  }
  return b;
}
function insideConvex(primitive, point) {
  const p = point.clone().applyMatrix4(primitive.matrix.clone().invert()), v = primitive.geometry.attributes.position, ix = primitive.geometry.index;
  for (let i = 0; i < ix.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(v, ix.getX(i)), b = new THREE.Vector3().fromBufferAttribute(v, ix.getX(i + 1)), c = new THREE.Vector3().fromBufferAttribute(v, ix.getX(i + 2));
    const normal = b.sub(a).cross(c.sub(a));
    if (normal.lengthSq() > 1e-15 && normal.normalize().dot(p.clone().sub(a)) >= -1e-7) return false;
  }
  return true;
}
function bounds(model) {
  const b = new THREE.Box3(), p = new THREE.Vector3(), matrix = new THREE.Matrix4();
  for (const m of model.pickables) for (let i = 0; i < m.count; i++) {
    m.getMatrixAt(i, matrix); assert.ok(matrix.determinant() > 0, 'no mirrored negative scales');
    for (let j = 0; j < m.geometry.attributes.position.count; j++) b.expandByPoint(p.fromBufferAttribute(m.geometry.attributes.position, j).applyMatrix4(matrix));
  }
  return b;
}

test('DEXTRA H5 descriptor has two controls, five honest lessons and a lazy model', async () => {
  assert.equal(descriptor.id, 'robot-hand'); assert.equal(descriptor.title, 'DEXTRA H5'); assert.equal(descriptor.collection, '015');
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const c of descriptor.controls) { assert.ok(c.key in DEFAULT_INPUTS); assert.ok(c.min < c.max && c.step > 0); assert.ok(Number.isInteger(c.precision)); assert.ok(c.label && c.unit); }
  for (const s of descriptor.specs) assert.ok(s.label.length <= 12);
  for (const l of descriptor.lessons) { assert.ok(l.text.length >= 180 && l.fact.length >= 35 && l.short.length > 4); assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1); }
  assert.match(descriptor.description, /not contact forces or tendon dynamics/); assert.deepEqual(descriptor.sample(.3), sample(.3));
  const model = await descriptor.createModel(); assert.ok(model.group.isGroup && model.pickables.length); model.dispose();
});

test('fifteen rigid links retain length over every control corner and 720 phases', () => {
  assert.equal(new Set(D.digits.map(d => d.lengths.reduce((a, b) => a + b))).size, 5);
  for (const cadence of [.12, .8]) for (const grip of [25, 80, 100]) for (let k = 0; k < 720; k++) {
    const p = poseAt(k * TAU / 720, { cadence, grip }); finite(p); assert.equal(p.digits.length, 5);
    for (const [i, d] of p.digits.entries()) {
      assert.equal(d.joints.length, 3); assert.equal(d.tendons.length, 8);
      D.digits[i].lengths.forEach((length, j) => { near(distance(d.points[j], d.points[j + 1]), length); near(distance(d.worldPoints[j], d.worldPoints[j + 1]), length); });
      assert.ok(d.curl >= 0 && d.curl <= 1); for (const t of d.tendons) assert.ok(distance(t.start, t.end) > .03);
    }
    assert.ok(Math.abs(p.wristYaw) <= .075); assert.ok(Object.values(p.metrics).slice(0, 3).every(Number.isFinite));
  }
});

test('sampling is pure, finite, periodic and reversible; cadence, grip, offsets and opposition all matter', () => {
  for (const cadence of [.12, .8]) for (const grip of [25, 100]) for (const t of [-999, -1.234, 0, .49, 19, 100000]) {
    const a = sample(t, { cadence, grip }), b = sample(t + 1 / cadence, { cadence, grip }); finite(a); assert.ok(a.phase >= 0 && a.phase < 1);
    sample(t + 17, { grip: 39 }); assert.deepEqual(sample(t, { cadence, grip }), a);
    a.digits.forEach((d, i) => d.worldPoints.forEach((p, j) => near(distance(p, b.digits[i].worldPoints[j]), 0, 1e-8))); near(cycleHz({ cadence }), cadence);
  }
  for (const t of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) for (const input of [null, {}, { cadence: NaN, grip: Infinity }, { cadence: -9, grip: 999 }]) finite(sample(t, input));
  assert.deepEqual(inputsOf({ cadence: -10, grip: 1000 }), { cadence: .12, grip: 100 });
  assert.ok(distance(sample(.8, { cadence: .12 }).digits[0].worldPoints[3], sample(.8, { cadence: .8 }).digits[0].worldPoints[3]) > .1);
  const small = poseAt(Math.PI, { grip: 25 }), full = poseAt(Math.PI, { grip: 100 });
  assert.ok(full.metrics.indexCurlDeg > small.metrics.indexCurlDeg * 3);
  assert.ok(full.digits[4].opposition - small.digits[4].opposition > .3);
  assert.notEqual(poseAt(1).digits[0].curl, poseAt(1).digits[3].curl);
  near(distance(sample(-1e-8).digits[4].worldPoints[3], sample(1e-8).digits[4].worldPoints[3]), 0, 1e-7);
});

test('actual rendered bone endpoints, both hinge cheeks, and every tendon endpoint agree across the sweep', () => using(model => {
  for (const grip of [25, 100]) for (let k = 0; k < 96; k++) {
    const s = poseAt(k * TAU / 96, { grip }); model.update(s);
    const ps = primitives(model, id => /\.(bone|bracket|pulley)$/.test(id) || id.startsWith('tendon.'));
    s.digits.forEach((d, i) => {
      const spec = D.digits[i];
      d.joints.forEach((_, j) => {
        const prefix = `digit.${d.id}.${j}`, spine = ps.find(p => p.id === `${prefix}.bone` && p.type === 'CylinderGeometry' && p.color === 0x26343d && Math.abs(p.half[1] * 2 - spec.lengths[j]) < 1e-6);
        assert.ok(spine); near(distance(endpoint(spine, -.5).toArray(), d.worldPoints[j]), 0, 2e-7); near(distance(endpoint(spine, .5).toArray(), d.worldPoints[j + 1]), 0, 2e-7);
        near(endpoint(spine, -.5).distanceTo(endpoint(spine, .5)), spec.lengths[j], 2e-7);
        const bone = model.group.getObjectByName(`${prefix}.bone`); assert.deepEqual(bone.scale.toArray(), [1, 1, 1]);
        const pin = ps.find(p => p.id === `${prefix}.bracket` && p.type === 'CylinderGeometry' && p.color === 0xb28b4d);
        const wheels = ps.filter(p => p.id === `${prefix}.pulley` && p.type === 'TorusGeometry'); assert.equal(wheels.length, 2);
        near(distance(pin.center.toArray(), d.worldPoints[j]), 0, 2e-7);
        const start = endpoint(pin, -.5), end = endpoint(pin, .5), axis = end.clone().sub(start).normalize();
        for (const wheel of wheels) {
          const delta = wheel.center.clone().sub(start); near(delta.clone().cross(axis).length(), 0, 2e-7); near(Math.abs(axis.dot(wheel.axes[2])), 1, 1e-6);
          assert.ok(delta.dot(axis) - wheel.half[2] >= -1e-7 && delta.dot(axis) + wheel.half[2] <= start.distanceTo(end) + 1e-7);
        }
      });
      for (const t of d.tendons) {
        const line = ps.find(p => p.id === `tendon.${d.id}.${t.side}.${t.k}`); assert.ok(line);
        near(distance(endpoint(line, -.5).toArray(), wristWorld(t.start, s.wristYaw)), 0, 2e-7);
        near(distance(endpoint(line, .5).toArray(), wristWorld(t.end, s.wristYaw)), 0, 2e-7);
      }
    });
  }
}));

test('thumb brass bearing stays coaxial with the commanded palm-local opposition axis at every phase and grip corner', () => using(model => {
  const palm = model.group.getObjectByName('palm.carrier'), rootNode = model.group.getObjectByName('digit.thumb.root');
  const rootPos = new THREE.Vector3(), palmY = new THREE.Vector3(), axis = new THREE.Vector3();
  let worstAngle = 0, worstOffset = 0, worstSplay = 0, bearings = 0;
  for (const grip of [25, 100]) for (let k = 0; k < 120; k++) {
    const s = poseAt(k * TAU / 120, { grip }); model.update(s);
    const rootPrims = primitives(model, id => id === 'digit.thumb.root');
    const parts = [
      rootPrims.find(p => p.type === 'CylinderGeometry' && p.color === 0xb28b4d && Math.abs(p.half[0] - .036) < 1e-6),
      rootPrims.find(p => p.type === 'TorusGeometry' && p.color === 0xb28b4d),
    ];
    assert.ok(parts.every(Boolean), 'brass bearing cylinder and ring must both render');
    rootPos.setFromMatrixPosition(rootNode.matrixWorld); palmY.set(0, 1, 0).transformDirection(palm.matrixWorld).normalize();
    for (const p of parts) {
      axis.set(0, p.type === 'TorusGeometry' ? 0 : 1, p.type === 'TorusGeometry' ? 1 : 0).transformDirection(p.matrix).normalize();
      worstAngle = Math.max(worstAngle, Math.acos(Math.min(1, Math.abs(axis.dot(palmY)))) * 180 / Math.PI);
      const delta = p.center.clone().sub(rootPos), lateral = delta.clone().addScaledVector(palmY, -delta.dot(palmY));
      worstOffset = Math.max(worstOffset, lateral.length()); bearings++;
    }
    if (grip === 100) {
      const splay = s.digits[4].splay, splayed = new THREE.Vector3(-Math.sin(splay), Math.cos(splay), 0);
      worstSplay = Math.max(worstSplay, Math.acos(Math.min(1, Math.abs(splayed.dot(palmY)))) * 180 / Math.PI);
    }
  }
  assert.equal(bearings, 480);
  assert.ok(worstAngle < 1e-6, `bearing axis tilts ${worstAngle} deg from palm yaw`);
  assert.ok(worstOffset < 1e-7, `bearing center is ${worstOffset} m off the root yaw axis`);
  assert.ok(worstSplay > 30, `commanded thumb splay ${worstSplay} deg makes the coaxial gate meaningful`);
  console.log(`DEXTRA H5 thumb bearing: ${worstAngle.toExponential(2)} deg axis error, ${worstOffset.toExponential(2)} m off-axis; ${worstSplay.toFixed(1)} deg splay bypassed`);
}));

test('rendered adjacent digits and curled distal links clear the palm at every swept corner, with penetration negative controls', () => using(model => {
  let testedPairs = 0, negative = 0;
  for (const cadence of [.12, .8]) for (const grip of [25, 100]) for (let k = 0; k < 120; k++) {
    const s = poseAt(k * TAU / 120, { cadence, grip }); model.update(s, { quality: 'balanced' });
    const ps = primitives(model, id => id.startsWith('digit.') || id.startsWith('palm.'));
    const groups = D.digits.map(d => ps.filter(p => p.id.startsWith(`digit.${d.id}.`))), boxes = groups.map(groupBox);
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) {
      if (!boxes[a].intersectsBox(boxes[b])) { testedPairs++; continue; }
      for (const x of groups[a]) for (const y of groups[b]) { assert.ok(separated(x, y), `${x.id}/${x.type} contacts ${y.id}/${y.type}; phase ${k}, grip ${grip}`); testedPairs++; }
    }
    // Basal bearings intentionally mount into the metacarpals. Test all middle /
    // distal geometry and pads against every rendered palm rail, saddle and cover.
    const palm = ps.filter(p => p.id.startsWith('palm.'));
    const distal = ps.filter(p => /^digit\.[^.]+\.([12]\.|pad)/.test(p.id));
    for (const a of distal) for (const b of palm) assert.ok(separated(a, b), `${a.id} contacts palm ${b.id}; phase ${k}, grip ${grip}`);
    if (k === 60) {
      const spine = name => ps.find(p => p.id === `digit.${name}.2.bone` && p.type === 'CylinderGeometry' && p.color === 0x26343d);
      const a = spine('index'), b = spine('middle'), shifted = { ...b, center: a.center.clone(), matrix: b.matrix.clone() }; shifted.matrix.setPosition(a.center);
      assert.equal(separated(a, shifted), false); assert.ok(insideConvex(a, endpoint(shifted, 0)), 'actual translated middle spine penetrates index spine');
      const panel = palm.find(p => p.type === 'BoxGeometry'), intoPalm = { ...b, center: panel.center.clone(), matrix: b.matrix.clone() }; intoPalm.matrix.setPosition(panel.center);
      assert.equal(separated(panel, intoPalm), false); assert.ok(insideConvex(panel, endpoint(intoPalm, 0)), 'actual translated spine penetrates palm panel'); negative += 2;
    }
  }
  assert.ok(testedPairs > 4800); assert.equal(negative, 8);
}));

test('complete moving geometry is grounded, roughly two metres tall, and narrow enough for a hand silhouette', () => using(model => {
  for (const grip of [25, 100]) for (let k = 0; k < 24; k++) {
    model.update(poseAt(k * TAU / 24, { grip })); const b = bounds(model), size = b.getSize(new THREE.Vector3());
    near(b.min.y, 0, 1e-7); assert.ok(b.max.y <= 2.05 && b.max.y >= 1.45, `height ${b.max.y}`); assert.ok(size.x < 1.25 && size.z < 1.1, `bounds ${size.toArray()}`);
  }
}));

test('all meaningful metadata is reachable in low quality; measured instance and triangle counters meet budgets', () => using(model => {
  const ids = new Set(model.parts.map(p => p.id)); assert.equal(ids.size, model.parts.length); assert.equal(new Set(model.parts.map(p => p.name)).size, ids.size); assert.ok(ids.size >= 100 && ids.size <= 200);
  for (const p of model.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[key] === 'string' && p[key].length > 2);
  assert.equal(model.parts.filter(p => p.id.endsWith('.bone')).length, 15); assert.equal(model.parts.filter(p => p.id.endsWith('.capstan')).length, 5); assert.equal(model.parts.filter(p => p.id.endsWith('.pad')).length, 5);
  assert.deepEqual(model.group.position.toArray(), [0, 0, 0]); assert.deepEqual(model.group.quaternion.toArray(), [0, 0, 0, 1]);
  for (const quality of ['balanced', 'low']) {
    model.update(sample(.23), { quality }); const used = new Set(); let instances = 0, triangles = 0, calls = 0;
    for (const m of model.pickables) {
      if (m.count) calls++; instances += m.count; triangles += m.count * m.geometry.index.count / 3;
      finite(Array.from(m.geometry.attributes.position.array)); for (const ix of m.geometry.index.array) assert.ok(ix < m.geometry.attributes.position.count);
      for (let i = 0; i < m.count; i++) { assert.ok(ids.has(m.userData.instanceParts[i])); used.add(m.userData.instanceParts[i]); }
    }
    assert.equal(used.size, ids.size); assert.deepEqual(model.stats, { instances, triangles, drawCalls: calls, selectableParts: ids.size });
    assert.ok(calls <= 32); assert.ok(triangles <= (quality === 'low' ? 80000 : 135000), `${quality}: ${triangles}`);
    if (quality === 'balanced') { assert.ok(triangles >= 70000); assert.ok(instances >= 1000 && instances <= 2200, `balanced instances: ${instances}, triangles: ${triangles}, parts: ${ids.size}`); console.log('DEXTRA H5 balanced', model.stats); } else console.log('DEXTRA H5 low', model.stats);
  }
}));

test('all modes, selection, pose changes, periodicity and exact explode reversal preserve the bind state', () => using(model => {
  const s = sample(.71), immutable = structuredClone(s); model.update(s); const original = snapshot(model);
  model.update(sample(1.42)); assert.notDeepEqual(snapshot(model), original);
  for (let k = 0; k < 3; k++) {
    model.update(s, { explode: .83, mode: 'xray', quality: 'low', selectedId: 'digit.index.2.bone' }); assert.notDeepEqual(snapshot(model), original);
    for (const m of model.pickables) { const shell = m.material.color.getHex() === 0xced5cf; assert.equal(m.material.transparent, shell); near(m.material.opacity, shell ? .13 : 1); assert.equal(m.material.depthWrite, !shell); }
    model.update(s, { explode: .37, mode: 'cutaway' }); for (const m of model.pickables) { assert.equal(m.material.clippingPlanes.length, 1); assert.equal(m.material.side, THREE.DoubleSide); assert.equal(m.material.forceSinglePass, true); }
    model.update(s); assert.deepEqual(snapshot(model), original);
  }
  model.update({ driveAngle: s.driveAngle }); assert.deepEqual(snapshot(model), original); model.update(undefined); assert.deepEqual(snapshot(model), original); assert.deepEqual(s, immutable);
  model.update(s, { selectedId: 'digit.index.2.bone' }); const color = new THREE.Color(); let selected = 0;
  for (const m of model.pickables) { assert.equal(m.material.side, THREE.FrontSide); assert.equal(m.material.clippingPlanes.length, 0); assert.equal(m.material.transparent, false);
    for (let i = 0; i < m.count; i++) { m.getColorAt(i, color); const on = m.userData.instanceParts[i] === 'digit.index.2.bone'; assert.equal(color.getHex() !== 0xffffff, on); selected += Number(on); }
  }
  assert.ok(selected > 0); assert.deepEqual(snapshot(model), original);
  model.update(sample(s.t + 1 / cycleHz())); const periodic = snapshot(model); original.forEach((p, j) => p.matrices.forEach((v, i) => near(v, periodic[j].matrices[i], 2e-7)));
}));

test('geometry buffers remain stable and disposal is complete and idempotent', () => {
  const model = createModel(), meshes = model.pickables, resources = new Set(meshes.flatMap(m => [m, m.geometry, m.material])), calls = new Map();
  const arrays = meshes.map(m => m.geometry.attributes.position.array), saved = arrays.map(a => a.slice()), matrices = meshes.map(m => m.instanceMatrix.array);
  resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) || 0) + 1)));
  for (let i = 0; i < 48; i++) model.update(sample(i * .039), { explode: i % 2 ? .7 : 0, quality: i % 3 ? 'balanced' : 'low' });
  model.pickables.forEach((m, i) => { assert.equal(m.geometry.attributes.position.array, arrays[i]); assert.equal(m.instanceMatrix.array, matrices[i]); assert.deepEqual(arrays[i], saved[i]); finite(Array.from(m.instanceMatrix.array)); });
  model.dispose(); model.dispose(); model.update(sample(2)); resources.forEach(r => assert.equal(calls.get(r), 1)); assert.equal(model.group.children.length, 0); assert.equal(model.pickables.length, 0);
});
