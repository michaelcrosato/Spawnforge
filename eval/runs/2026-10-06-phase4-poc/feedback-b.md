# Feedback B: prompts p06 to p10

Model: Claude Sonnet 5.5. Worked only from docs/blueprint.md, docs/catalog.md, examples/ and the CLI
(`list-modules`, `describe-module`, `validate`, `analyze`, `patch`, `render`). No source read.
Renders are in `work/` (`pNN-aK-sheet.png`, `-film.png`, and so on); `work/an.sh` is a small helper of
mine that prints the key parts of `analyze`.

## Summary table

| Prompt | Attempts written | Valid first time? | Final attempt | Visual revisions used |
| --- | --- | --- | --- | --- |
| p06-ram-demon | 0, 1, 2, 3, 4 | yes (attempt0) | attempt4 (a copy of attempt2, see below) | 3 (+ 1 pure revert) |
| p07-sprawl-lizard | 0, 1, 2, 3 | yes | attempt3 | 3 |
| p08-boar | 0, 1, 2, 3 | yes | attempt3 | 3 |
| p09-long-neck | 0, 1, 2, 3 | yes | attempt3 | 3 |
| p10-scorpion | 0, 1, 2, 3 | no: attempt0 invalid, attempt1 valid | attempt3 | 2 (attempt2, attempt3) |

Four of five prompts were valid at attempt0. The one failure was my own slip (below) and was fixed in one round.

## p06-ram-demon (biped, red with black stripes, ram horns)

- **Validation:** attempt0 valid, no errors, no warnings. I used the ram-horn recipe for an upright biped
  from blueprint.md verbatim (`at` 0.6, `angle` 85, `turn` -70, `lean` 10, `length` 0.65, `curve` 400).
- **analyze (attempt0):** one warning, `limb_intersection`: "leg.L passes 2.3 cm into leg.R on flat
  ground", fix "spread the legs apart (attach.at, attach.angle, splay) or make them thinner". Description:
  "a 2.0 m tall biped of about 110 kg, with two arms, yellow goat-pupilled eyes, long coiled horns on its
  head, teeth and fangs and 3-toed clawed feet. Skin: red skin, a orange belly and black stripes." The
  description was accurate and let me confirm horns, stripes and colours without opening the PNG. The warning
  was right and useful, but only partly fixable (see below).
- **What I saw and changed:**
  - attempt1 (patch): contact sheet showed a thin, tube-like figure (52 cm wide, 48 cm deep at 2 m tall) with a
    tiny head. I set the torso cross-section back to `wide` and made the radius profile broader, thickened the
    legs and arms, added a short tail, made the horns bigger (`length` 0.8, `width` 0.065, `turn` -40) and
    changed the leg `attach.angle` to 122. The filmstrip (side) showed a deep-crouched, stomping walk with a
    translucent "skirt" of skin stretched between hip and foot on the 2-segment legs.
  - attempt2: neck 0.24 with a thicker profile, head radius 0.15, torso profile tapered `[0.15, 0.27, 0.21, 0.16]`
    (shoulders), legs changed to 3 segments, `length` 1.35, `attach.angle` 105, `splay` 4. This removed the
    leg-intersection warning (0 cm) and the skirt artefact, and the walk read as an upright, slightly knee-bent
    biped. The roar filmstrip also looked right (jaw opens, head rises, `roar-peak` at 0.91 s).
  - attempt3: I tried to improve the horns (`at` 0.7, `angle` 90, `turn` -35, `curve` 450, `length` 0.9). This
    was worse: both horns hug the back of the skull and overlap in the top view. I therefore wrote attempt4 as
    an exact copy of attempt2. It is a revert, not a fourth revision. Use attempt4 (or attempt2) as the
    candidate; attempt3 is the worse one.
- **Could not achieve:** the horns read as thick round loops over and behind the head, not a clean ram curl
  beside the cheek. The recipe's numbers are the best I found. Stripes are very regular rings and the
  creature has no real "demon" silhouette (no wings, no hooves, cannot do digitigrade legs). The torso is still
  a smooth egg shape.

## p07-sprawl-lizard (tiny lizard, four sprawled legs, very long tail, spotted back)

- **Validation:** attempt0 valid, no errors or warnings.
- **analyze:** no warnings at any attempt. Description (attempt0): "a 43 cm long, 4 cm tall quadruped of about
  0.1 kg, with a short neck, a very long tail, orange eyes and 4-toed clawed feet. Skin: olive scales, a cream
  belly and dark brown spots." Mostly right, but it never says the legs are sprawled (it is the first thing
  the prompt asks for), and "about 0.1 kg" for a measured 0.061 kg is a poor rounding. After I stacked two spot
  layers it said "black spots and black spots".
- **What I saw and changed:**
  - attempt0 filmstrip: cycle 0.075 s (13 steps per second) and stride 1.8 cm at the default "walk" speed of
    0.24 m/s. analyze did not flag this; only the filmstrip text shows it. Fixing it is not possible through
    the blueprint except via temperament and size (see problems). attempt1 used `calm` temperament, scale 0.08,
    longer legs and a longer tail (3.2): the cycle is still 0.11 s. At `--speed 0.06` it is 0.28 s and looks fine.
  - Spots were the real problem. On the default contact sheet at this size the spots are almost invisible in
    every view (the doc line "judge spots and scales on the contact sheet" does not hold for a creature this
    small). I had to render `--views top,3/4 --size 900 --quality high` to see them. attempt1 (size 0.07, density
    0.95) gave about seven spots on the torso and many on the tail. attempt2 (size 0.1, density 1, a darker
    accent colour) gave only about two spots on the torso and a lot on the tail: the bigger the spot, the fewer
    the torso gets, because the pattern is laid out over the whole body, long tail included. attempt3 fixed it
    with two layers: a fine one (size 0.055) and a big one (size 0.12, region back, id `bigspots`). Now the back
    is clearly spotted even on the normal sheet.
  - Eyes reduced from 0.04 to 0.03 (cartoon look at 0.04).
- **Could not achieve:** the tail only curls up, never sideways, so it is a straight stick. Rendered frames of
  the filmstrip are tiny because the framing includes the whole tail. I cannot judge the sprawl gait in them;
  the footfall diagram (hind-left, fore-left, hind-right, fore-right) looks right.

## p08-boar (stocky boar-like beast, tusks, short legs, big head, tiny tail)

- **Validation:** attempt0 valid, no errors or warnings.
- **analyze (attempt0):** `limb_intersection` "foreleg.R passes 6.3 cm into torso on flat ground". Description:
  "a 1.6 m long, 80 cm tall quadruped of about 266 kg, with a short neck, a short tail, orange eyes, curved
  horns on its jaw, pointed ears on its head, a row of 14 spikes along its back and 2-toed clawed feet. Skin:
  charcoal skin, a tan belly, black mottling and grime." Problems: my base colour `#5a4636` is a dark brown but
  is called "charcoal" and the mottle "black"; the tusks are called "curved horns"; nothing about the short
  legs or the big head, which were the main requests.
- **What I saw and changed:**
  - attempt0 looked like a bloated blob and the default `aggressive` walk was a scurry (cycle 0.24 s at
    1.07 m/s). attempt1: `lumbering` temperament (walk 0.59 m/s, cycle 0.68 s, a convincing heavy walk),
    higher arch for a shoulder hump, bigger head, a lighter brown palette, softer mottle (contrast 0.25,
    strength 0.6), longer tusks and a curly tail (`curl` 70, `pitch` 30).
  - attempt2: I tried to point the tusks upward (`angle` 40, `curve` 50). analyze answered `part_buried`:
    "only 0% of the part shows above the skin"; the render confirmed it, the tusks vanished. This warning was
    accurate and I would have missed it from the PNG alone at first glance. Its fix text ("make it longer or
    larger, or attach it where the body is thinner") does not say that the attach `angle` was the cause.
  - attempt3: tusks back to `angle` 60, `at` 0.25, `curve` -60, `length` 0.24; foreleg and hindleg `splay` 22/14
    to widen the stance. Result: tusks visible, a stocky bulldog-like stance, forelegs no longer flagged; one
    residual warning "hindleg.R passes 2.1 cm into torso" (hidden inside the fat torso, not visible).
- **Could not achieve:** the snout is a cone ending in a flat disc (no rooting snout, no nostrils); no hooves
  (legs end in 2 small claws); no bristly coat, only a spike row along the spine. The tail is now very small
  on the render, as asked. Tusks point out and forward rather than up.

## p09-long-neck (tall grazer, very long neck and legs, giraffe crossed with lizard, spotted)

- **Validation:** attempt0 valid, no errors or warnings.
- **analyze (attempt0):** `limb_intersection` "foreleg.L passes 11.8 cm into hindleg.L on flat ground": the
  long legs (1.5 m) on a 1.2 m torso cross in the stride. Description: "a 3.3 m long, 3.1 m tall quadruped of
  about 218 kg, with a very long neck, a long tail, orange slit-pupilled eyes, pointed ears on its head and
  3-toed clawed feet. Skin: tan scales, a cream belly and dark brown spots." Good, but it does not mention
  the long legs, even though the prompt asks for them.
- **What I saw and changed:**
  - attempt1: scale 1.4, legs 1.1 to 1.15 with attach moved to `at` 0.08 and 0.93 (further apart), splay 6,
    bigger spots (0.09, density 0.9), small giraffe "ossicones" (two short `horn.curved` on the head). The
    intersection warning disappeared. The filmstrip showed a believable walk with duty 0.75 for all feet.
  - attempt2: thicker legs and neck base, stance widened (`splay` 11). That brought a new warning
    (6.0 cm foreleg.R into hindleg.R).
  - attempt3: added `motion.gaits` walk and trot with `stride` 0.75. The overlap fell to 4.1 cm but did not
    disappear. analyze's fix text never mentions `stride`. I left it at that.
  - The `look` filmstrip (attempt2) shows no visible head or neck change in 6 frames, and it frames the whole
    animal rather than "close on the head and neck", so I could not verify that `look` does anything.
- **Could not achieve:** it reads as a spotted theropod/ostrich more than a giraffe-lizard (3-segment legs
  fold forward at the knee). No way to get a sloped back with high shoulders except torso `pitch`/`arch`.
  A very thin neck at the head end looks good, but the transition at the torso is abrupt.

## p10-scorpion (desert creature, six legs, long tail curled over its back, pale sandy chitin)

- **Validation:** attempt0 invalid, one error:
  `body.head.shape: "wide" is not allowed; expected one of "round", "snout", "flat", "wedge"; fix: did you
  mean "wedge"?`. That was my slip (I meant a wide, flat head, so `shape: "flat"` plus `crossSection: "wide"`).
  attempt1 fixed it and was valid. The message was clear about the legal values, but the suggested fix
  (`wedge`) was the nearest spelling, not the nearest meaning; "wide" is a `crossSection` value, which the
  message could have said.
- **analyze:** no warnings. Description (attempt1): "a 57 cm long, 47 cm tall 6-legged creature of about
  3.6 kg, with two arms, a short neck, a very long curled tail, black eyes, curved horns on its tail and
  1-toed clawed feet. Skin: sand chitin, a cream belly and tan mottling. It walks at about 0.5 m/s and tripods
  up to 1.2 m/s". Fine as a check, but the pincers are "two arms", the stinger is "curved horns on its tail",
  and "tripods up to" is a clumsy verb. The sentence "a very long curled tail" confirms the main request.
- **What I saw and changed:** the first render already read as a scorpion (the doc's tail numbers `length` 2.4,
  `pitch` 40, `curl` 200 worked as written). attempt2: curl 235 and a tapering tail profile, much bigger pincers
  (arm limb `pincer`, `role: arm`, `lift` 95, `foot.claw` with 2 long toes), a bigger stinger (`length` 0.2,
  `curve` 85) and thinner legs. attempt3: pincers lowered (`lift` 70, `splay` 25) so they are held forward,
  eyes moved to the top of the head (`angle` 38). The tripod filmstrip shows clean alternation (duty 0.5,
  slide 0) and the pincers visibly sway.
- **Could not achieve:** only six walking legs plus two pincer arms, no eight legs or segmented tail; the
  chitin looks smooth and glossy like plastic; no tail segments or telson bulb (the stinger is a horn). The
  `head` close-up view is a useless crop of a smooth surface at this scale.

## What was confusing, missing or wrong in docs and tools

1. **`patch remove` on an item I wrote myself (not inherited) leaves a stub.** Example: removing
   `parts[id=bristles]` from a blueprint that defined it produced
   `{ "id": "bristles", "remove": true }` in the file, a long diff listing every field as removed, and from
   then on every `patch` and `validate` carries the warning
   `nothing_to_remove: no inherited part "bristles" to remove (fix: delete this entry)`. blueprint.md says
   "`remove` (a key, back to its default, or a limb or part; inherited ones get `"remove": true`)": the
   intent is that only inherited ones get the flag, but my own part got it too.
2. **`patch` `scale` op parameter name is not documented.** The doc says only "`scale` (multiply a number or a
   profile; path `""` scales the whole creature)". I used `value` and got
   `bad operations at 0.by: Invalid input: expected number, received undefined`; I had to infer that the
   argument is `by`. Please show one example of each op (`set`, `add`, `remove`, `mirror`, `scale`) in the doc.
3. **Wrong id in `patch` gives no suggestion:** `nothing with id "forleg" in limbs` (path `ops[0]`). Validate
   gives "did you mean" for keys; here it could list the valid ids (`foreleg`, `hindleg`).
4. **Render options are documented only in the CLI help.** blueprint.md describes the filmstrip options
   (`--view`, `--frames`, `--size`) but the contact-sheet options `--views` and `--quality high` (and `--size`
   for the sheet) appear only in `bin.ts` usage output. They are what makes small details visible.
5. **"Fine patterns fade out in small frames, so judge spots and scales on the contact sheet."** Not true for
   a tiny creature: p07's spots were nearly invisible on the default sheet; a 900 px per-view render showed
   them. Suggest: say to use `--size 900 --quality high --views top,3/4` for small creatures.
6. **Spots on creatures with long tails.** The doc says the pattern "is laid out over the whole body", so on a
   tail 3.2 torso lengths long the torso gets few spots, and a larger `size` or `density: 1` made it worse
   (size 0.1: about 2 spots on the torso; size 0.07: about 7). A recipe (two spot layers with different sizes,
   `region` back) would save an iteration.
7. **`lift` and pincers are not in blueprint.md.** The only mention is the catalogue row
   (`lift`: "Arms only: degrees the arm is raised forward from hanging; 90 holds it straight out (pincers)").
   A scorpion/crab recipe (arm limbs with a 2-toed `foot.claw`) is missing from "Recipes". "Not in this
   version" does not say whether pincers are possible.
8. **analyze fix text is generic.** `limb_intersection` always says "spread the legs apart (attach.at,
   attach.angle, splay) or make them thinner". For long-legged creatures (p09) the effective lever was a
   shorter `stride` (6.0 cm down to 4.1 cm), which is not mentioned; for stocky creatures (p08) neither splay
   nor angle fully removed a 2 to 4 cm leg-in-torso overlap that is probably harmless (hidden in the body).
   Maybe suppress or soften leg-into-torso overlaps below a few cm. `part_buried`'s fix does not point at
   `attach.angle`.
9. **analyze does not report step rate.** p07 at default walking speed steps 9 to 13 times per second (cycle
   0.075 to 0.11 s, stride 1.8 cm). Only the filmstrip text prints the cycle. A warning like "step rate above
   6 per second at walk speed" would be useful; so would a note that temperament changes the pace
   (the boar's default walk fell from 1.07 to 0.59 m/s after switching `aggressive` to `lumbering`, which is
   not stated in the docs beyond "sets the walking pace").
10. **Description quality.** Colour naming is coarse ("charcoal" for `#5a4636` brown, "a orange belly",
    "a sand belly"), mass is rounded to one digit ("about 0.1 kg" for 0.061 kg), duplicate layers repeat
    ("black spots and black spots"), and proportions the prompt asked for are never mentioned: no "sprawled"
    legs, no "short legs", "big head" or "long legs". It cannot yet answer "is this what the prompt asked?"
    for those. It also does not distinguish tusks, stinger or pincers from horns and arms.
11. **Skin "skirt" artefact on 2-segment biped legs.** In the walking filmstrip of the biped preset legs
    (attempt0 and attempt1 of p06) a translucent sheet of skin stretches from the thigh to the foot when the
    knee folds; it also showed faintly near the hips of p09. Going to 3 segments removed it, but nothing in the
    docs or in analyze says so. Also, the doc says a `tall` torso reads like a plank on a biped and to "keep
    those `round`", while the biped preset itself is `wide`; it is unclear which to choose.
12. **`look` action preview.** The doc says an action filmstrip is drawn "close on the head and neck"; for
    p09 it showed the whole body, and no motion was visible, so I could not verify the action.
13. **Minor:** `validate` prints the full minimal blueprint (about 150 lines) even when there is nothing to
    say; a `--quiet` flag would help in loops. `patch` rewrites the file in expanded form (every array
    number on its own line), which bloats a compact hand-written file.

What worked very well: the docs' tail recipe for the scorpion (`length` 2.4, `pitch` 40, `curl` 200) and the
ram-horn and tusk recipes worked on the first try; the `Units and directions` sizing line was close to
reality; the `did you mean` and `expected` texts in validation; `part_buried`; the footfall diagram plus
slide figure in the filmstrip; the action filmstrip for `roar` with its `roar-peak` event.

## Was patch convenient compared with editing JSON by hand?

Yes, a lot, for the improvement rounds: about 25 edits across the five creatures, each one call with
id-based paths (`limbs[id=foreleg].splay`, `parts[id=tusks].params.curve`) and a one-screen diff, and the
file is only written when valid (I saw it refuse a typo `lenght` with `did you mean "length"?`, and an
out-of-range `tail.length` 9 with "9 is outside 0–4"). `skin.layers[1]` by index also worked, and `add` with an
`id` for a second spot layer. Editing hand-written JSON for 8 to 12 changed fields would have been slower and
riskier. For the first draft I wrote the whole file by hand, which felt natural. Problems are the ones in
points 1, 2, 3 and 13 above (stub left by `remove`, undocumented `by`, no id suggestions, reformatted file).
Copying the file to the next attempt number and then patching it fit the "never overwrite" protocol well.
