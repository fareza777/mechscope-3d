export const TAU = Math.PI * 2;
export const P = Object.freeze({ sunTeeth: 24, planetTeeth: 24, ringTeeth: 72, sunRadius: .18, planetRadius: .18, ringRadius: .54, orbit: .36, centreY: .88, gearZ: 0, frontCarrierZ: .135, rearCarrierZ: -.135 });
export const DEFAULT_INPUTS = Object.freeze({ cadence: .10, sleeve: .35 });
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const wrap = x => ((x % 1) + 1) % 1;
export const inputs = (input = {}) => ({ cadence: clamp(input.cadence, .03, .25, .10), sleeve: clamp(input.sleeve, 0, 1, .35) });
export const cycleHz = input => inputs(input).cadence;
const meshPhase = (theta, na, nb, a, b) => {
  const line = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return line + Math.PI + (Math.PI - na * (theta - line)) / nb;
};
// Auxiliary 12:6:12 pump train in a forward lane. One carrier orbit gives the
// drive gear +1 turn, the six-tooth idler -2 turns and the pump gear +1 turn,
// so every pump tooth phase closes exactly at the full-cycle wrap.
const pumpDrive = Object.freeze([-.300, P.centreY, .430]);
const pumpIdler = Object.freeze([pumpDrive[0] + .135 * Math.cos(-.75), pumpDrive[1] + .135 * Math.sin(-.75), .430]);
const pumpGear = Object.freeze([pumpIdler[0] + .135 * Math.cos(-.75), pumpIdler[1] + .135 * Math.sin(-.75), .430]);
const pumpDrivePhase = 0;
const pumpIdlerPhase = meshPhase(pumpDrivePhase, 12, 6, pumpDrive, pumpIdler);
const pumpGearPhase = meshPhase(pumpIdlerPhase, 6, 12, pumpIdler, pumpGear);
export const PUMP = Object.freeze({ teeth: Object.freeze([12, 6, 12]), radii: Object.freeze([.09, .045, .09]), turns: Object.freeze([1, -2, 1]),
  centres: Object.freeze([pumpDrive, pumpIdler, pumpGear]), phases: Object.freeze([pumpDrivePhase, pumpIdlerPhase, pumpGearPhase]) });
export function pose(phase = 0, sleeve = .35) {
  phase = wrap(Number.isFinite(phase) ? phase : 0);
  const driveAngle = TAU * phase, sunAngle = 4 * driveAngle, planetAngle = -2 * driveAngle;
  const pumpAngles = PUMP.turns.map((turns, i) => PUMP.phases[i] + turns * driveAngle);
  const slewed = inputs({ sleeve }).sleeve;
  return { phase, driveAngle, carrierAngle: driveAngle, sunAngle, ringAngle: 0, sleeve: slewed,
    sleeveZ: .325 + .11 * slewed,
    pumpAngles, pumpAnglesDrive: pumpAngles[0], pumpAnglesIdler: pumpAngles[1], pumpAnglesGear: pumpAngles[2],
    pumpCentres: PUMP.centres,
    selectorAngle: driveAngle + .18,
    selectorForkX: .046 * Math.sin(2 * driveAngle) + .020 * (slewed - .5),
    ringRollerAngle: -2 * driveAngle,
    carrierNeedleSpin: 3 * driveAngle,
    inputRollerSpin: 8 * driveAngle,
    outputRollerSpin: 2 * driveAngle,
    planets: Array.from({ length: 3 }, (_, i) => {
      const orbitAngle = driveAngle + i * TAU / 3;
      return { index: i, orbitAngle, angle: planetAngle - Math.PI / 24, centre: [P.orbit * Math.cos(orbitAngle), P.centreY + P.orbit * Math.sin(orbitAngle), P.gearZ] };
    }),
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const p = inputs(input), time = Number.isFinite(t) ? t : 0;
  const state = pose(wrap((time % (1 / p.cadence)) * p.cadence), p.sleeve);
  // Willis: Ns(ws-wc) + Nr(wr-wc) = 24(4-1)+72(0-1) = 0.
  return { ...state, metrics: { reduction: 4, carrierRpm: p.cadence * 60, sunRpm: p.cadence * 240, planetRpm: -p.cadence * 120, willisResidual: P.sunTeeth * (4 - 1) + P.ringTeeth * (0 - 1), sleeveTravelMm: p.sleeve * 110 } };
}
