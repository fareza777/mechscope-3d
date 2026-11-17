import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, LIMBS, sample, distance, add as vadd, sub as vsub, mul as vmul } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('DRACONIS D6 · winged mechanical dragon');
  const { add, rod, gear, fasteners, aim } = kit;
  const basis = new THREE.Matrix4();
  let current = sample(0), disposed = false;
  function part(id, name, system, purpose, how, parent, explode = [0, .12, 0], material = 'Titanium / teal armour') {
    return kit.part({ id: `dragon.${id}`, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode);
  }
  // A rigid sub-frame that carries the same selectable identity as its owning assembly.
  function child(owner, name) {
    const node = new THREE.Group(); node.name = `${owner.name}.${name}`; node.userData.partId = owner.userData.partId; owner.add(node); return node;
  }
  function place(node, origin, f) {
    basis.set(f[0], f[1], f[2], 0, f[3], f[4], f[5], 0, f[6], f[7], f[8], 0, 0, 0, 0, 1);
    node.position.fromArray(origin); node.quaternion.setFromRotationMatrix(basis);
  }
  function stretch(node, a, b, width, depth = width) {
    const d = distance(a, b); aim(node, a, b); node.scale.set(width, Math.max(d, 1e-4), depth);
  }
  function stretchFramed(node, a, f, length, width, depth) { place(node, a, f); node.scale.set(width, Math.max(length, 1e-4), depth); }
  const box = (n, m, p, s, e = [0, 0, 0], detail = false) => add(n, 'box', m, p, s, e, detail);
  const side = s => s < 0 ? 'L' : 'R', sideName = s => s < 0 ? 'Left' : 'Right';

  // ------------------------------------------------------------------ shared member builders
  function vertebra(n, length, r, k = 1, spike = true) {
    add(n, 'cylinder', 'dark', [0, length / 2, 0], [r, length * .92, r]);
    add(n, 'ring', 'brass', [0, length * .06, 0], [r * 1.12, r * 1.12, r * 1.6], [Math.PI / 2, 0, 0]);
    box(n, 'teal', [0, length * .5, r * .95], [r * 1.5, length * .96, r * .32], [-.12, 0, 0]);
    box(n, 'shell', [0, length * .78, r * 1.18], [r * 1.05, length * .52, r * .22], [-.22, 0, 0]);
    for (const s of [-1, 1]) {
      box(n, 'shell', [s * r * 1.02, length * .5, r * .35], [r * .26, length * .86, r * 1.05], [0, 0, s * .28]);
      rod(n, 'copper', [s * r * .8, .01, -r * .7], [s * r * .8, length - .01, -r * .7], r * .13, true);
    }
    box(n, 'dark', [0, length * .5, -r * .92], [r * 1.1, length * .8, r * .25], [0, 0, 0], true);
    if (spike) add(n, 'cone', 'titanium', [0, length * .42, r * 1.55 + .03 * k], [r * .32, .07 * k + r * .6, r * .5], [.65, 0, 0]);
    fasteners(n, [[r * .7, length * .3, r * 1.08], [-r * .7, length * .7, r * 1.08]], .006 * k + .002);
  }
  function limbMember(n, length, w, armour = 'teal', knee = true) {
    for (const s of [-1, 1]) rod(n, 'titanium', [s * w, .03, 0], [s * w, length - .03, 0], w * .42);
    box(n, armour, [0, length * .52, w * .62], [w * 2.3, length * .74, w * .42]);
    box(n, 'shell', [0, length * .32, w * .95], [w * 1.6, length * .30, w * .28], [.05, 0, 0]);
    box(n, 'dark', [0, length * .5, -w * .2], [w * 1.4, length * .58, w * .9]);
    for (let i = 0; i < 4; i++) rod(n, 'copper', [w * (-.75 + i * .5), .06, -w * .8], [w * (-.75 + i * .5), length - .07, -w * .8], w * .12, true);
    for (const y of [length * .2, length * .82]) box(n, 'brass', [0, y, w * .4], [w * 2.6, .018, w * .9]);
    if (knee) {
      add(n, 'cylinder', 'dark', [0, length, 0], [w * 1.2, w * 3.3, w * 1.2], [0, 0, Math.PI / 2]);
      for (const s of [-1, 1]) add(n, 'ring', 'brass', [s * w * 1.66, length, 0], [w * 1.05, w * 1.05, w * 1.05], [0, Math.PI / 2, 0]);
    }
    fasteners(n, [[w, length * .4, w * .85], [-w, length * .64, w * .85]], .007);
  }
  function actuator(id, name, length = D.barrel) {
    const barrel = part(`${id}.barrel`, `${name} · hydraulic barrel`, 'Hydraulic actuators', 'Hold a fixed-length pressure sleeve between two bushed clevises.', 'The rigid barrel aims at the moving eye; only the exposed rod length changes.', undefined, [.06, .06, 0], 'Dark alloy / copper glands');
    add(barrel, 'cylinder', 'dark', [0, length / 2, 0], [.026, length, .026]);
    for (const y of [.012, length - .014]) add(barrel, 'cylinder', 'copper', [0, y, 0], [.032, .02, .032]);
    rod(barrel, 'rubber', [-.035, .02, 0], [-.035, length - .02, 0], .007, true);
    box(barrel, 'titanium', [.03, .02, 0], [.016, .03, .04]);
    const piston = part(`${id}.rod`, `${name} · polished ram`, 'Hydraulic actuators', 'Take up the sampled clevis-to-clevis distance.', 'A ram slides from inside the barrel; its scale equals the analytic exposed stroke.', undefined, [.1, .1, 0], 'Polished titanium');
    add(piston, 'cylinder', 'titanium', [0, .5, 0], [.011, 1, .011]);
    const clevis = part(`${id}.clevis`, `${name} · rod-end clevis`, 'Hydraulic actuators', 'Pass ram force into the limb through a bushed pin.', 'The eye remains centred on the computed mount in the moving member frame.', undefined, [.12, .06, 0], 'Titanium / bronze');
    add(clevis, 'sphere', 'brass', [0, 0, 0], [.025, .025, .025]);
    add(clevis, 'cylinder', 'dark', [0, 0, 0], [.012, .08, .012], [0, 0, Math.PI / 2]);
    return { barrel, piston, clevis, length };
  }
  function poseActuator(n, a, b) {
    const d = distance(a, b), start = n.length - .02;
    aim(n.barrel, a, b); aim(n.piston, vadd(a, vmul(vsub(b, a), start / d)), b); n.piston.scale.set(1, d - start, 1);
    n.clevis.position.fromArray(b); aim(n.clevis, b, vadd(b, vsub(b, a))); n.clevis.position.fromArray(b);
  }

  // ------------------------------------------------------------------ pelvis, torso and chest
  const pelvis = part('pelvis', 'Pelvic girdle · hip gearbox', 'Axial skeleton', 'Anchor both hind legs, the tail root and the rear of the dorsal drive.', 'A wide dark girdle carries two hip cartridges and an exposed three-gear transfer case.', undefined, [0, .05, .25], 'Dark alloy / brass gears');
  box(pelvis, 'dark', [0, 0, 0], [.46, .32, .22]);
  box(pelvis, 'teal', [0, .02, .13], [.40, .36, .06], [.1, 0, 0]);
  box(pelvis, 'teal', [0, -.05, -.14], [.30, .30, .05]);
  box(pelvis, 'shell', [0, -.12, .12], [.26, .14, .04], [-.3, 0, 0]);
  for (const s of [-1, 1]) {
    add(pelvis, 'cylinder', 'dark', [s * .25, -.02, -.07], [.075, .09, .075], [0, 0, Math.PI / 2]);
    add(pelvis, 'ring', 'brass', [s * .30, -.02, -.07], [.08, .08, .08], [0, Math.PI / 2, 0]);
    rod(pelvis, 'titanium', [s * .08, .08, .04], [s * .25, -.02, -.07], .022);
    rod(pelvis, 'titanium', [s * .08, -.10, .04], [s * .25, -.02, -.07], .018);
    add(pelvis, 'cylinder', 'copper', [s * .17, -.12, .13], [.03, .05, .03]);
    box(pelvis, 'shell', [s * .28, .02, .04], [.08, .30, .20], [0, 0, s * .25]);
    box(pelvis, 'teal', [s * .33, -.04, -.04], [.05, .22, .16], [0, 0, s * .1]);
  }
  fasteners(pelvis, [[-.15, .1, .13], [.15, .1, .13], [-.15, -.1, .13], [.15, -.1, .13]], .009);
  const gearbox = [0, 1, 2].map(i => {
    const g = part(`pelvis.gear-${i + 1}`, `Hip transfer gear ${i + 1}`, 'Dorsal drive', 'Show the gait timing that couples the hip drives to the master phase.', 'Meshed spur wheels turn once per stride in alternating directions above the girdle.', pelvis, [0, 0, .12], 'Bronze / titanium');
    g.position.set((i - 1) * .105, -.02, .20); g.rotation.x = Math.PI / 2; gear(g, .052, 14, .02); return g;
  });

  const torso = current.torso.map((s, i) => {
    const n = part(`torso.v${i + 1}`, `Dorsal vertebra ${i + 1}`, 'Axial skeleton', 'Carry the walking undulation and rearing arch between pelvis and chest.', 'Each rigid 170 mm centrum takes a small relative pitch and yaw in a serial chain.', undefined, [0, .1 + i * .02, 0], 'Dark alloy / teal armour');
    vertebra(n, s.length, .13, 1.5);
    for (const sd of [-1, 1]) {
      box(n, 'teal', [sd * .16, s.length * .5, .07], [.07, s.length * .98, .16], [0, 0, sd * .55]);
      box(n, 'shell', [sd * .22, s.length * .5, -.02], [.035, s.length * .9, .12], [0, 0, sd * .2]);
      fasteners(n, [[sd * .17, s.length * .5, .15]], .007);
    }
    box(n, 'teal', [0, s.length * .5, -.40], [.22, s.length * .95, .04], [.08, 0, 0]);
    box(n, 'dark', [0, s.length * .5, -.37], [.12, s.length * .7, .03], [0, 0, 0], true);
    rod(n, 'brass', [0, 0, .035], [0, s.length, .035], .018);
    add(n, 'cylinder', 'brass', [0, s.length * .5, .035], [.03, .035, .03], [0, 0, 0], true);
    return n;
  });
  const ribs = torso.map((v, i) => [-1, 1].map(s => {
    const r = part(`torso.rib-${side(s)}${i + 1}`, `${sideName(s)} bellows rib ${i + 1}`, 'Bellows ribcage', 'Visibly expand the flank as the furnace breathes.', 'A curved rib on a longitudinal hinge swings outward with the sampled breathing angle.', v, [s * .16, 0, 0], 'Titanium / shell scales');
    r.position.set(s * .07, current.torso[i].length / 2, 0);
    const pts = [[0, 0, 0], [s * .19, 0, -.08], [s * .24, 0, -.24], [s * .14, 0, -.38]];
    for (let j = 0; j < 3; j++) rod(r, 'titanium', pts[j], pts[j + 1], .012);
    for (let j = 0; j < 2; j++) box(r, 'shell', vmul(vadd(pts[j + 1], pts[j + 2]), .5), [.03, .15, .16], [0, 0, s * (j ? -.45 : .2)]);
    box(r, 'teal', vmul(vadd(pts[0], pts[1]), .5), [.05, .1, .05], [0, 0, s * .4]);
    add(r, 'sphere', 'brass', pts[3], [.016, .016, .016], [0, 0, 0], true);
    return r;
  }));
  const fins = torso.map((v, i) => {
    const h = .20 + .12 * Math.sin(Math.PI * (i + .5) / 6);
    const f = part(`torso.fin-${i + 1}`, `Erectile dorsal crest blade ${i + 1}`, 'Threat display', 'Raise the silhouette during display and coil, then fold flat for prowling.', 'A hinged blade rotates about the vertebra crosswise axis by the sampled crest angle.', v, [0, 0, .14], 'Shell / titanium edge');
    f.position.set(0, current.torso[i].length * .5, .15);
    box(f, 'shell', [0, h * .5, .015], [.012, h, .085], [0, 0, 0]);
    rod(f, 'titanium', [0, 0, -.03], [0, h, .02], .009);
    add(f, 'cone', 'titanium', [0, h + .02, .02], [.012, .05, .012]);
    return f;
  });

  const chest = part('chest', 'Pectoral keel · shoulder girdle', 'Axial skeleton', 'Join fore legs, wing roots and neck base into one load frame.', 'A deep keel, a transverse girdle bar and two dorsal wing brackets form an open cage around the gyroscope.', undefined, [0, .08, -.25], 'Teal armour / dark alloy');
  box(chest, 'teal', [0, -.02, -.25], [.16, .46, .16], [.12, 0, 0]);
  box(chest, 'shell', [0, .08, -.35], [.12, .34, .07], [.25, 0, 0]);
  for (let j = 0; j < 4; j++) box(chest, 'dark', [0, -.16 + j * .1, -.33 + j * .02], [.2, .03, .05], [.12, 0, 0], true);
  rod(chest, 'titanium', [-.30, -.04, -.12], [.30, -.04, -.12], .03);
  rod(chest, 'titanium', [-.22, -.10, .24], [.22, -.10, .24], .028);
  for (const s of [-1, 1]) {
    add(chest, 'cylinder', 'dark', [s * .25, -.04, -.12], [.065, .08, .065], [0, 0, Math.PI / 2]);
    rod(chest, 'titanium', [s * .22, -.10, .24], [s * .17, -.10, .30], .022);
    rod(chest, 'dark', [s * .25, -.04, -.12], [s * .19, -.10, .24], .02);
    rod(chest, 'dark', [s * .05, -.18, -.25], [s * .25, -.04, -.12], .018);
    box(chest, 'shell', [s * .2, .02, .16], [.10, .26, .04], [0, 0, s * .4]);
    box(chest, 'teal', [s * .30, -.02, -.02], [.06, .28, .26], [0, 0, s * .35]);
    box(chest, 'shell', [s * .34, -.04, -.06], [.03, .22, .2], [0, 0, s * .2]);
    fasteners(chest, [[s * .32, .08, .06]], .008);
    for (let j = 0; j < 4; j++) rod(chest, 'titanium', [s * .07, -.15 + j * .1, .2], [s * .15, -.17 + j * .1, -.16], .008, true);
  }
  rod(chest, 'dark', [0, .10, .12], [0, -.08, .08], .03);
  add(chest, 'ring', 'titanium', [0, 0, 0], [.17, .17, .17], [0, Math.PI / 2, 0]);
  fasteners(chest, [[.06, -.1, .25], [-.06, -.1, .25], [.06, .05, -.27], [-.06, .05, -.27]], .008);
  const gyroOuter = part('chest.gyro-outer', 'Furnace gyroscope · outer gimbal', 'Furnace core', 'Represent the stabilising gyroscope that the rearing pose would need.', 'Three nested gimbals spin at 4, 6 and 10 turns per cycle; no angular momentum is computed.', chest, [-.25, 0, 0], 'Brass / titanium');
  add(gyroOuter, 'ring', 'brass', [0, 0, 0], [.13, .13, .13]);
  for (const s of [-1, 1]) add(gyroOuter, 'cylinder', 'titanium', [s * .14, 0, 0], [.012, .04, .012], [0, 0, Math.PI / 2]);
  const gyroMiddle = part('chest.gyro-middle', 'Furnace gyroscope · inner gimbal', 'Furnace core', 'Carry the rotor on a second perpendicular axis.', 'A smaller ring rotates about the outer gimbal journal axis.', gyroOuter, [0, .25, 0], 'Teal / titanium');
  add(gyroMiddle, 'ring', 'teal', [0, 0, 0], [.10, .10, .10], [Math.PI / 2, 0, 0]);
  const gyroCore = part('chest.gyro-core', 'Furnace rotor · glowing core', 'Furnace core', 'Show the heart of the machine through the open ribcage.', 'A glowing core between copper flywheel discs spins on the innermost axis.', gyroMiddle, [0, 0, .25], 'Optical glass / copper');
  add(gyroCore, 'sphere', 'lens', [0, 0, 0], [.045, .045, .045]);
  for (const s of [-1, 1]) add(gyroCore, 'cylinder', 'copper', [0, s * .04, 0], [.075, .012, .075]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; box(gyroCore, 'brass', [.07 * Math.cos(a), 0, .07 * Math.sin(a)], [.03, .02, .012], [0, -a, 0], true); }

  // ------------------------------------------------------------------ neck, head and tendons
  const neck = current.neck.map((s, i) => {
    const n = part(`neck.c${i + 1}`, `Cervical vertebra ${i + 1}`, 'Ten-link neck', 'Form the S-curve, roaring arch, coiled recoil and straight strike.', 'Ten rigid 115 mm links blend four named posture tables with a travelling scan wave.', undefined, [0, .1 + i * .015, -.05 - i * .02], 'Dark alloy / teal armour');
    vertebra(n, s.length, .102 - i * .003, 1.1);
    for (const sd of [-1, 1]) box(n, 'teal', [sd * (.095 - i * .003), s.length * .5, .02], [.04, s.length * .95, .13 - i * .004], [0, 0, sd * .35]);
    box(n, 'shell', [0, s.length * .5, -.085 + i * .002], [.12 - i * .004, s.length * .9, .03], [.1, 0, 0]);
    return n;
  });
  const neckTendons = part('neck.tendons', 'Paired neck lift tendons', 'Ten-link neck', 'Visualise the long cable path that would hold the head high.', 'Two copper cables run from the chest bracket to the fifth cervical link and follow its frame.', undefined, [0, .18, 0], 'Copper cable');
  const neckCables = [-1, 1].map(s => { const c = child(neckTendons, `cable-${side(s)}`); add(c, 'cylinder', 'copper', [0, .5, 0], [1, 1, 1]); return c; });

  const skull = part('head.skull', 'Armoured skull · upper jaw', 'Head', 'Carry the eyes, horns, nostrils, upper teeth and furnace throat.', 'The skull rides the tenth neck link with an extra sampled yaw and pitch.', undefined, [0, .22, -.18], 'Teal armour / dark alloy');
  const head = child(skull, 'scaled-frame'); head.scale.setScalar(1.5);
  box(head, 'dark', [0, .07, .02], [.21, .17, .17]);
  for (let i = 0; i < 5; i++) {
    const y = .17 + i * .065, w = .18 - i * .02;
    box(head, 'teal', [0, y, .03 - i * .006], [w, .075, .09 - i * .006]);
    box(head, 'shell', [0, y, .08 - i * .01], [w * .7, .07, .02], [-.12, 0, 0]);
  }
  for (const s of [-1, 1]) {
    box(head, 'shell', [s * .085, .15, .10], [.05, .16, .035], [.25, 0, s * .2]);
    add(head, 'sphere', 'lens', [s * .095, .17, .075], [.03, .028, .024]);
    add(head, 'ring', 'brass', [s * .1, .17, .075], [.034, .034, .034], [0, Math.PI / 2, 0]);
    add(head, 'sphere', 'lens', [s * .03, .455, .05], [.012, .012, .01], [0, 0, 0], true);
    const horn = [[s * .07, .02, .12], [s * .12, -.11, .20], [s * .15, -.25, .24]];
    rod(head, 'titanium', horn[0], horn[1], .028); rod(head, 'titanium', horn[1], horn[2], .021);
    add(head, 'cone', 'titanium', [s * .158, -.30, .25], [.018, .09, .018], [Math.PI * .56, 0, -s * .2]);
    const small = [[s * .10, .06, .05], [s * .17, -.04, .07]];
    rod(head, 'brass', small[0], small[1], .014); add(head, 'cone', 'brass', [s * .19, -.07, .075], [.012, .05, .012], [Math.PI * .55, 0, -s * .5]);
    for (let j = 0; j < 7; j++) add(head, 'cone', 'shell', [s * (.07 - j * .004), .2 + j * .036, -.045], [.009, .04, .009], [-Math.PI / 2 - .1, 0, 0], j % 2 === 1);
    rod(head, 'copper', [s * .09, .02, -.03], [s * .07, .30, -.04], .008, true);
  }
  add(head, 'sphere', 'lens', [0, .13, -.035], [.04, .05, .03]);
  add(head, 'ring', 'copper', [0, .13, -.04], [.05, .05, .05]);
  fasteners(head, [[.06, .05, .11], [-.06, .05, .11]], .007);
  const jaw = part('head.jaw', 'Hinged lower jaw · furnace vent', 'Head', 'Open for the roar and snap shut at the end of the strike.', 'One transverse hinge pin rotates the mandible by the sampled jaw angle.', head, [0, 0, -.12], 'Teal armour / titanium teeth');
  jaw.position.set(0, .05, -.055);
  add(jaw, 'cylinder', 'dark', [0, 0, 0], [.03, .22, .03], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) {
    box(jaw, 'teal', [s * .06, .2, -.02], [.035, .38, .05], [0, 0, -s * .05]);
    for (let j = 0; j < 6; j++) add(jaw, 'cone', 'shell', [s * (.058 - j * .003), .17 + j * .04, .015], [.008, .035, .008], [Math.PI / 2 + .1, 0, 0], j % 2 === 1);
  }
  box(jaw, 'teal', [0, .38, -.025], [.12, .06, .045]);
  box(jaw, 'dark', [0, .2, -.045], [.09, .32, .02]);
  add(jaw, 'sphere', 'lens', [0, .12, -.01], [.03, .05, .015]);
  const frills = [-1, 1].map(s => {
    const f = part(`head.frill-${side(s)}`, `${sideName(s)} spreading neck frill`, 'Threat display', 'Fan open behind the skull while rearing or coiled.', 'Five ribs and four shell vanes rotate about one vertical hinge by the sampled frill angle.', head, [s * .14, -.05, 0], 'Shell vanes / titanium ribs');
    f.position.set(s * .09, -.02, .06);
    const tips = [0, 1, 2, 3, 4].map(j => { const a = -.4 + j * .26; return [s * .24 * Math.sin(.5 + j * .12), -.22 * Math.cos(a) - .02, .20 * Math.sin(a) + .02]; });
    for (const t of tips) { rod(f, 'titanium', [0, 0, 0], t, .008); add(f, 'sphere', 'brass', t, [.012, .012, .012], [0, 0, 0], true); }
    for (let j = 0; j < 4; j++) box(f, 'shell', vmul(vadd(tips[j], tips[j + 1]), .48), [.012, .2, .08], [Math.atan2(tips[j][2], -tips[j][1]) + .1, 0, -s * .5]);
    return f;
  });

  // ------------------------------------------------------------------ tail
  const tail = current.tail.map((s, i) => {
    const k = s.length / .15;
    const n = part(`tail.t${i + 1}`, `Caudal vertebra ${i + 1}`, 'Eighteen-link tail', 'Counterbalance the rearing body and lash in a travelling wave.', 'Tapering rigid links carry a phase-lagged yaw wave whose amplitude grows towards the tip.', undefined, [0, .06 + i * .01, .05 + i * .03], 'Dark alloy / teal armour');
    vertebra(n, s.length, .092 * k - .01 * i / 17, k, i % 2 === 0);
    if (i < 12) for (const sd of [-1, 1]) box(n, 'teal', [sd * .08 * k, s.length * .5, .01], [.03, s.length * .9, .08 * k], [0, 0, sd * .4]);
    return n;
  });
  const tailTendons = part('tail.tendons', 'Paired tail lift tendons', 'Eighteen-link tail', 'Show the cable path that would raise the tail as a counterweight.', 'Two copper cables run from the pelvis to the sixth caudal link and follow it.', undefined, [0, .16, .1], 'Copper cable');
  const tailCables = [-1, 1].map(s => { const c = child(tailTendons, `cable-${side(s)}`); add(c, 'cylinder', 'copper', [0, .5, 0], [1, 1, 1]); return c; });
  const blade = part('tail.blade', 'Spade tail rudder', 'Eighteen-link tail', 'Terminate the tail with a broad balancing vane.', 'A rigid two-lobe spade is fixed to the final caudal frame.', undefined, [0, .1, .35], 'Shell / titanium edge');
  for (const s of [-1, 1]) {
    box(blade, 'shell', [s * .07, .1, 0], [.12, .2, .014], [0, 0, -s * .55]);
    rod(blade, 'titanium', [0, 0, 0], [s * .14, .12, 0], .009); rod(blade, 'titanium', [s * .14, .12, 0], [0, .28, 0], .009);
  }
  add(blade, 'cone', 'titanium', [0, .3, 0], [.02, .07, .02]);

  // ------------------------------------------------------------------ four digitigrade legs
  const legs = LIMBS.map(limb => {
    const L = limb.hind ? D.hind : D.fore, label = `${sideName(limb.side)} ${limb.hind ? 'hind' : 'fore'} leg`, id = `leg.${limb.id}`;
    const w = limb.hind ? .072 : .06;
    const upper = part(`${id}.upper`, `${label} · ${Math.round(L.upper * 1000)} mm ${limb.hind ? 'femur' : 'humerus'}`, 'Digitigrade legs', 'Reach the knee at the upper circle intersection.', 'Twin rails keep the rigid length while a pole vector bends the knee forward on hind legs and back on fore legs.', undefined, [limb.side * .18, .02, 0]);
    limbMember(upper, L.upper, w);
    box(upper, 'teal', [0, L.upper * .38, w * 1.25], [w * 3.4, L.upper * .55, w * 1.5], [.06, 0, 0]);
    box(upper, 'shell', [0, L.upper * .30, w * 2.05], [w * 2.6, L.upper * .34, w * .35], [.1, 0, 0]);
    for (const sd of [-1, 1]) box(upper, 'teal', [sd * w * 1.9, L.upper * .42, w * .4], [w * .5, L.upper * .5, w * 2], [0, 0, 0]);
    add(upper, 'sphere', 'dark', [0, 0, 0], [w * 1.8, w * 1.8, w * 1.8]);
    const lower = part(`${id}.lower`, `${label} · ${Math.round(L.lower * 1000)} mm ${limb.hind ? 'tibia' : 'forearm'}`, 'Digitigrade legs', 'Carry the ankle to its prescribed metatarsal pose.', 'The second rigid member closes the analytic two-link triangle exactly.', undefined, [limb.side * .25, -.02, 0]);
    limbMember(lower, L.lower, w * .82, 'shell');
    box(lower, 'teal', [0, L.lower * .3, w * 1.0], [w * 2.4, L.lower * .4, w * 1.1], [-.05, 0, 0]);
    const meta = part(`${id}.meta`, `${label} · raised ${limb.hind ? 'metatarsus' : 'metacarpus'}`, 'Digitigrade legs', 'Lift the heel so the leg stands on its toes.', 'Its inclination follows the swing and raised-paw envelopes before the knee is solved.', undefined, [limb.side * .3, -.04, 0]);
    limbMember(meta, L.meta, w * .7, 'teal', false);
    add(meta, 'cone', 'titanium', [0, .02, -.03], [.014, .07, .014], [Math.PI * .8, 0, 0]);
    const foot = part(`${id}.foot`, `${label} · padded sole`, 'Ground interface', 'Keep the stance pad level on the floor datum.', 'The pad frame stays level in stance and tilts only on the raised fore paws.', undefined, [limb.side * .34, -.06, 0], 'Rubber / titanium');
    box(foot, 'rubber', [0, -.01, 0], [.17, .15, .055]);
    box(foot, 'dark', [0, -.03, .035], [.12, .09, .03]);
    add(foot, 'sphere', 'brass', [0, 0, .03], [.028, .028, .028]);
    for (let j = 0; j < 4; j++) box(foot, 'dark', [0, -.07 + j * .045, -.03], [.172, .01, .008], [0, 0, 0], true);
    const toes = [-1, 0, 1].map((k, t) => [0, 1].map(j => {
      const n = part(`${id}.toe-${t + 1}${'ab'[j]}`, `${label} · toe ${t + 1} ${j ? 'claw phalanx' : 'proximal phalanx'}`, 'Grasping toes', 'Curl the claws during swing and on the raised paws.', 'Each phalanx is a rigid link in a two-joint chain that rotates by the sampled curl.', undefined, [limb.side * .36 + k * .04, -.08 - j * .02, -.04], 'Titanium / dark claws');
      const len = L.toe[j];
      rod(n, 'titanium', [0, 0, 0], [0, len, 0], .016 - j * .003);
      add(n, 'sphere', 'dark', [0, 0, 0], [.02, .02, .02]);
      box(n, 'teal', [0, len * .5, .014], [.026, len * .7, .01], [0, 0, 0], true);
      if (j) add(n, 'cone', 'dark', [0, len + .025, -.008], [.014, .065, .014], [-.5, 0, 0]);
      return n;
    }));
    const hip = part(`${id}.hip`, `${label} · ${limb.hind ? 'hip' : 'shoulder'} cartridge`, 'Digitigrade legs', 'House the root bearing that lets the leg plane follow its foot.', 'A bearing cartridge is located on the body frame at the root of the leg chain.', undefined, [limb.side * .12, .03, 0], 'Dark alloy / bronze');
    add(hip, 'cylinder', 'dark', [0, 0, 0], [.06, .1, .06], [0, 0, Math.PI / 2]);
    add(hip, 'ring', 'brass', [limb.side * .055, 0, 0], [.06, .06, .06], [0, Math.PI / 2, 0]);
    return { limb, upper, lower, meta, foot, toes, hip, act: actuator(`${id}.ram`, label), knee: actuator(`${id}.knee-ram`, `${label} knee`, .15) };
  });

  // ------------------------------------------------------------------ two folding membrane wings
  const wings = [-1, 1].map(s => {
    const id = `wing.${side(s)}`, label = `${sideName(s)} wing`, out = [-s * .45, .25, 0];
    const shoulder = part(`${id}.shoulder`, `${label} · dorsal shoulder gimbal`, 'Folding wings', 'Carry flap elevation, sweep and twist into the wing plane.', 'A gimbal bracket on the chest frame locates the humerus root.', undefined, vmul(out, .4), 'Dark alloy / bronze');
    add(shoulder, 'sphere', 'dark', [0, 0, 0], [.06, .06, .06]);
    add(shoulder, 'ring', 'brass', [0, 0, 0], [.07, .07, .07], [Math.PI / 2, 0, 0]);
    add(shoulder, 'ring', 'brass', [0, 0, 0], [.065, .065, .065], [0, Math.PI / 2, 0]);
    const humerus = part(`${id}.humerus`, `${label} · 620 mm humerus`, 'Folding wings', 'Swing from folded-back to forward-spread.', 'Its in-plane heading and the plane elevation are sampled; length never scales.', undefined, vmul(out, .7));
    limbMember(humerus, D.wing.humerus, .038);
    const forearm = part(`${id}.forearm`, `${label} · 720 mm forearm`, 'Folding wings', 'Fold forward along the humerus, then extend outward.', 'Elbow and wrist fold more on each upstroke to reduce the swept area.', undefined, vmul(out, 1));
    limbMember(forearm, D.wing.forearm, .031, 'shell');
    const spars = D.wing.spars.map((len, j) => {
      const n = part(`${id}.spar-${j + 1}`, `${label} · finger spar ${j + 1}`, 'Folding wings', 'Fan from the wrist to tension the membrane.', `A ${Math.round(len * 1000)} mm tapered spar pivots at the wrist by its own sampled heading.`, undefined, vmul(out, 1.3 + j * .15), 'Titanium / bronze knuckles');
      const r = .022 - j * .002;
      for (let k = 0; k < 3; k++) {
        rod(n, k === 1 ? 'dark' : 'titanium', [0, len * k / 3, 0], [0, len * (k + 1) / 3, 0], r * (1 - k * .22));
        add(n, 'cylinder', 'brass', [0, len * k / 3, 0], [r * 1.35, .03, r * 1.35], [0, 0, 0], k > 0);
      }
      add(n, 'cone', 'titanium', [0, len + .03, 0], [r * .8, .07, r * .8]);
      return n;
    });
    const thumb = part(`${id}.thumb`, `${label} · wrist thumb claw`, 'Folding wings', 'Give the folded wing a forward hook for climbing.', 'A short claw is fixed in the wrist frame and points ahead of the forearm.', undefined, vmul(out, 1.1), 'Titanium / dark claw');
    rod(thumb, 'titanium', [0, 0, 0], [0, D.wing.thumb, 0], .016);
    add(thumb, 'cone', 'dark', [0, D.wing.thumb + .03, 0], [.016, .07, .016]);
    const membranes = [0, 1, 2, 3].map(j => {
      const n = part(`${id}.membrane-${j + 1}`, `${label} · ${j < 3 ? `membrane panel ${j + 1}–${j + 2}` : 'inner membrane'}`, 'Wing membrane', 'Close the gap between spars with a battened sheet.', 'Nine flat battens are re-spanned every frame between equal fractions of the two bounding edges.', undefined, vmul(out, 1.15 + j * .1), 'Shell membrane / copper edge');
      const slats = Array.from({ length: D.slats }, (_, i) => { const c = child(n, `slat-${i}`); box(c, 'shell', [0, .5, 0], [1, 1, 1]); return c; });
      const veins = Array.from({ length: D.slats }, (_, i) => { const c = child(n, `vein-${i}`); add(c, 'cylinder', 'dark', [0, .5, 0], [1, 1, 1], [0, 0, 0], true); return c; });
      const edge = child(n, 'edge'); add(edge, 'cylinder', 'copper', [0, .5, 0], [1, 1, 1]);
      return { slats, veins, edge };
    });
    return { shoulder, humerus, forearm, spars, thumb, membranes, act: actuator(`${id}.ram`, label, .15), elbow: actuator(`${id}.elbow-ram`, `${label} elbow`, .15) };
  });

  // Restore every bind transform before posing so explosion and modes never accumulate drift.
  const bind = [];
  kit.group.traverse(node => { if (node.userData.partId) bind.push({ node, position: node.position.clone(), rotation: node.quaternion.clone(), scale: node.scale.clone() }); });
  function update(state = current, options = {}) {
    if (disposed) return;
    for (const b of bind) { b.node.position.copy(b.position); b.node.quaternion.copy(b.rotation); b.node.scale.copy(b.scale); }
    current = state?.legs ? state : current;
    const c = current;
    place(pelvis, c.pelvis, c.body);
    gearbox.forEach((g, i) => { g.rotation.y = (i % 2 ? -1 : 1) * c.rates.gearbox + i * .2; });
    c.torso.forEach((s, i) => place(torso[i], s.start, s.frame));
    ribs.forEach(pair => pair.forEach((r, j) => { r.rotation.y = -(j ? 1 : -1) * c.rates.ribs; }));
    fins.forEach((f, i) => { f.rotation.x = Math.PI - .25 - c.crest * (Math.PI / 2 - .25 + .05 * Math.sin(i)); });
    place(chest, c.chest, c.chestFrame);
    gyroOuter.rotation.x = c.rates.gyro[0]; gyroMiddle.rotation.y = c.rates.gyro[1]; gyroCore.rotation.z = c.rates.gyro[2];
    c.neck.forEach((s, i) => place(neck[i], s.start, s.frame));
    c.tendons.forEach((t, i) => stretch(neckCables[i], t.a, t.b, .011));
    place(skull, c.head.origin, c.head.frame);
    jaw.rotation.x = -c.head.jaw;
    frills.forEach((f, i) => { const s = i ? 1 : -1; f.rotation.set(.15 * c.head.frill, 0, s * c.head.frill * 1.05); });
    c.tail.forEach((s, i) => place(tail[i], s.start, s.frame));
    const last = c.tail.at(-1); place(blade, last.end, last.frame);
    [-1, 1].forEach((s, i) => {
      const a = vadd(c.pelvis, [s * .09, .1, .2]), b = vadd(c.tail[5].start, [s * .045, .02, 0]);
      stretch(tailCables[i], a, b, .009);
    });
    legs.forEach((n, i) => {
      const l = c.legs[i];
      place(n.upper, l.root, l.frames.upper); place(n.lower, l.knee, l.frames.lower); place(n.meta, l.ankle, l.frames.meta);
      place(n.foot, l.foot, l.frames.foot); place(n.hip, l.root, l.hind ? c.body : c.chestFrame);
      n.toes.forEach((t, k) => t.forEach((p, j) => place(p, l.toes[k][j].start, l.toes[k][j].frame)));
      poseActuator(n.act, l.actuator.a, l.actuator.b); poseActuator(n.knee, l.kneeActuator.a, l.kneeActuator.b);
    });
    wings.forEach((n, i) => {
      const w = c.wings[i];
      place(n.shoulder, w.root, c.chestFrame); place(n.humerus, w.root, w.frames.humerus); place(n.forearm, w.elbow, w.frames.forearm);
      n.spars.forEach((sp, j) => place(sp, w.wrist, w.frames.spars[j])); place(n.thumb, w.wrist, w.frames.thumb);
      n.membranes.forEach((m, j) => {
        w.panels[j].forEach((sl, k) => {
          stretchFramed(m.slats[k], sl.a, sl.frame, sl.length, sl.width, .007);
          stretchFramed(m.veins[k], sl.a, sl.frame, sl.length, .0045, .0045);
        });
        const [ea, eb] = j < 3 ? [w.tips[j], w.tips[j + 1]] : [w.anchor, w.tips[3]];
        stretch(m.edge, ea, eb, .007);
      });
      poseActuator(n.act, w.actuator.a, w.actuator.b); poseActuator(n.elbow, w.elbowActuator.a, w.elbowActuator.b);
    });
    kit.sync(options);
  }
  // The choreography changes the silhouette radically, so the camera frames sampled vertices of the whole cycle.
  // Points are deduplicated on a 0.12 m lattice to keep camera fitting cheap.
  const framePoints = [], seen = new Set(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const corners = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];
  for (const [input, count] of [[undefined, 24], [{ height: .98, ferocity: 1 }, 12], [{ height: .84, ferocity: 0 }, 12]]) for (let i = 0; i < count; i++) {
    update(sample(i / count / .05, { tempo: .05, ...input }));
    for (const mesh of kit.pickables) {
      mesh.geometry.computeBoundingBox(); const g = mesh.geometry.boundingBox;
      for (let j = 0; j < mesh.count; j++) {
        mesh.getMatrixAt(j, m);
        for (const c of corners) {
          v.set(c[0] < 0 ? g.min.x : g.max.x, c[1] < 0 ? g.min.y : g.max.y, c[2] < 0 ? g.min.z : g.max.z).applyMatrix4(m);
          const key = `${Math.round(v.x / .12)},${Math.round(v.y / .12)},${Math.round(v.z / .12)}`;
          if (!seen.has(key)) { seen.add(key); framePoints.push(v.clone()); }
        }
      }
    }
  }
  update(sample(0));
  return { group: kit.group, update, framePoints, get pickables() { return disposed ? [] : kit.pickables; }, parts: kit.parts, stats: kit.stats,
    dispose() { if (!disposed) { disposed = true; kit.dispose(); kit.group.clear(); } } };
}
