import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('CERVUS B6 · stag beetle and six-leg drive');
  kit.assemblies.rotation.y = Math.PI;
  const nodes = [], legs = [], mandibles = [], antennae = [], abdomen = [];
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

  // ------------------------------------------------------------------ thorax
  const body = part('body.chassis', 'Thorax chassis, waist and ventral keel', 'Body structure',
    'Carries six legs, the pronotum, both elytra, the head and the abdomen.',
    'A machined thorax box, three ventral plates and a narrow waist keep every leg mount on one rigid frame.', undefined, [0, 0, 0], 'Titanium, dark alloy and formed shell');
  plate(body, 'dark', [0, 0, -.06], [.42, .20, .48]);
  add(body, 'sphere', 'shell', [0, .09, -.06], [.24, .13, .26]);
  plate(body, 'shell', [0, .045, .20], [.30, .12, .20]);
  plate(body, 'dark', [0, -.11, -.06], [.34, .05, .46]);
  for (let k = 0; k < 3; k++) plate(body, 'titanium', [0, -.145, -.18 + k * .14], [.26, .018, .08], [0, 0, 0], true);
  for (const side of [-1, 1]) rod(body, 'copper', [side * .18, -.02, -.24], [side * .18, -.02, .18], .004, true);
  plate(body, 'brass', [0, .06, -.30], [.16, .05, .04]);

  const pronotum = part('body.pronotum', 'Pronotal shield and neck collar', 'Body armor',
    'Protects the thorax while leaving the leg pins exposed.',
    'A broad pale shield on four isolators, two shoulder rails and a bolted neck collar.', body, [0, .05, 0], 'Formed pale alloy shell and brass collar');
  add(pronotum, 'sphere', 'shell', [0, .20, -.12], [.27, .07, .25]);
  for (const side of [-1, 1]) rod(pronotum, 'titanium', [side * .22, .17, -.32], [side * .22, .17, .06], .011);
  boss(pronotum, [0, .13, -.38], .055, 'brass', 'z');
  kit.fasteners(pronotum, [[-.16, .24, -.15], [.16, .24, -.15]], .008);

  const bar = part('body.elytraBar', 'Elytral hinge bar and two pins', 'Elytra drive',
    'Provides the common hinge line for both wing covers.',
    'A transverse brass bar, two eye brackets and a center stop sit above the waist.', body, [0, .04, 0], 'Brass bar and titanium brackets');
  rod(bar, 'brass', [-.20, .22, .20], [.20, .22, .20], .014);
  for (const side of [-1, 1]) { boss(bar, [side * .17, .22, .20], .038, 'titanium', 'z'); plate(bar, 'dark', [side * .09, .20, .20], [.05, .05, .04]); }
  plate(bar, 'shell', [0, .24, .15], [.16, .03, .10]);

  for (const leg of lastState.legs) {
    const item = leg, label = `${['front', 'middle', 'rear'][item.row]} ${item.side < 0 ? 'left' : 'right'}`, id = item.id;
    const mount = part(`leg.${id}.mount`, `${label} coxa mount`, 'Leg drive',
      'Clamps the leg yoke to the thorax frame.',
      'A bolted bracket and two diagonal stays tie the hip bearing into the ventral keel.', body, [item.side * .04, .01, 0]);
    mount.position.fromArray(item.hip);
    boss(mount, [0, 0, 0], .048, 'titanium', 'x');
    rod(mount, 'dark', [0, .02, 0], [item.side * .05, .10, .02], .010);
    kit.fasteners(mount, [[item.side * .04, .10, -.03], [item.side * .04, .10, .03]], .007);
    const hip = part(`leg.${id}.hip`, `${label} hip bearing`, 'Leg drive',
      'Locates the first leg pin on the mount.',
      'A brass pin and two side retainers clamp the femur clevis without hiding the joint.', body, [item.side * .04, .01, 0]);
    hip.position.fromArray(item.hip);
    boss(hip, [0, 0, 0], .036, 'brass', 'x');
    const femur = part(`leg.${id}.femur`, `${label} femur truss`, 'Leg drive',
      'Carries the knee through the stance phase.',
      'Two rails, two rings and three braces preserve the 380 mm femur length.', body, [item.side * .04, 0, 0]);
    for (const x of [-.018, .018]) rod(femur, 'titanium', [x, 0, 0], [x, D.femur, 0], .010);
    boss(femur, [0, 0, 0], .028, 'brass', 'x'); boss(femur, [0, D.femur, 0], .026, 'titanium', 'x');
    for (const f of [.35, .65]) rod(femur, 'dark', [-.024, D.femur * f, 0], [.024, D.femur * f, 0], .004, true);
    const tibia = part(`leg.${id}.tibia`, `${label} tibia truss`, 'Leg drive',
      'Transfers the knee solution to the tarsal pin.',
      'A second rigid truss, a service hose and two end rings make the 400 mm tibia.', body, [item.side * .04, 0, 0]);
    for (const x of [-.016, .016]) rod(tibia, 'titanium', [x, 0, 0], [x, D.tibia, 0], .009);
    boss(tibia, [0, 0, 0], .026, 'brass', 'x'); boss(tibia, [0, D.tibia, 0], .024, 'titanium', 'x');
    for (const f of [.35, .65]) rod(tibia, 'dark', [-.022, D.tibia * f, 0], [.022, D.tibia * f, 0], .0035, true);
    rod(tibia, 'copper', [.024, .06, .01], [.024, .34, .01], .0025, true);
    const knee = part(`leg.${id}.knee`, `${label} knee hinge`, 'Leg drive',
      'Defines the knee pitch axis.',
      'A brass pin, two outboard retainers and a pale cap clamp the joint.', body, [item.side * .03, 0, 0]);
    boss(knee, [0, 0, 0], .034, 'brass', 'x');
    add(knee, 'sphere', 'shell', [0, 0, -.04], [.032, .032, .014]);
    const tarsus = part(`leg.${id}.tarsus`, `${label} 100 mm tarsus`, 'Foot support',
      'Keeps the claws at a fixed offset below the ankle.',
      'A short pair of rails and two clevises preserve the ankle-to-sole distance.', body, [item.side * .03, 0, 0]);
    for (const x of [-.008, .008]) rod(tarsus, 'titanium', [x, 0, 0], [x, Math.hypot(...D.ankleLift), 0], .005);
    const foot = part(`leg.${id}.foot`, `${label} foot and three claws`, 'Foot support',
      'Provides one planted contact with a visible claw fan.',
      'A machined pad, rubber tread and three dark claws stay level through stance.', body, [item.side * .03, .01, 0], 'Titanium pad, rubber tread and dark claws');
    plate(foot, 'dark', [0, -.012, -.02], [.12, .04, .16]);
    plate(foot, 'rubber', [0, -.034, -.03], [.11, .010, .15]);
    for (let k = 0; k < 3; k++) add(foot, 'cone', 'dark', [-.035 + k * .035, -.015, -.11], [.012, .07, .012], [Math.PI / 2, 0, 0], true);
    legs.push({ id, femur, tibia, tarsus, knee, foot });
  }

  // ------------------------------------------------------------------ head
  const head = part('head.carrier', 'Head gimbal, neck and mandible frame', 'Head structure',
    'Carries the cranium, eyes, antennae and both pincer bases.',
    'A bolted gimbal collar and a transverse frame hold the head ahead of the pronotum.', body, [0, .06, -.03], 'Titanium and brass');
  head.position.fromArray(lastState.head.origin);
  boss(head, [0, 0, 0], .045, 'brass', 'x');
  const cranium = part('head.cranium', 'Cranium and clypeus shell', 'Head structure',
    'Protects the sensor apertures above the mandible sockets.',
    'A rounded pale cranium, dark clypeus plate and two cheek rails leave the mouth frame open.', head, [0, .02, -.02], 'Formed pale alloy shell and dark clypeus');
  add(cranium, 'sphere', 'shell', [0, .03, -.10], [.17, .10, .17]);
  plate(cranium, 'dark', [0, -.04, -.24], [.20, .07, .10]);
  for (const side of [-1, 1]) rod(cranium, 'titanium', [side * .12, .00, -.18], [side * .14, -.08, -.28], .010);
  for (const side of [-1, 1]) {
    const eye = part(`head.eye.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} compound-eye housing`, 'Head optics',
      'Places a faceted lens on the side of the head.',
      'A dark cup, brass bezel and teal dome sit outside the cranium shell.', head, [side * .09, .03, 0], 'Dark cup, brass bezel and teal dome');
    add(eye, 'sphere', 'lens', [side * .15, .04, -.20], [.045, .045, .035]);
    boss(eye, [side * .15, .04, -.19], .052, 'brass', 'x');
    const socket = part(`head.socket.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} mandible socket`, 'Mandible drive',
      'Carries the first pincer pin and its adductor.',
      'A double-cheek bracket, brass pin and two bolts keep the pincer root outboard.', head, [side * .05, .02, 0], 'Titanium bracket and brass pin');
    socket.position.set(side * D.mandibleBase[0], D.mandibleBase[1], D.mandibleBase[2]);
    boss(socket, [0, 0, 0], .033, 'brass', 'x');
    for (const dy of [-.03, .03]) rod(socket, 'dark', [0, dy, .03], [side * .03, dy, .08], .006);
  }

  // ------------------------------------------------------------------ mandibles
  for (let s = 0; s < 2; s++) {
    const side = s ? 1 : -1, id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const records = [];
    for (let i = 0; i < 3; i++) {
      const link = part(`mandible.${id}.${i + 1}`, `${label} pincer link ${i + 1} of three`, 'Mandible drive',
        `Preserves pincer link ${i + 1} at ${Math.round(D.mandibleLengths[i] * 1000)} mm.`,
        'A curved pale beam, two brass pins and three inner teeth form one rigid pincer link.', head, [side * .02, .02, 0], 'Formed pale alloy shell, brass pins and dark teeth');
      for (const x of [-.018, .018]) rod(link, 'shell', [x, 0, 0], [x, D.mandibleLengths[i], 0], .016 - i * .002);
      boss(link, [0, 0, 0], .024 - i * .003, 'brass', 'x');
      boss(link, [0, D.mandibleLengths[i], 0], .020 - i * .002, 'titanium', 'x');
      for (let t = 0; t < 3; t++) {
        const at = D.mandibleLengths[i] * (.25 + t * .25);
        add(link, 'cone', 'dark', [side * -.025, at, .012], [.008, .045, .008], [0, 0, side * -.45], true);
      }
      plate(link, 'dark', [0, D.mandibleLengths[i] * .5, -.020], [.060, D.mandibleLengths[i] * .7, .018]);
      records.push(link);
    }
    const hook = part(`mandible.${id}.hook`, `${label} pincer tip hook`, 'Mandible drive',
      'Adds the inward hook that defines the pincer tip.',
      'A dark curved plate and two brass pins extend from the third link without changing its length.', records[2], [side * .02, .02, 0], 'Dark hook plate and brass pins');
    plate(hook, 'dark', [side * -.025, D.mandibleLengths[2] + .025, .02], [.035, .10, .025], [0, 0, side * -.35]);
    rod(hook, 'brass', [0, D.mandibleLengths[2] - .02, 0], [side * -.055, D.mandibleLengths[2] + .02, .02], .005);
    mandibles.push({ side, records });
    const actuator = part(`mandible.${id}.actuator`, `${label} pincer adductor`, 'Mandible drive',
      'Shows the linear actuator that drives the pincer root.',
      'A dark cylinder, brass rod and clevis sit behind the socket and stay clear of the eye.', head, [side * .03, .02, 0], 'Dark cylinder and brass rod');
    add(actuator, 'cylinder', 'dark', [side * .13, .05, -.12], [.018, .13, .018], [0, 0, side * .65]);
    rod(actuator, 'brass', [side * .16, .01, -.16], [side * .19, -.01, -.20], .005);
  }

  // ------------------------------------------------------------------ antennae
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const records = [];
    for (let i = 0; i < D.antennaCount; i++) {
      const antenna = part(`antenna.${id}.${i + 1}`, `${label} antenna link ${i + 1} of five`, 'Antenna',
        `Keeps antennal segment ${i + 1} at ${Math.round(D.antennaLink * 1000)} mm.`,
        'A thin titanium rod, two collars and a side bristle make one exact segment.', head, [side * .02, .03, 0], 'Titanium rod and brass collars');
      rod(antenna, 'titanium', [0, 0, 0], [0, D.antennaLink, 0], .0045);
      for (const y of [0, D.antennaLink]) boss(antenna, [0, y, 0], .009, 'brass', 'y');
      rod(antenna, 'dark', [0, D.antennaLink * .6, 0], [side * .035, D.antennaLink * .8, .02], .0025, true);
      records.push(antenna);
    }
    const club = part(`antenna.${id}.club`, `${label} antennal club`, 'Antenna',
      'Provides the lamellate tip of the antenna.',
      'Three offset pale lamellae and a brass hub fan from the fifth segment.', records[4], [side * .02, .02, 0], 'Pale lamellae and brass hub');
    for (let k = 0; k < 3; k++) plate(club, 'shell', [side * .02, D.antennaLink + .02, -.02 + k * .025], [.055, .012, .035], [0, side * .3, 0], true);
    add(club, 'sphere', 'brass', [0, D.antennaLink, 0], [.014, .014, .014]);
    antennae.push({ side, records });
  }

  // ------------------------------------------------------------------ elytra
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'Left' : 'Right';
    const cover = part(`elytra.${id}.cover`, `${label} elytron cover`, 'Elytra',
      'Covers the abdomen when closed and lifts on the hinge bar.',
      'A pale curved plate, four longitudinal rails and a rolled edge turn on the hinge pin.', body, [side * .04, .06, 0], 'Formed pale alloy shell and titanium rails');
    cover.position.set(side * .115, .235, .20);
    for (let k = 0; k < 4; k++) rod(cover, 'titanium', [side * (.06 + k * .035), 0, .02], [side * (.10 + k * .045), -.01, .64], .006);
    plate(cover, 'shell', [side * .13, -.005, .34], [.28, .018, .62], [0, side * .04, 0]);
    plate(cover, 'dark', [side * .13, -.02, .34], [.24, .01, .54], [0, 0, 0], true);
    rod(cover, 'brass', [side * .02, 0, .01], [side * .26, 0, -.02], .010);
    const membrane = part(`elytra.${id}.membrane`, `${label} hind-wing membrane frame`, 'Elytra',
      'Shows the folded hind wing beneath the cover.',
      'Six thin veins and a dark root plate sit below the elytron and fold with it.', cover, [0, .02, 0], 'Titanium veins and dark membrane');
    for (let k = 0; k < 6; k++) rod(membrane, 'titanium', [side * .03, -.03, .08], [side * (.07 + k * .018), -.035, .60], .0025, true);
    plate(membrane, 'rubber', [side * .085, -.035, .34], [.16, .006, .54]);
  }

  // ------------------------------------------------------------------ abdomen
  for (let i = 0; i < D.abdomenCount; i++) {
    const frame = part(`abdomen.${i + 1}.frame`, `Abdominal segment ${i + 1} of six`, 'Abdomen',
      `Preserves abdominal pin ${i + 1} at ${Math.round(D.abdomenLink * 1000)} mm.`,
      'Two tapered rings, a ventral rail and a lateral membrane form one pinned segment.', body, [0, .04, 0]);
    for (const y of [0, D.abdomenLink]) boss(frame, [0, y, 0], .075 - i * .008, 'titanium', 'y');
    plate(frame, 'dark', [0, D.abdomenLink * .5, 0], [.13 - i * .014, .10, .10]);
    for (const side of [-1, 1]) rod(frame, 'copper', [side * .06, .01, .01], [side * .05, D.abdomenLink - .01, .01], .003, true);
    const tergite = part(`abdomen.${i + 1}.tergite`, `Abdominal tergite ${i + 1}`, 'Abdomen armor',
      'Covers one abdominal segment without closing its pin gap.',
      'A pale arched plate on four isolators leaves the dark membrane visible.', frame, [0, .03, 0], 'Formed pale alloy shell');
    add(tergite, 'sphere', 'shell', [0, D.abdomenLink * .5, -.005], [.085 - i * .008, .045, .055]);
    kit.fasteners(tergite, [[-.05, D.abdomenLink * .5, .03], [.05, D.abdomenLink * .5, .03]], .005);
    const spiracle = part(`abdomen.${i + 1}.spiracle`, `Abdominal spiracle ${i + 1}`, 'Ventilation',
      `Marks the lateral breathing port of segment ${i + 1}.`,
      'A dark aperture, brass bezel and teal screen sit on the side of the tergite.', tergite, [0, .02, 0], 'Brass bezel, dark aperture and teal screen');
    for (const side of [-1, 1]) {
      add(spiracle, 'sphere', 'lens', [side * .078, D.abdomenLink * .5, .015], [.012, .012, .008]);
      boss(spiracle, [side * .078, D.abdomenLink * .5, .015], .018, 'brass', 'x');
    }
  }
  const abdomenTip = part('abdomen.7.tip', 'Abdominal tip and cerci', 'Abdomen',
    'Terminates the six-link abdomen with two short cerci.',
    'A brass hub, a pale cap and two dark cerci follow the final abdominal pin.', body, [0, .04, 0], 'Brass hub, pale cap and dark cerci');
  abdomenTip.position.fromArray(lastState.abdomen.points[D.abdomenCount]);
  boss(abdomenTip, [0, 0, 0], .036, 'brass', 'x');
  for (const side of [-1, 1]) rod(abdomenTip, 'dark', [0, 0, 0], [side * .055, -.02, .10], .004);

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
    head.rotation.set(pose.head.pitch, pose.head.yaw, 0, 'YXZ');
    mandibles.forEach((record, s) => record.records.forEach((node, i) => {
      const link = pose.mandibles[s].links[i]; aim(node, link.start, link.end);
    }));
    antennae.forEach((record, s) => record.records.forEach((node, i) => {
      const link = pose.antennae[s].links[i]; aim(node, link.start, link.end);
    }));
    abdomen.forEach((record, i) => { const link = pose.abdomen.links[i]; aim(record.node, link.start, link.end); });
    abdomenTip.position.fromArray(pose.abdomen.points[D.abdomenCount]);
    for (const side of [-1, 1]) {
      const cover = nodes.find(n => n.userData.partId === `elytra.${side < 0 ? 'L' : 'R'}.cover`);
      if (cover) { cover.rotation.set(-pose.elytra.angle * .22, 0, side * (0.16 + pose.elytra.angle + pose.elytra.flutter * (side < 0 ? -1 : 1))); }
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
