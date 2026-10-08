import { Atlas, Initialize } from 'watlas';

/**
 * UV atlases from xatlas (https://github.com/jpcy/xatlas), through its WASM build `watlas`, which
 * runs in browsers and Node and takes 32-bit indices.
 */

/** A mesh unwrapped into one atlas. */
export interface Unwrapped {
  /** For each new vertex, the input vertex it copies (vertices split along chart seams). */
  readonly remap: Uint32Array;
  /** Triangles over the new vertices, in the input's order. */
  readonly indices: Uint32Array;
  /** Texture coordinates of the new vertices, 0 to 1, glTF's convention (v down from the top). */
  readonly uvs: Float32Array;
  /** Charts in the atlas. */
  readonly charts: number;
}

let ready: Promise<void> | undefined;

/** Loads the WASM module once. */
export function loadXatlas(): Promise<void> {
  ready ??= Initialize();
  return ready;
}

/**
 * Charts a mesh and packs its charts into one square atlas of about `size` texels with `padding`
 * texels round each chart. The UVs are scaled to fill 0 to 1 on the longer side.
 */
export async function unwrap(
  mesh: {
    readonly positions: Float32Array;
    readonly normals: Float32Array;
    readonly indices: Uint32Array | Uint16Array;
  },
  size: number,
  padding: number,
): Promise<Unwrapped> {
  await loadXatlas();
  // Charts no larger than 1/40 of the mesh: smaller charts chart about twice as fast at the
  // same packing (decision 2).
  let area = 0;
  const p = mesh.positions;
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const a = (mesh.indices[t] as number) * 3;
    const b = (mesh.indices[t + 1] as number) * 3;
    const c = (mesh.indices[t + 2] as number) * 3;
    const e1x = (p[b] as number) - (p[a] as number);
    const e1y = (p[b + 1] as number) - (p[a + 1] as number);
    const e1z = (p[b + 2] as number) - (p[a + 2] as number);
    const e2x = (p[c] as number) - (p[a] as number);
    const e2y = (p[c + 1] as number) - (p[a + 1] as number);
    const e2z = (p[c + 2] as number) - (p[a + 2] as number);
    area += Math.hypot(e1y * e2z - e1z * e2y, e1z * e2x - e1x * e2z, e1x * e2y - e1y * e2x) / 2;
  }
  const atlas = new Atlas();
  try {
    atlas.addMesh({
      vertexPositionData: mesh.positions,
      vertexCount: mesh.positions.length / 3,
      vertexPositionStride: 12,
      vertexNormalData: mesh.normals,
      vertexNormalStride: 12,
      indexData: Uint32Array.from(mesh.indices),
      indexCount: mesh.indices.length,
    });
    atlas.generate(
      { maxIterations: 1, maxChartArea: area / 40 },
      { padding, resolution: size, bilinear: true, rotateCharts: true, rotateChartsToAxis: true },
    );
    if (atlas.atlasCount > 1)
      throw new Error(`xatlas packed the mesh into ${atlas.atlasCount} atlases, not one`);
    const out = atlas.getMesh(0);
    const n = out.vertexCount;
    const indices = new Uint32Array(out.indexCount);
    out.getIndexArray(indices);
    const remap = new Uint32Array(n);
    const uvs = new Float32Array(n * 2);
    // Atlas texels to 0..1: the longer side fills the map.
    const side = Math.max(atlas.width, atlas.height, 1);
    for (let i = 0; i < n; i++) {
      const v = out.getVertex(i);
      remap[i] = v.xref;
      uvs[i * 2] = v.uv[0] / side;
      uvs[i * 2 + 1] = v.uv[1] / side;
    }
    return { remap, indices, uvs, charts: atlas.chartCount };
  } finally {
    atlas.delete();
  }
}
