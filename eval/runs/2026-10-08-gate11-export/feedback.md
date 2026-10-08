# Gate 11 export eval: agent feedback

Worked only from README.md, docs/runtime.md, docs/engines.md, docs/blueprint.md, docs/catalog.md,
examples/ and engines/python/spawnforge_extras.py, plus the CLI (`pnpm -s spawnforge ...`). Every
number in an answer file was read from the exported .glb with a small Python script (JSON chunk,
accessors, image headers) kept in the scratch folder. All 11 tasks were completed. Exports took 2 to
21 s each (the 2048 export 21 s, the vertex-colour export under 2 s).

## Deliverables

| File | What it is |
| --- | --- |
| `x01.glb` | examples/ember-beetle.json, `--clips tripod,bite --quality low`: two animations only |
| `x02-blueprint.json`, `x02.glb` | Insect from `generate --theme insect --seed 5` ("Vesptin"), exported with `--stats rpg` (stats are in `extras.stats`) |
| `x03-blueprint.json`, `x03.glb` | Demon from `generate --theme demon --seed 3 --max-height 1.1` ("Zulvor", 1.1 m), clips idle, walk, bite, roar |
| `x04.glb`, `x04.json` | ridgeback-stalker export; `{ node: socket_mouth, biteSeconds: 0.8333, contactSeconds: 0.275 }` |
| `x05.glb` | grey-wolf with `--textures 2048` (skin maps 2048 px) |
| `x06.glb` | cave-bat with `--textures none`: `COLOR_0` vertex colours, no `images`, no `textures` |
| `x07-blueprint.json`, `x07.glb`, `x07.json` | "Lantern Hound": one `bioluminescence` layer (pulse 0.8, brightness 2.5) on a dark skin; emissive map plus `KHR_materials_emissive_strength`; `{ pulseHz: 0.8 }` |
| `x08.glb`, `x08.json` | sand-cheetah; four live-only differences and `furLengthMetres` 0.0096 (from `extras.fur.length`) |
| `x09.glb`, `x09.json` | tusk-boar; skin triangles [27186, 13592, 6796, 2718]; coarsest skin level under 1 px from 4.47 m |
| `x10-blueprint.json`, `x10.glb`, `x10.json` | sand-cheetah copy with `pounce` added to `motion.actions`; clip `pounce`, root ends 2.6856 m forward |
| `x11.glb`, `x11.json` | grey-wolf export; loop clips idle, walk, trot, gallop; node `socket_mouth` |
| `feedback.md` | this file |

## Task by task

### 1. x01-clip-subset

Commands:

```sh
pnpm -s spawnforge export examples/ember-beetle.json --out $RUN/x01.glb --clips tripod,bite --quality low
```

- First try. The file has exactly `tripod` and `bite` animations, `extras.quality` is `low`, skin maps 512.
- The `--clips` list is exactly what is exported: no `idle` and no `death` unless named. Good, but nothing
  in the docs says that `--clips` replaces the default set rather than adding to it (I learned it
  from the output).
- The gait id (`tripod`) had to be guessed from the catalogue's gait list and the hexapod preset; the
  error for a wrong id is helpful (see below).

### 2. x02-insect-stats

```sh
pnpm -s spawnforge generate --theme insect --seed 5 --out $RUN/x02-blueprint.json
pnpm -s spawnforge validate $RUN/x02-blueprint.json --quiet
pnpm -s spawnforge export $RUN/x02-blueprint.json --out $RUN/x02.glb --stats rpg
```

- First try. `extras.stats` = `{ module: rpg, values: { health 45, speed 1.8, swim 0, fly 0, attack 7, attacks 1, defence 9, perception 16, threat 30 } }`,
  and the export's JSON output prints the same under `stats`.
- Small doc gap: runtime.md says the stats module outputs are `{ health, speed, attack, attacks, defence, perception, threat }` but the file also has `swim` and `fly`.
- The insect export's default clips include `jump`, `pounce`, `look` and `roar` (a generated blueprint leaves `motion.actions` out, so every action the body allows is baked). That makes a 4.5 MB file; a note in the generate output about this would help someone who wants a lean file.

### 3. x03-small-demon

```sh
pnpm -s spawnforge generate --theme demon --seed 3 --max-height 1.2 --actions bite,roar --out $RUN/x03-blueprint.json
pnpm -s spawnforge export $RUN/x03-blueprint.json --out $RUN/x03.glb --clips idle,walk,bite,roar
# bounding box read from the file: max Y 1.20009 m  -> too tall by 0.09 mm
pnpm -s spawnforge generate --theme demon --seed 3 --max-height 1.1 --out $RUN/x03-blueprint.json
pnpm -s spawnforge export $RUN/x03-blueprint.json --out $RUN/x03.glb --clips idle,walk,bite,roar
```

- Worked, but with a catch. `blueprint.md` says the `--max-height` limit "is met exactly, to the millimetre", and `generate` and `analyze` both printed `bodyHeight: 1.2`. The exported mesh's POSITION max Y (bind pose, from the accessor `max`) was 1.2000927 m, so a strict "at most 1.2 m" check on the file fails. I regenerated with `--max-height 1.1` (file max Y 1.0999 m) to leave a margin. Suggest: the docs say the bound applies to `analyze`'s `bodyHeight` and that the file's bounds can differ by a fraction of a millimetre (or fix the rescale to under-shoot), and the export output could print the mesh's bounding box so a game developer can check size without a script.
- "Game-ready" was not defined. I took it as valid, no `analyze` warnings, the four named clips only, sockets present. Unsure whether stats, `--lods none` or a `quality` were expected; the docs have no checklist for "game-ready".
- `--actions bite,roar` has no visible effect (the doc says the file leaves `motion.actions` out), so the blueprint's list still allows jump, pounce and lash. The `idle` clip exists without `idle` in `motion.actions` because the list is empty. Fine, but it is only discoverable by exporting.
- The first attempt's output was fine; the 1.1 attempt also passed `analyze --summary` with no warnings.

### 4. x04-read-export

```sh
pnpm -s spawnforge export examples/ridgeback-stalker.json --out $RUN/x04.glb
python3 -I engines/python/spawnforge_extras.py ... (or my own reader)
```

Read: node `socket_mouth` (child of node `jaw`); `bite` clip duration 0.8333 s (extras `clips[].duration` and the animation samplers' last input time agree: 0.8333333); `bite-contact` event at 0.275 s; `action-end` at 0.6 s.

- The "how long does the bite last" question has two answers: the clip is 0.8333 s but the bite action ends at 0.6 s, because the clip adds 0.25 s of settling. The docs do say this (runtime.md: "Action clips run the action and then 0.25 s of settling back"), but the extras give no field that says "action length", so I had to subtract from the `action-end` event. I answered with the clip duration (the animation), and this is the one thing in the task I am not sure about.
- The mouth socket sits under the `jaw` bone, so a fire-breath effect parented to it moves as the jaw opens. The docs say "parent a fire-breath effect here", which is what I used. A `socket_head` is the alternative if a steady origin is wanted; the docs do not discuss that choice.
- The bite-contact time is only in the extras, not in the animation (glTF animations have no events). Docs state this, fine.
- Extras were easy to read: the root node (node 0) carries them; the python script finds the node by looking for `spawnforge`.

### 5. x05-sharp-maps

```sh
pnpm -s spawnforge export examples/grey-wolf.json --out $RUN/x05.glb --textures 2048
```

- First try, 21 s, 6.95 MB. Skin albedo, normal and ORM are 2048 x 2048; parts 1024; eyes 256.
- Surprise: the output note says `colour and glow maps are JPEG, to keep the file under 8 MB`. The skin's colour map is a JPEG while normal and ORM are PNG. Nothing in the docs (runtime.md, engines.md, `export --help`) mentions JPEG, a size cap of 8 MB, or any way to keep lossless colour. For "the sharpest maps" this matters (JPEG artefacts on a close-up) and there is no option to opt out. Please document it, and say which maps stay PNG.
- `--textures 2048` sets the skin only; parts are half and eyes fixed at 256 regardless. I checked `--quality high --textures 2048` as well: same map sizes (2048 / 1024 / 256), 7.98 MB, 44,960 triangles, same JPEG note. The docs say "2048 at high quality" for the skin, which suggests `--textures` and `--quality` are alternative ways to the same size; the help should say they combine and what the parts get. I submitted the `--textures 2048` only version (medium mesh quality) because the task asked for maps only.

### 6. x06-vertex-colours

```sh
pnpm -s spawnforge export examples/cave-bat.json --out $RUN/x06.glb --textures none
```

- First try. No `images`, no `textures` keys in the glTF; every mesh primitive has `COLOR_0`; materials have only factors. Output notes mention veins aliasing on membranes, good.
- Not asked, but a mobile game would also want to know: the file still carries `skin_LOD1..3` and `parts_LOD1..3` (see `--lods none`) and 337 bones for the bat. The docs do not give a "mobile recipe" combining `--textures none --lods none --quality low`; one line in engines.md would help.

### 7. x07-glow

Blueprint (`x07-blueprint.json`): quadruped, dark skin (`#14161f`), one `bioluminescence` layer `{ color accent (#40ffd8), shape spots, size 0.035, density 0.7, brightness 2.5, pulse 0.8 }`, no fur.

```sh
pnpm -s spawnforge validate $RUN/x07-blueprint.json --quiet
pnpm -s spawnforge export $RUN/x07-blueprint.json --out $RUN/x07.glb
pnpm -s spawnforge render $RUN/x07-blueprint.json --views 3/4,side --out $SCRATCH/x07.png   # looked fine
```

- Worked. In the file: skin material has `emissiveTexture` (a 1024 RGBA image, max 255, mean 77 of 255, so it is lit), `emissiveFactor [1,1,1]` and `KHR_materials_emissive_strength` 3.37 (brightness 2.5 turned into a map plus a strength; I did not work out the arithmetic), and `extras.glow = [{ layer: "bioluminescence", pulse: 0.8 }]`. `pulseHz` = 0.8.
- Doc problems:
  - `docs/blueprint.md` (Skin section) still says "`.glb` exports leave [glow] out until texture maps (milestone 11.1)". That is stale and contradicts runtime.md and the real output. An agent that read only blueprint.md would believe glow cannot reach the file. Same section says fur is left out "for now".
  - runtime.md describes `extras.glow` as "each layer's `pulse` (a second)". It reads like a typo. The unit (pulses per second, from the catalogue's `pulse` row) is only certain if you cross-reference catalog.md; one clear sentence ("`pulse` is in hertz, 0 is steady") in runtime.md would remove the doubt.
  - With several glow layers the extras list one entry each, but no layer id or region, so a game cannot tell which emissive spots belong to which pulse. Not an issue here (one layer).
- The emissive map is baked at time 0 of the pulse. If the pulse were at a trough at t = 0 the map could be black; here it is bright (the map has a max of 255) but the docs do not say what phase t = 0 is.
- To make "the glow show in an engine" the export must not use `--textures none`; the docs say this only indirectly (`none` is vertex colour, albedo only).

### 8. x08-live-only

```sh
pnpm -s spawnforge export examples/sand-cheetah.json --out $RUN/x08.glb
```

- `extras.fur` = `{ length: 0.0096, density: 0.85, regions: ["all"] }`. The blueprint says `fur.length` 0.012 (torso lengths) and `scale` 0.8, so 0.0096 m is 0.012 x 0.8. runtime.md says the extras give metres, and they do. The blueprint doc says "length in torso lengths" so it is easy to answer 0.012 by mistake: worth a sentence in the export docs ("blueprint fur length is in torso lengths; the file's is in metres").
- The export's `notes` list only two items for this creature (fur left out, light wrapping). The "What the file leaves out" table in runtime.md has more rows (breathing, detail fade, glow pulse, membrane light, occlusion). I decided which apply to the cheetah by reading the table against its blueprint, so I wrote four differences: fur, light wrapping, breathing (it has an idle), and distance detail fade. Glow pulse and membrane light are not applicable (no glow layer, no wings); occlusion is "the file's own", which is the reverse direction (the file adds something) so I left it out. A reader cannot tell from the notes alone that breathing is also missing; notes should list every table row that applies, or the docs should say the notes are partial.
- Also left unsaid anywhere: the live creature adapts its feet to terrain (foot IK) and springs its tail; the baked gait clips do not. I did not list it as an "effect" since the table does not, but an artist would care. Maybe add a row.

### 9. x09-levels-of-detail

```sh
pnpm -s spawnforge export examples/tusk-boar.json --out $RUN/x09.glb
```

Read from the file: node `skin` has 27,186 triangles (index accessor count / 3), `skin_LOD1` 13,592, `skin_LOD2` 6,796, `skin_LOD3` 2,718. Extras `lods.skin` errors: 0.000657, 0.0016, 0.00478 m. Distance for under 1 px at 1080 px and 60 degrees vertical FOV: `d = error x 1080 / (2 tan 30 deg)` = 0.00478 x 935.3 = 4.47 m.

- The extras list only the three coarser levels; the full-detail triangle count is not in `lods` (the docs say `lods` gives "each level's triangles, error in metres and node name"). The export's JSON output gives only the total (30,958 = skin 27,186 + parts 3,052 + eyes 720). I got the full count from the index accessor. Please add level 0 to `lods` (triangles and error 0).
- No doc gives the distance formula. I derived it (pixel size at distance d = 2 d tan(fov/2) / height). A two-line formula in runtime.md next to the pixel-error sentence would save every game developer the derivation.
- `MSFT_screencoverage` in the node's extras is `[1, 0.9687, 0.3235, 0]` for the skin: four numbers for three LOD nodes. I believe that is the form the extension's spec uses (the first number is where LOD0 stops), but it is not explained, and the docs' phrase "the share of the screen's height below which each level's error stays under a pixel" does not obviously map onto four values. I cross-checked it: 0.3235 equals H / (1080 x 0.00478) for H = 1.67 m, so it agrees with 4.47 m, but H is not given anywhere in the file's extras (the object height it assumes). I relied on `error`, not on screencoverage.
- "The coarsest level" is ambiguous: the skin's LOD3 error is 0.00478 m (4.47 m), but `parts_LOD3` has error 0.0471 m (44.05 m), ten times coarser. Skin and parts are separate nodes with separate coverage arrays, so a game switching both together should use 44 m. I answered with the skin because the task names the skin. Worth noting in the docs that the levels of one creature are independent per mesh. Also odd: `parts_LOD3` has 758 triangles against 762 for `parts_LOD2` but 2x the error: perhaps the parts hit a simplification floor at 25% already.

### 10. x10-root-motion

```sh
cp examples/sand-cheetah.json $RUN/x10-blueprint.json
pnpm -s spawnforge patch $RUN/x10-blueprint.json '[{"op":"set","path":"motion.actions","value":["bite","look","idle","pounce"]}]'
pnpm -s spawnforge validate $RUN/x10-blueprint.json --quiet
pnpm -s spawnforge analyze $RUN/x10-blueprint.json --summary   # "it can bite, look and pounce", no warnings
pnpm -s spawnforge export $RUN/x10-blueprint.json --out $RUN/x10.glb
```

- First try. The example lists `motion.actions` explicitly, so `pounce` had to be added to the list; a blueprint without the field would already get it (only worth saying that `patch` writes in place, so I copied first, as instructed).
- Read: the animation `pounce` has `extras rootMotion: true` in the root extras' `clips`; the `root` node's `translation` track ends at (0, 0, 2.6856) (peak height 0.313 m); the other clips' root tracks stay at the origin. `clips[].distance` also says 2.6856 for the pounce. Answer: `{ clip: "pounce", forwardMetres: 2.6856 }`.
- The docs say `distance` is "one cycle covers" for gaits. For a leaping clip it is also the root's travel (they match to 6 digits) but the docs do not say so. One sentence would make the extras alone enough for "how far does it leap".
- The distance depends on an unaimed `power` (default); the docs explain `power` in blueprint.md, so "big cat that pounces" could have meant a longer pounce; I did not change it.
- The root bone's name (`root`) is the first joint of the skin, found by looking at `skins[0].joints[0]`. The Godot section says the same ("the first bone"); fine.

### 11. x11-engine-import

```sh
pnpm -s spawnforge export examples/grey-wolf.json --out $RUN/x11.glb
python3 -I engines/python/spawnforge_extras.py $RUN/x11.glb
```

- First try with the python reader (it prints the whole extras). `loop: true` for idle, walk, trot, gallop; false for bite, roar, look, death. `socket_mouth` is the mouth node.
- Docs are good here. Gaps for Godot users: in Godot the imported node for `socket_mouth` is a `BoneAttachment3D` named `socket_mouth`; I believe the name is kept, but the docs do not say whether Godot keeps the underscore names or renames them. Also not mentioned: Godot's own convention that an animation name ending in `-loop` or `_loop` imports looped (a game could rename the clips instead of setting each one). `idle` also loops although it is an "action" in the blueprint; people may expect it not to. I could not run Godot, so none of this was tested.
- The Godot script `engines/godot/spawnforge_extras.gd` was not read (it is allowed, but the python script did the job).

## Things that were hard or missing, in order of impact

1. Stale line in `docs/blueprint.md` ("`.glb` exports leave [glow] out until ... 11.1") contradicts runtime.md and the exporter (task 7).
2. The JPEG fallback ("colour and glow maps are JPEG, to keep the file under 8 MB") is only in the export output and appears nowhere in the docs or `--help`; no way to ask for lossless colour at 2048 (task 5).
3. `extras.lods` lacks the full mesh's triangle count and there is no formula or worked example for the "from what distance is this level fine" question; `MSFT_screencoverage`'s four values are unexplained; skin and parts levels are independent but the docs speak of "a level" (task 9).
4. The "to the millimetre" claim for `--max-height` versus the file's bounding box (task 3).
5. No machine-readable "what the file leaves out" list for a given creature: the notes are partial (task 8).
6. Fur length units differ between blueprint (torso lengths) and file (metres) (task 8).
7. Whether `distance` for a leap equals the root's forward travel (task 10), and the unit/meaning of `extras.glow[].pulse` (task 7).
8. The action clip length versus the action's own length (0.8333 vs 0.6 s for the bite, task 4) is documented but there is no field for it in the extras.

## Error messages

All the failures I provoked were helpful; none was misleading:

| Command | Message |
| --- | --- |
| `export grey-wolf --clips tripod` | `export failed: no clip "tripod" for this creature; it has idle, walk, trot, gallop, bite, roar, look, death` (exit 2). Good. It does not say how to get a missing clip: for `--clips pounce` the fix is to add `pounce` to `motion.actions`; a hint would help. |
| `--textures 4096` | `--textures must be 512, 1024, 2048 or none, not "4096"` |
| `--quality ultra` | `unknown quality "ultra"`, fix: `use low, medium or high` |
| `--lods 0` | `--lods takes none (to leave the levels of detail out), not "0"` |

The `export` JSON output omits `textures` when `--textures none` and omits `lods` entries' full level; and after one export the environment's agent proxy printed a warning that Chromium tried to reach google domains (`android.clients.google.com`, `www.google.com`) and was refused. It did not affect the export, but a headless render that tries to phone home is surprising; a Chromium flag to disable background networking would silence it.

Environment note: `git status` in the repository showed `eval/export.json` and `eval/export.ts` as modified and another untracked run folder; I did not touch or read them.
