import { DEFAULT_INPUT, G, LESSONS, cycleHz, sample } from './kinematics.js';

export const descriptor = Object.freeze({
  id: 'cessna-gear',
  title: 'VECTOR RG–2',
  family: 'Retractable Landing Gear',
  collection: '004',
  tagline: 'A linear stroke. A half-turn. An oblique path home.',
  description: 'Cessna 337-inspired rack, pinion and retracting yokes in an educational kinematic service study.',
  defaultInputs: DEFAULT_INPUT,
  design: G,
  controls: [
    { key: 'cadence', label: 'Cycle frequency', min: 0.05, max: 0.4, step: 0.01, unit: 'Hz', precision: 2 },
    { key: 'strokeScale', label: 'Retraction travel', min: 0.1, max: 1, step: 0.01, unit: 'ratio', precision: 2 },
  ],
  specs: [
    { value: '201', label: 'TRAVEL · MM' },
    { value: '32', label: 'PINION TEETH' },
  ],
  cycleLabel: 'RETRACTION CYCLE',
  cycleHz,
  sample,
  lessons: LESSONS,
  capabilities: ['anatomy', 'exploded', 'section', 'xray'],
  async createModel() { return (await import('./model.js')).createModel(); },
});

export { cycleHz, sample };
export default descriptor;
