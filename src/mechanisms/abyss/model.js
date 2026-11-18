import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('ABYSS S9 · pelagic shark and service gantry');
  kit.assemblies.rotation.y = Math.PI;
  const nodes = [], tailFrames = [], fins = [];
  let disposed = false, lastState = sample(0);
  const add = kit.add, rod = kit.rod, aim = kit.aim;
  const part = (id, name, system, purpose, how, parent, explode = [0, .12, 0], material = 'Titanium, pale alloy shell and hydraulic seals') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const plate = (node, material, p, size, euler = [0, 0, 0], detail = false) => add(node, 'box', material, p, size, euler, detail);
  const boss = (node, p, radius, material = 'titanium', axis = 'z') => {
    const euler = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'ring', material, p, [radius, radius, radius], euler);
    add(node, 'bolt', 'dark', p, [radius * .35, radius * .3, radius * .35], euler, true);
  };

  // ------------------------------------------------------------------ axial skeleton
  for (let i = 0; i < D.spineCount; i++) {
    const z = D.spineStart[2] + i * D.spineLink, y = D.spineStart[1];
    const vertebra = part(`spine.${i + 1}.frame`, `Cenotrapal vertebra ${i + 1} of ten`, 'Axial skeleton',
      `Keeps vertebral pin ${i + 1} in the ${Math.round(D.spineLink * 1000)} mm series.`,
      'Two vertebral rings, a boxed centrum, transverse processes and a dorsal spine form one pinned unit.', undefined, [0, .07, .02]);
    vertebra.position.set(0, y, z);
    boss(vertebra, [0, 0, 0], .095, 'titanium', 'z'); boss(vertebra, [0, 0, D.spineLink], .09, 'brass', 'z');
    plate(vertebra, 'dark', [0, 0, D.spineLink * .5], [.15, .13, .10]);
    for (const side of [-1, 1]) rod(vertebra, 'titanium', [side * .07, 0, D.spineLink * .5], [side * .19, 0, D.spineLink * .58], .012);
    plate(vertebra, 'shell', [0, .085, D.spineLink * .5], [.035, .075, .10], [0, 0, 0], false);
    for (const side of [-1, 1]) rod(vertebra, 'copper', [side * .045, -.04, .02], [side * .045, -.055, D.spineLink - .01], .0035, true);
    kit.fasteners(vertebra, [[-.07, .03, .03], [.07, .03, .03]], .007);
  }
  for (let i = 0; i < D.spineCount; i++) {
    const z = D.spineStart[2] + i * D.spineLink;
    const neural = part(`spine.${i + 1}.neural`, `Neural spine ${i + 1} of ten`, 'Axial skeleton',
      `Raises the dorsal line above vertebral pin ${i + 1}.`,
      'A tapered pale blade and two brass pins sit on the vertebra without covering the spinal gap.', undefined, [0, .07, 0], 'Formed pale alloy blade and brass pins');
    plate(neural, 'shell', [0, 1.32, z + .055], [.025, .16, .07], [-.18, 0, 0]);
    rod(neural, 'brass', [0, 1.26, z + .02], [0, 1.42, z + .06], .005);
    kit.fasteners(neural, [[-.045, 1.27, z + .04], [.045, 1.27, z + .04]], .006);
  }
  for (let i = 0; i < D.spineCount; i++) {
    const armor = part(`spine.${i + 1}.plate`, `Lateral vertebral plate ${i + 1}`, 'Axial armor',
      'Covers the lateral vertebral gap without enclosing the spine.',
      'A pale plate bridges two pins on four isolators and leaves both brass rings exposed.', undefined, [0, .05, .02], 'Formed pale alloy shell');
    const z = D.spineStart[2] + i * D.spineLink;
    for (const side of [-1, 1]) plate(armor, 'shell', [side * .13, 1.235, z + D.spineLink * .5], [.055, .16, .11], [0, 0, side * .12]);
    for (const side of [-1, 1]) kit.fasteners(armor, [[side * .16, 1.28, z + .02], [side * .16, 1.28, z + D.spineLink - .02]], .006);
  }
  for (const side of [-1, 1]) for (let r = 0; r < 6; r++) {
    const rib = part(`rib.${side < 0 ? 'L' : 'R'}.${r + 1}`, `${side < 0 ? 'Left' : 'Right'} costal rail ${r + 1} of six`, 'Rib cage',
      `Closes body station ${r + 1} with an open, readable arch.`,
      'Two tapered rails and a sternal pad tie the vertebra to the belly without a solid flank.', undefined, [side * .04, .03, .02]);
    const z = D.spineStart[2] + .28 + r * .12;
    rod(rib, 'titanium', [side * .14, 1.18, z], [side * .31, 1.04, z - .04], .011);
    rod(rib, 'dark', [side * .31, 1.04, z - .04], [side * .24, .96, z - .03], .008);
    plate(rib, 'brass', [side * .24, .96, z - .03], [.035, .022, .04]);
  }

  // ------------------------------------------------------------------ hull
  const hull = part('body.hull', 'Dorsal hull, belly fairing and pectoral girdle', 'Body structure',
    'Carries the gantry cradle, ten vertebrae and both pectoral fin roots.',
    'A pale dorsal shell, dark belly fairing and two lateral longerons bolt to a central keel.', undefined, [0, 0, 0], 'Formed pale alloy shell, dark fairing and titanium keel');
  add(hull, 'sphere', 'shell', [0, 1.27, -.05], [.235, .17, .70]);
  add(hull, 'sphere', 'dark', [0, 1.09, -.02], [.21, .12, .66]);
  for (let k = 0; k < 6; k++) {
    add(hull, 'sphere', 'shell', [0, 1.395, -.48 + k * .19], [.29, .026, .105]);
    add(hull, 'box', 'dark', [0, 1.405, -.57 + k * .19], [.22, .012, .018], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) {
    rod(hull, 'titanium', [side * .19, 1.22, -.62], [side * .19, 1.22, .66], .018);
    plate(hull, 'shell', [side * .225, 1.27, -.12], [.05, .10, .46], [0, 0, side * .18]);
    rod(hull, 'copper', [side * .18, 1.15, .30], [side * .18, 1.15, .60], .004, true);
  }
  plate(hull, 'titanium', [0, 1.23, -.45], [.33, .06, .10]);
  plate(hull, 'titanium', [0, 1.16, .50], [.30, .05, .08]);
  for (let k = 0; k < 6; k++) plate(hull, 'dark', [0, 1.43, -.35 + k * .16], [.16, .012, .035], [0, 0, 0], true);
  kit.fasteners(hull, [[-.20, 1.30, -.52], [.20, 1.30, -.52], [-.20, 1.30, .48], [.20, 1.30, .48]], .010);

  for (let k = 0; k < 6; k++) {
    const panel = part(`body.panel.${k + 1}`, `Dorsal armor panel ${k + 1} of six`, 'Body armor',
      `Closes body station ${k + 1} over the vertebral spine.`,
      'A pale panel on four isolators overlaps the next station and leaves a dark seam pin.', undefined, [0, .05, 0], 'Formed pale alloy shell');
    add(panel, 'sphere', 'shell', [0, 1.405, -.48 + k * .19], [.275, .035, .115]);
    kit.fasteners(panel, [[-.17, 1.42, -.48 + k * .19], [.17, 1.42, -.48 + k * .19]], .006);
  }
  const dorsal = part('fin.dorsal', 'Primary dorsal fin', 'Fins',
    'Adds the tall dorsal silhouette above the center of mass.',
    'Four swept rails, five cross braces and a pale leading edge form an open fin.', undefined, [0, .10, .02], 'Titanium rails and pale leading edge');
  for (let k = 0; k < 6; k++) rod(dorsal, 'titanium', [0, 1.36, -.36 + k * .07], [0, 1.90, .14 + k * .065], .011);
  for (let k = 0; k < 6; k++) rod(dorsal, 'dark', [0, 1.40 + k * .08, -.26 + k * .07], [0, 1.50 + k * .06, .10], .005, true);
  plate(dorsal, 'shell', [0, 1.66, -.04], [.032, .44, .10], [0, 0, -.24]);
  rod(dorsal, 'brass', [0, 1.36, -.40], [0, 1.90, .10], .006);

  // ------------------------------------------------------------------ pectoral fins
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const root = part(`fin.pectoral.${id}.root`, `${label} pectoral fin root`, 'Fins',
      'Carries the fin pitch axis outboard of the girdle.',
      'A bolted root housing, a brass pin and three tapered spars support the outboard blade.', undefined, [side * .08, .05, 0], 'Titanium housing, brass pin and pale spars');
    root.position.set(side * D.finRootX, D.finY, D.finZ);
    boss(root, [0, 0, 0], .055, 'brass', 'z');
    for (let k = 0; k < 3; k++) rod(root, 'titanium', [0, .01 - k * .015, -.02], [side * .13, .01 - k * .015, -.05 - k * .03], .009);
    kit.fasteners(root, [[side * .02, .07, .02], [side * .02, -.04, .02]], .008);
    const blade = part(`fin.pectoral.${id}.blade`, `${label} pectoral fin blade`, 'Fins',
      'Provides a readable open fin surface without a solid membrane.',
      'Three long spars and seven cross ribs fan outward and trail behind the pitch pivot.', root, [side * .10, .08, 0], 'Titanium spars and pale edge plates');
    for (let k = 0; k < 5; k++) rod(blade, 'titanium', [side * .10, 0, -.03 + k * .02], [side * (.92 + k * .03), .03 + k * .018, .22 + k * .05], .008);
    for (let k = 0; k < 9; k++) rod(blade, 'dark', [side * (.18 + k * .085), .01, .02 + k * .03], [side * (.18 + k * .085), .01, .27 + k * .03], .0045, true);
    plate(blade, 'shell', [side * .55, .025, .10], [.50, .016, .15], [0, side * .22, 0]);
    rod(blade, 'brass', [side * .14, .04, -.03], [side * .97, .06, .30], .006);
    fins.push({ root, side });
  }
  for (const side of [-1, 1]) {
    const pelvic = part(`fin.pelvic.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} pelvic fin`, 'Fins',
      'Marks the paired pelvic station behind the pectoral girdle.',
      'Two short spars and three ribs fold against the belly on a visible pin.', undefined, [side * .05, .03, 0]);
    for (let k = 0; k < 2; k++) rod(pelvic, 'titanium', [side * .12, .95, .55], [side * (.30 + k * .03), .86, .72 + k * .05], .007);
    for (let k = 0; k < 3; k++) rod(pelvic, 'dark', [side * (.17 + k * .045), .91, .60], [side * (.20 + k * .04), .87, .71], .004, true);
  }

  // ------------------------------------------------------------------ gills and lateral line
  for (const side of [-1, 1]) for (let g = 0; g < 5; g++) {
    const gill = part(`gill.${side < 0 ? 'L' : 'R'}.${g + 1}`, `${side < 0 ? 'Left' : 'Right'} gill slit ${g + 1} of five`, 'Ventilation',
      `Shows gill station ${g + 1} as a separate compliant flap.`,
      'A dark slit plate, two pale lips and a brass arch sit proud of the flank; no airflow is solved.', undefined, [side * .04, .02, 0]);
    const z = -.58 + g * .095;
    plate(gill, 'rubber', [side * .272, 1.14, z], [.012, .15, .030], [0, 0, side * .16]);
    for (const y of [1.07, 1.21]) rod(gill, 'shell', [side * .279, y, z], [side * .279, y + .025, z + .015], .006);
    rod(gill, 'brass', [side * .262, 1.08, z + .02], [side * .262, 1.20, z + .03], .0045, true);
  }
  for (let p = 0; p < 4; p++) {
    const port = part(`sense.port.${p + 1}`, `Lateral-line port ${p + 1} of four`, 'Sensory frame',
      'Provides one visible pressure-port station along the flank.',
      'A teal lens in a brass bezel sits on a dark pad at the lateral line.', undefined, [0, .02, 0], 'Brass bezel, dark pad and teal lens');
    const side = p % 2 ? 1 : -1, z = -.42 + Math.floor(p / 2) * .52;
    add(port, 'sphere', 'lens', [side * .282, 1.19, z], [.018, .018, .012]);
    boss(port, [side * .282, 1.19, z], .023, 'brass', 'x');
    plate(port, 'dark', [side * .270, 1.19, z], [.012, .045, .045]);
  }

  // ------------------------------------------------------------------ head and jaws
  const head = part('head.carrier', 'Cranial gimbal and jaw hinge frame', 'Head structure',
    'Carries the cranium, both jaws, eyes and spiracles ahead of vertebra one.',
    'A transverse gimbal ring, two side plates and the jaw pin form a rigid open frame.', undefined, [0, .10, -.03], 'Titanium and brass');
  head.position.fromArray(lastState.head.origin);
  boss(head, [0, 0, 0], .06, 'brass', 'x');
  const cranium = part('head.cranium', 'Cranium and snout shell', 'Head structure',
    'Closes the front of the body around the sensory apertures.',
    'A rounded pale cranium, a dark snout wedge and a reinforced rostral cap leave the jaw pin visible.', head, [0, .03, -.03], 'Formed pale alloy shell and dark wedge');
  add(cranium, 'sphere', 'shell', [0, .02, -.04], [.24, .18, .30]);
  plate(cranium, 'dark', [0, -.02, -.28], [.26, .12, .22]);
  add(cranium, 'cone', 'shell', [0, -.03, -.50], [.14, .22, .11], [Math.PI / 2, 0, 0]);
  const rostrum = part('head.rostrum', 'Rostral snout and lateral-line grooves', 'Head structure',
    'Extends the pointed snout ahead of the jaw hinge.',
    'A tapered pale cone, two lateral rails and a brass tip carry the snout profile without a texture.', head, [0, .04, -.04], 'Formed pale alloy shell and brass tip');
  add(rostrum, 'cone', 'shell', [0, 0, -.32], [.10, .34, .08], [Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) rod(rostrum, 'titanium', [side * .10, -.01, -.22], [side * .045, -.03, -.60], .008);
  add(rostrum, 'sphere', 'brass', [0, -.01, -.60], [.014, .014, .014]);
  for (const side of [-1, 1]) rod(cranium, 'titanium', [side * .16, .05, -.12], [side * .10, -.04, -.38], .014);
  kit.fasteners(cranium, [[-.10, .14, -.16], [.10, .14, -.16], [0, .16, -.05]], .009);
  for (const side of [-1, 1]) {
    const eye = part(`head.eye.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} eye and orbital ring`, 'Head optics',
      'Places a forward-facing lens outside the snout shell.',
      'A dark orbital pad, brass bezel and teal lens are mounted on the side of the cranium.', head, [side * .12, .03, -.02], 'Dark pad, brass bezel and teal glass');
    add(eye, 'sphere', 'lens', [side * .20, .05, -.15], [.032, .032, .025]);
    boss(eye, [side * .20, .05, -.14], .04, 'brass', 'x');
    const spiracle = part(`head.spiracle.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} spiracle`, 'Ventilation',
      'Marks the paired spiracle behind the eye.',
      'A small dark aperture and brass rim sit on a raised pad above the gill line.', head, [side * .1, .04, 0]);
    plate(spiracle, 'rubber', [side * .205, .10, .03], [.012, .05, .05]);
    boss(spiracle, [side * .205, .10, .03], .025, 'brass', 'x');
  }
  const upperTeeth = part('head.teeth.upper', 'Upper palatine tooth row', 'Dentition',
    'Shows a replaceable upper tooth battery.',
    'Twelve tapered pale teeth are set in a dark gum rail with visible sockets.', head, [0, .02, -.05], 'Pale tooth enamel and dark gum');
  for (let k = 0; k < 12; k++) {
    const x = -.11 + (k % 6) * .044, z = -.32 - Math.floor(k / 6) * .09;
    add(upperTeeth, 'cone', 'shell', [x, -.105, z], [.014, .055, .014], [Math.PI, 0, 0]);
    add(upperTeeth, 'sphere', 'dark', [x, -.07, z], [.016, .012, .016], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) {
    const rail = part(`head.jawRail.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} upper jaw rail`, 'Dentition',
      'Carries the upper tooth battery and keeps the mouth line readable.',
      'A dark gum rail, brass cheek pin and three pale teeth sit under the rostrum.', head, [side * .03, .02, 0], 'Dark gum, brass pin and pale teeth');
    plate(rail, 'dark', [side * .09, -.10, -.30], [.02, .035, .24]);
    rod(rail, 'brass', [side * .10, -.10, -.18], [side * .10, -.10, -.46], .005);
    for (let k = 0; k < 3; k++) add(rail, 'cone', 'shell', [side * .09, -.14, -.24 - k * .07], [.012, .04, .012], [Math.PI, 0, 0], true);
  }
  const jaw = part('head.jaw', 'Lower mandible and tooth row', 'Dentition',
    'Opens on the transverse jaw pin below the snout.',
    'A dark V-shaped mandible carries twelve teeth in a gum rail and swings on a brass hinge.', head, [0, .03, -.02], 'Dark alloy, brass hinge and pale teeth');
  jaw.position.set(0, -.065, -.12);
  plate(jaw, 'dark', [0, -.09, -.16], [.22, .06, .30]);
  plate(jaw, 'brass', [0, -.065, -.20], [.16, .025, .18], [0, 0, 0], true);
  boss(jaw, [0, 0, 0], .036, 'brass', 'x');
  for (let k = 0; k < 12; k++) {
    const x = -.10 + (k % 6) * .04, z = -.28 - Math.floor(k / 6) * .08;
    add(jaw, 'cone', 'shell', [x, -.035, z], [.013, .045, .013]);
  }

  // ------------------------------------------------------------------ tail
  for (let i = 0; i < D.tailCount; i++) {
    const frame = part(`tail.${i + 1}.frame`, `Caudal vertebra ${i + 1} of eight`, 'Tail',
      `Preserves caudal pin ${i + 1} at the design ${Math.round(D.tailLink * 1000)} mm spacing.`,
      'Two rings, a tapered centrum and a neural spine form one rigid link around the visible pin.', undefined, [0, .06, 0]);
    for (const y of [0, D.tailLink]) boss(frame, [0, y, 0], .072 - i * .005, 'titanium', 'y');
    add(frame, 'cylinder', 'dark', [0, D.tailLink * .5, 0], [.055 - i * .004, D.tailLink * .88, .055 - i * .004]);
    plate(frame, 'shell', [0, D.tailLink * .5, -.025], [.022, .07, .04], [0, 0, 0], false);
    for (const side of [-1, 1]) rod(frame, 'copper', [side * .025, .01, .012], [side * .025, D.tailLink - .01, .012], .003, true);
    tailFrames.push({ node: frame, index: i });
  }
  for (let i = 0; i < 4; i++) {
    const scute = part(`tail.${i + 1}.scute`, `Caudal dorsal scute ${i + 1}`, 'Tail armor',
      'Covers one caudal link while leaving its pin free.',
      'A pale plate on two isolators follows the link pitch without bridging the gap.', tailFrames[i * 2].node, [0, .02, 0], 'Formed pale alloy shell');
    add(scute, 'sphere', 'shell', [0, 0, 0], [.04 - i * .005, .022, .04]);
  }
  const tailFinUpper = part('fin.tail.upper', 'Upper caudal lobe', 'Fins',
    'Completes the tail silhouette above the final caudal pin.',
    'Four swept rails and four cross ribs fan from the final pin with no solid membrane.', undefined, [0, .08, .02], 'Titanium rails and pale edge plates');
  const tailFinLower = part('fin.tail.lower', 'Lower caudal lobe', 'Fins',
    'Completes the tail silhouette below the final caudal pin.',
    'Four swept rails and three cross ribs mirror the upper lobe around the same hinge.', undefined, [0, -.02, .02], 'Titanium rails and pale edge plates');
  for (let k = 0; k < 4; k++) {
    rod(tailFinUpper, 'titanium', [0, 0, 0], [0, .28 + k * .05, .38 + k * .035], .009);
    rod(tailFinLower, 'titanium', [0, 0, 0], [0, -.22 - k * .035, .36 + k * .03], .009);
  }
  for (let k = 0; k < 4; k++) rod(tailFinUpper, 'dark', [0, .04 + k * .05, .12 + k * .04], [0, .06 + k * .04, .30], .004, true);
  for (let k = 0; k < 3; k++) rod(tailFinLower, 'dark', [0, -.04 - k * .04, .12 + k * .04], [0, -.05 - k * .035, .28], .004, true);
  for (let k = 0; k < 3; k++) {
    plate(tailFinUpper, 'shell', [0, .18 + k * .13, .20 + k * .11], [.024, .30 - k * .055, .18], [-.5 - k * .18, .2, 0]);
    plate(tailFinLower, 'shell', [0, -.15 - k * .10, .19 + k * .10], [.024, .24 - k * .045, .16], [.5 + k * .18, .2, 0]);
  }
  rod(tailFinUpper, 'brass', [0, 0, 0], [0, .45, .55], .007);
  rod(tailFinLower, 'brass', [0, 0, 0], [0, -.36, .52], .007);

  for (let k = 0; k < 3; k++) {
    const scute = part(`body.scute.${k + 1}`, `Dorsal ridge scute ${k + 1} of three`, 'Body armor',
      `Locks body station ${k + 1} to the dorsal hull without a continuous shell.`,
      'A pale plate on four isolators sits over the vertebral spines and stays clear of the fin root.', undefined, [0, .04, 0], 'Formed pale alloy shell');
    add(scute, 'sphere', 'shell', [0, 1.455, -.18 + k * .28], [.13, .035, .10]);
    kit.fasteners(scute, [[-.09, 1.47, -.18 + k * .28], [.09, 1.47, -.18 + k * .28]], .006);
  }
  for (const side of [-1, 1]) {
    const actuator = part(`head.actuator.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} jaw adductor housing`, 'Dentition',
      'Shows the actuator that drives the lower jaw hinge.',
      'A dark cylinder and brass rod sit behind the jaw pin and stay clear of the gill line.', undefined, [side * .04, .03, 0], 'Dark cylinder and brass rod');
    add(actuator, 'cylinder', 'dark', [side * .12, 1.25, -.92], [.026, .15, .026], [.35, 0, 0]);
    rod(actuator, 'brass', [side * .12, 1.20, -.98], [side * .12, 1.18, -1.06], .008);
    const finAct = part(`fin.pectoral.${side < 0 ? 'L' : 'R'}.ram`, `${side < 0 ? 'Left' : 'Right'} pectoral fin ram`, 'Fins',
      'Shows the linear actuator under the pectoral root.',
      'A titanium barrel and brass rod run from the girdle to the fin root clevis.', undefined, [side * .03, .03, 0], 'Titanium barrel and brass rod');
    add(finAct, 'cylinder', 'titanium', [side * .28, 1.16, -.30], [.020, .16, .020], [0, 0, side * .5]);
    rod(finAct, 'brass', [side * .36, 1.10, -.30], [side * .43, 1.04, -.30], .006);
  }
  const hingeFairing = part('tail.9.fairing', 'Final tail hinge fairing', 'Tail',
    'Smooths the last caudal joint without closing the pin gap.',
    'A small pale fairing and two brass pins cover the eighth caudal hinge.', tailFrames[D.tailCount - 1].node, [0, .03, 0], 'Formed pale alloy shell');
  add(hingeFairing, 'sphere', 'shell', [0, .05, 0], [.035, .045, .05]);
  boss(hingeFairing, [0, .05, 0], .04, 'brass', 'x');

  // ------------------------------------------------------------------ gantry
  const gantry = (id, name, purpose, how, explode, material) => part(id, name, 'Service gantry', purpose, how, undefined, explode, material);
  const base = gantry('gantry.base', 'Ballasted gantry base', 'A stable floor plate for the suspended specimen.',
    'A wide steel plate with four adjustable feet and six anchor bolts spreads the overturning load.', [0, .02, 0], 'Dark steel and rubber feet');
  plate(base, 'dark', [0, .035, 0], [1.5, .07, .62]);
  for (const x of [-.62, .62]) for (const z of [-.20, .20]) add(base, 'cylinder', 'rubber', [x, .012, z], [.05, .024, .05]);
  kit.fasteners(base, [[-.5, .07, -.2], [.5, .07, -.2], [-.5, .07, .2], [.5, .07, .2]], .014);
  const posts = [];
  for (const side of [-1, 1]) {
    const post = gantry(`gantry.post.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} gantry post`, 'Raises the cradle to the body line.',
      'A tapered box column, bolted foot and diagonal brace are sized for a static display load.', [side * .04, 0, 0], 'Dark steel');
    plate(post, 'dark', [side * .55, .58, 0], [.09, 1.14, .14]);
    plate(post, 'titanium', [side * .55, 1.13, 0], [.15, .07, .18]);
    rod(post, 'titanium', [side * .55, .25, .06], [side * .42, .95, .02], .012);
    kit.fasteners(post, [[side * .55, .06, -.1], [side * .55, .06, .1]], .012);
    posts.push(post);
  }
  const beam = gantry('gantry.beam', 'Crossbeam and cradle hangers', 'Spans both posts above the specimen.',
    'A box beam and two bolted hanger plates carry the U-cradle without touching the dorsal fin.', [0, .04, 0], 'Dark steel and titanium');
  plate(beam, 'dark', [0, 1.16, 0], [1.22, .10, .12]);
  for (const side of [-1, 1]) plate(beam, 'titanium', [side * .38, 1.09, 0], [.04, .16, .12]);
  kit.fasteners(beam, [[-.35, 1.16, .06], [.35, 1.16, .06]], .012);
  const cradle = gantry('gantry.cradle', 'U-shaped belly cradle', 'Supports the specimen under the pectoral girdle.',
    'A wide U-frame with rubber pads follows the belly curvature and leaves the gills open.', [0, .02, 0], 'Titanium and rubber');
  plate(cradle, 'titanium', [0, 1.02, 0], [.72, .05, .28]);
  for (const side of [-1, 1]) { plate(cradle, 'rubber', [side * .29, 1.05, 0], [.09, .035, .30]); rod(cradle, 'dark', [side * .34, 1.02, -.13], [side * .34, 1.24, -.06], .012); }
  const winch = gantry('gantry.winch', 'Manual winch and brake', 'Allows the display height to be adjusted.',
    'A brass drum, ratchet ring and crank handle are mounted under the beam on a service plate.', [0, .03, 0], 'Brass drum and dark steel');
  add(winch, 'cylinder', 'brass', [.08, 1.06, .06], [.055, .09, .055], [0, 0, Math.PI / 2]);
  add(winch, 'ring', 'dark', [.08, 1.06, -.02], [.08, .08, .08], [0, Math.PI / 2, 0]);
  rod(winch, 'dark', [.13, 1.06, .04], [.20, 1.06, .10], .008);
  plate(winch, 'titanium', [.04, 1.12, .04], [.14, .02, .10]);
  for (const side of [-1, 1]) {
    const strap = gantry(`gantry.strap.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} safety strap`, 'Limits vertical travel if the cradle slips.',
      'A woven dark strap loops from the cradle to the beam through a brass adjuster.', [side * .03, .02, 0], 'Dark webbing and brass adjuster');
    rod(strap, 'rubber', [side * .30, 1.06, -.05], [side * .30, 1.28, -.02], .012);
    add(strap, 'ring', 'brass', [side * .30, 1.16, -.03], [.025, .025, .025], [0, 0, 0]);
  }

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.tail && state?.head) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    head.position.fromArray(pose.head.origin);
    head.rotation.set(pose.head.pitch, pose.head.yaw, 0, 'YXZ');
    jaw.rotation.x = -pose.head.jaw;
    for (const [i, fin] of fins.entries()) fin.root.rotation.z = fin.side * pose.fins[i].pitch;
    tailFrames.forEach((record, i) => aim(record.node, pose.tail.links[i].start, pose.tail.links[i].end));
    for (const lobe of [tailFinUpper, tailFinLower]) {
      lobe.position.fromArray(pose.tailFin.origin);
      lobe.rotation.set(0, pose.tailFin.yaw, 0);
    }
    kit.sync(options);
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
