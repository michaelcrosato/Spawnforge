# Feedback D: prompts p16 to p20 (phase 2 motion eval)

Method: read `docs/blueprint.md`, `docs/catalog.md` and the four examples with their PNGs, then used only the CLI
(`validate`, `render --labels`, `render --filmstrip`, once `describe-module walk|tripod`). No source code was read.
All five prompts ended with a valid blueprint within attempt 3 (four of them valid at attempt 0 or 1).

Files: `<id>.attemptN.json` in this folder; renders in `work/` (`pNN-aK-sheet.png`, `pNN-aK-film*.png`).
Two extra probe renders of deliberately bad quadrupeds are in `work/d-probe-*.json|png`.

## Summary table

| Prompt | Attempts (files) | Valid at | Visual revisions | Final |
| --- | --- | --- | --- | --- |
| p16-ant-soldier | 0, 1, 2 | attempt1 | 1 (attempt2) | attempt2 |
| p17-goblin | 0, 1, 2, 3 | attempt0 | 3 (attempts 1, 2, 3) | attempt3 |
| p18-cobra | 0, 1, 2 | attempt0 | 2 (attempts 1, 2) | attempt2 |
| p19-rhino | 0, 1 | attempt0 | 1 (attempt1) | attempt1 |
| p20-nightmare-hound | 0, 1 | attempt0 | 1 (attempt1) | attempt1 |

## Per prompt

### p16-ant-soldier (hexapod)

- **Validation.** attempt0 failed with one error, entirely my mistake: I wrote `"head": { "shape": "wide" }` meaning a
  wide head, confusing `shape` with `crossSection`. Message: `"wide" is not allowed`, expected `one of "round", "snout",
  "flat", "wedge"`, fix `did you mean "wedge"?`. The expected list was right, but the fix pointed at the wrong concept
  (see doc issue 1). attempt1 (shape `round`) was valid with no warnings.
- **First render.** It already read as an ant: narrow thorax, big gaster, big round head, red chitin. Two problems:
  the recipe mandibles (see doc issue 2) were small hooks hanging down the sides of the head and curving back, reading as
  tiny tusks; and the preset `splay` 55 to 60 made a spider-like sprawl (83 cm wide on an 83 cm long creature).
- **Changes in attempt2.** Mandibles moved to `at` 0.06, `angle` 125, `length` 0.3, `width` 0.032, `lean` 80, `curve` 70,
  `turn` 80, so they point forward and cross in front of the face (front and top views now read as pincers). Eyes enlarged
  to `size` 0.045. Legs shortened to 0.75 to 0.85 and `splay` reduced to 42 to 45 (width 83 cm to 65 cm).
- **Not achieved.** Antennae (not in this version), elbowed ant legs, a visible waist joint (approximated with the torso
  radius profile `[0.08, 0.1, 0.06, 0.15, 0.17, 0.1]`, which works well). Mandibles are attached to `head` (not `jaw`);
  I did not test whether they move with the `bite` action.

### p17-goblin (biped)

- **Validation.** None; attempt0 was valid with no warnings.
- **Changes after the first render.** Rendered goblin 1: head too small and the whole thing a thin tall tube, eyes on the
  sides of the head, ears tiny. attempt1: head `radius` 0.22 to 0.3 and `length` 0.4 to 0.46, torso made a pot belly
  `[0.17, 0.25, 0.26, 0.2]`, eyes moved forward (`at` 0.3, `angle` 42) and enlarged (`size` 0.1, both `irisColor` and
  `scleraColor` yellow), ears longer. attempt2: ears were sweeping backwards like horns, so I changed them to `angle` 68,
  `lean` 0, `curve` 15 (now they flare out sideways, clearly visible in the front and top views); torso/neck `pitch` 72 to
  80 for a more upright stance. attempt3 (motion): the filmstrip showed a pitter-patter shuffle (cycle 0.28 s, stride 27 cm
  for a 44 cm leg), so I set leg `segments` 3 and `"gaits": [{"type": "walk", "stride": 1.6}]`, giving cycle 0.52 s and
  stride 48 cm. The walk looks like a proper step now.
- **Not achieved.** Knees stay visibly bent even in the standing pose (the whole biped family has this, as does the bog-troll
  example), so "standing upright" is only partly true. The eyes read slightly frog-like (they bulge sideways on a round head).
  The mouth is just a jagged tooth line; no lips.

### p18-cobra (serpent)

- **Validation.** None; attempt0 valid with no warnings.
- **Changes.** attempt0 render: a 51 cm tall "bowling pin"; the neck was too short to rear convincingly, the widest part was
  near the base, and the pale belly dominated the front view. attempt1: `scale` 0.6 to 0.8, neck `length` 1.0, `pitch` 80,
  `crossSection` wide with a six-value radius profile for the hood, 8 neck segments, bigger head, belly countershade lowered
  (`height` -0.6). Height 51 cm to 92 cm. attempt2: hood radius reduced to `[0.05, 0.125, 0.105, 0.075, 0.065, 0.085]`
  (24 cm wide instead of 33 cm), neck `pitch` 74, head `pitch` -8. The belly colour went from cream to tan because the neck
  is vertical, so the ventral side faces the camera and "brown with dark bands" read as "cream with brown bands".
- **Not achieved.** An S-curved neck: the neck is one straight section at one pitch, joined to the horizontal torso with a
  sharp, near 90 degree elbow (visible in the side view). A distinct hood flare just under the head: the profile gives a
  gradual swell rather than a hood. Any neck sway or strike posture while moving (see motion).

### p19-rhino (quadruped)

- **Validation.** None; attempt0 valid with no warnings.
- **Changes.** The attempt0 render was already recognisably a rhino (nose horn plus a smaller brow horn from the recipe at
  `at` 0.12 and 0.4, grey, scaly). Fixes in attempt1: legs were thin tubes so radius `[0.1, 0.07]` to `[0.14, 0.09]` and
  length 0.5 to 0.58, toes longer; head longer (0.42 to 0.5) and neck thicker; nose horn larger; ears added (horn recipe,
  `at` 0.88, `angle` 50); `scales` layer `size` 0.05 to 0.07 and `bump` 0.6 so plates read from a distance.
- **Not achieved.** A shoulder hump, skin folds, armour plates (documented as not available), and hooves (`foot.claw` is the
  only foot, so the rhino has toes with small claws).

### p20-nightmare-hound (quadruped)

- **Validation.** None; attempt0 valid with no warnings.
- **Changes.** The attempt0 render was too dark to read: spines (dark root, `#8a8078` tip) and grime (`#4a3c30` on a `#0e0e10`
  base) nearly vanished, and the build looked like a hunched theropod. attempt1: spines `jitter` 1, taller
  `[0.08, 0.2, 0.14, 0.07]`, 22 of them, lighter colours (`#3a3034` to `#c8b8a0`); grime colour `#7a6a58`, `amount` 0.8,
  `creases` and `feet` 0.9, plus a faint `mottle`; deeper chest and narrower waist `[0.15, 0.2, 0.15, 0.09]`, arch 0.1 to
  0.04; legs 0.62/0.66 to 0.72/0.76; shorter drooping tail with no curl; longer head; pointed ears (horn recipe).
- **Not achieved.** On a near-black base the grime mostly shows on the lower legs (where it climbs from the feet); creases
  on the body stay invisible. The stance still has the preset's raptor-like hind legs rather than a canine hock. Red eyes
  work (`irisColor` red, `scleraColor` orange, slit pupil), but there is no glow.

## Docs and tools: confusing, missing or wrong

1. **Misleading "did you mean" for `head.shape`.** `"wide" is not allowed ... did you mean "wedge"?` is string-similarity
   guessing. `wide` is a valid `crossSection` value, so a better fix would be `"wide" is a crossSection value; use
   body.head.crossSection`. The docs table puts `shape` and `crossSection` in different places and an LLM easily mixes them.
2. **The mandible recipe does not give mandibles on a big head.** Quote: "Insect mandibles | `horn.curved` on `head`, `at` 0.08,
   `angle` 100; `length` 0.2, `width` 0.025, `lean` 60, `curve` 110, `turn` 90, dark colours" (and the preamble "These were
   checked against renders"). On a hexapod head with `radius` 0.17 these were small hooks hanging down the sides and sweeping
   back. What worked: `at` 0.06, `angle` 125, `length` 0.3, `width` 0.032, `lean` 80, `curve` 70, `turn` 80. The doc also does not
   say what `lean`'s "forward" is relative to when `angle` is not 0. Suggest adding the forward-pincer variant.
3. **The gait `stride` parameter is the main motion lever but is not explained in blueprint.md.** The only hint is "Stride length
   and timing scale with leg length and speed". Stride is a multiplier and also sets the cycle time: for the goblin, `stride`
   1.6 changed cycle from 0.28 s to 0.52 s and stride from 27 cm to 48 cm at the same speed. The goblin (legs about 1 torso
   length) got a fast shuffle by default, which may apply to other small bipeds; a doc note ("raise `stride` to 1.5 for bipeds") would save a revision.
4. **`footSlide` and the "problem detector" claim do not hold.** The doc says: "Legs that are too short for their body, or set
   too far forward or back, show up there as short strides, odd footfall patterns or sliding feet." Across all my creatures,
   `footSlide` was 1e-9 to 4e-7, i.e. always zero. A deliberate probe (`work/d-probe-bad-quad.json`: quadruped, both leg pairs
   0.2 long attached at `at` 0.45 and 0.55, creature 2.2 m long) gave `footSlide` 6e-8, the same clean four-beat diagram, no
   warning from `validate` or `render`, and only a stride of 18 cm to hint at it. A second probe with spindly legs (1.6)
   was equally clean (`work/d-probe-long-quad.*`). Suggest a `warnings` entry when stride is small relative to body length or
   hips are clustered, and describing what a bad `footSlide` would actually mean.
5. **Serpent filmstrip default view is nearly useless.** The default view is far away and almost side-on, so the slither wave is
   barely visible and the reared head is a few pixels. `--view top` shows it clearly (`work/p18-a2-film-top.png`). Neither
   blueprint.md nor the tool output says to use `top` for legless creatures. The motion block for slither has `duty: {}` and the
   footfall panel just says "no legs".
6. **No recipe for rearing a serpent.** The docs mention a cobra's hood under `crossSection: wide` but not how to rear up. I
   discovered that neck `pitch` 74 to 80, `length` up to 1.0 and a multi-value `radius` work. The neck cannot curve, so the
   base is a sharp elbow; worth stating as a known limit, with a recipe.
7. **Eye defaults suit "normal" eyes, not "big yellow eyes".** Default `size` is 0.022; I needed 0.1 (range 0.005 to 0.2). To get
   yellow eyes I set both `irisColor` and `scleraColor` (the default sclera is cream, so setting only the iris would give a
   cream eyeball with a yellow ring; inferred from the defaults, not tested). Eyes at the side of a round head read as frog eyes; moving to `angle` 42 helps. One sentence in the Parts section would do.
8. **Dark creatures hide their details.** With a near-black base, default-ish grime and dark spikes were invisible in the sheet.
   The docs could say that grime and spike colours need a mid-tone on a black creature (palette contrast).
9. **No hooves.** `foot.claw` is the only foot type, so a rhino or any ungulate gets toes and claws. It is documented under "Not
   in this version" for other things but hooves are not listed.
10. **Sizing line check (positive).** "a hexapod is about 1.3 x scale long ... an upright biped stands about 2.5 x scale ... a
    serpent about 3.5 x scale" were close for my blueprints (ant 1.5x with big head and long legs, goblin 2.3x, cobra 3.6x).
    The rhino and ant renders matched the doc's recipes and size lines well, which was helpful.
11. **Minor.** On the contact sheet the head view crowds its labels (eyes, ears, head, teeth all pile up); harmless. The minimal
    blueprint dropping `material: "chitin"` when it equals the preset is correct but surprised me for a second.
    `render --filmstrip` chooses speed itself (it differs per gait: 0.85 m/s for tripod, 3.2 m/s for the rhino trot); the doc
    mentions `--speed` only in the CLI help, not in blueprint.md.

## What the filmstrips showed about motion

General: in every filmstrip `footSlide` was about 1e-7 (no visible sliding), duty values were consistent with the gait
(0.5 for tripod and trot, about 0.75 for the quadruped walk, 0.62 for the biped walk), and no odd footfall patterns appeared.
The quadruped walk is a lateral-sequence four-beat (FL, HR, FR, HL), the trot is diagonal pairs.

- **Ant soldier (tripod, 0.85 to 0.90 m/s).** Cleanest of the set: two alternating tripods (frontleg.L, midleg.R, hindleg.L against
  the opposite three), exactly 0.5 duty, cycle 0.38 s then 0.49 s after I shortened the legs, with stride 33 cm then 44 cm.
  Lifted feet clear the ground, body steady. With `--gait walk` the diagram turns into a back-to-front wave on each side, offset
  between the sides (duty 0.75). Only weak point: the front and middle legs are very close together in the side view
  (attached at `at` 0.1 and 0.22), so they overlap visually.
- **Goblin (walk).** At default settings it was a stiff shuffle: cycle 0.28 s, stride 27 cm, constantly crouched knees, torso
  bobbing. Duty 0.62 gives short double-support overlaps in the diagram. After attempt3 (`stride` 1.6, 3-segment legs) the
  cycle is 0.52 s and the steps are readable. The arms swing slightly. Knees remain bent throughout.
- **Cobra (slither, about 1.1 m/s, cycle 2.1 s).** The body wave is smooth in the top view, tail and torso follow the path
  correctly, no stretching. But the rearing neck is rigid: the filmstrip shows a vertical pillar with the head fixed on top
  while the rear body undulates. It reads as a snake with a stiff periscope rather than a cobra weaving. No sway, no
  head-turn without the `look` action.
- **Rhino (walk, then trot).** Walk 0.91 m/s, cycle 1.03 s, stride 94 cm, lateral-sequence four-beat, duty 0.75, plausible and
  heavy. Trot 3.2 m/s, cycle 0.43 s, stride 1.4 m, diagonal pairs at duty 0.5, no suspension phase. No sliding. Body bobs
  a little; legs read as plain tubes, so the weight impression comes from the swing speed alone.
- **Nightmare hound (walk, then trot).** Walk 0.65 m/s, cycle 1.08 s, stride 70 cm, duty about 0.75; trot 2.65 m/s, cycle
  0.40 s, stride 1.06 m, duty 0.5. Clean and no sliding, but the preset's hind-leg shape and low-held head make the gait look like a
  theropod's. The spikes ride the spine cleanly with no jitter or detachment.
