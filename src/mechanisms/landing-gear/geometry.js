import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, E0, TIP0 } from './kinematics.js';

const PI = Math.PI;
const TIERS = { low: 16, balanced: 32, high: 48 };

export function combine(pieces) {
  const mixedIndexing = pieces.some(g => g.index) && pieces.some(g => !g.index);
  const compatible = mixedIndexing ? pieces.map(g => g.index ? g.toNonIndexed() : g) : pieces;
  const merged = mergeGeometries(compatible, false);
  for (const geometry of new Set([...pieces, ...compatible])) geometry.dispose();
  if (!merged) throw new Error('Landing gear geometry attributes must match');
  merged.clearGroups();
  return merged;
}
export function boxAt(size, position) {
  return new THREE.BoxGeometry(...size).translate(...position);
}

function extrude(shape, depth, segments, bevel = 0) {
  return new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 1, curveSegments: segments,
  }).translate(0, 0, -depth / 2);
}
function hole(shape, x, y, radius) {
  const path = new THREE.Path();
  path.absarc(x, y, radius, 0, 2 * PI, true);
  shape.holes.push(path);
}
export function annulus(outer, inner, depth, segments, drill = false) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, 2 * PI, false);
  hole(shape, 0, 0, inner);
  if (drill) for (let i = 0; i < 12; i++) {
    const a = 2 * PI * i / 12;
    hole(shape, Math.cos(a) * outer * 0.79, Math.sin(a) * outer * 0.79, outer * 0.043);
  }
  return extrude(shape, depth, segments).rotateX(PI / 2);
}
export function linkGeometry(length, width, depth, bore, segments) {
  const r = width / 2, dy = (length - width) / 2;
  const shape = new THREE.Shape();
  shape.absarc(0, dy, r, 0, PI, false);
  shape.absarc(0, -dy, r, PI, 2 * PI, false);
  shape.closePath();
  hole(shape, 0, dy, bore); hole(shape, 0, -dy, bore);
  return extrude(shape, depth, segments, 0.0006);
}

function plate() {
  const shape = new THREE.Shape();
  const plan = [
    [-0.12, 0.62], [0.12, 0.62], [0.14, 0.32], [0.42, 0.22], [0.46, 0.12],
    [0.44, -0.06], [0.16, -0.16], [0.14, -0.78], [-0.14, -0.78],
    [-0.16, -0.16], [-0.44, -0.06], [-0.46, 0.12], [-0.42, 0.22], [-0.14, 0.32],
  ];
  plan.forEach(([x, z], i) => i ? shape.lineTo(x, z) : shape.moveTo(x, z));
  shape.closePath();
  return extrude(shape, 0.026, 8, 0.004).rotateX(PI / 2).translate(0, -0.013, 0);
}
function rail(segments) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.55, 0); shape.lineTo(0.55, 0);
  shape.lineTo(0.55, 0.049); shape.lineTo(0.51, 0.07);
  shape.lineTo(-0.51, 0.07); shape.lineTo(-0.55, 0.049); shape.closePath();
  for (let i = 0; i < 6; i++) hole(shape, -0.41 + i * 0.164, 0.0336, 0.0154);
  return extrude(shape, 0.012, segments / 2, 0.001).rotateY(-PI / 2);
}
function rack() {
  const len = 0.34, h = 0.034, pitch = 2 * PI * G.pinionR / G.teeth;
  const shape = new THREE.Shape();
  shape.moveTo(-len / 2, h / 2); shape.lineTo(len / 2, h / 2);
  shape.lineTo(len / 2, -h / 2);
  for (let i = Math.floor(len / pitch) - 1; i >= 0; i--) {
    const z = -len / 2 + i * pitch;
    shape.lineTo(z + pitch * 0.78, -h / 2);
    shape.lineTo(z + pitch * 0.62, -h / 2 - 0.008);
    shape.lineTo(z + pitch * 0.38, -h / 2 - 0.008);
    shape.lineTo(z + pitch * 0.22, -h / 2);
  }
  shape.lineTo(-len / 2, -h / 2); shape.closePath();
  return extrude(shape, 0.04, 8, 0.001).rotateY(-PI / 2);
}
function pinion(segments) {
  const shape = new THREE.Shape();
  const da = 2 * PI / G.teeth;
  for (let i = 0; i < G.teeth; i++) {
    for (const [k, [r, fraction]] of [
      [G.pinionR - 0.005, 0], [G.pinionR - 0.005, 0.18],
      [G.pinionR + 0.004, 0.34], [G.pinionR + 0.004, 0.6], [G.pinionR - 0.005, 0.76],
    ].entries()) {
      const a = da * (i + fraction);
      if (i === 0 && k === 0) shape.moveTo(r * Math.cos(a), r * Math.sin(a));
      else shape.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
  }
  shape.closePath(); hole(shape, 0, 0, 0.02);
  return extrude(shape, 0.036, segments / 2, 0.0015).rotateY(PI / 2);
}
function springLeg(segments) {
  const tip = TIP0.clone().sub(E0), out = new THREE.Vector3(1, 0, 0);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(), out.clone().multiplyScalar(0.12).add(new THREE.Vector3(0, -0.02, 0.02)),
    tip.clone().multiplyScalar(0.55).addScaledVector(out, 0.1), tip.clone().add(new THREE.Vector3(-0.02, 0, 0)),
  ]);
  const shape = new THREE.Shape();
  shape.moveTo(-0.048, -0.014); shape.lineTo(0.048, -0.014);
  shape.lineTo(0.048, 0.014); shape.lineTo(-0.048, 0.014); shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { steps: segments * 2, extrudePath: curve, bevelEnabled: false });
}
function tyre(segments) {
  const points = [
    [0.108, -0.060], [0.140, -0.0675], [0.170, -0.0675], [0.188, -0.056], [0.200, -0.045],
    [G.wheelR, -0.038], [G.wheelR, -0.029], [0.200, -0.027], [0.200, -0.024], [G.wheelR, -0.022],
    [G.wheelR, -0.004], [0.200, -0.002], [0.200, 0.002], [G.wheelR, 0.004],
    [G.wheelR, 0.022], [0.200, 0.024], [0.200, 0.027], [G.wheelR, 0.029], [G.wheelR, 0.038],
    [0.200, 0.045], [0.188, 0.056], [0.170, 0.0675], [0.140, 0.0675], [0.108, 0.060], [0.108, -0.060],
  ].map(p => new THREE.Vector2(...p));
  return new THREE.LatheGeometry(points, segments + 16).rotateZ(PI / 2);
}
function rim(segments) {
  return new THREE.LatheGeometry([
    [0.034, 0.009], [0.056, 0.009], [0.085, 0.038], [0.104, 0.046],
    [0.115, 0.051], [0.116, 0.059], [0.106, 0.061], [0.098, 0.052],
    [0.078, 0.046], [0.050, 0.020], [0.034, 0.020], [0.034, 0.009],
  ].map(p => new THREE.Vector2(...p)), segments + 16).rotateZ(-PI / 2);
}
function yoke(segments) {
  return combine([
    linkGeometry(0.072, 0.046, 0.012, 0.010, segments / 2).rotateZ(-PI / 2).translate(-0.017, 0, -0.031),
    linkGeometry(0.072, 0.046, 0.012, 0.010, segments / 2).rotateZ(-PI / 2).translate(-0.017, 0, 0.031),
    boxAt([0.016, 0.045, 0.066], [-0.045, 0, 0]),
  ]);
}
function socket(segments) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = i * PI / 3;
    if (i) shape.lineTo(Math.cos(a), Math.sin(a)); else shape.moveTo(Math.cos(a), Math.sin(a));
  }
  shape.closePath();
  const path = new THREE.Path();
  for (let i = 0; i < 6; i++) {
    const a = -i * PI / 3;
    if (i) path.lineTo(0.39 * Math.cos(a), 0.39 * Math.sin(a)); else path.moveTo(0.39, 0);
  }
  path.closePath(); shape.holes.push(path);
  return extrude(shape, 1, segments / 2).rotateX(PI / 2);
}
export function hoseGeometry(points, radius, segments) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 8, false);
}

export function createGeometryKit() {
  const factories = new Map(Object.entries({
    box: () => new THREE.BoxGeometry(1, 1, 1),
    machined: n => new RoundedBoxGeometry(1, 1, 1, n > 32 ? 3 : 2, 0.07),
    cylinder: n => new THREE.CylinderGeometry(1, 1, 1, n),
    wire: () => new THREE.CylinderGeometry(1, 1, 1, 8),
    socket,
    bearing: n => annulus(1, 0.70, 1, n / 2),
    tube: n => annulus(1, 0.85, 1, n / 2),
    washer: n => annulus(1, 0.45, 1, n / 2),
    plate, rail, rack, pinion, springLeg, tyre, rim, yoke,
    disc: n => annulus(0.112, 0.037, 0.008, n / 2, true).rotateZ(PI / 2),
  }));
  const cache = new Map();
  return {
    register(key, factory) {
      if (factories.has(key)) throw new Error(`Duplicate gear geometry: ${key}`);
      factories.set(key, factory);
      return key;
    },
    get(key, quality = 'balanced') {
      const tier = TIERS[quality] ? quality : 'balanced';
      const cacheKey = `${key}:${tier}`;
      if (!cache.has(cacheKey)) {
        const factory = factories.get(key);
        if (!factory) throw new Error(`Unknown gear geometry: ${key}`);
        const geometry = factory(TIERS[tier]);
        geometry.clearGroups();
        geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        cache.set(cacheKey, geometry);
      }
      return cache.get(cacheKey);
    },
    dispose() { for (const geometry of cache.values()) geometry.dispose(); cache.clear(); factories.clear(); },
  };
}
export const triangleCount = geometry => (geometry.index?.count ?? geometry.attributes.position.count) / 3;
