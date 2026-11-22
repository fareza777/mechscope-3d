import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, DEFAULT_INPUTS, TAU, cycleHz, poseAt, sample } from './kin.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createModel() {
  const kit = createMechanicalKit('AQUILA TR-9 · tilt-rotor aircraft');
  const add = kit.add, rod = kit.rod, aim = kit.aim;
  let disposed = false, lastState = sample(0);
  const part = (id, name, system, purpose, how, parent, explode = [0, .1, 0], material = 'Painted composite skin over machined alloy frames') =>
    kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
  const group = (parent, p = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...p); parent.add(g); return g; };
  const box = (n, m, p, s, e = [0, 0, 0], d = false) => add(n, 'box', m, p, s, e, d);
  const ell = (n, m, p, s, e = [0, 0, 0], d = false) => add(n, 'sphere', m, p, s, e, d);
  const EULER = { x: [0, 0, Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] };
  const cyl = (n, m, p, r, len, axis = 'y', d = false, r2 = r) => add(n, 'cylinder', m, p, [r, len, r2], EULER[axis], d);
  const ringAt = (n, m, p, r, axis = 'y', d = false) => add(n, 'ring', m, p, [r, r, r], axis === 'y' ? [Math.PI / 2, 0, 0] : axis === 'x' ? [0, Math.PI / 2, 0] : [0, 0, 0], d);
  // Telescoping ram made of a fixed barrel and a fixed rod aimed at each other.
  const rams = [];
  const ram = (id, name, system, purpose, parent, lb, lr, r = .016) => {
    const barrel = part(`${id}.barrel`, `${name} barrel`, system, purpose, 'A fixed-length barrel is aimed from its anchor pin toward the moving pin; the rod slides inside it, so the stroke follows the sampled pin distance.', parent, [0, .04, 0], 'Anodised barrel and seals');
    cyl(barrel, 'brass', [0, lb / 2, 0], r, lb); cyl(barrel, 'dark', [0, .012, 0], r * 1.5, .024); ringAt(barrel, 'dark', [0, lb, 0], r * 1.1, 'y', true);
    const piston = part(`${id}.rod`, `${name} rod`, system, purpose, 'A fixed-length chrome rod is aimed from the moving pin back into the barrel, so barrel and rod overlap at every pose.', parent, [0, .04, 0], 'Hard-chromed steel rod');
    cyl(piston, 'titanium', [0, lr / 2, 0], r * .55, lr); cyl(piston, 'dark', [0, .01, 0], r * 1.3, .02);
    rams.push({ id, barrel, piston }); return { barrel, piston };
  };
  const telescope = (r, a, b) => { aim(r.barrel, a, b); aim(r.piston, b, a); };

  const airframe = group(kit.assemblies); airframe.name = 'airframe';
  // ---------------------------------------------------------------- fuselage
  const cabin = part('fuselage.cabin', 'Cabin barrel and keel', 'Fuselage',
    'Carries the crew, troops, cargo floor, wing fairing, sponsons and both gear bays.',
    'An elliptical composite barrel over a flat-bottomed keel box, teal lightning strips and external frame stiffeners form the 1.66 m cabin.', airframe, [0, 0, 0]);
  cyl(cabin, 'shell', [0, .56, .02], .29, 1.66, 'z', false, .30);
  box(cabin, 'shell', [0, .38, .02], [.54, .24, 1.66]);
  box(cabin, 'dark', [0, .262, .02], [.40, .016, 1.5]);
  for (const s of [-1, 1]) {
    box(cabin, 'teal', [s * .292, .60, .05], [.012, .045, 1.62]);
    box(cabin, 'teal', [s * .274, .42, .05], [.012, .02, 1.62]);
    for (const z of [-.66, -.36, -.06, .24, .54]) box(cabin, 'titanium', [s * .276, .34, z], [.01, .12, .014], [0, 0, 0], true);
  }
  for (const z of [-.70, -.20, .30, .70]) add(cabin, 'bolt', 'titanium', [0, .866, z], [.012, .008, .012], [0, 0, 0], true);
  const windows = part('fuselage.windows', 'Cabin windows and formation lights', 'Fuselage',
    'Lights the cabin and marks the airframe outline for night formation flying.',
    'Six flush lens panels sit in the cabin walls and two electroluminescent strips run along the upper fuselage shoulders.', airframe, [0, 0, 0], 'Stretched acrylic and lens strips');
  for (const s of [-1, 1]) {
    for (const z of [-.55, -.25, .05]) box(windows, 'lens', [s * .289, .62, z], [.012, .075, .10]);
    box(windows, 'lens', [s * .21, .80, -.25], [.008, .012, .50], [0, 0, s * .8], true);
  }
  const nose = part('fuselage.nose', 'Nose section and radome', 'Fuselage',
    'Houses the weather radar, avionics bay and nose-gear well ahead of the cockpit.',
    'A long ellipsoidal shell blends into the cabin barrel; a dark radome cap and twin pitot probes finish the tip.', airframe, [0, 0, .12]);
  ell(nose, 'shell', [0, .53, .85], [.29, .27, .70]);
  ell(nose, 'dark', [0, .50, 1.47], [.09, .09, .10]);
  for (const s of [-1, 1]) rod(nose, 'titanium', [s * .13, .47, 1.40], [s * .15, .47, 1.60], .006, true);
  box(nose, 'teal', [0, .30, 1.10], [.06, .01, .34], [-.12, 0, 0]);
  const glazing = part('cockpit.glazing', 'Cockpit glazing and frame', 'Cockpit',
    'Gives the two pilots a wide forward, side and downward view for vertical landings.',
    'A tinted wrap-around canopy sits on the nose shoulder; a dark centre post, side posts and a brow frame carry the panes.', airframe, [0, .08, .06], 'Laminated glass and dark alloy posts');
  ell(glazing, 'lens', [0, .68, 1.02], [.245, .17, .37]);
  rod(glazing, 'dark', [0, .855, .98], [0, .74, 1.34], .009);
  for (const s of [-1, 1]) {
    rod(glazing, 'dark', [s * .21, .72, 1.20], [s * .15, .83, 1.00], .008);
    rod(glazing, 'dark', [s * .23, .69, .86], [s * .16, .82, .82], .008);
  }
  box(glazing, 'dark', [0, .845, .76], [.36, .02, .05]);
  const aft = part('fuselage.aft', 'Aft fuselage and tail boom', 'Fuselage',
    'Carries the empennage and frames the open cargo door when the ramp is down.',
    'An upswept upper shell, two tapered side walls and a tail-boom fairing leave the lower half open for the ramp and upper cargo door.', airframe, [0, .02, -.12]);
  ell(aft, 'shell', [0, .78, -.95], [.28, .17, .85], [.12, 0, 0]);
  box(aft, 'shell', [0, .88, -1.58], [.22, .12, .40]);
  for (const s of [-1, 1]) {
    box(aft, 'shell', [s * .255, .60, -1.08], [.035, .40, .60], [.30, 0, 0]);
    box(aft, 'teal', [s * .275, .66, -1.04], [.008, .03, .56], [.30, 0, 0]);
    box(aft, 'dark', [s * .245, .50, -.80], [.04, .46, .03]);
  }
  box(aft, 'dark', [0, .78, -.80], [.50, .04, .03]);
  const cargo = part('cabin.cargo', 'Cargo floor, pallet and rescue stores', 'Cabin',
    'Provides the roller floor, a lashed pallet and fold-down troop seats inside the cabin.',
    'A dark roller floor, a titanium pallet with three teal stores crates and two rows of rubber seats are lashed to the cabin structure.', airframe, [0, .06, -.08], 'Roller floor, titanium pallet and webbing seats');
  box(cargo, 'dark', [0, .272, -.40], [.46, .02, 1.10]);
  box(cargo, 'titanium', [0, .29, -.62], [.34, .02, .40]);
  for (const [x, y, z, w, h, l] of [[-.08, .35, -.52, .14, .10, .16], [.09, .345, -.58, .12, .09, .18], [0, .34, -.74, .26, .08, .12]]) box(cargo, 'teal', [x, y, z], [w, h, l]);
  for (const s of [-1, 1]) for (let i = 0; i < 4; i++) box(cargo, 'rubber', [s * .20, .36, -.30 + i * .17], [.08, .02, .13], [0, 0, 0], true);
  for (const s of [-1, 1]) {
    const id = s < 0 ? 'L' : 'R', label = s < 0 ? 'left' : 'right';
    const sp = part(`fuselage.sponson.${id}`, `${label} sponson`, 'Fuselage',
      'Stores fuel and hides the main landing gear outside the cabin floor.',
      'A long ellipsoidal fairing, a gravity filler cap, a boarding step and a teal stripe wrap the gear bay and fuel cell.', airframe, [s * .12, 0, 0]);
    ell(sp, 'shell', [s * .31, .36, .05], [.13, .13, .62]);
    box(sp, 'teal', [s * .43, .38, .05], [.01, .025, .80], [0, 0, 0]);
    add(sp, 'bolt', 'brass', [s * .36, .48, -.25], [.02, .01, .02], [0, 0, s * .4], true);
    box(sp, 'dark', [s * .41, .30, -.32], [.05, .015, .08], [0, 0, 0], true);
  }
  // ---------------------------------------------------------------- empennage
  const stab = part('tail.stabilizer', 'Horizontal stabiliser', 'Empennage',
    'Provides pitch stability in airplane mode and carries both vertical fins.',
    'A thin composite plane is bolted across the tail-boom fairing, with dark end caps and formation light strips at each tip.', airframe, [0, .12, -.08]);
  box(stab, 'shell', [0, .92, -1.61], [1.24, .035, .24]);
  for (const s of [-1, 1]) { box(stab, 'dark', [s * .62, .92, -1.61], [.05, .045, .26]); box(stab, 'lens', [s * .40, .94, -1.55], [.18, .006, .02], [0, 0, 0], true); }
  const elevator = part('tail.elevator', 'Elevator', 'Empennage',
    'Trims and controls pitch while the rotors are tilted forward.',
    'A full-span teal surface hinges on the stabiliser trailing edge and sweeps through the pre-flight control check.', airframe, [0, .1, -.14]);
  elevator.position.set(0, .92, -1.73);
  box(elevator, 'teal', [0, 0, -.05], [1.12, .026, .10]);
  for (const x of [-.4, 0, .4]) cyl(elevator, 'titanium', [x, 0, 0], .012, .08, 'x', true);
  const rudders = [];
  for (const s of [-1, 1]) {
    const id = s < 0 ? 'L' : 'R', label = s < 0 ? 'left' : 'right';
    const fin = part(`tail.fin.${id}`, `${label} vertical fin`, 'Empennage',
      'Gives directional stability and end-plates the horizontal stabiliser.',
      'A tall composite fin with a rounded cap, a leading-edge strip and a lens anti-collision light rises from each stabiliser tip.', airframe, [s * .16, .12, -.08]);
    box(fin, 'shell', [s * .62, 1.0, -1.60], [.035, .56, .28]);
    ell(fin, 'shell', [s * .62, 1.28, -1.60], [.018, .03, .14]);
    box(fin, 'teal', [s * .62, 1.0, -1.46], [.04, .52, .012]);
    box(fin, 'lens', [s * .62, 1.30, -1.56], [.02, .02, .05]);
    const rudder = part(`tail.rudder.${id}`, `${label} rudder`, 'Empennage',
      'Controls yaw in airplane mode and coordinates the banked turn.',
      'A teal surface on three titanium hinges swings about the fin trailing edge, mirrored on both fins.', airframe, [s * .2, .12, -.16]);
    rudder.position.set(s * .62, 1.0, -1.74);
    box(rudder, 'teal', [0, 0, -.05], [.026, .50, .10]);
    for (const y of [-.18, 0, .18]) cyl(rudder, 'titanium', [0, y, 0], .012, .05, 'y', true);
    rudders.push(rudder);
  }
  // ---------------------------------------------------------------- ramp and doors
  const ramp = part('ramp.door', 'Aft loading ramp', 'Cargo system',
    'Closes the lower tail and lowers to the ground so vehicles and stretchers can roll aboard.',
    'A ribbed composite ramp hinges on the cabin floor; two rams lower it until its toe plates rest exactly on the ground.', airframe, [0, -.06, -.14]);
  ramp.position.fromArray(D.rampHinge);
  box(ramp, 'shell', [0, 0, -.33], [.48, .035, .66]);
  box(ramp, 'dark', [0, .02, -.33], [.40, .01, .60]);
  for (let i = 0; i < 5; i++) box(ramp, 'titanium', [0, .03, -.08 - i * .12], [.38, .008, .015], [0, 0, 0], true);
  for (const s of [-1, 1]) box(ramp, 'dark', [s * .14, -.01, -.66], [.12, .02, .06]);
  cyl(ramp, 'titanium', [0, 0, 0], .022, .46, 'x');
  const upperDoor = part('ramp.upperDoor', 'Upper cargo door', 'Cargo system',
    'Closes the top of the aft opening and retracts into the tail when loading.',
    'A curved panel hinges below the tail boom and swings up and forward inside the aft fuselage as the ramp lowers.', airframe, [0, .08, -.1]);
  box(upperDoor, 'shell', [0, 0, -.21], [.44, .03, .42]);
  box(upperDoor, 'teal', [0, -.018, -.21], [.30, .006, .30]);
  cyl(upperDoor, 'titanium', [0, 0, 0], .018, .40, 'x');
  const rampRams = [-1, 1].map(s => ram(`ramp.actuator.${s < 0 ? 'L' : 'R'}`, `${s < 0 ? 'left' : 'right'} ramp actuator`, 'Cargo system',
    'Lowers and raises the loading ramp against its hinge line.', airframe, .30, .30, .015));
  const crewDoor = part('cabin.crewDoor', 'Sliding crew door', 'Cabin',
    'Opens the forward right cabin side for boarding and the rescue hoist.',
    'A plug door with a viewing window slides aft on upper and lower rails; it opens on the ground and again for the hover hoist.', airframe, [.14, 0, 0]);
  box(crewDoor, 'shell', [0, 0, 0], [.022, .40, .26]);
  box(crewDoor, 'lens', [.012, .08, 0], [.006, .09, .12]);
  box(crewDoor, 'dark', [.014, -.06, .09], [.01, .02, .05], [0, 0, 0], true);
  const rails = part('cabin.doorRails', 'Crew door rails', 'Cabin',
    'Guide the sliding crew door along the outside of the cabin.',
    'Two titanium rails with dark end stops run aft from the door frame above and below the opening.', airframe, [.08, 0, 0], 'Titanium rails and dark stops');
  for (const y of [.74, .31]) { rod(rails, 'titanium', [.300, y, .22], [.300, y, .78], .006); for (const z of [.22, .78]) box(rails, 'dark', [.302, y, z], [.012, .02, .02], [0, 0, 0], true); }
  const hoistMotor = part('hoist.motor', 'Rescue hoist motor', 'Rescue hoist',
    'Drives the hoist drum and swings the boom out over the open crew door.',
    'A dark motor housing with a brass drum cap is bolted to a roof pad above the door, holding the boom pivot.', airframe, [.1, .06, 0], 'Dark motor housing and brass drum');
  box(hoistMotor, 'dark', [.25, .90, .60], [.08, .07, .12]);
  cyl(hoistMotor, 'brass', [.25, .90, .53], .03, .03, 'z');
  const hoistBoom = part('hoist.boom', 'Hoist boom and sheave', 'Rescue hoist',
    'Holds the cable clear of the fuselage during a hover rescue.',
    'A square boom rotates 90° on its pivot from a stowed forward position to point outboard, ending in a sheave over the door.', airframe, [.12, .08, 0]);
  hoistBoom.position.fromArray(D.hoistPivot);
  cyl(hoistBoom, 'dark', [0, 0, 0], .03, .07);
  box(hoistBoom, 'titanium', [0, 0, .12], [.032, .032, .24]);
  ringAt(hoistBoom, 'brass', [0, -.03, D.hoistBoom], .022, 'x');
  const cable = part('hoist.cable', 'Hoist cable', 'Rescue hoist',
    'Lowers and recovers the rescue basket from the hovering aircraft.',
    'A steel cable pays out from the sheave so the basket descends to 0.30 m above the ground and returns before conversion.', airframe, [.12, 0, 0], 'Braided steel cable');
  cyl(cable, 'dark', [0, -.5, 0], .004, 1);
  const basket = part('hoist.basket', 'Rescue basket', 'Rescue hoist',
    'Carries a survivor or stores between the ground and the cabin door.',
    'A teal floor, titanium frame hoops and a brass swivel hook hang from the end of the hoist cable.', airframe, [.12, -.04, 0], 'Teal floor and titanium frame');
  add(basket, 'bolt', 'brass', [0, -.015, 0], [.012, .03, .012]);
  box(basket, 'teal', [0, -.13, 0], [.16, .02, .10]);
  for (const [x, z] of [[-.07, -.04], [.07, -.04], [-.07, .04], [.07, .04]]) rod(basket, 'titanium', [0, -.03, 0], [x, -.12, z], .004);
  box(basket, 'titanium', [0, -.08, 0], [.17, .006, .11], [0, 0, 0], true);
  // ---------------------------------------------------------------- nose systems
  const probeBase = part('nose.probeBase', 'Refuelling probe housing', 'Nose systems',
    'Holds the telescoping in-flight refuelling probe beside the cockpit.',
    'A titanium housing tube with two bolted brackets runs along the right nose shoulder.', airframe, [.1, 0, .06], 'Titanium tube and brackets');
  cyl(probeBase, 'titanium', [.25, .66, 1.02], .026, .36, 'z');
  for (const z of [.90, 1.12]) box(probeBase, 'dark', [.235, .66, z], [.03, .03, .03], [0, 0, 0], true);
  const probeTip = part('nose.probeTip', 'Telescoping refuelling probe', 'Nose systems',
    'Extends ahead of the rotor disc to reach a tanker drogue in airplane mode.',
    'A slender inner tube slides 0.35 m forward out of the housing during cruise and retracts before reconversion.', airframe, [.1, 0, .1], 'Chromed tube and brass nozzle');
  cyl(probeTip, 'titanium', [.25, .66, 1.24], .016, .40, 'z');
  add(probeTip, 'cone', 'brass', [.25, .66, 1.46], [.022, .05, .022], [Math.PI / 2, 0, 0]);
  const flir = part('nose.flir', 'Chin sensor turret', 'Nose systems',
    'Scans the landing zone with infrared and day cameras.',
    'A gimballed ball turret yaws and tilts continuously under the nose on a dark mounting collar.', airframe, [0, -.08, .04], 'Dark gimbal and lens windows');
  flir.position.set(0, .27, 1.28);
  cyl(flir, 'dark', [0, .04, 0], .045, .03);
  ell(flir, 'dark', [0, 0, 0], [.06, .06, .06]);
  box(flir, 'lens', [0, 0, .055], [.05, .025, .012]);
  const beacons = [];
  for (const [id, label, y, z, s] of [['beacon.upper', 'Upper anti-collision beacon', .88, -.45, 1], ['beacon.lower', 'Lower anti-collision beacon', .245, -.15, -1]]) {
    const beacon = part(id, label, 'Lighting', 'Flashes a rotating warning beam whenever the engines run.',
      'A lens dome covers a brass reflector that rotates continuously on a dark base.', airframe, [0, s * .06, 0], 'Lens dome and brass reflector');
    beacon.position.set(0, y, z);
    cyl(beacon, 'dark', [0, 0, 0], .035, .02);
    ell(beacon, 'lens', [0, s * .02, 0], [.028, .03, .028]);
    box(beacon, 'brass', [0, s * .02, 0], [.05, .012, .012]);
    beacons.push({ node: beacon, sign: s });
  }
  // ---------------------------------------------------------------- wing stow drive
  const fairing = part('fuselage.wingFairing', 'Wing stow fairing', 'Wing stow',
    'Streamlines the wing joint and carries the stow bearing above the cabin.',
    'A flat-topped fairing with rounded ends sits on the cabin roof under the wing centre section.', airframe, [0, .05, 0]);
  box(fairing, 'shell', [0, .885, .10], [.36, .07, .78]);
  for (const z of [-.30, .50]) ell(fairing, 'shell', [0, .87, z], [.18, .05, .14]);
  const bearing = part('stow.bearing', 'Wing stow bearing ring', 'Wing stow',
    'Lets the whole wing rotate 90° to lie along the fuselage for deck stowage.',
    'A dark bearing race, a titanium ball track and twelve bolts carry the wing centre on the fairing top.', airframe, [0, .1, 0], 'Bearing steel race and titanium track');
  cyl(bearing, 'dark', [0, .935, .10], .21, .03);
  ringAt(bearing, 'titanium', [0, .955, .10], .19);
  for (let i = 0; i < 12; i++) add(bearing, 'bolt', 'titanium', [.17 * Math.cos(i * TAU / 12), .952, .10 + .17 * Math.sin(i * TAU / 12)], [.01, .008, .01], [0, 0, 0], true);
  const pinion = part('stow.pinion', 'Wing stow drive pinion', 'Wing stow',
    'Turns the wing ring gear to stow and unstow the wing.',
    'A ten-tooth titanium pinion on the fairing meshes with the 36-tooth ring gear under the wing; it turns 3.6 times per wing quarter-turn ratio step.', airframe, [0, .14, -.06], 'Hardened titanium pinion');
  pinion.position.set(0, 1.00, D.wingPivot[2] - .23);
  kit.gear(pinion, .05, 10, .03, 'titanium');
  // ---------------------------------------------------------------- landing gear
  const gearParts = {};
  const gearSets = [{ id: 'nose', side: 0, label: 'nose', x: 0, span: .05 }, { id: 'L', side: -1, label: 'left main', span: .065 }, { id: 'R', side: 1, label: 'right main', span: .065 }];
  for (const g of gearSets) {
    const prefix = g.id === 'nose' ? 'gear.nose' : `gear.main.${g.id}`;
    const strut = part(`${prefix}.strut`, `${g.label} gear strut`, 'Landing gear',
      'Carries the aircraft on the ground and swings into its bay after lift-off.',
      'A dark trunnion casting and oleo cylinder pivot on the bay frame; the oleo extends 20 mm as weight leaves the wheels.', airframe, [g.side * .08, -.1, 0], 'Forged steel trunnion and oleo');
    cyl(strut, 'dark', [0, -.09, 0], .027, .18);
    cyl(strut, 'titanium', [0, 0, 0], .03, .10, 'x');
    rod(strut, 'titanium', [0, -.05, .04], [0, -.14, .045], .008, true);
    const wheels = part(`${prefix}.wheels`, `${g.label} twin wheels`, 'Landing gear',
      'Rolls and brakes the aircraft on the deck and carries the oleo piston.',
      'A chromed piston, torque-link lugs, an axle and two rubber tyres on titanium hubs move as one unit at the end of the strut.', strut, [0, -.06, 0], 'Rubber tyres, titanium hubs and chromed piston');
    cyl(wheels, 'titanium', [0, .07, 0], .017, .14);
    cyl(wheels, 'titanium', [0, 0, 0], .012, g.span * 2 + .05, 'x');
    for (const s of [-1, 1]) {
      cyl(wheels, 'rubber', [s * g.span, 0, 0], D.wheelRadius, .05, 'x');
      cyl(wheels, 'titanium', [s * (g.span + .022), 0, 0], .05, .012, 'x');
      for (let i = 0; i < 5; i++) add(wheels, 'bolt', 'dark', [s * (g.span + .03), .03 * Math.cos(i * TAU / 5), .03 * Math.sin(i * TAU / 5)], [.006, .006, .006], [0, 0, Math.PI / 2], true);
    }
    strut.position.fromArray(g.side ? [g.side * D.mainPivot[0], D.mainPivot[1], D.mainPivot[2]] : D.nosePivot);
    const doors = [-1, 1].map(s => {
      const sideId = s < 0 ? 'L' : 'R';
      const door = part(`${prefix}.door.${sideId}`, `${g.label} gear door ${sideId}`, 'Landing gear',
        'Closes the gear bay for a smooth underside in flight.',
        'A shallow composite door hinges on the bay edge and opens before the strut swings, closing again once it is stowed.', airframe, [s * .06, -.05, 0]);
      const width = g.side ? .08 : .09, length = g.side ? .36 : .30;
      const hinge = g.side ? [g.side * .31 + s * .08, .245, .30] : [s * .09, .29, 1.12];
      door.position.fromArray(hinge);
      box(door, 'shell', [-s * width / 2, 0, 0], [width, .012, length]);
      box(door, 'teal', [-s * width / 2, -.007, 0], [width * .6, .004, length * .8], [0, 0, 0], true);
      return { node: door, s };
    });
    const actuator = ram(`${prefix}.actuator`, `${g.label} retraction`, 'Landing gear', 'Swings the gear strut between its down-lock and its bay.', airframe, g.side ? .20 : .17, g.side ? .20 : .17, .012);
    gearParts[g.id] = { strut, wheels, doors, actuator, side: g.side };
  }
  // ---------------------------------------------------------------- wing
  const wing = group(airframe, D.wingPivot); wing.name = 'wing.frame';
  const centre = part('wing.centre', 'Wing centre section', 'Wing',
    'Joins both wing panels over the stow bearing and carries the mid-wing gearbox.',
    'A deep composite torque box with a rounded leading edge sits on the stow bearing and rotates with the whole wing.', wing, [0, .2, 0]);
  box(centre, 'shell', [0, 0, -.05], [.70, .075, .44]);
  cyl(centre, 'shell', [0, 0, .17], .037, .70, 'x');
  box(centre, 'teal', [0, .039, .05], [.50, .004, .04]);
  const ringGear = part('wing.ringGear', 'Wing stow ring gear', 'Wing stow',
    'Gives the stow pinion a 36-tooth gear to drive the wing around its bearing.',
    'A brass ring gear is bolted under the wing centre section concentric with the stow bearing.', wing, [0, .12, 0], 'Bronze ring gear');
  ringGear.position.set(0, -.06, 0);
  kit.gear(ringGear, .18, 36, .03, 'brass');
  const midGearbox = part('wing.midGearbox', 'Mid-wing gearbox', 'Drive system',
    'Links the two interconnect shafts so either engine can turn both rotors.',
    'A dark housing on the wing spar contains a cross-shaft gear; its cover is visible in X-ray and section views.', wing, [0, .24, 0], 'Cast magnesium housing');
  box(midGearbox, 'dark', [0, 0, -.02], [.16, .055, .12]);
  const midGearFrame = group(wing, [0, 0, -.02]); midGearFrame.rotation.z = Math.PI / 2;
  const midGear = part('wing.midGear', 'Mid-wing cross-shaft gear', 'Drive system',
    'Turns with the interconnect shafts as a visible proof that both rotors are geared together.',
    'A small brass spur gear spins on the shaft line inside the mid-wing gearbox.', midGearFrame, [.24, 0, 0], 'Bronze spur gear');
  kit.gear(midGear, .03, 10, .03, 'brass');
  const shafts = [], flaperons = [], conversion = [], nacelles = [];
  for (const s of [-1, 1]) {
    const id = s < 0 ? 'L' : 'R', label = s < 0 ? 'left' : 'right';
    const panel = part(`wing.panel.${id}`, `${label} wing panel`, 'Wing',
      'Lifts the aircraft in airplane mode and carries the nacelle on its tip.',
      'A forward torque box with a rounded leading edge, a fence, fuel filler and teal tip band runs from the centre section to the tip rib.', wing, [s * .2, .2, 0]);
    box(panel, 'shell', [s * .725, 0, -.05], [.75, .07, .44]);
    cyl(panel, 'shell', [s * .725, 0, .17], .035, .75, 'x');
    box(panel, 'dark', [s * .55, .045, -.02], [.008, .02, .36], [0, 0, 0], true);
    box(panel, 'teal', [s * .98, .037, -.05], [.06, .004, .42]);
    add(panel, 'bolt', 'brass', [s * .80, .038, .02], [.016, .006, .016], [0, 0, 0], true);
    const tip = part(`wing.tipRib.${id}`, `${label} tip rib and spindle housing`, 'Conversion system',
      'Carries the nacelle spindle bearing and the fixed end of the conversion actuator.',
      'A dark rib extends behind the trailing edge to an actuator lug; a titanium spindle housing holds the nacelle bearing.', wing, [s * .24, .2, 0], 'Dark machined rib and titanium housing');
    box(tip, 'dark', [s * 1.07, 0, -.12], [.06, .09, .62]);
    cyl(tip, 'titanium', [s * 1.11, 0, 0], .07, .10, 'x');
    box(tip, 'titanium', [s * (D.nacelleX + D.actuatorAnchor[0]), D.actuatorAnchor[1] - .02, D.actuatorAnchor[2]], [.05, .05, .05]);
    for (const [j, a, b] of [[1, .38, .68], [2, .70, 1.02]]) {
      const flap = part(`wing.flaperon.${id}${j}`, `${label} ${j === 1 ? 'inboard' : 'outboard'} flaperon`, 'Flight controls',
        'Droops in helicopter mode to reduce rotor download and rolls the aircraft in cruise.',
        'A teal trailing-edge surface hinges on two titanium brackets; it sweeps in the control check and deflects differentially in turns.', wing, [s * .2, .12, -.16]);
      flap.position.set(s * (a + b) / 2, 0, -.27);
      box(flap, 'teal', [0, 0, -.06], [b - a - .01, .032, .12]);
      for (const x of [-(b - a) * .3, (b - a) * .3]) box(flap, 'titanium', [x, -.02, .005], [.012, .03, .03], [0, 0, 0], true);
      flaperons.push({ node: flap, side: s });
    }
    const shaft = part(`wing.driveshaft.${id}`, `${label} interconnect drive shaft`, 'Drive system',
      'Ties the rotor gearbox on this tip to the mid-wing gearbox.',
      'A titanium tube with brass flexible couplings spins inside the wing at three times rotor speed.', wing, [s * .1, .26, 0], 'Titanium tube and brass couplings');
    shaft.position.set(s * .71, 0, -.02);
    cyl(shaft, 'titanium', [0, 0, 0], .013, .66, 'x');
    for (const x of [-.32, 0, .32]) { cyl(shaft, 'brass', [x, 0, 0], .024, .02, 'x'); box(shaft, 'dark', [x, .022, 0], [.016, .012, .012]); }
    shafts.push({ node: shaft, side: s });
    conversion.push({ side: s, ram: ram(`conversion.${id}`, `${label} conversion actuator`, 'Conversion system', 'Tilts the nacelle between airplane mode and helicopter mode.', wing, D.barrelLength, D.rodLength, .02) });
    // @@NACELLE@@
  }
  // @@UPDATE@@
}
