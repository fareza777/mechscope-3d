import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, MOUNT, TAU, sample, poseAt } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('CHELON T4 · domed mechanical tortoise');
  const { add, rod, gear, fasteners, aim } = kit;
  const nodes = [], legs = [], timing = [], neck = [];
  let current = sample(0), disposed = false;
  function part(id, name, system, purpose, how, parent, explode = [0, .12, 0], material = 'Titanium / brass') {
    const node = kit.part({ id: `tortoise.${id}`, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  }
  function eye(n, y, r = .026, reach = .025) {
    add(n, 'ring', 'brass', [0, y, 0], [r, r, r]);
    add(n, 'cylinder', 'titanium', [0, y, reach / 2], [r * .4, reach + .018, r * .4], [Math.PI / 2, 0, 0]);
    add(n, 'bolt', 'dark', [0, y, reach + .008], [r * .6, .011, r * .6], [Math.PI / 2, 0, 0]);
  }
  function rails(n, length, width = .030) {
    for (const x of [-width, width]) rod(n, 'titanium', [x, .014, 0], [x, length - .014, 0], .011);
    for (const y of [.025, length * .5, length - .025]) {
      rod(n, 'dark', [-width, y, 0], [width, y, 0], .008);
      add(n, 'box', 'brass', [0, y, -.011], [.017, .016, .018], [0, 0, 0], true);
    }
    rod(n, 'copper', [-width - .016, .025, -.02], [-width - .016, length - .025, -.02], .004, true);
    fasteners(n, [[-width, length * .3, .012], [width, length * .7, .012]], .006);
  }
  // Ellipsoidal surface; all shell geometry is on shell-only material batches.
  const surface = (theta, phi, inset = 0) => [( .65 - inset) * Math.sin(theta) * Math.cos(phi), .56 + (.45 - inset) * Math.cos(theta), (.83 - inset) * Math.sin(theta) * Math.sin(phi)];
  const frame = part('chassis', 'Open ventral ladder chassis', 'Ground load path', 'Connects the four hip cartridges and the dome rim.', 'Separated longitudinal rails, outriggers and cross-braces leave the timing train visible from below.', undefined, [0, .035, 0]);
  for (const x of [-.32, .32]) rod(frame, 'titanium', [x, .49, -.64], [x, .49, .64], .023);
  for (const z of [-.55, -.28, 0, .28, .55]) {
    rod(frame, 'dark', [-.44, .49, z], [.44, .49, z], .018);
    fasteners(frame, [[-.32, .51, z], [.32, .51, z]], .010);
  }
  for (const side of [-1, 1]) for (const z of [-.49, .49]) {
    rod(frame, 'titanium', [side * .32, .49, z], [side * .435, .46, z], .025);
    rod(frame, 'titanium', [side * .32, .49, z], [side * .49, .60, z], .015);
  }
  for (const x of [-.055, .055]) rod(frame, 'titanium', [x, .49, -.55], [x, .64, -.70], .014);
  rod(frame, 'brass', [-.055, .64, -.70], [.055, .64, -.70], .013);
  for (let i = 0; i < 12; i++) {
    const phi = i * TAU / 12;
    const rib = part(`dome.rib.${i}`, `Dome radial truss ${i + 1}`, 'Raised shell lattice', 'Transfers crown loads to the perimeter rim.', 'Paired curved polygonal rails are tied by spaced cross-members and diagonal braces.', undefined, [.05 * Math.cos(phi), .09, .05 * Math.sin(phi)]);
    for (let j = 0; j < 6; j++) {
      const theta = .08 + j * .24, next = theta + .24;
      for (const offset of [-.027, .027]) rod(rib, 'titanium', surface(theta, phi + offset, .026), surface(next, phi + offset, .026), .008);
      rod(rib, 'dark', surface(next, phi - .027, .026), surface(next, phi + .027, .026), .005);
      if (j % 2) rod(rib, 'dark', surface(theta, phi - .027, .026), surface(next, phi + .027, .026), .0035, true);
    }
  }
  for (let row = 0; row < 5; row++) {
    const theta = [.24, .54, .85, 1.16, 1.52][row];
    const hoop = part(`dome.hoop.${row}`, `Dome latitude rail ${row + 1}`, 'Raised shell lattice', 'Ties all radial ribs together at a common dome elevation.', 'Twenty-four short rigid tube segments create an open polygonal ring, not an opaque plate.');
    for (let i = 0; i < 24; i++) rod(hoop, row === 4 ? 'titanium' : 'dark', surface(theta, i * TAU / 24, .026), surface(theta, (i + 1) * TAU / 24, .026), row === 4 ? .015 : .007);
  }
  const rows = [[.19, 6], [.49, 10], [.80, 14], [1.11, 18], [1.40, 20]];
  rows.forEach(([theta, count], row) => {
    for (let i = 0; i < count; i++) {
      const phi = (i + (row % 2 ? .5 : 0)) * TAU / count;
      const p = surface(theta, phi), normal = new THREE.Vector3(Math.sin(theta) * Math.cos(phi) / .65, Math.cos(theta) / .45, Math.sin(theta) * Math.sin(phi) / .83).normalize();
      const tangent = new THREE.Vector3(-.65 * Math.sin(phi), 0, .83 * Math.cos(phi)).normalize();
      const meridian = new THREE.Vector3().crossVectors(tangent, normal).normalize();
      const scute = part(`scute.${row}.${i}`, `Dome row ${row + 1} scute ${String(i + 1).padStart(2, '0')}`, 'Segmented dome armor', 'Protects one independently removable surface bay.', 'A curved canted patch follows the local ellipsoid normal with open seams to its neighbors.', undefined, [.12 * Math.cos(phi), .18 + .04 * Math.cos(theta), .12 * Math.sin(phi)], 'Formed pale alloy shell');
      scute.position.fromArray(p); scute.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(tangent, normal, meridian));
      const halfWidth = .73 * Math.sin(theta) * Math.PI / count * .85;
      const halfLength = row === 0 ? .064 : .084;
      add(scute, 'sphere', 'shell', [0, 0, 0], [halfWidth, .018, halfLength]);
      for (const side of [-1, 1]) {
        add(scute, 'box', 'shell', [side * halfWidth * .47, .012, 0], [.012, .009, halfLength * 1.13], [0, side * .09, side * -.10]);
        rod(scute, 'dark', [side * halfWidth * .78, -.009, -halfLength * .48], [side * halfWidth * .78, -.009, halfLength * .48], .0035);
      }
      fasteners(scute, [[0, .019, 0]], .0055);
    }
  });
  for (let i = 0; i < 12; i++) {
    const phi = (i + .5) * TAU / 12, p = surface(1.52, phi);
    const latch = part(`rim.latch.${i}`, `Rim service latch ${i + 1}`, 'Shell retention', 'Locks a removable dome sector to the perimeter rail.', 'A short clasp bridges the lower scute edge and rim, with an exposed bushed hinge.', undefined, [.10 * Math.cos(phi), .03, .10 * Math.sin(phi)]);
    latch.position.fromArray(p); latch.rotation.y = -phi;
    add(latch, 'box', 'titanium', [0, .006, 0], [.046, .025, .035]);
    add(latch, 'box', 'brass', [0, .027, 0], [.025, .018, .025]);
    fasteners(latch, [[0, .040, 0]], .005);
  }
  for (let i = 0; i < 6; i++) {
    const z = -.46 + i * .184;
    const motor = part(`drive.${i}.stator`, `Timing cartridge ${i + 1} winding cage`, 'Internal drive train', 'Supports one visible inspection-drive takeoff.', 'Two annular stator faces surround a longitudinal shaft and six separated copper winding blocks.', undefined, [0, .09, 0]);
    motor.position.set(0, .665, z);
    for (const dz of [-.038, .038]) add(motor, 'ring', 'dark', [0, 0, dz], [.081, .081, .081]);
    rod(motor, 'titanium', [0, 0, -.092], [0, 0, .092], .018);
    for (let j = 0; j < 6; j++) {
      const a = j * TAU / 6;
      add(motor, 'box', 'copper', [.062 * Math.cos(a), .062 * Math.sin(a), 0], [.016, .018, .061], [0, 0, a], true);
    }
    for (const side of [-1, 1]) rod(motor, 'titanium', [side * .06, -.02, 0], [side * .24, -.175, 0], .010);
    const wheel = part(`drive.${i}.wheel`, `Timing cartridge ${i + 1} indexed wheel`, 'Internal drive train', 'Displays the common master phase along the central shaft.', 'A sixteen-tooth disk rotates between stator bays without occupying the leg-rail lanes.', motor, [0, .025, .055]);
    wheel.position.z = .065; wheel.rotation.x = Math.PI / 2; gear(wheel, .064, 16, .016); timing.push(wheel);
  }
  for (const side of [-1, 1]) {
    const loom = part(`service.${side}`, `${side < 0 ? 'Left' : 'Right'} service conductor ladder`, 'Electrical service', 'Distributes command wiring around the open chassis.', 'Paired insulated and copper segments follow a fixed curved route beneath the dome.', undefined, [side * .12, 0, 0], 'Copper / rubber insulation');
    const p = j => [side * (.31 + .06 * Math.sin(j * Math.PI / 12)), .58, -.61 + j * .102];
    for (let j = 0; j < 12; j++) {
      rod(loom, 'rubber', p(j), p(j + 1), .007);
      const a = p(j), b = p(j + 1); a[1] += .019; b[1] += .019;
      rod(loom, 'copper', a, b, .0035, true);
    }
  }

  for (const l of current.legs) {
    const id = `leg.${l.id}`, label = `${l.station ? 'Hind' : 'Fore'} ${l.side < 0 ? 'left' : 'right'} leg`;
    const hip = part(`${id}.hip`, `${label} hip drum housing`, 'Four-leg gait', 'Locates the fixed first joint below the shell rim.', 'A split drum surrounds the coxa yaw journal and exposes its offset timing wheel.', undefined, [l.side * .08, .03, 0]);
    add(hip, 'cylinder', 'dark', [0, 0, 0], [.051, .055, .051]);
    for (const x of [-.024, .024]) rod(hip, 'titanium', [x, 0, .015], [0, .055, .09], .008);
    add(hip, 'ring', 'brass', [0, .055, .09], [.018, .018, .018]);
    for (const y of [-.032, .032]) add(hip, 'ring', 'brass', [0, y, 0], [.047, .047, .047], [Math.PI / 2, 0, 0]);
    const hipWheel = part(`${id}.hipwheel`, `${label} hip phase drum`, 'Hip actuation', 'Shows the indexed drive phase at the hip.', 'A vertical-axis spur wheel is spaced beneath the housing and above the walking rail sweep.', hip, [0, .05, 0]);
    hipWheel.position.y = .045; gear(hipWheel, .042, 12, .012);
    const links = [D.coxa, D.femur, D.tibia].map((length, j) => {
      const names = ['coxa', 'femur', 'tibia'];
      const link = part(`${id}.${names[j]}`, `${label} ${names[j]} load fork`, 'Rigid leg links', `Maintains the ${length * 1000} mm pin-to-pin member.`, 'Parallel rigid rails aim between the analytic joint pins without scaling.', undefined, [l.side * (.10 + j * .05), -.02, .04]);
      rails(link, length, j === 0 ? .024 : .030); eye(link, 0, j === 0 ? .026 : .030, j === 2 ? .076 : .025);
      if (j > 0) {
        const cover = part(`${id}.${names[j]}.armor`, `${label} ${names[j]} split armor`, 'Leg armor', 'Protects the outer rail while leaving the actuator channel open.', 'Two compact curved scutes move in the rigid member frame, not in world space.', link, [l.side * .07, 0, -.06], 'Formed pale alloy shell');
        for (const side of [-1, 1]) {
          add(cover, 'sphere', 'shell', [side * .033, length * .51, -.023], [.027, length * .31, .015]);
          fasteners(cover, [[side * .035, length * .33, -.036], [side * .035, length * .70, -.036]], .005);
        }
      }
      return link;
    });
    // The actuator eye is carried by the femur in a separate +Z lane.
    for (const x of [-.030, .030]) rod(links[1], 'titanium', [x, MOUNT[1], 0], MOUNT, .008);
    eye(links[1], MOUNT[1], .018, MOUNT[2]);
    add(links[1], 'ring', 'brass', MOUNT, [.018, .018, .018]);
    const kneeWheel = part(`${id}.kneewheel`, `${label} knee reduction plate`, 'Knee actuation', 'Shows the included knee angle outside the load forks.', 'The plate is centered 76 mm behind the knee rail plane and engaged by its extended journal.', links[2], [0, 0, .07]);
    kneeWheel.position.z = .076; kneeWheel.rotation.x = Math.PI / 2; gear(kneeWheel, .036, 12, .012);
    const pad = part(`${id}.pad`, `${label} level traction pad`, 'Floor interface', 'Follows the ankle without allowing the sole below the floor.', 'A level elastomer pad carries a raised metal ankle plate and three short toe cartridges.', undefined, [l.side * .18, .015, 0], 'Rubber sole / titanium');
    add(pad, 'box', 'rubber', [0, 0, 0], [.145, D.sole * 2, .15]);
    add(pad, 'box', 'titanium', [0, .059, 0], [.10, .008, .10]);
    for (let j = 0; j < 3; j++) {
      const toe = part(`${id}.toe.${j}`, `${label} toe ${j + 1}`, 'Floor interface', 'Spreads the geometric contact across three blunt toes.', 'A small rubber shoe and protected hinge are fixed to the level ankle carrier.', pad, [(j - 1) * .035, .01, -.06], 'Rubber sole / shell toe cap');
      const x = (j - 1) * .050;
      add(toe, 'box', 'rubber', [x, -.010, -.099], [.039, .07, .076]);
      add(toe, 'sphere', 'shell', [x, .027, -.100], [.021, .014, .036]);
      add(toe, 'bolt', 'dark', [x, .045, -.081], [.009, .009, .009]);
      fasteners(toe, [[x, .041, -.109]], .0045);
    }
    const barrel = part(`${id}.barrel`, `${label} rigid lift cylinder`, 'Linear actuation', 'Guides the independently sliding fixed-length piston.', 'The barrel aims along the sampled clevis axis but remains 150 mm long.', undefined, [0, .04, .10], 'Dark sleeve / copper glands');
    add(barrel, 'cylinder', 'dark', [0, D.barrel / 2, 0], [.023, D.barrel, .023]);
    for (const y of [.009, D.barrel - .009]) {
      add(barrel, 'cylinder', 'copper', [0, y, 0], [.027, .014, .027]);
      add(barrel, 'box', 'titanium', [.027, y, 0], [.011, .025, .025]);
    }
    eye(barrel, 0, .016, .02);
    add(barrel, 'sphere', 'brass', [0, 0, 0], [.011, .011, .011]);
    const piston = part(`${id}.piston`, `${label} sliding polished rod`, 'Linear actuation', 'Takes up stroke by translating inside the fixed sleeve.', 'A 200 mm rod ends in a spherical femur-local clevis; ball ends accommodate the changing axis while both cylinders keep unit node scale.', undefined, [0, .02, .13]);
    rod(piston, 'titanium', [0, 0, 0], [0, D.piston, 0], .008);
    eye(piston, D.piston, .016, .018);
    add(piston, 'sphere', 'brass', [0, D.piston, 0], [.011, .011, .011]);
    legs.push({ hip, hipWheel, links, kneeWheel, pad, barrel, piston });
  }

  for (let i = 0; i < 2; i++) {
    const length = i ? D.neckB : D.neckA;
    const link = part(`neck.${i}.frame`, `Neck extension cartridge ${i + 1}`, 'Articulated neck', 'Changes reach by altering the included angle of two rigid links.', 'Paired rails expose the pitched neck segment between two sampled pins.', undefined, [0, .08, -.10]);
    rails(link, length, .042); eye(link, 0, .035, .075);
    const armor = part(`neck.${i}.armor`, `Neck cartridge ${i + 1} split collar`, 'Neck armor', 'Shields one side of the neck without filling its open centre.', 'Two shallow curved patches follow the rigid neck frame.', link, [.08, 0, -.05], 'Formed pale alloy shell');
    for (const x of [-.043, .043]) add(armor, 'sphere', 'shell', [x, length * .5, -.024], [.023, length * .34, .018]);
    const wheel = part(`neck.${i}.wheel`, `Neck cartridge ${i + 1} pitch wheel`, 'Neck timing', 'Displays the changing neck pitch on its offset axis.', 'The small geared plate is connected to the long neck journal behind the rail lane.', link, [0, 0, .075]);
    wheel.position.z = .075; wheel.rotation.x = Math.PI / 2; gear(wheel, .029, 12, .012);
    neck.push({ link, wheel });
  }
  const head = part('head.frame', 'Broad cranial sensor yoke', 'Sensor head', 'Carries the jaw and paired optics beyond the extending neck.', 'An open brow truss and cheek rails frame a blunt recognizable tortoise head.', undefined, [0, .09, -.13]);
  for (const side of [-1, 1]) {
    rod(head, 'titanium', [side * .065, 0, .018], [side * .075, .022, -.16], .012);
    rod(head, 'titanium', [side * .075, .022, -.16], [0, .055, -.065], .009);
  }
  rod(head, 'brass', [-.09, -.042, -.035], [.09, -.042, -.035], .010);
  const brow = part('head.brow', 'Split domed cranial brow', 'Head armor', 'Protects the sensor bridge and leaves the mouth open.', 'Two curved shell halves leave a narrow inspection seam above the head frame.', head, [0, .10, -.04], 'Formed pale alloy shell');
  for (const side of [-1, 1]) {
    add(brow, 'sphere', 'shell', [side * .041, .042, -.07], [.050, .024, .10]);
    fasteners(brow, [[side * .043, .066, -.05]], .006);
    const optic = part(`head.optic.${side}`, `${side < 0 ? 'Left' : 'Right'} cheek optic`, 'Optical sensing', 'Provides a visible lateral inspection aperture.', 'A small recessed teal lens sits outside the brow rather than replacing the head with a sphere.', head, [side * .09, .02, -.05], 'Dark bezel / optical glass');
    add(optic, 'box', 'dark', [side * .085, .023, -.101], [.031, .035, .059]);
    add(optic, 'sphere', 'lens', [side * .104, .023, -.113], [.012, .015, .020]);
  }
  const jaw = part('head.jaw', 'Hinged blunt lower beak', 'Jaw actuation', 'Opens below the upper sensor brow.', 'A U-shaped lower rail and two shell cheek patches pivot around the transverse jaw journal.', head, [0, -.10, -.08]);
  jaw.position.set(0, -.042, -.035);
  for (const side of [-1, 1]) {
    rod(jaw, 'titanium', [side * .059, 0, 0], [side * .050, 0, -.16], .008);
    add(jaw, 'sphere', 'shell', [side * .052, -.012, -.085], [.023, .012, .068]);
  }
  rod(jaw, 'dark', [-.05, 0, -.16], [.05, 0, -.16], .008);
  const tail = part('tail.frame', 'Short hinged caudal fork', 'Tail articulation', 'Follows the master phase behind the domed shell.', 'A short rigid tapered fork pivots at the rear rim without curling under the feet.', undefined, [0, .06, .13]);
  rails(tail, D.tail, .021); eye(tail, 0, .026, .03);
  const tailArmor = part('tail.armor', 'Tapered split tail scutes', 'Tail armor', 'Protects the short tail while retaining its open central slot.', 'Two progressively smaller curved patches follow the caudal fork.', tail, [.06, 0, .08], 'Formed pale alloy shell');
  for (let i = 0; i < 2; i++) for (const side of [-1, 1]) add(tailArmor, 'sphere', 'shell', [side * .021, .064 + i * .077, -.018], [.020 - i * .006, .033, .011]);

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
  function update(state = current, options = {}) {
    if (disposed) return;
    if (state?.legs && state?.neck) current = state;
    else if (Number.isFinite(state?.driveAngle)) current = poseAt(state.driveAngle, current.inputs);
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); }
    timing.forEach((node, i) => node.rotateY(current.driveAngle + i * TAU / 6));
    legs.forEach((n, i) => {
      const s = current.legs[i], points = [s.hip, s.coxa, s.knee, s.foot];
      n.hip.position.fromArray(s.hip); n.hipWheel.rotateY(current.driveAngle + s.phase * TAU);
      n.links.forEach((link, j) => aim(link, points[j], points[j + 1]));
      n.kneeWheel.rotateY(s.kneeAngle); n.pad.position.fromArray(s.foot);
      aim(n.barrel, s.actuator.a, s.actuator.b); aim(n.piston, s.actuator.rodStart, s.actuator.b);
    });
    neck.forEach((n, i) => { const s = current.neck[i]; aim(n.link, s.start, s.end); n.wheel.rotateY(s.pitch); });
    head.position.fromArray(current.head.start); head.rotation.x = current.head.pitch;
    jaw.rotation.x = -current.jaw.angle; aim(tail, current.tail.start, current.tail.end);
    kit.sync(options);
  }
  update(current);
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
