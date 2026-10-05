import { z } from 'zod';

/** The kinds of module the core can run. See docs/plan.md, "Modularity and variation". */
export const MODULE_KINDS = [
  'bodyPlan',
  'part',
  'pattern',
  'gait',
  'action',
  'theme',
  'stats',
] as const;
export type ModuleKind = (typeof MODULE_KINDS)[number];

/** Lowercase words joined by dots or dashes, e.g. `horn.curved`, `spikes.row`, `quadruped`. */
const MODULE_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

/**
 * What every module declares. Kind-specific hooks (a part's `build`, a pattern's shader, a
 * gait's phase pattern) join this as each pipeline stage lands.
 */
export interface ModuleDefinition<
  K extends ModuleKind = ModuleKind,
  P extends z.ZodType = z.ZodType,
> {
  readonly kind: K;
  /** Unique within its kind. */
  readonly id: string;
  /** One sentence for the catalogue, written for an LLM reader. */
  readonly summary: string;
  readonly tags: readonly string[];
  /** Strict schema for the module's parameters, each with a default, range and description. */
  readonly params: P;
}

export function defineModule<const M extends ModuleDefinition>(module: M): M {
  return module;
}

/** A named set of modules. Games include only the packs they want. */
export interface Pack {
  readonly id: string;
  readonly modules: readonly ModuleDefinition[];
}

export function definePack<const P extends Pack>(pack: P): P {
  return pack;
}

/** One module as plain data, for `list_modules`, the JSON Schema and docs/catalog.md. */
export interface CatalogEntry {
  readonly kind: ModuleKind;
  readonly id: string;
  readonly pack: string;
  readonly summary: string;
  readonly tags: readonly string[];
  /** JSON Schema of the parameters as written: fields with defaults are optional. */
  readonly params: Record<string, unknown>;
}

export interface Registry {
  get(kind: ModuleKind, id: string): ModuleDefinition | undefined;
  /** Modules sorted by kind, then id, so output is stable. */
  list(kind?: ModuleKind): ModuleDefinition[];
  catalog(): CatalogEntry[];
}

export function createRegistry(packs: readonly Pack[]): Registry {
  const byKey = new Map<string, { module: ModuleDefinition; pack: string }>();
  const key = (kind: ModuleKind, id: string) => `${kind}:${id}`;

  for (const pack of packs) {
    for (const module of pack.modules) {
      if (!MODULE_KINDS.includes(module.kind)) {
        throw new Error(
          `${pack.id}/${module.id}: unknown module kind "${module.kind}"; expected one of ${MODULE_KINDS.join(', ')}`,
        );
      }
      if (!MODULE_ID.test(module.id)) {
        throw new Error(
          `${pack.id}/${module.id}: module ids are lowercase words joined by "." or "-", e.g. "horn.curved"`,
        );
      }
      const existing = byKey.get(key(module.kind, module.id));
      if (existing) {
        throw new Error(
          `${module.kind} "${module.id}" is defined in both pack "${existing.pack}" and pack "${pack.id}"`,
        );
      }
      byKey.set(key(module.kind, module.id), { module, pack: pack.id });
    }
  }

  const sorted = [...byKey.values()].sort(
    (x, y) =>
      MODULE_KINDS.indexOf(x.module.kind) - MODULE_KINDS.indexOf(y.module.kind) ||
      x.module.id.localeCompare(y.module.id),
  );

  return {
    get: (kind, id) => byKey.get(key(kind, id))?.module,
    list: (kind) =>
      sorted.map((e) => e.module).filter((m) => kind === undefined || m.kind === kind),
    catalog: () =>
      sorted.map(({ module, pack }) => ({
        kind: module.kind,
        id: module.id,
        pack,
        summary: module.summary,
        tags: module.tags,
        params: z.toJSONSchema(module.params, { io: 'input' }) as Record<string, unknown>,
      })),
  };
}
