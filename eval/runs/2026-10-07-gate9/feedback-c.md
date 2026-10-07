# Gate 9 feedback, agent C (p11 to p15)

Worked only from `docs/blueprint.md`, `docs/catalog.md`, `examples/` and the CLI. Renders went to the
scratch folder. Every saved attempt was validated, rendered and analyzed. The `limb_intersection`
fixes needed unsaved variants of an attempt in the scratch folder: I ran `analyze` only on those
(4 for p12, 8 for p14, a few for p15), and the winning variant was then copied verbatim into the
next attempt file. See "Tool feedback" for why that was necessary.

## Summary table

| Prompt | Attempt files | First valid | Revisions after it, and what drove them | Final `analyze` warnings |
| --- | --- | --- | --- | --- |
| p11-sea-serpent | attempt0, 1, 2 | attempt0 | 2. (1) Render looked like a stick: 4.3 m long but 33 cm tall, spikes only ticks. I thickened the torso, lengthened the neck with `pitch` 38 and `curve` 30 for a rearing head, and made spikes taller. (2) Spikes taller again so they read in the side view. | none (`validate` lists `motion.media.water` under `notBuilt`, kept) |
| p12-raptor | attempt0, 1, 2, 3, 4 | attempt0 (already clean) | 4. (1) Cosmetic: `body.muscle` 0.7, brow, bigger thighs. This introduced `limb_intersection` (3.6 cm, leg.L into leg.R). (2) angle 90 and thinner thigh: 1.8 cm. (3) angle 80 and splay 10: 2.0 cm, worse. (4) angle 100, thigh `radius` [0.12, 0.055, 0.03] and leg `muscle` 0.45: clean. Three of the four revisions chased a regression I caused. | only `not_built` for gait `run` (kept on purpose) |
| p13-cave-bear | attempt0, 1, 2, 3 | attempt0 | 3. (1) Render was a blob with the head swallowed by the torso, plus `limb_intersection` 13.9 cm: thinner torso, longer neck, bigger snout head, longer legs with splay 20 (2.9 cm left). (2) splay 26 cleared it; fangs smaller, scars removed, grime stronger. (3) Lighter brown palette and a longer, narrower snout so it reads as brown and as a bear. | none |
| p14-leopard-stalker | attempt0, 1, 2, 3, 4 | attempt0 | 4. (1) Head, leg and ear changes; foreleg `limb_intersection` 1.7 cm stayed. (2) Splay on both leg pairs (17 and 12): clean. (3) Added tail spots and bands. (4) The tail layers were hidden by a later `countershade` on the tail, so I reordered the layers. | none |
| p15-gecko | attempt0, 1 | attempt0 | 1. Toes were thin hairs, so I raised the limb tip radius and `toeLength`, widened the torso and added subtle warts. | none |

## p11-sea-serpent

- Missing from the docs: there is no sizing guide for "thick" serpents. The `serpent` preset gives a
  4.3 m animal 33 cm tall, so a sea serpent read as a stick. I had to guess the torso radius profile.
  The sizing sentence ("a serpent about 3.5 x `scale`") covers length only. A line such as "multiply the
  torso `radius` by 1.5 for a sea serpent or python" would help.
- Spike heights are in torso lengths. With a 1.4 m torso and a 2.8 m tail, the recipe's `[0.06, 0.12, 0.05]`
  makes spikes that read as ticks on a 5 m animal. The recipe could say "height is relative to the torso,
  not to the whole spine; raise it for long bodies".
- `analyze` lists `parts` as eyes and the tail fin only, with no spike row, while its `description` says
  "a row of 46 spikes". Rows seem to be left out of `parts` (and the `counts` line).
- `fin.tail` on a very long thin tail leaves a small dark disc at the tip, which looks odd. There is no
  guidance on `size` against tail tip radius.
- `media.water` is `notBuilt` and `validate` says so clearly. But `analyze.warnings` was `[]` for it,
  while for p12 the same kind of entry (`run` gait) did appear in `analyze.warnings`. The two commands
  treat `not_built` differently.
- `neck.curve` plus a neck `pitch` of 38 gave a good rearing head on a serpent with no trouble. The
  recipe table only mentions the cobra for this, so a sea-serpent neck line would help.
- No error messages were wrong or unhelpful here.

## p12-raptor

- The prompt says "runs", but `run` is not built. The docs do give the workaround (`walk` with `duty` 0.4),
  and I added `run` as well so it appears later. The filmstrip then shows a brief airborne phase. This
  worked well. `validate` output for `notBuilt` was clear and told me to keep it.
- "Long stiff tail": there is no stiffness parameter for tails (the docs mention tail springs on `lash`
  and the idle swish). I used `curl` 0 and `pitch` 0. A note in the docs on what "stiff" maps to would help.
- The `limb_intersection` fix text sent me the wrong way. It said "attach both higher up the side (a lower
  `attach.angle`) or make them thinner (`radius`); splay barely helps here". Lowering the angle from 104
  to 90 and then 80 did not help (1.8 cm, then 2.0 cm). Only a thinner thigh `radius` plus angle 100 did.
  Reasons it is hard to follow:
  - The warning does not say that `body.muscle` swells thighs beyond the `radius` profile.
  - A leg-level `muscle` override on its own changed nothing (3.6 cm both times), so I could not tell whether
    it works on thighs.
  - The fix should name the smaller of the two: "radius [0.14, ...] to about [0.12, ...]".
- The warning reports one leg and one cm figure at a time, so every try is one more attempt.
- A recipe for a raptor body (torso `pitch` 8-10, legs `at` 0.6, tail `pitch` 0) is in the docs and worked
  at once. attempt0 was already clean.

## p13-cave-bear

- Missing from the docs: a recipe for bulky bodies. With torso radius [0.24, 0.32, 0.3, 0.25] and `muscle`
  0.8, the head (radius 0.17, length 0.36) disappeared into the chest and the render was a featureless blob.
  Nothing says how torso, neck and head radii relate. What worked for me was a head radius near 0.6 of the
  chest radius and a neck of 0.28 torso lengths. A bear or boar recipe like the other rows would help.
- "Huge claws" had no direct knob. `foot.paw` has `claws` as an enum only (`hidden`, `short`, `long`), so
  the bear-like `long` cannot be made bigger. I switched to `foot.claw` (`toes` 5, `clawLength` 0.15,
  `clawWidth` 1.4) and set `"stance": "plantigrade"` by hand. The docs say `foot.claw` suggests no stance,
  and I could not tell whether the planted foot then rolls. The catalogue could say which foot a bear wants.
- The `limb_intersection` fix ("about 20 degrees more splay") fixed the warning but turned the bear into
  a sprawler. `analyze` then described it as having "sprawling legs", which is not what a bear is. The
  fix text should prefer "a thinner body" for a bulky creature; thinning the torso (0.32 to 0.26) was
  what mattered most.
- `foot.claw` toes are `horn` material and `clawColor` is separate, which was nice. `teeth.row` with
  `fangs` 1 and `fangScale` 1.3 gave walrus-like tusks on a bear. Bears need visible canines but not fangs,
  and there is no setting between `fangs` 0 and a long fang.
- `grime` at `amount` 0.8 to 1.0 is faint on a dark hide; `grimy` needs a custom darker `color`. The
  `scars` layer shows as pale feather-like decals on dark hide and looked wrong.
- `material: "hide"` shows a wrinkle network on the head close-up that reads well. No complaints there.

## p14-leopard-stalker

- The biggest time loss was layer order. Layers are "bottom first", but the docs recipe "A colour only on
  the tail" (a `countershade` with `region` "tail") does not say it must come near the bottom. I put it last,
  and it silently covered the tail `spots` and `bands` I added. I lost three attempts before I noticed.
  `validate` and `analyze` gave no warning that a full-strength layer over a region hid the layers below.
  A `layer_covered` warning, or a sentence in the Skin section, would have saved this.
- `limb_intersection` whack-a-mole: more splay on the forelegs (12, then 17, then 20) moved the warning
  to the hindlegs, and it appears only on rough or only on flat ground depending on the variant. The
  warning names one leg at a time. A combined suggestion ("both pairs need about 5 degrees") would help.
  I solved it with fore 17 and hind 12.
- No cat recipe. A `round` head with a wide mouth reads as a frog from the front; I got a cat face with
  `snout` shape, a short `length` 0.24 and ears near `at` 0.82 and `angle` 38. A cat head line would help.
- Leopard spots: the catalogue gives both `rosettes` ("leopard-like") and `spots` with `ring`
  ("leopard rosettes to sparse blotches"). Which one is right is left open. `rosettes` on the torso plus small
  `spots` on legs and head read well; the docs do not say that spots show through short fur.
- "Tail curled at the end": the docs line `"curl": 160, "curlStart": 0.6` worked unchanged. The best part
  of the docs for this prompt.
- The `analyze` description reads "orange skin, a cream belly, an orange belly" because of my tail
  `countershade` layer; layers of the same kind are described as extra "bellies". Small wording issue.

## p15-gecko

- Missing: a lizard or gecko recipe. I assembled it from three places: the `wide` torso and the "flat, broad
  head" recipe, the sprawl advice (splay 55-60, attach angle 110-120), and the `frilled-lizard` example.
- "Five big toes": `foot.claw` `toes` 5 works, with `spread` 120-130 and long `toeLength`. Toe thickness
  follows the limb's tip radius, which the docs never say. At first the toes were hair-thin; I raised
  the leg radius tip to 0.045. `foot.paw` gives five stubby toes with pads but cannot be made big (`size`
  tops out at 2). There is no way to draw a gecko's toe pads.
- "Wall crawler": there is no climb gait or wall surface. I could only suggest it with a flat body,
  splayed legs and big toes. Docs could say plainly that climbing is not modelled.
- `fast_cadence`: at `scale` 0.3 the trot is 9.7 steps a second. With `calm` or `stalking` temperament
  the warning fires; with `skittish` it does not, and the cadence figure is the same. The docs mention
  `skittish` as the answer for tiny creatures, but that reads as a silent waiver rather than a fix.
  I kept `skittish` (a gecko is jumpy) and `scale` 0.3. The warning text said
  "make them bigger"; scale 0.35 with `skittish` is also clean, but does not lower the cadence much.
- `lids: false` on the eyes was easy to find and right for a gecko.
- The `analyze` description calls my olive-grey (#8c8a62) base "yellow scales", which could mislead a
  reviewer. Colour naming leans toward yellow for desaturated olives.

## Tool feedback that applies to all five

- `analyze` prints about 400 lines of JSON per run; I always filtered with Python for `warnings`,
  `description` and `stability`. A `--summary` flag would remove that.
- `validate.warnings` is empty, but `analyze.warnings` and the `render` `info.warnings` carry `not_built`
  items for gaits (and not for `media.water`). "No warnings" is therefore ambiguous. Treat `not_built` as
  its own list everywhere.
- With a cap of five attempts, trying a fix costs an attempt. `patch --dry-run` shows the diff but does not
  run `analyze`, so I used scratch copies. An `analyze --patch '<ops>'` (or `patch --dry-run --analyze`)
  would be the natural way to test a `limb_intersection` fix.
- Renders took 7 to 12 s each and were reliable. `--views head,top,3/4 --size 800 --quality high` was
  the best way to check spots and toes.
