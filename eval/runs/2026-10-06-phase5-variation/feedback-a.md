# Feedback A: phase 5 variation (species, generate, mutate, crossbreed)

Used only docs/blueprint.md, docs/catalog.md, examples/, README.md and the CLI
(`node packages/cli/src/bin.ts ...`). No source read. Scratch files and renders are in `work-a/`.

Deliverables in this folder: `v01.species.json`, `v01.a.json`, `v01.b.json`, `v01.c.json`,
`v02.json`, `v03.json`, `v04.json`. All seven pass `validate` with 0 errors and 0 warnings, and
`analyze` gives 0 warnings on the six creatures. Everything else here (e.g. `v05.json`, `work-b/`)
belongs to another run and I did not open it.

## Task 1: v01 wolf species

Commands:
- `validate` on a first draft, then on the fixed species.
- `instantiate v01.species.json --seed N --out v01.X.json` for N = 1, 2, 3.
- `validate`, `analyze` and `render --views 3/4,side --size 400` on each individual.

What I wrote: `extends: quadruped`, `scale` `{min 0.9, max 1.3}`, foreleg and hindleg `length`
ranges, `ear.pointed` `length` (0.08 to 0.2) and `width` (0.04 to 0.07) ranges, and a coat-shade
layer (see below). Result: scale 0.914 / 1.14 / 1.23, ear length 0.121 / 0.081 / 0.089, leg lengths
differ, and the shade layer strength is 0.04 / 0.25 / 0.54. The renders show #1 clearly darker than
#3.

What worked: ranges on `scale`, limb `length` and part `params` just worked and `validate` said
`"species": true`. `instantiate --out` writes a plain blueprint (the individual's `seed` is a large
derived number, not 1, 2, 3, and the name becomes `Grey Wolf #1`).

What failed or confused me:
- **Coat colour shade.** The task asks for it, and I first tried a colour range:
  `"palette": {"base": {"min": "#5a5a5a", "max": "#8a8a8a"}}`. Error:
  `skin.palette.base: bad_range: a range has exactly two keys, "min" and "max", both numbers`, with
  `fix: { "min": 0.5, "max": 0.7 }`. blueprint.md only says "Anywhere a number goes, a range ... makes
  the blueprint a species". Nothing says colours (or enums, booleans) cannot vary, and the fix
  example is useless for a colour. Workaround I invented: a palette entry `pale` plus an extra first
  layer `{"id":"shade","type":"countershade","color":"pale","height":1,"softness":1,"strength":{"min":0,"max":0.55}}`.
  It blends the whole coat toward `pale` by a ranged amount. That is a hack and the docs do not
  suggest it.
- `analyze` describes all three wolves identically ("grey skin, a pale grey belly and charcoal
  mottling"), so I could only confirm the shade variation by looking at renders and the raw
  `strength` values.
- `analyze` on the species file fails with six `expected number, got object` errors. It does not say
  "this is a species, run instantiate first". (`mutate` on a species also fails: it resolved some
  ranges and left others as objects.)
- `validate` on a species says `ok: true` and nothing else, so I could not see the extremes it
  checked.
- Sizing bullet in blueprint.md: "a wolf is about 0.7" is ambiguous (scale 0.7, or 0.7 m tall?).
- The three individuals are quite heavy in `analyze` (86 to 212 kg), which is odd for wolves, but
  that is not something the task or docs promise.

Confidence it meets the task: high for size, legs and ears (real ranges, three different
individuals, checked in files). Medium for "coat colour shade": it varies visibly, but only through
a layer-strength proxy, not a colour range, and the palette itself never changes.

## Task 2: v02 small demon

Commands:
- `generate --theme demon --seed 1 --max-height 1 --actions bite,roar --out ...`, then `analyze`.
- Looked at seeds 1 to 5 with `--max-height 0.8`.
- `generate --theme demon --seed 2 --max-height 0.8 --actions bite,roar --out v02.json`.
- `patch v02.json '[{"op":"set","path":"motion.actions","value":["bite","roar","look","idle"]}]'`.
- `validate`, `analyze`, `render --filmstrip --action roar` and `--action bite`.

Result: Zulror, a horned biped. `analyze` height 0.842 m (horns included), 0 warnings, description
"it can bite, roar and look". The bite filmstrip has a `bite-contact` event and the roar one has
`roar-peak`.

What confused me:
- With `--max-height 1`, `generate` reported `"height": 0.93`, but `analyze` measured 1.114 m for the
  same file: the 13-spike spine row (about 0.2 m) is counted by `analyze` but not by `generate`.
  blueprint.md says "(body height in metres, not counting horns; the creature is rescaled to fit)".
  It does not say spikes and other parts are also excluded, so a 1 m limit can be broken by
  `analyze`'s measure. I used 0.8 to leave a margin and checked with `analyze`.
- `--actions bite,roar` does not write anything into `motion.actions`; it only makes sure there is
  a jaw. The doc says "(it gets a body that can)", which is true, but a reader checking the file
  for `bite` and `roar` finds nothing. I added the list with `patch`. `validate --expanded` shows
  the defaults do include both.
- The `measurements` in the `generate` output (`height`, `length`) use different numbers from
  `analyze` for bipeds (`length: 0.246` is front-to-back depth, not head to tail).

Confidence: high that height is under 1 m (0.842 with horns) and that bite and roar work (explicit
in the file, events seen in filmstrips). It is a plausible demon: horns, fangs, goat pupils, red and
brown stripes.

## Task 3: v03 locked mutant

Commands:
- `mutate examples/ridgeback-stalker.json --seed 5 --amount 0.4 --lock skin --out work-a/m1.json`
  (first try, to see what drifts).
- `mutate ... --seed 5 --amount 0.4 --lock 'skin,parts[id=horns]' --out v03.json`.
- `patch v03.json '[{"op":"scale","path":"parts[id=horns].params.length","by":1.4},{"op":"set","path":"name","value":"Ridgeback Stalker Mutant"}]'`.
- A small node script (my own) comparing `JSON.stringify(parent.skin)` with the child's: equal.
- `validate`, `analyze`, `render --labels` of child and parent.

Result: horn `params.length` 0.25 to 0.35 (+40%; absolute 0.30 m to 0.42 m since `scale` is still
1.2), `skin` byte-identical to the parent's, other genes drifted (torso segments, head shape,
tail, hindleg length and attach, foot genes, dorsal height, gait strides, roar intensity).
Renders show clearly longer horns.

What worked: `--lock skin` kept the palette, material and layers exactly. The bracket path
`parts[id=horns]` works as a lock when quoted in the shell.

What confused me:
- There is no way to ask `mutate` to push a gene in a direction. In my first run (horns unlocked)
  the horn `length` did not change at all while `curve` went 60 to 177, which would make the horns
  look shorter or hookier, not longer. So I locked the horns and lengthened them with `patch`.
  The task is solvable only by combining two tools; blueprint.md never says to do that.
- The mutant keeps the parent's name and seed. Not wrong, but `mutate` output is indistinguishable
  from the parent without the diff (I renamed it).
- `locked` matching is described only by example ("`skin`, `body.head` or `parts[id=horns]`"). I
  could not tell from the docs whether locking `skin` covers `palette`, `material` and `layers`
  (it does), or whether `skin` colours elsewhere (e.g. part `tipColor`) are treated as skin
  (they are not: `horns.params.tipColor` drifted in run 1).
- The `mutate` output prints the diff but nothing about what the parent was, so checking "skin is
  exactly the parent's" needed my own script. A `--check`/compare command would help.

Confidence: high on the measurable requirements (horns +40% in both relative and absolute length,
skin identical, valid, 0 warnings). Lower on whether "mutant" is read to mean the horn change must
come from `mutate` itself rather than a `patch` afterward.

## Task 4: v04 troll x beetle

Commands:
- `crossbreed examples/bog-troll.json examples/ember-beetle.json --seed 1 --mix 0.3 --out work-a/x1.json`
  (first look at the diff).
- Scanned seeds 1 to 140 at mix 0.2, 0.25 and 0.3 (shell loop, printing `base`, `extends`, torso and
  neck pitch, leg `attach.at`, material, layers, parts, actions) to find a troll-based child.
- Rendered candidates (`render --views 3/4,side,head,top`).
- `crossbreed ... --seed 129 --mix 0.25 --out v04.json`, then `validate` and `analyze`.

Result: `base: "a"` (troll), `extends: biped`, torso `pitch` 70 (unchanged from the troll), neck pitch
76.9, two legs at `attach.at` 0.847, scale 0.741 (1.44 m tall). From the beetle: `material: chitin`
(glossy sheen in the render), accent colour pulled toward rust orange (`#7a4926`) so the mottle
shows as rust blotches, iris more orange, tusks pick up a ridge, plus the `bite` action. It kept
roar. It lost the `teeth` part.

What confused me or failed:
- **"Keeps the body plan" is looser than it sounds.** The docs say `crossbreed` "keeps one parent's
  body plan", but only `extends` is kept. Every number is blended, including posture. Seed 1 at mix
  0.3 gave torso `pitch` 70 to 55.1 and neck `pitch` 82 to 47.7 (hunched, not upright), legs moved
  forward (`attach.at` 0.94 to 0.81), roar was replaced by idle and the teeth were removed. At mix
  0.15 to 0.3 many seeds dropped the pitch to 40 to 55. I had to scan about 280 seed and mix
  combinations to find one that stays upright and also shows a clear beetle trait.
- **Base can flip.** At mix 0.2 and 0.25, seed 3 (and about a fifth of the seeds) built on the
  beetle: `extends: hexapod`, six legs, `base: "b"`. The doc says "the second parent's, with chance
  `mix`", which is correct, but "mostly troll" at mix 0.2 does not rule it out. The only warning is
  the `base` field in the output.
- **The beetle's nose horn can never arrive.** The beetle's `horn` (type `horn.curved`) is paired with
  the troll's `tusks` (also `horn.curved`) by "parts by id or type", so it blends into the tusks
  (longer, ridged, attach angle moved) and never comes across as a separate part. 223 troll-based crossbreeds out of
  280 scanned never had a `horn` part. The docs say unpaired parts come over by chance, but do not
  warn that same-type parts always pair. This removes the most visible beetle feature.
- No `--lock` on `crossbreed` (unlike `mutate`) to say "keep the torso, take the skin".
- Low mix means more troll but the effect is small and noisy: "each gene's share wobbles a little
  around `mix`" is accurate, but for pitch, 70 to 40 is not a little wobble.

Confidence: medium-high. The result is a valid, upright biped built on the troll with 2 legs, and
has chitin, rust-orange blotches and a bite action from the beetle. How "visible" the inheritance
is depends on the reviewer: it is a colour and sheen change, not a new shape. I did not patch
anything after `crossbreed`.

## Three most important problems with the docs and tools

1. **Species cannot vary colours, and nothing says so.** The task (a species with varying coat
   shade) hits `bad_range ... both numbers` with a numeric example as the fix. blueprint.md says
   "anywhere a number goes", never "colour is not a number". There is no colour range, hue shift or
   shade parameter, so a user must invent a ranged layer-strength trick. Either support
   `{ "min": "#..", "max": "#.." }` colour ranges (or a `shade`/`hueShift` gene), or document the
   limitation and the workaround in the "Species and variation" section. Related: `analyze`
   descriptions ignore the shade, and `analyze`/`mutate` on a species file give a wall of
   `expected number, got object` instead of "run instantiate first".
2. **`crossbreed` and `mutate` cannot be steered, so goal-directed tasks need trial and error.**
   `mutate` has no "grow this gene" option (I had to lock the horns and `patch` them), and
   `crossbreed` has no `--lock` or "keep this section" option, blends posture numbers (torso and
   neck `pitch`, leg `attach.at`) that define the body, and can flip to the other parent's body
   plan. The docs describe the genetics but give no recipe for "child keeps X, inherits Y". Add
   `--lock` to `crossbreed`, a `--bias` or `--set` for `mutate`, and a short "recipes" section like
   the one for parts. Same-type parts always pairing (troll `tusks` + beetle `horn`) should be
   documented, or an option added to bring a part over unpaired.
3. **Numbers disagree between tools, and the "contract" checks are not verifiable by the tools.**
   `generate --max-height 1` reports 0.93 m while `analyze` measures 1.114 m for the same demon
   (spikes counted by one and not the other; the doc only mentions horns). `--actions bite,roar`
   writes nothing to `motion.actions`. `mutate` keeps the parent's name and seed, and there is no
   command to compare child and parent ("skin unchanged?", "horns 15% longer?"), so I had to write my
   own scripts for the checks the task cares about. A `diff a.json b.json` command, one consistent
   height definition (with `analyze` printing both with and without parts), and `generate` writing
   the requested actions into the file would remove these traps.
