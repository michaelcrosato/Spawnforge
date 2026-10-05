import { color, mix, positionLocal, smoothstep } from 'three/tsl';
import { MeshStandardNodeMaterial } from 'three/webgpu';

/**
 * Stand-in skin until the pattern stack lands: a pale belly blending into a darker back along
 * local Y. Written in TSL, so the same material runs on the WebGPU and WebGL 2 backends.
 */
export function placeholderSkinMaterial(
  base: string,
  belly: string,
  halfHeight: number,
): MeshStandardNodeMaterial {
  const material = new MeshStandardNodeMaterial({ roughness: 0.7 });
  const t = smoothstep(-halfHeight, halfHeight, positionLocal.y);
  material.colorNode = mix(color(belly), color(base), t);
  return material;
}
