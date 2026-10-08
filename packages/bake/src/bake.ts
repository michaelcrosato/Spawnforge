import type {
  BakedMap,
  BakedTextures,
  CompiledCreature,
  MeshData,
  Registry,
  TexturedMesh,
} from '@spawnforge/core';
import { furEyes } from '@spawnforge/core';
import { dilate } from './dilate.ts';
import { normalMap } from './normal.ts';
import { occlusion } from './occlusion.ts';
import { type Coverage, rasterize } from './raster.ts';
import { type BandJob, type BandMesh, type BandResult, type MeshKind, shadeBand } from './shade.ts';
import { tangents } from './tangents.ts';
import { unwrap } from './xatlas.ts';

// The clock for stage timings, in browsers, workers and Node alike (no DOM or Node types here).
declare const performance: { now(): number };

/**
 * Texture maps for an export (docs/design/11.1-textures.md): each mesh unwrapped into its own
 * atlas, the live material baked into it texel by texel, as plain data an exporter writes.
 */
export interface BakeOptions {
  /** The skin's map size; parts and membranes get half, eyes a quarter (at most 256). Default by quality: 512, 1024, 2048. */
  readonly size?: number;
  /** Shades bands of texels, e.g. on workers; by default in this thread with `registry`. */
  readonly run?: (jobs: readonly BandJob[]) => Promise<readonly BandResult[]>;
  /** How many bands each mesh's texels are split into (default 4). */
  readonly bands?: number;
}

const SIZES = { low: 512, medium: 1024, high: 2048 } as const;

/** Map sizes for a skin map of `size`. */
export function mapSizes(size: number): Record<MeshKind, number> {
  return {
    skin: size,
    parts: Math.max(64, size / 2),
    membranes: Math.max(64, size / 2),
    eyes: Math.min(256, Math.max(64, size / 4)),
  };
}

/**
 * Bakes every mesh of a compiled creature (compile it with `field: true` for occlusion). A mesh
 * that cannot be unwrapped is left out, with a note: the export keeps its vertex colours.
 */
export async function bakeTextures(
  compiled: CompiledCreature,
  registry: Registry,
  options: BakeOptions = {},
): Promise<BakedTextures> {
  const size = options.size ?? SIZES[compiled.quality];
  const sizes = mapSizes(size);
  const run =
    options.run ?? (async (jobs: readonly BandJob[]) => jobs.map((j) => shadeBand(j, registry)));
  const notes: string[] = [];
  if (!compiled.field)
    notes.push('no distance field (compile with field: true), so the maps have no occlusion');
  const eyes = compiled.material.fur ? furEyes(compiled) : [];
  const out: Partial<Record<MeshKind, TexturedMesh>> = {};
  const timings: Record<string, number> = {};
  for (const kind of ['skin', 'parts', 'eyes', 'membranes'] as const) {
    if (compiled[kind].indices.length === 0) continue;
    try {
      out[kind] = await bakeMesh(
        compiled,
        kind,
        sizes[kind],
        eyes,
        run,
        options.bands ?? 4,
        timings,
      );
    } catch (error) {
      notes.push(`${kind} keeps vertex colours: ${(error as Error).message}`);
    }
  }
  return { size, ...out, notes, timings };
}

/** The per-kind vertex attributes the texels interpolate. */
function attributesOf(
  compiled: CompiledCreature,
  kind: MeshKind,
): Record<string, [Float32Array, number]> {
  switch (kind) {
    case 'skin':
      return { body: [compiled.skin.body, 4], region: [compiled.skin.region, 4] };
    case 'parts':
      return { color: [compiled.parts.color, 3], info: [compiled.parts.info, 2] };
    case 'eyes':
      return {
        eye: [compiled.eyes.eye, 4],
        iris: [compiled.eyes.iris, 4],
        sclera: [compiled.eyes.sclera, 3],
      };
    case 'membranes':
      return {
        color: [compiled.membranes.color, 3],
        info: [compiled.membranes.info, 4],
        vein: [compiled.membranes.vein, 2],
      };
  }
}

/** Copies every attribute through `remap` (new vertex → old vertex). */
function remapArray<T extends Float32Array | Uint16Array>(
  array: T,
  size: number,
  remap: Uint32Array,
): T {
  const out = new (array.constructor as new (n: number) => T)(remap.length * size);
  for (let i = 0; i < remap.length; i++) {
    const from = (remap[i] as number) * size;
    for (let k = 0; k < size; k++) out[i * size + k] = array[from + k] as number;
  }
  return out;
}

async function bakeMesh(
  compiled: CompiledCreature,
  kind: MeshKind,
  size: number,
  eyes: BandMesh['eyes'],
  run: (jobs: readonly BandJob[]) => Promise<readonly BandResult[]>,
  bands: number,
  timings: Record<string, number>,
): Promise<TexturedMesh> {
  let last = performance.now();
  const lap = (stage: string) => {
    const now = performance.now();
    timings[stage] = (timings[stage] ?? 0) + now - last;
    last = now;
  };
  const mesh: MeshData = compiled[kind];
  // 1. The atlas, the head at twice the texel density (decision 2).
  const atlas = await unwrap(
    {
      positions: kind === 'skin' ? headWarp(compiled) : mesh.positions,
      normals: mesh.normals,
      indices: mesh.indices,
    },
    size,
    Math.max(2, Math.round(size / 256)),
  );
  lap('atlas');
  let remap = atlas.remap;
  let indices = atlas.indices;
  let uvs = atlas.uvs;
  let positions = remapArray(mesh.positions, 3, remap);
  let normals = remapArray(mesh.normals, 3, remap);
  // 2. Tangents where there is relief, splitting vertices whose corners disagree.
  let tangentData: Float32Array | undefined;
  if (kind === 'skin') {
    const t = await tangents(positions, normals, uvs, indices);
    remap = Uint32Array.from(t.remap, (v) => remap[v] as number);
    uvs = remapArray(uvs, 2, t.remap);
    positions = remapArray(positions, 3, t.remap);
    normals = remapArray(normals, 3, t.remap);
    indices = t.indices;
    tangentData = t.tangents;
  }
  lap('tangents');
  const extra = attributesOf(compiled, kind);
  const attributes: Record<string, Float32Array> = {};
  for (const [name, [array, n]] of Object.entries(extra))
    attributes[name] = remapArray(array, n, remap);

  // 3. Which texels each triangle covers, and each triangle's texel size in metres.
  const coverage = rasterize(uvs, indices, size);
  const texel = texelSizes(positions, uvs, indices, size);
  lap('raster');
  const bandMesh: BandMesh = {
    kind,
    positions,
    normals,
    indices,
    attributes,
    texel,
    scale: compiled.scale,
    material: compiled.material,
    front: compiled.bounds.max[2],
    back: compiled.bounds.min[2],
    eyes,
    coat: true,
  };
  const veinRate =
    kind === 'membranes'
      ? veinRates(attributes.vein as Float32Array, uvs, indices, size)
      : undefined;

  // 4. Shade the texels in bands.
  const texels = coverage.texels;
  const per = Math.ceil(texels.length / bands);
  const jobs: BandJob[] = [];
  for (let b = 0; b < bands; b++) {
    const slice = texels.subarray(b * per, Math.min(texels.length, (b + 1) * per));
    if (slice.length === 0) continue;
    const triangle = new Int32Array(slice.length);
    const weights = new Float32Array(slice.length * 2);
    slice.forEach((k, i) => {
      triangle[i] = coverage.triangle[k] as number;
      weights[i * 2] = coverage.weights[k * 2] as number;
      weights[i * 2 + 1] = coverage.weights[k * 2 + 1] as number;
    });
    jobs.push({ mesh: bandMesh, triangle, weights, ...(veinRate ? { veinRate } : {}) });
  }
  const results = await run(jobs);

  lap('shade');
  // 5. Gather the bands into float images.
  const n = size * size;
  const color = new Float32Array(n * 4);
  const rough = new Float32Array(n);
  const height = new Float32Array(n).fill(Number.NaN);
  const glow = new Float32Array(n * 3);
  let at = 0;
  for (const r of results)
    for (let i = 0; i < r.roughness.length; i++, at++) {
      const k = texels[at] as number;
      color.set(r.color.subarray(i * 4, i * 4 + 4), k * 4);
      rough[k] = r.roughness[i] as number;
      height[k] = r.height[i] as number;
      glow.set(r.glow.subarray(i * 3, i * 3 + 3), k * 3);
    }

  // 6. Occlusion per vertex, interpolated per texel (skin and parts).
  const occ = new Float32Array(n).fill(1);
  if (compiled.field && (kind === 'skin' || kind === 'parts')) {
    // On the mesh's own vertices, before the atlas split them, then copied to the splits.
    const body = kind === 'skin' ? compiled.skin.body : undefined;
    const shared = occlusion(
      compiled.field,
      compiled.scale,
      mesh.positions,
      mesh.normals,
      body ? (v) => (body[v * 4 + 2] as number) <= -1 : undefined,
    );
    const perVertex = Float32Array.from(remap, (v) => shared[v] as number);
    for (const k of texels) {
      const t = coverage.triangle[k] as number;
      const w1 = coverage.weights[k * 2] as number;
      const w2 = coverage.weights[k * 2 + 1] as number;
      occ[k] =
        (perVertex[indices[t * 3] as number] as number) * (1 - w1 - w2) +
        (perVertex[indices[t * 3 + 1] as number] as number) * w1 +
        (perVertex[indices[t * 3 + 2] as number] as number) * w2;
    }
  }

  lap('occlusion');
  // 7. The normal map (skin).
  const normal = tangentData
    ? normalMap({
        coverage,
        height,
        positions,
        normals,
        uvs,
        indices,
        tangents: tangentData,
        texel,
      })
    : undefined;

  lap('normal');
  // 8. Gutters, then 8-bit images.
  const reach = Math.max(8, Math.round(size / 64));
  const orm = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    orm[k * 3] = occ[k] as number;
    orm[k * 3 + 1] = rough[k] as number;
  }
  let glowMax = 0;
  for (const v of glow) glowMax = Math.max(glowMax, v);
  const filled = new Uint8Array(n);
  for (const k of texels) filled[k] = 1;
  dilate(
    [
      { data: color, channels: 4 },
      { data: orm, channels: 3 },
      ...(glowMax > 0 ? [{ data: glow, channels: 3 }] : []),
      ...(normal ? [{ data: normal, channels: 3 }] : []),
    ],
    size,
    filled,
    reach,
  );
  if (normal) {
    for (let k = 0; k < n; k++) {
      const l = Math.hypot(
        normal[k * 3] as number,
        normal[k * 3 + 1] as number,
        normal[k * 3 + 2] as number,
      );
      if (l > 0) for (let c = 0; c < 3; c++) normal[k * 3 + c] = (normal[k * 3 + c] as number) / l;
      else normal[k * 3 + 2] = 1;
    }
  }
  lap('gutters');
  let seeThrough = false;
  if (kind === 'membranes')
    for (const k of texels) if ((color[k * 4 + 3] as number) < 0.999) seeThrough = true;
  const albedo = encode(size, true, (k, rgba) => {
    for (let c = 0; c < 3; c++) rgba[c] = linearToSrgb(color[k * 4 + c] as number);
    rgba[3] = seeThrough ? (color[k * 4 + 3] as number) : 1;
  });
  const result: TexturedMesh = {
    positions,
    normals,
    indices,
    skinIndex: remapArray(mesh.skinIndex, 4, remap),
    skinWeight: remapArray(mesh.skinWeight, 4, remap),
    uvs,
    ...(tangentData ? { tangents: tangentData } : {}),
    albedo,
    ...(normal
      ? {
          normal: encode(size, false, (k, rgba) => {
            for (let c = 0; c < 3; c++) rgba[c] = (normal[k * 3 + c] as number) * 0.5 + 0.5;
            rgba[3] = 1;
          }),
        }
      : {}),
    orm: encode(size, false, (k, rgba) => {
      rgba[0] = orm[k * 3] as number;
      rgba[1] = orm[k * 3 + 1] as number;
      rgba[2] = 0;
      rgba[3] = 1;
    }),
    ...(glowMax > 0
      ? {
          emissive: encode(size, true, (k, rgba) => {
            for (let c = 0; c < 3; c++)
              rgba[c] = linearToSrgb((glow[k * 3 + c] as number) / glowMax);
            rgba[3] = 1;
          }),
          emissiveStrength: glowMax,
        }
      : {}),
    ...(seeThrough ? { blend: true } : {}),
    texel: median(texel),
  };
  lap('encode');
  return result;
}

/** An RGBA8 image from a function giving each texel's four channels, 0 to 1. */
function encode(size: number, srgb: boolean, texel: (k: number, rgba: number[]) => void): BakedMap {
  const data = new Uint8Array(size * size * 4);
  const rgba = [0, 0, 0, 0];
  for (let k = 0; k < size * size; k++) {
    texel(k, rgba);
    for (let c = 0; c < 4; c++)
      data[k * 4 + c] = Math.round(Math.min(1, Math.max(0, rgba[c] as number)) * 255);
  }
  return { size, data, srgb };
}

function linearToSrgb(c: number): number {
  const x = Math.min(1, Math.max(0, c));
  return x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055;
}

/**
 * Skin positions as xatlas should see them: the head scaled up to twice about the nearest head
 * bone by its region weight, so its charts get twice the texels (decision 2).
 */
function headWarp(compiled: CompiledCreature): Float32Array {
  const { positions, region } = compiled.skin;
  const heads = compiled.rig.heads.map((h) => [
    compiled.bones.positions[h.head * 3] as number,
    compiled.bones.positions[h.head * 3 + 1] as number,
    compiled.bones.positions[h.head * 3 + 2] as number,
  ]);
  const out = new Float32Array(positions);
  const n = positions.length / 3;
  for (let v = 0; v < n; v++) {
    const w = region[v * 4] as number;
    if (w <= 0 || heads.length === 0) continue;
    let best = heads[0] as number[];
    let bestD = Infinity;
    for (const h of heads) {
      const d = Math.hypot(
        (positions[v * 3] as number) - (h[0] as number),
        (positions[v * 3 + 1] as number) - (h[1] as number),
        (positions[v * 3 + 2] as number) - (h[2] as number),
      );
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    for (let c = 0; c < 3; c++)
      out[v * 3 + c] =
        (best[c] as number) + ((positions[v * 3 + c] as number) - (best[c] as number)) * (1 + w);
  }
  return out;
}

/** Each triangle's texel size in metres: the square root of its world area per texel. */
function texelSizes(
  positions: Float32Array,
  uvs: Float32Array,
  indices: Uint32Array,
  size: number,
): Float32Array {
  const count = indices.length / 3;
  const out = new Float32Array(count);
  for (let t = 0; t < count; t++) {
    const a = indices[t * 3] as number;
    const b = indices[t * 3 + 1] as number;
    const c = indices[t * 3 + 2] as number;
    const e1 = [0, 1, 2].map(
      (k) => (positions[b * 3 + k] as number) - (positions[a * 3 + k] as number),
    );
    const e2 = [0, 1, 2].map(
      (k) => (positions[c * 3 + k] as number) - (positions[a * 3 + k] as number),
    );
    const cx = (e1[1] as number) * (e2[2] as number) - (e1[2] as number) * (e2[1] as number);
    const cy = (e1[2] as number) * (e2[0] as number) - (e1[0] as number) * (e2[2] as number);
    const cz = (e1[0] as number) * (e2[1] as number) - (e1[1] as number) * (e2[0] as number);
    const world = Math.hypot(cx, cy, cz) / 2;
    const du1 = ((uvs[b * 2] as number) - (uvs[a * 2] as number)) * size;
    const dv1 = ((uvs[b * 2 + 1] as number) - (uvs[a * 2 + 1] as number)) * size;
    const du2 = ((uvs[c * 2] as number) - (uvs[a * 2] as number)) * size;
    const dv2 = ((uvs[c * 2 + 1] as number) - (uvs[a * 2 + 1] as number)) * size;
    const texels = Math.abs(du1 * dv2 - du2 * dv1) / 2;
    out[t] = texels > 1e-12 ? Math.sqrt(world / texels) : 0;
  }
  return out;
}

/** Per triangle, how fast the membrane's `vein` coordinates change per texel (|∂/∂u| + |∂/∂v|). */
function veinRates(
  vein: Float32Array,
  uvs: Float32Array,
  indices: Uint32Array,
  size: number,
): Float32Array {
  const count = indices.length / 3;
  const out = new Float32Array(count * 2);
  for (let t = 0; t < count; t++) {
    const a = indices[t * 3] as number;
    const b = indices[t * 3 + 1] as number;
    const c = indices[t * 3 + 2] as number;
    const du1 = ((uvs[b * 2] as number) - (uvs[a * 2] as number)) * size;
    const dv1 = ((uvs[b * 2 + 1] as number) - (uvs[a * 2 + 1] as number)) * size;
    const du2 = ((uvs[c * 2] as number) - (uvs[a * 2] as number)) * size;
    const dv2 = ((uvs[c * 2 + 1] as number) - (uvs[a * 2 + 1] as number)) * size;
    const det = du1 * dv2 - du2 * dv1;
    if (Math.abs(det) < 1e-12) continue;
    for (let k = 0; k < 2; k++) {
      const e1 = (vein[b * 2 + k] as number) - (vein[a * 2 + k] as number);
      const e2 = (vein[c * 2 + k] as number) - (vein[a * 2 + k] as number);
      const gu = (e1 * dv2 - e2 * dv1) / det;
      const gv = (e2 * du1 - e1 * du2) / det;
      out[t * 2 + k] = Math.abs(gu) + Math.abs(gv);
    }
  }
  return out;
}

export type { Coverage };

function median(values: Float32Array): number {
  const sorted = Float32Array.from(values.filter((v) => v > 0)).sort();
  return (sorted[Math.floor(sorted.length / 2)] as number | undefined) ?? 0;
}
