// Metres and radians. A prescribed underwater manipulation study, not dynamics.
// No renderer, accumulated integration, collision response, or random state.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.18, curl: 0.55 });
export const LIMITS = Object.freeze({ cadence: Object.freeze([0.05, 0.45]), curl: Object.freeze([0, 1]) });
export const LENGTHS = Object.freeze([0.205, 0.19, 0.18, 0.16, 0.145, 0.13, 0.11, 0.09]);
export const RADII = Object.freeze([0.074, 0.067, 0.060, 0.054, 0.048, 0.043, 0.037, 0.032]);
export const ROOT_RADIUS = 0.355;
export const ROOT_HEIGHT = 0.91;
export const WAVE_LAG = 0.58;
export const ARM_LENGTH = LENGTHS.reduce((a, b) => a + b, 0);
const BASE_PITCH = Object.freeze([-0.60, -0.06, 0.12, 0.24, 0.31, 0.39, 0.43, 0.45]);
const add = (a, b) => a.map((v, i) => v + b[i]);
const bounded = (value, fallback, limits) => Math.max(limits[0], Math.min(limits[1], Number.isFinite(value) ? value : fallback));
export function inputsOf(input = {}) {
  return Object.fromEntries(Object.keys(DEFAULT_INPUTS).map(key => [key, bounded(input?.[key], DEFAULT_INPUTS[key], LIMITS[key])]));
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOffset = arm => (arm % 4) * TAU / 4;
export const armId = arm => `arm.${String(arm + 1).padStart(2, '0')}`;
export const segmentId = (arm, segment) => `${armId(arm)}.vertebra.${segment + 1}`;

// Quaternions are [x,y,z,w], matching Three.js without importing it.
export function multiply(a, b) {
  const [x, y, z, w] = a, [X, Y, Z, W] = b;
  return [w * X + x * W + y * Z - z * Y, w * Y - x * Z + y * W + z * X,
    w * Z + x * Y - y * X + z * W, w * W - x * X - y * Y - z * Z];
}
export function rotate(q, v) {
  const [x, y, z, w] = q, [a, b, c] = v;
  const tx = 2 * (y * c - z * b), ty = 2 * (z * a - x * c), tz = 2 * (x * b - y * a);
  return [a + w * tx + y * tz - z * ty, b + w * ty + z * tx - x * tz, c + w * tz + x * ty - y * tx];
}
export function axisRotation(axis, angle) {
  const q = [0, 0, 0, Math.cos(angle / 2)];
  q[axis === 'Y' ? 1 : 2] = Math.sin(angle / 2);
  return q;
}
export const pointInFrame = (origin, q, v) => add(origin, rotate(q, v));

export function poseAt(driveAngle, input = DEFAULT_INPUTS) {
  const inputs = inputsOf(input);
  const angle = Number.isFinite(driveAngle) ? driveAngle : 0;
  const arms = Array.from({ length: 8 }, (_, arm) => {
    const azimuth = arm * TAU / 8;
    const offset = phaseOffset(arm);
    const base = [ROOT_RADIUS * Math.cos(azimuth), ROOT_HEIGHT, ROOT_RADIUS * Math.sin(azimuth)];
    const rootQuaternion = axisRotation('Y', -azimuth);
    let position = base, orientation = rootQuaternion;
    const segments = LENGTHS.map((length, j) => {
      const wave = angle + offset - j * WAVE_LAG;
      const pitch = BASE_PITCH[j] + inputs.curl * ((j > 1 ? 0.065 : 0) + (j === 0 ? 0.035 : 0.09) * Math.sin(wave));
      const yaw = (0.025 + 0.025 * inputs.curl) * Math.sin(wave + Math.PI / 2);
      // Alternating Z→Y and Y→Z universal joints, not interchangeable Euler angles.
      const order = j % 2 === 0 ? 'ZY' : 'YZ';
      const supportQuaternion = orientation;
      const carrierQuaternion = multiply(orientation, axisRotation(order[0], order[0] === 'Z' ? pitch : yaw));
      const quaternion = multiply(carrierQuaternion, axisRotation(order[1], order[1] === 'Z' ? pitch : yaw));
      const radius = RADII[j];
      const pitchSupport = order === 'ZY' ? supportQuaternion : carrierQuaternion;
      const pitchOutput = order === 'ZY' ? carrierQuaternion : quaternion;
      const tendons = [-1, 1].map(side => {
        const start = pointInFrame(position, pitchSupport, [-0.035, side * radius * 0.70, 0]);
        const end = pointInFrame(position, pitchOutput, [0.080, side * radius * 0.70, 0]);
        return { side, start, end, length: Math.hypot(...end.map((v, k) => v - start[k])) };
      });
      const end = pointInFrame(position, quaternion, [length, 0, 0]);
      const segment = { id: segmentId(arm, j), index: j, length, radius, order, wave, pitch, yaw,
        position, supportQuaternion, carrierQuaternion, quaternion, end, tendons };
      position = end; orientation = quaternion;
      return segment;
    });
    return { id: armId(arm), azimuth, phaseOffset: offset, base, rootQuaternion, segments, tip: position,
      outputAngle: -2 * angle + arm * Math.PI / 6 };
  });
  return { arms, inputs };
}

export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0;
  const inputs = inputsOf(input);
  // Reduce time before multiplication, remaining finite even for enormous finite t.
  const period = 1 / inputs.cadence;
  const phase = (((time % period) / period) + 1) % 1;
  const driveAngle = phase * TAU;
  const pose = poseAt(driveAngle, inputs);
  const segments = pose.arms.flatMap(arm => arm.segments);
  const tips = pose.arms.map(arm => arm.tip);
  return { t: time, phase, driveAngle, ...pose, metrics: {
    motorRpm: inputs.cadence * 60, outputRpm: inputs.cadence * 120,
    cycleSeconds: period, armLength: ARM_LENGTH, rigidLinks: 64, revoluteAxes: 128,
    vacuumCups: 128, tipSpan: 2 * Math.max(...tips.map(p => Math.hypot(p[0], p[2]))),
    lowestJoint: Math.min(...segments.map(s => s.position[1]), ...tips.map(p => p[1])),
    maxPitchDegrees: Math.max(...segments.map(s => Math.abs(s.pitch))) * 180 / Math.PI,
    tendonStroke: Math.max(...segments.flatMap(s => s.tendons.map(tendon => tendon.length)))
      - Math.min(...segments.flatMap(s => s.tendons.map(tendon => tendon.length))),
    contacts: 0,
  } };
}
