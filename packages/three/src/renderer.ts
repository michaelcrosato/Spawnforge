import { WebGPURenderer } from 'three/webgpu';

export type Backend = 'WebGPU' | 'WebGL 2';

export interface CreatedRenderer {
  readonly renderer: WebGPURenderer;
  /** WebGPURenderer falls back to WebGL 2 where WebGPU is missing, e.g. headless Chromium. */
  readonly backend: Backend;
}

export async function createRenderer(
  canvas: HTMLCanvasElement,
  options: { forceWebGL?: boolean } = {},
): Promise<CreatedRenderer> {
  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    forceWebGL: options.forceWebGL ?? false,
  });
  await renderer.init();
  const isWebGPU = (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true;
  return { renderer, backend: isWebGPU ? 'WebGPU' : 'WebGL 2' };
}
