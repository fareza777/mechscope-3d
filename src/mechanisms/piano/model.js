import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, NOTES, NOTE_COUNT, TAU, poseAt, sample } from './kin.js';

const OUTLINE = [
  [-.78, .80], [.78, .80], [.80, .56], [.76, .18], [.68, -.20], [.54, -.60],
  [.32, -.92], [.04, -1.08], [-.28, -1.10], [-.58, -.96], [-.74, -.70], [-.80, -.34], [-.79, .10], [-.78, .46],
];

export function createModel() {
  const kit = createMechanicalKit('HARMONIA P8 · concert grand automaton');
  const nodes = [], keys = [], hammers = [], dampers = [], pedals = [];
  const add = kit.add, rod = kit.rod, aim = kit.aim;
  let disposed = false, lastState = sample(0);
  const part = (id, name, system, purpose, how, parent, explode = [0, .10, 0], material = 'Pale alloy, dark action felt and brass hardware') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const plate = (node, material, p, size, euler = [0, 0, 0], detail = false) => add(node, 'box', material, p, size, euler, detail);
  const axial = (node, material, p, radius, length, axis = 'y', detail = false) => {
    const euler = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'cylinder', material, p, [radius, length, radius], euler, detail);
  };

  // ---------------------------------------------------------------- case
  const rim = part('case.rim', 'Bent outer rim and laminated posts', 'Case',
    'Forms the rigid curved shell of the grand piano.',
    'Three laminated horizontal rails and fourteen vertical posts follow a closed grand-piano outline without filling the interior.', undefined, [0, .05, 0], 'Laminated pale alloy rim and dark posts');
  for (const y of [.20, .55, .92]) {
    for (let i = 0; i < OUTLINE.length; i++) {
      const a = OUTLINE[i], b = OUTLINE[(i + 1) % OUTLINE.length];
      rod(rim, 'shell', [a[0], y, a[1]], [b[0], y, b[1]], .018);
    }
  }
  for (const [x, z] of OUTLINE) {
    rod(rim, 'dark', [x, .18, z], [x, .94, z], .020);
    add(rim, 'sphere', 'brass', [x, .95, z], [.025, .021, .025], [0, 0, 0], true);
  }
  for (const y of [.34, .74]) {
    for (let i = 0; i < OUTLINE.length; i += 2) {
      const point = OUTLINE[i];
      rod(rim, 'titanium', [point[0], y, point[1]], [0, y, -.10], .008, true);
    }
  }

  const innerRim = part('case.inner-rim', 'Inner rim and soundboard liner', 'Case',
    'Separates the soundboard from the structural outer rim.',
    'A second scaled outline and twelve short liner blocks leave a visible gap between the board and the bent rim.', undefined, [0, .04, 0]);
  for (const y of [.52, .90]) {
    for (let i = 0; i < OUTLINE.length; i++) {
      const a = OUTLINE[i], b = OUTLINE[(i + 1) % OUTLINE.length];
      rod(innerRim, 'titanium', [a[0] * .93, y, -.14 + (a[1] + .14) * .93], [b[0] * .93, y, -.14 + (b[1] + .14) * .93], .010);
    }
  }
  for (const [x, z] of OUTLINE) {
    if (Math.abs(x) < .4) continue;
    plate(innerRim, 'dark', [x * .90, .71, -.14 + (z + .14) * .90], [.09, .18, .06], [0, .2, 0], true);
  }

  const soundboard = part('case.soundboard', 'Spruce soundboard and ribs', 'Case',
    'Provides the large resonant surface under the strings.',
    'Eight pale board panels and five cross ribs fill the inner rim below the bridge without a closed acoustic cavity.', undefined, [0, .03, 0], 'Pale soundboard panels and dark ribs');
  for (let i = 0; i < 8; i++) {
    const z = .48 - i * .20;
    plate(soundboard, 'shell', [0, .50, z], [1.24 - i * .035, .018, .18]);
  }
  for (let i = 0; i < 5; i++) rod(soundboard, 'dark', [-.56, .47, .42 - i * .32], [.56, .47, .42 - i * .32], .010, true);

  const bridge = part('case.bridge', 'Long bridge and bridge pins', 'Case',
    'Couples the strings to the soundboard.',
    'A stepped dark bridge follows the string fan across the board, with forty-eight brass pins visible along its crown.', undefined, [0, .04, 0], 'Stepped dark bridge and brass pins');
  for (let i = 0; i < 24; i++) {
    const x = NOTES[i].x, z = .32 - i * .045;
    rod(bridge, 'dark', [x - .05, .53, z], [x + .05, .53, z - .01], .010);
    add(bridge, 'cylinder', 'brass', [x, .55, z], [.004, .02, .004], [0, 0, 0], true);
  }
  const bassBridge = part('case.bass-bridge', 'Bass bridge and cantilever', 'Case',
    'Carries the longer bass string courses.',
    'A dark cantilever bridge, six brass pins and a pale support foot sit across the wider bass corner of the board.', undefined, [0, .04, 0]);
  for (let i = 0; i < 8; i++) {
    const x = -.52 + i * .035;
    rod(bassBridge, 'dark', [x, .53, .10], [x + .06, .53, -.32], .012);
    add(bassBridge, 'cylinder', 'brass', [x + .05, .55, -.30], [.004, .02, .004], [0, 0, 0], true);
  }
  plate(bassBridge, 'shell', [-.48, .49, -.08], [.10, .05, .34], [0, .18, 0], true);

  const plate_ = part('case.iron-plate', 'Cast-iron plate and brass struts', 'Case',
    'Carries the string tension above the soundboard.',
    'A dark perimeter frame, five brass struts and eighteen bolt bosses leave the strings and hammers readable from above.', undefined, [0, .04, 0], 'Dark plate and brass struts');
  for (const side of [-1, 1]) rod(plate_, 'dark', [side * .70, .84, .62], [side * .70, .84, -.92], .028);
  for (let i = 0; i < 5; i++) rod(plate_, 'brass', [-.68, .84, .48 - i * .31], [.68, .84, .48 - i * .31], .016);
  for (let i = 0; i < 18; i++) {
    const a = i * TAU / 18;
    add(plate_, 'bolt', 'titanium', [.62 * Math.cos(a), .86, -.14 + .78 * Math.sin(a)], [.012, .016, .012], [0, 0, 0], true);
  }

  const bed = part('case.keybed', 'Keybed, balance rail and cheek blocks', 'Keyboard',
    'Supports the key frame and the front of the case.',
    'A dark keybed, a brass balance rail, seventeen front-rail pins and two pale cheek blocks frame the keyboard.', undefined, [0, .04, 0], 'Dark keybed and brass rail');
  plate(bed, 'dark', [0, .66, .86], [1.30, .075, .30]);
  rod(bed, 'brass', [-.62, .735, .88], [.62, .735, .88], .010);
  for (let i = 0; i < 17; i++) add(bed, 'cylinder', 'brass', [-.58 + i * .073, .765, .94], [.005, .025, .005], [0, 0, 0], true);
  for (const side of [-1, 1]) {
    plate(bed, 'shell', [side * .665, .79, .88], [.085, .22, .26]);
    add(bed, 'ring', 'brass', [side * .665, .80, .75], [.028, .028, .028], [0, Math.PI / 2, 0], true);
  }

  const fallboard = part('case.fallboard', 'Fallboard and name board', 'Keyboard',
    'Closes the space behind the keys and carries the maker plate.',
    'A pale fallboard, a dark felt strip and a teal maker plate sit above the rear key frame without covering the keys.', undefined, [0, .04, 0], 'Pale fallboard, dark felt and teal plate');
  plate(fallboard, 'shell', [0, .865, .735], [1.24, .16, .06]);
  plate(fallboard, 'dark', [0, .79, .755], [1.20, .025, .02]);
  plate(fallboard, 'teal', [0, .88, .70], [.42, .075, .012]);
  for (let i = 0; i < 3; i++) add(fallboard, 'bolt', 'brass', [-.16 + i * .16, .88, .69], [.008, .012, .008], [Math.PI / 2, 0, 0], true);

  const lidHinge = part('case.lid-hinge', 'Continuous lid hinge and three knuckles', 'Lid',
    'Defines the long hinge axis along the left side of the case.',
    'A continuous brass hinge leaf, three dark knuckles and six screws fix the lid to the bent rim.', undefined, [0, .03, 0], 'Brass hinge leaf and dark knuckles');
  rod(lidHinge, 'brass', [D.lidHinge[0], D.lidHinge[1], D.lidHinge[2] - .92], [D.lidHinge[0], D.lidHinge[1], D.lidHinge[2] + .92], .014);
  for (const z of [-.62, 0, .62]) axial(lidHinge, 'dark', [D.lidHinge[0], D.lidHinge[1], D.lidHinge[2] + z], .030, .11, 'z');
  for (let i = 0; i < 6; i++) add(lidHinge, 'bolt', 'titanium', [D.lidHinge[0] + .03, D.lidHinge[1] + .01, D.lidHinge[2] - .75 + i * .30], [.009, .012, .009], [Math.PI / 2, 0, 0], true);

  const lid = part('case.lid', 'Concert lid and inner rim seal', 'Lid',
    'Opens to reveal the strings, plate and hammers.',
    'A large pale lid, a dark inner seal, four cross ribs and a brass edge trim rotate as one rigid panel on the left hinge.', undefined, [0, .05, 0], 'Pale lid, dark seal and brass trim');
  lid.position.fromArray(D.lidHinge);
  plate(lid, 'shell', [D.lidWidth / 2, .012, 0], [D.lidWidth, .035, D.lidLength]);
  plate(lid, 'dark', [D.lidWidth / 2, -.012, 0], [D.lidWidth - .10, .012, D.lidLength - .12]);
  for (let i = 0; i < 4; i++) plate(lid, 'titanium', [D.lidWidth / 2, .035, -.66 + i * .44], [D.lidWidth - .12, .018, .035], [0, 0, 0], true);
  rod(lid, 'brass', [D.lidWidth - .015, .035, -.9], [D.lidWidth - .015, .035, .9], .010);

  const prop = part('lid.prop', 'Lid prop stick and floor cup', 'Lid',
    'Holds the open lid at the selected inspection angle.',
    'A slim brass-capped prop and a rubber cup are drawn between the case and the sampled lid underside.', undefined, [0, .04, 0], 'Brass-capped prop and rubber cup');
  add(prop, 'box', 'shell', [0, .5, 0], [.014, 1, .014]);
  add(prop, 'cylinder', 'brass', [0, .98, 0], [.020, .045, .020]);
  add(prop, 'cylinder', 'rubber', [0, 0, 0], [.024, .025, .024]);

  const music = part('case.music-desk', 'Music desk and brass rail', 'Keyboard',
    'Provides the score rest above the fallboard.',
    'A tilted pale panel, two dark side supports, a brass retaining rail and four page fingers sit behind the keys.', undefined, [0, .04, 0], 'Pale desk panel and brass rail');
  plate(music, 'shell', [0, 1.02, .50], [1.02, .36, .022], [-.22, 0, 0]);
  for (const side of [-1, 1]) rod(music, 'dark', [side * .48, .86, .55], [side * .48, 1.18, .43], .012);
  rod(music, 'brass', [-.48, .86, .58], [.48, .86, .58], .009);
  for (let i = 0; i < 4; i++) add(music, 'bolt', 'brass', [-.34 + i * .22, 1.06, .47], [.007, .012, .007], [0, 0, 0], true);

  // ---------------------------------------------------------------- legs and pedals
  for (const [index, [x, z]] of [[-.62, .72], [.62, .72], [0, -.94]].entries()) {
    const leg = part(`leg.${index + 1}`, `Case leg ${index + 1} of three`, 'Support',
      'Carries one corner of the grand piano case.',
      'A tapered pale column, a brass ferrule and a bolted top plate sit between the case and the caster.', undefined, [0, .03, 0], 'Tapered pale column and brass ferrule');
    axial(leg, 'shell', [x, .34, z], .055, .54, 'y');
    add(leg, 'cylinder', 'brass', [x, .09, z], [.060, .05, .060], [0, 0, 0]);
    plate(leg, 'dark', [x, .615, z], [.15, .035, .15]);
    for (let i = 0; i < 3; i++) add(leg, 'bolt', 'titanium', [x + .05 * Math.cos(i * TAU / 3), .635, z + .05 * Math.sin(i * TAU / 3)], [.007, .01, .007], [0, 0, 0], true);
  }
  for (const [index, [x, z]] of [[-.62, .72], [.62, .72], [0, -.94]].entries()) {
    const caster = part(`caster.${index + 1}`, `Brass caster ${index + 1} of three`, 'Support',
      'Lets the instrument be moved without lifting the case.',
      'A brass swivel fork, a dark rubber wheel and a polished axle pin sit under the leg ferrule.', undefined, [0, .02, 0], 'Brass swivel fork and rubber wheel');
    add(caster, 'cylinder', 'brass', [x, .045, z], [.045, .03, .045]);
    add(caster, 'ring', 'brass', [x, .025, z], [.035, .035, .035], [0, Math.PI / 2, 0]);
    add(caster, 'cylinder', 'rubber', [x, .018, z], [.038, .028, .038], [0, 0, Math.PI / 2]);
    add(caster, 'bolt', 'titanium', [x, .018, z], [.012, .055, .012], [0, 0, Math.PI / 2], true);
  }

  for (const [index, x] of [-.16, 0, .16].entries()) {
    const pedal = part(`pedal.${index + 1}`, `${['Soft', 'Sostenuto', 'Sustain'][index]} pedal and hinge`, 'Pedals',
      index === 2 ? 'Lifts every damper when depressed.' : 'Shows the pedal mechanism under the keyboard.',
      'A brass pedal plate, a dark hinge block and a felt bumper turn on a transverse pivot under the keybed.', undefined, [0, .03, 0], 'Brass pedal and dark hinge block');
    pedal.position.set(x, .10, 1.00);
    plate(pedal, 'brass', [0, 0, .12], [.045, .018, .24]);
    add(pedal, 'ring', 'brass', [0, 0, .22], [.025, .025, .025], [0, Math.PI / 2, 0]);
    add(pedal, 'box', 'dark', [0, 0, .015], [.05, .035, .05]);
    pedals.push(pedal);
  }
  const lyre = part('pedal.lyre', 'Pedal lyre and three rods', 'Pedals',
    'Suspends the pedals from the keybed.',
    'Two dark lyre posts, a brass crossbar and three slim rods reach the pedal hinges without filling the floor space.', undefined, [0, .03, 0], 'Dark lyre posts and brass rods');
  for (const side of [-1, 1]) rod(lyre, 'dark', [side * .11, .18, .93], [side * .11, .66, .93], .016);
  rod(lyre, 'brass', [-.20, .22, .93], [.20, .22, .93], .010);
  for (const x of [-.16, 0, .16]) rod(lyre, 'titanium', [x, .22, .97], [x, .135, 1.06], .005, true);

  // ---------------------------------------------------------------- keyboard and action
  NOTES.forEach(note => {
    const label = note.name.replace('#', '♯');
    const key = part(`key.${String(note.index + 1).padStart(2, '0')}`, `Key ${String(note.index + 1).padStart(2, '0')} · ${label}`, 'Keyboard',
      `Turns the ${label} action through a ${note.black ? 'black' : 'white'} key lever.`,
      'A pale or dark key lever, a brass balance bushing and a front-rail felt washer pivot at the rear key frame.', undefined, [0, .05, 0], note.black ? 'Dark ebony key and brass bushing' : 'Pale key and brass bushing');
    key.position.set(note.x, D.keyboardY, D.keyboardBack);
    if (note.black) {
      plate(key, 'dark', [0, .035, .055], [D.blackWidth, .028, .108]);
      plate(key, 'titanium', [0, .052, .055], [D.blackWidth * .72, .006, .095], [0, 0, 0], true);
    } else {
      plate(key, 'shell', [0, .012, .095], [D.whiteWidth, .022, .176]);
      plate(key, 'titanium', [0, .026, .095], [D.whiteWidth * .80, .006, .160], [0, 0, 0], true);
    }
    add(key, 'ring', 'brass', [0, -.012, 0], [.014, .014, .014], [Math.PI / 2, 0, 0]);
    keys.push(key);

    const hammer = part(`hammer.${String(note.index + 1).padStart(2, '0')}`, `Hammer ${String(note.index + 1).padStart(2, '0')} · ${label}`, 'Action',
      `Strikes the ${label} string course when the key is played.`,
      'A dark shank, a brass butt and a pale felt head rotate about the hammer rail without a jack or repetition lever solver.', undefined, [0, .04, 0], 'Dark shank, brass butt and pale felt head');
    hammer.position.set(note.x, D.hammerPivotY, D.hammerPivotZ);
    rod(hammer, 'dark', [0, 0, 0], [0, .012, .16], .006);
    add(hammer, 'ring', 'brass', [0, 0, 0], [.018, .018, .018], [0, Math.PI / 2, 0]);
    plate(hammer, 'shell', [0, .052, .16], [.040, .032, .030]);
    add(hammer, 'sphere', 'rubber', [0, .052, .178], [.018, .010, .012], [0, 0, 0], true);
    hammers.push(hammer);

    const damper = part(`damper.${String(note.index + 1).padStart(2, '0')}`, `Damper ${String(note.index + 1).padStart(2, '0')} · ${label}`, 'Action',
      `Lifts clear of the ${label} string when the key or sustain pedal is used.`,
      'A dark felt block, a brass wire and a pale damper head rise vertically from the damper rail.', undefined, [0, .04, 0], 'Dark felt block and brass wire');
    damper.position.set(note.x, D.stringY, D.damperZ);
    plate(damper, 'rubber', [0, .018, 0], [.042, .034, .060]);
    rod(damper, 'brass', [0, .03, 0], [0, .14, -.01], .004, true);
    add(damper, 'box', 'shell', [0, .045, 0], [.032, .02, .045], [0, 0, 0], true);
    dampers.push(damper);

    const string = part(`string.${String(note.index + 1).padStart(2, '0')}`, `String course ${String(note.index + 1).padStart(2, '0')} · ${label}`, 'Strings',
      `Provides the ${label} string course and its terminations.`,
      'Three parallel steel wires, a front tuning pin, a bridge pin and a rear hitch pin span the plate at the sampled course length.', undefined, [0, .04, 0], 'Steel wires and brass terminations');
    string.position.set(note.x, D.stringY, 0);
    for (const dx of [-.006, 0, .006]) {
      rod(string, 'titanium', [dx, 0, D.frontBridge], [dx, 0, note.tail], .0026);
    }
    add(string, 'cylinder', 'brass', [0, -.01, D.frontBridge], [.010, .020, .010], [0, 0, 0], true);
    add(string, 'cylinder', 'brass', [0, -.01, note.tail + .02], [.007, .016, .007], [0, 0, 0], true);
    add(string, 'box', 'dark', [0, .006, note.tail + .02], [.032, .012, .022], [0, 0, 0], true);
  });

  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.notes && state?.lid && state?.pedal) lastState = state;
    else if (Number.isFinite(state?.phase)) lastState = poseAt(state.phase * TAU, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    pose.notes.forEach((note, i) => {
      keys[i].rotation.x = note.keyAngle;
      hammers[i].rotation.x = note.hammerAngle;
      dampers[i].position.y += note.damperLift * .06;
      dampers[i].rotation.x = note.damperAngle;
    });
    lid.rotation.z = pose.lid.angle;
    const start = [0.60, .91, -.30];
    aim(prop, start, pose.lid.propEnd);
    prop.scale.y = Math.max(.001, Math.hypot(pose.lid.propEnd[0] - start[0], pose.lid.propEnd[1] - start[1], pose.lid.propEnd[2] - start[2]));
    pedals.forEach((node, i) => { node.rotation.x = pose.pedals[i].angle; });
    kit.sync(options);
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
