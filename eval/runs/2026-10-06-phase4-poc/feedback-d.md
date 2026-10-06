# Feedback D (prompts p16 to p20)

Working only from docs/blueprint.md, docs/catalog.md, the four examples and the CLI
(`validate`, `analyze`, `patch`, `render`). No source code read. Renders are in `work/`.

## Summary table

| Prompt | Attempts | Validation errors | Final valid | Visual revisions |
| --- | --- | --- | --- | --- |
| p16-ant-soldier | 0-3 | none (attempt0 valid) | yes | 3 |
| p17-goblin | 0-3 | none (attempt0 valid) | yes (one `nothing_to_remove` warning, see patch notes) | 3 |
| p18-cobra | 0-3 | none (attempt0 valid) | yes | 3 |
| p19-rhino | 0-3 | none (attempt0 valid) | yes | 3 |
| p20-nightmare-hound | 0-2 | none (attempt0 valid) | yes | 2 |

Every first blueprint validated with zero errors and zero warnings, so the format part of the docs
worked well for all five prompts. All the trouble was in how things look and move.

## Per prompt

### p16-ant-soldier (hexapod, red chitin, big head, two mandible-like horns)

- attempt0: hexapod, scale 0.6, torso profile with a thin waist and big rear (gaster), head
  radius 0.17, mandibles from the doc recipe for a big head (`horn.curved` on head, at 0.04,
  angle 80, lean 90, length 0.3, curve 110, turn 90, dark colours), red `chitin` palette.
- analyze: no warnings. Tripod gait 0.86 m/s, cycle 0.40 s, foot slide 0, stability supported
  (margin 0.159), bite reach 0.09 m. Description: "an 88 cm long, 38 cm tall 6-legged creature of
  about 21 kg, with a short neck, black eyes, curved horns on its head and 1-toed clawed feet.
  Skin: red chitin and a dark red belly". Useful for size, leg count and colour. Not useful for
  the thing I was least sure about: it says "curved horns on its head" with no count, position or
  direction, so it cannot tell mandibles from ordinary horns, and nothing in analyze can say
  whether they point forward or hang down.
- Render of attempt0: reads as an ant (waist, big gaster, tripod walk is good). The mandibles hang
  down and back from the lower face like fangs; from above they converge a little. Not forward
  pincers.
- attempt1 (patch, 6 ops): head radius 0.2 and length 0.34, mandible `lean` 90 to 65, `curve`
  110 to 85, `length` 0.34, angle 90. Similar look, bigger head. Best of the four.
- attempt2: mandibles moved to `at` 0.18, angle 95, lean 70, curve 80. Worse: they point straight
  down and splay outward.
- attempt3: `at` 0.06, angle 70, lean 10, curve 100, turn 80, length 0.38. Now they sweep outward
  and back like antennae or goat horns. Worse again than attempt1.
- Bite filmstrip (attempt3): the jaw opens, but the mandibles do not move at all, because they
  are `horn.curved` parts on `head`.
- Could not achieve: forward-pointing, inward-converging pincer mandibles that read from the side
  and the front; mandibles that open and close with the bite. The final file (attempt3) is a
  regression against attempt1; I had used up my three revisions. The idea I did not get to try:
  attach the mandibles to `jaw` (as the tusks recipe does) so they move with `bite`.

### p17-goblin (small upright biped, big round head, big yellow eyes, green skin)

- attempt0: biped, scale 0.4, round head radius 0.27, eye size 0.08 with yellow `irisColor` and
  `scleraColor`, `ear.pointed`, teeth with 2 fangs, green palette with mottle.
- analyze: `stability: {"supported": false, "margin": -0.041}` but this was NOT in `warnings`
  (the only warning was `limb_intersection`: "leg.L passes 1.0 cm into leg.R on flat ground").
  Description: "a 99 cm tall biped of about 11 kg, with two arms, a short neck, big yellow eyes,
  pointed ears on its head, teeth and fangs and 3-toed clawed feet. Skin: green skin, a sand belly
  and dark green mottling". Good: it confirms the yellow eyes and the size. The unsupported stance
  was only visible if you read the raw `stability` block.
- Render of attempt0: eyes sat on top of the skull (visible as two yellow blobs from above), ears
  tiny, body a thin stick, leaning forward.
- attempt1 (patch, 14 ops): torso fatter, pitch 75 to 82 (neck 82), thicker legs, leg attach angle
  130 to 115 plus splay 6, eyes `angle` 50 to 64, much bigger ears (length 0.22 to 0.34, width
  0.1). This fixed both the stability (margin +0.005) and the leg intersection, and the filmstrip
  shows a sensible waddling walk (cycle 0.58 s, slide about 0).
- attempt2: eyes size 0.1 at `at` 0.2, angle 76 (far better, they face forward). I also added a
  nose with `horn.curved` at angle 10: it became a pair of small horns on the crown, because
  `side` defaults to "both" unless angle is exactly 0 or 180 (my mistake, and the doc says so),
  and they sat on top of the head, not on the face.
- attempt3: removed the nose with patch `remove`. Roar filmstrip is good (wide mouth, fangs).
- Could not achieve: a hooked goblin nose, a pointed chin, a straighter upright pose. With a big
  head the balance margin is only 5 mm, and the legs stay in a crouch.

### p18-cobra (rearing snake, brown with dark bands)

- attempt0: serpent, scale 0.7, neck length 1.0 pitch 75 `crossSection` wide, torso pitch 6, tail
  pitch 4 (the doc's cobra recipe), brown palette, 30 `stripes`, `scales`, upper fangs.
- analyze warnings: `below_ground` "the torso reaches 0.06 torso lengths below the ground", fix
  "lower body.torso.pitch (a legless body lies on the ground)", and `ground_penetration` "the neck
  goes 4.7 cm into the ground on flat ground", fix "lengthen the legs, raise the section (pitch,
  curl) or make it slimmer". Description: "a 2.6 m long, 82 cm tall legless serpent of about 23 kg,
  with a very long neck, a very long tail, orange slit-pupilled eyes and teeth and fangs. Skin:
  brown scales, a sand belly, black stripes and scales". Useful: height and the "very long neck"
  confirm it rears; the warnings were right and pointed at real problems.
- Render of attempt0: it rears, but the neck is a thin tube (no hood), the head points down, and
  from the side the tail visibly lifts off the floor (about 12 cm at the tip) because of tail
  pitch 4.
- attempt1: torso pitch 1, tail pitch 0, neck radius profile with a flare, head pitch -5. The tail
  now lies flat. Neck still 3.6 cm into the ground.
- attempt2: found the cause: the neck's torso-end radius (0.1) was bigger than the torso's start
  radius (0.07), so the base sank. Set the neck radius to `[0.05, 0.16, 0.19, 0.12, 0.075, 0.07]`
  (hood right under the head, slim below), neck 1.1 long, pitch 80, head pitch 0, dark amber
  eyes. analyze warnings now empty (a 1.2 cm neck penetration remains in the motion block, below
  the warning threshold).
- attempt3: `countershade` `height` -0.6 and stripes `fade` 0.2 so the bands wrap further and the
  front of the hood is less cream; head radius 0.1. Side filmstrip: the neck stays upright while
  the tail slithers; bite filmstrip: a believable downward strike (bite-contact 0.22 s).
- Could not achieve: a flat, flared hood that reads as a hood from the side (it reads as a
  bulb or bowling pin), an S-curve neck (documented limitation), and a brown front: the visible
  front of a rearing neck is the belly side, so it stays pale between the dark bands.

### p19-rhino (big nose horn, smaller horn behind, grey scaly hide)

- attempt0: quadruped, scale 2.0, stocky torso, wedge head, short thick legs, nose horn
  (`horn.curved` at 0.12, angle 0, from the doc recipe, bigger) and a second horn at 0.4,
  `material: scales` plus a `scales` layer, grey palette, lumbering.
- analyze: `limb_intersection` "foreleg.L passes 13.3 cm into torso on flat ground", fix "spread
  the legs apart (attach.at, attach.angle, splay) or make them thinner". Size and mass were
  right for a rhino (3.9 m, 1.6 m tall, 2.2 t). Description: "a 3.9 m long, 1.6 m tall quadruped of
  about 2.2 t, with a tail, black eyes, straight horns on its head, straight horns on its head,
  pointed ears on its head and 3-toed clawed feet. Skin: grey scales, a pale grey belly ...".
  Weak: both horns are described identically ("straight horns on its head" twice), they are not
  straight (curve 25 and 20), and nothing says one is on the nose and bigger.
- attempt1: bigger head (length 0.45, radius 0.17), thicker neck, higher shoulder, lighter horn
  colours (the first dark horns vanished against the dark background in the side view), nose horn
  `lean` 25. The horn now pointed far forward like a lance, and the intersection got worse
  (18.8 cm) because I also fattened the torso.
- attempt2: torso slimmer, legs angle 95 and splay 14, lean 12 and 6. Intersection 13.1 cm.
- attempt3: foreleg thinner and moved back (`at` 0.16). Intersection 9.6 cm. Still warned.
- Walk filmstrip is fine (cycle 1.03 s, duty about 0.75, slide about 0).
- Could not achieve: a clean analyze (the foreleg-into-torso warning stayed at 9.6 cm on a 2 m
  torso, after following the suggested fix three ways); a nose horn that rises upward rather than
  pointing forward-up at a shallow angle.

### p20-nightmare-hound (jagged back spines, red eyes, black skin with grime)

- attempt0: quadruped, scale 1.2, gaunt torso with arch, long legs, `spikes.row` on `spine`
  (count 20, height profile, jitter 0.7, dark spines with red tips), red slit eyes (iris and
  sclera set), fangs, black palette, countershade plus mottle plus `grime`.
- analyze: no warnings, trot 2.6 m/s with no slide, supported. Description: "a 2.8 m long, 1.2 m
  tall quadruped of about 174 kg, with a tail, red slit-pupilled eyes, a row of 20 spikes along its
  back, teeth and fangs, pointed ears on its head and 4-toed clawed feet. Skin: black skin, a black
  belly, dark brown mottling and grime". This one was fully useful: every element in the prompt is
  confirmed by the text.
- Render: already nightmarish; the tail was long and spiny, which made it read as a lizard.
- attempt1 (12 ops): deeper chest, shorter tail (0.8 to 0.6), bigger head, spikes only on the back
  (`from` 0.18, `to` 0.82), taller profile, jitter 0.95. Roar filmstrip is excellent.
- attempt2: spine root colour from near-black to a pale bone-grey so the silhouette shows against
  black skin, jitter 1, grime/creases/feet 1.0, mottle in dirt brown. Grime now shows on the flank
  and legs.
- Could not achieve: spines that look "jagged" in shape (they are all cones; jitter changes height
  and lean only, no broken or bladed spines).

## Confusing, missing or wrong in docs and tools

1. **Mandible recipe does not give pincers.** "Insect mandibles | `horn.curved` on `head`, `at`
   0.08, `angle` 100; ... `lean` 60, `curve` 110, `turn` 90 ... (on a big head: `at` 0.04,
   `angle` 80, `lean` 90, `length` 0.3)". With the big-head values I got hooks hanging down and
   back from the lower face. The text "`lean` tilts the root first" and "`turn` swings the bend
   sideways" does not say relative to what, so every change I made moved the horns in an
   unpredictable direction (down, outward, back). A top/front line drawing of the axes, or a
   recipe that was checked against a render of a big-headed insect, would help. Also worth
   saying: mandibles on `head` do not move with `bite`; mount them on `jaw` (untested by me).
2. **Cobra recipe vs analyze.** The recipe says "`torso` `pitch` near 6 and `tail` `pitch` near 4,
   so the body stays on the ground", but with those values analyze reported `below_ground` ("the
   torso reaches 0.06 torso lengths below the ground") and the tail tip floated about 12 cm. Pitch
   1 and 0 were right. The recipe also says only `crossSection` "wide" for the hood; in practice a
   hood needs a radius profile (mine: `[0.05, 0.16, 0.19, 0.12, 0.075, 0.07]` along the neck), and
   the neck's torso-end radius must not exceed the torso's first radius or the base sinks into the
   ground.
3. **`countershade` on a rearing snake.** "On a creature with no legs, `countershade` at its
   default height gives the pale belly of a snake" is true, but on a rearing neck the belly faces
   the viewer, so the whole front is pale. A line saying to lower `height` (I used -0.6) would
   save a revision.
4. **analyze warning fixes are generic.** `ground_penetration` on a legless cobra says "lengthen
   the legs, raise the section (pitch, curl) or make it slimmer" (there are no legs; "slimmer"
   was the real fix, at the joint with the torso). `limb_intersection` says "spread the legs apart
   (attach.at, attach.angle, splay) or make them thinner" and I could not clear it on the rhino
   with any of the three (18.8, 13.1, 9.6 cm). The goblin was flagged for 1.0 cm and the rhino for
   13 cm, so the threshold looks absolute, not relative to size; please say what the threshold is.
5. **Unsupported stance is not a warning.** Goblin attempt0 had `"supported": false, "margin":
   -0.041` in `stability` while `warnings` listed only a leg intersection. The docs list what
   analyze warns about ("sliding feet, a body or tail in the ground, legs stretched past their
   reach, limbs passing through each other or the body, parts buried in the skin and eyes facing
   backwards") and balance is not in it. A creature that would tip over should warn.
6. **The description cannot verify placement or shape.** "straight horns on its head, straight
   horns on its head" (rhino: two different horns, both curved, one on the nose); "curved horns on
   its head" (ant mandibles). No count, position (nose, brow, jaw), relative size or direction.
   Prompts such as "big horn on its nose, smaller horn behind it" or "two mandibles" cannot be
   checked from text; I needed images each time. Adding the attach point ("on its snout"), the
   size rank and the sweep direction would make analyze a real check.
7. **`side` default catches `angle` 10.** The doc is right ("angles of exactly 0 and 180 default
   to `center`") but my single nose horn at angle 10 became two horns. A near-midline angle that
   makes mirrored copies overlap or sit very close could warn ("these two parts are 3 cm apart;
   did you mean side center and angle 0?").
8. **Eye placement on big round heads.** The doc examples put eyes at `at` 0.35, `angle` 60. On a
   head with radius 0.27 and eye size 0.08 that put the eyes on top of the skull (top view showed
   them bulging up). Angle 76 at `at` 0.2 was right. A sentence on this next to "Big eyes need a
   large `size`" would help. The default `scleraColor` is cream, so "yellow eyes" needs both
   `irisColor` and `scleraColor`; this is in the catalogue but a recipe would be faster.
9. **Render options are split between the docs and `--help`.** blueprint.md documents `--view`
   (singular, filmstrip) and `labels`, but contact-sheet `--views` and `--size` appear only in the
   CLI help. The serpent filmstrip defaults to a top view, which hides the rearing pose; I needed
   `--view side` (documented, but it is easy to miss that the default hides what matters for a
   cobra).
10. **Mismatched statement in analyze output.** The cobra `speed` block prints `"walk": 0.472`
    while the only gait is `slither`. Minor, but "walk" for a snake is odd.

What worked well: the size rules of thumb in "Units and directions" were accurate (goblin 0.98 m
at scale 0.4, rhino 1.4-1.6 m at scale 2.0); the `validate` pass was clean first time for all five
prompts; `render --labels` made it quick to see where each part landed; footfall diagrams and the
"slide" number made gaits easy to trust; the action filmstrips (bite, roar) with event times were
very good.

## Was patch convenient?

Yes, much more than hand editing for revisions. Copying the latest attempt to the next number and
running one `patch` with 6 to 14 `set` ops was a single command per revision, the diff
("~ parts[id=mandibles].params.lean: 90 → 65") let me check my own change at a glance, and `set`
created missing keys without fuss ("+ limbs[id=leg].splay: 6"). `--dry-run` works (I used it once, to
inspect the `remove` stub below). Hand editing would have meant rewriting nested JSON and risking typos in profiles. Rough
edges:

- **`remove` on a part that is not inherited leaves a stub.** Removing my own `nose` part wrote
  `{ "id": "nose", "remove": true }` into the file and made validate warn `nothing_to_remove`
  ("no inherited part \"nose\" to remove", fix "delete this entry"). The doc says "`remove` (a key,
  back to its default, or a limb or part; inherited ones get `"remove": true`)", so for an added
  part I expected the entry to disappear. The diff is also noisy: it lists every leaf as
  "- parts[id=nose].type ..." and then "+ ...remove: true".
- Replacing a list (`skin.layers`) means passing the whole list; there was no way to tweak one
  layer without ids on layers (the doc mentions an optional layer `id` but patch's path syntax for
  layers by index or type was not described, and I did not try it).
- patch edits in place, so the "copy to next attempt first" protocol is mandatory; an `--out`
  option would save a step.
- It validated after every patch (a patch that produced an invalid file never occurred for me, so
  I did not see the refusal path).

## The three most important problems

1. Part orientation controls (`attach.angle`, `lean`, `curve`, `turn`) are not predictable from the
   docs, and the documented mandible recipe renders as down-hanging hooks. Three revisions did not
   produce forward pincers, and mandibles on `head` do not move with a bite.
2. analyze is thin where it matters for checking intent: its warning fixes are generic and did not
   clear the rhino's foreleg-into-torso warning; an unsupported (tipping) goblin produced no
   warning; and the description cannot confirm part placement, count or shape ("straight horns on
   its head" twice for two different, curved horns).
3. The cobra recipe's numbers (torso pitch 6, tail pitch 4) trigger `below_ground` and float the
   tail, the hood needs an undocumented radius profile, and `countershade` makes a rearing cobra's
   front cream; plus `patch remove` leaves a stub entry with a warning for a part you added.
