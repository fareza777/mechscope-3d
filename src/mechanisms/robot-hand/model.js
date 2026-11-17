import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, capstanPosition, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('DEXTRA H5 · articulated hand'), { add, rod } = kit, nodes = [], digits = [], drives = [];
  let disposed = false, last = sample(0);
  function part(id, name, system, purpose, how, parent, explode = [0, .06, 0], material = 'Titanium truss, brass bearings and dark fittings') {
    const n = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode); nodes.push(n); return n;
  }
  function axle(n, x, y, z, width, radius = .014) {
    add(n, 'cylinder', 'brass', [x, y, z], [radius, width, radius], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) add(n, 'bolt', 'dark', [x + s * (width / 2 + .003), y, z], [radius * 1.15, .009, radius * 1.15], [0, 0, Math.PI / 2]);
  }
  const foot = part('pedestal.foot', 'Forearm service foot', 'Support', 'Supports the upright hand at the floor datum.', 'A weighted circular foot anchors the open forearm pedestal.', undefined, [0, 0, 0]);
  add(foot, 'cylinder', 'dark', [0, .026, 0], [.31, .052, .31]); add(foot, 'cylinder', 'titanium', [0, .059, 0], [.27, .014, .27]);
  for (let j = 0; j < 8; j++) { const a = j * TAU / 8; kit.fasteners(foot, [[.235 * Math.cos(a), .07, .235 * Math.sin(a)]], .01); }
  const mount = part('pedestal.socket', 'Forearm lower mounting socket', 'Support', 'Locates four separated longitudinal forearm struts.', 'A low annular socket leaves an open service passage.', undefined, [0, .025, 0]);
  for (const y of [.1, .18]) add(mount, 'ring', 'titanium', [0, y, 0], [.145, .145, .145], [Math.PI / 2, 0, 0]);
  for (let j = 0; j < 4; j++) {
    const x = j < 2 ? -.1 : .1, z = j % 2 ? -.085 : .085;
    const strut = part(`forearm.rail.${j}`, `Forearm structural rail ${j + 1}`, 'Forearm', 'Transfers the wrist reaction into the mounting socket.', 'A continuous tubular strut carries isolated clamps and a side service stripe.', undefined, [x, 0, z]);
    rod(strut, 'titanium', [x, .12, z], [x, .865, z], .018);
    rod(strut, 'copper', [x * .9, .2, z * .9], [x * .9, .8, z * .9], .005);
    for (const y of [.24, .47, .7]) { add(strut, 'box', 'dark', [x, y, z], [.05, .029, .048]); kit.fasteners(strut, [[x, y + .018, z]], .007); }
  }
  for (let j = 0; j < 3; j++) {
    const brace = part(`forearm.cross.${j}`, `Forearm cross-braced bay ${j + 1}`, 'Forearm', 'Stabilizes the open four-rail cuff support.', 'Thin diagonals connect opposite rails without a solid forearm casing.');
    for (const z of [-.085, .085]) { rod(brace, 'dark', [-.1, .19 + j * .2, z], [.1, .38 + j * .2, z], .007); rod(brace, 'dark', [.1, .19 + j * .2, z], [-.1, .38 + j * .2, z], .007); }
    for (const x of [-.1, .1]) rod(brace, 'titanium', [x, .285 + j * .2, -.085], [x, .285 + j * .2, .085], .008);
  }
  for (const s of [-1, 1]) {
    const shroud = part(`forearm.shell.${s}`, `${s < 0 ? 'Rear' : 'Front'} split forearm service shroud`, 'Armor', 'Shields a small central service area while leaving struts exposed.', 'Three separated shell panels fade in x-ray.', undefined, [0, 0, s * .15], 'Pale alloy shell');
    for (const y of [.31, .5, .69]) { add(shroud, 'box', 'shell', [0, y, s * .106], [.105, .14, .017]); kit.fasteners(shroud, [[-.036, y + .046, s * .12], [.036, y - .046, s * .12]], .006); }
    const loom = part(`forearm.loom.${s}`, `${s < 0 ? 'Rear' : 'Front'} forearm electrical loom`, 'Electrical service', 'Carries display power to the five drive cartridges.', 'Four separately spaced insulated conductors rise inside the support cage.', undefined, [0, 0, s * .08]);
    for (const x of [-.045, -.015, .015, .045]) rod(loom, 'rubber', [x, .16, s * .062], [x, .83, s * .062], .004);
    for (const y of [.23, .43, .63, .81]) add(loom, 'box', 'dark', [0, y, s * .062], [.11, .012, .017]);
  }
  const cuff = part('wrist.cuff', 'Open forearm cuff', 'Wrist', 'Fixes the vertical yaw bearing above the forearm rails.', 'Two large open annuli and six short stays carry the wrist without sealing its interior.', undefined, [0, -.035, 0]);
  for (const y of [.825, .895]) add(cuff, 'ring', 'titanium', [0, y, 0], [.155, .135, .155], [Math.PI / 2, 0, 0]);
  for (let j = 0; j < 6; j++) { const a = j * TAU / 6; rod(cuff, 'dark', [.148 * Math.cos(a), .825, .128 * Math.sin(a)], [.148 * Math.cos(a), .895, .128 * Math.sin(a)], .012); }
  const bearing = part('wrist.bearing', 'Vertical wrist yaw bearing', 'Wrist', 'Supports the small commanded yaw of the complete palm.', 'A brass bearing race surrounds a vertical shaft; the forearm stays fixed.', undefined, [0, -.025, 0]);
  add(bearing, 'cylinder', 'dark', [0, .922, 0], [.103, .036, .103]);
  add(bearing, 'ring', 'brass', [0, .946, 0], [.095, .095, .095], [Math.PI / 2, 0, 0]);
  for (let j = 0; j < 12; j++) { const a = j * TAU / 12; add(bearing, 'box', 'titanium', [.102 * Math.cos(a), .918, .102 * Math.sin(a)], [.012, .036, .018], [0, -a, 0], true); }
  const palm = part('palm.carrier', 'Moving wrist and palm heel', 'Palm skeleton', 'Carries all digits and all five drives on the yaw axis.', 'A shallow heel crossbeam feeds the open metacarpal rails.', undefined, [0, .08, 0]); palm.position.fromArray(D.wrist);
  add(palm, 'box', 'dark', [0, .025, 0], [.46, .045, .095]);
  add(palm, 'cylinder', 'brass', [0, -.012, 0], [.058, .08, .058]);
  for (const x of [-.18, -.09, 0, .09, .18]) kit.fasteners(palm, [[x, .052, 0]], .007);
  D.digits.slice(0, 4).forEach((spec, i) => {
    for (const side of [-1, 1]) {
      const rail = part(`palm.metacarpal.${spec.id}.${side}`, `${spec.name} ${side < 0 ? 'dorsal' : 'volar'} metacarpal truss`, 'Palm skeleton', 'Transfers this knuckle into the palm heel.', 'Paired separated rails and diagonal ties leave an open metacarpal bay.', palm, [0, .04, side * .07]);
      const a = [spec.base[0] * .72, .045, side * .058], b = [spec.base[0], spec.base[1] - .018, side * .035];
      rod(rail, 'titanium', a, b, .009);
      rod(rail, 'dark', [a[0] + .04, a[1], a[2]], [b[0] + .037, b[1] - .008, b[2]], .006);
      for (let j = 1; j < 5; j++) {
        const u = j / 5, x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, z = a[2] + (b[2] - a[2]) * u;
        rod(rail, 'titanium', [x, y, z], [x + .037, y, z], .004);
        add(rail, 'bolt', 'dark', [x, y, z], [.006, .01, .006], [Math.PI / 2, 0, 0], true);
      }
    }
    const saddle = part(`palm.saddle.${spec.id}`, `${spec.name} metacarpal cross-saddle`, 'Palm skeleton', 'Links the front and rear rails below the finger bearing.', 'A short transverse yoke ends below the curling bone frame.', palm, [0, .04, 0]);
    rod(saddle, 'dark', [spec.base[0], spec.base[1] - .02, -.055], [spec.base[0], spec.base[1] - .02, .055], .018);
    for (const z of [-.06, .06]) add(saddle, 'ring', 'titanium', [spec.base[0], spec.base[1] - .02, z], [.024, .024, .024]);
    const shield = part(`palm.shield.${i}`, `${spec.name} dorsal metacarpal shield`, 'Armor', 'Protects one small palm bay without filling its truss.', 'A short, individually removable back plate fades in x-ray.', palm, [0, 0, -.12], 'Pale alloy shell');
    add(shield, 'box', 'shell', [spec.base[0] * .88, .245, -.075], [.075, .115, .014], [0, 0, -spec.splay]); kit.fasteners(shield, [[spec.base[0] * .88, .278, -.085], [spec.base[0] * .88, .212, -.085]], .005);
  });
  const radial = part('palm.radial', 'Radial thumb support truss', 'Palm skeleton', 'Locates the low splayed thumb opposition carrier.', 'Two triangulated rails connect the radial edge to the wrist heel.', palm, [-.08, 0, 0]);
  for (const z of [-.035, .06]) { rod(radial, 'titanium', [-.15, .04, z], [-.335, .12, .08], .012); rod(radial, 'dark', [-.26, .32, z], [-.335, .12, .08], .009); }

  D.digits.forEach((spec, i) => {
    const location = capstanPosition(i);
    const bracket = part(`drive.${spec.id}.bracket`, `${spec.name} tendon drive mounting fork`, 'Tendon drives', 'Fixes this digit’s drive cartridge to the palm.', 'Two cheeks and a rear mounting bar stay on the moving palm, not on the rotating drum.', palm, [0, -.04, -.08]); bracket.position.fromArray(location);
    for (const x of [-.045, .045]) { add(bracket, 'box', 'dark', [x, -.004, -.012], [.013, .105, .095]); kit.fasteners(bracket, [[x, .045, -.035], [x, .045, .022]], .005); }
    rod(bracket, 'titanium', [-.05, -.049, -.025], [.05, -.049, -.025], .008);
    const rotor = part(`drive.${spec.id}.capstan`, `${spec.name} independent tendon capstan`, 'Tendon drives', 'Makes the synchronized drive command visible for one digit.', 'A grooved drum, spoke rim and datum tooth rotate about a transverse shaft; drum motion does not solve cable tension.', palm, [0, 0, -.1]); rotor.position.fromArray(location);
    add(rotor, 'cylinder', 'brass', [0, 0, 0], [.036, .07, .036], [0, 0, Math.PI / 2]);
    for (const x of [-.027, 0, .027]) add(rotor, 'ring', 'titanium', [x, 0, 0], [.043, .043, .043], [0, Math.PI / 2, 0]);
    for (let j = 0; j < 12; j++) { const a = j * TAU / 12;
      rod(rotor, 'dark', [-.037, .014 * Math.cos(a), .014 * Math.sin(a)], [-.037, .036 * Math.cos(a), .036 * Math.sin(a)], .003);
      add(rotor, 'box', 'brass', [.037, .042 * Math.cos(a), .042 * Math.sin(a)], [.012, .011, .009], [a, 0, 0]);
      add(rotor, 'bolt', 'dark', [-.044, .03 * Math.cos(a), .03 * Math.sin(a)], [.003, .006, .003], [0, 0, Math.PI / 2], true);
    }
    axle(rotor, 0, 0, 0, .105, .009); drives.push(rotor);
    const root = part(`digit.${spec.id}.root`, `${spec.name} ${i === 4 ? 'opposition' : 'splay'} carrier`, 'Digit roots', 'Locates this digit at its own metacarpal height and angle.', i === 4 ? 'The low radial root yaws and changes splay to demonstrate opposition.' : 'The fixed splay angle provides meaningful lateral clearance from the neighboring digits.', palm, [spec.base[0] * .15, .08, 0]);
    root.position.fromArray(spec.base);
    add(root, 'box', 'dark', [0, -.026, 0], [spec.width * .8, .04, .072]);
    for (const z of [-.04, .04]) add(root, 'ring', 'titanium', [0, -.021, z], [.021, .021, .021]);
    // The opposition yaw belongs to the unsplayed root carrier. Splay lives on
    // a child pivot, so the brass bearing stays coaxial with the commanded
    // palm-local yaw axis through the digit root at every pose.
    const splay = new THREE.Group(); splay.name = `digit.${spec.id}.splay`;
    if (i === 4) {
      root.add(splay);
      add(root, 'cylinder', 'brass', [0, -.036, 0], [.036, .026, .036]);
      add(root, 'ring', 'brass', [0, -.036, 0], [.034, .034, .034], [Math.PI / 2, 0, 0]);
    }
    const bones = [], tendons = [];
    spec.lengths.forEach((length, j) => {
      const prefix = `digit.${spec.id}.${j}`, title = `${spec.name} ${i === 4 ? ['metacarpal', 'proximal', 'distal'][j] : ['proximal', 'middle', 'distal'][j]}`;
      const parent = j ? bones[j - 1] : (i === 4 ? splay : root), jointY = j ? spec.lengths[j - 1] : 0;
      const cheeks = part(`${prefix}.bracket`, `${title} parent-side hinge cheeks`, 'Knuckle hinges', 'Supports both ends of a transverse knuckle axle.', 'The fork belongs to the preceding bone, so it follows that bone before the next joint curls.', parent, [0, .025, -.035]); cheeks.position.y = jointY;
      for (const side of [-1, 1]) {
        add(cheeks, 'box', 'titanium', [side * spec.width * .62, -.012, 0], [.012, .068, .048]);
        add(cheeks, 'ring', 'dark', [side * spec.width * .7, 0, 0], [.019, .019, .019], [0, Math.PI / 2, 0]);
        kit.fasteners(cheeks, [[side * spec.width * .62, -.036, -.011], [side * spec.width * .62, -.036, .011]], .004);
      }
      axle(cheeks, 0, 0, 0, spec.width * 1.52, .01);
      const bone = part(`${prefix}.bone`, `${title} rigid bone truss`, 'Rigid phalanges', `Maintains the ${Math.round(length * 1000)} mm pin spacing.`, 'An axial spine, four corner rails, fixed cross-spacers and fine diagonals rotate as one link.', parent, [0, .05, 0]); bone.position.y = jointY;
      rod(bone, 'dark', [0, 0, 0], [0, length, 0], .007);
      for (const x of [-spec.width * .29, spec.width * .29]) for (const z of [-.02, .02]) rod(bone, 'titanium', [x, .023, z], [x, length - .022, z], .006);
      for (const u of [.2, .5, .8]) {
        rod(bone, 'dark', [-spec.width * .32, length * u, 0], [spec.width * .32, length * u, 0], .006);
        if (u !== .5) for (const z of [-.02, .02]) kit.fasteners(bone, [[0, length * u, z]], .004);
      }
      for (const s of [-1, 1]) for (let k = 0; k < 2; k++) rod(bone, 'copper', [-spec.width * .27, length * (.2 + k * .3), s * .022], [spec.width * .27, length * (.5 + k * .3), s * .022], .0024, true);
      for (const side of [-1, 1]) {
        const cover = part(`${prefix}.shell.${side}`, `${title} ${side < 0 ? 'dorsal' : 'volar'} split shell`, 'Bone armor', 'Protects one face while leaving both lateral hinge cheeks open.', 'A short shell stays clear of the knuckle sweep and can be removed independently.', bone, [0, 0, side * .075], 'Pale alloy shell');
        add(cover, 'box', 'shell', [0, length / 2, side * .033], [spec.width * .75, length - .081, .012]);
        for (const x of [-spec.width * .22, spec.width * .22]) add(cover, 'box', 'shell', [x, length / 2, side * .025], [.008, length - .084, .019]);
        kit.fasteners(cover, [[0, .05, side * .04], [0, length - .05, side * .04]], .004);
      }
      const pulley = part(`${prefix}.pulley`, `${title} bone-side knuckle pulley`, 'Knuckle pulleys', 'Shows the rotating member of the paired hinge.', 'Two exposed pulley faces and an internal hub turn with the bone around the parent-mounted axle.', bone, [.045, 0, 0]);
      for (const side of [-1, 1]) {
        const x = side * spec.width * .43;
        add(pulley, 'ring', 'brass', [x, 0, 0], [.025, .025, .025], [0, Math.PI / 2, 0]);
        add(pulley, 'cylinder', 'dark', [x, 0, 0], [.013, .011, .013], [0, 0, Math.PI / 2]);
        for (let k = 0; k < 6; k++) { const a = k * TAU / 6;
          rod(pulley, 'titanium', [x, .012 * Math.cos(a), .012 * Math.sin(a)], [x, .023 * Math.cos(a), .023 * Math.sin(a)], .0025);
          add(pulley, 'bolt', 'dark', [x, .019 * Math.cos(a), .019 * Math.sin(a)], [.003, .006, .003], [0, 0, Math.PI / 2], true);
        }
      }
      // Fixed guides at both ends are carried by this bone, not by world space.
      for (const side of [-1, 1]) for (const y of [.015, length - .014]) {
        add(bone, 'ring', 'titanium', [side * spec.width * .34, y, -.053], [.005, .005, .005], [Math.PI / 2, 0, 0]);
        rod(bone, 'dark', [side * spec.width * .34, y, -.02], [side * spec.width * .34, y, -.053], .003);
      }
      bones.push(bone);
      if (j === 2) {
        const pad = part(`digit.${spec.id}.pad`, `${spec.name} tactile fingertip cartridge`, 'Tactile surfaces', 'Defines a broad soft-looking contact surface at the last bone.', 'A rounded pad and segmented dark tread are visual surfaces, not force sensors.', bone, [0, .04, .055], 'Rubber pad, dark carrier and copper terminals');
        add(pad, 'sphere', 'rubber', [0, length - .017, .024], [spec.width * .43, .034, .025]);
        add(pad, 'box', 'dark', [0, length - .025, .008], [spec.width * .78, .05, .016]);
        for (let k = 0; k < 6; k++) add(pad, 'box', 'rubber', [0, length - .04 + k * .008, .047], [spec.width * .59, .004, .007]);
        kit.fasteners(pad, [[-spec.width * .26, length - .044, .017], [spec.width * .26, length - .044, .017]], .004);
      }
    });
    for (const t of last.digits[i].tendons) {
      const n = part(`tendon.${spec.id}.${t.side}.${t.k}`, `${spec.name} ${t.side < 0 ? 'radial' : 'ulnar'} tendon span ${t.k + 1}`, 'Geometric tendon routes', 'Joins this drive or bone guide to the next guide.', 'Only this line primitive changes length as its endpoints move; cable tension, wrap and payout are not solved.', palm, [t.side * .025, 0, -.045], 'Exposed copper-colored inspection cable');
      add(n, 'cylinder', 'copper', [0, .5, 0], [.0024, 1, .0024]); tendons.push(n);
    }
    digits.push({ root, splay: i === 4 ? splay : null, bones, tendons });
  });
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
  function update(state = last, options = {}) {
    if (disposed) return;
    if (state?.digits) last = state;
    else if (Number.isFinite(state?.driveAngle)) last = poseAt(state.driveAngle, last.controls);
    for (const { node, p, q } of bind) { node.position.copy(p); node.quaternion.copy(q); }
    palm.rotation.y = last.wristYaw;
    digits.forEach((digit, i) => {
      const d = last.digits[i];
      if (digit.splay) { digit.root.rotation.set(0, d.opposition, 0); digit.splay.rotation.z = d.splay; }
      else digit.root.rotation.set(0, d.opposition, d.splay, 'YXZ');
      digit.bones.forEach((n, j) => { n.rotation.x = d.joints[j]; });
      digit.tendons.forEach((n, j) => { const t = d.tendons[j]; kit.aim(n, t.start, t.end); n.scale.y = Math.hypot(...t.start.map((v, k) => v - t.end[k])); });
      drives[i].rotation.x = d.curl * 2.7;
    });
    kit.sync(options);
  }
  update(last);
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
