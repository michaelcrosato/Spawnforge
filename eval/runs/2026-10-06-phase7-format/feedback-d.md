# Spawnforge usability feedback (run d, prompts b16 to b20)

Method: I read all of `docs/blueprint.md`, all of `docs/catalog.md` and the four `examples/*.json`, then wrote
each blueprint, validated it and fixed errors. I used `validate`, `list-modules` and `describe-module` only. I did
not read source, did not render or analyze, and did not open the other runs' files that were already in `out/`
(`b01` to `b15`, `feedback-a.md`, `probe-*.json`). I used `python3` only to pretty-print the JSON that `validate`
prints.

## Results per prompt

| Prompt | Attempts | Errors | Final state |
| --- | --- | --- | --- |
| b16-giant-moth | 1 (`attempt0`) | none | ok, 0 warnings, 7 notBuilt |
| b17-two-tailed-fox | 1 (`attempt0`) | none | ok, 0 warnings, 8 notBuilt |
| b18-griffin | 2 (`attempt0`, `attempt1`) | `attempt0`: 1 error (see below) | ok, 0 warnings, 14 notBuilt |
| b19-armoured-burrower | 1 (`attempt0`) | none | ok, 0 warnings, 7 notBuilt |
| b20-glow-slug | 1 (`attempt0`) | none | ok, 0 warnings, 7 notBuilt |

### b18 griffin, the only error

`attempt0` listed `"display"` in `motion.actions`, expecting the wings to spread in a threat display. Validate said:

```
path: motion.actions[4]   code: missing_feature
message: "display" needs a display
fix: add a part or limb that provides "display" (list_modules shows what provides it)
```

`attempt1` removes `display` from the list. Nothing else changed. The error was my fault, but the docs invited it
(see "Docs problems", item 1).

### notBuilt items I kept (all intentional)

- Moth: `antenna`, both `wing` limbs, both `membrane.insect`, `skin.fur`, and `motion.media.air`. I never wrote
  `media`; it is derived from the wings.
- Fox: `foot.paw` on both leg pairs, `stance` (derived from the paw), `body.tail.count`, `skin.fur`,
  the `bands` layer and the `pounce` action.
- Griffin: `beak`, `foot.talon`, `foot.paw`, the feather `membrane`, the wing `role`, `skin.fur`, `jump`, `pounce`,
  `motion.media.air`, and the head fields `lips`, `tongue` and `brow`.
- Armadillo: all three `armor.bands` parts, the `bands` layer, and `material: "hide"`. The explicit `stance` was
  flagged too.
- Slug: the `warts`, `slime` and two `bioluminescence` layers, both tentacle limbs, and `head.tongue: "none"`.

## Docs problems (unclear, missing, wrong, or hard to find)

1. **`display` action: the description says wings count, the validator says they do not.**
   - `catalog.md` (`display`) and `describe-module display` say: "Threat display: opens frills and hoods, raises
     quills and sails, **spreads wings**."
   - `blueprint.md` (Motion) says: "`display` (opens frills and hoods, raises quills, _9.5_)", so no wings there.
   - `describe-module display` says `"needs": ["display"]`. The `list-modules --kind part` output shows the tag
     `display` only on `frill`, `hood`, `quills` and `sail`, not on any wing membrane.
   - A griffin with feathered wings therefore cannot list `display`, even though the action text says it spreads
     wings. Either make wings provide `display`, or remove "spreads wings" from the action's summary.
   - The error fix says "`list_modules` shows what provides it". I found no `provides` field or filter in
     `list-modules`. I had to infer the answer from the `tags`.
   - The catalog's `needs: ["display"]`, `needs: ["jaw"]` and `needs: [["tail","tentacle"]]` are never explained.
     The nested-list form is the hardest to read.

2. **`skin.fur` and `motion.media` say "object (below)" but no table follows.** The catalog rows for `fur` and
   `media` (Blueprint fields, `skin` and `motion`) both end in "(below)". There is no `skin.fur` section and no
   `motion.media` section. I got the fur keys (`length`, `density`, `region`) and the media switches (`land`,
   `water`, `air`) from guide prose and one example in the guide. I could not find the fur defaults, the fur
   ranges, whether fur has a colour or follows the palette, or whether `fur.length` has a maximum. Other runs seem
   to have hit the same gap (there is a `probe-fur-range.json` in `out/`), though I did not open it.

3. **The "What is built so far" section is mis-titled.** The text says "Everything below validates now. Compile
   draws what is built and skips the rest", and the column is "Built in milestone". Almost nothing in that table is
   built today. My five blueprints were mostly made of those features, and `notBuilt` was 7 to 14 items each. I read
   the heading as "available now" and had to rely on `notBuilt` to learn the truth. Suggested heading: "Features
   that validate but are not drawn yet (by milestone)".

4. **Not-built status is tracked per module in the catalog but not per field.** I only learned that these are
   unbuilt from `notBuilt`: `body.head.lips`, `tongue` and `brow`, `body.tail.count`, `limbs[].stance` and
   `skin.material: "hide"`. For example, `tongue: "none"` counted as not built because the default is `flat`.
   The catalog's blueprint-field tables show no "not built" marker. A column or suffix would let an author avoid
   guessing. Also, `stance` appeared in `notBuilt` for legs where I never set it. It is derived from the foot, so
   it looks like my error until you read "Left out, the foot suggests one (_8.2_)".

5. **`membrane.*` catalog entries give the wrong usage line.** Each says `Add to "parts" with "type":
   "membrane.bat"; parameters go in "params".` The guide says the opposite: membranes go in a wing's `membrane`
   field, "not `parts`" (Parts table, "membrane" slot). `describe-module membrane.insect` carries the same wrong
   text. I followed the guide and `validate` accepted `"membrane": { "type": "membrane.insect", ... }`. The
   `foot.*` entries get this right ("Set as a limb's foot"), so the membrane ones look like a template slip.

6. **The moth recipe is too thin for "four wings".** It says "`hexapod`; two wing pairs with `membrane.insect`
   (`"shape": "broad"`)". It does not say that the two pairs need different ids, or what `at` to give each. A wing
   defaults to `at` 0.2 and `angle` 40, so two default wings would sit on top of each other. It also does not say
   how the wing positions should relate to the hexapod's legs, which sit at `at` 0.1, 0.22 and 0.34. I picked
   0.14 and 0.3 with ids `forewing` and `hindwing`. Nothing validated that choice, and there is no overlap or
   wing-clearance check.

7. **Tentacles silently change the default medium.** The guide says `water` is on by default "for a body with fins
   or tentacles and no legs". A slug that uses tentacle limbs for eye stalks therefore becomes a swimmer unless you
   add `"media": { "land": true, "water": false }`. I only caught this because I re-read the Motion section.
   `validate` gave no hint, and neither did the tentacle table row. A one-line "side effect" note in the Tentacles
   bullet would help. A `notBuilt` or `info` line for "derived media: water" would help more.

8. **Parts attached to an unbuilt limb.** My slug's eyes are attached to a tentacle (`on: "eyestalk"`). Tentacles
   are not built, so right now the creature presumably has no eyes at all. `validate` does not warn about a part
   whose host limb is skipped. The same would apply to a part riding on a wing, such as a claw on a wing. A
   `part_on_unbuilt_host` note would stop authors from "fixing" it by adding duplicate eyes on the head.

9. **Stalked eyes are undocumented.** There is no recipe or module for "eyes on stalks". I used a tentacle limb on
   the head, plus `eye.basic` with `attach: { on: "eyestalk", at: 1, angle: 20 }`. This follows the guide's general
   rule that `on` may name a limb id and that `at` runs root to tip on limbs. I am unsure of three things:
   - whether `angle` on a limb tip does anything useful. The guide says "On a limb, 0 is the limb's front face".
   - whether `side` should be omitted, since the limb pair is already mirrored. I omitted it, because the guide
     says a part on a mirrored limb gets one copy per side.
   - whether `at: 1` is the tip or just past it.

   The guide mentions only once ("tentacles also to the head") that tentacles can attach to the head.

10. **Nothing for slug-like bodies.** `serpent` is the nearest preset, but it brings a 2.2-torso-length tail, a
    scales material, a scale layer and a slither with amplitude 0.18. I overrode all of that. For a glide I guessed
    `{ "type": "slither", "amplitude": 0.03, "waves": 1 }`. The guide never says what a very low amplitude looks
    like, or whether a "crawl" is possible.

11. **Layer docs do not say how layers composite.** Is the order of `slime`, `bioluminescence` and `warts` meaningful
    for emissive layers? The guide says only "bottom first". It does not say whether `region: "wings"` paints over a
    membrane's own `color`, or whether the membrane colour is the base under the layers. I gave the membranes a
    palette colour (`"color": "wingBase"`) and layered patterns on `region: "wings"`. That validated, but I do not
    know what it will look like.

12. **Smaller points.**
    - The guide's griffin and moth recipes are one-liners. I would have liked one full worked JSON for each
      "new body" recipe, as `examples/` has for the older ones. All four examples are older, built-only creatures,
      so nothing in `examples/` shows wings, tentacles, fur, count or the new feet.
    - `armor.bands` takes `attach.area` and the guide says area parts can sit on any section. It does not say
      whether `from` and `to` are fractions of the section (I assumed so) or whether `bands` is fixed regardless of
      `from` and `to`. I used the same `area` on `head` and `tail` and it validated.
    - On the first pass, a blueprint with errors prints `notBuilt: []`. The not-built items of my failed griffin
      only showed after the fix. This is consistent with "errors hide checks", but it means you cannot plan both at
      once.

## What I guessed wrong first

- **Griffin `display`** (the only wrong guess that failed validation). I assumed `display` covers "spreads wings",
  from the action's own catalog summary. Fixed by deleting it.
- Guesses that validated but I am unsure of. I list them so a reviewer can check them against a render:
  - Fox tail tip: `bands` with `count: 2`, `width: 0.12` and `region: "tail"`, hoping for a pale tip. But `count` is
    "Bands from snout to tail tip", so it probably will not land on the tip. I cannot place a tip colour.
  - Griffin white head: `mottle` with `coverage: 1` as a "solid colour on a region" hack.
  - Fox dark socks: a `mottle` on `region: "limbs"` for the same reason.
  - Slug media: `{ "land": true, "water": false }`.
  - Slug eye `angle: 20` and omitted `side`.
  - Armadillo: an explicit `stance: "plantigrade"`, and `armor.bands` with `scales: true` on the head.
  - Wing `attach.at` values for the moth.
  - Fur `length` values (0.03 to 0.04) taken from the one example in the guide.

## What I wished the format could say

- **Solid or tinted region and tip colours.** A layer such as `fill` or `tint` with `region` (a white eagle head, dark
  fox socks), and one that tints along the body axis (`from` and `to` on the spine, or a `tip` share) for a white
  tail tip, dark ear tips or a pale beak base. `bands` counts from snout to tail tip, so it cannot do this. Layers
  take `region`, but regions are coarse (`head`, `limbs`, `tail`), with nothing for "tail tip", "feet" or "wing
  tips".
- **Fur controls.** Fur colour, per-region length (a bushy tail versus short body fur), and a mane or ruff. A lion
  mane, a fox's bushy tail, a moth's thick thorax fur and a griffin's feathered neck are all "fur longer here".
  A `tuft` part (tail-tip tuft, ear tufts) would cover the lion tail, the eagle crest and ear tufts.
- **Feathers.** `membrane.feather` is wings only. An eagle head and neck ruff, and feathered legs, have nothing but
  a `scales` layer hack. An `ear.pointed`-like `crest` or `feather.tuft` part would be enough.
- **Stalked eyes as one concept.** `eye.basic` with a `stalk` length, or `eye.stalk`. It would also keep the eyes
  when tentacles are not built, and avoid flipping `media` to water.
- **Slug and snail basics.** A `mantle` or saddle area on the back, and a snail shell with a spiral (`shell` is
  turtle-like: dome and scutes). A `foot fringe`. A crawl gait that is not a snake wiggle, such as a pedal-wave
  glide.
- **Burrowing.** `media` has `land`, `water` and `air`. There is no `burrow`, no `dig` action, and no way to curl
  into a ball (an armadillo's defence). For an armadillo, `display` could mean "roll up". Better would be a `curl`
  or `roll` action, or `armor.bands` providing it.
- **Wing control.** A resting pose for wings (a moth holds its wings flat over its back), and a way to set a wing
  pair in one entry, for example `pairs: 2` or `forewing` and `hindwing` presets. I also wanted wing-colour
  patterns such as eyespots tied to the wing (my `spots` on `region: "wings"` are laid out over the whole body, per
  "the pattern itself is laid out over the whole body", so eyespot placement on a wing is not controllable).
- **A "provides" view.** `list-modules --provides display` (or similar), and an `analyze`-free way to ask "which
  of my parts provide X" would have saved the one failed validation.

## Summary

All five blueprints validate with no errors and no warnings. Four passed on the first attempt. The griffin needed
two, because I listed the `display` action, which the validator says needs a frill, hood, quills or sail, not
wings. The catalog's own summary of `display` ("spreads wings") contradicts that. Most of what I wrote is `notBuilt`
today (wings, fur, feet, armour, tentacles, bioluminescence and slime), so validation is a weak check on whether the
creatures will look right. The biggest doc problems, in order:

1. The `display` contradiction.
2. The missing `fur` and `media` tables.
3. The mis-titled "What is built so far" section.
4. The wrong usage line on the `membrane.*` entries.
5. No guidance for stalked eyes, or for what the default `media` becomes when a tentacle is used as decoration.

Final files are in `out/`: `b16-giant-moth.attempt0.json`, `b17-two-tailed-fox.attempt0.json`,
`b18-griffin.attempt1.json` (`attempt0` kept), `b19-armoured-burrower.attempt0.json`,
`b20-glow-slug.attempt0.json`.
