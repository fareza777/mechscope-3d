import { createMechanicalKit } from '../mechanical-kit.js';
import { DIM, LEG_MOUNT, shoulderMount, sample, distance, add, sub, mul } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('MANTIS M6 — pin-coupled grasper');
  const { add: primitive, rod, gear, fasteners, aim } = kit;
  const make = (id, name, system, purpose, how, material = 'Titanium / bronze', parent, explode = [0, .12, 0]) => kit.part({ id: `mantis.${id}`, name, system, function: purpose, how, material }, parent, explode);
  const box = (n, m, p, s, e = [0, 0, 0], detail = false) => primitive(n, 'box', m, p, s, e, detail);
  function bearing(n, y = 0, r = .038) {
    primitive(n, 'cylinder', 'dark', [0, y, 0], [r, .07, r], [Math.PI / 2, 0, 0]);
    for (const s of [-1, 1]) {
      primitive(n, 'ring', 'brass', [0, y, s * .041], [r * .8, r * .8, r * .8]);
      primitive(n, 'bolt', 'titanium', [0, y, s * .052], [r * .33, .015, r * .33], [Math.PI / 2, 0, 0]);
    }
    rod(n, 'titanium', [0, y, -.052], [0, y, .052], r * .24);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      box(n, 'titanium', [r * Math.cos(a), y + r * Math.sin(a), .02], [.009, .009, .043], [0, 0, a], true);
    }
  }
  // A bearing whose shaft is the X axis, used by the sagittal grasping linkage.
  function sidePin(n, at, r = .029) {
    primitive(n, 'cylinder', 'dark', at, [r, .096, r], [0, 0, Math.PI / 2]);
    for (const s of [-1, 1]) {
      primitive(n, 'ring', 'brass', [at[0] + s * .055, at[1], at[2]], [r * .85, r * .85, r * .85], [0, Math.PI / 2, 0]);
      primitive(n, 'bolt', 'titanium', [at[0] + s * .064, at[1], at[2]], [r * .37, .014, r * .37], [0, 0, Math.PI / 2]);
    }
  }
  function beam(n, length, width = .023, ribs = 4) {
    for (const s of [-1, 1]) {
      rod(n, 'titanium', [s * width, .023, 0], [s * width, length - .023, 0], .011);
      box(n, 'shell', [s * (width + .009), length * .50, .012], [.018, length * .61, .021]);
    }
    for (let j = 1; j <= ribs; j++) {
      const y = length * j / (ribs + 1);
      box(n, 'dark', [0, y, 0], [width * 2.1, .012, .025]);
      box(n, 'teal', [0, y, -.019], [width * .7, .009, .008], [0, 0, 0], true);
    }
    rod(n, 'rubber', [-width - .019, .025, -.023], [-width - .019, length - .025, -.023], .006, true);
    fasteners(n, [[-width, length * .2, .025], [width, length * .8, .025]], .006);
  }
  function mountBracket(n, pin, width) {
    // Permanent rail-to-pin stays remain structural geometry even at low quality.
    for (const side of [-1, 1]) rod(n, 'titanium', [side * width, pin[1], 0], pin, .014);
  }
  function actuator(id, name, parent, length = .15) {
    const barrel = make(`${id}.barrel`, `${name} · servo barrel`, 'Linear actuators', 'Hold the guide sleeve at a fixed manufactured length.', 'A clevis-mounted rigid sleeve aims at the moving endpoint.', 'Dark alloy / copper glands', parent);
    primitive(barrel, 'cylinder', 'dark', [0, length / 2, 0], [.022, length, .022]);
    for (const y of [.012, length - .012]) {
      primitive(barrel, 'cylinder', 'copper', [0, y, 0], [.027, .018, .027]);
      box(barrel, 'titanium', [.026, y, 0], [.014, .027, .036]);
    }
    rod(barrel, 'rubber', [-.031, .012, 0], [-.031, length - .012, 0], .006, true);
    fasteners(barrel, [[.026, .025, .017], [.026, length - .025, .017]], .005);
    const piston = make(`${id}.rod`, `${name} · sliding piston`, 'Linear actuators', 'Take up the analytic pin-to-pin distance.', 'Only the exposed rod scales; 18 mm remains inside the barrel.', 'Polished titanium', parent, [.045, .05, 0]);
    primitive(piston, 'cylinder', 'titanium', [0, .5, 0], [.008, 1, .008]);
    const clevis = make(`${id}.clevis`, `${name} · rod-end eye`, 'Linear actuators', 'Transfer motion through a bushed pin instead of a welded intersection.', 'The eye stays centred on the moving actuator endpoint.', 'Titanium / bronze', parent); bearing(clevis, 0, .022);
    return { barrel, piston, clevis, length };
  }
  function poseActuator(n, a, b, member) {
    const d = distance(a, b), start = n.length - .018;
    aim(n.barrel, a, b); aim(n.piston, add(a, mul(sub(b, a), start / d)), b); n.piston.scale.set(1, d - start, 1);
    n.clevis.position.fromArray(b); n.clevis.quaternion.copy(member.quaternion);
  }

  const chassis = make('chassis', 'Narrow abdominal ladder frame', 'Segmented torso', 'Support four walking legs beneath a raised prothorax.', 'Two longitudinal rails and spaced bulkheads preserve a narrow, open abdomen.', 'Titanium / dark alloy', undefined, [0, .035, 0]);
  for (const x of [-.09, .09]) rod(chassis, 'titanium', [x, .82, -.06], [x, .82, .73], .019);
  for (let i = 0; i < 6; i++) {
    const z = -.02 + i * .14;
    box(chassis, 'dark', [0, .82, z], [.24 - i * .016, .027, .043]);
    fasteners(chassis, [[-.08, .844, z], [.08, .844, z]], .007);
  }
  const spine = make('abdomen.shaft', 'Dorsal transmission shaft', 'Dorsal drive', 'Show the path between rear service bay and thoracic reducer.', 'The shaft is visible through lifted covers and segmented armor slots.', 'Titanium / bronze', chassis, [0, .10, .04]);
  rod(spine, 'titanium', [0, .9, -.01], [0, .9, .67], .017);
  const abdomenGears = [];
  for (let i = 0; i < 5; i++) {
    const bay = make(`abdomen.bay-${i + 1}`, `Abdominal bay ${i + 1} · split ring shell`, 'Segmented torso', 'Protect one short frame bay without merging the body into a solid block.', 'Left and right cassettes leave a longitudinal gap over the drive shaft.', 'Shell / dark gasket', chassis, [0, .08, .04 + i * .025]);
    const width = .108 - i * .007, z = .025 + i * .139;
    for (const side of [-1, 1]) {
      box(bay, 'shell', [side * width, .895, z], [.07, .075, .116], [0, 0, side * .16]);
      for (let j = 0; j < 3; j++) box(bay, 'dark', [side * (width + .016), .935, z - .035 + j * .035], [.06, .01, .012], [0, 0, side * .16], true);
      fasteners(bay, [[side * width, .943, z]], .007);
    }
    const wheel = make(`abdomen.wheel-${i + 1}`, `Abdominal bay ${i + 1} · indexed wheel`, 'Dorsal drive', 'Expose phase along the dorsal drive shaft.', 'Each spaced gear shares the longitudinal shaft axis.', 'Bronze / titanium', chassis, [0, .14, 0]);
    wheel.position.set(0, .9, z); wheel.rotation.x = Math.PI / 2; gear(wheel, .048, 12, .017); abdomenGears.push(wheel);
  }
  const motor = make('abdomen.motor', 'Rear motor winding cartridge', 'Dorsal drive', 'Package the conceptual prime mover under the open wing roots.', 'Separated copper coil blocks and cooling fins surround a dark rectangular stator.', 'Copper / dark alloy', chassis, [0, -.10, .10]);
  box(motor, 'dark', [0, .756, .38], [.15, .075, .25]);
  for (let i = 0; i < 12; i++) {
    box(motor, 'copper', [(i % 2 ? -1 : 1) * .084, .754, .282 + Math.floor(i / 2) * .039], [.019, .049, .02], [0, 0, 0], true);
    box(motor, 'titanium', [0, .711, .267 + i * .02], [.11, .014, .007], [0, 0, 0], true);
  }

  const thorax = make('thorax.load-frame', 'Long open prothorax', 'Raised thorax', 'Lift the arm pivots and head well above the abdomen.', 'A slender inclined pair of rails leaves an uninterrupted central negative space.', 'Titanium / shell', chassis, [0, .13, -.09]);
  const thoraxStart = [0, .865, .13], thoraxEnd = [0, 1.565, -.30], thoraxLength = distance(thoraxStart, thoraxEnd);
  beam(thorax, thoraxLength, .046); aim(thorax, thoraxStart, thoraxEnd);
  for (let i = 0; i < 3; i++) {
    const cover = make(`thorax.cover-${i + 1}`, `Prothorax segment ${i + 1} · lateral service panels`, 'Raised thorax', 'Shield a short cable bay without closing the central viewing slot.', 'Two slim plates are attached to the same rigid inclined spine.', 'Shell / teal trim', thorax, [.09, 0, .04]);
    for (const side of [-1, 1]) {
      box(cover, 'shell', [side * .068, .13 + i * .245, 0], [.023, .17, .083]);
      box(cover, 'teal', [side * .083, .13 + i * .245, .003], [.008, .10, .025]);
      fasteners(cover, [[side * .068, .215 + i * .245, .032]], .006);
    }
  }
  const rack = make('thorax.rack', 'Exposed thoracic timing rack', 'Raised thorax drive', 'Make the internal drive legible between the shell strips.', 'A narrow rack and individual rectangular teeth run behind, not through, the open structural rails.', 'Bronze / titanium', thorax, [0, 0, -.065]);
  box(rack, 'dark', [0, thoraxLength / 2, -.044], [.025, thoraxLength * .80, .014]);
  for (let i = 0; i < 22; i++) box(rack, 'brass', [0, .10 + i * .028, -.057], [.037, .011, .017]);
  const shoulderBridge = make('thorax.shoulder-bridge', 'Raptorial shoulder crosshead', 'Raised thorax', 'Transfer arm loads into the long prothorax.', 'A transverse axle and two diagonal stays locate the paired shoulder pins.', 'Titanium / bronze', chassis, [0, .12, -.13]);
  rod(shoulderBridge, 'titanium', [-.16, 1.405, -.3], [.16, 1.405, -.3], .022);
  for (const side of [-1, 1]) rod(shoulderBridge, 'dark', [side * .13, 1.405, -.3], [side * .047, 1.26, -.115], .012);
  const neck = make('neck.gimbal', 'Head yaw and pitch gimbal', 'Sensor head', 'Hold the triangular head on a narrow, visible neck.', 'A vertical yaw spindle meets a transverse pitch trunnion.', 'Titanium / bronze / teal', chassis, [0, .17, -.035]);
  rod(neck, 'titanium', [0, 1.55, -.30], [0, 1.70, -.345], .029);
  primitive(neck, 'cylinder', 'teal', [0, 1.59, -.311], [.045, .046, .045]);
  const head = make('head.triangle', 'Triangular head · open optical frame', 'Sensor head', 'Give the machine its unmistakable broad-eyed mantis face.', 'Three perimeter rails join the two eye corners to a lower central jaw; inset shell rows follow that triangle.', 'Titanium / shell', chassis, [0, .20, -.07]);
  const corners = [[-.25, .087, 0], [.25, .087, 0], [0, -.15, 0]];
  for (let i = 0; i < 3; i++) rod(head, 'titanium', corners[i], corners[(i + 1) % 3], .015);
  for (let i = 0; i < 4; i++) {
    const y = .062 - i * .055, width = .40 - i * .103;
    box(head, 'shell', [0, y, .015], [width, .041, .044]);
    box(head, 'dark', [0, y - .021, -.012], [width * .86, .008, .014], [0, 0, 0], true);
    fasteners(head, [[-width * .3, y + .021, -.003], [width * .3, y + .021, -.003]], .005);
  }
  const mouth = make('head.mandible', 'Lower triangular sensor jaw', 'Sensor head', 'Terminate the face below the eye baseline.', 'Two short angled cheeks flank a central proximity lens.', 'Teal / titanium / optical glass', head, [0, -.06, -.07]);
  for (const side of [-1, 1]) box(mouth, 'teal', [side * .026, -.125, -.028], [.031, .055, .037], [0, 0, -side * .30]);
  primitive(mouth, 'sphere', 'lens', [0, -.112, -.048], [.013, .017, .011]);
  const eyes = [-1, 1].map(side => {
    const eye = make(`head.eye-${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} independently swivelling eye`, 'Stereo sensing', 'Illustrate independently aimed binocular optics.', 'A spherical cartridge swivels inside a fixed corner mount; no perception algorithm is simulated.', 'Dark housing / optical teal glass', head, [side * .10, .06, -.08]);
    eye.position.set(side * .247, .086, -.015);
    primitive(eye, 'sphere', 'dark', [0, 0, 0], [.074, .069, .068]);
    primitive(eye, 'ring', 'titanium', [0, 0, -.053], [.057, .057, .057]);
    primitive(eye, 'sphere', 'lens', [0, 0, -.061], [.046, .046, .027]);
    for (let j = 0; j < 8; j++) {
      const a = j * Math.PI / 4;
      box(eye, 'teal', [.065 * Math.cos(a), .061 * Math.sin(a), -.007], [.012, .012, .035], [0, 0, a], true);
    }
    const antenna = make(`head.antenna-${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} articulated feeler mast`, 'Sensor head', 'Extend the silhouette above the eye line.', 'Three non-collinear cable-supported sections end in a small optical marker.', 'Titanium / rubber / optical glass', head, [side * .08, .13, 0]);
    const points = [[side * .11, .09, .025], [side * .15, .20, .022], [side * .23, .30, -.03], [side * .26, .34, -.09]];
    for (let i = 0; i < 3; i++) {
      rod(antenna, i === 1 ? 'dark' : 'titanium', points[i], points[i + 1], .006 - i * .001);
      primitive(antenna, 'sphere', 'brass', points[i], [.009, .009, .009]);
    }
    primitive(antenna, 'sphere', 'lens', points[3], [.009, .009, .009]);
    return eye;
  });

  const wings = [-1, 1].map(side => {
    const name = `${side < 0 ? 'Left' : 'Right'} dorsal wing cover`;
    const hinge = make(`wing.${side < 0 ? 'L' : 'R'}.hinge`, `${name} · hinge spine`, 'Open wing covers', 'Mount a permanently lifted service cover above the abdomen.', 'A longitudinal hinge leaves the dorsal gears visible between the open covers.', 'Titanium / bronze', chassis, [side * .12, .12, .05]);
    rod(hinge, 'titanium', [side * .10, .98, .13], [side * .10, .98, .70], .013);
    const cover = make(`wing.${side < 0 ? 'L' : 'R'}.panel`, `${name} · ribbed cassette`, 'Open wing covers', 'Frame the open-back silhouette without functioning as a simulated flight surface.', 'The entire spar, shell and rib assembly rotates about a fixed longitudinal root.', 'Shell / titanium / dark gaskets', chassis, [side * .21, .20, .06]);
    cover.position.set(side * .10, .98, .415);
    box(cover, 'shell', [side * .115, 0, 0], [.205, .019, .54], [0, side * .035, 0]);
    for (const x of [.027, .20]) rod(cover, 'titanium', [side * x, .017, -.245], [side * x, .017, .245], .009);
    for (let i = 0; i < 8; i++) {
      const z = -.23 + i * .066;
      box(cover, 'dark', [side * .115, .017, z], [.175, .013, .008], [0, side * .10, 0]);
      box(cover, 'teal', [side * .192, .026, z], [.014, .006, .024], [0, 0, 0], true);
      fasteners(cover, [[side * .035, .03, z]], .005);
    }
    return cover;
  });

  const legs = [];
  for (const side of [-1, 1]) for (let i = 0; i < 2; i++) {
    const id = `leg.${side < 0 ? 'L' : 'R'}${i + 1}`, name = `${side < 0 ? 'Left' : 'Right'} ${i ? 'hind' : 'middle'} support leg`;
    const hip = make(`${id}.hip`, `${name} · yaw cartridge`, 'Four-leg support', 'Locate the supporting limb on the abdomen.', 'A bearing housing stays fixed to the chassis while the coxa yaws.', 'Titanium / bronze', chassis, [side * .10, .05, 0]); bearing(hip, 0, .047);
    const coxa = make(`${id}.coxa`, `${name} · 130 mm coxa`, 'Four-leg support', 'Clear the narrow abdomen before the main flexure plane.', 'A short rigid fork points toward the assigned foot target.', 'Titanium / shell', chassis, [side * .14, .04, 0]); beam(coxa, DIM.coxa);
    const femur = make(`${id}.femur`, `${name} · 480 mm femur`, 'Four-leg support', 'Reach the upper intersection of the two rigid leg segments.', 'Spaced rails span the coxa and knee without length scaling.', 'Titanium / shell', chassis, [side * .18, .07, 0]); beam(femur, DIM.femur); bearing(femur); mountBracket(femur, LEG_MOUNT, .023);
    const tibia = make(`${id}.tibia`, `${name} · 630 mm tibia`, 'Four-leg support', 'Reach the geometric floor path from the knee.', 'Long narrow twin rails emphasize the upright mantis stance.', 'Titanium / shell', chassis, [side * .22, .03, 0]); beam(tibia, DIM.tibia, .020); bearing(tibia, 0, .035);
    const wheel = make(`${id}.knee-wheel`, `${name} · knee reducer`, 'Joint transmission', 'Display the tibial joint angle outside the bearing cage.', 'A toothed wheel follows the angle between the two structural links.', 'Bronze / titanium', tibia, [0, 0, .06]); wheel.position.z = .064; wheel.rotation.x = Math.PI / 2; gear(wheel, .041, 12, .017);
    const pad = make(`${id}.pad`, `${name} · level tarsal shoe`, 'Ground interface', 'Keep the support sole on or above the world floor.', 'A rigid level shoe follows the foot target while the tibia changes angle.', 'Rubber / titanium', chassis, [side * .23, 0, 0]);
    box(pad, 'rubber', [0, 0, 0], [.10, DIM.sole * 2, .145]);
    box(pad, 'titanium', [0, .037, 0], [.053, .009, .09]);
    for (let j = 0; j < 5; j++) box(pad, 'dark', [0, -.023, -.057 + j * .028], [.104, .010, .008], [0, 0, 0], true);
    legs.push({ hip, coxa, femur, tibia, wheel, pad, act: actuator(`${id}.lift`, name, chassis) });
  }

  const arms = [-1, 1].map(side => {
    const id = `arm.${side < 0 ? 'L' : 'R'}`, name = `${side < 0 ? 'Left' : 'Right'} raptorial arm`;
    const upper = make(`${id}.shoulder`, `${name} · lateral shoulder link`, 'Raptorial positioning', 'Hold the grasping plane clear of the prothorax.', 'A 260 mm rigid fork joins the shoulder crosshead to the femur root.', 'Titanium / shell', chassis, [side * .14, .06, -.08]); beam(upper, DIM.shoulder, .03); bearing(upper, 0, .042); mountBracket(upper, shoulderMount(side), .03);
    const femur = make(`${id}.femur`, `${name} · fixed serrated grasper`, 'Raptorial grasper', 'Carry the wrist pivot and stationary half of the gripping channel.', 'A broad twin-rail 380 mm cage surrounds the outboard closure mechanism.', 'Titanium / shell / dark gripping teeth', chassis, [side * .18, .04, -.14]);
    // The returning rail cage fits between the wide fixed comb rows even at
    // minimum aperture. Three cross-ties leave a clear pocket beside the wrist.
    beam(femur, DIM.arm, .056, 3); sidePin(femur, [0, 0, 0], .036); sidePin(femur, [0, DIM.arm, 0], .031);
    rod(femur, 'titanium', [side * .047, DIM.arm, 0], [side * DIM.closureOffset, DIM.arm, 0], .010);
    const fixedTeeth = make(`${id}.fixed-teeth`, `${name} · stationary staggered tooth comb`, 'Raptorial grasper', 'Face the returning tibia across an open gripping channel.', 'Short teeth start away from the wrist, where the closing gap is safely wider.', 'Dark gripping inserts / titanium seats', femur, [0, 0, -.06]);
    for (let j = 0; j < 8; j++) {
      const y = .046 + j * .027;
      for (const x of [-.056, .056]) {
        box(fixedTeeth, 'titanium', [x, y, -.018], [.018, .016, .011]);
        primitive(fixedTeeth, 'cone', 'dark', [x, y, -.036], [.010, .029, .010], [-Math.PI / 2, 0, 0]);
      }
    }
    const tibia = make(`${id}.tibia`, `${name} · folding 340 mm grasper`, 'Raptorial grasper', 'Fold a narrower rigid grasper back toward the femur.', 'Rotation about the wrist fixes both the end-hook path and rocker-pin position.', 'Titanium / shell', chassis, [side * .21, .03, -.17]);
    beam(tibia, DIM.grasper, .018);
    const movingTeeth = make(`${id}.moving-teeth`, `${name} · returning tooth comb`, 'Raptorial grasper', 'Oppose the fixed teeth without covering the hinge region.', 'Staggered serrations lie between 120 and 295 mm from the wrist pivot.', 'Dark gripping inserts / titanium seats', tibia, [0, 0, -.06]);
    for (let j = 0; j < 7; j++) {
      const y = .12 + j * .028;
      box(movingTeeth, 'titanium', [0, y, -.018], [.030, .015, .011]);
      primitive(movingTeeth, 'cone', 'dark', [0, y, -.034], [.01, .026, .01], [-Math.PI / 2, 0, 0]);
    }
    const hook = make(`${id}.hook`, `${name} · terminal tarsal hook`, 'Raptorial grasper', 'Finish the folded silhouette with a short inward contact tip.', 'A rigid two-piece hook remains attached to the tibia rather than animating independently.', 'Titanium / rubber', tibia, [0, .04, -.04]);
    rod(hook, 'titanium', [0, .316, 0], [0, .34, -.017], .012);
    rod(hook, 'rubber', [0, .34, -.017], [0, .35, -.038], .009);
    const crank = make(`${id}.crank`, `${name} · 75 mm input crank`, 'Four-bar closure', 'Join the fixed drive pin to the solved coupler pin.', 'The upper circle-intersection branch fixes its angle; no time-integrated solver is used.', 'Bronze / titanium', chassis, [side * .24, .07, -.08]);
    rod(crank, 'brass', [0, 0, 0], [0, DIM.crank, 0], .013);
    const coupler = make(`${id}.coupler`, `${name} · 145 mm coupler`, 'Four-bar closure', 'Couple the input crank pin to the tibial rocker pin.', 'Two spaced rails retain exactly 145 mm pin separation at every aperture.', 'Titanium / bronze', chassis, [side * .28, .07, -.1]);
    for (const x of [-.009, .009]) rod(coupler, 'titanium', [x, 0, 0], [x, DIM.coupler, 0], .006);
    for (let j = 1; j < 4; j++) box(coupler, 'brass', [0, DIM.coupler * j / 4, 0], [.026, .009, .017]);
    const rocker = make(`${id}.rocker`, `${name} · 85 mm tibial rocker`, 'Four-bar closure', 'Lock the coupler output to the folding tibia.', 'A rigid outboard lever shares the wrist axis and follows the grasper angle.', 'Bronze / titanium', chassis, [side * .26, .03, -.12]);
    rod(rocker, 'brass', [0, 0, 0], [0, DIM.rocker, 0], .012);
    const motorPin = make(`${id}.motor-pin`, `${name} · fixed crank bearing`, 'Four-bar closure', 'Locate the ground pivot on the femur frame.', 'An X-axis axle passes through the external input pin, clear of the gripping plane.', 'Dark housing / bronze bushing', chassis, [side * .22, .08, 0]); sidePin(motorPin, [0, 0, 0], .028);
    const crankPin = make(`${id}.crank-pin`, `${name} · crank-to-coupler pin`, 'Four-bar closure', 'Join two independently oriented rigid members at one computed endpoint.', 'A short external pin shows the exact circle-closure intersection.', 'Titanium / bronze', chassis, [side * .28, .08, 0]); sidePin(crankPin, [0, 0, 0], .016);
    const rockerPin = make(`${id}.rocker-pin`, `${name} · coupler-to-rocker pin`, 'Four-bar closure', 'Transfer coupler motion into the returning tibia.', 'The pin follows a circle of radius 85 mm around the wrist.', 'Titanium / bronze', chassis, [side * .28, .08, 0]); sidePin(rockerPin, [0, 0, 0], .016);
    const reducer = make(`${id}.reducer`, `${name} · exposed crank gear`, 'Four-bar closure', 'Show the inverse-solved crank angle at the motor pivot.', 'The gear and crank share the fixed X-axis shaft; this is a geometric drive, not a torque model.', 'Bronze / titanium', chassis, [side * .30, .10, 0]); gear(reducer, .049, 16, .018);
    return { upper, femur, tibia, crank, coupler, rocker, motorPin, crankPin, rockerPin, reducer, act: actuator(`${id}.position`, name, chassis, .115) };
  });

  // Restore static as well as animated bind transforms before temporary explosion.
  const bind = [];
  kit.group.traverse(node => { if (node.userData.partId) bind.push({ node, position: node.position.clone(), rotation: node.quaternion.clone(), scale: node.scale.clone() }); });
  let current = sample(0), disposed = false;
  function update(state = current, options = {}) {
    if (disposed) return;
    for (const b of bind) { b.node.position.copy(b.position); b.node.quaternion.copy(b.rotation); b.node.scale.copy(b.scale); }
    current = state?.legs ? state : current;
    abdomenGears.forEach((n, i) => { n.rotation.y = current.driveAngle + i * .6; });
    head.position.fromArray(current.head.position); head.rotation.set(current.head.pitch, current.head.yaw, 0);
    eyes.forEach((n, i) => { n.rotation.set(current.head.eyes[i].pitch, current.head.eyes[i].yaw, 0); });
    wings.forEach((n, i) => { n.rotation.z = current.wings[i].angle; });
    legs.forEach((n, i) => {
      const s = current.legs[i]; n.hip.position.fromArray(s.hip); n.hip.rotation.y = -s.yaw;
      aim(n.coxa, s.hip, s.coxa); aim(n.femur, s.coxa, s.knee); aim(n.tibia, s.knee, s.foot); n.pad.position.fromArray(s.foot);
      const u = sub(s.knee, s.coxa), v = sub(s.foot, s.knee);
      const dot = u.reduce((sum, x, j) => sum + x * v[j], 0) / (DIM.femur * DIM.tibia);
      n.wheel.rotation.y = Math.acos(Math.max(-1, Math.min(1, dot)));
      poseActuator(n.act, s.actuatorA, s.actuatorB, n.femur);
    });
    arms.forEach((n, i) => {
      const s = current.arms[i], c = s.closure;
      aim(n.upper, s.shoulder, s.elbow); n.femur.position.fromArray(s.elbow); n.femur.rotation.x = s.femurRotation;
      n.tibia.position.fromArray(s.wrist); n.tibia.rotation.x = s.tibiaRotation;
      aim(n.crank, c.D, c.A); aim(n.coupler, c.A, c.B); aim(n.rocker, c.W, c.B);
      n.motorPin.position.fromArray(c.D); n.crankPin.position.fromArray(c.A); n.rockerPin.position.fromArray(c.B);
      n.reducer.position.fromArray(add(c.D, [s.side * .071, 0, 0]));
      n.reducer.rotation.set(s.femurRotation + c.crankAngle, 0, -Math.PI / 2);
      poseActuator(n.act, s.actuatorA, s.actuatorB, n.upper);
    });
    kit.sync(options);
  }
  update(current);
  return { group: kit.group, update, get pickables() { return disposed ? [] : kit.pickables; }, parts: kit.parts, stats: kit.stats,
    dispose() { if (!disposed) { disposed = true; kit.dispose(); kit.group.clear(); } } };
}
