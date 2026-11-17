import { Matrix4, Vector3 } from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, LEG_ANCHOR, CLAW_ANCHOR, legNormal, linkFrame, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('CRUSTA C10 · lateral service walker');
  const nodes = [], legs = [], drives = [], eyes = [];
  const { add, rod, gear, fasteners, aim } = kit;
  const part = (id, name, system, purpose, how, parent, explode = [0, .10, 0], material = 'Titanium, bronze and insulated alloy') => {
    const n = kit.part({ id: `crab.${id}`, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode);
    nodes.push(n); return n;
  };
  const box = (n, m, p, s, e = [0, 0, 0], detail = false) => add(n, 'box', m, p, s, e, detail);
  function bearing(n, y, r = .031, lane = .047, axis = 'z') {
    const at = d => axis === 'x' ? [d, y, 0] : axis === 'y' ? [0, y + d, 0] : [0, y, d];
    const cylinderEuler = axis === 'x' ? [0, 0, -Math.PI / 2] : axis === 'y' ? [0, 0, 0] : [Math.PI / 2, 0, 0];
    const ringEuler = axis === 'x' ? [0, Math.PI / 2, 0] : axis === 'y' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(n, 'cylinder', 'dark', at(0), [r, .056, r], cylinderEuler);
    rod(n, 'titanium', at(-lane - .013), at(lane + .013), r * .32);
    for (const s of [-1, 1]) {
      // Rear dust seal is secondary; the front race and full journal survive low quality.
      add(n, 'ring', 'brass', at(s * lane), [r, r, r], ringEuler, s < 0);
      add(n, 'bolt', 'dark', at(s * (lane + .013)), [r * .48, .012, r * .48], cylinderEuler);
    }
  }
  function member(n, length, width = .024, rootAxis = 'z') {
    // An open box-section fork, with an uninterrupted pin-to-pin torque tube.
    rod(n, 'brass', [0, 0, 0], [0, length, 0], .009);
    for (const s of [-1, 1]) {
      box(n, 'titanium', [s * width, length / 2, 0], [.013, length - .024, .024]);
      box(n, 'dark', [s * width, length / 2, -.018], [.018, length * .60, .012]);
    }
    for (const f of [.25, .5, .75]) {
      box(n, 'titanium', [0, length * f, 0], [width * 2, .012, .021]);
      box(n, 'teal', [0, length * f, -.027], [.018, .014, .008], [0, 0, 0], true);
    }
    bearing(n, 0, .031, .047, rootAxis); bearing(n, length, .025);
    fasteners(n, [[-width, length * .25, .02], [width, length * .75, .02]], .006);
  }
  function bracket(n, p, width) {
    for (const s of [-1, 1]) rod(n, 'titanium', [s * width, p[1], 0], p, .010);
    add(n, 'ring', 'brass', p, [.019, .019, .019]);
  }
  function actuator(id, label, barrelLength, rodLength) {
    const barrel = part(`${id}.barrel`, `${label} pressure barrel`, 'Hydraulic demonstration', 'Holds a fixed-length sleeve between the two offset actuator clevises.', 'The entire barrel aims at the moving mount; its scale and bore length never change.');
    add(barrel, 'cylinder', 'dark', [0, barrelLength / 2, 0], [.022, barrelLength, .022]);
    for (const y of [.012, barrelLength - .012]) {
      add(barrel, 'cylinder', 'copper', [0, y, 0], [.027, .018, .027]);
      box(barrel, 'titanium', [.027, y, 0], [.016, .023, .021]);
    }
    // Spherical base seat: the offset stroke is spatial, not a planar hinge.
    add(barrel, 'sphere', 'copper', [0, 0, 0], [.024, .024, .024]);
    rod(barrel, 'rubber', [-.027, .022, 0], [-.027, barrelLength - .023, 0], .004, true);
    const piston = part(`${id}.piston`, `${label} sliding rod and clevis`, 'Hydraulic demonstration', 'Transfers changing pin separation through a polished rigid rod.', 'The rod is aimed backwards from its moving clevis and slides into the barrel; their overlap is intentional, not elastic scaling.');
    rod(piston, 'titanium', [0, 0, 0], [0, rodLength, 0], .009);
    add(piston, 'sphere', 'copper', [0, 0, 0], [.023, .023, .023]);
    const clevis = part(`${id}.clevis`, `${label} member-aligned rod-end bearing`, 'Hydraulic demonstration', 'Transfers rod thrust through the bracket pin on the moving member.', 'The spherical rod end accommodates sleeve alignment while its transverse journal remains aligned with the member-local bracket.');
    bearing(clevis, 0, .019, .027);
    return { barrel, piston, clevis };
  }
  const chassis = part('frame', 'Oval ventral ladder and perimeter cage', 'Chassis', 'Collects reactions from eight lateral leg brackets and both claw shoulders.', 'Two elliptical hoops are connected by open transverse ribs; the low shell is separate armor.', undefined, [0, .02, 0]);
  for (const y of [.375, .48]) add(chassis, 'ring', 'titanium', [0, y, 0], [.405, .367, .045], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const z = -.30 + i * .15, w = .39 * Math.sqrt(1 - (z / .44) ** 2);
    rod(chassis, 'titanium', [-w, .40, z], [w, .40, z], .018);
    fasteners(chassis, [[-w, .418, z], [w, .418, z]], .009);
  }
  for (const x of [-.145, .145]) box(chassis, 'dark', [x, .385, 0], [.035, .044, .66]);
  // Seven layered, shallow oval scutes establish the unmistakable crab carapace.
  for (let i = 0; i < 7; i++) {
    const center = i === 0, side = i < 4 ? -1 : 1, row = (i - 1) % 3;
    const p = center ? [0, .584, -.015] : [side * .262, .538 - Math.abs(row - 1) * .012, -.25 + row * .25];
    const armor = part(`armor.${i}`, center ? 'Crowned oval dorsal shield' : `${side < 0 ? 'Port' : 'Starboard'} overlapping scute ${row + 1}`, 'Layered carapace', 'Protects a local transmission bay without becoming the load-bearing frame.', 'A shallow formed shell and raised edge bead separate upward in service; x-ray ghosts only shell material.', chassis, [center ? 0 : side * .10, .20, 0], 'Pale cast shell with bronze retainers');
    add(armor, 'sphere', 'shell', p, center ? [.31, .072, .325] : [.20, .052, .156]);
    for (const q of [-1, 1]) fasteners(armor, [[p[0] + q * (center ? .17 : .09), p[1] + .042, p[2]]], .008);
    for (let k = 0; k < 4; k++) box(armor, 'titanium', [p[0], p[1] + .043, p[2] - .057 + k * .038], [center ? .19 : .12, .006, .008], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) {
    const rim = part(`rim.${side}`, `${side < 0 ? 'Port' : 'Starboard'} scalloped impact rim`, 'Carapace edge', 'Protects exposed hip servos while keeping all four bracket mouths open.', 'Four small chamfer-like shell lobes follow the oval body edge rather than filling the leg bays.', chassis, [side * .12, .08, 0]);
    for (let i = 0; i < 4; i++) {
      add(rim, 'sphere', 'shell', [side * .403, .487, -.31 + i * .207], [.079, .037, .078]);
      box(rim, 'dark', [side * .442, .474, -.31 + i * .207], [.018, .024, .067]);
    }
    const manifold = part(`service.${side}`, `${side < 0 ? 'Port' : 'Starboard'} ventral distribution manifold`, 'Service routing', 'Distributes the illustrative hydraulic and electrical feeds to four stations.', 'A rigid lower manifold, copper ports and an external insulated loom remain visible below the pale carapace.', chassis, [side * .12, .02, 0]);
    box(manifold, 'teal', [side * .27, .344, 0], [.065, .05, .56]);
    rod(manifold, 'rubber', [side * .31, .357, -.30], [side * .31, .357, .30], .011);
    for (let i = 0; i < 6; i++) {
      add(manifold, 'cylinder', 'copper', [side * .29, .37, -.25 + i * .10], [.018, .022, .018]);
      box(manifold, 'titanium', [side * .27, .308, -.25 + i * .10], [.080, .014, .021], [0, 0, 0], true);
    }
  }
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, z = i < 2 ? -.18 : .18;
    const motor = part(`drive.${i}.stator`, `Ventral bank ${i + 1} open stator`, 'Ventral drive banks', 'Feeds the paired leg timing cartridges from an exposed underbody motor.', 'Copper coil bars surround a vertical rotor, between two separated annular bearing seats.', chassis, [side * .08, -.09, 0]);
    motor.position.set(side * .12, .337, z);
    for (const y of [-.036, .036]) add(motor, 'ring', 'dark', [0, y, 0], [.071, .071, .071], [Math.PI / 2, 0, 0]);
    for (let j = 0; j < 10; j++) {
      const a = j * Math.PI / 5;
      box(motor, 'copper', [.058 * Math.cos(a), 0, .058 * Math.sin(a)], [.021, .058, .018], [0, -a, 0]);
      box(motor, 'titanium', [.079 * Math.cos(a), 0, .079 * Math.sin(a)], [.013, .070, .008], [0, -a, 0], true);
    }
    const rotor = part(`drive.${i}.rotor`, `Ventral bank ${i + 1} timing rotor`, 'Ventral drive banks', 'Makes the common service-cycle phase readable beneath the frame.', 'A bronze spur wheel and offset witness spoke turn on the vertical stator shaft.', motor, [0, -.08, 0]);
    rotor.position.y = -.058; gear(rotor, .062, 14, .016); box(rotor, 'teal', [.03, -.012, 0], [.037, .008, .012]); drives.push(rotor);
    const cooler = part(`drive.${i}.cooler`, `Ventral bank ${i + 1} cooling shoe`, 'Thermal service', 'Carries a protected heat-sink below the open winding bank.', 'The structural thermal bridge remains at low detail while its fine fins are omitted.', motor, [0, -.14, 0]);
    box(cooler, 'dark', [side * .077, 0, 0], [.023, .064, .09]);
    for (let j = 0; j < 7; j++) box(cooler, 'titanium', [side * .094, 0, -.039 + j * .013], [.048, .076, .005], [0, 0, 0], true);
  }
  for (const s of sample(0).legs) {
    const id = `leg.${s.id}`, label = `${s.side < 0 ? 'Port' : 'Starboard'} sidestep leg ${s.station + 1}`;
    const hip = part(`${id}.hip`, `${label} lateral clevis`, 'Eight-leg gait', 'Locates the yaw pin outside the shell skirt and carries the actuator base.', 'Two open cheeks span a vertical yaw journal; a separate elevated spherical socket reaches the hydraulic anchor.', undefined, [s.side * .10, .04, 0]);
    bearing(hip, 0, .039, .047, 'y');
    for (const y of [-.062, .062]) box(hip, 'titanium', [-s.side * .037, y, 0], [.09, .014, .063]);
    bracket(hip, [0, .035, .057], .024);
    const coxa = part(`${id}.coxa`, `${label} yaw fork`, 'Eight-leg gait', 'Keeps the first 110 mm pin interval rigid.', 'A short open torque fork has a vertical root yaw journal and a perpendicular distal pitch bush.'); member(coxa, D.coxa, .019, 'x');
    const femur = part(`${id}.femur`, `${label} lifting femur`, 'Eight-leg gait', 'Maintains a 280 mm hip-to-knee interval under inverse kinematics.', 'A box-section fork surrounds the torque tube; the actuator clevis is fixed in this local link frame.'); member(femur, D.femur); bracket(femur, LEG_ANCHOR, .024);
    const tibia = part(`${id}.tibia`, `${label} descending tibia`, 'Eight-leg gait', 'Maintains the 370 mm knee-to-pad interval throughout the raised return.', 'Two exposed rails and end journals follow the solved endpoints without length scaling.'); member(tibia, D.tibia, .019);
    const armor = part(`${id}.armor`, `${label} femoral half shield`, 'Leg armor', 'Protects the exposed upper link without obscuring its hydraulic mount.', 'A separate tapered pair of shell cheeks covers only the middle of the femur.', femur, [0, 0, -.10], 'Formed pale shell');
    for (const q of [-1, 1]) box(armor, 'shell', [q * .033, .13, -.008], [.016, .142, .040], [0, 0, -q * .025]);
    fasteners(armor, [[-.035, .10, .018], [.035, .17, .018]], .006);
    const wheel = part(`${id}.wheel`, `${label} knee sector and witness`, 'Joint reduction', 'Exposes the relative knee rotation on the outside of the fork.', 'The spur wheel sits beyond the rail cheek on an extended journal, in its own axial lane.', femur, [0, 0, .09]);
    wheel.position.set(0, D.femur, .084); wheel.rotation.x = Math.PI / 2; gear(wheel, .040, 12, .014); box(wheel, 'teal', [.017, -.01, 0], [.025, .008, .010]);
    rod(femur, 'titanium', [0, D.femur, .045], [0, D.femur, .105], .011);
    const pad = part(`${id}.pad`, `${label} level traction shoe`, 'Ground interface', 'Marks the support interval on the y=0 service floor.', 'The articulated ankle carries a level elastomer pad; contact forces and slip are not computed.', undefined, [s.side * .20, 0, 0], 'Rubber tread and titanium saddle');
    box(pad, 'rubber', [0, 0, 0], [.086, .064, .075]); box(pad, 'titanium', [0, .033, 0], [.052, .010, .052]);
    rod(pad, 'titanium', [0, 0, -.052], [0, 0, .052], .010);
    for (let j = 0; j < 4; j++) box(pad, 'dark', [-.030 + j * .020, -.023, 0], [.007, .012, .078], [0, 0, 0], true);
    legs.push({ hip, coxa, femur, tibia, wheel, pad, actuator: actuator(`${id}.lift`, label, D.barrel, D.piston) });
  }
  const claws = [-1, 1].map(side => {
    const id = `claw.${side < 0 ? 'L' : 'R'}`, label = `${side < 0 ? 'Port' : 'Starboard'} pincer`;
    const shoulder = part(`${id}.shoulder`, `${label} reinforced shoulder saddle`, 'Pincer positioning', 'Carries the heavy forward manipulator and its reach-cylinder base.', 'Open side cheeks and an offset base pin leave the forward gait lane unobstructed.'); bearing(shoulder, 0, .045, .047, 'y'); bracket(shoulder, [0, .04, .065], .032);
    for (const y of [-.022, .022]) rod(shoulder, 'titanium', [-side * .10, -.055 + y, .12], [0, y, 0], .012);
    const upper = part(`${id}.upper`, `${label} shoulder link`, 'Pincer positioning', 'Holds the 200 mm shoulder-to-elbow spacing.', 'A wide open fork oscillates clear of the foremost walking leg.'); member(upper, D.upper, .032);
    const forearm = part(`${id}.forearm`, `${label} wrist carrier`, 'Pincer positioning', 'Holds the 230 mm elbow-to-wrist spacing.', 'An independent forearm carries the palm; its hydraulic anchor is a permanent local clevis.'); member(forearm, D.forearm, .032); bracket(forearm, CLAW_ANCHOR, .032);
    const palm = part(`${id}.palm`, `${label} differential palm cage`, 'Opposed jaw drive', 'Spaces the paired jaw pins and exposes their equal-and-opposite transmission.', 'Twin palm rails flank the differential window; the two 62 mm pitch-radius gears turn on vertical extended pins.');
    bearing(palm, 0, .025, .047, 'y');
    for (const q of [-1, 1]) {
      box(palm, 'titanium', [q * .088, 0, -.082], [.018, .045, .19]);
      rod(palm, 'titanium', [q * .062, -.052, -.16], [q * .062, .09, -.16], .014);
      add(palm, 'ring', 'brass', [q * .062, -.04, -.16], [.030, .030, .030], [Math.PI / 2, 0, 0]);
    }
    box(palm, 'dark', [0, -.033, -.064], [.17, .020, .043]);
    const armor = part(`${id}.armor`, `${label} split gearbox fairing`, 'Pincer armor', 'Shields the palm edges but preserves a top view of both meshing gears.', 'Two separately raised shell lobes leave the entire center of the gearbox open.', palm, [0, .12, 0], 'Pale formed shell');
    for (const q of [-1, 1]) { add(armor, 'sphere', 'shell', [q * .091, .012, -.063], [.034, .054, .104]); fasteners(armor, [[q * .091, .065, -.063]], .008); }
    const jaws = [-1, 1].map(q => {
      const jaw = part(`${id}.jaw.${q}`, `${label} ${q < 0 ? 'medial' : 'lateral'} hooked finger`, 'Opposed jaw drive', 'Sweeps a rigid two-section inward hook around the jaw pin.', 'Broad knuckles, an open inner throat and a bent titanium tip make a recognizable pincer; hook solids remain separated at closure.', undefined, [side * .12 + q * .06, .03, -.16]);
      const a = [0, 0, 0], b = [q * .038, 0, -.155], c = [-q * .055, 0, -.265];
      rod(jaw, 'titanium', a, b, .026); rod(jaw, 'titanium', b, c, .019);
      add(jaw, 'cylinder', 'dark', a, [.023, .036, .023]);
      add(jaw, 'sphere', 'shell', [q * .027, 0, -.087], [.039, .042, .080], [0, -q * .20, 0]);
      add(jaw, 'sphere', 'dark', b, [.028, .026, .028]);
      for (let j = 0; j < 4; j++) box(jaw, 'rubber', [q * (.025 - j * .020), -.002, -.155 - j * .026], [.027, .038, .011], [0, q * .64, 0], true);
      const wheel = part(`${id}.pinion.${q}`, `${label} ${q < 0 ? 'medial' : 'lateral'} jaw pinion`, 'Opposed jaw drive', 'Enforces the visible equal-and-opposite jaw angle relationship.', 'A bronze gear is keyed to its finger above the palm; the open lower lane contains the hook rather than a coplanar conrod.', jaw, [0, .08, 0]);
      // Half-tooth indexing places one pinion's teeth in the other's gaps.
      wheel.position.y = .062; wheel.rotation.y = q > 0 ? Math.PI / 16 : 0;
      gear(wheel, .062, 16, .018); box(wheel, 'teal', [q * .027, .012, 0], [.033, .006, .010]);
      return jaw;
    });
    return { shoulder, upper, forearm, palm, jaws, actuator: actuator(`${id}.reach`, label, .26, .25) };
  });
  for (const side of [-1, 1]) {
    const label = `${side < 0 ? 'Port' : 'Starboard'} scanner`, id = `eye.${side}`;
    const socket = part(`${id}.socket`, `${label} yaw socket`, 'Scanning optics', 'Supports a raised scanning stalk independently of the dorsal shell.', 'An annular yaw bearing and open fork rise through a dedicated carapace aperture.');
    add(socket, 'cylinder', 'teal', [0, 0, 0], [.048, .038, .048]); add(socket, 'ring', 'brass', [0, .026, 0], [.042, .042, .042], [Math.PI / 2, 0, 0]);
    const stalk = part(`${id}.stalk`, `${label} elevated mast`, 'Scanning optics', 'Keeps the optical head above both palm drives and the armored shell.', 'A rigid twin-rail stalk follows the analytic endpoint and carries exposed conductor clips.'); member(stalk, Math.hypot(.205, .055), .016);
    const optic = part(`${id}.optic`, `${label} split optical turret`, 'Scanning optics', 'Sweeps a binocular lens pair through a deterministic inspection arc.', 'A dark turret on the raised stalk carries two recessed teal lenses and a pale protective brow.');
    box(optic, 'dark', [0, 0, 0], [.105, .060, .060]); box(optic, 'shell', [0, .036, .001], [.12, .016, .075]);
    for (const q of [-1, 1]) { add(optic, 'ring', 'brass', [q * .028, 0, -.034], [.021, .021, .021]); add(optic, 'sphere', 'lens', [q * .028, 0, -.037], [.016, .018, .010]); }
    eyes.push({ socket, stalk, optic });
  }
  const basis = new Matrix4(), x = new Vector3(), y = new Vector3(), z = new Vector3();
  function poseLink(node, a, b, normal) {
    const frame = linkFrame(a, b, normal);
    basis.makeBasis(x.fromArray(frame.x), y.fromArray(frame.y), z.fromArray(frame.z));
    node.position.fromArray(a); node.quaternion.setFromRotationMatrix(basis);
  }
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
  let current = sample(0), disposed = false;
  const poseActuator = (n, a, b, member) => {
    aim(n.barrel, a, b); aim(n.piston, b, a);
    n.clevis.position.fromArray(b); n.clevis.quaternion.copy(member.quaternion);
  };
  function update(state = current, options = {}) {
    if (disposed) return;
    if (state?.legs && state?.claws && state?.eyes) current = state;
    for (const { node, p, q } of bind) { node.position.copy(p); node.quaternion.copy(q); }
    legs.forEach((n, i) => {
      const s = current.legs[i]; n.hip.position.fromArray(s.hip);
      const normal = legNormal(s.hip, s.coxa);
      poseLink(n.coxa, s.hip, s.coxa, normal); poseLink(n.femur, s.coxa, s.knee, normal); poseLink(n.tibia, s.knee, s.foot, normal);
      n.pad.position.fromArray(s.foot); n.pad.rotation.y = Math.atan2(normal[0], normal[2]);
      n.wheel.rotation.y = s.kneeAngle; poseActuator(n.actuator, s.actuatorA, s.actuatorB, n.femur);
    });
    claws.forEach((n, i) => {
      const s = current.claws[i]; n.shoulder.position.fromArray(s.shoulder);
      poseLink(n.upper, s.shoulder, s.elbow, [0, 1, 0]); poseLink(n.forearm, s.elbow, s.wrist, [0, 1, 0]);
      n.palm.position.fromArray(s.wrist); n.palm.rotation.y = s.yaw;
      n.jaws.forEach((jaw, j) => { jaw.position.fromArray(s.jaws[j].pivot); jaw.rotation.y = s.jaws[j].yaw; });
      poseActuator(n.actuator, s.actuatorA, s.actuatorB, n.forearm);
    });
    eyes.forEach((n, i) => { const s = current.eyes[i]; n.socket.position.fromArray(s.base); aim(n.stalk, s.base, s.tip); n.optic.position.fromArray(s.tip); n.optic.rotation.y = s.yaw + s.scan; });
    drives.forEach((n, i) => { n.rotation.y = current.driveAngle + i * Math.PI / 2; });
    kit.sync(options);
  }
  update();
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); } };
}
