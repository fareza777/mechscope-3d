// Metres, seconds, radians. An autonomous six-axis pick-and-place cell: the
// arm links, wrist, parallel gripper and conveyor rollers are rigid, and the
// controls modify a transfer cycle that picks from the conveyor, places on a
// positioner and returns. Payload, servo dynamics, collisions and cycle-time
// optimisation are not solved.
export const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.4, slew: 0, shoulder: 35, elbow: 65, grip: 0.35 });
export const D = Object.freeze({
  baseY: 0.62, shoulderY: 0.72, upper: 0.85, forearm: 0.78, wrist: 0.22, tool: 0.16,
  wristBend: 0.55, fingerMin: 0.035, fingerMax: 0.100, fingerLength: 0.16,
  conveyorZ: 1.25, conveyorY: 0.62, workX: 0.72, hold: 0.30,
  stationY: 0.75,
  stationA: Object.freeze({ x: -0.98, z: 0.52 }),
  stationB: Object.freeze({ x: -0.45, z: 1.25 }),
  stationC: Object.freeze({ x: 0.72, z: 1.25 }),
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
const smooth = t => t * t * (3 - 2 * t);
function keyed(phase, keys) {
  for (let i = 0; i < keys.length - 1; i++) {
    const [p0, v0] = keys[i], [p1, v1] = keys[i + 1];
    if (phase >= p0 && phase <= p1) return v0 + (v1 - v0) * smooth((phase - p0) / Math.max(1e-9, p1 - p0));
  }
  return keys[keys.length - 1][1];
}
// Close the wrist chain on a target in the arm plane. The jaw centre is
// D.wrist + D.hold below the wrist point when the tool hangs vertically.
function solveArm(radial, y) {
  const wristY = y + D.wrist + D.hold, dx = radial, dy = wristY - D.shoulderY;
  const d = Math.min(D.upper + D.forearm - 1e-3, Math.max(Math.abs(D.upper - D.forearm) + 1e-4, Math.hypot(dx, dy)));
  const line = Math.atan2(dy, dx);
  const alpha = Math.acos(clamp((D.upper ** 2 + d ** 2 - D.forearm ** 2) / (2 * D.upper * d), -1, 1));
  const beta = Math.acos(clamp((D.upper ** 2 + D.forearm ** 2 - d ** 2) / (2 * D.upper * D.forearm), -1, 1));
  const shoulder = line + alpha, elbow = Math.PI - beta, forearm = shoulder - elbow;
  return { shoulder, elbow, wristBend: forearm + Math.PI / 2 };
}
const station = (name, point) => ({ name, x: point.x, z: point.z, radial: Math.hypot(point.x, point.z), yaw: Math.atan2(point.x, point.z) });
export const STATIONS = Object.freeze({
  A: station('positioner', D.stationA), B: station('belt drop', D.stationB), C: station('belt pick', D.stationC),
});
const lowA = solveArm(STATIONS.A.radial, D.stationY), lowB = solveArm(STATIONS.B.radial, D.stationY), lowC = solveArm(STATIONS.C.radial, D.stationY);
const armKeys = [
  [0, { yaw: STATIONS.A.yaw, shoulder: 62 * DEG, elbow: 66 * DEG, wristBend: 70 * DEG }],
  [.04, { yaw: STATIONS.A.yaw, ...lowA }],
  [.10, { yaw: STATIONS.A.yaw, ...lowA }],
  [.15, { yaw: STATIONS.A.yaw, shoulder: 62 * DEG, elbow: 66 * DEG, wristBend: 70 * DEG }],
  [.21, { yaw: STATIONS.B.yaw, shoulder: 50 * DEG, elbow: 40 * DEG, wristBend: 75 * DEG }],
  [.25, { yaw: STATIONS.B.yaw, ...lowB }],
  [.31, { yaw: STATIONS.B.yaw, ...lowB }],
  [.40, { yaw: STATIONS.B.yaw, shoulder: 50 * DEG, elbow: 40 * DEG, wristBend: 75 * DEG }],
  [.47, { yaw: STATIONS.C.yaw, shoulder: 34 * DEG, elbow: 12 * DEG, wristBend: 80 * DEG }],
  [.52, { yaw: STATIONS.C.yaw, ...lowC }],
  [.58, { yaw: STATIONS.C.yaw, ...lowC }],
  [.64, { yaw: STATIONS.C.yaw, shoulder: 34 * DEG, elbow: 12 * DEG, wristBend: 80 * DEG }],
  [.77, { yaw: STATIONS.A.yaw, shoulder: 62 * DEG, elbow: 66 * DEG, wristBend: 70 * DEG }],
  [.82, { yaw: STATIONS.A.yaw, ...lowA }],
  [.86, { yaw: STATIONS.A.yaw, ...lowA }],
  [.93, { yaw: STATIONS.A.yaw, shoulder: 62 * DEG, elbow: 66 * DEG, wristBend: 70 * DEG }],
  [1, { yaw: STATIONS.A.yaw, shoulder: 62 * DEG, elbow: 66 * DEG, wristBend: 70 * DEG }],
];
const jawKeys = [[0, 1], [.03, 1], [.06, 0], [.23, 0], [.27, 1], [.50, 1], [.54, 0], [.80, 0], [.84, 1], [1, 1]];
function armKeyAt(phase) {
  for (let i = 0; i < armKeys.length - 1; i++) {
    const [p0, a] = armKeys[i], [p1, b] = armKeys[i + 1];
    if (phase >= p0 && phase <= p1) {
      const t = smooth((phase - p0) / Math.max(1e-9, p1 - p0));
      const mix = key => a[key] + (b[key] - a[key]) * t;
      return { yaw: mix('yaw'), shoulder: mix('shoulder'), elbow: mix('elbow'), wristBend: mix('wristBend') };
    }
  }
  const end = armKeys[armKeys.length - 1][1];
  return { yaw: end.yaw, shoulder: end.shoulder, elbow: end.elbow, wristBend: end.wristBend };
}
const beltPoint = (x, z) => [x, D.stationY, z];
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input), phase = wrap(a / TAU), p = phase * TAU;
  const key = armKeyAt(phase);
  // Controls are bounded modifiers on top of the autonomous transfer cycle.
  const yaw = key.yaw + controls.slew * DEG;
  const shoulder = key.shoulder + (controls.shoulder - 35) * DEG * .9;
  const elbow = key.elbow + (controls.elbow - 65) * DEG * .7;
  const forearm = shoulder - elbow;
  const wrist = forearm - key.wristBend;
  const wristRoll = .42 * Math.sin(3 * p + .35);
  const toolRoll = .35 * Math.sin(2 * p + 1.1);
  const shoulderPoint = [0, D.shoulderY, 0];
  const elbowPoint = add(shoulderPoint, mul(dir(shoulder), D.upper));
  const wristPoint = add(elbowPoint, mul(dir(forearm), D.forearm));
  const flangePoint = add(wristPoint, mul(dir(wrist), D.wrist));
  const toolTip = add(flangePoint, mul(dir(wrist), D.tool));
  const holdPlane = add(flangePoint, mul(dir(wrist), D.hold));
  const world = point => [point[2] * Math.sin(yaw), point[1], point[2] * Math.cos(yaw)];
  const hold = world(holdPlane);
  const spread = D.fingerMin + (D.fingerMax - D.fingerMin) * controls.grip;
  const jawOpen = keyed(phase, jawKeys);
  const actualSpread = D.fingerMin + (D.fingerMax - D.fingerMin) * controls.grip * (.45 + .55 * jawOpen);
  const anchor = [0, .82, -.18];
  const upperAnchor = add(shoulderPoint, mul(dir(shoulder), .40));
  const residual = Math.max(
    Math.abs(distance(shoulderPoint, elbowPoint) - D.upper),
    Math.abs(distance(elbowPoint, wristPoint) - D.forearm),
    Math.abs(distance(wristPoint, flangePoint) - D.wrist),
    Math.abs(distance(flangePoint, toolTip) - D.tool),
  );
  const positionerAngle = .22 * Math.sin(4 * p + .4);
  const auxAngle = .18 * Math.sin(3 * p + 1.2);
  let workpiece;
  const wp = (point, station, held, yaw) => ({ position: [point[0], point[1], point[2]], station, held, yaw });
  if (phase < .06) workpiece = wp(beltPoint(STATIONS.A.x, STATIONS.A.z), 'A', false, positionerAngle);
  else if (phase < .25) workpiece = wp(hold, 'carry', true, yaw);
  else if (phase < .30) workpiece = wp(beltPoint(STATIONS.B.x, STATIONS.B.z), 'B', false, 0);
  else if (phase < .52) {
    const t = (phase - .30) / .22;
    workpiece = wp(beltPoint(STATIONS.B.x + (STATIONS.C.x - STATIONS.B.x) * t, STATIONS.B.z), 'belt', false, 0);
  } else if (phase < .54) workpiece = wp(beltPoint(STATIONS.C.x, STATIONS.C.z), 'C', false, 0);
  else if (phase < .84) workpiece = wp(hold, 'carry', true, yaw);
  else workpiece = wp(beltPoint(STATIONS.A.x, STATIONS.A.z), 'A', false, positionerAngle);
  return {
    driveAngle: a, phase, controls,
    arm: {
      yaw, slew: controls.slew * DEG, shoulder, elbow, forearm, wrist, wristBend: key.wristBend,
      wristRoll, toolRoll, shoulderPoint, elbowPoint, wristPoint, flangePoint, toolTip,
    },
    gripper: {
      spread, actualSpread, jawOpen, direction: dir(wrist), centre: flangePoint, hold, tip: toolTip,
      jawGapMm: actualSpread * 2000, commandedGapMm: spread * 2000,
    },
    counterbalance: { anchor, upperAnchor, mid: add(anchor, mul([upperAnchor[0] - anchor[0], upperAnchor[1] - anchor[1], upperAnchor[2] - anchor[2]], .55)) },
    workpiece,
    stations: STATIONS,
    positioner: { angle: positionerAngle, auxAngle },
    safety: { gate: .16 + .22 * Math.sin(p + 1.1), scanner: .75 * Math.sin(3 * p + .2), curtain: .5 - .5 * Math.cos(2 * p + .6) },
    drive: {
      rollerAngle: TAU * phase * 6, beaconAngle: TAU * wrap(phase * 2), fanAngle: TAU * phase * 6,
      belt: phase * 1.28, sprocketAngle: TAU * phase * 6, spindleAngle: TAU * phase * 9,
    },
    conveyor: { ...STATIONS.B, z: D.conveyorZ, y: D.conveyorY, workX: D.workX, yaw: 0 },
    metrics: {
      cadenceHz: controls.cadence, slewDeg: controls.slew, shoulderDeg: controls.shoulder, elbowDeg: controls.elbow,
      gripMm: Math.round(actualSpread * 2000), commandedGripMm: Math.round(spread * 2000),
      reachMm: Math.round(Math.hypot(toolTip[0], toolTip[1] - D.baseY, toolTip[2]) * 1000),
      toolHeightMm: Math.round(toolTip[1] * 1000), axes: 6, linkResidualMm: residual * 1000,
      jawCycle: jawOpen,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
