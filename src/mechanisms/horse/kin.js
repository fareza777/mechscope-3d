// EQUUS H8 — deterministic mechanical dressage test in metres, seconds and radians.
// One master phase drives posture, gait, neck, tail and secondary mechanisms. No contact,
// force, balance or animal-locomotion solver; the display is a kinematic choreography.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ tempo: .045, stride: .95, head: .55 });
const TAIL = Object.freeze([.12, .11, .10, .09, .08, .07, .06, .05, .04, .04]);
export const D = Object.freeze({
  torso: Object.freeze(Array(5).fill(.22)),
  neck: Object.freeze(Array(8).fill(.075)),
  tail: TAIL,
  hind: Object.freeze({ upper: .60, lower: .56, meta: .26, heel: 1.00 }),
  fore: Object.freeze({ upper: .56, lower: .52, meta: .24, heel: .95 }),
  sole: .055, height: 1.28, zHind: .62, zFore: -.56, strides: 12, breaths: 14,
});
export const LIMBS = Object.freeze([
  Object.freeze({ id: 'FL', side: -1, hind: false, offset: .25, trotOffset: 0 }),
  Object.freeze({ id: 'FR', side: 1, hind: false, offset: .75, trotOffset: .5 }),
  Object.freeze({ id: 'HL', side: -1, hind: true, offset: 0, trotOffset: .5 }),
  Object.freeze({ id: 'HR', side: 1, hind: true, offset: .5, trotOffset: 0 }),
]);

const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
export const inputsOf = (input = {}) => ({
  tempo: clamp(input?.tempo, .025, .10, DEFAULT_INPUTS.tempo),
  stride: clamp(input?.stride, .70, 1.30, DEFAULT_INPUTS.stride),
  head: clamp(input?.head, 0, 1, DEFAULT_INPUTS.head),
});
export const cycleHz = input => inputsOf(input).tempo;

export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, k) => a.map(v => v * k);
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const unit = a => mul(a, 1 / Math.hypot(...a));
const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const mix = (a, b, k) => a + (b - a) * k;
export const wrap = x => ((x % 1) + 1) % 1;

// Row-major 3 × 3 rotations. Body frames use +X right, +Y up and -Z forward.
export const mm = (A, B) => { const C = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return C; };
export const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
const rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
export const col = (M, i) => [M[i], M[3 + i], M[6 + i]];
export const basis = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
// Rendered members are modelled along local +Y with local +Z dorsal.
export const nodeFrame = M => basis(col(M, 0), mul(col(M, 2), -1), col(M, 1));
export const toWorld = (origin, M, local) => add(origin, mv(M, local));
export function memberFrame(a, b, normal) {
  const y = unit(sub(b, a)), x = unit(sub(normal, mul(y, dot(y, normal))));
  return basis(x, y, cross(x, y));
}

const smooth = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (6 * x - 15) + 10);
const ramp = (q, a, b) => smooth((q - a) / (b - a));
const window = (q, a0, a1, b0, b1) => ramp(q, a0, a1) * (1 - ramp(q, b0, b1));

// A rigid serial chain. Each step is a relative yaw then pitch; positive pitch raises the heading.
export function chain(origin, base, steps) {
  let M = base, p = origin; const segments = [];
  for (const s of steps) {
    M = mm(M, mm(ry(s.yaw || 0), rx(s.pitch || 0)));
    const end = add(p, mul(mv(M, [0, 0, -1]), s.length));
    segments.push({ start: p, end, length: s.length, frame: nodeFrame(M) });
    p = end;
  }
  return { segments, end: p, M };
}

export function solveLimb(root, ankle, upper, lower, polePreference) {
  const d = distance(root, ankle);
  if (!(d > Math.abs(upper - lower) && d < upper + lower)) throw new RangeError(`EQUUS limb target lies outside its rigid reach: d=${d.toFixed(3)} upper=${upper} lower=${lower} root=${root.map(v=>v.toFixed(2))} ankle=${ankle.map(v=>v.toFixed(2))}`);
  const axis = unit(sub(ankle, root));
  const horizontal = Math.hypot(axis[0], axis[2]);
  const pole = horizontal > 1e-12 ? unit(sub(polePreference, mul(axis, dot(axis, polePreference)))) : [0, 1, 0];
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  return { knee: add(add(root, mul(axis, a)), mul(pole, Math.sqrt(upper * upper - a * a))), normal: unit(cross(axis, pole)), reach: d };
}

const NECK = {
  collected: [.02, -.04, -.10, -.16, -.18, -.14, -.08, -.03],
  arched: [.45, .34, .24, .15, .08, .02, -.02, -.05],
};
const ACTS = ['HALT', 'WALK', 'TROT', 'EXTEND', 'REAR', 'SETTLE'];

export function poseAt(phase = 0, input = DEFAULT_INPUTS) {
  const controls = inputsOf(input), f = controls.head, stride = controls.stride;
  const p = wrap(Number.isFinite(phase) ? phase : 0), q = wrap(p + .25);
  const walk = window(q, .02, .08, .30, .36);
  const trot = window(q, .32, .38, .50, .56);
  const extend = window(q, .52, .57, .66, .71);
  const rear = window(q, .72, .78, .86, .92);
  const settle = window(q, .92, .95, .995, 1.02);
  const activity = clamp(walk + trot + extend - rear, 0, 1);
  const gaitBlend = clamp(trot + extend, 0, 1);
  const gait = TAU * D.strides * p, breath = Math.sin(TAU * D.breaths * p);
  const act = rear > .55 ? 'REAR' : extend > .5 ? 'EXTEND' : trot > .5 ? 'TROT' : walk > .5 ? 'WALK' : settle > .5 ? 'SETTLE' : 'HALT';

  // Body: pelvis datum, walking sway, breathing lift and a raised forehand.
  const pitch = .015 + .46 * rear + .018 * activity * Math.sin(2 * gait);
  const yaw = .028 * activity * Math.sin(gait) + .025 * rear;
  const roll = .022 * activity * Math.cos(gait);
  const pelvis = [0, D.height + .012 * activity * Math.cos(2 * gait) + .018 * rear, D.zHind];
  const body = mm(ry(yaw), mm(rx(pitch), rz(roll)));
  const torso = chain(pelvis, body, D.torso.map(length => ({ length, pitch: .012 + .012 * rear, yaw: .014 * activity * Math.sin(gait - .55) })));
  const chest = torso.end, chestM = torso.M;
  const chestFrame = nodeFrame(chestM);

  // Neck and head: collected walk posture blends into a high rear arch.
  const neckBase = toWorld(chest, chestM, [0, .12, -.08]);
  const neck = chain(neckBase, chestM, NECK.collected.map((base, i) => ({
    length: D.neck[i],
    pitch: mix(base, NECK.arched[i], f) + rear * .10 + .025 * activity * Math.sin(TAU * 2 * p - i * .3),
    yaw: .045 * activity * Math.sin(TAU * 2 * p - i * .36) + .02 * rear * Math.sin(i * .4),
  })));
  const headYaw = activity * .13 * Math.sin(TAU * 2 * p + 1) - .06 * rear;
  const headPitch = -.94 + .18 * f + .12 * rear + .025 * activity * Math.sin(TAU * 3 * p);
  const headM = mm(neck.M, mm(ry(headYaw), rx(headPitch)));
  const jaw = .035 + .012 * (1 + breath) + rear * .12 * (.5 + .5 * Math.sin(TAU * 6 * p));
  const earTwitch = .06 * Math.sin(TAU * 5 * p + .7) * (activity + .5) + .035 * Math.sin(TAU * 7 * p);
  const head = {
    origin: neck.end, frame: nodeFrame(headM), yaw: headYaw, pitch: headPitch, jaw,
    ears: [-1, 1].map(side => ({ side, yaw: earTwitch * side + .04, pitch: -.10 + .06 * rear - .04 * side })),
    muzzle: toWorld(neck.end, headM, [0, .40, .015]),
    brow: toWorld(neck.end, headM, [0, .16, .07]),
  };

  // Tail: a hanging caudal chain that rises as a counterweight in the rear act.
  const tailBase = toWorld(pelvis, body, [0, .06, .20]);
  const tailM = mm(body, mm(ry(Math.PI), rx(-.62 + .20 * rear + .025 * activity)));
  const lash = .55 + .45 * f;
  const tail = chain(tailBase, tailM, D.tail.map((length, i) => ({
    length,
    pitch: .055 / 9 + (i ? .018 : 0) - .10 * rear * (i < 4 ? 1 : .5),
    yaw: (.015 + .045 * i / 9) * lash * activity * Math.sin(TAU * 4 * p - i * .42),
  })));

  const legs = LIMBS.map(limb => {
    const L = limb.hind ? D.hind : D.fore, frame = limb.hind ? body : chestM, origin = limb.hind ? pelvis : chest;
    const root = toWorld(origin, frame, limb.hind ? [limb.side * .24, -.06, .02] : [limb.side * .23, -.12, -.02]);
    const base = limb.hind ? D.zHind + .04 : D.zFore - .02;
    const offset = mix(limb.offset, limb.trotOffset, gaitBlend), duty = .80 - .04 * gaitBlend;
    const gp = wrap(D.strides * p + offset), stanceGait = gp < duty, u = stanceGait ? gp / duty : (gp - duty) / (1 - duty);
    const swing = stanceGait ? 0 : activity * Math.sin(Math.PI * u) ** 2;
    const travel = activity * .12 * stride * (1 + .35 * extend) * (stanceGait ? -Math.cos(Math.PI * u) : Math.cos(Math.PI * u));
    const stand = [limb.side * (limb.hind ? .46 : .44), D.sole, base];
    const raised = toWorld(chest, chestM, [limb.side * .16, -.46, -.50]);
    const moving = activity > .015;
    const stance = (rear > 1e-6 && !limb.hind) ? false : rear > .05 ? limb.hind : !moving || stanceGait;
    const gaitFoot = [stand[0], stance ? D.sole : D.sole + .11 * swing, base + travel];
    const foot = limb.hind ? gaitFoot : lerp(gaitFoot, raised, rear);
    const footM = ry(yaw * .35);
    const heel = L.heel + .18 * swing - .20 * rear;
    const fetlock = [foot[0], foot[1] + .11, foot[2]];
    const ankle = toWorld(fetlock, footM, [0, L.meta * Math.cos(heel), L.meta * Math.sin(heel)]);
    const pole = mv(frame, limb.hind ? [0, .2, -1] : [0, -.1, 1]);
    const { knee, normal, reach } = solveLimb(root, ankle, L.upper, L.lower, pole);
    const upperFrame = memberFrame(root, knee, normal), lowerFrame = memberFrame(knee, ankle, normal), metaFrame = memberFrame(ankle, fetlock, normal);
    const actuatorA = toWorld(origin, frame, limb.hind ? [limb.side * .17, .10, .12] : [limb.side * .16, .09, -.10]);
    const actuatorB = add(root, mv(upperFrame, [0, .46 * L.upper, limb.hind ? -.055 : .055]));
    const kneeA = add(root, mv(upperFrame, [0, .70 * L.upper, .06])), kneeB = add(knee, mv(lowerFrame, [0, .34 * L.lower, .06]));
    const kneeAngle = Math.acos(clamp(dot(unit(sub(knee, root)), unit(sub(ankle, knee))), -1, 1, 0));
    return { ...limb, phase: gp, stance, root, knee, ankle, fetlock, foot, normal, reach, heel, swing,
      frames: { upper: upperFrame, lower: lowerFrame, meta: metaFrame, foot: nodeFrame(footM) },
      actuator: { a: actuatorA, b: actuatorB, length: distance(actuatorA, actuatorB) },
      kneeActuator: { a: kneeA, b: kneeB, length: distance(kneeA, kneeB) }, kneeAngle };
  });

  const tendons = [-1, 1].map(sd => ({ a: toWorld(chest, chestM, [sd * .10, .16, .04]), b: toWorld(neck.segments[4].start, neck.segments[4].frame, [sd * .05, 0, 0]) }));
  const support = legs.filter(l => l.stance).length;
  const rates = { gears: gait, flywheel: [TAU * 3 * p, TAU * 5 * p, TAU * 7 * p], ribs: .045 + .03 * (1 + breath) * (1 + rear) };
  return {
    act, acts: { walk, trot, extend, rear, settle }, controls, pelvis, body: nodeFrame(body), chest, chestFrame,
    torso: torso.segments, neck: neck.segments, head, tail: tail.segments, legs, tendons, rates,
    metrics: {
      bodyPitchDeg: pitch * 180 / Math.PI, supportHooves: support, strideM: .24 * stride * (1 + .35 * extend),
      headHeightM: head.origin[1], cycleSeconds: 1 / controls.tempo, trotBlend: gaitBlend, rearHeight: rear,
    },
    actIndex: ACTS.indexOf(act),
  };
}

export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, hz = cycleHz(input);
  const phase = wrap((time % (1 / hz)) * hz);
  return { t: time, phase, driveAngle: phase * TAU, ...poseAt(phase, input) };
}
