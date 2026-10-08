import type {
  FurEye,
  FurSpec,
  Quality,
  Registry,
  SkinMaterialSpec,
  Surface,
} from '@spawnforge/core';
import {
  COAT,
  EYE_ROUGHNESS,
  furReach,
  hasWingLayers,
  MATERIAL_LOOK,
  shadeMembrane,
  shadeMouth,
  shadeSkin,
} from '@spawnforge/core';
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
  fract,
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
  DoubleSide,
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
  /** The size relief fades by, when it differs from `pixel` (a bake's, decision 4 of 11.1). */
  readonly reliefPixel?: N;
  readonly time?: N;
}

/** The pattern stack's view of a point on the skin, from node inputs. */
export function skinSurface(scale: N, inputs: SurfaceInputs): Surface<N> {
  const p = (inputs.position as N).div(scale);
  const n = inputs.normal as N;
  const { body, region } = inputs;
  // Wing and fin tubes carry `limb + 2` and count as wings (docs/design/9.3-wings-fins.md).
  const wing = step(float(1.5), body.z);
  return {
    x: p.x,
    y: p.y,
    z: p.z,
    nx: n.x,
    ny: n.y,
    nz: n.z,
    spine: body.x,
    height: body.y,
    limb: max(body.z.sub(wing.mul(2)), float(0)),
    crease: body.w,
    head: region.x,
    torso: region.y,
    limbs: region.z.mul(float(1).sub(wing)),
    tail: region.w,
    wings: region.z.mul(wing),
    ground: p.y,
    pixel: inputs.pixel ?? length(fwidth(p)),
    ...(inputs.reliefPixel ? { reliefPixel: inputs.reliefPixel } : {}),
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

/** How the skin is drawn when it is checked against an export (docs/design/11.1-textures.md). */
export interface SkinLook {
  /** Under fur, the coat's mean look rather than the shadowed skin beneath its shells. */
  readonly coat?: boolean;
  /** No wrapped light: what glTF's lighting gives. */
  readonly noWrap?: boolean;
  /**
   * A fixed size for detail to fade by (torso lengths), as a bake's texels give, for every pixel;
   * views are then drawn at about one pixel a texel (docs/design/11.1-textures.md, decision 13).
   */
  readonly pixel?: number;
  /** For the round trip's probes: leave out the relief, or the glow, or fix the roughness. */
  readonly noRelief?: boolean;
  readonly noGlow?: boolean;
  readonly roughness?: number;
}

/** The skin: base material, pattern layers, relief and glow, all from the material spec. */
export function skinMaterial(
  spec: SkinMaterialSpec,
  scale: number,
  registry: Registry,
  signals: SkinSignals = {},
  eyes: readonly FurEye[] = [],
  look: SkinLook = {},
): MeshPhysicalNodeMaterial {
  const lit = MATERIAL_LOOK[spec.material];
  const material = new WrapMaterial();
  material.wrap = look.noWrap ? 0 : lit.wrap;
  material.scatter = lit.scatter;
  const s = uniform(scale);
  const body = attribute('body', 'vec4') as N;
  const region = attribute('region', 'vec4') as N;
  const surface = skinSurface(s, {
    position: positionGeometry,
    normal: normalGeometry,
    body,
    region,
    // Relief as the bake keeps it: slopes over texels resolve features 0.4 of a texel across.
    ...(look.pixel !== undefined
      ? { pixel: float(look.pixel), reliefPixel: float(look.pixel * 0.4) }
      : {}),
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
    // Under fur, the skin is the coat's shadowed base: darker and matte. Without its shells (an
    // export's check), it takes the coat's mean look instead.
    const reach = furReach(tslKit, spec.fur, { body, region, position: positionGeometry }, eyes);
    const furred = smoothstep(float(0.02), float(0.1), reach as N);
    skin = skin.mul(float(1).sub(furred.mul(look.coat ? 1 - COAT.shade : 0.5)));
    roughness = mix(roughness, float(look.coat ? COAT.roughness : 0.95), furred);
  }
  const albedo: N = mix(skin, vec3(mouth.r, mouth.g, mouth.b), inside);
  material.colorNode = albedo;
  material.roughnessNode =
    look.roughness !== undefined
      ? float(look.roughness)
      : mix(roughness, mouth.roughness as N, inside);
  material.metalnessNode = float(0);
  if (!look.noGlow) material.emissiveNode = vec3(shade.er, shade.eg, shade.eb).mul(outside);
  if (lit.clearcoat > 0) {
    material.clearcoat = lit.clearcoat;
    material.clearcoatRoughness = lit.clearcoatRoughness;
  }
  // No skin relief inside the mouth: wet surfaces are smooth.
  if (!look.noRelief) material.normalNode = bumpNormal((shade.height as N).mul(s).mul(outside));
  const swell = breathing(s, region, signals.breath);
  if (swell) material.positionNode = (positionLocal as N).add(swell);
  return material;
}

/** Shells of fur over the skin, by quality: none at low (docs/design/8.4-materials.md). */
export const FUR_SHELLS: Readonly<Record<Quality, number>> = { low: 0, medium: 12, high: 16 };

/** Strands per hair length: the lattice spacing is `length / FUR_STRANDS`. */
const FUR_STRANDS = 14;

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
  const reach = furReach(tslKit, fur, { body, region, position: positionGeometry }, eyes) as N;
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

/** What membranes need to run the skin's `wings` layers (docs/design/9.3-wings-fins.md). */
export interface MembranePatterns {
  readonly spec: SkinMaterialSpec;
  readonly scale: number;
  readonly registry: Registry;
  /** The creature's rest bounds along z (metres), front and back, for `spine`. */
  readonly front: number;
  readonly back: number;
  readonly time?: N;
  /** A fixed size for detail to fade by (torso lengths), as an export's texels give. */
  readonly pixel?: number;
}

/**
 * Wing and fin membranes, feathers and fins (docs/design/9.3-wings-fins.md): double-sided, each
 * vertex's own colour under the skin's `wings` layers, veins drawn as anti-aliased lines, and
 * light showing through by translucency. See-through only when some vertex is.
 */
export function membraneMaterial(
  seeThrough: boolean,
  patterns?: MembranePatterns,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const c = attribute('color', 'vec3') as N;
  const info = attribute('info', 'vec4') as N;
  const vein = attribute('vein', 'vec2') as N;
  let srgb: N = c;
  let roughness: N = info.z;
  let glow: N = vec3(0, 0, 0);
  if (patterns && hasWingLayers(patterns.spec)) {
    const s = uniform(patterns.scale);
    const p = (positionGeometry as N).div(s);
    const n = normalGeometry as N;
    const surface: Surface<N> = {
      x: p.x,
      y: p.y,
      z: p.z,
      nx: n.x,
      ny: n.y,
      nz: n.z,
      spine: float(patterns.front)
        .sub((positionGeometry as N).z)
        .div(Math.max(1e-6, patterns.front - patterns.back))
        .clamp(0, 1),
      height: n.y,
      limb: vein.x.clamp(0, 1),
      crease: float(0),
      head: float(0),
      torso: float(0),
      limbs: float(0),
      tail: float(0),
      wings: float(1),
      ground: p.y,
      pixel: patterns.pixel !== undefined ? float(patterns.pixel) : length(fwidth(p)),
      time: patterns.time ?? float(0),
    };
    const shade = shadeMembrane(
      tslKit,
      surface,
      [c.x, c.y, c.z],
      info.z,
      patterns.spec,
      patterns.registry,
    );
    srgb = vec3(shade.r, shade.g, shade.b) as N;
    roughness = shade.roughness as N;
    glow = vec3(shade.er, shade.eg, shade.eb) as N;
  }
  // Veins: thin lines along the membrane and a few across it, anti-aliased by their width on
  // screen, strongest near the root.
  const lineAt = (x: N, count: number) => {
    const f = abs(fract(x.mul(count)).sub(0.5)).mul(2);
    const w = fwidth(x.mul(count)).mul(1.5).add(0.04);
    return float(1).sub(smoothstep(float(0), w, float(1).sub(f)));
  };
  const lines = max(lineAt(vein.y, 6), lineAt(vein.x, 3).mul(0.6));
  const veins = info.w.mul(lines).mul(float(1).sub(vein.x.mul(0.5)));
  const base = linear(srgb.clamp(0, 1)).mul(float(1).sub(veins.mul(0.55)));
  material.colorNode = base;
  material.roughnessNode = roughness.clamp(0.04, 1);
  material.metalnessNode = float(0);
  // Light coming through: a soft glow of the membrane's own colour, as backlit skin shows.
  material.emissiveNode = base.mul(info.y.mul(0.22)).add(glow);
  material.side = DoubleSide;
  if (seeThrough) {
    material.transparent = true;
    material.depthWrite = true;
    material.forceSinglePass = true;
    material.opacityNode = info.x;
  }
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
