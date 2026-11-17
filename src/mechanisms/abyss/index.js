import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'abyss', title: 'ABYSS S9', family: 'Pelagic Shark Mechanism', collection: '022',
  tagline: 'Eighteen axial links, five gill stations per side and a hinged jaw on a service gantry.',
  description: 'A suspended shark-shaped mechanism: ten vertebral links, eight caudal links, open costal rails, paired pectoral and pelvic fins, five gill stations per side and a lower jaw on a transverse pin. The tail and fin pivots are exact kinematic chains; fluid load, buoyancy, bite force and gill airflow are not simulated, and the gantry is a display fixture rather than part of the animal.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Tail cadence', min: 0.15, max: 0.9, step: 0.01, unit: 'Hz', precision: 2 },
    { key: 'tail', label: 'Tail sweep', min: 3, max: 15, step: 1, unit: '°', precision: 0 },
    { key: 'gape', label: 'Jaw gape', min: 0, max: 28, step: 1, unit: '°', precision: 0 },
    { key: 'fin', label: 'Fin pitch', min: 0, max: 25, step: 1, unit: '°', precision: 0 },
  ],
  specs: [{ value: '18', label: 'AXIAL LINKS' }, { value: '2660', label: 'SPAN · MM' }],
  cycleLabel: 'CURRENT', cycleHz, sample,
  lessons: [
    { title: 'A swimming tail made of rigid links', short: 'Trace the caudal chain',
      text: 'The shark hangs from a service cradle while eight caudal links carry a traveling lateral wave. Each 100 mm link is built from the previous pin with a normalized direction, so the chain cannot stretch as the sweep changes. The last link carries the two tail-fin lobes, and the tip cap follows the final pin. Ten vertebral links stay locked in one straight axial series ahead of the tail.',
      fact: 'The axial chain has eighteen rigid links; the tail is a prescribed wave, not a fluid simulation.', view: 'side', mode: 'solid', explode: 0 },
    { title: 'Five gill stations, no fake airflow', short: 'Inspect the flank',
      text: 'Ten separate gill assemblies, five per side, sit proud of the flank with a dark compliant slit, two pale lips and a brass arch. Their spacing follows the body stations rather than a single texture. The model shows where water would pass, but no flow, pressure, gas exchange or heat transfer is solved, and the gill flaps do not open independently.',
      fact: 'Each gill station is a separate part so it can be selected and inspected in every quality tier.', view: 'detail', mode: 'solid', explode: 0.18 },
    { title: 'The jaw is a real hinge', short: 'Open the mandible',
      text: 'The lower mandible turns on a transverse brass pin below the snout. Twelve tapered teeth sit in a dark upper gum rail and twelve more rise from the lower jaw. The gape control rotates the whole mandible as one rigid body; it does not flex the jaw cartilage, replace teeth, or calculate bite force. The jaw hinge stays visible in Solid, X-ray and Cutaway.',
      fact: 'The gape range is 0 to 28 degrees and the tooth rows are geometry, not a texture.', view: 'front', mode: 'cutaway', explode: 0.28 },
    { title: 'A gantry, not a floating specimen', short: 'Read the display structure',
      text: 'The ballasted base, two tapered posts, crossbeam, U-cradle and safety straps are separate parts of the display fixture. The cradle touches the belly under the pectoral girdle and leaves the gills and fins clear. The winch and straps are structural illustrations; no lifting, load path, overturning or anchor strength is calculated, and the specimen should not be hung from this model.',
      fact: 'The gantry exists only for display; the mechanism is not a certified lifting or suspension device.', view: 'home', mode: 'solid', explode: 0.4 },
    { title: 'What the model can and cannot claim', short: 'Know the limits',
      text: 'Ten vertebral parts, eight caudal frames, fourteen rib rails, paired fins and a hinged jaw come from one sampled pose. The fins pitch around their roots and the tail sweeps laterally, but there is no body bending, skin, muscle, buoyancy, drag, wake, bite force or live-animal behavior. The pale shells are artistic forms and the proportions are not a validated reconstruction of any particular shark species.',
      fact: 'Every moving pin is deterministic and periodic; biological and hydrodynamic claims are out of scope.', view: 'top', mode: 'xray', explode: 0.5 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
