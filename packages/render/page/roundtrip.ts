import {
  applyRest,
  type BakedMap,
  type BakedTextures,
  type CompiledCreature,
  mainHead,
  Pose,
  type Registry,
  type TexturedMesh,
} from '@spawnforge/core';
import { applyPose, createCreatureObject, exportName, type SkinLook } from '@spawnforge/three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { WebGPURenderer } from 'three/webgpu';
import type {
  ExportInfo,
  ExportRequest,
  Mutation,
  RoundTripRequest,
  RoundTripResponse,
  RoundTripView,
  View,
} from '../src/protocol.ts';

/**
 * The round trip (docs/design/11.1-textures.md, decision 13): the exported `.glb` loaded back
 * with GLTFLoader and drawn beside the live creature with the export's simplifications, from the
 * same cameras and pose, compared silhouette first, then shading within it.
 */
export interface RoundTripDeps {
  readonly renderer: WebGPURenderer;
  readonly registry: Registry;
  readonly buildGlb: (
    request: ExportRequest,
    mutate?: (maps: BakedTextures) => BakedTextures,
  ) => Promise<{
    bytes: Uint8Array;
    info: ExportInfo;
    compiled: CompiledCreature;
    maps?: BakedTextures;
  }>;
  readonly viewCamera: (
    view: View,
    frame: {
      centre: THREE.Vector3;
      extent: THREE.Vector3;
      span: number;
      min: THREE.Vector3;
      max: THREE.Vector3;
    },
    head: { headCentre: THREE.Vector3; headSize: number },
  ) => { camera: THREE.Camera; half: number };
}

/** One comparison: a view, a pose and what the probes switch off. */
interface Shot {
  readonly name: string;
  readonly view: View;
  readonly jaw?: number;
  readonly spread?: number;
  /** A grazing key light, low and from the side, for the probes. */
  readonly grazing?: boolean;
}

const SHOTS: readonly Shot[] = [
  { name: 'three-quarter', view: 'three-quarter' },
  { name: 'side', view: 'side' },
  { name: 'head', view: 'head' },
  { name: 'front', view: 'front' },
  { name: 'top', view: 'top' },
  { name: 'rear', view: 'rear' },
  { name: 'jaw', view: 'head', jaw: 0.8 },
];

export async function roundTrip(
  deps: RoundTripDeps,
  request: RoundTripRequest,
): Promise<RoundTripResponse> {
  const { renderer, registry } = deps;
  const size = request.size ?? 2048;
  const mutate = request.mutate ? mutation(request.mutate) : undefined;
  const { bytes, info, compiled, maps } = await deps.buildGlb(
    {
      blueprint: request.blueprint,
      ...(request.quality ? { quality: request.quality } : {}),
      ...(request.textures !== undefined ? { textures: request.textures } : {}),
      clips: ['idle'],
    },
    mutate,
  );
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer as ArrayBuffer, '');
  const loaded = gltf.scene;
  // Index the loaded bones by the names the exporter gave them.
  const byName = new Map<string, THREE.Object3D>();
  loaded.traverse((o) => byName.set(o.name, o));
  const loadedBones = compiled.bones.names.map((n) => byName.get(exportName(n)));
  const loadedMeshes: THREE.Mesh[] = [];
  loaded.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) loadedMeshes.push(o as THREE.Mesh);
  });
  for (const mesh of loadedMeshes) {
    // As the live meshes do, so shadows and blending match (decision 13).
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
      m.aoMapIntensity = 0;
      if (m.transparent) {
        m.depthWrite = true;
        m.forceSinglePass = true;
      }
    }
  }
  const texel = maps?.skin?.texel ?? 0;
  const look: SkinLook = {
    coat: true,
    noWrap: true,
    ...(texel > 0 ? { pixel: texel / compiled.scale } : {}),
  };
  const live = createCreatureObject(compiled, registry, { look });

  const shots = [...SHOTS];
  if (compiled.rig.wings.length > 0)
    shots.push({ name: 'spread', view: 'three-quarter', spread: 1 });
  const frame = framing(compiled);
  const views: RoundTripView[] = [];
  const bare: RoundTripView[] = [];
  for (const shot of shots) {
    const pose = new Pose(compiled.bones);
    applyRest(pose, compiled.rig, { jaw: shot.jaw ?? 0, spread: shot.spread ?? 0 });
    applyPose(live, pose);
    live.signals.breath.value = 0;
    live.signals.time.value = 0;
    loadedBones.forEach((bone, i) => {
      const rot = pose.rot[i];
      const pos = pose.pos[i];
      if (!bone || !rot || !pos) return;
      bone.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      bone.position.set(pos.x, pos.y, pos.z);
    });
    const spread = (shot.spread ?? 0) > 0 && compiled.spreadBounds;
    const f = spread ? framing(compiled, true) : frame;
    const { camera, half } = deps.viewCamera(shot.view, f, f);
    // About one pixel a texel, so neither side aliases nor magnifies (the head has twice the
    // texel density); `size` caps it. Long creatures are drawn in tiles.
    const density = shot.view === 'head' ? texel / 2 : texel;
    const px = density > 0 ? Math.max(96, Math.min(size, Math.round((2 * half) / density))) : size;
    const withTangents = tally();
    const without = tally();
    const whole = request.images ? { a: blank(px), b: blank(px) } : undefined;
    for (const tile of tilesOf(camera, f, px)) {
      const a = await shoot(renderer, live.object, camera, f, px, shot, tile);
      const b = await shoot(renderer, loaded, camera, f, px, shot, tile);
      add(withTangents, a, b);
      if (whole) {
        paste(whole.a, a, tile);
        paste(whole.b, b, tile);
      }
      // Again with the tangents taken out: three then builds the frame from UV derivatives, as
      // glTF defines it, flipping green as GLTFLoader does for a file without tangents.
      if (request.withoutTangents !== false) {
        const restore = stripTangents(loadedMeshes);
        const c = await shoot(renderer, loaded, camera, f, px, shot, tile);
        restore();
        add(without, a, c);
      }
    }
    views.push({
      ...result(shot.name, withTangents),
      ...(whole ? { images: [png(whole.a), png(whole.b)] as const } : {}),
      px,
      ...(density > 0 ? { perTexel: Number(((px * density) / (2 * half)).toFixed(2)) } : {}),
    });
    if (request.withoutTangents !== false) bare.push(result(shot.name, without));
  }
  // The probe: one effect's own contribution on each side, under a grazing key light.
  let probe: RoundTripResponse['probe'];
  if (request.probe) {
    const effect = request.probe;
    const off: SkinLook =
      effect === 'relief'
        ? { ...look, noRelief: true }
        : effect === 'glow'
          ? { ...look, noGlow: true }
          : { ...look, roughness: 0.6 };
    const liveOff = createCreatureObject(compiled, registry, { look: off });
    const skin = loadedMeshes.find((m) => m.name === 'skin');
    const results: { view: string; correlation: number; ratio: number }[] = [];
    // Four pixels a texel calm the live bump's 2×2 derivatives, which alias at one.
    for (const [view, perTexel] of [
      ['three-quarter', 4],
      ['side', 4],
      ['head', 4],
      ['close', 6],
    ] as const) {
      const pose = new Pose(compiled.bones);
      applyRest(pose, compiled.rig, {});
      applyPose(live, pose);
      applyPose(liveOff, pose);
      for (const o of [live, liveOff]) {
        o.signals.breath.value = 0;
        o.signals.time.value = 0;
      }
      loadedBones.forEach((bone, i) => {
        const rot = pose.rot[i];
        const pos = pose.pos[i];
        if (!bone || !rot || !pos) return;
        bone.quaternion.set(rot.x, rot.y, rot.z, rot.w);
        bone.position.set(pos.x, pos.y, pos.z);
      });
      const close = view === 'close';
      const near = close ? { ...frame, headSize: frame.headSize * 0.35 } : frame;
      const { camera, half } = deps.viewCamera(close ? 'head' : view, near, near);
      const density = view === 'head' || close ? texel / 2 : texel;
      const px =
        density > 0
          ? Math.max(96, Math.min(1024, Math.round((perTexel * 2 * half) / density)))
          : size;
      const shot: Shot = { name: view, view: close ? 'head' : view, grazing: true };
      const all = { x: 0, y: 0, w: px, h: px };
      const l1 = await shoot(renderer, live.object, camera, frame, px, shot, all);
      const l0 = await shoot(renderer, liveOff.object, camera, frame, px, shot, all);
      const g1 = await shoot(renderer, loaded, camera, frame, px, shot, all);
      const restore = skin ? switchOff(skin, effect) : () => {};
      const g0 = await shoot(renderer, loaded, camera, frame, px, shot, all);
      restore();
      results.push({ view, ...contribution(l1, l0, g1, g0) });
    }
    liveOff.dispose();
    probe = { effect, views: results };
  }
  live.dispose();
  // The loaded file's meshes and maps, which the GPU (SwiftShader: this process) holds.
  loaded.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of [mesh.material].flat() as THREE.MeshPhysicalMaterial[]) {
      for (const t of [
        m.map,
        m.normalMap,
        m.aoMap,
        m.roughnessMap,
        m.metalnessMap,
        m.emissiveMap,
        m.clearcoatNormalMap,
      ])
        t?.dispose();
      m.dispose();
    }
  });
  return {
    bytes: bytes.length,
    exportMs: info.exportMs,
    ...(info.textures ? { textures: info.textures } : {}),
    views,
    ...(bare.length > 0 ? { withoutTangents: bare } : {}),
    ...(probe ? { probe } : {}),
  };
}

/** Takes one effect's map out of the loaded skin; returns the undo. */
function switchOff(mesh: THREE.Mesh, effect: 'relief' | 'roughness' | 'glow'): () => void {
  const m = mesh.material as THREE.MeshPhysicalMaterial;
  const saved = {
    normalMap: m.normalMap,
    clearcoatNormalMap: m.clearcoatNormalMap ?? null,
    roughnessMap: m.roughnessMap,
    roughness: m.roughness,
    emissiveMap: m.emissiveMap,
    emissive: m.emissive.clone(),
  };
  if (effect === 'relief') {
    m.normalMap = null;
    if ('clearcoatNormalMap' in m) m.clearcoatNormalMap = null;
  } else if (effect === 'roughness') {
    m.roughnessMap = null;
    m.roughness = 0.6;
  } else {
    m.emissiveMap = null;
    m.emissive.setRGB(0, 0, 0);
  }
  m.needsUpdate = true;
  return () => {
    m.normalMap = saved.normalMap;
    if ('clearcoatNormalMap' in m) m.clearcoatNormalMap = saved.clearcoatNormalMap;
    m.roughnessMap = saved.roughnessMap;
    m.roughness = saved.roughness;
    m.emissiveMap = saved.emissiveMap;
    m.emissive.copy(saved.emissive);
    m.needsUpdate = true;
  };
}

/**
 * How alike an effect's contribution is on the two sides: the correlation of (with − without)
 * per pixel, in luminance, over the shared silhouette, and the loaded side's size of it over the
 * live side's (1 is equal).
 */
function contribution(
  l1: Image,
  l0: Image,
  g1: Image,
  g0: Image,
): { correlation: number; ratio: number } {
  const lum = (c: Float32Array, p: number) =>
    (0.2126 * (c[p * 3] as number) +
      0.7152 * (c[p * 3 + 1] as number) +
      0.0722 * (c[p * 3 + 2] as number)) /
    255;
  const [s1, s0, t1, t0] = [l1, l0, g1, g0].map(soften) as [
    Float32Array,
    Float32Array,
    Float32Array,
    Float32Array,
  ];
  const a: number[] = [];
  const b: number[] = [];
  for (let p = 0; p < l1.w * l1.h; p++) {
    if ((l1.mask[p * 4] as number) <= 127 || (g1.mask[p * 4] as number) <= 127) continue;
    a.push(lum(s1, p) - lum(s0, p));
    b.push(lum(t1, p) - lum(t0, p));
  }
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / Math.max(1, x.length);
  const ma = mean(a);
  const mb = mean(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i++) {
    const da = (a[i] as number) - ma;
    const db = (b[i] as number) - mb;
    sab += da * db;
    saa += da * da;
    sbb += db * db;
  }
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return {
    correlation: saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0,
    ratio: na > 0 ? nb / na : 0,
  };
}

interface Frame {
  centre: THREE.Vector3;
  extent: THREE.Vector3;
  span: number;
  min: THREE.Vector3;
  max: THREE.Vector3;
  headCentre: THREE.Vector3;
  headSize: number;
}

function framing(compiled: CompiledCreature, spread = false): Frame {
  const bounds = spread && compiled.spreadBounds ? compiled.spreadBounds : compiled.bounds;
  const min = new THREE.Vector3(...bounds.min);
  const max = new THREE.Vector3(...bounds.max);
  const centre = min.clone().add(max).multiplyScalar(0.5);
  const extent = max.clone().sub(min);
  const span = Math.max(extent.x, extent.y, extent.z);
  const main = mainHead(compiled.rig);
  const headBones = new Set([main.head, main.jaw, ...main.eyes]);
  const box = new THREE.Box3();
  for (const mesh of [compiled.skin, compiled.parts, compiled.eyes])
    for (let v = 0; v < mesh.positions.length / 3; v++) {
      let w = 0;
      for (let k = v * 4; k < v * 4 + 4; k++)
        if (headBones.has(mesh.skinIndex[k] as number)) w += mesh.skinWeight[k] as number;
      if (w >= 0.5) box.expandByPoint(new THREE.Vector3().fromArray(mesh.positions, v * 3));
    }
  if (box.isEmpty()) box.setFromCenterAndSize(centre, extent);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  return { centre, extent, span, min, max, headCentre: sphere.center, headSize: sphere.radius };
}

/** A rectangle of a view `px` pixels square, in pixels from its top left. */
interface Tile {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Pixels, RGBA, of one tile or a whole view. */
interface Image {
  readonly colour: Uint8ClampedArray;
  readonly mask: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

/** The largest tile drawn at once. */
const TILE = 1024;
const BACKGROUND = '#262a30';

/**
 * The tiles of a view `px` pixels square that the creature can reach: those meeting its bounds
 * projected into the view, with a margin. Views up to `TILE` are one tile.
 */
function tilesOf(camera: THREE.Camera, f: Frame, px: number): Tile[] {
  const all: Tile[] = [];
  for (let y = 0; y < px; y += TILE)
    for (let x = 0; x < px; x += TILE)
      all.push({ x, y, w: Math.min(TILE, px - x), h: Math.min(TILE, px - y) });
  if (all.length === 1) return all;
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  const corner = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? f.max.x : f.min.x, i & 2 ? f.max.y : f.min.y, i & 4 ? f.max.z : f.min.z);
    // A corner behind a perspective camera projects nowhere useful: draw every tile.
    if (corner.clone().applyMatrix4(camera.matrixWorldInverse).z >= 0) return all;
    corner.project(camera);
    x0 = Math.min(x0, ((corner.x + 1) / 2) * px);
    x1 = Math.max(x1, ((corner.x + 1) / 2) * px);
    y0 = Math.min(y0, ((1 - corner.y) / 2) * px);
    y1 = Math.max(y1, ((1 - corner.y) / 2) * px);
  }
  const margin = 0.05 * px;
  return all.filter(
    (t) =>
      t.x < x1 + margin && t.x + t.w > x0 - margin && t.y < y1 + margin && t.y + t.h > y0 - margin,
  );
}

const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });

/** Renders a creature in the contact sheet's light, then its silhouette, over one tile. */
async function shoot(
  renderer: WebGPURenderer,
  creature: THREE.Object3D,
  camera: THREE.Camera,
  f: Frame,
  px: number,
  shot: Shot,
  tile: Tile,
): Promise<Image> {
  const lens = camera as THREE.PerspectiveCamera | THREE.OrthographicCamera;
  const part = tile.w < px || tile.h < px;
  if (part) {
    lens.setViewOffset(px, px, tile.x, tile.y, tile.w, tile.h);
    lens.updateProjectionMatrix();
  }
  try {
    return await draw(renderer, creature, camera, f, tile.w, tile.h, shot);
  } finally {
    if (part) {
      lens.clearViewOffset();
      lens.updateProjectionMatrix();
    }
  }
}

async function draw(
  renderer: WebGPURenderer,
  creature: THREE.Object3D,
  camera: THREE.Camera,
  f: Frame,
  w: number,
  h: number,
  shot: Shot,
): Promise<Image> {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  scene.add(new THREE.HemisphereLight('#e8eeff', '#4a4034', 1.15));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  const rim = new THREE.DirectionalLight('#b8c8ff', 1.1);
  const span = f.span;
  key.position
    .copy(f.centre)
    .add(
      shot.grazing
        ? new THREE.Vector3(span * 2.5, span * 0.25, span * 0.4)
        : new THREE.Vector3(span * 1.2, span * 2.2, span * 1.6),
    );
  key.target.position.copy(f.centre);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -span;
  sc.right = sc.top = span;
  sc.near = 0.01;
  sc.far = span * 8;
  rim.position.copy(f.centre).add(new THREE.Vector3(-span * 1.5, span * 0.8, -span * 1.8));
  rim.target.position.copy(f.centre);
  scene.add(key, key.target, rim, rim.target);
  const parent = creature.parent;
  scene.add(creature);
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  await renderer.renderAsync(scene, camera);
  const colour = read(renderer, w, h);
  // The silhouette: everything white, unlit, on black.
  scene.background = new THREE.Color('#000000');
  scene.overrideMaterial = white;
  renderer.shadowMap.enabled = false;
  await renderer.renderAsync(scene, camera);
  const mask = read(renderer, w, h);
  scene.overrideMaterial = null;
  renderer.shadowMap.enabled = true;
  scene.remove(creature);
  if (parent) parent.add(creature);
  // Each shot's lights are new: free the key's shadow map, or a long run fills the memory.
  key.dispose();
  rim.dispose();
  return { colour, mask, w, h };
}

const scratch = document.createElement('canvas');

function read(renderer: WebGPURenderer, w: number, h: number): Uint8ClampedArray {
  scratch.width = w;
  scratch.height = h;
  const ctx = scratch.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(renderer.domElement, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

/** Running sums of a comparison over a view's tiles. */
interface Tally {
  inter: number;
  union: number;
  sum: number;
  off: number;
}
const tally = (): Tally => ({ inter: 0, union: 0, sum: 0, off: 0 });

/**
 * Adds a tile: silhouette overlap (intersection over union), then within the shared silhouette
 * the absolute difference (0 to 1) and the pixels off by more than 20% in some channel.
 */
function add(t: Tally, a: Image, b: Image): void {
  const ca = soften(a);
  const cb = soften(b);
  for (let p = 0; p < a.w * a.h; p++) {
    const inA = (a.mask[p * 4] as number) > 127;
    const inB = (b.mask[p * 4] as number) > 127;
    if (inA || inB) t.union++;
    if (!(inA && inB)) continue;
    t.inter++;
    let worst = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs((ca[p * 3 + c] as number) - (cb[p * 3 + c] as number)) / 255;
      t.sum += d / 3;
      worst = Math.max(worst, d);
    }
    if (worst > 0.2) t.off++;
  }
}

/**
 * The colours blurred by a 1-2-1 kernel each way: compared at about a texel's bandwidth, since a
 * map holds nothing finer, so the live shader's per-pixel aliasing is not counted against it.
 */
function soften(image: Image): Float32Array {
  const { w, h, colour } = image;
  const across = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const l = y * w + Math.max(0, x - 1);
      const r = y * w + Math.min(w - 1, x + 1);
      const m = y * w + x;
      for (let c = 0; c < 3; c++)
        across[m * 3 + c] =
          ((colour[l * 4 + c] as number) +
            2 * (colour[m * 4 + c] as number) +
            (colour[r * 4 + c] as number)) /
          4;
    }
  const out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = Math.max(0, y - 1) * w + x;
      const d = Math.min(h - 1, y + 1) * w + x;
      const m = y * w + x;
      for (let c = 0; c < 3; c++)
        out[m * 3 + c] =
          ((across[u * 3 + c] as number) +
            2 * (across[m * 3 + c] as number) +
            (across[d * 3 + c] as number)) /
          4;
    }
  return out;
}

function result(name: string, t: Tally): RoundTripView {
  return {
    view: name,
    // Nothing drawn on either side is a failure (a lost context draws nothing), not a match.
    overlap: t.union > 0 ? t.inter / t.union : 0,
    mean: t.inter > 0 ? t.sum / t.inter : 0,
    off: t.inter > 0 ? t.off / t.inter : 0,
  };
}

/** A whole view in the background colour, for pasting tiles into. */
function blank(px: number): Image {
  const colour = new Uint8ClampedArray(px * px * 4);
  const hex = Number.parseInt(BACKGROUND.slice(1), 16);
  const rgba = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255, 255];
  for (let p = 0; p < px * px; p++) colour.set(rgba, p * 4);
  return { colour, mask: new Uint8ClampedArray(px * px * 4), w: px, h: px };
}

function paste(into: Image, tile: Image, at: Tile): void {
  for (let y = 0; y < tile.h; y++) {
    const row = tile.colour.subarray(y * tile.w * 4, (y + 1) * tile.w * 4);
    into.colour.set(row, ((at.y + y) * into.w + at.x) * 4);
  }
}

function png(image: Image): string {
  scratch.width = image.w;
  scratch.height = image.h;
  const ctx = scratch.getContext('2d') as CanvasRenderingContext2D;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(image.colour), image.w, image.h), 0, 0);
  return scratch.toDataURL('image/png');
}

/** Takes the tangents out of the loaded meshes, as if the file had none; returns the undo. */
function stripTangents(meshes: readonly THREE.Mesh[]): () => void {
  const undo: (() => void)[] = [];
  for (const mesh of meshes) {
    const tangent = mesh.geometry.getAttribute('tangent');
    if (!tangent) continue;
    const material = mesh.material as THREE.MeshStandardMaterial;
    mesh.geometry.deleteAttribute('tangent');
    material.normalScale.y = -material.normalScale.y;
    material.needsUpdate = true;
    undo.push(() => {
      mesh.geometry.setAttribute('tangent', tangent);
      material.normalScale.y = -material.normalScale.y;
      material.needsUpdate = true;
    });
  }
  return () => {
    for (const u of undo) u();
  };
}

/** Deliberate mistakes in the bake, for the mutation test: the round trip must catch each. */
function mutation(name: Mutation): (maps: BakedTextures) => BakedTextures {
  const each = (maps: BakedTextures, f: (m: TexturedMesh) => TexturedMesh): BakedTextures => ({
    ...maps,
    ...(maps.skin ? { skin: f(maps.skin) } : {}),
    ...(maps.parts ? { parts: f(maps.parts) } : {}),
    ...(maps.eyes ? { eyes: f(maps.eyes) } : {}),
    ...(maps.membranes ? { membranes: f(maps.membranes) } : {}),
  });
  const pixels = (map: BakedMap, f: (data: Uint8Array, k: number) => void): BakedMap => {
    const data = new Uint8Array(map.data);
    for (let k = 0; k < map.size * map.size; k++) f(data, k * 4);
    return { ...map, data };
  };
  switch (name) {
    case 'green':
      return (maps) =>
        each(maps, (m) =>
          m.normal
            ? {
                ...m,
                normal: pixels(m.normal, (d, k) => {
                  d[k + 1] = 255 - (d[k + 1] as number);
                }),
              }
            : m,
        );
    case 'tangent-sign':
      return (maps) =>
        each(maps, (m) => {
          if (!m.tangents) return m;
          const tangents = new Float32Array(m.tangents);
          for (let i = 3; i < tangents.length; i += 4) tangents[i] = -(tangents[i] as number);
          return { ...m, tangents };
        });
    case 'normal-srgb':
      // The normals written through the sRGB curve, as if they were a colour.
      return (maps) =>
        each(maps, (m) =>
          m.normal
            ? {
                ...m,
                normal: pixels(m.normal, (d, k) => {
                  for (let c = 0; c < 3; c++) {
                    const x = (d[k + c] as number) / 255;
                    const y = x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
                    d[k + c] = Math.round(y * 255);
                  }
                }),
              }
            : m,
        );
    case 'orm-swap':
      return (maps) =>
        each(maps, (m) => ({
          ...m,
          orm: pixels(m.orm, (d, k) => {
            const r = d[k] as number;
            d[k] = d[k + 1] as number;
            d[k + 1] = r;
          }),
        }));
    case 'glow-clip':
      return (maps) =>
        each(maps, (m) =>
          m.emissiveStrength ? { ...m, emissiveStrength: Math.min(1, m.emissiveStrength) } : m,
        );
    case 'v-flip':
      return (maps) =>
        each(maps, (m) => {
          const uvs = new Float32Array(m.uvs);
          for (let i = 1; i < uvs.length; i += 2) uvs[i] = 1 - (uvs[i] as number);
          return { ...m, uvs };
        });
    case 'shift':
      return (maps) =>
        each(maps, (m) => {
          const uvs = new Float32Array(m.uvs);
          for (let i = 0; i < uvs.length; i += 2) uvs[i] = (uvs[i] as number) + 0.5 / m.albedo.size;
          return { ...m, uvs };
        });
  }
}
