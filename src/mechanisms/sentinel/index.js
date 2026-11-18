import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'sentinel', title: 'SENTINEL H9', family: 'Bipedal Exoskeleton', collection: '020',
  tagline: 'Two legs. Two hundred and forty service assemblies. One powered load path.',
  description: 'A heavy service exoskeleton: two inverse-kinematic legs under layered thigh, shin and boot armour, a yawing armoured torso over six open lumbar vertebrae, broad pauldrons, powered arms with ten articulated digits, a sensor helmet and a backpack with power cells, opening radiator vents and a recoiling service tether. Every rigid link and joint transform is exact; hydraulic pressure, contact force and balance are not solved, so this remains a kinematic anatomy model rather than a validated dynamics simulation.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Gait cadence', min: 0.15, max: 0.9, step: 0.01, unit: 'Hz', precision: 2 },
    { key: 'stride', label: 'Foot travel', min: 0.12, max: 0.36, step: 0.01, unit: 'm', precision: 2 },
    { key: 'lift', label: 'Swing clearance', min: 0.05, max: 0.20, step: 0.01, unit: 'm', precision: 2 },
    { key: 'grip', label: 'Digit curl', min: 0, max: 55, step: 1, unit: '°', precision: 0 },
  ],
  specs: [{ value: '240', label: 'SELECTABLE PARTS' }, { value: '2.32', label: 'M HEIGHT' }],
  cycleLabel: 'GAIT CYCLE', cycleHz, sample,
  lessons: [
    { title: 'Armor over a working load path', short: 'Read the heavy silhouette',
      text: 'Layered shell, titanium, dark and copper plates turn a thin link frame into a two-hundred-and-forty-part service exoskeleton. The helmet, pauldrons, barrel chest, hip girdle and boot armour add mass while open bays still expose the lumbar spine, ribs, bearings, gearboxes and hydraulic rods. X-ray fades only the pale shells, so every service item remains inspectable inside the machine.',
      fact: 'All 240 selectable parts remain visible in the efficient tier; only micro fasteners and thin trim are culled.', view: 'home', mode: 'solid', explode: 0 },
    { title: 'Two legs under one pelvis', short: 'Watch the hip yokes',
      text: 'Each leg stays a three-link chain from hip pin to sole pin: 450 mm thigh, 470 mm shin and a 140 mm foot link. A closed two-link solution places the knee forward of the hip-to-ankle line at every sampled phase, and the foot link keeps the sole level. The pelvis still sways 28 mm and bobs 16 mm; the feet do not follow that sway during stance, so the legs visibly absorb it instead of sliding.',
      fact: 'Rigid link lengths are preserved across the whole cycle; armour and actuators ride the solved chain without stretching it.', view: 'detail', mode: 'solid', explode: 0 },
    { title: 'Ten digits and five grip pinions', short: 'Open and close the grippers',
      text: 'Each hand has a palm datum, a floating knuckle guard and five digit chains. The four fingers carry a 62–70 mm proximal phalanx and a 46–58 mm distal phalanx; the opposed thumb is shorter and mounted on its own angled block. The curl control changes both hinges on every digit, while the power cycle adds a visible open-close pulse and a rotating palm pinion.',
      fact: 'A 0–55 degree curl is kinematic only; grip force, friction and object contact are not computed.', view: 'front', mode: 'xray', explode: 0.18 },
    { title: 'Backpack, radiators and service tether', short: 'Inspect the power bay',
      text: 'Two armoured power cells sit beside finned radiator banks and three hinged exhaust vanes per side. The louver doors and vanes open with a two-per-cycle thermal schedule, while the brass tether reel pays out and recovers a three-link tether between the yawing torso and the pelvis dock. A copper bus, teal state lamps, a regulator and twin exhaust stacks keep the service bay readable.',
      fact: 'The tether recoil is solved between two independently transformed frames, not a single rigid keyframe.', view: 'home', mode: 'xray', explode: 0.35 },
    { title: 'A power cycle with secondary hardware', short: 'Know what is moving',
      text: 'Hip and shoulder roller bearings, hip and shoulder gears, the power gearbox, wrist and grip pinions, knee and ankle actuator sleeves, breathing chest leaves, counter-swinging pauldrons and the scanning head all move on different integer harmonics of the phase. Across nine non-commensurate samples, 229 of the 240 assemblies move relative to the pelvis, so the machine reads as a coordinated mechanism rather than a posed statue.',
      fact: 'Rigid links, foot targets and joint pins are exact; pressure, force, balance and structural stress are not solved.', view: 'top', mode: 'xray', explode: 0.45 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
