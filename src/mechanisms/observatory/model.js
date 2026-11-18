import * as THREE from 'three';
import { createMechanicalKit } from '../mechanical-kit.js';
import { D, TAU, poseAt, sample } from './kin.js';

export function createModel() {
  const kit = createMechanicalKit('SPECULA O6 · equatorial observatory');
  const nodes = [], mirrors = [], panels = [];
  const add = kit.add, rod = kit.rod;
  let disposed = false, lastState = sample(0);
  const part = (id, name, system, purpose, how, parent, explode = [0, .10, 0], material = 'Machined titanium, pale shell and brass fittings') => {
    const node = kit.part({ id, name, system, function: purpose, how, material, unit: 'm · rad', detail: `${name}: ${purpose} ${how}` }, parent, explode);
    nodes.push(node); return node;
  };
  const plate = (node, material, p, size, euler = [0, 0, 0], detail = false) => add(node, 'box', material, p, size, euler, detail);
  const axial = (node, material, p, radius, length, axis = 'x', detail = false) => {
    const euler = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    add(node, 'cylinder', material, p, [radius, length, radius], euler, detail);
  };
  const ball = (node, material, p, radius, detail = false) => add(node, 'sphere', material, p, [radius, radius, radius], [0, 0, 0], detail);
  const domePoint = (azimuth, phi, radius = D.domeRadius) => [radius * Math.cos(phi) * Math.cos(azimuth), radius * Math.sin(phi), radius * Math.cos(phi) * Math.sin(azimuth)];

  // ---------------------------------------------------------------- building
  const foundation = part('building.foundation', 'Circular foundation and damp-proof course', 'Building',
    'Grounds the observatory and carries the eight wall piers.',
    'A broad concrete disc, a dark damp course and a brass setting-out ring sit below the timber floor.', undefined, [0, 0, 0], 'Concrete disc, dark course and brass ring');
  axial(foundation, 'shell', [0, .035, 0], 1.34, .07, 'y');
  axial(foundation, 'dark', [0, .085, 0], 1.30, .04, 'y');
  add(foundation, 'ring', 'brass', [0, .108, 0], [1.22, 1.22, 1.22], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 16; i++) add(foundation, 'bolt', 'titanium', [1.16 * Math.cos(i * TAU / 16), .11, 1.16 * Math.sin(i * TAU / 16)], [.012, .018, .012], [0, 0, 0], true);

  const floor = part('building.floor', 'Observing floor and azimuth track', 'Building',
    'Provides the level floor inside the rotating dome.',
    'Twelve pale floor plates, a central brass pivot ring and a dark cable channel form the raised observing floor.', undefined, [0, .02, 0], 'Pale floor plates and brass pivot ring');
  add(floor, 'cylinder', 'shell', [0, .13, 0], [1.17, .04, 1.17]);
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    plate(floor, 'titanium', [.62 * Math.cos(a), .155, .62 * Math.sin(a)], [.52, .008, .16], [0, -a, 0], true);
  }
  add(floor, 'ring', 'brass', [0, .16, 0], [.62, .62, .62], [Math.PI / 2, 0, 0]);
  plate(floor, 'dark', [0, .155, -.72], [.28, .01, 1.0]);

  for (let i = 0; i < 8; i++) {
    const a = 22.5 * Math.PI / 180 + i * TAU / 8, label = String(i + 1);
    const pier = part(`wall.pier.${label}`, `Wall pier ${label} of eight`, 'Building',
      `Carries the dome track between azimuth ${Math.round(a * 180 / Math.PI)} and its neighbour.`,
      'Two dark posts, a pale infill panel, a brass sill and a narrow ventilation slot form one wall bay.', undefined, [0, .02, 0], 'Dark posts, pale infill and brass sill');
    const tangent = [-Math.sin(a), 0, Math.cos(a)];
    for (const side of [-1, 1]) {
      const p = [Math.cos(a) * 1.16 + tangent[0] * side * .20, .68, Math.sin(a) * 1.16 + tangent[2] * side * .20];
      rod(pier, 'dark', [p[0], .12, p[2]], [p[0], 1.22, p[2]], .026);
      add(pier, 'sphere', 'brass', [p[0], 1.22, p[2]], [.036, .03, .036]);
    }
    plate(pier, 'shell', [Math.cos(a) * 1.17, .70, Math.sin(a) * 1.17], [.38, 1.02, .05], [0, -a, 0]);
    plate(pier, 'brass', [Math.cos(a) * 1.17, .16, Math.sin(a) * 1.17], [.40, .04, .07], [0, -a, 0], true);
    for (let k = 0; k < 4; k++) plate(pier, 'dark', [Math.cos(a) * 1.19, .42 + k * .16, Math.sin(a) * 1.19], [.18, .035, .012], [0, -a, 0], true);
  }

  const door = part('building.door', 'Insulated entry door and brass furniture', 'Building',
    'Closes the south wall opening below the dome slit.',
    'A dark door leaf, two pale panels, a brass handle and a small teal inspection window sit in a painted frame.', undefined, [0, .02, 0], 'Dark door leaf and brass furniture');
  plate(door, 'dark', [0, .66, 1.205], [.82, 1.08, .08]);
  for (const y of [.36, .82]) plate(door, 'shell', [0, y, 1.25], [.68, .30, .02]);
  plate(door, 'lens', [.20, .90, 1.255], [.14, .12, .015]);
  add(door, 'cylinder', 'brass', [-.28, .62, 1.27], [.022, .08, .022], [Math.PI / 2, 0, 0]);
  plate(door, 'brass', [-.28, .54, 1.27], [.06, .02, .05]);

  const stairs = part('building.stairs', 'Three-tread entry stair', 'Building',
    'Provides a visible approach to the door.',
    'Three stone treads, two dark stringers and a brass handrail step up to the observing floor.', undefined, [0, 0, 0], 'Stone treads, dark stringers and brass handrail');
  for (let i = 0; i < 3; i++) {
    plate(stairs, 'shell', [0, .04 + i * .05, 1.42 + i * .20], [.90, .05, .24]);
    plate(stairs, 'dark', [0, .016 + i * .05, 1.42 + i * .20], [.94, .03, .27], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) rod(stairs, 'dark', [side * .42, .10, 1.34], [side * .42, .30, 1.82], .018);
  rod(stairs, 'brass', [-.46, .62, 1.36], [-.46, .62, 1.84], .014);

  const rail = part('building.rail', 'Dome track and roller ring', 'Dome support',
    'Carries the rotating dome on twelve visible rollers.',
    'A fixed brass track, twelve rubber rollers, six dark brackets and a drive pinion sit above the wall ring.', undefined, [0, .03, 0], 'Brass track, rubber rollers and dark brackets');
  add(rail, 'ring', 'brass', [0, 1.24, 0], [1.235, 1.235, 1.235], [Math.PI / 2, 0, 0]);
  add(rail, 'ring', 'titanium', [0, 1.21, 0], [1.15, 1.15, 1.15], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    add(rail, 'cylinder', 'rubber', [1.18 * Math.cos(a), 1.245, 1.18 * Math.sin(a)], [.028, .07, .028], [0, 0, Math.PI / 2]);
    add(rail, 'box', 'dark', [1.14 * Math.cos(a), 1.19, 1.14 * Math.sin(a)], [.08, .06, .08], [0, -a, 0], true);
  }
  const pinion = part('dome.pinion', 'Dome drive pinion', 'Dome drive',
    'Turns the dome through a visible gear mesh.',
    'A nine-tooth brass pinion and a dark gearbox face the fixed dome track from the wall ring.', undefined, [0, .04, 0], 'Brass pinion and dark gearbox');
  pinion.position.set(.94, 1.26, .78);
  kit.gear(pinion, .11, 14, .045, 'brass');
  mirrors.push({ node: pinion, kind: 'pinion' });

  // ---------------------------------------------------------------- dome
  const domeGroup = new THREE.Group(); domeGroup.name = 'rotating-dome'; domeGroup.position.y = D.domeBaseY; kit.assemblies.add(domeGroup);
  const ribCount = 12;
  for (let i = 0; i < ribCount; i++) {
    const a = Math.PI / 12 + i * TAU / ribCount, label = String(i + 1);
    const rib = part(`dome.rib.${label}`, `Dome meridian rib ${label} of twelve`, 'Dome structure',
      'Carries the shell between the track ring and the apex.',
      'Ten curved titanium segments, three brass joint collars and a bolted foot form one meridian rib.', domeGroup, [0, .03, 0], 'Curved titanium rib and brass collars');
    const points = Array.from({ length: 11 }, (_, k) => domePoint(a, k / 10 * Math.PI / 2));
    for (let k = 0; k < 10; k++) rod(rib, 'titanium', points[k], points[k + 1], .014);
    for (const k of [2, 5, 8]) add(rib, 'sphere', 'brass', points[k], [.022, .022, .022]);
    add(rib, 'box', 'dark', [points[0][0], .015, points[0][2]], [.11, .035, .10], [0, -a, 0]);
    plate(rib, 'titanium', [points[9][0] * .92, points[9][1], points[9][2] * .92], [.05, .10, .03], [0, -a, 0], true);
  }
  for (const [k, phi] of [0.32, 0.68, 1.02].entries()) {
    const ring = part(`dome.latitude.${k + 1}`, `Dome latitude ring ${k + 1} of three`, 'Dome structure',
      'Braces the meridians at one fixed latitude.',
      'A segmented brass hoop, twenty-four lightening holes and six dark splice plates keep the dome stiff.', domeGroup, [0, .03, 0], 'Segmented brass hoop and dark splices');
    const radius = D.domeRadius * Math.cos(phi), y = D.domeRadius * Math.sin(phi);
    for (let s = 0; s < 48; s++) {
      const a = s * TAU / 48, b = (s + 1) * TAU / 48;
      rod(ring, s % 4 === 0 ? 'titanium' : 'brass', [radius * Math.cos(a), y, radius * Math.sin(a)], [radius * Math.cos(b), y, radius * Math.sin(b)], .010);
    }
    for (let s = 0; s < 6; s++) {
      const a = s * TAU / 6;
      add(ring, 'box', 'dark', [radius * Math.cos(a), y, radius * Math.sin(a)], [.06, .07, .02], [0, -a, 0], true);
    }
  }
  const bands = [[.07, .33], [.34, .59], [.60, .85], [.86, 1.11]];
  for (const [band, [phiA, phiB]] of bands.entries()) {
    const phiMid = (phiA + phiB) / 2, yMid = D.domeRadius * Math.sin(phiMid);
    for (let sector = 0; sector < 18; sector++) {
      const mid = sector * TAU / 18;
      if (sector === 0) continue;
      const radius = D.domeRadius * Math.cos(phiMid);
      const width = 2 * radius * Math.sin(Math.PI / 18) * 1.04;
      const height = D.domeRadius * (phiB - phiA) * 1.06;
      const panel = part(`dome.skin.${band + 1}.${String(sector + 1).padStart(2, '0')}`, `Dome skin panel ${band + 1}.${sector + 1}`, 'Dome structure',
        'Closes one bay between two meridians and two latitude rings.',
        'A pale curved panel, an inner dark rib and four brass fasteners sit between the exposed dome frames.', domeGroup, [0, .02, 0], 'Pale curved panel and brass fasteners');
      const euler = [-phiMid, Math.PI / 2 - mid, 0, 'YXZ'];
      plate(panel, 'shell', [radius * Math.cos(mid), yMid, radius * Math.sin(mid)], [width, height, .026], euler);
      plate(panel, 'dark', [radius * .992 * Math.cos(mid), yMid, radius * .992 * Math.sin(mid)], [width * .94, .014, .012], euler, true);
      kit.fasteners(panel, [[radius * .99 * Math.cos(mid), yMid + height * .30, radius * .99 * Math.sin(mid)]], .006);
      panels.push(panel);
    }
  }
  const apex = part('dome.apex', 'Dome apex cap and vent ball', 'Dome structure',
    'Closes the top of the dome above the slit.',
    'A pale cap, six brass ribs and a dark vent ball meet the meridian tips at the crown.', domeGroup, [0, .03, 0], 'Pale cap, brass ribs and vent ball');
  add(apex, 'sphere', 'shell', [0, D.domeRadius * .99, 0], [.15, .09, .15]);
  add(apex, 'ring', 'brass', [0, D.domeRadius * .94, 0], [.14, .14, .14], [Math.PI / 2, 0, 0]);
  ball(apex, 'dark', [0, D.domeRadius + .06, 0], .045);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    rod(apex, 'brass', [0, D.domeRadius * .96, 0], [.085 * Math.cos(a), D.domeRadius * 1.01, .085 * Math.sin(a)], .006);
  }

  const shutterLeft = part('dome.shutter.L', 'Left slit shutter and hinge', 'Dome shutter',
    'Opens the left half of the observing slit.',
    'A broad pale insulated leaf, four dark ribs and a brass hinge barrel turn outward around a vertical axis.', domeGroup, [0, .04, 0], 'Pale shutter leaf and brass hinge');
  shutterLeft.position.set(D.domeRadius * Math.cos(-D.slitHalfAngle), 0, D.domeRadius * Math.sin(-D.slitHalfAngle));
  plate(shutterLeft, 'shell', [.20, .58, 0], [.40, 1.10, .040], [0, -Math.PI / 10, 0]);
  for (let k = 0; k < 4; k++) plate(shutterLeft, 'dark', [.20, .22 + k * .25, -.012], [.035, .21, .012], [0, -Math.PI / 10, 0], true);
  add(shutterLeft, 'cylinder', 'brass', [0, .55, 0], [.022, 1.10, .022], [0, 0, 0]);
  add(shutterLeft, 'sphere', 'brass', [0, 1.10, 0], [.032, .032, .032]);

  const shutterRight = part('dome.shutter.R', 'Right slit shutter and hinge', 'Dome shutter',
    'Opens the right half of the observing slit.',
    'A mirrored pale insulated leaf, four dark ribs and a brass hinge barrel swing clear of the telescope.', domeGroup, [0, .04, 0], 'Pale shutter leaf and brass hinge');
  shutterRight.position.set(D.domeRadius * Math.cos(D.slitHalfAngle), 0, D.domeRadius * Math.sin(D.slitHalfAngle));
  plate(shutterRight, 'shell', [-.20, .58, 0], [.40, 1.10, .040], [0, Math.PI / 10, 0]);
  for (let k = 0; k < 4; k++) plate(shutterRight, 'dark', [-.20, .22 + k * .25, -.012], [.035, .21, .012], [0, Math.PI / 10, 0], true);
  add(shutterRight, 'cylinder', 'brass', [0, .55, 0], [.022, 1.10, .022], [0, 0, 0]);
  add(shutterRight, 'sphere', 'brass', [0, 1.10, 0], [.032, .032, .032]);

  const domeGear = part('dome.gear', 'Dome azimuth gear sector', 'Dome drive',
    'Provides the visible teeth that the fixed pinion drives.',
    'Twenty-four inward-facing brass blocks and a dark backing ring sit on the rotating dome base.', domeGroup, [0, .02, 0], 'Brass gear blocks and dark backing');
  for (let i = 0; i < 24; i++) {
    const a = i * TAU / 24;
    add(domeGear, 'box', 'brass', [1.14 * Math.cos(a), .015, 1.14 * Math.sin(a)], [.07, .045, .055], [0, -a, 0]);
    if (i % 2 === 0) add(domeGear, 'bolt', 'dark', [1.10 * Math.cos(a), .04, 1.10 * Math.sin(a)], [.008, .012, .008], [0, 0, 0], true);
  }

  // ---------------------------------------------------------------- telescope
  const pier = part('telescope.pier', 'Concrete pier and isolation collar', 'Telescope mount',
    'Supports the equatorial fork independently of the timber floor.',
    'A dark cylindrical pier, a pale levelling collar and eight brass anchor bolts rise through the floor opening.', undefined, [0, .03, 0], 'Dark pier, pale collar and brass anchors');
  axial(pier, 'dark', [0, .46, 0], .24, .72, 'y');
  axial(pier, 'shell', [0, .86, 0], .35, .09, 'y');
  for (let i = 0; i < 8; i++) add(pier, 'bolt', 'brass', [.27 * Math.cos(i * TAU / 8), .90, .27 * Math.sin(i * TAU / 8)], [.013, .02, .013], [0, 0, 0], true);

  const wedge = part('telescope.wedge', 'Equatorial wedge and latitude sector', 'Telescope mount',
    'Sets the polar axis angle of the fork.',
    'Two dark wedge cheeks, a brass latitude sector and a clamp bolt form the adjustable pier adapter.', undefined, [0, .03, 0], 'Dark wedge cheeks and brass sector');
  plate(wedge, 'dark', [0, .94, 0], [.52, .18, .56], [-.18, 0, 0]);
  add(wedge, 'box', 'brass', [.30, .94, -.06], [.035, .16, .22], [0, 0, 0]);
  axial(wedge, 'titanium', [0, 1.00, -.22], .035, .38);

  const forkBase = part('telescope.fork-base', 'Fork base and declination bearing', 'Telescope mount',
    'Carries both fork arms on the polar axis.',
    'A machined dark turntable, a brass bearing ring and two bolted fork cheeks sit above the wedge.', undefined, [0, .03, 0], 'Dark turntable and brass bearing ring');
  axial(forkBase, 'dark', [0, 1.04, 0], .30, .09, 'y');
  add(forkBase, 'ring', 'brass', [0, 1.10, 0], [.24, .24, .24], [Math.PI / 2, 0, 0]);

  for (const side of [-1, 1]) {
    const arm = part(`telescope.fork.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} fork arm`, 'Telescope mount',
      'Supports one end of the declination shaft.',
      'A tapered dark plate, a pale outer web and a brass bearing cap reach from the fork base to the shaft.', undefined, [0, .03, 0], 'Tapered plate and brass bearing cap');
    for (const z of [-.10, .10]) rod(arm, 'dark', [side * .29, 1.10, z], [side * .29, 1.44, z], .028);
    plate(arm, 'shell', [side * .29, 1.27, 0], [.05, .27, .19], [0, 0, 0]);
    add(arm, 'ring', 'brass', [side * .29, 1.46, 0], [.075, .075, .075], [0, Math.PI / 2, 0]);
  }
  const shaft = part('telescope.dec-shaft', 'Declination shaft and setting circles', 'Telescope mount',
    'Defines the single altitude axis of the tube.',
    'A continuous titanium shaft, two graduated brass circles and four dark collars pass through both fork bearings.', undefined, [0, .03, 0], 'Titanium shaft and graduated brass circles');
  axial(shaft, 'titanium', [0, D.pivot[1], 0], .040, .74);
  for (const side of [-1, 1]) add(shaft, 'ring', 'brass', [side * .33, D.pivot[1], 0], [.095, .095, .095], [0, Math.PI / 2, 0]);
  for (const x of [-.20, .20]) add(shaft, 'cylinder', 'dark', [x, D.pivot[1], 0], [.055, .05, .055], [0, 0, Math.PI / 2]);

  const tube = part('telescope.tube', 'Open tube truss and three longerons', 'Optical tube',
    'Carries the primary mirror, secondary mirror and focuser on one rigid axis.',
    'Three titanium longerons, six brass rings and a dark front cell form an open 1,640 mm tube around the light path.', undefined, [0, .04, 0], 'Titanium longerons and brass rings');
  tube.position.set(0, D.pivot[1], 0);
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    rod(tube, 'titanium', [D.tubeRadius * Math.cos(a), D.tubeRadius * Math.sin(a), -D.tubeBack + .02], [D.tubeRadius * Math.cos(a), D.tubeRadius * Math.sin(a), D.tubeFront - .02], .016);
    for (const z of [-.50, -.30, -.10, .10, .30, .50, .72, .90]) add(tube, 'ring', 'brass', [D.tubeRadius * Math.cos(a), D.tubeRadius * Math.sin(a), z], [.025, .025, .025], [Math.PI / 2, 0, 0], true);
  }
  for (const z of [-.50, -.30, -.10, .10, .30, .50, .72, .90]) {
    add(tube, 'ring', 'dark', [0, 0, z], [D.tubeRadius + .015, D.tubeRadius + .015, D.tubeRadius + .015], [0, 0, 0]);
    for (let k = 0; k < 3; k++) {
      const a = k * TAU / 3;
      rod(tube, 'brass', [D.tubeRadius * Math.cos(a), D.tubeRadius * Math.sin(a), z - .012], [D.tubeRadius * Math.cos(a + TAU / 3), D.tubeRadius * Math.sin(a + TAU / 3), z + .012], .006, true);
    }
  }
  add(tube, 'ring', 'titanium', [0, 0, D.tubeFront - .02], [D.tubeRadius + .03, D.tubeRadius + .03, D.tubeRadius + .03], [0, 0, 0]);
  plate(tube, 'dark', [0, D.tubeRadius, .12], [.13, .04, .22], [0, 0, 0], true);

  const cell = part('telescope.primary-cell', 'Primary mirror cell and cooling ports', 'Optical tube',
    'Holds the seven-segment primary mirror at the back of the tube.',
    'A dark dished cell, a brass retaining ring and six teal cooling ports sit behind the mirror segments.', tube, [0, .03, 0], 'Dark cell, brass ring and teal ports');
  axial(cell, 'dark', [0, 0, -D.tubeBack + .04], .23, .07, 'z');
  add(cell, 'ring', 'brass', [0, 0, -D.tubeBack + .08], [.22, .22, .22], [0, 0, 0]);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    add(cell, 'cylinder', 'lens', [.17 * Math.cos(a), .17 * Math.sin(a), -D.tubeBack + .085], [.020, .03, .020], [Math.PI / 2, 0, 0], true);
  }

  for (let i = 0; i < D.mirrorCount; i++) {
    const ring = i === 0 ? 0 : 1, slot = i - 1, count = 6;
    const x = ring === 0 ? 0 : D.mirrorRing * Math.cos(slot * TAU / count);
    const y = ring === 0 ? 0 : D.mirrorRing * Math.sin(slot * TAU / count);
    const mirror = part(`telescope.mirror.${i + 1}`, `Primary mirror segment ${i + 1} of seven`, 'Optics',
      'Forms part of the segmented primary aperture.',
      'A hexagonal pale glass tile, a dark backing pad and a brass edge clip sit in the primary cell without a ray trace.', tube, [0, .03, 0], 'Pale glass tile, dark pad and brass clip');
    add(mirror, 'cylinder', 'shell', [x, y, -D.tubeBack + .105], [D.mirrorRadius, .022, D.mirrorRadius], [Math.PI / 2, 0, 0]);
    add(mirror, 'cylinder', 'lens', [x, y, -D.tubeBack + .118], [D.mirrorRadius * .82, .006, D.mirrorRadius * .82], [Math.PI / 2, 0, 0]);
    add(mirror, 'ring', 'brass', [x, y, -D.tubeBack + .12], [D.mirrorRadius * 1.02, D.mirrorRadius * 1.02, D.mirrorRadius * 1.02], [0, 0, 0]);
    mirrors.push({ node: mirror, index: i, kind: 'primary' });
  }

  const spider = part('telescope.spider', 'Secondary spider and collimation hub', 'Optical tube',
    'Holds the secondary mirror on the tube axis.',
    'Three thin titanium vanes, a brass hub and six collimation screws cross the open tube at 440 mm from the pivot.', tube, [0, .03, 0], 'Titanium vanes and brass hub');
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    rod(spider, 'titanium', [D.tubeRadius * Math.cos(a), D.tubeRadius * Math.sin(a), .44], [0, 0, .44], .008);
  }
  add(spider, 'ring', 'brass', [0, 0, .44], [.075, .075, .075], [0, 0, 0]);
  for (let i = 0; i < 6; i++) add(spider, 'bolt', 'dark', [.05 * Math.cos(i * TAU / 6), .05 * Math.sin(i * TAU / 6), .47], [.006, .012, .006], [Math.PI / 2, 0, 0], true);

  const secondary = part('telescope.secondary', 'Secondary mirror and baffle', 'Optics',
    'Folds the primary light path toward the focuser.',
    'A pale convex secondary, a dark baffle ring and a brass tilt plate sit in the spider hub; no optical prescription is claimed.', tube, [0, .03, 0], 'Pale secondary and dark baffle');
  add(secondary, 'cylinder', 'shell', [0, 0, .40], [.075, .025, .075], [Math.PI / 2, 0, 0]);
  add(secondary, 'ring', 'dark', [0, 0, .38], [.085, .085, .085], [0, 0, 0]);
  add(secondary, 'ring', 'brass', [0, 0, .42], [.055, .055, .055], [0, 0, 0]);

  const focuser = part('telescope.focuser', 'Focuser drawtube and eyepiece', 'Optics',
    'Provides the visual focus and eyepiece interface.',
    'A dark drawtube, two brass focus knobs and a rubber eyecup project from the side of the tube near the front ring.', tube, [0, .03, 0], 'Dark drawtube and brass knobs');
  axial(focuser, 'dark', [0, .16, .88], .035, .14, 'z');
  add(focuser, 'ring', 'brass', [0, .16, .94], [.055, .055, .055], [0, 0, 0]);
  for (const side of [-1, 1]) add(focuser, 'cylinder', 'brass', [side * .07, .13, .84], [.022, .05, .022], [0, 0, Math.PI / 2]);

  const finder = part('telescope.finder', 'Finder scope and bracket', 'Optics',
    'Shows a small auxiliary sighting telescope.',
    'A slim dark tube, two brass rings and a three-point bracket sit above the main tube.', tube, [0, .03, 0], 'Slim dark tube and brass rings');
  axial(finder, 'dark', [.24, .26, .30], .032, .48, 'z');
  for (const z of [.16, .48]) add(finder, 'ring', 'brass', [.24, .26, z], [.042, .042, .042], [0, 0, 0]);
  for (const z of [.22, .42]) rod(finder, 'titanium', [.24, .26, z], [.14, .18, z], .008);

  const counterweight = part('telescope.counterweight', 'Declination counterweight stack', 'Telescope mount',
    'Balances the tube around the declination axis.',
    'Three dark discs, two brass spacer rings and a central clamp sit on a short arm behind the fork.', undefined, [0, .03, 0], 'Dark discs and brass spacers');
  for (let i = 0; i < 3; i++) axial(counterweight, 'dark', [0, 1.18 - i * .07, -.46], .16 - i * .012, .045, 'y');
  add(counterweight, 'ring', 'brass', [0, 1.22, -.46], [.10, .10, .10], [Math.PI / 2, 0, 0]);
  rod(counterweight, 'titanium', [0, 1.24, -.10], [0, 1.18, -.46], .024);

  const driveWheel = part('telescope.drive-wheel', 'Sidereal drive wheel and worm', 'Telescope drive',
    'Shows the slow tracking input on the declination shaft.',
    'A brass ring, eight titanium spokes and a dark worm block turn on the right fork bearing.', undefined, [0, .03, 0], 'Brass wheel, titanium spokes and dark worm');
  driveWheel.position.set(D.forkX + .12, D.pivot[1], 0);
  add(driveWheel, 'ring', 'brass', [0, 0, 0], [.12, .12, .12], [0, Math.PI / 2, 0]);
  axial(driveWheel, 'dark', [0, 0, 0], .034, .05);
  for (let i = 0; i < 8; i++) {
    const [y, z] = [.115 * Math.cos(i * TAU / 8), .115 * Math.sin(i * TAU / 8)];
    rod(driveWheel, 'titanium', [0, 0, 0], [0, y, z], .006);
  }
  add(driveWheel, 'box', 'dark', [-.045, .10, .10], [.07, .06, .08]);
  mirrors.push({ node: driveWheel, kind: 'drive' });

  const handset = part('telescope.handset', 'Hand controller and coiled cable', 'Telescope drive',
    'Gives a visible manual interface for the drive.',
    'A dark handset, a teal display and six brass buttons hang from a copper cable clipped to the pier.', undefined, [0, .03, 0], 'Dark handset, teal display and brass buttons');
  plate(handset, 'dark', [.33, 1.02, .22], [.10, .16, .035], [0, .35, 0]);
  plate(handset, 'lens', [.33, 1.06, .24], [.07, .05, .012], [0, .35, 0]);
  for (let i = 0; i < 6; i++) add(handset, 'bolt', 'brass', [.30 + (i % 3) * .026, .985, .245], [.005, .01, .005], [Math.PI / 2, 0, 0], true);
  for (let i = 0; i < 7; i++) rod(handset, 'copper', [.33, .94 - i * .02, .22], [.27 - i * .005, .92 - i * .02, .16 + i * .01], .004, true);

  // ---------------------------------------------------------------- interior
  const desk = part('interior.desk', 'Observer desk and instrument rack', 'Interior',
    'Provides the working surface beside the pier.',
    'A pale desk top, two dark trestles, a brass cable grommet and four instrument feet fill the south-east floor bay.', undefined, [0, .04, 0], 'Pale desk top and dark trestles');
  plate(desk, 'shell', [.64, .56, .30], [.62, .045, .38]);
  for (const x of [.40, .88]) plate(desk, 'dark', [x, .40, .30], [.04, .28, .30]);
  add(desk, 'ring', 'brass', [.64, .575, .30], [.05, .05, .05], [Math.PI / 2, 0, 0]);
  plate(desk, 'dark', [.64, .60, .30], [.20, .02, .12], [0, 0, 0], true);
  for (const [x, z] of [[.48, .16], [.80, .16], [.48, .44], [.80, .44]]) add(desk, 'bolt', 'titanium', [x, .53, z], [.006, .012, .006], [0, 0, 0], true);

  for (const side of [-1, 1]) {
    const screen = part(`interior.screen.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} instrument display`, 'Interior',
      'Shows the telescope pointing and drive readouts.',
      'A dark bezel, a teal panel and a brass stand sit on the observer desk; the display content is illustrative.', undefined, [0, .04, 0], 'Dark bezel, teal panel and brass stand');
    plate(screen, 'dark', [.52 + (side > 0 ? .26 : 0), .72, .30], [.24, .18, .025], [-.12, 0, 0]);
    plate(screen, 'lens', [.52 + (side > 0 ? .26 : 0), .72, .315], [.19, .13, .008], [-.12, 0, 0]);
    rod(screen, 'brass', [.52 + (side > 0 ? .26 : 0), .60, .30], [.52 + (side > 0 ? .26 : 0), .64, .30], .010);
  }

  const chair = part('interior.chair', 'Observer chair', 'Interior',
    'Gives the operator a seat at the desk.',
    'A dark seat, a pale back, five brass feet and a gas column stand beside the desk.', undefined, [0, .04, 0], 'Dark seat, pale back and brass feet');
  plate(chair, 'dark', [.76, .44, -.02], [.30, .07, .30]);
  plate(chair, 'shell', [.76, .60, -.14], [.30, .30, .06], [-.12, 0, 0]);
  axial(chair, 'brass', [.76, .34, -.02], .045, .16, 'y');
  for (let i = 0; i < 5; i++) {
    const a = i * TAU / 5;
    rod(chair, 'dark', [.76, .28, -.02], [.76 + .16 * Math.cos(a), .24, -.02 + .16 * Math.sin(a)], .012);
  }

  const cabinet = part('interior.cabinet', 'Instrument cabinet and cable tray', 'Interior',
    'Stores the auxiliary optics and routes the control cables.',
    'A pale cabinet, four dark drawers, a copper cable tray and a brass latch sit against the south wall.', undefined, [0, .04, 0], 'Pale cabinet and copper cable tray');
  plate(cabinet, 'shell', [-.70, .48, .48], [.42, .72, .28]);
  for (let i = 0; i < 4; i++) plate(cabinet, 'dark', [-.70, .24 + i * .16, .625], [.34, .12, .012], [0, 0, 0], true);
  add(cabinet, 'cylinder', 'brass', [-.52, .48, .63], [.012, .05, .012], [Math.PI / 2, 0, 0]);
  rod(cabinet, 'copper', [-.48, .90, .40], [-.10, .94, .20], .008);

  const ladder = part('interior.ladder', 'Dome access ladder', 'Interior',
    'Provides a visible route to the dome track.',
    'Two dark rails, six titanium rungs and two brass standoffs rise beside the wall.', undefined, [0, .04, 0], 'Dark rails and titanium rungs');
  for (const side of [-1, 1]) rod(ladder, 'dark', [.98 + side * .12, .16, -.64], [.98 + side * .12, 1.20, -.64], .014);
  for (let i = 0; i < 6; i++) rod(ladder, 'titanium', [.86, .22 + i * .17, -.64], [1.10, .22 + i * .17, -.64], .008);
  for (const side of [-1, 1]) add(ladder, 'sphere', 'brass', [.98 + side * .12, 1.20, -.64], [.018, .018, .018]);

  const clock = part('interior.sidereal-clock', 'Sidereal clock and barometer', 'Interior',
    'Shows the observatory time and weather references.',
    'Two dark bezels, pale dials and brass hands are mounted on the wall above the cabinet.', undefined, [0, .04, 0], 'Dark bezels and brass hands');
  for (const [x, y] of [[-.80, .96], [-.60, .96]]) {
    add(clock, 'cylinder', 'dark', [x, y, .62], [.09, .03, .09], [Math.PI / 2, 0, 0]);
    add(clock, 'cylinder', 'shell', [x, y, .64], [.075, .01, .075], [Math.PI / 2, 0, 0]);
    rod(clock, 'brass', [x, y, .65], [x + .05, y + .02, .65], .004);
  }

  const heater = part('interior.dehumidifier', 'Dome dehumidifier and drain', 'Interior',
    'Shows the climate-control unit at the wall.',
    'A dark box, a pale grille, four brass feet and a copper drain line sit beneath the instrument cabinet.', undefined, [0, .04, 0], 'Dark box, pale grille and copper drain');
  plate(heater, 'dark', [-.96, .34, .28], [.28, .26, .22]);
  for (let i = 0; i < 5; i++) plate(heater, 'shell', [-1.04, .28 + i * .028, .395], [.14, .012, .012], [0, 0, 0], true);
  rod(heater, 'copper', [-.96, .22, .38], [-.84, .10, .52], .007);

  const plaque = part('interior.plaque', 'SPECULA O6 instrument plate', 'Interior',
    'Identifies the observatory and its telescope.',
    'A teal plate with three brass studs and two titanium screws is fixed beside the entry door.', undefined, [0, .03, 0], 'Teal plate and brass studs');
  plate(plaque, 'teal', [.46, .88, 1.185], [.24, .06, .012]);
  for (let i = 0; i < 3; i++) add(plaque, 'bolt', 'brass', [.38 + i * .05, .88, 1.195], [.007, .012, .007], [Math.PI / 2, 0, 0], true);

  // ---------------------------------------------------------------- animation
  const bind = nodes.map(node => ({ node, p: node.position.clone(), q: node.quaternion.clone(), s: node.scale.clone() }));
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.telescope && state?.dome && state?.shutter) lastState = state;
    else if (Number.isFinite(state?.phase)) lastState = poseAt(state.phase * TAU, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    domeGroup.rotation.y = pose.dome.angle;
    shutterLeft.rotation.y = -pose.shutter.angle;
    shutterRight.rotation.y = pose.shutter.angle;
    tube.rotation.x = -pose.telescope.altitude;
    for (const record of mirrors) {
      if (record.kind === 'pinion') record.node.rotation.y = pose.drive.pinionAngle;
      if (record.kind === 'drive') record.node.rotation.x = pose.drive.wheelAngle;
      if (record.kind === 'primary') record.node.rotation.z = pose.drive.fanAngle * .06;
    }
    kit.sync(options);
  }
  update(lastState);
  return {
    group: kit.group, update, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
