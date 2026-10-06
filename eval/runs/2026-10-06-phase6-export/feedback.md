# Phase 6 export eval: feedback

Evaluator: an LLM assistant acting as a game developer's helper, with only `docs/runtime.md`,
`docs/blueprint.md`, `docs/catalog.md`, `examples/`, `README.md` and the CLI. I did not read source
code or any other `eval/` folder. All commands were run from the checkout root as
`node packages/cli/src/bin.ts <command>` (shortened to `sf` below). Outputs are in this folder;
scratch files and my little Python inspectors (`inspect.py`, `extras.py`, `anims.py`, `bbox.py`,
`jaw.py`, `lastmove.py`) are in `work/`. Each .glb was checked by reading its glTF JSON chunk
and, for animation times, the binary accessors.

## Deliverables

| File | What it is |
| --- | --- |
| `x01.glb` | Ember Beetle, low quality, clips `tripod` and `bite` only |
| `x02.glb` | "Vesptin", generated insect (seed 5), all clips, `rpg` stats in the file |
| `x03.glb` | "Nyxvor", generated horned biped demon, 1.1 m body, clips `idle`, `walk`, `bite`, `roar`, `rpg` stats |
| `x04.glb`, `x04.json` | Ridgeback Stalker export and the three facts read from it |

## Task 1: x01-clip-subset

Commands:

```
sf export examples/ember-beetle.json --out eval/runs/2026-10-06-phase6-export/x01.glb --quality low --clips tripod,bite
```

What worked: first try. The CLI JSON lists `clips: [tripod 0.15 s loop, bite 0.533 s]`, 8,630
triangles. In the file: exactly two glTF animations (`tripod`, `bite`), extras `quality: "low"`,
extras `clips` has the same two. Medium for the same creature is 28,022 triangles and high 47,998,
so `low` did what it says.

What confused me:

- Nothing blocking. The clip id for "tripod cycle" is the gait id (`tripod`); runtime.md says gaits
  are named `walk`, `trot`, `tripod`, `slither`, so that was guessable. The `--clips` error message
  is good: `export failed: no clip "fly" for this creature; it has idle, walk, tripod, bite`.
- The beetle's blueprint says `"actions": ["bite"]`, but a default export still has `idle` and
  `walk` as well as `tripod` and `bite`. Fine, but unexplained.
- The tripod cycle is only 0.15 s long (baked at 1.24 m/s, 0.186 m per cycle). It is correct
  (loop, footsteps at 0.075 and 0.15), but a game developer would be surprised by a 6.7 Hz step.

Confidence: high.

## Task 2: x02-insect-stats

Commands:

```
sf generate --theme insect --seed 5 --out .../work/insect.json
sf validate .../work/insect.json
sf export .../work/insect.json --out .../x02.glb --stats rpg
sf analyze .../work/insect.json --stats rpg      # cross-check
```

What worked: first try. Generated blueprint validates with no warnings. The glb extras hold
`stats: {"module":"rpg","values":{"health":45,"speed":1.9,"attack":9,"defence":9,"perception":18,"threat":34}}`,
identical to `analyze --stats rpg`. Clips: idle, walk, tripod, bite, look, roar (the generator
leaves `motion.actions` out, so every action the body allows, including `roar` on an insect).

What confused me:

- The `export` command's own stdout JSON does not mention stats at all, so you cannot tell from
  the output that the stats went in. I had to open the .glb. A `"stats": "rpg"` or the values in
  the output would confirm it.
- `export` reports 26,010 triangles (medium) but `analyze` reports `triangles: 8150` for the same
  creature. `analyze` presumably uses a lower quality; nothing says so.
- `--stats` with no value crashes with a raw Node stack trace
  (`ERR_PARSE_ARGS_INVALID_OPTION_VALUE: Option '--stats <value>' argument missing`), against the
  docs' "Every command prints JSON". An unknown id is handled nicely:
  `{"error":"no stats module \"nope\"","fix":"use one of rpg"}`.

Confidence: high.

## Task 3: x03-small-demon

Commands:

```
sf generate --theme demon --seed 1..4 --max-height 1.2 --actions bite,roar --out work/demon-N.json   # trial
sf analyze work/demon-N.json                                                                         # check height
sf generate --theme demon --seed 5..10 --body-plan biped --max-height 1.1 --actions bite,roar --parts horn.curved --out work/bdemon-N.json
sf export work/demon.json --out .../x03.glb --clips idle,walk,bite,roar --stats rpg
sf render work/demon.json --labels                                                                   # look at it
```

What worked: x03 is seed 8 (copied to `work/demon.json`): 1.1 m body height (`bodyHeight`), 1.117 m
total with horns. I verified in the .glb itself: skin POSITION max Y is 1.1003 and the parts mesh
(horns) max Y is 1.1171, both under 1.2 m. Four clips exactly: idle (4 s loop), walk (0.533 s
loop, 1.13 m/s, footsteps at 0.267 and 0.533), bite (0.8 s, contact at 0.25), roar (1.7 s, peak at
0.65). `rpg` stats are in the file. 22,252 triangles at the default (medium) quality, 65 bones.

What confused me:

- "Body at most 1.2 m tall" is ambiguous between `bodyHeight` and `height` (with horns and
  spikes). blueprint.md does explain the difference ("`--max-height` ... body height in metres,
  not counting horns or spikes, the same as `analyze`'s `bodyHeight`; its `height` counts
  them"), and it matters: with `--max-height 1.2` seeds 2 and 3 are rescaled to a body of exactly
  1.2 m and seed 2 is 1.264 m with its horns. I used `--max-height 1.1` so that both readings
  hold. The `generate` output also has `measurements.height`, which is the *body* height (1.2),
  while `analyze`'s `height` is the one with horns (1.264). Same word, different meaning.
- `generate` printed `measurements.length: 0.369` for a 1.2 m biped, which reads like a bug
  (probably the horizontal extent), and nothing explains it.
- "Game-ready" is not defined anywhere. There is no triangle or bone budget in the docs I was
  allowed to read, so I chose the default quality plus stats. Low is 10.8k, medium 22.3k, high
  34.3k triangles for this demon.
- The look: demon-theme bipeds come out as tall, tubby pillars with a small head (see
  `work/demon.png`, `work/bdemon-5.png`, `work/bdemon-9.png`); horns and fangs sell "demon", the
  silhouette does not. The `analyze` description calls an upright biped "a broad, flat body".
  The quadruped hellhound (seed 4, 0.99 m, coiled horns) is probably the more convincing demon.
- `render --size 800` with two views gave a 1600 px wide image, while blueprint.md says `--size
  px` "sets the image width" (it is per panel).

Confidence: high that it meets every stated constraint; medium that "game-ready" means what the
requester wants.

## Task 4: x04-read-export

Commands:

```
sf export examples/ridgeback-stalker.json --out .../x04.glb
python3 -I work/extras.py x04.glb sockets        # extras.spawnforge.sockets
python3 -I work/anims.py x04.glb                 # glTF animation durations + extras clips/events
python3 -I work/jaw.py x04.glb jaw bite          # jaw bone's rotation track in the bite clip
```

Result (`x04.json`): `{ "node": "socket_mouth", "biteSeconds": 0.8333, "contactSeconds": 0.275 }`

- **Node.** runtime.md: "Sockets as empty nodes under their bones, named `socket_` plus the
  socket name". The extras list `{"name":"mouth","node":"socket_mouth","bone":"jaw"}` and the
  glTF has node 13 `socket_mouth` as the child of `.../head/jaw`. It rides the jaw, so breath
  follows the opening mouth. `socket_head` is the alternative if you want it steady.
- **Bite length.** The glTF `bite` animation runs 0 to 0.8333 s, and extras `clips[bite].duration`
  agrees (0.8333333333333334).
- **Contact.** extras `clips[bite].events` has `bite-contact` at 0.275 s. runtime.md and
  blueprint.md both say `bite-contact` is "when the jaw snaps shut". I confirmed that against the
  jaw bone's own track: open from about 0.07 s, fully open (37 degrees) at 0.20 to 0.23 s, and
  back to about 6 degrees at 0.267 s and about 1 degree at 0.30 s. So 0.275 is the real snap.

What confused me: "how long the bite animation lasts" has two defensible answers in the file.
The events list `action-end` at 0.6 s, while the clip is 0.8333 s long. I checked the tracks: the
last keyframe that moves (the tail) is at 0.633 s and the final 0.2 s is a hold. I answered with
the clip length (0.8333) because the question says "animation", but a game that treats the bite
as an action would use 0.6. Neither runtime.md nor blueprint.md says what `action-end` means
relative to the clip's duration, or that clips are padded with a hold. Also, `duration` depends
on `--fps`: ember-beetle's bite is 0.5333 s at the default and 0.55 s with `--fps 120`, so the
number is partly an artefact of the frame grid. The default fps is not documented either (I
inferred 30 from 17 keys over 0.533 s; gait cycles have 13 keys, so they are not on the fps grid).

Other things I noticed on this file:

- The ridgeback's `idle` clip is a stub: 1 s long, only `root` rotation/translation, both
  constant. Its blueprint lists `actions: ["bite","roar"]` without `idle`. The beetle (`actions:
  ["bite"]`) behaves the same, whereas the generated demon and insect (no `actions` field) have
  real 4 s idles with glances, weight shifts and eye-scale blinks. `export` gives no hint, and
  `--clips idle` succeeds anyway. runtime.md describes `idle` as having "glances, weight shifts
  and blinks".
- Export is deterministic: exporting the ridgeback twice gave byte-identical files.
- The scene in every glb is called `AuxScene` and the creature root node carries the creature's
  name with `_` for spaces (`Ridgeback_Stalker`), with children `root`, `skin`, `parts`, `eyes`.
  Neither is documented; harmless.
- "Three skinned meshes sharing one skeleton": the glTF has three `skins` entries with identical
  joint lists, all with the same `skeleton` root, and three mesh nodes (`skin`, `parts`, `eyes`).
  Fine for Three.js; some importers may show three skeletons.
- The stdout of `export` accepts `--quality ultra` without complaint. See problem 1 below.

Confidence: node high (medium on `socket_mouth` versus `socket_head` as the "right" answer);
contactSeconds high; biteSeconds medium (0.8333 clip versus 0.6 action end).

## Could runtime.md get these creatures live into a Three.js game?

Partly. For the exported route, the file is rich and what is in it matches the docs (clips,
sockets, extras, stats, names with `_`), but the page only describes the file. It has no loading
code. For the live route (`createBestiary`), the example reads well but is not enough to build a
working game from, with only the docs. What is missing:

1. **Getting the packages.** The docs I was allowed say nothing about installing `@spawnforge/three`
   and `@spawnforge/modules` into a separate game: published or not, which bundler, which Three.js
   version (the glb header says `THREE.GLTFExporter r186`, the only hint I found).
2. **Renderer requirement.** Does `stalker.object` need `WebGPURenderer` (TSL materials) or does
   `WebGLRenderer` work? Not stated. This decides whether an existing game can use it at all.
3. **Where `blueprint` comes from.** Is it the raw file (with `extends`), the expanded one, a
   species with ranges? Does `spawn` validate, and how does it fail (rejected promise? the
   `validate` error list)? The snippet uses an undefined `blueprint`.
4. **No runtime stats API.** The snippet calls `player.hurt(stats.attack)` but `stats` is never
   defined, and `Stats` below only describes `analyze --stats` and `export --stats`. A live game
   has no documented way to get the rpg numbers (a `creature.stats`? read them from a glb?).
5. **Under-specified types.** `moveTo(target)`: a Vector3 or `{x, z}`? Units of `speed`? Is there
   an arrival event? `heading` in radians or degrees? What does `act()` return, and what happens
   if the action is not available or one is already playing? What does `lookAt` accept (docs show
   `player.position`)?
6. **Event payloads.** Only `footstep` (`leg`, `position`) is described. Nothing for
   `bite-contact`, `roar-peak`, `action-start`/`end`, `gait`: do they carry `creature`, `target`,
   `time`? Does `bite-contact` check reach, or must the game test the target itself (with
   `hitCapsules()`)?
7. **No loading recipe for the glb in Three.js.** Nothing on `GLTFLoader`, `AnimationMixer`,
   where `extras.spawnforge` ends up (I expect `userData` on the creature root node, unverified),
   how to find sockets by name, `LoopOnce` and `clampWhenFinished` for actions, or how to fire
   `bite-contact` from the extras (a timer or an `AnimationMixer` listener at `events[].time`).
   The speed rule says "play it at `speed / clipSpeed` times its rate", but the extras field is
   called `speed` and there is no `clipSpeed`.
8. **Other engines.** Colour is only in `COLOR_0` (materials have no base colour texture), which
   Godot or Unity materials ignore by default; `roughness` is one number per mesh. Worth a note
   for non-Three users.
9. **Worker setup** is a comment in a snippet: bundler-specific (Vite `new URL(...)`), nothing
   for webpack, Node or SSR, and not clear what the worker needs to import.

## The three most important problems

1. **Unknown option values are accepted silently, and some produce a wrong file.**
   `export --quality ultra` returns `ok: true`, writes `"quality":"ultra"` into the extras, and
   produces a 1,686-triangle mesh, coarser than `low` (8,630 triangles for the beetle, so 5 times
   fewer). A developer who asks for "best" gets the worst. `render --quality ultra` does the same.
   `--fps 0` and `--fps 120` are also accepted unchecked (and `--fps` changes clip durations), and
   `--stats` without a value crashes with a stack trace instead of JSON. These should be errors
   with a "use one of low, medium, high" fix, like the good `--clips` and `--stats nope` errors.
2. **The exported timing data is hard to use and under-documented.** Bite `duration` (0.8333 s) is
   0.23 s longer than its own `action-end` event (0.6 s) because the clip ends in a hold, and the
   docs explain neither. Clip durations drift with `--fps` (0.5333 versus 0.55 s), the default fps
   is undocumented, and explicit `motion.actions` lists without `idle` export a static 1 s idle
   stub with no warning. A game needs to know which number to trust for "how long is the action".
3. **`docs/runtime.md` is a good API sketch but not enough to ship with.** It is missing the
   install and Three.js version story, the WebGL versus WebGPU requirement, runtime access to
   stats, `moveTo`, `act` and event payload types, and any `GLTFLoader`/`AnimationMixer` recipe for
   the .glb path (including where the extras land and how to play gait clips at the right
   `speed / clipSpeed`).
