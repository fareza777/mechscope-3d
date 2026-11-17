import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { descriptor } from '../src/mechanisms/scorpion/index.js';
import { createModel } from '../src/mechanisms/scorpion/model.js';
import { sample, DIM, TAIL_LENGTHS, TAU, distance, solveKnee, yawPoint } from '../src/mechanisms/scorpion/kin.js';

const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const extremes = [ .12, .7 ].flatMap(cadence => [0, 1].map(posture => ({ cadence, posture })));
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
function nodePoint(m, id, local) { return new THREE.Vector3(...local).applyMatrix4(m.group.getObjectByName(`scorpion.${id}`).matrixWorld).toArray(); }

test('scorpion descriptor is complete and its catalogue imports stay renderer-free', async () => {
  assert.equal(descriptor.id, 'scorpion'); assert.equal(descriptor.title, 'SCORPIO S8'); assert.equal(descriptor.collection, '005');
  assert.equal(descriptor.controls.length, 2); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  assert.ok(descriptor.description.includes('conceptual'));
  for (const c of descriptor.controls) { assert.ok(c.min < c.max && c.step > 0); assert.ok(c.key in descriptor.defaultInputs); }
  for (const l of descriptor.lessons) {
    for (const k of ['title', 'short', 'text', 'fact']) assert.ok(l[k].length > 8);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(l.view)); assert.ok(['solid', 'xray', 'cutaway'].includes(l.mode)); assert.ok(l.explode >= 0 && l.explode <= 1);
  }
  for (const file of ['index.js', 'kin.js']) {
    const text = readFileSync(new URL(`../src/mechanisms/scorpion/${file}`, import.meta.url), 'utf8');
    assert.ok(!/from\s+['"]three|from\s+['"].*model/.test(text));
  }
  assert.deepEqual(descriptor.sample(0), sample(0)); near(descriptor.cycleHz(descriptor.defaultInputs), .28);
  const m = await descriptor.createModel(); assert.ok(m.group.isGroup && m.pickables.length > 0); m.dispose();
});

test('scorpion samples are deterministic, periodic and finite at all control corners', () => {
  for (const input of [...extremes, descriptor.defaultInputs]) for (const t of [-35.123, -.873, .137, 2.57, 7234.19]) {
    const saved = { ...input }, a = sample(t, input);
    sample(-4387, { cadence: .7, posture: 1 }); assert.deepEqual(sample(t, input), a); assert.deepEqual(input, saved);
    compare(a, sample(t + 1 / input.cadence, input)); numbers(a);
    assert.ok(a.phase >= 0 && a.phase < 1); near(a.driveAngle, a.phase * TAU);
  }
  for (const v of [NaN, Infinity, -Infinity, undefined, null]) numbers(sample(v, { cadence: v, posture: v }));
  for (const v of [-99, 99]) numbers(sample(1, { cadence: v, posture: v }));
  assert.throws(() => solveKnee([0, 0, 0], [5, 0, 0]), RangeError);
});

test('all eight three-joint legs retain rigid lengths and valid support paths over full cycles', () => {
  for (const input of extremes) for (let n = 0; n < 720; n++) {
    const s = sample(n / (720 * input.cadence), input); assert.equal(s.legs.length, 8);
    assert.equal(new Set(s.legs.map(l => l.id)).size, 8);
    for (const l of s.legs) {
      near(distance(l.hip, l.coxa), DIM.coxa); near(distance(l.coxa, l.knee), DIM.femur); near(distance(l.knee, l.foot), DIM.tibia);
      const reach = distance(l.coxa, l.foot); assert.ok(reach > Math.abs(DIM.femur - DIM.tibia) + .03 && reach < DIM.femur + DIM.tibia - .03);
      assert.ok(l.foot[1] >= DIM.sole - 1e-12 && l.foot[1] <= DIM.sole + .115 + 1e-12);
      if (l.stance) near(l.foot[1], DIM.sole);
      near(l.actuatorLength, distance(l.actuatorA, l.actuatorB)); assert.ok(l.actuatorLength > .14 && l.actuatorLength < .60);
    }
    assert.ok(s.metrics.supportPads >= 4); assert.equal(s.metrics.supportPads, s.legs.filter(l => l.stance).length);
    for (let i = 0; i < 4; i++) near(Math.abs(s.legs[i].phase - s.legs[i + 4].phase), .5);
  }
});

test('both opposed pincers and every multi-axis tail vertebra meet their exact endpoints', () => {
  for (const input of extremes) for (let n = 0; n < 720; n++) {
    const s = sample(n / (720 * input.cadence), input);
    for (const c of s.claws) {
      near(distance(c.shoulder, c.elbow), DIM.humerus); near(distance(c.elbow, c.wrist), DIM.forearm); near(distance(c.wrist, c.palmTip), DIM.palm);
      assert.ok(c.opening >= .14 - 1e-12 && c.opening <= .56 + 1e-12);
      near((c.jaws[0].yaw + c.jaws[1].yaw) / 2, c.yaw);
      near(c.gap, distance(c.jaws[0].tip, c.jaws[1].tip)); assert.ok(c.gap > .01);
      for (const j of c.jaws) {
        near(distance(j.pivot, j.knuckle), Math.hypot(.02, .12)); near(distance(j.knuckle, j.tip), Math.hypot(.078, .085));
        compare(j.tip, yawPoint(j.pivot, [-j.side * .058, 0, -DIM.jaw], j.yaw));
      }
      assert.ok(c.actuatorLength > .19);
    }
    assert.equal(s.tail.length, 6);
    s.tail.forEach((l, i) => { near(distance(l.start, l.end), TAIL_LENGTHS[i]); if (i) near(distance(l.start, s.tail[i - 1].end), 0); });
    near(distance(s.stinger.start, s.tail.at(-1).end), 0); near(distance(s.stinger.start, s.stinger.end), .25);
    near(s.metrics.tailHeight, Math.max(...s.tail.map(l => l.end[1]))); near(s.metrics.clawGap, s.claws[0].gap);
    near(s.metrics.crankRpm, input.cadence * 60); near(s.metrics.cycleSeconds, 1 / input.cadence);
    for (const value of Object.values(s.metrics)) assert.ok(typeof value === 'number' && Number.isFinite(value));
  }
});

test('all rendered scorpion geometry belongs to unique, meaningful selectable assemblies', () => withModel(m => {
  const ids = new Set(m.parts.map(p => p.id)), used = new Set(); assert.equal(ids.size, m.parts.length); assert.ok(ids.size >= 55);
  for (const p of m.parts) for (const key of ['id', 'name', 'system', 'function', 'how', 'material']) assert.ok(typeof p[key] === 'string' && p[key].length > 7, `${p.id}: ${key}`);
  m.group.traverse(n => { if (n.isMesh) assert.ok(n.isInstancedMesh && m.pickables.includes(n)); else assert.ok(n.isGroup); });
  for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) { const id = mesh.userData.instanceParts[i]; assert.ok(ids.has(id)); used.add(id); }
  assert.equal(used.size, ids.size); assert.equal(m.stats.selectableParts, ids.size);
}));

test('actual generated scorpion geometry meets the mobile instance, triangle and batch gates', () => withModel(m => {
  let balanced, low;
  for (const quality of ['balanced', 'low', 'high']) for (const mode of ['solid', 'xray', 'cutaway']) {
    m.update(sample(.37), { quality, mode });
    let instances = 0, triangles = 0, batches = 0; const used = new Set();
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

test('scorpion matrices remain finite and structural endpoints match the solver at every control corner', () => withModel(m => {
  const matrix = new THREE.Matrix4();
  for (const input of extremes) for (let n = 0; n < 96; n++) {
    const state = sample(n / (96 * input.cadence), input); m.update(state);
    for (const b of m.pickables) for (let i = 0; i < b.count; i++) { b.getMatrixAt(i, matrix); assert.ok(matrix.elements.every(Number.isFinite)); assert.ok(matrix.determinant() > 0); }
    state.legs.forEach(l => { near(distance(nodePoint(m, `leg.${l.id}.femur`, [0, DIM.femur, 0]), l.knee), 0); near(distance(nodePoint(m, `leg.${l.id}.tibia`, [0, DIM.tibia, 0]), l.foot), 0); });
    state.tail.forEach((l, i) => near(distance(nodePoint(m, `tail.link-${i + 1}.spine`, [0, l.length, 0]), l.end), 0));
  }
}));

function checkMount(m, actuator, member, anchor, start, end, local, width, checkBracket) {
  const node = m.group.getObjectByName(`scorpion.${member}`), inverse = node.matrixWorld.clone().invert();
  const actual = new THREE.Vector3(...anchor).applyMatrix4(inverse).toArray();
  actual.forEach((v, i) => near(v, local[i]));
  near(distance(anchor, start), Math.hypot(...local));
  near(distance(anchor, end), Math.hypot(local[0], local[1] - distance(start, end), local[2]));
  near(distance(nodePoint(m, `${actuator}.clevis`, [0, 0, 0]), anchor), 0);
  near(Math.abs(m.group.getObjectByName(`scorpion.${actuator}.clevis`).quaternion.dot(node.quaternion)), 1);
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

test('scorpion actuator mounts and visible brackets are fixed in the rendered femur and wrist-carrier frames', () => withModel(m => {
  for (const quality of ['balanced', 'low']) for (const input of [...extremes, descriptor.defaultInputs]) for (let n = 0; n < 96; n++) {
    const s = sample(n / (96 * input.cadence), input); m.update(s, { quality });
    for (const l of s.legs) checkMount(m, `leg.${l.id}.lift`, `leg.${l.id}.femur`, l.actuatorB, l.coxa, l.knee, [0, DIM.femur - .035, .065], .025, n === 0);
    for (const c of s.claws) {
      const id = `claw.${c.side < 0 ? 'L' : 'R'}`;
      checkMount(m, `${id}.reach`, `${id}.forearm`, c.actuatorB, c.elbow, c.wrist, [0, DIM.forearm - .03, .07], .035, n === 0);
    }
  }
}));

test('scorpion actual hook and finger solids retain positive clearance across the cycle and posture range', () => withModel(m => {
  // Include exact opening extrema, which do not fall on the uniform phase grid.
  const closingPhase = (3 * Math.PI / 2 - .6) / TAU, openingPhase = (Math.PI / 2 - .6) / TAU;
  const phases = [closingPhase, openingPhase, ...Array.from({ length: 360 }, (_, i) => i / 360)];
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  let minimum = Infinity;
  for (const cadence of [.12, .7]) for (const posture of [0, .25, .65, 1]) for (const phase of phases) {
    const s = sample(phase / cadence, { cadence, posture }); m.update(s);
    for (const claw of s.claws) {
      if (phase === closingPhase) near(claw.opening, .14);
      if (phase === openingPhase) near(claw.opening, .27 + .29 * posture);
      const id = `scorpion.claw.${claw.side < 0 ? 'L' : 'R'}`;
      let leftMax = -Infinity, rightMin = Infinity, hooks = 0;
      for (const mesh of m.pickables) for (let i = 0; i < mesh.count; i++) {
        const part = mesh.userData.instanceParts[i];
        if (part !== `${id}.jaw-inner` && part !== `${id}.jaw-outer`) continue;
        mesh.getMatrixAt(i, matrix);
        if (mesh.geometry.type === 'CylinderGeometry') {
          const radius = new THREE.Vector3().setFromMatrixColumn(matrix, 0).length();
          if (Math.abs(radius - .018) < 1e-7) hooks++;
        }
        const positions = mesh.geometry.attributes.position;
        for (let j = 0; j < positions.count; j++) {
          point.fromBufferAttribute(positions, j).applyMatrix4(matrix);
          const x = (point.x - claw.palmTip[0]) * Math.cos(claw.yaw) - (point.z - claw.palmTip[2]) * Math.sin(claw.yaw);
          if (part === `${id}.jaw-inner`) leftMax = Math.max(leftMax, x); else rightMin = Math.min(rightMin, x);
        }
      }
      assert.equal(hooks, 2, 'test must include both rendered 18 mm-radius hook cylinders');
      // Disjoint projections separate every triangle and solid interior, not merely tips or vertices.
      const clearance = rightMin - leftMax;
      assert.ok(clearance > .006, `solid clearance ${clearance} at phase ${phase}, posture ${posture}`);
      minimum = Math.min(minimum, clearance);
    }
  }
  assert.ok(minimum < .02, 'exercise the nearly closed hooks, not only wide-open poses');
}));

test('scorpion actual vertices stay above ground and within the compact model envelope', () => withModel(m => {
  for (const input of extremes) for (let i = 0; i < 12; i++) {
    m.update(sample(i / (12 * input.cadence), input)); const b = bounds(m), size = b.getSize(new THREE.Vector3());
    assert.ok(b.min.y >= -1e-7, `ground ${b.min.y}`); assert.ok(b.max.y <= 2.2, `height ${b.max.y}`);
    assert.ok(Math.max(size.x, size.z) <= 3.05, `footprint ${size.toArray()}`); assert.ok(Math.abs((b.min.x + b.max.x) / 2) < .15); assert.ok(Math.abs((b.min.z + b.max.z) / 2) < .25);
  }
}));

test('scorpion explosion, x-ray, cutaway, selection and quality restore exactly without pose mutation', () => withModel(m => {
  const state = sample(1.37), copy = structuredClone(state); m.update(state); const original = snapshot(m);
  const resources = m.pickables.map(b => [b, b.geometry, b.material, b.instanceMatrix.array]);
  for (const e of [1, .23, .87]) {
    m.update(state, { explode: e, mode: 'xray', quality: 'low', selectedId: m.parts[0].id }); assert.notDeepEqual(snapshot(m), original);
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

test('scorpion disposal releases all instance resources once', () => {
  const m = createModel(), resources = new Set(m.pickables.flatMap(b => [b, b.geometry, b.material])), calls = new Map();
  for (const r of resources) r.addEventListener('dispose', () => calls.set(r, (calls.get(r) || 0) + 1));
  m.dispose(); m.dispose(); m.update(sample(4)); assert.equal(m.pickables.length, 0); assert.equal(m.group.children.length, 0);
  for (const r of resources) assert.equal(calls.get(r), 1);
});
