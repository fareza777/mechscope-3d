export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ tempo: .05, reach: 1, display: .7 });
export const D = Object.freeze({ height: 1.62, length: .125, links: 8, shellRadius: .89, shellThickness: .81 });
export const TENTACLES = Object.freeze(Array.from({ length: 12 }, (_, i) => Object.freeze({ id: String(i + 1).padStart(2, '0'), angle: TAU * i / 12 })));
const clamp = (v, lo, hi, fallback) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : fallback;
export const inputsOf = (i = {}) => ({ tempo: clamp(i?.tempo, .025, .10, .05), reach: clamp(i?.reach, .65, 1.25, 1), display: clamp(i?.display, 0, 1, .7) });
export const cycleHz = input => inputsOf(input).tempo;
export const wrap = x => ((x % 1) + 1) % 1;
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export const mv = (m, v) => [0, 1, 2].map(r => m[r * 3] * v[0] + m[r * 3 + 1] * v[1] + m[r * 3 + 2] * v[2]);
export const mm = (a, b) => Array.from({ length: 9 }, (_, i) => { const r = Math.floor(i / 3) * 3, c = i % 3; return a[r] * b[c] + a[r + 1] * b[c + 3] + a[r + 2] * b[c + 6]; });
export const rx = a => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
export const ry = a => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
export const rz = a => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
const pulse = (p, centre) => ((1 + Math.cos(TAU * (p - centre))) / 2) ** 12;

export function poseAt(phase = 0, input = DEFAULT_INPUTS) {
  const p = wrap(Number.isFinite(phase) ? phase : 0), controls = inputsOf(input), a = p * TAU;
  const acts = Object.fromEntries(['drift', 'probe', 'grasp', 'jet', 'recover'].map((name, i) => [name, pulse(p, .1 + i * .2)]));
  const origin = [0, D.height, 0], bodyFrame = rx(0);
  const tentacles = TENTACLES.map(({ id, angle }, i) => {
    const c = Math.cos(angle), s = Math.sin(angle), base = [c, 0, -s, s, 0, c, 0, -1, 0];
    const root = add(origin, [.39 * c, -.13 + .33 * s, -.97]);
    let start = root, frame = base;
    const links = Array.from({ length: D.links }, (_, j) => {
      const wave = Math.sin(3 * a - j * .64 + (i % 2) * Math.PI + i * .13);
      const bend = j === 0
        ? -(.23 + .34 * acts.probe * controls.reach + .07 * controls.display) + .11 * wave
        : .035 + .12 * (1.25 - controls.reach) / .6 + .22 * acts.grasp + .055 * acts.recover + .082 * (.7 + .3 * controls.display) * wave;
      const twist = .06 * Math.sin(4 * a - j * .51 + i * .45);
      const localFrame = mm(rz(bend), rx(twist));
      frame = mm(frame, localFrame);
      const end = add(start, mv(frame, [0, D.length, 0]));
      const link = { start, end, frame, localFrame, length: D.length, radius: .065 - .03 * j / 7, bend, twist };
      start = end; return link;
    });
    return { id, root, base, links };
  });
  const rates = {
    mantle: .055 * Math.sin(6 * a) * (.55 + .45 * acts.jet),
    hood: .09 + .14 * Math.sin(2 * a) + .12 * acts.probe,
    shutters: [-1, 1].map((side, i) => .045 + controls.display * (.12 + .29 * acts.probe) + .045 * (1 + Math.sin(2 * a + i * .7))),
    eyes: [-1, 1].map(side => ({ yaw: .40 * Math.sin(2 * a + side * .8), pitch: .23 * Math.sin(3 * a + side * .5) })),
    siphon: { yaw: .38 * Math.sin(2 * a - .6), pitch: -.12 + .27 * Math.sin(3 * a) - .18 * acts.jet, valve: .32 * Math.sin(6 * a) },
    pump: Array.from({ length: 6 }, (_, i) => .065 * Math.sin(6 * a + i * TAU / 6)),
    gyro: [rx(2 * a), ry(3 * a), rz(5 * a)],
    beak: .18 + .22 * acts.grasp + .09 * (1 + Math.sin(4 * a)),
    skirts: Array.from({ length: 8 }, (_, i) => .10 * Math.sin(6 * a - i * .55) + .10 * acts.jet),
  };
  return { phase: p, controls, act: ['DRIFT', 'PROBE', 'GRASP', 'JET', 'RECOVER'][Math.min(4, Math.floor(p * 5))], acts, origin, bodyFrame, tentacles, rates,
    metrics: { cycleSeconds: 1 / controls.tempo, tentacles: 12, links: 96, reachM: distance(tentacles[0].root, tentacles[0].links.at(-1).end), pumpStrokeM: .13, displayMode: 'JET-DISPLAY HOVER' } };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, hz = cycleHz(input);
  return { t: time, ...poseAt(wrap((time % (1 / hz)) * hz), input) };
}
