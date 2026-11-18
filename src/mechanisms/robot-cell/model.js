import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample, STATIONS } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('FABER R6 · six-axis robot cell');
  const nodes = [], rollers = [], fingers = [], labels = [], cylinders = [], cleats = [], spinners = [], positioners = [];
  const add = kit.add, rod = kit.rod, aim = kit.aim;
  let disposed = false, lastState = sample(0);
  const part = (id, name, system, purpose, how, parent, explode = [0, .10, 0], material = 'Machined titanium, dark alloy and teal safety glass') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const plate = (node, material, p, size, euler = [0, 0, 0], detail = false) => add(node, 'box', material, p, size, euler, detail);
  const axial = (node, material, p, radius, length, axis = 'y', detail = false) => {
    const euler = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'cylinder', material, p, [radius, length, radius], euler, detail);
  };
  const local = p => [p[0], p[1] - D.baseY, p[2]];
  const stationWorld = (s, y = .64) => [s.x, y, s.z];

  // ---------------------------------------------------------------- cell
  const pad = part('cell.floor', 'Cell floor pad and robot datum', 'Cell',
    'Provides the fixed floor datum for the cell.',
    'A dark floor mat, a painted teal base outline and a brass datum cross sit below the robot and conveyor.', undefined, [0, 0, 0], 'Dark mat, teal outline and brass datum');
  plate(pad, 'dark', [0, .006, .05], [4.4, .012, 3.7]);
  for (const z of [-1.75, 1.85]) plate(pad, 'teal', [0, .014, z], [4.2, .004, .035], [0, 0, 0], true);
  for (const x of [-2.10, 2.10]) plate(pad, 'teal', [x, .014, .05], [.035, .004, 3.6], [0, 0, 0], true);
  plate(pad, 'brass', [0, .016, 1.25], [1.20, .004, .035], [0, 0, 0], true);
  plate(pad, 'brass', [0, .016, 1.25], [.035, .004, .40], [0, 0, 0], true);

  for (const [i, [x, z]] of [[-1.92, -1.20], [1.92, -1.20], [-1.92, .65], [1.92, .65]].entries()) {
    const anchor = part(`cell.floor-anchor.${i + 1}`, `Cell floor anchor pad ${i + 1} of four`, 'Cell',
      'Anchors the safety fence and robot cell to the building slab.',
      'A dark anchor plate, a brass levelling ring and four titanium bolts sit flush with the cell floor.', undefined, [0, .01, 0], 'Dark anchor plate and brass ring');
    plate(anchor, 'dark', [x, .018, z], [.20, .018, .20]);
    add(anchor, 'ring', 'brass', [x, .03, z], [.055, .055, .055], [Math.PI / 2, 0, 0]);
    for (const dx of [-.065, .065]) for (const dz of [-.065, .065]) add(anchor, 'bolt', 'titanium', [x + dx, .03, z + dz], [.007, .012, .007], [0, 0, 0], true);
  }

  const pedestal = part('robot.pedestal', 'Robot pedestal and anchor plate', 'Robot base',
    'Raises the turntable to the cell working height.',
    'A cast base plate, eight anchor bolts and a tapered dark column carry the turntable above the cell floor.', undefined, [0, .03, 0], 'Cast base plate, anchor bolts and tapered column');
  plate(pedestal, 'dark', [0, .035, 0], [.72, .07, .72]);
  for (const x of [-.26, .26]) for (const z of [-.26, .26]) add(pedestal, 'bolt', 'titanium', [x, .075, z], [.018, .025, .018], [0, 0, 0], true);
  axial(pedestal, 'shell', [0, .32, 0], .26, .50, 'y');
  add(pedestal, 'ring', 'brass', [0, .58, 0], [.27, .27, .27], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 8; i++) add(pedestal, 'bolt', 'brass', [.32 * Math.cos(i * TAU / 8), .02, .32 * Math.sin(i * TAU / 8)], [.012, .018, .012], [0, 0, 0], true);

  const postPositions = [];
  for (const x of [-1.92, 1.92]) for (const z of [-1.46, 0, 1.55]) postPositions.push([x, z]);
  for (const x of [-1.92, 1.92]) postPositions.push([x, -.73]);
  for (const [index, [x, z]] of postPositions.entries()) {
    const post = part(`cage.post.${index + 1}`, `Safety fence post ${index + 1} of eight`, 'Safety cell',
      'Carries the perimeter mesh and the top rail.',
      'A dark square post, a pale base pad, a brass cap and two bolt plates stand on the cell floor.', undefined, [0, .03, 0], 'Dark post, pale pad and brass cap');
    plate(post, 'dark', [x, 1.10, z], [.075, 2.16, .075]);
    plate(post, 'rubber', [x, .012, z], [.22, .024, .22]);
    add(post, 'sphere', 'brass', [x, 2.19, z], [.045, .035, .045]);
    for (const y of [.55, 1.55]) add(post, 'box', 'titanium', [x, y, z], [.10, .035, .10], [0, 0, 0], true);
  }

  const rails = part('cage.rails', 'Perimeter top rail and mid rail', 'Safety cell',
    'Closes the top and middle of the fence.',
    'Two horizontal titanium rails follow the rear and both sides, with brass corner elbows and bolted end plates.', undefined, [0, .03, 0]);
  for (const y of [2.13, 1.05]) {
    rod(rails, 'titanium', [-1.92, y, -1.46], [1.92, y, -1.46], .020);
    for (const x of [-1.92, 1.92]) rod(rails, 'titanium', [x, y, -1.46], [x, y, 1.55], .020);
    for (const [x, z] of [[-1.92, -1.46], [1.92, -1.46], [-1.92, 1.55], [1.92, 1.55]]) add(rails, 'sphere', 'brass', [x, y, z], [.030, .030, .030]);
  }

  for (const [index, panel] of [{ axis: 'x', x: 0, z: -1.46 }, { axis: 'z', x: -1.92, z: 0 }, { axis: 'z', x: 1.92, z: 0 }].entries()) {
    const mesh = part(`cage.mesh.${index + 1}`, `${['Rear', 'Left', 'Right'][index]} safety mesh panel`, 'Safety cell',
      'Guards the cell perimeter without hiding the robot.',
      'A pale frame, eight thin vertical wires and three horizontal wires leave the arm fully readable through the mesh.', undefined, [0, .03, 0], 'Pale frame and steel mesh wires');
    const length = panel.axis === 'x' ? 3.84 : 3.01;
    for (const y of [1.14, 2.08]) plate(mesh, 'shell', [panel.x, y, panel.z], [panel.axis === 'x' ? length : .03, .06, panel.axis === 'x' ? .03 : length]);
    plate(mesh, 'shell', [panel.axis === 'x' ? 0 : panel.x, 1.60, panel.axis === 'x' ? panel.z : 0], [.03, 1.00, .03]);
    for (let i = 0; i < 9; i++) {
      const offset = -.5 * length + length * i / 8;
      const a = panel.axis === 'x' ? [offset, 1.12, panel.z] : [panel.x, 1.12, offset];
      const b = panel.axis === 'x' ? [offset, 2.08, panel.z] : [panel.x, 2.08, offset];
      rod(mesh, 'dark', a, b, .004, true);
    }
    for (let i = 0; i < 4; i++) {
      const y = 1.18 + i * .28;
      const a = panel.axis === 'x' ? [-length / 2, y, panel.z] : [panel.x, y, -length / 2];
      const b = panel.axis === 'x' ? [length / 2, y, panel.z] : [panel.x, y, length / 2];
      rod(mesh, 'dark', a, b, .004, true);
    }
  }

  const gate = part('cage.gate', 'Hinged front gate and latch', 'Safety cell',
    'Allows operator access beside the conveyor.',
    'A pale gate frame, four mesh wires, two brass hinges and a teal latch stand at the front-right corner.', undefined, [0, .03, 0], 'Pale gate frame and brass hinges');
  gate.position.set(1.92, 0, 1.55);
  for (const y of [.55, 1.55]) rod(gate, 'titanium', [0, y, 0], [-.78, y, 0], .014);
  rod(gate, 'titanium', [-.78, .55, 0], [-.78, 1.55, 0], .014);
  for (let i = 0; i < 5; i++) rod(gate, 'dark', [-.15 - i * .15, .60, 0], [-.15 - i * .15, 1.50, 0], .0035, true);
  for (const y of [.58, 1.52]) add(gate, 'ring', 'brass', [0, y, 0], [.025, .025, .025], [0, Math.PI / 2, 0]);
  add(gate, 'box', 'teal', [-.76, .98, .03], [.05, .12, .03]);
  const gateLatch = part('cage.gate-latch', 'Gate latch tongue and key barrel', 'Safety cell',
    'Latches the gate and gives the interlock a visible target.',
    'A brass tongue, a dark key barrel, two retaining pins and a teal indicator ride on the gate leaf.', gate, [0, .02, 0], 'Brass tongue, key barrel and teal indicator');
  gateLatch.position.set(-.70, .98, .06);
  plate(gateLatch, 'brass', [0, 0, 0], [.12, .035, .025]);
  axial(gateLatch, 'dark', [.02, 0, .03], .018, .025, 'z');
  for (const x of [-.04, .04]) add(gateLatch, 'bolt', 'titanium', [x, .02, .025], [.006, .010, .006], [0, 0, 0], true);
  add(gateLatch, 'sphere', 'lens', [.10, .03, .03], [.012, .012, .008], [0, 0, 0], true);

  const interlock = part('cage.interlock', 'Gate safety interlock switch', 'Safety cell',
    'Detects whether the access gate is closed.',
    'A red switch body, a dark actuator head and a teal indicator lamp are mounted beside the gate hinge.', undefined, [0, .03, 0], 'Red switch body and teal indicator');
  plate(interlock, 'rubber', [1.88, 1.02, 1.62], [.07, .12, .07]);
  plate(interlock, 'dark', [1.88, 1.02, 1.665], [.05, .07, .02]);
  add(interlock, 'sphere', 'lens', [1.88, 1.09, 1.67], [.016, .016, .010]);

  const sign = part('cage.sign', 'Cell warning sign', 'Safety cell',
    'Marks the robot working envelope.',
    'A teal warning plate, a pale border and four brass screws are fixed to the rear mesh panel.', undefined, [0, .03, 0], 'Teal warning plate and brass screws');
  plate(sign, 'teal', [0, 1.88, -1.44], [.42, .16, .010]);
  plate(sign, 'shell', [0, 1.88, -1.435], [.38, .12, .004], [0, 0, 0], true);
  for (const x of [-.17, .17]) add(sign, 'bolt', 'brass', [x, 1.88, -1.425], [.006, .010, .006], [Math.PI / 2, 0, 0], true);

  for (const [i, [x, z]] of [[-1.62, 1.02], [-1.62, .28]].entries()) {
    const post = part(`cage.curtain-post.${i + 1}`, `Light-curtain emitter post ${i + 1} of two`, 'Safety cell',
      'Carries the vertical light curtain across the positioner approach.',
      'A dark post, a pale base pad, three teal emitter windows and a brass cap stand inside the fence line.', undefined, [0, .02, 0], 'Dark post, teal windows and brass cap');
    rod(post, 'dark', [x, .04, z], [x, 1.65, z], .026);
    plate(post, 'rubber', [x, .012, z], [.14, .024, .14]);
    for (let k = 0; k < 3; k++) plate(post, 'lens', [x + .028, .58 + k * .34, z], [.012, .22, .070], [0, 0, 0], true);
    add(post, 'sphere', 'brass', [x, 1.67, z], [.035, .035, .035]);
  }
  const curtainBeam = part('cage.light-curtain', 'Light-curtain beam plane', 'Safety cell',
    'Shows the protected plane between the two emitter posts.',
    'Two transparent teal beam strips span the posts and leave the arm readable while defining the safety field.', undefined, [0, .01, 0], 'Transparent teal beam strips');
  for (const z of [.28, 1.02]) rod(curtainBeam, 'lens', [-1.62, .58, z], [-1.62, 1.48, z], .006, true);
  plate(curtainBeam, 'teal', [-1.62, 1.04, .65], [.012, .045, .74], [0, 0, 0], false);
  const curtainHead = part('cage.curtain-head', 'Light-curtain alignment carriage', 'Safety cell',
    'Scans the emitter alignment down the protected plane.',
    'A dark carriage, a teal window, a brass ring and two clamp screws slide on the front emitter post.', undefined, [0, .03, 0], 'Dark carriage, teal window and brass ring');
  curtainHead.position.set(-1.59, 1.18, 1.02);
  plate(curtainHead, 'dark', [0, 0, 0], [.075, .11, .075]);
  plate(curtainHead, 'lens', [.039, 0, 0], [.012, .07, .05]);
  add(curtainHead, 'ring', 'brass', [0, 0, 0], [.045, .045, .045], [0, Math.PI / 2, 0], true);
  for (const y of [-.04, .04]) add(curtainHead, 'bolt', 'titanium', [0, y, .04], [.006, .010, .006], [0, 0, 0], true);

  // ---------------------------------------------------------------- conveyor
  const conveyor = part('conveyor.frame', 'Conveyor frame and two side rails', 'Conveyor',
    'Carries the rollers and the workpiece at the robot working height.',
    'Two dark side rails, six cross ties, a brass drive guard and a rubber belt return form the fixed conveyor frame.', undefined, [0, .03, 0], 'Dark side rails and brass drive guard');
  for (const side of [-1, 1]) plate(conveyor, 'dark', [0, .55, D.conveyorZ + side * .31], [2.68, .10, .06]);
  for (let i = 0; i < 7; i++) plate(conveyor, 'titanium', [-1.20 + i * .40, .55, D.conveyorZ], [.04, .07, .62], [0, 0, 0], true);
  plate(conveyor, 'brass', [-1.24, .42, D.conveyorZ], [.16, .22, .62]);
  plate(conveyor, 'rubber', [0, .47, D.conveyorZ], [2.46, .025, .56]);

  for (let i = 0; i < 12; i++) {
    const roller = part(`conveyor.roller.${String(i + 1).padStart(2, '0')}`, `Conveyor roller ${String(i + 1).padStart(2, '0')} of twelve`, 'Conveyor',
      'Supports and drives the upper belt run.',
      'A dark roller, a brass axle and two pale end discs turn between the side rails on fixed bearings.', undefined, [0, .03, 0], 'Dark roller, brass axle and pale end discs');
    const x = -1.10 + i * .20;
    roller.position.set(x, D.conveyorY - .02, D.conveyorZ);
    axial(roller, 'dark', [0, 0, 0], .075, .58, 'z');
    axial(roller, 'brass', [0, 0, 0], .018, .68, 'z');
    for (const z of [-.30, .30]) add(roller, 'cylinder', 'shell', [0, 0, z], [.080, .012, .080], [Math.PI / 2, 0, 0]);
    add(roller, 'ring', 'brass', [0, 0, .305], [.045, .045, .045], [0, 0, 0], true);
    add(roller, 'sphere', 'brass', [0, 0, .318], [.016, .016, .016], [0, 0, 0], true);
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4;
      rod(roller, 'titanium', [0, 0, -.29], [.06 * Math.cos(a), .06 * Math.sin(a), -.29], .004);
      rod(roller, 'titanium', [0, 0, .29], [.06 * Math.cos(a), .06 * Math.sin(a), .29], .004);
    }
    rollers.push({ node: roller });
  }

  const belt = part('conveyor.belt', 'Upper belt run and cleat anchors', 'Conveyor',
    'Moves the workpiece across the cell.',
    'A dark rubber belt and two pale edge strips sit above the rollers; the brass cleats are separate travelling parts.', undefined, [0, .03, 0], 'Dark rubber belt and pale edge strips');
  plate(belt, 'rubber', [0, D.conveyorY + .045, D.conveyorZ], [2.50, .018, .56]);
  for (const z of [-.285, .285]) rod(belt, 'shell', [-1.24, D.conveyorY + .052, D.conveyorZ + z], [1.24, D.conveyorY + .052, D.conveyorZ + z], .008, true);

  for (let i = 0; i < 20; i++) {
    const cleat = part(`conveyor.cleat.${String(i + 1).padStart(2, '0')}`, `Travelling belt cleat ${String(i + 1).padStart(2, '0')} of twenty`, 'Conveyor',
      'Carries the workpiece along the top belt run and returns underneath.',
      'A brass cleat strip, a dark rubber base and two titanium pins loop with the belt and disappear around the end rollers.', undefined, [0, .02, 0], 'Brass cleat, rubber base and titanium pins');
    cleat.position.set(-1.15 + 2.3 * i / 20, D.conveyorY + .055, D.conveyorZ);
    plate(cleat, 'brass', [0, 0, 0], [.032, .012, .54]);
    plate(cleat, 'rubber', [0, -.012, 0], [.040, .012, .56]);
    for (const z of [-.24, .24]) add(cleat, 'bolt', 'titanium', [0, .006, z], [.006, .012, .006], [0, 0, 0], true);
    cleats.push({ node: cleat, offset: i / 20 });
  }

  for (const [index, x] of [-1.02, 1.02].entries()) {
    const leg = part(`conveyor.leg.${index + 1}`, `Conveyor leg ${index + 1} of two`, 'Conveyor',
      'Carries the conveyor frame on the cell floor.',
      'A dark square leg, a brass foot plate and two diagonal braces reach the side rails.', undefined, [0, .03, 0], 'Dark square leg and brass foot');
    plate(leg, 'dark', [x, .30, D.conveyorZ], [.08, .60, .08]);
    plate(leg, 'brass', [x, .025, D.conveyorZ], [.20, .03, .20]);
    for (const side of [-1, 1]) rod(leg, 'titanium', [x, .28, D.conveyorZ + side * .04], [x, .54, D.conveyorZ + side * .30], .010);
    for (const dz of [-.16, .16]) add(leg, 'bolt', 'titanium', [x, .06, D.conveyorZ + dz], [.008, .012, .008], [0, 0, 0], true);
  }

  for (const [index, [x, z]] of [[-1.00, D.conveyorZ - .17], [1.00, D.conveyorZ - .17], [-1.00, D.conveyorZ + .17], [1.00, D.conveyorZ + .17]].entries()) {
    const foot = part(`conveyor.foot.${index + 1}`, `Conveyor levelling foot ${index + 1} of four`, 'Conveyor',
      'Levels the conveyor frame on the cell floor.',
      'A rubber pad, a brass jack screw and a dark lock nut sit under one conveyor leg corner.', undefined, [0, .02, 0], 'Rubber pad, brass jack and dark nut');
    add(foot, 'cylinder', 'rubber', [x, .012, z], [.05, .024, .05]);
    add(foot, 'cylinder', 'brass', [x, .035, z], [.020, .04, .020]);
    add(foot, 'cylinder', 'dark', [x, .06, z], [.030, .015, .030]);
  }

  const motor = part('conveyor.motor', 'Conveyor gearmotor and fan guard', 'Conveyor',
    'Drives the roller chain through a visible gearbox.',
    'A dark gearmotor, a copper field band, a pale fan guard and a brass output hub sit at the conveyor head end.', undefined, [0, .03, 0], 'Dark gearmotor and copper field band');
  axial(motor, 'dark', [-1.36, .42, D.conveyorZ + .36], .10, .20, 'x');
  add(motor, 'ring', 'copper', [-1.36, .42, D.conveyorZ + .36], [.102, .102, .102], [0, Math.PI / 2, 0]);
  add(motor, 'cylinder', 'shell', [-1.47, .42, D.conveyorZ + .36], [.075, .025, .075], [0, 0, Math.PI / 2]);
  add(motor, 'cylinder', 'brass', [-1.26, .42, D.conveyorZ + .36], [.030, .045, .030], [0, 0, Math.PI / 2]);
  const fan = part('conveyor.fan', 'Gearmotor cooling fan', 'Conveyor',
    'Shows the cooling fan on the gearmotor.',
    'Six pale blades and a brass hub turn inside a dark guard on the motor end plate.', undefined, [0, .03, 0], 'Pale blades and brass hub');
  fan.position.set(-1.48, .42, D.conveyorZ + .36);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    plate(fan, 'titanium', [0, .045 * Math.cos(a), .045 * Math.sin(a)], [.010, .075, .025], [a, 0, 0]);
  }
  add(fan, 'cylinder', 'brass', [0, 0, 0], [.018, .018, .018], [0, 0, Math.PI / 2]);
  labels.push({ node: fan, kind: 'fan' });

  const sprocket = part('conveyor.drive-sprocket', 'Conveyor drive sprocket and chain', 'Conveyor',
    'Transfers gearmotor torque into the roller chain.',
    'An eighteen-tooth brass sprocket, a dark hub, four titanium spokes and a chain guard turn at the head end.', undefined, [0, .03, 0], 'Brass sprocket and dark hub');
  sprocket.position.set(-1.24, .42, D.conveyorZ + .36);
  sprocket.rotation.z = Math.PI / 2;
  kit.gear(sprocket, .095, 18, .028, 'brass');
  for (let i = 0; i < 4; i++) rod(sprocket, 'titanium', [0, 0, 0], [.070 * Math.cos(i * TAU / 4), .070 * Math.sin(i * TAU / 4), 0], .004, true);
  const sprocketBase = sprocket.quaternion.clone(); spinners.push({ node: sprocket, base: sprocketBase, kind: 'sprocket' });

  for (const [index, x] of [-1.16, 1.16].entries()) {
    const idler = part(`conveyor.idler.${index + 1}`, `Conveyor belt idler ${index + 1} of two`, 'Conveyor',
      'Turns the return run of the belt at the conveyor end.',
      'A rubber rim, a brass axle, two pale discs and a dark bearing block turn under the belt return.', undefined, [0, .03, 0], 'Rubber rim, brass axle and pale discs');
    idler.position.set(x, D.conveyorY - .09, D.conveyorZ);
    add(idler, 'cylinder', 'rubber', [0, 0, 0], [.070, .55, .070], [Math.PI / 2, 0, 0]);
    axial(idler, 'brass', [0, 0, 0], .018, .62, 'z');
    for (const z of [-.275, .275]) add(idler, 'cylinder', 'shell', [0, 0, z], [.066, .010, .066], [Math.PI / 2, 0, 0], true);
    for (const z of [-.26, .26]) add(idler, 'ring', 'brass', [0, 0, z], [.030, .030, .030], [0, 0, 0], true);
    rollers.push({ node: idler });
  }

  const stop = part('conveyor.stop', 'Workpiece stop and presence sensor', 'Conveyor',
    'Positions the workpiece at the pick station.',
    'A pale stop plate, two dark buffers and a teal presence sensor face the arriving part.', undefined, [0, .03, 0], 'Pale stop plate and teal sensor');
  plate(stop, 'shell', [.90, .78, D.conveyorZ], [.03, .22, .50]);
  for (const z of [-.18, .18]) add(stop, 'cylinder', 'rubber', [.89, .70, D.conveyorZ + z], [.025, .035, .025], [Math.PI / 2, 0, 0]);
  add(stop, 'box', 'teal', [.88, .88, D.conveyorZ], [.02, .06, .10]);
  for (const side of [-1, 1]) rod(stop, 'dark', [.90, .64, D.conveyorZ + side * .22], [.84, .54, D.conveyorZ + side * .30], .008);
  const stopBracket = part('conveyor.stop-bracket', 'Stop bracket and shock absorber', 'Conveyor',
    'Holds the stop against the belt reaction without deflecting.',
    'A dark bracket, a copper shock absorber, a brass clevis and four bolts brace the stop to the side rail.', undefined, [0, .03, 0], 'Dark bracket and copper shock absorber');
  plate(stopBracket, 'dark', [.90, .62, D.conveyorZ + .31], [.12, .26, .055]);
  axial(stopBracket, 'copper', [.90, .70, D.conveyorZ + .34], .022, .18, 'y');
  add(stopBracket, 'ring', 'brass', [.90, .79, D.conveyorZ + .34], [.030, .030, .030], [Math.PI / 2, 0, 0], true);
  for (const y of [.56, .68]) add(stopBracket, 'bolt', 'titanium', [.90, y, D.conveyorZ + .28], [.008, .012, .008], [0, 0, 0], true);

  const workpiece = part('conveyor.workpiece', 'Inspection workpiece and fixture', 'Conveyor',
    'Provides the part that the robot picks, carries and places.',
    'A pale machined block, a brass core, four bolt holes and a dark fixture plate travel with the gripper and the belt.', undefined, [0, .04, 0], 'Pale machined block and brass core');
  plate(workpiece, 'shell', [0, 0, 0], [.09, .14, .09]);
  plate(workpiece, 'brass', [0, -.05, 0], [.11, .025, .11]);
  for (const x of [-.035, .035]) for (const z of [-.035, .035]) add(workpiece, 'ring', 'dark', [x, .075, z], [.014, .014, .014], [Math.PI / 2, 0, 0], true);
  for (const x of [-.06, .06]) plate(workpiece, 'titanium', [x, -.02, 0], [.015, .08, .11]);
  plate(workpiece, 'teal', [0, .072, 0], [.04, .006, .04], [0, 0, 0], true);
  for (const x of [-.045, .045]) for (const z of [-.045, .045]) add(workpiece, 'sphere', 'brass', [x, .07, z], [.009, .009, .009], [0, 0, 0], true);

  const guards = part('conveyor.guards', 'Belt edge guards', 'Conveyor',
    'Keeps hands and parts away from the roller nip.',
    'Two pale angle guards with brass fasteners run above both belt edges and leave the part readable.', undefined, [0, .03, 0], 'Pale edge guards and brass fasteners');
  for (const side of [-1, 1]) {
    plate(guards, 'shell', [0, .78, D.conveyorZ + side * .40], [2.46, .10, .03], [0, 0, side * .25]);
    for (let i = 0; i < 5; i++) add(guards, 'bolt', 'brass', [-1.0 + i * .5, .78, D.conveyorZ + side * .40], [.007, .012, .007], [0, 0, 0], true);
  }

  const bearings = part('conveyor.bearings', 'Roller bearing blocks and take-up slides', 'Conveyor',
    'Locate the roller shafts in the conveyor side rails.',
    'Four dark bearing blocks, two brass bushings and two slotted take-up slides sit at the head and tail of the frame.', undefined, [0, .03, 0], 'Dark bearing blocks and brass bushings');
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    plate(bearings, 'dark', [end * 1.27, .47, D.conveyorZ + side * .31], [.10, .12, .10]);
    add(bearings, 'ring', 'brass', [end * 1.27, .47, D.conveyorZ + side * .37], [.045, .045, .045], [0, Math.PI / 2, 0]);
    plate(bearings, 'titanium', [end * 1.27, .38, D.conveyorZ + side * .31], [.08, .08, .02], [0, 0, 0], true);
  }
  const tensioner = part('conveyor.tensioner', 'Tail tensioner and adjuster screw', 'Conveyor',
    'Sets the belt take-up at the tail roller.',
    'A brass adjuster screw, a dark slide block and a pale scale plate sit behind the tail bearing on both sides.', undefined, [0, .03, 0], 'Brass adjuster and pale scale');
  for (const side of [-1, 1]) {
    rod(tensioner, 'brass', [-1.33, .47, D.conveyorZ + side * .31], [-1.48, .47, D.conveyorZ + side * .31], .012);
    plate(tensioner, 'dark', [-1.35, .47, D.conveyorZ + side * .31], [.06, .08, .09]);
    plate(tensioner, 'shell', [-1.40, .56, D.conveyorZ + side * .31], [.12, .025, .03], [0, 0, 0], true);
  }
  const chute = part('conveyor.discharge-chute', 'Discharge chute and reject bin', 'Conveyor',
    'Catches rejected parts beyond the stop.',
    'A pale chute, two dark side walls, a rubber lip and four bolts guide rejected parts into a small bin.', undefined, [0, .02, 0], 'Pale chute and rubber lip');
  plate(chute, 'shell', [1.18, .40, D.conveyorZ], [.24, .025, .52], [0, 0, -.22]);
  for (const z of [-.28, .28]) plate(chute, 'dark', [1.18, .42, D.conveyorZ + z], [.26, .16, .03], [0, 0, 0], true);
  plate(chute, 'rubber', [1.31, .37, D.conveyorZ], [.03, .10, .44]);
  for (const z of [-.20, .20]) add(chute, 'bolt', 'titanium', [1.27, .39, D.conveyorZ + z], [.007, .012, .007], [0, 0, 0], true);

  // ---------------------------------------------------------------- positioners and rack
  function makePositioner(id, name, point, moving, aux) {
    const base = part(`positioner.${id}.base`, `${name} pedestal and floor plate`, 'Positioner',
      `Carries the ${name.toLowerCase()} at the transfer height.`,
      'A dark pedestal, a brass bearing ring, four anchor bolts and two diagonal braces stand on the cell floor.', undefined, [0, .03, 0], 'Dark pedestal and brass bearing ring');
    for (const [x, z] of [[point.x, point.z]]) {
      axial(base, 'dark', [x + (aux ? .0 : 0), .30, z], .13, .60, 'y');
      axial(base, 'brass', [x, .58, z], .12, .05, 'y');
      plate(base, 'dark', [x, .02, z], [.38, .04, .38]);
      for (const dx of [-.13, .13]) for (const dz of [-.13, .13]) add(base, 'bolt', 'titanium', [x + dx, .045, z + dz], [.010, .016, .010], [0, 0, 0], true);
      for (const side of [-1, 1]) rod(base, 'titanium', [x + side * .12, .12, z], [x + side * .22, .35, z], .009, true);
    }
    const table = part(`positioner.${id}.table`, `${name} rotary table`, 'Positioner',
      'Indexes the workpiece between the pick and place poses.',
      'A pale machined table, a brass index ring, four clamp blocks and a central locating spigot turn on the pedestal.', undefined, [0, .03, 0], 'Pale table, brass index ring and clamp blocks');
    table.position.set(point.x, .63, point.z);
    add(table, 'cylinder', 'shell', [0, 0, 0], [.21, .035, .21]);
    add(table, 'ring', 'brass', [0, .02, 0], [.19, .19, .19], [Math.PI / 2, 0, 0], true);
    add(table, 'ring', 'titanium', [0, .02, 0], [.115, .115, .115], [Math.PI / 2, 0, 0], true);
    for (let i = 0; i < 4; i++) add(table, 'bolt', 'brass', [.10 * Math.cos(i * TAU / 4), .03, .10 * Math.sin(i * TAU / 4)], [.006, .010, .006], [0, 0, 0], true);
    for (let i = 0; i < 4; i++) {
      const a = i * TAU / 4 + .2;
      plate(table, 'dark', [.14 * Math.cos(a), .022, .14 * Math.sin(a)], [.075, .025, .055], [0, -a, 0], true);
    }
    axial(table, 'brass', [0, .035, 0], .028, .035, 'y');
    const fixture = part(`positioner.${id}.fixture`, `${name} fixture nest and locating pins`, 'Positioner',
      'Holds the workpiece square to the robot tool axis.',
      'A pale V-block, four brass pins, a dark wear plate and a teal presence pad sit on the rotary table.', table, [0, .03, 0], 'Pale V-block, brass pins and teal pad');
    plate(fixture, 'shell', [0, .025, 0], [.16, .015, .14]);
    for (const x of [-.05, .05]) add(fixture, 'cylinder', 'brass', [x, .055, 0], [.010, .055, .010]);
    plate(fixture, 'dark', [0, .034, .04], [.12, .006, .04], [0, 0, 0], true);
    plate(fixture, 'teal', [0, .040, -.04], [.04, .006, .025], [0, 0, 0], true);
    positioners.push({ table, baseAngle: 0 });
    if (aux) {
      const dummy = part('positioner.aux.dummy', 'Auxiliary positioner sample part', 'Positioner',
        'Shows a second part waiting on the idle positioner.',
        'A pale sample block, a brass base pad, a teal index dot and four dark bolt holes ride on the auxiliary table.', table, [0, .02, 0], 'Pale sample block and brass base pad');
      plate(dummy, 'shell', [0, .0875, 0], [.11, .12, .11]);
      plate(dummy, 'brass', [0, .0225, 0], [.13, .015, .13]);
      for (const x of [-.035, .035]) for (const z of [-.035, .035]) add(dummy, 'ring', 'dark', [x, .152, z], [.012, .012, .012], [Math.PI / 2, 0, 0], true);
      plate(dummy, 'teal', [0, .15, 0], [.035, .005, .035], [0, 0, 0], true);
    }
    return { base, table, fixture };
  }
  makePositioner('main', 'Main positioner', STATIONS.A, true, false);
  makePositioner('aux', 'Auxiliary positioner', { x: 1.05, z: -.62 }, true, true);
  const mainStop = part('positioner.main.stop', 'Positioner over-travel stop', 'Positioner',
    'Limits the rotary index without loading the table bearing.',
    'A dark adjustable stop, a rubber bumper, a brass lock nut and two bolts sit beside the main table rim.', undefined, [0, .02, 0], 'Dark stop, rubber bumper and brass lock');
  plate(mainStop, 'dark', [STATIONS.A.x + .26, .66, STATIONS.A.z - .04], [.07, .10, .07]);
  add(mainStop, 'cylinder', 'rubber', [STATIONS.A.x + .22, .66, STATIONS.A.z - .04], [.022, .05, .022], [0, 0, Math.PI / 2]);
  add(mainStop, 'cylinder', 'brass', [STATIONS.A.x + .29, .66, STATIONS.A.z - .04], [.018, .04, .018], [0, 0, Math.PI / 2], true);
  for (const y of [.61, .71]) add(mainStop, 'bolt', 'titanium', [STATIONS.A.x + .26, y, STATIONS.A.z - .08], [.006, .012, .006], [0, 0, 0], true);

  const rackFrame = part('rack.frame', 'Tool rack frame and uprights', 'Tool rack',
    'Stores the spare tools within the robot envelope.',
    'Four dark uprights, two pale top rails, a brass cross brace and eight bolted feet form the free-standing rack.', undefined, [0, .03, 0], 'Dark uprights and pale rails');
  for (const x of [-1.62, -1.28]) for (const z of [-.70, -.32]) rod(rackFrame, 'dark', [x, .04, z], [x, 1.42, z], .020);
  for (const y of [1.38, .78]) rod(rackFrame, 'shell', [-1.64, y, -.70], [-1.26, y, -.70], .016);
  for (const z of [-.70, -.32]) rod(rackFrame, 'brass', [-1.45, .92, z], [-1.45, 1.42, z], .012, true);
  for (const x of [-1.64, -1.26]) for (const z of [-.70, -.32]) add(rackFrame, 'bolt', 'titanium', [x, .04, z], [.008, .012, .008], [0, 0, 0], true);
  const rackShelf = part('rack.shelf', 'Tool rack shelf and drip tray', 'Tool rack',
    'Holds the spare gripper and spindle tools.',
    'A pale shelf, a dark drip tray, a brass front rail and three support brackets span the rack uprights.', undefined, [0, .02, 0], 'Pale shelf, dark tray and brass rail');
  plate(rackShelf, 'shell', [-1.45, .78, -.51], [.40, .025, .42]);
  plate(rackShelf, 'dark', [-1.45, .755, -.51], [.36, .012, .38], [0, 0, 0], true);
  rod(rackShelf, 'brass', [-1.64, .84, -.30], [-1.26, .84, -.30], .010);
  for (const x of [-1.60, -1.45, -1.30]) rod(rackShelf, 'titanium', [x, .72, -.68], [x, .76, -.40], .006, true);
  for (let i = 0; i < 3; i++) {
    const pocket = part(`rack.pocket.${i + 1}`, `Tool rack pocket ${i + 1} of three`, 'Tool rack',
      'Locates one spare tool shank on the shelf.',
      'A dark socket, a brass guide bush and two countersunk bolts hold the tool upright.', undefined, [0, .02, 0], 'Dark socket and brass guide bush');
    const x = -1.58 + i * .13;
    add(pocket, 'cylinder', 'dark', [x, .82, -.52], [.045, .045, .045]);
    add(pocket, 'ring', 'brass', [x, .845, -.52], [.045, .045, .045], [Math.PI / 2, 0, 0], true);
    for (const z of [-.56, -.48]) add(pocket, 'bolt', 'titanium', [x, .80, z], [.006, .010, .006], [0, 0, 0], true);
  }
  const rackSpindle = part('rack.spindle', 'Spare spindle tool and collet', 'Tool rack',
    'Shows the alternate rotating tool stored on the rack.',
    'A dark spindle body, a brass collet, six titanium flutes and a teal speed ring rotate in the middle pocket.', undefined, [0, .03, 0], 'Dark spindle, brass collet and titanium flutes');
  rackSpindle.position.set(-1.45, .93, -.52);
  axial(rackSpindle, 'dark', [0, 0, 0], .030, .15, 'y');
  add(rackSpindle, 'cylinder', 'brass', [0, .09, 0], [.026, .04, .026]);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    plate(rackSpindle, 'titanium', [.034 * Math.cos(a), -.03, .034 * Math.sin(a)], [.012, .11, .012]);
  }
  add(rackSpindle, 'ring', 'lens', [0, .075, 0], [.040, .040, .040], [Math.PI / 2, 0, 0], true);
  add(rackSpindle, 'bolt', 'brass', [0, .12, 0], [.006, .012, .006], [0, 0, 0], true);
  spinners.push({ node: rackSpindle, base: rackSpindle.quaternion.clone(), kind: 'spindle' });
  const rackCollar = part('rack.spindle-collar', 'Spindle tool collet nut', 'Tool rack',
    'Clamps the spare spindle into its rack pocket.',
    'A brass collet nut, four dark detents and a pale index line turn with the stored spindle.', rackSpindle, [0, .02, 0], 'Brass collet nut and dark detents');
  add(rackCollar, 'ring', 'brass', [0, .05, 0], [.042, .042, .042], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) add(rackCollar, 'bolt', 'dark', [.035 * Math.cos(i * TAU / 4), .05, .035 * Math.sin(i * TAU / 4)], [.006, .008, .006], [0, 0, 0], true);
  plate(rackCollar, 'shell', [.042, .05, 0], [.012, .012, .03], [0, 0, 0], true);
  const rackTool = part('rack.tool', 'Parked parallel gripper tool', 'Tool rack',
    'Shows the second tool that can be exchanged with the spindle.',
    'A dark gripper body, two pale fingers, a brass tool ring and a teal sensor sit on the rack shelf.', undefined, [0, .03, 0], 'Dark gripper body and pale fingers');
  plate(rackTool, 'dark', [-1.61, .91, -.46], [.10, .12, .08]);
  for (const x of [-1.65, -1.57]) plate(rackTool, 'shell', [x, .99, -.46], [.028, .08, .06]);
  add(rackTool, 'ring', 'brass', [-1.61, .86, -.46], [.055, .055, .055], [Math.PI / 2, 0, 0], true);
  plate(rackTool, 'teal', [-1.61, .96, -.50], [.04, .02, .012], [0, 0, 0], true);
  const rackLabel = part('rack.label', 'Tool rack identification plate', 'Tool rack',
    'Identifies the stored tool positions.',
    'A teal plate, a pale border and three brass studs are fixed to the rack top rail.', undefined, [0, .02, 0], 'Teal plate and brass studs');
  plate(rackLabel, 'teal', [-1.45, 1.48, -.31], [.26, .06, .012]);
  plate(rackLabel, 'shell', [-1.45, 1.48, -.303], [.22, .04, .004], [0, 0, 0], true);
  for (let i = 0; i < 3; i++) add(rackLabel, 'bolt', 'brass', [-1.55 + i * .10, 1.48, -.294], [.005, .008, .005], [0, 0, 0], true);
  const rackCable = part('rack.cable', 'Rack cable hook and service loop', 'Tool rack',
    'Keeps the tool cables clear of the exchange path.',
    'A copper service loop, two dark hooks and a brass clamp hang from the rack frame.', undefined, [0, .02, 0], 'Copper loop and brass clamp');
  for (let i = 0; i < 3; i++) rod(rackCable, 'copper', [-1.68, 1.34 - i * .04, -.28], [-1.55, 1.15 - i * .04, -.18], .004, true);
  for (const z of [-.70, -.32]) add(rackCable, 'ring', 'brass', [-1.62, 1.34, z], [.015, .015, .015], [0, Math.PI / 2, 0], false);

  // ---------------------------------------------------------------- controller
  const cabinet = part('cell.cabinet', 'Robot controller cabinet', 'Controller',
    'Houses the servo drives and safety interface.',
    'A pale cabinet, two dark doors, four brass feet and a louvred side panel stand outside the fence.', undefined, [0, .03, 0], 'Pale cabinet and dark doors');
  plate(cabinet, 'shell', [-2.46, .70, .70], [.46, 1.40, .55]);
  for (const z of [.52, .88]) plate(cabinet, 'dark', [-2.46, .72, z], [.40, 1.20, .012], [0, 0, 0], true);
  for (const x of [-2.64, -2.28]) for (const z of [.46, .94]) add(cabinet, 'cylinder', 'brass', [x, .025, z], [.025, .05, .025]);
  for (let i = 0; i < 6; i++) plate(cabinet, 'dark', [-2.68, .30 + i * .06, .70], [.012, .035, .30], [0, 0, 0], true);

  const screen = part('cell.screen', 'Teach pendant and status display', 'Controller',
    'Shows the robot state and selected programme.',
    'A dark bezel, a teal display and six brass function keys are mounted on the controller front; screen content is illustrative.', undefined, [0, .03, 0], 'Dark bezel and teal display');
  plate(screen, 'dark', [-2.40, 1.05, .98], [.30, .22, .025], [0, 0, 0]);
  plate(screen, 'lens', [-2.40, 1.06, .995], [.24, .16, .008], [0, 0, 0]);
  for (let i = 0; i < 6; i++) add(screen, 'bolt', 'brass', [-2.52 + i * .048, .88, .995], [.010, .012, .010], [Math.PI / 2, 0, 0], true);

  const estop = part('cell.estop', 'Emergency stop and key switch', 'Controller',
    'Provides the visible safety stop interface.',
    'A red mushroom button, a brass guard ring and a dark key switch sit on the controller door.', undefined, [0, .03, 0], 'Red mushroom and brass guard ring');
  add(estop, 'cylinder', 'rubber', [-2.40, 1.27, .99], [.045, .045, .045], [Math.PI / 2, 0, 0]);
  add(estop, 'ring', 'brass', [-2.40, 1.27, .98], [.055, .055, .055], [0, 0, 0]);
  add(estop, 'cylinder', 'dark', [-2.25, 1.27, .99], [.022, .02, .022], [Math.PI / 2, 0, 0]);

  const beacon = part('cell.beacon', 'Stack light and buzzer', 'Controller',
    'Shows the cell status above the controller.',
    'A dark base, three teal and brass light segments and a pale buzzer cap sit on the cabinet top.', undefined, [0, .03, 0], 'Dark base and brass light segments');
  beacon.position.set(-2.46, 1.42, .70);
  for (let i = 0; i < 3; i++) {
    add(beacon, 'cylinder', i === 0 ? 'lens' : 'brass', [0, .045 + i * .07, 0], [.045 - i * .004, .06, .045 - i * .004]);
    add(beacon, 'ring', 'dark', [0, .045 + i * .07, 0], [.048, .048, .048], [Math.PI / 2, 0, 0], true);
  }
  add(beacon, 'sphere', 'shell', [0, .24, 0], [.045, .035, .045]);
  add(beacon, 'cylinder', 'dark', [0, .01, 0], [.055, .025, .055]);
  labels.push({ node: beacon, kind: 'beacon' });

  const scanner = part('cell.scanner', 'Safety laser scanner', 'Safety cell',
    'Watches the floor in front of the robot.',
    'A dark scanner head, a teal window and a brass mounting block sit on a short post at the cell corner.', undefined, [0, .03, 0], 'Dark scanner head and teal window');
  rod(scanner, 'titanium', [-1.85, .02, 1.48], [-1.85, .55, 1.48], .020);
  plate(scanner, 'dark', [-1.85, .60, 1.48], [.16, .18, .14]);
  plate(scanner, 'lens', [-1.85, .62, 1.56], [.12, .10, .015]);
  add(scanner, 'box', 'brass', [-1.85, .51, 1.48], [.08, .04, .08]);
  const scannerMirror = part('cell.scanner-mirror', 'Safety scanner rotating mirror', 'Safety cell',
    'Sweeps the laser curtain across the cell floor.',
    'A teal mirrored drum, a brass spindle and four dark vanes rotate in front of the scanner window.', undefined, [0, .02, 0], 'Teal mirrored drum and brass spindle');
  scannerMirror.position.set(-1.85, .62, 1.575);
  axial(scannerMirror, 'lens', [0, 0, 0], .034, .025, 'z');
  axial(scannerMirror, 'brass', [0, 0, .02], .008, .03, 'z');
  for (let i = 0; i < 4; i++) plate(scannerMirror, 'dark', [.046 * Math.cos(i * TAU / 4), .046 * Math.sin(i * TAU / 4), .01], [.014, .030, .01], [0, 0, -i * TAU / 4], true);
  spinners.push({ node: scannerMirror, base: scannerMirror.quaternion.clone(), kind: 'scanner' });

  const tray = part('cell.cable-tray', 'Controller cable tray and conduit', 'Controller',
    'Routes power and encoder cables from the cabinet.',
    'A dark tray, three copper conduits and four brass clips run from the cabinet toward the robot base.', undefined, [0, .03, 0], 'Dark tray and copper conduits');
  rod(tray, 'dark', [-2.40, .18, .48], [-.62, .18, .48], .035);
  for (const z of [.42, .48, .54]) rod(tray, 'copper', [-2.40, .22, z], [-.62, .22, z], .006, true);
  for (let i = 0; i < 4; i++) add(tray, 'ring', 'brass', [-2.10 + i * .50, .22, .48], [.025, .025, .025], [Math.PI / 2, 0, 0], true);

  const cabinetDoor = part('cell.cabinet-door', 'Controller door interlock and handle', 'Controller',
    'Provides the service access door on the controller.',
    'A pale door skin, a brass rotary handle and a dark interlock tongue sit over the controller front.', undefined, [0, .03, 0], 'Pale door skin and brass handle');
  plate(cabinetDoor, 'shell', [-2.455, .74, .982], [.36, .82, .012]);
  add(cabinetDoor, 'cylinder', 'brass', [-2.34, .74, .995], [.025, .035, .025], [Math.PI / 2, 0, 0]);
  plate(cabinetDoor, 'dark', [-2.55, 1.04, .985], [.035, .10, .012], [0, 0, 0], true);
  const filter = part('cell.cabinet-filter', 'Controller ventilation filter', 'Controller',
    'Shows the cooling-air intake on the cabinet side.',
    'A dark frame, eight pale louvres and a brass retaining screw cover the lower cabinet side.', undefined, [0, .03, 0], 'Dark frame and pale louvres');
  plate(filter, 'dark', [-2.695, .46, .70], [.012, .44, .34]);
  for (let i = 0; i < 8; i++) plate(filter, 'shell', [-2.705, .30 + i * .045, .70], [.006, .020, .28], [0, 0, 0], true);
  add(filter, 'bolt', 'brass', [-2.705, .46, .88], [.006, .012, .006], [0, 0, Math.PI / 2], true);

  const plaque = part('cell.nameplate', 'FABER R6 cell identification plate', 'Cell',
    'Identifies the robot cell on the fence.',
    'A teal plate, three brass studs and two titanium screws are fixed to the rear safety rail.', undefined, [0, .03, 0]);
  plate(plaque, 'teal', [0, 1.62, -1.44], [.34, .08, .012]);
  for (let i = 0; i < 3; i++) add(plaque, 'bolt', 'brass', [-.10 + i * .10, 1.62, -1.425], [.008, .012, .008], [Math.PI / 2, 0, 0], true);

  // ---------------------------------------------------------------- robot
  const yaw = new THREE.Group(); yaw.name = 'robot-yaw'; yaw.position.y = D.baseY; kit.assemblies.add(yaw);
  const turntable = part('robot.turntable', 'Axis 1 turntable and ring gear', 'Robot base',
    'Rotates the complete arm about the vertical axis.',
    'A dark turntable, a 24-tooth brass ring gear and six bearing blocks turn above the fixed pedestal.', yaw, [0, .03, 0], 'Dark turntable and brass ring gear');
  axial(turntable, 'titanium', [0, .03, 0], .36, .10, 'y');
  kit.gear(turntable, .30, 24, .035, 'brass');
  for (let i = 0; i < 6; i++) add(turntable, 'bolt', 'titanium', [.31 * Math.cos(i * TAU / 6), .07, .31 * Math.sin(i * TAU / 6)], [.012, .018, .012], [0, 0, 0], true);

  const baseServo = part('robot.base-servo', 'Axis 1 servo motor and brake', 'Robot base',
    'Drives the turntable through the ring gear.',
    'A dark servo body, a copper field band, a pale brake cover, a brass pinion and four bolts sit on the turntable.', yaw, [0, .04, 0], 'Dark servo and copper field band');
  baseServo.position.set(-.26, .09, -.18);
  axial(baseServo, 'dark', [0, 0, 0], .065, .18, 'y');
  add(baseServo, 'ring', 'copper', [0, 0, 0], [.067, .067, .067], [Math.PI / 2, 0, 0], true);
  add(baseServo, 'cylinder', 'shell', [0, .10, 0], [.050, .018, .050]);
  axial(baseServo, 'brass', [.06, -.01, 0], .022, .05, 'y');
  for (let i = 0; i < 4; i++) add(baseServo, 'bolt', 'titanium', [.055 * Math.cos(i * TAU / 4), .11, .055 * Math.sin(i * TAU / 4)], [.006, .012, .006], [0, 0, 0], true);
  const basePinion = part('robot.base-pinion', 'Axis 1 drive pinion', 'Robot base',
    'Meshes with the turntable ring gear.',
    'A twelve-tooth brass pinion, a dark hub and two titanium retaining rings spin beside the servo.', yaw, [0, .03, 0], 'Brass pinion and dark hub');
  basePinion.position.set(-.16, .12, -.18);
  kit.gear(basePinion, .055, 12, .026, 'brass');
  for (const y of [.015, -.015]) add(basePinion, 'ring', 'titanium', [0, y, 0], [.032, .032, .032], [Math.PI / 2, 0, 0], true);
  spinners.push({ node: basePinion, base: basePinion.quaternion.clone(), kind: 'base' });

  const yoke = part('robot.shoulder-yoke', 'Axis 2 shoulder yoke and bearing housing', 'Robot arm',
    'Carries the upper arm on a transverse shoulder axis.',
    'A wide dark yoke, two pale bearing cheeks, a brass pivot pin and four bolted ribs sit on the turntable.', yaw, [0, .04, 0]);
  plate(yoke, 'dark', [0, .17, 0], [.46, .16, .30]);
  for (const side of [-1, 1]) {
    plate(yoke, 'shell', [side * .225, .23, 0], [.06, .24, .24]);
    add(yoke, 'ring', 'brass', [side * .25, .28, 0], [.075, .075, .075], [0, Math.PI / 2, 0]);
    rod(yoke, 'titanium', [side * .16, .10, -.05], [side * .16, .12, .20], .016);
  }
  axial(yoke, 'brass', [0, .28, 0], .035, .55);

  const shoulderTrunnion = part('robot.shoulder-trunnion', 'Axis 2 trunnion ring and encoder', 'Robot arm',
    'Carries the shoulder bearing loads into the yoke.',
    'A titanium trunnion ring, a dark encoder can, four brass bolts and a pale index plate clamp the shoulder axis.', yaw, [0, .04, 0], 'Titanium ring and dark encoder');
  shoulderTrunnion.position.set(0, .10, 0);
  add(shoulderTrunnion, 'ring', 'titanium', [0, 0, 0], [.16, .16, .16], [0, Math.PI / 2, 0]);
  axial(shoulderTrunnion, 'dark', [.12, 0, 0], .045, .08, 'x');
  for (let i = 0; i < 4; i++) add(shoulderTrunnion, 'bolt', 'brass', [.16 * Math.cos(i * TAU / 4), .16 * Math.sin(i * TAU / 4), 0], [.007, .012, .007], [0, 0, 0], true);
  plate(shoulderTrunnion, 'shell', [-.095, .075, .09], [.04, .03, .012], [0, 0, 0], true);

  const upper = part('robot.upper-arm', 'Axis 3 upper arm and cable conduit', 'Robot arm',
    'Places the elbow through the 850 mm upper link.',
    'Twin titanium rails, eight dark braces, two brass end bosses and a side cable conduit form one rigid upper arm.', yaw, [0, .05, 0], 'Twin rails and copper cable conduit');
  for (const x of [-.075, .075]) rod(upper, 'titanium', [x, .02, 0], [x, D.upper - .02, 0], .018);
  for (let i = 0; i <= 7; i++) plate(upper, 'dark', [0, .06 + i * .105, 0], [.17, .028, .08]);
  for (const y of [0, D.upper]) { add(upper, 'ring', 'brass', [0, y, 0], [.050, .050, .050], [0, Math.PI / 2, 0]); axial(upper, 'titanium', [0, y, 0], .024, .19); }
  rod(upper, 'copper', [.105, .10, .02], [.105, D.upper - .08, .02], .007, true);
  plate(upper, 'teal', [0, .42, .09], [.09, .14, .012], [0, 0, 0], true);

  const shoulderServo = part('robot.shoulder-servo', 'Axis 2 servo and gearbox', 'Robot arm',
    'Applies shoulder torque through the trunnion.',
    'A dark servo stack, a copper field band, a pale gearbox and six bolts hang behind the shoulder yoke.', upper, [0, .03, 0], 'Dark servo, copper band and pale gearbox');
  shoulderServo.position.set(0, .07, -.14);
  axial(shoulderServo, 'dark', [0, 0, 0], .075, .18, 'x');
  add(shoulderServo, 'ring', 'copper', [0, 0, 0], [.077, .077, .077], [0, Math.PI / 2, 0], true);
  add(shoulderServo, 'box', 'shell', [.10, 0, 0], [.08, .11, .13]);
  for (let i = 0; i < 6; i++) add(shoulderServo, 'bolt', 'titanium', [.15, .075 * Math.cos(i * TAU / 6), .075 * Math.sin(i * TAU / 6)], [.006, .012, .006], [0, 0, 0], true);

  const upperGuide = part('robot.upper-guide', 'Upper arm linear guide and stops', 'Robot arm',
    'Guides the dress pack along the upper link.',
    'A titanium guide rail, two brass end stops, a rubber bumper and four clamp bolts run beside the upper arm.', upper, [0, .02, 0], 'Titanium guide and brass stops');
  rod(upperGuide, 'titanium', [.10, .12, -.055], [.10, .74, -.055], .008);
  for (const y of [.12, .74]) add(upperGuide, 'ring', 'brass', [.10, y, -.055], [.016, .016, .016], [0, 0, Math.PI / 2], true);
  for (const y of [.20, .62]) add(upperGuide, 'bolt', 'titanium', [.10, y, -.04], [.005, .008, .005], [0, 0, 0], true);
  plate(upperGuide, 'rubber', [.10, .37, -.055], [.025, .03, .025], [0, 0, 0], true);

  const upperCable = part('robot.upper-cable', 'Upper arm cable pack', 'Robot arm',
    'Shows the dress pack that follows the upper arm.',
    'A dark flexible conduit, four brass clamps and a copper service loop run along the outside of the upper arm.', upper, [0, .04, 0], 'Dark conduit and brass clamps');
  for (const y of [.18, .38, .58, .74]) add(upperCable, 'ring', 'brass', [.115, y, .02], [.022, .022, .022], [0, Math.PI / 2, 0]);
  rod(upperCable, 'dark', [.115, .08, .02], [.115, .80, .02], .013);

  const upperDress = part('robot.dress-loop.upper', 'Upper arm cable dress loop', 'Robot arm',
    'Lets the cable pack flex without crossing the elbow axis.',
    'Four dark cable segments, three brass guide rings and three clamps form a service loop outside the upper arm.', upper, [0, .04, 0], 'Dark cable segments and brass guide rings');
  for (let i = 0; i < 4; i++) rod(upperDress, 'copper', [.145, .18 + i * .17, .04], [.155, .24 + i * .17, -.01], .005, true);
  for (const y of [.18, .42, .68]) add(upperDress, 'ring', 'brass', [.15, y, .02], [.025, .025, .025], [0, Math.PI / 2, 0], false);
  for (const y of [.22, .55]) add(upperDress, 'bolt', 'dark', [.15, y, .02], [.006, .010, .006], [0, 0, 0], true);

  for (let i = 0; i < 6; i++) {
    const link = part(`robot.cable-chain.${i + 1}`, `Cable chain link ${i + 1} of six`, 'Robot arm',
      'Guides the tool cable through the upper-arm bend.',
      'A dark chain link, two brass pins and a pale wear pad articulate along the cable path.', upper, [0, .02, 0], 'Dark link, brass pins and pale wear pad');
    const y = .24 + i * .09;
    plate(link, 'dark', [-.12, y, .105], [.05, .035, .045]);
    for (const z of [.08, .13]) add(link, 'bolt', 'brass', [-.12, y, z], [.005, .008, .005], [0, 0, 0], true);
    plate(link, 'shell', [-.12, y, .09], [.04, .028, .008], [0, 0, 0], true);
  }

  const airLine = part('robot.air-line', 'Tool air line and quick-release coupling', 'Robot arm',
    'Supplies the gripper jaws with clean compressed air.',
    'A copper air line, four brass clamps, a teal coupling and a dark strain relief follow the upper arm and wrist.', upper, [0, .03, 0], 'Copper line, teal coupling and brass clamps');
  rod(airLine, 'copper', [-.12, .10, .055], [-.12, .70, .055], .005, true);
  for (const y of [.18, .40, .62]) add(airLine, 'ring', 'brass', [-.12, y, .055], [.018, .018, .018], [0, 0, Math.PI / 2], true);
  add(airLine, 'cylinder', 'teal', [-.12, .70, .055], [.018, .025, .018]);
  add(airLine, 'cylinder', 'dark', [-.12, .74, .055], [.014, .02, .014], [0, 0, 0], true);

  for (const side of [-1, 1]) {
    const shield = part(`robot.heat-shield.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} upper arm heat shield`, 'Robot arm',
      'Protects the cable pack from weld spatter and radiant heat.',
      'A pale shield plate, a dark standoff and two brass fasteners clip to the upper arm rail.', upper, [0, .02, 0], 'Pale shield and brass fasteners');
    plate(shield, 'shell', [side * .105, .46, -.03], [.012, .38, .10], [0, 0, 0], false);
    for (const y of [.32, .60]) add(shield, 'bolt', 'brass', [side * .115, y, -.03], [.006, .010, .006], [0, 0, 0], true);
  }

  for (const [i, y] of [.14, .52].entries()) {
    const cap = part(`robot.encoder-cap.${i + 1}`, `Shoulder encoder cap ${i + 1} of two`, 'Robot arm',
      'Covers the shoulder encoder and protects its connector.',
      'A dark cap, a brass connector ring, a teal index dot and two titanium screws sit on the shoulder housing.', upper, [0, .02, 0], 'Dark cap, brass ring and teal index');
    cap.position.set(-.12, y, -.10);
    axial(cap, 'dark', [0, 0, 0], .035, .045, 'x');
    add(cap, 'ring', 'brass', [.03, 0, 0], [.030, .030, .030], [0, Math.PI / 2, 0], true);
    add(cap, 'sphere', 'lens', [.05, .02, 0], [.010, .010, .006], [0, 0, 0], true);
    for (const dz of [-.02, .02]) add(cap, 'bolt', 'titanium', [.055, 0, dz], [.005, .008, .005], [0, 0, 0], true);
  }

  const elbow = part('robot.elbow', 'Axis 4 elbow housing and servo', 'Robot arm',
    'Connects the upper arm to the forearm.',
    'A dark elbow housing, a pale servo cover, a brass pin and two retaining rings clamp the second arm link.', yaw, [0, .05, 0]);
  elbow.position.set(0, local([0, D.shoulderY, 0])[1] + D.upper, 0);
  plate(elbow, 'dark', [0, .02, 0], [.24, .16, .24]);
  add(elbow, 'sphere', 'shell', [0, .02, 0], [.13, .11, .13]);
  axial(elbow, 'brass', [0, 0, 0], .030, .30, 'x');
  for (const side of [-1, 1]) add(elbow, 'ring', 'titanium', [side * .12, 0, 0], [.055, .055, .055], [0, Math.PI / 2, 0]);

  const forearm = part('robot.forearm', 'Axis 5 forearm and wrist drive', 'Robot arm',
    'Places the wrist through the 780 mm forearm link.',
    'Twin rails, seven braces, a dark wrist motor housing and a copper sensor lead form one rigid forearm.', yaw, [0, .05, 0], 'Twin rails and dark wrist housing');
  for (const x of [-.060, .060]) rod(forearm, 'titanium', [x, .02, 0], [x, D.forearm - .02, 0], .016);
  for (let i = 0; i <= 6; i++) plate(forearm, 'dark', [0, .05 + i * .11, 0], [.14, .026, .07]);
  for (const y of [0, D.forearm]) { add(forearm, 'ring', 'brass', [0, y, 0], [.043, .043, .043], [0, Math.PI / 2, 0]); axial(forearm, 'titanium', [0, y, 0], .020, .17); }
  rod(forearm, 'copper', [.078, .10, 0], [.078, D.forearm - .10, 0], .006, true);
  plate(forearm, 'shell', [0, D.forearm - .08, .075], [.10, .10, .08]);

  const elbowServo = part('robot.elbow-servo', 'Axis 3 elbow servo and brake', 'Robot arm',
    'Drives the forearm through the elbow joint.',
    'A dark servo stack, a copper field band, a pale brake cover and four brass bolts clamp the elbow housing.', upper, [0, .04, 0], 'Dark servo, copper band and pale brake');
  elbowServo.position.set(0, D.upper - .08, -.13);
  axial(elbowServo, 'dark', [0, 0, 0], .065, .17, 'x');
  add(elbowServo, 'ring', 'copper', [0, 0, 0], [.067, .067, .067], [0, Math.PI / 2, 0], true);
  add(elbowServo, 'box', 'shell', [.09, 0, 0], [.08, .10, .12]);
  for (let i = 0; i < 4; i++) add(elbowServo, 'bolt', 'brass', [.14, .055 * Math.cos(i * TAU / 4), .055 * Math.sin(i * TAU / 4)], [.006, .010, .006], [0, 0, 0], true);

  const forearmGuide = part('robot.forearm-guide', 'Forearm guide rail and cable block', 'Robot arm',
    'Keeps the forearm sensor lead clear of the wrist axis.',
    'A titanium rail, two brass clamps, a dark cable block and four screws run along the forearm.', forearm, [0, .03, 0], 'Titanium rail, brass clamps and dark block');
  rod(forearmGuide, 'titanium', [.085, .08, -.02], [.085, .70, -.02], .007);
  for (const y of [.10, .68]) add(forearmGuide, 'ring', 'brass', [.085, y, -.02], [.015, .015, .015], [0, 0, Math.PI / 2], true);
  plate(forearmGuide, 'dark', [.085, .38, -.02], [.045, .07, .045]);
  for (const y of [.20, .56]) add(forearmGuide, 'bolt', 'titanium', [.085, y, -.005], [.005, .008, .005], [0, 0, 0], true);

  const forearmServo = part('robot.forearm-servo', 'Axis 4 forearm servo', 'Robot arm',
    'Rolls the wrist through the forearm axis.',
    'A dark servo, a copper band, a brass output flange and two titanium rings sit beside the forearm.', forearm, [0, .03, 0], 'Dark servo and brass output flange');
  forearmServo.position.set(0, .16, .08);
  axial(forearmServo, 'dark', [0, 0, 0], .052, .13, 'y');
  add(forearmServo, 'ring', 'copper', [0, 0, 0], [.054, .054, .054], [Math.PI / 2, 0, 0], true);
  add(forearmServo, 'ring', 'brass', [0, .07, 0], [.040, .040, .040], [Math.PI / 2, 0, 0], true);
  for (const y of [-.04, .04]) add(forearmServo, 'ring', 'titanium', [0, y, 0], [.058, .058, .058], [0, Math.PI / 2, 0], true);

  const forearmCable = part('robot.forearm-cable', 'Forearm sensor lead and clamp', 'Robot arm',
    'Carries the wrist encoder lead along the forearm.',
    'A dark lead, two brass clamps and a teal connector follow the forearm without crossing the wrist axis.', forearm, [0, .04, 0], 'Dark lead and teal connector');
  rod(forearmCable, 'dark', [.092, .10, -.02], [.092, .70, -.02], .007);
  for (const y of [.20, .48]) add(forearmCable, 'ring', 'brass', [.092, y, -.02], [.017, .017, .017], [0, Math.PI / 2, 0]);
  plate(forearmCable, 'teal', [.092, .70, -.02], [.035, .05, .035]);

  const forearmDress = part('robot.dress-loop.forearm', 'Forearm cable dress loop', 'Robot arm',
    'Takes up slack as the wrist rolls and bends.',
    'Three dark cable segments, two brass rings, a pale wear block and two clamps form the forearm service loop.', forearm, [0, .03, 0], 'Dark segments, brass rings and pale wear block');
  for (let i = 0; i < 3; i++) rod(forearmDress, 'copper', [.11, .18 + i * .16, .03], [.12, .24 + i * .16, -.02], .005, true);
  for (const y of [.20, .50]) add(forearmDress, 'ring', 'brass', [.115, y, .02], [.020, .020, .020], [0, Math.PI / 2, 0], true);
  plate(forearmDress, 'shell', [.115, .36, .02], [.020, .08, .04], [0, 0, 0], false);
  for (const y of [.26, .60]) add(forearmDress, 'bolt', 'dark', [.115, y, .02], [.005, .008, .005], [0, 0, 0], true);

  for (const [i, y] of [.20, .48].entries()) {
    const ring = part(`robot.joint-ring.${i + 3}`, `Forearm joint ring ${i + 3}`, 'Robot arm',
      'Reinforces the forearm bearing seat.',
      'A titanium ring, four brass bolts and a pale index mark wrap the forearm tube.', forearm, [0, .02, 0], 'Titanium ring and brass bolts');
    add(ring, 'ring', 'titanium', [0, y, 0], [.052, .052, .052], [0, Math.PI / 2, 0]);
    for (let k = 0; k < 4; k++) add(ring, 'bolt', 'brass', [.045 * Math.cos(k * TAU / 4), y + .045 * Math.sin(k * TAU / 4), 0], [.005, .008, .005], [0, 0, 0], true);
  }

  const forearmShield = part('robot.forearm-shield', 'Forearm cable shield', 'Robot arm',
    'Shields the wrist encoder cable from the workpiece.',
    'A pale curved shield, a dark standoff and two brass screws clip over the forearm cable.', forearm, [0, .02, 0], 'Pale shield and brass screws');
  plate(forearmShield, 'shell', [0, .42, .095], [.10, .30, .012], [0, 0, 0], false);
  for (const y of [.32, .52]) add(forearmShield, 'bolt', 'brass', [0, y, .102], [.005, .008, .005], [0, 0, 0], true);

  const wristServo = part('robot.wrist-servo', 'Axis 5 wrist servo', 'Robot arm',
    'Bends the wrist through the forearm end.',
    'A dark servo, a brass gear ring, a copper band and a pale cover sit at the forearm tip.', forearm, [0, .03, 0], 'Dark servo, brass gear ring and pale cover');
  wristServo.position.set(0, D.forearm - .08, .06);
  axial(wristServo, 'dark', [0, 0, 0], .048, .12, 'y');
  add(wristServo, 'ring', 'brass', [0, .055, 0], [.038, .038, .038], [Math.PI / 2, 0, 0], true);
  add(wristServo, 'ring', 'copper', [0, -.02, 0], [.050, .050, .050], [0, Math.PI / 2, 0], true);
  plate(wristServo, 'shell', [.055, .02, 0], [.04, .07, .08]);

  for (let i = 0; i < 4; i++) {
    const fitting = part(`robot.grease-fitting.${i + 1}`, `Joint grease fitting ${i + 1} of four`, 'Robot arm',
      'Lubricates one robot joint bearing.',
      'A brass nipple, a dark dust cap and a pale identification ring sit on a joint housing.', upper, [0, .02, 0], 'Brass nipple and dark dust cap');
    fitting.position.set(-.13 + (i % 2) * .26, .22 + Math.floor(i / 2) * .35, -.10);
    axial(fitting, 'brass', [0, 0, 0], .010, .025, 'y');
    add(fitting, 'sphere', 'dark', [0, .018, 0], [.012, .012, .012], [0, 0, 0], true);
    add(fitting, 'ring', 'shell', [0, -.01, 0], [.012, .012, .012], [Math.PI / 2, 0, 0], true);
  }

  const balanceMount = part('robot.balance-mount', 'Counterbalance anchor and clevis', 'Robot arm',
    'Anchors the gas counterbalance to the turntable and upper arm.',
    'Two dark clevises, a brass pin and four bolted pads attach the spring cylinder without crossing the shoulder axis.', yaw, [0, .04, 0]);
  add(balanceMount, 'box', 'dark', [0, .20, -.18], [.16, .10, .10]);
  for (const side of [-1, 1]) add(balanceMount, 'ring', 'brass', [side * .045, .22, -.20], [.045, .045, .045], [0, Math.PI / 2, 0]);
  const balanceGuide = part('robot.balance-guide', 'Counterbalance guide rod and wear ring', 'Robot arm',
    'Keeps the gas spring aligned as the shoulder pitches.',
    'A titanium guide rod, two brass wear rings, a rubber bumper and a clamp bolt sit beside the counterbalance.', yaw, [0, .02, 0], 'Titanium rod, brass rings and rubber bumper');
  rod(balanceGuide, 'titanium', [-.09, .24, -.19], [.02, .55, -.19], .008);
  for (const y of [.30, .48]) add(balanceGuide, 'ring', 'brass', [0, y, -.19], [.018, .018, .018], [0, Math.PI / 2, 0], true);
  add(balanceGuide, 'sphere', 'rubber', [.02, .55, -.19], [.016, .016, .016], [0, 0, 0], true);
  add(balanceGuide, 'bolt', 'titanium', [-.06, .26, -.19], [.006, .010, .006], [0, 0, 0], true);

  for (const half of ['barrel', 'rod']) {
    const node = part(`robot.balance.${half}`, `Gas counterbalance ${half}`, 'Robot arm',
      'Shows the spring that supports the arm weight.',
      'A telescoping dark barrel and pale piston are drawn between the turntable clevis and the sampled upper-arm anchor; no gas force is solved.', yaw, [0, .06, 0], half === 'barrel' ? 'Dark gas barrel' : 'Pale piston rod');
    add(node, 'cylinder', half === 'barrel' ? 'dark' : 'titanium', [0, .5, 0], [half === 'barrel' ? .045 : .026, 1, half === 'barrel' ? .045 : .026]);
    add(node, 'ring', 'brass', [0, .02, 0], [half === 'barrel' ? .052 : .032, half === 'barrel' ? .052 : .032, half === 'barrel' ? .052 : .032], [0, 0, 0]);
    cylinders.push({ half, node });
  }

  const wrist = part('robot.wrist', 'Axis 6 wrist housing and flange', 'Robot arm',
    'Orients the gripper through a 220 mm wrist link.',
    'A dark wrist housing, a brass bearing ring and a pale flange plate carry the tool centre point.', yaw, [0, .05, 0], 'Dark housing and brass bearing ring');
  axial(wrist, 'dark', [0, .11, 0], .075, .22, 'y');
  add(wrist, 'ring', 'brass', [0, .02, 0], [.08, .08, .08], [Math.PI / 2, 0, 0]);
  plate(wrist, 'shell', [0, .20, 0], [.15, .04, .15]);
  plate(wrist, 'teal', [0, .12, .078], [.05, .035, .010], [0, 0, 0], true);
  for (const side of [-1, 1]) plate(wrist, 'titanium', [side * .065, .14, .06], [.02, .08, .03], [0, 0, 0], true);

  const wristRoll = part('robot.wrist-roll-collar', 'Axis 4 wrist roll collar', 'Robot arm',
    'Transmits the forearm roll into the wrist without backlash.',
    'A brass roll collar, a dark lock ring, two titanium keys and four bolts ride on the wrist axis and rotate visibly.', yaw, [0, .03, 0], 'Brass roll collar and titanium keys');
  axial(wristRoll, 'brass', [0, 0, 0], .062, .055, 'y');
  add(wristRoll, 'ring', 'dark', [0, .025, 0], [.050, .050, .050], [Math.PI / 2, 0, 0], true);
  for (const x of [-.05, .05]) plate(wristRoll, 'titanium', [x, 0, .045], [.018, .035, .012], [0, 0, 0], true);
  for (let i = 0; i < 4; i++) add(wristRoll, 'bolt', 'titanium', [.045 * Math.cos(i * TAU / 4), 0, .045 * Math.sin(i * TAU / 4)], [.005, .009, .005], [0, 0, 0], true);

  const wristClevis = part('robot.wrist-bend-clevis', 'Axis 5 wrist bend clevis', 'Robot arm',
    'Carries the wrist bend bearing and its preload shims.',
    'Two titanium clevis cheeks, a brass pivot bushing, a teal index and four bolts straddle the wrist bend axis.', yaw, [0, .03, 0], 'Titanium clevis and brass bushing');
  for (const x of [-.07, .07]) plate(wristClevis, 'titanium', [x, 0, 0], [.018, .12, .10]);
  axial(wristClevis, 'brass', [0, 0, 0], .035, .17, 'x');
  for (const x of [-.07, .07]) add(wristClevis, 'bolt', 'dark', [x, .05, .05], [.005, .009, .005], [0, 0, 0], true);
  plate(wristClevis, 'teal', [0, -.06, .055], [.03, .018, .008], [0, 0, 0], true);

  const flange = part('robot.flange', 'Tool flange and dowel pins', 'Robot tool',
    'Locates the gripper on the wrist.',
    'A circular flange, four brass dowels and a central cable pass-through sit at the tool centre point.', yaw, [0, .05, 0], 'Circular flange and brass dowels');
  axial(flange, 'titanium', [0, .015, 0], .085, .03, 'y');
  for (let i = 0; i < 4; i++) add(flange, 'bolt', 'brass', [.055 * Math.cos(i * TAU / 4), .033, .055 * Math.sin(i * TAU / 4)], [.008, .018, .008]);
  axial(flange, 'dark', [0, .02, 0], .028, .04, 'y');

  const toolRing = part('robot.tool-ring', 'Tool changer ring and locking balls', 'Robot tool',
    'Shows the quick-change interface between wrist and gripper.',
    'A brass locking ring, six dark ball detents and a pale index mark sit between the flange and the gripper body.', flange, [0, .03, 0], 'Brass locking ring and dark detents');
  add(toolRing, 'ring', 'brass', [0, .035, 0], [.075, .075, .075], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) add(toolRing, 'sphere', 'dark', [.058 * Math.cos(i * TAU / 6), .035, .058 * Math.sin(i * TAU / 6)], [.009, .009, .009], [0, 0, 0], true);
  plate(toolRing, 'shell', [.058, .035, 0], [.02, .012, .02], [0, 0, 0], true);
  const toolIndex = part('robot.tool-index', 'Tool roll index mark and encoder flag', 'Robot tool',
    'Shows the tool roll angle on the flange.',
    'A teal index flag, a pale backing pad and a brass pin turn with the tool flange and remain visible in X-ray.', flange, [0, .02, 0], 'Teal index flag and brass pin');
  plate(toolIndex, 'teal', [.10, .01, 0], [.03, .05, .012]);
  plate(toolIndex, 'shell', [.10, .01, -.012], [.024, .04, .006], [0, 0, 0], true);
  add(toolIndex, 'bolt', 'brass', [.10, .04, .008], [.005, .010, .005], [0, 0, 0], true);

  const gripper = part('robot.gripper', 'Parallel gripper body and guide rails', 'Robot tool',
    'Converts the tool flange into two parallel jaws.',
    'A dark body, two titanium guide rails, a brass drive screw and a teal jaw sensor form the parallel gripper.', yaw, [0, .05, 0], 'Dark body and titanium guide rails');
  plate(gripper, 'dark', [0, .07, 0], [.20, .11, .10]);
  for (const x of [-.075, .075]) rod(gripper, 'titanium', [x, .02, 0], [x, .13, 0], .007);
  rod(gripper, 'brass', [0, .06, .06], [0, .06, -.06], .008);
  plate(gripper, 'teal', [0, .11, .052], [.06, .03, .012]);

  const camera = part('robot.wrist-camera', 'Wrist inspection camera and lamp', 'Robot tool',
    'Looks down between the gripper jaws.',
    'A dark camera body, a teal lens, a brass bezel and two pale lamp pads are mounted above the guide rails.', gripper, [0, .03, 0], 'Dark camera body and teal lens');
  plate(camera, 'dark', [.15, .075, 0], [.10, .055, .05]);
  add(camera, 'sphere', 'lens', [0, .15, .105], [.026, .022, .012]);
  add(camera, 'ring', 'brass', [0, .15, .100], [.030, .030, .030], [0, 0, 0]);
  for (const x of [-.036, .036]) add(camera, 'box', 'shell', [x, .15, .102], [.024, .012, .010], [0, 0, 0], true);

  const screw = part('robot.gripper-screw', 'Gripper drive screw and thrust washer', 'Robot tool',
    'Converts the jaw motor into parallel finger travel.',
    'A brass drive screw, two titanium thrust washers, a dark nut block and a teal position mark sit in the gripper body.', gripper, [0, .02, 0], 'Brass screw and titanium washers');
  rod(screw, 'brass', [0, .06, .06], [0, .06, -.06], .008);
  for (const z of [-.05, .05]) add(screw, 'ring', 'titanium', [0, .06, z], [.014, .014, .014], [Math.PI / 2, 0, 0], true);
  plate(screw, 'dark', [0, .095, .06], [.03, .025, .02], [0, 0, 0], true);
  plate(screw, 'teal', [0, .095, .075], [.012, .012, .006], [0, 0, 0], true);
  const jawSensor = part('robot.jaw-sensor', 'Gripper jaw sensor and cable shoe', 'Robot tool',
    'Measures jaw opening and detects a gripped part.',
    'A teal sensor block, a dark cable shoe, two brass screws and a copper pigtail sit above the guide rail.', gripper, [0, .02, 0], 'Teal sensor block and copper pigtail');
  plate(jawSensor, 'teal', [-.09, .105, .05], [.045, .028, .012]);
  plate(jawSensor, 'dark', [-.09, .105, .035], [.05, .032, .012], [0, 0, 0], true);
  for (const x of [-.105, -.075]) add(jawSensor, 'bolt', 'brass', [x, .105, .06], [.005, .008, .005], [0, 0, 0], true);
  rod(jawSensor, 'copper', [-.07, .105, .05], [-.02, .12, .04], .003, true);

  const gripperLight = part('robot.gripper-light', 'Gripper work light and bracket', 'Robot tool',
    'Illuminates the pick point between the jaws.',
    'A teal light pad, a pale bracket, a dark backing and two brass screws sit above the camera.', gripper, [0, .02, 0], 'Teal light pad and pale bracket');
  plate(gripperLight, 'shell', [-.112, .09, 0], [.045, .025, .05]);
  plate(gripperLight, 'lens', [-.112, .108, 0], [.032, .006, .035], [0, 0, 0], true);
  for (const x of [-.13, -.095]) add(gripperLight, 'bolt', 'brass', [x, .10, .02], [.004, .007, .004], [0, 0, 0], true);
  const tcpPointer = part('robot.tcp-pointer', 'Tool centre point pointer', 'Robot tool',
    'Marks the exact tool centre point used by the cell cycle.',
    'A thin titanium pointer, a brass tip, a dark clamp and two screws hang below the gripper body.', gripper, [0, .02, 0], 'Titanium pointer and brass tip');
  rod(tcpPointer, 'titanium', [-.10, .02, .05], [-.10, -.08, .05], .004);
  add(tcpPointer, 'sphere', 'brass', [-.10, -.08, .05], [.008, .008, .008]);
  plate(tcpPointer, 'dark', [-.10, .015, .05], [.022, .015, .022], [0, 0, 0], true);
  for (const x of [-.11, -.09]) add(tcpPointer, 'bolt', 'titanium', [x, .02, .05], [.003, .006, .003], [0, 0, 0], true);

  for (const side of [-1, 1]) {
    const finger = part(`robot.finger.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} gripper finger`, 'Robot tool',
      'Closes on the workpiece with a parallel jaw motion.',
      'A titanium finger plate, a brass guide block and a dark wear strip slide along the gripper rails.', gripper, [0, .03, 0], 'Titanium finger plate and brass guide block');
    finger.position.set(side * D.fingerMin, .08, 0);
    plate(finger, 'titanium', [0, .08, 0], [.026, .16, .055]);
    plate(finger, 'dark', [0, .15, 0], [.024, .04, .065], [0, 0, 0], true);
    add(finger, 'box', 'brass', [0, .02, 0], [.03, .04, .06]);
    const pad = part(`robot.pad.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} gripper pad`, 'Robot tool',
      'Provides the compliant contact face on the workpiece.',
      'A rubber pad, a pale backing plate and two brass pins sit on the inside face of each finger.', finger, [0, .02, 0], 'Rubber pad and pale backing');
    plate(pad, 'rubber', [-side * .016, .15, 0], [.010, .075, .060]);
    plate(pad, 'shell', [-side * .010, .15, 0], [.006, .075, .065]);
    for (const y of [.12, .18]) add(pad, 'bolt', 'brass', [-side * .016, y, 0], [.005, .010, .005], [0, 0, 0], true);
    fingers.push({ node: finger, side, pad });
    labels.push({ node: finger, kind: 'finger' });
  }

  const bearingParts = [
    ['robot.axis-bearing.1', 'Axis 2 bearing race and shims', upper, [0, .18, 0], 'Titanium race and brass shims'],
    ['robot.axis-bearing.2', 'Axis 3 bearing race and shims', forearm, [0, .30, 0], 'Titanium race and brass shims'],
    ['robot.axis-bearing.3', 'Axis 5 bearing race and shims', wrist, [0, .08, 0], 'Titanium race and brass shims'],
    ['robot.axis-bearing.4', 'Axis 6 bearing race and shims', flange, [0, .035, 0], 'Titanium race and brass shims'],
  ];
  for (const [id, name, parent, position, material] of bearingParts) {
    const bearing = part(id, name, 'Robot arm',
      'Carries the radial and thrust loads of one robot joint.',
      'A titanium bearing race, four brass preload shims and a dark seal ring sit on the joint axis.', parent, [0, .02, 0], material);
    bearing.position.set(...position);
    add(bearing, 'ring', 'titanium', [0, 0, 0], [.105, .105, .105], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 4; i++) add(bearing, 'bolt', 'brass', [.085 * Math.cos(i * TAU / 4), .012, .085 * Math.sin(i * TAU / 4)], [.006, .010, .006], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) {
    const guide = part(`robot.guide-ring.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} jaw guide ring`, 'Robot tool',
      'Keeps the parallel jaw carriage square on its rails.',
      'A brass guide ring, a dark wiper seal and two titanium screws sit at the end of one jaw rail.', gripper, [0, .02, 0], 'Brass guide ring and dark wiper');
    guide.position.set(side * .075, .12, 0);
    add(guide, 'ring', 'brass', [0, 0, 0], [.030, .030, .030], [Math.PI / 2, 0, 0]);
    for (const z of [-.012, .012]) add(guide, 'bolt', 'titanium', [0, 0, z], [.004, .008, .004], [0, 0, 0], true);
  }
  const toolBearing = part('robot.tool-bearing', 'Tool flange bearing and preload shims', 'Robot tool',
    'Takes the axial load of the rotating tool interface.',
    'Two titanium bearing rings, four brass shims and a dark seal sit under the tool flange.', flange, [0, .03, 0], 'Titanium rings and brass shims');
  for (const y of [.055, .075]) add(toolBearing, 'ring', 'titanium', [0, y, 0], [.072, .072, .072], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 4; i++) add(toolBearing, 'bolt', 'brass', [.060 * Math.cos(i * TAU / 4), .065, .060 * Math.sin(i * TAU / 4)], [.005, .009, .005], [0, 0, 0], true);
  const wristShield = part('robot.wrist-shield', 'Wrist bearing shield and wiper', 'Robot arm',
    'Keeps chips and coolant out of the wrist bearing.',
    'A pale shield disc, a brass retaining ring, a rubber wiper and two titanium screws cover the wrist bearing.', wrist, [0, .02, 0], 'Pale shield, brass ring and rubber wiper');
  add(wristShield, 'ring', 'brass', [0, -.01, 0], [.085, .085, .085], [Math.PI / 2, 0, 0]);
  plate(wristShield, 'shell', [0, -.015, .07], [.09, .06, .012], [0, 0, 0], true);
  add(wristShield, 'cylinder', 'rubber', [0, -.015, .045], [.045, .008, .045], [Math.PI / 2, 0, 0], true);
  for (const x of [-.05, .05]) add(wristShield, 'bolt', 'titanium', [x, -.015, .055], [.005, .008, .005], [0, 0, 0], true);
  const balanceRing = part('robot.balance-ring', 'Counterbalance anchor ring and lock', 'Robot arm',
    'Reacts the gas-spring load into the turntable clevis.',
    'A titanium anchor ring, four brass bolts, a dark lock plate and a rubber isolator surround the counterbalance pin.', yaw, [0, .02, 0], 'Titanium ring, brass bolts and rubber isolator');
  add(balanceRing, 'ring', 'titanium', [0, .22, -.20], [.055, .055, .055], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 4; i++) add(balanceRing, 'bolt', 'brass', [.045 * Math.cos(i * TAU / 4), .22 + .045 * Math.sin(i * TAU / 4), -.20], [.005, .009, .005], [0, 0, 0], true);
  plate(balanceRing, 'dark', [0, .30, -.20], [.08, .05, .04], [0, 0, 0], true);
  add(balanceRing, 'sphere', 'rubber', [0, .16, -.20], [.022, .022, .022], [0, 0, 0], true);

  for (const [index, [parent, x, y, z, text]] of [
    ['yaw', 0, .12, -.30, 'J1'], ['upper', .14, .02, 0, 'J2'], ['forearm', .12, .02, 0, 'J3'],
    ['wrist', .12, .02, 0, 'J4'], ['flange', .10, .02, 0, 'J5'], ['gripper', .10, .06, 0, 'J6'],
  ].entries()) {
    const owner = { yaw, upper, forearm, wrist, flange, gripper }[parent];
    const label = part(`robot.label.${index + 1}`, `Axis ${index + 1} identification plate`, 'Robot arm',
      `Labels the ${index + 1}${['st', 'nd', 'rd', 'th', 'th', 'th'][index]} robot axis.`,
      'A teal plate, a dark backing pad and a brass index stud are clamped beside the joint bearing.', owner, [0, .02, 0], 'Teal plate and brass index stud');
    label.position.set(x, y, z);
    plate(label, 'dark', [0, 0, 0], [.075, .045, .008]);
    plate(label, 'teal', [0, 0, .006], [.055, .030, .004], [0, 0, 0], true);
    add(label, 'cylinder', 'brass', [.032, .022, .006], [.006, .014, .006], [Math.PI / 2, 0, 0], true);
    labels.push({ node: label, kind: 'axis' });
  }

  for (const [parent, x, y, z, name] of [
    [upper, 0, .02, 0, 'shoulder cover'], [forearm, 0, .02, 0, 'elbow cover'], [wrist, 0, .02, 0, 'wrist cover'],
  ]) {
    const cover = part(`robot.cover.${name.replace(' ', '-')}`, `Robot ${name}`, 'Robot arm',
      'Covers the joint bearing while leaving the axis pin visible.',
      'A pale shell cap, a brass rim and two dark isolators sit over the servo bearing without hiding the pin.', parent, [0, .03, 0], 'Pale shell cap and brass rim');
    cover.position.set(x, y, z);
    add(cover, 'sphere', 'shell', [0, 0, 0], [.13, .07, .13]);
    add(cover, 'ring', 'brass', [0, 0, 0], [.12, .12, .12], [Math.PI / 2, 0, 0]);
    for (const dx of [-.08, .08]) add(cover, 'cylinder', 'dark', [dx, 0, 0], [.010, .03, .010], [0, 0, Math.PI / 2], true);
  }

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  const qRoll = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), axisY = new THREE.Vector3(0, 1, 0);
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.arm && state?.gripper && state?.counterbalance) lastState = state;
    else if (Number.isFinite(state?.phase)) lastState = poseAt(state.phase * TAU, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    yaw.rotation.y = pose.arm.yaw;
    elbow.position.fromArray(local(pose.arm.elbowPoint));
    aim(upper, local(pose.arm.shoulderPoint), local(pose.arm.elbowPoint));
    aim(forearm, local(pose.arm.elbowPoint), local(pose.arm.wristPoint));
    aim(wrist, local(pose.arm.wristPoint), local(pose.arm.flangePoint));
    qRoll.setFromAxisAngle(axisY, pose.arm.wristRoll); wrist.quaternion.multiply(qRoll);
    aim(wristRoll, local(pose.arm.wristPoint), local(pose.arm.flangePoint));
    wristRoll.quaternion.multiply(qRoll);
    aim(wristClevis, local(pose.arm.wristPoint), local(pose.arm.flangePoint));
    const raw = [pose.arm.toolTip[0] - pose.arm.flangePoint[0], pose.arm.toolTip[1] - pose.arm.flangePoint[1], pose.arm.toolTip[2] - pose.arm.flangePoint[2]];
    const rawLength = Math.max(1e-9, Math.hypot(raw[0], raw[1], raw[2])), direction = raw.map(value => value / rawLength);
    const toolBase = pose.arm.flangePoint, toolEnd = [toolBase[0] + direction[0] * .06, toolBase[1] + direction[1] * .06, toolBase[2] + direction[2] * .06];
    aim(flange, local(toolBase), local(toolEnd));
    qRoll.setFromAxisAngle(axisY, pose.arm.toolRoll); flange.quaternion.multiply(qRoll);
    const gripBase = [toolBase[0] + direction[0] * .07, toolBase[1] + direction[1] * .07, toolBase[2] + direction[2] * .07];
    const gripEnd = [gripBase[0] + direction[0] * .12, gripBase[1] + direction[1] * .12, gripBase[2] + direction[2] * .12];
    aim(gripper, local(gripBase), local(gripEnd));
    gripper.quaternion.multiply(qRoll);
    for (const record of fingers) record.node.position.x = record.side * (pose.gripper.actualSpread + .021);
    for (const record of rollers) record.node.rotation.z = pose.drive.rollerAngle;
    for (const record of cylinders) {
      const data = pose.counterbalance;
      const mid = [data.anchor[0] + (data.upperAnchor[0] - data.anchor[0]) * .55, data.anchor[1] + (data.upperAnchor[1] - data.anchor[1]) * .55, data.anchor[2] + (data.upperAnchor[2] - data.anchor[2]) * .55];
      if (record.half === 'barrel') {
        aim(record.node, local(data.anchor), local(mid));
        record.node.scale.y = Math.max(.001, Math.hypot(mid[0] - data.anchor[0], mid[1] - data.anchor[1], mid[2] - data.anchor[2]));
      } else {
        aim(record.node, local(mid), local(data.upperAnchor));
        record.node.scale.y = Math.max(.001, Math.hypot(data.upperAnchor[0] - mid[0], data.upperAnchor[1] - mid[1], data.upperAnchor[2] - mid[2]));
      }
    }
    for (const record of spinners) {
      if (record.kind === 'sprocket') { qSpin.setFromAxisAngle(axisY, pose.drive.sprocketAngle); record.node.quaternion.copy(record.base).multiply(qSpin); }
      if (record.kind === 'spindle') { qSpin.setFromAxisAngle(axisY, pose.drive.spindleAngle); record.node.quaternion.copy(record.base).multiply(qSpin); }
      if (record.kind === 'base') { qSpin.setFromAxisAngle(axisY, pose.drive.sprocketAngle * .5); record.node.quaternion.copy(record.base).multiply(qSpin); }
      if (record.kind === 'scanner') { qSpin.setFromAxisAngle(axisY, pose.safety.scanner); record.node.quaternion.copy(record.base).multiply(qSpin); }
    }
    for (const record of cleats) {
      const u = ((pose.phase * 1.28 + record.offset) % 1 + 1) % 1;
      if (u < .55) {
        record.node.position.set(-1.15 + 2.3 * u / .55, D.conveyorY + .058, D.conveyorZ);
      } else {
        record.node.position.set(1.15 - 2.3 * (u - .55) / .45, D.conveyorY - .035, D.conveyorZ);
      }
    }
    for (const record of labels) {
      if (record.kind === 'fan') record.node.rotation.x = pose.drive.fanAngle;
      if (record.kind === 'beacon') record.node.rotation.y = pose.drive.beaconAngle;
    }
    const [wx, wy, wz] = pose.workpiece.position || [pose.workpiece[0], pose.workpiece[1], pose.workpiece[2]];
    workpiece.position.set(wx, wy, wz);
    workpiece.rotation.y = pose.workpiece.yaw || 0;
    gate.rotation.y = pose.safety.gate;
    curtainHead.position.y = 1.18 + .35 * Math.sin(pose.phase * TAU + .4);
    for (const [index, record] of positioners.entries()) {
      record.table.rotation.y = index === 0 ? pose.positioner.angle : pose.positioner.auxAngle;
    }
    kit.sync(options);
  }
  update(lastState);
  const framePoints = [];
  for (let i = 0; i < 16; i++) {
    const a = i * TAU / 16;
    framePoints.push(new THREE.Vector3(2.2 * Math.cos(a), .02, 2.2 * Math.sin(a)));
    framePoints.push(new THREE.Vector3(1.8 * Math.cos(a), 2.25, 1.8 * Math.sin(a)));
    framePoints.push(new THREE.Vector3(.9 * Math.cos(a), 1.55, .9 * Math.sin(a)));
  }
  framePoints.push(new THREE.Vector3(.45, 2.6, 1.5), new THREE.Vector3(-1.65, .9, -1.45));
  framePoints.push(new THREE.Vector3(-2.78, .02, .05), new THREE.Vector3(-2.78, 1.55, 1.02));
  framePoints.push(new THREE.Vector3(2.22, .02, 1.92), new THREE.Vector3(2.22, 1.60, -1.62));
  framePoints.push(new THREE.Vector3(0, 2.45, 0), new THREE.Vector3(-1.95, 2.28, 1.60));
  return {
    group: kit.group, update, framePoints, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
