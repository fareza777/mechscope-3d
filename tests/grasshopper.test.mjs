import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/grasshopper/index.js';
import { DEFAULT_INPUTS, D, LEGS, TAU, inputsOf, cycleHz, poseAt, sample, solveLeg, distance } from '../src/mechanisms/grasshopper/kin.js';
const prefix = 'grasshopper.', phases = [.0137, .0973, .2189, .3971, .4313, .6029, .6833, .7949, .9371];
const corners = [.025, .10].flatMap(tempo => [.5, 1].flatMap(jump => [0, 1].map(display => ({ tempo, jump, display }))));
const near = (a, b, eps = 1e-8, label = '') => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} != ${b}`);
const nearPoint = (a, b, label, eps = 2e-6) => near(distance(a, b), 0, eps, label);
function finite(v) { if (typeof v === 'number') assert.ok(Number.isFinite(v)); else if (v && typeof v === 'object') Object.values(v).forEach(finite); }
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function close(a, b) { if (typeof a === 'number') near(a, b, 1e-7); else if (a && typeof a === 'object') { assert.deepEqual(Object.keys(a), Object.keys(b)); for (const k of Object.keys(a)) close(a[k], b[k]); } else assert.equal(a, b); }
const noTime = ({ t, ...s }) => s;
function node(m, id) { const n = m.group.getObjectByName(prefix + id); assert.ok(n, `missing ${id}`); return n; }
const point = (matrix, p = [0, 0, 0]) => new THREE.Vector3(...p).applyMatrix4(matrix).toArray();
function instances(m) {
  return m.pickables.flatMap(mesh => Array.from({ length: mesh.count }, (_, index) => {
    assert.ok(mesh.isInstancedMesh); const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix);
    return { id: mesh.userData.instanceParts[index], mesh, index, matrix: matrix.premultiply(mesh.matrixWorld), geometry: mesh.geometry, color: mesh.material.color.getHex() };
  }));
}
function primitive(items, id, type, color) {
  const found = items.filter(x => x.id === prefix + id && x.geometry.type === type && x.color === color);
  assert.equal(found.length, 1, `${id} anchor primitive`); return found[0].matrix;
}
function bounds(items, reference = new THREE.Matrix4()) {
  assert.ok(items.length); const b = new THREE.Box3(), v = new THREE.Vector3(), matrix = new THREE.Matrix4();
  for (const x of items) { matrix.multiplyMatrices(reference, x.matrix); const p = x.geometry.attributes.position;
    for (let j = 0; j < p.count; j++) b.expandByPoint(v.fromBufferAttribute(p, j).applyMatrix4(matrix)); }
  return b;
}
const snapshot = m => m.pickables.map(mesh => ({ ids: mesh.userData.instanceParts.slice(0, mesh.count), matrix: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)), colors: Array.from(mesh.instanceColor.array.slice(0, mesh.count * 3)) }));
function noSlip(a, b) {
  let count = 0; a.legs.forEach((l, i) => { const r = b.legs[i]; if (l.stance && r.stance && l.step === r.step) { nearPoint(l.foot, r.foot, `${l.id} stance slips`, 1e-10); count++; } }); return count;
}
function expectedIds() {
  const ids = ['body', 'keel', 'neck', 'helmet', 'drive.housing', 'drive.shaft', 'drive.gyro', 'drive.gyro.inner', 'drive.gyro.rotor'];
  for (let i = 1; i <= 3; i++) ids.push(`drive.gear${i}`);
  for (let i = 1; i <= 4; i++) ids.push(`pump.${i}`, `pump.${i}.plunger`);
  for (const s of ['L', 'R']) {
    ids.push(`thorax.${s}1`, `thorax.${s}2`, `eye.${s}`, `eye.${s}.lens`, `jaw.${s}`, `jaw.${s}.palp1`, `jaw.${s}.palp2`);
    for (let i = 1; i <= 6; i++) ids.push(`antenna.${s}${i}`, `antenna.${s}${i}.sleeve`);
    for (const suffix of ['root', 'cover-hinge', 'cover']) ids.push(`wing.${s}.${suffix}`);
    for (let i = 1; i <= 7; i++) ids.push(`wing.${s}.fan${i}`, `wing.${s}.fan${i}.spar`);
  }
  for (const l of LEGS) {
    for (const suffix of ['coxa', 'upper', 'upper-cover', 'lower', 'lower-cover', 'bearing', 'foot', 'ankle', 'toeL', 'toeR', 'ram.barrel', 'ram.rod', 'ram.eye']) ids.push(`leg.${l.id}.${suffix}`);
    if (l.hind) ids.push(`leg.${l.id}.spring`, `leg.${l.id}.drum`);
  }
  for (let i = 1; i <= 8; i++) for (const suffix of ['', '.plate', '.L', '.R']) ids.push(`abdomen.${i}${suffix}`);
  return ids.map(id => prefix + id).sort();
}
function motionSpecs() {
  const specs = [], angular = (id, parent, min) => specs.push({ id, parent, min, kind: 'angle' });
  for (const l of LEGS) { angular(`leg.${l.id}.upper`, `leg.${l.id}.coxa`, .20); angular(`leg.${l.id}.lower`, `leg.${l.id}.upper`, l.hind ? .45 : .30); }
  for (const s of ['L', 'R']) {
    angular(`wing.${s}.root`, 'body', .25); angular(`wing.${s}.cover`, `wing.${s}.cover-hinge`, .90);
    for (let i = 1; i <= 7; i++) angular(`wing.${s}.fan${i}`, `wing.${s}.root`, .14 + (i - 1) * .13);
    for (let i = 1; i <= 6; i++) angular(`antenna.${s}${i}`, i === 1 ? 'helmet' : `antenna.${s}${i - 1}`, .10);
    angular(`jaw.${s}`, 'helmet', .15);
    for (let j = 1; j <= 2; j++) angular(`jaw.${s}.palp${j}`, `jaw.${s}`, .30);
    angular(`leg.${s}3.spring`, `leg.${s}3.upper`, .45);
  }
  for (let i = 1; i <= 8; i++) {
    angular(`abdomen.${i}`, i === 1 ? 'body' : `abdomen.${i - 1}`, .055);
    angular(`abdomen.${i}.plate`, `abdomen.${i}`, .14);
    for (const s of ['L', 'R']) angular(`abdomen.${i}.${s}`, `abdomen.${i}`, .16);
  }
  for (const id of ['drive.shaft', 'drive.gear1', 'drive.gear2', 'drive.gear3', 'drive.gyro']) angular(id, 'body', 2);
  angular('drive.gyro.inner', 'drive.gyro', 2); angular('drive.gyro.rotor', 'drive.gyro.inner', 2);
  for (let i = 1; i <= 4; i++) specs.push({ id: `pump.${i}.plunger`, parent: `pump.${i}`, min: .10, kind: 'travel' });
  return specs;
}
function bindings(m) {
  const map = new Map(); for (const x of instances(m)) if (!map.has(x.id)) map.set(x.id, { ...x, inverse: node(m, x.id.slice(prefix.length)).matrixWorld.clone().invert().multiply(x.matrix).invert() }); return map;
}
function frames(bind) {
  return new Map([...bind].map(([id, x]) => { const matrix = new THREE.Matrix4(); x.mesh.getMatrixAt(x.index, matrix); assert.equal(x.mesh.userData.instanceParts[x.index], id); return [id.slice(prefix.length), matrix.premultiply(x.mesh.matrixWorld).multiply(x.inverse)]; }));
}
function motionFailures(samples, specs) {
  return specs.filter(s => {
    const poses = samples.map(f => { const relative = f.get(s.parent).clone().invert().multiply(f.get(s.id)), p = new THREE.Vector3(), q = new THREE.Quaternion(), scale = new THREE.Vector3(); relative.decompose(p, q, scale); return { p, q: q.normalize() }; });
    let range = 0; for (const a of poses) for (const b of poses) range = Math.max(range, s.kind === 'angle' ? a.q.angleTo(b.q) : a.p.distanceTo(b.p));
    s.actual = range; return range < s.min;
  }).map(s => `${s.id}/${s.parent}: ${s.actual} < ${s.min}`);
}

test('SALTUS descriptor, controls and honest five-lesson contract', () => {
  assert.deepEqual([descriptor.id, descriptor.title, descriptor.collection, descriptor.family], ['grasshopper', 'SALTUS G6', '033', 'Mechanical Grasshopper']);
  assert.equal(descriptor.sample, sample); assert.equal(descriptor.cycleHz, cycleHz); assert.deepEqual(descriptor.defaultInputs, DEFAULT_INPUTS);
  assert.deepEqual(descriptor.controls.map(c => [c.key, c.min, c.max, c.step, c.precision]), [['tempo', .025, .10, .005, 3], ['jump', .5, 1, .01, 2], ['display', 0, 1, .01, 2]]);
  assert.equal(descriptor.specs.length, 2); descriptor.specs.forEach(s => assert.ok(s.label.length <= 12));
  assert.equal(descriptor.lessons.length, 5); descriptor.lessons.forEach(l => { assert.ok(l.text.length > 200 && l.fact.length > 60); });
  assert.deepEqual(LEGS.map(l => l.id), ['L1', 'L2', 'L3', 'R1', 'R2', 'R3']); assert.equal(D.abdomen.length, 8); assert.ok(D.ankle >= .1);
});
test('finite deterministic immutable samples, periodic negative time, and external scalar guards', () => {
  for (const input of [...corners, DEFAULT_INPUTS]) for (const time of [-193.137, -1 / input.tempo, 0, .137, 7.913, 913.537]) {
    const a = freeze(sample(time, freeze(input))), saved = structuredClone(a); finite(a); close(noTime(a), noTime(sample(time + 1 / input.tempo, input)));
    assert.deepEqual(sample(time, input), a); poseAt(.713); assert.deepEqual(a, saved);
  }
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, '0.05', false, {}, [], 1n, Symbol('external')]) {
    assert.deepEqual(inputsOf({ tempo: bad, jump: bad, display: bad }), DEFAULT_INPUTS);
    assert.deepEqual(sample(bad, { tempo: bad, jump: bad, display: bad }), sample(0)); assert.deepEqual(poseAt(bad), poseAt(0));
  }
  for (const bad of [null, NaN, Infinity, false, 'bad', 1n, Symbol('input')]) assert.deepEqual(sample(.137, bad), sample(.137));
  assert.deepEqual(inputsOf({ tempo: -1e9, jump: -1e9, display: -1e9 }), { tempo: .025, jump: .5, display: 0 });
  assert.deepEqual(inputsOf({ tempo: 1e9, jump: 1e9, display: 1e9 }), { tempo: .10, jump: 1, display: 1 });
  for (const t of [-Number.MAX_VALUE, Number.MAX_VALUE, Number.MIN_VALUE]) finite(sample(t));
  for (const target of [[0, 0, 0], [2, 0, 0], [.1, 0, 0]]) assert.throws(() => solveLeg([0, 0, 0], target), RangeError);
  assert.deepEqual([...new Set(Array.from({ length: 240 }, (_, i) => poseAt(i / 240).act))], ['WALK', 'CROUCH', 'LEAP', 'LAND', 'RESET']);
  near(poseAt(.605, { jump: 1 }).acts.hop, .6); near(poseAt(.605, { jump: .5 }).acts.hop, .3);
  assert.deepEqual(poseAt(.0137, { jump: .5 }).legs, poseAt(.0137, { jump: 1 }).legs, 'Jump scale leaves the walking gesture unchanged');
  assert.notDeepEqual(poseAt(.605, { jump: .5 }).legs, poseAt(.605, { jump: 1 }).legs, 'Jump scale changes airborne articulation');
  assert.ok(poseAt(.60, { display: 1 }).rates.fans[6] - poseAt(.60, { display: 0 }).rates.fans[6] > .25);
  assert.notDeepEqual(sample(2, { tempo: .025 }).legs, sample(2, { tempo: .10 }).legs);
});
test('240-phase input-corner sweep: exact links, contact locking, forward hind folds, raised toes and strict reach', () => {
  let locked = 0, airborne = 0; const acts = new Set();
  for (const input of corners) for (let i = 0; i < 240; i++) {
    const s = poseAt(i / 240, input), next = poseAt(i / 240 + 1e-7, input); finite(s); acts.add(s.act); locked += noSlip(s, next);
    for (const l of s.legs) {
      near(distance(l.root, l.hip), D.coxa); near(distance(l.hip, l.knee), l.upper); near(distance(l.knee, l.ankle), l.lower);
      nearPoint(l.ankle, l.foot.map((v, j) => v + (j === 1 ? D.ankle : 0)), 'upright ankle');
      assert.ok(l.reach > Math.abs(l.upper - l.lower) + .01 && l.reach < l.upper + l.lower - .01, `${l.id} reach ${l.reach}`);
      assert.ok(l.foot[1] >= D.sole - 1e-12); if (l.stance) near(l.foot[1], D.sole);
      assert.ok(l.ram.length > (l.hind ? .27 : .19), `ram sleeve overrun ${l.id}`);
      nearPoint(l.foot, next.legs.find(x => x.id === l.id).foot, 'continuous foot', 1e-4);
      if (s.act === 'CROUCH' && l.hind) { assert.ok(l.knee[2] < l.hip[2] - .25, 'hind knee must fold forward'); assert.ok(l.knee[1] > l.hip[1], 'hind knee must fold high'); }
    }
    if (s.acts.air > .999) { assert.equal(s.metrics.supportFeet, 0); assert.ok(s.legs.every(l => l.foot[1] > D.sole)); airborne++; }
    s.abdomen.forEach((seg, j) => { near(distance(seg.start, seg.end), D.abdomen[j]); if (j) nearPoint(seg.start, s.abdomen[j - 1].end, 'serial spine'); });
  }
  assert.equal(acts.size, 5); assert.ok(locked > 4000 && airborne > 100);
  for (const input of corners) for (const boundary of [0, .28, .40, .44, .46, .49, .53, .65, .72, .75, .78, .81, .86, .89, 1]) {
    const a = poseAt(boundary - 1e-7, input), b = poseAt(boundary + 1e-7, input);
    nearPoint(a.origin, b.origin, 'body seam', 1e-4); a.legs.forEach((l, i) => nearPoint(l.knee, b.legs[i].knee, 'knee seam', 1e-4));
  }
  const a = poseAt(.31), b = poseAt(.310001), bad = structuredClone(b); assert.equal(noSlip(a, b), 6);
  bad.legs.forEach(l => { l.foot[2] += b.origin[2] - a.origin[2]; }); assert.throws(() => noSlip(a, bad), /stance slips/);
  const preload = poseAt(.42, { jump: 1 }), flight = poseAt(.605, { jump: 1 });
  for (const l of flight.legs) {
    const grounded = preload.legs.find(x => x.id === l.id), delta = l.foot.map((v, i) => v - flight.origin[i]);
    const local = [0, 1, 2].map(col => delta.reduce((sum, v, row) => sum + v * flight.bodyFrame[row * 3 + col], 0));
    near(local[0], l.side * (l.hind ? .96 : .60)); near(local[2], l.hind ? 1.02 : [-.47, -.04][l.station] - .10);
    assert.ok(l.hind ? l.reach > grounded.reach + .35 : l.reach < grounded.reach - .08, `${l.id} must ${l.hind ? 'extend' : 'tuck'} during LEAP`);
  }
  for (const l of LEGS.filter(x => x.hind)) {
    const reach = p => poseAt(p, { jump: 1 }).legs.find(x => x.id === l.id).reach;
    assert.ok(reach(.42) < reach(.30) - .08, 'preload must flex the hind knee');
    assert.ok(reach(.80) < reach(.90) - .06, 'landing must compress the hind knee');
  }
});
test('SALTUS actual rendered geometry regression', async t => {
  const m = await descriptor.createModel();
  try {
    await t.test('node AND uploaded-instance rigid endpoints, level feet and telescoping attachments', () => {
      for (const input of corners) for (const p of phases) {
        const s = freeze(poseAt(p, input)); m.update(s, { quality: 'high', explode: 0 }); const items = instances(m);
        const member = (id, a, b, length) => {
          nearPoint(point(node(m, id).matrixWorld), a, `${id} node start`); nearPoint(point(node(m, id).matrixWorld, [0, length, 0]), b, `${id} node end`);
          const core = primitive(items, id, 'BoxGeometry', 0x26343d); nearPoint(point(core, [0, -.5, 0]), a, `${id} rendered start`); nearPoint(point(core, [0, .5, 0]), b, `${id} rendered end`);
        };
        for (const l of s.legs) {
          const id = `leg.${l.id}`; member(`${id}.coxa`, l.root, l.hip, D.coxa); member(`${id}.upper`, l.hip, l.knee, l.upper); member(`${id}.lower`, l.knee, l.ankle, l.lower);
          nearPoint(point(node(m, `${id}.foot`).matrixWorld), l.foot, 'level foot'); nearPoint(point(node(m, `${id}.ankle`).matrixWorld), l.ankle, 'raised ankle');
          nearPoint(point(primitive(items, `${id}.ankle`, 'SphereGeometry', 0xb28b4d)), l.ankle, 'rendered ankle');
          for (const [side, sign] of [['L', -1], ['R', 1]]) {
            const toe = primitive(items, `${id}.toe${side}`, 'SphereGeometry', 0xb28b4d), pivot = point(toe);
            nearPoint(pivot, l.foot.map((v, i) => v + [sign * .04, .09, -.04][i]), 'rendered raised toe pivot');
            assert.ok(pivot[1] - (l.foot[1] - D.sole) >= .1, 'toe pivot must stand above the sole');
          }
          const sole = primitive(items, `${id}.foot`, 'SphereGeometry', 0x18252a); nearPoint(point(sole, [0, .025 / .03, 0]), l.foot, 'rendered sole');
          nearPoint(new THREE.Vector3(0, 1, 0).transformDirection(node(m, `${id}.foot`).matrixWorld).toArray(), [0, 1, 0], 'level normal');
          const barrel = primitive(items, `${id}.ram.barrel`, 'CylinderGeometry', 0x26343d), piston = primitive(items, `${id}.ram.rod`, 'CylinderGeometry', 0x8b9da6), sleeve = l.hind ? .27 : .19;
          nearPoint(point(barrel, [0, -.5, 0]), l.ram.a, 'barrel mount'); near(distance(point(barrel, [0, -.5, 0]), point(barrel, [0, .5, 0])), sleeve, 2e-6);
          nearPoint(point(piston, [0, -.5, 0]), l.ram.a.map((v, j) => v + (l.ram.b[j] - v) * (sleeve - .025) / l.ram.length), 'gland'); nearPoint(point(piston, [0, .5, 0]), l.ram.b, 'rod end');
        }
        s.abdomen.forEach((seg, i) => member(`abdomen.${i + 1}`, seg.start, seg.end, seg.length));
        assert.deepEqual(m.group.matrix.elements, new THREE.Matrix4().elements);
      }
    });
    await t.test('actual vertices above floor in nine noncommensurate poses at every corner; positive transforms and compact bounds', () => {
      const total = new THREE.Box3();
      for (const input of corners) for (const p of phases) {
        m.update(poseAt(p, input), { quality: 'high' }); const items = instances(m);
        m.group.traverse(n => { finite(n.matrixWorld.elements); assert.ok(n.matrixWorld.determinant() > 0, n.name); });
        items.forEach(x => { finite(x.matrix.elements); assert.ok(x.matrix.determinant() > 0, x.id); });
        const b = bounds(items), size = b.getSize(new THREE.Vector3()); total.union(b);
        if (b.min.y < -.001) assert.fail(`floor ${p}: ${items.filter(x => bounds([x]).min.y < -.001).map(x => x.id)}`);
        assert.ok(size.x <= 4 && size.z <= 4 && b.max.y <= 3.7, `envelope at ${p}: ${size.toArray()} top ${b.max.y}`);
      }
      assert.ok(m.framePoints.length > 1000); m.framePoints.forEach(v => finite(v.toArray()));
      const framing = new THREE.Box3().setFromPoints(m.framePoints).expandByScalar(.12); assert.ok(framing.containsBox(total)); assert.ok(m.views.home[2] < 0 && m.views.home[0] > 0);
      console.log('SALTUS sampled vertex envelope', total.min.toArray(), total.max.toArray());
    });
    await t.test('substantial thigh, head, thorax, abdomen, cover and filled fan geometry', () => {
      m.update(poseAt(.6029), { quality: 'high' }); const items = instances(m);
      const size = id => bounds(items.filter(x => x.id === prefix + id), node(m, id).matrixWorld.clone().invert()).getSize(new THREE.Vector3()).toArray();
      const mass = (id, minima) => size(id).forEach((v, i) => assert.ok(v >= minima[i], `${id} ${i}: ${v} < ${minima[i]}`));
      mass('body', [.85, .50, 1]); mass('helmet', [.64, .64, .57]);
      for (const s of ['L', 'R']) {
        mass(`leg.${s}3.upper`, [.28, .70, .28]); mass(`leg.${s}3.upper-cover`, [.36, .54, .25]);
        mass(`wing.${s}.cover`, [.52, .15, 1.45]);
        for (let i = 1; i <= 7; i++) mass(`wing.${s}.fan${i}`, [.20, .84, .032]);
      }
      mass('abdomen.1.plate', [.66, .27, .34]); assert.ok(size('abdomen.8.plate')[0] < size('abdomen.1.plate')[0] * .35);
    });
    await t.test('unique meaningful parts survive low quality within triangle and batch budgets', () => {
      const ids = m.parts.map(p => p.id).sort(); assert.deepEqual(ids, expectedIds()); assert.equal(new Set(ids).size, ids.length); assert.ok(ids.length >= 160 && ids.length <= 230);
      assert.equal(new Set(m.parts.map(p => p.name)).size, ids.length);
      for (const p of m.parts) { assert.ok(p.function.length + p.how.length > 80); for (const field of ['name', 'system', 'detail', 'material', 'unit']) assert.ok(p[field].length > 3); }
      for (const quality of ['high', 'balanced', 'low']) {
        m.update(poseAt(.4313), { quality }); const used = new Set(), stats = { triangles: 0, instances: 0, drawCalls: 0 };
        for (const mesh of m.pickables) { if (mesh.count) stats.drawCalls++; stats.instances += mesh.count; stats.triangles += mesh.count * (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3; mesh.userData.instanceParts.slice(0, mesh.count).forEach(id => used.add(id)); }
        assert.deepEqual([...used].sort(), ids); for (const key in stats) near(stats[key], m.stats[key]);
        if (quality === 'low') assert.equal(stats.instances, 808, 'Efficient omits 36 fine reinforcement rails, not anatomy');
        assert.ok(stats.triangles <= 200000 && stats.drawCalls <= 40 && m.pickables.length <= 40); assert.equal(m.stats.selectableParts, ids.length);
        console.log(`SALTUS ${quality}`, { parts: ids.length, ...stats });
      }
    });
    await t.test('named rendered parent-relative amplitude gates reject frozen AND root-only controls', () => {
      m.update(poseAt(phases[0], { display: 1, jump: 1 }), { quality: 'high' }); const bind = bindings(m), specs = motionSpecs();
      const samples = phases.map(p => { m.update(poseAt(p, { display: 1, jump: 1 }), { quality: 'high' }); return frames(bind); });
      assert.equal(motionFailures(phases.map(() => samples[0]), specs).length, specs.length);
      const rootOnly = phases.map((p, i) => { const root = new THREE.Matrix4().makeRotationY(p * 2); root.setPosition(i * .3, Math.sin(p * TAU) * .3, -i * .2); return new Map([...samples[0]].map(([id, mat]) => [id, mat.clone().premultiply(root)])); });
      assert.equal(motionFailures(rootOnly, specs).length, specs.length); assert.deepEqual(motionFailures(samples, specs), []);
      const defaults = phases.map(p => { m.update(poseAt(p), { quality: 'high' }); return frames(bind); });
      assert.deepEqual(motionFailures(defaults, specs), [], 'Default playback must articulate every named subsystem');
    });
    await t.test('uploaded geometry remains continuous at cycle and choreography seams', () => {
      for (const input of corners) for (const phase of [0, .28, .46, .53, .65, .75, .86, 1]) {
        m.update(poseAt(phase - 1e-7, input), { quality: 'high' }); const before = snapshot(m);
        m.update(poseAt(phase + 1e-7, input), { quality: 'high' }); const after = snapshot(m);
        before.forEach((batch, i) => {
          assert.deepEqual(batch.ids, after[i].ids);
          batch.matrix.forEach((v, j) => near(v, after[i].matrix[j], 1e-4, `render seam ${phase}`));
        });
      }
    });
    await t.test('root and ancestor placement transform actual rigid endpoints exactly once', () => {
      const parent = new THREE.Group(), state = poseAt(.6029);
      parent.position.set(.4, .3, -.2); parent.rotation.set(.12, -.23, .07); parent.scale.setScalar(1.17);
      parent.add(m.group); m.group.position.set(-.2, .1, .3); m.group.rotation.set(.07, .13, -.09);
      m.update(state, { quality: 'high' }); const items = instances(m);
      for (const leg of state.legs) {
        const id = `leg.${leg.id}.upper`, core = primitive(items, id, 'BoxGeometry', 0x26343d);
        nearPoint(point(core, [0, -.5, 0]), point(m.group.matrixWorld, leg.hip), 'root and ancestor apply once');
        nearPoint(point(core, [0, .5, 0]), point(node(m, id).matrixWorld, [0, leg.upper, 0]), 'uploaded endpoint matches node');
      }
      parent.remove(m.group); m.group.position.set(0, 0, 0); m.group.rotation.set(0, 0, 0); m.update(state);
    });
    await t.test('explosion exactly returns, updates never mutate samples, disposal is once-only', () => {
      const state = freeze(sample(4.193)), saved = structuredClone(state); m.update(state, { quality: 'high', mode: 'solid', explode: 0 }); const original = snapshot(m);
      m.update(state, { quality: 'high' }); assert.deepEqual(snapshot(m), original);
      m.update(state, { quality: 'high', mode: 'xray', explode: .83 }); const exploded = snapshot(m); assert.notDeepEqual(exploded, original);
      m.update(state, { quality: 'high', mode: 'xray', explode: .83 }); assert.deepEqual(snapshot(m), exploded);
      m.update(state, { quality: 'low', mode: 'cutaway', explode: 1, selectedId: prefix + 'helmet' }); m.update(state, { quality: 'high', mode: 'solid', explode: 0 });
      assert.deepEqual(snapshot(m), original); assert.deepEqual(state, saved);
      for (const mesh of m.pickables) { assert.equal(mesh.material.transparent, false); assert.equal(mesh.material.opacity, 1); assert.deepEqual(mesh.material.clippingPlanes, []); }
      const resources = new Set(m.pickables.flatMap(mesh => [mesh, mesh.geometry, mesh.material])), calls = new Map();
      resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) ?? 0) + 1)));
      m.dispose(); m.dispose(); assert.doesNotThrow(() => m.update(state)); assert.equal(m.pickables.length, 0); assert.equal(m.group.children.length, 0);
      resources.forEach(r => assert.equal(calls.get(r), 1));
    });
  } finally { m.dispose(); }
});
