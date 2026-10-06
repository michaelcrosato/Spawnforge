import { hexToRgb } from '../blueprint/colors.ts';
import type { LayerSpec, Region, SkinMaterial } from '../blueprint/creature.ts';
import type { PatternModule, Registry } from '../registry.ts';
import { deriveSeed } from '../rng.ts';
import type { Kit, PatternHooks, Surface } from './kit.ts';
import { cells, fbm } from './noise.ts';

/** Everything the skin shader needs, as plain data. Colours are sRGB hex. */
export interface SkinMaterialSpec {
  readonly base: string;
  readonly material: SkinMaterial;
  readonly layers: readonly (LayerSpec & { readonly seed: number })[];
}

export interface SkinShade<F> {
  /** sRGB colour, 0 to 1. */
  readonly r: F;
  readonly g: F;
  readonly b: F;
  readonly roughness: F;
  /** Relief in torso lengths, for bump mapping. */
  readonly height: F;
}

export function skinMaterialSpec(
  base: string,
  material: SkinMaterial,
  layers: readonly LayerSpec[],
  seed: number,
): SkinMaterialSpec {
  return {
    base,
    material,
    layers: layers.map((l) => ({ ...l, seed: deriveSeed(seed, `layer:${l.id}`) % 997 })),
  };
}

/** 1 where a feature of `size` (torso lengths) spans several pixels, fading to 0 below that. */
export function detail<F>(k: Kit<F>, s: Surface<F>, size: number): F {
  return k.sub(k.num(1), k.smoothstep(k.num(size * 0.12), k.num(size * 0.45), s.pixel));
}

/**
 * Like `detail`, for relief. Bump mapping takes slopes per 2×2 pixel block, so relief needs
 * features about 25 pixels across to look smooth and is gone below about 7.
 */
export function relief<F>(k: Kit<F>, s: Surface<F>, size: number): F {
  return k.sub(k.num(1), k.smoothstep(k.num(size * 0.04), k.num(size * 0.15), s.pixel));
}

function regionMask<F>(k: Kit<F>, s: Surface<F>, region: Region): F {
  switch (region) {
    case 'all':
      return k.num(1);
    case 'back':
      return k.mul(k.smoothstep(k.num(-0.15), k.num(0.35), s.height), k.sub(k.num(1), s.limbs));
    case 'belly':
      return k.mul(
        k.sub(k.num(1), k.smoothstep(k.num(-0.35), k.num(0.15), s.height)),
        k.sub(k.num(1), s.limbs),
      );
    case 'head':
      return s.head;
    case 'torso':
      return s.torso;
    case 'limbs':
      return s.limbs;
    case 'tail':
      return s.tail;
    case 'wings':
      // Wing and fin membranes are separate meshes (from milestone 9.3); the skin has none.
      return k.num(0);
  }
}

// `hide` draws as skin until milestone 8.4 builds its creases.
const BASE_ROUGHNESS: Record<SkinMaterial, number> = {
  skin: 0.72,
  scales: 0.5,
  chitin: 0.3,
  hide: 0.72,
};

/** Base surface plus every layer, bottom first. */
export function shadeSkin<F>(
  k: Kit<F>,
  s: Surface<F>,
  spec: SkinMaterialSpec,
  registry: Registry,
): SkinShade<F> {
  const [br, bg, bb] = hexToRgb(spec.base);
  // A little low-frequency variation keeps large areas from looking flat.
  const variation = k.sub(
    fbm(k, k.mul(s.x, k.num(6)), k.mul(s.y, k.num(6)), k.mul(s.z, k.num(6)), 2, 401),
    k.num(0.5),
  );
  const tone = k.add(k.num(1), k.mul(variation, k.num(0.16)));
  let r = k.mul(k.param(br), tone);
  let g = k.mul(k.param(bg), tone);
  let b = k.mul(k.param(bb), tone);
  let roughness = k.num(BASE_ROUGHNESS[spec.material]);
  let height = k.num(0);

  if (spec.material === 'scales') {
    const f = k.num(1 / 0.012);
    const c = cells(k, k.mul(s.x, f), k.mul(s.y, f), k.mul(s.z, f), 0.6, 503, {
      stagger: true,
      reach: 3,
    });
    const edge = k.smoothstep(k.num(0), k.num(0.4), k.sub(c.second, c.distance));
    height = k.add(height, k.mul(k.mul(edge, k.num(0.0012)), relief(k, s, 0.012)));
  } else if (spec.material === 'chitin') {
    const sheen = fbm(
      k,
      k.mul(s.x, k.num(14)),
      k.mul(s.y, k.num(14)),
      k.mul(s.z, k.num(14)),
      2,
      607,
    );
    height = k.add(height, k.mul(sheen, k.num(0.001)));
  }

  for (const layer of spec.layers) {
    const module = registry.get('pattern', layer.type) as PatternModule | undefined;
    const hooks = module?.hooks as PatternHooks | undefined;
    if (!hooks) continue;
    const out = hooks.shade(k, s, layer.params as Record<string, unknown>, layer.seed);
    const weight = k.mul(
      k.clamp(out.mask, k.num(0), k.num(1)),
      k.mul(k.param(layer.strength), regionMask(k, s, layer.region)),
    );
    const hex =
      out.color ??
      (typeof layer.params.color === 'string' ? (layer.params.color as string) : undefined);
    if (hex) {
      const [lr, lg, lb] = hexToRgb(hex);
      r = k.mix(r, k.param(lr), weight);
      g = k.mix(g, k.param(lg), weight);
      b = k.mix(b, k.param(lb), weight);
    }
    if (out.roughness !== undefined) roughness = k.mix(roughness, out.roughness, weight);
    if (out.height !== undefined)
      height = k.add(
        height,
        k.mul(out.height, k.mul(k.param(layer.strength), regionMask(k, s, layer.region))),
      );
  }

  // Creases where sections join read a little darker, like ambient occlusion.
  const shade = k.sub(k.num(1), k.mul(s.crease, k.num(0.25)));
  return { r: k.mul(r, shade), g: k.mul(g, shade), b: k.mul(b, shade), roughness, height };
}

/** Inside the mouth: wet colours in linear light, and where they apply. */
export interface MouthShade<F> {
  /** 1 inside the mouth (cavity, lips' inner side, gums, tongue), else 0. */
  readonly inside: F;
  /** Linear-light colour. */
  readonly r: F;
  readonly g: F;
  readonly b: F;
  readonly roughness: F;
}

/**
 * The mouth's colours from the skin's body coordinates (docs/design/8.3-heads.md): inside
 * vertices carry `limb = -1 - depth` (0 at the lips, 1 at the throat) and their kind in
 * `crease` (0 cavity, 1 lips and gums, 2 tongue). The cavity goes from wet red to near black
 * toward the throat; gums are pink, and the tongue a lighter pink that darkens with depth.
 */
export function shadeMouth<F>(k: Kit<F>, limb: F, crease: F): MouthShade<F> {
  const inside = k.sub(k.num(1), k.step(k.num(-0.5), limb));
  const depth = k.clamp(k.sub(k.num(-1), limb), k.num(0), k.num(1));
  const gum = k.mul(k.step(k.num(0.5), crease), k.sub(k.num(1), k.step(k.num(1.5), crease)));
  const tongue = k.step(k.num(1.5), crease);
  const dim = (c: number, keep: number) =>
    k.mul(k.num(c), k.sub(k.num(1), k.mul(depth, k.num(1 - keep))));
  const channel = (cavity: number, throat: number, gums: number, tip: number) => {
    const wall = k.mix(k.num(cavity), k.num(throat), k.smoothstep(k.num(0), k.num(1), depth));
    const withGum = k.mix(wall, dim(gums, 0.55), gum);
    return k.mix(withGum, dim(tip, 0.45), tongue);
  };
  return {
    inside,
    r: channel(0.3, 0.025, 0.42, 0.52),
    g: channel(0.055, 0.004, 0.12, 0.17),
    b: channel(0.06, 0.005, 0.13, 0.18),
    roughness: k.num(0.3),
  };
}
