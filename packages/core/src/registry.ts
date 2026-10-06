import { z } from 'zod';
import type { StatsHooks } from './analysis/stats.ts';
import type { PartHooks } from './compile/parts.ts';
import type { ActionHooks } from './motion/actions.ts';
import type { PatternHooks } from './shading/kit.ts';
import type { ThemeBias } from './variation/generate.ts';

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

/** Fields every module declares. */
export interface ModuleBase<K extends ModuleKind, P extends z.ZodType = z.ZodType> {
  readonly kind: K;
  /** Unique within its kind. */
  readonly id: string;
  /** One sentence for the catalogue, written for an LLM reader. */
  readonly summary: string;
  readonly tags: readonly string[];
  /** Strict schema for the module's parameters, each with a default, range and description. */
  readonly params: P;
}

/** Where a part sits. Each slot has its own placement rules (docs/blueprint.md). */
export type PartSlot =
  /** One point on a section, limb or part: `at` and `angle`. */
  | 'surface'
  /** A run of copies between `from` and `to`. */
  | 'row'
  /** The end of a limb, set through the limb's `foot` field. */
  | 'foot'
  /** Along the mouth line of a head with a jaw. */
  | 'mouth';

/** Base materials hard parts can use. */
export type PartMaterial = 'bone' | 'horn' | 'chitin' | 'enamel' | 'eye' | 'skin';

export interface PartModule<P extends z.ZodType = z.ZodType> extends ModuleBase<'part', P> {
  readonly slot: PartSlot;
  readonly material: PartMaterial;
  /** Default anchor when a blueprint leaves `attach` fields out. */
  readonly attach: { readonly on: string; readonly at?: number; readonly angle?: number };
  /** A complete `parts[]` entry (or `foot` object for foot parts) showing typical use. */
  readonly example: Record<string, unknown>;
  /** Geometry (and, for feet, toe bones). */
  readonly hooks?: PartHooks;
  /**
   * A short phrase for the creature's description, e.g. "coiled horns". `count` is how many
   * there are (2 for a mirrored pair), so a single horn can say "a curved horn".
   */
  readonly describe?: (
    params: Readonly<Record<string, unknown>>,
    info: { readonly count: number },
  ) => string;
}

export interface PatternModule<P extends z.ZodType = z.ZodType> extends ModuleBase<'pattern', P> {
  /** A complete `skin.layers[]` entry showing typical use. */
  readonly example: Record<string, unknown>;
  /** The shader function, written once for CPU and GPU. */
  readonly hooks?: PatternHooks;
  /** A short phrase for the creature's description, e.g. "dark stripes". */
  readonly describe?: (params: Readonly<Record<string, unknown>>) => string;
}

export interface GaitModule<P extends z.ZodType = z.ZodType> extends ModuleBase<'gait', P> {
  /** Leg pairs the gait works with. `0` is a legless spine gait; `'any'` is one pair or more. */
  readonly legPairs: 'any' | readonly number[];
  /** Phase offset between successive leg pairs, counted from the back, for a given pair count. */
  readonly wave: (pairs: number) => number;
  /** Default share of the cycle each foot is planted. */
  readonly duty: number;
  /** Speeds the gait suits, as Froude numbers v²/(g·h). */
  readonly froude: readonly [number, number];
  readonly hooks?: unknown;
}

/** Body features an action may need. */
export type Feature = 'head' | 'jaw' | 'arm' | 'tail' | 'legs';

export interface ActionModule<P extends z.ZodType = z.ZodType> extends ModuleBase<'action', P> {
  readonly needs: readonly Feature[];
  /** Body-relative goals over time (see `ActionHooks`). */
  readonly hooks?: ActionHooks;
}

export interface BodyPlanModule extends ModuleBase<'bodyPlan', z.ZodType> {
  /** The blueprint fragment `extends` starts from. Lists carry ids so blueprints can edit them. */
  readonly preset: Record<string, unknown>;
}

export interface ThemeModule<P extends z.ZodType = z.ZodType> extends ModuleBase<'theme', P> {
  /** Weights and ranges `generate` draws from (see `ThemeBias`). */
  readonly bias: ThemeBias;
}

export interface StatsModule<P extends z.ZodType = z.ZodType> extends ModuleBase<'stats', P> {
  /** Body to game numbers (see `StatsHooks`). */
  readonly hooks: StatsHooks;
  /** What each number means, by name, for the catalogue. */
  readonly outputs: Readonly<Record<string, string>>;
}

export interface ModuleByKind {
  bodyPlan: BodyPlanModule;
  part: PartModule;
  pattern: PatternModule;
  gait: GaitModule;
  action: ActionModule;
  theme: ThemeModule;
  stats: StatsModule;
}

export type ModuleDefinition = ModuleByKind[ModuleKind];

export function defineModule<const M extends ModuleDefinition>(module: M): M {
  return module;
}

const EMPTY_PARAMS = z.strictObject({});

export function definePart<P extends z.ZodType>(m: Omit<PartModule<P>, 'kind'>): PartModule<P> {
  return { kind: 'part', ...m };
}
export function definePattern<P extends z.ZodType>(
  m: Omit<PatternModule<P>, 'kind'>,
): PatternModule<P> {
  return { kind: 'pattern', ...m };
}
export function defineGait<P extends z.ZodType>(m: Omit<GaitModule<P>, 'kind'>): GaitModule<P> {
  return { kind: 'gait', ...m };
}
export function defineAction<P extends z.ZodType>(
  m: Omit<ActionModule<P>, 'kind'>,
): ActionModule<P> {
  return { kind: 'action', ...m };
}
export function defineBodyPlan(m: Omit<BodyPlanModule, 'kind' | 'params'>): BodyPlanModule {
  return { kind: 'bodyPlan', params: EMPTY_PARAMS, ...m };
}
export function defineTheme<P extends z.ZodType>(m: Omit<ThemeModule<P>, 'kind'>): ThemeModule<P> {
  return { kind: 'theme', ...m };
}
export function defineStats<P extends z.ZodType>(m: Omit<StatsModule<P>, 'kind'>): StatsModule<P> {
  return { kind: 'stats', ...m };
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
  get<K extends ModuleKind>(kind: K, id: string): ModuleByKind[K] | undefined;
  /** Modules sorted by kind, then id, so output is stable. */
  list<K extends ModuleKind>(kind: K): ModuleByKind[K][];
  list(): ModuleDefinition[];
  ids(kind: ModuleKind): string[];
  packOf(kind: ModuleKind, id: string): string | undefined;
  catalog(): CatalogEntry[];
}

export function paramsJsonSchema(params: z.ZodType): Record<string, unknown> {
  const schema = z.toJSONSchema(params, { io: 'input', unrepresentable: 'any' }) as Record<
    string,
    unknown
  >;
  delete schema.$schema;
  return schema;
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

  function list(kind?: ModuleKind): ModuleDefinition[] {
    return sorted.map((e) => e.module).filter((m) => kind === undefined || m.kind === kind);
  }

  return {
    get: <K extends ModuleKind>(kind: K, id: string) =>
      byKey.get(key(kind, id))?.module as ModuleByKind[K] | undefined,
    list: list as Registry['list'],
    ids: (kind) => list(kind).map((m) => m.id),
    packOf: (kind, id) => byKey.get(key(kind, id))?.pack,
    catalog: () =>
      sorted.map(({ module, pack }) => ({
        kind: module.kind,
        id: module.id,
        pack,
        summary: module.summary,
        tags: module.tags,
        params: paramsJsonSchema(module.params),
      })),
  };
}
