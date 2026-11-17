export const DESIGN = Object.freeze({
  name: 'ARACHNE', model: 'SC–08',
  coxa: 0.13, femur: 0.53, tibia: 0.66, tarsus: 0.13,
  hipX: 0.24, hipZ: [0.48, 0.18, -0.18, -0.48],
  footX: [1.01, 1.18, 1.18, 1.01], footZ: [0.95, 0.37, -0.37, -0.95],
  motorTeeth: 12, outputTeeth: 36, duty: 0.62,
});
export const DEFAULT_INPUT = Object.freeze({ cadence: 0.55, stride: 0.26, clearance: 0.16, height: 0.82, direction: 1 });
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const fract = x => ((x % 1) + 1) % 1;
const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, k) => a.map(v => v * k);
export const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const smooth = t => t * t * (3 - 2 * t);

export function footTrajectory(phase, stride, clearance, duty = DESIGN.duty) {
  const p = fract(phase);
  if (p < duty) return { z: stride * (0.5 - p / duty), lift: 0, stance: true };
  const u = (p - duty) / (1 - duty);
  const slope = -stride * (1 - duty) / duty;
  const z = (2 * u ** 3 - 3 * u ** 2 + 1) * -stride / 2
    + (u ** 3 - 2 * u ** 2 + u) * slope
    + (-2 * u ** 3 + 3 * u ** 2) * stride / 2
    + (u ** 3 - u ** 2) * slope;
  return { z, lift: clearance * Math.sin(Math.PI * u) ** 2, stance: false };
}

export function solveLeg(hip, ankle, side) {
  const dx = ankle[0] - hip[0], dz = ankle[2] - hip[2];
  const radial = Math.hypot(dx, dz);
  const axis = [dx / radial, 0, dz / radial];
  const coxa = add(hip, scale(axis, DESIGN.coxa));
  const r = radial - DESIGN.coxa, dy = ankle[1] - coxa[1];
  const d = Math.hypot(r, dy);
  if (d > DESIGN.femur + DESIGN.tibia || d < Math.abs(DESIGN.femur - DESIGN.tibia)) {
    throw new RangeError('Foot target is outside the physical leg workspace');
  }
  const alpha = Math.atan2(dy, r);
  const beta = Math.acos(clamp((DESIGN.femur ** 2 + d ** 2 - DESIGN.tibia ** 2) / (2 * DESIGN.femur * d), -1, 1));
  const theta = alpha + beta;
  const knee = add(coxa, add(scale(axis, DESIGN.femur * Math.cos(theta)), [0, DESIGN.femur * Math.sin(theta), 0]));
  const kneeInternal = Math.acos(clamp((DESIGN.femur ** 2 + DESIGN.tibia ** 2 - d ** 2) / (2 * DESIGN.femur * DESIGN.tibia), -1, 1));
  return { coxa, knee, joints: { yaw: Math.atan2(dz, dx * side), hip: theta, knee: Math.PI - kneeInternal } };
}

export function convexHull(points) {
  const p = points.map(([x, , z]) => [x, z]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = pts => {
    const h = [];
    for (const q of pts) {
      while (h.length >= 2 && cross(h.at(-2), h.at(-1), q) <= 0) h.pop();
      h.push(q);
    }
    return h;
  };
  const lower = half(p), upper = half([...p].reverse());
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export function sampleSpider(t, input = {}) {
  const cfg = { ...DEFAULT_INPUT, ...input };
  const cycle = t * cfg.cadence;
  const phase = fract(cycle);
  const bob = 0.009 * Math.cos(4 * Math.PI * phase);
  const pitch = 0.008 * Math.sin(2 * Math.PI * phase);
  const roll = 0.008 * Math.sin(4 * Math.PI * phase);
  const body = { position: [0, cfg.height + bob, 0], pitch, roll };
  const transformHip = (x, z) => [x, body.position[1] + x * Math.sin(roll) - z * Math.sin(pitch), z];
  const legs = [];
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
    const p = fract(phase + ((row + (side === 1 ? 1 : 0)) % 2) * 0.5);
    const path = footTrajectory(p, cfg.stride, cfg.clearance);
    const foot = [side * DESIGN.footX[row], path.lift, DESIGN.footZ[row] + path.z * cfg.direction];
    const ankle = add(foot, [0, DESIGN.tarsus, 0]);
    const hip = transformHip(side * DESIGN.hipX, DESIGN.hipZ[row]);
    const { coxa, knee, joints } = solveLeg(hip, ankle, side);
    const mountA = add(coxa, scale(knee.map((v, i) => v - coxa[i]), 0.23));
    const mountB = add(knee, scale(ankle.map((v, i) => v - knee[i]), 0.37));
    legs.push({ id: `${side < 0 ? 'L' : 'R'}${row + 1}`, side, row, hip, coxa, knee, ankle, foot, phase: p, stance: path.stance, joints, actuatorLength: distance(mountA, mountB) });
  }
  const contact = legs.filter(l => l.stance);
  const hull = convexHull(contact.map(l => l.foot));
  const supportArea = Math.abs(hull.reduce((a, p, i) => {
    const q = hull[(i + 1) % hull.length];
    return a + p[0] * q[1] - p[1] * q[0];
  }, 0)) / 2;
  return {
    t, phase, body, legs, driveAngle: cycle * Math.PI * 2,
    metrics: {
      contacts: contact.length, cycleSeconds: 1 / cfg.cadence,
      motorRpm: cfg.cadence * 60 * DESIGN.outputTeeth / DESIGN.motorTeeth,
      outputRpm: cfg.cadence * 60, groundSpeed: cfg.stride * cfg.cadence / DESIGN.duty,
      supportArea, maxFootLift: Math.max(...legs.map(l => l.foot[1])),
      meanActuatorLength: legs.reduce((s, l) => s + l.actuatorLength, 0) / 8,
    },
    supportHull: hull,
  };
}

export const LESSONS = [
  { title: 'One cycle. Eight coordinated legs.', short: 'The gait', system: 'locomotion', view: 'side', mode: 'solid', explode: 0, text: 'Two alternating groups of four legs move out of phase. Each foot spends 62% of its cycle on the ground, so the next group lands before the first lifts.', fact: 'A 0.50-cycle offset creates the alternating gait.' },
  { title: 'A target becomes three joint angles.', short: 'Inverse kinematics', system: 'actuation', view: 'detail', mode: 'solid', explode: 0, text: 'Choose a foot position. The hip turns toward it; the femur and tibia bend using the law of cosines. Their lengths stay fixed while the foot follows its trajectory.', fact: 'Femur 530 mm · tibia 660 mm · coxa 130 mm.' },
  { title: 'Speed becomes mechanical advantage.', short: 'The drivetrain', system: 'power', view: 'top', mode: 'xray', explode: 0.18, text: 'The illustrative 12-tooth motor pinion drives a 36-tooth output gear. The output turns at one third of motor speed, in the opposite direction. Ideal torque multiplies by three.', fact: '36 ÷ 12 = 3:1 reduction. Losses are not modeled.' },
  { title: 'The actuator follows the linkage.', short: 'Linear actuation', system: 'actuation', view: 'detail', mode: 'xray', explode: 0, text: 'As the knee flexes, the distance between its actuator mounts changes. The rod extends from the barrel to span that exact distance; it is not an independent animation.', fact: 'The live rod length comes from the same joint positions.' },
  { title: 'Stability starts at the ground.', short: 'Foot contact', system: 'locomotion', view: 'top', mode: 'solid', explode: 0, text: 'The support polygon connects the feet touching the ground. It visualizes the base of support as the legs exchange contact. This is a kinematic demonstrator, not a validated load or balance solver.', fact: 'Contact is computed from the gait, never from a prerecorded clip.' },
];
