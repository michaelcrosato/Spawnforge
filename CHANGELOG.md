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
