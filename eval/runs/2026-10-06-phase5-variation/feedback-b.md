# Evaluator B feedback (v05 to v08)

Method: read README.md, docs/blueprint.md, docs/catalog.md and examples/ only; used only the CLI
(`node packages/cli/src/bin.ts ...`). No source code, no other eval runs. Scratch files and renders
are in `work-b/`. All six deliverables validate with 0 errors and 0 warnings.

| File | Task | Confidence |
| --- | --- | --- |
| `v05.json` | horned insect, horn 0.38, near-black body | high |
| `v06.species.json` | serpent species, scale 0.6-1.2, tail 2-3 | medium-high (see the integer-range trap) |
| `v07.a/b/c.json` | three mutants of reed-viper, all keep `stripes` | high that the layer is kept, medium that "different" is judged by a human |
| `v08.json` | bipedal reptile, 1.8 m tall | high |

## Task 1 - v05 horned insect

Commands:
- `generate --theme insect --seed N --out work-b/insN.json` for N = 1..8, then listed each file's `parts`.
- `generate --theme insect --seed 3 --parts horn.curved` as a cross-check.
- Chose seed 6 (horn length 0.252, so "longer" is a real change). Copied to `v05.json`, then one `patch`:
  `parts[id=horn].params.length` -> 0.38, `skin.palette.base` -> `#0b0b0d`, `belly` -> `#1a1a1e`, `accent` -> `#2a2a32`.
- `validate`, `analyze` (no warnings; description says "black chitin and a charcoal belly"), `render --views 3/4,side --size 400 --labels`.

What worked: `generate` and `patch` were smooth. The id-based path `parts[id=horn].params.length` worked
first time. The render shows a black insect with a forward-curved nose horn.

What confused me:
- "Has a horn" is ambiguous. The insect theme (catalog `### insect`) has two `horn.curved` parts: `horn`
  (chance 0.4) and `pincers` (chance 0.35). `--parts horn.curved` would be satisfied by pincers alone, so it
  cannot be used to ask for the nose horn. I looked for part id `horn` in each generated file instead. Unconstrained,
  seeds 1, 2 and 6 had a `horn`, seeds 5 and 7 had only `pincers`, and seeds 3, 4 and 8 had neither. Seed 3 with
  `--parts horn.curved` gave both a `horn` and `pincers`.
- Seed 1 already had a horn of 0.302, which already meets "at least 0.3", so I picked another seed to make the edit meaningful.
- The `seed` inside the generated file is not the `--seed` I passed (`--seed 6` gave `"seed": 508134466`).
  Harmless but surprising; docs only say "the same theme and seed always give the same creature".
- "Body colour": I assumed `palette.base`. I also darkened `belly` and `accent` because `countershade` blends toward
  `belly` and would otherwise show a pale underside. The docs never say which palette entry "body colour" means.
- The generated blueprint is sparse: the head and legs only list overrides of the hexapod preset, and the part `eyes`
  has no `type`. That is fine once you know merge-by-id, but a first read of the output looks incomplete.

## Task 2 - v06 serpent species

Commands:
- Wrote `v06.species.json` by hand (`extends: serpent`, `scale` and `body.tail.length` as ranges, plus skin and motion).
- `validate` -> `{"ok": true, "species": true, ...}`.
- `instantiate v06.species.json --seed 1..120 --out ...`, then `validate` on every individual: all valid.
  Checked each one's `scale` and tail length. `analyze` and `render` on the two extremes (0.6 m / 2.0 tail and 1.2 m / 2.999 tail): no warnings.

What failed (the main finding of this task): my first file used `"tail": { "length": { "min": 2, "max": 3 } }`.
`validate` said ok, but every individual had a tail length of exactly 2 or exactly 3 and nothing in between
(seeds 1..40: 20 got 2, 20 got 3). The doc passage is in "Species and variation":
"`instantiate` ... resolves every range for a seed; integers stay integers when both ends are."
`body.tail.length` is a `number` in catalog.md (range 0-4, default 0.6), not an integer field, but the draw is decided by
whether both JSON endpoints look like integers. `2.0` / `3.0` do not help (JSON parsing makes them 2 and 3). The tool said
nothing: no warning, no hint. Workaround I used: `{ "min": 2, "max": 2.999 }`, which gives a continuous spread
(2.01 .. 3.0 over 120 individuals). The scale range `{0.6, 1.2}` was never affected because the endpoints are not integers.
This will bite anyone who writes `{ "min": 1, "max": 2 }` for a size.

Other notes:
- `analyze`, `render` and `patch` all reject a species file with "expected number, got object" (for example
  `scale: expected number, got object; body.tail.length: expected number, got object`). Nothing says "this is a species,
  run `instantiate` first", and `patch` cannot edit ranges (`scale.max` is treated as a path into a number). Only `validate` understands species.
- `validate` on a species returns only `ok/species/errors/warnings`. It does not say which seeds or endpoints it tried,
  so I ran my own 120-seed loop to be sure.
- `instantiate` omits any value that equals the preset or default. Two individuals had no `body` block because their
  tail drew exactly 2.2 (the serpent preset default), which broke my first checking script. Fine, but not mentioned in the docs.
- Serpent size sanity: with scale 1.2 and tail 3 the serpent is about 5.1 m long and 23 cm tall. The doc's rule
  "a serpent about 3.5 x scale" holds (3.7 m for scale 1.07).

## Task 3 - v07 viper litter

Commands:
- `mutate examples/reed-viper.json --seed S --amount 0.3|0.5|0.7|1 --out ...` for many seeds; counted how often the
  stripes layer survives (unlocked, 25 seeds at amounts 0.3, 0.7 and 1: kept 25/25 each time, so layers never seem to be removed).
- Final: seeds 44, 39 and 46, `--amount 0.5 --lock "skin.layers[1]"`, written to `v07.a.json`, `v07.b.json`, `v07.c.json`.
  Each `validate` ok, `analyze` clean, and each file still holds `{"type":"stripes","count":24,"width":0.25,"jitter":0.2,"region":"back"}`.
  Rendered each.

What worked: `mutate --out` writes a normal blueprint and prints a readable gene-by-gene diff. Results differ from each
other and from the parent (a: scale 0.98 and shorter tail; b: scale 0.5, paler olive and a new `horns` part; c: darker
colours, "tall" tail cross-section).

What confused me or failed:
1. The lock path form I expected does not work, silently. The docs for `patch` say layers are found "by type
   (`skin.layers[type=mottle]`...)", and the mutate paragraph says "`locked` paths, such as `skin`, `body.head` or
   `parts[id=horns]`". So I tried `--lock "skin.layers[type=stripes]"` (also `skin.layers[id=stripes]`). The command returned
   `ok: true` and the stripes layer still mutated (`skin.layers[1].jitter: 0.2 -> 0.201`). `--lock "skin.layers[1]"`, `skin.layers`
   and `skin` do work. A nonsense path (`--lock nonsense.path`) is accepted with no warning either. The docs should list which path forms
   a lock understands, and the tool should warn on a lock that matches nothing.
2. A "kept" stripes layer can be invisible. Seed 42 gave `base #4c453d` with `accent #4a513a`: the layer is still there
   but the render shows almost no stripes. Neither `mutate`, `validate` nor `analyze` warns about low contrast between base
   and the stripe colour. I picked seeds by computing the base/accent luminance difference myself. Locking `skin.palette`
   (or `skin`) avoids it but removes colour variation.
3. Without a lock, `mutate` also writes `fangs: 0` on some children (a viper without fangs) and adds `ears` to a snake
   (seed 33). The docs say parts are swapped "for one with the same slot and a shared tag", but ears on a serpent are odd;
   `--keep-parts` exists in `--help` but is not in blueprint.md.
4. `mutate` output keeps the parent's `name` ("Reed Viper") and `seed` (314), so three litter-mates are indistinguishable
   by name or seed. They differ only in parameters.
5. `analyze` found a `ground_penetration` warning (head 1.7 cm into the ground) on one mutant (seed 31) that `mutate` itself
   reported as `warnings: []`. I rolled other seeds. Mutation does not re-run the analysis, so a user has to.
6. The diff lists layers by position (`skin.layers[2].strength`), but the docs tell you to address layers by type, so the diff
   is harder to map back to patch/lock paths.

## Task 4 - v08 tall bipedal reptile

Commands:
- `generate --theme reptile --body-plan biped --min-height 1.5 --seed 1 --out ...` (reported height 1.551).
- Then `analyze` on it (height 1.542, headHeight 1.452), and more seeds.
- Switched to `--min-height 1.8` for seeds 1..8, compared `analyze` for each (height, head height, stability, warnings),
  rendered seeds 1 and 2 with `--views 3/4,side --size 450`, chose seed 2 (a lean raptor named Sillith) -> `v08.json`.
- `validate`, `analyze` (height 1.79, hip height 1.26, `stability.supported` true with 2 feet, one gait `walk`, foot slide 0, no warnings), `render --filmstrip` (foot slide 2.8e-7 m, duty 0.62).

What worked: the combination `--theme reptile --body-plan biped --min-height` did exactly what the docs say. The raptor
recipe in blueprint.md (horizontal torso pitch 5-20, legs at `at` about 0.6) matches what the generator produced.

What confused me or failed:
- `--min-height 1.5` is not safe. `generate` reports height 1.5 but `analyze` measures slightly less for several seeds: seed 3 gave
  1.495, seed 4 1.498, seed 5 1.491, seed 6 1.497 (head height only 1.39 to 1.41). Only seeds 1 and 2 came out above 1.5. The docs say
  `--min-height` is "body height in metres, not counting horns; the creature is rescaled to fit", and say nothing about which tool's number is authoritative.
  I used `--min-height 1.8` for margin (analyze 1.79).
- "Walks on two legs" is not stated anywhere as a check. I confirmed it from the preset (`extends: biped`, one `leg` pair, one `arm`
  pair) and `analyze` (`stability.feet: 2`, gait list only `walk`). The generated file does not record `theme`, so nothing in the file says "reptile".
- Some seeds (5, 6, 7) report `speed.walk` about 1.9 m/s while others report about 0.85 for the same kind of creature. I did not find an explanation in the docs.
- Seed 6 produced a `limb_intersection` warning; seeds 1 and 2 did not.

## Three most important problems

1. **Ranges with integer endpoints turn into coin flips.** `{ "min": 2, "max": 3 }` on a `number` field (tail length) yields only 2 or 3, and
   `validate` is happy. The docs say "integers stay integers when both ends are", but never say it applies to number fields given whole-number endpoints.
   Fix: decide integer-ness from the schema field type, or have `validate` warn "range on a continuous field has integer endpoints".
2. **`mutate --lock` fails silently, and the docs do not say which path forms it supports.** `skin.layers[type=stripes]`
   (the form `patch` accepts and the docs show) is ignored with `ok: true`; `skin.layers[1]` works; an invalid path is accepted without a warning.
   A related gap: mutation can make a kept layer invisible (stripe colour ~ base colour) or add odd parts (ears on a snake) with no warning,
   and the child keeps the parent's name and seed.
3. **Species files are second-class and the size constraint is inconsistent.** `analyze`, `render` and `patch` all fail on a species file with
   a bare "expected number, got object" instead of "this is a species; run `instantiate`", and `validate` does not say which seeds it tried.
   Likewise `generate --min-height 1.5` can produce a creature that `analyze` measures at 1.491-1.498 m; the two tools disagree by up to 0.5%,
   so a hard "at least" requirement needs a margin the docs do not mention.
