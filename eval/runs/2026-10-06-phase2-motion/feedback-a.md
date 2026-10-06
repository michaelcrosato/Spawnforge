# Feedback A: prompts p01 to p05

Tools used: `list-modules`, `validate`, `render --labels`, `render --filmstrip` (with `--gait trot|walk`
and `--view top|3/4` where useful). No source code read. Images are in `work/` (`pNN-aK-sheet.png`,
`pNN-aK-film*.png`).

## Summary table

| Prompt | Attempts (files) | Validation errors | Visual revisions | Final file |
| --- | --- | --- | --- | --- |
| p01-wolf | 0 to 3 | none (valid at attempt0) | 3 | attempt3 |
| p02-spiked-lizard | 0 to 2 | none | 2 | attempt2 |
| p03-horn-beetle | 0 to 2 | none | 2 | attempt2 |
| p04-green-serpent | 0 to 2 | none | 2 | attempt2 |
| p05-swamp-troll | 0 to 3 | none | 3 | attempt3 (regressed, see below; attempt2 is the better file) |

All five were valid at attempt0 with 0 errors and 0 warnings. That means I never exercised the
"fix" loop on real work. To judge the error messages anyway, I validated two deliberately broken
scratch files (not saved as attempts, see "Probing validation errors" below).

## Per prompt

### p01-wolf (extends quadruped, scale 0.8)

- attempt0: quadruped with `head.shape: snout` length 0.36, tail radius profile `[0.06, 0.11, 0.09, 0.015]`
  for bushiness, longer legs, `horn.curved` ears per the recipe ("Pointed ears"), `teeth.row`,
  `countershade` at height 0 plus a fine `mottle` on the back for grey fur.
- Render showed a long, thin, low tube of a body with a small head and stick legs: it read as a
  crocodile or lizard from the side (1.7 m long, 70 cm tall).
- attempt1: deeper chest (torso radius up to 0.22), thicker neck, bigger head (radius 0.115, length
  0.4), longer legs (0.78 / 0.82), fatter and lower-hanging tail (`pitch` -35). Now 83 cm tall and
  reads as a canid.
- attempt2: head a bit longer (0.44) and larger, neck slightly longer, tail radius `[0.08, 0.16, 0.145, 0.04]`
  and length 0.66. Only a marginal change.
- attempt3: `torso.crossSection: "tall"` (narrow and deep) so the chest is no longer a barrel. This was
  the biggest improvement in silhouette (29 cm wide instead of 35 cm). Final: 1.77 m long, 82 cm tall.
- Could not achieve: real fur. There is no fur material or pattern (`skin.material` is only `skin`,
  `scales`, `chitin`); `mottle` with a small `scale` reads as camouflage blotches, not fur. The bushy
  tail is only a fat radius profile with a smooth surface. Ears are plain cones from `horn.curved`.
  A paler muzzle or leg socks cannot be done because `countershade` is the only height-based layer and
  `region` is limited to the listed names (no "muzzle" or "legs below knee"; `limbs` exists but would
  also colour the whole leg).

### p02-spiked-lizard (extends quadruped, scale 1.2)

- attempt0: wide, squat torso (`crossSection: wide`), `splay` 35 on both leg pairs, short thick legs,
  `flat` head, tail radius profile `[0.14, 0.09, 0.06, 0.07, 0.15, 0.13]` for a club, `material: scales`
  plus `scales` layer, `spikes.row` on `torso` (count 11, height profile) plus two small `spikes.row` on
  the tail club (top and sides).
- Render: the creature worked, but the head was swallowed by the torso (no neck), the tail handle was
  thin so the club was more like a bulb on a string, and the legs were very short.
- attempt1: neck 0.24 and head 0.34 / radius 0.13 so the head reads, tail thicker `[0.16, 0.12, 0.09, 0.1, 0.19, 0.16]`,
  legs +0.06, replaced the torso spike row with a `spine` row (from 0.12 to 0.78, count 16) so spikes continue
  onto the tail root, added two brow horns.
- attempt2: thicker tail handle `[0.17, 0.14, 0.12, 0.13, 0.21, 0.18]`, bigger head, thicker legs, bigger club
  spikes. Final reads as a heavy ankylosaur-like lizard, 3.0 m long, 92 cm tall, 1.1 m wide.
- Could not achieve: real armour plates (osteoderms) beyond a `scales` layer (docs list armour plates as
  "not in this version"); a club with a distinct knob that is wider than the handle is possible only through
  the radius profile.

### p03-horn-beetle (extends hexapod, scale 0.12)

- attempt0: oval body (`radius` profile peaking 0.34, `crossSection: wide`), legs repositioned along
  the torso (`at` 0.16, 0.36, 0.56) because the preset places them in the front third, near-black
  palette with orange `accent`, `material: chitin`, orange `spots` on the back, one `horn.curved`
  on the head at `angle: 0` with `lean: 50`, `curve: -40`.
- Render: horn pointed forward like a beak and was thin; legs were spindly and long (stood 9 cm tall).
- attempt1: horn with `lean: 0`, `curve: -75`, length 0.5 now rises from the head and hooks forward like a
  rhinoceros beetle; shorter, thicker legs (0.58 / 0.6 / 0.64, radius `[0.05, 0.022]`).
- attempt2: horn thicker (width 0.09) and longer (0.55), larger and denser spots (size 0.08).
  Final: 20 cm long, 8 cm tall, glossy black with orange spots, one big horn.
- Achieved everything asked. "Glossy" comes for free from `chitin`.

### p04-green-serpent (extends serpent, scale 1.8)

- attempt0: scale 1.6, thicker radius profiles, `teeth.row` with `fangs: 2` and `fangLength: 0.11`,
  yellow `stripes` (count 28, region back) on a green base, `scales` layer.
- Render: fangs came out as 8 white blades (2 per side on both upper and lower rows) that looked like a
  comb, and it was only 5.8 m long and thin.
- attempt1: scale 1.8, `lower: false`, `fangs: 1` with `fangLength: 0.14` so there are two long upper fangs;
  stripes count 22 and width 0.4 so they are bolder.
- attempt2: narrower neck and a bigger head (radius 0.115, length 0.3) so the head is distinct.
  Final: 6.6 m long, 46 cm tall, 54 cm wide.
- Could not achieve: a clearly flat, triangular snake head. `head.shape: wedge` plus `crossSection: wide`
  still renders nearly round from the front; the fangs have no width control (they are flat blades).

### p05-swamp-troll (extends biped, scale 0.85 to 0.9)

- attempt0: close to the bog-troll example idea but my own numbers: `flat` head, torso pitch 72, arm 1.6,
  leg 1.0, tusks from the jaw per the recipe, mottle plus grime. Rendered 1.77 m tall, hunched and crouched,
  with a tiny head that sank between the shoulders.
- attempt1: scale 0.9, torso pitch 78, neck 0.2 at pitch 72, bigger head (radius 0.17), leg 1.3, arm 1.75,
  longer tusks. 2.27 m tall; arms now reach below the knees. Still a deep knee bend.
- attempt2: leg 1.5, arm 1.9, scale 0.85. Height did not change (2.29 m) because the knees just flex more.
- attempt3: moved the legs' attach to `at: 0.96, angle: 160` and pitch 82/78 to try to straighten the stance.
  This REGRESSED: both legs now sit nearly on top of each other (front view shows one merged column) and the
  stance did not get more upright. attempt3 is the file with the highest number, but attempt2 is the better
  creature. I was out of visual revisions.
- Could not achieve: an upright, straight-legged stance. The biped always stands in a deep crouch
  (by eye: knee bent roughly 90 degrees at mid-stance, hips well below the leg's full length). There is
  no stance or crouch parameter, and `temperament` (calm, lumbering, aggressive) only changed walking speed
  (0.81 / 1.15 / 1.82 m/s on the same body), not posture.

## Probing validation errors (scratch only, not saved as attempts)

The error format is good: id-based paths, `expected` lists, `did you mean` fixes
(`unknown key "lenght"` fix `did you mean "length"?`; `"length" ... fix: move "length" into "params"`;
`"greyish" is not a colour` fix `did you mean "grey"?`; `"bite" needs a jaw` fix `set body.head.jaw to true`).
Problems:

1. Errors come in two stages, which contradicts the doc line "All problems are reported at once, so fix
   them all before validating again." In my first probe, `parts[id=ears].attach.on: "snout"` and
   `skin.layers[0].color: "teal"` were not reported; they only appeared in the second probe after the
   structural errors were gone. So you need at least two validate rounds even when every error has a fix.
2. `unknown_reference` for `attach.on: "snout"` has no `fix`. A "did you mean head?" would fit.
3. `validate` on a valid file prints the whole minimal blueprint (about 150 lines for the wolf). Fine for the
   MCP, but noisy at the terminal; an `--quiet` or a short summary would help.
4. A missing `from`/`to` on a `spikes.row` is accepted without any error (it uses the default anchor); only
   giving `at` triggers a warning. That is fine, just not obvious.

## Docs and tools: confusing, missing or wrong

- `--view` is not documented in `docs/blueprint.md`. The Motion section says only "`render` with `filmstrip`
  (CLI: `--filmstrip`, optionally `--gait trot`)". `--view side|3/4|top` exists, and it matters: the default
  filmstrip view is side, which hides the whole lateral wave of a `slither` (see the serpent). The doc should
  say to use `--view top` for legless creatures and sprawlers.
- The sizing paragraph "a quadruped is about 2.2 x scale from snout to tail tip and 0.75 x scale tall (a wolf
  is about 0.7)" is ambiguous: 0.7 what? I read it as `scale` 0.7. It worked (scale 0.8 gave 1.77 m long,
  0.82 m tall with longer legs), but it could say "a wolf is about `scale` 0.8".
- The upright-biped sizing "about 2.5 x scale tall" is accurate (2.27 m at scale 0.9), but the docs never say
  the stance is crouched. The "Upright and horizontal bodies" paragraph suggests torso `pitch` 70 to 85 and legs
  at `at` 0.9 gives an upright biped; in the render it is a hunched, bent-knee creature. A sentence on what
  controls hip height and knee bend (or a stance parameter) is missing.
- There is no fur anywhere (material, pattern, or tail). "Not in this version" lists wings, fins, shells,
  armour, quills, antennae, frills, but not fur or hair, though many animal prompts will ask for it. Mention it
  and suggest the nearest approximation (a fine `mottle` plus `countershade`).
- `skin.layers` docs describe `region` names, but there is no region for muzzle, legs-below-knee, tail tip,
  which is what "grey wolf with a pale belly" or "dark socks" needs. `limbs` colours whole limbs.
- `catalog.md` limb `attach.angle` default says `100`, but the quadruped preset uses `115` and the hexapod
  `120`; the blueprint.md text says "the default 100 is just below the side". Harmless, but the catalogue's
  `angle` row could say "preset-dependent".
- No guard against legs overlapping: p05 attempt3 (`angle: 160`) validated with 0 warnings although both legs
  merge into one column in the front view. A `legs_overlap` or "stance too narrow" warning from the compile
  step (like `below_ground`) would have caught it.
- `AGENTS.md` says render "draws four views"; the actual sheet has six (3/4, side, head, front, top, rear 3/4).
  The task text says six. (Not in `docs/`, so a minor point.)
- `spikes.row` on `spine`: the doc only says "a path through neck, torso and tail for rows along the whole back".
  It does what that says, but the meaning of `from`/`to` (fractions of neck+torso+tail length) is not stated.
  I could only tell by looking at the render where the row ended.
- Contact sheet for long creatures (serpent, 6.6 m) shows a tiny 3/4 and side view; only the head close-up is
  useful. A "fit to creature" option or a bigger crop would help.

## What the filmstrips showed about motion

General: `footSlide` was about 1e-7 or less for every walk and trot (0 trivially for the serpent). There was no
sliding anywhere, which is the good news. The other observations are about how the creature as a whole moves:

- In the side view only the limbs move. Torso, head and tail positions looked identical frame to frame: no body
  bob, no spine flex, no head nod, no tail sway (wolf, lizard). The stride is correct but the animals look like
  rigid bodies on moving legs. For the lizard the top view confirmed a completely rigid body and a rigid club
  tail, which is unlike a sprawler (no lateral spine undulation).

- p01 wolf: walk 0.53 to 0.58 m/s, cycle 0.87 to 0.97 s, stride 46 to 56 cm, duty 0.75 on all four legs.
  Footfall order from the chart is front-left, hind-right, front-right, hind-left (a proper lateral-sequence
  walk, and evenly spaced at quarter cycles). Trot (`--gait trot`): 2.36 m/s, cycle 0.35 s, stride 83 cm, duty 0.5,
  clean diagonal pairs (FR+HL then FL+HR). There is never a flight phase, because duty is exactly 0.5 and one
  diagonal is always down. Looks a little mechanical at speed but correct.

- p02 spiked lizard: walk 0.59 m/s, cycle 0.75 s, stride 44 cm, duty 0.75, same lateral sequence. Trot
  2.08 m/s (stride 66 cm, cycle 0.32 s) is fast for a lumbering 3 m armoured lizard; the gait is chosen by speed,
  not by temperament, so a "lumbering" creature will happily trot at 2 m/s. Legs swing fore and aft with little
  visible splay motion, so the sprawl is static. Short legs with a stride of 44 cm look like shuffling, not
  stomping.

- p03 horn beetle: `tripod` is textbook: two alternating tripods (front-left, mid-right, hind-left against
  front-right, mid-left, hind-right), duty 0.5, no sliding. Cycle 0.17 s (about 6 steps per second) and
  stride 5 cm at 0.28 m/s, which suits "skittish". But the preset also lists `walk` for hexapods, and forcing
  `--gait walk` gives a broken-looking result: cycle 0.083 s (12 Hz), stride 2.5 cm, uneven duty (0.7 and 0.8
  across legs) and a ragged footfall chart where legs plant for different lengths. It is a blur of tiny steps.
  If the speed-based chooser ever picks `walk` for a hexapod at low speed, that is what will show.

- p04 green serpent: `slither` at 0.67 m/s, cycle 6.3 s. In the side view (default) the strip looked like a
  gentle vertical bend that barely changes; only `--view top` shows the actual traveling S-wave, which is smooth
  and follows its own path. The amplitude is modest (about one S curve along 6.6 m). No footfall chart is possible
  ("no legs: the body follows its own trail"). I cannot see from this whether the belly actually grips the ground.

- p05 swamp troll: walk 0.94 to 0.98 m/s, cycle 0.85 s, stride 83 cm, duty 0.62 per leg (so about 24% double
  support each half cycle, as a human walk). Arms swing in counter-phase with the legs, which looks right and
  reads as a heavy, long-armed gait. Problems: (1) a permanent deep crouch (see above). (2) In the 3/4 filmstrip,
  frames 4 to 7, the bent leg shows a smeared, banded texture around the knee, as if the skin were stretching
  there (a skinning weight artifact). (3) When legs are placed close (attempt3) they overlap through each other.

## Three most important problems

1. The biped (troll) stands in a permanent deep crouch and nothing in the blueprint lets you fix it:
   longer legs just flex more (height barely changed between leg 1.3 and 1.5), `temperament` only changes
   speed, and pushing the leg attach point toward the belly (`angle` 160) merges the legs without any warning.
   There is also visible skin smearing at the knee in mid-stance.
2. No fur or hair, and no regions finer than `back/belly/head/torso/limbs/tail`: the wolf prompt can only be
   approximated with `mottle`, and docs do not warn about it. Ears and bushy tails are hacks (`horn.curved`,
   radius profiles).
3. Motion is leg-only and the filmstrip tooling hides it: bodies, heads and tails are rigid (lizard top view
   confirms no spine undulation), the default filmstrip view for serpents hides the wave (needs undocumented
   `--view top`), and `walk` on a hexapod gives an absurd 12 Hz cycle with ragged duty. Validation is also
   two-stage, so "all problems are reported at once" is not true.
