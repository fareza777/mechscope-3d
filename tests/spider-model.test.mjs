import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSpider } from '../src/spider/model.js';
import { createGeometryLibrary, triangleCount } from '../src/spider/geometry.js';
import { sampleSpider } from '../src/spider/kin.js';

const qualities = ['low', 'balanced', 'high'];
const modes = ['solid', 'xray', 'cutaway'];
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const visible = spider => spider.pickables.filter(mesh => mesh.visible && mesh.count);
const snapshot = spider => visible(spider).map(mesh => ({
  name: mesh.name,
  ids: [...mesh.userData.instanceParts],
  matrices: Array.from(mesh.instanceMatrix.array.subarray(0, mesh.count * 16)),
}));
const materialSnapshot = material => ({
  color: material.color.toArray(), emissive: material.emissive.toArray(),
  intensity: material.emissiveIntensity, metalness: material.metalness, roughness: material.roughness,
  normalScale: material.normalScale.toArray(),
});

function checkInstances(spider) {
  const ids = new Set(spider.parts.map(part => part.id));
  let components = 0, triangles = 0;
  for (const mesh of visible(spider)) {
    assert.equal(mesh.count, mesh.userData.instanceParts.length);
    assert.ok(mesh.userData.instanceParts.every(id => ids.has(id)));
    assert.ok(mesh.instanceMatrix.array.subarray(0, mesh.count * 16).every(Number.isFinite), mesh.name);
    components += mesh.count;
    triangles += mesh.count * triangleCount(mesh.geometry);
  }
  assert.equal(spider.stats.components, components);
  assert.equal(spider.stats.triangles, triangles);
  assert.equal(spider.stats.drawCallsEstimate, visible(spider).length);
}

function deepFreeze(object) {
  for (const value of Object.values(object)) if (value && typeof value === 'object') deepFreeze(value);
  return Object.freeze(object);
}

test('all geometry tiers have finite attributes, bounds and valid indices', () => {
  const library = createGeometryLibrary();
  try {
    for (const tier of Object.values(library.tiers)) for (const [name, geometry] of Object.entries(tier)) {
      for (const attribute of Object.values(geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite), name);
      assert.equal(geometry.attributes.uv.count, geometry.attributes.position.count, name);
      assert.ok(Number.isFinite(geometry.boundingSphere.radius) && geometry.boundingSphere.radius > 0, name);
      assert.ok(geometry.boundingBox.min.toArray().every(Number.isFinite), name);
      assert.ok(geometry.boundingBox.max.toArray().every(Number.isFinite), name);
      if (geometry.index) assert.ok(geometry.index.array.every(index => index < geometry.attributes.position.count), name);
      assert.ok(Number.isInteger(triangleCount(geometry)) && triangleCount(geometry) > 0, name);
    }
    const geometry = library.tiers.balanced.scute;
    const p = geometry.attributes.position;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const edgeCounts = new Map();
    let volume = 0;
    const pointKey = vector => vector.toArray().map(value => value.toFixed(6)).join(',');
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      volume += a.dot(b.clone().cross(c)) / 6;
      for (const [start, end] of [[a, b], [b, c], [c, a]]) {
        const key = [pointKey(start), pointKey(end)].sort().join('|');
        edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
      }
    }
    assert.ok(volume > 0, 'Scute winding faces outwards');
    assert.ok([...edgeCounts.values()].every(count => count === 2), 'Scute shell is closed across its crown and chamfers');
  } finally { library.dispose(); }
});

test('model preserves its contract, all stable IDs and balanced budgets', () => {
  const spider = createSpider();
  try {
    assert.deepEqual(Object.keys(spider).sort(), ['dispose', 'group', 'parts', 'pickables', 'stats', 'update']);
    assert.deepEqual(Object.keys(spider.stats).sort(), ['components', 'drawCallsEstimate', 'triangles']);
    const ids = new Set(spider.parts.map(part => part.id));
    assert.equal(ids.size, spider.parts.length);
    for (const suffix of ['armor', 'chassis', 'keel', 'battery', 'control', 'rotor', 'shaft', 'gearset', 'bearing',
      'cooling', 'eyes', 'cable', 'bolt', 'lights', 'identity', 'turbine', 'gills', 'heatpipes', 'diagnostics', 'optics']) {
      assert.ok(ids.has(`body.${suffix}`));
    }
    for (const side of ['L', 'R']) for (let row = 1; row <= 4; row++) for (const suffix of [
      'hip', 'coxa', 'motor', 'gearset', 'bearing', 'femur', 'knee', 'piston', 'tibia', 'tarsus', 'foot',
      'spring', 'cable', 'bolt', 'armor', 'encoder', 'microactuator', 'connector', 'seals',
    ]) assert.ok(ids.has(`${side}${row}.${suffix}`));
    const rendered = new Set(visible(spider).flatMap(mesh => mesh.userData.instanceParts));
    assert.deepEqual(rendered, ids, 'Every metadata record has real selectable geometry');
    for (const part of spider.parts) for (const value of Object.values(part)) assert.ok(typeof value === 'string' && value.length);
    assert.ok(spider.stats.triangles < 170000);
    assert.ok(spider.stats.drawCallsEstimate <= 70);
    checkInstances(spider);
    console.log(`ARACHNE: ${spider.parts.length} parts; ${spider.stats.components} instances; ${spider.stats.triangles} balanced triangles; ${spider.stats.drawCallsEstimate} neutral draws`);
  } finally { spider.dispose(); }
});

test('finite poses and exact explosion reversal across all modes and geometry tiers', () => {
  const spider = createSpider();
  try {
    spider.group.position.set(0.3, -0.2, 0.1);
    spider.group.rotation.set(0.08, 0.19, -0.06);
    for (const quality of qualities) for (const mode of modes) for (const height of [0.72, 0.90]) {
      const state = deepFreeze(sampleSpider(quality === 'low' ? 0.18 : 0.83, { height, stride: 0.34, clearance: 0.22, direction: -1 }));
      const inputBefore = JSON.stringify(state);
      spider.update(state, { quality, mode, explode: 0, selectedId: null });
      const original = snapshot(spider);
      for (const explode of [0.38, 1, 0.72, 0.1, 0]) {
        spider.update(state, { explode });
        checkInstances(spider);
      }
      assert.deepEqual(snapshot(spider), original, `${quality}/${mode}/${height}`);
      assert.equal(JSON.stringify(state), inputBefore, 'Caller state is never mutated');
    }
    const collapsed = sampleSpider(0);
    for (const leg of collapsed.legs) for (const point of ['coxa', 'knee', 'ankle', 'foot']) leg[point] = [...leg.hip];
    spider.update(collapsed, { mode: 'solid', quality: 'balanced', explode: 1 });
    checkInstances(spider);
  } finally { spider.dispose(); }
});

test('turbine impeller alone rotates and service frames follow their intended explosion paths', () => {
  const spider = createSpider();
  try {
    const state = sampleSpider(0);
    state.driveAngle = 0;
    spider.update(state);
    const housing = spider.group.getObjectByName('Stationary ring-motor housing');
    const impeller = spider.group.getObjectByName('Rotating turbine impeller');
    const armor = spider.group.getObjectByName('Removable dorsal scutes');
    const core = spider.group.getObjectByName('Core service cassette');
    const originalHousing = housing.matrixWorld.toArray();
    const originalRotor = impeller.matrixWorld.toArray();
    const matrix = new THREE.Matrix4();
    const vanes = visible(spider).find(mesh => mesh.name === 'vane / titanium');
    vanes.getMatrixAt(0, matrix);
    const originalVane = matrix.toArray();
    state.driveAngle = 0.37;
    spider.update(state);
    assert.deepEqual(housing.matrixWorld.toArray(), originalHousing);
    assert.notDeepEqual(impeller.matrixWorld.toArray(), originalRotor);
    near(impeller.rotation.z, 0.74);
    vanes.getMatrixAt(0, matrix);
    assert.notDeepEqual(matrix.toArray(), originalVane);
    spider.update(state, { explode: 1 });
    near(armor.position.y, 0.29);
    near(core.position.y, 0.035);
    assert.equal(housing.parent, core);
    near(impeller.rotation.z, 0.74);
    spider.update(state, { explode: 0 });
    assert.deepEqual(housing.matrixWorld.toArray(), originalHousing);
  } finally { spider.dispose(); }
});

test('connector strain reliefs remain attached to the actual exploded cable endpoints', () => {
  const spider = createSpider();
  try {
    for (const t of [0, 0.53, 1.31]) for (const e of [0, 0.45, 1]) {
      const state = sampleSpider(t);
      const explode = e * e * (3 - 2 * e);
      spider.update(state, { explode: e });
      for (const leg of state.legs) {
        const outward = new THREE.Vector3().fromArray(leg.foot).sub(new THREE.Vector3().fromArray(leg.hip)).setY(0).normalize();
        const tangent = outward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize();
        const offset = outward.clone().multiplyScalar(explode * 0.23);
        offset.y = explode * (0.028 + (leg.row % 2) * 0.015);
        for (const section of [0, 1]) for (const end of [0, 1]) {
          const endpoint = section ? (end ? leg.ankle : leg.knee) : (end ? leg.knee : leg.hip);
          const expected = new THREE.Vector3().fromArray(endpoint).add(offset)
            .addScaledVector(tangent, (section ? -0.065 + 0.5 * 0.007 : 0.084 + 0.007) + explode * 0.025);
          const terminal = spider.group.getObjectByName(`${leg.id} bundle ${section} terminal ${end}`);
          near(terminal.position.distanceTo(expected), 0);
        }
      }
    }
  } finally { spider.dispose(); }
});

test('selection preserves exact per-instance metadata without mutating shared neutral materials', () => {
  const spider = createSpider();
  try {
    const neutral = new Map(spider.pickables.map(mesh => [mesh.material, materialSnapshot(mesh.material)]));
    const original = snapshot(spider);
    for (const selectedId of ['body.turbine', 'body.heatpipes', 'body.gills', 'body.diagnostics', 'body.optics',
      'L1.connector', 'R4.microactuator', 'L3.seals', 'body.armor', 'L2']) {
      spider.update(null, { selectedId });
      checkInstances(spider);
      const selected = visible(spider).filter(mesh => mesh.name.startsWith('Selected '));
      assert.ok(selected.length > 0);
      for (const mesh of visible(spider)) for (const id of mesh.userData.instanceParts) {
        assert.equal(mesh.name.startsWith('Selected '), id === selectedId || id.startsWith(`${selectedId}.`));
      }
      for (const mesh of selected) {
        assert.ok(!neutral.has(mesh.material));
        const base = [...neutral.keys()].find(material => `${material.name} selected` === mesh.material.name);
        assert.ok(base);
        assert.notEqual(mesh.material.color, base.color);
        assert.notEqual(mesh.material.emissive, base.emissive);
        assert.notEqual(mesh.material.normalScale, base.normalScale);
      }
      for (const [material, properties] of neutral) assert.deepEqual(materialSnapshot(material), properties);
    }
    spider.update(null, { selectedId: null });
    assert.deepEqual(snapshot(spider), original);
    for (const mode of modes) {
      spider.update(null, { mode, selectedId: 'body.turbine' });
      for (const mesh of visible(spider)) {
        const outer = mesh.material.userData.outer;
        const transparent = Boolean(mode === 'xray' && outer);
        assert.equal(mesh.material.transparent, transparent);
        assert.equal(mesh.material.opacity, transparent ? 0.12 : 1);
        assert.equal(mesh.material.depthWrite, !transparent);
        assert.equal(Boolean(mesh.material.clippingPlanes?.length), mode === 'cutaway');
      }
    }
  } finally { spider.dispose(); }
});

test('exposed impeller raycasts retain exact IDs after selection and respect cutaway', () => {
  const spider = createSpider();
  try {
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0.075, 2, -0.025), new THREE.Vector3(0, -1, 0));
    for (const mode of ['solid', 'xray']) for (const selectedId of [null, 'body.turbine']) {
      spider.update(null, { mode, selectedId });
      const intersections = raycaster.intersectObjects(spider.pickables, false);
      assert.ok(intersections.length);
      const hit = intersections[0];
      assert.equal(hit.object.userData.instanceParts[hit.instanceId], 'body.turbine');
      assert.equal(hit.object.name.startsWith('Selected '), selectedId !== null);
    }
    spider.update(null, { mode: 'cutaway' });
    assert.equal(raycaster.intersectObjects(spider.pickables, false).length, 0);
    raycaster.ray.origin.x = -0.131;
    const hits = raycaster.intersectObjects(spider.pickables, false);
    assert.ok(hits.length > 0 && hits.every(hit => hit.point.x <= 1e-7));
  } finally { spider.dispose(); }
});

test('recessed diagnostic strips and stereo objectives remain exposed in solid view', () => {
  const spider = createSpider();
  const raycaster = new THREE.Raycaster();
  try {
    for (const [z, length] of [[0.240, 0.084], [-0.279, 0.112]]) for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
      raycaster.set(new THREE.Vector3(side * 0.015, 2, z + (i - 1.5) * length * 0.25), new THREE.Vector3(0, -1, 0));
      const hit = raycaster.intersectObjects(spider.pickables, false)[0];
      assert.ok(hit);
      assert.equal(hit.object.userData.instanceParts[hit.instanceId], 'body.diagnostics');
      assert.equal(hit.object.name, i === 3 ? 'box / amber' : 'box / light');
    }
    for (const side of [-1, 1]) {
      raycaster.set(new THREE.Vector3(side * 0.086, 0.812, 1), new THREE.Vector3(0, 0, -1));
      const hit = raycaster.intersectObjects(spider.pickables, false)[0];
      assert.ok(hit);
      assert.equal(hit.object.userData.instanceParts[hit.instanceId], 'body.optics');
      assert.equal(hit.object.name, 'cylinder / lens');
    }
  } finally { spider.dispose(); }
});

test('DOM-only metal maps are inexpensive, shared per assembly and disposed without cross-model mutation', () => {
  const previous = globalThis.document;
  let canvasCount = 0;
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      canvasCount++;
      return { width: 0, height: 0, getContext: () => ({
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        putImageData() {}, fillRect() {}, fillText() {},
      }) };
    },
  };
  let first, second;
  try {
    first = createSpider(); second = createSpider();
    assert.equal(canvasCount, 6, 'Only two finish canvases and one label per assembly');
    const firstMetals = first.pickables.map(mesh => mesh.material).filter(material => material.roughnessMap);
    assert.ok(firstMetals.length);
    const roughness = firstMetals[0].roughnessMap, normal = firstMetals[0].normalMap;
    for (const material of firstMetals) {
      assert.equal(material.roughnessMap, roughness);
      assert.equal(material.normalMap, normal);
    }
    assert.equal(roughness.image.width, 128);
    assert.equal(normal.image.height, 128);
    const other = second.pickables.find(mesh => mesh.material.roughnessMap).material;
    assert.notEqual(other.roughnessMap, roughness);
    const untouched = materialSnapshot(other);
    first.update(null, { selectedId: 'body.turbine', mode: 'xray' });
    for (const mesh of visible(first).filter(mesh => mesh.name.startsWith('Selected ') && mesh.material.roughnessMap)) {
      assert.equal(mesh.material.roughnessMap, roughness);
      assert.equal(mesh.material.normalMap, normal);
    }
    assert.deepEqual(materialSnapshot(other), untouched);
    assert.equal(other.transparent, false);
    let roughnessDisposals = 0, normalDisposals = 0, otherDisposals = 0;
    roughness.addEventListener('dispose', () => roughnessDisposals++);
    normal.addEventListener('dispose', () => normalDisposals++);
    other.roughnessMap.addEventListener('dispose', () => otherDisposals++);
    first.dispose(); first.dispose();
    assert.equal(roughnessDisposals, 1); assert.equal(normalDisposals, 1); assert.equal(otherDisposals, 0);
    second.update(sampleSpider(0.3));
    checkInstances(second);
    assert.equal(first.group.children.length, 0);
    assert.equal(first.pickables.length, 0);
  } finally {
    first?.dispose(); second?.dispose();
    if (previous === undefined) delete globalThis.document; else globalThis.document = previous;
  }
});
