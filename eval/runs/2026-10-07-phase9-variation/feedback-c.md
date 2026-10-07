# Feedback (run c): v03, v06, v08, v11

All five blueprints and the species file validate with `ok: true`, no errors and no warnings, and
`analyze` reports no warnings on any of the individuals (v03, v08, v11.a/b/c).

Saved: `v03.json`, `v06.species.json`, `v08.json`, `v11.a.json`, `v11.b.json`, `v11.c.json`.

## v03-locked-mutant

What I did:

1. `pnpm -s spawnforge validate examples/ridgeback-stalker.json --quiet` (the parent is clean).
2. `pnpm -s spawnforge mutate examples/ridgeback-stalker.json --seed 5 --amount 0.4 --lock 'skin,parts[id=horns],scale' --out eval/runs/2026-10-07-phase9-variation/v03.json`
   (the first attempt used seed 3, see below).
3. Lengthened the horns with patch, because mutation is random and the docs say to push a gene one
   way by locking it and using `patch`:
   `pnpm -s spawnforge patch v03.json '[{"op":"scale","path":"parts[id=horns].params.length","by":1.6}]'`
   (0.25 to 0.4, +60%).
4. Checked it: `validate --quiet` is ok, and `diff examples/ridgeback-stalker.json v03.json` lists no
   `skin.*` path and no `scale`, and one horn change (`parts[id=horns].params.length: 0.25 → 0.4`).
   The diff has `"exact": true`, which is a good way to prove the skin is untouched.

Confusing, missing or harder than it should be:

- **`scale` can drift and nothing in the docs says so.** Horn `length` is in torso lengths, so a
  locked horn is not locked in metres if the mutation changes the top-level `scale`. With seed 2 the
  mutant's `scale` changed, so "horns at least 15% longer" would have depended on which unit you
  mean. The docs only show locks like `skin`, `body.head` and `parts[id=horns]`; they never say that
  top-level fields such as `scale` can be locked. I tried `--lock scale` and it worked with no
  `unknown_lock` warning, but I had to guess. Please document that top-level paths are lockable and
  that `scale` is a gene, and say whether "longer horns" is meant in torso lengths or metres.
- **Quote lock paths.** `--lock skin,parts[id=horns]` contains `[...]`, which a shell may try to
  glob. It happened to work for me; the docs should show it quoted.
- **`mutate` does not report plausibility problems in the child.** With seed 3 the child came back
  `ok: true, warnings: []`, but `analyze` on it gave a `fast_cadence` warning (the mutation shortened
  `foreleg.length` from 0.55 to 0.364 and swapped both feet to `foot.pad`, so the trot steps at 9.8 a
  second). The parent has no warnings. Only `analyze` finds this. A `--check` flag on `mutate` that
  runs the `analyze` warnings (or retries the next seed until it is clean) would save a loop. I then
  tried seeds 1, 2, 4, 5 and 6 (all clean in `analyze`) and chose seed 5 because, unlike seed 2, it did
  not touch `scale`; I locked `scale` as well in the final run to be safe.
- The child keeps the parent's `name` ("Ridgeback Stalker") and `seed`. This is documented and is
  what the task wants (same markings), but a child with the same name as its parent is easy to
  confuse in a folder. `mutate` has no `--name`; I would have to `patch` it.
- The `scale` patch op (multiply a number) and the top-level `scale` field share a name. It reads
  oddly in `{"op":"scale","path":"parts[id=horns].params.length","by":1.6}`, though it is clear enough
  from the docs.

Error messages: none hit.

## v06-serpent-species

What I did:

- Wrote `v06.species.json` by hand: `extends: serpent`, `"scale": {"min":0.6,"max":1.2}`,
  `"body": {"tail": {"length": {"min":2,"max":3}}}`, plus a small skin (countershade, bands,
  scales) and `stalking` temperament.
- `pnpm -s spawnforge validate v06.species.json` gave `species: true`, ok, no warnings; `checked`
  lists min, max and seeds 1 to 4.
- To be sure that every individual is valid, I also ran `instantiate --seed s --out x.json`, then
  `validate --quiet` and `analyze` on each, for seeds 1, 2, 3, 5, 8, 13, 21, 34, 55 and 89: all valid,
  all with zero analyze warnings; scales came out between 0.62 and 1.14 and tails between 2.02 and
  2.99.
- I also built the four mixed corners that `validate` does not (scale 0.6 with tail 3, and scale 1.2
  with tail 2, besides the two it checks) with a tiny script, and validated and analyzed them: all
  clean. Lengths were 1.96 m to 5.1 m.

Confusing, missing or harder than it should be:

- `validate` on a species checks only "all minimums" and "all maximums" plus seeds 1 to 4. It does not
  check mixed corners (small body with the longest tail), which is exactly where a range-dependent
  problem such as a tail too long for a small body would show. I had to script the corners myself.
  Checking each range at min and max one at a time (or a few more seeds) would be cheap.
- `analyze`, `render`, `mutate` and `crossbreed` take only an individual. There is no way to run
  `analyze` on a species ("at its extremes") without calling `instantiate` first and managing files. A
  `--seed` option on those commands for species files would help.
- "Size (scale)" in the task is the torso length. A serpent is about 3.5 times that long, so a 0.6 to
  1.2 m `scale` is a 2 m to 5 m snake. The docs do say so (sizing paragraph), but it is easy to miss
  when you first read "size varies between 0.6 and 1.2 m".
- The `checked` list from `validate` does not say which seeds were used for `scale` and the tail, so
  you cannot see the sampled values. `instantiate` shows them; fine.

Error messages: none hit.

## v08-tall-raptor

What I did:

- `pnpm -s spawnforge generate --theme reptile --body-plan biped --min-height 1.5 --seed 4 --out g4.json`
  gave `measurements.bodyHeight: 1.5` (and `analyze` also says 1.5). That is exactly on the line and
  I could not tell whether it is 1.4996 or 1.5004, so I did not use it.
- Regenerated with a margin: `generate --theme reptile --body-plan biped --min-height 1.7 --seed 7
  --out v08.json`. `analyze` says `bodyHeight: 1.701`, `height: 1.7`, `hipHeight: 1.24`, legs 1.42 m,
  mass 270 kg, 2 feet in `stability`, one gait (`walk`, up to 2.47 m/s), no warnings. Description:
  "Scadrak: a 3.7 m long, 1.7 m tall biped ... horizontal body, two arms, a long tail ... scales".
- I rendered it once (`render --views 3/4,side`) and it looks like a green, striped, spined raptor
  with a horizontal body on two digitigrade legs; no warnings from the renderer.

Confusing, missing or harder than it should be:

- **`--min-height` rescales to land exactly on the limit** (1.5 gives 1.5, 1.7 gives 1.701), and the
  output rounds to three decimals, so a creature "at least 1.5 m" can end up at 1.4996. The docs do not
  say whether the bound is inclusive or give a tolerance. I fixed it by asking for 1.7 when I needed
  1.5. Making the rescale aim a hair above the minimum, or printing the exact value, would remove the
  doubt.
- The seed field in the written blueprint (`1832780152`) is not the CLI `--seed` (7); the CLI seed
  picks the creature and the blueprint gets a derived seed. This is fine but surprising; one line in
  the docs would help.
- "Walks on two legs": the only evidence is `--body-plan biped` plus `analyze` (`feet: 2`, `walk` gait)
  and the description word "biped". It would help if `generate`'s output said the leg count and gaits.
- `--body-plan biped` is the only way to be sure of two legs from the `reptile` theme (its plans are
  quadruped 5, biped 2, serpent 3). That is documented in the theme's catalogue entry. Good.
- Height is in metres, and the theme gives a scale of about 1.2, so asking for 1.7 m was a pure rescale
  (no proportion changes). Okay, but the result has a 3.7 m body with 1.4 m legs; fine for a raptor.

Error messages: none hit.

## v11-hydra-litter

What I did:

- `pnpm -s spawnforge mutate examples/hydra.json --seed 5 --amount 0.4 --out v11.a.json`, the same with
  `--seed 2` for `v11.b.json` and `--seed 3` for `v11.c.json`.
- Checked head count: `neck.count` is 5 in all three (`validate --expanded`), no limb with
  `role: wing` and no `wing` anywhere in the files, and `analyze` descriptions say "five heads on long
  necks".
- Checked they differ: `diff` between pairs shows 49 to 57 changed paths, and each also differs from
  the parent in about 30 paths.
- My first v11.a (seed 1) validated but `analyze` found a `head_intersection` ("head.R1 and head.R2 pass
  4.3 cm into each other on flat ground", fix "fan the necks wider (body.neck.spread about 115)"). I
  replaced it with seed 5 after trying seeds 4 to 8: seeds 4, 6, 7 and 8 had `limb_intersection`,
  `head_intersection` or `overstretch` warnings and only 5 was clean.

Confusing, missing or harder than it should be:

- As for v03: `mutate` reports `warnings: []` even when the child has analyze-level warnings, and at
  `--amount 0.4` a hydra mutant had one in 5 of the 8 seeds I tried (1, 4, 6, 7 and 8). A `--check` option (analyze the child and
  retry or flag) would be very useful, especially for creatures with five necks.
- The docs say mutation never changes the number of heads and never grows wings. That was true, and I did
  not need locks for it. But the docs do not warn that mutating neck `length` or `spread` can make heads
  overlap, which is the one hydra-specific failure.
- `v11.c` had its teeth swapped for `mandible` (the description says "mandibles"), which is odd on a
  hydra but allowed. The CLI help lists `--keep-parts`, but `blueprint.md` never mentions it; I did not
  use it, since I could not tell from the docs what it keeps (swaps only, or adds and removals too).
- There is no short way to see "how many heads" from `validate` or `analyze` output other than the
  description sentence or `validate --expanded`; a `measurements.heads` field would make checks like
  this one easy.

Error messages: none hit.

## General

- Every command prints large pretty-printed JSON (`diff` 180+ lines, `analyze` 150+ lines). A `--quiet`
  or compact option for `analyze` and `diff` (as `validate` has) would make agent loops cheaper.
- `validate --quiet` is great for loops; the same on `analyze` (warnings and measurements only) would be
  the equivalent.
- The `mutate` result is nicely readable (`diff` as one line per gene). One small oddity: when it
  mutates a gait or action entry, a plain string becomes an object that also carries unchanged siblings
  (for example `"roar"` becomes `{"type":"roar","duration":2,"intensity":0.659}`, where only `intensity`
  changed), so the child file and its diff are a little noisier than the real change.
