# Gate 12: notes

Release 0.2 (plan 2's milestone 12.3) against the gate 12 row of plan 2's gate thresholds: suite
A's and suite B's full runs with renders, filmstrips, `analyze` and `patch`, each with a blind
review, as at gate 9, and every other eval again: suite M, the variation eval, the export eval,
the fuzz, the budgets, the round trip with the Khronos validator, the smoke test and the corpus.
The runs are this folder (suite A), `../2026-10-08-gate12-b/` (suite B), `-m/` (suite M),
`-variation/` and `-export/`. The agents worked from the docs, the examples and the CLI only: four
per suite for A and B with five prompts each, two for suite M, three for variation and one for
export, and a blind reviewer for each of A, B and M.

The agents ran at `802cac3`, the release branch before it was squashed onto `main`. The release
commit differs from it by the compile speed-up below, which leaves every vertex where it was (each
example at each quality, and 193 fuzzed blueprints, compile to the same bytes), the fixes from the
feedback (docs, `analyze --summary`, two captions) and the gallery's test. Suites A and B, the
variation eval and suite M's checks were scored again at the release commit with the same results.

## Results

| Check | Bar | Result |
| --- | --- | --- |
| Suite A, full run | ≥ 18/20 valid, ≥ 18/20 matched | **20/20 valid**, every one on the first try (`score.json`); **20/20 matched** blind, all high confidence (`blind-score.json`) |
| Suite B, full run | ≥ 18/20 valid, ≥ 18/20 meet `expects`, ≥ 16/20 matched | **20/20 valid** on the first try, **20/20 meet `expects`** (`../2026-10-08-gate12-b/score.json`); **20/20 matched** blind, 19 high confidence and 1 medium (`blind-score.json` there) |
| Suite M | ≥ 9/10 pass their checks, ≥ 8/10 filmstrips matched | **10/10 pass** (`../2026-10-08-gate12-m/check-score.json`); **10/10 matched** blind, all high confidence (`motion/motion-score.json` there) |
| Variation | 12/12 | **12/12** (`../2026-10-08-gate12-variation/variation-score.json`) |
| Export eval | ≥ 9/11 | **11/11** (`../2026-10-08-gate12-export/export-score.json`) |
| Fuzz | Median ≤ 400 ms; no failures | 976 valid of 1,000, all compiled, no failures; median 347 ms, p95 795 (`fuzz.json`, at `802cac3`) |
| Compile, Chrome, medium | ≤ 500 ms every example | Every example, at most 430 ms (the luna moth; cerberus 395, the hydra 374) (`budgets.json`) |
| Skin, medium | ≤ 30k triangles | Every example ≤ 28.8k (the centaur) |
| Parts | ≤ 20k triangles | Every example ≤ 14.7k (the hydra) |
| Draw calls | ≤ 3, plus fur and membranes | 3, plus one for fur and one for membranes where they have them (the bat, the griffin and the moth 5) |
| Levels of detail | ≤ 100 ms | At most 40 ms (cerberus) |
| `.glb` with maps, medium | ≤ 8 MB, baked in ≤ 10 s | At most 7.65 MB (the griffin); at most 9.99 s (the hydra, 9.77 in the first run: the slowest bake, at the edge) |
| Motion | ≤ 0.1 ms per creature (0.15 flying or swimming); 50 ≤ 5 ms | 0.026–0.065 ms (the ash dragon highest); 50 walking 3.07 ms |
| Round trip and validator | 32/32, no validator errors | **32/32** at the release code, its three probes (relief, roughness, glow) passing; the validator without errors, its one warning `NODE_SKINNED_MESH_NON_ROOT` as at gate 11 (`roundtrip.json`) |

Goldens and example renders do not change: nothing in the release moves a vertex.

## Fixes made for the gate

The first budget run, at `802cac3`, put cerberus at 591 ms in Chrome and the rhino beetle at 524,
and three more runs had cerberus at 491–524 and the hydra at 474–568: over 500 on this machine,
whose timings drift by a third from hour to hour (the same code measured 398 and 431 at gate 10).
Profiling found work the compile did not need, and three changes removed it without changing any
result:

- Parts tested points against the whole distance field (every primitive) to see whether they were
  outside the skin: how much of a part shows (for `part_buried`), and `skinAlong`, which wing cases
  march along to find the skin. They now use the skin grid's block lists, which hold every
  primitive near a point. The rhino beetle's parts went from 55 to 17 ms, cerberus's from 33 to 14.
- Skin weight smoothing, the joints' helper bones and the heads' refinement listed every vertex's
  weights as new arrays, once per neighbour and once per head; they read the weight slots in place
  now, in the same order. Weights went from about 38 to 25 ms on cerberus and 50 to 34 on the
  rhino beetle.

Each was checked for exact output: every example at low, medium and high quality, and 193
fuzzed blueprints, hashed whole (meshes, weights, parts, rig, notes), compiled to the same bytes
before and after. Two more ideas were tried and dropped: a third, 2-cell level in the meshing
grid's sampling moved some vertices of a fuzzed blueprint by up to 5 mm (the field is not a true
distance everywhere, so a sign-only shortcut can be wrong), and narrowing the per-vertex Newton
step's primitives saved nothing measurable once its margin was wide enough to be exact.

## Feedback, and where it goes

Fourteen agents and three blind reviewers (`feedback-*.md` and `review-notes.md` in each run's
folder). No agent met a validation error it could not fix, and all forty first attempts of suites
A and B were valid; the revisions came from renders and `analyze`.

| Feedback | Where it goes |
| --- | --- |
| `analyze --summary` leaves out `bodyHeight`, the figure `generate --max-height` limits, though the docs say it keeps the sizes (four agents) | Fixed: the summary keeps `bodyHeight`; blueprint.md lists what the summary keeps and that `cadence` and per-gait `intersection` are in the full output |
| A swimmer's filmstrip says "no legs: the body follows its own trail (slither)", and scenario strips say "walked" for a swim or a flight | Fixed: a stroke in the water says so, and scenarios say "covered"; scenarios.md's `distance` and `aboveGround` say how they are measured in water and air |
| `speed.walk` for creatures that cannot walk | Documented: for a body that only swims it is its swimming pace |
| A wolf "is about scale 0.7" while the grey wolf is 0.9; the horse's 500 and 750 kg at `muscle` 0.5 and 0.7 did not hold (735 kg at 0.5) | Fixed in blueprint.md from the examples' measured sizes and masses, with `analyze`'s `mass` to check |
| The bushy-tail recipe's `"fur": { "region": "tail" }` strips the body's coat | Fixed: `fur` is one coat; the recipe says when to use it and how to make a furry creature's tail bushy |
| The stinger recipe's `curve` 60 against the scorpion's -80; the stinger wider than the tail tip | Fixed: the recipe gives both tails' settings and keeps the stinger under the tip's radius |
| The moth recipe's wing `at` values meet `wing_intersection`; insect wings default to a bat's thick bones | Fixed: the recipe takes the luna moth's working values and thin bones |
| `jaw: true` "adds" a jaw though it is the default; `validate --expanded` undocumented | Fixed in blueprint.md |
| `#1c1a1e` is "charcoal" in descriptions; dark brown has the same trouble | Documented with the dark-creature advice |
| Frills and hoods look missing on the default sheet; `sail` has no `open`; `--action display` not in the docs | Documented: which rest folded, that a sail stands, and that any listed action draws a filmstrip |
| "Each head looks about on its own", but `lookAt` turns every head | Documented: idle glances are per head, `lookAt` turns them all |
| A viper's mutant lost its fangs, though the docs said it keeps them | Documented: part numbers drift and parts can go; lock them or use `--keep-parts` |
| Crossbreed's `--lock body.torso,limbs` still blends the neck; `scale` blends | Documented: lock `body`, and `scale` for size |
| Lock paths can go as deep as a param; no way to see they held | Documented, with `diff` against the parent |
| `follow` works for swimmers with `[x, y, z]`; `after_end` is a warning, not an error | Fixed in scenarios.md |
| runtime.md: gait clips are not at `--fps`; how `--quality` and `--textures` combine; JPEG maps at 6 MB; `extras.stats`' shape; action clips' `speed` 0; flight's `takeoff`/`land` events have no `position` | Fixed in runtime.md |
| `skittish` silences `fast_cadence` while `cadence` stays high | Documented: by design, a skittish creature scurries |
| Leaving out `motion.actions` gives every action the body allows (a gecko that roars, a moth that jumps) | Documented: list the actions you mean |
| The kraken slithers on land; `media.land: false` undocumented | Documented, in the media section and the kraken recipe |
| No recipe or proportions for wolves, trolls, demons, round beetles, geckos, raptors, rhinos, boars, hounds, armadillos, stegosaurs; nothing on how big a pattern, spike or eye must be to read; "big", "long" undefined (eight agents) | Later: a proportions and readable-size guide |
| Bipeds always crouch; a `wide` biped torso is a sack with no shoulders or waist; a quadruped's knees fold like a bird's | Later: biped posture and torso shape |
| Missing module parameters: claw length on paws, a sickle claw, toe width and gecko pads, tail stiffness, a crown, a snout disc, jet swimming, quill band width, spike jitter, wrinkle size; a compound or glowing eye; a second row of teeth | Later: module parameters (glowing eyes and several rows of teeth are already there) |
| The description's wording: colour names, fur never mentioned, "broad flat body", "a quadruped" for a centaur, horns not located | Later: a description pass |
| No warning for parts nobody can see (a buried tail, a hidden horn, floating armour, tiny eyes, a region that paints nothing, eyes under a beak) | Later: occlusion checks (also at gate 9) |
| `limb_intersection`'s fix can swing the hit to another pair or deepen it; `wing_intersection` reports one wing and its fix did not clear the griffin; `ground_penetration` names the wrong knob; `part_buried` names no amount | Later: fixes found by search over the knobs, every limb at once |
| Renders of water and air: the floor under a swimmer, the water drawn in front of the creature in side view, the chase camera hiding speed and height, no labels; frames spread over the whole scenario; long creatures framed at full length; labels crowd many-headed creatures; renders take 10–30 s whatever the views | Later: render options (a time window, events framed, zoom, label filters) |
| Coverings: `armor.bands` on the back leaves the flanks bare and floats at default thickness; quills spread onto the flanks; plates stick past the body; a `shell` reads as a grid | Later: coverings pass |
| Look: fur shells read as frost, long parts are uniform tubes, chitin as plastic, serpents lie straight, wing cases ignore skin layers and stand as a slab, `mandible`'s `tipColor` does not show | Later: a quality round on fur, chitin and wing cases |
| `diff` and `patch` address layers and actions by position; `patch` reformats the file | Later: match lists by type in `diff` |
| `--max-height` limits the body, not horns; no total-height limit; `--min-heads`; theme weights not shown; `generate`/`mutate` print no motion warnings and no `--count`; `--amount` changes very different numbers of genes by seed | Later: variation reports and constraints |
| Regions too coarse (no tail tip, per-limb, torso-only countershade); colour defaults (accent everywhere, fixed part colours); `spikes.row` on `spine` counts the neck and tail | Later (finer regions are already there) |
| Scenarios accept a `moveTo` past top speed, a pounce that falls short, a swimmer with no water; the first frame is a settling transient; `analyze` and `render` land the dragon 0.5 s apart; a 12 cm gallop intersection without a warning; a 16 cm beetle "flies at 33 m/s" | Later: scenario plausibility checks, with these cases as tests |
| `parts_LOD3` barely coarser than LOD2 on the tusk boar | Later: a floor on how far a level may simplify a part |
| Recipes that give the wrong shape on some bodies: a club tail, a rhino horn along a pitched snout, flat-head tusks with `aim` "up", the big cat's frog face | Later: re-check the recipes with renders |
| Suite B's prompts have examples of the same name, so agents copy them | Later: the eval's next suite |

## Protocol notes

- The suite M reviewer listed its folder once and so saw the key's file name; it opened only the
  filmstrips and `review.md`.
- Variation agent C compared files with a script of its own to check that a lock held; it read no
  source code.
- The fuzz ran at `802cac3`: the speed-up makes it faster, never different.
