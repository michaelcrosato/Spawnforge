# Gate 11: notes

Phase 11 (texture maps, levels of detail, crowds and the GPU bench, engine guides) against the
gate 11 row of plan 2's gate thresholds: suites A and B re-scored, the export eval extended with
levels of detail, root motion and engine notes and run by an agent, the texture round trip with
the glTF validator on every example, and 7.6's smoke test. Run on `f457a23` (11.4), with the
fixes from the export eval's feedback after it.

## Results

| Check | Bar | Result |
| --- | --- | --- |
| Suite A, re-score | 20/20 | **20/20 valid** (`rescore-a.json`, gate 9's attempts) |
| Suite B, re-score | 20/20 | **20/20 valid**, **20/20 meet `expects`** (`rescore-b.json`) |
| Export eval | Passes (≥ 9 of 11, three in four) | **11/11** (`../2026-10-08-gate11-export/`): one agent from the docs and the CLI; the three new tasks read the skin's levels and the distance from which the coarsest is under a pixel, give a cheetah a pounce and read how far its root moves, and answer a Godot developer's import questions |
| Round trip, 32 examples | Every view within the 11.1 bars, with and without tangents | **32/32 pass** (`roundtrip.json`). Overlap 1.0 everywhere; worst mean 2.6% (the reed viper), worst share off 3.4% (the river crocodile); 27 of 32 under 1.5% mean |
| Probes and mutations | Each effect matches live; each mistake fails its probe | **3/3 probes pass** (relief 0.91, roughness 0.81, glow 1.0); **6/6 mistakes fail** (green 0.55, tangent sign 0.55, normal map as sRGB 0.46, v flipped 0.26, ORM swapped 0.47, glow clipped to a third of its size) |
| Validator | No errors | **0 errors** for all 32; every file carries the warning `NODE_SKINNED_MESH_NON_ROOT` (its skinned meshes sit under the creature's root node), as at 11.1. Files are 2.8–6.7 MB, levels of detail included |
| Smoke test | Passes | Passes in CI on the gate's commit (the packed packages, `bake` among them, built into a game and run in Chromium) |
| Bench | Recorded, or listed as pending | **Pending the owner's run** on a mid-range laptop (`pnpm bench --open`, `docs/poc.md`). Headless in CI (SwiftShader), recorded only: 60 distant creatures as crowds cost 0.5 ms of update against 2.1 and 109 draw calls against 200, with no slow frames |

## From the feedback

The export eval's agent read the docs closely and found gaps, all fixed here
(`../2026-10-08-gate11-export/notes.md`): blueprint.md still said glow stays out of exports;
the JPEG colour maps of big files, the distance at which a level of detail is under a pixel,
what `MSFT_screencoverage`'s values mean, the units of `fur.length` and `glow[].pulse` and what a
leap's `distance` is were undocumented; textured exports' notes left out breathing and texel-sized
detail; and a missing clip's error now says how to get it (`add "pounce" to motion.actions`).
