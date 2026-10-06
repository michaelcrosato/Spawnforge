import {
  type Analysis,
  analyzeCreature,
  applyPatch,
  blueprintSchemaFor,
  type CatalogEntry,
  type CreatureSpec,
  checkScenario,
  compileCreature,
  computeStats,
  createRegistry,
  crossbreed as crossbreedBlueprints,
  didYouMean,
  diffBlueprints,
  FORMAT,
  formatDiff,
  formatIssue,
  type GenerateConstraints,
  generate as generateBlueprint,
  type Issue,
  instantiate as instantiateSpecies,
  isSpecies,
  MODULE_KINDS,
  type ModuleKind,
  migrate as migrateBlueprint,
  motionData,
  mutate as mutateBlueprint,
  type Pack,
  type PatchOp,
  paramsJsonSchema,
  parseScenario,
  type Registry,
  type Scenario,
  type ScenarioResult,
  ScenarioRun,
  validateBlueprint,
  validateSpecies,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { z } from 'zod';

/**
 * Command implementations as plain functions returning JSON-ready data. `bin.ts` prints them and
 * the MCP server wraps the same functions as tools, so the two never drift apart.
 */
export const DEFAULT_PACKS: readonly Pack[] = [basicPack];

let defaultRegistry: Registry | undefined;
export function getRegistry(packs: readonly Pack[] = DEFAULT_PACKS): Registry {
  if (packs === DEFAULT_PACKS) {
    defaultRegistry ??= createRegistry(packs);
    return defaultRegistry;
  }
  return createRegistry(packs);
}

/** A command failed in a way the caller should fix (bad id, unreadable input…). */
export class CommandError extends Error {
  readonly fix: string | undefined;
  constructor(message: string, fix?: string) {
    super(message);
    this.name = 'CommandError';
    this.fix = fix;
  }
}

/** Species have ranges where numbers go; tools that build one creature need an individual. */
export function needIndividual(blueprint: unknown, what: string): void {
  if (isSpecies(blueprint))
    throw new CommandError(
      `this is a species (it has { "min", "max" } ranges), and ${what} works on one creature`,
      'make an individual first: spawnforge instantiate species.json --seed 1 (MCP: instantiate)',
    );
}

export interface ListModulesResult {
  format: string;
  modules: Omit<CatalogEntry, 'params'>[];
}

/** Catalogue of parts, patterns, gaits, actions and presets: ids, summaries and tags. */
export function listModules(
  options: { kind?: ModuleKind } = {},
  registry = getRegistry(),
): ListModulesResult {
  const modules = registry
    .catalog()
    .filter((m) => options.kind === undefined || m.kind === options.kind)
    .map(({ params: _params, ...rest }) => rest);
  return { format: FORMAT, modules };
}

export interface DescribeModuleResult {
  kind: ModuleKind;
  id: string;
  pack: string;
  summary: string;
  tags: readonly string[];
  /** JSON Schema of the parameters: types, ranges, defaults, units in descriptions. */
  params: Record<string, unknown>;
  /** Every parameter's default value. */
  defaults: Record<string, unknown>;
  /** Where and how the module is used in a blueprint. */
  usage: string;
  /** A complete blueprint fragment showing the module in use. */
  example?: unknown;
  /** Extra facts per kind: part slot and default anchor, gait leg pairs and timing, action needs. */
  details?: Record<string, unknown>;
  /** For body plans: the preset blueprint, whose limb and part ids you can override. */
  preset?: Record<string, unknown>;
  /** For stubs: the plan milestone that builds the module; until then compile skips it. */
  planned?: string;
  /** Capabilities the module gives a body, which some actions need (`display`, `pincer`, …). */
  provides?: readonly string[];
}

function findModule(id: string, kind: ModuleKind | undefined, registry: Registry) {
  const kinds = kind ? [kind] : MODULE_KINDS;
  const matches = kinds.map((k) => registry.get(k, id)).filter((m) => m !== undefined);
  if (matches.length === 0) {
    const all = registry.list().map((m) => m.id);
    const guess = didYouMean(id, all);
    throw new CommandError(
      `no module "${id}"${kind ? ` of kind ${kind}` : ''}`,
      guess ? `did you mean "${guess}"?` : 'run list_modules to see every id',
    );
  }
  if (matches.length > 1) {
    throw new CommandError(
      `"${id}" names modules of several kinds: ${matches.map((m) => m.kind).join(', ')}`,
      'pass a kind',
    );
  }
  return matches[0] as NonNullable<(typeof matches)[number]>;
}

/** One module's parameters, ranges, defaults and an example; for body plans, the preset. */
export function describeModule(
  options: { id: string; kind?: ModuleKind },
  registry = getRegistry(),
): DescribeModuleResult {
  const module = findModule(options.id, options.kind, registry);
  const base = {
    kind: module.kind,
    id: module.id,
    pack: registry.packOf(module.kind, module.id) ?? '',
    summary: module.summary,
    tags: module.tags,
    params: paramsJsonSchema(module.params),
    defaults: (module.params.safeParse({}).data ?? {}) as Record<string, unknown>,
    ...(module.planned ? { planned: module.planned } : {}),
    ...(module.provides?.length ? { provides: module.provides } : {}),
  };
  switch (module.kind) {
    case 'bodyPlan':
      return {
        ...base,
        usage: `Start a blueprint with "extends": "${module.id}"; override preset limbs and parts by id.`,
        preset: module.preset,
        example: { format: FORMAT, extends: module.id },
      };
    case 'part':
      return {
        ...base,
        usage:
          module.slot === 'foot'
            ? `Set as a limb's foot: { "foot": { "type": "${module.id}", ...params } }.`
            : module.slot === 'membrane'
              ? `Set as a wing's or fin's membrane: { "membrane": { "type": "${module.id}", ...params } }, not in "parts".`
              : `Add to "parts" with "type": "${module.id}"; parameters go in "params".`,
        example: module.example,
        details: { slot: module.slot, material: module.material, defaultAttach: module.attach },
      };
    case 'pattern':
      return {
        ...base,
        usage: `Add to skin.layers as { "type": "${module.id}", ...params }; every layer also takes "region" and "strength".`,
        example: module.example,
      };
    case 'gait':
      return {
        ...base,
        usage: `List in motion.gaits as "${module.id}", or { "type": "${module.id}", ...params }.`,
        example: { motion: { gaits: [module.id] } },
        details: {
          legPairs: module.legPairs,
          duty:
            typeof module.duty === 'function'
              ? [1, 2, 3].map((n) => ({
                  pairs: n,
                  duty: (module.duty as (p: number) => number)(n),
                }))
              : module.duty,
          froude: module.froude,
          wave:
            module.legPairs === 'any'
              ? [1, 2, 3].map((n) => ({ pairs: n, wave: module.wave(n) }))
              : module.wave(1),
        },
      };
    case 'action':
      return {
        ...base,
        usage: `List in motion.actions as "${module.id}", or { "type": "${module.id}", ...params }.`,
        example: { motion: { actions: [module.id] } },
        details: { needs: module.needs },
      };
    case 'theme':
      return {
        ...base,
        usage: `Generate creatures with it: spawnforge generate --theme ${module.id} --seed 1 (MCP: generate { "theme": "${module.id}", "seed": 1 }).`,
        details: {
          bodyPlans: Object.fromEntries(
            Object.entries(module.bias.plans).map(([id, p]) => [id, p.weight]),
          ),
          parts: (module.bias.parts ?? []).map((p) => ({
            chance: p.chance,
            id: (p.part as { id?: unknown }).id,
            type: (p.part as { type?: unknown }).type,
            ...(p.plans ? { plans: p.plans } : {}),
          })),
          materials: module.bias.materials,
          temperaments: module.bias.temperaments,
        },
      };
    case 'stats':
      return {
        ...base,
        usage: `Game numbers from a creature's body: spawnforge analyze creature.json --stats ${module.id} (MCP: analyze with "stats": "${module.id}").`,
        details: { outputs: module.outputs },
      };
    default:
      return { ...base, usage: `A ${base.kind} module.` };
  }
}

export interface ValidateResult {
  ok: boolean;
  errors: readonly Issue[];
  warnings: readonly Issue[];
  /** The minimal blueprint: only values that differ from the preset and defaults. */
  blueprint?: Record<string, unknown>;
  /** The fully expanded creature spec, on request. */
  creature?: unknown;
  /** True when the input was a species (it has ranges); use `instantiate` for individuals. */
  species?: boolean;
  /** For a species: the individuals checked (both ends of every range, then a few seeds). */
  checked?: string[];
  /**
   * What the blueprint uses that is in the format but not built yet, with the plan milestone
   * that builds it. Keep these: they validate, and appear once built.
   */
  notBuilt?: readonly Issue[];
}

/** Validates a blueprint: errors and warnings with id-based paths and fixes, plus the minimal form. */
export function validate(
  options: { blueprint: unknown; expanded?: boolean },
  registry = getRegistry(),
): ValidateResult {
  if (isSpecies(options.blueprint) && typeof options.blueprint === 'object') {
    // A species (a blueprint with { min, max } ranges): checked at both ends of every range.
    const species = validateSpecies(options.blueprint as Record<string, unknown>, registry);
    return {
      ok: species.ok,
      species: true,
      checked: species.checked,
      errors: species.errors,
      warnings: species.warnings,
    };
  }
  const result = validateBlueprint(options.blueprint, registry);
  return {
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    ...(result.notBuilt ? { notBuilt: result.notBuilt } : {}),
    ...(result.blueprint ? { blueprint: result.blueprint } : {}),
    ...(options.expanded && result.creature ? { creature: result.creature } : {}),
  };
}

const PATH = z
  .string()
  .describe(
    'Id-based path, e.g. "limbs[id=hindleg].length", "skin.layers[type=mottle].strength" or "skin.layers[0].size"',
  );
/** Edit operations for `patch`, checked strictly like blueprints. */
export const patchOpsSchema = z
  .array(
    z.discriminatedUnion('op', [
      z.strictObject({ op: z.literal('set'), path: PATH, value: z.unknown() }),
      z.strictObject({
        op: z.literal('add'),
        path: PATH.describe('The list to add to, e.g. "parts" or "skin.layers"'),
        value: z.unknown(),
      }),
      z.strictObject({ op: z.literal('remove'), path: PATH }),
      z.strictObject({
        op: z.literal('mirror'),
        path: PATH.describe('A limb or part, e.g. "parts[id=horn]"'),
        side: z.enum(['both', 'left', 'right', 'center']).optional(),
      }),
      z.strictObject({
        op: z.literal('scale'),
        path: PATH.describe('A number or profile; "" scales the whole creature'),
        by: z.number().positive(),
      }),
    ]),
  )
  .min(1)
  .max(100);

export interface PatchCommandResult {
  ok: boolean;
  /** One line per change: `~ path: from → to`, `+ path: value`, `- path`. */
  diff: string[];
  errors: readonly Issue[];
  warnings: readonly Issue[];
  /** The patched blueprint, to write back when `ok`. */
  blueprint: Record<string, unknown>;
}

/**
 * Applies edit operations (`set`, `add`, `remove`, `mirror`, `scale`) to a blueprint by
 * id-based paths and validates the result. Writing it back is up to the caller, and only when
 * `ok`, so a file never holds an invalid blueprint.
 */
export function patch(
  options: { blueprint: unknown; ops: unknown },
  registry = getRegistry(),
): PatchCommandResult {
  if (typeof options.blueprint !== 'object' || options.blueprint === null)
    throw new CommandError('the blueprint must be a JSON object');
  const ops = patchOpsSchema.safeParse(options.ops);
  if (!ops.success) {
    const first = ops.error.issues[0];
    throw new CommandError(
      `bad operations at ${first?.path.join('.') || '(root)'}: ${first?.message ?? 'invalid'}`,
      'pass a list like [{"op":"set","path":"body.tail.length","value":1.2}]; ops are set {path, value}, add {path, value}, remove {path}, mirror {path, side?} and scale {path, by}',
    );
  }
  const result = applyPatch(
    options.blueprint as Record<string, unknown>,
    ops.data as PatchOp[],
    registry,
  );
  if (isSpecies(result.blueprint)) {
    // A species is checked as one: at both ends of every range.
    const species = validateSpecies(result.blueprint, registry);
    const errors = [...result.errors.filter((e) => e.code === 'bad_patch'), ...species.errors];
    return {
      ok: errors.length === 0,
      diff: formatDiff(result.diff),
      errors,
      warnings: species.warnings,
      blueprint: result.blueprint,
    };
  }
  return {
    ok: result.ok,
    diff: formatDiff(result.diff),
    errors: result.errors,
    warnings: result.warnings,
    blueprint: result.blueprint,
  };
}

export interface MigrateResult {
  /** False when the format is missing or unknown (see `errors`). */
  ok: boolean;
  /** The format the blueprint was in, and the one it is in now. */
  from: unknown;
  to: string;
  /** One line per upgrade step; empty when it was already current. */
  steps: string[];
  /** Whether anything changed (whether there is anything to write back). */
  changed: boolean;
  /** Format errors, then any validation errors in the upgraded blueprint. */
  errors: readonly Issue[];
  warnings: readonly Issue[];
  /** The upgraded blueprint. */
  blueprint: Record<string, unknown>;
}

/**
 * Upgrades a blueprint (or species) to the current format through every migration step, and
 * validates the result. Writing it back is up to the caller, and only when `ok`.
 */
export function migrate(options: { blueprint: unknown }, registry = getRegistry()): MigrateResult {
  const input = options.blueprint;
  if (typeof input !== 'object' || input === null || Array.isArray(input))
    throw new CommandError('the blueprint must be a JSON object');
  const record = input as Record<string, unknown>;
  const migrated = migrateBlueprint(record);
  const failed = migrated.issues.filter((i) => i.severity === 'error');
  const steps = migrated.issues.filter((i) => i.code === 'migrated').map((i) => i.message);
  const checked = failed.length > 0 ? undefined : validate({ blueprint: migrated.doc }, registry);
  return {
    ok: failed.length === 0,
    from: record.format,
    to: FORMAT,
    steps,
    changed: steps.length > 0,
    errors: [...failed, ...(checked?.errors ?? [])],
    warnings: checked?.warnings.filter((w) => w.code !== 'migrated') ?? [],
    blueprint: migrated.doc,
  };
}

export interface DiffResult {
  ok: boolean;
  /** Whether patching a with `ops` gives exactly b's creature. */
  exact: boolean;
  /** Patch operations that turn a into b; pass them to `patch` as they are. */
  ops: readonly PatchOp[];
  /** One line per change to a: `~ path: from → to`, `+ path: value`, `- path`. */
  changes: string[];
  /** Errors in a (paths start `a:`) or b (`b:`). */
  errors: readonly Issue[];
}

/**
 * The edits that turn blueprint a into blueprint b, as `patch` operations by id-based paths,
 * comparing the creatures they resolve to (so a preset value written out is no change).
 */
export function diff(options: { a: unknown; b: unknown }, registry = getRegistry()): DiffResult {
  for (const [name, value] of [
    ['a', options.a],
    ['b', options.b],
  ] as const) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new CommandError(`blueprint ${name} must be a JSON object`);
    needIndividual(value, 'diff');
  }
  const result = diffBlueprints(
    options.a as Record<string, unknown>,
    options.b as Record<string, unknown>,
    registry,
  );
  return {
    ok: result.ok,
    exact: result.exact,
    ops: result.ops,
    changes: formatDiff(result.changes),
    errors: result.errors,
  };
}

export type AnalyzeResult =
  | { ok: false; errors: readonly Issue[] }
  | ({
      ok: true;
      stats?: { module: string; values: Record<string, number> };
      /** With a scenario: what running it measured. */
      scenario?: ScenarioResult;
    } & Analysis);

/** Scenario issues as `analyze` and `render` report them: paths start at `scenario`. */
export function scenarioIssues(issues: readonly Issue[]): Issue[] {
  return issues.map((i) => ({ ...i, path: i.path ? `scenario.${i.path}` : 'scenario' }));
}

/**
 * Parses a scenario and checks it against a creature (its actions and gaits), for `analyze`
 * and `render`. Issues carry `scenario.` paths.
 */
export function prepareScenario(
  input: unknown,
  creature: CreatureSpec,
  registry = getRegistry(),
):
  | { ok: true; scenario: Scenario; warnings: readonly Issue[] }
  | { ok: false; errors: readonly Issue[] } {
  const parsed = parseScenario(input);
  if (!parsed.scenario) return { ok: false, errors: scenarioIssues(parsed.issues) };
  const problems = checkScenario(parsed.scenario, motionData(creature, registry), registry);
  if (problems.length > 0) return { ok: false, errors: scenarioIssues(problems) };
  return { ok: true, scenario: parsed.scenario, warnings: scenarioIssues(parsed.issues) };
}

/** `prepareScenario` for a blueprint as written (which must be valid). */
export function prepareScenarioFor(
  blueprint: unknown,
  scenario: unknown,
  registry = getRegistry(),
): ReturnType<typeof prepareScenario> {
  const checked = validateBlueprint(blueprint, registry, { minimal: false });
  if (!checked.ok || !checked.creature) return { ok: false, errors: checked.errors };
  return prepareScenario(scenario, checked.creature, registry);
}

/**
 * Measures a valid blueprint, runs its motion for two gait cycles on flat and rough ground and
 * returns measurements, speeds, motion checks, plausibility warnings and a description.
 */
export function analyze(
  options: {
    blueprint: unknown;
    terrainSeed?: number;
    /** A stats module id, to add that game's numbers. */
    stats?: string;
    statsParams?: Record<string, unknown>;
    /** A scenario to run as well (see `ScenarioSchema`): ground, targets and timed calls. */
    scenario?: unknown;
  },
  registry = getRegistry(),
): AnalyzeResult {
  needIndividual(options.blueprint, 'analyze');
  if (options.stats !== undefined && !registry.get('stats', options.stats))
    throw new CommandError(
      `no stats module "${options.stats}"`,
      `use one of ${registry.ids('stats').join(', ')}`,
    );
  const checked = validateBlueprint(options.blueprint, registry, { minimal: false });
  if (!checked.ok || !checked.creature) return { ok: false, errors: checked.errors };
  let scenario: { result: ScenarioResult; warnings: Issue[] } | undefined;
  if (options.scenario !== undefined) {
    const prepared = prepareScenario(options.scenario, checked.creature, registry);
    if (!prepared.ok) return { ok: false, errors: prepared.errors };
    const compiled = compileCreature(checked.creature, registry, { quality: 'low' });
    const result = new ScenarioRun(compiled, registry, prepared.scenario).run();
    const failed: Issue[] = result.failed.map((f) => ({
      severity: 'warning',
      path: `calls[${f.call}]`,
      code: 'call_failed',
      message: f.reason,
      fix: 'call it when the creature can do it (one action at a time), or drop it',
    }));
    scenario = { result, warnings: [...prepared.warnings, ...scenarioIssues(failed)] };
  }
  const analysis = analyzeCreature(checked.creature, registry, {
    ...(options.terrainSeed !== undefined ? { terrainSeed: options.terrainSeed } : {}),
  });
  // Millimetres and grams are plenty; long floats only make the output harder to read.
  const rounded = JSON.parse(
    JSON.stringify(analysis, (_key, value) =>
      typeof value === 'number' ? Number(value.toFixed(3)) : value,
    ),
  ) as Analysis;
  const stats =
    options.stats === undefined
      ? undefined
      : {
          module: options.stats,
          values: computeStats(
            checked.creature,
            analysis,
            registry,
            options.stats,
            options.statsParams,
          ),
        };
  return {
    ok: true,
    ...rounded,
    // Compile repeats a few validation warnings (`not_built`); each is said once.
    warnings: [...checked.warnings, ...analysis.warnings, ...(scenario?.warnings ?? [])].filter(
      (w, i, all) => all.findIndex((o) => o.path === w.path && o.code === w.code) === i,
    ),
    ...(stats ? { stats } : {}),
    ...(scenario ? { scenario: scenario.result } : {}),
  };
}

/** The blueprint JSON Schema, with every module's parameters spelled out. */
export function blueprintJsonSchema(registry = getRegistry()): Record<string, unknown> {
  const base = z.toJSONSchema(blueprintSchemaFor(registry), {
    io: 'input',
    unrepresentable: 'any',
  }) as Record<string, unknown>;
  const defs: Record<string, unknown> = {};
  for (const m of registry.list()) {
    if (m.kind === 'bodyPlan') continue;
    defs[`${m.kind}:${m.id}`] = { description: m.summary, ...paramsJsonSchema(m.params) };
  }
  return {
    ...base,
    $id: `https://spawnforge.dev/schema/${FORMAT.replace('/', '-')}.json`,
    title: 'Spawnforge blueprint',
    description:
      'A creature blueprint. Lengths are multiples of `scale` (torso length in metres). Module parameters are listed under $defs as "<kind>:<id>": part params go in a part\'s "params"; foot, layer, gait and action params sit beside "type".',
    $defs: { ...(base.$defs as Record<string, unknown> | undefined), ...defs },
  };
}

export interface VariationCommandResult {
  ok: boolean;
  /** The new blueprint, ready to save. */
  blueprint: Record<string, unknown>;
  /** Gene by gene against the parent: `~ path: from → to`, `+ path: value`, `- path`. */
  diff: string[];
  errors: readonly Issue[];
  warnings: readonly Issue[];
}

const asObject = (value: unknown, what: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new CommandError(`${what} must be a JSON object`);
  return value as Record<string, unknown>;
};

const unit = (name: string, value: number | undefined) => {
  if (value !== undefined && !(value >= 0 && value <= 1))
    throw new CommandError(`${name} must be between 0 and 1, got ${value}`);
};

/**
 * A new creature from a theme and a seed, under optional constraints (body plan, height limits,
 * required actions and part types). Returns the minimal blueprint and its body size.
 */
export function generate(
  options: { theme: string; seed?: number; constraints?: GenerateConstraints },
  registry = getRegistry(),
): ReturnType<typeof generateBlueprint> {
  return generateBlueprint(
    {
      theme: options.theme,
      seed: options.seed ?? 1,
      ...(options.constraints ? { constraints: options.constraints } : {}),
    },
    registry,
  );
}

/**
 * A child of one blueprint: numbers drift within their ranges, colours shift, and now and then
 * a part is added, removed or swapped. Locked paths never change.
 */
export function mutate(
  options: {
    blueprint: unknown;
    seed?: number;
    amount?: number;
    locked?: readonly string[];
    structure?: boolean;
  },
  registry = getRegistry(),
): VariationCommandResult {
  unit('amount', options.amount);
  needIndividual(options.blueprint, 'mutate');
  const result = mutateBlueprint(
    asObject(options.blueprint, 'the blueprint'),
    {
      seed: options.seed ?? 1,
      ...(options.amount !== undefined ? { amount: options.amount } : {}),
      ...(options.locked ? { locked: options.locked } : {}),
      ...(options.structure !== undefined ? { structure: options.structure } : {}),
    },
    registry,
  );
  return { ...result, diff: formatDiff(result.diff) };
}

/**
 * A child of two blueprints: the body plan of one, numbers and colours blended, enums and parts
 * picked from either. `mix` is how much comes from b. The diff is against the parent named in
 * `base`.
 */
export function crossbreed(
  options: {
    a: unknown;
    b: unknown;
    seed?: number;
    mix?: number;
    base?: 'a' | 'b';
    locked?: readonly string[];
  },
  registry = getRegistry(),
): VariationCommandResult & { base: 'a' | 'b' } {
  unit('mix', options.mix);
  needIndividual(options.a, 'crossbreed');
  needIndividual(options.b, 'crossbreed');
  const result = crossbreedBlueprints(
    asObject(options.a, 'parent a'),
    asObject(options.b, 'parent b'),
    {
      seed: options.seed ?? 1,
      ...(options.mix !== undefined ? { mix: options.mix } : {}),
      ...(options.base ? { base: options.base } : {}),
      ...(options.locked ? { locked: options.locked } : {}),
    },
    registry,
  );
  return { ...result, diff: formatDiff(result.diff) };
}

/** One individual of a species: every `{ min, max }` range resolved for the seed, then validated. */
export function instantiate(
  options: { species: unknown; seed?: number },
  registry = getRegistry(),
): {
  ok: boolean;
  blueprint: Record<string, unknown>;
  errors: readonly Issue[];
  warnings: readonly Issue[];
} {
  const species = asObject(options.species, 'the species');
  const individual = instantiateSpecies(species, options.seed ?? 1, registry);
  const result = validateBlueprint(individual, registry);
  return {
    ok: result.ok,
    blueprint: result.blueprint ?? individual,
    errors: result.errors,
    warnings: result.warnings,
  };
}

/**
 * What an exported .glb carries besides the creature: the format, the minimal blueprint (so the
 * file can be rebuilt or edited) and, with a stats module, that game's numbers. Throws with the
 * validation errors when the blueprint is invalid.
 */
export function exportExtras(
  options: { blueprint: unknown; stats?: string },
  registry = getRegistry(),
): Record<string, unknown> {
  const checked = validate({ blueprint: options.blueprint }, registry);
  if (!checked.ok)
    throw new CommandError(
      `the blueprint is invalid: ${checked.errors.map(formatIssue).join('; ')}`,
      'fix it with validate first',
    );
  let stats: { module: string; values: Record<string, number> } | undefined;
  if (options.stats !== undefined) {
    const analysis = analyze({ blueprint: options.blueprint, stats: options.stats }, registry);
    if (analysis.ok && analysis.stats) stats = analysis.stats;
  }
  return { format: FORMAT, blueprint: checked.blueprint, ...(stats ? { stats } : {}) };
}
