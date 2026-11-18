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
  const domeEuler = (azimuth, phi) => [-phi, Math.PI / 2 - azimuth, 0, 'YXZ'];

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

  const serviceFrame = part('building.service-frame', 'North service door frame and threshold', 'Building',
    'Frames the secondary weather door in the north wall bay.',
    'A dark painted surround, a brass threshold strip and two hinge brackets sit between two wall piers.', undefined, [0, .02, 0], 'Dark surround and brass threshold');
  const serviceAz = 270 * Math.PI / 180;
  const serviceR = 1.205;
  plate(serviceFrame, 'dark', [serviceR * Math.cos(serviceAz), .62, serviceR * Math.sin(serviceAz)], [.72, 1.06, .06], [0, Math.PI / 2 - serviceAz, 0]);
  plate(serviceFrame, 'brass', [serviceR * Math.cos(serviceAz), .11, serviceR * Math.sin(serviceAz)], [.78, .03, .09], [0, Math.PI / 2 - serviceAz, 0]);
  for (const y of [.30, .92]) add(serviceFrame, 'cylinder', 'brass', [serviceR * Math.cos(serviceAz) - Math.sin(serviceAz) * .36, y, serviceR * Math.sin(serviceAz) + Math.cos(serviceAz) * .36], [.016, .10, .016], [0, 0, 0], true);

  const serviceDoor = part('building.service-door', 'Hinged north service door', 'Building',
    'Opens independently of the main entry for instrument traffic.',
    'A pale insulated leaf, four dark stiffeners, a brass pull and a glazed inspection pane swing on two brass hinges.', undefined, [0, .02, 0], 'Pale leaf, dark stiffeners and brass pull');
  const serviceTangent = [-Math.sin(serviceAz), 0, Math.cos(serviceAz)];
  serviceDoor.position.set(serviceR * Math.cos(serviceAz) + serviceTangent[0] * .36, .62, serviceR * Math.sin(serviceAz) + serviceTangent[2] * .36);
  serviceDoor.rotation.y = Math.PI / 2 - serviceAz;
  plate(serviceDoor, 'shell', [.36, 0, 0], [.70, .94, .045]);
  for (let k = 0; k < 4; k++) plate(serviceDoor, 'dark', [.36, -.34 + k * .22, -.025], [.60, .025, .012], [0, 0, 0], true);
  add(serviceDoor, 'cylinder', 'brass', [.60, -.04, .028], [.018, .06, .018], [Math.PI / 2, 0, 0]);
  plate(serviceDoor, 'lens', [.22, .20, .026], [.22, .28, .012]);
  for (const y of [-.36, .36]) add(serviceDoor, 'cylinder', 'brass', [.03, y, 0], [.022, .07, .022]);

  const floorHatch = part('building.floor-hatch', 'Floor service hatch and lifting eye', 'Building',
    'Gives access to the pier foundation and cable trench.',
    'A dark floor plate, a brass lifting eye and four countersunk fasteners sit beside the azimuth track.', undefined, [0, 0, 0], 'Dark floor plate and brass lifting eye');
  floorHatch.position.set(-.46, .152, .44);
  plate(floorHatch, 'dark', [0, 0, 0], [.34, .015, .28]);
  add(floorHatch, 'ring', 'brass', [0, .02, 0], [.055, .055, .055], [Math.PI / 2, 0, 0]);
  for (const [x, z] of [[-.13, -.10], [.13, -.10], [-.13, .10], [.13, .10]]) add(floorHatch, 'bolt', 'titanium', [x, .01, z], [.008, .012, .008], [0, 0, 0], true);

  const stairs = part('building.stairs', 'Three-tread entry stair', 'Building',
    'Provides a visible approach to the door.',
    'Three stone treads, two dark stringers and a brass handrail step up to the observing floor.', undefined, [0, 0, 0], 'Stone treads, dark stringers and brass handrail');
  for (let i = 0; i < 3; i++) {
    plate(stairs, 'shell', [0, .04 + i * .05, 1.42 + i * .20], [.90, .05, .24]);
    plate(stairs, 'dark', [0, .016 + i * .05, 1.42 + i * .20], [.94, .03, .27], [0, 0, 0], true);
  }
  for (const side of [-1, 1]) rod(stairs, 'dark', [side * .42, .10, 1.34], [side * .42, .30, 1.82], .018);
  rod(stairs, 'brass', [-.46, .62, 1.36], [-.46, .62, 1.84], .014);

  const railing = part('building.railing', 'Entry stair railing and newel caps', 'Building',
    'Guides visitors up the stair and around the door landing.',
    'Six dark balusters, a continuous brass handrail, four pale infill rails and eight domed newel caps surround the treads.', undefined, [0, .01, 0], 'Dark balusters, brass handrail and pale infill');
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) rod(railing, 'dark', [side * .52, .18 + i * .05, 1.36 + i * .20], [side * .52, .62 + i * .05, 1.36 + i * .20], .012);
    rod(railing, 'brass', [side * .52, .64, 1.34], [side * .52, .76, 1.84], .014);
    for (let i = 0; i < 3; i++) add(railing, 'sphere', 'brass', [side * .52, .64 + i * .05, 1.36 + i * .20], [.016, .016, .016], [0, 0, 0], true);
    rod(railing, 'shell', [side * .52, .34, 1.40], [side * .52, .42, 1.80], .010, true);
  }

  const cableTray = part('building.cable-tray', 'Wall cable tray and conduit drops', 'Building',
    'Routes power, encoder and network cables from the pier to the wall services.',
    'A dark perforated tray, three copper conduits, six brass saddle clamps and two junction boxes climb the west wall.', undefined, [0, .02, 0], 'Dark tray, copper conduits and brass saddles');
  rod(cableTray, 'dark', [-1.02, .22, -.74], [-1.02, 1.18, -.74], .026);
  for (const dz of [-.05, 0, .05]) rod(cableTray, 'copper', [-1.04, .24, -.74 + dz], [-1.04, 1.16, -.74 + dz], .005, true);
  for (let i = 0; i < 6; i++) add(cableTray, 'ring', 'brass', [-1.02, .30 + i * .15, -.74], [.020, .020, .020], [0, 0, Math.PI / 2], true);
  plate(cableTray, 'dark', [-1.02, .62, -.70], [.12, .18, .08]);

  const wallBracket = part('building.instrument-bracket', 'Wall instrument bracket and shelf', 'Building',
    'Supports the barometer and the spare eyepiece case clear of the floor.',
    'Two dark cantilever arms, a pale shelf, a brass edge rail and four braces bolt to the west wall pier.', undefined, [0, .02, 0], 'Dark cantilevers, pale shelf and brass rail');
  for (const z of [-.22, .12]) rod(wallBracket, 'dark', [-1.12, .86, z], [-.82, .86, z], .014);
  plate(wallBracket, 'shell', [-.97, .89, -.05], [.34, .025, .44]);
  rod(wallBracket, 'brass', [-.82, .93, -.24], [-.82, .93, .14], .008);
  for (const z of [-.22, .12]) rod(wallBracket, 'titanium', [-1.14, .70, z], [-.90, .86, z], .008, true);

  const rail = part('building.rail', 'Dome track and roller ring', 'Dome support',
    'Carries the rotating dome on eight visible rollers.',
    'A fixed brass track, eight rubber rollers in separate carriages, twelve dark brackets and a drive pinion sit above the wall ring.', undefined, [0, .03, 0], 'Brass track, rubber rollers and dark brackets');
  add(rail, 'ring', 'brass', [0, 1.24, 0], [1.235, 1.235, 1.235], [Math.PI / 2, 0, 0]);
  add(rail, 'ring', 'titanium', [0, 1.21, 0], [1.15, 1.15, 1.15], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    add(rail, 'box', 'dark', [1.14 * Math.cos(a), 1.19, 1.14 * Math.sin(a)], [.08, .06, .08], [0, -a, 0], true);
  }
  const pinion = part('dome.pinion', 'Dome drive pinion', 'Dome drive',
    'Turns the dome through a visible gear mesh.',
    'A nine-tooth brass pinion and a dark gearbox face the fixed dome track from the wall ring.', undefined, [0, .04, 0], 'Brass pinion and dark gearbox');
  pinion.position.set(.94, 1.26, .78);
  kit.gear(pinion, .11, 14, .045, 'brass');
  mirrors.push({ node: pinion, kind: 'pinion' });

  const rollers = [];
  for (let i = 0; i < D.rollerCount; i++) {
    const a = (i + .5) * TAU / D.rollerCount, label = String(i + 1).padStart(2, '0');
    const roller = part(`dome.roller.${label}`, `Dome roller ${label} of eight`, 'Dome support',
      'Rolls on the brass track as the dome scans, taking the dome weight.',
      'A rubber tire, a brass axle, two pale side discs, a brass bearing ring and two bolts form one turning roller carriage.', undefined, [0, .04, 0], 'Rubber tire, brass axle and bearing ring');
    roller.position.set(1.18 * Math.cos(a), 1.245, 1.18 * Math.sin(a));
    roller.rotation.y = -a;
    add(roller, 'cylinder', 'rubber', [0, 0, 0], [D.rollerRadius, .075, D.rollerRadius], [Math.PI / 2, 0, 0]);
    add(roller, 'cylinder', 'brass', [0, 0, 0], [.011, .10, .011], [Math.PI / 2, 0, 0]);
    for (const z of [-.036, .036]) add(roller, 'cylinder', 'shell', [0, 0, z], [.031, .006, .031], [Math.PI / 2, 0, 0], true);
    add(roller, 'ring', 'brass', [0, 0, .036], [.030, .030, .030], [0, 0, 0], true);
    for (const z of [-.032, .032]) add(roller, 'bolt', 'titanium', [0, 0, z], [.008, .010, .008], [Math.PI / 2, 0, 0], true);
    rollers.push({ node: roller, base: roller.quaternion.clone() });
  }

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

  // Dense panel seams: two battens in each of the twelve mid-bays.
  for (let i = 0; i < 24; i++) {
    const band = i < 12 ? 0 : 1, bay = i % 12;
    const az = (bay + .5) * TAU / 12 + Math.PI / 12;
    const phi0 = band === 0 ? .08 : .58, phi1 = band === 0 ? .54 : 1.10;
    const label = String(i + 1).padStart(2, '0');
    const seam = part(`dome.seam.${label}`, `Dome panel seam batten ${label} of twenty-four`, 'Dome structure',
      'Covers the panel joint and stiffens the skin between two ribs.',
      'Six brass-edged segments, two domed rosettes and four countersunk fasteners follow the meridian curve.', domeGroup, [0, .02, 0], 'Brass-edged segments and rosettes');
    const points = Array.from({ length: 7 }, (_, k) => domePoint(az, phi0 + (phi1 - phi0) * k / 6, D.domeRadius * 1.004));
    for (let k = 0; k < 6; k++) rod(seam, 'brass', points[k], points[k + 1], .005);
    for (const k of [0, 6]) add(seam, 'sphere', 'brass', points[k], [.013, .013, .013], [0, 0, 0], true);
    for (const k of [1, 3, 4, 6]) {
      const p = points[k];
      add(seam, 'bolt', 'titanium', [p[0] * 1.008, p[1], p[2] * 1.008], [.006, .010, .006], [Math.PI / 2, 0, 0], true);
    }
  }

  // Ventilation bank: ten framed louvers on both flanks of the slit.
  const ventFrames = part('dome.vent-frames', 'Dome ventilation frames and hinge pins', 'Dome ventilation',
    'Frames ten louver openings in the dome skin.',
    'Ten dark shallow frames, ten brass hinge pins and twenty backing pads sit between the meridian ribs.', domeGroup, [0, .02, 0], 'Dark frames and brass hinge pins');
  const louverAz = [-143.5, -113.5, -83.5, -53.5, -23.5, 23.5, 53.5, 83.5, 113.5, 143.5];
  const louvers = [];
  for (const [i, deg] of louverAz.entries()) {
    const az = deg * Math.PI / 180, phi = .60;
    const p = domePoint(az, phi, D.domeRadius * .992);
    const euler = domeEuler(az, phi);
    plate(ventFrames, 'dark', p, [.20, .28, .015], euler);
    add(ventFrames, 'cylinder', 'brass', [p[0], p[1], p[2]], [.012, .26, .012], euler, true);
    const label = String(i + 1).padStart(2, '0');
    const leaf = part(`dome.louver.${label}`, `Dome vent louver ${label} of ten`, 'Dome ventilation',
      'Meters cooling airflow through the dome skin during the observing cycle.',
      'A pale louver blade, three dark weather slats, a brass hinge ring and a folding brass stay sit on the frame.', domeGroup, [0, .04, 0], 'Pale blade, dark slats and brass hinge');
    leaf.position.set(p[0], p[1], p[2]);
    leaf.rotation.set(-phi, Math.PI / 2 - az, 0, 'YXZ');
    plate(leaf, 'shell', [.085, 0, .018], [.17, .24, .018]);
    for (let k = 0; k < 3; k++) plate(leaf, 'dark', [.085, -.08 + k * .08, .030], [.14, .011, .010], [0, 0, 0], true);
    add(leaf, 'ring', 'brass', [0, 0, .018], [.026, .026, .026], [0, Math.PI / 2, 0], true);
    add(leaf, 'cylinder', 'brass', [.165, 0, .026], [.010, .044, .010], [0, 0, 0], true);
    add(leaf, 'bolt', 'titanium', [.06, 0, .032], [.005, .010, .005], [Math.PI / 2, 0, 0], true);
    louvers.push({ node: leaf, base: leaf.quaternion.clone(), index: i });
  }

  const hatchFrame = part('dome.hatch-frame', 'Dome service hatch coaming and seal', 'Dome service',
    'Frames the maintenance opening beside the lower latitude ring.',
    'A pale coaming, a dark gasket, two brass hinge lugs and four bolt pads close the hatched bay.', domeGroup, [0, .02, 0], 'Pale coaming and brass lugs');
  const hatchAz = 202 * Math.PI / 180, hatchPhi = .34;
  const hatchPoint = domePoint(hatchAz, hatchPhi, D.domeRadius * .995);
  plate(hatchFrame, 'shell', hatchPoint, [.24, .24, .05], domeEuler(hatchAz, hatchPhi));
  plate(hatchFrame, 'dark', hatchPoint, [.20, .20, .06], domeEuler(hatchAz, hatchPhi), true);
  for (const side of [-1, 1]) add(hatchFrame, 'cylinder', 'brass', [hatchPoint[0], hatchPoint[1] + side * .10, hatchPoint[2]], [.014, .06, .014], domeEuler(hatchAz, hatchPhi), true);
  const serviceHatch = part('dome.service-hatch', 'Dome service hatch leaf and restraint', 'Dome service',
    'Opens for dome-track inspection without moving the telescope.',
    'A pale hatch leaf, a dark inner rib, a brass pull and a folding restraint strap swing on two brass hinges.', domeGroup, [0, .04, 0], 'Pale hatch leaf and brass restraint');
  serviceHatch.position.set(hatchPoint[0], hatchPoint[1], hatchPoint[2]);
  serviceHatch.rotation.set(-hatchPhi, Math.PI / 2 - hatchAz, 0, 'YXZ');
  plate(serviceHatch, 'shell', [.11, 0, .035], [.22, .20, .035]);
  plate(serviceHatch, 'dark', [.11, 0, .012], [.18, .02, .012], [0, 0, 0], true);
  add(serviceHatch, 'cylinder', 'brass', [.22, 0, .045], [.012, .05, .012]);
  rod(serviceHatch, 'copper', [.04, .06, .05], [.16, .12, .09], .005, true);
  const hatchBase = serviceHatch.quaternion.clone();

  const domeCounterweight = part('dome.counterweight', 'Dome counterweight and safety cable', 'Dome drive',
    'Balances the slit side of the rotating dome and restrains it if the drive slips.',
    'A dark laminated weight, a brass lifting ring, two clamps and a copper safety cable hang below the track.', domeGroup, [0, .03, 0], 'Dark weight, brass ring and copper cable');
  domeCounterweight.position.set(-1.02, -.04, .18);
  for (let i = 0; i < 3; i++) axial(domeCounterweight, 'dark', [0, -.02 - i * .05, 0], .10 - i * .008, .04, 'y');
  add(domeCounterweight, 'ring', 'brass', [0, .01, 0], [.055, .055, .055], [0, Math.PI / 2, 0]);
  rod(domeCounterweight, 'copper', [0, -.13, 0], [-.18, .22, .04], .006, true);
  rod(domeCounterweight, 'titanium', [0, -.13, 0], [-.20, .18, .02], .008, true);

  // ---------------------------------------------------------------- telescope
  const mount = new THREE.Group(); mount.name = 'equatorial-axis'; kit.assemblies.add(mount);
  const pier = part('telescope.pier', 'Concrete pier and isolation collar', 'Telescope mount',
    'Supports the equatorial fork independently of the timber floor.',
    'A dark cylindrical pier, a pale levelling collar and eight brass anchor bolts rise through the floor opening.', undefined, [0, .03, 0], 'Dark pier, pale collar and brass anchors');
  axial(pier, 'dark', [0, .46, 0], .24, .72, 'y');
  axial(pier, 'shell', [0, .86, 0], .35, .09, 'y');
  for (let i = 0; i < 8; i++) add(pier, 'bolt', 'brass', [.27 * Math.cos(i * TAU / 8), .90, .27 * Math.sin(i * TAU / 8)], [.013, .02, .013], [0, 0, 0], true);

  const pierFan = part('telescope.pier-fan', 'Pier electronics cooling fan', 'Telescope drive',
    'Keeps the drive electronics cool while the telescope tracks.',
    'Six pale blades, a brass hub, a dark guard ring and a copper motor can spin beside the pier.', undefined, [0, .02, 0], 'Pale blades, brass hub and dark guard');
  pierFan.position.set(-.28, .42, -.12);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    plate(pierFan, 'titanium', [.045 * Math.cos(a), .045 * Math.sin(a), 0], [.075, .025, .010], [0, 0, -a]);
  }
  add(pierFan, 'cylinder', 'brass', [0, 0, 0], [.018, .018, .018], [Math.PI / 2, 0, 0]);
  add(pierFan, 'ring', 'dark', [0, 0, .005], [.055, .055, .055], [0, 0, 0], true);
  add(pierFan, 'box', 'dark', [0, 0, -.025], [.13, .13, .02]);

  const wedge = part('telescope.wedge', 'Equatorial wedge and latitude sector', 'Telescope mount',
    'Sets the polar axis angle of the fork.',
    'Two dark wedge cheeks, a brass latitude sector and a clamp bolt form the adjustable pier adapter.', undefined, [0, .03, 0], 'Dark wedge cheeks and brass sector');
  plate(wedge, 'dark', [0, .94, 0], [.52, .18, .56], [-.18, 0, 0]);
  add(wedge, 'box', 'brass', [.30, .94, -.06], [.035, .16, .22], [0, 0, 0]);
  axial(wedge, 'titanium', [0, 1.00, -.22], .035, .38);

  const forkBase = part('telescope.fork-base', 'Fork base and declination bearing', 'Telescope mount',
    'Carries both fork arms on the polar axis.',
    'A machined dark turntable, a brass bearing ring and two bolted fork cheeks sit above the wedge.', mount, [0, .03, 0], 'Dark turntable and brass bearing ring');
  axial(forkBase, 'dark', [0, 1.04, 0], .30, .09, 'y');
  add(forkBase, 'ring', 'brass', [0, 1.10, 0], [.24, .24, .24], [Math.PI / 2, 0, 0]);

  for (const side of [-1, 1]) {
    const arm = part(`telescope.fork.${side < 0 ? 'L' : 'R'}`, `${side < 0 ? 'Left' : 'Right'} fork arm`, 'Telescope mount',
      'Supports one end of the declination shaft.',
      'A tapered dark plate, a pale outer web and a brass bearing cap reach from the fork base to the shaft.', mount, [0, .03, 0], 'Tapered plate and brass bearing cap');
    for (const z of [-.10, .10]) rod(arm, 'dark', [side * .29, 1.10, z], [side * .29, 1.44, z], .028);
    plate(arm, 'shell', [side * .29, 1.27, 0], [.05, .27, .19], [0, 0, 0]);
    add(arm, 'ring', 'brass', [side * .29, 1.46, 0], [.075, .075, .075], [0, Math.PI / 2, 0]);
  }
  const shaft = part('telescope.dec-shaft', 'Declination shaft and setting circles', 'Telescope mount',
    'Defines the single altitude axis of the tube.',
    'A continuous titanium shaft, two graduated brass circles and four dark collars pass through both fork bearings.', mount, [0, .03, 0], 'Titanium shaft and graduated brass circles');
  axial(shaft, 'titanium', [0, D.pivot[1], 0], .040, .74);
  for (const side of [-1, 1]) add(shaft, 'ring', 'brass', [side * .33, D.pivot[1], 0], [.095, .095, .095], [0, Math.PI / 2, 0]);
  for (const x of [-.20, .20]) add(shaft, 'cylinder', 'dark', [x, D.pivot[1], 0], [.055, .05, .055], [0, 0, Math.PI / 2]);

  const tube = part('telescope.tube', 'Open tube truss and three longerons', 'Optical tube',
    'Carries the primary mirror, secondary mirror and focuser on one rigid axis.',
    'Three titanium longerons, six brass rings and a dark front cell form an open 1,640 mm tube around the light path.', mount, [0, .04, 0], 'Titanium longerons and brass rings');
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

  const focuser = part('telescope.focuser', 'Focuser body and rack housing', 'Optics',
    'Provides the visual focus and eyepiece interface.',
    'A dark focuser body, two brass focus knobs and a rubber eyecup project from the side of the tube near the front ring.', tube, [0, .03, 0], 'Dark focuser body and brass knobs');
  axial(focuser, 'dark', [0, .16, .88], .048, .14, 'z');
  add(focuser, 'ring', 'brass', [0, .16, .94], [.055, .055, .055], [0, 0, 0]);
  for (const side of [-1, 1]) add(focuser, 'cylinder', 'brass', [side * .07, .13, .84], [.022, .05, .022], [0, 0, Math.PI / 2]);

  const drawtube = part('telescope.drawtube', 'Focuser drawtube, eyepiece and lock screw', 'Optics',
    'Slides in the focuser to set the visual focal plane.',
    'A dark travelling drawtube, a brass lock collar, a rubber eyecup and a graduated scale move along the optical axis.', focuser, [0, .03, 0], 'Dark drawtube, brass collar and rubber eyecup');
  drawtube.position.set(0, .16, .96);
  axial(drawtube, 'dark', [0, 0, .03], .033, .10, 'z');
  add(drawtube, 'cylinder', 'brass', [0, 0, .09], [.038, .014, .038], [Math.PI / 2, 0, 0]);
  add(drawtube, 'cylinder', 'rubber', [0, 0, .11], [.030, .014, .030], [Math.PI / 2, 0, 0]);
  add(drawtube, 'cylinder', 'lens', [0, 0, .12], [.024, .006, .024], [Math.PI / 2, 0, 0]);
  plate(drawtube, 'titanium', [.035, .03, .02], [.03, .012, .06], [0, 0, 0], true);
  const drawtubeBase = drawtube.position.clone();

  const finder = part('telescope.finder', 'Finder scope and bracket', 'Optics',
    'Shows a small auxiliary sighting telescope.',
    'A slim dark tube, two brass rings and a three-point bracket sit above the main tube.', tube, [0, .03, 0], 'Slim dark tube and brass rings');
  axial(finder, 'dark', [.24, .26, .30], .032, .48, 'z');
  for (const z of [.16, .48]) add(finder, 'ring', 'brass', [.24, .26, z], [.042, .042, .042], [0, 0, 0]);
  for (const z of [.22, .42]) rod(finder, 'titanium', [.24, .26, z], [.14, .18, z], .008);

  const guider = part('telescope.guider', 'Off-axis guider and pick-off prism', 'Optics',
    'Samples a star field for the autoguider while the telescope tracks.',
    'A dark guide body, two brass collars, a teal prism window and a copper signal lead clamp beside the focuser.', tube, [0, .03, 0], 'Dark guide body, brass collars and teal prism');
  axial(guider, 'dark', [-.19, .12, .72], .040, .19, 'z');
  for (const z of [.64, .80]) add(guider, 'ring', 'brass', [-.19, .12, z], [.045, .045, .045], [0, 0, 0]);
  add(guider, 'cylinder', 'lens', [-.19, .12, .82], [.020, .008, .020], [Math.PI / 2, 0, 0]);
  rod(guider, 'copper', [-.19, .08, .64], [-.10, -.02, .70], .005, true);

  const spectrograph = part('telescope.spectrograph', 'Spectrograph and instrument dewar', 'Optics',
    'Represents the heavy instrument package carried at the focus.',
    'A dark body, a pale dewar, three brass instrument rings, a teal window and two copper coolant lines hang below the tube.', tube, [0, .04, 0], 'Dark body, pale dewar and copper coolant lines');
  plate(spectrograph, 'dark', [0, -.30, .82], [.26, .18, .24]);
  add(spectrograph, 'cylinder', 'shell', [0, -.30, .95], [.10, .07, .10], [Math.PI / 2, 0, 0]);
  for (const z of [.70, .82, .94]) add(spectrograph, 'ring', 'brass', [0, -.30, z], [.105, .105, .105], [0, 0, 0]);
  add(spectrograph, 'cylinder', 'lens', [0, -.30, .99], [.045, .008, .045], [Math.PI / 2, 0, 0]);
  for (const x of [-.09, .09]) rod(spectrograph, 'copper', [x, -.39, .88], [x * 1.4, -.46, .66], .006, true);

  const guideCamera = part('telescope.guide-camera', 'Autoguider camera and focus motor', 'Optics',
    'Drives the guider focus and reads the guide star.',
    'A teal camera body, a brass nosepiece, two pale spacers and a copper encoder lead sit behind the guider.', tube, [0, .03, 0], 'Teal camera, brass nosepiece and copper lead');
  plate(guideCamera, 'teal', [-.19, .12, .55], [.09, .09, .12]);
  axial(guideCamera, 'brass', [-.19, .12, .63], .028, .05, 'z');
  for (const z of [.52, .57]) add(guideCamera, 'cylinder', 'shell', [-.19, .12, z], [.042, .012, .042], [Math.PI / 2, 0, 0], true);
  rod(guideCamera, 'copper', [-.15, .10, .52], [-.08, .04, .46], .004, true);

  const counterweight = part('telescope.counterweight', 'Declination counterweight stack', 'Telescope mount',
    'Balances the tube around the declination axis.',
    'Three dark discs, two brass spacer rings and a central clamp sit on a short arm behind the fork.', mount, [0, .03, 0], 'Dark discs and brass spacers');
  for (let i = 0; i < 3; i++) axial(counterweight, 'dark', [0, 1.18 - i * .07, -.46], .16 - i * .012, .045, 'y');
  add(counterweight, 'ring', 'brass', [0, 1.22, -.46], [.10, .10, .10], [Math.PI / 2, 0, 0]);
  rod(counterweight, 'titanium', [0, 1.24, -.10], [0, 1.18, -.46], .024);

  const clockWeight = part('telescope.clock-counterweight', 'Clock-drive sliding counterweight', 'Telescope drive',
    'Trims the torque of the sidereal clock drive as the tube changes altitude.',
    'A dark sliding block, a brass guide rod, two bearing rings and a clamp screw ride on a short vertical rail.', mount, [0, .03, 0], 'Dark block, brass rod and bearing rings');
  clockWeight.position.set(.10, 1.28, -.40);
  rod(clockWeight, 'brass', [0, -.10, 0], [0, .16, 0], .010);
  axial(clockWeight, 'dark', [0, 0, 0], .055, .05, 'y');
  for (const y of [-.04, .04]) add(clockWeight, 'ring', 'brass', [0, y, 0], [.030, .030, .030], [Math.PI / 2, 0, 0], true);
  add(clockWeight, 'bolt', 'titanium', [.055, 0, 0], [.008, .014, .008], [0, 0, Math.PI / 2], true);
  const clockWeightBase = clockWeight.position.clone();

  const driveWheel = part('telescope.drive-wheel', 'Sidereal drive wheel and worm', 'Telescope drive',
    'Shows the slow tracking input on the declination shaft.',
    'A brass ring, eight titanium spokes and a dark worm block turn on the right fork bearing.', mount, [0, .03, 0], 'Brass wheel, titanium spokes and dark worm');
  driveWheel.position.set(D.forkX + .12, D.pivot[1], 0);
  add(driveWheel, 'ring', 'brass', [0, 0, 0], [.12, .12, .12], [0, Math.PI / 2, 0]);
  axial(driveWheel, 'dark', [0, 0, 0], .034, .05);
  for (let i = 0; i < 8; i++) {
    const [y, z] = [.115 * Math.cos(i * TAU / 8), .115 * Math.sin(i * TAU / 8)];
    rod(driveWheel, 'titanium', [0, 0, 0], [0, y, z], .006);
  }
  add(driveWheel, 'box', 'dark', [-.045, .10, .10], [.07, .06, .08]);
  mirrors.push({ node: driveWheel, kind: 'drive' });

  const secondsWheel = part('telescope.seconds-wheel', 'Sidereal seconds wheel', 'Telescope drive',
    'Shows the fast seconds train that the clock drive regulates.',
    'A twenty-tooth brass wheel, a dark hub, a graduated index disc and a pointed brass hand turn on the drive bracket.', mount, [0, .03, 0], 'Brass wheel and graduated index');
  secondsWheel.position.set(D.forkX + .24, D.pivot[1] + .22, .05);
  secondsWheel.rotation.z = Math.PI / 2;
  kit.gear(secondsWheel, .085, 18, .028, 'brass');
  plate(secondsWheel, 'titanium', [0, .02, .085], [.012, .14, .012], [0, 0, 0], true);
  add(secondsWheel, 'sphere', 'brass', [0, .04, 0], [.014, .014, .014], [0, 0, 0], true);
  const secondsBase = secondsWheel.quaternion.clone();

  const worm = part('telescope.worm', 'Clock-drive worm and thrust bearing', 'Telescope drive',
    'Reduces the seconds wheel onto the main drive wheel.',
    'A brass worm, a dark thrust block, two titanium bearing rings and a copper oil line sit beneath the seconds wheel.', mount, [0, .03, 0], 'Brass worm, dark thrust block and copper line');
  worm.position.set(D.forkX + .24, D.pivot[1] + .08, .05);
  axial(worm, 'brass', [0, 0, 0], .022, .18, 'x');
  for (const x of [-.06, .06]) add(worm, 'ring', 'titanium', [x, 0, 0], [.032, .032, .032], [0, Math.PI / 2, 0], true);
  add(worm, 'box', 'dark', [0, -.055, 0], [.09, .045, .09]);
  rod(worm, 'copper', [.06, -.03, .02], [.16, -.10, .08], .004, true);

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
  const clockHour = part('interior.clock-hand.hour', 'Sidereal clock hour hand', 'Interior',
    'Shows the hour on the observatory sidereal dial.',
    'A brass hour hand and a dark hub turn once per observing cycle on the left dial.', undefined, [0, .02, 0], 'Brass hand and dark hub');
  clockHour.position.set(-.80, .96, .658);
  rod(clockHour, 'brass', [0, 0, 0], [0, .045, 0], .004);
  add(clockHour, 'cylinder', 'dark', [0, 0, 0], [.008, .01, .008], [Math.PI / 2, 0, 0], true);
  const clockMinute = part('interior.clock-hand.minute', 'Sidereal clock minute hand', 'Interior',
    'Shows the minute on the observatory sidereal dial.',
    'A brass minute hand and a dark hub turn faster than the hour hand on the right dial.', undefined, [0, .02, 0], 'Brass hand and dark hub');
  clockMinute.position.set(-.60, .96, .658);
  rod(clockMinute, 'brass', [0, 0, 0], [0, .060, 0], .003);
  add(clockMinute, 'cylinder', 'dark', [0, 0, 0], [.007, .01, .007], [Math.PI / 2, 0, 0], true);

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
  const qSpinY = new THREE.Quaternion(), qSpinZ = new THREE.Quaternion(), qHingeX = new THREE.Quaternion(), qHingeY = new THREE.Quaternion();
  const axisX = new THREE.Vector3(1, 0, 0), axisY = new THREE.Vector3(0, 1, 0), axisZ = new THREE.Vector3(0, 0, 1);
  function update(state = lastState, options = {}) {
    if (disposed) return;
    if (state?.telescope && state?.dome && state?.shutter) lastState = state;
    else if (Number.isFinite(state?.phase)) lastState = poseAt(state.phase * TAU, state.controls || lastState.controls || {});
    for (const b of bind) { b.node.position.copy(b.p); b.node.quaternion.copy(b.q); b.node.scale.copy(b.s); }
    const pose = lastState;
    domeGroup.rotation.y = pose.dome.angle;
    mount.rotation.y = pose.telescope.azimuth;
    shutterLeft.rotation.y = -pose.shutter.angle;
    shutterRight.rotation.y = pose.shutter.angle;
    tube.rotation.x = -pose.telescope.altitude;
    for (const record of rollers) {
      qSpinZ.setFromAxisAngle(axisZ, pose.drive.rollerAngle);
      record.node.quaternion.copy(record.base).multiply(qSpinZ);
    }
    for (const record of louvers) {
      qHingeX.setFromAxisAngle(axisX, pose.mechanism.louvers[record.index]);
      record.node.quaternion.copy(record.base).multiply(qHingeX);
    }
    qHingeX.setFromAxisAngle(axisX, pose.mechanism.hatch);
    serviceHatch.quaternion.copy(hatchBase).multiply(qHingeX);
    qHingeY.setFromAxisAngle(axisY, -pose.mechanism.serviceDoor);
    serviceDoor.quaternion.multiply(qHingeY);
    floorHatch.rotation.x = -pose.mechanism.floorHatch;
    drawtube.position.copy(drawtubeBase); drawtube.position.z += pose.mechanism.focusTravel;
    spider.rotation.z = pose.mechanism.spiderAngle;
    secondary.rotation.x = pose.mechanism.secondaryTilt;
    qSpinY.setFromAxisAngle(axisY, pose.drive.secondsAngle);
    secondsWheel.quaternion.copy(secondsBase).multiply(qSpinY);
    worm.rotation.x = pose.drive.wormAngle;
    pierFan.rotation.z = pose.drive.fanAngle;
    clockWeight.position.copy(clockWeightBase); clockWeight.position.y += pose.mechanism.clockWeight;
    clockHour.rotation.z = pose.mechanism.clockHour;
    clockMinute.rotation.z = pose.mechanism.clockMinute;
    for (const record of mirrors) {
      if (record.kind === 'pinion') record.node.rotation.y = pose.drive.pinionAngle;
      if (record.kind === 'drive') record.node.rotation.x = pose.drive.wheelAngle;
      if (record.kind === 'primary') record.node.rotation.z = pose.drive.fanAngle * .06;
    }
    kit.sync(options);
  }
  update(lastState);
  // Fit the home view to the scanning dome, the full tube sweep and the stair.
  const framePoints = [];
  for (let i = 0; i < 16; i++) {
    const a = i * TAU / 16;
    framePoints.push(new THREE.Vector3(1.52 * Math.cos(a), 1.18, 1.52 * Math.sin(a)));
    framePoints.push(new THREE.Vector3(1.36 * Math.cos(a), 2.62, 1.36 * Math.sin(a)));
    framePoints.push(new THREE.Vector3(1.02 * Math.cos(a), .02, 1.02 * Math.sin(a)));
  }
  framePoints.push(new THREE.Vector3(0, 2.95, 0), new THREE.Vector3(0, .02, 1.92), new THREE.Vector3(.96, 1.1, .96));
  framePoints.push(new THREE.Vector3(-1.72, 1.30, -1.30), new THREE.Vector3(.78, 1.30, -1.72), new THREE.Vector3(1.72, 1.30, -1.30));
  return {
    group: kit.group, update, framePoints, parts: kit.parts, stats: kit.stats,
    get pickables() { return disposed ? [] : kit.pickables; },
    dispose() { if (disposed) return; disposed = true; kit.dispose(); kit.group.clear(); },
  };
}
