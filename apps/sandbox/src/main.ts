import {
  type CompiledCreature,
  createRegistry,
  createRng,
  FORMAT,
  MotionController,
  testCourse,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import {
  applyPose,
  type CreatureObject,
  createCreatureObject,
  createRenderer,
  createWorkerCompiler,
} from '@spawnforge/three';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FootstepRings, terrainMesh } from './terrain.ts';

const registry = createRegistry([basicPack]);
const examples = import.meta.glob('../../../examples/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;
const byName = new Map(
  Object.entries(examples).map(([path, json]) => [
    path.split('/').at(-1)?.replace('.json', '') ?? path,
    json,
  ]),
);

const $ = <T extends HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`index.html is missing ${selector}`);
  return element;
};

/** A creature on the course: its meshes, its motion controller and its wandering. */
interface Walker {
  readonly name: string;
  readonly compiled: CompiledCreature;
  readonly creature: CreatureObject;
  readonly controller: MotionController;
  readonly ms: number;
  rest: number;
}

async function main(): Promise<void> {
  const canvas = $<HTMLCanvasElement>('#view');
  const status = $<HTMLDivElement>('#status');
  const picker = $<HTMLSelectElement>('#picker');
  const wander = $<HTMLInputElement>('#wander');
  const herd = $<HTMLInputElement>('#herd');
  const pace = $<HTMLInputElement>('#pace');
  const paceLabel = $<HTMLSpanElement>('#pace-value');

  const params = new URLSearchParams(location.search);
  const { renderer, backend } = await createRenderer(canvas, { forceWebGL: params.has('webgl') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1d22');
  scene.fog = new THREE.Fog('#1b1d22', 18, 40);
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a3226', 1.1));
  const sun = new THREE.DirectionalLight('#ffffff', 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  scene.add(sun, sun.target);

  const course = testCourse(Number(params.get('terrain') ?? 1), 0.35, 2.5);
  const ground = terrainMesh(course.height);
  scene.add(ground);
  const rings = new FootstepRings();
  scene.add(rings.group);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.48;

  const compiler = createWorkerCompiler(
    Array.from(
      { length: Math.min(4, navigator.hardwareConcurrency || 2) },
      () => new Worker(new URL('./compile.worker.ts', import.meta.url), { type: 'module' }),
    ),
  );
  const quality = (params.get('quality') as 'low' | 'medium' | 'high' | null) ?? 'medium';
  const rng = createRng(7).stream('wander');
  let walkers: Walker[] = [];
  let focus: Walker | undefined;
  let generation = 0;

  const spawn = async (name: string, at: { x: number; z: number; heading: number }) => {
    const { compiled, ms } = await compiler.compile(byName.get(name), quality);
    const creature = createCreatureObject(compiled, registry);
    const controller = new MotionController(compiled);
    controller.position.set(at.x, course.height(at.x, at.z), at.z);
    controller.heading = at.heading;
    controller.update(0, { ground: course });
    applyPose(creature, controller.pose);
    return { name, compiled, creature, controller, ms, rest: 0.5 } satisfies Walker;
  };

  const show = async () => {
    const run = ++generation;
    status.textContent = 'Compiling…';
    const names = herd.checked ? [...byName.keys()] : [picker.value];
    const spawned = await Promise.all(
      names.map((name, i) => {
        const angle = (i / names.length) * Math.PI * 2;
        const r = names.length > 1 ? 3 : 0;
        return spawn(name, { x: Math.sin(angle) * r, z: Math.cos(angle) * r, heading: angle });
      }),
    );
    if (run !== generation) {
      for (const w of spawned) w.creature.dispose();
      return;
    }
    for (const w of walkers) {
      scene.remove(w.creature.object);
      w.creature.dispose();
    }
    walkers = spawned;
    for (const w of walkers) scene.add(w.creature.object);
    focus = walkers.find((w) => w.name === picker.value) ?? walkers[0];
    if (focus) {
      const [x0, y0, z0] = focus.compiled.bounds.min;
      const [x1, y1, z1] = focus.compiled.bounds.max;
      const size = Math.max(x1 - x0, y1 - y0, z1 - z0);
      const centre = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
      controls.target.copy(centre).add(focus.controller.position);
      camera.position
        .copy(controls.target)
        .add(new THREE.Vector3(size * 1.6, size * 0.8, size * 1.8));
    }
    updatePaceLabel();
  };

  /** The speed slider: 0 is a slow walk, 1 the fastest gait; the middle is the creature's pace. */
  const speedFor = (w: Walker) => {
    const t = Number(pace.value) / 100;
    const walk = w.controller.paceSpeed();
    const fast = Math.max(walk, w.controller.maxSpeed());
    return t <= 0.5 ? walk * (0.3 + 1.4 * t) : walk + (fast - walk) * (t - 0.5) * 2;
  };
  const updatePaceLabel = () => {
    paceLabel.textContent = focus ? `${speedFor(focus).toFixed(2)} m/s` : '';
  };
  pace.addEventListener('input', updatePaceLabel);

  // Click the ground to send the creature (or the whole herd) there.
  const raycaster = new THREE.Raycaster();
  let down: { x: number; y: number } | undefined;
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObject(ground)[0];
    if (!hit) return;
    walkers.forEach((w, i) => {
      const spread = walkers.length > 1 ? 1.2 * Math.sqrt(i) : 0;
      const angle = i * 2.4;
      w.controller.moveTo(
        { x: hit.point.x + Math.sin(angle) * spread, z: hit.point.z + Math.cos(angle) * spread },
        { speed: speedFor(w) },
      );
      w.rest = 4;
    });
  });

  for (const name of byName.keys()) picker.add(new Option(name, name));
  picker.value = params.get('creature') ?? 'ridgeback-stalker';
  herd.checked = params.has('herd');
  picker.addEventListener('change', () => void show());
  herd.addEventListener('change', () => void show());
  await show();

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  const clock = new THREE.Timer();
  const previous = new THREE.Vector3();
  renderer.setAnimationLoop((time) => {
    clock.update(time);
    const dt = Math.min(clock.getDelta(), 0.1);
    const t0 = performance.now();
    for (const w of walkers) {
      const c = w.controller;
      // Wander: after a pause, stroll to a random spot on the course.
      if (wander.checked && c.speed === 0) {
        w.rest -= dt;
        if (w.rest <= 0) {
          const angle = rng.float(0, Math.PI * 2);
          const distance = rng.float(2, 7);
          c.moveTo(
            {
              x: THREE.MathUtils.clamp(c.position.x + Math.sin(angle) * distance, -14, 14),
              z: THREE.MathUtils.clamp(c.position.z + Math.cos(angle) * distance, -14, 14),
            },
            { speed: speedFor(w) },
          );
          w.rest = rng.float(1, 4);
        }
      }
      if (w === focus) previous.copy(c.position);
      for (const event of c.update(dt, { ground: course })) {
        if (event.type === 'footstep' && event.position)
          rings.spawn(event.position, w.compiled.scale * 0.12);
      }
      applyPose(w.creature, c.pose);
      // The camera follows the focused creature.
      if (w === focus) {
        const moved = c.position.clone().sub(previous);
        controls.target.add(moved);
        camera.position.add(moved);
      }
    }
    const motionMs = performance.now() - t0;
    rings.update(dt);
    if (focus) {
      sun.position.copy(focus.controller.position).add(new THREE.Vector3(4, 8, 5));
      sun.target.position.copy(focus.controller.position);
      const t = focus.compiled.stats.triangles;
      status.textContent = [
        focus.compiled.name,
        `${focus.controller.gait?.id ?? 'standing'} ${focus.controller.speed.toFixed(2)} m/s`,
        `${t.skin + t.parts + t.eyes} tris`,
        `compiled in ${focus.ms.toFixed(0)} ms`,
        `motion ${((motionMs / Math.max(1, walkers.length)) * 1000).toFixed(0)} µs/creature`,
        backend,
        FORMAT,
      ].join(' · ');
    }
    controls.update();
    renderer.render(scene, camera);
  });
}

main().catch((error: unknown) => {
  const status = document.querySelector('#status');
  if (status)
    status.textContent = `Failed to start: ${error instanceof Error ? error.message : String(error)}`;
  throw error;
});
