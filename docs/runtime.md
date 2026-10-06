# Using creatures in a game

A blueprint becomes a game creature in one of two ways: **live** in a Three.js game through the
runtime API, with procedural motion that adapts to the terrain, or **exported** as a `.glb` with
baked animations for any engine. Both come from the same blueprint, and both follow glTF
conventions: metres, Y up, creatures facing +Z.

## Live, in Three.js

```ts
import { basicPack } from '@spawnforge/modules';
import { createBestiary } from '@spawnforge/three';

const bestiary = await createBestiary({
  packs: [basicPack],
  workers: 2,
  // A worker script that knows the same packs (module code cannot be sent to a worker):
  //   import { basicPack } from '@spawnforge/modules';
  //   import { serveCompiles } from '@spawnforge/three/worker';
  //   serveCompiles([basicPack]);
  worker: () => new Worker(new URL('./compile.worker.ts', import.meta.url), { type: 'module' }),
});

const stalker = await bestiary.spawn(blueprint, { seed: 7, quality: 'medium', position: { x: 4, z: 0 } });
scene.add(stalker.object);

stalker.moveTo(target);               // steering, gait choice from speed
stalker.lookAt(player.position);      // the head tracks a point; null looks ahead again
stalker.act('bite', { target: player });
stalker.on('bite-contact', () => player.hurt(stats.attack));
stalker.on('footstep', (e) => audio.play('step', e.position));

// every frame: the game supplies the ground's height (and optionally its normal) at (x, z)
renderer.setAnimationLoop(() => {
  bestiary.update(clock.getDelta(), { ground: (x, z) => terrain.sample(x, z), camera });
  renderer.render(scene, camera);
});
```

- **Spawning.** `spawn(blueprint, { seed, quality, position, heading })` compiles in a worker (or
  on the calling thread without one) and places the creature standing. Without `worker`, compiles
  run on the main thread: fine for a few creatures, a frame hitch for many.
- **Caching.** Compiled creatures are cached by blueprint (with its seed), quality and library
  version (format and packs), so a herd of one species compiles once. `cacheSize` sets how many
  are kept (default 64). `seed` overrides the blueprint's seed for a different individual's
  details.
- **Motion.** `moveTo(point, { speed })`, `stop()`, `lookAt(point | null)` and
  `act(id, { target })`, where `target` is a point or an `Object3D`. `actions()` lists what the
  creature can do. `creature.update(dt, { ground })` updates one creature; `bestiary.update`
  updates all of them.
- **Ground callback, not physics.** `ground(x, z)` returns `{ height, normal? }`, so creatures
  walk on any terrain or physics engine. Without it the ground is flat at y = 0.
- **Events.** `on(type, listener)` returns an unsubscribe function. Types: `footstep` (with
  `leg` and `position`), `gait` (a gait change), `action-start`, `action-end`, and the moments
  actions mark, such as `bite-contact` and `roar-peak`; `'*'` hears everything. `update` also
  returns the events it fired.
- **Sockets.** `creature.sockets` holds nodes that follow the body: `head`, `mouth`, each eye
  (`eye.eyes.L`), each claw tip (`claw.foreleg.L.0`) and `centerOfMass`. Parent effects to them,
  or read `creature.socket('mouth')` for a world position.
- **Hit volumes.** `creature.hitCapsules()` returns one world-space capsule per body bone
  (`start`, `end`, `radius`) for the current pose.
- **Level of detail.** Pass `camera` to `bestiary.update`: beyond `lodDistance` (default 30)
  times the creature's torso length, it drops foot IK and tail springs and plays baked gait
  cycles at the speed it is moving, and it switches back when the camera comes near. A creature
  busy with an action finishes it first. Choose mesh detail per creature with `quality`.
- **Draw calls.** Three per creature: the skin (with the inner mouth), the hard parts and the
  eyes.
- `bestiary.remove(creature)` and `bestiary.dispose()` free meshes and workers.

## Exported, as .glb

```sh
spawnforge export creature.json --out creature.glb --stats rpg
spawnforge export creature.json --clips idle,walk,bite --quality low --fps 24
```

(MCP: the `export` tool. The sandbox's "export .glb" button does the same in the browser.)

A `.glb` holds:

- **Three skinned meshes** sharing one skeleton: `skin`, `parts` and `eyes`. The pattern stack is
  baked into vertex colours (`COLOR_0`, linear, albedo only); each material has one roughness,
  the mesh's average. Bump and per-pixel detail need texture baking, which is not in this
  version.
- **The skeleton.** Bone names have `.` replaced by `_` (`foreleg_L_1`), since animation tracks
  address nodes as `name.property`.
- **Baked clips:** `idle` (glances, weight shifts and blinks as eye scale; breathing is a shader
  effect and stays out of the file), one cycle of each gait
  (`walk`, `trot`, `tripod`, `slither`) and each action (`bite`, `roar`, `look`). The root stays at
  the origin facing +Z: gait cycles are in place and loop seamlessly, so the game moves the
  creature. Each cycle was baked at a speed and covers a distance (in the extras), so play it at
  `speed / clipSpeed` times its rate to keep the feet from sliding.
- **Sockets** as empty nodes under their bones, named `socket_` plus the socket name
  (`socket_mouth`, `socket_claw_foreleg_L_0`).
- **Extras** on the creature's root node, under `spawnforge`: `format`, the minimal `blueprint`
  (rebuild or edit the creature from it), `seed`, `scale`, `quality`, `sockets` (name, node and
  bone), `hitCapsules` (bone and radius), `clips` (name, duration, loop, speed, distance and
  events such as footsteps and `bite-contact` with their times), and `stats` when asked for.

## Stats

A stats module turns a creature's measured body into one game's numbers, so form drives
function. `spawnforge analyze creature.json --stats rpg` adds them to the analysis, and `export
--stats rpg` stores them in the file. The `rpg` module in the basic pack is an example: health
from mass, speed from the fastest gait, attack from teeth, horns and claws, defence from chitin,
scales and spikes, perception from eyes.

A game writes its own as one file in a pack:

```ts
export default defineStats({
  id: 'my-game',
  summary: 'Numbers for My Game.',
  tags: [],
  params: z.strictObject({ level: z.number().min(1).max(50).default(1).describe('Creature level') }),
  outputs: { hp: 'Hit points', damage: 'Damage per bite' },
  hooks: {
    compute(input, params) {
      // input: measurements (mass, height, bodyHeight, legLength…), speed, biteReach, legs,
      // arms, material, temperament, actions, parts (type, tags, size, count) and claws.
      const level = params.level as number;
      return { hp: Math.round(input.measurements.mass ** (1 / 3) * 10 * level), damage: 3 };
    },
  },
});
```
