import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample, trackPose } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('TERRA X7 · hydraulic tracked excavator');
  const nodes = [], shoes = [], rollers = [], wheels = [], cylinders = [];
  const add = kit.add, rod = kit.rod, aim = kit.aim;
  let disposed = false, lastState = sample(0);
  const part = (id, name, system, purpose, how, parent, explode = [0, .10, 0], material = 'Machined titanium, dark alloy and hydraulic seals') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const plate = (node, material, p, size, euler = [0, 0, 0], detail = false) => add(node, 'box', material, p, size, euler, detail);
  const axial = (node, material, p, radius, length, axis = 'x', detail = false) => {
    const euler = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'cylinder', material, p, [radius, length, radius], euler, detail);
  };
  const polar = (r, a) => [r * Math.cos(a), r * Math.sin(a)];
  const local = p => [p[0], p[1] - D.houseY, p[2]];

  // ---------------------------------------------------------------- undercarriage
  for (const side of [-1, 1]) {
    const id = side < 0 ? 'L' : 'R', label = side < 0 ? 'left' : 'right';
    const frame = part(`track.frame.${id}`, `${label} track frame and final drive`, 'Undercarriage',
      'Carries the track rollers, idler and drive sprocket without touching the ground.',
      'A heavy side plate, two longitudinal flanges and four roller bosses form the fixed track frame inside the belt.', undefined, [0, 0, 0], 'Heavy dark side plate and titanium flanges');
    plate(frame, 'dark', [side * D.trackX, D.trackY, 0], [.13, .24, 1.62]);
    for (const x of [-.075, .075]) rod(frame, 'titanium', [side * D.trackX + x, D.trackY + .09, -.72], [side * D.trackX + x, D.trackY + .09, .72], .012);
    for (const z of [-.72, .72]) axial(frame, 'brass', [side * D.trackX, D.trackY, z], .065, .17);
    axial(frame, 'dark', [side * (D.trackX + .10), D.trackY, -.30], .085, .09);
    for (let i = 0; i < 5; i++) add(frame, 'bolt', 'titanium', [side * (D.trackX + .07), D.trackY + .13, -.55 + i * .27], [.011, .012, .011], [0, 0, Math.PI / 2], true);

    const body = part(`carbody.${id}`, `${label} carbody rail and jacking pad`, 'Undercarriage',
      'Links the track frame to the slewing ring.',
      'A low alloy beam, a rubber jacking pad and two bolted stays sit between the track frame and the centre casting.', undefined, [0, 0, 0]);
    plate(body, 'dark', [side * .37, .55, 0], [.18, .12, 1.15]);
    plate(body, 'rubber', [side * .37, .48, .42], [.20, .02, .22]);
    for (const z of [-.38, .38]) rod(body, 'titanium', [side * .45, .52, z], [side * .24, .58, z * 1.4], .012);

    const idler = part(`idler.${id}`, `${label} front idler wheel`, 'Undercarriage',
      'Guides the track belt around the front of the frame.',
      'A machined ring, a dark hub and six spokes rotate together between the track shoes.', undefined, [0, .05, 0], 'Machined ring and dark hub');
    idler.position.set(side * D.trackX, D.trackY, D.trackHalf);
    add(idler, 'ring', 'titanium', [0, 0, 0], [.255, .255, .255], [0, Math.PI / 2, 0]);
    axial(idler, 'dark', [0, 0, 0], .075, .13);
    for (let i = 0; i < 6; i++) { const [y, z] = polar(.19, i * TAU / 6); rod(idler, 'titanium', [0, 0, 0], [0, y, z], .012); }
    wheels.push({ node: idler, ratio: -1.9 });

    const sprocket = part(`sprocket.${id}`, `${label} drive sprocket`, 'Undercarriage',
      'Drives the track belt through its tooth pockets.',
      'A toothed brass sprocket, a dark final-drive hub and a bolted guard rotate on the fixed axle.', undefined, [0, .05, 0], 'Brass sprocket and dark final drive');
    sprocket.position.set(side * D.trackX, D.trackY, -D.trackHalf);
    add(sprocket, 'ring', 'brass', [0, 0, 0], [.245, .245, .245], [0, Math.PI / 2, 0]);
    for (let i = 0; i < 12; i++) {
      const [y, z] = polar(.258, i * TAU / 12);
      add(sprocket, 'box', 'brass', [0, y, z], [.085, .055, .06], [i * TAU / 12, 0, 0]);
    }
    axial(sprocket, 'dark', [0, 0, side * .05], .095, .12);
    for (let i = 0; i < 4; i++) add(sprocket, 'bolt', 'titanium', polar(.085, i * TAU / 4).map((v, k) => k ? v : 0), [.011, .012, .011], [0, 0, Math.PI / 2], true);
    wheels.push({ node: sprocket, ratio: 2.6 });

    for (let i = 0; i < 4; i++) {
      const z = -.48 + i * .32;
      const roller = part(`roller.${id}.${i + 1}`, `${label} track roller ${i + 1} of four`, 'Undercarriage',
        'Supports the lower run of the track belt.',
        'A rubber-tyred roller, a brass axle and two dark retainers turn inside the track frame.', undefined, [0, .04, 0], 'Rubber tyre, brass axle and dark retainers');
      roller.position.set(side * (D.trackX - .005), D.trackY - .19, z);
      axial(roller, 'rubber', [0, 0, 0], .105, .10);
      axial(roller, 'brass', [0, 0, 0], .034, .15);
      for (const x of [-.045, .045]) add(roller, 'ring', 'dark', [x, 0, 0], [.062, .062, .062], [0, Math.PI / 2, 0], true);
      for (const y of [-.08, .08]) rod(roller, 'dark', [0, 0, 0], [0, y, 0], .008);
      rollers.push({ node: roller });
    }

    for (let i = 0; i < D.shoeCount; i++) {
      const shoe = part(`shoe.${id}.${String(i + 1).padStart(2, '0')}`, `${label} track shoe ${String(i + 1).padStart(2, '0')} of fourteen`, 'Track belt',
        'Transfers the machine load into the ground along the bottom run.',
        'A steel shoe plate, a rubber tread pad and a pair of hinge pins travel around the stadium path without stretching the belt.', undefined, [0, .02, 0], 'Steel shoe plate and rubber tread');
      plate(shoe, 'dark', [0, 0, 0], [.32, .055, .15]);
      plate(shoe, 'rubber', [0, -.033, 0], [.29, .022, .125]);
      for (const z of [-.062, .062]) axial(shoe, 'titanium', [0, .004, z], .014, .31);
      add(shoe, 'bolt', 'brass', [.10, .032, 0], [.012, .02, .012], [0, 0, 0], true);
      shoes.push({ node: shoe, side, index: i });
    }
  }

  const center = part('carbody.centre', 'Centre casting and slewing ring', 'Undercarriage',
    'Carries the rotating upper structure on the track frame.',
    'A boxed centre casting, a wide brass slew ring and eight visible retaining bolts sit between the two track frames.', undefined, [0, 0, 0], 'Boxed casting and brass slew ring');
  plate(center, 'dark', [0, .50, 0], [.78, .24, 1.02]);
  add(center, 'cylinder', 'titanium', [0, .58, 0], [.44, .06, .44]);
  add(center, 'ring', 'brass', [0, .62, 0], [.42, .42, .42], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) add(center, 'bolt', 'titanium', [.34 * Math.cos(i * TAU / 8), .63, .34 * Math.sin(i * TAU / 8)], [.012, .02, .012], [0, 0, 0], true);

  const blade = part('blade.plate', 'Front dozer blade and cutting edge', 'Ground tools',
    'Provides a visible front working tool for the tracked chassis.',
    'A curved alloy blade, a brass replaceable edge and six bolt pockets sit ahead of the track frames without touching the shoes.', undefined, [0, 0, 0], 'Alloy blade and brass cutting edge');
  plate(blade, 'shell', [0, .20, D.bladeZ], [1.34, .30, .10], [-.12, 0, 0]);
  plate(blade, 'brass', [0, .075, D.bladeZ + .06], [1.30, .05, .05]);
  for (let i = 0; i < 6; i++) plate(blade, 'dark', [-.50 + i * .20, .18, D.bladeZ + .055], [.08, .16, .018], [-.12, 0, 0], true);
  const bladeArms = part('blade.arms', 'Blade push arms and pivot eyes', 'Ground tools',
    'Connect the blade to the undercarriage.',
    'Two triangular push arms, four brass pivot eyes and diagonal braces reach the track frame behind the blade.', undefined, [0, 0, 0]);
  for (const side of [-1, 1]) {
    rod(bladeArms, 'dark', [side * .44, .30, .62], [side * .44, .20, D.bladeZ], .035);
    rod(bladeArms, 'titanium', [side * .44, .44, .62], [side * .44, .20, D.bladeZ], .018);
    add(bladeArms, 'ring', 'brass', [side * .44, .30, .62], [.055, .055, .055], [0, Math.PI / 2, 0]);
  }
  for (const side of [-1, 1]) {
    const ram = part(`blade.ram.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} blade tilt ram`, 'Ground tools',
      'Holds the blade angle against the push arms.',
      'A dark barrel and a chrome piston run from the track frame to the blade bracket without a pressure solver.', undefined, [0, .05, 0], 'Dark barrel and chrome piston');
    rod(ram, 'dark', [side * .30, .55, .55], [side * .30, .32, .95], .035);
    rod(ram, 'titanium', [side * .30, .32, .95], [side * .30, .21, 1.27], .018);
    add(ram, 'ring', 'brass', [side * .30, .55, .55], [.045, .045, .045], [0, 0, 0]);
  }

  // ---------------------------------------------------------------- upper structure
  const house = new THREE.Group(); house.name = 'slewing-house'; house.position.y = D.houseY; kit.assemblies.add(house);
  const turntable = part('house.turntable', 'Slewing turntable and ring gear', 'Slew',
    'Rotates the cab, engine and boom as one upper structure.',
    'A dark turntable disc carries a 30-tooth brass ring gear and six roller bearing blocks above the fixed centre casting.', house, [0, .04, 0], 'Dark turntable and brass ring gear');
  axial(turntable, 'dark', [0, .03, 0], .47, .09, 'y');
  kit.gear(turntable, .40, 30, .035, 'brass');
  for (let i = 0; i < 6; i++) add(turntable, 'bolt', 'titanium', [.42 * Math.cos(i * TAU / 6), .08, .42 * Math.sin(i * TAU / 6)], [.012, .018, .012], [0, 0, 0], true);

  const platform = part('house.platform', 'Upper frame and service walkway', 'Structure',
    'Carries every upper-structure module on one flat frame.',
    'A machined deck, two longitudinal beams and perforated walkway plates leave the slew ring and hose runs visible.', house, [0, .04, 0]);
  plate(platform, 'dark', [0, .10, -.10], [1.12, .10, 1.55]);
  plate(platform, 'titanium', [.44, .16, -.10], [.24, .025, 1.30]);
  for (let i = 0; i < 9; i++) plate(platform, 'dark', [.44, .178, -.62 + i * .13], [.20, .008, .018], [0, 0, 0], true);
  for (const side of [-1, 1]) rod(platform, 'titanium', [side * .35, .145, -.70], [side * .35, .145, .58], .022);

  const counterweight = part('house.counterweight', 'Cast counterweight and brass bumper', 'Structure',
    'Balances the reach of the boom and bucket.',
    'A heavy curved shell block, a brass rub strip and four recessed lifting pockets sit behind the slew ring.', house, [0, .06, -.02], 'Cast pale shell and brass rub strip');
  plate(counterweight, 'shell', [0, .26, -.80], [1.06, .42, .30]);
  plate(counterweight, 'brass', [0, .13, -.94], [1.04, .10, .05]);
  for (const x of [-.42, -.14, .14, .42]) plate(counterweight, 'dark', [x, .30, -.955], [.10, .14, .02], [0, 0, 0], true);
  kit.fasteners(counterweight, [[-.44, .44, -.80], [.44, .44, -.80]], .014);

  const engine = part('house.engine', 'Engine hood and cooling package', 'Power',
    'Houses the diesel engine and radiator under a service cover.',
    'A dark hood, eight louvre plates and a pale top panel sit behind the cab, with the exhaust stack clear of the boom.', house, [0, .05, 0], 'Dark hood and pale top panel');
  plate(engine, 'dark', [0, .35, -.28], [.92, .36, .74]);
  plate(engine, 'shell', [0, .54, -.30], [.86, .04, .66]);
  for (let i = 0; i < 8; i++) plate(engine, 'titanium', [-.30 + i * .085, .40, -.655], [.055, .20, .012], [0, 0, 0], true);
  for (let i = 0; i < 3; i++) axial(engine, 'brass', [.34, .18 + i * .09, -.60], .018, .05, 'z', true);

  const exhaust = part('house.exhaust', 'Exhaust stack and heat shield', 'Power',
    'Shows the exhaust path above the engine hood.',
    'A dark vertical pipe, a perforated brass heat shield and a rain cap rise behind the cab.', house, [0, .08, 0], 'Dark pipe and perforated brass shield');
  axial(exhaust, 'dark', [.28, .70, -.34], .045, .38, 'y');
  axial(exhaust, 'brass', [.28, .84, -.34], .058, .07, 'y');
  for (let i = 0; i < 9; i++) add(exhaust, 'ring', 'dark', [.28, .58 + i * .022, -.34], [.055, .055, .055], [Math.PI / 2, 0, 0], i % 2 === 0);
  add(exhaust, 'sphere', 'brass', [.28, .91, -.34], [.03, .018, .03]);

  const cab = part('cab.frame', 'Operator cab and four glazed sides', 'Operator station',
    'Protects the operator and gives a clear view of the bucket.',
    'Eight corner posts, a pale roof, a dark floor and four teal glass panes form an open frame around the seat.', house, [0, .06, .02], 'Pale roof, dark floor and teal glass');
  const cabX = -.36, cabZ = .18;
  plate(cab, 'dark', [cabX, .22, cabZ], [.62, .08, .78]);
  plate(cab, 'shell', [cabX, .80, cabZ], [.66, .05, .82]);
  for (const x of [-.29, .29]) for (const z of [-.37, .37]) rod(cab, 'titanium', [cabX + x, .24, cabZ + z], [cabX + x, .78, cabZ + z], .016);
  plate(cab, 'lens', [cabX, .50, cabZ + .385], [.56, .44, .012]);
  plate(cab, 'lens', [cabX - .305, .50, cabZ], [.012, .44, .72]);
  plate(cab, 'lens', [cabX + .305, .50, cabZ], [.012, .44, .72]);
  plate(cab, 'dark', [cabX, .50, cabZ - .385], [.56, .44, .012]);
  rod(cab, 'brass', [cabX + .27, .28, cabZ + .40], [cabX + .27, .44, cabZ + .40], .008);
  plate(cab, 'titanium', [cabX - .22, .84, cabZ + .40], [.16, .02, .05], [0, 0, 0], true);

  const seat = part('cab.seat', 'Suspended operator seat', 'Operator station',
    'Places the operator behind the control console.',
    'A dark cushion, a pale backrest and a brass suspension column sit on the cab floor.', house, [0, .04, 0], 'Dark cushion, pale backrest and brass column');
  plate(seat, 'dark', [cabX, .36, cabZ - .05], [.30, .08, .30]);
  plate(seat, 'shell', [cabX, .52, cabZ - .18], [.32, .30, .07], [-.16, 0, 0]);
  axial(seat, 'brass', [cabX, .27, cabZ - .05], .05, .11, 'y');

  const console = part('cab.console', 'Control console and two displays', 'Operator station',
    'Shows the joystick and screen layout used to command the arm.',
    'Two teal screens, six brass switches and a dark armrest console face the seat through the front glass.', house, [0, .04, 0], 'Teal displays and brass switches');
  plate(console, 'dark', [cabX + .10, .38, cabZ + .30], [.26, .10, .10], [.18, 0, 0]);
  for (const x of [-.05, .05]) plate(console, 'lens', [cabX + .10 + x, .46, cabZ + .29], [.08, .06, .012], [.18, 0, 0]);
  for (let i = 0; i < 6; i++) add(console, 'bolt', 'brass', [cabX + .16 + (i % 3) * .035, .335, cabZ + .34], [.006, .012, .006], [Math.PI / 2, 0, 0], true);

  const tank = part('house.tank', 'Hydraulic reservoir and fuel tank', 'Power',
    'Stores the working fluids beside the engine compartment.',
    'Two pale cylindrical tanks, brass filler caps and dark strap bands sit on the deck opposite the cab.', house, [0, .06, 0], 'Pale tanks and brass filler caps');
  for (const [x, z, radius] of [[.46, .06, .16], [.46, -.34, .13]]) {
    axial(tank, 'shell', [x, .30, z], radius, .42, 'z');
    add(tank, 'cylinder', 'brass', [x, .48, z], [radius * .33, .04, radius * .33], [0, 0, 0], false);
    for (const dz of [-.13, .13]) add(tank, 'ring', 'dark', [x, .30, z + dz], [radius * 1.04, radius * 1.04, radius * 1.04], [Math.PI / 2, 0, 0]);
  }

  const handrail = part('house.handrails', 'Walkway handrails and toe boards', 'Structure',
    'Provides the service access guard around the upper deck.',
    'Thin titanium rails, four brass stanchions and a dark toe board follow the walkway edge without crossing the boom.', house, [0, .05, 0], 'Titanium rails and brass stanchions');
  for (const z of [-.62, -.05, .52]) {
    rod(handrail, 'titanium', [.60, .20, z], [.60, .72, z], .010);
    add(handrail, 'sphere', 'brass', [.60, .72, z], [.014, .014, .014]);
  }
  rod(handrail, 'titanium', [.60, .72, -.62], [.60, .72, .52], .010);
  rod(handrail, 'titanium', [.60, .40, -.62], [.60, .40, .52], .008);
  plate(handrail, 'dark', [.61, .19, -.05], [.02, .10, 1.18]);

  for (const side of [-1, 1]) {
    const lamp = part(`cab.lamp.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} work lamp`, 'Operator station',
      'Lights the bucket working area.',
      'A dark housing, a teal lens and a brass bezel are bolted to the cab roof corner.', house, [0, .04, 0], 'Dark housing, teal lens and brass bezel');
    const x = cabX + side * .26;
    plate(lamp, 'dark', [x, .86, cabZ + .32], [.12, .09, .10]);
    add(lamp, 'sphere', 'lens', [x, .88, cabZ + .38], [.045, .035, .018]);
    add(lamp, 'ring', 'brass', [x, .88, cabZ + .37], [.048, .048, .048], [0, 0, 0]);
  }
  for (const side of [-1, 1]) {
    const mirror = part(`cab.mirror.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} rear-view mirror`, 'Operator station',
      'Shows the track and counterweight behind the cab.',
      'A dark mirror shell, a teal face and two brass arms stand clear of the glass on the cab corner.', house, [0, .04, 0], 'Dark shell, teal face and brass arms');
    rod(mirror, 'brass', [cabX + side * .32, .74, cabZ - .28], [cabX + side * .42, .82, cabZ - .34], .008);
    plate(mirror, 'dark', [cabX + side * .42, .82, cabZ - .34], [.03, .12, .09]);
    plate(mirror, 'lens', [cabX + side * .42, .82, cabZ - .34], [.012, .10, .07], [0, 0, 0], true);
  }

  const steps = part('cab.steps', 'Cab access steps and grab handle', 'Operator station',
    'Provides a visible route into the operator cab.',
    'Three tread plates, a dark stringer and a brass grab handle hang below the cab door.', house, [0, .04, 0], 'Tread plates and brass grab handle');
  for (let i = 0; i < 3; i++) {
    plate(steps, 'titanium', [cabX - .32, .26 - i * .20, cabZ + .12], [.20, .025, .26]);
    plate(steps, 'rubber', [cabX - .32, .246 - i * .20, cabZ + .12], [.17, .008, .22], [0, 0, 0], true);
  }
  rod(steps, 'brass', [cabX - .30, .20, cabZ + .34], [cabX - .30, .68, cabZ + .34], .010);

  const panels = part('house.panels', 'Service access panels', 'Structure',
    'Closes the engine bay while keeping the inspection fasteners visible.',
    'Four pale removable panels with dark latch plates are bolted to the frame beside the engine hood.', house, [0, .04, 0], 'Pale panels and dark latches');
  for (const side of [-1, 1]) {
    plate(panels, 'shell', [side * .49, .34, -.18], [.02, .26, .42]);
    plate(panels, 'dark', [side * .505, .34, -.06], [.012, .05, .08]);
  }
  for (const x of [-.20, .20]) plate(panels, 'shell', [x, .28, .58], [.20, .22, .02]);
  kit.fasteners(panels, [[-.24, .44, -.26], [.24, .44, -.26], [-.24, .24, -.26], [.24, .24, -.26]], .008);

  const fire = part('cab.extinguisher', 'Cab fire extinguisher', 'Operator station',
    'Shows a service extinguisher inside the cab.',
    'A red-painted cylinder, a brass valve and a dark bracket are mounted behind the seat.', house, [0, .03, 0], 'Red cylinder, brass valve and dark bracket');
  axial(fire, 'rubber', [cabX + .22, .34, cabZ - .26], .045, .22, 'y');
  add(fire, 'cylinder', 'brass', [cabX + .22, .46, cabZ - .26], [.022, .035, .022]);
  plate(fire, 'dark', [cabX + .22, .34, cabZ - .31], [.05, .12, .02]);

  const wiper = part('cab.wiper', 'Windshield wiper and washer jet', 'Operator station',
    'Shows the wiper drive on the front glass.',
    'A thin dark arm, a rubber blade and a brass spindle sit against the front pane.', house, [0, .03, 0], 'Dark arm, rubber blade and brass spindle');
  rod(wiper, 'dark', [cabX - .18, .30, cabZ + .40], [cabX + .14, .62, cabZ + .40], .006);
  rod(wiper, 'rubber', [cabX - .18, .30, cabZ + .405], [cabX + .14, .62, cabZ + .405], .004);
  add(wiper, 'cylinder', 'brass', [cabX - .18, .30, cabZ + .40], [.012, .018, .012], [Math.PI / 2, 0, 0]);

  const antenna = part('cab.antenna', 'Radio antenna and beacon base', 'Operator station',
    'Marks the communication fit on the cab roof.',
    'A thin titanium whip, a dark base and a brass collar rise from the rear roof corner.', house, [0, .03, 0], 'Titanium whip and brass collar');
  rod(antenna, 'titanium', [cabX + .20, .82, cabZ - .32], [cabX + .24, 1.08, cabZ - .36], .004);
  add(antenna, 'cylinder', 'dark', [cabX + .20, .825, cabZ - .32], [.018, .02, .018]);
  add(antenna, 'sphere', 'brass', [cabX + .24, 1.08, cabZ - .36], [.008, .008, .008]);

  const plaque = part('house.nameplate', 'TERRA X7 designation plate', 'Inspection equipment',
    'Identifies the machine on the upper frame.',
    'A teal plate with three brass service studs and two titanium screws is mounted beside the cab door.', house, [0, .04, 0], 'Teal plate and brass studs');
  plate(plaque, 'teal', [cabX + .34, .28, .51], [.20, .05, .012]);
  for (let i = 0; i < 3; i++) add(plaque, 'bolt', 'brass', [cabX + .30 + i * .04, .28, .52], [.006, .01, .006], [Math.PI / 2, 0, 0], true);

  // ---------------------------------------------------------------- arm
  const boomFoot = part('boom.foot', 'Boom foot bearing and chassis bracket', 'Boom',
    'Defines the boom pitch axis on the slewing house.',
    'Twin bearing cheeks, a brass pin and four bolted gussets clamp the boom root to the upper frame.', house, [0, .06, 0], 'Twin bearing cheeks and brass pin');
  boomFoot.position.fromArray(local(D.boomPivot));
  for (const side of [-1, 1]) {
    plate(boomFoot, 'dark', [side * .16, 0, 0], [.05, .28, .26]);
    add(boomFoot, 'ring', 'brass', [side * .19, 0, 0], [.065, .065, .065], [0, Math.PI / 2, 0]);
  }
  axial(boomFoot, 'titanium', [0, 0, 0], .032, .42);
  for (const side of [-1, 1]) rod(boomFoot, 'titanium', [side * .16, -.12, -.10], [side * .16, -.12, .22], .014);

  const boom = part('boom.beam', 'Reinforced boom and hydraulic hoses', 'Boom',
    'Raises the stick and bucket through the 1,150 mm boom link.',
    'Twin box rails, nine cross braces, two end bosses and a copper hose run form one rigid boom.', house, [0, .08, 0], 'Twin box rails, brass bosses and copper hoses');
  for (const x of [-.095, .095]) rod(boom, 'titanium', [x, .02, 0], [x, D.boomLength - .02, 0], .026);
  for (let i = 0; i <= 8; i++) plate(boom, 'dark', [0, .10 + i * .12, 0], [.20, .035, .10]);
  for (const y of [0, D.boomLength]) {
    add(boom, 'ring', 'brass', [0, y, 0], [.062, .062, .062], [0, Math.PI / 2, 0]);
    axial(boom, 'titanium', [0, y, 0], .028, .24);
  }
  for (const z of [-.10, .10]) rod(boom, 'copper', [0, .12, z], [0, D.boomLength - .12, z], .006, true);
  plate(boom, 'brass', [.12, .62, .10], [.03, .16, .06], [0, 0, .2], true);

  for (const id of ['boom', 'stick', 'bucket']) {
    const label = id === 'boom' ? 'Boom' : id === 'stick' ? 'Stick' : 'Bucket';
    for (const half of ['barrel', 'rod']) {
      const node = part(`${id}.ram.${half}`, `${label} cylinder ${half}`, 'Hydraulics',
        id === 'boom' ? 'Raises and lowers the boom.' : id === 'stick' ? 'Folds the stick through its working arc.' : 'Drives the bucket four-bar rocker.',
        'A telescoping dark barrel and pale piston are drawn between the sampled pin centres; no oil flow or force is solved.', house, [0, .10, 0], half === 'barrel' ? 'Dark hydraulic barrel' : 'Chrome piston rod');
      const radius = half === 'barrel' ? .052 : .032;
      add(node, 'cylinder', half === 'barrel' ? 'dark' : 'titanium', [0, .5, 0], [radius, 1, radius]);
      add(node, 'ring', 'brass', [0, .02, 0], [radius * 1.18, radius * 1.18, radius * 1.18], [0, 0, 0]);
      add(node, 'cylinder', 'brass', [0, .08, 0], [radius * .72, .04, radius * .72]);
      cylinders.push({ id, half, node });
    }
  }

  const stickFoot = part('stick.foot', 'Stick root bearing and boom tip clevis', 'Stick',
    'Transfers the boom load into the stick.',
    'A pair of titanium cheeks, a brass pin and two retaining collars clamp the stick to the boom tip.', house, [0, .06, 0], 'Titanium cheeks and brass pin');
  for (const side of [-1, 1]) plate(stickFoot, 'dark', [side * .10, 0, 0], [.04, .18, .18]);
  axial(stickFoot, 'brass', [0, 0, 0], .026, .24);

  const stick = part('stick.beam', 'Stick beam and bucket linkage brackets', 'Stick',
    'Positions the bucket through the 920 mm stick link.',
    'Twin tapered rails, six cross braces, a rocker bracket and a copper service line form one rigid stick.', house, [0, .08, 0], 'Tapered rails and brass linkage bracket');
  for (const x of [-.065, .065]) rod(stick, 'titanium', [x, .02, 0], [x, D.stickLength - .02, 0], .021);
  for (let i = 0; i <= 7; i++) plate(stick, 'dark', [0, .06 + i * .13, 0], [.14, .028, .075]);
  for (const y of [0, D.stickLength]) { add(stick, 'ring', 'brass', [0, y, 0], [.050, .050, .050], [0, Math.PI / 2, 0]); axial(stick, 'titanium', [0, y, 0], .022, .22); }
  rod(stick, 'copper', [.085, .12, 0], [.085, D.stickLength - .10, 0], .005, true);
  plate(stick, 'brass', [0, D.stickLength - .30, .08], [.16, .07, .05]);

  const bucket = part('bucket.shell', 'Bucket shell and side plates', 'Bucket',
    'Carries the excavated material through the bucket arc.',
    'An open scoop of side plates, a curved back and a reinforced floor pivots on the stick tip without a closed volume.', house, [0, .08, 0], 'Pale scoop shell and dark side plates');
  plate(bucket, 'shell', [0, .18, -.06], [.44, .30, .06], [-.10, 0, 0]);
  for (const x of [-.22, .22]) plate(bucket, 'dark', [x, .18, .08], [.035, .30, .28]);
  plate(bucket, 'titanium', [0, .06, .13], [.42, .045, .26], [.08, 0, 0]);
  for (let i = 0; i < 4; i++) plate(bucket, 'dark', [-.15 + i * .10, .30, -.10], [.075, .02, .08], [0, 0, 0], true);
  for (const side of [-1, 1]) add(bucket, 'ring', 'brass', [side * .24, .10, .10], [.045, .045, .045], [0, Math.PI / 2, 0]);

  const bucketEdge = part('bucket.edge', 'Cutting edge and five bucket teeth', 'Bucket',
    'Shows the replaceable ground-engaging edges.',
    'A brass edge strip and five tapered teeth are bolted to the bucket lip and follow the bucket frame exactly.', bucket, [0, .04, 0], 'Brass edge strip and tapered teeth');
  plate(bucketEdge, 'brass', [0, .39, .20], [.44, .045, .06], [.14, 0, 0]);
  for (let i = 0; i < 5; i++) {
    plate(bucketEdge, 'titanium', [-.18 + i * .09, .43, .245], [.045, .09, .035], [.14, 0, 0]);
    add(bucketEdge, 'bolt', 'dark', [-.18 + i * .09, .40, .225], [.008, .012, .008], [0, 0, 0], true);
  }

  const lever = part('bucket.lever', 'Bucket lever arm', 'Bucket linkage',
    'Connects the bucket shell to the four-bar link.',
    'A rigid 220 mm brass lever with two pin eyes turns with the bucket and preserves the linkage triangle.', house, [0, .05, 0]);
  for (const x of [-.025, .025]) rod(lever, 'brass', [x, 0, 0], [x, .22, 0], .012);
  for (const y of [0, .22]) add(lever, 'ring', 'titanium', [0, y, 0], [.028, .028, .028], [0, Math.PI / 2, 0]);

  const rocker = part('bucket.rocker', 'Four-bar rocker and pivot', 'Bucket linkage',
    'Converts the bucket ram stroke into bucket rotation.',
    'A 300 mm rocker with two pin eyes turns on the stick bracket and closes the linkage to the fixed-length link.', house, [0, .05, 0], 'Titanium rocker and brass pins');
  for (const x of [-.022, .022]) rod(rocker, 'titanium', [x, 0, 0], [x, .30, 0], .010);
  for (const y of [0, .30]) add(rocker, 'ring', 'brass', [0, y, 0], [.026, .026, .026], [0, Math.PI / 2, 0]);

  const link = part('bucket.link', 'Constant-length bucket link', 'Bucket linkage',
    'Keeps the rocker and bucket lever exactly 360 mm apart.',
    'A slim titanium plate with two full eyes and a central stiffening rib carries no telescoping joint.', house, [0, .05, 0], 'Slim titanium plate and brass eyes');
  for (const x of [-.018, .018]) rod(link, 'titanium', [x, 0, 0], [x, .36, 0], .009);
  for (const y of [0, .36]) add(link, 'ring', 'brass', [0, y, 0], [.022, .022, .022], [0, Math.PI / 2, 0]);

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.boom && state?.stick && state?.bucket) lastState = state;
    else if (Number.isFinite(state?.phase)) lastState = poseAt(state.phase * TAU, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    house.rotation.y = pose.house.yaw;
    aim(boom, local(pose.boom.pivot), local(pose.boom.tip));
    aim(stick, local(pose.stick.start), local(pose.stick.end));
    aim(bucket, local(pose.bucket.pivot), local(pose.bucket.tip));
    aim(lever, local(pose.bucket.pivot), local(pose.bucket.lever));
    aim(rocker, local(pose.bucket.rockerPivot), local(pose.bucket.rockerEnd));
    aim(link, local(pose.bucket.rockerEnd), local(pose.bucket.lever));
    stickFoot.position.fromArray(local(pose.stick.start));
    const shoeRecords = shoes;
    for (const record of shoeRecords) {
      const path = trackPose(record.index / D.shoeCount + pose.tracks.travel);
      record.node.position.set(record.side * D.trackX, D.trackY + path.y, path.z);
      record.node.rotation.set(path.angle, 0, 0);
    }
    for (const record of wheels) record.node.rotation.x = -pose.phase * TAU * record.ratio;
    for (const record of rollers) record.node.rotation.x = -pose.phase * TAU * 2.1;
    for (const record of cylinders) {
      const data = pose.cylinders.find(item => item.id === record.id);
      if (!data) continue;
      if (record.half === 'barrel') {
        aim(record.node, local(data.start), local(data.mid));
        record.node.scale.y = Math.max(1e-5, Math.hypot(data.mid[0] - data.start[0], data.mid[1] - data.start[1], data.mid[2] - data.start[2]));
      } else {
        aim(record.node, local(data.mid), local(data.end));
        record.node.scale.y = Math.max(1e-5, Math.hypot(data.end[0] - data.mid[0], data.end[1] - data.mid[1], data.end[2] - data.mid[2]));
      }
    }
    kit.sync(options);
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
