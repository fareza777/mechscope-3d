import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { P, TAU, PUMP, pose, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('ORBIT P3'), { group, parts, stats, add, rod } = kit;
  group.userData.kinematicVisualization = 'Exact 24/24/72 Willis ratios and pitch-phase synchronization. Box teeth are conceptual, not precision involutes; no tooth-interference or bearing-contact claim.';
  const binds = [], carried = [], planetNodes = [];
  let previous = sample(), disposed = false;
  const settings = { quality: 'balanced', mode: 'solid', explode: 0, selectedId: null };
  const make = (id, name, system, fn, how, material = 'titanium', explode = [0, 0, 0]) => kit.part({ id, name, system, function: fn, how, material, unit: 'm', detail: `${name}: ${how}` }, undefined, explode);
  const centred = (id, name, system, fn, how, material, explode) => {
    const n = make(id, name, system, fn, how, material, explode); n.position.y = P.centreY; return n;
  };
  const axial = (n, mat, x, y, z, radius, length, detail = false) => add(n, 'cylinder', mat, [x, y, z], [radius, length, radius], [Math.PI / 2, 0, 0], detail);
  const ring = (n, mat, p, radius, thickness = radius, detail = false) => add(n, 'ring', mat, p, [radius, radius, thickness], [0, 0, 0], detail);
  const polar = (r, a, z) => [r * Math.cos(a), r * Math.sin(a), z];
  const boltZ = (n, p, radius = .008, detail = true) => {
    axial(n, 'dark', ...p, radius * 1.3, .004, detail);
    add(n, 'bolt', 'titanium', [p[0], p[1], p[2] + .005], [radius, .009, radius], [Math.PI / 2, 0, 0], detail);
  };
  const arc = (n, mat, radius, start, end, z, tube, segments, detail = false) => {
    for (let k = 0; k < segments; k++) rod(n, mat, polar(radius, start + (end - start) * k / segments, z), polar(radius, start + (end - start) * (k + 1) / segments, z), tube, detail);
  };
  // Ring sectors are annular blocks, never a filled cylinder or an external gear.
  for (let sector = 0; sector < 12; sector++) {
    const a = sector * TAU / 12, middle = a + TAU / 24;
    const rim = centred(`ring.sector.${sector}`, `Fixed ring · sector ${sector + 1}`, 'Internal gear', 'Hold six inward-facing teeth and react the planet torque.', 'The 72-tooth annulus has 540 mm pitch radius. Rectangular teeth are a teaching approximation, not involutes.', 'brass', [.045 * Math.cos(middle), .012 + .045 * Math.sin(middle), -.02]);
    for (let j = 0; j < 6; j++) {
      const b = a + j * TAU / 72;
      add(rim, 'box', 'brass', polar(.587, b, 0), [.064, .053, .08], [0, 0, b]);
      add(rim, 'box', 'brass', polar(.5415, b, 0), [.041, .019, .072], [0, 0, b]);
      for (const z of [-.049, .049]) add(rim, 'box', 'titanium', polar(.603, b, z), [.032, .053, .012], [0, 0, b]);
      if (j % 2 === 0) boltZ(rim, polar(.603, b, .058), .0055);
      if (j % 2 === 0) boltZ(rim, polar(.603, b, -.066), .0055);
    }
    const cage = centred(`cage.station.${sector}`, `Open shell cage · station ${sector + 1}`, 'Gearbox housing', 'Bridge the front and rear housing hoops without hiding the gears.', 'A narrow axial rib and short hoop sectors leave large inspection windows. Shell material ghosts in x-ray.', 'shell', [.065 * Math.cos(middle), .012 + .065 * Math.sin(middle), 0]);
    const xy = polar(.663, middle, 0);
    rod(cage, 'shell', [xy[0], xy[1], -.215], [xy[0], xy[1], .215], .018);
    for (const z of [-.20, .20]) {
      arc(cage, 'shell', .663, a, a + TAU / 12, z, .019, 4);
      rod(cage, 'titanium', polar(.616, middle, z * .25), polar(.663, middle, z), .01);
      boltZ(cage, polar(.663, middle, z + .02), .010);
    }
    const oil = centred(`oil.channel.${sector}`, `Lubrication branch · port ${sector + 1}`, 'Lubrication', 'Route the fixed rear oil gallery into the ring housing.', 'Copper radial feeds join the rear annular gallery and terminate in visible ring ports; no flow solver is implied.', 'copper', [.04 * Math.cos(middle), .012 + .04 * Math.sin(middle), -.055]);
    arc(oil, 'copper', .647, a, a + TAU / 12, -.238, .005, 7);
    const p0 = polar(.647, middle, -.238), p1 = polar(.616, middle, -.17), p2 = polar(.607, middle, -.05);
    rod(oil, 'copper', p0, p1, .005); rod(oil, 'copper', p1, p2, .005);
    for (const p of [p0, p1, p2]) add(oil, 'sphere', 'brass', p, [.009, .009, .009]);
    const clamp = centred(`ring.clamp.${sector}`, `Radial ring clamp ${sector + 1}`, 'Fixed torque path', 'Key the ring rim into the shell cage.', 'A real radial block spans rim to cage; its radial bolt is aligned to the station normal.', 'dark', [.05 * Math.cos(middle), .012 + .05 * Math.sin(middle), 0]);
    add(clamp, 'box', 'dark', polar(.632, middle, 0), [.041, .026, .043], [0, 0, middle]);
    rod(clamp, 'titanium', polar(.612, middle, 0), polar(.69, middle, 0), .006);
    add(clamp, 'bolt', 'titanium', polar(.692, middle, 0), [.011, .012, .011], [0, 0, middle - Math.PI / 2]);
    for (const z of [-.026, .026]) boltZ(clamp, polar(.632, middle, z), .0055);
  }
  // Open-web external gears, all in the Z=0 gear lane. Tooth zero points +X.
  const externalGear = (node, material, central = false) => {
    for (let j = 0; j < 24; j++) {
      const a = j * TAU / 24;
      add(node, 'box', material, polar(.18, a, 0), [.036, .020, .068], [0, 0, a]);
    }
    for (let j = 0; j < 36; j++) {
      const a = j * TAU / 36;
      add(node, 'box', material, polar(.149, a, 0), [.029, .027, .068], [0, 0, a]);
      if (j % 3 === 0) boltZ(node, polar(.146, a, .039), .005);
    }
    for (let j = 0; j < 6; j++) {
      const a = j * TAU / 6;
      rod(node, material, polar(.04, a, 0), polar(.143, a, 0), .014);
      rod(node, 'dark', polar(.052, a, .028), polar(.13, a + .12, .028), .003, true);
    }
    if (central) axial(node, material, 0, 0, 0, .047, .077);
    else for (let j = 0; j < 24; j++) {
      const a = j * TAU / 24;
      add(node, 'box', material, polar(.042, a, 0), [.013, .012, .069], [0, 0, a]);
    }
    ring(node, 'titanium', [0, 0, .043], .052, .023);
  };
  // Compact spur gears for the auxiliary pump train. The single rim ring and
  // three open spokes keep each gear legible without a solid web disk.
  const pumpGearShape = (node, teeth, radius, material) => {
    ring(node, material, [0, 0, 0], radius * .90, .016);
    for (let j = 0; j < teeth; j++) {
      const a = j * TAU / teeth;
      add(node, 'box', material, polar(radius, a, 0), [radius * 2.4 / teeth, radius * .24, .030], [0, 0, a]);
    }
    axial(node, 'dark', 0, 0, .011, radius * .18, .040);
    for (let j = 0; j < 3; j++) {
      const a = j * TAU / 3;
      rod(node, 'titanium', polar(radius * .18, a, .002), polar(radius * .84, a, .002), radius * .035);
    }
  };
  const sun = centred('gear.sun', '24-tooth input sun', 'Epicyclic train', 'Drive all three planets at four times carrier speed.', 'Its tooth-zero axis is +X; the open web and input spindle form one rotating assembly.', 'brass', [0, .01, -.045]);
  externalGear(sun, 'brass', true);
  const inputShaft = centred('shaft.input', 'Stepped input spindle', 'Input train', 'Deliver drive to the sun through the open rear carrier hub.', 'The input spindle passes through the rear carrier annulus with radial clearance and ends inside the sun hub.', 'titanium', [0, .01, -.055]);
  axial(inputShaft, 'titanium', 0, 0, -.152, .027, .324);
  axial(inputShaft, 'dark', 0, 0, -.335, .048, .045);
  for (let j = 0; j < 12; j++) add(inputShaft, 'box', 'titanium', polar(.029, j * TAU / 12, -.30), [.008, .007, .05], [0, 0, j * TAU / 12]);
  const frontHub = centred('carrier.front-hub', 'Forward carrier output hub', 'Carrier', 'Collect torque from the three forward spokes.', 'This solid hub is forward of the sun face and is rigidly joined to the stepped output shaft.', 'titanium', [0, .018, .055]);
  axial(frontHub, 'titanium', 0, 0, P.frontCarrierZ, .076, .053);
  ring(frontHub, 'brass', [0, 0, .168], .058, .024);
  for (let j = 0; j < 12; j++) boltZ(frontHub, polar(.06, j * TAU / 12, .17), .0055);
  carried.push(frontHub);
  const rearHub = centred('carrier.rear-hub', 'Open rear carrier hub', 'Carrier', 'Join the rear spokes around the independent input spindle.', 'A segmented annulus leaves a clear bore around the faster input shaft.', 'titanium', [0, .018, -.055]);
  for (let j = 0; j < 24; j++) add(rearHub, 'box', 'titanium', polar(.064, j * TAU / 24, P.rearCarrierZ), [.019, .019, .035], [0, 0, j * TAU / 24]);
  ring(rearHub, 'brass', [0, 0, -.16], .064, .025);
  carried.push(rearHub);
  const carrierNeedleFrame = new THREE.Group();
  carrierNeedleFrame.name = 'carrier needle orbit frame'; carrierNeedleFrame.position.y = P.centreY; kit.assemblies.add(carrierNeedleFrame);
  const carrierNeedles = [];
  const ringRollerFrame = new THREE.Group();
  ringRollerFrame.name = 'ring roller orbit frame'; ringRollerFrame.position.set(0, P.centreY, .108); kit.assemblies.add(ringRollerFrame);
  const ringRollers = [];
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3, centre = polar(P.orbit, a, 0);
    for (let n = 0; n < 8; n++) {
      const na = n * TAU / 8;
      const needle = kit.part({ id: `carrier.needle.${i}.${n}`, name: `Carrier needle roller ${i + 1}-${n + 1}`, system: 'Carrier bearings',
        function: 'Carry the planet gear load on a rolling needle around its pin.', how: 'Eight individually indexed needles orbit with the carrier and spin at three carrier turns per cycle; a marker-free cylinder is used only as a rolling element.',
        material: 'Titanium needle roller', unit: 'm · rad', detail: `Carrier needle ${i + 1}-${n + 1}: visible rolling element inside the planet bearing race.` }, carrierNeedleFrame, [Math.cos(na) * .03, .018 + Math.sin(na) * .03, .04]);
      needle.position.set(centre[0] + .030 * Math.cos(na), centre[1] + .030 * Math.sin(na), 0);
      axial(needle, 'titanium', 0, 0, 0, .0042, .083);
      carrierNeedles.push(needle);
    }
  }
  const ringRollerCage = kit.part({ id: 'ring.roller.cage', name: 'Rotating ring-roller cage', system: 'Ring bearings', function: 'Keep the eighteen outer ring rollers equally indexed.', how: 'A fine twelve-segment cage ring turns at two carrier turns per cycle inside the fixed outer hoop.', material: 'Titanium cage, brass rollers', unit: 'm · rad', detail: 'Ring roller cage: rotates at an exact -2 carrier turns per orbit.' }, ringRollerFrame, [0, 0, .06]);
  for (let k = 0; k < 12; k++) rod(ringRollerCage, 'titanium', polar(.70, k * TAU / 12, 0), polar(.70, (k + 1) * TAU / 12, 0), .0045);
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3 + .31;
    const spoke = kit.part({ id: `ring.roller.cage.spoke.${k}`, name: `Ring-roller cage spoke ${k + 1}`, system: 'Ring bearings', function: 'Keep the outer roller cage concentric inside the fixed hoop.', how: 'One radial titanium web turns with the -2 carrier-turn cage and stays clear of the ring teeth.', material: 'Titanium cage web', unit: 'm · rad', detail: `Ring roller cage spoke ${k + 1}: rotating radial web.` }, ringRollerFrame, [.05 * Math.cos(a), .05 * Math.sin(a), .05]);
    rod(spoke, 'titanium', polar(.665, a, 0), polar(.735, a, 0), .0045);
  }
  for (let k = 0; k < 18; k++) {
    const a = k * TAU / 18;
    const roller = kit.part({ id: `ring.roller.${k}`, name: `Outer ring roller ${k + 1}`, system: 'Ring bearings', function: 'Roll against the fixed rim while the carrier turns.', how: 'Each roller orbits at minus two carrier turns per cycle and spins on its own axis; the outer race remains fixed.', material: 'Brass roller, titanium pin', unit: 'm · rad', detail: `Ring roller ${k + 1}: individually selectable rolling element in the outer cage.` }, ringRollerFrame, [.05 * Math.cos(a), .05 * Math.sin(a), .04]);
    roller.position.set(.70 * Math.cos(a), .70 * Math.sin(a), 0);
    axial(roller, 'brass', 0, 0, 0, .009, .075);
    axial(roller, 'titanium', 0, 0, .039, .004, .012);
    ringRollers.push(roller);
  }
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3, centre = polar(P.orbit, a, 0);
    const gear = centred(`gear.planet.${i}`, `24-tooth planet ${i + 1}`, 'Epicyclic train', 'Spin backwards while its shaft travels with the carrier.', 'Absolute spin is −2 times carrier angle with a half-tooth indexing offset; both nominal pitch contacts remain synchronized.', 'brass', [Math.cos(a) * .035, .018 + Math.sin(a) * .035, 0]);
    externalGear(gear, i === 1 ? 'titanium' : 'brass'); planetNodes.push(gear);
    for (const [name, z] of [['front', P.frontCarrierZ], ['rear', P.rearCarrierZ]]) {
      const spoke = centred(`carrier.${name}.${i}`, `${name === 'front' ? 'Forward' : 'Rear'} curved carrier spoke ${i + 1}`, 'Carrier', 'Support the planet pin from the central carrier hub.', 'Sixteen connected curved segments terminate on the pin centre in a lane separate from the gear faces.', 'titanium', [0, .018, Math.sign(z) * .055]);
      const points = Array.from({ length: 17 }, (_, k) => polar(.062 + (.36 - .062) * k / 16, a + .30 * Math.sin(Math.PI * k / 16), z));
      for (let k = 0; k < 16; k++) {
        rod(spoke, 'titanium', points[k], points[k + 1], .016);
        if (k % 2 === 0) add(spoke, 'sphere', 'dark', [points[k][0], points[k][1], z + .019], [.005, .005, .003], [0, 0, 0], true);
      }
      ring(spoke, 'titanium', [centre[0], centre[1], z], .035, .09);
      for (let j = 0; j < 4; j++) boltZ(spoke, [centre[0] + .026 * Math.cos(j * TAU / 4), centre[1] + .026 * Math.sin(j * TAU / 4), z + .017], .005);
      carried.push(spoke);
    }
    const pin = centred(`planet.pin.${i}`, `Supported planet pin ${i + 1}`, 'Planet support', 'Carry the planet bearing between both carrier frames.', 'A continuous 334 mm shaft engages both carrier end bosses; it is not a floating orbiting hub.', 'titanium', [0, .018, 0]);
    axial(pin, 'titanium', centre[0], centre[1], 0, .018, .334);
    for (const z of [-.10, .10]) axial(pin, 'dark', centre[0], centre[1], z, .024, .039);
    carried.push(pin);
    const bearing = centred(`planet.bearing.${i}`, `Exposed planet bearing ${i + 1}`, 'Planet support', 'Show the rolling-element load path around the carrier pin.', 'Two races and eight individually moving needle rollers surround the pin; the needles are illustrative rolling elements without contact dynamics.', 'brass', [0, .018, .025]);
    for (const z of [-.047, .047]) {
      ring(bearing, 'brass', [centre[0], centre[1], z], .024, .035);
      ring(bearing, 'titanium', [centre[0], centre[1], z], .036, .035);
    }
    carried.push(bearing);
    const needleCage = kit.part({ id: `planet.needle.cage.${i}`, name: `Planet needle cage ${i + 1}`, system: 'Carrier bearings', function: 'Space the individually moving needles around the planet pin.', how: 'A thin brass cage ring orbits with the carrier between the two exposed bearing races.', material: 'Brass cage ring', unit: 'm · rad', detail: `Planet needle cage ${i + 1}: orbiting retainer around the moving needle set.` }, pin, [0, .018, .04]);
    ring(needleCage, 'brass', [centre[0], centre[1], .059], .032, .009);
    const pinSleeve = kit.part({ id: `planet.pin.sleeve.${i}`, name: `Planet pin wear sleeve ${i + 1}`, system: 'Planet support', function: 'Give the rotating planet a replaceable running surface.', how: 'A titanium sleeve and oil groove sit on the pin between the bearing and the forward boss.', material: 'Titanium sleeve, copper groove', unit: 'm · rad', detail: `Planet pin sleeve ${i + 1}: visible carried wear surface.` }, pin, [0, .018, .05]);
    axial(pinSleeve, 'titanium', centre[0], centre[1], .130, .026, .030);
    ring(pinSleeve, 'copper', [centre[0], centre[1], .132], .027, .007);
    const oilCap = centred(`planet.oilcap.${i}`, `Planet pin oil cap ${i + 1}`, 'Planet lubrication', 'Expose a service feed into the carried shaft.', 'The capped oil channel belongs to the carrier, not to the faster spinning planet gear.', 'copper', [0, .018, -.055]);
    ring(oilCap, 'copper', [centre[0], centre[1], -.178], .025, .025);
    axial(oilCap, 'dark', centre[0], centre[1], -.179, .018, .022);
    rod(oilCap, 'copper', [centre[0], centre[1], -.182], polar(.10, a, -.182), .0035);
    carried.push(oilCap);
    const retainer = centred(`planet.retainer.${i}`, `Planet pin front retention plate ${i + 1}`, 'Planet support', 'Lock the pin into the forward carrier boss.', 'A castellated end cap and paired retaining screws attach directly to the projecting pin.', 'dark', [0, .018, .065]);
    axial(retainer, 'dark', centre[0], centre[1], .175, .027, .019);
    for (let k = 0; k < 6; k++) add(retainer, 'box', 'titanium', [centre[0] + .025 * Math.cos(k * TAU / 6), centre[1] + .025 * Math.sin(k * TAU / 6), .188], [.01, .01, .006], [0, 0, k * TAU / 6]);
    carried.push(retainer);
    const pinNut = kit.part({ id: `planet.pin.nut.${i}`, name: `Planet pin domed nut ${i + 1}`, system: 'Planet support', function: 'Lock the forward pin end into the retention plate.', how: 'A brass collar and domed titanium nut ride directly on the pin and orbit with the carrier.', material: 'Brass collar, titanium nut', unit: 'm · rad', detail: `Planet pin nut ${i + 1}: visible fastener on the forward carrier boss.` }, pin, [0, .018, .04]);
    ring(pinNut, 'brass', [centre[0], centre[1], .196], .019, .016);
    add(pinNut, 'sphere', 'titanium', [centre[0], centre[1], .207], [.017, .017, .010]);
    const pinCap = kit.part({ id: `planet.pin.cap.${i}`, name: `Planet pin rear oil cap ${i + 1}`, system: 'Planet lubrication', function: 'Close the rear drill passage after assembly.', how: 'A dark hex cap and copper washer sit on the rear pin end and move with the carrier.', material: 'Dark cap, copper washer', unit: 'm · rad', detail: `Planet pin rear cap ${i + 1}: service closure on the rotating pin.` }, pin, [0, .018, -.04]);
    axial(pinCap, 'dark', centre[0], centre[1], -.201, .017, .016);
    ring(pinCap, 'copper', [centre[0], centre[1], -.208], .020, .010);
  }
  const output = centred('shaft.output', 'Stepped splined output shaft', 'Output train', 'Transmit the slow carrier rotation to the service coupling.', 'Twelve axial splines span z = 255–555 mm; both sleeve control extremes retain positive engagement.', 'titanium', [0, .018, .055]);
  axial(output, 'titanium', 0, 0, .362, .037, .416);
  axial(output, 'dark', 0, 0, .195, .047, .058);
  for (let j = 0; j < 12; j++) add(output, 'box', 'titanium', polar(.040, j * TAU / 12, .405), [.010, .009, .30], [0, 0, j * TAU / 12]);
  axial(output, 'brass', 0, 0, .584, .028, .038);
  carried.push(output);
  const sleeve = centred('output.sleeve', 'Sliding splined inspection sleeve', 'Output train', 'Expose or cover the output spline without altering the gear ratio.', 'An annular sleeve has twelve interleaved internal keys and two groove shoulders for a nonrotating service fork.', 'brass', [0, .018, .085]);
  for (let j = 0; j < 24; j++) add(sleeve, 'box', 'brass', polar(.059, j * TAU / 24, 0), [.015, .017, .076], [0, 0, j * TAU / 24]);
  for (let j = 0; j < 12; j++) add(sleeve, 'box', 'brass', polar(.048, (j + .5) * TAU / 12, 0), [.014, .009, .070], [0, 0, (j + .5) * TAU / 12]);
  for (const z of [-.026, .026]) ring(sleeve, 'titanium', [0, 0, z], .068, .031);
  const fork = centred('output.fork', 'Stationary sliding inspection fork', 'Service control', 'Translate the sleeve through its rotating annular groove.', 'A U-shaped fork slides on two guide rails below the shaft; its shoes ride between the sleeve shoulders.', 'dark', [0, .018, .085]);
  arc(fork, 'dark', .083, Math.PI, TAU, 0, .006, 18);
  for (const side of [-1, 1]) {
    rod(fork, 'dark', [side * .083, 0, 0], [side * .083, -.19, 0], .008);
    add(fork, 'box', 'brass', [side * .083, -.17, 0], [.027, .034, .029]);
  }
  rod(fork, 'dark', [-.083, -.19, 0], [.083, -.19, 0], .009);
  const guide = centred('output.guides', 'Twin fork guide rails and travel stops', 'Service control', 'Keep inspection travel strictly axial.', 'Long guide rods pass through both sliding fork shoes and fixed end stops.', 'titanium', [0, .018, .055]);
  for (const side of [-1, 1]) {
    axial(guide, 'titanium', side * .083, -.17, .39, .006, .29);
    for (const z of [.257, .525]) add(guide, 'box', 'dark', [side * .083, -.17, z], [.034, .028, .024]);
  }
  const controlBridge = make('output.service-bridge', 'Fork service bridge', 'Service fixture', 'Tie the fork guide rails back into the cradle.', 'Two front braces reach the fixed guide end stops without crossing a gear or carrier lane.', 'teal');
  for (const side of [-1, 1]) rod(controlBridge, 'teal', [side * .47, .53, .35], [side * .083, P.centreY - .17, .257], .018);
  rod(controlBridge, 'dark', [-.47, .53, .35], [.47, .53, .35], .018);
  // Forward auxiliary pump: exact 12:6:12 spur train, one carrier orbit gives
  // +1 / -2 / +1 turns. The pump and idler are individually selectable.
  const pumpParts = [];
  for (const [index, key, teeth, radius, material, name] of [[0, 'drive', 12, .09, 'titanium', 'Pump drive gear'], [1, 'idler', 6, .045, 'brass', 'Pump idler gear'], [2, 'gear', 12, .09, 'titanium', 'Oil pump outer gear']]) {
    const part = make(`pump.${key}`, name, 'Lubrication pump', 'Move oil through the auxiliary pump without changing the epicyclic ratio.', 'A separate forward-lane 12:6:12 train turns once, twice backwards and once per carrier orbit; tooth phases close exactly at the full-cycle wrap.', material);
    part.position.fromArray(PUMP.centres[index]);
    pumpGearShape(part, teeth, radius, material);
    if (index === 2) axial(part, 'copper', 0, 0, -.075, .018, .055);
    pumpParts.push(part);
  }
  const pumpRotor = kit.part({ id: 'pump.rotor', name: 'Five-lobe pump inner rotor', system: 'Lubrication pump', function: 'Displace oil inside the outer pump gear.', how: 'A five-lobe inner rotor counter-rotates relative to the outer gear at an exact integer carrier multiple; no pressure field is solved.', material: 'Brass rotor, copper shaft', unit: 'm · rad', detail: 'Pump inner rotor: visible displacement element in the transparent pump stack.' }, pumpParts[2], [0, .02, .05]);
  pumpRotor.position.set(0, 0, .030);
  ring(pumpRotor, 'brass', [0, 0, 0], .030, .012);
  for (let k = 0; k < 5; k++) {
    const a = k * TAU / 5;
    add(pumpRotor, 'box', 'brass', [.024 * Math.cos(a), .024 * Math.sin(a), 0], [.026, .012, .014], [0, 0, a]);
  }
  const pumpShaft = kit.part({ id: 'pump.shaft', name: 'Pump drive spindle', system: 'Lubrication pump', function: 'Carry the pump gear and inner rotor on one visible shaft.', how: 'A short copper spindle passes through the pump stack and turns with the outer gear.', material: 'Copper spindle', unit: 'm · rad', detail: 'Pump spindle: rotates with the pump outer gear.' }, pumpParts[2], [0, .01, .03]);
  axial(pumpShaft, 'copper', 0, 0, .035, .007, .11);
  const pumpCover = make('pump.cover', 'Pump cover plate and service screws', 'Lubrication pump', 'Close the pump housing without hiding its gears.', 'A small shell plate sits behind the forward pump gears on two bracket rods with visible fasteners.', 'shell');
  add(pumpCover, 'box', 'shell', [PUMP.centres[1][0], PUMP.centres[1][1], .395], [.30, .17, .012], [0, 0, -.75]);
  for (const c of [PUMP.centres[0], PUMP.centres[2]]) boltZ(pumpCover, [c[0], c[1], .405], .008);
  const pumpFeed = make('pump.passage', 'Pump suction and pressure passages', 'Lubrication pump', 'Connect the pump to the ring gallery with visible copper lines.', 'Two capped copper tubes reach from the pump cover to the lower fixed gallery; no flow solver is implied.', 'copper');
  rod(pumpFeed, 'copper', [PUMP.centres[0][0], PUMP.centres[0][1], .39], [PUMP.centres[0][0] - .08, PUMP.centres[0][1] - .12, .30], .0065);
  rod(pumpFeed, 'copper', [PUMP.centres[2][0], PUMP.centres[2][1], .39], [PUMP.centres[2][0] + .05, PUMP.centres[2][1] - .08, .28], .0065);
  for (const c of [PUMP.centres[0], PUMP.centres[2]]) add(pumpFeed, 'sphere', 'brass', [c[0], c[1], .39], [.010, .010, .010]);
  // Top selector shaft and fork sit outside the ring envelope and above the
  // carrier, so their motion never enters the gear-face lane.
  const selectorShaft = make('selector.shaft', 'Rotating selector shaft', 'Service control', 'Index the selector fork with the carrier phase.', 'A keyed shaft above the fixed ring turns one exact turn per carrier orbit; a keyway makes the rotation legible.', 'dark');
  selectorShaft.position.set(-.10, 1.635, .275);
  rod(selectorShaft, 'dark', [-.33, 0, 0], [.36, 0, 0], .011);
  add(selectorShaft, 'box', 'brass', [.23, .012, 0], [.065, .011, .017]);
  for (const x of [-.24, .25]) add(selectorShaft, 'ring', 'brass', [x, 0, 0], [.020, .020, .013], [0, Math.PI / 2, 0]);
  const selectorJournal = kit.part({ id: 'selector.journal', name: 'Selector shaft centre journal', system: 'Service control', function: 'Mark the shaft rotation at the mid-span bearing.', how: 'A small titanium collar and offset oil hole turn with the selector shaft.', material: 'Titanium journal', unit: 'm · rad', detail: 'Selector journal: rigidly rotating mid-span collar.' }, selectorShaft, [.01, .02, .02]);
  add(selectorJournal, 'ring', 'titanium', [.08, 0, 0], [.017, .017, .016], [0, Math.PI / 2, 0]);
  add(selectorJournal, 'sphere', 'brass', [.08, .012, 0], [.004, .004, .004]);
  const selectorJournalCap = kit.part({ id: 'selector.journal.cap', name: 'Selector journal oil cap', system: 'Service control', function: 'Close the journal oil drill after assembly.', how: 'A dark cap and copper washer rotate with the selector shaft at the mid-span collar.', material: 'Dark cap, copper washer', unit: 'm · rad', detail: 'Selector journal cap: rotating service closure.' }, selectorShaft, [.01, .01, .01]);
  axial(selectorJournalCap, 'dark', .08, .025, 0, .008, .012);
  ring(selectorJournalCap, 'copper', [.08, .025, .008], .010, .005);
  const selectorLever = kit.part({ id: 'selector.lever', name: 'Selector shaft crank lever', system: 'Service control', function: 'Show the shaft index on the service side.', how: 'A brass lever and pin orbit with the rotating selector shaft above the ring.', material: 'Brass lever, titanium pin', unit: 'm · rad', detail: 'Selector lever: rigidly keyed to the rotating selector shaft.' }, selectorShaft, [.02, .03, .01]);
  add(selectorLever, 'box', 'brass', [.20, .035, 0], [.075, .018, .018]);
  add(selectorLever, 'bolt', 'titanium', [.24, .035, .012], [.006, .016, .006], [0, 0, 0]);
  const selectorPin = kit.part({ id: 'selector.pin', name: 'Selector detent pin', system: 'Service control', function: 'Mark the rotary position of the selector shaft.', how: 'An offset titanium pin is carried by the shaft and visibly circles the axis.', material: 'Titanium pin', unit: 'm · rad', detail: 'Selector pin: offset follower on the rotating shaft.' }, selectorShaft, [.02, .02, 0]);
  add(selectorPin, 'bolt', 'titanium', [-.23, .022, 0], [.006, .022, .006], [0, 0, 0]);
  const selectorFork = make('selector.fork', 'Sliding selector fork', 'Service control', 'Translate an inspection fork along the rotating selector shaft.', 'A U-shaped fork rides two shaft collars and strokes axially with a two-per-orbit cam schedule, preserving all gear ratios.', 'teal');
  selectorFork.position.set(-.10, 1.635, .275);
  for (const side of [-1, 1]) {
    rod(selectorFork, 'teal', [side * .045, 0, 0], [side * .045, -.075, 0], .006);
    add(selectorFork, 'box', 'brass', [side * .045, -.080, 0], [.018, .022, .020]);
  }
  rod(selectorFork, 'dark', [-.045, 0, 0], [.045, 0, 0], .008);
  const selectorDetent = kit.part({ id: 'selector.detent', name: 'Selector spring detent', system: 'Service control', function: 'Show the spring-loaded fork detent.', how: 'A small copper spring and steel ball move with the fork; engagement is illustrative, not force-solved.', material: 'Copper spring, titanium ball', unit: 'm · rad', detail: 'Selector detent: follows the sliding fork.' }, selectorFork, [0, -.02, .03]);
  for (let k = 0; k < 4; k++) rod(selectorDetent, 'copper', [.02 + k * .006, -.012 - k * .008, .012], [.026 + k * .006, -.016 - k * .008, .012], .0018);
  add(selectorDetent, 'sphere', 'titanium', [.045, -.044, .012], [.005, .005, .005]);
  const selectorBracket = make('selector.bracket', 'Selector shaft pedestal bracket', 'Service fixture', 'Hold the selector shaft above the fixed ring.', 'Two grounded tie rods meet the upper shell cage and carry bolted shaft journals.', 'shell');
  for (const x of [-.36, .20]) {
    const anchorY = P.centreY + Math.sqrt(.663 ** 2 - x * x);
    rod(selectorBracket, 'shell', [x, anchorY, .23], [x, 1.625, .275], .011);
    boltZ(selectorBracket, [x, anchorY + .005, .245], .007);
  }
  rod(selectorBracket, 'titanium', [-.36, 1.625, .275], [.20, 1.625, .275], .006);
  // Output flange and its spinning fasteners.
  const outputFlange = kit.part({ id: 'output.flange', name: 'Bolted output coupling flange', system: 'Output train', function: 'Carry the carrier torque to the service coupling.', how: 'A dark flange, brass pilot ring and six bolt pads are rigidly keyed to the slow output shaft.', material: 'Dark flange, brass pilot', unit: 'm · rad', detail: 'Output flange: rotates with the carrier on the output shaft.' }, output, [0, .018, .09]);
  axial(outputFlange, 'dark', 0, 0, .628, .086, .018);
  ring(outputFlange, 'brass', [0, 0, .642], .068, .022);
  for (let k = 0; k < 6; k++) add(outputFlange, 'box', 'titanium', polar(.073, k * TAU / 6, .642), [.024, .020, .008], [0, 0, k * TAU / 6]);
  const flangePilot = kit.part({ id: 'output.flange.pilot', name: 'Output flange pilot ring', system: 'Output train', function: 'Centre the service coupling on the output flange.', how: 'A brass pilot ring and three oil slots turn with the slow carrier output.', material: 'Brass pilot ring', unit: 'm · rad', detail: 'Output flange pilot: rotating centring ring.' }, outputFlange, [0, .01, .05]);
  flangePilot.position.set(0, 0, 0);
  ring(flangePilot, 'brass', [0, 0, .660], .043, .014);
  for (let k = 0; k < 3; k++) add(flangePilot, 'box', 'teal', [.041 * Math.cos(k * TAU / 3), .041 * Math.sin(k * TAU / 3), .660], [.010, .004, .004], [0, 0, k * TAU / 3]);
  for (let k = 0; k < 3; k++) {
    const a = k * TAU / 3;
    const bolt = kit.part({ id: `output.flange.bolt.${k}`, name: `Output flange bolt ${k + 1}`, system: 'Output train', function: 'Clamp the output flange to the service coupling.', how: 'A separate titanium bolt and washer rotate with the output shaft.', material: 'Titanium bolt, dark washer', unit: 'm · rad', detail: `Output flange bolt ${k + 1}: individually selectable fastener.` }, outputFlange, [.02 * Math.cos(a), .02 * Math.sin(a), .02]);
    bolt.position.set(0, 0, 0);
    axial(bolt, 'dark', .073 * Math.cos(a), .073 * Math.sin(a), .651, .011, .005);
    add(bolt, 'bolt', 'titanium', [.073 * Math.cos(a), .073 * Math.sin(a), .656], [.008, .010, .008]);
  }
  // Independent fixed bearing races surround the two end shafts.
  const mainNeedles = [];
  for (const [name, z, inner, outer] of [['input', -.265, .034, .061], ['output', .228, .046, .078]]) {
    const race = centred(`bearing.${name}.races`, `${name} pedestal bearing races`, 'Main bearings', 'Locate the shaft relative to the stationary cradle.', 'Inner and outer annular races expose the roller lane instead of closing the inspection face.', 'shell', [0, .018, Math.sign(z) * .04]);
    ring(race, 'shell', [0, 0, z], outer, .085);
    ring(race, 'brass', [0, 0, z], inner, .060);
    for (let j = 0; j < 8; j++) {
      const a = j * TAU / 8, mid = (inner + outer) / 2;
      const needle = kit.part({ id: `bearing.${name}.needle.${j}`, name: `${name === 'input' ? 'Input' : 'Output'} spinning needle ${j + 1}`, system: 'Main bearings', function: 'Carry the shaft on a rolling element inside the exposed race.', how: 'Each rectangular needle spins about its own axis at an exact integer multiple of carrier speed; no rolling-contact load is solved.', material: 'Titanium needle roller', unit: 'm · rad', detail: `${name} bearing needle ${j + 1}: individually selectable rolling element.` }, undefined, [Math.cos(a) * .02, .018 + Math.sin(a) * .02, Math.sign(z) * .04]);
      needle.position.set(mid * Math.cos(a), P.centreY + mid * Math.sin(a), z);
      add(needle, 'box', 'titanium', [0, 0, 0], [.012, .010, .027], [0, 0, a]);
      mainNeedles.push({ node: needle, name, index: j });
    }
    for (const side of [-1, 1]) {
      const support = make(`bearing.${name}.support.${side}`, `${name} bearing ${side < 0 ? 'left' : 'right'} pedestal arm`, 'Service fixture', 'Transfer end-bearing loads into the fixed service posts.', 'This sloping support ends on the bearing outer race and its foot is attached to the grounded cradle.', 'teal');
      rod(support, 'teal', [side * .47, .58, z], [side * outer * .7, P.centreY - outer * .7, z], .024);
      for (let j = 0; j < 3; j++) boltZ(support, [side * (.36 - j * .09), .63 + j * .056, z + .025], .009);
    }
  }
  for (const side of [-1, 1]) {
    const foot = make(`fixture.foot.${side}`, `${side < 0 ? 'Left' : 'Right'} grounded service skid`, 'Service fixture', 'Ground the gearbox without lifting the model root.', 'Rubber pads have lower faces at y = 0; all stand parts remain fixed during explosion.', 'dark');
    add(foot, 'box', 'rubber', [side * .47, .012, 0], [.22, .024, .82]);
    add(foot, 'box', 'dark', [side * .47, .038, 0], [.15, .036, .76]);
    for (const z of [-.32, .32]) kit.fasteners(foot, [[side * .47, .063, z]], .012);
    const post = make(`fixture.post.${side}`, `${side < 0 ? 'Left' : 'Right'} cradle upright`, 'Service fixture', 'Support the ring cage and both bearing arms.', 'Two side posts rise from the skids below and outside the rotating carrier envelope.', 'teal');
    for (const z of [-.265, .228]) add(post, 'box', 'teal', [side * .47, .313, z], [.045, .516, .045]);
    rod(post, 'teal', [side * .47, .58, -.265], [side * .47, .58, .35], .022);
    const truss = make(`fixture.truss.${side}`, `${side < 0 ? 'Left' : 'Right'} anti-rack truss`, 'Service fixture', 'Resist rocking loads from the vertical gearbox.', 'Diagonal braces meet the post and the skid at real vertices, behind the gear plane.', 'titanium');
    rod(truss, 'titanium', [side * .47, .07, -.34], [side * .47, .56, .228], .012);
    rod(truss, 'titanium', [side * .47, .07, .34], [side * .47, .56, -.265], .012);
    const saddle = make(`fixture.saddle.${side}`, `${side < 0 ? 'Left' : 'Right'} cage saddle`, 'Service fixture', 'Join the lower shell hoop to the grounded side post.', 'Forked saddle lugs meet the lower cage at its annular centreline, not a floating housing shell.', 'shell');
    const x = side * .47, y = P.centreY - Math.sqrt(.663 ** 2 - .47 ** 2);
    for (const z of [-.20, .20]) {
      rod(saddle, 'shell', [x, .57, z], [x, y, z], .026);
      axial(saddle, 'brass', x, y, z, .035, .040);
    }
  }
  for (const z of [-.29, .29]) {
    const cross = make(`fixture.cross.${z}`, `${z < 0 ? 'Rear' : 'Front'} cradle cross tie`, 'Service fixture', 'Link the two service skids.', 'A low cross tie keeps the floor load path continuous underneath the free gear sweep.', 'dark');
    rod(cross, 'dark', [-.47, .095, z], [.47, .095, z], .018);
    for (let j = 0; j < 7; j++) boltZ(cross, [-.39 + j * .13, .095, z + .019], .007);
  }
  // Separate front cover lane: open arc guards outside the rotating carrier.
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    const cover = centred(`cover.arc.${i}`, `Forward inspection guard arc ${i + 1}`, 'Inspection cover', 'Protect the fixed rim while leaving the carrier visible.', 'Short shell arcs live at z = 255 mm, forward of both the gear face and carrier lane; wide windows remain open.', 'shell', [0, .015, .09]);
    arc(cover, 'shell', .637, a + .025, a + TAU / 6 - .025, .255, .013, 12);
    for (const b of [a + .045, a + TAU / 6 - .045]) {
      rod(cover, 'dark', polar(.637, b, .255), polar(.663, b, .20), .008);
      boltZ(cover, polar(.637, b, .268), .007);
    }
  }
  const feed = centred('oil.feed', 'Rear oil gallery feed and drain', 'Lubrication', 'Connect the annular gallery to a visible service inlet.', 'Copper feed and drain tubes meet the lower gallery; capped terminals distinguish them from torque-carrying braces.', 'copper', [0, .015, -.035]);
  rod(feed, 'copper', [0, -.647, -.238], [.13, -.70, -.28], .007);
  rod(feed, 'copper', [.13, -.70, -.28], [.20, -.70, -.28], .007);
  axial(feed, 'brass', .20, -.70, -.28, .013, .024);
  const plaque = make('fixture.identification', 'Service ratio identification plate', 'Inspection equipment', 'Mark the fixed-ring service fixture.', 'A teal plate with three indexed inserts indicates sun, planet and ring positions without obscuring the mechanism.', 'teal');
  add(plaque, 'box', 'teal', [0, .14, .32], [.26, .055, .009]);
  for (let j = 0; j < 3; j++) axial(plaque, 'brass', -.075 + j * .075, .14, .331, .015 + j * .003, .008);
  for (const x of [-.115, .115]) boltZ(plaque, [x, .14, .335], .005);
  group.traverse(n => { if (n.userData.partId) binds.push([n, n.position.clone(), n.quaternion.clone(), n.scale.clone()]); });
  function update(state = previous, options = {}) {
    if (disposed) return;
    if (state) previous = state;
    Object.assign(settings, options);
    settings.explode = Math.min(1, Math.max(0, Number.isFinite(settings.explode) ? settings.explode : 0));
    if (!['solid', 'xray', 'cutaway'].includes(settings.mode)) settings.mode = 'solid';
    if (!['low', 'balanced', 'high'].includes(settings.quality)) settings.quality = 'balanced';
    for (const [n, p, q, s] of binds) { n.position.copy(p); n.quaternion.copy(q); n.scale.copy(s); }
    const s = pose(previous.phase ?? ((previous.driveAngle || 0) / TAU), previous.sleeve);
    sun.rotation.z = inputShaft.rotation.z = s.sunAngle;
    for (const n of carried) n.rotation.z = s.carrierAngle;
    planetNodes.forEach((n, i) => { n.position.fromArray(s.planets[i].centre); n.rotation.z = s.planets[i].angle; });
    sleeve.position.z = fork.position.z = s.sleeveZ; sleeve.rotation.z = s.carrierAngle;
    pumpParts.forEach((n, i) => { n.rotation.z = s.pumpAngles[i]; });
    pumpRotor.rotation.z = -3 * s.carrierAngle;
    selectorShaft.rotation.x = s.selectorAngle;
    selectorFork.position.x = -.10 + s.selectorForkX;
    carrierNeedleFrame.rotation.z = s.carrierAngle;
    ringRollerFrame.rotation.z = s.ringRollerAngle;
    carrierNeedles.forEach((n, k) => { n.rotation.z = s.carrierNeedleSpin + k * .113; });
    ringRollers.forEach((n, k) => { n.rotation.z = -3 * s.ringRollerAngle + k * .071; });
    mainNeedles.forEach(({ node, name, index }) => { node.rotation.z = (name === 'input' ? s.inputRollerSpin : s.outputRollerSpin) + index * .097; });
    kit.sync({ ...settings, selectedId: settings.highlight === false ? null : settings.selectedId });
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
