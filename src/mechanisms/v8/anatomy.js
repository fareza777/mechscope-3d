import { E, FIRE, PIN_PHASE } from './kin.js';

// Tag the original rig, before it is converted into independently pickable instances.
export function annotateEngine(engine) {
  const parts = [];
  const tag = (node, id, name, system, purpose, how, material, unit, detail, outer = false) => {
    node.userData.partId = id;
    node.userData.outer = outer;
    node.name = name;
    parts.push({ id, name, system, function: purpose, how, material, unit, detail });
  };
  tag(engine.block, 'block.rails', 'Cylinder-bank deck rails', 'Structure',
    'Aligns the two cylinder banks above the crankshaft.', 'Longitudinal rails join five V-shaped bulkheads.',
    'Cast iron', 'mm', '90° included bank angle; 488 mm reference rail length.', true);
  engine.block.children.slice(0, 5).forEach((node, i) => tag(node, `block.bulkhead.${i + 1}`, `V bulkhead ${i + 1}`, 'Structure',
    'Transfers cylinder loads into the main-bearing supports.', 'An open V section carries both decks around a central crank bore.',
    'Cast iron', 'mm', `16 mm web at reference z = ${node.position.z} mm.`, true));
  tag(engine.pan, 'block.sump', 'Oil sump', 'Lubrication', 'Collects returning engine oil.',
    'The lower reservoir separates first in the original layered exploded sequence.', 'Cast aluminium', 'mm',
    '200 × 40 × 470 mm reference envelope; oil circulation is not simulated.', true);
  tag(engine.rail, 'block.sump-rail', 'Sump mounting rail', 'Structure', 'Supports and seals the sump joint.',
    'A continuous lower rail connects the open bulkheads.', 'Cast iron', 'mm', '220 × 12 × 500 mm reference envelope.', true);
  engine.bearings.forEach((node, i) => tag(node, `crank.bearing.${i + 1}`, `Main bearing shell ${i + 1}`, 'Bearings',
    'Supports a rotating main journal.', 'The stationary annular shell occupies the bulkhead bore around the journal.',
    'Bearing bronze', 'mm', '30.4 mm inner radius around a 30 mm journal; no oil-film or friction solver.'));
  engine.journals.forEach((node, i) => tag(node, `crank.journal.${i + 1}`, `Main journal ${i + 1}`, 'Crankshaft',
    'Locates the crankshaft axis in a bearing.', 'Five cylindrical journals are coaxial with the front pulley and flywheel.',
    'Polished steel', 'mm', '60 mm diameter, 42 mm reference width.'));
  engine.webs.forEach(({ w, p }, i) => tag(w, `crank.web.${i + 1}`, `Throw ${p + 1} counterweight ${i % 2 ? 'rear' : 'front'}`, 'Crankshaft',
    'Connects a crankpin to the main axis and carries a counterweight.', 'A curved sector opposite the crankpin rotates with its cross-plane throw.',
    'Forged steel', '°', `Throw phase ${PIN_PHASE[p]}°; 18 mm web. Mass balance is illustrative, not computed.`));
  engine.pins.forEach((node, i) => tag(node, `crank.pin.${i + 1}`, `Shared crankpin ${i + 1}`, 'Crankshaft',
    'Drives the adjacent odd/even connecting rods.', 'Each crankpin follows a circular orbit about the main axis.',
    'Hardened steel', 'mm', `44.5 mm orbit radius; 50 mm pin diameter; z = ${E.pinZ[i]} mm.`));

  engine.cyl.forEach((c, i) => {
    const n = c.cy.c, prefix = `cylinder.${n}`;
    const identify = `Cylinder ${n}, ${c.cy.bank === 'L' ? 'left (+x)' : 'right (−x)'} bank; firing TDC ${FIRE[n]}°.`;
    tag(c.g, `${prefix}.liner`, `C${n} cylinder liner and lips`, 'Cylinders', 'Guides the piston along its bank axis.',
      'An open cylindrical wall and two end lips surround the moving piston; x-ray makes the wall transparent.',
      'Honed iron (transparent study finish in x-ray)', 'mm', `${identify} Bore 101.6 mm, reference liner length 118 mm.`, true);
    tag(c.head, `${prefix}.head`, `C${n} head and valve block`, 'Cylinder heads', 'Closes the combustion chamber and locates the valves.',
      'A raised cap, annular flange and valve block separate together during teardown.', 'Cast iron', 'mm',
      `${identify} Deck at 226 mm along the bore axis.`, true);
    tag(c.cage, `${prefix}.cage`, `C${n} rocker cage`, 'Valvetrain', 'Supports the upper valvetrain.',
      'Four posts and crossbars enclose the two springs; this reference uses schematic fixed follower bars.',
      'Coated steel', 'mm', `${identify} The outer cage leaves first during explosion.`, true);
    tag(c.plug, `${prefix}.plug`, `C${n} spark plug`, 'Ignition', 'Provides the ignition point for the fuel charge.',
      'A ceramic insulator, hexagonal steel seat and terminal lean out of the head.', 'Ceramic / steel', '°',
      `${identify} The charge pulse marks ignition; no electrical circuit is simulated.`);
    tag(c.exhaust, `${prefix}.exhaust`, `C${n} exhaust runner`, 'Gas exchange', 'Routes spent gas outboard.',
      'A continuous curved tube bends from the exhaust side down the bank.', 'Coated steel', 'mm',
      `${identify} 15 mm tube radius; port flow is illustrative.`, true);
    tag(c.charge, `${prefix}.charge`, `C${n} chamber charge`, 'Combustion', 'Makes the four-stroke sequence visible.',
      'The gas column follows the exact piston crown; blue intake, grey compression/exhaust, orange early combustion.',
      'Fuel/air visualization', '°', `${identify} Orange lasts 60° after firing. Pressure colour is a qualitative reference model, not measured output.`);
    for (const v of c.valves) {
      const intake = v.kind === 'in', kind = intake ? 'intake' : 'exhaust';
      tag(v.vg, `${prefix}.${kind}-valve`, `C${n} ${kind} valve`, 'Valvetrain',
        intake ? 'Admits fresh charge to the cylinder.' : 'Releases spent combustion gas.',
        'The stem, poppet disc and retainer translate together according to a smooth cam-timed lift curve.',
        'Hardened steel', 'mm', `${identify} Peak lift 10.5 mm; opens ${intake ? '340–580' : '140–380'}° after firing TDC.`);
      tag(v.spring, `${prefix}.${kind}-springs`, `C${n} ${kind} dual valve springs`, 'Valvetrain',
        'Returns the valve toward its seat.', 'Concentric 8-turn and 10-turn helices compress with the valve retainer.',
        'Spring steel / bronze study finish', 'mm', `${identify} Free display length 48 mm, compressed length 48 − valve lift.`);
    }
    const p = engine.pist[i];
    tag(p.g, `${prefix}.piston`, `C${n} piston`, 'Reciprocating assembly', 'Converts chamber force into rod force.',
      'The crown follows the exact slider-crank solution, including the finite connecting-rod length.',
      'Aluminium alloy', 'mm', `${identify} 89 mm stroke; 30 mm compression height; 62 mm skirt.`);
    p.g.children.slice(1, 4).forEach((node, ring) => tag(node, `${prefix}.ring.${ring + 1}`, `C${n} piston ring ${ring + 1}`, 'Sealing',
      'Seals the piston-to-liner clearance.', 'Three separate toroidal rings travel rigidly with the piston.',
      'Spring steel', 'mm', `${identify} Reference ring radius 49.6 mm; ring section radius 1.6 mm.`));
    tag(p.g.children[4], `${prefix}.wrist-pin`, `C${n} wrist pin`, 'Reciprocating assembly', 'Connects the piston to the rod small end.',
      'The cross-axis pin travels with the piston and remains aligned to the small-end centre.', 'Hardened steel', 'mm',
      `${identify} 22 mm pin diameter.`);
    tag(p.rod, `${prefix}.rod`, `C${n} connecting rod`, 'Reciprocating assembly', 'Transmits load between the piston and crankpin.',
      'The rod centre and angle are solved from its two pin positions; the centre distance remains exactly 145 mm.',
      'Forged steel', 'mm', `${identify} Adjacent-bank rods are offset ±11 mm along the shared crankpin.`);
    tag(p.arrow, `${prefix}.motion`, `C${n} piston-direction indicator`, 'Motion guides', 'Shows the instantaneous piston travel direction.',
      'A finite difference of the slider-crank solution controls arrow direction and scale.', 'Red study overlay', '°',
      `${identify} An annotation, not an engine component.`);
  });
  engine.cams.forEach((cam, i) => {
    tag(cam.g, `cam.${cam.bank}.shaft`, `${cam.bank} bank camshaft`, 'Timing', 'Coordinates valve events over two crank revolutions.',
      'The shaft turns at half the crankshaft speed in the same direction.', 'Steel', 'rpm', '18 mm shaft diameter; 520 mm length.');
    cam.lobes.forEach(({ lg, c, v }) => tag(lg, `cam.${cam.bank}.c${c.cy.c}.${v.kind}`, `C${c.cy.c} ${v.kind === 'in' ? 'intake' : 'exhaust'} cam lobe`, 'Timing',
      'Phases a valve opening within the four-stroke cycle.', 'The reference elliptical lobe is phased to the middle of its valve event.',
      'Hardened steel', '°', 'Lobe geometry is illustrative; valve displacement uses the reference analytic lift, not surface-contact dynamics.'));
    tag(engine.camGears[i], `timing.${cam.bank}.cam-gear`, `${cam.bank} 48-tooth cam gear`, 'Timing',
      'Provides the two-to-one crank-to-cam reduction.', 'Two external meshes reverse direction twice; 48 teeth give half the 24-tooth crank speed.',
      'Bronze study finish', 'teeth', 'Added to complete the reference cam-gear placeholders; module 3 mm pitch layout.');
  });
  tag(engine.crankGear, 'timing.crank-gear', '24-tooth crank timing gear', 'Timing', 'Takes the valve timing reference from the crank.',
    'Turns directly with the crankshaft and drives two bank idlers.', 'Steel', 'teeth', '24 teeth; 36 mm nominal pitch radius.');
  engine.idlers.forEach(({ gg, bank }) => tag(gg, `timing.${bank}.idler`, `${bank} 80-tooth timing idler`, 'Timing',
    'Bridges the crank gear and the elevated cam gear.', 'Its speed is opposite the crank at 24/80; its tooth count does not alter the final 24/48 ratio.',
    'Steel', 'teeth', 'Reference helical geometry adapted from 72 to 80 teeth to fit the unchanged camshaft locations. Tooth profiles are illustrative, not involute contact analysis.'));
  tag(engine.pulley, 'crank.pulley', 'Front pulley and keyed hub', 'Output', 'Makes crank rotation visible at the front of the engine.',
    'A grooved disc, six bolt heads and toothed central hub rotate together.', 'Steel', 'mm', '168 mm pulley diameter; +z is the inspection front.');
  tag(engine.flywheel, 'crank.flywheel', 'Flywheel and 120-tooth starter ring', 'Output', 'Stores rotational energy in a physical engine.',
    'The rear disc and toothed ring follow crank angle exactly.', 'Steel', 'teeth', '120 starter-ring teeth; 332 mm tip diameter. Inertia and torque are not simulated.');
  tag(engine.arcs, 'crank.motion', 'Crank rotation indicators', 'Motion guides', 'Indicates the direction of crank rotation.',
    'Two red arc arrows circulate at the reference quarter-speed annotation rate.', 'Red study overlay', '°', 'Not a rotating mechanical part.');

  engine.root.traverse(node => {
    if (!node.isMesh) return;
    let ancestor = node;
    while (ancestor && !ancestor.userData.partId) ancestor = ancestor.parent;
    if (!ancestor) throw new Error('V8 geometry lacks anatomy metadata');
    node.userData.partId = ancestor.userData.partId;
    node.userData.outer = ancestor.userData.outer;
  });
  return parts;
}
