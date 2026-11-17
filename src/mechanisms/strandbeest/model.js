import * as THREE from 'three';
import { CFG, HOLY, LINKS, JOINTS, LAYER, SCALE as S, PAD, SAIL, stationZ, legZ, legId, phaseOf, poseAt, sample, sailPoint } from './kinematics.js';
import { geometryLibrary, triangleCount } from './geometry.js';

// Concrete, local material family; no dependency on the Teardown demo's theme P.
export const P = Object.freeze({
  titanium: [0xa7afad, 0.87, 0.36], champagne: [0xbba98c, 0.83, 0.38],
  copper: [0xbe7850, 0.88, 0.30], chrome: [0xcbd3d2, 0.96, 0.22],
  carbon: [0x263034, 0.48, 0.54], rubber: [0x171c1e, 0.08, 0.79],
  teal: [0x267e7b, 0.69, 0.37], sail: [0xd9ccb3, 0.10, 0.68],
  seam: [0x857963, 0.35, 0.59], label: [0xffffff, 0.35, 0.48],
});
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const PI = Math.PI;
const QZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PI / 2);
const Q0 = new THREE.Quaternion();
const linkNames = { j: 'upper crank coupler', k: 'lower crank coupler', b: 'upper pivot rocker', c: 'lower pivot rocker', d: 'rear pivot rocker', e: 'upper triangle tie', f: 'heel transfer link', g: 'lower triangle tie', h: 'long shin', i: 'toe closing link' };

function identityTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160;
  const ctx = canvas.getContext('2d'); if (!ctx) return null;
  ctx.fillStyle = '#172025'; ctx.fillRect(0, 0, 512, 160);
  ctx.fillStyle = '#d4c2a3'; ctx.font = 'bold 56px monospace'; ctx.fillText('VENTUS J20', 25, 68);
  ctx.fillStyle = '#82b5ad'; ctx.font = '22px monospace'; ctx.fillText('003 / JANSEN / 20 LEGS', 27, 117);
  ctx.fillStyle = '#be7850'; ctx.fillRect(26, 135, 458, 3);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Source-geometry walker, in metres, with a deterministic crank pose.
 * options: explode, mode, selectedId, highlight, quality. State.driveAngle is
 * authoritative; state.legs are output contact data, not spider IK inputs.
 * Main colour-pass statistics include clipped submissions, not shadows.
 */
export function createModel() {
  const group = new THREE.Group(); group.name = 'VENTUS J20';
  group.userData.kinematicVisualization = 'Exact Jansen circle intersections; source mean-stance travel with secular camera travel removed. Compliant shoe allowance, not a force/friction or wind-energy simulation.';
  const parts = [], pickables = [], batches = new Map(), materials = new Map(), selections = new Map();
  const library = geometryLibrary(), texture = identityTexture();
  const stats = { components: 0, triangles: 0, drawCallsEstimate: 0, selectableGroups: 0 };
  const settings = { explode: 0, mode: 'solid', selectedId: null, highlight: true, quality: 'balanced' };
  const localClip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), clipPlane = localClip.clone();
  const q = new THREE.Quaternion(), dir = new THREE.Vector3();
  const position = new THREE.Vector3(), scale = new THREE.Vector3();
  let state = sample(0), quality = 'balanced', mode = 'solid', disposed = false, recording = true;
  let bodyX = 0, bodyY = 0;

  function part(id, name, system, purpose, how, material, unit, detail) {
    parts.push({ id, name, system, function: purpose, how, material, unit, detail }); return id;
  }
  const shaftId = part('drive.shaft', 'Continuous ten-station crankshaft', 'Transmission',
    'Distributes one crank angle to all twenty legs.', 'A longitudinal shaft carries ten throws indexed by −36 degrees per station.',
    'Polished stainless steel / copper collars', 'rad', 'The 15-unit crank radius is 157.5 mm at the displayed scale. Eleven moving-bar lengths means b–k plus m; a = 38 and l = 7.8 locate the fixed pivot.');
  const railIds = ['port', 'starboard', 'apex'].map((side, i) => part(`frame.rail.${side}`, `${side} longitudinal truss rail`, 'Chassis',
    'Closes the load path between ten transverse frames.', 'Rigid bay-length longerons and diagonal ties connect adjacent stations.',
    'Brushed titanium', 'm', `Rail ${i + 1} of the source triangular spine. Explode withdraws each rigid bay section without stretching it.`));
  const flywheelIds = [-1, 1].map(sign => part(`drive.flywheel.${sign < 0 ? 'aft' : 'fore'}`, `${sign < 0 ? 'Aft' : 'Fore'} open balance wheel`, 'Transmission',
    'Makes crank phase legible at the end of the shaft.', 'A bored rim, six open spokes and copper counterweights rotate with the common shaft.',
    'Champagne alloy / copper / steel', 'rad', 'Added display balance wheel; inertia and energy storage are not calculated.'));
  const identityId = part('frame.identity', 'VENTUS J20 identification plate', 'Identification',
    'Identifies the twenty-leg Jansen walker.', 'An offline engraved-style plate mounts to the end frame.',
    'Laser-marked charcoal alloy', '003', 'No external images, font download, or runtime texture painting.');
  const stations = Array.from({ length: CFG.stations }, (_, s) => {
    const prefix = `station.${String(s + 1).padStart(2, '0')}`, name = `Station ${String(s + 1).padStart(2, '0')}`;
    const p = (suffix, title, system, purpose, how, material, unit, detail) => part(`${prefix}.${suffix}`, `${name} ${title}`, system, purpose, how, material, unit, detail);
    return {
      frame: p('frame', 'triangular subframe', 'Chassis', 'Locates two fixed leg pivots relative to the crank axis.',
        'Six tubular braces connect the two pivot planes and the elevated apex.', 'Brushed titanium', 'mm', 'Fixed pivots: x = ±399 mm; y = −81.9 mm relative to the shaft. No fixed ground link is falsely counted as a moving bar.'),
      crank: p('crank', 'shared eccentric throw', 'Transmission', 'Drives both mirrored legs from the same pin.',
        'Two machined cheeks link the main shaft to a transverse pin at radius 15 source units.', 'Champagne alloy / polished steel', 'deg', `Indexed phase: ${-s * 36}°. Both legs meet the same A point; the mirror is solved at π − θ before reflecting X.`),
      bearing: p('bearing', 'split bearing cartridges', 'Bearings', 'Support the rotating shaft independently of the leg links.',
        'Hollow bronze-colored bushings, dark seal rings, and removable outer cartridges surround the shaft.', 'Copper alloy / titanium / elastomer', 'mm', 'True geometric through-bores. Only the outer cartridge skins become translucent in x-ray.'),
      mast: p('mast', 'mast, boom and rigging', 'Wind rig', 'Supports and shapes the source sail arrangement.',
        'A 78-unit mast, swept boom and frame stay carry the cambered cloth; edge cords and panel seams follow its surface.', 'Titanium spars / copper fittings / woven cord', 'm', 'The sail rig separates upward as a complete removable subframe. No aerodynamic force or power transmission is inferred.'),
      sail: p('sail', 'cambered membrane', 'Wind rig', 'Presents the characteristic ten-sail silhouette from the source.',
        'Chord tapers by 1 − q^1.35, with yaw −0.5 rad and a sinusoidal 7.5-unit wind fill.', 'Champagne technical sailcloth', 'm', 'Source chord 52 and height 64 units. Fixed filled camber; geometry and normals are computed once per quality tier, not per animation frame.'),
      shell: p('shell', 'removable apex fairing', 'Service shell', 'Shields the spine without hiding the linkage.',
        'A chamfered champagne cover seats over the apex rail with an inset teal index.', 'Anodized champagne alloy', 'mm', 'Cover lifts away in exploded view and becomes translucent in x-ray. Internal rods, rivets, and shaft remain opaque.'),
    };
  });
  const legParts = Array.from({ length: 20 }, (_, n) => {
    const s = n >> 1, side = n % 2, id = legId(s, side), prefix = `${side ? 'Right' : 'Left'} leg ${s + 1}`;
    const links = {};
    for (const [a, b, key] of LINKS) links[key] = part(`${id}.${key}`, `${prefix} · ${key.toUpperCase()} ${linkNames[key]}`, 'Jansen linkage',
      `Constrains joints ${a} and ${b} to a constant separation.`,
      `The exact circle-intersection solution preserves ${key} = ${HOLY[key]} units. Split clevis eyes straddle each pivot; the link occupies source layer ${LAYER[key]}.`,
      key === 'h' || key === 'i' ? 'Champagne alloy / copper eyes' : 'Titanium / copper eyes', 'mm',
      `${(HOLY[key] * S * 1000).toFixed(2)} mm centre-to-centre. Ten non-crank bars plus the shared 157.50 mm crank close the eleven-length mechanism; no interpolated IK or changing bar lengths.`);
    const joints = part(`${id}.pivots`, `${prefix} · clevis pins and rivets`, 'Bearings',
      'Retain seven rotating pivot stacks in double shear.', 'Polished pins pass through paired bored link eyes, copper washers and recessed hex retainers.',
      'Steel / copper alloy / titanium', 'mm', 'Axial layering is enlarged for clearance only; all source XY joint coordinates and link lengths remain exact.');
    const foot = part(`${id}.foot`, `${prefix} · compliant contact shoe`, 'Ground contact',
      'Places the tread under the source foot point without penetrating the floor.',
      'The original shin-aligned ellipsoid has an analytic lowest point; a short vertical compliant carrier closes the 1.2-unit stance band.',
      'Elastomer / titanium / copper bush', 'mm', '12.6 mm maximum shoe travel. Stance means the actual pad support point is at y = 0. This geometric compliance is not a friction or contact-force simulation.');
    return { links, joints, foot };
  });
  stats.selectableGroups = parts.length;

  function material(key, selected = false) {
    const map = selected ? selections : materials;
    if (map.has(key)) return map.get(key);
    let m;
    if (selected) {
      m = material(key).clone(); m.emissive.setHex(0x43bbb1); m.emissiveIntensity = 0.65;
      m.color.lerp(new THREE.Color(0x9cddd3), 0.18);
    } else {
      const base = key.replace(/Shell$/, ''), [color, metalness, roughness] = P[base];
      m = new THREE.MeshStandardMaterial({ color, metalness, roughness });
      m.userData.outer = key.endsWith('Shell') || base === 'sail';
      m.userData.cloth = base === 'sail';
      if (base === 'label') {
        if (texture) m.map = texture; else m.color.setHex(0xbba98c);
      }
    }
    m.name = `VENTUS ${key}${selected ? ' selected' : ''}`;
    m.forceSinglePass = true; map.set(key, m); return m;
  }
  function applyMode(m) {
    const transparent = mode === 'xray' && m.userData.outer;
    const clipping = mode === 'cutaway';
    const side = m.userData.cloth || transparent || clipping ? THREE.DoubleSide : THREE.FrontSide;
    const changed = m.transparent !== transparent || !!m.clippingPlanes?.length !== clipping || m.side !== side;
    m.transparent = transparent; m.opacity = transparent ? 0.12 : 1; m.depthWrite = !transparent;
    m.side = side; m.clippingPlanes = clipping ? [clipPlane] : null; m.clipShadows = clipping;
    if (changed) m.needsUpdate = true;
  }
  function meshFor(batch, selected = false) {
    const mesh = new THREE.InstancedMesh(library.tiers[quality][batch.geometry], material(batch.surface, selected), batch.items.length);
    mesh.name = `${selected ? 'Selected ' : ''}${batch.geometry} / ${batch.surface}`;
    mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.partId = batch.items[0].id; mesh.userData.instanceParts = [];
    const raycast = mesh.raycast;
    mesh.raycast = function (raycaster, intersections) {
      if (!this.visible || !this.count || (mode === 'xray' && this.material.userData.outer)) return;
      const start = intersections.length;
      raycast.call(this, raycaster, intersections);
      if (mode === 'cutaway') for (let i = intersections.length - 1; i >= start; i--) {
        if (clipPlane.distanceToPoint(intersections[i].point) < -1e-7) intersections.splice(i, 1);
      }
    };
    group.add(mesh); pickables.push(mesh); return mesh;
  }
  function emit(id, geometry, surface, x, y, z, sx, sy, sz, rotation = Q0) {
    const key = `${geometry}:${surface}`;
    if (!batches.has(key)) batches.set(key, { geometry, surface, items: [], cursor: 0, mesh: null, selected: null });
    const batch = batches.get(key), index = batch.cursor++;
    if (recording) batch.items.push({ id, matrix: new THREE.Matrix4() });
    position.set((x + bodyX) * S, (y + bodyY) * S, z * S);
    scale.set(sx * S, sy * S, sz * S);
    batch.items[index].matrix.compose(position, rotation, scale);
  }
  function rod(id, surface, a, b, r = 1, geometry = 'rod', depth = r) {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = dir.length(); q.setFromUnitVectors(Y, dir.multiplyScalar(1 / Math.max(length, 1e-8)));
    emit(id, geometry, surface, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, r, Math.max(length, 1e-6), depth, q);
  }
  const cap = (id, surface, x, y, z, r, length, geometry = 'rod') => emit(id, geometry, surface, x, y, z, r, length, r, QZ);
  const box = (id, surface, x, y, z, sx, sy, sz) => emit(id, 'box', surface, x, y, z, sx, sy, sz);

  function drawLeg(leg, n, explode, dz) {
    const ids = legParts[n], side = leg.side, w = side ? -1 : 1;
    const dx = (side ? 1 : -1) * explode * 12;
    const z = legZ(leg.station, side) + dz + (side ? 1 : -1) * explode * 5;
    const J = leg.joints;
    for (const [a, b, key] of LINKS) {
      const A = J[a], B = J[b], id = ids.links[key], layer = z + LAYER[key] * w * 2.2;
      const ux = (B[0] - A[0]) / HOLY[key], uy = (B[1] - A[1]) / HOLY[key];
      const surface = ['h', 'i', 'e'].includes(key) ? 'champagne' : 'titanium';
      rod(id, surface, [A[0] + dx + ux * 2.0, A[1] + uy * 2.0, layer], [B[0] + dx - ux * 2.0, B[1] - uy * 2.0, layer], 0.82);
      for (const [point, sign] of [[A, 1], [B, -1]]) for (const cheek of [-1, 1]) {
        const cz = layer + cheek * 0.68;
        cap(id, 'copper', point[0] + dx, point[1], cz, 1.65, 0.50, 'eye');
        rod(id, surface, [point[0] + dx + ux * sign * 1.2, point[1] + uy * sign * 1.2, cz],
          [point[0] + dx + ux * sign * 3.4, point[1] + uy * sign * 3.4, cz], 1.5, 'box', 0.5);
      }
    }
    for (const key of JOINTS) {
      const [x, y] = J[key], length = key === 'P' ? 8.8 : 8;
      cap(ids.joints, 'chrome', x + dx, y, z, 0.78, length);
      for (const sign of [-1, 1]) {
        cap(ids.joints, 'copper', x + dx, y, z + sign * (length / 2 - 0.35), 1.65, 0.35, 'washer');
        cap(ids.joints, 'titanium', x + dx, y, z + sign * (length / 2 + 0.12), 1.15, 0.65, sign > 0 ? 'socket' : 'hex');
      }
    }
    // The flexible carrier bridges F to the vertically displaced rubber shoe.
    const center = [leg.padCenter[0] / S - bodyX + dx, leg.padCenter[1] / S - bodyY, z];
    q.setFromAxisAngle(Z, leg.angle);
    emit(ids.foot, 'foot', 'rubber', ...center, 3.4, PAD, 4.2, q);
    for (const sign of [-1, 1]) {
      rod(ids.foot, 'titanium', [J.F[0] + dx, J.F[1], z + sign * 2.1], [center[0], center[1] + 0.8, z + sign * 2.1], 0.65);
      cap(ids.foot, 'copper', center[0], center[1] + 0.8, z + sign * 2.4, 0.9, 0.6, 'hex');
    }
  }

  function drawRig(s, dz, explode) {
    const ids = stations[s], z = stationZ(s) + dz, dy = explode * 19, dx = explode * 5;
    const rig = p => [p[0] + dx, p[1] + dy, p[2] + z];
    const top = [SAIL.mast, SAIL.base + SAIL.height + 4, 0];
    rod(ids.mast, 'champagne', rig([SAIL.mast, 20, 0]), rig(top), 1.05);
    rod(ids.mast, 'titanium', rig([SAIL.mast, SAIL.base, 0]), rig(sailPoint(1, 0)), 0.9);
    rod(ids.mast, 'titanium', rig([0, 20, 0]), rig([SAIL.mast, SAIL.base - 2, 0]), 1);
    rod(ids.mast, 'titanium', rig([38, -7.8, CFG.half]), rig([SAIL.mast, 20, 0]), 0.75);
    for (const y of [SAIL.base, top[1]]) cap(ids.mast, 'copper', SAIL.mast + dx, y + dy, z, 1.7, 3.6, 'race');
    emit(ids.sail, 'sail', 'sail', dx, dy, z, 1, 1, 1);
    // Actual stitched seams and perimeter cords; constant source camber.
    for (const r of [0, 1]) for (let j = 0; j < 12; j++) {
      rod(ids.mast, 'seam', rig(sailPoint(r, j / 12)), rig(sailPoint(r, (j + 1) / 12)), 0.16, 'wire');
    }
    for (let j = 0; j < 8; j++) rod(ids.mast, 'seam', rig(sailPoint(j / 8, 0)), rig(sailPoint((j + 1) / 8, 0)), 0.16, 'wire');
    for (const h of [0.25, 0.5, 0.75]) for (let j = 0; j < 8; j++) {
      const a = rig(sailPoint(j / 8, h)), b = rig(sailPoint((j + 1) / 8, h));
      a[2] += 0.18; b[2] += 0.18;
      rod(ids.sail, 'seamShell', a, b, 0.09, 'wire');
    }
  }

  function drawPose(pose, e) {
    bodyX = pose.body.position[0] / S; bodyY = pose.body.position[1] / S;
    const theta = pose.driveAngle;
    const zStart = stationZ(0), zEnd = stationZ(9), hw = CFG.half;
    cap(shaftId, 'chrome', 0, 0, 0, 1.5, zEnd - zStart + 28);
    for (let s = 0; s < 10; s++) {
      const ids = stations[s], dz = (s - 4.5) * e * 5, z = stationZ(s) + dz;
      const angle = theta + phaseOf(s), ax = HOLY.m * Math.cos(angle), ay = HOLY.m * Math.sin(angle);
      for (const side of [-1, 1]) {
        const zl = z + side * hw;
        rod(ids.frame, 'titanium', [0, 0, zl], [side * HOLY.a, -HOLY.l, zl], 1.3);
        rod(ids.frame, 'titanium', [side * HOLY.a, -HOLY.l, zl], [0, 20, z], 1.3);
        rod(ids.frame, 'titanium', [0, 0, zl], [0, 20, z], 1.05);
        cap(ids.bearing, 'carbonShell', 0, 0, zl, 3.4, 3.8, 'race');
        cap(ids.bearing, 'copper', 0, 0, zl + side * 1.3, 2.4, 3.2, 'race');
        cap(ids.bearing, 'titanium', 0, 0, zl + side * 2.4, 2.8, 0.5, 'washer');
        const webZ = z + side * (hw + 3.2);
        rod(ids.crank, 'champagne', [0, 0, webZ], [ax, ay, webZ], 4.0, 'box', 1.5);
        cap(ids.crank, 'champagne', 0, 0, webZ, 3.4, 1.5);
        cap(ids.crank, 'copper', ax, ay, webZ, 2.1, 1.6, 'race');
        cap(ids.crank, 'titanium', ax, ay, webZ + side * 1.2, 1.3, 0.8, 'socket');
        cap(ids.frame, 'copper', side * HOLY.a, -HOLY.l, zl, 2.7, 5.1, 'race');
      }
      cap(ids.crank, 'chrome', ax, ay, z, 1.25, 2 * (hw + 3.2));
      cap(shaftId, 'copper', 0, 0, z, 2.1, 2, 'race');
      cap(ids.frame, 'titanium', 0, 20, z, 2.4, 6, 'hex');
      emit(ids.shell, 'plate', 'champagneShell', 0, 23 + e * 12, z, 13, 5, 20);
      box(ids.shell, 'tealShell', 0, 25.65 + e * 12, z, 1, 0.45, 12);
      drawLeg(pose.legs[s * 2], s * 2, e, dz);
      drawLeg(pose.legs[s * 2 + 1], s * 2 + 1, e, dz);
      drawRig(s, dz, e);
    }
    for (let s = 0; s < 9; s++) {
      // Whole rigid rail bays separate; no exploded scaling of actual bar lengths.
      const dz = (s - 4) * e * 5, a = stationZ(s) + dz, b = stationZ(s + 1) + dz;
      rod(railIds[0], 'titanium', [-38 - e * 4, -7.8, a - hw], [-38 - e * 4, -7.8, b - hw], 1.2);
      rod(railIds[1], 'titanium', [38 + e * 4, -7.8, a + hw], [38 + e * 4, -7.8, b + hw], 1.2);
      rod(railIds[2], 'champagne', [0, 20 + e * 4, a], [0, 20 + e * 4, b], 1.3);
      for (const side of [-1, 1]) rod(railIds[side < 0 ? 0 : 1], 'titanium', [side * 38, -7.8, a + side * hw], [0, 20, b], 0.65);
    }
    for (const [i, sign] of [-1, 1].entries()) {
      const id = flywheelIds[i], z = sign * (130 + e * 34);
      cap(id, 'champagne', 0, 0, z, 11, 1.9, 'race');
      cap(id, 'copper', 0, 0, z, 3.5, 4.6, 'race');
      cap(id, 'titanium', 0, 0, z + sign * 3, 2.0, 1.4, 'socket');
      for (let k = 0; k < 6; k++) {
        const a = theta + k * PI / 3, ca = Math.cos(a), sa = Math.sin(a);
        rod(id, 'titanium', [ca * 3, sa * 3, z], [ca * 9, sa * 9, z], 1.4, 'box', 1.6);
        cap(id, k % 2 ? 'titanium' : 'copper', ca * 8.5, sa * 8.5, z + sign * 1.1, 1.15, 1.1, 'hex');
      }
    }
    emit(identityId, 'plate', 'carbon', 0, 23, 133 + e * 26, 16, 5.5, 1.2);
    emit(identityId, 'label', 'label', 0, 23, 133.65 + e * 26, 14, 4.375, 1);
  }

  function flush() {
    stats.components = 0; stats.triangles = 0; stats.drawCallsEstimate = 0;
    const selectedId = settings.highlight !== false ? settings.selectedId : null;
    for (const batch of batches.values()) {
      if (!batch.mesh) batch.mesh = meshFor(batch);
      let normal = 0, selected = 0;
      for (const item of batch.items) {
        const isSelected = selectedId && (item.id === selectedId || item.id.startsWith(`${selectedId}.`));
        let target, index;
        if (isSelected) { if (!batch.selected) batch.selected = meshFor(batch, true); target = batch.selected; index = selected++; }
        else { target = batch.mesh; index = normal++; }
        target.setMatrixAt(index, item.matrix); target.userData.instanceParts[index] = item.id;
      }
      batch.mesh.count = normal; if (batch.selected) batch.selected.count = selected;
      for (const mesh of [batch.mesh, batch.selected]) {
        if (!mesh) continue;
        mesh.geometry = library.tiers[quality][batch.geometry];
        mesh.visible = mesh.count > 0; mesh.instanceMatrix.needsUpdate = true;
        mesh.userData.instanceParts.length = mesh.count;
        mesh.boundingBox = null; mesh.boundingSphere = null;
        mesh.castShadow = !(mode === 'xray' && mesh.material.userData.outer);
        mesh.renderOrder = mode === 'xray' && mesh.material.userData.outer ? 2 : 0;
        applyMode(mesh.material);
        if (mesh.visible) {
          stats.components += mesh.count;
          stats.triangles += triangleCount(mesh.geometry) * mesh.count;
          stats.drawCallsEstimate++;
        }
      }
    }
  }
  function update(nextState, options = {}) {
    if (disposed) return;
    if (nextState) state = nextState;
    Object.assign(settings, options);
    quality = Object.hasOwn(library.tiers, settings.quality) ? settings.quality : 'balanced';
    mode = ['solid', 'xray', 'cutaway'].includes(settings.mode) ? settings.mode : 'solid';
    const value = Number(settings.explode), clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
    const e = clamped * clamped * (3 - 2 * clamped);
    // Re-solving twenty closed mechanisms also supports {driveAngle} alone,
    // prevents caller-owned contact data from being mutated, and allows scrubbing.
    const angle = Number.isFinite(state.driveAngle) ? state.driveAngle : (Number.isFinite(state.phase) ? state.phase * PI * 2 : 0);
    const pose = poseAt(angle);
    for (const batch of batches.values()) batch.cursor = 0;
    drawPose(pose, e); recording = false;
    group.updateWorldMatrix(true, false); clipPlane.copy(localClip).applyMatrix4(group.matrixWorld);
    flush(); group.updateWorldMatrix(false, true);
  }
  function dispose() {
    if (disposed) return; disposed = true;
    for (const batch of batches.values()) { batch.mesh?.dispose(); batch.selected?.dispose(); }
    library.dispose(); texture?.dispose();
    for (const m of [...materials.values(), ...selections.values()]) m.dispose();
    group.removeFromParent(); group.clear(); pickables.length = 0;
    batches.clear(); materials.clear(); selections.clear();
  }
  update(state);
  return { group, update, pickables, parts, stats, dispose };
}
