import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { TAU, LENGTHS, RADII, ROOT_RADIUS, ROOT_HEIGHT, armId, segmentId, sample, poseAt } from './kin.js';

const HALF_PI = Math.PI / 2;
const RING_YZ = [0, HALF_PI, 0];
const RING_XZ = [HALF_PI, 0, 0];
const cylinderAxis = axis => axis === 'Z' ? [HALF_PI, 0, 0] : [0, 0, 0];
const onAxis = (axis, distance) => axis === 'Z' ? [0, 0, distance] : [0, distance, 0];

export function createModel() {
  const kit = createMechanicalKit('OCTAVIA O8 — ribbed mantle and eight curling arms');
  const { add, rod } = kit;
  const animated = [], outputs = [];
  let disposed = false, current = sample(0);
  function part(id, name, system, purpose, how, material, explode = [0, 0.15, 0]) {
    return kit.part({ id, name, system, function: purpose, how, material,
      unit: 'm', detail: 'Conceptual rigid-body anatomy; dimensions are illustrative, not manufacturing tolerances.' }, undefined, explode);
  }
  function ring(node, material, p, radius, euler = RING_XZ) {
    add(node, 'ring', material, p, [radius, radius, radius], euler);
  }
  function plateBetween(node, material, a, b, width, depth) {
    const delta = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    add(node, 'box', material, a.map((v, i) => (v + b[i]) / 2), [width, delta.length(), depth], [e.x, e.y, e.z]);
  }
  function bearings(node, axis, r, journal) {
    for (const side of [-1, 1]) {
      add(node, 'cylinder', 'brass', onAxis(axis, side * r), [journal, journal * 1.15, journal], cylinderAxis(axis));
      add(node, 'bolt', 'titanium', onAxis(axis, side * (r + journal * 0.82)), [journal * 0.69, journal * 0.5, journal * 0.69], cylinderAxis(axis), true);
    }
  }

  const keel = part('core.keel', 'Open keel and service hub', 'Structure', 'Carry the mantle above the arm plane.',
    'A central tube and annular braces leave radial output cartridges visible.', 'Titanium / dark anodized alloy', [0, -0.13, 0]);
  rod(keel, 'titanium', [0, 0.82, 0], [0, 1.60, 0], 0.052);
  for (const y of [0.86, 1.10, 1.42, 1.60]) ring(keel, 'dark', [0, y, 0], y === 1.60 ? 0.11 : 0.17);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    rod(keel, 'titanium', [0.18 * Math.cos(a), 1.06, 0.18 * Math.sin(a)], [0.37 * Math.cos(a), 1.10, 0.37 * Math.sin(a)], 0.014);
  }

  const stator = part('motor.stator', 'Sixteen-coil annular stator', 'Power', 'Illustrate the common electric prime mover.',
    'Copper windings surround the vertical rotor with an open air gap.', 'Copper / laminated steel', [0, 0.20, 0]);
  for (const y of [1.13, 1.25]) ring(stator, 'titanium', [0, y, 0], 0.19);
  for (let i = 0; i < 16; i++) {
    const a = i * TAU / 16;
    add(stator, 'box', 'copper', [0.177 * Math.cos(a), 1.19, 0.177 * Math.sin(a)], [0.039, 0.075, 0.033], [0, -a, 0]);
    add(stator, 'box', 'dark', [0.145 * Math.cos(a), 1.19, 0.145 * Math.sin(a)], [0.025, 0.098, 0.028], [0, -a, 0]);
  }
  const rotor = part('motor.rotor', 'Vertical rotor and drive shaft', 'Power', 'Turn the conical distributor at wave cadence.',
    'The rotor orientation is sampled directly from the drive angle; no accumulated rotation.', 'Titanium / permanent-magnet concept', [0, 0.27, 0]);
  add(rotor, 'cylinder', 'titanium', [0, 1.19, 0], [0.105, 0.19, 0.105]);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8;
    add(rotor, 'box', 'teal', [0.102 * Math.cos(a), 1.19, 0.102 * Math.sin(a)], [0.023, 0.125, 0.022], [0, -a, 0]);
  }

  const crown = part('drive.crown', '24-tooth conical crown', 'Transmission', 'Distribute rotation to eight radial pinions.',
    'A conical blank and sloped tooth blocks illustrate a bevel gear; the tooth surfaces are not conjugate profiles.', 'Brass / titanium hub', [0, -0.18, 0]);
  crown.position.y = 0.997;
  add(crown, 'cone', 'brass', [0, 0, 0], [0.245, 0.15, 0.245]);
  ring(crown, 'titanium', [0, -0.077, 0], 0.217);
  for (let i = 0; i < 24; i++) {
    const a = i * TAU / 24;
    add(crown, 'box', 'brass', [0.218 * Math.cos(a), -0.018, 0.218 * Math.sin(a)], [0.040, 0.045, 0.029], [0, -a, -0.57]);
  }

  for (let a = 0; a < 8; a++) {
    const theta = a * TAU / 8, radial = [Math.cos(theta), 0, Math.sin(theta)];
    const separation = [radial[0] * 0.25, -0.06, radial[2] * 0.25];
    const socket = part(`${armId(a)}.socket`, `Arm ${a + 1} radial output cartridge`, 'Transmission', 'Support a radial shaft at the arm root.',
      'The pinion turns in a stationary, ring-ended cartridge below the mantle rim.', 'Titanium / bronze bearing', separation);
    socket.position.set(ROOT_RADIUS * radial[0], ROOT_HEIGHT + 0.035, ROOT_RADIUS * radial[2]);
    socket.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...radial));
    ring(socket, 'titanium', [0, 0, 0], 0.074);
    add(socket, 'cylinder', 'dark', [0, 0, 0], [0.046, 0.057, 0.046]);
    for (const x of [-0.054, 0.054]) add(socket, 'box', 'titanium', [x, 0, 0], [0.018, 0.075, 0.035]);
    kit.fasteners(socket, [[-0.055, 0.035, 0], [0.055, 0.035, 0]], 0.007);
    const pinion = part(`${armId(a)}.pinion`, `Arm ${a + 1} twelve-tooth bevel pinion`, 'Transmission', 'Turn at twice the vertical crown speed.',
      'Its axis points radially inward; the cone and inclined teeth indicate the ninety-degree bevel layout.', 'Brass / steel shaft', separation);
    pinion.position.set(0.29 * radial[0], 0.974, 0.29 * radial[2]);
    pinion.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...radial).negate());
    add(pinion, 'cone', 'brass', [0, 0, 0], [0.064, 0.086, 0.064]);
    add(pinion, 'cylinder', 'titanium', [0, -0.065, 0], [0.018, 0.09, 0.018]);
    for (let i = 0; i < 12; i++) {
      const angle = i * TAU / 12;
      add(pinion, 'box', 'brass', [0.052 * Math.cos(angle), -0.013, 0.052 * Math.sin(angle)], [0.015, 0.035, 0.019], [0, -angle, -0.55]);
    }
    outputs.push({ node: pinion, base: pinion.quaternion.clone() });
  }

  for (let tier = 0; tier < 2; tier++) {
    const y = 1.34 + tier * 0.15;
    const bus = part(`electronics.bus.${tier + 1}`, `${tier ? 'Sensor' : 'Servo'} annular backplane`, 'Electronics',
      tier ? 'Collect optical and arm-sensor signals.' : 'Fan commands out to eight servo channels.',
      'An open annular bus carries eight radial circuit cards rather than filling the mantle.', 'Glass-fibre laminate / copper', [0, 0.30 + tier * 0.14, 0]);
    ring(bus, 'teal', [0, y, 0], tier ? 0.20 : 0.25);
    ring(bus, 'copper', [0, y + 0.012, 0], tier ? 0.13 : 0.17);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8, r = tier ? 0.195 : 0.245;
      const card = part(`electronics.${tier + 1}.channel.${i + 1}`, `${tier ? 'Sensor' : 'Motor'} channel ${i + 1}`, 'Electronics',
        `Interface with arm ${i + 1} ${tier ? 'position sensors' : 'joint commands'}.`,
        'A radial card exposes its logic package, power device, bus connector and status lamp.', 'FR-4 / copper / silicon', [Math.cos(a) * 0.08, 0.31 + tier * 0.14, Math.sin(a) * 0.08]);
      card.position.set(r * Math.cos(a), y, r * Math.sin(a)); card.rotation.y = -a;
      add(card, 'box', 'teal', [0, 0, 0], [0.11, 0.012, 0.065]);
      add(card, 'box', 'dark', [0, 0.013, 0], [0.04, 0.015, 0.035]);
      add(card, 'box', 'copper', [-0.036, 0.014, 0], [0.016, 0.018, 0.048]);
      add(card, 'box', 'titanium', [0.036, 0.015, 0], [0.017, 0.020, 0.04]);
      add(card, 'box', 'lens', [0.037, 0.027, 0.02], [0.008, 0.006, 0.008], [0, 0, 0], true);
    }
  }

  const rim = part('mantle.rim', 'Flared mantle rim and crown cap', 'Exterior armor', 'Tie twelve open armor ribs together.',
    'Thin annular lips preserve the large service openings between the ribs.', 'Ceramic-coated titanium', [0, 0.36, 0]);
  ring(rim, 'shell', [0, 1.09, 0], 0.406);
  ring(rim, 'shell', [0, 1.76, 0], 0.101);
  add(rim, 'cylinder', 'shell', [0, 1.79, 0], [0.088, 0.028, 0.088]);
  add(rim, 'bolt', 'teal', [0, 1.81, 0], [0.032, 0.021, 0.032]);
  const profile = [[0.406, 1.10], [0.428, 1.28], [0.370, 1.51], [0.243, 1.69], [0.10, 1.77]];
  for (let i = 0; i < 12; i++) {
    const angle = i * TAU / 12 + Math.PI / 12;
    const rib = part(`mantle.rib.${i + 1}`, `Mantle armor rib ${i + 1}`, 'Exterior armor', 'Define a bell-shaped, ribbed octopus mantle.',
      'Four narrow rigid armor shingles follow a curved meridian; the space between ribs remains open.', 'Ceramic-coated titanium / recessed steel retainers', [0.12 * Math.cos(angle), 0.39, 0.12 * Math.sin(angle)]);
    rib.rotation.y = -angle;
    for (let j = 0; j < profile.length - 1; j++) {
      const [r0, y0] = profile[j], [r1, y1] = profile[j + 1];
      plateBetween(rib, 'shell', [r0, y0, 0], [r1, y1, 0], 0.023, j === 3 ? 0.035 : 0.065);
      // A narrower inward stiffener is structural, so it stays opaque in x-ray.
      plateBetween(rib, 'titanium', [r0 - 0.018, y0, 0], [r1 - 0.018, y1, 0], 0.012, 0.025);
      add(rib, 'bolt', 'dark', [r0 + 0.014, y0 + 0.025, 0], [0.008, 0.012, 0.008], [0, 0, HALF_PI], true);
    }
  }
  for (const side of [-1, 1]) {
    const eye = part(`optics.${side < 0 ? 'left' : 'right'}`, `${side < 0 ? 'Left' : 'Right'} optical lens`, 'Vision',
      'Illustrate a forward-facing stereo optical pair.', 'A recessed lens sits behind a retaining ring and a dark baffle; optics do not fade with armor.',
      'Optical glass / titanium / blackened alloy', [side * 0.07, 0.15, 0.16]);
    eye.position.set(side * 0.145, 1.37, 0.423); eye.rotation.y = side * 0.17;
    ring(eye, 'shell', [0, 0, 0], 0.092, [0, 0, 0]);
    ring(eye, 'titanium', [0, 0, 0.021], 0.079, [0, 0, 0]);
    add(eye, 'cylinder', 'dark', [0, 0, 0.010], [0.077, 0.03, 0.077], RING_XZ);
    add(eye, 'cylinder', 'lens', [0, 0, 0.029], [0.061, 0.012, 0.061], RING_XZ);
    add(eye, 'cylinder', 'dark', [0, 0, 0.037], [0.023, 0.004, 0.023], RING_XZ);
  }

  for (let a = 0; a < 8; a++) for (let j = 0; j < 8; j++) {
    const id = segmentId(a, j), length = LENGTHS[j], r = RADII[j];
    const order = j % 2 === 0 ? 'ZY' : 'YZ', theta = a * TAU / 8;
    const outward = [Math.cos(theta) * (0.20 + j * 0.025), 0.015 * j, Math.sin(theta) * (0.20 + j * 0.025)];
    const label = `Arm ${a + 1} · vertebra ${j + 1}`;
    const support = part(`${id}.saddle`, `${label} upstream saddle`, 'Articulation', `Support the outer ${order[0] === 'Z' ? 'pitch' : 'yaw'} trunnions.`,
      'The fixed bearing pair remains in the upstream frame, matching the diameter axis of the outer ring.', 'Titanium / bronze', outward);
    bearings(support, order[0], r, r * 0.27);
    for (const side of [-1, 1]) {
      const p = onAxis(order[0], side * r); p[0] = -r * 0.34;
      add(support, 'box', 'titanium', p, [r * 0.70, r * 0.23, r * 0.23]);
    }
    const carrier = part(`${id}.gimbal`, `${label} outer gimbal`, 'Articulation', 'Carry the orthogonal inner bearing axis.',
      `The outer ring rotates about ${order[0]}; the inner journals lie on ${order[1]}. Ring planes are transverse to the link, not substituted for axial bearings.`, 'Titanium / bronze / servo alloy', outward.map((v, i) => v + (i === 1 ? 0.09 : 0)));
    ring(carrier, 'titanium', [0, 0, 0], r, RING_YZ);
    bearings(carrier, order[1], r * 0.76, r * 0.22);
    // Yaw drive housing belongs to its actual upstream frame.
    add(order[0] === 'Y' ? support : carrier, 'box', 'dark', [0, r * (order[0] === 'Y' ? 1.10 : 0.87), 0], [r * 0.67, r * 0.34, r * 0.52]);

    const link = part(id, `${label} cup-bearing inner vertebra`, 'Arm backbone', 'Hold one exact rigid span and two vacuum cups.',
      `A ${(length * 1000).toFixed(0)} mm open twin-rail link carries an inner ring, dorsal armor, paired cups and a pneumatic manifold. No link is stretched to animate.`,
      'Titanium / ceramic armor / elastomer / copper', outward.map((v, i) => v + (i === 1 ? -0.06 : 0)));
    ring(link, 'brass', [0, 0, 0], r * 0.76, RING_YZ);
    for (const side of [-1, 1]) {
      add(link, 'box', 'titanium', [length * 0.53, 0, side * r * 0.49], [length * 0.88, r * 0.27, r * 0.20]);
      add(link, 'bolt', 'titanium', [length * 0.72, r * 0.31, side * r * 0.49], [r * 0.12, r * 0.18, r * 0.12], [0, 0, 0], true);
    }
    add(link, 'box', 'shell', [length * 0.61, r * 0.39, 0], [length * 0.59, r * 0.16, r * 1.14]);
    add(link, 'box', 'teal', [length * 0.60, -r * 0.22, 0], [length * 0.62, r * 0.28, r * 0.36]);
    add(link, 'box', 'lens', [length * 0.61, r * 0.49, 0], [length * 0.18, 0.003, r * 0.15], [0, 0, 0], true);
    for (const side of [-1, 1]) {
      const x = length * 0.66, z = side * r * 0.54, cup = r * 0.34;
      add(link, 'box', 'copper', [x, -r * 0.28, z * 0.54], [length * 0.10, 0.008, r * 0.54]);
      add(link, 'bolt', 'brass', [x - length * 0.20, -r * 0.36, z], [r * 0.10, 0.014, r * 0.10]);
      add(link, 'cylinder', 'rubber', [x, -r * 0.51, z], [cup * 0.78, r * 0.39, cup * 0.78]);
      ring(link, 'rubber', [x, -r * 0.79, z], cup);
    }
    const tendons = [-1, 1].map(side => {
      const tendon = part(`${id}.tendon.${side < 0 ? 'flexor' : 'extensor'}`, `${label} ${side < 0 ? 'flexor' : 'extensor'} tendon`, 'Actuation',
        'Show the opposing pitch-actuator span without stretching the rigid sleeve.',
        'Both anchors come from the pitch input/output frames. The fixed 48 mm sleeve and variable exposed piston illustrate length change, not cable elasticity or force.',
        'Steel sleeve / copper-colored tendon piston', outward.map((v, i) => v + (i === 1 ? side * 0.13 : 0)));
      add(tendon, 'cylinder', 'dark', [0, 0.024, 0], [r * 0.087, 0.048, r * 0.087]);
      const piston = new THREE.Group(); piston.userData.partId = tendon.userData.partId; tendon.add(piston); piston.position.y = 0.032;
      add(piston, 'cylinder', 'copper', [0, 0.5, 0], [r * 0.048, 1, r * 0.048]);
      return { node: tendon, piston };
    });
    animated.push({ arm: a, segment: j, support, carrier, link, tendons });
  }

  // Reset ALL local transforms before every sync. The kit adds/subtracts explode
  // offsets in place; a canonical baseline prevents even sub-ULP cumulative drift.
  const rest = [];
  kit.group.traverse(node => {
    if (node.isGroup) rest.push({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() });
  });
  const spin = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
  function applyFrame(node, position, quaternion) {
    node.position.fromArray(position); node.quaternion.fromArray(quaternion);
  }
  function syncLocal(options) {
    // Kit writes node.matrixWorld into instances. Keep those matrices root-local
    // so a host-applied root transform is applied once, never twice.
    kit.group.matrixWorld.identity();
    kit.sync(options);
    kit.group.updateMatrixWorld(true);
    const planes = new Set();
    for (const mesh of kit.pickables) {
      mesh.boundingSphere = null; mesh.boundingBox = null;
      for (const plane of mesh.material.clippingPlanes || []) planes.add(plane);
    }
    for (const plane of planes) plane.setComponents(-1, 0, 0, 0).applyMatrix4(kit.group.matrixWorld);
    Object.assign(kit.stats, { components: kit.stats.instances, drawCallsEstimate: kit.stats.drawCalls, selectableGroups: kit.parts.length });
  }
  function update(state = current, options = {}) {
    if (disposed) return;
    if (state?.arms) current = state;
    else if (Number.isFinite(state?.driveAngle)) current = { ...current, ...poseAt(state.driveAngle, state.inputs || current.inputs), driveAngle: state.driveAngle };
    for (const { node, p, q, s } of rest) {
      if (node === kit.group) continue;
      node.position.copy(p); node.quaternion.copy(q); node.scale.copy(s);
    }
    crown.rotation.y = current.driveAngle; rotor.rotation.y = current.driveAngle;
    for (let a = 0; a < outputs.length; a++) {
      outputs[a].node.quaternion.copy(outputs[a].base).multiply(spin.setFromAxisAngle(yAxis, current.arms[a].outputAngle));
    }
    for (const rig of animated) {
      const s = current.arms[rig.arm].segments[rig.segment];
      applyFrame(rig.support, s.position, s.supportQuaternion);
      applyFrame(rig.carrier, s.position, s.carrierQuaternion);
      applyFrame(rig.link, s.position, s.quaternion);
      for (let k = 0; k < 2; k++) {
        const span = s.tendons[k], actuator = rig.tendons[k];
        kit.aim(actuator.node, span.start, span.end);
        actuator.piston.scale.y = span.length - 0.032;
      }
    }
    syncLocal({ explode: Math.max(0, Math.min(1, Number.isFinite(options.explode) ? options.explode : 0)),
      mode: ['solid', 'xray', 'cutaway'].includes(options.mode) ? options.mode : 'solid',
      selectedId: options.selectedId, quality: options.quality || 'balanced' });
  }
  // Build only after every primitive exists. Capture shell classification from
  // the kit itself rather than duplicating its private palette.
  update(current, { mode: 'xray' });
  for (const mesh of kit.pickables) {
    mesh.material.userData.outer = mesh.material.transparent;
    mesh.material.name = mesh.material.transparent ? 'octopus/exterior-armor' : `octopus/${mesh.material.color.getHexString()}`;
    mesh.material.forceSinglePass = true; mesh.material.clipShadows = true;
    mesh.name = `${mesh.geometry.type}/${mesh.material.name}`;
    const raycast = mesh.raycast;
    mesh.raycast = function (raycaster, hits) {
      const localHits = []; raycast.call(this, raycaster, localHits);
      for (const hit of localHits) if (!(this.material.clippingPlanes || []).some(plane => plane.distanceToPoint(hit.point) < 0)) hits.push(hit);
    };
  }
  update(current);
  return {
    group: kit.group, parts: kit.parts, stats: kit.stats, update,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() {
      if (disposed) return;
      disposed = true; kit.dispose(); kit.group.clear();
      Object.assign(kit.stats, { instances: 0, triangles: 0, drawCalls: 0, components: 0, drawCallsEstimate: 0 });
    },
  };
}
