# Gate 12, agent A: feedback

Prompts p01 to p05, written from `docs/blueprint.md`, `docs/catalog.md` and `examples/` only, using the
CLI (`validate`, `render`, `analyze`, `patch --out` for scratch variants). Renders are in the agent's
scratch folder, not in the repository. I did not open any other file in this run folder.

## Summary

| Prompt | Attempt files | First valid | Revisions after it | What drove them | Final `analyze` warnings |
| --- | --- | --- | --- | --- | --- |
| p01-wolf | attempt0 to attempt3 | attempt0 | 3 | a1: `limb_intersection` warning (fixed by its "5 degrees more splay") and the pale belly did not show; a2: mottle covered the belly again, restricted it to `back`; a3: `analyze` said 142 kg and 2.3 m, render read as a low otter, so smaller `scale` and longer legs | none |
| p02-spiked-lizard | attempt0 to attempt2 | attempt0 | 2 | a1: `ground_penetration` on the tail (fixed by tail `pitch`), spikes too small to read, club was a ball on a thread; a2: thicker tail so the club reads as a thick tail | none |
| p03-horn-beetle | attempt0 to attempt4 | attempt0 | 4 | a1: added wing cases for a beetle silhouette; a2: tried to get spots onto the cases (region `all`); a3: dropped the cases because layers never show on them, rounder body and bigger horn; a4: eyes were sub-millimetre, `scale` 1.8 | none |
| p04-green-serpent | attempt0 to attempt2 | attempt0 | 2 | a1: rear the front up, bigger head, shorter fangs (this also hooked the head into the ground, `ground_penetration`); a2: straight raised neck, head `pitch` 0 | none |
| p05-swamp-troll | attempt0 to attempt3 | attempt0 | 3 | a1: recipe tusks (`aim` "up") came out asymmetric, so used lean/curve tusks and a bigger head; a2: `limb_intersection` between the legs (lower leg `attach.angle`); a3: tusks moved down to the jaw rim so they read as tusks, not horns | none |

Final answers: `p01-wolf.attempt3.json`, `p02-spiked-lizard.attempt2.json`, `p03-horn-beetle.attempt4.json`,
`p04-green-serpent.attempt2.json`, `p05-swamp-troll.attempt3.json`. All five attempt0 files validated with
no errors and no warnings, so I met no validation error message at all and cannot judge their quality.
Every revision came from a render or from `analyze`.

## What worked well

- The recipes table is the most useful part of the docs: the beetle horn, the club tail, the
  bushy tail, the flat-head tusks and the snake's mouth were all one lookup each.
- `analyze` fix texts that give an amount worked first time: "about 5 degrees more splay" (wolf) and "a
  lower attach.angle" (troll legs).
- `render --views head --jaw 0.8` and `--filmstrip --action roar` are the quickest way to check teeth,
  fangs and tusks. The roar strip showed the troll's jaw tusks moving with the jaw.
- `patch --out` into a scratch folder made it cheap to try tusk variants without touching attempts.

## p01-wolf

- **Size and leg length.** The docs say a wolf is about `scale` 0.7, but the `grey-wolf` example uses
  0.9 with legs 0.62, and "Typical lengths" gives dog-like legs 0.5 to 0.6. Following that (scale 0.95, legs
  0.62) gave a 2.3 m, 142 kg animal that looks like a long otter. What fixed it was `scale` 0.8 with legs
  0.85 and 0.88 (1.9 m, 78 kg, 85 cm tall), which no document suggests. A wolf or dog recipe in the "Big
  mammals" table (scale, torso radius, leg lengths, neck pitch) would save this iteration. `analyze` could
  also flag a mass or leg-to-body ratio that is far off for the description.
- **Fur.** The bushy-tail recipe says `"fur": { "length": 0.06, "region": "tail" }`, but `skin.fur` is a
  single object with one `length`, so a longer tail coat means a bare body, or one length everywhere. I
  used a thick tail `radius` profile and a uniform 0.03 coat. Per-region fur (a list, or a `tail` length
  multiplier) is missing, and the docs do not say it cannot be done.
- **Pale belly.** `countershade` `height` says "-1 belly, 0 flank, 1 back", and it is not obvious
  that a higher value makes a larger pale area. At the default (-0.1) the belly is invisible from the
  side. The `grey-wolf` example's 0.4 was what worked. A `mottle` on `region: all` then covers the belly
  again, so I had to restrict mottles to `back`. The docs' order note covers layer order but not this
  interplay. Also, 0.4 pales the whole legs (white socks) because legs count as underside; the docs do not say
  which region name would limit `countershade` to the torso.
- `analyze`'s description called a 0.46-length snout head "a big head" and listed `lash` and `jump`
  for a wolf (they follow from leaving `actions` out); both read oddly.

## p02-spiked-lizard

- **Club tail.** The docs' profile for a tail club (`[0.15, 0.12, 0.1, 0.1, 0.14, 0.24, 0.25, 0.08]`) gives a
  ball on a thin stalk on a short, thick tail. "Thick, club-like tail" needed the neck of the tail thickened
  too (`[0.17, 0.15, 0.14, 0.14, 0.17, 0.22, 0.24, 0.18]`). A one-line note on what the profile looks like
  would help.
- **Tail in the ground.** The `ground_penetration` fix says "lengthen the legs, raise the section (pitch,
  curl) or make it slimmer". It works, but it gives no amount; "about 4 degrees more pitch" would be better.
  It also appears only on rough ground, and the message names that.
- **Spikes along the spine.** `spikes.row` on `spine` uses fractions of neck + torso + tail, so to
  run spikes from the neck over the back and onto the club I had to work out the fractions myself
  (0.08 to 0.75). `analyze` could print where each row falls (which sections, which torso share).
- `armor.bands` with `scales: true` reads as a flat rectangular shield, with a fan-like edge seen from the
  front, not as plates that wrap the flanks; fine for "armoured", but the docs only describe the armadillo case.

## p03-horn-beetle

- **Wing cases ignore skin layers (the main problem).** I put cases on (`membrane.case`, as in
  `rhino-beetle`) and then spots with `region: "wings"` and with `region: "all"`; neither showed on the
  case, which stays plain black (checked at density 1, size 0.15). The cases hide the torso's back,
  so the orange spots on the back disappeared. The docs say `wings` covers "wing and fin membranes" and
  "layers of any other region leave membranes their own colour", which suggested `wings` would work. A beetle
  with spotted elytra is not possible as documented. Please either make cases take layers or say that
  they do not. The case also rendered as a flat dark slab standing up behind the shoulders in the side view
  (the same shape is in the rhino-beetle sheet). I dropped the cases.
- **Eyes on a tiny head.** At `scale` 0.12, `eye.basic` `scale` 0.9 gave an eye radius of 1 mm, which is
  invisible on the contact sheet. The docs' "scale 2 to 3 for cartoon eyes" does not warn that small
  creatures need much more.
- **Flight numbers.** With cases and wings on, `analyze` said the 0.3 kg, 16 cm-span beetle "flies at about
  33 m/s" with no `cannot_fly` warning. That cannot be right for an insect.
- **Round body.** Hexapod proportions (head + neck + torso) give 21 by 14 cm, longer than a beetle. It
  reads as an elongated bug, not a round beetle, and I found no recipe for a stout body (how large a torso
  `radius` is sensible on `wide`).
- Worked directly from the docs: dark base `#1c1a1e` with `chitin` for glossy black; horn recipe (`at` 0.2,
  `curve` -75); spots at `size` 0.07 to 0.08; `skittish` removed the `fast_cadence` warning as the docs
  say. Labels overlap badly on a creature with four wing parts (`case.L.membrane` and so on).

## p04-green-serpent

- **Accent colour leaks into other layers.** The serpent preset's `scales` layer defaults `gapColor` to
  `accent`. With a yellow accent for the stripes, the scale gaps would be bright yellow. I only caught this
  because I read the catalogue's default. The Skin section should say that `accent` is the default
  colour of stripes, spots, scale gaps, scars and more, and that a bright accent needs the other layers'
  colours set by hand.
- **Raising the neck.** `neck.curve` 40 with neck `pitch` 45 and head `pitch` -15 hooked the head back down
  into the ground (8.6 cm, `ground_penetration` on `body.head`) and looked like a caterpillar. The warning's
  fix names `pitch` and `curl` and "lower the torso pitch", none of which is the knob here (`neck.curve`
  or the head `pitch`). I got a clean result with a straight neck at `pitch` 35 and head `pitch` 0. A
  note on combining `curve` with the head's `pitch` would help.
- `fangScale` 2.2 gave plank-like fangs on a big head; 1.7 reads as long. The docs' "2 is sabre-like" is
  right, but "long fangs" on a snake wants less than the number suggests.
- At 8 m the creature is a thin line on the default six-view sheet. A `--views 3/4,head` pair is more
  useful for a snake.

## p05-swamp-troll

- **The tusk recipe does not mirror.** The recipes row says tusks on a flat or wide head want `aim` "up",
  `angle` about 90 and `length` 0.22. With `side` both on the jaw (at 0.25, angle 90, then also at 0.15,
  angle 85 with `curve` -30) the pair was visibly asymmetric: the left tusk long and standing up beside the
  eye, the right one short or lying along the lip (top view); in the second try one swept straight out and
  back, the other forward. The docs say pairs are mirror images. Either `aim` has a bug on the jaw, or
  the recipe needs different numbers.
- What gave real tusks was no `aim`: `on` jaw, `at` 0.15, `angle` 85, `length` 0.18, `curve` -60, `width`
  0.025. With the `bog-troll` example's values (at 0.3, angle 55) the tusks were symmetric but grew from the
  top of the head beside the eyes, so they read as horns. The docs do not explain how the attach point on
  the jaw maps onto a flat head, so this took four renders.
- **Head size.** The preset's head radius (0.13) next to a big troll torso looked like a small cap on a
  huge body from the front, so I took the head to 0.18. A troll or ogre recipe row (head radius against
  torso radius, `crossSection`) is missing.
- `limb_intersection` of the two legs came from the wide biped torso and the preset's leg `angle` 130. The
  fix text ("a lower attach.angle") was exactly right. It may be worth setting a lower angle in the biped
  preset itself when the torso radius is raised.
- The `biped` preset's `crossSection` "wide" makes a 78 cm wide blob in the top view with a radius of 0.25.
  I kept it, with narrower radii. Mottled green came out well with two `mottle` layers (one accent, one
  lighter) and `material: "hide"`.

## Tooling

- `render` prints a long JSON block on stdout (all warnings, timings, the motion block); I `tail`ed or
  `grep`ed it every time. A `--quiet` that prints just the PNG path and the size line would help.
- Each render takes about 20 s whatever `--views` is. Fine, but it dominated the run.
- `analyze` without `--summary` is several hundred lines; `--summary` already had everything I needed.
- No error messages were exercised: every first blueprint validated. `validate` finds nothing wrong with
  problems that only a render shows (asymmetric tusks, case spots, eyes under a millimetre), so a warning for
  `eye.basic` smaller than about 2 mm, or for a layer whose `region` matches nothing it can paint, would
  catch two of the three.
