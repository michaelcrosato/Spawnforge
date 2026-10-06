# Spawnforge usability feedback (evaluator A)

I read `docs/blueprint.md` and `docs/catalog.md` in full, plus the four example blueprints. I then wrote five
blueprints and validated them with `pnpm -s spawnforge validate`. I did not render or analyze anything, so every
statement below is about what the format and the validator accept. I cannot say how the creatures look.

## Results per prompt

| Prompt | Attempts | Errors | Final file |
| --- | --- | --- | --- |
| b01-dragon | 1 | none | `out/b01-dragon.attempt0.json` |
| b02-wyvern | 1 | none | `out/b02-wyvern.attempt0.json` |
| b03-giant-bat | 1 | none | `out/b03-giant-bat.attempt0.json` |
| b04-hydra | 1 | none | `out/b04-hydra.attempt0.json` |
| b05-cerberus | 1 | none | `out/b05-cerberus.attempt0.json` |

Every first attempt validated with `ok: true`, no errors and no warnings. Each reported only `notBuilt` items, which
I kept. The `notBuilt` items per blueprint:

- **dragon:** `limbs[id=wing].membrane.type` (membrane.bat), `limbs[id=wing].role` (wing), `motion.media.air`.
- **wyvern:** `foot.talon`, `membrane.bat`, `limbs[id=leg].stance` (digitigrade), wing role, `motion.media.air`.
- **giant bat:** `membrane.bat`, wing role, `skin.fur`, `motion.media.air`.
- **hydra:** `foot.pad` on both leg pairs, `body.neck.count`, `stance` (plantigrade) on both leg pairs.
- **cerberus:** `foot.paw` on both leg pairs, `body.neck.count`, `stance` (digitigrade) on both leg pairs, `skin.fur`.

The things that were not drawn are the wings, several heads, fur and the new feet. They are the things the prompts
were mostly about, so the validator output cannot tell me whether those creatures read correctly.

### What I wrote for each prompt

- **b01 dragon:** `extends: quadruped`, scale 1.6. A wing limb `{ "id": "wing", "role": "wing", "length": 1.5 }`
  with `membrane.bat`. Horns are `horn.curved` at 0.8 and angle 50 with `aim: "back"`. The tail spikes are a
  `spikes.row` with `on: "tail"`, `from` 0.05, `to` 0.95 and `angle` 0. The skin is a red palette with
  `material: scales` and a `scales` layer. I added fangs and slit pupils.
- **b02 wyvern:** `extends: wyvern`. The preset already has two legs and wing forelimbs, so I changed
  proportions only. The stinger is `horn.curved` on `tail` at 0.97 and angle 0, with `curve` 60, a short length
  and a dark colour. I curled the tail tip up with `curl` 50 and `curlStart` 0.5, and put a wrist claw on each wing.
- **b03 giant bat:** `extends: wyvern`, then overrides. I shortened the neck and tail, used a small snout head,
  shortened the legs and moved them back to `at` 0.85. The wings are length 2 with `membrane.bat`, 5 fingers
  and a thumb claw. The ears are big `ear.pointed`. Fur is dark brown, on head, torso and limbs.
- **b04 hydra:** `extends: quadruped`, scale 2, thick torso and legs. `neck.count` 5, `length` 0.9, `pitch` 55.
  `foot.pad` feet, `teeth.row` with fangs, scales, `lumbering`, and `bite` in the actions.
- **b05 cerberus:** `extends: quadruped`. `neck.count` 3 and `length` 0.4, as in the recipe. `foot.paw` on all
  four legs, `ear.pointed`, red slit eyes, a near-black palette, and fur.

## Where I guessed

None of my guesses produced an error. These are the places where I guessed and got `ok: true`, so I do not know
whether I was right:

1. **Spikes on the tail.** I used `"on": "tail"` with `from`/`to`. The recipe for spikes only shows `"on": "spine"`.
   The attach table says tail runs root (0) to tip (1), so I inferred it. It validated, but nothing says the
   spikes follow the tail's `curl`.
2. **Fur numbers.** The catalog gives no table for `skin.fur`, so I took `length` 0.03 and `density` 0.8 to 0.9
   from the prose example in `blueprint.md`. I tested the ranges with a deliberately bad probe file, and the
   validator gave `0.002–0.3` for `length` and `0–1` for `density`. Those ranges are not in the docs.
3. **Fur on the bat.** I wanted fur on the body but not on the wing membranes. I wrote
   `"region": ["head", "torso", "limbs"]`. The docs do not say whether `limbs` includes the wing's arm bones, or
   where the neck and the tail root sit (there is no `neck` region). `wings` is described as covering
   "wing and fin membranes", but nothing says whether `limbs` also covers wing limbs.
4. **Wingspan.** `wing.length` is in torso lengths, and `membrane.bat.span` is "Finger length relative to the
   arm". I could not tell what total wingspan results, so I chose `length` 1.5 (dragon), 1.7 (wyvern) and 2
   (bat) from the "dragon's wings 1.2–1.8" line.
5. **Wing-claw foot.** `"foot": "foot.claw"` on a wing limb is accepted, and I read "the wrist claw" as a bat's thumb.
   For the bat I used `toes: 1` with a longer claw, which is only my reading.
6. **Heavy body.** I made the hydra heavy with thick radii, short thick legs and `lumbering`. I did not use
   `body.muscle`, which I missed because it is mentioned only in passing under "Neck shape, muscle and head
   details". I do not know whether `muscle` is the intended "heavy" knob.

## Docs: unclear, missing, wrong or hard to find

1. **The "What is built so far" table is misleading.** The heading, the sentence "Everything below validates
   now. Compile draws what is built and skips the rest", and the column "Built in milestone" read as a list of
   things that exist. `validate` showed that 8.2 (`foot.paw`, `foot.pad`, `foot.talon`, `stance`), 8.4 (`fur`),
   9.1 (`neck.count`), 9.3 (wings, membranes) and 10.4 (flying) were all not built. The table has no status
   column, so it cannot say which rows are done. I would rename it "Milestones for new features" and add a
   built or not-built column. The per-module "**Not built yet**" markers in `catalog.md` are the good, accurate
   version of this and are much easier to trust.
2. **Catalog text for `membrane.*` is wrong.** Each membrane section says `Add to "parts" with "type":
   "membrane.bat"; parameters go in "params".` `blueprint.md` says a membrane is "a wing's or fin's `membrane`
   field, not `parts`", and the `parts[].type` enum in the catalog does not list any `membrane.*`. The `foot.*`
   sections word this correctly ("Set as a limb's foot: ..."). The membrane sections should say "Set as a
   limb's membrane".
3. **Catalog tables point to nothing.** In `### skin` the row `fur` says "object (below)", and in `### motion` the
   row `media` says "object (below)". There is no table for either. `fur`'s `length`, `density`, `region` and
   `media`'s `land`, `water`, `air` are only in `blueprint.md` prose, with no ranges and no defaults.
4. **The bat recipe is too thin.** The recipe is "`wyvern` ... for a bat, `"membrane": { "type": "membrane.bat",
   "fingers": 5 }`, ears and `"skin": { "fur": {} }`." Used as written, that gives a bat with the wyvern's long neck
   (0.5), long tail (1.6, curled), 0.75-long legs at `at` 0.62 and a wedge head. I had to override
   torso, neck, head, tail, leg and wing to get bat proportions. A line saying "shorten neck and tail, move
   the legs back" would help. A `bat` preset would be better.
5. **No stinger shape in the recipe.** The recipe gives `horn.curved` on `tail` at 0.97, angle 0, `curve` 60, with no
   length or width. The default horn is `length` 0.2 and `width` 0.035, while a tail tip radius is about 0.012, so
   the default would be a thick spike on a thin tail. I picked 0.14 and 0.025 by feel.
6. **Even head counts.** "The middle head is the main one and keeps the plain names" has no middle for an even
   `count`. Both my counts (3 and 5) are odd, but a four-headed creature is not covered.
7. **`notBuilt` lists paths I never wrote.** For the wyvern, hydra and cerberus I got entries for
   `limbs[id=leg].stance` and `limbs[id=foreleg].stance`, and for the dragon, wyvern and bat `motion.media.air`.
   I never wrote those. They are derived from the foot type (`foot.talon` gave digitigrade on the wyvern, `foot.pad`
   gave plantigrade on the hydra, `foot.paw` gave digitigrade on the cerberus) and from having a wing. The docs mention the foot "suggests" a
   stance, but not that it will show up in `notBuilt`. It is correct, just surprising.
8. **Fur interplay is unclear.** Does `material: scales` combine with `fur`? Can the head be bare while the body
   is furry (yes, by `region`)? Does a `countershade` layer show through fur? The docs do not say.
9. **Region names.** Layer and fur regions are `all, back, belly, head, torso, limbs, tail, wings`. There is no
   `neck`, so I cannot tell where a neck's colour or fur comes from. On a hydra or cerberus the necks are a large
   part of the creature.
10. **Validate says nothing about looks.** `ok: true` and no warnings do not mean the creature is right. I could not
    check the `heads_overlap` risk by eye. In a probe file I set `neck.length` 0.2 on the hydra, and `validate` did
    warn: `5 heads 9% of a torso length apart would overlap ... set "spread": 60 or more, or lengthen the necks`.
    That is a good message. My real hydra (length 0.9, default 100° fan) did not trigger it.

## What worked well

- The recipe tables map almost one to one onto four of the five prompts (dragon, hydra, cerberus, bat). The
  wyvern prompt maps onto the `wyvern` preset plus the stinger recipe. This is why everything passed first time.
- Errors are good. Two probe files confirmed this: bad `fur.length` and `fur.density` got an exact range and a
  `fix`, `"wings2"` got `did you mean "wings"?`, and `"air": "yes"` got a type error.
- `notBuilt` entries carry a clear "keep it" message with the milestone number.
- `describe-module` and `list-modules --kind bodyPlan` work and show the presets. I only needed them to confirm
  ids (`leg`, `wing`, `eyes`, `teeth` on `wyvern`), which `catalog.md` also lists under "Ids you can override".

## What I wished the format could say

- **Stinger.** A tail-tip part that continues the tail axis (like `aim: "along"`) with a venom bulb. A `horn.curved`
  at angle 0 grows out of the top of the tail and bends, which is not the same as a stinger at the end of the
  tail.
- **Per-head and per-neck variation.** For a hydra I wanted staggered neck lengths and pitches (one raised, one
  low). `neck.count` gives identical necks that fan out. `head.L1` style ids exist, but only for parts. It would
  help to say something like `neck.lengthVariation`, or `necks[]` overrides.
- **Heaviness.** No `mass` or `bulk` field. "Heavy" must come from radii, leg thickness and `muscle`.
- **Bat details.** No roosting pose, no nose-leaf, and no way to give the wing membrane a different colour from the
  fur except `membrane.color`. I left it at `base`; I should have set a lighter leathery tone, which is possible.
- **Wing membrane vs body fur.** A clean way to say "fur everywhere except wings" (such as `"region": "all",
  "exclude": ["wings"]`).
- **Glowing eyes.** `eye.basic` has no emissive option, so Cerberus's red eyes are only an iris colour. A `glow`
  parameter would help.
- **Dragon extras.** Nothing for fire breath, a throat pouch or a belly plate pattern. Not needed here, but "dragon"
  is a common prompt.
- **Cerberus coat.** A "black coat" is both a palette and fur. If fur is the only way to read as a coat and fur is
  not built, the creature is just dark skin. A `fur`-like fallback in the `skin` material would be useful.

## Probe files (not attempts)

I also wrote two throwaway files in `out/` to test claims in the docs: `probe-hydra-heads.json` (parts on
`head.R2` and `head.L1`, and a tight `spread`) and `probe-fur-range.json` (deliberately wrong fur values). They
are not blueprints for the prompts.

## Summary

All five blueprints validated on the first attempt, so there were no error-fix cycles to learn from. Every
`notBuilt` item was kept. The docs were good enough that a reader who follows the recipe tables and the
preset ids gets a valid blueprint straight away. The weak spots are the misleading "What is built so far" table,
the wrong "Add to parts" text on the membrane catalog pages, the missing `skin.fur` and `motion.media` tables, a bat
recipe that skips the proportion changes a bat needs, and the stinger recipe having no size. I cannot judge
visual fidelity without rendering.
