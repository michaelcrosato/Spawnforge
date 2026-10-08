import type { BakedClip, CompiledCreature, Registry } from '@spawnforge/core';
import {
  type BufferAttribute,
  BufferGeometry,
  DataTexture,
  FloatType,
  Group,
  Mesh,
  NearestFilter,
  Quaternion,
  RGBAFormat,
} from 'three';
import {
  add,
  attribute,
  Fn,
  float,
  instanceIndex,
  int,
  ivec2,
  mat3,
  mat4,
  mix,
  normalLocal,
  positionLocal,
  textureLoad,
  uniform,
  vec4,
} from 'three/tsl';
import type { NodeMaterial } from 'three/webgpu';
import { buildBones, type CreatureObject, createCreatureObject } from './assemble.ts';
import type { N } from './tsl-kit.ts';

/**
 * Crowds (docs/design/11.3-crowds.md): distant creatures drawn instanced, per species, level of
 * detail and mesh, posed on the GPU from their baked clips.
 */

/**
 * A species' baked clips as skinning matrices, one row per frame of every clip in turn: four
 * texels per bone (the bone's world matrix times its inverse bind matrix, column by column, as
 * three's `Skeleton.boneMatrices` holds them), then one texel for the root's position in that
 * frame. Posed as the per-creature baked level of detail poses a frame, at the origin facing +Z.
 */
export interface ClipRows {
  readonly texture: DataTexture;
  readonly bones: number;
  /** Texels per row: four per bone and the root's. */
  readonly width: number;
  readonly rows: number;
  /** Each clip's first row. */
  readonly first: ReadonlyMap<BakedClip, number>;
}

export function clipRows(compiled: CompiledCreature, clips: readonly BakedClip[]): ClipRows {
  const { bones, skeleton } = buildBones(compiled);
  const n = bones.length;
  const width = n * 4 + 1;
  const rows = clips.reduce((sum, clip) => sum + clip.frames, 0);
  const data = new Float32Array(width * rows * 4);
  const first = new Map<BakedClip, number>();
  const root = bones[compiled.rig.root];
  const top = bones[0];
  let row = 0;
  const q = new Quaternion();
  for (const clip of clips) {
    first.set(clip, row);
    for (let f = 0; f < clip.frames; f++, row++) {
      // Each bone's local transform at the frame, as the runtime's `applyClip` sets it.
      for (let b = 0; b < n; b++) {
        const bone = bones[b];
        if (!bone) continue;
        bone.quaternion.copy(q.fromArray(clip.rotations, (f * n + b) * 4));
        bone.position.fromArray(clip.positions, (f * n + b) * 3);
      }
      top?.updateMatrixWorld(true);
      skeleton.update();
      data.set(skeleton.boneMatrices as Float32Array, row * width * 4);
      const at = (row * width + n * 4) * 4;
      data[at] = root?.position.x ?? 0;
      data[at + 1] = root?.position.y ?? 0;
      data[at + 2] = root?.position.z ?? 0;
      data[at + 3] = 1;
    }
  }
  const texture = new DataTexture(data, width, rows, RGBAFormat, FloatType);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, bones: n, width, rows, first };
}

/** Instances per row of the instance texture (three texels each). */
const PER_ROW = 64;

/** Where one crowd member stands, which frames it shows, and its level of detail. */
export interface CrowdMember {
  /** The root's offset from its baked place, in metres (the creature's position). */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** The rotation applied to the baked pose about its root: heading, and an air cycle's tilt. */
  readonly rotation: Quaternion;
  /** The two rows it is between, and how far (0 at `row0`). */
  readonly row0: number;
  readonly row1: number;
  readonly blend: number;
  /** Its mesh level of detail (11.2): 0 is every triangle. */
  readonly level?: number;
}

/**
 * The position node of a crowd's materials: each vertex skinned by its four bones' matrices from
 * `rows` (lerped between the instance's two frames), turned about the root by the instance's
 * rotation and moved by its offset; the normal likewise. An instance is `base` (the object's
 * `userData.crowdBase`, where its level's members start) plus three's instance index. Three's
 * node materials apply `positionNode` after instancing, so this does the instance's part itself.
 */
export function crowdPosition(rows: ClipRows, instances: DataTexture): N {
  const base = uniform(0).onObjectUpdate(
    ({ object }) => (object?.userData.crowdBase as number | undefined) ?? 0,
  ) as N;
  return Fn(() => {
    const id = int(instanceIndex).add(int(base));
    const col = id.mod(PER_ROW).mul(3);
    const line = id.div(PER_ROW);
    const at = textureLoad(instances, ivec2(col, line)) as N;
    const turn = textureLoad(instances, ivec2(col.add(1), line)) as N;
    const frames = textureLoad(instances, ivec2(col.add(2), line)) as N;
    const r0 = int(at.w);
    const r1 = int(frames.x);
    const t = frames.y as N;
    const texel = (x: N, row: N) => textureLoad(rows.texture, ivec2(x, row)) as N;
    const bone = (k: N): N => {
      const x = int(k).mul(4);
      const m0 = mat4(texel(x, r0), texel(x.add(1), r0), texel(x.add(2), r0), texel(x.add(3), r0));
      const m1 = mat4(texel(x, r1), texel(x.add(1), r1), texel(x.add(2), r1), texel(x.add(3), r1));
      return m0.mul(float(1).sub(t)).add(m1.mul(t));
    };
    const index = attribute('skinIndex', 'uvec4') as N;
    const weight = attribute('skinWeight', 'vec4') as N;
    const skin = add(
      bone(index.x).mul(weight.x),
      bone(index.y).mul(weight.y),
      bone(index.z).mul(weight.z),
      bone(index.w).mul(weight.w),
    ) as N;
    const p = skin.mul(vec4(positionLocal, 1)).xyz as N;
    const n = mat3(skin).mul(normalLocal) as N;
    const root = int(rows.bones * 4);
    const c = mix(texel(root, r0).xyz, texel(root, r1).xyz, t) as N;
    const q = turn.xyz as N;
    const rotate = (v: N): N => v.add(q.cross(q.cross(v).add(v.mul(turn.w))).mul(2));
    normalLocal.assign(rotate(n));
    return rotate(p.sub(c)).add(c).add(at.xyz);
  })() as N;
}

/** A level's geometry: the same attributes (uploaded once), fewer triangles. */
function levelGeometry(source: BufferGeometry, index: BufferAttribute): BufferGeometry {
  const g = new BufferGeometry();
  for (const [name, attribute] of Object.entries(source.attributes))
    g.setAttribute(name, attribute);
  g.setIndex(index);
  return g;
}

/**
 * One species' crowd: its own materials (compiled once) over its geometry, a skin and a parts
 * mesh per level of detail and one eyes and one membranes mesh, each drawn once per member it
 * covers. `write` places the members, grouped by level; their texture uploads once per frame.
 */
export class CrowdDraw {
  readonly object = new Group();
  readonly rows: ClipRows;
  /** The most members it draws; a bigger crowd needs a new draw. */
  readonly capacity: number;
  private readonly instances: DataTexture;
  /** Per level: its skin and parts meshes (level 0 is the full meshes). */
  private readonly levels: Mesh[][];
  /** Eyes and membranes, the same at every level: drawn for every member. */
  private readonly whole: Mesh[];
  private readonly extra: BufferGeometry[] = [];
  private readonly view: CreatureObject;

  constructor(
    compiled: CompiledCreature,
    registry: Registry,
    rows: ClipRows,
    options: {
      readonly capacity?: number;
      /** Each level of detail's triangles for the skin and the parts (11.2), coarsest last. */
      readonly levels?: readonly {
        readonly skin: BufferAttribute;
        readonly parts: BufferAttribute;
      }[];
    } = {},
  ) {
    this.rows = rows;
    this.capacity = Math.max(PER_ROW, Math.ceil((options.capacity ?? PER_ROW) / PER_ROW) * PER_ROW);
    this.instances = instanceTexture(this.capacity);
    // The creature's own geometry and materials, posed by the crowd's node instead of a skeleton.
    this.view = createCreatureObject(compiled, registry);
    const { skin, parts, eyes, membranes } = this.view.meshes;
    const crowdMesh = (source: Mesh, geometry: BufferGeometry, name: string) => {
      const mesh = new Mesh(geometry, source.material);
      mesh.name = name;
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = source.visible;
      mesh.userData.crowdBase = 0;
      this.object.add(mesh);
      return mesh;
    };
    for (const source of [skin, parts, eyes, ...(membranes ? [membranes] : [])])
      (source.material as NodeMaterial).positionNode = crowdPosition(rows, this.instances);
    this.levels = [
      [
        crowdMesh(skin, skin.geometry, 'crowd_skin'),
        crowdMesh(parts, parts.geometry, 'crowd_parts'),
      ],
    ];
    (options.levels ?? []).forEach((level, k) => {
      const g = [
        levelGeometry(skin.geometry, level.skin),
        levelGeometry(parts.geometry, level.parts),
      ];
      this.extra.push(...g);
      this.levels.push([
        crowdMesh(skin, g[0] as BufferGeometry, `crowd_skin_LOD${k + 1}`),
        crowdMesh(parts, g[1] as BufferGeometry, `crowd_parts_LOD${k + 1}`),
      ]);
    });
    this.whole = [
      crowdMesh(eyes, eyes.geometry, 'crowd_eyes'),
      ...(membranes ? [crowdMesh(membranes, membranes.geometry, 'crowd_membranes')] : []),
    ];
  }

  /** Places the members, up to the capacity; seconds drive pulsing patterns. */
  write(members: readonly CrowdMember[], seconds: number): void {
    const top = this.levels.length - 1;
    const levelOf = (m: CrowdMember) => Math.max(0, Math.min(top, m.level ?? 0));
    // Grouped by level, so each level's meshes draw one run of instances.
    const sorted = [...members.slice(0, this.capacity)].sort((a, b) => levelOf(a) - levelOf(b));
    const data = this.instances.image.data as Float32Array;
    sorted.forEach((m, i) => {
      const at = (Math.floor(i / PER_ROW) * PER_ROW * 3 + (i % PER_ROW) * 3) * 4;
      data.set([m.x, m.y, m.z, m.row0], at);
      data.set([m.rotation.x, m.rotation.y, m.rotation.z, m.rotation.w], at + 4);
      data.set([m.row1, m.blend, 0, 0], at + 8);
    });
    this.instances.needsUpdate = true;
    let base = 0;
    this.levels.forEach((meshes, k) => {
      const count = sorted.filter((m) => levelOf(m) === k).length;
      for (const mesh of meshes) {
        mesh.count = count;
        mesh.userData.crowdBase = base;
      }
      base += count;
    });
    for (const mesh of this.whole) mesh.count = sorted.length;
    this.view.signals.time.value = seconds;
  }

  dispose(): void {
    this.object.removeFromParent();
    // The levels' indices are the species' (its creatures draw them too): keep them.
    for (const g of this.extra) {
      g.setIndex(null);
      g.dispose();
    }
    this.view.dispose();
    this.instances.dispose();
  }
}

function instanceTexture(capacity: number): DataTexture {
  const texture = new DataTexture(
    new Float32Array(PER_ROW * 3 * (capacity / PER_ROW) * 4),
    PER_ROW * 3,
    capacity / PER_ROW,
    RGBAFormat,
    FloatType,
  );
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
