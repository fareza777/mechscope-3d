// Metres, seconds, radians. An autonomous observing cycle for a dome and
// equatorial telescope: the tube, fork, shutter hinges and dome track stay
// rigid, while the dome scans, the shutters breathe, the mount tracks and the
// optics, louvers, rollers and drive train keep working. Seeing, optics and
// tracking accuracy are not simulated.
export const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.06, dome: 0, altitude: 38, shutter: 60 });
export const D = Object.freeze({
  wallRadius: 1.20, wallHeight: 1.24, domeRadius: 1.26, domeBaseY: 1.24,
  slitHalfAngle: 0.30, shutterMax: 72 * DEG,
  pierY: 0.92, pivot: Object.freeze([0, 1.52, 0]),
  tubeBack: 0.62, tubeFront: 1.02, tubeRadius: 0.20,
  mirrorCount: 7, mirrorRadius: 0.09, mirrorRing: 0.19,
  forkX: 0.29, trackingRate: 3,
  rollerRadius: 0.028, rollerCount: 8, louverCount: 10,
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const wrap = value => ((value % 1) + 1) % 1;
const rotY = (p, angle) => [p[0] * Math.cos(angle) + p[2] * Math.sin(angle), p[1], -p[0] * Math.sin(angle) + p[2] * Math.cos(angle)];
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
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input), phase = wrap(a / TAU), p = phase * TAU;
  // Autonomous cycle: the dome scans, the shutters breathe, the mount tracks
  // and the accessories run on integer harmonics so the whole loop repeats.
  const scan = (40 * Math.sin(p) + 5 * Math.sin(2 * p + .65)) * DEG;
  const domeAngle = controls.dome * DEG + scan;
  const altitude = clamp(controls.altitude + 24 * Math.sin(2 * p + 1.1) + 4 * Math.sin(3 * p), 5, 87) * DEG;
  const azimuth = scan * .68 + 6 * DEG * Math.sin(3 * p + .9);
  const openCycle = .5 - .5 * Math.cos(p);
  const shutterAngle = (controls.shutter / 70) * D.shutterMax * (.05 + .95 * openCycle);
  const direction = [Math.sin(azimuth) * Math.cos(altitude), Math.sin(altitude), Math.cos(azimuth) * Math.cos(altitude)];
  const side = [Math.cos(azimuth), 0, -Math.sin(azimuth)];
  const up = [-Math.sin(azimuth) * Math.sin(altitude), Math.cos(altitude), -Math.cos(azimuth) * Math.sin(altitude)];
  const pivot = D.pivot;
  const front = [pivot[0] + direction[0] * D.tubeFront, pivot[1] + direction[1] * D.tubeFront, pivot[2] + direction[2] * D.tubeFront];
  const back = [pivot[0] - direction[0] * D.tubeBack, pivot[1] - direction[1] * D.tubeBack, pivot[2] - direction[2] * D.tubeBack];
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
  const hingeRadius = D.domeRadius;
  const leftHinge = rotY([hingeRadius * Math.cos(-D.slitHalfAngle), 0, hingeRadius * Math.sin(-D.slitHalfAngle)], domeAngle);
  const rightHinge = rotY([hingeRadius * Math.cos(D.slitHalfAngle), 0, hingeRadius * Math.sin(D.slitHalfAngle)], domeAngle);
  leftHinge[1] = D.domeBaseY; rightHinge[1] = D.domeBaseY;
  const louvers = Array.from({ length: D.louverCount }, (_, index) => (
    12 + 34 * (.5 - .5 * Math.cos(p - .45 + index * .11)) + 3 * Math.sin(3 * p + index)
  ) * DEG);
  const ventFraction = .5 - .5 * Math.cos(p - .45);
  const leftFork = rotY([-D.forkX, pivot[1], 0], azimuth);
  const rightFork = rotY([D.forkX, pivot[1], 0], azimuth);
  return {
    driveAngle: a, phase, controls,
    dome: { angle: domeAngle, baseAngle: controls.dome * DEG, scan, deg: controls.dome, slitHalfAngle: D.slitHalfAngle },
    shutter: {
      angle: shutterAngle, deg: controls.shutter, openFraction: shutterAngle / D.shutterMax, cycleOpen: openCycle,
      leftHinge, rightHinge,
    },
    telescope: { pivot, direction, front, back, altitude, azimuth, mirrorCentre, secondary, mirrors, side, up },
    fork: { azimuth, left: leftFork, right: rightFork, span: D.forkX * 2 },
    mechanism: {
      louvers, ventFraction,
      hatch: .55 * (.5 - .5 * Math.cos(p + .55)),
      serviceDoor: .95 * (.5 - .5 * Math.cos(p - .9)),
      floorHatch: .28 * (.5 - .5 * Math.cos(p + 1.4)),
      focusTravel: .028 * Math.sin(2 * p + .6),
      spiderAngle: .24 * Math.sin(p + .2),
      secondaryTilt: .06 * Math.sin(2 * p + 1.4),
      clockWeight: .09 * Math.sin(2 * p + .4),
      clockHour: -p * .12,
      clockMinute: -p * 1.1,
    },
    drive: {
      wheelAngle: -TAU * phase * D.trackingRate, fanAngle: TAU * phase * 8, pinionAngle: TAU * phase * 2,
      secondsAngle: TAU * phase * 12, wormAngle: -TAU * phase * 9, rollerAngle: -domeAngle * 34,
      louverAngle: louvers[0], ventAngle: ventFraction,
    },
    metrics: {
      cadenceHz: controls.cadence, domeDeg: Math.round(domeAngle / DEG), altitudeDeg: Math.round(altitude / DEG),
      shutterDeg: Math.round(shutterAngle / DEG), tubeMm: Math.round((D.tubeFront + D.tubeBack) * 1000), mirrorSegments: D.mirrorCount,
      domeMm: Math.round(D.domeRadius * 2000), trackingResidualMm: residual * 1000, scanDeg: Math.round(scan / DEG),
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
