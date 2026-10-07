import { allEyes, type CompiledCreature, type MeshData, type Registry } from '@spawnforge/core';
import {
  Bone,
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Quaternion,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
  Vector3,
} from 'three';
import { uniform } from 'three/tsl';
import {
  eyeMaterial,
  FUR_SHELLS,
  type FurEye,
  furMaterial,
  membraneMaterial,
  partsMaterial,
  skinMaterial,
} from './materials.ts';

/** A compiled creature as Three.js objects: one skinned mesh per draw call, sharing a skeleton. */
export interface CreatureObject {
  /** Add this to the scene. */
  readonly object: Group;
  readonly skeleton: Skeleton;
  readonly bones: readonly Bone[];
  readonly meshes: {
    readonly skin: SkinnedMesh;
    readonly parts: SkinnedMesh;
    readonly eyes: SkinnedMesh;
    /**
     * Shell fur: the skin's geometry drawn once per shell in one instanced call; absent without
     * fur or at low quality.
     */
    readonly fur?: SkinnedMesh;
    /** Wing and fin membranes, feathers and fins: absent without (docs/design/9.3-wings-fins.md). */
    readonly membranes?: SkinnedMesh;
  };
  /** Shader inputs the pose drives (`applyPose` sets them): breathing, and seconds for pulses. */
  readonly signals: { readonly breath: { value: number }; readonly time: { value: number } };
  /** Eye bone indices (the eyeballs; eyelids are bones of their own that blink). */
  readonly eyeBones: readonly number[];
  /** Rest local transforms per bone, for resetting poses. */
  readonly rest: {
    readonly positions: readonly Vector3[];
    readonly rotations: readonly Quaternion[];
  };
  dispose(): void;
}

/** A skinned geometry from compiled mesh data, with extra per-vertex attributes. */
export function geometryOf(
  data: MeshData,
  extra: Record<string, [Float32Array, number]>,
): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(data.positions, 3));
  g.setAttribute('normal', new Float32BufferAttribute(data.normals, 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(data.skinIndex, 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(data.skinWeight, 4));
  for (const [name, [array, size]] of Object.entries(extra))
    g.setAttribute(name, new BufferAttribute(array, size));
  g.setIndex(new BufferAttribute(data.indices, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

/**
 * The compiled skeleton as Three.js bones, bound into a `Skeleton` in the bind pose and left
 * standing in the rest pose (which differs only where wings fold).
 */
export function buildBones(compiled: CompiledCreature): {
  bones: Bone[];
  skeleton: Skeleton;
  rest: { positions: Vector3[]; rotations: Quaternion[] };
} {
  const data = compiled.bones;
  const count = data.names.length;
  const worldPos = Array.from({ length: count }, (_, i) =>
    new Vector3().fromArray(data.positions, i * 3),
  );
  const worldRot = Array.from({ length: count }, (_, i) =>
    new Quaternion().fromArray(data.rotations, i * 4),
  );
  const bones: Bone[] = [];
  const positions: Vector3[] = [];
  const rotations: Quaternion[] = [];
  for (let i = 0; i < count; i++) {
    const bone = new Bone();
    bone.name = data.names[i] as string;
    const parent = data.parents[i] as number;
    if (parent >= 0) {
      const inv = (worldRot[parent] as Quaternion).clone().invert();
      bone.position.copy(
        (worldPos[i] as Vector3)
          .clone()
          .sub(worldPos[parent] as Vector3)
          .applyQuaternion(inv),
      );
      bone.quaternion.copy(inv.multiply(worldRot[i] as Quaternion));
      (bones[parent] as Bone).add(bone);
    } else {
      bone.position.copy(worldPos[i] as Vector3);
      bone.quaternion.copy(worldRot[i] as Quaternion);
    }
    positions.push(bone.position.clone());
    rotations.push(bone.quaternion.clone());
    bones.push(bone);
  }
  (bones[0] as Bone).updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);
  skeleton.calculateInverses();
  // Bound in the bind pose; standing in the rest pose (folded wings, docs/design/9.3-wings-fins.md).
  const rest = data.rest;
  if (rest) {
    bones.forEach((bone, i) => {
      bone.quaternion.fromArray(rest, i * 4);
      (rotations[i] as Quaternion).copy(bone.quaternion);
    });
    (bones[0] as Bone).updateMatrixWorld(true);
  }
  return { bones, skeleton, rest: { positions, rotations } };
}

/** Each eye's rest centre (its bone) and radius (its farthest vertex), for fur to keep clear of. */
function eyeSpheres(compiled: CompiledCreature): FurEye[] {
  const { positions, skinIndex } = compiled.eyes;
  const bones = compiled.bones.positions;
  return allEyes(compiled.rig).map((bone) => {
    const x = bones[bone * 3] as number;
    const y = bones[bone * 3 + 1] as number;
    const z = bones[bone * 3 + 2] as number;
    let radius = 0;
    for (let v = 0; v < positions.length / 3; v++)
      if (skinIndex[v * 4] === bone)
        radius = Math.max(
          radius,
          Math.hypot(
            (positions[v * 3] as number) - x,
            (positions[v * 3 + 1] as number) - y,
            (positions[v * 3 + 2] as number) - z,
          ),
        );
    return { x, y, z, radius };
  });
}

/** Builds the Three.js skeleton and the skinned meshes for a compiled creature. */
export function createCreatureObject(
  compiled: CompiledCreature,
  registry: Registry,
): CreatureObject {
  const { bones, skeleton, rest } = buildBones(compiled);
  const restPositions = rest.positions;
  const restRotations = rest.rotations;
  const object = new Group();
  object.name = compiled.name;
  object.add(bones[0] as Bone);

  const breath = uniform(0);
  const time = uniform(0);
  const clear = compiled.material.fur ? eyeSpheres(compiled) : [];
  const skin = new SkinnedMesh(
    geometryOf(compiled.skin, { body: [compiled.skin.body, 4], region: [compiled.skin.region, 4] }),
    skinMaterial(compiled.material, compiled.scale, registry, { breath, time }, clear),
  );
  // Fur shares the skin's geometry and draws its shells as instances: one call.
  const shells = compiled.material.fur ? FUR_SHELLS[compiled.quality] : 0;
  const fur =
    compiled.material.fur && shells > 0
      ? new SkinnedMesh(
          skin.geometry,
          furMaterial(
            compiled.material,
            compiled.material.fur,
            shells,
            compiled.scale,
            registry,
            { breath, time },
            clear,
          ),
        )
      : undefined;
  if (fur) {
    fur.name = 'fur';
    fur.count = shells;
  }
  const parts = new SkinnedMesh(
    geometryOf(compiled.parts, {
      color: [compiled.parts.color, 3],
      info: [compiled.parts.info, 2],
    }),
    partsMaterial(),
  );
  const eyes = new SkinnedMesh(
    geometryOf(compiled.eyes, {
      eye: [compiled.eyes.eye, 4],
      iris: [compiled.eyes.iris, 4],
      sclera: [compiled.eyes.sclera, 3],
    }),
    eyeMaterial(),
  );
  const m = compiled.membranes;
  const membranes =
    m.indices.length > 0
      ? new SkinnedMesh(
          geometryOf(m, { color: [m.color, 3], info: [m.info, 4], vein: [m.vein, 2] }),
          membraneMaterial(m.info.some((v, i) => i % 4 === 0 && v < 0.999)),
        )
      : undefined;
  if (membranes) {
    membranes.name = 'membranes';
    membranes.bind(skeleton, new Matrix4());
    membranes.castShadow = true;
    membranes.receiveShadow = true;
    membranes.frustumCulled = false;
  }
  skin.name = 'skin';
  parts.name = 'parts';
  eyes.name = 'eyes';
  for (const mesh of [skin, parts, eyes]) {
    mesh.bind(skeleton, new Matrix4());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    if (mesh.geometry.index && mesh.geometry.index.count === 0) mesh.visible = false;
    object.add(mesh);
  }
  if (membranes) object.add(membranes);
  if (fur) {
    fur.bind(skeleton, new Matrix4());
    // The skin under it already casts the shadow.
    fur.castShadow = false;
    fur.receiveShadow = true;
    fur.frustumCulled = false;
    object.add(fur);
  }
  return {
    object,
    skeleton,
    bones,
    meshes: { skin, parts, eyes, ...(fur ? { fur } : {}), ...(membranes ? { membranes } : {}) },
    signals: { breath, time },
    eyeBones: allEyes(compiled.rig),
    rest: { positions: restPositions, rotations: restRotations },
    dispose() {
      for (const mesh of [skin, parts, eyes, ...(membranes ? [membranes] : [])]) {
        mesh.geometry.dispose();
        (mesh.material as { dispose(): void }).dispose();
      }
      (fur?.material as { dispose(): void } | undefined)?.dispose();
    },
  };
}
