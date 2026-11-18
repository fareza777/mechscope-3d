// Metres, seconds, radians. A six-axis industrial robot cell study: the arm
// links, wrist, parallel gripper and conveyor rollers are rigid. Payload,
// servo dynamics, collisions and cycle-time optimisation are not solved.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.4, slew: 0, shoulder: 35, elbow: 65, grip: 0.35 });
export const D = Object.freeze({
  baseY: 0.62, shoulderY: 0.72, upper: 0.85, forearm: 0.78, wrist: 0.22, tool: 0.16,
  wristBend: 0.55, fingerMin: 0.035, fingerMax: 0.100, fingerLength: 0.16,
  conveyorZ: 1.38, conveyorY: 0.62, workX: 0.42,
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const wrap = value => ((value % 1) + 1) % 1;
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.10, 0.60, DEFAULT_INPUTS.cadence),
    slew: clamp(input?.slew, -70, 70, DEFAULT_INPUTS.slew),
    shoulder: clamp(input?.shoulder, 10, 60, DEFAULT_INPUTS.shoulder),
    elbow: clamp(input?.elbow, 20, 100, DEFAULT_INPUTS.elbow),
    grip: clamp(input?.grip, 0, 1, DEFAULT_INPUTS.grip),
  };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => wrap(((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz);
const dir = angle => [0, Math.sin(angle), Math.cos(angle)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const length = a => Math.hypot(a[0], a[1], a[2]);
export const distance = (a, b) => length([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input), phase = wrap(a / TAU);
  const shoulder = controls.shoulder * Math.PI / 180;
  const elbow = controls.elbow * Math.PI / 180;
  const forearm = shoulder - elbow;
  const wrist = forearm - D.wristBend;
  const shoulderPoint = [0, D.shoulderY, 0];
  const elbowPoint = add(shoulderPoint, mul(dir(shoulder), D.upper));
  const wristPoint = add(elbowPoint, mul(dir(forearm), D.forearm));
  const flangePoint = add(wristPoint, mul(dir(wrist), D.wrist));
  const toolTip = add(flangePoint, mul(dir(wrist), D.tool));
  const spread = D.fingerMin + (D.fingerMax - D.fingerMin) * controls.grip;
  const anchor = [0, .82, -.18];
  const upperAnchor = add(shoulderPoint, mul(dir(shoulder), .40));
  const residual = Math.max(
    Math.abs(distance(shoulderPoint, elbowPoint) - D.upper),
    Math.abs(distance(elbowPoint, wristPoint) - D.forearm),
    Math.abs(distance(wristPoint, flangePoint) - D.wrist),
    Math.abs(distance(flangePoint, toolTip) - D.tool),
  );
  return {
    driveAngle: a, phase, controls,
    arm: { slew: controls.slew * Math.PI / 180, shoulder, elbow, forearm, wrist, shoulderPoint, elbowPoint, wristPoint, flangePoint, toolTip },
    gripper: { spread, direction: dir(wrist), centre: flangePoint, tip: toolTip, jawGapMm: spread * 2000 },
    counterbalance: { anchor, upperAnchor, mid: add(anchor, mul([upperAnchor[0] - anchor[0], upperAnchor[1] - anchor[1], upperAnchor[2] - anchor[2]], .55)) },
    drive: { rollerAngle: TAU * wrap(phase * 3), beaconAngle: TAU * wrap(phase * 2), fanAngle: TAU * wrap(phase * 6), belt: wrap(phase) },
    conveyor: { z: D.conveyorZ, y: D.conveyorY, workX: D.workX },
    metrics: {
      cadenceHz: controls.cadence, slewDeg: controls.slew, shoulderDeg: controls.shoulder, elbowDeg: controls.elbow,
      gripMm: Math.round(spread * 2000), reachMm: Math.round(Math.hypot(toolTip[0], toolTip[1] - D.baseY, toolTip[2]) * 1000),
      toolHeightMm: Math.round(toolTip[1] * 1000), axes: 6, linkResidualMm: residual * 1000,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
