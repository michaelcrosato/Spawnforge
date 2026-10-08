# Gate 12 export tasks: feedback

All eleven tasks were completed with the CLI, the docs listed in the brief and my own GLB reader
(a 40-line Python script in the scratch folder: JSON chunk from byte 20, accessors from the BIN
chunk). Every answer that says "read from the file" was read from the exported file: the extras on
the root node, the animation samplers, the `MSFT_lod` nodes and the image chunks. No file in
`examples/` was edited (copies went to RUN).

## Deliverables

| File | What it is |
| --- | --- |
| `x01.glb` | `ember-beetle`, `--clips tripod,bite --quality low`: exactly two animations, `tripod` (loop, 0.15 s) and `bite` (0.533 s); extras say `quality: low`, 512 px maps |
| `x02-blueprint.json`, `x02.glb` | Insect from `generate --theme insect --seed 5` ("Vesptin"); export with `--stats rpg`, and `extras.stats` = `{ module: "rpg", values: { health 45, speed 1.8, attack 7, defence 9, perception 16, threat 30, ... } }` |
| `x03-blueprint.json`, `x03.glb` | Demon "Gorgoth" (theme demon, seed 7, `--max-height 1.15 --actions bite,roar`, horns and pointed ears); clips exactly `idle, walk, bite, roar`; mesh bounds read from the file: 1.179 m tall, `bodyHeight` 1.15 |
| `x04.glb`, `x04.json` | `ridgeback-stalker`; `{ "node": "socket_mouth", "biteSeconds": 0.8333333333333334, "contactSeconds": 0.275 }` |
| `x05.glb` | `grey-wolf` with `--textures 2048` (skin maps 2048 px; parts 1024; eyes 256) |
| `x06.glb` | `cave-bat` with `--textures none`: no `images`, `textures` or `samplers` in the glTF JSON; every mesh has `COLOR_0` |
| `x07-blueprint.json`, `x07.glb`, `x07.json` | "Lantern Hound": dark `hide` body with one `bioluminescence` layer (`pulse` 0.8, `brightness` 2.5); the skin material has an emissive texture and `KHR_materials_emissive_strength` 3.36; `{ "pulseHz": 0.8 }` read from `extras.glow` |
| `x08.glb`, `x08.json` | `sand-cheetah`; four differences (fur, light wrapping, breathing, detail fade) and `furLengthMetres` 0.0096 (`extras.fur.length`; the blueprint's 0.012 torso lengths x scale 0.8) |
| `x09.glb`, `x09.json` | `tusk-boar`; skin triangles `[27186, 13592, 6796, 2718]`, `lowestFromMetres` 4.47 |
| `x10-blueprint.json`, `x10.glb`, `x10.json` | Cheetah copy with `pounce` added to `motion.actions`; `{ "clip": "pounce", "forwardMetres": 2.6855928897857666 }` |
| `x11.glb`, `x11.json` | `grey-wolf` for Godot; `{ "loop": ["idle","walk","trot","gallop"], "breathNode": "socket_mouth" }` |
| `feedback.md` | This file |

## Task by task

### x01 clip subset

Commands:

```sh
pnpm -s spawnforge export examples/ember-beetle.json --out $RUN/x01.glb --clips tripod,bite --quality low
```

- First try. `--clips` is in `export --help` and in runtime.md; the file has exactly `animations: [tripod, bite]`.
- Good: a clip the creature does not have gives a helpful error ("no clip "gallop" for this creature; it has idle, walk, tripod, bite, death; add "gallop" to motion.gaits to get it").
- Surprise: the clip's name for a hexapod's cycle is `tripod`, which I only knew from the blueprint doc and the catalogue; `export` does not list available clips up front (the error above only appears after a wrong guess). A `--list-clips` or a mention in `export --help` of "see `analyze` for gaits" would help.
- Surprise: runtime.md says "Frames are at `--fps` (default 30)", but the beetle's `tripod` cycle is 0.15 s and has 13 keys at 80 fps (dt 0.0125). In the wolf, `trot` is 40 fps and `gallop` 37.9 fps. Gait cycles seem to be sampled in 12 equal steps whatever `--fps` is. Not wrong, but undocumented, and `--fps` does not mean what it says for gaits.
- A 0.15 s loop (6.7 cycles a second) for a 0.77 m beetle is plausible but looks odd; `analyze --summary` raised no `fast_cadence` warning.

### x02 insect with stats

```sh
pnpm -s spawnforge generate --theme insect --seed 5 --out $RUN/x02-blueprint.json
pnpm -s spawnforge validate $RUN/x02-blueprint.json --quiet
pnpm -s spawnforge export $RUN/x02-blueprint.json --out $RUN/x02.glb --stats rpg
```

- First try. `export` echoes `stats: { module, values }`, and the file's `extras.stats` has the same shape (no `rpg` key at the top, values under `values`). runtime.md's `bestiary.stats` example shows a flat object, so the file's `{ module, values }` shape could be stated in the docs.
- The generated insect has `jump` and `pounce` clips with root motion in the default export, which a game developer asking for "an insect" may not expect; there is no hint in the output that clips were chosen by body.

### x03 small demon

```sh
pnpm -s spawnforge generate --theme demon --seed 3 --max-height 1.19 --actions bite,roar --out ...   # tried first
pnpm -s spawnforge render ... --labels --out $S/x03.png                                              # looked at it
pnpm -s spawnforge generate --theme demon --seed 7 --max-height 1.15 --actions bite,roar --out $RUN/x03-blueprint.json
pnpm -s spawnforge export $RUN/x03-blueprint.json --out $RUN/x03.glb --clips idle,walk,bite,roar
```

- Seed 3 produced a red, striped blob with no horns, no ears and nothing demonic. I tried seeds 1 to 8 (printing `parts`) before picking seed 7, which has horns and ears. A theme named `demon` can give a creature with no demonic features; `generate --parts horn.curved` exists and would have forced horns, which I only saw afterwards. Worth saying in the `demon` theme's summary that horns are optional and `--parts horn.curved` guarantees them.
- Height: the brief says "body is at most 1.2 m". The docs are clear that `--max-height` limits `bodyHeight` (without horns) and that the mesh can stand a hair past it. But with horns the mesh was 1.22 m tall at `--max-height 1.19`. A game that measures the glb's bounding box would see 1.22, so I used 1.15 to keep both the body (1.15) and the bounds (1.179 m, read from the POSITION accessors' min/max) under 1.2. A `--max-total-height` or a note in the `generate` output (it prints `bodyHeight` only) would help.
- `analyze --summary` leaves out `measurements.bodyHeight` (it prints `height`), while `generate --max-height` talks about `bodyHeight` and the blueprint docs say "the same as `analyze`'s `bodyHeight`". I had to run `analyze` without `--summary` to see it, and got a KeyError in my script first.
- "Game-ready" is not defined anywhere; I took it as zero errors and zero warnings in `validate` and `analyze`, within the height, with exactly the four clips. The default export would have added `run`, `look`, `jump`, `pounce` and `death`; I used `--clips` to keep it to what was asked.

### x04 read the export

```sh
pnpm -s spawnforge export examples/ridgeback-stalker.json --out $RUN/x04.glb
```

- Node: `socket_mouth` (its parent node is `jaw`), from `extras.sockets` (`{name: "mouth", node: "socket_mouth", bone: "jaw"}`) and the node list. The runtime.md snippet gives it ("parent a fire-breath effect here"), which made this easy. A caveat that is not written anywhere: the mouth socket sits on the jaw bone, so a breath effect will open and close with the jaw; `socket_head` stays still.
- Duration: ambiguity. The bite clip lasts 0.8333 s (extras `duration`, and the sampler's last time agree), but the bite action itself ends at 0.6 s (`action-end`), because the clip adds 0.25 s of settling. The docs do say this, in the Action clips bullet, so I answered with the clip's duration; a developer asking "how long is the bite" could mean either.
- Contact: `bite-contact` at 0.275 s in the clip's `events` (8.25 frames at 30 fps, so between keys). The docs' Three.js snippet shows exactly how to find it.

### x05 sharp maps

```sh
pnpm -s spawnforge export examples/grey-wolf.json --out $RUN/x05.glb --textures 2048
```

Also tried (scratch only) `--quality high --textures 2048` and `--clips idle --lods none --textures 2048`.

- First try. The maps came out at 2048 (skin), 1024 (parts), 256 (eyes). `--quality high` gives the same map sizes (only more triangles, and a file of 7.98 MB), so for "sharpest maps" the extra flag adds nothing. runtime.md says "the two combine" without saying how; in practice the maps are the same. It would help to state: the skin's map is the larger of the two, and parts and eyes do not grow with `--textures`.
- The colour map (and the parts' colour and the eyes) were written as JPEG, with the note "colour and glow maps are JPEG, to keep the file under 8 MB". That happens even when the file is 6 MB, and even with `--clips idle --lods none` (5.99 MB), so the decision looks like it is made from the estimated PNG sizes alone. For a close-up cutscene, a lossy colour map is the opposite of "sharpest", and there is no flag to keep PNG. A `--textures-format png` or a note that 2048 always gives JPEG colour would help. The docs do say "(2048 maps, or a creature with many meshes)" but not that 2048 always triggers it.

### x06 vertex colours

```sh
pnpm -s spawnforge export examples/cave-bat.json --out $RUN/x06.glb --textures none
```

- First try; verified: no `images`/`textures`/`samplers` keys, `COLOR_0` on every primitive. Good notes in the export output (membranes approximated in vertex colours).
- Missing for a mobile game: the output does not mention that with `--textures none` the materials have no flag for vertex colours (glTF reads `COLOR_0` by itself; engines' default materials ignore it, which engines.md does say). The bat export is still 3.8 MB with 337 bones and 10 clips; a mobile developer would want `--lods none` and `--quality low` here, and nothing connects "mobile" to those flags.

### x07 glow

```sh
pnpm -s spawnforge validate $RUN/x07-blueprint.json --quiet
pnpm -s spawnforge render $RUN/x07-blueprint.json --views 3/4,side --out $S/x07.png
pnpm -s spawnforge export $RUN/x07-blueprint.json --out $RUN/x07.glb
```

- First try for the blueprint, since `describe-module bioluminescence` gives every parameter (colour, `shape`, `size`, `density`, `brightness`, `pulse` 0 to 2 Hz). I put a single glow layer on a dark `hide` skin so there is one pulse to report; with two glow layers `extras.glow` would hold two entries and "how many times a second" would be ambiguous.
- The file's `extras.glow` is `[{ "layer": "bioluminescence", "pulse": 0.8 }]`: it gives only the layer and its pulse, not the colour or brightness. Fine for the task. The brightness I set (2.5) comes out as `KHR_materials_emissive_strength` 3.36, which I could not explain from the docs (probably a bake-time peak over the map's maximum); the docs only say "when brighter than 1".
- Gotcha worth documenting: `--textures none` would have lost the glow completely (albedo only), and the task wording "so the glow shows in a game engine" depends on knowing that. runtime.md does say vertex colours are "albedo only", but it is not tied to the glow in any list of options.
- The docs say `pulse` default is 0.3 and the glow layer is "as it is at time 0"; it does not say what phase time 0 is (it is visible in the render, so not dark).

### x08 live-only differences

```sh
pnpm -s spawnforge export examples/sand-cheetah.json --out $RUN/x08.glb
```

- The export's `notes` list four items for this creature (fur left out, light wrapping, breathing, detail fade), and docs/runtime.md has the matching table; I used the four notes as the answer and left out the "glow pulse" and "light through membranes" rows since the cheetah has neither. Easy to answer because the `notes` are written as differences.
- `extras.fur` = `{ length: 0.0096, density: 0.85, regions: ["all"] }`: the length is in metres in the file while the blueprint's is in torso lengths (0.012 x scale 0.8). The docs say this ("length in metres: the blueprint's is in torso lengths"), so it was clear.
- Possibly missing from the list a game developer would care about: the file has baked clips only, so the live procedural motion (foot IK on uneven ground, tail springs, look-at, aim) does not exist in an engine. The "What the file leaves out" table covers rendering effects only; I did not count that as a "live effect the file leaves out", but it might be worth a row.

### x09 levels of detail

```sh
pnpm -s spawnforge export examples/tusk-boar.json --out $RUN/x09.glb
```

- Triangles from the file: full `skin` node index count 81558 / 3 = 27186; `skin_LOD1..3` = 13592, 6796, 2718 (these match `extras.lods`, which has levels 1 to 3 only; the full mesh's count is not in the extras and the export output's `triangles` is the whole file, so the full count must be derived from the accessor's `count`, as runtime.md says).
- Distance: `error x pixels / (2 tan(fov/2))` = 0.00478 x 935.3 = 4.47 m, using the skin's coarsest level. Cross-check from the file: `MSFT_screencoverage` for the skin is `[1, 0.9687, 0.3235, 0]`, and with the creature's largest side of about 1.67 m the last threshold agrees with 4.47 m.
- Ambiguity I resolved by judgement: "the coarsest level" is per mesh. The parts' level 3 has a much larger error (0.0471 m, 44.05 m), so the creature as a whole is only under a pixel from 44 m, while the skin is from 4.47 m. The task is about the skin, so I answered 4.47; the docs example ("a 4.8 mm error is under a pixel from 4.5 m") is the boar's own skin level 3 and made the formula easy to confirm. It would help to say in the docs what to do for the creature as a whole (use the worst mesh).
- Oddity: `parts_LOD3` (758 triangles) is hardly coarser than `parts_LOD2` (762) while its error doubles (0.0216 to 0.0471). A cheaper "no extra level" would be to omit it.
- `extras.lods` errors are rounded to 3 digits, so the distance is only good to about 0.01 m.

### x10 root motion

```sh
cp examples/sand-cheetah.json $RUN/x10-blueprint.json
pnpm -s spawnforge patch $RUN/x10-blueprint.json '[{"op":"add","path":"motion.actions","value":"pounce"}]'
pnpm -s spawnforge validate $RUN/x10-blueprint.json --quiet
pnpm -s spawnforge export $RUN/x10-blueprint.json --out $RUN/x10.glb
```

- First try, including `patch` `add` on a list of strings. `describe-module pounce` says it needs legs and a jaw, and the cheetah has both. The default export now has `pounce` with `rootMotion: true`, `distance` 2.6856 in extras.
- Verified two ways: the extras `distance` and the root bone's (`root`) translation track, whose last value is (0, 0, 2.68559). They agree to the float. The docs' wording for the extras ("or for a clip with `rootMotion` how far forward the root ends") is accurate; it is the same field name (`distance`) as a gait's stride, so a reader scanning clips has to check `rootMotion` first.
- Only `pounce` moved the root, as expected: idle, the gaits, bite, look and death all have a root track that ends at the origin.
- `patch` rewrote my copy's formatting (arrays collapsed/expanded), which makes a `diff` of the copy against the example noisier than the one-line change it was.

### x11 Godot import

```sh
pnpm -s spawnforge export examples/grey-wolf.json --out $RUN/x11.glb
```

- `loop` from `extras.clips[].loop`: idle, walk, trot, gallop true; bite, roar, look, death false. The Godot section of engines.md says exactly this ("set each clip whose `loop` is true (idle and the gait cycles)").
- Breath node: `socket_mouth` (Godot makes it a `BoneAttachment3D` of that name on the jaw bone). Same caveat as x04 about the jaw. I did not have Godot, so nothing here was run in an engine; I only read the file.
- `death`: `loop: false`, but the docs say "until half a second after it comes to rest", so a game that holds the last frame is right; Godot's default import for a non-looping clip is fine.

## General notes

- Exports were 4 to 20 s each, as the brief said; there were no failures. The `export` JSON output (clips, sockets, `lods`, `textures.timings`, `notes`) is very useful, and I could answer most tasks from it before opening the file.
- The brief's rule "write your own small script to read the .glb" worked, but `engines/python/spawnforge_extras.py` already reads the extras (it does not read samplers or accessors). The README or runtime.md could point to it for people who just want extras (it is in engines.md, but I only found it after writing my own).
- Minor: action clips carry `speed: 0` and `distance: 0` in the extras, which reads as "moves at 0 m/s" rather than "not applicable"; the docs describe `speed` only for gaits.
- No error message was unhelpful. Three were good: unknown clip (names the clips it has and the fix), `--textures 4096` ("must be 512, 1024, 2048 or none"), and `generate` printing `attempts` and `bodyHeight`.
