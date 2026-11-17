import { DEFAULT_INPUTS, cadenceOf, sample } from './kin.js';

export const descriptor = {
  id: 'mantis', title: 'MANTIS M6', family: 'Raptorial Mantis Robot', collection: '007',
  tagline: 'Four support feet. Two folding arms. A watchful triangular head.',
  description: 'A tall, narrow conceptual biomimetic robot with an open prothorax, swivel optics, lifted wing covers and paired serrated graspers. The supplied Teardown reference informs the inspectable mechanism language; its gait, linkage dimensions and servo sequencing are illustrative engineering choices, not biological measurements or a dynamics simulation.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Mechanism frequency', min: .10, max: .6, step: .01, unit: 'Hz', precision: 2 },
    { key: 'reach', label: 'Grasper excursion', min: 0, max: 1, step: .01, unit: '', precision: 2 },
  ],
  specs: [{ value: '4+2', label: 'LEGS' }, { value: '145', label: 'COUPLER · MM' }],
  cycleLabel: 'FOLD / RETURN CYCLE', cycleHz: cadenceOf, sample,
  lessons: [
    { title: 'A different body plan', short: 'Height and negative space', text: 'The narrow segmented abdomen carries four support legs, while an inclined open prothorax lifts the triangular sensor head and two raptorial arms. The upper eye corners and lower central jaw define a triangle, not a spherical robot head. Lifted wing covers frame an exposed dorsal drive instead of hiding the whole body.', fact: 'Six limbs have two distinct jobs: four supporting legs and two folding graspers. Wing covers are service panels, not simulated aerodynamic surfaces.', view: 'home', mode: 'solid', explode: 0 },
    { title: 'Feet solved from two rigid lengths', short: 'A shared floor datum', text: 'A 130 mm yaw coxa directs each 480 mm femur and 630 mm tibia toward its pad. The upper intersection of the two reach spheres sets the knee. Diagonal pairs alternate with a 72% geometric support interval; no scale animation changes a structural rail.', fact: 'The feet rise at most 90 mm. Pad contact is geometric; static stability, friction and support forces are not calculated.', view: 'front', mode: 'xray', explode: .1 },
    { title: 'A four-bar behind each folded arm', short: 'A pin-coupled closure', text: 'The jaw-angle schedule sets the tibial rocker pin. A circle about the fixed motor pivot and a circle about that rocker pin locate the crank tip on a single non-singular branch. A 75 mm crank, 145 mm coupler and 85 mm rocker therefore close exactly at every aperture. Outboard layers keep the rods separate from the serrated gripping channel.', fact: 'The ground link is the fixed separation of the motor pivot and wrist on the 380 mm femur. Aperture is prescribed; crank torque is not predicted.', view: 'detail', mode: 'cutaway', explode: .12 },
    { title: 'Opposing teeth without a solid fist', short: 'Femur against folded tibia', text: 'A broad open femur cage faces a narrower returning tibia. Staggered tooth rows occupy only the separated middle portions of the two members, leaving the wrist hinge clear. The end hook follows the same rigid 340 mm tibial direction used by the closure solver, so there is no independent decorative finger animation.', fact: 'Minimum included opening is 0.28 rad; maximum is 1.08 rad at full excursion. These are design limits, not measured mantis joint limits.', view: 'side', mode: 'solid', explode: 0 },
    { title: 'Look through the service panels', short: 'Sensors, gears and telescopes', text: 'Explode lifts the wing cassettes, shell strips, head frame and individual pin stacks away from their load paths. A yaw-and-pitch head carries two independently swivelling lens cartridges; torso and limb drives remain opaque in x-ray. Actuator rod-end pins sit on rigid brackets fixed in the support-femur and raptorial shoulder-link frames. The rods follow their clevis separation while their barrels remain constant-length.', fact: 'Only shell material fades. Low quality removes secondary fasteners, winding details and cable clips without removing any selectable assembly.', view: 'top', mode: 'xray', explode: .6 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
