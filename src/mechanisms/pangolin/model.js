import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, LEGS, TAU, sample, poseAt, add as vadd, sub, mul, mm, ry, rx } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('MANIS P12 · mechanical pangolin');
  const { add, rod, gear, aim } = kit;
  let current = sample(0), disposed = false;
  const matrix = new THREE.Matrix4();
  const part = (id, name, system, purpose, how, parent, explode = [0, .12, 0]) => kit.part({ id: `pangolin.${id}`, name, system,
    function: purpose, how, detail: `${purpose} ${how}`, material: 'Ghostable pale shell / bronze edges / teal alloy', unit: 'm · rad' }, parent, explode);
  const box = (n, m, p, s, e = [0, 0, 0], detail = false) => add(n, 'box', m, p, s, e, detail);
  const sphere = (n, m, p, s) => add(n, 'sphere', m, p, s);
  const sideName = s => s < 0 ? 'Left' : 'Right';
  function place(n, origin, f) {
    matrix.set(f[0], f[1], f[2], 0, f[3], f[4], f[5], 0, f[6], f[7], f[8], 0, 0, 0, 0, 1);
    n.position.fromArray(origin); n.quaternion.setFromRotationMatrix(matrix);
  }
  function shingle(n, width, direction = -1, height = 0) {
    // A solid diamond, not a flat rectangular tile: bronze rim, thick shell, domed ridge.
    const y = direction * width * .30;
    box(n, 'brass', [0, y, height], [width * .70, width * .70, .038], [0, 0, Math.PI / 4]);
    box(n, 'shell', [0, y, height + .022], [width * .65, width * .65, .042], [0, 0, Math.PI / 4]);
    sphere(n, 'shell', [0, y, height + .035], [width * .31, width * .32, .030]);
    box(n, 'teal', [0, y, height + .064], [width * .15, width * .15, .018], [0, 0, Math.PI / 4]);
    rod(n, 'brass', [-width * .24, 0, height], [width * .24, 0, height], .017);
  }
  function member(n, length, width) {
    box(n, 'dark', [0, length / 2, 0], [width * 1.45, length, width * 1.35]);
    sphere(n, 'teal', [0, length * .48, 0], [width * 1.14, length * .48, width]);
    for (const y of [0, length]) {
      add(n, 'cylinder', 'teal', [0, y, 0], [width * .72, width * 2.3, width * .72], [0, 0, Math.PI / 2]);
      add(n, 'ring', 'brass', [width * 1.17, y, 0], [width * .65, width * .65, width * .65], [0, Math.PI / 2, 0]);
    }
    rod(n, 'copper', [-width * .82, .05, width * .52], [-width * .82, length - .05, width * .52], .012, true);
  }
  function actuator(id, name) {
    const barrel = part(`${id}.barrel`, `${name} pressure barrel`, 'Hydraulics', 'House a rigid sleeve between the moving limb attachment pins.', 'The 220 mm cylinder aims at the sampled output eye without changing length; a separate ram slides through its gland.');
    add(barrel, 'cylinder', 'dark', [0, .11, 0], [.035, .22, .035]);
    for (const y of [.015, .205]) add(barrel, 'cylinder', 'copper', [0, y, 0], [.041, .025, .041]);
    const piston = part(`${id}.rod`, `${name} sliding rod`, 'Hydraulics', 'Bridge the variable exposed distance from the gland to the output eye.', 'Only the polished exposed rod span changes. Both endpoints follow the analytic clevis positions rather than a decorative oscillation.');
    add(piston, 'cylinder', 'titanium', [0, .5, 0], [.016, 1, .016]);
    const eye = part(`${id}.eye`, `${name} output clevis`, 'Hydraulics', 'Connect the moving output end of the piston to the lower limb.', 'The bronze spherical eye stays at the computed attachment point through stance, digging and the defensive crouch.');
    sphere(eye, 'brass', [0, 0, 0], [.041, .041, .041]);
    return { barrel, piston, eye };
  }
  const body = part('body', 'Central low-slung chassis', 'Body frame', 'Carry the arched trunk, hip drives and posterior tail bearing.', 'This narrow internal keel moves with the body datum, while the eight deep overlapping barrel sections provide the filled silhouette.');
  box(body, 'teal', [0, -.11, 0], [.48, .24, 1.25]);
  const belly = part('belly', 'Continuous ventral armour', 'Body frame', 'Close the underside of the oval barrel without using a display stand.', 'A deep ellipsoidal belly joins the overlapping trunk housings; its lowest surface remains clear of the level paw soles.', body, [0, -.18, 0]);
  sphere(belly, 'shell', [0, -.09, 0], [.40, .27, .69]);

  const trunk = Array.from({ length: 8 }, (_, i) => {
    const width = [.39, .46, .51, .53, .53, .49, .43, .34][i], depth = [.29, .35, .38, .39, .39, .36, .32, .26][i];
    const n = part(`trunk.${i + 1}`, `Trunk vertebra ${i + 1}`, 'Eight-link barrel', 'Carry one rigid segment of the deep, continuous oval trunk.', 'A full plated ellipsoid overlaps its neighbours around a fixed 170 mm spine member. Small relative yaw and pitch retain reliable leg reach.', undefined, [0, .09 + i * .015, 0]);
    box(n, 'dark', [0, D.trunk / 2, 0], [.12, D.trunk, .12]);
    sphere(n, 'shell', [0, D.trunk / 2, -.015], [width, D.trunk * .94, depth]);
    sphere(n, 'teal', [0, D.trunk / 2, -.075], [width * .91, D.trunk * .96, depth * .76]);
    const joint = part(`trunk.${i + 1}.joint`, `Spine journal ${i + 1}`, 'Eight-link barrel', 'Locate the rigid joint at the start of this barrel station.', 'A transverse bronze journal and dark pin sit at the exact serial-chain origin; the surrounding armour can be ghosted for inspection.', n, [.10, 0, .08]);
    add(joint, 'cylinder', 'brass', [0, 0, 0], [.085, .29, .085], [0, 0, Math.PI / 2]);
    const ribs = [-1, 1].map(s => {
      const r = part(`trunk.${i + 1}.rib${s < 0 ? 'L' : 'R'}`, `${sideName(s)} breathing rib ${i + 1}`, 'Breathing ribs', 'Expand a curved mechanical rib relative to its own vertebra.', 'A phased longitudinal hinge opens the segmented rib beneath the armour. This ventilation gesture does not model biological respiration.', n, [s * .12, 0, .08]);
      r.position.set(s * .08, D.trunk / 2, .10);
      const pts = [[0, 0, 0], [s * width * .58, 0, .08], [s * width * .78, 0, -.13], [s * width * .55, 0, -.31]];
      for (let j = 0; j < 3; j++) rod(r, 'copper', pts[j], pts[j + 1], .025);
      return { r, s };
    });
    const scales = Array.from({ length: 7 }, (_, j) => {
      const angle = (j - 3) * .48;
      const plate = part(`trunk.${i + 1}.scale${j + 1}`, `Armour station ${i + 1} shingle ${j + 1}`, 'Fifty-six hinged scales', 'Wrap the broad trunk in an overlapping, thick diamond-shaped armour plate.', 'Each shingle has its own tangent hinge. The defensive wave raises its pointed trailing edge while the filled barrel remains underneath.', n, [Math.sin(angle) * .17, 0, Math.cos(angle) * .20]);
      plate.position.set(width * Math.sin(angle), .045 + (j % 2) * .035, depth * Math.cos(angle));
      shingle(plate, .31 + width * .08);
      return { plate, angle };
    });
    return { n, ribs, scales };
  });

  const neck = part('neck', 'Independent sniffing neck', 'Head and neck', 'Bridge the front barrel station to the mobile long-snouted head.', 'A 140 mm rigid neck cartridge pitches and yaws independently from the small trunk wave; the snout then moves on its own second joint.');
  box(neck, 'dark', [0, .07, 0], [.14, .14, .14]);
  sphere(neck, 'shell', [0, .07, 0], [.25, .16, .22]);
  add(neck, 'ring', 'brass', [0, 0, 0], [.18, .18, .18], [Math.PI / 2, 0, 0]);
  const head = part('head', 'Long tapered pangolin snout', 'Head and neck', 'Carry a low wedge-shaped skull with a long narrow muzzle facing forward.', 'Successively smaller overlapping ellipsoids form a continuous tapered snout, not a beak or a hollow frame; the head has independent sniff pitch and yaw.');
  sphere(head, 'teal', [0, 0, -.10], [.235, .18, .26]);
  for (let j = 0; j < 4; j++) {
    sphere(head, 'shell', [0, -.005 - j * .012, -.15 - j * .13], [.205 - j * .045, .15 - j * .031, .205 - j * .023]);
  }
  sphere(head, 'dark', [0, -.047, -.655], [.055, .045, .052]);
  for (const s of [-1, 1]) sphere(head, 'lens', [s * .026, -.035, -.698], [.009, .009, .009]);
  const jaw = part('head.jaw', 'Hinged narrow lower jaw', 'Sniff and feeding gesture', 'Open a thin lower jaw under the tapered muzzle.', 'The mandible rotates about a transverse skull pin during sniffing; no biting force or food contact is computed.', head, [0, -.10, -.08]);
  jaw.position.set(0, -.075, -.12);
  sphere(jaw, 'teal', [0, -.012, -.18], [.125, .044, .28]);
  sphere(jaw, 'shell', [0, -.017, -.38], [.047, .025, .12]);
  const ears = [-1, 1].map(s => {
    const e = part(`head.ear${s < 0 ? 'L' : 'R'}`, `${sideName(s)} small ear cup`, 'Scanning sensors', 'Flick a small rounded ear independently of the skull.', 'A compact bronze-rimmed cup pivots on its local root with a phase offset from the opposite ear, keeping the pangolin silhouette low.', head, [s * .12, .06, 0]);
    e.position.set(s * .195, .105, -.02);
    sphere(e, 'shell', [s * .015, .026, 0], [.054, .080, .040]);
    sphere(e, 'copper', [s * .015, .030, -.024], [.036, .054, .020]);
    return e;
  });
  const eyes = [-1, 1].map(s => {
    const id = `head.eye${s < 0 ? 'L' : 'R'}`;
    const e = part(id, `${sideName(s)} eye yaw bearing`, 'Scanning sensors', 'Turn the small forward-looking optical housing across the scene.', 'A bronze journal carries a separate pitch pod so its local scan remains visible even while the whole head sniffs or tucks.', head, [s * .10, .08, -.08]);
    e.position.set(s * .185, .061, -.245);
    sphere(e, 'brass', [0, 0, 0], [.057, .055, .052]);
    const optic = part(`${id}.optic`, `${sideName(s)} eye pitch pod`, 'Scanning sensors', 'Tilt a cyan lens inside the rotating eye bearing.', 'The lens and dark cup pitch relative to their yaw journal at a different integer rate, producing a repeatable two-axis scan.', e, [0, .05, -.07]);
    sphere(optic, 'dark', [0, 0, -.024], [.045, .044, .045]);
    sphere(optic, 'lens', [0, 0, -.059], [.028, .027, .016]);
    return { e, optic };
  });
  const tongue = [];
  for (let i = 0; i < 3; i++) {
    const n = part(`tongue.${i + 1}`, `Retractile tongue link ${i + 1}`, 'Sniff and feeding gesture', 'Extend one short rigid link of the retractile inspection tongue.', 'Three small serial links articulate beneath the snout. Retraction slides the chain into the muzzle rather than scaling the link lengths.', i ? tongue[i - 1] : head, [0, -.04, -.08]);
    n.position.set(0, i ? 0 : -.056, i ? -D.tongue : -.39);
    rod(n, 'copper', [0, 0, 0], [0, 0, -D.tongue], .012 - i * .002);
    sphere(n, 'brass', [0, 0, 0], [.017, .017, .017]);
    tongue.push(n);
  }

  const gears = [0, 1, 2].map(i => {
    const n = part(`drive.gear${i + 1}`, `Hip transfer gear ${i + 1}`, 'Hip transmission', 'Distribute the visual gait timing across three adjacent spur wheels.', 'Equal pitch radii and alternate rotation show a transfer train on the posterior service face. Tooth contact and transmitted torque are not solved.', body, [0, .10, .18]);
    n.position.set((i - 1) * .15, -.05, .735); n.rotation.x = Math.PI / 2; gear(n, .075, 16, .026); return n;
  });
  const flywheel = part('drive.flywheel', 'Bronze flank flywheel', 'Hip transmission', 'Expose a timing rotor on the side of the low barrel.', 'An asymmetric copper spoke makes rotation readable. The rotor follows twelve turns per choreography without implying an energy or inertia calculation.', body, [.16, .10, 0]);
  flywheel.position.set(.475, -.04, .29);
  add(flywheel, 'ring', 'brass', [0, 0, 0], [.14, .14, .14], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; rod(flywheel, i ? 'teal' : 'copper', [0, 0, 0], [0, .13 * Math.sin(a), .13 * Math.cos(a)], .016); }
  const pumps = [-1, 1].map(s => {
    const n = part(`pump.${s < 0 ? 'L' : 'R'}`, `${sideName(s)} ventilation pump`, 'Ventilation drive', 'House a small rigid pump sleeve behind the shoulder.', 'A fixed teal cylinder remains on the body while a separate polished plunger follows an offset reciprocation wave.', body, [s * .12, -.06, 0]);
    n.position.set(s * .36, -.16, -.18);
    add(n, 'cylinder', 'teal', [0, 0, 0], [.055, .15, .055]);
    const plunger = part(`pump.${s < 0 ? 'L' : 'R'}.plunger`, `${sideName(s)} ventilation plunger`, 'Ventilation drive', 'Slide through the fixed sleeve to illustrate ventilation timing.', 'The polished rod translates relative to its own barrel and stays overlapped with the gland at both stroke limits.', n, [0, .10, 0]);
    add(plunger, 'cylinder', 'titanium', [0, .065, 0], [.021, .16, .021]);
    box(plunger, 'brass', [0, .15, 0], [.085, .026, .055]);
    return plunger;
  });

  const legs = LEGS.map(l => {
    const id = `leg.${l.id}`, name = `${sideName(l.side)} ${l.hind ? 'hind' : 'fore'} leg`;
    const hip = part(`${id}.hip`, `${name} root bearing`, 'Four-leg crawl', 'Seat a stout limb in the moving oval barrel.', 'The root cartridge follows the corresponding trunk station while the level paw is solved independently in world space.', undefined, [l.side * .12, 0, 0]);
    sphere(hip, 'teal', [0, 0, 0], [.14, .13, .14]);
    const upper = part(`${id}.upper`, `${name} upper member`, 'Four-leg crawl', 'Carry the solved knee on a rigid 420 mm load member.', 'A thick teal housing surrounds an exact-length core. Two-link inverse kinematics preserves knee flex instead of stretching the limb toward a distant foot.', undefined, [l.side * .18, .05, 0]);
    member(upper, D.upper, .115);
    const lower = part(`${id}.lower`, `${name} lower member`, 'Four-leg crawl', 'Close the rigid linkage from knee to the elevated ankle pin.', 'The 460 mm lower member meets an ankle 100 mm above the paw datum, leaving a thick level sole safely above the floor.', undefined, [l.side * .23, .04, 0]);
    member(lower, D.lower, .085);
    for (const [nameEnd, n, length, w] of [['upper', upper, D.upper, .115], ['lower', lower, D.lower, .085]]) {
      const cover = part(`${id}.${nameEnd}-cover`, `${name} ${nameEnd} armour`, 'Limb armour', 'Protect the stout load member with an independently selectable solid cover.', 'A domed shell stays fixed to the rigid member; its thickness remains present at low quality and the pale material can be ghosted.', n, [0, 0, .13]);
      sphere(cover, 'shell', [0, length * .46, w * .67], [w * 1.18, length * .38, w * .67]);
    }
    const pinion = part(`${id}.pinion`, `${name} knee sector`, 'Joint transmission', 'Make the relative knee articulation visible on its transverse pin.', 'The bronze wheel is attached to the lower member at the solved knee, rather than spinning independently of the actual leg bend.', lower, [.10, 0, 0]);
    pinion.position.x = .118; pinion.rotation.z = Math.PI / 2; gear(pinion, .066, 12, .022);
    const foot = part(`${id}.foot`, `${name} broad level paw`, 'Grounded paws', 'Support the animal on a broad sole without a plinth.', 'During support the paw is locked in world space. Return windows lift only one paw at a time, while the digging stroke belongs to a forepaw.', undefined, [l.side * .25, -.04, 0]);
    box(foot, 'rubber', [0, -.0225, 0], [.27, .045, .23]);
    sphere(foot, 'shell', [0, .022, -.005], [.14, .062, .14]);
    rod(foot, 'teal', [0, 0, 0], [0, D.ankle, 0], .048);
    for (let j = 0; j < 3; j++) {
      const toe = part(`${id}.toe${j + 1}`, `${name} broad claw ${j + 1}`, 'Three-toed claws', 'Spread the paw load across one of three broad digging claws.', 'A thick bronze toe and tapered titanium tip stay level with the paw; their actual undersides meet the same prescribed floor plane.', foot, [(j - 1) * .05, -.02, -.10]);
      toe.position.set((j - 1) * .087, 0, -.10);
      box(toe, 'brass', [0, -.020, -.065], [.074, .050, .18]);
      add(toe, 'cone', 'titanium', [0, -.010, -.195], [.033, .14, .033], [-Math.PI / 2, 0, 0]);
    }
    return { hip, upper, lower, foot, ram: actuator(`${id}.ram`, name) };
  });

  const tail = D.tail.map((length, i) => {
    const width = .385 * (1 - i / 12) ** .95, depth = .18 * (1 - i / 14);
    const n = part(`tail.${i + 1}`, `Tail vertebra ${i + 1}`, 'Twelve-link sweeping tail', 'Continue the filled body into a broad tapering rigid tail.', 'Each link advances by its fixed length after a relative yaw and pitch. Increasing phase lag creates a travelling sweep and a defensive flank curl.', undefined, [0, .10, .10 + i * .018]);
    box(n, 'dark', [0, length / 2, 0], [width * 1.1, length, depth * .90]);
    sphere(n, 'teal', [0, length * .49, 0], [width, length * .82, depth]);
    const joint = part(`tail.${i + 1}.joint`, `Tail journal ${i + 1}`, 'Tail transmission', 'Locate the pivot joining adjacent rigid tail vertebrae.', 'The bronze pin is centred at the exact sampled chain origin; its crosswise length tapers with the surrounding armour.', n, [.08, 0, .06]);
    add(joint, 'cylinder', 'brass', [0, 0, 0], [depth * .47, width * 1.5, depth * .47], [0, 0, Math.PI / 2]);
    const cover = part(`tail.${i + 1}.cover`, `Tail dorsal shingle ${i + 1}`, 'Overlapping tail armour', 'Maintain a thick continuous tail instead of a necklace of separated beads.', 'A broad domed cover overlaps adjacent vertebrae and carries a pointed shell diamond. The taper narrows progressively toward the terminal point.', n, [0, 0, .14]);
    sphere(cover, 'shell', [0, length * .46, depth * .25], [width * 1.04, length * .91, depth * .83]);
    shingle(cover, Math.max(.095, width * .86), 1, depth * .96);
    const flanks = [-1, 1].map(s => {
      const f = part(`tail.${i + 1}.scale${s < 0 ? 'L' : 'R'}`, `${sideName(s)} tail shingle ${i + 1}`, 'Overlapping tail armour', 'Close the side of the broad tail with a separate hinged scale.', 'Each flank diamond overlaps the dorsal cover and responds to a delayed hinge wave, adding local armour motion to the serial tail sweep.', n, [s * .10, 0, .08]);
      f.position.set(s * width * .68, length * .30, depth * .52);
      shingle(f, Math.max(.075, width * .64), 1); return { f, s };
    });
    if (i === 11) add(n, 'cone', 'shell', [0, length + .045, 0], [.044, .12, .032]);
    return { n, flanks };
  });

  const bind = [];
  kit.group.traverse(n => { if (n.userData.partId) bind.push({ n, p: n.position.clone(), q: n.quaternion.clone(), s: n.scale.clone() }); });
  function update(state = current, options = {}) {
    if (disposed) return;
    current = state;
    for (const b of bind) { b.n.position.copy(b.p); b.n.quaternion.copy(b.q); b.n.scale.copy(b.s); }
    place(body, state.origin, state.bodyFrame);
    trunk.forEach((t, i) => {
      const s = state.trunk[i]; place(t.n, s.start, s.frame);
      t.ribs.forEach(({ r, s: side }) => { r.rotation.y = side * state.rates.ribs[i]; });
      t.scales.forEach(({ plate, angle }, j) => { const p = plate.position.toArray(); place(plate, p, mm(ry(angle), rx(-state.rates.scales[i * 7 + j]))); });
    });
    place(neck, state.neck.start, state.neck.frame); place(head, state.head.origin, state.head.frame);
    jaw.rotation.x = -state.head.jaw;
    ears.forEach((n, i) => { n.rotation.z = state.head.ears[i]; n.rotation.y = state.head.ears[i] * .6; });
    eyes.forEach(({ e, optic }, i) => { e.rotation.y = state.head.eyes[i].yaw; optic.rotation.x = state.head.eyes[i].pitch; });
    tongue[0].position.z -= state.head.tongue * .29;
    tongue.forEach((n, i) => { n.rotation.x = state.head.tongue * .12 * Math.sin(state.phase * TAU * 6 - i * .5); });
    gears.forEach((n, i) => { n.rotation.y = (i % 2 ? -1 : 1) * state.rates.drive + (i % 2 ? Math.PI / 16 : 0); });
    flywheel.rotation.x = state.rates.flywheel;
    pumps.forEach((n, i) => { n.position.y = state.rates.pumps[i]; });
    legs.forEach((n, i) => {
      const l = state.legs[i]; place(n.hip, l.root, state.trunk[l.station].frame);
      place(n.upper, l.root, l.frames.upper); place(n.lower, l.knee, l.frames.lower); n.foot.position.fromArray(l.foot);
      aim(n.ram.barrel, l.ram.a, l.ram.b);
      aim(n.ram.piston, vadd(l.ram.a, mul(sub(l.ram.b, l.ram.a), .20 / l.ram.length)), l.ram.b);
      n.ram.piston.scale.y = l.ram.length - .20; n.ram.eye.position.fromArray(l.ram.b);
    });
    tail.forEach((n, i) => {
      const s = state.tail[i]; place(n.n, s.start, s.frame);
      n.flanks.forEach(({ f, s: side }) => { f.rotation.y = side * (.70 + state.rates.tailPlates[i]); });
    });
    // Upload root-local matrices so scene placement is applied only once.
    kit.group.updateWorldMatrix(true, false);
    const rootWorld = kit.group.matrixWorld.clone(); kit.group.matrixWorld.identity();
    kit.sync(options); kit.group.matrixWorld.copy(rootWorld); kit.group.updateWorldMatrix(false, true);
  }
  const framePoints = [], seen = new Set(), point = new THREE.Vector3(), instance = new THREE.Matrix4();
  const extrema = Array.from({ length: 6 }, () => null);
  const phases = [...Array.from({ length: 48 }, (_, i) => i / 48), ...LEGS.flatMap(l => l.swings.map(e => (e[0] + e[1]) / 2))];
  for (const input of [undefined, ...[.65, 1.25].flatMap(stride => [0, 1].map(armour => ({ stride, armour })))]) for (const p of phases) {
    update(poseAt(p, input));
    for (const mesh of kit.pickables) {
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox(); const b = mesh.geometry.boundingBox;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, instance);
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          point.set(x, y, z).applyMatrix4(instance);
          for (let k = 0; k < 6; k++) { const axis = ['x', 'y', 'z'][k >> 1]; if (!extrema[k] || (k % 2 ? point[axis] > extrema[k][axis] : point[axis] < extrema[k][axis])) extrema[k] = point.clone(); }
          const key = `${Math.round(point.x / .065)},${Math.round(point.y / .065)},${Math.round(point.z / .065)}`;
          if (!seen.has(key)) { seen.add(key); framePoints.push(point.clone()); }
        }
      }
    }
  }
  framePoints.push(...extrema); update(sample(0));
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update, framePoints, maxViewDistance: 24,
    views: { home: [3.3, 2.5, -5.2], front: [0, 1.7, -5.6], side: [5.7, 1.8, 0], top: [.1, 6.2, -.1], detail: [-3.0, 2.0, -4.3], exploded: [3.8, 3.1, -5.3] },
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (!disposed) { disposed = true; kit.dispose(); kit.group.clear(); } } };
}
