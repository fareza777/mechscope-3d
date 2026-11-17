import { DEFAULT_INPUTS, cadenceOf, sample } from './kin.js';

export const descriptor = {
  id: 'scorpion', title: 'SCORPIO S8', family: 'Articulated Scorpion Robot', collection: '005',
  tagline: 'Eight grounded legs. Two opposed claws. One articulated arch.',
  description: 'A conceptual biomimetic inspection robot with sphere-intersection leg kinematics, geared pincers and a six-link tendon-inspired tail. Mechanical packaging follows the supplied Teardown approach; dimensions, gait and actuators are educational design choices, not claims about animal anatomy, contact forces or real robot performance.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Gait frequency', min: .12, max: .7, step: .01, unit: 'Hz', precision: 2 },
    { key: 'posture', label: 'Tail / claw display', min: 0, max: 1, step: .01, unit: '', precision: 2 },
  ],
  specs: [{ value: '8+2', label: 'LEGS / CLAWS' }, { value: '6', label: 'TAIL JOINTS' }],
  cycleLabel: 'SERVO GAIT CYCLE', cycleHz: cadenceOf, sample,
  lessons: [
    { title: 'A rigid answer to every foot target', short: 'Three joints per leg', text: 'A horizontal 140 mm coxa aims at the foot. The 390 mm femur and 490 mm tibia then meet at the upward intersection of two reach spheres in the leg plane. No bar is stretched to make the foot reach the floor. Paired rails leave the internal transmission and pin stacks visible.', fact: 'Coxa / femur / tibia: 140 / 390 / 490 mm. Targets stay strictly inside the reach annulus.', view: 'front', mode: 'solid', explode: 0 },
    { title: 'Eight pads share two phase groups', short: 'Support without dynamics', text: 'Alternating stations and opposite sides run half a cycle apart. Each foot spends 64% of the period on a level support path, then follows a smooth raised return. The robot walks in place: the support count is geometric, not a force balance or friction prediction.', fact: 'At least four pads occupy the support interval; maximum commanded lift is 115 mm.', view: 'top', mode: 'xray', explode: .12 },
    { title: 'Opposed pincers, one aperture', short: 'Equal gears reverse rotation', text: 'Each palm carries two equal spur sectors on vertical pins. The aperture command rotates the two jaws in opposite directions, keeping the jaw-tip gap symmetric about the palm. Bent fingers and inward hooks surround negative space rather than filling the claw with a solid block.', fact: 'Minimum opening is 0.14 rad for clearance between the 18 mm-radius hooks; maximum remains 0.56 rad at full display. Gear contact and grip force are not simulated.', view: 'detail', mode: 'solid', explode: .2 },
    { title: 'An arch with six independent axes', short: 'A spine inside the armor', text: 'Six rigid tail vertebrae accumulate endpoint positions from yaw and elevation. Bearing cartridges, rolling gears, transverse shafts and side cable guides sit inside split ribbed shells. Small axial roll makes the multi-axis construction legible while leaving all endpoint lengths unchanged.', fact: 'Tail link lengths: 240, 240, 240, 230, 220 and 200 mm; terminal inspection stylus: 250 mm.', view: 'side', mode: 'cutaway', explode: .14 },
    { title: 'Separate the load path from the covers', short: 'Serviceable subassemblies', text: 'Lift the split armor to expose the central shaft, timing wheels, motor windings and distribution spine. Each leg and claw has a dedicated telescoping actuator with a rod-end bracket fixed in its femur or wrist-carrier frame: the barrel remains rigid while the polished rod takes up changing pin distance. Explosion is a temporary inspection transform, never a new kinematic solution.', fact: 'X-ray fades shell material only. Fasteners and minor cable details are omitted at low quality; joint structure stays selectable.', view: 'home', mode: 'xray', explode: .65 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
