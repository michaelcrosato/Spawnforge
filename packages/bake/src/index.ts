export { type BakeOptions, bakeTextures, mapSizes } from './bake.ts';
export { dilate } from './dilate.ts';
export { type NormalInputs, normalMap } from './normal.ts';
export { occlusion } from './occlusion.ts';
export { type Coverage, rasterize } from './raster.ts';
export {
  type BandJob,
  type BandMesh,
  type BandResult,
  type MeshKind,
  shadeBand,
} from './shade.ts';
export { type Tangents, tangents } from './tangents.ts';
export { loadXatlas, type Unwrapped, unwrap } from './xatlas.ts';
