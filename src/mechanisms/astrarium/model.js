import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample } from './kin.js';

const ZODIAC = ['ARIES', 'TAURUS', 'GEMINI', 'CANCER', 'LEO', 'VIRGO', 'LIBRA', 'SCORPIO', 'SAGITTARIUS', 'CAPRICORN', 'AQUARIUS', 'PISCES'];

export function createModel() {
  const kit = createMechanicalKit('ASTRARIUM OR-9 · clockwork orrery');
  const nodes = [], arms = [], planets = [], moons = [], gears = [];
  const add = kit.add, rod = kit.rod;
  let disposed = false, lastState = sample(0);
  const part = (id, name, system, purpose, how, parent, explode = [0, .10, 0], material = 'Machined brass, titanium and pale alloy') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const ringArc = (node, radius, y, start, end, segments, material = 'brass', tube = .008, plane = 'horizontal') => {
    for (let k = 0; k < segments; k++) {
      const a = start + (end - start) * k / segments, b = start + (end - start) * (k + 1) / segments;
      const point = angle => plane === 'vertical'
        ? [0, radius * Math.cos(angle), radius * Math.sin(angle)]
        : [radius * Math.cos(angle), y, radius * Math.sin(angle)];
      rod(node, material, point(a), point(b), tube);
    }
  };
  const polar = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];

  // ---------------------------------------------------------------- base
  const plinth = part('base.plinth', 'Turned plinth and levelling collar', 'Foundation',
    'Grounds the instrument and hides the fixed drive pinion.',
    'A broad alloy disc, three rubber levelling pads and a brass collar carry the pedestal without touching the orbiting assembly.', undefined, [0, 0, 0]);
  add(plinth, 'cylinder', 'dark', [0, .045, 0], [.42, .09, .42]);
  add(plinth, 'cylinder', 'brass', [0, .10, 0], [.44, .022, .44]);
  add(plinth, 'cylinder', 'shell', [0, .145, 0], [.28, .07, .28]);
  for (let i = 0; i < 12; i++) add(plinth, 'bolt', 'titanium', polar(.36, i * TAU / 12, .105), [.012, .014, .012], [0, 0, 0], true);

  const dial = part('base.dial', 'Graduated azimuth dial and zodiac ring', 'Inspection scale',
    'Gives every orbit a readable angular reference.',
    'Three concentric brass arcs, thirty-six radial ticks and twelve engraved hour blocks sit on the fixed plinth.', undefined, [0, 0, 0], 'Engraved brass and dark alloy');
  for (const radius of [.48, .76, 1.02]) ringArc(dial, radius, .125, 0, TAU, 48, 'brass', radius === 1.02 ? .009 : .005);
  for (let i = 0; i < 36; i++) {
    const angle = i * TAU / 36, length = i % 3 === 0 ? .055 : .028;
    add(dial, 'box', 'brass', polar(.975, angle, .126), [.009, .010, length], [0, -angle, 0], true);
  }
  for (let i = 0; i < 12; i++) add(dial, 'box', 'dark', polar(.86, i * TAU / 12, .128), [.075, .012, .045], [0, -i * TAU / 12, 0]);

  for (let i = 0; i < 12; i++) {
    const angle = i * TAU / 12, name = ZODIAC[i];
    const station = part(`zodiac.${i + 1}`, `Zodiac station ${String(i + 1).padStart(2, '0')} · ${name}`, 'Inspection scale',
      `Marks the ${name} sector on the fixed graduated ring.`,
      'A raised pale tablet, a dark index line and two brass pins sit at the exact one-twelfth station on the dial.', undefined, [0, .02, 0], 'Pale alloy tablet and brass index');
    add(station, 'box', 'shell', polar(1.085, angle, .145), [.115, .018, .062], [0, -angle, 0]);
    add(station, 'box', 'dark', polar(1.06, angle, .157), [.062, .009, .010], [0, -angle, 0], true);
    add(station, 'cylinder', 'brass', polar(1.135, angle, .145), [.008, .018, .008], [0, 0, 0], true);
  }

  for (const [i, angle] of [-Math.PI / 2, Math.PI / 6, Math.PI * 5 / 6].entries()) {
    const foot = part(`base.foot.${i + 1}`, `Levelling foot ${i + 1} of three`, 'Foundation',
      'Carries one third of the instrument load on the bench.',
      'A rubber pad, a threaded brass jack and a triangular alloy bracket meet the plinth at a real bolted pad.', undefined, [0, 0, 0], 'Rubber pad, brass jack and alloy bracket');
    add(foot, 'cylinder', 'rubber', polar(.88, angle, .022), [.085, .044, .085]);
    add(foot, 'cylinder', 'brass', polar(.88, angle, .07), [.030, .065, .030]);
    rod(foot, 'dark', polar(.88, angle, .09), polar(.40, angle, .075), .018);
    add(foot, 'box', 'titanium', polar(.90, angle, .055), [.12, .022, .10], [0, -angle, 0], true);
  }

  const pedestal = part('base.pedestal', 'Pedestal and gimbal socket', 'Foundation',
    'Raises the gimbal pivot above the engraved dial.',
    'A tapered alloy column, four brass bands and a transverse gimbal ring support the tilting orbit stack.', undefined, [0, 0, 0]);
  add(pedestal, 'cylinder', 'shell', [0, .55, 0], [.16, .72, .16]);
  add(pedestal, 'cylinder', 'dark', [0, .22, 0], [.20, .10, .20]);
  for (const y of [.36, .52, .68, .84]) add(pedestal, 'ring', 'brass', [0, y, 0], [.168, .168, .168], [Math.PI / 2, 0, 0]);
  add(pedestal, 'ring', 'titanium', [0, D.pivotY, 0], [.10, .10, .10], [0, Math.PI / 2, 0]);
  for (const side of [-1, 1]) add(pedestal, 'cylinder', 'brass', [side * .11, D.pivotY, 0], [.022, .075, .022], [0, 0, Math.PI / 2]);

  const motor = part('drive.motor', 'Synchronous drive motor and copper field coils', 'Drive',
    'Turns the central worm through one inspection cycle.',
    'A dark motor can, two copper coil stacks and a ventilated brass end bell sit on the fixed plinth behind the pedestal.', undefined, [0, .02, 0], 'Dark motor can, copper coils and brass end bell');
  add(motor, 'cylinder', 'dark', [.60, .30, -.42], [.085, .18, .085], [0, 0, Math.PI / 2]);
  for (const x of [.535, .665]) add(motor, 'ring', 'copper', [x, .30, -.42], [.088, .088, .088], [0, Math.PI / 2, 0]);
  add(motor, 'cylinder', 'brass', [.70, .30, -.42], [.048, .035, .048], [0, 0, Math.PI / 2]);
  for (let i = 0; i < 10; i++) add(motor, 'box', 'dark', [.60, .30 + .075 * Math.cos(i * TAU / 10), -.42 + .075 * Math.sin(i * TAU / 10)], [.16, .012, .012], [i * TAU / 10, 0, 0], true);

  const worm = part('drive.worm', 'Worm shaft and hand crank', 'Drive',
    'Allows the orrery to be indexed by hand without moving the motor.',
    'A brass worm screw, a dark bearing block and a folding hand crank sit below the dial rim on the fixed frame.', undefined, [0, .02, 0], 'Brass worm and dark bearing block');
  rod(worm, 'brass', [.70, .30, -.42], [.94, .30, -.42], .014);
  for (let i = 0; i < 12; i++) add(worm, 'ring', 'brass', [.74 + i * .014, .30, -.42], [.018, .018, .018], [0, Math.PI / 2, 0], true);
  add(worm, 'box', 'dark', [.94, .30, -.42], [.06, .09, .09]);
  rod(worm, 'titanium', [.97, .30, -.42], [1.06, .38, -.30], .009);
  add(worm, 'sphere', 'rubber', [1.06, .38, -.30], [.024, .024, .024]);

  const handwheel = part('drive.handwheel', 'Five-spoke inspection handwheel', 'Drive',
    'Shows the input rotation at the front of the plinth.',
    'A brass rim, five titanium spokes and a rubber grip turn on a short transverse shaft.', undefined, [0, .02, 0], 'Brass rim, titanium spokes and rubber grip');
  const wheelNode = handwheel;
  wheelNode.position.set(.0, .22, .52);
  add(wheelNode, 'ring', 'brass', [0, 0, 0], [.13, .13, .13]);
  add(wheelNode, 'cylinder', 'dark', [0, 0, 0], [.028, .05, .028], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5;
    rod(wheelNode, 'titanium', [0, 0, 0], [.13 * Math.cos(a), .13 * Math.sin(a), 0], .007);
    add(wheelNode, 'sphere', 'brass', [.13 * Math.cos(a), .13 * Math.sin(a), 0], [.012, .012, .012]);
  }
  add(wheelNode, 'cylinder', 'rubber', [.10, 0, .03], [.016, .055, .016], [0, 0, Math.PI / 2]);

  const plate = part('base.nameplate', 'Instrument designation plate', 'Inspection equipment',
    'Identifies the clockwork orrery and its compressed orbit scale.',
    'A teal plate with three brass index studs is bolted to the front of the plinth, below the dial.', undefined, [0, .02, 0], 'Teal enamel and brass studs');
  add(plate, 'box', 'teal', [0, .18, .43], [.30, .06, .012]);
  for (let i = 0; i < 3; i++) add(plate, 'cylinder', 'brass', [-.09 + i * .09, .18, .445], [.013 + i * .002, .014, .013 + i * .002], [Math.PI / 2, 0, 0]);
  for (const x of [-.13, .13]) add(plate, 'bolt', 'titanium', [x, .18, .45], [.007, .012, .007], [Math.PI / 2, 0, 0], true);

  // ---------------------------------------------------------------- orbital stack
  const orbital = new THREE.Group(); orbital.name = 'orbit-stack'; orbital.position.y = D.pivotY; kit.assemblies.add(orbital);
  const column = part('stack.column', 'Central orbit spindle', 'Orbit drive',
    'Carries eight coaxial sleeves at their fixed arm heights.',
    'A continuous dark spindle with a brass thrust collar passes through every sleeve from the gimbal to the armillary base.', orbital, [0, .02, 0]);
  add(column, 'cylinder', 'dark', [0, .02, 0], [.034, 1.32, .034]);
  add(column, 'cylinder', 'brass', [0, -.50, 0], [.072, .05, .072]);
  add(column, 'cylinder', 'brass', [0, .62, 0], [.062, .05, .062]);

  const gimbal = part('stack.gimbal', 'Trunnion gimbal and lock arc', 'Foundation',
    'Lets the entire orbit stack tilt without moving the fixed pedestal.',
    'A transverse titanium trunnion, two brass bearing caps and a graduated lock arc meet the pedestal ring at the pivot.', orbital, [0, .02, 0], 'Titanium trunnion and brass bearing caps');
  add(gimbal, 'cylinder', 'titanium', [0, 0, 0], [.045, .34, .045], [0, 0, Math.PI / 2]);
  for (const side of [-1, 1]) add(gimbal, 'ring', 'brass', [side * .18, 0, 0], [.075, .075, .075], [0, Math.PI / 2, 0]);
  ringArc(gimbal, .25, 0, Math.PI * .78, Math.PI * 1.22, 10, 'titanium', .009, 'vertical');

  D.names.forEach((name, i) => {
    const y = D.armY[i], radius = D.orbits[i];
    const sleeve = part(`sleeve.${i + 1}`, `${name} orbit sleeve`, 'Orbit drive',
      `Holds the ${name} arm at its exact ${Math.round(y * 1000)} mm stack height.`,
      'A clamped dark collar, a brass bearing ring and two locking screws ride the central spindle without changing radius.', orbital, [0, .05, 0]);
    sleeve.position.set(0, y, 0);
    add(sleeve, 'cylinder', 'dark', [0, 0, 0], [.052, .045, .052]);
    add(sleeve, 'ring', 'brass', [0, .026, 0], [.060, .060, .060], [Math.PI / 2, 0, 0]);
    for (const side of [-1, 1]) add(sleeve, 'bolt', 'titanium', [side * .045, 0, 0], [.009, .014, .009], [0, 0, Math.PI / 2], true);

    const gearNode = part(`gear.${i + 1}`, `${name} index gear · ${D.gearTeeth[i]} teeth`, 'Index train',
      'Drives the sleeve through the central gear stack.',
      `A ${D.gearTeeth[i]}-tooth brass gear turns on the spindle below the arm; teeth are teaching geometry, not involutes.`, orbital, [0, .05, 0]);
    gearNode.position.set(0, y - .052, 0); kit.gear(gearNode, .058 + (7 - i) * .007, D.gearTeeth[i], .018, 'brass'); gears.push(gearNode);

    const arm = part(`arm.${i + 1}`, `${name} orbit arm`, 'Orbit drive',
      `Sweeps the ${name} planet at exactly ${Math.round(radius * 1000)} mm from the spindle.`,
      'Twin titanium rails, a brass counterweight and a planet cradle form one rigid arm with a fixed radius.', orbital, [0, .06, 0]);
    arm.position.set(0, y, 0);
    for (const z of [-.018, .018]) rod(arm, 'titanium', [0, 0, z], [radius, 0, z], .008);
    rod(arm, 'dark', [-.17, 0, 0], [0, 0, 0], .011);
    add(arm, 'cylinder', 'brass', [-.17, 0, 0], [.026, .05, .026], [0, 0, Math.PI / 2]);
    add(arm, 'ring', 'titanium', [radius - .035, 0, 0], [.036, .036, .036], [0, Math.PI / 2, 0]);
    arms.push(arm);

    const cradle = part(`cradle.${i + 1}`, `${name} planet cradle and spin axle`, 'Planet support',
      'Carries the planet at the arm tip while allowing it to spin.',
      'A forked titanium yoke, a brass axle and two retaining collars surround the planet band without hiding it.', arm, [0, .04, 0]);
    cradle.position.set(radius, 0, 0);
    for (const side of [-1, 1]) rod(cradle, 'titanium', [0, side * .022, 0], [0, side * .075, 0], .008);
    add(cradle, 'cylinder', 'brass', [0, 0, 0], [.014, .16, .014], [0, 0, Math.PI / 2]);

    const planet = part(`planet.${i + 1}`, `${name} planet sphere`, 'Planet',
      `Shows the ${name} body at its scaled orbit station.`,
      'A pale alloy sphere, a dark equatorial band and a brass latitude ring rotate on the cradle axle.', arm, [0, .05, 0], 'Pale alloy sphere, dark band and brass ring');
    planet.position.set(radius, 0, 0);
    add(planet, 'sphere', 'shell', [0, 0, 0], [D.radii[i], D.radii[i] * .94, D.radii[i]]);
    add(planet, 'ring', 'dark', [0, 0, 0], [D.radii[i] * 1.06, D.radii[i] * 1.06, D.radii[i] * .30], [Math.PI / 2, 0, 0]);
    add(planet, 'ring', 'brass', [0, 0, 0], [D.radii[i] * .78, D.radii[i] * .78, D.radii[i] * .20], [0, 0, Math.PI / 2]);
    planets.push(planet);

    if (i === 5) {
      const ring = part('planet.6.ring', 'SATURN ring plane', 'Planet',
        'Shows the broad ring plane around the sixth planet.',
        'Two thin brass annuli with twelve radial separators sit on the planet axle and tilt with the orbital stack.', planet, [0, .03, 0], 'Brass annuli and dark separators');
      add(ring, 'ring', 'brass', [0, 0, 0], [.135, .135, .135], [Math.PI / 2 + .38, 0, 0]);
      add(ring, 'ring', 'dark', [0, 0, 0], [.105, .105, .105], [Math.PI / 2 + .38, 0, 0]);
      for (let k = 0; k < 12; k++) {
        const a = k * TAU / 12;
        add(ring, 'box', 'titanium', [.12 * Math.cos(a), .12 * Math.sin(a) * .92, 0], [.045, .006, .012], [0, 0, a], true);
      }
    }

    const tab = part(`arm.${i + 1}.tab`, `${name} orbit designation tab`, 'Inspection scale',
      'Labels the arm at a readable point near the spindle.',
      'A small dark plate with a teal insert and a brass pin is clamped to the inner end of the arm.', arm, [0, .03, 0], 'Dark plate, teal insert and brass pin');
    add(tab, 'box', 'dark', [.19, .022, 0], [.075, .008, .050]);
    add(tab, 'box', 'teal', [.19, .028, 0], [.052, .004, .034], [0, 0, 0], true);
    add(tab, 'cylinder', 'brass', [.19, .04, 0], [.006, .02, .006], [0, 0, 0], true);

    const guard = part(`gear.${i + 1}.guard`, `${name} gear inspection guard`, 'Index train',
      'Keeps fingers out of the exposed index gear without hiding its teeth.',
      'A short pale arc on two standoffs covers the upper half of the gear rim and leaves the lower teeth readable.', orbital, [0, .04, 0], 'Formed pale alloy guard');
    guard.position.set(0, y - .052, 0);
    ringArc(guard, .070 + (7 - i) * .007, .026, 0, Math.PI, 8, 'shell', .011);
    for (const side of [-1, 1]) rod(guard, 'dark', [side * .055, .024, 0], [side * .055, .006, 0], .005);
  });

  D.names.forEach((name, i) => {
    const guide = part(`orbit.guide.${i + 1}`, `${name} fixed orbit guide`, 'Orbit scale',
      `Marks the exact ${Math.round(D.orbits[i] * 1000)} mm orbit radius at the ${name} arm height.`,
      'A thin brass ring with four radial ticks sits in the tilting orbital frame below its arm and never moves with the planet.', orbital, [0, .03, 0], 'Thin brass ring and radial ticks');
    guide.position.set(0, D.armY[i], 0);
    ringArc(guide, D.orbits[i], 0, 0, TAU, 40, i % 2 ? 'brass' : 'titanium', .0045);
    for (let k = 0; k < 4; k++) {
      const a = k * TAU / 4;
      add(guide, 'box', 'dark', polar(D.orbits[i], a, 0), [.018, .008, .006], [0, -a, 0], true);
    }
  });

  // ---------------------------------------------------------------- moons
  D.moons.forEach((moon, i) => {
    const owner = planets[moon.planet];
    const record = part(`moon.${i + 1}`, `${moon.name} moon and orbit wire`, 'Moon',
      `Orbits ${D.names[moon.planet]} at a fixed ${Math.round(moon.radius * 1000)} mm inspection radius.`,
      'A fine brass orbit wire, a pale moonlet and a dark counter-pin turn together on the planet-mounted bushing.', owner, [0, .04, 0], 'Brass orbit wire and pale moonlet');
    const node = record;
    node.position.set(0, 0, 0);
    for (const z of [-.012, .012]) rod(node, 'brass', [0, 0, z], [moon.radius, 0, z], .0035, true);
    add(node, 'sphere', 'shell', [moon.radius, 0, 0], [.012, .012, .012]);
    add(node, 'cylinder', 'dark', [0, 0, 0], [.008, .035, .008], [0, 0, Math.PI / 2]);
    moons.push({ node, index: i });
  });

  // ---------------------------------------------------------------- sun
  const sun = part('sun.core', 'Central sun lamp and brass corona cage', 'Illumination',
    'Provides the visual centre of the orbital system.',
    'A teal glass sphere sits inside six brass meridians and a dark base socket; the glow is illustrative only.', orbital, [0, .06, 0], 'Teal glass, brass cage and dark socket');
  sun.position.set(0, .015, 0);
  add(sun, 'sphere', 'lens', [0, 0, 0], [.060, .060, .060]);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    rod(sun, 'brass', [0, -.055, 0], [.062 * Math.cos(a), .058, .062 * Math.sin(a)], .004, true);
  }
  add(sun, 'cylinder', 'dark', [0, -.06, 0], [.035, .025, .035]);

  // ---------------------------------------------------------------- armillary
  const armillary = new THREE.Group(); armillary.name = 'armillary'; armillary.position.set(0, D.armillary.centreY - D.pivotY, 0); orbital.add(armillary);
  const horizon = part('armillary.horizon', 'Fixed horizon ring', 'Armillary',
    'Defines the level reference around the orbital stack.',
    'A heavy brass annulus on four dark standoffs, graduated with sixteen radial ticks and four cardinal blocks.', armillary, [0, .03, 0], 'Heavy brass ring and dark standoffs');
  ringArc(horizon, D.armillary.radius, 0, 0, TAU, 40, 'brass', .010);
  for (let i = 0; i < 16; i++) add(horizon, 'box', 'titanium', polar(D.armillary.radius + .018, i * TAU / 16, .012), [.010, .010, .032], [0, -i * TAU / 16, 0], true);
  for (let i = 0; i < 4; i++) rod(horizon, 'dark', [0, -.06, 0], polar(D.armillary.radius, i * TAU / 4, 0), .012);

  const meridian = part('armillary.meridian', 'Fixed meridian ring', 'Armillary',
    'Shows the vertical great circle of the instrument.',
    'A titanium half-ring with a graduated brass inlay rises from the horizon ring to the finial socket.', armillary, [0, .03, 0], 'Titanium ring and brass inlay');
  ringArc(meridian, D.armillary.radius, 0, 0, Math.PI, 28, 'titanium', .011, 'vertical');
  add(meridian, 'cylinder', 'brass', [0, D.armillary.radius, 0], [.020, .045, .020]);

  const ecliptic = part('armillary.ecliptic', 'Tilting ecliptic ring', 'Armillary',
    'Carries the adjustable ecliptic plane through the sphere.',
    'A brass annulus with a pale graduated insert rotates on two trunnion pins inside the meridian ring.', armillary, [0, .03, 0], 'Brass annulus and pale insert');
  ringArc(ecliptic, D.armillary.radius * .86, 0, 0, TAU, 36, 'brass', .009);
  for (let i = 0; i < 12; i++) add(ecliptic, 'box', 'shell', polar(D.armillary.radius * .86, i * TAU / 12, .014), [.032, .008, .018], [0, -i * TAU / 12, 0], true);

  const hourRing = part('armillary.hour-ring', 'Rotating hour ring', 'Armillary',
    'Marks the progressing hour angle of the mechanism.',
    'A narrow titanium ring with a single brass index cursor turns inside the ecliptic ring.', armillary, [0, .03, 0], 'Titanium ring and brass cursor');
  ringArc(hourRing, D.armillary.radius * .61, 0, 0, TAU, 32, 'titanium', .006);
  add(hourRing, 'box', 'brass', [D.armillary.radius * .61, 0, 0], [.028, .018, .014]);

  const axis = part('armillary.axis', 'Polar axis rod and finial', 'Armillary',
    'Holds the armillary rings on one common axis.',
    'A central titanium rod, a dark lower socket and a turned brass finial pass through all three rings.', armillary, [0, .03, 0], 'Titanium rod and brass finial');
  add(axis, 'cylinder', 'titanium', [0, .02, 0], [.012, .98, .012]);
  add(axis, 'cylinder', 'dark', [0, -.46, 0], [.042, .06, .042]);
  add(axis, 'sphere', 'brass', [0, .52, 0], [.026, .026, .026]);

  const standoffs = part('armillary.standoffs', 'Armillary standoff triplet', 'Armillary',
    'Connects the armillary frame to the orbital spindle.',
    'Three dark posts and a triangular brass yoke leave the planets free to pass beneath the rings.', orbital, [0, .02, 0], 'Dark posts and brass yoke');
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3 + .3;
    rod(standoffs, 'dark', [0, .60, 0], polar(D.armillary.radius * .70, a, .60), .010);
    add(standoffs, 'sphere', 'brass', polar(D.armillary.radius * .70, a, .60), [.014, .014, .014]);
  }

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.planets && state?.moons && state?.armillary) lastState = state;
    else if (Number.isFinite(state?.phase)) lastState = poseAt(state.phase * TAU, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    orbital.rotation.z = pose.tilt;
    arms.forEach((node, i) => { node.rotation.y = -pose.planets[i].orbitAngle; });
    gears.forEach((node, i) => { node.rotation.y = pose.planets[i].gearAngle; });
    planets.forEach((node, i) => { node.rotation.y = TAU * (pose.phase * .34 + i * .11); });
    moons.forEach(record => { record.node.rotation.y = -pose.moons[record.index].angle; });
    ecliptic.rotation.z = pose.armillary.eclipticTilt;
    hourRing.rotation.y = -pose.armillary.hourAngle;
    handwheel.rotation.z = pose.drive.wheelAngle;
    sun.scale.setScalar(1 + .035 * pose.sun.flare);
    kit.sync(options);
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
