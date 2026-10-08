# Gate 12, suite M, agent B: feedback

Worked from docs/blueprint.md, catalog.md, scenarios.md, runtime.md and examples/ only. (An early `ls` of this
run folder showed the file names of other attempts; I opened none of them.) Renders went to the scratchpad.
Every final attempt validates with no errors or warnings, and `analyze --scenario` has no warnings on any of them.

## Tasks

| Task | Final blueprint | Scenario | What the run showed |
| --- | --- | --- | --- |
| `m02-raptor-run` | `m02-raptor-run.attempt0.json` (biped, torso pitch 12, legs at 0.6, `foot.talon`, tail 1.8) | `m02-raptor-run.scenario.json`: `moveTo [0,120]` at `speed` 8, 10 s | `topSpeed` 8, `end.speed` 8, 75.9 m in 10 s (about 7.6 m/s mean), gait events walk to `run` at 0.28 s and stays; footSlide 0; no warnings. `run` filmstrip at 8 m/s: cycle 0.40 s, duty 0.31, flight phase visible, slide 7e-8 m. |
| `m04-shark-turn` | `m04-shark-turn.attempt1.json` (fish, scale 1.3, 3.0 m, no pelvics, bigger dorsal and tail fin) | `m04-shark-turn.scenario.json`: `water: "sea"`, start `y` -3, `moveTo [0,-3,200]` at 1.5 m/s, at 10 s `moveTo [200,-3,20]` | `turned` 89, `end.heading` 88.7 (toward its left, +X), 32 m, held depth (`body` -2.81 to -2.80), `swim.undulate` throughout, no failed calls. Top-view strip shows 10 s straight, then a turn of about 3 s with the tail trailing. |
| `m06-dragon-flight` | `m06-dragon-flight.attempt0.json` (quadruped, scale 1.5, 4.9 m, wings 1.8 with `membrane.bat`, 500 kg, span 9.4 m) | `m06-dragon-flight.scenario.json`: 15 deg slope from z=100; `fly` at 0, `gait glide` at 14, `gait null` at 26, `land` to `[0,140]` at 30; 46 s | `takeoff` 0.36 s, `medium air`, `gait glide` 14.0 to 26.0, `turned` 755 (about two circles), `topSpeed` 20.3, `land` at 41.8 s on the slope at z=140.7, then `walk`; no `hard_landing`, no `wing_intersection`. |
| `m08-hydra-bite-left` | `m08-hydra-bite-left.attempt0.json` (quadruped, 5 necks, `spread` 110, 1.1 t) | `m08-hydra-bite-left.scenario.json`: target `prey` `[1.4,1.0,1.0]` (left is +X), `act bite` at 0.5 s, 2.4 s | `bite-contact` at 0.775 s with `head: "head.L2"` (the left-most head), `prey.closest` 0.085 m. Other four heads stay put. |
| `m10-turtle-dive` | `m10-turtle-dive.attempt1.json` (quadruped with legs removed, two fin-limb flipper pairs with `membrane: null`, shell, beak) | `m10-turtle-dive.scenario.json`: `water: "sea"`, start `y` -0.2, targets `deep` `[0,-3,12]` and `surface` `[0,-0.3,24]`, `moveTo deep` at 0, `moveTo surface` at 15 s; 32 s | `arrive` at `deep` 14.3 s (origin at y -3.0), `body.lowest` -2.81, `arrive` at `surface` 29.4 s; `deep.closest` 0.23 m, `surface.closest` 0.03 m; `swim.flap` throughout; no `head_underwater` or `hits_bed`. |

All five worked on the first or second try. The creature-writing side (presets, recipes, examples) was easy. The
friction was almost all in reading motion back out of scenarios.

## Cross-cutting: what was harder than it should be

1. **Scenario calls are timed, not event-driven.** "Dive, then come back up" and "cruise, then turn" need the
   second call to start after the first has finished, but the arrival time depends on speed, size and path. I
   ran the scenario once, read `arrive` at 14.3 s, then wrote the next call at 15 s. A change to the blueprint (a
   faster turtle) silently breaks the script. Wanted: `"at": "arrive"` or `"after": "previous"`, or a `hold`/`wait`
   field on `moveTo`. For the shark I had to discover that a far `moveTo` replaced by a second `moveTo` mid-flight
   gives a smooth turn, whereas a near target makes it stop first (scenarios.md says only "and stops"). `follow`
   also works for swimmers with `[x,y,z]` points (I probed it; it gave arrive events per point), but the doc says
   "Walks (or flies)", so I did not know it takes 3D points or works for swimmers until I tried.
2. **A scenario `speed` above what the body can do is honoured silently.** The shark's `speed.max` is 1.82 m/s, and
   a `moveTo` at 2 m/s ran at `topSpeed` 2 with no warning; the raptor (`speed.max` 8.57) happily ran at 20 m/s.
   I would expect a `speed_too_high` warning in the scenario check, with the max in `expected`.
3. **Nonsense motion is accepted without a word.** A walker given `moveTo [0,-3,5]` on dry ground ignores the
   `y` (no warning); the turtle in a scenario with no water walked 4.4 m over dry ground at 0.87 m/s with `failed: []`
   (docs say a swimmer "stops at the shore"). A `call_ignored` or `no_water` warning would help.
4. **The filmstrip cannot show speed, depth or altitude.** The camera follows the creature, so the raptor at
   8 m/s looks like a raptor running on the spot against a grid; the dragon in flight has no ground in most frames; the
   turtle's dive is a creature on a blue background. The docs say to read heights from `body`, `turned` and `end`,
   which I did, but a reviewer looking at the PNG alone cannot tell. Suggest per-frame labels (speed, height
   above ground or depth, heading) next to `t =`, and keeping a ground or surface line in view.
5. **`--frames` is ignored when the scenario has `frames`** (I passed `--frames 16` on a 12-frame scenario and got 12).
   The usage line lists `--frames` for filmstrips only, but nothing says it does not apply to scenarios.
   `--view` is a CLI flag only, so a scenario file cannot say how it wants to be looked at (the dragon strip
   in `side` shows a circling flyer pointing every which way; `3/4` read better, and I could only pick it at
   render time).
6. **`analyze` and `render` disagree slightly on timing.** For the dragon the landing event is at 41.80 s in `analyze`
   and 42.35 s in the rendered timeline (same blueprint and scenario). Arrive times for the turtle matched exactly.
   Not harmful, but I expected the same run.
7. **Results lack a few numbers I kept needing.** `end` has no `y` (where a flyer or swimmer finished; I read it from
   `arrive.position`, which `land` does not have); the scenario's `land` event has no `position`, though
   runtime.md says `land` events carry one; there is no mean speed (I divided `distance` by `duration`); `turned`
   is a total with no timing, so "when did the turn happen and how tight was it" needs a render; `body.lowest`
   is the middle of the torso, so a dive to a target at -3 m reads -2.81 (the turtle's torso centre sits 0.2 m above its
   origin). Docs say "a dive to 3 m shows about -3", which is true only for a body whose centre is at its
   origin. Reporting the origin's min/max beside the torso's would remove the confusion.
8. **`analyze` output is enormous without `--summary`** (hundreds of lines per gait and ground). `--summary` is in the
   docs, but only under "Check everything else"; I found it after pasting a wall. A one-liner under scenarios.md's
   first example saying `--summary --scenario` is the readable way would save time. `speed` also labels a
   swimmer's cruise as `walk` (the shark has `speed.walk` 1.16 and `speed.swim` 1.79); the description sentence
   says "swims at about 1.2 m/s", so the key name is the odd part.
9. **Flap filmstrip text is wrong for flippers.** `render --filmstrip --gait swim.flap` prints "no legs: the body
   follows its own trail (slither)" under the footfall panel. Also `--view top` is the default for legless bodies,
   which hides the flipper stroke (it is vertical); a `front` view is what one needs for flippers and the doc does
   not suggest it.

## m02-raptor-run

- **Easy:** the biped doc paragraph ("horizontal biped ... legs near the middle (`at` about 0.6), arms near the
  front (about 0.1)") and examples/rust-raptor.json gave a working body in one go. `run` goes from 0.45 to 0.3
  duty and the filmstrip confirmed a flight phase.
- **Missing:** the recipe table has no raptor row (the biped catalogue line mentions it in passing). Nothing in
  the docs says what leg length gives 8 m/s; I worked it out from `speed.max` (8.57 m/s for 1.04 m legs) and the
  Froude limit. A line such as "`run` tops out at Froude 8: max speed is about 2.8 x sqrt(g x hip height)" next to the
  gait list would let an author size legs for a target speed instead of trying.
- **Scenario subtlety:** to hold the speed for the whole strip the target has to be far (60 m was reached at
  8.1 s and the raptor slowed to a walk, which looked like a failure until I read `gaits`). The docs do not say that
  `moveTo` decelerates into its target.

## m04-shark-turn

- **Easy:** the fish recipe and examples/reef-shark.json; `pelvic` with `"remove": true` worked.
- **Confusing:** `start.y` is "the height in the world of the creature's origin", but a swimmer's origin is
  not its middle; -3 put the body's middle at -2.8. Fine once seen, but I only found it from `body.lowest`. The
  note "a swimmer that only swims starts halfway down" tells nothing about how deep halfway is in a "sea".
- **Missing:** no turn radius or turn rate in `analyze` (the creature's `measurements`), so I could not size the
  second target to get a gentle or a sharp turn; I tuned by render. The docs say the creature "banks into turns" for
  flyers but say nothing about how a swimmer turns (it did turn about 90 degrees in about 3 s at 1.5 m/s, with the
  tail bending through it, which looked right).
- **Nice:** `turned` and `end.heading` made this one checkable by number alone.

## m06-dragon-flight

- **Easy:** examples/ash-dragon.json and the flight-course scenario made the first run work: no `cannot_fly`, no
  wing warnings. The `gait` call was the only way I found to force a glide, and it worked (`gait: "glide"`, then
  `null`); nothing in scenarios.md or blueprint.md says that is how you show gliding, I inferred it from the call
  table ("keeps to one gait whatever the speed") and the gait list. A flight example with a forced glide would help.
- **Confusing:** `fly` "circles where it is". It circled at about 17 to 23 degrees a second (one circle in about 17 s), which I
  measured by running probe scenarios of 8, 14 and 20 s and reading `turned`; I wanted a circle to complete before
  the glide and had no way to ask for a radius or a number of circles. The `land` call's timing is also odd:
  landing at 30 s or 32 s both gave a touchdown at about 41.7 s, so the call time hardly matters (it seems to
  circle down first); the docs say "comes in to land there".
- **Defaults:** blueprint.md says a flyer holds "by default its span clear of" the ground; the dragon's span is 9.4 m
  and it cruised at 7.6 m (probe at 8 s and 14 s), and `analyze`'s own flight course used `height` 6.7. `body.highest`
  reads 15 m later in the full run only because the slope rises under it, which the doc does not make plain (it is
  world height, not above ground; `aboveGround` is 9.5).
- **Missing:** `analyze` does not print the wing loading (only warns past 700 N/m2), so I could not see the
  margin; a `measurements.wingLoading` would help when changing wing length or scale.

## m08-hydra-bite-left

- **Easy:** the hydra recipe, `head.L1`/`head.L2` naming and "L is +X" were clear and right (left head bit a target on +X).
- **Hard:** placing the target. `reach.heads` gives the same `bite` (0.961) and `headHeight` for all five heads and no
  position, so I had no way to know where a left head can reach. My first guess (`[2.0, 0.8, 0.5]`) gave `closest`
  0.678; I then probed three more points before one landed (`[1.4, 1.0, 1.0]`, 0.085 m). Doc says "`bite` fires on time
  whether or not it connects" (true), but nowhere says what `reach.bite` is measured from or in which direction. Suggest
  each head's rest mouth position `[x,y,z]` and its bite-contact position when aimed forward in `reach.heads`.
- **Surprising:** `lookAt prey` makes all five heads swing toward the target and bunch up (the first render looked like one
  thick head). The docs say each head "looks about on its own", but `lookAt` is creature-wide. With no `lookAt`, `act bite`
  alone aims the nearest head and the others stay put, which is what the task describes, and the numbers are identical.
  A sentence in scenarios.md ("`lookAt` turns every head") would stop people adding it.
- **Minor:** at t=0 the first frame of a scenario shows the hydra's necks raised straight up and the second frame has them at
  rest, so frame 1 is a settling transient, not the creature's rest pose.
- **Nice:** the `head` field on `bite-contact` answers "which head" directly.

## m10-turtle-dive

- **Easy:** examples/sea-turtle.json and the turtle row in the recipe table; flippers need `length` 0.4 or more.
- **Confusing:** "just under the surface" target at y -0.3 ended with the origin at -0.50 and `surface.closest` 0.03 m. The
  `closest` figure is for the snout, `arrive.position` for the origin, and they differ by 0.2 m and a pitch. Fine, but the
  two measures are not labelled as such anywhere I read.
- **Behaviour:** it dives steeply (about 45 degrees or more in the second frame, descending faster than it swims forward) and
  then levels at depth and climbs at a similar steep angle. That is plausible for a turtle, but the docs never state a pitch
  limit or a vertical speed, so I could not tell whether to expect it.
- **Water render:** from the side view the water sheet is drawn in front of the creature in the last frames, tinting
  it, so the turtle at -0.3 looks submerged and the one at -3 looks dry on a dark background (the sheet is the
  top edge of the frame). It reads backwards on first sight; a marked waterline in every frame would help.
