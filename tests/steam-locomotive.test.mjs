import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/steam-locomotive/index.js';
import { createModel } from '../src/mechanisms/steam-locomotive/model.js';
import { D, TAU, DEFAULT_INPUTS, inputsOf, cycleHz, sample, poseAt } from '../src/mechanisms/steam-locomotive/kin.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const finite = x => { if (typeof x === 'number') assert.ok(Number.isFinite(x)); else if (x && typeof x === 'object') Object.values(x).forEach(finite); };
const withModel = fn => { const m = createModel(); try { fn(m); } finally { m.dispose(); } };
const snapshot = m => m.pickables.map(b => ({ ids: b.userData.instanceParts.slice(0, b.count), matrix: Array.from(b.instanceMatrix.array.slice(0, b.count * 16)) }));
function primitives(model, accepts = () => true) {
  const result = [];
  for (const mesh of model.pickables) {
    mesh.geometry.computeBoundingBox(); const box = mesh.geometry.boundingBox;
    for (let i = 0; i < mesh.count; i++) {
      const id = mesh.userData.instanceParts[i]; if (!accepts(id)) continue;
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(i, matrix);
      const axes = [0, 1, 2].map(k => new THREE.Vector3().setFromMatrixColumn(matrix, k));
      const half = box.getSize(new THREE.Vector3()).multiplyScalar(.5).toArray().map((v, k) => v * axes[k].length());
      axes.forEach(a => a.normalize());
      result.push({ id, matrix, axes, half, center: box.getCenter(new THREE.Vector3()).applyMatrix4(matrix), geometry: mesh.geometry, type: mesh.geometry.type, color: mesh.material.color.getHex() });
    }
  }
  return result;
}
function separated(a, b, gap = 1e-6) {
  const delta = b.center.clone().sub(a.center);
  if (delta.length() > Math.hypot(...a.half) + Math.hypot(...b.half) + gap) return true;
  const separates = axis => {
    const length = axis.length(); if (length < 1e-8) return false;
    const radius = p => p.half.reduce((sum, h, i) => sum + h * Math.abs(p.axes[i].dot(axis)), 0);
    return Math.abs(delta.dot(axis)) > radius(a) + radius(b) + gap * length;
  };
  return [...a.axes, ...b.axes].some(separates) || a.axes.some(x => b.axes.some(y => separates(new THREE.Vector3().crossVectors(x, y))));
}
function insideConvex(primitive, point) {
  const q = point.clone().applyMatrix4(primitive.matrix.clone().invert()), positions = primitive.geometry.attributes.position, index = primitive.geometry.index;
  for (let i = 0; i < index.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(positions, index.getX(i + 2));
    const normal = b.sub(a).cross(c.sub(a));
    if (normal.lengthSq() > 1e-15 && normal.normalize().dot(q.clone().sub(a)) >= -1e-6) return false;
  }
  return true;
}
function bounds(model) {
  const box = new THREE.Box3(), p = new THREE.Vector3();
  for (const item of primitives(model)) {
    assert.ok(item.matrix.determinant() > 0);
    for (let i = 0; i < item.geometry.attributes.position.count; i++) box.expandByPoint(p.fromBufferAttribute(item.geometry.attributes.position, i).applyMatrix4(item.matrix));
  }
  return box;
}
const torus = p => p.type === 'TorusGeometry';
const brassCylinder = p => p.type === 'CylinderGeometry' && p.geometry.parameters.radialSegments === 12 && p.color === 0xb28b4d;
function engages(shaft, bush) {
  const a = new THREE.Vector3(0, -.5, 0).applyMatrix4(shaft.matrix), b = new THREE.Vector3(0, .5, 0).applyMatrix4(shaft.matrix);
  const axis = b.clone().sub(a).normalize(), d = bush.center.clone().sub(a), extent = bush.half[1];
  near(d.clone().cross(axis).length(), 0, 3e-7);
  assert.ok(d.dot(axis) - extent >= -3e-7 && d.dot(axis) + extent <= a.distanceTo(b) + 3e-7);
}

test('TITAN descriptor, two controls, five lessons and lazy factory satisfy the contract', async () => {
  assert.equal(descriptor.id, 'steam-locomotive'); assert.equal(descriptor.collection, '018'); assert.equal(descriptor.title, 'TITAN S6');
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const c of descriptor.controls) { assert.ok(c.key in DEFAULT_INPUTS && c.min < c.max && c.step > 0); assert.ok(c.label && c.unit && Number.isInteger(c.precision)); }
  for (const s of descriptor.specs) assert.ok(s.label.length <= 12);
  for (const l of descriptor.lessons) {
    assert.ok(l.title && l.short && l.text.length >= 180 && l.fact.length >= 35);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  assert.match(descriptor.description, /stationary/); assert.deepEqual(descriptor.sample(.3), sample(.3));
  const model = await descriptor.createModel(); assert.ok(model.group.isGroup && model.pickables.length); model.dispose();
});

test('quartered wheelsets and exact piston/valve/coupling rods close at all control corners', () => {
  for (const cadence of [.08, .35, .8]) for (const advance of [-15, 22, 45]) for (let n = 0; n < 720; n++) {
    const s = poseAt(n * TAU / 720, { cadence, advance }); finite(s);
    near(s.sides[1].theta - s.sides[0].theta, Math.PI / 2);
    for (const side of s.sides) {
      near(distance(side.crank, side.crosshead), D.conrod); near(distance(side.eccentricPin, side.valve), D.valveLength);
      near(side.crosshead[1], D.axleY); near(side.valve[1], D.valveY);
      near(distance(side.crosshead, side.piston), D.pistonOffset);
      near(Math.hypot(side.eccentricPin[0] - D.axles[0], side.eccentricPin[1] - D.axleY), D.eccentric);
      side.pins.forEach((pin, i) => { near(Math.hypot(pin[0] - D.axles[i], pin[1] - D.axleY), D.crank); if (i) near(distance(pin, side.pins[i - 1]), D.pitch); });
      assert.ok(side.piston[0] >= -1.551 && side.piston[0] <= -1.269);
    }
    assert.ok(s.metrics.closureErrorMm < 1e-9); near(s.metrics.translationM, 0);
  }
  const a = poseAt(.3, { advance: -15 }), b = poseAt(.3, { advance: 45 });
  assert.deepEqual(a.sides[0].crank, b.sides[0].crank); assert.ok(distance(a.sides[0].valve, b.sides[0].valve) > .02);
  assert.notDeepEqual(sample(.7, { cadence: .08 }).sides, sample(.7, { cadence: .8 }).sides);
});

test('pure sampler remains finite, deterministic and periodic for negative time and malformed inputs', () => {
  for (const cadence of [.08, .8]) for (const advance of [-15, 45]) for (const t of [-777, -1.24, 0, .2, 99, 100000]) {
    const input = Object.freeze({ cadence, advance }), a = sample(t, input); finite(a); assert.ok(a.phase >= 0 && a.phase < 1);
    sample(900, {}); assert.deepEqual(a, sample(t, input)); near(cycleHz(input), cadence);
    const b = sample(t + 1 / cycleHz(input), input);
    for (let i = 0; i < 2; i++) for (const key of ['crank', 'crosshead', 'valve', 'piston']) near(distance(a.sides[i][key], b.sides[i][key]), 0, 2e-9);
    assert.ok(Object.values(a.metrics).slice(0, 3).every(Number.isFinite));
  }
  for (const t of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) for (const input of [null, {}, { cadence: NaN, advance: Infinity }, { cadence: -8, advance: 999 }]) finite(sample(t, input));
  assert.deepEqual(inputsOf({ cadence: -8, advance: 999 }), { cadence: .08, advance: 45 });
  near(distance(sample(-1e-8).sides[0].crosshead, sample(1e-8).sides[0].crosshead), 0, 1e-7);
});

test('rendered eye centers and continuous extended journals agree with the solved endpoints', () => withModel(model => {
  for (const advance of [-15, 45]) for (let n = 0; n < 32; n++) {
    const state = poseAt(n * TAU / 32, { advance }); model.update(state);
    const all = primitives(model, id => /^(coupling|conrod|valverod|crankpin|crosshead|eccentric|piston)\./.test(id));
    for (const s of state.sides) {
      const own = id => all.filter(p => p.id === id);
      for (const [id, endpoints, length] of [[`conrod.${s.id}`, [s.crank, s.crosshead], D.conrod], [`valverod.${s.id}`, [s.eccentricPin, s.valve], D.valveLength], ...[0, 1].map(i => [`coupling.${s.id}.${i}`, [s.pins[i], s.pins[i + 1]], D.pitch])]) {
        const eyes = own(id).filter(torus); assert.equal(eyes.length, 2);
        near(eyes[0].center.distanceTo(eyes[1].center), length, 3e-7);
        eyes.forEach((eye, i) => near(distance(eye.center.toArray(), endpoints[i]), 0, 3e-7));
      }
      const shafts = [0, 1, 2].map(i => own(`crankpin.${i}.${s.side}`).find(brassCylinder));
      const mainBush = own(`conrod.${s.id}`).filter(brassCylinder)[0]; engages(shafts[0], mainBush);
      for (let i = 0; i < 2; i++) own(`coupling.${s.id}.${i}`).filter(brassCylinder).forEach((b, j) => engages(shafts[i + j], b));
      const piston = own(`piston.${s.id}`).find(p => brassCylinder(p)); near(distance(piston.center.toArray(), s.piston), 0, 3e-7);
      const valveBush = own(`valverod.${s.id}`).filter(brassCylinder)[0]; engages(own(`eccentric.${s.id}`).find(brassCylinder), valveBush);
    }
  }
}));

test('actual rod plates sweep clear of all wheel faces, frame girders and neighboring axial lanes', () => withModel(model => {
  let poses = 0;
  for (const advance of [-15, 45]) for (let n = 0; n < 240; n++) {
    model.update(poseAt(n * TAU / 240, { advance }));
    const all = primitives(model, id => /^(wheel|counterweight|frame|coupling|conrod|valverod)\./.test(id));
    const wheelsAndFrame = all.filter(p => /^(wheel|counterweight|frame)\./.test(p.id));
    const plates = all.filter(p => /^(coupling|conrod|valverod)\./.test(p.id));
    for (const p of plates) for (const o of wheelsAndFrame) assert.ok(separated(p, o), `${p.id}/${p.type} hits ${o.id}/${o.type} at ${n}`);
    for (const p of plates.filter(p => p.id.startsWith('conrod.'))) for (const o of plates.filter(p => /^(coupling|valverod)\./.test(p.id))) assert.ok(separated(p, o));
    poses++;
  }
  assert.equal(poses, 480);
  // Intentional negative control: move the actual main rail into the wheel's
  // plane at dead center. A point on the rendered rail penetrates the real hub.
  model.update(poseAt(0)); const all = primitives(model);
  const rail = all.find(p => p.id === 'conrod.L' && p.type === 'CylinderGeometry' && p.color === 0x8b9da6);
  const hub = all.find(p => p.id === 'wheel.0.-1' && p.type === 'CylinderGeometry' && p.color === 0x26343d);
  const shift = hub.center.z - rail.center.z, shifted = { ...rail, center: rail.center.clone().add(new THREE.Vector3(0, 0, shift)) };
  assert.equal(separated(shifted, hub), false, 'coplanar conrod regression must be rejected');
  const penetrates = new THREE.Vector3(0, -.30, 0).applyMatrix4(rail.matrix); penetrates.z += shift;
  assert.ok(insideConvex(hub, penetrates), 'negative control must enter actual cylinder triangles, not just its bounding box');
}));

test('useful assemblies survive low quality and buffer-derived budgets remain bounded', t => withModel(model => {
  const ids = new Set(model.parts.map(p => p.id)); assert.equal(ids.size, model.parts.length); assert.equal(new Set(model.parts.map(p => p.name)).size, ids.size);
  assert.ok(ids.size >= 100 && ids.size <= 200);
  for (const p of model.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof p[key] === 'string' && p[key].length > 2);
  assert.ok(new Set(model.parts.map(p => p.system)).size >= 12);
  let balanced;
  for (const quality of ['balanced', 'low']) {
    model.update(sample(.2), { quality }); const used = new Set(); let triangles = 0, instances = 0, draws = 0;
    for (const m of model.pickables) {
      triangles += m.count * (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3; instances += m.count; if (m.count) draws++;
      for (let i = 0; i < m.count; i++) { assert.ok(ids.has(m.userData.instanceParts[i])); used.add(m.userData.instanceParts[i]); }
    }
    assert.equal(used.size, ids.size); assert.equal(model.stats.triangles, triangles); assert.equal(model.stats.instances, instances); assert.equal(model.stats.drawCalls, draws);
    assert.equal(model.stats.selectableParts, ids.size); assert.ok(draws <= 32 && instances <= 2200 && triangles <= 135000);
    if (quality === 'balanced') { balanced = instances; assert.ok(instances >= 1000 && triangles >= 70000); } else { assert.ok(instances < balanced); assert.ok(triangles <= 80000); }
    t.diagnostic(`${quality}: ${ids.size} parts, ${instances} instances, ${triangles} triangles, ${draws} batches`);
  }
}));

test('rendered bounds preserve the stationary locomotive silhouette and safe grounded supports', () => withModel(model => {
  for (const advance of [-15, 45]) for (let i = 0; i < 12; i++) {
    model.update(poseAt(i * TAU / 12, { advance })); const b = bounds(model), size = b.getSize(new THREE.Vector3());
    near(b.min.y, 0, 2e-7); assert.ok(size.x > 2.9 && size.x < 3.3); assert.ok(size.z > 1.25 && size.z < 1.6); assert.ok(b.max.y < 2.1);
    for (const p of primitives(model, id => id.startsWith('wheel.'))) {
      const vertex = new THREE.Vector3();
      for (let k = 0; k < p.geometry.attributes.position.count; k++) {
        vertex.fromBufferAttribute(p.geometry.attributes.position, k).applyMatrix4(p.matrix);
        assert.ok(vertex.y > .15, 'all spinning wheel vertices clear rail heads');
      }
    }
  }
  near(model.group.position.length(), 0); near(model.group.quaternion.angleTo(new THREE.Quaternion()), 0); assert.deepEqual(model.group.scale.toArray(), [1, 1, 1]);
}));

test('all modes, selection and explosion reverse exactly; samples and geometry are immutable', () => withModel(model => {
  const state = sample(.33), originalState = structuredClone(state); model.update(state); const original = snapshot(model);
  const geometries = model.pickables.map(m => m.geometry), buffers = geometries.map(g => g.attributes.position.array.slice());
  for (let k = 0; k < 4; k++) {
    model.update(state, { explode: .83, mode: 'xray', quality: 'high', selectedId: 'conrod.L' }); assert.notDeepEqual(snapshot(model), original);
    for (const m of model.pickables) { const shell = m.material.color.getHex() === 0xced5cf; assert.equal(m.material.transparent, shell); near(m.material.opacity, shell ? .13 : 1); assert.equal(m.material.depthWrite, !shell); }
    model.update(state, { explode: .46, mode: 'cutaway', quality: 'low' });
    for (const m of model.pickables) { assert.equal(m.material.clippingPlanes.length, 1); assert.equal(m.material.side, THREE.DoubleSide); assert.ok(m.material.forceSinglePass); }
    model.update(state, { explode: 0, mode: 'solid', quality: 'balanced' }); assert.deepEqual(snapshot(model), original);
  }
  model.update(undefined); assert.deepEqual(snapshot(model), original); model.update({ driveAngle: state.driveAngle }); assert.deepEqual(snapshot(model), original);
  model.update(state, { selectedId: 'conrod.L' }); const color = new THREE.Color(); let picked = 0;
  for (const m of model.pickables) for (let i = 0; i < m.count; i++) { m.getColorAt(i, color); const isPicked = m.userData.instanceParts[i] === 'conrod.L'; assert.equal(color.getHex() !== 0xffffff, isPicked); if (isPicked) picked++; }
  assert.ok(picked > 0); assert.deepEqual(snapshot(model), original); assert.deepEqual(state, originalState);
  model.update(sample(.66)); assert.notDeepEqual(snapshot(model), original);
  model.pickables.forEach((m, i) => { assert.equal(m.geometry, geometries[i]); assert.deepEqual(m.geometry.attributes.position.array, buffers[i]); });
  model.update(sample(0)); const a = snapshot(model); model.update(sample(1 / cycleHz(DEFAULT_INPUTS))); assert.deepEqual(snapshot(model), a);
  model.update(sample(-1e-9)); const left = snapshot(model); model.update(sample(1e-9)); const right = snapshot(model);
  left.forEach((b, i) => b.matrix.forEach((v, j) => near(v, right[i].matrix[j], 2e-6)));
}));

test('every rendered GPU resource is disposed once and disposed models remain inert', () => {
  const m = createModel(), resources = new Set(m.pickables.flatMap(p => [p, p.geometry, p.material])), calls = new Map();
  resources.forEach(r => r.addEventListener('dispose', () => calls.set(r, (calls.get(r) ?? 0) + 1)));
  m.dispose(); m.dispose(); m.update(sample(2)); resources.forEach(r => assert.equal(calls.get(r), 1)); assert.equal(m.pickables.length, 0); assert.equal(m.group.children.length, 0);
});

test('jack support beams clear the tires, sleeves engage the axles and chest brackets reach the frame', () => withModel(model => {
  for (const advance of [-15, 45]) for (let n = 0; n < 8; n++) {
    model.update(poseAt(n * TAU / 8, { advance }));
    const all = primitives(model);
    const wheels = all.filter(p => /^(wheel|counterweight)\./.test(p.id));
    for (const jack of all.filter(p => /^jack\./.test(p.id))) for (const w of wheels) assert.ok(separated(jack, w), `${jack.id} pierces ${w.id}/${w.type}`);
  }
  model.update(poseAt(0)); const all = primitives(model);
  // Negative control: the old jack line at the tire plane must hit the actual wheel.
  const jack = all.find(p => p.id === 'jack.0.-1' && p.type === 'CylinderGeometry' && p.color === 0x26343d && p.half[1] > .1);
  const hub = all.find(p => p.id === 'wheel.0.-1' && p.type === 'CylinderGeometry' && p.color === 0x26343d && p.half[1] > .03);
  const shifted = { ...jack, center: hub.center.clone(), matrix: jack.matrix.clone() }; shifted.matrix.setPosition(shifted.center);
  assert.equal(separated(shifted, hub), false, 'a jack moved onto the tire plane must be rejected');
  // The eccentric sleeve must run from its ring inboard over the real axle end.
  for (const side of [-1, 1]) {
    const sleeve = all.find(p => p.id === `eccentric.${side < 0 ? 'L' : 'R'}` && p.type === 'CylinderGeometry' && p.color === 0x8b9da6 && Math.abs(p.half[0] - .034) < 1e-6);
    assert.ok(sleeve, 'eccentric sleeve exists');
    near(Math.abs(sleeve.axes[1].z), 1, 1e-6);
    const inboard = sleeve.center.clone().addScaledVector(sleeve.axes[1], -side * sleeve.half[1]);
    near(inboard.z, side * .425, .015);
    near(sleeve.center.z, side * .495, .002);
    const chest = all.filter(p => p.id === `valvechest.${side < 0 ? 'L' : 'R'}` && p.type === 'CylinderGeometry' && p.color === 0x8b9da6 && Math.abs(p.half[0] - .011) < 1e-6);
    assert.equal(chest.length, 2, 'two rendered valve-chest support stays');
    for (const stay of chest) {
      const a = stay.center.clone().addScaledVector(stay.axes[1], -stay.half[1]), b = stay.center.clone().addScaledVector(stay.axes[1], stay.half[1]);
      const upper = a.y > b.y ? a : b;
      near(upper.y, .815, .01); near(upper.z, side * .285, .01);
    }
  }
}));
