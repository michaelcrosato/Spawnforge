import { bakeClips, compileCreature, type Registry, resolveBlueprint } from '@spawnforge/core';
import { CrowdDraw, clipRows, createCreatureObject } from '@spawnforge/three';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import type { CrowdRequest, CrowdResponse } from '../src/protocol.ts';

/**
 * The crowd's oracle (docs/design/11.3-crowds.md): one creature drawn by its own skeleton, posed
 * as the baked level of detail poses a clip's frame, and the same creature drawn by its species'
 * crowd at that frame, from the same camera; the two must give the same pixels.
 */
export async function crowdCheck(
  deps: { readonly renderer: WebGPURenderer; readonly registry: Registry },
  request: CrowdRequest,
): Promise<CrowdResponse> {
  const { renderer, registry } = deps;
  const compiled = compileCreature(resolveBlueprint(request.blueprint, registry), registry, {
    quality: request.quality ?? 'low',
  });
  // The clips the runtime bakes for its distant level of detail.
  const names = ['idle', ...compiled.motion.gaits.map((g) => g.id)];
  const clips = bakeClips(compiled, registry, { clips: names, idleSeconds: 2 });
  const clip =
    clips.find((c) => c.name === (request.clip ?? compiled.motion.gaits[0]?.id)) ?? clips[0];
  if (!clip) throw new Error('no clip to pose');
  const frame = Math.min(clip.frames - 1, request.frame ?? Math.floor(clip.frames / 3));
  const turn = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    request.heading ?? 0.6,
  );
  const at = new THREE.Vector3(request.x ?? 0.4, 0, request.z ?? -0.3);

  // By its own bones, as the runtime's `applyClip` poses them.
  const own = createCreatureObject(compiled, registry);
  const n = own.bones.length;
  own.bones.forEach((bone, b) => {
    bone.quaternion.fromArray(clip.rotations, (frame * n + b) * 4);
    bone.position.fromArray(clip.positions, (frame * n + b) * 3);
  });
  const root = own.bones[compiled.rig.root];
  root?.position.add(at);
  root?.quaternion.premultiply(turn);
  // Crowds draw no fur shells, as the baked level of detail hides them.
  if (own.meshes.fur) own.meshes.fur.visible = false;

  // By the crowd, from the clip's rows.
  const rows = clipRows(compiled, clips);
  const draw = new CrowdDraw(compiled, registry, rows, { capacity: 1 });
  const row = (rows.first.get(clip) ?? 0) + frame;
  draw.write([{ x: at.x, y: at.y, z: at.z, rotation: turn, row0: row, row1: row, blend: 0 }], 0);

  const size = request.size ?? 384;
  const { min, max } = compiled.bounds;
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const centre = new THREE.Vector3(
    (min[0] + max[0]) / 2 + at.x,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2 + at.z,
  );
  const camera = new THREE.PerspectiveCamera(30, 1, span * 0.01, span * 20);
  camera.position.copy(centre).add(new THREE.Vector3(1.3, 0.8, 1.6).multiplyScalar(span * 1.1));
  camera.lookAt(centre);
  const a = await shoot(renderer, own.object, camera, centre, span, size);
  const b = await shoot(renderer, draw.object, camera, centre, span, size);
  own.dispose();
  draw.dispose();

  let differing = 0;
  let covered = 0;
  let sum = 0;
  for (let p = 0; p < size * size; p++) {
    let worst = 0;
    for (let c = 0; c < 3; c++)
      worst = Math.max(worst, Math.abs((a[p * 4 + c] as number) - (b[p * 4 + c] as number)));
    sum += worst / 255;
    if (worst > 2) differing++;
    if ((a[p * 4 + 3] as number) > 0) covered++;
  }
  return {
    clip: clip.name,
    frame,
    differing: differing / (size * size),
    mean: sum / (size * size),
    covered: covered / (size * size),
    ...(request.images ? { images: [png(a, size), png(b, size)] as const } : {}),
  };
}

const scratch = document.createElement('canvas');

/** Renders an object on a transparent background in a fixed light; returns its RGBA pixels. */
async function shoot(
  renderer: WebGPURenderer,
  object: THREE.Object3D,
  camera: THREE.Camera,
  centre: THREE.Vector3,
  span: number,
  size: number,
): Promise<Uint8ClampedArray> {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e8eeff', '#4a4034', 1.15));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  key.position.copy(centre).add(new THREE.Vector3(span * 1.2, span * 2.2, span * 1.6));
  key.target.position.copy(centre);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -span;
  sc.right = sc.top = span;
  sc.near = 0.01;
  sc.far = span * 8;
  scene.add(key, key.target, object);
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  await renderer.renderAsync(scene, camera);
  scene.remove(object);
  key.dispose();
  scratch.width = size;
  scratch.height = size;
  const ctx = scratch.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(renderer.domElement, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

function png(pixels: Uint8ClampedArray, size: number): string {
  scratch.width = size;
  scratch.height = size;
  const ctx = scratch.getContext('2d') as CanvasRenderingContext2D;
  ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), size, size), 0, 0);
  return scratch.toDataURL('image/png');
}
