# Spawnforge

Procedural 3D monsters from short JSON blueprints. A blueprint (body plan, limbs, parts, skin,
behaviour) plus a seed becomes a finished creature: mesh, skeleton, textures and animation, all
made by code. The same blueprint and seed give the same monster every time.

- **Spore-style bodies.** A skeleton graph wrapped in a smooth signed-distance-field skin, with
  horns, claws, teeth and eyes as procedural meshes snapped onto it.
- **Computed animation.** Gaits come from whatever legs a creature has, feet are placed with
  inverse kinematics, and tails swing on springs.
- **Modular.** Every part, pattern, gait and action is one self-registering module file.
- **LLM-first.** A described schema, semantic attachment, structured errors, a CLI, an MCP server,
  and renders a model can look at to check its own work.

```json
{
  "format": "spawnforge/0.1",
  "name": "Ridgeback Stalker",
  "seed": 4127,
  "extends": "quadruped",
  "parts": [
    { "id": "horns", "type": "horn.curved", "attach": { "on": "head", "at": 0.75, "angle": 40 } }
  ]
}
```

The full example is [examples/ridgeback-stalker.json](examples/ridgeback-stalker.json).

## Status

Repository scaffold. The design is in [docs/plan.md](docs/plan.md); phase 0 (blueprint format,
registry, `validate`, format eval) is next. The sandbox currently shows a placeholder body to
prove the Three.js and TSL setup end to end.

## Getting started

Needs Node 22.18 or later and pnpm 10 (`corepack enable` selects the pinned version).

```sh
pnpm install
pnpm dev        # sandbox at http://localhost:5173
pnpm check      # lint, typecheck and tests
```

## Layout

```text
packages/
  core/      blueprint schema, registry, RNG, compile pipeline, motion, analysis (no DOM)
  three/     Three.js runtime: skinned mesh, TSL materials, pose sync, export
  modules/   first pack: body plans, parts, patterns, gaits, actions
  cli/       command line and headless renderer
  mcp/       MCP server over the CLI functions
apps/
  sandbox/   viewer, sliders, JSON panel, terrain test course, gallery
examples/    blueprints beside their renders (also the golden test set)
docs/        plan, architecture, blueprint format
```

## Docs

- [AGENTS.md](AGENTS.md): repo map, commands and rules, for agents and people
- [docs/plan.md](docs/plan.md): the design and milestones
- [docs/architecture.md](docs/architecture.md): layers, package boundaries and data flow
- [docs/blueprint.md](docs/blueprint.md): the blueprint format
