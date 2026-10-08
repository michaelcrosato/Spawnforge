# Feedback, agent A (gate 12, variation tasks)

Worked only from README.md, docs/blueprint.md, docs/catalog.md, examples/ and the CLI. Every file
I saved validates with 0 errors and 0 warnings (checked again at the end with `validate --quiet`).
Renders went to my scratch folder and I looked at them. Nothing in the run folder other than my
own files was read.

Files: `v01.species.json`, `v01.a.json`, `v01.b.json`, `v01.c.json`, `v04.json`, `v09.json`,
`v12.json`.

## v01-wolf-species

Commands:

```sh
pnpm -s spawnforge validate eval/runs/.../v01.species.json --quiet          # ok, checked min, max and seeds 1-4
pnpm -s spawnforge instantiate .../v01.species.json --seed 1 --out .../v01.a.json   # and 2 -> b, 3 -> c
pnpm -s spawnforge render .../v01.a.json --views 3/4,side --size 400 --out $S/v01.a.png
pnpm -s spawnforge analyze .../v01.a.json --summary                         # per individual
pnpm -s spawnforge patch .../v01.species.json '[{"op":"set","path":"limbs[id=foreleg].length","value":{"min":0.58,"max":0.7}}, ...]'
```

I started from examples/grey-wolf.json (copied, then replaced numbers by ranges): `scale`
`{0.9, 1.3}` (the docs say scale is the torso length in metres, so this was direct), `foreleg` and
`hindleg` `length`, the ears' `params.length` and `width`, and `skin.palette.base`
`{ "min": "#5c5f62", "max": "#a3a5a7" }`.

Worked on the first try:
- The species validated at once, and `validate` printing `checked` (min, max, four seeds) is a
  good signal. Ranges inside a limb found by id (`limbs[id=foreleg].length`) and inside
  `parts[].params` worked although the docs only show ranges on `scale`, `body.neck.length` and
  one param. A sentence saying "ranges work in limbs and part params too" would save a guess.
- `instantiate` with `--out`; all three individuals were valid, and the sheets show clear size
  differences (1.1 m to 0.72 m tall).
- Colour ranges accept hex only, as documented.

Confusing, missing or harder than it should be:
1. **Warnings the species check cannot see.** `validate` of the species was clean, but `analyze`
   on the individuals gave `limb_intersection` ("foreleg.L passes 1.6 cm into torso on rough
   ground") for the short-legged draws. It depends on leg length against body, not on scale.
   `validate` only checks validity; `analyze` takes one creature, so to find which end of a
   range misbehaves I had to instantiate each end and analyze it (about 10 s each). It took three
   rounds of narrowing the leg ranges and adding `splay` (foreleg 22, hindleg 10) before all
   three seeds were warning-free, and each narrowing changed which seed warned (the same seed
   maps to different values when a range changes). Wanted: `analyze --species file --seed n`, or
   `validate` on a species reporting analyze warnings at the min and max corners, and the docs
   saying that ranges on proportions can produce `limb_intersection`.
2. **Ranges are independent, so fore and hind legs can disagree.** One draw gave foreleg 0.694
   against hindleg 0.665, another 0.587 against 0.662. There is no way to tie two ranges together
   (a shared "leg length" gene) or to say "same as limbs[id=foreleg].length plus 0.02". The docs
   do not say whether ranges can be linked. I kept them narrow and overlapping instead.
3. **`instantiate` renames and reseeds, and the docs do not say so.** The individual's `name`
   becomes "Grey Wolf Pack #1" and `seed` becomes a derived number (1905089677 for seed 1) instead
   of the species' 101. That seems right (each wolf gets its own markings), but the Species
   section only says it "resolves every range for a seed". Say it, and say whether the markings
   differ per individual.
4. **Colour range reads subtly.** The three base colours came out #6f7274, #76797b and #7b7e80,
   all near the middle of #5c5f62 to #a3a5a7, and under fur and two mottle layers the shade
   difference is hard to see in the renders. There is no note on how a colour range is
   interpolated (straight RGB between the ends?) or how wide it has to be to read. I would
   have liked `instantiate` to print the resolved values (a "chosen" list: path and value) so I
   did not have to open the file and dig the numbers out.
5. `patch` on the species rewrote the whole file in expanded form (every array element on its own
   line). Harmless but surprising; `patch --out` does not change that.
6. Cosmetic: with scale 1.23 the "wolf" is 2.6 m long and 289 kg per `analyze`. That follows from
   the task's torso range, not a tool problem, but the individuals' `stalking` walk of 0.5 to
   0.7 m/s looks slow for a wolf.

No unhelpful error messages in this task.

## v04-troll-beetle

Commands:

```sh
pnpm -s spawnforge crossbreed examples/bog-troll.json examples/ember-beetle.json --seed 1 --mix 0.3 --base a --lock body.torso,limbs --out $S/v04.try1.json
pnpm -s spawnforge crossbreed ... --seed 1..5 --mix 0.3 --base a --lock 'body,limbs,parts[id=tusks],parts[id=teeth]'
for seed in 1..16: crossbreed ... --mix 0.35 --base a --lock '...'   # then read each child's parts and layers
pnpm -s spawnforge crossbreed examples/bog-troll.json examples/ember-beetle.json --seed 11 --mix 0.35 --base a --lock 'scale,body,limbs,parts[id=tusks],parts[id=teeth]' --out .../v04.json
pnpm -s spawnforge analyze .../v04.json --summary ; pnpm -s spawnforge diff examples/bog-troll.json .../v04.json ; render --labels
```

Result: a 2.0 m two-legged troll (same body, arms, tusks and teeth) with the beetle's nose horn on
its head, the beetle's glowing orange back spots (`bioluminescence`), orange irises, no eyelids
and a `bite` action. Render checked.

What happened:
- First attempt, `--lock body.torso,limbs`: the lock did **not** keep the troll upright. The
  neck pitch blended from 82 to 47.7, the head and neck shortened, the tusks were dropped, and
  nothing of the beetle that reads from a distance came over (only palette and iris colour).
  The docs say "lock `body.torso,limbs`" to keep a parent's body, but the neck and head are also
  part of the posture, and `body` as a whole is what you must lock. Suggest the docs say
  `--lock body,limbs` for "keep the body plan".
- **The beetle's horn arrives only by chance.** The horn does not pair with the troll's tusks (a
  different section, as the docs say), so it is an unpaired part, brought over "by chance".
  Across seeds 1 to 16 at mix 0.35, 7 of 16 children had it, and the other beetle traits (chitin
  skin, glow spots, spots) appeared in a different mix each time. There is no way to say "take
  this one part or layer from the other parent" (something like `--take parts[id=horn]`). I
  had to loop over seeds and read each child's file. Loops with a one-line summary per seed work,
  but the output of `crossbreed` does not give the part ids of the child; I wrote a node one-liner
  to print `parts`, `skin.material` and the layer types.
- **The diff lists layers by position and so misleads.** For one child it printed
  `~ skin.layers[1].type: "mottle" -> "warts"`, `~ skin.layers[2].type: "warts" -> "grime"`,
  `~ skin.layers[3].type: "grime" -> "bioluminescence"`. That reads as three layers changing type.
  In fact the troll's `mottle` was dropped and `bioluminescence` added after the rest (the final
  list is countershade, warts, grime, bioluminescence). A diff by layer type, as `patch` addresses
  them (`skin.layers[type=mottle]`), would say `- skin.layers[type=mottle]` and
  `+ skin.layers[type=bioluminescence]`. The same goes for `motion.actions[1]`.
- **Unlocked `scale` blends**: 0.9 became 0.69 to 0.86, so the "mostly troll" came out 1.6 m
  instead of 2.0 m. The `scale` lock hint is in the mutate paragraph, not the crossbreed one.
  I added `scale` to `--lock`, and the child was identical to the unlocked seed-11 child
  apart from `scale` (0.715 vs 0.9). That is good news (each gene has its own stream), but the
  crossbreed docs do not say so; the instantiate docs do.
- Eyes lost their eyelids (`lids: false`, from the beetle). The diff shows it, but it is not what
  I picked; it is fine for a beetle-troll.
- `mix` semantics took a re-read: `--mix` is the share from b, `--base a` keeps the troll's body.
  The help text says the same. I was never sure whether 0.3 or 0.35 would stay "mostly troll"; the
  result suggests the share of genes that move is about that, and most numbers sit between the
  two values, so a lower mix does not make a child that is mostly the same troll in every number.

No error messages came up. The `crossbreed` output prints `warnings: []`, which was reassuring.

## v09-flying-dragon

Commands:

```sh
pnpm -s spawnforge generate --theme dragon --seed 1 --max-height 1.2 --requires air --out $S/v09.try1.json
pnpm -s spawnforge generate --theme dragon --seed 1..14 --max-height 1.19 --requires air --out $S/dr/dN.json
pnpm -s spawnforge analyze $S/dr/dN.json --summary          # per seed, run in parallel
pnpm -s spawnforge generate --theme dragon --seed 9 --max-height 0.95 --requires air --out .../v09.json
pnpm -s spawnforge analyze .../v09.json ; render --pose spread / rest
```

Result: "Zordrix", a quadruped dragon with two leathery wings (span 6.8 m), body height 0.95 m
(`bodyHeight`), total `height` 1.144 m with its horns, rest pose 1.1 m tall in the render,
`analyze` flies at about 20 m/s, no warnings, and the flight course landed
(`flight.landing.worst` 0). In the spread pose the render header reads "2.0 m tall", because the
wings are raised.

What was hard:
1. **`--requires air` means "has wings", not "can fly".** `generate` printed `ok: true,
   warnings: [], attempts: 1` for seed 1 at max-height 1.2, but `analyze` said `cannot_fly` ("its
   wings carry 2418 N/m² ... above 700 nothing could fly"), `hard_landing` and `below_ground` on
   the tail. Of the 14 seeds I scanned, only 4 had no warnings at all (seeds 4, 8, 9 and 13;
   4, 8 and 13 are two-legged wyverns, 9 is the four-legged one); seeds 1 and 12 had
   `cannot_fly`, and the rest had leg, ground or landing warnings. The docs do say "`air` needs wings", but a request for a dragon that "can fly" will
   read it the other way. Wanted: `generate` retrying until the analyze flight checks pass when
   `--requires air` is given (it already reports `attempts`), or at least listing `cannot_fly` in
   its own `warnings`.
2. **Which height?** The constraint and the task say "body"; `analyze` has `bodyHeight` (no horns
   or spikes) and `height` (with them). At `--max-height 1.19` the dragon's `height` was 1.4 m. I
   could not tell which one a reader would check, so I took `--max-height 0.95` to make both
   (`height` 1.144) stay under 1.2. The docs are clear about the difference (and about leaving a
   millimetre of slack, which I used: asking for exactly 1.2 gave exactly 1.2 and I preferred not
   to sit on the limit), but the CLI help line for `--max-height` should say it limits
   `bodyHeight`, not `height`.
3. **`analyze --summary` omits `bodyHeight`.** The docs say `--summary` "keeps the sizes", and
   it does keep `height`, `length`, `width`, `mass`, `counts` and `wingspan`, but not `bodyHeight`,
   which is the number `generate --max-height` talks about. My scan script printed `undefined`
   until I dropped `--summary`.
4. The contact sheet header says 1.1 m tall at rest and 2.0 m with `--pose spread`. Worth a line
   in the docs that `analyze` sizes are measured at rest.
5. The theme gave two-legged wyverns for 4 of 14 seeds. `--body-plan quadruped` exists, and I did
   not need it, but the dragon theme page says "four legs and a pair of wings or wings for arms",
   so it matches.
6. In the rest pose (side view) the folded wings stick up above the back like a pair of spars;
   they are legible as folded but not tidy. Not a defect for the task.

No error messages to report; every `generate` call succeeded.

## v12-armoured-horror

Commands:

```sh
for seed in 1..30: pnpm -s spawnforge generate --theme eldritch --seed N --out $S/el/eN.json
   # then read body.neck.count from each file
pnpm -s spawnforge analyze $S/el/e6.json --summary --stats rpg           # 3 heads, defence 10
pnpm -s spawnforge patch $S/el/e6.json '[{"op":"add","path":"parts","value":{"id":"shell","type":"shell","params":{"dome":0.5,"scutes":9}}}]' --out ...e6.shell.json
pnpm -s spawnforge patch ... '[{"op":"add","path":"parts","value":{"id":"carapace","type":"armor.bands","params":{}}}]' --out ...e6.bands.json
pnpm -s spawnforge analyze ... --summary --stats rpg                      # shell: defence 21, bands: defence 11
pnpm -s spawnforge patch ...e6.shell.json '[{"op":"set","path":"limbs[id=foreleg].splay","value":10}]' --out .../v12.json
pnpm -s spawnforge analyze .../v12.json --stats rpg ; render --labels --views 3/4,side,front,top
```

Result: "Zhulgoth", a quadruped with three heads on S-curved necks (`neck.count` 3, spread 57), slimed
charcoal hide, a row of eight spines, and a domed `shell` over its back. `analyze --stats rpg`:
`defence` 21 (was 10 before the shell), `attacks` 3, `health` 78, `attack` 16, no warnings. Render
checked: three heads clear of each other and of the shell.

Worked on the first try:
- The `rpg` formula in the catalogue is exact enough to plan with: hide 2 + 8 spikes at 0.25 +
  cube root of 181 kg (5.7) = 9.7, which rounded to the 10 I saw; a shell adds up to 10 x cover.
- `eldritch` makes extra heads often: 20 of the 28 seeds my script could read had `neck.count` 2
  or 3 (quadrupeds 2 or 3, serpents 2); octopods and some serpents have one head.

Confusing or harder than it should be:
1. **No way to ask `generate` for heads.** `--requires` only takes `air` and `water`; I generated
   30 seeds and opened each file to read `body.neck.count`. `generate` output reports `bodyHeight`
   and `length` only. Wanted: `--min-heads 2`, or `--requires heads:2`, or `counts` in the
   generate output. Note too that an absent `body.neck` (or `count`) means one head, so my first
   read of the files showed `undefined` for seeds with a single head.
2. **`armor.bands` with default params gave defence 11, not 12+.** The catalogue formula says
   "10 x cover (its size over the torso length, at most 1) + 0.15 a piece", but gives no
   hint of what cover the default bands have; I measured it by trying (11 total, so about 1 point
   from the bands). A `shell` gave 21. If the stats module returned a breakdown (for
   example `defenceParts: { hide: 2, spikes: 2, mass: 5.7, shell: 11 }`), choosing armour would
   not need trial runs.
3. **`generate` hands over creatures `analyze` complains about.** Seed 6 as generated had a
   `limb_intersection` warning on rough ground (foreleg 2.0 cm into the torso); generate printed
   no warning. I fixed it with the suggested `splay` (10), after which `analyze` was clean. Same
   point as the dragon: generate checks validity only.
4. `--labels` is unreadable on a multi-headed creature: the generated blueprint has parts `eyes`,
   `eyes2` and `eyes3`, each copied onto every head (`eyes2.R1.R`, `eyes3.L1.L`, and so on), which
   gave a 3/4 sheet with well over 20 overlapping labels. Maybe label the copies on the extra
   heads only once, or group them.

## General

- Every command printed JSON; `--help` on `instantiate` and `crossbreed` was enough to use them.
  Quoting `--lock 'a,b[id=c]'` worked as documented.
- Renders took about 15 to 20 s each and ran fine three at a time in parallel.
- `analyze` is the real arbiter of quality (flight, leg collisions, defence) but takes about 10
  s a creature and is per creature, so scanning seeds for a good one (v04, v09, v12) cost many
  runs. A `generate --count n --pick-clean` style helper, or `analyze` accepting several
  files, would cut it.
- The one error I saw was my own script's; no tool error message needed a fix.
