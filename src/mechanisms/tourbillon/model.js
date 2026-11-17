import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, SPRING_LENGTHS, sample, poseAt } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('CHRONOS T3 · open tourbillon movement');
  const nodes = [], train = [], springLinks = [];
  const add = kit.add, rod = kit.rod;
  let disposed = false, lastState = sample(0);
  function part(id, name, system, purpose, how, parent, explode = [0, .08, .08], material = 'Brass, titanium and jeweled bearing inserts') {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  }
  const axial = (n, mat, p, r, h, detail = false) => add(n, 'cylinder', mat, p, [r, h, r], [Math.PI / 2, 0, 0], detail);
  function jewel(n, p, r = .023) {
    add(n, 'ring', 'brass', p, [r, r, .021]);
    add(n, 'sphere', 'lens', [p[0], p[1], p[2] + .006], [r * .55, r * .55, .011]);
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3;
      add(n, 'bolt', 'titanium', [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a), p[2] + .009], [.0045, .009, .0045], [Math.PI / 2, 0, 0], true);
    }
  }
  function screw(n, p, r = .007) {
    axial(n, 'dark', p, r * 1.35, .005, true);
    add(n, 'bolt', 'titanium', [p[0], p[1], p[2] + .006], [r, .008, r], [Math.PI / 2, 0, 0], true);
    add(n, 'box', 'dark', [p[0], p[1], p[2] + .0105], [r * 1.2, .0018, .002], [0, 0, 0], true);
  }
  // Thin circular rails use fixed tube segments: scaling the kit torus would
  // also scale its radial tube to 13% of the radius, making a heavy clock rim.
  function hoop(n, material, center, radius, tube, segments = 24) {
    const p = k => [center[0] + radius * Math.cos(k * TAU / segments), center[1] + radius * Math.sin(k * TAU / segments), center[2]];
    for (let k = 0; k < segments; k++) rod(n, material, p(k), p(k + 1), tube);
  }
  // Z-normal, open-spoked gears: unlike kit.gear(), no solid web disk.
  // Tangent box teeth are deliberately conceptual rather than involute teeth.
  function openGear(n, radius, teeth, thickness = .027, material = 'brass') {
    for (const z of [-thickness * .30, thickness * .30]) hoop(n, material, [0, 0, z], radius * .95, Math.max(.0025, radius * .021));
    axial(n, 'dark', [0, 0, 0], radius * .14, thickness * 1.7);
    for (let k = 0; k < teeth; k++) {
      const a = k * TAU / teeth;
      add(n, 'box', material, [radius * Math.cos(a), radius * Math.sin(a), 0], [.019, radius * 2.50 / teeth, thickness], [0, 0, a]);
    }
  }
  const foot = part('stand.foot', 'Low oval exhibition foot', 'Service stand', 'Grounds the vertical clock without a large plinth.', 'A thin oval metal foot and four isolation pads support the rear cradle.', undefined, [0, 0, 0]);
  add(foot, 'cylinder', 'dark', [0, .047, -.12], [.49, .060, .32]);
  add(foot, 'cylinder', 'titanium', [0, .081, -.12], [.43, .011, .28]);
  for (const side of [-1, 1]) for (const back of [-1, 1]) {
    const pad = part(`stand.pad.${side}.${back}`, `${side < 0 ? 'Left' : 'Right'} ${back < 0 ? 'rear' : 'front'} isolation foot`, 'Service stand', 'Transfers the clock weight onto the datum floor.', 'A small rubber puck has a metal compression cap under the low oval foot.', undefined, [0, 0, 0], 'Rubber pad and titanium cap');
    add(pad, 'cylinder', 'rubber', [side * .28, .012, -.12 + back * .13], [.045, .024, .045]);
    add(pad, 'cylinder', 'titanium', [side * .28, .029, -.12 + back * .13], [.037, .012, .037]);
  }
  for (const side of [-1, 1]) {
    const post = part(`stand.arm.${side}`, `${side < 0 ? 'Left' : 'Right'} swept cradle arm`, 'Service stand', 'Supports the rear movement ring above the stand.', 'A tapered pair of diagonal rails terminates at a bolted ring clamp rather than a tall pedestal.', undefined, [0, 0, 0]);
    rod(post, 'dark', [side * .22, .09, -.20], [side * .46, .41, -.24], .029);
    rod(post, 'titanium', [side * .11, .09, -.10], [side * .42, .44, -.24], .014);
    add(post, 'box', 'dark', [side * .44, .43, -.24], [.14, .09, .10], [0, 0, -side * .5]);
    screw(post, [side * .44, .43, -.18], .015);
  }
  const backRing = part('frame.backring', 'Open rear movement annulus', 'Movement frame', 'Provides a stiff outer support without an opaque backing disk.', 'Two thin concentric rings leave almost the entire face open.', undefined, [0, .02, -.12]);
  for (const r of [.89, .94]) hoop(backRing, 'dark', [0, D.center[1], -.25], r, .010, 48);
  for (let sector = 0; sector < 12; sector++) {
    const a = sector * TAU / 12;
    const bay = part(`frame.bay.${sector}`, `Outer skeleton frame bay ${sector + 1}`, 'Movement frame', 'Connects the front index ring to the rear movement annulus.', 'A radial fork and two axial tie columns create a narrow open peripheral box section.', undefined, [.05 * Math.cos(a), .05 * Math.sin(a), -.04]);
    const p = (r, z, da = 0) => [r * Math.cos(a + da), D.center[1] + r * Math.sin(a + da), z];
    for (const da of [-.10, .10]) {
      rod(bay, 'titanium', p(.89, -.25, da), p(.89, .355, da), .009);
      rod(bay, 'dark', p(.83, -.25), p(.94, -.25, da), .013);
      screw(bay, p(.89, .365, da), .007);
    }
    const dial = part(`dial.sector.${sector}`, `Skeleton dial index ${sector === 0 ? 3 : ((15 - sector) % 12 || 12)}`, 'Index ring', 'Marks one five-minute interval on the open clock face.', 'One long baton and four minor ticks sit on a delicate outer rim; no face plate hides the train.', undefined, [.035 * Math.cos(a), .035 * Math.sin(a), .14]);
    for (let k = 0; k < 5; k++) {
      const b = a + k * TAU / 60, r = k === 0 ? .837 : .862;
      add(dial, 'box', k === 0 ? 'brass' : 'titanium', [r * Math.cos(b), D.center[1] + r * Math.sin(b), .377], [k === 0 ? .095 : .032, k === 0 ? .022 : .008, .012], [0, 0, b]);
      if (k === 0) add(dial, 'box', 'teal', [.823 * Math.cos(b), D.center[1] + .823 * Math.sin(b), .386], [.045, .006, .004]);
    }
    const stud = part(`dial.stud.${sector}`, `Dial jewel standoff ${sector + 1}`, 'Index ring', 'Fastens the open dial to the outer peripheral columns.', 'A small jewel cabochon and concentric brass seat mark the principal index attachment.', undefined, [0, .03, .12]);
    jewel(stud, p(.904, .38), .018);
    axial(stud, 'titanium', p(.904, .31), .012, .13);
  }
  const dialRim = part('dial.rim', 'Fine double skeleton index rim', 'Index ring', 'Joins the sixty open-face minute marks.', 'Thin annular edges outline the movement while keeping the central gears dominant.', undefined, [0, .04, .12]);
  for (const r of [.89, .925]) hoop(dialRim, 'titanium', [0, D.center[1], .365], r, .0065, 48);

  D.gearCenters.forEach((center, i) => {
    const name = ['Barrel', 'Intermediate', 'Third'][i], radius = D.radii[i];
    const wheel = part(`train.gear.${i}`, `${name} ${D.teeth[i]}-tooth open wheel`, 'Exact gear train', 'Transmits rotation with the exact integer tooth ratio.', 'Two slender rim rings carry conceptual rectangular teeth; every spoke is a separate open lattice bay.', undefined, [0, .10 + i * .04, .06]);
    wheel.position.fromArray(center); openGear(wheel, radius, D.teeth[i]); train.push(wheel);
    for (let bay = 0; bay < 8; bay++) {
      const a = bay * TAU / 8;
      const spoke = part(`train.spoke.${i}.${bay}`, `${name} wheel lattice spoke ${bay + 1}`, 'Gear spokes', 'Connects the open gear rim to the central hub with low visual mass.', 'Two diverging rails, a cross-web and a small root stiffener leave the wheel center transparent.', wheel, [.02 * Math.cos(a), .02 * Math.sin(a), .035]);
      const p = (r, da = 0, z = 0) => [r * Math.cos(a + da), r * Math.sin(a + da), z];
      for (const da of [-.055, .055]) rod(spoke, 'brass', p(radius * .15, da * 2), p(radius * .95, da), radius * .020);
      for (const f of [.32, .53, .73]) {
        rod(spoke, 'titanium', p(radius * f, -.055), p(radius * f, .055), radius * .013);
        rod(spoke, 'dark', p(radius * f, -.055, -.008), p(radius * Math.min(f + .18, .84), .055, -.008), radius * .010, true);
      }
      add(spoke, 'box', 'brass', p(radius * .23), [radius * .17, radius * .08, .022], [0, 0, a]);
      screw(spoke, p(radius * .72, 0, .002), .006);
      screw(spoke, p(radius * .27, 0, .002), .005);
    }
    const arbor = part(`train.arbor.${i}`, `${name} extended steel arbor`, 'Train bearings', 'Keeps the gear and any compound pinion on a common rotation axis.', 'A through shaft and two narrow collars reach from the rear jewel bridge to the gear front.', wheel, [0, 0, .09]);
    axial(arbor, 'titanium', [0, 0, -.09], .018, .32);
    for (const z of [-.15, .025]) add(arbor, 'ring', 'dark', [0, 0, z], [.033, .033, .027]);
    const bridge = part(`train.bridge.${i}`, `${name} open rear bearing bridge`, 'Movement bridges', 'Locates the gear arbor relative to the fixed rear annulus.', 'Two thin diagonal arms meet a jeweled seat behind the moving gear plane.', undefined, [0, .06, -.14]);
    const anchorAngle = Math.atan2(center[1] - D.center[1], center[0]);
    for (const da of [-.19, .19]) {
      const p = [.86 * Math.cos(anchorAngle + da), D.center[1] + .86 * Math.sin(anchorAngle + da), -.29];
      rod(bridge, 'titanium', [center[0], center[1], -.29], p, .015);
      screw(bridge, [p[0], p[1], -.275], .011);
    }
    jewel(bridge, [center[0], center[1], -.283], .036);
    const cover = part(`train.cover.${i}`, `${name} bridge service cap`, 'Bridge armor', 'Protects the rear jewel mount while remaining removable for inspection.', 'A narrow pale cap covers only the root of the bridge and ghosts in x-ray.', undefined, [0, .12, -.22], 'Pale alloy bridge cap');
    add(cover, 'box', 'shell', [center[0], center[1] + .063, -.31], [.16, .038, .027], [0, 0, i * .31]);
    for (const dx of [-.055, .055]) screw(cover, [center[0] + dx, center[1] + .063, -.288], .008);
  });
  const pinion = part('train.compound', 'Third-arbor fifteen-tooth cage pinion', 'Exact gear train', 'Reduces the third wheel rotation by four to one at the cage ring.', 'A separate rear axial lane aligns this pinion with the sixty-tooth cage wheel, not with the front train rims.', train[2], [0, 0, -.10]);
  pinion.position.z = -.085; openGear(pinion, D.pinionRadius, D.pinionTeeth, .025, 'titanium');
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6;
    rod(pinion, 'titanium', [0, 0, 0], [.071 * Math.cos(a), .071 * Math.sin(a), 0], .005);
  }
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const coil = part(`barrel.coil.${quadrant}`, `Exposed barrel spring quadrant ${quadrant + 1}`, 'Power barrel', 'Shows a copper-colored wound spring behind the barrel wheel spokes.', 'A fixed spiral of short segments turns with the barrel; stored energy and spring torque are not computed.', train[0], [0, 0, -.06], 'Copper-colored spring ribbon');
    const point = k => {
      const u = k / 96, a = u * TAU * 3.5, r = .052 + .174 * u;
      return [r * Math.cos(a), r * Math.sin(a), -.054];
    };
    for (let k = quadrant * 24; k < (quadrant + 1) * 24; k++) rod(coil, 'copper', point(k), point(k + 1), .0035);
  }
  const winding = part('barrel.winding', 'Barrel winding ratchet and key socket', 'Power barrel', 'Exposes the manual winding interface on the back of the barrel arbor.', 'An open ratchet ring, six spokes and a square key socket rotate with the barrel display.', train[0], [0, 0, -.16]);
  winding.position.z = -.14; openGear(winding, .070, 18, .018, 'dark');
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6;
    rod(winding, 'titanium', [0, 0, 0], [.067 * Math.cos(a), .067 * Math.sin(a), 0], .006);
  }
  add(winding, 'box', 'brass', [0, 0, -.025], [.027, .027, .035]);

  const cage = part('cage', 'Central rotating tourbillon carrier', 'Tourbillon cage', 'Carries the balance and escapement in a rotating local reference frame.', 'A long central arbor and annular front and rear rails keep the cage skeletal instead of using an opaque disk.', undefined, [0, .05, .13]);
  cage.position.fromArray(D.center);
  axial(cage, 'titanium', [0, 0, -.15], .015, .31);
  for (const z of [-.19, .21]) hoop(cage, 'titanium', [0, 0, z], .294, .006);
  const cageGear = part('cage.gear', 'Sixty-tooth rear cage wheel', 'Exact gear train', 'Receives the exact four-to-one reduction from the compound pinion.', 'The open ring meshes conceptually with the rear fifteen-tooth pinion at the sum of their pitch radii.', cage, [0, 0, -.13]);
  cageGear.position.z = -.305; openGear(cageGear, D.cageRadius, 60, .025);
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6;
    const post = part(`cage.column.${k}`, `Tourbillon cage column ${k + 1}`, 'Cage structure', 'Keeps both annular cage rails at a fixed axial spacing.', 'A thin column and its collars sit entirely outside the oscillating balance and articulated spring envelope.', cage, [.07 * Math.cos(a), .07 * Math.sin(a), .035]);
    const x = .294 * Math.cos(a), y = .294 * Math.sin(a);
    rod(post, 'titanium', [x, y, -.19], [x, y, .21], .009);
    for (const z of [-.19, .21]) {
      axial(post, 'brass', [x, y, z], .016, .021);
      screw(post, [x, y, z + .017], .007);
    }
    const bridge = part(`cage.bridge.${k}`, `Cage rear radial bridge ${k + 1}`, 'Cage structure', 'Ties the rotating arbor to the cage ring and rear drive wheel.', 'Paired radial rails and a diagonal axial web carry the open cage with no front plate over the balance.', cage, [0, 0, -.08]);
    for (const da of [-.045, .045]) rod(bridge, 'dark', [.024 * Math.cos(a + da), .024 * Math.sin(a + da), -.19], [.294 * Math.cos(a + da), .294 * Math.sin(a + da), -.19], .008);
    rod(bridge, 'titanium', [.04 * Math.cos(a), .04 * Math.sin(a), -.305], [.285 * Math.cos(a), .285 * Math.sin(a), -.305], .007);
    rod(bridge, 'dark', [.25 * Math.cos(a), .25 * Math.sin(a), -.305], [.294 * Math.cos(a), .294 * Math.sin(a), -.19], .008);
    const cap = part(`cage.cap.${k}`, `Cage peripheral bridge cap ${k + 1}`, 'Bridge armor', 'Protects an outer cage tie without hiding the oscillator.', 'A small removable pale plate stays at the rim, outside the balance sweep.', cage, [0, 0, .10], 'Pale alloy service cap');
    add(cap, 'box', 'shell', [x, y, .23], [.053, .031, .012], [0, 0, a]);
    screw(cap, [x, y, .241], .006);
  }
  const balance = part('balance', 'Oscillating balance wheel and staff', 'Balance oscillator', 'Oscillates relative to the revolving cage with the selected safe amplitude.', 'Paired fine rims and an extended staff leave the hairspring and escapement visible; the motion is prescribed, not torque-integrated.', cage, [0, 0, .12]);
  balance.position.z = .066;
  for (const z of [-.012, .012]) add(balance, 'ring', 'brass', [0, 0, z], [D.balanceRadius, D.balanceRadius, .035]);
  axial(balance, 'titanium', [0, 0, -.061], .012, .35);
  for (let k = 0; k < 6; k++) {
    const a = k * TAU / 6;
    const sector = part(`balance.spoke.${k}`, `Balance wheel split spoke ${k + 1}`, 'Balance oscillator', 'Connects the light balance rim to the staff with a fine forked spoke.', 'Two tangential arms and a slender root web rotate rigidly with the balance.', balance, [.02 * Math.cos(a), .02 * Math.sin(a), .025]);
    for (const da of [-.045, .045]) rod(sector, 'titanium', [.023 * Math.cos(a), .023 * Math.sin(a), 0], [.184 * Math.cos(a + da), .184 * Math.sin(a + da), 0], .0045);
    for (const r of [.075, .12, .16]) rod(sector, 'brass', [r * Math.cos(a - .045), r * Math.sin(a - .045), 0], [r * Math.cos(a + .045), r * Math.sin(a + .045), 0], .003);
    const weight = part(`balance.weight.${k}`, `Balance rim regulating weight ${k + 1}`, 'Balance adjustment', 'Marks the peripheral inertia adjustment positions on the balance.', 'A small paired brass block and fine screw sit on the rim; their effect on inertia is not simulated.', balance, [.035 * Math.cos(a), .035 * Math.sin(a), .025]);
    for (const da of [-.035, .035]) add(weight, 'box', 'brass', [.192 * Math.cos(a + da), .192 * Math.sin(a + da), .004], [.018, .011, .032], [0, 0, a + da]);
    screw(weight, [.196 * Math.cos(a), .196 * Math.sin(a), .024], .006);
  }
  for (let sector = 0; sector < 8; sector++) {
    const spring = part(`hairspring.${sector}`, `Articulated hairspring arc ${sector + 1}`, 'Hairspring illustration', 'Shows qualitative winding through exact-length copper segments.', 'Twelve short rigid segments follow a prescribed tangent-angle field; the outer inspection tail is free, not an elastic boundary condition.', cage, [0, 0, .09], 'Copper hairspring representation');
    for (let j = 0; j < 12; j++) {
      const index = sector * 12 + j, segment = new THREE.Group();
      segment.name = `hairspring.segment.${index}`; segment.userData.partId = spring.userData.partId; spring.add(segment); nodes.push(segment);
      rod(segment, 'copper', [0, 0, 0], [0, SPRING_LENGTHS[index], 0], .0020);
      // A small dark ridge on alternate segments reads as a fine ribbon edge.
      if (j % 2 === 0) rod(segment, 'dark', [0, 0, -.002], [0, SPRING_LENGTHS[index], -.002], .0009, true);
      springLinks.push(segment);
    }
  }
  const collet = part('balance.collet', 'Hairspring inner collet and attachment arm', 'Hairspring illustration', 'Joins the first spring segment to the oscillating balance staff.', 'A short rotating arm reaches the first copper endpoint at 32 mm radius; the free outer tail has no false fixed anchor.', balance, [0, 0, .065]);
  axial(collet, 'brass', [0, 0, D.springZ - .066], .023, .016);
  rod(collet, 'brass', [0, 0, D.springZ - .066], [.032, 0, D.springZ - .066], .0035);
  const regulator = part('balance.regulator', 'Open spring inspection regulator arc', 'Balance adjustment', 'Provides a fixed visual reference for the free outer spring tail.', 'A short peripheral arc and pointer do not constrain the demonstrator spring or claim to regulate a real oscillation.', cage, [0, 0, .08]);
  for (let k = 0; k < 12; k++) {
    const p = j => [.239 * Math.cos(.42 + j * .04), .239 * Math.sin(.42 + j * .04), .14];
    rod(regulator, 'titanium', p(k), p(k + 1), .004);
  }
  for (const z of [-.17, .18]) {
    const bearing = part(`balance.bearing.${z}`, `${z < 0 ? 'Rear' : 'Front'} balance staff jewel bridge`, 'Balance bearings', 'Supports the central balance staff within the rotating cage.', 'A very narrow split bridge carries a jeweled center without becoming an opaque cover over the oscillator.', cage, [0, 0, z < 0 ? -.05 : .06]);
    for (const side of [-1, 1]) rod(bearing, 'titanium', [side * .29, 0, z], [side * .018, 0, z], .005);
    jewel(bearing, [0, 0, z], .026);
  }
  const escape = part('escapement.wheel', 'Twelve-tooth illustrative escape wheel', 'Escapement', 'Advances intermittently during the scheduled release windows.', 'The wheel alternates dwells and smooth one-tooth steps; pallet contact and energy transfer are not dynamically solved.', cage, [0, -.06, .04]);
  escape.position.fromArray(D.escapeCenter); openGear(escape, .068, D.escapeTeeth, .013, 'titanium');
  for (let k = 0; k < 3; k++) {
    const spoke = part(`escapement.spoke.${k}`, `Escape wheel paired spoke ${k + 1}`, 'Escapement', 'Carries the small stepped escape rim on its central arbor.', 'Two fine radial spokes and an outer tooth-root rib keep the intermittent wheel visibly open.', escape, [0, 0, .035]);
    for (const offset of [0, Math.PI]) {
      const a = k * TAU / 6 + offset;
      rod(spoke, 'titanium', [.008 * Math.cos(a), .008 * Math.sin(a), 0], [.058 * Math.cos(a), .058 * Math.sin(a), 0], .0035);
      screw(spoke, [.049 * Math.cos(a), .049 * Math.sin(a), .012], .004);
    }
  }
  const escapeBridge = part('escapement.bridge', 'Escape arbor open bridge', 'Escapement bearings', 'Locates the escape wheel below the balance within the cage.', 'Two diagonal rear stays reach a small jewel seat behind the intermittent wheel.', cage, [0, -.04, -.06]);
  for (const side of [-1, 1]) rod(escapeBridge, 'dark', [side * .22, -.15, -.08], [0, -.175, -.08], .007);
  jewel(escapeBridge, [0, -.175, -.075], .019);
  axial(escapeBridge, 'brass', [0, -.175, -.033], .007, .084);
  // The escape bridge reaches the two lower cage columns instead of floating,
  // and its jewel seat also carries the fork pivot cock.
  for (const [side, a] of [[-1, -2 * Math.PI / 3], [1, -Math.PI / 3]]) {
    rod(escapeBridge, 'titanium', [side * .22, -.15, -.08], [.294 * Math.cos(a), .294 * Math.sin(a), -.08], .007);
    add(escapeBridge, 'ring', 'brass', [.294 * Math.cos(a), .294 * Math.sin(a), -.08], [.018, .018, .018], [Math.PI / 2, 0, 0]);
  }
  rod(escapeBridge, 'titanium', [0, -.175, -.075], [0, -.092, .009], .006);
  add(escapeBridge, 'ring', 'brass', [0, -.092, .009], [.014, .014, .014], [Math.PI / 2, 0, 0]);
  const fork = part('escapement.fork', 'Rocking pallet fork and roller slot', 'Escapement', 'Alternates between entry and exit pallet poses with the balance phase.', 'A narrow stem terminates in an open fork slot; its angle is a prescribed timing illustration rather than a contact solution.', cage, [0, -.045, .055]);
  fork.position.fromArray(D.forkCenter);
  rod(fork, 'dark', [0, 0, 0], [0, .069, 0], .005);
  for (const side of [-1, 1]) {
    rod(fork, 'titanium', [side * .020, .041, 0], [side * .020, .075, 0], .0035);
    rod(fork, 'dark', [0, 0, 0], [side * .043, -.037, 0], .0045);
    const pallet = part(`escapement.pallet.${side}`, `${side < 0 ? 'Entry' : 'Exit'} conceptual pallet stone`, 'Escapement', 'Makes alternating pallet positions visible alongside the escape rim.', 'A teal jewel on a short arm illustrates the lock/release role; rectangular tooth contact is not precision validated.', fork, [side * .018, -.02, .015]);
    add(pallet, 'box', 'teal', [side * .043, -.037, 0], [.014, .025, .015], [0, 0, side * .45]);
    screw(pallet, [side * .037, -.025, .01], .004);
  }
  jewel(fork, [0, 0, .014], .014);
  const roller = part('balance.roller', 'Balance impulse roller and eccentric jewel', 'Escapement', 'Shows the balance-side impulse feature above the rocking fork.', 'An open miniature roller and an offset jewel rotate with the balance; the illustrative fork is not claimed to be impulse-driven.', balance, [0, 0, -.055]);
  add(roller, 'ring', 'brass', [0, 0, -.038], [.029, .029, .021]);
  add(roller, 'sphere', 'lens', [0, -.029, -.042], [.006, .007, .007]);

  const handBridge = part('hands.bridge', 'Rear hand-ratio display bridge', 'Hand display', 'Carries the coaxial hour and minute indicator shafts.', 'A narrow rear vertical stay supports the front hand hub through the cage center; the unmodeled motion works are represented by an exact ratio schedule.', undefined, [0, .03, -.12]);
  rod(handBridge, 'dark', [0, .35, -.24], [0, 1.80, -.24], .017);
  for (const y of [.45, 1.80]) screw(handBridge, [0, y, -.22], .012);
  rod(handBridge, 'dark', [0, .09, -.13], [0, .35, -.24], .012);
  axial(handBridge, 'titanium', [0, D.center[1], .10], .007, .70);
  const hands = [];
  for (const [name, length, z, width] of [['hour', .49, .414, .025], ['minute', .765, .457, .015]]) {
    const hand = part(`hands.${name}`, `${name === 'hour' ? 'Hour' : 'Minute'} skeleton indicator hand`, 'Hand display', 'Indicates the exact twelve-to-one hand angle relationship over the full master cycle.', 'Two tapered fine rails, open crossbars and a short countertail keep the oscillator visible behind the pointer.', undefined, [0, .015, .12]);
    hand.position.set(0, D.center[1], z);
    for (const side of [-1, 1]) {
      rod(hand, 'titanium', [side * width, .06, 0], [0, length, 0], .0045);
      rod(hand, 'dark', [side * width * .7, -.115, 0], [side * width, .06, 0], .0045);
    }
    for (let k = 1; k < 6; k++) {
      const y = length * k / 7, w = width * (1 - y / length);
      rod(hand, 'brass', [-w, y, 0], [w, y, 0], .003);
    }
    add(hand, 'ring', 'brass', [0, 0, 0], [.041, .041, .035]);
    add(hand, 'box', 'teal', [0, length - .024, .003], [.009, .048, .007]);
    hands.push(hand);
  }
  const handCap = part('hands.cap', 'Coaxial hand bearing and domed cap', 'Hand display', 'Retains the separate front hand lanes on the central axis.', 'A small brass washer, polished center cap and three fine screws finish the open movement.', undefined, [0, .02, .15]);
  axial(handCap, 'brass', [0, D.center[1], .478], .026, .029);
  add(handCap, 'sphere', 'titanium', [0, D.center[1], .494], [.020, .020, .009]);
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3;
    screw(handCap, [.032 * Math.cos(a), D.center[1] + .032 * Math.sin(a), .48], .004);
  }
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.gearAngles && state?.springPoints) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, lastState.controls);
    for (const { node, p, q } of bind) { node.position.copy(p); node.quaternion.copy(q); }
    train.forEach((node, i) => { node.rotation.z = lastState.gearAngles[i]; });
    cage.rotation.z = lastState.cageAngle; balance.rotation.z = lastState.balanceAngle;
    escape.rotation.z = lastState.escapeAngle; fork.rotation.z = lastState.forkAngle;
    springLinks.forEach((node, i) => {
      const a = lastState.springPoints[i], b = lastState.springPoints[i + 1];
      kit.aim(node, a, b);
      // Quaternion.setFromUnitVectors deliberately snaps nearly antiparallel
      // vectors. A planar atan2 retains exact endpoints even beside -Y.
      node.rotation.set(0, 0, Math.atan2(a[0] - b[0], b[1] - a[1]));
    });
    hands[0].rotation.z = lastState.hourAngle; hands[1].rotation.z = lastState.minuteAngle;
    kit.sync(options);
  }
  update();
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
