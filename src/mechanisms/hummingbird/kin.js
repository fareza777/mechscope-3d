// Designed inspection automaton, metres / seconds / radians; no aerodynamic solver.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: .45, stroke: 28 });
export const D = Object.freeze({ crank: Object.freeze([-.09, -.13, 0]), rocker: .095, conrod: .155, rodPlane: .07, shoulderX: .23, shoulderY: 1.32, upper: .37, fore: .28, claw: Object.freeze([.105, .125, .055]) });
const clamp = (v, a, b, d) => Math.max(a, Math.min(b, Number.isFinite(v) ? v : d));
export function inputsOf(input = {}) { return { cadence: clamp(input?.cadence, .15, 1, .45), stroke: clamp(input?.stroke, 18, 38, 28) }; }
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => (((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz % 1 + 1) % 1;
export const rx = (p, a) => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)];
export const ry = (p, a) => [p[0] * Math.cos(a) + p[2] * Math.sin(a), p[1], -p[0] * Math.sin(a) + p[2] * Math.cos(a)];
export const rz = (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]];
export const plus = (a, b) => a.map((x, i) => x + b[i]);
const d = Math.hypot(...D.crank);
export const DATUM = Math.atan2(D.crank[1], D.crank[0]) + Math.acos((D.rocker ** 2 + d ** 2 - D.conrod ** 2) / (2 * D.rocker * d));
export function solveShoulder(angle, stroke = 28) {
  const radius = inputsOf({ stroke }).stroke / 1000;
  const crank = [D.crank[0] + radius * Math.cos(angle), D.crank[1] + radius * Math.sin(angle), 0];
  const length = Math.hypot(...crank);
  const beta = Math.atan2(crank[1], crank[0]) + Math.acos(clamp((D.rocker ** 2 + length ** 2 - D.conrod ** 2) / (2 * D.rocker * length), -1, 1, 0));
  return { radius, crank, rocker: [D.rocker * Math.cos(beta), D.rocker * Math.sin(beta), 0], flap: beta - DATUM };
}
export function featherSpec(layer, i, side) {
  // Shingle the open feather lattices out of the wing plane. Neighboring
  // quills and their 3.4 mm edge rails overlap in plan but stay separated in
  // depth, so the fan reads continuous without solid-in-solid penetration.
  const count = layer === 'primary' ? 9 : 7, shingle = (i - (count - 1) / 2) * .014;
  const start = layer === 'primary' ? [.04 + i * .028, shingle, 0] : [.045 + i * .044, -.018 + shingle, 0];
  const delta = layer === 'primary' ? [.59 - i * .038, 0, side * (.045 + i * .068)] : [.11, 0, side * (.27 + i * .018)];
  return { start, end: plus(start, delta), length: Math.hypot(...delta), width: layer === 'primary' ? .025 : .023 };
}
export function wingWorld(w, p, fore = false) {
  if (fore) p = plus(ry(p, -w.side * w.fold), [D.upper, 0, 0]);
  p = rz(ry(rx(p, w.side * w.pitch), -w.side * w.sweep), w.flap);
  return plus([w.side * p[0], p[1], w.side * p[2]], w.origin);
}
export function poseAt(driveAngle, input = {}) {
  const controls = inputsOf(input), angle = Number.isFinite(driveAngle) ? driveAngle : 0, strength = controls.stroke / 38;
  const wings = [-1, 1].map(side => {
    const w = { id: side < 0 ? 'L' : 'R', side, origin: [side * D.shoulderX, D.shoulderY, -.14], ...solveShoulder(angle, controls.stroke),
      sweep: .07 + .075 * strength * Math.sin(angle + .4), pitch: .12 * strength * Math.cos(angle), fold: .11 + .13 * strength * (1 - Math.cos(angle - .6)), feathers: [] };
    w.elbow = wingWorld(w, [D.upper, 0, 0]); w.wrist = wingWorld(w, [D.fore, 0, 0], true);
    for (const layer of ['secondary', 'primary']) for (let i = 0; i < (layer === 'primary' ? 9 : 7); i++) {
      const f = featherSpec(layer, i, side);
      w.feathers.push({ layer, i, twist: .09 * strength * Math.sin(angle - i * .13), start: wingWorld(w, f.start, layer === 'primary'), end: wingWorld(w, f.end, layer === 'primary') });
    }
    return w;
  });
  const tail = Array.from({ length: 7 }, (_, i) => {
    const fan = (i - 3) * (.14 + .025 * strength * Math.sin(angle));
    const pitch = -.14 + .09 * strength * Math.sin(angle - .7 + i * .09), length = .40 - .018 * Math.abs(i - 3);
    const start = [(i - 3) * .017, 1.235, .24];
    return { start, end: plus(start, [length * Math.sin(fan) * Math.cos(pitch), length * Math.sin(pitch), length * Math.cos(fan) * Math.cos(pitch)]), length, fan, pitch };
  });
  const claws = [-1, 1].map(side => {
    const points = [[side * .092, 1.23, .035]], angles = [-1.05, -2.75, -1.25].map((a, i) => a + .07 * strength * Math.sin(angle - i * .4));
    D.claw.forEach((length, i) => points.push(plus(points[i], [side * length * Math.cos(angles[i]), length * Math.sin(angles[i]), .0])));
    return { side, points };
  });
  const span = Math.max(...wings[1].feathers.map(f => f.end[0])) - Math.min(...wings[0].feathers.map(f => f.end[0]));
  return { driveAngle: angle, controls, wings, tail, claws, headYaw: .07 * strength * Math.sin(angle - .5),
    metrics: { driveRpm: controls.cadence * 60, strokeMm: controls.stroke, spanM: span, shoulderDeg: wings[0].flap * 180 / Math.PI, elbowDeg: wings[0].fold * 180 / Math.PI,
      closureMm: Math.abs(Math.hypot(...wings[0].crank.map((v, i) => v - wings[0].rocker[i])) - D.conrod) * 1000 } };
}
export function sample(t = 0, input = DEFAULT_INPUTS) { const safe = Number.isFinite(t) ? t : 0, phase = phaseOf(safe, cycleHz(input)); return { t: safe, phase, ...poseAt(phase * TAU, input) }; }
