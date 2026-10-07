# Changelog

Versions of the packages (`@spawnforge/core`, `modules`, `three`, `cli`, `mcp`, `render`), which
move together. Nothing is published yet: the packages stay `private` until release 0.2
(milestone 12.3 of [plan 2](docs/plan-2.md)) and the owner's go-ahead, and their license is the
owner's choice (`UNLICENSED` until then). Blueprint format changes are in
[docs/blueprint.md](docs/blueprint.md#format-versions); every command reads older formats.

## Unreleased

Work in progress toward 0.2, phase by phase (see the plan's status table).

- **Anatomy (8.1):** `body.muscle` and `limbs[].muscle` are drawn: limbs fill out and taper into
  narrower joints, the torso gets a chest, hips and waist from its limbs, the neck a muscle and a
  tail a thick base, chitin legs swell between joints, serpents get a throat and a flatter belly.
  `neck.curve` bends the neck into an S. `muscle: 0` compiles to exactly the old mesh; the
  default (0.5) changes every creature's mesh and golden fingerprints. Muscle never resamples
  what it leaves alone (heads, mouths, tail tips).
- **Quality review:** each pair is shown in both orders to two reviewers, at 640 px views.
- **Feet and hands (8.2):** `foot.paw`, `foot.hoof` (single or cloven), `foot.talon`, `foot.pad`
  and `hand.grasp` (fingers and an opposed thumb) are drawn. `stance` is drawn: each foot holds
  the leg at its own height, and a planted foot with a stance rolls, heel off then toe off. Legs
  without a stance (`foot.claw`) keep their old pose and motion. Part modules get `footHeight`
  and `claws` hooks, and foot parts a `frame()` socket helper and each toe's joints.
- **Examples:** a grey wolf with paws, a tusk boar with cloven hooves and a rust raptor with
  talons; the bog troll has hands.
- **Heads (8.3):** heads are refined to their own resolution after meshing, so their details
  show on any creature. Mouths are cut exactly along the mouth line and open onto lips, gums, a
  palate and floor that darken toward the throat, and a `flat` or `forked` tongue
  (`head.lips`, `head.tongue` and `head.brow` are drawn); the corners stretch instead of tearing.
  Brows over the eyes, cheekbones and nostrils. Eyelids (`eye.basic` `lids`, `squint`) close to
  blink on bones of their own, which exported clips animate; nothing squashes the eyes any more.
  `teeth.row` stands in the gums, packed densely and sized to the head (`scale`, `fangScale`,
  `spacing`, `incisors`), and `eye.basic` sizes to the head (`scale`); written `length`,
  `fangLength`, `count` and `size` keep their old meaning. `beak` is drawn (`hooked`, `straight`,
  `broad`). Part modules get `measure` (stats read built sizes) and mouth parts `around`;
  `applyFace` and `render --jaw --blink` pose a face. Every head's mesh and the goldens change.
- **Examples:** a terror bird with a hooked beak; the examples and presets use the head-relative
  sizes.
- **Materials and patterns (8.4):** each material has its own surface and light. `skin` is soft
  (light wraps a little past the shadow edge), `hide` is thick and wrinkled (deeper in creases),
  `scales` overlap in rows down the body instead of a mosaic, and `chitin` has segmented plates
  and a lacquered clearcoat. `skin.fur` is drawn: shells in one instanced draw call at medium and
  high quality, coloured by the skin's own patterns, shorter on the face and feet and clear of
  the eyes and mouth; baked level of detail hides it. New layers: `scars`, `bioluminescence`
  (glowing spots or dotted lines that pulse), `slime`, `warts`, `veins`, `rosettes` and `bands`;
  the `scales` layer overlaps too, and `spots` are denser by default (size 0.04, density 0.75)
  and stay visible from further away. Layers can glow (`emissive`), lay a second colour
  (`under`) and shine over their own coverage (`coat`); `Pose.time` drives pulses. Exports keep
  chitin's clearcoat and note what they leave out (fur, glow). A new test checks that the GPU
  and CPU backends of the pattern kit agree. Meshes and goldens are unchanged.
- **Examples:** the grey wolf has fur, the tusk boar hide and claw scars, the bog troll hide and
  warts, and the ember beetle glowing spots.
- **Gate 8:** passed (suite A 20/20 valid and matched; suite B 20/20; the new look preferred in
  all 20 quality pairs). From its feedback:
  - Overlapping scales no longer speckle along their rims: their relief is continuous.
  - `analyze`'s `limb_intersection` advice depends on what meets (a leg in the body, a pair under
    it, or fore against hind legs) and names the segment.
  - `validate --quiet` prints the verdict without the blueprint, and `catalog.md` lists `body`'s
    own fields (`muscle`).
- **Several heads and tails (9.1):** `body.neck.count` and `spread` are drawn: necks fan across
  the chest, and each head has its own mouth, eyes, teeth and parts (a part on `head` is copied
  to every head, `horns.L1.L`; one on `head.R1` stays there). Extra heads glance a little after
  the main one, every neck bends into turns, and an action aimed at a target uses the nearest
  head, whose events name it (`head`). `body.tail.count`, `spread` and `forkAt` are drawn: tails
  leave the rear separately or fork from one trunk, and each swings as its own spring. Instance
  bones, sockets and export nodes carry the instance (`head.L1`, `mouth.L1`, `tail.R1.3`).
  `analyze` warns `head_intersection` when heads or necks meet in motion. Creatures with one head
  and one tail are unchanged.
- **Examples:** a five-headed marsh hydra, a cerberus and a two-tailed fox.
- **Eight legs and centaurs (9.2):** `tripod` runs on four leg pairs as the alternating tetrapod
  spiders use. Sprawled legs longer than 0.7 torso lengths arch their knees above the hips
  instead of standing straight; the `octopod` preset is a spider with front legs longest and
  walks without its legs meeting. A neck carrying arms is an upright front: it rises straight
  from the torso in equal bones, with shoulders and a chest (from muscle) and arms hanging from
  the chest's edge; it stays upright on slopes and twists into turns. Arms above four legs swing
  with the opposite foreleg, and a new action goal, `arms`, raises them to reach (`bite` uses
  it). `analyze` names the upright front when it tips the body forward and describes it as an
  upright torso. The `centaur` preset has a human torso, hooves and hands. Nothing else moves.
- **Examples:** a tomb spider and a grove centaur.
- **Wings, fins and membranes (9.3):** wing limbs are drawn, built spread (the bind pose) and
  resting folded: `BonesData.rest` holds the folded pose, and everything that shows or animates a
  creature (`Pose`, the Three.js bones, glTF node defaults, bounds, labels) starts from it. Wings
  fold in joint space against the body, the arms and the ground; a `wing_clearance` warning names
  one that cannot clear. `membrane.bat` stretches skin between finger bones, the body and the
  leg behind (`trailing`), carried by station bones so it stays on the surface between its spars;
  `membrane.insect` is a veined plate, stacked over the back; `membrane.case` is a hard shell
  shaped where it rests, covering the wing behind it, which folds under it; `membrane.feather`
  grows primaries, secondaries and coverts, each on a bone that folds it back along the body;
  `membrane.fin` fans rays from a fin limb. `fin.dorsal` and `fin.tail` are drawn. Membranes are
  one double-sided mesh (one draw call), lit through from behind, see-through where they are
  thin, with veins; layers of region `wings` draw on them, and fur skips wings. A new action
  goal, `wings`, spreads them over about 0.4 s (`roar` flares them; `setWings` holds a spread),
  `render --pose spread` (and MCP `pose.spread`) shows them open, and exports carry the
  membranes and fold. `analyze` warns `wing_intersection` (walking and standing spread), gives
  `measurements.wingspan` and names wings and fins. Wings get `tip.<wing>` sockets. The `fish`
  preset gains pelvic fins and membranes on its fins, so blueprints that extend it gain them too;
  the `wyvern` preset's membrane trails to the body and its legs sit further forward.
- **Examples:** an ash dragon, a cave bat, a storm wyvern, a rhino beetle with wing cases, a luna
  moth with eye spots, a reef shark and a griffin.
- **Determinism:** where two bones tie at a joint, the nearest is the first within 1e-9, so
  Node and Chrome pick the same one; the bog troll's golden changes, with no vertex moving.
  - New recipes: a flat head, forward goblin eyes, a club tail, a bushy tail, a beetle's horn,
    a tail-only colour and a rearing cobra's belly. `patch set` replacing whole objects is
    documented.
  - Masses under 100 g read in grams.
- **Tentacles, antennae, mandibles and pincers (9.4):** tentacle limbs are drawn: a chain of
  even bones leaving the skin toward the section's far end (back on the torso, forward round the
  mouth on the head), straight for `curlStart` and curling toward the belly, lying on the ground
  and curling on across it where they reach it. They sway on soft springs, and tentacles and
  antennae lie on the ground as the creature moves instead of sinking. Part modules may declare
  bones of their own through a `bones` hook (`PartChain`: points placed with `ctx.toModel`,
  radii, a `spring`, `jaw` or `grip` drive), which `build` gets as `ctx.chains`; `antenna`
  (`thread`, `club`, `feather`), `mandible` (`mandible` or `fang`, opening with the jaw) and
  `hand.pincer` (a hinged finger that the grip shuts) are drawn. New action goals: `grip`
  (negative opens wide), `nearest` (one side reaches and grips), `grab` (the two tentacles
  nearest the target bend toward it by FABRIK; `bite` sets it) and `lash` with `lashArc`. The
  `pinch` and `lash` actions are built (`pinch-contact`, `lash-contact`); `lash` joins the
  default actions of every body with a tail. Arms already held forward lift only a little when
  they reach. `suckers` is a pattern: rimmed cups in a row under each limb, on the inside of a
  tentacle's curl. `analyze` warns `tentacle_intersection`, gives `measurements.tentacleReach`,
  names tentacles, pincers, antennae and mandibles, calls a legless body with tentacles a
  tentacled creature, and measures a torso's ground contact by its half-height (a wide or
  legless torso no longer reads as sinking). Action filmstrips frame the whole creature for
  actions of the body. Creatures without these parts look and move as before, a little faster:
  springs and the pose solve do less work each step.
- **Examples:** a kraken and a dune scorpion; the luna moth gains feathery antennae and the
  tomb spider fangs, so their goldens change.
- **Tests:** the visual regression runs one test per example, so it no longer times out as
  examples are added.
- **Coverings (9.5):** the area slot is drawn: area parts cover a band of skin on both flanks
  (`ctx.surface`, `ctx.area`) and can scatter Poisson-disk points over it (`ctx.scatter`).
  `shell` (a domed slab that follows the body, with scutes, marginals and a flared rim),
  `armor.bands` (shingled bands, or staggered scales), `plates.row` (kite, round or spike plates,
  alternating and leaning out), `quills` (scattered, lying back, tipped dark), `frill`, `hood`
  (with eye marks) and `sail` are drawn. Frills, hoods, sails and groups of quills hang on bones
  of their own on a new `flare` drive; the `flare` goal opens them, `display` (faces the target,
  rears, hisses, opens everything and spreads wings; `display-peak`) is built, and
  `render --flare` (MCP `pose.flare`) shows them open. Their skins are sheets in the membrane
  mesh. A row's or area's `from` and `to` now default to its module's (they defaulted to 0 and
  1). Descriptions say which area a covering is on ("quills on its back"). `Pose.solveSubtree`
  skips bones without children. Creatures without these parts are unchanged.
- **Examples:** a stone tortoise, a plated stegosaur, a porcupine, a frilled lizard, a hooded
  cobra and a sail-back.

## 0.1.0

The proof of concept (plan 1, phases 0 to 6) and plan 2's phase 7, as buildable packages.

- **Format** `spawnforge/0.2`: everything plan 2 adds (wings, fins, tentacles, several heads and
  tails, shells, quills, fur, swimming and flying) validates now; what is not drawn yet is listed
  under `notBuilt`. `migrate` upgrades older files.
- **Pipeline:** blueprint to mesh, skeleton, TSL materials, procedural motion and actions; the
  compiled rig holds lists of heads, tails and driven chains.
- **Tools:** the `spawnforge` CLI and the MCP server (validate, analyze with scenarios, patch,
  diff, migrate, render with filmstrips and scenarios, generate, mutate, crossbreed,
  instantiate, export), headless renders, `.glb` export with baked clips.
- **Runtime:** `createBestiary` for Three.js games, with compile workers, caching, sockets, hit
  capsules, events and baked level of detail.
- **Packages** build to `dist/` (JavaScript and declarations) for publishing, with
  `publishConfig.exports`; the workspace runs the TypeScript source.
