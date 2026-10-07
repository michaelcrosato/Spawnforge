# Milestone 9.6 variation eval: notes

Run on commit `4a0b25d` (9.6 before this eval). Twelve tasks ([eval/variation.json](../../variation.json)):
plan 1's eight and four over format 0.2's heads, wings, tentacles, coverings and themes. Three
independent agents, four tasks each, with the docs and the CLI only.
[eval/variation.ts](../../variation.ts) checks the saved files: validity plus what each task asked
for.

Score: **12/12 tasks pass** (`variation-score.json`, re-scored after the fixes below: still
12/12). The 9.6 gate is every task.

| Task | Result |
| --- | --- |
| v09 flying dragon | `generate --theme dragon --requires air`, seed 3, 1.1 m limit: a winged quadruped |
| v10 winged wolf | `crossbreed grey-wolf griffin --base a`, legs locked by id: four paws and feathered wings |
| v11 hydra litter | three `mutate`s, five heads each, no wings, no locks needed |
| v12 armoured horror | eldritch seed 7 (three heads) with a `shell`: `rpg` defence 10 → 22 |

## Feedback, and where it goes

| Feedback (agents A–C) | Where it goes |
| --- | --- |
| `bodyHeight` came out larger than `height` on a winged dragon (1.07 against 0.75 m) | Fixed: `measureBody` counted the wing bones, which are built spread; it now leaves wing and fin bones out. The dragon's body height is 0.63 m |
| A mutation flipped `head.jaw` off, which dropped a viper's locked fangs and its bite; `upper: false` left a teeth row empty; eyelids switched on for a snake | Fixed: `jaw` is structure, not a gene, and mutation never flips a switch (crossbreeding still takes switches from either parent) |
| Mutation turned a viper's scales into chitin | Fixed: `skin.material` never drifts under mutation |
| Mutation added a beak to a snake and swapped a hydra's teeth for mandibles | Fixed: lineage tags (`bird`, `insect`, `snake`, from the pack's defaults) keep such parts to creatures that already wear one; fins follow the pack's `habitat` (water) |
| The docs' recipe `--lock body.torso,limbs` keeps out the other parent's wings | Documented: lock the legs by id to take wings |
| A crossbreed lost the wolf's teeth without a `parts` lock | Documented: the base's unpaired parts stay with chance `1 − mix`; lock `parts` to keep them |
| Every generated insect had two `horn.curved` parts (its pincers were a fixed horn) | Fixed: the insect theme's pincers are `mandible`s |
| No head count in `analyze` | Fixed: `measurements.counts` (heads, tails, legs, arms, wings, fins, tentacles) |
| `scale` drifts and its lock is undocumented; lock paths with brackets need quoting; `--keep-parts` is undocumented | Documented |
| `rpg` defence formula undocumented | Fixed: its catalogue entry spells out the formula |
| `--min-height` lands exactly on the limit; the blueprint's `seed` differs from `--seed` | Documented: limits are met exactly, to the millimetre; the seed is drawn |
| `mutate`, `generate` and species `validate` report no `analyze` warnings (intersections, ground penetration, fanned necks crowding) | Later: a `--check` that analyzes children and tries the next seed |
| No way to ask a crossbreed for one parent's wings, or `generate` for a head count | Later: `--take <path>`, `--min-heads` |
| Species checks miss mixed corners of their ranges | Later |
| Wolves sized by torso length weigh 117–289 kg | Later: mass calibration and an implausible-mass warning |
| Colour ranges' distribution undocumented; `instantiate` renames and reseeds | Later (docs) |
