import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { descriptor } from '../src/mechanisms/mantis/index.js';
import { createModel } from '../src/mechanisms/mantis/model.js';
import { sample, DIM, TAU, distance, solveKnee, circleIntersection } from '../src/mechanisms/mantis/kin.js';

const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const extremes = [.1, .6].flatMap(cadence => [0, 1].map(reach => ({ cadence, reach })));
function numbers(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(numbers);
  else if (value && typeof value === 'object') Object.values(value).forEach(numbers);
}
function compare(a, b, key = '') {
  if (key === 't') return;
  if (typeof a === 'number') near(a, b, 3e-8);
  else if (a && typeof a === 'object') for (const k of Object.keys(a)) compare(a[k], b[k], k);
  else assert.equal(a, b);
}
const withModel = fn => { const m = createModel(); try { return fn(m); } finally { m.dispose(); } };
function snapshot(m) { return m.pickables.map(b => [b.count, ...b.instanceMatrix.array.slice(0, b.count * 16)]); }
function bounds(m) {
  const b = new THREE.Box3(), mat = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const mesh of m.pickables) {
    const p = mesh.geometry.attributes.position;
    for (let j = 0; j < mesh.count; j++) {
      mesh.getMatrixAt(j, mat);
      for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat));
    }
  }
  return b;
}
function nodePoint(m, id, local) { return new THREE.Vector3(...local).applyMatrix4(m.group.getObjectByName(`mantis.${id}`).matrixWorld).toArray(); }

test('mantis descriptor is complete and catalogue imports do not load rendering', async () => {
  assert.equal(descriptor.id, 'mantis'); assert.equal(descriptor.title, 'MANTIS M6'); assert.equal(descriptor.collection, '007');
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  assert.ok(descriptor.description.includes('conceptual'));
  for (const c of descriptor.controls) { assert.ok(c.min < c.max && c.step > 0); assert.ok(c.key in descriptor.defaultInputs); }
  for (const l of descriptor.lessons) {
    for (const k of ['title', 'short', 'text', 'fact']) assert.ok(l[k].length > 8);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  for (const file of ['index.js', 'kin.js']) {
    const text = readFileSync(new URL(`../src/mechanisms/mantis/${file}`, import.meta.url), 'utf8');
    assert.ok(!/from\s+['"]three|from\s+['"].*model/.test(text));
  }
  assert.deepEqual(descriptor.sample(0), sample(0)); near(descriptor.cycleHz(descriptor.defaultInputs), .24);
  const m = await descriptor.createModel(); assert.ok(m.group.isGroup && m.pickables.length > 0); m.dispose();
});

test('mantis sampling is deterministic, periodic, reversible and finite at every input corner', () => {
  for (const input of [...extremes, descriptor.defaultInputs]) for (const t of [-37.217, -.881, .123, 3.437, 7319.19]) {
    const saved = { ...input }, a = sample(t, input);
    sample(-4627, { cadence: .6, reach: 1 }); assert.deepEqual(sample(t, input), a); assert.deepEqual(input, saved);
    compare(a, sample(t + 1 / input.cadence, input)); numbers(a);
    assert.ok(a.phase >= 0 && a.phase < 1); near(a.driveAngle, a.phase * TAU);
  }
  for (const v of [NaN, Infinity, -Infinity, undefined, null]) numbers(sample(v, { cadence: v, reach: v }));
  for (const v of [-99, 99]) numbers(sample(1, { cadence: v, reach: v }));
  assert.throws(() => solveKnee([0, 0, 0], [5, 0, 0]), RangeError);
  assert.throws(() => circleIntersection([0, 0], .1, [0, 0], .1), RangeError);
  assert.throws(() => circleIntersection([0, 0], .1, [1, 0], .1), RangeError);
});

test('four support legs maintain rigid reach, phased support and positive actuator strokes', () => {
  for (const input of extremes) for (let n = 0; n < 720; n++) {
    const s = sample(n / (720 * input.cadence), input); assert.equal(s.legs.length, 4); assert.equal(new Set(s.legs.map(l => l.id)).size, 4);
    for (const l of s.legs) {
      near(distance(l.hip, l.coxa), DIM.coxa); near(distance(l.coxa, l.knee), DIM.femur); near(distance(l.knee, l.foot), DIM.tibia);
      const reach = distance(l.coxa, l.foot); assert.ok(reach > Math.abs(DIM.femur - DIM.tibia) + .03 && reach < DIM.femur + DIM.tibia - .03);
      assert.ok(l.foot[1] >= DIM.sole - 1e-12 && l.foot[1] <= DIM.sole + .09 + 1e-12); if (l.stance) near(l.foot[1], DIM.sole);
      near(l.actuatorLength, distance(l.actuatorA, l.actuatorB)); assert.ok(l.actuatorLength > .15 && l.actuatorLength < .70);
    }
    assert.ok(s.metrics.supportPads >= 2); assert.equal(s.metrics.supportPads, s.legs.filter(l => l.stance).length);
    for (let i = 0; i < 2; i++) near(Math.abs(s.legs[i].phase - s.legs[i + 2].phase), .5);
  }
});

test('both raptorial four-bars close exactly on one non-singular branch at all control extrema', () => {
  for (const input of extremes) for (let n = 0; n < 1440; n++) {
    const s = sample(n / (1440 * input.cadence), input); assert.equal(s.arms.length, 2);
    for (const a of s.arms) {
      near(distance(a.shoulder, a.elbow), DIM.shoulder); near(distance(a.elbow, a.wrist), DIM.arm); near(distance(a.wrist, a.tip), DIM.grasper);
      assert.ok(a.opening >= .28 - 1e-12 && a.opening <= 1.08 + 1e-12);
      const c = a.closure;
      near(distance(c.D, c.A), DIM.crank); near(distance(c.A, c.B), DIM.coupler); near(distance(c.B, c.W), DIM.rocker); near(distance(c.D, c.W), Math.hypot(.18, .052));
      const reach = distance(c.D, c.B); assert.ok(reach > Math.abs(DIM.crank - DIM.coupler) + .02 && reach < DIM.crank + DIM.coupler - .02);
      const { D, A, B } = c.local;
      const cross = (B[0] - D[0]) * (A[1] - D[1]) - (B[1] - D[1]) * (A[0] - D[0]); assert.ok(cross > .001, `branch / toggle margin ${cross}`);
      near(c.B[0], a.wrist[0] + a.side * DIM.closureOffset);
      for (let j = 1; j < 3; j++) near(c.B[j], a.wrist[j] + (a.tip[j] - a.wrist[j]) * DIM.rocker / DIM.grasper);
      near(a.actuatorLength, distance(a.actuatorA, a.actuatorB)); assert.ok(a.actuatorLength > .115);
    }
    near(s.arms[0].opening, s.arms[1].opening); near(s.metrics.graspAperture, s.arms[0].opening); near(s.metrics.couplerLength, DIM.coupler);
    near(s.metrics.headYaw, s.head.yaw); near(s.metrics.crankRpm, input.cadence * 60); near(s.metrics.cycleSeconds, 1 / input.cadence);
    for (const v of Object.values(s.metrics)) assert.ok(typeof v === 'number' && Number.isFinite(v));
    assert.ok(Math.abs(s.head.yaw) <= .24 + 1e-12); assert.ok(s.wings.every(w => Math.abs(w.angle) >= .625 - 1e-12));
  }
});

test('all mantis geometry is instanced and every selectable assembly has meaningful unique metadata', () => withModel(m => {
  const ids = new Set(m.parts.map(p => p.id)), used = new Set(); assert.equal(ids.size, m.parts.length); assert.ok(ids.size >= 55);
  for (const p of m.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material']) assert.ok(typeof p[key] === 'string' && p[key].length > 7, `${p.id}: ${key}`);
  m.group.traverse(n => { if (n.isMesh) assert.ok(n.isInstancedMesh && m.pickables.includes(n)); else assert.ok(n.isGroup); });
  for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) { const id = mesh.userData.instanceParts[i]; assert.ok(ids.has(id)); used.add(id); }
  assert.equal(used.size, ids.size); assert.equal(m.stats.selectableParts, ids.size);
}));

test('actual generated mantis triangles, instances and batch draws stay inside the Android-oriented budgets', () => withModel(m => {
  let balanced, low;
  for (const quality of ['balanced', 'low', 'high']) for (const mode of ['solid', 'xray', 'cutaway']) {
    m.update(sample(.39), { quality, mode }); let instances = 0, triangles = 0, batches = 0; const used = new Set();
    for (const b of m.pickables) {
      instances += b.count; triangles += b.count * (b.geometry.index?.count ?? b.geometry.attributes.position.count) / 3; if (b.count) batches++;
      for (let i = 0; i < b.count; i++) used.add(b.userData.instanceParts[i]);
    }
    assert.deepEqual(m.stats, { instances, triangles, drawCalls: batches, selectableParts: m.parts.length });
    assert.ok(triangles <= 110000); assert.ok(batches <= 48); assert.equal(used.size, m.parts.length);
    if (quality !== 'low') { assert.ok(instances >= 900 && instances <= 2000, `${instances} instances`); balanced = instances; } else low = instances;
  }
  assert.ok(low < balanced * .85);
}));

test('mantis full-cycle finite matrices agree with the solved support and grasper endpoints', () => withModel(m => {
  const matrix = new THREE.Matrix4();
  for (const input of extremes) for (let n = 0; n < 96; n++) {
    const state = sample(n / (96 * input.cadence), input); m.update(state);
    for (const b of m.pickables) for (let i = 0; i < b.count; i++) { b.getMatrixAt(i, matrix); assert.ok(matrix.elements.every(Number.isFinite)); assert.ok(matrix.determinant() > 0); }
    state.legs.forEach(l => { near(distance(nodePoint(m, `leg.${l.id}.femur`, [0, DIM.femur, 0]), l.knee), 0); near(distance(nodePoint(m, `leg.${l.id}.tibia`, [0, DIM.tibia, 0]), l.foot), 0); });
    state.arms.forEach(a => {
      const id = `arm.${a.side < 0 ? 'L' : 'R'}`;
      near(distance(nodePoint(m, `${id}.femur`, [0, DIM.arm, 0]), a.wrist), 0); near(distance(nodePoint(m, `${id}.tibia`, [0, DIM.grasper, 0]), a.tip), 0);
      near(distance(nodePoint(m, `${id}.crank`, [0, DIM.crank, 0]), a.closure.A), 0); near(distance(nodePoint(m, `${id}.coupler`, [0, DIM.coupler, 0]), a.closure.B), 0); near(distance(nodePoint(m, `${id}.rocker`, [0, DIM.rocker, 0]), a.closure.B), 0);
    });
  }
}));

function checkMount(m, actuator, member, anchor, start, end, local, width, checkBracket) {
  const node = m.group.getObjectByName(`mantis.${member}`), inverse = node.matrixWorld.clone().invert();
  const actual = new THREE.Vector3(...anchor).applyMatrix4(inverse).toArray();
  actual.forEach((v, i) => near(v, local[i]));
  near(distance(anchor, start), Math.hypot(...local));
  near(distance(anchor, end), Math.hypot(local[0], local[1] - distance(start, end), local[2]));
  near(distance(nodePoint(m, `${actuator}.clevis`, [0, 0, 0]), anchor), 0);
  near(Math.abs(m.group.getObjectByName(`mantis.${actuator}.clevis`).quaternion.dot(node.quaternion)), 1);
  if (!checkBracket) return;
  const roots = [];
  for (const mesh of m.pickables) {
    if (mesh.geometry.type !== 'CylinderGeometry') continue;
    for (let i = 0; i < mesh.count; i++) {
      if (mesh.userData.instanceParts[i] !== node.name) continue;
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix); matrix.premultiply(inverse);
      const a = new THREE.Vector3(0, -.5, 0).applyMatrix4(matrix).toArray();
      const b = new THREE.Vector3(0, .5, 0).applyMatrix4(matrix).toArray();
      if (distance(b, local) < 2e-7) roots.push(a);
    }
  }
  assert.equal(roots.length, 2, `${member}: two permanent bracket struts must reach the pin`);
  roots.sort((a, b) => a[0] - b[0]);
  roots.forEach((root, i) => near(distance(root, [(i ? 1 : -1) * width, local[1], 0]), 0, 2e-7));
}

test('mantis actuator mounts and visible brackets are fixed in the rendered femur and shoulder-link frames', () => withModel(m => {
  for (const quality of ['balanced', 'low']) for (const input of [...extremes, descriptor.defaultInputs]) for (let n = 0; n < 96; n++) {
    const s = sample(n / (96 * input.cadence), input); m.update(s, { quality });
    for (const l of s.legs) checkMount(m, `leg.${l.id}.lift`, `leg.${l.id}.femur`, l.actuatorB, l.coxa, l.knee, [0, DIM.femur - .025, .063], .023, n === 0);
    for (const a of s.arms) {
      const id = `arm.${a.side < 0 ? 'L' : 'R'}`;
      checkMount(m, `${id}.position`, `${id}.shoulder`, a.actuatorB, a.shoulder, a.elbow, [a.side * .045, DIM.shoulder - .035, .06], .03, n === 0);
    }
  }
}));

test('staggered tooth rows clear the returning cage and the closure rods stay outboard', () => withModel(m => {
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (const input of extremes) for (let phase = 0; phase < 12; phase++) {
    const s = sample(phase / (12 * input.cadence), input); m.update(s);
    for (const arm of s.arms) {
      const id = `mantis.arm.${arm.side < 0 ? 'L' : 'R'}`;
      let combInner = Infinity, returnOuter = 0, linkageInner = Infinity;
      for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) {
        const part = mesh.userData.instanceParts[i];
        const comb = part === `${id}.fixed-teeth`, returning = [`${id}.tibia`, `${id}.moving-teeth`, `${id}.hook`].includes(part);
        const closure = [`${id}.crank`, `${id}.coupler`, `${id}.rocker`].includes(part);
        if (!comb && !returning && !closure) continue;
        mesh.getMatrixAt(i, matrix); const positions = mesh.geometry.attributes.position;
        for (let j = 0; j < positions.count; j++) {
          point.fromBufferAttribute(positions, j).applyMatrix4(matrix); const x = Math.abs(point.x - arm.elbow[0]);
          if (comb) combInner = Math.min(combInner, x); if (returning) returnOuter = Math.max(returnOuter, x); if (closure) linkageInner = Math.min(linkageInner, x);
        }
      }
      assert.ok(combInner - returnOuter > .002, `tooth/cage separation ${combInner - returnOuter}`);
      assert.ok(linkageInner > .089, `closure layer ${linkageInner}`);
    }
  }
}));

test('mantis actual vertices respect the floor, maximum height and centred compact footprint', () => withModel(m => {
  for (const input of extremes) for (let i = 0; i < 12; i++) {
    m.update(sample(i / (12 * input.cadence), input)); const b = bounds(m), size = b.getSize(new THREE.Vector3());
    assert.ok(b.min.y >= -1e-7, `ground ${b.min.y}`); assert.ok(b.max.y <= 2.2, `height ${b.max.y}`);
    assert.ok(Math.max(size.x, size.z) <= 3.05, `footprint ${size.toArray()}`); assert.ok(Math.abs((b.min.x + b.max.x) / 2) < .15); assert.ok(Math.abs((b.min.z + b.max.z) / 2) < .25);
  }
}));

test('mantis explosion reverses exactly and display modes, selection and quality fully reset', () => withModel(m => {
  const state = sample(1.79), copy = structuredClone(state); m.update(state); const original = snapshot(m);
  const resources = m.pickables.map(b => [b, b.geometry, b.material, b.instanceMatrix.array]);
  for (const explode of [1, .23, .87]) {
    m.update(state, { explode, mode: 'xray', quality: 'low', selectedId: m.parts[0].id }); assert.notDeepEqual(snapshot(m), original);
    for (const b of m.pickables) { const shell = b.material.color.getHex() === 0xced5cf; assert.equal(b.material.transparent, shell); near(b.material.opacity, shell ? .13 : 1); assert.equal(b.material.depthWrite, !shell); }
    m.update(state, { explode: .3, mode: 'cutaway' }); for (const b of m.pickables) { assert.equal(b.material.clippingPlanes.length, 1); assert.equal(b.material.transparent, false); assert.equal(b.material.side, THREE.DoubleSide); }
    m.update(state, { explode: 0, mode: 'solid', quality: 'balanced' }); assert.deepEqual(snapshot(m), original);
    for (const b of m.pickables) { assert.equal(b.material.clippingPlanes.length, 0); assert.equal(b.material.opacity, 1); assert.ok(b.material.depthWrite); assert.equal(b.material.side, THREE.FrontSide); }
  }
  m.update(state, { selectedId: m.parts[0].id }); const c = new THREE.Color(); let selected = 0;
  for (const b of m.pickables) for (let i = 0; i < b.count; i++) { b.getColorAt(i, c); if (b.userData.instanceParts[i] === m.parts[0].id) { assert.notEqual(c.getHex(), 0xffffff); selected++; } else assert.equal(c.getHex(), 0xffffff); }
  assert.ok(selected > 0); m.update(); assert.deepEqual(snapshot(m), original); assert.deepEqual(state, copy);
  resources.forEach(([mesh, geometry, material, array], i) => { assert.equal(m.pickables[i], mesh); assert.equal(mesh.geometry, geometry); assert.equal(mesh.material, material); assert.equal(mesh.instanceMatrix.array, array); });
}));

test('mantis disposal frees instanced resources exactly once', () => {
  const m = createModel(), resources = new Set(m.pickables.flatMap(b => [b, b.geometry, b.material])), calls = new Map();
  for (const r of resources) r.addEventListener('dispose', () => calls.set(r, (calls.get(r) || 0) + 1));
  m.dispose(); m.dispose(); m.update(sample(4)); assert.equal(m.pickables.length, 0); assert.equal(m.group.children.length, 0);
  for (const r of resources) assert.equal(calls.get(r), 1);
});
