import type { CompiledCreature, MeshData, Registry } from '@spawnforge/core';
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
import { eyeMaterial, partsMaterial, skinMaterial } from './materials.ts';

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
  };
  /** Shader inputs the pose drives (`applyPose` sets them). */
  readonly signals: { readonly breath: { value: number } };
  /** Eye bone indices, which blink by squashing. */
  readonly eyeBones: readonly number[];
  /** Rest local transforms per bone, for resetting poses. */
  readonly rest: {
    readonly positions: readonly Vector3[];
    readonly rotations: readonly Quaternion[];
  };
  dispose(): void;
}

function geometryOf(data: MeshData, extra: Record<string, [Float32Array, number]>): BufferGeometry {
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

/** Builds the Three.js skeleton and the three skinned meshes for a compiled creature. */
export function createCreatureObject(
  compiled: CompiledCreature,
  registry: Registry,
): CreatureObject {
  const data = compiled.bones;
  const count = data.names.length;
  const worldPos = Array.from({ length: count }, (_, i) =>
    new Vector3().fromArray(data.positions, i * 3),
  );
  const worldRot = Array.from({ length: count }, (_, i) =>
    new Quaternion().fromArray(data.rotations, i * 4),
  );
  const bones: Bone[] = [];
  const restPositions: Vector3[] = [];
  const restRotations: Quaternion[] = [];
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
    restPositions.push(bone.position.clone());
    restRotations.push(bone.quaternion.clone());
    bones.push(bone);
  }
  const object = new Group();
  object.name = compiled.name;
  const root = bones[0] as Bone;
  object.add(root);
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);
  skeleton.calculateInverses();

  const breath = uniform(0);
  const skin = new SkinnedMesh(
    geometryOf(compiled.skin, { body: [compiled.skin.body, 4], region: [compiled.skin.region, 4] }),
    skinMaterial(compiled.material, compiled.scale, registry, { breath }),
  );
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
  return {
    object,
    skeleton,
    bones,
    meshes: { skin, parts, eyes },
    signals: { breath },
    eyeBones: compiled.rig.eyes,
    rest: { positions: restPositions, rotations: restRotations },
    dispose() {
      for (const mesh of [skin, parts, eyes]) {
        mesh.geometry.dispose();
        (mesh.material as { dispose(): void }).dispose();
      }
    },
  };
}
