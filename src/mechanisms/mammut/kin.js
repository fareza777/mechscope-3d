// Metres, seconds, radians. A kinematic mammoth study: rigid links and trunk
// pins are exact; ground contact, muscle force and balance are not solved.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.3, stride: 0.18, curl: 12, ear: 10 });
export const D = Object.freeze({
  bodyY: 1.00, hipX: 0.36, hipY: 0, hipFront: -0.5, hipRear: 0.5,
  femur: 0.48, tibia: 0.48, ankleLift: Object.freeze([0, 0.1344, 0.0392]),
  footX: 0.46, footFront: -0.58, footRear: 0.58, footY: 0.06, stanceFraction: 0.68,
  spineLink: 0.16, spineCount: 8, spineZ: 0.62, spineY: 0.25,
  headOrigin: Object.freeze([0, 0.42, -0.86]),
  trunkBase: Object.freeze([0, 0.37, -0.98]), trunkLink: 0.085, trunkCount: 14,
  tailBase: Object.freeze([0, 0.30, 0.76]), tailLink: 0.13, tailCount: 7,
  earPivot: Object.freeze([0.18, 0.44, -0.74]),
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.12, 0.7, DEFAULT_INPUTS.cadence),
    stride: clamp(input?.stride, 0.08, 0.26, DEFAULT_INPUTS.stride),
    curl: clamp(input?.curl, 0, 35, DEFAULT_INPUTS.curl),
    ear: clamp(input?.ear, 0, 35, DEFAULT_INPUTS.ear),
  };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => (((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz % 1 + 1) % 1;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = a => Math.hypot(a[0], a[1], a[2]);
const unit = a => { const l = length(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 1, 0]; };
export const distance = (a, b) => length(sub(a, b));
// Foot trajectory uses its own lift so the call signature stays explicit.
export function footTarget(phase, stride = 0.18) {
  const q = ((Number.isFinite(phase) ? phase : 0) % 1 + 1) % 1;
  if (q < D.stanceFraction) {
    const u = q / D.stanceFraction;
    return { q, z: -stride * 0.5 + stride * u, y: D.footY, stance: true };
  }
  const u = (q - D.stanceFraction) / (1 - D.stanceFraction), ease = u * u * (3 - 2 * u);
  return { q, z: stride * 0.5 - stride * ease, y: D.footY + 0.10 * Math.sin(Math.PI * u), stance: false };
}
export function solveTwoLink(hip, ankle, upper = D.femur, lower = D.tibia, bend = [0, 0, -1]) {
  const delta = sub(ankle, hip), reach = clamp(length(delta), Math.abs(upper - lower) + 1e-7, upper + lower - 1e-7);
  const axis = unit(delta), hint = unit(sub(bend, mul(axis, dot(bend, axis))));
  const cosine = clamp((upper * upper + reach * reach - lower * lower) / (2 * upper * reach), -1, 1, 1);
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  const knee = add(hip, add(mul(axis, upper * cosine), mul(hint, upper * sine)));
  return { knee, ankle: add(hip, mul(axis, reach)), reach };
}
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input);
  const phase = ((a / TAU) % 1 + 1) % 1;
  const bob = 0.018 * Math.sin(2 * a), sway = 0.025 * Math.sin(a);
  const offset = [sway, D.bodyY + bob, 0];

  const legs = [];
  const layout = [
    { id: 'FL', side: -1, front: true, phase: 0 }, { id: 'FR', side: 1, front: true, phase: 0.5 },
    { id: 'RL', side: -1, front: false, phase: 0.25 }, { id: 'RR', side: 1, front: false, phase: 0.75 },
  ];
  for (const item of layout) {
    const p = (phase + item.phase) % 1, path = footTarget(p, controls.stride);
    const baseZ = item.front ? D.footFront : D.footRear;
    const foot = [item.side * D.footX, path.y, baseZ + path.z];
    const footLocal = sub(foot, offset);
    const ankle = add(footLocal, D.ankleLift);
    const hip = [item.side * D.hipX, D.hipY, item.front ? D.hipFront : D.hipRear];
    const solved = solveTwoLink(hip, ankle, D.femur, D.tibia, [item.side * 0.08, 0, item.front ? -1 : 1]);
    const kneeAngle = Math.acos(clamp((D.femur ** 2 + D.tibia ** 2 - distance(hip, ankle) ** 2) / (2 * D.femur * D.tibia), -1, 1, 1));
    legs.push({ id: item.id, side: item.side, front: item.front, phase: p, stance: path.stance, foot, footLocal, hip, knee: solved.knee, ankle, metatarsus: sub(footLocal, ankle), kneeAngle });
  }

  const head = { origin: D.headOrigin, pitch: -0.04 + 0.025 * Math.sin(2 * a), yaw: 0.06 * Math.sin(a + 0.5) };
  const curl = controls.curl * Math.PI / 180;
  const trunk = [], trunkPoints = [D.trunkBase];
  for (let i = 0; i < D.trunkCount; i++) {
    const below = 0.28 + i * 0.052 + curl * (0.3 + i / D.trunkCount) + 0.05 * Math.sin(a - i * 0.38);
    const side = 0.035 * Math.sin(a - i * 0.33) * (i / D.trunkCount);
    const direction = unit([side, -Math.sin(below), -Math.cos(below)]);
    const start = trunkPoints[i], end = add(start, mul(direction, D.trunkLink));
    trunk.push({ index: i, start, end, below, direction });
    trunkPoints.push(end);
  }
  const tail = [], tailPoints = [D.tailBase];
  for (let i = 0; i < D.tailCount; i++) {
    const pitch = 0.22 + i * 0.06 + 0.05 * Math.sin(a - i * 0.5);
    const side = 0.08 * Math.sin(a - i * 0.45);
    const direction = unit([side, -Math.sin(pitch), Math.cos(pitch)]);
    const start = tailPoints[i], end = add(start, mul(direction, D.tailLink));
    tail.push({ index: i, start, end, pitch });
    tailPoints.push(end);
  }
  const residual = Math.max(
    ...legs.map(leg => Math.max(Math.abs(distance(leg.hip, leg.knee) - D.femur), Math.abs(distance(leg.knee, leg.ankle) - D.tibia), Math.abs(distance(leg.ankle, leg.footLocal) - Math.hypot(...D.ankleLift)))),
    ...trunk.map(link => Math.abs(distance(link.start, link.end) - D.trunkLink)),
    ...tail.map(link => Math.abs(distance(link.start, link.end) - D.tailLink)),
  );
  return {
    driveAngle: a, phase, controls, body: { offset, bob, sway }, legs, head, trunk: { links: trunk, points: trunkPoints }, tail: { links: tail, points: tailPoints },
    ears: { flare: controls.ear * Math.PI / 180, pitch: 0.08 * Math.sin(a + 0.3) },
    metrics: {
      cadenceHz: controls.cadence, strideMm: controls.stride * 1000, curlDeg: controls.curl, earDeg: controls.ear,
      trunkMm: D.trunkCount * D.trunkLink * 1000, contacts: legs.filter(leg => leg.stance).length,
      kneeFlexDeg: legs.reduce((sum, leg) => sum + leg.kneeAngle * 180 / Math.PI, 0) / 4, linkResidualMm: residual * 1000,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
