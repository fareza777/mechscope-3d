import { createMechanicalKit } from '../mechanical-kit.js';
import { D, ROCKER_DATUM, TAU, poseAt, sample, wingPoint } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('LIBELLE D4 · mechanical dragonfly');
  const nodes = [], shoulders = [], tails = [], legs = [];
  let disposed = false, lastState = sample(0);
  const part = (id, name, system, purpose, how, parent, explode = [0, 0.12, 0], material = 'Titanium, brass and insulated conductors') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const add = kit.add, rod = kit.rod;
  const collar = (node, p, r, material = 'titanium', reach = 0) => {
    add(node, 'ring', material, p, [r, r, r]);
    add(node, 'cylinder', 'brass', [p[0], p[1], p[2] + reach / 2], [r * 0.47, 0.026 + reach, r * 0.47], [Math.PI / 2, 0, 0]);
    add(node, 'bolt', 'dark', [p[0], p[1], p[2] - 0.019], [r * 0.26, 0.015, r * 0.26], [Math.PI / 2, 0, 0]);
  };
  const stand = part('stand', 'Service pedestal and thorax cradle', 'Service support', 'Carries the hanging machine above the datum floor.', 'A low round foot, tapered column and twin cradle arms support the thorax; flight forces are not implied.', undefined, [0, 0, 0]);
  add(stand, 'cylinder', 'dark', [0, 0.025, 0], [0.29, 0.05, 0.29]);
  add(stand, 'cylinder', 'titanium', [0, 0.056, 0], [0.23, 0.014, 0.23]);
  add(stand, 'cone', 'dark', [0, 0.37, 0], [0.048, 0.62, 0.048]);
  rod(stand, 'titanium', [0, 0.45, 0], [0, 1.035, -0.16], 0.022);
  for (const x of [-0.11, 0.11]) rod(stand, 'dark', [0, 0.92, -0.12], [x, 1.10, -0.21], 0.015);
  kit.fasteners(stand, [[-0.16, 0.069, 0], [0.16, 0.069, 0], [0, 0.069, 0.16], [0, 0.069, -0.16]], 0.013);

  const frame = part('thorax.frame', 'Thoracic triangulated load cage', 'Thorax', 'Transfers four shoulder reactions into the central cradle.', 'Three elliptical hoops are joined by six separated longitudinal rails.');
  for (const z of [-0.46, -0.24, -0.02]) add(frame, 'ring', 'titanium', [0, 1.22, z], [0.165, 0.18, 0.165]);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    rod(frame, 'titanium', [0.16 * Math.cos(a), 1.22 + 0.17 * Math.sin(a), -0.46], [0.16 * Math.cos(a), 1.22 + 0.17 * Math.sin(a), 0.02], 0.012);
  }
  for (let i = 0; i < 3; i++) {
    const z = -0.4 + i * 0.17;
    const motor = part(`thorax.motor.${i + 1}`, `Axial motor ring ${i + 1}`, 'Power train', 'Indexes the shoulder eccentric drives.', 'A separated annular stator surrounds the shaft; twelve copper coil bars bridge the bearing faces.');
    for (const dz of [-0.045, 0.045]) add(motor, 'ring', 'dark', [0, 1.22, z + dz], [0.091, 0.091, 0.091]);
    rod(motor, 'titanium', [0, 1.22, z - 0.06], [0, 1.22, z + 0.06], 0.025);
    for (let k = 0; k < 12; k++) {
      const a = k * TAU / 12, x = 0.074 * Math.cos(a), y = 1.22 + 0.074 * Math.sin(a);
      rod(motor, 'copper', [x, y, z - 0.043], [x, y, z + 0.043], 0.009, true);
    }
    const armor = part(`thorax.cover.${i + 1}`, `Dorsal thorax fairing ${i + 1}`, 'Thorax armor', 'Protects one motor bay while leaving the side drive exposed.', 'A shallow separated shell plate fades in x-ray instead of obscuring the stator.', undefined, [0, 0.3, 0], 'Formed pale alloy shell');
    add(armor, 'sphere', 'shell', [0, 1.405, z], [0.15, 0.034, 0.072]);
    kit.fasteners(armor, [[-0.115, 1.427, z], [0.115, 1.427, z]], 0.01);
  }
  for (const side of [-1, 1]) {
    const cooling = part(`thorax.cooling.${side}`, `${side < 0 ? 'Port' : 'Starboard'} cooling comb`, 'Thermal service', 'Exposes cooling area along the motor rail.', 'Eleven short, separated fins are mechanically carried by an outer longitudinal rail.', undefined, [side * 0.16, 0.05, 0]);
    rod(cooling, 'dark', [side * 0.11, 1.10, -0.48], [side * 0.11, 1.10, 0.035], 0.014);
    for (let i = 0; i < 11; i++) add(cooling, 'box', 'titanium', [side * 0.11, 1.12, -0.46 + i * 0.045], [0.055, 0.07, 0.009], [0, 0, side * 0.25], true);
    const cable = part(`thorax.harness.${side}`, `${side < 0 ? 'Port' : 'Starboard'} service loom`, 'Electrical service', 'Connects the optic carrier and shoulder inspection terminals.', 'Two insulated runs curve as short fixed tube segments outside the load-bearing cage.', undefined, [side * 0.12, -0.07, 0]);
    for (let i = 0; i < 10; i++) {
      const p = k => [side * (0.145 + 0.02 * Math.sin(k * Math.PI / 10)), 1.14 - 0.025 * Math.sin(k * Math.PI / 10), -0.64 + k * 0.068];
      rod(cable, 'rubber', p(i), p(i + 1), 0.007);
      const a = p(i), b = p(i + 1); a[1] += 0.018; b[1] += 0.018;
      rod(cable, 'copper', a, b, 0.0035, true);
    }
  }

  const head = part('head.carrier', 'Split optic head and neck gimbal', 'Optics', 'Carries the two compound optic pods ahead of the thorax.', 'An open cross-yoke isolates the two lens hemispheres rather than using one spherical head.', undefined, [0, 0.08, -0.16]);
  rod(head, 'titanium', [0, 1.24, -0.46], [0, 1.26, -0.75], 0.035);
  rod(head, 'dark', [-0.16, 1.29, -0.74], [0.16, 1.29, -0.74], 0.038);
  add(head, 'sphere', 'shell', [0, 1.24, -0.77], [0.073, 0.07, 0.08]);
  for (const side of [-1, 1]) {
    const eye = part(`head.eye.${side}`, `${side < 0 ? 'Left' : 'Right'} compound optic array`, 'Optics', 'Distributes the optical aperture over a faceted hemisphere.', 'Thirty-one individually instanced lens facets sit on a dark hemispherical carrier; no vision computation is simulated.', head, [side * 0.16, 0.1, -0.12], 'Dark carrier, brass bezels and teal optical glass');
    eye.position.set(side * 0.135, 1.31, -0.79);
    add(eye, 'sphere', 'dark', [0, 0, 0], [0.137, 0.145, 0.13]);
    add(eye, 'ring', 'shell', [0, 0, 0.012], [0.14, 0.15, 0.14]);
    for (const [alpha, count] of [[0, 1], [0.4, 6], [0.77, 10], [1.13, 14]]) for (let j = 0; j < count; j++) {
      const a = j * TAU / count;
      const p = [0.14 * Math.sin(alpha) * Math.cos(a), 0.149 * Math.sin(alpha) * Math.sin(a), -0.134 * Math.cos(alpha)];
      add(eye, 'sphere', 'lens', p, [0.022, 0.025, 0.018]);
      add(eye, 'bolt', 'brass', [p[0], p[1], p[2] + 0.01], [0.026, 0.012, 0.026], [Math.PI / 2, 0, 0], true);
    }
    const antenna = part(`head.antenna.${side}`, `${side < 0 ? 'Left' : 'Right'} sensory whisker`, 'Optics', 'Protects the forward optical datum.', 'A two-section tapered feeler terminates in an inspection bead.', head, [side * 0.1, 0.04, -0.13]);
    rod(antenna, 'dark', [side * 0.055, 1.27, -0.84], [side * 0.1, 1.35, -1.02], 0.007);
    rod(antenna, 'titanium', [side * 0.1, 1.35, -1.02], [side * 0.16, 1.38, -1.125], 0.004);
    add(antenna, 'sphere', 'teal', [side * 0.16, 1.38, -1.125], [0.011, 0.011, 0.011]);
  }

  for (const w of lastState.wings) {
    const prefix = `wing.${w.id}`, label = `${w.station === 0 ? 'Fore' : 'Hind'} ${w.side < 0 ? 'left' : 'right'}`;
    const root = part(`${prefix}.housing`, `${label} shoulder bearing carrier`, 'Wing drive', 'Locates the fixed crank and rocker axes.', 'Twin bearing bosses and diagonal stays hold the 90 by 130 mm pivot offset.', undefined, [w.side * 0.18, 0.14, w.station ? 0.12 : -0.12]);
    root.position.fromArray(w.origin); root.rotation.y = w.side < 0 ? Math.PI : 0;
    collar(root, [0, 0, 0], 0.042);
    collar(root, D.crankOrigin, 0.047);
    // Rear stays clear the outboard conrod and extended eccentric journal.
    for (const z of [-0.075, -0.035]) rod(root, 'titanium', [0, 0, z], [-0.09, -0.13, z], 0.016);
    const crank = part(`${prefix}.crank`, `${label} eccentric drive disk`, 'Wing drive', 'Converts shaft rotation into a circular input pin path.', 'A 16-tooth inspection gear and slotted radial arm rotate about the lower fixed bearing.', root, [0, -0.08, -0.07]);
    crank.position.fromArray(D.crankOrigin);
    // gear() is normal to Y; this fixed carrier makes its normal Z.
    const gear = part(`${prefix}.gear`, `${label} phase indexing gear`, 'Wing timing', 'Makes the fore/hind mechanical phase relationship visible.', 'Sixteen teeth surround the crank shaft; the hind pair is indexed half a turn after the fore pair.', crank, [0, 0, -0.025]);
    gear.rotation.x = Math.PI / 2; kit.gear(gear, 0.058, 16, 0.018, 'brass');
    rod(crank, 'dark', [0, 0, -0.02], [0.045, 0, -0.02], 0.012);
    const pin = part(`${prefix}.eccentric`, `${label} adjustable eccentric pin`, 'Wing drive', 'Sets the wing excursion through the radius control.', 'The pin translates in the disk slot before rotation; it does not change connecting-rod length.', crank, [0, 0, 0.035]);
    collar(pin, [0, 0, 0], 0.015, 'titanium', D.conrodZ);
    const rocker = part(`${prefix}.rocker`, `${label} wing-root rocker`, 'Wing drive', 'Turns conrod motion into rigid wing-root rotation.', 'A 95 mm lever is built at the neutral shoulder datum and rotates with the complete wing.', root, [0.055, 0.07, 0]);
    const lever = [D.rocker * Math.cos(ROCKER_DATUM), D.rocker * Math.sin(ROCKER_DATUM), 0];
    rod(rocker, 'titanium', [0, 0, 0], lever, 0.012); collar(rocker, lever, 0.018, 'titanium', D.conrodZ);
    const link = part(`${prefix}.conrod`, `${label} 155 mm connecting rod`, 'Wing drive', 'Closes the eccentric–rocker triangle.', 'Twin rigid rails and pin eyes are aimed at the two analytic endpoints on every update.', root, [0, -0.07, 0.085]);
    for (const x of [-0.008, 0.008]) rod(link, 'titanium', [x, 0, 0], [x, D.conrod, 0], 0.0055);
    for (const y of [0, D.conrod]) collar(link, [0, y, 0], 0.015);
    for (const y of [0.04, 0.08, 0.12]) rod(link, 'dark', [-0.008, y, 0], [0.008, y, 0], 0.004, true);
    for (let bay = 0; bay < 7; bay++) {
      const lattice = part(`${prefix}.bay.${bay + 1}`, `${label} venation bay ${bay + 1}`, 'Wing lattice', `Carries the spanwise load through wing bay ${bay + 1} of seven.`, 'Paired edge rails, longitudinal veins, split cross-spars and fine crossed braces leave open tapered cells.', rocker, [0.025 * (bay + 1), 0.025, 0]);
      const u = bay / 7, v = (bay + 1) / 7, point = (s, c) => wingPoint(w.station, w.side, s, c);
      for (const c of [-0.55, -0.48, 0, 0.25, 0.5]) rod(lattice, c < -0.4 ? 'titanium' : 'dark', point(u, c), point(v, c), c < -0.4 ? 0.008 : 0.0038);
      for (const c of [-0.5, 0]) {
        rod(lattice, 'titanium', point(Math.min(v, 0.985), c), point(Math.min(v, 0.985), c + 0.5), 0.004);
        rod(lattice, 'dark', point(u, c), point(v, c + 0.5), 0.0028);
        rod(lattice, 'dark', point(u, c + 0.5), point(v, c), 0.0028);
        rod(lattice, 'copper', point((u + v) / 2, c), point((u + v) / 2, c + 0.5), 0.002, true);
      }
      // The mathematical tip merges all chords; put cap hardware just inboard.
      const caps = [-0.48, 0, 0.48].map(c => point(Math.min(v, 0.975), c));
      kit.fasteners(lattice, caps, 0.005);
    }
    const stigma = part(`${prefix}.balance`, `${label} outboard balance insert`, 'Wing lattice', 'Marks the reinforced leading-edge outboard cell.', 'A short alloy insert follows the rail rather than filling the wing outline.', rocker, [0.17, 0.025, 0], 'Pale shell and brass');
    const p = wingPoint(w.station, w.side, 0.84, -0.44);
    add(stigma, 'box', 'shell', p, [0.14, 0.011, 0.031], [0, -w.side * (w.station ? 0.19 : -0.19), 0]);
    rod(stigma, 'brass', wingPoint(w.station, w.side, 0.78, -0.5), wingPoint(w.station, w.side, 0.9, -0.5), 0.006);
    shoulders.push({ root, crank, pin, rocker, link });
  }

  for (let i = 0; i < D.abdomenCount; i++) {
    const radius = 0.074 - i * 0.0066;
    const tail = part(`abdomen.${i + 1}.frame`, `Abdomen cartridge ${i + 1}`, 'Abdomen', 'Preserves a rigid 124 mm pin-to-pin pitch link.', `Cartridge ${i + 1} follows the traveling trim schedule; its rails never stretch.`, undefined, [0, -0.08, 0.05 + i * 0.025]);
    for (const z of [0.015, D.abdomenLength - 0.01]) add(tail, 'ring', 'dark', [0, 0, z], [radius, radius * 0.85, radius]);
    for (const a of [0, TAU / 3, 2 * TAU / 3]) rod(tail, 'titanium', [radius * Math.cos(a), radius * 0.85 * Math.sin(a), 0.012], [radius * Math.cos(a), radius * 0.85 * Math.sin(a), D.abdomenLength - 0.008], 0.006);
    const hinge = part(`abdomen.${i + 1}.hinge`, `Abdomen pitch hinge ${i + 1}`, 'Abdomen joints', 'Allows pitch while constraining the cartridge origin.', 'A transverse trunnion, two retainers and a copper bush expose the articulation axis.', tail, [0.055, 0, 0]);
    add(hinge, 'cylinder', 'brass', [0, 0, 0], [0.018, radius * 2.2, 0.018], [0, 0, Math.PI / 2]);
    for (const side of [-1, 1]) add(hinge, 'bolt', 'dark', [side * radius * 1.13, 0, 0], [0.023, 0.008, 0.023], [0, 0, Math.PI / 2]);
    for (const side of [-1, 1]) {
      const cover = part(`abdomen.${i + 1}.armor.${side}`, `Abdomen ${i + 1} ${side > 0 ? 'dorsal' : 'ventral'} scute`, 'Abdomen armor', 'Protects one side without merging neighboring segments.', 'Each shallow scute leaves the joint and lateral rails exposed and can separate independently.', tail, [0, side * 0.07, 0], 'Formed pale alloy shell');
      add(cover, 'sphere', 'shell', [0, side * radius * 0.76, 0.063], [radius * 0.85, 0.018, 0.05]);
      kit.fasteners(cover, [[-radius * 0.5, side * radius * 0.85, 0.04], [radius * 0.5, side * radius * 0.85, 0.08]], 0.005);
    }
    for (const side of [-1, 1]) rod(tail, 'copper', [side * radius * 0.7, -radius * 0.35, 0], [side * radius * 0.7, -radius * 0.35, D.abdomenLength], 0.0035, true);
    tails.push(tail);
  }
  for (const l of lastState.legs) {
    const root = part(`leg.${l.id}.coxa`, `Leg ${l.id} coxa bearing`, 'Landing appendages', 'Carries the hanging three-link inspection leg.', 'The coxa bolts to the thorax; the articulated foot does not support the model.', undefined, [l.side * 0.11, -0.05, 0]);
    root.position.fromArray(l.origin); root.rotation.y = l.side < 0 ? Math.PI : 0;
    collar(root, [0, 0, 0], 0.028);
    const links = [];
    D.legLengths.forEach((length, j) => {
      const node = part(`leg.${l.id}.${['femur', 'tibia', 'tarsus'][j]}`, `Leg ${l.id} ${['femur', 'tibia', 'tarsus'][j]}`, 'Landing appendages', `Maintains the ${length * 1000} mm appendage link.`, 'Parallel rails, a pin eye and cross-spacers move as one rigid link between sampled joints.', root, [0.035 * (j + 1), -0.035 * (j + 1), 0]);
      for (const x of [-0.009, 0.009]) rod(node, 'titanium', [x, 0, 0], [x, length, 0], 0.0055);
      collar(node, [0, 0, 0], 0.018);
      for (const f of [0.22, 0.5, 0.78]) {
        rod(node, 'dark', [-0.012, length * f, 0], [0.012, length * f, 0], 0.004, true);
        add(node, 'bolt', 'brass', [0, length * f, -0.009], [0.007, 0.012, 0.007], [Math.PI / 2, 0, 0], true);
      }
      rod(node, 'rubber', [0, 0.02, 0.013], [0, length - 0.018, 0.013], 0.003);
      if (j === 2) for (const side of [-1, 1]) rod(node, 'dark', [0, length - 0.018, 0], [side * 0.025, length + 0.027, 0], 0.006);
      links.push(node);
    });
    legs.push({ root, links });
  }

  // Restore bind transforms before every pose: kit.sync temporarily offsets parents
  // for explode, so no accumulated subtract/add roundoff may leak into later frames.
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.wings && state?.abdomen && state?.legs) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, { eccentric: lastState.metrics.eccentricMm, cadence: lastState.metrics.crankRpm / 60 });
    for (const { node, p, q } of bind) { node.position.copy(p); node.quaternion.copy(q); }
    shoulders.forEach((s, i) => {
      const w = lastState.wings[i];
      s.crank.rotation.z = w.phaseAngle; s.pin.position.x = w.radius;
      s.rocker.rotation.z = w.angle; kit.aim(s.link, w.crank, w.rocker);
      // aim resets position: translate the complete rod, eyes and retainers
      // together after every aim, before sync adds the exploded-view offset.
      s.link.position.z = D.conrodZ;
    });
    tails.forEach((node, i) => { node.position.fromArray(lastState.abdomen[i].start); node.rotation.x = -lastState.abdomen[i].pitch; });
    legs.forEach((leg, i) => leg.links.forEach((node, j) => kit.aim(node, lastState.legs[i].joints[j], lastState.legs[i].joints[j + 1])));
    kit.sync(options);
  }
  update(lastState);
  return { group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
