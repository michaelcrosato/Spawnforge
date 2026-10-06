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
- **Sizing.** With the presets' proportions, an upright biped stands about 2.5 × `scale` tall (a
  2 m giant is `scale` 0.8), a quadruped is about 2.2 × `scale` from snout to tail tip and 0.75 ×
  `scale` tall (a wolf is about 0.7), a hexapod is about 1.3 × `scale` long, and a serpent about
  3.5 × `scale`. Longer legs, necks and tails change these, so check the size line on a render.
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
| `spine` | head end of the neck | tail tip | Not a real section: a path through neck, torso and tail for rows "along the whole back". |

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
| surface | `at` and `angle` on `on` | `horn.curved`, `ear.pointed`, `eye.basic` |
| row | copies from `from` to `to` | `spikes.row` |
| mouth | along the mouth line; needs `head.jaw` | `teeth.row` |
| foot | a limb's `foot` field, not `parts` | `foot.claw` |

Parameters go inside `params`: `{ "id": "horns", "type": "horn.curved", "params": { "length": 0.3 } }`.
Each part has a default anchor, so `{ "id": "teeth", "type": "teeth.row" }` is complete.

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
| Insect mandibles | `horn.curved` on `head`, `at` 0.08, `angle` 100; `length` 0.2, `width` 0.025, `lean` 60, `curve` 110, `turn` 90, dark colours (on a big head: `at` 0.04, `angle` 80, `lean` 90, `length` 0.3) |
| Spikes down the whole back | `spikes.row` on `spine`, `from` 0.1, `to` 0.95, `angle` 0; a `height` profile such as `[0.06, 0.12, 0.05]` |
| A stinger on the tail tip | `horn.curved` on `tail`, `at` 0.97, `angle` 0; `curve` 60 |
| Pointed ears | `ear.pointed` on `head`, `at` 0.85, `angle` 45; `length` 0.14, `width` 0.05 (`droop` 0.8 and `angle` 70 for hanging ears) |

For `horn.curved`: the horn grows straight out of the skin, then bends by `curve` degrees,
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
  `darkolivegreen`).
- **`material`** is the surface under the patterns: `skin`, `scales` or `chitin`.
- **`layers`** is the pattern stack, bottom first: `countershade`, `stripes`, `spots`, `mottle`,
  `scales` and `grime`. A layer's parameters sit beside its `type`. Every layer also takes
  **`region`** (`all`, `back`, `belly`, `head`, `torso`, `limbs` or `tail`) and **`strength`**
  (0 to 1). A region only masks where the layer shows; the pattern itself is laid out over the
  whole body, so `stripes.count` counts stripes from snout to tail tip whatever the region.
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
- **`gaits`** are worked out from the legs, so you rarely need to list them. Each suits a leg
  count: `walk` (any legs), `trot` (2 pairs), `tripod` (3 pairs), `slither` (no legs). Leave the
  field out to use every gait that suits the body. A gait's parameters sit beside its `type`:
  - `stride` multiplies the natural stride length, but a foot can only travel as far as its leg
    reaches, so on short or sprawled legs large values change nothing (the legs step faster
    instead). Long, nearly straight legs take the longest strides.
  - `duty` is the share of the cycle each foot is planted. Above 0.5 a biped walks; below 0.5
    it runs, with moments where no foot touches the ground: a raptor's sprint is
    `{ "type": "walk", "duty": 0.4 }` (0.4 is the lowest).
  - Each gait covers a range of speeds for the leg length (Froude number v²/(g·hip) up to 0.5
    for `walk`, 1.5 for `trot`), so `stride` does not raise the top speed. A biped's top speed is
    about √(0.5·9.8·hip), 2.1 m/s for a 0.9 m hip; `analyze` reports it as `speed.max`. Running
    and galloping gaits are not in this version.
  - `stepHeight` lifts the feet higher (a share of hip height); `slither` takes `amplitude` and
    `waves` for the shape of its S-curve.
- **`actions`**: what the creature can do when asked. `bite` and `roar` need a jaw, `look`
  needs a head, `idle` needs nothing. Leave the field out to get every action the body allows.
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
- **Contact sheet options**: `--views 3/4,side,head,front,top,rear` picks the panels, `--size px`
  sets the image width, `--quality low|medium|high` the mesh detail, and `--labels` tags every
  part and limb by id. Spots and scales on a small creature (under about half a metre) are only a
  few pixels across on the default sheet; check them with `--views top,3/4 --size 900 --quality
  high`. Pattern sizes are in torso lengths, so on a creature with a very long tail a few large
  spots can land mostly on the tail: use smaller spots, or a second layer with `region`.
- **Check everything else with `analyze`**: it measures the creature (size, mass, centre of mass,
  hip height, speeds per gait, bite reach, balance over the feet), runs two gait cycles on flat
  and rough ground, and warns, with a path and a fix, about sliding feet, a body or tail in the
  ground, legs stretched past their reach, limbs passing through each other or the body, parts
  buried in the skin, eyes facing backwards and a centre of mass outside the feet. Fixes give
  amounts where they can (`about 10° more splay`); a leg that hits the body during the swing also
  clears with a smaller gait `stride` or `stepHeight`. It also writes a one-paragraph description
  (size, proportions, parts, colours, gaits): read it to check the creature is what you meant.

What the body model does not do yet: a section bends only as a whole, so a neck raised steeply
(a cobra) turns at its base rather than in an S; legs are tubes without hooves; and the head
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
  "format": "spawnforge/0.1",
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
- `fix`, e.g. `did you mean "length"?` or `move "length" into "params"`

Validation reports every problem it can find in one pass, so fix them all before validating
again. A few mistakes (an unknown preset, a list where an object belongs) hide the checks that
depend on them, so a second pass can find more. Unknown keys are always errors, never silently
dropped.

Compiling and rendering can add warnings that only show once the body is built, such as
`below_ground` when a drooping tail or head sinks into the floor. They have the same fields and
name the section to change.

## Not in this version

Wings, fins, tentacles, shells, armour plates, quills, antennae, frills, multiple heads and
branching tails are planned but not available yet (see the scope table in [plan.md](plan.md)), and
there are no dedicated mandible parts. Approximate them with what exists, as the recipes above
do: horns for mandibles and stingers, a spike row for a frill. Skins are smooth: there is no fur
yet, so a furry animal reads best with a soft `mottle` and a `countershade`.

## Format versions

`format` carries the version. Older blueprints are migrated automatically, with a warning:
`bestiary/0.1` (the project's working name) is read as `spawnforge/0.1`.
