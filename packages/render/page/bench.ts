import { createRng } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { type Creature, createBestiary, createRenderer } from '@spawnforge/three';
import * as THREE from 'three/webgpu';
import type { BenchRequest, BenchResponse, BenchScene } from '../src/protocol.ts';

/**
 * The GPU benchmark (docs/design/11.3-crowds.md): scenes of mixed creatures, each run for a set
 * number of frames, reporting frame times, draw calls, triangles and GPU time where the backend
 * has timestamps. Headless (WebGL 2 in SwiftShader) its numbers say little about a real GPU; the
 * owner runs it in a browser on a laptop (`pnpm bench --open`).
 */

const examples = Object.values(
  import.meta.glob('../../../examples/*.json', { eager: true, import: 'default' }),
) as Record<string, unknown>[];

const SCENES = {
  /** Fully animated, near the camera: walking, turning and acting, fur and membranes. */
  near: { count: 50, from: 4, to: 22, crowds: false },
  /** Distant: baked cycles, each creature its own draw calls. */
  distant: { count: 500, from: 60, to: 160, crowds: false },
  /** Distant, drawn as crowds: instanced per species, level of detail and mesh. */
  crowd: { count: 500, from: 60, to: 160, crowds: true },
} as const;

export async function bench(request: BenchRequest, show?: HTMLElement): Promise<BenchResponse> {
  const width = request.width ?? 1280;
  const height = request.height ?? 720;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width / devicePixelRatio}px`;
  canvas.style.height = `${height / devicePixelRatio}px`;
  (show ?? document.body).append(canvas);
  const { renderer, backend } = await createRenderer(canvas, {
    forceWebGL: request.webgl ?? false,
    trackTimestamp: true,
  });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.shadowMap.enabled = true;
  // Three's animation loop resets the frame's counters on each display frame, which can fall
  // between a render and reading them: reset them by hand, once per measured frame.
  renderer.info.autoReset = false;
  const scenes: BenchScene[] = [];
  try {
    for (const name of request.scenes ?? (Object.keys(SCENES) as (keyof typeof SCENES)[])) {
      const setup = SCENES[name];
      scenes.push(
        await run(renderer, name, {
          ...setup,
          count: request.counts?.[name] ?? setup.count,
          frames: request.frames ?? 300,
          quality: request.quality ?? 'medium',
          width,
          height,
        }),
      );
      if (show) show.dataset.progress = name;
    }
  } finally {
    renderer.dispose();
    canvas.remove();
  }
  return {
    backend,
    width,
    height,
    userAgent: navigator.userAgent,
    gpu: gpuName(),
    scenes,
  };
}

async function run(
  renderer: THREE.WebGPURenderer,
  name: keyof typeof SCENES,
  s: {
    count: number;
    from: number;
    to: number;
    crowds: boolean;
    frames: number;
    quality: 'low' | 'medium' | 'high';
    width: number;
    height: number;
  },
): Promise<BenchScene> {
  const bestiary = await createBestiary({ packs: [basicPack], crowds: s.crowds });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#9fb4c8');
  scene.add(new THREE.HemisphereLight('#e8eeff', '#4a4034', 1.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.position.set(30, 60, 20);
  scene.add(sun);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2),
    new THREE.MeshStandardNodeMaterial({ color: '#6d7a52' }),
  );
  scene.add(ground, bestiary.crowd);
  const camera = new THREE.PerspectiveCamera(50, s.width / s.height, 0.1, 1000);
  camera.position.set(0, 6, 0);
  camera.lookAt(0, 0, -40);
  // Creatures in a fan in front of the camera, from `from` to `to` metres away.
  const rng = createRng(11).stream(`bench-${name}`);
  const creatures: Creature[] = [];
  const spot = () => {
    const r = s.from + (s.to - s.from) * Math.sqrt(rng.next());
    const a = (rng.next() - 0.5) * 1.1;
    return { x: Math.sin(a) * r, z: -Math.cos(a) * r };
  };
  const spawnStarted = performance.now();
  for (let i = 0; i < s.count; i++) {
    const blueprint = examples[i % examples.length];
    const creature = await bestiary.spawn(blueprint, {
      quality: s.quality,
      position: spot(),
      heading: rng.next() * Math.PI * 2,
    });
    scene.add(creature.object);
    creatures.push(creature);
  }
  const spawnMs = performance.now() - spawnStarted;
  const input = { camera, pixels: s.height };
  // Walking about, turning, and now and then an action.
  const wander = (creature: Creature) => {
    const target = spot();
    creature.moveTo(target);
  };
  for (const c of creatures) wander(c);
  // Warm up: shaders compile, baked clips, levels of detail and crowd draws are made (distant
  // creatures join their crowds once their species' levels are ready, all at once).
  const settled = () => !s.crowds || creatures.every((c) => c.lod === 'full' || c.crowded);
  for (let f = 0; f < 60 || (!settled() && f < 600); f++) {
    await nextFrame();
    bestiary.update(1 / 60, input);
    await renderer.renderAsync(scene, camera);
  }
  await renderer.resolveTimestampsAsync('render');
  const frame: number[] = [];
  const update: number[] = [];
  const gpu: number[] = [];
  let calls = 0;
  let triangles = 0;
  for (let f = 0; f < s.frames; f++) {
    if (f % 30 === 0)
      for (const c of creatures) {
        if (rng.next() < 0.1) wander(c);
        // Actions near the camera only: one brings a distant creature to full detail, which is
        // not what the distant scenes measure.
        const actions = c.actions();
        if (s.from < 30 && rng.next() < 0.05 && actions.length > 0)
          c.act(actions[Math.floor(rng.next() * actions.length)] as string);
      }
    // As a game's loop does: the page gets its turn between frames (fetches, timers), untimed.
    await nextFrame();
    renderer.info.reset();
    const t0 = performance.now();
    bestiary.update(1 / 60, input);
    const t1 = performance.now();
    await renderer.renderAsync(scene, camera);
    const ms = await renderer.resolveTimestampsAsync('render');
    frame.push(performance.now() - t0);
    update.push(t1 - t0);
    if (typeof ms === 'number' && ms > 0) gpu.push(ms);
    calls = renderer.info.render.drawCalls;
    triangles = renderer.info.render.triangles;
  }
  const full = creatures.filter((c) => c.lod === 'full').length;
  const crowded = creatures.filter((c) => c.crowded).length;
  const detail = [0, 0, 0, 0];
  for (const c of creatures) detail[c.detail] = (detail[c.detail] ?? 0) + 1;
  bestiary.dispose();
  ground.geometry.dispose();
  return {
    name,
    creatures: s.count,
    species: Math.min(s.count, examples.length),
    quality: s.quality,
    frames: s.frames,
    spawnMs: Math.round(spawnMs),
    frameMs: stats(frame),
    updateMs: stats(update),
    ...(gpu.length > 0 ? { gpuMs: stats(gpu) } : {}),
    drawCalls: calls,
    triangles,
    full,
    crowded,
    detail,
  };
}

/** The next animation frame: rendering in a tight loop would never let the page run its tasks. */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function stats(xs: number[]): { median: number; p95: number; max: number; slow: number } {
  const sorted = [...xs].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
  const median = at(0.5);
  return {
    median: Number(median.toFixed(2)),
    p95: Number(at(0.95).toFixed(2)),
    max: Number((sorted[sorted.length - 1] ?? 0).toFixed(2)),
    // Frames over four times the median: hitches, such as a shader compiled on first use.
    slow: xs.filter((x) => x > 4 * median).length,
  };
}

/** The GPU's name where WebGL tells it (WebGPU's adapter info is not exposed through three). */
function gpuName(): string | undefined {
  const gl = document.createElement('canvas').getContext('webgl2');
  const info = gl?.getExtension('WEBGL_debug_renderer_info');
  return info && gl ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : undefined;
}
