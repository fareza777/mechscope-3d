import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, LEGS, TAU, sample, poseAt, add as plus, sub, mul, dot } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('SALTUS G6 · mechanical grasshopper');
  const { add, rod, gear, aim } = kit;
  let current = sample(0), disposed = false;
  const matrix = new THREE.Matrix4();
  const sideName = s => s < 0 ? 'Left' : 'Right', sid = s => s < 0 ? 'L' : 'R';
  const part = (id, name, system, purpose, how, parent, explode = [0, .16, 0]) => kit.part({ id: `grasshopper.${id}`, name, system, function: purpose, how, detail: `${purpose} ${how}`, material: 'Pale alloy armour, teal chassis and bronze transmission', unit: 'm · rad' }, parent, explode);
  const box = (n, mat, p, size, angles = [0, 0, 0]) => add(n, 'box', mat, p, size, angles);
  const ball = (n, mat, p, size) => add(n, 'sphere', mat, p, size);
  const ring = (n, mat, p, r, angles = [0, Math.PI / 2, 0]) => add(n, 'ring', mat, p, [r, r, r], angles);
  function place(n, p, f) {
    matrix.set(f[0], f[1], f[2], 0, f[3], f[4], f[5], 0, f[6], f[7], f[8], 0, 0, 0, 0, 1);
    n.position.fromArray(p); n.quaternion.setFromRotationMatrix(matrix);
  }
  function member(n, length, width) {
    box(n, 'dark', [0, length / 2, 0], [width * 1.65, length, width * 1.25]);
    ball(n, 'teal', [0, length * .49, 0], [width, length * .48, width * .84]);
    for (const s of [-1, 1]) rod(n, 'titanium', [s * width * .72, .02, width * .65], [s * width * .72, length - .02, width * .65], .018, true);
    for (const y of [0, length]) {
      add(n, 'cylinder', 'dark', [0, y, 0], [width * .70, width * 2.25, width * .70], [0, 0, Math.PI / 2]);
      for (const s of [-1, 1]) ring(n, 'brass', [s * width * 1.14, y, 0], width * .67);
    }
  }
  function cover(id, parent, length, width, name) {
    const n = part(id, name, 'Limb armour', 'Protect a rigid load member with a broad, thick removable fairing.', 'The pale cap retains its solid section at low quality and follows the member without scaling its joint-to-joint length.', parent, [0, 0, .19]);
    ball(n, 'shell', [0, length * .48, width * .34], [width * 1.08, length * .40, width * .70]);
    box(n, 'teal', [0, length * .48, width * 1.02], [width * .8, length * .59, .03]);
    for (const y of [.27, .50, .73]) box(n, 'brass', [0, length * y, width * 1.04], [width * 1.3, .018, .025]);
    return n;
  }
  function ram(id, name, sleeve) {
    const barrel = part(`${id}.barrel`, `${name} barrel`, 'Telescoping actuators', 'Carry a fixed-length pressure sleeve between the moving limb attachments.', 'The sleeve aims along the measured actuator line; a separate polished rod changes exposed span instead of stretching the cylinder.', undefined, [.1, .1, 0]);
    add(barrel, 'cylinder', 'dark', [0, sleeve / 2, 0], [.038, sleeve, .038]);
    for (const y of [.02, sleeve - .02]) add(barrel, 'cylinder', 'copper', [0, y, 0], [.047, .025, .047]);
    ball(barrel, 'brass', [0, 0, 0], [.045, .045, .045]);
    const piston = part(`${id}.rod`, `${name} sliding rod`, 'Telescoping actuators', 'Bridge the sleeve gland and the sampled output attachment.', 'Only this exposed polished span changes length, while the sleeve and the adjacent femur and tibia keep their rigid dimensions.', undefined, [.15, .1, 0]);
    add(piston, 'cylinder', 'titanium', [0, .5, 0], [.020, 1, .020]);
    const eye = part(`${id}.eye`, `${name} output clevis`, 'Telescoping actuators', 'Keep the actuator visibly attached to its output member.', 'A bronze spherical clevis remains centred on the actual calculated endpoint throughout preload, extension and landing.', undefined, [.18, .1, 0]);
    ball(eye, 'brass', [0, 0, 0], [.047, .047, .047]);
    return { barrel, piston, eye, sleeve };
  }
  const body = part('body', 'Deep thoracic load chassis', 'Thorax', 'Join four walking legs, two enlarged jumping legs, the helmet and abdominal spine.', 'A substantial central load box and paired shoulder rails make the thorax readable as a deep mass rather than a thin wire framework.');
  box(body, 'dark', [0, -.025, -.13], [.70, .40, .94]);
  for (const s of [-1, 1]) {
    ball(body, 'teal', [s * .29, -.03, -.12], [.16, .26, .52]);
    rod(body, 'brass', [s * .39, .09, -.53], [s * .39, .09, .28], .035);
  }
  const keel = part('keel', 'Ventral pump cradle', 'Thorax', 'Close the underside with a thick ribbed belly rather than a display stand.', 'The keel travels with the insect; only the six level soles provide the prescribed ground contact.', body, [0, -.20, 0]);
  box(keel, 'teal', [0, -.26, -.12], [.43, .13, .83]);
  for (let i = 0; i < 5; i++) box(keel, 'shell', [0, -.30, -.46 + i * .17], [.61, .05, .09]);
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
    const n = part(`thorax.${sid(s)}${i + 1}`, `${sideName(s)} thoracic plate ${i + 1}`, 'Thorax armour', 'Give the shoulder girdle a broad overlapping armoured side wall.', 'Separate thick plates leave an upper inspection slot for the camshaft and gimbal while protecting the leg-root rails.', body, [s * .18, .15, 0]);
    ball(n, 'shell', [s * .31, .075, -.34 + i * .39], [.19, .29, .27]);
    box(n, 'teal', [s * .44, .11, -.34 + i * .39], [.045, .24, .29]);
  }
  const neck = part('neck', 'Helmet pitch collar', 'Head', 'Carry the elevated insect helmet on a short armoured neck.', 'A transverse bronze journal separates the deep thorax from the recognisable forward head and articulated sensor assembly.', body, [0, .14, -.12]);
  neck.position.set(0, .18, -.55);
  add(neck, 'cylinder', 'brass', [0, 0, 0], [.17, .47, .17], [0, 0, Math.PI / 2]);
  const helmet = part('helmet', 'Thick brow helmet', 'Head', 'Form a tall insect face with a protective crest above the paired compound eyes.', 'A solid domed brow and deep faceplate frame the mandibles, with no empty wire outline substituting for the head mass.', neck, [0, .20, -.13]);
  ball(helmet, 'shell', [0, .12, -.12], [.34, .34, .30]);
  box(helmet, 'teal', [0, .31, -.12], [.18, .12, .40], [-.2, 0, 0]);
  ball(helmet, 'dark', [0, -.05, -.33], [.23, .19, .10]);
  box(helmet, 'brass', [0, -.03, -.414], [.13, .12, .035]);
  const eyes = [-1, 1].map(s => {
    const n = part(`eye.${sid(s)}`, `${sideName(s)} compound eye yoke`, 'Optical sensors', 'Mount a large prominent eye on each side of the helmet.', 'The dark armoured yoke sweeps gently relative to the head, preserving a recognisable grasshopper profile at small screen sizes.', helmet, [s * .15, .12, -.07]);
    n.position.set(s * .29, .15, -.22);
    ball(n, 'dark', [0, 0, 0], [.15, .22, .17]);
    const lens = part(`eye.${sid(s)}.lens`, `${sideName(s)} compound optical face`, 'Optical sensors', 'Present a broad luminous optical surface inside the heavy eye housing.', 'The filled cyan lens tilts independently in its yoke; three bronze facets distinguish the front from the helmet armour.', n, [s * .08, .04, -.08]);
    ball(lens, 'lens', [s * .03, 0, -.06], [.13, .19, .12]);
    for (const y of [-.11, 0, .11]) box(lens, 'brass', [0, y, -.17], [.13, .013, .018]);
    return { n, lens, s };
  });
  const jaws = [-1, 1].map(s => {
    const n = part(`jaw.${sid(s)}`, `${sideName(s)} geared mandible`, 'Mouthparts', 'Open a substantial opposed mandible beneath the faceplate.', 'The two jaws sweep inward with independent phase offsets; this is a feeding gesture rather than a simulated bite or contact load.', helmet, [s * .10, -.13, -.14]);
    n.position.set(s * .13, -.17, -.31);
    ball(n, 'teal', [s * .02, -.07, -.07], [.11, .12, .13]);
    rod(n, 'brass', [0, 0, 0], [-s * .10, -.10, -.15], .035);
    const palps = [0, 1].map(j => {
      const p = part(`jaw.${sid(s)}.palp${j + 1}`, `${sideName(s)} mandible palp ${j + 1}`, 'Mouthparts', 'Articulate a short tactile palp alongside the moving mandible.', 'Each rigid finger pivots relative to its jaw carrier and ends in a rounded tip, making the layered mouth motion visible.', n, [s * .08, -.06, -.10]);
      p.position.set(s * (.05 + j * .07), -.03, -.06);
      rod(p, 'titanium', [0, 0, 0], [s * .02, -.05, -.19], .028);
      ball(p, 'shell', [s * .02, -.05, -.19], [.045, .045, .055]);
      return p;
    });
    return { n, palps, s };
  });
  const antennae = [-1, 1].map(s => {
    let parent = helmet;
    return Array.from({ length: 6 }, (_, i) => {
      const length = .195 - i * .009, radius = .046 - i * .004;
      const n = part(`antenna.${sid(s)}${i + 1}`, `${sideName(s)} antenna link ${i + 1}`, 'Segmented antennae', 'Continue a long articulated sensor feeler with a rigid tapered element.', 'Six serial joints per side carry delayed yaw and pitch waves; each child starts at the preceding element tip without stretching.', parent, [s * .05, .06, -.06]);
      if (!i) n.position.set(s * .18, .37, -.20); else n.position.y = .195 - (i - 1) * .009;
      rod(n, 'titanium', [0, 0, 0], [0, length, 0], radius * .60);
      ball(n, 'dark', [0, 0, 0], [radius, radius, radius]);
      const sleeve = part(`antenna.${sid(s)}${i + 1}.sleeve`, `${sideName(s)} antenna link ${i + 1} sleeve`, 'Sensor armour', 'Protect the individual antenna element while leaving its joint exposed.', 'A short thick teal sleeve and bronze coupling follow this one rigid link, not a single unarticulated antenna rod.', n, [s * .045, 0, -.02]);
      add(sleeve, 'cylinder', 'teal', [0, length * .48, 0], [radius * .83, length * .65, radius * .83]);
      add(sleeve, 'cylinder', 'brass', [0, length * .73, 0], [radius * .90, .022, radius * .90]);
      parent = n; return { n, i, s };
    });
  });
  const gearbox = part('drive.housing', 'Open dorsal gearbox', 'Powertrain', 'Hold the visible three-wheel timing transmission over the thoracic load box.', 'Two side cheeks and a lower tray deliberately leave the upper gear teeth exposed for inspection; no torque solution is implied.', body, [0, .2, 0]);
  box(gearbox, 'teal', [0, .24, .12], [.59, .07, .35]);
  for (const s of [-1, 1]) box(gearbox, 'shell', [s * .29, .31, .12], [.04, .17, .37]);
  const gears = [0, 1, 2].map(i => {
    const n = part(`drive.gear${i + 1}`, `Timing spur wheel ${i + 1}`, 'Powertrain', 'Transfer the master phase across a visible equal-wheel gear train.', 'Opposite angular signs and equal pitch spacing illustrate a meshed transfer pair; tooth contact and transmitted torque are not solved.', gearbox, [0, .16 + i * .04, 0]);
    n.position.set((i - 1) * .18, .315, .12); gear(n, .09, 16, .04); return n;
  });
  const shaft = part('drive.shaft', 'Four-lobe longitudinal camshaft', 'Powertrain', 'Coordinate the pump bank with four master-cycle shaft revolutions.', 'The eccentric cam lobes turn with the rigid shaft while the separate plungers reciprocate at matching integer rates.', body, [0, .28, -.08]);
  shaft.position.set(0, .28, -.26);
  rod(shaft, 'titanium', [0, 0, -.22], [0, 0, .20], .039);
  for (let i = 0; i < 4; i++) add(shaft, 'cylinder', 'brass', [.044 * Math.cos(i * Math.PI / 2), .044 * Math.sin(i * Math.PI / 2), -.18 + .11 * i], [.071, .028, .071], [Math.PI / 2, 0, 0]);
  const gyro = part('drive.gyro', 'Exposed outer gyroscope cage', 'Timing display', 'Suspend a visibly moving timing rotor over the front gearbox well.', 'Nested rigid gimbals turn at integer cycle ratios as an educational drive display, not a calculated attitude-control system.', body, [0, .26, 0]);
  gyro.position.set(0, .49, -.18); ring(gyro, 'brass', [0, 0, 0], .17, [0, 0, 0]);
  rod(gyro, 'titanium', [-.19, 0, 0], [.19, 0, 0], .018);
  const inner = part('drive.gyro.inner', 'Inner gyroscope gimbal', 'Timing display', 'Carry the flywheel on a second independent rigid rotation axis.', 'This smaller teal ring rotates relative to the bronze parent cage rather than merely inheriting whole-body movement.', gyro, [.10, .1, 0]);
  ring(inner, 'teal', [0, 0, 0], .135, [Math.PI / 2, 0, 0]);
  const rotor = part('drive.gyro.rotor', 'Copper timing flywheel', 'Timing display', 'Make the innermost moving drive element visible between the gimbal rings.', 'An asymmetric bronze pointer and copper spokes expose rotation even when the circular rim alone would look stationary.', inner, [0, .12, .1]);
  ball(rotor, 'lens', [0, 0, 0], [.057, .057, .057]);
  for (let j = 0; j < 4; j++) rod(rotor, 'copper', [0, 0, 0], [.10 * Math.cos(j * TAU / 4), .10 * Math.sin(j * TAU / 4), 0], .017);
  box(rotor, 'brass', [0, .08, .01], [.035, .08, .027]);
  const pumps = Array.from({ length: 4 }, (_, i) => {
    const sleeve = part(`pump.${i + 1}`, `Cam pump ${i + 1} sleeve`, 'Pump bank', 'Guide one visible reciprocating plunger beside the camshaft.', 'The fixed pressure sleeve follows the chassis while its independent rod follows a quarter-turn-offset cam phase.', body, [i % 2 ? .13 : -.13, .14, 0]);
    sleeve.position.set(i % 2 ? .21 : -.21, .25, -.42 + Math.floor(i / 2) * .22);
    add(sleeve, 'cylinder', 'dark', [0, 0, 0], [.053, .17, .053]);
    add(sleeve, 'cylinder', 'copper', [0, .08, 0], [.061, .03, .061]);
    const n = part(`pump.${i + 1}.plunger`, `Cam pump ${i + 1} plunger`, 'Pump bank', 'Reciprocate inside the pressure sleeve without stretching it.', 'The polished rod and broad crosshead remain rigid while translating at the camshaft rate; fluid pressure is not computed.', sleeve, [0, .16, 0]);
    add(n, 'cylinder', 'titanium', [0, .07, 0], [.023, .18, .023]);
    box(n, 'brass', [0, .16, 0], [.09, .036, .06]); return n;
  });
  const legs = LEGS.map(l => {
    const id = `leg.${l.id}`, name = `${sideName(l.side)} ${['fore', 'middle', 'jumping'][l.station]} leg`, width = l.hind ? .185 : .093;
    const coxa = part(`${id}.coxa`, `${name} coxa`, 'Six-leg linkage', 'Offset the hip from the thoracic bearing by a rigid 120 mm link.', 'Its actual local positive-Y member ends meet the body root and the solved hip; no root-level double transform is applied.', undefined, [l.side * .12, .05, 0]);
    member(coxa, D.coxa, .077);
    const upper = part(`${id}.upper`, `${name} ${l.upper * 1000} mm femur`, 'Six-leg linkage', l.hind ? 'Store the visual preload gesture in a huge forward-folding armoured jumping thigh.' : 'Carry a walking knee with a substantial fixed-length upper member.', 'Exact two-link inverse kinematics places the knee on the reach-sphere intersection; no length scaling is allowed to rescue an unreachable target.', undefined, [l.side * .20, .07, 0]);
    member(upper, l.upper, width); cover(`${id}.upper-cover`, upper, l.upper, width, `${name} femur armour`);
    const lower = part(`${id}.lower`, `${name} ${l.lower * 1000} mm tibia`, 'Six-leg linkage', 'Connect the high folded knee to the independently level ankle and sole.', 'A rigid positive-Y member uses the exact sampled knee and ankle endpoints through walking, airborne extension and landing compression.', undefined, [l.side * .28, .04, 0]);
    member(lower, l.lower, l.hind ? .085 : .065); cover(`${id}.lower-cover`, lower, l.lower, l.hind ? .085 : .065, `${name} tibia armour`);
    const bearing = part(`${id}.bearing`, `${name} double knee bearing`, 'Knee transmission', 'Support the enlarged knee axle on two distinct bronze bearing cheeks.', 'The paired visible races follow the tibia frame at the solved knee, making relative knee rotation readable beside the thick femur.', lower, [l.side * .15, 0, 0]);
    for (const s of [-1, 1]) ring(bearing, 'brass', [s * (width + .03), 0, 0], l.hind ? .125 : .072);
    const foot = part(`${id}.foot`, `${name} level ground sole`, 'Ground contact', 'Stand directly on a broad level rubber sole, with no pedestal or stand.', 'The sole is world-fixed during stance and transfers smoothly toward a body-frame airborne target; this is prescribed contact rather than contact dynamics.', undefined, [l.side * .3, -.08, 0]);
    ball(foot, 'rubber', [0, -.025, 0], [.09, .03, .14]);
    ball(foot, 'shell', [0, .016, -.01], [.09, .05, .12]);
    rod(foot, 'teal', [0, .015, 0], [0, D.ankle, 0], .045);
    const ankle = part(`${id}.ankle`, `${name} raised ankle journal`, 'Ground contact', 'Keep the tibia joint 140 mm above the foot datum and 195 mm above the grounded sole bottom.', 'A distinct raised journal and visible stem avoid embedding the ankle or toe joints in the floor as the knees compress.', foot, [0, .1, 0]);
    ankle.position.y = D.ankle; ball(ankle, 'brass', [0, 0, 0], [.061, .061, .061]);
    for (const s of [-1, 1]) {
      const toe = part(`${id}.toe${sid(s)}`, `${name} ${sideName(s).toLowerCase()} toe`, 'Ground contact', 'Spread the ground pad into a paired forward-facing toe claw.', 'Each filled toe is rigidly attached to the level foot frame with positive sole clearance, rather than following the sloping tibia.', foot, [s * .08, 0, -.05]);
      ball(toe, 'brass', [s * .04, .09, -.04], [.025, .025, .025]);
      rod(toe, 'teal', [s * .04, .09, -.04], [s * .07, -.006, -.19], .027);
      ball(toe, 'titanium', [s * .07, -.006, -.19], [.035, .031, .067]);
    }
    const actuator = ram(`${id}.ram`, name, l.hind ? .27 : .19);
    let spring;
    if (l.hind) {
      spring = part(`${id}.spring`, `${name} helical torsion drive`, 'Preload transmission', 'Expose a heavy coiled torsion element next to the enlarged knee.', 'Five visible helical turns surround the knee axis and a winding arm follows the relative knee angle; spring force and stored energy are not solved.', upper, [l.side * .20, .06, 0]);
      spring.position.set(l.side * .22, l.upper, 0);
      for (let j = 0; j < 60; j++) {
        const at = k => [l.side * k * .0021, .091 * Math.cos(k * TAU / 12), .091 * Math.sin(k * TAU / 12)];
        rod(spring, 'copper', at(j), at(j + 1), .013);
      }
      rod(spring, 'brass', [0, 0, 0], [0, .17, .06], .026);
      const drum = part(`${id}.drum`, `${name} knee winding drum`, 'Preload transmission', 'Display the toothed input drum beside the paired knee bearings.', 'The drum is attached to the lower-member frame so its rotation is the actual relative knee rotation, not an unrelated spinning decoration.', lower, [l.side * .25, .06, 0]);
      drum.position.x = l.side * .23; drum.rotation.z = Math.PI / 2; gear(drum, .098, 16, .04);
    }
    return { coxa, upper, lower, foot, actuator, spring };
  });
  const abdomen = D.abdomen.map((length, i) => {
    const width = .34 - i * .034, depth = .18 - i * .014;
    const n = part(`abdomen.${i + 1}`, `Abdominal spine link ${i + 1}`, 'Eight-link abdomen', 'Extend the thorax into a long tapering rigid-link abdomen.', 'Serial yaw and pitch joints pass a delayed breathing wave along eight real members, preserving each link length and a continuous plated silhouette.', undefined, [0, .08 + i * .012, .1 + i * .025]);
    box(n, 'dark', [0, length / 2, 0], [width * 1.65, length, depth * 1.4]);
    add(n, 'cylinder', 'brass', [0, 0, 0], [depth * .5, width * 1.9, depth * .5], [0, 0, Math.PI / 2]);
    const plate = part(`abdomen.${i + 1}.plate`, `Abdominal dorsal plate ${i + 1}`, 'Breathing armour', 'Overlap the adjacent spine links with a broad thick pale tergite.', 'The plate lifts about its own longitudinal hinge with the delayed ventilation wave while the underlying vertebra stays rigid.', n, [0, 0, -.16]);
    ball(plate, 'shell', [0, length * .45, -.025], [width, length * .70, depth]);
    box(plate, 'teal', [0, length * .42, -depth], [width * .65, length * .87, .027]);
    const sides = [-1, 1].map(s => {
      const p = part(`abdomen.${i + 1}.${sid(s)}`, `Abdominal link ${i + 1} ${sideName(s).toLowerCase()} pleuron`, 'Breathing armour', 'Close the side of a tapering abdominal segment with an independently breathing plate.', 'The solid lamella rotates relative to its own vertebra, leaving an alternating dark ventilation seam without a skeletal body outline.', n, [s * .1, .03, -.08]);
      p.position.x = s * width * .7;
      ball(p, 'teal', [s * width * .16, length * .46, .015], [width * .32, length * .65, depth * .77]);
      box(p, 'brass', [s * width * .23, length * .45, -depth * .65], [width * .23, length * .7, .017]);
      return { p, s };
    });
    return { n, plate, sides };
  });
  const wings = [-1, 1].map(s => {
    const name = sideName(s), id = `wing.${sid(s)}`;
    const root = part(`${id}.root`, `${name} folding fan-wing shoulder`, 'Fan wings', 'Carry the folding hindwing on a substantial hinged shoulder spar.', 'The wing root changes elevation slowly during the hop, independently of the forewing cover and the seven separately opening solid panels.', body, [s * .2, .2, .05]);
    root.position.set(s * .26, .28, .12);
    rod(root, 'teal', [0, 0, 0], [0, .40, 0], .063);
    ring(root, 'brass', [0, 0, 0], .088);
    const panels = Array.from({ length: 7 }, (_, j) => {
      const length = 1.06 - .025 * Math.abs(j - 3);
      const n = part(`${id}.fan${j + 1}`, `${name} filled fan panel ${j + 1}`, 'Fan wings', 'Open one independently hinged broad blade in a seven-panel folding fan.', 'A filled thick alloy blade overlaps its neighbours when furled, then spreads with its own angle; this is not a wire wing or a lift calculation.', root, [s * .06, j * .02, .06]);
      n.position.set(0, .05, .007 * j);
      box(n, j % 2 ? 'shell' : 'teal', [0, length * .56, 0], [.205, length * .80, .032]);
      ball(n, j % 2 ? 'shell' : 'teal', [0, length * .90, 0], [.1025, length * .13, .022]);
      const spar = part(`${id}.fan${j + 1}.spar`, `${name} fan panel ${j + 1} batten`, 'Wing battens', 'Stiffen the filled blade with a thick leading spar and two cross battens.', 'The spar belongs to this individual panel and reaches its tip, so panel spreading separates real rigid ribs instead of scaling a single membrane.', n, [0, 0, .055]);
      rod(spar, 'brass', [-.065, 0, .028], [-.065, length, .028], .020);
      for (const y of [.42, .76]) rod(spar, 'titanium', [-.085, length * y, .024], [.085, length * y + .06, .024], .015);
      return n;
    });
    const hinge = part(`${id}.cover-hinge`, `${name} forewing cover hinge`, 'Forewing covers', 'Support the broad protective forewing over the folding fan.', 'A separate long bronze hinge is attached to the thorax, allowing the cover to open without dragging the fan shoulder with it.', body, [s * .17, .16, 0]);
    hinge.position.set(s * .14, .35, .02); rod(hinge, 'brass', [0, 0, 0], [0, 0, .72], .037);
    const cover = part(`${id}.cover`, `${name} overlapping forewing cover`, 'Forewing covers', 'Enclose the delicate folded fan beneath a broad thick overlapping elytron-like cover.', 'The rigid pale cover rolls upward and pitches clear before the fan spreads, then closes smoothly over the reset wing.', hinge, [s * .2, .24, .06]);
    ball(cover, 'shell', [s * .13, .015, .55], [.29, .082, .76]);
    box(cover, 'teal', [s * .19, .079, .53], [.22, .038, 1.08]);
    for (let j = 0; j < 4; j++) rod(cover, 'brass', [s * .03, .065, .14 + .24 * j], [s * .37, .05, .25 + .24 * j], .015);
    return { root, panels, cover, s };
  });

  const binds = [];
  kit.group.traverse(n => { if (n.userData.partId) binds.push({ n, p: n.position.clone(), q: n.quaternion.clone(), s: n.scale.clone() }); });
  function update(state = current, options = {}) {
    if (disposed) return;
    current = state;
    for (const b of binds) { b.n.position.copy(b.p); b.n.quaternion.copy(b.q); b.n.scale.copy(b.s); }
    place(body, state.origin, state.bodyFrame);
    const a = state.phase * TAU;
    neck.rotation.x = .04 * Math.sin(a * 2);
    eyes.forEach(({ n, lens, s }) => { n.rotation.y = .16 * Math.sin(a * 2 + s); lens.rotation.x = .12 * Math.sin(a * 3 + s); });
    jaws.forEach(({ n, palps, s }, i) => { n.rotation.y = s * state.rates.jaw[i]; palps.forEach((p, j) => { p.rotation.x = .22 * Math.sin(a * 3 + j + i); }); });
    antennae.forEach((chain, side) => chain.forEach(({ n, i, s }) => {
      n.rotation.x = (i ? -.025 : -.94) + state.rates.antenna[side][i].pitch;
      n.rotation.z = (i ? 0 : -s * .18) + state.rates.antenna[side][i].yaw;
    }));
    shaft.rotation.z = state.rates.shaft;
    gears.forEach((n, i) => { n.rotation.y = state.rates.gears[i] + (i % 2 ? Math.PI / 16 : 0); });
    gyro.rotation.x = state.rates.gyro[0]; inner.rotation.y = state.rates.gyro[1]; rotor.rotation.z = state.rates.gyro[2];
    pumps.forEach((n, i) => { n.position.y = state.rates.pump[i]; });
    legs.forEach((n, i) => {
      const l = state.legs[i];
      place(n.coxa, l.root, l.frames.coxa); place(n.upper, l.hip, l.frames.upper); place(n.lower, l.knee, l.frames.lower);
      n.foot.position.fromArray(l.foot);
      const r = l.ram, sleeve = n.actuator.sleeve, start = sleeve - .025;
      aim(n.actuator.barrel, r.a, r.b);
      aim(n.actuator.piston, plus(r.a, mul(sub(r.b, r.a), start / r.length)), r.b);
      n.actuator.piston.scale.y = r.length - start; n.actuator.eye.position.fromArray(r.b);
      if (n.spring) n.spring.rotation.x = Math.acos(Math.max(-1, Math.min(1, dot(mul(sub(l.knee, l.hip), 1 / l.upper), mul(sub(l.ankle, l.knee), 1 / l.lower)))));
    });
    abdomen.forEach(({ n, plate, sides }, i) => {
      const seg = state.abdomen[i]; place(n, seg.start, seg.frame);
      plate.position.z -= .055 * seg.breath; plate.rotation.y = .09 * Math.sin(a * 3 - i * .5);
      sides.forEach(({ p, s }) => { p.rotation.y = s * seg.breath; });
    });
    wings.forEach(({ root, panels, cover, s }) => {
      root.rotation.x = Math.PI / 2 - .12 - .16 * state.acts.flare;
      root.rotation.z = s * state.rates.wing;
      panels.forEach((n, i) => { n.rotation.z = -s * state.rates.fans[i]; });
      cover.rotation.z = s * state.rates.cover; cover.rotation.x = -.25 * state.acts.flare;
    });
    // Upload root-local matrices so scene placement is applied only once.
    kit.group.updateWorldMatrix(true, false);
    const rootWorld = kit.group.matrixWorld.clone(); kit.group.matrixWorld.identity();
    kit.sync(options); kit.group.matrixWorld.copy(rootWorld); kit.group.updateWorldMatrix(false, true);
  }
  const framePoints = [], seen = new Set(), instance = new THREE.Matrix4(), point = new THREE.Vector3();
  for (const input of [{ jump: .8, display: .7 }, ...[.5, 1].flatMap(jump => [0, 1].map(display => ({ jump, display })))]) for (let i = 0; i < 32; i++) {
    update(poseAt(i / 32, input));
    for (const mesh of kit.pickables) {
      mesh.geometry.computeBoundingBox(); const b = mesh.geometry.boundingBox;
      for (let j = 0; j < mesh.count; j++) {
        mesh.getMatrixAt(j, instance);
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          point.set(x, y, z).applyMatrix4(instance);
          const key = `${Math.round(point.x / .065)},${Math.round(point.y / .065)},${Math.round(point.z / .065)}`;
          if (!seen.has(key)) { seen.add(key); framePoints.push(point.clone()); }
        }
      }
    }
  }
  update(sample(0));
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update, framePoints, maxViewDistance: 24,
    views: { home: [4.3, 3.4, -6.4], front: [0, 2.4, -6.5], side: [6.4, 2.3, -.4], top: [.1, 7, -.1], detail: [3.1, 2.8, -4.5], exploded: [4.5, 4.3, -6] },
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (!disposed) { disposed = true; kit.dispose(); kit.group.clear(); } } };
}
