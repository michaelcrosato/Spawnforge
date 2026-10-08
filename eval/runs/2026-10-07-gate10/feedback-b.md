# Feedback from agent B (gate 10, tasks m02, m04, m06, m08, m10)

Final files: `m02-raptor-run.attempt1.json`, `m04-shark-turn.attempt3.json`,
`m06-dragon-flight.attempt6.json`, `m08-hydra-bite-left.attempt2.json`,
`m10-turtle-dive.attempt1.json`, each with its `<id>.scenario.json`. All five validate with no
errors or warnings. `analyze` still warns on m06 attempt6 (see "What was hard").

All commands below are `pnpm spawnforge ...` from `/home/user/sf-dev`.

## What went well

- Starting from the closest example (rust-raptor, reef-shark, ash-dragon, hydra, sea-turtle) and
  changing proportions worked first time for the raptor, hydra and turtle. The raptor ran at
  8 m/s with `moveTo ... "speed": 8` and no warnings; `render --filmstrip --gait run --speed 8`
  confirmed duty 0.32 (both feet off the ground).
- `head_intersection` gave a fix that worked as written: "fan the necks wider (body.neck.spread
  about 115)". Setting 115 cleared it and the nearest head (`head.L2`) still bit.
- `bite-contact` carrying `head: "head.L2"` is exactly what the hydra task needs. Per-target
  `closest` is the only way I had to tell a bite connected.
- `moveTo` to a target with a negative y (`"deep": [0, -3, 8]`) dived and held depth; `closest`
  for `deep` was 0.17 to 0.20 m (the snout) and for `surface` 0.07 to 0.11 m.

## What was hard

1. **No depth or height in `analyze --scenario`.** m10 is about reaching 3 m down and m06 about
   altitude and circling, but `scenario` reports only `end`, `distance`, `topSpeed`, `events`,
   `gaits`, `targets.closest`. I used `targets.deep.closest` (snout to the target, 0.199 m) as the
   only evidence of depth. For the dragon I had no number for the height it flew at, the circle
   radius, or the bank. I saw circling only by rendering `--view top`.
2. **Filmstrips follow the creature, so travel and depth are invisible.** In
   `render --scenario ... --view side` the camera tracks the creature, so a turtle diving 3 m
   looks identical to one cruising level (only the pitch changes and a water-sheet band appears
   or disappears). I could not read a depth off any frame. A fixed world camera (or a ground
   track and a depth/height strip under the timeline) would fix this.
3. **The default `--view` for scenarios is not documented.** For the shark and turtle
   (swimmers) the default is a top-down view, so the first renders showed only the shell seen
   through the water. docs/blueprint.md says "default side; serpents from above; actions at 3/4"
   and scenarios.md says nothing. Add swimmers (and fliers) to that sentence.
4. **Limb-intersection warnings chased each other on the dragon (used all 6 revisions).**
   Widening the body made the hind legs touch. Each fix moved the warning elsewhere:
   - attempt1: `hindleg.L passes 6.4 cm into hindleg.R`. Fix was "attach lower angle", so I set
     `hindleg.attach.angle` 115 to 92.
   - attempt2: now `foreleg.R (middle segment) passes 6.6 cm into torso`. Its fix text says
     "about 10 degrees more splay works best ... On a broad body a lower attach.angle can make it
     worse", which is what my first fix had done.
   - attempt3 (foreleg splay 12): `hindleg.R passes 8.4 cm into torso`.
   - attempt4 (hindleg splay 12): `foreleg.L 6.2 cm` plus `body.tail ground_penetration 7.1 cm`.
   - attempt5 (thinner legs, angles back to 105): `foreleg.L 3.2 cm`, "about 5 degrees more splay".
   - attempt6 (foreleg splay 20): `hindleg.L 2.3 cm`. I stopped here and left it.
   It looks as if only the worst intersection is shown at a time, and the check seems to run
   again from scratch on rough ground after each change. For a flying task these are walking
   checks that the scenario never exercises. Wishes: list every intersecting limb pair in one
   pass with the splay/angle that clears all of them, and do not let a walk-only warning
   dominate a flight scenario's `analyze`.
5. **The example hydra does not bite a target at a plausible distance.**
   `analyze examples/hydra.json --scenario` with `prey` at [1.8, 0.7, 0.9] gave a bite that
   closed at `closest` 0.361 m, so I had to move the prey in to about [1.5, 0.9, 1.0] (later
   [1.7, 0.9, 0.7]). The full `analyze` has `reach.bite` 1.002 for every head, but the bite
   contact was at about 1.7 m horizontal from the origin, so I cannot tell what `reach.bite`
   measures (from the neck root? the head root?). It is also identical for all five heads, so it
   says nothing about which head is nearest. `--summary` drops `reach` entirely, which is where
   I would look first for this task.
6. **Swimmers start at the surface.** A shark scenario with `"water": "sea"` and a first
   `moveTo` at y = -1.5 begins with a nose-down dive from the surface (visible in frame 1 of the
   3/4 render). I tried `"start": {"height": 14}` to begin at depth: it was accepted with no
   error or warning, the shark started somewhere deeper than -1.5 m and then pitched up about
   60 degrees in the first 2 s to reach it. I could not work out what `height` is relative to for
   a swimmer (scenarios.md: "the bed four body lengths and 2 m down", and "height above the
   ground"; whose length? the 3.4 m body or `scale` 1.5?). I dropped it and kept the dive. A
   `start.y` (or `start.depth`) would be clearer.
7. **Timings had to be found by running twice.** For m10 I ran once to learn that `deep` is
   reached at about 10.5 s and then scheduled `moveTo surface` after it. A way to chain
   ("`after`": "arrive", or a `wait`/`then` call) would remove the guesswork. In m06 the landing
   takes about 15 s after the `land` call (called at 28 s, touchdown at 42.5 to 43.9 s), which
   the docs do not say, so I ran a 55 s scenario to be safe.

## Docs that were unclear or wrong

- **scenarios.md, `events`:** "`gait` (a change of gait)". A `gait` call that forces a gait
  (`{"do": "gait", "gait": "glide"}`) changes the gait (it appears in `gaits` at 16.008 s) but
  fires no `gait` event: the events list shows only `fly` at 26.016 s when I released it. The
  event list and the gaits list disagree about what happened.
- **scenarios.md, `arrive`:** the two `arrive` events in m10 carry no target name or position,
  so with several `moveTo` calls I cannot tell which was reached. Add `target` or `to`.
- **blueprint.md, fish and shark recipe:** it does not say that a `fin` limb of `length` 0.4 or
  more makes the gait list gain `swim.flap` (flippers). My first shark had pectorals of 0.42; the
  gaits list showed `swim.flap` and `swim.undulate`, and at 2 m/s it flapped its pectoral fins
  like a turtle. I found this only because the gait events changed (`swim.undulate` to
  `swim.flap` at 0.44 s). A `validate` or `analyze` note ("pectoral will beat as flippers: keep
  length under 0.4 for a fixed fin") would save a revision.
- **blueprint.md, `crossSection`:** the fish torso in a `round` cross-section rendered about as
  deep as it was wide from above, but in the side view it looked flat and thin (it read as a
  plank, not a shark). Switching the torso and head to `tall` (as the preset has) fixed the
  silhouette. The doc recommends `round` only for bipeds, so this is not wrong, but the shark
  recipe could say "keep `tall`".
- **scenarios.md, flight:** "`fly` ... Takes off and circles ... until told where to go" gives no
  radius or direction, and there is no way to ask for one. The doc for `land` says it comes in "on
  the first clear ground ahead" but the dragon's landing took 15 s and overshot the target point
  by 0.6 m (it ended at z = 85.6 for `to` [0, 85]); a landing accuracy figure would help.
- **blueprint.md Motion section** says `analyze` "flies a course (take off, circle, land on a
  15 degree slope)" and checks `hard_landing`. Neither check reported anything for my runs, so I
  cannot tell whether they ran (no `hard_landing: ok` style field). A positive line in the result
  for each check that ran would help.
- **CLI output:** `pnpm spawnforge ...` prints a three-line banner (`> spawnforge@ ...`) before
  the JSON, so the output is not parseable as JSON when piped. `pnpm -s spawnforge` works, but
  AGENTS.md and the docs show only `pnpm spawnforge`. I used `tail -n +4`.

## Errors I could not fully fix

- m06 attempt6: `limb_intersection` "hindleg.L (its middle segment) passes 2.3 cm into torso on
  flat ground". It is a walking check and invisible in flight, but I ran out of revisions. The
  flight scenario itself is clean: `takeoff` 0.375 s, `medium air`, glide from 16.0 s, `fly`
  again at 26.0 s, `land` at 43.0 s on the slope, `failed` empty. `footSlide` after landing was
  0.021 m, which is just visible.
- m04: I could not confirm the shark's depth or whether it rolls into the turn. In the top view
  it turns about 90 degrees to the left in under 2 s with no visible change in body shape beyond
  the tail wave; I cannot tell whether that is realistic for a 3.4 m shark.

## What I wished the CLI or format could do

- Scenario results with a path summary: min and max y (depth or altitude) of the body and of
  the snout, total heading change, circle count or mean radius, max bank, time spent below a
  given y. These would turn "circles", "dives to 3 m" and "turns off to one side" into numbers.
- `render --scenario --view world` with a fixed camera, a ground track and a depth/height strip.
- Chained calls (`"after": "arrive"`), a `circle` call with radius and direction, a `glide` call,
  and a `land` call that reports its approach time.
- `bite-contact` (and `lash-contact`, `pinch-contact`) carrying `target` and the snout-to-target
  `distance`, so a hit is a field rather than a threshold on `closest`.
- `start.y` for swimmers, documented, and an error or warning when `start.height` is given to a
  creature it does not apply to.
- A per-head reach direction in `reach.heads` (which head covers which side), and `reach` kept in
  `--summary`.
- `validate` hints for the traps above: a pectoral fin that will beat as a flipper, a body wide
  enough that its legs will touch it, a swimmer whose first scenario call starts at the surface.
