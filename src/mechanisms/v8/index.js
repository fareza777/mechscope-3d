import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'crossplane-v8',
  title: 'IGNIS V8',
  family: 'Cross-plane Engine',
  collection: '002',
  tagline: 'Eight cylinders. Four crank planes. One precisely timed cycle.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [{ key: 'rpm', label: 'Crank speed', min: 6, max: 120, step: 1, unit: 'rpm', precision: 0 }],
  specs: [{ value: '08', label: 'CYLINDERS' }, { value: '16', label: 'VALVES' }],
  cycleLabel: 'ENGINE CYCLE',
  cycleHz,
  sample,
  lessons: [
    {
      title: 'A cross-plane heartbeat', short: 'Four throws, eight cylinders',
      text: 'Two banks meet at 90°. Four crankpins occupy different angular planes, with two connecting rods sharing each pin. The crank turns clockwise when viewed from the +z inspection front.',
      fact: 'Firing order: 1–8–4–3–6–5–7–2. One firing event every 90° of crank rotation.',
      view: 'home', mode: 'xray', explode: 0,
    },
    {
      title: 'The exact slider-crank', short: 'Circular motion becomes a stroke',
      text: 'Each piston slides along its bank axis while the crankpin moves in a circle. The finite 145 mm connecting rod makes the piston motion different from a simple sine wave. Watch the rod angle change near mid-stroke.',
      fact: '44.5 mm crank radius × 2 = 89 mm piston stroke; all eight rods retain their centre distance.',
      view: 'detail', mode: 'cutaway', explode: 0,
    },
    {
      title: 'Breathe once in two revolutions', short: 'Half-speed cams and sixteen valves',
      text: 'One intake valve and one exhaust valve serve each cylinder. The crank drives a 24-tooth gear through an idler to each 48-tooth cam gear. The camshaft therefore makes one revolution per 720° engine cycle. Dual coil springs shorten as the valves open.',
      fact: 'Cam speed is exactly half crank speed. Peak valve lift is 10.5 mm.',
      view: 'top', mode: 'solid', explode: 0.2,
    },
    {
      title: 'Follow the charge', short: 'Intake, compression, power, exhaust',
      text: 'The live chamber column ends at the piston crown. Blue marks intake, grey marks compression and exhaust, and orange marks early combustion. This is a qualitative four-stroke visualization, not a calculation of power or fuel consumption.',
      fact: 'The intake opens at 340° and the exhaust closes at 380° after firing TDC: 40° of valve overlap.',
      view: 'side', mode: 'xray', explode: 0,
    },
    {
      title: 'Separate the load paths', short: 'A reversible layered teardown',
      text: 'The rocker cages, camshafts, heads and reciprocating assemblies separate along the bank axes. The sump and crank assembly lower in staggered stages. Return the slider to zero and every part returns to the same live crank pose.',
      fact: 'Five main bearing shells support the crank; the rear flywheel and front pulley turn with it.',
      view: 'home', mode: 'solid', explode: 1,
    },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};

export default descriptor;
