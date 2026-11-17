// Designed command geometry in metres, seconds and radians. No force solver.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: .22, stride: .7 });
export const D = Object.freeze({ coxa: .105, femur: .20, tibia: .26, sole: .055, barrel: .15, piston: .20, neckA: .145, neckB: .155, tail: .205 });
export const MOUNT = Object.freeze([0, .145, .09]);
const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
export const inputsOf = (input = {}) => ({ cadence: clamp(input?.cadence, .08, .55, DEFAULT_INPUTS.cadence), stride: clamp(input?.stride, 0, 1, DEFAULT_INPUTS.stride) });
export const cycleHz = input => inputsOf(input).cadence;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, s) => a.map(v => v * s);
export const distance = (a, b) => Math.hypot(...sub(a, b));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = a => mul(a, 1 / Math.hypot(...a));
const wrap = p => ((p % 1) + 1) % 1;
// Independent shortest-arc +Y frame, matching the kit's rigid aim operation.
export function linkPoint(a, b, p) {
  const [x, y, z] = unit(sub(b, a));
  if (1 + y < Number.EPSILON) return add(a, [-p[0], -p[1], p[2]]);
  const k = (x * p[0] + z * p[2]) / (1 + y);
  return add(a, [p[0] + x * (p[1] - k), y * p[1] - x * p[0] - z * p[2], p[2] + z * (p[1] - k)]);
}
export function solveKnee(a, foot) {
  const d = distance(a, foot), axis = unit(sub(foot, a));
  if (d <= Math.abs(D.femur - D.tibia) || d >= D.femur + D.tibia) throw new RangeError('Tortoise target outside rigid reach');
  const pole = unit(sub([0, 1, 0], mul(axis, axis[1])));
  const u = (D.femur ** 2 - D.tibia ** 2 + d * d) / (2 * d);
  return add(add(a, mul(axis, u)), mul(pole, Math.sqrt(D.femur ** 2 - u * u)));
}
function legAt(side, station, phase, stride) {
  // Four quarter-cycle groups; 78% stance leaves at least three pads down.
  const p = wrap(phase + station * .5 + (side > 0 ? .25 : 0)), stance = p < .78;
  const u = stance ? p / .78 : (p - .78) / .22;
  const travel = .080 * stride * (stance ? -Math.cos(Math.PI * u) : Math.cos(Math.PI * u));
  const lift = stance ? 0 : (.02 + .045 * stride) * Math.sin(Math.PI * u) ** 2;
  const z = station === 0 ? -.49 : .49;
  const hip = [side * .435, .46, z];
  const foot = [side * .705, D.sole + lift, z + (station ? .04 : -.04) + travel];
  const horizontal = unit([foot[0] - hip[0], 0, foot[2] - hip[2]]);
  const coxa = add(hip, mul(horizontal, D.coxa)), knee = solveKnee(coxa, foot);
  const actuatorA = add(hip, [0, .055, .09]);
  const actuatorB = linkPoint(coxa, knee, MOUNT), direction = unit(sub(actuatorB, actuatorA));
  return { id: `${station ? 'hind' : 'fore'}.${side < 0 ? 'L' : 'R'}`, side, station, phase: p, stance, hip, coxa, knee, foot,
    actuator: { a: actuatorA, b: actuatorB, rodStart: sub(actuatorB, mul(direction, D.piston)), length: distance(actuatorA, actuatorB) },
    kneeAngle: Math.acos(clamp(dot(unit(sub(knee, coxa)), unit(sub(foot, knee))), -1, 1, 0)),
  };
}
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const inputs = inputsOf(input), driveAngle = Number.isFinite(angle) ? wrap(angle / TAU) * TAU : 0;
  const phase = driveAngle / TAU;
  const legs = [0, 1].flatMap(station => [-1, 1].map(side => legAt(side, station, phase, inputs.stride)));
  const pitchA = .36 + .22 * Math.sin(driveAngle + .3), pitchB = -.22 - .19 * Math.sin(driveAngle + .3);
  const neckStart = [0, .64, -.70];
  const neckMid = add(neckStart, [0, D.neckA * Math.sin(pitchA), -D.neckA * Math.cos(pitchA)]);
  const neckEnd = add(neckMid, [0, D.neckB * Math.sin(pitchB), -D.neckB * Math.cos(pitchB)]);
  const neck = [{ start: neckStart, end: neckMid, length: D.neckA, pitch: pitchA }, { start: neckMid, end: neckEnd, length: D.neckB, pitch: pitchB }];
  const headPitch = .055 * Math.sin(driveAngle + .9), jawAngle = .10 + .20 * (.5 + .5 * Math.sin(driveAngle + 1.1));
  const pitchPoint = (origin, p, a) => add(origin, [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)]);
  const jawStart = pitchPoint(neckEnd, [0, -.042, -.035], headPitch);
  const tailYaw = .17 * Math.sin(driveAngle + 2), tailPitch = -.17 + .05 * Math.sin(driveAngle);
  const tailStart = [0, .565, .785];
  const tailEnd = add(tailStart, [D.tail * Math.sin(tailYaw) * Math.cos(tailPitch), D.tail * Math.sin(tailPitch), D.tail * Math.cos(tailYaw) * Math.cos(tailPitch)]);
  return { driveAngle, inputs, legs, neck, head: { start: neckEnd, pitch: headPitch },
    jaw: { start: jawStart, angle: jawAngle, end: pitchPoint(jawStart, [0, 0, -.16], headPitch - jawAngle) },
    tail: { start: tailStart, end: tailEnd, yaw: tailYaw, pitch: tailPitch },
    metrics: { driveRpm: inputs.cadence * 60, strideMm: 160 * inputs.stride, supportPads: legs.filter(l => l.stance).length, cycleSeconds: 1 / inputs.cadence, neckReachMm: (neckStart[2] - neckEnd[2]) * 1000, maxFootLiftMm: (20 + 45 * inputs.stride) },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, hz = cycleHz(input), phase = wrap((time % (1 / hz)) * hz);
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
