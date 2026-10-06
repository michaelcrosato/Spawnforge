import {
  type BakedClip,
  type BakedColors,
  bakeVertexColors,
  type CompiledCreature,
  type Registry,
} from '@spawnforge/core';
import {
  AnimationClip,
  BufferAttribute,
  Group,
  type KeyframeTrack,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  QuaternionKeyframeTrack,
  SkinnedMesh,
  VectorKeyframeTrack,
} from 'three';
import { buildBones, geometryOf } from './assemble.ts';

export interface ExportSceneOptions {
  /** Baked clips (core's `bakeClips`) to include as animations. */
  readonly clips?: readonly BakedClip[];
  /** Extra JSON stored with the creature (glTF extras), e.g. the blueprint and stats. */
  readonly extras?: Record<string, unknown>;
}

/** Bone names become node names, and animation tracks address nodes as `name.property`. */
export const exportName = (name: string) => name.replace(/[.:/[\]\s]/g, '_');

const average = (values: Float32Array) => {
  let sum = 0;
  for (const v of values) sum += v;
  return values.length > 0 ? sum / values.length : 0.5;
};

function bakedMesh(
  data: CompiledCreature['skin'] | CompiledCreature['parts'] | CompiledCreature['eyes'],
  colors: BakedColors,
  name: string,
): SkinnedMesh {
  const geometry = geometryOf(data, {});
  geometry.setAttribute('color', new BufferAttribute(colors.color, 3));
  // glTF keeps one roughness per material without textures: use the mesh's average.
  const material = new MeshStandardMaterial({
    vertexColors: true,
    roughness: average(colors.roughness),
    metalness: 0,
  });
  material.name = name;
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = name;
  return mesh;
}

/** Animation tracks for one baked clip: rotations for every bone that moves, root position. */
function clipOf(clip: BakedClip, compiled: CompiledCreature): AnimationClip {
  const names = compiled.bones.names.map(exportName);
  const n = names.length;
  const times = new Float32Array(clip.frames);
  for (let f = 0; f < clip.frames; f++) times[f] = (clip.duration * f) / (clip.frames - 1 || 1);
  const tracks: KeyframeTrack[] = [];
  for (let b = 0; b < n; b++) {
    const rot = new Float32Array(clip.frames * 4);
    const pos = new Float32Array(clip.frames * 3);
    let turns = false;
    let moves = false;
    for (let f = 0; f < clip.frames; f++) {
      for (let j = 0; j < 4; j++) {
        rot[f * 4 + j] = clip.rotations[(f * n + b) * 4 + j] as number;
        if (Math.abs((rot[f * 4 + j] as number) - (rot[j] as number)) > 1e-5) turns = true;
      }
      for (let j = 0; j < 3; j++) {
        pos[f * 3 + j] = clip.positions[(f * n + b) * 3 + j] as number;
        if (Math.abs((pos[f * 3 + j] as number) - (pos[j] as number)) > 1e-5) moves = true;
      }
    }
    // Every animated bone gets a rotation track, so clips never inherit another clip's pose.
    if (turns || b === 0)
      tracks.push(new QuaternionKeyframeTrack(`${names[b]}.quaternion`, times, rot));
    if (moves || b === 0) tracks.push(new VectorKeyframeTrack(`${names[b]}.position`, times, pos));
  }
  // Blinks squash the eyes top to bottom (their local Z is up), as the live renderer does.
  if (clip.blink.some((v) => v > 0.001))
    for (const eye of compiled.rig.eyes) {
      const scale = new Float32Array(clip.frames * 3);
      for (let f = 0; f < clip.frames; f++)
        scale.set([1, 1, 1 - 0.92 * (clip.blink[f] as number)], f * 3);
      tracks.push(new VectorKeyframeTrack(`${names[eye]}.scale`, times, scale));
    }
  return new AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * The creature as a plain Three.js scene ready for glTF export: one skinned mesh each for the
 * skin, hard parts and eyes, with the pattern stack baked into vertex colours (albedo only);
 * the skeleton; gameplay sockets as empty nodes on their bones; baked clips as animations; and
 * `extras` (with the sockets, hit capsules and clip timings) on the root's userData, which
 * GLTFExporter writes as glTF extras. Metres, Y up, facing +Z.
 */
export function buildExportScene(
  compiled: CompiledCreature,
  registry: Registry,
  options: ExportSceneOptions = {},
): { scene: Group; animations: AnimationClip[] } {
  const { bones, skeleton } = buildBones(compiled);
  for (const bone of bones) bone.name = exportName(bone.name);
  const scene = new Group();
  scene.name = exportName(compiled.name || 'creature');
  scene.add(bones[0] as Object3D);
  const colors = bakeVertexColors(compiled, registry);
  const meshes = [
    bakedMesh(compiled.skin, colors.skin, 'skin'),
    bakedMesh(compiled.parts, colors.parts, 'parts'),
    bakedMesh(compiled.eyes, colors.eyes, 'eyes'),
  ];
  for (const mesh of meshes) {
    if ((mesh.geometry.index?.count ?? 0) === 0) continue;
    mesh.bind(skeleton, new Matrix4());
    scene.add(mesh);
  }
  for (const socket of compiled.sockets) {
    const node = new Object3D();
    node.name = `socket_${exportName(socket.name)}`;
    node.position.set(...socket.offset);
    bones[socket.bone]?.add(node);
  }
  const animations = (options.clips ?? []).map((clip) => clipOf(clip, compiled));
  scene.userData = {
    spawnforge: {
      name: compiled.name,
      seed: compiled.seed,
      scale: compiled.scale,
      quality: compiled.quality,
      sockets: compiled.sockets.map((s) => ({
        name: s.name,
        node: `socket_${exportName(s.name)}`,
        bone: bones[s.bone]?.name,
      })),
      hitCapsules: compiled.hitCapsules.map((c) => ({
        bone: bones[c.bone]?.name,
        radius: c.radius,
      })),
      clips: (options.clips ?? []).map((c) => ({
        name: c.name,
        duration: c.duration,
        loop: c.loop,
        speed: c.speed,
        distance: c.distance,
        events: c.events.map((e) => ({
          type: e.type,
          time: e.time,
          ...(e.leg ? { leg: e.leg } : {}),
        })),
      })),
      ...options.extras,
    },
  };
  return { scene, animations };
}
