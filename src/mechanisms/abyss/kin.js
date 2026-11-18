// Metres, seconds, radians. A supported mechanical shark study: every axial
// link is a rigid serial member, the lateral wave is prescribed, and no fluid,
// buoyancy, bite-force or free-swimming claim is made.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.34, tail: 8, gape: 10, fin: 12 });
export const D = Object.freeze({
  bodyY: 1.24, spineStart: Object.freeze([0, 1.24, -0.55]), spineLink: 0.105, spineCount: 14,
  tailLink: 0.09, tailCount: 6,
  headOrigin: Object.freeze([0, 1.24, -0.55]), jawPivot: Object.freeze([0, 0.155, -0.30]),
  finRootX: 0.20, finY: 1.19, finZ: -0.13,
  pelvicX: 0.10, pelvicY: 1.10, pelvicZ: 0.40,
  dorsalZ: -0.55 + 6 * 0.105 + 0.045, gillStations: Object.freeze([4, 5, 6, 7, 8]),
  widths: Object.freeze([0.105, 0.135, 0.155, 0.165, 0.165, 0.155, 0.148, 0.138, 0.126, 0.114, 0.102, 0.090, 0.078, 0.066]),
  heights: Object.freeze([0.125, 0.160, 0.180, 0.190, 0.185, 0.175, 0.165, 0.152, 0.138, 0.124, 0.110, 0.096, 0.083, 0.071]),
  tailWidths: Object.freeze([0.060, 0.054, 0.048, 0.042, 0.036, 0.030]),
  tailHeights: Object.freeze([0.064, 0.058, 0.052, 0.046, 0.040, 0.034]),
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
// Local basis for a YXZ joint rotation of the link node: X is lateral, Y is the
// shell-up normal and Z is the rigid link axis.
export function linkBasis(yaw = 0, pitch = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return {
    side: [cy, 0, -sy],
    up: [sp * sy, cp, sp * cy],
    axial: [cp * sy, -sp, cp * cy],
  };
}
const point = (origin, basis, local) => [
  origin[0] + basis.side[0] * local[0] + basis.up[0] * local[1] + basis.axial[0] * local[2],
  origin[1] + basis.side[1] * local[0] + basis.up[1] * local[1] + basis.axial[1] * local[2],
  origin[2] + basis.side[2] * local[0] + basis.up[2] * local[1] + basis.axial[2] * local[2],
];

export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input);
  const phase = ((a / TAU) % 1 + 1) % 1;
  const wave = controls.tail * Math.PI / 180;

  // Fourteen rigid vertebral links carry a travelling lateral wave whose joint
  // amplitude grows toward the peduncle. Vertical joint ripple is small.
  const spine = [], spinePoints = [[...D.spineStart]];
  let yaw = 0, pitch = 0;
  for (let i = 0; i < D.spineCount; i++) {
    const u = i / (D.spineCount - 1);
    const gain = 0.14 + 0.86 * Math.pow(u, 1.55);
    const amp = wave * gain * 0.62;
    const yawJoint = amp * Math.sin(a - i * 0.33);
    const pitchJoint = amp * 0.16 * Math.sin(2 * a - i * 0.37 + 0.8);
    yaw += yawJoint; pitch += pitchJoint;
    const basis = linkBasis(yaw, pitch);
    const start = spinePoints[i];
    const end = add(start, mul(basis.axial, D.spineLink));
    spine.push({
      index: i, start, end, yaw, pitch, basis, yawJoint, pitchJoint, amp,
      width: D.widths[i], height: D.heights[i], length: D.spineLink,
    });
    spinePoints.push(end);
  }

  // Six further caudal links continue the same command at a shorter pitch.
  const tail = [], tailPoints = [spinePoints[D.spineCount]];
  for (let i = 0; i < D.tailCount; i++) {
    const g = D.spineCount + i;
    const amp = wave * (0.80 + 0.035 * i);
    const yawJoint = amp * Math.sin(a - g * 0.33 + 0.30);
    const pitchJoint = amp * 0.12 * Math.sin(2 * a - g * 0.33 + 1.15);
    yaw += yawJoint; pitch += pitchJoint;
    const basis = linkBasis(yaw, pitch);
    const start = tailPoints[i];
    const end = add(start, mul(basis.axial, D.tailLink));
    tail.push({
      index: i, start, end, yaw, pitch, basis, yawJoint, pitchJoint, amp,
      width: D.tailWidths[i], height: D.tailHeights[i], length: D.tailLink,
    });
    tailPoints.push(end);
  }
  const tip = tailPoints[D.tailCount];

  // Service joints between neighboring rigid links: paired rams and a copper
  // tendon span. Endpoints are derived from the real link frames.
  const rams = [], tendons = [];
  for (let j = 0; j < 7; j++) {
    const here = spine[j], next = spine[j + 1];
    for (const side of [-1, 1]) {
      const a0 = point(here.end, here.basis, [side * 0.075, -0.020, -0.025]);
      const b0 = point(next.start, next.basis, [side * 0.098, -0.020, 0.040]);
      rams.push({ joint: j, side, a: a0, b: b0, length: distance(a0, b0) });
    }
    const tSide = j % 2 ? 1 : -1;
    const ta = point(spine[j].start, spine[j].basis, [tSide * 0.048, 0.050, D.spineLink * 0.72]);
    const tb = point(spine[j + 1].start, spine[j + 1].basis, [tSide * 0.048, 0.050, D.spineLink * 0.30]);
    tendons.push({ joint: j, side: tSide, a: ta, b: tb, length: distance(ta, tb) });
  }

  const jaw = controls.gape * Math.PI / 180 * (1 + 0.10 * Math.sin(2 * a + 0.3));
  const head = {
    origin: [...D.headOrigin],
    yaw: spine[0].yaw + 0.060 * Math.sin(a + 0.62),
    pitch: spine[0].pitch * 0.5 + 0.024 * Math.sin(2 * a + 0.35),
    jaw, gape: controls.gape * Math.PI / 180,
    eyeYaw: 0.12 * Math.sin(a + 0.85), eyePitch: 0.07 * Math.sin(2 * a - 0.35),
    scan: 0.060 * Math.sin(a + 0.62),
  };
  const finPitch = controls.fin * Math.PI / 180;
  const fins = [-1, 1].map(side => ({
    side,
    root: [side * (D.widths[3] + 0.035), D.heights[3] * 0.10, D.spineStart[2] + 3 * D.spineLink + D.spineLink * 0.55],
    pitch: 0.10 + finPitch * 0.60 * Math.sin(a + (side < 0 ? 0.85 : 0)),
    roll: 0.055 * Math.sin(2 * a + side * 1.1) + finPitch * 0.12,
    blade: 0.035 * Math.sin(a + side * 0.55),
    rays: [0, 1, 2, 3].map(k => 0.045 * Math.sin(a - k * 0.63 + side * 0.42)),
  }));
  const pelvic = [-1, 1].map(side => ({ side, pitch: 0.07 + finPitch * 0.42 * Math.sin(a + side * 1.2 + 0.7) }));
  const dorsal = { pitch: 0.045 + finPitch * 0.38 * Math.sin(a + 0.45) };
  const anal = { pitch: 0.035 * Math.sin(a + 1.5) + finPitch * 0.20 };
  const tailFin = {
    origin: tip, yaw: tail.at(-1).yaw + 0.10 * Math.sin(a - 1.25),
    fork: 0.10 + 0.075 * Math.sin(a - 2.10),
    upper: 0.10 + 0.075 * Math.sin(a - 2.10),
    lower: -0.12 - 0.055 * Math.sin(a - 2.10),
  };
  const gills = D.gillStations.flatMap((station, g) => [-1, 1].map(side => ({
    side, station, index: g,
    opening: 0.10 + 0.19 * Math.sin(a - g * 0.58 + (side < 0 ? 0.25 : 0.62)),
  })));
  const residual = Math.max(
    0,
    ...spine.map(link => Math.abs(distance(link.start, link.end) - D.spineLink)),
    ...tail.map(link => Math.abs(distance(link.start, link.end) - D.tailLink)),
  );
  return {
    driveAngle: a, phase, controls, spine: { links: spine, points: spinePoints }, tail: { links: tail, points: tailPoints },
    head, fins, pelvic, dorsal, anal, tailFin, gills, rams, tendons,
    metrics: {
      cadenceHz: controls.cadence, tailSweepDeg: controls.tail * 2.7, jawGapeDeg: controls.gape,
      finPitchDeg: controls.fin, tailTipX: tip[0], tailTipY: tip[1], tailForkDeg: tailFin.fork * 180 / Math.PI,
      gillOpeningDeg: Math.max(...gills.map(gill => gill.opening)) * 180 / Math.PI,
      axialLinks: D.spineCount + D.tailCount, vertebraLinks: D.spineCount, caudalLinks: D.tailCount,
      spanMm: 2660, contacts: 0, linkResidualMm: residual * 1000,
      ramStrokeMm: Math.max(...rams.map(ram => ram.length)) * 1000,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
