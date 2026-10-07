# Feedback B: variation tasks v02, v05, v07, v10

All six files validate with exit 0 and no warnings (`validate --quiet`), and `analyze` reports no
warnings for any of them. I rendered v05 and v10 (v10 with `--pose spread`) to check them by eye;
both look right. I read only README.md, docs/blueprint.md, examples/README.md and the example
blueprints named in the tasks, and used the CLI for everything else.

Files saved: `v02.json`, `v05.json`, `v07.a.json`, `v07.b.json`, `v07.c.json`, `v10.json`.

## v02-small-demon

What I did:

```sh
pnpm -s spawnforge list-modules --kind theme
pnpm -s spawnforge generate --theme demon --max-height 1 --actions bite,roar --seed 1 --out .../v02.json
pnpm -s spawnforge analyze .../v02.json
# bodyHeight 0.93 but height 1.093 (the spike row counts toward height), so I went lower:
pnpm -s spawnforge generate --theme demon --max-height 0.8 --actions bite,roar --parts horn.curved --seed 1 --out .../v02.json
```

The result is a quadruped (bodyHeight 0.80, height 0.96) with goat-pupil eyes, fangs, long swept
horns and a spine row. `analyze` says "it can bite, lash, look and roar".

Confusing or harder than it should be:

- **"Body no taller than 1 m" has two readings.** `--max-height` limits `bodyHeight`, which leaves
  out horns and spikes, as the docs say. `analyze` also reports `height`, which counts them. With
  `--max-height 1` I got a creature whose `height` was 1.09 m. The docs describe the difference,
  but a task written as "no taller than 1 m" does not say which one it means. I picked 0.8 so both
  numbers are under 1 m. A `generate` flag for total height, or a clearer name than `--max-height`,
  would help.
- **`generate` prints only `bodyHeight` and `length`.** It does not print `height`, so I needed a
  second `analyze` call to see whether I met the constraint. Printing `height` too would save that
  call.
- **Nothing lists what the creature can do.** The docs say `--actions bite,roar` leaves
  `motion.actions` out of the file, which means "every action the body allows". The only way I
  found to confirm bite and roar was the `analyze` description sentence, which also lists `lash` and
  `look`. `validate --expanded` does show the full action list, but that is a 600-line dump.
  Something like `analyze.actions: ["bite", "roar", ...]` would be easier to check than a sentence.
- **The theme summary promises horns, and the default seed 1 demon has none.** The summary says
  "big curled or swept horns". Adding `--parts horn.curved` fixed it. A demon theme where horns are
  usual but optional is fine, but the summary overstates it.

## v05-horned-insect

What I did:

```sh
pnpm -s spawnforge generate --theme insect --parts horn.curved --seed N --out .../iN.json   # seeds 1-12 into scratch
# picked seed 4: horn length 0.251, so the edit is real work
pnpm -s spawnforge generate --theme insect --parts horn.curved --seed 4 --out .../v05.json
pnpm -s spawnforge patch .../v05.json '[
  {"op":"set","path":"parts[id=horn].params.length","value":0.5},
  {"op":"set","path":"skin.palette.base","value":"#0a0a0c"},
  {"op":"set","path":"skin.palette.belly","value":"#1c1c22"}]'
```

`patch` worked first time and its diff output was clear.

Confusing or harder than it should be:

- **Every generated insect has two `horn.curved` parts.** One is `horn` on the head, the nose horn.
  The other is `pincers`, a `horn.curved` on the jaw. Both have type `horn.curved`, so "has a horn"
  is ambiguous. The docs say real mandibles are the separate `mandible` module, and the recipe table
  says fixed horns "do not move". A theme that makes its pincers from a fixed horn is surprising.
  I only changed `horn`. A reader of the file who looks for a `horn.curved` with
  `length >= 0.3` will see `pincers` at 0.14 to 0.23 and may be confused.
- **I had to read the generated JSON to find the part id.** `generate` does not list the parts it
  made. Seeds 1 to 12 gave horn lengths from 0.215 to 0.338. Six of 12 already met "at least 0.3",
  so "find one, then make it longer" can be satisfied without any edit.
- **Near-black body and the stripes.** The generated insect has a `stripes` layer coloured by
  `palette.accent`, which was already near black (#070410). Once the base went near black the
  stripes vanished entirely in the render. The docs say nothing about keeping pattern contrast when
  recolouring, whereas `mutate` is documented as keeping that contrast. I also darkened `belly`,
  because `countershade` otherwise leaves a pale underside, and I wasn't sure whether "body colour"
  means `base` alone. The docs could say that `base` is the body colour and that `countershade`
  and `belly` lighten the underside.
- **Which unit is "0.3 torso lengths"?** `horn.curved.length` is documented as torso lengths, so I
  wrote 0.5 directly. That part was clear.

## v07-viper-litter

What I did (the final version):

```sh
pnpm -s spawnforge mutate examples/reed-viper.json --seed {9,5,33} --amount 0.6 --keep-parts \
  --lock "skin.layers[type=stripes],body.head,parts[id=fangs],skin.material" --out .../v07.{a,b,c}.json
```

I got there in four rounds, which is the main finding here.

Round 1 was `--lock "skin.layers[type=stripes]"` only, at amount 0.4 and seeds 11, 22 and 33. All three
kept the stripes, but two of the three vipers lost their teeth:

- Seed 22 had `fangs.upper: true -> false`, so the fang row had nothing left.
- Seed 33 had `fangs: 0` together with `upper: false`.
- The serpent preset has `lower: false`, so those `teeth.row` parts had no teeth at all.

Round 2 added `parts[id=fangs]` to the locks. It did not protect the fangs.

- At seed 22 `mutate` flipped `body.head.jaw` from true to false, which deleted
  `parts[id=fangs]` and the bite action even though the part was locked.
- At seed 33 it added a `beak` to a snake.

Round 3 used `--keep-parts` and locked `body.head`. That stopped the jaw flip and the beak, but
`fangs.upper` still flipped to false on seed 22.

Round 4 is the final command above.

I then ran `analyze` on each mutant. Some of them (seeds 11 and 12, and seed 2 with a tail) had
`ground_penetration` warnings: head 1.7 cm, neck 2.6 cm or tail in the ground. `validate` was clean
for all of them. I scanned seeds 1 to 12 with a shell loop and picked three clean ones. The three
final files differ in scale (0.47, 0.76, 0.65), proportions, eye settings, colours and temperament.

Confusing or harder than it should be:

- **A lock on a part does not protect what the part depends on.** Locking `parts[id=fangs]` still
  let `body.head.jaw` flip to false, which silently removed the fangs and `bite`. No warning, and
  nothing in the docs says `jaw` is an unlocked gene that other parts depend on. It would help if
  locking a part also locked what it needs, or if `mutate` warned when it removes a lock's
  dependency.
- **`mutate` can produce a toothless viper with no warning.** `teeth.row` with `fangs: 0`, or
  `upper: false` where `lower` is already false, draws nothing, and neither `validate` nor `mutate` says so.
- **Odd flips for a snake.** `skin.material: scales -> chitin` (seed 22), `eyes.lids: false -> true`
  (seed 9, which the docs say should be false for snakes), `neck.crossSection: wide`, and a `beak`.
  Preset-aware limits would help, such as never flipping `lids` on a serpent preset or adding a beak
  to a creature with no beak in its preset. I used `--keep-parts` and locks to avoid them.
- **Locks are an awkward way to protect a creature's identity.** I ended with four locks. A single
  `--lock-identity`, or a short list of "genes that make this species", would be easier.
- **The `ground_penetration` warnings only show in `analyze`.** `validate` and `mutate` are clean.
  `generate` has an `attempts` field, which suggests it retries until the result is valid. A
  `mutate --check` or retry for body warnings would save me the scan.
- **Mutants keep the parent's name and seed.** The docs say so. All three files are named "Reed
  Viper", so only the file name tells them apart. I left it. An optional `--name` would help.
- **The lock syntax for several paths with brackets worked.** `a[type=x],b,c[id=y]` was split
  correctly. The docs show a comma-separated lock list only with plain paths, so one example with
  brackets would help. An unknown lock does come back as `unknown_lock`; I saw none.

## v10-winged-wolf

What I did:

```sh
pnpm -s spawnforge crossbreed examples/grey-wolf.json examples/griffin.json --seed S --mix 0.5 --base a \
  --lock "limbs[id=foreleg],limbs[id=hindleg],parts" --out .../v10.json     # seeds 1-8 in scratch; chose 5
```

The child kept the wolf's quadruped body and both leg pairs with `foot.paw` (toes 4, short claws,
dark pads), and gained the griffin's `wing` limb with `membrane.feather`. Its parts are the wolf's
ears, teeth and eyes, and its actions are bite, roar, look and idle. The render, spread, shows
wings about 4.3 m across, attached high on the shoulders.

Confusing or harder than it should be:

- **The doc's own recipe stops this cross.** `docs/blueprint.md` says to keep one parent's body
  with `--base a` and `--lock body.torso,limbs`. I tried exactly that on seeds 2, 4, 5, 6 and 8,
  which all grow wings without locks: **0 of 5 grew wings**, because locking `limbs` also locks out
  the other parent's wing. Locking the legs by id works (`limbs[id=foreleg],limbs[id=hindleg]`),
  and the docs never say so. This was the biggest time sink on this task. The docs should say that
  `limbs` locks wings and fins too, and give the by-id form for "keep the legs, take the wings".
- **Wings are a coin flip per seed.** At `--mix 0.5`, 5 of 8 seeds grew wings (2, 4, 5, 6, 8; not 1,
  3, 7). The docs say the count comes from one parent, with chance `mix`, but give no way to demand
  "take the wings from b". I scanned seeds with a script. A `--take limbs[id=wing]` or
  `--from-b <path>` option would make this a one-command task.
- **Without the `parts` lock the child loses or gains the wrong parts.** I compared the child with
  no `parts` lock on five seeds. The wolf's `teeth` row disappeared in 4 of 5, because the griffin
  has no teeth and unpaired parts survive only by chance. On seed 6 the griffin's `beak` came
  over, which gives a wolf with a beak. Locking `parts` keeps the wolf's parts and blocks the
  beak. The docs mention that unpaired parts "come over by chance" but not that this includes the
  base parent's own parts.
- **The child's colour moved a long way from the wolf.** With only legs and parts locked, the
  grey base (#7d8083) became a tan (#a08760) and the second mottle layer was dropped, so the
  `analyze` description says "orange skin". I did not lock `skin` because the task did not ask for
  it. A reader who wants a recognisably wolfish child must also lock `skin`.
- **The diff reports a change that is not in the file.** It shows `motion.media.air: false -> true`.
  The file has no `media` key; this is the resolved creature gaining wings. It is correct but
  confusing, because `validate` does not list flying under `notBuilt`.
- **The name is a non-ASCII "Grey Wolf × Griffin".** It rendered fine.

## Error messages

I did not hit a single error from the tools in these tasks, so there is nothing to report there.
The one place a message was missing is the silent loss of fangs and bite in `mutate` and the
silent loss of the wolf's teeth in `crossbreed`: neither command warns when a child loses a part
or an action that its parent had because of a gene flip.
