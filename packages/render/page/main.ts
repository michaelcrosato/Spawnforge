import {
  compileCreature,
  createRegistry,
  formatIssue,
  resolveBlueprint,
  validateBlueprint,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { createCreatureObject, createRenderer } from '@spawnforge/three';
import * as THREE from 'three';
import type { RenderRequest, RenderResponse, View } from './protocol.ts';

const registry = createRegistry([basicPack]);
const ALL_VIEWS: View[] = ['three-quarter', 'side', 'front', 'top'];
const TITLES: Record<View, string> = {
  front: 'front',
  side: 'side',
  top: 'top',
  'three-quarter': '3/4',
};

declare global {
  interface Window {
    spawnforgeReady?: boolean;
    spawnforgeRender?: (request: RenderRequest) => Promise<RenderResponse>;
  }
}

const canvas = document.createElement('canvas');
document.body.append(canvas);
const { renderer, backend } = await createRenderer(canvas, { forceWebGL: true });
renderer.shadowMap.enabled = true;
renderer.setPixelRatio(1);

function niceBar(target: number): number {
  const steps = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
  return steps.reduce(
    (best, s) => (Math.abs(Math.log(s / target)) < Math.abs(Math.log(best / target)) ? s : best),
    1,
  );
}

const fmt = (m: number) =>
  m >= 1 ? `${m.toFixed(m >= 10 ? 0 : 1)} m` : `${Math.round(m * 100)} cm`;

window.spawnforgeRender = async (request) => {
  const size = request.size ?? 512;
  const views = request.views ?? ALL_VIEWS;
  const result = validateBlueprint(request.blueprint, registry, { minimal: false });
  if (!result.ok || !result.creature) {
    throw new Error(`invalid blueprint: ${result.errors.map(formatIssue).join('; ')}`);
  }
  const t0 = performance.now();
  const compiled = compileCreature(resolveBlueprint(request.blueprint, registry), registry, {
    quality: request.quality ?? 'medium',
  });
  const compileMs = performance.now() - t0;
  const creature = createCreatureObject(compiled, registry);
  for (const name of request.debug?.hide ?? []) creature.meshes[name].visible = false;
  renderer.shadowMap.enabled = request.debug?.shadows ?? true;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e8eeff', '#4a4034', 1.15));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  const rim = new THREE.DirectionalLight('#b8c8ff', 1.1);
  scene.add(key, key.target, rim, rim.target);
  scene.add(creature.object);

  const [x0, y0, z0] = compiled.bounds.min;
  const [x1, y1, z1] = compiled.bounds.max;
  const min = new THREE.Vector3(x0, y0, z0);
  const max = new THREE.Vector3(x1, y1, z1);
  const centre = min.clone().add(max).multiplyScalar(0.5);
  const extent = max.clone().sub(min);
  const span = Math.max(extent.x, extent.y, extent.z);

  key.position.copy(centre).add(new THREE.Vector3(span * 1.2, span * 2.2, span * 1.6));
  key.target.position.copy(centre);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera as THREE.OrthographicCamera;
  sc.left = sc.bottom = -span;
  sc.right = sc.top = span;
  sc.near = 0.01;
  sc.far = span * 8;
  rim.position.copy(centre).add(new THREE.Vector3(-span * 1.5, span * 0.8, -span * 1.8));
  rim.target.position.copy(centre);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(span * 2.5, 64),
    new THREE.MeshStandardMaterial({ color: '#3a3f47', roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  const grid = new THREE.GridHelper(
    span * 5,
    Math.round((span * 5) / niceBar(span / 4)),
    '#5a616c',
    '#474d57',
  );
  grid.position.y = 0.001;
  scene.add(ground, grid);

  renderer.setSize(size, size, false);
  const sheet = document.createElement('canvas');
  const header = 44;
  const cols = views.length >= 2 ? 2 : 1;
  const rows = Math.ceil(views.length / cols);
  sheet.width = cols * size;
  sheet.height = rows * size + header;
  const ctx = sheet.getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = '#16181c';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '600 18px system-ui, sans-serif';
  const title = request.anonymous ? '' : compiled.name;
  ctx.fillText(title, 14, 28);
  const nameWidth = title ? ctx.measureText(title).width : -18;
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#aab';
  ctx.fillText(
    `${fmt(extent.z)} long · ${fmt(max.y)} tall · ${fmt(extent.x)} wide`,
    14 + nameWidth + 18,
    28,
  );

  const r0 = performance.now();
  for (const [index, view] of views.entries()) {
    const half = span * 0.6;
    let camera: THREE.Camera;
    if (view === 'three-quarter') {
      const persp = new THREE.PerspectiveCamera(32, 1, span * 0.01, span * 20);
      persp.position.copy(centre).add(new THREE.Vector3(span * 1.25, span * 0.7, span * 1.55));
      persp.lookAt(centre);
      camera = persp;
    } else {
      const ortho = new THREE.OrthographicCamera(-half, half, half, -half, span * 0.01, span * 20);
      if (view === 'front') ortho.position.set(centre.x, centre.y, max.z + span * 2);
      if (view === 'side') ortho.position.set(max.x + span * 2, centre.y, centre.z);
      if (view === 'top') {
        ortho.position.set(centre.x, max.y + span * 2, centre.z);
        ortho.up.set(0, 0, 1);
      }
      ortho.lookAt(centre);
      camera = ortho;
    }
    ground.visible = view !== 'top' && view !== 'front';
    grid.visible = view !== 'front';
    scene.background = new THREE.Color(view === 'top' ? '#2b2f36' : '#262a30');
    camera.updateMatrixWorld();
    await renderer.renderAsync(scene, camera);
    const x = (index % cols) * size;
    const y = header + Math.floor(index / cols) * size;
    ctx.drawImage(renderer.domElement, x, y, size, size);
    ctx.strokeStyle = '#111';
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 8, y + 8, 46, 20);
    ctx.fillStyle = '#ddd';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(TITLES[view], x + 14, y + 22);

    if (view === 'side' || view === 'front' || view === 'top') {
      const bar = niceBar(span / 3);
      const px = (bar / (2 * half)) * size;
      ctx.fillStyle = '#eee';
      ctx.fillRect(x + 14, y + size - 22, px, 4);
      ctx.fillRect(x + 14, y + size - 28, 2, 10);
      ctx.fillRect(x + 14 + px - 2, y + size - 28, 2, 10);
      ctx.fillText(fmt(bar), x + 20 + px, y + size - 16);
    }
    if (request.labels && (view === 'side' || view === 'three-quarter')) {
      const placed: { lx: number; ly: number }[] = [];
      ctx.font = '11px ui-monospace, monospace';
      for (const marker of compiled.markers) {
        if (view === 'side' && marker.position[0] < -extent.x * 0.15) continue;
        const p = new THREE.Vector3(...marker.position).project(camera);
        const sx = x + (p.x * 0.5 + 0.5) * size;
        const sy = y + (-p.y * 0.5 + 0.5) * size;
        let ly = sy - 14;
        while (placed.some((q) => Math.abs(q.ly - ly) < 12 && Math.abs(q.lx - sx) < 70)) ly -= 12;
        ly = Math.max(y + 40, ly);
        placed.push({ lx: sx, ly });
        const colour =
          marker.kind === 'part' ? '#ffd166' : marker.kind === 'limb' ? '#7fdbff' : '#c3f584';
        ctx.strokeStyle = colour;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 6, ly + 3);
        ctx.stroke();
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fill();
        const w = ctx.measureText(marker.id).width;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(sx + 6, ly - 8, w + 6, 13);
        ctx.fillStyle = colour;
        ctx.fillText(marker.id, sx + 9, ly + 2);
      }
    }
  }
  const renderMs = performance.now() - r0;
  creature.dispose();
  ground.geometry.dispose();
  grid.geometry.dispose();
  const t = compiled.stats.triangles;
  return {
    png: sheet.toDataURL('image/png'),
    width: sheet.width,
    height: sheet.height,
    info: {
      name: compiled.name,
      length: extent.z,
      height: max.y,
      width: extent.x,
      triangles: t.skin + t.parts + t.eyes,
      compileMs,
      renderMs,
      backend,
      warnings: compiled.warnings.map(formatIssue),
    },
  };
};
window.spawnforgeReady = true;
