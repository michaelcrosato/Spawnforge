import {
  type Analysis,
  analyzeCreature,
  applyPatch,
  blueprintSchemaFor,
  type CatalogEntry,
  createRegistry,
  crossbreed as crossbreedBlueprints,
  didYouMean,
  FORMAT,
  formatDiff,
  type GenerateConstraints,
  generate as generateBlueprint,
  type Issue,
  instantiate as instantiateSpecies,
  isSpecies,
  MODULE_KINDS,
  type ModuleKind,
  mutate as mutateBlueprint,
  type Pack,
  type PatchOp,
  paramsJsonSchema,
  type Registry,
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
          duty: module.duty,
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
    default:
      return { ...base, usage: `A ${module.kind} module.` };
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
}

/** Validates a blueprint: errors and warnings with id-based paths and fixes, plus the minimal form. */
export function validate(
  options: { blueprint: unknown; expanded?: boolean },
  registry = getRegistry(),
): ValidateResult {
  if (isSpecies(options.blueprint) && typeof options.blueprint === 'object') {
    // A species (a blueprint with { min, max } ranges): checked at both ends of every range.
    const species = validateSpecies(options.blueprint as Record<string, unknown>, registry);
    return { ok: species.ok, species: true, errors: species.errors, warnings: species.warnings };
  }
  const result = validateBlueprint(options.blueprint, registry);
  return {
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
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
  return {
    ok: result.ok,
    diff: formatDiff(result.diff),
    errors: result.errors,
    warnings: result.warnings,
    blueprint: result.blueprint,
  };
}

export type AnalyzeResult = { ok: false; errors: readonly Issue[] } | ({ ok: true } & Analysis);

/**
 * Measures a valid blueprint, runs its motion for two gait cycles on flat and rough ground and
 * returns measurements, speeds, motion checks, plausibility warnings and a description.
 */
export function analyze(
  options: { blueprint: unknown; terrainSeed?: number },
  registry = getRegistry(),
): AnalyzeResult {
  const checked = validateBlueprint(options.blueprint, registry, { minimal: false });
  if (!checked.ok || !checked.creature) return { ok: false, errors: checked.errors };
  const analysis = analyzeCreature(checked.creature, registry, {
    ...(options.terrainSeed !== undefined ? { terrainSeed: options.terrainSeed } : {}),
  });
  // Millimetres and grams are plenty; long floats only make the output harder to read.
  const rounded = JSON.parse(
    JSON.stringify(analysis, (_key, value) =>
      typeof value === 'number' ? Number(value.toFixed(3)) : value,
    ),
  ) as Analysis;
  return {
    ok: true,
    ...rounded,
    warnings: [...checked.warnings, ...analysis.warnings],
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
  options: { a: unknown; b: unknown; seed?: number; mix?: number },
  registry = getRegistry(),
): VariationCommandResult & { base: 'a' | 'b' } {
  unit('mix', options.mix);
  const result = crossbreedBlueprints(
    asObject(options.a, 'parent a'),
    asObject(options.b, 'parent b'),
    { seed: options.seed ?? 1, ...(options.mix !== undefined ? { mix: options.mix } : {}) },
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
  const individual = instantiateSpecies(species, options.seed ?? 1);
  const result = validateBlueprint(individual, registry);
  return {
    ok: result.ok,
    blueprint: result.blueprint ?? individual,
    errors: result.errors,
    warnings: result.warnings,
  };
}
