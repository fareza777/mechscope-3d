import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'robot-hand', title: 'DEXTRA H5', family: 'Tendon-Driven Hand', collection: '015',
  tagline: 'Fifteen rigid bones. Five visible drives. One carefully phased grasp.',
  description: 'An upright five-finger robotic hand on an open forearm pedestal: metacarpal trusses, paired knuckle hinges, split bone armor, exposed pulley wheels, five capstans and tactile pads. Prescribed joint motion and geometric tendon routes, not contact forces or tendon dynamics.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Grasp cadence', min: .12, max: .8, step: .01, unit: 'Hz', precision: 2 },
    { key: 'grip', label: 'Grip excursion', min: 25, max: 100, step: 1, unit: '%', precision: 0 },
  ],
  specs: [{ value: '15', label: 'RIGID BONES' }, { value: '5', label: 'DRIVES' }],
  cycleLabel: 'OPEN / CURL', cycleHz, sample,
  lessons: [
    { title: 'A grasp made of rigid links', short: 'Follow fifteen bone frames',
      text: 'Four fingers each contain proximal, middle and distal phalanges, while the opposed thumb has three shorter links. Their next joints are translated by fixed local bone lengths and then rotated about paired hinge pins. The curl is deliberately limited so the fingertips turn forward without passing into the palm, and generous lateral spacing leaves each digit readable.',
      fact: 'All fifteen pin-to-pin distances stay constant; only joint angles and geometric tendon-span lengths change.', view: 'front', mode: 'xray', explode: .18 },
    { title: 'Five separate drive cartridges', short: 'Trace one route at a time',
      text: 'Five capstans sit across the lower metacarpal frame, one for each digit. Paired visible routes connect each drum to the guides along its own bones. The displayed drum rotation is synchronized to the commanded curl, while the lines simply join moving guide endpoints. There is no claim of inextensible cable closure, elastic tension, motor torque or contact-force prediction.',
      fact: 'The routed-length readout measures the displayed straight spans; it is not cable payout or a tension solution.', view: 'detail', mode: 'solid', explode: .12 },
    { title: 'The thumb has its own plane', short: 'Watch the opposition bearing',
      text: 'The thumb root sits low on the radial edge of the open palm. Its splayed metacarpal carrier rotates through an opposition schedule as its three joints curl, bringing the pad toward the finger side rather than copying a fifth parallel finger. The index, middle, ring and little fingers have different lengths, root heights and small fixed outward splay angles.',
      fact: 'Opposition is a prescribed root rotation; the animation neither detects objects nor enforces a pinch contact.', view: 'top', mode: 'cutaway', explode: .1 },
    { title: 'Hinges belong to both neighboring bones', short: 'Inspect paired cheek plates',
      text: 'Every joint has a fixed pair of parent-mounted cheek plates, a transverse axle and a rotating bone-side pulley. The proximal cheek plates live on the palm carrier; later ones travel rigidly with the preceding bone. Split shell covers leave the tendon guides, cross-spacers and pulley faces visible, and x-ray fades only those protective shell pieces.',
      fact: 'Low quality preserves all bones, cheeks, pulley wheels, tendons and tactile pads, removing only small fasteners and grooves.', view: 'side', mode: 'xray', explode: .48 },
    { title: 'Phase offsets make the motion legible', short: 'Open, gather and release',
      text: 'The finger commands share a single periodic opening-and-curling cycle with small offsets from index through little finger. The thumb leads slightly, and the wrist contributes a subtle yaw above the forearm cuff. Cadence changes the elapsed-time rate while grip excursion changes joint, opposition and wrist amplitudes. No rigid link is scaled to create the motion.',
      fact: 'The service pedestal supports a roughly two-metre display; the pads are visual tactile surfaces, not simulated pressure sensors.', view: 'home', mode: 'solid', explode: 0 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
