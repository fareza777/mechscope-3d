import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'cobra', title: 'NAJA N18', family: 'Deployable-Hood Cobra', collection: '012',
  description: 'An upright cobra inspection machine: eighteen rigid vertebrae form a restrained S-curve above a low plinth, sixteen hinged hood ribs fan around an open tendon spine, and a geared jaw carries a split sensor tongue. Commanded motion only; no balance, muscle or contact dynamics are claimed.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Inspection cadence', min: .06, max: .4, step: .01, unit: 'Hz', precision: 2 },
    { key: 'spread', label: 'Hood deployment', min: 0, max: 1, step: .01, unit: '', precision: 2 },
  ],
  specs: [{ value: '18', label: 'VERTEBRAE' }, { value: '8 × 2', label: 'HOOD RIBS' }],
  cycleLabel: 'SERPENTINE COMMAND', cycleHz, sample,
  lessons: [
    { title: 'An S-curve made from rigid links', short: 'Follow eighteen pins', text: 'The spine is a serial chain of eighteen 114 mm cartridges. Each relative joint rotation is composed with the preceding frame, and the next pin is obtained by rotating a fixed-length vector. The first two cartridges remain restrained while a small traveling sway passes through the raised section; no cylinder is stretched to make the silhouette.', fact: 'The pin-to-pin chain is exactly 2,052 mm long at every phase and deployment setting.', view: 'side', mode: 'xray', explode: .15 },
    { title: 'A fan that belongs to the spine', short: 'Sixteen moving ribs', text: 'Eight pairs of rigid ribs attach to successive upper vertebrae. Their hinge origins and orientations inherit those moving frames before the local opening command is applied. Increasing deployment changes both the mean angle and its excursion, while the separated shell strips reveal the paired rails and outboard tips.', fact: 'The longest hood ribs are 550 mm; deployment changes angle, never their structural length.', view: 'front', mode: 'solid', explode: 0 },
    { title: 'Offset lanes keep the drive readable', short: 'Pins, eyes and gears', text: 'Each vertebral joint exposes a transverse journal with retainers and a small indexing wheel. Hood gears sit behind the structural rail plane, with extended shafts reaching their bearing eyes. Copper service runs and offset tendon-like rails belong to individual rigid cartridges rather than pretending to be a solved continuous cable.', fact: 'The gearing illustrates a synchronized command; torque, cable tension and tooth contact are not simulated.', view: 'detail', mode: 'cutaway', explode: .3 },
    { title: 'A split sensor mouth', short: 'Jaw and tongue exchange motion', text: 'A lower jaw rotates around a visible lateral pin below the narrow optic pods. The two-pronged sensor tongue slides in a guide carried by that jaw, so its tip inherits both the head frame and jaw opening. Its double-frequency inspection stroke is coupled to the same master phase as the hood and spine.', fact: 'Jaw opening stays between 0.10 and 0.38 rad; the tongue is a non-contact sensor demonstrator.', view: 'detail', mode: 'solid', explode: .12 },
    { title: 'Support, not levitation', short: 'Inspect the restrained tail', text: 'The low plinth supports a bushed tail saddle at the first pin and a second brace under the restrained base cartridges. Open frames, tapered split scutes and service fasteners remain separate selectable assemblies. X-ray fades only shell armor; low quality removes small fittings without removing any selectable structure.', fact: 'Explosion is reversible inspection spacing, not an additional kinematic or physical solution.', view: 'home', mode: 'xray', explode: .65 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
