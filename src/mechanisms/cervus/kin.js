// Metres, seconds, radians. A stag-beetle study: rigid links, pincer pins and
// six ground contacts are exact; muscle force, shell flex and grip are not.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.34, stride: 0.11, gape: 12, elytra: 8, antenna: 8 });
export const D = Object.freeze({
  bodyY: 0.80, hipX: 0.22, hipY: 0, hipZ: Object.freeze([-0.30, -0.02, 0.24]),
  femur: 0.38, tibia: 0.40, ankleLift: Object.freeze([0, 0.10, 0.015]),
  footX: 0.46, footZ: Object.freeze([-0.50, -0.04, 0.44]), footY: 0.04, stanceFraction: 0.62,
  headOrigin: Object.freeze([0, 0.15, -0.44]),
  mandibleBase: Object.freeze([0.16, 0.08, -0.24]), mandibleLengths: Object.freeze([0.30, 0.28, 0.24]),
  antennaBase: Object.freeze([0.10, 0.12, -0.12]), antennaLink: 0.08, antennaCount: 5,
  abdomenBase: Object.freeze([0, 0.02, 0.30]), abdomenLink: 0.13, abdomenCount: 6,
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.15, 0.9, DEFAULT_INPUTS.cadence),
    stride: clamp(input?.stride, 0.06, 0.16, DEFAULT_INPUTS.stride),
    gape: clamp(input?.gape, 0, 32, DEFAULT_INPUTS.gape),
    elytra: clamp(input?.elytra, 0, 28, DEFAULT_INPUTS.elytra),
    antenna: clamp(input?.antenna, 0, 25, DEFAULT_INPUTS.antenna),
  };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => (((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz % 1 + 1) % 1;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = a => Math.hypot(...a);
const unit = a => { const l = length(a); return l > 1e-12 ? mul(a, 1 / l) : [0, 1, 0]; };
export const distance = (a, b) => length(sub(a, b));
export function footTarget(phase, stride = 0.12) {
  const q = ((Number.isFinite(phase) ? phase : 0) % 1 + 1) % 1;
  if (q < D.stanceFraction) {
    const u = q / D.stanceFraction;
    return { q, z: -stride * 0.5 + stride * u, y: D.footY, stance: true };
  }
  const u = (q - D.stanceFraction) / (1 - D.stanceFraction), ease = u * u * (3 - 2 * u);
  return { q, z: stride * 0.5 - stride * ease, y: D.footY + 0.06 * Math.sin(Math.PI * u), stance: false };
}
export function solveTwoLink(hip, ankle, upper = D.femur, lower = D.tibia, bend = [0, 0, -1]) {
  const delta = sub(ankle, hip), reach = clamp(length(delta), Math.abs(upper - lower) + 1e-7, upper + lower - 1e-7);
  const axis = unit(delta), hint = unit(sub(bend, mul(axis, dot(bend, axis))));
  const cosine = clamp((upper * upper + reach * reach - lower * lower) / (2 * upper * reach), -1, 1, 1);
  const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
  return { knee: add(hip, add(mul(axis, upper * cosine), mul(hint, upper * sine))), ankle: add(hip, mul(axis, reach)), reach };
}
export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input);
  const phase = ((a / TAU) % 1 + 1) % 1;
  const bob = 0.012 * Math.sin(2 * a), sway = 0.012 * Math.sin(a);
  const offset = [sway, D.bodyY + bob, 0];

  const layout = [
    { id: 'FL', side: -1, row: 0, phase: 0 }, { id: 'FR', side: 1, row: 0, phase: 0.5 },
    { id: 'ML', side: -1, row: 1, phase: 0.5 }, { id: 'MR', side: 1, row: 1, phase: 0 },
    { id: 'RL', side: -1, row: 2, phase: 0 }, { id: 'RR', side: 1, row: 2, phase: 0.5 },
  ];
  const legs = [];
  for (const item of layout) {
    const p = (phase + item.phase) % 1, path = footTarget(p, controls.stride);
    const foot = [item.side * D.footX, path.y, D.footZ[item.row] + path.z];
    const footLocal = sub(foot, offset);
    const ankle = add(footLocal, D.ankleLift);
    const hip = [item.side * D.hipX, D.hipY, D.hipZ[item.row]];
    const solved = solveTwoLink(hip, ankle, D.femur, D.tibia, [item.side * 0.18, 0, item.row === 0 ? -1 : item.row === 2 ? 1 : .2]);
    const kneeAngle = Math.acos(clamp((D.femur ** 2 + D.tibia ** 2 - distance(hip, ankle) ** 2) / (2 * D.femur * D.tibia), -1, 1, 1));
    legs.push({ id: item.id, side: item.side, row: item.row, phase: p, stance: path.stance, foot, footLocal, hip, knee: solved.knee, ankle, metatarsus: sub(footLocal, ankle), kneeAngle });
  }

  const display = 1 + 0.16 * Math.sin(2 * a + 0.6);
  const head = {
    origin: D.headOrigin, yaw: 0.05 * Math.sin(a + 0.3), pitch: 0.02 * Math.sin(2 * a),
    roll: 0.018 * Math.sin(a + 1.2), jaw: controls.gape * Math.PI / 180 * display,
    scan: 0.05 * Math.sin(a + 0.3),
  };
  const mandibles = [-1, 1].map(side => {
    const links = [], points = [[side * D.mandibleBase[0], D.mandibleBase[1], D.mandibleBase[2]]];
    for (let i = 0; i < 3; i++) {
      const open = controls.gape * Math.PI / 180 * display;
      const yaw = side * (i === 0 ? 0.24 + open * 0.9 : i === 1 ? 0.04 + open * 0.3 : -0.38 + 0.05 * Math.sin(a + side * 0.4));
      const rise = i === 0 ? 0.14 : i === 1 ? 0.02 : -0.10;
      const direction = unit([Math.sin(yaw), rise, -Math.cos(yaw)]);
      const start = points[i], end = add(start, mul(direction, D.mandibleLengths[i]));
      links.push({ index: i, start, end, yaw });
      points.push(end);
    }
    return { side, links, points };
  });

  const antennae = [-1, 1].map(side => {
    const sweep = controls.antenna * Math.PI / 180, points = [[side * D.antennaBase[0], D.antennaBase[1], D.antennaBase[2]]], links = [];
    for (let i = 0; i < D.antennaCount; i++) {
      const yaw = side * (0.36 + sweep + i * 0.06) + 0.10 * Math.sin(a + side * 0.5 - i * 0.3);
      const pitch = 0.18 + i * 0.11 + 0.06 * Math.sin(2 * a - i * 0.42 + side * 0.35);
      const direction = unit([Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]);
      const start = points[i], end = add(start, mul(direction, D.antennaLink));
      links.push({ index: i, start, end, yaw, pitch });
      points.push(end);
    }
    return { side, links, points };
  });

  const abdomen = [], abdomenPoints = [D.abdomenBase];
  for (let i = 0; i < D.abdomenCount; i++) {
    const pitch = -0.02 + i * 0.018 + 0.02 * Math.sin(2 * a - i * 0.4);
    const yaw = 0.035 * Math.sin(a - i * 0.5);
    const direction = unit([Math.sin(yaw), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)]);
    const start = abdomenPoints[i], end = add(start, mul(direction, D.abdomenLink));
    abdomen.push({ index: i, start, end });
    abdomenPoints.push(end);
  }

  const residual = Math.max(
    ...legs.map(leg => Math.max(Math.abs(distance(leg.hip, leg.knee) - D.femur), Math.abs(distance(leg.knee, leg.ankle) - D.tibia), Math.abs(distance(leg.ankle, leg.footLocal) - Math.hypot(...D.ankleLift)))),
    ...mandibles.flatMap(m => m.links.map((link, i) => Math.abs(distance(link.start, link.end) - D.mandibleLengths[i]))),
    ...antennae.flatMap(m => m.links.map(link => Math.abs(distance(link.start, link.end) - D.antennaLink))),
    ...abdomen.map(link => Math.abs(distance(link.start, link.end) - D.abdomenLink)),
  );
  return {
    driveAngle: a, phase, controls, body: { offset, bob, sway }, legs, head, mandibles, antennae,
    abdomen: { links: abdomen, points: abdomenPoints },
    elytra: {
      angle: controls.elytra * Math.PI / 180, flutter: 0.045 * Math.sin(2 * a + 0.35),
      liftWave: 0.030 * Math.sin(a + 0.9), pitch: 0.05 * Math.sin(a + 2.1),
    },
    mouth: {
      jaw: controls.gape * Math.PI / 180 * display,
      palp: 0.10 * Math.sin(2 * a + 0.4), maxilla: 0.07 * Math.sin(a - 0.8),
    },
    metrics: {
      cadenceHz: controls.cadence, strideMm: controls.stride * 1000, gapeDeg: controls.gape, elytraDeg: controls.elytra,
      contacts: legs.filter(leg => leg.stance).length, jawMm: D.mandibleLengths.reduce((s, v) => s + v, 0) * 1000,
      linkResidualMm: residual * 1000,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
