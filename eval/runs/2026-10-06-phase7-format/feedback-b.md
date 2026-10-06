# Feedback, batch B (kraken, reef shark, cave spider, scorpion king, centaur)

Method: I read `docs/blueprint.md` and `docs/catalog.md` in full, plus the four examples. I wrote
each blueprint from those. I ran `validate` and, after all five were written, one `list-modules`
and two `describe-module` calls to check the CLI against the catalogue. I did not render or analyze,
so everything below about how the creatures *look* is unverified.

## Results per prompt

| Prompt | Attempts | Errors | `notBuilt` items |
| --- | --- | --- | --- |
| b06-kraken | 1 (attempt0) | none | 9 |
| b07-reef-shark | 1 (attempt0) | none | 6 |
| b08-cave-spider | 1 (attempt0) | none | 3 |
| b09-scorpion-king | 1 (attempt0) | none | 5 |
| b10-centaur | 1 (attempt0) | none | 7 |

All five validated with `ok: true`, `errors: []`, `warnings: []` on the first try, so there are no
attempt1 files and nothing was fixed. The `notBuilt` items, all kept:

- **b06-kraken:** `beak`, `bioluminescence`, `slime`, the `lash` action, all four `tentacle` limbs (one line each), and `motion.media.water`.
- **b07-reef-shark:** `fin.dorsal`, `fin.tail`, `membrane.fin`, `swim.undulate`, the `fin` role and `motion.media.water`.
- **b08-cave-spider:** `mandible` (the fangs), the `bands` layer and `skin.fur`.
- **b09-scorpion-king:** `armor.bands`, `hand.pincer`, the `bands` layer and the `pinch` and `lash` actions.
- **b10-centaur:** `foot.hoof` (x2), `hand.grasp`, `stance: unguligrade` (x2), `skin.fur` and the `jump` action.

Because the first try always passed, this batch says little about error messages. It says more
about what the format cannot yet draw (below).

## What each blueprint does

- **Kraken.**
  - No `extends`.
  - Torso `radius` [0.18, 0.32, 0.4, 0.3] at `scale` 2.5, `neck.length` 0, `tail.length` 0.
  - A round head with a `goat` pupil on huge `eye.basic` parts (size 0.1).
  - Four tentacle entries (`tentacle-a` to `tentacle-d`), each `side: both`, `at` 0.9, `angle` 60/100/130/160. This follows the Kraken recipe in blueprint.md and gives eight tentacles.
  - A `beak`, mottle, bioluminescence and slime layers.
  - `media.water: true`.
- **Reef shark.**
  - `extends: fish` at `scale` 1.3.
  - I overrode the preset ids `dorsal` (height 0.4, sweep 40), `tailfin` (forked, size 0.55, upper 0.65) and `pectoral` (length 0.4).
  - Added `teeth.row` (18 per row, no fangs).
  - Grey and white scales with countershade.
  - Gait `swim.undulate`.
- **Cave spider.**
  - `extends: octopod`, `scale` 0.35.
  - A larger abdomen radius profile, longer and thinner legs, and a `mandible` with `"shape": "fang"` and a green tip colour for venom.
  - Pale chitin with banded legs and a hairy coat.
- **Scorpion king.**
  - `extends: hexapod`.
  - Tail `length` 2.4, `pitch` 40, `curl` 200 (the docs' recipe) with a venom-bulb radius profile.
  - A `horn.curved` stinger on the tail at 0.97.
  - One new `arm` entry with `lift` 80 and `hand.pincer`.
  - `armor.bands` on the back.
  - A `spikes.row` on the head as a crown (my invention, for "king").
- **Centaur.**
  - `extends: centaur` at `scale` 1.7.
  - `foot.hoof` on both leg pairs, `hand.grasp` on the arms, and swept-back horns (`aim: back`) on the head.
  - A shorter neck, a smaller head and chestnut fur.

## Docs: unclear, missing, wrong or hard to find

1. **Nothing in the docs says which milestones are done.**
   - blueprint.md's "What is built so far" table says "Everything below validates now. Compile draws what is built and skips the rest". It then lists milestones 8.1 to 10.4 with no sign of which have landed.
   - The catalogue marks unbuilt *modules* ("**Not built yet** (plan milestone 9.3)"), but the field tables do not mark unbuilt *fields or roles*. Examples: `limbs[] with "role": "tentacle"`, `role: fin`, `stance`, `skin.fur` and `media.water`.
   - The only way I could find that fur, hooves, tentacles, fins and swimming are not drawn was to run `validate`.
   - For this batch that means the kraken has no visible tentacles, the shark has no visible fins, and the spider, scorpion and centaur lose most of their defining features. A user who sees `ok: true` could easily miss this.
   - Suggestion: a one-line "currently built through milestone X" in blueprint.md, and a "not built" marker on the unbuilt limb roles and field tables.

2. **The shark recipe does not mention that the `fish` preset already has the fins.**
   - The Recipes table says: "Shark or fish | `fish`; `fin.dorsal` and `fin.tail` (`"shape": "forked"`) parts, `teeth.row`".
   - Read literally, that suggests adding new `fin.dorsal` and `fin.tail` parts. Added with new ids, that would give a second dorsal fin and a second tail fin.
   - Only the catalogue's "Ids you can override: limb `pectoral`, part `eyes`, part `dorsal`, part `tailfin`" line told me to override by id.
   - The recipe should say "override `dorsal` and `tailfin`; add `teeth.row`".
   - The same applies to the Centaur recipe ("give the legs `foot.hoof`"): the leg ids (`foreleg`, `hindleg`) and the arm id (`arm`) appear only in the catalogue.

3. **There is no sizing guidance for fish, octopod, centaur or wyvern.**
   - The "Sizing" bullet covers only biped, quadruped, hexapod and serpent.
   - For the shark I added up the section lengths myself: head 0.3 + torso 1 + tail 0.9, times `scale` 1.3, about 2.9 m. A reef shark is about 1.5 to 1.9 m. I probably overshot, and should have used `scale` of about 0.8. I did not change it, because the protocol says to stop once there are no errors and I cannot use `analyze`.
   - Likewise for the centaur I estimated about 2.5 m to the top of the head from leg 0.85 + neck 0.7 + head, and did not know how tall the preset really stands.

4. **Where does `at` 0.9 put tentacles?**
   - `torso` `at` is "0 = neck end (front), 1 = tail end". So the kraken recipe puts tentacles at the *rear* of the body, as trailing arms behind a head-forward swimmer.
   - A squid or octopus has its arms around the head and mouth.
   - The Limbs section says "tentacles also to the head", but gives no example, no explanation of what `at` and `angle` mean on a head, and no recipe.
   - I followed the recipe as written. A clearer note ("for arms around the mouth, `on: head`") would help.

5. **Tentacle `curl` direction is undefined.**
   - The catalogue says "Total degrees the tentacle curls at rest; negative curls the other way".
   - Tails say "upward". For a tentacle hanging from a body there is no "up", so I alternated signs (+70, -60, +80, -90) without knowing what either sign does.
   - Please state the plane or direction (for example "positive curls toward the belly").

6. **`notBuilt` paths can point at fields I never wrote.**
   - For the shark I never set `media`, yet `notBuilt` lists `motion.media.water` ("swimming is in the format but not built yet"). I did write the `swim.undulate` gait.
   - For the kraken I did write `media: {water: true}`. The *minimal blueprint* then dropped it as redundant, while `notBuilt` still lists the path.
   - It would be clearer to say "derived from the body (no legs, has fins or tentacles)" or to point at the gait.
   - The `limbs[id=pectoral].role` item says "a fin is ... not built", which was fine. The tentacle items appear four times, once per entry. That is accurate but noisy.

7. **The hexapod description is slightly misleading.**
   - It says "a low, wide body with a chitin shell", but the preset has no shell part, only `material: chitin`.
   - I added `armor.bands` for the scorpion's "armoured back". I would have wanted to know that no shell part exists.

8. **Skin `region` values do not cover the centaur's two halves.**
   - Regions are `all`, `back`, `belly`, `head`, `torso`, `limbs`, `tail` and `wings`. There is no `neck`, `arms` or `legs`.
   - The centaur's human torso is the *neck* section, and its arms and horse legs are both `limbs`.
   - The docs never say whether `torso` includes the neck section. I could not tell whether `fur.region: ["torso", "limbs", "tail"]` covers the human chest, and it cannot cover the horse legs but not the arms.
   - There is also no way to give the human half a different skin tone from the horse half.

9. **`teeth.row` is only one upper row and one lower row.**
   - Both blueprint.md and the catalogue speak of "rows" (one `teeth.row` is a row on each jaw).
   - "Rows of teeth" for a shark needs several rows, but there is no `rows` or `inner` parameter. I could not tell whether a second `teeth.row` part with another id would stack or overlap.

10. **Small stuff.**
    - `fin.dorsal` and `fin.tail` have `color` but no `tipColor`, unlike `horn.curved`, `ear.pointed` and `membrane.feather`. So a black-tip or white-tip reef shark is impossible.
    - Redundant values silently vanish in the minimal blueprint. For example the spider's whole `body.head` disappeared because it equalled the preset. That is documented ("every value that equals the preset or a default removed"), but the length of the output makes it easy to read as an error.
    - `notBuilt` says "a unguligrade stance". That is a typo for "an unguligrade".

## Things I guessed that validated, but may be wrong

All of these passed `validate`, so I got no signal either way.

- **Redundant settings.** I set `"stance": "unguligrade"` next to `foot.hoof`. The docs say "Left out, the foot suggests one", so it is redundant. I also set `media.water: true` on the kraken, which the docs say is derived from tentacles with no legs.
- **`beak` on a kraken.** The module is described as "for birds and griffins". It needs a jaw, which my round head has.
- **A head crown.** `spikes.row` on `head` with `from`/`to` and `angle: 0` as a crown. Row parts are only illustrated on torso and spine.
- **Arm placement and pose on the hexapod.** `attach.at` 0.02 on the torso, `angle` 80, `lift` 80, `splay` 25. I do not know where the pincers end up. I also moved the three leg pairs back (0.14, 0.26, 0.38) to make room. The docs do not say how an arm points (forward, sideways or down) from `splay` plus `lift`, or how it relates to the head.
- **Gait with parameters.** `{ "type": "swim.undulate", "amplitude": 0.18, "waves": 1 }`. The docs' "parameters sit beside type" worked.
- **Spider eyes.** I overrode only `eyes` (pale, size 0.016) and left `side-eyes` dark, so the two pairs do not match. I noticed this after validating.
- **Sizes I picked.** The prompts give no size for the spider (0.35 m body, 0.45 m legs, so a giant), the scorpion (1.0 m) or the kraken (2.5 m).

## What I wished the format could say

- **Kraken:**
  - Suckers on the tentacle undersides.
  - Tentacle count by `count`, or a radial ring, instead of mirrored pairs at chosen angles.
  - A distinct mantle or siphon, and mantle fins.
  - A beak that is not framed as a bird's.
- **Reef shark:**
  - Gill slits.
  - Several tooth rows.
  - Fin tip colour.
  - Pelvic and anal fins. These can be added as more `fin` limbs, but a fin limb at `angle` 180 or near the midline is not explained.
  - A second, smaller dorsal fin.
- **Cave spider:**
  - Pedipalps.
  - Spinnerets.
  - A way to reduce or remove eyes (only `remove: true` on preset ids).
  - Leg joints with a visible knee bend.
  - A translucent, blind look.
  - Venom dripping from the fangs.
- **Scorpion king:**
  - A segmented mesosoma and metasoma (the tail's plates are only a radius profile).
  - A stinger that is part of the tail. `horn.curved` works as an approximation.
  - Chelicerae.
  - A crown part.
  - A comb-like pecten.
- **Centaur:**
  - Hair (mane, beard, human hair).
  - A mane along the neck.
  - A tail with hair.
  - A face.
  - Different skin or colour per body half: `region` values `neck`, `arms`, `legs`, or a palette per limb.
  - A stated centaur sizing line.
- **General:**
  - A way to see the *built* subset of a blueprint (what the renderer will really draw) without rendering. `validate` lists `notBuilt`, but cannot say what remains. For the kraken that is a head, a torso and four mirrored stubs.

## Summary

- All five blueprints (`out/b06-kraken.attempt0.json`, `out/b07-reef-shark.attempt0.json`, `out/b08-cave-spider.attempt0.json`, `out/b09-scorpion-king.attempt0.json`, `out/b10-centaur.attempt0.json`) validated on the first attempt with zero errors and zero warnings.
- The format covers the descriptions well on paper. Every creature's defining feature has a module or limb role: tentacles, fins, fangs, pincers, a curled stinger tail, hooves and horns.
- Most of those features are `notBuilt` today, so the real drawn result is much plainer than the blueprints. Because I could not render, I cannot say how close they are.
- The biggest doc gaps were: which milestones are done; the shark and centaur recipes not naming the preset ids to override; no sizing guidance for fish, octopod and centaur; undefined tentacle `curl` direction and head-attachment semantics; and skin regions that cannot separate the centaur's human and horse halves.
