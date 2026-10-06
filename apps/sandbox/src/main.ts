import { compileCreature, createRegistry, FORMAT, resolveBlueprint } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { type CreatureObject, createCreatureObject, createRenderer } from '@spawnforge/three';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const registry = createRegistry([basicPack]);
const examples = import.meta.glob('../../../examples/*.json', { eager: true, import: 'default' }) as Record<string, unknown>;
const byName = new Map(Object.entries(examples).map(([path, json]) => [path.split('/').at(-1)?.replace('.json', '') ?? path, json]));

const canvas = document.querySelector<HTMLCanvasElement>('#view');
const status = document.querySelector<HTMLDivElement>('#status');
const picker = document.querySelector<HTMLSelectElement>('#picker');
if (!canvas || !status || !picker) throw new Error('index.html is missing #view, #status or #picker');

async function main(canvas: HTMLCanvasElement, status: HTMLDivElement, picker: HTMLSelectElement): Promise<void> {
  const params = new URLSearchParams(location.search);
  const { renderer, backend } = await createRenderer(canvas, { forceWebGL: params.has('webgl') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1d22');
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a3226', 1.1));
  const sun = new THREE.DirectionalLight('#ffffff', 2.6);
  sun.position.set(3, 6, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -4;
  sun.shadow.camera.right = sun.shadow.camera.top = 4;
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: '#3b4048', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground, new THREE.GridHelper(20, 40, '#555b66', '#2c3038'));

  const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;

  let current: CreatureObject | undefined;
  const show = (name: string) => {
    const blueprint = byName.get(name);
    if (!blueprint) return;
    const spec = resolveBlueprint(blueprint, registry);
    const t0 = performance.now();
    const compiled = compileCreature(spec, registry, { quality: (params.get('quality') as 'low' | 'medium' | 'high') ?? 'medium' });
    const ms = performance.now() - t0;
    current?.dispose();
    if (current) scene.remove(current.object);
    current = createCreatureObject(compiled, registry);
    scene.add(current.object);
    const [x0, y0, z0] = compiled.bounds.min;
    const [x1, y1, z1] = compiled.bounds.max;
    const centre = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const size = Math.max(x1 - x0, y1 - y0, z1 - z0);
    controls.target.copy(centre);
    camera.position.copy(centre).add(new THREE.Vector3(size * 1.1, size * 0.55, size * 1.25));
    const t = compiled.stats.triangles;
    status.textContent = `${compiled.name} · ${t.skin + t.parts + t.eyes} tris · compiled in ${ms.toFixed(0)} ms · ${backend} · ${FORMAT}`;
  };

  for (const name of byName.keys()) picker.add(new Option(name, name));
  picker.value = params.get('creature') ?? 'ridgeback-stalker';
  picker.addEventListener('change', () => show(picker.value));
  show(picker.value);

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

main(canvas, status, picker).catch((error: unknown) => {
  status.textContent = `Failed to start: ${error instanceof Error ? error.message : String(error)}`;
  throw error;
});
