import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { descriptor } from '../src/mechanisms/tiltrotor/index.js';
import { D, DEFAULT_INPUTS, T, sample, flightAt, inputsOf, distance, rotorRevolutions, airframeToWorld } from '../src/mechanisms/tiltrotor/kin.js';

const near = (a, b, eps = 1e-9, message = '') => assert.ok(Math.abs(a - b) <= eps, `${message} ${a} != ${b}`);
const finite = value => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(finite);
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
};
const period = (input = DEFAULT_INPUTS) => 1 / descriptor.cycleHz(input);
const corners = [DEFAULT_INPUTS,
  { cadence: .03, rotor: 1.5, hover: .7, bank: 0, collective: 8 },
  { cadence: .09, rotor: 5, hover: 1.3, bank: 20, collective: 16 }];

function partBounds(model, id) {
  const box = new THREE.Box3(), local = new THREE.Matrix4(), world = new THREE.Matrix4(), geometry = new THREE.Box3();
  model.group.updateMatrixWorld(true);
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

test('AQUILA TR-9: exact links, actuator stroke, ground contact and rotor clearance', () => {
  assert.equal(descriptor.id, 'tiltrotor');
  assert.equal(descriptor.collection, '035');
  assert.equal(descriptor.specs.length, 2);
  assert.equal(descriptor.lessons.length, 5);
  assert.equal(descriptor.controls.length, 5);
  assert.match(descriptor.description, /not a physical simulation[^.]*\.$/);
  assert.equal(inputsOf({ hover: 9 }).hover, 1.3);
  assert.equal(inputsOf({ rotor: -1 }).rotor, 1.5);
  assert.equal(inputsOf({ bank: Number.NaN }).bank, DEFAULT_INPUTS.bank);
  for (const input of corners) for (let i = 0; i < 400; i++) {
    const pose = sample(i / 400 * period(input), input);
    finite(pose);
    for (const nacelle of pose.nacelles) {
      for (const blade of nacelle.blades) near(distance(blade.horn, blade.foot), D.linkLength, 1e-12, 'pitch link');
      // The swashplate plane passes through all three link feet.
      for (const blade of nacelle.blades) {
        const d = blade.foot.map((v, k) => v - nacelle.swash.centre[k]);
        near(d[0] * nacelle.swash.normal[0] + d[1] * nacelle.swash.normal[1] + d[2] * nacelle.swash.normal[2], 0, 1e-12, 'swash plane');
      }
      const length = nacelle.actuator.length;
      assert.ok(length >= Math.max(D.barrelLength, D.rodLength) - 1e-9, `actuator never inverts: ${length}`);
      assert.ok(length <= D.barrelLength + D.rodLength + 1e-9, `actuator never separates: ${length}`);
    }
    for (const gear of pose.gear) if (gear.retract === 0) {
      const axle = airframeToWorld(gear.axle, pose.flight);
      assert.ok(axle[1] >= D.wheelRadius - 1e-9, `${gear.id} tyre never sinks: ${axle[1]}`);
    }
    if (pose.flight.altitude === 0) for (const gear of pose.gear) near(airframeToWorld(gear.axle, pose.flight)[1], D.wheelRadius, 1e-9, `${gear.id} tyre on the ground`);
    if (pose.flight.spin > 1e-3) {
      assert.ok(pose.fold < 1e-9, 'blades are fully unfolded while turning');
      assert.ok(pose.metrics.tipClearanceM > .5, `rotor tips clear the ground: ${pose.metrics.tipClearanceM}`);
      for (const nacelle of pose.nacelles) for (const blade of nacelle.blades) {
        const radial = Math.hypot(blade.tip[0], blade.tip[2]);
        near(radial, D.hingeRadius + D.bladeLength, 1e-9, 'spinning blade reaches the full disc radius');
      }
      assert.ok(pose.nacelles.every(n => Math.abs(n.blades[0].tipWorld[0]) > .25 || n.blades[0].tipWorld[1] > 1.1), 'rotor tips stay outside the cabin');
    }
    if (pose.flight.nacelleDeg < 80) assert.ok(pose.flight.altitude > .5 || pose.flight.spin < 1e-9, 'conversion only happens airborne or with rotors stopped');
    assert.ok(pose.ramp.tip[1] + pose.flight.altitude >= -1e-9, 'ramp toe never enters the ground');
    assert.ok(pose.hoist.basket[1] + pose.flight.altitude >= D.basketClearance - 1e-6, 'basket stops above the ground');
    assert.ok(pose.metrics.linkResidualMm < 1e-9);
  }
  // Whole revolutions: blades park at the azimuth they started from.
  for (const input of corners) {
    assert.ok(Number.isInteger(rotorRevolutions(input)) && rotorRevolutions(input) >= 4);
    const start = sample(0, input), end = sample(period(input) * (1 - 1e-12), input);
    for (let n = 0; n < 2; n++) for (let b = 0; b < 3; b++) {
      const a0 = start.nacelles[n].blades[b].azimuth, a1 = end.nacelles[n].blades[b].azimuth;
      near(Math.cos(a0), Math.cos(a1), 1e-6); near(Math.sin(a0), Math.sin(a1), 1e-6);
    }
  }
  // Mission milestones.
  const at = p => sample(p * period());
  assert.equal(at(.02).flight.stowDeg, 90);
  assert.equal(at(.02).flight.foldDeg, 90);
  near(at(.45).flight.nacelleDeg, 90, 1e-9, 'helicopter mode in hover');
  assert.ok(at(.45).flight.altitude > .9, 'hovering');
  near(at(.45).flight.gearDown, 0, 1e-9, 'gear retracted in hover');
  assert.ok(at(.445).hoist.cableLength > .9, 'hoist lowers its basket');
  near(at(.63).flight.nacelleDeg, 0, 1e-9, 'airplane mode in cruise');
  assert.ok(at(.63).probe > .99, 'refuelling probe out in cruise');
  assert.ok(Math.abs(at(.6).metrics.rollDeg) > 5 && Math.abs(at(.66).metrics.rollDeg) > 5, 'banked S-turn');
  assert.ok(at(.6).metrics.rollDeg * at(.66).metrics.rollDeg < 0, 'banks both ways');
  assert.ok(at(.45).metrics.rotorRpm > 100 && at(.10).metrics.rotorRpm === 0);
  assert.ok(at(.99).ramp.open > .95 && at(.2).ramp.open < 1e-9);
  assert.ok(at(.45).flaperons.L > 30, 'flaperons droop in helicopter mode');
  const loop = sample(.317 * period() + period());
  near(loop.phase, sample(.317 * period()).phase, 1e-12);
  for (const key of ['nacelleDeg', 'stowDeg', 'foldDeg', 'altitude', 'gearDown', 'ramp', 'door']) near(flightAt(.9999999)[key], flightAt(0)[key], 1e-4, key);
  assert.ok(T.fold[0] >= T.spinDown[1] && T.unfold[1] <= T.spinUp[0], 'blades fold only after the rotors stop');
});

test('AQUILA TR-9: detailed anatomy, budgets and solved assemblies', async () => {
  const model = await descriptor.createModel();
  try {
    assert.ok(model.parts.length >= 100, `${model.parts.length} selectable parts`);
    const ids = new Set(model.parts.map(part => part.id));
    assert.equal(ids.size, model.parts.length);
    assert.equal(new Set(model.parts.map(part => part.name)).size, model.parts.length);
    for (const part of model.parts) {
      assert.ok(part.function.length > 25 && part.how.length > 25, `${part.id}: useful metadata`);
      assert.ok(part.detail.includes(part.name), `${part.id}: detail carries the name`);
    }
    for (const id of ['fuselage.cabin', 'cockpit.glazing', 'wing.centre', 'wing.ringGear', 'stow.pinion', 'stow.bearing',
      'nacelle.shell.L', 'nacelle.compressor.R', 'nacelle.engineCore.L', 'rotor.swashplate.R', 'rotor.swashRotating.L',
      'rotor.pitchLink.R1', 'rotor.grip.L2', 'rotor.blade.R3', 'conversion.R.barrel', 'conversion.L.rod',
      'wing.driveshaft.L', 'wing.flaperon.R2', 'gear.nose.strut', 'gear.main.L.wheels', 'gear.main.R.door.L',
      'ramp.door', 'ramp.upperDoor', 'ramp.actuator.L.barrel', 'hoist.boom', 'hoist.basket', 'nose.probeTip',
      'nose.flir', 'beacon.upper', 'tail.rudder.L', 'tail.elevator']) assert.ok(ids.has(id), id);
    assert.ok(model.framePoints.length > 2000, 'whole-mission camera envelope');
    assert.ok(model.maxViewDistance >= 20);

    model.update(descriptor.sample(.45 * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances >= 600 && model.stats.instances <= 2000, `instances ${model.stats.instances}`);
    assert.ok(model.stats.triangles >= 15000 && model.stats.triangles <= 120000, `triangles ${model.stats.triangles}`);
    assert.ok(model.stats.drawCalls <= 35, `draws ${model.stats.drawCalls}`);
    // Rendered blade tips agree with the sampled rotor geometry.
    const hover = descriptor.sample(.45 * period());
    const tipBox = partBounds(model, 'rotor.blade.R1'), tip = hover.nacelles[1].blades[0].tipWorld;
    assert.ok(tipBox.distanceToPoint(new THREE.Vector3(...tip)) < .04, 'rendered blade reaches the sampled tip');
    for (const id of ['L', 'R']) {
      const wheels = partBounds(model, `gear.main.${id}.wheels`), sponson = partBounds(model, `fuselage.sponson.${id}`);
      assert.ok(wheels.min.y >= sponson.min.y - .01 && wheels.max.z <= sponson.max.z && wheels.min.z >= sponson.min.z, `${id} main wheels stow inside the sponson`);
      assert.ok(wheels.min.x >= sponson.min.x - .01 && wheels.max.x <= sponson.max.x + .01, `${id} wheels stay within the sponson width`);
    }
    // Parked: the whole aircraft sits on its tyres and the folded wing stays above the cabin.
    model.update(descriptor.sample(.01 * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    for (const id of ['gear.nose.wheels', 'gear.main.L.wheels', 'gear.main.R.wheels']) near(partBounds(model, id).min.y, 0, 1e-6, `${id} rests on the ground`);
    const cabin = partBounds(model, 'fuselage.cabin');
    for (const id of ['rotor.blade.L1', 'rotor.blade.R2', 'nacelle.shell.L', 'nacelle.shell.R']) assert.ok(partBounds(model, id).min.y > cabin.max.y - .02, `${id} stows above the cabin`);
    assert.ok(partBounds(model, 'ramp.door').min.y > -.01, 'open ramp rests on the ground');

    const full = model.stats.instances;
    model.update(descriptor.sample(.01 * period()), { quality: 'low', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances < full, 'Efficient removes micro-detail');
    const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
    assert.equal(visible.size, model.parts.length, 'Efficient keeps every selectable part');
  } finally { model.dispose(); model.dispose(); }
  assert.equal(model.pickables.length, 0);
});

test('AQUILA TR-9: rotors, nacelles, gear and accessories move across the mission', async () => {
  const model = await descriptor.createModel();
  try {
    const node = id => model.group.getObjectByName(id);
    const snapshot = id => node(id).matrixWorld.toArray();
    model.update(descriptor.sample(.45 * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    const hover = { blade: snapshot('rotor.blade.R1'), link: snapshot('rotor.pitchLink.L1'), wheel: snapshot('gear.nose.wheels') };
    model.update(descriptor.sample(.452 * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.notDeepEqual(snapshot('rotor.blade.R1'), hover.blade, 'rotor turns in hover');
    assert.notDeepEqual(snapshot('rotor.pitchLink.L1'), hover.link, 'pitch link follows the rotating swashplate');
    model.update(descriptor.sample(.63 * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    near(node('nacelle.frame.R').rotation.x, Math.PI / 2, 1e-9, 'nacelle tilted forward');
    assert.ok(node('nose.probeTip').position.z > .34, 'probe extended');
    model.update(descriptor.sample(.01 * period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    near(node('wing.frame').rotation.y, -Math.PI / 2, 1e-9, 'wing stowed');
    const parked = snapshot('rotor.blade.R1');
    model.update(descriptor.sample(.01 * period() + period()), { quality: 'balanced', mode: 'solid', explode: 0 });
    const again = snapshot('rotor.blade.R1');
    parked.forEach((v, i) => near(v, again[i], 1e-6, 'parked blade repeats exactly'));

    const state = descriptor.sample(.42 * period());
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    const assembled = model.pickables.map(mesh => Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16)));
    model.update(state, { quality: 'low', mode: 'xray', explode: 1 });
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(model.pickables.map(mesh => Array.from(mesh.instanceMatrix.array.slice(0, mesh.count * 16))), assembled, 'explosion reverses exactly');
  } finally { model.dispose(); }
});
