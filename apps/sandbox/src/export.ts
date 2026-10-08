/**
 * The sandbox's "export .glb", as `spawnforge export` writes it: baked clips, texture maps baked
 * on workers, sockets and the blueprint in the extras. Loaded on the first export, so the page
 * does not carry the validator, xatlas or the exporter until then.
 */
import { type BandJob, type BandResult, bakeTextures } from '@spawnforge/bake';
import {
  bakeClips,
  type CompiledCreature,
  compileCreature,
  type Registry,
  resolveBlueprint,
} from '@spawnforge/core';
import { buildExportScene } from '@spawnforge/three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

let bakers: Worker[] | undefined;
const pending = new Map<number, (result: BandResult) => void>();
let nextJob = 0;

/** Workers that shade bands of texels, started on the first export and kept. */
function bakeWorkers(): Worker[] {
  if (!bakers) {
    const count = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
    bakers = Array.from({ length: count }, () => {
      const worker = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ id: number; result: BandResult }>) => {
        pending.get(event.data.id)?.(event.data.result);
        pending.delete(event.data.id);
      };
      return worker;
    });
  }
  return bakers;
}

/** Shades bands on the workers, one band per worker at a time. */
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

/** A creature as a binary glTF, with the clip count for the log. */
export async function exportGlb(
  blueprint: unknown,
  compiled: CompiledCreature,
  registry: Registry,
): Promise<{ glb: ArrayBuffer; clips: number }> {
  const clips = bakeClips(compiled, registry);
  // Compiled again with its distance field, for the maps' occlusion.
  const withField = compileCreature(resolveBlueprint(blueprint, registry), registry, {
    quality: compiled.quality,
    field: true,
  });
  const textures = await bakeTextures(withField, registry, {
    run: runBands,
    bands: bakeWorkers().length * 2,
  });
  const { scene, animations } = buildExportScene(withField, registry, {
    clips,
    extras: { blueprint },
    textures,
  });
  const glb = (await new GLTFExporter().parseAsync(scene, {
    binary: true,
    animations,
  })) as ArrayBuffer;
  return { glb, clips: clips.length };
}
