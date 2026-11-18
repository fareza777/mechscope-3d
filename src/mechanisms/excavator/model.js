import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, DEFAULT_INPUTS, TAU, cycleHz, poseAt, sample, trackPose } from './kin.js';

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
      'A heavy side plate, two longitudinal flanges, roller bosses and a bolted final-drive guard form the fixed track frame inside the belt.', undefined, [0, 0, 0], 'Heavy dark side plate and titanium flanges');
    plate(frame, 'dark', [side * D.trackX, D.trackY, 0], [.18, .30, 1.88]);
    for (const x of [-.085, .085]) rod(frame, 'titanium', [side * D.trackX + x, D.trackY + .10, -.80], [side * D.trackX + x, D.trackY + .10, .80], .016);
    for (const z of [-.84, .84]) axial(frame, 'brass', [side * D.trackX, D.trackY, z], .075, .19);
    axial(frame, 'dark', [side * (D.trackX + .11), D.trackY, -.36], .105, .11);
    add(frame, 'ring', 'brass', [side * (D.trackX + .14), D.trackY, -.36], [.12, .12, .12], [0, Math.PI / 2, 0]);
    plate(frame, 'shell', [side * (D.trackX + .10), D.trackY + .11, -.02], [.035, .16, 1.52]);
    for (let i = 0; i < 5; i++) add(frame, 'bolt', 'titanium', [side * (D.trackX + .115), D.trackY + .15, -.66 + i * .33], [.012, .014, .012], [0, 0, Math.PI / 2], true);

    const guard = part(`track.guard.${id}`, `${label} track guard and fender`, 'Undercarriage',
      'Shields the upper track run and sheds spoil away from the rollers.',
      'A broad dark fender, a pale wear strip, a rubber flap and four bolted feet sit above the moving shoes.', undefined, [0, .02, 0], 'Dark fender, pale wear strip and rubber flap');
    plate(guard, 'dark', [side * D.trackX, D.trackY + D.trackRadius + .11, 0], [.46, .07, 1.94]);
    plate(guard, 'shell', [side * D.trackX, D.trackY + D.trackRadius + .15, .10], [.39, .04, 1.48]);
    for (const z of [-.99, .99]) plate(guard, 'rubber', [side * D.trackX, D.trackY + D.trackRadius + .055, z], [.38, .16, .035], [-.14, 0, 0]);
    for (const z of [-.72, .72]) plate(guard, 'dark', [side * (D.trackX + .17), D.trackY + D.trackRadius + .07, z], [.10, .14, .12], [0, 0, 0], true);

    const tensioner = part(`track.tensioner.${id}`, `${label} track tensioner`, 'Undercarriage',
      'Holds the front idler at its working distance from the track frame.',
      'A horizontal brass-bodied ram, chrome piston and two bolted clevises sit inside the track frame ahead of the idler.', undefined, [0, .03, 0], 'Brass tensioner body and chrome piston');
    axial(tensioner, 'brass', [side * D.trackX, D.trackY, D.trackHalf - .34], .055, .26, 'z');
    rod(tensioner, 'titanium', [side * D.trackX, D.trackY, D.trackHalf - .20], [side * D.trackX, D.trackY, D.trackHalf + .01], .024);
    for (const z of [D.trackHalf - .34, D.trackHalf - .02]) add(tensioner, 'ring', 'dark', [side * D.trackX, D.trackY, z], [.075, .075, .075], [Math.PI / 2, 0, 0], true);

    const body = part(`carbody.${id}`, `${label} carbody rail and jacking pad`, 'Undercarriage',
      'Links the track frame to the slewing ring.',
      'A deep alloy beam, a rubber jacking pad, two bolted stays and a cast gusset sit between the track frame and the centre casting.', undefined, [0, 0, 0]);
    plate(body, 'dark', [side * .41, .57, 0], [.24, .17, 1.28]);
    plate(body, 'rubber', [side * .41, .48, .48], [.26, .03, .30]);
    for (const z of [-.42, .42]) rod(body, 'titanium', [side * .50, .54, z], [side * .27, .61, z * 1.35], .016);
    plate(body, 'shell', [side * .545, .57, -.02], [.035, .13, .82], [0, 0, 0]);

    const idler = part(`idler.${id}`, `${label} front idler wheel`, 'Undercarriage',
      'Guides the track belt around the front of the frame.',
      'A machined ring, a dark hub and eight spokes rotate together between the track shoes.', undefined, [0, .05, 0], 'Machined ring and dark hub');
    idler.position.set(side * D.trackX, D.trackY, D.trackHalf);
    add(idler, 'ring', 'titanium', [0, 0, 0], [.275, .275, .275], [0, Math.PI / 2, 0]);
    axial(idler, 'dark', [0, 0, 0], .085, .15);
    for (let i = 0; i < 8; i++) { const [y, z] = polar(.21, i * TAU / 8); rod(idler, 'titanium', [0, 0, 0], [0, y, z], .014); }
    for (const x of [-.06, .06]) add(idler, 'ring', 'brass', [x, 0, 0], [.09, .09, .09], [0, Math.PI / 2, 0], true);
    wheels.push({ node: idler, ratio: -1.9 });

    const sprocket = part(`sprocket.${id}`, `${label} drive sprocket`, 'Undercarriage',
      'Drives the track belt through its tooth pockets.',
      'A toothed brass sprocket, a dark final-drive hub and a bolted guard rotate on the fixed axle.', undefined, [0, .05, 0], 'Brass sprocket and dark final drive');
    sprocket.position.set(side * D.trackX, D.trackY, -D.trackHalf);
    add(sprocket, 'ring', 'brass', [0, 0, 0], [.265, .265, .265], [0, Math.PI / 2, 0]);
    for (let i = 0; i < 14; i++) {
      const [y, z] = polar(.282, i * TAU / 14);
      add(sprocket, 'box', 'brass', [0, y, z], [.095, .060, .065], [i * TAU / 14, 0, 0]);
    }
    axial(sprocket, 'dark', [0, 0, side * .06], .105, .14);
    for (let i = 0; i < 5; i++) add(sprocket, 'bolt', 'titanium', polar(.09, i * TAU / 5).map((v, k) => k ? v : 0), [.012, .014, .012], [0, 0, Math.PI / 2], true);
    wheels.push({ node: sprocket, ratio: 2.6 });

    for (let i = 0; i < 5; i++) {
      const z = -.58 + i * .29;
      const roller = part(`roller.${id}.${i + 1}`, `${label} track roller ${i + 1} of five`, 'Undercarriage',
        'Supports the lower run of the track belt.',
        'A rubber-tyred roller, a brass axle, two dark retainers and four spoke bars turn inside the track frame.', undefined, [0, .04, 0], 'Rubber tyre, brass axle and dark retainers');
      roller.position.set(side * (D.trackX - .005), D.trackY - .19, z);
      axial(roller, 'rubber', [0, 0, 0], .115, .11);
      axial(roller, 'brass', [0, 0, 0], .038, .16);
      for (const x of [-.05, .05]) add(roller, 'ring', 'dark', [x, 0, 0], [.068, .068, .068], [0, Math.PI / 2, 0], true);
      for (const y of [-.085, .085]) rod(roller, 'dark', [0, 0, 0], [0, y, 0], .009);
      for (const x of [-.085, .085]) rod(roller, 'titanium', [0, 0, 0], [0, 0, x], .007, true);
      rollers.push({ node: roller });
    }

    for (let i = 0; i < D.shoeCount; i++) {
      const shoe = part(`shoe.${id}.${String(i + 1).padStart(2, '0')}`, `${label} track shoe ${String(i + 1).padStart(2, '0')} of ${D.shoeCount}`, 'Track belt',
        'Transfers the machine load into the ground along the bottom run.',
        'A steel shoe plate, a rubber tread pad, two raised grousers and a pair of hinge pins travel around the stadium path without stretching the belt.', undefined, [0, .02, 0], 'Steel shoe plate and rubber tread');
      plate(shoe, 'dark', [0, 0, 0], [.39, .065, .17]);
      plate(shoe, 'rubber', [0, -.038, 0], [.35, .022, .145]);
      for (const z of [-.052, .052]) plate(shoe, 'titanium', [0, .042, z], [.35, .020, .034], [0, 0, 0], true);
      for (const z of [-.066, .066]) axial(shoe, 'titanium', [0, .004, z], .014, .40);
      for (const x of [-.11, .11]) add(shoe, 'bolt', 'brass', [x, .038, 0], [.012, .018, .012], [0, 0, 0], true);
      shoes.push({ node: shoe, side, index: i });
    }
  }

  const center = part('carbody.centre', 'Centre casting and slewing ring', 'Undercarriage',
    'Carries the rotating upper structure on the track frame.',
    'A boxed centre casting, a wide brass slew ring, a tall slew column and twelve visible retaining bolts sit between the two track frames.', undefined, [0, 0, 0], 'Boxed casting and brass slew ring');
  plate(center, 'dark', [0, .51, 0], [.96, .30, 1.22]);
  plate(center, 'shell', [0, .56, 0], [.80, .10, .94], [0, 0, 0], true);
  add(center, 'cylinder', 'titanium', [0, .65, 0], [.48, .08, .48]);
  add(center, 'ring', 'brass', [0, .69, 0], [.46, .46, .46], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) add(center, 'bolt', 'titanium', [.37 * Math.cos(i * TAU / 12), .71, .37 * Math.sin(i * TAU / 12)], [.013, .022, .013], [0, 0, 0], true);

  const column = part('carbody.column', 'Slew column, bearing stack and hydraulic swivel', 'Undercarriage',
    'Visibly carries the slewing ring up to the rotating house instead of leaving it floating above the tracks.',
    'A thick dark column, four cast ribs, two bearing rings, a central hydraulic swivel and eight bolts bridge the centre casting and the turntable.', undefined, [0, 0, 0], 'Dark column, brass bearing rings and steel swivel');
  axial(column, 'dark', [0, .79, 0], .40, .28, 'y');
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + Math.PI / 4;
    plate(column, 'titanium', [.35 * Math.cos(a), .79, .35 * Math.sin(a)], [.07, .27, .20], [0, -a, 0], true);
  }
  add(column, 'ring', 'brass', [0, .89, 0], [.44, .44, .44], [Math.PI / 2, 0, 0]);
  add(column, 'ring', 'titanium', [0, .94, 0], [.42, .42, .42], [Math.PI / 2, 0, 0]);
  axial(column, 'brass', [0, .84, 0], .12, .26, 'y');
  axial(column, 'titanium', [0, .98, 0], .08, .08, 'y');
  for (let i = 0; i < 8; i++) add(column, 'bolt', 'titanium', [.33 * Math.cos(i * TAU / 8), .91, .33 * Math.sin(i * TAU / 8)], [.012, .018, .012], [0, 0, 0], true);

  const blade = part('blade.plate', 'Front dozer blade and cutting edge', 'Ground tools',
    'Provides a visible front working tool for the tracked chassis.',
    'A curved alloy blade, a brass replaceable edge, eight bolt pockets and two side wings sit ahead of the track frames without touching the shoes.', undefined, [0, 0, 0], 'Alloy blade and brass cutting edge');
  plate(blade, 'shell', [0, .20, D.bladeZ], [1.56, .34, .12], [-.10, 0, 0]);
  plate(blade, 'brass', [0, .075, D.bladeZ + .075], [1.52, .06, .06]);
  for (const side of [-1, 1]) plate(blade, 'shell', [side * .79, .20, D.bladeZ - .02], [.10, .32, .18], [-.10, 0, .05 * side]);
  for (let i = 0; i < 8; i++) plate(blade, 'dark', [-.56 + i * .16, .18, D.bladeZ + .07], [.07, .18, .020], [-.12, 0, 0], true);
  for (let i = 0; i < 4; i++) plate(blade, 'titanium', [0, .10 + i * .06, D.bladeZ + .065], [1.44, .012, .012], [0, 0, 0], true);
  const bladeArms = part('blade.arms', 'Blade push arms and pivot eyes', 'Ground tools',
    'Connect the blade to the undercarriage.',
    'Two heavy push arms, four brass pivot eyes, diagonal braces and bolted gussets reach the track frame behind the blade.', undefined, [0, 0, 0]);
  for (const side of [-1, 1]) {
    rod(bladeArms, 'dark', [side * .48, .34, .68], [side * .48, .20, D.bladeZ], .050);
    rod(bladeArms, 'titanium', [side * .48, .50, .68], [side * .48, .20, D.bladeZ], .024);
    rod(bladeArms, 'dark', [side * .30, .36, .70], [side * .46, .24, .95], .020, true);
    add(bladeArms, 'ring', 'brass', [side * .48, .34, .68], [.065, .065, .065], [0, Math.PI / 2, 0]);
    add(bladeArms, 'ring', 'brass', [side * .48, .20, D.bladeZ], [.055, .055, .055], [0, Math.PI / 2, 0]);
  }
  for (const side of [-1, 1]) {
    const ram = part(`blade.ram.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} blade tilt ram`, 'Ground tools',
      'Holds the blade angle against the push arms.',
      'A dark barrel and a chrome piston run from the track frame to the blade bracket without a pressure solver.', undefined, [0, .05, 0], 'Dark barrel and chrome piston');
    rod(ram, 'dark', [side * .32, .62, .60], [side * .32, .34, 1.02], .042);
    rod(ram, 'titanium', [side * .32, .34, 1.02], [side * .32, .21, D.bladeZ - .10], .022);
    add(ram, 'ring', 'brass', [side * .32, .62, .60], [.055, .055, .055], [0, 0, 0]);
    add(ram, 'ring', 'brass', [side * .32, .34, 1.02], [.050, .050, .050], [0, 0, 0], true);
  }

  // ---------------------------------------------------------------- upper structure
  const house = new THREE.Group(); house.name = 'slewing-house'; house.position.y = D.houseY; kit.assemblies.add(house);
  const cabX = -.38, cabZ = .16;
  const turntable = part('house.turntable', 'Slewing turntable and ring gear', 'Slew',
    'Rotates the cab, engine and boom as one upper structure.',
    'A deep dark turntable disc carries a 32-tooth brass ring gear, a bearing race and eight roller blocks above the fixed column.', house, [0, .04, 0], 'Dark turntable and brass ring gear');
  axial(turntable, 'dark', [0, .05, 0], .52, .13, 'y');
  kit.gear(turntable, .46, 32, .045, 'brass');
  add(turntable, 'ring', 'titanium', [0, .10, 0], [.50, .50, .50], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) add(turntable, 'bolt', 'titanium', [.48 * Math.cos(i * TAU / 8), .11, .48 * Math.sin(i * TAU / 8)], [.013, .020, .013], [0, 0, 0], true);

  const swingMotor = part('house.swingMotor', 'Slew motor, gearbox and pinion guard', 'Slew',
    'Drives the ring gear while the house turns.',
    'A bolted motor housing, a finned gearbox, a brass pinion and four service bolts sit on the turntable edge.', house, [0, .05, 0], 'Dark motor housing and brass pinion');
  plate(swingMotor, 'dark', [.37, .18, .40], [.20, .18, .24]);
  plate(swingMotor, 'titanium', [.37, .18, .29], [.15, .15, .025], [0, 0, 0], true);
  axial(swingMotor, 'brass', [.37, .18, .53], .055, .12, 'z');
  for (let i = 0; i < 4; i++) add(swingMotor, 'bolt', 'titanium', [.28 + (i % 2) * .18, .27, .34 + Math.floor(i / 2) * .12], [.010, .014, .010], [0, 0, 0], true);
  const slewPinion = part('house.slewPinion', 'Brass slew pinion', 'Slew',
    'Spins against the ring gear as the upper structure swings.',
    'A ten-tooth brass pinion with a titanium hub and four retaining bolts turns on the motor shaft.', swingMotor, [0, .03, 0], 'Brass pinion and titanium hub');
  kit.gear(slewPinion, .095, 10, .030, 'brass');
  axial(slewPinion, 'titanium', [0, .02, 0], .030, .07, 'y');
  for (let i = 0; i < 4; i++) add(slewPinion, 'bolt', 'titanium', [.05 * Math.cos(i * TAU / 4), .05, .05 * Math.sin(i * TAU / 4)], [.006, .010, .006], [0, 0, 0], true);

  const platform = part('house.platform', 'Upper frame, fenders and service walkway', 'Structure',
    'Carries every upper-structure module on one deep bolted frame.',
    'A machined deck, two longitudinal beams, two over-track fenders, perforated walkway plates and a bolted toolbox leave the slew column and hose runs visible.', house, [0, .04, 0]);
  plate(platform, 'dark', [0, .12, -.08], [1.46, .14, 1.84]);
  plate(platform, 'titanium', [.54, .205, -.06], [.26, .035, 1.70]);
  plate(platform, 'titanium', [-.54, .205, -.06], [.26, .035, 1.70]);
  for (const side of [-1, 1]) {
    plate(platform, 'shell', [side * .80, .12, -.10], [.22, .075, 1.96]);
    plate(platform, 'rubber', [side * .91, .07, -.10], [.035, .13, 1.70], [0, 0, 0], true);
    for (let i = 0; i < 6; i++) plate(platform, 'dark', [side * .55, .226, -.66 + i * .25], [.20, .008, .018], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) rod(platform, 'titanium', [side * .35, .195, -.84], [side * .35, .195, .70], .026);
  plate(platform, 'dark', [0, .045, -.04], [1.02, .06, 1.36]);

  const toolbox = part('house.toolbox', 'Lockable toolboxes and walkway risers', 'Structure',
    'Stores the daily service tools and closes the gap between deck and cab.',
    'Two dark chests, pale lids, brass latches and four bolted feet sit under the side walkways.', house, [0, .04, 0], 'Dark chest, pale lid and brass latch');
  for (const side of [-1, 1]) {
    plate(toolbox, 'dark', [side * .53, .34, -.52], [.27, .22, .44]);
    plate(toolbox, 'shell', [side * .53, .46, -.52], [.25, .035, .42]);
    plate(toolbox, 'brass', [side * .53, .36, -.30], [.06, .04, .015], [0, 0, 0], true);
    for (const z of [-.70, -.34]) add(toolbox, 'bolt', 'titanium', [side * .53, .31, z], [.010, .014, .010], [0, 0, 0], true);
  }

  const riser = part('cab.riser', 'Cab riser, isolator mounts and floor frame', 'Operator station',
    'Physically bridges the cab floor to the upper deck with a visible serviceable structure.',
    'A deep dark pedestal, a pale top plate, four rubber isolators, six bolts and two diagonal braces carry the cab above the walkway.', house, [0, .05, 0], 'Dark pedestal, pale top plate and rubber isolators');
  plate(riser, 'dark', [cabX, .205, cabZ], [.80, .11, 1.02]);
  plate(riser, 'shell', [cabX, .265, cabZ], [.72, .025, .92]);
  for (const x of [-.30, .30]) for (const z of [-.40, .40]) {
    add(riser, 'sphere', 'rubber', [cabX + x, .195, cabZ + z], [.055, .030, .055]);
    add(riser, 'bolt', 'titanium', [cabX + x, .235, cabZ + z], [.014, .030, .014]);
    rod(riser, 'titanium', [cabX + x, .17, cabZ + z], [cabX + x, .34, cabZ + z], .022);
    add(riser, 'ring', 'brass', [cabX + x, .30, cabZ + z], [.036, .036, .036], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) for (const z of [-.34, .34]) rod(riser, 'titanium', [cabX + side * .28, .18, cabZ + z], [cabX + side * .34, .30, cabZ + z], .016);
  plate(riser, 'dark', [cabX - .405, .22, cabZ - .02], [.05, .12, .96]);
  kit.fasteners(riser, [[cabX - .32, .28, cabZ - .38], [cabX + .32, .28, cabZ - .38], [cabX - .32, .28, cabZ + .38], [cabX + .32, .28, cabZ + .38]], .010);

  const counterweight = part('house.counterweight', 'Cast counterweight and brass bumper', 'Structure',
    'Balances the reach of the boom and bucket.',
    'A heavy curved shell block, a brass rub strip, six cast ribs, two tow eyes and four recessed lifting pockets sit behind the slew ring.', house, [0, .06, -.02], 'Cast pale shell and brass rub strip');
  plate(counterweight, 'shell', [0, .34, -.98], [1.16, .52, .38]);
  plate(counterweight, 'brass', [0, .13, -1.16], [1.12, .11, .06]);
  for (const x of [-.48, -.24, 0, .24, .48]) plate(counterweight, 'dark', [x, .31, -1.17], [.08, .38, .025], [0, 0, 0], true);
  for (const x of [-.44, .44]) {
    add(counterweight, 'cylinder', 'titanium', [x, .34, -1.18], [.045, .07, .045], [Math.PI / 2, 0, 0]);
    add(counterweight, 'ring', 'brass', [x, .34, -1.21], [.065, .065, .065], [Math.PI / 2, 0, 0], true);
  }
  kit.fasteners(counterweight, [[-.44, .44, -.98], [.44, .44, -.98], [-.44, .22, -.98], [.44, .22, -.98]], .014);

  const rearLights = part('house.rearLights', 'Rear work lamps and reversing beacon', 'Power',
    'Illuminates the rear walkway and the track edges.',
    'Two dark housings, two teal lenses and two brass bezels are bolted to the counterweight face.', house, [0, .04, 0], 'Dark housing, teal lens and brass bezel');
  for (const side of [-1, 1]) {
    plate(rearLights, 'dark', [side * .44, .54, -1.18], [.18, .12, .04]);
    add(rearLights, 'sphere', 'lens', [side * .44, .54, -1.21], [.055, .038, .018]);
    add(rearLights, 'ring', 'brass', [side * .44, .54, -1.20], [.062, .062, .062], [0, 0, 0], true);
  }

  const engine = part('house.engine', 'Engine hood and cooling package', 'Power',
    'Houses the diesel engine, radiator and cooling fan under a service cover.',
    'A deep dark hood, twelve louvre plates, a pale top panel and a bolted air cleaner sit behind the cab.', house, [0, .05, 0], 'Dark hood and pale top panel');
  plate(engine, 'dark', [0, .40, -.30], [.96, .46, .92]);
  plate(engine, 'shell', [0, .65, -.34], [.90, .05, .80]);
  for (let i = 0; i < 12; i++) plate(engine, 'titanium', [-.34 + i * .062, .42, -.762], [.045, .26, .015], [0, 0, 0], true);
  for (let i = 0; i < 3; i++) axial(engine, 'brass', [.36, .20 + i * .10, -.66], .020, .06, 'z', true);
  axial(engine, 'shell', [.36, .68, -.15], .10, .34, 'z');
  add(engine, 'cylinder', 'brass', [.36, .68, .04], [.112, .05, .112], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) add(engine, 'ring', 'dark', [.36, .68, -.28 + i * .11], [.112, .112, .112], [Math.PI / 2, 0, 0], true);

  const fan = part('engine.fan', 'Radiator cooling fan and guard', 'Power',
    'Moves cooling air through the radiator core.',
    'Seven titanium blades, a brass hub and a dark concentric guard spin behind the engine hood.', house, [0, .03, 0], 'Titanium blades, brass hub and dark guard');
  fan.position.set(.24, .43, -.775);
  add(fan, 'ring', 'dark', [0, 0, 0], [.17, .17, .17], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 7; i++) {
    const a = i * TAU / 7;
    plate(fan, 'titanium', [.085 * Math.cos(a), .085 * Math.sin(a), .012], [.050, .145, .010], [0, 0, -a]);
  }
  axial(fan, 'brass', [0, 0, .02], .032, .05, 'z');
  for (let i = 0; i < 4; i++) rod(fan, 'dark', [0, 0, -.02], [.18 * Math.cos(i * TAU / 4), .18 * Math.sin(i * TAU / 4), -.02], .006, true);

  const exhaust = part('house.exhaust', 'Exhaust stack and heat shield', 'Power',
    'Shows the exhaust path above the engine hood.',
    'A dark vertical pipe, a perforated brass heat shield, twelve guard rings and a rain cap rise behind the cab.', house, [0, .08, 0], 'Dark pipe and perforated brass shield');
  axial(exhaust, 'dark', [.30, .78, -.40], .052, .42, 'y');
  axial(exhaust, 'brass', [.30, .94, -.40], .066, .08, 'y');
  for (let i = 0; i < 12; i++) add(exhaust, 'ring', 'dark', [.30, .62 + i * .022, -.40], [.062, .062, .062], [Math.PI / 2, 0, 0], i % 2 === 0);
  add(exhaust, 'sphere', 'brass', [.30, 1.02, -.40], [.034, .020, .034]);

  const cab = part('cab.frame', 'Operator cab, lower body and glazed sides', 'Operator station',
    'Protects the operator and gives a clear view of the bucket.',
    'A deep shell lower body, thick corner posts, a pale roof, four teal glass panes and a framed side door form a closed operator station above the cab riser.', house, [0, .06, .02], 'Pale roof, shell lower body and teal glass');
  plate(cab, 'dark', [cabX, .25, cabZ], [.72, .12, .94]);
  plate(cab, 'shell', [cabX, .38, cabZ], [.76, .16, .98]);
  plate(cab, 'shell', [cabX, .84, cabZ], [.80, .08, 1.04]);
  for (const x of [-.32, .32]) for (const z of [-.45, .45]) {
    rod(cab, 'titanium', [cabX + x, .33, cabZ + z], [cabX + x, .81, cabZ + z], .026);
    plate(cab, 'dark', [cabX + x, .31, cabZ + z], [.06, .08, .06], [0, 0, 0], true);
  }
  plate(cab, 'lens', [cabX, .62, cabZ + .465], [.62, .36, .012]);
  plate(cab, 'lens', [cabX - .345, .62, cabZ], [.012, .36, .78]);
  plate(cab, 'lens', [cabX + .345, .62, cabZ], [.012, .36, .78]);
  plate(cab, 'dark', [cabX, .62, cabZ - .465], [.62, .36, .012]);
  plate(cab, 'shell', [cabX, .32, cabZ + .47], [.74, .06, .04]);
  plate(cab, 'dark', [cabX - .365, .42, cabZ - .02], [.022, .30, .48]);
  rod(cab, 'brass', [cabX - .385, .41, cabZ + .13], [cabX - .385, .50, cabZ + .13], .010);
  add(cab, 'bolt', 'brass', [cabX - .385, .46, cabZ - .22], [.010, .018, .010], [0, 0, Math.PI / 2], true);
  plate(cab, 'titanium', [cabX + .18, .90, cabZ - .14], [.34, .10, .42]);
  for (const x of [-.10, 0, .10]) plate(cab, 'dark', [cabX + .18 + x, .955, cabZ - .14], [.025, .015, .36], [0, 0, 0], true);
  plate(cab, 'titanium', [cabX - .20, .88, cabZ + .46], [.16, .02, .05], [0, 0, 0], true);

  const beacon = part('cab.beacon', 'Rotating roof beacon', 'Operator station',
    'Warns the ground crew while the machine is working.',
    'A dark base, a brass collar, a teal dome and two offset reflector cups rotate above the cab roof.', house, [0, .04, 0], 'Dark base, brass collar and teal dome');
  beacon.position.set(cabX - .24, .95, cabZ - .34);
  axial(beacon, 'dark', [0, -.035, 0], .045, .05, 'y');
  add(beacon, 'cylinder', 'brass', [0, -.005, 0], [.050, .018, .050]);
  add(beacon, 'sphere', 'lens', [0, .015, 0], [.045, .035, .045]);
  add(beacon, 'cylinder', 'lens', [.028, .012, 0], [.013, .020, .013]);
  add(beacon, 'cylinder', 'brass', [-.028, .012, 0], [.010, .018, .010]);

  const cabBrace = part('cab.brace', 'Cab rear brace and isolator tie', 'Operator station',
    'Ties the cab structure back to the engine deck.',
    'Two titanium diagonal braces, a bolted centre bracket and two rubber isolators close the cab-to-deck load path.', house, [0, .04, 0], 'Titanium braces and rubber isolators');
  for (const side of [-1, 1]) rod(cabBrace, 'titanium', [cabX + side * .29, .82, cabZ - .43], [.20, .67, -.52], .018);
  plate(cabBrace, 'dark', [.20, .67, -.52], [.22, .07, .07]);
  for (const side of [-1, 1]) add(cabBrace, 'sphere', 'rubber', [cabX + side * .29, .80, cabZ - .43], [.035, .025, .035], [0, 0, 0], true);

  const seat = part('cab.seat', 'Suspended operator seat', 'Operator station',
    'Places the operator behind the control console.',
    'A dark cushion, a pale backrest, a brass suspension column and a rubber isolator sit on the cab floor.', house, [0, .04, 0], 'Dark cushion, pale backrest and brass column');
  plate(seat, 'dark', [cabX, .36, cabZ - .05], [.30, .08, .30]);
  plate(seat, 'shell', [cabX, .52, cabZ - .18], [.32, .30, .07], [-.16, 0, 0]);
  axial(seat, 'brass', [cabX, .30, cabZ - .05], .05, .13, 'y');

  const console = part('cab.console', 'Control console and two displays', 'Operator station',
    'Shows the joystick and screen layout used to command the arm.',
    'Two teal screens, six brass switches and a dark armrest console face the seat through the front glass.', house, [0, .04, 0], 'Teal displays and brass switches');
  plate(console, 'dark', [cabX + .10, .38, cabZ + .30], [.26, .10, .10], [.18, 0, 0]);
  for (const x of [-.05, .05]) plate(console, 'lens', [cabX + .10 + x, .46, cabZ + .29], [.08, .06, .012], [.18, 0, 0]);
  for (let i = 0; i < 6; i++) add(console, 'bolt', 'brass', [cabX + .16 + (i % 3) * .035, .335, cabZ + .34], [.006, .012, .006], [Math.PI / 2, 0, 0], true);

  const tank = part('house.tank', 'Hydraulic reservoir and fuel tank', 'Power',
    'Stores the working fluids beside the engine compartment.',
    'Two pale cylindrical tanks, brass filler caps and dark strap bands sit on the deck opposite the cab.', house, [0, .06, 0], 'Pale tanks and brass filler caps');
  for (const [x, z, radius] of [[.57, .08, .17], [.57, -.34, .14]]) {
    axial(tank, 'shell', [x, .34, z], radius, .46, 'z');
    add(tank, 'cylinder', 'brass', [x, .34 + radius, z], [radius * .33, .05, radius * .33], [0, 0, 0], false);
    for (const dz of [-.14, .14]) add(tank, 'ring', 'dark', [x, .34, z + dz], [radius * 1.04, radius * 1.04, radius * 1.04], [Math.PI / 2, 0, 0]);
  }
  const handrail = part('house.handrails', 'Walkway handrails and toe boards', 'Structure',
    'Provides the service access guard around the upper deck.',
    'Thick titanium rails, five brass stanchions and a dark toe board follow the walkway edge without crossing the boom.', house, [0, .05, 0], 'Titanium rails and brass stanchions');
  for (const z of [-.78, -.30, .18, .62]) {
    rod(handrail, 'titanium', [.72, .22, z], [.72, .78, z], .012);
    add(handrail, 'sphere', 'brass', [.72, .78, z], [.016, .016, .016]);
  }
  rod(handrail, 'titanium', [.72, .78, -.78], [.72, .78, .62], .012);
  rod(handrail, 'titanium', [.72, .44, -.78], [.72, .44, .62], .010);
  plate(handrail, 'dark', [.73, .205, -.08], [.025, .10, 1.44]);
  for (const z of [-.60, -.10, .40]) rod(handrail, 'brass', [.72, .70, z], [.72, .78, z], .007, true);

  for (const side of [-1, 1]) {
    const lamp = part(`cab.lamp.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} work lamp`, 'Operator station',
      'Lights the bucket working area.',
      'A dark housing, a teal lens and a brass bezel are bolted to the cab roof corner.', house, [0, .04, 0], 'Dark housing, teal lens and brass bezel');
    const x = cabX + side * .30;
    plate(lamp, 'dark', [x, .91, cabZ + .38], [.14, .10, .12]);
    add(lamp, 'sphere', 'lens', [x, .92, cabZ + .45], [.050, .038, .020]);
    add(lamp, 'ring', 'brass', [x, .92, cabZ + .44], [.052, .052, .052], [0, 0, 0]);
  }
  for (const side of [-1, 1]) {
    const mirror = part(`cab.mirror.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} rear-view mirror`, 'Operator station',
      'Shows the track and counterweight behind the cab.',
      'A dark mirror shell, a teal face and two brass arms stand clear of the glass on the cab corner.', house, [0, .04, 0], 'Dark shell, teal face and brass arms');
    rod(mirror, 'brass', [cabX + side * .37, .78, cabZ - .40], [cabX + side * .48, .84, cabZ - .46], .009);
    plate(mirror, 'dark', [cabX + side * .48, .84, cabZ - .46], [.035, .14, .10]);
    plate(mirror, 'lens', [cabX + side * .48, .84, cabZ - .46], [.014, .12, .08], [0, 0, 0], true);
  }

  const steps = part('cab.steps', 'Cab access steps and grab handle', 'Operator station',
    'Provides a visible route from the deck into the operator cab.',
    'Three tread plates, a dark stringer, a rubber edge and a brass grab handle rise from the deck to the cab sill.', house, [0, .04, 0], 'Tread plates and brass grab handle');
  for (let i = 0; i < 3; i++) {
    plate(steps, 'titanium', [cabX - .43, .31 - i * .07, cabZ + .24], [.20, .025, .30]);
    plate(steps, 'rubber', [cabX - .43, .299 - i * .07, cabZ + .24], [.17, .008, .26], [0, 0, 0], true);
  }
  rod(steps, 'dark', [cabX - .51, .18, cabZ + .10], [cabX - .51, .34, cabZ + .38], .014);
  rod(steps, 'brass', [cabX - .40, .26, cabZ + .40], [cabX - .40, .72, cabZ + .40], .012);
  for (const y of [.30, .52, .70]) add(steps, 'sphere', 'brass', [cabX - .40, y, cabZ + .40], [.018, .018, .018], [0, 0, 0], true);

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
  axial(fire, 'rubber', [cabX + .22, .46, cabZ - .26], .045, .22, 'y');
  add(fire, 'cylinder', 'brass', [cabX + .22, .58, cabZ - .26], [.022, .035, .022]);
  plate(fire, 'dark', [cabX + .22, .46, cabZ - .31], [.05, .12, .02]);

  const wiper = part('cab.wiper', 'Windshield wiper and washer jet', 'Operator station',
    'Shows the wiper drive on the front glass.',
    'A thin dark arm, a rubber blade and a brass spindle sit against the front pane.', house, [0, .03, 0], 'Dark arm, rubber blade and brass spindle');
  rod(wiper, 'dark', [cabX - .22, .55, cabZ + .47], [cabX + .16, .76, cabZ + .47], .007);
  rod(wiper, 'rubber', [cabX - .22, .55, cabZ + .475], [cabX + .16, .76, cabZ + .475], .005);
  add(wiper, 'cylinder', 'brass', [cabX - .22, .55, cabZ + .47], [.013, .020, .013], [Math.PI / 2, 0, 0]);

  const antenna = part('cab.antenna', 'Radio antenna and beacon base', 'Operator station',
    'Marks the communication fit on the cab roof.',
    'A thin titanium whip, a dark base and a brass collar rise from the rear roof corner.', house, [0, .03, 0], 'Titanium whip and brass collar');
  antenna.position.set(cabX + .21, .84, cabZ - .40);
  rod(antenna, 'titanium', [0, 0, 0], [.030, .28, -.030], .004);
  add(antenna, 'cylinder', 'dark', [0, 0, 0], [.018, .022, .018]);
  add(antenna, 'sphere', 'brass', [.030, .28, -.030], [.008, .008, .008]);

  const plaque = part('house.nameplate', 'TERRA X7 designation plate', 'Inspection equipment',
    'Identifies the machine on the upper frame.',
    'A teal plate with three brass service studs and two titanium screws is mounted beside the cab door.', house, [0, .04, 0], 'Teal plate and brass studs');
  plate(plaque, 'teal', [cabX - .375, .46, cabZ + .06], [.012, .055, .22]);
  for (let i = 0; i < 3; i++) add(plaque, 'bolt', 'brass', [cabX - .386, .46, cabZ - .03 + i * .07], [.006, .012, .006], [0, 0, Math.PI / 2], true);

  // ---------------------------------------------------------------- arm
  const boomFoot = part('boom.foot', 'Boom foot bearing and chassis bracket', 'Boom',
    'Defines the boom pitch axis on the slewing house.',
    'Twin heavy bearing cheeks, a long brass pin, four bolted gussets and a service platform clamp the boom root to the upper frame.', house, [0, .06, 0], 'Twin bearing cheeks and brass pin');
  boomFoot.position.fromArray(local(D.boomPivot));
  for (const side of [-1, 1]) {
    plate(boomFoot, 'dark', [side * .18, 0, 0], [.06, .34, .32]);
    add(boomFoot, 'ring', 'brass', [side * .21, 0, 0], [.075, .075, .075], [0, Math.PI / 2, 0]);
    plate(boomFoot, 'titanium', [side * .18, -.16, .02], [.16, .06, .20], [0, 0, 0], true);
  }
  axial(boomFoot, 'titanium', [0, 0, 0], .040, .50);
  for (const side of [-1, 1]) rod(boomFoot, 'titanium', [side * .18, -.15, -.12], [side * .18, -.15, .25], .018);
  plate(boomFoot, 'shell', [0, .20, -.12], [.38, .05, .24]);
  kit.fasteners(boomFoot, [[-.12, .14, -.08], [.12, .14, -.08]], .010);

  const boom = part('boom.beam', 'Reinforced boom and hydraulic hoses', 'Boom',
    'Raises the stick and bucket through the 1,240 mm boom link.',
    'A deep central box, twin shell cheeks, ten top straps, six underside ribs, brass end bosses and two copper hose runs form one rigid boom.', house, [0, .08, 0], 'Twin shell cheeks, brass bosses and copper hoses');
  plate(boom, 'dark', [0, D.boomLength * .50, 0], [.23, D.boomLength * .90, .19]);
  for (const x of [-.145, .145]) plate(boom, 'shell', [x, D.boomLength * .50, 0], [.035, D.boomLength * .88, .17]);
  for (let i = 0; i <= 9; i++) plate(boom, 'titanium', [0, .08 + i * (D.boomLength - .16) / 9, .12], [.28, .045, .06]);
  for (let i = 0; i <= 5; i++) plate(boom, 'dark', [0, .16 + i * (D.boomLength - .32) / 5, -.12], [.20, .060, .035], [0, 0, 0], true);
  for (const y of [0, D.boomLength]) {
    add(boom, 'ring', 'brass', [0, y, 0], [.078, .078, .078], [0, Math.PI / 2, 0]);
    axial(boom, 'titanium', [0, y, 0], .036, .30);
  }
  for (const z of [-.13, .13]) rod(boom, 'copper', [0, .14, z], [0, D.boomLength - .14, z], .008, true);
  for (const y of [.28, .62, .96]) add(boom, 'ring', 'dark', [0, y, -.14], [.040, .040, .040], [Math.PI / 2, 0, 0], true);
  plate(boom, 'brass', [.15, .66, .12], [.035, .18, .07], [0, 0, .2], true);
  add(boom, 'sphere', 'lens', [.17, .30, .16], [.025, .020, .012]);

  for (const id of ['boom', 'stick', 'bucket']) {
    const label = id === 'boom' ? 'Boom' : id === 'stick' ? 'Stick' : 'Bucket';
    for (const half of ['barrel', 'rod']) {
      const node = part(`${id}.ram.${half}`, `${label} cylinder ${half}`, 'Hydraulics',
        id === 'boom' ? 'Raises and lowers the boom.' : id === 'stick' ? 'Folds the stick through its working arc.' : 'Drives the bucket four-bar rocker.',
        'A telescoping dark barrel and pale piston are drawn between the sampled pin centres; no oil flow or force is solved.', house, [0, .10, 0], half === 'barrel' ? 'Dark hydraulic barrel' : 'Chrome piston rod');
      const radius = half === 'barrel' ? .064 : .040;
      add(node, 'cylinder', half === 'barrel' ? 'dark' : 'titanium', [0, .5, 0], [radius, 1, radius]);
      add(node, 'ring', 'brass', [0, .02, 0], [radius * 1.18, radius * 1.18, radius * 1.18], [0, 0, 0]);
      add(node, 'ring', 'dark', [0, .96, 0], [radius * 1.10, radius * 1.10, radius * 1.10], [0, 0, 0], true);
      add(node, 'cylinder', 'brass', [0, .08, 0], [radius * .72, .05, radius * .72]);
      cylinders.push({ id, half, node });
    }
  }

  const stickFoot = part('stick.foot', 'Stick root bearing and boom tip clevis', 'Stick',
    'Transfers the boom load into the stick.',
    'A pair of deep titanium cheeks, a long brass pin, two retaining collars and four bolts clamp the stick to the boom tip.', house, [0, .06, 0], 'Titanium cheeks and brass pin');
  for (const side of [-1, 1]) plate(stickFoot, 'dark', [side * .12, 0, 0], [.05, .22, .22]);
  axial(stickFoot, 'brass', [0, 0, 0], .034, .30);
  for (const side of [-1, 1]) add(stickFoot, 'ring', 'titanium', [side * .14, 0, 0], [.052, .052, .052], [0, Math.PI / 2, 0], true);

  const stick = part('stick.beam', 'Stick beam and bucket linkage brackets', 'Stick',
    'Positions the bucket through the 1,010 mm stick link.',
    'A deep box section, twin tipped rails, eight cross braces, a rocker bracket and two copper service lines form one rigid stick.', house, [0, .08, 0], 'Tapered rails and brass linkage bracket');
  plate(stick, 'dark', [0, D.stickLength * .50, 0], [.18, D.stickLength * .84, .15]);
  for (const x of [-.115, .115]) plate(stick, 'shell', [x, D.stickLength * .50, 0], [.028, D.stickLength * .82, .14]);
  for (let i = 0; i <= 8; i++) plate(stick, 'titanium', [0, .05 + i * (D.stickLength - .10) / 8, .10], [.22, .035, .05]);
  for (const y of [0, D.stickLength]) { add(stick, 'ring', 'brass', [0, y, 0], [.062, .062, .062], [0, Math.PI / 2, 0]); axial(stick, 'titanium', [0, y, 0], .028, .27); }
  for (const z of [-.10, .10]) rod(stick, 'copper', [0, .12, z], [0, D.stickLength - .10, z], .006, true);
  plate(stick, 'brass', [0, D.stickLength - .32, .105], [.20, .08, .055]);
  plate(stick, 'dark', [0, .22, -.10], [.12, .08, .035], [0, 0, 0], true);

  const bucket = part('bucket.shell', 'Bucket shell and side plates', 'Bucket',
    'Carries the excavated material through the bucket arc.',
    'A wide open scoop of deep side plates, a thick back, a reinforced floor and two brass pivot eyes pivots on the stick tip without a closed volume.', house, [0, .08, 0], 'Pale scoop shell and dark side plates');
  plate(bucket, 'shell', [0, .21, -.08], [.60, .36, .08], [-.10, 0, 0]);
  for (const x of [-.30, .30]) plate(bucket, 'dark', [x, .20, .10], [.045, .36, .40]);
  plate(bucket, 'titanium', [0, .07, .15], [.58, .055, .38], [.08, 0, 0]);
  for (let i = 0; i < 6; i++) plate(bucket, 'titanium', [-.25 + i * .10, .34, -.13], [.06, .025, .10], [0, 0, 0], true);
  for (const side of [-1, 1]) {
    add(bucket, 'ring', 'brass', [side * .31, .11, .10], [.055, .055, .055], [0, Math.PI / 2, 0]);
    plate(bucket, 'shell', [side * .31, .17, -.18], [.02, .20, .16], [0, 0, 0], true);
  }
  plate(bucket, 'dark', [0, .43, -.04], [.56, .06, .06]);

  const bucketEdge = part('bucket.edge', 'Cutting edge and six bucket teeth', 'Bucket',
    'Shows the replaceable ground-engaging edges.',
    'A wide brass edge strip, six tapered titanium teeth and six dark bolts are bolted to the bucket lip and follow the bucket frame exactly.', bucket, [0, .04, 0], 'Brass edge strip and tapered teeth');
  plate(bucketEdge, 'brass', [0, .46, .225], [.60, .06, .075], [.14, 0, 0]);
  for (let i = 0; i < 6; i++) {
    plate(bucketEdge, 'titanium', [-.25 + i * .10, .52, .275], [.050, .115, .045], [.14, 0, 0]);
    add(bucketEdge, 'bolt', 'dark', [-.25 + i * .10, .47, .25], [.009, .014, .009], [0, 0, 0], true);
  }

  const lever = part('bucket.lever', 'Bucket lever arm', 'Bucket linkage',
    'Connects the bucket shell to the four-bar link.',
    'A rigid 240 mm brass lever with two pin eyes and four collars turns with the bucket and preserves the linkage triangle.', house, [0, .05, 0]);
  for (const x of [-.030, .030]) rod(lever, 'brass', [x, 0, 0], [x, D.leverLength, 0], .014);
  for (const y of [0, D.leverLength]) add(lever, 'ring', 'titanium', [0, y, 0], [.035, .035, .035], [0, Math.PI / 2, 0]);

  const rocker = part('bucket.rocker', 'Four-bar rocker and pivot', 'Bucket linkage',
    'Converts the bucket ram stroke into bucket rotation.',
    'A 320 mm rocker with two pin eyes and four collars turns on the stick bracket and closes the linkage to the fixed-length link.', house, [0, .05, 0], 'Titanium rocker and brass pins');
  for (const x of [-.026, .026]) rod(rocker, 'titanium', [x, 0, 0], [x, D.rockerLength, 0], .012);
  for (const y of [0, D.rockerLength]) add(rocker, 'ring', 'brass', [0, y, 0], [.032, .032, .032], [0, Math.PI / 2, 0]);

  const link = part('bucket.link', 'Constant-length bucket link', 'Bucket linkage',
    'Keeps the rocker and bucket lever exactly 380 mm apart.',
    'A deep titanium plate with two full eyes, four collars and a central stiffening rib carries no telescoping joint.', house, [0, .05, 0], 'Deep titanium plate and brass eyes');
  for (const x of [-.022, .022]) rod(link, 'titanium', [x, 0, 0], [x, D.linkLength, 0], .012);
  for (const y of [0, D.linkLength]) add(link, 'ring', 'brass', [0, y, 0], [.026, .026, .026], [0, Math.PI / 2, 0]);

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.boom && state?.stick && state?.bucket) lastState = state;
    else if (Number.isFinite(state?.phase)) lastState = poseAt(state.phase * TAU, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    house.rotation.y = pose.house.yaw;
    slewPinion.rotation.y = pose.phase * TAU * 8 - pose.house.yaw * 3.2;
    fan.rotation.z = -pose.phase * TAU * 12;
    beacon.rotation.y = pose.phase * TAU * 4;
    antenna.rotation.z = .02 * Math.sin(pose.phase * TAU * 2);
    antenna.rotation.x = .015 * Math.sin(pose.phase * TAU * 3 + .6);
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
    for (const record of wheels) record.node.rotation.x = -pose.tracks.travel * TAU * record.ratio;
    for (const record of rollers) record.node.rotation.x = -pose.tracks.travel * TAU * 2.1;
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
    // Sync local instance matrices with the root at the origin, then apply the
    // ground shuttle once at the root so the belt and model never double-move.
    kit.group.position.set(0, 0, 0);
    kit.group.updateMatrixWorld(true);
    kit.sync(options);
    kit.group.position.z = pose.tracks.distance;
    kit.group.userData.travel = pose.tracks.distance;
  }
  update(lastState);
  const framePoints = [], seen = new Set(), sampleMatrix = new THREE.Matrix4(), samplePoint = new THREE.Vector3();
  for (let i = 0; i <= 16; i++) {
    const state = sample(i / 16 / cycleHz(DEFAULT_INPUTS), DEFAULT_INPUTS);
    update(state, { quality: 'balanced', mode: 'solid', explode: 0 });
    for (const mesh of kit.pickables) for (let j = 0; j < mesh.count; j++) {
      mesh.getMatrixAt(j, sampleMatrix); samplePoint.setFromMatrixPosition(sampleMatrix);
      samplePoint.z += state.tracks.distance;
      const key = `${samplePoint.x.toFixed(4)},${samplePoint.y.toFixed(4)},${samplePoint.z.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key); framePoints.push(samplePoint.clone());
    }
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats, framePoints,
    views: { home: [-5.2, 2.9, 4.2], side: [-6.0, 2.0, 1.0], top: [.1, 6.4, .2], front: [0, 1.9, 6.2], detail: [-4.2, 2.4, 5.0], exploded: [3.9, 2.8, 4.6] },
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
