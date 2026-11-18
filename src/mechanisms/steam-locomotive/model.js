import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, DEFAULT_INPUTS, cycleHz, sample, poseAt } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('TITAN S6 · suspended workshop locomotive');
  const nodes = [], wheels = [], sideLinks = [], engines = [], pilotWheels = [], cabControls = [], springNodes = [];
  const add = kit.add, rod = kit.rod;
  let disposed = false, lastState = sample(0);
  function part(id, name, system, purpose, how, parent, explode = [0, .12, 0], material = 'Machined titanium, dark steel and brass') {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  }
  const axial = (n, mat, p, r, length, axis = 'z', detail = false) => add(n, 'cylinder', mat, p, [r, length, r], axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0], detail);
  function eye(n, p, radius = .025, detail = false) {
    add(n, 'ring', 'titanium', p, [radius, radius, radius], [0, 0, 0], detail);
    axial(n, 'brass', p, radius * .50, .020, 'z', detail);
  }
  function plate(n, length, width = .025) {
    for (const x of [-width * .52, width * .52]) rod(n, 'titanium', [x, 0, 0], [x, length, 0], width * .28);
    for (const y of [0, length]) eye(n, [0, y, 0], width);
    for (let k = 1; k <= 5; k++) {
      add(n, 'box', 'dark', [0, length * k / 6, 0], [width * 1.15, .018, .010]);
      add(n, 'bolt', 'brass', [0, length * k / 6, .009], [.006, .008, .006], [Math.PI / 2, 0, 0], true);
    }
  }
  // The tires are intentionally suspended above the rail heads. The service
  // jacks support the bearing boxes; no translational wheel motion is implied.
  for (const side of [-1, 1]) {
    const rail = part(`rail.${side}`, `${side < 0 ? 'Near' : 'Far'} open service rail`, 'Service support', 'Defines the railway bench datum under the suspended tires.', 'A narrow head, web and foot leave the workshop underside open.', undefined, [0, 0, 0]);
    for (const [y, width, height] of [[.037, .105, .025], [.082, .022, .065], [.1325, .07, .035]]) add(rail, 'box', 'dark', [-.065, y, side * .40], [3.09, height, width]);
    // The suspended axlebox jacks land on a dedicated inboard beam carried by
    // the sleepers, not on the wheel plane. The beam stays below the tires.
    const beam = part(`jackbeam.${side}`, `${side < 0 ? 'Near' : 'Far'} inboard jack support beam`, 'Service support', 'Carries the three service jacks outside the spinning tire envelopes.', 'A low longitudinal beam rests on the cross-ties inboard of the rail; the diagonal jacks rise from its forged pads to the axleboxes.', undefined, [0, 0, 0]);
    add(beam, 'box', 'dark', [-.065, .073, side * .30], [3.06, .026, .095]);
    for (let i = 0; i < 7; i++) add(beam, 'box', 'titanium', [-1.43 + i * .455, .087, side * .30], [.15, .008, .115], [0, 0, 0], true);
    for (const x of D.axles) kit.fasteners(beam, [[x, .09, side * .30]], .010);
  }
  for (let i = 0; i < 7; i++) {
    const x = -1.43 + i * .455;
    const tie = part(`sleeper.${i}`, `Service rail cross-tie ${i + 1}`, 'Service support', 'Holds rail gauge and carries the bench on the floor.', 'A low transverse shoe has broad rubber isolation pads and two rail clips.', undefined, [0, 0, 0]);
    add(tie, 'box', 'dark', [x, .035, 0], [.12, .05, 1.02]);
    for (const z of [-.43, .43]) {
      add(tie, 'box', 'rubber', [x, .009, z], [.15, .018, .19]);
      add(tie, 'box', 'titanium', [x, .058, z], [.16, .018, .13]);
      kit.fasteners(tie, [[x - .055, .071, z], [x + .055, .071, z]], .010);
    }
  }
  for (const side of [-1, 1]) {
    const frame = part(`frame.${side}`, `${side < 0 ? 'Near' : 'Far'} locomotive frame girder`, 'Chassis', 'Carries boiler saddles, cylinders and axle horn guides.', 'Two thin longitudinal flanges are connected by pierced-looking separated webs, inboard of every driving wheel.', undefined, [0, .12, side * .08]);
    for (const y of [.71, .82]) add(frame, 'box', 'dark', [-.015, y, side * .285], [2.69, .038, .05]);
    for (let i = 0; i < 11; i++) {
      const x = -1.23 + i * .25;
      add(frame, 'box', 'titanium', [x, .765, side * .285], [.034, .11, .05]);
      kit.fasteners(frame, [[x, .848, side * .285]], .009);
    }
    const board = part(`runningboard.${side}`, `${side < 0 ? 'Near' : 'Far'} boiler running board`, 'Chassis', 'Provides the narrow walkway alongside the pressure shell.', 'A slim shelf stays well above the connecting-rod swept envelope.', undefined, [0, .20, side * .1]);
    add(board, 'box', 'dark', [-.22, .89, side * .37], [2.21, .025, .14]);
    for (let i = 0; i < 19; i++) add(board, 'box', 'titanium', [-1.26 + i * .113, .906, side * .37], [.014, .006, .12], [0, 0, 0], true);
  }
  D.axles.forEach((x, i) => {
    const cross = part(`crossmember.${i}`, `Axle bay ${i + 1} transverse stretcher`, 'Chassis', 'Connects the two longitudinal frame plates.', 'The stretcher and diagonal ties sit above the axle and inside the wheels.');
    add(cross, 'box', 'dark', [x, .77, 0], [.095, .09, .57]);
    for (const side of [-1, 1]) rod(cross, 'titanium', [x - .22, .73, side * .28], [x + .22, .80, -side * .28], .014);
    const axle = part(`axle.${i}`, `Driver axle ${i + 1} through shaft`, 'Wheelset', 'Joins the quartered driving wheels without translating the vehicle.', 'A continuous shaft turns in the stationary bearing boxes.', undefined, [0, .02, 0]);
    axle.position.set(x, D.axleY, 0);
    axial(axle, 'titanium', [0, 0, 0], .046, .85);
    for (const z of [-.32, .32]) axial(axle, 'brass', [0, 0, z], .065, .028);
    wheels.push({ node: axle, side: -1 });
    for (const side of [-1, 1]) {
      const label = `${side < 0 ? 'Left' : 'Right'} axle ${i + 1}`;
      const bearing = part(`bearing.${i}.${side}`, `${label} split bearing box`, 'Axle bearings', 'Locates the driving shaft and transfers its weight into the service jack.', 'Split cheek blocks, a brass bearing ring and an oil cup surround the axle, with no simulated suspension deflection.', undefined, [0, .06, side * .10]);
      bearing.position.set(x, D.axleY, side * .285);
      add(bearing, 'box', 'dark', [0, .083, 0], [.15, .052, .13]);
      add(bearing, 'box', 'dark', [0, -.083, 0], [.15, .052, .13]);
      for (const dx of [-.075, .075]) add(bearing, 'box', 'titanium', [dx, 0, 0], [.03, .17, .13]);
      eye(bearing, [0, 0, side * .06], .055);
      axial(bearing, 'brass', [0, .137, 0], .018, .055, 'y');
      kit.fasteners(bearing, [[-.06, .116, 0], [.06, .116, 0]], .010);
      const jack = part(`jack.${i}.${side}`, `${label} suspended service jack`, 'Service support', 'Supports the axlebox independently of the spinning tire.', 'A diagonal load post lands on the fixed inboard beam and reaches the underside of the bearing box.', undefined, [0, 0, 0]);
      rod(jack, 'dark', [x, .09, side * .30], [x, .388, side * .285], .024);
      add(jack, 'box', 'titanium', [x, .401, side * .285], [.17, .032, .11]);
      add(jack, 'box', 'dark', [x, .099, side * .30], [.18, .026, .105]);
      for (let k = 0; k < 5; k++) axial(jack, 'brass', [x, .245 + .018 * k, side * (.305 - .003 * k)], .030, .007, 'y', true);
      const spring = part(`spring.${i}.${side}`, `${label} layered leaf spring`, 'Suspension', 'Shows the elastic suspension pack above each axlebox.', 'Six nested leaf strips and two hanger eyes flex as a visual spring pack; spring forces are not solved.', undefined, [0, .18, side * .1]);
      springNodes.push(spring);
      for (let k = 0; k < 6; k++) {
        const length = .43 - k * .042, y = .686 - k * .012;
        for (const sign of [-1, 1]) rod(spring, k % 2 ? 'titanium' : 'dark', [x, y, side * .285], [x + sign * length / 2, y - .03, side * .285], .006);
      }
      add(spring, 'box', 'brass', [x, .66, side * .285], [.06, .10, .07]);
      for (const dx of [-.215, .215]) {
        eye(spring, [x + dx, .66, side * .285], .020);
        rod(spring, 'titanium', [x + dx, .66, side * .285], [x + dx, .755, side * .285], .009);
      }
      const wheel = part(`wheel.${i}.${side}`, `${label} sixteen-spoke driving wheel`, 'Driving wheels', 'Converts the common axle angle into a circular crankpin trajectory.', 'Open tapered spoke pairs connect the hub and paired tire rings; the tire clears the service rail.', undefined, [0, .02, side * .19]);
      wheel.position.set(x, D.axleY, side * D.wheelZ);
      for (const z of [-.027, .027]) add(wheel, 'ring', 'titanium', [0, 0, z], [D.wheelRadius, D.wheelRadius, .075]);
      add(wheel, 'ring', 'dark', [0, 0, 0], [.248, .248, .09]);
      axial(wheel, 'dark', [0, 0, 0], .079, .08);
      eye(wheel, [0, 0, side * .047], .065);
      for (let k = 0; k < 16; k++) {
        const a = k * TAU / 16;
        const p = (r, offset = 0, z = 0) => [r * Math.cos(a + offset), r * Math.sin(a + offset), z];
        rod(wheel, 'dark', p(.070), p(.252, .05), .015);
        rod(wheel, 'titanium', p(.10, -.027, side * .018), p(.256, .05, side * .018), .006);
        axial(wheel, 'brass', p(.251, .05, side * .033), .009, .009, 'z', true);
        add(wheel, 'bolt', 'titanium', p(.089, 0, side * .049), [.008, .009, .008], [Math.PI / 2, 0, 0], true);
      }
      const weight = part(`counterweight.${i}.${side}`, `${label} crescent counterweight`, 'Driving wheels', 'Balances the illustrative crank hardware with a visible rim insert.', 'Six short sectors occupy the rim opposite the crank, leaving the rest of the spokes open.', wheel, [0, 0, side * .025]);
      for (let k = 0; k < 6; k++) {
        const a = Math.PI - .50 + k * .20;
        add(weight, 'box', 'dark', [.207 * Math.cos(a), .207 * Math.sin(a), side * .035], [.074, .052, .024], [0, 0, a]);
        axial(weight, 'brass', [.214 * Math.cos(a), .214 * Math.sin(a), side * .052], .009, .008, 'z', true);
      }
      const pin = part(`crankpin.${i}.${side}`, `${label} extended crank journal`, 'Crank journals', 'Connects the wheel to outboard coupling and connecting-rod lanes.', 'The continuous journal reaches through the rod bushes while its retaining cap sits beyond the moving plates.', wheel, [0, 0, side * .045]);
      const reach = (i === 0 ? D.conrodZ + .032 : D.couplingZ + .029) - D.wheelZ;
      axial(pin, 'brass', [D.crank, 0, side * reach / 2], .012, reach);
      axial(pin, 'titanium', [D.crank, 0, side * .023], .028, .028);
      add(pin, 'bolt', 'dark', [D.crank, 0, side * reach], [.022, .012, .022], [Math.PI / 2, 0, 0]);
      wheels.push({ node: wheel, side });
    }
  });
  for (const s of lastState.sides) {
    const label = s.side < 0 ? 'Left' : 'Right', sign = s.side;
    for (let i = 0; i < 2; i++) {
      const link = part(`coupling.${s.id}.${i}`, `${label} coupling bar ${i + 1}`, 'Coupling rods', 'Maintains the 680 mm distance between equally phased crankpins.', 'A rigid twin-rail plate with two full eyes follows the actual pin endpoints on its own outer lane.', undefined, [0, -.04, sign * .19]);
      plate(link, D.pitch, .027); sideLinks.push({ node: link, id: s.id, i });
    }
    const link = part(`conrod.${s.id}`, `${label} 700 mm main connecting rod`, 'Piston drive', 'Closes the exact crank-to-crosshead triangle.', 'A separate rigid plate swings outside both the wheel face and coupling bars, on a 635 mm axial lane.', undefined, [0, -.07, sign * .23]);
    plate(link, D.conrod, .026);
    const head = part(`crosshead.${s.id}`, `${label} crosshead shoe`, 'Piston drive', 'Restrains the piston train to a horizontal guide line.', 'Two bronze slippers and a transverse pin translate together without rotating.', undefined, [0, .04, sign * .22]);
    for (const dy of [-.035, .035]) add(head, 'box', 'brass', [0, dy, 0], [.093, .018, .061]);
    add(head, 'box', 'dark', [0, 0, 0], [.046, .055, .049]);
    axial(head, 'brass', [0, 0, 0], .013, .072);
    for (const dz of [-.042, .042]) add(head, 'bolt', 'titanium', [0, 0, dz], [.022, .01, .022], [Math.PI / 2, 0, 0], true);
    const guide = part(`guide.${s.id}`, `${label} twin crosshead guide`, 'Piston drive', 'Provides two straight bearing surfaces around the translating shoe.', 'Parallel rails sit above and below the crosshead; their open ends do not obstruct the rotating conrod.', undefined, [0, .10, sign * .22]);
    for (const dy of [-.058, .058]) {
      add(guide, 'box', 'titanium', [-1.055, D.axleY + dy, sign * D.conrodZ], [.43, .025, .082]);
      for (const x of [-1.245, -.875]) kit.fasteners(guide, [[x, D.axleY + dy + .018, sign * D.conrodZ]], .008);
    }
    const piston = part(`piston.${s.id}`, `${label} piston and polished piston rod`, 'Cylinders', 'Moves in exact unison with the crosshead.', 'A fixed 370 mm piston-rod offset places the piston inside the opened cylinder throughout its 280 mm stroke.', undefined, [0, 0, sign * .22]);
    axial(piston, 'titanium', [-D.pistonOffset / 2, 0, 0], .014, D.pistonOffset, 'x');
    axial(piston, 'brass', [-D.pistonOffset, 0, 0], .070, .024, 'x');
    for (const dx of [-.008, .008]) add(piston, 'ring', 'dark', [-D.pistonOffset + dx, 0, 0], [.070, .070, .070], [0, Math.PI / 2, 0]);
    const cylinder = part(`cylinder.${s.id}`, `${label} opened steam cylinder`, 'Cylinders', 'Makes piston stroke and cylinder end clearances visible.', 'Two end rings and six separated longitudinal casing staves expose the piston instead of burying it inside an opaque block.', undefined, [0, .02, sign * .18], 'Pale shell cylinder, brass glands and copper drain');
    cylinder.position.set(-1.41, D.axleY, sign * D.conrodZ);
    for (const x of [-.185, .185]) {
      add(cylinder, 'ring', 'titanium', [x, 0, 0], [.090, .090, .090], [0, Math.PI / 2, 0]);
      for (let k = 0; k < 8; k++) {
        const a = k * TAU / 8;
        axial(cylinder, 'brass', [x, .092 * Math.cos(a), .092 * Math.sin(a)], .006, .027, 'x', true);
      }
    }
    for (let k = 0; k < 6; k++) {
      const a = .4 + k * .40;
      add(cylinder, 'box', 'shell', [0, .087 * Math.cos(a), .087 * Math.sin(a)], [.35, .017, .029], [a, 0, 0]);
    }
    axial(cylinder, 'brass', [.194, 0, 0], .031, .025, 'x');
    rod(cylinder, 'copper', [0, -.09, 0], [0, -.15, 0], .008);
    const chest = part(`valvechest.${s.id}`, `${label} valve chest and linear guide`, 'Valve timing', 'Carries the elevated valve spindle independently of the main piston.', 'An opened top casing and twin guide rails reveal the direct-eccentric slider; port-flow timing is illustrative.', undefined, [0, .13, sign * .16]);
    add(chest, 'box', 'shell', [-1.10, .785, sign * D.valveZ], [.34, .035, .14]);
    for (const x of [-1.16, -.68]) rod(chest, 'titanium', [x, .735, sign * D.valveZ], [x, .815, sign * .285], .011);
    for (const dz of [-.037, .037]) rod(chest, 'titanium', [-1.22, D.valveY, sign * D.valveZ + dz], [-.60, D.valveY, sign * D.valveZ + dz], .007);
    for (const x of [-1.22, -.63]) add(chest, 'box', 'dark', [x, .735, sign * D.valveZ], [.026, .07, .10]);
    const eccentric = part(`eccentric.${s.id}`, `${label} adjustable valve eccentric`, 'Valve timing', 'Drives the valve rod with a circular 47 mm offset.', 'The indexed arm rotates with the main axle plus ninety degrees and the selected advance.', undefined, [0, .04, sign * .17]);
    eccentric.position.set(D.axles[0], D.axleY, sign * D.valveZ);
    axial(eccentric, 'titanium', [0, 0, -sign * .07], .034, .17);
    add(eccentric, 'ring', 'brass', [0, 0, -sign * .025], [.058, .058, .055]);
    rod(eccentric, 'dark', [0, 0, -sign * .029], [D.eccentric, 0, -sign * .029], .011);
    axial(eccentric, 'brass', [D.eccentric, 0, 0], .009, .065);
    for (let k = 0; k < 12; k++) {
      const a = k * TAU / 12;
      add(eccentric, 'box', 'titanium', [.049 * Math.cos(a), .049 * Math.sin(a), -sign * .038], [.007, .013, .006], [0, 0, a], true);
    }
    const valveLink = part(`valverod.${s.id}`, `${label} 490 mm valve connecting link`, 'Valve timing', 'Closes the elevated eccentric-to-valve slider loop without stretching.', 'The actual eccentric and slider centers aim a fixed-length, narrow twin-rail link in a separate axial plane.', undefined, [0, .04, sign * .21]);
    plate(valveLink, D.valveLength, .016);
    const valve = part(`valveslider.${s.id}`, `${label} valve spindle slider`, 'Valve timing', 'Converts eccentric rotation into valve-chest translation.', 'A cross-pin and guided shoe carry a long horizontal spindle into the opened chest.', undefined, [0, .05, sign * .19]);
    add(valve, 'box', 'brass', [0, 0, 0], [.050, .028, .057]);
    axial(valve, 'brass', [0, 0, 0], .009, .054);
    axial(valve, 'titanium', [-.15, 0, 0], .009, .30, 'x');
    engines.push({ id: s.id, link, head, piston, eccentric, valveLink, valve });
  }
  // Open boiler: annular bands and tube bundles, not a solid cylinder.
  for (let bay = 0; bay < 8; bay++) {
    const x = -1.11 + bay * .207;
    const shell = part(`boiler.stave.${bay}`, `Boiler inspection stave bay ${bay + 1}`, 'Boiler shell', 'Retains the long locomotive boiler silhouette with open service apertures.', 'Separated curved-equivalent tangent plates leave a broad near-side inspection opening; the upper cover is lifted.', undefined, [0, .25, 0], 'Pale formed shell with dark reinforcing straps');
    for (let k = 0; k < 7; k++) {
      const a = .15 + k * .42;
      add(shell, 'box', 'shell', [x, 1.16 + .286 * Math.cos(a), .286 * Math.sin(a)], [.189, .018, .111], [a, 0, 0]);
    }
    add(shell, 'box', 'shell', [x, 1.49, -.175], [.19, .018, .17], [-.55, 0, 0]);
    const band = part(`boiler.band.${bay}`, `Boiler retaining band ${bay + 1}`, 'Boiler bands', 'Holds the inspection-shell bays around their circular section.', 'A continuous narrow band surrounds the open tube space; paired buckle ears remain individually readable.', undefined, [0, .14, 0]);
    add(band, 'ring', 'dark', [x - .10, 1.16, 0], [.304, .304, .045], [0, Math.PI / 2, 0]);
    for (const z of [-.035, .035]) add(band, 'box', 'brass', [x - .10, .848, z], [.035, .047, .026]);
    kit.fasteners(band, [[x - .10, .88, -.035], [x - .10, .88, .035]], .008);
  }
  for (let bank = 0; bank < 4; bank++) {
    const tubes = part(`boiler.tubes.${bank}`, `Exposed fire-tube quadrant ${bank + 1}`, 'Boiler internals', 'Reveals longitudinal heat-transfer passages beneath the lifted casing.', 'Seven parallel copper tubes pass between two open tube plates; neither heat flow nor steam generation is simulated.', undefined, [0, .08, (bank % 2 ? 1 : -1) * .12], 'Copper fire tubes and brass ferrules');
    for (let k = 0; k < 7; k++) {
      const a = (bank * 7 + k) * TAU / 28, r = k % 3 === 0 ? .135 : .216;
      const y = 1.16 + r * Math.cos(a), z = r * Math.sin(a);
      rod(tubes, 'copper', [-1.18, y, z], [.49, y, z], .011);
      for (const x of [-1.18, .49]) axial(tubes, 'brass', [x, y, z], .018, .025, 'x', true);
    }
  }
  for (const [i, x] of [[0, -1.24], [1, .54]]) {
    const end = part(`boiler.end.${i}`, `${i ? 'Firebox rear' : 'Smokebox front'} skeleton tube plate`, 'Boiler internals', 'Supports the opened tube bundle at the end of the pressure-shell display.', 'Concentric rings and radial ribs leave the tubes and internal volume visible.');
    for (const r of [.10, .23, .30]) add(end, 'ring', i ? 'dark' : 'titanium', [x, 1.16, 0], [r, r, .042], [0, Math.PI / 2, 0]);
    for (let k = 0; k < 12; k++) {
      const a = k * TAU / 12;
      rod(end, 'dark', [x, 1.16 + .09 * Math.cos(a), .09 * Math.sin(a)], [x, 1.16 + .29 * Math.cos(a), .29 * Math.sin(a)], .012);
      axial(end, 'brass', [x - .013, 1.16 + .276 * Math.cos(a), .276 * Math.sin(a)], .010, .018, 'x', true);
    }
  }
  const chimney = part('chimney', 'Flared chimney and smokebox saddle', 'Steam fittings', 'Establishes the recognizable forward locomotive stack.', 'Stack rings, a narrow throat and a flared cap sit above the smokebox, with a visible open-looking dark throat.');
  for (const [y, r, h] of [[1.47, .113, .07], [1.61, .065, .25], [1.765, .093, .055]]) axial(chimney, 'dark', [-.98, y, 0], r, h, 'y');
  add(chimney, 'ring', 'brass', [-.98, 1.793, 0], [.083, .083, .083], [Math.PI / 2, 0, 0]);
  const dome = part('steam.dome', 'Steam dome with split cladding', 'Steam fittings', 'Collects the high steam take-off above the boiler silhouette.', 'A short brass drum and a shallow pale cap connect to the copper regulator line.');
  axial(dome, 'brass', [-.33, 1.49, 0], .105, .19, 'y');
  add(dome, 'cone', 'brass', [-.33, 1.615, 0], [.107, .065, .107]);
  for (const side of [-1, 1]) {
    const safety = part(`safety.${side}`, `${side < 0 ? 'Near' : 'Far'} safety-valve column`, 'Steam fittings', 'Shows a separate safety-valve take-off without claiming pressure operation.', 'A copper riser, spring-like ring stack and capped spindle sit behind the steam dome.');
    axial(safety, 'copper', [.21, 1.51, side * .10], .022, .22, 'y');
    for (let k = 0; k < 6; k++) add(safety, 'ring', 'brass', [.21, 1.48 + k * .018, side * .10], [.032, .032, .020], [Math.PI / 2, 0, 0], k > 2);
    const pipe = part(`pipe.main.${side}`, `${side < 0 ? 'Near' : 'Far'} steam delivery pipe`, 'Copper plumbing', 'Connects the boiler-side manifold to the twin cylinder display.', 'Twelve straight tube segments approximate two smooth elbows; small union collars break up the run.', undefined, [0, .08, side * .12], 'Copper delivery tube and brass compression unions');
    const p = t => [-.80 - .56 * t, 1.09 - .36 * t + .045 * Math.sin(Math.PI * t), side * (.31 + .30 * t)];
    for (let k = 0; k < 12; k++) rod(pipe, 'copper', p(k / 12), p((k + 1) / 12), .018);
    for (const t of [0, .45, 1]) add(pipe, 'sphere', 'brass', p(t), [.025, .025, .025], [0, 0, 0], true);
    const rail = part(`handrail.${side}`, `${side < 0 ? 'Near' : 'Far'} boiler handrail and stanchions`, 'Crew access', 'Provides a fine contrasting longitudinal rail outside the boiler.', 'Five short support brackets hold the narrow rail clear of the opened inspection panels.');
    rod(rail, 'titanium', [-1.19, 1.26, side * .343], [.46, 1.26, side * .343], .009);
    for (let k = 0; k < 5; k++) rod(rail, 'brass', [-1.15 + k * .39, 1.25, side * .29], [-1.15 + k * .39, 1.26, side * .343], .007);
  }
  const cabFloor = part('cab.floor', 'Cab floor and open firebox footing', 'Cab structure', 'Supports the rear cab without becoming a generic engine platform.', 'A short rear floor, narrow firebox wall and brass grate sit immediately behind the boiler.');
  add(cabFloor, 'box', 'dark', [.99, .87, 0], [.84, .058, .86]);
  for (let k = 0; k < 10; k++) rod(cabFloor, 'brass', [.63 + k * .06, .91, -.25], [.63 + k * .06, .91, .25], .011);
  for (const side of [-1, 1]) {
    const cab = part(`cab.side.${side}`, `${side < 0 ? 'Near' : 'Far'} open cab window frame`, 'Cab structure', 'Defines tall rear windows and the driver compartment.', 'Four upright posts and narrow lintels surround open windows rather than filling the silhouette with a block.', undefined, [0, .19, side * .16]);
    for (const x of [.59, .83, 1.14, 1.38]) rod(cab, 'titanium', [x, .91, side * .41], [x, 1.79, side * .41], .016);
    for (const y of [1.15, 1.72, 1.79]) rod(cab, 'dark', [.59, y, side * .41], [1.38, y, side * .41], .018);
    for (let k = 0; k < 6; k++) add(cab, 'box', 'shell', [.65 + k * .136, 1.015, side * .42], [.12, .18, .024]);
    const step = part(`cab.steps.${side}`, `${side < 0 ? 'Near' : 'Far'} hanging cab access steps`, 'Crew access', 'Makes the rear crew entrance readable at miniature scale.', 'Three short grating treads hang behind the rearmost driver, outside its rim envelope.', undefined, [0, -.04, side * .13]);
    for (let k = 0; k < 3; k++) {
      const y = .38 + k * .16, z = side * (.49 - k * .028);
      add(step, 'box', 'dark', [1.39, y, z], [.16, .026, .19]);
      for (let j = 0; j < 5; j++) add(step, 'box', 'titanium', [1.325 + j * .032, y + .018, z], [.012, .009, .18], [0, 0, 0], true);
    }
    rod(step, 'titanium', [1.455, .35, side * .53], [1.455, 1.11, side * .41], .012);
  }
  const roof = part('cab.roof', 'Raised three-panel cab roof', 'Cab armor', 'Completes the rear locomotive silhouette while exposing the controls.', 'Three thin pitched panels rest on visible roof bows and fade in x-ray.', undefined, [0, .32, 0], 'Pale alloy roof panels');
  for (const z of [-.28, 0, .28]) add(roof, 'box', 'shell', [.985, 1.845 - Math.abs(z) * .13, z], [.90, .022, .285], [z * -.48, 0, 0]);
  for (const x of [.59, .97, 1.37]) rod(roof, 'dark', [x, 1.78, -.44], [x, 1.78, .44], .014);
  for (let k = 0; k < 3; k++) {
    const control = part(`cab.control.${k}`, `Cab ${['regulator handwheel', 'pressure gauge', 'firedoor wheel'][k]}`, 'Cab controls', 'Provides a recognizable operator interface on the open firebox bulkhead.', 'A fine rim, radial spokes and rear plumbing depict the control without inventing a pressure reading.');
    const y = 1.05 + k * .22, r = k === 1 ? .055 : .079, z = k === 1 ? .14 : 0;
    control.position.set(.62, y, z);
    add(control, 'ring', 'brass', [0, 0, 0], [r, r, r], [0, Math.PI / 2, 0]);
    for (let j = 0; j < 6; j++) {
      const a = j * TAU / 6;
      rod(control, 'titanium', [0, 0, 0], [0, r * Math.cos(a), r * Math.sin(a)], .005);
    }
    rod(control, 'copper', [-.02, 0, .02 - z], [-.11, -.08, .17 - z], .007);
    cabControls.push(control);
  }
  const bogie = part('pilot.bogie', 'Front pilot bogie and bolster', 'Pilot truck', 'Locates the small leading wheels ahead of the main drivers.', 'The suspended pilot axle is attached to the front frame through a compact transverse yoke.');
  add(bogie, 'box', 'dark', [-1.31, .36, 0], [.27, .06, .52]);
  rod(bogie, 'titanium', [-1.31, .34, 0], [-1.19, .75, 0], .035);
  axial(bogie, 'titanium', [-1.31, .295, 0], .026, .65);
  for (const side of [-1, 1]) {
    const pilot = part(`pilot.wheel.${side}`, `${side < 0 ? 'Near' : 'Far'} leading pilot wheel`, 'Pilot truck', 'Shows the small leading wheel pair beneath the smokebox.', 'The pilot wheel rolls on its own axle at the common road speed; it is no longer a fixed display wheel.', undefined, [0, 0, side * .13]);
    pilot.position.set(-1.31, .295, side * .31);
    for (const dz of [-.019, .019]) add(pilot, 'ring', 'titanium', [0, 0, dz], [.105, .105, .044]);
    axial(pilot, 'dark', [0, 0, 0], .033, .07);
    for (let j = 0; j < 8; j++) {
      const a = j * TAU / 8;
      rod(pilot, 'dark', [0, 0, 0], [.096 * Math.cos(a), .096 * Math.sin(a), 0], .009);
    }
    pilotWheels.push(pilot);
  }
  for (const [end, x] of [['front', -1.49], ['rear', 1.39]]) {
    const buffer = part(`buffer.${end}`, `${end === 'front' ? 'Front' : 'Rear'} buffer beam and coupler`, 'Railway fittings', 'Identifies the ends as a railway vehicle rather than an engine skid.', 'A narrow beam carries two buffer plates and a central open coupling eye.');
    add(buffer, 'box', 'teal', [x, .82, 0], [.09, .125, 1.0]);
    const sign = x < 0 ? -1 : 1;
    for (const z of [-.36, .36]) {
      axial(buffer, 'dark', [x + sign * .046, .81, z], .038, .08, 'x');
      axial(buffer, 'titanium', [x + sign * .09, .81, z], .072, .023, 'x');
    }
    add(buffer, 'ring', 'dark', [x + sign * .079, .73, 0], [.049, .063, .049], [0, Math.PI / 2, 0]);
    const lamp = part(`lamp.${end}`, `${end === 'front' ? 'Smokebox' : 'Cab rear'} service lamp`, 'Railway fittings', 'Adds a small optical focal point at the end of the locomotive.', 'A brass bezel and teal lens sit on a narrow bracket, with no powered lighting simulation.');
    add(lamp, 'box', 'dark', [x, 1.01, 0], [.07, .12, .10]);
    add(lamp, 'sphere', 'lens', [x + sign * .045, 1.04, 0], [.018, .040, .040]);
    add(lamp, 'ring', 'brass', [x + sign * .050, 1.04, 0], [.044, .044, .044], [0, Math.PI / 2, 0]);
  }
  const loco = new THREE.Group(); loco.name = 'moving-locomotive'; kit.assemblies.add(loco);
  const fixedService = id => id.startsWith('rail.') || id.startsWith('jackbeam.') || id.startsWith('sleeper.');
  for (const node of nodes) if (node.parent === kit.assemblies && !fixedService(node.userData.partId)) loco.add(node);

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.sides) lastState = state;
    else if (Number.isFinite(state?.driveAngle)) lastState = poseAt(state.driveAngle, lastState.controls);
    for (const { node, p, q } of bind) { node.position.copy(p); node.quaternion.copy(q); }
    loco.position.x = -(lastState.travel || 0);
    for (const w of wheels) w.node.rotation.z = lastState.sides.find(s => s.side === w.side).theta;
    pilotWheels.forEach((node, i) => { node.rotation.z = lastState.sides[0].theta + i * .12; });
    cabControls.forEach((node, i) => { node.rotation.x = lastState.sides[0].theta * (i === 1 ? 2 : 1); });
    springNodes.forEach((node, i) => { node.position.y = Math.sin(lastState.driveAngle * 2 + i * .7) * .004; });
    for (const item of sideLinks) {
      const s = lastState.sides.find(s => s.id === item.id); kit.aim(item.node, s.pins[item.i], s.pins[item.i + 1]);
    }
    for (const e of engines) {
      const s = lastState.sides.find(s => s.id === e.id);
      kit.aim(e.link, s.crank, s.crosshead); e.head.position.fromArray(s.crosshead); e.piston.position.fromArray(s.crosshead);
      e.eccentric.rotation.z = s.eccentricAngle; kit.aim(e.valveLink, s.eccentricPin, s.valve); e.valve.position.fromArray(s.valve);
    }
    kit.sync(options);
  }
  update();
  const framePoints = [], seen = new Set(), matrix = new THREE.Matrix4(), point = new THREE.Vector3();
  for (let i = 0; i <= 16; i++) {
    update(sample(i / 16 / cycleHz(DEFAULT_INPUTS), DEFAULT_INPUTS), { quality: 'balanced', mode: 'solid', explode: 0 });
    for (const mesh of kit.pickables) for (let j = 0; j < mesh.count; j++) {
      mesh.getMatrixAt(j, matrix); point.setFromMatrixPosition(matrix);
      const key = `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key); framePoints.push(point.clone());
    }
  }
  update(lastState);
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update, framePoints,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
