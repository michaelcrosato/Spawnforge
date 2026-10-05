# Blueprint format

> **Draft for `spawnforge/0.1`.** This page restates the format from the plan. It becomes
> normative in phase 0, when the Zod schema lands; from then on the generated JSON Schema and
> `docs/catalog.md` are the source of truth for every field's default, range and unit.

A blueprint is a short JSON document that says what a monster is, in body-relative terms an LLM
can reason about. The same blueprint and seed always produce the same creature.

The worked example is [examples/ridgeback-stalker.json](../examples/ridgeback-stalker.json): a
complete, animated quadruped.

## Top-level fields

| Field     | Meaning                                                                                       |
| --------- | --------------------------------------------------------------------------------------------- |
| `format`  | Format id and version, `"spawnforge/0.1"`. Older blueprints are migrated automatically.        |
| `name`    | Display name.                                                                                 |
| `seed`    | Integer seed. Same blueprint and seed, same monster.                                          |
| `extends` | Body-plan preset to start from: `biped`, `quadruped`, `hexapod` or `serpent`.                 |
| `scale`   | Torso length in metres. Every other length and radius is a multiple of it.                    |
| `body`    | Main-axis sections: `torso`, `neck`, `head` (with optional `jaw`), `tail`.                    |
| `limbs`   | Legs and arms, each with an `id`, a `role`, an `attach` anchor, segments, radii and a foot.   |
| `parts`   | Hard parts snapped onto the skin (horns, spike rows, claws, teeth, eyes), each with a `type`. |
| `skin`    | A `palette` of named colours and an ordered stack of pattern `layers`.                        |
| `motion`  | `temperament`, the `gaits` it may use and the `actions` it can perform.                       |

## Rules

- **Relative units.** `scale` is the torso length in metres; every other length and radius is a multiple of it. Resize a monster by changing one number.
- **Attach by name, not coordinates.** `on` names a body section, limb or part. `at` runs 0 to 1: snout end to tail end on body sections, root to tip on limbs and parts; a row of parts uses `from` and `to`. `angle` is degrees around the section: 0 is the top (dorsal midline), 90 the part's own side, 180 the belly (ventral midline); on limbs, 0 is the limb's front face.
- **Symmetry by default.** `side` is `both` (the default), `left`, `right` or `center`. `both` makes a mirrored pair with stable ids such as `foreleg.L` and `foreleg.R`; angles of 0 and 180 default to `center`, so a spine row is never doubled.
- **Profiles.** A list of radii or heights is spread evenly along its section and smoothly interpolated; a single number means constant.
- **Presets and inheritance.** `extends` starts from a body-plan preset (biped, quadruped, hexapod, serpent), and `describe_module` shows each preset with its ids. Lists of objects merge by `id`: a matching id overrides field by field, a new id adds an item, and `"remove": true` deletes an inherited one. Other lists replace the inherited list.
- **Paths use ids, not indexes.** Errors and edits address items as written in the file, such as `limbs[id=hindleg].attach.at`, so merging and mirroring never shift what a path points at.
- **Strict, with defaults.** Unknown keys are errors with a "did you mean" fix, never silently dropped. Every parameter has a documented default, range and unit, so short blueprints are valid, and fixed-vocabulary fields (`head.shape`, `pupil`, `region`, `temperament`) are enums listed in the catalogue.
- **Lenient in, minimal out.** A few friendly forms (a single number for a profile, colour names) are normalized in a separate step. Tools return a short diff and the minimal blueprint (non-default values only); the fully expanded form comes only on request.
- **Ranges make species (phase 5).** Any number can be `{ "min": 0.5, "max": 0.7 }`; instancing with a seed picks a value, so one species yields endless individuals.
- **Versioned.** `format` carries the version, and old blueprints are migrated automatically so monsters keep working across games.
- **World conventions** follow glTF: metres, Y up, creature facing +Z.
## Errors

Every error and warning names an id-based path, the problem, the valid range and a suggested fix,
for example:

```text
limbs[id=hindleg].attach.at: 1.4 is outside 0–1
```

Beyond schema errors, validation reports plausibility warnings: legs that cannot reach the ground,
parts buried in the skin, eyes facing backwards, a centre of mass outside the feet.
