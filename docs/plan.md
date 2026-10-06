# Bestiary: Procedural Monster System Plan

Oct 5, 2026 · @Michael Crosato

> **Repository note.** This is the founding design, imported as written. The project is now called **Spawnforge**; "Bestiary" below was its working name, so packages are `@spawnforge/*` and the blueprint format id is `spawnforge/0.1`. The architecture diagram and the roadmap were embedded objects in the original document and did not survive the export; their captions are kept where they stood.

## Summary

**Yes: build the creature system first, as a standalone library with its own sandbox, and plug it into a game only after the proof of concept below passes.** Integrating early would bend the design around one game; a clean library with a stable data format can feed every game later.

Bestiary (working name) turns a short JSON *blueprint* into a finished 3D monster: mesh, skeleton, textures and animation, all made by code.

- **One source of truth.** A creature is a declarative blueprint (body plan, limbs, parts, skin, behaviour) plus a seed. Same blueprint and seed, same monster, every time.
- **Spore-style bodies.** A skeleton graph is wrapped in a smooth signed-distance-field skin. Hard parts like horns, claws, teeth and eyes are separate procedural meshes snapped onto that skin.
- **Animation is computed, not keyframed.** Gaits come from whatever legs the creature ends up with, feet are placed with inverse kinematics, and tails and antennae swing on springs.
- **Modular.** Every part, pattern, gait and action is one self-registering module file. The core never names a specific part.
- **LLM-first.** A described schema, semantic attachment ("torso at 30%, both sides") instead of coordinates, structured errors, a CLI, an MCP server, and renders an LLM can look at to check its own work.

**The proof of concept is done when** (all five passed at the phase 4 gate; evidence in [poc.md](poc.md)):

- [x] A \~30-line blueprint becomes a textured monster walking over uneven ground in the browser, compiled in under half a second.
- [x] Four body plans run on the same code: biped, quadruped, six-legged and legless serpent.
- [x] A new part type is added by writing one file, with no core changes.
- [x] On a fixed 20-prompt suite, an LLM using only the docs and tools reaches a valid blueprint for at least 18 prompts within 3 fix rounds. A blind reviewer matches at least 16 renders to their prompts.
- [x] The same blueprint and seed produce an identical mesh, and 1,000 fuzzed blueprints compile without an error.

## Scope

The proof of concept proves the whole pipeline on a small, deliberate set of pieces; breadth comes after the pipeline is solid.

**Goals**

- A robust, modular, data-driven generator for 3D creatures that any of your games can reuse.
- Fully procedural: geometry, textures and animation all come from code. No imported meshes, images or keyframes.
- Easy for an LLM to create, inspect, edit and verify monsters without human help.
- A sandbox editor to see creatures live and tweak them.
- Deterministic and testable, so regressions are caught automatically.

**Not in the proof of concept**

- A Spore-style game loop (evolution stages, ecosystems, economy).
- Polished editor UX such as dragging parts onto the body. Sliders and a JSON panel come first.
- Physics-driven or learned locomotion, ragdolls, fur and cloth simulation.
- Ports to Unity, Godot or Unreal. glTF export covers those later.

| Area | In the proof of concept | Later |
| --- | --- | --- |
| Body plans | Biped, quadruped, six-legged, legless serpent | Flyers, swimmers, eight-legged, multi-headed, centaur-style |
| Body sections | Torso, neck, head with jaw, tail | Branching tails, extra heads |
| Limbs | Legs and arms with 2 to 4 segments, feet with toes | Wings, fins, tentacles, mandibles |
| Parts | Horns, spike rows, claws, teeth, eyes | Shells, armour plates, quills, antennae, frills, sails |
| Textures | Countershade, stripes, spots, mottle, scales and grime layers | Scars, bioluminescence, slime, fur-like shells |
| Animation | Idle breathing, walk and trot on uneven ground, turning, look-at, tail springs, bite, roar | Run and gallop, jump, swim, fly, hit reactions, death |
| Tools | Sandbox editor, CLI, MCP server, render to PNG | Click-to-place parts, public gallery, game plug-ins |

## Architecture

Data flows one way: a front-end edits a blueprint, a deterministic pipeline compiles it, and the outputs (including renders and reports) flow back to whoever asked.

*[Diagram not included in this export: architecture · 3 front-ends, 8 pipeline stages, 4 outputs]*

Every front-end writes the same blueprint, stages 1 to 8 turn it into four outputs, and renders and reports return to the LLM so it can check its own work.

- **Core** holds the blueprint schema, module registry, compile pipeline, motion controller and analysis. It has no renderer or DOM dependency, so it runs in the browser, in Web Workers, and in Node for the CLI, MCP server and tests. It may use Three.js math classes.
- **Three.js adapter** is the only layer that renders. It assembles the skinned mesh, builds TSL materials from the material spec, and copies poses from the motion controller into bones each frame.
- **Front-ends** (sandbox, LLM tools, games) all call the same core API and never reach past it.
- **Stages are pure functions** of blueprint, seed and quality. Results are cacheable by hash, testable in isolation and replaceable one at a time.
- **Compiled output is plain data**: typed arrays and JSON, transferable out of workers and storable in a cache.

## The blueprint format

A blueprint is a short JSON document that says what a monster is, in body-relative terms an LLM can reason about. This one describes a complete, animated creature:

```json
{
  "format": "bestiary/0.1",
  "name": "Ridgeback Stalker",
  "seed": 4127,
  "extends": "quadruped",
  "scale": 1.2,
  "body": {
    "torso": { "radius": [0.13, 0.18, 0.16, 0.11], "arch": 0.15 },
    "neck":  { "length": 0.35, "radius": [0.07, 0.09], "pitch": 25 },
    "head":  { "shape": "snout", "length": 0.3, "radius": 0.1, "jaw": true },
    "tail":  { "length": 0.9, "radius": [0.1, 0.015], "curl": 20 }
  },
  "limbs": [
    { "id": "foreleg", "role": "leg", "attach": { "on": "torso", "at": 0.15, "side": "both" },
      "length": 0.55, "segments": 3, "radius": [0.06, 0.035], "foot": { "type": "foot.claw", "toes": 3 } },
    { "id": "hindleg", "role": "leg", "attach": { "on": "torso", "at": 0.9, "side": "both" },
      "length": 0.6, "segments": 3, "radius": [0.07, 0.035], "foot": { "type": "foot.claw", "toes": 3 } }
  ],
  "parts": [
    { "id": "horns", "type": "horn.curved",
      "attach": { "on": "head", "at": 0.75, "angle": 40, "side": "both" },
      "params": { "length": 0.25, "curve": 60 } },
    { "id": "dorsal", "type": "spikes.row",
      "attach": { "on": "torso", "from": 0.05, "to": 0.95, "angle": 0 },
      "params": { "count": 9, "height": [0.08, 0.15, 0.06] } },
    { "id": "eyes", "type": "eye.basic",
      "attach": { "on": "head", "at": 0.4, "angle": 60, "side": "both" },
      "params": { "size": 0.02, "pupil": "slit" } }
  ],
  "skin": {
    "palette": { "base": "#5b6b3a", "belly": "#d8cfa0", "accent": "#2a1e14" },
    "layers": [
      { "type": "countershade", "strength": 0.6 },
      { "type": "stripes", "color": "accent", "count": 12, "region": "back", "jitter": 0.4 },
      { "type": "scales", "size": 0.02, "bump": 0.4 }
    ]
  },
  "motion": { "temperament": "stalking", "gaits": ["walk", "trot"], "actions": ["bite", "roar"] }
}
```

**Rules that keep it easy to write and hard to get wrong**

- **Relative units.** `scale` is the torso length in metres; every other length and radius is a multiple of it. Resize a monster by changing one number.
- **Attach by name, not coordinates.** `on` names a body section, limb or part. `at` runs 0 to 1: snout end to tail end on body sections, root to tip on limbs and parts; a row of parts uses `from` and `to`. `angle` is degrees around the section: 0 is the top (dorsal midline), 90 the part's own side, 180 the belly (ventral midline); on limbs, 0 is the limb's front face.
- **Symmetry by default.** `side` is `both` (the default), `left`, `right` or `center`. `both` makes a mirrored pair with stable ids such as `foreleg.L` and `foreleg.R`; angles of 0 and 180 default to `center`, so a spine row is never doubled.
- **Profiles.** A list of radii or heights is spread evenly along its section and smoothly interpolated; a single number means constant.
- **Presets and inheritance.** `extends` starts from a body-plan preset (biped, quadruped, hexapod, serpent), and `describe_module` shows each preset with its ids. Lists of objects merge by `id`: a matching id overrides field by field, a new id adds an item, and `"remove": true` deletes an inherited one. Other lists replace the inherited list.
- **Paths use ids, not indexes.** Errors and edits address items as written in the file, such as `limbs[id=hindleg].attach.at`, so merging and mirroring never shift what a path points at.
- **Strict, with defaults.** Unknown keys are errors with a "did you mean" fix, never silently dropped. Every parameter has a documented default, range and unit, so short blueprints are valid, and fixed-vocabulary fields (`head.shape`, `pupil`, `region`, `temperament`) are enums listed in the catalogue.
- **Lenient in, minimal out.** A few friendly forms (a single number for a profile, colour names) are normalized in a separate step. Tools return a short diff and the minimal blueprint (non-default values only); the fully expanded form comes only on request.
- **Ranges make species (phase 5).** Any number can be `{ "min": 0.5, "max": 0.7 }`; instancing with a seed picks a value, so one species yields endless individuals.
- **Versioned.** `format` carries the version, and old blueprints are migrated automatically so monsters keep working across games.
- **World conventions** follow glTF: metres, Y up, creature facing +Z.

## Bodies and skin

A body is a skeleton of chains wrapped in one smooth skin computed from a signed distance field (SDF), so any number of limbs joins the body seamlessly.

1. **Body graph to skeleton.** Torso, neck, head and tail form the main axis; limbs, toes and flexible appendages branch off it. Each section becomes a chain of bones with a radius at each joint, a cross-section (round, tall or wide) and a rest pose.
2. **Chains to SDF.** Each bone becomes a rounded cone: a capsule whose two ends have different radii. Bones in one chain join by plain union, since their shared joint spheres already make the join smooth. A smooth minimum is applied once per junction, where a chain meets its parent or an extra mass (shoulders, belly, cheeks) meets its section, with a blend radius of half the smaller radius. That gives muscle-like fillets without beaded joints.
3. **SDF to mesh.** Surface nets runs on a grid fitted to the creature, sampling only near the surface and only against primitives within blend range of it. Light smoothing follows, vertices snap back onto the surface, and normals come from the SDF gradient.
4. **Body coordinates.** Each vertex records where it sits on the body: distance along the spine, height from belly to back, distance along its limb, region masks (head, torso, limb, tail) and crease depth. Textures and part placement read these instead of UVs.
5. **Skin weights from the same geometry.** Each vertex considers only its nearest bone plus that bone's parent and children, so neighbouring toes, or a tail and the thighs, never share weight. Weights are a softmax of radius-scaled distance, smoothed over the mesh, then cut to the top four and renormalized.

```latex
w_b(p) = \frac{e^{-k\,d_b(p)/r_b}}{\sum_{j \in C(p)} e^{-k\,d_j(p)/r_j}}
```

Here d\_b(p) is the distance from vertex p to bone b's shape, r\_b is that bone's radius, C(p) is the vertex's candidate bones, and k sets how soft the joints are.

- **Quality sets the grid.** Low, medium and high use about 48, 96 and 128 cells along the longest axis. Any section thinner than two cells at that quality (toes, tail tips, antennae) is built as a swept mesh skinned to its bones instead, and validation says so. Detail smaller than two cells, such as warts, ridges and scales, is shader bump.
- **Joints that bend well.** Linear blend skinning thins sharply bent joints whatever the weights, so knees, hocks and the jaw hinge get a helper bone that takes half the joint's rotation. It exports as an ordinary bone.
- **Mouths.** The head is meshed closed, then cut along the mouth line. Vertices on the cut are duplicated: upper copies follow the head bone and lower copies the jaw, so the lips never weld. An inner-mouth mesh and teeth sit inside.
- **Off the main thread.** Compilation runs in a Web Worker and returns transferable typed arrays.
- **Why not swept tubes for everything?** Tubes give clean UVs but make limb joins and extra limbs fragile. The SDF route never breaks topology at junctions; the missing UVs are handled under Parts and textures.

## Parts and textures

Hard, detailed pieces are separate procedural meshes snapped onto the skin, and all colour comes from layered shader patterns, so nothing needs UVs or image files.

**Geometry kit.** Every part module builds from a few shared tools:

- `sweep(curve, radius, crossSection)` for horns, claws, teeth, spikes, tentacles and antennae
- `lathe(profile)` for eyeballs, bulbs and nodules
- `plate(outline, thickness)` for fins, armour plates, frills and wing membranes
- `scatter(region, density, spacing)` for Poisson-disk placement of spikes, warts and scales over the skin
- Deformers (bend, twist, taper, noise) and mirroring for pairs

| Part in the PoC | Built with | Notes |
| --- | --- | --- |
| `horn.curved` | Sweep along an arc or spiral | Ridges and twist; pairs mirror |
| `spikes.row` | Sweep, repeated along a section | Height profile along the row |
| `foot.claw` | Sweep at each toe tip | Toes are short skeleton chains |
| `teeth.row` | Sweep, placed along the mouth line | Upper row follows the head bone, lower row the jaw |
| `eye.basic` | Lathe sphere plus iris shader | Round, slit or goat pupils; turns with look-at |

**Sockets.** An anchor resolves to a point on its section's centreline, then marches outward at its angle until it meets the skin. That gives a position and normal; the part's frame uses the normal as up and the section direction as forward. Parts sink slightly into the skin so no gap shows, and copy the skin weights at their socket so they move exactly with it.

**Textures.** Materials are written in TSL (Three.js Shading Language), which compiles to WGSL on WebGPU and GLSL on WebGL 2, so one shader serves both ([three.js manual](https://threejs.org/manual/en/webgpurenderer)). A surface is a base material (skin, scales, chitin, bone, eye) plus an ordered stack of pattern layers. Each layer is a module that adds colour, roughness and bump from body coordinates and rest-pose position, so stripes run across the spine, bellies come out paler, and patterns never swim as the creature moves.

- PoC layers: `countershade`, `stripes`, `spots`, `mottle`, `scales` and `grime`.
- Each layer is a TSL function of explicit inputs (body coordinates, rest position, its own parameters). Parameters are uniforms, so creatures with the same layer types share one compiled shader, and the export bake reuses the same functions.
- Palettes are explicit colours or harmonies generated from the seed, with value-contrast rules so patterns stay readable.

**Export (phase 6).** glTF cannot carry shader code, so export bakes the pattern stack into vertex colours, which hold albedo only; bump and roughness return later with UV atlases (xatlas) and baked texture maps. The bake and the .glb writer run in the same headless Chromium page as renders, because Three.js's exporter relies on browser APIs that Node lacks.

## Procedural animation

Animation is generated from each creature's own shape, the way Spore did it: motion is described as body-relative goals, and inverse kinematics fits those goals to whatever skeleton exists ([Hecker et al., SIGGRAPH 2008](https://chrishecker.com/Real-time_Motion_Retargeting_to_Highly_Varied_User-Created_Morphologies)). The controller is pure math in the core, so the same code animates live in the browser, runs motion checks in Node, and bakes clips for export.

**Locomotion, step by step**

1. **Leg discovery.** Limbs with the role "leg" become supports, paired left and right and ordered back to front; arms stay free for actions. In the PoC legs come in pairs, and an unpaired leg is a validation error that suggests `side: "both"`.
2. **Posture.** Hip height and foot spread come from the body plan: about 85% of reach with feet under the hips for upright walkers, 30 to 50% with feet set wide for sprawlers such as insects and lizards. Body pitch and roll follow uneven legs; impossible layouts become warnings.
3. **Gait from one formula.** Each leg's phase comes from its pair index and side (below), plus a duty factor: the share of the cycle its foot is planted.
4. **Timing scales with size.** With hip height h, stride frequency scales with √(g/h), and the walk-to-trot switch happens near Froude number 0.5 (dynamic similarity). Springs and action durations scale by √(h/g) too, so a 10 m monster lumbers and bites slowly while a small one scurries.
5. **Stepping.** Planted feet stay fixed in the world. Swinging feet arc to a target predicted ahead of the hip, ray-cast onto the ground and tilted to its slope.
6. **IK.** Analytic two-bone IK with a pole vector for knees and elbows. Three-segment legs tie the middle joint to the knee angle by a fixed ratio from the rest pose and reuse the analytic solve, so the fold never flips; FABRIK is kept for four or more segments.
7. **Body motion.** Bob and sway synced to steps, the spine bending into turns, optional side-to-side undulation for lizard gaits, plus head stabilisation and look-at.

```latex
\phi = (i \cdot w + 0.5\,s) \bmod 1
```

Here i is the leg pair counted from the back, s is 0 for left and 1 for right, and w is the wave offset. The wave offset and duty factor together cover the common gaits and extend to any leg count; duties below are starting defaults:

| Gait | Leg pairs | w | Duty | Feet that move together |
| --- | --- | --- | --- | --- |
| Biped walk | 1 | any | 0.6 | Left, then right |
| Quadruped walk | 2 | 0.25 | 0.75 | One at a time: hind left, fore left, hind right, fore right |
| Trot | 2 | 0.5 | 0.5 | Diagonal pairs |
| Insect tripod | 3 | 0.5 | 0.5 | Two alternating tripods |

Legless bodies use a slither gait instead: a travelling wave runs down the spine while each segment follows the path of the one ahead.

**Life beyond walking**

- **Springs.** Tails, antennae, ears and tentacles are Verlet chains with stiffness, damping and gravity, driven by their root bone.
- **Idle.** Breathing (chest bones scale gently), weight shifts, look-around from smooth noise, tail swish and blinks.
- **Actions as modules.** Each action declares what it needs (bite needs a jaw; swipe needs a free arm) and runs anticipation, strike and recovery from body-relative goals such as "head to target, clamped by neck reach". One bite module therefore works on every creature with a mouth.
- **Layering each frame:** locomotion, then posture and look-at, then the action (masked by body region), then springs, then a final foot IK pass so planted feet never slide.

**Baking.** The controller is deterministic at a fixed time step. For export it runs on a treadmill, warms up, then samples exactly one gait cycle (or one action) into animation clips, with root speed stored as metadata. Three.js games keep the live controller; other engines get the baked clips.

## LLM-first tooling

An LLM should get from a text prompt to a checked, finished monster through tools alone. That takes a vocabulary it can discover, inputs that are hard to get wrong, and a way to see the result.

**Design rules**

- **Discoverable vocabulary.** The registry lists every part, pattern, gait, action and preset with its parameters, ranges, defaults, units and an example. The JSON Schema (Zod 4 in input mode, so defaulted fields stay optional) and the docs catalogue are generated from it, so they never drift ([Zod docs](https://zod.dev/json-schema)).
- **Strict schemas.** Every object is strict: an unknown key such as `lenght` is an error with a "did you mean `length`?" fix instead of being silently dropped. Friendly forms are explicit unions, and normalizing is a separate step, never a hidden transform.
- **Semantic, relative inputs.** Named anchors, relative units, presets and symmetry, as in the blueprint format.
- **Errors written for a model.** Each error carries an id-based path, the problem, the valid range and a suggested fix, e.g. `limbs[id=hindleg].attach.at: 1.4 is outside 0–1`.
- **Plausibility warnings.** Beyond schema errors: legs that can't reach the ground, parts buried in the skin, eyes facing backwards, a centre of mass outside the feet.
- **Local edits stay local.** Randomness comes from seed streams keyed by part id, so changing the horns never reshuffles the spots.
- **Small patches on files.** Tools take a blueprint file, apply edit operations (`set`, `add`, `remove`, `mirror`, `scale`) by id, write it back and return a short diff, so a model never pastes an expanded blueprint over its own file.
- **Seeing is checking.** Contact sheets (front, side, top, three-quarter) with a scale bar, filmstrips of one gait cycle, and a debug mode that labels every part id on the image.
- **Motion is checked too.** `analyze` runs the controller for two gait cycles on flat and rough test ground. It reports foot slide, ground penetration, joint-limit hits and limb intersections, each with the limb id and worst frame.
- **Text mirrors.** `describe` turns a blueprint into a paragraph ("a 2 m quadruped with a long arched neck…"); `analyze` also returns height, mass, speed, reach and stability.

**MCP tools** (the CLI offers the same commands with JSON output)

| Tool | Returns | From phase |
| --- | --- | --- |
| `list_modules` | Catalogue of parts, patterns, gaits, actions and presets | 0 |
| `describe_module` | One module's or preset's parameters, ranges, defaults, ids and an example | 0 |
| `validate` | Errors and warnings with id-based paths and fixes, plus the minimal blueprint | 0 |
| `render` | PNG contact sheet with optional part labels; filmstrips once motion lands in phase 2 | 1 |
| `patch` | Edit operations applied to a blueprint file, returned as a validated diff | 4 |
| `analyze` | Measurements, stats, motion checks, warnings and a plain-text description | 4 |
| `generate`, `mutate`, `crossbreed` | New blueprints from a theme, a parent or two parents | 5 |
| `export` | A .glb with skeleton and baked animations | 6 |

- The MCP server is a thin wrapper over the CLI functions, built on the official TypeScript SDK ([v2 release](https://newreleases.io/project/github/modelcontextprotocol/typescript-sdk/release/@modelcontextprotocol%2Fserver@2.0.0)).
- Rendering runs in headless Chromium through Playwright on the WebGL 2 backend, so it works without a GPU in CI and agent sandboxes. The same renders let the LLM building Bestiary check its own work during development.
- **Docs for agents:** `AGENTS.md` (repo map, commands, rules), `docs/blueprint.md`, a generated `docs/catalog.md`, and an examples folder where every blueprint sits beside its render.
- **Live loop with you:** the sandbox watches a creatures folder, so when an LLM saves a blueprint the 3D view updates in your browser.
- **Quality gate:** a fixed 20-prompt suite runs through the tools with a named model and version. It starts in phase 0 as a format eval (schema, docs and `validate` only), so the blueprint format is proven before anything is built on it, and it reruns at every gate.

## Modularity and variation

Every capability is a module: one file with an id, a schema, docs and a build function. The core runs the pipeline and never names a specific part, so adding a horn type or a gait never touches it.

```ts
export default definePart({
  id: 'horn.curved',
  summary: 'Tapered horn bent along an arc; use side "both" for a pair.',
  tags: ['head', 'weapon', 'bone'],
  params: z.strictObject({
    length: z.number().min(0.02).max(1).default(0.2).describe('Length in torso lengths'),
    curve: z.number().min(-270).max(270).default(45).describe('Total bend in degrees'),
    ridges: z.number().int().min(0).max(30).default(0).describe('Rings along the horn'),
  }),
  build(ctx, p) {
    const path = ctx.geo.arc(p.length, p.curve);
    return ctx.geo.sweep(path, t => ctx.socket.radius * 0.6 * (1 - t), { ridges: p.ridges });
  },
});
```

| Module kind | Decides | Examples |
| --- | --- | --- |
| Body plan | The preset behind `extends` | biped, quadruped, hexapod, serpent |
| Part | Geometry snapped onto the skin | horn.curved, spikes.row, foot.claw, teeth.row, eye.basic |
| Pattern | One shader layer of colour, roughness and bump | countershade, stripes, spots, mottle, scales, grime |
| Gait | Phase pattern and timing for legs or spine | walk, trot, tripod, slither |
| Action | A body-relative move with stated needs | bite, roar, look, idle |
| Theme (phase 5) | Biases for random generation | reptile, insect, demon |
| Stats (phase 6) | How a body maps to game numbers | One per game |

- **Packs.** Modules ship in packs, and each game includes only the packs it wants. A pack's index file is generated by a script, so adding a module is still one file.
- **Automatic tests.** Every module is exercised with its defaults, its examples and random parameters drawn from its schema. It must not throw, must stay within vertex and time budgets, and must be deterministic.
- **Written by LLMs too.** Modules are small, typed and documented, with a template to copy, so an LLM can add a new part type and the test harness checks it at once.

**Variation (phase 5)**

- **Species and individuals.** Ranges in a blueprint make a species; `instantiate(species, seed)` resolves them into one individual.
- **Mutate.** Nudges values within their ranges and sometimes adds, removes or swaps parts with matching tags; locked paths never change.
- **Crossbreed.** Matches parts by id or type, blends numbers, and picks discrete genes from either parent.
- **Generate.** Builds a monster from a theme and a seed with a body-plan grammar, under constraints such as maximum height or required actions.
- **Stats.** A per-game stats module turns morphology into gameplay numbers (mass to health, leg length to speed, weapons to attack, plates to defence), so form drives function as in Spore.

## Game integration

Games use Bestiary in one of two ways: live in Three.js through the runtime API, or as exported .glb files in any engine. Both come from the same blueprint.

```ts
const bestiary = await createBestiary({ packs: [basicPack], workers: 2 });
const stalker = await bestiary.spawn(blueprint, { seed: 7, quality: 'medium' });
scene.add(stalker.object);

stalker.moveTo(target);            // steering and gait choice
stalker.lookAt(player.position);
stalker.act('bite', { target: player });

// every frame: the game supplies ground height and normal at (x, z)
stalker.update(dt, { ground: (x, z) => terrain.sample(x, z) });
```

- **Ground callback, not physics.** The game answers "height and normal at (x, z)", so Bestiary works with any terrain or physics engine.
- **Gameplay sockets.** Mouth, eyes, claw tips, head and centre of mass are named nodes for effects, projectiles and hit detection; hit capsules come free from the body chains.
- **Events.** Footstep, bite-contact and roar-peak events drive sound and damage timing.
- **Caching.** Compiled creatures are cached by a hash of blueprint, seed, quality and library version.
- **Level of detail.** Low, medium and high mesh qualities; distant creatures drop springs and foot IK and play baked cycles.
- **Few draw calls.** The skin (with the inner mouth) is one skinned mesh, all hard parts merge into a second, and the eyes are the third.
- **Export (phase 6).** A .glb holds the skinned mesh, skeleton, baked clips (idle, walk, trot, actions), vertex colours, sockets as nodes, and the blueprint and stats as glTF extras. Three.js's GLTFExporter already writes skins, animations and binary .glb ([docs](https://threejs.org/docs/pages/GLTFExporter.html)).

| Budget (checked at the phase gates) | Target |
| --- | --- |
| Compile time, medium quality, in a worker | ≤ 500 ms |
| Skin mesh, medium quality | ≤ 30k triangles |
| Draw calls per creature | ≤ 3 |
| Live animation update per creature | ≤ 0.1 ms (5 ms for 50) |
| Animated creatures at 60 fps on a mid-range laptop | ≥ 50 |

## Tech stack, repo layout and testing

The stack is TypeScript and Three.js with few dependencies; every algorithm that shapes a monster is written in-house so it stays small, deterministic and readable.

| Layer | Choice | Why |
| --- | --- | --- |
| Language | TypeScript, strict mode | Types double as documentation for people and LLMs |
| Rendering | Three.js pinned to one release ([r186 is current as of Sep 2026](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)), WebGPURenderer + TSL | One shader codebase for WebGPU and WebGL 2, with automatic fallback |
| Schemas | Zod 4 | Runtime validation plus native JSON Schema export with descriptions |
| Build and dev | Vite, pnpm workspaces | Fast dev server and hot reload for the sandbox |
| Tests | Vitest, Playwright | Unit, property and visual tests; headless renders |
| LLM bridge | MCP TypeScript SDK v2 | Standard tool interface for Claude and other agents |
| Later | meshoptimizer, xatlas | Mesh simplification for LOD; UV atlases for texture baking |

Written in-house: seeded RNG streams, noise, SDF primitives, surface nets, IK, springs and gaits.

```text
bestiary/
  packages/
    core/      blueprint schema, registry, RNG, compile pipeline, motion controller, analysis (no DOM)
    three/     Three.js runtime: skinned mesh assembly, TSL materials, pose sync, export
    modules/   first pack: body plans, parts, patterns, gaits, actions, themes
    cli/       command line and headless renderer
    mcp/       MCP server over the CLI functions
  apps/
    sandbox/   viewer, sliders, JSON panel, terrain test course, gallery
  examples/    blueprints beside their renders (also the golden test set)
  docs/        AGENTS.md, blueprint.md, catalog.md (generated), architecture.md
```

**Testing**

- **Unit:** SDF, meshing (watertight, manifold, no NaNs), IK reach error under 1 mm, gait phases, RNG streams.
- **Property tests:** random valid blueprints and module parameters, drawn from the schemas, must compile within budget.
- **Golden tests:** example blueprints hash to the same quantized mesh and skeleton on every run, in both Node and Chrome.
- **Visual regression:** headless contact sheets compared against approved baselines.
- **Motion metrics:** foot slide while planted, ground penetration, joint-limit hits, limb and body intersections.
- **Agent eval:** the 20-prompt suite from LLM-first tooling, from phase 0 onward.

## Milestones

Phases 0 to 4 make up the proof of concept. Each ends with a demo you can run and a go/no-go gate that also reruns the LLM prompt suite, so LLM usability is tested from the first phase. Phases 5 and 6 build on it once it passes; phases are sized by scope, not dates.

*[Diagram not included in this export: roadmap · 7 phases, each ending at a gate]*

The proof of concept is done at phase 4's gate; phases 5 and 6 add variety and the path into your games.

## Risks and open questions

The biggest risks are LLM usability, meshing speed and motion quality; each is measured from its first phase rather than discovered at the end.

| Risk | Mitigation |
| --- | --- |
| LLMs can't write the format reliably, and it's found too late | Format eval on a fixed 20-prompt suite from phase 0, rerun at every gate |
| SDF meshing too slow in JavaScript | Narrow-band sampling, per-primitive culling and workers; move hot loops to WASM or WebGPU compute only if profiling demands it |
| Lumpy skins or vanishing thin limbs | Smooth minimum only at junctions; sections under two cells become swept meshes; validation warns |
| Motion looks robotic | Springs, bob and sway, anticipation in actions, motion metrics, side-by-side review against animal reference |
| Joints collapse when bent | Graph-aware weights, smoothing, helper bones at knees, hocks and jaw |
| LLMs are weak at spatial reasoning | Relative units, named anchors, id-based paths, presets, labelled renders, plausibility warnings |
| WebGPURenderer is still labelled experimental, and TSL has less LLM training data than GLSL | Pin the Three.js release, keep materials inside the adapter, give pattern authors helper nodes and worked examples |
| SDF meshes have no UVs | Body coordinates at runtime; vertex-colour bake at export (phase 6); UV atlas and texture bake later |
| Scope creep toward a full Spore | The scope table is the contract; new ideas go to its Later column |

**Open questions**

- [ ] Art direction: stylized (clean shapes, bold patterns) or closer to realistic? The plan assumes stylized.
- [ ] Should players edit monsters in-game, Spore-style, or only you and LLMs?
- [ ] Target hardware: desktop only, or phones too? This sets mesh and shader budgets.
- [ ] Keep "Bestiary" as the name?

## Sources

- [three.js manual: WebGPURenderer](https://threejs.org/manual/en/webgpurenderer)
- [WebGPU + Three.js Migration Guide (2026), Utsubo](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- [three.js docs: GLTFExporter](https://threejs.org/docs/pages/GLTFExporter.html)
- [Zod docs: JSON Schema](https://zod.dev/json-schema)
- [Hecker et al., Real-time Motion Retargeting to Highly Varied User-Created Morphologies, SIGGRAPH 2008](https://chrishecker.com/Real-time_Motion_Retargeting_to_Highly_Varied_User-Created_Morphologies)
- [MCP TypeScript SDK, @modelcontextprotocol/server 2.0.0 release notes](https://newreleases.io/project/github/modelcontextprotocol/typescript-sdk/release/@modelcontextprotocol%2Fserver@2.0.0)
