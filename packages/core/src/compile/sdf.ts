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
  /**
   * Per primitive (stride 29): a(3) b(3) ra rb side(3) up(3) dir(3) sx sy h chain bone kind
   * 1/sx 1/sy min(sx,sy) cone-b cone-a degenerate.
   */
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

const STRIDE = 29;
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
    const degenerate = h < 1e-9 || Math.abs(ra - rb) >= h ? 1 : 0;
    const coneB = degenerate ? 0 : (ra - rb) / h;
    const coneA = degenerate ? 1 : Math.sqrt(1 - coneB * coneB);
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
      1 / sx,
      1 / sy,
      Math.min(sx, sy),
      coneB,
      coneA,
      degenerate,
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
      const thinness =
        Math.max(bone.r0, bone.r1, ...(bone.profile ?? [])) *
        Math.min(bone.cross[0], bone.cross[1]);
      if (thinness < minRadius) {
        thinBones.push(id);
        continue;
      }
      const dir = new Vector3().subVectors(bone.tail, bone.head);
      if (dir.lengthSq() < 1e-14) dir.copy(bone.up).cross(new Vector3(1, 0, 0));
      dir.normalize();
      const up = bone.up.clone().addScaledVector(dir, -bone.up.dot(dir)).normalize();
      const side = new Vector3().crossVectors(up, dir).normalize();
      const profile = bone.profile;
      if (profile && profile.length > 2) {
        // One cone per span of the profile, so radius profiles show between joints too.
        const spans = profile.length - 1;
        for (let k = 0; k < spans; k++) {
          const a = new Vector3().lerpVectors(bone.head, bone.tail, k / spans);
          const b = new Vector3().lerpVectors(bone.head, bone.tail, (k + 1) / spans);
          const [sx, sy] = bone.cross;
          push(
            a,
            b,
            profile[k] as number,
            profile[k + 1] as number,
            side,
            up,
            dir,
            sx,
            sy,
            ci,
            id,
            0,
          );
        }
      } else {
        const [sx, sy] = bone.cross;
        push(bone.head, bone.tail, bone.r0, bone.r1, side, up, dir, sx, sy, ci, id, 0);
      }
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
  const lx =
    (qx * (d[o + 8] as number) + qy * (d[o + 9] as number) + qz * (d[o + 10] as number)) *
    (d[o + 23] as number);
  const ly =
    (qx * (d[o + 11] as number) + qy * (d[o + 12] as number) + qz * (d[o + 13] as number)) *
    (d[o + 24] as number);
  const lz = qx * (d[o + 14] as number) + qy * (d[o + 15] as number) + qz * (d[o + 16] as number);
  const r1 = d[o + 6] as number;
  const r2 = d[o + 7] as number;
  const h = d[o + 19] as number;
  const scale = d[o + 25] as number;
  const qr2 = lx * lx + ly * ly;
  if ((d[o + 28] as number) === 1) {
    // Degenerate cone: the larger end sphere contains the other.
    const da = Math.sqrt(qr2 + lz * lz) - r1;
    const db = Math.sqrt(qr2 + (lz - h) * (lz - h)) - r2;
    return (da < db ? da : db) * scale;
  }
  const b = d[o + 26] as number;
  const a = d[o + 27] as number;
  const qr = Math.sqrt(qr2);
  const k = -b * qr + a * lz;
  let dist: number;
  if (k < 0) dist = Math.sqrt(qr2 + lz * lz) - r1;
  else if (k > a * h) dist = Math.sqrt(qr2 + (lz - h) * (lz - h)) - r2;
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
  private readonly touched: Int32Array;
  private stamp = 1;
  /** Plain union of the last evaluation (for crease depth). */
  union = BIG;
  /** Primitive nearest the last evaluated point. */
  nearestPrim = -1;

  constructor(sdf: Sdf) {
    this.sdf = sdf;
    this.chainD = new Float64Array(sdf.chainCount);
    this.touched = new Int32Array(sdf.chainCount);
  }

  /** Field value at a point, using only `prims` (or every primitive when omitted). */
  eval(px: number, py: number, pz: number, prims?: ArrayLike<number>, primCount?: number): number {
    const sdf = this.sdf;
    const chainD = this.chainD;
    const touched = this.touched;
    const stamp = this.stamp;
    const n = prims ? (primCount ?? prims.length) : sdf.count;
    let union = BIG;
    let nearest = -1;
    let lowest = sdf.chainCount;
    let highest = -1;
    for (let j = 0; j < n; j++) {
      const i = prims ? (prims[j] as number) : j;
      const dist = primDistance(sdf, i, px, py, pz);
      const c = sdf.data[i * STRIDE + 20] as number;
      if (touched[c] !== stamp) {
        touched[c] = stamp;
        chainD[c] = dist;
        if (c < lowest) lowest = c;
        if (c > highest) highest = c;
      } else if (dist < (chainD[c] as number)) {
        chainD[c] = dist;
      }
      if (dist < union) {
        union = dist;
        nearest = i;
      }
    }
    // Fold children into parents; parents always have lower indices than their children.
    let d = BIG;
    for (let c = highest; c >= 0 && c >= lowest; c--) {
      if (touched[c] !== stamp) continue;
      const child = chainD[c] as number;
      const parent = sdf.chainParent[c] as number;
      if (parent < 0) {
        if (child < d) d = child;
        continue;
      }
      if (touched[parent] !== stamp) {
        // The parent is out of reach here, so the child passes through unblended.
        touched[parent] = stamp;
        chainD[parent] = child;
        if (parent < lowest) lowest = parent;
        continue;
      }
      chainD[parent] = smin(chainD[parent] as number, child, sdf.chainBlend[c] as number);
    }
    this.stamp = stamp >= 0x3fffffff ? 1 : stamp + 1;
    this.union = union;
    this.nearestPrim = nearest;
    return d;
  }

  /**
   * Field value and normalized gradient from the same four tetrahedron samples: their average is
   * the value at the centre to second order. Half the cost of `eval` plus `gradient`.
   */
  valueAndGradient(
    px: number,
    py: number,
    pz: number,
    eps: number,
    prims: ArrayLike<number> | undefined,
    out: Vector3,
  ): number {
    const a = this.eval(px + eps, py - eps, pz - eps, prims);
    const b = this.eval(px - eps, py - eps, pz + eps, prims);
    const c = this.eval(px - eps, py + eps, pz - eps, prims);
    const d = this.eval(px + eps, py + eps, pz + eps, prims);
    out.set(a - b - c + d, -a - b + c + d, -a + b - c + d);
    const len = out.length();
    if (len > 1e-12) out.divideScalar(len);
    else out.set(0, 1, 0);
    return (a + b + c + d) / 4;
  }

  /** Normalized gradient from four samples on a tetrahedron. */
  gradient(
    px: number,
    py: number,
    pz: number,
    eps: number,
    prims?: ArrayLike<number>,
    primCount?: number,
    out = new Vector3(),
  ): Vector3 {
    const a = this.eval(px + eps, py - eps, pz - eps, prims, primCount);
    const b = this.eval(px - eps, py - eps, pz + eps, prims, primCount);
    const c = this.eval(px - eps, py + eps, pz - eps, prims, primCount);
    const d = this.eval(px + eps, py + eps, pz + eps, prims, primCount);
    out.set(a - b - c + d, -a - b + c + d, -a + b - c + d);
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
