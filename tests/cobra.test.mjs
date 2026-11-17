import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/cobra/index.js';
import { createModel } from '../src/mechanisms/cobra/model.js';
import { D, HOOD_LENGTHS, DEFAULT_INPUTS, sample, cycleHz, distance, point } from '../src/mechanisms/cobra/kin.js';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} != ${b}`);
const vectorNear = (a, b, epsilon = 1e-8) => a.forEach((x, i) => near(x, b[i], epsilon));
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function finite(value) { if (typeof value === 'number') assert.ok(Number.isFinite(value)); else if (value && typeof value === 'object') Object.values(value).forEach(finite); }
function node(model, id) { const n = model.group.getObjectByName(`cobra.${id}`); assert.ok(n, id); return n; }
const worldPoint = (n, p) => new THREE.Vector3(...p).applyMatrix4(n.matrixWorld).toArray();
function entries(model) {
  const result = [];
  for (const mesh of model.pickables) for (let i = 0; i < mesh.count; i++) {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    result.push({ mesh, matrix, id: mesh.userData.instanceParts[i], index: i });
  }
  return result;
}
function bounds(list, transform) {
  const box = new THREE.Box3(), v = new THREE.Vector3();
  for (const e of list) {
    const matrix = transform ? new THREE.Matrix4().multiplyMatrices(transform, e.matrix) : e.matrix;
    const positions = e.mesh.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) box.expandByPoint(v.fromBufferAttribute(positions, i).applyMatrix4(matrix));
  }
  return box;
}
// Separating-axis test for independently measured oriented envelopes. The
// envelope includes every real primitive of a complete rib, armor and gear.
function envelope(list, frame) {
  const box = bounds(list, frame.matrixWorld.clone().invert());
  return { center: box.getCenter(new THREE.Vector3()).applyMatrix4(frame.matrixWorld), half: box.getSize(new THREE.Vector3()).multiplyScalar(.5).toArray(), axes: [0, 1, 2].map(i => new THREE.Vector3().setFromMatrixColumn(frame.matrixWorld, i).normalize()) };
}
function clearEnvelopes(a, b) {
  const axes = [...a.axes, ...b.axes, ...a.axes.flatMap(u => b.axes.map(v => new THREE.Vector3().crossVectors(u, v)))];
  const delta = b.center.clone().sub(a.center);
  const radius = (box, axis) => box.axes.reduce((sum, u, i) => sum + Math.abs(u.dot(axis)) * box.half[i], 0);
  assert.ok(axes.some(axis => axis.lengthSq() > 1e-12 && Math.abs(delta.dot(axis.clone().normalize())) > radius(a, axis.clone().normalize()) + radius(b, axis.clone().normalize()) + 1e-5), 'Articulated assembly envelopes overlap');
}
function matrices(model) { return model.pickables.map(m => Array.from(m.instanceMatrix.array.slice(0, m.count * 16))); }
function measured(model) {
  let instances = 0, triangles = 0, calls = 0;
  const ids = new Set();
  for (const m of model.pickables) {
    assert.ok(m.isInstancedMesh); assert.ok(m.instanceMatrix.count >= m.count);
    if (m.count) calls++;
    instances += m.count; triangles += m.count * (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
    for (let i = 0; i < m.count; i++) {
      ids.add(m.userData.instanceParts[i]);
      const mat = new THREE.Matrix4(); m.getMatrixAt(i, mat); assert.ok(mat.determinant() > 0); mat.elements.forEach(x => assert.ok(Number.isFinite(x)));
    }
  }
  assert.deepEqual({ instances, triangles, drawCalls: calls, selectableParts: ids.size }, model.stats);
  return { instances, triangles, calls, ids };
}
// Capsules conservatively enclose the ACTUAL cylinder buffers, including the
// end disks. Their radius is measured after transforming all radial vertices.
function capsule(e) {
  assert.equal(e.mesh.geometry.type, 'CylinderGeometry');
  const a = new THREE.Vector3(0, -.5, 0).applyMatrix4(e.matrix), b = new THREE.Vector3(0, .5, 0).applyMatrix4(e.matrix);
  const axis = b.clone().sub(a).normalize(), pos = e.mesh.geometry.attributes.position;
  let radius = 0;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(e.matrix).sub(a);
    radius = Math.max(radius, v.clone().addScaledVector(axis, -v.dot(axis)).length());
  }
  return { a, b, radius, id: e.id };
}
function segmentDistance(p, q) {
  const u = p.b.clone().sub(p.a), v = q.b.clone().sub(q.a), w = p.a.clone().sub(q.a);
  const a = u.dot(u), b = u.dot(v), c = v.dot(v), d = u.dot(w), e = v.dot(w), determinant = a * c - b * b;
  let s = determinant > 1e-15 ? Math.max(0, Math.min(1, (b * e - c * d) / determinant)) : 0;
  let t = (b * s + e) / c;
  if (t < 0) { t = 0; s = Math.max(0, Math.min(1, -d / a)); }
  else if (t > 1) { t = 1; s = Math.max(0, Math.min(1, (b - d) / a)); }
  return w.addScaledVector(u, s).addScaledVector(v, -t).length();
}
function clearCapsules(a, b) { assert.ok(segmentDistance(a, b) > a.radius + b.radius + .001, `Rail collision: ${a.id} / ${b.id}`); }

test('cobra descriptor contract and lazy factory', async () => {
  assert.equal(descriptor.id, 'cobra'); assert.equal(descriptor.title, 'NAJA N18'); assert.equal(descriptor.collection, '012');
  for (const key of ['family', 'description', 'cycleLabel']) assert.ok(descriptor[key].length > 8);
  assert.equal(descriptor.specs.length, 2); descriptor.specs.forEach(s => assert.ok(s.label.length <= 12));
  assert.equal(descriptor.lessons.length, 5);
  for (const l of descriptor.lessons) {
    assert.ok(l.title && l.short && l.text.length >= 180 && l.fact.length >= 35);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  for (const c of descriptor.controls) { assert.ok(c.min <= DEFAULT_INPUTS[c.key] && c.max >= DEFAULT_INPUTS[c.key]); assert.ok(c.step > 0 && Number.isInteger(c.precision)); assert.equal(typeof c.unit, 'string'); }
  const model = await descriptor.createModel(); assert.ok(model.group.isGroup); model.dispose();
});

test('cobra deterministic periodic FK, rigid lengths and all legal extremes', () => {
  for (const cadence of [.06, .16, .4]) for (const spread of [0, .5, 1]) {
    const input = freeze({ cadence, spread });
    for (let i = -36; i <= 72; i++) {
      const t = i / (36 * cadence), s = sample(t, input), p = sample(t + 1 / cadence, input);
      assert.deepEqual(s, sample(t, input)); assert.ok(s.phase >= 0 && s.phase < 1); finite(s);
      near(s.driveAngle, s.phase * Math.PI * 2, 1e-12);
      s.spine.forEach((link, j) => {
        near(distance(link.start, link.end), D.length); near(Math.hypot(...link.q), 1);
        vectorNear(link.end, point(link.start, link.q, [0, D.length, 0]));
        if (j) vectorNear(link.start, s.spine[j - 1].end);
        vectorNear(link.end, p.spine[j].end);
        if (j > 1) assert.ok(link.end[1] > link.start[1], 'Raised chain must not fold back into itself');
      });
      vectorNear(s.spine[0].start, D.base);
      s.hood.forEach((h, j) => {
        near(distance(h.start, h.end), HOOD_LENGTHS[h.station]); vectorNear(h.start, point(s.spine[h.frame].start, s.spine[h.frame].q, h.local)); vectorNear(h.end, p.hood[j].end);
      });
      near(distance(s.jaw.start, s.jaw.end), D.jaw); vectorNear(s.jaw.end, p.jaw.end);
      for (let j = 0; j < 3; j++) assert.equal(typeof Object.values(s.metrics)[j], 'number');
    }
  }
  const a = sample(.43), b = sample(.43, { cadence: .4, spread: .72 }), c = sample(.43, { cadence: .16, spread: 0 });
  assert.notDeepEqual(a.spine.at(-1).end, b.spine.at(-1).end); assert.notDeepEqual(a.hood[8].end, c.hood[8].end);
  assert.notDeepEqual(sample(0).jaw.end, sample(1).jaw.end); assert.notDeepEqual(sample(0).tongue.tips, sample(.7).tongue.tips);
  for (const t of [NaN, Infinity, -Infinity, 1e100, -1e100]) finite(sample(t, { cadence: NaN, spread: Infinity }));
  finite(sample(-123, null)); near(cycleHz({ cadence: 99 }), .4); near(cycleHz({ cadence: -1 }), .06);
});

test('cobra rendered endpoints, rigid instance transforms, floor and real vertex bounds', t => {
  const model = createModel(), dimensions = entries(model).map(e => [0, 1, 2].map(i => new THREE.Vector3().setFromMatrixColumn(e.matrix, i).length()));
  const swept = new THREE.Box3();
  try {
    for (const spread of [0, 1]) for (let i = 0; i < 24; i++) {
      const s = freeze(sample(i / (24 * .16), { spread, cadence: .16 })), serialized = JSON.stringify(s);
      model.update(s);
      s.spine.forEach((link, j) => {
        const n = node(model, `spine.${j}.frame`); vectorNear(worldPoint(n, [0, 0, 0]), link.start); vectorNear(worldPoint(n, [0, D.length, 0]), link.end);
      });
      s.hood.forEach(h => { const n = node(model, `hood.${h.id}.rib`); vectorNear(worldPoint(n, [0, 0, 0]), h.start); vectorNear(worldPoint(n, [0, h.length, 0]), h.end); });
      vectorNear(worldPoint(node(model, 'head.jaw'), [0, 0, -D.jaw]), s.jaw.end);
      for (const side of [-1, 1]) vectorNear(worldPoint(node(model, 'head.tongue'), [side * .019, 0, -.105]), s.tongue.tips[side < 0 ? 0 : 1]);
      const all = entries(model), box = bounds(all); swept.union(box);
      all.forEach((e, j) => vectorNear([0, 1, 2].map(k => new THREE.Vector3().setFromMatrixColumn(e.matrix, k).length()), dimensions[j], 1e-6));
      assert.ok(box.min.y >= -1e-7, `Floor: ${box.min.y}`); assert.ok(box.max.y > 1.95 && box.max.y < 2.5, `Height: ${box.max.y}`);
      assert.ok(box.max.x - box.min.x < 1.6); assert.ok(box.max.z - box.min.z < 1.5);
      for (const h of s.hood) {
        const rails = all.filter(e => e.id === `cobra.hood.${h.id}.rib` && e.mesh.geometry.type === 'CylinderGeometry' && Math.abs(new THREE.Vector3().setFromMatrixColumn(e.matrix, 1).length() - (h.length - .039)) < 1e-6);
        assert.equal(rails.length, 2);
        rails.forEach((e, k) => { const r = capsule(e); vectorNear(r.a.toArray(), point(h.start, h.q, [k ? .012 : -.012, .026, 0]), 1e-6); vectorNear(r.b.toArray(), point(h.start, h.q, [k ? .012 : -.012, h.length - .013, 0]), 1e-6); });
      }
      assert.equal(JSON.stringify(s), serialized); assert.deepEqual(model.group.position.toArray(), [0, 0, 0]); assert.deepEqual(model.group.quaternion.toArray(), [0, 0, 0, 1]);
      model.group.traverse(n => assert.deepEqual(n.scale.toArray(), [1, 1, 1]));
    }
    t.diagnostic(`balanced ${JSON.stringify(model.stats)}; swept XYZ ${swept.getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(3)).join(' × ')} m`);
  } finally { model.dispose(); }
});

test('cobra swept actual hood-rail capsule clearance and overlapping negative control', t => {
  const model = createModel(); let minimum = Infinity;
  try {
    for (const spread of [0, .5, 1]) for (let i = 0; i < 72; i++) {
      const s = sample(i / (72 * .16), { spread }); model.update(s);
      const all = entries(model), rails = s.hood.flatMap(h => all.filter(e => e.id === `cobra.hood.${h.id}.rib` && e.mesh.geometry.type === 'CylinderGeometry' && Math.abs(new THREE.Vector3().setFromMatrixColumn(e.matrix, 1).length() - (h.length - .039)) < 1e-6).map(capsule));
      assert.equal(rails.length, 32);
      const spineEnvelopes = s.spine.map((_, j) => envelope(all.filter(e => e.id.startsWith(`cobra.spine.${j}.`)), node(model, `spine.${j}.frame`)));
      for (let a = 0; a < spineEnvelopes.length; a++) for (let b = a + 2; b < spineEnvelopes.length; b++) clearEnvelopes(spineEnvelopes[a], spineEnvelopes[b]);
      const envelopes = s.hood.map(h => envelope(all.filter(e => e.id.startsWith(`cobra.hood.${h.id}.`)), node(model, `hood.${h.id}.rib`)));
      for (let a = 0; a < envelopes.length; a++) for (let b = a + 1; b < envelopes.length; b++) clearEnvelopes(envelopes[a], envelopes[b]);
      assert.throws(() => clearEnvelopes(envelopes[0], { ...envelopes[1], center: envelopes[0].center.clone() }), /envelopes overlap/);
      for (let a = 0; a < rails.length; a++) for (let b = a + 1; b < rails.length; b++) if (rails[a].id !== rails[b].id) {
        clearCapsules(rails[a], rails[b]); minimum = Math.min(minimum, segmentDistance(rails[a], rails[b]) - rails[a].radius - rails[b].radius);
      }
      const shifted = { ...rails[1], a: rails[0].a.clone(), b: rails[0].b.clone() };
      assert.throws(() => clearCapsules(rails[0], shifted), /Rail collision/);
    }
    t.diagnostic(`Minimum swept hood rail gap ${(minimum * 1000).toFixed(2)} mm`);
  } finally { model.dispose(); }
});

test('cobra measured budgets, low selection, modes, exact explode reversal and single disposal', t => {
  const model = createModel(), s = freeze(sample(.73));
  try {
    const names = new Set(), ids = new Set();
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
      for (const mesh of model.pickables) {
        assert.equal(mesh.material.clippingPlanes?.length ?? 0, mode === 'cutaway' ? 1 : 0);
        if (mesh.material.color.getHex() === 0xced5cf) near(mesh.material.opacity, mode === 'xray' ? .13 : 1);
      }
      for (const id of ids) {
        model.update(s, { mode, quality: 'low', selectedId: id });
        let colored = 0;
        for (const mesh of model.pickables) for (let i = 0; i < mesh.count; i++) {
          const color = new THREE.Color(); mesh.getColorAt(i, color);
          if (mesh.userData.instanceParts[i] === id) { vectorNear(color.toArray(), new THREE.Color(0x9ceacb).toArray(), 1e-6); colored++; }
          else vectorNear(color.toArray(), [1, 1, 1], 1e-6);
        }
        assert.ok(colored > 0);
      }
    }
    for (let i = 0; i < 20; i++) { model.update(sample(i * .17), { explode: (i % 3) / 2 }); model.update(s, { explode: 0 }); assert.deepEqual(matrices(model), original); }
    model.update(s, { explode: 1 }); assert.notDeepEqual(matrices(model), original); model.update(s); assert.deepEqual(matrices(model), original);
    const resources = new Set(model.pickables.flatMap(m => [m, m.geometry, m.material])), disposed = new Map();
    for (const r of resources) r.addEventListener('dispose', () => disposed.set(r, (disposed.get(r) || 0) + 1));
    model.dispose(); model.dispose(); model.update(s); assert.equal(model.group.children.length, 0); assert.deepEqual(model.pickables, []);
    for (const r of resources) assert.equal(disposed.get(r), 1);
  } finally { model.dispose(); }
});
