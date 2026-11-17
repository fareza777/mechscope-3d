// MYRIA is a fixed-datum inspection cycle, not a free locomotion solver.
export const TAU = 2 * Math.PI;
export const DEFAULT_INPUTS = Object.freeze({ cadence: .40, wave: .65 });
export const D = Object.freeze({ count: 12, pitch: .195, coxa: .075, femur: .19, tibia: .265, sole: .024, lag: 1 / 6 });
const clamp = (v, a, b, fallback) => Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : fallback;
export function inputsOf(input = {}) { return { cadence: clamp(input?.cadence, .12, .85, DEFAULT_INPUTS.cadence), wave: clamp(input?.wave, .25, 1, DEFAULT_INPUTS.wave) }; }
export const cycleHz = input => inputsOf(input).cadence;
export const wrap = v => ((v % 1) + 1) % 1;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, s) => a.map(v => v * s);
export const distance = (a, b) => Math.hypot(...sub(a, b));
const unit = a => mul(a, 1 / Math.hypot(...a));
export function yawPoint(origin, p, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return add(origin, [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export function legNormal(hip, coxa) {
  const radial = sub(coxa, hip);
  return mul(unit(cross(radial, [0, 1, 0])), radial[0] < 0 ? -1 : 1);
}
export function linkFrame(a, b, normal) {
  const y = unit(sub(b, a)), z = unit(normal), x = unit(cross(y, z));
  return { x, y, z };
}
export function solveKnee(a, b) {
  const d = distance(a, b);
  if (d <= Math.abs(D.femur - D.tibia) || d >= D.femur + D.tibia) throw new RangeError('Unreachable rigid MYRIA leg');
  const axis = unit(sub(b, a)), horizontal = Math.hypot(axis[0], axis[2]);
  // Deterministic +X bend at up/down vertical targets, where up has no projection.
  const pole = horizontal > 1e-12 ? [-axis[0] * axis[1] / horizontal, horizontal, -axis[2] * axis[1] / horizontal]
    : unit(sub([1, 0, 0], mul(axis, axis[0])));
  const along = (D.femur ** 2 - D.tibia ** 2 + d * d) / (2 * d);
  return add(add(a, mul(axis, along)), mul(pole, Math.sqrt(D.femur ** 2 - along ** 2)));
}
export const moduleWidth = i => .137 + .017 * Math.sin(Math.PI * (i + .5) / D.count);
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, { cadence, wave } = inputsOf(input);
  const phase = wrap((time % (1 / cadence)) * cadence), driveAngle = phase * TAU;
  let start = [0, .325, -D.count * D.pitch / 2];
  const modules = Array.from({ length: D.count }, (_, i) => {
    const yaw = .065 * wave * Math.sin(driveAngle - i * TAU * D.lag);
    const end = yawPoint(start, [0, 0, D.pitch], yaw);
    const segment = { id: i + 1, start, end, yaw, phase: wrap(phase - i * D.lag), width: moduleWidth(i) };
    start = end; return segment;
  });
  const legs = modules.flatMap((body, station) => [-1, 1].map(side => {
    const p = wrap(body.phase + (side > 0 ? .5 : 0)), stance = p < .66;
    const u = stance ? p / .66 : (p - .66) / .34;
    const travel = (stance ? -1 : 1) * (.014 + .020 * wave) * Math.cos(Math.PI * u);
    const lift = stance ? 0 : (.032 + .028 * wave) * Math.sin(Math.PI * u) ** 2;
    const hip = yawPoint(body.start, [side * body.width, 0, D.pitch / 2], body.yaw);
    const foot = yawPoint(body.start, [side * (.485 + .015 * wave * Math.sin(p * TAU)), D.sole + lift - body.start[1], D.pitch / 2 + travel], body.yaw);
    const delta = sub(foot, hip), azimuth = Math.atan2(delta[2], Math.abs(delta[0]));
    const coxa = add(hip, [side * D.coxa * Math.cos(azimuth), 0, D.coxa * Math.sin(azimuth)]);
    const knee = solveKnee(coxa, foot), a = sub(knee, coxa), b = sub(foot, knee);
    const dot = a.reduce((sum, v, i) => sum + v * b[i], 0) / (D.femur * D.tibia);
    return { id: `${station + 1}.${side < 0 ? 'L' : 'R'}`, station, side, phase: p, stance, hip, coxa, knee, foot,
      kneeAngle: Math.acos(clamp(dot, -1, 1, 0)) };
  }));
  const head = { origin: modules[0].start, yaw: modules[0].yaw };
  const tail = { origin: modules.at(-1).end, yaw: modules.at(-1).yaw };
  const antennae = [head, tail].flatMap((body, end) => [-1, 1].map(side => {
    const direction = end ? 1 : -1;
    const base = yawPoint(body.origin, [side * .075, .035, direction * .14], body.yaw);
    const yaw = body.yaw + side * (.32 + .10 * wave * Math.sin(driveAngle - end));
    const elbow = yawPoint(base, [side * .042, .025, direction * .11], yaw);
    const tip = yawPoint(elbow, [side * .028, .012, direction * .10], yaw);
    return { id: `${end ? 'tail' : 'head'}.${side < 0 ? 'L' : 'R'}`, base, elbow, tip, yaw, side, end };
  }));
  return { t: time, phase, driveAngle, modules, legs, head, tail, antennae,
    metrics: { crankRpm: cadence * 60, supportPads: legs.filter(l => l.stance).length, yawDegrees: .065 * wave * 180 / Math.PI, cycleSeconds: 1 / cadence, spineMm: D.count * D.pitch * 1000, stepMm: 2 * (.014 + .020 * wave) * 1000 } };
}
