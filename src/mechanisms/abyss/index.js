import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'abyss', title: 'ABYSS S9', family: 'Pelagic Shark Mechanism', collection: '022',
  tagline: 'Twenty rigid axial links, a travelling swim wave, forked tail, gimballed fins and a rocking service cradle.',
  description: 'A supported shark-shaped mechanism: fourteen vertebral links and six caudal links carry a prescribed travelling wave of increasing amplitude, with a forked two-lobe tail, pectoral fins on shoulder gimbals, five hinged gill stations per side, an opening lower mandible, eye gimbals and a belly service window. Hydraulic rams and copper tendons bridge the spine joints inside pale scale armor. Fluid load, buoyancy, bite force, gill airflow and free swimming are not simulated; the cradle is a display fixture rather than a certified lifting device.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Swim cadence', min: 0.15, max: 0.9, step: 0.01, unit: 'Hz', precision: 2 },
    { key: 'tail', label: 'Swim sweep', min: 3, max: 15, step: 1, unit: '°', precision: 0 },
    { key: 'gape', label: 'Jaw gape', min: 0, max: 28, step: 1, unit: '°', precision: 0 },
    { key: 'fin', label: 'Fin pitch', min: 0, max: 25, step: 1, unit: '°', precision: 0 },
  ],
  specs: [{ value: '20', label: 'AXIAL LINKS' }, { value: '2660', label: 'SPAN · MM' }],
  cycleLabel: 'CURRENT', cycleHz, sample,
  lessons: [
    { title: 'A travelling wave through twenty rigid links', short: 'Trace the swim wave',
      text: 'Fourteen vertebral links and six caudal links form one serial chain. Each link is aimed from the previous pin with a normalized direction, so pin spacing cannot stretch while the joint amplitude grows toward the tail. The wave travels rearward through the chain and the tail tip sweeps visibly from side to side. The Swim cadence control sets cycle speed and the Swim sweep control scales every joint amplitude; neither adds a translation to the supported specimen.',
      fact: 'Every axial station is a rigid link with an exact 105 mm or 90 mm pin length, not a scaled or skinned mesh.', view: 'top', mode: 'solid', explode: 0 },
    { title: 'Forked tail and gimballed pectoral fans', short: 'Inspect the swimming surfaces',
      text: 'The last caudal pin carries a dark hinge block with two brass trunnions and a teal bearing jewel. Upper and lower caudal lobes scissor independently on that fork axis, each built from titanium rays, dark cross ribs and pale shell webs. Both pectoral fins sit on shoulder gimbals with brass rings and jeweled trunnions; their four separate rays feather in the blade. Fin pitch and the sampled wave drive the fins, while the pelvic, dorsal and anal fins turn on their own hinge saddles.',
      fact: 'Both tail lobes and all four pectoral rays per side are separate selectable parts with their own pivots.', view: 'detail', mode: 'solid', explode: 0.16 },
    { title: 'Five gill pairs, a real jaw hinge and eye gimbals', short: 'Read the head services',
      text: 'Ten gill flaps, five per side, hang on flank hinges beside fixed brass arch cartridges. Each flap swings through a sampled opening and carries a teal bearing jewel. The lower mandible turns on a transverse brass pin below the rigid upper palatine battery; eight teeth on each jaw are geometry rather than a texture. Both eyes turn on side trunnions inside fixed orbital pads. No airflow, gas exchange, bite force or optical sensing is solved.',
      fact: 'The gill flaps, mandible and both eye modules are independently addressable moving parts.', view: 'front', mode: 'cutaway', explode: 0.24 },
    { title: 'A cradle that rocks, not a floating specimen', short: 'Read the service stand',
      text: 'The ballasted base, two guide posts, crossbeam and U-shaped belly cradle are separate display parts. Four brass rollers, a rocker beam and a trunnion let the cradle make a small display arc under the pectoral girdle, while the winch drum and crank turn on the beam. Safety straps and guide shoes remain visible. The cradle is a display support: no lifting load, overturning case, anchor strength or free-floating buoyancy is calculated.',
      fact: 'The specimen is supported throughout; the stand rollers and rocker are kinematic display details only.', view: 'home', mode: 'solid', explode: 0.38 },
    { title: 'Armor, rams and the limits of the model', short: 'Know the limits',
      text: 'Pale cowls and flank scale cassettes form the shell and ghost in X-ray, exposing fourteen vertebral frames, paired hydraulic rams, copper tendon runs, costal ribs and an open belly service window. Every moving pin is deterministic and periodic from one sampled pose. The model does not claim body bending beyond the prescribed serial wave, skin, muscle, drag, wake, gill flow, bite force, buoyancy or live-animal behavior; proportions are an artistic mechanism study, not a validated species reconstruction.',
      fact: 'All motion is a deterministic function of phase and the four controls; hydrodynamic and biological claims are out of scope.', view: 'side', mode: 'xray', explode: 0.5 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
