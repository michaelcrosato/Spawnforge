/**
 * Which triangle covers each texel of a map, and where: triangles rasterized in UV space at
 * texel centres with the top-left rule, so a texel on an edge two triangles share is filled once.
 */
export interface Coverage {
  readonly size: number;
  /** Triangle per texel, -1 where nothing is (row by row from the top, v down). */
  readonly triangle: Int32Array;
  /** Barycentric weights of the triangle's second and third corners per texel (the first's is the rest). */
  readonly weights: Float32Array;
  /** Texels covered, in row order. */
  readonly texels: Uint32Array;
}

/**
 * Rasterizes triangles (`indices` over `uvs`, 0 to 1) into a `size` × `size` map: texel centres
 * inside a triangle, then, conservatively, every empty texel whose square the triangle touches
 * (its centre within half a diagonal), at the triangle's closest point, so chart borders hold
 * real values before the gutters are dilated (docs/design/11.1-textures.md, decision 4).
 */
export function rasterize(uvs: Float32Array, indices: Uint32Array, size: number): Coverage {
  const triangle = new Int32Array(size * size).fill(-1);
  const weights = new Float32Array(size * size * 2);
  const count = indices.length / 3;
  for (let t = 0; t < count; t++) {
    const a = indices[t * 3] as number;
    const b = indices[t * 3 + 1] as number;
    const c = indices[t * 3 + 2] as number;
    // Texel space: texel (i, j) has its centre at (i + 0.5, j + 0.5).
    const ax = (uvs[a * 2] as number) * size;
    const ay = (uvs[a * 2 + 1] as number) * size;
    const bx = (uvs[b * 2] as number) * size;
    const by = (uvs[b * 2 + 1] as number) * size;
    const cx = (uvs[c * 2] as number) * size;
    const cy = (uvs[c * 2 + 1] as number) * size;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-12) continue;
    // Edges oriented so the inside is positive whichever way the triangle winds.
    const s = area > 0 ? 1 : -1;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 0.5));
    const x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx) - 0.5));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 0.5));
    const y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy) - 0.5));
    // Top-left rule: a texel exactly on an edge belongs to the triangle only if the edge is a
    // top or left one (in this orientation), so neighbours never both claim it.
    const bias = (ex: number, ey: number) => (ey < 0 || (ey === 0 && ex > 0) ? 0 : -1e-9);
    const b0 = bias((cx - bx) * s, (cy - by) * s);
    const b1 = bias((ax - cx) * s, (ay - cy) * s);
    const b2 = bias((bx - ax) * s, (by - ay) * s);
    const inv = 1 / area;
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        // Edge functions: the weight of the corner opposite each edge, times the area.
        const w0 = ((cx - bx) * (py - by) - (cy - by) * (px - bx)) * s;
        const w1 = ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) * s;
        const w2 = ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) * s;
        if (w0 + b0 < 0 || w1 + b1 < 0 || w2 + b2 < 0) continue;
        const k = y * size + x;
        triangle[k] = t;
        weights[k * 2] = w1 * inv * s;
        weights[k * 2 + 1] = w2 * inv * s;
      }
    }
  }
  border(uvs, indices, size, triangle, weights);
  let filled = 0;
  for (let k = 0; k < triangle.length; k++) if ((triangle[k] as number) >= 0) filled++;
  const texels = new Uint32Array(filled);
  let n = 0;
  for (let k = 0; k < triangle.length; k++) if ((triangle[k] as number) >= 0) texels[n++] = k;
  return { size, triangle, weights, texels };
}

/** The conservative pass: empty texels near a triangle take its closest point's weights. */
function border(
  uvs: Float32Array,
  indices: Uint32Array,
  size: number,
  triangle: Int32Array,
  weights: Float32Array,
): void {
  const reach = Math.SQRT1_2;
  const best = new Float32Array(size * size).fill(Infinity);
  const near = new Int32Array(size * size).fill(-1);
  const nearWeights = new Float32Array(size * size * 2);
  const count = indices.length / 3;
  const q = { u: 0, v: 0, w1: 0, w2: 0 };
  for (let t = 0; t < count; t++) {
    const a = indices[t * 3] as number;
    const b = indices[t * 3 + 1] as number;
    const c = indices[t * 3 + 2] as number;
    const ax = (uvs[a * 2] as number) * size;
    const ay = (uvs[a * 2 + 1] as number) * size;
    const bx = (uvs[b * 2] as number) * size;
    const by = (uvs[b * 2 + 1] as number) * size;
    const cx = (uvs[c * 2] as number) * size;
    const cy = (uvs[c * 2 + 1] as number) * size;
    if (Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax)) < 1e-12) continue;
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 1.5));
    const x1 = Math.min(size - 1, Math.ceil(Math.max(ax, bx, cx) + 0.5));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 1.5));
    const y1 = Math.min(size - 1, Math.ceil(Math.max(ay, by, cy) + 0.5));
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const k = y * size + x;
        if ((triangle[k] as number) >= 0) continue;
        closest(x + 0.5, y + 0.5, ax, ay, bx, by, cx, cy, q);
        const d = Math.hypot(q.u - (x + 0.5), q.v - (y + 0.5));
        if (d > reach || d >= (best[k] as number)) continue;
        best[k] = d;
        near[k] = t;
        nearWeights[k * 2] = q.w1;
        nearWeights[k * 2 + 1] = q.w2;
      }
  }
  for (let k = 0; k < size * size; k++)
    if ((near[k] as number) >= 0) {
      triangle[k] = near[k] as number;
      weights[k * 2] = nearWeights[k * 2] as number;
      weights[k * 2 + 1] = nearWeights[k * 2 + 1] as number;
    }
}

/** The point of triangle abc closest to p, and its weights for b and c (Ericson, 5.1.5). */
function closest(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  out: { u: number; v: number; w1: number; w2: number },
): void {
  const set = (w1: number, w2: number) => {
    out.w1 = w1;
    out.w2 = w2;
    out.u = ax + (bx - ax) * w1 + (cx - ax) * w2;
    out.v = ay + (by - ay) * w1 + (cy - ay) * w2;
  };
  const abx = bx - ax;
  const aby = by - ay;
  const acx = cx - ax;
  const acy = cy - ay;
  const apx = px - ax;
  const apy = py - ay;
  const d1 = abx * apx + aby * apy;
  const d2 = acx * apx + acy * apy;
  if (d1 <= 0 && d2 <= 0) {
    set(0, 0);
    return;
  }
  const bpx = px - bx;
  const bpy = py - by;
  const d3 = abx * bpx + aby * bpy;
  const d4 = acx * bpx + acy * bpy;
  if (d3 >= 0 && d4 <= d3) {
    set(1, 0);
    return;
  }
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    set(d1 / (d1 - d3), 0);
    return;
  }
  const cpx = px - cx;
  const cpy = py - cy;
  const d5 = abx * cpx + aby * cpy;
  const d6 = acx * cpx + acy * cpy;
  if (d6 >= 0 && d5 <= d6) {
    set(0, 1);
    return;
  }
  const vb = d5 * d2 - d1 * d6;
  if (vb <= 0 && d2 >= 0 && d6 <= 0) {
    set(0, d2 / (d2 - d6));
    return;
  }
  const va = d3 * d6 - d5 * d4;
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
    set(1 - w, w);
    return;
  }
  const denom = 1 / (va + vb + vc);
  set(vb * denom, vc * denom);
}
