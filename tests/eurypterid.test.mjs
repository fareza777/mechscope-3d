import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/eurypterid/index.js';
import { DEFAULT_INPUTS, D, LEGS, TAU, inputsOf, cycleHz, poseAt, sample, solveLeg, distance } from '../src/mechanisms/eurypterid/kin.js';

const prefix = 'eurypterid.';
const phases = [.0137, .0973, .2189, .3071, .4313, .5629, .6833, .7949, .9371];
const corners = [.025, .10].flatMap(tempo => [.65, 1.25].flatMap(stride => [0, 1].map(display => ({ tempo, stride, display }))));
const near = (a, b, eps = 1e-8, label = '') => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} != ${b} (tolerance ${eps})`);
const nearPoint = (a, b, label, eps = 2e-6) => near(distance(a, b), 0, eps, label);
function finite(value, path = 'sample') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${path} is not finite`);
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) finite(child, `${path}.${key}`);
}
function closeTree(a, b, path = 'pose', eps = 1e-7) {
  if (typeof a === 'number') near(a, b, eps, path);
  else if (a && typeof a === 'object') {
    assert.deepEqual(Object.keys(a), Object.keys(b), path);
    for (const key of Object.keys(a)) closeTree(a[key], b[key], `${path}.${key}`, eps);
  } else assert.equal(a, b, path);
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const withoutTime = ({ t, ...pose }) => pose;
const geometryOnly = ({ controls, metrics, ...pose }) => pose;
const world = (state, v) => state.origin.map((x, row) => x + v.reduce((sum, q, col) => sum + state.bodyFrame[row * 3 + col] * q, 0));

// A no-slip oracle must compare the same contact, not two adjacent stance steps.
function assertNoSlip(a, b) {
  let checked = 0;
  for (const leg of a.legs) {
    const next = b.legs.find(l => l.id === leg.id);
    if (leg.stance && next.stance && leg.step === next.step) {
      nearPoint(leg.foot, next.foot, `${leg.id} stance step ${leg.step} slips`, 1e-10);
      checked++;
    }
  }
  return checked;
}

function node(m, id) {
  const n = m.group.getObjectByName(prefix + id);
  assert.ok(n, `missing node ${id}`);
  assert.equal(n.userData.partId, prefix + id);
  return n;
}
const point = (matrix, local = [0, 0, 0]) => new THREE.Vector3(...local).applyMatrix4(matrix).toArray();
function instances(m) {
  const out = [];
  for (const mesh of m.pickables) {
    assert.ok(mesh.isInstancedMesh, 'the visible kit geometry must be instanced');
    for (let index = 0; index < mesh.count; index++) {
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
      matrix.premultiply(mesh.matrixWorld);
      out.push({ id: mesh.userData.instanceParts[index], mesh, index, matrix, geometry: mesh.geometry, color: mesh.material.color.getHex() });
    }
  }
  return out;
}
function primitive(items, id, type, color) {
  const found = items.filter(p => p.id === prefix + id && p.geometry.type === type && p.color === color);
  assert.equal(found.length, 1, `${id}: expected one ${type}/${color.toString(16)} anchor primitive`);
  return found[0].matrix;
}
function vertexBounds(items, reference = new THREE.Matrix4()) {
  assert.ok(items.length, 'bounds must contain real instances');
  const bounds = new THREE.Box3(), v = new THREE.Vector3(), matrix = new THREE.Matrix4();
  for (const item of items) {
    matrix.multiplyMatrices(reference, item.matrix);
    const positions = item.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) bounds.expandByPoint(v.fromBufferAttribute(positions, i).applyMatrix4(matrix));
  }
  return bounds;
}
function snapshot(m) {
  return m.pickables.map(mesh => ({
    ids: mesh.userData.instanceParts.slice(0, mesh.count),
    matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
    colors: Array.from(mesh.instanceColor.array.slice(0, mesh.count * 3)),
  }));
}
function expectedIds() {
  const ids = ['body', 'keel', 'brow', 'drive.shaft', 'drive.gyro', 'drive.gyro.inner', 'drive.gyro.rotor', 'telson'];
  for (let i = 1; i <= 3; i++) ids.push(`drive.gear${i}`);
  for (let i = 1; i <= 4; i++) ids.push(`pump.${i}`, `pump.${i}.plunger`);
  for (const side of ['L', 'R']) {
    ids.push(`shield.${side}`, `eye.${side}`, `eye.${side}.optic`);
    for (let i = 1; i <= 3; i++) ids.push(`mouth.${side}${i}`);
    for (let i = 1; i <= 5; i++) ids.push(`gill.${side}${i}`);
    for (const suffix of ['upper', 'upper-cover', 'fore', 'fore-cover', 'palm', 'jawA', 'jawB', 'jawA.gear', 'jawB.gear', 'ram.barrel', 'ram.rod', 'ram.eye']) ids.push(`claw.${side}.${suffix}`);
    for (const suffix of ['upper', 'upper-cover', 'lower', 'fan', 'lamella1', 'lamella2', 'lamella3', 'lamella4', 'lamella5']) ids.push(`paddle.${side}.${suffix}`);
  }
  for (const leg of LEGS) for (const suffix of ['coxa', 'upper', 'upper-cover', 'lower', 'lower-cover', 'pinion', 'foot', 'ram.barrel', 'ram.rod', 'ram.eye']) ids.push(`leg.${leg.id}.${suffix}`);
  for (let i = 1; i <= 12; i++) for (const suffix of ['', '.tergite', '.flangeL', '.flangeR', '.tendonL', '.tendonR']) ids.push(`tail.${i}${suffix}`);
  return ids.map(id => prefix + id).sort();
}

// Sibling limb nodes need their mechanical parent as the relative-motion reference.
function motionSpecs() {
  const specs = [];
  const angular = (id, parent, min) => specs.push({ id, parent, min, kind: 'angle' });
  for (const { id } of LEGS) {
    angular(`leg.${id}.coxa`, 'body', .12);
    angular(`leg.${id}.upper`, `leg.${id}.coxa`, .18);
    angular(`leg.${id}.lower`, `leg.${id}.upper`, .20);
  }
  for (const s of ['L', 'R']) {
    angular(`claw.${s}.upper`, 'body', .35);
    angular(`claw.${s}.fore`, `claw.${s}.upper`, .25);
    angular(`claw.${s}.palm`, `claw.${s}.fore`, .20);
    for (const jaw of ['A', 'B']) angular(`claw.${s}.jaw${jaw}`, `claw.${s}.palm`, .30);
    angular(`paddle.${s}.upper`, 'body', .15);
    angular(`paddle.${s}.lower`, `paddle.${s}.upper`, .15);
    angular(`paddle.${s}.fan`, `paddle.${s}.lower`, .70);
    for (const j of [1, 2, 4, 5]) angular(`paddle.${s}.lamella${j}`, `paddle.${s}.fan`, j === 1 || j === 5 ? .22 : .11);
    angular(`shield.${s}`, 'body', .20);
    angular(`eye.${s}`, 'body', .45);
    angular(`eye.${s}.optic`, `eye.${s}`, .18);
    for (let i = 1; i <= 5; i++) angular(`gill.${s}${i}`, 'body', .24);
    for (let i = 1; i <= 3; i++) angular(`mouth.${s}${i}`, 'body', .16);
  }
  for (let i = 1; i <= 12; i++) {
    angular(`tail.${i}`, i === 1 ? 'body' : `tail.${i - 1}`, .035 + .018 * (i - 1));
    for (const s of ['L', 'R']) angular(`tail.${i}.flange${s}`, `tail.${i}`, .16);
  }
  angular('telson', 'tail.12', .30);
  angular('drive.shaft', 'body', 2);
  for (let i = 1; i <= 3; i++) angular(`drive.gear${i}`, 'body', 2);
  angular('drive.gyro', 'body', 2);
  angular('drive.gyro.inner', 'drive.gyro', 2);
  angular('drive.gyro.rotor', 'drive.gyro.inner', 2);
  for (let i = 1; i <= 4; i++) specs.push({ id: `pump.${i}.plunger`, parent: `pump.${i}`, min: .12, kind: 'travel' });
  return specs;
}
// Calibrate once, then measure uploaded instances rather than empty animation groups.
function renderBindings(m) {
  const bindings = new Map();
  for (const item of instances(m)) if (!bindings.has(item.id)) {
    const n = node(m, item.id.slice(prefix.length));
    const local = n.matrixWorld.clone().invert().multiply(item.matrix);
    bindings.set(item.id, { mesh: item.mesh, index: item.index, localInverse: local.invert() });
  }
  return bindings;
}
function renderedFrames(bindings) {
  const frames = new Map();
  for (const [id, b] of bindings) {
    assert.equal(b.mesh.userData.instanceParts[b.index], id, 'instance identity changed');
    const matrix = new THREE.Matrix4(); b.mesh.getMatrixAt(b.index, matrix);
    frames.set(id.slice(prefix.length), matrix.premultiply(b.mesh.matrixWorld).multiply(b.localInverse));
  }
  return frames;
}
function relativeRange(frames, spec) {
  const poses = frames.map(frame => {
    assert.ok(frame.has(spec.id) && frame.has(spec.parent), `missing relative-motion pair ${spec.id}/${spec.parent}`);
    const relative = frame.get(spec.parent).clone().invert().multiply(frame.get(spec.id));
    const position = new THREE.Vector3(), rotation = new THREE.Quaternion(), scale = new THREE.Vector3();
    relative.decompose(position, rotation, scale); rotation.normalize();
    return { position, rotation };
  });
  let angle = 0, travel = 0;
  for (const a of poses) for (const b of poses) {
    angle = Math.max(angle, a.rotation.angleTo(b.rotation));
    travel = Math.max(travel, a.position.distanceTo(b.position));
  }
  return { angle, travel };
}
const motionFailures = (frames, specs) => specs.flatMap(spec => {
  const actual = relativeRange(frames, spec)[spec.kind];
  return actual >= spec.min ? [] : [`${spec.id} relative to ${spec.parent}: ${spec.kind} ${actual.toFixed(5)} < ${spec.min}`];
});

test('LEVIATHAN descriptor exposes the six-leg/twelve-link contract and exactly three controls', () => {
  assert.equal(descriptor.id, 'eurypterid');
  assert.deepEqual(descriptor.controls.map(({ key, min, max }) => [key, min, max]), [['tempo', .025, .10], ['stride', .65, 1.25], ['display', 0, 1]]);
  assert.deepEqual(descriptor.defaultInputs, DEFAULT_INPUTS);
  assert.equal(descriptor.sample, sample); assert.equal(descriptor.cycleHz, cycleHz);
  for (const c of descriptor.controls) assert.ok(c.step > 0 && Number.isInteger(c.precision) && c.key in DEFAULT_INPUTS);
  assert.deepEqual(LEGS.map(l => l.id), ['L1', 'L2', 'L3', 'R1', 'R2', 'R3']);
  assert.equal(LEGS.length, 6);
  assert.deepEqual([D.coxa, D.upper, D.lower, D.arm, D.forearm, D.palm], [.20, .64, .72, .62, .62, .34]);
  assert.deepEqual(D.tail, [.22, .22, .22, .22, .21, .21, .19, .18, .17, .16, .15, .14]);
});

test('samples are deterministic, finite and periodic, including boundary and invalid external scalars', () => {
  for (const input of [...corners, DEFAULT_INPUTS]) {
    freeze(input);
    for (const t of [-123.4567, -1 / input.tempo, 0, .137, 7.913, 1 / input.tempo, 913.537]) {
      const a = sample(t, input), b = sample(t + 1 / input.tempo, input);
      finite(a); assert.deepEqual(sample(t, input), a);
      closeTree(withoutTime(a), withoutTime(b));
    }
  }
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, '0.05', '', false, {}, [], 1n, Symbol('external')]) {
    assert.deepEqual(inputsOf({ tempo: bad, stride: bad, display: bad }), DEFAULT_INPUTS);
    assert.deepEqual(sample(bad, { tempo: bad, stride: bad, display: bad }), sample(0));
    assert.deepEqual(poseAt(bad), poseAt(0));
  }
  for (const badInput of [null, NaN, Infinity, 'bad', false, 1n, Symbol('input')]) assert.deepEqual(sample(.137, badInput), sample(.137));
  assert.deepEqual(inputsOf({ tempo: -1e9, stride: -1e9, display: -1e9 }), { tempo: .025, stride: .65, display: 0 });
  assert.deepEqual(inputsOf({ tempo: 1e9, stride: 1e9, display: 1e9 }), { tempo: .10, stride: 1.25, display: 1 });
  for (const t of [-Number.MAX_VALUE, Number.MAX_VALUE, -Number.MIN_VALUE, Number.MIN_VALUE]) finite(sample(t));
  const input = freeze({ tempo: .075, stride: 1.13, display: .82 }), before = structuredClone(input);
  const saved = freeze(sample(3.197, input)), copy = structuredClone(saved);
  sample(-9.31, input); poseAt(.91, input);
  assert.deepEqual(input, before); assert.deepEqual(saved, copy);
  assert.throws(() => solveLeg([0, 0, 0], [0, 0, 0]), RangeError);
  assert.throws(() => solveLeg([0, 0, 0], [2, 0, 0]), RangeError);
});

test('all five acts occur and tempo, stride and display have independent meaningful effects', () => {
  const acts = new Set(Array.from({ length: 240 }, (_, n) => poseAt(n / 240).act));
  assert.deepEqual([...acts].sort(), ['DISPLAY', 'GRASP', 'RECOVER', 'ROW', 'STALK']);
  for (const [p, act, active] of [[.08, 'STALK'], [.28, 'DISPLAY', 'display'], [.48, 'GRASP', 'grasp'], [.74, 'ROW', 'row'], [.97, 'RECOVER']]) {
    const s = poseAt(p); assert.equal(s.act, act);
    if (active) near(s.acts[active], 1);
  }
  const slow = sample(3.137, { tempo: .025 }), fast = sample(3.137, { tempo: .10 });
  assert.ok(distance(slow.legs[0].knee, fast.legs[0].knee) > .10, 'tempo must change the time-sampled pose');
  near(slow.metrics.cycleSeconds, 40); near(fast.metrics.cycleSeconds, 10);
  closeTree(geometryOnly(poseAt(.277, { tempo: .025 })), geometryOnly(poseAt(.277, { tempo: .10 })));
  const short = poseAt(.25, { stride: .65 }), long = poseAt(.25, { stride: 1.25 });
  near(short.metrics.travelSpanM, .84 * .65); near(long.metrics.travelSpanM, .84 * 1.25);
  assert.ok(distance(short.origin, long.origin) > .24);
  assert.ok(distance(short.legs[0].foot, long.legs[0].foot) > .15, 'stride must change contact targets, not only telemetry');
  const quiet = poseAt(.277, { display: 0 }), display = poseAt(.277, { display: 1 });
  assert.ok(display.claws[0].elbow[1] - quiet.claws[0].elbow[1] > .20, 'display raises the pedipalps');
  assert.ok(display.claws[0].aperture - quiet.claws[0].aperture > .25, 'display opens the jaws');
  assert.ok(display.rates.panels - quiet.rates.panels > .19, 'display opens the shield');
  assert.ok(distance(display.tail.at(-1).end, quiet.tail.at(-1).end) > .10, 'display affects the tail wave');
});

test('240-phase corner sweep: rigid members, midpoint-locked stance, support and continuous raised tail', () => {
  let comparisons = 0, minSupport = 6, sawSwing = false;
  const eps = 1e-6;
  for (const input of corners) for (let n = 0; n < 240; n++) {
    const s = poseAt(n / 240, input), next = poseAt(n / 240 + eps, input);
    finite(s);
    assert.equal(s.legs.length, 6); assert.equal(s.claws.length, 2); assert.equal(s.paddles.length, 2); assert.equal(s.tail.length, 12);
    const support = s.legs.filter(l => l.stance).length;
    assert.equal(s.metrics.supportFeet, support); assert.ok(support >= 3, `support ${support} at ${s.phase}`);
    minSupport = Math.min(minSupport, support);
    for (const l of s.legs) {
      near(distance(l.root, l.hip), .20, 1e-9, `${l.id} coxa`);
      near(distance(l.hip, l.knee), .64, 1e-9, `${l.id} femur`);
      near(distance(l.knee, l.ankle), .72, 1e-9, `${l.id} tibia`);
      nearPoint(l.ankle, l.foot.map((v, i) => v + (i === 1 ? .095 : 0)), `${l.id} upright ankle standoff`, 1e-10);
      near(l.reach, distance(l.hip, l.ankle));
      assert.ok(l.reach > Math.abs(.64 - .72) && l.reach < .64 + .72);
      near(distance(l.ram.a, l.ram.b), l.ram.length);
      assert.ok(l.foot[1] >= D.sole - 1e-12);
      if (l.stance) {
        near(l.foot[1], D.sole);
        const midpoint = (l.step + D.duty / 2 - l.offset) / D.strides;
        const contactZ = -.42 * input.stride * Math.sin(TAU * midpoint) + (-.48 + l.station * .47) + (l.station - 1) * .16;
        near(l.foot[2], contactZ, 1e-10, `${l.id} stance midpoint`);
        near(l.foot[0], l.side * (l.station === 1 ? 1.45 : 1.33));
      } else sawSwing ||= l.foot[1] > D.sole + .10;
    }
    comparisons += assertNoSlip(s, next);
    for (const c of s.claws) {
      near(distance(c.root, c.elbow), .62); near(distance(c.elbow, c.wrist), .62); near(distance(c.wrist, c.palmEnd), .34);
      near(distance(c.ram.a, c.ram.b), c.ram.length);
      for (const end of [c.root, c.elbow, c.wrist, c.palmEnd]) assert.ok(end[1] > 0);
    }
    for (const p of s.paddles) {
      near(distance(p.root, p.elbow), .60); near(distance(p.elbow, p.end), .62);
      for (const end of [p.root, p.elbow, p.end]) assert.ok(end[1] > 0);
    }
    nearPoint(s.tail[0].start, world(s, [0, .015, .61]), 'tail root');
    s.tail.forEach((segment, i) => {
      near(segment.length, D.tail[i]); near(distance(segment.start, segment.end), D.tail[i]);
      if (i) nearPoint(segment.start, s.tail[i - 1].end, `tail ${i + 1} connection`, 1e-10);
      assert.ok(segment.start[1] > 0 && segment.end[1] > 0, `tail ${i + 1} below ground`);
      nearPoint(segment.end, next.tail[i].end, `tail ${i + 1} temporal continuity`, 2e-4);
    });
  }
  assert.equal(minSupport, 3); assert.ok(sawSwing); assert.ok(comparisons > 5000, `only ${comparisons} same-step comparisons`);
  for (const input of corners) {
    const before = poseAt(-1e-7, input), after = poseAt(1e-7, input);
    before.tail.forEach((s, i) => nearPoint(s.end, after.tail[i].end, `tail ${i + 1} cycle seam`, 1e-4));
    for (const leg of LEGS) for (let k = 0; k < D.strides; k++) for (const boundary of [0, D.duty]) {
      const p = (k + boundary - leg.offset) / D.strides;
      const a = poseAt(p - 1e-7, input).legs.find(l => l.id === leg.id);
      const b = poseAt(p + 1e-7, input).legs.find(l => l.id === leg.id);
      nearPoint(a.foot, b.foot, `${leg.id} contact transition`, 1e-5);
    }
  }
});

test('no-slip oracle rejects feet translated with the body, but does not compare different stance steps', () => {
  const a = poseAt(.0137), b = poseAt(.013701);
  assert.ok(assertNoSlip(a, b) >= 3);
  const translated = structuredClone(b), delta = b.origin.map((v, i) => v - a.origin[i]);
  assert.ok(Math.hypot(...delta) > 1e-7);
  translated.legs.forEach(l => { l.foot = l.foot.map((v, i) => v + delta[i]); });
  assert.throws(() => assertNoSlip(a, translated), /stance step .* slips/);
  const otherStep = structuredClone(translated);
  otherStep.legs.forEach(l => { l.step += 1; });
  assert.equal(assertNoSlip(a, otherStep), 0);
});

test('LEVIATHAN rendered model regressions', async t => {
  const m = await descriptor.createModel();
  try {
    await t.test('actual instance and node endpoints agree with every rigid solver member', () => {
      for (const input of corners) for (const phase of phases) {
        const s = poseAt(phase, input); m.update(s, { quality: 'high', explode: 0, mode: 'solid' });
        const items = instances(m);
        const member = (id, start, end, length) => {
          nearPoint(point(node(m, id).matrixWorld), start, `${id} node root`);
          nearPoint(point(node(m, id).matrixWorld, [0, length, 0]), end, `${id} node end`);
          const core = primitive(items, id, 'BoxGeometry', 0x26343d);
          nearPoint(point(core, [0, -.5, 0]), start, `${id} rendered root`);
          nearPoint(point(core, [0, .5, 0]), end, `${id} rendered end`);
        };
        const ram = (id, r, length) => {
          const barrel = primitive(items, `${id}.barrel`, 'CylinderGeometry', 0x26343d);
          const rod = primitive(items, `${id}.rod`, 'CylinderGeometry', 0x8b9da6);
          nearPoint(point(barrel, [0, -.5, 0]), r.a, `${id} barrel mount`);
          near(distance(point(barrel, [0, -.5, 0]), point(barrel, [0, .5, 0])), length, 2e-6, `${id} fixed sleeve`);
          nearPoint(point(rod, [0, -.5, 0]), r.a.map((v, i) => v + (r.b[i] - v) * (length - .025) / r.length), `${id} gland`);
          nearPoint(point(rod, [0, .5, 0]), r.b, `${id} rod output`);
          nearPoint(point(primitive(items, `${id}.eye`, 'SphereGeometry', 0xb28b4d)), r.b, `${id} clevis`);
        };
        for (const l of s.legs) {
          member(`leg.${l.id}.coxa`, l.root, l.hip, .20);
          member(`leg.${l.id}.upper`, l.hip, l.knee, .64);
          member(`leg.${l.id}.lower`, l.knee, l.ankle, .72);
          nearPoint(point(node(m, `leg.${l.id}.foot`).matrixWorld), l.foot, `${l.id} foot node`);
          nearPoint(point(node(m, `leg.${l.id}.foot`).matrixWorld, [0, .095, 0]), l.ankle, `${l.id} ankle node`);
          nearPoint(point(primitive(items, `leg.${l.id}.foot`, 'SphereGeometry', 0x18252a), [0, .03 / .035, 0]), l.foot, `${l.id} rendered sole anchor`);
          const stems = items.filter(p => p.id === `${prefix}leg.${l.id}.foot` && p.geometry.type === 'CylinderGeometry' && p.color === 0x236d70);
          const stemBase = l.foot.map((v, i) => v + (i === 1 ? .015 : 0));
          assert.ok(stems.some(p => distance(point(p.matrix, [0, .5, 0]), l.ankle) < 2e-6 && distance(point(p.matrix, [0, -.5, 0]), stemBase) < 2e-6), `${l.id} visible ankle stem must bridge the tibia and foot`);
          ram(`leg.${l.id}.ram`, l.ram, .22);
        }
        s.claws.forEach((c, i) => {
          const id = `claw.${i ? 'R' : 'L'}`;
          member(`${id}.upper`, c.root, c.elbow, .62); member(`${id}.fore`, c.elbow, c.wrist, .62);
          const palm = primitive(items, `${id}.palm`, 'SphereGeometry', 0x236d70);
          nearPoint(point(palm, [0, -.17 / .28, 0]), c.wrist, `${id} rendered wrist`);
          nearPoint(point(palm, [0, .17 / .28, 0]), c.palmEnd, `${id} rendered palm end`);
          nearPoint(point(node(m, `${id}.palm`).matrixWorld, [0, .34, 0]), c.palmEnd, `${id} palm node`);
          for (const [jaw, sign] of [['A', 1], ['B', -1]]) near(node(m, `${id}.jaw${jaw}`).rotation.z, sign * c.aperture);
          ram(`${id}.ram`, c.ram, .35);
        });
        s.paddles.forEach((p, i) => { const id = `paddle.${i ? 'R' : 'L'}`; member(`${id}.upper`, p.root, p.elbow, .60); member(`${id}.lower`, p.elbow, p.end, .62); });
        s.tail.forEach((segment, i) => {
          const id = `tail.${i + 1}`, core = primitive(items, id, 'BoxGeometry', 0x26343d);
          nearPoint(point(node(m, id).matrixWorld), segment.start, `${id} node root`);
          nearPoint(point(node(m, id).matrixWorld, [0, segment.length, 0]), segment.end, `${id} node end`);
          // The solid core leaves a 2% bearing gap at each end.
          nearPoint(point(core, [0, -.5 / .96, 0]), segment.start, `${id} rendered root anchor`);
          nearPoint(point(core, [0, .5 / .96, 0]), segment.end, `${id} rendered end anchor`);
        });
        nearPoint(point(node(m, 'telson').matrixWorld), s.tail.at(-1).end, 'telson hinge');
      }
    });

    await t.test('nine actual-vertex poses stay above the floor with finite positive-determinant matrices', () => {
      const failures = [];
      phases.forEach((phase, i) => {
        m.update(poseAt(phase, i ? corners[i - 1] : DEFAULT_INPUTS), { quality: 'high', explode: 0, mode: 'solid' });
        const items = instances(m);
        m.group.traverse(n => { finite(n.matrixWorld.elements, n.name); assert.ok(n.matrixWorld.determinant() > 0, `${n.name} reflected/singular node`); });
        for (const item of items) { finite(item.matrix.elements, item.id); assert.ok(item.matrix.determinant() > 0, `${item.id} reflected/singular instance`); }
        const bounds = vertexBounds(items);
        if (bounds.min.y < -.001) {
          const below = [...new Set(items.filter(item => vertexBounds([item]).min.y < -.001).map(item => item.id))];
          failures.push(`phase ${phase}, input ${JSON.stringify(i ? corners[i - 1] : DEFAULT_INPUTS)}: floor ${bounds.min.y.toFixed(6)} m; ${below.join(', ')}`);
        }
      });
      assert.equal(failures.length, 0, failures.join('\n'));
    });

    await t.test('shield, pedipalps, walking members and paddle blades have substantial solid vertex dimensions', () => {
      m.update(poseAt(.3071), { quality: 'high', explode: 0 });
      const items = instances(m);
      const size = (id, descendants = false) => vertexBounds(items.filter(p => p.id === prefix + id || (descendants && p.id.startsWith(prefix + id + '.'))), node(m, id).matrixWorld.clone().invert()).getSize(new THREE.Vector3());
      const substantial = (id, minima) => {
        const actual = size(id).toArray();
        minima.forEach((min, i) => assert.ok(actual[i] > min, `${id} local ${'xyz'[i]} dimension ${actual[i]} <= ${min} m`));
      };
      for (const s of ['L', 'R']) {
        substantial(`shield.${s}`, [.90, .40, 1.35]);
        substantial(`claw.${s}.upper`, [.45, .60, .30]);
        substantial(`claw.${s}.fore`, [.36, .60, .25]);
        substantial(`claw.${s}.palm`, [.48, .48, .25]);
        substantial(`paddle.${s}.fan`, [.58, .70, .10]);
      }
      for (const l of LEGS) {
        substantial(`leg.${l.id}.coxa`, [.22, .20, .16]);
        substantial(`leg.${l.id}.upper`, [.28, .60, .20]);
        substantial(`leg.${l.id}.lower`, [.21, .70, .14]);
      }
      substantial('tail.1.tergite', [.95, .25, .32]);
      assert.ok(size('tail.12.tergite').x < size('tail.1.tergite').x * .30, 'twelve-link armour must taper');
      const shield = vertexBounds(items.filter(p => /^eurypterid\.shield\.[LR]$/.test(p.id)), node(m, 'body').matrixWorld.clone().invert()).getSize(new THREE.Vector3());
      assert.ok(shield.x > 1.65 && shield.y > .40 && shield.z > 1.35, `combined shield ${shield.toArray()}`);
    });

    await t.test('unique complete metadata and every part ID survive each quality within rendering budgets', () => {
      const ids = m.parts.map(p => p.id).sort(), metadata = structuredClone(m.parts);
      assert.equal(new Set(ids).size, ids.length); assert.deepEqual(ids, expectedIds());
      assert.equal(new Set(m.parts.map(p => p.name)).size, m.parts.length);
      for (const p of m.parts) {
        node(m, p.id.slice(prefix.length));
        for (const field of ['name', 'system', 'function', 'how', 'detail', 'material', 'unit']) assert.ok(typeof p[field] === 'string' && p[field].trim().length > 3, `${p.id} missing ${field}`);
        assert.ok(p.function.length > 30 && p.how.length > 60, `${p.id} needs explanatory metadata`);
      }
      for (const quality of ['high', 'balanced', 'low']) {
        m.update(poseAt(.4313), { quality, explode: 0, mode: 'solid' });
        const used = new Set(), stats = { triangles: 0, instances: 0, drawCalls: 0 };
        for (const mesh of m.pickables) {
          if (mesh.count) stats.drawCalls++;
          stats.instances += mesh.count;
          stats.triangles += mesh.count * (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
          for (let i = 0; i < mesh.count; i++) used.add(mesh.userData.instanceParts[i]);
        }
        assert.deepEqual([...used].sort(), ids, `${quality} drops selectable parts`);
        for (const key of Object.keys(stats)) near(m.stats[key], stats[key], 1e-8, `${quality} ${key}`);
        assert.equal(m.stats.selectableParts, ids.length);
        assert.ok(stats.triangles <= 200000, `${quality}: ${stats.triangles} triangles > 200000`);
        assert.ok(stats.drawCalls <= 40 && m.pickables.length <= 40, `${quality}: ${stats.drawCalls} draw calls/${m.pickables.length} batches`);
      }
      assert.deepEqual(m.parts, metadata);
    });

    await t.test('explosion reverses exactly; repeated updates and sampling do not mutate state', () => {
      const state = freeze(sample(5.193)), saved = structuredClone(state);
      m.update(state, { quality: 'high', explode: 0, mode: 'solid' });
      const original = snapshot(m);
      m.update(state, { quality: 'high', explode: 0, mode: 'solid' }); assert.deepEqual(snapshot(m), original);
      m.update(state, { quality: 'high', explode: .83, mode: 'xray' }); const exploded = snapshot(m);
      assert.notDeepEqual(exploded, original, 'explosion must move rendered instances');
      m.update(state, { quality: 'high', explode: .83, mode: 'xray' }); assert.deepEqual(snapshot(m), exploded, 'explosion accumulates');
      m.update(state, { quality: 'low', explode: 1, mode: 'cutaway', selectedId: prefix + 'claw.L.palm' });
      m.update(state, { quality: 'high', explode: 0, mode: 'solid' });
      assert.deepEqual(snapshot(m), original, 'zero explosion must exactly restore matrices and colors');
      sample(-7.913); assert.deepEqual(state, saved);
      for (const mesh of m.pickables) { assert.equal(mesh.material.transparent, false); assert.equal(mesh.material.opacity, 1); assert.deepEqual(mesh.material.clippingPlanes, []); }
    });

    await t.test('named parent-relative mechanisms articulate at nine noncommensurate phases; frozen/root-only controls fail', () => {
      const input = { tempo: .05, stride: 1.25, display: 1 };
      m.update(poseAt(phases[0], input), { quality: 'high', explode: 0, mode: 'solid' });
      const bindings = renderBindings(m), specs = motionSpecs();
      const frames = phases.map(phase => {
        m.update(poseAt(phase, input), { quality: 'high', explode: 0, mode: 'solid' });
        return renderedFrames(bindings);
      });
      const frozen = phases.map(() => frames[0]);
      assert.equal(motionFailures(frozen, specs).length, specs.length, 'every named motion gate must reject frozen snapshots');
      const translatedRootOnly = phases.map((p, i) => {
        const translation = new THREE.Matrix4().makeTranslation(i * .31, Math.sin(p * TAU) * .27, -i * .19);
        return new Map([...frames[0]].map(([id, matrix]) => [id, matrix.clone().premultiply(translation)]));
      });
      assert.equal(motionFailures(translatedRootOnly, specs).length, specs.length, 'global root motion must not satisfy any local-motion gate');
      // The middle lamella is intentionally the stationary spine of each fan.
      for (const side of ['L', 'R']) {
        const range = relativeRange(frames, { id: `paddle.${side}.lamella3`, parent: `paddle.${side}.fan` });
        assert.ok(range.angle < 1e-4 && range.travel < 1e-5, `${side} central lamella must stay on its fan`);
      }
      const failures = motionFailures(frames, specs);
      assert.equal(failures.length, 0, failures.join('\n'));
    });

    await t.test('dispose releases each shared render resource once and makes later updates harmless', () => {
      const resources = new Set(m.pickables.flatMap(mesh => [mesh, mesh.geometry, ...[mesh.material].flat()])), calls = new Map();
      for (const resource of resources) resource.addEventListener('dispose', () => calls.set(resource, (calls.get(resource) ?? 0) + 1));
      m.dispose(); m.dispose();
      assert.doesNotThrow(() => m.update(freeze(sample(1.317)), { explode: 1 }));
      assert.equal(m.pickables.length, 0); assert.equal(m.group.children.length, 0);
      for (const resource of resources) assert.equal(calls.get(resource), 1, `${resource.type} disposed more or less than once`);
    });
  } finally { m.dispose(); }
});
