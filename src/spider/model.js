import * as THREE from 'three';
import { createGeometryLibrary, triangleCount } from './geometry.js';

const PI = Math.PI;
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const HIP_Z = [0.48, 0.18, -0.18, -0.48];
const FOOT_X = [1.01, 1.18, 1.18, 1.01];
const FOOT_Z = [0.95, 0.37, -0.37, -0.95];
const QUALITY = { low: 0, balanced: 1, high: 2 };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// A static assembly pose only, not a second gait controller. All subsequent
// poses use the caller's WORLD joint points without solving or keyframing them.
function assemblyPose() {
  const legs = [];
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) {
    const hip = new THREE.Vector3(side * 0.24, 0.82, HIP_Z[row]);
    const foot = new THREE.Vector3(side * FOOT_X[row], 0, FOOT_Z[row]);
    const outward = foot.clone().sub(hip).setY(0).normalize();
    const coxa = hip.clone().addScaledVector(outward, 0.13);
    const ankle = foot.clone().add(new THREE.Vector3(0, 0.13, 0));
    const delta = ankle.clone().sub(coxa), d = delta.length();
    const axis = delta.clone().normalize();
    const a = (0.53 ** 2 - 0.66 ** 2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, 0.53 ** 2 - a * a));
    const up = Y.clone().addScaledVector(axis, -axis.y).normalize();
    const knee = coxa.clone().addScaledVector(axis, a).addScaledVector(up, h);
    legs.push({
      id: `${side < 0 ? 'L' : 'R'}${row + 1}`, side, row,
      hip: hip.toArray(), coxa: coxa.toArray(), knee: knee.toArray(),
      ankle: ankle.toArray(), foot: foot.toArray(), stance: true,
      phase: 0, joints: { yaw: 0, hip: 0, knee: 0 }, actuatorLength: 0,
    });
  }
  return { t: 0, phase: 0, body: { position: [0, 0.82, 0], roll: 0, pitch: 0 }, legs, driveAngle: 0, metrics: {} };
}

function brushedMetalFinish() {
  if (typeof document === 'undefined') return null;
  const canvases = [document.createElement('canvas'), document.createElement('canvas')];
  const contexts = canvases.map(canvas => { canvas.width = 128; canvas.height = 128; return canvas.getContext('2d'); });
  if (contexts.some(ctx => !ctx)) return null;
  const images = contexts.map(ctx => ctx.createImageData(128, 128));
  let seed = 808;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const grain = (seed >>> 24) / 255 - 0.5;
    const brush = Math.sin(y * PI / 4) * 0.6 + Math.sin(y * PI / 2) * 0.25;
    const i = (y * 128 + x) * 4, shade = 236 + brush * 10 + grain * 8;
    images[0].data.set([shade, shade, shade, 255], i);
    images[1].data.set([128 + grain * 3, 128 + brush * 9, 255, 255], i);
  }
  return canvases.map((canvas, i) => {
    contexts[i].putImageData(images[i], 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.name = i ? 'Shared brushed-metal normal' : 'Shared brushed-metal roughness';
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3, 3);
    return texture;
  });
}

function labelTexture(text, subtitle) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#172025'; ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = '#d4c2a3'; ctx.font = '700 68px monospace';
  ctx.fillText(text, 22, 78);
  ctx.fillStyle = '#7ccecb'; ctx.font = '22px monospace';
  ctx.fillText(subtitle, 24, 122);
  ctx.fillStyle = '#d4c2a3';
  for (let i = 0; i < 27; i++) ctx.fillRect(388 + i * 3.3, 94, i % 3 === 0 ? 2 : 1, 33);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

/**
 * SC-08 ARACHNE, an original eight-leg inspection chassis.
 * body.position is the absolute body centre (nominal [0, .82, 0]); pitch is
 * about X, roll about Z. Leg points are absolute metres. Angles are radians.
 * instanceParts[intersection.instanceId] takes precedence over partId.
 * driveAngle is the nominal output-cycle phase: pinions turn +3× and driven
 * wheels −1×. Drive ratios, spring travel and rotors illustrate, not simulate.
 */
export function createSpider() {
  const group = new THREE.Group();
  group.name = 'SC-08 ARACHNE';
  group.userData.model = 'SC-08 ARACHNE / articulated inspection chassis';
  group.userData.kinematicVisualization = 'Joint-point driven. Nominal 12:36 spur reduction and rotor motion illustrate transmission only; not a torque, contact, or energy simulation.';
  const parts = [], pickables = [];
  const stats = { components: 0, triangles: 0, drawCallsEstimate: 0 };
  const library = createGeometryLibrary();
  const batches = new Map(), materials = new Map(), selectedMaterials = new Map();
  const textures = [], spinners = [], rigs = new Map();
  let metalFinish;
  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  let quality = 'balanced', mode = 'solid', disposed = false;
  let previousState = assemblyPose();
  const settings = { explode: 0, mode: 'solid', selectedId: null, highlight: true, quality: 'balanced' };
  const tempMatrix = new THREE.Matrix4(), worldMatrix = new THREE.Matrix4();
  const tempPosition = new THREE.Vector3(), tempScale = new THREE.Vector3();
  const direction = new THREE.Vector3(), bx = new THREE.Vector3(), bz = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const palette = {
    titanium: [0xa7afad, 0.87, 0.36], alloy: [0xbba98c, 0.83, 0.38],
    carbon: [0x263034, 0.48, 0.54], black: [0x10191e, 0.61, 0.41],
    copper: [0xbe7850, 0.88, 0.30], chrome: [0xcbd3d2, 0.96, 0.22],
    teal: [0x267e7b, 0.69, 0.37], rubber: [0x171c1e, 0.08, 0.79],
    board: [0x164a3b, 0.25, 0.65], ceramic: [0xb1ae92, 0.18, 0.58],
    lens: [0x063f4c, 0.72, 0.12], light: [0x78e8df, 0.35, 0.30],
    amber: [0xd19444, 0.55, 0.37], label: [0xbba98c, 0.55, 0.58],
  };

  function material(key) {
    if (materials.has(key)) return materials.get(key);
    const base = key.replace(/Shell$/, '');
    const [color, metalness, roughness] = palette[base];
    const m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    m.name = `ARACHNE ${key}`;
    m.userData.outer = key.endsWith('Shell');
    m.forceSinglePass = true;
    if (['titanium', 'alloy', 'copper', 'chrome', 'teal'].includes(base)) {
      if (metalFinish === undefined) {
        metalFinish = brushedMetalFinish();
        if (metalFinish) textures.push(...metalFinish);
      }
      if (metalFinish) {
        [m.roughnessMap, m.normalMap] = metalFinish;
        m.normalScale.setScalar(base === 'chrome' ? 0.10 : 0.22);
      }
    }
    if (base === 'light' || base === 'amber') {
      m.emissive.setHex(base === 'light' ? 0x39a8a5 : 0x99511c);
      m.emissiveIntensity = base === 'light' ? 0.75 : 0.4;
    }
    if (base === 'lens') { m.emissive.setHex(0x06393f); m.emissiveIntensity = 0.22; }
    if (base === 'label') {
      const texture = labelTexture('SC-08', 'ARACHNE / FIELD SYSTEMS');
      if (texture) { m.map = texture; m.color.setHex(0xffffff); textures.push(texture); }
    }
    materials.set(key, m);
    return m;
  }

  function part(id, name, system, purpose, how, substance, unit, detail) {
    parts.push({ id, name, system, function: purpose, how, material: substance, unit, detail });
    return id;
  }

  function frame(name, parent = group, position = [0, 0, 0], rotation = [0, 0, 0]) {
    const node = new THREE.Group();
    node.name = name;
    node.position.fromArray(position);
    node.rotation.set(...rotation);
    parent.add(node);
    return node;
  }

  function add(id, geometry, surface, node, position, scale, rotation = [0, 0, 0], flags = {}) {
    const key = `${geometry}:${surface}`;
    if (!batches.has(key)) batches.set(key, { geometry, surface, items: [], mesh: null, selected: null });
    const item = {
      id, node, p: new THREE.Vector3(...position), s: new THREE.Vector3(...scale),
      q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      along: false, stretch: false, yOffset: 0, lengthBias: 0,
      minQuality: 0, enabled: true, ...flags,
    };
    batches.get(key).items.push(item);
    return item;
  }

  function strut(id, surface, node, a, b, width, depth = width, geometry = 'box', flags = {}) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
    const vector = bv.clone().sub(av);
    const item = add(id, geometry, surface, node, av.add(bv).multiplyScalar(0.5).toArray(),
      [width, vector.length(), depth], [0, 0, 0], flags);
    item.q.setFromUnitVectors(Y, vector.normalize());
    return item;
  }

  function bolt(id, node, position, radius = 0.008, rotation = [0, 0, 0], flags = {}) {
    add(id, 'socket', 'titanium', node, position, [radius, radius * 0.65, radius], rotation, flags);
  }

  function bearing(id, node, position, radius, rotation = [PI / 2, 0, 0], flags = {}) {
    add(id, 'race', 'titanium', node, position, [radius, 0.012, radius], rotation, flags);
    add(id, 'race', 'black', node, position, [radius * 0.76, 0.013, radius * 0.76], rotation, flags);
    add(id, 'cylinder', 'chrome', node, position, [radius * 0.38, 0.019, radius * 0.38], rotation, flags);
  }

  function gear(id, boltId, parent, position, radius, teeth, speed, axis = 'z', phase = 0) {
    const mount = frame(`${id} mount`, parent, position, axis === 'y' ? [-PI / 2, 0, 0] : [0, 0, 0]);
    const rotor = frame(`${id} ${teeth}T`, mount);
    const toothHeight = radius * 0.12, rootRadius = radius - toothHeight * 0.45;
    add(id, 'tube', 'alloy', rotor, [0, 0, 0], [rootRadius, 0.010, rootRadius], [PI / 2, 0, 0]);
    add(id, 'cylinder', 'black', rotor, [0, 0, 0], [radius * 0.28, 0.015, radius * 0.28], [PI / 2, 0, 0]);
    for (let i = 0; i < teeth; i++) {
      const a = i * PI * 2 / teeth;
      add(id, 'tooth', 'alloy', rotor, [Math.cos(a) * radius, Math.sin(a) * radius, 0],
        [toothHeight, 2 * PI * radius / teeth * 0.60, 0.010], [0, 0, a]);
    }
    for (let i = 0; i < 3; i++) {
      const a = i * PI * 2 / 3;
      add(id, 'box', 'alloy', rotor, [Math.cos(a) * radius * 0.47, Math.sin(a) * radius * 0.47, 0],
        [radius * 0.5, radius * 0.12, 0.008], [0, 0, a]);
    }
    bolt(boltId, rotor, [0, 0, 0.011], radius * 0.15, [PI / 2, 0, 0]);
    spinners.push({ node: rotor, speed, phase });
    return rotor;
  }

  const armorId = part('body.armor', 'Segmented dorsal armor', 'Structure',
    'Protects the electronics while leaving lateral service apertures.',
    'Overlapping chamfered panels transfer local impacts into the rib cage, not the circuit boards.',
    'Champagne anodized aluminium / charcoal composite', 'm',
    'Independent left and right scutes expose the spine between them. Explode lifts these removable panels; x-ray affects their skins only.');
  const chassisId = part('body.chassis', 'Open ladder chassis', 'Structure',
    'Carries the eight hip reactions and aligns the drivetrain.',
    'Two longitudinal spars, transverse ribs and diagonal ties form a lightweight closed load path.',
    'Brushed titanium', 'm', 'Nominal serviced body envelope: 0.62 × 0.29 × 1.34 m including optical and exhaust cartridges; centre 0.82 m above the floor.');
  const keelId = part('body.keel', 'Vented lower service cradle', 'Structure',
    'Protects cells from ground debris and supports service extraction.',
    'An open perimeter tray separates downward in exploded view without moving the leg pose.',
    'Carbon composite / titanium', 'm', 'Vent gaps are open geometry, not painted grooves.');
  const batteryId = part('body.battery', 'Ten-cell split battery pack', 'Power',
    'Provides a compact DC supply for the distributed joint drives.',
    'Cylindrical cells sit in two isolated rows with copper bus straps and mechanical retainers.',
    'Steel cells / copper busbars / polymer separators', 'V',
    'Packaging visualization only: cell chemistry, voltage and capacity are not inferred from the animation.');
  const boardId = part('body.control', 'Motion-control PCB', 'Control',
    'Coordinates joint targets and collects encoder and contact feedback.',
    'A central processor communicates with eight distributed drivers; separate copper routes illustrate power and signal paths.',
    'FR-4 / copper / silicon / ceramic', 'Hz', 'Raised ICs, capacitors, headers and real copper trace strips remain opaque in x-ray mode.');
  const rotorId = part('body.rotor', 'Spine demonstration rotor', 'Transmission',
    'Makes the nominal drive phase visible inside the chassis.',
    'A slotted rotor turns directly with state.driveAngle; it does not calculate inertia or generate the gait.',
    'Titanium hub / copper balance segments', 'rad', 'Calibrated visual phase only, not a physical flywheel simulation.');
  const shaftId = part('body.shaft', 'Longitudinal transmission spine', 'Transmission',
    'Illustrates the routing of rotary power through the central chassis.',
    'A polished shaft passes through three bearing supports with keyed couplers.',
    'Hardened stainless steel', 'rad', 'The supplied kinematics remain authoritative; this shaft is a teaching visualization.');
  const bodyGearId = part('body.gearset', '12:36 illustrative spur stage', 'Transmission',
    'Demonstrates a three-to-one speed reduction and reversed rotation.',
    'The 12-tooth motor pinion turns at +3 × driveAngle; the 36-tooth output turns at −driveAngle, one third of motor speed.',
    'Machined champagne alloy', '12:36', 'Flat spur gears have individually instanced, tapered teeth and open three-spoke webs. No torque or efficiency claim is implied.');
  const bodyBearingId = part('body.bearing', 'Spine bearing cartridges', 'Transmission',
    'Locate the shaft and reduce sliding friction.',
    'Concentric outer races, dark seals and inner hubs show how the shaft is supported.',
    'Bearing steel / elastomer', 'rad', 'Race openings and separation from the shaft are modeled geometrically.');
  const coolingId = part('body.cooling', 'Rear thermal cassette', 'Thermal',
    'Spreads heat from the controller and power electronics.',
    'Parallel metal fins expose extra surface area through an open rear grille.',
    'Anodized aluminium / copper heat spreader', '°C', 'No temperature is simulated by this model.');
  const eyesId = part('body.eyes', 'Forward stereo optical head', 'Perception',
    'Provides a notional depth-sensing view ahead of the machine.',
    'Two recessed main lenses and two auxiliary apertures sit in separately retained metal barrels.',
    'Optical glass / black anodized alloy', 'm', 'Small, low-emission lenses avoid a luminous dome. This is an optical layout, not rendered sensor data.');
  const bodyCableId = part('body.cable', 'Copper power and data loom', 'Electrical',
    'Routes power and feedback around the removable chassis modules.',
    'Bundled conductors follow the spars, with flexible service loops at the hip connectors.',
    'Copper / dark polymer insulation', 'A', 'The exposed copper finish makes the routing legible; no current is computed.');
  const bodyBoltId = part('body.bolt', 'Captive chassis fasteners', 'Fasteners',
    'Preload the joints between removable covers and structural ribs.',
    'Hexagonal socket recesses accept a driver; wider shoulders distribute clamping force.',
    'Titanium fasteners', 'N·m', 'Repeated socket heads are instanced and retain this selectable service-part identity.');
  const lightId = part('body.lights', 'Cyan status light guides', 'Control',
    'Indicate the chassis is powered without obscuring mechanical detail.',
    'Narrow emissive inserts sit in protective side channels.',
    'Polycarbonate / LED', 'state', 'No scene lights are added by the model; these are small emissive surfaces.');
  const identityId = part('body.identity', 'SC-08 identification plate', 'Identification',
    'Identifies the original ARACHNE inspection platform.',
    'A locally generated label is fixed to the forward dorsal spine.',
    'Laser-marked anodized alloy', 'SC-08', 'The label is generated offline; no network, external font or image asset is used.');

  const turbineId = part('body.turbine', 'Open ring-motor turbine', 'Transmission',
    'Makes the central motor and cooling path readable through the dorsal opening.',
    'A stationary annular stator surrounds eleven swept, pitched blades and a rotating hub at twice driveAngle.',
    'Titanium housing / copper stator / aluminium impeller', 'rad',
    'Housing, supports and windings stay fixed to the core cassette; only the internal impeller rotates. Illustrative, not a fluid or motor simulation.');
  const gillId = part('body.gills', 'Recessed lateral cooling gills', 'Thermal',
    'Admit cooling air beneath the raised thorax and abdomen scutes.',
    'Tilted metal louvers bridge open-sided collector channels; real gaps reveal the dark plenum below.',
    'Titanium louvers / anodized duct', '°C', 'The ducts remain on the core when the dorsal armor lifts. No airflow is computed.');
  const heatpipeId = part('body.heatpipes', 'Segmented heat-pipe manifold', 'Thermal',
    'Connects the thermal cassette to the rear heat-exchanger outlets.',
    'Six bent copper routes enter sleeved rear collectors behind separate, open exhaust collars.',
    'Copper / titanium collars / ceramic-lined ducts', '°C', 'Bent pipe segments, clamp sleeves and hollow outlets are geometry, not painted stripes.');
  const diagnosticsId = part('body.diagnostics', 'Recessed diagnostic light rails', 'Control',
    'Provides protected service indicators along the split dorsal spine.',
    'Individual cyan and amber light guides sit below the lips of open recessed channels.',
    'Black anodized aluminium / polycarbonate / LED', 'state', 'Static illustrative status inserts, not measured fault codes. The rails lift with the removable armor.');
  const opticsId = part('body.optics', 'Multi-element stereo lens cartridges', 'Perception',
    'Separates the two main optical paths for a notional stereo baseline.',
    'Stepped focus barrels retain recessed objective elements, annular lens edges, dark aperture stops and front locking rings.',
    'Optical glass / titanium / anodized aluminium', 'm', 'A 172 mm illustrative optical baseline; lens geometry does not synthesize camera or depth data.');

  const body = frame('Body — absolute centre');
  const core = frame('Core service cassette', body);
  const armor = frame('Removable dorsal scutes', body);
  const keel = frame('Lower cradle', body);

  for (const side of [-1, 1]) {
    add(chassisId, 'channel', 'titanium', core, [side * 0.237, -0.035, 0], [0.036, 1.08, 0.059], [PI / 2, side * PI / 2, 0]);
    add(chassisId, 'box', 'black', core, [side * 0.205, -0.066, 0], [0.016, 0.022, 1.08]);
    add(keelId, 'plate', 'carbonShell', keel, [side * 0.207, -0.100, -0.015], [0.088, 0.026, 1.05]);
    for (let row = 0; row < 4; row++) {
      const z = HIP_Z[row];
      add(chassisId, 'plate', 'titanium', core, [side * 0.235, -0.006, z], [0.113, 0.088, 0.125]);
      add(chassisId, 'box', 'black', core, [side * 0.267, 0.009, z], [0.039, 0.037, 0.080]);
      for (const end of [-1, 1]) bolt(bodyBoltId, core, [side * 0.276, 0.043, z + end * 0.04], 0.0075);
      if (row < 3) strut(chassisId, 'titanium', core,
        [side * 0.224, -0.046, z], [side * 0.15, 0.026, HIP_Z[row + 1]], 0.014);
    }
  }
  for (const z of [-0.51, -0.3, 0, 0.3, 0.52]) {
    add(chassisId, 'plate', 'titanium', core, [0, -0.076, z], [0.465, 0.023, 0.034]);
    add(keelId, 'box', 'titanium', keel, [0, -0.105, z], [0.42, 0.013, 0.023]);
    for (const side of [-1, 1]) strut(chassisId, 'titanium', core,
      [side * 0.221, -0.066, z], [side * 0.125, 0.052, z], 0.011);
  }
  const scutes = [
    [0.139, 0.105, 0.434, 0.24, 0.26], [0.167, 0.130, 0.225, 0.24, 0.225],
    [0.239, 0.100, -0.015, 0.12, 0.23], [0.150, 0.112, -0.258, 0.255, 0.255],
    [0.108, 0.075, -0.464, 0.195, 0.23],
  ];
  for (const side of [-1, 1]) {
    scutes.forEach(([x, y, z, width, length], index) => {
      const panel = frame(`Dorsal ${side < 0 ? 'left' : 'right'} scute ${index + 1}`, armor,
        [side * x, y, z], [0.06, side * 0.06, -side * (index === 2 ? 0.36 : 0.15)]);
      add(armorId, 'scute', index === 2 || index === 4 ? 'carbonShell' : 'alloyShell', panel,
        [0, 0, 0], [width, 0.082, length]);
      add(armorId, 'scute', 'titaniumShell', panel, [side * width * 0.31, -0.007, -0.012],
        [width * 0.39, 0.027, length * 0.76], [0, 0, -side * 0.30]);
      if (index !== 2) for (const end of [-1, 1]) bolt(bodyBoltId, panel,
        [side * width * 0.25, 0.025, end * length * 0.20], 0.007);
      if (index === 1 || index === 3) {
        add(lightId, 'channel', 'black', panel, [side * width * 0.47, 0.017, 0.012],
          [0.014, length * 0.45, 0.012], [-PI / 2, 0, 0]);
        add(lightId, 'box', 'light', panel, [side * width * 0.47, 0.018, 0.012],
          [0.005, 0.003, length * 0.34]);
      }
    });
    for (const [z, y, x] of [[0.265, 0.079, 0.259], [-0.285, 0.061, 0.243]]) {
      const duct = frame('Lateral gill cassette', core, [side * x, y, z], [0, 0, -side * 0.43]);
      add(gillId, 'channel', 'black', duct, [0, 0, 0], [0.066, 0.182, 0.031], [-PI / 2, 0, 0]);
      for (let i = 0; i < 5; i++) add(gillId, 'box', 'titanium', duct,
        [0, 0.012, -0.071 + i * 0.035], [0.061, 0.004, 0.019], [-0.48, 0, 0]);
      for (const end of [-1, 1]) add(gillId, 'box', 'titanium', duct,
        [0, 0.005, end * 0.091], [0.071, 0.026, 0.008]);
    }
    for (const [z, y, length] of [[0.240, 0.162, 0.084], [-0.279, 0.139, 0.112]]) {
      add(diagnosticsId, 'channel', 'black', armor, [side * 0.015, y, z], [0.012, length, 0.014], [-PI / 2, 0, 0]);
      for (let i = 0; i < 4; i++) add(diagnosticsId, 'box', i === 3 ? 'amber' : 'light', armor,
        [side * 0.015, y + 0.002, z + (i - 1.5) * length * 0.25], [0.005, 0.003, length * 0.15]);
    }
  }
  for (const [z, y, width, length] of [[0.425, 0.137, 0.101, 0.198], [0.240, 0.139, 0.067, 0.104],
    [-0.277, 0.116, 0.068, 0.153], [-0.462, 0.088, 0.056, 0.166]]) {
    add(armorId, 'scute', 'alloyShell', armor, [0, y, z], [width, 0.05, length]);
  }
  add(identityId, 'plate', 'black', armor, [0, 0.166, 0.427], [0.071, 0.006, 0.137]);
  add(identityId, 'label', 'labelShell', armor, [0, 0.170, 0.427], [0.117, 0.038, 1], [-PI / 2, 0, PI / 2]);

  // Two independently clamped rows; the central spine stays clear.
  for (const side of [-1, 1]) for (let cell = 0; cell < 5; cell++) {
    const z = -0.385 + cell * 0.145;
    add(batteryId, 'cylinder', 'black', core, [side * 0.126, -0.013, z], [0.028, 0.126, 0.028], [PI / 2, 0, 0]);
    for (const end of [-1, 1]) {
      add(batteryId, 'cylinder', 'titanium', core, [side * 0.126, -0.013, z + end * 0.062], [0.0265, 0.006, 0.0265], [PI / 2, 0, 0]);
      add(batteryId, 'box', 'copper', core, [side * 0.126, 0.016, z + end * 0.053], [0.047, 0.006, 0.024]);
    }
    add(batteryId, 'plate', 'teal', core, [side * 0.126, -0.040, z], [0.072, 0.022, 0.06]);
    add(batteryId, 'box', 'rubber', core, [side * 0.126, 0.021, z], [0.061, 0.012, 0.014]);
  }
  add(boardId, 'plate', 'board', core, [0, 0.052, 0.145], [0.357, 0.009, 0.293]);
  add(boardId, 'box', 'black', core, [0.028, 0.065, 0.132], [0.074, 0.017, 0.066]);
  add(boardId, 'plate', 'titanium', core, [0.028, 0.077, 0.132], [0.052, 0.006, 0.051]);
  for (let i = 0; i < 9; i++) {
    const x = -0.144 + i * 0.036;
    add(boardId, 'box', 'black', core, [x, 0.064, 0.244], [0.023, 0.014, 0.033]);
    add(boardId, 'box', 'ceramic', core, [x, 0.061, 0.035], [0.015, 0.007, 0.021]);
    add(boardId, 'box', 'copper', core, [x, 0.057, 0.156], [0.002, 0.0015, 0.175]);
    for (const end of [-1, 1]) add(boardId, 'box', 'titanium', core,
      [x, 0.061, 0.035 + end * 0.013], [0.012, 0.004, 0.004], [0, 0, 0], { minQuality: 1 });
  }
  for (const side of [-1, 1]) {
    add(boardId, 'box', 'black', core, [side * 0.139, 0.065, 0.145], [0.027, 0.016, 0.122]);
    for (let i = 0; i < 10; i++) add(boardId, 'box', 'alloy', core,
      [side * 0.145, 0.078, 0.096 + i * 0.01], [0.01, 0.011, 0.002], [0, 0, 0], { minQuality: 1 });
    for (const z of [0.026, 0.266]) bolt(bodyBoltId, core, [side * 0.162, 0.061, z], 0.005);
  }
  add(shaftId, 'cylinder', 'chrome', core, [0, -0.032, 0], [0.014, 1.025, 0.014], [PI / 2, 0, 0]);
  for (const z of [-0.44, -0.065, 0.454]) {
    add(shaftId, 'plate', 'black', core, [0, -0.046, z], [0.094, 0.079, 0.038]);
    bearing(bodyBearingId, core, [0, -0.027, z + 0.024], 0.031);
  }
  const spineRotor = frame('Spine rotor', core, [0, -0.025, -0.13]);
  add(rotorId, 'race', 'titanium', spineRotor, [0, 0, 0], [0.075, 0.015, 0.075], [PI / 2, 0, 0]);
  add(rotorId, 'cylinder', 'black', spineRotor, [0, 0, 0], [0.024, 0.026, 0.024], [PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const angle = i * PI / 3;
    add(rotorId, 'box', 'titanium', spineRotor, [Math.cos(angle) * 0.042, Math.sin(angle) * 0.042, 0],
      [0.047, 0.012, 0.011], [0, 0, angle]);
    add(rotorId, 'plate', 'copper', spineRotor, [Math.cos(angle) * 0.067, Math.sin(angle) * 0.067, 0],
      [0.016, 0.008, 0.021], [PI / 2, angle, 0]);
  }
  spinners.push({ node: spineRotor, speed: 1, phase: 0 });
  gear(bodyGearId, bodyBoltId, core, [0.076, -0.013, -0.34], 0.051, 36, -1);
  gear(bodyGearId, bodyBoltId, core, [0.008, -0.013, -0.34], 0.017, 12, 3, 'z', PI / 12);
  const turbineHousing = frame('Stationary ring-motor housing', core, [0, 0.128, -0.025]);
  add(turbineId, 'race', 'black', turbineHousing, [0, 0, 0], [0.151, 0.049, 0.151]);
  for (const y of [-0.023, 0.025]) add(turbineId, 'race', 'titanium', turbineHousing,
    [0, y, 0], [0.155, 0.009, 0.155]);
  add(turbineId, 'race', 'copper', turbineHousing, [0, 0.013, 0], [0.143, 0.016, 0.143]);
  for (let i = 0; i < 12; i++) {
    const a = i * PI / 6;
    add(turbineId, 'box', 'black', turbineHousing, [Math.cos(a) * 0.132, 0.014, Math.sin(a) * 0.132],
      [0.028, 0.019, 0.007], [0, -a, 0]);
  }
  for (const side of [-1, 1]) for (const end of [-1, 1]) strut(turbineId, 'titanium', core,
    [side * 0.19, 0.035, -0.025 + end * 0.13], [side * 0.117, 0.111, -0.025 + end * 0.093], 0.016, 0.023);
  for (let i = 0; i < 3; i++) {
    const a = i * PI * 2 / 3;
    strut(turbineId, 'titanium', turbineHousing, [0, -0.014, 0],
      [Math.cos(a) * 0.121, -0.014, Math.sin(a) * 0.121], 0.008, 0.012);
  }
  const turbineAxis = frame('Turbine axis', turbineHousing, [0, 0.006, 0], [-PI / 2, 0, 0]);
  const impeller = frame('Rotating turbine impeller', turbineAxis);
  add(turbineId, 'cylinder', 'black', impeller, [0, 0, 0], [0.028, 0.027, 0.028], [PI / 2, 0, 0]);
  add(turbineId, 'race', 'titanium', impeller, [0, 0, 0.014], [0.027, 0.009, 0.027], [PI / 2, 0, 0]);
  add(turbineId, 'cylinder', 'chrome', impeller, [0, 0, 0.019], [0.014, 0.009, 0.014], [PI / 2, 0, 0]);
  for (let i = 0; i < 11; i++) {
    const vane = frame('Swept impeller vane', impeller, [0, 0, 0], [0, 0, i * PI * 2 / 11]);
    add(turbineId, 'vane', 'titanium', vane, [0.067, 0, 0], [0.080, 0.018, 0.031], [PI / 2, 0, 0]);
  }
  spinners.push({ node: impeller, speed: 2, phase: 0 });

  add(coolingId, 'plate', 'copper', core, [0, 0.045, -0.448], [0.345, 0.013, 0.20]);
  for (let i = 0; i < 15; i++) add(coolingId, 'box', 'titanium', core,
    [0, 0.065, -0.539 + i * 0.0128], [0.324, 0.036, 0.004]);
  for (let i = 0; i < 7; i++) add(coolingId, 'box', 'carbonShell', armor,
    [-0.138 + i * 0.046, 0.025, -0.565], [0.021, 0.017, 0.089], [-0.25, 0, 0]);

  for (const side of [-1, 1]) {
    for (let lane = 0; lane < 3; lane++) {
      const x = 0.102 + lane * 0.021, outletX = lane === 0 ? 0.073 : 0.143;
      const outletY = lane === 0 ? 0.073 : lane === 1 ? 0.061 : 0.085;
      const path = [[side * x, 0.085, -0.174], [side * (x + 0.037), 0.115, -0.245],
        [side * (x + 0.035), 0.100, -0.40], [side * outletX, outletY, -0.507],
        [side * outletX, outletY, -0.575]];
      for (let i = 0; i < path.length - 1; i++) strut(heatpipeId, 'copper', core, path[i], path[i + 1], 0.007, 0.007, 'wire');
      strut(heatpipeId, 'alloy', core, [side * outletX, outletY, -0.542],
        [side * outletX, outletY, -0.566], 0.011, 0.011, 'tube');
    }
    for (const x of [0.073, 0.143]) {
      add(heatpipeId, 'tube', 'black', core, [side * x, 0.073, -0.581], [0.029, 0.065, 0.027], [PI / 2, 0, 0]);
      add(heatpipeId, 'tube', 'alloy', core, [side * x, 0.073, -0.596], [0.030, 0.015, 0.028], [PI / 2, 0, 0]);
      add(heatpipeId, 'race', 'titanium', core, [side * x, 0.073, -0.617], [0.028, 0.009, 0.026], [PI / 2, 0, 0]);
      add(heatpipeId, 'tube', 'copper', core, [side * x, 0.073, -0.604], [0.021, 0.017, 0.020], [PI / 2, 0, 0]);
    }
  }

  add(eyesId, 'scute', 'carbonShell', body, [0, -0.043, 0.565], [0.391, 0.119, 0.196]);
  add(eyesId, 'plate', 'black', body, [0, -0.009, 0.626], [0.311, 0.091, 0.045]);
  for (const side of [-1, 1]) {
    const x = side * 0.086;
    add(eyesId, 'scute', 'alloyShell', body, [x, -0.008, 0.65], [0.105, 0.042, 0.106], [PI / 2, 0, 0]);
    add(opticsId, 'tube', 'black', body, [x, -0.008, 0.677], [0.038, 0.063, 0.038], [PI / 2, 0, 0]);
    for (const z of [0.655, 0.674]) add(opticsId, 'tube', 'alloy', body,
      [x, -0.008, z], [0.041, 0.008, 0.041], [PI / 2, 0, 0]);
    add(opticsId, 'race', 'titanium', body, [x, -0.008, 0.710], [0.039, 0.007, 0.039], [PI / 2, 0, 0]);
    add(opticsId, 'race', 'lens', body, [x, -0.008, 0.701], [0.029, 0.005, 0.029], [PI / 2, 0, 0]);
    add(opticsId, 'cylinder', 'lens', body, [x, -0.008, 0.695], [0.022, 0.005, 0.022], [PI / 2, 0, 0]);
    add(opticsId, 'cylinder', 'black', body, [x, -0.008, 0.699], [0.010, 0.002, 0.010], [PI / 2, 0, 0]);
    add(opticsId, 'cylinder', 'lens', body, [x, -0.008, 0.701], [0.006, 0.002, 0.006], [PI / 2, 0, 0]);
    add(eyesId, 'tube', 'black', body, [side * 0.151, -0.036, 0.65], [0.013, 0.038, 0.013], [PI / 2, 0, 0]);
    add(eyesId, 'race', 'titanium', body, [side * 0.151, -0.036, 0.673], [0.013, 0.005, 0.013], [PI / 2, 0, 0]);
    add(eyesId, 'cylinder', 'lens', body, [side * 0.151, -0.036, 0.67], [0.009, 0.003, 0.009], [PI / 2, 0, 0]);
    bolt(bodyBoltId, body, [side * 0.173, 0.014, 0.636], 0.006, [PI / 2, 0, 0]);
    for (let wire = 0; wire < 3; wire++) {
      strut(bodyCableId, wire === 1 ? 'black' : 'copper', core,
        [side * (0.186 + wire * 0.007), -0.015, -0.5],
        [side * (0.186 + wire * 0.007), -0.015, 0.47], 0.003, 0.003, 'wire');
      for (let row = 0; row < 4; row++) strut(bodyCableId, 'copper', core,
        [side * 0.19, -0.015, HIP_Z[row]], [side * 0.275, 0.011 + wire * 0.007, HIP_Z[row] + 0.018], 0.0025, 0.0025, 'wire');
    }
  }

  function legMetadata(id, side, row) {
    const prefix = `${side < 0 ? 'Left' : 'Right'} ${['anterior', 'front-middle', 'rear-middle', 'posterior'][row]}`;
    const p = (suffix, name, system, purpose, how, substance, unit, detail) =>
      part(`${id}.${suffix}`, `${prefix} ${name}`, system, purpose, how, substance, unit, detail);
    return {
      hip: p('hip', 'yaw pedestal', 'Joint drive', 'Turns the complete leg about its proximal yaw axis.',
        'A vertical output cartridge couples the chassis to the coxa fork.', 'Titanium / charcoal alloy', 'rad', 'DOF 1: yaw. The supplied hip and coxa points determine its world placement.'),
      coxa: p('coxa', 'coxa clevis', 'Structure', 'Offsets the pitch joint from the body.',
        'Two cheek plates leave a real gap for the moving proximal femur and axle.', 'Titanium', '0.13 m', 'An open fork, not a solid cylinder, transfers the proximal bending load.'),
      motor: p('motor', 'brushless servo cartridge', 'Joint drive', 'Illustrates the source of rotary joint effort.',
        'A finned square stator housing surrounds a copper winding end pack and a shaft encoder.', 'Anodized alloy / copper / steel', 'rad/s', 'Rotor phase is driven by driveAngle for teaching; no electromagnetic or torque simulation is claimed.'),
      gear: p('gearset', '12:36 spur reducer', 'Transmission', 'Reduces nominal speed at the yaw cartridge.',
        'The 12-tooth driver and 36-tooth output turn at +3 and −1 times driveAngle: a 3:1 reduction with reversed rotation.', 'Champagne machined alloy', '3:1', 'Individual tapered teeth and open webs are geometry. The reduction is illustrative, not a solver constraint.'),
      bearing: p('bearing', 'joint bearing races', 'Transmission', 'Support the pitch and distal pivot axles.',
        'Concentric race and seal surfaces keep the axle aligned between the two clevis cheeks.', 'Hardened steel / elastomer seals', 'rad', 'Visible races are represented at the coxa, knee and ankle without changing the kinematic axes.'),
      femur: p('femur', 'split femur rails', 'Structure', 'Transmit load from the hip pitch joint to the knee.',
        'Separated U-section carbon rails use cross ties and end shoes, leaving open recesses and a central actuator corridor.', 'Carbon composite / titanium shoes', '0.53 m', 'DOF 2 acts at the proximal pitch pivot. Rail length always follows coxa → knee world points.'),
      knee: p('knee', 'knee drive fork', 'Joint drive', 'Articulates the lower leg relative to the femur.',
        'A lateral servo and exposed sector hardware surround an open double-shear clevis.', 'Titanium / anodized alloy / copper', 'rad', 'DOF 3. The provided knee and ankle points, not the decorative gears, determine tibia placement.'),
      piston: p('piston', 'telescopic assist damper', 'Actuation', 'Illustrates a variable-length support across the knee.',
        'A hollow barrel encloses an overlapping polished rod between femur and tibia attachment points.', 'Chrome steel / alloy barrel / polymer seal', 'm', 'Attachment positions are derived from the actual link endpoints every update. Rod overlap is retained while posed; no hydraulic pressure is inferred.'),
      tibia: p('tibia', 'split tibia spar', 'Structure', 'Carries the knee load toward the ankle.',
        'Two recessed rails surround a slender internal tension member and spaced transverse braces.', 'Charcoal composite / titanium', '0.66 m', 'The open channel geometry remains visible in solid mode; only the outer rails become transparent in x-ray.'),
      tarsus: p('tarsus', 'tarsal contact linkage', 'Suspension', 'Connects the ankle to the foot contact datum.',
        'An open miniature fork straddles a pivoted inner rod, following ankle → foot.', 'Titanium / chrome steel', '0.13 m', 'The foot datum is the ground-contact point, not the centre of the pad.'),
      foot: p('foot', 'segmented contact pad', 'Contact', 'Spreads stance loads and provides a readable floor contact.',
        'Three rubber tread blocks sit beneath an articulated carrier. A small cyan or amber insert reflects the supplied stance flag.', 'Elastomer / titanium / polymer', 'stance', 'Pad bottoms coincide with foot.y. No extra gait, floor constraint, friction or collision response is added.'),
      spring: p('spring', 'six-turn assist spring', 'Suspension', 'Illustrates compliance around the assist damper.',
        'A continuous helical wire seats around the moving barrel, separate from the piston rod.', 'Spring steel', 'N/m', 'Coil geometry follows the visual damper envelope; stiffness and spring forces are not simulated.'),
      cable: p('cable', 'flexible copper loom', 'Electrical', 'Routes power and encoder signals around the moving pivots.',
        'Three conductors sweep from the hip around the femur; a second pair follows the tibia. Short cylindrical segments form deterministic flexible bends.', 'Copper / polymer insulation', 'A', 'The service loops are recomputed from world joint points and remain opaque in x-ray.'),
      bolt: p('bolt', 'socket-head service fasteners', 'Fasteners', 'Clamp rail shoes, fork caps, gears and foot plates.',
        'Recessed hex sockets and selected annular washers show the fastening interface.', 'Titanium / stainless steel', 'N·m', 'All repeated bolts are individually raycastable instances with this leg-specific metadata ID.'),
      armor: p('armor', 'floating rail scutes', 'Structure', 'Shield exposed limb wiring without closing the structural voids.',
        'Short beveled shields sit above the rails with gaps between adjacent panels.', 'Champagne alloy / charcoal composite', 'm', 'These outer skins separate radially in exploded view and become translucent in x-ray.'),
      microactuator: p('microactuator', 'hip micro-actuator cartridge', 'Actuation', 'Packages a compact service-preload adjuster beside the yaw drive.',
        'A separate shielded housing retains a short polished plunger, guide sleeve and return fitting.', 'Anodized composite / steel / alloy', 'm', 'Illustrative service hardware follows the hip frame; it does not add a joint or change the gait.'),
      connector: p('connector', 'loom connectors and strain reliefs', 'Electrical', 'Terminates the two flexible bundles without loading their conductors at the joints.',
        'Four locking receptacles and corrugated boots align with the actual cable endpoints and their local bend directions.', 'Alloy / polymer / elastomer', 'A', 'Terminal frames are recomputed from the same cable curves, including their exploded offsets. Each leg retains its own selectable connector identity.'),
      seals: p('seals', 'knuckle dust boots and rod wiper', 'Protection', 'Shields the pitch, knee and ankle pivots and the damper rod entry.',
        'Hollow corrugated elastomer sleeves bridge the inner clevis spaces; a short wiper follows the moving barrel mouth.', 'Elastomer bellows', 'm', 'These internal boots remain opaque in x-ray. Their placement follows the supplied links and the current barrel extension.'),
      encoder: p('encoder', 'joint position encoder', 'Control', 'Provides a notional angular feedback channel.',
        'A dark code disk with radial metal marks rotates inside a fixed ring adjacent to the motor.', 'Optical polymer / aluminium', 'rad', 'Nominal rotor motion visualizes drive phase only; state.joints remains the authoritative numerical joint record.'),
    };
  }

  function makeLeg(id, side, row) {
    const ids = legMetadata(id, side, row);
    // These frames are all direct children of the untransformed model root.
    const hip = frame(`${id} world yaw`), coxa = frame(`${id} world coxa`);
    const femur = frame(`${id} world femur`), tibia = frame(`${id} world tibia`);
    const knee = frame(`${id} world knee`), tarsus = frame(`${id} world tarsus`);
    const foot = frame(`${id} world contact`), piston = frame(`${id} world assist`);
    const femurSkin = frame(`${id} femur scutes`, femur);
    const tibiaSkin = frame(`${id} tibia scutes`, tibia);
    add(ids.hip, 'plate', 'black', hip, [0, -0.022, 0], [0.137, 0.072, 0.139]);
    bearing(ids.hip, hip, [0, 0.023, 0], 0.063, [0, 0, 0]);
    gear(ids.gear, ids.bolt, hip, [0, 0.046, 0], 0.048, 36, -1, 'y');
    gear(ids.gear, ids.bolt, hip, [-0.064, 0.046, 0], 0.016, 12, 3, 'y', PI / 12);
    add(ids.motor, 'plate', 'carbonShell', hip, [-0.064, -0.007, 0], [0.077, 0.070, 0.075]);
    add(ids.motor, 'tube', 'copper', hip, [-0.064, 0.026, 0], [0.027, 0.015, 0.027]);
    for (let i = 0; i < 5; i++) add(ids.motor, 'box', 'titanium', hip,
      [-0.064, -0.034 + i * 0.012, 0], [0.086, 0.003, 0.083]);
    for (const sign of [-1, 1]) {
      add(ids.coxa, 'plate', 'titanium', coxa, [0, 0, sign * 0.042], [0.052, 0.91, 0.019], [0, 0, 0], { along: true, stretch: true });
      bolt(ids.bolt, coxa, [0, -0.28, sign * 0.054], 0.008, [sign * PI / 2, 0, 0], { along: true });
    }
    add(ids.microactuator, 'plate', 'carbonShell', hip, [-0.009, -0.025, -0.090], [0.079, 0.039, 0.041]);
    strut(ids.microactuator, 'alloy', hip, [-0.04, -0.022, -0.09], [0.025, -0.022, -0.09], 0.015, 0.015, 'tube');
    strut(ids.microactuator, 'chrome', hip, [0.018, -0.022, -0.09], [0.059, -0.022, -0.09], 0.007, 0.007, 'cylinder');
    add(ids.microactuator, 'race', 'black', hip, [0.03, -0.022, -0.09], [0.012, 0.009, 0.012], [0, 0, PI / 2]);
    add(ids.microactuator, 'plate', 'titanium', hip, [0.061, -0.022, -0.083], [0.016, 0.032, 0.030]);
    strut(ids.microactuator, 'copper', hip, [-0.031, -0.025, -0.108], [-0.045, -0.039, -0.08], 0.0035, 0.0035, 'wire');
    add(ids.coxa, 'box', 'black', coxa, [0, -0.38, 0], [0.052, 0.022, 0.076], [0, 0, 0], { along: true });
    add(ids.seals, 'boot', 'rubber', femur, [0, -0.5, 0], [0.032, 0.079, 0.032], [PI / 2, 0, 0], { along: true });
    add(ids.seals, 'boot', 'rubber', knee, [0, 0, 0], [0.030, 0.093, 0.030], [PI / 2, 0, 0]);
    add(ids.seals, 'boot', 'rubber', tibia, [0, 0.5, 0], [0.020, 0.045, 0.020], [PI / 2, 0, 0], { along: true });
    bearing(ids.bearing, femur, [0, -0.5, 0.063], 0.040, [PI / 2, 0, 0], { along: true });
    bearing(ids.bearing, femur, [0, -0.5, -0.063], 0.040, [PI / 2, 0, 0], { along: true });
    add(ids.motor, 'plate', 'carbonShell', femur, [0, -0.5, -0.095], [0.086, 0.082, 0.045], [0, 0, 0], { along: true });
    add(ids.motor, 'tube', 'copper', femur, [0, -0.5, -0.121], [0.029, 0.009, 0.029], [PI / 2, 0, 0], { along: true });
    add(ids.encoder, 'race', 'teal', femur, [0, -0.5, -0.129], [0.024, 0.006, 0.024], [PI / 2, 0, 0], { along: true });

    for (const [node, railId, skin, width, railDepth] of [
      [femur, ids.femur, femurSkin, 0.085, 0.033],
      [tibia, ids.tibia, tibiaSkin, 0.066, 0.027],
    ]) {
      for (const sign of [-1, 1]) {
        add(railId, 'channel', 'carbonShell', node, [0, 0, sign * 0.045], [width, 0.88, railDepth],
          [0, sign < 0 ? PI : 0, 0], { along: true, stretch: true });
        add(railId, 'box', 'titanium', node, [width * 0.38, 0, sign * 0.045], [0.007, 0.77, 0.008],
          [0, 0, 0], { along: true, stretch: true });
        for (const end of [-1, 1]) {
          add(railId, 'plate', 'titanium', node, [0, end * 0.405, sign * 0.045], [width + 0.012, 0.081, railDepth + 0.009],
            [0, 0, 0], { along: true });
          bolt(ids.bolt, node, [0, end * 0.405, sign * 0.071], 0.008,
            [sign * PI / 2, 0, 0], { along: true });
          add(ids.bolt, 'washer', 'black', node, [0, end * 0.405, sign * 0.066], [0.012, 0.003, 0.012],
            [PI / 2, 0, 0], { along: true, minQuality: 1 });
        }
      }
      add(railId, 'cylinder', 'chrome', node, [0, 0, 0], [0.009, 0.84, 0.009], [0, 0, 0], { along: true, stretch: true });
      for (const y of [-0.28, 0, 0.28]) {
        add(railId, 'box', 'titanium', node, [0, y, 0], [width * 0.77, 0.019, 0.108], [0, 0, 0], { along: true });
        add(ids.cable, 'plate', 'black', node, [width * 0.60, y, 0], [0.022, 0.017, 0.055], [0, 0, 0], { along: true });
        bolt(ids.bolt, node, [width * 0.6 + 0.013, y, 0], 0.005, [0, 0, -PI / 2], { along: true, minQuality: 1 });
      }
      for (const [index, y] of [-0.23, 0.04, 0.29].entries()) {
        add(ids.armor, 'plate', index === 1 ? 'alloyShell' : 'carbonShell', skin,
          [-width * 0.42, y, 0], [0.036, 0.215, 0.136], [0, 0, 0], { along: true, stretch: true });
        add(ids.armor, 'box', 'tealShell', skin,
          [-width * 0.42 - 0.02, y, 0], [0.005, 0.13, 0.015], [0, 0, 0], { along: true, stretch: true });
      }
    }

    for (const sign of [-1, 1]) {
      add(ids.knee, 'plate', 'titanium', knee, [0, -0.011, sign * 0.062], [0.105, 0.121, 0.02]);
      bearing(ids.bearing, knee, [0, 0, sign * 0.078], 0.037);
      for (const end of [-1, 1]) bolt(ids.bolt, knee, [0, end * 0.039, sign * 0.076], 0.006, [sign * PI / 2, 0, 0]);
    }
    add(ids.knee, 'plate', 'carbonShell', knee, [0.018, 0, -0.104], [0.09, 0.082, 0.037]);
    add(ids.knee, 'tube', 'copper', knee, [0.018, 0, -0.126], [0.030, 0.007, 0.030], [PI / 2, 0, 0]);
    const encoderRotor = frame(`${id} encoder rotor`, knee, [0, 0, 0.093]);
    add(ids.encoder, 'cylinder', 'black', encoderRotor, [0, 0, 0], [0.031, 0.009, 0.031], [PI / 2, 0, 0]);
    for (let mark = 0; mark < 12; mark++) {
      const a = mark * PI / 6;
      add(ids.encoder, 'box', 'alloy', encoderRotor, [0.025 * Math.cos(a), 0.025 * Math.sin(a), 0.006],
        [0.007, 0.002, 0.003], [0, 0, a]);
    }
    spinners.push({ node: encoderRotor, speed: -1, phase: row * PI / 6 });
    add(ids.encoder, 'race', 'teal', knee, [0, 0, 0.10], [0.035, 0.009, 0.035], [PI / 2, 0, 0]);
    for (let fin = 0; fin < 5; fin++) add(ids.knee, 'box', 'titanium', knee,
      [0.018, -0.033 + fin * 0.016, -0.103], [0.095, 0.003, 0.044]);

    // Double-shear damper brackets align with kin.js mounts at 23% and 37%.
    // In solid view they connect the offset piston to the actual rail; explode
    // withdraws the damper laterally while leaving its mounting shoes in place.
    for (const [node, fraction] of [[femur, -0.27], [tibia, -0.13]]) {
      add(ids.piston, 'box', 'titanium', node, [0, fraction, 0.080], [0.045, 0.018, 0.073],
        [0, 0, 0], { along: true, yOffset: -0.037 });
      for (const z of [0.077, 0.115]) add(ids.piston, 'plate', 'titanium', node,
        [0, fraction, z], [0.045, 0.070, 0.008], [0, 0, 0], { along: true, yOffset: -0.012 });
      add(ids.piston, 'cylinder', 'chrome', node, [0, fraction, 0.096], [0.007, 0.056, 0.007],
        [PI / 2, 0, 0], { along: true });
    }
    const barrel = add(ids.piston, 'tube', 'alloy', piston, [0, 0, 0], [0.022, 0.19, 0.022]);
    const rod = add(ids.piston, 'cylinder', 'chrome', piston, [0, 0, 0], [0.0105, 0.2, 0.0105]);
    const seal = add(ids.piston, 'race', 'black', piston, [0, 0, 0], [0.024, 0.012, 0.024]);
    const wiper = add(ids.seals, 'boot', 'rubber', piston, [0, 0, 0], [0.014, 0.018, 0.014]);
    const servicePort = add(ids.piston, 'tube', 'alloy', piston, [0.026, 0, 0], [0.008, 0.026, 0.008], [0, 0, PI / 2]);
    const coil = add(ids.spring, 'spring', 'titanium', piston, [0, 0, 0], [1, 1, 1]);
    const springSeats = [-1, 1].map(() => add(ids.spring, 'washer', 'teal', piston, [0, 0, 0], [0.031, 0.009, 0.031]));
    for (const end of [-1, 1]) {
      bearing(ids.piston, piston, [0, end * 0.5, 0], 0.024, [PI / 2, 0, 0], { along: true });
      bolt(ids.bolt, piston, [0, end * 0.5, 0.015], 0.007, [PI / 2, 0, 0], { along: true });
    }
    // Small thread-like annular ridges at the exposed rod end.
    for (let i = 0; i < 5; i++) add(ids.piston, 'washer', 'chrome', piston,
      [0, 0.5, 0], [0.012, 0.0015, 0.012], [0, 0, 0], { along: true, yOffset: -0.031 - i * 0.003, minQuality: 1 });

    bearing(ids.bearing, tibia, [0, 0.5, 0.041], 0.027, [PI / 2, 0, 0], { along: true });
    for (const sign of [-1, 1]) {
      add(ids.tarsus, 'plate', 'titanium', tarsus, [0, -0.055, sign * 0.026], [0.035, 0.79, 0.012],
        [0, 0, 0], { along: true, stretch: true });
      bolt(ids.bolt, tarsus, [0, -0.4, sign * 0.036], 0.007, [PI / 2, 0, 0], { along: true });
    }
    add(ids.tarsus, 'cylinder', 'chrome', tarsus, [0, 0, 0], [0.009, 0.84, 0.009], [0, 0, 0], { along: true, stretch: true });
    add(ids.foot, 'plate', 'titanium', foot, [0, 0.035, 0], [0.146, 0.022, 0.113]);
    add(ids.foot, 'plate', 'carbon', foot, [0, 0.05, 0], [0.088, 0.012, 0.074]);
    for (let tread = 0; tread < 3; tread++) {
      add(ids.foot, 'plate', 'rubber', foot, [-0.05 + tread * 0.05, 0.013, 0], [0.041, 0.026, 0.108]);
      for (const sign of [-1, 1]) add(ids.foot, 'box', 'black', foot, [-0.05 + tread * 0.05, 0.02, sign * 0.049], [0.029, 0.01, 0.009]);
    }
    for (const x of [-0.05, 0.05]) for (const z of [-0.034, 0.034]) bolt(ids.bolt, foot, [x, 0.049, z], 0.006);
    const contactLamp = add(ids.foot, 'box', 'light', foot, [0.054, 0.046, 0], [0.021, 0.005, 0.021]);
    const swingLamp = add(ids.foot, 'box', 'amber', foot, [0.054, 0.046, 0], [0.021, 0.005, 0.021]);
    const cables = [];
    for (let strand = 0; strand < 3; strand++) for (let segment = 0; segment < 10; segment++) {
      cables.push({ strand, segment, section: 0, item: add(ids.cable, 'wire', strand === 1 ? 'black' : 'copper', null,
        [0, 0, 0], [0.0032, 1, 0.0032]) });
    }
    for (let strand = 0; strand < 2; strand++) for (let segment = 0; segment < 8; segment++) {
      cables.push({ strand, segment, section: 1, item: add(ids.cable, 'wire', strand === 1 ? 'black' : 'copper', null,
        [0, 0, 0], [0.0027, 1, 0.0027]) });
    }
    const terminals = [];
    for (const section of [0, 1]) for (const end of [0, 1]) {
      const node = frame(`${id} bundle ${section} terminal ${end}`);
      add(ids.connector, 'plate', 'black', node, [0, -0.010, 0], [0.035, 0.020, 0.035]);
      add(ids.connector, 'tube', 'alloy', node, [0, 0, 0], [0.017, 0.014, 0.017]);
      add(ids.connector, 'race', 'teal', node, [0, 0.006, 0], [0.018, 0.005, 0.018]);
      add(ids.connector, 'boot', 'rubber', node, [0, 0.023, 0], [0.014, 0.028, 0.014]);
      terminals.push({ node, section, end });
    }
    const rig = { id, side, row, hip, coxa, femur, tibia, knee, tarsus, foot, piston,
      femurSkin, tibiaSkin, barrel, rod, seal, wiper, servicePort, coil, springSeats, contactLamp, swingLamp, cables, terminals,
      points: Array.from({ length: 5 }, () => new THREE.Vector3()),
      tangent: new THREE.Vector3(), outward: new THREE.Vector3(), offset: new THREE.Vector3(),
      pa: new THREE.Vector3(), pb: new THREE.Vector3(), ca: new THREE.Vector3(), cb: new THREE.Vector3(),
    };
    rigs.set(id, rig);
  }
  for (const side of [-1, 1]) for (let row = 0; row < 4; row++) makeLeg(`${side < 0 ? 'L' : 'R'}${row + 1}`, side, row);

  function makeMesh(batch, isSelection = false) {
    let m = material(batch.surface);
    if (isSelection) {
      if (!selectedMaterials.has(batch.surface)) {
        const highlighted = m.clone();
        highlighted.name = `${m.name} selected`;
        highlighted.emissive.setHex(0x32d6d0);
        highlighted.emissiveIntensity = 0.8;
        highlighted.color.lerp(new THREE.Color(0x91e3df), 0.16);
        highlighted.userData.outer = m.userData.outer;
        selectedMaterials.set(batch.surface, highlighted);
      }
      m = selectedMaterials.get(batch.surface);
    }
    const mesh = new THREE.InstancedMesh(library.tiers[quality][batch.geometry], m, batch.items.length);
    mesh.name = `${isSelection ? 'Selected ' : ''}${batch.geometry} / ${batch.surface}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.partId = batch.items[0].id;
    mesh.userData.instanceParts = [];
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.count = 0;
    const instanceRaycast = mesh.raycast;
    mesh.raycast = function raycast(raycaster, intersections) {
      if (!this.visible || this.count === 0) return;
      const start = intersections.length;
      instanceRaycast.call(this, raycaster, intersections);
      // Three's CPU raycaster does not itself respect shader clipping planes.
      if (mode === 'cutaway') for (let i = intersections.length - 1; i >= start; i--) {
        if (clipPlane.distanceToPoint(intersections[i].point) < -1e-7) intersections.splice(i, 1);
      }
    };
    group.add(mesh);
    mesh.updateWorldMatrix(false, false);
    pickables.push(mesh);
    return mesh;
  }
  for (const batch of batches.values()) batch.mesh = makeMesh(batch);

  function setLink(node, a, b, tangent) {
    direction.copy(b).sub(a);
    const length = Math.max(direction.length(), 0.00001);
    direction.multiplyScalar(1 / length);
    if (direction.lengthSq() < 0.5) direction.copy(Y);
    bx.crossVectors(direction, tangent);
    if (bx.lengthSq() < 0.000001) bx.crossVectors(direction, Math.abs(direction.y) < 0.9 ? Y : Z);
    bx.normalize();
    bz.crossVectors(bx, direction).normalize();
    basis.makeBasis(bx, direction, bz);
    node.quaternion.setFromRotationMatrix(basis);
    node.position.copy(a).add(b).multiplyScalar(0.5);
    node.userData.length = length;
  }

  function cablePoint(target, a, b, tangent, outward, t, strand, section, explode) {
    const arch = Math.sin(t * PI);
    target.lerpVectors(a, b, t);
    target.addScaledVector(tangent, (section ? -0.065 : 0.084) + strand * 0.007 + explode * 0.025);
    target.addScaledVector(outward, arch * (section ? 0.025 : 0.065));
    target.y += arch * (section ? 0.022 : 0.063);
    return target;
  }

  function poseLeg(rig, state, explode) {
    const { points, tangent, outward, offset, pa, pb } = rig;
    for (let i = 0; i < 5; i++) points[i].fromArray(state[['hip', 'coxa', 'knee', 'ankle', 'foot'][i]]);
    const [hip, coxa, knee, ankle, foot] = points;
    outward.copy(foot).sub(hip).setY(0);
    if (outward.lengthSq() < 0.000001) outward.set(rig.side, 0, 0);
    outward.normalize();
    tangent.crossVectors(outward, Y).normalize();
    offset.copy(outward).multiplyScalar(explode * 0.23);
    offset.y = explode * (0.028 + (rig.row % 2) * 0.015);
    for (const p of points) p.add(offset);
    basis.makeBasis(outward, Y, tangent);
    rig.hip.quaternion.setFromRotationMatrix(basis);
    rig.hip.position.copy(hip);
    setLink(rig.coxa, hip, coxa, tangent);
    setLink(rig.femur, coxa, knee, tangent);
    setLink(rig.tibia, knee, ankle, tangent);
    setLink(rig.tarsus, ankle, foot, tangent);
    rig.knee.position.copy(knee);
    rig.knee.quaternion.copy(rig.femur.quaternion);
    rig.foot.position.copy(foot);
    rig.foot.quaternion.copy(rig.hip.quaternion);
    rig.femurSkin.userData.length = rig.femur.userData.length;
    rig.tibiaSkin.userData.length = rig.tibia.userData.length;
    rig.femurSkin.position.set(-explode * 0.095, 0, 0);
    rig.tibiaSkin.position.set(-explode * 0.095, 0, 0);
    pa.lerpVectors(coxa, knee, 0.23).addScaledVector(tangent, 0.096 + explode * 0.12);
    pb.lerpVectors(knee, ankle, 0.37).addScaledVector(tangent, 0.096 + explode * 0.12);
    setLink(rig.piston, pa, pb, tangent);
    const length = rig.piston.userData.length;
    const barrelLength = Math.min(0.195, length * 0.60);
    rig.barrel.p.y = -length / 2 + barrelLength / 2;
    rig.barrel.s.y = barrelLength;
    rig.rod.p.y = barrelLength / 2 - 0.014;
    rig.rod.s.y = Math.max(0.012, length - barrelLength + 0.028);
    rig.seal.p.y = -length / 2 + barrelLength;
    rig.wiper.p.y = rig.seal.p.y + 0.011;
    rig.servicePort.p.y = -length / 2 + Math.min(0.035, barrelLength * 0.3);
    rig.coil.p.y = rig.barrel.p.y;
    rig.coil.s.y = Math.max(0.02, barrelLength - 0.018) / 0.20;
    for (let i = 0; i < 2; i++) rig.springSeats[i].p.y = -length / 2 + (i ? barrelLength - 0.005 : 0.005);
    rig.contactLamp.enabled = state.stance !== false;
    rig.swingLamp.enabled = state.stance === false;
    // Runtime engineering references are attached to the logical nodes, never
    // substituted for the caller's actual numerical state.
    rig.piston.userData.visualLength = length;
    rig.piston.userData.commandedLength = state.actuatorLength;
    rig.hip.userData.joints = state.joints;
    for (const cable of rig.cables) {
      const count = cable.section ? 8 : 10;
      const a = cable.section ? knee : hip;
      const b = cable.section ? ankle : knee;
      cablePoint(rig.ca, a, b, tangent, outward, cable.segment / count, cable.strand, cable.section, explode);
      cablePoint(rig.cb, a, b, tangent, outward, (cable.segment + 1) / count, cable.strand, cable.section, explode);
      cable.item.p.copy(rig.ca).add(rig.cb).multiplyScalar(0.5);
      direction.copy(rig.cb).sub(rig.ca);
      cable.item.s.y = direction.length() + 0.001;
      cable.item.q.setFromUnitVectors(Y, direction.normalize());
    }
    for (const { node, section, end } of rig.terminals) {
      const a = section ? knee : hip, b = section ? ankle : knee;
      const strand = section ? 0.5 : 1;
      cablePoint(rig.ca, a, b, tangent, outward, end, strand, section, explode);
      cablePoint(rig.cb, a, b, tangent, outward, end ? 0.96 : 0.04, strand, section, explode);
      setLink(node, rig.ca, rig.cb, tangent);
      node.position.copy(rig.ca);
    }
  }

  function applyMode(m) {
    const transparent = mode === 'xray' && m.userData.outer;
    const clipping = mode === 'cutaway';
    const changed = m.transparent !== transparent || Boolean(m.clippingPlanes?.length) !== clipping;
    m.transparent = transparent;
    m.opacity = transparent ? 0.12 : 1;
    m.depthWrite = !transparent;
    m.side = transparent || clipping ? THREE.DoubleSide : THREE.FrontSide;
    m.clippingPlanes = clipping ? [clipPlane] : null;
    m.clipShadows = clipping;
    if (changed) m.needsUpdate = true;
  }

  function fillInstances() {
    const q = QUALITY[quality];
    const selectedId = settings.highlight !== false ? settings.selectedId : null;
    stats.components = 0; stats.triangles = 0; stats.drawCallsEstimate = 0;
    for (const batch of batches.values()) {
      const mesh = batch.mesh;
      mesh.geometry = library.tiers[quality][batch.geometry];
      let normalCount = 0, selectedCount = 0;
      for (const item of batch.items) {
        if (!item.enabled || item.minQuality > q) continue;
        const length = item.node?.userData.length ?? 1;
        tempPosition.copy(item.p);
        tempScale.copy(item.s);
        if (item.along) tempPosition.y *= length;
        tempPosition.y += item.yOffset;
        if (item.stretch) tempScale.y *= Math.max(0.0001, length + item.lengthBias);
        tempMatrix.compose(tempPosition, item.q, tempScale);
        if (item.node) worldMatrix.multiplyMatrices(item.node.matrixWorld, tempMatrix);
        else worldMatrix.multiplyMatrices(group.matrixWorld, tempMatrix);
        // Instances live under group, so convert the logical frame back into
        // group-local space. This also permits a caller to reposition group.
        worldMatrix.premultiply(rootInverse);
        const selected = selectedId && (item.id === selectedId || item.id.startsWith(`${selectedId}.`));
        let target, index;
        if (selected) {
          if (!batch.selected) batch.selected = makeMesh(batch, true);
          target = batch.selected; index = selectedCount++;
        } else { target = mesh; index = normalCount++; }
        target.setMatrixAt(index, worldMatrix);
        target.userData.instanceParts[index] = item.id;
      }
      mesh.count = normalCount;
      if (batch.selected) {
        batch.selected.geometry = mesh.geometry;
        batch.selected.count = selectedCount;
      }
      for (const object of [mesh, batch.selected]) {
        if (!object) continue;
        object.visible = object.count > 0;
        object.instanceMatrix.needsUpdate = true;
        object.userData.instanceParts.length = object.count;
        object.boundingBox = null;
        object.boundingSphere = null;
        object.castShadow = !(mode === 'xray' && object.material.userData.outer);
        object.renderOrder = object.material.userData.outer && mode === 'xray' ? 2 : 0;
        applyMode(object.material);
        if (object.visible) {
          stats.components += object.count;
          stats.triangles += triangleCount(object.geometry) * object.count;
          stats.drawCallsEstimate++;
        }
      }
    }
    // Single-material geometries, forceSinglePass and instancing make this the
    // main colour-pass draw count. Renderer shadow/postprocessing passes are
    // intentionally excluded; clipped triangles still count as submitted work.
  }

  const rootInverse = new THREE.Matrix4();
  function update(state, options = {}) {
    if (disposed) return;
    if (state) previousState = state;
    state = previousState;
    Object.assign(settings, options);
    quality = QUALITY[settings.quality] === undefined ? 'balanced' : settings.quality;
    mode = ['solid', 'xray', 'cutaway'].includes(settings.mode) ? settings.mode : 'solid';
    const value = Number(settings.explode);
    const e = clamp(Number.isFinite(value) ? value : 0, 0, 1);
    // Smoothstep is a pure mapping, not time accumulation: reversible at every
    // pose with no drift or animation clock competing with the caller's tween.
    const explode = e * e * (3 - 2 * e);
    body.position.fromArray(state.body?.position ?? [0, 0.82, 0]);
    body.rotation.set(state.body?.pitch ?? 0, 0, state.body?.roll ?? 0, 'XYZ');
    armor.position.y = explode * 0.29;
    core.position.y = explode * 0.035;
    keel.position.y = -explode * 0.15;
    for (const leg of state.legs ?? []) {
      const rig = rigs.get(leg.id);
      if (rig) poseLeg(rig, leg, explode);
    }
    const drive = Number.isFinite(state.driveAngle) ? state.driveAngle : 0;
    for (const spinner of spinners) spinner.node.rotation.z = drive * spinner.speed + spinner.phase;
    group.updateWorldMatrix(true, true);
    rootInverse.copy(group.matrixWorld).invert();
    fillInstances();
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const batch of batches.values()) {
      batch.mesh.dispose();
      batch.selected?.dispose();
    }
    library.dispose();
    for (const m of materials.values()) m.dispose();
    for (const m of selectedMaterials.values()) m.dispose();
    for (const texture of textures) texture.dispose();
    group.removeFromParent();
    group.clear();
    pickables.length = 0;
    batches.clear(); materials.clear(); selectedMaterials.clear(); rigs.clear();
  }

  update(previousState, settings);
  return { group, update, pickables, parts, stats, dispose };
}
