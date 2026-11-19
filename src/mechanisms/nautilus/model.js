import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, TENTACLES, sample, poseAt } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('NAUTILUS N12 · jet-display hover');
  const { add, rod, fasteners } = kit;
  let current = sample(0), disposed = false;
  const basis = new THREE.Matrix4();
  const part = (id, name, system, purpose, how, parent, explode = [0, .12, 0]) => kit.part({ id: `nautilus.${id}`, name, system, function: purpose, how, detail: `${purpose} ${how}`, material: 'Pale alloy domes / teal actuators / copper chamber ribs', unit: 'm · rad' }, parent, explode);
  const box = (n, m, p, s, e = [0, 0, 0], detail = false) => add(n, 'box', m, p, s, e, detail);
  const sphere = (n, m, p, s) => add(n, 'sphere', m, p, s);
  function place(n, p, f) {
    basis.set(f[0], f[1], f[2], 0, f[3], f[4], f[5], 0, f[6], f[7], f[8], 0, 0, 0, 0, 1);
    n.position.fromArray(p); n.quaternion.setFromRotationMatrix(basis);
  }
  const body = part('body', 'Suspended aperture chassis', 'Jet-display hover', 'Carry the coiled shell and twelve forward manipulators without a floor stand.', 'The chassis stays fixed above the floor. Every gesture is produced by relative joints; hover is a presentation mode, not calculated thrust.');
  box(body, 'dark', [0, -.13, -.39], [.53, .43, .60]);
  for (const s of [-1, 1]) {
    rod(body, 'titanium', [s * .28, -.24, -.85], [s * .28, -.24, .49], .035);
    for (const z of [-.71, -.36, .12]) box(body, 'teal', [s * .30, -.13, z], [.09, .23, .12]);
  }
  for (const z of [-.70, -.36, .1]) rod(body, 'copper', [-.31, -.26, z], [.31, -.26, z], .023);
  const core = part('shell.core', 'Filled sagittal coiling nucleus', 'Chambered shell', 'Maintain a continuous filled pale spiral silhouette even while the lateral service shutters open.', 'A full rounded central dome bridges two full lateral domes. This is a thick mechanical shell in the YZ plane, never an empty hoop or tube.', body, [0, .15, .13]);
  sphere(core, 'shell', [0, .14, .26], [.235, .875, .875]);
  add(core, 'cylinder', 'teal', [0, .14, .26], [.205, .68, .205], [0, 0, Math.PI / 2]);
  for (const s of [-1, 1]) add(core, 'cylinder', 'brass', [s * .35, .14, .26], [.12, .025, .12], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 24; i++) {
    const a = TAU * i / 24;
    const n = part(`shell.chamber${String(i + 1).padStart(2, '0')}`, `Radial chamber septum ${i + 1}`, 'Chamber partitions', 'Separate adjacent radial service chambers with a substantial transverse partition.', 'The solid septum spans the shell thickness; bronze exposed edges and paired service conduits become visible when the full side plates swing away.', body, [0, .12 * Math.cos(a), .12 * Math.sin(a)]);
    n.position.set(0, .14, .26); n.rotation.x = a;
    box(n, 'teal', [0, .535, 0], [.65, .58, .028]);
    for (const side of [-1, 1]) {
      box(n, 'copper', [side * .337, .535, 0], [.027, .58, .042]);
      rod(n, 'titanium', [side * .24, .30, .028], [side * .24, .78, .028], .012);
      box(n, 'brass', [side * .26, .77, .045], [.10, .045, .022]);
    }
  }
  const shutters = [-1, 1].map(side => {
    const id = side < 0 ? 'L' : 'R';
    const n = part(`shell.shutter${id}`, `${id} full domed service shutter`, 'Shell access', 'Close the coiled shell with a full pale domed plate instead of an open skeletal outline.', 'The upper hinge swings the entire thick lateral dome outward, exposing the radial septa. Smaller full overlapping domes emphasize the coiling nucleus.', body, [side * .36, .14, .08]);
    n.position.set(side * .25, .60, .26);
    sphere(n, 'shell', [0, -.46, 0], [.155, .89, .89]);
    sphere(n, 'shell', [side * .075, -.445, .015], [.125, .54, .54]);
    sphere(n, 'shell', [side * .15, -.43, .035], [.085, .265, .265]);
    add(n, 'cylinder', 'teal', [side * .19, -.43, .035], [.087, .095, .087], [0, 0, Math.PI / 2]);
    add(n, 'ring', 'brass', [side * .241, -.43, .035], [.09, .09, .09], [0, Math.PI / 2, 0]);
    rod(n, 'titanium', [0, -.03, -.24], [0, -.03, .24], .033);
    fasteners(n, [[0, .01, -.18], [0, .01, .18]], .013);
    const ridge = part(`shell.spiral${id}`, `${id} continuous coiling ridge`, 'Spiral reinforcement', 'Trace one continuous expanding copper and teal spiral over the full solid shell face.', 'Sixty-four joined rigid ridge spans follow a logarithmically growing radius through one and three-fifths turns; the stripe belongs to the service shutter.', n, [side * .10, 0, 0]);
    const point = (j, lift) => {
      const u = j / 64, r = .085 * Math.exp(Math.log(.84 / .085) * u), a = Math.PI - 3.2 * Math.PI * (1 - u);
      const dome = .155 * Math.sqrt(1 - (r / .90) ** 2);
      const nucleus = r < .24 ? .15 + .085 * Math.sqrt(1 - (r / .265) ** 2) : r < .53 ? .075 + .125 * Math.sqrt(1 - (r / .54) ** 2) : 0;
      return [side * (Math.max(dome, nucleus) + lift), -.46 + r * Math.sin(a), r * Math.cos(a)];
    };
    for (let j = 0; j < 64; j++) {
      rod(ridge, 'teal', point(j, .01), point(j + 1, .01), .027);
      rod(ridge, 'copper', point(j, .033), point(j + 1, .033), .011);
    }
    return { n, side };
  });
  const mantle = part('mantle', 'Fat compressing mantle bell', 'Mantle drive', 'Project a substantial living-chamber analogue through the forward shell aperture.', 'The teal ellipsoidal bell pulses axially on its own frame. Its compression is prescribed and does not calculate pressure, displaced water or thrust.', body, [0, -.16, -.20]);
  mantle.position.set(0, -.13, -.59);
  sphere(mantle, 'teal', [0, 0, 0], [.43, .345, .50]);
  const skirts = Array.from({ length: 8 }, (_, i) => {
    const a = TAU * i / 8, n = part(`mantle.skirt${i + 1}`, `Mantle overlapping lamella ${i + 1}`, 'Mantle ventilation', 'Overlap the broad mantle with a thick individually hinged cooling lamella.', 'A delayed angular wave opens each pale lamella relative to the compressing bell, preserving a filled mantle instead of a bundle of tubes.', mantle, [.08 * Math.cos(a), .08 * Math.sin(a), -.10]);
    n.position.set(.31 * Math.cos(a), .25 * Math.sin(a), .10); n.rotation.z = a - Math.PI / 2;
    sphere(n, 'shell', [0, .035, -.07], [.145, .095, .33]);
    rod(n, 'copper', [0, .125, .15], [0, .125, -.29], .016);
    for (let k = 0; k < 3; k++) box(n, 'teal', [0, .12, .09 - k * .10], [.12, .023, .045]);
    fasteners(n, [[0, .13, .18]], .01);
    return n;
  });
  const collar = part('aperture', 'Open forward aperture collar', 'Forward aperture', 'Frame a dark open mouth around the mantle and all twelve forward tentacle sockets.', 'An oval lip surrounds an unfilled centre facing negative Z. The hood sits above the beak; no shell plate closes the forward reach corridor.', body, [0, 0, -.18]);
  for (const [m, z, r] of [['dark', -.89, 1], ['shell', -.84, 1.07], ['copper', -.945, .98]]) add(collar, 'ring', m, [0, -.13, z], [.43 * r, .365 * r, .34]);
  const hood = part('hood', 'Overhanging armoured hood', 'Head armour', 'Make a broad pale canopy above the beak rather than an octopus-like bare spherical head.', 'The hood rocks on its own transverse hinge while its layered brow and longitudinal teal crest remain rigid.', body, [0, .25, -.14]);
  hood.position.set(0, .28, -.62);
  sphere(hood, 'shell', [0, .015, -.10], [.47, .17, .40]);
  sphere(hood, 'teal', [0, .13, -.08], [.11, .06, .31]);
  for (const s of [-1, 1]) {
    rod(hood, 'copper', [s * .34, .05, .10], [s * .34, .05, -.30], .016);
    box(hood, 'dark', [s * .31, .10, -.05], [.055, .025, .19]);
  }
  const eyes = [-1, 1].map(side => {
    const id = side < 0 ? 'L' : 'R';
    const n = part(`eye${id}`, `${id} independent eye yaw yoke`, 'Scanning eyes', 'Sweep a lateral eye pod independently of the shell and tentacle crown.', 'A yaw bearing follows its own two-rate sinusoid; the separate optic pitches at a different integer rate.', body, [side * .18, .12, -.12]);
    n.position.set(side * .49, .11, -.77);
    add(n, 'cylinder', 'brass', [0, 0, 0], [.083, .12, .083]);
    box(n, 'teal', [0, .06, 0], [.18, .07, .15]);
    const pod = part(`eye${id}.optic`, `${id} pitching optical pod`, 'Scanning eyes', 'Aim a large cyan aperture from a protected thick dark optical capsule.', 'Pitch is relative to the yaw yoke, not the body. The capsule is an automaton sensor interpretation, not a reconstructed biological eye.', n, [side * .07, .12, -.10]);
    pod.position.y = .11;
    sphere(pod, 'dark', [0, 0, 0], [.14, .115, .14]);
    sphere(pod, 'shell', [0, .065, .01], [.145, .075, .125]);
    sphere(pod, 'lens', [0, 0, -.128], [.081, .081, .026]);
    add(pod, 'ring', 'brass', [0, 0, -.143], [.088, .088, .07]);
    return { n, pod };
  });
  const beaks = [-1, 1].map(side => {
    const n = part(`beak${side < 0 ? 'lower' : 'upper'}`, `${side < 0 ? 'Lower' : 'Upper'} opposed beak`, 'Beak mechanism', 'Open a compact opposing beak beneath the protective hood and inside the tentacle crown.', 'A transverse hinge changes the gap between two rigid hooked jaws. It illustrates a grasp gesture without food contact or force calculation.', body, [0, side * .10, -.17]);
    n.position.set(0, -.13 + side * .065, -1.0);
    sphere(n, 'dark', [0, side * .025, -.04], [.10, .062, .12]);
    add(n, 'cone', 'brass', [0, -side * .005, -.14], [.06, .15, .06], [-Math.PI / 2 + side * .35, 0, 0]);
    rod(n, 'titanium', [-.115, 0, 0], [.115, 0, 0], .025);
    return { n, side };
  });
  const siphon = part('siphon', 'Ventral siphon yaw cradle', 'Jet display', 'Aim the articulated exhaust beneath the forward mantle.', 'The cradle sweeps laterally relative to the chassis. The displayed nozzle suggests jet propulsion but no fluid or reaction forces are solved.', body, [0, -.21, -.13]);
  siphon.position.set(0, -.48, -.67);
  sphere(siphon, 'teal', [0, 0, 0], [.15, .12, .16]);
  add(siphon, 'cylinder', 'brass', [0, -.08, 0], [.10, .045, .10]);
  const nozzle = part('siphon.nozzle', 'Pitching thick-walled jet nozzle', 'Jet display', 'Turn the visible forward exhaust independently of its yaw cradle.', 'A dark bore and paired heavy annular lips retain an open nozzle silhouette through its pitch sweep.', siphon, [0, -.10, -.18]);
  rod(nozzle, 'teal', [0, 0, -.02], [0, 0, -.26], .10);
  for (const z of [-.07, -.28]) add(nozzle, 'ring', 'copper', [0, 0, z], [.112, .112, .10]);
  add(nozzle, 'cylinder', 'dark', [0, 0, -.281], [.085, .012, .085], [Math.PI / 2, 0, 0]);
  const valve = part('siphon.valve', 'Nozzle butterfly vane', 'Jet display', 'Modulate the exhaust opening with a separately articulating solid vane.', 'The internal butterfly rocks in phase with the pump bank; its opening is an instructional timing cue rather than a flow-rate calculation.', nozzle, [.12, 0, -.10]);
  valve.position.z = -.296;
  box(valve, 'brass', [0, 0, 0], [.13, .026, .018]);
  rod(valve, 'titanium', [0, -.083, 0], [0, .083, 0], .012);
  const pumps = Array.from({ length: 6 }, (_, i) => {
    const a = TAU * i / 6;
    const sleeve = part(`pump${i + 1}`, `Radial pump sleeve ${i + 1}`, 'Phased pump bank', 'Package a fixed pressure sleeve inside the forward service chamber.', 'Six sleeves surround the timing rotor. Their separately sliding pistons use sixty-degree phase offsets and remain inside fixed-length bores.', body, [.13 * Math.cos(a), .13 * Math.sin(a), -.05]);
    sleeve.position.set(.25 * Math.cos(a), -.10 + .25 * Math.sin(a), -.50); sleeve.rotation.z = a - Math.PI / 2;
    add(sleeve, 'cylinder', 'dark', [0, 0, 0], [.055, .19, .055]);
    for (const y of [-.09, .09]) add(sleeve, 'cylinder', 'copper', [0, y, 0], [.064, .027, .064]);
    rod(sleeve, 'copper', [.071, -.07, 0], [.071, .08, 0], .010);
    const plunger = part(`pump${i + 1}.piston`, `Pump ${i + 1} polished piston`, 'Phased pump bank', 'Expose a measurable reciprocating stroke relative to the stationary sleeve.', 'The rod and crosshead translate together by 130 mm peak to peak; the sleeve does not stretch and no hydraulic pressure is inferred.', sleeve, [0, .17, 0]);
    add(plunger, 'cylinder', 'titanium', [0, .105, 0], [.022, .22, .022]);
    box(plunger, 'brass', [0, .22, 0], [.085, .033, .063]);
    sphere(plunger, 'dark', [0, .22, 0], [.027, .027, .04]);
    return plunger;
  });
  const outer = part('gyro', 'Three-axis rotor outer gimbal', 'Timing rotor', 'Suspend an independently rotating three-axis timing display inside the mantle chamber.', 'A bronze ring turns about X while the inner ring and rotor turn about their own Y and Z axes at integer cycle ratios.', body, [0, .20, -.18]);
  outer.position.set(0, -.08, -.59);
  add(outer, 'ring', 'brass', [0, 0, 0], [.185, .185, .185]);
  rod(outer, 'titanium', [-.21, 0, 0], [.21, 0, 0], .015);
  const inner = part('gyro.inner', 'Timing rotor inner gimbal', 'Timing rotor', 'Support the central wheel on a second parent-relative rotation axis.', 'The teal inner ring stays rigid while rotating inside the outer bearing. The nested transform makes relative motion directly inspectable.', outer, [.13, .10, 0]);
  add(inner, 'ring', 'teal', [0, 0, 0], [.145, .145, .145], [Math.PI / 2, 0, 0]);
  rod(inner, 'titanium', [0, -.16, 0], [0, .16, 0], .012);
  const rotor = part('gyro.rotor', 'Five-turn copper timing wheel', 'Timing rotor', 'Provide a readable rotating centre within both independently moving gimbals.', 'An asymmetric cyan timing marker makes the five-turn wheel rotation visible. This is a conceptual clocked rotor, not a solved power source.', inner, [0, .12, -.10]);
  add(rotor, 'cylinder', 'copper', [0, 0, 0], [.084, .023, .084], [Math.PI / 2, 0, 0]);
  add(rotor, 'ring', 'titanium', [0, 0, .014], [.05, .05, .05]);
  for (let i = 0; i < 16; i++) {
    const a = TAU * i / 16;
    box(rotor, 'copper', [.10 * Math.sin(a), .10 * Math.cos(a), 0], [.0144, .024, .023], [0, 0, -a]);
  }
  add(rotor, 'bolt', 'dark', [0, 0, .014], [.02, .012, .02], [Math.PI / 2, 0, 0]);
  sphere(rotor, 'lens', [.067, 0, .022], [.022, .022, .022]);
  const tentacles = TENTACLES.map(({ id }) => {
    const socket = part(`tentacle${id}`, `Tentacle ${id} radial root socket`, 'Twelve-arm crown', 'Anchor one of twelve substantial forward-reaching manipulators around the open mantle aperture.', 'The root socket establishes a radial bending plane. Eight downstream rigid members articulate serially rather than stretching a spline or moving as one body.', body, [0, 0, -.14]);
    add(socket, 'cylinder', 'dark', [0, -.028, 0], [.082, .055, .082]);
    add(socket, 'ring', 'copper', [0, -.052, 0], [.084, .084, .084], [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) box(socket, 'shell', [side * .072, .005, 0], [.036, .085, .09]);
    const links = [];
    for (let j = 0; j < 8; j++) {
      const r = .065 - .03 * j / 7, l = D.length;
      const n = part(`tentacle${id}.link${j + 1}`, `Tentacle ${id} rigid link ${j + 1}`, 'Serial tentacle articulation', `Carry the ${j + 1}th exact 125 mm link of tentacle ${id}, tapering from a substantial root toward a rounded tip.`, 'The local positive-Y endpoints remain exactly one link length apart. Delayed bending and small orthogonal twists create alternating reach, curl and recovery waves.', j ? links[j - 1] : socket, [0, .025, .035]);
      add(n, 'cylinder', 'teal', [0, l / 2, 0], [r, l, r]);
      sphere(n, 'brass', [0, 0, 0], [r * .98, r * .98, r * .98]);
      sphere(n, 'shell', [0, l * .52, r * .20], [r * .91, l * .45, r * .77]);
      rod(n, 'titanium', [-r * 1.13, 0, 0], [r * 1.13, 0, 0], .018);
      for (const side of [-1, 1]) {
        rod(n, 'copper', [side * r * .81, .014, -r * .45], [side * r * .81, l - .014, -r * .45], .007);
        add(n, 'bolt', 'titanium', [side * r * 1.16, 0, 0], [.023, .012, .023], [0, 0, Math.PI / 2], true);
      }
      for (const y of [.011, l - .011]) add(n, 'cylinder', 'dark', [0, y, 0], [r * 1.01, .016, r * 1.01]);
      box(n, 'rubber', [0, l * .55, -r * .87], [r * 1.1, l * .51, .018]);
      links.push(n);
    }
    const tip = part(`tentacle${id}.tip`, `Tentacle ${id} rounded tactile tip`, 'Tactile tooling', 'Finish each one-metre chain with a compact non-piercing tactile end tool.', 'A solid rounded cap and two contact pads belong to the final rigid frame. They indicate intended sensing, not collision or contact-force simulation.', links.at(-1), [0, .06, 0]);
    tip.position.y = D.length;
    sphere(tip, 'teal', [0, .012, 0], [.038, .050, .038]);
    for (const s of [-1, 1]) sphere(tip, 'rubber', [s * .023, .037, 0], [.018, .026, .024]);
    add(tip, 'ring', 'copper', [0, 0, 0], [.036, .036, .036], [Math.PI / 2, 0, 0]);
    return { socket, links };
  });
  const bind = [];
  kit.group.traverse(n => { if (n.userData.partId) bind.push({ n, p: n.position.clone(), q: n.quaternion.clone(), s: n.scale.clone() }); });
  function update(state = current, options = {}) {
    if (disposed) return;
    current = state;
    for (const b of bind) { b.n.position.copy(b.p); b.n.quaternion.copy(b.q); b.n.scale.copy(b.s); }
    place(body, state.origin, state.bodyFrame);
    shutters.forEach(({ n, side }, i) => { n.rotation.z = side * state.rates.shutters[i]; });
    mantle.scale.set(1 - state.rates.mantle * .35, 1 - state.rates.mantle * .45, 1 + state.rates.mantle);
    skirts.forEach((n, i) => { n.rotation.x = state.rates.skirts[i]; });
    hood.rotation.x = state.rates.hood;
    eyes.forEach(({ n, pod }, i) => { n.rotation.y = state.rates.eyes[i].yaw; pod.rotation.x = state.rates.eyes[i].pitch; });
    beaks.forEach(({ n, side }) => { n.rotation.x = side * state.rates.beak; });
    siphon.rotation.y = state.rates.siphon.yaw; nozzle.rotation.x = state.rates.siphon.pitch; valve.rotation.y = state.rates.siphon.valve;
    pumps.forEach((n, i) => { n.position.y = state.rates.pump[i]; });
    [outer, inner, rotor].forEach((n, i) => { place(n, n.position.toArray(), state.rates.gyro[i]); });
    tentacles.forEach(({ socket, links }, i) => {
      const t = state.tentacles[i]; place(socket, t.root.map((v, j) => v - state.origin[j]), t.base);
      links.forEach((n, j) => place(n, [0, j ? D.length : 0, 0], t.links[j].localFrame));
    });
    // Kit uploads must stay root-local so an external scene transform is applied only once.
    kit.group.updateWorldMatrix(true, false);
    const rootWorld = kit.group.matrixWorld.clone(); kit.group.matrixWorld.identity();
    kit.sync(options); kit.group.matrixWorld.copy(rootWorld); kit.group.updateWorldMatrix(false, true);
  }
  const framePoints = [], cells = new Set(), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  const extrema = Array.from({ length: 6 }, () => null);
  for (const reach of [.65, 1, 1.25]) for (const display of [0, 1]) for (let j = 0; j < 32; j++) {
    update(poseAt(j / 32, { reach, display }), { quality: 'high' });
    for (const mesh of kit.pickables) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox;
      for (let k = 0; k < mesh.count; k++) {
        mesh.getMatrixAt(k, matrix);
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          point.set(x, y, z).applyMatrix4(matrix);
          for (let axis = 0; axis < 3; axis++) for (let sign = 0; sign < 2; sign++) {
            const index = axis * 2 + sign;
            if (!extrema[index] || (sign ? point.getComponent(axis) > extrema[index].getComponent(axis) : point.getComponent(axis) < extrema[index].getComponent(axis))) extrema[index] = point.clone();
          }
          const key = `${Math.round(point.x / .075)},${Math.round(point.y / .075)},${Math.round(point.z / .075)}`;
          if (!cells.has(key)) { cells.add(key); framePoints.push(point.clone()); }
        }
      }
    }
  }
  framePoints.push(...extrema); update(sample(0), { quality: 'high' });
  return { group: kit.group, update, parts: kit.parts, stats: kit.stats, framePoints, maxViewDistance: 24,
    views: { home: [3.8, 2.8, -6], front: [0, 2.2, -6], side: [6, 2.4, -.5], top: [.1, 7, -.4], detail: [3, 2.7, -4], exploded: [4.8, 3.7, -5.8] },
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (!disposed) { disposed = true; kit.dispose(); kit.group.clear(); } } };
}
