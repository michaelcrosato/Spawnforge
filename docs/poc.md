# Proof of concept: checklist and evidence

[docs/plan.md](plan.md) defines the proof of concept as five checks, run at the phase 4 gate.
All five pass.

| Check | Result | Evidence |
| --- | --- | --- |
| A ~30-line blueprint becomes a textured monster walking over uneven ground in the browser, compiled in under half a second | Pass | [examples/ember-beetle.json](../examples/ember-beetle.json) is 29 lines and compiles in 287 ms in Node and 372 ms in Chrome at medium quality ([budgets.json](poc/budgets.json)); `pnpm dev` walks it over the sandbox's terrain course |
| Four body plans on the same code: biped, quadruped, six-legged, legless serpent | Pass | One example per plan in [examples/](../examples), compiled, rendered and animated by the same pipeline; `packages/modules/src/motion.test.ts` covers their gaits (walk, trot, tripod, slither) and foot planting on uneven ground, and `analyze` runs any creature over flat and rough ground |
| A new part type is added by writing one file, with no core changes | Pass | `ear.pointed` (phase 4) is [one file](../packages/modules/src/parts/ear.pointed.ts); the core never names it, and the module harness tests it automatically |
| On the 20-prompt suite, a valid blueprint for ≥ 18 prompts within 3 fix rounds; a blind reviewer matches ≥ 16 renders | Pass | [20/20 valid (19 first try), 20/20 blind matches](../eval/runs/2026-10-06-phase4-poc/notes.md) |
| The same blueprint and seed give an identical mesh, and 1,000 fuzzed blueprints compile without an error | Pass | Golden fingerprints ([golden.json](../packages/modules/src/golden.json)) are identical in Node and Chrome (`golden.test.ts`, `render.test.ts`); [fuzz-1000.json](poc/fuzz-1000.json): 1,000 valid, 1,000 compiled, 0 failures |

## Budgets

| Budget | Target | Measured |
| --- | --- | --- |
| Compile time, medium quality | ≤ 500 ms | 41–287 ms in Node and 71–372 ms in Chrome for the examples; median 244 ms over 1,000 random blueprints, which are mostly larger and stranger than real ones |
| Skin mesh, medium quality | ≤ 30k triangles | 4.0k–26.5k for the examples; at most 28.8k over 1,000 random blueprints |
| Draw calls per creature | ≤ 3 | 3 (skin with inner mouth, hard parts, eyes) |
| Live animation update per creature | ≤ 0.1 ms (5 ms for 50) | 0.037–0.076 ms; a herd of 50 takes 2.76 ms a frame |
| Animated creatures at 60 fps on a mid-range laptop | ≥ 50 | Not measurable here: CI and agent sandboxes render with SwiftShader on the CPU. The CPU side (2.76 ms for 50) and 3 draw calls per creature leave the budget to the GPU |

Reproduce: `pnpm budgets --out docs/poc/budgets.json`, `pnpm fuzz 1000 medium --out
docs/poc/fuzz-1000.json`, `pnpm test`, and the eval protocol in [eval/README.md](../eval/README.md).
