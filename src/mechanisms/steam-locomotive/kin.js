// Designed stationary service demonstrator; metres, seconds, radians.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.35, advance: 22 });
export const D = Object.freeze({ axles: Object.freeze([-.34, .34, 1.02]), axleY: .50,
  wheelZ: .40, wheelRadius: .279, pitch: .68, crank: .14, conrod: .70,
  couplingZ: .515, conrodZ: .635, eccentric: .047, valveLength: .49, valveZ: .565,
  pistonOffset: .37, valveY: .77 });
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export function inputsOf(input = {}) {
  return { cadence: clamp(input?.cadence, .08, .8, DEFAULT_INPUTS.cadence), advance: clamp(input?.advance, -15, 45, DEFAULT_INPUTS.advance) };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => (((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz % 1 + 1) % 1;
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const controls = inputsOf(input), driveAngle = Number.isFinite(angle) ? angle : 0;
  const sides = [-1, 1].map(side => {
    const theta = driveAngle + (side > 0 ? Math.PI / 2 : 0);
    const pins = D.axles.map(x => [x + D.crank * Math.cos(theta), D.axleY + D.crank * Math.sin(theta), side * D.couplingZ]);
    const crank = [pins[0][0], pins[0][1], side * D.conrodZ];
    const crosshead = [crank[0] - Math.sqrt(D.conrod ** 2 - (crank[1] - D.axleY) ** 2), D.axleY, side * D.conrodZ];
    const eccentricAngle = theta + Math.PI / 2 + controls.advance * Math.PI / 180;
    const eccentricPin = [D.axles[0] + D.eccentric * Math.cos(eccentricAngle), D.axleY + D.eccentric * Math.sin(eccentricAngle), side * D.valveZ];
    const valve = [eccentricPin[0] - Math.sqrt(D.valveLength ** 2 - (D.valveY - eccentricPin[1]) ** 2), D.valveY, side * D.valveZ];
    return { side, id: side < 0 ? 'L' : 'R', theta, pins, crank, crosshead,
      piston: [crosshead[0] - D.pistonOffset, D.axleY, side * D.conrodZ], eccentricAngle, eccentricPin, valve };
  });
  const residual = Math.max(...sides.flatMap(s => [Math.abs(distance(s.crank, s.crosshead) - D.conrod),
    Math.abs(distance(s.eccentricPin, s.valve) - D.valveLength), ...s.pins.slice(1).map((pin, i) => Math.abs(distance(pin, s.pins[i]) - D.pitch))]));
  return { driveAngle, controls, sides, metrics: { axleRpm: controls.cadence * 60, pistonStrokeMm: 2 * D.crank * 1000,
    advanceDeg: controls.advance, leftPistonMm: sides[0].piston[0] * 1000, rightPistonMm: sides[1].piston[0] * 1000,
    valvePositionMm: sides[0].valve[0] * 1000, closureErrorMm: residual * 1000, translationM: 0 } };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
