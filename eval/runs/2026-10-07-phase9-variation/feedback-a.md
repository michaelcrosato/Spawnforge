# Feedback A (tasks v01, v04, v09, v12)

Worked only from docs/blueprint.md, docs/catalog.md, README.md, examples/ and the CLI. All saved
blueprints validate with `ok: true`, no errors and no warnings. `v09.json` also lists one
`notBuilt` entry (flying, milestone 10.4) on purpose.

## v01-wolf-species

What I did:

1. Read `examples/grey-wolf.json` and copied it as the base of the species, because a wolf
   already exists there.
2. Wrote `v01.species.json` by hand:
   - `scale: { "min": 0.9, "max": 1.3 }` (scale is the torso length in metres).
   - `limbs[id=foreleg].length` 0.55 to 0.7, `limbs[id=hindleg].length` 0.57 to 0.72.
   - Ear `params.length` 0.08 to 0.15 and `params.width` 0.03 to 0.05.
   - `skin.palette.base: { "min": "#55575a", "max": "#a3a5a6" }`.
3. `pnpm -s spawnforge validate eval/runs/.../v01.species.json --quiet`: ok, it checked the
   all-min and all-max extremes and seeds 1 to 4.
4. `pnpm -s spawnforge instantiate .../v01.species.json --seed N --out .../v01.{a,b,c}.json` for
   seeds 1, 2 and 3.
5. `analyze` on each individual found `limb_intersection` warnings (a foreleg or hindleg 1 cm into
   the torso). Seeds 1 and 2 showed it, seed 3 did not. I raised `limbs[id=foreleg].splay`
   14 to 20 with `patch`, which moved the warning to the hindleg. I then added
   `limbs[id=hindleg].splay` 6 (one warning left on seed 1) and then 12 (clean). I re-ran
   `instantiate` after every patch.
6. Rendered seeds 1 and 3 (side and head) to check the size difference.

Result: torso 0.914, 1.14 and 1.23 m; foreleg 0.56, 0.60 and 0.69; ear length 0.104, 0.081 and
0.086; base colours #6a6c6e, #717376 and #77797c.

Confusing or missing:

- **`validate` on a species does not find what `analyze` finds.** The species passed validate
  with no warnings at both extremes and four seeds, but two of the three individuals then had a
  `limb_intersection` warning in `analyze`. The all-min and all-max checks only compile; they do
  not run the motion checks. Either add the analyze warnings to the species check, or say in
  the docs that a species must be checked with `analyze` on a few individuals. I had to
  instantiate, analyze and patch the species in a loop.
- **Intersections depend on the drawn range.** A leg length that is fine on one individual
  clips the torso on another, and the fix (`splay`) has to suit the whole range. A hint in
  the docs would help: if the leg range is wide, check the smallest and largest torso.
- **The warning's fix moved the problem.** "about 5 degrees more splay works best" on the
  foreleg made the hindleg hit the body on the next run. It is correct as a local fix, but
  after the patch I had to analyze again. Nothing suggested a combined value.
- **Shade of colour.** The docs say a colour range picks "a colour between the two", but not how
  (per channel, along the line between them?). The three individuals landed close together
  (#6a6c6e, #717376, #77797c) although my range ran from #55575a to #a3a5a6. All three are
  in the low half of the range, so I could not tell whether the draw is uniform. A short sentence
  on the distribution would help. A greyscale range also varies in lightness only, so "shade" is
  easy to get, but a hue shift would need a second range.
- `mass` for these wolves is 117, 227 and 289 kg (a real grey wolf is about 40 kg). Docs say
  sizing follows `scale`, which is fine, but nothing warns that a 1.2 m torso wolf is a 2.6 m,
  290 kg animal. `analyze` also does not flag it as implausible. The task asked for torso 0.9
  to 1.3, so I kept it.
- `instantiate` renames the individual to "Grey Wolf Pack #1" and replaces the `seed` with a large
  number (1905089677) rather than keeping the species' own `seed` or the given one (1). The docs
  say nothing on this. It is useful, but a sentence on how `name` and `seed` are set would help.
- It worked first time with no help from error messages; there were no errors to read.

## v04-troll-beetle

What I did:

1. `crossbreed examples/bog-troll.json examples/ember-beetle.json --seed 1 --mix 0.3 --base a
   --lock body.torso,limbs --out ...`: the child kept the troll's body, but the neck `pitch`
   dropped from 82 to 47.7, the tusks were removed, `warts` turned into `grime`, and nothing
   visibly came from the beetle. So the lock list was not enough and the result was not "visibly
   beetle".
2. I added `body.neck` to the lock and looped `--seed 1..12` at `--mix 0.35`, printing parts,
   layers, material and actions of each child with a small node script.
3. Seed 5 was the best: a nose `horn` (the beetle's `horn.curved`), `spots` and `bioluminescence`
   layers on the back, `material: chitin` instead of `hide`, and a `bite` action, while the
   troll's upright biped body, legs, arms with hands and tusks all stayed.
4. Final command:
   `crossbreed examples/bog-troll.json examples/ember-beetle.json --seed 5 --mix 0.35 --base a
   --lock body.torso,body.neck,limbs --out eval/runs/2026-10-07-phase9-variation/v04.json`
5. `validate`, `analyze` (no warnings, 1.8 m tall biped, 164 kg) and a rendered contact sheet
   (upright troll with a beetle horn, chitin sheen and glowing orange spots).

Confusing or missing:

- **Which paths to lock is guesswork.** The doc says to lock what must not change
  (`--lock body.torso,limbs`) but not that `body.neck` carries posture too. With that lock only,
  the neck pitch went 82 to 47.7 and the troll stooped. The docs mention that "posture blends too
  (torso and neck pitch)" but I only linked it to the neck after reading the diff. An example
  lock line for "keep an upright biped" would help: `body.torso,body.neck,limbs`.
- **The crossbreed result is lottery-like.** At `mix` 0.3 to 0.35, many seeds give a child with
  little or nothing from the beetle (seed 1 had no horn, spots or luminescence at all, seed 4 only
  a chitin sheen), and others drop the troll's tusks and teeth. I needed a loop over seeds to find a good one. A `--take`
  option (or a way to say "bring the beetle's parts over") would remove this. The docs say
  unpaired parts come over "by chance" and give no odds.
- The child also lost the troll's `teeth` part and the eyes' `lids`, and the head changed shape
  (`flat` to `round`). These show only in the diff list, which is long. The diff is good, but I
  would like a short "from a / from b" summary at the end of the result.
- `mix` is "the share from b", but part inheritance does not seem to follow it. At 0.35 I got
  a nose horn and glowing spots but also the beetle's `chitin` material and `round` head.
  "Mostly troll" is satisfied by the body (torso, limbs, neck, arms, tusks), not by the skin.
- The `written` path is printed relative when `--out` is relative, but absolute when I gave
  an absolute path. That is fine, only noting it.

## v09-flying-dragon

What I did:

1. `generate --theme dragon --seed 1 --requires air --max-height 1.2 --out ...`: result ok,
   `bodyHeight` 1.2 exactly. `analyze` then gave a `below_ground` warning on the tail, and the
   wing was `membrane.feather`.
2. Because `bodyHeight` of exactly 1.2 is on the limit, I regenerated seeds 1 to 8 with
   `--max-height 1.1` and ran `analyze` on each, printing `bodyHeight`, wingspan and warning codes.
   Only seeds 4 and 8 (wyverns) were clean. Seed 3 (a quadruped with leathery wings, horns, spikes
   and a long neck) had one `limb_intersection` on the foreleg.
3. I took seed 3 and ran `patch` with `limbs[id=foreleg].splay` 10. Splay 5 left a 1.0 cm
   intersection, 10 cleared it, 14 and 18 moved it to the hindleg.
4. I added `motion.media.air: true` by `patch`, so the file says it flies. Then `validate`: ok,
   with one `notBuilt` entry for flying.
5. Final: `bodyHeight` 1.07 m, wingspan 3.28 m, 2.3 m long, leathery wings, no warnings.
   Rendered with `--pose spread` to see the wings open.

Confusing or missing:

- **`generate --requires air` does not write anything that says "flies".** The file has a wing
  limb and no `motion.media`; the doc says the wing implies air, which is true, but
  `generate`'s result also has no sign that the requirement was met. I added `media.air: true`
  myself. I would like the output to say `"requires": ["air"]` met, or to write the switch.
  Also flying is not drawn yet (10.4), so "a dragon that can fly" can only mean "has wings and
  the air medium on". The task text and the docs could say so up front: the Not drawn yet table
  does say it, but only far down the page.
- **`bodyHeight` vs `height` is backwards from the docs.** The docs say `--max-height` is the body
  height, "not counting horns or spikes, the same as analyze's bodyHeight; its height counts
  them". In my files `height` (0.754 m) is smaller than `bodyHeight` (1.07 m), and the render
  header says "1.1 m tall". I think `bodyHeight` includes the raised neck and head while `height`
  is something else (maybe the withers or the top of the back), but the docs do not say. It took
  me a while to be sure which number a "no taller than 1.2 m" limit applies to. I used
  `bodyHeight` and left a margin.
- **The generated height is exactly the limit** (1.2 with `--max-height 1.2`), because the
  creature is rescaled to fit. A rounding error could put it a hair over. A small margin
  would be safer.
- **Generated creatures are not warning-free.** `generate` returns `warnings: []` and
  `attempts: 1`, but `analyze` then finds `below_ground` (seed 1) or `limb_intersection` (seeds 2,
  3, 5, 6, 7) on most seeds. It would be better if `generate` ran the same checks and tried
  another attempt (it already has an `attempts` field), or listed these as warnings. Same issue
  as with species validation in v01.
- "A dragon" came out as a feathered-wing quadruped on seed 1 (membrane.feather) and a wyvern
  on seeds 4 and 8. Nothing in the docs says which seeds give leathery wings; I scanned. A
  `--wings bat` or `--parts` style choice for the membrane would help.

## v12-armoured-horror

What I did:

1. Generated eldritch creatures for seeds 1 to 24 (`generate --theme eldritch --seed N --out ...`)
   and printed `body.neck.count`, tentacles and parts for each. The theme text says "many-headed
   hounds", and most seeds do have 2 or 3 necks (heads). Serpents with two heads often have
   `heads_overlap` and `head_intersection` warnings, so I preferred a quadruped with three heads.
2. I ran `analyze --stats rpg` on 11 candidates to read their `defence` (5 to 10 before
   armour). Seed 7 ("Azoth": quadruped, 3 heads, hide, head tentacles, no warnings) had
   defence 10.
3. `patch eval/runs/.../v12.json '[{"op":"add","path":"parts","value":{"id":"shell","type":"shell"}}]'`
   (an area part needs no `attach`; `describe-module shell` showed the defaults).
   `analyze --stats rpg` now gives defence 22, no warnings. The `armor.bands` alternative on
   the same body gave defence 12 (tried in a scratch copy), so a shell is the safer way over 12.
4. Rendered it: a purple three-headed quadruped with a domed scuted shell over the back.

Confusing or missing:

- **Nothing says how many heads a theme gives.** The catalogue's eldritch entry lists parts and
  body plans, but not `neck.count`, so I had to generate many seeds and read `body.neck.count`
  myself. The doc text "many-headed hounds" is the only hint. A `generate --min-heads 2` option
  (like `--min-height`) would remove this loop.
- **Five of the 24 seeds (10, 17, 19, 20, 22) had no `body` key at all**, so my script crashed
  on `b.body.neck`. The file is valid (all defaults come from the preset), but "no `body`" means
  the heads count is implicit (one head). Counting heads from a file therefore needs a fallback.
  Probably known, but worth a line in the docs.
- **`rpg` defence is not documented numerically.** The stats module says "defence from shells,
  plates and bands of armour, skin material, spikes and size", with no formula. I got 10 to 22
  by trial and error: `armor.bands` raised it by 2 on a hide body, `shell` by 12. A table
  of contributions in `describe-module rpg` would help.
- `analyze --stats rpg` prints the numbers under `stats.values`, but the catalogue does not
  show the output layout. I found it by looking at the JSON.
- The eldritch seed 7 has a `feelers` tentacle limb on the head; the `shell` and tentacle did
  not conflict. No problems.

## General

- The `--help` text and the docs were enough to do everything. The most useful pieces were
  the `Species and variation` section in blueprint.md, the `diff` output of `crossbreed`, and
  `patch` for small fixes.
- Every task needed a loop over seeds, written by me in shell and node, to find a good result,
  and then an `analyze` loop for warnings. A `--analyze` or `--check` flag on `generate`,
  `crossbreed`, `mutate` and `instantiate`, which fills `warnings` with the motion checks,
  would remove most of that work.
- `render` takes about 11 s with `--size 400` and writes the PNG next to the input file, so I
  copied blueprints into the scratch folder to avoid putting PNGs in the run folder. A `--out`
  is documented in `--help` and I did not need it, but I mention that the default location is
  easy to forget.
