import {
  COAT,
  cpuKit,
  EYE_ROUGHNESS,
  eyeColor,
  type FurEye,
  furReach,
  hasWingLayers,
  limbAndWings,
  type Registry,
  type SkinMaterialSpec,
  type Surface,
  shadeMembrane,
  shadeMouth,
  shadeSkin,
  srgbToLinear,
} from '@spawnforge/core';

/**
 * Shading a band of texels (docs/design/11.1-textures.md, decisions 4 and 5): a pure function of
 * plain data, so it can run in this thread or on a worker. Each texel interpolates its
 * triangle's vertex inputs as the GPU interpolates varyings, and runs the live shader's rules.
 */

export type MeshKind = 'skin' | 'parts' | 'eyes' | 'membranes';

/** One mesh's inputs, already split along its atlas's seams. */
export interface BandMesh {
  readonly kind: MeshKind;
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  /** Per-kind attributes by name (`body`, `region`, `color`, `info`, `eye`, `iris`, `sclera`, `vein`). */
  readonly attributes: Readonly<Record<string, Float32Array>>;
  /** Each triangle's texel size in metres. */
  readonly texel: Float32Array;
  readonly scale: number;
  readonly material: SkinMaterialSpec;
  /** Membranes' `spine`: the creature's rest bounds along z (metres), front and back. */
  readonly front: number;
  readonly back: number;
  readonly eyes: readonly FurEye[];
  /** Under fur, the coat's look (decision 16). */
  readonly coat: boolean;
}

export interface BandJob {
  readonly mesh: BandMesh;
  /** Triangle and weights (second and third corner) per texel of the band. */
  readonly triangle: Int32Array;
  readonly weights: Float32Array;
  /** For membranes' veins: per triangle, how fast `vein` (along, across) changes per texel. */
  readonly veinRate?: Float32Array;
}

/** Per texel: linear colour and alpha (4), roughness, relief height in metres, linear glow (3). */
export interface BandResult {
  readonly color: Float32Array;
  readonly roughness: Float32Array;
  readonly height: Float32Array;
  readonly glow: Float32Array;
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Shades every texel of a band. */
export function shadeBand(job: BandJob, registry: Registry): BandResult {
  const n = job.triangle.length;
  const out: BandResult = {
    color: new Float32Array(n * 4),
    roughness: new Float32Array(n),
    height: new Float32Array(n),
    glow: new Float32Array(n * 3),
  };
  const m = job.mesh;
  const lerp = interpolator(m);
  const patterned = m.kind === 'membranes' && hasWingLayers(m.material);
  for (let i = 0; i < n; i++) {
    const t = job.triangle[i] as number;
    lerp.at(t, job.weights[i * 2] as number, job.weights[i * 2 + 1] as number);
    const pixel = (m.texel[t] as number) / m.scale;
    switch (m.kind) {
      case 'skin':
        skinTexel(m, lerp, pixel, registry, out, i);
        break;
      case 'parts': {
        const c = lerp.get('color', 3);
        for (let k = 0; k < 3; k++) out.color[i * 4 + k] = srgbToLinear(c[k] as number);
        out.color[i * 4 + 3] = 1;
        out.roughness[i] = lerp.get('info', 2)[1] as number;
        break;
      }
      case 'eyes': {
        const e = lerp.get('eye', 4);
        const iris = lerp.get('iris', 4);
        const sclera = lerp.get('sclera', 3);
        // The pupil's shape is a code, not a quantity: the nearest corner's.
        const kind = lerp.nearest('eye', 4, 3);
        eyeColor(e[0], e[1], e[2], kind, iris, 0, sclera, 0, out.color, i * 4);
        out.color[i * 4 + 3] = 1;
        out.roughness[i] = EYE_ROUGHNESS;
        break;
      }
      case 'membranes':
        membraneTexel(m, lerp, pixel, patterned, job.veinRate, t, registry, out, i);
        break;
    }
  }
  return out;
}

function skinTexel(
  m: BandMesh,
  lerp: Interpolator,
  pixel: number,
  registry: Registry,
  out: BandResult,
  i: number,
): void {
  const p = lerp.position();
  const nrm = lerp.normal();
  const body = lerp.get('body', 4);
  const region = lerp.get('region', 4);
  const inv = 1 / m.scale;
  const y = p[1] * inv;
  const surface: Surface<number> = {
    x: p[0] * inv,
    y,
    z: p[2] * inv,
    nx: nrm[0],
    ny: nrm[1],
    nz: nrm[2],
    spine: body[0],
    height: body[1],
    ...limbAndWings(body[2], region[2]),
    crease: body[3],
    head: region[0],
    torso: region[1],
    tail: region[3],
    ground: y,
    pixel,
    // Slopes over two texels resolve features about three texels across (decision 4).
    reliefPixel: pixel * 0.4,
    time: 0,
  };
  const shade = shadeSkin(cpuKit, surface, m.material, registry);
  const mouth = shadeMouth(cpuKit, body[2], body[3]);
  const inside = mouth.inside;
  let shadeK = 1;
  let rough = shade.roughness;
  if (m.material.fur) {
    const reach = furReach(
      cpuKit,
      m.material.fur,
      {
        body: { x: body[0], y: body[1], z: body[2], w: body[3] },
        region: { x: region[0], y: region[1], z: region[2], w: region[3] },
        position: { x: p[0], y: p[1], z: p[2] },
      },
      m.eyes,
    );
    const furred = smooth(0.02, 0.1, reach);
    shadeK = 1 - furred * (m.coat ? 1 - COAT.shade : 0.5);
    rough = rough + ((m.coat ? COAT.roughness : 0.95) - rough) * furred;
  }
  const lin = [shade.r, shade.g, shade.b].map((c) => srgbToLinear(c) * shadeK);
  const wet = [mouth.r, mouth.g, mouth.b];
  for (let c = 0; c < 3; c++)
    out.color[i * 4 + c] = (lin[c] as number) * (1 - inside) + (wet[c] as number) * inside;
  out.color[i * 4 + 3] = 1;
  out.roughness[i] = rough * (1 - inside) + mouth.roughness * inside;
  // No relief inside the mouth: wet surfaces are smooth.
  out.height[i] = shade.height * m.scale * (1 - inside);
  out.glow[i * 3] = shade.er * (1 - inside);
  out.glow[i * 3 + 1] = shade.eg * (1 - inside);
  out.glow[i * 3 + 2] = shade.eb * (1 - inside);
}

function membraneTexel(
  m: BandMesh,
  lerp: Interpolator,
  pixel: number,
  patterned: boolean,
  veinRate: Float32Array | undefined,
  t: number,
  registry: Registry,
  out: BandResult,
  i: number,
): void {
  const c = lerp.get('color', 3);
  const info = lerp.get('info', 4);
  const vein = lerp.get('vein', 2);
  let rgb = [c[0], c[1], c[2]];
  let rough = info[2];
  let glow = [0, 0, 0];
  if (patterned) {
    const p = lerp.position();
    const nrm = lerp.normal();
    const inv = 1 / m.scale;
    const y = p[1] * inv;
    const surface: Surface<number> = {
      x: p[0] * inv,
      y,
      z: p[2] * inv,
      nx: nrm[0],
      ny: nrm[1],
      nz: nrm[2],
      spine: Math.min(1, Math.max(0, (m.front - p[2]) / Math.max(1e-6, m.front - m.back))),
      height: nrm[1],
      limb: Math.min(1, Math.max(0, vein[0])),
      crease: 0,
      head: 0,
      torso: 0,
      limbs: 0,
      tail: 0,
      wings: 1,
      ground: y,
      pixel,
      time: 0,
    };
    const shade = shadeMembrane(cpuKit, surface, [c[0], c[1], c[2]], info[2], m.material, registry);
    rgb = [shade.r, shade.g, shade.b];
    rough = shade.roughness;
    glow = [shade.er, shade.eg, shade.eb];
  }
  // Veins as the live shader draws them, anti-aliased by their change per texel.
  const lineAt = (x: number, count: number, rate: number) => {
    const f = Math.abs(((((x * count) % 1) + 1) % 1) - 0.5) * 2;
    const w = rate * count * 1.5 + 0.04;
    return 1 - smooth(0, w, 1 - f);
  };
  const along = veinRate?.[t * 2] ?? 0;
  const across = veinRate?.[t * 2 + 1] ?? 0;
  const lines = Math.max(lineAt(vein[1], 6, across), lineAt(vein[0], 3, along) * 0.6);
  const veins = info[3] * lines * (1 - vein[0] * 0.5);
  for (let k = 0; k < 3; k++) {
    const base = srgbToLinear(Math.min(1, Math.max(0, rgb[k] as number))) * (1 - veins * 0.55);
    out.color[i * 4 + k] = base;
    // Light through the membrane, as the live shader adds it, plus any glow.
    out.glow[i * 3 + k] = base * info[1] * 0.22 + (glow[k] as number);
  }
  out.color[i * 4 + 3] = info[0];
  out.roughness[i] = Math.min(1, Math.max(0.04, rough));
}

type Vec4 = [number, number, number, number];

interface Interpolator {
  at(triangle: number, w1: number, w2: number): void;
  position(): [number, number, number];
  normal(): [number, number, number];
  /** Up to four interpolated components (the rest 0). */
  get(name: string, size: number): Vec4;
  nearest(name: string, size: number, component: number): number;
}

/** Barycentric interpolation over a triangle's three vertices. */
function interpolator(m: BandMesh): Interpolator {
  let a = 0;
  let b = 0;
  let c = 0;
  let wa = 1;
  let wb = 0;
  let wc = 0;
  const mix = (array: Float32Array, size: number, k: number) =>
    (array[a * size + k] as number) * wa +
    (array[b * size + k] as number) * wb +
    (array[c * size + k] as number) * wc;
  return {
    at(t, w1, w2) {
      a = m.indices[t * 3] as number;
      b = m.indices[t * 3 + 1] as number;
      c = m.indices[t * 3 + 2] as number;
      wb = w1;
      wc = w2;
      wa = 1 - w1 - w2;
    },
    position: () => [mix(m.positions, 3, 0), mix(m.positions, 3, 1), mix(m.positions, 3, 2)],
    normal() {
      const x = mix(m.normals, 3, 0);
      const y = mix(m.normals, 3, 1);
      const z = mix(m.normals, 3, 2);
      const l = Math.hypot(x, y, z) || 1;
      return [x / l, y / l, z / l];
    },
    get(name, size) {
      const array = m.attributes[name] as Float32Array;
      const out: Vec4 = [0, 0, 0, 0];
      for (let k = 0; k < size; k++) out[k] = mix(array, size, k);
      return out;
    },
    nearest(name, size, component) {
      const array = m.attributes[name] as Float32Array;
      const v = wa >= wb && wa >= wc ? a : wb >= wc ? b : c;
      return array[v * size + component] as number;
    },
  };
}
