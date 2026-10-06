import {
  blueprintSchemaFor,
  type CatalogEntry,
  createRegistry,
  didYouMean,
  FORMAT,
  type Issue,
  MODULE_KINDS,
  type ModuleKind,
  type Pack,
  paramsJsonSchema,
  type Registry,
  validateBlueprint,
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
}

/** Validates a blueprint: errors and warnings with id-based paths and fixes, plus the minimal form. */
export function validate(
  options: { blueprint: unknown; expanded?: boolean },
  registry = getRegistry(),
): ValidateResult {
  const result = validateBlueprint(options.blueprint, registry);
  return {
    ok: result.ok,
    errors: result.errors,
    warnings: result.warnings,
    ...(result.blueprint ? { blueprint: result.blueprint } : {}),
    ...(options.expanded && result.creature ? { creature: result.creature } : {}),
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
