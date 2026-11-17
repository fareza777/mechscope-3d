// Adapted from MIT Teardown strandbeest-shared/jansen.js and beast.js (MIT).
export const TAU = Math.PI * 2;
export const HOLY = Object.freeze({ a: 38, b: 41.5, c: 39.3, d: 40.1, e: 55.8, f: 39.4, g: 36.7, h: 65.7, i: 49, j: 50, k: 61.9, l: 7.8, m: 15 });
export const PIVOT = Object.freeze([-HOLY.a, -HOLY.l]);
export const LINKS = Object.freeze([
  ['A', 'B', 'j'], ['A', 'C', 'k'], ['P', 'B', 'b'], ['P', 'C', 'c'], ['P', 'D', 'd'],
  ['B', 'D', 'e'], ['D', 'E', 'f'], ['C', 'E', 'g'], ['E', 'F', 'h'], ['C', 'F', 'i'],
].map(Object.freeze));
export const JOINTS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'P', 'F']);
export const LAYER = Object.freeze({ j: 1, k: 1, b: -1, c: -1, d: -1, e: 0, f: 0, g: -1, h: 0, i: 1 });
export const CFG = Object.freeze({ stations: 10, spacing: 26, half: 4.2 });
// Uniform normalization: source 0.012 m/unit reduced to 0.0105 m/unit.
export const SCALE = 0.0105;
export const PAD = 2.2;
export const SOLE_TRAVEL = 1.2;
export const SAIL = Object.freeze({ mast: 30, base: 30, height: 64, chord: 52, yaw: -0.5 });
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.3 });
export const wrap = angle => ((angle % TAU) + TAU) % TAU;
export const stationZ = station => (station - (CFG.stations - 1) / 2) * CFG.spacing;
export const phaseOf = station => -station * TAU / CFG.stations;
export const legZ = (station, side) => stationZ(station) + (side ? CFG.half : -CFG.half);
export const legId = (station, side) => `leg.${String(station + 1).padStart(2, '0')}.${side ? 'R' : 'L'}`;
export function cadenceOf(input = DEFAULT_INPUTS) {
  const n = Number(input?.cadence ?? DEFAULT_INPUTS.cadence);
  return Number.isFinite(n) ? Math.max(0.08, Math.min(0.75, n)) : DEFAULT_INPUTS.cadence;
}

const hiY = (s, t) => s[1] > t[1] ? s : t;
const loY = (s, t) => s[1] < t[1] ? s : t;
const loX = (s, t) => s[0] < t[0] ? s : t;
export function circleIntersection(p0, r0, p1, r1, pick) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], D = Math.hypot(dx, dy);
  if (D < 1e-10 || D > r0 + r1 + 1e-8 || D < Math.abs(r0 - r1) - 1e-8) throw new RangeError('Unreachable Jansen circle pair');
  const A = (r0 * r0 - r1 * r1 + D * D) / (2 * D);
  const H = Math.sqrt(Math.max(0, r0 * r0 - A * A));
  const mx = p0[0] + A * dx / D, my = p0[1] + A * dy / D;
  return pick([mx + H * dy / D, my - H * dx / D], [mx - H * dy / D, my + H * dx / D]);
}
export function solveLeg(theta) {
  const { b, c, d, e, f, g, h, i, j, k, m } = HOLY;
  const A = [m * Math.cos(theta), m * Math.sin(theta)];
  const B = circleIntersection(A, j, PIVOT, b, hiY);
  const C = circleIntersection(A, k, PIVOT, c, loY);
  const D = circleIntersection(B, e, PIVOT, d, loX);
  const E = circleIntersection(D, f, C, g, loX);
  const F = circleIntersection(E, h, C, i, loY);
  return { O: [0, 0], P: [...PIVOT], A, B, C, D, E, F };
}
export function solveMirror(theta) {
  const result = solveLeg(Math.PI - theta);
  for (const key in result) result[key] = [-result[key][0], result[key][1]];
  return result;
}
export const legAt = (station, side, theta) => (side ? solveMirror : solveLeg)(theta + phaseOf(station));
const PATH = Array.from({ length: 720 }, (_, n) => solveLeg(n * TAU / 720).F);
export const FOOT_MIN = Math.min(...PATH.map(p => p[1]));
export const FOOT_MAX = Math.max(...PATH.map(p => p[1]));

// Source's weighted mean stance-velocity integration, once only. No history,
// frame integration, SVG trails, or wall-clock dependency in the sampler.
const NT = 1440;
const feetAt = angle => Array.from({ length: 20 }, (_, n) => legAt(n >> 1, n % 2, angle).F);
const MOTION = (() => {
  const X = new Float64Array(NT + 1), Y = new Float64Array(NT + 1);
  const step = TAU / NT;
  let x = 0, previousVelocity = 20;
  for (let n = 0; n <= NT; n++) {
    const a = feetAt(n * step - step / 2), b = feetAt(n * step + step / 2);
    let weight = 0, velocity = 0, low = Infinity;
    for (let j = 0; j < a.length; j++) {
      const lift = (a[j][1] + b[j][1]) / 2 - FOOT_MIN;
      const w = Math.max(0, 1 - lift / 1.2);
      low = Math.min(low, lift);
      weight += w;
      velocity += w * (b[j][0] - a[j][0]) / step;
    }
    previousVelocity = weight > 0 ? velocity / weight : previousVelocity;
    X[n] = x; Y[n] = low;
    x -= previousVelocity * step;
  }
  // Close interpolation of the vertical envelope at the cycle seam.
  Y[NT] = Y[0];
  return { X, Y, stride: X[NT] };
})();
export const STRIDE = MOTION.stride;
export function bodyAt(theta) {
  const turns = Math.floor(theta / TAU), phase = wrap(theta) / TAU;
  const u = phase * NT, n = Math.min(NT - 1, Math.floor(u)), k = u - n;
  const x = MOTION.X[n] + (MOTION.X[n + 1] - MOTION.X[n]) * k;
  return {
    x: turns * STRIDE + x,
    inPlaceX: x - phase * STRIDE,
    low: MOTION.Y[n] + (MOTION.Y[n + 1] - MOTION.Y[n]) * k,
  };
}

export function sailPoint(r, q) {
  const chord = SAIL.chord * (1 - q ** 1.35) * (0.92 + 0.08 * Math.sin(q * Math.PI));
  const u = SAIL.mast - r * chord, v = SAIL.base + q * SAIL.height - r * r * 10 * (1 - q);
  const fill = 7.5 * Math.sin(Math.PI * Math.min(1, r * 1.15)) * (0.55 + 0.45 * q);
  return [SAIL.mast + (u - SAIL.mast) * Math.cos(SAIL.yaw) - fill * Math.sin(SAIL.yaw), v,
    (u - SAIL.mast) * Math.sin(SAIL.yaw) + fill * Math.cos(SAIL.yaw)];
}

/** Metre-valued state, with source-unit joints retained for the renderer.
 * Body horizontal secular travel is removed, not the periodic stance ripple.
 * A 12.6 mm compliant shoe travel closes the source's near-ground stance band.
 * It does not alter any of the rigid linkage lengths or simulate contact forces.
 */
export function poseAt(theta = 0) {
  theta = Number.isFinite(theta) ? theta : 0;
  const drive = wrap(theta), motion = bodyAt(theta);
  let lowest = Infinity;
  const legs = Array.from({ length: 20 }, (_, n) => {
    const station = n >> 1, side = n % 2, joints = legAt(station, side, drive);
    const { F, E } = joints;
    // Same shin-aligned ellipsoid as beast.js. Analytic support point, not its centre.
    const angle = Math.atan2(F[0] - E[0], E[1] - F[1]);
    const sin = Math.sin(angle), cos = Math.cos(angle);
    const extentY = Math.hypot(3.4 * sin, PAD * cos);
    const supportX = -(3.4 ** 2 - PAD ** 2) * sin * cos / extentY;
    const bottom = F[1] - PAD * 0.25 - extentY;
    lowest = Math.min(lowest, bottom);
    return { id: legId(station, side), station, side, joints, angle, extentY, supportX, bottom };
  });
  const sourceY = -(FOOT_MIN + motion.low - PAD * 1.25);
  const padCorrection = -lowest - sourceY;
  const bodyY = sourceY + padCorrection, bodyX = motion.inPlaceX;
  for (const leg of legs) {
    const clearance = Math.max(0, leg.bottom + bodyY);
    const compliance = Math.min(clearance, SOLE_TRAVEL);
    const z = legZ(leg.station, leg.side);
    leg.stance = clearance <= SOLE_TRAVEL + 1e-9;
    leg.compliance = compliance * SCALE;
    leg.padCenter = [(leg.joints.F[0] + bodyX) * SCALE,
      (leg.joints.F[1] - PAD * 0.25 + bodyY - compliance) * SCALE, z * SCALE];
    leg.foot = [leg.padCenter[0] + leg.supportX * SCALE, Math.max(0, clearance - SOLE_TRAVEL) * SCALE, z * SCALE];
  }
  return {
    driveAngle: drive,
    phase: drive / TAU,
    body: { position: [bodyX * SCALE, bodyY * SCALE, 0], travel: motion.x * SCALE, padCorrection: padCorrection * SCALE },
    legs,
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, cadence = cadenceOf(input);
  const state = poseAt(time * cadence * TAU);
  return {
    t: time, ...state,
    metrics: {
      crankRpm: cadence * 60, cycleSeconds: 1 / cadence,
      contacts: state.legs.filter(leg => leg.stance).length,
      stride: Math.abs(STRIDE) * SCALE,
      groundSpeed: Math.abs(STRIDE) * SCALE * cadence,
      footLift: (FOOT_MAX - FOOT_MIN) * SCALE,
      bodyHeight: state.body.position[1],
      phaseSpacing: 360 / CFG.stations,
      crankRadius: HOLY.m * SCALE,
      shoeTravel: SOLE_TRAVEL * SCALE,
    },
  };
}
