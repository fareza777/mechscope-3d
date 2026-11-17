import { createMechanicalKit } from '../mechanical-kit.js';
import { R, TAU, framePoint, pose, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('ASTRA R9'), { group, parts, stats, add, rod } = kit;
  group.userData.kinematicVisualization = 'Exact axial-staggered slider-cranks; analytic 720-degree valve timing. Not a production master-rod engine. Sliding rocker pads; no cam-contact or combustion solver.';
  const bindings = [], cylinders = [], rotating = [];
  const settings = { quality: 'balanced', mode: 'solid', explode: 0, selectedId: null };
  let disposed = false, previous = sample();
  const make = (id, name, system, fn, how, material = 'titanium', explode = [0, 0, 0]) => kit.part({ id, name, system, function: fn, how, material, unit: 'm', detail: `${name}: ${how}` }, undefined, explode);
  const axial = (n, mat, x, y, z, radius, length, detail = false) => add(n, 'cylinder', mat, [x, y, z], [radius, length, radius], [Math.PI / 2, 0, 0], detail);
  const ring = (n, mat, p, radius, axialScale = radius, detail = false) => add(n, 'ring', mat, p, [radius, radius, axialScale], [0, 0, 0], detail);
  const boltZ = (n, p, detail = true) => {
    axial(n, 'dark', ...p, .009, .004, detail);
    add(n, 'bolt', 'titanium', [p[0], p[1], p[2] + .004], [.0065, .007, .0065], [Math.PI / 2, 0, 0], detail);
  };
  const circleTube = (n, mat, radius, z, tube, segments = 40) => {
    for (let k = 0; k < segments; k++) {
      const a = k * TAU / segments, b = (k + 1) * TAU / segments;
      rod(n, mat, [radius * Math.sin(a), R.centreY + radius * Math.cos(a), z], [radius * Math.sin(b), R.centreY + radius * Math.cos(b), z], tube);
    }
  };
  // The sole floor contact is the fixture. Uprights sit behind the crank sweep.
  for (const side of [-1, 1]) {
    const foot = make(`fixture.foot.${side}`, `${side < 0 ? 'Port' : 'Starboard'} grounded skid`, 'Service fixture', 'Spread the engine load into the floor.', 'The rubber lower faces lie at y = 0; the skid never moves during explosion.', 'dark');
    add(foot, 'box', 'rubber', [side * .46, .012, -.12], [.24, .024, .72]);
    add(foot, 'box', 'dark', [side * .46, .04, -.12], [.15, .04, .68]);
    for (const z of [-.4, .16]) kit.fasteners(foot, [[side * .46, .063, z]], .013);
    const post = make(`fixture.post.${side}`, `${side < 0 ? 'Port' : 'Starboard'} service upright`, 'Service fixture', 'Support the rear bearing bridge.', 'Braced posts join the grounded skids to the rear axial support, outside the rod stack.', 'teal');
    add(post, 'box', 'teal', [side * .46, .405, -.43], [.048, .71, .055]);
    rod(post, 'titanium', [side * .46, .07, .17], [side * .46, .69, -.43], .015);
    rod(post, 'dark', [side * .46, .76, -.43], [0, R.centreY, -.37], .032);
    for (let j = 0; j < 5; j++) boltZ(post, [side * .46, .17 + j * .11, -.393]);
  }
  const bridge = make('fixture.bridge', 'Rear bearing bridge and cross ties', 'Service fixture', 'Close the grounded support load path.', 'A rear crossbeam joins both uprights; diagonal braces reach the stationary crank bearing.', 'dark');
  rod(bridge, 'dark', [-.46, .12, -.43], [.46, .12, -.43], .022);
  rod(bridge, 'dark', [-.46, .76, -.43], [.46, .76, -.43], .024);
  for (const z of [-.35, .35]) {
    const bearing = make(`crank.bearing.${z}`, `${z < 0 ? 'Rear' : 'Front'} main bearing saddle`, 'Crank support', 'Locate the two end journals without filling the rod lanes.', 'Only the external end journals run on the crank axis; there is no central shaft through the moving rods.', 'shell', [0, .01, Math.sign(z) * .05]);
    ring(bearing, 'shell', [0, R.centreY, z], .083, .13);
    ring(bearing, 'brass', [0, R.centreY, z], .057, .075);
    for (let j = 0; j < 10; j++) {
      const a = j * TAU / 10;
      axial(bearing, 'titanium', .069 * Math.cos(a), R.centreY + .069 * Math.sin(a), z, .005, .024);
      boltZ(bearing, [.083 * Math.cos(a), R.centreY + .083 * Math.sin(a), z + .025]);
    }
    for (const side of [-1, 1]) {
      rod(bearing, 'dark', [side * .054, R.centreY - .058, z], [side * .46, .76, z], .016);
      if (z > 0) rod(bearing, 'dark', [side * .46, .76, z], [side * .46, .07, .17], .016);
      else rod(bearing, 'dark', [side * .46, .76, z], [side * .46, .76, -.43], .016);
    }
  }
  // Ten thin webs bound nine lanes. The eccentric journal spans every web;
  // axis journals exist only outside the stack, so rods may sweep across the axis.
  for (let j = 0; j < 10; j++) {
    const z = (j - 4.5) * R.lane;
    const web = make(`crank.web.${j}`, `Crank separator web ${j + 1}`, 'Cranktrain', 'Transmit torque between the eccentric spine and the end journals.', 'A 10 mm web lies between adjacent rod lanes, leaving a positive axial swept-geometry gap.', 'titanium', [0, .015, (j - 4.5) * .009]);
    web.position.y = R.centreY;
    axial(web, 'titanium', 0, 0, z, .137, .01);
    axial(web, 'dark', 0, -.082, z, .049, .016);
    ring(web, 'brass', [0, R.crank, z + .006], .023, .018);
    for (let k = 0; k < 6; k++) boltZ(web, [.108 * Math.sin(k * TAU / 6), .108 * Math.cos(k * TAU / 6), z + .007]);
    rotating.push(web);
  }
  const spine = make('crank.eccentric', 'Extended eccentric crankpin spine', 'Cranktrain', 'Engage all nine big-end bearings with one real eccentric journal.', 'The journal extends across all ten webs. Its centre is 100 mm from the rotation axis.', 'brass', [0, .015, 0]);
  spine.position.y = R.centreY;
  axial(spine, 'brass', 0, R.crank, 0, .019, .562);
  rotating.push(spine);
  const hub = make('crank.hub', 'Stepped end journals and inspection hub', 'Cranktrain', 'Bring the rotating crank out to the fixture bearings.', 'Front and rear main journals stop at the outer webs, never traversing a rod lane.', 'titanium', [0, .015, .045]);
  hub.position.y = R.centreY;
  for (const side of [-1, 1]) {
    axial(hub, 'titanium', 0, 0, side * .326, .041, .108);
    axial(hub, 'dark', 0, 0, side * .397, .069, .032);
    ring(hub, 'brass', [0, 0, side * .415], .049, .035);
    for (let k = 0; k < 8; k++) boltZ(hub, [.052 * Math.cos(k * TAU / 8), .052 * Math.sin(k * TAU / 8), side * .418]);
  }
  rotating.push(hub);
  const cam = make('timing.ring', 'Half-speed timing witness ring', 'Valve timing', 'Make the complete four-stroke cycle visible.', 'This marked rear timing ring turns once per two crank revolutions; valve lift is analytic, not a contact simulation.', 'brass', [0, .025, -.08]);
  cam.position.y = R.centreY;
  ring(cam, 'brass', [0, 0, -.432], .17, .055);
  for (let k = 0; k < 36; k++) {
    const a = k * TAU / 36;
    add(cam, 'box', k % 4 ? 'dark' : 'copper', [.171 * Math.sin(a), .171 * Math.cos(a), -.447], [.009, .019, .006], [0, 0, -a]);
  }
  const manifoldSpecs = [['intake', .68, -.41, 'teal'], ['exhaust', .735, -.35, 'titanium'], ['ignition', .205, .44, 'copper']];
  for (const [name, radius, z, mat] of manifoldSpecs) {
    const n = make(`service.${name}`, `Annular ${name} distribution header`, 'Service plumbing', `Distribute the ${name} circuit around the nine-cylinder star.`, 'A segmented tube forms a genuinely open annulus; each branch terminates on this header.', mat, [0, .015, Math.sign(z) * .055]);
    circleTube(n, mat, radius, z, name === 'ignition' ? .007 : .016);
    for (let j = 0; j < 9; j++) {
      const a = j * TAU / 9;
      axial(n, 'brass', radius * Math.sin(a), R.centreY + radius * Math.cos(a), z, .021, .043);
      if (name === 'ignition' && j % 3 === 0) rod(n, 'dark', [.083 * Math.sin(a), R.centreY + .083 * Math.cos(a), .35], [radius * Math.sin(a), R.centreY + radius * Math.cos(a), z], .006);
    }
  }
  const caseFrame = make('fixture.case-frame', 'Open rear crankcase mounting spider', 'Cylinder support', 'Carry all nine stationary barrels back to the grounded main bearing.', 'An eighteen-segment rear mounting hoop and nine spokes support axial barrel stays behind the entire crank-web stack.', 'dark', [0, .01, -.025]);
  circleTube(caseFrame, 'dark', .324, -.39, .010, 18);
  for (let i = 0; i < 9; i++) {
    const a = i * TAU / 9;
    rod(caseFrame, 'titanium', [.078 * Math.sin(a), R.centreY + .078 * Math.cos(a), -.35], [.324 * Math.sin(a), R.centreY + .324 * Math.cos(a), -.39], .009);
  }
  for (let i = 0; i < 9; i++) {
    const angle = i * TAU / 9, suffix = `Cylinder ${i + 1}`;
    const cp = (key, name, system, fn, how, mat = 'titanium', outward = .035, dz = 0) => {
      const n = make(`c${i + 1}.${key}`, `${suffix} · ${name}`, system, fn, how, mat, [Math.sin(angle) * outward, Math.cos(angle) * outward + .01, dz]);
      n.position.set(0, R.centreY, (i - 4) * R.lane); n.rotation.z = -angle; return n;
    };
    const barrel = cp('barrel', 'ribbed open barrel', 'Cylinder cooling', 'Guide the piston while exposing its stroke through the open liner.', 'Twelve cooling hoops and four narrow liner ribs leave inspection windows; low quality retains three cooling hoops plus both structural end hoops.', 'shell');
    for (let k = 0; k < 12; k++) add(barrel, 'ring', 'shell', [0, .32 + k * .021, 0], [.068 + (k % 3) * .002, .068 + (k % 3) * .002, .026], [Math.PI / 2, 0, 0], k % 5 !== 0);
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2;
      rod(barrel, 'dark', [.062 * Math.cos(a), .32, .062 * Math.sin(a)], [.062 * Math.cos(a), .56, .062 * Math.sin(a)], .006);
    }
    for (const y of [.318, .559]) add(barrel, 'ring', 'titanium', [0, y, 0], [.064, .064, .03], [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) {
      const head = cp(`head.${side}`, `${side < 0 ? 'rear' : 'front'} split head`, 'Cylinder head', 'Carry the valve guides and head tie studs.', 'The independently selectable open half-head has a split seam, ribbed corners and service fasteners rather than an opaque solid cap.', 'shell', .065, side * .025);
      for (const x of [-.059, .059]) {
        add(head, 'box', 'shell', [x, .597, side * .048], [.026, .077, .036]);
        for (let k = 0; k < 8; k++) add(head, 'box', 'shell', [x, .565 + k * .009, side * .049], [.037, .0035, .049], [0, 0, 0], k % 2 === 1);
        rod(head, 'titanium', [x, .548, side * .048], [x, .648, side * .048], .004);
        boltZ(head, [x, .64, side * .072]);
        if (side > 0) {
          const pivotX = Math.sign(x) * .065;
          rod(head, 'titanium', [x, .631, .03], [pivotX, .675, .03], .006);
          axial(head, 'brass', pivotX, .675, .043, .006, .042);
        }
      }
      add(head, 'box', 'shell', [0, .613, side * .065], [.12, .026, .016]);
    }
    const piston = cp('piston', 'windowed skirt piston', 'Reciprocating train', 'Turn chamber loading into wrist-pin force.', 'A short crown and two skirt rails move as one rigid body along the exact slider axis.', 'titanium', .025);
    add(piston, 'cylinder', 'titanium', [0, .027, 0], [.055, .022, .055]);
    for (const x of [-.042, .042]) add(piston, 'box', 'titanium', [x, -.012, 0], [.016, .064, .073]);
    for (const y of [.023, .032]) add(piston, 'ring', 'dark', [0, y, 0], [.052, .052, .012], [Math.PI / 2, 0, 0]);
    const wrist = cp('wrist', 'extended wrist pin', 'Reciprocating train', 'Join the rod eye to both piston skirt bosses.', 'The 126 mm axial wrist pin seats into both skirt rails, with visible end retainers.', 'brass', .025);
    axial(wrist, 'brass', 0, 0, 0, .013, .126);
    for (const z of [-.066, .066]) ring(wrist, 'dark', [0, 0, z], .016, .018, true);
    const conrod = cp('rod', '400 mm rigid connecting rod', 'Reciprocating train', 'Close the exact crank-to-wrist distance.', 'Both bearing eyes and the beam are one fixed-size assembly; its axial envelope stays between adjacent crank webs.', 'titanium', .025);
    rod(conrod, 'titanium', [0, .028, 0], [0, R.rod - .020, 0], .008);
    add(conrod, 'box', 'titanium', [0, R.rod / 2, 0], [.022, R.rod - .058, .010]);
    for (const [y, r] of [[0, .026], [R.rod, .018]]) {
      ring(conrod, 'titanium', [0, y, 0], r, .041);
      ring(conrod, 'brass', [0, y, 0], r * .82, .032, true);
    }
    for (const x of [-.027, .027]) axial(conrod, 'dark', x, 0, 0, .006, .017);
    const valveNodes = [], pushNodes = [], rockerNodes = [], springNodes = [];
    const tappet = cp('tappets', 'paired tappet guide blocks', 'Valve timing', 'Constrain the two pushrod lower ends.', 'Each open guide carries a translating shoe. Motion is derived from exact pushrod length and rocker endpoints.', 'dark', .04);
    for (const sign of [-1, 1]) {
      for (const x of [sign * .095 - .01, sign * .095 + .01]) add(tappet, 'box', 'dark', [x, .29, .045], [.006, .12, .023]);
      add(tappet, 'box', 'brass', [sign * .095, .235, .045], [.026, .008, .025]);
    }
    for (const [j, kind] of ['intake', 'exhaust'].entries()) {
      const sign = j ? 1 : -1;
      const valve = cp(`valve.${kind}`, `${kind} poppet valve`, 'Valve timing', `Open the ${kind} passage once per four-stroke cycle.`, 'The stem, head and retainer translate by the sampled lift; the broad top pad permits the rocker tip to slide.', j ? 'titanium' : 'brass', .065);
      add(valve, 'cylinder', j ? 'titanium' : 'brass', [sign * .035, .547, .045], [.016, .008, .016]);
      add(valve, 'cylinder', 'titanium', [sign * .035, .61, .045], [.004, .126, .004]);
      add(valve, 'cylinder', 'dark', [sign * .035, .645, .045], [.014, .005, .014]);
      add(valve, 'box', 'brass', [sign * .035, .673, .045], [.029, .004, .016]);
      const push = cp(`pushrod.${kind}`, `${kind} rigid pushrod and tappet shoe`, 'Valve timing', 'Carry guided tappet motion to the outer rocker arm.', 'The fixed 410 mm pushrod is aimed between solved endpoints, never scaled; its lower shoe remains in the guide.', 'titanium', .055);
      rod(push, 'titanium', [0, 0, 0], [0, R.pushrod, 0], .004);
      axial(push, 'brass', 0, R.pushrod, 0, .007, .012);
      add(push, 'box', 'brass', [0, .004, 0], [.012, .022, .017]);
      const rocker = cp(`rocker.${kind}`, `${kind} pivoted rocker`, 'Valve timing', 'Reverse the pushrod rise into valve opening.', 'The lever pivots about its fixed 65 mm lateral offset; the inner sliding pad depresses the valve by the prescribed lift.', 'titanium', .065);
      rod(rocker, 'titanium', [-R.rocker, 0, 0], [R.rocker, 0, 0], .006);
      axial(rocker, 'brass', 0, 0, 0, .012, .027);
      for (const x of [-R.rocker, R.rocker]) axial(rocker, 'dark', x, 0, 0, .005, .012);
      const spring = cp(`spring.${kind}`, `${kind} return spring`, 'Valve timing', 'Return the valve to its seat while retaining preload.', 'Eighteen helical segments compress between the fixed spring seat and the translating retainer; this is not a spring-force model.', 'dark', .065);
      for (let k = 0; k < 18; k++) {
        const a = k * TAU * 4 / 18, b = (k + 1) * TAU * 4 / 18;
        rod(spring, 'dark', [.009 * Math.cos(a), .06 * k / 18, .009 * Math.sin(a)], [.009 * Math.cos(b), .06 * (k + 1) / 18, .009 * Math.sin(b)], .0017);
      }
      // The entire coil and its lower seat remain present in low quality.
      add(spring, 'cylinder', 'dark', [0, 0, 0], [.011, .002, .011]);
      valveNodes.push(valve); pushNodes.push(push); rockerNodes.push(rocker); springNodes.push(spring);
    }
    const plumbing = cp('branches', 'paired intake and exhaust branches', 'Service plumbing', 'Connect this split head to both rear annular headers.', 'Bent branch tubes terminate exactly at the annular header centreline and the lateral head ports.', 'copper', .065, -.02);
    for (const [j, radial, targetZ, material] of [[0, .68, -.41, 'teal'], [1, .735, -.35, 'titanium']]) {
      const sign = j ? 1 : -1, laneZ = (i - 4) * R.lane;
      const points = [[sign * .058, .603, -.045], [sign * .089, .603, -.095], [sign * .089, radial, targetZ - laneZ], [0, radial, targetZ - laneZ]];
      for (let k = 0; k < points.length - 1; k++) rod(plumbing, material, points[k], points[k + 1], .01);
      for (const p of points) axial(plumbing, material, ...p, .011, .022);
      axial(plumbing, 'brass', sign * .058, .603, -.044, .016, .018);
    }
    const ignition = cp('ignition', 'copper ignition lead and spark terminal', 'Ignition service', 'Connect the front ignition ring to an insulated head terminal.', 'The lead follows a three-dimensional service route in front of this barrel, then returns to its spark terminal.', 'copper', .07, .035);
    const points = [[0, .205, .44 - (i - 4) * R.lane], [.12, .36, .15], [.105, .66, .12], [0, .651, .095]];
    for (let k = 0; k < points.length - 1; k++) rod(ignition, 'copper', points[k], points[k + 1], .004);
    add(ignition, 'cylinder', 'rubber', [0, .636, .095], [.011, .045, .011]);
    for (let k = 0; k < 6; k++) add(ignition, 'ring', 'shell', [0, .619 + .006 * k, .095], [.012, .012, .012], [Math.PI / 2, 0, 0], true);
    cylinders.push({ piston, wrist, conrod, valveNodes, pushNodes, rockerNodes, springNodes });
  }
  // Capture every bind transform before the first sync, including all fixed parts.
  group.traverse(n => { if (n.userData.partId) bindings.push([n, n.position.clone(), n.quaternion.clone(), n.scale.clone()]); });
  function update(state = previous, options = {}) {
    if (disposed) return;
    if (state) previous = state;
    Object.assign(settings, options);
    settings.explode = Math.min(1, Math.max(0, Number.isFinite(settings.explode) ? settings.explode : 0));
    if (!['solid', 'xray', 'cutaway'].includes(settings.mode)) settings.mode = 'solid';
    if (!['low', 'balanced', 'high'].includes(settings.quality)) settings.quality = 'balanced';
    for (const [n, p, q, s] of bindings) { n.position.copy(p); n.quaternion.copy(q); n.scale.copy(s); }
    const s = pose(previous.phase ?? ((previous.driveAngle || 0) / (2 * TAU)), previous.valveLift);
    for (const n of rotating) n.rotation.z = -s.driveAngle;
    cam.rotation.z = -s.camAngle;
    cylinders.forEach((c, i) => {
      const p = s.cylinders[i], angle = i * TAU / 9;
      c.piston.position.fromArray(p.pistonPin); c.wrist.position.fromArray(p.pistonPin);
      kit.aim(c.conrod, p.crankPin, p.pistonPin);
      p.valves.forEach((v, j) => {
        const sign = j ? 1 : -1;
        c.valveNodes[j].position.fromArray(framePoint(i, 0, -v.lift));
        kit.aim(c.pushNodes[j], v.pushStart, v.pushEnd);
        c.rockerNodes[j].position.fromArray(framePoint(i, sign * .065, .675, .045));
        c.rockerNodes[j].rotation.z = -angle + v.rockerAngle;
        c.springNodes[j].position.fromArray(framePoint(i, sign * .035, .585, .045));
        c.springNodes[j].scale.y = (.06 - v.lift) / .06;
      });
    });
    kit.sync({ ...settings, selectedId: settings.highlight === false ? null : settings.selectedId });
    // Kit batches retain capacity; picking metadata must describe submitted instances only.
    for (const mesh of kit.pickables) mesh.userData.instanceParts.length = mesh.count;
  }
  function dispose() {
    if (disposed) return;
    disposed = true; kit.dispose(); group.clear();
    Object.assign(stats, { instances: 0, triangles: 0, drawCalls: 0, selectableParts: 0 });
  }
  update();
  return { group, parts, stats, update, get pickables() { return disposed ? [] : kit.pickables; }, dispose };
}
