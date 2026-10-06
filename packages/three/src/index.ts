export { buildBones, type CreatureObject, createCreatureObject, geometryOf } from './assemble.ts';
export { buildExportScene, type ExportSceneOptions, exportName } from './export.ts';
export {
  eyeMaterial,
  FUR_SHELLS,
  type FurEye,
  furMaterial,
  partsMaterial,
  placeholderSkinMaterial,
  type SkinSignals,
  type SurfaceInputs,
  skinMaterial,
  skinSurface,
  stackMaterial,
} from './materials.ts';
export { applyPose } from './pose-sync.ts';
export { type Backend, type CreatedRenderer, createRenderer } from './renderer.ts';
export {
  type Bestiary,
  type BestiaryOptions,
  Creature,
  createBestiary,
  type HitCapsule,
  type SpawnOptions,
  type UpdateInput,
} from './runtime.ts';
export { tslKit } from './tsl-kit.ts';
export {
  type CompileReply,
  type CompileRequest,
  createWorkerCompiler,
  type WorkerCompiler,
} from './worker-client.ts';
