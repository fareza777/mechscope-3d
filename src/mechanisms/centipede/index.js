import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'centipede', title: 'MYRIA M24', family: 'Metachronal Centipede', collection: '011',
  description: 'Twelve low armored cartridges carry twenty-four three-link legs, exposed inter-segment gimbals and a sequential metachronal drive wave. A tapered sensor head and split tail carry jointed feelers. This deterministic fixed-datum service demonstration illustrates rigid kinematics, not free locomotion, dynamics or biological anatomy.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Service cadence', min: .12, max: .85, step: .01, unit: 'Hz', precision: 2 },
    { key: 'wave', label: 'Wave amplitude', min: .25, max: 1, step: .01, unit: 'ratio', precision: 2 },
  ],
  specs: [{ label: 'MODULES', value: '12' }, { label: 'LEGS', value: '24' }],
  cycleLabel: 'METACHRONAL SERVICE WAVE', cycleHz, sample,
  lessons: [
    { title: 'One moving wave, twenty-four exact legs', short: 'Sequential support exchange', text: 'Each successive cartridge delays the leg command by one sixth of a cycle. The opposite side is half a cycle away, making raised feet progress along the train instead of lifting all legs together. Every ankle includes an explicit support state and position; the displayed support count is not a force balance or a prediction of traction.', fact: 'Each foot spends 66 percent of its period in the support interval; opposite sides differ by half a cycle.', view: 'side', mode: 'solid', explode: 0 },
    { title: 'A flexible outline made from rigid cartridges', short: 'Twelve 195 mm intervals', text: 'The spine starts at a fixed front datum. Each new yaw pin is constructed from the preceding pin plus a rigid 195 mm vector. A small traveling yaw schedule bends the outline without stretching the body. Exposed kingpins, transverse trunnions and open gimbal yokes make every inter-segment joint legible between the staggered scale covers.', fact: 'Total pin-to-pin spine length is 2,340 mm; maximum absolute module yaw is about 3.72 degrees.', view: 'top', mode: 'xray', explode: .12 },
    { title: 'Inverse kinematics, not telescoping shins', short: '75 / 190 / 265 mm', text: 'A short horizontal coxa reaches outside the cartridge, then two fixed-length links solve the current ankle target by intersecting reach spheres. The upward solution branch remains continuous through the support and raised-return intervals. Fork cheeks, torque tubes and external knee wheels are separate visible mechanisms, not a collection of animated endpoint markers.', fact: 'All 72 leg links retain their exact lengths; the support shoe stays level at the floor datum.', view: 'front', mode: 'solid', explode: .08 },
    { title: 'The amplitude control changes both waves', short: 'Step stroke and spine yaw', text: 'Increasing wave amplitude increases the fore-and-aft step stroke, raised-return height, small spine yaw and feeler scan. It does not move the entire sculpture through the scene. The legal range is deliberately narrow enough to keep neighboring leg lanes and body cartridges apart while preserving an obvious sequential wave at inspection speed.', fact: 'Commanded stride is 38–68 mm and maximum foot lift is 39–60 mm across the legal amplitude range.', view: 'home', mode: 'solid', explode: 0 },
    { title: 'Distributed drives beneath separate scales', short: 'A serviceable machine train', text: 'Every body module has its own exposed ventral copper stator and phase-indexed bronze rotor. Three shallow overlapping shell scales protect that module only; they do not bridge the articulation gaps. A segmented tapered head, optical belt and two pairs of articulated feelers distinguish front and rear. Low quality removes small clips and fins while preserving all selectable structure.', fact: 'X-ray fades shell only; explosion is a reversible inspection transform, never a new kinematic solution.', view: 'detail', mode: 'xray', explode: .60 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
