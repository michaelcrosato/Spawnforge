import { type BandJob, type BandResult, bakeTextures } from '@spawnforge/bake';
import { simplifyChain } from '@spawnforge/bake/lod';
import {
  applyRest,
  type BakedTextures,
  bakeClips,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  fingerprint,
  formatIssue,
  type LodChain,
  mainHead,
  Pose,
  parseScenario,
  resolveBlueprint,
  validateBlueprint,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import {
  applyPose,
  buildExportScene,
  createCreatureObject,
  createRenderer,
  lodExporterPlugin,
  stackMaterial,
} from '@spawnforge/three';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import type {
  BenchRequest,
  BenchResponse,
  CrowdRequest,
  CrowdResponse,
  ExportInfo,
  ExportRequest,
  ExportResponse,
  MotionInfo,
  ParityRequest,
  ParityResponse,
  RenderRequest,
  RenderResponse,
  RoundTripRequest,
  RoundTripResponse,
  View,
} from '../src/protocol.ts';
import { bench } from './bench.ts';
import { crowdCheck } from './crowd.ts';
import { diagramHeight, drawFilmstrip } from './filmstrip.ts';
import { roundTrip } from './roundtrip.ts';

const registry = createRegistry([basicPack]);
const ALL_VIEWS: View[] = ['three-quarter', 'side', 'head', 'front', 'top', 'rear'];
const TITLES: Record<View, string> = {
  front: 'front',
  side: 'side',
  top: 'top',
  'three-quarter': '3/4',
  head: 'head',
  rear: 'rear 3/4',
  underside: 'underside',
};

declare global {
  interface Window {
    spawnforgeReady?: boolean;
    spawnforgeRender?: (request: RenderRequest) => Promise<RenderResponse>;
    spawnforgeFingerprint?: (blueprint: unknown, quality: 'low' | 'medium' | 'high') => string;
    spawnforgeExport?: (request: ExportRequest) => Promise<ExportResponse>;
    spawnforgeRoundTrip?: (request: RoundTripRequest) => Promise<RoundTripResponse>;
    spawnforgeCrowd?: (request: CrowdRequest) => Promise<CrowdResponse>;
    spawnforgeBench?: (request: BenchRequest) => Promise<BenchResponse>;
    spawnforgeParity?: (request: ParityRequest) => Promise<ParityResponse>;
    spawnforgeDiff?: (
      a: string,
      b: string,
      threshold: number,
    ) => Promise<{ differing: number; mean: number; sizes: number[] }>;
  }
}

/**
 * Compares two PNGs (data URLs) of the same size: the share of pixels whose colour differs by
 * more than `threshold` (0–255) in any channel, and the mean difference.
 */
window.spawnforgeDiff = async (a, b, threshold) => {
  const load = async (url: string) => {
    const bitmap = await createImageBitmap(await (await fetch(url)).blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  };
  const [x, y] = await Promise.all([load(a), load(b)]);
  if (x.width !== y.width || x.height !== y.height)
    return { differing: 1, mean: 255, sizes: [x.width, x.height, y.width, y.height] };
  let differing = 0;
  let sum = 0;
  for (let i = 0; i < x.data.length; i += 4) {
    let worst = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs((x.data[i + c] as number) - (y.data[i + c] as number));
      sum += d;
      if (d > worst) worst = d;
    }
    if (worst > threshold) differing++;
  }
  const pixels = x.data.length / 4;
  return { differing: differing / pixels, mean: sum / (pixels * 3), sizes: [] };
};

/** Compiles in the browser and returns the golden-test fingerprint (Node must agree). */
window.spawnforgeFingerprint = (blueprint, quality) =>
  fingerprint(compileCreature(resolveBlueprint(blueprint, registry), registry, { quality }));

/** Workers that shade texel bands for texture bakes, kept across exports (decision 5). */
let bakers: Worker[] | undefined;
let nextJob = 0;
const pending = new Map<number, (result: BandResult) => void>();

function bakeWorkers(): Worker[] {
  if (!bakers) {
    const count = Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2));
    bakers = Array.from({ length: count }, () => {
      const worker = new Worker(new URL('./bake-worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ id: number; result: BandResult }>) => {
        pending.get(event.data.id)?.(event.data.result);
        pending.delete(event.data.id);
      };
      return worker;
    });
  }
  return bakers;
}

/** Shades bands on the workers, one band per worker at a time. */
function runBands(jobs: readonly BandJob[]): Promise<BandResult[]> {
  const workers = bakeWorkers();
  return Promise.all(
    jobs.map(
      (job, i) =>
        new Promise<BandResult>((resolve) => {
          const id = nextJob++;
          pending.set(id, resolve);
          (workers[i % workers.length] as Worker).postMessage({ id, job });
        }),
    ),
  );
}

/**
 * Builds a .glb: compiles, bakes clips and texture maps (or vertex colours), and writes binary
 * glTF with Three.js's GLTFExporter (which needs browser APIs, hence the page).
 */
async function buildGlb(
  request: ExportRequest,
  mutate?: (maps: BakedTextures) => BakedTextures,
): Promise<{
  bytes: Uint8Array;
  info: ExportInfo;
  compiled: CompiledCreature;
  maps?: BakedTextures;
}> {
  const started = performance.now();
  const textures = request.textures ?? 'default';
  const compiled = compileCreature(resolveBlueprint(request.blueprint, registry), registry, {
    quality: request.quality ?? 'medium',
    field: textures !== 'none',
  });
  const clips = bakeClips(compiled, registry, {
    ...(request.clips ? { clips: request.clips } : {}),
    ...(request.fps ? { fps: request.fps } : {}),
  });
  const bakeStarted = performance.now();
  const baked =
    textures === 'none'
      ? undefined
      : await bakeTextures(compiled, registry, {
          ...(typeof textures === 'number' ? { size: textures } : {}),
          run: runBands,
          bands: bakeWorkers().length * 2,
        });
  const bakeMs = performance.now() - bakeStarted;
  const maps = baked && mutate ? mutate(baked) : baked;
  // Levels of detail over the meshes as written: the textured ones where there are maps.
  const lods: LodChain | undefined =
    request.lods === false
      ? undefined
      : {
          skin: await simplifyChain(maps?.skin ?? compiled.skin),
          parts: await simplifyChain(maps?.parts ?? compiled.parts),
        };
  const write = async (colorImages: 'image/png' | 'image/jpeg') => {
    const built = buildExportScene(compiled, registry, {
      clips,
      ...(request.extras ? { extras: request.extras } : {}),
      ...(maps ? { textures: maps, colorImages } : {}),
      ...(lods ? { lods } : {}),
    });
    const glb = (await new GLTFExporter().register(lodExporterPlugin).parseAsync(built.scene, {
      binary: true,
      animations: built.animations,
    })) as ArrayBuffer;
    return { ...built, bytes: new Uint8Array(glb) };
  };
  // Colour and glow as JPEG only if PNG would take the file past 8 MB (decision 10).
  let written = await write('image/png');
  if (maps && written.bytes.length > MAX_GLB_BYTES) {
    written = await write('image/jpeg');
    written.notes.push('colour and glow maps are JPEG, to keep the file under 8 MB');
  }
  const { scene, notes, bytes } = written;
  const t = compiled.stats.triangles;
  const extras = scene.userData.spawnforge as {
    textures?: { maps: Record<string, string[]> };
    lods?: ExportInfo['lods'];
  };
  return {
    bytes,
    compiled,
    ...(maps ? { maps } : {}),
    info: {
      name: compiled.name,
      bytes: bytes.length,
      triangles: t.skin + t.parts + t.eyes,
      bones: compiled.bones.names.length,
      sockets: compiled.sockets.map((s) => s.name),
      clips: clips.map((c) => ({ name: c.name, duration: c.duration, loop: c.loop })),
      notes: [
        ...(clips.some((c) => c.name === 'idle' && c.frames <= 2)
          ? [
              'idle is only the standing pose: the creature has no ambient action; add "idle" to motion.actions for breathing, blinks and glances',
            ]
          : []),
        ...notes,
      ],
      exportMs: performance.now() - started,
      ...(extras.lods ? { lods: extras.lods } : {}),
      ...(maps
        ? {
            textures: {
              size: maps.size,
              maps: extras.textures?.maps ?? {},
              ms: bakeMs,
              timings: Object.fromEntries(
                Object.entries(maps.timings ?? {}).map(([k, v]) => [k, Math.round(v)]),
              ),
            },
          }
        : {}),
    },
  };
}

/** The size a textured export aims to stay under (plan 2's budget for a medium `.glb`). */
const MAX_GLB_BYTES = 8_000_000;

/** Base64 in chunks: String.fromCharCode cannot take a whole buffer at once. */
function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

window.spawnforgeExport = async (request) => {
  const { bytes, info } = await buildGlb(request);
  return { glb: base64(bytes), info };
};

window.spawnforgeRoundTrip = async (request) => {
  let glb: Uint8Array | undefined;
  const keep: typeof buildGlb = async (r, mutate) => {
    const built = await buildGlb(r, mutate);
    glb = built.bytes;
    return built;
  };
  const response = await roundTrip({ renderer, registry, buildGlb: keep, viewCamera }, request);
  return request.glb && glb ? { ...response, glb: base64(glb) } : response;
};

/**
 * The parity test's GPU side: one pixel per sampled skin vertex, drawn unlit by three's
 * `stackMaterial` into a float render target and read back (docs/design/8.4-materials.md).
 */
window.spawnforgeParity = async (request) => {
  const compiled = compileCreature(resolveBlueprint(request.blueprint, registry), registry, {
    quality: request.quality ?? 'low',
  });
  const { positions, normals, body, region } = compiled.skin;
  const count = request.samples.length;
  const width = 64;
  const height = Math.max(1, Math.ceil(count / width));
  // A quad per sample, covering its pixel, with the vertex's surface on all four corners.
  const quad = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const at = new Float32Array(count * 4 * 3);
  const rest = new Float32Array(count * 4 * 3);
  const restNormal = new Float32Array(count * 4 * 3);
  const bodyAt = new Float32Array(count * 4 * 4);
  const regionAt = new Float32Array(count * 4 * 4);
  const index: number[] = [];
  request.samples.forEach((v, i) => {
    const col = i % width;
    const row = Math.floor(i / width);
    quad.forEach(([dx, dy], c) => {
      const k = i * 4 + c;
      at[k * 3] = -1 + (2 * (col + (dx as number))) / width;
      at[k * 3 + 1] = -1 + (2 * (row + (dy as number))) / height;
      for (let j = 0; j < 3; j++) {
        rest[k * 3 + j] = positions[v * 3 + j] as number;
        restNormal[k * 3 + j] = normals[v * 3 + j] as number;
      }
      for (let j = 0; j < 4; j++) {
        bodyAt[k * 4 + j] = body[v * 4 + j] as number;
        regionAt[k * 4 + j] = region[v * 4 + j] as number;
      }
    });
    index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(at, 3));
  geometry.setAttribute('rest', new THREE.BufferAttribute(rest, 3));
  geometry.setAttribute('restNormal', new THREE.BufferAttribute(restNormal, 3));
  geometry.setAttribute('body', new THREE.BufferAttribute(bodyAt, 4));
  geometry.setAttribute('region', new THREE.BufferAttribute(regionAt, 4));
  geometry.setIndex(index);
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(geometry);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera();
  let precision: 'float' | 'half' = 'float';
  const passes: number[][] = [];
  for (const pass of [0, 1, 2] as const) {
    mesh.material = stackMaterial(compiled.material, compiled.scale, registry, pass);
    let pixels: ArrayLike<number> | undefined;
    for (const type of precision === 'float'
      ? [THREE.FloatType, THREE.HalfFloatType]
      : [THREE.HalfFloatType]) {
      const target = new THREE.RenderTarget(width, height, { type, depthBuffer: false });
      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        const read = (await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height)) as
          | Float32Array
          | Uint16Array;
        pixels =
          type === THREE.HalfFloatType
            ? Array.from(read as Uint16Array, (h) => THREE.DataUtils.fromHalfFloat(h))
            : (read as Float32Array);
        if (type === THREE.HalfFloatType) precision = 'half';
        break;
      } catch {
        // Float targets need EXT_color_buffer_float; fall back to half floats.
      } finally {
        renderer.setRenderTarget(null);
        target.dispose();
      }
    }
    (mesh.material as THREE.Material).dispose();
    if (!pixels) throw new Error('could not read a float render target');
    passes.push(Array.from(pixels).slice(0, count * 4));
  }
  geometry.dispose();
  return { passes, precision };
};

/** The camera for one view of a creature framed by its bounds (and its head, for `head`). */
export function viewCamera(
  view: View,
  frame: {
    readonly centre: THREE.Vector3;
    readonly extent: THREE.Vector3;
    readonly span: number;
    readonly min: THREE.Vector3;
    readonly max: THREE.Vector3;
  },
  head: { readonly headCentre: THREE.Vector3; readonly headSize: number },
): { camera: THREE.Camera; half: number } {
  const { centre, extent, span, min, max } = frame;
  let camera: THREE.Camera;
  let half = span * 0.6;
  if (view === 'three-quarter' || view === 'rear' || view === 'head') {
    const persp = new THREE.PerspectiveCamera(30, 1, span * 0.002, span * 20);
    if (view === 'head') {
      const reach = Math.max((head.headSize * 1.02) / Math.sin((15 * Math.PI) / 180), span * 0.08);
      persp.position
        .copy(head.headCentre)
        .addScaledVector(new THREE.Vector3(0.75, 0.35, 0.95).normalize(), reach);
      persp.lookAt(head.headCentre);
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
    if (view === 'underside') {
      // Looking up at the belly, head at the top of the panel.
      ortho.position.set(centre.x, min.y - span * 2, centre.z);
      ortho.up.set(0, 0, 1);
    }
    ortho.lookAt(centre);
    camera = ortho;
  }
  camera.updateMatrixWorld();
  return { camera, half };
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
  // Stills show the rest pose (folded wings), opened or spread as asked.
  const spread = request.filmstrip ? 0 : (request.pose?.spread ?? 0);
  let pose: Pose | undefined;
  if (!request.filmstrip) {
    pose = new Pose(compiled.bones);
    applyRest(pose, compiled.rig, {
      jaw: request.pose?.jaw ?? 0,
      blink: request.pose?.blink ?? 0,
      spread,
      flare: request.pose?.flare ?? 0,
    });
    applyPose(creature, pose);
  }
  // Markers follow their bones into the pose.
  const markerAt = (m: (typeof compiled.markers)[number]) => {
    const p = new THREE.Vector3(...m.position);
    if (!pose || m.bone === undefined) return p;
    const b = m.bone;
    const bindRot = new THREE.Quaternion().fromArray(compiled.bones.rotations, b * 4);
    const bindPos = new THREE.Vector3().fromArray(compiled.bones.positions, b * 3);
    return p
      .sub(bindPos)
      .applyQuaternion(bindRot.invert())
      .applyQuaternion(pose.worldRot[b] as THREE.Quaternion)
      .add(pose.worldPos[b] as THREE.Vector3);
  };

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e8eeff', '#4a4034', 1.15));
  const key = new THREE.DirectionalLight('#ffffff', 2.4);
  const rim = new THREE.DirectionalLight('#b8c8ff', 1.1);
  scene.add(key, key.target, rim, rim.target);
  scene.add(creature.object);

  const frameBounds = spread > 0 && compiled.spreadBounds ? compiled.spreadBounds : compiled.bounds;
  const [x0, y0, z0] = frameBounds.min;
  const [x1, y1, z1] = frameBounds.max;
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

  const film = request.filmstrip;
  // A scenario says its own frame count.
  const scenarioFrames =
    film?.scenario === undefined ? undefined : parseScenario(film.scenario).scenario?.frames;
  const frames = film
    ? Math.max(2, Math.min(16, Math.round(scenarioFrames ?? film.frames ?? 8)))
    : 0;
  const panelSize = film ? (request.size ?? 320) : size;
  renderer.setSize(panelSize, panelSize, false);
  const sheet = document.createElement('canvas');
  const header = 44;
  const cols = film ? Math.min(frames, 4) : views.length >= 5 ? 3 : views.length >= 2 ? 2 : 1;
  const rows = Math.ceil((film ? frames : views.length) / cols);
  sheet.width = cols * panelSize;
  sheet.height =
    rows * panelSize +
    header +
    (film
      ? diagramHeight(
          compiled.rig.legs.length,
          film.action !== undefined,
          film.scenario !== undefined,
        )
      : 0);
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
  const sizeLine =
    // Upright creatures read better height first, with their depth as "deep".
    max.y > extent.z
      ? `${fmt(max.y)} tall · ${fmt(extent.x)} wide · ${fmt(extent.z)} deep`
      : `${fmt(extent.z)} long · ${fmt(max.y)} tall · ${fmt(extent.x)} wide`;

  const r0 = performance.now();
  let motion: MotionInfo | undefined;
  if (film) {
    const gridCell = (span * 5) / Math.round((span * 5) / niceBar(span / 4));
    motion = await drawFilmstrip(
      compiled,
      creature,
      { renderer, scene, key, ground, grid, gridCell, centre, extent, span },
      film,
      ctx,
      { top: header, size: panelSize, cols },
      registry,
      request.anonymous ?? false,
    );
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#aab';
    // Blind reviews keep the measurements but not the gait or action names.
    const named = (label: string) => (request.anonymous ? '' : `${label} · `);
    ctx.fillText(
      motion.scenario
        ? `${named('scenario')}${motion.cycle.toFixed(1)} s · covered ${fmt(motion.stride)} · ${sizeLine}`
        : motion.action
          ? `${named(motion.action)}${motion.cycle.toFixed(2)} s · ${sizeLine}`
          : `${named(motion.gait)}${motion.speed.toFixed(2)} m/s · cycle ${motion.cycle.toFixed(2)} s · stride ${fmt(motion.stride)} · ${sizeLine}`,
      14 + nameWidth + 18,
      28,
    );
  } else {
    ctx.fillText(sizeLine, 14 + nameWidth + 18, 28);
  }

  // The head close-up frames everything skinned mostly to the main head or its jaw: skin, teeth,
  // eyes, horns.
  const main = mainHead(compiled.rig);
  const headBones = new Set([main.head, main.jaw, ...main.eyes]);
  const headBox = new THREE.Box3();
  for (const mesh of [compiled.skin, compiled.parts, compiled.eyes]) {
    for (let v = 0; v < mesh.positions.length / 3; v++) {
      let w = 0;
      for (let k = v * 4; k < v * 4 + 4; k++)
        if (headBones.has(mesh.skinIndex[k] as number)) w += mesh.skinWeight[k] as number;
      if (w < 0.5) continue;
      headBox.expandByPoint(new THREE.Vector3().fromArray(mesh.positions, v * 3));
    }
  }
  if (headBox.isEmpty()) headBox.setFromCenterAndSize(centre, extent);
  const headSphere = headBox.getBoundingSphere(new THREE.Sphere());
  const headCentre = headSphere.center;
  const headSize = headSphere.radius;

  for (const [index, view] of (film ? [] : views).entries()) {
    const { camera, half } = viewCamera(
      view,
      { centre, extent, span, min, max },
      { headCentre, headSize },
    );
    const below = view === 'underside';
    ground.visible = view !== 'top' && view !== 'front' && view !== 'head' && !below;
    grid.visible = view !== 'front' && view !== 'head' && !below;
    // From below, the key light moves under the creature so the belly is lit.
    key.position
      .copy(centre)
      .add(new THREE.Vector3(span * 1.2, (below ? -1 : 1) * span * 2.2, span * 1.6));
    scene.background = new THREE.Color(view === 'top' || below ? '#2b2f36' : '#262a30');
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

    if (
      view === 'side' ||
      view === 'front' ||
      view === 'top' ||
      view === 'head' ||
      view === 'underside'
    ) {
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
        .filter((m) => !(view === 'side' && markerAt(m).x < -extent.x * 0.15))
        .filter((m) => view !== 'head' || markerAt(m).distanceTo(headCentre) < headSize * 1.1)
        .map((m) => {
          const p = markerAt(m).project(camera);
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
  // The key's shadow map, new each render.
  key.dispose();
  rim.dispose();
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
      ...(motion ? { motion } : {}),
    },
  };
};
window.spawnforgeCrowd = (request) => crowdCheck({ renderer, registry }, request);
window.spawnforgeBench = (request) => bench(request);

// `?bench` (from `pnpm bench --open`): run the benchmark in this browser and show the numbers.
const benchParams = new URLSearchParams(location.search);
if (benchParams.has('bench')) {
  const panel = document.createElement('main');
  panel.style.font = '14px system-ui, sans-serif';
  panel.textContent = 'Running the Spawnforge bench: near, distant, crowd…';
  document.body.prepend(panel);
  void bench({ frames: Number(benchParams.get('frames') ?? 300) }, panel).then((result) => {
    const json = JSON.stringify(result, null, 2);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    link.download = 'bench.json';
    link.textContent = 'Save bench.json (for docs/poc/)';
    const pre = document.createElement('pre');
    pre.textContent = json;
    panel.replaceChildren(link, pre);
  });
}

window.spawnforgeReady = true;
