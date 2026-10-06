# Blueprint format

A blueprint is a short JSON document that says what a monster is, in body-relative terms. A
blueprint plus its `seed` always produces the same creature. This guide explains every concept;
[catalog.md](catalog.md) lists every field and module with exact ranges and defaults, and
[blueprint.schema.json](blueprint.schema.json) is the JSON Schema.

## Quick start

```json
{
  "format": "spawnforge/0.1",
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

## Units and directions

- **`scale` is the torso length in metres.** Every other length and radius in the blueprint is a
  multiple of it, so a `"length": 0.5` leg on a `"scale": 2` creature is 1 m long. Resize a whole
  monster by changing `scale`.
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

`pitch` on the neck, head and tail is measured from horizontal, whatever the torso does: a neck
with `"pitch": 30` rises at 30°, and a head with `"pitch": 0` looks straight ahead. On an upright
biped, give the neck a pitch near the torso's (about 80) and keep the head near 0.

`crossSection` makes a section `round`, `tall` (narrow and deep, like a fish) or `wide` (flat and
broad, like a beetle).

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

`extends` starts from a body plan: `biped`, `quadruped`, `hexapod` or `serpent`.
`describe_module` (or the catalogue) shows each preset with the ids you can edit. The blueprint is
merged on top of the preset:

- Objects merge field by field: `"body": { "tail": { "length": 1.2 } }` changes only the tail length.
- `limbs` and `parts` merge **by id**: an item whose id matches a preset item changes only the
  fields it gives; a new id adds an item; `{ "id": "eyes", "remove": true }` deletes an inherited
  one.
- Every other list (profiles, `layers`, `gaits`, `actions`) replaces the inherited list.

So to make a quadruped's back legs longer, write only
`"limbs": [{ "id": "hindleg", "length": 0.8 }]`.

Without `extends`, a blueprint starts from defaults: a bare torso, neck, head and tail with no
limbs.

## Limbs

Limbs are legs (`"role": "leg"`, they carry the body) or arms (`"role": "arm"`, they are free for
actions). Each has a total `length`, 2 to 4 `segments` (bones from hip or shoulder to ankle), a
`radius` profile from root to tip, and a `foot`.

- **Legs come in mirrored pairs** (`side: "both"`), up to 6 pairs. Legs are ordered from the back;
  where they attach (`at`) decides the order.
- **`splay`** swings a limb out from under the body: 0 for upright walkers (dogs, horses), around
  50–60 for sprawlers (insects, lizards).
- **`angle`** on a limb's `attach` is where around the torso it starts; the default 100 is just
  below the side.
- **Feet**: `"foot": { "type": "foot.claw", "toes": 3 }` puts toes with claws on the tip; its
  parameters sit beside `type`. `foot.claw` also serves as a hand on arms. `"foot": null` ends the
  limb in a stump.
- Typical lengths: a dog-like quadruped's legs are 0.5–0.6 torso lengths, an upright biped's legs
  1–1.6, insect legs 0.6–0.8 with `splay` 55.

## Parts

Parts are hard pieces snapped onto the skin, each a module with its own `params` object. Where a
part sits depends on its slot (shown in `describe_module`):

| Slot | Placement | Parts |
| --- | --- | --- |
| surface | `at` and `angle` on `on` | `horn.curved`, `eye.basic` |
| row | copies from `from` to `to` | `spikes.row` |
| mouth | along the mouth line; needs `head.jaw` | `teeth.row` |
| foot | a limb's `foot` field, not `parts` | `foot.claw` |

Parameters go inside `params`: `{ "id": "horns", "type": "horn.curved", "params": { "length": 0.3 } }`.
Each part has a default anchor, so `{ "id": "teeth", "type": "teeth.row" }` is complete.

## Skin

- **`palette`** names colours. `base` (the main colour), `belly` and `accent` always exist; add
  others by name (`"hornTip": "#ffe0a0"`). Colours are `#rrggbb`, `#rgb` or CSS names (`tan`,
  `darkolivegreen`).
- **`material`** is the surface under the patterns: `skin`, `scales` or `chitin`.
- **`layers`** is the pattern stack, bottom first: `countershade`, `stripes`, `spots`, `mottle`,
  `scales` and `grime`. A layer's parameters sit beside its `type`. Every layer also takes
  **`region`** (`all`, `back`, `belly`, `head`, `torso`, `limbs` or `tail`) and **`strength`**
  (0 to 1).
- Colour parameters (`color`, and any field ending in `Color`) take a palette name such as
  `"accent"` or a colour.

Patterns follow the body: stripes run across the spine, bellies come out paler, and nothing slides
when the creature moves.

## Motion

- **`temperament`**: `calm`, `stalking`, `skittish`, `aggressive` or `lumbering`. It sets pace,
  posture and idle behaviour.
- **`gaits`** are worked out from the legs, so you rarely need to list them. Each suits a leg
  count: `walk` (any legs), `trot` (2 pairs), `tripod` (3 pairs), `slither` (no legs). Leave the
  field out to use every gait that suits the body.
- **`actions`**: `bite` and `roar` need a jaw, `look` needs a head, and `idle` needs nothing.

## Validation

`validate` returns `ok`, `errors`, `warnings` and the **minimal blueprint**: the same creature
with every value that equals the preset or a default removed. Each issue has:

- `path`, id-based, e.g. `limbs[id=hindleg].attach.at`
- `message`, e.g. `1.4 is outside 0–1`
- `expected`, the valid range or values
- `fix`, e.g. `did you mean "length"?` or `move "length" into "params"`

All problems are reported at once, so fix them all before validating again. Unknown keys are
always errors, never silently dropped.

## Not in this version

Wings, fins, tentacles, mandibles, shells, armour plates, quills, antennae, frills, multiple heads
and branching tails are planned but not available yet (see the scope table in
[plan.md](plan.md)). Approximate them with what exists, for example horns for mandibles or a spike
row for a frill.

## Format versions

`format` carries the version. Older blueprints are migrated automatically, with a warning:
`bestiary/0.1` (the project's working name) is read as `spawnforge/0.1`.
