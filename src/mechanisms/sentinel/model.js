import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample } from './kin.js';

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const length3 = a => Math.hypot(a[0], a[1], a[2]);

export function createModel() {
  const kit = createMechanicalKit('SENTINEL H9 · heavy bipedal exoskeleton');
  const nodes = [], legs = [], arms = [], fingerChains = [], neckLinks = [], jawActuators = [], rotors = [], pistons = [];
  const pauldrons = [], chestPlates = [], vents = [], louvers = [], bearings = [], gears = [], skirts = [], cableDress = [];
  const tetherLinks = [], antennae = [], scanRings = [], visors = [];
  const scratch = {
    matrix: new THREE.Matrix4(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(),
    point: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0), euler: new THREE.Euler(),
    q0: new THREE.Quaternion(), qs: new THREE.Quaternion(),
  };
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
  const eye = (node, p, radius, material = 'titanium', axis = 'z', detail = false) => {
    const euler = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'ring', material, p, [radius, radius, radius], euler, detail);
    add(node, 'bolt', 'dark', p, [radius * .38, radius * .34, radius * .38], euler, true);
  };
  const seal = (node, p, radius, axis = 'z') => {
    const euler = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'ring', 'rubber', p, [radius, radius, radius], euler, true);
    add(node, 'ring', 'brass', p, [radius * .72, radius * .72, radius * .72], euler, true);
  };
  // Three-layer armour: a wide pale shell, a dark shadow seam and a titanium wear rail.
  const layered = (node, c, s, rot = [0, 0, 0], tone = 'shell') => {
    plate(node, tone, c, s, rot);
    plate(node, 'dark', [c[0], c[1] - s[1] * .38, c[2] + s[2] * .10], [s[0] * .84, s[1] * .11, s[2] * 1.02], rot, true);
    plate(node, 'titanium', [c[0], c[1] + s[1] * .44, c[2]], [s[0] * .88, s[1] * .10, s[2] * .96], rot, true);
  };
  const gear = (id, name, system, purpose, how, parent, p, radius, teeth, thickness = .018, spinRatio = 1, explode = [0, .04, 0]) => {
    const node = part(id, name, system, purpose, how, parent, explode, 'Machined brass gear, titanium hub and dark shaft');
    node.position.fromArray(p);
    node.rotation.z = Math.PI / 2;
    kit.gear(node, radius, teeth, thickness, 'brass');
    gears.push({ node, ratio: spinRatio, base: node.quaternion.clone() });
    return node;
  };
  const rollerBearing = (id, name, system, purpose, how, parent, p, radius, spinRatio) => {
    const node = part(id, name, system, purpose, how, parent, [0, .03, 0], 'Titanium races, brass rollers and dark cage');
    node.position.fromArray(p);
    eye(node, [0, 0, 0], radius, 'titanium', 'x');
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      add(node, 'cylinder', 'brass', [0, Math.sin(a) * radius * .74, Math.cos(a) * radius * .74], [radius * .16, radius * .42, radius * .16], [0, 0, Math.PI / 2], true);
    }
    add(node, 'cylinder', 'dark', [0, 0, 0], [radius * .22, radius * .56, radius * .22], [0, 0, Math.PI / 2]);
    bearings.push({ node, ratio: spinRatio });
    return node;
  };
  const piston = (id, label, system, purpose, how, parent, explode = [0, .08, 0]) => {
    const sleeve = part(id + '.sleeve', `${label} actuator sleeve`, system,
      purpose, how + ' The pale sleeve is the fixed housing and the polished shaft telescopes from it.', parent, explode, 'Titanium sleeve, brass seal and polished rod');
    bore(sleeve, 'titanium', [0, .080, 0], .026, .16, 'y');
    seal(sleeve, [0, .16, 0], .030, 'y');
    eye(sleeve, [0, 0, 0], .024, 'brass', 'z');
    add(sleeve, 'cylinder', 'copper', [.026, .09, 0], [.004, .12, .004]);
    plate(sleeve, 'dark', [0, .05, -.025], [.025, .055, .012], [0, 0, 0], true);
    const rodNode = part(id + '.rod', `${label} actuator rod`, system,
      purpose, how + ' The shaft follows the sampled clevis distance instead of a keyframe.', parent, explode, 'Polished titanium shaft, brass ball joint and dark clevis');
    bore(rodNode, 'titanium', [0, .085, 0], .012, .17, 'y');
    add(rodNode, 'sphere', 'brass', [0, 0, 0], [.019, .019, .019]);
    add(rodNode, 'bolt', 'dark', [0, .16, 0], [.015, .012, .015], [0, 0, Math.PI / 2]);
    return { sleeve, rod: rodNode, sleeveNominal: .16, rodNominal: .17, a: [0, 0, 0], b: [0, 0, 0] };
  };
  const posePiston = (pair, a, b, overlap = .64) => {
    const d = Math.max(.02, length3(sub3(b, a)));
    aim(pair.sleeve, a, b); aim(pair.rod, b, a);
    pair.sleeve.scale.y = d * overlap / pair.sleeveNominal;
    pair.rod.scale.y = d * overlap / pair.rodNominal;
  };

  // ================================================================ pelvis
  const body = part('pelvis.chassis', 'Pelvis load chassis and belt', 'Pelvis structure',
    'Carries both hip yokes, the torso carrier and the entire upper-body load.',
    'A machined central block is bridged by two side plates and an armoured belt; the hip yokes bolt to its outboard faces.', undefined, [0, 0, 0], 'Titanium block, pale belt armour and dark underframe');
  plate(body, 'dark', [0, .02, 0], [.35, .17, .255]);
  plate(body, 'titanium', [0, .115, 0], [.335, .045, .235]);
  plate(body, 'shell', [0, .005, -.155], [.285, .135, .038], [.10, 0, 0]);
  plate(body, 'titanium', [0, .082, -.145], [.25, .048, .034]);
  plate(body, 'shell', [0, .10, .145], [.265, .055, .05]);
  add(body, 'sphere', 'teal', [0, .035, -.178], [.048, .025, .010]);
  for (const side of [-1, 1]) {
    plate(body, 'shell', [side * .188, .028, 0], [.045, .155, .235]);
    for (let k = 0; k < 3; k++) plate(body, 'dark', [side * .212, .085 - k * .045, .02], [.008, .020, .14], [0, 0, 0], true);
    plate(body, 'copper', [side * .145, -.03, -.14], [.035, .016, .018], [0, 0, 0], true);
  }
  kit.fasteners(body, [[-.115, .13, -.075], [.115, .13, -.075], [-.115, .13, .075], [.115, .13, .075], [0, .135, .115]], .012);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const girdle = part(`pelvis.girdle.${id}`, `${label} hip girdle armour`, 'Pelvis armor',
      'Builds a broad armoured hip girdle around the pelvis without hiding the hip roller.',
      'Two overlapping shell plates, a titanium edge rail and a copper status conduit are bolted to the chassis side.', body, [side * .045, .01, 0], 'Formed pale alloy shell, titanium rail and copper conduit');
    layered(girdle, [side * .218, .015, .01], [.060, .155, .225], [0, 0, side * .06]);
    plate(girdle, 'titanium', [side * .248, .075, -.075], [.008, .050, .080], [0, 0, side * .06], true);
    add(girdle, 'cylinder', 'teal', [side * .252, .02, .065], [.012, .045, .012], [0, 0, 0], true);
    kit.fasteners(girdle, [[side * .222, .105, -.075], [side * .222, .105, .075]], .010);

    const belt = part(`pelvis.belt.${id}`, `${label} pelvis belt buckle`, 'Pelvis armor',
      'Closes the front belt over the chassis and anchors the service tether hook.',
      'A titanium buckle plate carries a teal charge window and two exposed bolts on the front belt line.', body, [side * .03, .03, -.02], 'Titanium buckle, dark housing and teal charge window');
    plate(belt, 'titanium', [side * .105, .115, -.182], [.085, .052, .022]);
    plate(belt, 'dark', [side * .105, .115, -.196], [.055, .032, .008]);
    add(belt, 'sphere', 'teal', [side * .105, .115, -.202], [.018, .012, .005]);
    kit.fasteners(belt, [[side * .075, .125, -.185], [side * .135, .125, -.185]], .007);
  }

  const sacrum = part('pelvis.sacrum', 'Sacral bridge and spine socket', 'Pelvis structure',
    'Locks the lumbar vertebrae to the pelvis without hiding the hip actuators.',
    'A shallow arch, two bearing jaws and a brass sacral ring clamp the lowest vertebra; four service bolts remain visible.', body);
  plate(sacrum, 'titanium', [0, .105, .10], [.17, .060, .105]);
  eye(sacrum, [0, .158, .10], .043, 'brass', 'x');
  for (const side of [-1, 1]) {
    rod(sacrum, 'dark', [side * .048, .09, .115], [side * .10, .02, .125], .013);
    plate(sacrum, 'shell', [side * .065, .145, .135], [.065, .045, .050], [0, 0, side * .15]);
  }
  kit.fasteners(sacrum, [[-.065, .12, .075], [.065, .12, .075]], .009);

  const rearFrame = part('pelvis.dockingFrame', 'Dorsal docking frame and tether clamp', 'Service tether',
    'Gives the service tether a hard anchor behind the pelvis.',
    'A boxed rear frame spans the chassis with two brass clamp jaws and a visible copper tension tube.', body, [0, .04, .12], 'Titanium frame, brass clamps and copper tension tube');
  for (const side of [-1, 1]) {
    rod(rearFrame, 'titanium', [side * .13, .10, .17], [side * .10, -.03, .225], .012);
    plate(rearFrame, 'brass', [side * .10, .075, .228], [.045, .035, .035]);
    add(rearFrame, 'bolt', 'dark', [side * .10, .075, .248], [.012, .010, .012], [Math.PI / 2, 0, 0], true);
  }
  rod(rearFrame, 'copper', [-.08, .02, .235], [.08, .02, .235], .007);
  add(rearFrame, 'cylinder', 'teal', [0, -.025, .235], [.015, .045, .015], [0, 0, 0], true);

  const gearbox = part('pelvis.gearbox.housing', 'Hip power gearbox housing', 'Power gearbox',
    'Concentrates the hip power take-off and the tether winch drive in one service block.',
    'A dark ribbed housing carries three exposed gear shafts, a copper oil gallery and a bolted inspection cover.', body, [0, .05, .10], 'Dark ribbed housing, copper oil gallery and brass fasteners');
  plate(gearbox, 'dark', [0, .055, .185], [.155, .115, .085]);
  plate(gearbox, 'titanium', [0, .115, .185], [.165, .020, .095]);
  for (let k = 0; k < 3; k++) plate(gearbox, 'titanium', [-.055 + k * .055, .055, .232], [.010, .095, .010], [0, 0, 0], true);
  rod(gearbox, 'copper', [-.095, .015, .205], [.095, .015, .205], .006, true);
  add(gearbox, 'sphere', 'teal', [0, .135, .195], [.022, .012, .008]);
  kit.fasteners(gearbox, [[-.06, .13, .21], [.06, .13, .21]], .008);
  gear('pelvis.gearbox.gear1', 'Hip power primary gear', 'Power gearbox',
    'Takes the main hip power branch through a visible reduction stage.',
    'A large brass gear spins on the gearbox output shaft and drives the two pinions beside it.', body, [0, .055, .242], .052, 20, .020, 3, [0, .06, .02]);
  gear('pelvis.gearbox.gear2', 'Hip power idler gear', 'Power gearbox',
    'Reverses and indexes the secondary hip power branch.',
    'A smaller idler meshes with the primary gear and turns in the opposite direction at a different rate.', body, [.072, .055, .242], .034, 12, .017, -4, [.02, .04, .02]);
  gear('pelvis.gearbox.gear3', 'Tether winch drive gear', 'Power gearbox',
    'Couples the gearbox to the dorsal tether winch.',
    'A compact output gear spins on the winch shaft and is visible through the open gearbox frame.', body, [-.072, .055, .242], .030, 10, .016, 6, [-.02, .04, .02]);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const pack = part(`pelvis.cablePack.${id}`, `${label} hip cable dress pack`, 'Electrical service',
      'Dresses the hip encoder and power conductors away from the swinging leg.',
      'A bolted service box carries three rubber loops, a copper bus and a teal continuity lamp.', body, [side * .12, .02, .11], 'Rubber loops, copper bus and teal lamp');
    pack.position.set(side * .135, .01, .20);
    plate(pack, 'dark', [0, 0, 0], [.045, .07, .035]);
    for (let k = 0; k < 3; k++) rod(pack, 'rubber', [side * .005, -.022 + k * .022, -.018], [side * .020, -.018 + k * .022, .018], .0045, true);
    rod(pack, 'copper', [side * .018, -.025, .018], [side * .018, .025, .018], .0035, true);
    add(pack, 'sphere', 'teal', [0, .04, 0], [.008, .008, .005]);
    cableDress.push({ node: pack, side, phase: side < 0 ? .4 : 2.2, amp: .10 });

    const hip = part(`leg.${id}.hipYoke`, `${label} hip yoke and actuator boss`, 'Hip drive',
      'Locates the hip pitch axis and reacts the leg actuator torque.',
      'A ring boss is keyed into the pelvis side plate; two diagonal ribs carry the load into the chassis.', body, [side * .05, 0, 0]);
    hip.position.fromArray([side * D.hipX, D.hipY, 0]);
    eye(hip, [0, 0, 0], .066, 'titanium', 'x');
    bore(hip, 'brass', [0, 0, 0], .024, .102, 'x');
    plate(hip, 'dark', [side * .040, -.050, .02], [.040, .085, .10]);
    plate(hip, 'shell', [side * .030, .060, -.035], [.070, .055, .090], [0, 0, side * .18]);
    for (const z of [-.075, .075]) rod(hip, 'titanium', [side * .012, .020, z], [side * -.032, .080, z * .62], .014);
    kit.fasteners(hip, [[side * .030, .082, .055], [side * .030, .082, -.055]], .009);

    const hipGear = part(`leg.${id}.hipDrive`, `${label} hip drive gear`, 'Hip drive',
      'Indexes the hip actuator through a visible eighteen-tooth inspection gear.',
      'A brass gear turns on the outboard hip shaft behind the leg yoke; its teeth are conceptual.', body, [side * .06, .02, .06], 'Brass gear and dark hub');
    hipGear.position.set(side * D.hipX, D.hipY, .112);
    hipGear.rotation.z = Math.PI / 2;
    kit.gear(hipGear, .074, 18, .020, 'brass');
    gears.push({ node: hipGear, ratio: 2, base: hipGear.quaternion.clone() });

    rollerBearing(`leg.${id}.hipRoller`, `${label} hip roller bearing`, 'Hip drive',
      'Carries the hip pitch load on a visible roller ring instead of a hidden sleeve.',
      'A titanium race and eight brass rollers turn on the outboard hip shaft with the gait phase.', body,
      [side * D.hipX, D.hipY, -0.078], .080, side < 0 ? 3 : -3);

    const skirt = part(`leg.${id}.skirt`, `${label} hip skirt armor`, 'Pelvis armor',
      'Stands off the hip joint so the leg can swing without the shell colliding.',
      'A curved pale cover floats above the yoke on two posts and leaves the actuator visible below.', body, [side * .08, .03, 0], 'Formed pale alloy shell');
    plate(skirt, 'shell', [side * .212, .020, .015], [.055, .155, .205], [0, 0, side * .10]);
    plate(skirt, 'titanium', [side * .242, .020, .015], [.010, .125, .170], [0, 0, side * .10]);
    for (let k = 0; k < 3; k++) plate(skirt, 'titanium', [side * .250, .060 - k * .052, .015], [.006, .050, .115], [0, 0, side * .1], true);
    plate(skirt, 'copper', [side * .248, -.045, -.08], [.006, .030, .040], [0, 0, side * .1], true);
    kit.fasteners(skirt, [[side * .215, .118, -.075], [side * .215, .118, .075]], .010);
    skirts.push({ node: skirt, side, index: side < 0 ? 0 : 1 });
  }

  // ================================================================= torso
  const torso = part('torso.carrier', 'Torso yaw carrier and lumbar stack', 'Torso structure',
    'Yaws the complete chest, arms and head over the pelvis.',
    'A central bearing column rises from the sacrum and carries six vertebrae, eight rib pairs and the powered backpack.', body, [0, 0, 0]);
  torso.position.set(0, D.torsoLift, 0);
  eye(torso, [0, -.01, .02], .052, 'brass', 'y');
  bore(torso, 'dark', [0, .04, .02], .047, .095, 'y');
  plate(torso, 'titanium', [0, .075, .02], [.14, .035, .13]);

  for (let i = 0; i < 6; i++) {
    const y = .09 + i * .085;
    const vertebra = part(`spine.${i + 1}.frame`, `Lumbar vertebra ${i + 1} and hinge pin`, 'Spine',
      `Transfers upper-body load through vertebral pin ${i + 1} of six.`,
      'A boxed body, two rear processes and a transverse pin form one stiff segment; the pin is the only joint.', torso, [0, .035, .02]);
    plate(vertebra, 'titanium', [0, y, .105], [.115, .048, .078]);
    plate(vertebra, 'dark', [0, y, .148], [.052, .034, .048]);
    bore(vertebra, 'brass', [0, y, .105], .018, .145, 'x');
    for (const side of [-1, 1]) rod(vertebra, 'dark', [side * .052, y, .115], [side * .078, y + .028, .168], .012);
    for (const side of [-1, 1]) add(vertebra, 'bolt', 'titanium', [side * .074, y, .105], [.015, .012, .015], [0, 0, Math.PI / 2], true);
    add(vertebra, 'sphere', 'teal', [0, y, .145], [.012, .009, .006]);
  }
  for (let i = 0; i < 4; i++) {
    const scute = part(`spine.${i + 1}.scute`, `Dorsal lumbar scute ${i + 1}`, 'Spine armor',
      'Protects one vertebral bay while leaving its hinge pin exposed.',
      'A shallow shell plate sits on two isolators and can separate without moving the vertebra.', torso, [0, .08, .04], 'Formed pale alloy shell');
    add(scute, 'sphere', 'shell', [0, .16 + i * .085, .14], [.085, .032, .060]);
    plate(scute, 'titanium', [0, .185 + i * .085, .175], [.045, .018, .020], [0, 0, 0], true);
    add(scute, 'sphere', 'teal', [0, .16 + i * .085, .195], [.022, .008, .006]);
    kit.fasteners(scute, [[-.058, .185 + i * .085, .14], [.058, .185 + i * .085, .14]], .008);
  }

  for (const side of [-1, 1]) for (let r = 0; r < 7; r++) {
    const y = .18 + r * .055;
    const rib = part(`rib.${side < 0 ? 'L' : 'R'}.${r + 1}`, `${side < 0 ? 'Left' : 'Right'} rib ${r + 1} of seven`, 'Rib cage',
      `Closes thoracic ring ${r + 1} from the spine to the sternum without a solid chest wall.`,
      'Three tapered rails are pinned at the vertebra and joined by a sternal pad; the plate floats clear of the ribs.', torso, [side * .05, .02, 0]);
    const a = [side * .062, y, .105], b = [side * .175, y, .030], c = [side * .215, y - .012, -.060], d = [side * .100, y - .020, -.115];
    rod(rib, 'titanium', a, b, .013);
    rod(rib, 'titanium', b, c, .011);
    rod(rib, 'dark', c, d, .008);
    rod(rib, 'copper', [side * .165, y + .010, .015], [side * .190, y - .008, -.035], .004, true);
    add(rib, 'bolt', 'titanium', d, [.013, .012, .013], [0, 0, Math.PI / 2], true);
    if (r < 4) kit.fasteners(rib, [[side * .120, y + .014, .060]], .008);
  }

  const sternum = part('chest.sternum', 'Sternal keel and front armor rails', 'Rib cage',
    'Collects the seven rib pairs ahead of the power core.',
    'A narrow vertical keel and two outboard rails leave a service gap around the rotor.', torso, [0, .04, -.03]);
  plate(sternum, 'shell', [0, .36, -.115], [.045, .290, .055], [.08, 0, 0]);
  plate(sternum, 'dark', [0, .36, -.146], [.022, .240, .012], [0, 0, 0], true);
  for (const side of [-1, 1]) {
    rod(sternum, 'titanium', [side * .085, .18, -.095], [side * .085, .52, -.085], .013);
    rod(sternum, 'copper', [side * .058, .20, -.100], [side * .058, .50, -.090], .004, true);
  }
  kit.fasteners(sternum, [[0, .49, -.090], [0, .31, -.120], [0, .21, -.105]], .009);

  const chestPlate = part('chest.plate', 'Vented upper chest fairing', 'Torso armor',
    'Shields the upper chest without enclosing the visible rotor and rib ends.',
    'A pale barrel panel on four posts carries six open vent slats and a bolted centre ridge.', torso, [0, .16, -.02], 'Formed pale alloy shell');
  add(chestPlate, 'sphere', 'shell', [0, .475, -.080], [.195, .105, .055]);
  for (const side of [-1, 1]) rod(chestPlate, 'titanium', [side * .17, .40, -.105], [side * .18, .54, -.085], .012);
  plate(chestPlate, 'titanium', [0, .515, -.132], [.040, .080, .014]);
  for (let k = 0; k < 6; k++) plate(chestPlate, 'dark', [0, .430 + k * .019, -.130], [.17, .007, .014], [0, 0, 0], true);
  add(chestPlate, 'sphere', 'teal', [0, .52, -.140], [.035, .014, .006]);
  kit.fasteners(chestPlate, [[-.145, .485, -.095], [.145, .485, -.095], [-.105, .415, -.120], [.105, .415, -.120]], .010);

  for (const side of [-1, 1]) for (const [band, y, size, factor] of [['upper', .455, [.115, .070, .045], 1], ['lower', .375, [.125, .075, .048], -1]]) {
    const id = side < 0 ? 'L' : 'R';
    const breath = part(`chest.breath.${band}.${id}`, `${side < 0 ? 'Left' : 'Right'} ${band} breathing barrel plate`, 'Torso armor',
      `Rides the ${band} thoracic ring so the chest visibly inflates with the power cycle.`,
      'A layered shell plate is pinned to the rib ends and rises a few millimetres against its return spring.', torso, [side * .045, .10, -.01], 'Formed pale alloy shell and dark return spring');
    layered(breath, [side * .100, y, -.124], size, [0, 0, side * .06], 'shell');
    plate(breath, 'titanium', [side * .145, y + .01, -.145], [.012, .045, .014], [0, 0, 0], true);
    add(breath, 'sphere', 'teal', [side * .062, y - .018, -.150], [.012, .010, .005]);
    chestPlates.push({ node: breath, base: breath.position.clone(), factor, side });
  }
  for (let k = 0; k < 3; k++) {
    const barrel = part(`chest.barrel.${k + 1}`, `Layered barrel torso plate ${k + 1} of three`, 'Torso armor',
      `Builds the central chest mass over the open rib cage while keeping a service gap at ring ${k + 2}.`,
      'Three overlapping shell leaves with titanium wear strips float above the sternum and power core.', torso, [0, .04 + k * .02, -.02], 'Formed pale alloy shell, titanium wear strip and dark seam');
    layered(barrel, [0, .265 + k * .058, -.145 - k * .006], [.220 - k * .020, .075, .050], [.08, 0, 0]);
    plate(barrel, 'brass', [-.085 + k * .085, .255 + k * .058, -.174], [.018, .022, .010], [0, 0, 0], true);
    add(barrel, 'sphere', 'teal', [0, .255 + k * .058, -.182], [.028, .009, .005]);
    chestPlates.push({ node: barrel, base: barrel.position.clone(), factor: k % 2 ? -1 : 1, side: 0, barrel: true });
  }

  const radiator = part('chest.radiator', 'Dorsal heat exchanger', 'Thermal service',
    'Exposes the thermal path behind the spine carrier.',
    'A titanium spine rail carries seven separated fins above a copper transfer tube.', torso, [0, .05, .07]);
  rod(radiator, 'titanium', [0, .14, .212], [0, .60, .212], .014);
  for (let k = 0; k < 7; k++) plate(radiator, 'dark', [0, .18 + k * .06, .240], [.17, .035, .009], [0, 0, 0], k > 4);
  rod(radiator, 'copper', [-.080, .15, .212], [.080, .15, .212], .009, true);
  for (const side of [-1, 1]) add(radiator, 'bolt', 'brass', [side * .055, .58, .214], [.012, .010, .012], [0, 0, Math.PI / 2], true);

  for (const side of [-1, 1]) {
    const loom = part(`torso.loom.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} service loom`, 'Electrical service',
      'Runs control and sensor conductors from the pelvis to the head.',
      'Seven insulated links zigzag outside the rib cage and terminate at a bolted service block.', torso, [side * .04, .02, 0]);
    for (let k = 0; k < 7; k++) {
      const p = [side * (.080 + .018 * Math.sin(k * 1.1)), .12 + k * .075, .150];
      const q = [side * (.092 + .020 * Math.sin((k + 1) * 1.1)), .12 + (k + 1) * .075, .155];
      rod(loom, 'rubber', p, q, .0065);
      rod(loom, 'copper', [p[0], p[1] + .012, p[2]], [q[0], q[1] + .012, q[2]], .003, true);
    }
    plate(loom, 'brass', [side * .088, .09, .15], [.038, .048, .022]);
    add(loom, 'sphere', 'teal', [side * .090, .62, .15], [.012, .010, .006]);
  }

  const core = part('thorax.core', 'Chest power core and stator', 'Power core',
    'Shows the central energy module that the harness feeds.',
    'An open ring stator carries eight copper coils around a teal optical core with no opaque housing.', torso, [0, .06, -.09], 'Titanium, copper and optical glass');
  eye(core, [0, .30, -.125], .105, 'titanium', 'z');
  eye(core, [0, .30, -.140], .080, 'brass', 'z');
  add(core, 'sphere', 'lens', [0, .30, -.155], [.054, .054, .028]);
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8;
    bore(core, 'copper', [.070 * Math.cos(a), .30 + .070 * Math.sin(a), -.145], .013, .045, 'z', true);
  }
  for (const side of [-1, 1]) bore(core, 'teal', [side * .092, .30, -.112], .008, .026, 'z', true);
  plate(core, 'dark', [0, .415, -.105], [.14, .018, .040], [0, 0, 0], true);

  const rotor = part('thorax.rotor', 'Eight-vane core rotor', 'Power core',
    'Makes the core state visible as a rotating vane ring.',
    'Eight radial vanes and a bolted hub turn together in front of the stator; the speed is prescribed.', torso, [0, .05, 0], 'Brass and dark alloy');
  rotor.position.set(0, .30, -.162);
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8;
    plate(rotor, 'brass', [.037 * Math.cos(a), .037 * Math.sin(a), 0], [.032, .009, .009], [0, 0, a]);
  }
  add(rotor, 'bolt', 'titanium', [0, 0, .006], [.014, .014, .014], [Math.PI / 2, 0, 0]);
  eye(rotor, [0, 0, -.004], .016, 'copper', 'z', true);
  rotors.push({ node: rotor, ratio: 2 });

  const flywheel = part('thorax.flywheel', 'Core flywheel and balance ring', 'Power core',
    'Stores a little angular momentum behind the visible stator.',
    'A segmented brass flywheel and two copper balance slugs rotate on the core axis below the rotor.', torso, [0, .05, .02], 'Brass segments and copper balance slugs');
  flywheel.position.set(0, .30, -.175);
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6;
    plate(flywheel, 'brass', [.060 * Math.cos(a), .060 * Math.sin(a), .012], [.020, .016, .010], [0, 0, a]);
  }
  add(flywheel, 'bolt', 'dark', [0, 0, .014], [.020, .010, .020]);
  rotors.push({ node: flywheel, ratio: -1 });

  const abdomen = part('torso.abdomen', 'Abdominal armor stack', 'Torso armor',
    'Bridges the lumbar carrier to the pelvis without hiding the waist bearing.',
    'Three overlapping pale plates and a dark central seam descend from the rib cage to the sacrum.', torso, [0, .03, 0], 'Formed pale alloy shell and dark seam');
  for (let k = 0; k < 3; k++) {
    plate(abdomen, 'shell', [0, -.005 + k * .060, -.110 + k * .004], [.225 - k * .015, .062, .065], [.10, 0, 0]);
    plate(abdomen, 'dark', [0, -.002 + k * .060, -.145 + k * .004], [.13, .022, .012], [0, 0, 0], true);
  }
  add(abdomen, 'sphere', 'teal', [0, .095, -.140], [.030, .010, .006]);
  kit.fasteners(abdomen, [[-.090, .050, -.110], [.090, .050, -.110], [-.075, .120, -.100], [.075, .120, -.100]], .008);

  // ================================================================ shoulders
  const yoke = part('chest.yoke', 'Shoulder yoke and neck socket', 'Torso structure',
    'Ties both shoulder bearings and the neck socket into one upper-chest bridge.',
    'Two tapered beams cross the chest to the clavicle bosses and clamp a central brass neck ring.', torso, [0, .09, 0], 'Titanium beams, brass socket and pale shoulder plates');
  for (const side of [-1, 1]) {
    rod(yoke, 'titanium', [0, .555, -.02], [side * .335, .515, 0], .024);
    rod(yoke, 'dark', [side * .07, .52, -.055], [side * .30, .50, -.01], .012);
    plate(yoke, 'shell', [side * .215, .548, -.015], [.20, .045, .145]);
    kit.fasteners(yoke, [[side * .165, .572, -.07], [side * .275, .548, .03]], .010);
  }
  plate(yoke, 'titanium', [0, .555, .065], [.275, .032, .075]);

  const collar = part('neck.collar', 'Neck base collar and chest socket', 'Neck',
    'Anchors the articulated neck to the upper chest bridge.',
    'A wide alloy ring clamps the first neck pin between two pale plates and four service bolts.', torso, [0, .04, 0], 'Titanium, pale alloy and brass');
  eye(collar, [0, .58, -.02], .075, 'titanium', 'y');
  bore(collar, 'brass', [0, .555, -.02], .038, .058, 'y');
  for (const side of [-1, 1]) {
    plate(collar, 'shell', [side * .100, .565, -.025], [.135, .047, .120]);
    kit.fasteners(collar, [[side * .115, .592, -.06], [side * .048, .592, .03]], .008);
  }

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const pauldron = part(`shoulder.${id}.pauldron`, `${label} shoulder pauldron`, 'Shoulder armor',
      'Floats above the arm drive so the shoulder can swing and counter-swing without touching the shell.',
      'A layered pale dome on a titanium carriage carries vent slats, a copper edge rail and a teal load lamp.', torso, [side * .11, .10, 0], 'Formed pale alloy shell, titanium carriage and copper rail');
    pauldron.position.set(side * D.shoulderX, D.shoulderY + .045, 0);
    add(pauldron, 'sphere', 'shell', [0, .012, -.005], [.145, .070, .135]);
    plate(pauldron, 'shell', [0, -.006, -.020], [.215, .040, .180], [0, 0, side * .10]);
    plate(pauldron, 'titanium', [side * .010, .052, -.010], [.185, .014, .085], [0, 0, side * .10]);
    plate(pauldron, 'dark', [side * .045, -.020, -.092], [.012, .030, .045], [0, 0, side * .25], true);
    plate(pauldron, 'copper', [side * .098, .005, .055], [.008, .045, .095], [0, 0, side * .18], true);
    add(pauldron, 'sphere', 'teal', [side * .105, .030, -.078], [.014, .010, .006]);
    kit.fasteners(pauldron, [[side * .060, .055, -.050], [side * .060, .055, .050]], .009);
    pauldrons.push({ node: pauldron, side, base: pauldron.position.clone() });

    const rail = part(`shoulder.${id}.rail`, `${label} pauldron edge rail`, 'Shoulder armor',
      'Reinforces the outer pauldron edge and keeps the counter-swing visible.',
      'A titanium rail and three brass sliders ride the pauldron rim on a bolted standoff.', torso, [side * .12, .09, 0], 'Titanium rail and brass sliders');
    rod(rail, 'titanium', [side * .215, .552, -.070], [side * .425, .535, -.070], .010);
    for (let k = 0; k < 3; k++) plate(rail, 'brass', [side * (.265 + k * .055), .544, -.072], [.022, .016, .022], [0, 0, 0], true);
    rail.position.set(side * .08, 0, 0);

    const clavicle = part(`shoulder.${id}.clavicle`, `${label} clavicle linkage`, 'Arm drive',
      'Connects the torso to the shoulder bearing while leaving the actuator visible.',
      'A double rod rises from the sternum rail to an open shoulder boss with a brass pin.', torso, [side * .16, .06, 0]);
    rod(clavicle, 'titanium', [side * .07, .50, -.06], [side * .355, .50, 0], .015);
    rod(clavicle, 'dark', [side * .08, .47, -.055], [side * .34, .48, -.005], .010);
    eye(clavicle, [side * .355, .50, 0], .047, 'brass', 'x');
    plate(clavicle, 'shell', [side * .235, .525, -.035], [.145, .032, .075], [0, 0, side * .10]);
    kit.fasteners(clavicle, [[side * .24, .49, -.03]], .008);

    const shoulderGear = part(`shoulder.${id}.gear`, `${label} shoulder index gear`, 'Arm drive',
      'Makes the shoulder drive phase readable without opening the bearing block.',
      'A sixteen-tooth brass gear sits on the outboard shoulder shaft behind the pauldron.', torso, [side * .12, .06, .04], 'Brass gear and dark hub');
    shoulderGear.position.set(side * D.shoulderX, D.shoulderY, .120);
    shoulderGear.rotation.z = Math.PI / 2;
    kit.gear(shoulderGear, .062, 16, .018, 'brass');
    gears.push({ node: shoulderGear, ratio: side < 0 ? -3 : 4, base: shoulderGear.quaternion.clone() });

    rollerBearing(`shoulder.${id}.roller`, `${label} shoulder roller bearing`, 'Arm drive',
      'Carries the shoulder pitch load on an exposed roller ring behind the pauldron.',
      'A titanium race and eight brass rollers turn on the shoulder shaft with the arm swing.', torso,
      [side * D.shoulderX, D.shoulderY, -0.060], .078, side < 0 ? -3 : 4);

    const dress = part(`shoulder.${id}.cableDress`, `${label} shoulder cable dress`, 'Electrical service',
      'Routes the arm power and sensor bundle over the moving shoulder.',
      'Three rubber links and a copper conductor bridge the chest loom to a bolted shoulder service block.', torso, [side * .12, .05, 0], 'Rubber links, copper conductor and titanium block');
    for (let k = 0; k < 3; k++) rod(dress, 'rubber', [side * .275, .555 + k * .014, .060], [side * .335, .545 + k * .014, .105], .0055);
    rod(dress, 'copper', [side * .318, .548, .100], [side * .345, .535, .120], .003, true);
    plate(dress, 'titanium', [side * .345, .535, .126], [.035, .038, .020]);
    add(dress, 'sphere', 'teal', [side * .345, .515, .128], [.009, .009, .005]);
    cableDress.push({ node: dress, side, phase: side < 0 ? 1.4 : 3.0, amp: .06 });
  }

  // ================================================================ backpack
  const pack = part('pack.frame', 'Power backpack frame and spine clamp', 'Backpack',
    'Carries the cells, radiators and tether winch above the open lumbar spine.',
    'A boxed titanium frame clamps the upper spine and cantilevers two cell bays and two radiator banks.', torso, [0, .10, .10], 'Titanium frame, dark bays and brass clamps');
  for (const side of [-1, 1]) {
    rod(pack, 'titanium', [side * .165, .22, .205], [side * .165, .545, .205], .014);
    rod(pack, 'dark', [side * .105, .30, .225], [side * .105, .52, .225], .010);
    rod(pack, 'copper', [side * .145, .26, .238], [side * .145, .50, .238], .004, true);
    plate(pack, 'brass', [side * .165, .545, .210], [.045, .035, .035]);
  }
  plate(pack, 'titanium', [0, .535, .205], [.36, .035, .055]);
  plate(pack, 'dark', [0, .25, .225], [.30, .055, .045]);
  kit.fasteners(pack, [[-.14, .56, .225], [.14, .56, .225], [-.14, .23, .225], [.14, .23, .225]], .009);

  const regulator = part('pack.regulator', 'Backpack power regulator', 'Backpack',
    'Regulates the two cell bays before the power reaches the chest core.',
    'A finned titanium regulator sits between the cells with four copper bus bars and a teal state lamp.', torso, [0, .08, .12], 'Titanium regulator, copper bus bars and teal state lamp');
  plate(regulator, 'dark', [0, .392, .248], [.11, .115, .070]);
  plate(regulator, 'titanium', [0, .450, .250], [.13, .020, .080]);
  for (let k = 0; k < 4; k++) plate(regulator, 'copper', [-.045 + k * .030, .375, .286], [.010, .055, .008], [0, 0, 0], true);
  add(regulator, 'sphere', 'teal', [0, .412, .287], [.018, .012, .006]);
  kit.fasteners(regulator, [[-.045, .446, .290], [.045, .446, .290]], .007);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const cell = part(`pack.cell.${id}`, `${label} backpack power cell`, 'Backpack',
      'Stores the exoskeleton energy reserve in a replaceable armoured canister.',
      'A tall shell canister with six titanium bands, a copper bus and a teal charge window is clamped in the frame.', torso, [side * .08, .09, .13], 'Formed pale shell, titanium bands and teal charge window');
    layered(cell, [side * .095, .400, .265], [.115, .260, .095], [0, 0, 0]);
    for (let k = 0; k < 5; k++) plate(cell, 'dark', [side * .095, .295 + k * .052, .318], [.095, .010, .010], [0, 0, 0], true);
    plate(cell, 'copper', [side * .150, .400, .295], [.010, .180, .020], [0, 0, 0], true);
    add(cell, 'sphere', 'teal', [side * .095, .500, .320], [.030, .012, .006]);
    kit.fasteners(cell, [[side * .095, .548, .300], [side * .095, .260, .300]], .008);

    const radiatorBank = part(`pack.radiator.${id}`, `${label} backpack radiator bank`, 'Thermal service',
      'Dumps core heat through a stacked fin bank beside the power cell.',
      'Seven titanium fins sit over a copper transfer tube and are exposed above the cell shoulder.', torso, [side * .15, .08, .12], 'Titanium fins, copper transfer tube and dark housing');
    plate(radiatorBank, 'dark', [side * .205, .410, .230], [.052, .225, .090]);
    for (let k = 0; k < 6; k++) plate(radiatorBank, 'titanium', [side * .205, .315 + k * .038, .285], [.090, .008, .090], [0, 0, 0], k > 3);
    rod(radiatorBank, 'copper', [side * .205, .30, .300], [side * .205, .52, .300], .007);
    add(radiatorBank, 'sphere', 'teal', [side * .205, .535, .285], [.012, .012, .005]);
    kit.fasteners(radiatorBank, [[side * .205, .525, .250]], .007);

    const louver = part(`pack.louver.${id}`, `${label} radiator louver door`, 'Thermal service',
      'Opens the radiator exhaust path as core load rises through the cycle.',
      'A hinged pale door with three dark vent slats swings on a brass hinge above the fin bank.', torso, [side * .17, .12, .16], 'Formed pale shell, dark slats and brass hinge');
    louver.position.set(side * .205, .500, .295);
    plate(louver, 'shell', [0, .020, .015], [.115, .080, .018]);
    for (let k = 0; k < 3; k++) plate(louver, 'dark', [0, -.008 + k * .026, .026], [.095, .012, .008], [0, 0, 0], true);
    bore(louver, 'brass', [0, .060, 0], .010, .115, 'x');
    louvers.push({ node: louver, side, base: louver.quaternion.clone(), open: side < 0 ? 1 : -1 });

    for (let k = 0; k < 3; k++) {
      const vent = part(`pack.vent.${id}.${k + 1}`, `${label} backpack exhaust vent ${k + 1} of three`, 'Thermal service',
        `Meters the ${k + 1}${k === 0 ? 'st' : k === 1 ? 'nd' : 'rd'} exhaust louver as the radiator bank opens.`,
        'A small shell vane hinges on a brass pin and swings outward with the radiator schedule.', torso, [side * .12, .09, .13], 'Formed pale shell, dark throat and brass pin');
      vent.position.set(side * (.145 + k * .020), .275, .300);
      plate(vent, 'shell', [0, 0, .016], [.048, .042, .014]);
      plate(vent, 'dark', [0, 0, -.004], [.032, .028, .010], [0, 0, 0], true);
      bore(vent, 'brass', [0, 0, 0], .007, .052, 'x');
      vents.push({ node: vent, side, index: k, base: vent.quaternion.clone() });
    }

    const exhaust = part(`pack.exhaust.${id}`, `${label} backpack exhaust stack`, 'Thermal service',
      'Vents the hottest radiator air above the shoulder line.',
      'A short titanium stack with four copper heat tabs and a dark rain cap rises from the radiator bank.', torso, [side * .10, .16, .14], 'Titanium stack, copper heat tabs and dark cap');
    bore(exhaust, 'titanium', [0, .035, 0], .025, .090, 'y');
    add(exhaust, 'cone', 'dark', [0, .090, 0], [.032, .030, .032]);
    for (let k = 0; k < 4; k++) plate(exhaust, 'copper', [side * .028, .020 + k * .016, 0], [.010, .008, .020], [0, 0, 0], true);
    exhaust.position.set(side * .115, .555, .245);
  }

  const reel = part('pack.tetherReel', 'Dorsal tether recoil reel', 'Service tether',
    'Reels the service tether as the torso turns and the pelvis bobs.',
    'A brass drum, a titanium flange and four copper spokes turn on the backpack cross shaft.', torso, [0, .16, .10], 'Brass drum, titanium flange and copper spokes');
  reel.position.set(0, .575, .245);
  add(reel, 'cylinder', 'brass', [0, 0, 0], [.048, .075, .048], [0, 0, Math.PI / 2]);
  eye(reel, [.041, 0, 0], .048, 'titanium', 'x');
  eye(reel, [-.041, 0, 0], .048, 'titanium', 'x');
  for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4;
    rod(reel, 'copper', [.046, Math.sin(a) * .020, Math.cos(a) * .020], [.046, Math.sin(a) * .042, Math.cos(a) * .042], .004, true);
  }
  // The tether reel is driven by a bounded recoil schedule in update(), not a continuous spin.

  // Tether segments live on the stable pelvis frame and bridge to the reel in torso space.
  for (let k = 0; k < 3; k++) {
    const link = part(`tether.link.${k + 1}`, `Service tether link ${k + 1} of three`, 'Service tether',
      `Carries the tether load through recoil segment ${k + 1}.`,
      'A flexible rubber-jacketed link with a copper conductor is stretched between sampled reel and dock points.', body, [0, .04, .05], 'Rubber jacket, copper conductor and brass end fittings');
    bore(link, 'rubber', [0, .040, 0], .010, .080, 'y');
    bore(link, 'copper', [0, .040, .011], .0035, .078, 'y', true);
    add(link, 'sphere', 'brass', [0, 0, 0], [.014, .014, .014]);
    tetherLinks.push({ node: link, nominal: .080, index: k });
  }
  const hook = part('tether.hook', 'Tether dock hook and tension gauge', 'Service tether',
    'Latches the tether to the pelvis docking frame and shows its tension.',
    'A brass hook, a titanium gauge body and a teal tension window sit on the dorsal dock.', body, [0, .02, .10], 'Brass hook, titanium gauge and teal window');
  hook.position.set(0, .085, .235);
  add(hook, 'ring', 'brass', [0, 0, 0], [.030, .030, .030], [0, 0, 0]);
  plate(hook, 'titanium', [0, .028, .010], [.045, .035, .022]);
  add(hook, 'sphere', 'teal', [0, .034, .024], [.014, .008, .005]);

  // ================================================================= neck
  for (let i = 0; i < D.neckCount; i++) {
    const frame = part(`neck.${i + 1}.frame`, `Neck vertebra ${i + 1} of four`, 'Neck',
      `Carries the head through neck pin ${i + 1} while keeping the 100 mm spacing.`,
      'Paired rails, two transverse hinge pins, four cross braces and two copper conductors form one rigid neck link.', torso, [0, .05, -.02]);
    for (const x of [-.024, .024]) rod(frame, 'titanium', [x, 0, 0], [x, D.neckLink, 0], .010);
    bore(frame, 'brass', [0, 0, 0], .019, .105, 'x');
    bore(frame, 'titanium', [0, D.neckLink, 0], .017, .095, 'x');
    for (const z of [-.018, .018]) rod(frame, 'dark', [-.024, .042, z], [.024, .042, z], .0050, true);
    for (const z of [-.018, .018]) rod(frame, 'dark', [-.024, .078, z], [.024, .078, z], .0050, true);
    for (const side of [-1, 1]) rod(frame, 'copper', [side * .047, .015, 0], [side * .047, .085, 0], .004, true);
    const scute = part(`neck.${i + 1}.scute`, `Neck armored sleeve ${i + 1}`, 'Neck armor',
      'Covers one neck link while leaving the hinge pins and side rails readable.',
      'A long pale sleeve and a dark ventral plate ride the frame and overlap only in silhouette.', frame, [0, .02, .03], 'Formed pale alloy shell and dark underside');
    plate(scute, 'shell', [0, .050, .028], [.090, .096, .040]);
    plate(scute, 'dark', [0, .050, -.024], [.068, .080, .015]);
    for (let k = 0; k < 3; k++) plate(scute, 'titanium', [0, .014 + k * .036, .051], [.064, .008, .008], [0, 0, 0], true);
    add(scute, 'sphere', 'teal', [0, .050, .050], [.012, .012, .005]);
    kit.fasteners(scute, [[-.026, .050, .04], [.026, .050, .04]], .006);
    neckLinks.push({ node: frame, index: i });
  }
  for (const side of [-1, 1]) {
    const cable = part(`neck.cable.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} neck service cable`, 'Neck',
      'Keeps the head harness moving with the four neck pins instead of crossing them.',
      'Five rubber links and a copper conductor zigzag beside the neck frames inside a braided shield.', torso, [0, .06, -.02], 'Rubber links, copper conductor and braided shield');
    for (let k = 0; k < 5; k++) {
      const a = [side * .052, .02 + k * .020, .022], b = [side * .058, .035 + k * .020, .034];
      rod(cable, 'rubber', a, b, .0045);
      rod(cable, 'copper', [a[0], a[1] + .006, a[2] + .004], [b[0], b[1] + .006, b[2] + .004], .0022, true);
    }
  }

  // ================================================================= head
  const head = part('head.carrier', 'Head gimbal and neck clamp', 'Head optics',
    'Carries every head sensor on a two-axis neck gimbal.',
    'An open cross-yoke clamps the last neck pin and leaves the yaw bearing and jaw pivot visible.', torso, [0, .04, -.05]);
  head.position.fromArray(lastState.head.origin);
  eye(head, [0, 0, 0], .050, 'brass', 'x');
  bore(head, 'titanium', [0, .024, -.014], .040, .065, 'y');
  eye(head, [0, -.027, 0], .055, 'dark', 'y');
  add(head, 'cone', 'shell', [0, -.058, 0], [.082, .082, .092], [Math.PI, 0, 0]);
  plate(head, 'titanium', [0, -.092, -.030], [.095, .018, .065]);

  const cranium = part('head.cranium', 'Sensor cranium and face frame', 'Head optics',
    'Houses the visor and protects the forward sensor plane.',
    'A compact shell skull is braced by a titanium face frame and two cheek posts, leaving the jaw open.', head, [0, .05, -.04], 'Formed pale alloy shell and titanium');
  add(cranium, 'sphere', 'shell', [0, .108, -.060], [.140, .108, .155]);
  plate(cranium, 'titanium', [0, .005, -.190], [.205, .050, .095]);
  for (const side of [-1, 1]) rod(cranium, 'dark', [side * .100, .078, -.130], [side * .114, -.005, -.190], .015);
  plate(cranium, 'dark', [0, .102, .078], [.165, .065, .055]);
  plate(cranium, 'shell', [0, .162, -.125], [.160, .045, .100]);
  add(cranium, 'sphere', 'teal', [0, .172, -.178], [.030, .012, .006]);
  kit.fasteners(cranium, [[-.085, .175, -.105], [.085, .175, -.105], [0, .195, -.010]], .009);

  const crown = part('head.crown', 'Armored helmet crown', 'Head optics',
    'Adds the heavy helmet silhouette above the sensor face.',
    'A shell crown with a titanium ridge, two copper heat strips and a rear cable saddle caps the cranium.', head, [0, .11, .02], 'Formed pale shell, titanium ridge and copper heat strip');
  add(crown, 'sphere', 'shell', [0, .170, .005], [.155, .070, .150]);
  plate(crown, 'titanium', [0, .220, -.010], [.065, .022, .190]);
  for (const side of [-1, 1]) plate(crown, 'copper', [side * .105, .175, -.005], [.008, .035, .110], [0, 0, 0], true);
  rod(crown, 'rubber', [-.075, .150, .095], [.075, .150, .095], .009);
  kit.fasteners(crown, [[-.065, .220, .060], [.065, .220, .060]], .008);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const cheek = part(`head.cheek.${id}`, `${label} helmet cheek guard`, 'Head optics',
      'Protects the jaw actuator and lateral sensor without closing the face.',
      'A shell cheek leaf, a titanium jaw rail and a copper sensor lead are carried on two standoffs.', head, [side * .10, .05, -.02], 'Formed pale shell, titanium rail and copper lead');
    layered(cheek, [side * .128, .035, -.110], [.035, .105, .095], [0, 0, side * .10]);
    rod(cheek, 'copper', [side * .145, .005, -.060], [side * .145, .085, -.125], .0035, true);
    kit.fasteners(cheek, [[side * .132, .080, -.070]], .007);
  }

  const occipital = part('head.occipital', 'Occipital armour and neck shroud', 'Head optics',
    'Covers the rear sensor bay and keeps the neck harness clear.',
    'Two dark shroud plates and a titanium spine clamp sit behind the crown with a rubber cable grommet.', head, [0, .09, .06], 'Dark shroud, titanium clamp and rubber grommet');
  plate(occipital, 'dark', [0, .075, .125], [.150, .110, .045], [.12, 0, 0]);
  plate(occipital, 'shell', [0, .135, .095], [.125, .050, .055], [.30, 0, 0]);
  plate(occipital, 'titanium', [0, -.010, .060], [.090, .030, .070]);
  add(occipital, 'sphere', 'rubber', [0, .020, .140], [.035, .025, .012]);

  const visor = part('head.visor', 'Panoramic sensor visor', 'Head optics',
    'Provides the forward optical aperture without a solid face plate.',
    'A wide teal glass bar sits inside a thin alloy bezel with a brow above and two end clamps.', head, [0, .06, -.06], 'Optical glass and brass bezel');
  add(visor, 'box', 'lens', [0, .078, -.248], [.195, .038, .016]);
  plate(visor, 'titanium', [0, .104, -.250], [.205, .018, .028]);
  plate(visor, 'dark', [0, .054, -.250], [.190, .012, .022], [0, 0, 0], true);
  for (const side of [-1, 1]) add(visor, 'bolt', 'brass', [side * .098, .078, -.251], [.015, .015, .015], [0, 0, Math.PI / 2], true);
  visors.push({ node: visor });

  const brow = part('head.brow', 'Visor brow and ranging shelf', 'Head optics',
    'Shadows the visor and carries the short-range emitter.',
    'A titanium brow shelf, a dark emitter housing and a teal lens project over the glass.', head, [0, .10, -.08], 'Titanium shelf, dark emitter and teal lens');
  plate(brow, 'titanium', [0, .118, -.225], [.230, .022, .075], [.18, 0, 0]);
  add(brow, 'sphere', 'dark', [0, .125, -.270], [.045, .020, .018]);
  add(brow, 'sphere', 'teal', [0, .125, -.283], [.018, .010, .005]);
  kit.fasteners(brow, [[-.095, .125, -.245], [.095, .125, -.245]], .007);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const optic = part(`head.optic.${id}`, `${label} ranging optic`, 'Head optics',
      'Marks the forward optical reference on its side of the visor.',
      'A split lens hemisphere is held in a brass bezel with three exposed alignment screws.', head, [side * .1, .08, -.05], 'Dark carrier, brass bezel and teal optical glass');
    add(optic, 'sphere', 'dark', [side * .116, .075, -.196], [.055, .060, .050]);
    add(optic, 'sphere', 'lens', [side * .124, .075, -.220], [.040, .044, .026]);
    eye(optic, [side * .116, .075, -.192], .062, 'brass', 'z');
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 + .4;
      add(optic, 'bolt', 'titanium', [side * .116 + .045 * Math.cos(a), .075 + .047 * Math.sin(a), -.240], [.007, .009, .007], [0, 0, 0], true);
    }
  }

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const sensor = part(`head.sensor.${id}`, `${label} auditory sensor pod`, 'Head optics',
      'Carries the lateral acoustic aperture beside the cranium.',
      'A short cylinder and two cones clamp a teal sensor bead on a rubber isolation ring.', head, [side * .13, .06, 0], 'Titanium, rubber and optical glass');
    bore(sensor, 'titanium', [side * .155, .060, -.055], .032, .058, 'x');
    add(sensor, 'cone', 'dark', [side * .190, .060, -.055], [.032, .045, .032], [0, 0, side * Math.PI / 2]);
    add(sensor, 'sphere', 'teal', [side * .212, .060, -.055], [.015, .015, .015]);
    seal(sensor, [side * .151, .060, -.055], .036, 'x');

    const antenna = part(`head.antenna.${id}`, `${label} telemetry antenna`, 'Head service',
      'Keeps the head telemetry link clear of the shoulder envelope.',
      'Two tapered rods rise from a bolted base and end in a small teal inspection bead.', head, [side * .09, .15, 0]);
    antenna.position.set(side * .090, .155, .060);
    rod(antenna, 'dark', [0, 0, 0], [side * .025, .100, .040], .008);
    rod(antenna, 'titanium', [side * .025, .100, .040], [side * .048, .160, .075], .004);
    add(antenna, 'sphere', 'teal', [side * .048, .160, .075], [.011, .011, .011]);
    plate(antenna, 'brass', [0, -.008, 0], [.034, .016, .034]);
    antennae.push({ node: antenna, side, base: antenna.quaternion.clone() });
  }

  const crest = part('head.crest', 'Dorsal crest and cable clamp', 'Head service',
    'Routes the head harness over the cranium and away from the visor.',
    'Three separated fins and a clamp rail sit behind the boldest silhouette of the skull.', head, [0, .14, .02], 'Titanium and pale alloy');
  for (let k = 0; k < 3; k++) {
    plate(crest, 'titanium', [0, .165 + k * .024, .030 + k * .042], [.016, .060 - k * .010, .070], [.35, 0, 0]);
    add(crest, 'sphere', 'teal', [0, .165 + k * .024, .068 + k * .042], [.008, .006, .004]);
  }
  rod(crest, 'rubber', [-.060, .150, .075], [.060, .150, .075], .010);
  kit.fasteners(crest, [[-.048, .160, .058], [.048, .160, .058]], .008);

  const chin = part('head.chin', 'Chin guard and lower face frame', 'Head optics',
    'Closes the lower helmet silhouette while leaving the mandible free to open.',
    'A shell chin cup and a titanium crossbar hang under the visor with two rubber bump stops.', head, [0, .02, -.06], 'Formed pale shell, titanium crossbar and rubber bump stop');
  add(chin, 'sphere', 'shell', [0, -.005, -.175], [.095, .040, .055]);
  plate(chin, 'titanium', [0, -.030, -.205], [.150, .016, .025]);
  for (const side of [-1, 1]) add(chin, 'sphere', 'rubber', [side * .060, -.035, -.195], [.010, .008, .008]);

  const scanRing = part('head.scanRing', 'Rotating sensor scan ring', 'Head service',
    'Sweeps the short-range sensor ring around the helmet for a visible scan.',
    'A titanium ring with three teal apertures and a brass drive collar turns around the head gimbal.', head, [0, .09, .02], 'Titanium ring, teal apertures and brass drive collar');
  scanRing.position.set(0, .060, -.020);
  add(scanRing, 'ring', 'titanium', [0, 0, 0], [.165, .165, .165], [Math.PI / 2, 0, 0]);
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3;
    add(scanRing, 'sphere', 'teal', [.165 * Math.cos(a), 0, .165 * Math.sin(a)], [.014, .008, .008]);
  }
  add(scanRing, 'cylinder', 'brass', [0, .020, 0], [.035, .025, .035]);
  scanRings.push({ node: scanRing });

  const jawGroup = new THREE.Group();
  jawGroup.name = 'head.jawGroup';
  head.add(jawGroup);
  jawGroup.position.set(0, -.055, -.075);
  const jaw = part('head.jaw', 'Articulated mandible', 'Head optics',
    'Opens the lower jaw to expose the sensor throat and jaw actuators.',
    'A rigid boxed mandible hinges on a transverse pin and carries five separated tooth cones.', jawGroup, [0, .03, -.03], 'Dark alloy and brass');
  plate(jaw, 'dark', [0, -.038, -.100], [.165, .052, .180]);
  plate(jaw, 'titanium', [0, -.006, -.115], [.180, .020, .140]);
  plate(jaw, 'shell', [0, -.060, -.070], [.125, .025, .085]);
  bore(jaw, 'brass', [0, 0, 0], .019, .190, 'x');
  for (let k = 0; k < 5; k++) {
    const x = -.060 + k * .030;
    add(jaw, 'cone', 'titanium', [x, .006, -.115 - k * .020], [.010, .028, .010], [Math.PI, 0, 0]);
  }
  for (const side of [-1, 1]) add(jaw, 'bolt', 'titanium', [side * .090, -.030, -.030], [.014, .013, .014], [0, 0, Math.PI / 2], true);
  add(jaw, 'sphere', 'teal', [0, -.055, -.195], [.020, .008, .005]);

  const upperTeeth = part('head.teeth', 'Upper tooth rail', 'Head optics',
    'Marks the fixed bite plane inside the open face frame.',
    'Five short cones hang from a narrow rail and stay clear of the rotating mandible.', head, [0, .04, -.03], 'Titanium');
  rod(upperTeeth, 'dark', [-.078, -.022, -.100], [.078, -.022, -.100], .013);
  for (let k = 0; k < 5; k++) add(upperTeeth, 'cone', 'titanium', [-.064 + k * .032, -.048, -.106 - k * .020], [.009, .026, .009], [Math.PI, 0, 0], k > 2);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const actuator = part(`head.jawActuator.${id}`, `${label} jaw actuator`, 'Head service',
      'Drives the mandible through a short, visible hydraulic pair.',
      'A sleeve bolted under the cheek feeds a polished rod down to the jaw pin.', head, [side * .08, .02, 0], 'Titanium and brass hydraulic seals');
    actuator.position.set(side * .088, -.010, -.062);
    bore(actuator, 'titanium', [0, 0, 0], .017, .065, 'y');
    bore(actuator, 'brass', [0, .040, 0], .010, .050, 'y');
    seal(actuator, [0, .020, 0], .020, 'y');
    jawActuators.push({ node: actuator, side });
  }

  // ================================================================== arms
  for (const [handIndex, hand] of lastState.hands.entries()) {
    const id = hand.id, label = hand.side < 0 ? 'Left' : 'Right', side = hand.side;
    const upper = part(`arm.${id}.upper`, `${label} upper-arm truss`, 'Arm drive',
      'Transfers shoulder actuator torque into the elbow bearing.',
      'Two parallel rails, two end rings and three cross-braces keep the arm open and rigid inside its armour.', torso, [side * .08, .05, 0]);
    for (const x of [-.028, .028]) rod(upper, 'titanium', [x, 0, 0], [x, D.upperArm, 0], .013);
    plate(upper, 'titanium', [.036, D.upperArm * .48, 0], [.015, D.upperArm * .58, .070]);
    add(upper, 'sphere', 'titanium', [0, .012, 0], [.048, .042, .044]);
    eye(upper, [0, 0, 0], .030, 'brass', 'x');
    eye(upper, [0, D.upperArm, 0], .028, 'titanium', 'x');
    for (const f of [.26, .5, .74]) {
      rod(upper, 'dark', [-.030, D.upperArm * f, 0], [.030, D.upperArm * f, 0], .0055, true);
      add(upper, 'bolt', 'titanium', [0, D.upperArm * f, -.019], [.007, .011, .007], [Math.PI / 2, 0, 0], true);
    }
    rod(upper, 'copper', [-.027, .04, .016], [-.027, D.upperArm - .04, .016], .004, true);

    const upperArmor = part(`arm.${id}.upperArmor`, `${label} upper-arm armour shell`, 'Arm armor',
      'Builds the heavy bicep silhouette over the open shoulder-to-elbow truss.',
      'Three shell leaves, a dark underplate and a titanium edge rail wrap the truss without hiding its pins.', upper, [side * .02, .02, 0], 'Formed pale shell, dark underplate and titanium rail');
    layered(upperArmor, [0, D.upperArm * .50, .010], [.125, D.upperArm * .58, .155], [0, 0, 0]);
    plate(upperArmor, 'shell', [side * .052, D.upperArm * .52, -.010], [.045, D.upperArm * .45, .100], [0, side * .10, 0]);
    for (let k = 0; k < 3; k++) plate(upperArmor, 'dark', [side * .040, D.upperArm * .31 + k * .075, -.078], [.012, .035, .016], [0, 0, 0], true);
    add(upperArmor, 'sphere', 'teal', [0, D.upperArm * .78, -.086], [.014, .010, .006]);
    kit.fasteners(upperArmor, [[-.038, D.upperArm * .72, -.060], [.038, D.upperArm * .72, -.060]], .008);

    const fore = part(`arm.${id}.forearm`, `${label} forearm truss`, 'Arm drive',
      'Carries the wrist and manipulator through a rigid open frame.',
      'Paired rails, two bearing rings and three spacers join elbow to wrist without a shell tube.', torso, [side * .08, -.02, 0]);
    for (const x of [-.026, .026]) rod(fore, 'titanium', [x, 0, 0], [x, D.forearm, 0], .012);
    plate(fore, 'titanium', [.034, D.forearm * .5, 0], [.013, D.forearm * .62, .060]);
    eye(fore, [0, 0, 0], .029, 'brass', 'x');
    eye(fore, [0, D.forearm, 0], .027, 'titanium', 'x');
    for (const f of [.24, .5, .76]) rod(fore, 'dark', [-.028, D.forearm * f, 0], [.028, D.forearm * f, 0], .0050, true);
    rod(fore, 'rubber', [.028, .05, .014], [.028, D.forearm - .05, .014], .0035, true);

    const gauntlet = part(`arm.${id}.gauntlet`, `${label} forearm gauntlet`, 'Arm armor',
      'Armours the forearm while keeping the wrist bearing and hose run open.',
      'A tapered shell gauntlet, two titanium hinge cheeks and four copper sensor leads ride the forearm rails.', fore, [side * .02, -.02, 0], 'Formed pale shell, titanium cheeks and copper leads');
    layered(gauntlet, [0, D.forearm * .50, .012], [.140, D.forearm * .58, .150], [0, 0, 0]);
    plate(gauntlet, 'titanium', [side * .062, D.forearm * .52, -.010], [.020, D.forearm * .50, .090], [0, side * .12, 0]);
    for (let k = 0; k < 4; k++) rod(gauntlet, 'copper', [side * .058, .06 + k * .075, -.070], [side * .058, .080 + k * .075, -.070], .0035, true);
    add(gauntlet, 'sphere', 'teal', [0, D.forearm * .82, -.082], [.016, .010, .006]);
    kit.fasteners(gauntlet, [[-.042, D.forearm * .74, -.058], [.042, D.forearm * .74, -.058]], .008);

    const elbow = part(`arm.${id}.elbow`, `${label} elbow hinge`, 'Arm drive',
      'Provides the single elbow pitch axis.',
      'A brass pin and two side bolts clamp the forearm truss between the upper-arm rails.', torso, [side * .06, 0, 0]);
    plate(elbow, 'titanium', [0, 0, 0], [.050, .050, .050]);
    eye(elbow, [0, 0, 0], .040, 'brass', 'x');
    for (const s of [-1, 1]) add(elbow, 'bolt', 'dark', [s * .035, 0, 0], [.010, .016, .010], [0, 0, Math.PI / 2], true);

    const elbowGuard = part(`arm.${id}.elbowGuard`, `${label} elbow guard and stop`, 'Arm armor',
      'Defends the elbow hinge and its hydraulic clevis.',
      'A shell cup on a titanium stop block covers the rear of the joint and leaves the pin exposed.', fore, [side * .03, -.02, 0], 'Formed pale shell, titanium stop block and rubber bumper');
    add(elbowGuard, 'sphere', 'shell', [0, .015, .055], [.060, .060, .034]);
    plate(elbowGuard, 'titanium', [0, .010, .086], [.045, .032, .022]);
    add(elbowGuard, 'sphere', 'rubber', [0, -.010, .090], [.030, .014, .010]);

    const wrist = part(`arm.${id}.wrist`, `${label} wrist roll bearing`, 'Arm drive',
      'Locates the hand frame on the forearm.',
      'A narrow bearing ring and two retaining bolts sit ahead of the forearm end ring.', torso, [side * .05, -.02, 0]);
    eye(wrist, [0, 0, 0], .032, 'titanium', 'y');
    bore(wrist, 'brass', [0, .015, 0], .018, .028, 'y');

    const handNode = part(`hand.${id}.frame`, `${label} wrist frame`, 'Manipulator',
      'Carries all five digits in the sampled hand orientation.',
      'A compact frame clamps the wrist bearing and leaves the palm plate and knuckles separate.', torso, [side * .05, -.02, 0]);
    eye(handNode, [0, 0, 0], .030, 'brass', 'y');
    bore(handNode, 'titanium', [0, -.012, 0], .024, .032, 'y');

    const wristGear = part(`hand.${id}.wristGear`, `${label} wrist roll gear`, 'Manipulator',
      'Makes the wrist roll visible between the gauntlet and the palm.',
      'A brass pinion with eight exposed teeth turns on the wrist shaft as the hand orients.', handNode, [0, .01, 0], 'Brass pinion and dark hub');
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8;
      plate(wristGear, 'brass', [.034 * Math.cos(a), 0, .034 * Math.sin(a)], [.012, .012, .018], [0, -a, 0]);
    }
    add(wristGear, 'cylinder', 'dark', [0, 0, 0], [.022, .020, .022]);
    gears.push({ node: wristGear, ratio: 2, base: wristGear.quaternion.clone(), local: true });

    const palm = part(`hand.${id}.palm`, `${label} palm plate`, 'Manipulator',
      'Provides the rigid palm datum for the five digit chains.',
      'A machined plate, a shell dorsal cover and a teal palm sensor bolt onto the wrist frame with four service points.', handNode, [0, .02, 0], 'Titanium, pale alloy cover and teal sensor');
    plate(palm, 'dark', [0, D.palmY, 0], [.125, .105, .058]);
    plate(palm, 'shell', [0, D.palmY + .005, .034], [.110, .082, .014]);
    add(palm, 'sphere', 'lens', [0, D.palmY + .010, -.031], [.014, .014, .006]);
    plate(palm, 'titanium', [0, D.palmY + .054, -.010], [.060, .018, .030], [0, 0, 0], true);
    kit.fasteners(palm, [[-.048, D.palmY + .042, -.026], [.048, D.palmY + .042, -.026], [-.048, D.palmY + .042, .030], [.048, D.palmY + .042, .030]], .007);

    const knuckle = part(`hand.${id}.knuckleGuard`, `${label} knuckle guard`, 'Manipulator armor',
      'Protects the knuckle line without hiding the digit hinges.',
      'Three separated slats, a pale rail and a titanium hinge bar float ahead of the palm plate.', handNode, [0, .03, 0], 'Formed pale alloy shell');
    plate(knuckle, 'shell', [0, D.palmY + .056, -.038], [.122, .020, .038]);
    for (let k = 0; k < 3; k++) plate(knuckle, 'titanium', [-.038 + k * .038, D.palmY + .052, -.060], [.026, .009, .014], [0, 0, 0], true);
    rod(knuckle, 'dark', [-.058, D.palmY + .072, -.055], [.058, D.palmY + .072, -.055], .006, true);
    kit.fasteners(knuckle, [[-.050, D.palmY + .064, -.038], [.050, D.palmY + .064, -.038]], .006);

    const gripGear = part(`hand.${id}.gripGear`, `${label} grip drive pinion`, 'Manipulator',
      'Drives all five digit hinges from one visible palm pinion.',
      'An eight-tooth brass pinion turns at the knuckle line behind the guard, with a dark output hub.', handNode, [0, .035, 0], 'Brass pinion and dark output hub');
    gripGear.position.set(0, D.palmY + .015, .030);
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8;
      plate(gripGear, 'brass', [.028 * Math.cos(a), .028 * Math.sin(a), 0], [.010, .014, .008], [0, 0, a]);
    }
    add(gripGear, 'cylinder', 'dark', [0, 0, 0], [.018, .014, .018], [Math.PI / 2, 0, 0]);
    gears.push({ node: gripGear, ratio: 3, base: gripGear.quaternion.clone(), axis: 'z' });

    for (const finger of hand.fingers) {
      const digit = finger.index + 1, thumb = finger.thumb;
      const group = new THREE.Group();
      group.name = `hand.${id}.digit.${digit}`;
      const [l1, l2] = D.fingerLengths[finger.index];
      if (thumb) {
        group.position.set(side * .056, D.palmY - .006, -.038);
        group.rotation.set(-.42, side * .85, side * .38);
      } else {
        group.position.set(finger.x, D.knuckleY, 0);
      }
      handNode.add(group);
      const prox = part(`finger.${id}.${digit}.proximal`, `${label} digit ${digit} proximal phalanx`, 'Manipulator',
        `Keeps the ${Math.round(l1 * 1000)} mm proximal phalanx rigid through the grip.`,
        'Two rails, a hinge collar and a rubber contact pad rotate on the knuckle pin.', group, [0, .02, 0], 'Titanium rails and rubber pads');
      for (const x of [-.009, .009]) rod(prox, 'titanium', [x, 0, 0], [x, -l1, 0], .0050);
      bore(prox, 'brass', [0, 0, 0], .013, .024, 'x');
      plate(prox, 'rubber', [0, -l1 + .018, -.008], [.030, .015, .009], [0, 0, 0], true);
      plate(prox, 'shell', [0, -l1 * .45, .009], [.022, l1 * .62, .008], [0, 0, 0], true);
      add(prox, 'bolt', 'dark', [0, -l1, 0], [.011, .006, .011], [0, 0, Math.PI / 2], true);

      const distalGroup = new THREE.Group();
      distalGroup.position.set(0, -l1, 0);
      group.add(distalGroup);
      const distal = part(`finger.${id}.${digit}.distal`, `${label} digit ${digit} distal phalanx`, 'Manipulator',
        `Keeps the ${Math.round(l2 * 1000)} mm distal phalanx rigid at every grip angle.`,
        'A shorter rail pair, a hinge collar and a rounded rubber tip rotate on the middle hinge without stretching.', distalGroup, [0, .02, 0], 'Titanium rails and rubber tip');
      for (const x of [-.008, .008]) rod(distal, 'titanium', [x, 0, 0], [x, -l2, 0], .0045);
      bore(distal, 'brass', [0, 0, 0], .011, .021, 'x');
      plate(distal, 'shell', [0, -l2 * .45, .007], [.020, l2 * .58, .007], [0, 0, 0], true);
      add(distal, 'sphere', 'rubber', [0, -l2 - .004, -.002], [.009, .013, .009]);
      add(distal, 'bolt', 'brass', [0, -l2 * .55, -.008], [.006, .004, .006], [0, 0, 0], true);
      add(prox, 'bolt', 'titanium', [0, 0, -.012], [.010, .010, .010], [Math.PI / 2, 0, 0], true);
      fingerChains.push({ group, distalGroup, side: hand.side, handIndex, digit: finger.index, thumb });
    }

    const armCable = part(`arm.${id}.cableDress`, `${label} arm cable dress`, 'Electrical service',
      'Runs the elbow and wrist conductors outside both armour shells.',
      'A rubber sleeve, four copper conductors and two brass clamps bridge the bicep and gauntlet service ports.', fore, [side * .02, -.02, 0], 'Rubber sleeve, copper conductors and brass clamps');
    for (let k = 0; k < 4; k++) rod(armCable, 'rubber', [side * .055, .04 + k * .070, .055], [side * .060, .060 + k * .070, .060], .0050);
    for (let k = 0; k < 4; k++) rod(armCable, 'copper', [side * .060, .042 + k * .070, .058], [side * .065, .062 + k * .070, .063], .0025, true);
    plate(armCable, 'brass', [side * .058, .035, .058], [.020, .025, .020], [0, 0, 0], true);
    plate(armCable, 'brass', [side * .060, D.forearm - .045, .058], [.020, .025, .020], [0, 0, 0], true);

    const shoulderActuator = piston(`arm.${id}.shoulderActuator`, `${label} shoulder`, 'Hydraulic service',
      'Holds the shoulder abduction angle against the upper-arm load.',
      'A short sleeve is pinned to the clavicle boss and its shaft follows the sampled upper-arm clevis.', torso, [side * .10, .06, -.03]);
    const elbowActuator = piston(`arm.${id}.elbowActuator`, `${label} elbow`, 'Hydraulic service',
      'Drives the elbow through its full sampled flexion range.',
      'A sleeve on the upper-arm rail feeds a shaft to the forearm clevis behind the gauntlet.', torso, [side * .10, .04, -.03]);
    pistons.push({
      pair: shoulderActuator,
      a: pose => [pose.hands[handIndex].shoulder[0] + side * .085, pose.hands[handIndex].shoulder[1] - .04, pose.hands[handIndex].shoulder[2] - .10],
      b: pose => {
        const h = pose.hands[handIndex], d = sub3(h.elbow, h.shoulder);
        return [h.shoulder[0] + d[0] * .45 + side * .070, h.shoulder[1] + d[1] * .45 - .02, h.shoulder[2] + d[2] * .45 - .09];
      },
    });
    pistons.push({
      pair: elbowActuator,
      a: pose => {
        const h = pose.hands[handIndex], d = sub3(h.elbow, h.shoulder);
        return [h.shoulder[0] + d[0] * .58 + side * .072, h.shoulder[1] + d[1] * .58 - .02, h.shoulder[2] + d[2] * .58 - .09];
      },
      b: pose => {
        const h = pose.hands[handIndex], d = sub3(h.wrist, h.elbow);
        return [h.elbow[0] + d[0] * .34 + side * .070, h.elbow[1] + d[1] * .34 - .02, h.elbow[2] + d[2] * .34 - .09];
      },
    });

    arms.push({ id, side, hand: handNode, upper, fore, elbow, wrist, palm, upperArmor, gauntlet, wristGear, gripGear });
  }

  // ================================================================== legs
  for (const [legIndex, leg] of lastState.legs.entries()) {
    const id = leg.id, label = leg.side < 0 ? 'Left' : 'Right', side = leg.side;
    const thigh = part(`leg.${id}.thigh`, `${label} thigh truss`, 'Leg drive',
      'Carries the knee through the planted and swinging halves of the gait.',
      'Paired rails, two bearing rings and three cross-braces stay exactly 450 mm pin to pin inside the armour.', body, [side * .08, 0, 0]);
    const shin = part(`leg.${id}.shin`, `${label} shin truss`, 'Leg drive',
      'Transfers knee motion to the ankle with a rigid 470 mm link.',
      'Two rails and two end rings frame an open shin; the hydraulic rods run outside the greave.', body, [side * .07, 0, 0]);
    const kneeNode = part(`leg.${id}.knee`, `${label} knee hinge`, 'Leg drive',
      'Defines the single knee pitch axis.',
      'A brass pin and two outboard retainers clamp the shin between the thigh rails.', body, [side * .06, 0, 0]);
    const ankleNode = part(`leg.${id}.ankle`, `${label} ankle hinge`, 'Leg drive',
      'Connects the shin to the level foot link.',
      'A transverse pin and two bolts hold the foot level while the shin pitches over it.', body, [side * .05, 0, 0]);
    const footNode = part(`leg.${id}.foot`, `${label} service boot and sole`, 'Foot support',
      'Keeps one level contact plate under the ankle through the whole cycle.',
      'A machined sole, heel block, three toe plates and a shell boot upper stay parallel to the datum floor.', body, [side * .05, .02, 0], 'Titanium sole, pale boot shell and rubber tread');
    const metatarsus = part(`leg.${id}.metatarsus`, `${label} 140 mm foot link`, 'Foot support',
      'Holds the sole 140 mm below and ahead of the ankle pin.',
      'A single rigid link with two clevises fixes the ankle-to-sole offset at every pose.', body, [side * .05, 0, 0]);
    for (const x of [-.012, .012]) rod(metatarsus, 'titanium', [x, 0, 0], [x, Math.hypot(...D.ankleLift), 0], .008);
    bore(metatarsus, 'brass', [0, 0, 0], .016, .034, 'x');
    bore(metatarsus, 'brass', [0, Math.hypot(...D.ankleLift), 0], .015, .032, 'x');
    rod(metatarsus, 'dark', [-.020, .06, 0], [.020, .06, 0], .0045, true);

    const thighSleeve = part(`leg.${id}.thighSleeve`, `${label} thigh actuator sleeve`, 'Hydraulic service',
      'Shows the main lift actuator between hip and knee.',
      'The sleeve is pinned near the hip and the polished rod emerges toward a knee clevis.', body, [side * .09, 0, 0]);
    const thighRod = part(`leg.${id}.thighRod`, `${label} thigh actuator rod`, 'Hydraulic service',
      'Extends and retracts with the solved knee angle.',
      'A polished shaft and clevis follow the sampled joint; the extension is geometry, not pressure.', body, [side * .09, 0, 0]);
    bore(thighSleeve, 'titanium', [0, .09, 0], .026, .18, 'y');
    seal(thighSleeve, [0, .18, 0], .030, 'y');
    eye(thighSleeve, [0, 0, 0], .027, 'brass', 'z');
    plate(thighSleeve, 'dark', [0, .05, -.030], [.028, .060, .012], [0, 0, 0], true);
    bore(thighRod, 'titanium', [0, .095, 0], .012, .19, 'y');
    add(thighRod, 'sphere', 'brass', [0, 0, 0], [.021, .021, .021]);
    add(thighRod, 'bolt', 'dark', [0, .18, 0], [.015, .012, .015], [0, 0, Math.PI / 2]);

    plate(footNode, 'dark', [0, -.028, -.050], [.180, .048, .255]);
    plate(footNode, 'rubber', [0, -.052, -.050], [.172, .012, .250]);
    plate(footNode, 'titanium', [0, -.010, .075], [.155, .060, .080]);
    plate(footNode, 'shell', [0, .010, -.045], [.170, .052, .190]);
    plate(footNode, 'titanium', [0, -.012, -.170], [.165, .030, .050], [.12, 0, 0]);
    for (let k = 0; k < 3; k++) {
      const toe = part(`leg.${id}.toe.${k + 1}`, `${label} toe plate ${k + 1} of three`, 'Foot support',
        'Extends the contact patch forward without merging the toe plates.',
        'A short plate and hinge pin sit on the sole and stay level with the foot frame.', footNode, [0, .01, -.03], 'Titanium and rubber tread');
      bore(toe, 'brass', [(-.050 + k * .050), -.005, -.165], .011, .055, 'x');
      plate(toe, 'titanium', [-.050 + k * .050, -.024, -.245], [.042, .019, .130]);
      plate(toe, 'rubber', [-.050 + k * .050, -.035, -.255], [.039, .008, .110], [0, 0, 0], true);
      plate(toe, 'shell', [-.050 + k * .050, .000, -.215], [.040, .022, .050], [.15, 0, 0], true);
    }
    plate(kneeNode, 'titanium', [0, 0, 0], [.055, .055, .055]);
    eye(kneeNode, [0, 0, 0], .048, 'brass', 'x');
    for (const s of [-1, 1]) add(kneeNode, 'bolt', 'dark', [s * .040, 0, 0], [.012, .018, .012], [0, 0, Math.PI / 2], true);
    eye(ankleNode, [0, 0, 0], .041, 'titanium', 'x');

    for (const x of [-.028, .028]) rod(thigh, 'titanium', [x, 0, 0], [x, D.thigh, 0], .015);
    plate(thigh, 'titanium', [.039, D.thigh * .48, 0], [.015, D.thigh * .60, .080]);
    for (const z of [-.019, .019]) rod(thigh, 'dark', [-.028, .12, z], [.028, .12, z], .0045, true);
    eye(thigh, [0, 0, 0], .034, 'brass', 'x');
    eye(thigh, [0, D.thigh, 0], .032, 'titanium', 'x');
    for (const f of [.30, .55, .80]) rod(thigh, 'dark', [-.028, D.thigh * f, 0], [.028, D.thigh * f, 0], .0055, true);
    rod(thigh, 'copper', [.030, .05, .020], [.030, D.thigh - .05, .020], .004, true);

    for (const x of [-.026, .026]) rod(shin, 'titanium', [x, 0, 0], [x, D.shin, 0], .014);
    plate(shin, 'titanium', [.037, D.shin * .48, 0], [.013, D.shin * .58, .070]);
    for (const z of [-.017, .017]) rod(shin, 'copper', [-.025, .10, z], [-.025, .40, z], .004, true);
    eye(shin, [0, 0, 0], .032, 'brass', 'x');
    eye(shin, [0, D.shin, 0], .030, 'titanium', 'x');
    for (const f of [.28, .52, .76]) rod(shin, 'dark', [-.025, D.shin * f, 0], [.025, D.shin * f, 0], .0055, true);

    const thighArmor = part(`leg.${id}.thighArmor`, `${label} thigh armour shell`, 'Leg armor',
      'Turns the open thigh truss into a heavy powered leg silhouette.',
      'Three shell leaves, a dark underplate and two titanium wear strips wrap the truss and clear the knee clevis.', thigh, [side * .03, 0, 0], 'Formed pale shell, dark underplate and titanium wear strip');
    layered(thighArmor, [0, D.thigh * .46, .015], [.155, D.thigh * .56, .185], [0, 0, 0]);
    plate(thighArmor, 'shell', [side * .066, D.thigh * .48, -.010], [.050, D.thigh * .46, .120], [0, side * .10, 0]);
    for (let k = 0; k < 3; k++) plate(thighArmor, 'dark', [side * .052, D.thigh * .28 + k * .080, -.095], [.014, .040, .016], [0, 0, 0], true);
    add(thighArmor, 'sphere', 'teal', [0, D.thigh * .78, -.100], [.016, .010, .006]);
    kit.fasteners(thighArmor, [[-.046, D.thigh * .70, -.072], [.046, D.thigh * .70, -.072]], .009);

    const thighPlate = part(`leg.${id}.thighForeign`, `${label} thigh front armour leaf`, 'Leg armor',
      'Adds a separate front leaf so the thigh armour reads as overlapping plate.',
      'A titanium hinge bar and a pale front leaf ride the thigh shell and overlap the hip skirt in silhouette.', thigh, [side * .03, .01, 0], 'Formed pale shell, titanium hinge bar and copper trim');
    layered(thighPlate, [0, D.thigh * .38, -.105], [.135, D.thigh * .36, .045], [.06, 0, 0]);
    rod(thighPlate, 'titanium', [-.058, D.thigh * .20, -.120], [.058, D.thigh * .20, -.120], .007, true);
    add(thighPlate, 'sphere', 'teal', [side * .040, D.thigh * .54, -.132], [.012, .010, .005]);

    const kneeGuard = part(`leg.${id}.kneeGuard`, `${label} knee cover and guard`, 'Leg armor',
      'Protects the knee hinge while keeping the hydraulic clevis exposed.',
      'A pale cover rides the shin on two posts and carries three raised wear ribs.', shin, [side * .03, .02, 0], 'Formed pale alloy shell');
    add(kneeGuard, 'sphere', 'shell', [0, .035, -.065], [.058, .060, .026]);
    plate(kneeGuard, 'titanium', [0, .050, -.086], [.080, .030, .018]);
    for (let k = 0; k < 3; k++) plate(kneeGuard, 'titanium', [-.032 + k * .032, .066, -.074], [.013, .020, .009], [0, 0, 0], true);
    add(kneeGuard, 'sphere', 'teal', [0, .010, -.084], [.014, .010, .005]);
    kit.fasteners(kneeGuard, [[-.034, .075, -.060], [.034, .075, -.060]], .006);

    const greave = part(`leg.${id}.greave`, `${label} shin greave`, 'Leg armor',
      'Armours the shin from knee to ankle while leaving both actuator rods visible.',
      'Three overlapping shell leaves and a titanium shin ridge are pinned to the shin rails above the ankle hinge.', shin, [side * .03, 0, 0], 'Formed pale shell, titanium shin ridge and copper trim');
    layered(greave, [0, D.shin * .46, .012], [.150, D.shin * .58, .180], [0, 0, 0]);
    plate(greave, 'shell', [side * .062, D.shin * .48, -.010], [.048, D.shin * .48, .115], [0, side * .10, 0]);
    plate(greave, 'titanium', [0, D.shin * .45, -.095], [.018, D.shin * .48, .020]);
    for (let k = 0; k < 3; k++) plate(greave, 'dark', [0, D.shin * .30 + k * .090, -.110], [.065, .012, .010], [0, 0, 0], true);
    add(greave, 'sphere', 'teal', [0, D.shin * .75, -.098], [.016, .010, .006]);
    kit.fasteners(greave, [[-.046, D.shin * .68, -.075], [.046, D.shin * .68, -.075]], .009);

    const shinVent = part(`leg.${id}.shinVent`, `${label} shin heat vent`, 'Leg armor',
      'Lets the knee actuator heat escape through the greave.',
      'A titanium vent frame with four dark slats and a copper heat tab sits on the outer greave flank.', shin, [side * .04, 0, 0], 'Titanium vent frame, dark slats and copper heat tab');
    plate(shinVent, 'titanium', [side * .073, D.shin * .55, -.035], [.020, .120, .075]);
    for (let k = 0; k < 4; k++) plate(shinVent, 'dark', [side * .084, D.shin * .51 + k * .028, -.035], [.008, .012, .060], [0, 0, 0], true);
    plate(shinVent, 'copper', [side * .080, D.shin * .65, -.035], [.008, .035, .040], [0, 0, 0], true);

    const thighHose = part(`leg.${id}.thighHose`, `${label} thigh service hose`, 'Hydraulic service',
      'Carries actuator feed along the outside of the moving thigh truss.',
      'Five short rubber links and a copper conductor zigzag beside the thigh armour and stay clear of the opposite leg.', thigh, [side * .02, 0, 0], 'Rubber hose, copper conductor and brass fittings');
    for (let k = 0; k < 5; k++) {
      const a = [side * .042, .07 + k * .075, -.028], b = [side * .042 + side * .012, .07 + (k + 1) * .075, -.028];
      rod(thighHose, 'rubber', a, b, .0055);
      rod(thighHose, 'copper', [a[0], a[1], a[2] - .007], [b[0], b[1], b[2] - .007], .0025, true);
    }
    add(thighHose, 'bolt', 'brass', [side * .042, .07, -.028], [.010, .010, .010], [Math.PI / 2, 0, 0], true);

    const calfHose = part(`leg.${id}.calfHose`, `${label} calf service hose`, 'Hydraulic service',
      'Feeds the ankle and calf actuators down the rear greave.',
      'Five rubber links, a copper conductor and two brass bulkheads follow the shin without bridging the ankle pin.', shin, [side * .02, 0, 0], 'Rubber hose, copper conductor and brass bulkheads');
    for (let k = 0; k < 5; k++) {
      const a = [side * .040, .08 + k * .082, .055], b = [side * .050, .10 + k * .082, .062];
      rod(calfHose, 'rubber', a, b, .0050);
      rod(calfHose, 'copper', [a[0] + .006, a[1], a[2] + .004], [b[0] + .006, b[1], b[2] + .004], .0022, true);
    }
    plate(calfHose, 'brass', [side * .045, .075, .058], [.020, .020, .020], [0, 0, 0], true);

    const footArmor = part(`leg.${id}.footArmor`, `${label} boot armour and ankle collar`, 'Foot support',
      'Adds the broad service-boot shell around the level foot link.',
      'A shell upper, two titanium ankle cheeks and a rubber toe bumper sit on the foot without crossing the floor plane.', footNode, [side * .02, .02, 0], 'Formed pale shell, titanium cheeks and rubber bumper');
    plate(footArmor, 'shell', [0, .022, -.070], [.175, .040, .150], [.08, 0, 0]);
    for (const s of [-1, 1]) plate(footArmor, 'titanium', [s * .085, -.005, -.045], [.018, .050, .130], [0, 0, 0]);
    plate(footArmor, 'rubber', [0, -.025, -.190], [.160, .030, .030]);
    add(footArmor, 'sphere', 'teal', [0, .038, -.150], [.020, .009, .005]);
    kit.fasteners(footArmor, [[-.055, .035, -.080], [.055, .035, -.080]], .007);

    const footService = part(`leg.${id}.footService`, `${label} foot service pack`, 'Foot support',
      'Houses the heel servo and range sensor behind the ankle collar.',
      'A dark service block with a copper sensor lead and a teal range lamp is bolted above the heel.', footNode, [side * .02, .01, 0], 'Dark service block, copper lead and teal range lamp');
    plate(footService, 'dark', [0, .030, .115], [.075, .045, .060]);
    plate(footService, 'titanium', [0, .055, .110], [.085, .014, .070]);
    rod(footService, 'copper', [side * .025, .010, .125], [side * .025, .045, .150], .0035, true);
    add(footService, 'sphere', 'teal', [0, .030, .148], [.012, .008, .005]);

    const heel = part(`leg.${id}.heelServo`, `${label} heel trim servo`, 'Foot support',
      'Trims the level foot link behind the ankle hinge.',
      'A small cylinder and rod bridge the heel block and metatarsus without touching the ground.', footNode, [side * .02, -.01, 0], 'Titanium and rubber seals');
    bore(heel, 'titanium', [0, .045, .045], .015, .065, 'y');
    bore(heel, 'brass', [0, .015, .045], .008, .048, 'y');
    seal(heel, [0, .045, .045], .018, 'y');

    const kneeActuator = piston(`leg.${id}.kneeActuator`, `${label} knee`, 'Hydraulic service',
      'Drives the knee through the deeply flexed swing phase.',
      'A sleeve on the rear thigh feeds a shaft to the shin clevis beside the knee guard.', body, [side * .09, 0, 0]);
    const ankleActuator = piston(`leg.${id}.ankleActuator`, `${label} ankle`, 'Hydraulic service',
      'Keeps the sole level while the shin pitches over the planted foot.',
      'A short sleeve above the ankle feeds a shaft down to the heel clevis behind the foot collar.', body, [side * .06, 0, 0]);
    const calfActuator = piston(`leg.${id}.calfActuator`, `${label} calf`, 'Hydraulic service',
      'Adds the second visible load path down the rear of the shin.',
      'A long sleeve on the rear greave extends a polished shaft toward the ankle yoke.', body, [side * .07, 0, 0]);
    const hipActuator = piston(`leg.${id}.hipActuator`, `${label} hip pitch`, 'Hip drive',
      'Shows the main hip pitch actuator outside the pelvis skirt.',
      'A heavy sleeve is pinned to the hip yoke and a shaft follows the thigh clevis through the full stride.', body, [side * .10, 0, 0]);

    pistons.push({
      pair: { sleeve: thighSleeve, rod: thighRod, sleeveNominal: .18, rodNominal: .19 },
      a: pose => [pose.legs[legIndex].hip[0] + side * .045, pose.legs[legIndex].hip[1] + .06, pose.legs[legIndex].hip[2] - .055],
      b: pose => [pose.legs[legIndex].knee[0] + side * .045, pose.legs[legIndex].knee[1] + .06, pose.legs[legIndex].knee[2] - .055],
    });
    pistons.push({
      pair: kneeActuator,
      a: pose => {
        const g = pose.legs[legIndex], d = sub3(g.knee, g.hip);
        return [g.hip[0] + d[0] * .78 + side * .070, g.hip[1] + d[1] * .78 + .03, g.hip[2] + d[2] * .78 + .095];
      },
      b: pose => {
        const g = pose.legs[legIndex], d = sub3(g.ankle, g.knee);
        return [g.knee[0] + d[0] * .22 + side * .065, g.knee[1] + d[1] * .22 + .02, g.knee[2] + d[2] * .22 + .080];
      },
    });
    pistons.push({
      pair: ankleActuator,
      a: pose => {
        const g = pose.legs[legIndex], d = sub3(g.ankle, g.knee);
        return [g.knee[0] + d[0] * .68 + side * .058, g.knee[1] + d[1] * .68 + .01, g.knee[2] + d[2] * .68 + .055];
      },
      b: pose => [pose.legs[legIndex].footLocal[0] + side * .048, pose.legs[legIndex].footLocal[1] + .045, pose.legs[legIndex].footLocal[2] + .075],
    });
    pistons.push({
      pair: calfActuator,
      a: pose => {
        const g = pose.legs[legIndex], d = sub3(g.knee, g.hip);
        return [g.knee[0] - d[0] * .05 + side * .052, g.knee[1] - d[1] * .05, g.knee[2] - d[2] * .05 + .105];
      },
      b: pose => {
        const g = pose.legs[legIndex], d = sub3(g.ankle, g.knee);
        return [g.knee[0] + d[0] * .86 + side * .048, g.knee[1] + d[1] * .86, g.knee[2] + d[2] * .86 + .105];
      },
    });
    pistons.push({
      pair: hipActuator,
      a: pose => [pose.legs[legIndex].hip[0] + side * .090, pose.legs[legIndex].hip[1] + .10, .080],
      b: pose => {
        const g = pose.legs[legIndex], d = sub3(g.knee, g.hip);
        return [g.hip[0] + d[0] * .28 + side * .105, g.hip[1] + d[1] * .28 + .02, g.hip[2] + d[2] * .28 + .060];
      },
    });

    legs.push({ id, side, thigh, shin, metatarsus, kneeNode, ankleNode, footNode, thighArmor, greave, kneeGuard, footArmor });
  }

  // Bind every authored transform once, then restore it before every pose so
  // exploded-view offsets and secondary motion can never accumulate.
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function aimPiston(pair, a, b) { posePiston(pair, a, b, .64); }
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.legs && state?.hands && state?.head) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, state.controls || lastState.controls || {});
    for (const { node, p, q, s } of bind) { node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s); }
    const pose = lastState;
    const angle = pose.driveAngle;
    const sec = pose.secondary || {
      breath: Math.sin(2 * angle), shift: Math.sin(angle + .35), hipRoll: Math.sin(angle + .2),
      shoulderRoll: Math.sin(angle + 1.15) * .5 + Math.sin(3 * angle + .4) * .5,
      vent: .5 + .5 * Math.sin(2 * angle + .35), radiator: .5 + .5 * Math.sin(2 * angle + .95),
      tether: .5 + .5 * Math.sin(3 * angle + 1.1), scan: Math.sin(3 * angle + .65),
      handPulse: .5 + .5 * Math.sin(2 * angle + .5), gear: angle,
    };
    body.position.fromArray(pose.body.offset);
    torso.rotation.set(pose.torso.pitch || 0, pose.torso.yaw, pose.torso.roll || 0, 'YXZ');

    for (const [i, record] of legs.entries()) {
      const leg = pose.legs[i];
      aim(record.thigh, leg.hip, leg.knee);
      aim(record.shin, leg.knee, leg.ankle);
      aim(record.metatarsus, leg.ankle, leg.footLocal);
      record.kneeNode.position.fromArray(leg.knee);
      record.ankleNode.position.fromArray(leg.ankle);
      record.footNode.position.fromArray(leg.footLocal);
    }
    for (const [i, record] of arms.entries()) {
      const hand = pose.hands[i];
      aim(record.upper, hand.shoulder, hand.elbow);
      aim(record.fore, hand.elbow, hand.wrist);
      record.elbow.position.fromArray(hand.elbow);
      record.wrist.position.fromArray(hand.wrist);
      const b = hand.basis, { matrix, x, y, z } = scratch;
      matrix.makeBasis(x.fromArray(b.x), y.fromArray(b.y), z.fromArray(b.z));
      record.hand.position.fromArray(hand.wrist);
      record.hand.quaternion.setFromRotationMatrix(matrix);
    }
    for (const chain of fingerChains) {
      const finger = pose.hands[chain.handIndex].fingers[chain.digit];
      if (chain.thumb) {
        const side = chain.side;
        chain.group.rotation.set(-.42 + finger.proximal * .8, side * .85, side * .38 + finger.spread);
      } else chain.group.rotation.set(finger.proximal, 0, finger.spread);
      chain.distalGroup.rotation.x = finger.distal;
    }
    for (const pistonRow of pistons) posePiston(pistonRow.pair, pistonRow.a(pose), pistonRow.b(pose), pistonRow.overlap || .64);

    // Secondary hardware: bearings, gear trains and the pauldron counter-swing.
    for (const { node, ratio } of bearings) node.rotation.x = angle * ratio;
    for (const { node, ratio, base, axis } of gears) {
      const spinAxis = axis === 'z' ? scratch.z.set(0, 0, 1) : scratch.y.set(0, 1, 0);
      scratch.qs.setFromAxisAngle(spinAxis, angle * ratio);
      node.quaternion.copy(base).multiply(scratch.qs);
    }
    for (const { node, ratio } of rotors) {
      if (node === reel) continue;
      node.rotation.z = angle * ratio;
    }
    for (const record of pauldrons) {
      const hand = pose.hands[record.side < 0 ? 0 : 1];
      record.node.position.copy(record.base);
      record.node.position.y += .005 * sec.breath;
      record.node.rotation.set(-hand.swing * .62, 0, record.side * .055 * sec.breath, 'YXZ');
    }
    for (const plateRecord of chestPlates) {
      plateRecord.node.position.copy(plateRecord.base);
      plateRecord.node.position.y += (plateRecord.barrel ? .012 : .008) * plateRecord.factor * (0.5 + 0.5 * sec.breath);
      plateRecord.node.position.z += .0040 * plateRecord.factor * sec.breath;
    }
    for (const { node, side, base } of vents) {
      scratch.q0.setFromAxisAngle(scratch.x.set(1, 0, 0), (0.10 + 0.62 * sec.vent) * (side < 0 ? 1 : -1));
      node.quaternion.copy(base).multiply(scratch.q0);
    }
    for (const { node, base, open } of louvers) {
      scratch.q0.setFromAxisAngle(scratch.x.set(1, 0, 0), (0.08 + 0.68 * sec.radiator) * open);
      node.quaternion.copy(base).multiply(scratch.q0);
    }
    for (const { node, side, phase, amp } of cableDress) {
      node.rotation.z = amp * Math.sin(2 * angle + phase + (side < 0 ? 0 : .4));
    }
    for (const { node, index } of skirts) {
      node.position.y = .0032 * Math.sin(angle + index * 2.35);
      node.rotation.x = .022 * Math.sin(angle + index * 2.35 + .6);
    }
    for (const { node, side, base } of antennae) {
      scratch.q0.setFromAxisAngle(scratch.z.set(0, 0, 1), .055 * Math.sin(3 * angle + (side < 0 ? .2 : 2.1)));
      node.quaternion.copy(base).multiply(scratch.q0);
    }
    for (const { node } of scanRings) node.rotation.y = .62 * sec.scan + .22 * Math.sin(angle + .4);
    for (const { node } of visors) {
      node.position.x = .0022 * sec.scan;
      node.position.y = .0018 * sec.breath;
      node.position.z = .0040 * Math.sin(2 * angle + .5);
    }

    // Tether: the reel lives in torso space, the dock on the pelvis, so recoil
    // is solved between two honestly moving frames.
    const torsoRotation = scratch.euler.set(pose.torso.pitch || 0, pose.torso.yaw, pose.torso.roll || 0, 'YXZ');
    const reelPoint = scratch.point.set(0, .575, .245).applyEuler(torsoRotation).add(torso.position).toArray();
    const dock = [0, .085, .235];
    const sag = .012 + .010 * sec.tether;
    const lateral = .010 * Math.sin(2 * angle + .55);
    const tetherPoints = [
      dock,
      [dock[0] + (reelPoint[0] - dock[0]) * .34 + lateral * .4, dock[1] + (reelPoint[1] - dock[1]) * .34 - sag * .35, dock[2] + (reelPoint[2] - dock[2]) * .34 + .006],
      [dock[0] + (reelPoint[0] - dock[0]) * .70 - lateral * .3, dock[1] + (reelPoint[1] - dock[1]) * .70 - sag * .18, dock[2] + (reelPoint[2] - dock[2]) * .70 + .024],
      reelPoint,
    ];
    for (const link of tetherLinks) {
      const a = tetherPoints[link.index], b = tetherPoints[link.index + 1];
      aim(link.node, a, b);
      link.node.scale.y = Math.max(.20, length3(sub3(b, a)) / link.nominal);
    }
    reel.rotation.x = .45 * Math.sin(2 * angle + .7) + .9 * sec.tether;

    const neck = pose.neck.links;
    neckLinks.forEach((record, i) => { if (i < neck.length) aim(record.node, neck[i].start, neck[i].end); });
    head.position.fromArray(pose.head.origin);
    head.rotation.set(pose.head.pitch, pose.head.yaw, 0, 'YXZ');
    jawGroup.rotation.x = -pose.head.jaw;
    for (const { node, side } of jawActuators) {
      const closed = scratch.point.set(side * .065, -.095, -.180).applyAxisAngle(scratch.axis, -pose.head.jaw);
      aim(node, [side * .088, -.010, -.062], closed.toArray());
    }
    kit.sync(options);
  }
  update(lastState);

  // The complete heavy silhouette moves almost two metres between extremes, so
  // publish sampled whole-cycle instance corners for a tight, non-clipping camera fit.
  const framePoints = [], seen = new Set(), m4 = new THREE.Matrix4(), v4 = new THREE.Vector3();
  const corners = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];
  for (const [input, count] of [[undefined, 24], [{ stride: .36, lift: .20, grip: 55 }, 12], [{ stride: .12, lift: .05, grip: 0 }, 12]]) {
    for (let i = 0; i < count; i++) {
      update(sample(i / (count * .42), { cadence: .42, ...input }));
      for (const mesh of kit.pickables) {
        mesh.geometry.computeBoundingBox();
        const g = mesh.geometry.boundingBox;
        for (let j = 0; j < mesh.count; j++) {
          mesh.getMatrixAt(j, m4);
          for (const c of corners) {
            v4.set(c[0] < 0 ? g.min.x : g.max.x, c[1] < 0 ? g.min.y : g.max.y, c[2] < 0 ? g.min.z : g.max.z).applyMatrix4(m4);
            const key = `${Math.round(v4.x / .12)},${Math.round(v4.y / .12)},${Math.round(v4.z / .12)}`;
            if (!seen.has(key)) { seen.add(key); framePoints.push(v4.clone()); }
          }
        }
      }
    }
  }
  const fitPad = new THREE.Box3().setFromPoints(framePoints).expandByScalar(.060);
  for (const x of [fitPad.min.x, fitPad.max.x]) for (const y of [fitPad.min.y, fitPad.max.y]) for (const z of [fitPad.min.z, fitPad.max.z]) framePoints.push(new THREE.Vector3(x, y, z));
  update(sample(0));

  return {
    group: kit.group, update, framePoints, parts: kit.parts, stats: kit.stats,
    views: { home: [3.6, 2.5, 4.6], side: [5.2, 1.4, .6], front: [0, 1.35, 5.2], detail: [-3.6, 2.2, 4.0], exploded: [3.7, 2.9, 4.8] },
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
