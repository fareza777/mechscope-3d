import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample, distance } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('MAMMUT M4 · heavy quadruped and articulated trunk');
  kit.assemblies.rotation.y = Math.PI;
  const nodes = [], legs = [], trunkFrames = [], trunkRams = [], trunkCables = [];
  const tailFrames = [], tailRams = [], ears = [], tuskNodes = [], driveGears = [];
  const bodyRams = [], howdahStraps = [];
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
  const screw = (node, p, radius = .006) => kit.fasteners(node, [p], radius);
  const sleeve = (node, material, a, b, radius) => rod(node, material, a, b, radius, true);

  // ------------------------------------------------------------------ deep body
  const body = part('body.chassis', 'Deep barrel chassis and spinal rail', 'Torso structure',
    'Carries four heavy legs, the gimballed head and the counterweighted tail.',
    'A machined belly block, two domed flank shells and two longitudinal rails form the load spine.', undefined, [0, 0, 0], 'Titanium, dark alloy and formed shell');
  plate(body, 'dark', [0, .13, 0], [.72, .34, 1.34]);
  plate(body, 'titanium', [0, .305, 0], [.64, .05, 1.28]);
  plate(body, 'dark', [0, -.05, 0], [.62, .12, 1.22]);
  for (const side of [-1, 1]) {
    add(body, 'sphere', 'shell', [side * .19, .29, 0], [.32, .15, .68]);
    plate(body, 'titanium', [side * .33, .27, -.28], [.03, .10, .55], [0, 0, side * .18]);
    plate(body, 'shell', [side * .43, .17, .18], [.07, .28, .42], [0, 0, side * .05]);
    rod(body, 'copper', [side * .48, .13, -.48], [side * .48, .13, .56], .005, true);
  }
  for (let k = 0; k < 5; k++) plate(body, 'dark', [0, .335, -.48 + k * .24], [.60, .025, .055]);
  kit.fasteners(body, [[-.26, .28, -.54], [.26, .28, .54]], .013);

  const belly = part('body.belly', 'Armoured belly keel and undercarriage', 'Torso structure',
    'Adds a deep ventral mass and protects the lower rib ends and spinal core.',
    'A rounded shell belly, three dark skid plates, brass seam rails and two service lamps sit below the barrel.', body, [0, -.03, 0], 'Formed pale shell, dark alloy and brass');
  add(belly, 'sphere', 'shell', [0, -.01, 0], [.27, .15, .62]);
  plate(belly, 'dark', [0, -.115, 0], [.46, .07, 1.06]);
  for (const side of [-1, 1]) rod(belly, 'brass', [side * .22, -.10, -.50], [side * .22, -.10, .52], .008);
  for (let k = 0; k < 3; k++) plate(belly, 'titanium', [0, -.155, -.34 + k * .34], [.30, .018, .10], [0, 0, 0], true);
  for (const side of [-1, 1]) add(belly, 'sphere', 'lens', [side * .16, -.10, -.22], [.013, .013, .013], [0, 0, 0], true);

  for (let k = 0; k < 3; k++) {
    const hatch = part(`body.bellyHatch.${k + 1}`, `Belly service hatch ${k + 1} of three`, 'Service access',
      `Provides a bolted access panel on the ${['front', 'middle', 'rear'][k]} belly keel.`,
      'A pale shell hatch, brass hinge, two dark keepers and four fasteners sit over the spinal wiring.', body, [0, -.02, 0], 'Formed pale shell, brass hinge and dark keepers');
    plate(hatch, 'shell', [0, -.150, -.30 + k * .30], [.22, .020, .16]);
    plate(hatch, 'brass', [0, -.135, -.39 + k * .30], [.18, .014, .020]);
    for (const side of [-1, 1]) plate(hatch, 'dark', [side * .08, -.162, -.26 + k * .30], [.03, .012, .05]);
    kit.fasteners(hatch, [[0, -.150, -.25 + k * .30]], .0055);
  }

  const withers = part('body.withers', 'Shoulder hump and neck yoke', 'Torso structure',
    'Raises the shoulder line and gives the neck a visible socket.',
    'A domed pale shell, four shoulder rails and a bolted brass collar sit over the front ribs.', body, [0, .06, -.02], 'Formed pale alloy shell and brass collar');
  add(withers, 'sphere', 'shell', [0, .34, -.42], [.40, .18, .34]);
  for (const side of [-1, 1]) rod(withers, 'titanium', [side * .30, .28, -.70], [side * .30, .28, -.12], .016);
  for (const side of [-1, 1]) rod(withers, 'dark', [side * .13, .20, -.70], [side * .29, .36, -.44], .011);
  ringBoss(withers, [0, .47, -.58], .065, 'brass', 'z');
  kit.fasteners(withers, [[-.24, .42, -.48], [.24, .42, -.48]], .010);

  const haunch = part('body.haunch', 'Pelvic haunch and tail root', 'Torso structure',
    'Closes the rear of the barrel and carries the articulated tail bearing.',
    'A rounded pale haunch, three hip rails and a visible brass tail bearing cap close the rear.', body, [0, .05, .02], 'Formed pale alloy shell and brass bearing');
  add(haunch, 'sphere', 'shell', [0, .27, .48], [.36, .17, .30]);
  for (const side of [-1, 1]) rod(haunch, 'titanium', [side * .24, .22, .18], [side * .24, .22, .74], .015);
  for (const side of [-1, 1]) rod(haunch, 'dark', [side * .16, .14, .56], [side * .33, .32, .52], .012);
  ringBoss(haunch, [0, .34, .76], .050, 'brass', 'x');
  kit.fasteners(haunch, [[0, .34, .56]], .009);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const armor = part(`body.armor.${id}`, `${label} layered barrel armour`, 'Torso armour',
      'Gives the flank a deep layered shell instead of a flat slab.',
      'Three overlapping pale plates, a dark seam cassette, a copper run and four fasteners build each flank.', body, [side * .04, .02, 0], 'Formed pale alloy shell, dark seams and copper run');
    for (let k = 0; k < 3; k++) {
      plate(armor, 'shell', [side * .455, .19 - k * .015, -.36 + k * .36], [.055, .29, .27], [0, 0, side * .06]);
      plate(armor, 'shell', [side * .425, .06, -.34 + k * .36], [.045, .16, .24], [0, 0, side * .12]);
      plate(armor, 'dark', [side * .475, .17 - k * .015, -.18 + k * .36], [.016, .24, .025]);
    }
    rod(armor, 'copper', [side * .48, .31, -.52], [side * .48, .31, .50], .0045, true);
    kit.fasteners(armor, [[side * .45, .30, -.44], [side * .45, .30, .42]], .008);

    const shoulder = part(`body.shoulder.${id}`, `${label} shoulder armour and lift mount`, 'Torso armour',
      'Adds a layered pauldron over the front leg drive.',
      'A broad pale plate, dark under-pad, titanium brace and brass pin cover the shoulder gearbox.', body, [side * .05, .03, 0], 'Formed pale shell, dark pad and titanium brace');
    plate(shoulder, 'shell', [side * .34, .38, -.52], [.24, .075, .28], [0, 0, side * .16]);
    plate(shoulder, 'shell', [side * .38, .30, -.48], [.18, .11, .22], [0, 0, side * .22]);
    plate(shoulder, 'dark', [side * .37, .25, -.54], [.16, .07, .18]);
    rod(shoulder, 'titanium', [side * .22, .40, -.68], [side * .40, .40, -.35], .011);
    kit.fasteners(shoulder, [[side * .32, .42, -.60], [side * .36, .34, -.40]], .008);

    const hipArmor = part(`body.hipArmour.${id}`, `${label} haunch armour and hip cover`, 'Torso armour',
      'Closes the rear flank over the hip gearbox with a layered shell.',
      'Two overlapping pale plates, a dark undershell, brass strap and four fasteners wrap the rear hip.', body, [side * .05, .03, 0], 'Formed pale shell, dark undershell and brass strap');
    plate(hipArmor, 'shell', [side * .36, .34, .48], [.23, .075, .26], [0, 0, side * .18]);
    plate(hipArmor, 'shell', [side * .40, .24, .50], [.17, .13, .20], [0, 0, side * .24]);
    plate(hipArmor, 'dark', [side * .39, .17, .52], [.14, .07, .16]);
    rod(hipArmor, 'brass', [side * .30, .30, .36], [side * .30, .30, .64], .010, true);
    kit.fasteners(hipArmor, [[side * .33, .40, .44], [side * .37, .30, .60]], .008);
  }

  const spineDeck = part('body.spineDeck', 'Dorsal spinal deck and cable chase', 'Spine armor',
    'Connects the two shell domes while leaving every vertebral pin readable.',
    'A narrow pale deck, two titanium rails, five dark ribs and a copper chase run the whole back.', body, [0, .05, 0], 'Formed pale shell, titanium rails and copper chase');
  plate(spineDeck, 'shell', [0, .36, 0], [.15, .035, 1.16]);
  for (const side of [-1, 1]) rod(spineDeck, 'titanium', [side * .085, .395, -.56], [side * .085, .395, .56], .009);
  for (let k = 0; k < 5; k++) plate(spineDeck, 'dark', [0, .39, -.44 + k * .22], [.13, .014, .035], [0, 0, 0], true);
  rod(spineDeck, 'copper', [.04, .40, -.50], [.04, .40, .50], .0035, true);
  kit.fasteners(spineDeck, [[0, .37, -.44]], .007);

  for (let k = 0; k < 4; k++) {
    const cable = part(`body.cable.${k + 1}`, `Body service cable ${k + 1} of four`, 'Hydraulics and wiring',
      `Routes ${['shoulder', 'spinal', 'flank', 'haunch'][k]} power around a moving joint without crossing a leg arc.`,
      'A copper core, dark sleeve, brass clamps and two isolators follow the chassis frame.', body, [0, .02, 0], 'Copper core, dark sleeve and brass clamps');
    const side = k % 2 ? 1 : -1;
    rod(cable, 'copper', [side * .26, .16, -.58 + k * .30], [side * .31, .05, -.44 + k * .30], .006);
    rod(cable, 'rubber', [side * .26, .17, -.57 + k * .30], [side * .30, .06, -.45 + k * .30], .009, true);
    for (const y of [.16, .06]) add(cable, 'cylinder', 'brass', [side * .29, y, -.51 + k * .30], [.013, .012, .013], [0, 0, Math.PI / 2], true);
    add(cable, 'sphere', 'titanium', [side * .31, .05, -.44 + k * .30], [.010, .010, .010], [0, 0, 0], true);
  }

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const ram = part(`body.ram.${id}`, `${label} shoulder balance ram`, 'Hydraulics and wiring',
      'Shows the long-stroke balance actuator between the shoulder and belly rails.',
      'A dark pressure barrel, polished brass rod, two clevises and a rubber boot span the front frame.', body, [side * .07, .02, 0], 'Dark barrel, brass rod and rubber boot');
    ram.position.set(side * .23, .02, -.34);
    add(ram, 'cylinder', 'dark', [0, .16, 0], [.020, .20, .020]);
    add(ram, 'cylinder', 'brass', [0, .32, 0], [.010, .14, .010]);
    add(ram, 'sphere', 'rubber', [0, .265, 0], [.027, .020, .027]);
    add(ram, 'bolt', 'brass', [0, .40, 0], [.012, .014, .012]);
    add(ram, 'ring', 'titanium', [0, .08, 0], [.026, .026, .026], [Math.PI / 2, 0, 0]);
    bodyRams.push({ node: ram, side });
  }

  const collar = part('body.neckCollar', 'Neck collar and chest seam', 'Torso structure',
    'Bridges the barrel into the head gimbal with a visible bolted seam.',
    'A split pale collar, brass ring, dark gasket and four fasteners sit ahead of the withers.', body, [0, .05, -.02], 'Pale shell, brass ring and dark gasket');
  add(collar, 'ring', 'brass', [0, .28, -.80], [.20, .20, .20], [0, 0, 0]);
  add(collar, 'cylinder', 'shell', [0, .28, -.82], [.21, .06, .21], [Math.PI / 2, 0, 0]);
  add(collar, 'cylinder', 'rubber', [0, .28, -.855], [.18, .025, .18], [Math.PI / 2, 0, 0], true);
  kit.fasteners(collar, [[-.17, .37, -.82], [.17, .19, -.82]], .008);

  // Shoulder and hip gearboxes: four visible transfer cases with live gears.
  for (const front of [true, false]) for (const side of [-1, 1]) {
    const id = `${front ? 'F' : 'R'}${side < 0 ? 'L' : 'R'}`, label = `${front ? 'Front' : 'Rear'} ${side < 0 ? 'left' : 'right'}`;
    const drive = part(`drive.${id}`, `${label} ${front ? 'shoulder' : 'hip'} gearbox housing`, 'Gearboxes',
      'Transfers the leg reaction into the chassis rails through a bolted reduction case.',
      'A dark case, brass bearing ring, two side cheeks, vent ribs and four fasteners sit around the hip pin.', body, [side * .055, .03, 0], 'Dark case, brass bearing and titanium cheeks');
    drive.position.set(side * D.hipX, D.hipY, front ? D.hipFront : D.hipRear);
    plate(drive, 'dark', [0, .04, 0], [.22, .18, .20]);
    add(drive, 'cylinder', 'titanium', [0, 0, 0], [.075, .20, .075], [0, 0, Math.PI / 2]);
    ringBoss(drive, [0, 0, 0], .062, 'brass', 'x');
    for (const z of [-.06, .06]) plate(drive, 'dark', [side * .01, .09, z], [.10, .045, .03], [0, 0, 0], true);
    kit.fasteners(drive, [[side * .07, .12, 0]], .008);
    const gear = part(`drive.${id}.gear`, `${label} gearbox reduction gear`, 'Gearboxes',
      'Shows the final reduction gear turning with the walk cycle.',
      'A brass gear with fourteen teeth, a titanium rim, a dark hub and a centre bolt spins on the hip case.', drive, [side * .05, .06, 0], 'Brass gear, titanium rim and dark hub');
    gear.position.set(side * .075, .02, 0);
    kit.gear(gear, .085, 14, .030, 'brass');
    driveGears.push({ node: gear, side, front });
  }

  // ------------------------------------------------------------------ spine
  for (let i = 0; i < D.spineCount; i++) {
    const z = D.spineZ - i * D.spineLink;
    const vertebra = part(`spine.${i + 1}.frame`, `Thoracic vertebra ${i + 1} of eight`, 'Spine',
      `Keeps spinal pin ${i + 1} at the design ${Math.round(D.spineLink * 1000)} mm spacing.`,
      'A boxed body, two transverse processes, a neural spine and a brass pin form one rigid vertebra.', body, [0, .04, 0]);
    plate(vertebra, 'titanium', [0, D.spineY, z], [.17, .075, .12]);
    plate(vertebra, 'dark', [0, D.spineY + .055, z], [.11, .045, .085]);
    bore(vertebra, 'brass', [0, D.spineY, z], .020, .24, 'x');
    plate(vertebra, 'titanium', [0, D.spineY + .11, z], [.03, .07, .09], [0, 0, 0], true);
    for (const side of [-1, 1]) {
      rod(vertebra, 'dark', [side * .075, D.spineY, z], [side * .145, D.spineY + .035, z + .055], .013);
      add(vertebra, 'sphere', 'brass', [side * .145, D.spineY + .035, z + .055], [.012, .012, .012], [0, 0, 0], true);
    }
    screw(vertebra, [0, D.spineY + .15, z], .005);
  }
  for (let i = 0; i < D.spineCount; i++) {
    const scute = part(`spine.${i + 1}.scute`, `Dorsal spinal scute ${i + 1} of eight`, 'Spine armor',
      'Covers one vertebra with a raised shell while leaving every hinge pin exposed.',
      'A domed pale plate, brass isolator, dark rim and two fasteners ride above the neural spine.', body, [0, .08, .02], 'Formed pale alloy shell and brass isolator');
    add(scute, 'sphere', 'shell', [0, D.spineY + .145, D.spineZ - i * D.spineLink], [.19, .055, .095]);
    add(scute, 'cylinder', 'brass', [0, D.spineY + .10, D.spineZ - i * D.spineLink], [.016, .035, .016]);
    plate(scute, 'dark', [0, D.spineY + .16, D.spineZ - i * D.spineLink + .055], [.13, .012, .018], [0, 0, 0], true);
    kit.fasteners(scute, [[-.12, D.spineY + .155, D.spineZ - i * D.spineLink], [.12, D.spineY + .155, D.spineZ - i * D.spineLink]], .007);
  }
  for (const side of [-1, 1]) for (let r = 0; r < 8; r++) {
    const y = .02 + r * .045;
    const z = -.36 + r * .108;
    const label = side < 0 ? 'Left' : 'Right';
    const rib = part(`rib.${side < 0 ? 'L' : 'R'}.${r + 1}`, `${label} rib ${r + 1} of eight`, 'Rib cage',
      `Closes thoracic ring ${r + 1} with a deep curved rail instead of a solid chest wall.`,
      'Three tapered rails, a brass sternal pad and a dark lower strut leave the core and belly visible.', body, [side * .04, .02, 0]);
    rod(rib, 'titanium', [side * .10, .28, z], [side * .27, .20, z - .045], .016);
    rod(rib, 'titanium', [side * .27, .20, z - .045], [side * .40, .03, z - .11], .014);
    rod(rib, 'dark', [side * .40, .03, z - .11], [side * .34, -.075, z - .15], .009);
    plate(rib, 'brass', [side * .40, .02, z - .11], [.034, .028, .036]);
    add(rib, 'sphere', 'brass', [side * .34, -.075, z - .15], [.013, .013, .013], [0, 0, 0], true);
    const guide = part(`rib.${side < 0 ? 'L' : 'R'}.${r + 1}.guide`, `${label} rib guide ${r + 1}`, 'Rib cage',
      `Pads rib ${r + 1} where it passes the moving belly block.`,
      'A brass roller, rubber pad and titanium keeper sit between the lower rail and the keel without closing the gap.', rib, [side * .02, .02, 0], 'Brass roller, rubber pad and titanium keeper');
    add(guide, 'cylinder', 'brass', [side * .35, -.05, z - .13], [.015, .042, .015], [0, 0, Math.PI / 2]);
    add(guide, 'box', 'rubber', [side * .34, -.068, z - .13], [.024, .022, .038]);
    add(guide, 'box', 'titanium', [side * .32, -.02, z - .12], [.018, .045, .022], [0, 0, side * .2], true);
  }

  // ------------------------------------------------------------------ legs
  for (const leg of lastState.legs) {
    const label = `${leg.front ? 'Front' : 'Rear'} ${leg.side < 0 ? 'left' : 'right'}`, id = leg.id;
    const mount = part(`leg.${id}.mount`, `${label} leg mount and load yoke`, 'Leg drive',
      'Transfers the leg reaction into the chassis rails and gearbox.',
      'A bolted bearing block, two diagonal stays and a wide top plate clamp the leg yoke to the belly frame.', body, [leg.side * .06, .02, 0]);
    mount.position.fromArray(leg.hip);
    ringBoss(mount, [0, 0, 0], .065, 'titanium', 'x');
    for (const dz of [-.085, .085]) rod(mount, 'dark', [leg.side * .02, .03, dz], [leg.side * -.09, .16, dz], .014);
    plate(mount, 'titanium', [leg.side * -.04, .17, 0], [.16, .03, .14], [0, 0, leg.side * .10]);
    kit.fasteners(mount, [[leg.side * .05, .17, -.06], [leg.side * .05, .17, .06]], .009);

    const hip = part(`leg.${id}.hip`, `${label} hip bearing and pin`, 'Leg drive',
      'Locates the hip pitch axis on the chassis mount.',
      'A wide brass boss, two side retainers and a polished pin wrap the first bearing without hiding it.', body, [leg.side * .06, .02, 0]);
    hip.position.fromArray(leg.hip);
    ringBoss(hip, [0, 0, 0], .058, 'brass', 'x');
    add(hip, 'cylinder', 'titanium', [0, 0, 0], [.026, .245, .026], [0, 0, Math.PI / 2]);

    const hipArmor = part(`leg.${id}.hipArmor`, `${label} hip armour and service cap`, 'Leg drive',
      'Covers the hip bearing while leaving the pitch pin exposed.',
      'A pale shoulder cap, brass service plug and two isolators sit over the hip cheeks.', hip, [leg.side * .03, .02, 0], 'Formed pale alloy shell and brass plug');
    add(hipArmor, 'sphere', 'shell', [leg.side * .02, .06, -.02], [.10, .075, .08]);
    add(hipArmor, 'cylinder', 'brass', [leg.side * .07, .04, -.04], [.018, .055, .018], [0, 0, Math.PI / 2]);
    screw(hipArmor, [leg.side * .01, .115, .02], .006);

    const femur = part(`leg.${id}.femur`, `${label} femur truss`, 'Leg drive',
      'Carries the knee through the planted half of the gait.',
      'Four rails, two end rings, three braces and a copper service line keep the 480 mm link rigid.', body, [leg.side * .06, 0, 0]);
    for (const x of [-.042, .042]) rod(femur, 'titanium', [x, 0, 0], [x, D.femur, 0], .018);
    for (const z of [-.032, .032]) rod(femur, 'dark', [0, .03, z], [0, D.femur - .03, z], .012, true);
    ringBoss(femur, [0, 0, 0], .045, 'brass', 'x'); ringBoss(femur, [0, D.femur, 0], .042, 'titanium', 'x');
    for (const f of [.28, .52, .76]) rod(femur, 'dark', [-.045, D.femur * f, 0], [.045, D.femur * f, 0], .007, true);
    rod(femur, 'copper', [.05, .06, .035], [.05, D.femur - .05, .035], .0045, true);

    const femurArmor = part(`leg.${id}.femurShell`, `${label} femur armour column`, 'Leg drive',
      'Gives the upper leg a thick columnar silhouette over the truss.',
      'A domed pale shell, three overlapping plates, a dark rear pad, brass band and fasteners wrap the femur.', femur, [leg.side * .03, .03, 0], 'Formed pale shell, dark pad and brass band');
    add(femurArmor, 'sphere', 'shell', [0, .25, 0], [.135, .235, .105]);
    plate(femurArmor, 'shell', [0, .17, -.075], [.19, .25, .06], [0, 0, 0]);
    plate(femurArmor, 'shell', [0, .37, -.04], [.16, .12, .13], [0, 0, 0]);
    plate(femurArmor, 'dark', [0, .25, .075], [.12, .28, .035]);
    add(femurArmor, 'cylinder', 'brass', [0, .10, 0], [.075, .030, .075]);
    kit.fasteners(femurArmor, [[-.05, .40, .03], [.05, .40, .03], [0, .13, -.07]], .007);

    const femurRam = part(`leg.${id}.ram`, `${label} femur hydraulic ram`, 'Leg drive',
      'Shows the linear actuator that assists the femur.',
      'A dark pressure barrel, brass piston, rubber boot and two clevises ride beside the upper truss.', femur, [leg.side * .02, .01, 0], 'Dark barrel, brass piston and rubber boot');
    add(femurRam, 'cylinder', 'dark', [.075, .22, .02], [.020, .22, .020]);
    rod(femurRam, 'brass', [.075, .32, .02], [.075, .42, .02], .008);
    add(femurRam, 'sphere', 'rubber', [.075, .32, .02], [.026, .020, .026]);
    add(femurRam, 'bolt', 'brass', [.075, .03, .02], [.013, .016, .013]);
    screw(femurRam, [.075, .43, .02], .006);

    const tibia = part(`leg.${id}.tibia`, `${label} tibia truss`, 'Leg drive',
      'Transfers the knee solution to the ankle pin.',
      'Four rails, two rings, three braces and a service hose make the 480 mm lower link rigid.', body, [leg.side * .06, 0, 0]);
    for (const x of [-.040, .040]) rod(tibia, 'titanium', [x, 0, 0], [x, D.tibia, 0], .017);
    for (const z of [-.030, .030]) rod(tibia, 'dark', [0, .03, z], [0, D.tibia - .03, z], .011, true);
    ringBoss(tibia, [0, 0, 0], .044, 'brass', 'x'); ringBoss(tibia, [0, D.tibia, 0], .040, 'titanium', 'x');
    for (const f of [.28, .52, .76]) rod(tibia, 'dark', [-.043, D.tibia * f, 0], [.043, D.tibia * f, 0], .006, true);
    for (let k = 0; k < 3; k++) rod(tibia, 'copper', [.048, .10 + k * .13, .02], [.048, .22 + k * .13, .02], .004, true);

    const tibiaArmor = part(`leg.${id}.tibiaShell`, `${label} tibia armour column`, 'Leg drive',
      'Gives the lower leg a broad armoured silhouette without hiding the ankle pin.',
      'A tapered pale shell, two plates, a dark shin pad, brass band and fasteners wrap the tibia.', tibia, [leg.side * .03, .02, 0], 'Formed pale shell, dark shin pad and brass band');
    add(tibiaArmor, 'sphere', 'shell', [0, .21, 0], [.115, .205, .090]);
    plate(tibiaArmor, 'shell', [0, .16, -.065], [.165, .23, .055], [0, 0, 0]);
    plate(tibiaArmor, 'dark', [0, .20, .062], [.11, .25, .035]);
    plate(tibiaArmor, 'shell', [0, .36, -.02], [.14, .12, .11]);
    add(tibiaArmor, 'cylinder', 'brass', [0, .07, 0], [.064, .026, .064]);
    kit.fasteners(tibiaArmor, [[-.045, .35, .03], [.045, .35, .03]], .0065);

    const tibiaRam = part(`leg.${id}.tibiaRam`, `${label} tibia hydraulic ram`, 'Leg drive',
      'Shows the lower-leg assist actuator beside the tibia truss.',
      'A dark barrel, brass rod, rubber boot and two collars sit outside the truss envelope.', tibia, [leg.side * .02, .01, 0], 'Dark barrel, brass rod and rubber boot');
    add(tibiaRam, 'cylinder', 'dark', [.07, .19, .02], [.017, .20, .017]);
    rod(tibiaRam, 'brass', [.07, .29, .02], [.07, .38, .02], .007);
    add(tibiaRam, 'sphere', 'rubber', [.07, .29, .02], [.023, .017, .023]);
    screw(tibiaRam, [.07, .39, .02], .0055);

    const knee = part(`leg.${id}.knee`, `${label} knee hinge and guard`, 'Leg drive',
      'Defines the single knee pitch axis and protects the pin.',
      'A brass pin, two outboard retainers, a pale guard plate and a dark pad clamp the joint.', body, [leg.side * .05, 0, 0]);
    ringBoss(knee, [0, 0, 0], .050, 'brass', 'x');
    add(knee, 'sphere', 'shell', [0, 0, -.055], [.055, .055, .020]);
    plate(knee, 'dark', [0, .01, .055], [.08, .07, .02]);
    screw(knee, [0, .06, -.02], .006);

    const metatarsus = part(`leg.${id}.metatarsus`, `${label} 140 mm metatarsal link`, 'Foot support',
      'Holds the sole at a fixed offset from the ankle.',
      'A rigid pair of rails, two clevises and a brass collar preserve the ankle-to-sole distance.', body, [leg.side * .05, 0, 0]);
    for (const x of [-.018, .018]) rod(metatarsus, 'titanium', [x, 0, 0], [x, Math.hypot(...D.ankleLift), 0], .008);
    for (const y of [0, Math.hypot(...D.ankleLift)]) ringBoss(metatarsus, [0, y, 0], .030, y ? 'titanium' : 'brass', 'x');
    rod(metatarsus, 'copper', [.025, .02, 0], [.025, Math.hypot(...D.ankleLift) - .02, 0], .003, true);

    const foot = part(`leg.${id}.foot`, `${label} wide foot and sole`, 'Foot support',
      'Provides one level, wide contact plate under each columnar leg.',
      'A broad machined sole, rubber tread, brass ankle collar, dark heel block and two toe caps stay parallel to the floor.', body, [leg.side * .05, .02, 0], 'Titanium sole, rubber tread and brass collar');
    plate(foot, 'dark', [0, -.022, -.025], [.30, .048, .38]);
    plate(foot, 'rubber', [0, -.050, -.030], [.285, .016, .36]);
    plate(foot, 'titanium', [0, .005, -.10], [.27, .030, .20]);
    add(foot, 'cylinder', 'brass', [0, .025, 0], [.055, .060, .055]);
    plate(foot, 'dark', [0, -.005, .145], [.22, .060, .09]);
    for (const side of [-1, 1]) plate(foot, 'brass', [side * .09, -.012, -.205], [.08, .024, .07], [0, 0, 0], true);
    kit.fasteners(foot, [[-.11, .02, -.14], [.11, .02, -.14]], .007);

    const toes = part(`leg.${id}.toes`, `${label} four toe pads and wear plates`, 'Foot support',
      'Extends the foot forward with four separately bolted toe pads.',
      'Four titanium toe plates, two rubber pads and four brass rivets fan from the sole front.', foot, [leg.side * .04, .02, 0], 'Titanium toe plates, rubber pads and brass rivets');
    for (let k = 0; k < 4; k++) {
      const x = -.105 + k * .07;
      plate(toes, 'titanium', [x, -.020, -.235], [.060, .028, .085], [0, 0, 0], k % 2 === 1);
      add(toes, 'sphere', 'rubber', [x, -.040, -.27], [.024, .012, .020], [0, 0, 0], true);
    }

    const servicePanel = part(`leg.${id}.servicePanel`, `${label} leg service panel`, 'Service access',
      'Provides a bolted inspection hatch on the upper leg drive.',
      'A pale rectangular panel, dark seal, brass latch and two fasteners sit between the femur rails.', femur, [leg.side * .025, .02, 0], 'Pale shell panel, dark seal and brass latch');
    plate(servicePanel, 'shell', [0, .50, -.085], [.11, .13, .020]);
    plate(servicePanel, 'dark', [0, .50, -.070], [.09, .11, .010]);
    plate(servicePanel, 'brass', [0, .445, -.088], [.05, .018, .012]);
    kit.fasteners(servicePanel, [[-.035, .55, -.085], [.035, .55, -.085]], .005);

    legs.push({ id, hip, femur, femurArmor, femurRam, knee, tibia, tibiaArmor, tibiaRam, metatarsus, foot, toes });
  }

  // ------------------------------------------------------------------ head
  const head = part('head.carrier', 'Head gimbal and cranial carrier', 'Head structure',
    'Carries the skull, ears, tusks and the base of the trunk.',
    'A transverse gimbal ring, two side plates and a dark neck saddle support the cranium above the neck socket.', body, [0, .06, -.1], 'Titanium and brass');
  head.position.fromArray(lastState.head.origin);
  ringBoss(head, [0, 0, 0], .058, 'brass', 'x');
  for (const side of [-1, 1]) rod(head, 'titanium', [side * .10, .01, -.02], [side * .16, -.06, -.10], .012);
  plate(head, 'dark', [0, -.02, -.02], [.26, .06, .12]);

  const cranium = part('head.cranium', 'Cranial shell and brow', 'Head structure',
    'Protects the sensor apertures and anchors both tusk roots and the trunk socket.',
    'A rounded pale skull, a second brow shell, a dark visor, two cheek rails and a bolted top plate leave the underside open.', head, [0, .03, -.03], 'Formed pale alloy shell');
  add(cranium, 'sphere', 'shell', [0, .08, .01], [.195, .155, .215]);
  add(cranium, 'sphere', 'shell', [0, .20, -.03], [.145, .080, .145]);
  plate(cranium, 'dark', [0, .06, -.19], [.26, .10, .06]);
  plate(cranium, 'shell', [0, .17, -.16], [.20, .040, .13], [-.3, 0, 0]);
  for (const side of [-1, 1]) rod(cranium, 'titanium', [side * .13, .02, -.12], [side * .21, -.04, -.20], .017);
  kit.fasteners(cranium, [[-.10, .18, -.04], [.10, .18, -.04], [0, .22, .02]], .011);

  const brow = part('head.brow', 'Brow visor and sensor bar', 'Head structure',
    'Gives the head a heavy mechanical brow above the optics.',
    'A dark visor plate, two brass sensor pods, a teal status lens and four fasteners sit over the eyes.', head, [0, .05, -.04], 'Dark visor, brass pods and teal lens');
  plate(brow, 'dark', [0, .18, -.155], [.28, .055, .10], [-.15, 0, 0]);
  for (const side of [-1, 1]) add(brow, 'cylinder', 'brass', [side * .105, .20, -.15], [.020, .045, .020], [0, 0, Math.PI / 2]);
  add(brow, 'sphere', 'lens', [0, .225, -.12], [.020, .015, .018]);
  kit.fasteners(brow, [[0, .21, -.10]], .006);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const cheek = part(`head.cheek.${id}`, `${label} cheek armor and hinge cover`, 'Head structure',
      'Adds a visible cheek plate around the tusk root and jaw hinge.',
      'A pale plate, dark pad, titanium rail and two fasteners cover the side of the jaw without hiding the eye.', head, [side * .07, .02, 0], 'Formed pale alloy shell and dark pad');
    plate(cheek, 'shell', [side * .185, -.02, -.09], [.06, .12, .16], [0, 0, side * .25]);
    plate(cheek, 'dark', [side * .205, -.055, -.15], [.025, .07, .08]);
    rod(cheek, 'titanium', [side * .14, .06, -.06], [side * .20, -.10, -.16], .008);
    kit.fasteners(cheek, [[side * .18, .05, -.04], [side * .19, -.09, -.12]], .006);

    const optic = part(`head.optic.${id}`, `${label} eye and brow lamp`, 'Head optics',
      'Marks the forward visual reference beside the trunk base.',
      'A teal lens in a brass ring on a dark pad; no vision processing is implied.', head, [side * .13, .06, 0], 'Dark pad, brass bezel and teal glass');
    add(optic, 'sphere', 'dark', [side * .155, .08, -.165], [.060, .055, .040]);
    add(optic, 'sphere', 'lens', [side * .160, .095, -.190], [.043, .043, .028]);
    ringBoss(optic, [side * .160, .095, -.182], .052, 'brass', 'z');

    const socket = part(`head.tuskSocket.${id}`, `${label} tusk socket`, 'Head structure',
      'Anchors the rigid tusk to the cranium with a replaceable bushing.',
      'A brass ring, two cheek bolts and a dark elastomer pad clamp the first tusk segment.', head, [side * .10, .01, 0], 'Brass ring, dark pad and titanium bolts');
    socket.position.set(side * .14, -.01, -.13);
    ringBoss(socket, [0, 0, 0], .050, 'brass', 'x');
    add(socket, 'cylinder', 'rubber', [side * .035, 0, -.02], [.038, .022, .038], [0, 0, Math.PI / 2]);
    screw(socket, [0, .07, 0], .007);

    const collar = part(`head.tuskCollar.${id}`, `${label} tusk root collar`, 'Head structure',
      'Adds a second bolted collar at the visible root of the tusk.',
      'A heavy brass ring, pale clamp shoe, rubber gasket and two fasteners sleeve the first tusk segment.', cranium, [side * .08, .01, 0], 'Brass ring, pale clamp and rubber gasket');
    collar.position.set(side * .15, -.015, -.16);
    add(collar, 'ring', 'brass', [0, 0, 0], [.052, .052, .052], [0, Math.PI / 2, 0]);
    plate(collar, 'shell', [side * .02, .025, .03], [.055, .045, .09]);
    add(collar, 'cylinder', 'rubber', [side * .01, -.02, .05], [.036, .020, .036], [Math.PI / 2, 0, 0], true);
    kit.fasteners(collar, [[side * .02, .05, .04], [side * .02, -.03, .10]], .005);

    const tusk = part(`head.tusk.${id}`, `${label} long curved tusk`, 'Head structure',
      'Shows a rigid tapered tusk anchored to the cranium.',
      'Eight tapered pale segments curve forward and up from the collar, with a dark root band and a brass wear tip.', cranium, [side * .15, -.03, -.08], 'Pale alloy, dark band and brass tip');
    tusk.position.set(side * .15, -.015, -.17);
    let a = [0, 0, 0];
    for (let k = 0; k < 8; k++) {
      const t = (k + 1) / 8;
      const b = [side * (.10 * t - .07 * t * t), -.02 - .22 * Math.sin(t * 2.0) + .10 * t * t, -.84 * t];
      rod(tusk, k < 6 ? 'shell' : k === 6 ? 'brass' : 'brass', a, b, .048 - k * .0035);
      if (k === 0) add(tusk, 'cylinder', 'dark', [b[0], b[1] + .02, b[2] + .06], [.050, .035, .050], [Math.PI / 2, 0, 0], true);
      a = b;
    }
    add(tusk, 'cone', 'brass', [a[0], a[1] + .02, a[2] - .01], [.014, .06, .014], [Math.PI / 2, 0, 0]);
    const tip = part(`head.tuskTip.${id}`, `${label} tusk wear tip and keeper`, 'Head structure',
      'Adds a replaceable polished tip and keeper band at the end of the tusk.',
      'A brass cone, titanium keeper ring and dark wear collar cap the last tusk segment.', tusk, [side * .05, -.02, 0], 'Brass cone, titanium keeper and dark collar');
    add(tip, 'cone', 'brass', [a[0], a[1] + .045, a[2] - .02], [.020, .085, .020], [Math.PI / 2, 0, 0]);
    add(tip, 'ring', 'titanium', [a[0], a[1] - .06, a[2] + .05], [.040, .040, .040], [0, 0, Math.PI / 2]);
    add(tip, 'cylinder', 'rubber', [a[0], a[1] - .10, a[2] + .09], [.030, .022, .030], [Math.PI / 2, 0, 0], true);
    tuskNodes.push({ node: tusk, side, tip });

    const hinge = part(`head.ear.${id}.hinge`, `${label} ear hinge and trunnion`, 'Ear drive',
      'Carries the ear pivot and the flare actuator on the side of the skull.',
      'A dark hinge block, brass trunnion, two titanium cheeks and a rubber bumper sit at the ear pivot.', head, [side * .12, .04, 0], 'Dark block, brass trunnion and rubber bumper');
    hinge.position.set(side * .15, .09, -.01);
    ringBoss(hinge, [0, 0, 0], .038, 'brass', 'z');
    plate(hinge, 'dark', [side * .02, -.03, .01], [.07, .07, .06]);
    add(hinge, 'sphere', 'rubber', [side * .04, .02, -.02], [.020, .020, .020], [0, 0, 0], true);

    const ear = part(`head.ear.${id}`, `${label} ear fan frame`, 'Ear drive',
      'Exposes a large ear surface on a real hinge without an opaque slab.',
      'Six titanium ribs, four dark cross braces, a brass rim and a pale root plate form a fan that turns on the pivot.', hinge, [side * .16, .04, .02], 'Titanium ribs, dark braces, brass rim and pale plate');
    for (let k = 0; k < 6; k++) rod(ear, 'titanium', [0, 0, 0], [side * (.30 + k * .045), .04 + k * .055, .06 + k * .045], .012);
    for (let k = 0; k < 4; k++) rod(ear, 'dark', [side * (.12 + k * .035), .01 + k * .03, .02], [side * (.26 + k * .05), .10 + k * .045, .15 + k * .04], .006, true);
    for (let k = 0; k < 3; k++) plate(ear, 'shell', [side * (.13 + k * .055), .08 + k * .05, .08 + k * .045], [.24 - k * .03, .075, .016], [0, side * .18, side * (.40 + k * .13)]);
    rod(ear, 'brass', [0, 0, 0], [side * .38, .34, .30], .007);
    ears.push({ node: ear, side, tip: null });

    const panel = part(`head.ear.${id}.panel`, `${label} ear outer membrane panel`, 'Ear drive',
      'Adds a layered outer ear membrane that trails the fan ribs.',
      'Two offset pale plates, a brass edge wire and three dark tension cords hinge behind the main fan.', ear, [side * .18, .05, 0], 'Pale shell membrane, brass edge and dark cords');
    for (let k = 0; k < 2; k++) plate(panel, 'shell', [side * (.20 + k * .06), .13 + k * .045, .15 + k * .02], [.26 - k * .04, .15, .018], [0, side * .22, side * (.52 + k * .12)]);
    rod(panel, 'brass', [side * .12, .06, .06], [side * .44, .36, .26], .0055);
    for (let k = 0; k < 3; k++) rod(panel, 'dark', [side * .16, .10 + k * .05, .10], [side * .40, .30 + k * .03, .24], .0025, true);

    const tipPanel = part(`head.ear.${id}.tip`, `${label} ear tip vane and counterweight`, 'Ear drive',
      'Completes the large ear silhouette with a hinged outer vane.',
      'A pale tip vane, brass counterweight and two dark cords turn about the ear outer rib.', ear, [side * .20, .06, 0], 'Pale vane, brass counterweight and dark cords');
    plate(tipPanel, 'shell', [side * .44, .26, .22], [.11, .20, .020], [0, side * .30, side * .62]);
    add(tipPanel, 'sphere', 'brass', [side * .30, .14, .14], [.020, .020, .020]);
    for (let k = 0; k < 2; k++) rod(tipPanel, 'dark', [side * .30, .18 + k * .04, .15], [side * .46, .28 + k * .03, .24], .002, true);
    ears[ears.length - 1].tip = tipPanel;

    const earRam = part(`head.ear.${id}.ram`, `${label} ear flare actuator`, 'Ear drive',
      'Shows the short hydraulic actuator behind the ear hinge.',
      'A dark barrel, brass rod, rubber boot and two clevises sit between the skull and the ear frame.', head, [side * .13, .05, 0], 'Dark barrel, brass rod and rubber boot');
    earRam.position.set(side * .18, .02, .05);
    add(earRam, 'cylinder', 'dark', [0, .05, 0], [.014, .09, .014], [0, 0, side * .4]);
    rod(earRam, 'brass', [0, .10, 0], [0, .17, 0], .0055);
    add(earRam, 'sphere', 'rubber', [0, .10, 0], [.018, .014, .018]);
  }

  const jaw = part('head.jaw', 'Lower mandible and molar block', 'Head structure',
    'Closes the mouth beneath the trunk socket and carries the lower molars.',
    'A broad dark jaw, brass molar rail, four pale teeth and a transverse hinge pin pivot below the cranium.', head, [0, .02, -.08], 'Dark alloy, brass rail and pale teeth');
  plate(jaw, 'dark', [0, -.135, -.17], [.24, .07, .22]);
  plate(jaw, 'brass', [0, -.105, -.22], [.17, .028, .11]);
  bore(jaw, 'titanium', [0, -.08, -.10], .014, .18, 'x');
  for (let k = 0; k < 4; k++) add(jaw, 'cone', 'shell', [-.075 + k * .05, -.09, -.24], [.012, .035, .012], [Math.PI, 0, 0], true);
  kit.fasteners(jaw, [[-.08, -.13, -.08], [.08, -.13, -.08]], .006);

  for (const side of [-1, 1]) {
    const label = side < 0 ? 'Left' : 'Right';
    const cable = part(`head.cable.${side < 0 ? 'L' : 'R'}`, `${label} cranial power and coolant cable`, 'Hydraulics and wiring',
      'Routes head power and coolant between the neck collar and the optic pod.',
      'A copper core, dark sleeve, two brass clamps and a rubber grommet follow the side of the skull.', head, [side * .08, .04, 0], 'Copper core, dark sleeve and brass clamps');
    rod(cable, 'copper', [side * .17, .02, -.17], [side * .22, .15, -.04], .005);
    rod(cable, 'rubber', [side * .17, .02, -.17], [side * .22, .15, -.04], .008, true);
    for (const y of [.04, .12]) add(cable, 'cylinder', 'brass', [side * (.18 + y * .25), y, -.13 + y * .55], [.011, .010, .011], [0, 0, Math.PI / 2], true);
  }

  const trunkBase = part('trunk.base', 'Trunk socket and hydraulic collar', 'Trunk drive',
    'Anchors the fourteen-link trunk to the skull.',
    'A wide bearing collar, two side actuators, a brass pin ring and a rubber boot hold the first trunk pin.', body, [0, .04, -.02], 'Titanium, brass and hydraulic seals');
  trunkBase.position.fromArray(D.trunkBase);
  ringBoss(trunkBase, [0, 0, 0], .085, 'titanium', 'x');
  add(trunkBase, 'cone', 'shell', [0, -.055, -.02], [.095, .13, .095], [Math.PI, 0, 0]);
  add(trunkBase, 'cylinder', 'rubber', [0, -.10, -.03], [.082, .030, .082], [Math.PI / 2, 0, 0], true);
  for (const side of [-1, 1]) {
    bore(trunkBase, 'brass', [side * .095, -.01, .035], .019, .060, 'z');
    rod(trunkBase, 'copper', [side * .10, .04, .02], [side * .06, -.08, -.02], .004, true);
  }
  screw(trunkBase, [0, .07, .02], .008);

  // ------------------------------------------------------------------ trunk
  for (let i = 0; i < D.trunkCount; i++) {
    const frame = part(`trunk.${i + 1}.frame`, `Trunk link ${i + 1} of fourteen`, 'Trunk drive',
      `Preserves trunk link ${i + 1} at exactly ${Math.round(D.trunkLink * 1000)} mm.`,
      'Paired rails, two brass pins, a central tendon guide and a copper run form one rigid trunk link.', body, [0, .05, -.01]);
    for (const x of [-.024, .024]) rod(frame, 'titanium', [x, 0, 0], [x, D.trunkLink, 0], .009);
    bore(frame, 'brass', [0, 0, 0], .019, .078, 'x');
    bore(frame, 'titanium', [0, D.trunkLink, 0], .017, .072, 'x');
    rod(frame, 'copper', [0, .015, .024], [0, D.trunkLink - .012, .024], .004, true);
    rod(frame, 'dark', [0, .010, -.024], [0, D.trunkLink - .010, -.024], .005, true);
    screw(frame, [0, .035, .030], .004);
    const band = part(`trunk.${i + 1}.band`, `Trunk armored band ${i + 1}`, 'Trunk armor',
      'Gives the trunk a thick segmented skin without hiding the pins.',
      'A pale outer band, a dark underside, two brass wear rings and fasteners overlap the flexible joint.', frame, [0, .02, .02], 'Formed pale alloy shell and dark rubber');
    const r = .086 - i * .0028;
    add(band, 'ring', 'shell', [0, D.trunkLink * .5, 0], [r, r, r], [Math.PI / 2, 0, 0]);
    add(band, 'ring', 'rubber', [0, D.trunkLink * .5, 0], [r * .80, r * .80, r * .80], [Math.PI / 2, 0, 0], true);
    add(band, 'cylinder', 'brass', [0, .012, 0], [r * .82, .020, r * .82], [Math.PI / 2, 0, 0], true);
    kit.fasteners(band, [[0, D.trunkLink * .5, r * .82]], .005);
    trunkFrames.push({ node: frame, index: i });
    if (i < D.trunkCount - 1) {
      for (const side of [-1, 1]) {
        const ram = part(`trunk.${i + 1}.ram.${side < 0 ? 'L' : 'R'}`, `Trunk joint ${i + 1} ${side < 0 ? 'left' : 'right'} ram`, 'Trunk drive',
          `Shows the short actuator that controls trunk joint ${i + 1}.`,
          'A dark sleeve with a brass piston is stretched between the two sampled link frames; only the joint angle changes.', body, [side * .02, .03, 0], 'Dark sleeve and brass piston');
        add(ram, 'cylinder', 'dark', [0, .5, 0], [.010, 1, .010]);
        add(ram, 'cylinder', 'brass', [0, .82, 0], [.006, .18, .006], [0, 0, 0], true);
        trunkRams.push({ node: ram, joint: i, side });
      }
      const cable = part(`trunk.${i + 1}.cable`, `Trunk tendon cable ${i + 1}`, 'Trunk drive',
        `Carries the visible tendon run across trunk joint ${i + 1}.`,
        'A copper tendon with a dark sleeve and brass ferrules follows the joint without changing its rigid link length.', body, [0, .04, 0], 'Copper tendon, dark sleeve and brass ferrules');
      rod(cable, 'copper', [0, 0, 0], [0, 1, 0], .0035);
      add(cable, 'cylinder', 'dark', [.008, .5, 0], [.0026, 1, .0026], [0, 0, 0], true);
      add(cable, 'bolt', 'brass', [0, 0, 0], [.010, .018, .010]);
      trunkCables.push({ node: cable, joint: i });
    }
  }
  const tip = part('trunk.tip', 'Trunk tip hub and opposed grasp pads', 'Trunk drive',
    'Ends the articulated trunk with two opposed service pads and a brass hub.',
    'A brass hub, two rubber-tipped fingers, a titanium keeper and a teal sensor jewel stay rigid while the links articulate.', body, [0, .04, 0], 'Brass hub, rubber pads and titanium keeper');
  tip.position.fromArray(lastState.trunk.points[D.trunkCount]);
  ringBoss(tip, [0, 0, 0], .038, 'brass', 'x');
  add(tip, 'sphere', 'lens', [0, .035, -.02], [.016, .016, .016]);
  for (const side of [-1, 1]) {
    const finger = part(`trunk.tip.finger.${side < 0 ? 'L' : 'R'}`, `Trunk ${side < 0 ? 'left' : 'right'} grasp finger`, 'Trunk drive',
      'Adds an opposed fingertip pad for the curling trunk.',
      'A titanium finger, dark knuckle and rubber pad open from the hub without touching the tusk.', tip, [side * .04, .02, 0], 'Titanium finger, dark knuckle and rubber pad');
    rod(finger, 'titanium', [0, 0, 0], [side * .055, -.115, .025], .009);
    add(finger, 'sphere', 'dark', [0, 0, 0], [.020, .020, .020]);
    add(finger, 'sphere', 'rubber', [side * .055, -.12, .03], [.018, .026, .014]);
  }

  // ------------------------------------------------------------------ tail
  const tailRoot = part('tail.base', 'Tail root bearing and guard', 'Tail',
    'Carries the seven-link tail on a visible transverse bearing.',
    'A dark hub, brass tail pin, two titanium keepers and a pale root guard sit behind the haunch.', body, [0, .04, .02], 'Dark hub, brass pin and pale guard');
  tailRoot.position.fromArray(D.tailBase);
  ringBoss(tailRoot, [0, 0, 0], .072, 'brass', 'x');
  add(tailRoot, 'sphere', 'shell', [0, .015, .02], [.09, .06, .07]);
  for (let i = 0; i < D.tailCount; i++) {
    const frame = part(`tail.${i + 1}.frame`, `Tail vertebra ${i + 1} of seven`, 'Tail',
      `Keeps tail pin ${i + 1} at the design ${Math.round(D.tailLink * 1000)} mm spacing.`,
      'A tapered ring pair, four rails, a neural blade and two service lines form one rigid tail link.', body, [0, .04, .02]);
    for (const z of [0, D.tailLink]) {
      const r = .080 - i * .007;
      ringBoss(frame, [0, z, 0], r, z === 0 ? 'titanium' : 'brass', 'y');
    }
    for (const x of [-.030, .030]) rod(frame, 'dark', [x, 0, 0], [x, D.tailLink, 0], .007);
    plate(frame, 'titanium', [0, D.tailLink * .5, .035], [.09, .09, .06]);
    rod(frame, 'copper', [.035, .02, .015], [.035, D.tailLink - .015, .015], .0035, true);
    screw(frame, [0, D.tailLink * .5, .075], .0045);
    const scute = part(`tail.${i + 1}.scute`, `Tail dorsal scute ${i + 1}`, 'Tail armor',
      'Covers one tail link without closing the pin gap.',
      'A short pale plate, dark rim, brass isolator and two fasteners ride on the frame and follow every pitch command.', frame, [0, .02, 0], 'Formed pale alloy shell');
    add(scute, 'sphere', 'shell', [0, D.tailLink * .5, .060], [.062 - i * .004, .090, .030]);
    plate(scute, 'dark', [0, D.tailLink * .5, .080], [.06, .06, .012], [0, 0, 0], true);
    kit.fasteners(scute, [[-.035, D.tailLink * .5, .075], [.035, D.tailLink * .5, .075]], .0045);
    tailFrames.push({ node: frame, index: i });
    if (i < 3) {
      const ram = part(`tail.${i + 1}.ram`, `Tail joint ${i + 1} ram`, 'Tail',
        `Shows the short actuator across tail joint ${i + 1}.`,
        'A dark sleeve and brass piston stretch between the sampled tail frames; only the joint pitch changes.', body, [0, .03, 0], 'Dark sleeve and brass piston');
      add(ram, 'cylinder', 'dark', [0, .5, 0], [.008, 1, .008]);
      add(ram, 'cylinder', 'brass', [0, .82, 0], [.005, .18, .005], [0, 0, 0], true);
      tailRams.push({ node: ram, joint: i });
    }
  }
  const tuft = part('tail.tuft', 'Tail tuft hub and counterweight', 'Tail',
    'Terminates the seven-link tail with a visible counterweight.',
    'A bolted brass hub, pale cap and four separated dark bristle rods close the chain.', body, [0, .04, .02], 'Brass hub and dark bristles');
  tuft.position.fromArray(lastState.tail.points[D.tailCount]);
  ringBoss(tuft, [0, 0, 0], .040, 'brass', 'y');
  add(tuft, 'sphere', 'shell', [0, .02, .01], [.035, .05, .035]);
  const bristles = part('tail.bristles', 'Tail bristle fan and wear ring', 'Tail',
    'Adds a fan of four dark bristle rods and a brass wear ring to the tail tip.',
    'Four separated rods and a brass ring ride the final hub without changing the chain length.', tuft, [0, .04, 0], 'Dark bristle rods and brass ring');
  for (let k = 0; k < 4; k++) rod(bristles, 'dark', [0, 0, 0], [.055 * Math.cos(k * TAU / 4), -.13, .055 * Math.sin(k * TAU / 4)], .005);
  add(bristles, 'ring', 'brass', [0, .01, 0], [.035, .035, .035], [Math.PI / 2, 0, 0]);
  const bristleTips = part('tail.bristleTips', 'Tail bristle ferrules', 'Tail',
    'Caps each bristle with a small brass ferrule and rubber sleeve.',
    'Four brass ferrules and four rubber sleeves sit at the bristle ends but do not change the tail link spacing.', bristles, [0, .05, 0], 'Brass ferrules and rubber sleeves');
  for (let k = 0; k < 4; k++) {
    const x = .055 * Math.cos(k * TAU / 4), z = .055 * Math.sin(k * TAU / 4);
    add(bristleTips, 'bolt', 'brass', [x, -.125, z], [.010, .018, .010]);
    add(bristleTips, 'sphere', 'rubber', [x, -.145, z], [.009, .014, .009], [0, 0, 0], true);
  }

  // ------------------------------------------------------------------ howdah
  const howdah = part('howdah.frame', 'Howdah load frame and strap saddles', 'Howdah',
    'Gives the mammoth a bolted riding platform without hiding the spine.',
    'A dark ladder frame, four load feet, two brass rails and eight fasteners sit above the dorsal scutes.', body, [0, .08, .02], 'Dark frame, brass rails and titanium feet');
  howdah.position.set(0, .40, .06);
  plate(howdah, 'dark', [0, .02, 0], [.62, .06, .64]);
  for (const side of [-1, 1]) plate(howdah, 'titanium', [side * .25, .06, 0], [.055, .05, .58]);
  for (const z of [-.27, .27]) plate(howdah, 'brass', [0, .06, z], [.58, .025, .04]);
  for (const x of [-.24, .24]) for (const z of [-.24, .24]) plate(howdah, 'titanium', [x, -.02, z], [.06, .06, .06], [0, 0, 0], true);
  kit.fasteners(howdah, [[-.27, .06, -.27], [.27, .06, .27]], .008);

  const howdahDeck = part('howdah.deck', 'Layered howdah deck and cargo bed', 'Howdah',
    'Provides a broad layered platform for the riding howdah.',
    'Three pale deck planks, a dark under-bed, two brass seam rails and four fasteners form the floor.', howdah, [0, .1, 0], 'Formed pale deck, dark under-bed and brass seams');
  plate(howdahDeck, 'dark', [0, .055, 0], [.56, .03, .58]);
  for (let k = 0; k < 3; k++) plate(howdahDeck, 'shell', [0, .075, -.19 + k * .19], [.52, .025, .175]);
  for (const side of [-1, 1]) rod(howdahDeck, 'brass', [side * .25, .09, -.26], [side * .25, .09, .26], .006);
  kit.fasteners(howdahDeck, [[0, .09, -.24]], .006);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const rail = part(`howdah.rail.${id}`, `${label} howdah railing and posts`, 'Howdah',
      'Gives the platform a layered safety rail made from stock mechanical tube.',
      'Two titanium tubes, three vertical posts, brass caps and a dark lower rail sit on the deck edge.', howdahDeck, [side * .12, .08, 0], 'Titanium tubes, brass caps and dark rail');
    for (let k = 0; k < 3; k++) rod(rail, 'titanium', [side * .29, .10, -.24 + k * .24], [side * .29, .32, -.24 + k * .24], .008);
    rod(rail, 'titanium', [side * .29, .32, -.26], [side * .29, .32, .26], .009);
    rod(rail, 'dark', [side * .29, .18, -.26], [side * .29, .18, .26], .005, true);
    for (const z of [-.26, 0, .26]) add(rail, 'sphere', 'brass', [side * .29, .33, z], [.014, .014, .014]);
    const strap = part(`howdah.strap.${id}`, `${label} howdah tie-down strap`, 'Howdah',
      'Shows the broad strap that ties the platform to the barrel.',
      'A rubber webbing loop, brass tensioner and two keeper plates run from the deck to the flank shell.', howdahDeck, [side * .14, .02, 0], 'Rubber webbing, brass tensioner and titanium keepers');
    rod(strap, 'rubber', [side * .22, .06, -.10], [side * .33, -.34, -.06], .018);
    add(strap, 'ring', 'brass', [side * .25, -.06, -.08], [.025, .025, .025], [0, 0, 0]);
    plate(strap, 'titanium', [side * .25, .02, -.09], [.035, .025, .07]);
    howdahStraps.push({ node: strap, side });

    for (const front of [true, false]) {
      const post = part(`howdah.post.${front ? 'front' : 'rear'}.${id}`, `${front ? 'Front' : 'Rear'} ${label} howdah corner post`, 'Howdah',
        'Carries the corner of the howdah and braces the railing.',
        'A pale corner post, dark foot, diagonal titanium brace and brass cap stand at the deck corner.', howdahDeck, [side * .1, .06, 0], 'Pale post, dark foot and brass cap');
      const z = front ? -.24 : .24;
      rod(post, 'shell', [side * .23, .09, z], [side * .23, .36, z], .020);
      add(post, 'cylinder', 'dark', [side * .23, .10, z], [.035, .030, .035]);
      rod(post, 'titanium', [side * .12, .10, z], [side * .23, .30, z], .006);
      add(post, 'sphere', 'brass', [side * .23, .37, z], [.020, .020, .020]);
    }
  }

  const crate = part('howdah.crate', 'Howdah cargo crate and seat', 'Howdah',
    'Adds a bolted cargo box and seat that fill the riding platform.',
    'A pale box, dark lid band, brass latches, four corner straps and two seats sit between the rails.', howdahDeck, [0, .12, 0], 'Pale crate, dark lid band and brass latches');
  plate(crate, 'shell', [0, .18, .06], [.30, .16, .24]);
  plate(crate, 'dark', [0, .27, .06], [.32, .025, .26]);
  for (const side of [-1, 1]) plate(crate, 'brass', [side * .11, .26, .06], [.025, .030, .20]);
  for (const side of [-1, 1]) plate(crate, 'rubber', [side * .16, .16, .06], [.025, .18, .22], [0, 0, 0], true);
  kit.fasteners(crate, [[0, .20, .17]], .0055);

  const ladder = part('howdah.ladder', 'Howdah access ladder and handholds', 'Howdah',
    'Lets a keeper climb the rear of the platform.',
    'Two pale rails, four brass rungs, two titanium stand-offs and a dark handhold hang behind the deck.', howdah, [0, .1, 0], 'Pale rails, brass rungs and titanium stand-offs');
  for (const side of [-1, 1]) rod(ladder, 'shell', [side * .14, .06, .30], [side * .14, -.22, .38], .008);
  for (let k = 0; k < 4; k++) rod(ladder, 'brass', [-.14, .02 - k * .07, .315 + k * .022], [.14, .02 - k * .07, .315 + k * .022], .005);
  for (const side of [-1, 1]) rod(ladder, 'dark', [side * .14, .05, .31], [side * .22, .10, .26], .005, true);

  const lantern = part('howdah.lantern', 'Howdah lantern and mount', 'Howdah',
    'Marks the front of the howdah with a service lamp.',
    'A brass post, dark cage, teal lens and four small guards sit on the front rail.', howdahDeck, [0, .12, 0], 'Brass post, dark cage and teal lens');
  rod(lantern, 'brass', [0, .09, -.24], [0, .30, -.24], .006);
  add(lantern, 'sphere', 'lens', [0, .325, -.24], [.026, .034, .026]);
  for (let k = 0; k < 4; k++) rod(lantern, 'dark', [.020 * Math.cos(k * TAU / 4), .29, -.24 + .020 * Math.sin(k * TAU / 4)], [.020 * Math.cos(k * TAU / 4), .36, -.24 + .020 * Math.sin(k * TAU / 4)], .002, true);
  add(lantern, 'cylinder', 'brass', [0, .375, -.24], [.028, .020, .028], [0, 0, 0], true);

  // ------------------------------------------------------------------ animation bind
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
    trunkFrames.forEach((record, i) => {
      const link = pose.trunk.links[i];
      aim(record.node, link.start, link.end);
    });
    trunkRams.forEach(record => {
      const ram = pose.trunkRams.find(item => item.joint === record.joint && item.side === record.side);
      if (!ram) return;
      aim(record.node, ram.a, ram.b);
      record.node.scale.set(1, Math.max(ram.length, 1e-4), 1);
    });
    trunkCables.forEach(record => {
      const i = record.joint, a = pose.trunk.links[i], b = pose.trunk.links[i + 1];
      aim(record.node, a.start, b.end);
      record.node.scale.set(1, Math.max(distance(a.start, b.end), 1e-4), 1);
    });
    tip.position.fromArray(pose.trunk.points[D.trunkCount]);
    tailFrames.forEach((record, i) => {
      const link = pose.tail.links[i];
      aim(record.node, link.start, link.end);
    });
    tailRams.forEach(record => {
      const i = record.joint, a = pose.tail.links[i], b = pose.tail.links[i + 1];
      aim(record.node, a.start, b.end);
      record.node.scale.set(1, Math.max(distance(a.start, b.end), 1e-4), 1);
    });
    tuft.position.fromArray(pose.tail.points[D.tailCount]);
    head.position.fromArray(pose.head.origin);
    head.rotation.set(pose.head.pitch, pose.head.yaw, pose.head.roll || 0, 'YXZ');
    ears.forEach(record => {
      const side = record.side;
      record.node.rotation.set(pose.ears.pitch + side * pose.ears.hinge, side * pose.ears.flap, -side * pose.ears.flare);
      if (record.tip) record.tip.rotation.set(pose.ears.tip * .6, side * pose.ears.tip, -side * pose.ears.tip * .4);
    });
    tuskNodes.forEach(record => {
      const tusk = pose.tusks?.find(item => item.side === record.side);
      if (tusk) record.node.rotation.set(tusk.lift, 0, record.side * tusk.sway);
      if (record.tip) record.tip.rotation.set(tusk?.lift || 0, 0, 0);
    });
    driveGears.forEach(record => { record.node.rotation.y = pose.phase * TAU * 2.2 + (record.front ? 0 : 1.1); });
    bodyRams.forEach(record => { record.node.rotation.x = 0.05 * Math.sin(pose.driveAngle + record.side * 0.9); });
    howdahStraps.forEach(record => { record.node.rotation.x = pose.howdah.sway * (record.side < 0 ? 1 : -1); });
    kit.sync(options);
  }
  update(lastState);

  // Camera fit: sample the real instances through gait, curl, ear-flare and stride extremes.
  const framePoints = [], seen = new Set(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const corners = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];
  for (const [input, count] of [[undefined, 14], [{ curl: 35, ear: 35, stride: .26 }, 9], [{ curl: 0, ear: 0, stride: .08 }, 7]]) for (let i = 0; i < count; i++) {
    update(sample(i / count / .3, { cadence: .3, ...input }));
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
  return {
    group: kit.group, update, framePoints, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
