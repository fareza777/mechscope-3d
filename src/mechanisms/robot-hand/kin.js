// Fixed bones and geometric tendon routes, not tendon dynamics or contact forces.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: .32, grip: 80 });
export const D = Object.freeze({ wrist: Object.freeze([0, .94, 0]), digits: Object.freeze([
  { id: 'index', name: 'Index', base: [-.275, .415, 0], lengths: [.23, .16, .115], width: .078, splay: .075, phase: 0 },
  { id: 'middle', name: 'Middle', base: [-.09, .46, 0], lengths: [.26, .18, .125], width: .085, splay: .015, phase: .12 },
  { id: 'ring', name: 'Ring', base: [.105, .425, 0], lengths: [.24, .165, .12], width: .082, splay: -.035, phase: .24 },
  { id: 'little', name: 'Little', base: [.285, .35, 0], lengths: [.19, .135, .1], width: .07, splay: -.12, phase: .36 },
  { id: 'thumb', name: 'Thumb', base: [-.335, .12, .08], lengths: [.17, .14, .105], width: .09, splay: .95, phase: -.35 },
].map(d => Object.freeze({ ...d, base: Object.freeze(d.base), lengths: Object.freeze(d.lengths) }))) });
const clamp = (v, a, b, d) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : d));
export function inputsOf(input = {}) { return { cadence: clamp(input?.cadence, .12, .8, .32), grip: clamp(input?.grip, 25, 100, 80) }; }
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => (((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz % 1 + 1) % 1;
export const rx = (p, a) => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
export const ry = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
export const rz = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];
export const plus = (a, b) => a.map((v, i) => v + b[i]);
export const wristWorld = (p, yaw) => plus(ry(p, yaw), D.wrist);
export function bonePoint(digit, index, point) { return plus(digit.points[index], ry(rz(rx(point, digit.cumulative[index]), digit.splay), digit.opposition)); }
export function capstanPosition(i) { return i === 4 ? [-.265, -.015, -.08] : [-.25 + i * .165, .12 + (i % 2) * .025, -.08]; }
export function poseAt(driveAngle, input = {}) {
  const controls = inputsOf(input), angle = Number.isFinite(driveAngle) ? driveAngle : 0;
  const wristYaw = .075 * controls.grip / 100 * Math.sin(angle);
  const digits = D.digits.map((spec, i) => {
    const curl = controls.grip / 100 * (1 - Math.cos(angle - spec.phase)) / 2, thumb = i === 4;
    const joints = thumb ? [.08 + .38 * curl, .12 + .50 * curl, .08 + .45 * curl] : [.035 + .62 * curl, .025 + .74 * curl, .02 + .58 * curl];
    const digit = { id: spec.id, curl, joints, splay: spec.splay - (thumb ? .14 * curl : 0), opposition: thumb ? .12 + .52 * curl : 0, cumulative: [], points: [spec.base.slice()] };
    joints.forEach((a, j) => { digit.cumulative.push(a + (digit.cumulative[j - 1] || 0)); digit.points.push(bonePoint(digit, j, [0, spec.lengths[j], 0])); });
    digit.worldPoints = digit.points.map(p => wristWorld(p, wristYaw));
    // Two exposed lateral inspection routes. Only these line primitives change length.
    // The first span leaves the capstan; subsequent spans join bone-side guides.
    digit.tendons = [];
    for (const side of [-1, 1]) {
      const anchors = [bonePoint(digit, 0, [side * spec.width * .34, .015, -.053])];
      spec.lengths.forEach((length, j) => anchors.push(bonePoint(digit, j, [side * spec.width * .34, length - .014, -.053])));
      const drive = plus(capstanPosition(i), [side * .027, .038, 0]);
      [drive, ...anchors].slice(0, -1).forEach((start, k) => digit.tendons.push({ side, k, start, end: anchors[k] }));
    }
    return digit;
  });
  const routeLength = digits.reduce((sum, d) => sum + d.tendons.reduce((s, t) => s + Math.hypot(...t.start.map((v, i) => v - t.end[i])), 0), 0);
  return { driveAngle: angle, controls, wristYaw, digits,
    metrics: { cyclesPerMin: controls.cadence * 60, gripPercent: controls.grip, indexCurlDeg: digits[0].joints.reduce((a, b) => a + b) * 180 / Math.PI,
      thumbOppDeg: digits[4].opposition * 180 / Math.PI, wristYawDeg: wristYaw * 180 / Math.PI, routedLengthM: routeLength } };
}
export function sample(t = 0, input = DEFAULT_INPUTS) { const safe = Number.isFinite(t) ? t : 0, phase = phaseOf(safe, cycleHz(input)); return { t: safe, phase, ...poseAt(phase * TAU, input) }; }
