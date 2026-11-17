// Designed service-demonstrator dimensions: metres, seconds, radians; no dynamics.
export const TAU = 2 * Math.PI;
export const DEFAULT_INPUTS = Object.freeze({ cadence: .32, aperture: .65 });
export const D = Object.freeze({ coxa: .11, femur: .28, tibia: .37, sole: .032, upper: .20, forearm: .23, palm: .16, barrel: .18, piston: .19 });
export const LEG_ANCHOR = Object.freeze([0, .215, .057]);
export const CLAW_ANCHOR = Object.freeze([0, .195, .065]);
const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
export function inputsOf(input = {}) { return { cadence: clamp(input?.cadence, .12, .75, DEFAULT_INPUTS.cadence), aperture: clamp(input?.aperture, 0, 1, DEFAULT_INPUTS.aperture) }; }
export const cycleHz = input => inputsOf(input).cadence;
export const wrap = n => ((n % 1) + 1) % 1;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, k) => a.map(v => v * k);
export const distance = (a, b) => Math.hypot(...sub(a, b));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = a => mul(a, 1 / Math.hypot(...a));
export function yawPoint(origin, p, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return add(origin, [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]);
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// Keep the transverse journal in the leg plane's normal, with a stable +Z sign.
export function legNormal(hip, coxa) {
  const radial = sub(coxa, hip);
  return mul(unit(cross(radial, [0, 1, 0])), radial[0] < 0 ? -1 : 1);
}
// Complete right-handed frame shared by rendering and rigid bracket transforms.
export function linkFrame(a, b, normal) {
  const y = unit(sub(b, a)), z = unit(normal), x = unit(cross(y, z));
  return { x, y, z };
}
export function linkPoint(a, b, p, normal) {
  const { x, y, z } = linkFrame(a, b, normal);
  return add(a, add(add(mul(x, p[0]), mul(y, p[1])), mul(z, p[2])));
}
export function solveKnee(a, b, upper = D.femur, lower = D.tibia) {
  const d = distance(a, b);
  if (d <= Math.abs(upper - lower) || d >= upper + lower) throw new RangeError('Unreachable rigid crab leg');
  const axis = unit(sub(b, a)), horizontal = Math.hypot(axis[0], axis[2]);
  // The up projection vanishes at either vertical pole. Choose +X there.
  const pole = horizontal > 1e-12 ? [-axis[0] * axis[1] / horizontal, horizontal, -axis[2] * axis[1] / horizontal]
    : unit(sub([1, 0, 0], mul(axis, axis[0])));
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  return add(add(a, mul(axis, along)), mul(pole, Math.sqrt(upper * upper - along * along)));
}
function legAt(side, station, phase) {
  const p = wrap(phase + (station % 2) * .5 + (side > 0 ? .5 : 0));
  const stance = p < .64, u = stance ? p / .64 : (p - .64) / .36;
  const sweep = (stance ? -1 : 1) * .044 * Math.cos(Math.PI * u);
  const lift = stance ? 0 : .075 * Math.sin(Math.PI * u) ** 2;
  const hip = [side * .405, .445, -.33 + station * .22];
  const foot = [side * .865 + sweep, D.sole + lift, hip[2] + (station - 1.5) * .062];
  const yaw = Math.atan2(foot[2] - hip[2], Math.abs(foot[0] - hip[0]));
  const coxa = add(hip, [side * D.coxa * Math.cos(yaw), 0, D.coxa * Math.sin(yaw)]);
  const knee = solveKnee(coxa, foot);
  const actuatorA = add(hip, [0, .035, .057]), actuatorB = linkPoint(coxa, knee, LEG_ANCHOR, legNormal(hip, coxa));
  const u1 = sub(knee, coxa), u2 = sub(foot, knee);
  return { id: `${side < 0 ? 'L' : 'R'}${station + 1}`, side, station, phase: p, stance, hip, coxa, knee, foot, yaw,
    kneeAngle: Math.acos(clamp(dot(u1, u2) / (D.femur * D.tibia), -1, 1, 0)), actuatorA, actuatorB, actuatorLength: distance(actuatorA, actuatorB) };
}
function clawAt(side, angle, aperture) {
  // Forward saddles leave the first lateral hip bracket's complete swept volume clear.
  const shoulder = [side * .265, .49, -.455];
  const upperYaw = -side * (.60 + .07 * Math.sin(angle));
  const elbow = yawPoint(shoulder, [0, 0, -D.upper], upperYaw);
  const yaw = -side * (.12 + .06 * Math.sin(angle + .4));
  const wrist = yawPoint(elbow, [0, 0, -D.forearm], yaw);
  const palmTip = yawPoint(wrist, [0, 0, -D.palm], yaw);
  const opening = .22 + (.10 + .32 * aperture) * (.5 + .5 * Math.sin(angle + .6));
  const jaws = [-1, 1].map(q => {
    const pivot = yawPoint(palmTip, [q * .062, 0, 0], yaw), rotation = yaw - q * opening;
    const knuckle = yawPoint(pivot, [q * .038, 0, -.155], rotation);
    const tip = yawPoint(pivot, [-q * .055, 0, -.265], rotation);
    return { side: q, pivot, knuckle, tip, yaw: rotation };
  });
  const actuatorA = add(shoulder, [0, .04, .065]), actuatorB = linkPoint(elbow, wrist, CLAW_ANCHOR, [0, 1, 0]);
  return { side, shoulder, elbow, wrist, palmTip, yaw, opening, jaws, gap: distance(jaws[0].tip, jaws[1].tip), actuatorA, actuatorB, actuatorLength: distance(actuatorA, actuatorB) };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, { cadence, aperture } = inputsOf(input);
  const phase = wrap((time % (1 / cadence)) * cadence), driveAngle = phase * TAU;
  const legs = [-1, 1].flatMap(side => Array.from({ length: 4 }, (_, i) => legAt(side, i, phase)));
  const claws = [-1, 1].map(side => clawAt(side, driveAngle, aperture));
  const eyes = [-1, 1].map(side => {
    const base = [side * .20, .605, -.295], yaw = side * .26 + .28 * Math.sin(driveAngle + side * .4);
    const tip = yawPoint(base, [0, .205, -.055], yaw);
    return { side, base, tip, yaw, scan: .30 * Math.sin(driveAngle + side * .4) };
  });
  return { t: time, phase, driveAngle, legs, claws, eyes,
    metrics: { crankRpm: cadence * 60, supportPads: legs.filter(l => l.stance).length, clawGapMm: claws[0].gap * 1000, cycleSeconds: 1 / cadence, liftMm: 75 } };
}
