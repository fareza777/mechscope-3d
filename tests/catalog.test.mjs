import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { MECHANISMS } from '../src/catalog.js';

const expected = ['arachne-sc08', 'crossplane-v8', 'strandbeest', 'cessna-gear', 'scorpion', 'dragonfly', 'mantis', 'octopus', 'robot-fish', 'crab', 'centipede', 'cobra', 'tortoise', 'hummingbird', 'robot-hand', 'radial-engine', 'planetary', 'steam-locomotive', 'tourbillon', 'sentinel', 'mammut', 'abyss', 'cervus', 'astrarium', 'excavator', 'observatory', 'piano', 'robot-cell', 'dragon', 'horse', 'eurypterid', 'nautilus', 'grasshopper', 'pangolin', 'tiltrotor'];
const matrices = model => {
  model.group.updateMatrixWorld(true);
  return model.pickables.filter(mesh => mesh.count).map(mesh => {
    const local = mesh.matrixWorld.clone(), world = local.clone(), values = [];
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, local); world.multiplyMatrices(mesh.matrixWorld, local); world.toArray(values, i * 16);
    }
    return values;
  });
};
const finite = value => {
  if (typeof value === 'number') assert.ok(Number.isFinite(value));
  else if (Array.isArray(value)) value.forEach(finite);
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
};

test('thirty-five independently addressable offline mechanisms retain the original nine in order', () => {
  assert.deepEqual(MECHANISMS.map(model => model.id), expected);
  assert.equal(new Set(MECHANISMS.map(model => model.title)).size, 35);
  for (const [i, descriptor] of MECHANISMS.entries()) {
    assert.equal(descriptor.collection, String(i + 1).padStart(3, '0'));
    assert.equal(descriptor.specs.length, 2);
    assert.equal(descriptor.lessons.length, 5);
    assert.ok(descriptor.controls.length >= 1);
    for (const control of descriptor.controls) {
      const value = descriptor.defaultInputs[control.key];
      assert.ok(value >= control.min && value <= control.max, `${descriptor.id}: default ${control.key}`);
      assert.ok(control.step > 0 && Number.isInteger(control.precision));
    }
    for (const lesson of descriptor.lessons) {
      assert.ok(lesson.text.length > 100 && lesson.fact.length > 20);
      assert.ok(['home', 'detail', 'front', 'side', 'top', 'exploded'].includes(lesson.view));
      assert.ok(['solid', 'xray', 'cutaway'].includes(lesson.mode));
    }
  }
});

for (const descriptor of MECHANISMS.slice(9)) {
  test(`${descriptor.title}: lazy model integrates with shared anatomy, quality and playback contracts`, async () => {
    const model = await descriptor.createModel();
    try {
      assert.ok(model.group.isGroup);
      assert.equal(new Set(model.parts.map(part => part.id)).size, model.parts.length);
      assert.equal(new Set(model.parts.map(part => part.name)).size, model.parts.length);
      assert.ok(model.parts.length >= 80, `${descriptor.id}: substantial selectable anatomy`);
      for (const part of model.parts) {
        for (const key of ['id', 'name', 'system', 'function', 'how', 'material', 'unit', 'detail']) assert.ok(typeof part[key] === 'string' && part[key].length > (key === 'unit' ? 0 : 2), `${descriptor.id}/${part.id}/${key}`);
        assert.ok(part.function.length + part.how.length > 80, `${part.id}: useful explanation`);
      }
      const input = { ...descriptor.defaultInputs }, pose = descriptor.sample(.317, input);
      const untouched = structuredClone(pose);
      finite(pose);
      model.update(pose, { quality: 'balanced', mode: 'solid', explode: 0 });
      const assembled = matrices(model);
      assert.ok(model.stats.triangles > 10000 && model.stats.triangles <= 200000);
      assert.ok(model.stats.drawCalls <= 40);
      const fullCount = model.stats.instances;
      model.update(pose, { quality: 'balanced', mode: 'solid', explode: 1 });
      assert.equal(model.stats.instances, fullCount);
      assert.notDeepEqual(matrices(model), assembled, 'Explosion alone moves the same assembled geometry');
      model.update(pose, { quality: 'balanced', mode: 'solid', explode: 0 });
      assert.deepEqual(matrices(model), assembled);
      model.update(descriptor.sample(.317 + .27 / descriptor.cycleHz(input), input));
      assert.notDeepEqual(matrices(model), assembled, 'The sampled cycle moves actual instance transforms');
      model.update(pose, { quality: 'low', mode: 'cutaway', explode: 1 });
      assert.notDeepEqual(matrices(model), assembled);
      assert.ok(model.stats.instances < fullCount, 'Efficient tier removes micro-detail, not resolution');
      const visibleIds = new Set(model.pickables.flatMap(mesh => mesh.userData.instanceParts.slice(0, mesh.count)));
      assert.deepEqual(visibleIds, new Set(model.parts.map(part => part.id)), 'Every indexed assembly remains present in Efficient');
      model.update(pose, { quality: 'high', mode: 'xray', explode: .45 });
      assert.ok(model.pickables.some(mesh => mesh.count && mesh.material.transparent), 'Shell armor ghosts in X-ray');
      model.update(pose, { quality: 'balanced', mode: 'solid', explode: 0 });
      assert.deepEqual(matrices(model), assembled, 'Exploding and reassembling cannot accumulate transform drift');
      assert.deepEqual(pose, untouched, 'Rendering cannot mutate the sampled state');
      for (const control of descriptor.controls) {
        const minimum = { ...input, [control.key]: control.min }, maximum = { ...input, [control.key]: control.max };
        let changesGeometry = false;
        // Gesture-specific controls may be inactive at the beginning of the choreography.
        for (const phase of [.017, .144, .271, .398, .525, .652, .779, .886, .963]) {
          const time = .317 + phase / descriptor.cycleHz(input);
          const a = descriptor.sample(time, minimum), b = descriptor.sample(time, maximum);
          finite(a); finite(b);
          model.update(a); const minMatrices = matrices(model);
          model.update(b); changesGeometry ||= !isDeepStrictEqual(matrices(model), minMatrices);
        }
        assert.ok(changesGeometry, `${control.key} changes rendered geometry during the cycle`);
      }
      const period = 1 / descriptor.cycleHz(input);
      model.update(descriptor.sample(.317 + period, input));
      const repeated = matrices(model);
      assert.equal(repeated.length, assembled.length);
      for (let i = 0; i < assembled.length; i++) {
        assert.equal(repeated[i].length, assembled[i].length);
        for (let j = 0; j < assembled[i].length; j++) assert.ok(Math.abs(repeated[i][j] - assembled[i][j]) < 3e-6, `${descriptor.id}: every rendered part repeats after its advertised cycle`);
      }
    } finally {
      model.dispose(); model.dispose();
    }
    assert.equal(model.group.children.length, 0);
    assert.equal(model.pickables.length, 0);
  });
}
