# Blueprint format

A blueprint is a short JSON document that says what a monster is, in body-relative terms. A
blueprint plus its `seed` always produces the same creature. This guide explains every concept;
[catalog.md](catalog.md) lists every field and module with exact ranges and defaults, and
[blueprint.schema.json](blueprint.schema.json) is the JSON Schema.

## Quick start

```json
{
  "format": "spawnforge/0.2",
  "name": "Ash Hound",
  "seed": 12,
  "extends": "quadruped",
  "scale": 1.1,
  "body": { "head": { "shape": "snout", "length": 0.34 }, "tail": { "length": 0.5 } },
  "parts": [
    { "id": "horns", "type": "horn.curved", "attach": { "on": "head", "at": 0.8, "angle": 35 }, "params": { "length": 0.18, "curve": 80 } },
    { "id": "teeth", "type": "teeth.row", "params": { "fangs": 2 } }
  ],
  "skin": {
    "palette": { "base": "#4a4440", "belly": "#9a9088", "accent": "#e0502a" },
    "layers": [{ "type": "countershade" }, { "type": "stripes", "count": 9, "region": "back" }]
  },
  "motion": { "temperament": "aggressive", "actions": ["bite", "roar"] }
}
```

The workflow is always the same:

1. Pick the body plan closest to the idea and `extends` it. See `list_modules` with kind
   `bodyPlan`, or the catalogue.
2. Change only what differs: proportions, extra limbs, parts, skin and motion.
3. Run `validate` (the MCP tool, or `spawnforge validate file.json`). Fix every error using its
   `fix`, then validate again until `ok` is true. Read the warnings too.

Format 0.2 holds everything plan 2 adds (wings, fins, tentacles, several heads and tails,
shells, quills, fur, swimming and flying, …), and all of it is drawn and moves. A pack can still
declare a module before it is built: `validate` lists such features under `notBuilt`, with the
milestone that builds it. **Keep those features**; they appear once built. In the
[catalogue](catalog.md) a milestone in brackets marks a module that is not drawn yet.

## Units and directions

- **`scale` is the torso length in metres.** Every other length and radius in the blueprint is a
  multiple of it, so a `"length": 0.5` leg on a `"scale": 2` creature is 1 m long. Resize a whole
  monster by changing `scale`.
- **Sizing.** With the presets' proportions, an upright biped stands about 2.5 × `scale` tall (a
  2 m giant is `scale` 0.8), a quadruped is about 2.2 × `scale` from snout to tail tip and 0.75 ×
  `scale` tall (a wolf is about 0.7), a hexapod is about 1.3 × `scale` long, and a serpent about
  3.5 × `scale`. Wings span far more than the body: about 6–7 × `scale` for a bat or a dragon
  with wings of `length` 1.5–1.9 (a 4.8 m bat is `scale` 0.7), so size a flier by its span
  (`analyze` gives `measurements.wingspan`). A fish is about 2 × `scale` long (a 1.8 m reef
  shark is `scale` 0.9), a centaur
  1.7 × `scale` long and 1.6 × `scale` tall to the top of its head, a wyvern 3.2 × `scale` from
  snout to tail tip, and an octopod 1.5 × `scale` long and 1.75 × `scale` across its legs. Longer
  legs, necks and tails change these, so check the size line on a render or with `analyze`.
- **Angles are degrees.**
- **The creature faces +Z with Y up** (glTF conventions). Its left side is +X.
- **Profiles.** Any `radius` (and a spike row's `height`) is either one number, or a list of up to
  16 numbers spread evenly along the section and smoothly interpolated: `"radius": [0.1, 0.18, 0.12]`
  is thin at the start, thickest in the middle and medium at the end.

## The body

Four sections make the main axis, from snout to tail: `head`, `neck`, `torso`, `tail`.

| Section | `at` = 0 | `at` = 1 | Notes |
| --- | --- | --- | --- |
| `head` | snout tip | back of the skull | `shape`: round, snout, flat or wedge. `jaw: true` adds a hinged lower jaw (needed for teeth, bite and roar). |
| `jaw` | jaw tip | hinge | Exists only when `head.jaw` is true. |
| `neck` | head end | torso end | `length: 0` removes the neck. |
| `torso` | neck end (front) | tail end (back) | Its length is `scale`. `pitch` tilts it up: 0 is horizontal, about 75–85 for an upright biped. |
| `tail` | root | tip | `length: 0` removes the tail. `curl` bends it along its length. |
| `spine` | head end of the neck | tail tip | Not a real section: a path through neck, torso and tail for rows "along the whole back", by length (see below). |

Fractions along `spine` follow the length of the neck, torso and tail in turn, so where the
torso falls depends on them: with a neck 0.3 and a tail 1.2 long (in torso lengths), the torso
runs from 0.3/2.5 = 0.12 to 1.3/2.5 = 0.52. For a row over the torso alone, put it `on` "torso".

`pitch` on the neck, head and tail is measured from horizontal, whatever the torso does: a neck
with `"pitch": 30` rises at 30°, and a head with `"pitch": 0` looks straight ahead. On an upright
biped, give the neck a pitch near the torso's (about 80) and keep the head near 0.

`crossSection` (on the torso, neck, head and tail) makes a section `round`, `tall` (narrow and
deep, like a fish) or `wide` (flat and broad, like a beetle or a cobra's hood).

**Tails.** The tail leaves the torso at `pitch`, then bends upward by `curl` degrees in total,
spread evenly along it; negative `curl` bends down. `curlStart` keeps the first part straight:
`"curlStart": 0.6` curls only the last 40%. A scorpion tail arching over the back is about
`"length": 2.4, "pitch": 40, "curl": 200` on a hexapod's short torso (tails are measured in
torso lengths, so a short body needs a long tail); a tail curled at the tip is
`"curl": 160, "curlStart": 0.6`.

**Several heads and tails.** `"neck": { "count": 3 }` gives three necks, each with a head shaped
like `body.head` (same jaw, same parts): a hydra or a cerberus. They fan out over `spread` degrees
(left out, 25° per extra neck) from roots across the chest; give them `length` enough to keep the
heads apart (`validate` warns `heads_overlap` with the spread that clears it). The middle head is
the main one and keeps the plain names (`head`, `jaw`); the others are `head.L1`, `head.R1`, …
from it outward (with an even count the extra one is on the right: four heads are `head.L1`,
`head`, `head.R1`, `head.R2`), so `"on": "head.R1"` puts a part on that head only, while `"on": "head"` gives
every head a copy (`horns.L1.L` is the left horn on `head.L1`). Each head has its own mouth,
eyes and teeth, looks about on its own, and the one nearest a target bites (its events name it
in `head`); `analyze` warns `head_intersection` when heads or necks hit each other in motion,
with the spread or length that clears it. Big heads need room: three wolf-sized heads want about
`spread` 90 and `length` 0.45. `"tail": { "count": 2 }` gives two tails (`spread`, 20° per extra
tail), each swinging on its own; `"forkAt": 0.7` makes one tail fork 70% of the way along
instead of the tails leaving the torso separately, and a part that sits wholly on the trunk
before the fork is placed once.

**Neck shape, muscle and head details.** `neck.curve` (degrees) bends the neck into an S: forward
at the base and back up below the head, like a swan or a rearing cobra (a C on necks of fewer than
3 segments). `body.muscle` (0 to 1, default 0.5) sets how muscled the body is, and
`limbs[].muscle` overrides it per limb: thighs and upper arms fill out, calves and forearms
less, and each tapers into a narrower knee, elbow, ankle or wrist (stocky legs stay columns); the
torso gets a chest, hips and (unless it stands upright) a waist from the limbs on it, the neck a
muscle into the shoulders and a tail a thick base. Chitin limbs swell between their joints instead, and
legless bodies get a flatter belly and a throat behind the head. `0` gives smooth tubes, `1` a
heavily built body.

**Heads.** Every head with a jaw has a mouth that opens: lips along the cut, gums, a palate,
a floor, a tongue and a throat that darkens toward the back. `head.lips` (0–1, default 0.3) sets
how full the lips are (0 for a snake's or a bird's), `head.tongue` is `flat` (the default),
`forked` (snakes and lizards) or `none`, and `head.brow` (0–1, default 0.2) raises a ridge over
each eye (heavy for a troll, 0.5–0.8; none for a snake). Nostrils and cheekbones come with every
head. Heads are meshed finer than the body, so these show at any size.

**Upright fronts (centaurs).** Arms on the neck make it a second, upright torso: it rises
nearly straight up from the front of the body, its `radius` profile reads as a person's from the
neck under the head (`at` 0) down through the shoulders and chest to the waist (`at` 1), and the
arms hang from the edge of the chest where they attach, with shoulders and a chest from
`body.muscle`. Put the arms at `at` about 0.3 with `angle` 90, give the neck `pitch` 80–90, a
`wide` cross-section and a profile thin at the start (the neck), widest at the shoulders and
narrower at the waist: the `centaur` preset's is `[0.042, 0.045, 0.07, 0.135, 0.14, 0.125, 0.105,
0.1, 0.11, 0.125]` over a length of 0.72. The front stays upright as the body climbs, its arms
swing with the forelegs, and `analyze` warns `unbalanced` if it tips the body forward.

**Upright and horizontal bodies.** Legs attach along the torso with `at`, so when you change the
torso's `pitch`, move the legs with it. On an upright biped (pitch 70–85) legs sit at the back end
(`at` 0.9). On a horizontal biped such as a raptor (pitch 5–20, with a tail as counterweight), put
the legs near the middle (`at` about 0.6) so the body balances over the hips, and arms near the
front (`at` about 0.1).

## Attaching things

Limbs and parts attach by name, never by coordinates.

- **`on`** names what to attach to: a body section (`torso`, `neck`, `head`, `jaw`, `tail`), a
  limb id, or another part's id.
- **`at`** (0 to 1) says where along it, using the table above. On limbs and parts it runs from
  root (0) to tip (1).
- **`angle`** says where around it: 0 is the top (dorsal midline), 90 is the side, 180 is the belly
  (ventral midline). On a limb, 0 is the limb's front face.
- **`side`** is `both` (a mirrored pair), `left`, `right` or `center`. It defaults to `both`,
  except that angles of exactly 0 and 180 default to `center`, so a spine row is never doubled.
- **Rows** of parts (`spikes.row`) use **`from`** and **`to`** instead of `at`.

Examples: eyes on the sides of the head are `{ "on": "head", "at": 0.35, "angle": 60 }`; horns on
the top of the skull are `{ "on": "head", "at": 0.8, "angle": 30 }`; a single nose horn is
`{ "on": "head", "at": 0.1, "angle": 0 }`; spikes down the back are
`{ "on": "torso", "from": 0.1, "to": 0.9, "angle": 0 }`.

## Mirroring and ids

Every limb and part has an `id`: lowercase letters, digits, `-` or `_`, starting with a letter,
and unique across limbs and parts. A pair made by `side: "both"` becomes two items whose ids end
in `.L` (left, +X) and `.R` (right). A part attached to a mirrored limb (`"on": "foreleg"`) gets
one copy per side; attach to one side only with `"on": "foreleg.L"`.

Errors and edits address items by id, as in `limbs[id=hindleg].attach.at`, so merging and
mirroring never change what a path points at.

## Presets and editing them

`extends` starts from a body plan: `biped`, `quadruped`, `hexapod`, `serpent`, `octopod` (eight
legs: spiders, scorpions), `centaur` (a horse-like body with an upright, torso-like neck carrying
arms), `wyvern` (two legs, wings for forelimbs) or `fish` (fins, lives in water).
`describe_module` (or the catalogue) shows each preset with the ids you can edit. The blueprint is
merged on top of the preset:

- Objects merge field by field: `"body": { "tail": { "length": 1.2 } }` changes only the tail length.
- `limbs` and `parts` merge **by id**: an item whose id matches a preset item changes only the
  fields it gives; a new id adds an item; `{ "id": "eyes", "remove": true }` deletes an inherited
  one.
- Every other list (profiles, `layers`, `gaits`, `actions`) replaces the inherited list.
- An item or object that changes `type` (a foot, a membrane, a part) or a limb that changes `role`
  replaces the inherited one instead of merging into it, so `{ "id": "foreleg", "foot": "foot.hoof" }`
  does not inherit the claw's `toes`, and `{ "id": "arm", "role": "wing" }` is a fresh wing.

So to make a quadruped's back legs longer, write only
`"limbs": [{ "id": "hindleg", "length": 0.8 }]`.

Without `extends`, a blueprint starts from defaults: a bare torso, neck, head and tail with no
limbs.

## Limbs

Every limb has a `role`, which decides how it moves and which fields it takes; each role has its
own defaults, so `{ "id": "wing", "role": "wing" }` is already a usable wing. Every limb has a total
`length`, `segments` (bones from root to tip), a `radius` profile from root to tip and an `attach`.

| Role | What it does | Its own fields | Defaults |
| --- | --- | --- | --- |
| `leg` (the default) | Carries the body; legs come in mirrored pairs, up to 6 | `splay`, `lift`, `stance`, `foot` | `at` 0.5, `angle` 100, `length` 0.5, 3 segments, `foot.claw` |
| `arm` | Hangs free for grabbing and striking | `splay`, `lift`, `foot` | as a leg |
| `wing` | Rests folded, spreads when asked or to fly | `membrane`, `foot` (a thumb at the wrist) | `at` 0.2, `angle` 40, `length` 1.2, `membrane.bat` |
| `fin` | Holds out flat; long ones (`length` 0.4 or more) beat as flippers when it swims | `membrane` | `at` 0.25, `angle` 115, `length` 0.35, 2 segments, `membrane.fin` |
| `tentacle` | A long spring chain that curls, sways and reaches | `curl`, `curlStart`, up to 16 `segments` | `at` 0.9, `angle` 150, `length` 1.5, 10 segments |

- **Legs come in mirrored pairs** (`side: "both"`), up to 6 pairs. Legs are ordered from the back;
  where they attach (`at`) decides the order. Only legs carry the body.
- **`splay`** swings a leg or arm out from under the body: 0 for upright walkers (dogs, horses),
  around 50–60 for sprawlers (insects, lizards).
- **`angle`** on a limb's `attach` is where around the section it starts; 100 is just below the
  side. Limbs attach to the torso, a neck or the tail; tentacles also to the head.
- **Feet and hands** go in `foot`, whatever the limb: `"foot": { "type": "foot.claw", "toes": 3 }`
  puts toes with claws on the tip (parameters sit beside `type`), and the bare id works too:
  `"foot": "foot.hoof"`. Feet: `foot.claw`, `foot.hoof` (single or cloven), `foot.paw`,
  `foot.talon` (bird-like), `foot.pad` (column feet); hands: `hand.grasp`, `hand.pincer`.
  `"foot": null` ends the limb in a stump. Each foot stands the leg at its own height: a paw on
  its toes, a hoof on its tip, a column foot low. `hand.grasp` on an arm has four fingers and an
  opposed thumb (`fingers`, `fingerLength`, and `claws` 0 for nails). `hand.pincer` is a crab's
  or scorpion's claw: a swollen palm and two fingers, the upper one hinged on a bone of its own,
  which `pinch` snaps shut (`size` in torso lengths, `width`, `teeth`). Hold the arms forward
  with `lift` 70–85 for a scorpion.
- **`stance`** (legs): `plantigrade` (on the whole sole, like a bear), `digitigrade` (on the toes,
  like a dog) or `unguligrade` (on hoof tips, like a horse). Left out, the foot suggests one
  (`foot.paw` and `foot.talon` digitigrade, `foot.hoof` unguligrade, `foot.pad` plantigrade;
  `foot.claw` none). With a stance, a planted foot rolls as the creature walks: the heel lifts
  late in the step while the toes stay down, and hooves stay flat. Without one, the leg keeps
  plan 1's flat feet.
- **Wings and fins** carry a `membrane`, set like a foot: `membrane.bat` (leathery skin between
  finger bones, `fingers` 3–5 and `span` for their length), `membrane.insect` (a thin veined
  plate, `shape` and `width`), `membrane.feather` (flight feathers on bones of their own,
  `feathers`, `length` and `tips`), `membrane.case` (a beetle's hard wing case) and `membrane.fin`
  (`rays` fanned back from the fin limb, `width`). A flipper is a fin with `"membrane": null`. A
  bat membrane's trailing edge runs to the nearest leg behind the wing, or to the body
  (`"trailing": "body"`, best on walkers, whose legs swing through it).
- **Wings rest folded** against the body, and spread (to the pose they are built in) when an
  action asks (`roar` flares them) or a game calls `setWings`; `render --pose spread` shows them
  open. A leathery or feathered wing folds in a Z along the flank; insect wings fold flat over
  the back, hind wings under forewings and the left of a pair above the right; a wing behind a
  `membrane.case` on its side folds away under the case. Attach wings high on the shoulders
  (`angle` 30–50) and near the front (`at` 0.1–0.2), or they fold into the legs: `compile`
  warns `wing_clearance` when one cannot fold clear, and `analyze` warns `wing_intersection`
  when one passes into the body, a leg or the ground as it walks or spreads. Fins hold still,
  flat; `fin.dorsal` and `fin.tail` stand on the back and the tail tip.
- **Tentacles** take `curl` (degrees of rest curl, toward the belly; negative curls toward the
  back) and `curlStart` (the straight share before it). For eight tentacles write four entries
  with `side: "both"` at different `angle`s. On the torso at its default `at` 0.9 they trail
  behind, like a squid's; `"attach": { "on": "head" }` rings the mouth, pointing forward (see
  `examples/kraken.json`). A tentacle that curls down to the ground lies on it and curls on
  across it. A `radius` profile with a bulge near the tip (`[0.04, 0.02, 0.018, 0.035, 0.008]`)
  makes a squid's club. Tentacles sway on soft springs and lie on the ground as the creature
  moves; `bite` reaches the nearest two for its target, and `lash` whips one at it. Fins or
  tentacles on the torso make a legless body a swimmer (see `media`); on the head they do not,
  so a tentacle pair on the head with an `eye.basic` at `at` 1 makes eyes on stalks for a slug
  that stays on land. `analyze` warns `tentacle_intersection` when one passes into the body or a
  leg, and gives `measurements.tentacleReach`.
- Typical lengths: a dog-like quadruped's legs are 0.5–0.6 torso lengths, an upright biped's legs
  1–1.6, insect legs 0.6–0.8 with `splay` 55, spider legs 0.85–1.1, a dragon's wings 1.2–1.8.
  A sprawled leg (`splay` 55 or more) longer than 0.7 torso lengths holds the body as low as a
  0.7 one would and arches its knee above the hip, as a spider's do; the extra length widens its
  stance. Eight legs walk in a wave and `tripod` in alternating sets of four.

## Parts

Parts are hard pieces snapped onto the skin, each a module with its own `params` object. Where a
part sits depends on its slot (shown in `describe_module`):

| Slot | Placement | Parts |
| --- | --- | --- |
| surface | `at` and `angle` on `on` | `horn.curved`, `ear.pointed`, `eye.basic`, `antenna`, `fin.dorsal`, `fin.tail`, `frill`, `hood` |
| row | copies from `from` to `to` | `spikes.row`, `plates.row`, `sail` |
| mouth | along the mouth (teeth stand in the gums); needs `head.jaw` | `teeth.row`, `beak`, `mandible` |
| area | over an `area` of `on` (`back`, `belly`, `sides` or `all`), optionally `from` and `to` | `shell`, `armor.bands`, `quills` |
| foot | a limb's `foot` field, not `parts` | `foot.claw`, `foot.hoof`, `foot.paw`, `foot.talon`, `foot.pad`, `hand.grasp`, `hand.pincer` |
| membrane | a wing's or fin's `membrane` field, not `parts` | `membrane.bat`, `membrane.insect`, `membrane.feather`, `membrane.case`, `membrane.fin` |

Fins come two ways: paired fins (pectoral fins, flippers) are limbs with `"role": "fin"`, and
fins on the midline are parts: `fin.dorsal` stands at one point on the back, `fin.tail` sits on
the tail tip. Area parts carry their own placement, so `{ "id": "shell", "type": "shell" }` alone
covers the back of the torso; `area` is only for them (skin layers use `region`). `back` covers
within 70° of the top on both sides, `sides` 50°–130°, `belly` the underside past 110°, `all`
everything, between `from` and `to` along what they sit on.

**Coverings.**

- `shell` follows the body: `dome` (0 flat, 1 a high tortoise shell), `thickness`, `overhang`
  (how far the rim reaches out past the body) and `scutes` (a row down the middle, a row each
  side and marginal plates round the rim; 0 smooth), with `seamColor` between them. For a
  tortoise give the torso a `wide` cross-section and keep its radius modest: the shell adds the
  height (see `examples/stone-tortoise.json`).
- `armor.bands` lays `bands` overlapping strips (`overlap`) from front to back; `scales: true`
  breaks them into staggered scales, as on a pangolin or an armadillo's tail. Start them at
  `from` 0.1 or later on the torso: at 0 the first band sits where the neck narrows and flares
  into a fan. For an armadillo, use `area` "back" (the top and upper flanks) on a `round` torso,
  and a second set on the `tail`.
- `plates.row` stands flat plates along the midline, `kite` (a stegosaur's), `round` or `spike`,
  edged in `edgeColor`.
- `quills` scatter over their area, spaced by `density`, lying back by `lie`, tipped in
  `tipColor`.
- `frill`, `hood` and `sail` are spines with skin between them, lit through like wings. They rest
  folded (`open` says how far: a frill lies back over the neck, a hood's ribs back along the neck,
  a sail leans back a little) and open in `display`, which also raises quills; `render --flare 1`
  (MCP `pose.flare`) shows them open. A hood has two eye marks on its back (`markColor`); give
  the cobra's neck `pitch` about 80 so it rears.

Parameters go inside `params`: `{ "id": "horns", "type": "horn.curved", "params": { "length": 0.3 } }`.
Each part has a default anchor, so `{ "id": "teeth", "type": "teeth.row" }` is complete.

**Sizes that follow the head.** Teeth and eyes size themselves to the head: `teeth.row` has
`scale` and `fangScale` (1 is typical, 2 big), `spacing` (gaps as a share of a tooth's width)
and `incisors`, and packs the row densely unless you write `count`; `eye.basic` has `scale` (an
eye's radius is a share of the head's there), `lids` (eyelids that blink; `false` for snakes,
fish and insects) and `squint` (0 wide open, 1 menacing). The older `length`, `fangLength` and
`size` still work in torso lengths and win when written, so prefer the relative ones: a long
serpent with `fangLength` gets planks for fangs. A `beak` covers the snout in two halves, upper
on the head and lower on the jaw: `shape` (`hooked`, `straight`, `broad`), `length` (how far it
runs on past the snout) and `depth`; use `"lips": 0` and leave out teeth for a bird.

A row's `count` is per row: a `spikes.row` with `side` "both" makes two rows of `count` spikes,
while `plates.row` is one centred part whose `count` plates alternate left and right
(`alternate`); its plates and a `sail`'s spines run from `from` to `to`. Parts sit on
tentacles, wings and fins as on any limb.

**Parts with bones.** `antenna`, `mandible` and `hand.pincer` move on bones of their own, which
exports carry. An `antenna` (surface slot, on the head; `side` "both" for a pair) is a jointed
chain that sways on a spring and never sinks into the ground: `length`, `segments`, `shape`
(`thread`, `club` for a butterfly, `feather` for a moth's comb), `curve` (degrees it curves back)
and `stiffness`. A `mandible` (mouth slot) is a pair hinged at the mouth corners that opens with
the jaw: `shape` `mandible` (an ant's, curving in toward each other) or `fang` (a spider's
chelicerae, hanging down), `length`, `curve` and `teeth`.

### Recipes

These were checked against renders (`render` with `labels: true` shows where every part landed).
All lengths are in torso lengths.

| Look | Part |
| --- | --- |
| Ram horns, coiled beside the head | `horn.curved` on `head`, `at` 0.8, `angle` 40; `length` 0.65, `width` 0.05, `curve` 400, `turn` -35, `lean` -10, `ridges` 12 (on an upright biped's head: `at` 0.6, `angle` 85, `turn` -70, `lean` 10) |
| A cobra rearing up | `serpent` with `neck` `pitch` 75–80 and `torso` and `tail` `pitch` 0–1 so the body lies flat (higher values lift the tail tip off the ground and sink the torso); a `hood` on the neck and `display` to spread it (see `examples/hooded-cobra.json`). A rearing neck shows its belly to the front, so lower `countershade`'s `height` (about -0.6) to keep it the body's colour |
| A flat, broad head | `"head": { "shape": "flat", "crossSection": "wide" }`: the shape alone still reads as a dome from the front |
| A big round head with forward eyes (a goblin) | `"head": { "shape": "round", "radius": 0.3 }` and `eye.basic` at `at` 0.22, `angle` 62, `scale` 2.6: the default places eyes on the crown, like a frog's |
| A club on the tail | a tail `radius` profile that swells near the end, such as `[0.15, 0.12, 0.1, 0.1, 0.14, 0.24, 0.25, 0.08]`, with `segments` 12 so the swell keeps its shape |
| A bushy tail | a thick `radius` profile (`[0.08, 0.14, 0.12, 0.05]`) and longer fur on it: `"fur": { "length": 0.06, "region": "tail" }` (a full coat at 0.03 reads as fur, not a brush) |
| A beetle's nose horn | `horn.curved` on `head`, `at` 0.2, `angle` 0; `length` 0.55, `width` 0.065, `lean` -5, `curve` -75 (it rises and arcs back; mammal horn values hang it down) |
| A colour only on the tail | a layer with `"region": "tail"`, e.g. `countershade` with `color` "base" and `height` 1 to keep a curled tail's underside dark |
| Bull horns, out then forward | `horn.curved` on `head`, `at` 0.85, `angle` 75; `length` 0.3, `width` 0.04, `curve` -70 |
| Rhino nose horn | `horn.curved` on `head`, `at` 0.12, `angle` 0; `length` 0.22, `width` 0.05, `curve` 25 (add a smaller one at `at` 0.4) |
| Tusks from the lower jaw | `horn.curved` on `jaw`, `at` 0.25, `angle` 60; `length` 0.16, `width` 0.025, `curve` -60, pale `color` and `tipColor`. On a flat or wide head they sit beside the eyes: use `aim` "up" with `angle` about 90 and a longer `length` (0.22), so they clear the lip |
| Insect mandibles | `{ "id": "jaws", "type": "mandible", "params": { "length": 0.2 } }`: a pair that opens with the bite (fixed horns, `horn.curved` with `aim` "forward" and `side` "both", do not move) |
| Horns swept back along the head | `horn.curved` on `head`, `at` 0.8, `angle` 50; `length` 0.4, `curve` 50, `aim` "back" |
| Spikes down the whole back | `spikes.row` on `spine`, `from` 0.1, `to` 0.95, `angle` 0; a `height` profile such as `[0.06, 0.12, 0.05]` |
| A stinger on the tail tip | `horn.curved` on `tail`, `at` 0.97, `angle` 0; `length` 0.14, `width` 0.025, `curve` 60, a dark `color` |
| Pointed ears | `ear.pointed` on `head`, `at` 0.85, `angle` 45; `length` 0.14, `width` 0.05 (for hanging ears, param `droop` 0.8 and `attach.angle` 70) |
| A wolf's or croc's grin | `teeth.row` with `fangs` 1 and nothing else: the row fills the mouth and the fangs show over the lips when it is shut; `fangs` 0 and `scale` 1.2 for a crocodile's even teeth, `fangScale` 1.8 for sabres |
| A snake's mouth | the `serpent` preset (forked tongue, no lips, no eyelids); `teeth.row` with `incisors` 0, `fangs` 1, `lower` false |
| A bird's head | `"head": { "shape": "snout", "lips": 0 }` and a `beak` with `"shape": "hooked"` (eagle, terror bird), `"straight"` (heron) or `"broad"` (duck); no teeth (examples/terror-bird.json) |
| Heavy-browed, menacing eyes | `"head": { "brow": 0.7 }` and `eye.basic` with `squint` 0.5 |

For `horn.curved`, `aim` is the easy way to point a horn: `forward` (mandibles, a charging
bull), `up`, `out` (away from the body), `back` (swept back) or `down` (tusks). It works out the
lean and turn from where the horn sits, whatever its `angle`, and replaces `lean` and `turn`; a
horn's root can only tilt forward or back, so `up` and `down` work best for horns on the side of
the head (`angle` 60–110). Without `aim`, the horn grows straight out of the skin, then bends by
`curve` degrees,
backward (toward the tail) for positive values and forward for negative ones. `lean` tilts the
root first, `twist` spirals it, and `turn` swings the bend sideways (90 toward the midline, -90
away). Pairs (`side` "both") are mirror images. The attach `angle` also sets the plane the horn
bends in: near 30–45 a curved horn rises and sweeps back over the head, near 75–90 it grows out
to the side first (bull horns). A `curve` past 360 coils; a small negative `turn` (-30 to -45)
then swings the coil out beside the head instead of over it (ram horns). Coiled horns spend their
length on the coil, so they need a `length` of 0.5–0.75 to read from a distance.

## Skin

- **`palette`** names colours. `base` (the main colour), `belly` and `accent` always exist; add
  others by name (`"hornTip": "#ffe0a0"`). Colours are `#rrggbb`, `#rgb` or CSS names (`tan`,
  `darkolivegreen`). `"harmony"` makes the colours instead: `analogous`, `complementary`,
  `triadic`, `split` or `monochrome` picks the accent's hue relative to the base, and the seed picks
  the rest, with a belly clearly lighter than the base and an accent clearly lighter or darker so
  patterns read. It fills in only the colours the blueprint leaves out (the preset's give way), so
  `{ "harmony": "complementary", "base": "#305080" }` keeps that blue and finds the rest.
- **`material`** is the surface under the patterns, and how it meets the light: `skin` (soft,
  light glows a little past its shadow edge, faint pores), `hide` (thick, dry, with a network of
  wrinkles that deepens in creases, for trolls, boars and elephants), `scales` (small
  overlapping scales running down the body, glossier) or `chitin` (segmented plates with seams
  and a lacquered sheen, for insects and spiders).
- **`fur`** grows a coat over the material: `"fur": { "length": 0.03, "density": 0.8, "region":
  ["torso", "limbs", "tail"] }` (`length` in torso lengths, 0.002–0.3, default 0.03; `density`
  0–1, default 0.8; `region` one layer region or a list, default `all`), so a griffin can have a
  furry body and a bare head. Fur takes the colours of the skin under it (palette and layers), so
  stripes and spots show through, though detail finer than a hair does not. `"fur": {}` is a full
  coat; `null` removes an inherited one. Fur is shorter on the face, in creases and on the feet,
  stays clear of the eyes and the mouth, and never grows on wings or fins. It is drawn as shells, from medium quality up; a 0.02–0.04 coat reads as fur, longer as
  shaggy. `.glb` exports leave it out for now (the skin under it is exported).
- **`layers`** is the pattern stack, bottom first: `countershade`, `stripes`, `spots`, `mottle`,
  `scales`, `grime`, `scars` (pale healed streaks; `rake` 3–4 for claw marks), `bioluminescence`
  (glowing spots or dotted lines that pulse), `suckers` (pale rimmed cups in a row under each
  limb, for tentacles; `count` per limb), `slime` (a wet gloss with drips), `warts` (raised
  bumps), `veins` (branching lines), `rosettes` (broken rings around a tinted centre) and `bands`
  (even rings round the body and tail). A layer's parameters sit beside its `type`. Every layer also takes
  **`region`** (`all`, `back`, `belly`, `head`, `torso` (which includes the neck), `limbs` (legs
  and arms), `tail` or `wings`, which covers wing and fin membranes and the bones that carry
  them; layers of any other region leave membranes their own colour) and
  **`strength`** (0 to 1). A region only masks where the layer shows; the pattern itself is laid
  out over the whole body, so `stripes.count` counts stripes from snout to tail tip whatever the
  region, and three `scars` with `region` "head" leave about one on the head (raise `count` by
  the region's share of the body).
- The base colour is `palette.base`. `countershade` blends toward its `color` (the belly colour by
  default) below its `height`: -1 is the belly midline, 0 the flank, 1 the spine.
- `material` and layers do different jobs: `"material": "scales"` gives the whole skin a fine
  scaly sheen, while a `scales` layer adds visible scale shapes with gaps and relief at a size you
  choose. Use either or both.
- Colour parameters (`color`, and any field ending in `Color`) take a palette name such as
  `"accent"` or a colour.
- A `tall` torso cross-section is narrow; on a big biped or raptor it reads as a plank, so keep
  those `round`. On a tail that curls up, `countershade` follows the tail's underside, so the
  tip can show pale; give the tail its own layer (`region` "tail") if that is not wanted.
- Pattern sizes are in torso lengths, so they scale with the creature. Details smaller than a few
  pixels fade out instead of flickering, so on a small creature seen from afar, `scales`, `warts`
  and `veins` at their default sizes read as plain skin; use a larger `size` (0.08–0.15) or
  `width` there. Glow shows live and in renders; `.glb` exports leave it out until texture maps
  (milestone 11.1).
- **Order matters.** Each layer paints over the ones before it, so a full-strength layer late in
  the list (a `countershade` on the tail, say) hides the spots or bands under it. Put broad
  layers first and markings after them, or lower the late layer's `strength`.
- **Very dark creatures.** A base near black (`#000`–`#111`) loses its shape in renders: shading
  has nothing to darken. Use a dark grey or brown such as `#1c1a1e`, and give `grime` or `mottle`
  on it a colour well above the base so they show.
- On a creature with no legs, `countershade` at its default height gives the pale belly of a
  snake; raise `height` toward 0 to pale the flanks too.

Patterns follow the body: stripes run across the spine, bellies come out paler, and nothing slides
when the creature moves.

## Motion

- **`temperament`**: `calm`, `stalking`, `skittish`, `aggressive` or `lumbering`. It sets the
  walking pace, how fast it turns, a crouch and a lowered head for stalkers, and idle behaviour.
- **Speed is chosen at run time** by whatever moves the creature (a game, or the sandbox).
  Stride length and timing scale with leg length and speed (bigger creatures step more slowly).
  Gaits change with speed as dynamic similarity predicts: walk below a Froude number
  (v²/(g·hip)) of about 0.5, trot or run up to about 2.5, gallop (or bound, for small
  four-legged bodies) above. The legs ease into a new gait's footfalls over a stride or two.
- **`media`**: where the creature moves, as switches `land`, `water` and `air`. Left out, each
  follows the body: `land` with legs (or no legs and no fins or tentacles on the torso), `water`
  for a body with fins or tentacles on the torso and no legs, `air` with wings. Switches merge
  over that:
  `"media": { "water": true }` adds swimming to a walker or a snake, `{ "air": false }` grounds
  a winged one (a beetle too heavy for its wings, `examples/rhino-beetle.json`); flying needs a
  wing limb.
- **Swimming.** A creature that swims takes to water deeper than about its hip height (a
  legless one, a little more than its girth) and walks or slithers out where it is shallower;
  one that only swims stops at the shore. Walkers and paddlers swim with the back awash and the
  head out; fish and other divers hold their depth, or dive and rise to a height a game or
  scenario asks for, pitching toward it and never into the bed. The tail beats at a frequency
  from a Strouhal number of 0.3 (faster the faster it swims), so its tip sweeps about a fifth of
  the body's length side to side; flippers beat with it, and legs paddle or trail. In water its
  pace is its swimming gait's, and `analyze` gives `speed.swim`, checks that a swimmer at the
  surface holds its head out (`head_underwater`) and that nothing goes into the bed when it dives
  (`hits_bed`). Games pass the water with the ground (docs/runtime.md); scenarios take `"water"`.
- **Flying.** A creature with wings flies only when asked (a game's `fly()`, a scenario's `fly`
  call, or a point higher than it could reach on foot); otherwise it walks as it would without
  flight. It crouches, leaps and climbs away, cruises at a speed set by its wing loading (its
  weight over its wings' area: a 560 kg dragon about 25 m/s, a 4 kg bat 10), holds a height above
  the ground (by default its span clear of it), banks into turns, glides between flaps where its
  wings can, circles when it has nowhere to go (insect wings hover instead) and lands with a
  flare, wings raised as its feet reach for the ground (a hoverer comes straight down). Bigger
  wings beat slower. Leathery and feathered wings flex on the upstroke; insect wings stroke on a
  steeper plane, a hind wing just behind its forewing; a beetle's cases lift clear. `analyze`
  gives `speed.fly` and `speed.slow`, warns `cannot_fly` when the wings carry more than 700 N/m²
  (with how much longer they need to be), and flies a course (take off, circle, land on a 15°
  slope), checking the beating wings (`wing_intersection` "while flying") and the landing
  (`hard_landing`). Look at it with `render --filmstrip --gait fly` and the scenario
  `examples/scenarios/flight-course.json`.
- **`gaits`** are worked out from the body and its media, so you rarely need to list them. On
  land each suits a leg count: `walk` (any legs), `trot` (2 pairs), `tripod` (3 pairs), `slither`
  (no legs), `run` (2 legs), `gallop` (4 legs, hips 0.3 m up or higher) and `bound` (4 legs,
  hips 0.35 m up or lower, like a weasel's). In water: `swim.undulate` (a wave down the body
  into the tail: fish, snakes, crocodiles at speed), `swim.paddle` (legs cycling at the surface,
  slowly) and `swim.flap` (long fins as flippers: turtles); in the air: `fly` (flapping), `glide`
  (wings held spread between flaps; leathery, feathered and broad insect wings) and `hover`
  (insect wings). Leave the field out to use every gait that suits the body; a list replaces
  the defaults only for the media its gaits serve, so `["walk"]` on a dragon still flies. A
  gait's parameters sit beside its `type`:
  - `stride` multiplies the natural stride length, but a foot can only travel as far as its leg
    reaches, so on short or sprawled legs large values change nothing (the legs step faster
    instead). Long, nearly straight legs take the longest strides.
  - `duty` is the share of the cycle each foot is planted. Above 0.5 a biped walks; below 0.5
    it runs, with moments where no foot touches the ground (`run` goes from 0.45 to 0.3 as it
    speeds up).
  - `duty` and `stride` may be one number or `[slowest, fastest]` across the gait's speeds:
    `{ "type": "walk", "duty": [0.8, 0.65] }` plants the feet longer when it ambles.
  - `gallop` takes `style` (`transverse` like a horse, `rotary` like a cheetah or a dog), `lead`
    (`left` or `right`: the foreleg that lands last) and `flex` (how far the back flexes and
    stretches each stride); `bound` takes `flex`; `run` takes `lean` (degrees forward at speed).
  - Each gait covers a range of speeds for the leg length (Froude number up to 0.5 for `walk`,
    2.5 for `trot` and `tripod`, 8 for `run`, 12 for `gallop`), so `stride` does not raise the
    top speed. Gaits that keep a foot down top out at a Froude number of 1.5; a run or a gallop
    goes to the top of its range. A horse with 1.3 m hips gallops at up to 12 m/s; `analyze`
    reports it as `speed.max`, and checks every gait at its own natural speed.
  - `stepHeight` lifts the feet higher (a share of hip height); `slither` takes `amplitude` and
    `waves` for the shape of its S-curve.
- **`actions`**: what the creature can do when asked. `bite` and `roar` need a jaw, `look`
  needs a head, `idle` needs nothing. `pinch` needs a pincer: the claw nearer the target rises,
  opens wide and snaps shut (`both` snaps both). `lash` needs a tail or a tentacle: the one
  nearest the target winds up and whips toward it (`arc`, the most it sweeps in degrees).
  `display` is a threat display: it faces the target, rears a little and hisses, opens frills
  and hoods, raises quills and sails and spreads any wings, holds and folds back (`duration`,
  `intensity`). `jump` (needs legs) crouches, leaps a ballistic arc to the target over the
  ground and lands, absorbing it: `power` (how far it leaps unaimed and at most, up to about 9
  hip heights), `crouch` and `height` (metres it clears in the middle, over an obstacle).
  `pounce` (needs legs and a jaw) leaps so its head meets the target and bites as it lands. Both
  fire `takeoff` and `land`. Some actions need what a module provides rather than a section:
  `display` needs a part that provides `display` (`frill`, `hood`, `quills` or `sail`; wings do
  not), `pinch` a `hand.pincer`; `describe-module` and the catalogue list what each module
  provides, and a `needs` entry that is a list means any of them. Leave the field out to get
  every action the body allows.
  `idle` runs by itself (breathing, blinks, glances, weight shifts, tail swish); the others run
  once when a game or the sandbox calls them, timed by size (a big creature bites slowly) and
  aimed at a target.
- **Events**: footsteps, gait changes, the start and end of each action, and moments an action
  marks, such as `bite-contact` when the jaw snaps shut and `roar-peak`. Games use them for sound
  and damage.
- **Check motion with a filmstrip**: `render` with `filmstrip` (CLI: `--filmstrip`, optionally
  `--gait trot` or `--speed 2`) draws one gait cycle and a footfall diagram, and reports the
  cycle time, stride, the share of time each foot is planted and how far planted feet slide (in
  metres; anything above a centimetre or two is visible). With `--action bite` (or `roar`,
  `look`) it draws the action instead, close on the head and neck, with the times of its events;
  a bite comes mostly from the neck, so short-necked creatures mostly snap. Other options:
  `--view side|3/4|top|front` (default side; serpents from above; actions at 3/4; `front` shows
  the legs' stance), `--frames n` (2–16, default 8) and `--size px` (per frame, default 320).
  Fine patterns fade out in small frames, so judge spots and scales on the contact sheet.
- **Contact sheet options**: `--views 3/4,side,head,front,top,rear` picks the panels (add
  `underside` to look up at the belly and the soles of the feet), `--size px`
  sets the pixels per panel (default 512), `--quality low|medium|high` the mesh detail, and `--labels` tags every
  part and limb by id. Spots and scales on a small creature (under about half a metre) are only a
  few pixels across on the default sheet; check them with `--views top,3/4 --size 900 --quality
  high`. Pattern sizes are in torso lengths, so on a creature with a very long tail a few large
  spots can land mostly on the tail: use smaller spots, or a second layer with `region`.
- **Script motion with a scenario**: `render` and `analyze` take `--scenario s.json` (MCP:
  `filmstrip.scenario` and `scenario`): ground (flat or the uneven course), named targets and
  timed calls (`moveTo`, `follow` a course, `act` at a target, `lookAt`, `stop`, `drive`,
  `gait`). `analyze` reports the events, the distance walked, how close a snout came to each
  target and foot slide; `render` draws it. See [scenarios](scenarios.md).
- **Check everything else with `analyze`**: its warnings and description come first, and
  `--summary` (MCP `summary`) leaves out the detailed motion numbers. It measures the creature (size, mass, centre of mass,
  hip height, speeds per gait, bite reach, balance over the feet), runs two gait cycles on flat
  and rough ground, and warns, with a path and a fix, about sliding feet, a body or tail in the
  ground, legs stretched past their reach, limbs passing through each other or the body, parts
  buried in the skin, eyes facing backwards, a centre of mass outside the feet and stepping too
  fast (`fast_cadence`: `cadence` lists each gait's steps a second, per foot, at its usual
  speed; above 8 a second legs read as jitter at 30 frames a second, which happens to creatures
  with a torso under about 20 cm; make them bigger or, if they are meant to be that small,
  skittish). Fixes give
  amounts where they can (`about 10° more splay`); a leg that hits the body during the swing also
  clears with a smaller gait `stride` or `stepHeight`. It also writes a one-paragraph description
  (size, proportions, parts, colours, gaits): read it to check the creature is what you meant.

What the body model does not do yet: a section bends only as a whole, so a neck raised steeply
(a cobra) turns at its base unless `neck.curve` gives it an S; and the head
stays level while walking, by design. For sprawled legs, an attach `angle` around 110–120 keeps
the legs clear of the body as they swing; angles past about 150 bring both legs under the belly.
Big eyes need a large `scale` on `eye.basic` (2–3 for cartoon eyes); `size` in torso lengths
also works, and wins when written.

## Editing with patch

`patch` changes a blueprint file in place by id-based paths and prints a short diff; the file is
only written when the result is valid, and `--out new.json` writes the result there instead,
leaving the file as it was. Operations: `set` (a value), `add` (an item to a list
such as `parts` or `skin.layers`), `remove` (a key, back to its default, or a limb or part;
inherited ones get `"remove": true`), `mirror` (make a limb or part a pair, or set its `side`)
and `scale` (multiply a number or a profile by `by`; path `""` scales the whole creature). `set`
on an object replaces the whole object, so `set body.tail {"length": 0.2}` drops the tail's other
fields back to the preset; set one field by its path (`body.tail.length`) instead. Paths
look like error paths. Limbs and parts are found by id (`limbs[id=hindleg]`), including inherited
ones; layers, gaits and actions by type (`skin.layers[type=mottle]`, `motion.gaits[type=walk]`,
the first of that type) or by position (`skin.layers[1]`):

```sh
spawnforge patch wolf.json '[{"op":"set","path":"limbs[id=hindleg].length","value":0.7},
  {"op":"set","path":"skin.layers[type=mottle].strength","value":0.6},
  {"op":"scale","path":"parts[id=horns].params.length","by":1.5},
  {"op":"add","path":"parts","value":{"id":"ears","type":"ear.pointed","attach":{"side":"both"}}}]'
```

To see what changed between two versions of a creature, `diff a.json b.json` (MCP: `diff`)
compares the creatures they resolve to and prints the patch operations that turn `a` into `b`,
one line per change. Its `ops` go straight into `patch`; `exact` says the result is `b`'s
creature exactly.

## Species and variation

**Species.** Anywhere a number goes, a range `{ "min": 0.5, "max": 0.7 }` makes the blueprint a
species: one file for endless individuals. Anywhere a colour goes, `{ "min": "#5a5a5a", "max":
"#9a9a9a" }` picks a colour between the two (`#rrggbb` only, no names). `instantiate` (CLI
`spawnforge instantiate species.json --seed 7`) resolves every range for a seed: integer fields
(`segments`, `toes`, `count`) get whole numbers, every other number any value in between, so
`{ "min": 2, "max": 3 }` on a tail length gives 2.6 as readily as 2. Each range draws from its own
stream, keyed by its path, so narrowing one range never changes the others. `validate`
recognises a species and checks it at both ends of every range (all minimums, then all maximums)
and at a few seeds (listed in `checked`), so an error names the range that breaks. `patch` edits
a species the same way. `analyze`, `render`, `mutate` and `crossbreed` work on one creature, so
make an individual first:

```json
{
  "format": "spawnforge/0.2",
  "name": "Marsh Hound",
  "extends": "quadruped",
  "scale": { "min": 0.8, "max": 1.2 },
  "body": { "neck": { "length": { "min": 0.2, "max": 0.4 } } },
  "parts": [
    {
      "id": "horns",
      "type": "horn.curved",
      "attach": { "on": "head", "at": 0.7, "angle": 40, "side": "both" },
      "params": { "curve": { "min": 20, "max": 120 } }
    }
  ]
}
```

**Mutate.** `mutate` (CLI `spawnforge mutate wolf.json --seed 3 --amount 0.3 --lock
skin,body.head`) makes a child: numbers drift within their schema ranges, profiles scale, colours
shift, and now and then an enum flips, a part is added, removed or swapped for one with the
same slot and a shared tag (eyes and ears are never touched), or the feet of every limb of one
role change together to other feet that stand a leg (paws, hooves, pads, talons, claws; hands
to other hands). A part of a lineage (a beak, mandibles, a hood) joins only a creature that
already wears one (a bird, an insect, a snake), and fins only creatures that swim. Switches
(`head.jaw`, a teeth row's `upper`, eyelids, cloven hooves) never flip, and the skin's `material`
never drifts, so a viper stays a scaled snake with fangs. Mutation never changes how many
heads, tails or limbs a creature has, so it never grows wings or a second head: those come from
themes, `patch` and crossbreeding. `amount` (0 to 1) is how many genes change and how far;
values of zero stay zero, so a tailless creature does not sprout a tail and a single tail does
not fork.
`locked` paths, such as `skin`, `body.head`, `parts[id=horns]`, `skin.layers[type=stripes]` or
a top-level field like `scale`, never change; a lock that matches nothing comes back as an
`unknown_lock` warning. `scale` is a gene like any other, and lengths are in torso lengths, so lock
`scale` too when a size must hold in metres. Quote lock paths in a shell (`--lock
'skin,parts[id=horns]'`), since brackets glob. `--keep-parts` (MCP `structure: false`) turns off
the structural changes: no part or foot is added, removed or swapped. Mutation checks that the
child is valid, not that it moves well: run `analyze` on it (a mutated hydra's necks can fan into
each other). Palette colours
keep their contrast with the base, so a mutated stripe never fades into the skin, and eyes and
ears are never added, removed or swapped. The result is the parent's file with the changes
written in, plus a gene-by-gene diff; it keeps the parent's `name` and `seed` (the seed places
spots and scales, so the child keeps its parent's markings). Mutation is random: to push a gene
one way (longer horns), lock it and change it with `patch`.

**Crossbreed.** `crossbreed` (CLI `spawnforge crossbreed a.json b.json --mix 0.5`) keeps one
parent's body plan (the second parent's, with chance `mix`, when they differ) and builds on that
parent's file. It pairs limbs by id or by role and position (forelegs with forelegs), parts by id
or type (same type on the same section: tusks on the jaw don't pair with a horn on the head),
and layers, gaits and actions by type; then it blends numbers and colours between pairs, picks
enums and switches from either parent, and brings unpaired parts, layers and actions over by
chance. Heads and tails come whole from one parent: the child has the base's count of necks
and heads, or the other parent's with chance `mix`, with that parent's `spread` (and, for tails,
`forkAt`). Wings, fins and tentacles pair one to one by role, and how many of each the child has
comes from one parent the same way: a wolf can grow a griffin's wings, and a griffin can lose
them. Legs and arms are always the base's. `--lock limbs` keeps the base's limbs exactly, so
it also keeps out the other parent's wings: to keep the legs and take the wings, lock the legs by
id (`--lock 'limbs[id=foreleg],limbs[id=hindleg]'`). The base's own unpaired parts stay only with
chance `1 − mix` (a wolf crossed with a griffin may lose its teeth); lock `parts` to keep them.
`mix` 0 or 1 copies a parent; in between, each gene's share wobbles a little around `mix`. Posture blends too (torso and neck pitch), so to keep one parent's body, build on it with
`--base a` and lock what must not change: `--lock body.torso,limbs`. The result says which parent
it is built on (`base`) and diffs against it.

**Generate.** `generate` (CLI `spawnforge generate --theme reptile --seed 4`) builds a new
creature from a theme module (`list_modules` with kind `theme`: `reptile`, `insect`, `demon`,
`dragon` (wings), `aquatic` (fins, swimmers), `eldritch` (tentacles, extra eyes and heads) and
`beast` (furred mammals on paws or hooves)). The theme weights the body plan and narrows the
proportions, optional limbs and parts, patterns, palette, fur, material and temperament; the
same theme and seed always give the same creature. Constraints
narrow it further: `--body-plan biped`, `--max-height 1.2` and `--min-height 0.5` (body height in
metres, not counting horns or spikes, the same as `analyze`'s `bodyHeight`; its `height` counts
them; the creature is rescaled to fit, so a limit it would break is met exactly, to the
millimetre), `--actions bite,roar` (it gets a body that can; the file
leaves `motion.actions` out, which means every action the body allows), `--parts
horn.curved` and `--requires air,water` (media it must move in: `air` needs wings, so only a
theme with wings can fly; `water` picks a swimmer or turns swimming on for a walker). The blueprint's own `seed` (which places its markings) is drawn from the theme and the
`--seed` you give, so it differs from it. Generated blueprints are ordinary blueprints: edit them
with `patch`, or `mutate` and `crossbreed` them. In the sandbox, the breed tab does all three.

## Validation

`validate` returns `ok`, `errors`, `warnings` and the **minimal blueprint**: the same creature
with every value that equals the preset or a default removed. Validation never changes your file;
the minimal blueprint is there to show what actually differs from the preset (`validate --quiet`
leaves it out, for just the verdict). Each issue has:

- `path`, id-based, e.g. `limbs[id=hindleg].attach.at`
- `message`, e.g. `1.4 is outside 0–1`
- `expected`, the valid range or values
- `fix`, e.g. `did you mean "length"?`, `move "length" into "params"` or, for a value that
  belongs to a neighbouring field, `"wide" is a crossSection, not a shape`

`notBuilt`, when present, lists what the blueprint uses that the format has but the pipeline
does not draw yet, each with the milestone that builds it. It is neither an error nor a warning:
keep those features. It names what the blueprint (or its preset) writes, so flying that wings
imply is not listed on its own. A part on a
host that is not drawn names its host. `list-modules` gives each module that is not drawn yet a
`planned` milestone.

Validation reports every problem it can find in one pass, so fix them all before validating
again. A few mistakes (an unknown preset, a list where an object belongs) hide the checks that
depend on them, so a second pass can find more. Unknown keys are always errors, never silently
dropped.

Compiling and rendering can add warnings that only show once the body is built, such as
`below_ground` when a drooping tail or head sinks into the floor. They have the same fields and
name the section to change.

## Not drawn yet

Nothing: everything format 0.2 holds is drawn today and moves, from legs, horns and every pattern
layer to several heads and tails, wings, fins, tentacles, shells, quills, frills, walking,
running, galloping, slithering, swimming and flying, and every action. A module a pack declares
before it is built validates, is skipped by compile and motion, and is listed under `notBuilt`.

### Recipes for the new bodies

These say how plan 2's bodies are written; they validate today and take shape as their
milestones land.

| Creature | Blueprint |
| --- | --- |
| Dragon | `quadruped` plus `{ "id": "wing", "role": "wing", "length": 1.5 }` at `angle` 35; horns with `aim` "back"; `"material": "scales"` (see `examples/ash-dragon.json`) |
| Wyvern | `wyvern` (its wings are its forelimbs); a stinger as in the recipe above |
| Bat | `wyvern` with bat proportions: a short neck and tail, a big `snout` head, legs under the middle (`at` 0.45), wings `length` 1.9 with `"membrane": { "type": "membrane.bat", "fingers": 5, "trailing": "leg" }`, big `ear.pointed` and fur on the head and torso (see `examples/cave-bat.json`) |
| Hydra or cerberus | `quadruped` with `"neck": { "count": 5, "length": 0.75 }` and a small head (examples/hydra.json), or 3 with `length` 0.45 and `spread` 90 for a cerberus (examples/cerberus.json); parts on `head` appear on every head |
| Kraken | `serpent` with a short, thick torso (the mantle), no tail, a big `round` head and four `tentacle` entries on the `head` with `side` "both" at `angle`s 25 to 155, plus two long feeding tentacles with a club in their `radius`; `suckers` on the limbs (see `examples/kraken.json`). Tentacles on the torso trail behind instead, like a squid's |
| Crocodile | `quadruped` with a `wide` torso, a long low `wedge` head, legs `splay` 60 with `foot.claw`, a long `tall` tail, a `spikes.row` of low scutes, `"media": { "water": true }` (see `examples/river-crocodile.json`): it walks in, swims with its back awash and climbs out |
| Shark or fish | `fish`, whose preset already has the fins: override its parts `dorsal` (`fin.dorsal`) and `tailfin` (`fin.tail`, `"shape": "forked"`) and its limbs `pectoral` and `pelvic` by id (`"remove": true` drops the pelvic pair), and add `teeth.row` (see `examples/reef-shark.json`). Its fins already make it a swimmer, so it needs no `media`. Paired fins hold out flat, so check them in the `top` and `front` views |
| Spider or scorpion | `octopod`; `mandible` (`"shape": "fang"`) for a spider (see `examples/tomb-spider.json`); for a scorpion a slimmer even torso, `arm`s at `at` 0 with `lift` 80 and `"foot": "hand.pincer"`, a tail with `pitch` 60 and `curl` 160, a `horn.curved` stinger on its tip, and `pinch` and `lash` (see `examples/dune-scorpion.json`) |
| Centaur | `centaur`; give its legs `foreleg` and `hindleg` `"foot": "foot.hoof"`, its `arm`s `"foot": "hand.grasp"`, and the head horns |
| Turtle or tortoise | `quadruped` with a `wide` torso and `{ "id": "shell", "type": "shell", "params": { "dome": 0.95, "overhang": 0.28 } }`, short legs with `foot.pad` (see `examples/stone-tortoise.json`); for a sea turtle remove `foreleg` and `hindleg` (`"remove": true`) and add fin limbs with `"membrane": null` (flippers; `length` 0.4 or more so they beat), which make it a swimmer (see `examples/sea-turtle.json`) |
| Two-tailed fox | `quadruped` with `"tail": { "count": 2, "spread": 22, "pitch": 12, "curl": 35 }` (raised, like a kitsune's), `"foot": "foot.paw"` on both leg pairs and `"skin": { "fur": {} }` (examples/two-tailed-fox.json) |
| Griffin | `quadruped`; `beak`, `{ "role": "wing", "membrane": "membrane.feather" }`, `foot.talon` on the forelegs and `foot.paw` on the hindlegs, fur (see `examples/griffin.json`) |
| Moth | `hexapod`; two wing pairs with their own ids, `forewing` at `at` 0.15 and `hindwing` at 0.3, each with `membrane.insect` (`"shape": "broad"` and `"round"`), `spots` with `ring` and `"region": "wings"` for eye spots (see `examples/luna-moth.json`); `antenna` with `"shape": "feather"`, fur on the torso. A moth cannot bite: `"head": { "jaw": false }` drops the jaw, and with it `bite` and `roar` |
| Beetle with wing cases | `hexapod` with a deep abdomen (more torso `radius` points); `{ "id": "case", "role": "wing", "attach": { "on": "torso", "at": 0.5, "angle": 6 }, "length": 0.5, "segments": 2, "membrane": "membrane.case" }` and a `wing` just behind it (`at` 0.53) with `membrane.insect` (`"shape": "round"`), which folds away under the case (see `examples/rhino-beetle.json`) |
| Slug or snail | `serpent` with a short tail, a thicker torso (the preset is a thin snake) and `"material": "skin"`; eyes on stalks: a tentacle pair on the `head` (`length` 0.3, 4 segments, `radius` 0.025 or more) with `eye.basic` on it at `at` 1 and a `size` of about 0.05 (`scale` is relative to what it sits on, so on a thin stalk the eyes come out as dots); `slime` |
| Stegosaur, sail-back, porcupine | `plates.row`, `sail` or `quills` along the `spine` (see `examples/plated-stegosaur.json`, `sail-back.json`, `porcupine.json`) |
| Frilled lizard or cobra | `frill` or `hood` on the `neck`, and `display` in `motion.actions` (it needs one of them; see `examples/frilled-lizard.json`, `hooded-cobra.json`) |

## Format versions

`format` carries the version. Every command reads older blueprints by upgrading them first,
step by step, with a `migrated` warning per step; commands that write a blueprint (`patch`,
`mutate`, `crossbreed`, `instantiate`) write the current format. To keep a saved file current,
`spawnforge migrate creature.json` (MCP: `migrate`) upgrades it in place and lists each step
(`--out` writes elsewhere, `--dry-run` only reports). The steps so far:

| From | To | What changed |
| --- | --- | --- |
| `bestiary/0.1` | `spawnforge/0.1` | The project's working name; nothing else |
| `spawnforge/0.1` | `spawnforge/0.2` | Plan 2's vocabulary is added; no 0.1 field changes meaning |
