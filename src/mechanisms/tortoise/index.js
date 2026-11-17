import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'tortoise', title: 'CHELON T4', family: 'Domed Quadruped', collection: '013',
  description: 'A broad domed tortoise with individually curved scutes, a raised radial lattice, four short three-link legs, telescoping pin-ended actuators, an extending articulated neck and an exposed timing train. A geometric walk-in-place command, not a simulation of traction, balance or animal anatomy.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Gait cadence', min: .08, max: .55, step: .01, unit: 'Hz', precision: 2 },
    { key: 'stride', label: 'Stride excursion', min: 0, max: 1, step: .01, unit: '', precision: 2 },
  ],
  specs: [{ value: '4 × 3', label: 'LEG LINKS' }, { value: '68', label: 'DOME SCUTES' }],
  cycleLabel: 'QUARTER-PHASE GAIT', cycleHz, sample,
  lessons: [
    { title: 'A dome, not a lid', short: 'Sixty-eight curved scutes', text: 'Five staggered rows of curved shell patches follow an ellipsoidal dome. Each patch is oriented to the local surface normal, and the gaps reveal paired radial ribs and raised latitude rails. The shell retains a high central crown and a descending rim instead of disguising a flattened box beneath decorative seams.', fact: 'The shell lattice spans approximately 1.30 by 1.66 metres, with a 450 mm rise above its rim datum.', view: 'top', mode: 'solid', explode: .12 },
    { title: 'Short powerful legs with exact reach', short: 'Three rigid members per foot', text: 'A horizontal coxa aims toward each foot target. The femur and tibia meet at the upward circle intersection in their shared leg plane, preserving both lengths. Paired load rails and separately mounted armor make these compact limbs look and move differently from the long radial legs of a spider mechanism.', fact: 'Coxa, femur and tibia lengths are 105, 200 and 260 mm; unreachable targets are rejected, not stretched.', view: 'front', mode: 'xray', explode: .18 },
    { title: 'A quarter-phase inspection walk', short: 'Three pads remain in stance', text: 'The four legs enter their swing intervals a quarter cycle apart. A 78 percent stance fraction leaves at least three level pads on the floor while the fourth follows a smooth lifted return. The stride control changes horizontal excursion and lift; the body remains fixed for inspection rather than advancing through a simulated environment.', fact: 'Pad centres stay at least 55 mm above the floor; their 110 mm thick level soles never penetrate it.', view: 'side', mode: 'solid', explode: 0 },
    { title: 'Telescoping without scaling metal', short: 'Rigid barrels and piston rods', text: 'Every lift actuator has a fixed-length barrel and a separate fixed-length polished rod. Both aim along the two sampled pins, with the rod sliding deeper into its sleeve as the distance closes. The moving clevis is attached in the femur frame, and long journals reach the offset eyes outside the gear and rail lanes.', fact: 'Barrels remain 150 mm and rods 200 mm long; changing exposed length is translation, not cylinder scaling.', view: 'detail', mode: 'cutaway', explode: .25 },
    { title: 'Service anatomy beneath the shell', short: 'Neck, drums and conductors', text: 'Two neck cartridges change their included angle to extend the head, while a lower jaw and small tail follow the same master phase. Hip gear drums, six timing cartridges, rim latches and segmented service conductors remain visible through the lattice. X-ray removes shell opacity without hiding the load-bearing mechanism.', fact: 'Low quality omits only small fittings, and every named assembly retains live selectable primitives.', view: 'home', mode: 'xray', explode: .65 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
