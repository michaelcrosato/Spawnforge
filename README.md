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
  "format": "spawnforge/0.2",
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

All seven phases of [the plan](docs/plan.md) are done, and the proof of concept passed its gate
([evidence](docs/poc.md)).

- **Format and tools** (phase 0): the blueprint format, the module registry, `validate` with
  id-based errors and fixes, the CLI and the MCP server.
- **Bodies and skin** (phase 1): skeleton, SDF skin, parts, eyes and layered TSL patterns, with
  six-view contact sheets from `render`.
- **Motion** (phases 2 and 3): gaits from any legs, foot IK on uneven ground, tails on springs,
  slithering, actions (bite, roar, look, idle) with events, and the sandbox editor (`pnpm dev`).
- **Checking and editing** (phase 4): `analyze` (measurements, motion checks, plausibility
  warnings, a description), `patch`, fuzzing, golden determinism and budgets.
- **Variation** (phase 5): species with ranges, `mutate`, `crossbreed`, and `generate` from a
  theme (`spawnforge generate --theme demon --seed 3`), also in the sandbox's breed tab.
- **Placing parts** (12.1): the sandbox's place tab puts a part where you click the creature,
  moves it where you drag it, and saves the blueprint to `creatures/`.
- **Gallery** (12.2): `pnpm gallery` serves a static site of curated creatures with live
  thumbnails, a viewer and downloads (`pnpm build` writes it to `apps/gallery/dist`).
- **Into games** (phase 6): `spawnforge export` writes a `.glb` with baked clips, texture maps
  (since 11.1: colour, relief, roughness, occlusion and glow, baked from the live material),
  sockets and stats, and `createBestiary` runs creatures live in a Three.js game
  ([docs/runtime.md](docs/runtime.md)).

At every gate a model using only the docs and tools did the prompt suites, and its creatures were
matched to their prompts in blind review ([eval/runs](eval/runs)). Release 0.2 completes
[plan 2](docs/plan-2.md): muscled anatomy, feet, heads and materials; wings, fins, tentacles,
shells, coverings and several heads and tails; running, jumping, swimming, flight, hits and
death; texture maps, levels of detail, crowds and guides for Godot, Unity, Unreal and Blender;
placing parts by clicking, and a gallery. Format `spawnforge/0.2` is frozen, and the packages
are ready to publish once the owner chooses a license.

![Ridgeback stalker](examples/ridgeback-stalker.png)

## Getting started

Needs Node 22.18 or later and pnpm 10 (`corepack enable` selects the pinned version).

```sh
pnpm install
pnpm dev        # sandbox at http://localhost:5173
pnpm check      # lint, typecheck and tests
pnpm spawnforge validate examples/ridgeback-stalker.json
```

`pnpm build` builds the sandbox as a static site in `apps/sandbox/dist`; `vercel.json` points
Vercel at it, so every push gets a preview. Outside the dev server the sandbox shows the examples
only (the live `creatures/` folder needs `pnpm dev`).

### Using it from an LLM

The MCP server exposes `list_modules`, `describe_module` and `validate`, plus the docs as
resources. With Claude Code:

```sh
claude mcp add spawnforge -- node packages/mcp/src/bin.ts
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
  gallery/   static site of curated creatures: viewer, blueprint and .glb downloads
  sandbox/   viewer, sliders, JSON panel, terrain test course, gallery, breeding, placing parts
examples/    blueprints beside their renders (also the golden test set)
docs/        plans, architecture, blueprint format
```

## Docs

- [AGENTS.md](AGENTS.md): repo map, commands and rules, for agents and people
- [docs/plan.md](docs/plan.md): the design and milestones
- [docs/plan-2.md](docs/plan-2.md): the next plan (phases 7 to 12), with an effort level per
  milestone
- [docs/architecture.md](docs/architecture.md): layers, package boundaries and data flow
- [docs/blueprint.md](docs/blueprint.md): the blueprint format
- [docs/catalog.md](docs/catalog.md): every field and module (generated)
- [eval/](eval/README.md): the agent eval and its results
