import test from 'node:test';
import assert from 'node:assert/strict';
import { MECHANISMS } from '../src/catalog.js';
import * as mammut from '../src/mechanisms/mammut/kin.js';
import * as abyss from '../src/mechanisms/abyss/kin.js';
import * as cervus from '../src/mechanisms/cervus/kin.js';

const near = (a, b, epsilon = 1e-9) => assert.ok(Math.abs(a - b) <= epsilon, `${a} should equal ${b}`);
const descriptor = id => MECHANISMS.find(model => model.id === id);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('MAMMUT M4: four planted IK legs, a fourteen-link trunk and a seven-link tail stay exact', () => {
  const s = mammut.sample(.317), input = { ...mammut.DEFAULT_INPUTS };
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
  for (const link of s.trunk.links) near(distance(link.start, link.end), mammut.D.trunkLink);
  for (const link of s.tail.links) near(distance(link.start, link.end), mammut.D.tailLink);
  assert.ok(s.metrics.linkResidualMm < 1e-6);
  for (let i = 0; i < 24; i++) {
    const a = mammut.sample(i / 24 / mammut.DEFAULT_INPUTS.cadence);
    const b = mammut.sample(i / 24 / mammut.DEFAULT_INPUTS.cadence + 1 / mammut.DEFAULT_INPUTS.cadence);
    near(a.phase, b.phase, 1e-12);
    near(a.metrics.linkResidualMm, b.metrics.linkResidualMm, 1e-9);
  }
});

test('MAMMUT M4: trunk curl, ear flare and gait inputs change real geometry and clamp safely', () => {
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
});

test('MAMMUT M4: substantial model, every part visible in Efficient, reversible explosion, bounded budget', async () => {
  const model = await descriptor('mammut').createModel();
  try {
    assert.ok(model.parts.length >= 140);
    const state = descriptor('mammut').sample(.317, descriptor('mammut').defaultInputs);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances >= 700);
    assert.ok(model.stats.triangles > 10000 && model.stats.triangles <= 200000);
    assert.ok(model.stats.drawCalls <= 40);
    const full = model.stats.instances;
    model.update(state, { quality: 'low', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances < full);
    const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
    assert.equal(visible.size, model.parts.length, 'Efficient keeps every selectable part');
  } finally { model.dispose(); }
  assert.equal(model.group.children.length, 0);
});

test('ABYSS S9: eighteen axial links, ten gill stations and a hinged jaw remain deterministic', () => {
  const s = abyss.sample(.317), base = abyss.DEFAULT_INPUTS;
  assert.equal(s.spine.links.length, 10);
  assert.equal(s.tail.links.length, 8);
  for (const link of s.spine.links) near(distance(link.start, link.end), abyss.D.spineLink);
  for (const link of s.tail.links) near(distance(link.start, link.end), abyss.D.tailLink);
  assert.ok(s.metrics.linkResidualMm < 1e-6);
  const wide = abyss.poseAt(1.2, { ...base, tail: 15 });
  assert.ok(Math.abs(wide.tail.points.at(-1)[0]) > Math.abs(abyss.poseAt(1.2, { ...base, tail: 3 }).tail.points.at(-1)[0]));
  const open = abyss.poseAt(1.2, { ...base, gape: 28 });
  assert.ok(open.head.jaw > s.head.jaw, 'gape opens the mandible');
  const fins = abyss.poseAt(1.2, { ...base, fin: 25 });
  assert.ok(Math.abs(fins.fins[0].pitch) > Math.abs(s.fins[0].pitch));
  assert.equal(abyss.inputsOf({ cadence: 0 }).cadence, .15);
  assert.equal(abyss.inputsOf({ tail: 99 }).tail, 15);
  assert.equal(abyss.inputsOf({ gape: -1 }).gape, 0);
  assert.equal(abyss.inputsOf({ fin: 99 }).fin, 25);
  for (let i = 0; i < 24; i++) {
    const a = abyss.sample(i / 24 / base.cadence), b = abyss.sample(i / 24 / base.cadence + 1 / base.cadence);
    near(a.phase, b.phase, 1e-12);
    near(a.metrics.tailTipX, b.metrics.tailTipX, 1e-9);
  }
});

test('ABYSS S9: shark model has distinct gills, jaw, fins and a display gantry', async () => {
  const d = descriptor('abyss');
  const model = await d.createModel();
  try {
    assert.ok(model.parts.length >= 105);
    for (let side of ['L', 'R']) for (let g = 1; g <= 5; g++) assert.ok(model.parts.some(part => part.id === `gill.${side}.${g}`));
    for (const id of ['head.jaw', 'fin.dorsal', 'fin.tail.upper', 'fin.tail.lower', 'gantry.cradle', 'gantry.beam']) assert.ok(model.parts.some(part => part.id === id), id);
    const state = d.sample(.317, d.defaultInputs);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.ok(model.stats.instances >= 850 && model.stats.triangles > 10000 && model.stats.triangles <= 200000);
    assert.ok(model.stats.drawCalls <= 40);
    model.update(state, { quality: 'low', mode: 'cutaway', explode: 1 });
    assert.ok(model.stats.instances < 850);
  } finally { model.dispose(); }
  assert.equal(model.group.children.length, 0);
});

test('CERVUS B6: alternating tripods, exact 820 mm pincers, antennae and abdomen links', () => {
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
  assert.equal(cervus.inputsOf({ cadence: 0 }).cadence, .15);
  assert.equal(cervus.inputsOf({ stride: 99 }).stride, .16);
  assert.equal(cervus.inputsOf({ gape: 99 }).gape, 32);
  assert.equal(cervus.inputsOf({ elytra: -1 }).elytra, 0);
  assert.equal(cervus.inputsOf({ antenna: 99 }).antenna, 25);
});

test('CERVUS B6: elytra, antennae and pincers are selectable in both quality tiers', async () => {
  const d = descriptor('cervus');
  const model = await d.createModel();
  try {
    assert.ok(model.parts.length >= 90);
    for (const id of ['elytra.L.cover', 'elytra.R.cover', 'mandible.L.1', 'mandible.R.1', 'antenna.L.club', 'abdomen.6.tergite']) assert.ok(model.parts.some(part => part.id === id), id);
    const state = d.sample(.317, d.defaultInputs);
    model.update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    const cover = model.group.getObjectByName('elytra.L.cover');
    const closed = cover.rotation.z;
    model.update(d.sample(.317, { ...d.defaultInputs, elytra: 28 }), { quality: 'balanced', mode: 'solid', explode: 0 });
    assert.notEqual(cover.rotation.z, closed, 'elytra lift turns the actual cover');
    assert.ok(model.stats.triangles > 10000 && model.stats.triangles <= 200000 && model.stats.drawCalls <= 40);
    for (const quality of ['balanced', 'low']) {
      model.update(state, { quality, mode: 'solid', explode: 0 });
      const visible = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
      assert.equal(visible.size, model.parts.length, `${quality}: every indexed part remains visible`);
    }
  } finally { model.dispose(); }
  assert.equal(model.group.children.length, 0);
});
