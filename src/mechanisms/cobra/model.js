import { createMechanicalKit } from '../mechanical-kit.js';
import { D, radiusAt, sample, poseAt } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('NAJA N18 · upright mechanical cobra');
  const { add, rod, gear, fasteners } = kit;
  const nodes = [], vertebrae = [], ribs = [];
  let current = sample(0), disposed = false;
  function part(id, name, system, purpose, how, parent, explode = [0, .1, 0], material = 'Titanium frame / brass bearings') {
    const node = kit.part({ id: `cobra.${id}`, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}. ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  }
  function eye(node, p, r = .021, reach = .025) {
    add(node, 'ring', 'brass', p, [r, r, r]);
    add(node, 'cylinder', 'titanium', [p[0], p[1], p[2] + reach / 2], [r * .36, reach + .018, r * .36], [Math.PI / 2, 0, 0]);
    add(node, 'bolt', 'dark', [p[0], p[1], p[2] + reach + .008], [r * .55, .01, r * .55], [Math.PI / 2, 0, 0]);
  }
  const plinth = part('plinth', 'Low rectangular inspection plinth', 'Ground support', 'Carries the restrained tail above the floor.', 'A broad base and two rising saddles support the first fixed cartridges.', undefined, [0, 0, 0]);
  add(plinth, 'box', 'dark', [0, .025, .30], [.58, .05, .56]);
  add(plinth, 'box', 'shell', [0, .055, .30], [.53, .016, .51]);
  for (const x of [-.23, .23]) for (const z of [.10, .50]) {
    add(plinth, 'cylinder', 'rubber', [x, .015, z], [.028, .03, .028]);
    fasteners(plinth, [[x, .066, z]], .011);
  }
  const saddle = part('saddle', 'Restrained tail double saddle', 'Ground support', 'Transfers the spine load directly into the plinth.', 'Two cross-journals are supported by short gusseted legs at the first two pins.', undefined, [0, 0, 0]);
  for (const p of [D.base, current.spine[1].start]) {
    for (const x of [-.065, .065]) {
      rod(saddle, 'titanium', [x, .064, p[2]], [x, p[1], p[2]], .019);
      rod(saddle, 'dark', [x * 1.8, .064, p[2] + .045], [x, p[1], p[2]], .011);
    }
    rod(saddle, 'brass', [-.078, p[1], p[2]], [.078, p[1], p[2]], .015);
  }
  const supply = part('plinth.supply', 'Tail service distribution block', 'Electrical service', 'Routes the inspection command into the stationary tail saddle.', 'A terminal comb and paired conductors remain visible behind the saddle.', undefined, [.1, .04, .06], 'Copper conductors / dark insulation');
  add(supply, 'box', 'dark', [0, .087, .51], [.20, .042, .07]);
  for (let i = 0; i < 8; i++) {
    add(supply, 'box', 'copper', [-.084 + i * .024, .111, .51], [.012, .008, .052]);
    rod(supply, 'copper', [-.084 + i * .024, .10, .48], [-.052 + i * .015, .137, .44], .0035, true);
  }

  for (let i = 0; i < D.count; i++) {
    const r = radiusAt(i), length = D.length, label = `Vertebra ${String(i + 1).padStart(2, '0')}`;
    const frame = part(`spine.${i}.frame`, `${label} open cartridge`, 'Serial spine', 'Preserves a rigid 114 mm joint spacing.', 'Four separated rails join the two annular bulkheads; offset copper tendon guides follow this member.', undefined, [0, .03 + i * .005, .08]);
    for (const y of [.022, length - .022]) add(frame, 'ring', 'dark', [0, y, 0], [r, r, r], [Math.PI / 2, 0, 0]);
    for (const x of [-1, 1]) for (const z of [-1, 1]) rod(frame, 'titanium', [x * r * .64, .017, z * r * .64], [x * r * .64, length - .017, z * r * .64], .006);
    for (const s of [-1, 1]) {
      rod(frame, 'copper', [s * (r + .013), .012, .016], [s * (r + .013), length - .012, .016], .0045);
      for (const y of [.026, length - .026]) rod(frame, 'titanium', [s * r * .65, y, .016], [s * (r + .017), y, .016], .004);
      rod(frame, 'dark', [s * r * .64, .025, -r * .64], [-s * r * .64, length - .025, -r * .64], .0035, true);
    }
    const gimbal = part(`spine.${i}.gimbal`, `${label} transverse gimbal`, 'Vertebral joints', 'Locates the moving frame on the previous joint pin.', 'An exposed cross-axis journal and orthogonal trunnion form a compact two-axis cartridge.', frame, [0, 0, .06]);
    eye(gimbal, [0, 0, 0], .025, r + .027);
    rod(gimbal, 'titanium', [-r - .012, 0, 0], [r + .012, 0, 0], .010);
    for (const s of [-1, 1]) add(gimbal, 'bolt', 'dark', [s * (r + .013), 0, 0], [.016, .012, .016], [0, 0, Math.PI / 2]);
    const wheel = part(`spine.${i}.wheel`, `${label} joint indexing wheel`, 'Vertebral timing', 'Displays the local articulation at an offset journal.', 'The toothed plate is behind the rail lane, connected by the long transverse journal.', frame, [0, 0, .11]);
    wheel.position.z = r + .025; wheel.rotation.x = Math.PI / 2;
    gear(wheel, .027, 10, .012);
    for (const s of [-1, 1]) {
      const armor = part(`spine.${i}.armor.${s}`, `${label} ${s < 0 ? 'left' : 'right'} tapered scute`, 'Split spine armor', 'Protects one rail without sealing the open cartridge.', 'A curved tapered patch leaves the hinge and central service slot uncovered.', frame, [s * .10, .02, -.09], 'Formed pale alloy shell');
      add(armor, 'sphere', 'shell', [s * r * .62, length * .51, -r * .77], [r * .46, length * .32, .014], [0, s * .20, s * .08]);
      fasteners(armor, [[s * r * .63, length * .31, -r * .88], [s * r * .63, length * .70, -r * .88]], .005);
    }
    vertebrae.push({ frame, wheel });
  }
  for (const h of current.hood) {
    const label = `Hood ${h.side < 0 ? 'left' : 'right'} rib ${h.station + 1}`, length = h.length;
    const rib = part(`hood.${h.id}.rib`, `${label} twin-rail spar`, 'Deployable hood', 'Opens a constant-length spar around its vertebral hinge.', 'Two slender rails and cross-spacers carry an open fan bay with a free outboard end.', vertebrae[h.frame].frame, [h.side * .18, .05, 0]);
    rib.position.fromArray(h.local);
    for (const x of [-.012, .012]) rod(rib, 'titanium', [x, .026, 0], [x, length - .013, 0], .006);
    eye(rib, [0, 0, 0], .018, .064);
    for (let j = 1; j <= 5; j++) {
      const y = length * j / 6;
      rod(rib, 'dark', [-.016, y, 0], [.016, y, 0], .004);
      add(rib, 'box', 'brass', [0, y, -.005], [.008, .012, .008], [0, 0, 0], true);
    }
    add(rib, 'sphere', 'teal', [0, length, 0], [.012, .013, .009]);
    rod(rib, 'copper', [0, .028, .014], [0, length - .02, .014], .003, true);
    const wheel = part(`hood.${h.id}.wheel`, `${label} deployment gear`, 'Hood actuation', 'Makes the hinge opening visible behind the spar.', 'An extended shaft reaches the 64 mm offset plate without putting teeth through the rail plane.', rib, [0, 0, .08]);
    wheel.position.z = .064; wheel.rotation.x = Math.PI / 2; gear(wheel, .025, 10, .010);
    const armor = part(`hood.${h.id}.armor`, `${label} split shell ribbon`, 'Hood armor', 'Defines the fan outline without filling its open cells.', 'Three separated canted scutes follow the spar while leaving the hub and cross-spacers exposed.', rib, [h.side * .04, 0, -.10], 'Formed pale alloy shell');
    for (let j = 0; j < 3; j++) {
      const y = length * (.23 + j * .27);
      add(armor, 'sphere', 'shell', [0, y, -.022], [.027 - j * .004, length * .105, .009], [0, 0, -.055 * h.side]);
      fasteners(armor, [[0, y, -.031]], .0045);
    }
    ribs.push(rib);
  }
  const head = part('head.frame', 'Cranial open cross-yoke', 'Sensor head', 'Carries the optic pods and lower jaw on the terminal vertebra.', 'A triangulated brow and two cheek rails leave a clear mouth opening.', undefined, [0, .16, -.06]);
  for (const s of [-1, 1]) {
    rod(head, 'titanium', [s * .055, 0, .005], [s * .078, .04, -.17], .011);
    rod(head, 'titanium', [s * .078, .04, -.17], [0, .075, -.07], .009);
    rod(head, 'dark', [s * .06, -.029, -.018], [s * .078, .04, -.17], .008);
  }
  rod(head, 'brass', [-.075, -.035, -.018], [.075, -.035, -.018], .011);
  const crown = part('head.crown', 'Split cranial brow armor', 'Head armor', 'Shields the optical bridge while exposing the mouth mechanism.', 'Two separated tapered plates form the characteristic narrow cobra head.', head, [0, .14, -.03], 'Formed pale alloy shell');
  for (const s of [-1, 1]) {
    add(crown, 'sphere', 'shell', [s * .039, .058, -.081], [.051, .024, .108], [0, -s * .13, 0]);
    fasteners(crown, [[s * .045, .08, -.065], [s * .045, .077, -.12]], .006);
    const optic = part(`head.optic.${s}`, `${s < 0 ? 'Left' : 'Right'} slit optic pod`, 'Optical inspection', 'Carries a narrow outward-facing aperture.', 'A recessed glass strip sits in a separate dark pod under the armored brow.', head, [s * .10, .03, -.08], 'Dark carrier / optical glass');
    add(optic, 'box', 'dark', [s * .084, .035, -.115], [.025, .029, .086], [0, -s * .13, 0]);
    add(optic, 'box', 'lens', [s * .098, .037, -.12], [.009, .012, .058], [0, -s * .13, 0]);
    for (let i = 0; i < 4; i++) add(optic, 'box', 'brass', [s * .100, .037, -.145 + i * .017], [.009, .018, .003], [0, 0, 0], true);
  }
  const jaw = part('head.jaw', 'Hinged lower mandible', 'Mouth actuation', 'Opens beneath the stationary brow on a lateral pin.', 'An open U-shaped lower carrier rotates as a rigid body; no upper cover occupies its swept mouth gap.', head, [0, -.13, -.04]);
  jaw.position.set(0, -.035, -.018);
  for (const s of [-1, 1]) {
    rod(jaw, 'titanium', [s * .053, 0, 0], [s * .037, 0, -D.jaw], .007);
    add(jaw, 'sphere', 'shell', [s * .043, -.012, -.086], [.021, .012, .069]);
  }
  rod(jaw, 'dark', [-.037, 0, -D.jaw], [.037, 0, -D.jaw], .006);
  add(jaw, 'box', 'dark', [0, .004, -.085], [.024, .014, .05]);
  const jawGear = part('head.jaw.gear', 'Mandible lateral sector wheel', 'Mouth timing', 'Displays the opening angle at the exposed cheek journal.', 'A small spur wheel lies outside the cheek plane and turns with the lower jaw.', jaw, [.09, 0, 0]);
  jawGear.position.x = .083; jawGear.rotation.z = Math.PI / 2; gear(jawGear, .023, 10, .012);
  const tongue = part('head.tongue', 'Bifurcated sliding sensor tongue', 'Sensor extension', 'Extends two non-contact probes from the moving jaw.', 'A rigid central slider and two narrow branches follow the jaw-local guide, at twice master frequency.', jaw, [0, -.05, -.13], 'Titanium probes / teal tips');
  rod(tongue, 'titanium', [0, 0, .03], [0, 0, -.063], .004);
  for (const s of [-1, 1]) {
    rod(tongue, 'titanium', [0, 0, -.063], [s * .019, 0, -.105], .003);
    add(tongue, 'sphere', 'lens', [s * .019, 0, -.105], [.0045, .0045, .007]);
  }
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone() }));
  function update(state = current, options = {}) {
    if (disposed) return;
    if (state?.spine && state?.hood && state?.jaw) current = state;
    else if (Number.isFinite(state?.driveAngle)) current = poseAt(state.driveAngle, current.inputs);
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); }
    vertebrae.forEach((n, i) => {
      n.frame.position.fromArray(current.spine[i].start); n.frame.quaternion.fromArray(current.spine[i].q);
      n.wheel.rotateY(current.spine[i].sway);
    });
    ribs.forEach((node, i) => { node.rotation.z = current.hood[i].angle; });
    head.position.fromArray(current.head.start); head.quaternion.fromArray(current.head.q);
    jaw.rotation.x = -current.jaw.angle;
    tongue.position.set(0, .005, -.105 - current.tongue.travel);
    kit.sync(options);
  }
  update(current);
  return { group: kit.group, parts: kit.parts, stats: kit.stats, update,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
