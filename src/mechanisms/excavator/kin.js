// Metres, seconds, radians. A hydraulic excavator study: the boom, stick,
// bucket lever and four-bar rocker are exact rigid links. Hydraulic force,
// soil, stability and track slip are not solved.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.18, slew: 0, boom: 42, stick: 95, bucket: 45 });
export const D = Object.freeze({
  trackX: 0.64, trackY: 0.39, trackHalf: 0.86, trackRadius: 0.315, shoeCount: 16,
  houseY: 0.92, boomPivot: Object.freeze([0, 1.09, 0.36]), boomLength: 1.24, stickLength: 1.01,
  bucketLength: 0.46, rockerLength: 0.32, linkLength: 0.38, leverLength: 0.24,
  bladeZ: 1.42, bladeY: 0.21,
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const wrap = value => ((value % 1) + 1) % 1;
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.08, 0.35, DEFAULT_INPUTS.cadence),
    slew: clamp(input?.slew, -35, 35, DEFAULT_INPUTS.slew),
    boom: clamp(input?.boom, 20, 55, DEFAULT_INPUTS.boom),
    stick: clamp(input?.stick, 40, 110, DEFAULT_INPUTS.stick),
    bucket: clamp(input?.bucket, 15, 75, DEFAULT_INPUTS.bucket),
  };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => wrap(((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz);
const dir = angle => [0, Math.sin(angle), Math.cos(angle)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const length = a => Math.hypot(a[0], a[1], a[2]);
export const distance = (a, b) => length(sub(a, b));

// A complete dig/swing/dump/return duty cycle. Controls bias the automatic
// envelopes rather than locking the arm to one pose.
const DUTY_KEYS = Object.freeze([
  { p: 0.00, yaw: -6, boom: -9, stick: -26, bucket: -26 },
  { p: 0.18, yaw: -12, boom: -10, stick: 4, bucket: 16 },
  { p: 0.34, yaw: 4, boom: 6, stick: 8, bucket: 22 },
  { p: 0.52, yaw: 26, boom: 9, stick: 5, bucket: 18 },
  { p: 0.66, yaw: 30, boom: 7, stick: -10, bucket: -24 },
  { p: 0.82, yaw: 12, boom: 1, stick: -22, bucket: -26 },
  { p: 0.92, yaw: -2, boom: -7, stick: -25, bucket: -26 },
  { p: 1.00, yaw: -6, boom: -9, stick: -26, bucket: -26 },
]);
const smooth = t => t * t * (3 - 2 * t);
export function workCycle(phase = 0) {
  const p = wrap(Number.isFinite(phase) ? phase : 0);
  let a = DUTY_KEYS[0], b = DUTY_KEYS[DUTY_KEYS.length - 1];
  for (let i = 1; i < DUTY_KEYS.length; i++) {
    if (p <= DUTY_KEYS[i].p) { a = DUTY_KEYS[i - 1]; b = DUTY_KEYS[i]; break; }
  }
  const t = smooth(Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p))));
  const at = key => a[key] + (b[key] - a[key]) * t;
  return { phase: p, yaw: at('yaw'), boom: at('boom'), stick: at('stick'), bucket: at('bucket') };
}

// Circle intersection in the z/y plane. Branches are ordered upper first.
export function pairSolution(centreA, radiusA, centreB, radiusB, upper = true) {
  const dz = centreB[0] - centreA[0], dy = centreB[1] - centreA[1], d = Math.hypot(dz, dy);
  const along = (radiusA * radiusA - radiusB * radiusB + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, radiusA * radiusA - along * along));
  const mz = centreA[0] + along * dz / d, my = centreA[1] + along * dy / d;
  const pz = -dy / d, py = dz / d;
  const candidates = [[mz + height * pz, my + height * py], [mz - height * pz, my - height * py]];
  candidates.sort((a, b) => b[1] - a[1]);
  return upper ? candidates[0] : candidates[1];
}

// Stadium track path around two sprocket centres. u = 0 is the centre of the
// bottom run; the tangent follows the belt direction.
export function trackPose(u = 0) {
  const q = wrap(Number.isFinite(u) ? u : 0), L = D.trackHalf, R = D.trackRadius;
  const bottom = 2 * L, arc = Math.PI * R, top = 2 * bottom + 2 * arc;
  let d = q * top, z, y, tangent;
  if (d < bottom) { z = -L + d; y = -R; tangent = [0, 0, 1]; }
  else if (d < bottom + arc) {
    const a = -Math.PI / 2 + (d - bottom) / R;
    z = L + R * Math.cos(a); y = R * Math.sin(a); tangent = [0, Math.cos(a), -Math.sin(a)];
  } else if (d < 2 * bottom + arc) {
    d -= bottom + arc; z = L - d; y = R; tangent = [0, 0, -1];
  } else {
    d -= 2 * bottom + arc;
    const a = Math.PI / 2 + d / R;
    z = -L + R * Math.cos(a); y = R * Math.sin(a); tangent = [0, Math.cos(a), -Math.sin(a)];
  }
  return { u: q, z, y, tangent, angle: Math.atan2(tangent[1], tangent[2]) };
}

export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input), phase = wrap(a / TAU);
  const duty = workCycle(phase);
  const yaw = clamp(controls.slew + duty.yaw, -50, 50);
  const boomDeg = clamp(controls.boom + duty.boom, 18, 60);
  const foldDeg = clamp(controls.stick + duty.stick, 36, 112);
  const bucketDeg = clamp(controls.bucket + duty.bucket, 10, 80);
  const boomAngle = boomDeg * Math.PI / 180;
  const stickAngle = boomAngle - foldDeg * Math.PI / 180;
  const bucketAngle = stickAngle - Math.PI / 2 - (bucketDeg - 45) * Math.PI / 360;
  const pivot = D.boomPivot, boomTip = add(pivot, mul(dir(boomAngle), D.boomLength));
  const stickTip = add(boomTip, mul(dir(stickAngle), D.stickLength));
  const bucketTip = add(stickTip, mul(dir(bucketAngle), D.bucketLength));
  // Four-bar bucket linkage: fixed rocker pivot on the stick, fixed lever on
  // the bucket and a constant-length link between them.
  const leverAngle = bucketAngle + 2.40;
  const leverPoint = add(stickTip, mul(dir(leverAngle), D.leverLength));
  const rockerPivot = sub(stickTip, mul(dir(stickAngle), D.rockerLength));
  const solved = pairSolution([rockerPivot[2], rockerPivot[1]], D.rockerLength, [leverPoint[2], leverPoint[1]], D.linkLength, true);
  const rockerEnd = [0, solved[1], solved[0]];
  const anchor = add(sub(stickTip, mul(dir(stickAngle), .58)), mul([0, Math.cos(stickAngle), -Math.sin(stickAngle)], .13));
  const boomAnchor = add([0, 1.00, .10], [0, 0, 0]);
  const boomBracket = add(add(pivot, mul(dir(boomAngle), D.boomLength * .46)), mul([0, Math.cos(boomAngle), -Math.sin(boomAngle)], .16));
  const stickAnchor = add(add(pivot, mul(dir(boomAngle), D.boomLength * .74)), mul([0, Math.cos(boomAngle), -Math.sin(boomAngle)], .17));
  const stickBracket = add(add(boomTip, mul(dir(stickAngle), .24)), mul([0, Math.cos(stickAngle), -Math.sin(stickAngle)], .12));
  const cylinders = [
    { id: 'boom', start: boomAnchor, end: boomBracket },
    { id: 'stick', start: stickAnchor, end: stickBracket },
    { id: 'bucket', start: anchor, end: rockerEnd },
  ].map(cylinder => ({ ...cylinder, mid: add(cylinder.start, mul(sub(cylinder.end, cylinder.start), .56)), length: distance(cylinder.start, cylinder.end) }));
  const residual = Math.max(
    Math.abs(distance(pivot, boomTip) - D.boomLength),
    Math.abs(distance(boomTip, stickTip) - D.stickLength),
    Math.abs(distance(stickTip, bucketTip) - D.bucketLength),
    Math.abs(distance(stickTip, leverPoint) - D.leverLength),
    Math.abs(distance(rockerPivot, rockerEnd) - D.rockerLength),
    Math.abs(distance(rockerEnd, leverPoint) - D.linkLength),
  );
  return {
    driveAngle: a, phase, controls, duty,
    house: { yaw: yaw * Math.PI / 180, slewDeg: yaw },
    boom: { pivot, tip: boomTip, angle: boomAngle, deg: boomDeg },
    stick: { start: boomTip, end: stickTip, angle: stickAngle, foldDeg },
    bucket: { pivot: stickTip, tip: bucketTip, angle: bucketAngle, deg: bucketDeg, lever: leverPoint, rockerPivot, rockerEnd, anchor },
    cylinders, tracks: { travel: phase, shoeCount: D.shoeCount },
    blade: { centre: [0, D.bladeY, D.bladeZ], width: 1.34 },
    metrics: {
      cadenceHz: controls.cadence, slewDeg: yaw, boomDeg, stickDeg: foldDeg, bucketDeg,
      boomTrimDeg: controls.boom, stickTrimDeg: controls.stick, bucketTrimDeg: controls.bucket,
      boomMm: Math.round(D.boomLength * 1000), stickMm: Math.round(D.stickLength * 1000),
      reachMm: Math.round(Math.hypot(bucketTip[0], bucketTip[1] - .3, bucketTip[2]) * 1000),
      bucketTipMm: Math.round(Math.hypot(bucketTip[0], bucketTip[1], bucketTip[2]) * 1000),
      linkResidualMm: residual * 1000, contacts: 2,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
