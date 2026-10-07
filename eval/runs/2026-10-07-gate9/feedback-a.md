# Gate 9 feedback, writer A

Five prompts, written from `docs/blueprint.md`, `docs/catalog.md` and `examples/` only, checked with
`validate`, `render` (contact sheet, filmstrip, head and front views) and `analyze`. Renders were
saved in the scratch folder, never in the repository.

All five first attempts validated with no errors and no warnings, so I never met a validation error
message. The only warnings I saw came from `analyze` (four, listed below), and each one led to a
working fix.

## Summary

| Prompt | Attempt files | First valid | Revisions after it | What drove them | Final `analyze` warnings |
| --- | --- | --- | --- | --- | --- |
| p01-wolf | attempt0, attempt1, attempt2 | attempt0 | 2 | attempt1: `limb_intersection` (foreleg into torso), a thick, anteater-like snout and a belly that did not read as pale. attempt2: visual polish only (head carried higher, bushier tail) | none |
| p02-spiked-lizard | attempt0 to attempt3 | attempt0 | 3 | attempt1: tail club read as a lollipop, so I thickened the neck of the tail and tried `armor.bands` (it looked like a floating cape). attempt2: tried `shell` (it hid the spike row). attempt3: dropped both, added side rows of studs, a wide torso and a smoother club | none |
| p03-horn-beetle | attempt0 to attempt2 | attempt0 | 2 | attempt1: orange spots did not show on `membrane.case`, so I removed the cases and hind wings. attempt2: plumper, more beetle-like body and bigger spots | none |
| p04-green-serpent | attempt0 to attempt3 | attempt0 | 3 | attempt1: too thin for "giant", fangs like tusks. attempt2: head not distinct from the neck, which then raised `ground_penetration` (head 6.1 cm into rough ground). attempt3: neck and head pitch fixed it | none |
| p05-swamp-troll | attempt0 to attempt3 | attempt0 | 3 | attempt1: `limb_intersection` (leg into leg) and tusks that sat by the eyes. attempt2: tusks re-aimed, which first gave `part_buried` (21% showing) and then cleared. attempt3: head made visibly flat and broad | none |

Finals: p01 attempt2, p02 attempt3, p03 attempt2, p04 attempt3, p05 attempt3. Every final has empty
`errors`, `warnings` and `analyze` warnings, and nothing under `notBuilt`. I ran filmstrips on p01
attempt1, p02 attempt3, p03 attempt2, p04 attempt1 and p05 attempt3 (all showed negligible foot slide
and no warnings); the finals' `analyze` motion checks on flat and rough ground were clean.

Attempts that were dead ends but are kept: p02 attempt1 and attempt2 (armour experiments).

## p01-wolf

Final: Timber Wolf, 2.1 m long, 78 cm tall. A thin long snout, grey fur, a white belly, a bushy
tail. It reads as a wolf at a glance.

- **Two coats at once is not possible.** The recipe for a bushy tail is `"fur": { "length": 0.06,
  "region": "tail" }`. `skin.fur` is a single object, so using it would drop the body coat. I wanted
  a 0.03 coat on the body and a longer one on the tail, and the docs do not say whether a list of
  coats or a per-region length exists. I fell back to a thick tail `radius` profile with the body
  coat on the whole tail. A per-region `length` (or a list of coats) would close the gap.
- **No guide to a long snout.** `head.shape: "snout"` plus `length` 0.42 gave a thick, tapir-like head;
  it only read as a wolf after I lowered `radius` from 0.1 to 0.085 and raised `length` to 0.46. The
  docs say what `length` and `radius` are, but not that a long muzzle needs a smaller radius. A
  canine recipe in the Recipes table would have saved an attempt (the `grey-wolf` example is
  close, and I started from it).
- **The `analyze` description left out what I asked for.** It said "a big head, a tail, golden eyes,
  pointed ears ... grey skin, a white belly and charcoal mottling". It never says fur (I had a full
  coat), never says the snout is long and never says the tail is bushy. I could not use it to confirm
  the prompt. Adding fur, snout length ratio and tail thickness would let a writer check the three
  features this prompt asks for.
- **`limb_intersection` fix text worked.** "about 5° more splay works best" was right (foreleg 0 to 14
  cured it). The warning appeared only because I dropped the example's `splay: 14`. The doc's
  Limbs section says `splay` is "0 for upright walkers (dogs, horses)", yet a wolf-sized dog with a
  broad chest needed 14; the doc could say a wide chest wants some splay.
- **Contact-sheet fur is noisy.** At 512 px the shell fur breaks the silhouette into speckle and a
  pale belly is hard to judge. The front view and legs showed it best. The doc says fine patterns
  fade at small sizes, but not that fur does the same to silhouettes; a `--quality high` hint for
  fur would help.
- A `mottle` layer with `region: "tail"` was barely visible under the fur. I could not tell whether
  that was my parameters or the fur hiding detail.

## p02-spiked-lizard

Final: a 2.5 m sprawling, scaled lizard, a row of 16 spikes down its back, studs along each flank and a
club on its tail.

- **"Armoured" has no clear module.** `armor.bands` laid on a lizard's back came out as a hard-edged
  arch that stood off the body like a cape (front view), with the spike row poking through it. It
  suits an armadillo, as the catalogue says, but the catalogue entry gives no hint that it is a
  separate, stiff shell. `shell` with a low `dome` (0.3) looked better but covered the spike row
  (attempt2): the spikes on the torso vanished and the front view showed only the first few.
- **No warning for spikes hidden by an area part.** In attempt2 the whole torso part of the spike row
  was under the shell, and neither `validate` nor `analyze` said so. `part_buried` seems to compare a
  part with its own host only. It should also fire when another part covers it. The docs should
  also say which parts stack and which hide each other (row parts against area parts).
- **The club-tail recipe makes a lollipop on a stocky body.** The docs give `[0.15, 0.12, 0.1, 0.1,
  0.14, 0.24, 0.25, 0.08]` with `segments` 12. On a body this thick the waist at 0.1 against a 0.25
  club looked like a ball on a stick. A smoother profile (`[0.17, 0.15, 0.14, 0.15, 0.18, 0.23, 0.23,
  0.14, 0.05]`, length 1.1) read as a club. The recipe should say the profile is relative to the
  body: keep the waist near 0.8 of the root radius.
- **Spine fractions need arithmetic.** `spikes.row` on `spine` with `from` 0.08, `to` 0.82 carried
  spikes onto the club, which I had not planned. The doc's own advice (put the row `on` "torso" for
  the torso alone) is fine, but the first choice for "a row down the back" in the Recipes table is
  `spine`, which tempts a writer to overshoot. I kept it, because a taper onto the tail read well.
- No ankylosaur or "armoured reptile" recipe. The Recipes table has stegosaur, tortoise and
  porcupine, but nothing that combines a spike row, flank studs and a club. A flank row through
  `spikes.row` at `angle` 55 with `side` "both" worked well, and the "count is per row" note
  explained why I got two rows.
- The `analyze` description says "a row of 7 spikes on its body" for the flank studs and "teeth"
  without a count; it does not mention the club. Adding "a thickened tail tip" would help.

## p03-horn-beetle

Final: a 27 cm glossy black beetle with orange spots and one big curved horn, skittish.

- **Spots on `membrane.case` do not work.** I used the rhino-beetle recipe (case and hind wing) and a
  `spots` layer with `region: "back"` plus a second one with `region: "wings"`. The orange spots
  covered the thorax and a few edge spots showed on the case, but the case itself, which is most of the
  back of a beetle, stayed plain black. The docs say a `wings` region covers membranes, but not that
  patterns are laid out in body space and so barely reach a case. The case also has small boxy tabs
  at its rear (visible on the rear 3/4 view; the rhino-beetle example's rear 3/4 looks similar), where the hind
  wing pokes past it. I removed both limbs, which gave up the most characteristic beetle feature. A case
  that takes the body's pattern, or pattern params of its own, would fix this.
- **Small creature behaviour is documented well.** The `fast_cadence` text says it affects torsos
  under 20 cm unless skittish. My 15 cm torso with `skittish` raised nothing, although the tripod
  runs at 10 steps a second and the filmstrip cycle is 0.18 s. It worked as documented, but it is
  surprising that the warning is silenced by temperament instead of by the speed being plausible.
- **"Small" is ambiguous with `scale`.** `scale` is the torso length, but the beetle measures 27 cm
  once the horn and legs are counted (scale 0.15). I had to render once to learn what "small"
  became. A size line in the `validate` output (it is only in `render` and `analyze`) would help.
- **The nose-horn recipe worked on the first try**; `length` 0.55, `curve` -75, `width` 0.065.
- **Glossy.** `chitin` gave a lacquered look with no extra work. There is no parameter for gloss, and
  the doc describes the sheen only in words; I could not tell whether more or less was possible.
- The hexapod preset body reads as an ant or a larva until the torso `radius` profile is raised
  to a plump oval ([0.13, 0.19, 0.24, 0.27, 0.25, 0.17]). The doc suggests "a deep abdomen (more torso
  radius points)" but does not say how plump a beetle is.

## p04-green-serpent

Final: Jade Constrictor, 6.7 m, green scales, yellow stripes across the back, a wide wedge head and
two long fangs.

- **Sizing rule held.** "A serpent is about 3.5 × scale" matched (scale 2 gave 6.6 to 6.8 m). The docs
  say nothing about girth. A "giant" serpent at the preset radii is a 6.6 m snake only 50 cm wide.
  A note such as "a python is about 0.1 to 0.14 of the torso length in radius" would help.
- **The `analyze` description calls the snake's body a tail.** "a short neck, a very long tail" is
  accurate for the sections but wrong for a reader. The measurements also give tail length of
  nearly the whole animal. Serpent descriptions could say "a long body".
- **Head against neck.** `wedge` with a `wide` cross-section and radius 0.115 on a neck of 0.075 to
  0.11 gave a clean snake head. That put the head 6.1 cm into the ground on rough ground
  (`ground_penetration`, path `body.head`). The fix text, "raise the section (pitch, curl), lower the
  torso pitch or make it slimmer", does not say which section's pitch, and gives no amount, unlike
  other warnings ("about 5° more splay"). I guessed neck `pitch` 28 and head `pitch` 5. A concrete
  figure (for example "raise the neck about 15°") would be better.
- **Fang size.** `fangScale` 2.4 gave tusks; 1.7 read as fangs. The docs say "1 is typical, 2
  sabre-like", which was right, but the `fangLength` warning about "planks" in the docs is the only
  hint for a giant creature, where fang size follows the head. It worked.
- **`stripes` or `bands`?** Both are across-the-body colour stripes. `stripes` (with `region: "back"`)
  fades toward the belly; `bands` makes full rings. The catalogue says "like a coral snake" for
  bands and nothing contrasts the two. I picked `stripes` and it was fine.
- Slither filmstrip (top view) was clear and showed the stripes following the body.

## p05-swamp-troll

Final: a 1.9 m upright troll with a broad flat head, long arms, two tusks and mottled green hide.

- **The tusk recipe misplaces tusks on this head.** "Tusks from the lower jaw: `horn.curved` on `jaw`,
  `at` 0.25, `angle` 60" put the tusks beside the eyes, curling up like horns. The `bog-troll` example
  shows the same, and I took a while to see it, because the `head` view of an upright biped looks down
  on the head. Using `angle` 90 to 100 with `aim: "up"` made proper tusks from the lower jaw. The
  docs say `aim` "up" and "down" work best at `angle` 60 to 110, but the tusk recipe does not use it.
  I would put `aim: "up"` and `angle` 90 into the recipe.
- **`part_buried` was correct and useful.** The first re-aimed tusks showed "only 21% of the part shows
  above the skin; make it longer or larger"; I raised `length` to 0.25 and `width` to 0.036 and the
  warning cleared.
- **Flat head.** `"shape": "flat"` with `crossSection: "wide"` (from the docs) still read as a dome
  on a tall neck until `radius` went to 0.2 with `brow` 0.9. There is no flatness parameter; `radius`
  scales the whole head. Eyes sit on the crown by default (frog-like); I moved them to `at` 0.27,
  `angle` 72, and the recipes do not say a flat head needs that.
- **`limb_intersection` between the two legs.** The biped preset leg (`attach.angle` 130) with a
  thicker radius passed 2 cm into the other leg. The suggested fix ("a lower attach.angle or
  thinner radius") worked at 115 and [0.12, 0.07]. The doc's Limbs section does not mention that a
  stocky troll needs this.
- **Mottling reads as camouflage** when the accent is much darker than the base. `mottle` `contrast`
  has no doc beyond "how sharp the blotch edges are". Lowering it to 0.35 helped. A suggested
  swamp-skin recipe (mottle plus `slime`) would help.
- The description says "curved horns on its jaw" for tusks, and "short legs" for 0.95-long legs on
  a biped whose preset is 1.3. Both are literal and neither helps a writer confirm the prompt.
- Arms stay in one pose during the walk (filmstrip); I did not find this in the docs. It is fine for a
  lumbering troll, but a writer cannot tell without a render.

## Cross-cutting

- **Views.** The `head` view looks down on tall creatures. For the troll I needed a head-on,
  eye-level view to judge the face and tusks. A `--views face` panel (head from the front at eye
  level) would help.
- **Time.** Each contact sheet took 20 to 40 s, so about two checks per attempt is realistic.
- **What helped most:** the Recipes tables, the examples with PNGs (I started the wolf, beetle and
  troll from them), the `part_buried` warning and the `limb_intersection` text.
- **What I would add to the docs:** recipes for a canine, an armoured reptile with a club tail, a
  beetle with spots across wing cases, a giant snake (girth) and a flat-headed troll; and
  per-region fur length.
