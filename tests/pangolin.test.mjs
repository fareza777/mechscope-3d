import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/pangolin/index.js';
import { DEFAULT_INPUTS, D, LEGS, TAU, inputsOf, cycleHz, poseAt, sample, solveLeg, distance } from '../src/mechanisms/pangolin/kin.js';

const phases = [.0137, .0973, .2189, .3071, .4313, .5629, .6833, .7949, .9371];
const corners = [.025, .10].flatMap(tempo => [.65, 1.25].flatMap(stride => [0, 1].map(armour => ({ tempo, stride, armour }))));
const near = (a, b, eps = 1e-8, label = '') => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} != ${b}`);
const at = (a, b, label = '', eps = 2e-6) => near(distance(a, b), 0, eps, label);
const point = (m, p = [0, 0, 0]) => new THREE.Vector3(...p).applyMatrix4(m).toArray();
function finite(v) { if (typeof v === 'number') assert.ok(Number.isFinite(v)); else if (v && typeof v === 'object') Object.values(v).forEach(finite); }
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function close(a, b) {
  if (typeof a === 'number') near(a, b, 1e-7);
  else if (a && typeof a === 'object') { assert.deepEqual(Object.keys(a), Object.keys(b)); for (const k of Object.keys(a)) close(a[k], b[k]); }
  else assert.equal(a, b);
}
const withoutTime = ({ t, ...s }) => s;
function noSlip(a, b) {
  let count = 0;
  a.legs.forEach((l, i) => { const n = b.legs[i]; if (l.stance && n.stance && l.step === n.step) { at(l.foot, n.foot, `${l.id} stance slips`, 1e-10); count++; } });
  return count;
}
const node = (m, id) => { const n = m.group.getObjectByName(`pangolin.${id}`); assert.ok(n, id); return n; };
function instances(m) {
  return m.pickables.flatMap(mesh => Array.from({ length: mesh.count }, (_, i) => {
    const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    return { id: mesh.userData.instanceParts[i].slice(9), mesh, i, matrix: matrix.premultiply(mesh.matrixWorld), geometry: mesh.geometry, color: mesh.material.color.getHex() };
  }));
}
function primitive(items, id, type, color) {
  const found = items.filter(x => x.id === id && x.geometry.type === type && x.color === color);
  assert.equal(found.length, 1, `${id} ${type} anchor`); return found[0].matrix;
}
function bounds(items, reference = new THREE.Matrix4(), vertices = true) {
  assert.ok(items.length); const b = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4();
  for (const x of items) {
    m.multiplyMatrices(reference, x.matrix);
    if (vertices) { const p = x.geometry.attributes.position; for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m)); }
    else { if (!x.geometry.boundingBox) x.geometry.computeBoundingBox(); const g = x.geometry.boundingBox;
      for (const a of [g.min.x, g.max.x]) for (const y of [g.min.y, g.max.y]) for (const z of [g.min.z, g.max.z]) b.expandByPoint(v.set(a, y, z).applyMatrix4(m)); }
  } return b;
}
const snapshot = m => m.pickables.map(x => [x.count, x.userData.instanceParts.slice(0, x.count), Array.from(x.instanceMatrix.array.slice(0, x.count * 16)), Array.from(x.instanceColor.array.slice(0, x.count * 3))]);
function expectedIds() {
  const ids = ['body', 'belly', 'neck', 'head', 'head.jaw', 'drive.flywheel'];
  for (let i = 1; i <= 3; i++) ids.push(`tongue.${i}`, `drive.gear${i}`);
  for (const s of ['L', 'R']) ids.push(`head.ear${s}`, `head.eye${s}`, `head.eye${s}.optic`, `pump.${s}`, `pump.${s}.plunger`);
  for (let i = 1; i <= 8; i++) ids.push(`trunk.${i}`, `trunk.${i}.joint`, `trunk.${i}.ribL`, `trunk.${i}.ribR`, ...Array.from({ length: 7 }, (_, j) => `trunk.${i}.scale${j + 1}`));
  for (const l of LEGS) for (const suffix of ['hip', 'upper', 'lower', 'upper-cover', 'lower-cover', 'pinion', 'foot', 'toe1', 'toe2', 'toe3', 'ram.barrel', 'ram.rod', 'ram.eye']) ids.push(`leg.${l.id}.${suffix}`);
  for (let i = 1; i <= 12; i++) for (const suffix of ['', '.joint', '.cover', '.scaleL', '.scaleR']) ids.push(`tail.${i}${suffix}`);
  return ids.sort();
}
function motionSpecs() {
  const specs = [['head', 'neck', .35], ['neck', 'trunk.8', .15], ['drive.gear1', 'body', 2], ['drive.flywheel', 'body', 2], ['tongue.1', 'head', .18, 'travel'], ['tongue.2', 'tongue.1', .025]];
  for (const l of LEGS) specs.push([`leg.${l.id}.upper`, `leg.${l.id}.hip`, .30], [`leg.${l.id}.lower`, `leg.${l.id}.upper`, .30]);
  for (const s of ['L', 'R']) specs.push([`head.ear${s}`, 'head', .35], [`head.eye${s}`, 'head', .35], [`pump.${s}.plunger`, `pump.${s}`, .065, 'travel']);
  for (let i = 1; i <= 8; i++) {
    for (const side of ['L', 'R']) specs.push([`trunk.${i}.rib${side}`, `trunk.${i}`, .13]);
    for (let j = 1; j <= 7; j++) specs.push([`trunk.${i}.scale${j}`, `trunk.${i}`, .40]);
  }
  for (let i = 1; i <= 12; i++) specs.push([`tail.${i}`, i > 1 ? `tail.${i - 1}` : 'body', .18]);
  return specs;
}
function motionFailures(frames, specs) {
  return specs.filter(([id, parent, min, kind]) => {
    const poses = frames.map(f => { const m = f.get(parent).clone().invert().multiply(f.get(id)); const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); m.decompose(p, q, s); return { p, q: q.normalize() }; });
    let max = 0; for (const a of poses) for (const b of poses) max = Math.max(max, kind === 'travel' ? a.p.distanceTo(b.p) : a.q.angleTo(b.q));
    return max < min;
  }).map(s => s[0]);
}

test('MANIS descriptor, finite pure periodic corner inputs and seam continuity', () => {
  assert.deepEqual([descriptor.id, descriptor.title, descriptor.family, descriptor.collection], ['pangolin', 'MANIS P12', 'Mechanical Pangolin', '034']);
  assert.deepEqual(descriptor.defaultInputs, DEFAULT_INPUTS); assert.equal(descriptor.sample, sample); assert.equal(descriptor.cycleHz, cycleHz);
  assert.deepEqual(descriptor.controls.map(c => [c.key, c.min, c.max, c.step, c.precision]), [['tempo', .025, .10, .005, 3], ['stride', .65, 1.25, .01, 2], ['armour', 0, 1, .01, 2]]);
  assert.equal(descriptor.lessons.length, 5); assert.equal(descriptor.specs.length, 2); descriptor.specs.forEach(s => assert.ok(s.label.length <= 12));
  for (const input of [...corners, DEFAULT_INPUTS]) {
    freeze(input);
    for (const t of [-123.4567, -1 / input.tempo, 0, .137, 7.913, 1 / input.tempo, 913.537]) {
      const s = freeze(sample(t, input)), saved = structuredClone(s); finite(s); close(withoutTime(s), withoutTime(sample(t + 1 / input.tempo, input))); assert.deepEqual(sample(t, input), saved);
    }
    for (const p of [0, .19, .25, .35, .41, .36, .405, .575, .62, .60, .70, .83, .90, ...LEGS.flatMap(l => l.swings.flatMap(e => e.slice(0, 2)))]) {
      const a = poseAt(p - 1e-7, input), b = poseAt(p + 1e-7, input);
      a.legs.forEach((l, i) => { at(l.foot, b.legs[i].foot, 'foot seam', 1e-5); at(l.knee, b.legs[i].knee, 'knee seam', 1e-5); });
      a.tail.forEach((s, i) => at(s.end, b.tail[i].end, 'tail seam', 2e-5));
    }
  }
  for (const bad of [NaN, Infinity, -Infinity, null, undefined, '', false, {}, [], '0.05', 1n, Symbol()]) {
    assert.deepEqual(inputsOf({ tempo: bad, stride: bad, armour: bad }), DEFAULT_INPUTS); assert.deepEqual(poseAt(bad), poseAt(0)); assert.deepEqual(sample(bad), sample(0));
  }
  assert.deepEqual(inputsOf({ tempo: -1e9, stride: -1e9, armour: -1e9 }), { tempo: .025, stride: .65, armour: 0 });
  assert.deepEqual(inputsOf({ tempo: 1e9, stride: 1e9, armour: 1e9 }), { tempo: .10, stride: 1.25, armour: 1 });
  for (const t of [Number.MAX_VALUE, -Number.MAX_VALUE]) finite(sample(t));
  assert.throws(() => solveLeg([0, 0, 0], [2, 0, 0]), RangeError);
  assert.deepEqual([...new Set(Array.from({ length: 240 }, (_, i) => poseAt(i / 240).act))].sort(), ['BRACE', 'DIG', 'RECOVER', 'SNIFF', 'WALK']);
  assert.ok(distance(sample(3.17, { tempo: .025 }).head.origin, sample(3.17, { tempo: .10 }).head.origin) > .10);
  near(poseAt(.25, { stride: 1.25 }).metrics.travelSpanM, .625);
  assert.ok(poseAt(.75, { armour: 1 }).rates.scales[0] - poseAt(.75, { armour: 0 }).rates.scales[0] > .33);
});

test('240-phase corner sweep: exact limbs, serial trunk/tail, three supports and world locking', () => {
  let comparisons = 0, digging = new Set(), maxLift = 0;
  for (const input of corners) for (let i = 0; i < 240; i++) {
    const s = poseAt(i / 240, input); finite(s); comparisons += noSlip(s, poseAt(i / 240 + 1e-6, input));
    assert.ok(s.metrics.supportFeet >= 3); assert.equal(s.legs.filter(l => l.stance).length, s.metrics.supportFeet);
    for (const l of s.legs) {
      near(distance(l.root, l.knee), D.upper); near(distance(l.knee, l.ankle), D.lower); at(l.ankle, l.foot.map((v, k) => v + (k === 1 ? .10 : 0)));
      assert.ok(l.reach > .35 && l.reach < .80, `meaningful knee flex ${l.reach}`); assert.ok(l.ram.length > .24 && l.ram.length < .50);
      assert.ok(l.foot[1] >= D.sole); if (l.stance) near(l.foot[1], D.sole);
      maxLift = Math.max(maxLift, l.foot[1] - D.sole);
      if (l.stroke === 'dig') { assert.ok(!l.hind); digging.add(l.id); assert.equal(s.metrics.supportFeet, 3); }
    }
    for (const chain of [s.trunk, s.tail]) chain.forEach((seg, j) => { near(distance(seg.start, seg.end), chain === s.tail ? D.tail[j] : .17); if (j) at(seg.start, chain[j - 1].end); assert.ok(seg.end[1] > .30); });
  }
  assert.ok(comparisons > 6000); assert.deepEqual([...digging].sort(), ['FL', 'FR']); assert.ok(maxLift > .23);
  const a = poseAt(.0137), b = poseAt(.013701), bad = structuredClone(b); assert.ok(noSlip(a, b) >= 3);
  bad.legs.forEach(l => { l.foot = l.foot.map((v, i) => v + b.origin[i] - a.origin[i]); }); assert.throws(() => noSlip(a, bad), /stance slips/);
  bad.legs.forEach(l => l.step++); assert.equal(noSlip(a, bad), 0);
});

test('MANIS rendered geometry regressions', async t => {
  const m = await descriptor.createModel();
  try {
    await t.test('node AND visible instance endpoints close every rigid chain and hydraulic attachment', () => {
      for (const input of corners) for (const phase of phases) {
        const s = poseAt(phase, input); m.update(s, { quality: 'high', explode: 0 }); const items = instances(m);
        const member = (id, a, b, length) => { const n = node(m, id); at(point(n.matrixWorld), a, `${id} node start`); at(point(n.matrixWorld, [0, length, 0]), b, `${id} node end`);
          const p = primitive(items, id, 'BoxGeometry', 0x26343d); at(point(p, [0, -.5, 0]), a, `${id} render start`); at(point(p, [0, .5, 0]), b, `${id} render end`); };
        for (const l of s.legs) {
          const id = `leg.${l.id}`; member(`${id}.upper`, l.root, l.knee, .42); member(`${id}.lower`, l.knee, l.ankle, .46);
          at(point(node(m, `${id}.foot`).matrixWorld), l.foot); const stem = primitive(items, `${id}.foot`, 'CylinderGeometry', 0x236d70);
          at(point(stem, [0, -.5, 0]), l.foot); at(point(stem, [0, .5, 0]), l.ankle);
          const barrel = primitive(items, `${id}.ram.barrel`, 'CylinderGeometry', 0x26343d), rod = primitive(items, `${id}.ram.rod`, 'CylinderGeometry', 0x8b9da6);
          at(point(barrel, [0, -.5, 0]), l.ram.a); near(distance(point(barrel, [0, -.5, 0]), point(barrel, [0, .5, 0])), .22, 2e-6);
          at(point(rod, [0, -.5, 0]), l.ram.a.map((v, i) => v + (l.ram.b[i] - v) * .20 / l.ram.length)); at(point(rod, [0, .5, 0]), l.ram.b);
          at(point(primitive(items, `${id}.ram.eye`, 'SphereGeometry', 0xb28b4d)), l.ram.b);
        }
        s.trunk.forEach((v, i) => member(`trunk.${i + 1}`, v.start, v.end, .17)); s.tail.forEach((v, i) => member(`tail.${i + 1}`, v.start, v.end, v.length));
        member('neck', s.neck.start, s.neck.end, .14);
        for (let i = 1; i <= 3; i++) { const n = node(m, `tongue.${i}`), p = primitive(items, `tongue.${i}`, 'CylinderGeometry', 0xa86642);
          at(point(p, [0, -.5, 0]), point(n.matrixWorld)); at(point(p, [0, .5, 0]), point(n.matrixWorld, [0, 0, -.065])); near(distance(point(p, [0, -.5, 0]), point(p, [0, .5, 0])), .065, 2e-6); }
      }
    });
    await t.test('actual vertices clear the floor at nine noncommensurate phases and corners; matrices are positive', () => {
      const envelope = new THREE.Box3().setFromPoints(m.framePoints); assert.ok(m.framePoints.length > 1000); assert.ok(m.views.home[2] < 0); assert.equal(m.maxViewDistance, 24);
      for (const input of corners) for (const phase of phases) {
        const s = poseAt(phase, input); m.update(s, { quality: 'high' }); const items = instances(m);
        m.group.traverse(n => { finite(n.matrixWorld.elements); assert.ok(n.matrixWorld.determinant() > 0, n.name); });
        for (const x of items) { finite(x.matrix.elements); assert.ok(x.matrix.determinant() > 0, x.id); }
        const b = bounds(items); assert.ok(b.min.y >= -1e-6, `floor at ${phase}: ${b.min.y}; ${items.filter(x => bounds([x]).min.y < -1e-6).map(x => x.id)}`);
        for (const l of s.legs.filter(l => l.stance)) for (let j = 1; j <= 3; j++) near(bounds(items.filter(x => x.id === `leg.${l.id}.toe${j}`)).min.y, 0, 1e-6, 'grounded toe');
        const cornersBox = bounds(items, new THREE.Matrix4(), false); for (const k of ['x', 'y', 'z']) { assert.ok(cornersBox.min[k] >= envelope.min[k] - .025, `frame min ${k}`); assert.ok(cornersBox.max[k] <= envelope.max[k] + .025, `frame max ${k}`); }
      }
      at(m.group.position.toArray(), [0, 0, 0]);
    });
    await t.test('filled trunk, thick diamond scales, stout paws and broad tapering tail pass mass dimensions', () => {
      m.update(poseAt(.0137)); const items = instances(m);
      const size = (id, descendants = false) => {
        const owner = node(m, id), family = new Set([owner]); if (descendants) owner.traverse(n => family.add(n));
        return bounds(items.filter(x => family.has(node(m, x.id))), owner.matrixWorld.clone().invert()).getSize(new THREE.Vector3()).toArray();
      };
      const substantial = (id, minima, descendants = false) => size(id, descendants).forEach((v, i) => assert.ok(v > minima[i], `${id} dimension ${i}: ${v} <= ${minima[i]}`));
      for (let i = 2; i <= 7; i++) substantial(`trunk.${i}`, [.80, .30, .60]);
      for (let i = 1; i <= 8; i++) for (let j = 1; j <= 7; j++) substantial(`trunk.${i}.scale${j}`, [.30, .30, .065]);
      for (const l of LEGS) { substantial(`leg.${l.id}.upper`, [.25, .41, .20]); substantial(`leg.${l.id}.lower`, [.18, .45, .15]); substantial(`leg.${l.id}.foot`, [.27, .14, .45], true); }
      substantial('head', [.44, .32, .80]); substantial('tail.1.cover', [.75, .29, .28]); assert.ok(size('tail.12.cover')[0] < size('tail.1.cover')[0] * .20);
      const total = bounds(items).getSize(new THREE.Vector3()); assert.ok(total.x > 1.2 && total.x < 1.85); assert.ok(total.y > 1.15 && total.y < 1.65); assert.ok(total.z > 3.25 && total.z < 4.1);
    });
    await t.test('unique complete meaningful IDs survive low quality within triangle and batch budgets', () => {
      const ids = m.parts.map(p => p.id.slice(9)).sort(); assert.deepEqual(ids, expectedIds()); assert.ok(ids.length >= 170 && ids.length <= 260); assert.equal(new Set(m.parts.map(p => p.name)).size, ids.length);
      for (const p of m.parts) { for (const key of ['name', 'system', 'function', 'how', 'detail', 'material', 'unit']) assert.ok(p[key]?.trim().length > 3, `${p.id} ${key}`); assert.ok(p.function.length + p.how.length > 80); }
      for (const quality of ['high', 'balanced', 'low']) {
        m.update(poseAt(.3071), { quality }); const items = instances(m); assert.deepEqual([...new Set(items.map(x => x.id))].sort(), ids);
        const triangles = items.reduce((v, x) => v + x.geometry.index.count / 3, 0); near(m.stats.triangles, triangles); assert.equal(m.stats.instances, items.length); assert.equal(m.stats.selectableParts, ids.length);
        assert.ok(triangles <= 200000); assert.ok(m.stats.drawCalls <= 40 && m.pickables.length <= 40);
      }
      t.diagnostic(`parts=${ids.length}; low=${JSON.stringify(m.stats)}; framePoints=${m.framePoints.length}`);
    });
    await t.test('all named parent-relative amplitude gates reject frozen and root-only negative controls', () => {
      m.update(poseAt(phases[0], { armour: 1 }), { quality: 'high' }); const bindings = new Map();
      for (const x of instances(m)) if (!bindings.has(x.id)) bindings.set(x.id, { mesh: x.mesh, i: x.i, inverse: node(m, x.id).matrixWorld.clone().invert().multiply(x.matrix).invert() });
      const frames = phases.map(p => { m.update(poseAt(p, { stride: 1.25, armour: 1 }), { quality: 'high' }); return new Map([...bindings].map(([id, b]) => {
        assert.equal(b.mesh.userData.instanceParts[b.i], `pangolin.${id}`); const matrix = new THREE.Matrix4(); b.mesh.getMatrixAt(b.i, matrix); return [id, matrix.premultiply(b.mesh.matrixWorld).multiply(b.inverse)]; })); });
      const specs = motionSpecs(); assert.ok(specs.length >= 8); assert.equal(motionFailures(phases.map(() => frames[0]), specs).length, specs.length);
      const rootOnly = phases.map((p, i) => { const root = new THREE.Matrix4().makeRotationY(p * TAU); root.setPosition(i * .2, .2 * Math.sin(p * TAU), -i * .1); return new Map([...frames[0]].map(([id, m]) => [id, m.clone().premultiply(root)])); });
      assert.equal(motionFailures(rootOnly, specs).length, specs.length); assert.deepEqual(motionFailures(frames, specs), []);
      const defaults = phases.map(p => { m.update(poseAt(p), { quality: 'high' }); return new Map([...bindings].map(([id, b]) => {
        const matrix = new THREE.Matrix4(); b.mesh.getMatrixAt(b.i, matrix); return [id, matrix.premultiply(b.mesh.matrixWorld).multiply(b.inverse)]; })); });
      assert.deepEqual(motionFailures(defaults, specs), [], 'Default playback must articulate every named subsystem');
    });
    await t.test('root and ancestor placement transform actual rigid endpoints exactly once', () => {
      const parent = new THREE.Group(), state = poseAt(.4313);
      parent.position.set(.4, .3, -.2); parent.rotation.set(.12, -.23, .07); parent.scale.setScalar(1.17);
      parent.add(m.group); m.group.position.set(-.2, .1, .3); m.group.rotation.set(.07, .13, -.09);
      m.update(state, { quality: 'high' }); const items = instances(m);
      for (const leg of state.legs) {
        const id = `leg.${leg.id}.upper`, core = primitive(items, id, 'BoxGeometry', 0x26343d);
        at(point(core, [0, -.5, 0]), point(m.group.matrixWorld, leg.root), 'root and ancestor apply once');
        at(point(core, [0, .5, 0]), point(node(m, id).matrixWorld, [0, D.upper, 0]), 'uploaded endpoint matches node');
      }
      parent.remove(m.group); m.group.position.set(0, 0, 0); m.group.rotation.set(0, 0, 0); m.update(state);
    });
    await t.test('bind restoration, exact explosion roundtrip, shell ghosting and idempotent disposal', () => {
      const s = freeze(sample(5.193)), before = structuredClone(s); m.update(s, { quality: 'high', mode: 'solid', explode: 0 }); const original = snapshot(m);
      m.update(s, { quality: 'high' }); assert.deepEqual(snapshot(m), original);
      m.update(s, { quality: 'high', mode: 'xray', explode: .83 }); const exploded = snapshot(m); assert.notDeepEqual(exploded, original);
      assert.ok(m.pickables.some(x => x.material.color.getHex() === 0xced5cf && x.material.transparent && x.material.opacity === .13));
      m.update(s, { quality: 'high', mode: 'xray', explode: .83 }); assert.deepEqual(snapshot(m), exploded);
      m.update(s, { quality: 'low', mode: 'cutaway', explode: 1, selectedId: 'pangolin.head' }); m.update(s, { quality: 'high', mode: 'solid', explode: 0 }); assert.deepEqual(snapshot(m), original); assert.deepEqual(s, before);
      t.diagnostic(`high=${JSON.stringify(m.stats)}; vertices span=${bounds(instances(m)).getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(3))}`);
      const resources = new Set(m.pickables.flatMap(x => [x, x.geometry, x.material])), calls = new Map(); resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) || 0) + 1)));
      m.dispose(); m.dispose(); assert.doesNotThrow(() => m.update(s)); assert.equal(m.pickables.length, 0); assert.equal(m.group.children.length, 0); resources.forEach(r => assert.equal(calls.get(r), 1));
    });
  } finally { m.dispose(); }
});
