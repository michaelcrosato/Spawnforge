/**
 * A creature as a `.glb` in the browser, as `spawnforge export` writes it: baked clips, texture
 * maps baked from the live material, levels of detail, sockets and the blueprint in the extras
 * (docs/runtime.md). Its own entry point (`@spawnforge/three/glb`), so a game that never exports
 * does not load the bake (xatlas, meshoptimizer) or the exporter.
 */
import { type BandJob, type BandResult, bakeTextures, shadeBand } from '@spawnforge/bake';
import { simplifyChain } from '@spawnforge/bake/lod';
import {
  bakeClips,
  compileCreature,
  type Quality,
  type Registry,
  resolveBlueprint,
} from '@spawnforge/core';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { buildExportScene, lodExporterPlugin } from './export.ts';

export interface GlbOptions {
  readonly quality?: Quality;
  /**
   * Shades bands of texels, on workers that call `shadeBand` (as the sandbox's do); by default
   * on this thread, which holds the page for a few seconds.
   */
  readonly run?: (jobs: readonly BandJob[]) => Promise<BandResult[]>;
  /** How many bands to split each map into (twice the workers is a good number). */
  readonly bands?: number;
}

/** A file larger than this writes its colour and glow maps as JPEG (docs/design/11.1-textures.md). */
const MAX_GLB_BYTES = 8_000_000;

export async function exportGlb(
  blueprint: unknown,
  registry: Registry,
  options: GlbOptions = {},
): Promise<{ glb: Uint8Array<ArrayBuffer>; clips: number; notes: string[] }> {
  // With its distance field, for the maps' occlusion.
  const compiled = compileCreature(resolveBlueprint(blueprint, registry), registry, {
    quality: options.quality ?? 'medium',
    field: true,
  });
  const clips = bakeClips(compiled, registry);
  const run = options.run ?? (async (jobs) => jobs.map((job) => shadeBand(job, registry)));
  const textures = await bakeTextures(compiled, registry, {
    run,
    ...(options.bands ? { bands: options.bands } : {}),
  });
  // Levels of detail over the meshes as written (docs/design/11.2-lod.md).
  const lods = {
    skin: await simplifyChain(textures.skin ?? compiled.skin),
    parts: await simplifyChain(textures.parts ?? compiled.parts),
  };
  const write = async (colorImages: 'image/png' | 'image/jpeg') => {
    const { scene, animations, notes } = buildExportScene(compiled, registry, {
      clips,
      extras: { blueprint },
      textures,
      colorImages,
      lods,
    });
    const glb = (await new GLTFExporter().register(lodExporterPlugin).parseAsync(scene, {
      binary: true,
      animations,
    })) as ArrayBuffer;
    return { glb: new Uint8Array(glb), notes };
  };
  let written = await write('image/png');
  if (written.glb.length > MAX_GLB_BYTES) {
    written = await write('image/jpeg');
    written.notes.push('colour and glow maps are JPEG, to keep the file under 8 MB');
  }
  return { ...written, clips: clips.length };
}
