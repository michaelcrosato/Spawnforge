/**
 * The creature page's live viewer: the creature idling (breathing, blinking, looking about) on a
 * plain floor, or swimming in place if it only swims, turning slowly; drag to orbit, and a
 * button per action it can perform.
 */
import { type CompiledCreature, MotionController, openSea, type Registry } from '@spawnforge/core';
import { applyPose, createCreatureObject, createRenderer } from '@spawnforge/three';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { frame, lights } from './thumbs.ts';

export interface Viewer {
  /** The actions it can perform, for buttons. */
  readonly actions: readonly string[];
  act(id: string): void;
  dispose(): void;
}

export async function createViewer(
  canvas: HTMLCanvasElement,
  compiled: CompiledCreature,
  registry: Registry,
): Promise<Viewer> {
  const { renderer } = await createRenderer(canvas, {
    forceWebGL: new URLSearchParams(location.search).has('webgl'),
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1d22');
  lights(scene);
  const swimsOnly = !compiled.motion.gaits.some((g) => (g.medium ?? 'land') === 'land');
  const sea = swimsOnly ? openSea(compiled.scale) : undefined;
  if (!sea) {
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(compiled.scale * 6, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#3a3d44', roughness: 1 }),
    );
    scene.add(floor);
  }
  const creature = createCreatureObject(compiled, registry);
  scene.add(creature.object);
  const controller = new MotionController(compiled, { registry });
  controller.place(0, 0, 0, sea?.ground, sea?.water, sea ? { y: -compiled.scale * 0.5 } : {});
  const world = sea ? { ground: sea.ground, water: sea.water } : {};

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 200);
  frame(camera, compiled);
  const controls = new OrbitControls(camera, canvas);
  const [x0, y0, z0] = compiled.bounds.min;
  const [x1, y1, z1] = compiled.bounds.max;
  controls.target.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  controls.enableDamping = true;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.6;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const timer = new THREE.Timer();
  renderer.setAnimationLoop((time) => {
    timer.update(time);
    controller.update(Math.min(timer.getDelta(), 0.1), world);
    applyPose(creature, controller.pose);
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    actions: controller.actions(),
    act(id) {
      // Bites and looks at a spot in front of the creature, at its head's height.
      const head = new THREE.Vector3(0, compiled.rig.hipHeight, compiled.scale * 1.2);
      controller.act(id, { target: id === 'look' ? camera.position : head });
    },
    dispose() {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.dispose();
      scene.remove(creature.object);
      creature.dispose();
      renderer.dispose();
    },
  };
}
