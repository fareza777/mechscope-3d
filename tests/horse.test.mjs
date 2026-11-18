import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/horse/index.js';
import { createModel } from '../src/mechanisms/horse/model.js';
import { sample, D, TAU, distance, solveLimb, add, sub, mul } from '../src/mechanisms/horse/kin.js';

const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const corners = [.025, .10].flatMap(tempo => [.7, 1.3].flatMap(stride => [0, 1].map(head => ({ tempo, stride, head }))));
const withModel = fn => { const m = createModel(); try { return fn(m); } finally { m.dispose(); } };
function finite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(finite);
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
}
const point = (m, id, local) => new THREE.Vector3(...local).applyMatrix4(m.group.getObjectByName(`horse.${id}`).matrixWorld).toArray();
function instanced(m, predicate = () => true) {
  const result = [];
  for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) {
    const id = mesh.userData.instanceParts[i]; if (!predicate(id)) continue;
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    result.push({ id, matrix, geometry: mesh.geometry, color: mesh.material.color.getHex(), type: mesh.geometry.type });
  }
  return result;
}
function extent(items) {
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4();
  for (const p of items) {
    p.geometry.computeBoundingBox(); const g = p.geometry.boundingBox;
    for (const x of [g.min.x, g.max.x]) for (const y of [g.min.y, g.max.y]) for (const z of [g.min.z, g.max.z]) box.expandByPoint(v.set(x, y, z).applyMatrix4(p.matrix));
  }
  return box;
}

test('EQUUS descriptor is a complete lazy contract with three live controls and five lessons', async () => {
  assert.equal(descriptor.id, 'horse'); assert.equal(descriptor.title, 'EQUUS H8'); assert.equal(descriptor.collection, '030');
  assert.equal(descriptor.controls.length, 3); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const c of descriptor.controls) { assert.ok(c.key in descriptor.defaultInputs); assert.ok(c.min < c.max && c.step > 0); assert.ok(Number.isInteger(c.precision)); }
  for (const s of descriptor.specs) assert.ok(s.label.length <= 12);
  for (const l of descriptor.lessons) { assert.ok(l.text.length >= 180 && l.fact.length >= 35 && l.short.length > 4); assert.ok(['home', 'side', 'top', 'front', 'detail', 'exploded'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); }
  assert.deepEqual(descriptor.sample(.3), sample(.3));
  const m = await descriptor.createModel(); assert.ok(m.group.isGroup && m.framePoints.length > 100); m.dispose();
});

test('sampling is pure, periodic, finite, visits all six movements and respects both secondary controls', () => {
  const acts = new Set();
  for (const input of corners) for (const t of [-61.3, .123, 7.77, 913.5]) {
    const a = sample(t, input); finite(a); assert.deepEqual(sample(t, input), a);
    const b = sample(t + 1 / input.tempo, input); near(a.phase, b.phase, 1e-9);
    a.legs.forEach((l, i) => near(distance(l.foot, b.legs[i].foot), 0, 1e-7));
  }
  for (let n = 0; n < 480; n++) acts.add(sample(n / (480 * .05)).act);
  assert.deepEqual([...acts].sort(), ['EXTEND', 'HALT', 'REAR', 'SETTLE', 'TROT', 'WALK']);
  for (const v of [NaN, Infinity, undefined, null]) finite(sample(v, { tempo: v, stride: v, head: v }));
  assert.throws(() => solveLimb([0, 0, 0], [9, 0, 0], .5, .5, [0, 1, 0]), RangeError);
  const a = sample(.17, { stride: .7, head: 0 }), b = sample(.17, { stride: 1.3, head: 1 });
  assert.ok(a.metrics.strideM < b.metrics.strideM);
  assert.ok(a.metrics.headHeightM < b.metrics.headHeightM);
});

test('four rigid IK legs, two-hoof minimum support, hooves on the floor and a raised rear', () => {
  let minSupport = 9;
  for (const input of corners) for (let n = 0; n < 480; n++) {
    const s = sample(n / (480 * input.tempo), input);
    for (const l of s.legs) {
      const L = l.hind ? D.hind : D.fore;
      near(distance(l.root, l.knee), L.upper); near(distance(l.knee, l.ankle), L.lower); near(distance(l.ankle, l.fetlock), L.meta);
      near(distance(l.fetlock, l.foot), .11);
      if (l.stance) near(l.foot[1], D.sole); else assert.ok(l.foot[1] >= D.sole - 1e-12);
      assert.ok(l.reach > .29 && l.reach < L.upper + L.lower - .05);
    }
    for (const group of [s.torso, s.neck, s.tail]) group.forEach(g => assert.ok(g.end[1] > 0));
    minSupport = Math.min(minSupport, s.metrics.supportHooves);
    if (s.act === 'REAR') { assert.ok(s.legs.filter(l => !l.hind).every(l => !l.stance && l.foot[1] > .12)); assert.ok(s.metrics.bodyPitchDeg > 15); }
  }
  assert.ok(minSupport >= 2, `minimum support ${minSupport}`);
  const s = sample(0); assert.equal(s.metrics.supportHooves, 4);
});

test('rendered rigid ends agree with the solver; thick body and leg mass fit the budgets', () => withModel(m => {
  const ids = new Set(m.parts.map(p => p.id)); assert.equal(ids.size, m.parts.length); assert.ok(ids.size >= 100);
  for (const input of [descriptor.defaultInputs, corners[7]]) for (let n = 0; n < 16; n++) {
    const s = sample(n / (16 * input.tempo), input); m.update(s);
    s.legs.forEach(l => {
      const L = l.hind ? D.hind : D.fore;
      near(distance(point(m, `leg.${l.id}.upper`, [0, L.upper, 0]), l.knee), 0, 1e-6);
      near(distance(point(m, `leg.${l.id}.meta`, [0, L.meta, 0]), l.fetlock), 0, 1e-6);
    });
    s.neck.forEach((g, i) => near(distance(point(m, `neck.c${i + 1}`, [0, g.length, 0]), g.end), 0, 1e-6));
  }
  const used = new Set();
  for (const q of ['high', 'balanced', 'low']) {
    m.update(sample(3.3), { quality: q });
    assert.ok(m.stats.triangles <= 200000 && m.stats.drawCalls <= 40 && m.stats.instances <= 2400);
    for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) used.add(mesh.userData.instanceParts[i]);
  }
  assert.equal(used.size, ids.size);
  // Thickness gates: the barrel is a broad body, not a thin silhouette.
  const barrel = extent(instanced(m, id => id === 'horse.barrel'));
  const size = barrel.getSize(new THREE.Vector3());
  assert.ok(size.x > .6 && size.y > .6, `barrel ${size.toArray()}`);
  const upper = extent(instanced(m, id => id === 'horse.leg.FL.upper'));
  assert.ok(upper.getSize(new THREE.Vector3()).x > .24, 'leg armour is thick');
  const box = new THREE.Box3(), mat = new THREE.Matrix4(), v = new THREE.Vector3();
  for (let n = 0; n < 16; n++) {
    m.update(sample(n / (16 * .05))); box.makeEmpty();
    for (const mesh of m.pickables) { const p = mesh.geometry.attributes.position; for (let j = 0; j < mesh.count; j++) { mesh.getMatrixAt(j, mat); assert.ok(mat.determinant() > 0); for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); } }
    assert.ok(box.min.y >= -.001, `floor ${box.min.y}`); assert.ok(box.max.y < 3.6 && Math.max(box.max.x - box.min.x, box.max.z - box.min.z) < 4.2);
  }
}));

test('explosion reverses exactly without mutating the sample, and disposal releases resources once', () => {
  const m = createModel(), s = sample(5.1), frozen = structuredClone(s); m.update(s);
  const snap = () => m.pickables.map(b => Array.from(b.instanceMatrix.array.slice(0, b.count * 16)));
  const original = snap(); m.update(s, { explode: 1, mode: 'xray', quality: 'low' }); assert.notDeepEqual(snap(), original);
  m.update(s, { explode: 0, mode: 'solid', quality: 'balanced' }); assert.deepEqual(snap(), original); assert.deepEqual(s, frozen);
  const res = new Set(m.pickables.flatMap(b => [b.geometry, b.material])), calls = new Map();
  for (const r of res) r.addEventListener('dispose', () => calls.set(r, (calls.get(r) || 0) + 1));
  m.dispose(); m.dispose(); m.update(sample(1)); assert.equal(m.pickables.length, 0); assert.equal(m.group.children.length, 0);
  for (const r of res) assert.equal(calls.get(r), 1);
});
