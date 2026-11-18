import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'tourbillon', title: 'CHRONOS T3', family: 'Tourbillon Movement', collection: '019',
  tagline: 'A revolving cage, a breathing copper spiral, an exposed integer-ratio train and a 720-turn seconds sweep.',
  description: 'A vertical skeleton clock with an open 60:40:30 gear train, a 30:10:30:6 seconds train, rotating tourbillon cage, oscillating balance and articulated copper hairspring. Cage rollers, an escape fan, a barrel ratchet and click, and a movable regulator index stay visible. Gear ratios and rigid geometry are exact; escapement lock/release timing and spring winding are prescribed educational illustrations, not dynamical horology.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Cage inspection cadence', min: .025, max: .15, step: .005, unit: 'Hz', precision: 3 },
    { key: 'amplitude', label: 'Balance amplitude', min: 15, max: 42, step: 1, unit: '°', precision: 0 },
  ],
  specs: [{ value: '720', label: 'SECONDS' }, { value: '60', label: 'CAGE TEETH' }],
  cycleLabel: 'FULL HAND CYCLE', cycleHz, sample,
  lessons: [
    { title: 'Exact ratios in an open train', short: 'Count the four gear rims',
      text: 'The barrel wheel has sixty teeth, the intermediate wheel forty and the third wheel thirty. Their rotations over a complete display cycle are plus twenty-four, minus thirty-six and plus forty-eight turns. Center distances equal the sums of pitch radii. A fifteen-tooth compound pinion on the third arbor drives the sixty-tooth cage ring in a separate rear plane, while a ten-tooth fourth pinion and a thirty-tooth transfer wheel drive the six-tooth seconds pinion for an exact 720-turn sweep.',
      fact: 'Box teeth show conceptual mesh contact; involute profiles, backlash and tooth stress are not precision validated.', view: 'front', mode: 'solid', explode: 0 },
    { title: 'One cage carries an entire oscillator', short: 'Watch the moving frame',
      text: 'The open cage rotates around the central clock axis while carrying the balance, escape wheel, pallet fork, upper escape fan and six roller jewels. Six fine columns sit outside the balance rim, and front and rear annular rails keep the view open. The balance oscillates relative to that rotating frame, not about a fixed world-space hinge or an unrelated animation pivot.',
      fact: 'Inspection speeds are deliberately slowed; no gravitational error correction or timing accuracy is predicted.', view: 'detail', mode: 'solid', explode: .12 },
    { title: 'A visible spring without an elastic claim', short: 'Adjust balance amplitude',
      text: 'Ninety-six constant-length copper segments form a multi-turn hairspring representation. Their prescribed angles follow the balance, making the spiral appear to wind and unwind without stretching the segments. A visibly free outer inspection tail avoids pretending that this construction solves an anchored elastic spring. The amplitude control changes the balance and this qualitative spring geometry together.',
      fact: 'Amplitude is limited to 15–42 degrees, and the rendered balance and spiral stay inside the cage-column envelope.', view: 'top', mode: 'xray', explode: .15 },
    { title: 'Alternating lock and illustrative release', short: 'Follow the pallet fork',
      text: 'The fork rocks between two pallet positions as the balance reverses direction. The escape wheel dwells during the lock interval and advances one conceptual tooth during a smooth release window. These poses explain intermittent motion, but they are scheduled kinematics rather than contact-derived impulses, a power balance or a simulation of a real lever escapement.',
      fact: 'Twelve prescribed releases occur per cage turn; contact forces and accurate pallet locking faces are intentionally not claimed.', view: 'detail', mode: 'cutaway', explode: .28 },
    { title: 'The full period includes the hands', short: 'Inspect the skeleton movement',
      text: 'The minute, hour and small-seconds displays preserve exact integer ratios, including a 720-turn seconds sweep driven through the 30:10:30:6 train. A complete master period therefore contains twelve cage revolutions, one hour-hand revolution and integer turns of every gear. Open bridges, jeweled bearings, copper barrel coils, a ratchet and click, a movable regulator index and a fine outer index ring remain legible without a massive backing disk.',
      fact: 'Pale bridge covers ghost in x-ray; low quality keeps every functional assembly and removes only secondary service details.', view: 'home', mode: 'xray', explode: .52 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
