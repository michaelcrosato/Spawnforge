import { type CompiledCreature, MotionController, mainHead, type Registry } from '@spawnforge/core';
import { applyPose, type CreatureObject } from '@spawnforge/three';
import * as THREE from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import type { FilmstripRequest, MotionInfo } from './protocol.ts';

const STEP = 1 / 120;

export interface Stage {
  readonly renderer: WebGPURenderer;
  readonly scene: THREE.Scene;
  readonly key: THREE.DirectionalLight;
  readonly ground: THREE.Mesh;
  readonly grid: THREE.GridHelper;
  readonly gridCell: number;
  /** Rest bounds of the creature. */
  readonly centre: THREE.Vector3;
  readonly extent: THREE.Vector3;
  readonly span: number;
}

/**
 * Walks the creature on flat ground until its gait settles, then draws one cycle as frames
 * into `ctx` at (0, top), followed by a footfall diagram. Returns what it measured.
 */
export async function drawFilmstrip(
  compiled: CompiledCreature,
  creature: CreatureObject,
  stage: Stage,
  request: FilmstripRequest,
  ctx: CanvasRenderingContext2D,
  layout: { top: number; size: number; cols: number },
  registry: Registry,
): Promise<MotionInfo> {
  if (request.action)
    return drawAction(compiled, creature, stage, request, ctx, layout, registry, request.action);
  const controller = new MotionController(compiled, { registry });
  if (request.gait) controller.lockGait(request.gait);
  const speed =
    request.speed ?? (request.gait ? controller.gaitSpeed(request.gait) : controller.paceSpeed());
  controller.drive(speed, 0);
  const frames = Math.max(2, Math.min(16, Math.round(request.frames ?? 8)));

  // Warm up for a few seconds, then wait for the cycle to start.
  for (let i = 0; i < 480; i++) controller.update(STEP);
  let guard = 0;
  let last = controller.phase;
  for (;;) {
    controller.update(STEP);
    if (controller.phase < last) break;
    last = controller.phase;
    if (++guard > 2400) throw new Error('the gait cycle did not advance; is the speed 0?');
  }

  // One cycle: frames at evenly spaced phases, contacts at every step.
  const legs = controller.feet().map((f) => f.leg);
  const contacts: boolean[][] = legs.map(() => []);
  const phases: number[] = [];
  const frameSteps: number[] = [];
  const startTime = controller.time;
  const startZ = controller.position.z;
  const anchors = new Map<string, THREE.Vector3>();
  let footSlide = 0;
  const { cols, size, top } = layout;
  let nextFrame = 0;
  last = -1;
  for (let i = 0; i < 4800; i++) {
    const phase = controller.phase;
    if (phase < last) break;
    last = phase;
    phases.push(phase);
    for (const [k, foot] of controller.feet().entries()) {
      contacts[k]?.push(foot.planted);
      // Foot slide: how far the posed ankle drifts from where it was planted.
      const leg = compiled.rig.legs[k];
      if (!leg) continue;
      const ankle = controller.pose.tail(leg.bones.at(-1) as number);
      if (!foot.planted) anchors.delete(foot.leg);
      else if (!anchors.has(foot.leg)) anchors.set(foot.leg, ankle);
      else {
        const a = anchors.get(foot.leg) as THREE.Vector3;
        footSlide = Math.max(footSlide, Math.hypot(ankle.x - a.x, ankle.z - a.z));
      }
    }
    if (nextFrame < frames && phase >= nextFrame / frames) {
      frameSteps.push(phases.length - 1);
      await drawFrame(controller, creature, stage, request, ctx, {
        x: (nextFrame % cols) * size,
        y: top + Math.floor(nextFrame / cols) * size,
        size,
        label: `${nextFrame + 1}  t = ${(controller.time - startTime).toFixed(2)} s`,
      });
      nextFrame++;
    }
    controller.update(STEP);
  }
  const cycle = controller.time - startTime;
  const stride = controller.position.z - startZ;

  // Footfall diagram: one row per leg, filled while the foot is planted.
  const rowsTop = top + Math.ceil(frames / cols) * size + 10;
  const width = cols * size;
  const labelW = 90;
  const barW = width - labelW - 20;
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = '#aab';
  ctx.fillText('footfalls over one cycle (filled = planted)', 14, rowsTop + 12);
  const duty: Record<string, number> = {};
  if (legs.length === 0) {
    ctx.fillText('no legs: the body follows its own trail (slither)', 14, rowsTop + 32);
  }
  legs.forEach((leg, k) => {
    const y = rowsTop + 22 + k * 16;
    const row = contacts[k] ?? [];
    ctx.fillStyle = '#ccd';
    ctx.fillText(leg, 14, y + 10);
    ctx.fillStyle = '#2c3038';
    ctx.fillRect(labelW, y, barW, 12);
    ctx.fillStyle = '#7fdbff';
    const n = Math.max(1, row.length);
    row.forEach((planted, i) => {
      if (planted) ctx.fillRect(labelW + (i / n) * barW, y, barW / n + 0.5, 12);
    });
    duty[leg] = row.filter(Boolean).length / n;
  });
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  if (legs.length > 0)
    frameSteps.forEach((step, k) => {
      const x = labelW + (step / Math.max(1, phases.length)) * barW;
      ctx.beginPath();
      ctx.moveTo(x, rowsTop + 18);
      ctx.lineTo(x, rowsTop + 22 + legs.length * 16);
      ctx.stroke();
      ctx.fillStyle = '#889';
      ctx.fillText(String(k + 1), x + 2, rowsTop + 22 + legs.length * 16 + 10);
    });
  return { gait: controller.gait?.id ?? 'none', speed, cycle, stride, duty, footSlide };
}

/** Height of the footfall diagram (or action timeline) below the frames. */
export function diagramHeight(legCount: number, action: boolean): number {
  return action ? 64 : 22 + Math.max(1, legCount) * 16 + 24;
}

/** The creature stands and performs one action; frames span it, events on a timeline below. */
async function drawAction(
  compiled: CompiledCreature,
  creature: CreatureObject,
  stage: Stage,
  request: FilmstripRequest,
  ctx: CanvasRenderingContext2D,
  layout: { top: number; size: number; cols: number },
  registry: Registry,
  action: string,
): Promise<MotionInfo> {
  const controller = new MotionController(compiled, { registry });
  for (let i = 0; i < 120; i++) controller.update(STEP);
  const main = mainHead(compiled.rig);
  const head = (controller.pose.worldPos[main.head] as THREE.Vector3).clone();
  // Bite and roar at a point ahead; look to one side, so the turn shows.
  const target = head
    .clone()
    .add(
      new THREE.Vector3(...(action === 'look' ? [0.9, 0.1, 0.4] : [0, -0.15, 0.7])).multiplyScalar(
        compiled.scale,
      ),
    );
  controller.act(action, { target });
  // Frame the main head and neck, with room for a lunge or a raised head.
  const neckRoot = main.neck[0];
  const base = (
    neckRoot === undefined ? head : (controller.pose.worldPos[neckRoot] as THREE.Vector3)
  ).clone();
  const headLength = compiled.bones.lengths[main.head] ?? 0.2 * compiled.scale;
  const closeUp = {
    centre: head.clone().lerp(base, 0.35),
    radius: Math.max(head.distanceTo(base) * 0.75 + headLength * 1.6, 0.3 * compiled.scale),
  };
  const frames = Math.max(2, Math.min(16, Math.round(request.frames ?? 8)));
  const { cols, size, top } = layout;
  const events: { type: string; time: number }[] = [];
  const start = controller.time;
  let duration = controller.actionState?.duration ?? 1;
  let next = 0;
  for (let i = 0; i < 6000 && next < frames; i++) {
    const state = controller.actionState;
    if (state) duration = state.duration;
    const progress = state ? state.progress : 1;
    if (progress >= next / (frames - 1) - 1e-9) {
      await drawFrame(
        controller,
        creature,
        stage,
        request,
        ctx,
        {
          x: (next % cols) * size,
          y: top + Math.floor(next / cols) * size,
          size,
          label: `${next + 1}  t = ${(controller.time - start).toFixed(2)} s`,
        },
        closeUp,
      );
      next++;
      continue;
    }
    for (const e of controller.update(STEP))
      if (e.type !== 'footstep') events.push({ type: e.type, time: e.time - start });
  }
  // Timeline of the action's events.
  const y = top + Math.ceil(frames / cols) * size + 10;
  const width = cols * size;
  const x0 = 90;
  const barW = width - x0 - 20;
  ctx.font = '11px ui-monospace, monospace';
  ctx.fillStyle = '#aab';
  ctx.fillText(`${action}: ${duration.toFixed(2)} s, events`, 14, y + 12);
  ctx.fillStyle = '#2c3038';
  ctx.fillRect(x0, y + 22, barW, 6);
  for (const e of events) {
    if (e.type === 'action-start' || e.type === 'action-end') continue;
    const x = x0 + Math.min(1, e.time / duration) * barW;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x - 1, y + 16, 3, 18);
    ctx.fillText(`${e.type} ${e.time.toFixed(2)} s`, Math.min(x + 4, width - 150), y + 46);
  }
  return {
    action,
    events,
    gait: 'standing',
    speed: 0,
    cycle: duration,
    stride: 0,
    duty: {},
    footSlide: 0,
  };
}

async function drawFrame(
  controller: MotionController,
  creature: CreatureObject,
  stage: Stage,
  request: FilmstripRequest,
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number; size: number; label: string },
  /** Frame this sphere (world space) instead of the whole creature, e.g. the head for actions. */
  closeUp?: { centre: THREE.Vector3; radius: number },
): Promise<void> {
  const { renderer, scene, key, ground, grid, gridCell, centre, extent } = stage;
  const span = closeUp ? closeUp.radius * 2 : stage.span;
  applyPose(creature, controller.pose);
  creature.object.updateMatrixWorld(true);
  // The camera, ground and light follow the creature; grid lines stay put in the world.
  // Frame the posed skeleton (a slithering body trails behind its head, away from its rest
  // bounds).
  const bones = new THREE.Box3().setFromPoints(controller.pose.worldPos);
  const mid = bones.getCenter(new THREE.Vector3());
  const p = controller.position;
  const focus = closeUp ? closeUp.centre.clone() : new THREE.Vector3(mid.x, centre.y, mid.z);
  ground.position.set(p.x, 0, p.z);
  grid.position.set(
    Math.round(p.x / gridCell) * gridCell,
    0.001,
    Math.round(p.z / gridCell) * gridCell,
  );
  key.position.copy(focus).add(new THREE.Vector3(span * 1.2, span * 2.2, span * 1.6));
  key.target.position.copy(focus);
  key.target.updateMatrixWorld();
  // Legless bodies show their wave from above; actions read best at 3/4.
  const view = request.view ?? (closeUp ? 'three-quarter' : controller.legless ? 'top' : 'side');
  let camera: THREE.Camera;
  if (view === 'three-quarter') {
    const persp = new THREE.PerspectiveCamera(30, 1, span * 0.002, span * 20);
    persp.position.copy(focus).addScaledVector(new THREE.Vector3(1.25, 0.7, 1.55), span);
    persp.lookAt(focus);
    camera = persp;
  } else {
    const half = closeUp
      ? closeUp.radius * 1.1
      : view === 'top'
        ? (Math.max(extent.x, extent.z) / 2) * 1.25
        : (Math.max(extent.z, extent.y) / 2) * 1.25;
    const ortho = new THREE.OrthographicCamera(-half, half, half, -half, span * 0.01, span * 20);
    if (view === 'top') {
      ortho.position.set(focus.x, focus.y + span * 3, focus.z);
      ortho.up.set(0, 0, 1);
    } else if (view === 'front') {
      // From ahead (the creature walks toward +Z), to show the legs' stance and spread.
      ortho.position.set(focus.x, focus.y + span * 0.2, focus.z + span * 3);
    } else {
      // From the side and a little above, so the grid shows feet staying put on the ground.
      ortho.position.set(focus.x + span * 3, focus.y + span * 0.55, focus.z);
    }
    ortho.lookAt(focus);
    camera = ortho;
  }
  ground.visible = view !== 'top';
  scene.background = new THREE.Color('#262a30');
  camera.updateMatrixWorld();
  // Three.js re-skins once per animation frame, so let one pass before drawing the new pose.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await renderer.renderAsync(scene, camera);
  ctx.drawImage(renderer.domElement, at.x, at.y, at.size, at.size);
  ctx.strokeStyle = '#111';
  ctx.strokeRect(at.x + 0.5, at.y + 0.5, at.size - 1, at.size - 1);
  ctx.font = '12px system-ui, sans-serif';
  const w = ctx.measureText(at.label).width;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(at.x + 8, at.y + 8, w + 12, 20);
  ctx.fillStyle = '#ddd';
  ctx.fillText(at.label, at.x + 14, at.y + 22);
}
