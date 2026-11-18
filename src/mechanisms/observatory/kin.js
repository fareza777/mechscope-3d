// Metres, seconds, radians. A dome and equatorial telescope study: the tube,
// fork, shutter hinges and dome track are rigid. Seeing, optics and tracking
// accuracy are not simulated.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.06, dome: 0, altitude: 38, shutter: 60 });
export const D = Object.freeze({
  wallRadius: 1.20, wallHeight: 1.24, domeRadius: 1.26, domeBaseY: 1.24,
  slitHalfAngle: 0.30, shutterMax: 72 * Math.PI / 180,
  pierY: 0.92, pivot: Object.freeze([0, 1.52, 0]),
  tubeBack: 0.62, tubeFront: 1.02, tubeRadius: 0.20,
  mirrorCount: 7, mirrorRadius: 0.09, mirrorRing: 0.19,
  forkX: 0.29, trackingRate: 3,
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const wrap = value => ((value % 1) + 1) % 1;
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.03, 0.12, DEFAULT_INPUTS.cadence),
    dome: clamp(input?.dome, -150, 150, DEFAULT_INPUTS.dome),
    altitude: clamp(input?.altitude, 12, 82, DEFAULT_INPUTS.altitude),
    shutter: clamp(input?.shutter, 0, 70, DEFAULT_INPUTS.shutter),
  };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => wrap(((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz);
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input), phase = wrap(a / TAU);
  const altitude = controls.altitude * Math.PI / 180;
  const domeAngle = controls.dome * Math.PI / 180;
  const shutterAngle = controls.shutter / 70 * D.shutterMax;
  const direction = [0, Math.sin(altitude), Math.cos(altitude)];
  const pivot = D.pivot;
  const front = [pivot[0] + direction[0] * D.tubeFront, pivot[1] + direction[1] * D.tubeFront, pivot[2] + direction[2] * D.tubeFront];
  const back = [pivot[0] - direction[0] * D.tubeBack, pivot[1] - direction[1] * D.tubeBack, pivot[2] - direction[2] * D.tubeBack];
  const side = [1, 0, 0];
  const up = [0, Math.cos(altitude), -Math.sin(altitude)];
  const mirrorCentre = [back[0] + direction[0] * .08, back[1] + direction[1] * .08, back[2] + direction[2] * .08];
  const secondary = [pivot[0] + direction[0] * .44, pivot[1] + direction[1] * .44, pivot[2] + direction[2] * .44];
  const mirrors = Array.from({ length: D.mirrorCount }, (_, index) => {
    const ring = index === 0 ? 0 : 1;
    const count = ring === 0 ? 1 : 6, slot = index - 1;
    const offset = ring === 0 ? [0, 0] : [D.mirrorRing * Math.cos(slot * TAU / count), D.mirrorRing * Math.sin(slot * TAU / count)];
    return {
      index, ring,
      centre: [
        mirrorCentre[0] + side[0] * offset[0] + up[0] * offset[1],
        mirrorCentre[1] + side[1] * offset[0] + up[1] * offset[1],
        mirrorCentre[2] + side[2] * offset[0] + up[2] * offset[1],
      ],
    };
  });
  const residual = Math.max(
    Math.abs(Math.hypot(front[0] - pivot[0], front[1] - pivot[1], front[2] - pivot[2]) - D.tubeFront),
    Math.abs(Math.hypot(back[0] - pivot[0], back[1] - pivot[1], back[2] - pivot[2]) - D.tubeBack),
    Math.abs(Math.hypot(secondary[0] - pivot[0], secondary[1] - pivot[1], secondary[2] - pivot[2]) - .44),
  );
  return {
    driveAngle: a, phase, controls,
    dome: { angle: domeAngle, deg: controls.dome, slitHalfAngle: D.slitHalfAngle },
    shutter: { angle: shutterAngle, deg: controls.shutter, openFraction: controls.shutter / 70 },
    telescope: { pivot, direction, front, back, altitude, mirrorCentre, secondary, mirrors, side, up },
    fork: { left: [-D.forkX, pivot[1], pivot[2]], right: [D.forkX, pivot[1], pivot[2]] },
    drive: { wheelAngle: -TAU * phase * D.trackingRate, fanAngle: TAU * phase * 7, pinionAngle: TAU * phase * 2 },
    metrics: {
      cadenceHz: controls.cadence, domeDeg: controls.dome, altitudeDeg: controls.altitude, shutterDeg: controls.shutter,
      tubeMm: Math.round((D.tubeFront + D.tubeBack) * 1000), mirrorSegments: D.mirrorCount,
      domeMm: Math.round(D.domeRadius * 2000), trackingResidualMm: residual * 1000,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
