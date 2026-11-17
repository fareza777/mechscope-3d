import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { F, GILL_DATUM, TAU, caudalPoint, pectoralPoint, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('PISCES K9 · robotic koi');
  const nodes = [], vertebrae = [], servos = [], tendonNodes = [], gills = [], pectorals = [];
  let disposed = false, lastState = sample(0);
  const part = (id, name, system, purpose, how, parent, explode = [0, 0.12, 0], material = 'Titanium, brass and copper service hardware') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const add = kit.add, rod = kit.rod;
  const bearing = (node, p, radius) => {
    add(node, 'ring', 'titanium', p, [radius, radius, radius], [Math.PI / 2, 0, 0]);
    add(node, 'cylinder', 'brass', p, [radius * 0.5, 0.032, radius * 0.5]);
    add(node, 'bolt', 'dark', [p[0], p[1] + 0.024, p[2]], [radius * 0.28, 0.014, radius * 0.28]);
  };
  const planarBearing = (node, p, radius, reach = 0) => {
    add(node, 'ring', 'titanium', p, [radius, radius, radius]);
    add(node, 'cylinder', 'brass', [p[0], p[1], p[2] + reach / 2], [radius * 0.5, 0.03 + reach, radius * 0.5], [Math.PI / 2, 0, 0]);
    add(node, 'bolt', 'dark', [p[0], p[1], p[2] + 0.02], [radius * 0.3, 0.015, radius * 0.3], [Math.PI / 2, 0, 0]);
  };

  const stand = part('service.pedestal', 'Low service foot and neck support', 'Service support', 'Holds the fixed cervical cartridge above the datum floor.', 'A narrow mast meets an actual neck cradle; the fish is not free-floating in a fluid simulation.', undefined, [0, 0, 0]);
  add(stand, 'cylinder', 'dark', [0, 0.025, -0.43], [0.28, 0.05, 0.28]);
  add(stand, 'cylinder', 'titanium', [0, 0.057, -0.43], [0.23, 0.014, 0.23]);
  rod(stand, 'dark', [0, 0.064, -0.43], [0, 0.7, -0.68], 0.019);
  for (const side of [-1, 1]) rod(stand, 'titanium', [0, 0.6, -0.64], [side * 0.11, 0.81, -0.68], 0.013);
  kit.fasteners(stand, [[-0.17, 0.067, -0.43], [0.17, 0.067, -0.43], [0, 0.067, -0.26], [0, 0.067, -0.60]], 0.012);

  F.lengths.forEach((length, i) => {
    const width = F.widths[i], height = F.heights[i];
    const frame = part(`spine.${i + 1}.frame`, `Vertebra ${i + 1} open load frame`, 'Axial skeleton', `Maintains the ${Math.round(length * 1000)} mm pin spacing at station ${i + 1}.`, 'Two elliptical ribs and four narrow rails carry the armor without a solid cylinder filling the body.', undefined, [0, 0, 0.025 * i]);
    vertebrae.push(frame);
    for (const z of [length * 0.23, length * 0.79]) add(frame, 'ring', 'titanium', [0, 0, z], [width * 0.86, height * 0.87, width * 0.86]);
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4 + Math.PI / 4;
      rod(frame, 'dark', [width * 0.82 * Math.cos(a), height * 0.83 * Math.sin(a), length * 0.18], [width * 0.82 * Math.cos(a), height * 0.83 * Math.sin(a), length * 0.86], 0.008);
    }
    for (const x of [-0.025, 0.025]) rod(frame, 'titanium', [x, 0, 0], [x, 0, length], 0.009);
    for (const z of [0.025, length - 0.02]) rod(frame, 'titanium', [-width * 0.73, 0, z], [width * 0.73, 0, z], 0.009);
    const joint = part(`spine.${i + 1}.joint`, `Yaw trunnion ${i + 1}`, 'Spine joints', 'Constrains translation while allowing the commanded relative heading.', 'A vertical shaft, bearing race and opposed guide blocks expose the joint center.', frame, [0, -0.1, 0]);
    bearing(joint, [0, 0, 0], Math.min(0.054, width * 0.65));
    rod(joint, 'titanium', [0, -height * 0.6, 0], [0, height * 0.6, 0], 0.012);
    for (const side of [-1, 1]) {
      add(joint, 'box', 'dark', [side * 0.043, -0.025, 0.018], [0.024, 0.034, 0.032]);
      add(joint, 'bolt', 'brass', [side * F.tendonOffset, -0.002, 0.018], [0.009, 0.013, 0.009]);
    }
    const servo = part(`spine.${i + 1}.servo`, `Vertebra ${i + 1} indexing gear`, 'Distributed actuation', 'Visualizes the joint command at this cartridge.', 'A compact gear turns with the local relative heading; this is a commanded position, not a torque simulation.', frame, [0, 0.12, 0]);
    servo.position.set(0, 0.065, 0.035); kit.gear(servo, i < 6 ? 0.041 : 0.03, 12, 0.016, 'brass'); servos.push(servo);
    const loom = part(`spine.${i + 1}.bus`, `Vertebra ${i + 1} dorsal service bus`, 'Electrical service', 'Carries visible power and command conductors along the rigid module.', 'Two separated runs and paired clamps follow the cartridge instead of disappearing inside the armor.', frame, [0, 0.13, 0]);
    for (const x of [-0.028, 0.028]) {
      rod(loom, 'copper', [x, height * 0.5, 0.025], [x, height * 0.5, length - 0.012], 0.004);
      for (const z of [0.04, length - 0.035]) add(loom, 'box', 'rubber', [x, height * 0.5, z], [0.02, 0.017, 0.018], [0, 0, 0], true);
    }
    for (let quadrant = 0; quadrant < 4; quadrant++) {
      const theta = (quadrant + 0.5) * TAU / 4;
      const armor = part(`spine.${i + 1}.armor.${quadrant + 1}`, `Vertebra ${i + 1} ${['upper starboard', 'upper port', 'lower port', 'lower starboard'][quadrant]} scale cassette`, 'Scale armor', 'Protects one quadrant with six individually instanced overlapping plates.', 'Two staggered axial rows step radially by 9 mm; lateral seams and small retaining studs distinguish the scales.', frame, [Math.cos(theta) * 0.16, Math.sin(theta) * 0.16, 0], 'Formed pale alloy scales with brass retainers');
      for (let row = 0; row < 2; row++) for (let sector = 0; sector < 3; sector++) {
        const phi = (quadrant * 3 + sector + (row ? 0.3 : 0)) * TAU / 12;
        const radialStep = row ? 0 : 0.009;
        const normalAngle = Math.atan2(Math.sin(phi) / height, Math.cos(phi) / width);
        const p = [(width + radialStep) * Math.cos(phi), (height + radialStep) * Math.sin(phi), length * (row ? 0.73 : 0.29)];
        const tangentRadius = Math.hypot(width * Math.sin(phi), height * Math.cos(phi));
        add(armor, 'sphere', 'shell', p, [tangentRadius * 0.235, 0.011, length * 0.37], [0, 0, normalAngle - Math.PI / 2]);
        const cap = [p[0] + Math.cos(normalAngle) * 0.012, p[1] + Math.sin(normalAngle) * 0.012, p[2] - length * 0.17];
        add(armor, 'cylinder', 'dark', cap, [0.010, 0.005, 0.010], [0, 0, normalAngle - Math.PI / 2], true);
        add(armor, 'bolt', (i + quadrant + sector) % 3 ? 'brass' : 'copper', [cap[0] + Math.cos(normalAngle) * 0.004, cap[1] + Math.sin(normalAngle) * 0.004, cap[2]], [0.007, 0.008, 0.007], [0, 0, normalAngle - Math.PI / 2], true);
      }
    }
    for (const side of [-1, 1]) {
      const tendon = part(`spine.${i + 1}.tendon.${side}`, `Vertebra ${i + 1} ${side < 0 ? 'port' : 'starboard'} tendon span`, 'Antagonistic tendons', 'Shows the paid-out distance between neighboring offset guides.', 'Endpoints follow the actual vertebral headings. Only cable length changes; no rigid bone is stretched.', undefined, [side * 0.15, -0.1, 0], 'Braided copper and insulated service cable');
      rod(tendon, 'copper', [0, 0, 0], [0, 1, 0], 0.0035);
      rod(tendon, 'rubber', [0.009, 0, 0], [0.009, 1, 0], 0.003, true);
      tendonNodes.push(tendon);
    }
    if (i >= 1 && i <= 5) {
      const finHeight = [0, 0.15, 0.225, 0.20, 0.15, 0.08][i];
      for (const side of [-1, 1]) {
        if (side < 0 && (i < 3 || i > 4)) continue;
        const fin = part(`fin.${side > 0 ? 'dorsal' : 'ventral'}.${i + 1}`, `${side > 0 ? 'Dorsal' : 'Ventral'} fin saddle ${i + 1}`, 'Median fins', 'Supports a fin bay on its own rigid vertebra.', 'Sloped leading and trailing rays, cross ties and a narrow shell web leave the underlying support visible.', frame, [0, side * 0.18, 0]);
        const base = side * (height + 0.01), rise = finHeight * (side > 0 ? 1 : 0.62);
        const a = [0, base, length * 0.15], b = [0, base + side * rise, length * 0.46], c = [0, base, length * 0.9];
        rod(fin, 'titanium', a, b, 0.009); rod(fin, 'dark', b, c, 0.006);
        rod(fin, 'brass', a, c, 0.006);
        for (let j = 1; j < 5; j++) {
          const f = j / 5;
          rod(fin, 'dark', [0, base, length * (0.15 + 0.75 * f)], [0, base + side * rise * (1 - f * 0.7), length * (0.46 + f * 0.44)], 0.003, true);
        }
        add(fin, 'sphere', 'shell', [0, base + side * rise * 0.36, length * 0.57], [0.007, rise * 0.38, length * 0.22]);
      }
    }
  });

  const head = part('head.cranium', 'Koi cranial pressure fairing', 'Head', 'Creates the rounded nose ahead of the deep armored shoulder.', 'A shallow ellipsoidal shell sits on an exposed neck yoke with a distinct open mouth ring.', vertebrae[0], [0, 0, -0.15], 'Pale alloy cranial shell');
  add(head, 'sphere', 'shell', [0, 0, -0.18], [0.225, 0.255, 0.215]);
  const yoke = part('head.yoke', 'Cervical service cradle and nose truss', 'Head skeleton', 'Physically joins the service post to the first vertebra and nose.', 'A transverse saddle, central neck rail and two cheek struts remain visible in x-ray.', vertebrae[0], [0, -0.1, -0.05]);
  rod(yoke, 'titanium', [-0.12, -0.24, 0.10], [0.12, -0.24, 0.10], 0.016);
  rod(yoke, 'dark', [0, -0.24, 0.10], [0, 0, 0.1], 0.013);
  rod(yoke, 'titanium', [0, 0, 0.12], [0, -0.065, -0.38], 0.016);
  for (const side of [-1, 1]) {
    rod(yoke, 'titanium', [side * 0.14, 0, 0], [side * 0.09, -0.07, -0.37], 0.009);
    rod(yoke, 'dark', [0, -0.04, -0.25], [side * 0.178, 0.085, -0.19], 0.011);
    add(yoke, 'ring', 'titanium', [side * 0.178, 0.085, -0.19], [0.031, 0.031, 0.031], [0, Math.PI / 2, 0]);
  }
  const mouth = part('head.mouth', 'Annular mouth and intake strainer', 'Head', 'Defines the forward koi mouth independently of the eyes.', 'Nested rings and five separated strainer bars surround the dark intake.', head, [0, -0.02, -0.12]);
  add(mouth, 'ring', 'titanium', [0, -0.065, -0.407], [0.079, 0.055, 0.079]);
  add(mouth, 'ring', 'brass', [0, -0.065, -0.418], [0.059, 0.039, 0.059]);
  add(mouth, 'sphere', 'dark', [0, -0.065, -0.398], [0.062, 0.04, 0.017]);
  for (let i = -2; i <= 2; i++) rod(mouth, 'titanium', [i * 0.017, -0.089, -0.421], [i * 0.017, -0.04, -0.421], 0.0025, true);
  for (const side of [-1, 1]) {
    const eye = part(`head.eye.${side}`, `${side < 0 ? 'Port' : 'Starboard'} optical eye module`, 'Optics', 'Places a large lateral optical aperture behind the snout.', 'A glass objective, dark pupil, protective bezel and four retainers make a discrete serviceable eye.', head, [side * 0.14, 0.06, -0.04], 'Optical glass, titanium bezel and dark carrier');
    eye.position.set(side * 0.198, 0.085, -0.19);
    add(eye, 'sphere', 'dark', [0, 0, 0], [0.044, 0.061, 0.063]);
    add(eye, 'ring', 'titanium', [side * 0.03, 0, 0], [0.058, 0.058, 0.058], [0, Math.PI / 2, 0]);
    add(eye, 'sphere', 'lens', [side * 0.044, 0, 0], [0.026, 0.043, 0.043]);
    add(eye, 'sphere', 'dark', [side * 0.067, 0, 0], [0.006, 0.025, 0.025]);
    for (let j = 0; j < 4; j++) add(eye, 'bolt', 'brass', [side * 0.034, 0.053 * Math.sin(j * TAU / 4), 0.053 * Math.cos(j * TAU / 4)], [0.008, 0.014, 0.008], [0, 0, Math.PI / 2], true);
    const barbel = part(`head.barbel.${side}`, `${side < 0 ? 'Port' : 'Starboard'} articulated barbel`, 'Head sensors', 'Makes the lower lip and short koi whisker legible.', 'A two-link slender feeler attaches beside the intake rather than to a floating decorative point.', head, [side * 0.12, -0.06, -0.1]);
    const a = [side * 0.065, -0.09, -0.37], b = [side * 0.14, -0.135, -0.45], c = [side * 0.18, -0.19, -0.48];
    rod(barbel, 'brass', a, b, 0.006); rod(barbel, 'titanium', b, c, 0.004);
    add(barbel, 'sphere', 'dark', b, [0.01, 0.01, 0.01]);
    const bus = part(`head.harness.${side}`, `${side < 0 ? 'Port' : 'Starboard'} cranial wiring harness`, 'Electrical service', 'Connects the eye carrier and gill drive to the neck.', 'Two curved segmented conductors route through the cheek rather than filling its volume.', vertebrae[0], [side * 0.1, -0.02, -0.06]);
    for (let j = 0; j < 8; j++) {
      const p = k => [side * (0.12 + 0.03 * Math.sin(k * Math.PI / 8)), -0.10, -0.29 + k * 0.046];
      rod(bus, 'copper', p(j), p(j + 1), 0.0035);
      const a = p(j), b = p(j + 1); a[1] -= 0.018; b[1] -= 0.018;
      rod(bus, 'rubber', a, b, 0.005, true);
    }
  }

  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Port' : 'Starboard';
    const root = part(`gill.${side}.carrier`, `${label} gill bearing carrier`, 'Gill actuation', 'Locates the gill crank and operculum hinge.', 'Its planar linkage lies in the lateral XZ plane, with the cover height along the normal.', vertebrae[0], [side * 0.17, 0.02, 0]);
    root.position.set(side * 0.245, 0, 0.03);
    root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(side, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -side, 0)));
    planarBearing(root, [0, 0, 0], 0.029); planarBearing(root, F.gillOrigin, 0.027);
    rod(root, 'titanium', [0, 0, -0.035], [F.gillOrigin[0], F.gillOrigin[1], -0.035], 0.008);
    const crank = part(`gill.${side}.crank`, `${label} 14 mm gill eccentric`, 'Gill actuation', 'Moves the input pin around the fixed cheek bearing.', 'The gear carries one fixed-radius eccentric; the conrod and cover share its solved phase.', root, [0.06, 0, -0.05]);
    crank.position.fromArray(F.gillOrigin);
    const disk = part(`gill.${side}.gear`, `${label} gill timing disk`, 'Gill timing', 'Exposes the rotating inspection phase.', 'Twelve teeth surround the cheek drive shaft on a plane normal to the hinge pins.', crank, [0, 0, -0.025]);
    disk.rotation.x = Math.PI / 2; kit.gear(disk, 0.029, 12, 0.015, 'brass');
    planarBearing(crank, [F.gillCrank, 0, 0], 0.009, F.gillRodZ);
    const rocker = part(`gill.${side}.rocker`, `${label} 60 mm operculum rocker`, 'Gill actuation', 'Rotates the gill cover from a fixed-length lever.', 'The lever datum is offset from the cover so a closed triangle creates a visibly opening shell.', root, [0.055, 0, 0.025]);
    const lever = [F.gillRocker * Math.cos(GILL_DATUM), F.gillRocker * Math.sin(GILL_DATUM), 0];
    rod(rocker, 'titanium', [0, 0, 0], lever, 0.007); planarBearing(rocker, lever, 0.012, F.gillRodZ);
    const cover = part(`gill.${side}.cover`, `${label} ribbed operculum shell`, 'Gill armor', 'Creates the moving cheek cover and gill aperture.', 'A shallow separated shell and five visible ribs rotate around the actual shoulder hinge.', rocker, [0.08, 0, 0], 'Pale shell with titanium ribs');
    // Inboard armor clears the input eye's swept envelope without moving the hinge.
    cover.position.x = -0.035;
    add(cover, 'sphere', 'shell', [0, 0.115, 0], [0.018, 0.135, 0.245]);
    for (let j = -2; j <= 2; j++) {
      const h = j * 0.084;
      rod(cover, 'titanium', [0.021, 0.014, h * 0.4], [0.021, 0.215 - Math.abs(j) * 0.02, h], 0.005);
      add(cover, 'bolt', 'dark', [0.025, 0.18 - Math.abs(j) * 0.02, h], [0.007, 0.008, 0.007], [0, 0, Math.PI / 2], true);
    }
    const link = part(`gill.${side}.conrod`, `${label} 105 mm gill connecting rod`, 'Gill actuation', 'Closes the cheek crank–rocker triangle without stretching.', 'Two rigid straps are aimed at the sampled pin centers; endpoint bushes sit on the same hinge axes.', root, [0.04, -0.02, 0.065]);
    for (const x of [-0.006, 0.006]) rod(link, 'titanium', [x, 0, 0], [x, F.gillRod, 0], 0.004);
    for (const y of [0, F.gillRod]) planarBearing(link, [0, y, 0], 0.011);
    gills.push({ crank, rocker, link });

    const finRoot = part(`pectoral.${side}.hub`, `${label} pectoral phase actuator`, 'Paired fins', 'Supports and feathers the seven-ray pectoral fan.', 'A visible hub carries the entire fin; the two sides are commanded half a cycle apart.', vertebrae[0], [side * 0.18, -0.08, 0]);
    finRoot.position.set(side * 0.235, -0.135, 0.13);
    finRoot.rotation.y = side < 0 ? Math.PI : 0;
    planarBearing(finRoot, [0, 0, 0], 0.033);
    for (let j = 0; j < 7; j++) {
      const endpoint = pectoralPoint(j / 6); endpoint[2] *= side;
      const length = Math.hypot(...endpoint);
      const ray = part(`pectoral.${side}.ray.${j + 1}`, `${label} pectoral ray ${j + 1}`, 'Paired fins', 'Supports one narrow fin ribbon from the common actuation hub.', 'A rigid tapered-looking rod, separated shell ribbon and root ferrule retain the fan outline.', finRoot, [0.015 * j, -0.015 * j, 0]);
      kit.aim(ray, [0, 0, 0], endpoint);
      rod(ray, 'titanium', [0, 0, 0], [0, length, 0], 0.005);
      add(ray, 'sphere', 'shell', [0, length * 0.56, 0], [0.016, length * 0.39, 0.007]);
      add(ray, 'cylinder', 'brass', [0, 0.033, 0], [0.01, 0.02, 0.01]);
      for (const f of [0.45, 0.73]) add(ray, 'bolt', 'dark', [0, length * f, 0], [0.006, 0.012, 0.006], [0, 0, 0], true);
      if (j > 0) {
        const prev = pectoralPoint((j - 1) / 6); prev[2] *= side;
        rod(finRoot, 'dark', prev, endpoint, 0.0035, true);
      }
    }
    pectorals.push(finRoot);
  }

  const tail = part('caudal.hub', 'Caudal peduncle and feather bearing', 'Caudal fin', 'Carries a forked thirteen-ray fan at the end of the final spine link.', 'A small additional sinusoidal yaw feathers the complete fin without altering any spine length.', vertebrae.at(-1), [0, 0, 0.18]);
  tail.position.z = F.lengths.at(-1); bearing(tail, [0, 0, 0], 0.033);
  rod(tail, 'titanium', [0, -0.065, 0.025], [0, 0.065, 0.025], 0.012);
  for (let j = 0; j < 13; j++) {
    const u = (j - 6) / 6, p = caudalPoint(u);
    const ray = part(`caudal.ray.${j + 1}`, `Caudal ${u < 0 ? 'lower' : u > 0 ? 'upper' : 'central'} ray ${j + 1}`, 'Caudal fin', 'Braces one ray of the recessed-center tail fan.', 'Two rigid ray sections, a narrow shell ribbon and diagonal web ties leave individual fin rays readable.', tail, [0, u * 0.075, Math.abs(u) * 0.07]);
    const middle = [0.018 * (1 - u * u), p[1] * 0.53, p[2] * 0.56];
    rod(ray, 'titanium', [0, u * 0.04, 0.02], middle, 0.007);
    rod(ray, 'dark', middle, p, 0.0045);
    const dy = p[1] - middle[1], dz = p[2] - middle[2], length = Math.hypot(dy, dz);
    add(ray, 'sphere', 'shell', [0.007, (p[1] + middle[1]) / 2, (p[2] + middle[2]) / 2], [0.006, length * 0.55, 0.022], [Math.atan2(dz, dy), 0, 0]);
    add(ray, 'bolt', 'brass', middle, [0.009, 0.017, 0.009], [0, 0, Math.PI / 2]);
    if (j > 0) {
      const prev = caudalPoint((j - 7) / 6);
      rod(ray, 'dark', prev, p, 0.003, true);
      rod(ray, 'copper', [0, prev[1] * 0.55, prev[2] * 0.58], p, 0.0025, true);
    }
  }

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.segments && state?.tendons && state?.gills) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, lastState);
    for (const { node, p, q, s } of bind) { node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s); }
    vertebrae.forEach((node, i) => { node.position.fromArray(lastState.segments[i].start); node.rotation.y = lastState.segments[i].yaw; servos[i].rotation.y = -3 * lastState.segments[i].jointAngle; });
    tendonNodes.forEach((node, i) => { const t = lastState.tendons[i]; kit.aim(node, t.a, t.b); node.scale.y = t.length; });
    gills.forEach((g, i) => {
      const p = lastState.gills[i]; g.crank.rotation.z = p.phaseAngle; g.rocker.rotation.z = p.angle;
      kit.aim(g.link, p.crank, p.rocker);
      // aim resets position; restore the common axial plane before explosion.
      g.link.position.z = F.gillRodZ;
    });
    pectorals.forEach((node, i) => { node.rotation.z = lastState.pectorals[i].angle; });
    tail.rotation.y = lastState.tailAngle;
    kit.sync(options);
  }
  update(lastState);
  return { group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
