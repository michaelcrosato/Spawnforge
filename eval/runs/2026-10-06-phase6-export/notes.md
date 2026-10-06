# Phase 6 export eval: notes

Run on commit `fc7a097` (the phase 6 PR before this eval). Four tasks
([eval/export.json](../../export.json)) need `export`, stats and reading a `.glb`;
[eval/export.ts](../../export.ts) checks the files (clips, quality, stats, body height, the socket
node and the bite timings read back from the file). The `.glb` files are not committed: the
commands in `feedback.md` make them again (export is byte-identical on repeat runs).

Score: **4/4 tasks pass** (`export-score.json`). Gate 3: passes.

## Feedback, and where it goes

| Feedback | Where it goes |
| --- | --- |
| `--quality ultra` accepted (stored in the file, a coarser mesh); `--fps 0` unchecked; `--stats` with no value crashed with a stack trace | Fixed: quality must be low, medium or high (also checked in core), fps a whole number from 5 to 120, and argument errors come back as JSON |
| The export output doesn't mention stats | Fixed: `stats` is in the output |
| A blueprint that lists `motion.actions` without `idle` exports a still idle, silently | Fixed: the output's `notes` say so and how to fix it |
| The bite clip (0.83 s) is longer than the bite (`action-end` at 0.6 s); durations move with `--fps`; default fps undocumented | Documented: action clips add 0.25 s of settling, lengths round to whole frames, 30 fps by default |
| `docs/runtime.md` says `clipSpeed`; the extras field is `speed` | Fixed |
| runtime.md lacks setup (packages, Three.js release, renderer), where blueprints come from and how `spawn` fails, argument types, event payloads, live stats, a GLTFLoader recipe and notes for other engines | Added all of them; live stats are `bestiary.stats(creature, id)`, and a new `arrive` event fires when a creature reaches its target |
| `generate`'s `measurements.height` is body height while `analyze`'s `height` includes horns | Fixed: `generate` reports `bodyHeight`, the same as `analyze`'s `bodyHeight` |
| `render --size` is pixels per panel, the docs said image width | Fixed in the docs |
| Demon-theme bipeds read as tubby pillars | Later: muscle masses and shaped limbs (the plan's "Later" body work) |
