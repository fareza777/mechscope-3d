import * as THREE from 'three';
import { buildEngine } from './engine.js';
import { annotateEngine } from './anatomy.js';

// Reference mm -> metres (inside the rig), then a uniform 2.28× museum-display scale.
// The original full exploded envelope, not just the assembled engine, stays below 2 m.
export const DISPLAY_SCALE = 2.28;
const DEG = 180 / Math.PI;
const CUT_Z = 0.179; // Section through the front cylinder, retaining the rear half-space.
const clamp = n => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

function arraysOf(g) {
  return [...Object.keys(g.attributes).sort().map(k => g.attributes[k].array), ...(g.index ? [g.index.array] : [])];
}
function geometryKey(g) {
  let hash = 2166136261;
  const arrays = arraysOf(g);
  for (const a of arrays) {
    const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
    for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 16777619);
  }
  return `${arrays.map(a => a.length).join(':')}:${hash >>> 0}`;
}
function identical(a, b) {
  const aa = arraysOf(a), bb = arraysOf(b);
  return aa.length === bb.length && aa.every((v, i) => v.length === bb[i].length && v.every((x, j) => x === bb[i][j]));
}
function isShown(node) {
  for (let n = node; n; n = n.parent) if (!n.visible) return false;
  return true;
}

/**
 * DOM-free model contract. driveAngle is crank radians, positive clockwise from +z.
 * update accepts partial options; omitted settings persist. No elapsed-time integration.
 * stats count submitted geometry instances/triangles and main colour-pass draw calls,
 * before camera/frustum or fragment clipping; stencil, transmission and shadow passes excluded.
 */
export function createModel() {
  const group = new THREE.Group();
  group.name = 'IGNIS V8';
  group.userData.units = 'display metres; source geometry and anatomy dimensions in mm';
  group.userData.kinematicVisualization = 'Exact rigid slider-crank and analytic valve lift. Qualitative combustion; no fluid, torque or cam-contact solver.';
  const mount = new THREE.Group();
  mount.scale.setScalar(DISPLAY_SCALE);
  group.add(mount);
  const parts = [], pickables = [];
  const stats = { components: 0, visibleParts: 0, geometries: 0, instances: 0, triangles: 0, drawCallsEstimate: 0, quality: 'balanced' };
  const settings = { explode: 0, mode: 'solid', selectedId: null, highlight: true, quality: 'balanced' };
  const plane = new THREE.Plane();
  let engine, batches = [], disposed = false, previousState = { driveAngle: 0 };
  let floorRadius = 0;
  const resources = { geometries: new Set(), materials: new Set() };

  function release() {
    for (const batch of batches) {
      batch.mesh.dispose();
      batch.selected?.dispose();
    }
    for (const geometry of resources.geometries) geometry.dispose();
    for (const material of resources.materials) material.dispose();
    resources.geometries.clear(); resources.materials.clear();
    mount.clear(); pickables.length = 0; batches = [];
    engine?.root.clear();
    engine = null;
  }
  function instanceMesh(geometry, material, capacity, name) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.name = name;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.userData.instanceParts = [];
    mesh.count = 0;
    // No stale instance bounds after explosion. Picking bounds are refreshed after each pose.
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mount.add(mesh); pickables.push(mesh);
    return mesh;
  }
  function build(quality) {
    release();
    engine = buildEngine({ quality });
    const anatomy = annotateEngine(engine);
    if (!parts.length) parts.push(...anatomy);
    const canonical = new Map(), byBatch = new Map();
    const visited = new Map();
    for (const m of engine.materials) resources.materials.add(m);
    engine.root.traverse(node => {
      if (!node.isMesh) return;
      const original = node.geometry;
      if (!visited.has(original)) {
        const key = geometryKey(original);
        const candidates = canonical.get(key) || [];
        const shared = candidates.find(g => identical(g, original));
        if (shared) { visited.set(original, shared); original.dispose(); }
        else {
          original.clearGroups();
          original.computeBoundingBox();
          original.computeBoundingSphere();
          candidates.push(original); canonical.set(key, candidates);
          visited.set(original, original); resources.geometries.add(original);
        }
      }
      node.geometry = visited.get(original);
      resources.materials.add(node.material);
      const outer = !!node.userData.outer;
      const key = `${node.geometry.uuid}/${node.material.uuid}/${outer}/${node.renderOrder}`;
      if (!byBatch.has(key)) {
        const material = node.material.clone();
        material.forceSinglePass = true;
        resources.materials.add(material);
        byBatch.set(key, { geometry: node.geometry, sourceMaterial: node.material, material, outer, nodes: [], mesh: null, selected: null });
      }
      byBatch.get(key).nodes.push(node);
    });
    batches = [...byBatch.values()];
    for (const batch of batches) {
      batch.mesh = instanceMesh(batch.geometry, batch.material, batch.nodes.length, 'V8 shared geometry');
      batch.mesh.renderOrder = batch.nodes[0].renderOrder;
      batch.triangles = (batch.geometry.index?.count ?? batch.geometry.attributes.position.count) / 3;
    }
    // Circular lower envelope of the rotating flywheel; avoids a rotating AABB's false floor bounce.
    floorRadius = 0;
    engine.flywheel.traverse(node => {
      if (!node.isMesh || node.geometry.type !== 'ExtrudeGeometry') return;
      const p = node.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) floorRadius = Math.max(floorRadius, Math.hypot(p.getX(i), p.getY(i)));
    });
    stats.quality = quality;
    stats.components = parts.length;
  }

  function appearance(batch) {
    const m = batch.material, source = batch.sourceMaterial;
    m.color.copy(source.color);
    let transparent = source.transparent, opacity = source.opacity, depthWrite = source.depthWrite;
    const liner = source === engine.M.glass;
    if (settings.mode === 'xray' && batch.outer) {
      transparent = true; opacity = liner ? 0.12 : 0.14; depthWrite = false;
      m.color.set(liner ? '#92d3df' : '#74969e');
    } else if (liner) {
      transparent = false; opacity = 1; depthWrite = true;
      m.color.set('#454e53');
    }
    const side = settings.mode === 'cutaway' || liner ? THREE.DoubleSide : source.side;
    if (m.transparent !== transparent || m.side !== side) m.needsUpdate = true;
    m.transparent = transparent; m.opacity = opacity; m.depthWrite = depthWrite; m.side = side;
    m.clippingPlanes = settings.mode === 'cutaway' ? [engine.CLIP] : null;
    m.clipShadows = true;
    batch.mesh.castShadow = !transparent;
    if (batch.selected) {
      const selected = batch.selected.material;
      if (selected.side !== side) selected.needsUpdate = true;
      selected.side = side;
      selected.clippingPlanes = m.clippingPlanes;
    }
  }
  function selectedMesh(batch) {
    if (!batch.selected) {
      const material = batch.material.clone();
      material.transparent = false; material.opacity = 1; material.depthWrite = true;
      material.color.set('#ffb85b');
      if (material.emissive) { material.emissive.set('#9b3d08'); material.emissiveIntensity = 0.55; }
      material.forceSinglePass = true;
      resources.materials.add(material);
      batch.selected = instanceMesh(batch.geometry, material, batch.nodes.length, 'V8 isolated selection');
      batch.selected.castShadow = true;
    }
    return batch.selected;
  }
  function refreshStats() {
    const geometries = new Set(), visibleParts = new Set();
    let instances = 0, triangles = 0, calls = 0;
    for (const b of batches) for (const mesh of [b.mesh, b.selected]) {
      if (!mesh?.visible || !mesh.count) continue;
      instances += mesh.count;
      triangles += b.triangles * mesh.count;
      calls += 1; // Every batch is one material, forceSinglePass, no transmission.
      geometries.add(mesh.geometry);
      for (const id of mesh.userData.instanceParts) visibleParts.add(id);
    }
    Object.assign(stats, { visibleParts: visibleParts.size, geometries: geometries.size, instances, triangles, drawCallsEstimate: calls });
  }
  function update(state = previousState, options = {}) {
    if (disposed) return;
    if (state) previousState = state;
    Object.assign(settings, options);
    settings.explode = clamp(settings.explode);
    if (!['solid', 'xray', 'cutaway'].includes(settings.mode)) settings.mode = 'solid';
    if (!['low', 'balanced', 'high'].includes(settings.quality)) settings.quality = 'balanced';
    if (!engine || settings.quality !== stats.quality) build(settings.quality);
    const angle = Number.isFinite(previousState.driveAngle) ? previousState.driveAngle * DEG : 0;
    // Preserve the original phased disassembly; annotations off, live chamber colours on.
    engine.update(angle, { explode: settings.explode, arrows: 0, charge: 1, fire: 1 });
    engine.root.updateMatrixWorld(true);
    const floor = Math.min(engine.pan.position.y - 20, engine.flywheel.position.y - floorRadius) * 0.001 + engine.root.position.y;
    mount.position.y = -floor * DISPLAY_SCALE;
    group.updateWorldMatrix(true, true);
    plane.set(new THREE.Vector3(0, 0, -1), CUT_Z).applyMatrix4(mount.matrixWorld);
    const oldCut = engine.M.black.clippingPlanes != null;
    engine.setCut(settings.mode === 'cutaway' ? 'section' : settings.mode === 'solid' ? 'solid' : 'glass', plane.constant, plane.normal);
    if (oldCut !== (settings.mode === 'cutaway')) {
      for (const b of batches) {
        b.material.needsUpdate = true;
        if (b.selected) b.selected.material.needsUpdate = true;
      }
    }
    for (const batch of batches) {
      let ordinary = 0, selected = 0;
      const ids = batch.mesh.userData.instanceParts;
      ids.length = 0;
      if (batch.selected) batch.selected.userData.instanceParts.length = 0;
      for (const node of batch.nodes) {
        if (!isShown(node)) continue;
        const id = node.userData.partId;
        if (settings.highlight !== false && id === settings.selectedId) {
          const target = selectedMesh(batch);
          target.setMatrixAt(selected++, node.matrixWorld);
          target.userData.instanceParts.push(id);
        } else {
          batch.mesh.setMatrixAt(ordinary++, node.matrixWorld);
          ids.push(id);
        }
      }
      batch.mesh.count = ordinary;
      if (batch.selected) batch.selected.count = selected;
      appearance(batch);
      for (const mesh of [batch.mesh, batch.selected]) {
        if (!mesh) continue;
        mesh.visible = mesh.count > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.visible) { mesh.computeBoundingSphere(); mesh.computeBoundingBox(); }
      }
    }
    group.updateWorldMatrix(true, true);
    refreshStats();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    release(); group.clear();
    Object.assign(stats, { visibleParts: 0, geometries: 0, instances: 0, triangles: 0, drawCallsEstimate: 0 });
  }
  update();
  return { group, update, pickables, parts, stats, dispose };
}
