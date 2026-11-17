// Designed rigid-chain demonstrator in metres and radians. The traveling joint
// command is kinematic: there is no fluid solver or biological efficiency claim.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.45, amplitude: 16 });
export const F = Object.freeze({
  lengths: Object.freeze([0.24, 0.24, 0.23, 0.22, 0.20, 0.18, 0.16, 0.14]),
  widths: Object.freeze([0.24, 0.31, 0.30, 0.265, 0.215, 0.165, 0.112, 0.063]),
  heights: Object.freeze([0.30, 0.39, 0.38, 0.34, 0.28, 0.215, 0.145, 0.083]),
  root: Object.freeze([0, 1.05, -0.78]), phaseLag: TAU / 8,
  tendonOffset: 0.052, gillOrigin: Object.freeze([0.06, 0.10, 0]),
  gillCrank: 0.014, gillRod: 0.105, gillRocker: 0.06,
  // A 15 mm rear bush half-width clears the rocker's 27.5 mm retainer
  // by 2.5 mm with both conrod eyes in this common axial plane.
  gillRodZ: 0.045,
});
const clamp = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : d));
export function inputsOf(input = {}) {
  return { cadence: clamp(input?.cadence, 0.12, 1.1, DEFAULT_INPUTS.cadence), amplitude: clamp(input?.amplitude, 6, 22, DEFAULT_INPUTS.amplitude) };
}
export const cycleHz = input => inputsOf(input).cadence;
const d = Math.hypot(...F.gillOrigin);
export const GILL_DATUM = Math.atan2(F.gillOrigin[1], F.gillOrigin[0]) - Math.acos((F.gillRocker ** 2 + d ** 2 - F.gillRod ** 2) / (2 * F.gillRocker * d)) + 0.25;
export function solveGill(angle) {
  const crank = [F.gillOrigin[0] + F.gillCrank * Math.cos(angle), F.gillOrigin[1] + F.gillCrank * Math.sin(angle), 0];
  const r = Math.hypot(...crank);
  const beta = Math.atan2(crank[1], crank[0]) - Math.acos(clamp((F.gillRocker ** 2 + r ** 2 - F.gillRod ** 2) / (2 * F.gillRocker * r), -1, 1, 0));
  return { crank, rocker: [F.gillRocker * Math.cos(beta), F.gillRocker * Math.sin(beta), 0], angle: beta - GILL_DATUM };
}
export function transformPoint(origin, yaw, local) {
  return [origin[0] + local[0] * Math.cos(yaw) + local[2] * Math.sin(yaw), origin[1] + local[1], origin[2] - local[0] * Math.sin(yaw) + local[2] * Math.cos(yaw)];
}
export function caudalPoint(u) { return [0, 0.41 * u, 0.255 + 0.17 * Math.abs(u) ** 0.7]; }
export function pectoralPoint(u) { return [0.20 + 0.21 * Math.sin(Math.PI * u), -0.07 - 0.04 * Math.sin(Math.PI * u), -0.04 + 0.40 * u]; }
export function poseAt(driveAngle, input = {}) {
  const { cadence, amplitude } = inputsOf(input), angle = Number.isFinite(driveAngle) ? driveAngle : 0;
  const points = [[...F.root]], segments = [], velocities = [[0, 0, 0]];
  let yaw = 0, yawDerivative = 0;
  for (let i = 0; i < F.lengths.length; i++) {
    const gain = i === 0 ? 0 : 0.23 + 0.77 * (i / 7) ** 1.5;
    const a = amplitude * Math.PI / 180 * gain, phase = angle - i * F.phaseLag;
    const jointAngle = a * Math.sin(phase);
    yaw += jointAngle; yawDerivative += a * Math.cos(phase);
    const start = points[i], length = F.lengths[i];
    const end = transformPoint(start, yaw, [0, 0, length]);
    const v = velocities[i];
    const endVelocity = [v[0] + length * Math.cos(yaw) * yawDerivative * TAU * cadence, 0, v[2] - length * Math.sin(yaw) * yawDerivative * TAU * cadence];
    segments.push({ start, end, length, yaw, jointAngle, yawDerivative });
    points.push(end); velocities.push(endVelocity);
  }
  const tendons = [];
  segments.forEach((segment, i) => {
    const next = segments[i + 1];
    for (const side of [-1, 1]) {
      const local = [side * F.tendonOffset, -0.025, 0.018];
      const a = transformPoint(segment.start, segment.yaw, local);
      const b = transformPoint(segment.end, next?.yaw ?? segment.yaw, local);
      tendons.push({ segment: i, side, a, b, length: Math.hypot(...b.map((v, j) => v - a[j])) });
    }
  });
  const gills = [-1, 1].map(side => ({ side, phaseAngle: angle, ...solveGill(angle) }));
  const pectorals = [-1, 1].map(side => ({ side, angle: -0.2 + 0.23 * Math.sin(angle + (side < 0 ? Math.PI : 0)) }));
  const last = segments.at(-1), tailAngle = 0.16 * Math.sin(angle - TAU / 3);
  const tailTip = transformPoint(points.at(-1), last.yaw + tailAngle, caudalPoint(1));
  const gillError = Math.max(...gills.map(g => Math.abs(Math.hypot(...g.rocker.map((v, i) => v - g.crank[i])) - F.gillRod)));
  return {
    driveAngle: angle, amplitude, cadence, points, segments, tendons, gills, pectorals, tailAngle, tailTip,
    metrics: { cycleSeconds: 1 / cadence, driveRpm: cadence * 60,
      spineLength: F.lengths.reduce((a, b) => a + b, 0),
      tailLateralMm: points.at(-1)[0] * 1000,
      tailPeduncleSpeed: Math.hypot(...velocities.at(-1)),
      maxJointDeg: Math.max(...segments.map(s => Math.abs(s.jointAngle))) * 180 / Math.PI,
      gillOpeningDeg: -gills[0].angle * 180 / Math.PI,
      tendonDifferentialMm: Math.max(...segments.map((s, i) => Math.abs(tendons[i * 2].length - tendons[i * 2 + 1].length))) * 1000,
      gillResidualMm: gillError * 1000 },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const safeTime = Number.isFinite(t) ? t : 0, hz = cycleHz(input);
  const phase = ((safeTime % (1 / hz)) * hz % 1 + 1) % 1;
  return { t: safeTime, phase, ...poseAt(phase * TAU, input) };
}
