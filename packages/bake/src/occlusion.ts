import { type Sdf, SdfEvaluator } from '@spawnforge/core';

/** Distances along the normal, in torso lengths (decision 7). */
const STEPS = [0.01, 0.02, 0.04, 0.06, 0.08];

/**
 * Ambient occlusion per vertex from the skin's distance field (docs/design/11.1-textures.md,
 * decision 7): how much the field closes in along its normal, `1 − Σ 2⁻ⁱ max(0, dᵢ − (f(p + n dᵢ)
 * − f(p))) / dᵢ`, so a 90° crease gives about 0.7 and open skin 1. The mesh is not exactly the
 * field (heads are refined finer, muscle moves the skin), so a vertex off it is first moved onto
 * it along the field's gradient, and sampled along the field's own normal there; one far outside
 * it (thin tubes) stays open. Never below 0.4. `open` marks vertices left at 1 (inside the mouth).
 */
export function occlusion(
  field: Sdf,
  scale: number,
  positions: Float32Array,
  normals: Float32Array,
  open?: (vertex: number) => boolean,
): Float32Array {
  const evaluator = new SdfEvaluator(field);
  evaluator.details = true;
  const f = (x: number, y: number, z: number) => evaluator.eval(x, y, z);
  const n = positions.length / 3;
  const out = new Float32Array(n).fill(1);
  const near = 0.004 * scale;
  const far = 0.05 * scale;
  const h = 0.002 * scale;
  for (let v = 0; v < n; v++) {
    if (open?.(v)) continue;
    let px = positions[v * 3] as number;
    let py = positions[v * 3 + 1] as number;
    let pz = positions[v * 3 + 2] as number;
    let nx = normals[v * 3] as number;
    let ny = normals[v * 3 + 1] as number;
    let nz = normals[v * 3 + 2] as number;
    let f0 = f(px, py, pz);
    if (f0 > far) continue;
    if (Math.abs(f0) > near) {
      // Onto the field along its gradient, then its normal.
      const gx = f(px + h, py, pz) - f(px - h, py, pz);
      const gy = f(px, py + h, pz) - f(px, py - h, pz);
      const gz = f(px, py, pz + h) - f(px, py, pz - h);
      const l = Math.hypot(gx, gy, gz);
      if (l < 1e-12) continue;
      nx = gx / l;
      ny = gy / l;
      nz = gz / l;
      px -= nx * f0;
      py -= ny * f0;
      pz -= nz * f0;
      f0 = f(px, py, pz);
    }
    let shut = 0;
    let weight = 0.5;
    for (const step of STEPS) {
      const d = step * scale;
      const fd = f(px + nx * d, py + ny * d, pz + nz * d);
      shut += (weight * Math.max(0, d - (fd - f0))) / d;
      weight *= 0.5;
    }
    out[v] = Math.min(1, Math.max(0.4, 1 - shut));
  }
  return out;
}
