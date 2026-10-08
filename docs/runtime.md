# Using creatures in a game

A blueprint becomes a game creature in one of two ways: **live** in a Three.js game through the
runtime API, with procedural motion that adapts to the terrain, or **exported** as a `.glb` with
baked animations for any engine. Both come from the same blueprint, and both follow glTF
conventions: metres, Y up, creatures facing +Z, angles in radians.

## Setting up

The packages are not published to npm yet. A game needs `@spawnforge/core`, `@spawnforge/modules`
(the basic pack) and `@spawnforge/three` (the Three.js layer). Use them from this repository as
workspace packages (TypeScript source, which the game's bundler compiles, as Vite does out of the
box), or as tarballs: `pnpm build:packages`, then `pnpm pack` in each of the three packages,
gives packages of plain JavaScript and declarations that install like any library
(`scripts/smoke.ts` does exactly this for a small Vite game). Three.js is pinned to r186; the
game should use the same release.

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
const stats = bestiary.stats(stalker, 'rpg'); // { health, speed, attack, attacks, defence, perception, threat }

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
  faces +Z), `ground` (to stand it on terrain from the start), `water` (to start a swimmer
  afloat), and `flying` with an optional `height` in metres above the ground (to start a flyer in
  the air at cruise).
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
| `moveTo(target, { speed })` | `{ x, z }` or `{ x, y, z }` (a `Vector3` works), speed in m/s | Steers, picks the gait from the speed, fires `arrive` when there; `null` stops. Without a speed it keeps its pace on land, its swimming pace in water and its cruise in the air; a `y` is the height a swimmer dives or rises to, or a flyer flies at (a flyer asked higher than 1.5 times its standing height takes off) |
| `stop()` | | Slows to a stand; in the air it hovers (insect wings) or circles where it is |
| `fly({ height, speed })` | metres above the ground, m/s | Takes off (or, flying, changes height or speed) and circles, or hovers, until told where to go; throws for a creature that cannot fly. Waits for a running action to end |
| `land(target)` | `{ x, z }` or `null` | Comes in to land there (or on the first clear ground ahead), flares and touches down, then walks; over water a swimmer lands on it |
| `flying` | | True from the takeoff's crouch until the feet touch down |
| `hit({ direction, bone, strength })` | where the blow pushes (attacker to target), a bone name as `hitCapsules` gives it, 0 to 1 | The spine and neck flinch with it (a blow to the head snaps it); a blow that would carry it past its feet makes it stagger and step to catch itself. Fires `hit` (and `stagger`) |
| `die({ direction })` | where the killing blow pushes (default from its right) | It collapses onto the ground over about a second, falling away from the blow, and lies there; `dead` is true from then on, `dying` until it comes to rest. The dead ignore `moveTo`, `act`, `fly` and `hit`; `controller.place(...)` stands one up again |
| `lookAt(point)` | `{ x, y, z }` or `null` | The head tracks the point; `null` looks ahead again |
| `act(id, { target })` | an action id, a point or an `Object3D` | Starts it now, replacing a running action; throws, naming the creature's actions, if it has no such action |
| `actions()` | | The action ids it can start (`bite`, `roar`, `look`…) |
| `setWings(spread)` | 0 folded to 1 spread | Spreads or folds the wings over about 0.4 s when no action asks otherwise (`roar` flares them); `wingSpread` reads where they are |
| `update(dt, { ground, water })` | seconds | One creature; `bestiary.update(dt, { ground, water, camera })` does all |

Read `creature.position` (a `Vector3` on the ground, or where it swims), `heading` (radians) and
`speed` (m/s). Without `ground`, the ground is flat at y = 0; `ground(x, z)` returns
`{ height, normal? }`, so creatures walk on any terrain or physics engine.

**Flight.** A winged creature walks until asked to fly. Its cruising speed comes from its wing
loading and its wingbeat from its size (a dragon about 25 m/s at under 2 beats a second, a moth
13 m/s at 7); it holds its height above the ground ahead and under its wingtips, banks into turns
no tighter than its wings allow, glides between flaps where it can, and never flies into the
ground. `controller.flightStage` says where a flight is (`crouch`, `launch`, `flight`, `flare`,
`descend`), `controller.wingbeat` the beats a second, and `controller.attitude` its pitch and
bank. Actions run in the air (a bite, a roar), except leaps.

**Hits and death.** A death is procedural, with no physics engine: legs buckle, a body on four
legs (or a bird or raptor) topples onto its side, an upright biped falls along the blow, sprawlers
sink onto their bellies, snakes go limp; necks droop until the heads rest on the ground, tails and
tentacles flop onto it, wings fold and the eyes close. It rests on the game's ground and never
sinks into it by more than about 2% of its size, on flat or uneven ground. Killed in the air, it
falls first; in water, it sinks to the bed. See docs/design/10.5-hits-death.md.

**Water.** `water(x, z)` returns `{ surface }` (the water's height there) or `null` where there
is none; the ground under it is the bed. A creature that swims takes to water deeper than about
its hip height and walks out where it is shallower (a `medium` event each way); one that only
swims stops at the shore. At a distance, with baked cycles, a swimmer keeps its depth and plays
its swimming cycle. `withLake(ground, { x, z, radius, depth })` from `@spawnforge/core` carves a
lake into a ground function for testing, and `openSea(scale)` gives deep water everywhere.

### Events

`creature.on(type, listener)` returns an unsubscribe function, and `update` also returns the
events it fired. Every event has `type` and `time` (seconds of the creature's motion clock):

| Type | Extra fields | When |
| --- | --- | --- |
| `footstep` | `leg` (a leg id such as `foreleg.L`), `position` `[x, y, z]` | A foot plants |
| `gait` | `gait` | It changes gait (walk to trot, trot to gallop, walk to swim…); the legs ease into the new footfalls over a stride or two |
| `medium` | `medium` (`water`, `land` or `air`) | It takes to the water, climbs out onto land, leaves the ground or touches down |
| `arrive` | | It reaches its `moveTo` target |
| `action-start`, `action-end` | `action` | An action begins or ends |
| `takeoff`, `land` | `action`, `position` (the head) | A `jump` or `pounce` leaves the ground and comes down; in between every foot is off the ground and the creature flies a ballistic arc over the game's ground to the target. Flying, the same events (without `action`) mark leaving the ground and touching down |
| `flap` | | A wingbeat's downstroke begins (one a beat; none while gliding) |
| `hit` | `bone`, `position` (the bone hit) | A blow lands |
| `stagger` | `position` | The blow knocks it off balance; it steps to catch itself |
| `death` | `position` | It dies and begins to collapse |
| `bite-contact`, `roar-peak`, `pinch-contact`, `lash-contact`, `display-peak` | `action`, `position` (the head), `head` (with several heads: which one, such as `head.L1`) | Moments actions mark: the jaw snaps shut, the roar is loudest, a pincer snaps shut, a lash strikes, a display is fully open |
| `*` | | Every event |

Events carry no target or creature: hold those in your listener. Timing events fire on time
whatever the target is doing, so test hits yourself, with sockets or hit capsules.

### Sockets, hit volumes and stats

- **Sockets.** `creature.sockets` holds nodes that follow the body: `head`, `mouth`, each eye
  (`eye.eyes.L`), each claw tip (`claw.foreleg.L.0`), each wing's tip (`tip.wing.L`) and
  `centerOfMass`. Parent effects to them,
  or read a world position with `creature.socket('mouth')`. With several heads, `head` and
  `mouth` are the main (middle) head's, and the others add their instance: `head.L1`,
  `mouth.L1`. An action aimed at a target uses the nearest head.
- **Hit volumes.** `creature.hitCapsules()` returns one world-space capsule per body bone
  (`bone`, `start`, `end`, `radius`) for the current pose.
- **Stats.** `bestiary.stats(creature, 'rpg')` runs a stats module on the creature's measured
  body. It analyses the creature's motion, so it takes a fraction of a second: call it once per
  creature or species, not per frame.

### Level of detail and cost

- Pass `camera` to `bestiary.update`: beyond `lodDistance` (default 30) times the creature's
  torso length it drops foot IK and tail springs and plays baked gait cycles at the speed it is
  moving, and it switches back when the camera comes near. A creature busy with an action
  finishes it first, and a dying one its fall; a dead one keeps lying as it fell at any
  distance. Baked creatures hide their fur. A distant flyer keeps flying (its flight
  steps without posing, so it goes where it would have) and plays its air gait's cycle tilted to
  its pitch and bank; takeoffs and landings happen at full detail, and coming near it carries on
  flying where it is.
- The meshes have levels of detail too (docs/design/11.2-lod.md): with a `camera`, each
  creature draws the coarsest of four levels (100, 50, 25 and 10% of the skin's and parts'
  triangles) whose simplification error stays under one pixel, so up close nothing changes and
  far away a creature costs a tenth of its triangles. Pass the viewport's height as `pixels`
  (default 1080: `bestiary.update(dt, { camera, pixels: renderer.domElement.height })`).
  `creature.detail` reads the level (0 is full); `createBestiary({ lods: false })` keeps every
  triangle. The levels are made once per species, the first time one of its creatures is given
  a camera, by loading `@spawnforge/bake/lod` (meshoptimizer's simplifier, a few milliseconds
  per mesh); creatures of a species share them. Fur shells follow the skin's level.
- Mesh detail is per creature (`quality`). Each creature is three draw calls: the skin (with the
  mouth's inside and the eyelids), the hard parts and the eyes. Wings and fins add one for their
  membranes (double-sided). Fur adds another at medium and high quality: the skin's geometry drawn as 12 or 16 instanced shells in one call, which costs
  fill rate more than vertices. Spawn at `quality: 'low'` for none.
- Glowing patterns (`bioluminescence`) pulse on the creature's own clock, which `update`
  advances; `applyPose` passes it to the shader with the pose (`Pose.time`).

## Exported, as .glb

```sh
spawnforge export creature.json --out creature.glb --stats rpg
spawnforge export creature.json --clips idle,walk,bite --quality low --fps 24
```

(MCP: the `export` tool. The sandbox's "export .glb" button does the same in the browser.) The
output lists the clips, sockets, stats and maps (with the bake's time), and `notes` such as an
idle that is only a standing pose (the blueprint lists `motion.actions` without `idle`), or what
the file leaves out (see [below](#what-the-file-leaves-out)). An export at medium quality is about
3–5 MB and takes 5–8 s, most of it baking the maps.

A `.glb` holds:

- **Skinned meshes** sharing one skeleton: `skin`, `parts`, `eyes`, and `membranes` with wings
  or fins. Each has its own **texture maps** in its own UV atlas (`TEXCOORD_0`), baked from the
  live material by `@spawnforge/bake` (docs/design/11.1-textures.md):
  - base colour (sRGB), with the membranes' opacity in its alpha where they are see-through
    (alpha mode `BLEND`); membranes are always double-sided;
  - a tangent-space normal map for the skin's relief, with MikkTSpace tangents (`TANGENT`) in
    glTF's handedness, so every engine decodes it in the frame it was baked in; chitin's
    lacquer is a clearcoat (`KHR_materials_clearcoat`) with the same normal map;
  - one ORM image: occlusion (R, from the distance field: creases and the joins of legs and
    body), roughness (G) and metalness (B, always 0);
  - glow, where anything glows, with `KHR_materials_emissive_strength` when it is brighter
    than 1; on membranes this map also carries the light through them.
  Maps are 1024 texels at medium quality (512 at low, 2048 at high) for the skin, half that for
  parts and membranes, 256 for eyes; `--textures 2048` picks the skin's size, and
  `--textures none` writes vertex colours (`COLOR_0`, albedo only) instead, as before 11.1.
- **Levels of detail** (docs/design/11.2-lod.md): `skin_LOD1`, `skin_LOD2` and `skin_LOD3`
  (50, 25 and 10% of the triangles; `parts_LOD1` and so on likewise), the naming Unity uses for
  LOD groups. Each shares the full mesh's skeleton, vertices and maps; only its triangles
  differ. They are listed on the full mesh's node with `MSFT_lod`, with `MSFT_screencoverage`
  (the share of the screen's height below which each level's error stays under a pixel at 1080
  pixels) in its extras, and are not in the scene's tree, so a loader without the extension
  (three's `GLTFLoader`, most viewers) shows only the full mesh. The extras' `lods` gives each
  level's triangles, error in metres and node name, to set your engine's own switches;
  `--lods none` leaves them out.
- **Wings rest folded.** The skeleton is bound with the wings spread and every node defaults to
  the rest pose, so a winged creature stands folded with no clip playing; a clip carries a track
  for every bone that leaves its rest.
- **The skeleton.** Bone names have `.` replaced by `_` (`foreleg_L_1`), since animation tracks
  address nodes as `name.property`.
- **Baked clips:** `idle` (glances, weight shifts and blinks as eyelid bone turns, `eye_eyes_L_upper`
  and `_lower`; breathing is a shader
  effect and stays out of the file), one cycle of each gait (`walk`, `trot`, `run`, `gallop`,
  `bound`, `tripod`, `slither`, and the swimming gaits, baked in open water with the surface at
  y = 0, so the root's height is its depth, and the air gaits `fly`, `glide` and `hover`, baked
  over whole wingbeats at exact phases in level flight with the root at the origin, their
  extras giving `air.pitch`, the pitch they were baked at) and each action (`bite`, `roar`,
  `look`). A flyer also gets `takeoff` (from standing to half a second into powered flight) and
  `land` (from the flare's start to its feet planted), both with root motion as leaps have:
  `takeoff` starts on the ground, `land` ends on it. Every creature gets `death` (hit from its
  right, it falls onto its left, until half a second after it comes to rest; the root stays in
  place). Frames are at `--fps` (default 30).
  - Gait clips are exactly one cycle, in place: the root stays at the origin facing +Z, the clip
    loops seamlessly, and the game moves the creature.
  - Action clips run the action and then 0.25 s of settling back, so they are a little longer
    than the action: its end is the `action-end` event, and its moments (`bite-contact`) are
    events too. Their length rounds to whole frames, so it moves a little with `--fps`.
  - Leaping actions (`jump`, `pounce`) are baked unaimed and keep their **root motion**: the
    root starts at the origin and its position track carries the creature forward and up
    through the leap, and the clip's extras say `rootMotion: true`. Either let the clip move
    the creature (then put the object where the clip ended, adding its root track's last
    position, before playing the next clip), or strip the root track
    (`clip.tracks = clip.tracks.filter((t) => t.name !== \`${rootBone}.position\`)`) and move
    the object along the leap yourself: the `takeoff` and `land` events give its timing and
    the root track's last position how far it goes.
- **Sockets** as empty nodes under their bones, named `socket_` plus the socket name
  (`socket_mouth`, `socket_claw_foreleg_L_0`).
- **Extras** on the creature's root node, under `spawnforge`: `format`, the minimal `blueprint`
  (rebuild or edit the creature from it), `seed`, `scale`, `quality`, `sockets` (name, node and
  bone), `hitCapsules` (bone and radius), `clips` (name, duration, loop, `speed` it was baked at,
  `distance` one cycle covers, `rootMotion` for clips whose root track moves, and `events` with
  their times), `lods`, and `stats` when asked for.

### What the file leaves out

What the live creature shows that glTF cannot carry as such, and what it becomes in the file
(the export's `notes` list the ones that apply):

| Live | In the `.glb` |
| --- | --- |
| Shell fur | Left out: glTF has no shells. Under the fur the skin's maps carry the coat's mean colour and roughness, and `extras.fur` (length in metres, density, regions) describes it for an engine's own fur |
| Glow that pulses | The glow as it is at time 0, each light at its own brightness; `extras.glow` lists each layer's `pulse` (a second) for a game that animates `emissiveIntensity` |
| Light wrapping round the skin (`skin`, `hide`, fur) | Left out: engines show a harder edge between light and shadow |
| Light through membranes | Baked into the membranes' emissive map, as the live shader adds it |
| Breathing | Left out (a 1% swell of the chest) |
| Detail that fades with distance | Baked at the texel's size; mipmaps fade it further away |
| — | Occlusion is the file's own: the live creature has none |

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

Unity, Godot and Unreal import the skeleton, skinned meshes, animations, socket nodes and the
texture maps (glTF's metallic-roughness materials: base colour, normal, occlusion-roughness-metal
and emissive). An export with `--textures none` keeps its colour only in vertex colours, which
their default materials ignore: in Godot enable "Vertex Color > Use as Albedo" on the material;
in Unity and Unreal use a material or shader that reads vertex colour. The extras are glTF `extras` on the root node; some importers keep them as
metadata or custom properties, and where yours does not, read them from the file's JSON chunk
(bytes 12–15 hold its length; it starts at byte 20).

## Stats modules

A stats module turns a creature's measured body into one game's numbers, so form drives
function. `spawnforge analyze creature.json --stats rpg` adds them to the analysis, `export
--stats rpg` stores them in the file, and `bestiary.stats` computes them live. The `rpg` module in
the basic pack is an example: health from mass, speed from the fastest gait, attack from one
head's teeth and horns plus claws, one attack a turn per head, defence from shells, plates and
bands of armour, chitin, scales and spikes, perception from eyes. Stats modules see which head
each part sits on (`parts[].head`), since parts on a head are copied to every head.

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
      // input: measurements (mass, height, bodyHeight, legLength…), speed, biteReach, heads,
      // legs, arms, material, temperament, actions, parts (type, tags, size, count) and claws.
      const level = params.level as number;
      return { hp: Math.round(input.measurements.mass ** (1 / 3) * 10 * level), damage: 3 };
    },
  },
});
```
