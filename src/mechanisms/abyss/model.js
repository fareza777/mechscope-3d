import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('ABYSS S9 · articulated pelagic shark and service cradle');
  kit.assemblies.rotation.y = Math.PI;
  const nodes = [], spineFrames = [], tailFrames = [], ramNodes = [], tendonNodes = [];
  const gillFlaps = [], pectorals = [], pelvicFins = [], eyeNodes = [], jawRamNodes = [];
  const rollers = [];
  let disposed = false, lastState = sample(0);
  const add = kit.add, rod = kit.rod;
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
  const screw = (node, p, radius = .006) => kit.fasteners(node, [p], radius);
  const cylinder = (node, material, p, r, length, euler = [Math.PI / 2, 0, 0], detail = false) =>
    add(node, 'cylinder', material, p, [r, length, r], euler, detail);

  // ---------------------------------------------------------------- axial skeleton
  // Fourteen rigid vertebral links. Every plate, rib, gill and fin saddle below
  // is a child of its link, so the whole body follows the sampled wave.
  for (let i = 0; i < D.spineCount; i++) {
    const w = D.widths[i], h = D.heights[i], L = D.spineLink;
    const frame = part(`spine.${i + 1}.frame`, `Vertebral load frame ${i + 1} of fourteen`, 'Axial skeleton',
      `Keeps vertebral pin ${i + 1} at the design ${Math.round(L * 1000)} mm spacing through the swimming wave.`,
      'Two bearing rings, a boxed centrum, paired transverse processes and a dorsal crest form one rigid link around the visible pin.', undefined, [0, .07, .02]);
    boss(frame, [0, 0, .016], w * .58, 'titanium', 'z');
    boss(frame, [0, 0, L - .016], w * .52, 'brass', 'z');
    cylinder(frame, 'dark', [0, 0, L * .5], w * .27, L * .80);
    for (const side of [-1, 1]) {
      rod(frame, 'titanium', [side * w * .25, 0, L * .27], [side * w * .70, 0, L * .34], .008);
      rod(frame, 'titanium', [side * w * .22, 0, L * .70], [side * w * .64, .012, L * .66], .008);
      rod(frame, 'copper', [side * w * .20, -h * .28, .010], [side * w * .20, -h * .28, L - .010], .0035, true);
      add(frame, 'box', 'rubber', [side * w * .20, -h * .28, L * .5], [.013, .012, .020], [0, 0, 0], true);
    }
    rod(frame, 'titanium', [0, -h * .42, L * .12], [0, -h * .48, L * .88], .007);
    rod(frame, 'brass', [0, h * .42, L * .18], [0, h * .58, L * .82], .006);
    plate(frame, 'dark', [0, -h * .52, L * .5], [w * .52, .014, L * .72]);
    screw(frame, [-w * .42, h * .34, L * .25], .0055); screw(frame, [w * .42, h * .34, L * .25], .0055);
    screw(frame, [-w * .36, -h * .32, L * .72], .005); screw(frame, [w * .36, -h * .32, L * .72], .005);
    spineFrames.push(frame);

    const cowl = part(`spine.${i + 1}.cowl`, `Dorsal armor cowl ${i + 1} of fourteen`, 'Scale armor',
      `Closes body station ${i + 1} over the moving vertebra without hiding its joint pins.`,
      'Two pale shell shells, lateral cheek plates and three staggered dorsal scales leave dark seams and exposed rings.', frame, [0, .05, .02], 'Formed pale alloy shell');
    add(cowl, 'sphere', 'shell', [0, h * .50, L * .44], [w * 1.03, h * .68, L * .64]);
    add(cowl, 'sphere', 'shell', [0, -h * .34, L * .54], [w * .88, h * .38, L * .56]);
    for (const side of [-1, 1]) plate(cowl, 'shell', [side * w * .80, .004, L * .50], [.022, h * .72, L * .78], [0, 0, side * .16]);
    for (let s = 0; s < 3; s++) plate(cowl, 'shell', [0, h * .60, L * (.22 + s * .28)], [w * (1.02 - s * .10), .014, L * .18], [0, 0, 0], false);
    plate(cowl, 'dark', [0, h * .22, L * .90], [w * .42, .010, .016]);
    screw(cowl, [-w * .58, h * .52, L * .18], .0045); screw(cowl, [w * .58, h * .52, L * .18], .0045);
    screw(cowl, [-w * .50, h * .50, L * .82], .0045); screw(cowl, [w * .50, h * .50, L * .82], .0045);

    if ([1, 3, 5, 7, 9, 11, 13].includes(i)) for (const side of [-1, 1]) {
      const rib = part(`spine.${i + 1}.rib.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} costal rib frame ${i + 1}`, 'Rib cage',
        `Ties vertebral station ${i + 1} to the open belly rail with a readable arch.`,
        'A tapered titanium rail, a dark sternal strut and a brass belly pad leave the flank open for gill inspection.', frame, [side * .04, .03, .02]);
      rod(rib, 'titanium', [side * w * .38, 0, L * .35], [side * w * 1.30, -h * .70, L * .10], .007);
      rod(rib, 'dark', [side * w * 1.30, -h * .70, L * .10], [side * w * .92, -h * 1.02, L * .02], .005);
      add(rib, 'sphere', 'brass', [side * w * 1.30, -h * .70, L * .10], [.010, .010, .010]);
      plate(rib, 'brass', [side * w * .92, -h * 1.02, L * .02], [.026, .018, .032]);
      screw(rib, [side * w * .92, -h * 1.02, L * .02], .0035);
    }
  }

  // Paired hydraulic rams and copper tendons bridge each service joint.
  for (let j = 0; j < 7; j++) for (const side of [-1, 1]) {
    const ram = part(`spine.${j + 1}.ram.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} intervertebral ram ${j + 1}`, 'Hydraulic spine drive',
      `Shows the linear actuator spanning the ${j + 1}–${j + 2} vertebral joint.`,
      'A titanium barrel, brass gland, dark clevis and two pins ride between the actual link frames; only the commanded stroke changes.', undefined, [side * .05, .02, 0], 'Titanium barrel, brass gland and dark clevis');
    cylinder(ram, 'titanium', [0, .34, 0], .008, .56, [0, 0, 0]);
    cylinder(ram, 'brass', [0, .70, 0], .0055, .32, [0, 0, 0]);
    cylinder(ram, 'dark', [0, .08, 0], .0065, .14, [0, 0, 0]);
    add(ram, 'bolt', 'brass', [0, .02, 0], [.011, .012, .011]);
    add(ram, 'bolt', 'dark', [0, .97, 0], [.009, .012, .009]);
    ramNodes.push({ node: ram, joint: j, side });
  }
  for (let j = 0; j < 7; j++) {
    const side = j % 2 ? 1 : -1;
    const tendon = part(`spine.${j + 1}.tendon`, `${side < 0 ? 'Port' : 'Starboard'} copper tendon span ${j + 1}`, 'Copper tendons',
      `Carries the visible tensile service cable across the ${j + 1}–${j + 2} joint.`,
      'A stranded copper run with a dark sleeve follows the sampled link endpoints; it is an indicator, not a tension calculation.', undefined, [side * .05, .06, 0], 'Stranded copper and insulated sleeve');
    rod(tendon, 'copper', [0, 0, 0], [0, 1, 0], .003);
    add(tendon, 'cylinder', 'rubber', [.006, .5, 0], [.0028, 1, .0028], [0, 0, 0], true);
    add(tendon, 'bolt', 'brass', [0, 0, 0], [.009, .016, .009]);
    tendonNodes.push({ node: tendon, joint: j, side });
  }

  // ---------------------------------------------------------------- caudal chain
  for (let i = 0; i < D.tailCount; i++) {
    const w = D.tailWidths[i], h = D.tailHeights[i], L = D.tailLink;
    const frame = part(`tail.${i + 1}.frame`, `Caudal vertebra ${i + 1} of six`, 'Tail',
      `Preserves caudal pin ${i + 1} at the design ${Math.round(L * 1000)} mm spacing.`,
      'Two bearing rings, a tapered centrum, a dorsal blade and copper service runs form one rigid caudal link.', undefined, [0, .06, 0]);
    boss(frame, [0, 0, .012], w * .78, 'titanium', 'z');
    boss(frame, [0, 0, L - .012], w * .68, 'brass', 'z');
    cylinder(frame, 'dark', [0, 0, L * .5], w * .46, L * .82);
    for (const side of [-1, 1]) rod(frame, 'titanium', [side * w * .40, 0, L * .22], [side * w * .90, 0, L * .72], .005);
    plate(frame, 'shell', [0, h * .72, L * .48], [.016, h * 1.3, L * .64]);
    for (const side of [-1, 1]) rod(frame, 'copper', [side * w * .30, -h * .30, .008], [side * w * .30, -h * .30, L - .008], .0028, true);
    screw(frame, [0, h * .88, L * .25], .004); screw(frame, [0, -h * .55, L * .70], .004);
    tailFrames.push(frame);

    const scute = part(`tail.${i + 1}.scute`, `Caudal dorsal scute ${i + 1}`, 'Tail armor',
      'Covers one caudal link while leaving both hinge pins exposed.',
      'A pale shell scale on a brass isolator follows the link pitch without bridging the pin gap.', frame, [0, .04, 0], 'Formed pale alloy shell');
    add(scute, 'sphere', 'shell', [0, h * .55, L * .42], [w * .80, h * .34, L * .48]);
    add(scute, 'sphere', 'brass', [0, h * .30, L * .48], [.007, .007, .007]);
    screw(scute, [0, h * .30, L * .48], .0035);
  }

  // Forked tail: two independently hinged lobes on the last caudal pin.
  const lobeHinge = part('fin.tail.hinge', 'Forked-tail hinge block and jewels', 'Fins',
    'Locates both caudal lobe pins and their bearing jewels on the final caudal link.',
    'A dark block, two brass trunnions and two teal bearing jewels expose the fork axis.', tailFrames[D.tailCount - 1], [0, .05, 0], 'Dark block, brass trunnions and teal jewels');
  lobeHinge.position.set(0, 0, D.tailLink);
  plate(lobeHinge, 'dark', [0, 0, 0], [.05, .055, .035]);
  for (const side of [-1, 1]) {
    boss(lobeHinge, [0, side * .022, 0], .014, 'brass', 'x');
    add(lobeHinge, 'sphere', 'lens', [0, side * .026, .022], [.008, .008, .008]);
  }
  const upperLobe = part('fin.tail.upper', 'Upper caudal lobe', 'Fins',
    'Completes the tall upper fork of the articulated tail.',
    'Five swept titanium rays, three cross ribs, a brass leading edge and three pale shell webs fan from the final pin.', tailFrames[D.tailCount - 1], [0, .08, .02], 'Titanium rays, brass edge and pale shell webs');
  upperLobe.position.set(0, 0, D.tailLink);
  for (let k = 0; k < 5; k++) rod(upperLobe, 'titanium', [0, .01, 0], [0, .20 + k * .045, .34 + k * .042], .006);
  for (let k = 0; k < 3; k++) rod(upperLobe, 'dark', [0, .07 + k * .05, .11 + k * .05], [0, .11 + k * .05, .30 + k * .05], .003, true);
  for (let k = 0; k < 3; k++) plate(upperLobe, 'shell', [0, .13 + k * .12, .19 + k * .10], [.020, .24 - k * .045, .15], [-.48 - k * .16, .18, 0]);
  rod(upperLobe, 'brass', [0, .01, 0], [0, .42, .55], .005);
  add(upperLobe, 'sphere', 'lens', [0, .01, 0], [.012, .012, .012]);
  const lowerLobe = part('fin.tail.lower', 'Lower caudal lobe', 'Fins',
    'Completes the lower fork of the articulated tail.',
    'Four swept titanium rays, three cross ribs, a brass leading edge and three pale shell webs mirror the upper lobe.', tailFrames[D.tailCount - 1], [0, -.02, .02], 'Titanium rays, brass edge and pale shell webs');
  lowerLobe.position.set(0, 0, D.tailLink);
  for (let k = 0; k < 4; k++) rod(lowerLobe, 'titanium', [0, -.01, 0], [0, -.15 - k * .035, .33 + k * .036], .006);
  for (let k = 0; k < 3; k++) rod(lowerLobe, 'dark', [0, -.05 - k * .035, .12 + k * .045], [0, -.07 - k * .033, .28 + k * .04], .003, true);
  for (let k = 0; k < 3; k++) plate(lowerLobe, 'shell', [0, -.10 - k * .09, .19 + k * .09], [.020, .20 - k * .035, .14], [.46 + k * .15, .18, 0]);
  rod(lowerLobe, 'brass', [0, -.01, 0], [0, -.34, .52], .005);

  // ---------------------------------------------------------------- cranial assembly
  const head = part('head.carrier', 'Cranial gimbal and neck truss', 'Head structure',
    'Carries the cranium, both mandibles, eyes and spiracles ahead of vertebra one.',
    'A transverse brass gimbal ring, two cheek struts and a dark neck saddle form a rigid open carrier.', undefined, [0, .10, -.03], 'Titanium, brass and dark alloy');
  head.position.fromArray(D.headOrigin);
  boss(head, [0, 0, .012], .055, 'brass', 'z');
  for (const side of [-1, 1]) rod(head, 'titanium', [side * .09, 0, .015], [side * .15, -.025, -.12], .008);
  plate(head, 'dark', [0, -.035, -.055], [.22, .022, .11]);
  const cranium = part('head.cranium', 'Cranium, snout wedge and cheek shells', 'Head structure',
    'Closes the front of the body around the eye and jaw apertures.',
    'A rounded pale cranium, a dark snout wedge, two cheek shells and a reinforced rostral saddle leave the jaw pin visible.', head, [0, .03, -.03], 'Formed pale alloy shell and dark wedge');
  add(cranium, 'sphere', 'shell', [0, .025, -.20], [.200, .165, .30]);
  add(cranium, 'sphere', 'shell', [0, -.045, -.35], [.185, .115, .22]);
  plate(cranium, 'dark', [0, -.050, -.45], [.215, .095, .20]);
  for (const side of [-1, 1]) plate(cranium, 'shell', [side * .145, .025, -.22], [.032, .12, .22], [0, 0, side * .12]);
  for (const side of [-1, 1]) rod(cranium, 'titanium', [side * .15, .06, -.10], [side * .09, -.03, -.34], .010);
  for (const p of [[-.09, .13, -.15], [.09, .13, -.15], [0, .15, -.08]]) screw(cranium, p, .006);
  const rostrum = part('head.rostrum', 'Rostral cone and lateral-line grooves', 'Head structure',
    'Extends the pointed snout ahead of both mandibles.',
    'A tapered pale cone, two titanium lateral rails, a brass band and a small brass tip define the snout without a texture.', head, [0, .04, -.04], 'Formed pale alloy, brass band and tip');
  add(rostrum, 'cone', 'shell', [0, -.005, -.66], [.095, .28, .065], [-Math.PI / 2, 0, 0]);
  for (const side of [-1, 1]) rod(rostrum, 'titanium', [side * .085, .012, -.50], [side * .030, -.018, -.84], .006);
  add(rostrum, 'sphere', 'brass', [0, -.005, -.82], [.012, .012, .012]);
  boss(rostrum, [0, -.005, -.56], .030, 'brass', 'z');
  for (const side of [-1, 1]) {
    const nasal = part(`head.nasal.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} nostril ampoule`, 'Sensory frame',
      'Marks the paired olfactory aperture on the underside of the snout.',
      'A dark capsule, brass rim and teal jewel sit in the rostral shell ahead of the eye.', head, [side * .04, .02, -.03], 'Dark capsule, brass rim and teal jewel');
    nasal.position.set(side * .070, -.055, -.50);
    add(nasal, 'sphere', 'dark', [0, 0, 0], [.022, .012, .030]);
    boss(nasal, [side * .006, 0, 0], .018, 'brass', 'x');
    add(nasal, 'sphere', 'lens', [side * .018, 0, 0], [.007, .009, .010]);
  }

  const upperJaw = part('head.jaw.upper', 'Upper mandible and palatine battery', 'Dentition',
    'Provides the rigid upper jaw against which the lower mandible closes.',
    'A dark palatine beam, brass gum rail and eight tapered teeth sit below the rostrum without flexing.', head, [0, .02, -.05], 'Dark alloy, brass rail and pale teeth');
  plate(upperJaw, 'dark', [0, -.095, -.39], [.195, .045, .26]);
  plate(upperJaw, 'brass', [0, -.070, -.41], [.155, .020, .22]);
  for (let k = 0; k < 8; k++) {
    const x = -.082 + (k % 4) * .055, z = -.30 - Math.floor(k / 4) * .13;
    add(upperJaw, 'cone', 'shell', [x, -.125, z], [.011, .040, .011], [Math.PI, 0, 0]);
    add(upperJaw, 'bolt', 'dark', [x, -.100, z], [.010, .010, .010], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) rod(upperJaw, 'brass', [side * .098, -.095, -.18], [side * .098, -.095, -.52], .0042);
  const lowerJaw = part('head.jaw.lower', 'Lower mandible, hinge and tooth row', 'Dentition',
    'Opens on the transverse jaw pin below the snout.',
    'A dark V-shaped mandible, brass hinge ring, gum rail and eight teeth swing as one rigid body.', head, [0, .03, -.02], 'Dark alloy, brass hinge and pale teeth');
  lowerJaw.position.set(0, -.085, -.30);
  plate(lowerJaw, 'dark', [0, -.008, -.18], [.185, .045, .27]);
  plate(lowerJaw, 'brass', [0, .012, -.17], [.125, .020, .18]);
  boss(lowerJaw, [0, 0, 0], .027, 'brass', 'x');
  for (let k = 0; k < 8; k++) {
    const x = -.078 + (k % 4) * .052, z = -.10 - Math.floor(k / 4) * .12;
    add(lowerJaw, 'cone', 'shell', [x, .040, z], [.010, .036, .010]);
    add(lowerJaw, 'bolt', 'dark', [x, .015, z], [.009, .009, .009], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) rod(lowerJaw, 'titanium', [side * .095, -.01, -.05], [side * .070, .012, -.28], .005);

  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Left' : 'Right';
    const eye = part(`head.eye.${side < 0 ? 'L' : 'R'}`, `${label} eye gimbal and lens`, 'Head optics',
      'Aims the optical aperture independently on its trunnion.',
      'A dark carrier, brass orbital ring, teal lens and dark pupil turn together on a visible side pin.', head, [side * .12, .03, -.02], 'Dark carrier, brass bezel and teal glass');
    eye.position.set(side * .168, .058, -.17);
    add(eye, 'sphere', 'dark', [0, 0, 0], [.034, .040, .032]);
    boss(eye, [side * .012, 0, 0], .033, 'brass', 'x');
    add(eye, 'sphere', 'lens', [side * .022, 0, 0], [.018, .026, .026]);
    add(eye, 'sphere', 'dark', [side * .036, 0, 0], [.006, .014, .014]);
    eyeNodes.push({ node: eye, side });
    const trim = part(`head.eyeTrim.${side < 0 ? 'L' : 'R'}`, `${label} orbital pad and retainers`, 'Head optics',
      'Fixed socket that receives the moving eye gimbal.',
      'A dark pad and four titanium retainers sit against the cranium without sealing the lens.', head, [side * .10, .03, -.02], 'Dark pad and titanium retainers');
    trim.position.set(side * .152, .058, -.17);
    plate(trim, 'dark', [0, 0, 0], [.012, .070, .080]);
    for (let q = 0; q < 4; q++) add(trim, 'bolt', 'titanium', [side * .008, .052 * Math.sin(q * TAU / 4), .052 * Math.cos(q * TAU / 4)], [.007, .010, .007], [0, 0, Math.PI / 2], true);
    const spiracle = part(`head.spiracle.${side < 0 ? 'L' : 'R'}`, `${label} spiracle aperture`, 'Ventilation',
      'Marks the paired spiracle behind the eye.',
      'A small dark aperture with a brass rim sits on a raised pad above the first gill station.', head, [side * .09, .03, 0], 'Dark aperture and brass rim');
    spiracle.position.set(side * .185, .105, -.015);
    plate(spiracle, 'rubber', [0, 0, 0], [.010, .042, .048]);
    boss(spiracle, [side * .006, 0, 0], .021, 'brass', 'x');
    const jawRam = part(`head.jawRam.${side < 0 ? 'L' : 'R'}`, `${label} mandible hydraulic ram`, 'Dentition',
      'Shows the linear actuator behind the jaw hinge.',
      'A dark barrel, brass piston and two clevises stay clear of the gill line and follow the commanded gape.', head, [side * .04, .03, 0], 'Dark barrel and brass piston');
    jawRam.position.set(side * .11, -.13, -.25);
    cylinder(jawRam, 'dark', [0, 0, 0], .014, .11, [.35, 0, 0]);
    rod(jawRam, 'brass', [0, -.045, -.045], [0, -.085, -.075], .005);
    add(jawRam, 'sphere', 'lens', [0, -.085, -.075], [.007, .007, .007]);
    jawRamNodes.push({ node: jawRam, side });
  }

  // ---------------------------------------------------------------- gill stations
  for (const [g, station] of D.gillStations.entries()) {
    const frame = spineFrames[station], w = D.widths[station], h = D.heights[station], L = D.spineLink;
    for (const side of [-1, 1]) {
      const label = side < 0 ? 'Left' : 'Right';
      const flap = part(`gill.${side < 0 ? 'L' : 'R'}.${g + 1}`, `${label} gill flap ${g + 1} of five`, 'Ventilation',
        `Shows gill station ${g + 1} as a separate hinged compliant flap.`,
        'A dark slit plate, four pale lip rods, a brass arch and a teal bearing jewel swing on the flank hinge.', frame, [side * .04, .02, 0], 'Rubber slit, pale lips, brass arch and teal jewel');
      flap.position.set(side * (w * .99 + .004), h * .03, L * .52);
      plate(flap, 'rubber', [0, 0, 0], [.011, h * .72, .030]);
      for (const z of [-.024, .024]) rod(flap, 'shell', [side * .005, -h * .34, z], [side * .005, h * .34, z], .0045);
      rod(flap, 'brass', [side * .008, -h * .36, .002], [side * .008, h * .36, .010], .0035);
      add(flap, 'sphere', 'lens', [side * .010, h * .38, .002], [.006, .006, .006]);
      gillFlaps.push({ node: flap, side, index: g });
      const arch = part(`gill.${side < 0 ? 'L' : 'R'}.${g + 1}.arch`, `${label} gill arch cartridge ${g + 1}`, 'Ventilation',
        `Supports the hinge and water gallery at gill station ${g + 1}.`,
        'A titanium base plate, brass arch rail and two dark pins remain visible beside the moving flap.', frame, [side * .05, .02, 0], 'Titanium plate and brass arch');
      arch.position.set(side * (w * .94 + .002), h * .03, L * .52);
      plate(arch, 'titanium', [0, 0, 0], [.014, h * .80, .052]);
      for (const y of [-h * .30, h * .30]) rod(arch, 'brass', [side * .008, y, -.030], [side * .008, y, .030], .003);
      boss(arch, [side * .010, h * .42, 0], .012, 'brass', 'x');
    }
  }

  // ---------------------------------------------------------------- paired fins
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const frame = spineFrames[3], w = D.widths[3], h = D.heights[3];
    const root = part(`fin.pectoral.${id}.root`, `${label} pectoral shoulder gimbal`, 'Fins',
      'Carries the fin pitch and roll axes outboard of the pectoral girdle.',
      'A brass gimbal ring, dark housing, three tapered spars and a jeweled trunnion form the shoulder.', frame, [side * .08, .05, 0], 'Titanium housing, brass pin and teal jewel');
    root.position.set(side * (w + .035), h * .10, D.spineLink * .55);
    boss(root, [0, 0, 0], .048, 'brass', 'x');
    cylinder(root, 'dark', [side * .020, 0, 0], .032, .075, [0, 0, Math.PI / 2]);
    for (let k = 0; k < 3; k++) rod(root, 'titanium', [side * .02, .008 - k * .010, -.012], [side * .14, .006 - k * .010, -.03 - k * .028], .006);
    plate(root, 'titanium', [side * .060, 0, .024], [.080, .020, .075]);
    add(root, 'sphere', 'lens', [side * .048, .018, .024], [.009, .009, .009]);
    screw(root, [side * .02, .050, .02], .005);
    const blade = part(`fin.pectoral.${id}.blade`, `${label} pectoral fin blade`, 'Fins',
      'Provides a readable open fin surface on the shoulder gimbal.',
      'Four long spars, a thin pale web and a brass leading edge fan outward and trail behind the pitch pivot.', root, [side * .10, .08, 0], 'Titanium spars, brass edge and pale web');
    for (let k = 0; k < 4; k++) rod(blade, 'titanium', [side * .12, 0, -.025 + k * .020], [side * (.54 - k * .025), .015 - k * .008, .22 + k * .022], .006);
    plate(blade, 'shell', [side * .30, .010, .115], [.32, .014, .16], [0, side * .20, 0]);
    rod(blade, 'brass', [side * .12, .020, -.035], [side * .55, .030, .25], .005);
    const rays = [];
    for (let k = 0; k < 4; k++) {
      const ray = part(`fin.pectoral.${id}.ray.${k + 1}`, `${label} pectoral ray ${k + 1} of four`, 'Fins',
        `Adds an independently flexing fin ray at station ${k + 1}.`,
        'A titanium ray and a dark trailing rib pivot at the blade root so the fan can feather without a solid membrane.', blade, [side * .06, .04, 0], 'Titanium ray and dark trailing rib');
      rod(ray, 'titanium', [side * .16, 0, .015 + k * .022], [side * (.58 + k * .018), .018 + k * .004, .28 + k * .032], .004);
      rod(ray, 'dark', [side * .30, .008, .06 + k * .026], [side * (.56 + k * .016), .015 + k * .004, .25 + k * .030], .0028, true);
      add(ray, 'bolt', 'brass', [side * .16, 0, .015 + k * .022], [.007, .009, .007]);
      rays.push(ray);
    }
    const ram = part(`fin.pectoral.${id}.ram`, `${label} pectoral trim ram`, 'Fins',
      'Shows the short actuator that trims the shoulder gimbal.',
      'A titanium barrel and brass rod run from the girdle to the moving root clevis.', root, [side * .03, .03, 0], 'Titanium barrel and brass rod');
    cylinder(ram, 'titanium', [side * -.03, -.02, -.01], .009, .10, [0, 0, Math.PI / 2]);
    rod(ram, 'brass', [side * -.08, -.02, -.01], [side * -.13, -.05, -.03], .0045);
    add(ram, 'sphere', 'lens', [side * -.13, -.05, -.03], [.006, .006, .006]);
    pectorals.push({ root, blade, side, rays });

    const pelvicFrame = spineFrames[9], pw = D.widths[9], ph = D.heights[9];
    const pelvicRoot = part(`fin.pelvic.${id}.root`, `${label} pelvic fin hinge`, 'Fins',
      'Marks the paired pelvic station on a visible transverse pin.',
      'A brass hinge ring, dark saddle and short spar support the folding pelvic blade.', pelvicFrame, [side * .05, .03, 0], 'Brass ring and dark saddle');
    pelvicRoot.position.set(side * (pw * .90 + .010), -ph * .78, D.spineLink * .42);
    boss(pelvicRoot, [0, 0, 0], .026, 'brass', 'z');
    rod(pelvicRoot, 'titanium', [0, 0, 0], [side * .10, -.03, .02], .006);
    const pelvicBlade = part(`fin.pelvic.${id}`, `${label} pelvic fin blade`, 'Fins',
      'Folds against the belly on the pelvic hinge.',
      'Two short titanium spars, three dark ribs and a pale web mark the paired pelvic station.', pelvicRoot, [side * .05, .03, 0], 'Titanium spars and pale web');
    for (let k = 0; k < 2; k++) rod(pelvicBlade, 'titanium', [side * .03, 0, 0], [side * (.16 + k * .025), -.055 - k * .02, .13 + k * .04], .005);
    for (let k = 0; k < 3; k++) rod(pelvicBlade, 'dark', [side * .06, -.01, .02], [side * (.12 + k * .02), -.045, .10 + k * .03], .003, true);
    plate(pelvicBlade, 'shell', [side * .10, -.040, .09], [.12, .010, .10], [0, side * .20, 0]);
    pelvicFins.push({ node: pelvicRoot, side });

    const ram2 = part(`fin.pelvic.${id}.ram`, `${label} pelvic trim actuator`, 'Fins',
      'Shows the small actuator that folds the pelvic blade.',
      'A dark barrel and brass rod sit between the belly rail and the fin spar.', pelvicRoot, [side * .02, .02, 0], 'Dark barrel and brass rod');
    cylinder(ram2, 'dark', [side * -.02, -.01, -.01], .007, .07, [0, 0, Math.PI / 2]);
    rod(ram2, 'brass', [side * -.055, -.01, -.01], [side * -.09, -.03, 0], .0035);
  }

  // Median fins.
  const dorsalFrame = spineFrames[6], dw = D.widths[6], dh = D.heights[6];
  const dorsalHinge = part('fin.dorsal.hinge', 'Dorsal fin hinge saddle', 'Fins',
    'Carries the tall dorsal fin on a transverse pin above vertebra seven.',
    'A dark saddle, brass trunnion and two titanium caps leave the hinge axis readable.', dorsalFrame, [0, .10, .02], 'Dark saddle and brass trunnion');
  dorsalHinge.position.set(0, dh * .92, D.spineLink * .48);
  boss(dorsalHinge, [0, 0, 0], .030, 'brass', 'x');
  plate(dorsalHinge, 'dark', [0, -.012, 0], [.08, .035, .065]);
  const dorsal = part('fin.dorsal', 'Primary dorsal fin and ray frame', 'Fins',
    'Adds the tall dorsal silhouette above the center of mass.',
    'Five swept titanium rays, four cross ribs, a brass leading edge and three pale shell webs form an open fin.', dorsalHinge, [0, .10, .02], 'Titanium rays, brass edge and pale webs');
  for (let k = 0; k < 5; k++) rod(dorsal, 'titanium', [0, .02, -.02 + k * .02], [0, .42 - k * .035, .12 + k * .045], .007);
  for (let k = 0; k < 4; k++) rod(dorsal, 'dark', [0, .08 + k * .06, .02], [0, .22 + k * .05, .17 + k * .04], .003, true);
  for (let k = 0; k < 3; k++) plate(dorsal, 'shell', [0, .16 + k * .09, .07 + k * .045], [.018, .18 - k * .025, .13], [-.40, 0, 0]);
  rod(dorsal, 'brass', [0, .02, -.03], [0, .43, .30], .0045);
  add(dorsal, 'sphere', 'lens', [0, .02, 0], [.009, .009, .009]);
  const dorsalRam = part('fin.dorsal.ram', 'Dorsal fin trim ram', 'Fins',
    'Shows the linear trim actuator behind the dorsal hinge.',
    'A dark barrel and brass piston stay below the fin web and follow the commanded pitch.', dorsalFrame, [0, .10, .02], 'Dark barrel and brass piston');
  dorsalRam.position.set(0, dh * .86, D.spineLink * .25);
  cylinder(dorsalRam, 'dark', [0, 0, 0], .007, .09, [.55, 0, 0]);
  rod(dorsalRam, 'brass', [0, .045, -.02], [0, .075, -.06], .0035);
  const analFrame = spineFrames[11], ah = D.heights[11];
  const anal = part('fin.anal', 'Anal fin and hinge', 'Fins',
    'Adds the paired ventral silhouette behind the pelvic station.',
    'Three short titanium rays, two cross ribs and a pale web turn on a small brass pin.', analFrame, [0, -.02, .02], 'Titanium rays and pale web');
  anal.position.set(0, -ah * .92, D.spineLink * .42);
  boss(anal, [0, 0, 0], .018, 'brass', 'z');
  for (let k = 0; k < 3; k++) rod(anal, 'titanium', [0, -.02, 0], [0, -.13 - k * .025, .10 + k * .035], .004);
  rod(anal, 'brass', [0, -.02, 0], [0, -.17, .18], .0035);
  plate(anal, 'shell', [0, -.10, .10], [.012, .11, .09], [.42, 0, 0]);

  // ---------------------------------------------------------------- body detail
  const girdle = part('body.girdle', 'Pectoral girdle and belly keel', 'Body structure',
    'Distributes the shoulder gimbals and the cradle contact under body station four.',
    'A titanium yoke, two dark cheek rails and four isolators span the open belly without a solid hull.', spineFrames[3], [0, .02, 0], 'Titanium yoke and dark isolators');
  plate(girdle, 'titanium', [0, -.01, D.spineLink * .5], [.32, .035, .10]);
  for (const side of [-1, 1]) rod(girdle, 'dark', [side * .15, .01, .02], [side * .15, -.08, D.spineLink - .02], .008);
  for (const side of [-1, 1]) add(girdle, 'sphere', 'lens', [side * .12, .02, .04], [.007, .007, .007]);

  for (const [k, [station, side]] of [[2, -1], [3, 1], [4, -1], [7, 1], [8, -1], [9, 1]].entries()) {
    const frame = spineFrames[station], w = D.widths[station], h = D.heights[station];
    const scale = part(`body.scale.${k + 1}`, `Flank scale cassette ${k + 1} of six`, 'Scale armor',
      `Layers visible shell scales over body station ${station + 1}.`,
      'Three staggered pale plates, two brass retainers and a copper sense wire sit on a dark cassette base.', frame, [side * .06, .04, .01], 'Formed pale alloy scales, brass retainers and copper wire');
    scale.position.set(side * w * .92, h * .10, D.spineLink * .50);
    plate(scale, 'dark', [0, 0, 0], [.015, h * .52, D.spineLink * .78]);
    for (let p = 0; p < 3; p++) plate(scale, 'shell', [side * .008, h * (.18 - p * .13), D.spineLink * (.26 + p * .24)], [.012, h * .20, D.spineLink * .30], [0, 0, side * .10]);
    add(scale, 'bolt', 'brass', [side * .012, h * .24, D.spineLink * .18], [.007, .008, .007]);
    add(scale, 'bolt', 'brass', [side * .012, -h * .20, D.spineLink * .72], [.006, .008, .006]);
    rod(scale, 'copper', [side * .014, -h * .28, D.spineLink * .12], [side * .014, -h * .28, D.spineLink * .86], .0022, true);
  }
  for (const [p, [station, side]] of [[5, -1], [6, 1], [7, -1], [8, 1]].entries()) {
    const frame = spineFrames[station], w = D.widths[station], h = D.heights[station];
    const port = part(`sense.port.${p + 1}`, `Lateral-line pressure port ${p + 1}`, 'Sensory frame',
      'Provides one visible pressure-port station along the flank.',
      'A teal lens in a brass bezel sits on a dark pad at the lateral line.', frame, [0, .02, 0], 'Brass bezel, dark pad and teal lens');
    port.position.set(side * w * 1.02, h * .30, 0);
    plate(port, 'dark', [0, 0, 0], [.010, .042, .042]);
    boss(port, [side * .006, 0, 0], .017, 'brass', 'x');
    add(port, 'sphere', 'lens', [side * .016, 0, 0], [.007, .011, .011]);
  }
  const bellyFrame = spineFrames[6], bw = D.widths[6], bh = D.heights[6];
  const belly = part('body.belly.frame', 'Open belly service window frame', 'Service access',
    'Provides an open inspection window between the costal rails.',
    'A dark recess, four brass rails and four isolators expose the vertebra and hydraulic runs instead of a solid belly.', bellyFrame, [0, -.05, 0], 'Dark recess, brass rails and titanium isolators');
  belly.position.set(0, -bh * 1.02, D.spineLink * .42);
  plate(belly, 'dark', [0, -.010, 0], [.17, .015, D.spineLink * .62]);
  for (const side of [-1, 1]) rod(belly, 'brass', [side * .085, 0, -D.spineLink * .32], [side * .085, 0, D.spineLink * .32], .0035);
  for (const side of [-1, 1]) rod(belly, 'titanium', [side * .085, 0, 0], [side * .105, -.020, 0], .004);
  for (const side of [-1, 1]) add(belly, 'sphere', 'lens', [side * .085, .005, 0], [.006, .006, .006]);
  screw(belly, [-.07, -.002, -.04], .003); screw(belly, [.07, -.002, .04], .003);
  const hatch = part('body.belly.hatch', 'Hinged belly access hatch', 'Service access',
    'Covers the service window while allowing the spine to be inspected.',
    'A pale shell hatch on a brass hinge swings down against the keeper without sealing the recess.', bellyFrame, [0, -.10, 0], 'Formed pale shell and brass hinge');
  hatch.position.set(0, -bh * 1.02, D.spineLink * .22);
  plate(hatch, 'shell', [0, -.006, -.055], [.14, .012, D.spineLink * .42]);
  boss(hatch, [0, 0, 0], .012, 'brass', 'x');
  const latch = part('body.belly.latch', 'Belly hatch keeper and latch', 'Service access',
    'Holds the access hatch against the belly frame.',
    'A brass keeper plate and a dark pin sit on the opening edge of the hatch.', hatch, [0, -.04, 0], 'Brass keeper and dark pin');
  plate(latch, 'brass', [0, -.010, -.110], [.050, .014, .020]);
  add(latch, 'bolt', 'dark', [0, -.020, -.110], [.006, .010, .006]);

  // ---------------------------------------------------------------- service gantry
  const gantry = (id, name, purpose, how, explode, material) => part(id, name, 'Service gantry', purpose, how, undefined, explode, material);
  const base = gantry('gantry.base', 'Ballasted gantry base and floor rails', 'A stable floor plate for the supported specimen.',
    'A wide dark plate, four rubber feet, two titanium rails and six anchor bolts spread the display load.', [0, .02, 0], 'Dark steel, titanium rails and rubber feet');
  plate(base, 'dark', [0, .035, 0], [1.5, .07, .62]);
  for (const x of [-.62, .62]) for (const z of [-.20, .20]) add(base, 'cylinder', 'rubber', [x, .012, z], [.05, .024, .05]);
  for (const z of [-.28, .28]) plate(base, 'titanium', [0, .074, z], [1.34, .010, .022]);
  kit.fasteners(base, [[-.50, .07, -.20], [.50, .07, -.20], [-.50, .07, .20], [.50, .07, .20]], .012);
  const posts = [];
  for (const side of [-1, 1]) {
    const post = gantry(`gantry.post.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} gantry post and guide`, 'Raises the cradle to the body line.',
      'A tapered box column, bolted foot, diagonal brace and vertical guide are sized for a static display load.', [side * .04, 0, 0], 'Dark steel and titanium guide');
    plate(post, 'dark', [side * .55, .58, 0], [.09, 1.14, .14]);
    plate(post, 'titanium', [side * .55, 1.13, 0], [.15, .07, .18]);
    rod(post, 'titanium', [side * .55, .25, .06], [side * .42, .95, .02], .010);
    rod(post, 'titanium', [side * .49, .30, -.06], [side * .49, 1.00, -.06], .006);
    kit.fasteners(post, [[side * .55, .06, -.10], [side * .55, .06, .10]], .011);
    posts.push(post);
    const guide = gantry(`gantry.guide.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} cradle guide shoe`, 'Keeps the rocking cradle centered.',
      'A titanium shoe, rubber bumper and two brass pins ride on the post guide.', [side * .04, 0, 0], 'Titanium shoe, rubber bumper and brass pins');
    plate(guide, 'titanium', [side * .49, 1.00, .10], [.04, .09, .10]);
    plate(guide, 'rubber', [side * .47, 1.00, .10], [.015, .06, .08]);
    for (const y of [.97, 1.03]) add(guide, 'bolt', 'brass', [side * .51, y, .10], [.006, .008, .006]);
  }
  const beam = gantry('gantry.beam', 'Crossbeam and cradle hangers', 'Spans both posts above the specimen.',
    'A box beam, two bolted hanger plates and four isolators carry the U-cradle without touching the dorsal fin.', [0, .04, 0], 'Dark steel and titanium');
  plate(beam, 'dark', [0, 1.16, 0], [1.22, .10, .12]);
  for (const side of [-1, 1]) plate(beam, 'titanium', [side * .38, 1.09, 0], [.04, .16, .12]);
  for (const side of [-1, 1]) plate(beam, 'rubber', [side * .20, 1.10, 0], [.05, .025, .09]);
  kit.fasteners(beam, [[-.35, 1.16, .06], [.35, 1.16, .06]], .011);
  const cradle = gantry('gantry.cradle', 'U-shaped rocking belly cradle', 'Supports the specimen under the pectoral girdle.',
    'A wide titanium U-frame with rubber pads follows the belly and leaves the gills and fins clear.', [0, .02, 0], 'Titanium and rubber');
  cradle.position.set(0, 1.00, .06);
  plate(cradle, 'titanium', [0, .045, 0], [.72, .045, .28]);
  for (const side of [-1, 1]) {
    plate(cradle, 'rubber', [side * .28, .072, 0], [.09, .032, .30]);
    rod(cradle, 'dark', [side * .33, .02, -.13], [side * .33, .22, -.06], .010);
    add(cradle, 'sphere', 'lens', [side * .30, .02, .06], [.010, .010, .010]);
  }
  kit.fasteners(cradle, [[-.20, .07, -.08], [.20, .07, -.08]], .008);
  const rocker = gantry('gantry.rocker', 'Cradle rocker arms and trunnion', 'Rocks the cradle through a small display arc.',
    'A dark rocker beam, two brass links and a trunnion ring turn on the base center without translating the specimen.', [0, .03, 0], 'Dark beam and brass links');
  rocker.position.set(0, 1.00, .06);
  plate(rocker, 'dark', [0, -.005, 0], [.52, .035, .07]);
  for (const side of [-1, 1]) rod(rocker, 'brass', [side * .20, -.015, 0], [side * .30, -.080, .04], .006);
  boss(rocker, [0, -.010, 0], .026, 'brass', 'z');
  for (let r = 0; r < 4; r++) {
    const x = r % 2 ? .30 : -.30, z = r < 2 ? -.12 : .12;
    const roller = gantry(`gantry.roller.${r + 1}`, `Cradle roller ${r + 1} of four`, 'Runs beneath the rocking cradle.',
      'A brass roller, dark hub and off-center stripe show the display motion without a load rating.', [Math.sign(x) * .02, .01, 0], 'Brass roller and dark hub');
    roller.position.set(x, .965, .06 + z);
    cylinder(roller, 'brass', [0, 0, 0], .030, .12, [0, 0, Math.PI / 2]);
    cylinder(roller, 'dark', [0, 0, 0], .010, .135, [0, 0, Math.PI / 2]);
    plate(roller, 'dark', [.016, .018, 0], [.008, .020, .055]);
    add(roller, 'bolt', 'titanium', [0, 0, .072], [.009, .010, .009], [0, 0, Math.PI / 2], true);
    rollers.push(roller);
  }
  const winch = gantry('gantry.winch', 'Manual winch, brake and drum', 'Allows the display height to be adjusted.',
    'A brass drum, ratchet ring, dark brake and titanium service plate are mounted under the beam.', [0, .03, 0], 'Brass drum and dark steel');
  winch.position.set(.08, 1.06, .06);
  cylinder(winch, 'brass', [0, 0, 0], .050, .10, [0, 0, Math.PI / 2]);
  add(winch, 'ring', 'dark', [.040, 0, 0], [.072, .072, .072], [0, Math.PI / 2, 0]);
  plate(winch, 'titanium', [-.030, .060, .010], [.12, .018, .09]);
  for (let k = 0; k < 4; k++) add(winch, 'bolt', 'dark', [.058, .060 * Math.sin(k * TAU / 4 + .4), .060 * Math.cos(k * TAU / 4 + .4)], [.006, .008, .006], [0, 0, Math.PI / 2], true);
  const crank = gantry('gantry.crank', 'Winch crank and handle', 'Turns the winch drum by hand.',
    'A dark arm and brass grip rotate on the drum shaft beside the ratchet ring.', [0, .04, 0], 'Dark arm and brass grip');
  crank.position.set(.08, 1.06, .06);
  rod(crank, 'dark', [.070, 0, 0], [.070, -.115, .02], .006);
  rod(crank, 'brass', [.070, -.115, .02], [.070, -.115, .10], .008);
  add(crank, 'sphere', 'lens', [.070, -.115, .10], [.008, .008, .008]);
  for (const side of [-1, 1]) {
    const strap = gantry(`gantry.strap.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} safety strap`, 'Limits vertical travel if the cradle slips.',
      'A woven dark strap loops from the cradle to the beam through a brass adjuster and ring.', [side * .03, .02, 0], 'Dark webbing and brass adjuster');
    rod(strap, 'rubber', [side * .30, 1.02, -.03], [side * .30, 1.27, -.01], .010);
    add(strap, 'ring', 'brass', [side * .30, 1.15, -.02], [.024, .024, .024], [0, 0, 0]);
    plate(strap, 'brass', [side * .30, 1.05, -.02], [.030, .012, .028]);
  }

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.spine && state?.head && state?.rams) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;

    spineFrames.forEach((node, i) => {
      const link = pose.spine.links[i];
      node.position.fromArray(link.start);
      node.rotation.set(link.pitch, link.yaw, 0, 'YXZ');
    });
    tailFrames.forEach((node, i) => {
      const link = pose.tail.links[i];
      node.position.fromArray(link.start);
      node.rotation.set(link.pitch, link.yaw, 0, 'YXZ');
    });
    head.position.fromArray(pose.head.origin);
    head.rotation.set(pose.head.pitch, pose.head.yaw, 0, 'YXZ');
    lowerJaw.rotation.x = -pose.head.jaw;
    eyeNodes.forEach(record => record.node.rotation.set(pose.head.eyePitch, record.side * pose.head.eyeYaw, 0, 'YXZ'));
    jawRamNodes.forEach(record => { record.node.rotation.x = pose.head.jaw * 0.45; });
    ramNodes.forEach(record => {
      const ram = pose.rams.find(item => item.joint === record.joint && item.side === record.side);
      kit.aim(record.node, ram.a, ram.b); record.node.scale.set(1, ram.length, 1);
    });
    tendonNodes.forEach(record => {
      const tendon = pose.tendons.find(item => item.joint === record.joint);
      kit.aim(record.node, tendon.a, tendon.b); record.node.scale.set(1, tendon.length, 1);
    });
    gillFlaps.forEach(record => { record.node.rotation.y = record.side * pose.gills[record.index].opening; });
    pectorals.forEach((record, i) => {
      const fin = pose.fins[i];
      record.root.rotation.set(fin.roll, 0, record.side * fin.pitch, 'XYZ');
      record.blade.rotation.z = record.side * fin.blade;
      record.rays.forEach((ray, k) => { if (ray) ray.rotation.y = record.side * fin.rays[k]; });
    });
    pelvicFins.forEach(record => { record.node.rotation.z = record.side * (pose.pelvic[record.side < 0 ? 0 : 1].pitch); });
    dorsalHinge.rotation.z = -pose.dorsal.pitch;
    dorsalRam.rotation.x = pose.dorsal.pitch * 0.65;
    anal.rotation.z = pose.anal.pitch;
    upperLobe.rotation.x = pose.tailFin.upper;
    lowerLobe.rotation.x = pose.tailFin.lower;
    lobeHinge.rotation.x = pose.tailFin.fork * 0.25;
    hatch.rotation.x = 0.20 + 0.16 * Math.sin(pose.driveAngle + 1.35);
    cradle.rotation.z = 0.010 * Math.sin(pose.driveAngle);
    rocker.rotation.z = 0.018 * Math.sin(pose.driveAngle + 0.45);
    rollers.forEach((node, i) => { node.rotation.x = pose.driveAngle * 2.6 + i * 0.8; });
    winch.rotation.x = pose.driveAngle * 2.0;
    crank.rotation.x = pose.driveAngle * 2.0;
    kit.sync(options);
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
