import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/tortoise/index.js';
import { createModel } from '../src/mechanisms/tortoise/model.js';
import { D, MOUNT, DEFAULT_INPUTS, sample, cycleHz, distance, solveKnee, linkPoint } from '../src/mechanisms/tortoise/kin.js';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const vectorNear = (a, b, epsilon = 1e-8) => a.forEach((v, i) => near(v, b[i], epsilon));
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function finite(v) { if (typeof v === 'number') assert.ok(Number.isFinite(v)); else if (v && typeof v === 'object') Object.values(v).forEach(finite); }
function node(model, id) { const n = model.group.getObjectByName(`tortoise.${id}`); assert.ok(n, id); return n; }
const worldPoint = (n, p) => new THREE.Vector3(...p).applyMatrix4(n.matrixWorld).toArray();
function entries(model) {
  const list = [];
  for (const mesh of model.pickables) for (let i = 0; i < mesh.count; i++) {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    list.push({ mesh, matrix, id: mesh.userData.instanceParts[i] });
  }
  return list;
}
function bounds(list, transform) {
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (const e of list) {
    const matrix = transform ? new THREE.Matrix4().multiplyMatrices(transform, e.matrix) : e.matrix;
    const p = e.mesh.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(matrix));
  }
  return box;
}
function matrices(model) { return model.pickables.map(m => Array.from(m.instanceMatrix.array.slice(0, m.count * 16))); }
function measured(model) {
  let instances = 0, triangles = 0, calls = 0; const ids = new Set();
  for (const mesh of model.pickables) {
    assert.ok(mesh.isInstancedMesh && mesh.instanceMatrix.count >= mesh.count);
    instances += mesh.count; triangles += mesh.count * (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    if (mesh.count) calls++;
    for (let i = 0; i < mesh.count; i++) {
      ids.add(mesh.userData.instanceParts[i]); const m = new THREE.Matrix4(); mesh.getMatrixAt(i, m); assert.ok(m.determinant() > 0); m.elements.forEach(x => assert.ok(Number.isFinite(x)));
    }
  }
  assert.deepEqual(model.stats, { instances, triangles, drawCalls: calls, selectableParts: ids.size });
  return { instances, triangles, calls, ids };
}
function assertSeparated(a, b) { assert.ok(!a.intersectsBox(b), 'Actual solid envelopes overlap'); }

test('tortoise descriptor, lessons, controls and lazy factory', async () => {
  assert.equal(descriptor.id, 'tortoise'); assert.equal(descriptor.title, 'CHELON T4'); assert.equal(descriptor.collection, '013');
  for (const key of ['family', 'description', 'cycleLabel']) assert.ok(descriptor[key].length > 8);
  assert.equal(descriptor.specs.length, 2); descriptor.specs.forEach(s => assert.ok(s.label.length <= 12)); assert.equal(descriptor.lessons.length, 5);
  for (const l of descriptor.lessons) {
    assert.ok(l.title && l.short && l.text.length >= 180 && l.fact.length >= 35);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  for (const c of descriptor.controls) { assert.ok(c.min <= DEFAULT_INPUTS[c.key] && c.max >= DEFAULT_INPUTS[c.key]); assert.ok(c.step > 0 && Number.isInteger(c.precision)); assert.equal(typeof c.unit, 'string'); }
  const model = await descriptor.createModel(); assert.ok(model.group.isGroup); model.dispose();
});

test('tortoise rigid gait, actuator engagement, period, negative time and control extremes', () => {
  for (const cadence of [.08, .22, .55]) for (const stride of [0, .5, 1]) for (let i = -48; i <= 96; i++) {
    const input = freeze({ cadence, stride }), t = i / (48 * cadence), s = sample(t, input), p = sample(t + 1 / cadence, input);
    assert.deepEqual(s, sample(t, input)); assert.ok(s.phase >= 0 && s.phase < 1); finite(s);
    near(s.driveAngle, s.phase * Math.PI * 2, 1e-12);
    assert.ok(s.legs.filter(l => l.stance).length >= 3);
    s.legs.forEach((l, j) => {
      const points = [l.hip, l.coxa, l.knee, l.foot];
      [D.coxa, D.femur, D.tibia].forEach((length, k) => near(distance(points[k], points[k + 1]), length));
      assert.ok(l.foot[1] >= D.sole); if (l.stance) near(l.foot[1], D.sole);
      vectorNear(l.foot, p.legs[j].foot); vectorNear(l.knee, p.legs[j].knee);
      vectorNear(l.actuator.b, linkPoint(l.coxa, l.knee, MOUNT));
      near(distance(l.actuator.rodStart, l.actuator.b), D.piston);
      const insertion = D.barrel + D.piston - l.actuator.length;
      assert.ok(insertion > .008 && insertion < D.barrel - .008, `Piston engagement: ${insertion}`);
    });
    s.neck.forEach((n, j) => { near(distance(n.start, n.end), j ? D.neckB : D.neckA); vectorNear(n.end, p.neck[j].end); });
    vectorNear(s.neck[0].end, s.neck[1].start); near(distance(s.jaw.start, s.jaw.end), .16); near(distance(s.tail.start, s.tail.end), D.tail);
    vectorNear(s.jaw.end, p.jaw.end); vectorNear(s.tail.end, p.tail.end);
    Object.values(s.metrics).slice(0, 3).forEach(v => assert.equal(typeof v, 'number'));
  }
  assert.notDeepEqual(sample(.71).legs[0].foot, sample(.71, { cadence: .55 }).legs[0].foot);
  assert.notDeepEqual(sample(.71).legs[0].foot, sample(.71, { stride: 0 }).legs[0].foot);
  assert.notDeepEqual(sample(0).head.start, sample(1).head.start); assert.notDeepEqual(sample(0).tail.end, sample(1).tail.end);
  for (const t of [NaN, Infinity, -Infinity, 1e100, -1e100]) finite(sample(t, { cadence: NaN, stride: Infinity }));
  finite(sample(-92, null)); near(cycleHz({ cadence: 9 }), .55); near(cycleHz({ cadence: -1 }), .08);
  assert.throws(() => solveKnee([0, 0, 0], [0, 3, 0]), RangeError);
});

test('tortoise rendered endpoints, rigid rods, real vertex bounds and floor', t => {
  const model = createModel(), dimensions = entries(model).map(e => [0, 1, 2].map(i => new THREE.Vector3().setFromMatrixColumn(e.matrix, i).length()));
  const swept = new THREE.Box3();
  try {
    for (const stride of [0, 1]) for (let i = 0; i < 24; i++) {
      const s = freeze(sample(i / (24 * .22), { stride })), before = JSON.stringify(s); model.update(s);
      s.legs.forEach(l => {
        const pins = [l.hip, l.coxa, l.knee, l.foot];
        ['coxa', 'femur', 'tibia'].forEach((key, j) => {
          const n = node(model, `leg.${l.id}.${key}`); vectorNear(worldPoint(n, [0, 0, 0]), pins[j]); vectorNear(worldPoint(n, [0, [D.coxa, D.femur, D.tibia][j], 0]), pins[j + 1]);
        });
        vectorNear(worldPoint(node(model, `leg.${l.id}.femur`), MOUNT), l.actuator.b);
        vectorNear(worldPoint(node(model, `leg.${l.id}.piston`), [0, D.piston, 0]), l.actuator.b);
        vectorNear(worldPoint(node(model, `leg.${l.id}.barrel`), [0, 0, 0]), l.actuator.a);
        vectorNear(worldPoint(node(model, `leg.${l.id}.pad`), [0, 0, 0]), l.foot);
      });
      s.neck.forEach((n, j) => { vectorNear(worldPoint(node(model, `neck.${j}.frame`), [0, n.length, 0]), n.end); });
      vectorNear(worldPoint(node(model, 'head.jaw'), [0, 0, -.16]), s.jaw.end); vectorNear(worldPoint(node(model, 'tail.frame'), [0, D.tail, 0]), s.tail.end);
      const list = entries(model), box = bounds(list); swept.union(box);
      list.forEach((e, j) => vectorNear([0, 1, 2].map(k => new THREE.Vector3().setFromMatrixColumn(e.matrix, k).length()), dimensions[j], 1e-6));
      assert.ok(box.min.y >= -1e-7, `Floor penetration ${box.min.y}`); assert.ok(box.max.y > .98 && box.max.y < 1.13);
      assert.ok(box.max.x - box.min.x > 1.50 && box.max.x - box.min.x < 1.90);
      assert.ok(box.max.z - box.min.z > 2.08 && box.max.z - box.min.z < 2.50);
      for (const l of s.legs) {
        const piston = list.filter(e => e.id === `tortoise.leg.${l.id}.piston` && e.mesh.geometry.type === 'CylinderGeometry' && Math.abs(new THREE.Vector3().setFromMatrixColumn(e.matrix, 1).length() - D.piston) < 1e-6);
        assert.equal(piston.length, 1);
        vectorNear(new THREE.Vector3(0, -.5, 0).applyMatrix4(piston[0].matrix).toArray(), l.actuator.rodStart, 1e-6);
        vectorNear(new THREE.Vector3(0, .5, 0).applyMatrix4(piston[0].matrix).toArray(), l.actuator.b, 1e-6);
        const padBox = bounds(list.filter(e => e.id.startsWith(`tortoise.leg.${l.id}.pad`) || e.id.startsWith(`tortoise.leg.${l.id}.toe`)));
        near(padBox.min.y, l.foot[1] - D.sole, 1e-6);
      }
      const shell = bounds(list.filter(e => e.id.startsWith('tortoise.scute.')));
      assert.ok(shell.max.y - shell.min.y > .35, 'Scutes must form a raised dome');
      assert.equal(model.parts.filter(p => p.id.startsWith('tortoise.scute.')).length, 68);
      model.group.traverse(n => assert.deepEqual(n.scale.toArray(), [1, 1, 1])); assert.deepEqual(model.group.position.toArray(), [0, 0, 0]); assert.deepEqual(model.group.quaternion.toArray(), [0, 0, 0, 1]);
      assert.equal(JSON.stringify(s), before);
    }
    t.diagnostic(`balanced ${JSON.stringify(model.stats)}; swept XYZ ${swept.getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(3)).join(' × ')} m`);
  } finally { model.dispose(); }
});

test('tortoise swept real-vertex foot/shell and knee gear/rail clearance, with negative control', t => {
  const model = createModel(); let minLaneGap = Infinity;
  try {
    for (const stride of [0, .5, 1]) for (let i = 0; i < 72; i++) {
      const s = sample(i / (72 * .22), { stride }); model.update(s); const list = entries(model);
      const dome = bounds(list.filter(e => e.id.startsWith('tortoise.scute.') || e.id.startsWith('tortoise.dome.')));
      const feet = s.legs.map(l => bounds(list.filter(e => e.id === `tortoise.leg.${l.id}.pad` || e.id.startsWith(`tortoise.leg.${l.id}.toe.`))));
      const limbs = s.legs.map(l => bounds(list.filter(e => e.id.startsWith(`tortoise.leg.${l.id}.`))));
      for (let a = 0; a < limbs.length; a++) {
        assertSeparated(limbs[a], dome);
        for (let b = a + 1; b < limbs.length; b++) assertSeparated(limbs[a], limbs[b]);
      }
      for (let a = 0; a < feet.length; a++) {
        assertSeparated(feet[a], dome);
        for (let b = a + 1; b < feet.length; b++) assertSeparated(feet[a], feet[b]);
      }
      const overlapping = feet[1].clone().translate(feet[0].getCenter(new THREE.Vector3()).sub(feet[1].getCenter(new THREE.Vector3())));
      assert.throws(() => assertSeparated(feet[0], overlapping), /envelopes overlap/);
      for (const l of s.legs) {
        const inverse = node(model, `leg.${l.id}.tibia`).matrixWorld.clone().invert();
        const wheel = bounds(list.filter(e => e.id === `tortoise.leg.${l.id}.kneewheel`), inverse);
        // Select the two actual long rail cylinders, excluding deliberately
        // engaged hub shafts and their bearing eyes from the clearance pair.
        const railEntries = list.filter(e => e.id === `tortoise.leg.${l.id}.tibia` && e.mesh.geometry.type === 'CylinderGeometry' && Math.abs(new THREE.Vector3().setFromMatrixColumn(e.matrix, 1).length() - (D.tibia - .028)) < 1e-6);
        assert.equal(railEntries.length, 2); const rails = bounds(railEntries, inverse);
        assertSeparated(wheel, rails); minLaneGap = Math.min(minLaneGap, wheel.min.z - rails.max.z);
        assert.throws(() => assertSeparated(rails, rails.clone()), /envelopes overlap/);
      }
    }
    assert.ok(minLaneGap > .04); t.diagnostic(`Minimum knee plate / rail lane gap ${(minLaneGap * 1000).toFixed(2)} mm`);
  } finally { model.dispose(); }
});

test('tortoise actual matrix budgets, metadata, selection, modes, reversible explosion and disposal', t => {
  const model = createModel(), s = freeze(sample(.63));
  try {
    const ids = new Set(), names = new Set();
    for (const p of model.parts) {
      assert.ok(!ids.has(p.id) && !names.has(p.name)); ids.add(p.id); names.add(p.name);
      for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[key] === 'string' && p[key].length >= (key === 'unit' ? 3 : 8), `${p.id}: ${key}`);
    }
    assert.ok(model.parts.length >= 90 && model.parts.length <= 200);
    model.update(s); const balanced = measured(model), original = matrices(model);
    t.diagnostic(`balanced parts=${model.parts.length}, instances=${balanced.instances}, triangles=${balanced.triangles}, calls=${balanced.calls}`);
    assert.ok(balanced.instances >= 1000 && balanced.instances <= 2000); assert.ok(balanced.triangles >= 60000 && balanced.triangles <= 130000); assert.ok(balanced.calls <= 32);
    for (const mode of ['solid', 'xray', 'cutaway']) {
      model.update(s, { mode, quality: 'low' }); const low = measured(model); assert.deepEqual(low.ids, ids);
      if (mode === 'solid') t.diagnostic(`low instances=${low.instances}, triangles=${low.triangles}, calls=${low.calls}`);
      assert.ok(low.instances < balanced.instances && low.triangles < 80000); assert.ok(low.calls <= 32);
      for (const m of model.pickables) {
        assert.equal(m.material.clippingPlanes?.length ?? 0, mode === 'cutaway' ? 1 : 0);
        if (m.material.color.getHex() === 0xced5cf) near(m.material.opacity, mode === 'xray' ? .13 : 1);
      }
      for (const id of ids) {
        model.update(s, { mode, quality: 'low', selectedId: id }); let selected = 0;
        for (const m of model.pickables) for (let i = 0; i < m.count; i++) {
          const color = new THREE.Color(); m.getColorAt(i, color);
          const target = m.userData.instanceParts[i] === id ? new THREE.Color(0x9ceacb) : new THREE.Color(0xffffff);
          vectorNear(color.toArray(), target.toArray(), 1e-6); if (m.userData.instanceParts[i] === id) selected++;
        }
        assert.ok(selected > 0);
      }
    }
    for (let i = 0; i < 20; i++) { model.update(sample(i * .17), { explode: (i % 3) / 2 }); model.update(s, { explode: 0 }); assert.deepEqual(matrices(model), original); }
    model.update(s, { explode: 1 }); assert.notDeepEqual(matrices(model), original); model.update(s); assert.deepEqual(matrices(model), original);
    const resources = new Set(model.pickables.flatMap(m => [m, m.geometry, m.material])), events = new Map();
    for (const r of resources) r.addEventListener('dispose', () => events.set(r, (events.get(r) || 0) + 1));
    model.dispose(); model.dispose(); model.update(s); assert.equal(model.group.children.length, 0); assert.deepEqual(model.pickables, []);
    for (const r of resources) assert.equal(events.get(r), 1);
  } finally { model.dispose(); }
});
