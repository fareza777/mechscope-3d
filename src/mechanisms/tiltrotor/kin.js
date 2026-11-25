// Metres, seconds, radians. A tilt-rotor aircraft study: one master phase
// drives wing stow, nacelle conversion, blade fold, rotor spin, swashplate,
// landing gear, ramp, hoist and a short flight. Aerodynamics, thrust, mass,
// engine power and flight control laws are not simulated.
export const TAU = Math.PI * 2;
export const DEFAULT_INPUTS = Object.freeze({ cadence: 0.045, rotor: 3.2, hover: 1.0, bank: 12, collective: 12 });
export const D = Object.freeze({
  wingPivot: Object.freeze([0, 1.06, 0.10]), nacelleX: 1.25, hubHeight: 0.52, bladeCount: 3,
  hingeRadius: 0.18, bladeLength: 0.74, rotorRadius: 0.92,
  hornRadius: 0.10, hornDrop: 0.02, hornLead: 0.05, linkLength: 0.09,
  actuatorAnchor: Object.freeze([-0.20, 0.05, -0.40]), actuatorHorn: Object.freeze([-0.20, 0.22, -0.10]),
  barrelLength: 0.33, rodLength: 0.33,
  nosePivot: Object.freeze([0, 0.38, 1.12]), noseStrut: 0.29,
  mainPivot: Object.freeze([0.31, 0.36, 0.25]), mainStrut: 0.27, stroke: 0.02, wheelRadius: 0.09,
  rampHinge: Object.freeze([0, 0.27, -0.80]), rampLength: 0.66, rampClosed: 0.44, rampOpen: -Math.asin(0.25 / 0.66),
  hoistPivot: Object.freeze([0.27, 0.92, 0.60]), hoistBoom: 0.24, basketClearance: 0.30,
});
// Timeline windows on the master phase. Every window is a smoothstep, so each
// motion starts and stops with zero velocity and the loop closes exactly.
export const T = Object.freeze({
  rampClose: [0.02, 0.08], doorClose: [0.03, 0.08], unstow: [0.06, 0.14], nacelleUp: [0.13, 0.19],
  unfold: [0.18, 0.235], engineUp: [0.19, 0.25], spinUp: [0.235, 0.295], sweep: [0.20, 0.29], collectiveUp: [0.27, 0.33],
  lift: [0.29, 0.36], gearUp: [0.35, 0.41], doorOpen: [0.36, 0.39], hoistOut: [0.38, 0.41],
  cableDown: [0.41, 0.445], cableUp: [0.445, 0.48], hoistIn: [0.48, 0.505], doorShut: [0.50, 0.53],
  convert: [0.51, 0.58], climb: [0.52, 0.58], cruise: [0.57, 0.69], probeOut: [0.58, 0.61], probeIn: [0.66, 0.69],
  descend: [0.68, 0.73], reconvert: [0.68, 0.74], gearDown: [0.72, 0.77], land: [0.75, 0.82],
  collectiveDown: [0.80, 0.86], spinDown: [0.82, 0.88], engineDown: [0.84, 0.90], fold: [0.88, 0.915],
  nacelleDown: [0.91, 0.945], rampOpen: [0.93, 0.985], stow: [0.94, 0.99], doorReopen: [0.95, 0.99],
});
const clamp = (v, lo, hi, fallback = lo) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : fallback));
export const wrap = value => ((value % 1) + 1) % 1;
export const smooth = t => t * t * (3 - 2 * t);
export const win = (p, [a, b]) => smooth(clamp((p - a) / (b - a), 0, 1));
const bump = (p, [a, b]) => { const u = clamp((p - a) / (b - a), 0, 1); return Math.sin(Math.PI * u) ** 2; };
// Exact integral of a smoothstep window from 0 to p (G(u) = u^3 - u^4 / 2).
const winIntegral = (p, [a, b]) => {
  if (p <= a) return 0;
  const u = Math.min(1, (p - a) / (b - a)), G = u * u * u - u * u * u * u / 2;
  return (b - a) * G + Math.max(0, p - b);
};
const powerIntegral = (p, up, down) => winIntegral(p, up) - winIntegral(p, down);
export function inputsOf(input = {}) {
  return {
    cadence: clamp(input?.cadence, 0.03, 0.09, DEFAULT_INPUTS.cadence),
    rotor: clamp(input?.rotor, 1.5, 5, DEFAULT_INPUTS.rotor),
    hover: clamp(input?.hover, 0.7, 1.3, DEFAULT_INPUTS.hover),
    bank: clamp(input?.bank, 0, 20, DEFAULT_INPUTS.bank),
    collective: clamp(input?.collective, 8, 16, DEFAULT_INPUTS.collective),
  };
}
export const cycleHz = input => inputsOf(input).cadence;
export const phaseOf = (t, hz) => wrap(((Number.isFinite(t) ? t : 0) % (1 / hz)) * hz);
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// Rotations with the same sign conventions as three.js Object3D rotations.
export const rotX = (v, a) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
export const rotY = (v, a) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
export const rotZ = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a), v[2]];
const deg = Math.PI / 180;
const SPIN_I = powerIntegral(1, T.spinUp, T.spinDown), ENGINE_I = powerIntegral(1, T.engineUp, T.engineDown);
// Whole revolutions per cycle keep the folded blades parked at the same azimuth.
export const rotorRevolutions = input => { const c = inputsOf(input); return Math.max(4, Math.round(c.rotor * SPIN_I / c.cadence)); };

export function flightAt(phase = 0, input = DEFAULT_INPUTS) {
  const p = wrap(Number.isFinite(phase) ? phase : 0), c = inputsOf(input);
  const nacelleDeg = 90 * (win(p, T.nacelleUp) - win(p, T.convert) + win(p, T.reconvert) - win(p, T.nacelleDown));
  const stowDeg = 90 * (1 - win(p, T.unstow) + win(p, T.stow));
  const foldDeg = 90 * (1 - win(p, T.unfold) + win(p, T.fold));
  const hoverEnv = win(p, T.lift) - win(p, T.land);
  const cruiseU = clamp((p - T.cruise[0]) / (T.cruise[1] - T.cruise[0]), 0, 1);
  const roll = c.bank * deg * 1.3 * Math.sin(TAU * cruiseU) * Math.sin(Math.PI * cruiseU);
  const turn = (Math.sin(Math.PI * cruiseU) / Math.PI - Math.sin(3 * Math.PI * cruiseU) / (3 * Math.PI)) / 2;
  const yaw = -c.bank * deg * 1.6 * turn, climb = 0.25 * (win(p, T.climb) - win(p, T.descend));
  const altitude = c.hover * hoverEnv + climb + 0.025 * Math.sin(TAU * 9 * p) * hoverEnv * (1 - win(p, T.convert) + win(p, T.reconvert));
  const airplane = (1 - nacelleDeg / 90) * hoverEnv;
  return {
    phase: p, nacelleDeg, stowDeg, foldDeg, altitude, hoverEnv, airplane, roll, yaw,
    pitch: 3 * deg * airplane, x: yaw * 1.4, z: 0.25 * bump(p, T.cruise), cruiseU,
    gearDown: 1 - win(p, T.gearUp) + win(p, T.gearDown),
    ramp: 1 - win(p, T.rampClose) + win(p, T.rampOpen),
    door: 1 - win(p, T.doorClose) + win(p, T.doorOpen) - win(p, T.doorShut) + win(p, T.doorReopen),
    hoist: win(p, T.hoistOut) - win(p, T.hoistIn), cable: win(p, T.cableDown) - win(p, T.cableUp),
    probe: win(p, T.probeOut) - win(p, T.probeIn),
    collectiveEnv: win(p, T.collectiveUp) - win(p, T.collectiveDown),
    spin: win(p, T.spinUp) - win(p, T.spinDown), sweep: bump(p, T.sweep),
    sweepU: clamp((p - T.sweep[0]) / (T.sweep[1] - T.sweep[0]), 0, 1),
  };
}
export function stageOf(p) {
  const marks = [[0.06, 'STOWED'], [0.14, 'WING UNSTOW'], [0.19, 'NACELLES UP'], [0.24, 'BLADES UNFOLD'], [0.29, 'SPIN-UP'],
    [0.37, 'VERTICAL LIFT'], [0.51, 'HOVER · HOIST'], [0.58, 'CONVERSION'], [0.68, 'CRUISE'], [0.74, 'RECONVERSION'],
    [0.82, 'VERTICAL LANDING'], [0.88, 'SPIN-DOWN'], [0.915, 'BLADE FOLD'], [0.945, 'NACELLES DOWN'], [1.01, 'WING STOW']];
  return marks.find(([end]) => p < end)[1];
}

// Transform a point from the nacelle frame of one side to the airframe frame.
export function nacelleToAirframe(point, side, tilt, stow) {
  const wing = add(rotX(point, tilt), [side * D.nacelleX, 0, 0]);
  return add(rotY(wing, -stow), D.wingPivot);
}
export function airframeToWorld(point, f) {
  return add(rotY(rotX(rotZ(point, f.roll), f.pitch), f.yaw), [f.x, f.altitude, f.z]);
}

export function poseAt(angle = 0, input = DEFAULT_INPUTS) {
  const a = Number.isFinite(angle) ? angle : 0, controls = inputsOf(input), phase = wrap(a / TAU);
  const f = flightAt(phase, controls), N = rotorRevolutions(controls);
  const rotorAngle = TAU * N * powerIntegral(phase, T.spinUp, T.spinDown) / SPIN_I;
  const spoolAngle = TAU * N * 5 * powerIntegral(phase, T.engineUp, T.engineDown) / ENGINE_I;
  const rotorRps = N * controls.cadence / SPIN_I * f.spin;
  const tilt = (90 - f.nacelleDeg) * deg, stow = f.stowDeg * deg, fold = f.foldDeg * deg;
  const heli = f.collectiveEnv * f.nacelleDeg / 90;
  const collectiveDeg = f.collectiveEnv * (controls.collective + 16 * f.airplane);
  const cyclicA = 3 * Math.sin(TAU * 6 * phase) * heli, cyclicB = 2 * Math.cos(TAU * 4 * phase) * heli;
  const nacelles = [-1, 1].map(side => {
    const dir = side, base = side > 0 ? 0 : Math.PI;
    const blades = [], feet = [];
    for (let i = 0; i < D.bladeCount; i++) {
      const azimuth = base + dir * rotorAngle + i * TAU / D.bladeCount;
      const pitchDeg = collectiveDeg + cyclicA * Math.cos(azimuth) + cyclicB * Math.sin(azimuth) + side * 0.4 * f.roll / deg * heli;
      const pitch = pitchDeg * deg;
      const hornLocal = rotX([D.hornRadius, -D.hornDrop, -dir * D.hornLead], dir * pitch);
      const horn = add(rotY(hornLocal, azimuth), [0, D.hubHeight, 0]);
      const foot = sub(horn, [0, D.linkLength, 0]);
      const tipLocal = add([D.hingeRadius, 0, 0], rotZ([D.bladeLength, 0, 0], -fold));
      const tip = add(rotY(rotX(tipLocal, dir * pitch), azimuth), [0, D.hubHeight, 0]);
      blades.push({ index: i, azimuth, pitch, pitchDeg, fold, horn, foot, tip,
        tipWorld: airframeToWorld(nacelleToAirframe(tip, side, tilt, stow), f) });
      feet.push(foot);
    }
    const centre = mul(add(add(feet[0], feet[1]), feet[2]), 1 / 3);
    let normal = cross(sub(feet[1], feet[0]), sub(feet[2], feet[0]));
    const n = Math.hypot(...normal); normal = mul(normal, (normal[1] < 0 ? -1 : 1) / n);
    const anchor = [side * (D.nacelleX + D.actuatorAnchor[0]), D.actuatorAnchor[1], D.actuatorAnchor[2]];
    const hornPoint = add(rotX([side * D.actuatorHorn[0], D.actuatorHorn[1], D.actuatorHorn[2]], tilt), [side * D.nacelleX, 0, 0]);
    return {
      side, dir, tilt, rotorAngle: dir * rotorAngle, blades,
      swash: { centre, normal, tiltDeg: Math.acos(Math.min(1, normal[1])) / deg },
      actuator: { start: anchor, end: hornPoint, length: distance(anchor, hornPoint) },
      hubWorld: airframeToWorld(nacelleToAirframe([0, D.hubHeight, 0], side, tilt, stow), f),
    };
  });
  const strutExt = Math.min(f.altitude, D.stroke);
  const gear = [
    { id: 'nose', pivot: D.nosePivot, length: D.noseStrut + strutExt, retract: (1 - f.gearDown) * Math.PI / 2 },
    ...[-1, 1].map(side => ({ id: side < 0 ? 'L' : 'R', side, pivot: [side * D.mainPivot[0], D.mainPivot[1], D.mainPivot[2]],
      length: D.mainStrut + strutExt, retract: (1 - f.gearDown) * Math.PI / 2 })),
  ].map(g => ({ ...g, axle: add(g.pivot, rotX([0, -g.length, 0], g.retract)), door: Math.min(1, f.gearDown * 2.5) }));
  const rampAngle = D.rampClosed + (D.rampOpen - D.rampClosed) * f.ramp;
  const rampTip = add(D.rampHinge, rotX([0, 0, -D.rampLength], rampAngle));
  const hoistSwing = f.hoist * Math.PI / 2;
  const hoistTip = add(D.hoistPivot, [D.hoistBoom * Math.sin(hoistSwing), -0.03, D.hoistBoom * Math.cos(hoistSwing)]);
  const cableLength = 0.05 + f.cable * Math.max(0, controls.hover + D.hoistPivot[1] - 0.03 - D.basketClearance - 0.05);
  const sweepWave = Math.sin(TAU * 2 * f.sweepU) * f.sweep;
  const droop = 35 * f.nacelleDeg / 90 * (1 - f.stowDeg / 90);
  const rollDeg = f.roll / deg;
  const flaperons = { L: droop + 15 * sweepWave + 0.8 * rollDeg, R: droop - 15 * sweepWave - 0.8 * rollDeg };
  const elevatorDeg = 14 * Math.cos(TAU * 2 * f.sweepU) * f.sweep + 4 * f.airplane * Math.sin(Math.PI * f.cruiseU);
  const rudderDeg = 18 * Math.sin(TAU * 3 * f.sweepU) * f.sweep + 0.6 * rollDeg;
  const tipHeights = nacelles.flatMap(nac => nac.blades.map(b => b.tipWorld[1]));
  const residual = Math.max(...nacelles.flatMap(nac => nac.blades.map(b => Math.abs(distance(b.horn, b.foot) - D.linkLength))));
  return {
    driveAngle: a, phase, controls, flight: f, stage: stageOf(phase),
    airframe: { position: [f.x, f.altitude, f.z], roll: f.roll, pitch: f.pitch, yaw: f.yaw },
    wing: { stow, stowDeg: f.stowDeg }, nacelles, rotorAngle, spoolAngle, rotorRps, fold,
    gear, ramp: { angle: rampAngle, tip: rampTip, open: f.ramp, upper: f.ramp },
    door: f.door, hoist: { swing: hoistSwing, tip: hoistTip, cableLength, basket: sub(hoistTip, [0, cableLength, 0]) },
    probe: f.probe, flaperons, elevatorDeg, rudderDeg,
    flir: { yaw: 0.9 * Math.sin(TAU * 2 * phase), tilt: 0.25 * Math.sin(TAU * 3 * phase + 0.4) },
    beacon: TAU * 11 * phase,
    metrics: {
      nacelleDeg: f.nacelleDeg, rotorRpm: rotorRps * 60, altitudeM: f.altitude,
      wingStowDeg: f.stowDeg, bladeFoldDeg: f.foldDeg, collectiveDeg, gearDown: f.gearDown,
      rampDeg: rampAngle / deg, flaperonDeg: (flaperons.L + flaperons.R) / 2, rollDeg,
      swashTiltDeg: nacelles[1].swash.tiltDeg, actuatorMm: nacelles[1].actuator.length * 1000,
      tipClearanceM: Math.min(...tipHeights), linkResidualMm: residual * 1000, revolutions: N,
    },
  };
}
export function sample(t = 0, input = DEFAULT_INPUTS) {
  const time = Number.isFinite(t) ? t : 0, phase = phaseOf(time, cycleHz(input));
  return { t: time, phase, ...poseAt(phase * TAU, input) };
}
