# Feedback C: prompts b11 to b15

Method: read `docs/blueprint.md` and `docs/catalog.md` in full and the four examples, then ran
`list-modules` and `describe-module` for `frill`, `shell`, `quills`, `plates.row`, `sail`,
`swim.flap` and `display`. Wrote five blueprints and validated each. No source code read, no
render or analyze run. Two throwaway `validate` probes (described under "Probes") were deleted
afterwards.

## Results per prompt

| Prompt | Attempts | Errors | Warnings | `notBuilt` items |
| --- | --- | --- | --- | --- |
| b11-sea-turtle | 1 (attempt0) | none | none | 5: `shell`, `swim.flap`, two `fin` roles, `motion.media.water` |
| b12-quillback-boar | 1 (attempt0) | none | none | 10: `quills`, `foot.hoof` x2, `scars` x2, `display`, `stance` x2, `hide`, `head.brow` |
| b13-frilled-lizard | 1 (attempt0) | none | none | 3: `frill`, `bands`, `display` |
| b14-stegosaur | 1 (attempt0) | none | none | 5: `plates.row`, `foot.pad` x2, `stance` x2 |
| b15-sail-back | 1 (attempt0) | none | none | 1: `sail` |

Every first attempt validated, so there are no error messages to report. I kept every `notBuilt`
feature, as instructed.

What I built, in one line each:

- **b11**: `quadruped` with `foreleg` and `hindleg` removed (`{ "id": "foreleg", "remove": true }`),
  two `role: "fin"` limbs with `"membrane": null`, a `shell` part, `"media": { "water": true }`,
  `"gaits": ["swim.flap"]`, a wide torso cross-section.
- **b12**: `quadruped`, `foot.hoof` with `cloven: true`, `horn.curved` tusks on the `jaw` with
  `aim: "up"`, `quills` on the `spine` (`area: "back"`), `material: "hide"`, two `scars` layers,
  `display` in `actions`.
- **b13**: `quadruped` with sprawled legs (`splay` 50, attach `angle` 120), a `frill` on the neck,
  `display` in `actions`, `bands` on the tail, `skittish`.
- **b14**: `quadruped` with a nose-down torso (`pitch` -10) and longer hind legs, `foot.pad`,
  `plates.row` on the `spine` (`alternate: true`, a 7-point height profile), a `spikes.row` of 2
  spikes per side on the `tail`.
- **b15**: `quadruped`, sprawled, `sail` on the `spine` with a 6-point height profile and 14 spines,
  teeth, a custom palette entry `bone` used as `spineColor`.

## Probes (extra `validate` runs, deleted afterwards)

1. The turtle with `motion.media` and `motion.gaits` removed still reports
   `motion.media.water` under `notBuilt`. So the body already implies water, and the
   `"media": { "water": true }` in the guide's Turtle recipe is redundant for a fin-only body
   (harmless, but see the first issue below).
2. The stegosaur with `"actions": ["idle", "display"]` gives an error:
   `code: missing_feature, "display" needs a display`, fix `add a part or limb that provides
   "display" (list_modules shows what provides it)`. Good that it is checked. The wording is
   cryptic (see below).

## Things that were unclear, missing, wrong or hard to find

1. **"What is built so far" is misleading.** The heading promises a list of what exists, but the
   table beneath it (columns "Feature" and "Built in milestone") is a list of *planned* milestones.
   Every feature I used from it (`shell`, `quills`, `foot.hoof`, `hide`, `scars`, `frill`, `sail`,
   `plates.row`, `swim.flap`, fins) came back `notBuilt`. The text under it is accurate ("Everything
   below validates now. Compile draws what is built and skips the rest") but a reader skimming the
   heading will think rows 8.1 to 10.4 are done. Suggest renaming to "What the format holds, and
   when each part is drawn", and either ticking the rows that are done or saying plainly that
   nothing below is drawn yet. The first paragraph ("not all of it is built yet") and the table
   heading disagree.
2. **Contradiction about hooves.** The paragraph after the Motion section says "legs are tubes
   without hooves", while the table says `foot.hoof` is built in 8.2. `validate` says
   `foot.hoof` is not built. Reading the three together, it is unclear whether a boar's hooves can
   show up at all today.
3. **`notBuilt` entries for fields I never wrote.** `foot.pad` produced
   `limbs[id=foreleg].stance` ("a plantigrade stance is in the format but not built yet"), `foot.hoof`
   produced an `unguligrade` stance entry, and the turtle's `motion.media.water` appeared although
   the body implies it. The stance rule is in the guide ("Left out, the foot suggests one"), but the
   `fix` text "keep it" is odd when there is nothing in my file to keep. A note such as "implied by
   `foot.pad`" would help.
4. **How `from`/`to` on `spine` map to the body is not stated.** The guide says `spine` is "a path
   through neck, torso and tail", `at` 0 is "head end of the neck" and 1 is "tail tip". It never
   says whether the fraction follows arc length, nor where the torso sits on it. For the
   stegosaur and the sail-back I had to work it out by hand (neck 0.3 + torso 1 + tail 1.2 means the
   torso covers about 0.12 to 0.52), and I could not check the result without a render. A one-line
   formula, or a way to say "over the torso only" for a row (for example `on: "torso"`,
   `from`/`to`, which the guide does allow for `spikes.row`), would remove the guesswork. The
   catalogue defaults (`plates.row` 0.2 to 0.8, `sail` 0.25 to 0.6) are given with no body to
   relate them to.
5. **Counts for rows that are mirrored or alternating.** `plates.row.count` is "Plates in the row"
   while `alternate` is "Two staggered rows, left and right". Is `count` the total or per row? The
   same for `spikes.row` with `side: "both"` at `angle: 50` (count 2 gives 2 per side, or 2 in
   total?). I guessed total for plates and per side for spikes.
6. **`display` is only explained by its tags.** The error "needs a display" does not say which parts
   count. The `display` action text says "opens frills and hoods, raises quills and sails, spreads
   wings"; the part tags (`display` on `frill`, `quills`, `sail`; also `hood`) carry the real rule,
   and only `describe-module` shows tags. The guide should state the rule once ("any part or limb
   tagged display").
7. **Frill shape and placement.** Catalogue: "A fan of spines with skin between them around the
   neck". The default attach is `angle: 0`, and the guide says angle 0 defaults to `side: "center"`.
   So is a frill a single fan standing up behind the head, or a ring that goes around the throat? A
   frilled lizard's frill is a ring of skin that stands out sideways. I could not tell from the text
   whether `side: "both"` at `angle` 90 (two flaps) is the better model. I kept the default
   `angle: 0` and a larger `radius`.
8. **Flippers are "flat" only in the catalogue.** The `fin` role says "a short flat limb; null
   membrane makes a flipper" but the only shape controls are `radius` (a round profile) and
   `length`. Is a flipper with `"membrane": null` a flat paddle or a tube? There is no `width` or
   `flatten` field on a limb, so I cannot say how flat I got.
9. **Tusk recipe vs. a boar.** The recipe "Tusks from the lower jaw" uses `curve` -60 (forward) and
   the `aim` text says `down` is for tusks. A boar's tusks point up and out of the jaw. I used
   `aim: "up"` with `curve` 50, but the guide does not say whether `curve` still applies when
   `aim` is set, nor which way "positive" bends relative to the aimed direction. ("It replaces
   `lean` and `turn`" does not mention `curve`.)
10. **Scars on only one region.** The guide says "A region only masks where the layer shows; the
    pattern itself is laid out over the whole body". So a `scars` layer with `count: 3` and
    `region: "head"` probably shows 0 or 1 scars on the head, because the 3 are spread over the
    whole body. The guide gives this warning for `stripes.count`, not for scattered patterns. A
    sentence "to put N marks on one region, raise `count` by the region's share" would help; as it
    is I could not do what the prompt asked ("old scars on its hide", plus some on the face).
11. **Two layers of the same type.** The catalogue says a layer's `id` is "Optional id; keys the
    layer random stream", and the guide says `patch` finds a layer by type ("the first of that
    type"). Nothing says whether two layers of one type are allowed or needed an `id`. I added
    ids (`scars-body`, `scars-head`) to be safe; validate accepted them.
12. **`media` and `gaits` redundancy for the turtle.** The guide's media paragraph says a body with
    fins and no legs gets water automatically, yet the Turtle recipe adds `"media": { "water":
    true }`. The probe shows it is redundant. Also, which gait a fin-only body gets by default
    (`swim.flap`, `swim.paddle` or `swim.undulate`) is not said; I listed `swim.flap` explicitly
    because its catalogue text says "like a turtle or a penguin".
13. **Finding things in the catalogue.** It is 2,100 lines with no table of contents by kind. The
    per-module blocks repeat "Add to "parts" with ..." boilerplate, which makes scanning slow. A
    summary table at the top (id, slot, built or not) would be a big help, because "Not built yet"
    is currently a line buried in each block. The CLI does better: `list-modules --kind part`
    gives a `planned` milestone per module (absent means built), which is the fastest way to see
    what is drawn, but neither the guide nor the catalogue mentions that field, so I only found it
    by running the command.
14. **Body proportions for non-mammals.** The guide's Sizing paragraph covers biped, quadruped,
    hexapod and serpent only. For a stegosaur (hind legs much longer than fore legs) the only
    guidance is "when you change the torso's `pitch`, move the legs with it". I could not tell how
    much leg-length difference a given torso `pitch` needs; I used pitch -10 with legs 0.5 and 0.75
    (a guess, unverified).
15. **Torso and tail `pitch` are in different frames.** The guide says `pitch` on the neck, head
    and tail is measured from horizontal "whatever the torso does". That is clear and useful. But
    the catalogue describes the torso `pitch` as "tilts nose-up" and does not say a negative value is
    fine for a nose-down torso; I only learned the range (-30 to 90) from the table.

## Fields and values I guessed wrongly first

None failed validation, so I have no wrong guesses that the tool caught. These are guesses that
validate but that I am not sure are right:

- `"aim": "up"` plus `"curve": 50` for boar tusks (see item 9).
- Frill `attach.angle: 0` for a frill meant to stand out around the neck (item 7).
- `plates.row.count: 16` meaning 16 plates in total (item 5).
- The `spine` fractions `from 0.12 to 0.8` and `from 0.1 to 0.42` (item 4).
- A `head` `scars` layer with `count: 3` (item 10).
- `spineColor: "bone"` using a palette name I added myself. The guide shows this for `hornTip`, so
  it validated; the guide's example is only in the palette section, not in a part.

## What I wished the format could say but could not

- **A bipedal run for the frilled lizard.** It runs upright on its hind legs; the quadruped body plan
  has no way to say "rear up on the hind legs when fast". `run` is for 2-legged bodies only.
- **A ring-shaped or two-sided frill.** The frill is a single `center` part. There is no `wrap` or
  `sides` switch (item 7).
- **A flat flipper.** `width` or `flatten` on a `fin` limb with no membrane (item 8).
- **Plates and spikes on named body sections with exact counts.** The tail spikes of a real stegosaur
  are two pairs, sticking up and out. A row is the nearest thing, but a row at `angle` 50 with
  `side: "both"` is an approximation, and I cannot say "pointing up and back at 30 degrees from
  horizontal" as I can for a horn (`aim`).
- **Per-part colours that follow the palette in a pattern.** I wanted the sail to carry the stripe
  pattern of the body, and the plates to have a different tint at the root and the edge. `edgeColor`
  covers the plates; the sail has only a single `color`.
- **A beak on a turtle or a stegosaur.** The `beak` module exists but is described as "for birds
  and griffins", and I left it off both rather than guess.
- **Patterns confined to one limb or one part.** The `region` list has `limbs` but not "the
  flippers only" or "the tail tip", so a turtle's dark flipper edges cannot be written.
- **Sizes in metres for small details.** Everything is in torso lengths, so scale 2.5 turns plate
  heights of 0.34 into 85 cm. That is correct, but I had to do the maths to check that the plates
  were plausible (a real stegosaur plate is about 60 cm).

## Summary

All five blueprints validated on the first try (5 prompts, 5 attempts, 0 errors, 0 warnings). Each
uses the module the guide's recipe table names (`shell`, `quills`, `frill` with `display`,
`plates.row`, `sail`), and each `notBuilt` entry was kept. The docs work well for choosing the
module; they are weakest on (a) which features are actually drawn today (the "What is built so far"
heading), (b) how `spine` fractions map onto the body, and (c) a few semantics of rows, `aim` with
`curve`, and region-masked patterns that decide whether the result looks like the prompt. The
`display` check and its `fix` text were helpful, and the minimal blueprint in `validate`'s output is a
good way to see what the tool kept.
