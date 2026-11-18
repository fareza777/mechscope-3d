import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'sentinel', title: 'SENTINEL H9', family: 'Bipedal Exoskeleton', collection: '020',
  tagline: 'Two legs. Ten digits. One visible load path.',
  description: 'A bipedal exoskeleton study: two inverse-kinematic legs with planted foot targets, a yawing torso over six lumbar vertebrae, two open arm trusses, ten articulated digits and a four-link scanning neck. Every link length and joint transform is exact; hydraulic pressure, contact force and balance are not solved, so this is a kinematic anatomy model rather than a validated dynamics simulation.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Gait cadence', min: 0.15, max: 0.9, step: 0.01, unit: 'Hz', precision: 2 },
    { key: 'stride', label: 'Foot travel', min: 0.12, max: 0.36, step: 0.01, unit: 'm', precision: 2 },
    { key: 'lift', label: 'Swing clearance', min: 0.05, max: 0.20, step: 0.01, unit: 'm', precision: 2 },
    { key: 'grip', label: 'Digit curl', min: 0, max: 55, step: 1, unit: '°', precision: 0 },
  ],
  specs: [{ value: '34', label: 'RIGID LINKS' }, { value: '2.30', label: 'M HEIGHT' }],
  cycleLabel: 'GAIT CYCLE', cycleHz, sample,
  lessons: [
    { title: 'Two legs under one pelvis', short: 'Watch the hip yokes',
      text: 'Each leg is a three-link chain from hip pin to sole pin: 450 mm thigh, 470 mm shin and a 140 mm foot link. A closed two-link solution places the knee on the forward side of the hip-to-ankle line at every sampled phase, and the foot link keeps the sole level. The pelvis sways 28 mm and bobs 16 mm; the feet do not follow that sway during stance, so the legs visibly absorb it instead of sliding.',
      fact: 'Thirty-five rigid links are preserved across the whole cycle; only joint angles change.', view: 'detail', mode: 'solid', explode: 0 },
    { title: 'A foot path, not a walk cycle video', short: 'Follow one planted foot',
      text: 'Each foot follows a closed target path. It stays on the datum for 62 percent of the cycle, travelling backward through the stance, then lifts through a smooth 38 percent swing and returns forward. The ankle target is always 140 mm above and behind the sole, so the metatarsus never stretches. Left and right are offset by half a cycle, which produces a double-support interval rather than a jump.',
      fact: 'Increasing swing clearance raises the real mid-swing foot target; it does not move a detached keyframe.', view: 'side', mode: 'solid', explode: 0 },
    { title: 'Ten digits on one command', short: 'Close the manipulators',
      text: 'Each hand has a palm datum, a floating knuckle guard and five digit chains. The four fingers carry a 62–70 mm proximal phalanx and a 46–58 mm distal phalanx; the opposed thumb is shorter and mounted on its own angled block. The curl control changes both hinges on every digit at once. Wrist orientation is solved from the sampled forearm direction, so the hand cannot drift away from its link.',
      fact: 'A 0–55 degree curl is kinematic only; grip force, friction and object contact are not computed.', view: 'front', mode: 'xray', explode: 0.18 },
    { title: 'A spine that twists and a neck that reaches', short: 'Inspect the upper frame',
      text: 'Six lumbar vertebrae sit over the sacral bridge and are surrounded by seven open rib pairs per side, a sternal keel and a vented chest fairing. The torso yaws over the pelvis while the neck carries four rigid 100 mm links. The head adds its own yaw scan and a hinged mandible driven by two small actuator pairs. A rotating eight-vane core and dorsal heat exchanger remain visible through the open chest.',
      fact: 'Rib, vertebra and neck-pin spacing are fixed; the visible torso yaw is lighter than the chest fairing clearance.', view: 'home', mode: 'solid', explode: 0 },
    { title: 'Exact links, staged hydraulics', short: 'Know what is solved',
      text: 'Rigid link lengths, foot targets, knee solutions, arm chains, finger phalanges and neck pins are calculated from one sampled pose. Hydraulic sleeves and rods telescope along sampled clevis points, the core rotor follows a prescribed demonstration speed, and the jaw follows a prescribed opening schedule. No force, pressure, friction, actuator load, balance margin or structural stress is solved, and the pale shells are artistic representations.',
      fact: 'X-ray fades only shell armor; the load path, pins and hydraulic rods stay readable.', view: 'top', mode: 'xray', explode: 0.45 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
