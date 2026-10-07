# Gate 9, suite B, prompts b06 to b10: feedback

Author: one model session working from `docs/blueprint.md`, `docs/catalog.md`, `examples/` and the CLI only.
Renders and scratch tests are in the session scratchpad (`gate9-bb`), never in the repository.

## Summary

| Prompt | Attempt files | First valid | Revisions after it | What drove the revisions | Final attempt | Final analyze warnings |
| --- | --- | --- | --- | --- | --- | --- |
| b06-kraken | attempt0, attempt1 | attempt0 | 1 | Render: mantle read as an egg, not bulbous; tentacles looked thin next to it. Added `swim.undulate` to say "swims" twice over. | attempt1 | `not_built` for `motion.gaits[type=swim.undulate]` (not fixable; `validate` also lists `motion.media.water` under `notBuilt`) |
| b07-reef-shark | attempt0, attempt1 | attempt0 | 1 | Render: body too eel-thin, dorsal and tail fins not "tall" enough, teeth small. | attempt1 | none (`validate` lists `motion.media.water` under `notBuilt`) |
| b08-cave-spider | attempt0, attempt1, attempt2 | attempt0 | 2 | Render: palette read as brown, not cave-pale; fangs too short to read, then their `tipColor` never showed so the fang `color` was tinted venom green and lengthened. | attempt2 | none |
| b09-scorpion-king | attempt0, attempt1 | attempt0 | 1 | Render: dark armour on a dark body was invisible; stinger and pincers small; "king" had nothing regal (added a spike crown). | attempt1 | none |
| b10-centaur | attempt0, attempt1, attempt2 | attempt0 | 2 | Render: arms fused to the chest, horse tail a fox-brush cone, hooves invisible, legs and haunches thin. | attempt2 | none |

Every attempt0 validated on the first try and every `analyze` ran clean on the motion checks (no foot slide,
penetration, intersection or overstretch on flat or rough ground). No revision was driven by an error message.
All revisions came from looking at the renders. Contact sheets and a motion strip were checked for every creature
(kraken and shark slither strips, scorpion `pinch` strip, centaur trot strip).

Final blueprints: `b06-kraken.attempt1.json`, `b07-reef-shark.attempt1.json`, `b08-cave-spider.attempt2.json`,
`b09-scorpion-king.attempt1.json`, `b10-centaur.attempt2.json`.

## b06-kraken

What worked: the doc's kraken recipe plus `examples/kraken.json` got a good kraken at once. "For eight tentacles write
four entries with `side: both` at different `angle`s" is exactly right, and `analyze` confirmed `tentacles: 8`.

Confusing or missing:

- The recipe and the example kraken have ten tentacles (eight arms plus two feeders). The prompt says eight, so the
  feeders had to be dropped; the recipe line never says "drop the feeders for exactly eight".
- Swimming is the point of the prompt and is not built. `media.water` is needed (tentacles on the head do not imply
  water, which the doc says, but only in a sentence deep in the Tentacles bullet). The creature is still shown
  slithering, tentacles lying on the ground. Nothing in `render` or `analyze` says "this is a stand-in for swimming",
  and the description still says "It slithers at about 0.3 m/s".
- `notBuilt` is inconsistent between commands. `validate` lists `motion.media.water`. `analyze` and `render` list only
  the gait I wrote (`swim.undulate`), never `media.water`, and in attempt0 (no swim gait) their `warnings` were empty.
  So "keep it" feedback exists in one place only. The `not_built` entry has `severity: warning` in `analyze`, which
  clashes with the protocol's "analyze has no warnings you can fix"; a severity of `info` would read right.
- Tested in scratch: `media: { water: true, land: false }` with `gaits: ["swim.undulate"]` gives `speed.gaits: []` but
  the description still says "It slithers". Turning land off should either be refused, with a hint that no gait is
  built for this body yet, or the description should say "no gait is built yet".
- With slither, a thick short mantle (almost as wide as long) folds into a crescent in the filmstrip (frames 3, 4, 6 and 7
  of `--filmstrip`), which looks like a mesh bug. The slither amplitude is a share of body length, so a stubby
  body should get less.
- "Huge eyes": `eye.basic.scale` tops out at 3 (an eye of 0.18 m on a 1.4 m mantle), which was enough, but `scale` is
  relative to the head, so a bigger head makes the eye bigger, not "huge" as a separate choice. Fine, but the
  "Big eyes need a large scale (2-3)" sentence sits in the Motion section under "what the body model does not do
  yet", where nobody looks for it.
- `bioluminescence` worked, but nothing says whether `region: back` on a creature facing up from the sea floor means
  the top (it does). A deep-sea creature would want the glow on the tentacles too; the `region` list has no way to
  say "limbs and back" in one layer.

## b07-reef-shark

What worked: the fish preset already is a shark. Overriding `dorsal` and `tailfin` by id, then `teeth`, was one pass.
`fin.dorsal.height` and `fin.tail.size` are easy to reason about ("height in torso lengths").

Confusing or missing:

- The preset carries pelvic fins. The prompt says "two pectoral fins"; to get only those I would need
  `{ "id": "pelvic", "remove": true }`. `blueprint.md` mentions `pelvic` only in a recipe sentence, never says the
  preset brings it. I kept the small pelvic pair (a real shark has them), but a model reading the prompt literally
  has to find that in `catalog.md`.
- Pectoral fins lie flat and horizontal, so the side view of the contact sheet shows them only as labels, with nothing
  visible. They show in the top and front views. A line in the docs ("fins hold flat; check them in top and front")
  would save a wasted revision; `--views` could add a `fins` panel.
- `media.water` on a fish: the doc says the water switch follows the body, so for a fish it is redundant, yet
  the prompt says "lives in the water" and I could not tell whether to write it. I wrote it, and it then appears in
  `notBuilt`. A sentence in the Shark recipe ("`fish` already lives in water; write nothing") would settle it.
- `analyze`/`render` for a shark: `speed.gaits` is `[]`, the filmstrip header says `none`, its footnote says `(slither)`,
  and `description` says "slithers at about 0.3 m/s". Three different statements about the same motion.
- `teeth.row.count` is "Teeth per row on each side": it is not clear if each side of the mouth or each of the two
  rows. At `count` 18, `scale` 1.4, `fangs` 0 the render shows dense upper and lower rows, which is what the prompt
  wanted, but I had to guess.
- Fin colour: `fin.dorsal` and `fin.tail` take `color`; the pectoral membrane has its own `color` too. Making all fins
  one darker tone needs three places. A skin `region` of `fins` would be simpler (`wings` covers membranes, which is
  not obvious for fins).

## b08-cave-spider

What worked: `octopod` plus `mandible` with `"shape": "fang"` (as in `examples/tomb-spider.json`) gave eight legs,
fangs and a bulbous abdomen at first try; the abdomen is just the last three torso radius points.

Confusing or missing:

- "Venomous" has no module: the only handles are fang length and colour. The `tipColor` on the mandible did not show
  at all at 0.27 torso lengths (the fang looked uniformly `color`), so I tinted `color` itself green. A `venom` param
  (a droplet or a glossy tip) would carry the word in the prompt.
- The `head` view cannot be used to check fangs: they hang below the head and are cut off by the frame, even at
  `--size 800 --quality high`. The `front` view was the only one that showed them. A `--views mouth` or a
  jaw-aware head framing would help.
- `skin.layers` `bands` on `region: limbs` is laid out over the whole body, so legs ended up with unequal banding
  (some legs have a dark upper segment, others none). The doc explains the pattern is laid out over the body; for
  limbs a per-limb pattern would be what anyone wants.
- Light chitin comes out grey-brown under the default lighting ("sand chitin" in the description); a cave spider
  needs a lot of lightening to read as pale. Nothing wrong, but there is no hint about how `material: chitin` shifts
  hue.
- The two eye parts, `eyes` and `side-eyes`, live only in the octopod preset; the docs never say there are two eye
  sets, so a blind or reduced-eye cave spider ("remove": true on `side-eyes`) is only discoverable from the catalogue.
- `tripod` is chosen for eight legs ("tripod in alternating sets of four" per the doc); the description says
  "tripods up to 1.5 m/s" for an eight-legged creature, which reads as a bug.

## b09-scorpion-king

What worked: the Tails paragraph's scorpion recipe (`length` 2.4, `pitch` 40, `curl` 200) gave the right arch the
first time; `armor.bands` with its default anchor covers the back; `hand.pincer` with `lift` 80 reads as pincers and
`--filmstrip --action pinch` shows a snap with a `pinch-contact` event.

Confusing or missing:

- The recipe table sends scorpions to `octopod` (eight legs, and `examples/dune-scorpion.json` has eight legs plus two
  claw arms, ten limbs in all). The prompt says six legs and two arms. I used `hexapod` and slimmed the torso.
  `octopod` with `{ "id": "leg4", "remove": true }` would also work, but neither route is written down.
- Two scorpion tail recipes disagree: the Tails paragraph says `length` 2.4, `pitch` 40, `curl` 200; the recipe table
  says `pitch` 60, `curl` 160 (the example uses `length` 1.1). The first was right for a hexapod's short torso.
- Two stinger recipes disagree: the Recipes table says `at` 0.97, `angle` 0, `curve` 60; `examples/dune-scorpion.json`
  uses `at` 1, `angle` 180, `curve` -80. I used the table. It points forward and down over the back, which is right,
  but I only know because I rendered it.
- Armour is invisible on a dark body: `armor.bands.color` defaults to `base`. A bronze `color` was needed. A note in
  the part's description ("same colour as the skin unless you set `color`") would help; so would a `tipColor` or an
  `edgeColor` like `plates.row` has.
- "King" has no part: I added a `spikes.row` on the head (angle 0, `from` 0.45, `to` 0.95) as a crown. It works, but
  it merges into the armour's front edge. A `crown` shape or a `horn.curved` `aim: up` set is the other route.
- The dark-on-dark problem again: to see tail bands at all, the accent has to be much lighter than the base.

## b10-centaur

What worked: `extends: centaur` already stands upright with hooves and grasping hands; horns from the "bull horns"
recipe read at a glance; `analyze` has the right `unbalanced` check and passed.

Confusing or missing:

- The Centaur recipe says to give `foreleg` and `hindleg` `"foot": "foot.hoof"` and the arms `hand.grasp`, but the
  preset in the catalogue already has both. I wrote them anyway, so the sentence adds noise; saying "already set, only
  change `size`" would be better. `foot.hoof.size` 1.25 was needed to see the hooves on a 1.1 m torso.
- The arms of the preset hang against the chest and fuse with it in every view. `lift` 12 and `splay` 8 on `arm`
  opened them. Nothing in the "Upright fronts" paragraph mentions `lift` or `splay` on arms, though they are the
  obvious tool for it.
- The human upper body and the horse body share the `torso` region ("torso (which includes the neck)"), so a skin-toned
  chest over a coated horse body cannot be coloured in two ways. I leaned on `countershade` (pale chest by luck).
  A `neck`/`upper` region or `front` would fix it. Same for fur: a short horse coat cannot skip the human torso.
- "Human-like torso" is not delivered by the head: all four head shapes read animal (snout, wedge, flat, round) and the
  mouth cut reads as a grin. A `human` head shape, or a chin and a smaller jaw, would help; `lips` and `brow` only go
  so far.
- No mane. A horse-like body wants one and the only options are `spikes.row` (hard) or `fur` (everywhere). The preset
  tail is a sharp cone; the "bushy tail" recipe is for fur and I did not use it.
- `muscle` 0.85 plus bigger limb radius gave horse-like haunches but also stubby legs; there is no hint about the
  radius a horse leg needs, only the "Typical lengths" line.
- `analyze` says "it can bite, lash, look and roar" for a calm centaur: `lash` comes from the tail, which is true but
  surprising, and `lash` on a horse tail looks wrong to a reader.

## Cross-cutting

- All validation passed first time, so I saw no error message to rate. The compact `validate --quiet` output was easy
  to read.
- Each `render` takes 5 to 20 s, fine. `--labels` is essential, and `--views` plus `--size` are what let me check
  fangs and fins.
- `notBuilt` should be surfaced identically by `validate`, `analyze` and `render` (today the `media.water` entry
  appears only in `validate`), and should be `info`, not `warning`, in `analyze`.
- For not-yet-built swimming, say so in `analyze.description` ("a swimmer; swimming is not drawn yet, shown
  slithering") instead of "It slithers".
- The kraken, shark and spider all depend on the body plan having what the prompt names; the docs' recipe table
  routes well (kraken, shark, spider, centaur). The scorpion route is the one that misleads (eight legs vs six).
