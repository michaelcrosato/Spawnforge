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
  locked paths and part swaps by tag), `crossbreed`, theme modules (reptile, insect, demon; plan
  2 adds dragon, aquatic, eldritch and beast) and
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
tracks each milestone. Done so far: 7.1 (carry-overs), 7.2 (`migrate` and the corpus test) and
7.3 (format 0.2, which holds all of plan 2's vocabulary as stub modules before it is built; its
format eval scored 20/20 on suite B, `eval/runs/2026-10-06-phase7-format/`) and 7.4 (the
compiled rig holds lists of heads, tails and driven chains, with goldens unchanged) and 7.5
(scenarios for `render` and `analyze`, the module harness for every kind, visual regression for
every example, and the quality and motion reviews, `eval/README.md`) and 7.6 (every package
builds to `dist/` for publishing, at 0.1.0; `pnpm smoke` installs the tarballs into a game) and
8.1 (`muscle` shapes limbs, torso, neck and tail by rules, and `neck.curve` makes an S; `muscle: 0`
is the mesh without muscle, and the meshing grid keeps the muscle-free lattice; the quality review
shows both orders at 640 px, `docs/design/8.1-anatomy.md`) and 8.2 (`foot.paw`, `foot.hoof`,
`foot.talon`, `foot.pad` and `hand.grasp`; each foot stands the leg at its own height, and legs
with a `stance` roll their planted feet, `docs/design/8.2-feet.md`) and 8.3 (heads are meshed
finer than the body and cut exactly along the mouth; mouths open on lips, gums, a palate, a
tongue and a throat; eyelids blink on bones of their own; brows, cheekbones and nostrils; teeth
and eyes sized to the head; `beak`; `render --jaw --blink`, `docs/design/8.3-heads.md`) and 8.4
(materials with their own surface and light, shell fur in one draw call, seven new pattern
layers including glow, and a CPU–GPU parity test of the pattern kit,
`docs/design/8.4-materials.md`). Gate 8 passed: suite A 20/20 valid and matched, suite B
re-scored 20/20, the new look preferred in 20 of 20 quality pairs, budgets met
(`eval/runs/2026-10-06-gate8/`). Then 9.1 (several heads fanned across the chest, each with its
own mouth, eyes and parts, the nearest one biting; tails apart or forked, each a spring;
`head_intersection`, `docs/design/9.1-heads-tails.md`) and 9.2 (`tripod` on four pairs,
spiders' arched legs, and the centaur's upright front with shoulders, arms that swing with the
forelegs and reach to bite, and a balance check that names it,
`docs/design/9.2-legs-centaurs.md`) and 9.3 (wings built spread and resting folded, with
`BonesData.rest` apart from the bind pose everywhere a creature is shown or exported; leathery,
insect, feathered and cased wings and rayed fins as one double-sided membrane mesh, carried by
station bones; `fin.dorsal` and `fin.tail`; the `wings` goal, `render --pose spread`,
`wing_intersection`; `docs/design/9.3-wings-fins.md`) and 9.4 (tentacles that curl onto the
ground, sway on soft springs and reach by FABRIK; part modules with bones of their own through a
`bones` hook, so `antenna`, `mandible` and `hand.pincer` are one file each; `jaw` and `grip`
drives; `pinch`, `lash`, `suckers`; `tentacle_intersection`; `docs/design/9.4-tentacles-parts.md`)
and 9.5 (the area slot with `ctx.surface` and `ctx.scatter`; `shell`, `armor.bands`,
`plates.row`, `quills`, `frill`, `hood` and `sail`; frills, hoods, sails and quills on the `flare`
drive, opened by `display`; `render --flare`; `docs/design/9.5-coverings.md`) and 9.6 (variation
for the new vocabulary: mutation keeps head, tail and limb counts and swaps feet by role,
crossbreeding takes heads, tails, wings, fins and tentacles by role and count from one parent;
themes `dragon`, `aquatic`, `eldritch` and `beast`; `generate --requires air,water`; `rpg`
attacks per head and armour; `docs/design/9.6-variation.md`). Gate 9 passed: suites A and B
20/20 valid and matched blind (suite B 20/20 meeting `expects`), variation 12/12, fuzz and budgets
met (`eval/runs/2026-10-07-gate9/`). `analyze --summary` and `patch --out` came from its feedback.
Then 10.1 (gait modules give per-leg footfalls, duty and stride profiles, a natural speed, hip
ranges, postures and spine flex; `run`, `gallop` and `bound`; gaits with flight lift the body on
a ballistic arc; legs ease into a new gait; `docs/design/10.1-gaits.md`) and 10.2 (a `leap` hook:
the controller plans and flies a ballistic arc over the game's ground; `jump` and `pounce`,
`takeoff` and `land`; leaping clips keep root motion; `docs/design/10.2-jumps.md`) and 10.3
(`water` beside `ground`; `swim.undulate`, `swim.paddle` and `swim.flap`; floating, diving and
climbing out; `head_underwater`, `hits_bed`, `speed.swim`; scenarios' `"water"`, `withLake`,
`openSea`; `docs/design/10.3-swimming.md`) and 10.4 (`fly`, `glide` and `hover`: takeoff,
cruise from wing loading, banked turns, flap-gliding, hovering and landings with a flare on any
slope; strokes compiled per wing; `fly()`, `land()`, `spawn({ flying })`; air cycles baked at exact
phases, `takeoff` and `land` clips; distant flyers keep flying; `cannot_fly`, `hard_landing` and a
flight course in `analyze`; scenarios' slopes and `fly`/`land`; `docs/design/10.4-flight.md`)
and 10.5 (`hit` flinches and staggers, `die` collapses any body onto the ground on support hulls,
necks droop, springs go limp; `dead`/`dying`, a `death` clip, scenarios' `hit` and `die`;
`docs/design/10.5-hits-death.md`). Gate 10 passed: suites A and B re-scored 20/20, suite M's ten
motion tasks 10/10 meet their checks and 10/10 filmstrips matched blind, every clip bakes and
gait clips loop without a seam, motion budgets met (`eval/runs/2026-10-07-gate10/`). Scenario
results' `body` and `turned`, and `analyze` naming every pair of limbs that meet at once, came
from its feedback. Then 11.1 (texture maps: `@spawnforge/bake` unwraps each mesh with xatlas
and bakes colour, a normal map, occlusion with roughness, and emissive per texel through the CPU
kit on workers; `export --textures`; `pnpm roundtrip` loads every export back beside the live
creature, and the Khronos validator checks it; `docs/design/11.1-textures.md`). Next is 11.2.

## Repo map

| Path               | Contents                                                                                         | May depend on                    |
| ------------------ | ------------------------------------------------------------------------------------------------ | -------------------------------- |
| `packages/core`    | Blueprint schema, module registry, seeded RNG, compile pipeline, motion controller, analysis     | `zod`, Three.js math classes     |
| `packages/modules` | First pack: body plans, parts, patterns, gaits, actions                                          | core                             |
| `packages/three`   | The only layer that renders: skinned mesh assembly, TSL materials, pose sync, export             | core, `three`                    |
| `packages/bake`    | Export processing: UV atlases (xatlas), texture maps baked per texel, tangents                    | core, `watlas`, `meshoptimizer`  |
| `packages/cli`     | The `spawnforge` command. Every command prints JSON. Headless renderer later                     | core, modules                    |
| `packages/mcp`     | MCP server: a thin wrapper over the CLI command functions                                        | cli, render                      |
| `packages/render`  | Headless contact sheets, exports and the texture round trip through Chromium (Playwright) and a Vite-served page, WebGL 2 backend | core, modules, three, bake |
| `apps/sandbox`     | Vite app: terrain course, walking creatures, actions, sliders, JSON panel, gallery, `creatures/` watch | core, modules, three, bake |
| `examples/`        | Blueprints beside their renders; also the golden test set                                        |                                  |
| `eval/`            | The 20-prompt agent eval: prompts, scorer and one folder per run                                  |                                  |
| `scripts/`         | `generate.ts`: writes every generated file (pack index, catalogue, JSON Schema)                  |                                  |
| `docs/`            | `plan.md` (design), `plan-2.md` (current plan), `architecture.md`, `blueprint.md` (format), `scenarios.md`, `catalog.md` (generated) |                                  |

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
pnpm build:packages           # each package's dist/ (for publishing; the workspace runs src/)
pnpm smoke                    # pack the packages, install them into scripts/smoke-game, build and run it
pnpm spawnforge <command>     # the CLI from source: list-modules, describe-module, validate (--quiet), analyze, patch, diff,
                              # migrate, render, generate, mutate, crossbreed, instantiate, export, schema
                              # (`pnpm -s spawnforge …` leaves out pnpm's banner, for JSON you can pipe)
pnpm spawnforge generate --theme reptile --seed 4 --out creatures/lizard.json   # a new creature from a theme
pnpm spawnforge export examples/bog-troll.json --stats rpg   # a .glb with baked clips and texture maps, for any engine
                              # (--textures 2048 for sharper maps, --textures none for vertex colours)
pnpm spawnforge render examples/ridgeback-stalker.json --labels   # PNG contact sheet next to the file
pnpm spawnforge render examples/grey-wolf.json --views head --jaw 0.8   # the head, mouth open (--blink 1 shuts the eyes)
pnpm spawnforge render examples/ash-dragon.json --pose spread   # wings open (they rest folded)
pnpm spawnforge analyze examples/ridgeback-stalker.json --scenario examples/scenarios/stalk-and-bite.json
                              # scripted motion (targets, a course, water, timed calls); render takes it too
pnpm render:examples          # re-render examples/*.png after changing a blueprint or the pipeline
pnpm fuzz [count] [quality]   # compile random blueprints from the schema (the PoC gate runs 1,000)
pnpm budgets                  # compile time, triangles, draw calls, .glb size and motion cost of the examples
pnpm roundtrip [name …]       # export each example with maps, load it back and compare it with the live creature
node scripts/theme-sheet.ts dragon --out dragon.png  # a theme across 20 seeds on one sheet
node packages/mcp/src/bin.ts  # the MCP server over stdio
node eval/score.ts <run>      # score an eval run from its saved attempts
node eval/quality.ts prepare <out> --base <commit>   # the same blueprints at two commits, blind pairs
node eval/motion.ts prepare <out>                    # filmstrips shown blind, matched to their tasks
node eval/motion.ts check <run>                      # suite M: each task's scenario run against its checks
```

To use the MCP server from Claude Code: `claude mcp add spawnforge -- node packages/mcp/src/bin.ts`.

## How the code runs

The workspace has no build step. Each package exports its TypeScript source
(`"exports": { ".": "./src/index.ts" }`). Node runs it directly with type stripping (Node 22.18+),
Vite and Vitest load it as-is, and TypeScript (`tsc` 7) only typechecks. `dist/` is for
publishing only: `pnpm build:packages` compiles each package with its `tsconfig.build.json`
(JavaScript with `.js` imports, and declarations), `publishConfig.exports` points packed packages
at it, and `pnpm smoke` installs the packed tarballs into a small Vite game outside the
workspace and runs it in headless Chromium (CI runs it too). So:

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
- Migrations live one step per file in `packages/core/src/blueprint/migrations/`. The corpus test
  (`packages/modules/src/corpus.test.ts`) checks that every blueprint under `examples/` and
  `eval/runs/` still migrates and validates as recorded in `corpus.json`; re-record with
  `UPDATE_CORPUS=1` only for an intended change, and say why in the commit.

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

- The compile pipeline (`packages/core/src/compile`) is pure: skeleton (wings built spread, then
  folded) → SDF → surface nets → skin weights → mouth cut → swept tubes for thin bones → body
  coordinates → helper bones → parts, eyes and membranes. Its output is plain typed arrays
  (`CompiledCreature`). A creature with wings has a rest pose apart from its bind pose
  (`BonesData.rest`): show and animate it from rest.
- Part modules build in socket space with `ctx.geo` (sweep, arc, lathe, …) and place pieces with
  `ctx.emit` (membrane modules span spars with `ctx.panel` and place sheets with `ctx.sheet`); pattern modules write their shader once against `Kit<F>`, which runs as TSL on the
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
- New behaviour comes with tests. Every built module also goes through the module harness
  (`compile.test.ts` for parts, `harness.test.ts` for every other kind): its defaults and
  example, its time and size budgets, and the same result twice.

**Scope**

- The scope table in `docs/plan-2.md` is the contract for current work. New ideas go to its
  "Later" column, not into the code.
