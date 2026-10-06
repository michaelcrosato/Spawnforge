# Changelog

Versions of the packages (`@spawnforge/core`, `modules`, `three`, `cli`, `mcp`, `render`), which
move together. Nothing is published yet: the packages stay `private` until release 0.2
(milestone 12.3 of [plan 2](docs/plan-2.md)) and the owner's go-ahead, and their license is the
owner's choice (`UNLICENSED` until then). Blueprint format changes are in
[docs/blueprint.md](docs/blueprint.md#format-versions); every command reads older formats.

## Unreleased

Work in progress toward 0.2, phase by phase (see the plan's status table).

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
