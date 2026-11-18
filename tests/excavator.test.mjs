import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/excavator/index.js';
import { D, DEFAULT_INPUTS, sample, poseAt, workCycle, inputsOf, distance } from '../src/mechanisms/excavator/kin.js';

const near = (a, b, eps = 1e-9, message = '') => assert.ok(Math.abs(a - b) <= eps, `${message} ${a} != ${b}`);
const finite = value => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(finite);
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
};
const period = () => 1 / descriptor.cycleHz(DEFAULT_INPUTS);

function instanceSnapshot(model) {
  model.group.updateMatrixWorld(true);
  return model.pickables.filter(mesh => mesh.count).map(mesh => ({
    count: mesh.count,
    matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
  }));
}

function partBounds(model, id) {
  const box = new THREE.Box3(), local = new THREE.Matrix4(), world = new THREE.Matrix4(), geometry = new THREE.Box3();
  for (const mesh of model.pickables) {
    if (!mesh.count) continue;
    mesh.geometry.computeBoundingBox();
    for (let i = 0; i < mesh.count; i++) {
      if (mesh.userData.instanceParts[i] !== id) continue;
      mesh.getMatrixAt(i, local); world.multiplyMatrices(mesh.matrixWorld, local);
      geometry.copy(mesh.geometry.boundingBox).applyMatrix4(world); box.union(geometry);
    }
  }
  return box;
}

test('TERRA X7: exact links, automatic duty cycle and bounded trims', () => {
  assert.equal(descriptor.id, 'excavator');
  assert.equal(descriptor.specs.length, 2);
  assert.equal(descriptor.lessons.length, 5);
  assert.equal(descriptor.controls.length, 5);
  for (const control of descriptor.controls) assert.ok(descriptor.defaultInputs[control.key] >= control.min && descriptor.defaultInputs[control.key] <= control.max);
  assert.equal(D.shoeCount, 16);
  assert.equal(inputsOf({ boom: -99 }).boom, 20);
  assert.equal(inputsOf({ stick: 999 }).stick, 110);
  assert.equal(inputsOf({ bucket: 0 }).bucket, 15);

  const inputs = [DEFAULT_INPUTS,
    { ...DEFAULT_INPUTS, slew: -35, boom: 20, stick: 40, bucket: 15 },
    { ...DEFAULT_INPUTS, slew: 35, boom: 55, stick: 110, bucket: 75 }];
  for (const input of inputs) for (let i = 0; i < 32; i++) {
    const pose = sample(i / 32 / descriptor.cycleHz(input), input);
    finite(pose);
    near(distance(pose.boom.pivot, pose.boom.tip), D.boomLength, 1e-9, 'boom');
    near(distance(pose.stick.start, pose.stick.end), D.stickLength, 1e-9, 'stick');
    near(distance(pose.bucket.pivot, pose.bucket.tip), D.bucketLength, 1e-9, 'bucket');
    near(distance(pose.bucket.pivot, pose.bucket.lever), D.leverLength, 1e-9, 'lever');
    near(distance(pose.bucket.rockerPivot, pose.bucket.rockerEnd), D.rockerLength, 1e-9, 'rocker');
    near(distance(pose.bucket.rockerEnd, pose.bucket.lever), D.linkLength, 1e-9, 'link');
    assert.ok(pose.bucket.tip[1] > .2, `bucket clears the floor at ${i / 32}`);
    assert.ok(pose.metrics.linkResidualMm < 1e-6);
  }

  const a = sample(.18 * period()), b = sample(.82 * period());
  assert.ok(Math.abs(a.house.slewDeg - b.house.slewDeg) > 8, 'house swings through the duty cycle');
  assert.ok(Math.abs(a.boom.deg - b.boom.deg) > 6, 'boom moves through the duty cycle');
  assert.ok(Math.abs(a.stick.foldDeg - b.stick.foldDeg) > 12, 'stick folds through the duty cycle');
  assert.ok(Math.abs(a.bucket.deg - b.bucket.deg) > 20, 'bucket curls through the duty cycle');
  const loop = sample(.18 * period() + period());
  near(loop.phase, a.phase, 1e-12);
  near(loop.bucket.tip[1], a.bucket.tip[1], 1e-9);
  near(loop.house.slewDeg, a.house.slewDeg, 1e-9);
  near(workCycle(0).yaw, workCycle(1).yaw, 1e-12);
  for (const key of ['yaw', 'boom', 'stick', 'bucket']) near(workCycle(.999999)[key], workCycle(0)[key], .01);
});

test('TERRA X7: massive anatomy, cab riser and visible slew column', async () => {
  const model = await descriptor.createModel();
  try {
    assert.ok(model.parts.length >= 100, `${model.parts.length} selectable parts`);
    const ids = new Set(model.parts.map(part => part.id));
    assert.equal(ids.size, model.parts.length);
    assert.equal(new Set(model.parts.map(part => part.name)).size, model.parts.length);
    for (const part of model.parts) {
      assert.ok(part.function.length > 25 && part.how.length > 25 && part.material.length > 3, `${part.id}: useful metadata`);
      assert.ok(part.detail.includes(part.name), `${part.id}: detail carries the name`);
    }
    for (const id of ['cab.riser', 'cab.brace', 'cab.beacon', 'carbody.column', 'track.guard.L',
      'track.tensioner.L', 'house.platform', 'house.swingMotor', 'house.slewPinion', 'engine.fan',
      'boom.beam', 'stick.beam', 'bucket.shell', 'bucket.edge']) assert.ok(ids.has(id), id);
    assert.ok(model.framePoints.length > 1000, 'whole-cycle camera envelope');
    assert.ok(Array.isArray(model.views?.home));

    const state = descriptor.sample(.317);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances >= 800 && model.stats.instances <= 1500, `instances ${model.stats.instances}`);
    assert.ok(model.stats.triangles >= 35000 && model.stats.triangles <= 100000, `triangles ${model.stats.triangles}`);
    assert.ok(model.stats.drawCalls <= 35, `draws ${model.stats.drawCalls}`);

    const riser = partBounds(model, 'cab.riser'), cab = partBounds(model, 'cab.frame'), platform = partBounds(model, 'house.platform');
    assert.ok(!riser.isEmpty() && !cab.isEmpty() && !platform.isEmpty());
    assert.ok(riser.max.y >= cab.min.y - .02, `cab lands on its riser: ${riser.max.y} / ${cab.min.y}`);
    assert.ok(riser.min.y <= platform.max.y + .01, 'riser reaches the deck');
    const column = partBounds(model, 'carbody.column'), turntable = partBounds(model, 'house.turntable');
    assert.ok(column.max.y >= turntable.min.y - .02, 'slew column reaches the turntable');

    const full = model.stats.instances;
    model.update(state, { quality: 'low', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances < full, 'Efficient removes micro-detail');
    const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
    assert.equal(visible.size, model.parts.length, 'Efficient keeps every selectable part');
  } finally { model.dispose(); model.dispose(); }
  assert.equal(model.pickables.length, 0);
});

test('TERRA X7: automatic arm, tracks and accessories move; static blade remains a control', async () => {
  const model = await descriptor.createModel();
  try {
    const phases = [.017, .144, .271, .398, .525, .652, .779, .886, .963];
    const frames = [];
    for (const phase of phases) {
      model.update(descriptor.sample(phase * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
      frames.push(model.pickables.map(mesh => ({
        ids: mesh.userData.instanceParts.slice(0, mesh.count),
        count: mesh.count,
        matrices: Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)),
      })));
    }
    const movingParts = new Set(), movingInstances = new Set();
    for (let a = 0; a < frames.length; a++) for (let b = a + 1; b < frames.length; b++) {
      for (let m = 0; m < frames[a].length; m++) {
        const A = frames[a][m], B = frames[b][m], count = Math.min(A.count, B.count);
        for (let i = 0; i < count; i++) {
          let delta = 0;
          for (let k = 0; k < 16; k++) delta = Math.max(delta, Math.abs(A.matrices[i * 16 + k] - B.matrices[i * 16 + k]));
          if (delta > 1e-5) { movingInstances.add(`${m}:${i}`); movingParts.add(A.ids[i]); }
        }
      }
    }
    assert.ok(movingParts.size / model.parts.length >= .75, `${movingParts.size}/${model.parts.length} parts move`);
    assert.ok(movingInstances.size >= 300, `${movingInstances.size} instances move`);
    for (const id of ['cab.riser', 'cab.frame', 'boom.beam', 'stick.beam', 'bucket.shell', 'boom.ram.barrel',
      'engine.fan', 'cab.beacon', 'house.slewPinion', 'shoe.L.01', 'idler.L', 'house.counterweight']) assert.ok(movingParts.has(id), id);
    for (const id of ['blade.plate', 'blade.arms', 'track.guard.L', 'track.tensioner.L']) assert.ok(!movingParts.has(id), `${id} is a static control`);

    const tip = id => { const node = model.group.getObjectByName(id); return node.quaternion.toArray().concat(node.position.toArray()); };
    model.update(descriptor.sample(.12 * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    const first = { boom: tip('boom.beam'), stick: tip('stick.beam'), bucket: tip('bucket.shell') };
    const fan = model.group.getObjectByName('engine.fan').rotation.z;
    model.update(descriptor.sample(.66 * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.notDeepEqual(tip('boom.beam'), first.boom, 'boom has relative articulation');
    assert.notDeepEqual(tip('stick.beam'), first.stick, 'stick has relative articulation');
    assert.notDeepEqual(tip('bucket.shell'), first.bucket, 'bucket has relative articulation');
    assert.notEqual(model.group.getObjectByName('engine.fan').rotation.z, fan, 'cooling fan spins');
    assert.notEqual(model.group.getObjectByName('cab.beacon').rotation.y, 0, 'beacon rotor turns');

    model.update(descriptor.sample(.12 * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(tip('boom.beam'), first.boom, 'repeated pose restores the arm exactly');
    assert.deepEqual(model.group.position.toArray(), [0, 0, 0]);
    assert.deepEqual(model.group.quaternion.toArray(), [0, 0, 0, 1]);
  } finally { model.dispose(); }
});

test('TERRA X7: explosion, material modes and teardown remain exact', async () => {
  const model = await descriptor.createModel();
  try {
    const state = descriptor.sample(.42);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    const assembled = instanceSnapshot(model);
    model.update(state, { quality: 'low', mode: 'xray', explode: 1 });
    assert.notDeepEqual(instanceSnapshot(model), assembled);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(instanceSnapshot(model), assembled);
    for (const quality of ['balanced', 'low', 'high']) {
      model.update(state, { quality, mode: 'cutaway', explode: .4 });
      finite(model.stats);
      assert.ok(model.stats.triangles > 10000 && model.stats.triangles <= 200000);
    }
    model.dispose(); model.dispose();
    assert.equal(model.pickables.length, 0);
    assert.equal(model.group.children.length, 0);
  } finally { model.dispose(); }
});
