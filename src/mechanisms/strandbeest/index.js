import { DEFAULT_INPUTS, cadenceOf, sample, HOLY, SCALE, STRIDE } from './kinematics.js';

export const descriptor = {
  id: 'strandbeest',
  title: 'VENTUS J20',
  family: 'Jansen Walking Machine',
  collection: '003',
  tagline: 'Twenty feet. Eleven lengths. One extraordinary mechanical rhythm.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [{ key: 'cadence', label: 'Crank frequency', min: 0.08, max: 0.75, step: 0.01, unit: 'Hz', precision: 2 }],
  specs: [{ value: '20', label: 'LEGS' }, { value: '11', label: 'LINK LENGTHS' }],
  cycleLabel: 'CRANK CYCLE',
  cycleHz: cadenceOf,
  sample,
  lessons: [
    {
      title: 'Eleven lengths, one closed path', short: 'Circles, not keyframes',
      text: 'Turn the crank and its A pin becomes the centre of two circles. Intersections with circles about fixed pivot P locate B and C; three more intersections close D, E and the foot F. Ten bars plus the crank retain their exact lengths. The two extra dimensions a and l only locate the fixed pivot.',
      fact: `Crank radius: ${(HOLY.m * SCALE * 1000).toFixed(1)} mm. Long shin h: ${(HOLY.h * SCALE * 1000).toFixed(1)} mm.`,
      view: 'detail', mode: 'solid', explode: 0,
    },
    {
      title: 'Twenty feet, ten phases', short: 'The travelling crank wave',
      text: 'Each station carries one shared crank pin and two mirrored Jansen legs. The right leg is solved at π minus the crank angle before reflecting its X coordinates, so both legs meet the same pin. Successive throws are indexed by −36 degrees along the shaft.',
      fact: '10 stations × 2 mirrored legs = 20 feet; station pitch is 273 mm.',
      view: 'top', mode: 'xray', explode: 0,
    },
    {
      title: 'A stance without camera travel', short: 'The floor is the datum',
      text: 'The source integrates the mean velocity of near-ground feet to derive body travel. VENTUS removes only its continuous travel, preserving the small periodic body motion. The vertical body offset follows the lowest tread, and up to 12.6 mm of compliant shoe travel closes the near-ground stance band without deforming a linkage bar.',
      fact: `Source-derived travel per crank cycle: ${(Math.abs(STRIDE) * SCALE).toFixed(3)} m. Contact forces and friction are not simulated.`,
      view: 'side', mode: 'solid', explode: 0,
    },
    {
      title: 'A mechanism inside every joint', short: 'Section the bearing stack',
      text: 'Paired clevis eyes surround a polished pin, while copper bushings and recessed retainers separate the moving bars. The cutaway is a real clipping plane through the assembly, revealing bores and layer separation rather than hiding whole components.',
      fact: 'The section keeps local X ≤ 0. X-ray affects outer cartridges, fairings and cloth only.',
      view: 'detail', mode: 'cutaway', explode: 0.18,
    },
    {
      title: 'The anatomy of a wind walker', short: 'Lift the sail subframes',
      text: 'Ten cambered sails retain the source’s taper, swept boom, −0.5 rad yaw, masts and frame stays. Explode separates the station modules, rigid rail bays, leg stacks, covers and complete sail rigs. The filled cloth shape is baked once, avoiding per-frame normal reconstruction.',
      fact: 'Sail height 672 mm; nominal chord 546 mm. Wind capture is illustrated, not an aerodynamic or power simulation.',
      view: 'home', mode: 'solid', explode: 0.85,
    },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
