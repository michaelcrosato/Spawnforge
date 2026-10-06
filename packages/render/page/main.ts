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
const ALL_VIEWS: View[] = ['three-quarter', 'side', 'head', 'front', 'top', 'rear'];
const TITLES: Record<View, string> = {
  front: 'front',
  side: 'side',
  top: 'top',
  'three-quarter': '3/4',
  head: 'head',
  rear: 'rear 3/4',
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
  const cols = views.length >= 5 ? 3 : views.length >= 2 ? 2 : 1;
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
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
    (c) => new THREE.Vector3(c & 1 ? max.x : min.x, c & 2 ? max.y : min.y, c & 4 ? max.z : min.z),
  );
  const headMarker = compiled.markers.find((m) => m.id === 'head');
  const headBone = compiled.rig.head;
  const headSize =
    Math.max(compiled.bones.lengths[headBone] ?? 0, compiled.bones.radii[headBone] ?? 0) +
    (compiled.bones.radii[headBone] ?? 0);
  const headCentre = new THREE.Vector3().fromArray(compiled.bones.positions, headBone * 3);
  if (headMarker) headCentre.lerp(new THREE.Vector3(...headMarker.position), 0.5);

  for (const [index, view] of views.entries()) {
    let camera: THREE.Camera;
    let half = span * 0.6;
    if (view === 'three-quarter' || view === 'rear' || view === 'head') {
      const persp = new THREE.PerspectiveCamera(30, 1, span * 0.002, span * 20);
      if (view === 'head') {
        const reach = Math.max(headSize * 2.6, span * 0.08);
        persp.position
          .copy(headCentre)
          .add(new THREE.Vector3(reach * 0.75, reach * 0.35, reach * 0.95));
        persp.lookAt(headCentre);
        half = reach * Math.tan((15 * Math.PI) / 180);
      } else {
        const dir =
          view === 'rear'
            ? new THREE.Vector3(-1.25, 0.75, -1.55)
            : new THREE.Vector3(1.25, 0.7, 1.55);
        persp.position.copy(centre).addScaledVector(dir, span);
        persp.lookAt(centre);
      }
      camera = persp;
    } else {
      // Fit each orthographic view to the creature's extent in that view.
      const axis =
        view === 'front'
          ? ([0, 1] as const)
          : view === 'side'
            ? ([2, 1] as const)
            : ([0, 2] as const);
      const ext = [extent.x, extent.y, extent.z];
      half = (Math.max(ext[axis[0]] as number, ext[axis[1]] as number) / 2) * 1.18 + span * 0.02;
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
    void corners;
    ground.visible = view !== 'top' && view !== 'front' && view !== 'head';
    grid.visible = view !== 'front' && view !== 'head';
    scene.background = new THREE.Color(view === 'top' ? '#2b2f36' : '#262a30');
    camera.updateMatrixWorld();
    await renderer.renderAsync(scene, camera);
    const x = (index % cols) * size;
    const y = header + Math.floor(index / cols) * size;
    ctx.drawImage(renderer.domElement, x, y, size, size);
    ctx.strokeStyle = '#111';
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 8, y + 8, 58, 20);
    ctx.fillStyle = '#ddd';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(TITLES[view], x + 14, y + 22);

    if (view === 'side' || view === 'front' || view === 'top' || view === 'head') {
      const bar = niceBar((half * 2) / 3.5);
      const px = (bar / (2 * half)) * size;
      ctx.fillStyle = '#eee';
      ctx.fillRect(x + 14, y + size - 22, px, 4);
      ctx.fillRect(x + 14, y + size - 28, 2, 10);
      ctx.fillRect(x + 14 + px - 2, y + size - 28, 2, 10);
      ctx.fillText(fmt(bar), x + 20 + px, y + size - 16);
    }
    if (request.labels && (view === 'side' || view === 'three-quarter' || view === 'head')) {
      // Labels stack in columns at the panel's edges, joined to their points by leader lines.
      const visible = compiled.markers
        .filter((m) => !(view === 'side' && m.position[0] < -extent.x * 0.15))
        .filter(
          (m) =>
            view !== 'head' ||
            new THREE.Vector3(...m.position).distanceTo(headCentre) < headSize * 2.2,
        )
        .map((m) => {
          const p = new THREE.Vector3(...m.position).project(camera);
          return { m, sx: x + (p.x * 0.5 + 0.5) * size, sy: y + (-p.y * 0.5 + 0.5) * size };
        })
        .filter((v) => v.sx > x + 4 && v.sx < x + size - 4 && v.sy > y + 4 && v.sy < y + size - 4)
        .sort((a, b) => a.sy - b.sy);
      ctx.font = '11px ui-monospace, monospace';
      for (const side of ['left', 'right'] as const) {
        const group = visible.filter((v) => v.sx < x + size / 2 === (side === 'left'));
        let next = y + 34;
        for (const v of group) {
          const ly = Math.max(next, Math.min(y + size - 34, v.sy));
          next = ly + 13;
          const w = ctx.measureText(v.m.id).width;
          const lx = side === 'left' ? x + 6 : x + size - w - 12;
          const colour =
            v.m.kind === 'part' ? '#ffd166' : v.m.kind === 'limb' ? '#7fdbff' : '#c3f584';
          ctx.strokeStyle = colour;
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(v.sx, v.sy);
          ctx.lineTo(side === 'left' ? lx + w + 6 : lx - 2, ly - 3);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = colour;
          ctx.beginPath();
          ctx.arc(v.sx, v.sy, 2.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillRect(lx - 2, ly - 11, w + 7, 13);
          ctx.fillStyle = colour;
          ctx.fillText(v.m.id, lx + 1, ly - 1);
        }
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
