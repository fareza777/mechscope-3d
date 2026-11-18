import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, LIMBS, sample, distance, add as vadd, sub as vsub, mul as vmul } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('EQUUS H8 · mechanical dressage horse');
  const { add, rod, gear, fasteners, aim } = kit;
  const basis = new THREE.Matrix4();
  let current = sample(0), disposed = false;
  function part(id, name, system, purpose, how, parent, explode = [0, .12, 0], material = 'Teal alloy / pale shell') {
    return kit.part({ id: `horse.${id}`, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode);
  }
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
  const box = (n, m, p, s, e = [0, 0, 0], detail = false) => add(n, 'box', m, p, s, e, detail);
  const side = s => s < 0 ? 'L' : 'R', sideName = s => s < 0 ? 'Left' : 'Right';

  function actuator(id, name, length = .40) {
    const barrel = part(`${id}.barrel`, `${name} · hydraulic barrel`, 'Hydraulic actuators', 'Hold a fixed-length pressure sleeve between two bushed clevises.', 'The rigid barrel aims at the moving eye; only the exposed ram length changes.', undefined, [.06, .06, 0], 'Dark alloy / copper glands');
    add(barrel, 'cylinder', 'dark', [0, length / 2, 0], [.034, length, .034]);
    for (const y of [.014, length - .016]) add(barrel, 'cylinder', 'copper', [0, y, 0], [.040, .023, .040]);
    rod(barrel, 'rubber', [-.043, .02, 0], [-.043, length - .02, 0], .008, true);
    box(barrel, 'titanium', [.037, .02, 0], [.018, .036, .046]);
    const piston = part(`${id}.rod`, `${name} · polished ram`, 'Hydraulic actuators', 'Take up the sampled clevis-to-clevis distance.', 'A ram slides from inside the barrel; its scale equals the analytic exposed stroke.', undefined, [.1, .1, 0], 'Polished titanium');
    add(piston, 'cylinder', 'titanium', [0, .5, 0], [.014, 1, .014]);
    const clevis = part(`${id}.clevis`, `${name} · rod-end clevis`, 'Hydraulic actuators', 'Pass ram force into the limb through a bushed pin.', 'The eye remains centred on the computed mount in the moving member frame.', undefined, [.12, .06, 0], 'Titanium / bronze');
    add(clevis, 'sphere', 'brass', [0, 0, 0], [.027, .027, .027]);
    add(clevis, 'cylinder', 'dark', [0, 0, 0], [.014, .09, .014], [0, 0, Math.PI / 2]);
    return { barrel, piston, clevis, length };
  }
  function poseActuator(n, a, b) {
    const d = distance(a, b), start = n.length - .02;
    aim(n.barrel, a, b); aim(n.piston, vadd(a, vmul(vsub(b, a), start / d)), b); n.piston.scale.set(1, d - start, 1);
    n.clevis.position.fromArray(b); aim(n.clevis, b, vadd(b, vsub(b, a))); n.clevis.position.fromArray(b);
  }
  function limbMember(n, length, w, armour = 'teal', terminal = true) {
    box(n, 'dark', [0, length * .5, 0], [w * 1.5, length * .92, w * 1.1]);
    box(n, armour, [0, length * .52, w * .55], [w * 2.55, length * .80, w * .62]);
    box(n, 'shell', [0, length * .31, w * 1.10], [w * 2.05, length * .34, w * .30], [.06, 0, 0]);
    box(n, 'shell', [0, length * .78, w * 1.05], [w * 1.75, length * .22, w * .24], [-.08, 0, 0]);
    for (const sd of [-1, 1]) {
      box(n, 'teal', [sd * w * 1.30, length * .5, -.04], [w * .30, length * .60, w * 1.15], [0, 0, sd * .18]);
      rod(n, 'copper', [sd * w * 1.12, .06, -w * .85], [sd * w * 1.12, length - .06, -w * .85], w * .11, true);
    }
    box(n, 'brass', [0, length * .18, w * .52], [w * 2.6, .022, w * 1.05]);
    if (terminal) {
      add(n, 'cylinder', 'teal', [0, length, 0], [w * .92, w * 2.8, w * .92], [0, 0, Math.PI / 2]);
    }
    fasteners(n, [[w, length * .38, w * .95], [-w, length * .66, w * .95]], .008);
  }

  // ------------------------------------------------------------------ deep body
  const pelvis = part('pelvis', 'Pelvic girdle · hip gearbox', 'Axial skeleton', 'Anchor both hind legs, the tail root and the dorsal drive.', 'A wide teal girdle carries two hip cartridges, a three-gear transfer case and a deep shell haunch.', undefined, [0, .06, .26], 'Teal alloy / pale haunch shell');
  box(pelvis, 'dark', [0, 0, 0], [.52, .40, .32]);
  box(pelvis, 'teal', [0, .02, .10], [.48, .42, .12], [.10, 0, 0]);
  for (const sd of [-1, 1]) {
    box(pelvis, 'shell', [sd * .30, .03, .06], [.09, .34, .26], [0, 0, sd * .22]);
    box(pelvis, 'dark', [sd * .32, -.10, -.04], [.05, .24, .16], [0, 0, sd * .10]);
    add(pelvis, 'cylinder', 'dark', [sd * .29, -.03, -.02], [.085, .11, .085], [0, 0, Math.PI / 2]);
    add(pelvis, 'ring', 'brass', [sd * .35, -.03, -.02], [.09, .09, .09], [0, Math.PI / 2, 0]);
    rod(pelvis, 'titanium', [sd * .12, .10, .05], [sd * .29, -.03, -.02], .026);
    rod(pelvis, 'titanium', [sd * .12, -.10, .04], [sd * .29, -.03, -.02], .022);
  }
  box(pelvis, 'shell', [0, .04, .17], [.36, .34, .06], [-.18, 0, 0]);
  box(pelvis, 'teal', [0, -.16, .02], [.32, .30, .06]);
  fasteners(pelvis, [[-.15, .13, .13], [.15, .13, .13], [-.15, -.12, .13], [.15, -.12, .13]], .009);
  const gearbox = [0, 1, 2].map(i => {
    const g = part(`pelvis.gear-${i + 1}`, `Hip transfer gear ${i + 1}`, 'Dorsal drive', 'Show the gait timing that couples the hip drives to the master phase.', 'Meshed spur wheels turn once per stride in alternating directions above the girdle.', pelvis, [0, 0, .14], 'Bronze / titanium');
    g.position.set((i - 1) * .12, .04, .235); g.rotation.x = Math.PI / 2; gear(g, .062, 16, .024); return g;
  });

  const torso = current.torso.map((s, i) => {
    const n = part(`torso.v${i + 1}`, `Dorsal vertebra ${i + 1}`, 'Axial skeleton', 'Carry the dressage posture and breathing expansion between pelvis and chest.', 'A rigid 220 mm centrum is wrapped by the deep teal barrel and pale shell flanks.', undefined, [0, .10 + i * .02, 0], 'Dark alloy / teal barrel / shell armour');
    add(n, 'cylinder', 'dark', [0, s.length * .5, 0], [.15, s.length * .94, .15]);
    add(n, 'ring', 'brass', [0, s.length * .07, 0], [.17, .17, .23], [Math.PI / 2, 0, 0]);
    for (let j = 0; j < 3; j++) rod(n, 'copper', [.08, .02 + j * .02, -.19], [.08, s.length - .02, -.19], .006, true);
    return n;
  });
  const barrel = part('barrel', 'Deep oval barrel housing', 'Barrel armour', 'Give the horse a broad, solid body around the open mechanism.', 'A large teal ellipsoid, pale shell flanks, a dark belly strip and a saddle bed wrap the five dorsal vertebrae; the ribs remain visible in X-ray and explode.', torso[2], [0, .05, .12], 'Teal alloy / pale shell panels');
  barrel.position.set(0, .12, 0);
  add(barrel, 'sphere', 'teal', [0, 0, 0], [.37, .59, .32]);
  for (const sd of [-1, 1]) {
    box(barrel, 'shell', [sd * .21, -.02, .14], [.22, .98, .18], [0, 0, sd * .22]);
    box(barrel, 'shell', [sd * .255, .0, -.14], [.16, .88, .20], [0, 0, sd * .42]);
    box(barrel, 'dark', [sd * .31, .0, .02], [.035, .66, .16], [0, 0, 0], true);
    rod(barrel, 'copper', [sd * .31, -.30, .08], [sd * .31, .30, .08], .010);
    fasteners(barrel, [[sd * .34, -.18, .10], [sd * .34, .20, .10]], .010);
  }
  box(barrel, 'dark', [0, 0, -.305], [.42, .96, .035]);
  box(barrel, 'teal', [0, 0, -.284], [.20, .80, .022]);
  box(barrel, 'shell', [0, 0, .315], [.30, .90, .045], [-.08, 0, 0]);
  box(barrel, 'brass', [0, 0, .34], [.14, .88, .018]);
  const ribs = torso.map((v, i) => [-1, 1].map(sd => {
    const r = part(`torso.rib-${side(sd)}${i + 1}`, `${sideName(sd)} breathing rib ${i + 1}`, 'Ribcage', 'Expand the deep flank as the horse breathes.', 'A thick curved rib on a longitudinal hinge swings outward with the sampled breath angle.', v, [sd * .15, 0, 0], 'Titanium / shell scales');
    r.position.set(sd * .07, current.torso[i].length / 2, 0);
    const pts = [[0, 0, 0], [sd * .21, 0, -.10], [sd * .26, 0, -.30], [sd * .13, 0, -.44]];
    for (let j = 0; j < 3; j++) rod(r, 'titanium', pts[j], pts[j + 1], .018);
    for (let j = 0; j < 2; j++) box(r, 'shell', vmul(vadd(pts[j + 1], pts[j + 2]), .5), [.040, .17, .18], [0, 0, sd * (j ? -.45 : .2)]);
    box(r, 'teal', vmul(vadd(pts[0], pts[1]), .5), [.06, .12, .06], [0, 0, sd * .4]);
    add(r, 'sphere', 'brass', pts[3], [.018, .018, .018], [0, 0, 0], true);
    return r;
  }));
  const saddle = part('saddle', 'Deep dressage saddle and blanket', 'Saddle and tack', 'Gives the mechanical horse a readable ridden silhouette.', 'A dark seat, shell flaps, two brass stirrup irons and a girth band sit on the broad barrel.', torso[2], [0, .12, .04], 'Shell leather / dark pad / brass irons');
  saddle.position.set(0, current.torso[2].length * .5, .39);
  box(saddle, 'dark', [0, .01, .02], [.42, .38, .06]);
  box(saddle, 'teal', [0, .04, .065], [.36, .32, .065], [.08, 0, 0]);
  box(saddle, 'shell', [0, .01, .11], [.28, .24, .04]);
  box(saddle, 'teal', [0, .07, -.02], [.20, .20, .085], [.25, 0, 0]);
  for (const sd of [-1, 1]) {
    box(saddle, 'dark', [sd * .20, .00, -.03], [.05, .26, .20], [0, 0, sd * .18]);
    box(saddle, 'shell', [sd * .19, -.02, -.03], [.028, .20, .16], [0, 0, sd * .20]);
    add(saddle, 'ring', 'brass', [sd * .22, -.10, -.03], [.038, .038, .038], [0, 0, Math.PI / 2]);
    rod(saddle, 'dark', [sd * .22, -.10, -.03], [sd * .23, -.26, -.03], .008);
    add(saddle, 'ring', 'brass', [sd * .23, -.29, -.03], [.052, .052, .052], [0, 0, Math.PI / 2]);
    box(saddle, 'brass', [sd * .23, -.34, -.03], [.085, .085, .024], [0, 0, 0], true);
  }
  box(saddle, 'dark', [0, .02, -.20], [.08, .34, .06], [.2, 0, 0]);
  const girth = part('saddle.girth', 'Girth band and buckle', 'Saddle and tack', 'Hold the saddle against the deep teal barrel.', 'A teal band circles the barrel and meets a brass buckle below the flank; it is cosmetic, not a functional strap.', torso[2], [0, .10, .04], 'Teal webbing / brass buckle');
  girth.position.set(0, current.torso[2].length * .5, 0);
  add(girth, 'ring', 'dark', [0, 0, 0], [.385, .385, .335], [Math.PI / 2, 0, 0]);
  for (const sd of [-1, 1]) {
    box(girth, 'brass', [sd * .35, 0, -.03], [.05, .05, .05]);
    add(girth, 'ring', 'brass', [sd * .37, 0, -.03], [.028, .028, .028], [0, 0, Math.PI / 2]);
  }

  const chest = part('chest', 'Pectoral keel · shoulder girdle', 'Axial skeleton', 'Join the fore legs and neck into one deep load frame.', 'A broad teal core, shell breastplate and open heart-flywheel window carry the forehand.', undefined, [0, .08, -.26], 'Teal alloy / pale shell');
  box(chest, 'dark', [0, 0, 0], [.50, .34, .32]);
  for (const s of [-1, 1]) {
    add(chest, 'cylinder', 'dark', [s * .27, -.02, -.02], [.085, .12, .085], [0, 0, Math.PI / 2]);
    add(chest, 'ring', 'brass', [s * .34, -.02, -.02], [.09, .09, .09], [0, Math.PI / 2, 0]);
    box(chest, 'shell', [s * .26, .04, .10], [.08, .30, .24], [0, 0, s * .3]);
    box(chest, 'teal', [s * .33, -.03, -.08], [.055, .24, .16], [0, 0, s * .12]);
    fasteners(chest, [[s * .30, .10, .16], [s * .30, -.10, .16]], .008);
  }
  box(chest, 'shell', [0, .06, -.20], [.34, .26, .06], [.22, 0, 0]);
  box(chest, 'shell', [0, .13, .05], [.40, .24, .05], [-.12, 0, 0]);
  rod(chest, 'titanium', [-.34, -.02, -.06], [.34, -.02, -.06], .032);
  rod(chest, 'dark', [0, .10, .10], [0, -.10, .06], .035);
  const heartOuter = part('chest.heart-outer', 'Heart flywheel · outer gimbal', 'Heart flywheel', 'Expose the stabilising flywheel through the open chest.', 'Three nested rings spin at three integer rates; no angular momentum is solved.', chest, [-.24, 0, 0], 'Brass / titanium');
  add(heartOuter, 'ring', 'brass', [0, 0, 0], [.145, .145, .145]);
  for (const s of [-1, 1]) add(heartOuter, 'cylinder', 'titanium', [s * .155, 0, 0], [.014, .045, .014], [0, 0, Math.PI / 2]);
  const heartMiddle = part('chest.heart-middle', 'Heart flywheel · inner gimbal', 'Heart flywheel', 'Carry the glowing rotor on a second axis.', 'A smaller ring rotates about the outer gimbal journal.', heartOuter, [0, .26, 0], 'Teal / titanium');
  add(heartMiddle, 'ring', 'teal', [0, 0, 0], [.11, .11, .11], [Math.PI / 2, 0, 0]);
  const heartCore = part('chest.heart-core', 'Heart rotor · glowing core', 'Heart flywheel', 'Give the open chest a warm mechanical centre.', 'A lens core between copper discs spins on the inner axis.', heartMiddle, [0, 0, .26], 'Optical glass / copper');
  add(heartCore, 'sphere', 'lens', [0, 0, 0], [.055, .055, .055]);
  for (const s of [-1, 1]) add(heartCore, 'cylinder', 'copper', [0, s * .045, 0], [.085, .014, .085]);
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; box(heartCore, 'brass', [.08 * Math.cos(a), 0, .08 * Math.sin(a)], [.032, .022, .014], [0, -a, 0], true); }

  // ------------------------------------------------------------------ continuous thick neck, crest and mane
  const neck = current.neck.map((s, i) => {
    const n = part(`neck.c${i + 1}`, `Cervical vertebra ${i + 1}`, 'Arched neck', 'Form the collected arch and raised rear posture.', 'A thick teal neck cartridge joins a shell crest plate; the eight links blend collected and arched tables.', undefined, [0, .10 + i * .015, -.05 - i * .02], 'Teal alloy / pale crest shell');
    add(n, 'cylinder', 'dark', [0, s.length * .5, 0], [.12, s.length * .94, .12]);
    add(n, 'sphere', 'teal', [0, s.length * .5, 0], [.205 - i * .004, s.length * .72, .195 - i * .004]);
    for (const sd of [-1, 1]) {
      box(n, 'teal', [sd * .15, s.length * .5, .02], [.035, s.length * .84, .14], [0, 0, sd * .20]);
      rod(n, 'copper', [sd * .14, .02, -.14], [sd * .14, s.length - .02, -.14], .007, true);
    }
    box(n, 'dark', [0, s.length * .5, -.18], [.16, s.length * .82, .035]);
    box(n, 'teal', [0, s.length * .5, .18], [.14, s.length * .70, .04], [-.3, 0, 0]);
    box(n, 'dark', [0, s.length * .5, .205], [.075, s.length * 1.15, .05], [-.2, 0, 0]);
    return n;
  });
  const mane = neck.map((n, i) => {
    const m = part(`neck.mane-${i + 1}`, `Crest mane plate ${i + 1}`, 'Mane and crest', 'Carry a thick flowing mane along the arched crest.', 'A broad dark shell plate with a copper edge hinges on the crest and sways with a phase lag.', n, [0, .14, .06], 'Dark shell / copper edge');
    m.position.set(0, .07, .205);
    for (const sd of [-1, 1]) box(m, 'teal', [sd * .045, .10, .0], [.045, .26, .22], [0, 0, sd * .18]);
    box(m, 'dark', [0, .13, .025], [.07, .30, .10]);
    box(m, 'teal', [0, .14, .08], [.035, .25, .05]);
    rod(m, 'copper', [0, .01, -.09], [0, .30, -.04], .010, true);
    add(m, 'sphere', 'brass', [0, .30, -.04], [.018, .018, .018], [0, 0, 0], true);
    return m;
  });
  const collar = part('neck.collar', 'Deep neck collar and chest seam', 'Arched neck', 'Bridge the thick neck into the chest with a load collar.', 'A split shell collar and teal band wrap the first cervical link.', chest, [0, .12, .06], 'Pale shell / teal band');
  collar.position.set(0, .13, -.04);
  add(collar, 'ring', 'shell', [0, 0, 0], [.24, .24, .21], [Math.PI / 2, 0, 0]);
  for (const sd of [-1, 1]) box(collar, 'teal', [sd * .21, -.04, .02], [.06, .24, .16], [0, 0, sd * .25]);
  const neckTendons = part('neck.tendons', 'Paired neck lift tendons', 'Arched neck', 'Visualise the cable path that holds the head high.', 'Two copper cables run from the chest bracket to the fifth cervical link and follow its frame.', undefined, [0, .18, 0], 'Copper cable');
  const neckCables = [-1, 1].map(sd => { const c = child(neckTendons, `cable-${side(sd)}`); add(c, 'cylinder', 'copper', [0, .5, 0], [1, 1, 1]); return c; });

  // ------------------------------------------------------------------ horse head: wedge face, ears and bridle
  const skull = part('head.skull', 'Horse skull · long wedge face', 'Head', 'Carry the eyes, ears, nostrils, bridle and upper jaw.', 'A teal skull, a long dark muzzle and a shell blaze ride the eighth neck link with a sampled head pitch.', undefined, [0, .22, -.18], 'Teal alloy / dark muzzle / shell blaze');
  const head = child(skull, 'scaled-frame'); head.scale.setScalar(1.15);
  box(head, 'dark', [0, .06, 0], [.20, .24, .18]);
  box(head, 'teal', [0, .075, .05], [.20, .19, .14]);
  box(head, 'shell', [0, .09, .125], [.17, .16, .05], [.15, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const y = .17 + i * .075, w = .155 - i * .014;
    box(head, 'dark', [0, y, -.005 - i * .018], [w, .082, .105], [.03, 0, 0]);
    box(head, 'shell', [0, y + .012, .050 - i * .018], [w * .38, .058, .028], [-.05, 0, 0]);
    if (i > 1) for (const sd of [-1, 1]) box(head, 'teal', [sd * w * .52, y, -.012 - i * .018], [.018, .07, .06], [0, 0, sd * .08], true);
  }
  box(head, 'dark', [0, .55, -.09], [.11, .10, .085]);
  box(head, 'shell', [0, .56, -.025], [.09, .075, .035], [-.08, 0, 0]);
  for (const sd of [-1, 1]) {
    add(head, 'sphere', 'lens', [sd * .095, .13, .085], [.031, .028, .023]);
    add(head, 'ring', 'brass', [sd * .102, .13, .085], [.034, .034, .034], [0, Math.PI / 2, 0]);
    box(head, 'shell', [sd * .11, .095, .04], [.026, .20, .07], [0, 0, sd * .12]);
    add(head, 'sphere', 'lens', [sd * .033, .545, .005], [.012, .010, .010], [0, 0, 0], true);
    rod(head, 'dark', [sd * .10, .10, .06], [sd * .065, .34, .015], .007);
    add(head, 'ring', 'brass', [sd * .07, .34, .01], [.015, .015, .015], [0, Math.PI / 2, 0]);
  }
  add(head, 'sphere', 'lens', [0, .17, -.075], [.028, .038, .016]);
  add(head, 'ring', 'brass', [0, .17, -.08], [.036, .036, .036]);
  fasteners(head, [[.055, .03, .12], [-.055, .03, .12]], .006);
  const jaw = part('head.jaw', 'Hinged lower jaw · long chin', 'Head', 'Open for a soft nicker and close on the walking beat.', 'One transverse pin rotates a long dark mandible beneath the wedge face.', head, [0, 0, -.13], 'Dark alloy / shell chin');
  jaw.position.set(0, .06, -.075);
  add(jaw, 'cylinder', 'dark', [0, 0, 0], [.032, .24, .032], [0, 0, Math.PI / 2]);
  for (const sd of [-1, 1]) {
    box(jaw, 'teal', [sd * .065, .17, -.02], [.048, .24, .075], [0, 0, -sd * .03]);
    box(jaw, 'shell', [sd * .05, .30, -.035], [.055, .11, .06], [.05, 0, 0]);
  }
  box(jaw, 'dark', [0, .25, -.03], [.14, .15, .07]);
  box(jaw, 'shell', [0, .13, -.065], [.13, .13, .035]);
  add(jaw, 'sphere', 'lens', [0, .20, -.07], [.028, .040, .014]);
  const ears = [-1, 1].map(sd => {
    const e = part(`head.ear-${side(sd)}`, `${sideName(sd)} articulated ear`, 'Ears', 'Track the phase with a small independent ear flick.', 'A bushed hinge at the poll carries a tall shell cone and a copper inner cup.', skull, [sd * .12, .04, .10], 'Shell / copper / brass');
    e.position.set(sd * .07, .06, .15); e.scale.setScalar(1.35);
    add(e, 'cone', 'teal', [0, .16, .01], [.05, .22, .045], [-.18, 0, -sd * .12]);
    box(e, 'shell', [0, .09, .02], [.04, .10, .035], [-.1, 0, 0]);
    add(e, 'sphere', 'lens', [0, .06, -.02], [.025, .028, .016], [0, 0, 0], true);
    add(e, 'ring', 'brass', [0, .01, 0], [.030, .030, .030], [0, Math.PI / 2, 0]);
    box(e, 'teal', [0, .08, .025], [.055, .13, .04], [-.15, 0, 0]);
    return e;
  });
  const forelock = part('head.forelock', 'Dark forelock plate', 'Mane and crest', 'Finish the horse head between the ears.', 'A short teal and shell plate with copper strands falls forward from the poll.', skull, [0, .18, .08], 'Teal / shell / copper');
  box(forelock, 'dark', [0, .06, .0], [.11, .22, .055], [.2, 0, 0]);
  for (let i = 0; i < 3; i++) rod(forelock, 'copper', [0, .02, -.01], [(i - 1) * .04, .22, .03], .006, true);
  const bridle = part('head.bridle', 'Bridle · bit and cheek rings', 'Saddle and tack', 'Give the head readable tack without implying a living mouth.', 'Dark straps, a brass bit and two loose rein loops remain fixed to the skull frame.', skull, [0, .15, -.08], 'Dark strap / brass hardware');
  for (const sd of [-1, 1]) {
    rod(bridle, 'dark', [sd * .12, .10, .06], [sd * .08, .36, .02], .008);
    add(bridle, 'ring', 'brass', [sd * .08, .36, .01], [.016, .016, .016], [0, Math.PI / 2, 0]);
    rod(bridle, 'dark', [sd * .08, .36, .01], [sd * .13, .50, -.06], .006, true);
  }
  add(bridle, 'cylinder', 'brass', [0, .46, -.07], [.008, .18, .008], [0, 0, Math.PI / 2]);

  // ------------------------------------------------------------------ hanging tail and broad plume
  const tail = current.tail.map((s, i) => {
    const k = s.length / .16;
    const n = part(`tail.t${i + 1}`, `Caudal vertebra ${i + 1}`, 'Tail and plume', 'Counterbalance the raised forehand and carry the travelling swish.', 'Tapering rigid links carry a phase-lagged yaw wave; the base is thick and the plume is broad.', undefined, [0, .06 + i * .01, .05 + i * .03], 'Teal alloy / pale tail armour');
    add(n, 'cylinder', 'dark', [0, s.length * .5, 0], [.09 * k, s.length * .94, .09 * k]);
    add(n, 'sphere', 'teal', [0, s.length * .5, 0], [.18 * k, s.length * .78, .17 * k]);
    for (const sd of [-1, 1]) box(n, 'teal', [sd * .10 * k, s.length * .5, .02], [.055, s.length * .84, .15 * k], [0, 0, sd * .22]);
    box(n, 'dark', [0, s.length * .5, -.12 * k], [.13 * k, s.length * .8, .035]);
    box(n, 'shell', [0, s.length * .5, .12 * k], [.13 * k, s.length * .74, .035], [-.25, 0, 0]);
    return n;
  });
  const dock = part('tail.dock', 'Tail dock and root guard', 'Tail and plume', 'Cover the tail root without hiding its hinge.', 'A split shell cap and teal band wrap the first caudal link.', pelvis, [0, .08, .18], 'Pale shell / teal band');
  dock.position.set(0, .06, .20);
  add(dock, 'ring', 'shell', [0, 0, 0], [.18, .18, .15], [Math.PI / 2, 0, 0]);
  add(dock, 'ring', 'teal', [0, .04, 0], [.15, .15, .12], [Math.PI / 2, 0, 0]);
  const plume = [0, 1, 2, 3, 4, 5].map(i => {
    const p = part(`tail.plume-${i + 1}`, `Plume strand ${i + 1}`, 'Tail and plume', 'Give the tail a thick flowing mechanical hair volume.', 'A broad shell ribbon and copper core pivot together at the final caudal frame.', tail.at(-1), [0, .10, .30 + i * .01], 'Shell ribbon / copper core');
    p.position.set((i - 2.5) * .050, current.tail.at(-1).length, 0);
    box(p, 'dark', [0, .25, .0], [.12, .54, .040], [0, 0, (i - 2.5) * .055]);
    box(p, 'teal', [0, .20, .012], [.08, .40, .025], [0, 0, (i - 2.5) * .055]);
    box(p, 'teal', [0, .20, -.018], [.07, .38, .025], [0, 0, (i - 2.5) * .055]);
    rod(p, 'copper', [0, .02, -.018], [0, .56, -.018], .010);
    add(p, 'sphere', 'brass', [0, .48, -.015], [.022, .022, .022], [0, 0, 0], true);
    return p;
  });
  const tailTendons = part('tail.tendons', 'Paired tail lift tendons', 'Tail and plume', 'Show the cable path that raises the tail as a counterweight.', 'Two copper cables run from the pelvis to the fourth caudal link and follow it.', undefined, [0, .16, .1], 'Copper cable');
  const tailCables = [-1, 1].map(sd => { const c = child(tailTendons, `cable-${side(sd)}`); add(c, 'cylinder', 'copper', [0, .5, 0], [1, 1, 1]); return c; });

  // ------------------------------------------------------------------ thick legs and broad hooves
  const legs = LIMBS.map(limb => {
    const L = limb.hind ? D.hind : D.fore, label = `${sideName(limb.side)} ${limb.hind ? 'hind' : 'fore'} leg`, id = `leg.${limb.id}`;
    const w = limb.hind ? .125 : .115;
    const upper = part(`${id}.upper`, `${label} · ${Math.round(L.upper * 1000)} mm ${limb.hind ? 'femur' : 'humerus'}`, 'Four-legged gait', 'Reach the knee at the upper circle intersection.', 'A broad teal-and-shell thigh surrounds twin rails while the knee solves exactly.', undefined, [limb.side * .19, .02, 0], 'Teal armour / pale shell');
    limbMember(upper, L.upper, w);
    add(upper, 'sphere', 'teal', [0, L.upper * .36, 0], [w * 1.55, L.upper * .30, w * 1.18]);
    box(upper, 'shell', [0, L.upper * .40, w * 1.15], [w * 2.0, L.upper * .40, w * .30], [.05, 0, 0]);
    add(upper, 'sphere', 'teal', [0, 0, 0], [w * 1.55, w * 1.55, w * 1.55]);
    const lower = part(`${id}.lower`, `${label} · ${Math.round(L.lower * 1000)} mm ${limb.hind ? 'tibia' : 'forearm'}`, 'Four-legged gait', 'Carry the fetlock to its prescribed heel pose.', 'The second rigid member closes the two-link triangle and wears a full shell guard.', undefined, [limb.side * .26, -.02, 0], 'Shell armour / teal core');
    limbMember(lower, L.lower, w * .86, 'shell');
    add(lower, 'sphere', 'teal', [0, L.lower * .40, 0], [w * 1.20, L.lower * .24, w * .92]);
    box(lower, 'shell', [0, L.lower * .40, w * 1.02], [w * 1.9, L.lower * .34, w * .28], [-.04, 0, 0]);
    const meta = part(`${id}.meta`, `${label} · ${Math.round(L.meta * 1000)} mm ${limb.hind ? 'metatarsus' : 'metacarpus'}`, 'Four-legged gait', 'Stand the horse on a stout cannon and broad hoof.', 'The cannon follows the sampled heel angle into a thick fetlock and a level hoof.', undefined, [limb.side * .31, -.04, 0], 'Teal alloy / shell guard');
    limbMember(meta, L.meta, w * .72, 'teal', false);
    box(meta, 'shell', [0, L.meta * .58, w * .66], [w * 2.2, L.meta * .60, w * .34]);
    add(meta, 'cylinder', 'teal', [0, L.meta, 0], [w * .76, w * 2.3, w * .76], [0, 0, Math.PI / 2]);
    add(meta, 'cylinder', 'brass', [0, L.meta, 0], [w * .30, w * 2.5, w * .30], [0, 0, Math.PI / 2]);
    const hoof = part(`${id}.hoof`, `${label} · broad service hoof`, 'Hooves', 'Meet the floor with a broad rubber sole and deep shell toe.', 'A level hoof frame carries a dark crown, pale shell wall, rubber sole and two brass side clips.', undefined, [limb.side * .35, -.06, 0], 'Rubber sole / shell toe / brass clips');
    box(hoof, 'rubber', [0, .015, -.0275], [w * 2.7, w * 2.3, .055]);
    box(hoof, 'dark', [0, .02, .03], [w * 2.45, w * 2.15, .09]);
    box(hoof, 'shell', [0, .06, .06], [w * 2.2, w * 1.5, .08], [.05, 0, 0]);
    for (const sd of [-1, 1]) box(hoof, 'dark', [sd * w * 1.24, .015, .03], [w * .30, w * 2.2, .13], [0, 0, sd * .03]);
    box(hoof, 'dark', [0, .03, .005], [w * 2.9, w * 2.4, .028]);
    for (const sd of [-1, 1]) box(hoof, 'brass', [sd * w * 1.15, .01, .015], [w * .22, w * 1.3, .075]);
    for (let j = 0; j < 4; j++) box(hoof, 'dark', [0, .015, -.052 + j * .012], [w * 2.5, w * 2.2, .004], [0, 0, 0], true);
    const kneeCover = part(`${id}.knee-cover`, `${label} · armoured knee / elbow cover`, 'Joint armour', 'Cover the exposed two-link joint without hiding its rotation.', 'A shell cap and teal cheek plate sit on the upper member and wrap the joint pin.', undefined, [limb.side * .05, .05, 0], 'Pale shell / teal cheek');
    add(kneeCover, 'sphere', 'shell', [0, 0, 0], [w * 1.55, w * .95, w * 1.55]);
    box(kneeCover, 'teal', [0, 0, w * .92], [w * 1.9, .05, w * .72]);
    const fetlock = part(`${id}.fetlock-cover`, `${label} · fetlock guard`, 'Hooves', 'Guard the fetlock pin above the broad hoof.', 'A compact shell cup rides at the end of the cannon.', undefined, [limb.side * .06, .03, 0], 'Shell cup / teal trim');
    add(fetlock, 'sphere', 'shell', [0, 0, 0], [w * .9, w * .55, w * .9]);
    box(fetlock, 'teal', [0, 0, w * .74], [w * 1.5, .04, w * .5]);
    const hip = part(`${id}.hip`, `${label} · ${limb.hind ? 'hip' : 'shoulder'} cartridge`, 'Four-legged gait', 'House the root bearing that lets the leg plane follow its hoof.', 'A wide teal bearing cartridge and two shell cheeks are located at the root of the chain.', undefined, [limb.side * .12, .03, 0], 'Teal alloy / bronze');
    add(hip, 'cylinder', 'teal', [0, 0, 0], [.08, .14, .08], [0, 0, Math.PI / 2]);
    add(hip, 'ring', 'brass', [limb.side * .075, 0, 0], [.078, .078, .078], [0, Math.PI / 2, 0]);
    for (const sd of [-1, 1]) box(hip, 'shell', [0, 0, sd * .09], [.21, .26, .06], [0, 0, 0]);
    box(hip, 'teal', [0, 0, .012], [.23, .21, .075]);
    return { limb, upper, lower, meta, hoof, hip, kneeCover, fetlock, act: actuator(`${id}.ram`, label, .36), knee: actuator(`${id}.knee-ram`, `${label} knee`, .18) };
  });

  // ------------------------------------------------------------------ bind, pose and camera envelope
  const bind = [];
  kit.group.traverse(node => { if (node.userData.partId) bind.push({ node, position: node.position.clone(), rotation: node.quaternion.clone(), scale: node.scale.clone() }); });
  function update(state = current, options = {}) {
    if (disposed) return;
    for (const b of bind) { b.node.position.copy(b.position); b.node.quaternion.copy(b.rotation); b.node.scale.copy(b.scale); }
    const c = state?.legs ? state : current;
    current = c;
    place(pelvis, c.pelvis, c.body);
    gearbox.forEach((g, i) => { g.rotation.y = (i % 2 ? -1 : 1) * c.rates.gears + i * .2; });
    c.torso.forEach((s, i) => place(torso[i], s.start, s.frame));
    ribs.forEach(pair => pair.forEach((r, j) => { r.rotation.y = -(j ? 1 : -1) * c.rates.ribs; }));
    place(chest, c.chest, c.chestFrame);
    heartOuter.rotation.x = c.rates.flywheel[0]; heartMiddle.rotation.y = c.rates.flywheel[1]; heartCore.rotation.z = c.rates.flywheel[2];
    c.neck.forEach((s, i) => place(neck[i], s.start, s.frame));
    mane.forEach((m, i) => { m.rotation.z = .10 * Math.sin(c.rates.gears * .25 + i * .55) * (.4 + .6 * c.acts.walk); m.rotation.x = -.04 + .06 * Math.sin(c.rates.gears * .35 - i * .4); });
    c.tendons.forEach((t, i) => stretch(neckCables[i], t.a, t.b, .013));
    place(skull, c.head.origin, c.head.frame);
    jaw.rotation.x = -c.head.jaw;
    ears.forEach((e, i) => { const h = c.head.ears[i]; e.rotation.set(h.pitch, h.yaw, 0); });
    c.tail.forEach((s, i) => place(tail[i], s.start, s.frame));
    plume.forEach((p, i) => { p.rotation.z = .12 * Math.sin(c.rates.gears * .2 - i * .55) + .04 * Math.sin(i); p.rotation.x = .05 * Math.sin(c.rates.gears * .3 + i * .4); });
    [-1, 1].forEach((sd, i) => {
      const a = vadd(c.pelvis, [sd * .10, .10, .20]), b = vadd(c.tail[3].start, [sd * .05, .02, 0]);
      stretch(tailCables[i], a, b, .010);
    });
    legs.forEach((n, i) => {
      const l = c.legs[i];
      place(n.upper, l.root, l.frames.upper); place(n.lower, l.knee, l.frames.lower); place(n.meta, l.ankle, l.frames.meta);
      place(n.hoof, l.foot, l.frames.foot);
      place(n.kneeCover, l.knee, l.frames.upper); place(n.fetlock, l.fetlock, l.frames.meta);
      place(n.hip, l.root, l.hind ? c.body : c.chestFrame);
      poseActuator(n.act, l.actuator.a, l.actuator.b); poseActuator(n.knee, l.kneeActuator.a, l.kneeActuator.b);
    });
    kit.sync(options);
  }
  update(current);

  const framePoints = [], seen = new Set(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const corners = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];
  for (const [input, count] of [[undefined, 18], [{ stride: 1.3, head: 1 }, 10], [{ stride: .7, head: 0 }, 8]]) for (let i = 0; i < count; i++) {
    update(sample(i / count / .045, { tempo: .045, ...input }));
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
  return { group: kit.group, update, framePoints, parts: kit.parts, stats: kit.stats, views: { home: [2.6, 1.9, -5.3], side: [5.4, 1.5, -0.6], front: [0, 1.5, -5.8], detail: [-3.6, 2.0, -4.4], exploded: [3.4, 2.6, -5.0] },
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (!disposed) { disposed = true; kit.dispose(); kit.group.clear(); } } };
}
