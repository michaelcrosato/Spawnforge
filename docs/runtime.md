# Using creatures in a game

A blueprint becomes a game creature in one of two ways: **live** in a Three.js game through the
runtime API, with procedural motion that adapts to the terrain, or **exported** as a `.glb` with
baked animations for any engine. Both come from the same blueprint, and both follow glTF
conventions: metres, Y up, creatures facing +Z, angles in radians.

## Setting up

The packages are not published to npm yet. Use them from this repository, as workspace packages
or a git dependency: `@spawnforge/core`, `@spawnforge/modules` (the basic pack) and
`@spawnforge/three` (the Three.js layer). They ship TypeScript source, so the game's bundler must
compile TypeScript, as Vite does out of the box. Three.js is pinned to r186; the game should use
the same release.

The live creatures use TSL node materials, so they need Three.js's `WebGPURenderer` (from
`three/webgpu`), which runs on WebGPU where it can and falls back to WebGL 2.
`createRenderer(canvas)` from `@spawnforge/three` makes one. A game built on the classic
`WebGLRenderer` should use exported `.glb` files instead, which have plain materials.

## Live, in Three.js

```ts
import { basicPack } from '@spawnforge/modules';
import { createBestiary, createRenderer } from '@spawnforge/three';

const { renderer } = await createRenderer(canvas);
const bestiary = await createBestiary({
  packs: [basicPack],
  workers: 2,
  worker: () => new Worker(new URL('./compile.worker.ts', import.meta.url), { type: 'module' }),
});

// A blueprint is the JSON you would save in a file: `extends`, sections, parts and all.
const blueprint = await (await fetch('/creatures/stalker.json')).json();
const stalker = await bestiary.spawn(blueprint, { seed: 7, quality: 'medium', position: { x: 4, z: 0 } });
scene.add(stalker.object);
const stats = bestiary.stats(stalker, 'rpg'); // { health, speed, attack, defence, perception, threat }

stalker.moveTo({ x: 10, z: -3 }, { speed: 2 });
stalker.on('arrive', () => stalker.act('roar'));
stalker.lookAt(player.position);
stalker.act('bite', { target: player });
stalker.on('bite-contact', () => {
  // The bite fires on time whether or not it connects: test the reach yourself.
  if (stalker.socket('mouth').distanceTo(player.position) < 0.5) player.hurt(stats.attack);
});

renderer.setAnimationLoop(() => {
  // The game supplies the ground's height (and optionally its normal) at (x, z).
  bestiary.update(clock.getDelta(), { ground: (x, z) => terrain.sample(x, z), camera });
  renderer.render(scene, camera);
});
```

The worker script (here `compile.worker.ts`) imports the same packs, since module code cannot be
sent to a worker:

```ts
import { basicPack } from '@spawnforge/modules';
import { serveCompiles } from '@spawnforge/three/worker';

serveCompiles([basicPack]);
```

`new URL('./compile.worker.ts', import.meta.url)` is how Vite (and webpack 5) bundle a worker.
Without `worker`, creatures compile on the calling thread: fine for a few, a frame hitch for many,
and the way to use the runtime in Node or tests.

### Spawning

- **`bestiary.spawn(blueprint, options)`** returns a `Promise<Creature>`. Options: `seed` (an
  integer that overrides the blueprint's, for a different individual's details), `quality`
  (`low`, `medium` or `high`, default medium), `position` (`{ x, z }`), `heading` (radians, 0
  faces +Z) and `ground` (to stand it on terrain from the start).
- **Invalid blueprints** reject the promise with an `Error` whose message lists each problem with
  its path, the same errors `validate` gives. A species (with `{ "min", "max" }` ranges) is not a
  creature: `instantiate` it first (`instantiate(species, seed, registry)` from
  `@spawnforge/core`).
- **Caching.** Compiled creatures are cached by blueprint (with its seed), quality, format and
  packs, so a herd of one species compiles once. `cacheSize` sets how many are kept (default 64).
- `bestiary.remove(creature)` takes one out of the scene and frees its meshes;
  `bestiary.dispose()` frees everything, workers included.

### Moving and acting

| Call | Takes | Notes |
| --- | --- | --- |
| `moveTo(target, { speed })` | `{ x, z }` (a `Vector3` works), speed in m/s | Steers, picks the gait from the speed, fires `arrive` when there; `null` stops |
| `stop()` | | Slows to a stand |
| `lookAt(point)` | `{ x, y, z }` or `null` | The head tracks the point; `null` looks ahead again |
| `act(id, { target })` | an action id, a point or an `Object3D` | Starts it now, replacing a running action; throws, naming the creature's actions, if it has no such action |
| `actions()` | | The action ids it can start (`bite`, `roar`, `look`…) |
| `update(dt, { ground })` | seconds | One creature; `bestiary.update(dt, { ground, camera })` does all |

Read `creature.position` (a `Vector3` on the ground), `heading` (radians) and `speed` (m/s).
Without `ground`, the ground is flat at y = 0; `ground(x, z)` returns `{ height, normal? }`, so
creatures walk on any terrain or physics engine.

### Events

`creature.on(type, listener)` returns an unsubscribe function, and `update` also returns the
events it fired. Every event has `type` and `time` (seconds of the creature's motion clock):

| Type | Extra fields | When |
| --- | --- | --- |
| `footstep` | `leg` (a leg id such as `foreleg.L`), `position` `[x, y, z]` | A foot plants |
| `gait` | `gait` | It changes gait (walk to trot…) |
| `arrive` | | It reaches its `moveTo` target |
| `action-start`, `action-end` | `action` | An action begins or ends |
| `bite-contact`, `roar-peak` | `action`, `position` (the head) | Moments actions mark: the jaw snaps shut, the roar is loudest |
| `*` | | Every event |

Events carry no target or creature: hold those in your listener. Timing events fire on time
whatever the target is doing, so test hits yourself, with sockets or hit capsules.

### Sockets, hit volumes and stats

- **Sockets.** `creature.sockets` holds nodes that follow the body: `head`, `mouth`, each eye
  (`eye.eyes.L`), each claw tip (`claw.foreleg.L.0`) and `centerOfMass`. Parent effects to them,
  or read a world position with `creature.socket('mouth')`.
- **Hit volumes.** `creature.hitCapsules()` returns one world-space capsule per body bone
  (`bone`, `start`, `end`, `radius`) for the current pose.
- **Stats.** `bestiary.stats(creature, 'rpg')` runs a stats module on the creature's measured
  body. It analyses the creature's motion, so it takes a fraction of a second: call it once per
  creature or species, not per frame.

### Level of detail and cost

- Pass `camera` to `bestiary.update`: beyond `lodDistance` (default 30) times the creature's
  torso length it drops foot IK and tail springs and plays baked gait cycles at the speed it is
  moving, and it switches back when the camera comes near. A creature busy with an action
  finishes it first.
- Mesh detail is per creature (`quality`). Each creature is three draw calls: the skin (with the
  inner mouth), the hard parts and the eyes.

## Exported, as .glb

```sh
spawnforge export creature.json --out creature.glb --stats rpg
spawnforge export creature.json --clips idle,walk,bite --quality low --fps 24
```

(MCP: the `export` tool. The sandbox's "export .glb" button does the same in the browser.) The
output lists the clips, sockets and stats, and `notes` such as an idle that is only a standing
pose (the blueprint lists `motion.actions` without `idle`).

A `.glb` holds:

- **Three skinned meshes** sharing one skeleton: `skin`, `parts` and `eyes`. The pattern stack is
  baked into vertex colours (`COLOR_0`, linear, albedo only); each material has one roughness,
  the mesh's average, and no textures.
- **The skeleton.** Bone names have `.` replaced by `_` (`foreleg_L_1`), since animation tracks
  address nodes as `name.property`.
- **Baked clips:** `idle` (glances, weight shifts and blinks as eye scale; breathing is a shader
  effect and stays out of the file), one cycle of each gait (`walk`, `trot`, `tripod`, `slither`)
  and each action (`bite`, `roar`, `look`). Frames are at `--fps` (default 30).
  - Gait clips are exactly one cycle, in place: the root stays at the origin facing +Z, the clip
    loops seamlessly, and the game moves the creature.
  - Action clips run the action and then 0.25 s of settling back, so they are a little longer
    than the action: its end is the `action-end` event, and its moments (`bite-contact`) are
    events too. Their length rounds to whole frames, so it moves a little with `--fps`.
- **Sockets** as empty nodes under their bones, named `socket_` plus the socket name
  (`socket_mouth`, `socket_claw_foreleg_L_0`).
- **Extras** on the creature's root node, under `spawnforge`: `format`, the minimal `blueprint`
  (rebuild or edit the creature from it), `seed`, `scale`, `quality`, `sockets` (name, node and
  bone), `hitCapsules` (bone and radius), `clips` (name, duration, loop, `speed` it was baked at,
  `distance` one cycle covers, and `events` with their times), and `stats` when asked for.

### Playing a .glb in Three.js

```ts
import { AnimationClip, AnimationMixer, LoopOnce } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltf = await new GLTFLoader().loadAsync('creature.glb');
scene.add(gltf.scene);
// GLTFLoader puts node extras on userData.
let info;
gltf.scene.traverse((o) => (info ??= o.userData.spawnforge));
const mixer = new AnimationMixer(gltf.scene);
const play = (name) => mixer.clipAction(AnimationClip.findByName(gltf.animations, name));

// Walk at 1.5 m/s with the feet planted: scale the cycle by speed over the speed it was baked at.
const walk = play('walk');
walk.timeScale = 1.5 / info.clips.find((c) => c.name === 'walk').speed;
walk.play();
// move gltf.scene forward by 1.5 m/s yourself: the clip is in place.

// A bite once, with damage at its contact moment.
const biteInfo = info.clips.find((c) => c.name === 'bite');
const contact = biteInfo.events.find((e) => e.type === 'bite-contact').time;
const bite = play('bite').setLoop(LoopOnce, 1);
bite.reset().play();
setTimeout(() => dealDamage(), contact * 1000);

const mouth = gltf.scene.getObjectByName('socket_mouth'); // parent a fire-breath effect here
// every frame: mixer.update(dt)
```

### Other engines

Unity, Godot and Unreal import the skeleton, skinned meshes, animations and socket nodes. Colour
lives only in vertex colours, which their default materials ignore: in Godot enable "Vertex
Color > Use as Albedo" on the material; in Unity and Unreal use a material or shader that reads
vertex colour. The extras are glTF `extras` on the root node; some importers keep them as
metadata or custom properties, and where yours does not, read them from the file's JSON chunk
(bytes 12–15 hold its length; it starts at byte 20).

## Stats modules

A stats module turns a creature's measured body into one game's numbers, so form drives
function. `spawnforge analyze creature.json --stats rpg` adds them to the analysis, `export
--stats rpg` stores them in the file, and `bestiary.stats` computes them live. The `rpg` module in
the basic pack is an example: health from mass, speed from the fastest gait, attack from teeth,
horns and claws, defence from chitin, scales and spikes, perception from eyes.

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
