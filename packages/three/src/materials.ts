import type {
  FurSpec,
  Quality,
  Region,
  Registry,
  SkinMaterialSpec,
  Surface,
} from '@spawnforge/core';
import { EYE_ROUGHNESS, MATERIAL_LOOK, shadeMouth, shadeSkin } from '@spawnforge/core';
import {
  abs,
  attribute,
  BRDF_Lambert,
  color,
  cross,
  dFdx,
  dFdy,
  diffuseContribution,
  dot,
  faceDirection,
  float,
  floor,
  fwidth,
  instanceIndex,
  length,
  max,
  mix,
  normalGeometry,
  normalLocal,
  normalView,
  positionGeometry,
  positionLocal,
  positionView,
  sign,
  smoothstep,
  sRGBTransferEOTF,
  step,
  uniform,
  varying,
  vec3,
  vec4,
  vertexStage,
} from 'three/tsl';
import {
  type LightingModelDirectInput,
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  type NodeBuilder,
  PhysicalLightingModel,
} from 'three/webgpu';
import { type N, tslKit } from './tsl-kit.ts';

/** sRGB to linear, typed loosely like the other kit nodes. */
const linear = (c: N): N => sRGBTransferEOTF(c);

/** Perturbs the view normal by a height field (Mikkelsen, surface gradient from derivatives). */
function bumpNormal(height: N): N {
  const sx = dFdx(positionView);
  const sy = dFdy(positionView);
  const n = normalView;
  const r1 = cross(sy, n);
  const r2 = cross(n, sx);
  const det = dot(sx, r1).mul(faceDirection);
  const grad = sign(det).mul(dFdx(height).mul(r1).add(dFdy(height).mul(r2)));
  return abs(det).mul(n).sub(grad).normalize();
}

/**
 * Physical lighting plus wrapped diffuse: the light a Lambert term `(n·l + w)/(1 + w)` gives
 * beyond plain `n·l`, tinted by `scatter`, so the terminator softens and warms like light under
 * the skin (docs/design/8.4-materials.md).
 */
class WrapLightingModel extends PhysicalLightingModel {
  readonly wrap: number;
  readonly scatter: readonly [number, number, number];

  constructor(clearcoat: boolean, wrap: number, scatter: readonly [number, number, number]) {
    super(clearcoat);
    this.wrap = wrap;
    this.scatter = scatter;
  }

  override direct(input: LightingModelDirectInput, builder: NodeBuilder): void {
    super.direct(input, builder);
    if (this.wrap <= 0) return;
    const { lightDirection, lightColor, reflectedLight } = input as unknown as {
      lightDirection: N;
      lightColor: N;
      reflectedLight: { directDiffuse: N };
    };
    const nl = (normalView as N).dot(lightDirection);
    const w = float(this.wrap);
    const extra = nl.add(w).div(w.add(1)).clamp().sub(nl.clamp());
    reflectedLight.directDiffuse.addAssign(
      extra
        .mul(lightColor)
        .mul(BRDF_Lambert({ diffuseColor: diffuseContribution } as never) as N)
        .mul(vec3(...this.scatter)),
    );
  }
}

/** A physical material whose direct light wraps (see `WrapLightingModel`). */
class WrapMaterial extends MeshPhysicalNodeMaterial {
  wrap = 0;
  scatter: readonly [number, number, number] = [1, 1, 1];

  override setupLightingModel(): PhysicalLightingModel {
    return new WrapLightingModel(this.useClearcoat, this.wrap, this.scatter);
  }
}

/** Per-vertex inputs to the skin's pattern stack, as nodes. */
export interface SurfaceInputs {
  /** Rest-pose position in metres. */
  readonly position: N;
  readonly normal: N;
  /** `body` and `region` attributes (vec4 each). */
  readonly body: N;
  readonly region: N;
  /** Screen pixel size on the skin in torso lengths (0 for none). */
  readonly pixel?: N;
  readonly time?: N;
}

/** The pattern stack's view of a point on the skin, from node inputs. */
export function skinSurface(scale: N, inputs: SurfaceInputs): Surface<N> {
  const p = (inputs.position as N).div(scale);
  const n = inputs.normal as N;
  const { body, region } = inputs;
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    nx: n.x,
    ny: n.y,
    nz: n.z,
    spine: body.x,
    height: body.y,
    limb: max(body.z, float(0)),
    crease: body.w,
    head: region.x,
    torso: region.y,
    limbs: region.z,
    tail: region.w,
    ground: p.y,
    pixel: inputs.pixel ?? length(fwidth(p)),
    time: inputs.time ?? float(0),
  };
}

/** Shader inputs the pose drives. */
export interface SkinSignals {
  readonly breath?: N;
  readonly time?: N;
}

/** Breathing: the torso swells along its normals, up to about 1% of the torso length. */
function breathing(scale: N, region: N, breath: N | undefined): N | null {
  if (!breath) return null;
  const swell = (breath as N).mul(scale).mul(0.011).mul(region.y);
  return (normalLocal as N).normalize().mul(swell);
}

/** The skin: base material, pattern layers, relief and glow, all from the material spec. */
export function skinMaterial(
  spec: SkinMaterialSpec,
  scale: number,
  registry: Registry,
  signals: SkinSignals = {},
  eyes: readonly FurEye[] = [],
): MeshPhysicalNodeMaterial {
  const look = MATERIAL_LOOK[spec.material];
  const material = new WrapMaterial();
  material.wrap = look.wrap;
  material.scatter = look.scatter;
  const s = uniform(scale);
  const body = attribute('body', 'vec4') as N;
  const region = attribute('region', 'vec4') as N;
  const surface = skinSurface(s, {
    position: positionGeometry,
    normal: normalGeometry,
    body,
    region,
    ...(signals.time ? { time: signals.time } : {}),
  });
  const shade = shadeSkin(tslKit, surface, spec, registry);
  const srgb = vec3(shade.r, shade.g, shade.b) as N;
  // Inside the mouth (body.z <= -1) is wet: cavity, gums and tongue, darker toward the throat.
  const mouth = shadeMouth(tslKit, body.z, body.w);
  const inside = mouth.inside as N;
  const outside = float(1).sub(inside);
  let skin: N = linear(srgb.clamp(0, 1));
  let roughness: N = shade.roughness;
  if (spec.fur) {
    // Under fur, the skin is the coat's shadowed base: darker and matte.
    const furred = smoothstep(float(0.02), float(0.1), furReach(spec.fur, body, region, eyes));
    skin = skin.mul(float(1).sub(furred.mul(0.5)));
    roughness = mix(roughness, float(0.95), furred);
  }
  const albedo: N = mix(skin, vec3(mouth.r, mouth.g, mouth.b), inside);
  material.colorNode = albedo;
  material.roughnessNode = mix(roughness, mouth.roughness as N, inside);
  material.metalnessNode = float(0);
  material.emissiveNode = vec3(shade.er, shade.eg, shade.eb).mul(outside);
  if (look.clearcoat > 0) {
    material.clearcoat = look.clearcoat;
    material.clearcoatRoughness = look.clearcoatRoughness;
  }
  // No skin relief inside the mouth: wet surfaces are smooth.
  material.normalNode = bumpNormal((shade.height as N).mul(s).mul(outside));
  const swell = breathing(s, region, signals.breath);
  if (swell) material.positionNode = (positionLocal as N).add(swell);
  return material;
}

/** Shells of fur over the skin, by quality: none at low (docs/design/8.4-materials.md). */
export const FUR_SHELLS: Readonly<Record<Quality, number>> = { low: 0, medium: 12, high: 16 };

/** Where fur grows, 0 to 1, from a layer region's mask. */
function furRegion(region: Region, body: N, regions: N): N {
  const height = body.y;
  const notLimb = float(1).sub(regions.z);
  switch (region) {
    case 'all':
      return float(1);
    case 'back':
      return smoothstep(float(-0.15), float(0.35), height).mul(notLimb);
    case 'belly':
      return float(1)
        .sub(smoothstep(float(-0.35), float(0.15), height))
        .mul(notLimb);
    case 'head':
      return regions.x;
    case 'torso':
      return regions.y;
    case 'limbs':
      return regions.z;
    case 'tail':
      return regions.w;
    case 'wings':
      return float(0);
  }
}

/** Strands per hair length: the lattice spacing is `length / FUR_STRANDS`. */
const FUR_STRANDS = 14;

/**
 * How long the fur is at a skin vertex, relative to `length`: its regions, shorter in creases
 * (and so along the lip line) and on the head, and none inside the mouth.
 */
function furReach(fur: FurSpec, body: N, region: N, eyes: readonly FurEye[] = []): N {
  let where: N = float(0);
  for (const r of fur.region) where = max(where, furRegion(r, body, region));
  const inMouth = float(1).sub(step(float(-0.5), body.z));
  // Short on the toes, as on a paw.
  const toes = float(1).sub(smoothstep(float(0.8), float(1), body.z).mul(0.7));
  let reach: N = where
    .mul(float(1).sub(body.w.clamp(0, 1).mul(0.8)))
    .mul(float(1).sub(region.x.mul(0.4)))
    .mul(float(1).sub(inMouth))
    .mul(toes);
  // Clear round each eye, so the lids and the eye show.
  for (const eye of eyes) {
    const d = length((positionGeometry as N).sub(vec3(eye.x, eye.y, eye.z)));
    reach = reach.mul(smoothstep(float(eye.radius * 1.15), float(eye.radius * 2), d));
  }
  return reach;
}

/** An eye the fur keeps clear of: its rest centre and radius, in metres. */
export interface FurEye {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly radius: number;
}

/**
 * Shell fur: drawn as `shells` instances of the skin's geometry, each pushed out along the
 * skinned normal, keeping the fragments that fall inside a hair. One draw call. Colours are the
 * skin's own pattern stack, evaluated per vertex.
 */
export function furMaterial(
  spec: SkinMaterialSpec,
  fur: FurSpec,
  shells: number,
  scale: number,
  registry: Registry,
  signals: SkinSignals = {},
  eyes: readonly FurEye[] = [],
): MeshPhysicalNodeMaterial {
  const material = new WrapMaterial();
  material.wrap = 0.5;
  material.scatter = [1, 0.92, 0.86];
  const s = uniform(scale);
  const body = attribute('body', 'vec4') as N;
  const region = attribute('region', 'vec4') as N;
  // Strands sit on a lattice `spacing` torso lengths apart.
  const spacing = fur.length / FUR_STRANDS;
  const reach = furReach(fur, body, region, eyes);
  // This shell's height, 0 at the skin to 1 at the longest hair's tip.
  const level: N = float(instanceIndex).add(1).div(shells);
  const out: N = level.mul(reach).mul(s).mul(fur.length);
  const droop: N = vec3(0, -1, 0).mul(
    level
      .mul(level)
      .mul(reach)
      .mul(s)
      .mul(fur.length * 0.3),
  );
  let position: N = (positionLocal as N).add((normalLocal as N).normalize().mul(out)).add(droop);
  const swell = breathing(s, region, signals.breath);
  if (swell) position = position.add(swell);
  material.positionNode = position;

  // Fragments: the hair at this rest-pose point, a jittered column per lattice cell that tapers
  // to nothing at its own height.
  const h: N = varying(level);
  const keepReach: N = varying(reach);
  const p: N = (positionGeometry as N).div(s).div(spacing);
  const cell: N = floor(p);
  const hash = (salt: number) => tslKit.hash3(cell.x, cell.y, cell.z, salt) as N;
  const centre = cell.add(0.5).add(vec3(hash(11), hash(23), hash(37)).sub(0.5).mul(0.4));
  const d = length(p.sub(centre));
  const tall = hash(41).mul(0.5).add(0.5);
  const present = step(hash(53), float(0.35 + 0.65 * fur.density));
  // Thick at the root, where neighbouring hairs close into an undercoat, tapering to the tip.
  const radius = float(0.72).mul(float(1).sub(h.div(tall)).pow(0.7));
  material.maskNode = present
    .mul(step(h, tall))
    .mul(step(d, radius))
    .mul(step(float(0.05), keepReach))
    .greaterThan(0.5);

  // The skin's colours under the fur, per vertex, with detail finer than the strands left out.
  const surface = skinSurface(s, {
    position: positionGeometry,
    normal: normalGeometry,
    body,
    region,
    pixel: float(spacing),
    ...(signals.time ? { time: signals.time } : {}),
  });
  const shade = shadeSkin(tslKit, surface, spec, registry);
  const colour: N = vertexStage(linear(vec3(shade.r, shade.g, shade.b).clamp(0, 1) as N));
  // Darker toward the roots, a cheap self-shadow.
  material.colorNode = colour.mul(float(0.55).add(h.mul(0.45)));
  material.roughnessNode = float(0.85);
  material.metalnessNode = float(0);
  return material;
}

/**
 * For the CPU–GPU parity test: an unlit material that writes the pattern stack's raw outputs, one
 * pixel per quad, from per-vertex `rest`, `restNormal`, `body` and `region` attributes (constant
 * over each quad, so `pixel` is 0 as in bakes). The quad's `position.xy` is its place in clip
 * space. Pass 0 writes sRGB albedo and roughness, pass 1 relief (× 1000) and linear glow, pass 2
 * the mouth's colour and where it applies.
 */
export function stackMaterial(
  spec: SkinMaterialSpec,
  scale: number,
  registry: Registry,
  pass: 0 | 1 | 2,
): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  const s = uniform(scale);
  const body = attribute('body', 'vec4') as N;
  const region = attribute('region', 'vec4') as N;
  const surface = skinSurface(s, {
    position: attribute('rest', 'vec3'),
    normal: attribute('restNormal', 'vec3'),
    body,
    region,
  });
  const shade = shadeSkin(tslKit, surface, spec, registry);
  const mouth = shadeMouth(tslKit, body.z, body.w);
  material.vertexNode = vec4((positionGeometry as N).xy, 0, 1);
  material.outputNode =
    pass === 0
      ? vec4(shade.r, shade.g, shade.b, shade.roughness)
      : pass === 1
        ? vec4((shade.height as N).mul(1000), shade.er, shade.eg, shade.eb)
        : vec4(mouth.r, mouth.g, mouth.b, mouth.inside);
  return material;
}

/** Hard parts: per-vertex colour (root to tip) and roughness. */
export function partsMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const c = attribute('color', 'vec3') as N;
  const info = attribute('info', 'vec2') as N;
  material.colorNode = linear(c);
  material.roughnessNode = info.y;
  material.metalnessNode = float(0);
  return material;
}

/** Eyes: sclera, iris and a round, slit or goat pupil, from the eye-space position. */
export function eyeMaterial(): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const e = attribute('eye', 'vec4') as N;
  const iris = attribute('iris', 'vec4') as N;
  const sclera = attribute('sclera', 'vec3') as N;
  const front = step(float(0), e.z);
  const r = iris.w.mul(0.62);
  const dist = length(e.xy);
  const irisMask = float(1)
    .sub(smoothstep(r.sub(0.04), r, dist))
    .mul(front);
  const kind = e.w;
  const round = float(1).sub(smoothstep(r.mul(0.42).sub(0.03), r.mul(0.42), dist));
  const slit = float(1)
    .sub(smoothstep(r.mul(0.13).sub(0.02), r.mul(0.13), abs(e.x)))
    .mul(float(1).sub(smoothstep(r.mul(0.92).sub(0.03), r.mul(0.92), abs(e.y))));
  const goat = float(1)
    .sub(smoothstep(r.mul(0.15).sub(0.02), r.mul(0.15), abs(e.y)))
    .mul(float(1).sub(smoothstep(r.mul(0.92).sub(0.03), r.mul(0.92), abs(e.x))));
  const isSlit = step(float(0.5), kind).mul(float(1).sub(step(float(1.5), kind)));
  const isGoat = step(float(1.5), kind);
  const pupil = mix(mix(round, slit, isSlit), goat, isGoat).mul(irisMask);
  // A darker ring at the iris edge and lighter flecks toward the pupil read as depth.
  const ring = smoothstep(r.mul(0.6), r, dist);
  const irisColor = (iris.xyz as N).mul(float(1.15).sub(ring.mul(0.45)));
  const c: N = mix(mix(sclera, irisColor, irisMask), vec3(0.02, 0.02, 0.02), pupil);
  material.colorNode = linear(c);
  // Soft gloss: wet, but not glass (8.3).
  material.roughnessNode = float(EYE_ROUGHNESS);
  material.metalnessNode = float(0);
  return material;
}

export { color };

/**
 * Stand-in skin: a pale belly blending into a darker back along local Y. Kept for quick scenes
 * without a compiled creature.
 */
export function placeholderSkinMaterial(
  base: string,
  belly: string,
  halfHeight: number,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.7 });
  const t = smoothstep(float(-halfHeight), float(halfHeight), (positionGeometry as N).y);
  material.colorNode = mix(color(belly), color(base), t);
  return material;
}
