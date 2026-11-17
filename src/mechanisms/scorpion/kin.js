// Metres, seconds and radians. A conceptual servo walker, not animal dynamics.
export const TAU = 2 * Math.PI;
export const DEFAULT_INPUTS = Object.freeze({ cadence: .28, posture: .65 });
export const DIM = Object.freeze({ coxa: .14, femur: .39, tibia: .49, sole: .032, humerus: .22, forearm: .24, palm: .16, jaw: .205 });
export const TAIL_LENGTHS = Object.freeze([.24, .24, .24, .23, .22, .20]);
// Fixed pin coordinates in each member's local +Y rail frame.
export const LEG_MOUNT = Object.freeze([0, DIM.femur - .035, .065]);
export const CLAW_MOUNT = Object.freeze([0, DIM.forearm - .03, .07]);
const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
export const cadenceOf = (input = {}) => clamp(input?.cadence, .12, .7, DEFAULT_INPUTS.cadence);
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, k) => a.map(v => v * k);
export const distance = (a, b) => Math.hypot(...sub(a, b));
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = a => mul(a, 1 / Math.hypot(...a));
export const wrap = n => ((n % 1) + 1) % 1;

// Same shortest-arc +Y-to-link rotation as mechanical-kit aim(), without Three.
function linkPoint(start, end, local) {
  const [x, y, z] = unit(sub(end, start));
  if (1 + y < Number.EPSILON) return add(start, [-local[0], -local[1], local[2]]);
  const k = (x * local[0] + z * local[2]) / (1 + y);
  return add(start, [local[0] + x * (local[1] - k), y * local[1] - x * local[0] - z * local[2], local[2] + z * (local[1] - k)]);
}

// Intersection of two spheres in the plane containing the upward pole.
// No length clamping: unreachable targets are programming errors, not elastic legs.
export function solveKnee(hip, foot, upper = DIM.femur, lower = DIM.tibia) {
  const d = distance(hip, foot);
  if (d <= Math.abs(upper - lower) || d >= upper + lower) throw new RangeError('Scorpion leg target is outside its rigid reach.');
  const axis = unit(sub(foot, hip));
  const pole = unit(sub([0, 1, 0], mul(axis, dot(axis, [0, 1, 0]))));
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  return add(add(hip, mul(axis, along)), mul(pole, Math.sqrt(upper * upper - along * along)));
}

function legAt(side, station, phase) {
  // Opposite legs alternate; a 64% support interval leaves at least four pads down.
  const p = wrap(phase + (station % 2) * .5 + (side > 0 ? .5 : 0));
  const stance = p < .64;
  const u = stance ? p / .64 : (p - .64) / .36;
  const travel = (stance ? -1 : 1) * .095 * Math.cos(Math.PI * u);
  const lift = stance ? 0 : .115 * Math.sin(Math.PI * u) ** 2;
  const z = -.405 + station * .27;
  const hip = [side * .30, .61, z];
  const foot = [side * (.91 + .025 * Math.sin(station * Math.PI / 3)), DIM.sole + lift, z + (station - 1.5) * .095 + travel];
  const yaw = Math.atan2(foot[2] - hip[2], Math.abs(foot[0] - hip[0]));
  const coxa = add(hip, [side * DIM.coxa * Math.cos(yaw), 0, DIM.coxa * Math.sin(yaw)]);
  const knee = solveKnee(coxa, foot);
  const actuatorA = add(hip, [0, .065, .065]);
  const actuatorB = linkPoint(coxa, knee, LEG_MOUNT);
  return { id: `${side < 0 ? 'L' : 'R'}${station + 1}`, side, station, phase: p, stance, yaw, hip, coxa, knee, foot, actuatorA, actuatorB, actuatorLength: distance(actuatorA, actuatorB) };
}

export function yawPoint(origin, local, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return add(origin, [local[0] * c + local[2] * s, local[1], -local[0] * s + local[2] * c]);
}
function clawAt(side, angle, posture) {
  const shoulder = [side * .31, .625, -.46];
  const upperYaw = side * (.65 + .08 * Math.sin(angle));
  const upperDirection = [Math.sin(upperYaw) * Math.cos(.1), Math.sin(.1), -Math.cos(upperYaw) * Math.cos(.1)];
  const elbow = add(shoulder, mul(upperDirection, DIM.humerus));
  const yaw = -side * (.08 + .065 * Math.sin(angle));
  const wrist = yawPoint(elbow, [0, 0, -DIM.forearm], yaw);
  const palmTip = yawPoint(wrist, [0, 0, -DIM.palm], yaw);
  // Keep the 18 mm-radius hooks clear at closure without changing peak aperture.
  const opening = .14 + (.13 + .29 * posture) * (.5 + .5 * Math.sin(angle + .6));
  const jaws = [-1, 1].map(q => {
    const pivot = yawPoint(palmTip, [q * .05, 0, 0], yaw);
    const rotation = yaw - q * opening;
    const knuckle = yawPoint(pivot, [q * .02, 0, -.12], rotation);
    const tip = yawPoint(pivot, [-q * .058, 0, -DIM.jaw], rotation);
    return { side: q, pivot, knuckle, tip, yaw: rotation };
  });
  const actuatorA = add(shoulder, [0, .07, .03]);
  const actuatorB = linkPoint(elbow, wrist, CLAW_MOUNT);
  return { side, shoulder, elbow, wrist, palmTip, yaw, opening, jaws, gap: distance(jaws[0].tip, jaws[1].tip), actuatorA, actuatorB, actuatorLength: distance(actuatorA, actuatorB) };
}

export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0;
  const cadence = cadenceOf(input), posture = clamp(input?.posture, 0, 1, DEFAULT_INPUTS.posture);
  const phase = wrap(time * cadence), driveAngle = phase * TAU;
  const legs = [-1, 1].flatMap(side => Array.from({ length: 4 }, (_, i) => legAt(side, i, phase)));
  const claws = [-1, 1].map(side => clawAt(side, driveAngle, posture));
  let start = [0, .68, .55];
  const tail = TAIL_LENGTHS.map((length, i) => {
    const elevation = [.32, .77, 1.22, 1.76, 2.28, 2.85][i] + .12 * (posture - .5) + .06 * Math.sin(driveAngle + i * .38);
    const yaw = (.045 + .10 * posture) * Math.sin(driveAngle + i * .32);
    const direction = [Math.sin(yaw) * Math.cos(elevation), Math.sin(elevation), Math.cos(yaw) * Math.cos(elevation)];
    const end = add(start, mul(direction, length));
    const link = { start, end, length, yaw, elevation, roll: .10 * Math.sin(driveAngle + i * .4) };
    start = end;
    return link;
  });
  const stingerBase = start;
  const stingerTip = add(stingerBase, [.025 * Math.sin(driveAngle), -.15, -.20]);
  // Keep the terminal stylus rigid while its azimuth follows the tail.
  const stinger = { start: stingerBase, end: add(stingerBase, mul(unit(sub(stingerTip, stingerBase)), .25)), length: .25 };
  return {
    t: time, phase, driveAngle, legs, claws, tail, stinger,
    metrics: { crankRpm: cadence * 60, cycleSeconds: 1 / cadence, supportPads: legs.filter(l => l.stance).length, tailHeight: Math.max(...tail.map(l => l.end[1])), clawGap: claws[0].gap, footLift: .115 },
  };
}
