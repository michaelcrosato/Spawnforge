import {
  type BakedClip,
  type BakedColors,
  bakeVertexColors,
  type CompiledCreature,
  MATERIAL_LOOK,
  type MaterialLook,
  type Registry,
} from '@spawnforge/core';
import {
  AnimationClip,
  BufferAttribute,
  DoubleSide,
  Group,
  type KeyframeTrack,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  type Quaternion,
  QuaternionKeyframeTrack,
  SkinnedMesh,
  type Vector3,
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
  data:
    | CompiledCreature['skin']
    | CompiledCreature['parts']
    | CompiledCreature['eyes']
    | CompiledCreature['membranes'],
  colors: BakedColors,
  name: string,
  look?: MaterialLook,
): SkinnedMesh {
  const geometry = geometryOf(data, {});
  geometry.setAttribute('color', new BufferAttribute(colors.color, 3));
  // glTF keeps one roughness per material without textures: use the mesh's average. A lacquered
  // material (chitin) keeps its clearcoat, which glTF has as KHR_materials_clearcoat.
  const settings = { vertexColors: true, roughness: average(colors.roughness), metalness: 0 };
  const material =
    look && look.clearcoat > 0
      ? new MeshPhysicalMaterial({
          ...settings,
          clearcoat: look.clearcoat,
          clearcoatRoughness: look.clearcoatRoughness,
        })
      : new MeshStandardMaterial(settings);
  material.name = name;
  const mesh = new SkinnedMesh(geometry, material);
  mesh.name = name;
  return mesh;
}

/**
 * Wing and fin membranes (docs/design/9.3-wings-fins.md): double-sided, and blended with each
 * vertex's opacity in its colour's alpha when some of it is see-through.
 */
function membraneMesh(compiled: CompiledCreature, colors: BakedColors): SkinnedMesh {
  const m = compiled.membranes;
  const mesh = bakedMesh(m, colors, 'membranes');
  const material = mesh.material as MeshStandardMaterial;
  material.side = DoubleSide;
  const n = colors.color.length / 3;
  let seeThrough = false;
  for (let i = 0; i < n; i++) if ((m.info[i * 4] as number) < 0.999) seeThrough = true;
  if (seeThrough) {
    const rgba = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      rgba.set(colors.color.subarray(i * 3, i * 3 + 3), i * 4);
      rgba[i * 4 + 3] = m.info[i * 4] as number;
    }
    mesh.geometry.setAttribute('color', new BufferAttribute(rgba, 4));
    material.transparent = true;
  }
  return mesh;
}

/**
 * Animation tracks for one baked clip: rotations for every bone that moves or stands away from
 * its node default (the rest pose: a folded wing that holds still still needs its track,
 * docs/design/9.3-wings-fins.md), and the root's position.
 */
function clipOf(
  clip: BakedClip,
  compiled: CompiledCreature,
  rest: { readonly positions: readonly Vector3[]; readonly rotations: readonly Quaternion[] },
): AnimationClip {
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
    const q = rest.rotations[b] as Quaternion;
    const p = rest.positions[b] as Vector3;
    const restRot = [q.x, q.y, q.z, q.w];
    const restPos = [p.x, p.y, p.z];
    for (let f = 0; f < clip.frames; f++) {
      // q and -q are the same turn.
      let dot = 0;
      for (let j = 0; j < 4; j++) {
        rot[f * 4 + j] = clip.rotations[(f * n + b) * 4 + j] as number;
        dot += (rot[f * 4 + j] as number) * (restRot[j] as number);
        if (Math.abs((rot[f * 4 + j] as number) - (rot[j] as number)) > 1e-5) turns = true;
      }
      if (Math.abs(dot) < 1 - 1e-6) turns = true;
      for (let j = 0; j < 3; j++) {
        pos[f * 3 + j] = clip.positions[(f * n + b) * 3 + j] as number;
        if (Math.abs((pos[f * 3 + j] as number) - (pos[j] as number)) > 1e-5) moves = true;
        if (Math.abs((pos[f * 3 + j] as number) - (restPos[j] as number)) > 1e-5) moves = true;
      }
    }
    // Every animated bone gets a rotation track, so clips never inherit another clip's pose.
    if (turns || b === 0)
      tracks.push(new QuaternionKeyframeTrack(`${names[b]}.quaternion`, times, rot));
    if (moves || b === 0) tracks.push(new VectorKeyframeTrack(`${names[b]}.position`, times, pos));
  }
  // Blinks are the eyelid bones' rotation tracks above, recorded with every other bone's.
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
): { scene: Group; animations: AnimationClip[]; notes: string[] } {
  const { bones, skeleton, rest } = buildBones(compiled);
  for (const bone of bones) bone.name = exportName(bone.name);
  const scene = new Group();
  scene.name = exportName(compiled.name || 'creature');
  scene.add(bones[0] as Object3D);
  const colors = bakeVertexColors(compiled, registry);
  const meshes = [
    bakedMesh(compiled.skin, colors.skin, 'skin', MATERIAL_LOOK[compiled.material.material]),
    bakedMesh(compiled.parts, colors.parts, 'parts'),
    bakedMesh(compiled.eyes, colors.eyes, 'eyes'),
    membraneMesh(compiled, colors.membranes),
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
  const animations = (options.clips ?? []).map((clip) => clipOf(clip, compiled, rest));
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
        // The root track moves the creature (a jump): apply it, or strip it and move it yourself.
        ...(c.rootMotion ? { rootMotion: true } : {}),
        // An air cycle: the body's pitch it was baked at, to tilt it to the flight path.
        ...(c.air ? { air: { pitch: c.air.pitch } } : {}),
        events: c.events.map((e) => ({
          type: e.type,
          time: e.time,
          ...(e.leg ? { leg: e.leg } : {}),
        })),
      })),
      ...options.extras,
    },
  };
  return { scene, animations, notes: exportNotes(compiled, colors.skin.glow ?? 0) };
}

/**
 * What the live creature shows that the file leaves out: shell fur and glow need shaders or
 * texture maps, which milestone 11.1 brings (docs/design/8.4-materials.md).
 */
function exportNotes(compiled: CompiledCreature, glow: number): string[] {
  const notes: string[] = [];
  if (compiled.material.fur)
    notes.push('fur is left out: its shells need the live shader; the skin under it is exported');
  if (glow > 0)
    notes.push('glowing layers are left out: glow needs an emissive texture (plan milestone 11.1)');
  if (compiled.membranes.indices.length > 0)
    notes.push(
      'membranes are double-sided, with their veins and the light through them approximated in vertex colours (veins alias on small wings)',
    );
  return notes;
}
