import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'crab', title: 'CRUSTA C10', family: 'Lateral Crab Walker', collection: '010',
  description: 'A broad, low crab-shaped machine sculpture with eight rigid three-link sidestep legs, two hooked differential pincers, raised scanning optics and exposed ventral drives. A deterministic fixed-datum service demonstration, not free locomotion, contact dynamics or a force-rated robot.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Service cadence', min: .12, max: .75, step: .01, unit: 'Hz', precision: 2 },
    { key: 'aperture', label: 'Claw amplitude', min: 0, max: 1, step: .01, unit: 'ratio', precision: 2 },
  ],
  specs: [{ label: 'LEGS / CLAWS', value: '8 / 2' }, { label: 'RIGID LINKS', value: '24' }],
  cycleLabel: 'SIDESTEP SERVICE CYCLE', cycleHz, sample,
  lessons: [
    { title: 'A crab moves sideways without elastic legs', short: 'Three exact pin intervals', text: 'Each of the eight lateral legs starts with a horizontal 110 mm coxa. The 280 mm femur and 370 mm tibia meet at the upward intersection of two reach spheres. Only the joint angles change: the open load rails, torque tube and visible journals remain rigid while the ankle traces its prescribed lateral path.', fact: 'Pin intervals are 110 / 280 / 370 mm; targets remain strictly inside the rigid reach annulus.', view: 'front', mode: 'solid', explode: 0 },
    { title: 'Alternation is a service command, not locomotion', short: 'Four or more shoes down', text: 'Opposite sides and alternating stations are indexed by half a cycle. A shoe spends 64 percent of its period in a level support interval and returns on a smooth 75 mm raised arch. The chassis datum stays fixed: support counts describe geometry, not equilibrium, friction or a simulated journey across the floor.', fact: 'The 88 mm lateral stroke and 64 percent support duty avoid a discontinuous half-cycle reset.', view: 'top', mode: 'solid', explode: 0 },
    { title: 'Two hooks surround a real empty throat', short: 'Opposed palm pinions', text: 'The two jaws in each palm rotate equally and oppositely around vertical pins. The bronze wheels occupy a raised lane above the bent fingers, while partial shell lobes frame an open differential window. Claw amplitude changes the opening envelope rather than stretching the fingers; even the minimum opening preserves space between the actual hook solids.', fact: 'Opening ranges from 0.22 to 0.64 radians; each jaw is a rigid two-section hooked finger.', view: 'detail', mode: 'solid', explode: .12 },
    { title: 'A hydraulic stroke needs two rigid sleeves', short: 'Anchors follow the link', text: 'Every leg and forearm has an offset actuator bracket. Its moving pin is transformed from the member-local frame, so it rotates with the rail rather than hovering at a world-axis offset. The barrel aims from its base and the polished rod aims back from the moving clevis; these two constant-length sleeves overlap intentionally as the pin distance changes.', fact: 'No actuator mesh scales with stroke; extended journals separate drive wheels from fork cheeks.', view: 'side', mode: 'xray', explode: .22 },
    { title: 'Lift the shell to read the machine', short: 'Covers are not the chassis', text: 'Seven shallow oval scutes and scalloped edge armor establish the low crab silhouette. Under them are four exposed copper-wound drive banks, service manifolds and an open perimeter cage. Two raised binocular turrets scan above the claws. Explosion temporarily separates logical assemblies; restoring solid view returns every instance to its exact posed matrix.', fact: 'X-ray ghosts shell material only; low quality keeps every selectable assembly and its structural silhouette.', view: 'home', mode: 'xray', explode: .65 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
