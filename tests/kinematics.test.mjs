import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleSpider, DESIGN, footTrajectory, distance, solveLeg } from '../src/spider/kin.js';
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('all eight legs preserve rigid lengths throughout 20 gait cycles', () => {
  for (let i = 0; i < 4000; i++) {
    const s = sampleSpider(i / 110);
    assert.equal(s.legs.length, 8);
    assert.ok(s.metrics.contacts >= 4);
    assert.ok(s.metrics.supportArea > 1);
    for (const l of s.legs) {
      near(distance(l.hip, l.coxa), DESIGN.coxa);
      near(distance(l.coxa, l.knee), DESIGN.femur);
      near(distance(l.knee, l.ankle), DESIGN.tibia);
      near(distance(l.ankle, l.foot), DESIGN.tarsus);
      assert.ok(l.foot[1] >= 0);
      if (l.stance) near(l.foot[1], 0);
      assert.ok(Object.values(l.joints).every(Number.isFinite));
    }
  }
});

test('pose is deterministic, order-independent and periodic', () => {
  const a = sampleSpider(1.23);
  sampleSpider(27);
  assert.deepEqual(sampleSpider(1.23), a);
  const b = sampleSpider(1.23 + 1 / 0.55);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) near(a.legs[i].foot[j], b.legs[i].foot[j]);
});

test('gait foot position and velocity are continuous at lift-off and landing', () => {
  const h = 1e-6;
  for (const p of [0, DESIGN.duty, 1]) {
    const a = footTrajectory(p - h, 0.26, 0.16), b = footTrajectory(p, 0.26, 0.16), c = footTrajectory(p + h, 0.26, 0.16);
    near(a.z, c.z, 1e-5); near(a.lift, c.lift, 1e-5);
    near((b.z - a.z) / h, (c.z - b.z) / h, 1e-4);
    near((b.lift - a.lift) / h, (c.lift - b.lift) / h, 1e-4);
  }
});

test('all UI simulation boundary combinations remain physically reachable', () => {
  for (const height of [0.72, 0.82, 0.90]) for (const stride of [0.1, 0.26, 0.34]) for (const clearance of [0.06, 0.16, 0.22]) for (const direction of [-1, 1]) {
    for (let i = 0; i < 80; i++) {
      const s = sampleSpider(i / (80 * 0.55), { height, stride, clearance, direction });
      assert.ok(s.legs.every(l => l.knee.every(Number.isFinite)));
    }
  }
});

test('displayed reduction and speed reconcile with model parameters', () => {
  const s = sampleSpider(2, { cadence: 0.8, stride: 0.3 });
  near(s.metrics.motorRpm / s.metrics.outputRpm, DESIGN.outputTeeth / DESIGN.motorTeeth);
  near(s.metrics.groundSpeed, 0.3 * 0.8 / DESIGN.duty);
  near(s.metrics.cycleSeconds, 1 / 0.8);
});

test('negative control rejects unreachable targets rather than silently deforming links', () => {
  assert.throws(() => solveLeg([0, 1, 0], [4, 0, 1], 1), RangeError);
});
