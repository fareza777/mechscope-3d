import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'planetary', title: 'ORBIT P3', family: 'Epicyclic Gearbox', collection: '017',
  description: 'A fixed 72-tooth internal ring surrounds a 24-tooth sun and three 24-tooth planets. Curved twin carriers, rolling needle sets, an exact 12:6:12 oil pump, a rotating selector fork, a bolted output flange and a sliding output spline reveal the complete load path.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Carrier cadence', min: .03, max: .25, step: .01, unit: 'Hz', precision: 2 },
    { key: 'sleeve', label: 'Inspection sleeve travel', min: 0, max: 1, step: .05, unit: 'ratio', precision: 2 },
  ],
  specs: [{ value: '4:1', label: 'REDUCTION' }, { value: '3', label: 'PLANETS' }],
  cycleLabel: 'CARRIER ORBIT', cycleHz, sample,
  lessons: [
    { title: 'One sun, three travelling worlds', short: 'The carrier is the slow output', text: 'The central sun drives three equally spaced planets against a stationary internal ring. Each planet spins backwards while its pin orbits forwards on the carrier. The three paths share the load conceptually; this display does not estimate tooth forces, efficiency or bearing life.', fact: '24 sun teeth, 24 planet teeth and 72 ring teeth give a fixed-ring reduction of 4:1.', view: 'home', mode: 'solid', explode: 0 },
    { title: 'Read the exact Willis balance', short: 'Relative speeds close the equation', text: 'Subtract the carrier speed before comparing the sun and ring. With the carrier at one turn, the sun at four and the fixed ring at zero, 24 × (4 − 1) + 72 × (0 − 1) equals zero exactly. Each planet has an absolute speed of minus two turns per carrier orbit.', fact: 'Willis residual is exactly 0; all absolute rotation ratios are integers and repeat each orbit.', view: 'front', mode: 'xray', explode: 0 },
    { title: 'Look inward at the ring', short: 'Internal teeth, not an external gear', text: 'The large ring is assembled from twelve annular rim sectors with seventy-two teeth projecting inward. No solid disk closes the viewing aperture. Tooth phase is synchronized at all six nominal pitch contacts; rectangular teaching teeth are conceptual geometry rather than precision involute profiles.', fact: 'Pitch radii are 180 mm, 180 mm and 540 mm; the planet-centre orbit radius is 360 mm.', view: 'detail', mode: 'cutaway', explode: .12 },
    { title: 'A pin needs two real supports', short: 'Separate front and rear carrier planes', text: 'Curved spokes carry each planet pin between a rear frame and a forward frame. Eight individually selectable needle rollers and a needle cage move around every planet bearing, while eighteen outer ring rollers orbit inside a rotating cage. The gear faces occupy a separate axial lane, leaving the bearing rollers, retention caps and pin connections visible. The external cage and cradle hold the fixed ring without crossing the rotating gear sweep.', fact: 'Gear faces stay between z = −40 and +40 mm; carrier frames sit at z = ±135 mm.', view: 'side', mode: 'solid', explode: .3 },
    { title: 'Slide a sleeve, not a gear ratio', short: 'Inspect the output spline', text: 'The inspection sleeve moves axially along a long splined output shaft while remaining rotationally keyed to the carrier. A stationary fork rides in its circumferential groove, and a separate rotating selector shaft drives an axially stroking service fork above the ring. A forward 12:6:12 pump train and its five-lobe rotor add visible auxiliary motion without changing the epicyclic speed relationship.', fact: 'Sleeve travel is 110 mm and retains positive spline overlap at both control limits.', view: 'top', mode: 'solid', explode: .75 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
export default descriptor;
