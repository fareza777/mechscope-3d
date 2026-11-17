import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'hummingbird', title: 'ALULA H2', family: 'Bird Automaton', collection: '014',
  tagline: 'Two radial fans. One closed-loop shoulder drive. A mechanical bird in slow motion.',
  description: 'A pedestal-supported hummingbird automaton with two broad, layered metal-feather wings, exact crank–rocker shoulders, folding elbows, a cooling-cage thorax, long beak, articulated tail fan and folded claws. Inspection motion, not a flight simulation.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Inspection cadence', min: .15, max: 1, step: .01, unit: 'Hz', precision: 2 },
    { key: 'stroke', label: 'Stroke eccentric', min: 18, max: 38, step: 1, unit: 'mm', precision: 0 },
  ],
  specs: [{ value: '2', label: 'WINGS' }, { value: '155', label: 'LINK · MM' }],
  cycleLabel: 'FEATHER STROKE', cycleHz, sample,
  lessons: [
    { title: 'A shoulder with genuine closure', short: 'Trace the brass eccentric',
      text: 'The adjustable eccentric runs around the lower fixed bearing while a 155 mm connecting rod closes onto a 95 mm shoulder rocker. Circle intersection selects one continuous assembly branch. The conrod runs in a separate axial plane, with extended journals passing through its two bushes rather than letting the rails slice through the crank disk.',
      fact: 'The stroke control changes crank radius from 18 to 38 mm, never the connecting-rod length.', view: 'detail', mode: 'xray', explode: .12 },
    { title: 'Two wings, not four insect blades', short: 'Read the radial feather fans',
      text: 'Each wing has seven inner secondary feathers and nine outer primary feathers. Individual open quills, tapered perimeter ribs and transverse ties describe broad overlapping fan layers without an opaque wing slab. A separate root socket and pale quill shoe make every metal feather an inspectable assembly, including in low quality.',
      fact: 'Thirty-two wing feathers remain individually selectable; the two inner and outer layers belong to only two wings.', view: 'top', mode: 'solid', explode: .3 },
    { title: 'A rigid arm behind the fan', short: 'Sweep, pitch and elbow fold',
      text: 'The closed-loop rocker provides the shoulder stroke. A nested sweep bearing, pitch cartridge and elbow hinge then orient two fixed-length spars. Those secondary axes and feather twist follow explicitly prescribed servo schedules, synchronized to the inspection shaft. Their brackets travel with the parent arm; they are not hidden extra four-bar constraints.',
      fact: 'The upper spar stays 370 mm and the fore spar 280 mm through every pose; no link mesh is stretched.', view: 'front', mode: 'cutaway', explode: .16 },
    { title: 'An open motor, a recognizable bird', short: 'Beak, barrel and folded feet',
      text: 'A narrow optical head and long tapered beak establish the bird silhouette ahead of the barrel thorax. Copper stator bars sit inside an open longitudinal cooling cage; split dorsal armor fades in x-ray. Two small folded claws hang below the body. A slender service pedestal, not the claws or implied lift, supports the entire demonstrator.',
      fact: 'The deliberately slow 0.15–1 Hz cycle is an inspection rate, not a real hummingbird wingbeat.', view: 'home', mode: 'xray', explode: .5 },
    { title: 'Seven independently trimmed tail quills', short: 'Observe the articulated fan',
      text: 'The rear fan is assembled from seven rigid tapered feather cartridges, each carried on its own root bearing. Small phase-lagged pitch and spread commands change the fan silhouette as the wings stroke. Head yaw and claw trim share the same period. These are geometric servo demonstrations, not calculated balance, lift or aerodynamic stabilization.',
      fact: 'Cadence changes elapsed-time motion; stroke changes both the real shoulder excursion and the secondary trim amplitudes.', view: 'side', mode: 'solid', explode: .22 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
