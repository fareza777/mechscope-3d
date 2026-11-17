import * as THREE from 'three';
import { G, AXIS, J, E0, TIP0, GROUND, SERVICE_LIFT, bounded, poseAtStroke } from './kinematics.js';
import { createGeometryKit, combine, boxAt, hoseGeometry, linkGeometry, triangleCount } from './geometry.js';

const PI = Math.PI;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
const RACK_Y = G.shaftY + G.pinionR + 0.017 + 0.004;
const QUALITY = { low: 0, balanced: 1, high: 2 };
const palette = {
  ivory: [0xd9d7cd, 0.30, 0.40], orange: [0xc96839, 0.45, 0.34],
  steel: [0xb9c7c8, 0.88, 0.28], dark: [0x283b3f, 0.65, 0.40],
  brass: [0xba9655, 0.82, 0.32], rubber: [0x1a2023, 0.02, 0.86],
  pad: [0x474444, 0.12, 0.92], teal: [0x367d78, 0.65, 0.42],
};

export function createModel() {
  const group = new THREE.Group();
  group.name = 'VECTOR RG–2';
  group.userData.kinematicVisualization = 'Cessna 337-inspired one-DOF reference geometry; no force, lock, Cardan velocity, brake or flight simulation.';
  group.userData.units = 'metres';
  const parts = [], pickables = [], meshes = [], materials = new Set();
  const kit = createGeometryKit();
  const stats = { components: 0, triangles: 0, drawCallsEstimate: 0 };
  const options = { explode: 0, mode: 'solid', selectedId: null, highlight: true, quality: 'balanced' };
  const localClip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const clip = localClip.clone();
  const sectionPlanes = [];
  const transform = new THREE.Object3D();
  const direction = new THREE.Vector3();
  let quality = 'balanced', mode = 'solid', disposed = false, previousStroke = 0;

  function part(id, name, system, purpose, how, material, unit, detail) {
    if (parts.some(p => p.id === id)) throw new Error(`Duplicate landing gear part: ${id}`);
    parts.push({ id, name, system, function: purpose, how, material, unit, detail });
    return id;
  }
  function frame(name, parent = group, position = [0, 0, 0]) {
    const node = new THREE.Group(); node.name = name; node.position.fromArray(position); parent.add(node); return node;
  }
  function material(surface) {
    const [color, metalness, roughness] = palette[surface];
    const result = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    result.name = `RG–2 ${surface}`;
    result.forceSinglePass = true;
    materials.add(result);
    return result;
  }
  function finish(mesh, id, key, surface, parent, flags = {}) {
    mesh.name = id;
    mesh.userData.partId = id;
    mesh.userData.geometryKey = key;
    mesh.userData.outer = !!flags.shell;
    mesh.userData.minQuality = flags.minQuality ?? 0;
    mesh.userData.sectionPlane = flags.plane ?? clip;
    mesh.userData.baseColor = new THREE.Color(palette[surface][0]);
    mesh.castShadow = true; mesh.receiveShadow = true;
    // Parent mirroring is supported by Three's front-face handling; all instance
    // matrices themselves retain a positive determinant.
    if (mesh.isInstancedMesh) mesh.frustumCulled = false;
    const raycast = mesh.raycast;
    mesh.raycast = function clippedRaycast(raycaster, hits) {
      if (!this.visible) return;
      const first = hits.length;
      raycast.call(this, raycaster, hits);
      if (this.material.clippingPlanes) for (let i = hits.length - 1; i >= first; i--) {
        if (this.material.clippingPlanes.some(p => p.distanceToPoint(hits[i].point) < -1e-7)) hits.splice(i, 1);
      }
    };
    parent.add(mesh); meshes.push(mesh); pickables.push(mesh);
    return mesh;
  }
  function add(id, key, surface, parent, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0], flags = {}) {
    const mesh = finish(new THREE.Mesh(kit.get(key, quality), material(surface)), id, key, surface, parent, flags);
    mesh.position.fromArray(position); mesh.scale.fromArray(scale); mesh.rotation.set(...rotation);
    return mesh;
  }
  function instances(id, key, surface, parent, placements, flags = {}) {
    const mesh = finish(new THREE.InstancedMesh(kit.get(key, quality), material(surface), placements.length), id, key, surface, parent, flags);
    mesh.userData.instanceParts = placements.map(() => id);
    placements.forEach((p, i) => {
      transform.position.fromArray(p.p ?? [0, 0, 0]);
      transform.scale.fromArray(p.s ?? [1, 1, 1]);
      transform.rotation.set(...(p.r ?? [0, 0, 0]));
      if (p.q) transform.quaternion.copy(p.q);
      transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }
  function rod(id, parent, a, b, radius, surface = 'steel') {
    const delta = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const mesh = add(id, 'cylinder', surface, parent, new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(0.5).toArray(), [radius, delta.length(), radius]);
    mesh.quaternion.setFromUnitVectors(Y, delta.normalize());
    return mesh;
  }
  const ring = (id, parent, p, radius, depth, surface = 'steel', flags = {}) =>
    add(id, 'bearing', surface, parent, p, [radius, depth, radius], [0, 0, PI / 2], flags);
  const bolts = (id, parent, placements, flags = {}) => instances(id, 'socket', 'steel', parent, placements, flags);

  const ids = {
    frame: part('frame.cradle', 'Suspended service inspection cradle', 'Structure', 'Keeps the complete assembly 420 mm above its deployed ground datum.', 'Open longitudinal rails and mounting brackets carry the removable plate on two slim floor-supported posts, leaving the wheel sweep clear.', 'Painted aluminium', 'm', 'Illustrative inspection fixture, not a complete airframe. The fixed 420 mm service lift is separate from the source deployed tangent offset; neither stroke nor explosion moves the cradle.'),
    posts: part('frame.supportPosts', 'Twin cradle support posts', 'Structure', 'Carry the suspended inspection cradle without crossing the moving wheel envelope.', 'Two 30 × 40 mm posts join the broad feet to the underside of the original forward frame corners at x = ±310 mm, z = 660 mm.', 'Painted steel', 'pair', 'Fixed floor-stand additions outside the full assembled and exploded wheel sweep, also clear of the central rack and transverse shaft.'),
    feet: part('frame.feet', 'Broad cradle floor feet', 'Structure', 'Provide visible floor contact for the suspended service fixture.', 'Two 240 × 300 mm feet support the posts, with their lower faces at y = 0.', 'Painted steel', 'pair', '24 mm thick illustrative inspection-stand feet. Remain grounded and fixed in all stroke, section and explosion modes; no support-load analysis is implied.'),
    plate: part('plate.main', 'Reference mounting plate', 'Structure', 'Locates the actuator, rack guides and shaft supports.', 'The original swept planform is extruded 26 mm and carries the channel rails.', 'Painted aluminium', 'mm', 'Source plate planform retained. Separates upward by 160 mm at full explosion.'),
    rails: part('plate.rails', 'Lightened channel rails', 'Structure', 'Align the longitudinal assembly.', 'Six genuine circular openings per upright expose the rail web; short transverse feet join the plate.', 'Aluminium', 'mm', 'Reference 1.1 m rail length and 70 mm web height.'),
    bolts: part('plate.fasteners', 'Plate service fasteners', 'Fasteners', 'Identify removable mounting interfaces.', 'Recessed hex heads are instanced around the rails and wing mounts.', 'Steel', 'set', 'Selectable fastener set; no tightening torque is specified.'),
    blocks: part('shaft.blocks', 'Transverse pillow blocks', 'Transmission', 'Locate the shaft bearings beneath the plate.', 'Separate blocks surround the bearing cartridges on either side of the pinion.', 'Painted alloy', 'pair', 'Blocks follow the plate in service explosion, separating from the shaft.'),
    barrel: part('actuator.barrel', 'Hydraulic actuator barrel', 'Actuation', 'Houses the translating piston and rod.', 'A hollow barrel remains stationary while the rod, piston and rack retract aft.', 'Painted alloy cylinder', 'mm', 'Reference barrel length 460 mm. X-ray and section expose the internal piston; fluid pressure is not modeled.'),
    caps: part('actuator.caps', 'Cylinder end caps', 'Actuation', 'Close the barrel ends.', 'Annular front gland and rear cap sit on the same fixed barrel axis.', 'Dark anodized aluminium', 'pair', 'Front cap opens axially in exploded view.'),
    ties: part('actuator.tieRods', 'Cylinder tie rods', 'Fasteners', 'Show the relationship between the cylinder caps.', 'Four slender rods flank the barrel and terminate at recessed nuts.', 'Steel', 'set', 'Illustrative service detail, not source hardware dimensions.'),
    gland: part('actuator.gland', 'Rod guide and gland', 'Actuation', 'Guides the exposed rod into the barrel.', 'A narrow annular guide sits at the forward barrel end around the chrome rod.', 'Bronze / steel', 'mm', 'Withdraws axially to reveal the sealing interface.'),
    mount: part('actuator.mount', 'Rear clevis and mounting feet', 'Structure', 'Locates the actuator body on the plate.', 'Twin cheeks leave an open pin gap while two feet attach to the service plate.', 'Machined alloy', 'set', 'Rigid source assembly: no actuator-body rotation is introduced.'),
    pin: part('actuator.mountPin', 'Clevis cross-pin', 'Fasteners', 'Marks the actuator mounting axis.', 'A transverse steel pin passes through the machined rear eye.', 'Steel', 'mm', 'Withdraws laterally in service view; not a modeled lock.'),
    rod: part('actuator.rod', 'Chrome piston rod', 'Actuation', 'Connects the piston to the rack connector.', 'The rod is a fixed-length member sliding into the barrel, rather than an externally stretched decorative piston.', 'Chrome-plated steel', 'mm', 'Exposed length follows the reference rod-end station: z = 0.32 − 0.201 × stroke.'),
    piston: part('actuator.piston', 'Internal piston', 'Actuation', 'Makes the internal translation visible.', 'An opaque piston travels inside the translucent or sectioned barrel with the rod end.', 'Steel', 'mm', 'Internal piston position is an illustrative packaging addition to the reference external rod.'),
    seals: part('actuator.seals', 'Piston seal rings', 'Actuation', 'Show the piston-to-bore interface.', 'Two narrow rings travel with the internal piston.', 'Elastomer', 'pair', 'Seal squeeze, leakage and pressure are not simulated.'),
    ports: part('actuator.ports', 'Hydraulic port fittings', 'Hydraulics', 'Identify two illustrative cylinder fluid connections.', 'Small hex fittings sit above the cylinder end regions.', 'Brass', 'pair', 'Port routing is educational and is not an aircraft plumbing diagram.'),
    hoses: part('actuator.hoses', 'Hydraulic service loops', 'Hydraulics', 'Expose the connection routing above the cylinder.', 'Swept tubes connect each fitting to the local service manifold.', 'Reinforced elastomer', 'm', 'Hoses ride with the actuator during explosion. No flow is calculated.'),
    connector: part('rack.connector', 'Rod-end rack connector', 'Transmission', 'Carries rod translation down to the rack.', 'An orange connector head and vertical web bridge the actuator rod to the rack back.', 'Machined alloy', 'mm', 'The connector follows the original z station and lifts with the actuator assembly.'),
    connectorBolts: part('rack.connectorBolts', 'Connector shoulder bolts', 'Fasteners', 'Make the rod-end attachment inspectable.', 'Two recessed cross-bolts flank the connector head.', 'Steel', 'pair', 'Rigid connector detail; no independent joint motion is added.'),
    rack: part('rack.teeth', 'Module-4 toothed rack', 'Transmission', 'Converts actuator translation into shaft rotation.', 'The reference underside tooth profile meshes visually with the transverse pinion below the plate.', 'Brass-finish gear steel', 'mm', 'Nominal travel 201 mm; tooth pitch π × 4 mm. Tooth contact is illustrative, not an involute-contact solver.'),
    housing: part('rack.housing', 'Rack guide housing', 'Transmission', 'Encloses the sliding rack back and side guides.', 'A three-sided guide box leaves the underside open for the pinion teeth.', 'Painted alloy', 'mm', 'Added service enclosure. X-ray and cutaway reveal the opaque rack inside.'),
    guides: part('rack.guides', 'Rack guide inserts', 'Transmission', 'Mark the two sliding guide interfaces.', 'Bronze strips flank the rack without moving with its stroke.', 'Bronze', 'pair', 'Guide clearance is a visual allowance, not a wear or friction model.'),
    pinion: part('shaft.pinion', '32-tooth output pinion', 'Transmission', 'Turns the actuator stroke into a nominal half-turn.', 'The 64 mm pitch radius and module 4 mm define 32 teeth on the transverse shaft.', 'Brass-finish gear steel', 'deg', 'Reference 201 mm / 180° mapping retained. Exact ideal travel is 201.062 mm, a 0.062 mm nominal rounding difference.'),
    shaft: part('shaft.output', 'Transverse output shaft', 'Transmission', 'Carries the pinion rotation to the two yokes.', 'The shaft rotates around the assembly X axis by stroke × π.', 'Steel', 'deg', 'The reference commands shaft and oblique tubes together; no Cardan velocity equation is inferred.'),
    bearings: part('shaft.bearings', 'Output bearing cartridges', 'Transmission', 'Show shaft support inside the pillow blocks.', 'Annular steel races stay concentric with the shaft at x = ±110 mm.', 'Bearing steel', 'pair', 'The two races separate laterally with their retainers in service view.'),
    retainers: part('shaft.retainers', 'Bearing retainers and seals', 'Transmission', 'Expose the cartridge end interfaces.', 'Thin dark annuli surround the shaft just beyond the steel races.', 'Elastomer / steel', 'pair', 'No bearing contact mechanics are calculated.'),
  };

  const body = frame('Fixed assembly datum', group, [0, GROUND + SERVICE_LIFT, 0]);
  const plate = frame('Plate assembly', body);
  const act = frame('Actuator assembly', body);
  const connector = frame('Rod-end assembly', body);
  const rackFrame = frame('Rack assembly', body);
  const shaft = frame('Output shaft assembly', body, [0, G.shaftY, 0]);
  const bearingFrame = frame('Output bearing assembly', body, [0, G.shaftY, 0]);
  const gland = frame('Gland service extraction', act);
  const piston = frame('Piston and rod translation', act);

  kit.register('cradle', () => combine([
    ...[-1, 1].map(s => boxAt([0.026, 0.032, 1.58], [s * 0.31, 0.175, -0.10])),
    ...[-0.86, 0.66].map(z => boxAt([0.646, 0.032, 0.026], [0, 0.175, z])),
    ...[-1, 1].flatMap(s => [
      boxAt([0.026, 0.185, 0.035], [s * 0.31, 0.067, 0.08]),
      boxAt([0.026, 0.185, 0.035], [s * 0.31, 0.067, 0.20]),
      boxAt([0.13, 0.016, 0.055], [s * 0.295, -0.020, 0.14]),
    ]),
  ]));
  add(ids.frame, 'cradle', 'dark', body);
  // Forward frame corners lie beyond the entire moving side sweep (z < 0.267 m),
  // including full explosion. Even the broad feet begin at z = 0.51 m.
  const supports = frame('Grounded cradle supports');
  const footHeight = 0.024;
  const postTop = GROUND + SERVICE_LIFT + 0.175 - 0.032 / 2;
  instances(ids.posts, 'box', 'dark', supports, [-1, 1].map(s => ({
    p: [s * 0.31, (postTop + footHeight) / 2, 0.66], s: [0.030, postTop - footHeight, 0.040],
  })));
  instances(ids.feet, 'box', 'dark', supports, [-1, 1].map(s => ({
    p: [s * 0.31, footHeight / 2, 0.66], s: [0.24, footHeight, 0.30],
  })));
  add(ids.plate, 'plate', 'ivory', plate, undefined, undefined, undefined, { shell: true });
  instances(ids.rails, 'rail', 'ivory', plate, [-0.08, 0.08].map(x => ({ p: [x, 0.004, -0.12] })), { shell: true });
  instances(ids.blocks, 'machined', 'ivory', plate, [-0.11, 0.11].map(x => ({ p: [x, -0.080, 0], s: [0.05, 0.12, 0.07] })), { shell: true });
  bolts(ids.bolts, plate, [-1, 1].flatMap(s => [-0.60, -0.34, 0.1, 0.4].map(z => ({ p: [s * 0.105, 0.007, z], s: [0.008, 0.009, 0.008] }))));

  add(ids.barrel, 'tube', 'ivory', act, [0, 0.06, -0.39], [0.042, 0.46, 0.042], [PI / 2, 0, 0], { shell: true });
  add(ids.caps, 'cylinder', 'dark', act, [0, 0.06, -0.605], [0.046, 0.025, 0.046], [PI / 2, 0, 0]);
  add(ids.caps, 'bearing', 'dark', gland, [0, 0.06, -0.17], [0.046, 0.03, 0.046], [PI / 2, 0, 0]);
  add(ids.gland, 'bearing', 'brass', gland, [0, 0.06, -0.153], [0.025, 0.015, 0.025], [PI / 2, 0, 0]);
  instances(ids.ties, 'cylinder', 'steel', act, [-1, 1].flatMap(x => [-1, 1].map(y => ({ p: [x * 0.033, 0.06 + y * 0.033, -0.39], s: [0.003, 0.46, 0.003], r: [PI / 2, 0, 0] }))));
  bolts(ids.ties, gland, [-1, 1].flatMap(x => [-1, 1].map(y => ({ p: [x * 0.033, 0.06 + y * 0.033, -0.145], s: [0.005, 0.007, 0.005], r: [PI / 2, 0, 0] }))));
  kit.register('actMount', () => combine([
    boxAt([0.014, 0.07, 0.078], [-0.025, 0.038, -0.66]),
    boxAt([0.014, 0.07, 0.078], [0.025, 0.038, -0.66]),
    boxAt([0.09, 0.014, 0.075], [0, 0.005, -0.66]),
    boxAt([0.09, 0.024, 0.054], [0, 0.012, -0.19]),
  ]));
  add(ids.mount, 'actMount', 'brass', act);
  const mountPin = add(ids.pin, 'cylinder', 'steel', act, [0, 0.055, -0.66], [0.012, 0.10, 0.012], [0, 0, PI / 2]);
  add(ids.rod, 'cylinder', 'steel', piston, [0, 0.06, -0.278], [0.016, 0.556, 0.016], [PI / 2, 0, 0]);
  add(ids.piston, 'cylinder', 'brass', piston, [0, 0.06, -0.56], [0.034, 0.030, 0.034], [PI / 2, 0, 0]);
  instances(ids.seals, 'tube', 'rubber', piston, [-0.570, -0.55].map(z => ({ p: [0, 0.06, z], s: [0.035, 0.003, 0.035], r: [PI / 2, 0, 0] })));
  instances(ids.ports, 'socket', 'brass', act, [-0.55, -0.22].map(z => ({ p: [0, 0.112, z], s: [0.011, 0.026, 0.011] })));
  kit.register('hydraulicHoses', n => combine([-0.55, -0.22].map(z => hoseGeometry([
    [0, 0.124, z], [0.025, 0.165, z + 0.03], [0.065, 0.160, z + 0.08], [0.092, 0.060, z + 0.09],
  ], 0.005, n))));
  add(ids.hoses, 'hydraulicHoses', 'rubber', act);
  kit.register('connector', () => combine([
    boxAt([0.070, 0.060, 0.080], [0, 0.06, 0]),
    boxAt([0.030, 0.10, 0.050], [0, 0, 0]),
  ]));
  add(ids.connector, 'connector', 'orange', connector);
  bolts(ids.connectorBolts, connector, [-1, 1].map(s => ({ p: [s * 0.036, 0.06, 0.015], s: [0.008, 0.010, 0.008], r: [0, 0, PI / 2] })));
  const rack = add(ids.rack, 'rack', 'brass', rackFrame);
  kit.register('rackHousing', () => combine([
    boxAt([0.012, 0.051, 0.57], [-0.034, RACK_Y + 0.005, 0.017]),
    boxAt([0.012, 0.051, 0.57], [0.034, RACK_Y + 0.005, 0.017]),
    boxAt([0.080, 0.009, 0.57], [0, RACK_Y + 0.026, 0.017]),
  ]));
  add(ids.housing, 'rackHousing', 'ivory', plate, undefined, undefined, undefined, { shell: true });
  instances(ids.guides, 'box', 'brass', plate, [-1, 1].map(s => ({ p: [s * 0.0245, RACK_Y + 0.008, 0.017], s: [0.006, 0.018, 0.55] })));
  add(ids.pinion, 'pinion', 'brass', shaft);
  add(ids.shaft, 'cylinder', 'dark', shaft, undefined, [0.024, 2 * (G.jointX - 0.03), 0.024], [0, 0, PI / 2]);
  const shaftBearings = [-1, 1].map(s => {
    const node = frame(`${s < 0 ? 'Left' : 'Right'} output bearing`, bearingFrame, [s * 0.11, 0, 0]);
    ring(ids.bearings, node, [0, 0, 0], 0.034, 0.045);
    ring(ids.retainers, node, [s * 0.027, 0, 0], 0.032, 0.006, 'dark');
    return { node, sign: s };
  });

  function sideMetadata(prefix, label) {
    const p = (key, name, system, purpose, how, material, unit, detail) => part(`${prefix}.${key}`, `${label} ${name}`, system, purpose, how, material, unit, detail);
    return {
      yokeA: p('yoke.input', 'shaft-side fork', 'Transmission', 'Receives the transverse output rotation.', 'Two machined cheek plates leave an open cross-pin gap and turn about local X.', 'Orange-finish alloy', 'deg', 'Source shaft-side yoke orientation retained. Holes and removable cups are added detail.'),
      cups: p('yoke.cups', 'cross-pin bearing cups', 'Transmission', 'Expose the yoke pivot interfaces.', 'Annular cups flank the open fork and surround the cross-pin.', 'Bearing steel', 'set', 'Illustrative universal-joint construction; no independent joint solver.'),
      yokeB: p('yoke.output', 'oblique tube fork', 'Transmission', 'Connects the yoke assembly to the side tube.', 'The second fork aligns to normalized (1, −0.6, −1) before rotating around that same axis.', 'Orange-finish alloy', 'deg', 'Preserves the reference oblique-axis motion rather than substituting a planar hinge.'),
      pin: p('yoke.pin', 'yoke trunnion pin', 'Fasteners', 'Makes the rotary interface legible.', 'A transverse pin sits between the shaft-side cheeks.', 'Steel', 'mm', 'Kinematic coupling visualization, not an exact Cardan cross assembly.'),
      tube: p('tube', 'rotating side tube', 'Transmission', 'Carries the spring leg around an oblique axis.', 'The tube is aligned with the source axis and remains 300 mm long from joint to leg root.', 'Steel', 'mm', 'Turns by exactly stroke × 180°. Its orientation is not reconstructed from wheel height.'),
      stripe: p('tube.index', 'tube rotation index', 'Identification', 'Makes axial rotation visible.', 'A slim dark strip runs along the tube surface.', 'Painted steel', 'deg', 'Visual witness mark, not sensor feedback.'),
      collar: p('tube.collars', 'tube bearing collars', 'Transmission', 'Expose the tube support interfaces.', 'Two annular collars sit near the proximal and distal tube stations.', 'Bearing steel', 'pair', 'Collars travel with the reference side assembly in service view.'),
      clamp: p('leg.clamp', 'spring-leg root clamp', 'Structure', 'Connects the swept leg to the tube end.', 'A split-looking machined shoe sits at the original E0 station.', 'Orange-finish alloy', 'mm', 'The source root station is retained; clamp dimensions are visual detail.'),
      fasteners: p('leg.fasteners', 'leg and yoke fasteners', 'Fasteners', 'Identify the detachable cheeks and root clamp.', 'Socket heads are grouped into selectable service sets.', 'Steel', 'set', 'No preload or tightening procedure is implied.'),
      leg: p('leg.spring', 'swept spring leg', 'Structure', 'Carries the wheel from the tube to its deployed stance.', 'The original curved rectangular extrusion follows the reference control points.', 'Painted spring steel', 'mm', 'Nominal root-to-tip vector 500 mm. Spring deflection is not simulated.'),
      scissors: p('leg.scissors', 'scissor-shaped service restraint', 'Service detail', 'Illustrates the two-link torque-restraint form beside the axle.', 'Two pierced links and a common hinge form an open V tied to the rigid leg assembly.', 'Machined steel', 'set', 'Educational addition, not verified Cessna equipment. No oleo travel or extra suspension degree of freedom is claimed.'),
      hinge: p('leg.hinges', 'restraint hinge pins', 'Fasteners', 'Expose the three link pivot stations.', 'Pins and hex heads sit through the pierced link ends.', 'Steel', 'set', 'These pivots remain at a fixed service-restraint angle as the source rigid leg rotates.'),
      axle: p('wheel.axle', 'wheel axle and fork shoe', 'Structure', 'Locates the wheel at the source TIP0 station.', 'A lateral steel spindle passes through the brake and bearing stack.', 'Steel / dark alloy', 'mm', 'The deployed axle is parallel to X and tilts with the entire oblique assembly.'),
      tyre: p('wheel.tyre', 'grooved main tire', 'Wheel', 'Shows the wheel envelope and tread profile.', 'A closed lathed carcass contains three geometric circumferential tread grooves.', 'Rubber', 'mm', '205 mm outer radius, 135 mm width. Suspended on the service inspection cradle 420 mm above the deployed ground datum: the assembled deployed tire tangent is y = 0.420 m, not the studio floor.'),
      tread: p('wheel.shoulders', 'tire shoulder ribs', 'Wheel', 'Makes tread repetition readable at close range.', 'Small alternating raised ribs sit below the maximum tire radius.', 'Rubber', 'set', 'Optional balanced/high detail; no grip or friction claim.'),
      rim: p('wheel.rim', 'split wheel rim', 'Wheel', 'Supports the tire bead and exposes the hub interior.', 'Two dished lathed halves separate in opposite axial directions.', 'Machined aluminium', 'pair', 'X-ray affects the rim shell, leaving the brake and bearing stack opaque.'),
      bearings: p('wheel.bearings', 'wheel bearing races', 'Wheel', 'Locate the hub on the axle.', 'Concentric annular races and small rollers expose the bearing geometry.', 'Bearing steel', 'pair', 'Illustrative bearing package; wheel rolling is intentionally not driven by retraction.'),
      seals: p('wheel.seals', 'wheel bearing dust seals', 'Wheel', 'Show the bearing boundary on both faces.', 'Thin dark annuli sit just outboard of the races.', 'Elastomer', 'pair', 'Seal geometry follows its bearing during axial service extraction.'),
      hub: p('wheel.hub', 'hub sleeve and axle nut', 'Wheel', 'Shows the stationary axle-to-bearing interface.', 'A sleeve surrounds the axle and a recessed nut marks its outer end.', 'Steel', 'mm', 'No free-running wheel spin or ground speed is inferred from the cycle.'),
      wheelBolts: p('wheel.fasteners', 'rim assembly bolts', 'Fasteners', 'Expose the split-rim connection.', 'Six socket heads follow the outer rim flange.', 'Steel', 'set', 'Service visualization only, not a tire disassembly procedure.'),
      carrier: p('brake.carrier', 'brake disc carrier', 'Brake', 'Locates the annular disc beside the hub.', 'A separate central carrier mates visually with the brake rotor.', 'Steel', 'mm', 'Rigid packaging addition; no brake torque is calculated.'),
      disc: p('brake.disc', 'drilled brake disc', 'Brake', 'Makes the brake friction surface visible.', 'A true annulus with twelve through-holes sits between two pads.', 'Steel', 'mm', '8 mm illustrated rotor thickness. This is not an aircraft brake specification.'),
      pads: p('brake.pads', 'paired friction pads', 'Brake', 'Shows the two sides of the brake interface.', 'Two dark pads flank the rotor inside the open caliper.', 'Illustrative friction material', 'pair', 'No wear, heat generation or contact force is modeled.'),
      caliper: p('brake.caliper', 'open brake caliper', 'Brake', 'Surrounds the pads and exposes the piston location.', 'Two jaws and a bridge form a real opening around the disc edge.', 'Teal-finish alloy', 'mm', 'X-ray and section reveal the internal pad stack; service layout is illustrative.'),
      brakePiston: p('brake.piston', 'caliper piston', 'Brake', 'Identifies the brake actuator interface.', 'An opaque short cylinder sits behind the inboard pad.', 'Steel', 'mm', 'Static service detail. No brake pressure or piston displacement is simulated.'),
      brakeBolts: p('brake.fasteners', 'caliper bridge bolts', 'Fasteners', 'Identify the caliper jaw connections.', 'Four socket heads sit at the two jaw corners.', 'Steel', 'set', 'Selectable repeated bolt set.'),
      hose: p('brake.hose', 'leg brake hose', 'Hydraulics', 'Shows a continuous route down the rotating leg.', 'A swept hose follows the tube and curved leg to the caliper, with a short flexible terminal.', 'Reinforced elastomer', 'm', 'Illustrative route; no fluid or strain model.'),
      flex: p('brake.flex', 'yoke brake service loop', 'Hydraulics', 'Connects the fixed frame to the moving tube inlet.', 'A sampled cubic hose updates between the real fixed and rotating attachment points.', 'Reinforced elastomer', 'm', 'Endpoint-driven display curve, not an elastic-hose solver.'),
    };
  }

  kit.register('caliper', () => combine([
    boxAt([0.015, 0.071, 0.064], [-0.023, 0.084, 0]),
    boxAt([0.015, 0.071, 0.064], [0.023, 0.084, 0]),
    boxAt([0.061, 0.015, 0.064], [0, 0.119, 0]),
  ]));
  const legRoot = E0.clone().sub(J), wheelPoint = TIP0.clone().sub(J);
  const tubeQ = new THREE.Quaternion().setFromUnitVectors(Y, AXIS);
  const forkQ = new THREE.Quaternion().setFromUnitVectors(X, AXIS);
  const hoseInlet = AXIS.clone().multiplyScalar(0.07).add(new THREE.Vector3(0, 0.034, 0.023));
  const hoseEnd = wheelPoint.clone().add(new THREE.Vector3(-0.108, 0.088, -0.027));
  kit.register('legHose', n => hoseGeometry([
    hoseInlet.toArray(), AXIS.clone().multiplyScalar(0.20).add(new THREE.Vector3(0, 0.030, 0.032)).toArray(),
    legRoot.clone().add(new THREE.Vector3(0.035, 0.043, 0.035)).toArray(),
    legRoot.clone().lerp(wheelPoint, 0.52).add(new THREE.Vector3(0.072, 0.028, 0.044)).toArray(),
    hoseEnd.toArray(),
  ], 0.0045, n * 2));

  const sides = [-1, 1].map(sign => {
    const prefix = sign < 0 ? 'left' : 'right';
    const id = sideMetadata(prefix, sign < 0 ? 'Left' : 'Right');
    const side = frame(`${prefix} mirrored side`, body); side.scale.x = sign;
    const yokeA = frame(`${prefix} shaft yoke`, side, J.toArray());
    const spin = frame(`${prefix} oblique rotation`, side, J.toArray());
    const tubeEnd = frame(`${prefix} spring root`, spin, legRoot.toArray());
    const wheel = frame(`${prefix} wheel centre`, spin, wheelPoint.toArray());
    const outerRim = frame(`${prefix} outer rim extraction`, wheel);
    const innerRim = frame(`${prefix} inner rim extraction`, wheel);
    const tireFrame = frame(`${prefix} tire extraction`, wheel);
    const rotor = frame(`${prefix} rotor extraction`, wheel, [-0.088, 0, 0]);
    const brake = frame(`${prefix} caliper extraction`, wheel, [-0.088, 0, 0]);
    const outerBearing = frame(`${prefix} outer bearing extraction`, wheel, [0.032, 0, 0]);
    const innerBearing = frame(`${prefix} inner bearing extraction`, wheel, [-0.032, 0, 0]);
    const wheelPlane = new THREE.Plane();
    sectionPlanes.push({ plane: wheelPlane, node: wheel, local: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0) });
    const shell = { shell: true, plane: wheelPlane };

    add(id.yokeA, 'yoke', 'orange', yokeA);
    instances(id.cups, 'bearing', 'steel', yokeA, [-1, 1].map(s => ({ p: [-0.004, 0, s * 0.040], s: [0.017, 0.009, 0.017], r: [PI / 2, 0, 0] })));
    add(id.pin, 'cylinder', 'dark', yokeA, [-0.004, 0, 0], [0.009, 0.095, 0.009], [PI / 2, 0, 0]);
    const yokeB = add(id.yokeB, 'yoke', 'orange', spin, AXIS.clone().multiplyScalar(0.036).toArray()); yokeB.quaternion.copy(forkQ);
    const tube = add(id.tube, 'tube', 'steel', spin, AXIS.clone().multiplyScalar(0.165).toArray(), [0.024, 0.27, 0.024]); tube.quaternion.copy(tubeQ);
    const stripe = add(id.stripe, 'box', 'dark', spin, tube.position.toArray(), [0.006, G.tubeLen * 0.6, 0.049]); stripe.quaternion.copy(tubeQ);
    instances(id.collar, 'bearing', 'steel', spin, [0.085, 0.266].map(d => ({ p: AXIS.clone().multiplyScalar(d).toArray(), s: [0.031, 0.021, 0.031], q: tubeQ })));
    add(id.clamp, 'machined', 'orange', tubeEnd, undefined, [0.083, 0.070, 0.076]);
    bolts(id.fasteners, tubeEnd, [-1, 1].map(s => ({ p: [s * 0.026, 0.039, 0], s: [0.008, 0.009, 0.008] })));
    bolts(id.fasteners, yokeA, [-1, 1].map(s => ({ p: [-0.032, 0.014, s * 0.043], s: [0.006, 0.008, 0.006], r: [PI / 2, 0, 0] })));
    add(id.leg, 'springLeg', 'orange', tubeEnd);

    const anchorA = legRoot.clone().lerp(wheelPoint, 0.73).add(new THREE.Vector3(0.056, 0.007, 0));
    const anchorC = wheelPoint.clone().add(new THREE.Vector3(-0.068, 0.045, 0));
    const c = anchorC.clone(); c.z += 0.065;
    const a = anchorA.clone(); a.z = c.z;
    const b = a.clone().lerp(c, 0.48).add(new THREE.Vector3(-0.072, -0.012, 0));
    instances(id.hinge, 'cylinder', 'dark', spin, [[anchorA, a], [anchorC, c]].map(([u, v]) => ({
      p: u.clone().add(v).multiplyScalar(0.5).toArray(), s: [0.012, u.distanceTo(v), 0.012], r: [PI / 2, 0, 0],
    })));
    for (const [i, [u, v]] of [[a, b], [b, c]].entries()) {
      const length = u.distanceTo(v) + 0.028;
      const key = `scissor-${prefix}-${i}`;
      kit.register(key, n => linkGeometry(length, 0.028, 0.009, 0.006, n / 2));
      const link = add(id.scissors, key, 'steel', spin, u.clone().add(v).multiplyScalar(0.5).toArray());
      link.quaternion.setFromUnitVectors(Y, v.clone().sub(u).normalize());
    }
    instances(id.hinge, 'cylinder', 'dark', spin, [a, b, c].map(p => ({ p: p.toArray(), s: [0.006, 0.029, 0.006], r: [PI / 2, 0, 0] })));
    bolts(id.hinge, spin, [a, b, c].map(p => ({ p: p.clone().add(new THREE.Vector3(0, 0, 0.018)).toArray(), s: [0.009, 0.006, 0.009], r: [PI / 2, 0, 0] })));

    add(id.axle, 'machined', 'dark', wheel, [-0.080, 0.017, 0], [0.052, 0.09, 0.064]);
    rod(id.axle, wheel, [-0.125, 0, 0], [0.086, 0, 0], 0.019);
    add(id.tyre, 'tyre', 'rubber', tireFrame, undefined, undefined, undefined, shell);
    const shoulderPlacements = [];
    for (const face of [-1, 1]) for (let i = 0; i < 40; i++) {
      const a = i * 2 * PI / 40;
      shoulderPlacements.push({ p: [face * 0.052, 0.192 * Math.cos(a), 0.192 * Math.sin(a)], s: [0.016, 0.0025, 0.009], r: [a, 0, face * 0.20] });
    }
    instances(id.tread, 'box', 'rubber', tireFrame, shoulderPlacements, { ...shell, minQuality: 1 });
    add(id.rim, 'rim', 'steel', outerRim, undefined, undefined, undefined, shell);
    add(id.rim, 'rim', 'steel', innerRim, undefined, undefined, [0, PI, 0], shell);
    const dustSeals = [];
    for (const [node, s] of [[outerBearing, 1], [innerBearing, -1]]) {
      add(id.bearings, 'tube', 'steel', node, [0, 0, 0], [0.036, 0.019, 0.036], [0, 0, PI / 2]);
      add(id.bearings, 'tube', 'steel', node, [0, 0, 0], [0.025, 0.019, 0.025], [0, 0, PI / 2]);
      dustSeals.push({ sign: s, mesh: ring(id.seals, node, [s * 0.012, 0, 0], 0.035, 0.004, 'dark') });
      instances(id.bearings, 'cylinder', 'brass', node, Array.from({ length: 12 }, (_, i) => {
        const a = i * 2 * PI / 12;
        return { p: [0, 0.0278 * Math.cos(a), 0.0278 * Math.sin(a)], s: [0.0028, 0.017, 0.0028], r: [0, 0, PI / 2] };
      }), { minQuality: 1 });
    }
    ring(id.hub, wheel, [0, 0, 0], 0.025, 0.11, 'dark');
    add(id.hub, 'socket', 'brass', outerBearing, [0.042, 0, 0], [0.023, 0.018, 0.023], [0, 0, PI / 2]);
    bolts(id.wheelBolts, outerRim, Array.from({ length: 6 }, (_, i) => {
      const a = i * PI / 3;
      return { p: [0.040, 0.075 * Math.cos(a), 0.075 * Math.sin(a)], s: [0.008, 0.01, 0.008], r: [0, 0, PI / 2] };
    }));
    ring(id.carrier, rotor, [0.008, 0, 0], 0.056, 0.018, 'dark');
    add(id.disc, 'disc', 'steel', rotor);
    instances(id.pads, 'machined', 'pad', brake, [-1, 1].map(s => ({ p: [s * 0.010, 0.077, 0], s: [0.008, 0.052, 0.046] })));
    const caliper = add(id.caliper, 'caliper', 'teal', brake, undefined, undefined, undefined, shell);
    add(id.brakePiston, 'cylinder', 'steel', brake, [-0.017, 0.082, 0], [0.020, 0.014, 0.020], [0, 0, PI / 2]);
    bolts(id.brakeBolts, brake, [-1, 1].flatMap(s => [-1, 1].map(z => ({ p: [s * 0.034, 0.107, z * 0.022], s: [0.006, 0.008, 0.006], r: [0, 0, PI / 2] }))));
    add(id.hose, 'legHose', 'rubber', spin);
    const flex = instances(id.flex, 'wire', 'rubber', body, Array.from({ length: 24 }, () => ({ s: [0.0045, 0.01, 0.0045] })));
    flex.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const terminal = instances(id.hose, 'wire', 'rubber', spin, Array.from({ length: 12 }, () => ({ s: [0.0045, 0.01, 0.0045] })));
    terminal.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    return { sign, side, yokeA, spin, wheel, outerRim, innerRim, tireFrame, rotor, brake, outerBearing, innerBearing, dustSeals, caliper, flex, terminal };
  });

  // Hose segment buffers are updated in place; no per-frame geometry allocation.
  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3(), pd = new THREE.Vector3();
  const h0 = new THREE.Vector3(), h1 = new THREE.Vector3();
  const relative = new THREE.Matrix4(), invBody = new THREE.Matrix4(), invSpin = new THREE.Matrix4();
  function cubic(target, t) {
    const u = 1 - t;
    return target.copy(pa).multiplyScalar(u * u * u).addScaledVector(pb, 3 * u * u * t).addScaledVector(pc, 3 * u * t * t).addScaledVector(pd, t * t * t);
  }
  function fillHose(mesh) {
    cubic(h0, 0);
    for (let i = 0; i < mesh.count; i++) {
      cubic(h1, (i + 1) / mesh.count);
      direction.copy(h1).sub(h0);
      const len = direction.length();
      transform.position.copy(h0).add(h1).multiplyScalar(0.5);
      transform.scale.set(0.0045, Math.max(0.0001, len) + 0.0005, 0.0045);
      transform.quaternion.setFromUnitVectors(Y, direction.normalize());
      transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
      h0.copy(h1);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingBox = null; mesh.boundingSphere = null;
  }
  function updateHoses(e) {
    invBody.copy(body.matrixWorld).invert();
    for (const s of sides) {
      relative.multiplyMatrices(invBody, s.spin.matrixWorld);
      pa.set(s.sign * 0.155, 0.01 + 0.16 * e, 0.17);
      pd.copy(hoseInlet).applyMatrix4(relative);
      pb.copy(pa).add(new THREE.Vector3(s.sign * 0.08, 0.12, 0.025));
      pc.copy(pd).add(new THREE.Vector3(s.sign * 0.06, 0.11, 0.09));
      fillHose(s.flex);
      pa.copy(hoseEnd);
      invSpin.copy(s.spin.matrixWorld).invert();
      relative.multiplyMatrices(invSpin, s.brake.matrixWorld);
      pd.set(-0.030, 0.10, -0.028).applyMatrix4(relative);
      pb.copy(pa); pb.z += 0.04;
      pc.copy(pd); pc.z += 0.04;
      fillHose(s.terminal);
    }
  }
  function updateAppearance() {
    stats.components = 0; stats.triangles = 0; stats.drawCallsEstimate = 0;
    for (const mesh of meshes) {
      mesh.visible = mesh.userData.minQuality <= QUALITY[quality];
      const geometry = kit.get(mesh.userData.geometryKey, quality);
      if (mesh.geometry !== geometry && mesh.isInstancedMesh) {
        mesh.boundingBox = null; mesh.boundingSphere = null;
      }
      mesh.geometry = geometry;
      const m = mesh.material;
      const isShell = mesh.userData.outer;
      const transparent = mode === 'xray' && isShell;
      const clipped = mode === 'cutaway' && isShell;
      const selected = options.highlight !== false && !!options.selectedId && mesh.userData.partId === options.selectedId;
      const changed = m.transparent !== transparent || Boolean(m.clippingPlanes) !== clipped || m.side !== (clipped || transparent ? THREE.DoubleSide : THREE.FrontSide);
      m.color.copy(mesh.userData.baseColor);
      m.emissive.setHex(selected ? 0x36bcb2 : 0x000000);
      m.emissiveIntensity = selected ? 0.75 : 0;
      m.opacity = transparent ? (selected ? 0.36 : 0.12) : 1;
      m.transparent = transparent; m.depthWrite = !transparent;
      m.side = clipped || transparent ? THREE.DoubleSide : THREE.FrontSide;
      m.clippingPlanes = clipped ? [mesh.userData.sectionPlane] : null;
      m.clipShadows = clipped;
      if (changed) m.needsUpdate = true;
      mesh.castShadow = !transparent;
      mesh.renderOrder = transparent ? 2 : 0;
      if (mesh.visible) {
        const count = mesh.isInstancedMesh ? mesh.count : 1;
        stats.components += count;
        stats.triangles += triangleCount(mesh.geometry) * count;
        stats.drawCallsEstimate += 1;
      }
    }
    // Counts are submitted mesh/instance components and main colour-pass work;
    // merged subfeatures are one component. Shadow/postprocessing passes excluded.
  }
  function update(state, settings = {}) {
    if (disposed) return;
    if (state != null) previousStroke = bounded(state.stroke, 0, 0, 1);
    Object.assign(options, settings);
    quality = Object.hasOwn(QUALITY, options.quality) ? options.quality : 'balanced';
    mode = ['solid', 'xray', 'cutaway'].includes(options.mode) ? options.mode : 'solid';
    const e = bounded(options.explode, 0, 0, 1);
    const pose = poseAtStroke(previousStroke);
    body.position.set(0, GROUND + SERVICE_LIFT, 0);
    plate.position.y = 0.16 * e;
    act.position.y = 0.36 * e;
    connector.position.set(0, 0.36 * e, pose.rodEndZ);
    rackFrame.position.y = 0.06 * e;
    rack.position.set(0, RACK_Y, pose.rodEndZ - 0.02 - 0.17);
    piston.position.z = pose.rodEndZ;
    gland.position.z = 0.075 * e;
    mountPin.position.x = -0.07 * e;
    shaft.position.y = G.shaftY - 0.12 * e;
    shaft.rotation.x = pose.pinionAngle;
    bearingFrame.position.y = G.shaftY - 0.12 * e;
    for (const b of shaftBearings) b.node.position.x = b.sign * (0.11 + 0.065 * e);
    for (const s of sides) {
      s.side.position.set(0.16 * e * s.sign, -0.12 * e, 0);
      s.yokeA.rotation.x = pose.pinionAngle;
      s.spin.quaternion.setFromAxisAngle(AXIS, pose.pinionAngle);
      s.outerRim.position.x = 0.105 * e;
      s.innerRim.position.x = -0.055 * e;
      s.tireFrame.position.x = 0.045 * e;
      s.rotor.position.x = -0.088 - 0.115 * e;
      s.brake.position.x = -0.088 - 0.205 * e;
      s.outerBearing.position.x = 0.032 + 0.16 * e;
      s.innerBearing.position.x = -0.032 - 0.060 * e;
      for (const seal of s.dustSeals) seal.mesh.position.x = seal.sign * (0.012 + 0.028 * e);
      s.caliper.position.x = -0.038 * e;
    }
    group.updateWorldMatrix(true, true);
    clip.copy(localClip).applyMatrix4(body.matrixWorld);
    for (const section of sectionPlanes) section.plane.copy(section.local).applyMatrix4(section.node.matrixWorld);
    updateHoses(e);
    updateAppearance();
    group.userData.pose = { stroke: pose.stroke, rackTravel: pose.rackTravel, pinionAngle: pose.pinionAngle };
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const mesh of meshes) if (mesh.isInstancedMesh) mesh.dispose();
    kit.dispose();
    for (const m of materials) m.dispose();
    group.removeFromParent(); group.clear();
    meshes.length = 0; pickables.length = 0; materials.clear();
    stats.components = 0; stats.triangles = 0; stats.drawCallsEstimate = 0;
  }
  update({ stroke: 0 });
  return { group, update, pickables, parts, stats, dispose };
}
