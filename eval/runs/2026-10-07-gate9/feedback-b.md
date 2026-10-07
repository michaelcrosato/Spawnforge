# Gate 9 feedback, agent B (p06 to p10)

Worked only from `docs/blueprint.md`, `docs/catalog.md`, `examples/` and the CLI. Renders went to the
scratch folder. Every attempt was validated; every valid one was rendered (contact sheet) and run
through `analyze`; filmstrips were run on the final attempts of p06, p07, p09 and p10, and on
attempt2 (not the final attempt3) of p08.

## Summary

| Prompt | Attempt files | First valid | Revisions after it | What drove the revisions | Final `analyze` warnings |
| --- | --- | --- | --- | --- | --- |
| p06-ram-demon | attempt0 to attempt4 (final: attempt4) | attempt0 | 4 (attempt1, 2, 3, 4); attempt3 was **invalid** | a0: `limb_intersection` (legs, 1.1 cm) and a stick-thin 2.2 m body; a1: over-corrected into a barrel with tiny legs and no neck; a2: `unbalanced` (0.3 cm) plus horns and head too small; a3: bigger horns, head and split stripe layers, but `horn.curved` `length` 1.1 is out of range (max 1); a4: fixed the range | `unbalanced`: centre of mass 1.1 cm outside the feet. **Not fixed**: attempts ran out |
| p07-sprawl-lizard | attempt0, attempt1 (final: attempt1) | attempt0 | 1 | Contact sheet was right at once. The filmstrip showed a 0.075 s walk cycle (13 steps a second) on a scale 0.1 body, with no warning. Raised `scale` to 0.12, legs 0.5 to 0.62/0.68, a slightly thicker body: cycle 0.10 s, 9.4 steps a second | none |
| p08-boar | attempt0 to attempt3 (final: attempt3) | attempt0 | 3 | a0: head and neck fused into the body so no head read, legs were stubs, `limb_intersection` foreleg into torso 5.2 cm. a1: separated neck, longer head, more splay. a2: the tail was invisible (`pitch` 50 plus `curl` 90 folded it back into the rump), thicker legs caused a new `limb_intersection` (1.2 cm). a3: tail `pitch` 15 and `curl` 70, hind `splay` 30 | none |
| p09-long-neck | attempt0 to attempt2 (final: attempt2) | attempt0 | 2 | a0: `limb_intersection` foreleg into hindleg by 8.3 cm, spindly torso. a1: legs 1.15 to 1.1, `attach.at` 0.14/0.86 to 0.08/0.92, bigger torso: still 1.1 cm on rough ground. a2: `attach.at` 0.06/0.94, thicker neck | none |
| p10-scorpion | attempt0, attempt1 (final: attempt1) | attempt0 | 1 | Look only (no warnings at any point): legs read as sticks and the torso as slim, so thicker legs, a chunkier torso, a swell in the tail `radius` before the stinger, faint sandy mottle | none |

Total: five prompts, five first-try-valid blueprints, 11 revisions, one wasted on an out-of-range value.

## p06-ram-demon

What worked: the ram-horn recipe row (`at` 0.6, `angle` 85, `turn` -70, `lean` 10, `curve` 400, `ridges` 12)
produced recognisable ram loops on the first try. The `biped` preset plus a `goat` pupil, `squint` and
`brow` read as a demon with no further effort. `hand.grasp` and `foot.hoof` cloven both worked.

Confusing, missing or hard:

- **The `unbalanced` warning gives no direction and its fix points the wrong way.** "the centre of mass is
  1.1 cm outside the feet. Fix: move the legs under the body (attach.at), lean the torso less (pitch)". I
  could not tell whether the mass was in front of or behind the feet. "Lean less" is also ambiguous against a
  `pitch` that is "degrees nose-up, 75 for upright": less lean is a **higher** number, but I read "pitch" and
  lowered it (76 to 74), and moved the legs from `at` 0.92 to 0.86 while making the head and horns bigger. The
  margin went from -0.3 cm to -1.1 cm. On a nearly vertical torso, `attach.at` moves the hip mostly up the
  torso, not forward, so that fix does little. Suggest: "centre of mass is 1.1 cm in front of the feet:
  raise torso.pitch by about 3 degrees (more upright), or ...", computed the way the `limb_intersection`
  fixes give amounts. `stability.margin` is negative in `analyze` but the foot positions and the sign
  convention are not reported, so I could not work it out by hand.
- **`horn.curved` `length` tops out at 1 (torso lengths), and I only found it by failing.** The error was
  clear ("1.1 is outside 0.02-1 ... use a value in range, e.g. 1") but that consumed one of my five attempts.
  The Recipes paragraph says coiled horns need `length` 0.5 to 0.75; it never says that the coil radius is
  roughly `length / curve(rad)`, so doubling `length` does not make the coil visibly bigger on a head. I raised
  `length` 0.65 to 0.9 and the loops looked about the same size; the head radius (and `width`) mattered more.
  A line such as "to make a bigger curl, raise `length` or lower `curve`; the coil's radius is about
  length/curve in radians" would save experiments.
- **The preset biped trips `limb_intersection` as soon as `body.muscle` is raised.** attempt0 left the
  legs at the preset and only added `muscle` 0.7, a bigger `scale`, a heavier brow and longer arms, and got legs
  meeting under the body by 1.1 cm. The fix text was good
  ("a lower attach.angle"), but `muscle` in the docs says nothing about thicker thighs needing a lower leg
  `angle` (the preset is 130).
- **Layers take a single `region`, fur takes a list.** I wanted stripes on torso and limbs but not on the head
  (a stripe landed across the crown and made the head look like a black mask). There is no "everything but
  the head" region, and `fur.region` accepts a list while `skin.layers[].region` does not, so I duplicated the
  `stripes` layer with `region` "torso" and "limbs". That produced **a visible wavy seam at the hips**: in the
  front view and in the walking filmstrip the pelvis shows a skirt-like flare of fine dark lines where the two
  stripe layers meet. Please allow `region` to be a list on layers (as on `fur`), and say in the docs that
  splitting a pattern by region can seam at the joins.
- The biped preset is a stick figure at default radii (`scale` 0.85 gave a 2.2 m tall, 57 cm wide figure). I
  had to guess torso radius profiles twice ([0.2,0.29,0.27,0.22] was a barrel with no neck; [0.15,0.25,0.2,0.15]
  worked). A "heavy, broad-shouldered biped" recipe row (torso `radius`, `crossSection` "wide", neck and head
  sizes, leg `radius`) would help; the centaur has one, the biped does not.
- `analyze` prints about 300 lines of JSON (every gait on flat and rough ground). The `warnings` and
  `description` I actually needed were buried at the end, so I post-processed with a script on every run. A
  `--summary` flag (measurements, warnings, description) would help a model that cannot script.
- `measurements.length` for an upright biped is its front-to-back depth (0.51 m on a 2.2 m demon), which reads
  as a bug; the contact sheet header calls the same number "deep".
- The description names the horns "long coiled horns" (fine), colours the dark-red belly "a red belly", and
  never mentions the stripes' spacing; it was still the right sanity check.

## p07-sprawl-lizard

What worked: the quadruped preset with `splay` 58 and `angle` 118 (the docs' sprawler numbers) gave sprawled
legs at once; `material: scales`, `tongue: forked`, `spots` with `region: back` and a `tail.length` 2.4 to 2.6
were all one-line changes. First blueprint matched the prompt at a glance.

Confusing, missing or hard:

- **"Tiny" has no calibration and the motion for tiny creatures is poor with no warning.** The doc says
  `fast_cadence` is avoided if you make the creature `skittish`, and that is exactly what a tiny lizard is, so
  the check was silenced. The result was a walk cycle of 0.075 s at scale 0.1 (11.5 steps a second, stride 2
  cm) that the filmstrip shows as legs flickering. I got it to 0.10 s (9.4 steps a second) by raising scale and
  leg length, but there is no guidance on how small is "small enough" or what to trade (stride, `duty`,
  `stepHeight`). Suggest keeping the cadence number in the warning list as `info` even for skittish creatures,
  or add a recipe row for small creatures.
- Because lengths are torso multiples and the tail is 2.4 to 2.6 torso lengths, a "tiny" lizard with a torso of
  10 to 12 cm is 39 to 45 cm long. Fine, but the docs' sizing paragraph covers only plan-sized bodies.
- `region: back` covers the back of the tail as well as the torso, so spots run all the way to the tail tip.
  This is documented ("laid out over the whole body") but it means a "spotted back" and a "spotted back and
  tail" cannot be told apart without a second layer; fine here.
- The small head panel in the contact sheet is zoomed so far on a 4 cm head that it shows only the snout;
  `--views top,3/4 --size 900 --quality high` (as the docs suggest) is needed to judge spots.

## p08-boar

What worked: the `tusk-boar` example plus the "Tusks from the lower jaw" recipe row made tusks trivial; cloven
`foot.hoof`, `material: hide` and `spikes.row` bristles are all correct for a boar.

Confusing, missing or hard:

- **A big head merges into a big body.** With a head `radius` 0.23 and torso `radius` max 0.30 and almost no
  neck, the creature read as a hippo-shaped blob (no head silhouette). What fixed it was a longer neck (0.1 to
  0.2) with a narrower root, and a longer snout. The docs say how to make a long head on a neck but not how to
  make a heavy, big-headed beast without losing the head; a "stocky big-headed beast" row (neck `length` about 0.2,
  neck `radius` narrower than the torso end, head `length` 0.5 and `pitch` -12) would help.
- **A tiny tail can vanish inside the body, and nothing says so.** The docs do say a tail is measured "at `pitch`
  then bends up by `curl` in total", but the end direction is `pitch + curl`, which I did not add up:
  `pitch` 50 plus `curl` 90 sent the tail back over the rump (140 degrees), so no tail showed at all in any of
  the six views. `analyze` described it as "a short tail" and raised no warning. A `tail_hidden` warning when
  the whole tail lies inside the body silhouette, plus one line in the Tails paragraph ("the tip points at
  pitch + curl degrees from straight back"), would remove the guesswork. A tail shorter than the torso end
  radius (0.18 against 0.19) is also hidden by construction.
- **Stocky legs and `limb_intersection`.** A broad torso with thicker legs trips `limb_intersection` (foreleg into
  torso 5.2 cm; after thickening, hindleg into torso 1.2 cm). The fix text ("about 10 degrees more splay works
  best", "about 5 degrees more splay") was good and worked the first time each. But it then makes the
  `analyze` description say "sprawling legs" for a boar whose legs are short and stocky (splay 24 to 30 on a
  0.9 m body), which contradicts the prompt wording when reading the description back.
- Description colour words are unreliable: a `#9a8470` belly (grey tan) is "an orange belly", `#cda25a` (p09) is
  "orange scales", the pale `#efe2b8` belly is "golden". Fine to read, but it can send a model chasing a
  non-problem.
- The description calls tusks "curved horns on its jaw" (and in p10 a stinger "a curved horn on its tail"). It
  is accurate for the module, but it hides the thing the prompt asked for ("tusks", "stinger").

## p09-long-neck

What worked: `neck.length` 1.2 with `pitch` 72 and `segments` 6 gives a convincing giraffe neck; `neck.curve`
12 to 20 adds a lizard-like S; the `spots` layer, `material: scales`, slit pupil and `forked` tongue make it
read as "giraffe crossed with lizard" without any further tricks. Long legs of 1.1 to 1.15 are within the docs'
range and stood fine (`stability` supported).

Confusing, missing or hard:

- **Long legs on a one-torso-length body collide in the stride.** `limb_intersection` foreleg into hindleg by 8.3
  cm at first. The fix text gave three options with an amount ("a smaller gait stride, attach.at further apart, or
  thinner legs, by about 8 cm"), which was helpful, but fixing it took two rounds because the leftover 1.1 cm
  showed only on the **rough** run: the flat-ground figure was clean. I would report the worst case over both
  grounds in one number, or say which ground it came from (it does, in the message), and suggest the amount
  needed for the worst of them.
- The quadruped preset has no notion of a tall neck and torso balance; I never needed `analyze` to
  say `unbalanced` here, but I am not sure why a 1.2 m neck leaning forward is stable (margin 0.36 m).
  A one-line note that balance is checked on the whole centre of mass would be reassuring.
- `neck.radius` goes "head end to torso end" and the preset neck is `[0.07, 0.1]`. I changed it from
  `[0.04, 0.085]` to `[0.048, 0.1]` to `[0.05, 0.12]` and saw almost no difference in the render, so I am
  not sure the profile reaches the base; maybe the muscle taper hides it. It would help to say how neck
  `radius` interacts with `body.muscle` ("the neck gets a muscle into the shoulders").
- Spot size 0.05 to 0.055 of the torso length on a 1.2 m torso gave 5 to 6 cm spots; giraffe-like patches
  needed `size` 0.08 to 0.1. I kept the smaller ones so that the neck would also be spotted. A line in the Skin
  section that "spots on a long creature need a bigger `size` to read as patches" would be useful.

## p10-scorpion

What worked: **the scorpion tail recipe was exactly right** (`length` 2.4, `pitch` 40, `curl` 200 on a hexapod
torso): the tail arches over the back with the tip hanging ahead of the head, and a `horn.curved` stinger at
`at` 0.97 sat on the tip, first try, zero warnings. The `chitin` material, `bands` and `mandible` `fang`
shape made it read as arachnid-ish. Sandy palette was a one-line change.

Confusing, missing or hard:

- **Six legs versus the scorpion recipe.** The recipe table says "Spider or scorpion: `octopod`", but the prompt
  asked for six legs, so I used `hexapod` and kept it as a pincerless crawler. A reader needs to guess that a
  hexapod can take the same tail and stinger. I deliberately left out pincer arms so that "six legs" would not
  be miscounted as eight appendages. A recipe row for "six-legged desert crawler" or a note that the tail
  recipe works on a hexapod would help.
- The tail `radius` swell for a venom sac (`[0.075,0.06,0.05,0.045,0.045,0.06,0.05,0.025]`) is barely visible in
  the render because the stinger's width and the thick tail dominate; the "club on the tail" recipe uses
  `segments` 12 for this, which I also did, but it is subtle at this thickness.
- The description says "a curved horn on its tail" instead of "a stinger".
- Hexapod legs with `foot.claw` `toes: 1` are visually thin at default radius `[0.035,0.015]`; I raised them
  to `[0.05,0.022]`.

## General

- **Protocol cost of one validation mistake.** I overshot a catalogue range once (`horn.curved` `length` 1.1;
  max 1). That attempt is permanent, so the demon ended with 4 attempts to fix everything, not 5. The error
  message itself was excellent (path, range, a concrete fix). No error message was unhelpful.
- Every `limb_intersection` and `below_ground` style warning came with an amount; the `unbalanced` one is the
  only warning where I could not tell what to change.
- `render --labels` piles every label into one column on the left in the 3/4 view and they overlap on small
  heads; the side view is cleaner.
- The `validate` result gives "warnings: []" for blueprints that `analyze` later flags, so the real feedback
  loop is `render` plus `analyze`; maybe say so near the top of the Motion section.
- Things I would add to the docs: (1) what angle the tail tip ends at (`pitch + curl`); (2) a "heavy biped" and a
  "stocky quadruped with a big head" recipe; (3) layers' `region` as a list; (4) a note on how to make a tiny
  creature animate acceptably; (5) which way the centre of mass sits when `unbalanced` fires and which numeric
  direction fixes it.
