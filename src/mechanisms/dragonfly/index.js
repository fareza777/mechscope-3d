import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'dragonfly', title: 'LIBELLE D4', family: 'Biomimetic Four-Wing Mechanism', collection: '006',
  tagline: 'Four open wings. Two opposed throws. One visible mechanical pulse.',
  description: 'A dragonfly-shaped service demonstrator: four tapered lattice wings, exact crank–rocker shoulders, split compound optics, six articulated legs and an eight-joint abdomen. Teardown-inspired mechanical anatomy, not a flight or biological simulation.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Drive frequency', min: 0.15, max: 1.2, step: 0.01, unit: 'Hz', precision: 2 },
    { key: 'eccentric', label: 'Eccentric radius', min: 18, max: 40, step: 1, unit: 'mm', precision: 0 },
  ],
  specs: [{ value: '4', label: 'WINGS' }, { value: '155', label: 'ROD · MM' }],
  cycleLabel: 'SHOULDER DRIVE', cycleHz, sample,
  lessons: [
    { title: 'A wing driven by a closed triangle', short: 'Follow the eccentric',
      text: 'The brass disk carries an adjustable 18–40 mm eccentric. Its pin is always 155 mm from the rocker pin; that pin stays 95 mm from the shoulder bearing. A circle intersection solves the same assembly branch at every crank angle. The complete rod and its eyes sit 45 mm ahead of the drive disk on extended axial pins. Both ends share that plane, preserving the 155 mm projected and physical pin spacing without stretching.',
      fact: 'Fixed pivot offset: 90 mm lateral and 130 mm vertical. Readout residual is the calculated conrod-length error, not a manufacturing tolerance.', view: 'detail', mode: 'xray', explode: 0.12 },
    { title: 'Opposed shoulders, not four keyframes', short: 'Fore and aft exchange strokes',
      text: 'The forewing cranks share one phase and the hindwing pair is indexed exactly 180 degrees later. Left and right mechanisms are proper mirrored orientations, keeping both wing tips at the same height. Changing eccentric radius alters the rocker excursion without changing the rigid rods or the one-revolution period.',
      fact: 'The slow 0.15–1.20 Hz inspection drive is deliberately not a claim about a real dragonfly wingbeat.', view: 'front', mode: 'solid', explode: 0 },
    { title: 'A load path you can see through', short: 'Inspect the open venation',
      text: 'Each long swept wing has seven separately selectable lattice bays. Paired leading-edge rails, three longitudinal veins, chordwise spars and crossed micro-braces transfer load back to the shoulder. A small outboard balance insert interrupts an otherwise open outline. There are no opaque rectangular wing slabs or simulated membranes hiding the cells.',
      fact: 'Designed shoulder-to-tip reach: 1,255 mm. Tip speed is the analytic rocker angular velocity multiplied by that reach; lift is not computed.', view: 'top', mode: 'solid', explode: 0.3 },
    { title: 'A flexible tail with rigid vertebrae', short: 'Eight pitch cartridges',
      text: 'Eight 124 mm abdomen cartridges follow a phase-lagged pitch schedule. Every next pin is constructed from the previous pin plus an exact-length vector. Separate dorsal and ventral armor, transverse hinge pins and longitudinal service conductors expose the difference between an articulated chain and deforming a single mesh.',
      fact: 'Total pin-to-pin abdomen length: 992 mm. Joint commands illustrate trim; balance, stresses and aerodynamic stability are not solved.', view: 'side', mode: 'cutaway', explode: 0.2 },
    { title: 'The insect is an assembly, not a casing', short: 'Optics, legs and motor rings',
      text: 'Split faceted optical pods flank the head. Six hanging legs each have a coxa, femur, tibia and gripping tarsus, while stator rings, bearing races, radial cooling fins and cable loops remain visible beneath the thorax covers. The low service stand supports the mechanism: it is neither hovering nor standing on its legs.',
      fact: 'X-ray fades shell armor only; metal linkages, fasteners and optical facets remain readable. Low quality removes only small service details.', view: 'home', mode: 'xray', explode: 0.65 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
