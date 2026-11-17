import { DEFAULT_INPUT, DESIGN, LESSONS, sampleSpider } from './spider/kin.js';
import { descriptor as v8 } from './mechanisms/v8/index.js';
import { descriptor as strandbeest } from './mechanisms/strandbeest/index.js';
import { descriptor as landingGear } from './mechanisms/landing-gear/index.js';
import { descriptor as scorpion } from './mechanisms/scorpion/index.js';
import { descriptor as dragonfly } from './mechanisms/dragonfly/index.js';
import { descriptor as mantis } from './mechanisms/mantis/index.js';
import { descriptor as octopus } from './mechanisms/octopus/index.js';
import { descriptor as robotFish } from './mechanisms/robot-fish/index.js';

export const MECHANISMS = Object.freeze([
  {
    id: 'arachne-sc08',
    title: 'ARACHNE SC–08',
    family: 'Mechanical Spider',
    collection: '001',
    description: 'Eight articulated legs. A complete mechanical anatomy study.',
    design: DESIGN,
    defaultInputs: DEFAULT_INPUT,
    controls: [
      { key: 'cadence', label: 'Cadence', min: .25, max: 1.1, step: .05, unit: 'Hz', precision: 2 },
      { key: 'stride', label: 'Stride', min: .10, max: .34, step: .01, unit: 'm', precision: 2 },
      { key: 'clearance', label: 'Foot lift', min: .06, max: .22, step: .01, unit: 'm', precision: 2 },
      { key: 'height', label: 'Body height', min: .72, max: .90, step: .01, unit: 'm', precision: 2 },
    ],
    specs: [{ value: '08', label: 'LEGS' }, { value: '24', label: 'JOINT AXES' }],
    cycleLabel: 'GAIT CYCLE',
    cycleHz: input => input.cadence,
    lessons: LESSONS,
    sample: sampleSpider,
    capabilities: ['anatomy', 'exploded', 'section', 'xray', 'gait', 'supportPolygon'],
    async createModel() { return (await import('./spider/model.js')).createSpider(); },
  },
  v8,
  strandbeest,
  landingGear,
  scorpion,
  dragonfly,
  mantis,
  octopus,
  robotFish,
]);
