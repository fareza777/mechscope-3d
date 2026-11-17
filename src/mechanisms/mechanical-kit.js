import * as THREE from 'three';

export function createMechanicalKit(name) {
  const group = new THREE.Group(); group.name = name;
  const assemblies = new THREE.Group(); group.add(assemblies);
  const parts = [], entries = [], batches = new Map(), nodes = [];
  const palette = {
    titanium: [0x8b9da6, .84, .28], dark: [0x26343d, .72, .32],
    shell: [0xced5cf, .82, .25], brass: [0xb28b4d, .84, .26],
    copper: [0xa86642, .85, .28], rubber: [0x18252a, .12, .64],
    teal: [0x236d70, .65, .26], lens: [0x65d8dc, .48, .16],
  };
  const materials = Object.fromEntries(Object.entries(palette).map(([key, [color, metalness, roughness]]) => [key, new THREE.MeshStandardMaterial({ color, metalness, roughness, ...(key === 'lens' ? { emissive: 0x2d919b, emissiveIntensity: .6 } : {}) })]));
  const geometries = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.SphereGeometry(1, 12, 8),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    cone: new THREE.ConeGeometry(1, 1, 12),
    ring: new THREE.TorusGeometry(1, .13, 6, 20),
    bolt: new THREE.CylinderGeometry(1, 1, 1, 6),
  };
  const matrix = new THREE.Matrix4(), local = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
  const white = new THREE.Color(0xffffff), selected = new THREE.Color(0x9ceacb);
  const cutPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  let built = false, lastMode = null, quality = 'balanced';
  const stats = { instances: 0, triangles: 0, drawCalls: 0, selectableParts: 0 };
  function part(meta, parent = assemblies, explode = [0, .15, 0]) {
    if (built) throw new Error('Build all parts before the first sync.');
    const node = new THREE.Group(); node.name = meta.id; node.userData.partId = meta.id;
    parent.add(node); parts.push(meta); nodes.push({ node, explode: new THREE.Vector3(...explode) }); return node;
  }
  function add(node, shape, material, pos = [0, 0, 0], size = [1, 1, 1], euler = [0, 0, 0], detail = false) {
    if (built) throw new Error('Build all geometry before the first sync.');
    if (!geometries[shape] || !materials[material]) throw new Error(`Unknown mechanical primitive: ${shape}/${material}`);
    local.compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler)), new THREE.Vector3(...size));
    entries.push({ node, shape, material, local: local.clone(), detail });
  }
  function rod(node, material, a, b, radius, detail = false) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const length = delta.length(); if (length < 1e-7) throw new Error('A rod must have nonzero length.');
    rotation.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.divideScalar(length));
    local.compose(start.add(end).multiplyScalar(.5), rotation, new THREE.Vector3(radius, length, radius));
    entries.push({ node, shape: 'cylinder', material, local: local.clone(), detail });
  }
  function gear(node, radius = .12, teeth = 18, thickness = .04, material = 'brass') {
    add(node, 'cylinder', material, [0, 0, 0], [radius * .84, thickness, radius * .84]);
    add(node, 'ring', 'titanium', [0, thickness * .6, 0], [radius * .5, radius * .5, radius * .5], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < teeth; i++) {
      const angle = i * Math.PI * 2 / teeth;
      add(node, 'box', material, [Math.sin(angle) * radius, 0, Math.cos(angle) * radius], [radius * 2.3 / teeth, thickness, radius * .24], [0, angle, 0]);
    }
    add(node, 'bolt', 'dark', [0, thickness * .6, 0], [radius * .2, thickness * .5, radius * .2]);
  }
  function fasteners(node, positions, radius = .016) {
    for (const p of positions) {
      add(node, 'cylinder', 'dark', p, [radius * 1.35, radius * .35, radius * 1.35], [0, 0, 0], true);
      add(node, 'bolt', 'titanium', [p[0], p[1] + radius * .45, p[2]], [radius, radius * .7, radius], [0, 0, 0], true);
      add(node, 'cylinder', 'dark', [p[0], p[1] + radius * .85, p[2]], [radius * .38, radius * .15, radius * .38], [0, 0, 0], true);
    }
  }
  function build() {
    for (const entry of entries) {
      const key = `${entry.shape}/${entry.material}`;
      if (!batches.has(key)) batches.set(key, { entries: [], mesh: null });
      batches.get(key).entries.push(entry);
    }
    for (const [key, batch] of batches) {
      const [shape, material] = key.split('/');
      const mesh = new THREE.InstancedMesh(geometries[shape], materials[material], batch.entries.length);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false;
      mesh.castShadow = material !== 'lens'; mesh.receiveShadow = true;
      mesh.userData.instanceParts = []; batch.mesh = mesh; group.add(mesh);
      for (let i = 0; i < batch.entries.length; i++) mesh.setColorAt(i, white);
    }
    stats.selectableParts = parts.length; built = true;
  }
  function sync(options = {}) {
    if (!built) build();
    const mode = options.mode || 'solid'; quality = options.quality || 'balanced';
    if (mode !== lastMode) {
      for (const [key, material] of Object.entries(materials)) {
        material.transparent = mode === 'xray' && key === 'shell';
        material.opacity = material.transparent ? .13 : 1;
        material.depthWrite = !material.transparent;
        material.clippingPlanes = mode === 'cutaway' ? [cutPlane] : [];
        material.side = mode === 'cutaway' ? THREE.DoubleSide : THREE.FrontSide;
        material.forceSinglePass = true; material.clipShadows = true;
        material.needsUpdate = true;
      }
      lastMode = mode;
    }
    const separation = options.explode || 0;
    for (const { node, explode } of nodes) node.position.addScaledVector(explode, separation);
    assemblies.updateMatrixWorld(true);
    stats.instances = 0; stats.triangles = 0; stats.drawCalls = 0;
    for (const { entries: items, mesh } of batches.values()) {
      let count = 0;
      for (const entry of items) {
        if (quality === 'low' && entry.detail) continue;
        matrix.multiplyMatrices(entry.node.matrixWorld, entry.local);
        mesh.setMatrixAt(count, matrix);
        mesh.setColorAt(count, options.selectedId === entry.node.userData.partId ? selected : white);
        mesh.userData.instanceParts[count] = entry.node.userData.partId; count++;
      }
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
      mesh.boundingBox = null; mesh.boundingSphere = null;
      mesh.castShadow = items[0].material !== 'lens' && !(mode === 'xray' && items[0].material === 'shell');
      stats.instances += count; stats.triangles += count * (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3;
      if (count) stats.drawCalls++;
    }
    for (const { node, explode } of nodes) node.position.addScaledVector(explode, -separation);
  }
  function aim(node, a, b) {
    position.fromArray(a); scale.fromArray(b).sub(position);
    node.position.copy(position); node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), scale.normalize());
  }
  return {
    group, parts, stats, part, add, rod, gear, fasteners, aim, sync,
    get pickables() { return [...batches.values()].map(b => b.mesh); },
    dispose() { for (const { mesh } of batches.values()) mesh.dispose(); Object.values(geometries).forEach(g => g.dispose()); Object.values(materials).forEach(m => m.dispose()); },
  };
}
