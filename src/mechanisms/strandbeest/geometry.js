import * as THREE from 'three';
import { sailPoint } from './kinematics.js';

// Shared indexed ring with a real through-bore, axis along local Y.
function ring(segments, inner = 0.56) {
  const p = [], n = [], index = [];
  const surface = (radius, y, nx, ny) => {
    for (let j = 0; j <= segments; j++) {
      const a = j * Math.PI * 2 / segments;
      p.push(radius * Math.cos(a), y, radius * Math.sin(a));
      n.push(nx * Math.cos(a), ny, nx * Math.sin(a));
    }
  };
  surface(1, -0.5, 1, 0); surface(1, 0.5, 1, 0);
  surface(inner, 0.5, -1, 0); surface(inner, -0.5, -1, 0);
  surface(1, 0.5, 0, 1); surface(inner, 0.5, 0, 1);
  surface(inner, -0.5, 0, -1); surface(1, -0.5, 0, -1);
  for (let side = 0; side < 4; side++) for (let j = 0; j < segments; j++) {
    const a = side * 2 * (segments + 1) + j, b = a + segments + 1;
    index.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  geo.setIndex(index);
  return geo;
}
function plate() {
  const shape = new THREE.Shape();
  [[-0.36, -0.5], [0.36, -0.5], [0.5, -0.36], [0.5, 0.36], [0.36, 0.5], [-0.36, 0.5], [-0.5, 0.36], [-0.5, -0.36]]
    .forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.84, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.025, bevelSegments: 1, steps: 1, curveSegments: 1 });
  geo.translate(0, 0, -0.42);
  return geo;
}
function sail(u, v) {
  const geo = new THREE.PlaneGeometry(1, 1, u, v), p = geo.attributes.position;
  let index = 0;
  for (let j = 0; j <= v; j++) for (let i = 0; i <= u; i++) p.setXYZ(index++, ...sailPoint(i / u, 1 - j / v));
  // Filled camber is baked, including normals. Nothing touches these buffers per frame.
  geo.computeVertexNormals();
  return geo;
}
export function geometryLibrary() {
  const common = {
    box: new THREE.BoxGeometry(1, 1, 1), plate: plate(),
    hex: new THREE.CylinderGeometry(1, 1, 1, 6),
    socket: ring(6, 0.44), label: new THREE.PlaneGeometry(1, 1),
  };
  const tiers = {};
  for (const [name, sides, u, v] of [['low', 8, 8, 10], ['balanced', 12, 12, 16], ['high', 20, 16, 22]]) {
    tiers[name] = {
      ...common,
      rod: new THREE.CylinderGeometry(1, 1, 1, sides, 1),
      eye: ring(sides, 0.53), race: ring(sides, 0.69), washer: ring(8, 0.48),
      wire: new THREE.CylinderGeometry(1, 1, 1, 5, 1),
      foot: new THREE.SphereGeometry(1, sides, name === 'high' ? 12 : 8),
      sail: sail(u, v),
    };
  }
  const all = new Set(Object.values(tiers).flatMap(Object.values));
  for (const geo of all) { geo.clearGroups(); geo.computeBoundingBox(); geo.computeBoundingSphere(); }
  return { tiers, dispose() { for (const geo of all) geo.dispose(); } };
}
export const triangleCount = geometry => (geometry.index?.count ?? geometry.attributes.position.count) / 3;
