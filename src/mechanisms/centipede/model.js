import { Matrix4, Vector3 } from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, legNormal, linkFrame, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('MYRIA M24 · metachronal service train');
  const { add, rod, gear, fasteners, aim } = kit;
  const nodes = [], bodies = [], legs = [], antennae = [];
  const part = (id, name, system, purpose, how, parent, explode = [0, .08, 0], material = 'Titanium, bronze and insulated alloy') => {
    const node = kit.part({ id: `centipede.${id}`, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const box = (n, m, p, s, e = [0, 0, 0], detail = false) => add(n, 'box', m, p, s, e, detail);
  function bearing(n, y, r = .019, axis = 'z') {
    const at = d => axis === 'x' ? [d, y, 0] : [0, y, d];
    const euler = axis === 'x' ? [0, 0, -Math.PI / 2] : [Math.PI / 2, 0, 0];
    rod(n, 'titanium', at(-.030), at(.036), r * .42);
    add(n, 'cylinder', 'dark', at(0), [r, .035, r], euler);
    add(n, 'ring', 'brass', at(.026), [r, r, r], axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0]);
    add(n, 'bolt', 'dark', at(-.031), [r * .52, .010, r * .52], euler);
  }
  function member(n, length, width, rootAxis = 'z') {
    // The center torque tube spans the exact pins, independent of decorative cheeks.
    rod(n, 'brass', [0, 0, 0], [0, length, 0], .006);
    for (const s of [-1, 1]) box(n, 'titanium', [s * width, length / 2, 0], [.009, length - .014, .015]);
    box(n, 'dark', [0, length * .52, -.012], [width * 2, .016, .015]);
    bearing(n, 0, .019, rootAxis);
    // A structural distal bush survives low detail and mates with the next pin.
    add(n, 'cylinder', 'dark', [0, length, 0], [.015, .028, .015], [Math.PI / 2, 0, 0], true);
    add(n, 'ring', 'brass', [0, length, .023], [.015, .015, .015], [0, 0, 0], true);
    add(n, 'bolt', 'dark', [-width, length * .32, .012], [.0045, .004, .0045], [Math.PI / 2, 0, 0], true);
    if (length > .1) {
      box(n, 'teal', [width, length * .70, .012], [.012, .027, .005], [0, 0, 0], true);
      rod(n, 'rubber', [-width - .008, .018, -.012], [-width - .008, length - .018, -.012], .003, true);
    }
  }
  const initial = sample(0);
  for (const s of initial.modules) {
    const id = `module.${s.id}`, label = `Body module ${s.id.toString().padStart(2, '0')}`;
    const frame = part(`${id}.frame`, `${label} rigid vertebral cage`, 'Articulated spine', 'Preserves the 195 mm interval between consecutive yaw kingpins.', 'Open side rails, crossed bulkheads and a central torque tube form one rigid cartridge; position accumulates from the preceding endpoint.', undefined, [0, .025, 0]);
    rod(frame, 'brass', [0, 0, 0], [0, 0, D.pitch], .008);
    for (const q of [-1, 1]) {
      box(frame, 'titanium', [q * .098, -.012, .104], [.015, .033, .132]);
      rod(frame, 'titanium', [0, 0, .027], [q * s.width, 0, D.pitch / 2], .012);
      rod(frame, 'titanium', [q * s.width, 0, D.pitch / 2], [0, 0, .176], .010);
    }
    for (const z of [.042, .163]) box(frame, 'dark', [0, -.016, z], [.209, .029, .015]);
    fasteners(frame, [[-.098, .009, .043], [.098, .009, .163]], .005);
    const gimbal = part(`${id}.gimbal`, `${label} exposed yaw gimbal`, 'Inter-segment articulation', 'Constrains the cartridge origin while allowing the small traveling yaw command.', 'A vertical kingpin passes through two annular races; a transverse trunnion and open yoke distinguish this joint from the neighboring armor.', frame, [0, .09, -.025]);
    add(gimbal, 'cylinder', 'titanium', [0, 0, 0], [.011, .13, .011]);
    for (const y of [-.043, .043]) {
      add(gimbal, 'ring', 'brass', [0, y, 0], [.035, .035, .035], [Math.PI / 2, 0, 0], y > 0);
      box(gimbal, 'titanium', [0, y, -.020], [.085, .014, .016]);
    }
    rod(gimbal, 'titanium', [-.052, 0, 0], [.052, 0, 0], .010);
    for (const q of [-1, 1]) { box(gimbal, 'dark', [q * .042, 0, -.019], [.016, .091, .021]); add(gimbal, 'bolt', 'dark', [q * .056, 0, 0], [.019, .012, .019], [0, 0, Math.PI / 2]); }
    const stator = part(`${id}.stator`, `${label} ventral drive cartridge`, 'Distributed drive', 'Supplies the illustrative pair of leg servos beneath one armor segment.', 'A copper coil bank sits between separated bearing faces below the open spine; the motor casing does not bridge adjacent modules.', frame, [0, -.075, 0]);
    for (const y of [-.055, -.022]) add(stator, 'ring', 'dark', [0, y, .104], [.048, .048, .048], [Math.PI / 2, 0, 0]);
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4;
      box(stator, 'copper', [.043 * Math.cos(a), -.038, .104 + .043 * Math.sin(a)], [.016, .036, .015], [0, -a, 0]);
      if (j % 2 === 0) box(stator, 'titanium', [.056 * Math.cos(a), -.038, .104 + .056 * Math.sin(a)], [.009, .043, .009], [0, -a, 0], true);
    }
    const rotor = part(`${id}.rotor`, `${label} phase-indexed timing rotor`, 'Metachronal timing', 'Shows the one-sixth-cycle delay from the previous drive station.', 'A bronze wheel turns below the ventral coil bank; its off-center teal spoke makes the traveling phase visible.', frame, [0, -.12, 0]);
    rotor.position.set(0, -.070, .104); gear(rotor, .047, 10, .013); box(rotor, 'teal', [.021, -.010, 0], [.027, .005, .009]);
    const armor = part(`${id}.armor`, `${label} staggered triple scale`, 'Segmented armor', 'Protects one drive bay while exposing both articulation gaps and hip takeoffs.', 'Three shallow overlapping shell scales are staggered within this cartridge only, leaving a positive gap to every neighboring cartridge.', frame, [s.id % 2 ? .035 : -.035, .15, 0], 'Formed pale shell with titanium retainers');
    add(armor, 'sphere', 'shell', [0, .069, .104], [s.width, .034, .067]);
    for (const q of [-1, 1]) {
      add(armor, 'sphere', 'shell', [q * .111, .049, .109 + q * (s.id % 2 ? .009 : -.009)], [.064, .027, .055], [0, 0, -q * .22]);
      fasteners(armor, [[q * .107, .083, .108]], .0055);
    }
    for (let j = 0; j < 4; j++) box(armor, 'titanium', [0, .102, .058 + j * .030], [.16 - Math.abs(j - 1.5) * .022, .005, .006], [0, 0, 0], true);
    bodies.push({ frame, rotor, gimbal });
  }
  for (const s of initial.legs) {
    const id = `leg.${s.id}`, label = `Module ${s.station + 1} ${s.side < 0 ? 'port' : 'starboard'} leg`;
    const coxa = part(`${id}.coxa`, `${label} yaw outrigger`, 'Twenty-four-leg gait', 'Locates the leg outside its body cartridge using a rigid 75 mm coxa.', 'A compact fork and yaw journal provide lateral clearance before the two-link lifting mechanism.', undefined, [s.side * .055, .015, 0]); member(coxa, D.coxa, .012, 'x');
    // Body-side yaw bush, on the real cartridge rather than a solver-only normal.
    add(bodies[s.station].frame, 'cylinder', 'dark', [s.side * initial.modules[s.station].width, 0, D.pitch / 2], [.022, .040, .022], [0, 0, 0], true);
    const femur = part(`${id}.femur`, `${label} lifting fork`, 'Twenty-four-leg gait', 'Preserves the 190 mm interval from the coxa pin to the knee.', 'Open titanium cheeks surround the exact-length torque tube and leave the external knee drive visible.', undefined, [s.side * .10, .02, 0]); member(femur, D.femur, .016);
    const tibia = part(`${id}.tibia`, `${label} tapered shin`, 'Twenty-four-leg gait', 'Preserves the 265 mm interval from knee to contact shoe.', 'Two narrow rigid rails aim at the foot target without changing their cross-section or length.', undefined, [s.side * .14, .015, 0]); member(tibia, D.tibia, .012);
    const wheel = part(`${id}.wheel`, `${label} external knee reduction`, 'Joint drive', 'Makes relative femur-to-tibia flexion readable at each station.', 'The indexed bronze wheel occupies an axial lane beyond the fork cheeks; an extended pin reaches its outer cap.', femur, [0, 0, .065]);
    wheel.position.set(0, D.femur, .045); wheel.rotation.x = Math.PI / 2; gear(wheel, .026, 10, .010); box(wheel, 'teal', [.012, -.008, 0], [.017, .005, .006], [0, 0, 0], true);
    rod(femur, 'titanium', [0, D.femur, .020], [0, D.femur, .061], .006);
    const cover = part(`${id}.armor`, `${label} partial femur scale`, 'Appendage armor', 'Shields only the upper fork while retaining the segmented centipede outline.', 'A narrow formed scale follows the femur rather than hiding all three leg links inside a single slab.', femur, [0, 0, -.055], 'Pale formed shell and copper service clip');
    box(cover, 'shell', [0, .093, -.023], [.045, .100, .016]);
    box(cover, 'copper', [0, .083, -.035], [.048, .012, .007], [0, 0, 0], true);
    add(cover, 'bolt', 'dark', [0, .122, -.034], [.0045, .004, .0045], [Math.PI / 2, 0, 0], true);
    const pad = part(`${id}.pad`, `${label} level tread shoe`, 'Ground interface', 'Shows the sequential support and raised-return intervals on the datum floor.', 'A level rubber shoe follows the solved ankle; the display prescribes a gait without simulating friction, load sharing or travel.', undefined, [s.side * .17, 0, 0], 'Elastomer tread and titanium ankle saddle');
    box(pad, 'rubber', [0, 0, 0], [.066, .048, .055]); box(pad, 'titanium', [0, .025, 0], [.034, .008, .037]);
    rod(pad, 'titanium', [0, 0, -.022], [0, 0, .022], .008);
    for (const z of [-.017, .017]) box(pad, 'dark', [0, -.017, z], [.068, .009, .007], [0, 0, 0], true);
    legs.push({ coxa, femur, tibia, wheel, pad });
  }
  const head = part('head.frame', 'Tapered cephalic sensor chassis', 'Head assembly', 'Terminates the front of the articulated spine with a recognizable tapered head.', 'Three decreasing-width bulkheads and two converging rails support the segmented snout ahead of the first leg pair.', undefined, [0, .06, -.06]);
  for (let i = 0; i < 3; i++) {
    const z = -.035 - i * .060, width = .25 - i * .051;
    box(head, 'dark', [0, .006, z], [width, .054, .020]);
    fasteners(head, [[-width * .34, .039, z], [width * .34, .039, z]], .006);
  }
  for (const q of [-1, 1]) rod(head, 'titanium', [q * .11, 0, 0], [q * .055, 0, -.19], .013);
  const crown = part('head.armor', 'Three-step tapered head crown', 'Head armor', 'Protects the sensor electronics while distinguishing the head from the twelve body scales.', 'Three overlapping shell plates decrease in width toward the snout, with open side margins over the converging frame.', head, [0, .13, -.03], 'Pale shell');
  for (let i = 0; i < 3; i++) add(crown, 'sphere', 'shell', [0, .060 - i * .008, -.029 - i * .057], [.14 - i * .025, .026, .043]);
  const optic = part('head.optics', 'Bilateral recessed sensor belt', 'Head optics', 'Marks the forward end with paired arrays of luminous inspection apertures.', 'Three small lenses on each side sit in bronze-rimmed dark carriers; sensor processing is outside this demonstrator.', head, [0, .035, -.10], 'Optical teal glass, bronze and dark alloy');
  for (const q of [-1, 1]) for (let i = 0; i < 3; i++) {
    const p = [q * (.075 - i * .013), .024, -.106 - i * .025];
    add(optic, 'ring', 'brass', p, [.014, .014, .014]); add(optic, 'sphere', 'lens', [p[0], p[1], p[2] - .005], [.010, .010, .009]);
  }
  const tail = part('tail.fairing', 'Tapered terminal split tail fan', 'Tail assembly', 'Ends the rigid spine in two separated tapered rails carrying rear feelers.', 'A short three-scale tail narrows behind the final yaw pin instead of extending the body with a solid tube.', undefined, [0, .07, .10]);
  for (const q of [-1, 1]) rod(tail, 'titanium', [q * .10, 0, 0], [q * .055, .015, .15], .010);
  for (let i = 0; i < 3; i++) add(tail, 'sphere', 'shell', [0, .025, .030 + i * .046], [.10 - i * .020, .027, .034]);
  for (const s of initial.antennae) {
    const id = `antenna.${s.id}`, label = `${s.end ? 'Rear' : 'Front'} ${s.side < 0 ? 'port' : 'starboard'} feeler`;
    const root = part(`${id}.root`, `${label} articulated proximal taper`, 'Scanning feelers', 'Carries a rigid proximal whisker from the head or tail datum.', 'A bushed root and twin tapered conductor rails follow the scan angle without telescoping.', undefined, [s.side * .035, .025, s.end ? .08 : -.08]);
    const length = Math.hypot(.042, .025, .11);
    rod(root, 'titanium', [0, 0, 0], [0, length, 0], .006); bearing(root, 0, .014);
    rod(root, 'rubber', [.009, .016, 0], [.004, length - .014, 0], .003);
    const tip = part(`${id}.tip`, `${label} distal sensing needle`, 'Scanning feelers', 'Finishes the long split antenna with a slender, rigid sensing tip.', 'A second exact-length needle pivots at the proximal endpoint and ends in a luminous bead.', undefined, [s.side * .07, .035, s.end ? .13 : -.13]);
    const distal = Math.hypot(.028, .012, .10);
    rod(tip, 'titanium', [0, 0, 0], [0, distal, 0], .0035); add(tip, 'sphere', 'lens', [0, distal, 0], [.008, .008, .008]);
    add(tip, 'ring', 'brass', [0, 0, 0], [.010, .010, .010]);
    antennae.push({ root, tip });
  }
  const basis = new Matrix4(), x = new Vector3(), y = new Vector3(), z = new Vector3();
  function poseLink(node, a, b, normal) {
    const frame = linkFrame(a, b, normal);
    basis.makeBasis(x.fromArray(frame.x), y.fromArray(frame.y), z.fromArray(frame.z));
    node.position.fromArray(a); node.quaternion.setFromRotationMatrix(basis);
  }
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
  let current = initial, disposed = false;
  function update(state = current, options = {}) {
    if (disposed) return;
    if (state?.modules && state?.legs && state?.antennae) current = state;
    for (const { node, p, q } of bind) { node.position.copy(p); node.quaternion.copy(q); }
    bodies.forEach((n, i) => {
      const s = current.modules[i]; n.frame.position.fromArray(s.start); n.frame.rotation.y = s.yaw;
      n.rotor.rotation.y = s.phase * Math.PI * 2;
      // The yoke tracks the incoming cartridge; the kingpin remains coincident.
      n.gimbal.rotation.y = i ? current.modules[i - 1].yaw - s.yaw : -s.yaw;
    });
    legs.forEach((n, i) => {
      const s = current.legs[i], normal = legNormal(s.hip, s.coxa);
      poseLink(n.coxa, s.hip, s.coxa, normal); poseLink(n.femur, s.coxa, s.knee, normal); poseLink(n.tibia, s.knee, s.foot, normal);
      n.wheel.rotation.y = s.kneeAngle; n.pad.position.fromArray(s.foot);
      n.pad.rotation.y = Math.atan2(normal[0], normal[2]);
    });
    head.position.fromArray(current.head.origin); head.rotation.y = current.head.yaw;
    tail.position.fromArray(current.tail.origin); tail.rotation.y = current.tail.yaw;
    antennae.forEach((n, i) => { const s = current.antennae[i]; aim(n.root, s.base, s.elbow); aim(n.tip, s.elbow, s.tip); });
    kit.sync(options);
  }
  update();
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); } };
}
