# Gate 12, suite M, agent A: feedback

Five motion tasks, written from the docs and the CLI only. Every final blueprint validates with no
errors and no warnings, and `analyze --scenario` ends with no warnings on each. Renders are in
the scratch folder `/tmp/claude-0/-home-user-spawnforge/f521b2e4-a6af-5719-a040-22132fcd63b2/scratchpad/gate12-ma`.

| Task | Final blueprint | Scenario | What the run showed |
| --- | --- | --- | --- |
| m01 horse gallop | `m01-horse-gallop.attempt1.json` (of 0 to 1) | `m01-horse-gallop.scenario.json`: flat, 8 s, `moveTo [0,120]` at `speed` 12 | gaits walk, trot (0.26 s), gallop (0.57 s); `topSpeed` 12, end speed 12, 88.1 m in 8 s; `footSlide` 0.037; no warnings. Filmstrip at 12 m/s: cycle 0.43 s, stride 5.1 m, duty 0.24 per foot, four separate footfalls, a flight phase |
| m03 cat pounce | `m03-cat-pounce.attempt3.json` (of 0 to 3) | `m03-cat-pounce.scenario.json`: target `prey` at `[0, 0.4, 4]`, `lookAt` prey at 0, `act pounce` at 0.4, 3.4 s, 16 frames | `action-start` 0.42, `takeoff` 0.86, `bite-contact` and `land` 1.38 (head at z 4.0, y 0.4), `closest` 0.015 m for `prey`; body travelled 2.9 m; no warnings |
| m05 crocodile lake | `m05-crocodile-lake.attempt1.json` (of 0 to 1) | `m05-crocodile-lake.scenario.json`: lake `{x 0, z 8, radius 4, depth 2}`, start z 1, `moveTo [0,18]` at `speed` 1.0, 19 s | gaits walk, `swim.undulate`, walk; `medium water` 3.09 s, `medium land` 11.14 s, `arrive` 17.8 s at z 17.9; body lowest -0.28 (back awash), no `head_underwater`; `footSlide` 0.062 (see below); no warnings |
| m07 moth hover | `m07-moth-hover.attempt0.json` (valid first time) | `m07-moth-hover.scenario.json`: flat, `fly` with `height` 1.5 at 0.5 s, 8 s, 12 frames | `takeoff` and `medium air` 0.65 s, `gait` fly then `hover` 0.658 s; `end` x 0, z 0, `distance` 0; `body.highest` 1.587; hover filmstrip: 0.125 s beat (8 Hz), wings fully stroked; no warnings |
| m09 bear hit and die | `m09-bear-hit-die.attempt2.json` (of 0 to 2) | `m09-bear-hit-die.scenario.json`: flat, `hit` from left strength 1 at 1 s, `die` from left at 4 s, 6.5 s, 16 frames | `hit` 1.02 (bone `spine.3`), `stagger` 1.02, `death` 4.02; it ended 0.60 m to its right (x -0.60), lying on its right side; strength 0.7 gave no stagger and 0.8 did (matches the docs); no warnings |

Attempt history: m01 attempt1 changed only looks (thicker neck, smaller head, lighter build, mass 735 to
666 kg). m03 attempt1 and 2 were `limb_intersection` fixes, attempt3 was the look (see below).
m05 attempt1 lengthened the legs by 0.04 (foot slide 2.1 to 1.4 cm on dry ground). m09 attempt1 was a
failed fix (see below), attempt2 the working one.

## What was hard, confusing or missing, across tasks

1. **Warnings and numbers disagree at the gallop.** `analyze`'s `motion` block lists `intersection`
   per gait. For the horse's gallop (at its natural 7.1 m/s) it reports `worst` 0.127 between
   `foreleg.L` and `hindleg.L` (upper segments), 0.07 to 0.10 between the forelegs and the torso,
   and the cat's gallop 0.124 between `hindleg.L` and the torso. The unit is not documented; the
   walk warning "passes 2.6 cm into torso" matched `worst` 0.026, so it is metres, which makes
   12 cm. Yet `warnings` was empty both times. Either the gallop is excluded on purpose (then say so
   in blueprint.md, with why) or it should warn. I could not tell whether the 12 cm is a real
   defect or accepted tuck. Knobs in `gallop` (flex 0.2, stepHeight 0.15, stride 0.8) lowered a
   foreleg-torso figure but left 0.11 to 0.13 between the legs, so I could not clear it with the
   documented parameters.
2. **`analyze` checks each gait at its natural speed, not at the scenario's.** My horse gallops at
   12 m/s in the scenario (natural 7.1), and the scenario result has no intersection or overstretch
   numbers at all, only `footSlide`. A scenario run should report the same checks (limb
   intersection, overstretch, penetration) at the speeds it actually used.
3. **`footSlide` in a scenario is one number with no time or leg.** Horse: 0.037, which I found by
   re-running with shorter `duration`s that it happens between 0.6 and 1.0 s, at the trot to
   gallop change. Crocodile: 0.062, which appears only after the water exit (11.1 s): duration 11.5
   gave 0.021, duration 13 gave 0.062, and it did not change with lake depth (0.6 to 3 m) or radius.
   Nothing warns about it and the docs only say "above a centimetre or two is visible". Please
   report `{ worst, leg, time }` as the gait checks do, and warn above a threshold.
4. **Frames are evenly spaced over the whole duration and the camera follows the creature**, so a
   one-second event (a 0.9 s pounce, a 0.5 s stagger) gets 2 of 12 frames in a 6 s scenario, and
   travel cannot be seen at all (the docs say so; I did read distances from `end`). I fixed this by
   shortening durations and raising `frames` to 16, but a render option for a time window
   (`--from 0.4 --to 2`) or frames around events would be much easier than tuning the scenario to
   suit the picture. At t = 0 the horse frame shows a mid-stride stance, not a standing pose; I
   was not sure whether that is the idle stance.
5. **Scenario input errors are mostly good, two are not.** Good: `unknown_target` ("did you
   mean"-style fix), `unknown_action` listing the creature's actions, `cannot_fly` ("give it wings,
   or take the call out"), `after_end`, `out_of_range` for `duration`. Not helpful:
   - `moveTo` without `to` gives `expected tuple or tuple or string, got nothing`, with no `fix`.
     It should say `a point [x, z], [x, y, z] or a target name`.
   - A target given as `[0, 4]` (a point as calls take them) gives `needs at least 3 items`, with
     no fix. Targets need `[x, y, z]` while call points may be `[x, z]`; the table says so only in
     passing (`targets`: "`[x, y, z]`"), so this asymmetry is easy to trip on.
   - `hit` with `"from": "above"` says "one of left, right, front, back" but degrees are also valid.
   - Errors from different layers do not appear together: with an invalid `moveTo` plus an unknown
     action plus a call after the end I only got the `moveTo` error (the others appeared one pass
     later). The docs promise one pass for blueprints; scenarios behave differently.
   - The docs (scenarios.md) list "a call after the end" among the mistakes that "come back like
     blueprint errors", but it is a warning (`after_end`) and `ok` stays true.
6. **`limb_intersection` fixes pulled in opposite directions** (the cat and the bear, both with
   `quadruped` hind legs under a thick body; the bear took four tries):
   - Bear first warning: `hindleg.L (upper) passes 2.9 cm into hindleg.R`; fix says "attach both
     higher up the side (a lower attach.angle) or thinner; splay barely helps". Splay 8, 14 and 20
     alone left the same 2.9 cm, as said.
   - Lowering `attach.angle` to 100 swapped it for `passes 3.9 cm into torso`, whose fix says "more
     splay works best... a lower attach.angle can make it worse".
   - Angle 100 with splay 10 still gave 2.7 cm into the torso; angle 95 with splay 20 cleared it.
   The cat went the same way (splay 10 turned a leg-into-torso warning into a leg-into-leg one).
   The warning could give a combined fix (angle and splay together) or test its own fix before
   suggesting it. Also: "on rough ground" appears in every message even for a flat scenario,
   which made me think the scenario's ground mattered; it is the built-in gait check.
7. **Reading `analyze` output.** The full `analyze` result is very long (`motion` repeats every gait
   on flat and rough ground). `--summary` is the right default for scenarios and keeps `scenario`,
   but blueprint.md says it "leaves out the detailed motion numbers" without saying that is where
   `intersection` lives, so I only found the gallop numbers by reading the full JSON.
8. **Mass in the recipes.** blueprint.md says of the horse: "`muscle` 0.7 makes it heavy (750 kg),
   0.5 is nearer a horse's 500". I used `scale` 1.5 and the recipe's torso and legs at `muscle`
   0.5 and got 735 kg; at 0.4 with a slightly lighter torso, 666 kg. A deep `round` barrel and 26
   spikes might account for part of it, but the sentence does not match what happens.
9. **`render` with a scenario prints the whole `info` JSON** (about 100 lines of events, gaits and
   targets, duplicating `analyze`). A `--quiet` or just the path would save tokens. Each render
   took 20 to 30 s.

## Per task

### m01 horse gallop
- Easy: the horse recipe and `examples/wild-horse.json` got me a working horse on the first
  attempt, and `moveTo` with `speed` 12 immediately produced gait changes walk to trot to gallop
  within 0.57 s.
- Confusing: the scenario's `distance` 88 m in 8 s when 12 m/s would give 96 m; the acceleration is
  covered by "within about half a second" but I only worked it out from the gait events. Fine, just
  noting it when planning a course length.
- Looks: the recipe horse reads a little as a deer (long head, thin neck); a thicker neck
  (`radius` [0.08, 0.19]) and a smaller head helped. A `tall` torso is warned against in the docs,
  and I followed it.
- Missing: no way to ask what `lead` or `style` the gallop uses in a scenario result (the default
  is transverse, lead right; I never needed to change it, but the filmstrip shows footfalls so I
  checked there).

### m03 cat pounce
- The pounce itself worked on the first try and the head met the target (`closest` 0.01 to 0.015).
- **No warning when the target is out of range.** At 4 and 6 m it lands on the prey. At 8 m the
  cat still emits `takeoff`, `bite-contact` and `land`, lands 1.71 m short (`closest` 1.71) and
  at 12 m it is 5.7 m short, with no `call_failed`, no warning and `failed` empty. `analyze`'s
  `reach` lists only the bite. A `pounce` range in `reach` (about 6 m to the head for this cat) and a warning
  from the scenario would let me pick a 4 m target with confidence instead of trying distances.
- The docs' "Big cat" recipe (round head `length` 0.28, `radius` 0.12, neck `radius` [0.11, 0.16])
  gave a frog-like blob with tiny ears: the head merges into the neck. A smaller head (0.26 / 0.095),
  thinner neck ([0.085, 0.14]), a 0.4 brow, `ear.pointed` `length` 0.1 and slit pupils made it read as
  a cat. Suggest updating the recipe.
- `stalking` crouches the creature low and drops its head, so the standing cat looks hunched; fine
  for a pounce but the recipe could say so.
- A scenario hint would help: the example only shows `bite`. Nothing says that `act pounce` needs no
  `moveTo` first, or what height to give the target (I used 0.4 m, near the muzzle height).
  The head lands exactly on the target's y.

### m05 crocodile lake
- `examples/scenarios/swim-across.json` and the crocodile example made this almost mechanical.
- **One `speed` for every medium.** The croc's natural land pace is 0.4 m/s (18 m would take 45 s),
  so I gave `moveTo` a `speed`; but that speed then applies in the water too. At 1.2 m/s it trots
  on land (a trotting crocodile looks odd), at 1.0 it walks and then swims, at 0.7 it walks and swims
  but is slow. The `analyze` result lists overlapping gait ranges (walk 0 to 1.147, trot 1.026 to
  1.987) and I only learned which one is chosen by running at several speeds. A per-medium speed
  or `speed: {land, water}` on `moveTo`, or at least a note saying "pick speed below the walk
  limit to keep a walk", would help. I did not try `gait` locking inside water.
- `body.aboveGround` is 1.99 for a 0.6 m crocodile in a 2 m lake: it is measured from the lake bed
  while swimming, which the docs do not say ("a flyer's altitude, a leap's height"). It read like a
  jump at first.
- The side view makes the water a faint sheet; the `top` view showed the crossing clearly (the
  creature is the one thing that moves while the lake slides by, as the camera follows). Worth
  saying in scenarios.md which view to use for water.
- Foot slide at the water exit is mentioned above. Legs of 0.36/0.42 (the recipe) slid 2.1 cm on dry
  ground; 0.40/0.46 slid 1.4 cm.

### m07 moth hover
- `examples/luna-moth.json` plus the Moth recipe row made the blueprint trivial; it validated first
  time and compiled with no warnings. I changed the colours, proportions (forewing 1.3, hindwing
  0.95) and used a banded abdomen.
- `fly` with a `height` hovers an insect-winged creature, as documented. What I could not read from
  the result: when it reached the hover height. There is a `takeoff` at 0.65 s and a `gait hover`
  at 0.658 s (before it has climbed), but no event for reaching the height, and `end` has `x`,
  `z`, `heading` and `speed` but no `y`. I checked by `body.highest` (1.587 for height 1.5, so the
  torso middle apparently sits about 9 cm above the origin; the docs do not state the relation) and by looking at
  frames. Please add `end.y` (or `end.height`) and a hover-reached event.
- The description line calls the moth "a 69 cm long, 22 cm tall 6-legged creature" and says it
  "can jump and look"; a flying insect that "can jump" is misleading (it does so by default since
  it has legs). Not a blocker.
- During the climb the body is pitched nearly vertical (frames at 1.5 to 3 s) before settling at
  about 40 degrees: it looks like a rocket, not a hawk moth. I did not find a documented way to
  change a hoverer's attitude.

### m09 bear hit and die
- The hit and death docs and `examples/scenarios/hit-and-die.json` were enough. The stagger threshold
  statement ("broad, low bodies (a bear, a boar) from about 0.8") is accurate: 0.7 gives only a
  `hit`, 0.8 a `stagger`.
- The task says "hit hard from its left ... later dies"; whether the killing blow comes from the
  left is not stated. I used `die` `from: "left"` (the example does the same, and the creature falls
  onto its right side, as the docs say). `die`'s default is `right`, which is easy to forget.
- `stagger`'s `position` is `[0,0,0]` (where it stood when hit) while the `death` position
  `[-0.6, 0, 0]` is where it fell; the docs do not say these are the creature's position at the
  event time versus the body's, so I used `end.x` -0.599 to confirm "falls away from the blow".
- The side camera shows the creature's left flank (the camera is on +X), which is the near side for a
  left blow; the docs could say which side each `--view` looks from, since the direction of a fall
  is the point of this task. I found out from the creature facing screen-left.
- Dark brown fur at `density` 0.9 renders nearly black on a grey floor; the shape is hard to read in
  the filmstrip. Not a format problem; a lighter base helps.

## Smaller things

- `patch --out file` was a good way to produce `attemptN.json` and prints a clean diff; it also
  accepts several ops in one call, which I used for every attempt.
- The hit scenario's `die` default and the `hit` `from` degrees convention ("90 its left") would be
  easier to remember if the allowed forms were printed in the validation error (see 5).
