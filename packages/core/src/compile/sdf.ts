import { Vector3 } from 'three';
import type { BoneDef, ChainDef } from './types.ts';

/**
 * The creature's signed distance field: a rounded cone per skin bone (optionally with an
 * elliptical cross-section), plain union inside a chain, and a smooth minimum once per junction
 * where a chain meets its parent. Primitives live in flat typed arrays so evaluation stays fast.
 */
export interface Sdf {
  /** Number of primitives. */
  readonly count: number;
  /** Per primitive (stride 24): a(3) b(3) ra rb side(3) up(3) dir(3) sx sy h chain bone kind pad. */
  readonly data: Float64Array;
  readonly chainCount: number;
  /** Parent chain per chain (-1 for the root chain). Parents come before children. */
  readonly chainParent: Int32Array;
  /** Smooth-min radius per chain at its junction with its parent (metres). */
  readonly chainBlend: Float64Array;
  /** Bounding sphere per primitive: centre(3) radius. */
  readonly bounds: Float64Array;
  readonly maxBlend: number;
  /** Bones left out of the field because they are thinner than the grid can show. */
  readonly thinBones: readonly number[];
}

const STRIDE = 24;
const BIG = 1e9;

/** Builds the field from the skeleton, leaving out bones thinner than `minRadius`. */
export function buildSdf(
  bones: readonly BoneDef[],
  chains: readonly ChainDef[],
  minRadius: number,
): Sdf {
  const prims: number[] = [];
  const bounds: number[] = [];
  const thinBones: number[] = [];
  const chainIndex = new Map<number, number>();
  chains.forEach((c, i) => {
    chainIndex.set(i, i);
  });
  const boneChain = (bone: number) => (bones[bone] as BoneDef).chain;

  const push = (
    a: Vector3,
    b: Vector3,
    ra: number,
    rb: number,
    side: Vector3,
    up: Vector3,
    dir: Vector3,
    sx: number,
    sy: number,
    chain: number,
    bone: number,
    kind: number,
  ) => {
    const h = a.distanceTo(b);
    prims.push(
      a.x,
      a.y,
      a.z,
      b.x,
      b.y,
      b.z,
      ra,
      rb,
      side.x,
      side.y,
      side.z,
      up.x,
      up.y,
      up.z,
      dir.x,
      dir.y,
      dir.z,
      sx,
      sy,
      h,
      chain,
      bone,
      kind,
      0,
    );
    const scale = Math.max(sx, sy);
    bounds.push(
      (a.x + b.x) / 2,
      (a.y + b.y) / 2,
      (a.z + b.z) / 2,
      h / 2 + Math.max(ra, rb) * scale,
    );
  };

  for (const [ci, chain] of chains.entries()) {
    for (const id of chain.bones) {
      const bone = bones[id] as BoneDef;
      if (!bone.skin) continue;
      const thinness = Math.max(bone.r0, bone.r1) * Math.min(bone.cross[0], bone.cross[1]);
      if (thinness < minRadius) {
        thinBones.push(id);
        continue;
      }
      const dir = new Vector3().subVectors(bone.tail, bone.head);
      if (dir.lengthSq() < 1e-14) dir.copy(bone.up).cross(new Vector3(1, 0, 0));
      dir.normalize();
      const up = bone.up.clone().addScaledVector(dir, -bone.up.dot(dir)).normalize();
      const side = new Vector3().crossVectors(up, dir).normalize();
      push(
        bone.head,
        bone.tail,
        bone.r0,
        bone.r1,
        side,
        up,
        dir,
        bone.cross[0],
        bone.cross[1],
        ci,
        id,
        0,
      );
    }
    for (const mass of chain.masses) {
      const first = chain.bones[0] ?? -1;
      push(
        mass.center,
        mass.center,
        mass.radius,
        mass.radius,
        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, 0, 1),
        1,
        1,
        ci,
        first,
        1,
      );
    }
  }

  const chainParent = new Int32Array(chains.length);
  const chainBlend = new Float64Array(chains.length);
  let maxBlend = 0;
  chains.forEach((c, i) => {
    chainParent[i] = c.parentBone >= 0 ? boneChain(c.parentBone) : -1;
    chainBlend[i] = c.blend;
    maxBlend = Math.max(maxBlend, c.blend);
  });
  void chainIndex;
  return {
    count: prims.length / STRIDE,
    data: new Float64Array(prims),
    chainCount: chains.length,
    chainParent,
    chainBlend,
    bounds: new Float64Array(bounds),
    maxBlend,
    thinBones,
  };
}

/** Distance to one primitive. */
export function primDistance(sdf: Sdf, i: number, px: number, py: number, pz: number): number {
  const d = sdf.data;
  const o = i * STRIDE;
  const qx = px - (d[o] as number);
  const qy = py - (d[o + 1] as number);
  const qz = pz - (d[o + 2] as number);
  const sx = d[o + 17] as number;
  const sy = d[o + 18] as number;
  const lx =
    (qx * (d[o + 8] as number) + qy * (d[o + 9] as number) + qz * (d[o + 10] as number)) / sx;
  const ly =
    (qx * (d[o + 11] as number) + qy * (d[o + 12] as number) + qz * (d[o + 13] as number)) / sy;
  const lz = qx * (d[o + 14] as number) + qy * (d[o + 15] as number) + qz * (d[o + 16] as number);
  const r1 = d[o + 6] as number;
  const r2 = d[o + 7] as number;
  const h = d[o + 19] as number;
  const qr = Math.sqrt(lx * lx + ly * ly);
  const scale = sx < sy ? sx : sy;
  if (h < 1e-9 || Math.abs(r1 - r2) >= h) {
    // Degenerate cone: the larger end sphere contains the other.
    const da = Math.sqrt(qr * qr + lz * lz) - r1;
    const db = Math.sqrt(qr * qr + (lz - h) * (lz - h)) - r2;
    return (da < db ? da : db) * scale;
  }
  const b = (r1 - r2) / h;
  const a = Math.sqrt(1 - b * b);
  const k = -b * qr + a * lz;
  let dist: number;
  if (k < 0) dist = Math.sqrt(qr * qr + lz * lz) - r1;
  else if (k > a * h) dist = Math.sqrt(qr * qr + (lz - h) * (lz - h)) - r2;
  else dist = qr * a + lz * b - r1;
  return dist * scale;
}

/** Polynomial smooth minimum with blend radius k. */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return (a < b ? a : b) - h * h * k * 0.25;
}

/** Scratch buffers for evaluation (one per thread of use). */
export class SdfEvaluator {
  readonly sdf: Sdf;
  private readonly chainD: Float64Array;
  /** Plain union of the last evaluation (for crease depth). */
  union = BIG;
  /** Primitive nearest the last evaluated point, and its distance. */
  nearestPrim = -1;

  constructor(sdf: Sdf) {
    this.sdf = sdf;
    this.chainD = new Float64Array(sdf.chainCount);
  }

  /** Field value at a point, using only `prims` (or every primitive when omitted). */
  eval(px: number, py: number, pz: number, prims?: ArrayLike<number>, primCount?: number): number {
    const sdf = this.sdf;
    const chainD = this.chainD;
    chainD.fill(BIG);
    const n = prims ? (primCount ?? prims.length) : sdf.count;
    let union = BIG;
    let nearest = -1;
    for (let j = 0; j < n; j++) {
      const i = prims ? (prims[j] as number) : j;
      const dist = primDistance(sdf, i, px, py, pz);
      const c = sdf.data[i * STRIDE + 20] as number;
      if (dist < (chainD[c] as number)) chainD[c] = dist;
      if (dist < union) {
        union = dist;
        nearest = i;
      }
    }
    for (let c = sdf.chainCount - 1; c > 0; c--) {
      const parent = sdf.chainParent[c] as number;
      if (parent < 0) continue;
      const child = chainD[c] as number;
      if (child >= BIG) continue;
      chainD[parent] = smin(chainD[parent] as number, child, sdf.chainBlend[c] as number);
    }
    this.union = union;
    this.nearestPrim = nearest;
    // Chains with no parent other than chain 0 fold into chain 0 above; any orphan roots join by min.
    let d = chainD[0] as number;
    for (let c = 1; c < sdf.chainCount; c++) {
      if ((sdf.chainParent[c] as number) < 0 && (chainD[c] as number) < d) d = chainD[c] as number;
    }
    return d;
  }

  /** Normalized gradient by central differences. */
  gradient(
    px: number,
    py: number,
    pz: number,
    eps: number,
    prims?: ArrayLike<number>,
    primCount?: number,
    out = new Vector3(),
  ): Vector3 {
    const dx =
      this.eval(px + eps, py, pz, prims, primCount) - this.eval(px - eps, py, pz, prims, primCount);
    const dy =
      this.eval(px, py + eps, pz, prims, primCount) - this.eval(px, py - eps, pz, prims, primCount);
    const dz =
      this.eval(px, py, pz + eps, prims, primCount) - this.eval(px, py, pz - eps, prims, primCount);
    out.set(dx, dy, dz);
    const len = out.length();
    return len > 1e-12 ? out.divideScalar(len) : out.set(0, 1, 0);
  }
}

export const SDF_STRIDE = STRIDE;
export const SDF_BIG = BIG;

/** The bone a primitive belongs to. */
export function primBone(sdf: Sdf, i: number): number {
  return sdf.data[i * STRIDE + 21] as number;
}
