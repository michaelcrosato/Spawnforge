# Feedback d: prompts b16 to b20

Work was done from `docs/blueprint.md`, `docs/catalog.md` and `examples/` only (I read `luna-moth`, `two-tailed-fox`,
`griffin`, `kraken`, `porcupine` and `stone-tortoise` as JSON, and the luna-moth and griffin PNGs). Renders went to the
scratch folder. Scratch-only experiments (not saved attempts): `fox-x1/x2` (limb countershade heights), `arm-A/B`
(armour area variants) and `slug-e0/e90` (eye angle on the stalk).

## Summary table

| Prompt | Attempt files | First valid attempt | Revisions after it | What drove them | Final analyze warnings |
| --- | --- | --- | --- | --- | --- |
| b16-giant-moth | attempt0, attempt1, attempt2 | attempt0 | 2 | 1: render showed the moth could `bite` and `roar` (preset jaw), legs looked bare, wing pattern too busy (jaw off, actions trimmed, fur on legs, grime on legs). 2: fur-covered legs read as a spider's, so thinner legs; translucency lowered to fight a white glare on the wing (it did not remove it) | none |
| b17-two-tailed-fox | attempt0, attempt1 | attempt0 | 1 | Render only: legs looked stubby (0.55 to 0.7 and 0.6 to 0.74 torso lengths), `countershade` on `limbs` did not make socks, replaced with `grime` (`feet` 1); tail radius trimmed | none |
| b18-griffin | attempt0, attempt1 | attempt0 | 1 | `analyze` warning `limb_intersection` (foreleg 2.3 cm in the torso on flat ground, "about 5 degrees more splay"); plus render: legs too short for a lion, neck steeper, longer tail | none |
| b19-armoured-burrower | attempt0, attempt1, attempt2 | attempt0 | 2 | 1: render showed a huge flared first band at the neck, bare flanks and bands standing off the back like plates (area `all`, `from` 0.1, round cross-section, head shield, bigger claws). 2: `analyze` warning `limb_intersection` (foreleg 0.6 cm in the torso on rough ground), fixed with +6 degrees splay through `patch` | none |
| b20-glow-slug | attempt0, attempt1 | attempt0 | 1 | Render only: the eyes on stalks were 3 mm dots (`eye.basic` `scale` is relative to the head), stalks too thin; fatter body, extra fine glow speckle layer | none |

Every first attempt validated with no errors and no warnings, so I never met a validation error message. `notBuilt`
never appeared for any of the five (none asks for flying or swimming). Nothing in the finals was left unfixed in `analyze`.

## b16-giant-moth

What went well: `hexapod` plus two wing limbs with `membrane.insect`, `antenna` with `"shape": "feather"` and fur on
the torso read as a moth at once. `spots` with `ring` and `region: wings` gives eye spots on all four wings.

Confusing or missing:
- **The Moth recipe row plus `examples/luna-moth.json` is nearly the answer.** The prompt can be solved by adapting the
  example, so this prompt does not test the docs much.
- **The preset's jaw is kept.** `analyze` said "it can bite, look and roar" for a moth. Nothing in the docs says a
  moth should set `"head": { "jaw": false }` and limit `motion.actions`. A "Moth" recipe line saying so would help.
  I only noticed it in the description sentence.
- **The description repeats itself**: "broad insect wings, insect wings". Also colours are named loosely: `#9a7a56`
  is called "orange skin".
- **`bands` on `region: wings`.** `count` counts bands "from snout to tail tip", so on a wing you get one or two
  straight bars, or none (attempt1/2's four thin bands are invisible in renders; attempt0's were bold bars). It is hard
  to predict where a body-wide pattern lands on wings. A note like "on wings, patterns are laid over the wing plate
  itself" (if true) would save trial and error.
- **Glare.** In the 3/4 view the insect wing blows out to pure white from the specular highlight (also on the
  shipped luna-moth render). `membrane.insect` only has `translucency` (I dropped it from 0.2 to 0.05; the glare stayed).
  There is no gloss or sheen control on `membrane.insect` (only `membrane.case` has `sheen`).
- **Fur on thin legs.** `fur.region` can include `limbs` but the coat thickens the leg uniformly, so a moth's legs
  look like a spider's. Fur cannot be limited to the upper leg, and the doc does not say fur adds to the radius.
- **Wings fold flat at rest**, so the default contact sheet shows a tent of wings; you must remember `--pose spread` to
  judge four wings. The docs say so, but a hint in the Moth recipe ("check with `--pose spread`") would help.

## b17-two-tailed-fox

What went well: `tail.count: 2` with `spread`, `pitch` and `curl`, and `foot.paw`, were quick and the result is good.
The tail `radius` profile recipe gives bushy tails.

Confusing or missing:
- **Example equals prompt again** (`examples/two-tailed-fox.json` and a recipe row). Used as a reference only.
- **No way to mark a pale tail tip.** Layers take `region: tail` for the whole tail, but there is no tip mask
  (`from`/`to` along a section, or a `tailTip` region). A white tail tip is the thing most fox readers expect.
- **`countershade` on `limbs`** follows the surface normal (the inner faces of the legs came out dark, outer faces
  orange) rather than giving "socks". The docs describe `height` only for the body (-1 belly, 1 spine). I got socks by
  using `grime` with `feet: 1`, `creases: 0`, `amount: 1`: not obvious, and `grime`'s description ("dirt rising from the
  ground up the legs") hides that it works as a leg colour. A line in the skin section ("for dark legs use...") would help.
- **The `analyze` description labels a limb layer as a belly**: first run said "a cream belly and a dark brown belly"
  for my limb countershade; after the change it says "grime". The description names layers by type, not by region.
- **Two tails look like wings from the front** (spread 26, curled up). That is right for `spread` as documented
  ("degrees between the outermost tails"), but nothing in the docs shows what a good value looks like beyond the recipe's 22.
- **Paws are invisible under fur** on the contact sheet; only the `underside` view shows pads. That view is mentioned in
  the contact sheet options, but worth listing in the fox/paw recipe.
- Quadruped legs "0.5-0.6 torso lengths" (typical lengths line) gave stubby fox legs once fur was on; I needed 0.7.
  A sentence on "fur hides about the length of the coat from the leg" or a fox-like default would help.

## b18-griffin

What went well: `beak` with `lips: 0`, `membrane.feather` wings and `foot.talon` front / `foot.paw` hind compose
immediately. `analyze`'s warning text was exactly right: "about 5 degrees more splay works best" fixed it in one step
(I added 6 and lengthened the legs, no new warning).

Confusing or missing:
- **Example equals prompt** (`examples/griffin.json`, plus the Griffin recipe row).
- **No feathers on head or body**, only fur. To get an eagle's white head I added a palette colour and a head-only
  `countershade` with `height: 1`; that works but is a hack (and the description called it "a cream belly"). A head
  plumage option, or fur `region` with different lengths, would suit griffins, harpies and similar.
- **No mane or longer neck fur.** `skin.fur` is one coat with one `length`; a lion's body (mane, tail tuft) can only get
  a tuft through a tail `radius` profile (the club-on-tail recipe worked). A second fur entry or a region-specific length
  would help.
- **Wing span is large**: wing `length` 1.5 on a 1.1 m torso gives a 5.1 m span. The dragon recipe suggests 1.2-1.8; for a lion-sized
  creature I would expect a hint that span is about 2 x wing length x scale plus the body.
- The head `shape` list has no eagle-like option; `snout` plus a beak is the recipe, and it works, but the head
  reads slightly long behind the beak.

## b19-armoured-burrower

What went well: `armor.bands` is easy to place and `color` takes a palette name. Big digging claws came from
`foot.claw` with `toes` 3, `toeLength` 0.1, `clawLength` 0.18, `clawWidth` 1.8.

Confusing or missing:
- **No armadillo or pangolin recipe row**, and `armor.bands` is not in "Recipes for the new bodies" at all. I had
  to infer the placement from the parameter table.
- **The default `from: 0` is a trap.** The catalogue example and default attach start at 0; with `from: 0` the first
  band flares into a huge flat fan around the neck end (see attempt0's head and front views). `from: 0.1` fixed it.
  The doc should say to start the bands a little behind the front of the torso, or the module should clamp it.
- **Areas do not cover "back and flanks".** `back` is within 70 degrees of the top, `sides` 50 to 130, `all` includes the belly.
  With `back` alone the flanks stay bare and the bands stand off the body like a stegosaur's plates; with `all`
  the belly gets a dark armour ring. I tried two parts (`back` plus `sides`, scratch only) and `all`; `all` looked right.
  An area like `dorsal` (0 to 120 degrees) would match armadillos, turtles and pangolins.
- **`wide` cross-section** (recommended for beetles and tortoises) made the armour a flat slab; `round` was better. The
  armour recipe could say which cross-section to use.
- **Bands read as brown on brown.** The colour worked (`color: "plate"`), but you only see it if the plate colour clearly
  differs from the skin; the docs give no suggestion.
- `analyze` raised `limb_intersection` on rough ground only on attempt1 (attempt0 had none; the change was the round
  cross-section and `all` armour, so presumably the rounder torso): the message was clear and +6 degrees splay through `patch` fixed it. Worth noting the `patch` flow worked in place only on a file, so I copied the
  attempt first (the protocol forbids editing a saved attempt).
- No burrowing action (`dig`), which is fine, but "digging claws" has no module meaning; the claws are only visual.

## b20-glow-slug

What went well: the slug recipe row (serpent, tentacle pair on the head, `eye.basic` at `at` 1, `slime`) worked as
written, and `bioluminescence` plus `slime` give a strong wet-glowing look.

Confusing or missing:
- **Eyes on stalks start as pinpoints.** `eye.basic` `scale` is "relative to the head", so on a stalk a `scale` of 1.6 gives a
  3 mm dot (see attempt0's head view). The recipe does not say to set `size` (torso lengths); with `size` 0.045 the eyes
  became proper bulbs. This is the biggest trap in this prompt. Also not documented: what `angle` means for a part placed on a
  tentacle tip (0 looks up and outward, 90 looks forward; I chose 90).
- **The `serpent` preset is tiny**: scale 0.6, torso radius 0.07-0.09, tail 2.2 long. For a fat slug you rewrite the
  torso `radius`, neck, head and tail entirely, and set `head.jaw` false and `lips`/`tongue`. A "stout legless body" starting point (or the
  recipe giving torso radii of about 0.2) would help.
- **`slither` defaults are very snaky**; I set `amplitude` 0.06, `waves` 1 for a gliding slug. The gaits section
  does not say what values read as a gastropod.
- The description says "a tentacled creature with two tentacles" for the stalks (and counts `tentacles: 2`); a slug is
  not tentacled in the usual sense, but the docs do warn that a head tentacle does not make a swimmer, which was true.
- **Glow shows as flat discs** at 3/4 distance, and pulsing cannot be judged in stills (the filmstrip shows frames,
  not the glow). A tiny hint ("glow pulse is only visible live") would save looking for it.
- Large bioluminescent spots plus fine speckle (two layers of the same type) worked, but the docs never say that the
  same pattern type can be used twice; only the `id` field hints it.

## General

- Renders are 10 to 20 s and could run in parallel without problems.
- `spawnforge patch <file> '[]' --help` prints only the global usage; per-command help (`patch --help`) would help.
- Three of five prompts have a matching example and a recipe row (moth, fox, griffin), so those tests are weak for
  measuring how the docs alone guide a newcomer. b19 and b20 were the informative ones.
- No validation error occurred in any of the 5 first attempts, so I cannot judge the error text from this batch; the two
  `analyze` warnings (`limb_intersection`) were clear and their fix amounts were right.
