export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ tempo: .05, jump: .8, display: .7 });
export const D = Object.freeze({ height: .96, sole: .055, ankle: .14, coxa: .12, duty: .68, abdomen: Object.freeze([.20, .20, .19, .18, .17, .16, .14, .12]) });
export const LEGS = Object.freeze([-1, 1].flatMap(side => [0, 1, 2].map(station => Object.freeze({ id: `${side < 0 ? 'L' : 'R'}${station + 1}`, side, station, hind: station === 2, upper: station === 2 ? .70 : .50, lower: station === 2 ? .90 : .60, offset: ((station + (side > 0 ? 1 : 0)) % 2) * .5 }))));
const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
export const inputsOf = (i = {}) => ({ tempo: clamp(i?.tempo, .025, .10, .05), jump: clamp(i?.jump, .5, 1, .8), display: clamp(i?.display, 0, 1, .7) });
export const cycleHz = i => inputsOf(i).tempo;
export const wrap = x => ((x % 1) + 1) % 1;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, k) => a.map(v => v * k);
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const distance = (a, b) => Math.hypot(...sub(a, b));
const unit = a => mul(a, 1 / Math.hypot(...a));
export const mv = (m, v) => [dot(m.slice(0, 3), v), dot(m.slice(3, 6), v), dot(m.slice(6, 9), v)];
const mm = (a, b) => Array.from({ length: 9 }, (_, i) => { const r = Math.floor(i / 3), c = i % 3; return a[r * 3] * b[c] + a[r * 3 + 1] * b[c + 3] + a[r * 3 + 2] * b[c + 6]; });
export const rx = a => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const ry = a => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const basis = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
export function memberFrame(a, b, normal = [1, 0, 0]) {
  const y = unit(sub(b, a)), x = unit(sub(normal, mul(y, dot(y, normal))));
  return basis(x, y, cross(x, y));
}
export function solveLeg(a, b, upper = .7, lower = .9, poleHint = [0, 1.8, -1]) {
  const d = distance(a, b);
  if (!(d > Math.abs(upper - lower) && d < upper + lower)) throw new RangeError('SALTUS leg target outside rigid reach annulus');
  const axis = unit(sub(b, a));
  let perpendicular = sub(poleHint, mul(axis, dot(axis, poleHint)));
  if (Math.hypot(...perpendicular) < 1e-8) perpendicular = cross(axis, Math.abs(axis[0]) < .9 ? [1, 0, 0] : [0, 0, 1]);
  const pole = unit(perpendicular), along = (upper * upper - lower * lower + d * d) / (2 * d);
  return { knee: add(add(a, mul(axis, along)), mul(pole, Math.sqrt(upper * upper - along * along))), normal: unit(cross(axis, pole)), reach: d };
}
export const smooth = x => { const q = Math.max(0, Math.min(1, x)); return q ** 3 * (q * (q * 6 - 15) + 10); };
const envelope = (p, a, b, c, d) => smooth((p - a) / (b - a)) * (1 - smooth((p - c) / (d - c)));
export const travelAt = p => .15 * Math.sin(TAU * p);
// Three integer gait turns; the clock eases to rest while all six feet are planted.
const gaitAt = p => p < .28 ? 2 * smooth(p / .28) : p < .86 ? 2 : 2 + smooth((p - .86) / .14);
export function poseAt(phase = 0, input = DEFAULT_INPUTS) {
  const p = wrap(Number.isFinite(phase) ? phase : 0), controls = inputsOf(input), a = TAU * p;
  const crouch = envelope(p, .28, .40, .44, .49), land = envelope(p, .72, .78, .81, .89);
  const air = envelope(p, .46, .53, .65, .75), flare = envelope(p, .33, .49, .71, .87);
  const u = Math.max(0, Math.min(1, (p - .46) / .29));
  const hop = .60 * controls.jump * Math.sin(Math.PI * u) ** 4;
  const origin = [0, D.height + hop - .18 * controls.jump * crouch - .14 * controls.jump * land, travelAt(p)];
  const bodyFrame = rx(.025 * Math.sin(a * 2));
  const world = v => add(origin, mv(bodyFrame, v));
  const legs = LEGS.map(l => {
    const z = [-.47, -.04, .32][l.station], root = world([l.side * .37, -.10, z]);
    const hip = add(root, mv(bodyFrame, [l.side * D.coxa, 0, 0]));
    const q = gaitAt(p) + l.offset, step = Math.floor(q), gp = q - step, walkingStance = gp < D.duty;
    const contact = k => z + (l.hind ? .23 : -.10) + .15 * Math.sin(TAU * (k + .34 - l.offset) / 3);
    const swing = walkingStance ? 0 : (gp - D.duty) / (1 - D.duty), blend = smooth(swing);
    const planted = [l.side * (l.hind ? .91 : .75), D.sole + .16 * Math.sin(Math.PI * swing) ** 4, contact(step) * (1 - blend) + contact(step + 1) * blend];
    // Prescribed body-frame airborne targets, NOT a force or ballistic solution.
    const localAir = [l.side * (l.hind ? .96 : .60), 0, l.hind ? 1.02 : z - .10];
    const airHeight = D.sole + (l.hind ? .32 * hop : hop + .28);
    // Solve local Y for the prescribed clearance, retaining body-frame X/Z.
    localAir[1] = (airHeight - origin[1] - bodyFrame[5] * localAir[2]) / bodyFrame[4];
    const target = world(localAir);
    const foot = add(mul(planted, 1 - air), mul(target, air)), ankle = add(foot, [0, D.ankle, 0]);
    const { knee, normal, reach } = solveLeg(hip, ankle, l.upper, l.lower, l.hind ? [0, 1.8, -1] : [l.side * .6, .3, -.7]);
    const upperFrame = memberFrame(hip, knee, normal), lowerFrame = memberFrame(knee, ankle, normal);
    const ra = add(hip, mv(upperFrame, [0, l.upper * .25, .07])), rb = add(knee, mv(lowerFrame, [0, l.lower * .30, .06]));
    return { ...l, root, hip, knee, ankle, foot, reach, normal, step, phase: gp, stance: walkingStance && air === 0,
      frames: { coxa: memberFrame(root, hip, normal), upper: upperFrame, lower: lowerFrame }, ram: { a: ra, b: rb, length: distance(ra, rb) } };
  });
  let end = world([0, .015, .37]), chain = bodyFrame;
  const abdomen = D.abdomen.map((length, i) => {
    const yaw = (.028 + i * .008) * Math.sin(a * 2 - i * .43), pitch = -.022 + .025 * Math.sin(a * 2 - i * .36);
    chain = mm(chain, mm(ry(yaw), rx(pitch)));
    const start = end; end = add(start, mv(chain, [0, 0, length]));
    const frame = basis(mv(chain, [1, 0, 0]), mv(chain, [0, 0, 1]), mv(chain, [0, -1, 0]));
    return { start, end, length, frame, yaw, pitch, breath: .12 + .10 * Math.sin(a * 3 - i * .5) };
  });
  const rates = {
    cover: .035 + .035 * controls.display + (1.02 + .18 * controls.display) * flare,
    wing: .08 + .24 * flare + .23 * flare * Math.sin(a * 2),
    fans: Array.from({ length: 7 }, (_, i) => .018 * i + (.18 + i * .17) * flare * (.74 + .26 * controls.display) + .025 * flare * Math.sin(a * 2 - i * .35)),
    antenna: [-1, 1].map(s => Array.from({ length: 6 }, (_, i) => ({ yaw: s * (.025 + .065 * Math.sin(a * 2 - i * .5 + s)), pitch: .08 * Math.sin(a * 3 - i * .4 + s) }))),
    jaw: [-1, 1].map(s => .18 + .20 * (.5 + .5 * Math.sin(a * 3 + s))),
    shaft: a * 4, gears: [a * 4, -a * 4, a * 4], gyro: [a * 2, a * 3, a * 5], pump: Array.from({ length: 4 }, (_, i) => .065 * Math.sin(a * 4 + i * Math.PI / 2)),
  };
  const act = p < .28 ? 'WALK' : p < .46 ? 'CROUCH' : p < .75 ? 'LEAP' : p < .86 ? 'LAND' : 'RESET';
  return { phase: p, controls, act, acts: { crouch, air, land, flare, hop }, origin, bodyFrame, legs, abdomen, rates,
    metrics: { supportFeet: legs.filter(l => l.stance).length, hopM: hop, travelM: origin[2], travelSpanM: .3, cycleSeconds: 1 / controls.tempo } };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, hz = cycleHz(input);
  return { t: time, ...poseAt(wrap((time % (1 / hz)) * hz), input) };
}
