// Metres, seconds, radians. A suspended shark study: rigid vertebral links and
// fin pivots are exact; fluid load, buoyancy and jaw bite force are not solved.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.34, tail: 8, gape: 10, fin: 12 });
export const D = Object.freeze({
  bodyY: 1.22, spineStart: Object.freeze([0, 1.22, -0.55]), spineLink: 0.13, spineCount: 10,
  tailLink: 0.10, tailCount: 8,
  headOrigin: Object.freeze([0, 1.34, -0.70]), jawPivot: Object.freeze([0, 1.22, -1.02]),
  finRootX: 0.34, finY: 1.08, finZ: -0.28,
  pelvicX: 0.18, pelvicY: 0.96, pelvicZ: 0.60,
});
const clamp = (v, lo, hi, fallback) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.15, 0.9, DEFAULT_INPUTS.cadence),
    tail: clamp(input?.tail, 3, 15, DEFAULT_INPUTS.tail),
    gape: clamp(input?.gape, 0, 28, DEFAULT_INPUTS.gape),
    fin: clamp(input?.fin, 0, 25, DEFAULT_INPUTS.fin),
  };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => (((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz % 1 + 1) % 1;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const unit = a => { const l = Math.hypot(...a); return l > 1e-12 ? mul(a, 1 / l) : [0, 0, 1]; };
export const distance = (a, b) => Math.hypot(...sub(a, b));

export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input);
  const phase = ((a / TAU) % 1 + 1) % 1;

  const spine = [], spinePoints = [D.spineStart];
  for (let i = 0; i < D.spineCount; i++) {
    const start = spinePoints[i], end = add(start, [0, 0, D.spineLink]);
    spine.push({ index: i, start, end });
    spinePoints.push(end);
  }
  const tail = [], tailPoints = [spinePoints[D.spineCount]];
  const tailRad = controls.tail * Math.PI / 180;
  for (let i = 0; i < D.tailCount; i++) {
    const yaw = tailRad * (0.35 + i * 0.09) * Math.sin(a - i * 0.52);
    const direction = unit([Math.sin(yaw), -0.015, Math.cos(yaw)]);
    const start = tailPoints[i], end = add(start, mul(direction, D.tailLink));
    tail.push({ index: i, start, end, yaw });
    tailPoints.push(end);
  }
  const head = {
    origin: D.headOrigin, yaw: 0.055 * Math.sin(a + 0.45), pitch: 0.018 * Math.sin(2 * a + 0.2),
    jaw: controls.gape * Math.PI / 180,
  };
  const finPitch = controls.fin * Math.PI / 180;
  const fins = [-1, 1].map(side => ({
    side, pitch: 0.08 + finPitch * Math.sin(a + (side < 0 ? 0.9 : 0)),
    root: [side * D.finRootX, D.finY, D.finZ],
  }));
  const tailTip = tailPoints[D.tailCount];
  const residual = Math.max(
    ...spine.map(link => Math.abs(distance(link.start, link.end) - D.spineLink)),
    ...tail.map(link => Math.abs(distance(link.start, link.end) - D.tailLink)),
  );
  return {
    driveAngle: a, phase, controls, spine: { links: spine, points: spinePoints }, tail: { links: tail, points: tailPoints },
    head, fins, tailFin: { origin: tailTip, yaw: tail[Math.max(0, D.tailCount - 1)].yaw },
    metrics: {
      cadenceHz: controls.cadence, tailSweepDeg: controls.tail * 2.7, jawGapeDeg: controls.gape, finPitchDeg: controls.fin,
      tailTipX: tailTip[0], spanMm: 2660, contacts: 0, linkResidualMm: residual * 1000,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
