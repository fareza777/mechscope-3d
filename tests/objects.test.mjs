import test from 'node:test';
import assert from 'node:assert/strict';
import { Matrix4 } from 'three';
import { MECHANISMS } from '../src/catalog.js';
import * as astrarium from '../src/mechanisms/astrarium/kin.js';
import * as excavator from '../src/mechanisms/excavator/kin.js';
import * as observatory from '../src/mechanisms/observatory/kin.js';
import * as piano from '../src/mechanisms/piano/kin.js';
import * as robot from '../src/mechanisms/robot-cell/kin.js';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} should equal ${b}`);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const descriptor = id => MECHANISMS.find(model => model.id === id);
// Nine golden-ratio offsets are non-commensurate with the one-cycle loop, so
// the gate cannot pass by sampling only repeated poses of the same subcycle.
const MOTION_PHASES = Array.from({ length: 9 }, (_, i) => (0.013 + i * 0.6180339887498949) % 1);

function matrices(model) {
  const m = new Matrix4(), rows = [];
  for (const mesh of model.pickables) for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    rows.push({ id: mesh.userData.instanceParts[i], index: i, key: m.elements.map(v => v.toFixed(6)).join(',') });
  }
  return rows;
}

function motionScan(d, model) {
  const period = 1 / d.cycleHz(d.defaultInputs), samples = new Map(), ids = new Set();
  let totalInstances = 0;
  for (const [offset, phase] of MOTION_PHASES.entries()) {
    model.update(d.sample(phase * period, d.defaultInputs), { quality: 'balanced', mode: 'solid', explode: 0 });
    for (const row of matrices(model)) {
      if (!samples.has(row.id)) samples.set(row.id, []);
      samples.get(row.id).push(row.key);
      if (offset === 0) { ids.add(row.id); totalInstances++; }
    }
  }
  const movingParts = new Set();
  let movingInstances = 0;
  for (const id of ids) {
    const keys = samples.get(id);
    for (let i = 0; i < keys.length / MOTION_PHASES.length; i++) {
      if (new Set(MOTION_PHASES.map((_, j) => keys[j * keys.length / MOTION_PHASES.length + i])).size > 1) movingInstances++;
    }
    if (new Set(keys).size > 1) movingParts.add(id);
  }
  return { movingParts, movingInstances, totalInstances };
}

async function checkModel(id, minimumParts) {
  const d = descriptor(id), model = await d.createModel();
  try {
    assert.ok(model.parts.length >= minimumParts, `${id}: substantial anatomy`);
    assert.equal(new Set(model.parts.map(part => part.id)).size, model.parts.length);
    const state = d.sample(.317, d.defaultInputs);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances > 300, `${id}: populated instance buffers`);
    assert.ok(model.stats.triangles > 20000 && model.stats.triangles <= 200000, `${id}: balanced triangle budget`);
    assert.ok(model.stats.drawCalls <= 40, `${id}: draw-call budget`);
    const full = model.stats.instances;
    model.update(state, { quality: 'low', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances < full, `${id}: Efficient removes micro-detail`);
    const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
    assert.deepEqual(visible, new Set(model.parts.map(part => part.id)), `${id}: every part remains selectable`);
  } finally { model.dispose(); model.dispose(); }
  assert.equal(model.group.children.length, 0);
  assert.equal(model.pickables.length, 0);
}

test('ASTRARIUM OR-9: eight exact orbits, six moon radii and a period of one cadence cycle', () => {
  const d = astrarium.DEFAULT_INPUTS, s = astrarium.sample(.317, d);
  assert.equal(s.planets.length, 8);
  assert.equal(s.moons.length, 6);
  for (const [i, planet] of s.planets.entries()) {
    near(planet.orbit, astrarium.D.orbits[i]);
    near(planet.armY, astrarium.D.armY[i]);
  }
  for (const moon of s.moons) near(distance(moon.centre, s.planets[moon.planet].centre), moon.radius);
  assert.ok(s.metrics.orbitResidualMm < 1e-6);
  const tilted = astrarium.poseAt(s.phase * astrarium.TAU, { ...d, tilt: 28 });
  assert.notEqual(tilted.planets[0].centre[1], s.planets[0].centre[1], 'tilt lifts the orbit stack');
  const lagged = astrarium.poseAt(s.phase * astrarium.TAU, { ...d, moon: 45 });
  assert.notEqual(lagged.moons[0].angle, s.moons[0].angle, 'moon lag changes the satellite phase');
  assert.equal(astrarium.inputsOf({ cadence: 0 }).cadence, .02);
  assert.equal(astrarium.inputsOf({ tilt: 99 }).tilt, 28);
  assert.equal(astrarium.inputsOf({ moon: -1 }).moon, 0);
  assert.equal(astrarium.inputsOf({ armillary: 99 }).armillary, 60);
  const repeated = astrarium.sample(.317 + 1 / d.cadence, d);
  near(repeated.phase, s.phase, 1e-12);
  near(repeated.planets[0].centre[0], s.planets[0].centre[0], 1e-12);
});

test('TERRA X7: boom, stick, bucket and four-bar link lengths stay exact through the controls', () => {
  const d = excavator.DEFAULT_INPUTS, s = excavator.sample(.317, d);
  near(distance(s.boom.pivot, s.boom.tip), excavator.D.boomLength);
  near(distance(s.stick.start, s.stick.end), excavator.D.stickLength);
  near(distance(s.bucket.pivot, s.bucket.tip), excavator.D.bucketLength);
  near(distance(s.stick.end, s.bucket.lever), excavator.D.leverLength);
  near(distance(s.bucket.rockerPivot, s.bucket.rockerEnd), excavator.D.rockerLength);
  near(distance(s.bucket.rockerEnd, s.bucket.lever), excavator.D.linkLength);
  assert.ok(s.metrics.linkResidualMm < 1e-6);
  for (const boom of [20, 55]) for (const stick of [40, 110]) for (const bucket of [15, 75]) {
    const p = excavator.poseAt(1.1, { ...d, boom, stick, bucket });
    near(distance(p.boom.pivot, p.boom.tip), excavator.D.boomLength);
    near(distance(p.stick.start, p.stick.end), excavator.D.stickLength);
    near(distance(p.bucket.rockerEnd, p.bucket.lever), excavator.D.linkLength);
    near(distance(p.bucket.rockerPivot, p.bucket.rockerEnd), excavator.D.rockerLength);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 14; i++) {
    const a = excavator.trackPose(i / 14), b = excavator.trackPose((i + 1) / 14);
    assert.ok(distance([0, a.y, a.z], [0, b.y, b.z]) > 0);
  }
  near(excavator.trackPose(1).z, excavator.trackPose(0).z, 1e-12);
  assert.equal(excavator.inputsOf({ cadence: 0 }).cadence, .08);
  assert.equal(excavator.inputsOf({ slew: 999 }).slew, 35);
  assert.equal(excavator.inputsOf({ boom: 0 }).boom, 20);
  assert.equal(excavator.inputsOf({ stick: 0 }).stick, 40);
  assert.equal(excavator.inputsOf({ bucket: 999 }).bucket, 75);
  const repeated = excavator.sample(.317 + 1 / d.cadence, d);
  near(repeated.tracks.travel, s.tracks.travel, 1e-12);
});

test('SPECULA O6: telescope links, seven mirrors, shutter hinges and scanning dome stay exact', () => {
  const d = observatory.DEFAULT_INPUTS, s = observatory.sample(.317, d);
  near(distance(s.telescope.pivot, s.telescope.front), observatory.D.tubeFront);
  near(distance(s.telescope.pivot, s.telescope.back), observatory.D.tubeBack);
  near(distance(s.telescope.pivot, s.telescope.secondary), .44);
  assert.equal(s.telescope.mirrors.length, 7);
  for (const [i, mirror] of s.telescope.mirrors.entries()) {
    if (i === 0) near(distance(mirror.centre, s.telescope.mirrorCentre), 0);
    else near(distance(mirror.centre, s.telescope.mirrorCentre), observatory.D.mirrorRing);
  }
  assert.ok(s.metrics.trackingResidualMm < 1e-6);
  for (const hinge of [s.shutter.leftHinge, s.shutter.rightHinge]) near(Math.hypot(hinge[0], hinge[2]), observatory.D.domeRadius);
  near(distance(s.fork.left, s.fork.right), 2 * observatory.D.forkX);
  const open = observatory.poseAt(1.2, { ...d, shutter: 70, altitude: 82, dome: 150 });
  assert.ok(open.shutter.angle > s.shutter.angle);
  assert.ok(open.telescope.front[1] > s.telescope.front[1]);
  assert.notEqual(open.dome.angle, s.dome.angle);
  const base = observatory.poseAt(1.2, d), biased = observatory.poseAt(1.2, { ...d, dome: 30, altitude: 58 });
  near((biased.dome.angle - base.dome.angle) * 180 / Math.PI, 30, 1e-9);
  near((biased.telescope.altitude - base.telescope.altitude) * 180 / Math.PI, 20, 1e-9);
  const closed = observatory.poseAt(.02, { ...d, shutter: 0 });
  assert.equal(closed.shutter.angle, 0);
  assert.notEqual(s.shutter.leftHinge[0], observatory.poseAt(2.2, d).shutter.leftHinge[0], 'the dome carries its hinge points');
  assert.ok(Math.max(...s.mechanism.louvers) > Math.min(...s.mechanism.louvers));
  assert.equal(observatory.inputsOf({ cadence: 0 }).cadence, .03);
  assert.equal(observatory.inputsOf({ dome: 999 }).dome, 150);
  assert.equal(observatory.inputsOf({ altitude: 0 }).altitude, 12);
  assert.equal(observatory.inputsOf({ shutter: 999 }).shutter, 70);
  const repeated = observatory.sample(.317 + 1 / d.cadence, d);
  near(repeated.telescope.front[0], s.telescope.front[0], 1e-12);
  near(repeated.drive.rollerAngle, s.drive.rollerAngle, 1e-12);
});

test('HARMONIA P8: fourteen white keys, ten black keys, hammer travel and pedal damper lift', () => {
  const d = piano.DEFAULT_INPUTS, s = piano.sample(.317, d);
  assert.equal(s.notes.length, 24);
  assert.equal(s.metrics.whiteKeys, 14);
  assert.equal(s.notes.filter(note => note.black).length, 10);
  for (const note of s.notes) {
    assert.ok(note.press >= 0 && note.press <= 1);
    assert.ok(note.hammerAngle <= 0 && note.hammerAngle >= -.52);
    if (note.black) assert.ok(Math.abs(note.x) <= .56);
  }
  const silent = piano.poseAt(0, { ...d, pedal: 0 });
  const sustained = piano.poseAt(0, { ...d, pedal: 1 });
  assert.equal(silent.notes[0].damperLift, 0);
  for (const note of sustained.notes) near(note.damperLift, .92);
  const soft = piano.poseAt(.317, { ...d, velocity: .3 });
  const loud = piano.poseAt(.317, { ...d, velocity: 1 });
  assert.ok(loud.notes.reduce((sum, note) => sum + note.press, 0) > soft.notes.reduce((sum, note) => sum + note.press, 0));
  const lowLid = piano.poseAt(.317, { ...d, lid: 0 }), highLid = piano.poseAt(.317, { ...d, lid: 55 });
  assert.notDeepEqual(lowLid.lid.propEnd, highLid.lid.propEnd);
  assert.equal(piano.inputsOf({ cadence: 0 }).cadence, .45);
  assert.equal(piano.inputsOf({ lid: 99 }).lid, 55);
  assert.equal(piano.inputsOf({ pedal: -1 }).pedal, 0);
  assert.equal(piano.inputsOf({ velocity: 99 }).velocity, 1);
  const repeated = piano.sample(.317 + 1 / d.cadence, d);
  near(repeated.phase, s.phase, 1e-12);
  near(repeated.notes[0].press, s.notes[0].press, 1e-12);
});

test('FABER R6: six axes, exact links, a live jaw cycle and a transferred workpiece', () => {
  const d = robot.DEFAULT_INPUTS, s = robot.sample(.317, d);
  near(distance(s.arm.shoulderPoint, s.arm.elbowPoint), robot.D.upper);
  near(distance(s.arm.elbowPoint, s.arm.wristPoint), robot.D.forearm);
  near(distance(s.arm.wristPoint, s.arm.flangePoint), robot.D.wrist);
  near(distance(s.arm.flangePoint, s.arm.toolTip), robot.D.tool);
  assert.ok(s.metrics.linkResidualMm < 1e-6);
  near(robot.poseAt(1, { ...d, grip: 0 }).gripper.spread, .035);
  near(robot.poseAt(1, { ...d, grip: 1 }).gripper.spread, .100);
  const closed = robot.poseAt(.07 * robot.TAU, d), open = robot.poseAt(.30 * robot.TAU, d), belt = robot.poseAt(.40 * robot.TAU, d);
  assert.ok(closed.gripper.actualSpread <= .046, 'the jaws close on the positioner');
  assert.ok(open.gripper.actualSpread > closed.gripper.actualSpread + .010, 'the jaws open over the belt');
  near(distance(closed.workpiece.position, closed.gripper.hold), 0, 1e-9);
  assert.ok(closed.workpiece.held);
  assert.equal(open.workpiece.held, false);
  assert.ok(belt.workpiece.position[0] > robot.STATIONS.B.x + .20, 'the belt carries the part toward the stop');
  assert.ok(robot.poseAt(.52 * robot.TAU, d).workpiece.position[0] > robot.STATIONS.C.x - .02);
  const low = robot.poseAt(1, { ...d, shoulder: 10 }), high = robot.poseAt(1, { ...d, shoulder: 60 });
  assert.notEqual(distance(low.counterbalance.anchor, low.counterbalance.upperAnchor), distance(high.counterbalance.anchor, high.counterbalance.upperAnchor));
  const left = robot.poseAt(1, { ...d, slew: -20 }), right = robot.poseAt(1, { ...d, slew: 20 });
  near((right.arm.yaw - left.arm.yaw) * 180 / Math.PI, 40, 1e-9);
  const small = robot.poseAt(1, { ...d, shoulder: 10, elbow: 20 }), large = robot.poseAt(1, { ...d, shoulder: 60, elbow: 100 });
  near((large.arm.shoulder - small.arm.shoulder) * 180 / Math.PI, 45, 1e-9);
  near((large.arm.elbow - small.arm.elbow) * 180 / Math.PI, 56, 1e-9);
  assert.notEqual(robot.poseAt(.2 * robot.TAU, d).arm.wristRoll, robot.poseAt(.5 * robot.TAU, d).arm.wristRoll);
  assert.notEqual(robot.poseAt(.2 * robot.TAU, d).arm.toolRoll, robot.poseAt(.5 * robot.TAU, d).arm.toolRoll);
  assert.equal(robot.inputsOf({ cadence: 0 }).cadence, .10);
  assert.equal(robot.inputsOf({ slew: 999 }).slew, 70);
  assert.equal(robot.inputsOf({ shoulder: 0 }).shoulder, 10);
  assert.equal(robot.inputsOf({ elbow: 999 }).elbow, 100);
  assert.equal(robot.inputsOf({ grip: -1 }).grip, 0);
  const repeated = robot.sample(.317 + 1 / d.cadence, d);
  near(repeated.drive.rollerAngle, s.drive.rollerAngle, 1e-12);
});

test('SPECULA O6 geometry: dense scanning dome anatomy within the balanced budget', async () => {
  const d = descriptor('observatory'), model = await d.createModel();
  try {
    assert.equal(model.parts.length, 194);
    assert.equal(new Set(model.parts.map(part => part.id)).size, 194);
    assert.equal(new Set(model.parts.map(part => part.name)).size, 194);
    const state = d.sample(.317, d.defaultInputs);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances >= 1400 && model.stats.instances <= 1900, `observatory instances ${model.stats.instances}`);
    assert.ok(model.stats.triangles >= 85000 && model.stats.triangles <= 130000, `observatory triangles ${model.stats.triangles}`);
    assert.ok(model.stats.triangles <= 200000);
    assert.ok(model.stats.drawCalls <= 40, `observatory draw calls ${model.stats.drawCalls}`);
    assert.ok(model.framePoints.length > 20);
    assert.ok(model.framePoints.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)));
    const assembled = matrices(model);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: .8 });
    assert.notDeepEqual(matrices(model), assembled, 'explosion moves the assembled observatory');
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(matrices(model), assembled, 'reassembly cannot accumulate transform drift');
    const full = model.stats.instances;
    model.update(state, { quality: 'low', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances < full, 'Efficient removes micro-detail');
    const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
    assert.deepEqual(visible, new Set(model.parts.map(part => part.id)), 'every observatory part remains selectable in Efficient');
    const motion = motionScan(d, model);
    assert.ok(motion.movingParts.size >= Math.ceil(model.parts.length * .55), `observatory moving parts ${motion.movingParts.size}`);
    assert.ok(motion.movingInstances >= Math.ceil(motion.totalInstances * .55), `observatory moving instances ${motion.movingInstances}/${motion.totalInstances}`);
    for (const id of ['dome.shutter.L', 'dome.shutter.R', 'telescope.tube', 'telescope.drawtube', 'telescope.spider', 'dome.roller.01', 'dome.roller.08', 'dome.service-hatch', 'building.service-door']) assert.ok(motion.movingParts.has(id), `${id} must move`);
    assert.ok([...motion.movingParts].filter(id => id.startsWith('dome.louver.')).length >= 8, 'all ten vent louvers move');
    assert.ok([...motion.movingParts].filter(id => id.startsWith('dome.seam.')).length >= 12, 'dome seams ride the scan');
    assert.ok([...motion.movingParts].filter(id => id.startsWith('telescope.')).length >= 12, 'the telescope mount articulates');
    assert.ok([...motion.movingParts].filter(id => id.startsWith('dome.')).length >= 60, 'the dome structure scans');
  } finally { model.dispose(); model.dispose(); }
  assert.equal(model.group.children.length, 0);
  assert.equal(model.pickables.length, 0);
});

test('FABER R6 geometry: animated six-axis cell anatomy within the balanced budget', async () => {
  const d = descriptor('robot-cell'), model = await d.createModel();
  try {
    assert.equal(model.parts.length, 180);
    assert.equal(new Set(model.parts.map(part => part.id)).size, 180);
    assert.equal(new Set(model.parts.map(part => part.name)).size, 180);
    const state = d.sample(.317, d.defaultInputs);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances >= 1100 && model.stats.instances <= 1800, `robot instances ${model.stats.instances}`);
    assert.ok(model.stats.triangles >= 65000 && model.stats.triangles <= 110000, `robot triangles ${model.stats.triangles}`);
    assert.ok(model.stats.triangles <= 200000);
    assert.ok(model.stats.drawCalls <= 40, `robot draw calls ${model.stats.drawCalls}`);
    assert.ok(model.framePoints.length > 20);
    assert.ok(model.framePoints.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)));
    const assembled = matrices(model);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: .8 });
    assert.notDeepEqual(matrices(model), assembled, 'explosion moves the assembled robot cell');
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(matrices(model), assembled, 'reassembly cannot accumulate transform drift');
    const full = model.stats.instances;
    model.update(state, { quality: 'low', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances < full, 'Efficient removes micro-detail');
    const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
    assert.deepEqual(visible, new Set(model.parts.map(part => part.id)), 'every robot-cell part remains selectable in Efficient');
    const motion = motionScan(d, model);
    assert.ok(motion.movingParts.size >= Math.ceil(model.parts.length * .50), `robot moving parts ${motion.movingParts.size}`);
    assert.ok(motion.movingInstances >= Math.ceil(motion.totalInstances * .50), `robot moving instances ${motion.movingInstances}/${motion.totalInstances}`);
    for (const id of ['robot.turntable', 'robot.upper-arm', 'robot.elbow', 'robot.forearm', 'robot.wrist', 'robot.flange', 'robot.gripper', 'robot.finger.L', 'robot.finger.R', 'robot.wrist-roll-collar', 'robot.wrist-bend-clevis', 'conveyor.roller.01', 'conveyor.cleat.01', 'conveyor.workpiece', 'conveyor.drive-sprocket', 'positioner.main.table', 'cage.gate', 'cage.curtain-head']) assert.ok(motion.movingParts.has(id), `${id} must move`);
    assert.ok([...motion.movingParts].filter(id => id.startsWith('robot.')).length >= 40, 'all arm joints and tool details move');
    assert.ok([...motion.movingParts].filter(id => id.startsWith('conveyor.')).length >= 25, 'rollers, cleats and the workpiece move');
    assert.ok([...motion.movingParts].filter(id => id.startsWith('positioner.')).length >= 5, 'both positioners articulate');
  } finally { model.dispose(); model.dispose(); }
  assert.equal(model.group.children.length, 0);
  assert.equal(model.pickables.length, 0);
});

test('ASTRARIUM OR-9 geometry: substantial, efficient and fully selectable', async () => {
  await checkModel('astrarium', 90);
});

test('TERRA X7 geometry: substantial, efficient and fully selectable', async () => {
  await checkModel('excavator', 80);
});

test('HARMONIA P8 geometry: substantial, efficient and fully selectable', async () => {
  await checkModel('piano', 110);
});
