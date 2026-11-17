import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'octopus',
  title: 'OCTAVIA O8',
  family: 'Tendon-driven Mechanical Octopus',
  collection: '008',
  tagline: 'Eight curling arms. Sixty-four vertebrae. A wave of precision.',
  description: 'An open-bell biomechanical octopus with a radial eight-output bevel distributor, stacked motor and electronics rings, stereo optics, and eight tapered, double-cup-row arms. Analytic rigid-body articulation illustrates a conceptual underwater manipulator; it does not simulate swimming, suction forces, or tendon elasticity.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Wave cadence', min: 0.05, max: 0.45, step: 0.01, unit: 'Hz', precision: 2 },
    { key: 'curl', label: 'Curl amplitude', min: 0, max: 1, step: 0.01, unit: '', precision: 2 },
  ],
  specs: [{ value: '08', label: 'ARMS' }, { value: '64', label: 'VERTEBRAE' }],
  cycleLabel: 'ARM WAVE',
  cycleHz,
  sample,
  lessons: [
    {
      title: 'A bell, not a walking chassis', short: 'Read the octopus silhouette',
      text: 'Twelve spaced armor ribs rise from a flared mantle rim into a narrow crown. The empty bays expose stacked electronics and the motor. Eight continuously curved, tapered arms hang below the bell; none uses a spider-like knee or a planted foot.',
      fact: 'This is a suspended underwater manipulation study. Buoyancy, swimming and contact forces are not solved.',
      view: 'home', mode: 'solid', explode: 0,
    },
    {
      title: 'Eight outputs around one core', short: 'Inspect the bevel distributor',
      text: 'A 24-tooth conical crown turns about the vertical axis. Eight radial 12-tooth pinions turn twice per crown revolution and feed the arm-root cartridges. Tooth blocks illustrate the bevel layout, not manufactured conjugate tooth profiles. Local yaw servos and pitch tendons follow prescribed commands rather than a simulated power train.',
      fact: 'Illustrated ratio 24:12 = 2:1 speed increase; no torque or tooth-contact calculation.',
      view: 'top', mode: 'xray', explode: 0.16,
    },
    {
      title: 'A traveling wave with rigid bones', short: 'Follow the nested gimbals',
      text: 'Every arm has eight fixed-length vertebrae. Universal-joint order alternates pitch→yaw and yaw→pitch, with bearings aligned to each actual rotation axis. A sine wave advances by 0.58 radians per vertebra. Neighboring arms are a quarter-cycle apart; diametrically opposite arms share a phase so the machine stays centered.',
      fact: '1.210 m per chain; 64 rigid links and 128 revolute axes. Cadence changes time, curl changes the wave excursion.',
      view: 'side', mode: 'solid', explode: 0,
    },
    {
      title: 'Two tendons, two rows of cups', short: 'Trace the pneumatic path',
      text: 'Opposed telescopic spans join the upstream and downstream pitch frames. Their endpoint separation follows the exact joint pose, while the sleeves stay rigid. A yaw servo sits at the orthogonal bearing. Each vertebra carries a manifold, paired valve plugs and two recessed, ring-lipped vacuum cups, forming two continuous rows along an arm.',
      fact: '128 cups and 128 pitch tendon spans. Straight spans omit pulley routing, elastic stretch, seals and pressure dynamics.',
      view: 'detail', mode: 'cutaway', explode: 0.12,
    },
    {
      title: 'Separate the mantle and its nervous system', short: 'A reversible layered teardown',
      text: 'Explode lifts the ribbed carapace, separates the stacked controller and motor rings, and fans apart the gimbal, vertebra and tendon assemblies. X-ray fades only exterior armor, leaving bearings, cups, lenses and electronics opaque. Returning to zero restores the exact live assembled pose.',
      fact: 'Inspection views are disassembly diagrams, not physical configurations. The operating envelope applies to assembled poses.',
      view: 'front', mode: 'xray', explode: 0.85,
    },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
