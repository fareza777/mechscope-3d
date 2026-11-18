import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample, distance } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('CERVUS B6 · heavy stag beetle and six-leg drive');
  kit.assemblies.rotation.y = Math.PI;
  const nodes = [], legs = [], mandibles = [], antennae = [], abdomenFrames = [];
  const covers = [], wingActuators = [], mouthNodes = [], bellyRams = [], abdomenRams = [];
  const antennaClubs = [];
  let disposed = false, lastState = sample(0);
  const add = kit.add, rod = kit.rod, aim = kit.aim;
  const part = (id, name, system, purpose, how, parent, explode = [0, .11, 0], material = 'Titanium, pale alloy shell and dark rubber') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const plate = (node, material, p, size, euler = [0, 0, 0], detail = false) => add(node, 'box', material, p, size, euler, detail);
  const boss = (node, p, radius, material = 'titanium', axis = 'x') => {
    const euler = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'ring', material, p, [radius, radius, radius], euler);
    add(node, 'bolt', 'dark', p, [radius * .35, radius * .3, radius * .35], euler, true);
  };
  const screw = (node, p, radius = .006) => kit.fasteners(node, [p], radius);

  // ------------------------------------------------------------------ thorax
  const body = part('body.chassis', 'Thorax chassis, waist and ventral keel', 'Body structure',
    'Carries six legs, the pronotum, both elytra, the head and the abdomen.',
    'A deep machined thorax box, three ventral plates, two layered flank shells and a narrow waist keep every leg mount on one rigid frame.', undefined, [0, 0, 0], 'Titanium, dark alloy and formed shell');
  plate(body, 'dark', [0, 0, -.06], [.46, .24, .54]);
  add(body, 'sphere', 'shell', [0, .09, -.08], [.29, .16, .30]);
  plate(body, 'teal', [0, -.10, -.06], [.38, .07, .50]);
  plate(body, 'shell', [0, .145, -.18], [.40, .055, .28], [.05, 0, 0]);
  for (const side of [-1, 1]) {
    plate(body, 'shell', [side * .27, .03, -.06], [.07, .19, .46], [0, 0, side * .08]);
    plate(body, 'teal', [side * .30, -.045, -.02], [.035, .10, .40], [0, 0, side * .12], true);
    rod(body, 'copper', [side * .22, -.03, -.28], [side * .22, -.03, .18], .005, true);
  }
  plate(body, 'brass', [0, .07, -.32], [.18, .05, .05]);
  kit.fasteners(body, [[-.17, .10, -.26], [.17, .10, -.26], [-.17, .10, .14], [.17, .10, .14]], .008);

  const belly = part('body.belly', 'Armoured belly plate and ventral ballast', 'Body structure',
    'Adds a broad lower shell and ballast mass beneath the thorax.',
    'A rounded teal belly, pale shell skid, dark service plate, brass seam and two pressure lamps fill the underside.', body, [0, -.04, 0], 'Teal belly, pale skid and brass seam');
  add(belly, 'sphere', 'teal', [0, -.12, -.02], [.28, .10, .34]);
  plate(belly, 'shell', [0, -.19, -.02], [.34, .045, .40]);
  plate(belly, 'dark', [0, -.215, -.04], [.26, .025, .30]);
  for (const side of [-1, 1]) rod(belly, 'brass', [side * .17, -.20, -.20], [side * .17, -.20, .18], .006);
  for (const side of [-1, 1]) add(belly, 'sphere', 'lens', [side * .12, -.18, -.20], [.012, .012, .012], [0, 0, 0], true);

  for (let k = 0; k < 3; k++) {
    const rib = part(`body.bellyRib.${k + 1}`, `Ventral rib frame ${k + 1} of three`, 'Underside structure',
      `Shows underside load rib ${k + 1} between the thorax and abdomen.`,
      'A curved titanium rail, dark strut, brass pad and two fasteners arch beneath the belly plate.', body, [0, -.03, 0], 'Titanium rail, dark strut and brass pad');
    const z = -.22 + k * .18;
    for (const side of [-1, 1]) rod(rib, 'titanium', [side * .12, -.09, z], [side * .27, -.17, z - .02], .010);
    rod(rib, 'dark', [-.27, -.17, z - .02], [.27, -.17, z - .02], .007, true);
    plate(rib, 'brass', [0, -.19, z - .02], [.08, .020, .04]);
    kit.fasteners(rib, [[-.20, -.13, z], [.20, -.13, z]], .0055);
  }
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const ram = part(`body.bellyRam.${id}`, `${label} ventral lift ram`, 'Underside structure',
      'Shows the long underside actuator that trims the abdomen.',
      'A dark barrel, brass piston and two clevises run from the belly keel to the first abdominal frame.', body, [side * .04, -.03, 0], 'Dark barrel, brass piston and titanium clevises');
    add(ram, 'cylinder', 'dark', [0, .35, 0], [.015, .70, .015]);
    add(ram, 'cylinder', 'brass', [0, .85, 0], [.007, .30, .007]);
    add(ram, 'cylinder', 'titanium', [0, .02, 0], [.022, .04, .022]);
    bellyRams.push({ node: ram, side });
    const cable = part(`body.cable.${id}`, `${label} ventral power cable`, 'Underside structure',
      'Routes power and sense lines under the thorax to the abdomen.',
      'A copper core, dark sleeve and two brass clamps follow the belly without crossing a leg arc.', body, [side * .04, -.02, 0], 'Copper core, dark sleeve and brass clamps');
    rod(cable, 'copper', [side * .20, -.16, -.22], [side * .17, -.12, .24], .0045);
    rod(cable, 'rubber', [side * .20, -.16, -.22], [side * .17, -.12, .24], .008, true);
    for (const z of [-.16, .14]) add(cable, 'cylinder', 'brass', [side * .19, -.155, z], [.010, .010, .010], [0, 0, Math.PI / 2], true);
  }
  for (let k = 0; k < 2; k++) {
    const panel = part(`body.service.${k + 1}`, `Thorax service panel ${k + 1} of two`, 'Service access',
      `Provides a bolted inspection hatch on the ${k ? 'rear' : 'front'} flank.`,
      'A pale hatch, dark seal, brass latch and four fasteners sit between the leg mounts.', body, [0, .02, 0], 'Pale hatch, dark seal and brass latch');
    plate(panel, 'shell', [0, .03, -.28 + k * .38], [.34, .022, .14]);
    plate(panel, 'dark', [0, .045, -.28 + k * .38], [.29, .012, .10]);
    plate(panel, 'brass', [0, .05, -.34 + k * .38], [.10, .016, .020]);
    kit.fasteners(panel, [[-.12, .04, -.30 + k * .38], [.12, .04, -.30 + k * .38]], .0055);
  }

  const pronotum = part('body.pronotum', 'Broad pronotal shield and layered back plate', 'Body armor',
    'Protects the thorax while leaving every leg pin and the elytra bar exposed.',
    'A broad pale shell, three overlapping plates, a teal underlayer, two shoulder rails and four fasteners form the shield.', body, [0, .05, 0], 'Formed pale shell, teal underlayer and titanium rails');
  add(pronotum, 'sphere', 'shell', [0, .24, -.14], [.38, .105, .32]);
  for (let k = 0; k < 3; k++) plate(pronotum, 'shell', [0, .275 - k * .012, -.28 + k * .14], [.52 - k * .05, .035, .16], [0, 0, 0]);
  plate(pronotum, 'teal', [0, .17, -.14], [.46, .045, .34]);
  for (const side of [-1, 1]) rod(pronotum, 'titanium', [side * .24, .18, -.38], [side * .24, .18, .06], .012);
  kit.fasteners(pronotum, [[-.18, .30, -.24], [.18, .30, -.24], [-.18, .30, .00], [.18, .30, .00]], .008);

  const crest = part('body.pronotum.crest', 'Pronotal crest and central keel', 'Body armor',
    'Adds a raised mechanical crest along the centre of the pronotum.',
    'A dark keel, three brass crest blocks, a teal spine and two fasteners stand above the shield.', pronotum, [0, .06, 0], 'Dark keel, brass crests and teal spine');
  plate(crest, 'dark', [0, .31, -.16], [.055, .055, .34]);
  for (let k = 0; k < 3; k++) add(crest, 'cylinder', 'brass', [0, .345, -.28 + k * .12], [.026, .028, .026]);
  plate(crest, 'teal', [0, .365, -.16], [.020, .020, .28], [0, 0, 0], true);
  kit.fasteners(crest, [[0, .33, -.32], [0, .33, .00]], .006);

  const collar = part('body.collar', 'Neck collar and head lock', 'Body structure',
    'Bridges the pronotum into the head gimbal with a bolted neck ring.',
    'A dark neck drum, brass collar ring, pale clamp shoes and four fasteners lock the head carrier.', body, [0, .06, 0], 'Dark drum, brass ring and pale clamps');
  add(collar, 'cylinder', 'dark', [0, .12, -.40], [.15, .10, .13], [Math.PI / 2, 0, 0]);
  add(collar, 'ring', 'brass', [0, .12, -.44], [.15, .15, .15], [0, 0, 0]);
  for (const side of [-1, 1]) plate(collar, 'shell', [side * .12, .12, -.40], [.07, .09, .08], [0, 0, side * .2]);
  kit.fasteners(collar, [[-.10, .21, -.41], [.10, .21, -.41]], .0065);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const shoulder = part(`body.shoulder.${id}`, `${label} shoulder pauldron and spine`, 'Body armor',
      'Adds a heavy layered pauldron over the front leg mount.',
      'A curved pale plate, dark pad, three brass spines and two fasteners cover the front coxa.', body, [side * .06, .04, 0], 'Formed pale shell, dark pad and brass spines');
    add(shoulder, 'sphere', 'shell', [side * .28, .12, -.26], [.13, .10, .16]);
    plate(shoulder, 'dark', [side * .30, .045, -.25], [.10, .055, .18]);
    for (let k = 0; k < 3; k++) add(shoulder, 'cone', 'brass', [side * (.29 + k * .018), .20 - k * .012, -.32 + k * .055], [.012, .055, .012], [0, 0, side * -.4]);
    kit.fasteners(shoulder, [[side * .24, .19, -.22], [side * .28, .17, -.33]], .006);
  }

  const bar = part('body.elytraBar', 'Elytral hinge bar and two bearing blocks', 'Elytra drive',
    'Provides the common hinge line for both wing covers.',
    'A transverse brass bar, two bolted hinge blocks, a center stop and four fasteners sit above the waist.', body, [0, .04, 0], 'Brass bar and titanium blocks');
  rod(bar, 'brass', [-.25, .23, .18], [.25, .23, .18], .016);
  for (const side of [-1, 1]) {
    boss(bar, [side * .20, .23, .18], .045, 'titanium', 'z');
    plate(bar, 'dark', [side * .10, .21, .18], [.06, .05, .05]);
  }
  plate(bar, 'shell', [0, .255, .13], [.18, .03, .10]);
  kit.fasteners(bar, [[-.10, .235, .20], [.10, .235, .20]], .006);

  const waist = part('body.waist', 'Waist yoke and abdominal root', 'Body structure',
    'Narrows the thorax into the six-link abdomen without a gap.',
    'A dark waist block, two pale yoke plates, a brass ring and four fasteners clamp the first abdominal pin.', body, [0, .04, 0], 'Dark block, pale yoke and brass ring');
  plate(waist, 'dark', [0, .02, .21], [.24, .14, .10]);
  for (const side of [-1, 1]) plate(waist, 'shell', [side * .15, .04, .22], [.07, .10, .12], [0, 0, side * .25]);
  boss(waist, [0, .02, .26], .060, 'brass', 'x');
  kit.fasteners(waist, [[-.08, .09, .22], [.08, .09, .22]], .006);

  // ------------------------------------------------------------------ legs
  for (const leg of lastState.legs) {
    const item = leg, label = `${['front', 'middle', 'rear'][item.row]} ${item.side < 0 ? 'left' : 'right'}`, id = item.id;
    const mount = part(`leg.${id}.mount`, `${label} coxa mount and load bracket`, 'Leg drive',
      'Clamps the leg yoke to the thorax frame.',
      'A bolted bracket, wide top plate and two diagonal stays tie the hip bearing into the ventral keel.', body, [item.side * .04, .01, 0]);
    mount.position.fromArray(item.hip);
    boss(mount, [0, 0, 0], .055, 'titanium', 'x');
    plate(mount, 'dark', [0, .03, 0], [.16, .05, .16]);
    rod(mount, 'titanium', [0, .02, 0], [item.side * .06, .12, .02], .010);
    kit.fasteners(mount, [[item.side * .04, .12, -.04], [item.side * .04, .12, .04]], .007);

    const coxa = part(`leg.${id}.hip`, `${label} coxa wedge and hip pin`, 'Leg drive',
      'Locates the first leg pin on the mount with a visible bearing.',
      'A brass pin, two side retainers, a pale wedge and a copper hose clamp the femur clevis.', body, [item.side * .04, .01, 0]);
    coxa.position.fromArray(item.hip);
    boss(coxa, [0, 0, 0], .040, 'brass', 'x');
    plate(coxa, 'shell', [0, .045, 0], [.10, .07, .10]);
    rod(coxa, 'copper', [item.side * .04, .02, -.03], [item.side * .05, .10, .02], .004, true);

    const femur = part(`leg.${id}.femur`, `${label} femur truss`, 'Leg drive',
      'Carries the knee through the stance phase.',
      'Four rails, two end rings, three braces and a copper service line preserve the 380 mm femur length.', body, [item.side * .04, 0, 0]);
    for (const x of [-.030, .030]) rod(femur, 'titanium', [x, 0, 0], [x, D.femur, 0], .013);
    for (const z of [-.024, .024]) rod(femur, 'dark', [0, .03, z], [0, D.femur - .03, z], .009, true);
    boss(femur, [0, 0, 0], .036, 'brass', 'x'); boss(femur, [0, D.femur, 0], .032, 'titanium', 'x');
    for (const f of [.32, .62]) rod(femur, 'dark', [-.033, D.femur * f, 0], [.033, D.femur * f, 0], .005, true);
    rod(femur, 'copper', [.037, .05, .025], [.037, D.femur - .05, .025], .0035, true);

    const femurArmor = part(`leg.${id}.femurArmor`, `${label} armoured femur shell`, 'Leg drive',
      'Gives the upper leg a thick layered armored column.',
      'A domed pale shell, two overlapping plates, a teal underlayer, dark rear pad and brass band wrap the truss.', femur, [item.side * .03, .02, 0], 'Formed pale shell, teal underlayer and brass band');
    add(femurArmor, 'sphere', 'shell', [0, .19, 0], [.115, .195, .085]);
    plate(femurArmor, 'shell', [0, .13, -.060], [.16, .20, .045]);
    plate(femurArmor, 'teal', [0, .19, .060], [.10, .24, .030]);
    plate(femurArmor, 'dark', [0, .30, -.040], [.10, .10, .07]);
    add(femurArmor, 'cylinder', 'brass', [0, .07, 0], [.062, .025, .062]);
    kit.fasteners(femurArmor, [[-.04, .31, .03], [.04, .31, .03]], .006);

    const femurRam = part(`leg.${id}.femurRam`, `${label} femur hydraulic ram`, 'Leg drive',
      'Shows the linear actuator that assists the femur.',
      'A dark barrel, brass piston, rubber boot and two clevises ride beside the upper truss.', femur, [item.side * .02, .01, 0], 'Dark barrel, brass piston and rubber boot');
    add(femurRam, 'cylinder', 'dark', [.055, .17, .02], [.016, .18, .016]);
    rod(femurRam, 'brass', [.055, .26, .02], [.055, .34, .02], .0065);
    add(femurRam, 'sphere', 'rubber', [.055, .26, .02], [.021, .016, .021]);
    screw(femurRam, [.055, .35, .02], .0055);

    const knee = part(`leg.${id}.knee`, `${label} knee hinge and cap`, 'Leg drive',
      'Defines the knee pitch axis.',
      'A brass pin, two outboard retainers, a pale cap and a dark pad clamp the joint.', body, [item.side * .03, 0, 0]);
    boss(knee, [0, 0, 0], .040, 'brass', 'x');
    add(knee, 'sphere', 'shell', [0, 0, -.045], [.042, .042, .016]);
    plate(knee, 'dark', [0, .01, .045], [.06, .05, .016]);

    const tibia = part(`leg.${id}.tibia`, `${label} tibia truss`, 'Leg drive',
      'Transfers the knee solution to the tarsal pin.',
      'Four rails, two end rings, two braces, a service hose and a cable make the 400 mm tibia rigid.', body, [item.side * .03, 0, 0]);
    for (const x of [-.028, .028]) rod(tibia, 'titanium', [x, 0, 0], [x, D.tibia, 0], .012);
    for (const z of [-.022, .022]) rod(tibia, 'dark', [0, .03, z], [0, D.tibia - .03, z], .008, true);
    boss(tibia, [0, 0, 0], .034, 'brass', 'x'); boss(tibia, [0, D.tibia, 0], .030, 'titanium', 'x');
    for (const f of [.32, .62]) rod(tibia, 'dark', [-.031, D.tibia * f, 0], [.031, D.tibia * f, 0], .0045, true);
    rod(tibia, 'copper', [.035, .05, .02], [.035, D.tibia - .05, .02], .003, true);

    const tibiaArmor = part(`leg.${id}.tibiaArmor`, `${label} armoured tibia shell`, 'Leg drive',
      'Gives the lower leg a broad armored silhouette without hiding the tarsal pin.',
      'A tapered pale shell, shin plate, teal underlayer, dark ankle pad and brass band wrap the tibia.', tibia, [item.side * .03, .02, 0], 'Formed pale shell, teal underlayer and brass band');
    add(tibiaArmor, 'sphere', 'shell', [0, .18, 0], [.098, .175, .075]);
    plate(tibiaArmor, 'shell', [0, .13, -.052], [.14, .19, .040]);
    plate(tibiaArmor, 'teal', [0, .20, .052], [.085, .20, .026]);
    plate(tibiaArmor, 'dark', [0, .32, -.02], [.08, .09, .055]);
    add(tibiaArmor, 'cylinder', 'brass', [0, .06, 0], [.052, .022, .052]);
    kit.fasteners(tibiaArmor, [[-.035, .30, .025], [.035, .30, .025]], .0055);

    const tibiaRam = part(`leg.${id}.tibiaRam`, `${label} tibia hydraulic ram`, 'Leg drive',
      'Shows the lower-leg assist actuator beside the tibia truss.',
      'A dark barrel, brass rod, rubber boot and two collars sit outside the truss envelope.', tibia, [item.side * .02, .01, 0], 'Dark barrel, brass rod and rubber boot');
    add(tibiaRam, 'cylinder', 'dark', [.052, .15, .015], [.014, .16, .014]);
    rod(tibiaRam, 'brass', [.052, .23, .015], [.052, .31, .015], .006);
    add(tibiaRam, 'sphere', 'rubber', [.052, .23, .015], [.019, .014, .019]);
    screw(tibiaRam, [.052, .32, .015], .005);

    const tarsus = part(`leg.${id}.tarsus`, `${label} broad 100 mm tarsus`, 'Foot support',
      'Keeps the wide foot at a fixed offset below the ankle.',
      'A short pair of rails, two clevises, a brass collar and a copper spring preserve the ankle-to-sole distance.', body, [item.side * .03, 0, 0]);
    for (const x of [-.014, .014]) rod(tarsus, 'titanium', [x, 0, 0], [x, Math.hypot(...D.ankleLift), 0], .007);
    for (const y of [0, Math.hypot(...D.ankleLift)]) boss(tarsus, [0, y, 0], .026, y ? 'titanium' : 'brass', 'x');
    add(tarsus, 'cylinder', 'copper', [0, Math.hypot(...D.ankleLift) * .5, .015], [.004, Math.hypot(...D.ankleLift) * .7, .004], [0, 0, 0], true);

    const foot = part(`leg.${id}.foot`, `${label} wide foot and tarsal pad`, 'Foot support',
      'Provides one planted contact with a broad armored tarsal pad.',
      'A wide machined pad, rubber tread, pale armor plate and brass ankle collar stay level through stance.', body, [item.side * .03, .01, 0], 'Titanium pad, rubber tread and pale armor');
    plate(foot, 'dark', [0, -.015, -.02], [.20, .040, .22]);
    plate(foot, 'rubber', [0, -.034, -.03], [.185, .010, .20]);
    plate(foot, 'shell', [0, .010, -.015], [.17, .028, .17]);
    add(foot, 'cylinder', 'brass', [0, .020, 0], [.040, .045, .040]);
    kit.fasteners(foot, [[-.09, .02, -.05], [.09, .02, -.05]], .006);

    const claws = part(`leg.${id}.claws`, `${label} claw fan and wear plates`, 'Foot support',
      'Gives each foot a wide fan of four armored claws.',
      'Four dark claw cones, two rubber pads and a brass spreader bar fan from the sole front.', foot, [item.side * .03, .01, 0], 'Dark claws, rubber pads and brass spreader');
    for (let k = 0; k < 4; k++) {
      add(claws, 'cone', 'dark', [-.075 + k * .05, -.012, -.14], [.014, .085, .014], [Math.PI / 2, 0, 0]);
      add(claws, 'sphere', 'rubber', [-.075 + k * .05, -.030, -.10], [.014, .008, .012], [0, 0, 0], true);
    }
    rod(claws, 'brass', [-.10, .005, -.075], [.10, .005, -.075], .005);
    plate(claws, 'shell', [0, .005, -.09], [.16, .012, .04], [0, 0, 0], true);

    const servicePanel = part(`leg.${id}.servicePanel`, `${label} leg service panel`, 'Service access',
      'Provides a bolted inspection hatch on the upper leg drive.',
      'A pale panel, dark seal, brass latch and two fasteners sit between the femur rails.', femur, [item.side * .025, .02, 0], 'Pale panel, dark seal and brass latch');
    plate(servicePanel, 'shell', [0, .41, -.070], [.09, .10, .018]);
    plate(servicePanel, 'dark', [0, .41, -.058], [.07, .08, .010]);
    plate(servicePanel, 'brass', [0, .365, -.072], [.04, .016, .010]);
    screw(servicePanel, [0, .455, -.070], .0045);

    legs.push({ id, femur, tibia, tarsus, knee, foot });
  }

  // ------------------------------------------------------------------ head
  const head = part('head.carrier', 'Head gimbal, neck and mandible frame', 'Head structure',
    'Carries the cranium, eyes, antennae and both pincer bases.',
    'A bolted gimbal collar, transverse frame, two cheek braces and a dark neck drum hold the head ahead of the pronotum.', body, [0, .06, -.03], 'Titanium and brass');
  head.position.fromArray(lastState.head.origin);
  boss(head, [0, 0, 0], .050, 'brass', 'x');
  plate(head, 'dark', [0, -.02, -.02], [.24, .05, .12]);
  for (const side of [-1, 1]) rod(head, 'titanium', [side * .09, .01, -.02], [side * .15, -.05, -.10], .010);

  const cranium = part('head.cranium', 'Cranium and clypeus shell', 'Head structure',
    'Protects the sensor apertures above the mandible sockets.',
    'A rounded pale cranium, second dome, dark clypeus plate, two cheek rails and a bolted top plate leave the mouth frame open.', head, [0, .02, -.02], 'Formed pale alloy shell and dark clypeus');
  add(cranium, 'sphere', 'shell', [0, .04, -.10], [.19, .115, .19]);
  add(cranium, 'sphere', 'shell', [0, .02, -.24], [.15, .075, .08]);
  plate(cranium, 'dark', [0, -.035, -.255], [.22, .08, .11]);
  for (const side of [-1, 1]) rod(cranium, 'titanium', [side * .12, .00, -.18], [side * .15, -.09, -.29], .010);
  kit.fasteners(cranium, [[-.07, .13, -.10], [.07, .13, -.10]], .007);

  const clypeus = part('head.clypeus', 'Clypeus visor and sensor bar', 'Head structure',
    'Gives the face a heavy armored visor above the mouthparts.',
    'A dark visor, pale brow plate, two brass sensor pods, teal status lens and two fasteners sit above the mouth.', head, [0, .03, -.03], 'Dark visor, pale brow and teal lens');
  plate(clypeus, 'dark', [0, .10, -.31], [.24, .05, .06], [-.25, 0, 0]);
  plate(clypeus, 'shell', [0, .13, -.28], [.20, .035, .09], [-.20, 0, 0]);
  for (const side of [-1, 1]) add(clypeus, 'cylinder', 'brass', [side * .08, .11, -.30], [.014, .032, .014], [0, 0, Math.PI / 2]);
  add(clypeus, 'sphere', 'lens', [0, .13, -.30], [.018, .012, .016]);
  kit.fasteners(clypeus, [[-.06, .12, -.26], [.06, .12, -.26]], .005);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const eye = part(`head.eye.${id}`, `${label} compound-eye housing`, 'Head optics',
      'Places a faceted lens on the side of the head.',
      'A dark cup, brass orbital bezel, teal dome and dark pupil sit outside the cranium shell.', head, [side * .09, .03, 0], 'Dark cup, brass bezel and teal dome');
    add(eye, 'sphere', 'dark', [side * .155, .045, -.20], [.052, .052, .040]);
    boss(eye, [side * .155, .045, -.19], .058, 'brass', 'x');
    add(eye, 'sphere', 'lens', [side * .175, .050, -.22], [.032, .038, .030]);
    const socket = part(`head.socket.${id}`, `${label} mandible socket`, 'Mandible drive',
      'Carries the first pincer pin and its adductor.',
      'A double-cheek bracket, brass pin, rubber pad and two bolts keep the pincer root outboard.', head, [side * .05, .02, 0], 'Titanium bracket, brass pin and rubber pad');
    socket.position.set(side * D.mandibleBase[0], D.mandibleBase[1], D.mandibleBase[2]);
    boss(socket, [0, 0, 0], .036, 'brass', 'x');
    for (const dy of [-.035, .035]) rod(socket, 'dark', [0, dy, .03], [side * .035, dy, .09], .006);
    add(socket, 'sphere', 'rubber', [side * .02, 0, .05], [.016, .016, .016], [0, 0, 0], true);
    antennaBall(side, id, label);
  }

  function antennaBall(side, id, label) {
    const ball = part(`antenna.${id}.ball`, `${label} antennal ball joint`, 'Antenna',
      'Provides the ball socket that carries the five-segment antenna.',
      'A dark ball, brass socket ring, two titanium retainers and a rubber grommet sit on the head.', head, [side * .03, .03, 0], 'Dark ball, brass ring and titanium retainers');
    ball.position.set(side * D.antennaBase[0], D.antennaBase[1], D.antennaBase[2]);
    add(ball, 'sphere', 'dark', [0, 0, 0], [.034, .034, .034]);
    boss(ball, [0, 0, 0], .030, 'brass', 'y');
    add(ball, 'cylinder', 'rubber', [0, .012, 0], [.020, .012, .020], [0, 0, 0], true);
  }

  const labrum = part('head.mouth.labrum', 'Mouth frame, labrum and molar plate', 'Mouthparts',
    'Closes the mouth frame between both pincer sockets.',
    'A dark labrum plate, brass molar rail, pale cutting edge and four fasteners sit below the clypeus.', head, [0, .02, -.03], 'Dark labrum, brass rail and pale edge');
  plate(labrum, 'dark', [0, -.035, -.31], [.16, .045, .08]);
  plate(labrum, 'brass', [0, -.055, -.34], [.12, .020, .05]);
  plate(labrum, 'shell', [0, -.072, -.36], [.10, .014, .035], [0, 0, 0], true);
  kit.fasteners(labrum, [[-.04, -.02, -.30], [.04, -.02, -.30]], .0045);

  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const maxilla = part(`head.mouth.maxilla.${id}`, `${label} maxilla and biting plate`, 'Mouthparts',
      'Adds a layered maxilla beside the mouth frame.',
      'A pale maxilla plate, dark jaw pad, brass hinge pin and two teeth move with the mouth command.', head, [side * .03, .02, -.02], 'Pale maxilla, dark pad and brass pin');
    maxilla.position.set(side * .075, -.02, -.33);
    plate(maxilla, 'shell', [side * .02, -.02, -.04], [.07, .04, .10], [0, side * .3, 0]);
    plate(maxilla, 'dark', [side * .04, -.045, -.06], [.05, .025, .06]);
    boss(maxilla, [0, 0, 0], .014, 'brass', 'x');
    for (let k = 0; k < 2; k++) add(maxilla, 'cone', 'shell', [side * .01, -.05, -.08 - k * .03], [.008, .022, .008], [Math.PI, 0, 0], true);
    mouthNodes.push({ node: maxilla, side, kind: 'maxilla' });
    const palp = part(`head.mouth.palp.${id}`, `${label} maxillary palp`, 'Mouthparts',
      'Adds a segmented sensory palp beside the pincer root.',
      'A dark four-segment palp, brass knuckles and a pale tip swing from the maxilla.', head, [side * .04, .02, -.02], 'Dark palp, brass knuckles and pale tip');
    palp.position.set(side * .10, -.03, -.34);
    for (let k = 0; k < 4; k++) rod(palp, k === 3 ? 'shell' : 'dark', [side * .02 * k, -.015 * k, -.03 * k], [side * .02 * (k + 1), -.015 * (k + 1), -.03 * (k + 1)], .007 - k * .0008);
    for (let k = 0; k < 3; k++) boss(palp, [side * .02 * (k + 1), -.015 * (k + 1), -.03 * (k + 1)], .010, 'brass', 'x');
    mouthNodes.push({ node: palp, side, kind: 'palp' });
  }

  // ------------------------------------------------------------------ mandibles
  for (let s = 0; s < 2; s++) {
    const side = s ? 1 : -1, id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const records = [];
    for (let i = 0; i < 3; i++) {
      const link = part(`mandible.${id}.${i + 1}`, `${label} pincer link ${i + 1} of three`, 'Mandible drive',
        `Preserves pincer link ${i + 1} at ${Math.round(D.mandibleLengths[i] * 1000)} mm.`,
        'A curved pale beam, two brass pins, three inner teeth and a layered outer plate form one rigid pincer link.', head, [side * .02, .02, 0], 'Formed pale shell, brass pins and dark teeth');
      for (const x of [-.022, .022]) rod(link, 'shell', [x, 0, 0], [x, D.mandibleLengths[i], 0], .018 - i * .002);
      boss(link, [0, 0, 0], .028 - i * .003, 'brass', 'x');
      boss(link, [0, D.mandibleLengths[i], 0], .023 - i * .002, 'titanium', 'x');
      for (let t = 0; t < 3; t++) {
        const at = D.mandibleLengths[i] * (.25 + t * .25);
        add(link, 'cone', 'dark', [side * -.030, at, .014], [.009, .048, .009], [0, 0, side * -.45], true);
      }
      plate(link, 'dark', [0, D.mandibleLengths[i] * .5, -.022], [.068, D.mandibleLengths[i] * .7, .020]);
      plate(link, 'shell', [0, D.mandibleLengths[i] * .5, .030], [.045, D.mandibleLengths[i] * .6, .014], [0, 0, 0], true);
      records.push(link);
    }
    const hook = part(`mandible.${id}.hook`, `${label} pincer tip hook`, 'Mandible drive',
      'Adds the inward hook that defines the pincer tip.',
      'A dark curved plate, two brass pins and a pale wear cap extend from the third link without changing its length.', records[2], [side * .02, .02, 0], 'Dark hook plate, brass pins and pale cap');
    plate(hook, 'dark', [side * -.028, D.mandibleLengths[2] + .025, .022], [.040, .11, .028], [0, 0, side * -.35]);
    rod(hook, 'brass', [0, D.mandibleLengths[2] - .02, 0], [side * -.060, D.mandibleLengths[2] + .03, .025], .006);
    add(hook, 'sphere', 'shell', [side * -.050, D.mandibleLengths[2] + .08, .026], [.020, .028, .014]);
    mandibles.push({ side, records });

    const serration = part(`mandible.${id}.serration`, `${label} pincer serration cassette`, 'Mandible drive',
      'Shows the replaceable serrated tooth row on the inner pincer edge.',
      'Five dark saw teeth, a brass backing rail and two pins bolt to the middle pincer link.', records[1], [side * .02, .02, 0], 'Dark saw teeth, brass rail and titanium pins');
    rod(serration, 'brass', [side * -.022, D.mandibleLengths[1] * .15, -.01], [side * -.022, D.mandibleLengths[1] * .85, -.01], .005);
    for (let k = 0; k < 5; k++) add(serration, 'cone', 'dark', [side * -.030, D.mandibleLengths[1] * (.18 + k * .14), .010], [.006, .026, .006], [0, 0, side * -.5], true);
    add(serration, 'bolt', 'titanium', [side * -.022, D.mandibleLengths[1] * .5, -.012], [.007, .010, .007], [0, 0, Math.PI / 2], true);

    const collar = part(`mandible.${id}.collar`, `${label} pincer root collar`, 'Mandible drive',
      'Reinforces the pincer root with a visible bolted collar.',
      'A brass ring, pale clamp shoe, rubber gasket and two fasteners sleeve the first pincer pin.', head, [side * .03, .02, 0], 'Brass ring, pale clamp and rubber gasket');
    collar.position.set(side * (D.mandibleBase[0] + .02), D.mandibleBase[1], D.mandibleBase[2] + .03);
    add(collar, 'ring', 'brass', [0, 0, 0], [.040, .040, .040], [0, Math.PI / 2, 0]);
    plate(collar, 'shell', [side * .02, .02, .02], [.045, .040, .06]);
    add(collar, 'cylinder', 'rubber', [0, -.01, .04], [.026, .016, .026], [Math.PI / 2, 0, 0], true);
    kit.fasteners(collar, [[side * .01, .045, .04], [side * .01, -.02, .08]], .0045);

    const actuator = part(`mandible.${id}.actuator`, `${label} pincer adductor`, 'Mandible drive',
      'Shows the linear actuator that drives the pincer root.',
      'A dark cylinder, brass rod, rubber boot and two clevises sit behind the socket and stay clear of the eye.', head, [side * .03, .02, 0], 'Dark cylinder and brass rod');
    plate(actuator, 'dark', [side * .14, .05, -.10], [.032, .032, .14], [0, side * .45, 0]);
    rod(actuator, 'brass', [side * .15, .02, -.17], [side * .20, -.02, -.23], .006);
    add(actuator, 'sphere', 'rubber', [side * .15, .02, -.17], [.020, .016, .020]);
    add(actuator, 'bolt', 'brass', [side * .13, .07, -.04], [.010, .010, .010]);
  }

  // ------------------------------------------------------------------ antennae
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const records = [];
    for (let i = 0; i < D.antennaCount; i++) {
      const antenna = part(`antenna.${id}.${i + 1}`, `${label} antenna link ${i + 1} of five`, 'Antenna',
        `Keeps antennal segment ${i + 1} at ${Math.round(D.antennaLink * 1000)} mm.`,
        'A titanium rod, two brass collars, a dark bristle and a pale sleeve make one exact segment.', head, [side * .02, .03, 0], 'Titanium rod and brass collars');
      rod(antenna, 'titanium', [0, 0, 0], [0, D.antennaLink, 0], .006);
      for (const y of [0, D.antennaLink]) boss(antenna, [0, y, 0], .011, 'brass', 'y');
      rod(antenna, 'dark', [0, D.antennaLink * .6, 0], [side * .040, D.antennaLink * .8, .02], .003, true);
      add(antenna, 'cylinder', 'shell', [0, D.antennaLink * .35, 0], [.008, .012, .008], [0, 0, 0], true);
      records.push(antenna);
    }
    const club = part(`antenna.${id}.club`, `${label} antennal club`, 'Antenna',
      'Provides the lamellate tip of the antenna.',
      'Three offset pale lamellae, a brass hub, dark hinge and a teal sensor bead fan from the fifth segment.', records[4], [side * .02, .02, 0], 'Pale lamellae, brass hub and teal bead');
    for (let k = 0; k < 3; k++) plate(club, 'shell', [side * .02, D.antennaLink + .02, -.02 + k * .028], [.065, .014, .040], [0, side * .3, 0]);
    add(club, 'sphere', 'brass', [0, D.antennaLink, 0], [.016, .016, .016]);
    add(club, 'sphere', 'lens', [side * .03, D.antennaLink + .01, .02], [.008, .008, .008]);
    antennaClubs.push({ node: club, side });
    const lamella = part(`antenna.${id}.lamella`, `${label} antennal lamella stack`, 'Antenna',
      'Adds a separately hinged lamella stack at the antennal tip.',
      'Three thin pale plates, a brass axle and two dark spacers open behind the club.', club, [side * .02, .03, 0], 'Pale plates, brass axle and dark spacers');
    for (let k = 0; k < 3; k++) plate(lamella, 'shell', [side * .02, D.antennaLink + .02 + k * .01, .050], [.070, .012, .040], [0, side * .3, 0], true);
    rod(lamella, 'brass', [side * .01, D.antennaLink + .01, .03], [side * .04, D.antennaLink + .04, .08], .004);
    antennae.push({ side, records });
  }

  // ------------------------------------------------------------------ elytra
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const cover = part(`elytra.${id}.cover`, `${label} layered elytron cover`, 'Elytra',
      'Covers the abdomen when closed and lifts on the common hinge bar.',
      'A broad pale arched plate, four longitudinal rails, a rolled brass edge and a dark underlayer turn on the hinge pin.', body, [side * .04, .06, 0], 'Formed pale shell, teal underlayer and titanium rails');
    cover.position.set(side * .115, .235, .20);
    for (let k = 0; k < 4; k++) rod(cover, 'titanium', [side * (.07 + k * .038), 0, .02], [side * (.11 + k * .048), -.01, .68], .007);
    add(cover, 'sphere', 'shell', [side * .12, -.002, .36], [.17, .055, .36]);
    plate(cover, 'shell', [side * .075, .028, .32], [.14, .030, .60], [0, side * .04, 0]);
    plate(cover, 'teal', [side * .17, -.030, .34], [.10, .018, .58], [0, side * .05, 0]);
    rod(cover, 'brass', [side * .02, 0, .01], [side * .27, 0, .04], .011);

    const layer = part(`elytra.${id}.layer`, `${label} outer elytron armour layer`, 'Elytra',
      'Adds a second overlapping shell layer above the main cover.',
      'Two pale plates, a dark seam and a brass rib sit on the main elytron for a thick layered silhouette.', cover, [side * .05, .07, 0], 'Formed pale shell, dark seam and brass rib');
    plate(layer, 'shell', [side * .095, .040, .22], [.19, .028, .26], [0, side * .08, 0]);
    plate(layer, 'shell', [side * .115, .052, .53], [.15, .024, .22], [0, side * .12, 0]);
    plate(layer, 'dark', [side * .195, .020, .36], [.016, .035, .54], [0, 0, 0], true);
    rod(layer, 'brass', [side * .02, .045, .10], [side * .16, .06, .66], .006);

    const rim = part(`elytra.${id}.rim`, `${label} elytron rolled edge and brackets`, 'Elytra',
      'Gives the elytron a thick rolled outer edge.',
      'A brass edge wire, four titanium brackets, a dark gasket and two fasteners wrap the cover edge.', cover, [side * .06, .04, 0], 'Brass edge, titanium brackets and dark gasket');
    for (let k = 0; k < 4; k++) rod(rim, 'titanium', [side * .27, -.02, .04 + k * .07], [side * .20, .02, .10 + k * .07], .008);
    rod(rim, 'brass', [side * .27, .02, .04], [side * .27, .02, .66], .007);
    rod(rim, 'rubber', [side * .245, -.035, .06], [side * .245, -.035, .64], .005, true);
    kit.fasteners(rim, [[side * .24, .01, .12], [side * .24, .01, .58]], .0055);

    const ribs = part(`elytra.${id}.ribs`, `${label} elytron rib cassette`, 'Elytra',
      'Shows the structural ribs under the layered cover.',
      'Five titanium ribs, three cross ties and a dark base cassette remain visible in cutaway.', cover, [side * .05, .03, 0], 'Titanium ribs, cross ties and dark cassette');
    for (let k = 0; k < 5; k++) rod(ribs, 'titanium', [side * (.06 + k * .04), -.045, .03], [side * (.10 + k * .05), -.050, .62], .004, k > 0);
    for (let k = 0; k < 3; k++) rod(ribs, 'dark', [side * .06, -.048, .14 + k * .18], [side * .24, -.048, .14 + k * .18], .003, true);
    plate(ribs, 'dark', [side * .14, -.052, .32], [.20, .008, .52], [0, 0, 0], true);

    const membrane = part(`elytra.${id}.membrane`, `${label} folded hind-wing membrane`, 'Elytra',
      'Shows the folded hind wing stored beneath the elytron.',
      'A dark membrane sheet, a pale root fold and six titanium veins sit under the cover and lift with it.', cover, [side * .07, .02, 0], 'Dark membrane, pale fold and titanium veins');
    plate(membrane, 'rubber', [side * .11, -.070, .34], [.19, .006, .56]);
    plate(membrane, 'shell', [side * .05, -.062, .10], [.08, .012, .12]);
    for (let k = 0; k < 6; k++) rod(membrane, 'titanium', [side * .03, -.065, .09], [side * (.06 + k * .033), -.072, .62], .0025, true);
    add(membrane, 'sphere', 'brass', [side * .11, -.065, .06], [.012, .012, .012]);

    const veins = part(`elytra.${id}.veins`, `${label} folded wing vein cassette`, 'Elytra',
      'Adds a second set of folded wing veins and a root hinge.',
      'Four pale veins, a brass root hinge and two dark cross ties fold under the membrane.', membrane, [side * .06, .02, 0], 'Pale veins, brass root and dark cross ties');
    for (let k = 0; k < 4; k++) rod(veins, 'shell', [side * .04, -.058, .12], [side * (.08 + k * .038), -.062, .60], .003, true);
    boss(veins, [side * .04, -.058, .10], .015, 'brass', 'z');
    for (let k = 0; k < 2; k++) rod(veins, 'dark', [side * .06, -.060, .22 + k * .18], [side * .20, -.060, .22 + k * .18], .0025, true);

    const hinge = part(`elytra.${id}.hinge`, `${label} elytron hinge bracket`, 'Elytra drive',
      'Carries the moving cover on the common hinge bar.',
      'A titanium bracket, two brass trunnions, a rubber stop and two fasteners sit at the cover root.', body, [side * .04, .05, 0], 'Titanium bracket, brass trunnions and rubber stop');
    hinge.position.set(side * .115, .235, .20);
    boss(hinge, [0, 0, 0], .034, 'brass', 'z');
    plate(hinge, 'titanium', [side * .02, -.02, -.04], [.08, .045, .08]);
    add(hinge, 'sphere', 'rubber', [side * .04, .02, .02], [.018, .018, .018], [0, 0, 0], true);

    const actuator = part(`elytra.${id}.actuator`, `${label} elytron lift actuator`, 'Elytra drive',
      'Shows the short ram that raises the elytron.',
      'A dark barrel and brass piston stretch between the hinge bar and the moving cover root; only the commanded lift changes.', body, [side * .05, .05, 0], 'Dark barrel and brass piston');
    add(actuator, 'cylinder', 'dark', [0, .5, 0], [.012, 1, .012]);
    add(actuator, 'cylinder', 'brass', [0, .82, 0], [.007, .18, .007], [0, 0, 0], true);
    wingActuators.push({ node: actuator, side });
    covers.push({ node: cover, hinge, side, layer, membrane });
  }

  // ------------------------------------------------------------------ abdomen
  for (let i = 0; i < D.abdomenCount; i++) {
    const frame = part(`abdomen.${i + 1}.frame`, `Abdominal segment ${i + 1} of six`, 'Abdomen',
      `Preserves abdominal pin ${i + 1} at ${Math.round(D.abdomenLink * 1000)} mm.`,
      'Two tapered rings, a wide ventral rail, a dark membrane box and two copper service lines form one pinned segment.', body, [0, .04, 0]);
    for (const y of [0, D.abdomenLink]) boss(frame, [0, y, 0], .095 - i * .009, 'titanium', 'y');
    plate(frame, 'dark', [0, D.abdomenLink * .5, 0], [.17 - i * .014, .12, .11]);
    plate(frame, 'teal', [0, D.abdomenLink * .5, .06], [.13 - i * .012, .08, .03], [0, 0, 0], true);
    for (const side of [-1, 1]) rod(frame, 'copper', [side * .075, .01, .01], [side * .060, D.abdomenLink - .01, .01], .0035, true);
    const tergite = part(`abdomen.${i + 1}.tergite`, `Abdominal tergite ${i + 1}`, 'Abdomen armor',
      'Covers one abdominal segment without closing its pin gap.',
      'A broad pale arched plate, teal underlayer, dark rim and two fasteners bridge the segment above the membrane.', frame, [0, .03, 0], 'Formed pale shell and teal underlayer');
    add(tergite, 'sphere', 'shell', [0, D.abdomenLink * .5, .050], [.105 - i * .008, .075, .070]);
    plate(tergite, 'teal', [0, D.abdomenLink * .5, .000], [.17 - i * .013, .020, .12]);
    plate(tergite, 'dark', [0, D.abdomenLink * .5, .095], [.14 - i * .012, .020, .018], [0, 0, 0], true);
    kit.fasteners(tergite, [[-.060, D.abdomenLink * .5, .085], [.060, D.abdomenLink * .5, .085]], .005);
    const spiracle = part(`abdomen.${i + 1}.spiracle`, `Abdominal spiracle ${i + 1}`, 'Ventilation',
      `Marks the lateral breathing port of segment ${i + 1}.`,
      'A dark aperture, brass bezel and teal screen sit on both sides of the tergite.', tergite, [0, .02, 0], 'Brass bezel, dark aperture and teal screen');
    for (const side of [-1, 1]) {
      add(spiracle, 'sphere', 'lens', [side * .092, D.abdomenLink * .5, .035], [.014, .014, .010]);
      boss(spiracle, [side * .092, D.abdomenLink * .5, .035], .022, 'brass', 'x');
    }
    abdomenFrames.push({ node: frame, index: i });
    if (i < 2) {
      const ram = part(`abdomen.${i + 1}.ram`, `Abdominal lift ram ${i + 1}`, 'Abdomen',
        `Shows the underside actuator across abdominal joint ${i + 1}.`,
        'A dark sleeve and brass piston stretch between the sampled abdominal frames; only the joint pitch changes.', body, [0, .04, 0], 'Dark sleeve and brass piston');
      add(ram, 'cylinder', 'dark', [0, .5, 0], [.009, 1, .009]);
      add(ram, 'cylinder', 'brass', [0, .82, 0], [.0055, .18, .0055], [0, 0, 0], true);
      abdomenRams.push({ node: ram, joint: i });
      const cable = part(`abdomen.${i + 1}.cable`, `Abdominal tendon cable ${i + 1}`, 'Abdomen',
        `Carries a visible copper tendon across abdominal joint ${i + 1}.`,
        'A copper tendon, dark sleeve and brass ferrules follow the sampled joint without stretching the rigid segment.', body, [0, .04, 0], 'Copper tendon, dark sleeve and brass ferrules');
      rod(cable, 'copper', [0, 0, 0], [0, 1, 0], .0035);
      add(cable, 'cylinder', 'dark', [.008, .5, 0], [.0026, 1, .0026], [0, 0, 0], true);
      add(cable, 'bolt', 'brass', [0, 0, 0], [.010, .018, .010]);
      abdomenRams.push({ node: cable, joint: i, cable: true });
    }
    if (i < 4) {
      const pleurite = part(`abdomen.${i + 1}.pleurite`, `Abdominal pleurite ${i + 1}`, 'Abdomen armor',
        `Adds a side armor plate to abdominal segment ${i + 1}.`,
        'A teal side plate, pale edge strip, dark membrane gap and two brass pins sit between the tergite and ventral rail.', frame, [0, .03, 0], 'Teal side plate, pale edge and brass pins');
      for (const side of [-1, 1]) {
        plate(pleurite, 'teal', [side * .095, D.abdomenLink * .5, .035], [.022, .10 - i * .008, .10]);
        plate(pleurite, 'shell', [side * .108, D.abdomenLink * .5, .050], [.012, .075, .075], [0, 0, 0], true);
        add(pleurite, 'bolt', 'brass', [side * .100, D.abdomenLink * .25, .050], [.008, .010, .008], [0, 0, 0], true);
      }
    }
  }
  const abdomenTip = part('abdomen.7.tip', 'Abdominal tip, pygidium and cerci', 'Abdomen',
    'Terminates the six-link abdomen with two short cerci.',
    'A brass hub, pale cap, dark pygidium and two dark cerci follow the final abdominal pin.', body, [0, .04, 0], 'Brass hub, pale cap and dark cerci');
  abdomenTip.position.fromArray(lastState.abdomen.points[D.abdomenCount]);
  boss(abdomenTip, [0, 0, 0], .042, 'brass', 'x');
  add(abdomenTip, 'sphere', 'shell', [0, -.02, .04], [.070, .050, .045]);
  for (const side of [-1, 1]) rod(abdomenTip, 'dark', [0, 0, 0], [side * .060, -.02, .10], .0045);
  const cerci = part('abdomen.cerci', 'Cercal fan and wear tips', 'Abdomen',
    'Adds two segmented cerci and brass ferrules to the abdominal tip.',
    'Two dark rods, two brass ferrules and two rubber sleeves fan from the pygidium.', abdomenTip, [0, .05, 0], 'Dark rods, brass ferrules and rubber sleeves');
  for (const side of [-1, 1]) {
    rod(cerci, 'dark', [0, 0, 0], [side * .050, -.03, .13], .004);
    add(cerci, 'bolt', 'brass', [side * .046, -.028, .12], [.008, .012, .008]);
    add(cerci, 'sphere', 'rubber', [side * .050, -.034, .13], [.007, .010, .007], [0, 0, 0], true);
  }

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.legs && state?.mandibles && state?.abdomen) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    body.position.fromArray(pose.body.offset);
    for (const [i, record] of legs.entries()) {
      const leg = pose.legs[i];
      aim(record.femur, leg.hip, leg.knee);
      aim(record.tibia, leg.knee, leg.ankle);
      aim(record.tarsus, leg.ankle, leg.footLocal);
      record.knee.position.fromArray(leg.knee);
      record.foot.position.fromArray(leg.footLocal);
    }
    head.position.fromArray(pose.head.origin);
    head.rotation.set(pose.head.pitch, pose.head.yaw, pose.head.roll || 0, 'YXZ');
    mandibles.forEach((record, s) => record.records.forEach((node, i) => {
      const link = pose.mandibles[s].links[i]; aim(node, link.start, link.end);
    }));
    antennae.forEach((record, s) => record.records.forEach((node, i) => {
      const link = pose.antennae[s].links[i]; aim(node, link.start, link.end);
    }));
    antennaClubs.forEach(record => { record.node.rotation.y = record.side * 0.12 * Math.sin(pose.driveAngle + 0.8); });
    abdomenFrames.forEach((record, i) => { const link = pose.abdomen.links[i]; aim(record.node, link.start, link.end); });
    abdomenTip.position.fromArray(pose.abdomen.points[D.abdomenCount]);
    abdomenRams.forEach(record => {
      const i = record.joint, a = pose.abdomen.links[i], b = pose.abdomen.links[i + 1];
      aim(record.node, a.start, b.end);
      record.node.scale.set(1, Math.max(distance(a.start, b.end), 1e-4), 1);
    });
    bellyRams.forEach(record => {
      const abdomen = pose.abdomen.links[0];
      aim(record.node, [record.side * .15, -.16, -.12], abdomen.end);
      record.node.scale.set(1, Math.max(distance([record.side * .15, -.16, -.12], abdomen.end), 1e-4), 1);
    });
    const angle = pose.elytra.angle, flutter = pose.elytra.flutter + pose.elytra.liftWave;
    covers.forEach(record => {
      record.node.rotation.set(-angle * .22, record.side * pose.elytra.pitch * .5, record.side * (0.16 + angle + flutter));
      const tip = new THREE.Vector3(record.side * .24, .30 + 0.10 * Math.sin(0.16 + angle + flutter), .36);
      const anchor = new THREE.Vector3(record.side * .20, .23, .18);
      const actuator = wingActuators.find(item => item.side === record.side);
      if (actuator) {
        aim(actuator.node, anchor.toArray(), tip.toArray());
        actuator.node.scale.set(1, Math.max(distance(anchor.toArray(), tip.toArray()), 1e-4), 1);
      }
    });
    mouthNodes.forEach(record => { record.node.rotation.set(pose.mouth[record.kind] || 0, record.side * pose.mouth.palp * .4, 0); });
    kit.sync(options);
  }
  update(lastState);

  // Camera fit across the gait, pincer display and elytra lift envelopes.
  const framePoints = [], seen = new Set(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  const corners = [[-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1], [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]];
  for (const [input, count] of [[undefined, 14], [{ gape: 32, elytra: 28, antenna: 25, stride: .16 }, 9], [{ gape: 0, elytra: 0, antenna: 0, stride: .06 }, 7]]) for (let i = 0; i < count; i++) {
    update(sample(i / count / .34, { cadence: .34, ...input }));
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
