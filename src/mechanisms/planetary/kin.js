export const TAU = Math.PI * 2;
export const P = Object.freeze({ sunTeeth: 24, planetTeeth: 24, ringTeeth: 72, sunRadius: .18, planetRadius: .18, ringRadius: .54, orbit: .36, centreY: .88, gearZ: 0, frontCarrierZ: .135, rearCarrierZ: -.135 });
export const DEFAULT_INPUTS = Object.freeze({ cadence: .10, sleeve: .35 });
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const wrap = x => ((x % 1) + 1) % 1;
export const inputs = (input = {}) => ({ cadence: clamp(input.cadence, .03, .25, .10), sleeve: clamp(input.sleeve, 0, 1, .35) });
export const cycleHz = input => inputs(input).cadence;
export function pose(phase = 0, sleeve = .35) {
  phase = wrap(Number.isFinite(phase) ? phase : 0);
  const driveAngle = TAU * phase, sunAngle = 4 * driveAngle, planetAngle = -2 * driveAngle;
  return { phase, driveAngle, carrierAngle: driveAngle, sunAngle, ringAngle: 0, sleeve: inputs({ sleeve }).sleeve,
    sleeveZ: .325 + .11 * inputs({ sleeve }).sleeve,
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
