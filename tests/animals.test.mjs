import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MECHANISMS } from '../src/catalog.js';
import * as mammut from '../src/mechanisms/mammut/kin.js';
import * as abyss from '../src/mechanisms/abyss/kin.js';
import * as cervus from '../src/mechanisms/cervus/kin.js';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} should equal ${b}`);
const descriptor = id => MECHANISMS.find(model => model.id === id);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

function instanceSnapshot(model) {
  const snapshot = new Map(), matrix = new THREE.Matrix4();
  for (const mesh of model.pickables) for (let i = 0; i < mesh.count; i++) {
    const id = mesh.userData.instanceParts[i];
    mesh.getMatrixAt(i, matrix);
    if (!snapshot.has(id)) snapshot.set(id, []);
    snapshot.get(id).push(Array.from(matrix.elements));
  }
  return snapshot;
}
function renderedBounds(model) {
  const box = new THREE.Box3(), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (const mesh of model.pickables) {
    const positions = mesh.geometry.attributes.position;
    for (let j = 0; j < mesh.count; j++) {
      mesh.getMatrixAt(j, matrix);
      assert.ok(matrix.determinant() > 0, 'every instance keeps a positive-determinant transform');
      for (let i = 0; i < positions.count; i++) box.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(matrix));
    }
  }
  return box;
}

function partExtent(model, id) {
  const box = new THREE.Box3(), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (const mesh of model.pickables) {
    const positions = mesh.geometry.attributes.position;
    for (let j = 0; j < mesh.count; j++) {
      if (mesh.userData.instanceParts[j] !== id) continue;
      mesh.getMatrixAt(j, matrix);
      for (let i = 0; i < positions.count; i++) box.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(matrix));
    }
  }
  return box;
}
function motionGate(model, offsets, sampleAt) {
  const snapshots = offsets.map(t => {
    model.update(sampleAt(t), { quality: 'balanced', mode: 'solid', explode: 0 });
    return instanceSnapshot(model);
  });
  const origin = snapshots[0], movingParts = new Set(), movingInstances = new Set();
  let total = 0;
  for (const [id, matrices] of origin) for (let i = 0; i < matrices.length; i++) {
    total++;
    const first = matrices[i];
    for (let s = 1; s < snapshots.length; s++) {
      const other = snapshots[s].get(id)?.[i];
      if (!other || first.some((value, k) => Math.abs(value - other[k]) > 1e-10)) {
        movingParts.add(id); movingInstances.add(`${id}:${i}`); break;
      }
    }
  }
  return { snapshots, movingParts, movingInstances, total };
}

test('MAMMUT M4: four planted IK legs, a fourteen-link trunk, a seven-link tail and paired rams stay exact', () => {
  const s = mammut.sample(.317);
  assert.equal(s.legs.length, 4);
  assert.ok(s.legs.filter(leg => leg.stance).length >= 3, 'a walking mammoth keeps at least three feet down');
  for (const leg of s.legs) {
    near(distance(leg.hip, leg.knee), mammut.D.femur);
    near(distance(leg.knee, leg.ankle), mammut.D.tibia);
    near(distance(leg.ankle, leg.footLocal), Math.hypot(...mammut.D.ankleLift));
    assert.ok(leg.foot[1] >= 0, 'feet never pass below the service floor');
  }
  assert.equal(s.trunk.links.length, 14);
  assert.equal(s.tail.links.length, 7);
  assert.equal(s.trunkRams.length, 26, 'two trunk-joint actuators per joint');
  for (const link of s.trunk.links) near(distance(link.start, link.end), mammut.D.trunkLink);
  for (const link of s.tail.links) near(distance(link.start, link.end), mammut.D.tailLink);
  for (const ram of s.trunkRams) assert.ok(Number.isFinite(ram.length) && ram.length > 0);
  assert.equal(s.tusks.length, 2);
  assert.ok(Number.isFinite(s.ears.flap) && Number.isFinite(s.ears.tip));
  assert.ok(s.metrics.linkResidualMm < 1e-6);
  for (let i = 0; i < 24; i++) {
    const a = mammut.sample(i / 24 / mammut.DEFAULT_INPUTS.cadence);
    const b = mammut.sample(i / 24 / mammut.DEFAULT_INPUTS.cadence + 1 / mammut.DEFAULT_INPUTS.cadence);
    near(a.phase, b.phase, 1e-12);
    near(a.metrics.linkResidualMm, b.metrics.linkResidualMm, 1e-9);
  }
});

test('MAMMUT M4: trunk curl, ear flare, tusk and gait inputs change real geometry and clamp safely', () => {
  const base = mammut.poseAt(1, { ...mammut.DEFAULT_INPUTS });
  const curled = mammut.poseAt(1, { ...mammut.DEFAULT_INPUTS, curl: 35 });
  assert.ok(curled.trunk.points.at(-1)[1] < base.trunk.points.at(-1)[1], 'more curl lowers the trunk tip');
  assert.equal(mammut.inputsOf({ cadence: -1 }).cadence, .12);
  assert.equal(mammut.inputsOf({ stride: 99 }).stride, .26);
  assert.equal(mammut.inputsOf({ curl: -5 }).curl, 0);
  assert.equal(mammut.inputsOf({ ear: 999 }).ear, 35);
  const d = descriptor('mammut');
  const state = d.sample(.317, d.defaultInputs);
  assert.equal(state.contactFeet.length, state.legs.length);
  near(state.contactFeet[0][0], -state.legs[0].foot[0]);
  near(state.contactFeet[0][2], -state.legs[0].foot[2]);
  const later = mammut.poseAt(2.1, mammut.DEFAULT_INPUTS);
  assert.notDeepEqual(later.tusks.map(t => t.lift), base.tusks.map(t => t.lift));
});

test('MAMMUT M4: deep layered mass and the 85-125k triangle budget', async () => {
  const d = descriptor('mammut');
  const model = await d.createModel();
  try {
    assert.ok(model.parts.length >= 190, `${model.parts.length} selectable parts`);
    const ids = new Set(model.parts.map(part => part.id));
    assert.equal(ids.size, model.parts.length, 'part identifiers are unique');
    assert.equal(new Set(model.parts.map(part => part.name)).size, model.parts.length, 'part names are unique');
    for (const part of model.parts) {
      assert.ok(part.function.length > 25 && part.how.length > 25 && part.material.length > 3, `${part.id}: useful metadata`);
      assert.ok(part.detail.includes(part.name), `${part.id}: detail carries the unique name`);
    }
    for (const id of ['body.chassis', 'body.belly', 'body.armor.L', 'body.armor.R', 'body.withers', 'body.haunch',
      'spine.1.frame', 'spine.8.frame', 'spine.8.scute', 'rib.L.1', 'rib.R.8', 'rib.L.1.guide',
      'leg.FL.femurShell', 'leg.FR.tibiaShell', 'leg.RL.foot', 'leg.RR.metatarsus', 'leg.FL.servicePanel',
      'head.tusk.L', 'head.tuskTip.R', 'head.tuskCollar.L', 'head.ear.L', 'head.ear.R.tip',
      'head.ear.L.hinge', 'trunk.1.frame', 'trunk.14.band', 'trunk.8.ram.L', 'trunk.14.frame',
      'tail.1.frame', 'tail.7.scute', 'tail.base', 'tail.tuft', 'howdah.deck', 'howdah.rail.L',
      'howdah.crate', 'drive.FL.gear', 'drive.RR']) assert.ok(ids.has(id), id);
    assert.ok(!model.parts.some(part => part.id.startsWith('deck.')), 'no display deck is built');
    assert.ok(model.framePoints.length > 400, 'camera envelope is sampled');
    const state = d.sample(.317, d.defaultInputs);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances >= 1300 && model.stats.instances <= 1900, `instances ${model.stats.instances}`);
    assert.ok(model.stats.triangles >= 85000 && model.stats.triangles <= 125000, `triangles ${model.stats.triangles}`);
    assert.ok(model.stats.triangles <= 200000 && model.stats.drawCalls <= 40, `draws ${model.stats.drawCalls}`);
    const chassis = partExtent(model, 'body.chassis').getSize(new THREE.Vector3());
    assert.ok(chassis.x > .9 && chassis.y > .35 && chassis.z > 1.2, `chassis ${chassis.toArray()}`);
    const femur = partExtent(model, 'leg.FL.femurShell').getSize(new THREE.Vector3());
    assert.ok(femur.x > .18 && femur.y > .30, `femur armour ${femur.toArray()}`);
    const foot = partExtent(model, 'leg.RR.foot').getSize(new THREE.Vector3());
    assert.ok(foot.x > .28 && foot.z > .34, `foot ${foot.toArray()}`);
    const tusk = partExtent(model, 'head.tusk.L').getSize(new THREE.Vector3());
    assert.ok(tusk.z > .75 && tusk.y > .18, `tusk ${tusk.toArray()}`);
    const full = model.stats.instances;
    model.update(state, { quality: 'low', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances < full, 'Efficient removes micro-detail instances');
    const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
    assert.equal(visible.size, model.parts.length, 'Efficient keeps every selectable part');
  } finally { model.dispose(); }
  assert.equal(model.group.children.length, 0);
});

test('MAMMUT M4: herd motion moves the trunk, ears, tail, head, howdah and all four legs', async () => {
  const d = descriptor('mammut');
  const model = await d.createModel();
  try {
    const offsets = [.137, .463, .829, 1.277, 1.741, 2.239, 2.807, 3.419, 4.057, 4.693, 5.329, 6.011];
    assert.ok(new Set(offsets.map(t => d.sample(t).phase.toFixed(12))).size >= 9, 'non-commensurate phase offsets');
    const { movingParts, movingInstances, total } = motionGate(model, offsets, t => d.sample(t));
    assert.ok(movingParts.size / model.parts.length >= .75, `${movingParts.size}/${model.parts.length} parts move`);
    assert.ok(movingInstances.size / total >= .75, `${movingInstances.size}/${total} instances move`);
    for (const [prefix, minimum] of [['trunk.', 28], ['head.ear.', 8], ['tail.', 18], ['leg.', 56], ['head.', 24], ['howdah.', 10], ['drive.', 8], ['rib.', 32]]) {
      const group = model.parts.filter(part => part.id.startsWith(prefix));
      assert.ok(group.length >= minimum, `${prefix}: ${group.length} parts`);
      for (const part of group) assert.ok(movingParts.has(part.id), `${part.id} participates in the motion`);
    }
    for (const id of ['trunk.1.band', 'trunk.14.band', 'head.ear.L', 'head.ear.R.tip', 'head.tusk.L',
      'tail.7.scute', 'tail.tuft', 'leg.FL.femurShell', 'leg.RR.foot', 'drive.FL.gear', 'howdah.rail.R', 'body.armor.L']) {
      assert.ok(movingParts.has(id), `motion includes ${id}`);
    }
    // Relative articulation: body-local trunk and foot coordinates change, so the gate cannot pass on body sway alone.
    const a = mammut.poseAt(.4, mammut.DEFAULT_INPUTS), b = mammut.poseAt(2.1, mammut.DEFAULT_INPUTS);
    assert.notDeepEqual(a.trunk.points.at(-1), b.trunk.points.at(-1));
    assert.notDeepEqual(a.legs[0].footLocal, b.legs[0].footLocal);
    // Negative control: repeated poses are identical and the root stays fixed.
    model.update(d.sample(offsets[0]), { quality: 'balanced', mode: 'solid', explode: 0 });
    const repeated = instanceSnapshot(model);
    model.update(d.sample(offsets[0]), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(instanceSnapshot(model), repeated, 'a repeated pose produces identical matrices');
    assert.ok(!model.parts.some(part => part.id.startsWith('deck.')), 'no static display deck remains');
    assert.deepEqual(model.group.position.toArray(), [0, 0, 0]);
    assert.deepEqual(model.group.quaternion.toArray(), [0, 0, 0, 1]);
    assert.deepEqual(model.group.scale.toArray(), [1, 1, 1]);
  } finally { model.dispose(); }
});

test('MAMMUT M4: rendered rig lengths, floor, bounds, reversible explosion and disposal remain hard gates', async () => {
  const d = descriptor('mammut');
  const model = await d.createModel();
  try {
    const state = d.sample(2.1);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    const assembled = instanceSnapshot(model);
    model.update(state, { quality: 'low', mode: 'xray', explode: 1 });
    assert.notDeepEqual(instanceSnapshot(model), assembled, 'explosion moves instances');
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(instanceSnapshot(model), assembled, 'explosion reverses without drift');
    const point = id => { const node = model.group.getObjectByName(id), v = new THREE.Vector3(); node.getWorldPosition(v); return v; };
    for (const pose of [state, d.sample(.317), d.sample(4.7)]) {
      model.update(pose, { quality: 'balanced', mode: 'solid', explode: 0 });
      model.group.updateMatrixWorld(true);
      for (const leg of pose.legs) {
        near(point(`leg.${leg.id}.femur`).distanceTo(point(`leg.${leg.id}.knee`)), mammut.D.femur, 1e-6);
        near(point(`leg.${leg.id}.metatarsus`).distanceTo(point(`leg.${leg.id}.knee`)), mammut.D.tibia, 1e-6);
        near(point(`leg.${leg.id}.metatarsus`).distanceTo(point(`leg.${leg.id}.foot`)), Math.hypot(...mammut.D.ankleLift), 1e-6);
      }
    }
    for (const input of [d.defaultInputs, { ...d.defaultInputs, curl: 35, ear: 35, stride: .26 },
      { ...d.defaultInputs, curl: 0, ear: 0, stride: .08 }]) for (let n = 0; n < 6; n++) {
      model.update(d.sample(n / 6 / d.cycleHz(input), input), { quality: 'balanced', mode: 'solid', explode: 0 });
      const box = renderedBounds(model), size = box.getSize(new THREE.Vector3());
      assert.ok(box.min.y >= -1e-6, `floor ${box.min.y}`);
      assert.ok(box.max.y < 3.2, `height ${box.max.y}`);
      assert.ok(Math.max(size.x, size.z) < 4.4, `footprint ${size.toArray()}`);
    }
    model.dispose(); model.dispose();
    assert.equal(model.pickables.length, 0);
  } finally { model.dispose(); }
  assert.equal(model.group.children.length, 0);
});

test('ABYSS S9: fourteen vertebral and six caudal links, forked tail, gills and jaw stay rigid and deterministic', () => {
  const s = abyss.sample(.317), base = abyss.DEFAULT_INPUTS;
  assert.equal(s.spine.links.length, 14);
  assert.equal(s.tail.links.length, 6);
  assert.equal(s.spine.points.length, 15);
  assert.equal(s.tail.points.length, 7);
  assert.equal(s.gills.length, 10);
  assert.equal(s.rams.length, 14);
  assert.equal(s.tendons.length, 7);
  assert.ok(s.spine.links.at(-1).amp > s.spine.links[0].amp, 'the wave amplitude grows toward the tail');
  for (const input of [{ ...base, tail: 3 }, { ...base, tail: 15 }]) {
    for (let n = 0; n < 24; n++) {
      const state = abyss.sample(n / 24 / input.cadence, input);
      for (const link of state.spine.links) near(distance(link.start, link.end), abyss.D.spineLink);
      for (const link of state.tail.links) near(distance(link.start, link.end), abyss.D.tailLink);
      assert.ok(state.metrics.linkResidualMm < 1e-6);
      assert.ok(state.tail.points.every(point => point[1] > 0.8), 'the supported tail never reaches the floor');
    }
  }
  const wide = abyss.poseAt(1.2, { ...base, tail: 15 });
  const narrow = abyss.poseAt(1.2, { ...base, tail: 3 });
  assert.ok(Math.abs(wide.tail.points.at(-1)[0]) > Math.abs(narrow.tail.points.at(-1)[0]));
  const open = abyss.poseAt(1.2, { ...base, gape: 28 });
  assert.ok(open.head.jaw > s.head.jaw, 'gape opens the mandible');
  const fins = abyss.poseAt(1.2, { ...base, fin: 25 });
  assert.ok(Math.abs(fins.fins[0].pitch) > Math.abs(s.fins[0].pitch));
  assert.equal(abyss.inputsOf({ cadence: 0 }).cadence, .15);
  assert.equal(abyss.inputsOf({ tail: 99 }).tail, 15);
  assert.equal(abyss.inputsOf({ gape: -1 }).gape, 0);
  assert.equal(abyss.inputsOf({ fin: 99 }).fin, 25);
  const forkA = abyss.sample(.1), forkB = abyss.sample(.7);
  assert.notEqual(forkA.tailFin.upper, forkB.tailFin.upper, 'the forked tail lobes hinge independently');
  assert.notEqual(forkA.gills[0].opening, forkB.gills[0].opening, 'gill flaps open through the cycle');
  for (let i = 0; i < 24; i++) {
    const a = abyss.sample(i / 24 / base.cadence), b = abyss.sample(i / 24 / base.cadence + 1 / base.cadence);
    near(a.phase, b.phase, 1e-12);
    near(a.metrics.tailTipX, b.metrics.tailTipX, 1e-9);
    near(a.head.jaw, b.head.jaw, 1e-9);
  }
});

test('ABYSS S9: articulated shark has forked tail, gimballed fins, gills, jaw and rocking cradle in budget', async () => {
  const d = descriptor('abyss');
  const model = await d.createModel();
  try {
    assert.ok(model.parts.length >= 160, `${model.parts.length} selectable parts`);
    const ids = new Set(model.parts.map(part => part.id));
    assert.equal(ids.size, model.parts.length, 'part identifiers are unique');
    assert.equal(new Set(model.parts.map(part => part.name)).size, model.parts.length, 'part names are unique');
    for (const part of model.parts) {
      assert.ok(part.function.length > 25 && part.how.length > 25 && part.material.length > 3, `${part.id}: useful metadata`);
      assert.ok(part.detail.includes(part.name), `${part.id}: detail carries the unique name`);
    }
    for (let i = 1; i <= 14; i++) assert.ok(ids.has(`spine.${i}.frame`), `spine frame ${i}`);
    for (let i = 1; i <= 6; i++) assert.ok(ids.has(`tail.${i}.frame`), `caudal frame ${i}`);
    for (let j = 1; j <= 7; j++) for (const side of ['L', 'R']) assert.ok(ids.has(`spine.${j}.ram.${side}`), `ram ${j}.${side}`);
    for (let j = 1; j <= 7; j++) assert.ok(ids.has(`spine.${j}.tendon`), `tendon ${j}`);
    for (const side of ['L', 'R']) for (let g = 1; g <= 5; g++) {
      assert.ok(ids.has(`gill.${side}.${g}`), `gill flap ${side}.${g}`);
      assert.ok(ids.has(`gill.${side}.${g}.arch`), `gill arch ${side}.${g}`);
    }
    for (const id of ['head.jaw.upper', 'head.jaw.lower', 'head.eye.L', 'head.eye.R', 'head.eyeTrim.L', 'head.eyeTrim.R',
      'fin.tail.upper', 'fin.tail.lower', 'fin.tail.hinge', 'fin.pectoral.L.root', 'fin.pectoral.R.blade',
      'fin.pectoral.L.ray.1', 'fin.pectoral.R.ray.4', 'fin.dorsal', 'fin.pelvic.L.root', 'fin.anal',
      'body.belly.frame', 'body.belly.hatch', 'body.scale.1', 'gantry.cradle', 'gantry.rocker', 'gantry.roller.1',
      'gantry.winch', 'gantry.beam']) assert.ok(ids.has(id), id);
    const state = d.sample(.317, d.defaultInputs);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances >= 1300 && model.stats.instances <= 1900, `instances ${model.stats.instances}`);
    assert.ok(model.stats.triangles >= 75000 && model.stats.triangles <= 120000, `triangles ${model.stats.triangles}`);
    assert.ok(model.stats.triangles <= 200000 && model.stats.drawCalls <= 40, `draws ${model.stats.drawCalls}`);
    const full = model.stats.instances;
    model.update(state, { quality: 'low', mode: 'cutaway', explode: 1 });
    assert.ok(model.stats.instances < full, 'Efficient removes micro-detail instances');
    const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
    assert.equal(visible.size, model.parts.length, 'Efficient keeps every selectable part');
    model.update(state, { quality: 'balanced', mode: 'xray', explode: 0 });
    assert.ok(model.pickables.some(mesh => mesh.material.transparent && mesh.count), 'shell armor ghosts in X-ray');
  } finally { model.dispose(); }
  assert.equal(model.group.children.length, 0);
  assert.equal(model.pickables.length, 0);
});

test('ABYSS S9: motion gate sees the swim wave move most parts and every listed subsystem', async () => {
  const d = descriptor('abyss');
  const model = await d.createModel();
  try {
    const offsets = [.137, .463, .829, 1.277, 1.741, 2.239, 2.807, 3.419, 4.057, 4.693, 5.329, 6.011];
    assert.ok(new Set(offsets.map(t => d.sample(t).phase.toFixed(12))).size >= 9, 'non-commensurate phase offsets');
    const snapshots = offsets.map(t => {
      model.update(d.sample(t), { quality: 'balanced', mode: 'solid', explode: 0 });
      return instanceSnapshot(model);
    });
    const origin = snapshots[0], movingParts = new Set(), movingInstances = new Set();
    let total = 0;
    for (const [id, matrices] of origin) for (let i = 0; i < matrices.length; i++) {
      total++;
      const first = matrices[i];
      for (let s = 1; s < snapshots.length; s++) {
        const other = snapshots[s].get(id)?.[i];
        if (!other || first.some((value, k) => Math.abs(value - other[k]) > 1e-10)) {
          movingParts.add(id); movingInstances.add(`${id}:${i}`); break;
        }
      }
    }
    assert.ok(movingParts.size / model.parts.length >= .55, `${movingParts.size}/${model.parts.length} parts move`);
    assert.ok(movingInstances.size / total >= .55, `${movingInstances.size}/${total} instances move`);
    for (const [prefix, minimum] of [['spine.', 55], ['tail.', 10], ['fin.tail.', 2], ['fin.pectoral.', 12], ['gill.', 18], ['head.jaw', 4], ['head.eye', 4]]) {
      const group = model.parts.filter(part => part.id.startsWith(prefix));
      assert.ok(group.length >= minimum, `${prefix}: ${group.length} parts`);
      for (const part of group) assert.ok(movingParts.has(part.id), `${part.id} participates in the motion`);
    }
    for (const id of ['spine.1.frame', 'spine.14.frame', 'tail.1.frame', 'tail.6.scute', 'fin.pectoral.L.ray.1',
      'gill.R.5', 'head.jaw.lower', 'head.jaw.upper', 'head.eye.L', 'body.belly.hatch', 'gantry.rocker', 'gantry.roller.4']) {
      assert.ok(movingParts.has(id), `motion includes ${id}`);
    }
    // Negative control: an identical repeated pose moves nothing, and the fixed
    // gantry base stays fixed, so the movement metric cannot pass on all parts.
    model.update(d.sample(offsets[0]), { quality: 'balanced', mode: 'solid', explode: 0 });
    const repeatedA = instanceSnapshot(model);
    model.update(d.sample(offsets[0]), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(instanceSnapshot(model), repeatedA, 'a repeated pose produces identical matrices');
    assert.ok(!movingParts.has('gantry.base'), 'the ballasted base is a static control');
    assert.ok(!movingParts.has('gantry.post.L'), 'the fixed post is a static control');
  } finally { model.dispose(); }
});

test('ABYSS S9: floor, bounds, reversible explosion and disposal remain hard gates', async () => {
  const d = descriptor('abyss');
  const model = await d.createModel();
  try {
    const state = d.sample(2.1), assembled = (() => {
      model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
      return instanceSnapshot(model);
    })();
    model.update(state, { quality: 'low', mode: 'xray', explode: 1 });
    assert.notDeepEqual(instanceSnapshot(model), assembled, 'explosion moves instances');
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(instanceSnapshot(model), assembled, 'explosion reverses without drift');
    for (const input of [d.defaultInputs,
      { ...d.defaultInputs, tail: 15, fin: 25, gape: 28 },
      { ...d.defaultInputs, tail: 3, fin: 0, gape: 0 }]) for (let n = 0; n < 6; n++) {
      model.update(d.sample(n / 6 / d.cycleHz(input), input), { quality: 'balanced', mode: 'solid', explode: 0 });
      const box = renderedBounds(model), size = box.getSize(new THREE.Vector3());
      assert.ok(box.min.y >= -1e-6, `floor ${box.min.y}`);
      assert.ok(box.max.y < 3.2, `height ${box.max.y}`);
      assert.ok(Math.max(size.x, size.z) < 4.2, `footprint ${size.toArray()}`);
    }
    model.dispose(); model.dispose();
    assert.equal(model.pickables.length, 0);
  } finally { model.dispose(); }
  assert.equal(model.group.children.length, 0);
});

test('CERVUS B6: alternating tripods, exact 820 mm pincers, antennae, abdomen and display pulse', () => {
  const s = cervus.sample(.317), base = cervus.DEFAULT_INPUTS;
  assert.equal(s.legs.length, 6);
  assert.ok(s.legs.filter(leg => leg.stance).length >= 3);
  for (const leg of s.legs) {
    near(distance(leg.hip, leg.knee), cervus.D.femur);
    near(distance(leg.knee, leg.ankle), cervus.D.tibia);
    near(distance(leg.ankle, leg.footLocal), Math.hypot(...cervus.D.ankleLift));
    assert.ok(leg.foot[1] >= 0);
  }
  for (const side of s.mandibles) for (const [i, link] of side.links.entries()) near(distance(link.start, link.end), cervus.D.mandibleLengths[i]);
  near(s.metrics.jawMm, 820);
  for (const side of s.antennae) { assert.equal(side.links.length, 5); for (const link of side.links) near(distance(link.start, link.end), cervus.D.antennaLink); }
  assert.equal(s.abdomen.links.length, 6);
  for (const link of s.abdomen.links) near(distance(link.start, link.end), cervus.D.abdomenLink);
  assert.ok(s.metrics.linkResidualMm < 1e-6);
  const open = cervus.poseAt(1, { ...base, gape: 32 });
  assert.notDeepEqual(open.mandibles[0].points.at(-1), s.mandibles[0].points.at(-1));
  const later = cervus.poseAt(2.4, base);
  assert.notDeepEqual(later.mandibles[0].points.at(-1), s.mandibles[0].points.at(-1), 'pincers scissor through the display cycle');
  assert.notDeepEqual(later.antennae[0].points.at(-1), s.antennae[0].points.at(-1), 'antennae sweep through the cycle');
  assert.notDeepEqual(later.abdomen.points.at(-1), s.abdomen.points.at(-1), 'abdomen wave is live');
  assert.equal(cervus.inputsOf({ cadence: 0 }).cadence, .15);
  assert.equal(cervus.inputsOf({ stride: 99 }).stride, .16);
  assert.equal(cervus.inputsOf({ gape: 99 }).gape, 32);
  assert.equal(cervus.inputsOf({ elytra: -1 }).elytra, 0);
  assert.equal(cervus.inputsOf({ antenna: 99 }).antenna, 25);
});

test('CERVUS B6: thick layered elytra, broad armour and 1000-1600 instance budget in both tiers', async () => {
  const d = descriptor('cervus');
  const model = await d.createModel();
  try {
    assert.ok(model.parts.length >= 140, `${model.parts.length} selectable parts`);
    const ids = new Set(model.parts.map(part => part.id));
    assert.equal(ids.size, model.parts.length, 'part identifiers are unique');
    assert.equal(new Set(model.parts.map(part => part.name)).size, model.parts.length, 'part names are unique');
    for (const part of model.parts) {
      assert.ok(part.function.length > 25 && part.how.length > 25 && part.material.length > 3, `${part.id}: useful metadata`);
      assert.ok(part.detail.includes(part.name), `${part.id}: detail carries the unique name`);
    }
    for (const id of ['elytra.L.cover', 'elytra.R.cover', 'elytra.L.layer', 'elytra.L.rim', 'elytra.L.ribs',
      'elytra.L.membrane', 'elytra.L.hinge', 'mandible.L.1', 'mandible.R.1', 'mandible.L.hook',
      'mandible.R.serration', 'antenna.L.ball', 'antenna.L.club', 'antenna.L.lamella', 'antenna.R.ball',
      'abdomen.6.tergite', 'abdomen.7.tip', 'body.pronotum', 'body.bellyRib.1', 'body.bellyRam.L',
      'leg.FL.femurArmor', 'leg.RR.tibiaArmor', 'leg.ML.foot', 'leg.RR.claws', 'head.mouth.labrum',
      'head.mouth.palp.L', 'head.mouth.maxilla.R']) assert.ok(ids.has(id), id);
    assert.ok(!model.parts.some(part => part.id.startsWith('stand.')), 'no display stand is built');
    assert.ok(model.framePoints.length > 200, 'camera envelope is sampled');
    const state = d.sample(.317, d.defaultInputs);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances >= 1000 && model.stats.instances <= 1600, `instances ${model.stats.instances}`);
    assert.ok(model.stats.triangles >= 65000 && model.stats.triangles <= 105000, `triangles ${model.stats.triangles}`);
    assert.ok(model.stats.triangles <= 200000 && model.stats.drawCalls <= 40, `draws ${model.stats.drawCalls}`);
    const cover = model.group.getObjectByName('elytra.L.cover');
    const closed = cover.rotation.z;
    model.update(d.sample(.317, { ...d.defaultInputs, elytra: 28 }), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.notEqual(cover.rotation.z, closed, 'elytra lift turns the actual cover');
    const pronotum = partExtent(model, 'body.pronotum').getSize(new THREE.Vector3());
    assert.ok(pronotum.x > .6 && pronotum.y > .2 && pronotum.z > .5, `pronotum ${pronotum.toArray()}`);
    const femur = partExtent(model, 'leg.FL.femurArmor').getSize(new THREE.Vector3());
    assert.ok(femur.x > .18 && femur.y > .30, `femur armour ${femur.toArray()}`);
    const foot = partExtent(model, 'leg.RR.foot').getSize(new THREE.Vector3());
    assert.ok(foot.x > .18 && foot.z > .20, `foot ${foot.toArray()}`);
    const elytron = partExtent(model, 'elytra.L.cover').getSize(new THREE.Vector3());
    assert.ok(elytron.x > .25 && elytron.y > .08 && elytron.z > .55, `elytron ${elytron.toArray()}`);
    const full = model.stats.instances;
    for (const quality of ['balanced', 'low']) {
      model.update(state, { quality, mode: 'solid', explode: 0 });
      assert.ok(model.stats.instances <= full, `${quality}: no extra instances`);
      const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
      assert.equal(visible.size, model.parts.length, `${quality}: every indexed part remains visible`);
    }
    assert.ok(model.stats.instances < full, 'Efficient removes micro-detail instances');
  } finally { model.dispose(); }
  assert.equal(model.group.children.length, 0);
});

test('CERVUS B6: display gait moves pincers, antennae, elytra, abdomen and every leg', async () => {
  const d = descriptor('cervus');
  const model = await d.createModel();
  try {
    const offsets = [.137, .463, .829, 1.277, 1.741, 2.239, 2.807, 3.419, 4.057, 4.693, 5.329, 6.011];
    assert.ok(new Set(offsets.map(t => d.sample(t).phase.toFixed(12))).size >= 9, 'non-commensurate phase offsets');
    const { movingParts, movingInstances, total } = motionGate(model, offsets, t => d.sample(t));
    assert.ok(movingParts.size / model.parts.length >= .75, `${movingParts.size}/${model.parts.length} parts move`);
    assert.ok(movingInstances.size / total >= .75, `${movingInstances.size}/${total} instances move`);
    for (const [prefix, minimum] of [['leg.', 78], ['mandible.', 14], ['antenna.', 16], ['elytra.', 16], ['abdomen.', 28], ['body.', 18], ['head.', 12]]) {
      const group = model.parts.filter(part => part.id.startsWith(prefix));
      assert.ok(group.length >= minimum, `${prefix}: ${group.length} parts`);
      for (const part of group) assert.ok(movingParts.has(part.id), `${part.id} participates in the motion`);
    }
    for (const id of ['mandible.L.1', 'mandible.R.3', 'mandible.L.hook', 'mandible.R.serration',
      'antenna.L.ball', 'antenna.R.club', 'antenna.L.lamella', 'elytra.L.cover', 'elytra.R.membrane',
      'elytra.L.layer', 'abdomen.1.frame', 'abdomen.6.tergite', 'leg.FL.femurArmor', 'leg.RR.foot',
      'head.mouth.palp.L', 'body.bellyRib.3']) assert.ok(movingParts.has(id), `motion includes ${id}`);
    const cover = model.group.getObjectByName('elytra.L.cover');
    model.update(d.sample(.3), { quality: 'balanced', mode: 'solid', explode: 0 });
    const first = [cover.rotation.x, cover.rotation.z];
    model.update(d.sample(1.9), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.notDeepEqual([cover.rotation.x, cover.rotation.z], first, 'elytra covers breathe through the cycle');
    // Negative control: repeats are exact and the root never translates.
    model.update(d.sample(offsets[0]), { quality: 'balanced', mode: 'solid', explode: 0 });
    const repeated = instanceSnapshot(model);
    model.update(d.sample(offsets[0]), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(instanceSnapshot(model), repeated, 'a repeated pose produces identical matrices');
    assert.ok(!model.parts.some(part => part.id.startsWith('stand.')), 'no static display stand remains');
    assert.deepEqual(model.group.position.toArray(), [0, 0, 0]);
    assert.deepEqual(model.group.quaternion.toArray(), [0, 0, 0, 1]);
    assert.deepEqual(model.group.scale.toArray(), [1, 1, 1]);
  } finally { model.dispose(); }
});

test('CERVUS B6: rendered rig lengths, floor, bounds, reversible explosion and disposal remain hard gates', async () => {
  const d = descriptor('cervus');
  const model = await d.createModel();
  try {
    const state = d.sample(2.1);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    const assembled = instanceSnapshot(model);
    model.update(state, { quality: 'low', mode: 'xray', explode: 1 });
    assert.notDeepEqual(instanceSnapshot(model), assembled, 'explosion moves instances');
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.deepEqual(instanceSnapshot(model), assembled, 'explosion reverses without drift');
    const point = id => { const node = model.group.getObjectByName(id), v = new THREE.Vector3(); node.getWorldPosition(v); return v; };
    for (const pose of [state, d.sample(.317), d.sample(4.7)]) {
      model.update(pose, { quality: 'balanced', mode: 'solid', explode: 0 });
      model.group.updateMatrixWorld(true);
      for (const leg of pose.legs) {
        near(point(`leg.${leg.id}.femur`).distanceTo(point(`leg.${leg.id}.knee`)), cervus.D.femur, 1e-6);
        near(point(`leg.${leg.id}.tarsus`).distanceTo(point(`leg.${leg.id}.knee`)), cervus.D.tibia, 1e-6);
        near(point(`leg.${leg.id}.tarsus`).distanceTo(point(`leg.${leg.id}.foot`)), Math.hypot(...cervus.D.ankleLift), 1e-6);
      }
    }
    for (const input of [d.defaultInputs, { ...d.defaultInputs, gape: 32, elytra: 28, antenna: 25, stride: .16 },
      { ...d.defaultInputs, gape: 0, elytra: 0, antenna: 0, stride: .06 }]) for (let n = 0; n < 6; n++) {
      model.update(d.sample(n / 6 / d.cycleHz(input), input), { quality: 'balanced', mode: 'solid', explode: 0 });
      const box = renderedBounds(model), size = box.getSize(new THREE.Vector3());
      assert.ok(box.min.y >= -1e-6, `floor ${box.min.y}`);
      assert.ok(box.max.y < 3.2, `height ${box.max.y}`);
      assert.ok(Math.max(size.x, size.z) < 3.4, `footprint ${size.toArray()}`);
    }
    model.dispose(); model.dispose();
    assert.equal(model.pickables.length, 0);
  } finally { model.dispose(); }
  assert.equal(model.group.children.length, 0);
});
