/**
 * The smallest game that uses Spawnforge as installed packages: it spawns a creature through a
 * compile worker, walks it for a second and renders frames. `scripts/smoke.ts` builds it from
 * the packed tarballs and reads `window.smoke` in headless Chromium.
 */
import { basicPack } from '@spawnforge/modules';
import { type Bestiary, createBestiary, createRenderer } from '@spawnforge/three';
import * as THREE from 'three/webgpu';
import creature from './creature.json';

interface Smoke {
  readonly ok: boolean;
  readonly backend?: string;
  readonly triangles?: number;
  readonly bones?: number;
  readonly walked?: number;
  readonly error?: string;
}
declare global {
  interface Window {
    smoke?: Smoke;
  }
}

/** Never called: the type error below proves the packages' declarations resolve. */
export function typesResolve(bestiary: Bestiary): void {
  // @ts-expect-error: quality is low, medium or high
  void bestiary.spawn(creature, { quality: 'ultra' });
}

async function main(): Promise<Smoke> {
  const canvas = document.getElementById('view') as HTMLCanvasElement;
  // Headless Chromium has no WebGPU; WebGL 2 is the fallback games get there too.
  const { renderer, backend } = await createRenderer(canvas, { forceWebGL: true });
  const bestiary = await createBestiary({
    packs: [basicPack],
    workers: 1,
    worker: () => new Worker(new URL('./compile.worker.ts', import.meta.url), { type: 'module' }),
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#444444', 2));
  const camera = new THREE.PerspectiveCamera(45, canvas.width / canvas.height, 0.1, 100);
  camera.position.set(4, 2.5, 5);
  camera.lookAt(0, 0.5, 1);
  const stalker = await bestiary.spawn(creature, { quality: 'low' });
  scene.add(stalker.object);
  stalker.controller.moveTo({ x: 0, z: 3 });
  let triangles = 0;
  for (let frame = 0; frame < 30; frame++) {
    bestiary.update(1 / 30, { camera });
    await renderer.renderAsync(scene, camera);
    triangles = Math.max(triangles, renderer.info.render.triangles);
  }
  return {
    ok: triangles > 0 && stalker.controller.position.z > 0.05,
    backend,
    triangles,
    bones: stalker.compiled.bones.names.length,
    walked: stalker.controller.position.z,
  };
}

main().then(
  (smoke) => {
    window.smoke = smoke;
  },
  (error: unknown) => {
    window.smoke = {
      ok: false,
      error: error instanceof Error ? (error.stack ?? error.message) : String(error),
    };
  },
);
