# AGENTS.md

Spawnforge turns a short JSON _blueprint_ into a finished 3D monster: mesh, skeleton, textures and
animation, all made by code. It is a standalone library with its own sandbox; games plug it in
once the proof of concept passes.

Read [docs/plan.md](docs/plan.md) before starting a feature. It is the design, and its scope table
is the contract.

## Status

Phases 0 and 1 are done. Phase 0: the blueprint format, the module registry and first pack, the
CLI and MCP tools, the generated catalogue and the format eval (20/20). Phase 1: the compile
pipeline (skeleton, SDF skin, surface nets, skin weights, mouth cut, parts, eyes, TSL materials),
the Three.js adapter, compiling in a worker, and headless six-view contact sheets through the CLI
and MCP `render` tool; its eval scored 20/20 valid and 20/20 in blind review. Phase 2
(procedural locomotion) is in progress: the motion controller and pose sync exist in `core` and
`three`; the sandbox terrain course and filmstrip renders are next.

## Repo map

| Path               | Contents                                                                                         | May depend on                    |
| ------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| `packages/core`    | Blueprint schema, module registry, seeded RNG, compile pipeline, motion controller, analysis     | `zod`, Three.js math classes     |
| `packages/modules` | First pack: body plans, parts, patterns, gaits, actions                                          | core                             |
| `packages/three`   | The only layer that renders: skinned mesh assembly, TSL materials, pose sync, export             | core, `three`                    |
| `packages/cli`     | The `spawnforge` command. Every command prints JSON. Headless renderer later                     | core, modules                    |
| `packages/mcp`     | MCP server: a thin wrapper over the CLI command functions                                        | cli, render                      |
| `packages/render`  | Headless contact sheets through Chromium (Playwright) and a Vite-served page, WebGL 2 backend     | core, modules, three             |
| `apps/sandbox`     | Vite app: live 3D view, sliders, JSON panel, terrain test course, gallery                         | core, modules, three             |
| `examples/`        | Blueprints beside their renders; also the golden test set                                        |                                  |
| `eval/`            | The 20-prompt agent eval: prompts, scorer and one folder per run                                  |                                  |
| `scripts/`         | `generate.ts`: writes every generated file (pack index, catalogue, JSON Schema)                  |                                  |
| `docs/`            | `plan.md` (design), `architecture.md`, `blueprint.md` (format), `catalog.md` (generated, later) |                                  |

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
pnpm spawnforge <command>     # the CLI from source: list-modules, describe-module, validate, render, schema
pnpm spawnforge render examples/ridgeback-stalker.json --labels   # PNG contact sheet next to the file
pnpm render:examples          # re-render examples/*.png after changing a blueprint or the pipeline
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
  action.
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
  draws four views with every part labelled. Renders need Chromium: Playwright's own, or the one
  in `$SPAWNFORGE_CHROMIUM`.

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

- The scope table in `docs/plan.md` is the contract. New ideas go to its "Later" column, not into
  the code.
