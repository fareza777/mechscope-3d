// Metres, seconds, radians. A kinematic exoskeleton study, not a dynamics
// solver: link lengths, foot targets and joint poses are exact by construction;
// hydraulic pressure, contact forces and balance are not computed.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.42, stride: 0.24, lift: 0.12, grip: 24 });
export const D = Object.freeze({
  pelvisY: 0.98,
  hipX: 0.17, hipY: -0.02,
  thigh: 0.45, shin: 0.47,
  // Exactly 140 mm from ankle pin to sole pin: 134.4² + 39.2² = 140² mm².
  ankleLift: Object.freeze([0, 0.1344, 0.0392]),
  footX: 0.20, footY: 0.06, stanceFraction: 0.62,
  shoulderX: 0.355, shoulderY: 0.50,
  upperArm: 0.36, forearm: 0.34,
  torsoLift: 0.12, torsoYaw: 0.045,
  neckBase: Object.freeze([0, 0.58, -0.02]), neckLink: 0.10, neckCount: 4,
  palmY: -0.105, knuckleY: -0.160, handReach: 0.11,
  fingerLengths: Object.freeze([[0.062, 0.054], [0.070, 0.058], [0.066, 0.052], [0.058, 0.046], [0.050, 0.040]]),
  fingerX: Object.freeze([-0.048, -0.024, 0, 0.024, 0.048]),
});
const clamp = (value, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(value) ? value : fallback));
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.15, 0.9, DEFAULT_INPUTS.cadence),
    stride: clamp(input?.stride, 0.12, 0.36, DEFAULT_INPUTS.stride),
    lift: clamp(input?.lift, 0.05, 0.20, DEFAULT_INPUTS.lift),
    grip: clamp(input?.grip, 0, 55, DEFAULT_INPUTS.grip),
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
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const distance = (a, b) => length(sub(a, b));

// Closed foot trajectory: a planted stance that travels backward, then a
// smooth swing that returns forward with a prescribed clearance. The target is
// the foot pin; the ankle pin is a fixed 140 mm above and behind it.
export function footPath(phase, input = {}) {
  const { stride, lift } = inputsOf(input);
  const q = ((Number.isFinite(phase) ? phase : 0) % 1 + 1) % 1;
  if (q < D.stanceFraction) {
    const u = q / D.stanceFraction;
    return { q, z: -stride * 0.5 + stride * u, y: D.footY, stance: true, swing: 0 };
  }
  const u = (q - D.stanceFraction) / (1 - D.stanceFraction);
  const ease = u * u * (3 - 2 * u);
  return { q, z: stride * 0.5 - stride * ease, y: D.footY + lift * Math.sin(Math.PI * u), stance: false, swing: u };
}

// Planar three-dimensional two-link solution. The knee is placed on the
// requested side of the hip-to-ankle line; both segments keep exact lengths.
export function solveTwoLink(hip, ankle, upper = D.thigh, lower = D.shin, bend = [0, 0, -1]) {
  const delta = sub(ankle, hip);
  const reach = clamp(length(delta), Math.abs(upper - lower) + 1e-7, upper + lower - 1e-7);
  const axis = unit(delta);
  const hint = unit(sub(bend, mul(axis, dot(bend, axis))));
  const cosine = clamp((upper * upper + reach * reach - lower * lower) / (2 * upper * reach), -1, 1, 1);
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  const knee = add(hip, add(mul(axis, upper * cosine), mul(hint, upper * sine)));
  const end = add(hip, mul(axis, reach));
  return { knee, ankle: end, reach };
}

function limbBasis(dir) {
  const y = unit(mul(dir, -1));
  const forward = [0, 0, -1];
  const z = unit(sub(forward, mul(y, dot(forward, y))));
  const x = unit(cross(y, z));
  const zz = cross(x, y);
  return { x, y, z: zz };
}

const neckPoint = (start, theta) => add(start, mul([0, Math.sin(theta), -Math.cos(theta)], D.neckLink));

export function poseAt(driveAngle = 0, input = DEFAULT_INPUTS) {
  const angle = Number.isFinite(driveAngle) ? driveAngle : 0;
  const controls = inputsOf(input);
  const phase = ((angle / TAU) % 1 + 1) % 1;
  const bob = 0.016 * Math.sin(2 * angle);
  const sway = 0.028 * Math.sin(angle);
  const offset = [sway, D.pelvisY + bob, 0];
  const torsoYaw = D.torsoYaw * Math.sin(angle);
  const breath = Math.sin(2 * angle);
  const secondary = {
    breath,
    shift: Math.sin(angle + 0.35),
    hipRoll: Math.sin(angle + 0.20),
    shoulderRoll: Math.sin(angle + 1.15) * 0.5 + Math.sin(3 * angle + 0.4) * 0.5,
    vent: 0.5 + 0.5 * Math.sin(2 * angle + 0.35),
    radiator: 0.5 + 0.5 * Math.sin(2 * angle + 0.95),
    tether: 0.5 + 0.5 * Math.sin(3 * angle + 1.10),
    scan: Math.sin(3 * angle + 0.65),
    handPulse: 0.5 + 0.5 * Math.sin(2 * angle + 0.50),
    gear: angle,
  };

  const legs = [];
  for (const side of [-1, 1]) {
    const legPhase = (phase + (side < 0 ? 0 : 0.5)) % 1;
    const path = footPath(legPhase, controls);
    const foot = [side * D.footX, path.y, path.z];
    const footLocal = sub(foot, offset);
    const ankle = add(footLocal, D.ankleLift);
    const hip = [side * D.hipX, D.hipY, 0];
    const solved = solveTwoLink(hip, ankle, D.thigh, D.shin, [side * 0.12, 0, -1]);
    const kneeAngle = Math.acos(clamp((D.thigh ** 2 + D.shin ** 2 - distance(hip, ankle) ** 2) / (2 * D.thigh * D.shin), -1, 1, 1));
    legs.push({
      id: side < 0 ? 'L' : 'R', side, phase: legPhase, stance: path.stance, swing: path.swing,
      foot, footLocal, ankle, knee: solved.knee, hip, kneeAngle,
      metatarsus: sub(footLocal, ankle),
    });
  }

  const hands = [];
  for (const side of [-1, 1]) {
    const shoulder = [side * D.shoulderX, D.shoulderY, 0];
    const armPhase = angle + (side < 0 ? 0 : Math.PI);
    const abduct = 0.17 + 0.035 * Math.sin(angle + (side < 0 ? 0.4 : 2.1));
    const swing = -0.30 * Math.cos(armPhase);
    const elbowFlex = 0.30 + 0.14 * Math.sin(2 * angle + 0.7);
    const wristFlex = 0.10 + 0.06 * Math.sin(2 * angle + 1.9);
    const direction = bend => unit([
      side * Math.sin(abduct),
      -Math.cos(abduct) * Math.cos(bend),
      -Math.cos(abduct) * Math.sin(bend),
    ]);
    const upperDir = direction(swing);
    const foreDir = direction(swing + elbowFlex);
    const handDir = direction(swing + elbowFlex + wristFlex);
    const elbow = add(shoulder, mul(upperDir, D.upperArm));
    const wrist = add(elbow, mul(foreDir, D.forearm));
    const fingers = D.fingerX.map((x, index) => {
      const thumb = index === 4;
      return {
        index, x, thumb,
        spread: (index - 1.5) * 0.045 + 0.02 * Math.sin(angle + index * 0.7),
        proximal: 0.14 + controls.grip * Math.PI / 180 * (thumb ? 0.42 : 0.56 + index * 0.035)
          + 0.085 * Math.sin(2 * angle + index * 0.8) + 0.028 * Math.sin(3 * angle + index * 0.37),
        distal: 0.12 + controls.grip * Math.PI / 180 * (thumb ? 0.34 : 0.46 + index * 0.030)
          + 0.070 * Math.sin(2 * angle + index * 0.8 + 0.6) + 0.022 * Math.sin(3 * angle + index * 0.37 + 0.9),
      };
    });
    hands.push({
      side, id: side < 0 ? 'L' : 'R', shoulder, elbow, wrist,
      upperDir, foreDir, handDir, basis: limbBasis(handDir),
      fingers, abduct, swing, elbowFlex, wristFlex,
    });
  }

  // Four-link neck: every vertebra keeps the same 100 mm pin spacing, and the
  // first link starts exactly at the chest socket (no hidden base segment).
  const neckBase = D.neckBase;
  const neckPoints = [neckBase];
  const neckLinks = [];
  for (let i = 0; i < D.neckCount; i++) {
    const theta = 0.92 - i * 0.085 + 0.035 * Math.sin(2 * angle - i * 0.45);
    const start = neckPoints[i];
    const end = neckPoint(start, theta);
    neckLinks.push({ index: i, start, end, theta });
    neckPoints.push(end);
  }
  const headOrigin = neckPoints[D.neckCount];
  const head = {
    origin: headOrigin,
    pitch: -0.05 + 0.02 * Math.sin(2 * angle + 0.4),
    yaw: 0.20 * Math.sin(angle + 0.9),
    jaw: 0.045 + 0.055 * Math.sin(2 * angle + 1.1),
  };

  const residual = Math.max(
    ...legs.map(leg => Math.max(
      Math.abs(distance(leg.hip, leg.knee) - D.thigh),
      Math.abs(distance(leg.knee, leg.ankle) - D.shin),
      Math.abs(distance(leg.ankle, leg.footLocal) - length(D.ankleLift)),
    )),
    ...hands.map(hand => Math.max(
      Math.abs(distance(hand.shoulder, hand.elbow) - D.upperArm),
      Math.abs(distance(hand.elbow, hand.wrist) - D.forearm),
    )),
    ...neckLinks.map(link => Math.abs(distance(link.start, link.end) - D.neckLink)),
  );

  return {
    driveAngle: angle, phase, controls, secondary,
    body: { offset, bob, sway },
    torso: {
      yaw: torsoYaw,
      pitch: 0.008 * Math.sin(2 * angle + 0.70),
      roll: 0.010 * Math.sin(angle + 0.35),
    },
    legs, hands, neck: { links: neckLinks, points: neckPoints }, head,
    metrics: {
      cadenceHz: controls.cadence,
      strideMm: controls.stride * 1000,
      liftMm: controls.lift * 1000,
      gripDeg: controls.grip,
      kneeFlexDeg: legs.reduce((sum, leg) => sum + leg.kneeAngle * 180 / Math.PI, 0) / legs.length,
      armSwingDeg: hands[0].swing * 180 / Math.PI,
      contacts: legs.filter(leg => leg.stance).length,
      linkResidualMm: residual * 1000,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const safeTime = Number.isFinite(t) ? t : 0;
  const phase = phaseOf(safeTime, cycleHz(input));
  return { t: safeTime, phase, ...poseAt(phase * TAU, input) };
}
