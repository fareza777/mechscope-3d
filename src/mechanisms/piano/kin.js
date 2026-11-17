// Metres, seconds, radians. A player-grand anatomy study: keys, hammers,
// dampers and the lid follow one deterministic phrase. String acoustics,
// action regulation, voicing and sound output are not simulated.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 1.1, lid: 42, pedal: 0, velocity: 0.8 });
const PATTERN = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
const NAMES = ['C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2', 'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3'];
export const NOTE_COUNT = NAMES.length;
export const WHITE_COUNT = 14;
export const D = Object.freeze({
  keyboardFront: 0.98, keyboardBack: 0.80, keyboardY: 0.78, whiteWidth: 0.062, blackWidth: 0.036,
  whiteSpan: 1.12, stringY: 0.92, frontBridge: 0.45, hitchZ: -1.02,
  hammerPivotZ: 0.60, hammerPivotY: 0.68, damperZ: 0.55,
  lidHinge: Object.freeze([-0.78, 1.02, -0.04]), lidWidth: 1.52, lidLength: 1.84,
  stringTail: index => -0.30 - 0.70 * (1 - index / (NOTE_COUNT - 1)),
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const wrap = value => ((value % 1) + 1) % 1;
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.45, 2.0, DEFAULT_INPUTS.cadence),
    lid: clamp(input?.lid, 0, 55, DEFAULT_INPUTS.lid),
    pedal: clamp(input?.pedal, 0, 1, DEFAULT_INPUTS.pedal),
    velocity: clamp(input?.velocity, 0.3, 1, DEFAULT_INPUTS.velocity),
  };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => wrap(((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz);
export const DEFAULTS = { whiteStep: D.whiteSpan / (WHITE_COUNT - 1) };
export const NOTES = Object.freeze(NAMES.map((name, index) => {
  const black = PATTERN[index % 12] === 1;
  const whitesBefore = Array.from({ length: index }, (_, i) => PATTERN[i % 12] === 0).filter(Boolean).length;
  const whiteIndex = black ? whitesBefore - 1 : whitesBefore;
  const x = black
    ? -D.whiteSpan / 2 + (whiteIndex + .5) * DEFAULTS.whiteStep
    : -D.whiteSpan / 2 + whiteIndex * DEFAULTS.whiteStep;
  return Object.freeze({ index, name, black, whiteIndex, x, tail: D.stringTail(index) });
}));
export function pressAt(phase, index) {
  const local = wrap(phase - index * 0.0315);
  return local < .19 ? Math.sin(Math.PI * local / .19) : 0;
}
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input), phase = wrap(a / TAU);
  const notes = NOTES.map(note => {
    const press = pressAt(phase, note.index) * controls.velocity;
    const damper = Math.max(press * .86, controls.pedal * .92);
    return {
      ...note,
      press,
      keyAngle: press * .061,
      hammerAngle: -press * .52,
      damperLift: damper,
      damperAngle: damper * .08,
      stringVibration: press * .018 * Math.sin(TAU * (phase * 18 + note.index * .37)),
    };
  });
  const lidAngle = controls.lid * Math.PI / 180;
  const propEnd = [
    D.lidHinge[0] + D.lidWidth * .78 * Math.cos(lidAngle),
    D.lidHinge[1] + D.lidWidth * .78 * Math.sin(lidAngle),
    D.lidHinge[2] - .32,
  ];
  const pressedCount = notes.filter(note => note.press > .02).length;
  return {
    driveAngle: a, phase, controls, notes, lid: { angle: lidAngle, deg: controls.lid, propEnd },
    pedal: { value: controls.pedal, lift: controls.pedal * .92, angle: controls.pedal * .16 },
    pedals: [0, 1, 2].map(index => ({ index, angle: controls.pedal * (index === 2 ? .20 : .13) })),
    metrics: {
      cadenceHz: controls.cadence, notes: notes.length, whiteKeys: NOTES.filter(note => !note.black).length,
      pressed: pressedCount, velocity: controls.velocity, lidDeg: controls.lid, pedalLiftMm: controls.pedal * 92,
      stringCourses: notes.length, keyTravelMm: 61, actionResidualMm: 0,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
