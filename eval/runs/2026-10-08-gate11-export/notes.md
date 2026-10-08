# Gate 11 export eval: notes

Run on commit `f457a23` (11.4, with gate 11's three new tasks in `eval/export.json` and their
checks in `eval/export.ts`). One agent did the eleven tasks from the docs, the examples and the
CLI only, reading every answer from the exported files with a script of its own; the `.glb` files
are not committed (the commands in `feedback.md` make them again). The new tasks: x09 reads the
skin's levels of detail and works out the distance from which the coarsest is under a pixel, x10
gives a cheetah a pounce and reads how far its root moves, x11 answers a Godot developer's two
import questions (which clips loop, where a fire-breath effect goes).

Score: **11/11 tasks pass** (`export-score.json`; the gate asks for 9). The checks were first run
against answers made by hand with the CLI, to check that they pass a right answer.

## Feedback, and where it goes

| Feedback | Where it goes |
| --- | --- |
| `blueprint.md` still said `.glb` exports leave glow out until 11.1, and fur "for now" | Fixed: glow exports as an emissive map with its pulse in the extras; fur's shells are left out, with the coat in the extras |
| The JPEG colour maps of big exports are only in the export's notes | Documented in runtime.md and `export --help`: which maps turn JPEG, and when (past 8 MB) |
| No formula for the distance from which a level is under a pixel; `MSFT_screencoverage`'s values unexplained; the full mesh's triangles not in `extras.lods`; skin and parts levels apart | Documented in runtime.md, with a worked example; the full mesh's triangles are its index count over three |
| `--max-height` "to the millimetre", but the mesh stood 0.09 mm above 1.2 m | Documented: the limit holds as `analyze` measures it; the mesh can stand a fraction of a millimetre past it |
| The export's notes listed two of the cheetah's live-only differences; runtime.md's table has more | Fixed: textured exports' notes also name breathing (with `idle`) and detail baked at the texel's size |
| Fur in torso lengths in the blueprint, metres in the file; `extras.glow[].pulse`'s unit; whether a leap's `distance` is the root's travel | Documented in runtime.md's extras list: fur in metres, pulse in hertz, a root-motion clip's `distance` is how far its root ends |
| A missing clip's error does not say how to get one | Fixed: `no clip "pounce" …; add "pounce" to motion.actions to get it` (and gaits likewise) |
| Several glow layers can't be told apart in the extras; the pulse's phase at time 0 | Later: one layer per creature in practice; the glow is baked at time 0 as runtime.md says |
