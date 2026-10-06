import type { Registry, SkinMaterialSpec, Surface } from '@spawnforge/core';
import { shadeSkin } from '@spawnforge/core';
import {
  abs,
  attribute,
  color,
  cross,
  dFdx,
  dFdy,
  dot,
  faceDirection,
  float,
  fwidth,
  length,
  max,
  mix,
  normalGeometry,
  normalView,
  positionGeometry,
  positionView,
  sign,
  smoothstep,
  sRGBTransferEOTF,
  step,
  uniform,
  vec3,
} from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';
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

/** The skin: base material, pattern layers and relief, all from the material spec. */
export function skinMaterial(
  spec: SkinMaterialSpec,
  scale: number,
  registry: Registry,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial();
  const s = uniform(scale);
  const body = attribute('body', 'vec4') as N;
  const region = attribute('region', 'vec4') as N;
  const p = (positionGeometry as N).div(s);
  const n = normalGeometry as N;
  const surface: Surface<N> = {
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
    pixel: length(fwidth(p)),
  };
  const shade = shadeSkin(tslKit, surface, spec, registry);
  const srgb = vec3(shade.r, shade.g, shade.b) as N;
  // Inside the mouth (body.z = -1) is dark and wet.
  const inside = step(body.z, float(-0.5));
  const albedo: N = mix(linear(srgb.clamp(0, 1)), vec3(0.18, 0.025, 0.03), inside);
  material.colorNode = albedo;
  material.roughnessNode = mix(shade.roughness as N, float(0.35), inside);
  material.metalnessNode = float(0);
  material.normalNode = bumpNormal((shade.height as N).mul(s));
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
  material.roughnessNode = float(0.12);
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
