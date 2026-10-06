# AGENTS.md

Spawnforge turns a short JSON _blueprint_ into a finished 3D monster: mesh, skeleton, textures and
animation, all made by code. It is a standalone library with its own sandbox; games plug it in
once the proof of concept passes.

Read [docs/plan.md](docs/plan.md) before starting a feature: it is the design, and its rules
hold. Current work follows [docs/plan-2.md](docs/plan-2.md) (phases 7 to 12), whose scope table is
the contract and whose milestones name the effort level each needs.

## Status

All seven phases (0 to 6) are done, and so is the proof of concept ([docs/poc.md](docs/poc.md)).

- Phase 0: the blueprint format, the module registry and first pack, the CLI and MCP tools, the
  generated catalogue and the format eval.
- Phase 1: the compile pipeline (skeleton, SDF skin, surface nets, skin weights, mouth cut,
  parts, eyes, TSL materials), the Three.js adapter, compiling in a worker, and six-view contact
  sheets through the CLI and MCP `render` tool.
- Phase 2: procedural locomotion (gaits from leg pairs, foot planting with IK on uneven ground,
  posture, turning, tail springs, slither), pose sync, the sandbox's terrain course, filmstrips.
- Phase 3: actions as modules (bite, roar, look, idle with breathing and blinks), look-at,
  events, action filmstrips, and the sandbox editor (sliders, JSON panel, gallery, live
  `creatures/` folder).
- Phase 4: `patch`, `analyze` (measurements, motion checks, plausibility warnings, a
  description), the 1,000-blueprint fuzz, golden determinism in Node and Chrome, budgets, and the
  PoC gate.

- Phase 5: variation. Species with `{ min, max }` ranges and `instantiate`, `mutate` (with
  locked paths and part swaps by tag), `crossbreed`, theme modules (reptile, insect, demon) and
  `generate` with constraints, as CLI commands, MCP tools and the sandbox's breed tab.

- Phase 6: the path into games. Baked clips, vertex-colour bake, `.glb` export (CLI, MCP and the
  sandbox), stats modules (`rpg` as the example), and the runtime API (`createBestiary`, spawn,
  caching, sockets, hit capsules, events, baked level of detail). See
  [docs/runtime.md](docs/runtime.md).

Every format gate scored 20/20 on the prompt suite and 20/20 in blind review, and the variation
and export evals passed (`eval/runs/`).

Next is [plan 2](docs/plan-2.md): anatomy and surfaces, the bodies plan 1 deferred (wings, fins,
tentacles, shells, extra heads), motion for games (run, jump, swim, fly, hits, death), texture
maps and levels of detail in exports, installable packages, and editing tools. Its status table
tracks each milestone.

## Repo map

| Path               | Contents                                                                                         | May depend on                    |
| ------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| `packages/core`    | Blueprint schema, module registry, seeded RNG, compile pipeline, motion controller, analysis     | `zod`, Three.js math classes     |
| `packages/modules` | First pack: body plans, parts, patterns, gaits, actions                                          | core                             |
| `packages/three`   | The only layer that renders: skinned mesh assembly, TSL materials, pose sync, export             | core, `three`                    |
| `packages/cli`     | The `spawnforge` command. Every command prints JSON. Headless renderer later                     | core, modules                    |
| `packages/mcp`     | MCP server: a thin wrapper over the CLI command functions                                        | cli, render                      |
| `packages/render`  | Headless contact sheets through Chromium (Playwright) and a Vite-served page, WebGL 2 backend     | core, modules, three             |
| `apps/sandbox`     | Vite app: terrain course, walking creatures, actions, sliders, JSON panel, gallery, `creatures/` watch | core, modules, three   |
| `examples/`        | Blueprints beside their renders; also the golden test set                                        |                                  |
| `eval/`            | The 20-prompt agent eval: prompts, scorer and one folder per run                                  |                                  |
| `scripts/`         | `generate.ts`: writes every generated file (pack index, catalogue, JSON Schema)                  |                                  |
| `docs/`            | `plan.md` (design), `plan-2.md` (current plan), `architecture.md`, `blueprint.md` (format), `catalog.md` (generated) |                                  |

## Commands

```sh
pnpm install                  # Node >= 22.18 and pnpm 10 (`corepack enable` picks the pinned version)
pnpm check                    # lint (incl. generated files) + typecheck + tests; run before every commit
pnpm test                     # Vitest once; `pnpm test:watch` to watch
pnpm typecheck                # tsc on the root, the tests and every package
pnpm format                   # Biome: format, sort imports, apply safe lint fixes
pnpm generate                 # rewrite generated files after adding or changing a module
pnpm dev                      # sandbox at http://localhost:5173 (add ?webgl to force the WebGL 2 backend)
pnpm build                    # production build of the sandbox
pnpm spawnforge <command>     # the CLI from source: list-modules, describe-module, validate, analyze, patch, diff,
                              # render, generate, mutate, crossbreed, instantiate, export, schema
pnpm spawnforge generate --theme reptile --seed 4 --out creatures/lizard.json   # a new creature from a theme
pnpm spawnforge export examples/bog-troll.json --stats rpg   # a .glb with baked clips, for any engine
pnpm spawnforge render examples/ridgeback-stalker.json --labels   # PNG contact sheet next to the file
pnpm render:examples          # re-render examples/*.png after changing a blueprint or the pipeline
pnpm fuzz [count] [quality]   # compile random blueprints from the schema (the PoC gate runs 1,000)
pnpm budgets                  # compile time, triangles, draw calls and motion cost of the examples
node packages/mcp/src/bin.ts  # the MCP server over stdio
node eval/score.ts <run>      # score an eval run from its saved attempts
```

To use the MCP server from Claude Code: `claude mcp add spawnforge -- node packages/mcp/src/bin.ts`.

## How the code runs

There is no build step for packages. Each package exports its TypeScript source
(`"exports": { ".": "./src/index.ts" }`). Node runs it directly with type stripping (Node 22.18+),
Vite and Vitest load it as-is, and TypeScript (`tsc` 7) only typechecks. So:

- **Erasable syntax only** (`erasableSyntaxOnly`): no `enum`, `namespace` or constructor parameter
  properties. Use `as const` objects and string unions.
- **Relative imports include `.ts`**: `import { createRng } from './rng.ts'`.
- **Type-only imports are marked** (`import type`, or `type` inline) under `verbatimModuleSyntax`.
- **Import other packages by name** (`@spawnforge/core`), never by path into their `src/`.

## Rules

From the plan. Follow them unless the plan changes.

**Boundaries**

- `core` and `modules` have no DOM, renderer or Node dependency, so they run in browsers, workers
  and Node alike. Their tsconfig leaves out the `dom` lib and Node types, so a stray `document` or
  `fs` fails typecheck. `core` may use Three.js math classes, nothing else from `three`.
- Only `packages/three` renders or builds materials. Front-ends (sandbox, CLI, MCP, games) call
  package APIs and never reach past them.
- Pipeline stages are pure functions of blueprint, seed and quality. Their output is plain data
  (typed arrays and JSON) that can leave a worker and sit in a cache.

**Determinism**

- Nothing that shapes a creature may use `Math.random`, the clock, or the iteration order of
  unordered data. Draw from `createRng(seed).stream(id)`, keyed by part or layer id, so editing
  one part never reshuffles another.
- RNG golden values are pinned in `packages/core/src/rng.test.ts`. Changing them changes every
  saved creature, so it needs a format bump and a migration.

**Modules**

- One capability is one file in a pack. The core never names a specific part, pattern, gait or
  action: pack `defaults` and module hooks carry what it needs, and a test checks it.
- Module ids are lowercase words joined by dots or dashes (`horn.curved`). Params are
  `z.strictObject`, and every field has a default, a range and a `.describe()` that states its unit.
- Colour parameters are named `color` or end in `Color`, and use `colorRef()` from core, so
  validation and expansion resolve palette names in them.
- After adding or changing a module, run `pnpm generate`: it rewrites the pack index, the
  catalogue and the JSON Schema. CI fails when they are stale.

**Blueprints and errors (LLM-first)**

- Strict: unknown keys are errors with a "did you mean" fix. Friendly forms are explicit unions,
  normalized in a separate step, never hidden transforms.
- Errors carry an id-based path (`limbs[id=hindleg].attach.at`), the problem, the valid range and
  a suggested fix.
- World conventions follow glTF: metres, Y up, creature facing +Z. Blueprint lengths are
  multiples of `scale`, the torso length in metres.

**Compiling and rendering**

- The compile pipeline (`packages/core/src/compile`) is pure: skeleton → SDF → surface nets →
  skin weights → mouth cut → swept tubes for thin bones → body coordinates → helper bones →
  parts and eyes. Its output is plain typed arrays (`CompiledCreature`).
- Part modules build in socket space with `ctx.geo` (sweep, arc, lathe, …) and place pieces with
  `ctx.emit`; pattern modules write their shader once against `Kit<F>`, which runs as TSL on the
  GPU and as numbers on the CPU. Neither may import `three/webgpu` or `three/tsl`.
- Look at what you change: `pnpm spawnforge render <file> --labels` (or the MCP `render` tool)
  draws six views with every part labelled, `--filmstrip` a gait cycle and `--filmstrip --action
  bite` an action. `pnpm spawnforge analyze <file>` checks measurements and motion without
  rendering. Renders need Chromium: Playwright's own, or the one in `$SPAWNFORGE_CHROMIUM`.
- Changes to the pipeline that move vertices change the golden fingerprints
  (`packages/modules/src/golden.json`): re-record with `UPDATE_GOLDEN=1 pnpm test` only when the
  change is intended, re-render the examples, and say why in the commit.

**Dependencies**

- Keep them few. The algorithms that shape monsters (noise, SDF, meshing, IK, springs, gaits) are
  written in-house.
- Shared runtime versions live in the pnpm catalog in `pnpm-workspace.yaml`; packages reference
  them as `"catalog:"`. Three.js is pinned to one release (r186) and upgraded deliberately.

**Tests**

- Tests sit beside the code as `*.test.ts` and run in Node under Vitest. They are typechecked by
  `tsconfig.tests.json` (with Node types), not by the package that holds them.
- New behaviour comes with tests. Modules will also get the automatic defaults, examples and fuzz
  harness the plan describes.

**Scope**

- The scope table in `docs/plan-2.md` is the contract for current work. New ideas go to its
  "Later" column, not into the code.
