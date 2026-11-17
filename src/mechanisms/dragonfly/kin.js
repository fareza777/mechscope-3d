// Metres, seconds, radians. Teardown's pure-pose / exact-linkage pattern;
// these are designed demonstrator dimensions, not measured insect anatomy.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.55, eccentric: 28 });
export const D = Object.freeze({
  crankOrigin: Object.freeze([-0.09, -0.13, 0]), rocker: 0.095, conrod: 0.155,
  // The rear conrod retainer reaches 26.5 mm behind its pin plane;
  // 45 mm leaves 3.2 mm beyond the indexing gear's 15.3 mm front cap.
  conrodZ: 0.045,
  shoulderY: 1.23, shoulderX: 0.18, span: 1.22,
  abdomenLength: 0.124, abdomenCount: 8,
  legLengths: Object.freeze([0.16, 0.22, 0.18]),
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export function inputsOf(input = {}) {
  return { cadence: clamp(input?.cadence, 0.15, 1.2, DEFAULT_INPUTS.cadence), eccentric: clamp(input?.eccentric, 18, 40, DEFAULT_INPUTS.eccentric) };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => (((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz % 1 + 1) % 1;
const originDistance = Math.hypot(...D.crankOrigin);
export const ROCKER_DATUM = Math.atan2(D.crankOrigin[1], D.crankOrigin[0]) + Math.acos((D.rocker ** 2 + originDistance ** 2 - D.conrod ** 2) / (2 * D.rocker * originDistance));

export function solveShoulder(angle, eccentric = DEFAULT_INPUTS.eccentric) {
  const radius = inputsOf({ eccentric }).eccentric / 1000;
  const crank = [D.crankOrigin[0] + radius * Math.cos(angle), D.crankOrigin[1] + radius * Math.sin(angle), 0];
  const distance = Math.hypot(crank[0], crank[1]);
  const beta = Math.atan2(crank[1], crank[0]) + Math.acos(clamp((D.rocker ** 2 + distance ** 2 - D.conrod ** 2) / (2 * D.rocker * distance), -1, 1, 0));
  const rocker = [D.rocker * Math.cos(beta), D.rocker * Math.sin(beta), 0];
  const dx = rocker[0] - crank[0], dy = rocker[1] - crank[1];
  const derivative = (dx * -radius * Math.sin(angle) + dy * radius * Math.cos(angle)) / (dx * -rocker[1] + dy * rocker[0]);
  return { crank, rocker, angle: beta - ROCKER_DATUM, derivative, radius };
}

// An explicitly tapered, swept, open wing; z is the chord direction.
export function wingPoint(station, side, u, chord = 0) {
  const width = (station === 0 ? 0.19 : 0.245) * Math.sin(Math.PI * u) ** 0.65 + 0.018 * (1 - u);
  const sweep = (station === 0 ? -0.24 : 0.24) * u;
  return [0.035 + D.span * u, 0.012 * Math.sin(Math.PI * u), side * (sweep + width * chord)];
}

export function poseAt(driveAngle, input = {}) {
  const { cadence, eccentric } = inputsOf(input);
  const angle = Number.isFinite(driveAngle) ? driveAngle : 0;
  const wings = [];
  for (let station = 0; station < 2; station++) for (const side of [-1, 1]) {
    const phaseAngle = angle + station * Math.PI;
    const linkage = solveShoulder(phaseAngle, eccentric);
    const origin = [side * D.shoulderX, D.shoulderY, station === 0 ? -0.4 : -0.04];
    const localTip = wingPoint(station, side, 1, 0);
    const tip = [origin[0] + side * localTip[0] * Math.cos(linkage.angle), origin[1] + localTip[0] * Math.sin(linkage.angle), origin[2] + side * localTip[2]];
    wings.push({ id: `${station === 0 ? 'fore' : 'hind'}.${side < 0 ? 'L' : 'R'}`, side, station, origin, phaseAngle, ...linkage, tip });
  }
  const abdomen = [], abdomenPoints = [[0, 1.16, 0.13]];
  for (let i = 0; i < D.abdomenCount; i++) {
    const pitch = -0.055 + 0.065 * Math.sin(angle - i * 0.48) * (i + 1) / D.abdomenCount;
    const start = abdomenPoints[i];
    const end = [0, start[1] + D.abdomenLength * Math.sin(pitch), start[2] + D.abdomenLength * Math.cos(pitch)];
    abdomen.push({ pitch, start, end }); abdomenPoints.push(end);
  }
  const legs = [];
  for (let station = 0; station < 3; station++) for (const side of [-1, 1]) {
    const origin = [side * 0.15, 1.11, -0.5 + station * 0.25];
    const swing = 0.07 * Math.sin(angle + station * 1.2);
    const angles = [-0.56 + swing, -1.48 - swing * 0.5, -1.87 + swing];
    const joints = [[0, 0, 0]];
    angles.forEach((a, i) => {
      const p = joints[i], length = D.legLengths[i];
      joints.push([p[0] + length * Math.cos(a), p[1] + length * Math.sin(a), 0]);
    });
    legs.push({ id: `${station + 1}.${side < 0 ? 'L' : 'R'}`, side, station, origin, angles, joints });
  }
  const residual = Math.max(...wings.map(w => Math.abs(Math.hypot(...w.crank.map((v, i) => v - w.rocker[i])) - D.conrod)));
  return {
    driveAngle: angle, wings, abdomen, abdomenPoints, legs,
    metrics: { crankRpm: cadence * 60, cycleSeconds: 1 / cadence, eccentricMm: eccentric,
      foreFlapDeg: wings[0].angle * 180 / Math.PI, hindFlapDeg: wings[2].angle * 180 / Math.PI,
      foreTipSpeed: Math.abs(wings[0].derivative * TAU * cadence * (D.span + 0.035)),
      linkResidualMm: residual * 1000, abdomenLength: D.abdomenLength * D.abdomenCount },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const safeTime = Number.isFinite(t) ? t : 0;
  const phase = phaseOf(safeTime, cycleHz(input));
  return { t: safeTime, phase, ...poseAt(phase * TAU, input) };
}
