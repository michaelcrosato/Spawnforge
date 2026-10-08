# Feedback B: variation tasks v02, v05, v07, v10

I used only README.md, docs/blueprint.md, docs/catalog.md (selected sections), examples/ and the CLI. Every
saved file validates with `ok: true`, no errors and no warnings, and `analyze --summary` shows no warnings for any
of them. Renders took about 14 s each. Everything worked without a crash; the notes below are friction.

Files: `v02.json`, `v05.json`, `v07.a.json`, `v07.b.json`, `v07.c.json`, `v10.json`.

## v02-small-demon

Commands:

```sh
pnpm -s spawnforge generate --help
pnpm -s spawnforge generate --theme demon --seed 1 --max-height 1 --actions bite,roar --out s/v02-try1.json
pnpm -s spawnforge analyze s/v02-try1.json --summary
for s in 2 3 4; do generate --theme demon --seed $s --max-height 0.9 --actions bite,roar --out s/v02-s$s.json; analyze ...; done
pnpm -s spawnforge render s/v02-s4.json --out s/v02-s4.png --labels
cp s/v02-s4.json eval/runs/2026-10-08-gate12-variation/v02.json && validate --quiet
```

Final: theme demon, seed 4, `--max-height 0.9` (a quadruped with coiled horns; `bodyHeight` 0.90, `height` 0.902).

What worked first time: `generate` with `--max-height` and `--actions` accepted the flags as documented, and it
printed `bodyHeight` in its own result. The creature looked like a demon in the render (goat pupils, coiled horns,
fangs, stripes).

Confusing or harder than it should be:

- **Two heights.** `--max-height 1` on seed 1 reported `bodyHeight: 0.93`, but `analyze` said `"height": 1.093` and
  the description said "1.1 m tall" because the spike row counts. The docs do say `--max-height` ignores horns and
  spikes (and name `analyze`'s `bodyHeight`), so the demon was within the letter of the task, but a person reading the
  description sees "1.1 m tall" for a creature that was asked to be at most 1 m. I could not tell which figure the
  task meant, so I picked a seed whose `height` and `bodyHeight` both come out under 1 m, by asking for 0.9. The
  doc nudge: say in the task-level text that a "no taller than N m" ask is safest as `--max-height` a bit under N,
  or add a `--max-total-height`.
- **`analyze --summary` leaves out `bodyHeight`.** It prints `height` (which counts spikes) but not the figure that
  `--max-height` constrains. I had to run the full `analyze` and grep for it. Add `bodyHeight` to the summary.
- **`generate` output does not show the height that counts**, only `bodyHeight`, and its `measurements.length` is
  odd: it was 0.277 for a 0.9 m biped (seed 2) and 2.39 for a quadruped. For the biped this is not the creature's
  length in any sense I could relate to the render. Name it (footprint?) or drop it.
- **Actions are not in the generated file.** The docs say `--actions bite,roar` leaves `motion.actions` out ("every
  action the body allows"). So `v02.json` contains no mention of bite or roar. I could only confirm them through the
  `analyze` description ("it can bite, jump, lash, look, pounce and roar"). It would help if `generate`'s result echoed
  `"actions": ["bite","roar",...]` so a checker does not have to run `analyze`.
- `"attempts": 1` in the `generate` result is unexplained in the docs (I guess retries to meet constraints).
- With the same flags, seeds 2 and 3 gave bipeds that stand 0.9 to 0.95 m and weigh 14 to 15 kg, while seed 4 gave a 158 kg
  quadruped, about 2.4 m long. "Small" in the task suggests something compact; `--body-plan biped` is the only
  way to steer this, and it is easy to miss that the constraint rescales the whole creature rather than choosing a
  small one.

## v05-horned-insect

Commands:

```sh
for s in 1..8: generate --theme insect --seed $s --out s/ins-$s.json     # then read parts out of each file with node
pnpm -s spawnforge render s/ins-2.json --out s/ins-2.png --labels --views 3/4,side,head
pnpm -s spawnforge render s/ins-6.json --out s/ins-6.png --labels --views 3/4,side,head
pnpm -s spawnforge patch s/ins-6.json '[{"op":"set","path":"parts[id=horn].params.length","value":0.45},
    {"op":"set","path":"skin.palette.base","value":"#181519"}]' --out s/v05-try.json
pnpm -s spawnforge render s/v05-try.json --views 3/4,side,head --size 600
pnpm -s spawnforge patch s/v05-try.json '[{"op":"set","path":"skin.palette.belly","value":"#2e2832"}]' --out eval/.../v05.json
pnpm -s spawnforge validate eval/.../v05.json --quiet
pnpm -s spawnforge diff s/ins-6.json eval/.../v05.json
# afterwards, to report on the tooling:
generate --theme insect --seed N --parts horn.curved
```

Final: insect seed 6 ("Tiktin"), horn length 0.252 -> 0.45, `palette.base` #84168c -> #181519, `palette.belly`
#cd81b9 -> #2e2832. The render shows a glossy black ant-like beetle with a long horn; the shape still reads.

What worked first time: the `patch` paths (`parts[id=horn].params.length`, `skin.palette.base`) and the diff it
printed; `diff` confirmed `exact: true`.

Confusing or harder than it should be:

- I found the horned insect by generating eight seeds and reading each file's `parts` by hand (about half of them
  had a `horn`). Only after saving did I try `--parts horn.curved`, which is documented in the flag list and
  guarantees one (seeds 1, 3, 4 and 5 all came back with a horn; seed 5 also has mandibles). The task text
  ("find a generated insect that has a horn") reads like a search, and nothing in the insect theme's entry in the
  catalogue says "horn: chance 0.4" can be forced with `--parts`. A line in the `generate` docs, "to be sure of a
  part, pass `--parts`", would save the scan.
- **Generated horn lengths straddle the target.** The generated horns were 0.25, 0.30, 0.32, 0.325 long, so seeds 1
  and 2 already meet "at least 0.3". To make the edit meaningful I used seed 6 (0.252) and went to 0.45. I did not
  see a way to ask `generate` for a horn at most a given length.
- **A near-black base leaves a coloured belly.** The generated blueprint has no `skin.layers` (the `hexapod` preset
  supplies them), so after the first patch the render still showed a pink belly from `palette.belly`. I only
  guessed from the picture that the preset's countershade uses `belly`. `validate` (without `--quiet`) would show
  the resolved layers, but the task did not suggest it. I darkened `belly` too so the body reads as near black.
- The doc warning about very dark bases ("a base near black loses its shape in renders") did not bite here: #181519
  reads fine because of the chitin gloss. A concrete "how dark is too dark" number would help (`#000`-`#111` is
  said to lose shape; I used a base of about 9% brightness and it worked).

## v07-viper-litter

Commands:

```sh
pnpm -s spawnforge mutate examples/reed-viper.json --seed 1 --amount 0.4 --lock 'skin.layers[type=stripes]' --out s/viper-1.json
for s in 11 12 13: mutate ... --seed $s --amount 0.5 --lock 'skin.layers[type=stripes],parts[id=fangs]'
for s in 21 22 23: mutate ... --seed $s --amount 0.6 --keep-parts --lock 'skin.layers[type=stripes],parts[id=fangs]'
pnpm -s spawnforge render s/vk-21.json --views 3/4,top,head --size 500      # and 22, 23
pnpm -s spawnforge analyze eval/.../v07.a.json --summary                    # warnings
for s in 31..38: mutate ... --amount 0.6 --keep-parts ... ; analyze --summary      # screening
for s in 41..50: mutate ... --amount 0.7 --keep-parts ... ; analyze --summary      # screening
pnpm -s spawnforge diff examples/reed-viper.json s/vn-41.json
pnpm -s spawnforge diff v07.a.json v07.b.json                                       # (and a/c, b/c) to check they differ
```

Final: seeds 41, 45 and 46 at `--amount 0.7 --keep-parts --lock 'skin.layers[type=stripes],parts[id=fangs]'`,
saved as v07.a, v07.b and v07.c. They are 2.1 m, 1.7 m and 1.3 m long, with different colours, body widths and
eye shapes; all three keep the parent's stripes layer exactly (`count` 24, `width` 0.25, `region` "back"), all validate
clean and `analyze` is clean for all three.

What worked first time: the lock syntax (a comma list of two bracket paths, quoted) and `--out`. The result prints
a gene-by-gene diff, which made it easy to see how different each child is. Without any lock, 6 test seeds at
amount 0.7 all kept a `stripes` layer (so a lock is a guarantee, not a necessity).

Confusing or harder than it should be:

- **A mutated viper can lose its fangs.** The docs say "so a viper stays a scaled snake with fangs", but at
  `--amount 0.4` seed 1 changed `parts[id=fangs].params.fangs` from 1 to 0 (the row has `incisors` 0, so that leaves a
  toothless snake), and with unlocked parts at amount 0.7 seed 66 removed the `fangs` part entirely. The
  guard in the docs is about switches (`head.jaw`, `lower`/`upper`), not parameters or part removal. I locked
  `parts[id=fangs]`; that is a reasonable thing to need, but the sentence over-promises.
- **Structural changes are odd on a snake.** Without `--keep-parts`, seeds 12, 13 and 63 added a `quills` part to the
  viper's spine. That fits the doc ("a part is added"), but quills on a reed viper do not read as a viper. I used
  `--keep-parts`, which is documented, but I only noticed after looking at diffs. The docs could suggest
  `--keep-parts` for "same animal, different individual".
- **How different a mutant is depends a lot on the seed.** At `--amount 0.6`, seeds 32, 33, 36 and 37 changed only
  about 3 to 6 genes (a palette colour, plus `motion.actions[0]: "bite" -> {"type":"bite","reach":...}`, which is
  a string turned into an object with a tiny value change), so they would not have counted as "three different
  mutants". At 0.7 every seed changed 23 to 30 genes. A `--amount` that gives similar change counts for every seed, or
  a count of changes in the result, would have saved me from diffing each one. The diff lines for action
  normalisation (`"bite"` -> object) look like changes but are mostly noise.
- **`ground_penetration` shows up in about half of the mutants.** The parent is clean, but mutants at amount 0.5 to
  0.6 (seeds 21, 22, 31, 34, 35, 38, and seed 43 at 0.7) warned "the head goes 2 to 3 cm into the ground on flat ground"
  and seed 48 "the tail goes 2.3 cm into the ground". The docs do say that `mutate` checks validity, not motion, and to run
  `analyze` on the child, and I did. The fix text ("raise the section (pitch, curl), lower the torso pitch or make
  it slimmer") is generic; for a legless serpent the useful handle is `body.neck.pitch` (the parent has 10), which
  the message does not name. I just re-rolled seeds instead of patching.
- The three mutants all keep `"name": "Reed Viper"` and the parent's `seed`, as documented. Fine, but it makes the
  three files hard to tell apart in a gallery; a `--name` or an automatic suffix would help.

## v10-winged-wolf

Commands:

```sh
pnpm -s spawnforge crossbreed --help
pnpm -s spawnforge crossbreed examples/grey-wolf.json examples/griffin.json --seed 1 --mix 0.5 --base a \
    --lock 'limbs[id=foreleg],limbs[id=hindleg]' --out s/wg-1.json        # no wings on this seed
for m in 0.5 0.7: for s in 1..8: crossbreed ... --seed $s --mix $m ...     # then read limbs/parts from each file with node
pnpm -s spawnforge analyze s/wg-0.5-5.json --summary                       # wing_intersection warning
pnpm -s spawnforge patch s/wg-0.5-5.json '[{"op":"set","path":"limbs[id=wing].attach.angle","value":22}]' --out s/wg-fix1.json
pnpm -s spawnforge render s/wg-fix1.json --views 3/4,side,front --size 500
pnpm -s spawnforge render s/wg-fix1.json --views 3/4,front,top --pose spread --size 500
pnpm -s spawnforge diff examples/griffin.json eval/.../v10.json
```

Final: `crossbreed grey-wolf griffin --seed 5 --mix 0.5 --base a --lock 'limbs[id=foreleg],limbs[id=hindleg]'`, then
one `patch` of the wing's `attach.angle` from 28 to 22. The child ("Grey Wolf x Griffin") is a 2.5 m, 210 kg quadruped with
the wolf's `foot.paw` legs exactly as the wolf has them (4 toes, short claws, `padColor`), the griffin's feathered
wings (`membrane.feather`, 22 feathers, span 4.9 m, `speed.fly` 32 m/s), the wolf's ears and teeth, and bite and roar.
Rest and `--pose spread` renders both look right.

What worked first time: the docs gave the exact recipe (lock the legs by id, not `limbs`), and it did what it said:
the wolf's paws came through untouched and `counts.wings` is 2. `--base a` kept the wolf's body.

Confusing or harder than it should be:

- **No way to ask for the wings.** Whether the child grows wings is a coin flip on the seed: with `--mix 0.5`, 5 of 8
  seeds (2, 4, 5, 6, 8) had a wing and with `--mix 0.7`, 6 of 8. The result's diff shows nothing about wings when
  they are not taken (seed 1's diff has no limb line at all), so I had to read each file (or run `analyze` for
  `counts.wings`) to find out. The docs explain the chance, but a flag such as `--take limbs[id=wing]` or an
  echo of `"wings": 0/2` in the result would be the direct way to do "make the child grow the griffin's wings".
  Re-rolling seeds works but feels like a workaround.
- **The same seeds also decide teeth and beak.** Of the five wing-bearing children at mix 0.5, four lost the wolf's `teeth`
  (seeds 2, 4, 6, 8; seed 6 also gained the griffin's beak, as did most at 0.7), so a "wolf with wings" needed another look at
  `parts`. I took seed 5, which has wings and teeth and no beak. The docs mention the teeth loss ("lock `parts` to
  keep them") but locking `parts` also stops the child getting a beak, which I did not want to depend on.
- **The crossbreed can come out with an immediate warning.** Seed 5's child was valid, but `analyze` warned
  `wing_intersection`: "wing.L passes 1.9 cm into the torso while flying". The griffin's wing attach (angle 28) is
  copied verbatim onto the wolf's body, which is a different shape. The fix hint ("attach it higher (a lower
  attach.angle)...") worked in one try (28 -> 22 cleared it), which is good. But a user who only runs `validate`
  on the child would miss it; the docs for `crossbreed` could say to run `analyze` for wings too (they say it for mutate).
- Minor: the child's `scale` is a blend (0.9 and 1.2 gave 1.05 in seed 1, and 1.1 in seed 5), so a "wolf-sized" child gets
  bigger without any note. `analyze` gives a `walk` speed of 0.6 m/s for a 1.1 m-tall body, which seems slow, but I did not dig
  into it or compare with the wolf.

## Overall

- The best part: errors and warnings carry paths and fixes, `--out` on `patch`, `mutate`, `crossbreed` and
  `generate` lets scratch work stay out of the repo, and `diff` confirms an edit changed only what was meant.
- The recurring theme is that the variation commands do not report the outcome I was asked about (bite/roar
  present, wings present, horn length, stripes present, `bodyHeight`); each time I opened the JSON or ran
  `analyze` to find out. A short "has" summary in each result (actions, counts of wings, heads, tails, the first
  warnings from `analyze`) would remove most of that.
- The scratch loops (seed scans plus `analyze` screening) took a few minutes each. A `--count N` flag on `mutate` and
  `generate` that writes N files and prints each one's change count and warnings would suit a litter or a search.
