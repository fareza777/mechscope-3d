// Metres, seconds, radians. A clockwork orrery: every orbit radius, arm height
// and moon distance is exact; orbital periods are compressed for inspection
// and no gravitational, ephemeris or resonance model is implied.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.05, tilt: 16, moon: 25, armillary: 28 });
export const D = Object.freeze({
  pivotY: 1.06, baseR: 1.16, dialY: 0.11,
  orbits: Object.freeze([0.30, 0.38, 0.47, 0.57, 0.69, 0.82, 0.94, 1.06]),
  armY: Object.freeze([-0.44, -0.32, -0.20, -0.08, 0.05, 0.19, 0.33, 0.47]),
  periods: Object.freeze([0.11, 0.18, 0.27, 0.40, 0.62, 0.86, 1.12, 1.42]),
  radii: Object.freeze([0.040, 0.052, 0.055, 0.045, 0.105, 0.085, 0.063, 0.062]),
  gearTeeth: Object.freeze([28, 26, 24, 22, 20, 18, 16, 14]),
  names: Object.freeze(['MERCURY', 'VENUS', 'EARTH', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE']),
  moons: Object.freeze([
    Object.freeze({ planet: 2, name: 'LUNA', radius: 0.085, rate: 14 }),
    Object.freeze({ planet: 3, name: 'PHOBOS', radius: 0.045, rate: 11 }),
    Object.freeze({ planet: 3, name: 'DEIMOS', radius: 0.064, rate: 7 }),
    Object.freeze({ planet: 4, name: 'IO', radius: 0.115, rate: 9 }),
    Object.freeze({ planet: 5, name: 'TITAN', radius: 0.100, rate: 6 }),
    Object.freeze({ planet: 6, name: 'TITANIA', radius: 0.078, rate: 5 }),
  ]),
  armillary: Object.freeze({ centreY: 1.66, radius: 0.50 }),
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const wrap = value => ((value % 1) + 1) % 1;
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.02, 0.10, DEFAULT_INPUTS.cadence),
    tilt: clamp(input?.tilt, 0, 28, DEFAULT_INPUTS.tilt),
    moon: clamp(input?.moon, 0, 45, DEFAULT_INPUTS.moon),
    armillary: clamp(input?.armillary, 0, 60, DEFAULT_INPUTS.armillary),
  };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => wrap(((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz);
const rotateZ = ([x, y, z], angle) => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle), z];
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input), phase = wrap(a / TAU);
  const tilt = controls.tilt * Math.PI / 180, moonLag = controls.moon * Math.PI / 180;
  const planets = D.names.map((name, index) => {
    const orbitAngle = TAU * wrap(phase / D.periods[index]) + index * 0.62;
    const local = [D.orbits[index] * Math.cos(orbitAngle), D.armY[index], D.orbits[index] * Math.sin(orbitAngle)];
    const tilted = rotateZ(local, tilt);
    return {
      index, name, orbit: D.orbits[index], armY: D.armY[index], radius: D.radii[index],
      orbitAngle, gearAngle: -TAU * (phase * (8 - index) * 0.16 + index * 0.05),
      centre: [tilted[0], D.pivotY + tilted[1], tilted[2]],
    };
  });
  const moons = D.moons.map((moon, index) => {
    const owner = planets[moon.planet];
    const moonAngle = TAU * wrap(phase * (moon.rate / D.periods[moon.planet])) + index * 1.71 + moonLag * (index + 1) / 6;
    const local = rotateZ([moon.radius * Math.cos(moonAngle), 0, moon.radius * Math.sin(moonAngle)], tilt);
    return { index, name: moon.name, planet: moon.planet, radius: moon.radius, angle: moonAngle,
      centre: [owner.centre[0] + local[0], owner.centre[1] + local[1], owner.centre[2] + local[2]] };
  });
  let residual = 0;
  for (const planet of planets) {
    const y = planet.centre[1] - D.pivotY;
    const local = rotateZ([planet.centre[0], y, planet.centre[2]], -tilt);
    residual = Math.max(residual, Math.abs(Math.hypot(local[0], local[2]) - planet.orbit));
  }
  const armillary = {
    centre: [0, D.armillary.centreY, 0], radius: D.armillary.radius,
    eclipticTilt: controls.armillary * Math.PI / 180,
    hourAngle: TAU * wrap(phase * 2),
  };
  return {
    phase, controls, tilt, planets, moons, armillary,
    sun: { centre: [0, D.pivotY + 0.02, 0], flare: 0.5 + 0.5 * Math.sin(TAU * phase) },
    drive: { wheelAngle: TAU * wrap(phase * 3), crankAngle: TAU * wrap(phase) },
    metrics: {
      cadenceHz: controls.cadence, tiltDeg: controls.tilt, moonLagDeg: controls.moon, armillaryDeg: controls.armillary,
      planetCount: planets.length, moonCount: moons.length,
      orbitSpanMm: Math.round((D.orbits.at(-1) - D.orbits[0]) * 2000), gearStages: D.gearTeeth.length,
      orbitResidualMm: residual * 1000,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
