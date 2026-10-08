import type { Coverage } from './raster.ts';

/**
 * The relief's normal map (docs/design/11.1-textures.md, decision 6). Per texel: the surface
 * gradient of the height from its neighbours in the same chart (central differences, one-sided at
 * a chart's edge, none where a thin chart has no neighbour), `n' = normalize(n − ∇h)` as the live
 * bump perturbs it, written in the frame a renderer decodes it in: the interpolated tangent, the
 * bitangent `w · n × t` and the normal, each normalized, as three's shaders build them.
 */
export interface NormalInputs {
  readonly coverage: Coverage;
  /** Height in metres per texel (NaN where empty). */
  readonly height: Float32Array;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly uvs: Float32Array;
  readonly indices: Uint32Array;
  readonly tangents: Float32Array;
  /** Each triangle's texel size in metres. */
  readonly texel: Float32Array;
}

/** Returns three floats per texel (the tangent-space normal, unit length); empty texels 0. */
export function normalMap(inputs: NormalInputs): Float32Array {
  const { coverage, height, positions, normals, uvs, indices, tangents, texel } = inputs;
  const size = coverage.size;
  const out = new Float32Array(size * size * 3);
  // Rest position per texel, to tell a chart's own neighbours from another chart's.
  const where = new Float32Array(size * size * 3);
  for (const k of coverage.texels) {
    const t = coverage.triangle[k] as number;
    const w1 = coverage.weights[k * 2] as number;
    const w2 = coverage.weights[k * 2 + 1] as number;
    const w0 = 1 - w1 - w2;
    for (let c = 0; c < 3; c++)
      where[k * 3 + c] =
        (positions[(indices[t * 3] as number) * 3 + c] as number) * w0 +
        (positions[(indices[t * 3 + 1] as number) * 3 + c] as number) * w1 +
        (positions[(indices[t * 3 + 2] as number) * 3 + c] as number) * w2;
  }
  const jac = jacobians(positions, uvs, indices, size);
  const same = (k: number, j: number, t: number) => {
    if ((coverage.triangle[j] as number) < 0) return false;
    const d = Math.hypot(
      (where[j * 3] as number) - (where[k * 3] as number),
      (where[j * 3 + 1] as number) - (where[k * 3 + 1] as number),
      (where[j * 3 + 2] as number) - (where[k * 3 + 2] as number),
    );
    return d < 3 * (texel[t] as number);
  };
  const slope = (k: number, x: number, y: number, dx: number, dy: number, t: number) => {
    const fwd = x + dx < size && y + dy < size ? (y + dy) * size + x + dx : -1;
    const back = x - dx >= 0 && y - dy >= 0 ? (y - dy) * size + x - dx : -1;
    const f = fwd >= 0 && same(k, fwd, t);
    const b = back >= 0 && same(k, back, t);
    const h = height[k] as number;
    if (f && b) return ((height[fwd] as number) - (height[back] as number)) / 2;
    if (f) return (height[fwd] as number) - h;
    if (b) return h - (height[back] as number);
    return 0;
  };
  for (const k of coverage.texels) {
    const t = coverage.triangle[k] as number;
    const x = k % size;
    const y = (k - x) / size;
    const hu = slope(k, x, y, 1, 0, t);
    const hv = slope(k, x, y, 0, 1, t);
    // ∇h = J (JᵀJ)⁻¹ [hu, hv], J's columns the world steps of one texel along u and v.
    const ux = jac[t * 6] as number;
    const uy = jac[t * 6 + 1] as number;
    const uz = jac[t * 6 + 2] as number;
    const vx = jac[t * 6 + 3] as number;
    const vy = jac[t * 6 + 4] as number;
    const vz = jac[t * 6 + 5] as number;
    const a = ux * ux + uy * uy + uz * uz;
    const b = ux * vx + uy * vy + uz * vz;
    const d = vx * vx + vy * vy + vz * vz;
    const det = a * d - b * b;
    let gx = 0;
    let gy = 0;
    let gz = 0;
    if (det > 1e-30) {
      const cu = (d * hu - b * hv) / det;
      const cv = (a * hv - b * hu) / det;
      gx = ux * cu + vx * cv;
      gy = uy * cu + vy * cv;
      gz = uz * cu + vz * cv;
    }
    const w1 = coverage.weights[k * 2] as number;
    const w2 = coverage.weights[k * 2 + 1] as number;
    const w0 = 1 - w1 - w2;
    const i0 = indices[t * 3] as number;
    const i1 = indices[t * 3 + 1] as number;
    const i2 = indices[t * 3 + 2] as number;
    const lerp = (array: Float32Array, stride: number, c: number) =>
      (array[i0 * stride + c] as number) * w0 +
      (array[i1 * stride + c] as number) * w1 +
      (array[i2 * stride + c] as number) * w2;
    const n = unit(lerp(normals, 3, 0), lerp(normals, 3, 1), lerp(normals, 3, 2));
    const tn = unit(lerp(tangents, 4, 0), lerp(tangents, 4, 1), lerp(tangents, 4, 2));
    const w = (tangents[i0 * 4 + 3] as number) < 0 ? -1 : 1;
    const bn = unit(
      w * (n[1] * tn[2] - n[2] * tn[1]),
      w * (n[2] * tn[0] - n[0] * tn[2]),
      w * (n[0] * tn[1] - n[1] * tn[0]),
    );
    const p = unit(n[0] - gx, n[1] - gy, n[2] - gz);
    // Solve [t b n] · m = p, since the frame need not be orthonormal.
    const m = solve(tn, bn, n, p);
    const l = Math.hypot(m[0], m[1], m[2]) || 1;
    out[k * 3] = m[0] / l;
    out[k * 3 + 1] = m[1] / l;
    out[k * 3 + 2] = m[2] / l;
  }
  return out;
}

/** Per triangle, the world steps of one texel along u and along v (six floats). */
function jacobians(
  positions: Float32Array,
  uvs: Float32Array,
  indices: Uint32Array,
  size: number,
): Float32Array {
  const count = indices.length / 3;
  const out = new Float32Array(count * 6);
  for (let t = 0; t < count; t++) {
    const a = indices[t * 3] as number;
    const b = indices[t * 3 + 1] as number;
    const c = indices[t * 3 + 2] as number;
    const du1 = ((uvs[b * 2] as number) - (uvs[a * 2] as number)) * size;
    const dv1 = ((uvs[b * 2 + 1] as number) - (uvs[a * 2 + 1] as number)) * size;
    const du2 = ((uvs[c * 2] as number) - (uvs[a * 2] as number)) * size;
    const dv2 = ((uvs[c * 2 + 1] as number) - (uvs[a * 2 + 1] as number)) * size;
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    const inv = 1 / det;
    for (let k = 0; k < 3; k++) {
      const e1 = (positions[b * 3 + k] as number) - (positions[a * 3 + k] as number);
      const e2 = (positions[c * 3 + k] as number) - (positions[a * 3 + k] as number);
      out[t * 6 + k] = (e1 * dv2 - e2 * dv1) * inv;
      out[t * 6 + 3 + k] = (e2 * du1 - e1 * du2) * inv;
    }
  }
  return out;
}

function unit(x: number, y: number, z: number): [number, number, number] {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}

/** Solves [a b c] m = p for m (Cramer's rule); falls back to projections if singular. */
function solve(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
  p: readonly number[],
): [number, number, number] {
  const det3 = (x: readonly number[], y: readonly number[], z: readonly number[]) =>
    (x[0] as number) * ((y[1] as number) * (z[2] as number) - (y[2] as number) * (z[1] as number)) -
    (y[0] as number) * ((x[1] as number) * (z[2] as number) - (x[2] as number) * (z[1] as number)) +
    (z[0] as number) * ((x[1] as number) * (y[2] as number) - (x[2] as number) * (y[1] as number));
  const d = det3(a, b, c);
  if (Math.abs(d) < 1e-9) {
    const dot = (u: readonly number[]) =>
      (u[0] as number) * (p[0] as number) +
      (u[1] as number) * (p[1] as number) +
      (u[2] as number) * (p[2] as number);
    return [dot(a), dot(b), dot(c)];
  }
  return [det3(p, b, c) / d, det3(a, p, c) / d, det3(a, b, p) / d];
}
