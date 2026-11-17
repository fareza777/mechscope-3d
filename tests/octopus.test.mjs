import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/octopus/index.js';
import { createModel } from '../src/mechanisms/octopus/model.js';
import { TAU, DEFAULT_INPUTS, LIMITS, LENGTHS, RADII, ARM_LENGTH, ROOT_RADIUS, ROOT_HEIGHT,
  WAVE_LAG, inputsOf, cycleHz, phaseOffset, segmentId, rotate, pointInFrame, poseAt, sample } from '../src/mechanisms/octopus/kin.js';

const near = (a, b, tolerance = 1e-9) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const nearVector = (a, b, tolerance = 1e-9) => a.forEach((v, i) => near(v, b[i], tolerance));
const withModel = fn => { const model = createModel(); try { return fn(model); } finally { model.dispose(); } };
const extrema = LIMITS.cadence.flatMap(cadence => LIMITS.curl.map(curl => ({ cadence, curl })));
function allFinite(value) {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (value && typeof value === 'object') Object.values(value).forEach(allFinite);
}
function snapshot(model) {
  return model.pickables.map(mesh => ({ name: mesh.name, count: mesh.count,
    matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
    ids: mesh.userData.instanceParts.slice(0, mesh.count),
    colors: Array.from(mesh.instanceColor.array.slice(0, mesh.count * 3)) }));
}
function boundsOf(model) {
  const box = new THREE.Box3(), p = new THREE.Vector3(), m = new THREE.Matrix4();
  for (const mesh of model.pickables) {
    const positions = mesh.geometry.attributes.position;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      for (let j = 0; j < positions.count; j++) box.expandByPoint(p.fromBufferAttribute(positions, j).applyMatrix4(m));
    }
  }
  return box;
}
function materialsOf(model) {
  return [...new Set(model.pickables.map(mesh => mesh.material))];
}
// Exact finite-segment distance, including parallel and endpoint cases.
function segmentDistance(a, b, c, d) {
  const u = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
  const v = new THREE.Vector3(...d).sub(new THREE.Vector3(...c));
  const w = new THREE.Vector3(...a).sub(new THREE.Vector3(...c));
  const A = u.dot(u), B = u.dot(v), C = v.dot(v), D = u.dot(w), E = v.dot(w);
  const clamp = x => Math.max(0, Math.min(1, x));
  const denom = A * C - B * B;
  let s = denom > 1e-16 ? clamp((B * E - C * D) / denom) : 0;
  let t = (B * s + E) / C;
  if (t < 0) { t = 0; s = clamp(-D / A); }
  else if (t > 1) { t = 1; s = clamp((B - D) / A); }
  return w.addScaledVector(u, s).addScaledVector(v, -t).length();
}

test('descriptor exports the complete OCTAVIA O8 contract and lazy factory', async () => {
  assert.equal(descriptor.id, 'octopus'); assert.equal(descriptor.title, 'OCTAVIA O8'); assert.equal(descriptor.collection, '008');
  for (const key of ['family', 'tagline', 'description', 'cycleLabel']) assert.ok(descriptor[key].length > 5);
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const control of descriptor.controls) {
    for (const key of ['key', 'label', 'unit']) assert.equal(typeof control[key], 'string');
    for (const key of ['min', 'max', 'step', 'precision']) assert.ok(Number.isFinite(control[key]));
    assert.ok(control.min <= DEFAULT_INPUTS[control.key] && DEFAULT_INPUTS[control.key] <= control.max);
    assert.ok(control.max > control.min && control.step > 0);
  }
  for (const lesson of descriptor.lessons) {
    for (const key of ['title', 'short', 'text', 'fact']) assert.ok(lesson[key].length > 8);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(lesson.view));
    assert.ok(['solid', 'xray', 'cutaway'].includes(lesson.mode));
    assert.ok(lesson.explode >= 0 && lesson.explode <= 1);
  }
  near(descriptor.cycleHz(DEFAULT_INPUTS), 0.18);
  assert.deepEqual(descriptor.sample(1), sample(1));
  const model = await descriptor.createModel();
  assert.ok(model.group.isGroup && model.pickables.length > 0 && model.stats.instances > 0); model.dispose();
});

test('pure sampler is finite, repeatable, periodic and continuous at control extrema', () => {
  for (const input of [...extrema, DEFAULT_INPUTS]) for (const t of [-500, -1.234, 0, 0.789, 31.78, 10000]) {
    const before = structuredClone(input), state = sample(t, input), period = 1 / cycleHz(input);
    allFinite(state); assert.deepEqual(input, before); assert.ok(state.phase >= 0 && state.phase < 1);
    sample(-234.67, { cadence: 0.4, curl: 0.2 });
    assert.deepEqual(sample(t, input), state);
    const next = sample(t + period, input);
    for (let a = 0; a < 8; a++) for (let j = 0; j < 8; j++) {
      nearVector(state.arms[a].segments[j].end, next.arms[a].segments[j].end, 2e-10);
      nearVector(state.arms[a].segments[j].quaternion, next.arms[a].segments[j].quaternion, 2e-10);
    }
    for (const [key, value] of Object.entries(state.metrics)) { assert.equal(typeof value, 'number'); near(value, next.metrics[key], 1e-8); }
    const left = sample(period - 1e-7, input), right = sample(period + 1e-7, input);
    for (let a = 0; a < 8; a++) nearVector(left.arms[a].tip, right.arms[a].tip, 1e-6);
  }
  for (const t of [NaN, Infinity, -Infinity, 1e308, -1e308]) allFinite(sample(t));
  for (const value of [undefined, NaN, Infinity, -Infinity, -100, 100]) allFinite(sample(1, { cadence: value, curl: value }));
  allFinite(sample(1, null));
  assert.deepEqual(inputsOf({ cadence: -1, curl: 2 }), { cadence: 0.05, curl: 1 });
  const a = sample(0.3 / 0.05, { cadence: 0.05, curl: 0.5 });
  const b = sample(0.3 / 0.45, { cadence: 0.45, curl: 0.5 });
  nearVector(a.arms[0].tip, b.arms[0].tip);
  assert.ok(distance(sample(1, { curl: 0 }).arms[0].tip, sample(1, { curl: 1 }).arms[0].tip) > 0.01);
});

test('64 rigid spans and alternating universal-joint axes close exactly through the full range', () => {
  near(ARM_LENGTH, 1.21); assert.equal(LENGTHS.length, 8); assert.equal(RADII.length, 8);
  for (const input of extrema) for (let n = 0; n < 360; n++) {
    const state = sample(n / 360 / input.cadence, input);
    for (let a = 0; a < 8; a++) {
      const arm = state.arms[a]; near(arm.phaseOffset, phaseOffset(a));
      near(Math.hypot(arm.base[0], arm.base[2]), ROOT_RADIUS); near(arm.base[1], ROOT_HEIGHT);
      let start = arm.base, previous = arm.rootQuaternion, length = 0;
      for (let j = 0; j < 8; j++) {
        const s = arm.segments[j]; nearVector(s.position, start); nearVector(s.supportQuaternion, previous);
        near(distance(s.position, s.end), LENGTHS[j]); length += distance(s.position, s.end);
        nearVector(s.end, pointInFrame(s.position, s.quaternion, [LENGTHS[j], 0, 0]));
        for (const q of [s.supportQuaternion, s.carrierQuaternion, s.quaternion]) near(Math.hypot(...q), 1);
        assert.equal(s.order, j % 2 === 0 ? 'ZY' : 'YZ');
        const outerAxis = s.order[0] === 'Z' ? [0, 0, 1] : [0, 1, 0];
        const innerAxis = s.order[1] === 'Z' ? [0, 0, 1] : [0, 1, 0];
        nearVector(rotate(s.supportQuaternion, outerAxis), rotate(s.carrierQuaternion, outerAxis));
        nearVector(rotate(s.carrierQuaternion, innerAxis), rotate(s.quaternion, innerAxis));
        near(s.wave, state.driveAngle + phaseOffset(a) - j * WAVE_LAG);
        for (const tendon of s.tendons) {
          near(distance(tendon.start, tendon.end), tendon.length);
          assert.ok(tendon.length > 0.060 && tendon.length < 0.160);
        }
        const opposite = state.arms[(a + 4) % 8].segments[j];
        nearVector(opposite.end, [-s.end[0], s.end[1], -s.end[2]]);
        start = s.end; previous = s.quaternion;
      }
      near(length, ARM_LENGTH); nearVector(arm.tip, start);
      near(arm.outputAngle, -2 * state.driveAngle + a * Math.PI / 6);
    }
  }
});

test('radial curling arms retain separated non-neighbor envelopes rather than crossing into legs', () => {
  let clearance = Infinity;
  for (const curl of [0, 0.25, 0.5, 0.75, 1]) for (let n = 0; n < 180; n++) {
    const state = poseAt(n * TAU / 180, { curl });
    for (let a = 0; a < 8; a++) {
      const arm = state.arms[a];
      // Upturned distal links and a lower middle form a scoop, not a knee/foot.
      const lastDirection = rotate(arm.segments[7].quaternion, [1, 0, 0]);
      assert.ok(lastDirection[1] > 0.8);
      assert.ok(arm.tip[1] > arm.segments[3].position[1]);
      for (let j = 0; j < 8; j++) {
        const s = arm.segments[j];
        assert.ok(s.position[1] - RADII[j] * 1.40 > 0.30);
        for (let b = a; b < 8; b++) for (let k = b === a ? j + 2 : 0; k < 8; k++) {
          const other = state.arms[b].segments[k];
          const gap = segmentDistance(s.position, s.end, other.position, other.end) - 1.40 * (RADII[j] + RADII[k]);
          clearance = Math.min(clearance, gap);
          assert.ok(gap > 0, `non-adjacent arm envelopes overlap: ${a}/${j}, ${b}/${k}, curl ${curl}, phase ${n}, gap ${gap}`);
        }
      }
    }
  }
  console.log(`OCTAVIA minimum sampled non-neighbor capsule clearance: ${(clearance * 1000).toFixed(2)} mm`);
});

test('all instanced primitives map to complete unique metadata; cups and gimbals are real rings', () => withModel(model => {
  const ids = new Set(model.parts.map(p => p.id)), used = new Set(), cupRings = new Map(), vertebraRings = new Map();
  assert.equal(ids.size, model.parts.length); assert.ok(ids.size >= 85);
  for (const p of model.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material']) assert.ok(typeof p[key] === 'string' && p[key].length > 0);
  model.group.traverse(node => {
    if (node.userData.partId) assert.ok(node.isGroup && !node.isMesh);
    if (node.isMesh) assert.ok(node.isInstancedMesh && model.pickables.includes(node));
  });
  for (const mesh of model.pickables) {
    assert.notEqual(mesh.geometry.type, 'SphereGeometry');
    for (let i = 0; i < mesh.count; i++) {
      const id = mesh.userData.instanceParts[i]; assert.ok(ids.has(id), id); used.add(id);
      if (mesh.geometry.type === 'TorusGeometry' && /^arm\.\d+\.vertebra\.\d+$/.test(id)) {
        const tally = mesh.material.name.endsWith('18252a') ? cupRings : vertebraRings;
        tally.set(id, (tally.get(id) || 0) + 1);
      }
    }
  }
  assert.equal(used.size, ids.size); assert.equal(cupRings.size, 64); assert.equal(vertebraRings.size, 64);
  for (let a = 0; a < 8; a++) for (let j = 0; j < 8; j++) { assert.equal(cupRings.get(segmentId(a, j)), 2); assert.equal(vertebraRings.get(segmentId(a, j)), 1); }
  assert.equal(model.parts.filter(p => p.id.startsWith('optics.')).length, 2);
}));

test('actual rendered geometry and draw batches meet budgets at every quality and mode', () => withModel(model => {
  const state = sample(1.25);
  for (const quality of ['low', 'balanced', 'high']) for (const mode of ['solid', 'xray', 'cutaway']) {
    model.update(state, { mode, quality, selectedId: segmentId(0, 0) });
    let instances = 0, triangles = 0, drawCalls = 0;
    for (const mesh of model.pickables) {
      instances += mesh.count;
      triangles += mesh.count * (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3;
      if (mesh.visible && mesh.count) drawCalls++;
      assert.ok(mesh.material.forceSinglePass);
      assert.ok(Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)).every(Number.isFinite));
    }
    assert.equal(model.stats.instances, instances); assert.equal(model.stats.triangles, triangles); assert.equal(model.stats.drawCalls, drawCalls);
    assert.equal(model.stats.components, instances); assert.equal(model.stats.drawCallsEstimate, drawCalls);
    assert.ok(instances >= 1600 && instances <= 2600, `instances ${instances}`);
    assert.ok(triangles <= 140000, `triangles ${triangles}`); assert.ok(drawCalls <= 48, `draw calls ${drawCalls}`);
    if (mode === 'solid') console.log(`OCTAVIA ${quality}: ${instances} instances, ${triangles} triangles, ${drawCalls} batches, ${model.parts.length} assemblies`);
  }
}));

test('transformed geometry stays centered, under 3 m across, below 2.2 m and above ground', () => withModel(model => {
  let bottom = Infinity, top = -Infinity, footprint = 0;
  for (const input of extrema) for (let n = 0; n < 24; n++) {
    model.update(sample(n / 24 / input.cadence, input));
    const bounds = boundsOf(model), size = bounds.getSize(new THREE.Vector3());
    assert.ok(bounds.min.y >= 0, `ground ${bounds.min.y}`);
    assert.ok(bounds.max.y <= 2.2, `height ${bounds.max.y}`);
    assert.ok(Math.max(size.x, size.z) <= 3, `footprint ${size.toArray()}`);
    near(bounds.min.x + bounds.max.x, 0, 2e-6); near(bounds.min.z + bounds.max.z, 0, 2e-6);
    bottom = Math.min(bottom, bounds.min.y); top = Math.max(top, bounds.max.y); footprint = Math.max(footprint, size.x, size.z);
  }
  console.log(`OCTAVIA sampled mesh envelope: ${footprint.toFixed(4)} m footprint; y ${bottom.toFixed(4)}–${top.toFixed(4)} m`);
}));

test('actual arm vertices fit the capsules used by non-intersection checks', () => withModel(model => {
  const point = new THREE.Vector3(), matrix = new THREE.Matrix4();
  for (const curl of [0, 0.5, 1]) for (let n = 0; n < 24; n++) {
    const state = sample(n / 24 / DEFAULT_INPUTS.cadence, { curl }); model.update(state);
    const capsules = new Map(state.arms.flatMap(arm => arm.segments.map(s => [s.id, {
      start: new THREE.Vector3(...s.position), direction: new THREE.Vector3(...s.end).sub(new THREE.Vector3(...s.position)).normalize(),
      length: s.length, radius: 1.40 * s.radius,
    }])));
    for (const mesh of model.pickables) for (let i = 0; i < mesh.count; i++) {
      const id = mesh.userData.instanceParts[i], match = id.match(/^arm\.\d+\.vertebra\.\d+/);
      if (!match) continue;
      const capsule = capsules.get(match[0]), positions = mesh.geometry.attributes.position;
      mesh.getMatrixAt(i, matrix);
      for (let j = 0; j < positions.count; j++) {
        point.fromBufferAttribute(positions, j).applyMatrix4(matrix).sub(capsule.start);
        const along = Math.max(0, Math.min(capsule.length, point.dot(capsule.direction)));
        point.addScaledVector(capsule.direction, -along);
        assert.ok(point.length() <= capsule.radius + 2e-7, `${id} exceeds its collision envelope: ${point.length()} > ${capsule.radius}`);
      }
    }
  }
}));

test('rigid sleeves keep their length and rendered piston ends match pure tendon anchors', () => withModel(model => {
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (const curl of [0, 1]) for (let n = 0; n < 12; n++) {
    const state = sample(n / 12 / DEFAULT_INPUTS.cadence, { curl }); model.update(state);
    const spans = new Map(state.arms.flatMap(arm => arm.segments.flatMap(s => s.tendons.map((t, i) => [`${s.id}.tendon.${i ? 'extensor' : 'flexor'}`, t]))));
    let pistons = 0;
    for (const mesh of model.pickables) for (let i = 0; i < mesh.count; i++) {
      const id = mesh.userData.instanceParts[i], span = spans.get(id); if (!span) continue;
      mesh.getMatrixAt(i, matrix);
      if (mesh.material.name.endsWith('a86642')) {
        nearVector(point.set(0, 0.5, 0).applyMatrix4(matrix).toArray(), span.end, 2e-7); pistons++;
      } else {
        near(new THREE.Vector3(0, 0.5, 0).applyMatrix4(matrix).distanceTo(new THREE.Vector3(0, -0.5, 0).applyMatrix4(matrix)), 0.048, 2e-7);
        nearVector(point.set(0, -0.5, 0).applyMatrix4(matrix).toArray(), span.start, 2e-7);
      }
    }
    assert.equal(pistons, 128);
  }
}));

test('explosion, quality, selection, arbitrary time and modes restore every exact instance matrix', () => withModel(model => {
  const state = sample(2.468), untouched = structuredClone(state); model.update(state);
  const assembled = snapshot(model), geometry = model.pickables.map(m => [m.geometry, m.geometry.attributes.position.array.slice(), m.geometry.attributes.normal.array.slice()]);
  for (let i = 0; i < 20; i++) {
    model.update(sample(i * 17.92), { explode: 0.731, mode: 'cutaway', quality: 'low', selectedId: segmentId(0, 0) });
    model.update(state, { explode: 1, mode: 'xray', quality: 'high' }); assert.notDeepEqual(snapshot(model), assembled);
    model.update(state, { explode: 0, mode: 'solid', quality: 'balanced' }); assert.deepEqual(snapshot(model), assembled);
  }
  model.update(); assert.deepEqual(snapshot(model), assembled);
  model.update({ driveAngle: state.driveAngle }); assert.deepEqual(snapshot(model), assembled);
  assert.deepEqual(state, untouched);
  model.update(state, { selectedId: segmentId(0, 0) });
  assert.notDeepEqual(snapshot(model), assembled);
  model.update(state); assert.deepEqual(snapshot(model), assembled);
  for (let i = 0; i < geometry.length; i++) {
    assert.equal(model.pickables[i].geometry, geometry[i][0]);
    assert.deepEqual(geometry[i][0].attributes.position.array, geometry[i][1]);
    assert.deepEqual(geometry[i][0].attributes.normal.array, geometry[i][2]);
  }
}));

test('xray fades exterior armor only and all material/clipping state restores', () => withModel(model => {
  model.update(undefined, { mode: 'xray' });
  const materials = materialsOf(model); assert.ok(materials.some(m => m.transparent)); assert.ok(materials.some(m => !m.transparent));
  for (const material of materials) {
    assert.equal(material.transparent, material.userData.outer);
    near(material.opacity, material.userData.outer ? 0.13 : 1); assert.equal(material.depthWrite, !material.userData.outer);
  }
  model.update(undefined, { mode: 'cutaway' });
  for (const material of materials) { assert.equal(material.clippingPlanes.length, 1); assert.equal(material.side, THREE.DoubleSide); assert.equal(material.opacity, 1); assert.equal(material.transparent, false); }
  model.update(undefined, { mode: 'solid' });
  for (const material of materials) { assert.equal(material.clippingPlanes.length, 0); assert.equal(material.side, THREE.FrontSide); assert.equal(material.opacity, 1); assert.equal(material.transparent, false); assert.equal(material.depthWrite, true); }
}));

test('host root transforms apply once and clipping follows the transformed root', () => withModel(model => {
  const state = sample(1); model.update(state); const before = snapshot(model);
  model.group.position.set(0.7, 0.1, -0.2); model.group.rotation.y = 0.4;
  model.update(state, { mode: 'cutaway' }); assert.deepEqual(snapshot(model), before);
  const origin = new THREE.Vector3(0, 1, 0).applyMatrix4(model.group.matrixWorld);
  for (const m of materialsOf(model)) near(m.clippingPlanes[0].distanceToPoint(origin), 0);
  model.group.position.set(0, 0, 0); model.group.rotation.set(0, 0, 0); model.update(state);
  assert.deepEqual(snapshot(model), before);
}));

test('teardown releases every used mesh, material and geometry once', () => {
  const model = createModel(); const resources = new Set(model.pickables.flatMap(m => [m, m.geometry, m.material]));
  const calls = new Map();
  for (const resource of resources) resource.addEventListener('dispose', () => calls.set(resource, (calls.get(resource) || 0) + 1));
  model.dispose(); model.dispose(); model.update(sample(2));
  for (const resource of resources) assert.equal(calls.get(resource), 1);
  assert.equal(model.group.children.length, 0); assert.equal(model.pickables.length, 0); assert.equal(model.stats.instances, 0);
});
