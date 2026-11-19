export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ tempo: .05, stride: 1, display: .7 });
export const D = Object.freeze({ coxa: .20, upper: .64, lower: .72, sole: .065, height: .76, strides: 6, duty: .66, arm: .62, forearm: .62, palm: .34, jaw: .65, tail: Object.freeze([.22, .22, .22, .22, .21, .21, .19, .18, .17, .16, .15, .14]) });
export const LEGS = Object.freeze([-1, 1].flatMap(side => [0, 1, 2].map(station => Object.freeze({ id: `${side < 0 ? 'L' : 'R'}${station + 1}`, side, station, offset: ((station + (side > 0 ? 1 : 0)) % 2) * .5 }))));
const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
export const inputsOf = (i = {}) => ({ tempo: clamp(i?.tempo, .025, .10, .05), stride: clamp(i?.stride, .65, 1.25, 1), display: clamp(i?.display, 0, 1, .7) });
export const cycleHz = i => inputsOf(i).tempo;
export const wrap = x => ((x % 1) + 1) % 1;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const mul = (a, k) => a.map(v => v * k);
export const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const distance = (a, b) => Math.hypot(...sub(a, b));
const unit = a => mul(a, 1 / Math.hypot(...a));
export const mv = (m, v) => [dot(m.slice(0, 3), v), dot(m.slice(3, 6), v), dot(m.slice(6, 9), v)];
const mm = (a, b) => Array.from({ length: 9 }, (_, i) => { const r = Math.floor(i / 3), c = i % 3; return a[r * 3] * b[c] + a[r * 3 + 1] * b[c + 3] + a[r * 3 + 2] * b[c + 6]; });
const rx = a => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
const ry = a => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
const rz = a => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const basis = (x, y, z) => [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
export function memberFrame(a, b, normal = [1, 0, 0]) {
  const y = unit(sub(b, a)), x = unit(sub(normal, mul(y, dot(y, normal))));
  return basis(x, y, cross(x, y));
}
export function solveLeg(a, b, upper = D.upper, lower = D.lower) {
  const d = distance(a, b);
  if (!(d > Math.abs(upper - lower) && d < upper + lower)) throw new RangeError('LEVIATHAN leg target is outside its rigid reach');
  const axis = unit(sub(b, a)), pole = unit(sub([0, 1, 0], mul(axis, axis[1])));
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const knee = add(add(a, mul(axis, along)), mul(pole, Math.sqrt(upper * upper - along * along)));
  return { knee, normal: unit(cross(axis, pole)), reach: d };
}
const smooth = x => { const q = Math.max(0, Math.min(1, x)); return q * q * q * (q * (q * 6 - 15) + 10); };
const window = (p, a, b, c, d) => smooth((p - a) / (b - a)) * (1 - smooth((p - c) / (d - c)));
export const travelAt = (p, stride = 1) => -.42 * stride * Math.sin(TAU * p);
const heading = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];

export function poseAt(phase = 0, input = DEFAULT_INPUTS) {
  const p = wrap(Number.isFinite(phase) ? phase : 0), controls = inputsOf(input), f = controls.display, angle = TAU * p;
  const display = window(p, .14, .22, .36, .44), grasp = window(p, .36, .43, .54, .62), row = window(p, .55, .64, .83, .93);
  const act = display > .5 ? 'DISPLAY' : grasp > .5 ? 'GRASP' : row > .5 ? 'ROW' : p > .9 ? 'RECOVER' : 'STALK';
  const bodyFrame = mm(ry(.025 * Math.sin(angle * 2)), mm(rx(.025 * Math.sin(angle * 3) + .055 * display), rz(.02 * Math.sin(angle * 6))));
  const origin = [.025 * Math.sin(angle * 6), D.height + .018 * Math.cos(angle * 12) + .05 * display, travelAt(p, controls.stride)];
  const world = v => add(origin, mv(bodyFrame, v));
  const legs = LEGS.map(l => {
    const z = -.48 + l.station * .47, root = world([l.side * .65, -.07, z]);
    const q = D.strides * p + l.offset, step = Math.floor(q), gp = q - step, stance = gp < D.duty;
    const contact = k => travelAt((k + D.duty / 2 - l.offset) / D.strides, controls.stride) + z + (l.station - 1) * .16;
    const u = stance ? 0 : (gp - D.duty) / (1 - D.duty), blend = smooth(u);
    const foot = [l.side * (1.33 + (l.station === 1 ? .12 : 0)), D.sole + (stance ? 0 : .24 * Math.sin(Math.PI * u) ** 2), contact(step) * (1 - blend) + contact(step + 1) * blend];
    const outward = unit([foot[0] - root[0], 0, foot[2] - root[2]]), hip = add(root, mul(outward, D.coxa));
    const ankle = add(foot, [0, .095, 0]);
    const { knee, normal, reach } = solveLeg(hip, ankle);
    const upperFrame = memberFrame(hip, knee, normal), lowerFrame = memberFrame(knee, ankle, normal);
    const a = add(hip, mv(upperFrame, [0, D.upper * .55, .085])), b = add(knee, mv(lowerFrame, [0, D.lower * .32, .06]));
    return { ...l, phase: gp, stance, step, root, hip, knee, ankle, foot, normal, reach, frames: { coxa: memberFrame(root, hip, normal), upper: upperFrame, lower: lowerFrame }, ram: { a, b, length: distance(a, b) } };
  });
  const claws = [-1, 1].map((side, i) => {
    const sweep = .55 + .33 * display * f - .20 * grasp + .10 * Math.sin(angle * 2 + i * .9);
    const root = world([side * .57, .04, -.59]);
    const elbow = add(root, mv(bodyFrame, mul(heading(side * sweep, .10 + .50 * display * f + .12 * Math.sin(angle * 2 + i)), D.arm)));
    const wrist = add(elbow, mv(bodyFrame, mul(heading(side * (.16 + .25 * display - .22 * grasp), .02 + .20 * display + .15 * Math.sin(angle * 3 + i)), D.forearm)));
    const palmEnd = add(wrist, mv(bodyFrame, mul(heading(side * (.08 + .22 * Math.sin(angle * 2 + i)), -.08 + .25 * display), D.palm)));
    const normal = mv(bodyFrame, [Math.cos(side * sweep), 0, Math.sin(side * sweep)]);
    const frame = memberFrame(wrist, palmEnd, normal);
    const aperture = .18 + (.19 + .28 * f) * (.5 + .5 * Math.sin(angle * 3 + i * .8)) + .25 * display * f - .10 * grasp;
    const a = add(root, mv(bodyFrame, [side * .035, .11, .05])), b = add(elbow, mul(sub(wrist, elbow), .30));
    return { side, root, elbow, wrist, palmEnd, aperture, frames: { upper: memberFrame(root, elbow, normal), lower: memberFrame(elbow, wrist, normal), palm: frame }, ram: { a, b, length: distance(a, b) } };
  });
  const paddles = [-1, 1].map((side, i) => {
    const stroke = angle * 4 + i * .65, sweep = .56 * Math.sin(stroke) * (.45 + .55 * row);
    const root = world([side * .60, -.045, .51]);
    const elbow = add(root, mv(bodyFrame, mul(unit([side * .53, .08 + .10 * Math.cos(stroke), .24 + .17 * Math.sin(stroke)]), .60)));
    const end = add(elbow, mv(bodyFrame, mul(unit([side * (.47 + .12 * Math.cos(sweep)), .10 + .13 * Math.sin(stroke), .30 + sweep * .36]), .62)));
    return { side, root, elbow, end, frames: { upper: memberFrame(root, elbow, mv(bodyFrame, [0, 0, 1])), lower: memberFrame(elbow, end, mv(bodyFrame, [0, 0, 1])) }, feather: .48 * Math.sin(stroke + .8), fan: .18 + .17 * (.5 + .5 * Math.cos(stroke)) };
  });
  let tailPoint = world([0, .015, .61]), tailMatrix = mm(bodyFrame, ry(Math.PI));
  const tail = D.tail.map((length, i) => {
    const yaw = (.025 + .018 * i) * (.6 + .4 * f) * Math.sin(angle * 2 - i * .36) + .035 * display;
    const pitch = (i === 0 ? .07 : -.004) + .018 * Math.sin(angle * 3 - i * .40) + .014 * row;
    tailMatrix = mm(tailMatrix, mm(ry(yaw), rx(pitch)));
    const end = add(tailPoint, mul(mv(tailMatrix, [0, 0, -1]), length));
    const frame = basis(mv(tailMatrix, [1, 0, 0]), mv(tailMatrix, [0, 0, -1]), mv(tailMatrix, [0, 1, 0]));
    const segment = { start: tailPoint, end, length, frame, yaw, pitch }; tailPoint = end; return segment;
  });
  const rates = {
    shaft: angle * 6, gears: [angle * 6, -angle * 6, angle * 6], gyro: [angle * 2, angle * 3, angle * 5],
    panels: .08 + .20 * display * f + .045 * (1 + Math.sin(angle * 5)),
    eyes: [-1, 1].map(s => ({ yaw: .3 * Math.sin(angle * 2 + s * .7), pitch: .12 * Math.sin(angle * 3 + s) })),
    gills: Array.from({ length: 10 }, (_, i) => .16 + .16 * Math.sin(angle * 8 - i * .45)),
    mouth: Array.from({ length: 6 }, (_, i) => .16 + .22 * (.5 + .5 * Math.sin(angle * 6 + i * .8))),
    telson: .20 * Math.sin(angle * 2 - 3), pump: Array.from({ length: 4 }, (_, i) => .075 * Math.sin(angle * 6 + i * Math.PI / 2)),
  };
  return { phase: p, controls, act, acts: { display, grasp, row }, origin, bodyFrame, legs, claws, paddles, tail, rates,
    metrics: { supportFeet: legs.filter(l => l.stance).length, travelM: origin[2], travelSpanM: .84 * controls.stride, tailYawDeg: tail.reduce((sum, s) => sum + s.yaw, 0) * 180 / Math.PI, jawApertureDeg: claws[0].aperture * 180 / Math.PI, cycleSeconds: 1 / controls.tempo } };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, hz = cycleHz(input);
  return { t: time, ...poseAt(wrap((time % (1 / hz)) * hz), input) };
}
