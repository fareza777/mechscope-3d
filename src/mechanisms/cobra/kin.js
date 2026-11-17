// Metres, seconds and radians; prescribed articulation, not force simulation.
export const TAU = 2 * Math.PI;
export const DEFAULT_INPUTS = Object.freeze({ cadence: .16, spread: .72 });
export const D = Object.freeze({ length: .114, count: 18, base: Object.freeze([0, .135, .40]), jaw: .17 });
export const HOOD_LENGTHS = Object.freeze([.25, .36, .46, .53, .55, .51, .42, .30]);
const elevations = [.28, .52, .86, 1.20, 1.49, 1.70, 1.79, 1.72, 1.57, 1.43, 1.39, 1.44, 1.53, 1.60, 1.63, 1.60, 1.52, 1.42];
const clamp = (x, a, b, fallback) => Number.isFinite(x) ? Math.max(a, Math.min(b, x)) : fallback;
export const inputsOf = (input = {}) => ({ cadence: clamp(input?.cadence, .06, .4, DEFAULT_INPUTS.cadence), spread: clamp(input?.spread, 0, 1, DEFAULT_INPUTS.spread) });
export const cycleHz = input => inputsOf(input).cadence;
export const plus = (a, b) => a.map((x, i) => x + b[i]);
export const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));
export const radiusAt = i => .035 + .034 * Math.sin(Math.PI * (i + 1) / 22);
export function multiply(a, b) {
  const [x, y, z, w] = a, [u, v, s, t] = b;
  return [w * u + x * t + y * s - z * v, w * v - x * s + y * t + z * u, w * s + x * v - y * u + z * t, w * t - x * u - y * v - z * s];
}
export const axisQ = (axis, angle) => [axis[0] * Math.sin(angle / 2), axis[1] * Math.sin(angle / 2), axis[2] * Math.sin(angle / 2), Math.cos(angle / 2)];
export function rotate(q, p) {
  return multiply(multiply(q, [...p, 0]), [-q[0], -q[1], -q[2], q[3]]).slice(0, 3);
}
export const point = (origin, q, local) => plus(origin, rotate(q, local));

export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const { cadence, spread } = inputsOf(input);
  const driveAngle = Number.isFinite(angle) ? ((angle % TAU) + TAU) % TAU : 0;
  let origin = [...D.base], q = [0, 0, 0, 1], previousPitch = 0, previousSway = 0;
  const spine = elevations.map((elevation, i) => {
    const pitch = elevation - Math.PI / 2;
    // The first two links are restrained by the plinth saddle. Relative rotations
    // accumulate in the previous member's frame, rather than displacing end pins.
    const sway = i < 2 ? 0 : .075 * Math.sin(driveAngle - i * .23) * (i - 1) / 16;
    q = multiply(q, multiply(axisQ([0, 0, 1], sway - previousSway), axisQ([1, 0, 0], pitch - previousPitch)));
    const end = point(origin, q, [0, D.length, 0]);
    const link = { start: origin, end, q, length: D.length, joint: pitch - previousPitch, sway };
    origin = end; previousPitch = pitch; previousSway = sway;
    return link;
  });
  const hoodAngle = .79 + .44 * spread + (.035 + .125 * spread) * Math.sin(driveAngle + .35);
  const hood = HOOD_LENGTHS.flatMap((length, station) => [-1, 1].map(side => {
    const frame = station + 9, link = spine[frame];
    const local = [side * (radiusAt(frame) + .021), .0285, -.006];
    const hingeQ = axisQ([0, 0, 1], -side * hoodAngle);
    const rotation = multiply(link.q, hingeQ), start = point(link.start, link.q, local);
    return { id: `${station + 1}.${side < 0 ? 'L' : 'R'}`, station, side, frame, length, local, angle: -side * hoodAngle, start, end: point(start, rotation, [0, length, 0]), q: rotation };
  }));
  const head = { start: origin, q: spine.at(-1).q };
  const jawAngle = .10 + .28 * (.5 + .5 * Math.sin(driveAngle + .8));
  const jawStart = point(head.start, head.q, [0, -.035, -.018]);
  const jawQ = multiply(head.q, axisQ([1, 0, 0], -jawAngle));
  const tongueTravel = .025 + .035 * (.5 + .5 * Math.sin(driveAngle * 2));
  const tongueStart = point(jawStart, jawQ, [0, .005, -.105 - tongueTravel]);
  return {
    driveAngle, inputs: { cadence, spread }, spine, hood, head, jaw: { start: jawStart, q: jawQ, angle: jawAngle, end: point(jawStart, jawQ, [0, 0, -D.jaw]) },
    tongue: { start: tongueStart, travel: tongueTravel, tips: [-1, 1].map(side => point(tongueStart, jawQ, [side * .019, 0, -.105])) },
    metrics: { driveRpm: cadence * 60, hoodSpanMm: distance(hood[8].end, hood[9].end) * 1000, jawDegrees: jawAngle * 180 / Math.PI, cycleSeconds: 1 / cadence, headHeight: head.start[1], spineLength: D.count * D.length },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, hz = cycleHz(input);
  const phase = (((time % (1 / hz)) * hz) % 1 + 1) % 1;
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
