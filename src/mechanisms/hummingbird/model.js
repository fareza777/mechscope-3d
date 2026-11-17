import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, DATUM, TAU, featherSpec, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('ALULA H2 · feathered automaton'), nodes = [], wings = [], tails = [], claws = [];
  const { add, rod } = kit;
  let disposed = false, last = sample(0);
  function part(id, name, system, purpose, how, parent, explode = [0, .08, 0], material = 'Titanium rails, brass bearings and dark fittings') {
    const n = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode); nodes.push(n); return n;
  }
  function journal(n, p, r = .02, reach = .02) {
    add(n, 'ring', 'titanium', p, [r, r, r]);
    add(n, 'cylinder', 'brass', [p[0], p[1], p[2] + reach / 2], [r * .48, reach + .018, r * .48], [Math.PI / 2, 0, 0]);
    add(n, 'bolt', 'dark', [p[0], p[1], p[2] - .012], [r * .34, .008, r * .34], [Math.PI / 2, 0, 0]);
  }
  function quill(n, length, width) {
    // A continuous axial spar is an independently testable rigid endpoint witness.
    rod(n, 'dark', [0, 0, 0], [0, length, 0], .0045);
    const point = (u, side) => [side * width * Math.sin(Math.PI * u) ** .7, length * u, 0];
    for (let j = 0; j < 4; j++) for (const s of [-1, 1]) rod(n, 'titanium', point(j / 4, s), point((j + 1) / 4, s), .0034);
    for (const u of [.15, .35, .55, .75]) rod(n, 'titanium', point(u, -1), point(u, 1), .0028);
    for (let j = 0; j < 4; j++) for (const s of [-1, 1]) rod(n, 'copper', [0, length * (.09 + j * .2), .002], point(.19 + j * .2, s), .0017, true);
    for (const y of [.018, .05]) add(n, 'ring', 'brass', [0, y, 0], [.009, .009, .009], [Math.PI / 2, 0, 0]);
    kit.fasteners(n, [[0, length * .3, 0], [0, length * .7, 0]], .004);
  }
  // The aimed vane is rolled flat into the wing plane so the out-of-plane
  // shingle in featherSpec separates the rails as well as the quills.
  const vaneX = new THREE.Vector3(), vaneZ = new THREE.Vector3();
  function flattenVane(n) {
    vaneX.set(1, 0, 0).applyQuaternion(n.quaternion); vaneZ.set(0, 0, 1).applyQuaternion(n.quaternion);
    n.rotateY(Math.atan2(vaneX.y, vaneZ.y));
  }
  function spar(n, length) {
    for (const z of [-.025, .025]) rod(n, 'titanium', [0, 0, z], [length, 0, z], .01);
    for (const u of [.08, .3, .52, .74, .94]) {
      rod(n, 'dark', [length * u, 0, -.025], [length * u, 0, .025], .006);
      add(n, 'box', 'brass', [length * u, 0, 0], [.016, .017, .015]);
    }
    for (let j = 0; j < 4; j++) rod(n, 'copper', [length * (.08 + j * .2), .012, -.025], [length * (.28 + j * .2), .012, .025], .003, true);
  }
  const stand = part('stand', 'Slender service pedestal', 'Support', 'Supports the fixed thorax rather than implying flight.', 'A circular foot, narrow column and forked cradle establish the floor datum.', undefined, [0, 0, 0]);
  add(stand, 'cylinder', 'dark', [0, .024, .035], [.235, .048, .235]);
  add(stand, 'cylinder', 'titanium', [0, .053, .035], [.205, .01, .205]);
  rod(stand, 'dark', [0, .07, .035], [0, 1.12, .035], .021);
  for (const s of [-1, 1]) rod(stand, 'titanium', [0, .99, .035], [s * .09, 1.2, .015], .012);
  kit.fasteners(stand, [[-.15, .06, .035], [.15, .06, .035], [0, .06, -.115], [0, .06, .185]], .011);
  for (let i = 0; i < 3; i++) {
    const collar = part(`stand.collar.${i}`, `Column service collar ${i + 1}`, 'Support', 'Clamps the service harness to the pedestal.', 'A split annulus and lateral service lug surround the narrow column.', stand, [0, .03, .03]);
    add(collar, 'ring', 'titanium', [0, .25 + i * .31, .035], [.033, .033, .033], [Math.PI / 2, 0, 0]);
    add(collar, 'box', 'dark', [0, .25 + i * .31, .077], [.04, .021, .025]);
    kit.fasteners(collar, [[0, .264 + i * .31, .077]], .006);
  }
  const cage = part('thorax.cage', 'Barrel thorax load cage', 'Thorax', 'Carries both shoulders and the neck on an open motor barrel.', 'Three hoops and eight widely spaced longitudinal rails leave the motor visible.');
  cage.position.set(0, 1.3, 0);
  for (const z of [-.24, 0, .23]) add(cage, 'ring', 'titanium', [0, 0, z], [.168, .152, .168]);
  for (let j = 0; j < 8; j++) {
    const a = j * TAU / 8;
    rod(cage, 'titanium', [.163 * Math.cos(a), .147 * Math.sin(a), -.24], [.163 * Math.cos(a), .147 * Math.sin(a), .23], .009);
  }
  for (let i = 0; i < 3; i++) {
    const motor = part(`motor.stator.${i}`, `Barrel stator cartridge ${i + 1}`, 'Motor', 'Shows the segmented rotary drive inside the cage.', 'Paired dark stator hoops encircle copper winding bars and a through shaft.', cage, [0, 0, (i - 1) * .09]); motor.position.z = -.16 + i * .16;
    for (const z of [-.052, .052]) add(motor, 'ring', 'dark', [0, 0, z], [.108, .108, .108]);
    rod(motor, 'titanium', [0, 0, -.075], [0, 0, .075], .022);
    for (let j = 0; j < 12; j++) { const a = j * TAU / 12; rod(motor, 'copper', [.087 * Math.cos(a), .087 * Math.sin(a), -.05], [.087 * Math.cos(a), .087 * Math.sin(a), .05], .009); }
    const cover = part(`thorax.armor.${i}`, `Dorsal barrel shield ${i + 1}`, 'Armor', 'Protects the top of one motor cartridge.', 'A shallow separate shell fades without hiding the rigid cooling cage.', cage, [0, .18, 0], 'Formed pale alloy shell');
    add(cover, 'sphere', 'shell', [0, .147, -.16 + i * .16], [.125, .03, .067]);
    kit.fasteners(cover, [[-.08, .166, -.16 + i * .16], [.08, .166, -.16 + i * .16]], .006);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
    const fin = part(`cooling.${side}.${i}`, `${side < 0 ? 'Left' : 'Right'} cooling cassette ${i + 1}`, 'Thermal service', 'Adds exposed cooling area without closing the side cage.', 'Five separated fins attach to one outer longitudinal mounting rail.', cage, [side * .12, -.04, 0]);
    rod(fin, 'dark', [side * .127, -.064, -.225 + i * .15], [side * .127, -.064, -.095 + i * .15], .009);
    for (let j = 0; j < 5; j++) add(fin, 'box', 'titanium', [side * .14, -.06, -.215 + i * .15 + j * .025], [.051, .046, .006]);
    kit.fasteners(fin, [[side * .14, -.03, -.2 + i * .15], [side * .14, -.03, -.12 + i * .15]], .005);
  }
  for (const side of [-1, 1]) {
    const loom = part(`service.loom.${side}`, `${side < 0 ? 'Left' : 'Right'} thorax wiring rail`, 'Electrical service', 'Connects the neck and shoulder cartridges.', 'Two separated fixed cable runs follow the lower barrel rail.', cage, [side * .06, -.06, 0]);
    for (let j = 0; j < 8; j++) { const p = k => [side * .12, -.1 - .012 * Math.sin(k * Math.PI / 8), -.33 + k * .07]; rod(loom, 'rubber', p(j), p(j + 1), .005); }
    for (const z of [-.25, -.05, .15]) { add(loom, 'box', 'dark', [side * .12, -.1, z], [.025, .018, .022]); kit.fasteners(loom, [[side * .12, -.089, z]], .005); }
  }
  const neck = part('head.neck', 'Raised neck fork', 'Head', 'Holds the slender head ahead of the thorax.', 'A two-rail neck rises to a servo yaw bearing.', undefined, [0, .08, -.05]);
  for (const x of [-.035, .035]) rod(neck, 'titanium', [x, 1.32, -.23], [x, 1.49, -.39], .015);
  add(neck, 'cylinder', 'brass', [0, 1.49, -.39], [.047, .035, .047]);
  const head = part('head.carrier', 'Narrow optical head carrier', 'Head trim', 'Carries the beak and two small side eyes.', 'The neck yaw follows an explicit servo schedule, not a force balance.', undefined, [0, .08, -.12]); head.position.set(0, 1.49, -.4);
  add(head, 'sphere', 'dark', [0, 0, -.055], [.061, .063, .12]);
  for (const s of [-1, 1]) {
    const cover = part(`head.shell.${s}`, `${s < 0 ? 'Left' : 'Right'} head cheek shell`, 'Armor', 'Defines a narrow bird skull without compound insect eyes.', 'A separate shallow cheek leaves the neck bearing and optical aperture exposed.', head, [s * .06, .04, -.025], 'Pale formed alloy');
    add(cover, 'sphere', 'shell', [s * .023, .025, -.065], [.033, .043, .104]); kit.fasteners(cover, [[s * .025, .056, -.03]], .005);
    const eye = part(`head.eye.${s}`, `${s < 0 ? 'Left' : 'Right'} single optical eye`, 'Optics', 'Marks the lateral visual aperture.', 'A small glass lens sits inside a protective brass bezel; vision is not computed.', head, [s * .08, 0, 0], 'Optical glass, brass and dark carrier');
    add(eye, 'ring', 'brass', [s * .06, .015, -.076], [.022, .022, .022], [0, Math.PI / 2, 0]);
    add(eye, 'sphere', 'lens', [s * .064, .015, -.076], [.01, .017, .017]);
  }
  const beak = part('head.beak', 'Long tapered beak mandrel', 'Head', 'Establishes the long-beaked bird silhouette.', 'A tapered metal upper bill follows the forward axis, with a separate open lower rail.', head, [0, 0, -.13]);
  add(beak, 'cone', 'titanium', [0, -.005, -.335], [.026, .38, .026], [-Math.PI / 2, 0, 0]);
  rod(beak, 'dark', [0, -.021, -.15], [0, -.012, -.515], .0045);
  for (const z of [-.16, -.2, -.24]) add(beak, 'ring', 'brass', [0, -.005, z], [.018, .018, .018], [0, 0, 0], true);

  for (const w of last.wings) {
    const prefix = `wing.${w.id}`, label = `${w.side < 0 ? 'Left' : 'Right'} wing`;
    const root = part(`${prefix}.housing`, `${label} fixed bearing bridge`, 'Shoulder linkage', 'Fixes both crank and rocker pivots to the body.', 'Rear stays leave the forward connecting-rod plane entirely open.', undefined, [w.side * .12, .07, 0]);
    root.position.fromArray(w.origin); root.rotation.y = w.side < 0 ? Math.PI : 0;
    journal(root, [0, 0, -.028], .028); journal(root, [...D.crank.slice(0, 2), -.028], .033);
    for (const z of [-.07, -.04]) rod(root, 'titanium', [0, 0, z], [D.crank[0], D.crank[1], z], .011);
    const crank = part(`${prefix}.crank`, `${label} inspection crank`, 'Shoulder linkage', 'Rotates the adjustable eccentric about its fixed journal.', 'A radial slot moves only the eccentric pin, not the conrod.', root, [0, -.07, -.04]); crank.position.fromArray(D.crank);
    rod(crank, 'dark', [0, 0, -.015], [.044, 0, -.015], .009);
    const disk = part(`${prefix}.disk`, `${label} brass indexing disk`, 'Drive timing', 'Makes the full input revolution visible.', 'Sixteen teeth and a datum cap surround the lower crank bearing.', crank, [0, 0, -.035]); disk.rotation.x = Math.PI / 2; kit.gear(disk, .054, 16, .014, 'brass');
    const pin = part(`${prefix}.eccentric`, `${label} extended eccentric journal`, 'Shoulder linkage', 'Engages the forward connecting-rod bush.', 'An axial pin bridges the gap from disk to rod plane.', crank, [0, 0, .04]); journal(pin, [0, 0, 0], .014, D.rodPlane);
    const rocker = part(`${prefix}.rocker`, `${label} rigid shoulder rocker`, 'Shoulder linkage', 'Turns the solved pin path into the wing stroke.', 'A 95 mm lever rotates around the fixed shoulder bearing.', root, [.04, .04, 0]);
    const lever = [D.rocker * Math.cos(DATUM), D.rocker * Math.sin(DATUM), 0]; rod(rocker, 'titanium', [0, 0, 0], lever, .009); journal(rocker, lever, .015, D.rodPlane);
    const conrod = part(`${prefix}.conrod`, `${label} 155 mm rigid conrod`, 'Shoulder linkage', 'Closes the crank–rocker loop without stretching.', 'A central rigid rail and two bushings run 70 mm ahead of the disk.', root, [0, -.05, .08]);
    rod(conrod, 'titanium', [0, 0, 0], [0, D.conrod, 0], .006);
    for (const y of [0, D.conrod]) journal(conrod, [0, y, 0], .014, 0);
    for (const y of [.035, .065, .095, .125]) add(conrod, 'box', 'dark', [0, y, 0], [.02, .006, .009], [0, 0, 0], true);
    const sweep = part(`${prefix}.sweep`, `${label} shoulder sweep cartridge`, 'Secondary servos', 'Adds prescribed fore–aft sweep after the mechanical stroke.', 'Its bearing frame is carried by the moving rocker.', rocker, [.06, .04, 0]);
    add(sweep, 'cylinder', 'dark', [0, 0, 0], [.032, .08, .032]); add(sweep, 'ring', 'brass', [0, .043, 0], [.028, .028, .028], [Math.PI / 2, 0, 0]);
    const pitch = part(`${prefix}.pitch`, `${label} span-axis pitch bearing`, 'Secondary servos', 'Rotates the feather fan around its leading spar.', 'The nested pitch cartridge rotates rigidly inside the sweep frame.', sweep, [.07, 0, 0]);
    for (const x of [.025, .07]) add(pitch, 'ring', 'titanium', [x, 0, 0], [.026, .026, .026], [0, Math.PI / 2, 0]);
    rod(pitch, 'brass', [0, 0, 0], [.095, 0, 0], .016);
    const upper = part(`${prefix}.upper`, `${label} 370 mm humeral spar`, 'Wing skeleton', 'Carries the secondary fan and elbow bracket.', 'Paired rails and discrete spacers preserve the exact shoulder-to-elbow length.', pitch, [.06, .03, 0]); spar(upper, D.upper);
    const upperArmor = part(`${prefix}.upper.armor`, `${label} humeral service cover`, 'Armor', 'Protects the inner spar without filling the wing.', 'A short separate shell leaves its paired rails visible.', upper, [0, .07, 0], 'Pale alloy shell');
    add(upperArmor, 'box', 'shell', [.16, .025, 0], [.21, .015, .037]); kit.fasteners(upperArmor, [[.08, .036, 0], [.24, .036, 0]], .005);
    const bracket = part(`${prefix}.elbow.bracket`, `${label} parent-mounted elbow fork`, 'Wing skeleton', 'Locates the forearm folding axis at the upper spar end.', 'Two cheeks stay fixed to the humeral frame while the forearm rotates.', upper, [0, .05, 0]);
    for (const y of [-.032, .032]) add(bracket, 'box', 'dark', [D.upper, y, 0], [.068, .014, .075]);
    add(bracket, 'cylinder', 'brass', [D.upper, 0, 0], [.016, .09, .016]); kit.fasteners(bracket, [[D.upper, .045, -.024], [D.upper, .045, .024]], .006);
    const fore = part(`${prefix}.fore`, `${label} 280 mm folding forearm`, 'Wing skeleton', 'Carries the radial primary feather fan.', 'A fixed-length spar rotates at the elbow; folding is a prescribed servo command.', upper, [.08, 0, .04]); fore.position.x = D.upper; spar(fore, D.fore);
    add(fore, 'ring', 'titanium', [0, 0, 0], [.026, .026, .026], [Math.PI / 2, 0, 0]);
    const foreArmor = part(`${prefix}.fore.armor`, `${label} forearm split shield`, 'Armor', 'Protects the leading edge of the folding spar.', 'A narrow separate cover rides on the forearm frame.', fore, [0, .07, 0], 'Pale alloy shell');
    add(foreArmor, 'box', 'shell', [.15, .024, 0], [.16, .013, .035]); kit.fasteners(foreArmor, [[.1, .035, 0], [.2, .035, 0]], .005);
    const feathers = [];
    for (const f of w.feathers) {
      const spec = featherSpec(f.layer, f.i, w.side), parent = f.layer === 'primary' ? fore : upper;
      const stem = `${prefix}.${f.layer}.${f.i + 1}`, title = `${label} ${f.layer} feather ${f.i + 1}`;
      const socket = part(`${stem}.socket`, `${title} root socket`, 'Feather articulation', 'Retains an individually removable open metal feather.', 'A fixed shell shoe and brass collar attach to the parent spar.', parent, [0, .03, w.side * .06], 'Pale shell, brass and titanium');
      kit.aim(socket, spec.start, spec.end);
      add(socket, 'box', 'shell', [0, .03, -.011], [.025, .056, .012]); add(socket, 'ring', 'brass', [0, .018, 0], [.012, .012, .012], [Math.PI / 2, 0, 0]); kit.fasteners(socket, [[0, .031, -.012]], .004);
      const feather = part(`${stem}.rib`, `${title} open rib`, 'Feather lattice', 'Preserves one tapered feather as a rigid open frame.', 'An axial quill, paired perimeter ribs and four ties leave daylight between members; trim twists about the quill.', parent, [0, .04, w.side * .1]);
      kit.aim(feather, spec.start, spec.end); flattenVane(feather); quill(feather, spec.length, spec.width); feathers.push(feather);
    }
    wings.push({ root, crank, pin, rocker, conrod, sweep, pitch, fore, feathers });
  }
  const tailRoot = part('tail.yoke', 'Seven-way tail root comb', 'Tail trim', 'Supports the independently articulated rear fan.', 'Seven separated root bearings span a transverse tail yoke.', undefined, [0, -.03, .08]);
  rod(tailRoot, 'titanium', [-.065, 1.235, .24], [.065, 1.235, .24], .014);
  last.tail.forEach((t, i) => {
    const socket = part(`tail.${i}.socket`, `Tail feather ${i + 1} gimbal socket`, 'Tail trim', 'Fixes the pitch and spread origin of this tail quill.', 'A small support fork remains attached to the fixed rear comb.', tailRoot, [0, .04, .08]);
    add(socket, 'ring', 'brass', t.start, [.015, .015, .015]); add(socket, 'box', 'dark', [t.start[0], t.start[1] - .016, t.start[2]], [.018, .024, .035]);
    const feather = part(`tail.${i}.rib`, `Tail feather ${i + 1} open vane`, 'Tail trim', 'Shows the programmed fan trim with a rigid quill.', 'Pitch and spread change its pose, never its length or taper.', undefined, [(i - 3) * .025, -.02, .15]); quill(feather, t.length, .024); tails.push(feather);
  });
  for (const c of last.claws) {
    const label = c.side < 0 ? 'Left' : 'Right', root = part(`claw.${c.side}.root`, `${label} folded claw hip`, 'Folded claws', 'Hangs a folded foot beneath the supported body.', 'The claw is ornamental articulation, not a ground support.', undefined, [c.side * .05, -.05, 0]); journal(root, c.points[0], .022);
    const links = D.claw.map((length, i) => {
      const link = part(`claw.${c.side}.${i}`, `${label} claw ${['thigh', 'shank', 'toe'][i]}`, 'Folded claws', 'Maintains a fixed pin-to-pin foot link.', 'Paired small rods and a transverse bush move between sampled joints.', undefined, [c.side * .04, -.05 * (i + 1), 0]);
      for (const x of [-.007, .007]) rod(link, 'titanium', [x, 0, 0], [x, length, 0], .004); journal(link, [0, 0, 0], .012);
      for (const y of [.03, length - .012]) kit.fasteners(link, [[0, y, 0]], .004);
      if (i === 2) for (const s of [-1, 1]) {
        const talon = part(`claw.${c.side}.talon.${s}`, `${label} ${s < 0 ? 'inner' : 'outer'} curved talon`, 'Folded claws', 'Forms a split gripping tip without touching the pedestal.', 'Three rigid tube sections describe a small hooked toe.', link, [s * .025, .025, 0]);
        rod(talon, 'dark', [s * .006, length, 0], [s * .021, length + .022, 0], .005); rod(talon, 'dark', [s * .021, length + .022, 0], [s * .021, length + .031, -.016], .004); rod(talon, 'titanium', [s * .021, length + .031, -.016], [s * .013, length + .028, -.025], .003);
      }
      return link;
    }); claws.push(links);
  }
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
  function update(state = last, options = {}) {
    if (disposed) return;
    if (state?.wings && state?.tail) last = state;
    else if (Number.isFinite(state?.driveAngle)) last = poseAt(state.driveAngle, last.controls);
    for (const { node, p, q } of bind) { node.position.copy(p); node.quaternion.copy(q); }
    head.rotation.y = last.headYaw;
    wings.forEach((n, i) => {
      const w = last.wings[i]; n.crank.rotation.z = last.driveAngle; n.pin.position.x = w.radius; n.rocker.rotation.z = w.flap;
      kit.aim(n.conrod, w.crank, w.rocker); n.conrod.position.z = D.rodPlane;
      n.sweep.rotation.y = -w.side * w.sweep; n.pitch.rotation.x = w.side * w.pitch; n.fore.rotation.y = -w.side * w.fold;
      n.feathers.forEach((feather, j) => feather.rotateY(w.feathers[j].twist));
    });
    tails.forEach((n, i) => kit.aim(n, last.tail[i].start, last.tail[i].end));
    claws.forEach((links, i) => links.forEach((n, j) => kit.aim(n, last.claws[i].points[j], last.claws[i].points[j + 1])));
    kit.sync(options);
  }
  update(last);
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
