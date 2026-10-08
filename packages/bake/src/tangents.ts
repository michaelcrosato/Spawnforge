import { MeshoptTangents } from 'meshoptimizer/tangents';

/**
 * MikkTSpace tangents for a mesh with texture coordinates (docs/design/11.1-textures.md,
 * decision 6), from meshoptimizer's `Compatible` mode, one per triangle corner. Corners of one
 * vertex that disagree split it, so every vertex has one tangent. The sign is negated, as three's
 * `computeMikkTSpaceTangents` does for glTF: its v runs down the image, its normal maps' +Y up.
 */
export interface Tangents {
  /** For each output vertex, the input vertex it copies. */
  readonly remap: Uint32Array;
  /** Triangles over the output vertices. */
  readonly indices: Uint32Array;
  /** Four per output vertex: the tangent and its handedness. */
  readonly tangents: Float32Array;
}

export async function tangents(
  positions: Float32Array,
  normals: Float32Array,
  uvs: Float32Array,
  indices: Uint32Array,
): Promise<Tangents> {
  await MeshoptTangents.ready;
  const corners = MeshoptTangents.generateTangents(indices, positions, 3, normals, 3, uvs, 2, [
    'Compatible',
  ]);
  const remap: number[] = [];
  const out: number[] = [];
  const next = new Uint32Array(indices.length);
  // Each input vertex's output copies, to share a tangent among corners that agree.
  const copies = new Map<number, number[]>();
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i] as number;
    const tx = corners[i * 4] as number;
    const ty = corners[i * 4 + 1] as number;
    const tz = corners[i * 4 + 2] as number;
    const tw = -(corners[i * 4 + 3] as number);
    const list = copies.get(v) ?? [];
    let found = -1;
    for (const o of list)
      if (
        out[o * 4 + 3] === tw &&
        (out[o * 4] as number) * tx +
          (out[o * 4 + 1] as number) * ty +
          (out[o * 4 + 2] as number) * tz >
          0.9999
      ) {
        found = o;
        break;
      }
    if (found < 0) {
      found = remap.length;
      remap.push(v);
      out.push(tx, ty, tz, tw);
      list.push(found);
      copies.set(v, list);
    }
    next[i] = found;
  }
  return { remap: Uint32Array.from(remap), indices: next, tangents: Float32Array.from(out) };
}
