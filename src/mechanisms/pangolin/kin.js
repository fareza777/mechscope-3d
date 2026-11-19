export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ tempo: .05, stride: 1, armour: .7 });
export const D = Object.freeze({ upper: .42, lower: .46, ankle: .10, sole: .045, height: .74, trunk: .17,
  tail: Object.freeze([.16, .15, .14, .14, .13, .13, .12, .12, .11, .10, .09, .08]), tongue: .065 });
// Non-overlapping return windows: every lifted paw has three prescribed supports.
const schedules = [
  [[.025, .065, 'walk'], [.405, .475, 'dig'], [.625, .675, 'tuck'], [.875, .905, 'recover']],
  [[.075, .115, 'walk'], [.505, .575, 'dig'], [.680, .730, 'tuck'], [.960, .995, 'recover']],
  [[.125, .165, 'walk'], [.780, .825, 'tuck'], [.840, .870, 'recover']],
  [[.175, .215, 'walk'], [.735, .775, 'tuck'], [.910, .955, 'recover']],
];
export const LEGS = Object.freeze(['FL', 'FR', 'HL', 'HR'].map((id, i) => Object.freeze({ id, side: i % 2 ? 1 : -1,
  hind: i > 1, station: i > 1 ? 1 : 6, z: i > 1 ? .41 : -.44,
  swings: Object.freeze(schedules[i].map(s => Object.freeze(s))) })));
const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
export const inputsOf = (i = {}) => ({ tempo: clamp(i?.tempo, .025, .10, .05), stride: clamp(i?.stride, .65, 1.25, 1), armour: clamp(i?.armour, 0, 1, .7) });
export const cycleHz = i => inputsOf(i).tempo;
export const wrap = p => ((p % 1) + 1) % 1;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, k) => a.map(v => v * k);
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const distance = (a, b) => Math.hypot(...sub(a, b));
const unit = a => mul(a, 1 / Math.hypot(...a));
export const mv = (m, v) => [dot(m.slice(0, 3), v), dot(m.slice(3, 6), v), dot(m.slice(6, 9), v)];
export const mm = (a, b) => Array.from({ length: 9 }, (_, i) => { const r = Math.floor(i / 3), c = i % 3; return a[r * 3] * b[c] + a[r * 3 + 1] * b[c + 3] + a[r * 3 + 2] * b[c + 6]; });
export const rx = a => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
export const ry = a => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rz = a => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const basis = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
// Member +Y points toward its endpoint, member +Z is dorsal.
export const nodeFrame = m => basis(mv(m, [1, 0, 0]), mv(m, [0, 0, -1]), mv(m, [0, 1, 0]));
export function memberFrame(a, b, normal) {
  const y = unit(sub(b, a)), x = unit(sub(normal, mul(y, dot(y, normal))));
  return basis(x, y, cross(x, y));
}
export function solveLeg(root, ankle, side = 1, hind = false) {
  const d = distance(root, ankle);
  if (!(d > Math.abs(D.upper - D.lower) && d < D.upper + D.lower)) throw new RangeError('MANIS leg target is outside rigid reach');
  const axis = unit(sub(ankle, root)), preference = [side * .17, .12, hind ? 1 : -1];
  const pole = unit(sub(preference, mul(axis, dot(axis, preference))));
  const along = (D.upper ** 2 - D.lower ** 2 + d * d) / (2 * d);
  return { knee: add(add(root, mul(axis, along)), mul(pole, Math.sqrt(D.upper ** 2 - along ** 2))), normal: unit(cross(axis, pole)), reach: d };
}
const smooth = x => { const q = Math.max(0, Math.min(1, x)); return q ** 3 * (q * (6 * q - 15) + 10); };
const window = (p, a, b, c, d) => smooth((p - a) / (b - a)) * (1 - smooth((p - c) / (d - c)));
export const travelAt = (p, stride = 1) => -.25 * stride * Math.sin(TAU * p);
export function chain(start, base, steps) {
  let p = start, m = base;
  return steps.map(({ length, yaw = 0, pitch = 0 }) => {
    m = mm(m, mm(ry(yaw), rx(pitch)));
    const end = add(p, mul(mv(m, [0, 0, -1]), length));
    const s = { start: p, end, frame: nodeFrame(m), rotation: m, length, yaw, pitch }; p = end; return s;
  });
}
function footAt(p, l, stride) {
  const events = l.swings;
  const contact = i => {
    const index = (i + events.length) % events.length, e = events[index], next = events[(index + 1) % events.length];
    const midpoint = (e[1] + next[0] + (index === events.length - 1 ? 1 : 0)) / 2;
    const tucked = e[2] === 'tuck';
    return [l.side * (tucked && !l.hind ? .47 : .55), D.sole, l.z + travelAt(midpoint, stride) + (tucked && !l.hind ? .10 : 0)];
  };
  const active = events.findIndex(e => p >= e[0] && p < e[1]);
  if (active < 0) {
    let index = events.findLastIndex(e => e[1] <= p); if (index < 0) index = events.length - 1;
    return { foot: contact(index), stance: true, step: index, stroke: 'support' };
  }
  const e = events[active], u = (p - e[0]) / (e[1] - e[0]), k = smooth(u), a = contact(active - 1), b = contact(active);
  const foot = a.map((v, i) => v + (b[i] - v) * k), lift = Math.sin(Math.PI * u) ** 2;
  foot[1] += (e[2] === 'dig' ? .24 : .12) * lift;
  if (e[2] === 'dig') foot[2] -= .16 * Math.sin(TAU * u) * lift;
  return { foot, stance: false, step: active, stroke: e[2] };
}
export function poseAt(phase = 0, input = DEFAULT_INPUTS) {
  const p = wrap(Number.isFinite(phase) ? phase : 0), controls = inputsOf(input), a = TAU * p;
  const sniff = window(p, .19, .25, .35, .41), dig = window(p, .36, .405, .575, .62), brace = window(p, .60, .70, .83, .90);
  const act = brace > .5 ? 'BRACE' : dig > .5 ? 'DIG' : sniff > .5 ? 'SNIFF' : p > .88 ? 'RECOVER' : 'WALK';
  const bodyFrame = mm(ry(.012 * Math.sin(a * 2)), rz(.014 * Math.sin(a * 4)));
  const origin = [.012 * Math.sin(a * 4), D.height - .095 * brace + .008 * Math.sin(a * 8), travelAt(p, controls.stride)];
  const world = v => add(origin, mv(bodyFrame, v));
  const arches = [.10, .045, .015, -.035, -.05, -.05, -.035, -.015];
  const trunk = chain(world([0, 0, .68]), bodyFrame, arches.map((pitch, i) => ({ length: D.trunk, pitch: pitch * (1 + brace * 1.15), yaw: .007 * Math.sin(a * 2 - i * .45) })));
  const legs = LEGS.map(l => {
    const t = trunk[l.station], root = add(t.start, mv(t.frame, [l.side * .40, D.trunk / 2, -.065]));
    const target = footAt(p, l, controls.stride), ankle = add(target.foot, [0, D.ankle, 0]);
    const { knee, normal, reach } = solveLeg(root, ankle, l.side, l.hind);
    const upper = memberFrame(root, knee, normal), lower = memberFrame(knee, ankle, normal);
    const ra = add(root, mv(upper, [.105, D.upper * .23, 0])), rb = add(knee, mv(lower, [.075, D.lower * .45, 0]));
    return { id: l.id, side: l.side, hind: l.hind, station: l.station, ...target, root, knee, ankle, reach, frames: { upper, lower }, ram: { a: ra, b: rb, length: distance(ra, rb) } };
  });
  const neck = chain(trunk.at(-1).end, trunk.at(-1).rotation, [{ length: .14, yaw: .08 * Math.sin(a * 2) + .08 * sniff, pitch: -.07 - .18 * brace + .07 * sniff * Math.sin(a * 5) }])[0];
  const headFrame = mm(neck.rotation, mm(ry(.12 * Math.sin(a * 3) + .10 * sniff), rx(-.06 - .42 * brace + .16 * sniff * Math.sin(a * 5))));
  const head = { origin: neck.end, frame: headFrame, jaw: .025 + .18 * sniff * (.5 + .5 * Math.sin(a * 7)),
    tongue: sniff * (.5 + .5 * Math.cos(a * 6)), eyes: [-1, 1].map(s => ({ yaw: .25 * Math.sin(a * 3 + s), pitch: .13 * Math.sin(a * 5 + s) })),
    ears: [-1, 1].map(s => .22 * Math.sin(a * 7 + s) + .14 * sniff) };
  const tail = chain(world([0, 0, .68]), mm(bodyFrame, ry(Math.PI)), D.tail.map((length, i) => ({ length,
    yaw: (i ? .07 + .012 * i : .30) * Math.sin(a * 2 - i * .43) + brace * (.19 + .10 * controls.armour),
    pitch: (i ? -.005 : .04) + .012 * Math.sin(a * 2 - i * .4) })));
  const rates = { scales: Array.from({ length: 56 }, (_, i) => .035 + .015 * controls.armour + .035 * Math.sin(a * 4 - Math.floor(i / 7) * .4 + i % 7 * .2) + brace * (.20 + .34 * controls.armour)),
    ribs: Array.from({ length: 8 }, (_, i) => .09 * Math.sin(a * 5 - i * .35)), drive: a * 8, flywheel: a * 12,
    pumps: [Math.sin(a * 8) * .045, Math.cos(a * 8) * .045], tailPlates: tail.map((_, i) => .07 * Math.sin(a * 3 - i * .4)) };
  return { phase: p, controls, act, acts: { sniff, dig, brace }, origin, bodyFrame, trunk, legs, neck, head, tail, rates,
    metrics: { supportFeet: legs.filter(l => l.stance).length, travelSpanM: .5 * controls.stride, cycleSeconds: 1 / controls.tempo, raisedScales: 56, tailLinks: 12 } };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, hz = cycleHz(input);
  return { t: time, ...poseAt((time % (1 / hz)) * hz, input) };
}
