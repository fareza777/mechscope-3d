// DRACONIS D6 — deterministic educational choreography in metres, seconds and radians.
// Every pose is sampled from one master phase. No contact, force, balance or aerodynamic solver.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ tempo: .05, ferocity: .75, height: .92 });
const TAIL = Object.freeze(Array.from({ length: 18 }, (_, i) => .128 * (1 - .45 * i / 17)));
export const D = Object.freeze({
  torso: Object.freeze(Array(6).fill(.17)),
  neck: Object.freeze(Array(10).fill(.115)),
  tail: TAIL,
  hind: Object.freeze({ upper: .56, lower: .60, meta: .30, heel: .50, toe: Object.freeze([.10, .075]) }),
  fore: Object.freeze({ upper: .46, lower: .50, meta: .18, heel: .28, toe: Object.freeze([.085, .065]) }),
  wing: Object.freeze({ humerus: .56, forearm: .64, spars: Object.freeze([.98, .88, .74, .58]), thumb: .16 }),
  sole: .055, barrel: .17, slats: 9, strides: 16, flaps: 14, z0: .30,
});
export const LIMBS = Object.freeze([
  Object.freeze({ id: 'FL', side: -1, hind: false, offset: .25 }), Object.freeze({ id: 'FR', side: 1, hind: false, offset: .75 }),
  Object.freeze({ id: 'HL', side: -1, hind: true, offset: 0 }), Object.freeze({ id: 'HR', side: 1, hind: true, offset: .5 }),
]);
// Actuator body-side clevis points in the pelvis or chest frame, and the moving eye in the member frame.
export const MOUNT = Object.freeze({ legBody: Object.freeze({ hind: Object.freeze([.17, .13, .24]), fore: Object.freeze([.16, .12, -.20]) }), legMember: .42, kneeUpper: .72, kneeLower: .36, wingBody: Object.freeze([.10, .10, .30]), wingMember: .30, elbowUpper: .25, elbowLower: -.12, memberZ: .075 });

const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
export const inputsOf = (input = {}) => ({
  tempo: clamp(input?.tempo, .025, .12, DEFAULT_INPUTS.tempo),
  ferocity: clamp(input?.ferocity, 0, 1, DEFAULT_INPUTS.ferocity),
  height: clamp(input?.height, .84, .98, DEFAULT_INPUTS.height),
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
const wrap = x => ((x % 1) + 1) % 1;

// Row-major 3 × 3 rotations. Body frames use +X right, +Y up and -Z forward.
export const mm = (A, B) => { const C = new Array(9); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) C[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c]; return C; };
export const mv = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
const rx = a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const rz = a => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
export const col = (M, i) => [M[i], M[3 + i], M[6 + i]];
export const basis = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
// Rendered members are modelled along local +Y with local +Z dorsal.
const nodeFrame = M => basis(col(M, 0), mul(col(M, 2), -1), col(M, 1));
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
  if (!(d > Math.abs(upper - lower) && d < upper + lower)) throw new RangeError('DRACONIS limb target lies outside its rigid reach.');
  const axis = unit(sub(ankle, root));
  const pole = unit(sub(polePreference, mul(axis, dot(axis, polePreference))));
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  return { knee: add(add(root, mul(axis, a)), mul(pole, Math.sqrt(upper * upper - a * a))), normal: unit(cross(axis, pole)), reach: d };
}

const NECK = {
  prowl: [.34, .16, .06, 0, -.06, -.10, -.12, -.12, -.10, -.06],
  roar: [.22, .16, .10, .05, 0, -.04, -.08, -.12, -.14, -.12],
  coil: [.50, .30, .10, -.15, -.30, -.35, -.25, -.05, .10, .15],
  strike: [-.04, -.02, 0, .02, .02, 0, -.02, -.02, -.04, -.04],
  coilYaw: [0, .12, .18, .10, -.05, -.15, -.15, -.05, .05, .10],
};
const ACTS = ['RISE', 'DISPLAY', 'DESCEND', 'PROWL', 'COIL', 'STRIKE'];

function wingAt(side, chest, M, deploy, flap, flapPhase, ferocity) {
  const k = deploy, W = D.wing;
  const fold = flap * .5 * (1 + Math.cos(flapPhase)) * .24;
  const elevation = mix(1.02, .10, k) + flap * (.30 + .24 * ferocity) * Math.sin(flapPhase);
  const h1 = mix(1.35, -.20, k) + fold * .4, h2 = mix(-1.45, -.30, k) + fold;
  const spread = [mix(1.62, -.16, k), mix(1.68, .28, k), mix(1.74, .70, k), mix(1.80, 1.10, k)].map((h, j) => h + fold * (1 + j * .5));
  const o = [side * Math.cos(elevation), Math.sin(elevation), 0], b = [0, 0, 1];
  const normal = mv(M, [-side * Math.sin(elevation), Math.cos(elevation), 0]);
  const dir = h => mv(M, add(mul(o, Math.cos(h)), mul(b, Math.sin(h))));
  const root = toWorld(chest, M, [side * .17, .24, .10]);
  const elbow = add(root, mul(dir(h1), W.humerus)), wrist = add(elbow, mul(dir(h2), W.forearm));
  const tips = spread.map((h, j) => add(wrist, mul(dir(h), W.spars[j])));
  const thumb = add(wrist, mul(dir(h2 - .75), W.thumb));
  const frame = (a, c) => memberFrame(a, c, cross(unit(sub(c, a)), normal));
  const anchor = toWorld(chest, M, [side * .15, .14, .92]);
  const slat = (a, c, width) => {
    const y = unit(sub(c, a)), z = unit(sub(normal, mul(y, dot(y, normal))));
    return { a, b: c, length: distance(a, c), width, frame: basis(cross(y, z), y, z) };
  };
  const panels = [];
  for (let j = 0; j < 3; j++) {
    const slats = [];
    for (let i = 0; i < D.slats; i++) {
      const f = (i + .55) / D.slats;
      slats.push(slat(add(wrist, mul(sub(tips[j], wrist), f)), add(wrist, mul(sub(tips[j + 1], wrist), f)), W.spars[j + 1] / D.slats * 1.08));
    }
    panels.push(slats);
  }
  // The inner membrane spans the arm polyline and the trailing line from body anchor to the last spar tip.
  const arm = f => f < .46 ? add(root, mul(sub(elbow, root), f / .46)) : add(elbow, mul(sub(wrist, elbow), (f - .46) / .54));
  const inner = [];
  for (let i = 0; i < D.slats; i++) {
    const f = (i + .5) / D.slats;
    inner.push(slat(arm(f), add(anchor, mul(sub(tips[3], anchor), f)), (W.humerus + W.forearm) / D.slats * 1.02));
  }
  panels.push(inner);
  const actuatorA = toWorld(chest, M, [side * MOUNT.wingBody[0], MOUNT.wingBody[1], MOUNT.wingBody[2]]);
  const humerusFrame = frame(root, elbow);
  const actuatorB = add(root, mv(humerusFrame, [0, MOUNT.wingMember * W.humerus, -MOUNT.memberZ]));
  const forearmFrame = frame(elbow, wrist);
  const elbowA = add(root, mv(humerusFrame, [0, MOUNT.elbowUpper * W.humerus, -MOUNT.memberZ * .7]));
  const elbowB = add(elbow, mv(forearmFrame, [0, MOUNT.elbowLower * W.forearm, -MOUNT.memberZ * .7]));
  return { side, root, elbow, wrist, tips, thumb, normal, elevation, anchor,
    frames: { humerus: humerusFrame, forearm: forearmFrame, spars: tips.map(t => frame(wrist, t)), thumb: frame(wrist, thumb) },
    panels, actuator: { a: actuatorA, b: actuatorB, length: distance(actuatorA, actuatorB) }, elbowActuator: { a: elbowA, b: elbowB, length: distance(elbowA, elbowB) },
    span: Math.max(...tips.map(t => Math.abs(t[0] - chest[0]))) };
}

export function poseAt(phase = 0, input = DEFAULT_INPUTS) {
  const inputs = inputsOf(input), f = inputs.ferocity, p = wrap(Number.isFinite(phase) ? phase : 0), q = wrap(p + .25);
  // Overlapping act envelopes on one shifted, wrap-free timeline.
  const rear = window(q, .01, .11, .41, .52), deploy = window(q, .05, .17, .45, .58), flap = window(q, .11, .20, .37, .45);
  const roar = window(q, .15, .23, .35, .42), walk = window(q, .58, .65, .81, .87);
  const coil = window(q, .86, .91, .91, .935), strike = window(q, .91, .935, .95, .99);
  const gait = TAU * D.strides * p, breath = Math.sin(TAU * 20 * p), flapPhase = TAU * D.flaps * p + Math.PI / 2;
  const act = rear > .5 ? (flap > .5 ? 'DISPLAY' : q < .3 ? 'RISE' : 'DESCEND') : strike > .5 ? 'STRIKE' : coil > .5 ? 'COIL' : 'PROWL';

  // Body: pelvis datum, nose-up pitch, walking sway and a lunging strike.
  const pitch = .04 + rear * (.58 + .08 * f) - .05 * strike * f;
  const yaw = walk * .05 * Math.sin(gait) + coil * .06 * f, roll = walk * .035 * Math.cos(gait);
  const pelvis = [0, inputs.height - .10 * rear + .012 * walk * Math.cos(2 * gait), -(D.z0 + .08 * rear - .16 * strike * f)];
  const body = mm(ry(Math.PI + yaw), mm(rx(pitch), rz(roll)));
  const torso = chain(pelvis, body, D.torso.map(length => ({ length, pitch: -.012 + .05 * rear, yaw: walk * .03 * Math.sin(gait - .6) })));
  const chest = torso.end, chestM = torso.M;

  // Neck, head and jaw blend four named postures; coil and strike overlap only while releasing.
  const neckBase = toWorld(chest, chestM, [0, .12, -.10]);
  const neck = chain(neckBase, chestM, NECK.prowl.map((pp, i) => ({
    length: D.neck[i],
    pitch: pp + rear * (NECK.roar[i] - pp) + coil * (NECK.coil[i] - pp) + strike * (NECK.strike[i] - pp),
    yaw: walk * .06 * Math.sin(TAU * 3 * p - i * .3) + coil * f * NECK.coilYaw[i] - yaw / 10,
  })));
  const headYaw = walk * .26 * Math.sin(TAU * 3 * p + 1) - coil * .12 * f;
  const headPitch = -.06 + rear * (.30 + .10 * Math.sin(TAU * 7 * p)) - .08 * strike + .10 * coil;
  const headM = mm(neck.M, mm(ry(headYaw), rx(headPitch)));
  const jaw = .07 + .025 * (1 + breath) + roar * (.18 + .42 * f) * (.9 + .1 * Math.sin(TAU * 40 * p)) + coil * (1 - strike) * .48 * f;
  const head = { origin: neck.end, frame: nodeFrame(headM), yaw: headYaw, pitch: headPitch, jaw, frill: .15 + .85 * Math.max(rear, coil) * (.35 + .65 * f),
    snout: toWorld(neck.end, headM, [0, -.06, -.69]) };

  // Tail elevation is specified mostly in world terms so rearing does not drive it into the floor.
  const tailBase = toWorld(pelvis, body, [0, .03, .24]);
  const tailM = mm(body, mm(ry(Math.PI), rx(-.44 + (pitch - .04) + .22 * rear)));
  const lash = (.45 + .55 * f) * (1 + .8 * (rear + coil));
  const tail = chain(tailBase, tailM, D.tail.map((length, i) => ({
    length,
    pitch: (i ? .60 / 17 : 0) + coil * f * (i > 8 ? .07 : -.02),
    yaw: (.018 + .042 * i / 17) * lash * Math.sin(TAU * 6 * p - i * .45),
  })));

  const legs = LIMBS.map(limb => {
    const L = limb.hind ? D.hind : D.fore, frame = limb.hind ? body : chestM, origin = limb.hind ? pelvis : chest;
    const root = toWorld(origin, frame, limb.hind ? [limb.side * .27, -.07, .02] : [limb.side * .25, -.12, .04]);
    const gp = wrap(D.strides * p + limb.offset), stanceGait = gp < .75, u = stanceGait ? gp / .75 : (gp - .75) / .25;
    const swing = stanceGait ? 0 : walk * Math.sin(Math.PI * u) ** 2;
    const travel = walk * .13 * (stanceGait ? -Math.cos(Math.PI * u) : Math.cos(Math.PI * u));
    const ground = [-limb.side * (limb.hind ? .49 : .46), D.sole + .11 * swing, -((limb.hind ? D.z0 + .04 : D.z0 - 1.0) + travel)];
    const raise = limb.hind ? 0 : rear;
    const raised = toWorld(chest, chestM, [limb.side * .11, -.50, -.34]);
    const foot = lerp(ground, raised, raise);
    const footM = mm(ry(Math.PI + yaw * .5), rx(raise * .35)); // toes follow the performer heading
    const heel = L.heel + .45 * swing - .15 * raise;
    const ankle = toWorld(foot, footM, [0, L.meta * Math.cos(heel), L.meta * Math.sin(heel)]);
    const pole = mv(body, limb.hind ? [0, .2, -1] : [0, -.1, 1]);
    const { knee, normal, reach } = solveLimb(root, ankle, L.upper, L.lower, pole);
    const upperFrame = memberFrame(root, knee, normal);
    const actuatorA = toWorld(origin, frame, [limb.side * MOUNT.legBody[limb.hind ? 'hind' : 'fore'][0], ...MOUNT.legBody[limb.hind ? 'hind' : 'fore'].slice(1)]);
    const actuatorB = add(root, mv(upperFrame, [0, MOUNT.legMember * L.upper, (limb.hind ? -1 : 1) * MOUNT.memberZ]));
    const lowerFrame = memberFrame(knee, ankle, normal), z = MOUNT.memberZ;
    const kneeA = add(root, mv(upperFrame, [0, MOUNT.kneeUpper * L.upper, z])), kneeB = add(knee, mv(lowerFrame, [0, MOUNT.kneeLower * L.lower, z]));
    const curl = .36 * swing + .62 * raise;
    const toes = [-1, 0, 1].map(k => chain(toWorld(foot, footM, [k * .055, 0, -.055 + Math.abs(k) * .02]), mm(footM, ry(-k * .32)),
      [{ length: L.toe[0], pitch: -curl }, { length: L.toe[1], pitch: -curl * 1.25 }]));
    const kneeAngle = Math.acos(clamp(dot(unit(sub(knee, root)), unit(sub(ankle, knee))), -1, 1, 0));
    return { ...limb, phase: gp, stance: swing === 0 && raise === 0, root, knee, ankle, foot, normal, reach, heel, curl,
      frames: { upper: upperFrame, lower: lowerFrame, meta: memberFrame(ankle, foot, normal), foot: nodeFrame(footM) },
      toes: toes.map(t => t.segments), actuator: { a: actuatorA, b: actuatorB, length: distance(actuatorA, actuatorB) },
      kneeActuator: { a: kneeA, b: kneeB, length: distance(kneeA, kneeB) }, kneeAngle };
  });

  const wings = [-1, 1].map(side => wingAt(side, chest, chestM, deploy, flap, flapPhase, f));
  const tendons = [-1, 1].map(side => ({ a: toWorld(chest, chestM, [side * .10, .20, .06]), b: toWorld(neck.segments[4].start, neck.segments[4].frame, [side * .05, 0, 0]) }));
  const crest = .25 + .75 * Math.max(rear, coil * .8) * (.4 + .6 * f);
  const rates = { gyro: [TAU * 4 * p, TAU * 6 * p, TAU * 10 * p], gearbox: gait, ribs: .05 + .035 * (1 + breath) * (1 + rear) };
  const support = legs.filter(l => l.stance).length;
  return { act, acts: { rear, deploy, flap, roar, walk, coil, strike }, pelvis, body: nodeFrame(body), chest, chestFrame: nodeFrame(chestM),
    torso: torso.segments, neck: neck.segments, head, tail: tail.segments, legs, wings, tendons, crest, rates,
    metrics: { bodyPitchDeg: pitch * 180 / Math.PI, wingSpanM: wings[1].span + wings[0].span, jawOpenDeg: jaw * 180 / Math.PI, headHeightM: head.snout[1], supportFeet: support, cycleSeconds: 1 / inputs.tempo },
    actIndex: ACTS.indexOf(act) };
}

export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, hz = cycleHz(input);
  const phase = wrap((time % (1 / hz)) * hz);
  return { t: time, phase, driveAngle: phase * TAU, ...poseAt(phase, input) };
}
