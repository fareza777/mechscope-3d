import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createStage(container, spider, onPick, invalidate = () => {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: (window.devicePixelRatio || 1) < 2, alpha: false, powerPreference: 'high-performance', stencil: true });
  renderer.setClearColor(0xf1f2ee);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute('aria-label', 'Interactive Mechanical Spider. Drag to orbit. Pinch or scroll to zoom. Tap a component to inspect it.');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.tabIndex = 0;
  container.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf1f2ee);
  scene.fog = new THREE.Fog(0xf1f2ee, 10, 26);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.045);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.78;
  room.dispose(); pmrem.dispose();
  scene.add(spider.group);
  const ambient = new THREE.HemisphereLight(0xffffff, 0x8a9891, 1.25);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xfff2dc, 3.5);
  key.position.set(-3.5, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -2.8, right: 2.8, top: 2.8, bottom: -2.8, near: 0.5, far: 14 });
  key.shadow.normalBias = 0.018; key.shadow.bias = -0.00008;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc6e7f4, 3.2);
  rim.position.set(4, 3.2, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-5, 1.5, -2); scene.add(fill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ color: 0x31483f, opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.026; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(8, 32, 0xb6c8bd, 0xcad4ca);
  grid.position.y = -0.024; grid.material.transparent = true; grid.material.opacity = 0.14; scene.add(grid);
  const contactGeometry = new THREE.RingGeometry(0.052, 0.059, 28);
  contactGeometry.rotateX(-Math.PI / 2);
  const contactMaterial = new THREE.MeshBasicMaterial({ color: 0x3f998a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
  const contacts = [];
  const supportGeometry = new THREE.BufferGeometry();
  supportGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
  const support = new THREE.Line(supportGeometry, new THREE.LineBasicMaterial({ color: 0x369781, transparent: true, opacity: 0.5 }));
  support.visible = false; scene.add(support);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.035, 80);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.55, 0);
  controls.enableDamping = true; controls.dampingFactor = 0.1;
  controls.minDistance = 0.6; controls.maxDistance = spider.maxViewDistance ?? 12;
  controls.minPolarAngle = 0.06; controls.maxPolarAngle = Math.PI * 0.49;
  controls.enablePan = true; controls.panSpeed = 0.45;
  controls.rotateSpeed = 0.58; controls.zoomSpeed = 0.7;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  let quality = 'balanced', tween = null, width = 1, height = 1;
  // Shape-changing models may publish sampled whole-cycle geometry points so the home view fits tightly without clipping.
  const framePoints = spider.framePoints?.length ? spider.framePoints : null;
  const bounds = framePoints ? new THREE.Box3().setFromPoints(framePoints) : new THREE.Box3().setFromObject(spider.group);
  const center = bounds.getCenter(new THREE.Vector3());
  const extent = bounds.getSize(new THREE.Vector3());
  const corners = [];
  if (framePoints) for (const p of framePoints) corners.push(p.clone().sub(center));
  else for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z).sub(center));
  let fittedView = 'home';
  const views = { home: [3.4, 2.65, 4.1], side: [5, 1.2, .5], top: [.06, 6, .08], front: [0, 1.2, 5], detail: [-3.5, 1.9, 4], exploded: [3.3, 2.6, 4.3], ...(spider.views || {}) };
  function view(name = 'home', immediate = false) {
    fittedView = name;
    const direction = new THREE.Vector3(...(views[name] || views.home)).normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const verticalTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const horizontalTan = verticalTan * Math.max(.1, camera.aspect);
    const distance = Math.max(...corners.map(p => p.dot(direction) + Math.max(Math.abs(p.dot(right)) / horizontalTan, Math.abs(p.dot(up)) / verticalTan))) * 1.12;
    const target = center.clone();
    if (name === 'exploded') target.y += extent.y * .15;
    const pos = direction.multiplyScalar(distance * (name === 'exploded' ? 1.48 : name === 'detail' ? .55 : 1)).add(target);
    if (immediate) { camera.position.copy(pos); controls.target.copy(target); controls.update(); tween = null; }
    else tween = { time: 0, from: camera.position.clone(), to: pos, targetFrom: controls.target.clone(), targetTo: target };
  }
  controls.addEventListener('start', () => { fittedView = null; tween = null; });
  controls.addEventListener('change', invalidate);
  function resize() {
    const { width: nextWidth, height: nextHeight } = container.getBoundingClientRect();
    if (!nextWidth || !nextHeight) return;
    const changed = width !== nextWidth || height !== nextHeight;
    width = nextWidth; height = nextHeight;
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (changed && fittedView) view(fittedView, true);
    if (changed) invalidate();
  }
  const normalMaps = new WeakMap();
  function prepareMaterials() {
    scene.traverse(object => {
      const material = object.material;
      if (!material?.isMeshStandardMaterial) return;
      if (!normalMaps.has(material)) normalMaps.set(material, material.normalMap);
      const normalMap = quality === 'low' ? null : normalMaps.get(material);
      if (material.normalMap !== normalMap) { material.normalMap = normalMap; material.needsUpdate = true; }
    });
  }
  function setQuality(value) {
    quality = value;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    prepareMaterials();
    const shadowType = value === 'low' ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    if (renderer.shadowMap.type !== shadowType) {
      renderer.shadowMap.type = shadowType;
      scene.traverse(object => { if (object.material) object.material.needsUpdate = true; });
    }
    const shadowSize = value === 'high' ? 2048 : 1024;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    resize();
  }
  function setTheme(dark) {
    const bg = dark ? 0x182329 : 0xf1f2ee;
    scene.background.setHex(bg); scene.fog.color.setHex(bg);
    floor.material.color.setHex(dark ? 0x050b10 : 0x31483f);
    grid.material.opacity = dark ? 0.09 : 0.14;
    renderer.toneMappingExposure = dark ? 1.05 : 1.18;
  }
  let down = null, multiGesture = false;
  const pointers = new Set();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  renderer.domElement.addEventListener('pointerdown', e => {
    if (!pointers.size) multiGesture = false;
    pointers.add(e.pointerId); multiGesture ||= pointers.size > 1;
    down = { x: e.clientX, y: e.clientY, time: performance.now(), id: e.pointerId }; tween = null;
  });
  renderer.domElement.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); down = null; });
  renderer.domElement.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId);
    if (multiGesture || !down || e.pointerId !== down.id || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7 || performance.now() - down.time > 600) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    ndc.set((e.clientX - bounds.left) / bounds.width * 2 - 1, -(e.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(spider.pickables, true);
    for (const hit of hits) {
      const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face?.materialIndex || 0] : hit.object.material;
      if (material?.clippingPlanes?.some(plane => plane.distanceToPoint(hit.point) < 0)) continue;
      if (material?.transparent && material.opacity < 0.2) continue;
      let obj = hit.object;
      let id = hit.instanceId != null ? obj.userData.instanceParts?.[hit.instanceId] : null;
      while (obj && !id) { id = obj.userData.partId; obj = obj.parent; }
      if (id) { onPick(id, hit.point); break; }
    }
    down = null;
  });
  renderer.domElement.addEventListener('keydown', e => {
    if (e.key === 'Home') view();
    else if (e.key === '+' || e.key === '=') zoom(0.85);
    else if (e.key === '-') zoom(1.15);
  });
  function zoom(factor) { fittedView = null; tween = null; camera.position.sub(controls.target).multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance).add(controls.target); controls.update(); invalidate(); }
  function render(state, dt, showSupport = false, explode = 0) {
    if (tween) {
      tween.time += dt;
      const x = Math.min(1, tween.time / 0.8), e = 1 - (1 - x) ** 3;
      camera.position.lerpVectors(tween.from, tween.to, e); controls.target.lerpVectors(tween.targetFrom, tween.targetTo, e);
      if (x === 1) tween = null;
    }
    controls.update();
    const feet = (state.legs || []).filter(leg => Array.isArray(leg.foot)).map((leg, i) => ({ ...leg, foot: state.contactFeet?.[i] || leg.foot }));
    while (contacts.length < feet.length) { const marker = new THREE.Mesh(contactGeometry, contactMaterial); contacts.push(marker); scene.add(marker); }
    for (let i = 0; i < contacts.length; i++) {
      if (feet[i]) contacts[i].position.set(feet[i].foot[0], -0.018, feet[i].foot[2]);
      contacts[i].visible = !!feet[i]?.stance && explode < 0.05;
    }
    support.visible = showSupport && state.supportHull?.length >= 3 && explode < 0.05;
    if (support.visible) {
      const h = state.supportHull;
      if (supportGeometry.attributes.position.count < h.length + 1) supportGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((h.length + 1) * 3), 3));
      for (let i = 0; i <= h.length; i++) supportGeometry.attributes.position.setXYZ(i, h[i % h.length][0], -0.017, h[i % h.length][1]);
      supportGeometry.setDrawRange(0, h.length + 1); supportGeometry.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
  }
  const observer = new ResizeObserver(resize); observer.observe(container);
  setQuality(quality); view('home', true);
  return {
    renderer, scene, camera, controls, render, resize, view, setQuality, setTheme, zoom,
    get animating() { return !!tween; },
    async warm() { await renderer.compileAsync(scene, camera); },
    dispose() { observer.disconnect(); controls.dispose(); env.dispose(); key.shadow.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); contactGeometry.dispose(); contactMaterial.dispose(); supportGeometry.dispose(); support.material.dispose(); floor.geometry.dispose(); floor.material.dispose(); grid.geometry.dispose(); grid.material.dispose(); },
  };
}
