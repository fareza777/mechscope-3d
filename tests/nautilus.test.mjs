import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/nautilus/index.js';
import { DEFAULT_INPUTS, D, TAU, TENTACLES, inputsOf, cycleHz, poseAt, sample, distance, mv, add } from '../src/mechanisms/nautilus/kin.js';

const prefix = 'nautilus.', phases = [.0137, .0973, .2189, .3071, .4313, .5629, .6833, .7949, .9371];
const corners = [.025, .10].flatMap(tempo => [.65, 1.25].flatMap(reach => [0, 1].map(display => ({ tempo, reach, display }))));
const near = (a, b, eps = 1e-8, label = '') => assert.ok(Math.abs(a - b) <= eps, `${label}: ${a} != ${b}`);
const nearPoint = (a, b, label = '', eps = 3e-6) => near(distance(a, b), 0, eps, label);
function finite(v) { if (typeof v === 'number') assert.ok(Number.isFinite(v)); else if (v && typeof v === 'object') Object.values(v).forEach(finite); }
function close(a, b, eps = 1e-7) {
  if (typeof a === 'number') near(a, b, eps);
  else if (a && typeof a === 'object') { assert.deepEqual(Object.keys(a), Object.keys(b)); Object.keys(a).forEach(k => close(a[k], b[k], eps)); }
  else assert.equal(a, b);
}
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
const withoutTime = ({ t, ...s }) => s;
const node = (m, id) => { const n = m.group.getObjectByName(prefix + id); assert.ok(n, id); return n; };
const point = (matrix, p = [0, 0, 0]) => new THREE.Vector3(...p).applyMatrix4(matrix).toArray();
function instances(m) {
  return m.pickables.flatMap(mesh => Array.from({ length: mesh.count }, (_, i) => {
    assert.ok(mesh.isInstancedMesh); const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
    return { id: mesh.userData.instanceParts[i], mesh, i, matrix: matrix.premultiply(mesh.matrixWorld), geometry: mesh.geometry };
  }));
}
function bounds(items, reference = new THREE.Matrix4(), cornersOnly = false) {
  const b = new THREE.Box3(), v = new THREE.Vector3(), matrix = new THREE.Matrix4();
  for (const item of items) {
    matrix.multiplyMatrices(reference, item.matrix);
    if (cornersOnly) {
      item.geometry.computeBoundingBox(); const g = item.geometry.boundingBox;
      for (const x of [g.min.x, g.max.x]) for (const y of [g.min.y, g.max.y]) for (const z of [g.min.z, g.max.z]) b.expandByPoint(v.set(x, y, z).applyMatrix4(matrix));
    } else { const p = item.geometry.attributes.position; for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(matrix)); }
  }
  return b;
}
const snapshot = m => m.pickables.map(mesh => [mesh.userData.instanceParts.slice(0, mesh.count), Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)), Array.from(mesh.instanceColor.array.slice(0, mesh.count * 3))]);
function bindings(m) {
  const out = new Map();
  for (const item of instances(m)) if (!out.has(item.id)) out.set(item.id, { ...item, inverse: node(m, item.id.slice(prefix.length)).matrixWorld.clone().invert().multiply(item.matrix).invert() });
  return out;
}
function frames(bound) {
  return new Map([...bound].map(([id, b]) => {
    assert.equal(b.mesh.userData.instanceParts[b.i], id); const matrix = new THREE.Matrix4(); b.mesh.getMatrixAt(b.i, matrix);
    return [id.slice(prefix.length), matrix.premultiply(b.mesh.matrixWorld).multiply(b.inverse)];
  }));
}
function motionSpecs() {
  const specs = [], angle = (id, parent, min) => specs.push({ id, parent, min, kind: 'angle' });
  for (const { id } of TENTACLES) for (let j = 1; j <= 8; j++) angle(`tentacle${id}.link${j}`, j === 1 ? `tentacle${id}` : `tentacle${id}.link${j - 1}`, j === 1 ? .25 : .13);
  for (const side of ['L', 'R']) { angle(`shell.shutter${side}`, 'body', .16); angle(`eye${side}`, 'body', .55); angle(`eye${side}.optic`, `eye${side}`, .30); }
  angle('hood', 'body', .18); angle('siphon', 'body', .5); angle('siphon.nozzle', 'siphon', .4); angle('siphon.valve', 'siphon.nozzle', .45);
  angle('gyro', 'body', 2); angle('gyro.inner', 'gyro', 2); angle('gyro.rotor', 'gyro.inner', 2);
  for (const jaw of ['upper', 'lower']) angle(`beak${jaw}`, 'body', .20);
  for (let i = 1; i <= 8; i++) angle(`mantle.skirt${i}`, 'mantle', .13);
  for (let i = 1; i <= 6; i++) specs.push({ id: `pump${i}.piston`, parent: `pump${i}`, min: .10, kind: 'travel' });
  specs.push({ id: 'mantle', parent: 'body', min: .06, kind: 'scale' });
  return specs;
}
function failures(series, specs) {
  return specs.filter(spec => {
    const values = series.map(f => { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); f.get(spec.parent).clone().invert().multiply(f.get(spec.id)).decompose(p, q, s); return { p, q: q.normalize(), s }; });
    let range = 0;
    for (const a of values) for (const b of values) range = Math.max(range, spec.kind === 'angle' ? a.q.angleTo(b.q) : spec.kind === 'scale' ? a.s.distanceTo(b.s) : a.p.distanceTo(b.p));
    return range < spec.min;
  }).map(s => `${s.id}/${s.parent} ${s.kind} < ${s.min}`);
}

test('NAUTILUS descriptor, finite deterministic sampling and independent controls', () => {
  assert.deepEqual([descriptor.id, descriptor.title, descriptor.collection, descriptor.family], ['nautilus', 'NAUTILUS N12', '032', 'Mechanical Nautilus']);
  assert.deepEqual(descriptor.defaultInputs, DEFAULT_INPUTS); assert.equal(descriptor.sample, sample); assert.equal(descriptor.cycleHz, cycleHz);
  assert.deepEqual(descriptor.controls.map(c => [c.key, c.min, c.max, c.step, c.precision, c.unit]), [['tempo', .025, .10, .005, 3, 'Hz'], ['reach', .65, 1.25, .01, 2, '×'], ['display', 0, 1, .01, 2, '']]);
  assert.equal(descriptor.lessons.length, 5); descriptor.lessons.forEach(l => { assert.ok(l.text.length > 250 && l.fact.length > 60); });
  assert.equal(descriptor.specs.length, 2); descriptor.specs.forEach(s => assert.ok(s.label.length <= 12));
  for (const input of [...corners, DEFAULT_INPUTS]) for (const t of [-123.137, 0, .137, 7.913, 1 / input.tempo, 913.537]) {
    const s = sample(t, freeze(input)); finite(s); assert.deepEqual(sample(t, input), s); close(withoutTime(s), withoutTime(sample(t + 1 / input.tempo, input)));
  }
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, '0.05', '', false, {}, [], 1n, Symbol('scalar')]) {
    assert.deepEqual(inputsOf({ tempo: bad, reach: bad, display: bad }), DEFAULT_INPUTS); assert.deepEqual(sample(bad), sample(0)); assert.deepEqual(poseAt(bad), poseAt(0));
  }
  for (const bad of [null, NaN, false, 'bad', 1n, Symbol('input')]) assert.deepEqual(sample(.137, bad), sample(.137));
  for (const t of [-Number.MAX_VALUE, Number.MAX_VALUE, Number.MIN_VALUE]) finite(sample(t));
  assert.deepEqual(inputsOf({ tempo: -9, reach: -9, display: -9 }), { tempo: .025, reach: .65, display: 0 });
  assert.deepEqual(inputsOf({ tempo: 9, reach: 9, display: 9 }), { tempo: .10, reach: 1.25, display: 1 });
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => poseAt(.1 + i * .2).act), ['DRIFT', 'PROBE', 'GRASP', 'JET', 'RECOVER']);
  near(sample(0).metrics.cycleSeconds, 20); near(sample(0, { tempo: .025 }).metrics.cycleSeconds, 40);
  assert.notDeepEqual(sample(3.137, { tempo: .025 }).tentacles, sample(3.137, { tempo: .10 }).tentacles);
  close(poseAt(.277, { tempo: .025 }).tentacles, poseAt(.277, { tempo: .10 }).tentacles);
  const tip = s => s.tentacles[0].links.at(-1).end;
  assert.ok(distance(tip(poseAt(.5, { reach: .65 })), tip(poseAt(.5, { reach: 1.25 }))) > .20);
  assert.ok(poseAt(.3, { display: 1 }).rates.shutters[0] - poseAt(.3, { display: 0 }).rates.shutters[0] > .4);
});

test('240 phases at every input corner keep 96 rigid links raised, connected and smooth across the seam', () => {
  for (const input of corners) for (let i = 0; i < 240; i++) {
    const s = poseAt(i / 240, input); finite(s); assert.equal(s.tentacles.length, 12);
    for (const t of s.tentacles) {
      assert.equal(t.links.length, 8); let length = 0;
      t.links.forEach((l, j) => {
        near(l.length, .125); near(distance(l.start, l.end), .125, 1e-10); length += l.length;
        nearPoint(l.start, j ? t.links[j - 1].end : t.root, 'serial attachment', 1e-10);
        nearPoint(add(l.start, mv(l.frame, [0, D.length, 0])), l.end, 'positive-Y endpoint', 1e-10);
        near(l.radius, .065 - .03 * j / 7); assert.ok(Math.min(l.start[1], l.end[1]) - .085 > 0, 'conservative link ground clearance');
        for (const p of [l.start, l.end]) assert.ok(Math.abs(p[0]) + .085 < 1.8 && p[2] > -2.2 && p[2] < 1.5);
      }); near(length, 1);
    }
  }
  for (const input of corners) {
    const h = 1e-5, a = poseAt(-h, input), b = poseAt(0, input), c = poseAt(h, input);
    close(poseAt(0, input), poseAt(1, input));
    const coordinates = s => [...s.tentacles.flatMap(t => t.links.flatMap(l => [...l.start, ...l.end, ...l.frame])), ...s.rates.gyro.flat(), s.rates.mantle, s.rates.hood, ...s.rates.shutters, ...s.rates.pump];
    const av = coordinates(a), bv = coordinates(b), cv = coordinates(c);
    av.forEach((v, i) => near((bv[i] - v) / h, (cv[i] - bv[i]) / h, .06, 'seam velocity'));
  }
});

test('NAUTILUS uploaded geometry and lifecycle', async t => {
  const m = await descriptor.createModel();
  try {
    await t.test('node AND real cylinder endpoints follow every sampled rigid chain', () => {
      for (const input of corners) for (const phase of phases) {
        const s = poseAt(phase, input); m.update(s, { quality: 'high' });
        const cores = new Map(instances(m).filter(p => /\.link\d+$/.test(p.id) && p.geometry.type === 'CylinderGeometry' && p.mesh.material.color.getHex() === 0x236d70).map(p => [p.id, p]));
        assert.equal(cores.size, 96);
        for (const arm of s.tentacles) arm.links.forEach((l, i) => {
          const id = `tentacle${arm.id}.link${i + 1}`, n = node(m, id), core = cores.get(prefix + id);
          nearPoint(point(n.matrixWorld), l.start, `${id} node root`); nearPoint(point(n.matrixWorld, [0, D.length, 0]), l.end, `${id} node end`);
          nearPoint(point(core.matrix, [0, -.5, 0]), l.start, `${id} instance root`); nearPoint(point(core.matrix, [0, .5, 0]), l.end, `${id} instance end`);
        });
      }
    });
    await t.test('nine noncommensurate actual-vertex poses at all corners stay above ground and within width/length limits', () => {
      let minimum = Infinity, width = 0, length = 0;
      const envelope = new THREE.Box3().setFromPoints(m.framePoints);
      assert.ok(m.framePoints.length > 1000); assert.ok(envelope.min.y > 0); assert.equal(m.maxViewDistance, 24); assert.ok(m.views.home[2] < 0 && m.views.home[1] > 2);
      for (const input of corners) for (const phase of phases) {
        m.update(poseAt(phase, input)); const items = instances(m), b = bounds(items), size = b.getSize(new THREE.Vector3());
        minimum = Math.min(minimum, b.min.y); width = Math.max(width, size.x); length = Math.max(length, size.z);
        assert.ok(b.min.y > 0, `floor ${b.min.y}`); assert.ok(size.x < 3.6 && size.z < 4.2, `bounds ${size.toArray()}`);
        for (const p of items) { finite(p.matrix.elements); assert.ok(p.matrix.determinant() > 0, p.id); }
        m.group.traverse(n => { finite(n.matrixWorld.elements); assert.ok(n.matrixWorld.determinant() > 0, n.name); });
        const actualCorners = bounds(items, new THREE.Matrix4(), true);
        assert.ok(envelope.clone().expandByScalar(.04).containsBox(actualCorners), 'sampled geometry-corner envelope');
      }
      t.diagnostic(`Actual-vertex sweep: clearance ${minimum.toFixed(4)} m; width ${width.toFixed(4)} m; length ${length.toFixed(4)} m; ${m.framePoints.length} frame points`);
    });
    await t.test('thick filled shell, solid full plates, substantial tapered arms and 24 radial septa', () => {
      m.update(poseAt(.0137, { display: 0 })); const items = instances(m);
      const shell = items.filter(p => p.id === prefix + 'shell.core' || /shell\.shutter[LR]$/.test(p.id));
      const size = bounds(shell).getSize(new THREE.Vector3()); assert.ok(size.x >= .7 && size.y >= 1.7 && size.z >= 1.7 && size.z < 2);
      for (const id of ['shell.core', 'shell.shutterL', 'shell.shutterR']) {
        const domes = items.filter(p => p.id === prefix + id && p.geometry.type === 'SphereGeometry' && p.mesh.material.color.getHex() === 0xced5cf);
        assert.ok(domes.length >= (id === 'shell.core' ? 1 : 3));
        const d = bounds(domes, node(m, id).matrixWorld.clone().invert()).getSize(new THREE.Vector3()); assert.ok(d.x >= .30 && d.y > 1.7 && d.z > 1.7);
        const geometry = domes[0].geometry, vertices = geometry.attributes.position, indices = geometry.index;
        for (const yz of [[0, 0], [.3, .2], [-.3, -.2]]) {
          const ray = new THREE.Ray(new THREE.Vector3(-2, ...yz), new THREE.Vector3(1, 0, 0)), hits = [];
          const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), hit = new THREE.Vector3();
          for (let j = 0; j < indices.count; j += 3) {
            a.fromBufferAttribute(vertices, indices.getX(j)); b.fromBufferAttribute(vertices, indices.getX(j + 1)); c.fromBufferAttribute(vertices, indices.getX(j + 2));
            if (ray.intersectTriangle(a, b, c, false, hit)) hits.push(hit.x);
          }
          assert.ok(Math.min(...hits) < -.75 && Math.max(...hits) > .75, 'actual plate triangles enclose a broad filled cross-section, not a wire loop');
        }
      }
      assert.equal(m.parts.filter(p => /shell\.chamber\d+$/.test(p.id)).length, 24);
      for (const id of ['shell.spiralL', 'shell.spiralR']) assert.equal(items.filter(p => p.id === prefix + id).length, 128);
      const root = bounds(items.filter(p => p.id === prefix + 'tentacle01.link1'), node(m, 'tentacle01.link1').matrixWorld.clone().invert()).getSize(new THREE.Vector3());
      assert.ok(root.x >= .13 && root.z >= .12); assert.ok(!m.parts.some(p => /stand|pedestal/.test(p.name.toLowerCase())));
    });
    await t.test('complete metadata and all selectable geometry survive every quality within budgets', () => {
      const ids = m.parts.map(p => p.id).sort(); assert.ok(ids.length >= 150 && ids.length <= 240); assert.equal(new Set(ids).size, ids.length);
      assert.equal(new Set(m.parts.map(p => p.name)).size, ids.length);
      m.parts.forEach(p => { node(m, p.id.slice(prefix.length)); for (const key of ['name', 'system', 'function', 'how', 'detail', 'material', 'unit']) assert.ok(p[key]?.length > 3); assert.ok(p.function.length + p.how.length >= 80); });
      for (const quality of ['high', 'balanced', 'low']) {
        m.update(poseAt(.4313), { quality }); const actual = { instances: 0, triangles: 0, drawCalls: 0 }, used = new Set();
        for (const mesh of m.pickables) { actual.instances += mesh.count; actual.triangles += mesh.count * mesh.geometry.index.count / 3; actual.drawCalls += Number(mesh.count > 0); mesh.userData.instanceParts.slice(0, mesh.count).forEach(id => used.add(id)); }
        assert.deepEqual([...used].sort(), ids); for (const key of Object.keys(actual)) near(actual[key], m.stats[key]);
        assert.equal(m.stats.selectableParts, ids.length); assert.ok(actual.triangles <= 200000 && actual.drawCalls <= 40 && m.pickables.length <= 40);
        if (quality !== 'low') assert.ok(actual.instances >= 1400 && actual.instances <= 2200);
        t.diagnostic(`${quality}: ${ids.length} parts, ${actual.instances} instances, ${actual.triangles} triangles, ${actual.drawCalls} batches`);
      }
    });
    await t.test('frozen state, exact mode/quality/explosion roundtrip and no root transform double baking', () => {
      const s = freeze(sample(5.193)), saved = structuredClone(s); m.update(s, { quality: 'high' }); const original = snapshot(m);
      m.update(); assert.deepEqual(snapshot(m), original);
      m.update(s, { quality: 'high', explode: .83, mode: 'xray' }); const exploded = snapshot(m); assert.notDeepEqual(exploded, original);
      assert.ok(m.pickables.some(p => p.material.transparent && p.material.opacity === .13));
      m.update(s, { quality: 'high', explode: .83, mode: 'xray' }); assert.deepEqual(snapshot(m), exploded);
      m.update(s, { quality: 'low', explode: 1, mode: 'cutaway', selectedId: prefix + 'shell.core' }); assert.ok(m.pickables.every(p => p.material.clippingPlanes.length === 1));
      m.update(s, { quality: 'high' }); assert.deepEqual(snapshot(m), original); assert.deepEqual(s, saved);
      assert.ok(m.pickables.every(p => !p.material.transparent && p.material.opacity === 1 && p.material.clippingPlanes.length === 0));
      m.group.position.set(.3, .4, -.2); m.group.rotation.set(.1, -.2, .07); m.group.scale.setScalar(1.13); m.update(s);
      const core = instances(m).find(p => p.id === prefix + 'tentacle01.link1' && p.geometry.type === 'CylinderGeometry' && p.mesh.material.color.getHex() === 0x236d70);
      nearPoint(point(core.matrix, [0, -.5, 0]), point(m.group.matrixWorld, s.tentacles[0].root), 'external root applied once');
      nearPoint(point(core.matrix, [0, -.5, 0]), point(node(m, 'tentacle01.link1').matrixWorld), 'node/uploaded agreement under root transform');
      m.group.position.set(0, 0, 0); m.group.rotation.set(0, 0, 0); m.group.scale.setScalar(1); m.update(s, { quality: 'high' }); assert.deepEqual(snapshot(m), original);
    });
    await t.test('named real-instance parent-relative motion at 1x rejects frozen and root-only controls', () => {
      m.update(poseAt(phases[0]), { quality: 'high' }); const bound = bindings(m), specs = motionSpecs();
      const series = phases.map(p => { m.update(sample(p * 20), { quality: 'high' }); return frames(bound); });
      assert.ok(specs.length >= 8); assert.equal(failures(phases.map(() => series[0]), specs).length, specs.length);
      const rootOnly = phases.map((p, i) => { const matrix = new THREE.Matrix4().makeRotationY(p * TAU); matrix.setPosition(i * .17, .1 * i, -.13 * i); return new Map([...series[0]].map(([id, f]) => [id, f.clone().premultiply(matrix)])); });
      assert.equal(failures(rootOnly, specs).length, specs.length); assert.deepEqual(failures(series, specs), []);
      t.diagnostic(`${specs.length} named parent-relative motion gates passed at default inputs`);
    });
    await t.test('idempotent disposal releases each shared resource once', () => {
      const resources = new Set(m.pickables.flatMap(p => [p, p.geometry, p.material])), counts = new Map();
      resources.forEach(r => r.addEventListener('dispose', () => counts.set(r, (counts.get(r) ?? 0) + 1)));
      m.dispose(); m.dispose(); assert.doesNotThrow(() => m.update(freeze(sample(1)))); assert.equal(m.pickables.length, 0); assert.equal(m.group.children.length, 0);
      resources.forEach(r => assert.equal(counts.get(r), 1));
    });
  } finally { m.dispose(); }
});
