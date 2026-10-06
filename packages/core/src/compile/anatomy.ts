import { Vector3 } from 'three';
import type { MassDef } from './types.ts';

/**
 * Anatomy from rules (docs/design/8.1-anatomy.md): muscle bellies, joint caps and a chest keel
 * as masses on bones, and radius multipliers for joints, chitin segments, the torso and tails.
 * Everything scales with `s = 2 × muscle` (0 to 2) and vanishes at s = 0, where a creature
 * compiles to exactly the mesh it had before.
 */

/** `s` from a muscle value (0 to 1; default 0.5 gives 1). */
export function strength(muscle: number): number {
  return Math.max(0, Math.min(2, muscle * 2));
}

/** A smooth bump: 1 at `c`, about 0.37 at `c ± w`. */
export function bump(x: number, c: number, w: number): number {
  const d = (x - c) / w;
  return Math.exp(-d * d);
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Radius multiplier along a limb, at `T` (0 at the root, 1 at the tip; joints at k/n). Ordinary
 * limbs narrow symmetrically at each joint, most at the last one (ankle, wrist); chitin limbs
 * swell in the middle of each segment and narrow at the joints. The tip never changes, so feet
 * stay on the ground and claws keep their size.
 */
export function limbFactor(T: number, n: number, s: number, chitin: boolean): number {
  if (s <= 0) return 1;
  const keepTip = 1 - smoothstep(0.8, 1, T);
  if (chitin) {
    const k = Math.min(n - 1, Math.floor(T * n));
    const t = T * n - k;
    const swell = Math.sin(Math.PI * t);
    const f = 0.22 * s * swell - 0.1 * s * (1 - swell);
    // The last segment's far end is the tip: keep it.
    return 1 + f * (k === n - 1 ? 1 - smoothstep(0.6, 1, t) : 1);
  }
  let f = 0;
  for (let j = 1; j < n; j++) f -= (j === n - 1 ? 0.26 : 0.18) * s * bump(T, j / n, 0.07);
  return 1 + f * keepTip;
}

/**
 * A bone's radius profile with a multiplier applied: the base profile's points (or the bone's
 * two ends) with a midpoint added, so the shape shows between joints. Unchanged when the
 * multiplier is 1 everywhere (s = 0).
 */
export function shapedProfile(
  radiusAt: (t: number) => number,
  base: readonly number[] | undefined,
  factorAt: (t: number) => number,
): number[] | undefined {
  const spans = base ? base.length - 1 : 2;
  const points = Array.from({ length: spans + 1 }, (_, i) => i / spans);
  if (points.every((t) => Math.abs(factorAt(t) - 1) < 1e-9)) return base ? [...base] : undefined;
  return points.map((t, i) => (base ? (base[i] as number) : radiusAt(t)) * factorAt(t));
}

/** A belly: a capsule along a bone, offset toward its face (q > 0) or back (q < 0). */
interface BellyRule {
  readonly from: number;
  readonly to: number;
  /** How far its outer side reaches past the bone's radius, per unit s. */
  readonly p: number;
  /** Offset of its axis from the bone's, per unit s (toward the face when positive). */
  readonly q: number;
}

/** Bellies by role and segment: thigh and upper arm (front, back), calf, forearm. */
export function bellyRules(
  role: 'leg' | 'arm',
  k: number,
  frontLeg: boolean,
): readonly BellyRule[] {
  if (k === 0)
    return role === 'arm'
      ? [
          { from: 0.3, to: 0.7, p: 0.32, q: 0.2 },
          { from: 0.15, to: 0.6, p: 0.38, q: -0.26 },
        ]
      : [
          // Down the visible part of the thigh: the upper end is inside the body.
          { from: 0.35, to: 0.78, p: 0.38, q: 0.22 },
          { from: 0.25, to: 0.8, p: 0.52, q: -0.32 },
        ];
  if (k === 1)
    return role === 'arm' || frontLeg
      ? [{ from: 0.12, to: 0.45, p: 0.36, q: 0.08 }]
      : [{ from: 0.14, to: 0.5, p: 0.52, q: -0.32 }];
  return [];
}

/**
 * The bellies of one limb bone as masses. `radiusAt` gives the bone's radius along it; `bulk`, a
 * radius the muscle grows toward (for thighs and upper arms, a share of the body they attach to,
 * since those muscles are much thicker than the limb below them), or 0. `taper` is the far end's
 * radius as a share of the near end's.
 */
export function bellies(
  bone: number,
  head: Vector3,
  tail: Vector3,
  face: Vector3,
  radiusAt: (t: number) => number,
  rules: readonly BellyRule[],
  s: number,
  bulk = 0,
  taper = 0.8,
): MassDef[] {
  if (s <= 0) return [];
  const out: MassDef[] = [];
  for (const rule of rules) {
    const tm = (rule.from + rule.to) / 2;
    const limbR = radiusAt(tm);
    const r = limbR + (Math.max(limbR, bulk) - limbR) * Math.min(1, s);
    const offset = face.clone().multiplyScalar(rule.q * s * r);
    // Its outer side reaches r (1 + p s); the far end tapers toward the joint.
    const rho = Math.max(0.5 * r, r * (1 + rule.p * s) - Math.abs(rule.q) * s * r);
    out.push({
      bone,
      a: new Vector3().lerpVectors(head, tail, rule.from).add(offset),
      b: new Vector3().lerpVectors(head, tail, rule.to).add(offset),
      ra: rho,
      rb: rho * taper,
      up: face.clone(),
      // Narrower across than front to back, so no belly grows toward the other leg.
      cross: [0.9, 1],
      blend: 0.45 * r * Math.min(1, s),
    });
  }
  return out;
}

/**
 * A knee or elbow cap on the outside of a bend, owned by the lower bone. Fades in between 10°
 * and 25° of bend, so a straightened joint loses it smoothly.
 */
export function jointCap(
  bone: number,
  joint: Vector3,
  upperHead: Vector3,
  lowerTail: Vector3,
  rJoint: number,
  s: number,
): MassDef | undefined {
  if (s <= 0) return undefined;
  const u = new Vector3().subVectors(upperHead, joint).normalize();
  const v = new Vector3().subVectors(lowerTail, joint).normalize();
  const bend = Math.PI - u.angleTo(v);
  const fade = smoothstep((10 * Math.PI) / 180, (25 * Math.PI) / 180, bend);
  if (fade <= 0) return undefined;
  const out = u.clone().add(v).negate();
  if (out.lengthSq() < 1e-10) return undefined;
  out.normalize();
  const radius = 0.34 * rJoint * (0.6 + 0.4 * Math.min(1, s)) * fade;
  const center = joint.clone().addScaledVector(out, 0.78 * rJoint);
  return {
    bone,
    a: center,
    b: center.clone(),
    ra: radius,
    rb: radius,
    up: out,
    cross: [1, 1],
    blend: 0.4 * rJoint * Math.min(1, s),
  };
}

/** Where the torso gets a chest, a pelvis and a waist, from the limbs on it (`at` values). */
export interface TorsoPlan {
  readonly chest: number | undefined;
  readonly pelvis: number | undefined;
  readonly waist: number | undefined;
}

export function torsoPlan(
  limbs: readonly { readonly role: string; readonly at: number; readonly pair?: number }[],
): TorsoPlan {
  const arms = limbs.filter((l) => l.role === 'arm');
  const legs = limbs.filter((l) => l.role === 'leg');
  const legAts = [...new Set(legs.map((l) => l.at))];
  const front = Math.min(...limbs.map((l) => l.at));
  const hind = Math.max(...legAts);
  const spread = legAts.length > 0 ? hind - Math.min(...legAts) : 0;
  // Pairs clustered near each other (insects, spiders) carry no chest or pelvis.
  const clustered = legAts.length >= 2 && spread < 0.3;
  const chest =
    limbs.length > 0 && !clustered && (arms.length > 0 || legAts.length >= 2)
      ? front + 0.08
      : undefined;
  const pelvis = legs.length > 0 && !clustered ? hind : undefined;
  const waist =
    chest !== undefined && pelvis !== undefined && pelvis - chest >= 0.35
      ? (chest + pelvis) / 2
      : undefined;
  return { chest, pelvis, waist };
}

/** The torso's radius multiplier at `t` (0 front, 1 back). */
export function torsoFactor(t: number, plan: TorsoPlan, s: number): number {
  if (s <= 0) return 1;
  let f = 1;
  if (plan.chest !== undefined) f += 0.14 * s * bump(t, plan.chest, 0.14);
  if (plan.pelvis !== undefined) f += 0.08 * s * bump(t, plan.pelvis, 0.12);
  if (plan.waist !== undefined) f -= 0.09 * s * bump(t, plan.waist, 0.12);
  return f;
}

/** A tail's radius multiplier at `t` (0 at the root): a muscular base. */
export function tailFactor(t: number, s: number): number {
  if (s <= 0) return 1;
  return 1 + 0.22 * s * (1 - smoothstep(0, 0.3, t));
}
