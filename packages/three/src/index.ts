export { type CreatureObject, createCreatureObject } from './assemble.ts';
export { eyeMaterial, partsMaterial, placeholderSkinMaterial, skinMaterial } from './materials.ts';
export { type Backend, type CreatedRenderer, createRenderer } from './renderer.ts';
export { tslKit } from './tsl-kit.ts';
export {
  type CompileReply,
  type CompileRequest,
  createWorkerCompiler,
  type WorkerCompiler,
} from './worker-client.ts';
