# Feedback from run c (v03, v06, v08, v11)

Worked from README, docs/blueprint.md and the CLI only. All four tasks passed `validate` and
were saved under the names the tasks gave. No command failed outright. Renders took 17 s each,
`validate` and `instantiate` about 2 s, `analyze` about 5 to 10 s.

## v03-locked-mutant (mutant of ridgeback-stalker, horns +15% or more, skin exactly the parent's)

Commands:

```sh
pnpm -s spawnforge mutate examples/ridgeback-stalker.json --seed 3 --amount 0.3 --lock skin --out try1.json
pnpm -s spawnforge mutate examples/ridgeback-stalker.json --seed 3 --amount 0.3 --lock skin,scale --out v03-base.json
pnpm -s spawnforge patch v03-base.json '[{"op":"scale","path":"parts[id=horns].params.length","by":1.6}]' --out v03.json
pnpm -s spawnforge diff examples/ridgeback-stalker.json v03.json
pnpm -s spawnforge analyze v03.json --summary ; pnpm -s spawnforge render v03.json --out v03.png
```

Result: horns 0.25 to 0.4416 torso lengths (+77%, and the same in metres because `scale`
stayed 1.2), `skin` identical to the parent (compared with Python: `a['skin'] == b['skin']`).

What worked first time: the doc's sentence "Mutation is random: to push a gene one way (longer
horns), lock it and change it with `patch`" is exactly the recipe, and `patch --out` plus the
`scale` op did it in one call. `--lock skin` locked palette, material and layers together. The
`unknown_lock` warning is a nice guard.

What was confusing or harder than it should be:

- Unclear whether "15% longer" means torso lengths or metres. The docs say lengths are in torso
  lengths and to lock `scale` when a size must hold in metres, so I locked `scale` too. That is
  easy to miss; the first try (lock `skin` only) happened to leave `scale` alone only because
  the seed did not draw it.
- Mutation drifted the horns' placement as well: `parts[id=horns].attach.at` went 0.75 to
  0.902, so the horns now sit at the back of the skull, and `tipColor` changed (a part colour,
  not skin). Neither is wrong, but the task text "horns must be longer" invites also locking
  `parts[id=horns].attach`. I did not think of locking a sub-path (`parts[id=horns].attach`,
  `parts[id=horns].params.length`) until after; a doc line saying lock paths can go that deep
  (the help only shows `skin,body.head`) would help. Better recipe: lock
  `parts[id=horns].params.length` so the base is the parent's 0.25, then `scale` by 1.6, so
  the ratio to the parent is exact. I scaled the already drifted 0.276, which is fine only
  because 0.276 x 1.6 is far above the bar.
- Checking "skin exactly the parent's" has no tool support. `diff` returns the whole creature's
  31 ops; I grepped them for `skin` and also compared in Python. A `diff --path skin` filter, or
  `mutate` reporting `locked: unchanged`, would make this self-checkable without leaving the CLI.
- `mutate` stdout is a long gene list (about 45 lines); useful, but the horn lines are buried
  and there is no way to ask "show only parts[id=horns]".

Error messages: none encountered.

## v06-serpent-species (scale 0.6 to 1.2, tail 2 to 3 torso lengths)

Commands:

```sh
pnpm -s spawnforge describe-module serpent --kind bodyPlan
pnpm -s spawnforge validate v06.species.json
pnpm -s spawnforge instantiate v06.species.json --seed N --out iN.json      # N = 1..40
pnpm -s spawnforge validate iN.json --quiet                                  # each one
pnpm -s spawnforge analyze corner.json --summary                             # 4 hand-made corners
pnpm -s spawnforge render corner.json --views 3/4,side
```

File: `extends: serpent`, `scale: {min 0.6, max 1.2}`, `body.tail.length: {min 2, max 3}`.

What worked first time: the species format in the docs example (`scale` range, nested range on a
body field) was copied almost verbatim; `validate` said `species: true` with six `checked`
entries. All 40 instantiated individuals validated with no warnings; scales fell in 0.60 to 1.20
and tails in 2.02 to 2.97.

What was confusing or missing:

- The mapping "tail length varies between 2 and 3 torso lengths" to `body.tail.length` is
  direct because tail lengths are already in torso lengths, but the docs never say so next to
  the species section. The units section does, so I got there, but a species example with a
  tail would have saved a check.
- `validate` checks all-minimums, all-maximums and four seeds, not mixed corners (small scale
  with the longest tail, or the reverse). "Every individual must be valid" is therefore not
  fully covered by `validate`'s `checked` list; I hand-wrote the four corners and ran
  `analyze` on each (no warnings, lengths 1.96 m to 5.11 m). An option such as
  `validate --corners` or an extra mixed-corner entry in `checked` would close the gap.
- `instantiate` prints only `ok/errors/warnings/written`, not the values it drew; I had to open
  each file. It also writes the minimal form, so seed 34 came out with no `body` key at all (its
  tail drew 2.2, the preset's own value). Harmless, but a script reading `body.tail.length`
  from an individual would crash, and a first-time reader may think the range was ignored.
- The individual's name becomes "Marsh Serpent #34" and its `seed` is rewritten to a large
  number; not documented where `instantiate` is described (only that it resolves ranges).

Error messages: probed one bad species to see (`scale` min above max). The message
(`bad_range`: "min 1.2 is above max 0.6", fix `{ "min": 0.6, "max": 1.2 }`) is clear and gives
the corrected form. Note it returned only that one error and `checked: []`; another range I had
written (tail `{2, 4}`) was not examined until the first was fixed, as the docs warn.

## v08-tall-raptor (reptile, two legs, body at least 1.5 m tall)

Commands:

```sh
pnpm -s spawnforge generate --theme reptile --seed 4 --body-plan biped --min-height 1.5 --out try1.json
pnpm -s spawnforge generate --theme reptile --seed 4 --body-plan biped --min-height 1.55 --out v08.json
pnpm -s spawnforge analyze v08.json            # full, to read measurements.bodyHeight
pnpm -s spawnforge render v08.json --labels
```

Result: "Serdrak", `extends: biped`, `scale` 1.08, bodyHeight 1.55 m, 2 legs and 2 arms, theropod
posture, no warnings from `analyze` or `render`.

What worked first time: the whole task was one command. `--body-plan biped` gives two legs
and `--min-height` rescaled the creature to meet the limit exactly, as the docs say. `generate`
prints `measurements.bodyHeight` itself, so no further tool was needed to verify.

What was confusing or harder than it should be:

- With `--min-height 1.5` the result was bodyHeight exactly 1.5 (to three decimals). Because
  "at least 1.5" is a boundary and the docs say the mesh can stand "a fraction of a millimetre"
  off the limit (written for `--max-height`), I regenerated with 1.55 to be safe. The docs
  should say which way the margin goes for `--min-height`, or the tool should aim a hair
  above the minimum.
- `analyze --summary` keeps `measurements.height` but leaves out `bodyHeight`, while the docs
  define the generate limits by `bodyHeight` and say `height` includes horns and spikes. For
  this creature the two are equal, but for a horned one the summary would show the wrong
  number for checking the limit. Keep `bodyHeight` in `--summary`.
- "Reptile that walks on two legs": the docs do not say whether the reptile theme can pick
  `biped` by itself or what the theme's body-plan weights are; I passed `--body-plan biped`
  without looking at what the theme does unconstrained. A line in the theme docs, or
  `describe-module reptile --kind theme`'s weights, would answer it.
- The description calls it "horizontal body", fine; but there is no flag that makes `generate`
  prefer a raptor-like look over a plain biped. The result is plausible, with a small head and
  arms, and the head view shows a slightly bulbous skull. Not an error.

Error messages: probed `--min-height 1.5 --max-height 1.2`; it returns `cannot_generate`,
"minHeight 1.5 is above maxHeight 1.2", with path `constraints.minHeight`. Clear, though
there is no `fix` field on that error (others have one).

## v11-hydra-litter (three different mutants of hydra.json, five heads, no wings)

Commands:

```sh
for s in 11 12 13; do pnpm -s spawnforge mutate examples/hydra.json --seed $s --amount 0.3 --out v11.$s.json; done
pnpm -s spawnforge analyze v11.$s.json --summary          # each: heads 5, wings 0, no warnings
pnpm -s spawnforge render v11.$s.json --views 3/4,front,top --size 400
pnpm -s spawnforge diff v11.a.json v11.b.json             # 45 ops; b vs c: 51 ops
```

Saved seeds 11, 12, 13 as a, b, c. All have `neck.count` 5, no wings, no `head_intersection`
or other warnings, and look clearly like five-headed hydras from the front and top views.

What worked first time: the doc's promise that mutation never changes head, tail or limb counts
held for all three, so no retries were needed; I still counted with `analyze`
(`measurements.counts`) rather than trust it.

What was confusing or harder than it should be:

- No way to ask for a litter. I picked three seeds and then confirmed they differ with `diff`
  (45 and 51 ops apart). Seed 11 swapped the `crest` from `spikes.row` to `sail` and made the
  neck cross-section `tall`, a clear difference; seeds 12 and 13 are subtle (neck length,
  curl, tooth size), and a viewer would call 12 and 13 similar. `--count 3` that returns
  deliberately spread children, or a distance score in the output, would help.
- All three keep the parent's `name` ("Marsh Hydra") and `seed` (505), as the docs say; a litter
  of files with identical names is awkward in a gallery. A `--name` option on `mutate`, or a
  line in the docs pointing to `patch set name`, would be useful.
- The part swap on seed 11 (spikes to sail) is allowed by the "same slot and shared tag" rule,
  but it is not what someone asking for "mutants of the hydra" with five heads probably pictured.
  I left it in (it is valid, looks fine, and gives the litter variety); `--keep-parts`
  would have prevented it.
- The doc warns "a mutated hydra's necks can fan into each other", so I ran `analyze` on each.
  Good advice, but `mutate` itself prints `warnings: []` and no hint that motion is unchecked;
  a one-line `note` in the mutate output ("run analyze: motion not checked") would remind
  people who skip the docs.

Error messages: probed `mutate` on a species file; the error ("this is a species ... mutate
works on one creature", fix "spawnforge instantiate species.json --seed 1") is a model
example of a helpful message. A lock path typo (`--lock skin,limb`) gives the `unknown_lock`
warning with a suggested format, also good, but it still exits ok and writes the file.

## Across tasks

- Everything I needed was in blueprint.md; the "Species and variation" section is the
  strongest part of the docs. The one gap was the combination of lock sub-paths and units
  (see v03).
- `--out` on `mutate`, `generate`, `instantiate` and `patch` made it easy to keep every attempt
  in the scratch folder, and none of the commands touched `examples/`.
- Output of `mutate` and `diff` is JSON with human-readable `diff`/`changes` arrays, which
  was readable; the raw `ops` in `diff` (multi-line objects) is the part that floods the
  terminal when printed unfiltered.
