import {
  type BakedClip,
  type BakedColors,
  type BakedMap,
  type BakedTextures,
  bakeVertexColors,
  type CompiledCreature,
  EYE_ROUGHNESS,
  type LodChain,
  type LodLevel,
  MATERIAL_LOOK,
  type MaterialLook,
  type Registry,
  screenCoverage,
  type TexturedMesh,
} from '@spawnforge/core';
import {
  AnimationClip,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  type KeyframeTrack,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  Matrix4,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  type Quaternion,
  QuaternionKeyframeTrack,
  RGBAFormat,
  SkinnedMesh,
  SRGBColorSpace,
  type Vector3,
  VectorKeyframeTrack,
} from 'three';
import { buildBones, geometryOf } from './assemble.ts';

export interface ExportSceneOptions {
  /** Baked clips (core's `bakeClips`) to include as animations. */
  readonly clips?: readonly BakedClip[];
  /** Extra JSON stored with the creature (glTF extras), e.g. the blueprint and stats. */
  readonly extras?: Record<string, unknown>;
  /**
   * Texture maps from `@spawnforge/bake` (docs/design/11.1-textures.md): each mesh they cover is
   * written with UVs, tangents and maps instead of vertex colours.
   */
  readonly textures?: BakedTextures;
  /** How albedo and glow images are encoded: PNG (default) or JPEG, to keep files small. */
  readonly colorImages?: 'image/png' | 'image/jpeg';
  /**
   * Levels of detail from `@spawnforge/bake/lod` (docs/design/11.2-lod.md), over the meshes as
   * written: the textured ones when `textures` has them, else the compiled ones. Written as
   * `skin_LOD1` and so on with `MSFT_lod`; register `lodExporterPlugin` with the exporter.
   */
  readonly lods?: LodChain;
}

/** The levels each written mesh carries, and their screen coverages, for `lodExporterPlugin`. */
const lodsOf = new WeakMap<
  Object3D,
  { readonly levels: Object3D[]; readonly coverage: number[] }
>();

/**
 * A level of a mesh: its geometry's attributes (written once, shared) with fewer triangles, its
 * material and skeleton.
 */
function lodMesh(base: SkinnedMesh, level: LodLevel, k: number): SkinnedMesh {
  const geometry = new BufferGeometry();
  for (const [name, attribute] of Object.entries(base.geometry.attributes))
    geometry.setAttribute(name, attribute);
  geometry.setIndex(new BufferAttribute(level.indices, 1));
  geometry.boundingBox = base.geometry.boundingBox;
  geometry.boundingSphere = base.geometry.boundingSphere;
  const mesh = new SkinnedMesh(geometry, base.material);
  mesh.name = `${base.name}_LOD${k}`;
  return mesh;
}

/** The part of three's GLTFWriter a plugin reads. */
interface GltfWriter {
  readonly json: {
    nodes?: {
      children?: number[];
      extensions?: Record<string, unknown>;
      extras?: Record<string, unknown>;
    }[];
    scenes?: { nodes?: number[] }[];
  };
  readonly nodeMap: Map<Object3D, number>;
  readonly extensionsUsed: Record<string, boolean>;
}

/**
 * For `new GLTFExporter().register(lodExporterPlugin)`: lists each mesh's levels on its node with
 * `MSFT_lod` (and `MSFT_screencoverage` in its extras), and takes them out of the scene's tree,
 * so loaders without the extension show only the full mesh (docs/design/11.2-lod.md, decision 7).
 */
export function lodExporterPlugin(gltfWriter: object): { afterParse(): void } {
  // Three's types leave out the writer's JSON and node map, which plugins do read.
  const writer = gltfWriter as GltfWriter;
  return {
    afterParse() {
      const nodes = writer.json.nodes ?? [];
      const levels = new Set<number>();
      for (const [object, index] of writer.nodeMap) {
        const entry = lodsOf.get(object);
        const node = nodes[index];
        if (!entry || !node) continue;
        const ids = entry.levels
          .map((o) => writer.nodeMap.get(o))
          .filter((i): i is number => i !== undefined);
        if (ids.length === 0) continue;
        for (const id of ids) levels.add(id);
        node.extensions = { ...node.extensions, MSFT_lod: { ids } };
        node.extras = { ...node.extras, MSFT_screencoverage: entry.coverage };
        writer.extensionsUsed.MSFT_lod = true;
      }
      if (levels.size === 0) return;
      for (const node of nodes) {
        if (!node.children) continue;
        node.children = node.children.filter((c) => !levels.has(c));
        if (node.children.length === 0) delete node.children;
      }
      for (const scene of writer.json.scenes ?? [])
        if (scene.nodes) scene.nodes = scene.nodes.filter((n) => !levels.has(n));
    },
  };
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

/** A baked image as a texture the exporter writes (v down, as glTF's images are). */
function mapTexture(map: BakedMap, mimeType: string): DataTexture {
  const texture = new DataTexture(map.data, map.size, map.size, RGBAFormat);
  texture.colorSpace = map.srgb ? SRGBColorSpace : LinearSRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.userData.mimeType = mimeType;
  texture.needsUpdate = true;
  return texture;
}

/**
 * A mesh with its baked maps (docs/design/11.1-textures.md, decision 8): base colour, normal map
 * (and the lacquer's normal), one ORM image for occlusion, roughness and metalness, and glow
 * scaled by its strength.
 */
function texturedMesh(
  data: TexturedMesh,
  name: string,
  options: { look?: MaterialLook; eyes?: boolean; membrane?: boolean; colorImages: string },
): SkinnedMesh {
  const geometry = geometryOf(data, {
    uv: [data.uvs, 2],
    ...(data.tangents ? { tangent: [data.tangents, 4] } : {}),
  });
  const settings = {
    map: mapTexture(data.albedo, data.blend ? 'image/png' : options.colorImages),
    metalness: 0,
    roughness: options.eyes ? EYE_ROUGHNESS : 1,
  };
  const look = options.look;
  const material =
    look && look.clearcoat > 0
      ? new MeshPhysicalMaterial({
          ...settings,
          clearcoat: look.clearcoat,
          clearcoatRoughness: look.clearcoatRoughness,
        })
      : new MeshStandardMaterial(settings);
  material.name = name;
  if (!options.eyes) {
    // One image for all three, so the exporter writes it once; metalness is its B channel (0).
    const orm = mapTexture(data.orm, 'image/png');
    material.aoMap = orm;
    material.roughnessMap = orm;
    material.metalnessMap = orm;
    material.metalness = 1;
  }
  if (data.normal) {
    material.normalMap = mapTexture(data.normal, 'image/png');
    if (material instanceof MeshPhysicalMaterial && material.clearcoat > 0)
      material.clearcoatNormalMap = material.normalMap;
  }
  if (data.emissive) {
    material.emissiveMap = mapTexture(data.emissive, options.colorImages);
    const strength = data.emissiveStrength ?? 1;
    // Up to 1 in the factor; above it, KHR_materials_emissive_strength.
    material.emissive = new Color(1, 1, 1).multiplyScalar(Math.min(1, strength));
    material.emissiveIntensity = Math.max(1, strength);
  }
  if (options.membrane) {
    material.side = DoubleSide;
    if (data.blend) material.transparent = true;
  }
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
      // Unit length, as glTF wants (float rounding leaves some a hair over).
      const len = Math.hypot(
        rot[f * 4] as number,
        rot[f * 4 + 1] as number,
        rot[f * 4 + 2] as number,
        rot[f * 4 + 3] as number,
      );
      if (len > 0) for (let j = 0; j < 4; j++) rot[f * 4 + j] = (rot[f * 4 + j] as number) / len;
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
  // glTF wants unit rotations; float rounding leaves some a hair over (the validator's error).
  for (const bone of bones) {
    bone.name = exportName(bone.name);
    bone.quaternion.normalize();
  }
  const scene = new Group();
  scene.name = exportName(compiled.name || 'creature');
  scene.add(bones[0] as Object3D);
  const colors = bakeVertexColors(compiled, registry);
  const maps = options.textures;
  const colorImages = options.colorImages ?? 'image/png';
  const skinLook = MATERIAL_LOOK[compiled.material.material];
  const meshes = [
    maps?.skin
      ? texturedMesh(maps.skin, 'skin', { look: skinLook, colorImages })
      : bakedMesh(compiled.skin, colors.skin, 'skin', skinLook),
    maps?.parts
      ? texturedMesh(maps.parts, 'parts', { colorImages })
      : bakedMesh(compiled.parts, colors.parts, 'parts'),
    maps?.eyes
      ? texturedMesh(maps.eyes, 'eyes', { eyes: true, colorImages })
      : bakedMesh(compiled.eyes, colors.eyes, 'eyes'),
    maps?.membranes
      ? texturedMesh(maps.membranes, 'membranes', { membrane: true, colorImages })
      : membraneMesh(compiled, colors.membranes),
  ];
  // The creature's size, for the levels' screen coverages.
  const size = Math.max(
    ...compiled.bounds.max.map((v, i) => v - (compiled.bounds.min[i] as number)),
  );
  const lods: Record<string, { triangles: number; error: number; node: string }[]> = {};
  for (const mesh of meshes) {
    if ((mesh.geometry.index?.count ?? 0) === 0) continue;
    mesh.bind(skeleton, new Matrix4());
    scene.add(mesh);
    const chain = options.lods?.[mesh.name as keyof LodChain];
    const vertices = mesh.geometry.getAttribute('position').count;
    if (!chain || chain.length === 0 || chain.some((l) => l.indices.some((v) => v >= vertices)))
      continue;
    const levels = chain.map((level, k) => {
      const lod = lodMesh(mesh, level, k + 1);
      lod.bind(skeleton, new Matrix4());
      scene.add(lod);
      return lod;
    });
    // Each level from where the previous one's error drops under a pixel at 1080 pixels.
    lodsOf.set(mesh, {
      levels,
      coverage: [...chain.map((l) => Number(screenCoverage(l.error, size).toFixed(4))), 0],
    });
    lods[mesh.name] = chain.map((l, k) => ({
      triangles: l.triangles,
      error: Number(l.error.toPrecision(3)),
      node: `${mesh.name}_LOD${k + 1}`,
    }));
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
      ...(maps
        ? {
            textures: {
              size: maps.size,
              maps: Object.fromEntries(
                (['skin', 'parts', 'eyes', 'membranes'] as const)
                  .filter((k) => maps[k])
                  .map((k) => {
                    const m = maps[k] as TexturedMesh;
                    return [
                      k,
                      [
                        'albedo',
                        ...(m.normal ? ['normal'] : []),
                        ...(k === 'eyes' ? [] : ['orm']),
                        ...(m.emissive ? ['emissive'] : []),
                      ],
                    ];
                  }),
              ),
            },
          }
        : {}),
      ...(compiled.material.fur
        ? {
            fur: {
              length: compiled.material.fur.length * compiled.scale,
              density: compiled.material.fur.density,
              regions: compiled.material.fur.region,
            },
          }
        : {}),
      ...glowLayers(compiled),
      ...(Object.keys(lods).length > 0 ? { lods } : {}),
      ...options.extras,
    },
  };
  return {
    scene,
    animations,
    notes: maps
      ? texturedNotes(compiled, maps, colors.skin.glow ?? 0)
      : exportNotes(compiled, colors.skin.glow ?? 0),
  };
}

/** Layers that pulse (a `pulse` parameter above 0, in Hz), for a game that animates the glow. */
function glowLayers(compiled: CompiledCreature): { glow?: { layer: string; pulse: number }[] } {
  const glow = compiled.material.layers
    .map((l) => ({ layer: l.id, pulse: (l.params as { pulse?: unknown }).pulse }))
    .filter(
      (l): l is { layer: string; pulse: number } => typeof l.pulse === 'number' && l.pulse > 0,
    );
  return glow.length > 0 ? { glow } : {};
}

/**
 * What a textured export leaves out or approximates (docs/design/11.1-textures.md, the max-step
 * table), and any mesh the bake could not map.
 */
function texturedNotes(compiled: CompiledCreature, maps: BakedTextures, glow: number): string[] {
  const notes: string[] = [];
  if (compiled.material.fur)
    notes.push(
      "fur is left out (glTF has no shells): the skin's maps carry the coat's colour, and extras.fur describes it for an engine's own fur",
    );
  if (glow > 0 && glowLayers(compiled).glow)
    notes.push(
      "glow is baked as it is at time 0; its pulse is live-only (extras.glow gives each layer's pulses a second)",
    );
  if (MATERIAL_LOOK[compiled.material.material].wrap > 0 || compiled.material.fur)
    notes.push(
      'the light wrapping round the skin is live-only: engines show a harder edge between light and shadow',
    );
  if (compiled.membranes.indices.length > 0)
    notes.push(
      'membranes are double-sided; the light through them is baked into their emissive map',
    );
  notes.push(...maps.notes);
  return notes;
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
