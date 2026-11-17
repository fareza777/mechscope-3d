import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'robot-fish', title: 'PISCES K9', family: 'Biomimetic Robotic Koi', collection: '009',
  tagline: 'Eight rigid vertebrae. A traveling bend. Armor that reveals the machinery.',
  description: 'A koi-shaped inspection robot with overlapping separated scale armor, a sinusoidally commanded eight-link spine, paired pectoral drives, gill crank-rockers and a forked caudal ray fan. A measured kinematic study on a service pedestal, not a hydrodynamic simulation.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Traveling-wave frequency', min: 0.12, max: 1.1, step: 0.01, unit: 'Hz', precision: 2 },
    { key: 'amplitude', label: 'Tail-joint amplitude', min: 6, max: 22, step: 1, unit: 'deg', precision: 0 },
  ],
  specs: [{ value: '8', label: 'SPINE LINKS' }, { value: '192', label: 'SCALES' }],
  cycleLabel: 'TRAVELING BEND', cycleHz, sample,
  lessons: [
    { title: 'A wave of angles, not a stretching fish', short: 'Read the eight vertebrae',
      text: 'Each yaw joint receives a sinusoidal command delayed by 45 degrees from the preceding joint. The command grows toward the tail, while the cervical link stays fixed to the support. Absolute headings are accumulated; the next pin is placed exactly one link length along the new heading. Armor and ribs are rigid children of their vertebra, not a continuously distorted body mesh.',
      fact: 'Link lengths: 240, 240, 230, 220, 200, 180, 160 and 140 mm. Total centerline length is always 1.610 m.', view: 'top', mode: 'xray', explode: 0.08 },
    { title: 'A skin assembled one scale at a time', short: 'Lift the four armor quadrants',
      text: 'Every vertebra has four selectable armor quadrants with two staggered rows of three shallow scales. Separate curved plates overlap longitudinally but have visible lateral seams, small radial steps and independent retainers. The shoulder stays deep and broad; successive cartridges narrow toward the peduncle so the solid view reads as a fish rather than a train of cylinders.',
      fact: '8 vertebrae × 4 quadrants × 6 scales = 192 instanced shell plates. Only shell material fades in x-ray.', view: 'home', mode: 'solid', explode: 0.48 },
    { title: 'The short side pays out less tendon', short: 'Expose the antagonistic runs',
      text: 'Paired tendon spans connect offset guides on successive vertebrae. Their endpoints are transformed by the same headings as the armor, and the displayed differential is calculated from those actual endpoint distances. The visual cables change paid-out length while the spine bars remain rigid. Small indexing gears and joint trunnions show where a servo command would enter the chain.',
      fact: 'Tendon guides are offset ±52 mm from the spine. Forces, actuator torque, friction and elastic stretch are not solved.', view: 'detail', mode: 'cutaway', explode: 0.16 },
    { title: 'The tail is a supported fan', short: 'Follow each fin ray',
      text: 'Thirteen caudal rays spread into two lobes around a recessed center, with diagonal ties and narrow separated shell ribbons. The fin follows the eighth vertebra and adds a small periodic feather angle. The paired pectoral fans have opposing inspection phases; dorsal and ventral fin bays travel with the body cartridges that carry them.',
      fact: 'The tail-speed readout measures the final spine pin, not swimming speed or thrust. Its velocity is differentiated analytically from the same joint commands.', view: 'side', mode: 'solid', explode: 0.18 },
    { title: 'A breathing cover with a real linkage', short: 'Open the gill cartridge',
      text: 'Each gill has a 14 mm crank, 105 mm connecting rod and 60 mm rocker. A fixed circle-intersection branch closes the linkage and rotates a separately selectable operculum. Extended axial pins carry both rod eyes 45 mm clear of the drive plane, keeping the projected and physical pin spacing at 105 mm. Twin eye modules, mouth rings, barbels and exposed cheek service conductors give the front end its koi anatomy. The narrow service post supports the fixed neck; no free-swimming motion is claimed.',
      fact: 'The gill residual is the computed rod-length error in millimetres. Frequency is a slow inspection control, not a biological respiration specification.', view: 'front', mode: 'xray', explode: 0.35 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
