import * as THREE from 'three';

// All dimensions are metres in model.js. These small, reusable primitives need
// neither assets nor a DOM. In particular, the rails and sockets have real voids.
function extruded(points, depth = 1, holes = []) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  for (const pointsOfHole of holes) {
    const hole = new THREE.Path();
    pointsOfHole.forEach(([x, y], i) => i ? hole.lineTo(x, y) : hole.moveTo(x, y));
    hole.closePath();
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: false, steps: 1, curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.clearGroups();
  return geometry;
}

function annulus(segments, inner = 0.65, outer = 1, height = 1) {
  const positions = [], normals = [], uvs = [];
  function quad(a, b, c, d, normal, u = 0, v = 1) {
    const points = [a, b, d, b, c, d];
    const wallUV = [[u, 1], [v, 1], [u, 0], [v, 1], [v, 0], [u, 0]];
    points.forEach((p, i) => {
      positions.push(...p);
      normals.push(...normal);
      uvs.push(...(normal[1] ? [p[0] / (outer * 2) + 0.5, p[2] / (outer * 2) + 0.5] : wallUV[i]));
    });
  }
  const h = height / 2;
  for (let i = 0; i < segments; i++) {
    const a = i * Math.PI * 2 / segments;
    const b = (i + 1) * Math.PI * 2 / segments;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const oa = [outer * ca, h, outer * sa], ob = [outer * cb, h, outer * sb];
    const ia = [inner * ca, h, inner * sa], ib = [inner * cb, h, inner * sb];
    const oal = [oa[0], -h, oa[2]], obl = [ob[0], -h, ob[2]];
    const ial = [ia[0], -h, ia[2]], ibl = [ib[0], -h, ib[2]];
    const mid = (a + b) / 2;
    quad(oa, ia, ib, ob, [0, 1, 0]);
    quad(oal, obl, ibl, ial, [0, -1, 0]);
    quad(oa, ob, obl, oal, [Math.cos(mid), 0, Math.sin(mid)], i / segments, (i + 1) / segments);
    quad(ia, ial, ibl, ib, [-Math.cos(mid), 0, -Math.sin(mid)], i / segments, (i + 1) / segments);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

function socketHead() {
  // Hexagonal outside AND recessed hexagonal socket, including the socket floor.
  const ring = annulus(6, 0.46);
  const floor = new THREE.CircleGeometry(0.46, 6);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, -0.22, 0);
  const a = ring.getAttribute('position'), n = ring.getAttribute('normal');
  const flat = floor.toNonIndexed();
  const b = flat.getAttribute('position'), m = flat.getAttribute('normal');
  const positions = new Float32Array(a.array.length + b.array.length);
  const normals = new Float32Array(n.array.length + m.array.length);
  positions.set(a.array); positions.set(b.array, a.array.length);
  normals.set(n.array); normals.set(m.array, n.array.length);
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  result.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  const ringUV = ring.getAttribute('uv').array, floorUV = flat.getAttribute('uv').array;
  const uvs = new Float32Array(ringUV.length + floorUV.length);
  uvs.set(ringUV); uvs.set(floorUV, ringUV.length);
  result.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  ring.dispose(); floor.dispose(); flat.dispose();
  return result;
}

function armorPlate() {
  const shape = new THREE.Shape();
  const c = 0.12, r = 0.46;
  const points = [[-r + c, -r], [r - c, -r], [r, -r + c], [r, r - c],
    [r - c, r], [-r + c, r], [-r, r - c], [-r, -r + c]];
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.84, bevelEnabled: true, bevelThickness: 0.08,
    bevelSize: 0.04, bevelSegments: 1, steps: 1, curveSegments: 1,
  });
  geometry.translate(0, 0, -0.42);
  geometry.rotateX(-Math.PI / 2);
  geometry.clearGroups();
  return geometry;
}

function carapaceScute() {
  const outline = [[0, 0.5], [0.4, 0.35], [0.5, 0.1], [0.43, -0.28], [0.18, -0.46],
    [0, -0.31], [-0.18, -0.46], [-0.43, -0.28], [-0.5, 0.1], [-0.4, 0.35]];
  const positions = [], uvs = [];
  const crown = (x, z) => 0.52 - Math.abs(x) * 0.88 + z * 0.12;
  const lower = outline.map(([x, z]) => [x, crown(x, z) - 0.20, z]);
  const rim = outline.map(([x, z]) => [x, crown(x, z) - 0.08, z]);
  const roof = outline.map(([x, z]) => [x * 0.90, crown(x * 0.90, z * 0.90), z * 0.90]);
  function triangle(a, b, c) {
    for (const p of [a, b, c]) { positions.push(...p); uvs.push(p[0] + 0.5, p[2] + 0.5); }
  }
  function cap(indices, ring, up) {
    const points = indices.map(i => new THREE.Vector2(ring[i][0], ring[i][2]));
    for (const tri of THREE.ShapeUtils.triangulateShape(points, [])) {
      const [a, b, c] = tri.map(i => ring[indices[i]]);
      const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if ((ny > 0) === up) triangle(a, b, c); else triangle(a, c, b);
    }
  }
  // Split the roof at its ridge so triangulation cannot flatten the folded crown.
  cap([0, 1, 2, 3, 4, 5], roof, true);
  cap([5, 6, 7, 8, 9, 0], roof, true);
  cap([0, 1, 2, 3, 4, 5], lower, false);
  cap([5, 6, 7, 8, 9, 0], lower, false);
  for (const [a, b] of [[lower, rim], [rim, roof]]) for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    triangle(a[i], a[j], b[j]); triangle(a[i], b[j], b[i]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function sweptVane() {
  const geometry = extruded([[-0.5, -0.14], [-0.3, -0.5], [0.5, -0.08],
    [0.5, 0.38], [0.1, 0.25], [-0.5, 0.14]], 0.13);
  geometry.rotateX(-Math.PI / 2);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + p.getX(i) * p.getZ(i) * 0.9);
  geometry.computeVertexNormals();
  return geometry;
}

function dustBoot(segments) {
  const profile = [[0.72, -0.5], [0.72, -0.42], [1, -0.33], [0.72, -0.24],
    [1, -0.1], [0.72, 0], [1, 0.1], [0.72, 0.24], [1, 0.33], [0.72, 0.42], [0.72, 0.5]];
  return new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), segments);
}

class Helix extends THREE.Curve {
  getPoint(t, target = new THREE.Vector3()) {
    const angle = t * Math.PI * 12;
    return target.set(0.026 * Math.cos(angle), (t - 0.5) * 0.2, 0.026 * Math.sin(angle));
  }
}

export function createGeometryLibrary() {
  const channel = extruded([
    [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [0.27, 0.5],
    [0.27, -0.16], [-0.27, -0.16], [-0.27, 0.5], [-0.5, 0.5],
  ]);
  channel.rotateX(Math.PI / 2);
  const tooth = extruded([
    [-0.5, -0.5], [0.12, -0.5], [0.5, -0.3], [0.5, 0.3],
    [0.12, 0.5], [-0.5, 0.5],
  ]);
  const common = {
    box: new THREE.BoxGeometry(1, 1, 1),
    plate: armorPlate(),
    scute: carapaceScute(),
    vane: sweptVane(),
    channel,
    tooth,
    socket: socketHead(),
    label: new THREE.PlaneGeometry(1, 1),
  };
  const tiers = {};
  for (const [quality, segments, tubeSegments, springSegments] of [
    ['low', 10, 4, 48], ['balanced', 16, 5, 72], ['high', 24, 6, 96],
  ]) {
    tiers[quality] = {
      ...common,
      cylinder: new THREE.CylinderGeometry(1, 1, 1, segments, 1),
      boot: dustBoot(segments),
      wire: new THREE.CylinderGeometry(1, 1, 1, 6, 1),
      tube: annulus(segments, 0.68),
      race: annulus(segments, 0.77),
      washer: annulus(quality === 'high' ? 16 : 10, 0.48),
      torus: new THREE.TorusGeometry(1, 0.11, tubeSegments, segments),
      spring: new THREE.TubeGeometry(new Helix(), springSegments, 0.0025, tubeSegments, false),
      ball: new THREE.SphereGeometry(1, quality === 'high' ? 12 : 8, quality === 'high' ? 8 : 5),
    };
    for (const geometry of Object.values(tiers[quality])) {
      geometry.clearGroups();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
  }
  return {
    tiers,
    dispose() {
      const unique = new Set(Object.values(tiers).flatMap(Object.values));
      unique.forEach(geometry => geometry.dispose());
    },
  };
}

export function triangleCount(geometry) {
  return (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
}
