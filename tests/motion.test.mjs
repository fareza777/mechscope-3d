import test from 'node:test';
import assert from 'node:assert/strict';
import { MECHANISMS } from '../src/catalog.js';

// Non-commensurate phase samples avoid integer-ratio aliasing (e.g. a clock train
// that lands on identical gear orientations at simple fractions of its cycle).
const PHASES = [0.017, 0.144, 0.271, 0.398, 0.525, 0.652, 0.779, 0.886, 0.963];

function snapshots(model) {
  return model.pickables.map(mesh => {
    if (mesh.isInstancedMesh) {
      assert.ok(mesh.instanceMatrix?.array, 'A rendered mechanism must expose instance matrices');
      return {
        ids: [...mesh.userData.instanceParts],
        count: mesh.count,
        matrices: Array.from(mesh.instanceMatrix.array)
      };
    }
    // Older rigs (e.g. landing gear) expose individually transformed meshes.
    return {
      ids: [mesh.userData.partId || mesh.name],
      count: 1,
      matrices: Array.from(mesh.matrixWorld.elements)
    };
  });
}

for (const descriptor of MECHANISMS) {
  test(`${descriptor.title}: real parts move over non-commensurate phases`, async () => {
    const model = await descriptor.createModel();
    try {
      const period = 1 / descriptor.cycleHz(descriptor.defaultInputs);
      const frames = [];
      for (const phase of PHASES) {
        model.update(descriptor.sample(phase * period, descriptor.defaultInputs), { quality: 'balanced', mode: 'solid', explode: 0 });
        frames.push(snapshots(model));
      }
      const movingParts = new Set(), movingInstances = new Set();
      for (let a = 0; a < frames.length; a++) for (let b = a + 1; b < frames.length; b++) {
        const A = frames[a], B = frames[b];
        assert.equal(A.length, B.length);
        for (let m = 0; m < A.length; m++) {
          const ca = A[m].matrices.length / 16, cb = B[m].matrices.length / 16;
          for (let i = 0; i < Math.max(ca, cb); i++) {
            const id = A[m].ids[i] ?? B[m].ids[i];
            if (!id) continue;
            if (i >= Math.max(A[m].count, B[m].count)) continue;
            if (i >= A[m].count || i >= B[m].count) {
              movingInstances.add(`${m}:${i}`); movingParts.add(id); continue;
            }
            let delta = 0;
            for (let k = 0; k < 16; k++) delta = Math.max(delta, Math.abs(A[m].matrices[i * 16 + k] - B[m].matrices[i * 16 + k]));
            if (delta > 1e-5) { movingInstances.add(`${m}:${i}`); movingParts.add(id); }
          }
        }
      }
      const parts = model.parts.length;
      const floor = Math.max(20, Math.ceil(parts * .18));
      assert.ok(movingParts.size >= floor, `${descriptor.id}: only ${movingParts.size}/${parts} parts move; need ${floor}`);
      assert.ok(movingInstances.size >= 24, `${descriptor.id}: only ${movingInstances.size} moving instances`);
      console.log(`${descriptor.collection} ${descriptor.title}: ${movingParts.size}/${parts} parts move, ${movingInstances.size} instances`);
    } finally {
      model.dispose(); model.dispose();
    }
    assert.equal(model.pickables.length, 0);
  });
}
