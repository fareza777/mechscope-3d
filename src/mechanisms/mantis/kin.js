// Educational kinematics in metres / seconds / radians; no contact or force solver.
export const TAU = 2 * Math.PI;
export const DEFAULT_INPUTS = Object.freeze({ cadence: .24, reach: .6 });
export const DIM = Object.freeze({ coxa: .13, femur: .48, tibia: .63, sole: .033, shoulder: .26, arm: .38, grasper: .34, crank: .075, coupler: .145, rocker: .085, closureOffset: .105 });
// Fixed pin coordinates in each member's local +Y rail frame.
export const LEG_MOUNT = Object.freeze([0, DIM.femur - .025, .063]);
export const shoulderMount = side => [side * .045, DIM.shoulder - .035, .06];
const clamp = (v, a, b, fallback) => Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : fallback;
export const cadenceOf = (input = {}) => clamp(input?.cadence, .10, .6, DEFAULT_INPUTS.cadence);
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, k) => a.map(v => v * k);
export const distance = (a, b) => Math.hypot(...sub(a, b));
const unit = a => mul(a, 1 / Math.hypot(...a));
const wrap = x => ((x % 1) + 1) % 1;

// Same shortest-arc +Y-to-link rotation as mechanical-kit aim(), without Three.
function linkPoint(start, end, local) {
  const [x, y, z] = unit(sub(end, start));
  if (1 + y < Number.EPSILON) return add(start, [-local[0], -local[1], local[2]]);
  const k = (x * local[0] + z * local[2]) / (1 + y);
  return add(start, [local[0] + x * (local[1] - k), y * local[1] - x * local[0] - z * local[2], local[2] + z * (local[1] - k)]);
}

export function solveKnee(hip, foot) {
  const d = distance(hip, foot);
  if (d <= Math.abs(DIM.femur - DIM.tibia) || d >= DIM.femur + DIM.tibia) throw new RangeError('Mantis support target is outside its rigid reach.');
  const axis = unit(sub(foot, hip));
  const pole = unit(sub([0, 1, 0], mul(axis, axis[1])));
  const a = (DIM.femur ** 2 - DIM.tibia ** 2 + d * d) / (2 * d);
  return add(add(hip, mul(axis, a)), mul(pole, Math.sqrt(DIM.femur ** 2 - a * a)));
}

// The upper intersection is the permanent assembly branch of a pin-joint four-bar.
export function circleIntersection(a, ar, b, br) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
  if (d <= Math.abs(ar - br) || d >= ar + br) throw new RangeError('Mantis closure has no non-singular circle intersection.');
  const x = (ar * ar - br * br + d * d) / (2 * d), h = Math.sqrt(ar * ar - x * x);
  return [a[0] + x * dx / d - h * dy / d, a[1] + x * dy / d + h * dx / d];
}

function supportAt(side, station, phase) {
  const p = wrap(phase + station * .5 + (side > 0 ? .5 : 0));
  const stance = p < .72, u = stance ? p / .72 : (p - .72) / .28;
  const travel = (stance ? -1 : 1) * .085 * Math.cos(Math.PI * u);
  const hip = [side * .155, .86 - station * .035, .04 + station * .40];
  const foot = [side * (.77 + station * .07), DIM.sole + (stance ? 0 : .09 * Math.sin(Math.PI * u) ** 2), -.27 + station * 1.10 + travel];
  const yaw = Math.atan2(foot[2] - hip[2], Math.abs(foot[0] - hip[0]));
  const coxa = add(hip, [side * DIM.coxa * Math.cos(yaw), 0, DIM.coxa * Math.sin(yaw)]);
  const knee = solveKnee(coxa, foot);
  const actuatorA = add(hip, [0, .07, .063]), actuatorB = linkPoint(coxa, knee, LEG_MOUNT);
  return { id: `${side < 0 ? 'L' : 'R'}${station + 1}`, side, station, phase: p, stance, yaw, hip, coxa, knee, foot, actuatorA, actuatorB, actuatorLength: distance(actuatorA, actuatorB) };
}

function armAt(side, angle, reach) {
  const shoulder = [side * .12, 1.405, -.30];
  const elbow = add(shoulder, mul(unit([side * (.67 + .04 * Math.sin(angle)), -.32, -.67]), DIM.shoulder));
  const theta = -.56 + .16 * Math.sin(angle - .6) + .10 * reach;
  const opening = .28 + (.32 + .48 * reach) * (.5 + .5 * Math.sin(angle));
  const along = [0, Math.sin(theta), -Math.cos(theta)], normal = [0, Math.cos(theta), Math.sin(theta)];
  const wrist = add(elbow, mul(along, DIM.arm));
  const tipDirection = [0, -Math.sin(theta + opening), Math.cos(theta + opening)];
  const tip = add(wrist, mul(tipDirection, DIM.grasper));
  const D = [.20, .052], W = [DIM.arm, 0];
  const B = [DIM.arm - DIM.rocker * Math.cos(opening), -DIM.rocker * Math.sin(opening)];
  const A = circleIntersection(D, DIM.crank, B, DIM.coupler);
  const toWorld = p => add(add(add(elbow, mul(along, p[0])), mul(normal, p[1])), [side * DIM.closureOffset, 0, 0]);
  const closure = { D: toWorld(D), A: toWorld(A), B: toWorld(B), W: toWorld(W), crankAngle: Math.atan2(A[1] - D[1], A[0] - D[0]), local: { D, A, B, W } };
  const actuatorA = add(shoulder, [side * .045, .035, .055]), actuatorB = linkPoint(shoulder, elbow, shoulderMount(side));
  return { side, shoulder, elbow, wrist, tip, theta, opening, femurRotation: theta - Math.PI / 2, tibiaRotation: theta + opening + Math.PI / 2, closure, actuatorA, actuatorB, actuatorLength: distance(actuatorA, actuatorB) };
}

export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, cadence = cadenceOf(input), reach = clamp(input?.reach, 0, 1, DEFAULT_INPUTS.reach);
  const phase = wrap(time * cadence), driveAngle = phase * TAU;
  const legs = [-1, 1].flatMap(side => [0, 1].map(i => supportAt(side, i, phase)));
  const arms = [-1, 1].map(side => armAt(side, driveAngle, reach));
  const head = { position: [0, 1.71, -.345], yaw: .24 * Math.sin(driveAngle), pitch: .065 * Math.sin(driveAngle + .5), eyes: [-1, 1].map(side => ({ yaw: -side * .10 + .14 * Math.sin(driveAngle + .7), pitch: -.08 + .055 * Math.cos(driveAngle) })) };
  const wings = [-1, 1].map(side => ({ side, angle: side * (.67 + .045 * Math.sin(driveAngle + .4)) }));
  return { t: time, phase, driveAngle, legs, arms, head, wings,
    metrics: { crankRpm: cadence * 60, cycleSeconds: 1 / cadence, supportPads: legs.filter(l => l.stance).length, graspAperture: arms[0].opening, couplerLength: DIM.coupler, headYaw: head.yaw, footLift: .09 } };
}
