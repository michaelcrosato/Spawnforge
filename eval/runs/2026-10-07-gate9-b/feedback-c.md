# Gate 9 suite B, feedback C (prompts b11 to b15)

Worked from `docs/blueprint.md`, `docs/catalog.md` and `examples/` only (I read the JSON of
`plated-stegosaur`, `sail-back`, `frilled-lizard`, `stone-tortoise`, `tusk-boar`, `porcupine` and the
PNGs of `stone-tortoise` and `tusk-boar`). Renders went to the scratch folder. Every attempt was
saved as a new file and validated; each next attempt was made by copying the previous JSON and
changing it with a small script (see "patch" below for why not `patch`).

## Summary

| Prompt | Attempt files | First valid | Revisions after it, and what drove them | Final analyze warnings |
| --- | --- | --- | --- | --- |
| b11-sea-turtle | `b11-sea-turtle.attempt0` to `attempt3` | attempt0 | 3. a1: fatter flippers, brown shell with dark seams, added a `beak` (render showed the beak swallowing the whole round head and hiding the eyes). a2: head `snout` instead of `round`, eyes moved back, `dome` 0.9, smaller beak. a3: beak and eyes polish, a barely visible change | 1: `not_built` for `swim.flap` (cannot be fixed; `media.water` is also under `validate`'s `notBuilt`) |
| b12-quillback-boar | `b12-quillback-boar.attempt0` to `attempt2` | attempt0 | 2. a1: sturdier shoulders (`muscle`, torso `pitch`, longer forelegs), longer snout, bigger tusks and hooves, stronger scars; render showed the scars as huge pale paint patches and the tusks as bull horns. a2: scars and tusks toned down (render showed claw rakes) | none |
| b13-frilled-lizard | `b13-frilled-lizard.attempt0` to `attempt1` | attempt0 | 1. a1: polish only (render showed a toothy grin and a small head): `teeth.row` removed, bigger head, brow, a spots layer, frill a little bigger and brighter | none |
| b14-stegosaur | `b14-stegosaur.attempt0` to `attempt1` | attempt0 | 1. a1: render showed plates and tail spikes too small to read as "tall": plate `height` raised from 0.28 to 0.4 at the peak, 16 plates, tail spikes 0.28 to 0.4 and angled upward | none |
| b15-sail-back | `b15-sail-back.attempt0` | attempt0 | 0. The contact sheet, the flare render and the display filmstrip all matched the prompt | none |

Every attempt0 validated with no errors. No error messages were hit at all, so I have no feedback on
error text from this batch.

## b11-sea-turtle

What was confusing or harder than it should be:

- **Swimming is not drawn, and the failure mode misleads.** `validate` is clear about it (`notBuilt`,
  "keep it"). But everything downstream behaves as if the turtle were a snake. `analyze` reports
  `speed.gaits: []` yet still gives `speed.walk` 0.416 and `speed.max` 0.849, and its description says
  "It slithers at about 0.4 m/s". The gait filmstrip (`--filmstrip`) prints `gait: none` and the footer
  "no legs: the body follows its own trail (slither)", and draws the rigid shell bending into an S
  with its scutes sliding into each other (most of the eight frames). A reader who does not
  know swimming is unbuilt would think the turtle is broken. Suggest: when the only gaits are
  not built, say so in the filmstrip footer ("swim.flap not built yet, showing no motion") and skip
  the slither fallback, or at least do not bend a body that carries a `shell`.
- **Do not count `not_built` as an `analyze` warning for the "no warnings you can fix" goal.**
  `validate` says `notBuilt` is "neither an error nor a warning" (blueprint.md, Validation) and keeps it
  out of `warnings`, but `analyze` and `render` put `not_built` inside `warnings` with
  `severity: warning`, and `validate`'s own `notBuilt` entries also carry `severity: warning`. One
  convention would be easier to follow.
- **`beak` on a `round` head covers the whole head.** The doc says a beak "covers the snout in two
  halves", and the recipe table says to use a `snout` head with it. I tried a `round` head first, and the beak became a tan dome over the entire head
  that also hid both eyes, because the eyes sit under it and do not move. Nothing warned (no
  "eyes buried" warning from `analyze` either, it only checks parts "buried in the skin"). Suggest: a
  note in the `beak` catalogue entry that the head `shape` decides how much it covers, and an
  `analyze` warning when a beak covers an eye.
- **`beak.length` and `beak.depth` have a subtle effect.** Going from 0.6/0.9 (a1, with the round head)
  to 0.35/0.8 to 0.22/0.6 changed the head view only slightly once the head was a `snout`. A
  turtle's beak is a thin rim at the mouth; the smallest beak I could make still reads as a cap over
  the upper face. A `beak` `coverage` or `thickness` parameter, or a lower `depth` minimum, would
  help.
- **Flipper orientation cannot be set.** The recipe says "add fin limbs with `membrane: null`", which
  worked at once. But a fin limb has no `splay`, `lift` or sweep, so the front flippers stick out
  straight sideways and horizontally, like a plane's wings, at rest. A sea turtle's front flippers
  sweep back and down. The catalogue's fin role lists only `membrane` and `foot`. A `sweep` (degrees
  back) and a `droop` (degrees down) on `fin` limbs would fix the look; `attach.angle` is the only
  dial and it only moves the root.
- **Flipper thickness is a guess.** `radius [0.075, 0.025]` gave a flat blade, which looks right, but the
  catalogue does not say a fin limb with a null membrane is flattened (blueprint.md says only "holds
  out flat"). I could not tell if `radius` is the half-thickness or the half-width.
- **`analyze` description says "flippers (×2)"** for four fin limbs (`counts.fins` is 4). It seems to
  count pairs, so it reads as two flippers.
- **Docs gap: are `media.water` and `gaits: ["swim.flap"]` needed?** The doc says fins on the torso
  with no legs make `water` true, so both look redundant. I wrote them anyway to be safe; the doc
  could say plainly that listing nothing is enough.
- **Shell reads as a tortoise.** `shell` has `dome`, `overhang` and `scutes` only, so a sea turtle's
  smooth, heart-shaped, ridged carapace comes out as a tortoise shell with square scutes (the
  rectangular grid is very regular from above). A `shape` or `taper` parameter (pointed at the back,
  narrower at the front) and `scutes` 0 with a ridge would help. The `wide` torso hint in the docs
  was useful and correct.

## b12-quillback-boar

- **`scars` are hard to dose.** `count` is "about how many over the whole body" and `length`/`depth`
  are not in comparable units. `count` 14, `length` 0.35, `depth` 0.7 with a pale colour made big
  white patches that read as paint or a skin disease (attempt1). `count` 12, `length` 0.22, `depth`
  0.3, `rake` 3 gave convincing claw rakes (attempt2). The catalogue example (`count` 5, `rake` 3)
  is the safe one; a note like "above `depth` 0.5 a scar becomes a blot" would have saved a revision.
  At 900 px with `--quality high` the edges of scars are stair-stepped (visible in the side view of
  attempt0), which looks like a texture-resolution limit rather than a style.
- **`scars.color` defaults to the belly colour**, so a boar with a pale belly gets pale scars
  automatically. That is usually right but it is easy to miss; a mid-tone `color` of my own looked
  better than the default.
- **`quills` placement is confusing.** The table says area parts take `area` on `on`, the catalogue
  example uses `on: "spine"` with `from`/`to` as spine fractions, and the default is `spine` too. I
  used `spine` 0.08 to 0.8 (neck base to the rump) with `area: "back"`. It worked, but I had to do the
  neck, torso and tail arithmetic to know where the quills stop. The label on the contact sheet is a
  single dot, so the render does not show the extent. A `--labels` outline for rows and areas
  would make this checkable.
- **The result looks like a porcupine-boar.** Density 0.55 to 0.6 with `length` 0.15 to 0.2 on the whole
  back reads as a porcupine with tusks. `quills` has no way to keep a ridge narrow (a strip along the
  midline) because `area: "back"` is within 70 degrees of the top on both sides. A `width` or
  an `area` of `"midline"` would give a bristle ridge with quills proper.
- **Tusks.** `horn.curved` on `jaw` with `length` 0.32 (relative to the torso) looked like bull horns
  on a head of radius 0.15; 0.25 was right. Since horn length is in torso lengths and boar heads
  vary, a "relative to the head" option like the teeth have would be easier. `analyze`'s
  description calls them "curved horns on its jaw", not tusks.
- **Hooves** worked first time (`foot.hoof` with `cloven`, `size`, `height`); I saw no issues.
- **Colour names in the description are off for tan.** `#a89078` came out as "an orange belly" and
  `#c8b8a0` as "orange scars" (the latter became "tan" for `#b8a48a`). Helps to have a tan bucket.
- The `display` action on a quill creature works nicely: the filmstrip showed the quills lifting and
  the mouth opening, with a `display-peak` event.

## b13-frilled-lizard

- This is almost exactly `examples/frilled-lizard.json`, which the recipe table points at; the prompt
  was easy for that reason. The open frill (`--flare 1`) reads perfectly from the front.
- **The folded frill reads as a skirt, not a collar.** At rest (`open` 0.15 in attempt0, 0.1 in attempt1)
  the front view shows two pleated curtains hanging down each side of the chest, and from the side a
  ruff under the neck. The doc says "a frill lies back over the neck". It does lie back, but it
  hangs below the neck rather than over it. A `rest` angle or a note on how to hide it would help.
- **Frill colour is one flat `color`.** Skin layers (`stripes`, `spots`, `bands`) cannot touch it:
  `region: "wings"` covers wing and fin membranes, not frills, hoods or sails. A real frilled
  lizard has bands or a pale edge; a `region: "frill"` or `"membranes"` would allow that, or the `frill`
  could take an `edgeColor` as `plates.row` does.
- **Display framing.** `--filmstrip --action display` frames the whole body at 3/4, so on a lizard
  with a long tail (1.5 m long, 28 cm tall) the frill is a few dozen pixels wide. The bite filmstrip
  goes "close on the head and neck", and `display` should do the same (or take `--view front`
  and a zoom). The doc's list of filmstrip views says actions default to 3/4.
- **The frill `radius` is in torso lengths**, so on a 0.45 m torso a 0.4 radius gives a frill 0.36 m
  across. I had to compute that to judge whether it was "wide"; `analyze` could report `frillSpan`
  in metres next to `measurements.length`.
- **`teeth.row` with `fangs` 0 on a `lips` 0 head** gave a continuous toothy grin like a crocodile's,
  odd for a small lizard (I removed it in attempt1). `teeth.row` has no "tiny teeth" preset; `scale`
  0.5 would do it, but the catalogue does not say `scale` smaller than 1 is meant for that.
- A `spots` layer with `region: "back"` put a few spots on the head crown and nowhere on the back
  at 512 px; the whole-body pattern placement means few spots land on a small area. The doc warns about
  this for tails; the same applies here.

## b14-stegosaur

- Also close to an example (`plated-stegosaur.json`); written mostly from the recipe row.
- **Computing `spine` ranges is the main chore.** I needed the neck, torso and tail lengths in torso
  lengths (0.3 + 1 + 1.1) to place plates from the shoulders to mid-tail, as the doc explains. It
  works, but a stegosaur's plates extending onto the tail root is exactly the case where `on: "torso"`
  is not enough. A named range such as `"on": "spine", "from": "shoulders"`, or a `--labels` outline
  of each row's extent, would remove the arithmetic.
- **`count` semantics differ between the two rows I used**, as the doc says: `plates.row` `count` is the
  total (alternating), while `spikes.row` `count` is per side. I wrote `spikes.row` `count` 2 with
  `side: "both"` to get four tail spikes (two pairs), and `analyze` describes this as "a row of 2
  spikes on its tail". It should say 4 (or "two pairs").
- **Spike direction is hard to predict.** At `angle` 75 on the tail the spikes pointed sideways and
  back; at 60 they stood up and out, more like a thagomizer. The doc says what `angle` means on a
  section (0 top, 90 side) but not which way a spike points relative to the surface or how
  `curve` interacts; an `aim` like the horns have would help.
- **Alternating plates look right from above but cut a thin edge-on silhouette from the front**
  (front view: two diagonal rods). That is the correct look, only noting it was not obvious at first
  that the plates are tilted outward.
- No `analyze` warnings at all; footSlide 0 on flat and rough ground.

## b15-sail-back

- First attempt matched. The recipe row and `examples/sail-back.json` made this the easiest of the five.
- **`sail` has no `open` parameter**, unlike `frill` and `hood`. The doc says "a sail leans back a
  little" at rest, and in the display filmstrip the sail looks the same in all eight frames, so
  `display` seems to do nothing visible for the sail, though the hiss and the lean happen. A
  `sail` `open` (0 folded flat along the back, 1 upright) would make the display readable and let a
  sail fold when the animal is at rest.
- **Sail colour is flat**, with the same membrane-pattern limit as the frill. A basking dimetrodon
  sail has veins or bands; `veins` with `region: "wings"` does not apply.
- Sail height (`[0.1, 0.5, 0.58, 0.4, 0.08]`) is in torso lengths, so 0.58 x 1.2 m is a 0.7 m sail;
  `measurements.height` (1.27 m) includes it but `bodyHeight` (0.6 m) does not, which was handy.
- Spine fractions again needed arithmetic (neck 0.14, torso 1, tail 1.3 gives the torso at about 0.06
  to 0.46 of the spine; I used 0.12 to 0.5).

## General

- **`patch` edits in place and has no `--out`.** The protocol says never to edit a saved attempt, so I
  would have had to copy the file first and then patch the copy; I used a small script instead.
  `patch --out new.json` (and `--dry-run` already exists) would make "next attempt" a one-liner.
- **Renders take 20 to 30 s each**; contact sheet plus filmstrip plus display filmstrip for one
  creature is about 1.5 minutes. `--views head` would be quicker, and it would help if `render` could
  render several files or output sheets for a rest and a `--flare 1` pose in one call.
- **`--flare` only exists on contact sheets** and `--pose spread` only for wings; `--filmstrip
  --action display` is the way to see the frill move, which is fine but not mentioned in the
  `--flare` help line.
- **`analyze` description is useful for checking intent** ("quills on its back", "a frill on its
  neck", "plates along its back") but never says how many of a part, which would let me check, for
  example, 16 plates against a count I wrote.
- The docs are accurate where I could test them: the shell/wide-torso hint, `quills` on the spine,
  `plates.row` alternate, `display` needing a part that provides it, the notBuilt behaviour.
