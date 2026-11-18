import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'steam-locomotive', title: 'TITAN S6', family: 'Six-Coupled Locomotive', collection: '018',
  tagline: 'Six drivers, quartered cranks and a locomotive that rolls along its service rails.',
  description: 'A six-coupled locomotive with exact slider-cranks, quartered side rods and adjustable rigid eccentric valve links. It rolls 0.52 m forward and back along the fixed service rails while the drivers, pilot wheels, rod train and cab handwheels keep moving. An opened boiler, cab skeleton and twin cylinders reveal the machine; steam flow, rail adhesion and loads are not simulated.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Inspection cadence', min: .08, max: .8, step: .01, unit: 'Hz', precision: 2 },
    { key: 'advance', label: 'Valve eccentric advance', min: -15, max: 45, step: 1, unit: '°', precision: 0 },
  ],
  specs: [{ value: '6', label: 'DRIVERS' }, { value: '0.52', label: 'M TRAVEL' }],
  cycleLabel: 'DRIVER · TRAVEL', cycleHz, sample,
  lessons: [
    { title: 'Three axles, one rigid phase', short: 'Follow the coupling rods',
      text: 'Each side has three crankpins at a common 140 mm radius. Equal phase makes the distance between neighboring pins exactly the 680 mm axle pitch, so the two coupling rods remain rigid throughout a revolution. The wheels rotate while the whole locomotive rolls along the fixed service rails; the rail and sleeper bench stays put.',
      fact: 'The 0.52 m travel is deterministic; rail adhesion, friction and wheel slip are not solved.', view: 'side', mode: 'solid', explode: 0 },
    { title: 'Quartering avoids a shared dead center', short: 'Compare left and right',
      text: 'The right crank set leads the left by ninety degrees. Each crosshead is solved from the intersection of its straight horizontal guide and a circle of radius 700 mm about the main crankpin. Piston rods remain collinear with their cylinders while separate connecting rods swing on extended crank journals.',
      fact: 'The 280 mm stroke is exact geometry; torque, steam pressure and starting performance are not calculated.', view: 'front', mode: 'xray', explode: .12 },
    { title: 'Valve advance changes a real loop', short: 'Turn the eccentric setting',
      text: 'The smaller eccentric is indexed relative to the main crank. Adjusting advance changes its circular pin path in time, and a fixed 490 mm rod drives a slider at the valve-chest height. The valve rod is not stretched or keyed to piston displacement. This direct eccentric demonstrator omits reversing gear and detailed port events.',
      fact: 'Both valve eyes stay 490 mm apart for every allowed advance, including the control endpoints.', view: 'detail', mode: 'solid', explode: .15 },
    { title: 'Separate lanes prevent impossible rods', short: 'Inspect the extended journals',
      text: 'Wheel spokes, coupling bars, valve links and main connecting rods occupy different axial lanes. Extended journals connect those lanes without pushing plates through wheel faces or chassis rails. Separate bearing boxes and layered leaf springs show the load route into six service jacks rather than hiding the axles in a generic engine block.',
      fact: 'The swept-clearance tests inspect rendered primitives, including rod eyes, not just nominal lane dimensions.', view: 'top', mode: 'cutaway', explode: .32 },
    { title: 'A locomotive, opened for service', short: 'Read the miniature silhouette',
      text: 'A long banded boiler, lifted inspection staves, exposed fire tubes, copper plumbing, chimney and cab frame sit above the six large spoked wheels. Small pilot wheels, end buffers, steps and moving cab controls complete the railway silhouette. Pale shell panels ghost in x-ray while the structural metal and copper remain opaque. The service rails, sleepers and jack beams stay fixed while the locomotive group travels over them.',
      fact: 'This is an educational sculpture, not a pressure-vessel design, rail-adhesion simulation or validated locomotive drawing.', view: 'home', mode: 'xray', explode: .55 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
