/**
 * The `.glb` download, as `spawnforge export` writes it (`exportGlb`), with the texture bake
 * shaded on workers. Loaded on the first download.
 */
import type { BandJob, BandResult } from '@spawnforge/bake';
import type { Registry } from '@spawnforge/core';
import { exportGlb } from '@spawnforge/three/glb';

let bakers: Worker[] | undefined;
const pending = new Map<number, (result: BandResult) => void>();
let nextJob = 0;

function bakeWorkers(): Worker[] {
  bakers ??= Array.from(
    { length: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)) },
    () => {
      const worker = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ id: number; result: BandResult }>) => {
        pending.get(event.data.id)?.(event.data.result);
        pending.delete(event.data.id);
      };
      return worker;
    },
  );
  return bakers;
}

function runBands(jobs: readonly BandJob[]): Promise<BandResult[]> {
  const workers = bakeWorkers();
  return Promise.all(
    jobs.map(
      (job, i) =>
        new Promise<BandResult>((resolve) => {
          const id = nextJob++;
          pending.set(id, resolve);
          (workers[i % workers.length] as Worker).postMessage({ id, job });
        }),
    ),
  );
}

/** Exports and saves the file; resolves with its size and clip count. */
export async function downloadGlb(
  blueprint: unknown,
  registry: Registry,
  name: string,
): Promise<{ bytes: number; clips: number }> {
  const { glb, clips } = await exportGlb(blueprint, registry, {
    run: runBands,
    bands: bakeWorkers().length * 2,
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([glb], { type: 'model/gltf-binary' }));
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
  return { bytes: glb.byteLength, clips };
}
