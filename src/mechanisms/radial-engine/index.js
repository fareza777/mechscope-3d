import { DEFAULT_INPUTS, cycleHz, sample } from './kin.js';

export const descriptor = {
  id: 'radial-engine', title: 'ASTRA R9', family: 'Radial Piston Engine', collection: '016',
  description: 'Nine ribbed cylinders, eighteen live valves, and a layered cranktrain on an open aviation service fixture. An engineered axial-staggered demonstrator, not a production master-rod radial engine.',
  defaultInputs: DEFAULT_INPUTS,
  controls: [
    { key: 'cadence', label: 'Four-stroke cadence', min: .04, max: .3, step: .01, unit: 'Hz', precision: 2 },
    { key: 'valveLift', label: 'Valve lift', min: .5, max: 1.3, step: .05, unit: '×', precision: 2 },
  ],
  specs: [{ value: '09', label: 'CYLINDERS' }, { value: '18', label: 'LIVE VALVES' }],
  cycleLabel: '720° ENGINE CYCLE', cycleHz, sample,
  lessons: [
    { title: 'A star opened for service', short: 'Nine cylinders without a propeller', text: 'The star silhouette is an aviation-inspired teaching fixture, not a production radial engine. Each cylinder sits in its own axial lane so its rigid connecting rod can be inspected independently. The absent propeller leaves the cranktrain and copper service plumbing visible.', fact: 'Nine axial lanes are separated by 60 mm; the fixture is grounded, not the engine.', view: 'home', mode: 'solid', explode: 0 },
    { title: 'Follow the two exact pivots', short: 'No stretching connecting rods', text: 'The eccentric journal follows a circle while every wrist pin follows its cylinder axis. The slider position is the positive square-root solution of the fixed-length connecting-rod constraint. Ten crank webs sit between, rather than inside, the nine rod lanes; the long eccentric journal engages every big end.', fact: '100 mm crank radius and 400 mm rigid rods produce an exact 200 mm stroke.', view: 'detail', mode: 'cutaway', explode: 0 },
    { title: 'Remember the second revolution', short: 'Eighteen timed valves and rockers', text: 'Power, exhaust, intake and compression occupy two crank revolutions. Intake and exhaust lift use smooth 720-degree schedules, not a repeated half-cycle. The lift control moves real valve stems, tilts the rockers and changes the endpoints of rigid pushrods through their guided tappets.', fact: 'Firing order is 1–3–5–7–9–2–4–6–8; intake opens at 340° after firing TDC.', view: 'top', mode: 'xray', explode: .12 },
    { title: 'Three different service circuits', short: 'Trace the annular plumbing', text: 'Rear annular headers distribute intake and collect exhaust, while a separate copper ignition ring sends individual branches to the split heads. Short fittings, clamps and insulated spark terminals make each route readable. These lines are structural illustrations, not a combustion or fluid simulation.', fact: 'The copper ignition branches remain fixed while the two valves in each head reciprocate.', view: 'side', mode: 'solid', explode: .3 },
    { title: 'Separate and return', short: 'A reversible layered teardown', text: 'The split heads and barrel assemblies move radially outward while service rings separate axially. The grounded stand stays fixed. Returning explosion to zero restores the exact current pose, including both crank revolutions and every valve lift, without accumulating transforms from earlier frames.', fact: 'Cam timing is analytic; rocker pads slide at contact and are not a cam-contact solver.', view: 'front', mode: 'solid', explode: 1 },
  ],
  async createModel() { return (await import('./model.js')).createModel(); },
};
export default descriptor;
