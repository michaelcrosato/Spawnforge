/**
 * Card thumbnails, rendered in the page (docs/design/12.2-gallery.md): one off-screen renderer
 * draws each creature from three-quarters as its card scrolls into view, one at a time, so the
 * gallery needs no committed renders beyond the examples' and is never stale.
 */
import type { CompiledCreature, Registry } from '@spawnforge/core';
import { createCreatureObject, createRenderer, type WorkerCompiler } from '@spawnforge/three';
import * as THREE from 'three';

const SIZE = 256;

/** Frames a creature from three-quarters, front left and a little above, as the renders do. */
export function frame(camera: THREE.PerspectiveCamera, compiled: CompiledCreature): void {
  // The rest pose's bounds: wings rest folded.
  const bounds = compiled.bounds;
  const [x0, y0, z0] = bounds.min;
  const [x1, y1, z1] = bounds.max;
  const centre = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  const radius = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2;
  // The bounding sphere just fits; long bodies leave room, so come a little closer.
  const distance = (0.8 * radius) / Math.sin(((camera.fov / 2) * Math.PI) / 180);
  camera.position
    .copy(centre)
    .add(new THREE.Vector3(1, 0.55, 1.1).normalize().multiplyScalar(distance));
  camera.near = distance / 100;
  camera.far = distance * 4;
  camera.lookAt(centre);
  camera.updateProjectionMatrix();
}

export function lights(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight('#e8eeff', '#4a4034', 1.2));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.set(3, 6, 4);
  scene.add(key);
}

export interface Thumbnails {
  /** Renders the thumbnail when `img` comes into view. */
  watch(img: HTMLImageElement, blueprint: () => Promise<unknown>): void;
  dispose(): void;
}

export async function createThumbnails(
  compiler: WorkerCompiler,
  registry: Registry,
): Promise<Thumbnails> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const { renderer } = await createRenderer(canvas);
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  lights(scene);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  const scratch = document.createElement('canvas');
  scratch.width = scratch.height = SIZE;
  const queue: { img: HTMLImageElement; blueprint: () => Promise<unknown> }[] = [];
  let running = false;

  const draw = async (blueprint: unknown): Promise<string> => {
    const { compiled } = await compiler.compile(blueprint, 'low');
    const creature = createCreatureObject(compiled, registry);
    scene.add(creature.object);
    frame(camera, compiled);
    await renderer.renderAsync(scene, camera);
    // Copied out at once, before the canvas is drawn again.
    const ctx = scratch.getContext('2d') as CanvasRenderingContext2D;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(canvas, 0, 0);
    scene.remove(creature.object);
    creature.dispose();
    return scratch.toDataURL('image/png');
  };
  const next = async () => {
    if (running) return;
    running = true;
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        job.img.src = await draw(await job.blueprint());
        job.img.alt = job.img.dataset.name ?? '';
        job.img.dataset.rendered = 'true';
      } catch (error) {
        job.img.alt = `could not render: ${(error as Error).message}`;
        job.img.dataset.rendered = 'error';
      }
    }
    running = false;
  };
  const observer = new IntersectionObserver((seen) => {
    for (const entry of seen) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      const job = pending.get(entry.target as HTMLImageElement);
      if (job) queue.push(job);
    }
    void next();
  });
  const pending = new Map<
    HTMLImageElement,
    { img: HTMLImageElement; blueprint: () => Promise<unknown> }
  >();
  return {
    watch(img, blueprint) {
      pending.set(img, { img, blueprint });
      observer.observe(img);
    },
    dispose() {
      observer.disconnect();
      queue.length = 0;
      renderer.dispose();
    },
  };
}
