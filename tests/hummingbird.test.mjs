import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/hummingbird/index.js';
import { createModel } from '../src/mechanisms/hummingbird/model.js';
import { D, TAU, DATUM, DEFAULT_INPUTS, cycleHz, inputsOf, poseAt, sample, solveShoulder, featherSpec } from '../src/mechanisms/hummingbird/kin.js';

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
    m.getMatrixAt(i, matrix); assert.ok(matrix.determinant() > 0);
    for (let j = 0; j < m.geometry.attributes.position.count; j++) b.expandByPoint(p.fromBufferAttribute(m.geometry.attributes.position, j).applyMatrix4(matrix));
  }
  return b;
}
// Capsules follow the ACTUAL rendered quill/rail cylinders, including the
// aimed feather frame and the animated twist.
function capsule(primitive) {
  assert.equal(primitive.type, 'CylinderGeometry');
  return { id: primitive.id, a: endpoint(primitive, -.5), b: endpoint(primitive, .5), radius: primitive.half[0] };
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
function capsuleGap(a, b) {
  const gap = segmentDistance(a, b) - a.radius - b.radius;
  assert.ok(gap > 0, `capsule clearance violated: ${a.id} / ${b.id} (${(gap * 1000).toFixed(3)} mm)`);
  return gap;
}

test('ALULA H2 descriptor, bounded controls, five substantial lessons and lazy model', async () => {
  assert.equal(descriptor.id, 'hummingbird'); assert.equal(descriptor.title, 'ALULA H2'); assert.equal(descriptor.collection, '014');
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const c of descriptor.controls) { assert.ok(c.key in DEFAULT_INPUTS); assert.ok(c.min < c.max && c.step > 0); assert.ok(Number.isInteger(c.precision)); assert.ok(c.label && c.unit); }
  for (const s of descriptor.specs) assert.ok(s.label.length <= 12);
  for (const l of descriptor.lessons) { assert.ok(l.text.length >= 180 && l.fact.length >= 35 && l.short.length > 4); assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1); }
  assert.match(descriptor.description, /not a flight/); assert.deepEqual(descriptor.sample(.3), sample(.3));
  const model = await descriptor.createModel(); assert.ok(model.group.isGroup && model.pickables.length); model.dispose();
});

test('all control corners and 720 crank phases preserve exact shoulder, spar, feather and claw lengths', () => {
  for (const cadence of [.15, 1]) for (const stroke of [18, 28, 38]) for (let i = 0; i < 720; i++) {
    const p = poseAt(i * TAU / 720, { cadence, stroke }); finite(p); assert.equal(p.wings.length, 2);
    for (const w of p.wings) {
      near(distance(w.crank, D.crank), stroke / 1000); near(Math.hypot(...w.rocker), D.rocker); near(distance(w.crank, w.rocker), D.conrod);
      near(w.flap, Math.atan2(w.rocker[1], w.rocker[0]) - DATUM);
      near(distance(w.origin, w.elbow), D.upper); near(distance(w.elbow, w.wrist), D.fore);
      assert.equal(w.feathers.length, 16);
      for (const f of w.feathers) near(distance(f.start, f.end), featherSpec(f.layer, f.i, w.side).length);
    }
    near(p.wings[0].flap, p.wings[1].flap);
    p.wings[0].feathers.forEach((f, j) => { const other = p.wings[1].feathers[j]; near(f.end[0], -other.end[0]); near(f.end[1], other.end[1]); near(f.end[2], other.end[2]); });
    p.tail.forEach(t => near(distance(t.start, t.end), t.length)); p.claws.forEach(c => D.claw.forEach((l, j) => near(distance(c.points[j], c.points[j + 1]), l)));
    assert.ok(p.metrics.closureMm < 1e-9);
  }
});

test('pure finite sampler is reversible and periodic, with both controls visibly effective', () => {
  for (const cadence of [.15, 1]) for (const stroke of [18, 38]) for (const t of [-999, -1.234, 0, .41, 17, 100000]) {
    const a = sample(t, { cadence, stroke }), b = sample(t + 1 / cadence, { cadence, stroke }); finite(a); assert.ok(a.phase >= 0 && a.phase < 1);
    assert.ok(Object.values(a.metrics).slice(0, 3).every(Number.isFinite)); sample(t + 23); assert.deepEqual(sample(t, { cadence, stroke }), a);
    a.wings.forEach((w, j) => w.feathers.forEach((f, k) => near(distance(f.end, b.wings[j].feathers[k].end), 0, 1e-8)));
    a.tail.forEach((x, j) => near(distance(x.end, b.tail[j].end), 0, 1e-8)); near(cycleHz({ cadence }), cadence);
  }
  for (const t of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) for (const input of [null, {}, { cadence: NaN, stroke: Infinity }, { cadence: -9, stroke: 999 }]) finite(sample(t, input));
  assert.deepEqual(inputsOf({ cadence: -2, stroke: 900 }), { cadence: .15, stroke: 38 });
  const excursion = stroke => { const a = Array.from({ length: 360 }, (_, i) => solveShoulder(i * TAU / 360, stroke).flap); return Math.max(...a) - Math.min(...a); };
  assert.ok(excursion(38) > excursion(18) * 1.9);
  assert.ok(distance(sample(.41, { cadence: .15 }).wings[0].feathers[15].end, sample(.41, { cadence: 1 }).wings[0].feathers[15].end) > .08);
  near(distance(sample(-1e-8).tail[3].end, sample(1e-8).tail[3].end), 0, 1e-7);
});

test('rendered conrod, feather, arm and claw endpoints match independently sampled positions throughout a sweep', () => using(model => {
  for (const stroke of [18, 38]) for (let k = 0; k < 96; k++) {
    const s = poseAt(k * TAU / 96, { stroke }); model.update(s);
    const ps = primitives(model, id => id.includes('.conrod') || id.endsWith('.rib') || id.endsWith('.upper') || id.endsWith('.fore') || /^claw\.-?1\.[012]$/.test(id));
    for (const w of s.wings) {
      const prefix = `wing.${w.id}`, root = model.group.getObjectByName(`${prefix}.housing`);
      const link = ps.find(p => p.id === `${prefix}.conrod` && p.type === 'CylinderGeometry' && p.color === 0x8b9da6);
      for (const [v, y] of [[w.crank, -.5], [w.rocker, .5]]) near(endpoint(link, y).distanceTo(new THREE.Vector3(v[0], v[1], D.rodPlane).applyMatrix4(root.matrixWorld)), 0, 2e-7);
      near(endpoint(link, -.5).distanceTo(endpoint(link, .5)), D.conrod, 2e-7);
      for (const [suffix, a, b] of [['upper', w.origin, w.elbow], ['fore', w.elbow, w.wrist]]) {
        const rails = ps.filter(p => p.id === `${prefix}.${suffix}` && p.type === 'CylinderGeometry' && p.color === 0x8b9da6);
        assert.equal(rails.length, 2);
        const start = endpoint(rails[0], -.5).add(endpoint(rails[1], -.5)).multiplyScalar(.5), end = endpoint(rails[0], .5).add(endpoint(rails[1], .5)).multiplyScalar(.5);
        near(distance(start.toArray(), a), 0, 2e-7); near(distance(end.toArray(), b), 0, 2e-7);
      }
      for (const f of w.feathers) {
        const spine = ps.find(p => p.id === `${prefix}.${f.layer}.${f.i + 1}.rib` && p.type === 'CylinderGeometry' && p.color === 0x26343d);
        near(distance(endpoint(spine, -.5).toArray(), f.start), 0, 2e-7); near(distance(endpoint(spine, .5).toArray(), f.end), 0, 2e-7);
      }
    }
    s.tail.forEach((t, i) => { const spine = ps.find(p => p.id === `tail.${i}.rib` && p.type === 'CylinderGeometry' && p.color === 0x26343d); near(distance(endpoint(spine, .5).toArray(), t.end), 0, 2e-7); });
    s.claws.forEach(c => D.claw.forEach((length, j) => { const rails = ps.filter(p => p.id === `claw.${c.side}.${j}` && p.type === 'CylinderGeometry' && p.color === 0x8b9da6 && Math.abs(p.half[1] * 2 - length) < 1e-6); assert.equal(rails.length, 2); near(distance(endpoint(rails[0], .5).add(endpoint(rails[1], .5)).multiplyScalar(.5).toArray(), c.points[j + 1]), 0, 2e-7); }));
  }
}));

test('rendered swept rod/disk clearance and full journal engagement, with a real disk penetration negative control', () => using(model => {
  let negative = 0;
  for (const cadence of [.15, 1]) for (const stroke of [18, 38]) for (let k = 0; k < 180; k++) {
    const s = poseAt(k * TAU / 180, { cadence, stroke }); model.update(s);
    const ps = primitives(model, id => /^wing\.[LR]\.(conrod|disk|eccentric|rocker|housing)$/.test(id));
    for (const w of s.wings) {
      const own = suffix => ps.filter(p => p.id === `wing.${w.id}.${suffix}`), rods = own('conrod'), disks = own('disk');
      for (const r of rods) for (const disk of disks) assert.ok(separated(r, disk), `rod/disk contact at ${k}, ${stroke}`);
      const bushes = rods.filter(p => p.type === 'CylinderGeometry' && p.color === 0xb28b4d);
      const pins = [...own('eccentric'), ...own('rocker')].filter(p => p.type === 'CylinderGeometry' && p.color === 0xb28b4d);
      assert.equal(bushes.length, 2); assert.equal(pins.length, 2);
      bushes.forEach((b, j) => {
        const a = endpoint(pins[j], -.5), end = endpoint(pins[j], .5), axis = end.clone().sub(a).normalize(), delta = b.center.clone().sub(a);
        near(delta.clone().cross(axis).length(), 0, 2e-7); near(Math.abs(axis.dot(b.axes[1])), 1, 1e-6);
        assert.ok(delta.dot(axis) - b.half[1] >= -1e-7 && delta.dot(axis) + b.half[1] <= a.distanceTo(end) + 1e-7);
      });
      const rail = rods.find(p => p.type === 'CylinderGeometry' && p.color === 0x8b9da6), disk = disks.find(p => p.type === 'CylinderGeometry' && p.color === 0xb28b4d);
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(model.group.getObjectByName(`wing.${w.id}.housing`).matrixWorld);
      if (insideConvex(disk, endpoint(rail, -.42).addScaledVector(normal, -D.rodPlane))) negative++;
    }
  }
  assert.ok(negative > 0, 'moving the actual rail into the crank plane must penetrate a disk');
}));

test('actual feather lattice stays clear of thorax, and all rendered geometry remains above the floor inside 3 m', () => using(model => {
  for (const stroke of [18, 38]) for (let k = 0; k < 48; k++) {
    model.update(poseAt(k * TAU / 48, { stroke }));
    const ps = primitives(model, id => id.startsWith('thorax.') || id.startsWith('motor.') || (id.startsWith('wing.') && id.endsWith('.rib')));
    const feathers = ps.filter(p => p.id.startsWith('wing.')), body = ps.filter(p => !p.id.startsWith('wing.'));
    for (const f of feathers) for (const b of body) assert.ok(separated(f, b), `${f.id} touches ${b.id}`);
    if (k % 4 === 0) { const b = bounds(model); near(b.min.y, 0, 1e-7); assert.ok(b.max.y <= 2.05, `height ${b.max.y}`); assert.ok(b.max.x - b.min.x <= 3); assert.ok(b.max.z - b.min.z < 1.8); }
  }
}));

test('same-wing adjacent feather quills and 3.4 mm vein rails keep swept capsule clearance, with an intentional overlap rejected', () => using(model => {
  let quillGap = Infinity, railGap = Infinity, crossGap = Infinity, pair = null;
  const quill = ps => ps.filter(p => p.type === 'CylinderGeometry' && p.color === 0x26343d && Math.abs(p.half[0] - .0045) < 1e-6).map(capsule);
  const vein = ps => ps.filter(p => p.type === 'CylinderGeometry' && p.color === 0x8b9da6 && Math.abs(p.half[0] - .0034) < 1e-6).map(capsule);
  for (const stroke of [18, 38]) for (let k = 0; k < 48; k++) {
    model.update(poseAt(k * TAU / 48, { stroke }));
    const ps = primitives(model, id => /^wing\.[LR]\.(primary|secondary)\.\d+\.rib$/.test(id));
    for (const wing of ['L', 'R']) for (const layer of ['primary', 'secondary']) {
      const count = layer === 'primary' ? 9 : 7;
      const feathers = Array.from({ length: count }, (_, j) => ps.filter(p => p.id === `wing.${wing}.${layer}.${j + 1}.rib`));
      for (const f of feathers) { assert.equal(quill(f).length, 1); assert.equal(vein(f).length, 8); }
      for (let i = 0; i < count - 1; i++) {
        const quillsA = quill(feathers[i]), quillsB = quill(feathers[i + 1]), veinsA = vein(feathers[i]), veinsB = vein(feathers[i + 1]);
        for (const a of quillsA) for (const b of quillsB) quillGap = Math.min(quillGap, capsuleGap(a, b));
        for (const a of veinsA) for (const b of veinsB) railGap = Math.min(railGap, capsuleGap(a, b));
        for (const a of veinsA) for (const b of quillsB) crossGap = Math.min(crossGap, capsuleGap(a, b));
        for (const a of quillsA) for (const b of veinsB) crossGap = Math.min(crossGap, capsuleGap(a, b));
        if (!pair) pair = { a: quillsA[0], b: quillsB[0] };
      }
    }
  }
  assert.ok(quillGap >= .002, `quill gap ${quillGap}`); assert.ok(railGap >= .001, `rail gap ${railGap}`); assert.ok(crossGap >= .001, `rail/quill gap ${crossGap}`);
  assert.ok(pair, 'adjacent feather pair sampled');
  const overlap = { ...pair.b, a: pair.a.a.clone(), b: pair.a.b.clone() };
  assert.throws(() => capsuleGap(pair.a, overlap), /capsule clearance/);
  console.log(`ALULA H2 feather capsules: quill ${(quillGap * 1000).toFixed(2)} mm, rail/rail ${(railGap * 1000).toFixed(2)} mm, rail/quill ${(crossGap * 1000).toFixed(2)} mm`);
}));

test('metadata reaches low geometry and measured buffers/counters meet balanced and low budgets', () => using(model => {
  const ids = new Set(model.parts.map(p => p.id)); assert.equal(ids.size, model.parts.length); assert.equal(new Set(model.parts.map(p => p.name)).size, ids.size); assert.ok(ids.size >= 100 && ids.size <= 200);
  for (const p of model.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[key] === 'string' && p[key].length > 2);
  assert.equal(model.parts.filter(p => /^wing\..*\.rib$/.test(p.id)).length, 32);
  assert.deepEqual(model.group.position.toArray(), [0, 0, 0]); assert.deepEqual(model.group.scale.toArray(), [1, 1, 1]);
  for (const quality of ['balanced', 'low']) {
    model.update(sample(.23), { quality }); const used = new Set(); let instances = 0, triangles = 0, calls = 0;
    for (const m of model.pickables) {
      if (m.count) calls++; instances += m.count; triangles += m.count * m.geometry.index.count / 3;
      finite(Array.from(m.geometry.attributes.position.array));
      for (const ix of m.geometry.index.array) assert.ok(ix < m.geometry.attributes.position.count);
      for (let i = 0; i < m.count; i++) { assert.ok(ids.has(m.userData.instanceParts[i])); used.add(m.userData.instanceParts[i]); }
    }
    assert.equal(used.size, ids.size); assert.deepEqual(model.stats, { instances, triangles, drawCalls: calls, selectableParts: ids.size });
    assert.ok(calls <= 32); assert.ok(triangles <= (quality === 'low' ? 80000 : 135000), `${quality}: ${triangles}`);
    if (quality === 'balanced') { assert.ok(triangles >= 70000); assert.ok(instances >= 1000 && instances <= 2200); console.log('ALULA H2 balanced', model.stats); } else console.log('ALULA H2 low', model.stats);
  }
}));

test('poses change; explosion, quality, selection and all material modes reverse exactly from bind transforms', () => using(model => {
  const s = sample(.37), immutable = structuredClone(s); model.update(s); const original = snapshot(model);
  model.update(sample(.91)); assert.notDeepEqual(snapshot(model), original);
  for (let k = 0; k < 3; k++) {
    model.update(s, { explode: .83, mode: 'xray', quality: 'low', selectedId: 'wing.L.primary.9.rib' }); assert.notDeepEqual(snapshot(model), original);
    for (const m of model.pickables) { const shell = m.material.color.getHex() === 0xced5cf; assert.equal(m.material.transparent, shell); near(m.material.opacity, shell ? .13 : 1); assert.equal(m.material.depthWrite, !shell); }
    model.update(s, { explode: .35, mode: 'cutaway' }); for (const m of model.pickables) { assert.equal(m.material.clippingPlanes.length, 1); assert.equal(m.material.side, THREE.DoubleSide); assert.equal(m.material.forceSinglePass, true); }
    model.update(s); assert.deepEqual(snapshot(model), original);
  }
  model.update({ driveAngle: s.driveAngle }); assert.deepEqual(snapshot(model), original); model.update(undefined); assert.deepEqual(snapshot(model), original); assert.deepEqual(s, immutable);
  model.update(s, { selectedId: 'wing.L.primary.9.rib' }); const color = new THREE.Color(); let selected = 0;
  for (const m of model.pickables) { assert.equal(m.material.side, THREE.FrontSide); assert.equal(m.material.clippingPlanes.length, 0); assert.equal(m.material.transparent, false);
    for (let i = 0; i < m.count; i++) { m.getColorAt(i, color); const on = m.userData.instanceParts[i] === 'wing.L.primary.9.rib'; assert.equal(color.getHex() !== 0xffffff, on); selected += Number(on); }
  }
  assert.ok(selected > 0); assert.deepEqual(snapshot(model), original);
  model.update(sample(s.t + 1 / cycleHz())); const periodic = snapshot(model);
  original.forEach((p, j) => p.matrices.forEach((v, i) => near(v, periodic[j].matrices[i], 2e-7)));
}));

test('animation never reallocates geometry and idempotent disposal releases each used resource once', () => {
  const model = createModel(), meshes = model.pickables, resources = new Set(meshes.flatMap(m => [m, m.geometry, m.material])), calls = new Map();
  const arrays = meshes.map(m => m.geometry.attributes.position.array), saved = arrays.map(a => a.slice()), matrices = meshes.map(m => m.instanceMatrix.array);
  resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) || 0) + 1)));
  for (let i = 0; i < 48; i++) model.update(sample(i * .039), { explode: i % 2 ? .7 : 0, quality: i % 3 ? 'balanced' : 'low' });
  model.pickables.forEach((m, i) => { assert.equal(m.geometry.attributes.position.array, arrays[i]); assert.equal(m.instanceMatrix.array, matrices[i]); assert.deepEqual(arrays[i], saved[i]); finite(Array.from(m.instanceMatrix.array)); });
  model.dispose(); model.dispose(); model.update(sample(2)); resources.forEach(r => assert.equal(calls.get(r), 1)); assert.equal(model.group.children.length, 0); assert.equal(model.pickables.length, 0);
});
