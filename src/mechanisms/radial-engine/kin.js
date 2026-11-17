// Display metres. This is an engineered axial-staggered crank demonstrator,
// not a production master-rod radial engine. Nine rods occupy separate Z lanes.
export const TAU = Math.PI * 2;
export const R = Object.freeze({ crank: .10, rod: .40, lane: .06, centreY: .94, pushrod: .41, rocker: .03, lift: .018 });
export const DEFAULT_INPUTS = Object.freeze({ cadence: .12, valveLift: 1 });
export const wrap = (x, period = 1) => ((x % period) + period) % period;
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const inputs = (input = {}) => ({ cadence: clamp(input.cadence, .04, .3, .12), valveLift: clamp(input.valveLift, .5, 1.3, 1) });
export const cycleHz = input => inputs(input).cadence;
export const framePoint = (i, x, y, z = 0) => {
  const a = i * TAU / 9;
  return [x * Math.cos(a) + y * Math.sin(a), R.centreY - x * Math.sin(a) + y * Math.cos(a), (i - 4) * R.lane + z];
};
const bump = (degrees, start, end) => {
  const f = wrap(degrees - start, 720) / (end - start);
  return f <= 1 ? Math.sin(Math.PI * f) ** 2 : 0;
};
export function pose(phase, valveLift = 1) {
  phase = wrap(Number.isFinite(phase) ? phase : 0);
  valveLift = inputs({ valveLift }).valveLift;
  const driveAngle = 2 * TAU * phase;
  const cylinders = Array.from({ length: 9 }, (_, i) => {
    const a = i * TAU / 9, relative = driveAngle - a;
    const s = R.crank * Math.cos(relative) + Math.sqrt(R.rod ** 2 - (R.crank * Math.sin(relative)) ** 2);
    // Alternate the firing revolution: order 1,3,5,7,9,2,4,6,8, every 80 degrees.
    const degrees = wrap((relative - (i % 2) * TAU) * 180 / Math.PI, 720);
    const valves = ['intake', 'exhaust'].map((kind, j) => {
      const sign = j ? 1 : -1;
      const lift = R.lift * valveLift * bump(degrees, j ? 140 : 340, j ? 380 : 580);
      const rockerAngle = sign * Math.asin(lift / R.rocker);
      const topX = sign * (.065 + R.rocker * Math.cos(rockerAngle));
      const topY = .675 + lift, lowerX = sign * .095;
      const lowerY = topY - Math.sqrt(R.pushrod ** 2 - (topX - lowerX) ** 2);
      return { kind, lift, rockerAngle, pushStart: framePoint(i, lowerX, lowerY, .045), pushEnd: framePoint(i, topX, topY, .045) };
    });
    return { index: i, distance: s, cycleDegrees: degrees, crankPin: [R.crank * Math.sin(driveAngle), R.centreY + R.crank * Math.cos(driveAngle), (i - 4) * R.lane], pistonPin: framePoint(i, 0, s), valves };
  });
  return { phase, driveAngle, camAngle: TAU * phase, valveLift, cylinders };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const p = inputs(input), finiteTime = Number.isFinite(t) ? t : 0;
  // Reduce time before multiplying; finite even for arbitrarily large finite times.
  const phase = wrap((finiteTime % (1 / p.cadence)) * p.cadence);
  const state = pose(phase, p.valveLift);
  return { ...state, metrics: { crankRpm: p.cadence * 120, strokeMm: 200, peakLiftMm: R.lift * p.valveLift * 1000, cycleSeconds: 1 / p.cadence, piston1TravelMm: (.5 - state.cylinders[0].distance) * 1000 } };
}
