// A kinematic exhibition clock, not a dynamical escapement simulation.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: .06, amplitude: 30 });
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export function inputsOf(input = {}) {
  return { cadence: clamp(input?.cadence, .025, .15, DEFAULT_INPUTS.cadence), amplitude: clamp(input?.amplitude, 15, 42, DEFAULT_INPUTS.amplitude) };
}
// Twelve cage revolutions close the 12:1 hands as well as all gear orientations.
export const cycleHz = input => inputsOf(input).cadence / 12;
export const phaseOf = (t, hz) => (((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz % 1 + 1) % 1;
const center = Object.freeze([0, 1.18, .10]);
const third = Object.freeze([.375 / Math.sqrt(2), center[1] + .375 / Math.sqrt(2), -.12]);
const second = Object.freeze([third[0] + .35 * Math.cos(2.55), third[1] + .35 * Math.sin(2.55), -.12]);
const first = Object.freeze([second[0] - .50, second[1], -.12]);
// A secondary seconds train hangs outside the three-wheel train: a ten-tooth
// pinion on a fourth arbor meshes the thirty-tooth third wheel, a thirty-tooth
// transfer wheel on that same arbor drives a six-tooth seconds pinion. The
// chain is 30/10 and 30/6, so the seconds arbor turns plus 720 times per master
// cycle (60 x the twelve-turn minute display) with integer turns at every stage.
const outward = Math.atan2(third[1] - center[1], third[0] - center[0]);
const fourth = Object.freeze([third[0] + .20 * Math.cos(outward), third[1] + .20 * Math.sin(outward), -.12]);
const fifth = Object.freeze([fourth[0] + .18 * Math.cos(outward - .55), fourth[1] + .18 * Math.sin(outward - .55), .155]);
export const D = Object.freeze({ center, gearCenters: Object.freeze([first, second, third]), teeth: Object.freeze([60, 40, 30]),
  radii: Object.freeze([.30, .20, .15]), turns: Object.freeze([24, -36, 48]), cageTurns: -12,
  cageRadius: .30, pinionRadius: .075, pinionTeeth: 15, cageTeeth: 60, balanceRadius: .196,
  springCount: 96, springZ: .125, escapeTeeth: 12, escapeCenter: Object.freeze([0, -.175, .009]),
  forkCenter: Object.freeze([0, -.092, .009]),
  extended: Object.freeze({
    pinion: Object.freeze({ teeth: 10, radius: .05, turns: -144, center: fourth, z: -.12 }),
    transfer: Object.freeze({ teeth: 30, radius: .15, turns: -144, center: fourth, z: .155 }),
    seconds: Object.freeze({ teeth: 6, radius: .03, turns: 720, center: fifth, z: .155 }),
  }) });
const meshedPhase = (theta, na, nb, a, b) => {
  const line = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return line + Math.PI + (Math.PI - na * (theta - line)) / nb;
};
const phaseA = .11;
const phaseB = meshedPhase(phaseA, 60, 40, first, second);
const phaseC = meshedPhase(phaseB, 40, 30, second, third);
export const GEAR_PHASES = Object.freeze([phaseA, phaseB, phaseC]);
export const CAGE_PHASE = meshedPhase(phaseC, 15, 60, third, center);
const phaseFourth = meshedPhase(phaseC, 30, 10, third, fourth);
const phaseSeconds = meshedPhase(phaseFourth, 30, 6, fourth, fifth);
export const EXTENDED_PHASES = Object.freeze([phaseFourth, phaseFourth, phaseSeconds]);
const springBase = Array.from({ length: D.springCount + 1 }, (_, i) => {
  const u = i / D.springCount, a = u * TAU * 3.25, r = .032 + .132 * u;
  return [r * Math.cos(a), r * Math.sin(a), D.springZ];
});
export const SPRING_LENGTHS = Object.freeze(springBase.slice(1).map((p, i) => Math.hypot(p[0] - springBase[i][0], p[1] - springBase[i][1])));
export function springAt(balanceAngle) {
  // Articulated constant-length segments, with a free outer inspection tail.
  // The apparent winding is qualitative: no elastic material law or fixed
  // outer spring attachment is asserted by this open-ended demonstration.
  const points = [[.032 * Math.cos(balanceAngle), .032 * Math.sin(balanceAngle), D.springZ]];
  for (let i = 0; i < D.springCount; i++) {
    const baseAngle = Math.atan2(springBase[i + 1][1] - springBase[i][1], springBase[i + 1][0] - springBase[i][0]);
    const angle = baseAngle + balanceAngle * (1 - i / D.springCount);
    points.push([points[i][0] + SPRING_LENGTHS[i] * Math.cos(angle), points[i][1] + SPRING_LENGTHS[i] * Math.sin(angle), D.springZ]);
  }
  return points;
}
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const driveAngle = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input);
  const cageAngle = CAGE_PHASE + D.cageTurns * driveAngle;
  const balanceAngle = controls.amplitude * Math.PI / 180 * Math.sin(72 * driveAngle);
  const forkAngle = .13 * Math.tanh(4 * Math.sin(72 * driveAngle)) / Math.tanh(4);
  const toothPosition = driveAngle / TAU * 144, whole = Math.floor(toothPosition), fraction = toothPosition - whole;
  const u = clamp((fraction - .72) / .28, 0, 1, 0), release = u * u * (3 - 2 * u);
  const escapeAngle = (whole + release) * TAU / D.escapeTeeth;
  const gearAngles = D.turns.map((turns, i) => GEAR_PHASES[i] + turns * driveAngle);
  const extendedAngles = [EXTENDED_PHASES[0] + D.extended.pinion.turns * driveAngle,
    EXTENDED_PHASES[1] + D.extended.transfer.turns * driveAngle,
    EXTENDED_PHASES[2] + D.extended.seconds.turns * driveAngle];
  const amplitudeMix = (controls.amplitude - 15) / 27;
  return { driveAngle, controls, gearAngles, cageAngle, balanceAngle, forkAngle, escapeAngle,
    extendedAngles, secondsAngle: extendedAngles[2], fanAngle: 3 * escapeAngle,
    cageRollerAngle: -2 * cageAngle, clickAngle: .16 * Math.sin(18 * gearAngles[0]),
    regulatorAngle: -.30 + .07 * amplitudeMix + .06 * Math.sin(18 * driveAngle),
    springPoints: springAt(balanceAngle), minuteAngle: -12 * driveAngle, hourAngle: -driveAngle,
    lock: fraction < .72 ? (whole % 2 === 0 ? 'entry locked' : 'exit locked') : 'illustrative release',
    metrics: { cageRpm: controls.cadence * 60, balanceAmplitudeDeg: controls.amplitude, balanceHz: controls.cadence * 6,
      fullCycleSeconds: 12 / controls.cadence, barrelRpm: controls.cadence * 120, escapeStepsHz: controls.cadence * 12,
      balanceAngleDeg: balanceAngle * 180 / Math.PI, gearRatio: 2, releaseFraction: release,
      secondsRpm: controls.cadence * 3600, transferTurns: 144, secondsTurns: 720 } };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
