import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('MAMMUT M4 · quadrupeds and articulated trunk');
  kit.assemblies.rotation.y = Math.PI;
  const nodes = [], legs = [], trunk = [], tail = [], ears = [];
  let disposed = false, lastState = sample(0);
  const add = kit.add, rod = kit.rod, aim = kit.aim;
  const part = (id, name, system, purpose, how, parent, explode = [0, .12, 0], material = 'Titanium, pale alloy shell and hydraulic seals') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const plate = (node, material, p, size, euler = [0, 0, 0], detail = false) => add(node, 'box', material, p, size, euler, detail);
  const bore = (node, material, p, radius, height, axis = 'y', detail = false) => {
    const euler = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'cylinder', material, p, [radius, height, radius], euler, detail);
  };
  const ringBoss = (node, p, radius, material = 'titanium', axis = 'z') => {
    const euler = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'ring', material, p, [radius, radius, radius], euler);
    add(node, 'bolt', 'dark', p, [radius * .38, radius * .34, radius * .38], euler, true);
  };

  // ------------------------------------------------------------------ body
  const body = part('body.chassis', 'Barrel chassis and spinal rail', 'Torso structure',
    'Carries four legs, the neck and the counterweighted tail.',
    'A machined belly block, three dorsal shell plates and two longitudinal rails form the load spine.', undefined, [0, 0, 0], 'Titanium, dark alloy and formed shell');
  plate(body, 'dark', [0, .08, 0], [.62, .24, 1.35]);
  for (const side of [-1, 1]) plate(body, 'shell', [side * .24, .22, 0], [.22, .16, 1.25]);
  plate(body, 'shell', [0, .31, -.12], [.5, .10, 1.0]);
  for (const x of [-.22, .22]) rod(body, 'titanium', [x, .30, .62], [x, .30, -.62], .018);
  for (let k = 0; k < 5; k++) plate(body, 'dark', [0, .32, -.45 + k * .22], [.48, .014, .045], [0, 0, 0], true);
  kit.fasteners(body, [[-.26, .30, -.5], [.26, .30, -.5], [-.26, .30, .5], [.26, .30, .5]], .012);

  const withers = part('body.withers', 'Shoulder hump and neck yoke', 'Torso structure',
    'Raises the shoulder line and gives the neck a visible socket.',
    'A domed pale shell, two longitudinal rails and a bolted collar sit over the front ribs.', body, [0, .06, -.02], 'Formed pale alloy shell and brass collar');
  add(withers, 'sphere', 'shell', [0, .34, -.40], [.38, .17, .32]);
  for (const side of [-1, 1]) rod(withers, 'titanium', [side * .28, .28, -.68], [side * .28, .28, -.12], .014);
  ringBoss(withers, [0, .46, -.55], .06, 'brass', 'z');
  kit.fasteners(withers, [[-.24, .40, -.48], [.24, .40, -.48]], .010);
  const haunch = part('body.haunch', 'Pelvic haunch and tail root', 'Torso structure',
    'Closes the rear of the barrel and carries the tail hinge.',
    'A rounded pale haunch, two hip rails and a visible tail bearing cap.', body, [0, .05, .02], 'Formed pale alloy shell and brass bearing');
  add(haunch, 'sphere', 'shell', [0, .26, .46], [.34, .16, .28]);
  for (const side of [-1, 1]) rod(haunch, 'titanium', [side * .24, .22, .20], [side * .24, .22, .72], .013);
  ringBoss(haunch, [0, .33, .73], .045, 'brass', 'x');
  for (const side of [-1, 1]) for (const front of [true, false]) {
    const id = `${front ? 'F' : 'R'}${side < 0 ? 'L' : 'R'}`;
    const mount = part(`leg.${id}.mount`, `${front ? 'Front' : 'Rear'} ${side < 0 ? 'left' : 'right'} leg mount`, 'Leg drive',
      'Transfers the leg reaction into the chassis rails.',
      'A bolted bearing block and two diagonal stays clamp the leg yoke to the belly frame.', body, [side * .06, .02, 0]);
    const z = front ? D.hipFront : D.hipRear;
    mount.position.set(side * D.hipX, D.hipY, z);
    ringBoss(mount, [0, 0, 0], .06, 'titanium', 'x');
    for (const dz of [-.07, .07]) rod(mount, 'dark', [side * .02, .02, dz], [side * -.08, .13, dz], .013);
    kit.fasteners(mount, [[side * .05, .14, -.05], [side * .05, .14, .05]], .009);
  }

  // ------------------------------------------------------------------ spine
  for (let i = 0; i < D.spineCount; i++) {
    const z = D.spineZ - i * D.spineLink;
    const vertebra = part(`spine.${i + 1}.frame`, `Thoracic vertebra ${i + 1} of eight`, 'Spine',
      `Keeps spinal pin ${i + 1} at the design ${Math.round(D.spineLink * 1000)} mm spacing.`,
      'A boxed body, two transverse processes and a brass pin form one rigid vertebra.', body, [0, .04, 0]);
    plate(vertebra, 'titanium', [0, D.spineY, z], [.16, .07, .11]);
    plate(vertebra, 'dark', [0, D.spineY + .05, z], [.10, .04, .08]);
    bore(vertebra, 'brass', [0, D.spineY, z], .018, .20, 'x');
    for (const side of [-1, 1]) rod(vertebra, 'dark', [side * .07, D.spineY, z], [side * .13, D.spineY + .04, z + .05], .012);
  }
  for (let i = 0; i < 4; i++) {
    const scute = part(`spine.${i + 1}.scute`, `Dorsal spinal scute ${i + 1}`, 'Spine armor',
      'Covers four vertebrae while leaving every hinge pin exposed.',
      'A shallow pale plate sits above the spine on two isolators and a visible fastener pair.', body, [0, .08, .02], 'Formed pale alloy shell');
    add(scute, 'sphere', 'shell', [0, D.spineY + .10, D.spineZ - .1 - i * .30], [.20, .045, .16]);
    kit.fasteners(scute, [[-.12, D.spineY + .12, D.spineZ - .1 - i * .30], [.12, D.spineY + .12, D.spineZ - .1 - i * .30]], .009);
  }
  for (const side of [-1, 1]) for (let r = 0; r < 8; r++) {
    const y = .02 + r * .045;
    const rib = part(`rib.${side < 0 ? 'L' : 'R'}.${r + 1}`, `${side < 0 ? 'Left' : 'Right'} rib ${r + 1} of eight`, 'Rib cage',
      `Closes thoracic ring ${r + 1} without a solid chest wall.`,
      'Two tapered rails and a sternal pad leave the core and belly block visible.', body, [side * .04, .02, 0]);
    const z = -.35 + r * .105;
    rod(rib, 'titanium', [side * .11, y + .22, z], [side * .28, y + .12, z - .05], .013);
    rod(rib, 'dark', [side * .28, y + .12, z - .05], [side * .30, y - .02, z - .09], .009);
    plate(rib, 'brass', [side * .30, y - .02, z - .09], [.03, .025, .03]);
    const guide = part(`rib.${side < 0 ? 'L' : 'R'}.${r + 1}.guide`, `${side < 0 ? 'Left' : 'Right'} rib guide ${r + 1}`, 'Rib cage',
      `Pads rib ${r + 1} where it passes the belly block.`,
      'A brass roller and rubber pad sit between the lower rail and the keel without closing the gap.', rib, [side * .02, .02, 0], 'Brass roller and rubber pad');
    add(guide, 'cylinder', 'brass', [side * .27, y - .04, z - .06], [.012, .035, .012], [0, 0, Math.PI / 2]);
    add(guide, 'box', 'rubber', [side * .26, y - .055, z - .06], [.02, .018, .03]);
  }

  // ------------------------------------------------------------------ legs
  for (const leg of lastState.legs) {
    const label = `${leg.front ? 'Front' : 'Rear'} ${leg.side < 0 ? 'left' : 'right'}`, id = leg.id;
    const hip = part(`leg.${id}.hip`, `${label} hip yoke`, 'Leg drive',
      'Locates the hip pitch axis on the chassis mount.',
      'A ring boss and two side cheeks wrap the first bearing without hiding the pin.', body, [leg.side * .06, .02, 0]);
    hip.position.fromArray(leg.hip);
    ringBoss(hip, [0, 0, 0], .052, 'brass', 'x');
    const femur = part(`leg.${id}.femur`, `${label} femur truss`, 'Leg drive',
      'Carries the knee through the planted half of the gait.',
      'Two rails, two end rings and three braces keep the 500 mm link rigid.', body, [leg.side * .06, 0, 0]);
    for (const x of [-.026, .026]) rod(femur, 'titanium', [x, 0, 0], [x, D.femur, 0], .014);
    ringBoss(femur, [0, 0, 0], .036, 'brass', 'x'); ringBoss(femur, [0, D.femur, 0], .034, 'titanium', 'x');
    for (const f of [.3, .55, .8]) rod(femur, 'dark', [-.036, D.femur * f, 0], [.036, D.femur * f, 0], .006, true);
    const hipArmor = part(`leg.${id}.hipArmor`, `${label} hip armor and service cap`, 'Leg drive',
      'Covers the hip bearing while leaving the pitch pin exposed.',
      'A pale shoulder cap on two isolators and a brass service plug sit over the hip cheeks.', hip, [leg.side * .03, .02, 0], 'Formed pale alloy shell and brass plug');
    add(hipArmor, 'sphere', 'shell', [0, .04, -.02], [.075, .055, .06]);
    add(hipArmor, 'cylinder', 'brass', [leg.side * .04, .02, -.04], [.012, .035, .012], [0, 0, Math.PI / 2]);
    const ram = part(`leg.${id}.ram`, `${label} femur hydraulic ram`, 'Leg drive',
      'Shows the linear actuator that assists the femur.',
      'A dark barrel and brass piston run alongside the upper truss inside its envelope.', femur, [leg.side * .02, .01, 0], 'Dark barrel and brass piston');
    add(ram, 'cylinder', 'dark', [.045, .22, .012], [.016, .10, .016]);
    rod(ram, 'brass', [.045, .27, .012], [.045, .38, .012], .006);
    const femurShell = part(`leg.${id}.femurShell`, `${label} femur fairing`, 'Leg drive',
      'Gives the upper leg a broad armored silhouette.',
      'A pale two-piece fairing on four isolators wraps the truss without hiding the end pins.', femur, [leg.side * .03, .02, 0], 'Formed pale alloy shell');
    add(femurShell, 'sphere', 'shell', [0, .24, 0], [.095, .20, .075]);
    plate(femurShell, 'shell', [leg.side * .03, .14, -.02], [.05, .20, .10], [0, 0, leg.side * .08]);
    kit.fasteners(femurShell, [[0, .34, .06], [0, .14, .06]], .006);
    const tibia = part(`leg.${id}.tibia`, `${label} tibia truss`, 'Leg drive',
      'Transfers the knee solution to the ankle pin.',
      'A second rigid 480 mm truss carries the ankle clevis and a service hose.', body, [leg.side * .06, 0, 0]);
    for (const x of [-.024, .024]) rod(tibia, 'titanium', [x, 0, 0], [x, D.tibia, 0], .013);
    ringBoss(tibia, [0, 0, 0], .034, 'brass', 'x'); ringBoss(tibia, [0, D.tibia, 0], .032, 'titanium', 'x');
    for (const f of [.3, .55, .8]) rod(tibia, 'dark', [-.034, D.tibia * f, 0], [.034, D.tibia * f, 0], .005, true);
    for (let k = 0; k < 3; k++) rod(tibia, 'copper', [.034, .10 + k * .13, .01], [.034, .22 + k * .13, .01], .0035, true);
    const tibiaShell = part(`leg.${id}.tibiaShell`, `${label} tibia fairing`, 'Leg drive',
      'Gives the lower leg a broad armored silhouette.',
      'A tapered pale fairing and a dark shin pad wrap the truss while leaving the ankle pin visible.', tibia, [leg.side * .03, .02, 0], 'Formed pale alloy shell and dark shin pad');
    add(tibiaShell, 'sphere', 'shell', [0, .20, 0], [.080, .18, .065]);
    plate(tibiaShell, 'dark', [0, .20, -.055], [.05, .17, .02]);
    kit.fasteners(tibiaShell, [[0, .30, .05]], .005);
    const knee = part(`leg.${id}.knee`, `${label} knee hinge`, 'Leg drive',
      'Defines the single knee pitch axis.',
      'A brass pin, two outboard retainers and a small pale guard clamp the joint.', body, [leg.side * .05, 0, 0]);
    ringBoss(knee, [0, 0, 0], .044, 'brass', 'x');
    add(knee, 'sphere', 'shell', [0, 0, -.045], [.045, .045, .018]);
    const metatarsus = part(`leg.${id}.metatarsus`, `${label} 140 mm foot link`, 'Foot support',
      'Holds the sole at a fixed offset from the ankle.',
      'A rigid pair of rails and two clevises preserve the ankle-to-sole distance.', body, [leg.side * .05, 0, 0]);
    for (const x of [-.012, .012]) rod(metatarsus, 'titanium', [x, 0, 0], [x, Math.hypot(...D.ankleLift), 0], .007);
    const foot = part(`leg.${id}.foot`, `${label} foot and sole`, 'Foot support',
      'Provides one level contact plate under the leg.',
      'A machined sole, rubber tread and three toe plates stay parallel to the floor.', body, [leg.side * .05, .02, 0], 'Titanium sole and rubber tread');
    plate(foot, 'dark', [0, -.025, -.035], [.20, .045, .25]);
    plate(foot, 'rubber', [0, -.05, -.045], [.19, .014, .24]);
    for (let k = 0; k < 3; k++) plate(foot, 'titanium', [-.06 + k * .06, -.012, -.16], [.045, .015, .09], [0, 0, 0], true);
    legs.push({ id, femur, tibia, metatarsus, knee, foot, hip });
  }

  // ------------------------------------------------------------------ head
  const head = part('head.carrier', 'Head gimbal and cranial carrier', 'Head structure',
    'Carries the skull, ears, tusks and the base of the trunk.',
    'A transverse gimbal ring and two side plates support the cranium above the neck socket.', body, [0, .06, -.1], 'Titanium and brass');
  head.position.fromArray(lastState.head.origin);
  ringBoss(head, [0, 0, 0], .05, 'brass', 'x');
  const cranium = part('head.cranium', 'Cranial shell and brow', 'Head structure',
    'Protects the sensor apertures and anchors the tusks.',
    'A rounded pale shell, a dark brow and a bolted cheek rail leave the underside open.', head, [0, .03, -.03], 'Formed pale alloy shell');
  add(cranium, 'sphere', 'shell', [0, .07, .01], [.175, .145, .205]);
  add(cranium, 'sphere', 'shell', [0, .17, -.04], [.13, .07, .13]);
  plate(cranium, 'dark', [0, .06, -.18], [.23, .09, .05]);
  plate(cranium, 'shell', [0, .15, -.16], [.18, .035, .12], [-.3, 0, 0]);
  for (const side of [-1, 1]) rod(cranium, 'titanium', [side * .12, .02, -.12], [side * .20, -.04, -.20], .016);
  for (const side of [-1, 1]) {
    const cheek = part(`head.cheek.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} cheek armor`, 'Head structure',
      'Adds a visible cheek plate around the tusk root.',
      'A pale plate, a dark pad and two fasteners cover the side of the jaw without hiding the eye.', head, [side * .07, .02, 0], 'Formed pale alloy shell and dark pad');
    plate(cheek, 'shell', [side * .17, -.02, -.08], [.05, .10, .14], [0, 0, side * .25]);
    plate(cheek, 'dark', [side * .19, -.05, -.14], [.02, .06, .07]);
    kit.fasteners(cheek, [[side * .17, .04, -.04], [side * .18, -.08, -.10]], .006);
  }
  kit.fasteners(cranium, [[-.10, .16, -.04], [.10, .16, -.04], [0, .20, .02]], .011);
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const optic = part(`head.optic.${id}`, `${label} eye and brow lamp`, 'Head optics',
      'Marks the forward visual reference beside the trunk base.',
      'A teal lens sits in a brass ring on a dark cheek pad; no vision processing is implied.', head, [side * .13, .06, 0], 'Dark pad, brass bezel and teal glass');
    add(optic, 'sphere', 'dark', [side * .14, .07, -.15], [.055, .05, .035]);
    add(optic, 'sphere', 'lens', [side * .145, .09, -.175], [.040, .040, .026]);
    ringBoss(optic, [side * .145, .09, -.17], .047, 'brass', 'z');
    const socket = part(`head.tuskSocket.${id}`, `${label} tusk socket`, 'Head structure',
      'Anchors the tusk to the cranium with a replaceable bushing.',
      'A brass ring, two cheek bolts and a dark elastomer pad clamp the first tusk segment.', head, [side * .10, .01, 0], 'Brass ring, dark pad and titanium bolts');
    ringBoss(socket, [side * .14, -.01, -.13], .043, 'brass', 'x');
    add(socket, 'cylinder', 'rubber', [side * .18, -.01, -.15], [.030, .018, .030], [0, 0, Math.PI / 2]);
    const tusk = part(`head.tusk.${id}`, `${label} curved tusk`, 'Head structure',
      'Shows a rigid, tapered tusk anchored to the cranium.',
      'Eight tapered pale segments curve forward and up to a polished brass tip, clear of the trunk.', head, [side * .15, -.03, -.08], 'Pale alloy and brass');
    let a = [side * .14, -.01, -.14];
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const b = [side * (.14 + .10 * t - .07 * t * t), -.02 - .20 * Math.sin(t * 2.0) + .08 * t * t, -.14 - .82 * t];
      rod(tusk, k < 6 ? 'shell' : 'brass', a, b, .042 - k * .0030);
      a = b;
    }
    add(tusk, 'sphere', 'brass', a, [.012, .012, .012]);
    const ear = part(`head.ear.${id}`, `${label} ear lattice`, 'Head structure',
      'Exposes a large ear surface without an opaque slab.',
      'Five curved rails and three cross braces form a fan that turns on the ear pivot.', head, [side * .16, .04, .02], 'Titanium rails and pale edge plates');
    ear.position.set(side * .15, .09, -.01);
    for (let k = 0; k < 5; k++) rod(ear, 'titanium', [0, 0, 0], [side * (.32 + k * .035), .05 + k * .055, .04 + k * .055], .011);
    for (let k = 0; k < 3; k++) rod(ear, 'dark', [side * (.16 + k * .03), .02, .02], [side * (.30 + k * .04), .12 + k * .04, .18], .005, true);
    for (let k = 0; k < 3; k++) plate(ear, 'shell', [side * (.16 + k * .045), .07 + k * .045, .04 + k * .035], [.23 - k * .03, .065, .012], [0, side * .18, side * (.42 + k * .14)]);
    for (const y of [.07, .18, .29]) rod(ear, 'brass', [0, 0, 0], [side * (.30 + y * .2), y, .05 + y * .5], .006);
    rod(ear, 'brass', [0, 0, 0], [side * .34, .18, .26], .008);
    ears.push({ node: ear, side });
  }
  const jaw = part('head.jaw', 'Lower mandible and molar block', 'Head structure',
    'Closes the mouth beneath the trunk socket.',
    'A broad dark jaw and a brass molar rail pivot on the same transverse pin as the cranium.', head, [0, .02, -.08], 'Dark alloy and brass');
  plate(jaw, 'dark', [0, -.13, -.16], [.22, .06, .20]);
  plate(jaw, 'brass', [0, -.10, -.20], [.16, .025, .10]);
  bore(jaw, 'titanium', [0, -.08, -.10], .012, .16, 'x');
  const trunkBase = part('trunk.base', 'Trunk socket and hydraulic collar', 'Trunk drive',
    'Anchors the fourteen-link trunk to the skull.',
    'A wide bearing collar, two side actuators and a brass pin ring hold the first trunk pin.', body, [0, .04, -.02], 'Titanium, brass and hydraulic seals');
  trunkBase.position.fromArray(D.trunkBase);
  ringBoss(trunkBase, [0, 0, 0], .075, 'titanium', 'x');
  add(trunkBase, 'cone', 'shell', [0, -.045, -.02], [.085, .11, .085], [Math.PI, 0, 0]);
  for (const side of [-1, 1]) bore(trunkBase, 'brass', [side * .085, -.01, .03], .016, .055, 'z');

  // ------------------------------------------------------------------ tail
  for (let i = 0; i < D.tailCount; i++) {
    const frame = part(`tail.${i + 1}.frame`, `Tail vertebra ${i + 1} of seven`, 'Tail',
      `Keeps tail pin ${i + 1} at the design ${Math.round(D.tailLink * 1000)} mm spacing.`,
      'A tapered ring pair and two rails form one rigid tail link with a visible hinge.', body, [0, .04, .02]);
    for (const z of [0, D.tailLink]) {
      const r = .075 - i * .007;
      ringBoss(frame, [0, z, 0], r, 'titanium', 'y');
    }
    for (const x of [-.025, .025]) rod(frame, 'dark', [x, 0, 0], [x, D.tailLink, 0], .006);
    const scute = part(`tail.${i + 1}.scute`, `Tail dorsal scute ${i + 1}`, 'Tail armor',
      'Covers one tail link without closing the pin gap.',
      'A short pale plate rides the frame on two isolators and follows every pitch command.', frame, [0, .02, 0], 'Formed pale alloy shell');
    add(scute, 'sphere', 'shell', [0, 0, D.tailLink * .5], [.055 - i * .004, .026, .085]);
    tail.push({ node: frame, index: i });
  }
  const tuft = part('tail.tuft', 'Tail tuft and final counterweight', 'Tail',
    'Terminates the seven-link tail with a visible counterweight.',
    'A bolted brass hub carries four separated dark bristle rods.', body, [0, .04, .02], 'Brass hub and dark bristles');
  tuft.position.fromArray(lastState.tail.points[D.tailCount]);
  ringBoss(tuft, [0, 0, 0], .035, 'brass', 'y');
  for (let k = 0; k < 4; k++) rod(tuft, 'dark', [0, 0, 0], [.05 * Math.cos(k * TAU / 4), -.10, .05 * Math.sin(k * TAU / 4)], .004);

  // ------------------------------------------------------------------ trunk
  for (let i = 0; i < D.trunkCount; i++) {
    const frame = part(`trunk.${i + 1}.frame`, `Trunk link ${i + 1} of fourteen`, 'Trunk drive',
      `Preserves trunk link ${i + 1} at exactly ${Math.round(D.trunkLink * 1000)} mm.`,
      'Paired rails, two brass pins and a central tendon guide form one rigid trunk link.', body, [0, .05, -.01]);
    for (const x of [-.016, .016]) rod(frame, 'titanium', [x, 0, 0], [x, D.trunkLink, 0], .007);
    bore(frame, 'brass', [0, 0, 0], .015, .06, 'x');
    bore(frame, 'titanium', [0, D.trunkLink, 0], .013, .055, 'x');
    rod(frame, 'copper', [0, .015, .018], [0, D.trunkLink - .012, .018], .003, true);
    const band = part(`trunk.${i + 1}.band`, `Trunk armored band ${i + 1}`, 'Trunk armor',
      'Gives the trunk a readable segmented skin without hiding the pins.',
      'A pale band and a dark underside sit on the frame and overlap the flexible joint.', frame, [0, .02, .02], 'Formed pale alloy shell and dark rubber');
    const r = .078 - i * .0028;
    add(band, 'ring', 'shell', [0, D.trunkLink * .5, 0], [r, r, r], [Math.PI / 2, 0, 0]);
    add(band, 'ring', 'rubber', [0, D.trunkLink * .5, 0], [r * .78, r * .78, r * .78], [Math.PI / 2, 0, 0], true);
    kit.fasteners(band, [[0, D.trunkLink * .5, r * .8], [r * .55, D.trunkLink * .5, r * .55]], .0045);
    trunk.push({ node: frame, index: i });
  }
  const tip = part('trunk.tip', 'Trunk tip and two grasp pads', 'Trunk drive',
    'Ends the articulated trunk with two opposed service pads.',
    'A brass hub and two rubber-tipped fingers stay rigid while the trunk links articulate.', body, [0, .04, 0], 'Brass hub and rubber pads');
  tip.position.fromArray(lastState.trunk.points[D.trunkCount]);
  ringBoss(tip, [0, 0, 0], .032, 'brass', 'x');
  for (const side of [-1, 1]) rod(tip, 'dark', [0, 0, 0], [side * .055, -.10, .02], .007);

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.legs && state?.trunk && state?.tail) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    body.position.fromArray(pose.body.offset);
    for (const [i, record] of legs.entries()) {
      const leg = pose.legs[i];
      aim(record.femur, leg.hip, leg.knee);
      aim(record.tibia, leg.knee, leg.ankle);
      aim(record.metatarsus, leg.ankle, leg.footLocal);
      record.knee.position.fromArray(leg.knee);
      record.foot.position.fromArray(leg.footLocal);
    }
    trunk.forEach((record, i) => { const link = pose.trunk.links[i]; aim(record.node, link.start, link.end); });
    tip.position.fromArray(pose.trunk.points[D.trunkCount]);
    tail.forEach((record, i) => { const link = pose.tail.links[i]; aim(record.node, link.start, link.end); });
    tuft.position.fromArray(pose.tail.points[D.tailCount]);
    head.position.fromArray(pose.head.origin);
    head.rotation.set(pose.head.pitch, pose.head.yaw, 0, 'YXZ');
    ears.forEach(({ node, side }) => { node.rotation.set(pose.ears.pitch, 0, -side * pose.ears.flare); });
    kit.sync(options);
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
