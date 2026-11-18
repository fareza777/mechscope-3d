import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/sentinel/index.js';
import { createModel } from '../src/mechanisms/sentinel/model.js';
import { D, TAU, DEFAULT_INPUTS, cycleHz, distance, footPath, inputsOf, poseAt, sample, solveTwoLink } from '../src/mechanisms/sentinel/kin.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const finite = value => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(finite);
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
};
const withModel = fn => { const model = createModel(); try { fn(model); } finally { model.dispose(); } };
function snapshot(model) {
  model.group.updateMatrixWorld(true);
  return model.pickables.filter(mesh => mesh.count).map(mesh => ({
    ids: mesh.userData.instanceParts.slice(0, mesh.count),
    matrix: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
  }));
}
function counts(model) {
  const map = new Map();
  for (const mesh of model.pickables) for (let i = 0; i < mesh.count; i++) {
    const id = mesh.userData.instanceParts[i];
    map.set(id, (map.get(id) || 0) + 1);
  }
  return map;
}
const worldOf = (node, local) => new THREE.Vector3(...local).applyMatrix4(node.matrixWorld).toArray();
const CORNERS = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];
function renderedBounds(model) {
  model.group.updateMatrixWorld(true);
  const box = new THREE.Box3(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  for (const mesh of model.pickables) {
    mesh.geometry.computeBoundingBox(); const g = mesh.geometry.boundingBox;
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m);
      for (const c of CORNERS) {
        v.set(c[0] < 0 ? g.min.x : g.max.x, c[1] < 0 ? g.min.y : g.max.y, c[2] < 0 ? g.min.z : g.max.z).applyMatrix4(m);
        box.expandByPoint(v);
      }
    }
  }
  return box;
}
function motionSnapshot(model) {
  model.group.updateMatrixWorld(true);
  const rows = [];
  for (const mesh of model.pickables) for (let i = 0; i < mesh.count; i++) {
    rows.push({ id: mesh.userData.instanceParts[i], matrix: new THREE.Matrix4().fromArray(mesh.instanceMatrix.array, i * 16) });
  }
  const anchor = rows.find(row => row.id === 'pelvis.chassis').matrix.clone().invert();
  const map = new Map();
  for (const row of rows) {
    const relative = new THREE.Matrix4().multiplyMatrices(anchor, row.matrix);
    if (!map.has(row.id)) map.set(row.id, []);
    map.get(row.id).push(...relative.elements);
  }
  return { map, ids: rows.map(row => row.id) };
}
function requireFloor(box) { assert.ok(box.min.y >= -1e-6, `floor ${box.min.y}`); }
function budgetGate(stats, label = 'balanced') {
  assert.ok(stats.instances >= 1400 && stats.instances <= 2100, `${label} instances ${stats.instances}`);
  assert.ok(stats.triangles >= 85000 && stats.triangles <= 130000, `${label} triangles ${stats.triangles}`);
  assert.ok(stats.triangles <= 200000, `${label} absolute triangle ceiling`);
  assert.ok(stats.drawCalls <= 40, `${label} draw calls ${stats.drawCalls}`);
  assert.ok(stats.selectableParts >= 170, `${label} selectable parts ${stats.selectableParts}`);
}
function requireMotion(moving, total) {
  assert.ok(moving.size / total >= 0.70, `${moving.size}/${total} parts move (${(100 * moving.size / total).toFixed(1)}%)`);
}

test('H9 descriptor exposes four bounded controls, five lessons and a lazy model', async () => {
  assert.equal(descriptor.id, 'sentinel'); assert.equal(descriptor.title, 'SENTINEL H9');
  assert.equal(descriptor.collection, '020'); assert.equal(descriptor.family, 'Bipedal Exoskeleton');
  assert.equal(descriptor.controls.length, 4); assert.equal(descriptor.specs.length, 2); assert.equal(descriptor.lessons.length, 5);
  for (const control of descriptor.controls) {
    assert.ok(control.key in DEFAULT_INPUTS); assert.ok(control.min < control.max); assert.ok(control.step > 0);
    for (const key of ['key', 'label', 'unit']) assert.ok(control[key].length);
    assert.ok(Number.isInteger(control.precision)); assert.ok(control.min <= descriptor.defaultInputs[control.key] && descriptor.defaultInputs[control.key] <= control.max);
  }
  for (const lesson of descriptor.lessons) {
    assert.ok(lesson.text.length > 180 && lesson.fact.length > 30 && lesson.short.length > 4);
    assert.ok(['home', 'side', 'top', 'front', 'detail'].includes(lesson.view));
    assert.ok(['solid', 'xray', 'cutaway'].includes(lesson.mode)); assert.ok(lesson.explode >= 0 && lesson.explode <= 1);
  }
  assert.match(descriptor.description, /not solved/);
  assert.deepEqual(descriptor.sample(0), sample(0)); near(descriptor.cycleHz(DEFAULT_INPUTS), 0.42);
  const model = await descriptor.createModel(); assert.ok(model.group.isGroup && model.pickables.length > 0); model.dispose();
});

test('34 rigid links keep exact lengths through every stride, lift and grip extreme', () => {
  for (const stride of [0.12, 0.24, 0.36]) for (const lift of [0.05, 0.12, 0.20]) for (const grip of [0, 24, 55]) {
    for (let n = 0; n < 360; n++) {
      const pose = poseAt(n * TAU / 360, { stride, lift, grip, cadence: 0.6 });
      finite(pose);
      for (const leg of pose.legs) {
        near(distance(leg.hip, leg.knee), D.thigh);
        near(distance(leg.knee, leg.ankle), D.shin);
        near(distance(leg.ankle, leg.footLocal), Math.hypot(...D.ankleLift));
        assert.ok(leg.footLocal[1] <= D.footY - 0.5, 'foot pin stays below the body');
      }
      for (const hand of pose.hands) {
        near(distance(hand.shoulder, hand.elbow), D.upperArm);
        near(distance(hand.elbow, hand.wrist), D.forearm);
        for (const finger of hand.fingers) {
          const [l1, l2] = D.fingerLengths[finger.index];
          assert.ok(l1 > 0 && l2 > 0 && finger.proximal >= 0 && finger.distal >= 0);
        }
      }
      for (const link of pose.neck.links) near(distance(link.start, link.end), D.neckLink);
      near(pose.neck.points.length, D.neckCount + 1);
      assert.ok(pose.metrics.linkResidualMm < 1e-9);
    }
  }
  const hip = [0.17, 0, 0], ankle = [0.17, -0.75, -0.2], bend = [0, 0, -1];
  const solved = solveTwoLink(hip, ankle, D.thigh, D.shin, bend);
  near(distance(hip, solved.knee), D.thigh); near(distance(solved.knee, ankle), D.shin);
  assert.ok(solved.knee[2] < 0, 'the knee is solved forward of the hip-to-ankle line');
  assert.ok(distance(solved.knee, hip) + distance(solved.knee, ankle) > distance(hip, ankle));
});

test('the foot path has a planted 62 percent stance, a clear swing and a continuous wrap', () => {
  const input = { stride: 0.3, lift: 0.16 };
  const start = footPath(0, input);
  assert.equal(start.stance, true); near(start.y, D.footY); near(start.z, -0.15);
  let previous = footPath(0.61, input);
  for (let q = 0.611; q < 0.62; q += 0.001) {
    const point = footPath(q, input);
    assert.equal(point.stance, true); near(point.y, D.footY);
    assert.ok(point.z >= previous.z - 1e-12, 'stance foot travels backward under the body, so the gait reads forward');
    previous = point;
  }
  const liftPoints = [];
  for (let q = 0.62; q <= 1; q += 0.002) liftPoints.push(footPath(q, input));
  assert.equal(liftPoints.some(point => point.y > D.footY + 0.1), true);
  near(Math.max(...liftPoints.map(point => point.y)), D.footY + input.lift);
  near(footPath(1, input).z, footPath(0, input).z); near(footPath(1, input).y, D.footY);
  for (const q of [0.619, 0.62, 0.621, 0.999, 0.001]) finite(footPath(q, input));
});

test('sampler is deterministic, periodic, finite, reversible and continuous through the wrap', () => {
  for (const cadence of [0.15, 0.42, 0.9]) for (const grip of [0, 55]) for (const t of [-999, -1.234, 0, 0.49, 19, 100000]) {
    const input = { cadence, grip, stride: 0.3, lift: 0.18 }, a = sample(t, input); finite(a);
    assert.ok(a.phase >= 0 && a.phase < 1); sample(t + 700, { grip: 12 }); assert.deepEqual(sample(t, input), a);
    const b = sample(t + 1 / cadence, input);
    a.legs.forEach((leg, i) => near(distance(leg.foot, b.legs[i].foot), 0, 5e-9));
    a.hands.forEach((hand, i) => near(distance(hand.wrist, b.hands[i].wrist), 0, 5e-9));
    near(distance(a.head.origin, b.head.origin), 0, 5e-9); near(cycleHz(input), cadence);
  }
  for (const t of [NaN, Infinity, -Infinity, Number.MAX_VALUE]) for (const input of [null, {}, { cadence: NaN, grip: Infinity }, { cadence: -9, stride: 9, lift: -9, grip: 999 }]) finite(sample(t, input));
  assert.deepEqual(inputsOf({ cadence: -100, stride: 99, lift: 9, grip: 900 }), { cadence: 0.15, stride: 0.36, lift: 0.2, grip: 55 });
  const a = sample(-1e-8), b = sample(1e-8); a.legs.forEach((leg, i) => near(distance(leg.foot, b.legs[i].foot), 0, 1e-7));
});

test('240 heavy assemblies, 2005 instances and 102360 balanced triangles keep every part in low', () => withModel(model => {
  assert.ok(model.parts.length >= 170); assert.equal(model.parts.length, 240);
  const ids = new Set(model.parts.map(part => part.id)); assert.equal(ids.size, model.parts.length);
  assert.equal(new Set(model.parts.map(part => part.name)).size, ids.size);
  for (const part of model.parts) {
    for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof part[key] === 'string' && part[key].length > (key === 'unit' ? 2 : 2), `${part.id}/${key}`);
    assert.ok(part.function.length + part.how.length > 80, `${part.id}: useful explanation`);
    assert.ok(part.function.length > 25 && part.how.length > 25);
  }
  for (const quality of ['low', 'balanced', 'high']) {
    model.update(sample(0.4), { quality });
    const used = counts(model);
    for (const part of model.parts) assert.ok(used.get(part.id) >= 1, `${part.id} visible in ${quality}`);
  }
  model.update(sample(0.4), { quality: 'balanced' });
  const balanced = { ...model.stats };
  budgetGate(balanced);
  assert.equal(balanced.instances, 2005);
  assert.equal(balanced.triangles, 102360);
  assert.equal(balanced.drawCalls, 31);
  model.update(sample(0.4), { quality: 'low' });
  assert.equal(model.stats.instances, 943);
  assert.equal(model.stats.triangles, 59616);
  assert.ok(model.stats.instances < balanced.instances, 'Efficient tier removes micro-detail only');
  assert.equal(model.parts.filter(part => /finger/.test(part.id)).length, 20);
  assert.equal(model.parts.filter(part => /toe/.test(part.id)).length, 6);
  assert.equal(model.parts.filter(part => /^pack\.vent\./.test(part.id)).length, 6);
  assert.equal(model.parts.filter(part => /^pelvis\.gearbox\./.test(part.id)).length, 4);
  assert.equal(model.parts.filter(part => /^shoulder\.(L|R)\.pauldron$/.test(part.id)).length, 2);
  assert.throws(() => budgetGate({ ...balanced, instances: 1399 }), /instances/);
}));

test('rendered legs, arms, head and fingers follow the sampled pose, not keyframes', () => withModel(model => {
  const state = sample(0.37, { cadence: 0.7, stride: 0.33, lift: 0.17, grip: 41 });
  model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
  model.group.updateMatrixWorld(true);
  const body = model.group.getObjectByName('pelvis.chassis'), torso = model.group.getObjectByName('torso.carrier');
  const offset = state.body.offset;
  for (const [i, leg] of state.legs.entries()) {
    const thigh = model.group.getObjectByName(`leg.${leg.id}.thigh`);
    const shin = model.group.getObjectByName(`leg.${leg.id}.shin`);
    const meta = model.group.getObjectByName(`leg.${leg.id}.metatarsus`);
    const foot = model.group.getObjectByName(`leg.${leg.id}.foot`);
    const hip = [leg.hip[0] + offset[0], leg.hip[1] + offset[1], leg.hip[2] + offset[2]];
    const knee = [leg.knee[0] + offset[0], leg.knee[1] + offset[1], leg.knee[2] + offset[2]];
    const ankle = [leg.ankle[0] + offset[0], leg.ankle[1] + offset[1], leg.ankle[2] + offset[2]];
    const sole = [leg.foot[0], leg.foot[1], leg.foot[2]];
    near(distance(worldOf(thigh, [0, 0, 0]), hip), 0, 2e-7);
    near(distance(worldOf(thigh, [0, D.thigh, 0]), knee), 0, 2e-7);
    near(distance(worldOf(shin, [0, D.shin, 0]), ankle), 0, 2e-7);
    near(distance(worldOf(meta, [0, Math.hypot(...D.ankleLift), 0]), sole), 0, 2e-7);
    near(distance(worldOf(foot, [0, 0, 0]), sole), 0, 2e-7);
    assert.equal(leg.stance, footPath(leg.phase, state.controls).stance);
  }
  for (const hand of state.hands) {
    const upper = model.group.getObjectByName(`arm.${hand.id}.upper`);
    const fore = model.group.getObjectByName(`arm.${hand.id}.forearm`);
    const frame = model.group.getObjectByName(`hand.${hand.id}.frame`);
    near(distance(worldOf(upper, [0, 0, 0]), worldOf(torso, hand.shoulder)), 0, 2e-7);
    near(distance(worldOf(upper, [0, D.upperArm, 0]), worldOf(torso, hand.elbow)), 0, 2e-7);
    near(distance(worldOf(fore, [0, D.forearm, 0]), worldOf(torso, hand.wrist)), 0, 2e-7);
    near(distance(worldOf(frame, [0, 0, 0]), worldOf(torso, hand.wrist)), 0, 2e-7);
    for (const finger of hand.fingers) {
      const group = model.group.getObjectByName(`hand.${hand.id}.digit.${finger.index + 1}`);
      const [l1, l2] = D.fingerLengths[finger.index];
      const proximal = model.group.getObjectByName(`finger.${hand.id}.${finger.index + 1}.proximal`);
      const distal = model.group.getObjectByName(`finger.${hand.id}.${finger.index + 1}.distal`);
      near(group.rotation.x, finger.thumb ? -.42 + finger.proximal * .8 : finger.proximal, 1e-12);
      near(distal.parent.rotation.x, finger.distal, 1e-12);
      near(distance(worldOf(proximal, [0, 0, 0]), worldOf(distal, [0, 0, 0])), l1, 1e-7);
      near(distance(worldOf(distal, [0, 0, 0]), worldOf(distal, [0, -l2, 0])), l2, 1e-7);
    }
  }
  const head = model.group.getObjectByName('head.carrier');
  near(distance(worldOf(head, [0, 0, 0]), worldOf(torso, state.head.origin)), 0, 2e-7);
  near(head.rotation.x, state.head.pitch, 1e-12); near(head.rotation.y, state.head.yaw, 1e-12);
  const jaw = model.group.getObjectByName('head.jawGroup');
  near(jaw.rotation.x, -state.head.jaw, 1e-12);
  assert.ok(body.position.distanceTo(new THREE.Vector3(...offset)) < 1e-12);
  assert.ok(Math.abs(torso.rotation.y - state.torso.yaw) < 1e-12);
}));

test('controls change real instance transforms at a frozen timestamp', () => withModel(model => {
  const base = sample(0.317);
  const reference = (() => { model.update(base, { quality: 'balanced', mode: 'solid', explode: 0 }); return JSON.stringify(snapshot(model)); })();
  for (const control of descriptor.controls) {
    for (const value of [control.min, control.max]) {
      const input = { ...DEFAULT_INPUTS, [control.key]: value };
      model.update(sample(0.317, input), { quality: 'balanced', mode: 'solid', explode: 0 });
      assert.notEqual(JSON.stringify(snapshot(model)), reference, `${control.key}=${value} changes real geometry`);
    }
  }
  model.update(sample(0.317), { quality: 'balanced', mode: 'solid', explode: 1 });
  const exploded = JSON.stringify(snapshot(model));
  model.update(sample(0.317), { quality: 'balanced', mode: 'solid', explode: 0 });
  assert.equal(JSON.stringify(snapshot(model)), reference, 'Explosion and reassembly leave no transform drift');
  assert.notEqual(exploded, reference);
  const period = 1 / descriptor.cycleHz(base.controls);
  model.update(sample(0.317 + period), { quality: 'balanced', mode: 'solid', explode: 0 });
  assert.equal(JSON.stringify(snapshot(model)), reference, 'the whole rendered pose repeats after one gait cycle');
}));

test('motion gate: 229 of 240 parts and 1871 instances move across nine non-commensurate phases', t => withModel(model => {
  // Golden-ratio offsets: deliberately not the nine equal phase divisions.
  const phases = [0.031, 0.649, 0.267, 0.885, 0.503, 0.121, 0.739, 0.357, 0.975];
  assert.equal(new Set(phases).size, 9);
  const snaps = phases.map(phase => {
    model.update(sample(phase / cycleHz(DEFAULT_INPUTS)), { quality: 'balanced', mode: 'solid', explode: 0 });
    return motionSnapshot(model);
  });
  const tolerance = 1e-5, moving = new Set();
  for (let k = 1; k < snaps.length; k++) for (const [id, values] of snaps[k].map) {
    const reference = snaps[0].map.get(id);
    for (let i = 0; i < values.length; i++) if (Math.abs(values[i] - reference[i]) > tolerance) { moving.add(id); break; }
  }
  let movingInstances = 0;
  for (const id of snaps[0].ids) if (moving.has(id)) movingInstances++;
  requireMotion(moving, model.parts.length);
  assert.ok(moving.size >= 200, `${moving.size} moving part IDs`);
  assert.ok(movingInstances >= 1700, `${movingInstances} moving instances`);
  for (const [name, pattern, minimum] of [
    ['limbs', /^(leg|arm)\./, 50],
    ['hands', /^(hand|finger)\./, 20],
    ['pauldrons', /^shoulder\.(L|R)\.pauldron$/, 2],
    ['vents', /^pack\.(vent|louver)\./, 6],
    ['gearbox', /^pelvis\.gearbox\./, 3],
    ['head', /^head\./, 15],
  ]) {
    const parts = model.parts.filter(part => pattern.test(part.id));
    const moved = parts.filter(part => moving.has(part.id));
    assert.ok(moved.length >= minimum, `${name}: ${moved.length}/${parts.length} move`);
  }
  assert.equal(moving.has('pelvis.girdle.L'), false, 'static pelvis plate is the negative control');
  assert.equal(moving.has('tether.hook'), false, 'static tether hook is the negative control');
  assert.throws(() => requireMotion(new Set(['pelvis.girdle.L']), model.parts.length), /parts move/);
  // The left pauldron must counter-swing against the left arm, not just follow the torso.
  const swingState = sample(0.211);
  model.update(swingState);
  const pauldron = model.group.getObjectByName('shoulder.L.pauldron');
  near(pauldron.rotation.x, -swingState.hands[0].swing * .62, 1e-12);
  t.diagnostic(`${moving.size}/${model.parts.length} moving parts, ${movingInstances}/${snaps[0].ids.length} moving instances`);
}));

test('floor, envelope, root identity, frame points and negative controls stay honest', t => withModel(model => {
  const swept = new THREE.Box3();
  let floor = Infinity, height = 0, width = 0, depth = 0;
  for (const input of [
    { stride: 0.24, lift: 0.12, grip: 24 },
    { stride: 0.36, lift: 0.20, grip: 55 },
    { stride: 0.12, lift: 0.05, grip: 0 },
  ]) for (let i = 0; i < 12; i++) {
    model.update(sample(i / (12 * 0.42), { cadence: 0.42, ...input }));
    const box = renderedBounds(model), size = box.getSize(new THREE.Vector3());
    requireFloor(box);
    swept.union(box);
    floor = Math.min(floor, box.min.y); height = Math.max(height, box.max.y);
    width = Math.max(width, size.x); depth = Math.max(depth, size.z);
    assert.ok(size.x <= 1.4, `width ${size.x}`); assert.ok(size.z <= 1.2, `depth ${size.z}`);
    assert.ok(box.max.y <= 2.45, `height ${box.max.y}`);
    assert.deepEqual(model.group.position.toArray(), [0, 0, 0]);
    assert.deepEqual(model.group.quaternion.toArray(), [0, 0, 0, 1]);
    assert.deepEqual(model.group.scale.toArray(), [1, 1, 1]);
  }
  model.group.traverse(node => assert.ok(node.scale.x >= 0 && node.scale.y >= 0 && node.scale.z >= 0, `${node.name}: negative scale`));
  assert.ok(model.framePoints.length >= 500, `${model.framePoints.length} frame points`);
  for (const point of model.framePoints) finite(point.toArray());
  const framed = new THREE.Box3().setFromPoints(model.framePoints);
  assert.ok(framed.containsBox(swept), `camera frame ${framed.min.toArray()}..${framed.max.toArray()} misses swept ${swept.min.toArray()}..${swept.max.toArray()}`);
  assert.ok(framed.max.y < 2.5 && framed.max.y > 2.2, 'camera frame covers the full machine height');
  assert.throws(() => requireFloor(new THREE.Box3(new THREE.Vector3(-0.1, -0.02, -0.1), new THREE.Vector3(0.1, 0.1, 0.1))), /floor/);
  t.diagnostic(`floor ${floor.toFixed(4)} m; envelope ${width.toFixed(3)} W × ${depth.toFixed(3)} D × ${height.toFixed(3)} H m; ${model.framePoints.length} frame points`);
}));

test('dispose is idempotent and later updates and queries are inert', () => withModel(model => {
  model.update(sample(0.5), { quality: 'high', mode: 'xray', explode: 0.4 });
  const frozen = { ...model.stats };
  model.dispose(); model.dispose();
  assert.equal(model.group.children.length, 0); assert.equal(model.pickables.length, 0);
  assert.doesNotThrow(() => model.update(sample(0.9), { quality: 'low' }));
  assert.deepEqual(model.stats, frozen);
  assert.equal(model.pickables.length, 0);
}));
