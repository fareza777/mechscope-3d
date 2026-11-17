import { Vector3 } from 'three';

// Adapted from MIT reference-teardown/sims/cessna-shared/{gear,flight}.js; full MIT attribution is retained centrally. Service details are illustrative additions.
export const G = Object.freeze({
  pinionR: 0.064, teeth: 32, module: 0.004, stroke: 0.201,
  wheelR: 0.205, wheelW: 0.135, shaftY: -0.1365,
  jointX: 0.22, tubeLen: 0.3, legLen: 0.5,
});
export const AXIS = Object.freeze(new Vector3(1, -0.6, -1).normalize());
export const LEG0 = Object.freeze(new Vector3(1, -1, 0.8).normalize());
export const J = Object.freeze(new Vector3(G.jointX, G.shaftY, 0));
export const E0 = Object.freeze(J.clone().addScaledVector(AXIS, G.tubeLen));
export const TIP0 = Object.freeze(E0.clone().addScaledVector(LEG0, G.legLen));
// Source deployed tire tangent offset, before the separate inspection-fixture lift.
export const GROUND = G.wheelR - TIP0.y;
export const SERVICE_LIFT = 0.42;
export const DEFAULT_INPUT = Object.freeze({ cadence: 0.16, strokeScale: 1 });

export function bounded(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
export const strokeValue = value => bounded(value, 0, 0, 1);
export const cycleHz = (input = {}) => bounded(input?.cadence, DEFAULT_INPUT.cadence, 0.05, 0.4);

/** Right wheel centre, in the ungrounded reference assembly frame. */
export function tipAt(theta) {
  return TIP0.clone().sub(J).applyAxisAngle(AXIS, theta).add(J);
}

/** The source's one-DOF pose: nominal 201 mm translation and exactly a half-turn. */
export function poseAtStroke(value = 0) {
  const stroke = strokeValue(value);
  const theta = stroke * Math.PI;
  const rackTravel = stroke * G.stroke;
  const right = tipAt(theta).add(new Vector3(0, GROUND + SERVICE_LIFT, 0));
  return {
    stroke, pinionAngle: theta, rackTravel, rodEndZ: 0.32 - rackTravel,
    wheelCenters: { right: right.toArray(), left: [-right.x, right.y, right.z] },
  };
}

export function sample(t = 0, input = {}) {
  const time = Number.isFinite(t) ? t : 0;
  const frequency = cycleHz(input);
  const phase = ((time * frequency) % 1 + 1) % 1;
  const driveAngle = 2 * Math.PI * phase;
  const travel = bounded(input?.strokeScale, DEFAULT_INPUT.strokeScale, 0.1, 1);
  const pose = poseAtStroke((1 - Math.cos(driveAngle)) * 0.5 * travel);
  return {
    t: time, phase, driveAngle, ...pose,
    body: { position: [0, GROUND + SERVICE_LIFT, 0], pitch: 0, roll: 0 },
    status: pose.stroke < 0.002 ? 'DEPLOYED' : pose.stroke > 0.998 ? 'RETRACTED' : 'IN TRANSIT',
    direction: phase < 0.5 ? 'retracting' : 'deploying',
    metrics: {
      rackTravelMm: pose.rackTravel * 1000,
      pinionAngleDeg: pose.pinionAngle * 180 / Math.PI,
      idealRackTravelMm: pose.pinionAngle * G.pinionR * 1000,
      nominalPitchErrorMm: (pose.pinionAngle * G.pinionR - pose.rackTravel) * 1000,
      pitchDiameterMm: 2 * G.pinionR * 1000,
      moduleMm: G.module * 1000,
      pinionTeeth: G.teeth,
      cycleSeconds: 1 / frequency,
      wheelCentreHeightMm: pose.wheelCenters.right[1] * 1000,
    },
  };
}

export const LESSONS = Object.freeze([
  {
    title: 'One command, two main wheels', short: 'FOLLOW THE RACK',
    text: 'A stationary hydraulic barrel retracts its rod end aft. The connector carries the toothed rack; both wheels follow the same stroke. A suspended service inspection cradle lifts the complete assembly 420 mm above its deployed ground datum. Two slim posts and broad floor feet stand clear of the wheel sweep. The original oblique path is unchanged, with clearance even during explosion.',
    fact: '201 mm nominal rack stroke; fixed 420 mm service lift, not aircraft heave or a floor collision correction.',
    view: 'home', mode: 'solid', explode: 0,
  },
  {
    title: 'Translation into a half-turn', short: '32-TOOTH OUTPUT',
    text: 'Look through the rack guide and plate to the pinion on the transverse shaft. A 32-tooth, module-4 gear has a 128 mm pitch diameter. The reference couples 201 mm of nominal travel to exactly 180 degrees; the exact pitch-circle half-circumference is 201.062 mm.',
    fact: 'π × 128 / 2 = 201.062 mm, rounded to 201 mm in the reference.',
    view: 'top', mode: 'xray', explode: 0,
  },
  {
    title: 'An oblique axis folds the stance', short: 'NOT A SIMPLE HINGE',
    text: 'Each tube points outboard, down and aft along normalized (1, −0.6, −1). Its yoke, spring leg and wheel rotate together about that axis. The opposite side is mirrored. The yokes illustrate the source coupling, not a solved Cardan joint velocity law.',
    fact: 'Side-tube length 300 mm; nominal spring-leg vector 500 mm.',
    view: 'side', mode: 'solid', explode: 0,
  },
  {
    title: 'Read the brake stack', short: 'EXPOSE THE INTERFACES',
    text: 'Sectioned tire and split rim reveal annular bearings, a ventilated disc, two pads and an open caliper. Small axial offsets separate the stack in service view. Brake hoses and the scissor-shaped restraint are educational packaging additions, not verified Cessna hardware.',
    fact: 'No brake pressure, wheel-ground contact force or spring deflection is simulated.',
    view: 'detail', mode: 'cutaway', explode: 0.35,
  },
  {
    title: 'Disassemble without losing the pose', short: 'REVERSIBLE SERVICE VIEW',
    text: 'The original plate rises 160 mm, the actuator and rod connector 360 mm, the rack 60 mm, and the shaft drops 120 mm. Side assemblies move outboard while retaining their oblique rotation. Extra axial offsets expose glands, bearings and brakes; returning to zero restores every assembly.',
    fact: 'Explosion is an inspection transform, never a second retraction control.',
    view: 'home', mode: 'solid', explode: 1,
  },
]);
