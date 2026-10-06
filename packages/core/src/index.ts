export * from './blueprint/colors.ts';
export type * from './blueprint/creature.ts';
export { formatIssue, formatPath, type Issue } from './blueprint/issues.ts';
export { cloneJson, ID_LISTS, isRecord, mergeBlueprint } from './blueprint/merge.ts';
export { KNOWN_FORMATS, migrate } from './blueprint/migrate.ts';
export { normalizeBlueprint } from './blueprint/normalize.ts';
export {
  type BlueprintDoc,
  buildBlueprintSchema,
  CROSS_SECTIONS,
  colorRef,
  DEFAULT_PALETTE,
  HEAD_SHAPES,
  ITEM_ID,
  LIMB_ROLES,
  REGIONS,
  SECTIONS,
  SIDES,
  SKIN_MATERIALS,
  TEMPERAMENTS,
} from './blueprint/schema.ts';
export { didYouMean, editDistance } from './blueprint/suggest.ts';
export {
  blueprintSchemaFor,
  expandCreature,
  minimalBlueprint,
  type ResolvedDoc,
  resolveBlueprint,
  resolveDocument,
  type ValidateOptions,
  type ValidationResult,
  validateBlueprint,
} from './blueprint/validate.ts';
export * from './compile/compile.ts';
export { type LimbIkSetup, solveLimb } from './compile/ik.ts';
export { type MouthLine, mouthLine, mouthPoint } from './compile/mouth.ts';
export type {
  EmitOptions,
  EyeOptions,
  PartBuildContext,
  PartHooks,
  Socket,
} from './compile/parts.ts';
export { buildSdf, type Sdf, SdfEvaluator } from './compile/sdf.ts';
export { buildSkeleton, type SkeletonBuild } from './compile/skeleton.ts';
export type * from './compile/types.ts';
export { FORMAT } from './format.ts';
export * from './geometry/kit.ts';
export * from './registry.ts';
export { createRng, deriveSeed, type Rng } from './rng.ts';
export * from './shading/compose.ts';
export { cpuKit, hash3u } from './shading/cpu.ts';
export type { Kit, LayerOutput, PatternHooks, Surface } from './shading/kit.ts';
export { cells, fbm, valueNoise } from './shading/noise.ts';
