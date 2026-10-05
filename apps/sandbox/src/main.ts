import { FORMAT } from '@spawnforge/core';
import { createRenderer, placeholderSkinMaterial } from '@spawnforge/three';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Placeholder scene: proves the workspace, Three.js r186 and TSL run end to end.
// Compiled creatures replace the capsule once the pipeline lands.

const canvas = document.querySelector<HTMLCanvasElement>('#view');
const status = document.querySelector<HTMLDivElement>('#status');
if (!canvas || !status) throw new Error('index.html is missing #view or #status');

async function main(canvas: HTMLCanvasElement, status: HTMLDivElement): Promise<void> {
  const forceWebGL = new URLSearchParams(location.search).has('webgl');
  const { renderer, backend } = await createRenderer(canvas, { forceWebGL });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1b1d22');
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#3a3226', 1.2));
  const sun = new THREE.DirectionalLight('#ffffff', 2.5);
  sun.position.set(3, 5, 2);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: '#3b4048', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground, new THREE.GridHelper(10, 20, '#555b66', '#2c3038'));

  // A 1.2 m torso stand-in, facing +Z like every creature (glTF conventions: metres, Y up).
  // The geometry itself is turned so local Y stays up and the belly-to-back shading reads right.
  const radius = 0.25;
  const torso = new THREE.CapsuleGeometry(radius, 1.2 - 2 * radius, 8, 24).rotateX(Math.PI / 2);
  const body = new THREE.Mesh(torso, placeholderSkinMaterial('#5b6b3a', '#d8cfa0', radius));
  body.position.y = 0.6;
  scene.add(body);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);
  camera.position.set(2.2, 1.4, 2.2);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;

  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  status.textContent = `Spawnforge sandbox · ${backend} · ${FORMAT}`;
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

main(canvas, status).catch((error: unknown) => {
  status.textContent = `Failed to start: ${error instanceof Error ? error.message : String(error)}`;
  throw error;
});
