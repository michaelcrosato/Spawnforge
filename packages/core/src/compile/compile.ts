import { Matrix4, Quaternion, Vector3 } from 'three';
import type { CreatureSpec } from '../blueprint/creature.ts';
import type { Issue } from '../blueprint/issues.ts';
import { sweep } from '../geometry/kit.ts';
import type { Registry } from '../registry.ts';
import { type SkinMaterialSpec, skinMaterialSpec } from '../shading/compose.ts';
import { cutMouth, innerMouth, type MouthLine, mouthLine } from './mouth.ts';
import { buildParts, PartSink } from './parts.ts';
import { buildSdf, primBone, SdfEvaluator } from './sdf.ts';
import { buildSkeleton } from './skeleton.ts';
import {
  applyHelpers,
  boneDistance,
  computeWeights,
  packTop4,
  type WeightOptions,
  WeightTable,
  weightsAt,
} from './skin.ts';
import { fitGrid, surfaceNets } from './surface-nets.ts';
import type { BoneDef } from './types.ts';

declare const performance: { now(): number };

export type Quality = 'low' | 'medium' | 'high';
/** Grid cells along the creature's longest axis per quality. */
export const QUALITY_CELLS: Record<Quality, number> = { low: 48, medium: 96, high: 128 };
/** Most skin triangles per quality (medium is the plan's 30k budget, less the mouth and tubes). */
export const TRIANGLE_BUDGET: Record<Quality, number> = {
  low: 9_000,
  medium: 27_000,
  high: 60_000,
};

export type Vec3 = [number, number, number];

export interface MeshData {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly skinIndex: Uint16Array;
  readonly skinWeight: Float32Array;
}

export interface SkinMeshData extends MeshData {
  /** Per vertex: along the spine (0 snout tip → 1 tail tip), height (-1 belly → 1 back), along the limb (-1 inside the mouth), crease depth. */
  readonly body: Float32Array;
  /** Per vertex: head, torso, limbs, tail weights. */
  readonly region: Float32Array;
}

export interface PartMeshData extends MeshData {
  /** sRGB colour per vertex. */
  readonly color: Float32Array;
  /** Per vertex: t (root → tip), roughness. */
  readonly info: Float32Array;
}

export interface EyeMeshData extends MeshData {
  /** Per vertex: position on the unit eyeball in eye space (+Z looks out), pupil shape (0 round, 1 slit, 2 goat). */
  readonly eye: Float32Array;
  /** Per vertex: iris sRGB colour and size. */
  readonly iris: Float32Array;
  readonly sclera: Float32Array;
}

export interface BonesData {
  readonly names: readonly string[];
  readonly parents: Int16Array;
  readonly sections: readonly string[];
  readonly owners: readonly string[];
  /** Rest pose, model space: head position per bone. */
  readonly positions: Float32Array;
  /** Rest pose, model space: orientation per bone (+Y along the bone, +Z its `up`). */
  readonly rotations: Float32Array;
  readonly lengths: Float32Array;
  readonly radii: Float32Array;
}

export interface LegRigData {
  readonly id: string;
  readonly pair: number;
  readonly side: 'left' | 'right';
  readonly bones: readonly number[];
  readonly lengths: readonly number[];
  readonly bends: readonly number[];
  readonly restFoot: Vec3;
  readonly pole: Vec3;
  readonly reach: number;
  readonly toes: readonly (readonly number[])[];
}

export interface ArmRigData extends Omit<LegRigData, 'pair' | 'restFoot' | 'side'> {
  readonly side: 'left' | 'right' | 'center';
}

export interface RigData {
  readonly root: number;
  readonly spine: readonly number[];
  readonly neck: readonly number[];
  readonly head: number;
  readonly jaw: number;
  readonly tail: readonly number[];
  readonly eyes: readonly number[];
  readonly legs: readonly LegRigData[];
  readonly arms: readonly ArmRigData[];
  readonly helpers: readonly (readonly [number, number, number])[];
  readonly hipHeight: number;
  readonly posture: 'upright' | 'sprawl' | 'legless';
}

/** A named attachment point for gameplay: effects, projectiles, hit detection. */
export interface GameSocket {
  readonly name: string;
  readonly bone: number;
  /** Offset from the bone's head, in the bone's rest frame. */
  readonly offset: Vec3;
}

export interface CompiledCreature {
  readonly name: string;
  readonly seed: number;
  readonly scale: number;
  readonly quality: Quality;
  readonly bones: BonesData;
  readonly skin: SkinMeshData;
  readonly parts: PartMeshData;
  readonly eyes: EyeMeshData;
  readonly material: SkinMaterialSpec;
  readonly rig: RigData;
  readonly sockets: readonly GameSocket[];
  readonly bounds: { readonly min: Vec3; readonly max: Vec3 };
  /** Labelled points for debug renders: every part and limb by id, and the body sections. */
  readonly markers: readonly {
    readonly id: string;
    readonly kind: 'part' | 'limb' | 'section';
    readonly position: Vec3;
  }[];
  /** Body chains as capsules (bone, radius), free hit volumes for games. */
  readonly hitCapsules: readonly { readonly bone: number; readonly radius: number }[];
  readonly stats: {
    readonly triangles: { readonly skin: number; readonly parts: number; readonly eyes: number };
    readonly vertices: number;
    readonly bones: number;
    readonly cell: number;
    readonly timings: Readonly<Record<string, number>>;
  };
  readonly warnings: readonly Issue[];
}

export interface CompileOptions {
  readonly quality?: Quality;
}

const v3 = (v: Vector3): Vec3 => [v.x, v.y, v.z];

/** Compiles a creature spec into meshes, a skeleton and a rig. Pure: same input, same output. */
export function compileCreature(
  spec: CreatureSpec,
  registry: Registry,
  options: CompileOptions = {},
): CompiledCreature {
  const quality = options.quality ?? 'medium';
  const cells = QUALITY_CELLS[quality];
  const timings: Record<string, number> = {};
  let clock = performance.now();
  const lap = (name: string) => {
    const now = performance.now();
    timings[name] = Math.round((now - clock) * 100) / 100;
    clock = now;
  };
  const L = spec.scale;
  const warnings: Issue[] = [];

  // 1. Skeleton.
  const skeleton = buildSkeleton(spec, registry);
  const bones = skeleton.bones;
  for (const note of skeleton.notes)
    warnings.push({ severity: 'warning', path: note.path, code: note.code, message: note.message });
  lap('skeleton');

  // 2. Signed distance field; bones thinner than about a cell become swept tubes.
  const extent = new Vector3();
  {
    const min = new Vector3(Infinity, Infinity, Infinity);
    const max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (const b of bones) {
      if (!b.skin) continue;
      const r = Math.max(b.r0, b.r1);
      min.min(b.head.clone().subScalar(r)).min(b.tail.clone().subScalar(r));
      max.max(b.head.clone().addScalar(r)).max(b.tail.clone().addScalar(r));
    }
    extent.subVectors(max, min);
  }
  const roughCell = Math.max(extent.x, extent.y, extent.z) / cells;
  let sdf = buildSdf(bones, skeleton.chains, roughCell * 0.9);
  lap('sdf');

  // 3. Mesh. Bulky creatures have more surface per cell; if the skin comes out over the
  // triangle budget, mesh once more on a grid coarse enough to fit.
  let grid = fitGrid(sdf, cells);
  let surface = surfaceNets(sdf, grid);
  const budget = TRIANGLE_BUDGET[quality];
  if (surface.indices.length / 3 > budget) {
    const fewer = Math.floor(cells * Math.sqrt((budget * 0.85) / (surface.indices.length / 3)));
    sdf = buildSdf(bones, skeleton.chains, (Math.max(extent.x, extent.y, extent.z) / fewer) * 0.9);
    grid = fitGrid(sdf, fewer);
    surface = surfaceNets(sdf, grid);
  }
  lap('mesh');

  // 4. Skin weights from the same geometry.
  const children: number[][] = bones.map(() => []);
  bones.forEach((b, i) => {
    if (b.parent >= 0) (children[b.parent] as number[]).push(i);
  });
  const culling = surface.culling;
  // Bones near each grid block, worked out once per block.
  const blockBones = new Map<number, number[]>();
  const nearbyBones = (p: Vector3) => {
    const block = culling.blockAt(p.x, p.y, p.z);
    let list = blockBones.get(block);
    if (!list) {
      const set = new Set<number>();
      for (const prim of culling.primsOf(block)) set.add(primBone(sdf, prim));
      list = [...set];
      blockBones.set(block, list);
    }
    return list;
  };
  const weightOptions: WeightOptions = { bones, children, nearbyBones };
  let positions = surface.positions;
  let normals = surface.normals;
  let indices = surface.indices;
  let table = computeWeights(positions, indices, weightOptions);
  lap('weights');

  // 5. Mouth: cut the closed head along the mouth line; lower copies follow the jaw.
  const head = skeleton.rig.head;
  const jaw = skeleton.rig.jaw;
  let mouth: MouthLine | undefined;
  let lowerFlags: Uint8Array | undefined;
  if (jaw >= 0) {
    mouth = mouthLine(bones[head] as BoneDef, bones[jaw] as BoneDef);
    const cut = cutMouth(positions, normals, indices, table, head, jaw, mouth);
    const next = new WeightTable(cut.source.length);
    for (let v = 0; v < cut.source.length; v++) {
      const entries = table.entries(cut.source[v] as number);
      if (cut.lower[v]) {
        next.set(v, [[jaw, 1]]);
      } else {
        const kept = entries.filter(([b]) => b !== jaw);
        next.set(v, kept.length > 0 && kept.length < entries.length ? kept : entries);
        next.normalize(v);
      }
    }
    positions = cut.positions;
    normals = cut.normals;
    indices = cut.indices;
    table = next;
    lowerFlags = cut.lower;
  }
  lap('mouth');

  // 6. Swept tubes for bones too thin for the grid (toes, tail tips).
  const extraPos: number[] = [];
  const extraNrm: number[] = [];
  const extraIdx: number[] = [];
  const extraWeights: [number, number][][] = [];
  const extraFlag: number[] = [];
  const thin = new Set(sdf.thinBones);
  for (const chain of skeleton.chains) {
    let run: number[] = [];
    const flush = () => {
      if (run.length === 0) return;
      const first = bones[run[0] as number] as BoneDef;
      const points = [first.head.clone(), ...run.map((id) => (bones[id] as BoneDef).tail.clone())];
      const radii = [first.r0, ...run.map((id) => (bones[id] as BoneDef).r1)];
      const lens = [0];
      for (let i = 1; i < points.length; i++)
        lens.push(
          (lens[i - 1] as number) + (points[i] as Vector3).distanceTo(points[i - 1] as Vector3),
        );
      const total = lens.at(-1) || 1;
      const radius = (t: number) => {
        const d = t * total;
        let i = 0;
        while (i < lens.length - 2 && (lens[i + 1] as number) < d) i++;
        const f = (d - (lens[i] as number)) / ((lens[i + 1] as number) - (lens[i] as number) || 1);
        return (
          (radii[i] as number) +
          ((radii[i + 1] as number) - (radii[i] as number)) * Math.min(1, Math.max(0, f))
        );
      };
      const piece = sweep(points, radius, { sides: 7, tip: 'round', capRoot: true });
      const base = (positions.length + extraPos.length) / 3;
      const runOptions: WeightOptions = { bones, children, nearbyBones: () => run };
      const p = new Vector3();
      for (let v = 0; v < piece.positions.length; v += 3) {
        extraPos.push(
          piece.positions[v] as number,
          piece.positions[v + 1] as number,
          piece.positions[v + 2] as number,
        );
        extraNrm.push(
          piece.normals[v] as number,
          piece.normals[v + 1] as number,
          piece.normals[v + 2] as number,
        );
        p.set(
          piece.positions[v] as number,
          piece.positions[v + 1] as number,
          piece.positions[v + 2] as number,
        );
        extraWeights.push(weightsAt(p, runOptions));
        extraFlag.push(0);
      }
      for (const i of piece.indices) extraIdx.push(base + i);
      run = [];
    };
    for (const id of chain.bones) {
      if (thin.has(id)) run.push(id);
      else flush();
    }
    flush();
  }
  if (mouth) {
    const pouch = innerMouth(mouth);
    const base = (positions.length + extraPos.length) / 3;
    extraPos.push(...pouch.positions);
    extraNrm.push(...pouch.normals);
    for (const i of pouch.indices) extraIdx.push(base + i);
    for (const lower of pouch.lower) {
      extraWeights.push([[lower ? jaw : head, 1]]);
      extraFlag.push(1);
    }
  }
  if (extraPos.length > 0) {
    const n0 = positions.length / 3;
    const pos = new Float32Array(positions.length + extraPos.length);
    pos.set(positions);
    pos.set(extraPos, positions.length);
    const nrm = new Float32Array(normals.length + extraNrm.length);
    nrm.set(normals);
    nrm.set(extraNrm, normals.length);
    const idx = new Uint32Array(indices.length + extraIdx.length);
    idx.set(indices);
    idx.set(extraIdx, indices.length);
    const next = new WeightTable(pos.length / 3);
    for (let v = 0; v < n0; v++) next.set(v, table.entries(v));
    extraWeights.forEach((w, i) => {
      next.set(n0 + i, w);
    });
    positions = pos;
    normals = nrm;
    indices = idx;
    table = next;
  }
  const vertexCount = positions.length / 3;
  const mouthInside = new Uint8Array(vertexCount);
  extraFlag.forEach((f, i) => {
    mouthInside[vertexCount - extraFlag.length + i] = f;
  });
  void lowerFlags;
  lap('tubes');

  // 7. Body coordinates, read by textures and part placement instead of UVs.
  const { body, region } = bodyCoordinates(
    positions,
    normals,
    table,
    bones,
    skeleton.paths.get('spine') ?? [],
    sdf,
    culling,
    mouthInside,
    spec,
  );
  lap('coords');

  // 8. Helper bones take half a joint's rotation.
  applyHelpers(table, skeleton.helpers);
  const skinPack = packTop4(table);
  lap('pack');

  // 9. Parts and eyes, snapped onto the skin.
  const sink = new PartSink();
  const toeMap = new Map<string, readonly (readonly number[])[]>();
  const limbMirror = new Map<string, number>();
  for (const leg of skeleton.rig.legs) toeMap.set(leg.id, leg.toes);
  for (const arm of skeleton.rig.arms) toeMap.set(arm.id, arm.toes);
  for (const limb of spec.limbs) limbMirror.set(limb.id, limb.mirror);
  const feet = spec.limbs
    .filter((l) => l.foot !== null)
    .map((l) => ({
      limbId: l.id,
      mirror: l.mirror,
      type: (l.foot as NonNullable<typeof l.foot>).type,
      params: (l.foot as NonNullable<typeof l.foot>).params,
    }));
  const builtParts = buildParts(
    spec.parts,
    feet,
    {
      bones,
      paths: skeleton.paths as Map<string, readonly import('./skeleton.ts').PathSegment[]>,
      sdf,
      weightOptions,
      mouth,
      head,
      jaw,
      palette: spec.skin.palette,
      scale: L,
      seed: spec.seed,
      registry,
      toes: toeMap,
      limbMirror,
    },
    sink,
  );
  for (const note of builtParts.notes)
    warnings.push({
      severity: 'warning',
      path: note.path,
      code: 'part_failed',
      message: note.message,
    });
  lap('parts');

  const packWeights = (list: [number, number][][]) => {
    const t = new WeightTable(list.length);
    list.forEach((w, i) => {
      t.set(i, w);
    });
    return packTop4(t);
  };
  const partsPack = packWeights(sink.parts.weights);
  const eyesPack = packWeights(sink.eyes.weights);

  // 10. Bones as plain data.
  const bonesData = bonesToData(bones);
  const rig: RigData = {
    root: skeleton.rig.root,
    spine: skeleton.rig.spine,
    neck: skeleton.rig.neck,
    head,
    jaw,
    tail: skeleton.rig.tail,
    eyes: builtParts.eyeBones,
    legs: skeleton.rig.legs.map((l) => ({ ...l, restFoot: v3(l.restFoot), pole: v3(l.pole) })),
    arms: skeleton.rig.arms.map((a) => ({ ...a, pole: v3(a.pole) })),
    helpers: skeleton.helpers,
    hipHeight: skeleton.rig.hipHeight,
    posture: skeleton.rig.posture,
  };

  const sockets = gameSockets(bones, rig, mouth);
  const markers: CompiledCreature['markers'][number][] = [];
  const mid = (id: number) =>
    v3((bones[id] as BoneDef).head.clone().lerp((bones[id] as BoneDef).tail, 0.5));
  markers.push({ id: 'head', kind: 'section', position: v3((bones[head] as BoneDef).tail) });
  markers.push({
    id: 'torso',
    kind: 'section',
    position: mid(skeleton.rig.spine[Math.floor(skeleton.rig.spine.length / 2)] as number),
  });
  if (skeleton.rig.tail.length > 0)
    markers.push({
      id: 'tail',
      kind: 'section',
      position: v3((bones[skeleton.rig.tail.at(-1) as number] as BoneDef).tail),
    });
  for (const limb of [...skeleton.rig.legs, ...skeleton.rig.arms]) {
    markers.push({
      id: limb.id,
      kind: 'limb',
      position: mid(limb.bones[Math.floor(limb.bones.length / 2)] as number),
    });
  }
  for (const [id, position] of sink.markers)
    if (!id.endsWith('.foot')) markers.push({ id, kind: 'part', position });
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (const list of [
    positions,
    sink.parts.positions,
    sink.eyes.positions,
  ] as ArrayLike<number>[]) {
    for (let i = 0; i < list.length; i += 3) {
      min.min(new Vector3(list[i], list[i + 1], list[i + 2]));
      max.max(new Vector3(list[i], list[i + 1], list[i + 2]));
    }
  }
  if (min.y < -0.05 * L) warnings.push(belowGround(bones, min.y, L));
  lap('finish');

  const triangles = {
    skin: indices.length / 3,
    parts: sink.parts.indices.length / 3,
    eyes: sink.eyes.indices.length / 3,
  };
  if (quality === 'medium' && triangles.skin > 30_000) {
    warnings.push({
      severity: 'warning',
      path: '',
      code: 'over_budget',
      message: `${triangles.skin} skin triangles at medium quality (budget 30000)`,
    });
  }
  return {
    name: spec.name,
    seed: spec.seed,
    scale: L,
    quality,
    bones: bonesData,
    skin: {
      positions,
      normals,
      indices,
      skinIndex: skinPack.skinIndex,
      skinWeight: skinPack.skinWeight,
      body,
      region,
    },
    parts: {
      positions: new Float32Array(sink.parts.positions),
      normals: new Float32Array(sink.parts.normals),
      indices: new Uint32Array(sink.parts.indices),
      skinIndex: partsPack.skinIndex,
      skinWeight: partsPack.skinWeight,
      color: new Float32Array(sink.parts.color),
      info: new Float32Array(sink.parts.info),
    },
    eyes: {
      positions: new Float32Array(sink.eyes.positions),
      normals: new Float32Array(sink.eyes.normals),
      indices: new Uint32Array(sink.eyes.indices),
      skinIndex: eyesPack.skinIndex,
      skinWeight: eyesPack.skinWeight,
      eye: new Float32Array(sink.eyes.eye),
      iris: new Float32Array(sink.eyes.iris),
      sclera: new Float32Array(sink.eyes.sclera),
    },
    material: skinMaterialSpec(
      spec.skin.palette.base as string,
      spec.skin.material,
      spec.skin.layers,
      spec.seed,
    ),
    rig,
    sockets,
    markers,
    bounds: { min: v3(min), max: v3(max) },
    hitCapsules: bones
      .map((b, i) => ({ bone: i, radius: Math.max(b.r0, b.r1), skin: b.skin, section: b.section }))
      .filter((b) => b.skin && b.section !== 'toe')
      .map(({ bone, radius }) => ({ bone, radius })),
    stats: { triangles, vertices: vertexCount, bones: bones.length, cell: grid.cell, timings },
    warnings,
  };
}

function bonesToData(bones: readonly BoneDef[]): BonesData {
  const n = bones.length;
  const positions = new Float32Array(n * 3);
  const rotations = new Float32Array(n * 4);
  const lengths = new Float32Array(n);
  const radii = new Float32Array(n);
  const parents = new Int16Array(n);
  const m = new Matrix4();
  const q = new Quaternion();
  bones.forEach((b, i) => {
    positions.set([b.head.x, b.head.y, b.head.z], i * 3);
    parents[i] = b.parent;
    const dir = new Vector3().subVectors(b.tail, b.head);
    lengths[i] = dir.length();
    radii[i] = Math.max(b.r0, b.r1);
    if (b.section === 'root' || dir.lengthSq() < 1e-14) {
      q.identity();
    } else {
      dir.normalize();
      const z = b.up.clone().addScaledVector(dir, -b.up.dot(dir));
      if (z.lengthSq() < 1e-10) z.set(0, 0, 1).addScaledVector(dir, -dir.z);
      z.normalize();
      const x = new Vector3().crossVectors(dir, z).normalize();
      m.makeBasis(x, dir, z);
      q.setFromRotationMatrix(m);
    }
    rotations.set([q.x, q.y, q.z, q.w], i * 4);
  });
  return {
    names: bones.map((b) => b.name),
    parents,
    sections: bones.map((b) => b.section),
    owners: bones.map((b) => b.owner),
    positions,
    rotations,
    lengths,
    radii,
  };
}

/** Mouth, eyes, head, claw tips and centre of mass as named sockets. */
function gameSockets(
  bones: readonly BoneDef[],
  rig: RigData,
  mouth: MouthLine | undefined,
): GameSocket[] {
  const local = (bone: number, p: Vector3): Vec3 => {
    const b = bones[bone] as BoneDef;
    const d = new Vector3().subVectors(b.tail, b.head);
    const len = d.length();
    const y = len > 1e-9 ? d.divideScalar(len) : new Vector3(0, 1, 0);
    const z = b.up.clone().addScaledVector(y, -b.up.dot(y)).normalize();
    const x = new Vector3().crossVectors(y, z);
    const o = new Vector3().subVectors(p, b.head);
    return [o.dot(x), o.dot(y), o.dot(z)];
  };
  const sockets: GameSocket[] = [];
  const head = bones[rig.head] as BoneDef;
  sockets.push({ name: 'head', bone: rig.head, offset: [0, 0, 0] });
  if (mouth && rig.jaw >= 0) {
    const tip = mouth.origin
      .clone()
      .addScaledVector(mouth.forward, mouth.tip)
      .addScaledVector(mouth.up, mouth.tipY);
    sockets.push({ name: 'mouth', bone: rig.jaw, offset: local(rig.jaw, tip) });
  } else {
    sockets.push({ name: 'mouth', bone: rig.head, offset: local(rig.head, head.tail.clone()) });
  }
  rig.eyes.forEach((id) => {
    sockets.push({ name: (bones[id] as BoneDef).name, bone: id, offset: [0, 0, 0] });
  });
  for (const limb of [...rig.legs, ...rig.arms]) {
    limb.toes.forEach((toe, i) => {
      const last = toe.at(-1);
      if (last === undefined) return;
      const b = bones[last] as BoneDef;
      sockets.push({ name: `claw.${limb.id}.${i}`, bone: last, offset: local(last, b.tail) });
    });
    if (limb.toes.length === 0) {
      const last = limb.bones.at(-1) as number;
      sockets.push({
        name: `tip.${limb.id}`,
        bone: last,
        offset: local(last, (bones[last] as BoneDef).tail),
      });
    }
  }
  const mid = rig.spine[Math.floor(rig.spine.length / 2)] as number;
  sockets.push({ name: 'centerOfMass', bone: mid, offset: [0, 0, 0] });
  return sockets;
}

/** Body coordinates per vertex, blended by skin weight. */
function bodyCoordinates(
  positions: Float32Array,
  normals: Float32Array,
  table: WeightTable,
  bones: readonly BoneDef[],
  spinePath: readonly { bone: number; t0: number; t1: number }[],
  sdf: import('./sdf.ts').Sdf,
  culling: import('./surface-nets.ts').PrimCulling,
  mouthInside: Uint8Array,
  spec: CreatureSpec,
): { body: Float32Array; region: Float32Array } {
  const n = positions.length / 3;
  const body = new Float32Array(n * 4);
  const region = new Float32Array(n * 4);
  const L = spec.scale;

  // Axis coordinate (0 snout tip → 1 tail tip) at each bone's head and tail.
  const axis = new Float64Array(bones.length * 2).fill(Number.NaN);
  const spineLen = spinePath.reduce(
    (a, s) => a + (bones[s.bone] as BoneDef).head.distanceTo((bones[s.bone] as BoneDef).tail),
    0,
  );
  const headIdx = bones.findIndex((b) => b.section === 'head');
  const headBone = bones[headIdx] as BoneDef;
  const headDir = new Vector3().subVectors(headBone.tail, headBone.head).normalize();
  const tip = headBone.tail.clone().addScaledVector(headDir, headBone.r1);
  const firstSpine = spinePath[0];
  const neckEnd = firstSpine
    ? (bones[firstSpine.bone] as BoneDef).section === 'tail'
      ? (bones[firstSpine.bone] as BoneDef).head
      : (bones[firstSpine.bone] as BoneDef).tail
    : headBone.head;
  const headSpan = tip.distanceTo(neckEnd);
  const total = headSpan + spineLen || 1;
  for (const s of spinePath) {
    axis[s.bone * 2] = (headSpan + s.t0 * spineLen) / total;
    axis[s.bone * 2 + 1] = (headSpan + s.t1 * spineLen) / total;
  }
  bones.forEach((b, i) => {
    if (b.section === 'head' || b.section === 'jaw') {
      axis[i * 2] = tip.distanceTo(b.head) / total;
      axis[i * 2 + 1] = tip.distanceTo(b.tail) / total;
    }
  });
  // Limbs, toes and others take the axis value where they attach.
  bones.forEach((b, i) => {
    if (!Number.isNaN(axis[i * 2] as number)) return;
    let parent = b.parent;
    let at = b.head;
    while (parent >= 0 && Number.isNaN(axis[parent * 2] as number)) {
      at = (bones[parent] as BoneDef).head;
      parent = (bones[parent] as BoneDef).parent;
    }
    if (parent < 0) {
      axis[i * 2] = axis[i * 2 + 1] = 0.5;
      return;
    }
    const { t } = boneDistance(bones[parent] as BoneDef, at);
    const value =
      (axis[parent * 2] as number) +
      ((axis[parent * 2 + 1] as number) - (axis[parent * 2] as number)) * t;
    axis[i * 2] = axis[i * 2 + 1] = value;
  });

  const sectionOf = (b: BoneDef): BoneDef['section'] => {
    if (b.section !== 'helper') return b.section;
    const owner = bones.find((x) => x.owner === b.owner && x.section !== 'helper');
    return owner ? owner.section : 'torso';
  };
  const evaluator = new SdfEvaluator(sdf);
  const p = new Vector3();
  const nrm = new Vector3();
  const blend = Math.max(1e-6, sdf.maxBlend * 0.35);
  for (let v = 0; v < n; v++) {
    p.set(
      positions[v * 3] as number,
      positions[v * 3 + 1] as number,
      positions[v * 3 + 2] as number,
    );
    nrm.set(normals[v * 3] as number, normals[v * 3 + 1] as number, normals[v * 3 + 2] as number);
    let spineCoord = 0;
    let height = 0;
    let limb = 0;
    const reg = [0, 0, 0, 0];
    const entries = table.entries(v);
    let sum = 0;
    for (const [id, w] of entries) {
      const b = bones[id] as BoneDef;
      const { t } = boneDistance(b, p);
      spineCoord +=
        w *
        ((axis[id * 2] as number) + ((axis[id * 2 + 1] as number) - (axis[id * 2] as number)) * t);
      const section = sectionOf(b);
      if (section === 'limb' || section === 'toe') {
        const outward = new Vector3(Math.sign(p.x) || 1, 0, 0);
        // Limbs read like the flank outside and the belly inside.
        height += w * (nrm.dot(outward) * 0.45 + nrm.y * 0.35 + 0.1);
        limb += w * (section === 'toe' ? 1 : b.t0 + (b.t1 - b.t0) * t);
        reg[2] = (reg[2] as number) + w;
      } else {
        const closest = b.head.clone().lerp(b.tail, t);
        const off = p.clone().sub(closest);
        const dir = new Vector3().subVectors(b.tail, b.head).normalize();
        off.addScaledVector(dir, -off.dot(dir));
        const len = off.length();
        height += w * (len > 1e-9 ? off.dot(b.up) / len : 0);
        const k = section === 'head' || section === 'jaw' ? 0 : section === 'tail' ? 3 : 1;
        reg[k] = (reg[k] as number) + w;
      }
      sum += w;
    }
    if (sum > 0) {
      spineCoord /= sum;
      height /= sum;
      limb /= sum;
      for (let k = 0; k < 4; k++) reg[k] = (reg[k] as number) / sum;
    }
    let crease = 0;
    if (!mouthInside[v]) {
      const prims = culling.primsOf(culling.blockAt(p.x, p.y, p.z));
      const d = evaluator.eval(p.x, p.y, p.z, prims);
      crease = Math.min(1, Math.max(0, (evaluator.union - d) / blend));
    }
    body.set([spineCoord, height, mouthInside[v] ? -1 : limb, crease], v * 4);
    region.set(reg, v * 4);
  }
  void L;
  return { body, region };
}

/** The ArrayBuffers in a compiled creature, to transfer (not copy) it out of a worker. */
export function compiledTransferables(c: CompiledCreature): ArrayBuffer[] {
  const out = new Set<ArrayBuffer>();
  const add = (v: ArrayBufferView) => {
    if (v.buffer instanceof ArrayBuffer) out.add(v.buffer);
  };
  for (const mesh of [c.skin, c.parts, c.eyes] as const) {
    for (const value of Object.values(mesh)) if (ArrayBuffer.isView(value)) add(value);
  }
  for (const value of Object.values(c.bones)) if (ArrayBuffer.isView(value)) add(value);
  return [...out];
}

/** Names the lowest section and how to lift it, for a creature that sinks into the ground. */
function belowGround(bones: readonly BoneDef[], lowest: number, L: number): Issue {
  let owner = 'torso';
  let low = Infinity;
  for (const b of bones) {
    if (!b.skin) continue;
    const y = Math.min(b.head.y - b.r0, b.tail.y - b.r1);
    if (y < low) {
      low = y;
      owner = b.owner;
    }
  }
  const section = ['head', 'jaw', 'neck', 'torso', 'tail'].includes(owner);
  const fixes: Record<string, string> = {
    tail: 'raise body.tail.pitch or give it a positive curl',
    head: 'raise body.neck.pitch or body.head.pitch, or shorten the neck',
    jaw: 'raise body.neck.pitch or body.head.pitch, or shorten the neck',
    neck: 'raise body.neck.pitch or shorten the neck',
    torso: 'lengthen the legs or make body.torso.radius smaller',
  };
  return {
    severity: 'warning',
    path: section ? `body.${owner}` : `limbs[id=${owner.replace(/\.[LR]$/, '')}]`,
    code: 'below_ground',
    message: `the ${section ? owner : `limb ${owner}`} reaches ${(-lowest / L).toFixed(2)} torso lengths below the ground`,
    fix: fixes[owner] ?? 'raise its attach point or shorten it',
  };
}
