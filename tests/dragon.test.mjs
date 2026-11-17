import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { descriptor } from '../src/mechanisms/dragon/index.js';
import { createModel } from '../src/mechanisms/dragon/model.js';
import { sample, D, TAU, distance, solveLimb, dot, sub } from '../src/mechanisms/dragon/kin.js';

const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const corners = [.025, .12].flatMap(tempo => [0, 1].flatMap(ferocity => [.84, .98].map(height => ({ tempo, ferocity, height }))));
const withModel = fn => { const m = createModel(); try { return fn(m); } finally { m.dispose(); } };
function numbers(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(numbers);
  else if (value && typeof value === 'object') Object.values(value).forEach(numbers);
}
const point = (m, id, local) => new THREE.Vector3(...local).applyMatrix4(m.group.getObjectByName(`dragon.${id}`).matrixWorld).toArray();

test('dragon descriptor is complete and catalogue imports stay free of rendering code', async () => {
  assert.equal(descriptor.id, 'dragon'); assert.equal(descriptor.collection, '020'); assert.equal(descriptor.lessons.length, 5);
  for (const file of ['index.js', 'kin.js']) assert.ok(!/from\s+['"]three|model/.test(readFileSync(new URL(`../src/mechanisms/dragon/${file}`, import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('import')).join('\n')));
  assert.deepEqual(descriptor.sample(0), sample(0));
  const m = await descriptor.createModel(); assert.ok(m.framePoints.length > 100); m.dispose();
});

test('sampling is deterministic, periodic and finite, and visits all six acts', () => {
  const acts = new Set();
  for (const input of [...corners, descriptor.defaultInputs]) for (const t of [-41.3, .123, 7.77, 913.5]) {
    const a = sample(t, input); numbers(a); assert.deepEqual(sample(t, input), a);
    const b = sample(t + 1 / input.tempo, input); near(a.phase, b.phase, 1e-9); near(a.metrics.bodyPitchDeg, b.metrics.bodyPitchDeg, 1e-6);
  }
  for (let n = 0; n < 400; n++) acts.add(sample(n / (400 * .05)).act);
  assert.deepEqual([...acts].sort(), ['COIL', 'DESCEND', 'DISPLAY', 'PROWL', 'RISE', 'STRIKE']);
  for (const v of [NaN, Infinity, undefined, null]) numbers(sample(v, { tempo: v, ferocity: v, height: v }));
  assert.throws(() => solveLimb([0, 0, 0], [9, 0, 0], .5, .5, [0, 1, 0]), RangeError);
});

test('every chain, limb, wing and ram keeps rigid lengths and stays above the floor', () => {
  for (const input of corners) for (let n = 0; n < 240; n++) {
    const s = sample(n / (240 * input.tempo), input);
    for (const [chain, lengths] of [[s.torso, D.torso], [s.neck, D.neck], [s.tail, D.tail]]) chain.forEach((g, i) => { near(distance(g.start, g.end), lengths[i]); if (i) near(distance(chain[i - 1].end, g.start), 0); });
    assert.ok(s.tail.every(g => g.end[1] > .25), 'tail clears the floor');
    for (const l of s.legs) {
      const L = l.hind ? D.hind : D.fore;
      near(distance(l.root, l.knee), L.upper); near(distance(l.knee, l.ankle), L.lower); near(distance(l.ankle, l.foot), L.meta);
      assert.ok(l.reach > Math.abs(L.upper - L.lower) + .1 && l.reach < L.upper + L.lower - .1);
      if (l.stance) near(l.foot[1], D.sole); else assert.ok(l.foot[1] >= D.sole - 1e-12);
      assert.ok(dot(sub(l.toes[1][0].end, l.foot), sub(l.foot, l.ankle)) > 0 || !l.stance, 'toes point away from the heel');
      for (const r of [l.actuator, l.kneeActuator]) assert.ok(r.length > .15 && r.length < .8);
    }
    assert.ok(s.metrics.supportFeet >= 2);
    for (const w of s.wings) {
      near(distance(w.root, w.elbow), D.wing.humerus); near(distance(w.elbow, w.wrist), D.wing.forearm);
      w.tips.forEach((t, j) => near(distance(w.wrist, t), D.wing.spars[j]));
      for (const p of w.panels) for (const sl of p) assert.ok(sl.length > 1e-3);
      for (const r of [w.actuator, w.elbowActuator]) assert.ok(r.length > .13);
      assert.ok(w.tips.every(t => t[1] > .3));
    }
  }
  near(sample(0).acts.deploy, 1); assert.ok(sample(0).metrics.wingSpanM > 3.5);
  assert.ok(Math.max(...Array.from({ length: 400 }, (_, n) => sample(n / 20).metrics.wingSpanM)) > 4.5);
});

test('rendered nodes follow the solved points, all geometry is instanced and inside budgets', () => withModel(m => {
  const ids = new Set(m.parts.map(p => p.id)); assert.equal(ids.size, m.parts.length); assert.ok(ids.size >= 150);
  for (const input of [descriptor.defaultInputs, corners[7]]) for (let n = 0; n < 24; n++) {
    const s = sample(n / (24 * input.tempo), input); m.update(s);
    s.legs.forEach(l => { near(distance(point(m, `leg.${l.id}.upper`, [0, (l.hind ? D.hind : D.fore).upper, 0]), l.knee), 0, 1e-6); near(distance(point(m, `leg.${l.id}.meta`, [0, (l.hind ? D.hind : D.fore).meta, 0]), l.foot), 0, 1e-6); });
    s.neck.forEach((g, i) => near(distance(point(m, `neck.c${i + 1}`, [0, g.length, 0]), g.end), 0, 1e-6));
    s.wings.forEach(w => near(distance(point(m, `wing.${w.side < 0 ? 'L' : 'R'}.forearm`, [0, D.wing.forearm, 0]), w.wrist), 0, 1e-6));
  }
  const used = new Set();
  for (const q of ['high', 'balanced', 'low']) {
    m.update(sample(3.3), { quality: q }); assert.ok(m.stats.triangles <= 200000 && m.stats.drawCalls <= 40);
    for (const b of m.pickables) for (let i = 0; i < b.count; i++) used.add(b.userData.instanceParts[i]);
  }
  assert.equal(used.size, ids.size);
  const box = new THREE.Box3(), mat = new THREE.Matrix4(), v = new THREE.Vector3();
  for (let n = 0; n < 16; n++) {
    m.update(sample(n / (16 * .05))); box.makeEmpty();
    for (const mesh of m.pickables) { const p = mesh.geometry.attributes.position; for (let j = 0; j < mesh.count; j++) { mesh.getMatrixAt(j, mat); assert.ok(mat.determinant() > 0); for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); } }
    assert.ok(box.min.y >= 0, `floor ${box.min.y}`); assert.ok(box.max.y < 4 && Math.max(box.max.x - box.min.x, box.max.z - box.min.z) < 6);
  }
}));

test('explosion reverses exactly and disposal frees resources once', () => {
  const m = createModel(), s = sample(5.1); m.update(s);
  const snap = () => m.pickables.map(b => Array.from(b.instanceMatrix.array.slice(0, b.count * 16)));
  const original = snap(); m.update(s, { explode: 1, mode: 'xray', quality: 'low' }); assert.notDeepEqual(snap(), original);
  m.update(s, { explode: 0, mode: 'solid', quality: 'balanced' }); assert.deepEqual(snap(), original);
  const res = new Set(m.pickables.flatMap(b => [b.geometry, b.material])), calls = new Map();
  for (const r of res) r.addEventListener('dispose', () => calls.set(r, (calls.get(r) || 0) + 1));
  m.dispose(); m.dispose(); m.update(sample(1)); assert.equal(m.pickables.length, 0);
  for (const r of res) assert.equal(calls.get(r), 1);
});
