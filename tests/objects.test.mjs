import test from 'node:test';
import assert from 'node:assert/strict';
import { MECHANISMS } from '../src/catalog.js';
import * as astrarium from '../src/mechanisms/astrarium/kin.js';
import * as excavator from '../src/mechanisms/excavator/kin.js';
import * as observatory from '../src/mechanisms/observatory/kin.js';
import * as piano from '../src/mechanisms/piano/kin.js';
import * as robot from '../src/mechanisms/robot-cell/kin.js';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} should equal ${b}`);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const descriptor = id => MECHANISMS.find(model => model.id === id);

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
  near(excavator.trackPose(0).z, excavator.trackPose(1).z, 1e-12);
  assert.equal(excavator.inputsOf({ cadence: 0 }).cadence, .08);
  assert.equal(excavator.inputsOf({ slew: 999 }).slew, 35);
  assert.equal(excavator.inputsOf({ boom: 0 }).boom, 20);
  assert.equal(excavator.inputsOf({ stick: 0 }).stick, 40);
  assert.equal(excavator.inputsOf({ bucket: 999 }).bucket, 75);
  const repeated = excavator.sample(.317 + 1 / d.cadence, d);
  near(repeated.tracks.travel, s.tracks.travel, 1e-12);
});

test('SPECULA O6: telescope links, seven mirrors, shutter leaves and dome azimuth stay exact', () => {
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
  const open = observatory.poseAt(1.2, { ...d, shutter: 70, altitude: 82, dome: 150 });
  assert.ok(open.shutter.angle > s.shutter.angle);
  assert.ok(open.telescope.front[1] > s.telescope.front[1]);
  assert.notEqual(open.dome.angle, s.dome.angle);
  assert.equal(observatory.inputsOf({ cadence: 0 }).cadence, .03);
  assert.equal(observatory.inputsOf({ dome: 999 }).dome, 150);
  assert.equal(observatory.inputsOf({ altitude: 0 }).altitude, 12);
  assert.equal(observatory.inputsOf({ shutter: 999 }).shutter, 70);
  const repeated = observatory.sample(.317 + 1 / d.cadence, d);
  near(repeated.telescope.front[0], s.telescope.front[0], 1e-12);
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

test('FABER R6: six axes, exact arm links, a 70-200 mm jaw gap and a sampled counterbalance', () => {
  const d = robot.DEFAULT_INPUTS, s = robot.sample(.317, d);
  near(distance(s.arm.shoulderPoint, s.arm.elbowPoint), robot.D.upper);
  near(distance(s.arm.elbowPoint, s.arm.wristPoint), robot.D.forearm);
  near(distance(s.arm.wristPoint, s.arm.flangePoint), robot.D.wrist);
  near(distance(s.arm.flangePoint, s.arm.toolTip), robot.D.tool);
  assert.ok(s.metrics.linkResidualMm < 1e-6);
  near(robot.poseAt(1, { ...d, grip: 0 }).gripper.spread, .035);
  near(robot.poseAt(1, { ...d, grip: 1 }).gripper.spread, .100);
  const low = robot.poseAt(1, { ...d, shoulder: 10 }), high = robot.poseAt(1, { ...d, shoulder: 60 });
  assert.notEqual(distance(low.counterbalance.anchor, low.counterbalance.upperAnchor), distance(high.counterbalance.anchor, high.counterbalance.upperAnchor));
  assert.equal(robot.inputsOf({ cadence: 0 }).cadence, .10);
  assert.equal(robot.inputsOf({ slew: 999 }).slew, 70);
  assert.equal(robot.inputsOf({ shoulder: 0 }).shoulder, 10);
  assert.equal(robot.inputsOf({ elbow: 999 }).elbow, 100);
  assert.equal(robot.inputsOf({ grip: -1 }).grip, 0);
  const repeated = robot.sample(.317 + 1 / d.cadence, d);
  near(repeated.drive.rollerAngle, s.drive.rollerAngle, 1e-12);
});

test('ASTRARIUM OR-9 geometry: substantial, efficient and fully selectable', async () => {
  await checkModel('astrarium', 90);
});

test('TERRA X7 geometry: substantial, efficient and fully selectable', async () => {
  await checkModel('excavator', 80);
});

test('SPECULA O6 geometry: substantial, efficient and fully selectable', async () => {
  await checkModel('observatory', 90);
});

test('HARMONIA P8 geometry: substantial, efficient and fully selectable', async () => {
  await checkModel('piano', 110);
});

test('FABER R6 geometry: substantial, efficient and fully selectable', async () => {
  await checkModel('robot-cell', 80);
});
