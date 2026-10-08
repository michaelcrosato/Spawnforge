/**
 * Shades bands of texels for texture bakes off the page's main thread
 * (docs/design/11.1-textures.md, decision 5). Builds its own registry, as the compile worker does.
 */
import { type BandJob, shadeBand } from '@spawnforge/bake';
import { createRegistry } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';

const registry = createRegistry([basicPack]);

self.onmessage = (event: MessageEvent<{ id: number; job: BandJob }>) => {
  const { id, job } = event.data;
  const result = shadeBand(job, registry);
  (self as unknown as Worker).postMessage({ id, result }, [
    result.color.buffer,
    result.roughness.buffer,
    result.height.buffer,
    result.glow.buffer,
  ]);
};
