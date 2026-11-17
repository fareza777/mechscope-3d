import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('FABER R6 · six-axis robot cell');
  const nodes = [], rollers = [], fingers = [], labels = [], cylinders = [];
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

  // ---------------------------------------------------------------- cell
  const pad = part('cell.floor', 'Cell floor pad and robot datum', 'Cell',
    'Provides the fixed floor datum for the cell.',
    'A dark floor mat, a painted teal base outline and a brass datum cross sit below the robot and conveyor.', undefined, [0, 0, 0], 'Dark mat, teal outline and brass datum');
  plate(pad, 'dark', [0, .006, .05], [4.4, .012, 3.7]);
  for (const z of [-1.75, 1.85]) plate(pad, 'teal', [0, .014, z], [4.2, .004, .035], [0, 0, 0], true);
  for (const x of [-2.10, 2.10]) plate(pad, 'teal', [x, .014, .05], [.035, .004, 3.6], [0, 0, 0], true);
  plate(pad, 'brass', [0, .016, 1.38], [1.20, .004, .035], [0, 0, 0], true);
  plate(pad, 'brass', [0, .016, 1.38], [.035, .004, .40], [0, 0, 0], true);

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
    plate(mesh, 'shell', [panel.axis === 'x' ? 0 : panel.x, 1.60, panel.axis === 'x' ? panel.z : 0], [panel.axis === 'x' ? .03 : .03, 1.00, panel.axis === 'x' ? .03 : .03]);
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
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4;
      rod(roller, 'titanium', [0, 0, -.29], [.06 * Math.cos(a), .06 * Math.sin(a), -.29], .004);
      rod(roller, 'titanium', [0, 0, .29], [.06 * Math.cos(a), .06 * Math.sin(a), .29], .004);
    }
    rollers.push({ node: roller });
  }

  const belt = part('conveyor.belt', 'Upper belt run and cleat strip', 'Conveyor',
    'Moves the workpiece across the cell.',
    'A dark rubber belt, six brass cleats and two pale edge strips sit above the rollers and below the workpiece.', undefined, [0, .03, 0], 'Dark rubber belt and brass cleats');
  plate(belt, 'rubber', [0, D.conveyorY + .045, D.conveyorZ], [2.50, .018, .56]);
  for (let i = 0; i < 6; i++) plate(belt, 'brass', [-1.04 + i * .42, D.conveyorY + .058, D.conveyorZ], [.035, .010, .54], [0, 0, 0], true);
  for (const z of [-.285, .285]) rod(belt, 'shell', [-1.24, D.conveyorY + .052, D.conveyorZ + z], [1.24, D.conveyorY + .052, D.conveyorZ + z], .008, true);

  for (const [index, x] of [-1.02, 1.02].entries()) {
    const leg = part(`conveyor.leg.${index + 1}`, `Conveyor leg ${index + 1} of two`, 'Conveyor',
      'Carries the conveyor frame on the cell floor.',
      'A dark square leg, a brass foot plate and two diagonal braces reach the side rails.', undefined, [0, .03, 0], 'Dark square leg and brass foot');
    plate(leg, 'dark', [x, .30, D.conveyorZ], [.08, .60, .08]);
    plate(leg, 'brass', [x, .025, D.conveyorZ], [.20, .03, .20]);
    for (const side of [-1, 1]) rod(leg, 'titanium', [x, .28, D.conveyorZ + side * .04], [x, .54, D.conveyorZ + side * .30], .010);
    for (const dz of [-.16, .16]) add(leg, 'bolt', 'titanium', [x, .06, D.conveyorZ + dz], [.008, .012, .008], [0, 0, 0], true);
  }

  for (const [index, [x, z]] of [[-1.00, 1.08], [1.00, 1.08], [-1.00, 1.68], [1.00, 1.68]].entries()) {
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

  const stop = part('conveyor.stop', 'Workpiece stop and presence sensor', 'Conveyor',
    'Positions the workpiece at the pick station.',
    'A pale stop plate, two dark buffers and a teal presence sensor face the arriving part.', undefined, [0, .03, 0], 'Pale stop plate and teal sensor');
  plate(stop, 'shell', [.88, .78, D.conveyorZ], [.03, .22, .50]);
  for (const z of [-.18, .18]) add(stop, 'cylinder', 'rubber', [.87, .70, D.conveyorZ + z], [.025, .035, .025], [Math.PI / 2, 0, 0]);
  add(stop, 'box', 'teal', [.86, .86, D.conveyorZ], [.02, .06, .10]);
  for (const side of [-1, 1]) rod(stop, 'dark', [.88, .64, D.conveyorZ + side * .22], [.82, .54, D.conveyorZ + side * .30], .008);

  const workpiece = part('conveyor.workpiece', 'Inspection workpiece and fixture', 'Conveyor',
    'Provides the part that the robot gripper is positioned over.',
    'A pale machined block, a brass core, four bolt holes and a dark fixture plate sit on the belt at the pick station.', undefined, [0, .03, 0], 'Pale machined block and brass core');
  plate(workpiece, 'shell', [D.workX, .75, D.conveyorZ], [.18, .14, .18]);
  plate(workpiece, 'brass', [D.workX, .70, D.conveyorZ], [.20, .025, .20]);
  for (const x of [-.06, .06]) for (const z of [-.06, .06]) add(workpiece, 'ring', 'dark', [D.workX + x, .825, D.conveyorZ + z], [.018, .018, .018], [Math.PI / 2, 0, 0], true);
  for (const x of [-.12, .12]) plate(workpiece, 'titanium', [D.workX + x, .73, D.conveyorZ], [.02, .08, .22]);

  const guards = part('conveyor.guards', 'Belt edge guards', 'Conveyor',
    'Keeps hands and parts away from the roller nip.',
    'Two pale angle guards with brass fasteners run above both belt edges and leave the part readable.', undefined, [0, .03, 0], 'Pale edge guards and brass fasteners');
  for (const side of [-1, 1]) {
    plate(guards, 'shell', [0, .78, D.conveyorZ + side * .40], [2.46, .10, .03], [0, 0, side * .25]);
    for (let i = 0; i < 5; i++) add(guards, 'bolt', 'brass', [-1.0 + i * .5, .78, D.conveyorZ + side * .40], [.007, .012, .007], [0, 0, 0], true);
  }

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

  const scanner = part('cell.scanner', 'Safety laser scanner', 'Safety cell',
    'Watches the floor in front of the robot.',
    'A dark scanner head, a teal window and a brass mounting block sit on a short post at the cell corner.', undefined, [0, .03, 0], 'Dark scanner head and teal window');
  rod(scanner, 'titanium', [-1.85, .02, 1.48], [-1.85, .55, 1.48], .020);
  plate(scanner, 'dark', [-1.85, .60, 1.48], [.16, .18, .14]);
  plate(scanner, 'lens', [-1.85, .62, 1.56], [.12, .10, .015]);
  add(scanner, 'box', 'brass', [-1.85, .51, 1.48], [.08, .04, .08]);

  const tray = part('cell.cable-tray', 'Controller cable tray and conduit', 'Controller',
    'Routes power and encoder cables from the cabinet.',
    'A dark tray, three copper conduits and four brass clips run from the cabinet toward the robot base.', undefined, [0, .03, 0], 'Dark tray and copper conduits');
  rod(tray, 'dark', [-2.40, .18, .48], [-.62, .18, .48], .035);
  for (const z of [.42, .48, .54]) rod(tray, 'copper', [-2.40, .22, z], [-.62, .22, z], .006, true);
  for (let i = 0; i < 4; i++) add(tray, 'ring', 'brass', [-2.10 + i * .50, .22, .48], [.025, .025, .025], [Math.PI / 2, 0, 0], true);

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

  // ---------------------------------------------------------------- robot
  const yaw = new THREE.Group(); yaw.name = 'robot-yaw'; yaw.position.y = D.baseY; kit.assemblies.add(yaw);
  const turntable = part('robot.turntable', 'Axis 1 turntable and ring gear', 'Robot base',
    'Rotates the complete arm about the vertical axis.',
    'A dark turntable, a 24-tooth brass ring gear and six bearing blocks turn above the fixed pedestal.', yaw, [0, .03, 0], 'Dark turntable and brass ring gear');
  axial(turntable, 'titanium', [0, .03, 0], .36, .10, 'y');
  kit.gear(turntable, .30, 24, .035, 'brass');
  for (let i = 0; i < 6; i++) add(turntable, 'bolt', 'titanium', [.31 * Math.cos(i * TAU / 6), .07, .31 * Math.sin(i * TAU / 6)], [.012, .018, .012], [0, 0, 0], true);

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

  const upper = part('robot.upper-arm', 'Axis 3 upper arm and cable conduit', 'Robot arm',
    'Places the elbow through the 850 mm upper link.',
    'Twin titanium rails, eight dark braces, two brass end bosses and a side cable conduit form one rigid upper arm.', yaw, [0, .05, 0], 'Twin rails and copper cable conduit');
  for (const x of [-.075, .075]) rod(upper, 'titanium', [x, .02, 0], [x, D.upper - .02, 0], .018);
  for (let i = 0; i <= 7; i++) plate(upper, 'dark', [0, .06 + i * .105, 0], [.17, .028, .08]);
  for (const y of [0, D.upper]) { add(upper, 'ring', 'brass', [0, y, 0], [.050, .050, .050], [0, Math.PI / 2, 0]); axial(upper, 'titanium', [0, y, 0], .024, .19); }
  rod(upper, 'copper', [.105, .10, .02], [.105, D.upper - .08, .02], .007, true);
  plate(upper, 'teal', [0, .42, .09], [.09, .14, .012], [0, 0, 0], true);

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

  const wrist = part('robot.wrist', 'Axis 6 wrist housing and flange', 'Robot arm',
    'Orients the gripper through a 220 mm wrist link.',
    'A dark wrist housing, a brass bearing ring and a pale flange plate carry the tool centre point.', yaw, [0, .05, 0], 'Dark housing and brass bearing ring');
  axial(wrist, 'dark', [0, .11, 0], .075, .22, 'y');
  add(wrist, 'ring', 'brass', [0, .02, 0], [.08, .08, .08], [Math.PI / 2, 0, 0]);
  plate(wrist, 'shell', [0, .20, 0], [.15, .04, .15]);

  const flange = part('robot.flange', 'Tool flange and dowel pins', 'Robot tool',
    'Locates the gripper on the wrist.',
    'A circular flange, four brass dowels and a central cable pass-through sit at the tool centre point.', yaw, [0, .05, 0], 'Circular flange and brass dowels');
  axial(flange, 'titanium', [0, .015, 0], .085, .03, 'y');
  for (let i = 0; i < 4; i++) add(flange, 'bolt', 'brass', [.055 * Math.cos(i * TAU / 4), .033, .055 * Math.sin(i * TAU / 4)], [.008, .018, .008]);
  axial(flange, 'dark', [0, .02, 0], .028, .04, 'y');

  const gripper = part('robot.gripper', 'Parallel gripper body and guide rails', 'Robot tool',
    'Converts the tool flange into two parallel jaws.',
    'A dark body, two titanium guide rails, a brass drive screw and a teal jaw sensor form the parallel gripper.', yaw, [0, .05, 0], 'Dark body and titanium guide rails');
  plate(gripper, 'dark', [0, .07, 0], [.20, .11, .10]);
  for (const x of [-.075, .075]) rod(gripper, 'titanium', [x, .02, 0], [x, .13, 0], .007);
  rod(gripper, 'brass', [0, .06, .06], [0, .06, -.06], .008);
  plate(gripper, 'teal', [0, .11, .052], [.06, .03, .012]);

  const toolRing = part('robot.tool-ring', 'Tool changer ring and locking balls', 'Robot tool',
    'Shows the quick-change interface between wrist and gripper.',
    'A brass locking ring, six dark ball detents and a pale index mark sit between the flange and the gripper body.', flange, [0, .03, 0], 'Brass locking ring and dark detents');
  add(toolRing, 'ring', 'brass', [0, .035, 0], [.075, .075, .075], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) add(toolRing, 'sphere', 'dark', [.058 * Math.cos(i * TAU / 6), .035, .058 * Math.sin(i * TAU / 6)], [.009, .009, .009], [0, 0, 0], true);
  plate(toolRing, 'shell', [.058, .035, 0], [.02, .012, .02], [0, 0, 0], true);

  const camera = part('robot.wrist-camera', 'Wrist inspection camera and lamp', 'Robot tool',
    'Looks down between the gripper jaws.',
    'A dark camera body, a teal lens, a brass bezel and two pale lamp pads are mounted above the guide rails.', gripper, [0, .03, 0], 'Dark camera body and teal lens');
  plate(camera, 'dark', [0, .15, .075], [.10, .055, .05]);
  add(camera, 'sphere', 'lens', [0, .15, .105], [.026, .022, .012]);
  add(camera, 'ring', 'brass', [0, .15, .100], [.030, .030, .030], [0, 0, 0]);
  for (const x of [-.036, .036]) add(camera, 'box', 'shell', [x, .15, .102], [.024, .012, .010], [0, 0, 0], true);

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

  const upperCable = part('robot.upper-cable', 'Upper arm cable pack', 'Robot arm',
    'Shows the dress pack that follows the upper arm.',
    'A dark flexible conduit, four brass clamps and a copper service loop run along the outside of the upper arm.', upper, [0, .04, 0], 'Dark conduit and brass clamps');
  for (const y of [.18, .38, .58, .74]) add(upperCable, 'ring', 'brass', [.115, y, .02], [.022, .022, .022], [0, Math.PI / 2, 0]);
  rod(upperCable, 'dark', [.115, .08, .02], [.115, .80, .02], .013);

  const forearmCable = part('robot.forearm-cable', 'Forearm sensor lead and clamp', 'Robot arm',
    'Carries the wrist encoder lead along the forearm.',
    'A dark lead, two brass clamps and a teal connector follow the forearm without crossing the wrist axis.', forearm, [0, .04, 0], 'Dark lead and teal connector');
  rod(forearmCable, 'dark', [.092, .10, -.02], [.092, .70, -.02], .007);
  for (const y of [.20, .48]) add(forearmCable, 'ring', 'brass', [.092, y, -.02], [.017, .017, .017], [0, Math.PI / 2, 0]);
  plate(forearmCable, 'teal', [.092, .70, -.02], [.035, .05, .035]);

  const balanceMount = part('robot.balance-mount', 'Counterbalance anchor and clevis', 'Robot arm',
    'Anchors the gas counterbalance to the turntable and upper arm.',
    'Two dark clevises, a brass pin and four bolted pads attach the spring cylinder without crossing the shoulder axis.', yaw, [0, .04, 0]);
  add(balanceMount, 'box', 'dark', [0, .20, -.18], [.16, .10, .10]);
  for (const side of [-1, 1]) add(balanceMount, 'ring', 'brass', [side * .045, .22, -.20], [.045, .045, .045], [0, Math.PI / 2, 0]);
  for (const half of ['barrel', 'rod']) {
    const node = part(`robot.balance.${half}`, `Gas counterbalance ${half}`, 'Robot arm',
      'Shows the spring that supports the arm weight.',
      'A telescoping dark barrel and pale piston are drawn between the turntable clevis and the sampled upper-arm anchor; no gas force is solved.', yaw, [0, .06, 0], half === 'barrel' ? 'Dark gas barrel' : 'Pale piston rod');
    add(node, 'cylinder', half === 'barrel' ? 'dark' : 'titanium', [0, .5, 0], [half === 'barrel' ? .045 : .026, 1, half === 'barrel' ? .045 : .026]);
    add(node, 'ring', 'brass', [0, .02, 0], [half === 'barrel' ? .052 : .032, half === 'barrel' ? .052 : .032, half === 'barrel' ? .052 : .032], [0, 0, 0]);
    cylinders.push({ half, node });
  }

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

  for (const [parent, x, y, z, name, side] of [
    [upper, 0, .02, 0, 'shoulder cover', 1], [forearm, 0, .02, 0, 'elbow cover', -1], [wrist, 0, .02, 0, 'wrist cover', 1],
  ]) {
    const cover = part(`robot.cover.${name.replace(' ', '-')}`, `Robot ${name}`, 'Robot arm',
      'Covers the joint bearing while leaving the axis pin visible.',
      'A pale shell cap, a brass rim and two dark isolators sit over the servo bearing without hiding the pin.', parent, [0, .03, 0], 'Pale shell cap and brass rim');
    cover.position.set(x, y, z);
    add(cover, 'sphere', 'shell', [0, 0, 0], [.13, .07, .13]);
    add(cover, 'ring', 'brass', [0, 0, 0], [.12, .12, .12], [Math.PI / 2, 0, 0]);
    for (const dx of [-.08, .08]) add(cover, 'cylinder', 'dark', [dx, 0, 0], [.010, .03, .010], [0, 0, Math.PI / 2], true);
  }

  const plaque = part('cell.nameplate', 'FABER R6 cell identification plate', 'Cell',
    'Identifies the robot cell on the fence.',
    'A teal plate, three brass studs and two titanium screws are fixed to the rear safety rail.', undefined, [0, .03, 0]);
  plate(plaque, 'teal', [0, 1.62, -1.44], [.34, .08, .012]);
  for (let i = 0; i < 3; i++) add(plaque, 'bolt', 'brass', [-.10 + i * .10, 1.62, -1.425], [.008, .012, .008], [Math.PI / 2, 0, 0], true);

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.arm && state?.gripper && state?.counterbalance) lastState = state;
    else if (Number.isFinite(state?.phase)) lastState = poseAt(state.phase * TAU, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    yaw.rotation.y = pose.arm.slew;
    elbow.position.fromArray(local(pose.arm.elbowPoint));
    aim(upper, local(pose.arm.shoulderPoint), local(pose.arm.elbowPoint));
    aim(forearm, local(pose.arm.elbowPoint), local(pose.arm.wristPoint));
    aim(wrist, local(pose.arm.wristPoint), local(pose.arm.flangePoint));
    const raw = [pose.arm.toolTip[0] - pose.arm.flangePoint[0], pose.arm.toolTip[1] - pose.arm.flangePoint[1], pose.arm.toolTip[2] - pose.arm.flangePoint[2]];
    const rawLength = Math.max(1e-9, Math.hypot(raw[0], raw[1], raw[2])), direction = raw.map(value => value / rawLength);
    const toolBase = pose.arm.flangePoint, toolEnd = [toolBase[0] + direction[0] * .06, toolBase[1] + direction[1] * .06, toolBase[2] + direction[2] * .06];
    aim(flange, local(toolBase), local(toolEnd));
    const gripBase = [toolBase[0] + direction[0] * .07, toolBase[1] + direction[1] * .07, toolBase[2] + direction[2] * .07];
    const gripEnd = [gripBase[0] + direction[0] * .12, gripBase[1] + direction[1] * .12, gripBase[2] + direction[2] * .12];
    aim(gripper, local(gripBase), local(gripEnd));
    for (const record of fingers) record.node.position.x = record.side * pose.gripper.spread;
    for (const record of rollers) record.node.rotation.z = pose.drive.rollerAngle;
    for (const record of cylinders) {
      const data = pose.counterbalance;
      if (record.half === 'barrel') {
        const mid = [data.anchor[0] + (data.upperAnchor[0] - data.anchor[0]) * .55, data.anchor[1] + (data.upperAnchor[1] - data.anchor[1]) * .55, data.anchor[2] + (data.upperAnchor[2] - data.anchor[2]) * .55];
        aim(record.node, local(data.anchor), local(mid));
        record.node.scale.y = Math.max(.001, Math.hypot(mid[0] - data.anchor[0], mid[1] - data.anchor[1], mid[2] - data.anchor[2]));
      } else {
        const mid = [data.anchor[0] + (data.upperAnchor[0] - data.anchor[0]) * .55, data.anchor[1] + (data.upperAnchor[1] - data.anchor[1]) * .55, data.anchor[2] + (data.upperAnchor[2] - data.anchor[2]) * .55];
        aim(record.node, local(mid), local(data.upperAnchor));
        record.node.scale.y = Math.max(.001, Math.hypot(data.upperAnchor[0] - mid[0], data.upperAnchor[1] - mid[1], data.upperAnchor[2] - mid[2]));
      }
    }
    for (const record of labels) if (record.kind === 'fan') record.node.rotation.x = pose.drive.fanAngle;
    kit.sync(options);
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
