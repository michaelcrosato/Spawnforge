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
- **Variation for format 0.2 (9.6):** genes cover the new fields: part `count`s and `forkAt`
  drift again (since 7.3 every field named `count` was held still). Mutation never changes how
  many heads, tails or limbs a creature has; its structural changes now include the feet of one
  role at a time (to feet that stand a leg, or hands to hands), skip membranes, add fins only to
  swimmers, and move a swapped part to where its new module sits. Crossbreeding takes each
  section's head and tail count (with `spread` and `forkAt`) whole from one parent, and pairs
  wings, fins and tentacles one to one by role, the child's count of each coming from one
  parent, so a wolf can grow a griffin's wings; limbs it gains that do not fit are dropped.
  Themes `dragon`, `aquatic`, `eldritch` and `beast`; themes may add optional limb sets
  (`bias.limbs`, which may change a limb by id, such as hooves for paws) and skin fields
  (`bias.skin`, such as fur), and their shapes may set `motion.media`. `generate --requires
  air,water` (MCP `constraints.requires`) asks for media: air only from a theme with wings,
  water from a swimmer or by turning swimming on. `rpg` gains `attacks` (one per head; `attack`
  is one head's hit) and defence from shells, plates and bands of armour (and `hide`), and stats
  inputs say which head each part sits on. `scripts/theme-sheet.ts` draws a theme across seeds.
  The variation eval gains four tasks (v09–v12) and passed 12/12. From its feedback: mutation
  never flips a switch (`head.jaw` is no longer a gene at all) or drifts the skin's material;
  packs name lineage tags (`bird`, `insect`, `snake`) and habitat tags (`aquatic`) in their
  defaults, so a snake never sprouts a beak; `bodyHeight` leaves out wings and fins (it counted
  the spread wing bones); `analyze` reports `measurements.counts`; the insect theme's pincers are
  mandibles.
- **Gate 9:** passed (suite A 20/20 valid and matched; suite B 20/20 valid, meeting `expects` and
  matched; variation 12/12; budgets met). For the budgets, `teeth.row` builds coarser teeth on
  creatures with several heads (`ctx.copies` tells a mouth part how many copies there are), and
  eyelids find their eye's vertices through a sorted search; the hydra's and cerberus's meshes and
  goldens change. From its feedback:
  - `analyze` puts its warnings and description first, and `--summary` (MCP `summary`) keeps
    only them with the main sizes and speeds.
  - `unbalanced` says which way the body tips, and its fix follows from that.
  - `patch --out` (MCP `out`) writes the result elsewhere; `<command> --help` prints one
    command's usage; a missing file's error says where relative paths are read from.
  - A render whose page fails to load closes its browser instead of hanging, and Chromium runs
    without background network traffic.
  - Descriptions call a horn on the jaw a tusk and one on the tail a stinger (part `describe`
    hooks get `on`).
  - Recipes and tips for armour bands, eyes on stalks, moths, tusks on flat heads, fish, fliers'
    sizes, layer order and near-black creatures.
- **Gaits that change with speed (10.1):** `run` (bipeds), `gallop` (transverse or rotary, with
  a lead foreleg, the back flexing each stride) and `bound` (small four-legged bodies) are built.
  Gait modules may give each leg's footfall (`offsets`), duty as a profile over the gait's speed
  range, a natural speed, a hip-height range, postures and spine flexion. Blueprints may give a
  gait's `duty` and `stride` as `[slowest, fastest]`. Gaits with flight lift the body on a
  ballistic arc while every foot is off the ground, run 12% lower for a longer stance, and go to
  the top of their Froude range: a horse gallops at 12 m/s, a raptor runs at 8.5. A gait change
  keeps the phase and eases each leg into the new footfalls over a stride or two (plan 1 snapped
  them). `analyze` runs every gait at its natural speed, checking feet and ground there; limb
  clearance stays judged at the walking pace. Plan 1's gaits keep their numbers.
- **Examples:** a wild horse (transverse gallop) and a sand cheetah (rotary gallop); the rust
  raptor and terror bird run instead of walking fast.
- **Jump and pounce (10.2):** actions may carry the body through the air: a `leap` hook says
  how long to crouch and recover, the launch angle, the reach and any height to clear, and the
  controller plans a ballistic arc to the target over the game's ground (steepening it to clear
  rough ground or a hurdle), flies it with the legs tucked and lands with every foot planted.
  `jump` (`power`, `crouch`, `height`) and `pounce` (lands with its head at the target and bites
  as it lands) are built and fire `takeoff` and `land`. Leaping clips keep their root track
  (`rootMotion` in the clip and the export's extras); runtime.md says how to apply or strip it.
  `testCourse` with no flat start no longer returns NaN at the origin.
- **Swimming (10.3):** `update(dt, { ground, water })` takes the water (`water(x, z)` gives its
  surface or `null`), and creatures with swimming gaits take to it where it is deeper than about
  their hip height (a `medium` event each way, and a `gait` event). `swim.undulate`,
  `swim.paddle` and `swim.flap` are built: a body wave into the tail at a Strouhal number of 0.3,
  legs paddling under the hips, long fins beating as flippers. Walkers and paddlers float with
  their heads out; divers hold a depth or go to a height `moveTo` gives, never into the bed; a
  body that only swims stops at the shore. In water a creature's pace is its swimming pace.
  `analyze` checks swimmers in the water (`head_underwater`, `hits_bed`), gives `speed.swim` and
  says how it swims; `rpg` gains `swim`. Scenarios take `"water"` (`"sea"` or a lake),
  filmstrips of swimming gaits are drawn in open water, swimming cycles are baked in it, and the
  runtime takes `water` in `update` and `spawn`. `withLake` and `openSea` make water for tests,
  and the sandbox's course has a lake. Swimming is no longer listed under `notBuilt`.
- **Examples:** a river crocodile and a sea turtle; the reed viper and the kraken swim too.
- **Flight (10.4):** `fly`, `glide` and `hover` are built. A winged creature flies when asked
  (`fly()`, a scenario's `fly`, a `moveTo` higher than it could reach on foot, `spawn({ flying,
  height })`): it crouches and leaps into a climb, cruises at a speed from its wing loading,
  holds its height over the ground ahead and under its wingtips, banks into turns, glides
  between flaps, circles (or, with insect wings, hovers) with nowhere to go, and `land()`s with a
  flare onto any slope, wings raised as its feet reach down (hoverers come straight down). Wings
  beat at a rate from Pennycuick's fit, strokes compiled into each wing from its membrane:
  leathery and feathered wings flex on the upstroke, insect wings stroke steeper with the hind
  wing just behind, cases lift. Events `takeoff`, `land`, `flap` and `medium` `air`; the
  controller gains `flying`, `flightStage`, `wingbeat`, `attitude` and `poseBeat`, and
  `update(dt, { pose: false })` for level of detail. `analyze` gives `speed.fly` and
  `speed.slow`, warns `cannot_fly` over 700 N/m², and flies a course (take off, circle, land on a
  15° slope) with `wing_intersection` while flying and `hard_landing`; `rpg` gains `fly`. Air
  cycles bake over whole wingbeats at exact phases (`air.pitch` in the clip and the export), and
  flyers get `takeoff` and `land` clips with root motion. The runtime's `Creature` gains `fly`,
  `land` and `flying`; distant flyers keep flying on baked cycles, tilted to their bank. Scenarios
  take a slope (`{ "slope", "toward", "from" }`), `fly` and `land` calls, `start.flying` and run
  up to 120 s; filmstrips frame the spread wings in the air. Gait modules declare their role in
  the air (`air`: `flapping`, `gliding`, `hovering`). Flight is no longer listed under
  `notBuilt`; nothing is.
- **Examples:** the griffin's wings are longer, to fly; the rhino beetle, too heavy for its wings,
  is grounded (`"media": { "air": false }`); `scenarios/flight-course.json`.
- **Hits and death (10.5):** `hit({ direction, bone, strength })` flinches the spine and neck (a
  blow to the head snaps it) and, when the blow would carry the body past its feet, staggers it:
  it slides and steps quickly to catch itself (`hit`, `stagger` events). `die({ direction })`
  collapses any creature onto the game's ground without a physics engine: legs buckle, four-legged
  bodies, birds and raptors topple onto the side away from the blow, upright bipeds fall along it,
  sprawlers sink, snakes go limp, necks droop until the heads rest on the ground, tails and
  tentacles flop onto it, wings fold, eyes close (`death` event); killed in the air it falls, in
  water it sinks to the bed. Each bone's support hull (64 extreme points of what it carries) keeps
  every example within 3% of its size of the ground, on flat and rough ground, from either side.
  `dead` and `dying`; the dead ignore movement and actions until `place`. A `death` clip for every
  creature; the runtime's `Creature` gains `hit`, `die`, `dead` and `dying`, keeps dying creatures
  at full detail and corpses lying at any distance. Scenarios take `hit` and `die` calls. The
  sandbox has hit and die buttons.
- **Examples:** `scenarios/hit-and-die.json`.
- **Gate 10:** passed (suites A and B re-scored 20/20; suite M's ten motion tasks 10/10 meet their
  checks and 10/10 filmstrips matched blind; all 233 clips of the 32 examples bake, and gait clips
  loop without a seam; motion budgets met). Suite M is `eval/prompts-m.json`, checked by
  `node eval/motion.ts check`. A blow's push grows with the square of its strength, so 1 staggers
  nearly anything. For the budgets: leg IK searches without allocating, legless bodies take their
  height from the trail they laid, spring floors follow the ground's slope and sample it a third as
  often, springs no longer re-solve the pose they hang from (it is already solved), and
  `Pose.solveSubtree` remembers each bone's descendants. Motion costs a third less (50 creatures
  2.9 to 2.1 ms on one machine); legged bodies move exactly as before, snakes and flying tails
  within 0.05 mm, a kraken's tentacles on rough ground within 1 cm. `pnpm budgets` times motion
  after Chromium closes and keeps one compiled creature per example. From its feedback:
  - Scenario results give `topSpeed`, `body` (its lowest, highest and highest above the ground)
    and `turned`; events keep `head` and `bone`, and `arrive` says where; a `gait` call fires a
    `gait` event, and entering the water fires one, not two; `footSlide` leaves out staggers and
    dying; `start.y` starts a swimmer at a depth (`place` takes `y` for swimmers too).
    `MotionController.staggering`.
  - `analyze` lists every pair of limbs that meet at once, each where it was deepest, with the
    splay sized by where on the leg they meet; `--summary` keeps `reach`, and each head says which
    side it is on.
  - Descriptions say where a layer shows ("spots on the tail"), and a countershade on one region
    is an underside, not a belly (pattern `describe` hooks get the `region`).
  - Docs: what a blow's strength does to each build, `fly`'s height, the views scenario
    filmstrips use, `pnpm -s` for JSON, recipes for a horse, a big cat and a bear, and the shark's
    and crocodile's recipes fixed.
- **Texture maps (11.1):** exports carry texture maps baked from the live material: a new
  package, `@spawnforge/bake`, unwraps skin, parts, eyes and membranes into one atlas each with
  xatlas (`watlas`, WASM) and runs the pattern stack per texel through the CPU kit, on Web
  Workers in the render page and the sandbox. The skin gets colour, a normal map from its relief
  against MikkTSpace-compatible tangents (meshoptimizer), occlusion from its distance field and
  roughness in one map, and emissive for glow (above 1 through
  `KHR_materials_emissive_strength`); chitin's clearcoat is perturbed by the same normal map;
  membranes bake their veins and their light-through into colour, opacity and emissive. Maps
  are 512, 1024 or 2048 texels by quality; `export --textures <size>` sets the size and
  `--textures none` keeps vertex colours (the MCP `export` tool takes `textures` too). What glTF
  cannot carry is listed in the notes and in `docs/runtime.md`: fur shells (the skin's maps take
  the coat's colour; the extras keep `fur`), the glow's pulse (the extras give each layer's
  `pulse`), the light wrapping round soft skin, and breathing. The live creature can show the
  export's simplifications (`SkinLook`: the coat look, no wrap, a fixed pixel size). Bone and
  clip rotations are normalized, so every export passes the Khronos glTF validator.
  `compileCreature(…, { field: true })` keeps the skin's distance field; `Surface.reliefPixel`
  fades relief apart from colour.
- **Round trip:** `pnpm roundtrip` exports each example with its maps, loads it back with
  `GLTFLoader` and renders it beside the live creature from the contact sheet's views, the open
  mouth and the spread wings, with its tangents and without them; three probe creatures score
  relief, roughness and glow on their own, and the round trip is checked to fail for broken
  bakes. `Renderer.roundTrip`, `roundTripVerdict` and `ROUND_TRIP_BARS` in `@spawnforge/render`.
  The render page frees each shot's shadow map and each loaded file, which a full run ran out
  of memory without.
- **Export eval:** four texture tasks (x05–x08): the sharpest maps, vertex colours only, a
  pulsing glow read back from the file, and what a furred creature's export leaves out.
- **Levels of detail (11.2):** `@spawnforge/bake/lod` simplifies the skin and the hard parts
  with meshoptimizer into levels of 50, 25 and 10% of their triangles, over the same vertices
  (weights, normals, UVs and seams untouched). Live, `bestiary.update(dt, { camera, pixels })`
  draws each creature at the coarsest level whose error projects under one pixel
  (`creature.detail`, `lods: false` to keep every triangle); the levels are made once per
  species and shared, and fur follows the skin. Exports carry `skin_LOD1` to `skin_LOD3` and
  `parts_LOD1` to `parts_LOD3`, listed by `MSFT_lod` with screen coverages and kept out of the
  scene's tree, and the extras' `lods` give each level's triangles and error; `export --lods
  none` (MCP `lods: false`) leaves them out. Core gains `pickLevel`, `projectedError` and
  `screenCoverage`.
- **Crowds (11.3):** `createBestiary({ crowds: true })` draws distant creatures (at the baked
  level of detail) through `bestiary.crowd`: one instanced draw per species, mesh level and
  material, skinned on the GPU from the baked clips' bone matrices in a float texture
  (`clipRows`, `CrowdDraw`, `crowdPosition`), each member with its own clip, frame, position
  and heading. Members skip posing their bones; sockets and hit capsules pose them when read.
  On a frame a member is posed exactly as by its own skeleton (a Node test against three's
  skinning, and a render test comparing pixels); between frames within a few millimetres.
  `createRenderer` takes `trackTimestamp`.
- **Bench (11.3):** `pnpm bench` runs 50 creatures near the camera, 500 distant and 500 as
  crowds, and reports frame and update times, GPU time where timestamps exist, draw calls and
  triangles as JSON (`Renderer.bench`); `--open` serves the page for a browser on real hardware,
  and CI keeps a small headless run as an artifact. The owner's laptop numbers are awaited
  (`docs/poc.md`).
- **Engine guides (11.4):** `docs/engines.md` goes through Godot 4, Unity 6, Unreal 5 and
  Blender: what each importer makes of the file, looping, speed and root motion, sockets, levels
  of detail, and the live-only effects. `engines/` has a script per engine that reads the
  extras from the file (GDScript, C#, and Python for Unreal or anything else), and Blender's
  import check; CI imports an export into Blender (`bpy`) and reads it with the Python script.
- **Gate 11:** passed (suites A and B re-scored 20/20; the export eval 11/11, with three new tasks:
  levels of detail, root motion and engine notes; the round trip 32/32 and the validator clean;
  the smoke test passing; the bench pending the owner's laptop). From the export eval's feedback:
  textured exports' notes name breathing and texel-sized detail too; a missing clip's error says
  where to add its action or gait; runtime.md documents the JPEG colour maps of big files, when a
  level of detail is under a pixel, `MSFT_screencoverage`, and the units of `fur.length`,
  `glow[].pulse` and a leap's `distance`; blueprint.md no longer says glow stays out of exports.

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
