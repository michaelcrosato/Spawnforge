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

Format 0.2 already holds everything plan 2 adds (wings, fins, tentacles, several heads and tails,
shells, quills, fur, swimming and flying, …), but most of it is not drawn yet. A blueprint may use
all of it: it validates, and `validate` lists what is not drawn yet under `notBuilt`, with the
milestone that builds it. **Keep those features**; they appear once built. [Not drawn
yet](#not-drawn-yet) has the list; in the [catalogue](catalog.md) a milestone in brackets marks
a module that is not drawn yet.

## Units and directions

- **`scale` is the torso length in metres.** Every other length and radius in the blueprint is a
  multiple of it, so a `"length": 0.5` leg on a `"scale": 2` creature is 1 m long. Resize a whole
  monster by changing `scale`.
- **Sizing.** With the presets' proportions, an upright biped stands about 2.5 × `scale` tall (a
  2 m giant is `scale` 0.8), a quadruped is about 2.2 × `scale` from snout to tail tip and 0.75 ×
  `scale` tall (a wolf is about 0.7), a hexapod is about 1.3 × `scale` long, and a serpent about
  3.5 × `scale`. A fish is about 2 × `scale` long (a 1.8 m reef shark is `scale` 0.9), a centaur
  2 × `scale` long and 1.55 × `scale` tall to the top of its head, a wyvern 3.2 × `scale` from
  snout to tail tip, and an octopod 1.4 × `scale` long and 1.5 × `scale` across its legs. Longer
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
every head a copy. `"tail": { "count": 2 }` gives two tails (`spread`, 20° per extra tail);
`"forkAt": 0.7` makes one tail fork 70% of the way along instead of the tails leaving the torso
separately. _(Built in milestone 9.1.)_

**Neck shape, muscle and head details.** `neck.curve` (degrees) bends the neck into an S: forward
at the base and back up below the head, like a swan or a rearing cobra (a C on necks of fewer than
3 segments). `body.muscle` (0 to 1, default 0.5) sets how muscled the body is, and
`limbs[].muscle` overrides it per limb: thighs and upper arms fill out, calves and forearms
less, and each tapers into a narrower knee, elbow, ankle or wrist (stocky legs stay columns); the
torso gets a chest, hips and (unless it stands upright) a waist from the limbs on it, the neck a
muscle into the shoulders and a tail a thick base. Chitin limbs swell between their joints instead, and
legless bodies get a flatter belly and a throat behind the head. `0` gives smooth tubes, `1` a
heavily built body. `head.lips` (0–1),
`head.tongue` (`none`, `flat` or `forked`) and `head.brow` (0–1) shape the mouth and the brow
(_8.3_).

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
| `wing` | Folds at rest, beats in the air (_9.3_) | `membrane`, `foot` (the wrist claw) | `at` 0.2, `angle` 40, `length` 1.2, `membrane.bat` |
| `fin` | Steers and beats in water (_9.3_) | `membrane` | `at` 0.25, `angle` 115, `length` 0.35, 2 segments, `membrane.fin` |
| `tentacle` | A long spring chain that curls and reaches (_9.4_) | `curl`, `curlStart`, up to 16 `segments` | `at` 0.9, `angle` 150, `length` 1.5, 10 segments |

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
  `"foot": null` ends the limb in a stump. _(The new feet are built in 8.2, pincers in 9.4.)_
- **`stance`** (legs): `plantigrade` (on the whole sole, like a bear), `digitigrade` (on the toes,
  like a dog) or `unguligrade` (on hoof tips, like a horse). Left out, the foot suggests one (_8.2_).
- **Wings and fins** carry a `membrane`, set like a foot: `membrane.bat` (leathery, between finger
  bones), `membrane.insect` (thin veined plates), `membrane.feather` (flight feathers),
  `membrane.case` (a beetle's hard wing case, which covers the wing behind it) and `membrane.fin`
  (rays and skin). A flipper is a fin with `"membrane": null`. A bat membrane's trailing edge runs
  to the nearest leg behind the wing, or to the body (`trailing`).
- **Tentacles** take `curl` (degrees of rest curl, toward the belly; negative curls toward the
  back) and `curlStart` (the straight share before it). For eight tentacles write four entries
  with `side: "both"` at different `angle`s. On the torso at its default `at` 0.9 they trail
  behind, like a squid's; `"attach": { "on": "head" }` rings the mouth. Fins or tentacles on the
  torso make a legless body a swimmer (see `media`); on the head they do not, so a tentacle pair
  on the head with an `eye.basic` at `at` 1 makes eyes on stalks for a slug that stays on land.
- Typical lengths: a dog-like quadruped's legs are 0.5–0.6 torso lengths, an upright biped's legs
  1–1.6, insect legs 0.6–0.8 with `splay` 55, a dragon's wings 1.2–1.8.

## Parts

Parts are hard pieces snapped onto the skin, each a module with its own `params` object. Where a
part sits depends on its slot (shown in `describe_module`):

| Slot | Placement | Parts |
| --- | --- | --- |
| surface | `at` and `angle` on `on` | `horn.curved`, `ear.pointed`, `eye.basic`, `antenna`, `fin.dorsal`, `fin.tail`, `frill`, `hood` |
| row | copies from `from` to `to` | `spikes.row`, `plates.row`, `sail` |
| mouth | along the mouth line; needs `head.jaw` | `teeth.row`, `beak`, `mandible` |
| area | over an `area` of `on` (`back`, `belly`, `sides` or `all`), optionally `from` and `to` | `shell`, `armor.bands`, `quills` |
| foot | a limb's `foot` field, not `parts` | `foot.claw`, `foot.hoof`, `foot.paw`, `foot.talon`, `foot.pad`, `hand.grasp`, `hand.pincer` |
| membrane | a wing's or fin's `membrane` field, not `parts` | `membrane.bat`, `membrane.insect`, `membrane.feather`, `membrane.case`, `membrane.fin` |

Fins come two ways: paired fins (pectoral fins, flippers) are limbs with `"role": "fin"`, and
fins on the midline are parts: `fin.dorsal` stands at one point on the back, `fin.tail` sits on
the tail tip. Area parts carry their own placement, so `{ "id": "shell", "type": "shell" }` alone
covers the back of the torso; `area` is only for them (skin layers use `region`).

Parameters go inside `params`: `{ "id": "horns", "type": "horn.curved", "params": { "length": 0.3 } }`.
Each part has a default anchor, so `{ "id": "teeth", "type": "teeth.row" }` is complete.

A row's `count` is per row: a `spikes.row` with `side` "both" makes two rows of `count` spikes,
while `plates.row` is one centred part whose `count` plates alternate left and right
(`alternate`). A part on something that is not drawn yet (a wing, a tentacle) is not drawn
either; `validate` lists it under `notBuilt` with its host.

### Recipes

These were checked against renders (`render` with `labels: true` shows where every part landed).
All lengths are in torso lengths.

| Look | Part |
| --- | --- |
| Ram horns, coiled beside the head | `horn.curved` on `head`, `at` 0.8, `angle` 40; `length` 0.65, `width` 0.05, `curve` 400, `turn` -35, `lean` -10, `ridges` 12 (on an upright biped's head: `at` 0.6, `angle` 85, `turn` -70, `lean` 10) |
| A cobra rearing up | `serpent` with `neck` `pitch` 75 and `length` about 1, and `torso` and `tail` `pitch` 0–1 so the body lies flat (higher values lift the tail tip off the ground and sink the torso). For a hood give the neck `crossSection` "wide" and a radius profile that swells and narrows, such as `[0.09, 0.15, 0.07]`, starting no wider than the torso's first radius |
| Bull horns, out then forward | `horn.curved` on `head`, `at` 0.85, `angle` 75; `length` 0.3, `width` 0.04, `curve` -70 |
| Rhino nose horn | `horn.curved` on `head`, `at` 0.12, `angle` 0; `length` 0.22, `width` 0.05, `curve` 25 (add a smaller one at `at` 0.4) |
| Tusks from the lower jaw | `horn.curved` on `jaw`, `at` 0.25, `angle` 60; `length` 0.16, `width` 0.025, `curve` -60, pale `color` and `tipColor` |
| Insect mandibles | `horn.curved` on `head`, `at` 0.06, `angle` 110, `side` "both"; `length` 0.25, `width` 0.03, `curve` 60, `aim` "forward", dark colours. They point forward and curve in toward each other, on any head size |
| Horns swept back along the head | `horn.curved` on `head`, `at` 0.8, `angle` 50; `length` 0.4, `curve` 50, `aim` "back" |
| Spikes down the whole back | `spikes.row` on `spine`, `from` 0.1, `to` 0.95, `angle` 0; a `height` profile such as `[0.06, 0.12, 0.05]` |
| A stinger on the tail tip | `horn.curved` on `tail`, `at` 0.97, `angle` 0; `length` 0.14, `width` 0.025, `curve` 60, a dark `color` |
| Pointed ears | `ear.pointed` on `head`, `at` 0.85, `angle` 45; `length` 0.14, `width` 0.05 (`droop` 0.8 and `angle` 70 for hanging ears) |

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
- **`material`** is the surface under the patterns: `skin`, `scales`, `chitin` or `hide` (thick
  and creased, _8.4_).
- **`fur`** grows a coat over the material: `"fur": { "length": 0.03, "density": 0.8, "region":
  ["torso", "limbs", "tail"] }` (`length` in torso lengths, 0.002–0.3, default 0.03; `density`
  0–1, default 0.8; `region` one layer region or a list, default `all`), so a griffin can have a
  furry body and a bare head. Fur takes the colours of the skin under it (palette and layers), so
  stripes and spots show through. `"fur": {}` is a full coat; `null` removes an inherited one
  (_8.4_). Fur with `region` `all` leaves wing and fin membranes bare.
- **`layers`** is the pattern stack, bottom first: `countershade`, `stripes`, `spots`, `mottle`,
  `scales` and `grime`, and from 8.4 `scars`, `bioluminescence`, `slime`, `warts`, `veins`,
  `rosettes` and `bands`. A layer's parameters sit beside its `type`. Every layer also takes
  **`region`** (`all`, `back`, `belly`, `head`, `torso` (which includes the neck), `limbs` (every
  limb, a wing's arm bones too), `tail` or `wings`, which covers wing and fin membranes) and
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
  pixels fade out instead of flickering, so on a small creature seen from afar, `scales` and
  `spots` at their default sizes read as plain skin; use a `size` of 0.08–0.15 there.
- On a creature with no legs, `countershade` at its default height gives the pale belly of a
  snake; raise `height` toward 0 to pale the flanks too.

Patterns follow the body: stripes run across the spine, bellies come out paler, and nothing slides
when the creature moves.

## Motion

- **`temperament`**: `calm`, `stalking`, `skittish`, `aggressive` or `lumbering`. It sets the
  walking pace, how fast it turns, a crouch and a lowered head for stalkers, and idle behaviour.
- **Speed is chosen at run time** by whatever moves the creature (a game, or the sandbox).
  Stride length and timing scale with leg length and speed (bigger creatures step more slowly),
  and four-legged creatures switch from walk to trot as they speed up.
- **`media`**: where the creature moves, as switches `land`, `water` and `air`. Left out, each
  follows the body: `land` with legs (or no legs and no fins or tentacles on the torso), `water`
  for a body with fins or tentacles on the torso and no legs, `air` with wings. Switches merge
  over that:
  `"media": { "water": true }` adds swimming to a walker (_10.3_), `{ "air": false }` grounds a
  winged one; flying needs a wing limb (_10.4_).
- **`gaits`** are worked out from the body and its media, so you rarely need to list them. On
  land each suits a leg count: `walk` (any legs), `trot` (2 pairs), `tripod` (3 pairs), `slither`
  (no legs), and from 10.1 `run` (2 legs), `gallop` and `bound` (4 legs). In water (_10.3_):
  `swim.undulate`, `swim.paddle`, `swim.flap`; in the air (_10.4_): `fly`, `glide`, `hover`
  (insect wings). Leave the field out to use every gait that suits the body; a list replaces
  the defaults only for the media its gaits serve, so `["walk"]` on a dragon still flies. A
  gait's parameters sit beside its `type`:
  - `stride` multiplies the natural stride length, but a foot can only travel as far as its leg
    reaches, so on short or sprawled legs large values change nothing (the legs step faster
    instead). Long, nearly straight legs take the longest strides.
  - `duty` is the share of the cycle each foot is planted. Above 0.5 a biped walks; below 0.5
    it runs, with moments where no foot touches the ground: a raptor's sprint is
    `{ "type": "walk", "duty": 0.4 }` (0.4 is the lowest).
  - Each gait covers a range of speeds for the leg length (Froude number v²/(g·hip) up to 0.5
    for `walk`, 1.5 for `trot`), so `stride` does not raise the top speed. A biped's top speed is
    about √(0.5·9.8·hip), 2.1 m/s for a 0.9 m hip; `analyze` reports it as `speed.max`. Running
    and galloping arrive with milestone 10.1.
  - `stepHeight` lifts the feet higher (a share of hip height); `slither` takes `amplitude` and
    `waves` for the shape of its S-curve.
- **`actions`**: what the creature can do when asked. `bite` and `roar` need a jaw, `look`
  needs a head, `idle` needs nothing; later milestones add `jump` and `pounce` (_10.2_), `pinch`
  (a pincer) and `lash` (a tail or tentacle, _9.4_), and `display` (opens frills and hoods, raises
  quills and sails, _9.5_). Some actions need what a module provides rather than a section:
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
- **Check everything else with `analyze`**: it measures the creature (size, mass, centre of mass,
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
(a cobra) turns at its base unless `neck.curve` gives it an S; feet are clawed toes or stumps
(hooves, paws and pads arrive in _8.2_); and the head
stays level while walking, by design. For sprawled legs, an attach `angle` around 110–120 keeps
the legs clear of the body as they swing; angles past about 150 bring both legs under the belly.
Big eyes need a large `size` (0.06–0.1 for cartoon eyes).

## Editing with patch

`patch` changes a blueprint file in place by id-based paths and prints a short diff; the file is
only written when the result is valid. Operations: `set` (a value), `add` (an item to a list
such as `parts` or `skin.layers`), `remove` (a key, back to its default, or a limb or part;
inherited ones get `"remove": true`), `mirror` (make a limb or part a pair, or set its `side`)
and `scale` (multiply a number or a profile by `by`; path `""` scales the whole creature). Paths
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
shift, and now and then an enum flips or a part is added, removed or swapped for one with the
same slot and a shared tag (eyes and ears are never touched). `amount` (0 to 1) is how many genes
change and how far; values of zero stay zero, so a tailless creature does not sprout a tail.
`locked` paths, such as `skin`, `body.head`, `parts[id=horns]` or `skin.layers[type=stripes]`,
never change; a lock that matches nothing comes back as an `unknown_lock` warning. Palette colours
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
chance. `mix` 0 or 1 copies a parent; in between, each gene's share wobbles a little around
`mix`. Posture blends too (torso and neck pitch), so to keep one parent's body, build on it with
`--base a` and lock what must not change: `--lock body.torso,limbs`. The result says which parent
it is built on (`base`) and diffs against it.

**Generate.** `generate` (CLI `spawnforge generate --theme reptile --seed 4`) builds a new
creature from a theme module (`list_modules` with kind `theme`: `reptile`, `insect`, `demon`).
The theme weights the body plan and narrows the proportions, optional parts, patterns, palette,
material and temperament; the same theme and seed always give the same creature. Constraints
narrow it further: `--body-plan biped`, `--max-height 1.2` and `--min-height 0.5` (body height in
metres, not counting horns or spikes, the same as `analyze`'s `bodyHeight`; its `height` counts
them; the creature is rescaled to fit), `--actions bite,roar` (it gets a body that can; the file
leaves `motion.actions` out, which means every action the body allows) and `--parts
horn.curved`. Generated blueprints are ordinary blueprints: edit them
with `patch`, or `mutate` and `crossbreed` them. In the sandbox, the breed tab does all three.

## Validation

`validate` returns `ok`, `errors`, `warnings` and the **minimal blueprint**: the same creature
with every value that equals the preset or a default removed. Validation never changes your file;
the minimal blueprint is there to show what actually differs from the preset. Each issue has:

- `path`, id-based, e.g. `limbs[id=hindleg].attach.at`
- `message`, e.g. `1.4 is outside 0–1`
- `expected`, the valid range or values
- `fix`, e.g. `did you mean "length"?`, `move "length" into "params"` or, for a value that
  belongs to a neighbouring field, `"wide" is a crossSection, not a shape`

`notBuilt`, when present, lists what the blueprint uses that the format has but the pipeline
does not draw yet, each with the milestone that builds it. It is neither an error nor a warning:
keep those features. It names what the blueprint (or its preset) writes, so a stance the foot
implies or swimming that fins imply is not listed on its own: the foot or the fin is. A part on a
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

Everything format 0.1 had is drawn today: legs and arms, `foot.claw`, horns, ears, eyes, teeth,
spike rows, the skin, scales and chitin materials, the first six pattern layers, walking,
trotting, the tripod gait, slithering, and the bite, roar, look and idle actions. Everything in
this table validates but is **not drawn yet**: compile skips it, and `validate` lists it under
`notBuilt`. Each row goes when its milestone lands. Until then, approximate with what exists if
you need to see it: horns for mandibles and stingers, a spike row for a frill or plates, a wide
neck for a cobra's hood (see the recipes).

| Not drawn yet | Milestone that draws it |
| --- | --- |
| `foot.hoof`, `foot.paw`, `foot.talon`, `foot.pad`, `hand.grasp`, `stance` | 8.2 |
| `head.lips`, `head.tongue`, `head.brow`, `beak` | 8.3 |
| `hide`, `fur`, the new pattern layers | 8.4 |
| Several heads and tails (`count`, `spread`, `forkAt`) | 9.1 |
| Wings, fins, membranes, `fin.dorsal`, `fin.tail` | 9.3 |
| Tentacles, `antenna`, `mandible`, `hand.pincer`, `pinch`, `lash` | 9.4 |
| `shell`, `armor.bands`, `quills`, `plates.row`, `frill`, `hood`, `sail`, `display` | 9.5 |
| `run`, `gallop`, `bound` | 10.1 |
| `jump`, `pounce` | 10.2 |
| Swimming (`media.water`, `swim.*`) | 10.3 |
| Flying (`media.air`, `fly`, `glide`, `hover`) | 10.4 |

### Recipes for the new bodies

These say how plan 2's bodies are written; they validate today and take shape as their
milestones land.

| Creature | Blueprint |
| --- | --- |
| Dragon | `quadruped` plus `{ "id": "wing", "role": "wing", "length": 1.5 }`; horns with `aim` "back"; `"material": "scales"` |
| Wyvern | `wyvern` (its wings are its forelimbs); a stinger as in the recipe above |
| Bat | `wyvern` with bat proportions: `"neck": { "length": 0.15 }`, `"tail": { "length": 0.3 }`, short legs (`length` 0.4) set back (`at` 0.85), `"head": { "shape": "snout" }`; wings `length` 2 with `"membrane": { "type": "membrane.bat", "fingers": 5 }`, big `ear.pointed`, and fur with `"region": ["head", "torso", "limbs"]` |
| Hydra or cerberus | `quadruped` with `"neck": { "count": 5, "length": 0.9 }` (or 3 with `length` 0.4 for a cerberus); parts on `head` appear on every head |
| Kraken | No `extends`; a round torso, `"tail": { "length": 0 }`, four `tentacle` entries with `side` "both" at `at` 0.9 and `angle`s 60, 100, 130 and 160 (they trail like a squid's; on the `head` they ring the mouth) |
| Shark or fish | `fish`, whose preset already has the fins: override its parts `dorsal` (`fin.dorsal`) and `tailfin` (`fin.tail`, `"shape": "forked"`) and its limb `pectoral` by id, and add `teeth.row`; `scale` 0.9 for a 1.8 m reef shark |
| Spider or scorpion | `octopod`; `mandible` (`"shape": "fang"`) for a spider; for a scorpion arms with `"foot": "hand.pincer"` and a tail with `curl` 200 |
| Centaur | `centaur`; give its legs `foreleg` and `hindleg` `"foot": "foot.hoof"`, its `arm`s `"foot": "hand.grasp"`, and the head horns |
| Turtle | `quadruped` with `{ "id": "shell", "type": "shell" }`, its `foreleg` and `hindleg` removed (`"remove": true`) and fin limbs with `"membrane": null` (flippers) instead; fins and no legs make it a swimmer |
| Two-tailed fox | `quadruped` with `"tail": { "count": 2 }`, `"foot": "foot.paw"` on both leg pairs and `"skin": { "fur": {} }` |
| Griffin | `quadruped`; `beak`, `{ "role": "wing", "membrane": "membrane.feather" }`, `foot.talon` on the forelegs and `foot.paw` on the hindlegs, fur with `"region": ["torso", "limbs", "tail"]` |
| Moth | `hexapod`; two wing pairs with their own ids, `forewing` at `at` 0.15 and `hindwing` at 0.3, each with `membrane.insect` (`"shape": "broad"`); `antenna` with `"shape": "feather"`, fur on the torso |
| Slug or snail | `serpent` with a short tail and `"material": "skin"`; eyes on stalks: a tentacle pair on the `head` (`length` 0.3, 4 segments) with `eye.basic` on it at `at` 1; `slime` |
| Stegosaur, sail-back, porcupine | `plates.row`, `sail` or `quills` along the `spine` |
| Frilled lizard or cobra | `frill` or `hood` on the `neck`, and `display` in `motion.actions` (it needs one of them) |

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
