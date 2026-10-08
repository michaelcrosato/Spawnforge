# Gate 10 feedback, agent A (tasks m01, m03, m05, m07, m09)

Final files (all validate with no warnings, and `analyze --scenario` ends with no warnings):

| Task | Final blueprint | Scenario | Result |
| --- | --- | --- | --- |
| m01 horse gallop | `m01-horse-gallop.attempt2.json` | `m01-horse-gallop.scenario.json` | walk, trot at 0.26 s, gallop at 0.57 s, `topSpeed` 12, 112 m in 10 s; horse's own `speed.max` 12.39 |
| m03 cat pounce | `m03-cat-pounce.attempt4.json` | `m03-cat-pounce.scenario.json` | `action-start` 0.62, `takeoff` 1.07, `bite-contact` and `land` 1.59 with the head at z 3.97; `prey` `closest` 0.019 m |
| m05 crocodile lake | `m05-crocodile-lake.attempt2.json` | `m05-crocodile-lake.scenario.json` | `medium water` 6.2 s, `swim.undulate`, `medium land` 18.0 s, `arrive` 24.7 s at z 23.9 |
| m07 moth hover | `m07-moth-hover.attempt1.json` | `m07-moth-hover.scenario.json` | `takeoff` 0.65 s, `hover` gait from 0.66 s, end at (0, 0) speed 0; snout within 0.083 m of a marker at 1.5 m height |
| m09 bear hit, die | `m09-bear-hit-die.attempt5.json` | `m09-bear-hit-die.scenario.json` | `hit` + `stagger` 1.02 s, drifts 0.68 m to its right, `death` 5.02 s, lies on its side |

Revisions used: horse 2, cat 4, crocodile 2, moth 1, bear 5.

## What was hard

### 1. `limb_intersection` is whack-a-mole, and its fixes under-promise or contradict

Cat (`m03`): attempt0 warned only about `foreleg.R` (3.9 cm into the torso, "about 10° more splay").
After `patch ... splay 12` (attempt1) the warning list was different: `hindleg.L` 2.1 cm into
`hindleg.R` on flat ground, and `foreleg.L` 2.7 cm into the torso on *rough* ground. The hindleg
fix said "attach both higher up the side (a lower attach.angle) or make them thinner (radius);
splay barely helps here". I did that (angle 114 to 104, thinner radius) and the next warning was
`hindleg.R` 2.1 cm into the torso on rough ground, "about 5° more splay works best" (so splay did
help). Three more patches got to zero warnings (attempt3).

Bear (`m09`): foreleg 9.4 cm into the torso, "about 15° more splay". I added 16° (6 to 22) and
still had 3.7 cm; asked for 10° more, added 10° (32) and the foreleg was clean, but then
`hindleg.L` 3.4 cm into the torso appeared; splay 14 left 1.5 cm; then after enlarging the head and
neck, `hindleg.L` into `hindleg.R` 2.0 cm appeared, fixed with attach angle 100 and a thinner root.

Problems:
- Each `analyze` reports one limb pair at a time (the worst), so a fix reveals the next one. It
  would be far quicker if the warning listed every offending limb at once (flat and rough), or
  a single patch snippet that clears all of them.
- The stated amount of splay is not linear: "15° more" cleared about 60% of the overlap.
- The advice "a lower attach.angle" appears in two warnings and the first says it helps while the
  other says "On a broad body a lower attach.angle can make it worse". Without knowing which
  case applies, I tried each. A hint such as "pair meets because torso radius > X" would help.
- The same body gives different warnings on flat and rough ground, and `--summary` merges them.

### 2. Seeing the scenario: the camera follows the creature

`render --scenario` frames the creature only, so:
- Targets are only visible when they are within a frame or two of the creature. For the cat, the
  4 m-away `prey` ball is not visible until the cat's snout is on it (frames 10 to 16 in
  `m03-cat-pounce`), so the filmstrip does not show what the leap is aimed at.
- For the moth, once it rises past the ground the grid drops out of frame and nothing tells you
  the height (in attempt0 with no marker, frames 4 to 12 show a moth on a blank background and
  you cannot tell whether it climbed 0.3 m or 3 m).
- `analyze --scenario` has no altitude, so I used a target as an altimeter: a target at
  `[0, 1.5, 0.3]` and read its `closest` (0.083 m at 3.0 s). That trick works, but it is a hack.
  Wished: `scenario.peakHeight`, `scenario.height` at the end, and for hovering the maximum
  horizontal drift after takeoff (the true "hovers in place" number).
- Wished for render: `--camera fixed` (the world camera stays still, the creature moves through
  it), or "frame the whole path", and a ruler or ground grid that stays in view when the
  creature climbs.
- Also in the 3/4 and front views I could not tell which side was the creature's left. For the
  bear, the only evidence that the blow came from its left (and pushed it toward -X) was `end.x`
  of -0.68 in the analyze output. Wished: draw a small arrow for `hit` direction in the frame
  or on the timeline, and name the side in the event (the `hit` event carries `bone` and
  `position` but not the direction).

### 3. Making a horse look like a horse (and a bear, and a tiger)

There is no recipe in `docs/blueprint.md` for common big mammals, so I found the proportions by
render. `examples/wild-horse.json`, which I started from, still reads as a deer or a llama in
its own `wild-horse.png`: its torso is `"crossSection": "tall"`, which makes it 43 cm wide, and the
legs are thin. What worked for me (`m01` attempt1): torso `round` with radius
`[0.17, 0.23, 0.22, 0.2]` (a deep barrel), neck radius `[0.07, 0.16]`, a taller mane (`spikes.row`
`height` 0.13, `width` 0.04, `count` 26), leg root radii 0.08 and 0.10. Mass came out at 750 kg,
which is heavy for a horse (about 500), so the `muscle` 0.7 may be too much.

Bear: with `temperament` `lumbering`, neck `pitch` 15 and head `pitch` -12 the head sank into
the chest and the whole creature read as a headless blob (attempt3 sheet). The fix was neck
`pitch` 32, neck length 0.3, head `pitch` -18 and a lighter `countershade` with `region` "head".
There is no description of how much each `temperament` lowers the head or crouches, so this was
trial and error; a line per temperament in the catalogue (degrees of head drop, crouch share)
would help. Ears get lost in the fur on the bear's head (`fur.length` 0.04).

A recipes row for each of "horse", "big cat" and "bear" with numbers like the above would have
saved several renders.

### 4. Description text mislabels region layers

`analyze` for the horse says "Skin: brown hide, an orange belly and a black belly". The "black
belly" is my `countershade` with `color` "accent" and `region` "limbs" (and another with region
"tail"), reported as a belly. Same for the moth ("brown mottling, dark brown rosettes", where
the spots layer has `ring` and is a wing marking). The description does not say a layer's region.

### 5. Scenario physics notes (not wrong, just undocumented)

- `moveTo` with `speed` 12 reaches 12 m/s within 0.57 s from standing (walk, trot at 0.26 s,
  gallop at 0.57 s). A horse cannot accelerate at about 21 m/s². There is no acceleration
  limit, ramp or `start` speed, so the gait filmstrip is a stand-still then sprint.
  Docs for `moveTo` do not say it snaps to the requested speed.
- `pounce` `power`: I set 0.9 in the blueprint, then found the default 0.7 gives identical results at 4 m
  and 6 m (same `takeoff`, `bite-contact` and `closest`), so it was not needed for the task. At 8 m
  the cat still fires `bite-contact` and `land` but lands short (`prey` `closest` 1.585 m at power
  0.7, 0.774 m at 0.9), and `analyze` reports no warning and nothing in `failed`. The docs say
  the bite fires on time whatever the target; a `pounce_short` note in the scenario result
  would show a failed leap without needing to compare `closest` to a body size.
- `hit` strength: for the bear, `from: "left"` with `strength` up to 0.7 flinches only (no
  `stagger` event, no step); 0.9 and 1.0 stagger. The scenario doc says it "staggers if the blow
  would knock it over", but not that strength, mass and stance set a threshold. A 573 kg bear
  needing 0.9 is plausible, and it would help to say what a game should send.
- `footSlide` after a hit: with `hit` alone (strength 1) the bear's slide is 0.126 m; with the
  stagger and `die` it is 0.79 m, and for the stock `hit-and-die.json` on the grey wolf 0.73 m
  and the tusk boar 0.48 m. The docs say "above a centimetre or two is visible", so this looks
  like a bug until you realise the dying legs count. Wished: leave the scripted hit and death out
  of `footSlide`, or report it separately (`footSlide` before and after the first hit).
- Events and `gaits` disagree for water: the crocodile's `events` list `gait swim.paddle` and
  `gait swim.undulate` both at 6.175 s, but `gaits` lists only walk, swim.undulate, walk. If
  `swim.paddle` is just the first gait for a frame, it should not be an event.
- The crocodile's default pace is 0.44 m/s (it needs 43 s to cross a 24 m scenario). I had to give
  `moveTo` a `speed` of 1; the docs only say "its pace on land, in water or in the air". A line
  that the pace follows hip height would have told me to set it.
- The hexapod preset gets `jump` by default, so the moth says "it can jump and look". I removed it with
  `"actions": ["look", "idle"]`, which worked. A flyer with `jump` is odd but harmless.

## Docs that were unclear or wrong

- `docs/scenarios.md`: `fly` "height (metres above the ground)", but not which point of the body, nor
  the default hover height when `height` is left out; and there is no way listed to make a flyer
  hold station after a move (a `stop` call while flying "hovers (insect wings) or circles where
  it is" is only in `runtime.md`). I found `fly` alone enough for the moth, but scenarios.md does
  not say that `fly` with an insect wing ends in a hover and without wings that cannot hover it
  circles.
- `docs/scenarios.md` `hit`: `from` "left" is "90 its left", which is clear, but nothing says which
  way the creature then moves (toward -X for a blow from +X) or how to read the direction back
  from the result; I used `end.x` -0.68.
- `docs/blueprint.md` crocodile recipe row ("`quadruped` with a `wide` torso ... `splay` 60"): fine, but my first
  crocodile (foreleg `length` 0.34) gave `overstretch` ("stretched past its reach 15% of the time");
  the fix `lengthen it` was correct and 0.38 cleared it. The recipe could give the leg lengths
  (`river-crocodile.json` uses 0.36 and 0.42 at `scale` 1.1).
- `docs/blueprint.md`: `stance` says a foot suggests one and `foot.paw` is digitigrade. For the bear
  I set `stance` plantigrade on both legs explicitly. It worked, no complaint.
- The `analyze` description says "gallops up to 9.0 m/s" for a 573 kg bear and the other
  speeds are for flat ground; nothing wrong, just nothing on fatigue or mass.

## What worked well

- `patch --out` made revisions painless (all revisions after attempt0 were made this way, or by
  a small script writing a new file).
- The swim-across scenario concept: the crocodile walked in, swam with its back awash and climbed
  out with no changes beyond a lake radius and a `speed`. `medium` events at the shore are exactly
  what a game needs.
- The pounce, hover and death motions look right in the filmstrips without tuning; the moth's
  hover (nose-up posture, wings stroking, legs hanging) is convincing.

## Wishes (CLI and format)

1. `render --scenario --camera fixed|follow|wide`, and targets always inside the frame.
2. `analyze --scenario` fields: `peakHeight`/`endHeight`, `hoverDrift`, and a `leap` summary
   (distance planned, distance reached, `short` true or false).
3. All `limb_intersection` offenders in one pass, with one combined patch.
4. An acceleration setting in `moveTo` (or `accel` in `start`), so a gallop starts as a canter.
5. A `--quiet`/`--json-out` switch for `render` (it prints the whole info JSON including the full
   scenario result, which I trimmed with `grep` every time).
6. Per-temperament posture numbers in the catalogue.
7. Recipes for horse, big cat and bear in `docs/blueprint.md`.
