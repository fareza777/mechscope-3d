import { createMechanicalKit } from '../mechanical-kit.js';
import { DIM, TAIL_LENGTHS, LEG_MOUNT, CLAW_MOUNT, sample, distance, add, sub, mul } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('SCORPIO S8 — geared scorpion');
  const { add: primitive, rod, gear, fasteners, aim } = kit;
  const make = (id, name, system, purpose, how, material = 'Titanium / bronze', parent, explode = [0, .12, 0]) => kit.part({ id: `scorpion.${id}`, name, system, function: purpose, how, material }, parent, explode);
  const box = (n, m, p, s, e = [0, 0, 0], detail = false) => primitive(n, 'box', m, p, s, e, detail);
  function bearing(n, y, r = .045) {
    primitive(n, 'cylinder', 'dark', [0, y, 0], [r, .072, r], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) {
      primitive(n, 'ring', 'brass', [0, y, s * .043], [r * .78, r * .78, r * .78]);
      primitive(n, 'bolt', 'titanium', [0, y, s * .056], [r * .35, .012, r * .35], [Math.PI / 2, 0, 0]);
    }
    rod(n, 'titanium', [0, y, -.056], [0, y, .056], r * .24);
    for (let j = 0; j < 6; j++) {
      const a = j * Math.PI / 3;
      box(n, 'titanium', [r * Math.cos(a), y + r * Math.sin(a), .024], [.012, .012, .04], [0, 0, a], true);
    }
  }
  function beam(n, length, width = .025) {
    for (const s of [-1, 1]) {
      rod(n, 'titanium', [s * width, .025, 0], [s * width, length - .025, 0], .012);
      box(n, 'shell', [s * (width + .008), length * .5, .014], [.018, length * .56, .023]);
    }
    for (let j = 1; j <= 3; j++) {
      const y = length * j / 4;
      box(n, j % 2 ? 'dark' : 'brass', [0, y, 0], [width * 2.1, .013, .024]);
      box(n, 'teal', [0, y, -.019], [width * .8, .009, .008], [0, 0, 0], true);
    }
    rod(n, 'rubber', [-width - .019, .025, -.023], [-width - .019, length - .025, -.023], .006, true);
    fasteners(n, [[-width, length * .2, .025], [width, length * .8, .025]], .006);
  }
  function mountBracket(n, pin, width) {
    // Permanent rail-to-pin stays remain structural geometry even at low quality.
    for (const side of [-1, 1]) rod(n, 'titanium', [side * width, pin[1], 0], pin, .014);
  }
  function actuator(id, name, parent, barrelLength = .14) {
    const barrel = make(`${id}.barrel`, `${name} · cylinder barrel`, 'Linear actuation', 'Guide the extension rod between offset clevis pins.', 'A rigid cylinder aims at the moving pin; it never scales with stroke.', 'Dark anodized body / copper glands', parent);
    primitive(barrel, 'cylinder', 'dark', [0, barrelLength / 2, 0], [.023, barrelLength, .023]);
    for (const y of [.012, barrelLength - .012]) {
      primitive(barrel, 'cylinder', 'copper', [0, y, 0], [.028, .018, .028]);
      box(barrel, 'titanium', [.028, y, 0], [.015, .027, .04]);
    }
    rod(barrel, 'rubber', [-.032, .015, 0], [-.032, barrelLength - .015, 0], .007, true);
    fasteners(barrel, [[.028, .025, .019], [.028, barrelLength - .025, .019]], .005);
    const piston = make(`${id}.rod`, `${name} · polished piston rod`, 'Linear actuation', 'Follow the exact separation of the two actuator pins.', 'Only exposed rod length changes; the sleeve encloses the first 18 mm.', 'Polished titanium', parent, [0, .06, .045]);
    primitive(piston, 'cylinder', 'titanium', [0, .5, 0], [.009, 1, .009]);
    const clevis = make(`${id}.clevis`, `${name} · moving clevis`, 'Linear actuation', 'Transfer actuator stroke to the linkage.', 'A transverse bushed pin keeps the rod end distinct from the load-bearing rails.', 'Titanium / bronze', parent);
    bearing(clevis, 0, .022);
    return { barrel, piston, clevis, barrelLength };
  }
  function poseActuator(a, start, end, member) {
    const length = distance(start, end), stem = a.barrelLength - .018;
    aim(a.barrel, start, end);
    aim(a.piston, add(start, mul(sub(end, start), stem / length)), end);
    a.piston.scale.set(1, length - stem, 1);
    a.clevis.position.fromArray(end); a.clevis.quaternion.copy(member.quaternion);
  }

  const chassis = make('chassis', 'Central ladder chassis', 'Load-bearing frame', 'Tie all eight hip stations to the claw and tail supports.', 'Twin rails surround an open central transmission tunnel.', 'Titanium rails / bronze spacers', undefined, [0, .03, 0]);
  for (const x of [-.21, .21]) rod(chassis, 'titanium', [x, .565, -.52], [x, .565, .55], .027);
  for (let i = 0; i < 7; i++) {
    const z = -.47 + i * .16;
    box(chassis, 'dark', [0, .57, z], [.46, .035, .055]);
    fasteners(chassis, [[-.21, .595, z], [.21, .595, z]], .009);
  }
  const spine = make('spine.shaft', 'Exposed longitudinal torque shaft', 'Transmission spine', 'Distribute the illustrative rotary command along the body.', 'A polished shaft runs between seven spaced bearing bulkheads.', 'Titanium shaft / copper bushings', chassis, [0, .12, 0]);
  rod(spine, 'titanium', [0, .65, -.49], [0, .65, .53], .022);
  const bodyGears = [];
  for (let i = 0; i < 6; i++) {
    const station = make(`spine.station-${i + 1}`, `Spine station ${i + 1} · bevel cartridge`, 'Transmission spine', 'Expose the indexed drive takeoff beneath each armor rib.', 'A toothed wheel and transverse shaft occupy an open bulkhead bay.', 'Bronze gear / titanium shaft', chassis, [0, .10 + i * .01, 0]);
    station.position.set(0, .65, -.4 + i * .17);
    rod(station, 'titanium', [-.19, 0, 0], [.19, 0, 0], .012);
    primitive(station, 'ring', 'dark', [0, 0, 0], [.047, .047, .047]);
    const wheel = make(`spine.wheel-${i + 1}`, `Spine station ${i + 1} · timing wheel`, 'Transmission spine', 'Show rotational phase along the central shaft.', 'The wheel rotates on the longitudinal bearing axis.', 'Machined bronze', station);
    wheel.rotation.x = Math.PI / 2; gear(wheel, .058, 12, .018); bodyGears.push(wheel);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const armor = make(`armor.${side < 0 ? 'L' : 'R'}-${i + 1}`, `${side < 0 ? 'Left' : 'Right'} dorsal rib ${i + 1}`, 'Split exoskeleton', 'Protect one transmission bay while leaving a central inspection slot.', 'A raised shell cassette separates from the ladder frame in teardown.', 'Cast shell / dark gasket', chassis, [side * .14, .18, 0]);
    const x = side * .17, z = -.39 + i * .20;
    // Edge gaskets, not an opaque backing slab: x-ray must reveal the drive bay.
    for (const edge of [-1, 1]) box(armor, 'dark', [x + edge * .108, .691 - side * edge * .014, z], [.018, .017, .167], [0, 0, -side * .13]);
    box(armor, 'shell', [x, .72, z], [.25, .042, .165], [0, 0, -side * .13]);
    for (let j = 0; j < 4; j++) box(armor, 'titanium', [x, .75, z - .057 + j * .038], [.205, .009, .009], [0, 0, -side * .13], true);
    fasteners(armor, [[x - .076, .754, z], [x + .076, .754, z]], .007);
  }
  const motor = make('drive.motor', 'Thoracic servo and cooling cage', 'Power distribution', 'Illustrate a compact electric prime mover feeding the timing spine.', 'Copper winding blocks surround a dark stator beneath a slotted service lid.', 'Copper / dark anodized alloy', chassis, [0, -.07, -.16]);
  box(motor, 'dark', [0, .485, -.13], [.23, .09, .27]);
  for (let i = 0; i < 10; i++) box(motor, 'copper', [(i % 2 ? -1 : 1) * .123, .487, -.24 + Math.floor(i / 2) * .053], [.025, .065, .023], [0, 0, 0], true);
  const sensor = make('sensors.front', 'Forward binocular ranging bridge', 'Forward sensing', 'Mark the head end between the two pedipalps.', 'Two recessed lenses sit above the forward bumper; readings are not simulated.', 'Titanium / optical teal glass', chassis, [0, .08, -.15]);
  box(sensor, 'teal', [0, .71, -.548], [.29, .08, .055]);
  for (const x of [-.095, .095]) {
    primitive(sensor, 'cylinder', 'dark', [x, .725, -.581], [.035, .022, .035], [Math.PI / 2, 0, 0]);
    primitive(sensor, 'sphere', 'lens', [x, .725, -.6], [.026, .026, .012]);
  }

  const legs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const id = `leg.${side < 0 ? 'L' : 'R'}${i + 1}`, name = `${side < 0 ? 'Left' : 'Right'} walking leg ${i + 1}`;
    const hip = make(`${id}.hip`, `${name} · yaw housing`, 'Eight-leg gait', 'Locate the first of three revolute leg joints.', 'The hip cartridge stays at its chassis datum while the coxa sweeps toward the pad.', 'Titanium clevis / bronze bearing', chassis, [side * .10, .03, 0]);
    bearing(hip, 0, .049);
    const coxa = make(`${id}.coxa`, `${name} · 140 mm coxa`, 'Eight-leg gait', 'Provide lateral clearance between body and knee linkage.', 'A rigid fork turns horizontally toward the foot target.', 'Titanium / shell', chassis, [side * .13, .04, 0]); beam(coxa, DIM.coxa, .022);
    const femur = make(`${id}.femur`, `${name} · 390 mm femur`, 'Eight-leg gait', 'Connect the coxa pin to the solved knee without changing length.', 'Two spaced rails carry compression around an open cable channel.', 'Titanium / shell', chassis, [side * .18, .04, 0]); beam(femur, DIM.femur); bearing(femur, 0); mountBracket(femur, LEG_MOUNT, .025);
    const tibia = make(`${id}.tibia`, `${name} · 490 mm tibia`, 'Eight-leg gait', 'Connect the solved knee to the level foot pad.', 'A second rigid rail pair shares the knee pin and aims at the foot.', 'Titanium / shell', chassis, [side * .21, .03, 0]); beam(tibia, DIM.tibia, .021); bearing(tibia, 0, .04);
    const kneeGear = make(`${id}.knee-wheel`, `${name} · knee reduction wheel`, 'Joint gearing', 'Expose the angular motion at the tibial joint.', 'The gear follows the signed included angle between the femur and tibia.', 'Bronze / titanium', tibia, [0, 0, .06]); kneeGear.position.z = .064; kneeGear.rotation.x = Math.PI / 2; gear(kneeGear, .043, 10, .018);
    const pad = make(`${id}.pad`, `${name} · level traction shoe`, 'Ground interface', 'Show a geometric support contact without penetrating the datum.', 'A level 64 mm thick elastomer shoe follows the analytic ankle point.', 'Rubber / titanium tread', chassis, [side * .24, 0, 0]);
    box(pad, 'rubber', [0, 0, 0], [.115, DIM.sole * 2, .13]);
    box(pad, 'titanium', [0, .035, 0], [.065, .01, .076]);
    for (let j = 0; j < 4; j++) box(pad, 'dark', [0, -.022, -.045 + j * .03], [.119, .011, .008], [0, 0, 0], true);
    const act = actuator(`${id}.lift`, name, chassis);
    legs.push({ hip, coxa, femur, tibia, kneeGear, pad, act });
  }

  const tailRoot = make('tail.gimbal', 'Tail root · dual-axis saddle', 'Articulated tail', 'Carry the arched serial spine behind the abdomen.', 'A transverse trunnion sits above a vertical yaw bearing.', 'Titanium / bronze', chassis, [0, .12, .12]);
  tailRoot.position.set(0, .68, .55); bearing(tailRoot, 0, .083);
  primitive(tailRoot, 'cylinder', 'teal', [0, -.04, 0], [.095, .045, .095]);
  const tail = TAIL_LENGTHS.map((length, i) => {
    const id = `tail.link-${i + 1}`;
    const link = make(`${id}.spine`, `Tail vertebra ${i + 1} · open spine`, 'Articulated tail', `Preserve the ${Math.round(length * 1000)} mm distance between consecutive tail pins.`, 'Yaw and elevation aim the rigid spine; axial roll turns its bearing stack without moving either endpoint.', 'Titanium / bronze', chassis, [0, .08 + i * .025, .08]);
    beam(link, length, .035 - i * .003); bearing(link, 0, .061 - i * .004);
    const armor = make(`${id}.armor`, `Tail vertebra ${i + 1} · split shell`, 'Tail armor', 'Shield the vertebra while exposing the paired tendon guides.', 'Two separated ribbed plates leave a central gap over the longitudinal rails.', 'Cast shell / dark seals', link, [.065, 0, .07]);
    for (const s of [-1, 1]) {
      box(armor, 'shell', [s * (.057 - i * .004), length * .52, .018], [.032, length * .58, .073 - i * .006]);
      for (let j = 0; j < 3; j++) box(armor, 'dark', [s * (.057 - i * .004), length * (.30 + j * .2), .06 - i * .003], [.036, .013, .009], [0, 0, 0], true);
      rod(link, 'rubber', [s * (.07 - i * .004), .035, -.025], [s * (.07 - i * .004), length - .026, -.025], .007, true);
    }
    const wheel = make(`${id}.drive`, `Tail vertebra ${i + 1} · articulation wheel`, 'Tail joint drive', 'Make the changing elevation at this vertebra visible.', 'A small gear is coaxial with the transverse trunnion and spaced outside the shell.', 'Bronze gear / titanium hub', link, [0, 0, -.08]);
    wheel.position.z = -.067 + i * .004; wheel.rotation.x = Math.PI / 2; gear(wheel, .048 - i * .004, 10, .017);
    return { link, wheel };
  });
  const sting = make('tail.stylus', 'Terminal stinger-shaped inspection stylus', 'Articulated tail', 'Finish the recognizable tail arch with a downturned probe.', 'An open two-rail nose ends in a tapered sensor tip; this conceptual module contains no injection system.', 'Titanium / teal ceramic', chassis, [0, .18, -.08]);
  rod(sting, 'titanium', [-.018, .015, 0], [-.008, .175, 0], .014);
  rod(sting, 'titanium', [.018, .015, 0], [.008, .175, 0], .014);
  primitive(sting, 'cone', 'teal', [0, .211, 0], [.023, .078, .023]);
  bearing(sting, 0, .033);

  const claws = [-1, 1].map(side => {
    const id = `claw.${side < 0 ? 'L' : 'R'}`, name = `${side < 0 ? 'Left' : 'Right'} pedipalp`;
    const upper = make(`${id}.upper`, `${name} · shoulder fork`, 'Claw positioning', 'Swing the heavy pincer clear of the front walking legs.', 'A 220 mm fork joins the thoracic pin to the elbow.', 'Titanium / shell', chassis, [side * .16, .04, -.12]); beam(upper, DIM.humerus, .033); bearing(upper, 0, .057);
    const forearm = make(`${id}.forearm`, `${name} · wrist carrier`, 'Claw positioning', 'Carry the palm at a constant distance from the elbow.', 'The 240 mm rail pair turns independently from the shoulder fork.', 'Titanium / shell', chassis, [side * .21, .04, -.16]); beam(forearm, DIM.forearm, .035); bearing(forearm, 0, .055); mountBracket(forearm, CLAW_MOUNT, .035);
    const palm = make(`${id}.palm`, `${name} · split gearbox palm`, 'Opposed pincer drive', 'Space the two parallel jaw pins on a common palm.', 'Upper and lower cover plates enclose an open meshing-gear window.', 'Shell / titanium', chassis, [side * .22, .10, -.18]);
    for (const q of [-1, 1]) {
      box(palm, 'shell', [q * .073, 0, -.08], [.042, .082, .16]);
      rod(palm, 'titanium', [q * .05, -.045, -.025], [q * .05, -.045, -.16], .014);
    }
    box(palm, 'dark', [0, 0, -.021], [.125, .061, .028]);
    fasteners(palm, [[-.075, .048, -.04], [.075, .048, -.04], [-.075, .048, -.12], [.075, .048, -.12]], .008);
    const jaws = [-1, 1].map(q => {
      const jaw = make(`${id}.jaw-${q < 0 ? 'inner' : 'outer'}`, `${name} · ${q < 0 ? 'negative' : 'positive'} opposed finger`, 'Opposed pincer drive', 'Rotate an inward-hooked rigid finger around its vertical pin.', 'Equal spur wheels reverse the two jaw angles about the palm centreline.', 'Titanium / bronze / rubber', chassis, [side * .2 + q * .09, .04, -.20]);
      const a = [0, 0, 0], b = [q * .02, 0, -.12], c = [-q * .058, 0, -DIM.jaw];
      rod(jaw, 'titanium', a, b, .022); rod(jaw, 'titanium', b, c, .018);
      box(jaw, 'shell', [q * .02, .004, -.076], [.038, .053, .08], [0, -q * .16, 0]);
      for (let j = 0; j < 4; j++) box(jaw, 'rubber', [q * (.015 - j * .014), -.001, -.11 - j * .019], [.023, .036, .013], [0, q * .48, 0], true);
      const wheel = make(`${id}.jaw-${q < 0 ? 'inner' : 'outer'}-gear`, `${name} · ${q < 0 ? 'negative' : 'positive'} pinion`, 'Opposed pincer drive', 'Transmit the equal-and-opposite jaw rotation.', 'A 12-tooth timing wheel is rigidly fixed to the finger pin.', 'Bronze / titanium', jaw, [0, .065, 0]); wheel.position.y = .05; gear(wheel, .05, 12, .025);
      return jaw;
    });
    return { upper, forearm, palm, jaws, act: actuator(`${id}.reach`, name, chassis, .19) };
  });

  // Reapply bind transforms, including static offsets, so explosion cannot accumulate
  // floating-point drift after an arbitrary sequence of inspection frames.
  const bind = [];
  kit.group.traverse(node => { if (node.userData.partId) bind.push({ node, position: node.position.clone(), rotation: node.quaternion.clone(), scale: node.scale.clone() }); });
  let current = sample(0), disposed = false;
  function update(state = current, options = {}) {
    if (disposed) return;
    for (const b of bind) { b.node.position.copy(b.position); b.node.quaternion.copy(b.rotation); b.node.scale.copy(b.scale); }
    current = state?.legs ? state : current;
    for (let i = 0; i < legs.length; i++) {
      const n = legs[i], s = current.legs[i];
      n.hip.position.fromArray(s.hip); n.hip.rotation.y = -s.yaw;
      aim(n.coxa, s.hip, s.coxa); aim(n.femur, s.coxa, s.knee); aim(n.tibia, s.knee, s.foot); n.pad.position.fromArray(s.foot);
      const u = sub(s.knee, s.coxa), v = sub(s.foot, s.knee);
      const dot = u.reduce((sum, x, j) => sum + x * v[j], 0) / (DIM.femur * DIM.tibia);
      n.kneeGear.rotation.y = Math.acos(Math.max(-1, Math.min(1, dot)));
      poseActuator(n.act, s.actuatorA, s.actuatorB, n.femur);
    }
    bodyGears.forEach((n, i) => { n.rotation.y = current.driveAngle + i * Math.PI / 3; });
    tail.forEach((n, i) => { const s = current.tail[i]; aim(n.link, s.start, s.end); n.link.rotateY(s.roll); n.wheel.rotation.y = s.elevation; });
    aim(sting, current.stinger.start, current.stinger.end);
    claws.forEach((n, i) => {
      const s = current.claws[i]; aim(n.upper, s.shoulder, s.elbow); aim(n.forearm, s.elbow, s.wrist);
      n.palm.position.fromArray(s.wrist); n.palm.rotation.y = s.yaw;
      n.jaws.forEach((jaw, j) => { jaw.position.fromArray(s.jaws[j].pivot); jaw.rotation.y = s.jaws[j].yaw; });
      poseActuator(n.act, s.actuatorA, s.actuatorB, n.forearm);
    });
    kit.sync(options);
  }
  // All hierarchy and primitive records exist before the first batch allocation.
  update(current);
  return { group: kit.group, update, get pickables() { return disposed ? [] : kit.pickables; }, parts: kit.parts, stats: kit.stats,
    dispose() { if (!disposed) { disposed = true; kit.dispose(); kit.group.clear(); } } };
}
