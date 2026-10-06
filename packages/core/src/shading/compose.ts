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

function regionMask<F>(k: Kit<F>, s: Surface<F>, region: Region): F {
  switch (region) {
    case 'all':
      return k.num(1);
    case 'back':
      return k.smoothstep(k.num(-0.15), k.num(0.35), s.height);
    case 'belly':
      return k.sub(k.num(1), k.smoothstep(k.num(-0.35), k.num(0.15), s.height));
    case 'head':
      return s.head;
    case 'torso':
      return s.torso;
    case 'limbs':
      return s.limbs;
    case 'tail':
      return s.tail;
  }
}

const BASE_ROUGHNESS: Record<SkinMaterial, number> = { skin: 0.72, scales: 0.5, chitin: 0.3 };

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
    const c = cells(k, k.mul(s.x, f), k.mul(s.y, f), k.mul(s.z, f), 0.6, 503);
    const edge = k.smoothstep(k.num(0), k.num(0.12), k.sub(c.second, c.distance));
    height = k.add(height, k.mul(k.mul(edge, k.num(0.0015)), detail(k, s, 0.012)));
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
