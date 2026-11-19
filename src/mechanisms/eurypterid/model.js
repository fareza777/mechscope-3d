import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, LEGS, sample, poseAt, distance, add as vadd, sub, mul } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('LEVIATHAN E12 · armoured sea scorpion');
  const { add, rod, gear, fasteners, aim } = kit;
  const basis = new THREE.Matrix4();
  let current = sample(0), disposed = false;
  const part = (id, name, system, purpose, how, parent, explode = [0, .16, 0]) => kit.part({ id: `eurypterid.${id}`, name, system, function: purpose, how, detail: `${purpose} ${how}`, material: 'Pale alloy armour / teal housings / bronze bearings', unit: 'm · rad' }, parent, explode);
  const box = (n, m, p, s, e = [0, 0, 0], detail = false) => add(n, 'box', m, p, s, e, detail);
  const sphere = (n, m, p, s, detail = false) => add(n, 'sphere', m, p, s, [0, 0, 0], detail);
  const label = s => s < 0 ? 'Left' : 'Right';
  const sid = s => s < 0 ? 'L' : 'R';
  function place(node, origin, frame) {
    basis.set(frame[0], frame[1], frame[2], 0, frame[3], frame[4], frame[5], 0, frame[6], frame[7], frame[8], 0, 0, 0, 0, 1);
    node.position.fromArray(origin); node.quaternion.setFromRotationMatrix(basis);
  }
  function member(node, length, width, material = 'teal') {
    box(node, 'dark', [0, length / 2, 0], [width * 1.6, length, width * 1.2]);
    sphere(node, material, [0, length * .48, 0], [width * 1.28, length * .49, width]);
    for (const s of [-1, 1]) {
      rod(node, 'titanium', [s * width * .9, .025, -.035], [s * width * .9, length - .025, -.035], .021);
      rod(node, 'copper', [s * width * 1.03, .08, -.055], [s * width * 1.03, length - .065, -.055], .009, true);
    }
    for (const y of [0, length]) {
      add(node, 'cylinder', 'dark', [0, y, 0], [width, width * 2.65, width], [0, 0, Math.PI / 2]);
      for (const s of [-1, 1]) add(node, 'ring', 'brass', [s * width * 1.35, y, 0], [width * .82, width * .82, width * .82], [0, Math.PI / 2, 0]);
    }
    fasteners(node, [[-.075, length * .3, width], [.075, length * .7, width]], .010);
  }
  function armour(id, name, parent, length, width) {
    const n = part(id, name, 'Articulated armour', 'Cover a rigid load member while leaving its bearing ends and service lines exposed.', 'A thick pale cap follows the actual member frame; explosion lifts the cover independently of the load path.', parent, [0, 0, .17]);
    sphere(n, 'shell', [0, length * .48, width * .45], [width * 1.36, length * .36, width * .71]);
    box(n, 'teal', [0, length * .50, width * 1.08], [width * 1.6, length * .62, .034]);
    for (let j = 0; j < 3; j++) box(n, 'brass', [0, length * (.27 + .19 * j), width * 1.30], [width * 1.35, .016, .018], [0, 0, 0], true);
    return n;
  }
  function ram(id, name, length) {
    const barrel = part(`${id}.barrel`, `${name} · pressure barrel`, 'Hydraulic actuators', 'Carry a fixed-length hydraulic sleeve between moving clevis locations.', 'The sleeve aims at the output pin without stretching. A separate polished rod takes up the changing exposed distance.', undefined, [.07, .06, 0]);
    add(barrel, 'cylinder', 'dark', [0, length / 2, 0], [.039, length, .039]);
    for (const y of [.02, length - .02]) add(barrel, 'cylinder', 'copper', [0, y, 0], [.047, .032, .047]);
    sphere(barrel, 'brass', [0, 0, 0], [.05, .05, .05]);
    rod(barrel, 'rubber', [.05, .025, 0], [.05, length - .03, 0], .01, true);
    const piston = part(`${id}.rod`, `${name} · telescoping rod`, 'Hydraulic actuators', 'Connect the gland to the sampled moving output pin.', 'Only the polished exposed span changes length; the pressure barrel and both attachment positions remain rigid.', undefined, [.12, .09, 0]);
    add(piston, 'cylinder', 'titanium', [0, .5, 0], [.018, 1, .018]);
    const eye = part(`${id}.eye`, `${name} · output clevis`, 'Hydraulic actuators', 'Keep the rod end attached to its actual moving member.', 'A bronze ball and a transverse pin stay centred on the analytically computed attachment point.', undefined, [.14, .10, 0]);
    sphere(eye, 'brass', [0, 0, 0], [.041, .041, .041]);
    add(eye, 'cylinder', 'titanium', [0, 0, 0], [.021, .11, .021], [0, 0, Math.PI / 2]);
    return { barrel, piston, eye, length };
  }
  function poseRam(n, r) {
    aim(n.barrel, r.a, r.b);
    const start = n.length - .025;
    aim(n.piston, vadd(r.a, mul(sub(r.b, r.a), start / r.length)), r.b);
    n.piston.scale.y = r.length - start;
    n.eye.position.fromArray(r.b);
  }

  const body = part('body', 'Prosoma · wide load chassis', 'Prosoma', 'Join six walking legs, two pedipalps, two oars and the abdominal spine into one broad load frame.', 'Two longitudinal beams and three crossmembers sit below the split shield, leaving a central inspection well for the gearing.', undefined, [0, .08, 0]);
  for (const s of [-1, 1]) {
    box(body, 'dark', [s * .39, -.14, -.10], [.16, .19, 1.30]);
    box(body, 'teal', [s * .62, -.10, -.10], [.13, .17, 1.08]);
    rod(body, 'copper', [s * .56, -.06, -.62], [s * .56, -.06, .53], .022);
    for (const z of [-.50, 0, .48]) {
      add(body, 'cylinder', 'dark', [s * .65, -.07, z], [.14, .15, .14], [0, 0, Math.PI / 2]);
      add(body, 'ring', 'brass', [s * .735, -.07, z], [.13, .13, .13], [0, Math.PI / 2, 0]);
    }
  }
  for (const z of [-.55, -.02, .50]) box(body, 'titanium', [0, -.16, z], [1.23, .105, .13]);
  const keel = part('keel', 'Ventral keel and inspection belly', 'Prosoma', 'Protect the underside without turning the whole body into an opaque solid block.', 'A deep central keel and vented belly ribs support the pump bank; armour can be ghosted or separated for inspection.', body, [0, -.24, 0]);
  box(keel, 'teal', [0, -.21, -.08], [.36, .16, 1.13]);
  for (let j = 0; j < 7; j++) box(keel, 'shell', [0, -.25, -.54 + j * .16], [.67, .07, .09]);
  const panels = [-1, 1].map(s => {
    const n = part(`shield.${sid(s)}`, `${label(s)} domed prosomal shield`, 'Split armour', 'Give the animal a massive, flattened shield with a continuous filled silhouette.', 'A thick hinged half-shell opens slightly for ventilation and spreads during the display while the chassis stays connected underneath.', body, [s * .26, .30, 0]);
    n.position.set(s * .12, .02, -.12);
    sphere(n, 'shell', [s * .36, .015, 0], [.49, .235, .73]);
    sphere(n, 'teal', [s * .39, -.065, 0], [.52, .12, .76]);
    box(n, 'shell', [s * .23, .19, .02], [.35, .075, .98], [0, 0, -s * .10]);
    box(n, 'teal', [s * .43, .23, -.04], [.19, .035, .86], [0, 0, -s * .22]);
    for (let j = 0; j < 6; j++) {
      box(n, 'dark', [s * .53, .17, -.43 + j * .16], [.19, .025, .055], [0, s * .15, -s * .30]);
      box(n, 'brass', [s * .72, .035, -.45 + j * .17], [.055, .035, .11], [0, 0, -s * .35], true);
    }
    fasteners(n, [[s * .20, .235, -.40], [s * .20, .235, .39], [s * .55, .19, -.28], [s * .55, .19, .28]], .014);
    return n;
  });
  const brow = part('brow', 'Armoured brow and forward sensor ridge', 'Head and sensors', 'Make the front immediately recognisable above the two large predatory claws.', 'A wide pale brow bridges the eye turrets, with a teal centre ridge and a small optical window facing forward.', body, [0, .13, -.24]);
  sphere(brow, 'shell', [0, .10, -.73], [.59, .17, .25]);
  box(brow, 'teal', [0, .22, -.68], [.23, .07, .31], [.15, 0, 0]);
  box(brow, 'dark', [0, .06, -.92], [.28, .12, .07]);
  box(brow, 'lens', [0, .08, -.962], [.16, .055, .018]);
  const eyes = [-1, 1].map(s => {
    const turret = part(`eye.${sid(s)}`, `${label(s)} scanning eye turret`, 'Head and sensors', 'Sweep a compound optical pod across the forward field.', 'A bronze yaw journal and independent pitch yoke follow different integer-rate scan waves, rather than remaining fixed on the shell.', body, [s * .16, .23, -.11]);
    turret.position.set(s * .48, .23, -.67);
    add(turret, 'cylinder', 'dark', [0, 0, 0], [.13, .11, .13]);
    add(turret, 'ring', 'brass', [0, .055, 0], [.13, .13, .13], [Math.PI / 2, 0, 0]);
    const pod = part(`eye.${sid(s)}.optic`, `${label(s)} compound optical pod`, 'Head and sensors', 'Tilt the lenses inside their swivelling eye yoke.', 'Three cyan apertures sit in a thick dark housing with a pale upper brow; the pod pitches independently of the yaw bearing.', turret, [0, .15, -.08]);
    pod.position.y = .105;
    sphere(pod, 'dark', [0, 0, 0], [.16, .115, .125]);
    sphere(pod, 'shell', [0, .07, .01], [.17, .08, .115]);
    for (let j = -1; j <= 1; j++) { sphere(pod, 'lens', [j * .075, .005, -.108], [.031, .045, .026]); add(pod, 'ring', 'brass', [j * .075, .005, -.125], [.038, .049, .035]); }
    return { turret, pod };
  });
  const mouth = [-1, 1].flatMap(s => [0, 1, 2].map(j => {
    const n = part(`mouth.${sid(s)}${j + 1}`, `${label(s)} gnathobase ${j + 1}`, 'Feeding basket', 'Move one of the layered mouth palps beneath the forward shield.', 'Alternating hinge angles sweep six toothed palps inward and outward in a coordinated feeding pattern; no food or contact forces are simulated.', body, [s * .08, -.13, -.18]);
    n.position.set(s * (.17 + j * .075), -.11 + j * .042, -.77 + j * .14);
    sphere(n, 'teal', [0, -.025, -.12], [.09, .075, .20]);
    rod(n, 'brass', [0, 0, 0], [-s * .07, -.04, -.26], .028);
    for (let k = 0; k < 4; k++) add(n, 'cone', 'titanium', [-s * (.05 + k * .015), -.015, -.09 - k * .045], [.016, .065, .016], [0, 0, s * Math.PI / 2]);
    return { n, s };
  }));

  const shaft = part('drive.shaft', 'Longitudinal timing shaft', 'Powertrain', 'Distribute the master gait phase along the open centre of the chassis.', 'An exposed shaft turns six revolutions per choreography cycle with offset crank throws that drive the pump rods.', body, [0, .20, 0]);
  shaft.position.set(0, .025, -.10);
  rod(shaft, 'titanium', [0, 0, -.52], [0, 0, .52], .045);
  for (let j = 0; j < 4; j++) {
    add(shaft, 'cylinder', 'brass', [0, 0, -.35 + j * .23], [.13, .045, .13], [Math.PI / 2, 0, 0]);
    rod(shaft, 'copper', [0, 0, -.35 + j * .23], [.075 * Math.sin(j * Math.PI / 2), .075 * Math.cos(j * Math.PI / 2), -.35 + j * .23], .025);
  }
  const gears = [0, 1, 2].map(i => {
    const g = part(`drive.gear${i + 1}`, `Dorsal transfer wheel ${i + 1}`, 'Powertrain', 'Transfer timing across the three visible dorsal spur wheels.', 'Equal eighteen-tooth wheels have alternating angular signs and matched pitch spacing; tooth contact forces are not computed.', body, [0, .28 + i * .04, 0]);
    g.position.set((i - 1) * .242, .16, .36); gear(g, .121, 18, .038); return g;
  });
  const cage = part('drive.gyro', 'Exposed reactor · outer gimbal', 'Reactor', 'Suspend the luminous timing rotor in the open centre well.', 'Two nested rings carry a third spinning rotor at integer phase ratios. It is a visible conceptual power unit, not a solved energy source.', body, [0, .34, 0]);
  cage.position.set(0, .255, -.18);
  add(cage, 'ring', 'brass', [0, 0, 0], [.205, .205, .205]);
  rod(cage, 'titanium', [-.235, 0, 0], [.235, 0, 0], .018);
  const inner = part('drive.gyro.inner', 'Reactor · inner gimbal', 'Reactor', 'Support the rotor on a second visible axis inside the bronze cage.', 'A smaller teal ring turns relative to its parent; the two gimbal frames never require deforming their rigid geometry.', cage, [.18, .12, 0]);
  add(inner, 'ring', 'teal', [0, 0, 0], [.165, .165, .165], [Math.PI / 2, 0, 0]);
  const rotor = part('drive.gyro.rotor', 'Reactor · luminous flywheel rotor', 'Reactor', 'Expose a bright moving centre between the dark mechanisms and pale armour.', 'A six-spoke copper rotor turns within the inner gimbal; balanced integer turns make the complete cycle repeat exactly.', inner, [0, .18, .14]);
  sphere(rotor, 'lens', [0, 0, 0], [.078, .078, .078]);
  for (let j = 0; j < 6; j++) { const a = j * TAU / 6; rod(rotor, 'copper', [0, 0, 0], [.13 * Math.cos(a), 0, .13 * Math.sin(a)], .018); sphere(rotor, 'brass', [.13 * Math.cos(a), 0, .13 * Math.sin(a)], [.025, .025, .025]); }
  const pumps = [0, 1, 2, 3].map(i => {
    const s = i % 2 ? 1 : -1, z = -.38 + Math.floor(i / 2) * .31;
    const sleeve = part(`pump.${i + 1}`, `Reciprocating pump cylinder ${i + 1}`, 'Pump bank', 'Show one pressure sleeve alongside the exposed timing shaft.', 'The dark sleeve stays attached to the chassis while its separate polished plunger reciprocates with a quarter-cycle crank offset.', body, [s * .16, .12, 0]);
    sleeve.position.set(s * .28, -.02, z);
    add(sleeve, 'cylinder', 'dark', [0, 0, 0], [.065, .20, .065]);
    for (const y of [-.09, .09]) add(sleeve, 'cylinder', 'copper', [0, y, 0], [.075, .024, .075]);
    const rodNode = part(`pump.${i + 1}.plunger`, `Pump ${i + 1} · sliding plunger`, 'Pump bank', 'Demonstrate phased reciprocation independently of the moving chassis.', 'A polished plunger travels inside its pressure sleeve and carries a bronze crosshead above the gland.', sleeve, [0, .19, 0]);
    add(rodNode, 'cylinder', 'titanium', [0, .105, 0], [.024, .23, .024]);
    box(rodNode, 'brass', [0, .23, 0], [.105, .045, .07]);
    return rodNode;
  });
  const gills = [-1, 1].flatMap(s => [0, 1, 2, 3, 4].map(i => {
    const n = part(`gill.${sid(s)}${i + 1}`, `${label(s)} book-gill fan ${i + 1}`, 'Ventilation', 'Open layered heat-exchanger lamellae beneath the rear armour edge.', 'Ten independently phased hinges make a travelling ventilation wave; they illustrate a biomimetic cooling system, not biological respiration.', body, [s * .20, -.16, .08]);
    n.position.set(s * .59, -.18, -.28 + i * .18);
    for (let j = 0; j < 4; j++) box(n, j % 2 ? 'copper' : 'teal', [s * (.085 + j * .039), -.005 - j * .022, 0], [.14, .018, .145], [0, 0, -s * .20]);
    rod(n, 'brass', [0, 0, -.07], [0, 0, .07], .021);
    return { n, s };
  }));

  const legs = LEGS.map(l => {
    const name = `${label(l.side)} walking leg ${l.station + 1}`, id = `leg.${l.id}`;
    const coxa = part(`${id}.coxa`, `${name} · coxa bearing`, 'Six-legged gait', 'Turn a rigid 200 mm coxa toward the foot target.', 'The coxa endpoints keep their exact separation while the two longer members solve the knee above the ground.', undefined, [l.side * .16, .08, 0]);
    member(coxa, D.coxa, .105);
    const upper = part(`${id}.upper`, `${name} · 640 mm femur`, 'Six-legged gait', 'Carry the knee with a thick rigid upper member.', 'The knee lies on the intersection of two reach spheres; no length scaling is used to force the leg into position.', undefined, [l.side * .24, .07, 0]);
    member(upper, D.upper, .125); armour(`${id}.upper-cover`, `${name} · femur shield`, upper, D.upper, .125);
    const lower = part(`${id}.lower`, `${name} · 720 mm tibia`, 'Six-legged gait', 'Connect the solved knee to a grounded or lifted foot target.', 'The lower member remains exactly 720 mm long through stance and swing; its sole is independently held level in world space.', undefined, [l.side * .32, .025, 0]);
    member(lower, D.lower, .092); armour(`${id}.lower-cover`, `${name} · tibia shield`, lower, D.lower, .092);
    const pinion = part(`${id}.pinion`, `${name} · knee sector drive`, 'Joint transmission', 'Expose the relative angular motion at the knee.', 'A bronze sector is fixed to the lower-member frame at the knee instead of rotating as an unrelated decorative wheel.', lower, [.12, 0, 0]);
    pinion.rotation.z = Math.PI / 2; pinion.position.x = .137; gear(pinion, .076, 14, .035);
    const foot = part(`${id}.foot`, `${name} · split ground claw`, 'Ground contact', 'Stand directly on the floor without a display base.', 'A broad level sole with two tapered toe claws stays stationary during support, then follows a smooth lifted return to the next contact.', undefined, [l.side * .36, -.07, 0]);
    sphere(foot, 'rubber', [0, -.03, 0], [.115, .035, .15]);
    sphere(foot, 'shell', [0, .025, -.01], [.11, .065, .135]);
    rod(foot, 'teal', [0, .015, 0], [0, .095, 0], .057);
    for (const s of [-1, 1]) { rod(foot, 'teal', [s * .047, .02, -.01], [s * .080, -.015, -.17], .03); sphere(foot, 'titanium', [s * .08, -.015, -.17], [.028, .026, .065]); }
    return { coxa, upper, lower, foot, ram: ram(`${id}.ram`, `${name} knee actuator`, .22) };
  });
  const claws = [-1, 1].map(s => {
    const id = `claw.${sid(s)}`, name = `${label(s)} giant pedipalp`;
    const upper = part(`${id}.upper`, `${name} · shoulder arm`, 'Predatory claws', 'Project a massive pedipalp ahead of the prosomal shield.', 'A rigid 620 mm shoulder arm sweeps outward and rises during the display, then folds inward during the grasp sequence.', undefined, [s * .21, .08, -.12]);
    member(upper, D.arm, .19); armour(`${id}.upper-cover`, `${name} · shoulder armour`, upper, D.arm, .19);
    const fore = part(`${id}.fore`, `${name} · elbow forearm`, 'Predatory claws', 'Carry the wrist through a second independent rigid joint.', 'A second 620 mm member changes pitch and sweep while the shoulder ram stays connected to its computed forearm mount.', undefined, [s * .27, .07, -.18]);
    member(fore, D.forearm, .155); armour(`${id}.fore-cover`, `${name} · forearm armour`, fore, D.forearm, .155);
    const palm = part(`${id}.palm`, `${name} · broad geared palm`, 'Predatory claws', 'Support two opposing toothed fingers around a visible open grip.', 'The broad 340 mm palm rolls into its own wrist frame and carries both jaw pivots, keeping the grasp space open rather than a solid block.', undefined, [s * .34, .06, -.22]);
    sphere(palm, 'teal', [0, .17, 0], [.28, .28, .15]);
    sphere(palm, 'shell', [0, .13, .07], [.27, .23, .13]);
    box(palm, 'dark', [0, .26, -.07], [.35, .18, .13]);
    fasteners(palm, [[-.13, .15, .18], [.13, .15, .18]], .014);
    const jaws = [-1, 1].map(j => {
      const n = part(`${id}.jaw${j < 0 ? 'A' : 'B'}`, `${name} · ${j < 0 ? 'outer' : 'inner'} toothed jaw`, 'Opposed jaw drive', 'Open and close one side of a large two-fingered claw.', 'The two fingers pivot equally in opposite directions around the palm. Their inward teeth surround negative space; no grip force is implied.', palm, [j * .17, .18, .035]);
      n.position.set(j * .13, .29, 0);
      const pts = [[0, 0, 0], [j * .10, .22, 0], [j * .09, .46, 0], [-j * .065, D.jaw, 0]];
      for (let k = 0; k < 3; k++) {
        rod(n, 'teal', pts[k], pts[k + 1], .068 - k * .011);
        sphere(n, 'shell', [j * (k === 0 ? .055 : .095), .14 + k * .18, .024], [.077 - k * .012, .145, .071 - k * .014]);
      }
      for (let k = 0; k < 5; k++) add(n, 'cone', 'titanium', [-j * .023, .11 + k * .097, 0], [.027, .092, .027], [0, 0, j * Math.PI / 2]);
      add(n, 'cylinder', 'dark', [0, 0, 0], [.125, .12, .125], [Math.PI / 2, 0, 0]);
      const g = part(`${id}.jaw${j < 0 ? 'A' : 'B'}.gear`, `${name} · jaw ${j < 0 ? 'A' : 'B'} gear sector`, 'Opposed jaw drive', 'Show the angular drive of the jaw on its hinge pin.', 'A bronze gear sector is rigidly attached to its finger. Opposite finger angles demonstrate counter-rotation without a separate free-spinning animation.', n, [0, 0, .12]);
      g.position.z = .085; g.rotation.x = Math.PI / 2; gear(g, .118, 18, .032);
      return { n, j };
    });
    return { upper, fore, palm, jaws, ram: ram(`${id}.ram`, `${name} shoulder actuator`, .35) };
  });

  const paddles = [-1, 1].map(s => {
    const id = `paddle.${sid(s)}`, name = `${label(s)} swimming oar`;
    const upper = part(`${id}.upper`, `${name} · sweep arm`, 'Feathering oars', 'Extend an independent swimming appendage behind the walking legs.', 'The rigid 600 mm proximal arm sweeps backward and recovers forward in four repeating strokes per choreography cycle.', undefined, [s * .22, .10, .09]);
    member(upper, .60, .115); armour(`${id}.upper-cover`, `${name} · root fairing`, upper, .60, .115);
    const lower = part(`${id}.lower`, `${name} · wrist member`, 'Feathering oars', 'Place the broad paddle beyond the walking legs.', 'A rigid 620 mm distal member changes elevation with the stroke; its terminal fan additionally feathers about the member axis.', undefined, [s * .30, .14, .14]);
    member(lower, .62, .085);
    const fan = part(`${id}.fan`, `${name} · broad feathering blade`, 'Feathering oars', 'Present a broad blade during the power stroke and turn it on recovery.', 'The blade rotates about its long axis while five outer lamellae spread with their own hinge angles. This is a rowing display, not water simulation.', lower, [0, .18, .18]);
    fan.position.y = .57;
    sphere(fan, 'teal', [0, .25, 0], [.33, .40, .065]);
    sphere(fan, 'shell', [0, .20, .025], [.29, .30, .045]);
    rod(fan, 'brass', [0, 0, .065], [0, .57, .065], .024);
    const leaves = [-2, -1, 0, 1, 2].map(j => {
      const n = part(`${id}.lamella${j + 3}`, `${name} · blade lamella ${j + 3}`, 'Feathering oars', 'Vary the distal paddle area through a visible fan of solid lamellae.', 'Each broad pale lamella pivots from the wrist blade with a different signed spread, preserving a filled fan at every phase.', fan, [j * .065, .13, .025]);
      n.position.set(j * .095, .24, 0);
      sphere(n, 'shell', [0, .22, 0], [.08, .30, .036]);
      rod(n, 'teal', [0, 0, .04], [0, .48, .04], .016);
      box(n, 'brass', [0, .34, .044], [.07, .024, .014], [0, 0, 0], true);
      return { n, j };
    });
    return { upper, lower, fan, leaves };
  });
  const tail = D.tail.map((length, i) => {
    const width = .54 - i * .038, depth = .19 - i * .009;
    const n = part(`tail.${i + 1}`, `Abdominal vertebra ${i + 1}`, 'Twelve-link abdomen', 'Continue the body into a wide tapering articulated tail.', 'Each serial joint applies yaw and pitch, then advances by its fixed link length. The growing phase lag sends a visible lateral wave toward the telson.', undefined, [0, .13 + i * .015, .09 + i * .025]);
    box(n, 'dark', [0, length * .5, 0], [width * 1.5, length * .96, depth]);
    add(n, 'cylinder', 'teal', [0, 0, 0], [depth * .70, width * 1.8, depth * .70], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) add(n, 'ring', 'brass', [s * width * .92, 0, 0], [depth * .67, depth * .67, depth * .67], [0, Math.PI / 2, 0]);
    const cover = part(`tail.${i + 1}.tergite`, `Abdominal tergite ${i + 1}`, 'Overlapping tail armour', 'Keep a thick, continuous plated abdomen around the segmented spine.', 'A broad domed tergite overlaps its neighbours while each underlying joint retains its own rigid transformation.', n, [0, 0, .17]);
    sphere(cover, 'shell', [0, length * .45, .025], [width, length * .67, depth]);
    box(cover, 'teal', [0, length * .33, depth], [width * .66, length * .85, .035], [-.10, 0, 0]);
    box(cover, 'brass', [0, length * .15, depth + .018], [width * .60, .018, .018]);
    for (const s of [-1, 1]) {
      box(cover, 'dark', [s * width * .59, length * .43, depth * .75], [width * .23, length * .62, .028], [0, s * .18, 0]);
      fasteners(cover, [[s * width * .55, length * .4, depth * .83]], .009);
    }
    const fins = [-1, 1].map(s => {
      const fin = part(`tail.${i + 1}.flange${sid(s)}`, `Tail link ${i + 1} · ${label(s).toLowerCase()} articulated flange`, 'Lateral tail fins', 'Widen the abdominal outline with a solid lateral flange.', 'The flange gently hinges relative to its vertebra as the tail wave passes, creating secondary motion independent of the main serial chain.', n, [s * .16, .04, 0]);
      fin.position.set(s * width * .77, length * .44, -.005);
      sphere(fin, 'teal', [s * width * .20, .01, -.025], [width * .38, length * .68, .042]);
      rod(fin, 'brass', [0, -.035, .005], [s * width * .46, length * .22, .005], .012);
      return { fin, s };
    });
    const tendons = [-1, 1].map(s => {
      const t = part(`tail.${i + 1}.tendon${sid(s)}`, `Tail joint ${i + 1} · ${label(s).toLowerCase()} tendon`, 'Tail tendons', 'Bridge consecutive joint frames with a visible flexible service tendon.', 'The endpoints attach to neighbouring rigid links. The displayed copper span changes length without detaching or stretching the vertebrae.', undefined, [s * .13, .08, .08]);
      add(t, 'cylinder', 'copper', [0, .5, 0], [.012, 1, .012]);
      return { t, s };
    });
    return { n, fins, tendons, width, depth };
  });
  const telson = part('telson', 'Broad diamond telson · terminal rudder', 'Tail rudder', 'Finish the sea-scorpion silhouette with a wide terminal steering blade rather than an upright terrestrial sting.', 'A solid diamond-shaped blade has its own yaw hinge at the final abdominal joint and follows the delayed tail sweep.', tail.at(-1).n, [0, .24, .06]);
  telson.position.y = D.tail.at(-1);
  sphere(telson, 'teal', [0, .27, 0], [.29, .44, .068]);
  box(telson, 'shell', [0, .25, .025], [.39, .39, .065], [0, 0, Math.PI / 4]);
  rod(telson, 'brass', [0, 0, .08], [0, .63, .08], .027);
  add(telson, 'cone', 'titanium', [0, .64, 0], [.07, .25, .065]);
  for (const s of [-1, 1]) rod(telson, 'titanium', [0, .03, .04], [s * .29, .27, .04], .025);

  const bind = [];
  kit.group.traverse(n => { if (n.userData.partId) bind.push({ n, p: n.position.clone(), q: n.quaternion.clone(), s: n.scale.clone() }); });
  function update(state = current, options = {}) {
    if (disposed) return;
    current = state;
    for (const b of bind) { b.n.position.copy(b.p); b.n.quaternion.copy(b.q); b.n.scale.copy(b.s); }
    place(body, state.origin, state.bodyFrame);
    panels.forEach((n, i) => { n.rotation.z = (i ? 1 : -1) * state.rates.panels; });
    eyes.forEach((e, i) => { e.turret.rotation.y = state.rates.eyes[i].yaw; e.pod.rotation.x = state.rates.eyes[i].pitch; });
    mouth.forEach(({ n, s }, i) => { n.rotation.y = -s * state.rates.mouth[i]; n.rotation.x = .08 * Math.sin(state.phase * TAU * 6 + i); });
    shaft.rotation.z = state.rates.shaft;
    gears.forEach((g, i) => { g.rotation.y = state.rates.gears[i] + (i % 2 ? Math.PI / 18 : 0); });
    cage.rotation.x = state.rates.gyro[0]; inner.rotation.y = state.rates.gyro[1]; rotor.rotation.z = state.rates.gyro[2];
    pumps.forEach((n, i) => { n.position.y = state.rates.pump[i]; });
    gills.forEach(({ n, s }, i) => { n.rotation.z = -s * state.rates.gills[i]; });
    legs.forEach((n, i) => {
      const l = state.legs[i];
      place(n.coxa, l.root, l.frames.coxa); place(n.upper, l.hip, l.frames.upper); place(n.lower, l.knee, l.frames.lower);
      n.foot.position.fromArray(l.foot); poseRam(n.ram, l.ram);
    });
    claws.forEach((n, i) => {
      const c = state.claws[i]; place(n.upper, c.root, c.frames.upper); place(n.fore, c.elbow, c.frames.lower); place(n.palm, c.wrist, c.frames.palm);
      n.jaws.forEach(({ n: jaw, j }) => { jaw.rotation.z = -j * c.aperture; }); poseRam(n.ram, c.ram);
    });
    paddles.forEach((n, i) => {
      const p = state.paddles[i]; place(n.upper, p.root, p.frames.upper); place(n.lower, p.elbow, p.frames.lower);
      n.fan.rotation.y = p.feather; n.leaves.forEach(({ n: leaf, j }) => { leaf.rotation.z = j * p.fan; });
    });
    state.tail.forEach((s, i) => {
      const n = tail[i]; place(n.n, s.start, s.frame);
      n.fins.forEach(({ fin, s: side }) => { fin.rotation.y = side * (.08 + .12 * Math.sin(state.phase * TAU * 4 - i * .4)); });
      n.tendons.forEach(({ t, s: side }) => {
        const a = i ? state.tail[i - 1] : s;
        const av = new THREE.Vector3(side * n.width * .70, i ? a.length * .55 : .025, -.07);
        const bv = new THREE.Vector3(side * n.width * .70, s.length * .65, -.07);
        const transform = (v, segment) => vadd(segment.start, [segment.frame[0] * v.x + segment.frame[1] * v.y + segment.frame[2] * v.z, segment.frame[3] * v.x + segment.frame[4] * v.y + segment.frame[5] * v.z, segment.frame[6] * v.x + segment.frame[7] * v.y + segment.frame[8] * v.z]);
        const start = transform(av, a), end = transform(bv, s);
        aim(t, start, end); t.scale.y = distance(start, end);
      });
    });
    telson.rotation.z = state.rates.telson;
    kit.sync(options);
  }
  const framePoints = [], seen = new Set(), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  // Retain actual geometry corners instead of empty corners of a whole-body bounding box.
  for (const input of [{ stride: 1, display: .7 }, { stride: .65, display: 0 }, { stride: 1.25, display: 1 }, { stride: .65, display: 1 }, { stride: 1.25, display: 0 }]) for (let j = 0; j < 24; j++) {
    update(poseAt(j / 24, input));
    for (const mesh of kit.pickables) {
      mesh.geometry.computeBoundingBox(); const g = mesh.geometry.boundingBox;
      for (let k = 0; k < mesh.count; k++) {
        mesh.getMatrixAt(k, matrix);
        for (const x of [g.min.x, g.max.x]) for (const y of [g.min.y, g.max.y]) for (const z of [g.min.z, g.max.z]) {
          point.set(x, y, z).applyMatrix4(matrix);
          const key = `${Math.round(point.x / .08)},${Math.round(point.y / .08)},${Math.round(point.z / .08)}`;
          if (!seen.has(key)) { seen.add(key); framePoints.push(point.clone()); }
        }
      }
    }
  }
  update(sample(0));
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update, framePoints, maxViewDistance: 24,
    views: { home: [1.3, 5.8, -7], front: [0, 2.5, -6.8], side: [6.8, 2.5, -.7], top: [.1, 7.4, -.2], detail: [-3.9, 3.5, -5.8], exploded: [4.2, 4.6, -6.3] },
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (!disposed) { disposed = true; kit.dispose(); kit.group.clear(); } } };
}
const TAU = Math.PI * 2;
