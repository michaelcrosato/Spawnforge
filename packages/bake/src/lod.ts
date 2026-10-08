import { LOD_RATIOS, type LodLevel } from '@spawnforge/core';
import { MeshoptSimplifier } from 'meshoptimizer/simplifier';

/**
 * Level-of-detail chains (docs/design/11.2-lod.md), from meshoptimizer's simplifier. This is the
 * package's `lod` entry point: it loads the simplifier and nothing of the atlas or the bake, so
 * the runtime can take it alone.
 */

/**
 * Simplifies a mesh toward each share of its triangles (50, 25 and 10% by default), each level
 * from the full mesh, over its own vertices: only triangles go, so every vertex keeps its weights,
 * normal and attributes. Vertices that share a position are seams the simplifier keeps closed.
 * Errors are in the positions' units (metres), measured against the full mesh.
 */
export async function simplifyChain(
  mesh: { readonly positions: Float32Array; readonly indices: Uint32Array | Uint16Array },
  ratios: readonly number[] = LOD_RATIOS,
): Promise<LodLevel[]> {
  await MeshoptSimplifier.ready;
  const indices = Uint32Array.from(mesh.indices);
  const triangles = indices.length / 3;
  if (triangles === 0) return [];
  // A target error as large as the mesh, so the triangle count decides where each level stops.
  const size = MeshoptSimplifier.getScale(mesh.positions, 3);
  let worst = 0;
  return ratios.map((ratio) => {
    const [out, error] = MeshoptSimplifier.simplify(
      indices,
      mesh.positions,
      3,
      Math.max(3, Math.floor(triangles * ratio) * 3),
      size,
      ['ErrorAbsolute'],
    );
    // A coarser level never claims a smaller error than a finer one, so levels can be tried in
    // order (`pickLevel`).
    worst = Math.max(worst, error);
    return { ratio, indices: out, triangles: out.length / 3, error: worst };
  });
}
