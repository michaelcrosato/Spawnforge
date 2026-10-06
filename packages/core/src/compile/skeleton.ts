import { Vector3 } from 'three';
import type { CreatureSpec, CrossSection, LimbSpec } from '../blueprint/creature.ts';
import type { PartModule, Registry } from '../registry.ts';
import {
  bellies,
  bellyRules,
  jointCap,
  limbFactor,
  shapedProfile,
  strength,
  tailFactor,
  torsoFactor,
  torsoPlan,
} from './anatomy.ts';
import { type LimbIkSetup, solveLimb } from './ik.ts';
import { sampleProfile } from './profile.ts';
import type {
  ArmRig,
  BoneDef,
  BoneSection,
  ChainDef,
  LegRig,
  MassDef,
  Rig,
  Skeleton,
  ToeChain,
  ToeContext,
} from './types.ts';

const DEG = Math.PI / 180;
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

export const CROSS_SCALE: Record<CrossSection, readonly [number, number]> = {
  round: [1, 1],
  tall: [0.8, 1.18],
  wide: [1.22, 0.82],
};

/** Snout radius as a share of the skull radius, and the head's own cross-section. */
const HEAD_SHAPES = {
  round: { front: 0.8, cross: [1, 1] },
  snout: { front: 0.42, cross: [0.95, 1] },
  flat: { front: 0.72, cross: [1.25, 0.72] },
  wedge: { front: 0.4, cross: [1.15, 0.78] },
} as const;

/** Leg segment lengths as shares of the whole limb, by segment count. */
const SEGMENT_SHARES: Record<number, readonly number[]> = {
  2: [0.5, 0.5],
  3: [0.4, 0.35, 0.25],
  4: [0.32, 0.3, 0.23, 0.15],
};

/** Rest bends (degrees, positive toward the pole) per joint, by limb type and segment count. */
const BENDS = {
  hind: { 2: [-50], 3: [-75, 55], 4: [-60, 50, -30] },
  front: { 2: [-45], 3: [-50, 15], 4: [-45, 25, -15] },
  sprawl: { 2: [-100], 3: [-110, 30], 4: [-100, 35, -20] },
  arm: { 2: [-40], 3: [-40, 20], 4: [-35, 20, -15] },
} as const;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Radii at a few points along a bone from a section profile, when it varies within the bone. */
function boneProfile(
  values: readonly number[],
  ta: number,
  tb: number,
  scale: number,
): number[] | undefined {
  if (values.length <= 2) return undefined;
  const spans = 4;
  return Array.from(
    { length: spans + 1 },
    (_, k) => sampleProfile(values, ta + ((tb - ta) * k) / spans) * scale,
  );
}
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const sameProfile = (a: readonly number[], b: readonly number[] | undefined) =>
  b !== undefined && a.length === b.length && a.every((v, i) => v === b[i]);

/** Dorsal "up" for a bone on the main axis whose forward (snout-ward) direction is `forward`. */
export function dorsalUp(forward: Vector3): Vector3 {
  const up = new Vector3().crossVectors(forward, X);
  if (up.lengthSq() < 1e-10) return Y.clone();
  return up.normalize();
}

/** A section path: bones with the section's `at` value at each end, for sampling. */
export interface PathSegment {
  readonly bone: number;
  readonly t0: number;
  readonly t1: number;
}

export interface SkeletonBuild extends Skeleton {
  /** Section paths by name: torso, neck, head, jaw, tail, spine, and each limb and toe id. */
  readonly paths: ReadonlyMap<string, readonly PathSegment[]>;
  /** Helper bones that take half of a joint's rotation: [helper, upper bone, lower bone]. */
  readonly helpers: readonly (readonly [number, number, number])[];
  /** Notes for validation warnings, e.g. legs that cannot reach the ground. */
  readonly notes: readonly {
    readonly path: string;
    readonly code: string;
    readonly message: string;
  }[];
}

interface Frame {
  point: Vector3;
  /** Toward the section's at = 0 end (snout-ward on body sections). */
  forward: Vector3;
  up: Vector3;
  radius: number;
  cross: readonly [number, number];
  bone: number;
}

/** Samples a section path at `at`, extrapolating past its ends along the end bones. */
export function samplePath(
  bones: readonly BoneDef[],
  path: readonly PathSegment[],
  at: number,
): Frame {
  let seg = path[0] as PathSegment;
  let best = Number.POSITIVE_INFINITY;
  for (const s of path) {
    const lo = Math.min(s.t0, s.t1);
    const hi = Math.max(s.t0, s.t1);
    const d = at < lo ? lo - at : at > hi ? at - hi : 0;
    if (d < best - 1e-12) {
      best = d;
      seg = s;
    }
  }
  const bone = bones[seg.bone] as BoneDef;
  const f = seg.t1 === seg.t0 ? 0 : (at - seg.t0) / (seg.t1 - seg.t0);
  const point = new Vector3().lerpVectors(bone.head, bone.tail, f);
  const dir = new Vector3().subVectors(bone.tail, bone.head).normalize();
  const forward = seg.t1 < seg.t0 ? dir : dir.clone().negate();
  const up = bone.up.clone().addScaledVector(forward, -bone.up.dot(forward)).normalize();
  return {
    point,
    forward,
    up,
    radius: lerp(bone.r0, bone.r1, clamp01(f)),
    cross: bone.cross,
    bone: seg.bone,
  };
}

/** Radius of an elliptical cross-section in the direction `angle` (degrees from the top). */
export function radiusAt(
  radius: number,
  cross: readonly [number, number],
  angleDeg: number,
): number {
  const a = angleDeg * DEG;
  return radius * Math.hypot(cross[0] * Math.sin(a), cross[1] * Math.cos(a));
}

/** Direction around a section: 0 is `up`, 90 is the `mirror` side, 180 is down. */
export function aroundDirection(
  frame: { forward: Vector3; up: Vector3 },
  angleDeg: number,
  mirror: number,
): Vector3 {
  const left = new Vector3().crossVectors(frame.up, frame.forward).normalize();
  const a = angleDeg * DEG;
  return frame.up
    .clone()
    .multiplyScalar(Math.cos(a))
    .addScaledVector(left, mirror * Math.sin(a))
    .normalize();
}

class Builder {
  readonly bones: BoneDef[] = [];
  readonly chains: ChainDef[] = [];
  readonly paths = new Map<string, PathSegment[]>();
  readonly helpers: [number, number, number][] = [];

  bone(def: Omit<BoneDef, 'chain'>, chain = -1): number {
    this.bones.push({ ...def, chain });
    return this.bones.length - 1;
  }

  chain(def: Omit<ChainDef, 'bones'>, boneIds: number[]): number {
    const index = this.chains.length;
    this.chains.push({ ...def, bones: boneIds });
    for (const id of boneIds) {
      const b = this.bones[id] as BoneDef;
      this.bones[id] = { ...b, chain: index };
    }
    return index;
  }

  path(name: string, segments: PathSegment[]): void {
    this.paths.set(name, segments);
  }
}

interface BodyLayout {
  torso: { points: Vector3[]; ts: number[] };
  center: Vector3;
  pitch: number;
}

/** Torso points (back to front order not assumed) for a given pitch and centre. */
function torsoPoints(spec: CreatureSpec, pitchDeg: number, center: Vector3, count: number) {
  const L = spec.scale;
  const p = pitchDeg * DEG;
  const d = new Vector3(0, Math.sin(p), Math.cos(p));
  const u = new Vector3(0, Math.cos(p), -Math.sin(p));
  const arch = spec.body.torso.arch;
  const points: Vector3[] = [];
  const ts: number[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count; // 0 = front (neck end), 1 = back (tail end)
    points.push(
      center
        .clone()
        .addScaledVector(d, (0.5 - t) * L)
        .addScaledVector(u, arch * L * 4 * t * (1 - t)),
    );
    ts.push(t);
  }
  return { points, ts };
}

/** Builds the rest-pose skeleton: main axis, limbs (feet on the ground) and toes. */
export function buildSkeleton(spec: CreatureSpec, registry: Registry): SkeletonBuild {
  const L = spec.scale;
  const notes: { path: string; code: string; message: string }[] = [];
  const legs = spec.limbs.filter((l) => l.role === 'leg');
  // Anatomy (docs/design/8.1-anatomy.md): s = 2 × muscle; everything below is unchanged at 0.
  const sBody = strength(spec.body.muscle);
  const chitin = spec.skin.material === 'chitin';
  // Legless bodies rest on a slightly flattened belly.
  const flatten = (c: readonly [number, number]): readonly [number, number] =>
    legs.length === 0 && sBody > 0 ? [c[0] * (1 + 0.04 * sBody), c[1] * (1 - 0.06 * sBody)] : c;
  const torsoCross = flatten(CROSS_SCALE[spec.body.torso.crossSection]);
  const torsoRadius = (t: number) => sampleProfile(spec.body.torso.radius, t) * L;
  const plan = torsoPlan(spec.limbs.filter((l) => l.on === 'torso'));
  const torsoSegments = spec.body.torso.segments;

  // --- Posture: torso height and pitch from where the legs need their hips ------------------
  const layoutFor = (pitch: number, center: Vector3): BodyLayout => ({
    torso: torsoPoints(spec, pitch, center, torsoSegments * 4),
    center,
    pitch,
  });
  const torsoSampler = (layout: BodyLayout) => (t: number) => {
    const pts = layout.torso.points;
    const x = clamp01(t) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(x));
    const point = new Vector3().lerpVectors(pts[i] as Vector3, pts[i + 1] as Vector3, x - i);
    const forward = new Vector3().subVectors(pts[i] as Vector3, pts[i + 1] as Vector3).normalize();
    return { point, forward, up: dorsalUp(forward), radius: torsoRadius(t), cross: torsoCross };
  };

  const posture =
    legs.length === 0 ? 'legless' : legs.some((l) => l.splay >= 35) ? 'sprawl' : 'upright';
  const lastPair = Math.max(0, ...legs.map((l) => l.pair ?? 0));
  const legPlan = (limb: LimbSpec) => {
    const R = limb.length * L;
    const sw = clamp01(limb.splay / 60);
    const tipR = (limb.radius.at(-1) ?? 0.03) * L;
    const footH = Math.max(tipR, 0.012 * L);
    // Upright two-legged walkers stand nearly straight-legged; four-legged ones a little more
    // flexed; sprawlers low.
    const biped = lastPair === 0;
    const upright = biped ? 0.91 : limb.segments === 2 ? 0.9 : 0.87;
    const frac = lerp(upright, 0.45, sw);
    let v = frac * R;
    let h = R * Math.sin(limb.splay * 0.9 * DEG) * 0.85;
    // Sprawled legs fan out along the body, front feet forward and hind feet back (further, to
    // carry the abdomen), as insects and lizards stand.
    const u = lastPair > 0 ? ((limb.pair ?? 0) / lastPair) * 2 - 1 : 0;
    let fore = sw * R * (u > 0 ? 0.25 : 0.4) * u;
    // Sprawlers keep more slack in the leg, so a foot can travel fore and aft while planted.
    const most = lerp(0.96, 0.84, sw) * R;
    const len = Math.hypot(v, h, fore);
    if (len > most) {
      v *= most / len;
      h *= most / len;
      fore *= most / len;
    }
    return { R, sw, footH, v, h, fore, tipR };
  };

  const limbRoot = (
    limb: LimbSpec,
    frame: {
      point: Vector3;
      forward: Vector3;
      up: Vector3;
      radius: number;
      cross: readonly [number, number];
    },
  ) => {
    const dir = aroundDirection(frame, limb.angle, limb.mirror);
    return frame.point
      .clone()
      .addScaledVector(dir, radiusAt(frame.radius, frame.cross, limb.angle) * 0.55);
  };

  let pitch = spec.body.torso.pitch;
  let center = new Vector3();
  const torsoLegs = legs.filter((l) => l.on === 'torso' && l.mirror >= 0);
  if (torsoLegs.length > 0) {
    const sample = torsoSampler(layoutFor(pitch, center));
    const rows = torsoLegs.map((limb) => {
      const root = limbRoot(limb, sample(limb.at));
      const plan = legPlan(limb);
      return { y: root.y, z: root.z, want: plan.v + plan.footH };
    });
    const zs = rows.map((r) => r.z);
    const spread = Math.max(...zs) - Math.min(...zs);
    let delta = 0;
    let cy: number;
    if (spread > 0.05 * L && Math.abs(pitch) < 45) {
      // Least squares for height cy and pitch change delta: y + cy + z·delta = want.
      const n = rows.length;
      const mz = zs.reduce((a, b) => a + b, 0) / n;
      const mr = rows.reduce((a, r) => a + (r.want - r.y), 0) / n;
      let num = 0;
      let den = 0;
      for (const r of rows) {
        num += (r.z - mz) * (r.want - r.y - mr);
        den += (r.z - mz) ** 2;
      }
      // Damped toward the blueprint's pitch, strongly for sprawlers whose legs cluster near the
      // front: they keep the body level and let the legs adapt.
      const damping = n * (0.35 * L) ** 2 * (posture === 'sprawl' ? 1 : 0.15);
      delta = Math.max(-0.4, Math.min(0.4, num / (den + damping)));
      cy = mr - mz * delta;
    } else {
      cy = rows.reduce((a, r) => a + (r.want - r.y), 0) / rows.length;
    }
    pitch += delta / DEG;
    center = new Vector3(0, cy, 0);
  } else {
    // Legless: the body rests on the ground.
    let lowest = 0;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      lowest = Math.max(lowest, torsoRadius(t) * torsoCross[1]);
    }
    center = new Vector3(0, lowest * 0.95, 0);
    pitch = legs.length === 0 ? Math.min(pitch, 15) : pitch;
  }
  const layout = layoutFor(pitch, center);
  const sampleTorso = torsoSampler(layout);

  const profileOf = (values: readonly number[], ta: number, tb: number) => {
    const profile = boneProfile(values, ta, tb, L);
    return profile ? { profile } : {};
  };
  /** A bone's profile with an anatomy multiplier (u: 0 at the bone's head, 1 at its tail). */
  const shaped = (
    radiusAt: (u: number) => number,
    base: readonly number[] | undefined,
    factorAt: (u: number) => number,
  ) => {
    const profile = shapedProfile(radiusAt, base, factorAt);
    // `shaped` marks a profile anatomy changed, which thin bones' tubes then follow too.
    return profile
      ? { profile, ...(profile !== base && !sameProfile(profile, base) ? { shaped: true } : {}) }
      : {};
  };
  /** The ribcage's depth: a keel below the chest, when the torso has a chest. */
  const chestKeel = (): MassDef[] => {
    if (plan.chest === undefined || sBody <= 0 || chitin) return [];
    const at = (t: number) => sampleTorso(clamp01(t));
    const [sx, sy] = torsoCross;
    const ends = [at(plan.chest - 0.1), at(plan.chest + 0.14)].map((f) => {
      const r = f.radius * sy;
      const o = 0.3 * sBody * r;
      return { point: f.point.clone().addScaledVector(f.up, -o), up: f.up, r, o };
    });
    const [a, c] = ends as [(typeof ends)[number], (typeof ends)[number]];
    const extent = (e: (typeof ends)[number]) =>
      Math.max(0.4 * e.r, e.r * (1 + 0.18 * sBody) - e.o);
    const owner = spine.find((id) => {
      const bone = b.bones[id] as BoneDef;
      const t = plan.chest as number;
      return t <= Math.max(bone.t0, bone.t1) && t >= Math.min(bone.t0, bone.t1);
    });
    return [
      {
        bone: owner ?? (spine.at(-1) as number),
        a: a.point,
        b: c.point,
        ra: extent(a),
        rb: extent(c),
        up: a.up.clone(),
        cross: [(0.75 * sx) / sy, 1],
        blend: 0.4 * a.r * Math.min(1, sBody),
      },
    ];
  };

  // --- Bones ---------------------------------------------------------------------------------
  const b = new Builder();
  const root = b.bone({
    name: 'root',
    parent: -1,
    section: 'root',
    owner: 'root',
    head: new Vector3(0, 0, 0),
    tail: new Vector3(0, 0, 0.1 * L),
    up: Y.clone(),
    r0: 0,
    r1: 0,
    cross: [1, 1],
    t0: 0,
    t1: 0,
    skin: false,
  });

  // Torso: back (t = 1) to front (t = 0).
  const spine: number[] = [];
  for (let k = 0; k < torsoSegments; k++) {
    const ta = 1 - k / torsoSegments;
    const tb = 1 - (k + 1) / torsoSegments;
    const a = sampleTorso(ta);
    const c = sampleTorso(tb);
    const forward = new Vector3().subVectors(c.point, a.point).normalize();
    spine.push(
      b.bone({
        name: `spine.${k}`,
        parent: k === 0 ? root : (spine[k - 1] as number),
        section: 'torso',
        owner: 'torso',
        head: a.point,
        tail: c.point,
        up: dorsalUp(forward),
        r0: a.radius,
        r1: c.radius,
        cross: torsoCross,
        t0: ta,
        t1: tb,
        skin: true,
        ...shaped(
          (u) => torsoRadius(lerp(ta, tb, u)),
          boneProfile(spec.body.torso.radius, ta, tb, L),
          (u) => torsoFactor(lerp(ta, tb, u), plan, sBody),
        ),
      }),
    );
  }
  b.chain(
    {
      id: 'torso',
      section: 'torso',
      owner: 'torso',
      parentBone: -1,
      blend: 0,
      masses: chestKeel(),
    },
    spine,
  );
  b.path(
    'torso',
    spine.map((id) => ({
      bone: id,
      t0: (b.bones[id] as BoneDef).t0,
      t1: (b.bones[id] as BoneDef).t1,
    })),
  );
  const chest = spine.at(-1) as number;
  const hips = spine[0] as number;

  // Neck: a gentle curve from the torso's front, leaving at the torso's angle, to its own pitch.
  const neckSpec = spec.body.neck;
  const neckLen = neckSpec.length * L;
  const front = sampleTorso(0);
  const neck: number[] = [];
  let headBase = front.point.clone();
  /** The muscle running from the neck into the shoulders, on bodies with limbs on the torso. */
  const neckMuscle = (): MassDef[] => {
    const first = neck[0];
    if (first === undefined || sBody <= 0 || chitin || plan.pelvis === undefined) return [];
    const bone = b.bones[first] as BoneDef;
    const r = (bone.r0 + bone.r1) / 2;
    const o = 0.15 * sBody * r;
    const rho = r * (1 + 0.15 * sBody) - o;
    const offset = bone.up.clone().multiplyScalar(o);
    return [
      {
        bone: first,
        a: new Vector3().lerpVectors(bone.head, bone.tail, 0.05).add(offset),
        b: new Vector3().lerpVectors(bone.head, bone.tail, 0.6).add(offset),
        ra: rho,
        rb: rho * 0.85,
        up: bone.up.clone(),
        cross: bone.cross,
        blend: 0.4 * r * Math.min(1, sBody),
      },
    ];
  };
  if (neckLen > 1e-6) {
    const np = neckSpec.pitch * DEG;
    const ndir = new Vector3(0, Math.sin(np), Math.cos(np));
    const p0 = front.point.clone().addScaledVector(front.forward, -0.02 * L);
    const p1 = p0.clone().addScaledVector(front.forward, neckLen * 0.4);
    const p2 = p0.clone().addScaledVector(ndir, neckLen);
    // `curve` makes an S: today's curve raised to a cubic, its base pushed forward and down and
    // its head end back and up (a swan's neck).
    const curve = neckSpec.curve * DEG;
    const chord = new Vector3().subVectors(p2, p0).normalize();
    const dorsal = new Vector3(0, chord.z, -chord.y);
    const push = Math.sin(curve / 2) * 0.35 * neckLen;
    const c1 = p0
      .clone()
      .lerp(p1, 2 / 3)
      .addScaledVector(dorsal, -push);
    // The base may not dip into the chest.
    c1.y = Math.max(c1.y, p0.y - 0.15 * neckLen);
    const c2 = p2
      .clone()
      .lerp(p1, 2 / 3)
      .addScaledVector(dorsal, push);
    const bez =
      curve === 0
        ? (s: number) =>
            new Vector3()
              .addScaledVector(p0, (1 - s) ** 2)
              .addScaledVector(p1, 2 * s * (1 - s))
              .addScaledVector(p2, s * s)
        : (s: number) =>
            new Vector3()
              .addScaledVector(p0, (1 - s) ** 3)
              .addScaledVector(c1, 3 * s * (1 - s) ** 2)
              .addScaledVector(c2, 3 * s * s * (1 - s))
              .addScaledVector(p2, s ** 3);
    const neckCross = CROSS_SCALE[neckSpec.crossSection];
    for (let k = 0; k < neckSpec.segments; k++) {
      const sa = k / neckSpec.segments;
      const sb = (k + 1) / neckSpec.segments;
      const a = bez(sa);
      const c = bez(sb);
      const forward = new Vector3().subVectors(c, a).normalize();
      neck.push(
        b.bone({
          name: `neck.${k}`,
          parent: k === 0 ? chest : (neck[k - 1] as number),
          section: 'neck',
          owner: 'neck',
          head: a,
          tail: c,
          up: dorsalUp(forward),
          r0: sampleProfile(neckSpec.radius, 1 - sa) * L,
          r1: sampleProfile(neckSpec.radius, 1 - sb) * L,
          ...profileOf(neckSpec.radius, 1 - sa, 1 - sb),
          cross: neckCross,
          t0: 1 - sa,
          t1: 1 - sb,
          skin: true,
        }),
      );
    }
    headBase = p2;
    b.chain(
      {
        id: 'neck',
        section: 'neck',
        owner: 'neck',
        parentBone: chest,
        blend: 0.5 * Math.min(sampleProfile(neckSpec.radius, 1) * L, front.radius),
        masses: neckMuscle(),
      },
      neck,
    );
    b.path(
      'neck',
      neck.map((id) => ({
        bone: id,
        t0: (b.bones[id] as BoneDef).t0,
        t1: (b.bones[id] as BoneDef).t1,
      })),
    );
  }

  // Head: one bone from the skull centre to the snout centre; the jaw hangs below it.
  const headSpec = spec.body.head;
  const shape = HEAD_SHAPES[headSpec.shape];
  const headCross: [number, number] = [
    shape.cross[0] * CROSS_SCALE[headSpec.crossSection][0],
    shape.cross[1] * CROSS_SCALE[headSpec.crossSection][1],
  ];
  const hp = headSpec.pitch * DEG;
  const hd = new Vector3(0, Math.sin(hp), Math.cos(hp));
  const headUp = dorsalUp(hd);
  const r0 = headSpec.radius * L;
  const r1 = r0 * shape.front;
  const headLen = headSpec.length * L;
  const centers = Math.max(1e-4 * L, headLen - r0 - r1);
  const skull = headBase
    .clone()
    .addScaledVector(hd, r0 * 0.3)
    .addScaledVector(headUp, r0 * 0.1);
  const snout = skull.clone().addScaledVector(hd, centers);
  const total = centers + r0 + r1;
  const headParent = neck.length > 0 ? (neck.at(-1) as number) : chest;
  const head = b.bone({
    name: 'head',
    parent: headParent,
    section: 'head',
    owner: 'head',
    head: skull,
    tail: snout,
    up: headUp,
    r0,
    r1,
    cross: headCross,
    t0: (centers + r1) / total,
    t1: r1 / total,
    skin: true,
  });
  const headBones = [head];
  let jaw = -1;
  if (headSpec.jaw) {
    const hinge = skull
      .clone()
      .addScaledVector(hd, centers * 0.1)
      .addScaledVector(headUp, -r0 * 0.45);
    const tip = snout
      .clone()
      .addScaledVector(hd, r1 * 0.2)
      .addScaledVector(headUp, -r1 * 0.55);
    jaw = b.bone({
      name: 'jaw',
      parent: head,
      section: 'jaw',
      owner: 'jaw',
      head: hinge,
      tail: tip,
      up: dorsalUp(new Vector3().subVectors(tip, hinge).normalize()),
      r0: r0 * 0.45,
      r1: r1 * 0.6,
      cross: headCross,
      t0: 1,
      t1: 0,
      skin: true,
    });
    headBones.push(jaw);
    b.path('jaw', [{ bone: jaw, t0: 1, t1: 0 }]);
    const helper = b.bone({
      name: 'jaw.helper',
      parent: head,
      section: 'helper',
      owner: 'jaw',
      head: hinge.clone(),
      tail: hinge.clone().addScaledVector(hd, 0.05 * L),
      up: headUp.clone(),
      r0: r0 * 0.45,
      r1: r0 * 0.45,
      cross: headCross,
      t0: 1,
      t1: 1,
      skin: false,
    });
    b.helpers.push([helper, head, jaw]);
  }
  const headRootRadius = neck.length > 0 ? sampleProfile(neckSpec.radius, 0) * L : front.radius;
  b.chain(
    {
      id: 'head',
      section: 'head',
      owner: 'head',
      parentBone: headParent,
      blend: 0.5 * Math.min(headRootRadius, r0),
      masses: [],
    },
    headBones,
  );
  b.path('head', [
    { bone: head, t0: (b.bones[head] as BoneDef).t0, t1: (b.bones[head] as BoneDef).t1 },
  ]);

  // Tail: leaves the torso's back end, then bends by `curl` after `curlStart`.
  const tailSpec = spec.body.tail;
  const tailLen = tailSpec.length * L;
  const tail: number[] = [];
  if (tailLen > 1e-6) {
    const back = sampleTorso(1);
    const tp = tailSpec.pitch * DEG;
    const td = new Vector3(0, Math.sin(tp), -Math.cos(tp));
    const n = tailSpec.segments;
    const seg = tailLen / n;
    const curling = Array.from({ length: n }, (_, k) => (k + 0.5) / n > tailSpec.curlStart);
    const curlCount = Math.max(1, curling.filter(Boolean).length);
    const tailCross = flatten(CROSS_SCALE[tailSpec.crossSection]);
    // Legged bodies' tails start muscular, never wider than the torso's end.
    const tailRadius = (t: number) => sampleProfile(tailSpec.radius, t) * L;
    const tailShape = (t: number) =>
      legs.length === 0
        ? 1
        : Math.min(tailFactor(t, sBody), Math.max(1, back.radius / tailRadius(t)));
    let pos = back.point.clone().addScaledVector(back.forward, 0.02 * L);
    let bend = 0;
    for (let k = 0; k < n; k++) {
      if (curling[k]) bend += (tailSpec.curl * DEG) / curlCount;
      const dir = td
        .clone()
        .applyAxisAngle(
          X,
          k === 0 ? 0 : bend - (curling[k] ? (tailSpec.curl * DEG) / curlCount / 2 : 0),
        );
      if (k === 0) dir.add(back.forward.clone().negate()).normalize();
      const next = pos.clone().addScaledVector(dir, seg);
      tail.push(
        b.bone({
          name: `tail.${k}`,
          parent: k === 0 ? hips : (tail[k - 1] as number),
          section: 'tail',
          owner: 'tail',
          head: pos,
          tail: next,
          up: dorsalUp(dir.clone().negate()),
          r0: sampleProfile(tailSpec.radius, k / n) * L,
          r1: sampleProfile(tailSpec.radius, (k + 1) / n) * L,
          ...shaped(
            (u) => tailRadius((k + u) / n),
            boneProfile(tailSpec.radius, k / n, (k + 1) / n, L),
            (u) => tailShape((k + u) / n),
          ),
          cross: tailCross,
          t0: k / n,
          t1: (k + 1) / n,
          skin: true,
        }),
      );
      pos = next;
    }
    b.chain(
      {
        id: 'tail',
        section: 'tail',
        owner: 'tail',
        parentBone: hips,
        blend: 0.5 * Math.min(sampleProfile(tailSpec.radius, 0) * L, back.radius),
        masses: [],
      },
      tail,
    );
    b.path(
      'tail',
      tail.map((id) => ({
        bone: id,
        t0: (b.bones[id] as BoneDef).t0,
        t1: (b.bones[id] as BoneDef).t1,
      })),
    );
  }

  // The virtual spine path: neck (from the head end) → torso → tail, by arc length.
  {
    const ordered = [...[...neck].reverse(), ...[...spine].reverse(), ...tail];
    const lens = ordered.map((id) =>
      (b.bones[id] as BoneDef).head.distanceTo((b.bones[id] as BoneDef).tail),
    );
    const sum = lens.reduce((a, c) => a + c, 0) || 1;
    let acc = 0;
    const segs: PathSegment[] = [];
    for (const [i, id] of ordered.entries()) {
      const bone = b.bones[id] as BoneDef;
      const len = lens[i] as number;
      // Neck and torso bones point snout-ward, so their head is the far end of the segment.
      const towardTail = bone.section === 'tail';
      const ta = acc / sum;
      const tb = (acc + len) / sum;
      segs.push({ bone: id, t0: towardTail ? ta : tb, t1: towardTail ? tb : ta });
      acc += len;
    }
    b.path('spine', segs);
  }

  // --- Limbs -----------------------------------------------------------------------------------
  const legRigs: LegRig[] = [];
  const armRigs: ArmRig[] = [];
  const frontPair = Math.max(-1, ...legs.map((l) => l.pair ?? -1));
  const forwardH = Z.clone();
  for (const limb of spec.limbs) {
    const path = b.paths.get(limb.on);
    if (!path) continue;
    const frame = samplePath(b.bones, path, limb.at);
    const rootPos = limbRoot(limb, frame);
    const R = limb.length * L;
    const shares = SEGMENT_SHARES[limb.segments] ?? (SEGMENT_SHARES[3] as readonly number[]);
    const lengths = shares.map((s) => s * R);
    const side = new Vector3()
      .crossVectors(frame.up, frame.forward)
      .normalize()
      .multiplyScalar(limb.mirror || 1);
    const outward = new Vector3(side.x, 0, side.z);
    if (outward.lengthSq() < 1e-8) outward.set(limb.mirror || 1, 0, 0);
    outward.normalize();
    const segKey = String(limb.segments) as '2' | '3' | '4';
    const isFront =
      limb.role === 'leg' && legs.length > 2 && limb.pair === frontPair && Math.abs(pitch) < 45;
    const sLimb = strength(limb.muscle);

    let target: Vector3;
    let pole: Vector3;
    let bendsDeg: readonly number[];
    let plan: ReturnType<typeof legPlan> | undefined;
    if (limb.role === 'leg') {
      plan = legPlan(limb);
      target = new Vector3(rootPos.x, plan.footH, rootPos.z)
        .addScaledVector(outward, plan.h)
        .addScaledVector(forwardH, plan.fore);
      const knee = isFront ? forwardH.clone().negate() : forwardH.clone();
      pole = knee
        .multiplyScalar(1 - plan.sw)
        .addScaledVector(Y, plan.sw)
        .addScaledVector(outward, plan.sw * 0.5)
        .normalize();
      const base = (isFront ? BENDS.front : BENDS.hind)[segKey];
      const sprawl = BENDS.sprawl[segKey];
      bendsDeg = base.map((v, i) => lerp(v, sprawl[i] as number, plan?.sw ?? 0));
    } else {
      // Hanging by default; `lift` swings the arm forward and up.
      const lift = (limb.lift * Math.PI) / 180;
      const down = Y.clone()
        .multiplyScalar(-Math.cos(lift))
        .addScaledVector(forwardH, Math.sin(lift));
      target = rootPos
        .clone()
        .addScaledVector(down, R * 0.8)
        .addScaledVector(forwardH, R * 0.18 * Math.cos(lift))
        .addScaledVector(outward, R * 0.12);
      pole = forwardH
        .clone()
        .multiplyScalar(-Math.cos(lift))
        .addScaledVector(Y, -Math.sin(lift))
        .addScaledVector(outward, 0.3)
        .normalize();
      bendsDeg = BENDS.arm[segKey];
    }
    const setup: LimbIkSetup = { lengths, bends: bendsDeg.map((v) => v * DEG) };
    const solved = solveLimb(setup, rootPos, target, pole);
    if (limb.role === 'leg' && solved.miss > 0.02 * L && target.distanceTo(rootPos) > R) {
      notes.push({
        path: `limbs[id=${limb.baseId}]`,
        code: 'leg_too_short',
        message: `the leg is ${(solved.miss / L).toFixed(2)} torso lengths too short to reach the ground`,
      });
    }

    const limbBones: number[] = [];
    const n = lengths.length;
    for (let k = 0; k < n; k++) {
      const a = solved.points[k] as Vector3;
      const c = solved.points[k + 1] as Vector3;
      const dir = new Vector3().subVectors(c, a).normalize();
      const faceRef = forwardH.clone().addScaledVector(dir, -forwardH.dot(dir));
      const face = faceRef.lengthSq() > 1e-8 ? faceRef.normalize() : Y.clone();
      limbBones.push(
        b.bone({
          name: `${limb.id}.${k}`,
          parent: k === 0 ? frame.bone : (limbBones[k - 1] as number),
          section: 'limb',
          owner: limb.id,
          head: a.clone(),
          tail: c.clone(),
          up: face,
          r0: sampleProfile(limb.radius, k / n) * L,
          r1: sampleProfile(limb.radius, (k + 1) / n) * L,
          ...shaped(
            (u) => sampleProfile(limb.radius, (k + u) / n) * L,
            boneProfile(limb.radius, k / n, (k + 1) / n, L),
            (u) => limbFactor((k + u) / n, n, sLimb, chitin),
          ),
          cross: [1, 1],
          t0: k / n,
          t1: (k + 1) / n,
          skin: true,
        }),
      );
    }
    // Muscle bellies and joint caps (not on chitin, whose segments swell instead).
    const limbMasses: MassDef[] = [];
    if (!chitin && sLimb > 0 && (limb.role === 'leg' || limb.role === 'arm')) {
      for (let k = 0; k < n; k++) {
        const bone = b.bones[limbBones[k] as number] as BoneDef;
        const rules = bellyRules(limb.role, k, isFront);
        // Thighs and upper arms are as thick as a share of the body they join; haunches and
        // shoulders taper hard toward the knee or elbow.
        const bulk =
          (k === 0 ? (limb.role === 'arm' ? 0.32 : 0.42) : k === 1 ? 0.2 : 0) * frame.radius;
        limbMasses.push(
          ...bellies(
            limbBones[k] as number,
            bone.head,
            bone.tail,
            bone.up,
            (u) => sampleProfile(limb.radius, (k + u) / n) * L,
            rules,
            sLimb,
            bulk,
            k === 0 ? 0.55 : 0.6,
          ),
        );
      }
      // Caps at every joint but the last (the ankle or wrist).
      for (let j = 1; j < n - 1; j++) {
        const cap = jointCap(
          limbBones[j] as number,
          solved.points[j] as Vector3,
          solved.points[j - 1] as Vector3,
          solved.points[j + 1] as Vector3,
          sampleProfile(limb.radius, j / n) * L * limbFactor(j / n, n, sLimb, chitin),
          sLimb,
        );
        if (cap) limbMasses.push(cap);
      }
    }
    // Knee, hock and elbow helpers.
    for (let k = 1; k < n; k++) {
      const upper = limbBones[k - 1] as number;
      const lower = limbBones[k] as number;
      const joint = (b.bones[lower] as BoneDef).head;
      const helper = b.bone({
        name: `${limb.id}.${k}.helper`,
        parent: upper,
        section: 'helper',
        owner: limb.id,
        head: joint.clone(),
        tail: joint
          .clone()
          .addScaledVector(
            new Vector3().subVectors(joint, (b.bones[upper] as BoneDef).head).normalize(),
            0.02 * L,
          ),
        up: (b.bones[upper] as BoneDef).up.clone(),
        r0: (b.bones[lower] as BoneDef).r0,
        r1: (b.bones[lower] as BoneDef).r0,
        cross: [1, 1],
        t0: k / n,
        t1: k / n,
        skin: false,
      });
      b.helpers.push([helper, upper, lower]);
    }
    const rootRadius = sampleProfile(limb.radius, 0) * L;
    b.chain(
      {
        id: limb.id,
        section: 'limb',
        owner: limb.id,
        parentBone: frame.bone,
        blend: 0.5 * Math.min(rootRadius, frame.radius),
        masses: [
          {
            bone: limbBones[0] as number,
            a: rootPos.clone(),
            b: rootPos.clone(),
            // Shoulders and haunches grow with muscle.
            ra: rootRadius * (1.12 + 0.22 * sLimb),
            rb: rootRadius * (1.12 + 0.22 * sLimb),
            up: Y.clone(),
            cross: [1, 1],
            // The shoulder or hip swells into the body with muscle (a plain union at 0).
            blend: 0.45 * rootRadius * Math.min(1, sLimb),
          },
          ...limbMasses,
        ],
      },
      limbBones,
    );
    b.path(
      limb.id,
      limbBones.map((id, k) => ({ bone: id, t0: k / n, t1: (k + 1) / n })),
    );

    // Toes from the foot part.
    const toes: number[][] = [];
    const foot = limb.foot;
    const module = foot ? (registry.get('part', foot.type) as PartModule | undefined) : undefined;
    const hooks = module?.hooks as
      | { toes?: (ctx: ToeContext, p: Record<string, unknown>) => ToeChain[] }
      | undefined;
    if (foot && hooks?.toes) {
      const last = b.bones[limbBones.at(-1) as number] as BoneDef;
      const ctx: ToeContext = {
        ankle: last.tail.clone(),
        limbDir: new Vector3().subVectors(last.tail, last.head).normalize(),
        forward: forwardH.clone(),
        outward: outward.clone(),
        groundY: 0,
        role: limb.role,
        tipRadius: last.r1,
        scale: L,
        mirror: limb.mirror,
        splay: limb.splay,
      };
      hooks.toes(ctx, foot.params).forEach((toe, ti) => {
        const ids: number[] = [];
        for (let k = 0; k + 1 < toe.points.length; k++) {
          const a = toe.points[k] as Vector3;
          const c = toe.points[k + 1] as Vector3;
          const dir = new Vector3().subVectors(c, a).normalize();
          const upRef = Y.clone().addScaledVector(dir, -dir.y);
          ids.push(
            b.bone({
              name: `${limb.id}.toe${ti}.${k}`,
              parent: k === 0 ? (limbBones.at(-1) as number) : (ids[k - 1] as number),
              section: 'toe',
              owner: `${limb.id}.toe${ti}`,
              head: a.clone(),
              tail: c.clone(),
              up: upRef.lengthSq() > 1e-8 ? upRef.normalize() : forwardH.clone(),
              r0: toe.radii[k] ?? last.r1 * 0.4,
              r1: toe.radii[k + 1] ?? last.r1 * 0.3,
              cross: [1, 0.8],
              t0: k / (toe.points.length - 1),
              t1: (k + 1) / (toe.points.length - 1),
              skin: true,
            }),
          );
        }
        if (ids.length === 0) return;
        toes.push(ids);
        b.chain(
          {
            id: `${limb.id}.toe${ti}`,
            section: 'toe',
            owner: `${limb.id}.toe${ti}`,
            parentBone: limbBones.at(-1) as number,
            blend: 0.5 * Math.min(toe.radii[0] ?? last.r1, last.r1),
            masses: [],
          },
          ids,
        );
        b.path(
          `${limb.id}.toe${ti}`,
          ids.map((id, k) => ({ bone: id, t0: k / ids.length, t1: (k + 1) / ids.length })),
        );
      });
    }

    const sideName = limb.side === 'center' ? 'center' : limb.side;
    if (limb.role === 'leg' && limb.pair !== undefined && sideName !== 'center') {
      legRigs.push({
        id: limb.id,
        pair: limb.pair,
        side: sideName,
        bones: limbBones,
        lengths,
        bends: setup.bends,
        restFoot: (solved.points.at(-1) as Vector3).clone(),
        pole,
        reach: R,
        toes,
      });
    } else {
      armRigs.push({
        id: limb.id,
        side: sideName,
        bones: limbBones,
        lengths,
        bends: setup.bends,
        pole,
        reach: R,
        toes,
      });
    }
  }

  const legRoots = legRigs.map((l) => (b.bones[l.bones[0] as number] as BoneDef).head.y);
  const rig: Rig = {
    root,
    spine,
    // One head and one tail until milestone 9.1 builds several; eyes join after the parts.
    heads: [{ id: 'head', neck, head, jaw, eyes: [] }],
    main: 0,
    tails: tail.length > 0 ? [{ id: 'tail', bones: tail, branch: 0 }] : [],
    chains:
      tail.length > 1
        ? [{ owner: 'tail', bones: tail, drive: 'spring', stiffness: 0.35, swish: true }]
        : [],
    legs: legRigs,
    arms: armRigs,
    wings: [],
    fins: [],
    tentacles: [],
    hipHeight:
      legRoots.length > 0 ? legRoots.reduce((a, c) => a + c, 0) / legRoots.length : center.y,
    posture,
  };
  return { bones: b.bones, chains: b.chains, rig, paths: b.paths, helpers: b.helpers, notes };
}

export type { BoneSection };
