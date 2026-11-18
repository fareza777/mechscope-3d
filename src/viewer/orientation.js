// Several models are built with their face on -z. The shared default camera
// looks from +z, so these overrides put the opening view on the front quarter.
const facing = (y, x = 3.4, z = -4.6) => Object.freeze({
  home: [x, y, z],
  side: [5.2, Math.max(.8, y - .8), -.4],
  top: [0.1, 6.4, 0.2],
  front: [0, Math.max(.8, y - .3), z - 1.0],
  detail: [-3.6, Math.max(.8, y - .2), z + .3],
  exploded: [x + .2, y + .4, z - .3],
});

export const HOME_VIEWS = Object.freeze({
  abyss: facing(1.8, 2.6, -5.0),
  centipede: facing(1.5, 1.8, -5.4),
  cervus: facing(1.9, 2.6, -4.8),
  cobra: facing(2.3, 2.2, -5.2),
  crab: facing(.9, 1.8, -5.2),
  dragonfly: facing(2.3, 2.4, -5.0),
  hummingbird: facing(2.1, 2.2, -5.2),
  mammut: facing(2.2, 2.6, -5.2),
  mantis: facing(2.2, 2.4, -4.9),
  'robot-fish': facing(1.75, 2.6, -5.0),
  scorpion: facing(1.4, 2.2, -5.2),
  sentinel: facing(2.2, 2.6, -5.1),
  tortoise: facing(.9, 1.8, -5.2),
  'steam-locomotive': Object.freeze({
    home: [-5.2, 2.8, 3.6],
    side: [0.5, 1.8, 5.2],
    top: [0.1, 6.4, 0.2],
    front: [-5.4, 1.6, 0],
    detail: [-3.6, 2.4, 3.8],
    exploded: [-4.8, 3.0, 4.0],
  }),
});
