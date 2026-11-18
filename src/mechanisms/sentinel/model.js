import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('SENTINEL H9 · bipedal exoskeleton');
  const nodes = [], legs = [], arms = [], fingerChains = [], neckLinks = [], jawActuators = [], rotors = [], pistons = [];
  const scratch = { matrix: new THREE.Matrix4(), x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), point: new THREE.Vector3(), axis: new THREE.Vector3(1, 0, 0) };
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
  const pillar = (node, a, b, radius, material = 'titanium', detail = false) => rod(node, material, a, b, radius, detail);
  const seal = (node, p, radius, axis = 'z') => {
    const euler = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'ring', 'rubber', p, [radius, radius, radius], euler, true);
    add(node, 'ring', 'brass', p, [radius * .72, radius * .72, radius * .72], euler, true);
  };

  // ---------------------------------------------------------------- pelvis
  const body = part('pelvis.chassis', 'Pelvis chassis and load spine', 'Pelvis structure',
    'Carries both hip yokes, the torso carrier and the entire upper-body load.',
    'A machined central block is bridged by two side plates; the hip yokes bolt to its outboard faces.', undefined, [0, 0, 0]);
  plate(body, 'dark', [0, .02, 0], [.34, .16, .24]);
  plate(body, 'titanium', [0, .095, -.02], [.27, .035, .19]);
  plate(body, 'shell', [0, .005, -.135], [.20, .10, .028]);
  for (const side of [-1, 1]) {
    plate(body, 'shell', [side * .185, .03, 0], [.04, .155, .215]);
    for (let k = 0; k < 3; k++) plate(body, 'dark', [side * .207, .075 - k * .043, .02], [.008, .018, .13], [0, 0, 0], true);
  }
  add(body, 'sphere', 'teal', [0, .035, -.152], [.032, .032, .012]);
  kit.fasteners(body, [[-.11, .115, -.075], [.11, .115, -.075], [-.11, .115, .075], [.11, .115, .075]], .012);

  const sacrum = part('pelvis.sacrum', 'Sacral bridge and spine socket', 'Pelvis structure',
    'Locks the lumbar vertebrae to the pelvis without hiding the hip actuators.',
    'A shallow arch and two bearing jaws clamp the lowest vertebra; four service bolts remain visible.', body);
  plate(sacrum, 'titanium', [0, .105, .10], [.16, .055, .10]);
  eye(sacrum, [0, .155, .10], .041, 'brass', 'x');
  for (const side of [-1, 1]) rod(sacrum, 'dark', [side * .045, .09, .11], [side * .095, .02, .12], .012);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const hip = part(`leg.${id}.hipYoke`, `${label} hip yoke and actuator boss`, 'Hip drive',
      'Locates the hip pitch axis and reacts the leg actuator torque.',
      'A ring boss is keyed into the pelvis side plate; two diagonal ribs carry the load into the chassis.', body, [side * .05, 0, 0]);
    hip.position.fromArray([side * D.hipX, D.hipY, 0]);
    eye(hip, [0, 0, 0], .062, 'titanium', 'x');
    bore(hip, 'brass', [0, 0, 0], .022, .095, 'x');
    plate(hip, 'dark', [side * .035, -.045, .02], [.035, .07, .09]);
    for (const z of [-.07, .07]) rod(hip, 'titanium', [side * .01, .02, z], [side * -.03, .075, z * .6], .013);
    kit.fasteners(hip, [[side * .028, .075, .052], [side * .028, .075, -.052]], .009);

    const hipGear = part(`leg.${id}.hipDrive`, `${label} hip drive gear`, 'Hip drive',
      'Indexes the hip actuator through a visible eighteen-tooth inspection gear.',
      'A brass gear turns on the outboard hip shaft behind the leg yoke; its teeth are conceptual.', body, [side * .06, .02, .06], 'Brass gear and dark hub');
    hipGear.position.set(side * D.hipX, D.hipY, .105);
    hipGear.rotation.z = Math.PI / 2;
    kit.gear(hipGear, .072, 18, .020, 'brass');

    const skirt = part(`leg.${id}.skirt`, `${label} hip skirt armor`, 'Pelvis armor',
      'Stands off the hip joint so the leg can swing without the shell colliding.',
      'A curved pale cover floats above the yoke on two posts and leaves the actuator visible below.', body, [side * .08, .03, 0], 'Formed pale alloy shell');
    plate(skirt, 'shell', [side * .202, .020, .015], [.050, .145, .185], [0, 0, side * .10]);
    plate(skirt, 'titanium', [side * .228, .020, .015], [.010, .115, .155], [0, 0, side * .10]);
    for (let k = 0; k < 3; k++) plate(skirt, 'titanium', [side * .234, .055 - k * .05, .015], [.006, .045, .10], [0, 0, side * .1], true);
    kit.fasteners(skirt, [[side * .205, .11, -.075], [side * .205, .11, .075]], .01);
  }

  // ----------------------------------------------------------------- torso
  const torso = part('torso.carrier', 'Torso yaw carrier and lumbar stack', 'Torso structure',
    'Yaws the complete chest, arms and head over the pelvis.',
    'A central bearing column rises from the sacrum and carries six vertebrae and eight rib pairs.', body, [0, 0, 0]);
  torso.position.set(0, D.torsoLift, 0);
  eye(torso, [0, -.01, .02], .05, 'brass', 'y');
  bore(torso, 'dark', [0, .04, .02], .045, .09, 'y');

  for (let i = 0; i < 6; i++) {
    const y = .09 + i * .085;
    const vertebra = part(`spine.${i + 1}.frame`, `Lumbar vertebra ${i + 1} and hinge pin`, 'Spine',
      `Transfers upper-body load through vertebral pin ${i + 1} of six.`,
      'A boxed body, two rear processes and a transverse pin form one stiff segment; the pin is the only joint.', torso, [0, .035, .02]);
    plate(vertebra, 'titanium', [0, y, .105], [.11, .045, .075]);
    plate(vertebra, 'dark', [0, y, .146], [.05, .032, .045]);
    bore(vertebra, 'brass', [0, y, .105], .017, .14, 'x');
    for (const side of [-1, 1]) rod(vertebra, 'dark', [side * .05, y, .115], [side * .075, y + .025, .165], .011);
    for (const side of [-1, 1]) add(vertebra, 'bolt', 'titanium', [side * .072, y, .105], [.014, .012, .014], [0, 0, Math.PI / 2], true);
  }
  for (let i = 0; i < 4; i++) {
    const scute = part(`spine.${i + 1}.scute`, `Dorsal lumbar scute ${i + 1}`, 'Spine armor',
      'Protects one vertebral bay while leaving its hinge pin exposed.',
      'A shallow shell plate sits on two isolators and can separate without moving the vertebra.', torso, [0, .08, .04], 'Formed pale alloy shell');
    add(scute, 'sphere', 'shell', [0, .16 + i * .085, .14], [.075, .028, .055]);
    kit.fasteners(scute, [[-.055, .185 + i * .085, .14], [.055, .185 + i * .085, .14]], .008);
  }

  for (const side of [-1, 1]) for (let r = 0; r < 7; r++) {
    const y = .18 + r * .055;
    const rib = part(`rib.${side < 0 ? 'L' : 'R'}.${r + 1}`, `${side < 0 ? 'Left' : 'Right'} rib ${r + 1} of seven`, 'Rib cage',
      `Closes thoracic ring ${r + 1} from the spine to the sternum without a solid chest wall.`,
      'Three tapered rails are pinned at the vertebra and joined by a sternal pad; the plate floats clear of the ribs.', torso, [side * .05, .02, 0]);
    const a = [side * .060, y, .10], b = [side * .160, y, .025], c = [side * .190, y - .012, -.055], d = [side * .090, y - .018, -.105];
    rod(rib, 'titanium', a, b, .011);
    rod(rib, 'titanium', b, c, .010);
    rod(rib, 'dark', c, d, .007);
    rod(rib, 'copper', [side * .15, y + .008, .01], [side * .17, y - .006, -.03], .0035, true);
    add(rib, 'bolt', 'titanium', d, [.012, .011, .012], [0, 0, Math.PI / 2], true);
    if (r < 4) kit.fasteners(rib, [[side * .11, y + .012, .055]], .008);
  }

  const sternum = part('chest.sternum', 'Sternal keel and front armor rails', 'Rib cage',
    'Collects the seven rib pairs ahead of the power core.',
    'A narrow vertical keel and two outboard rails leave a service gap around the rotor.', torso, [0, .04, -.03]);
  plate(sternum, 'shell', [0, .36, -.10], [.035, .27, .045], [.08, 0, 0]);
  for (const side of [-1, 1]) rod(sternum, 'titanium', [side * .08, .18, -.09], [side * .08, .50, -.08], .012);
  kit.fasteners(sternum, [[0, .48, -.085], [0, .30, -.115], [0, .21, -.10]], .009);

  const chestPlate = part('chest.plate', 'Vented upper chest fairing', 'Torso armor',
    'Shields the upper chest without enclosing the visible rotor and rib ends.',
    'A pale shell panel on four posts carries six open vent slats and a bolted centre ridge.', torso, [0, .16, -.02], 'Formed pale alloy shell');
  add(chestPlate, 'sphere', 'shell', [0, .47, -.075], [.18, .10, .045]);
  for (const side of [-1, 1]) rod(chestPlate, 'titanium', [side * .16, .40, -.10], [side * .17, .53, -.08], .011);
  plate(chestPlate, 'titanium', [0, .50, -.12], [.035, .075, .012]);
  for (let k = 0; k < 6; k++) plate(chestPlate, 'dark', [0, .425 + k * .018, -.118], [.16, .006, .012], [0, 0, 0], true);
  kit.fasteners(chestPlate, [[-.135, .475, -.09], [.135, .475, -.09], [-.10, .41, -.11], [.10, .41, -.11]], .01);

  const radiator = part('chest.radiator', 'Dorsal heat exchanger', 'Thermal service',
    'Exposes the thermal path behind the spine carrier.',
    'A titanium spine rail carries seven separated fins above a copper transfer tube.', torso, [0, .05, .07]);
  rod(radiator, 'titanium', [0, .14, .205], [0, .58, .205], .013);
  for (let k = 0; k < 7; k++) plate(radiator, 'dark', [0, .18 + k * .06, .235], [.16, .035, .008], [0, 0, 0], k > 4);
  rod(radiator, 'copper', [-.075, .15, .205], [.075, .15, .205], .008, true);

  for (const side of [-1, 1]) {
    const loom = part(`torso.loom.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} service loom`, 'Electrical service',
      'Runs control and sensor conductors from the pelvis to the head.',
      'Six insulated links zigzag outside the rib cage and terminate at a bolted service block.', torso, [side * .04, .02, 0]);
    for (let k = 0; k < 6; k++) {
      const p = [side * (.075 + .018 * Math.sin(k * 1.1)), .12 + k * .085, .145];
      const q = [side * (.09 + .02 * Math.sin((k + 1) * 1.1)), .12 + (k + 1) * .085, .15];
      rod(loom, 'rubber', p, q, .006);
      rod(loom, 'copper', [p[0], p[1] + .012, p[2]], [q[0], q[1] + .012, q[2]], .003, true);
    }
    plate(loom, 'brass', [side * .085, .09, .15], [.035, .045, .02]);
  }

  const core = part('thorax.core', 'Chest power core and stator', 'Power core',
    'Shows the central energy module that the harness feeds.',
    'An open ring stator carries eight copper coils around a teal optical core with no opaque housing.', torso, [0, .06, -.09], 'Titanium, copper and optical glass');
  eye(core, [0, .30, -.115], .095, 'titanium', 'z');
  eye(core, [0, .30, -.13], .072, 'brass', 'z');
  add(core, 'sphere', 'lens', [0, .30, -.145], [.048, .048, .026]);
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8;
    bore(core, 'copper', [.062 * Math.cos(a), .30 + .062 * Math.sin(a), -.135], .012, .04, 'z', true);
  }
  for (const side of [-1, 1]) bore(core, 'teal', [side * .085, .30, -.10], .008, .025, 'z', true);

  const rotor = part('thorax.rotor', 'Eight-vane core rotor', 'Power core',
    'Makes the core state visible as a rotating vane ring.',
    'Eight radial vanes and a bolted hub turn together in front of the stator; the speed is prescribed.', torso, [0, .05, 0], 'Brass and dark alloy');
  rotor.position.set(0, .30, -.152);
  for (let k = 0; k < 8; k++) {
    const a = k * TAU / 8;
    plate(rotor, 'brass', [.033 * Math.cos(a), .033 * Math.sin(a), 0], [.028, .008, .008], [0, 0, a]);
  }
  add(rotor, 'bolt', 'titanium', [0, 0, .006], [.012, .012, .012], [Math.PI / 2, 0, 0]);
  rotors.push({ node: rotor, ratio: 2 });

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const pauldron = part(`shoulder.${id}.pauldron`, `${label} shoulder pauldron`, 'Shoulder armor',
      'Floats above the arm drive so the shoulder can swing without touching the shell.',
      'A shallow pale dome on three posts carries two vent slats and a replaceable edge rail.', torso, [side * .11, .08, 0], 'Formed pale alloy shell');
    add(pauldron, 'sphere', 'shell', [side * .355, .515, 0], [.105, .055, .115]);
    plate(pauldron, 'shell', [side * .355, .505, 0], [.16, .035, .16], [0, 0, side * .08]);
    plate(pauldron, 'titanium', [side * .355, .565, 0], [.145, .012, .06]);
    for (let k = 0; k < 2; k++) plate(pauldron, 'dark', [side * .39, .55, -.04 + k * .045], [.008, .025, .03], [0, 0, side * .3], true);
    kit.fasteners(pauldron, [[side * .355, .575, -.055], [side * .355, .575, .055]], .009);

    const shoulderGear = part(`shoulder.${id}.gear`, `${label} shoulder index gear`, 'Arm drive',
      'Makes the shoulder drive phase readable without opening the bearing block.',
      'A sixteen-tooth brass gear sits on the outboard shoulder shaft behind the pauldron.', torso, [side * .12, .06, .04], 'Brass gear and dark hub');
    shoulderGear.position.set(side * D.shoulderX, D.shoulderY, .095);
    shoulderGear.rotation.z = Math.PI / 2;
    kit.gear(shoulderGear, .060, 16, .018, 'brass');

    const clavicle = part(`shoulder.${id}.clavicle`, `${label} clavicle linkage`, 'Arm drive',
      'Connects the torso to the shoulder bearing while leaving the actuator visible.',
      'A double rod rises from the sternum rail to an open shoulder boss with a brass pin.', torso, [side * .16, .06, 0]);
    rod(clavicle, 'titanium', [side * .06, .50, -.06], [side * .355, .50, 0], .014);
    rod(clavicle, 'dark', [side * .07, .47, -.055], [side * .34, .48, -.005], .009);
    eye(clavicle, [side * .355, .50, 0], .045, 'brass', 'x');
    kit.fasteners(clavicle, [[side * .24, .49, -.03]], .008);
  }

  const abdomen = part('torso.abdomen', 'Abdominal armor stack', 'Torso armor',
    'Bridges the lumbar carrier to the pelvis without hiding the waist bearing.',
    'Three overlapping pale plates and a dark central seam descend from the rib cage to the sacrum.', torso, [0, .03, 0], 'Formed pale alloy shell and dark seam');
  for (let k = 0; k < 3; k++) {
    plate(abdomen, 'shell', [0, -.005 + k * .06, -.105 + k * .004], [.21 - k * .015, .058, .060], [.10, 0, 0]);
    plate(abdomen, 'dark', [0, -.002 + k * .06, -.138 + k * .004], [.12, .020, .012], [0, 0, 0], true);
  }
  kit.fasteners(abdomen, [[-.085, .05, -.11], [.085, .05, -.11], [-.07, .12, -.10], [.07, .12, -.10]], .008);

  // ------------------------------------------------------------------ neck
  const yoke = part('chest.yoke', 'Shoulder yoke and neck socket', 'Torso structure',
    'Ties both shoulder bearings and the neck socket into one upper-chest bridge.',
    'Two tapered beams cross the chest to the clavicle bosses and clamp a central brass neck ring.', torso, [0, .09, 0], 'Titanium beams, brass socket and pale shoulder plates');
  for (const side of [-1, 1]) {
    rod(yoke, 'titanium', [0, .555, -.02], [side * .335, .515, 0], .023);
    rod(yoke, 'dark', [side * .07, .52, -.055], [side * .30, .50, -.01], .011);
    plate(yoke, 'shell', [side * .21, .548, -.015], [.19, .042, .14]);
    kit.fasteners(yoke, [[side * .16, .57, -.07], [side * .27, .545, .03]], .01);
  }
  plate(yoke, 'titanium', [0, .555, .065], [.26, .030, .07]);

  const collar = part('neck.collar', 'Neck base collar and chest socket', 'Neck',
    'Anchors the articulated neck to the upper chest bridge.',
    'A wide alloy ring clamps the first neck pin between two pale plates and four service bolts.', torso, [0, .04, 0], 'Titanium, pale alloy and brass');
  eye(collar, [0, .58, -.02], .072, 'titanium', 'y');
  bore(collar, 'brass', [0, .555, -.02], .036, .055, 'y');
  for (const side of [-1, 1]) {
    plate(collar, 'shell', [side * .095, .565, -.025], [.13, .045, .115]);
    kit.fasteners(collar, [[side * .11, .59, -.06], [side * .045, .59, .03]], .008);
  }

  for (let i = 0; i < D.neckCount; i++) {
    const frame = part(`neck.${i + 1}.frame`, `Neck vertebra ${i + 1} of four`, 'Neck',
      `Carries the head through neck pin ${i + 1} while keeping the 100 mm spacing.`,
      'Paired rails, a transverse hinge pin, cross braces and two end collars form one rigid neck link.', torso, [0, .05, -.02]);
    for (const x of [-.022, .022]) rod(frame, 'titanium', [x, 0, 0], [x, D.neckLink, 0], .009);
    bore(frame, 'brass', [0, 0, 0], .018, .095, 'x');
    bore(frame, 'titanium', [0, D.neckLink, 0], .016, .085, 'x');
    for (const z of [-.018, .018]) rod(frame, 'dark', [-.022, .042, z], [.022, .042, z], .0045, true);
    for (const z of [-.018, .018]) rod(frame, 'dark', [-.022, .078, z], [.022, .078, z], .0045, true);
    for (const side of [-1, 1]) rod(frame, 'copper', [side * .045, .015, 0], [side * .045, .085, 0], .004, true);
    const scute = part(`neck.${i + 1}.scute`, `Neck armored sleeve ${i + 1}`, 'Neck armor',
      'Covers one neck link while leaving the hinge pins and side rails readable.',
      'A long pale sleeve and a dark ventral plate ride the frame and overlap only in silhouette.', frame, [0, .02, .03], 'Formed pale alloy shell and dark underside');
    plate(scute, 'shell', [0, .048, .026], [.082, .094, .036]);
    plate(scute, 'dark', [0, .048, -.022], [.062, .076, .014]);
    for (let k = 0; k < 3; k++) plate(scute, 'titanium', [0, .012 + k * .036, .047], [.058, .008, .008], [0, 0, 0], true);
    kit.fasteners(scute, [[-.024, .048, .04], [.024, .048, .04]], .006);
    neckLinks.push({ node: frame, index: i });
  }

  // ------------------------------------------------------------------ head
  const head = part('head.carrier', 'Head gimbal and neck clamp', 'Head optics',
    'Carries every head sensor on a two-axis neck gimbal.',
    'An open cross-yoke clamps the last neck pin and leaves the yaw bearing and jaw pivot visible.', torso, [0, .04, -.05]);
  head.position.fromArray(lastState.head.origin);
  eye(head, [0, 0, 0], .046, 'brass', 'x');
  bore(head, 'titanium', [0, .022, -.012], .038, .06, 'y');
  eye(head, [0, -.025, 0], .052, 'dark', 'y');
  add(head, 'cone', 'shell', [0, -.055, 0], [.075, .075, .085], [Math.PI, 0, 0]);

  const cranium = part('head.cranium', 'Sensor cranium and face frame', 'Head optics',
    'Houses the visor and protects the forward sensor plane.',
    'A compact shell skull is braced by a titanium face frame and two cheek posts, leaving the jaw open.', head, [0, .05, -.04], 'Formed pale alloy shell and titanium');
  add(cranium, 'sphere', 'shell', [0, .105, -.055], [.128, .098, .150]);
  plate(cranium, 'titanium', [0, .005, -.185], [.19, .045, .09]);
  for (const side of [-1, 1]) rod(cranium, 'dark', [side * .095, .075, -.125], [side * .108, -.005, -.185], .014);
  plate(cranium, 'dark', [0, .10, .075], [.155, .06, .05]);
  plate(cranium, 'shell', [0, .158, -.12], [.15, .04, .095]);
  kit.fasteners(cranium, [[-.08, .17, -.10], [.08, .17, -.10], [0, .19, -.01]], .009);

  const visor = part('head.visor', 'Panoramic sensor visor', 'Head optics',
    'Provides the forward optical aperture without a solid face plate.',
    'A wide teal glass bar sits inside a thin alloy bezel with a brow above and two end clamps.', head, [0, .06, -.06], 'Optical glass and brass bezel');
  add(visor, 'box', 'lens', [0, .075, -.24], [.18, .034, .016]);
  plate(visor, 'titanium', [0, .10, -.242], [.19, .016, .026]);
  for (const side of [-1, 1]) add(visor, 'bolt', 'brass', [side * .092, .075, -.243], [.014, .014, .014], [0, 0, Math.PI / 2], true);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const optic = part(`head.optic.${id}`, `${label} ranging optic`, 'Head optics',
      'Marks the forward optical reference on its side of the visor.',
      'A split lens hemisphere is held in a brass bezel with three exposed alignment screws.', head, [side * .1, .08, -.05], 'Dark carrier, brass bezel and teal optical glass');
    add(optic, 'sphere', 'dark', [side * .11, .075, -.19], [.052, .056, .048]);
    add(optic, 'sphere', 'lens', [side * .118, .075, -.213], [.038, .042, .024]);
    eye(optic, [side * .11, .075, -.186], .058, 'brass', 'z');
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3 + .4;
      add(optic, 'bolt', 'titanium', [side * .11 + .042 * Math.cos(a), .075 + .044 * Math.sin(a), -.232], [.007, .009, .007], [0, 0, 0], true);
    }
    const sensor = part(`head.sensor.${id}`, `${label} auditory sensor pod`, 'Head optics',
      'Carries the lateral acoustic aperture beside the cranium.',
      'A short cylinder and two cones clamp a teal sensor bead on a rubber isolation ring.', head, [side * .13, .06, 0], 'Titanium, rubber and optical glass');
    bore(sensor, 'titanium', [side * .145, .06, -.05], .030, .055, 'x');
    add(sensor, 'cone', 'dark', [side * .178, .06, -.05], [.030, .042, .030], [0, 0, side * Math.PI / 2]);
    add(sensor, 'sphere', 'teal', [side * .198, .06, -.05], [.014, .014, .014]);
    seal(sensor, [side * .141, .06, -.05], .034, 'x');

    const antenna = part(`head.antenna.${id}`, `${label} telemetry antenna`, 'Head service',
      'Keeps the head telemetry link clear of the shoulder envelope.',
      'Two tapered rods rise from a bolted base and end in a small teal inspection bead.', head, [side * .09, .15, 0]);
    rod(antenna, 'dark', [side * .085, .16, .025], [side * .105, .25, .06], .007);
    rod(antenna, 'titanium', [side * .105, .25, .06], [side * .125, .30, .09], .004);
    add(antenna, 'sphere', 'teal', [side * .125, .30, .09], [.010, .010, .010]);
    plate(antenna, 'brass', [side * .082, .155, .025], [.03, .014, .03]);
  }

  const crest = part('head.crest', 'Dorsal crest and cable clamp', 'Head service',
    'Routes the head harness over the cranium and away from the visor.',
    'Three separated fins and a clamp rail sit behind the boldest silhouette of the skull.', head, [0, .14, .02], 'Titanium and pale alloy');
  for (let k = 0; k < 3; k++) plate(crest, 'titanium', [0, .16 + k * .022, .025 + k * .04], [.014, .055 - k * .010, .065], [.35, 0, 0]);
  rod(crest, 'rubber', [-.055, .145, .07], [.055, .145, .07], .009);
  kit.fasteners(crest, [[-.045, .155, .055], [.045, .155, .055]], .008);

  const jawGroup = new THREE.Group();
  jawGroup.name = 'head.jawGroup';
  head.add(jawGroup);
  jawGroup.position.set(0, -.055, -.075);
  const jaw = part('head.jaw', 'Articulated mandible', 'Head optics',
    'Opens the lower jaw to expose the sensor throat and jaw actuators.',
    'A rigid boxed mandible hinges on a transverse pin and carries five separated tooth cones.', jawGroup, [0, .03, -.03], 'Dark alloy and brass');
  plate(jaw, 'dark', [0, -.03, -.095], [.155, .045, .17]);
  plate(jaw, 'titanium', [0, -.005, -.11], [.17, .018, .13]);
  bore(jaw, 'brass', [0, 0, 0], .018, .18, 'x');
  for (let k = 0; k < 5; k++) {
    const x = -.056 + k * .028;
    add(jaw, 'cone', 'titanium', [x, .004, -.105 - k * .020], [.009, .026, .009], [Math.PI, 0, 0]);
  }
  for (const side of [-1, 1]) add(jaw, 'bolt', 'titanium', [side * .085, -.028, -.03], [.013, .012, .013], [0, 0, Math.PI / 2], true);

  const upperTeeth = part('head.teeth', 'Upper tooth rail', 'Head optics',
    'Marks the fixed bite plane inside the open face frame.',
    'Five short cones hang from a narrow rail and stay clear of the rotating mandible.', head, [0, .04, -.03], 'Titanium');
  rod(upperTeeth, 'dark', [-.072, -.02, -.095], [.072, -.02, -.095], .012);
  for (let k = 0; k < 5; k++) add(upperTeeth, 'cone', 'titanium', [-.06 + k * .03, -.044, -.10 - k * .02], [.008, .024, .008], [Math.PI, 0, 0], k > 2);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const actuator = part(`head.jawActuator.${id}`, `${label} jaw actuator`, 'Head service',
      'Drives the mandible through a short, visible hydraulic pair.',
      'A sleeve bolted under the cheek feeds a polished rod down to the jaw pin.', head, [side * .08, .02, 0], 'Titanium and brass hydraulic seals');
    actuator.position.set(side * .082, -.01, -.058);
    bore(actuator, 'titanium', [0, 0, 0], .016, .06, 'y');
    bore(actuator, 'brass', [0, .036, 0], .009, .045, 'y');
    seal(actuator, [0, .018, 0], .018, 'y');
    jawActuators.push({ node: actuator, side });
  }

  // ------------------------------------------------------------------ arms
  for (const [handIndex, hand] of lastState.hands.entries()) {
    const id = hand.id, label = hand.side < 0 ? 'Left' : 'Right', side = hand.side;
    const upper = part(`arm.${id}.upper`, `${label} upper-arm truss`, 'Arm drive',
      'Transfers shoulder actuator torque into the elbow bearing.',
      'Two parallel rails, two end rings and three cross-braces keep the arm open and rigid.', torso, [side * .08, .05, 0]);
    for (const x of [-.024, .024]) rod(upper, 'titanium', [x, 0, 0], [x, D.upperArm, 0], .012);
    plate(upper, 'titanium', [.032, D.upperArm * .48, 0], [.014, D.upperArm * .56, .06]);
    add(upper, 'sphere', 'titanium', [0, .012, 0], [.044, .038, .04]);
    eye(upper, [0, 0, 0], .028, 'brass', 'x');
    eye(upper, [0, D.upperArm, 0], .026, 'titanium', 'x');
    for (const f of [.26, .5, .74]) {
      rod(upper, 'dark', [-.026, D.upperArm * f, 0], [.026, D.upperArm * f, 0], .005, true);
      add(upper, 'bolt', 'titanium', [0, D.upperArm * f, -.017], [.007, .010, .007], [Math.PI / 2, 0, 0], true);
    }
    rod(upper, 'copper', [-.023, .04, .014], [-.023, D.upperArm - .04, .014], .0035, true);
    const fore = part(`arm.${id}.forearm`, `${label} forearm truss`, 'Arm drive',
      'Carries the wrist and manipulator through a rigid open frame.',
      'Paired rails, two bearing rings and three spacers join elbow to wrist without a shell tube.', torso, [side * .08, -.02, 0]);
    for (const x of [-.022, .022]) rod(fore, 'titanium', [x, 0, 0], [x, D.forearm, 0], .011);
    plate(fore, 'titanium', [.030, D.forearm * .5, 0], [.012, D.forearm * .62, .05]);
    eye(fore, [0, 0, 0], .027, 'brass', 'x');
    eye(fore, [0, D.forearm, 0], .025, 'titanium', 'x');
    for (const f of [.24, .5, .76]) rod(fore, 'dark', [-.024, D.forearm * f, 0], [.024, D.forearm * f, 0], .0045, true);
    rod(fore, 'rubber', [.024, .05, .012], [.024, D.forearm - .05, .012], .003, true);
    const elbow = part(`arm.${id}.elbow`, `${label} elbow hinge`, 'Arm drive',
      'Provides the single elbow pitch axis.',
      'A brass pin and two side bolts clamp the forearm truss between the upper-arm rails.', torso, [side * .06, 0, 0]);
    plate(elbow, 'titanium', [0, 0, 0], [.045, .045, .045]);
    eye(elbow, [0, 0, 0], .038, 'brass', 'x');
    const wrist = part(`arm.${id}.wrist`, `${label} wrist roll bearing`, 'Arm drive',
      'Locates the hand frame on the forearm.',
      'A narrow bearing ring and two retaining bolts sit ahead of the forearm end ring.', torso, [side * .05, -.02, 0]);
    eye(wrist, [0, 0, 0], .030, 'titanium', 'y');
    bore(wrist, 'brass', [0, .014, 0], .017, .026, 'y');
    const bicep = part(`arm.${id}.bicepSleeve`, `${label} bicep actuator sleeve`, 'Hydraulic service',
      'Provides the visible telescoping drive for the elbow.',
      'A cylinder and seal cap are pinned to the upper arm, with a polished rod sliding inside.', torso, [side * .09, .04, -.03], 'Titanium sleeve and brass seal');
    bore(bicep, 'titanium', [0, .06, 0], .020, .15, 'y');
    seal(bicep, [0, .12, 0], .024, 'y');
    eye(bicep, [0, 0, 0], .025, 'brass', 'z');
    const rodNode = part(`arm.${id}.bicepRod`, `${label} bicep actuator rod`, 'Hydraulic service',
      'Extends between the upper arm and the forearm clevis.',
      'A polished shaft with a bolted clevis follows the sampled elbow angle; pressure is not solved.', torso, [side * .09, .03, -.03], 'Polished titanium and dark clevis');
    bore(rodNode, 'titanium', [0, .05, 0], .010, .19, 'y');
    add(rodNode, 'sphere', 'brass', [0, 0, 0], [.018, .018, .018]);
    add(rodNode, 'bolt', 'dark', [0, .17, 0], [.014, .010, .014], [0, 0, Math.PI / 2]);
    pistons.push({ sleeve: bicep, rod: rodNode, offset: [side * .045, .09, -.055] });
    const bicepPair = { sleeve: bicep, rod: rodNode };

    const handNode = part(`hand.${id}.frame`, `${label} wrist frame`, 'Manipulator',
      'Carries all five digits in the sampled hand orientation.',
      'A compact frame clamps the wrist bearing and leaves the palm plate and knuckles separate.', torso, [side * .05, -.02, 0]);
    eye(handNode, [0, 0, 0], .028, 'brass', 'y');
    bore(handNode, 'titanium', [0, -.012, 0], .022, .03, 'y');
    const palm = part(`hand.${id}.palm`, `${label} palm plate`, 'Manipulator',
      'Provides the rigid palm datum for the five digit chains.',
      'A machined plate and a thin dorsal cover bolt onto the wrist frame with four service points.', handNode, [0, .02, 0], 'Titanium and pale alloy cover');
    plate(palm, 'dark', [0, D.palmY, 0], [.115, .095, .052]);
    plate(palm, 'shell', [0, D.palmY + .005, .031], [.10, .075, .012]);
    add(palm, 'sphere', 'lens', [0, D.palmY + .01, -.028], [.012, .012, .005]);
    kit.fasteners(palm, [[-.045, D.palmY + .04, -.025], [.045, D.palmY + .04, -.025], [-.045, D.palmY + .04, .028], [.045, D.palmY + .04, .028]], .007);
    const knuckle = part(`hand.${id}.knuckleGuard`, `${label} knuckle guard`, 'Manipulator armor',
      'Protects the knuckle line without hiding the digit hinges.',
      'Three separated slats and a pale rail float ahead of the palm plate.', handNode, [0, .03, 0], 'Formed pale alloy shell');
    plate(knuckle, 'shell', [0, D.palmY + .052, -.035], [.115, .018, .035]);
    for (let k = 0; k < 3; k++) plate(knuckle, 'titanium', [-.035 + k * .035, D.palmY + .048, -.055], [.024, .008, .012], [0, 0, 0], true);
    kit.fasteners(knuckle, [[-.045, D.palmY + .06, -.035], [.045, D.palmY + .06, -.035]], .006);

    for (const finger of hand.fingers) {
      const digit = finger.index + 1, thumb = finger.thumb;
      const group = new THREE.Group();
      group.name = `hand.${id}.digit.${digit}`;
      const [l1, l2] = D.fingerLengths[finger.index];
      if (thumb) {
        group.position.set(side * .052, D.palmY - .005, -.035);
        group.rotation.set(-.42, side * .85, side * .38);
      } else {
        group.position.set(finger.x, D.knuckleY, 0);
      }
      handNode.add(group);
      const prox = part(`finger.${id}.${digit}.proximal`, `${label} digit ${digit} proximal phalanx`, 'Manipulator',
        `Keeps the ${Math.round(l1 * 1000)} mm proximal phalanx rigid through the grip.`,
        'Two rails and a hinge collar rotate on the knuckle pin; the fingertip pad stays attached.', group, [0, .02, 0], 'Titanium rails and rubber pads');
      for (const x of [-.008, .008]) rod(prox, 'titanium', [x, 0, 0], [x, -l1, 0], .0045);
      bore(prox, 'brass', [0, 0, 0], .012, .022, 'x');
      plate(prox, 'rubber', [0, -l1 + .018, -.007], [.026, .014, .008], [0, 0, 0], true);
      add(prox, 'bolt', 'dark', [0, -l1, 0], [.010, .006, .010], [0, 0, Math.PI / 2], true);

      const distalGroup = new THREE.Group();
      distalGroup.position.set(0, -l1, 0);
      group.add(distalGroup);
      const distal = part(`finger.${id}.${digit}.distal`, `${label} digit ${digit} distal phalanx`, 'Manipulator',
        `Keeps the ${Math.round(l2 * 1000)} mm distal phalanx rigid at every grip angle.`,
        'A shorter rail pair and a rounded tip pad rotate on the middle hinge without stretching.', distalGroup, [0, .02, 0], 'Titanium rails and rubber tip');
      for (const x of [-.007, .007]) rod(distal, 'titanium', [x, 0, 0], [x, -l2, 0], .004);
      bore(distal, 'brass', [0, 0, 0], .010, .019, 'x');
      add(distal, 'sphere', 'rubber', [0, -l2 - .004, -.002], [.008, .012, .008]);
      add(distal, 'bolt', 'brass', [0, -l2 * .55, -.007], [.006, .004, .006], [0, 0, 0], true);
      add(prox, 'bolt', 'titanium', [0, 0, -.011], [.009, .009, .009], [Math.PI / 2, 0, 0], true);
      fingerChains.push({ group, distalGroup, side: hand.side, handIndex, digit: finger.index, thumb });
    }
    arms.push({ id, side, hand: handNode, upper, fore, elbow, wrist, palm, bicep: bicepPair, handPhase: hand });
  }

  // ------------------------------------------------------------------ legs
  for (const leg of lastState.legs) {
    const id = leg.id, label = leg.side < 0 ? 'Left' : 'Right', side = leg.side;
    const thigh = part(`leg.${id}.thigh`, `${label} thigh truss`, 'Leg drive',
      'Carries the knee through the planted and swinging halves of the gait.',
      'Paired rails, two bearing rings and three cross-braces stay exactly 450 mm pin to pin.', body, [side * .08, 0, 0]);
    const shin = part(`leg.${id}.shin`, `${label} shin truss`, 'Leg drive',
      'Transfers knee motion to the ankle with a rigid 470 mm link.',
      'Two rails and two end rings frame an open shin; the hydraulic rod runs outside it.', body, [side * .07, 0, 0]);
    const kneeNode = part(`leg.${id}.knee`, `${label} knee hinge`, 'Leg drive',
      'Defines the single knee pitch axis.',
      'A brass pin and two outboard retainers clamp the shin between the thigh rails.', body, [side * .06, 0, 0]);
    const ankleNode = part(`leg.${id}.ankle`, `${label} ankle hinge`, 'Leg drive',
      'Connects the shin to the level foot link.',
      'A transverse pin and two bolts hold the foot level while the shin pitches over it.', body, [side * .05, 0, 0]);
    const footNode = part(`leg.${id}.foot`, `${label} foot and sole`, 'Foot support',
      'Keeps one level contact plate under the ankle through the whole cycle.',
      'A machined sole, heel block and three toe plates stay parallel to the datum floor.', body, [side * .05, .02, 0], 'Titanium sole and rubber tread');
    const metatarsus = part(`leg.${id}.metatarsus`, `${label} 140 mm foot link`, 'Foot support',
      'Holds the sole 140 mm below and ahead of the ankle pin.',
      'A single rigid link with two clevises fixes the ankle-to-sole offset at every pose.', body, [side * .05, 0, 0]);
    for (const x of [-.011, .011]) rod(metatarsus, 'titanium', [x, 0, 0], [x, Math.hypot(...D.ankleLift), 0], .007);
    bore(metatarsus, 'brass', [0, 0, 0], .015, .032, 'x');
    bore(metatarsus, 'brass', [0, Math.hypot(...D.ankleLift), 0], .014, .03, 'x');
    rod(metatarsus, 'dark', [-.018, .06, 0], [.018, .06, 0], .004, true);
    const thighSleeve = part(`leg.${id}.thighSleeve`, `${label} thigh actuator sleeve`, 'Hydraulic service',
      'Shows the main lift actuator between hip and knee.',
      'The sleeve is pinned near the hip and the polished rod emerges toward a knee clevis.', body, [side * .09, 0, 0]);
    const thighRod = part(`leg.${id}.thighRod`, `${label} thigh actuator rod`, 'Hydraulic service',
      'Extends and retracts with the solved knee angle.',
      'A polished shaft and clevis follow the sampled joint; the extension is geometry, not pressure.', body, [side * .09, 0, 0]);

    plate(footNode, 'dark', [0, -.028, -.045], [.15, .045, .24]);
    plate(footNode, 'rubber', [0, -.052, -.045], [.145, .012, .23]);
    plate(footNode, 'titanium', [0, -.012, .07], [.13, .055, .07]);
    for (let k = 0; k < 3; k++) {
      const toe = part(`leg.${id}.toe.${k + 1}`, `${label} toe plate ${k + 1} of three`, 'Foot support',
        `Extends the contact patch forward without merging the toe plates.`,
        'A short plate and hinge pin sit on the sole and stay level with the foot frame.', footNode, [0, .01, -.03], 'Titanium and rubber tread');
      bore(toe, 'brass', [(-.045 + k * .045), -.005, -.16], .010, .05, 'x');
      plate(toe, 'titanium', [-.045 + k * .045, -.024, -.235], [.038, .018, .12]);
      plate(toe, 'rubber', [-.045 + k * .045, -.035, -.245], [.035, .008, .10], [0, 0, 0], true);
    }
    plate(kneeNode, 'titanium', [0, 0, 0], [.05, .05, .05]);
    eye(kneeNode, [0, 0, 0], .045, 'brass', 'x');
    eye(ankleNode, [0, 0, 0], .038, 'titanium', 'x');
    eye(thighSleeve, [0, 0, 0], .026, 'brass', 'z');
    seal(thighSleeve, [0, .10, 0], .024, 'y');
    bore(thighSleeve, 'titanium', [0, .06, 0], .020, .16, 'y');
    bore(thighRod, 'titanium', [0, .05, 0], .011, .20, 'y');
    add(thighRod, 'sphere', 'brass', [0, 0, 0], [.020, .020, .020]);

    for (const x of [-.026, .026]) rod(thigh, 'titanium', [x, 0, 0], [x, D.thigh, 0], .014);
    plate(thigh, 'titanium', [.036, D.thigh * .48, 0], [.014, D.thigh * .58, .075]);
    for (const z of [-.018, .018]) rod(thigh, 'dark', [-.026, .12, z], [.026, .12, z], .004, true);
    eye(thigh, [0, 0, 0], .032, 'brass', 'x');
    eye(thigh, [0, D.thigh, 0], .030, 'titanium', 'x');
    for (const f of [.30, .55, .80]) rod(thigh, 'dark', [-.026, D.thigh * f, 0], [.026, D.thigh * f, 0], .005, true);

    for (const x of [-.024, .024]) rod(shin, 'titanium', [x, 0, 0], [x, D.shin, 0], .013);
    plate(shin, 'titanium', [.034, D.shin * .48, 0], [.012, D.shin * .56, .065]);
    for (const z of [-.016, .016]) rod(shin, 'copper', [-.023, .10, z], [-.023, .40, z], .0035, true);
    eye(shin, [0, 0, 0], .030, 'brass', 'x');
    eye(shin, [0, D.shin, 0], .028, 'titanium', 'x');
    for (const f of [.28, .52, .76]) rod(shin, 'dark', [-.023, D.shin * f, 0], [.023, D.shin * f, 0], .005, true);

    const thighHose = part(`leg.${id}.thighHose`, `${label} thigh service hose`, 'Hydraulic service',
      'Carries actuator feed along the outside of the moving thigh truss.',
      'Four short rubber links zigzag beside the thigh rails and stay clear of the opposite leg.', thigh, [side * .02, 0, 0], 'Rubber hose, copper conductor and brass fittings');
    for (let k = 0; k < 4; k++) {
      const a = [side * .033, .08 + k * .08, -.026], b = [side * .033 + side * .010, .08 + (k + 1) * .08, -.026];
      rod(thighHose, 'rubber', a, b, .005);
      rod(thighHose, 'copper', [a[0], a[1], a[2] - .006], [b[0], b[1], b[2] - .006], .0025, true);
    }
    add(thighHose, 'bolt', 'brass', [side * .033, .08, -.026], [.009, .009, .009], [Math.PI / 2, 0, 0], true);
    const kneeGuard = part(`leg.${id}.kneeGuard`, `${label} knee cover and guard`, 'Leg armor',
      'Protects the knee hinge while keeping the hydraulic clevis exposed.',
      'A pale cover rides the shin on two posts and carries three raised wear ribs.', shin, [side * .03, .02, 0], 'Formed pale alloy shell');
    add(kneeGuard, 'sphere', 'shell', [0, .03, -.05], [.05, .052, .022]);
    for (let k = 0; k < 3; k++) plate(kneeGuard, 'titanium', [-.03 + k * .03, .055, -.062], [.012, .018, .008], [0, 0, 0], true);
    kit.fasteners(kneeGuard, [[-.032, .065, -.052], [.032, .065, -.052]], .006);
    const heel = part(`leg.${id}.heelServo`, `${label} heel trim servo`, 'Foot support',
      'Trims the level foot link behind the ankle hinge.',
      'A small cylinder and rod bridge the heel block and metatarsus without touching the ground.', footNode, [side * .02, -.01, 0], 'Titanium and rubber seals');
    bore(heel, 'titanium', [0, .045, .045], .014, .06, 'y');
    bore(heel, 'brass', [0, .015, .045], .007, .045, 'y');
    seal(heel, [0, .045, .045], .016, 'y');

    // The telescoping pair is aimed between sampled clevis points, never keyframed.
    const hydraulic = { sleeve: thighSleeve, rod: thighRod };
    pistons.push({ ...hydraulic, offset: [side * .045, .06, -.055] });
    legs.push({ id, side, thigh, shin, metatarsus, kneeNode, ankleNode, footNode, hydraulic });
  }

  // Bind every authored transform once, then restore it before every pose so
  // exploded-view offsets can never accumulate into later frames.
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function aimPiston(pair, a, b) {
    aim(pair.sleeve, a, b);
    aim(pair.rod, b, a);
  }
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.legs && state?.hands && state?.head) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, state.controls || lastState.controls || {});
    for (const { node, p, q, s } of bind) { node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s); }
    const pose = lastState;
    body.position.fromArray(pose.body.offset);
    torso.rotation.set(0, pose.torso.yaw, 0);

    for (const [i, record] of legs.entries()) {
      const leg = pose.legs[i];
      aim(record.thigh, leg.hip, leg.knee);
      aim(record.shin, leg.knee, leg.ankle);
      aim(record.metatarsus, leg.ankle, leg.footLocal);
      record.kneeNode.position.fromArray(leg.knee);
      record.ankleNode.position.fromArray(leg.ankle);
      record.footNode.position.fromArray(leg.footLocal);
      const outward = record.side * .045;
      aimPiston(record.hydraulic, [leg.hip[0] + outward, leg.hip[1] + .06, leg.hip[2] - .055],
        [leg.knee[0] + outward, leg.knee[1] + .06, leg.knee[2] - .055]);
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
      const outward = record.side * .045;
      aimPiston(record.bicep, [hand.shoulder[0] + outward, hand.shoulder[1] - .09, hand.shoulder[2] - .055],
        [hand.elbow[0] + outward, hand.elbow[1] + .02, hand.elbow[2] - .055]);
    }
    for (const chain of fingerChains) {
      const finger = pose.hands[chain.handIndex].fingers[chain.digit];
      if (chain.thumb) {
        const side = chain.side;
        chain.group.rotation.set(-.42 + finger.proximal * .8, side * .85, side * .38 + finger.spread);
      } else chain.group.rotation.set(finger.proximal, 0, finger.spread);
      chain.distalGroup.rotation.x = finger.distal;
    }
    const neck = pose.neck.links;
    neckLinks.forEach((record, i) => {
      if (i < neck.length) aim(record.node, neck[i].start, neck[i].end);
    });
    head.position.fromArray(pose.head.origin);
    head.rotation.set(pose.head.pitch, pose.head.yaw, 0, 'YXZ');
    jawGroup.rotation.x = -pose.head.jaw;
    for (const { node, side } of jawActuators) {
      const closed = scratch.point.set(side * .065, -.095, -.18).applyAxisAngle(scratch.axis, -pose.head.jaw);
      aim(node, [side * .082, -.01, -.058], closed.toArray());
    }
    rotors.forEach(({ node, ratio }) => { node.rotation.z = pose.driveAngle * ratio; });
    kit.sync(options);
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
