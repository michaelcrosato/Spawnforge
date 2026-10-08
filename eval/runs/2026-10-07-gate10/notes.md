# Gate 10: notes

Phase 10 (run and gallop, jump and pounce, swimming, flight, hits and death) against the gate 10
row of plan 2's gate thresholds: suites A and B re-scored, suite M's ten motion tasks written
(`eval/prompts-m.json`) and run by two agents (five tasks each, from the docs, the examples and
the CLI only) at `c9784cf`, each task's scenario run against its checks (`node eval/motion.ts
check`), the filmstrips matched blind by a third agent, every clip baked, and the motion budgets.

## Results

| Check | Bar | Result |
| --- | --- | --- |
| Suite A, re-score | 20/20 | **20/20 valid** (`rescore-a.json`, gate 9's attempts) |
| Suite B, re-score | 20/20 | **20/20 valid**, **20/20 meet `expects`** (`rescore-b.json`) |
| Suite M, checks | ≥ 9/10 pass | **10/10** (`check-score.json`); every check of every task |
| Suite M, blind review | ≥ 8/10 matched | **10/10** (`motion/motion-score.json`), nine high confidence, one medium-high (the turtle's dive, seen from above) |
| Clips | Every clip bakes; gait clips loop without a seam | All 233 clips of the 32 examples bake, none missing; every looping clip's last frame equals its first (`clips.json`) |
| Motion, walking | ≤ 0.1 ms per creature | 0.015–0.068 ms (the ash dragon highest; `budgets.json`) |
| Motion, flying or swimming | ≤ 0.15 ms | Flying 0.037–0.081 ms (the ash dragon highest); the shark and turtle swimming 0.021 and 0.015 |
| Motion, 50 mixed | ≤ 5 ms | 2.25 ms |
| Compile, Chrome, medium | ≤ 500 ms | At most 431 ms (the hydra); skin ≤ 28.8k triangles, parts ≤ 14.7k, draw calls 3 plus fur and membranes, as at gate 9 |

The checks ran again on the final code, with the same results. The tasks' revisions: horse 2,
raptor 1, cat 4, shark 3, crocodile 2, dragon 6, moth 1, hydra 2, bear 5, turtle 1; every attempt
validated, and the revisions came from renders and `analyze`'s warnings. The dragon's last attempt
still warns `limb_intersection` (2.3 cm, a walking check its flight never shows): its agent ran
out of revisions chasing one pair after another, which the fix below answers.

## Budgets

The first budget run went over: the ash dragon walking at 0.102 ms, with the griffin at 0.101 in
an earlier run, though both measure 0.06–0.07 alone. That container was slower than gate 9's:
gate 9's own commit (`a55560b`), measured there, compiled the hydra in 496 ms (437 at gate 9) and
put the luna moth at 0.124 ms a frame, the two-tailed fox at 0.112 and the kraken at 0.107, with
50 walking at 4.73 ms. Phase 10 had added its own cost too, so for the gate:

- Leg IK's bisection measured its reach through a helper that built two arrays each call, 24
  times per leg per step; it now walks the chain in place, with the same numbers bit for bit.
- A legless body sampled the ground under every joint every frame (27 calls a frame for the reed
  viper); the trail it follows was laid on the ground, so joints on it take its height, and only
  those past its end sample.
- Spring floors (tentacles, antennae, and tails in the air) follow the ground's slope from where
  they sampled it, and sample again after three floor steps instead of one: the kraken's 18
  ground calls a frame fell to 6.
- Springs re-solved the bones they hang from each step, but the last pose left them solved:
  with and without it every example's pose came out the same bit for bit, through walking,
  flight, an action, a stagger and a death, so it is gone.
- `Pose.solveSubtree` remembers each bone's descendants instead of walking up from every later
  bone.
- `pnpm budgets` times motion after Chromium closes (with its processes still running, the same
  code timed the griffin at 0.087–0.105 ms, against 0.062–0.07 alone), and keeps one compiled
  creature per example instead of five, so the timing does not run over a heap of 160.

Measured on one machine, motion now costs a third less (the 32 examples' walking times sum to
1.05 ms, from 1.57 at `c9784cf`; 50 at once 2.1 ms, from 2.9). Legged bodies move exactly as
before; snakes and tails in the air within 0.05 mm, and a kraken's tentacles on rough ground
within 1 cm, where they lie on slopes followed between samples. Goldens are unchanged (the
compile pipeline is untouched; IK gives the same numbers), and every test passes. `budgets.json`
is the final run, after the container restarted on another host; every figure is within budget
with room to spare.

## Fixes made for the gate

The dry run, before the agents: the hydra's `bite-contact` came back without its head, so scenario
events keep `head` and `bone`; results give `topSpeed`; and a boar did not stagger even at full
strength, so the blow's push grows as `(0.4 s + 0.6 s²) · √(g · hip)`: 1 staggers nearly anything.

## Feedback, and where it goes

Two agents and a blind reviewer (`feedback-a.md`, `feedback-b.md`, `motion/review-notes.md`). No
agent met a validation error; both said the hardest part was seeing heights, depths and turns in
filmstrips that follow the creature, and chasing `limb_intersection` warnings one pair at a time.

| Feedback | Where it goes |
| --- | --- |
| `limb_intersection` names one pair at a time, its splay under-promises, and flat and rough ground warn differently (both agents; said at gate 9 too) | Fixed: every pair that meets is listed at once, each where it was deepest and mirror pairs once, and the splay is sized by where on the leg they meet (the bear's foreleg, 10 cm into its torso, clears with the 25° it now asks for). A hind leg in the belly still clears slowly with splay: later, a fix that knows the stride |
| Scenario results have no height or depth (agents used targets as altimeters) and no turn | Fixed: `body` (its middle's lowest, highest and highest above the ground) and `turned` |
| `arrive` events do not say which `moveTo` they end | Fixed: they carry the position |
| A `gait` call fires no `gait` event; entering the water fires two at once | Fixed: one event, and a forced gait fires one |
| `footSlide` counts a stagger's steps and a death's legs (0.73 m for the wolf in `hit-and-die`) | Fixed: left out (0 there now) |
| A swimmer cannot start at a depth; `start.height` does nothing for it | Fixed: `start.y` (and `place`'s `y` for swimmers) |
| `--summary` drops `reach`; `reach.bite` is unexplained and the same for every head | Fixed: kept and explained, and each head says which side it is on |
| Descriptions call a countershade on the limbs a "black belly" and eye spots on the wings "rosettes" | Fixed: a layer on one region says where ("spots on the wings"), and a countershade there is an underside |
| How hard a blow must be to stagger, and which way it pushes | Documented, measured per build: bipeds and narrow bodies from 0.35–0.45, a wolf 0.5, a bear or a boar about 0.8, a tortoise only at 1, a spider never |
| `moveTo` reaches its speed in half a second; a slow crocodile's pace | Documented; later, an acceleration setting |
| `fly`'s height (which point, the default); `stop` while flying; scenario filmstrips' default views | Documented in `scenarios.md` |
| `pnpm spawnforge` prints a banner before the JSON | Documented: `pnpm -s spawnforge` |
| No recipes for a horse, a big cat or a bear; long pectorals beat as flippers; a `round` shark reads as a plank; the crocodile's legs overstretch | Added to `blueprint.md` from the agents' working values |
| Filmstrips follow the creature: no fixed camera, targets out of frame, no ruler for height or depth (both agents and the reviewer) | Later: a world camera and a height strip for scenario renders |
| A short pounce lands without a warning; no leap summary | Later: a `pounce_short` note |
| Chained calls (`after: "arrive"`), a `circle` call with a radius, a `glide` call, a landing's approach time | Later |
| `bite-contact` with its target and distance; a `hit` event's direction and an arrow in the frame | Later |
| Per-temperament posture numbers in the catalogue; `validate` hints for flipper fins, broad bodies and swimmers at the surface; a positive line for checks that ran; `render --quiet`; a moth with `jump` | Later |
| Reviewer: the shark swims on its side after its turn | Not a bug: its roll is 10° in the turn and 0.0° after it; from above, a shark crossing the frame shows its fins that way |
| Reviewer: a bear's stagger reads as a flinch; dead legs end in dark discs (the soles end-on) | Later: a quality round on deaths |
| Reviewer: the raptor runs in a deep crouch; stiff tails and manes, little head bob; the cat freezes after landing; the moth's hover wobbles; the hydra's heads settle from their rest pose in the first 0.4 s; the dragon's folded wing sticks back past its tail; a crocodile's shadow falls through the water | Later: a motion quality round before release 0.2 |

## Protocol notes

- Each agent worked in its own scratch folder and saved attempts and scenarios here; neither saw
  the other's files. The reviewer saw only `motion/review.md` and the ten filmstrips.
- The re-scores validate gate 9's saved attempts at the gate 10 code without a new agent run.
