import type { CompiledCreature } from '../compile/compile.ts';
import { mainHead } from '../compile/types.ts';
import type { Registry } from '../registry.ts';
import { MotionController, type MotionEvent } from './controller.ts';

/**
 * One animation baked from the motion controller: a local rotation and position per bone per
 * frame, as plain arrays. The root stays at the origin facing +Z, so gait clips are one cycle in
 * place and loop; `distance` is how far one cycle carries the creature at `speed`.
 */
export interface BakedClip {
  readonly name: string;
  /** Seconds. */
  readonly duration: number;
  readonly loop: boolean;
  /** Frames, evenly spaced; the last frame is at `duration` (equal to the first for loops). */
  readonly frames: number;
  /** frames × bones × 4: local rotations (x, y, z, w). */
  readonly rotations: Float32Array;
  /** frames × bones × 3: local positions. */
  readonly positions: Float32Array;
  /** Per frame: eyelids, 0 open to 1 shut. */
  readonly blink: Float32Array;
  /** Per frame: chest expansion, 0 to 1. */
  readonly breath: Float32Array;
  /** Speed the clip was baked at (m/s), and the distance one cycle covers (m). */
  readonly speed: number;
  readonly distance: number;
  /** Events in the clip (footsteps, action moments), timed from its start. */
  readonly events: readonly MotionEvent[];
}

export interface BakeOptions {
  /** Frames per second (default 30). */
  readonly fps?: number;
  /** Clips to bake: "idle", gait ids and action ids. Default: idle, every gait, every action. */
  readonly clips?: readonly string[];
  /** Seconds of idle to bake (default 4). */
  readonly idleSeconds?: number;
}

const STEP = 1 / 120;

/** What `clips` may name for this creature: idle, its gaits and its actions. */
export function clipNames(compiled: CompiledCreature, registry: Registry): string[] {
  const actions = new MotionController(compiled, { registry }).actions();
  return ['idle', ...compiled.motion.gaits.map((g) => g.id), ...actions];
}

/**
 * Bakes animation clips from the motion controller on flat ground: `idle` (breathing, blinks,
 * glances), one in-place cycle of each gait at its natural speed, and each action aimed at a
 * point in front of the head. Deterministic, like the controller.
 */
export function bakeClips(
  compiled: CompiledCreature,
  registry: Registry,
  options: BakeOptions = {},
): BakedClip[] {
  const fps = options.fps ?? 30;
  const known = clipNames(compiled, registry);
  const wanted = options.clips ?? known;
  for (const name of wanted)
    if (!known.includes(name))
      throw new Error(`no clip "${name}" for this creature; it has ${known.join(', ')}`);
  const gaits = new Set(compiled.motion.gaits.map((g) => g.id));
  return wanted.map((name) => {
    if (name === 'idle') return bakeIdle(compiled, registry, fps, options.idleSeconds ?? 4);
    if (gaits.has(name)) return bakeGait(compiled, registry, fps, name);
    return bakeAction(compiled, registry, fps, name);
  });
}

/** Records `frames` poses, advancing the controller by `dt` between them. */
function record(
  controller: MotionController,
  name: string,
  frames: number,
  dt: number,
  extra: { loop: boolean; speed: number },
): BakedClip {
  const pose = controller.pose;
  const n = pose.count;
  const rotations = new Float32Array(frames * n * 4);
  const positions = new Float32Array(frames * n * 3);
  const blink = new Float32Array(frames);
  const breath = new Float32Array(frames);
  const events: MotionEvent[] = [];
  const start = controller.time;
  const startX = controller.position.x;
  const startZ = controller.position.z;
  for (let f = 0; f < frames; f++) {
    if (f > 0)
      for (const event of controller.update(dt))
        events.push({ ...event, time: event.time - start });
    // The root stays at the origin facing +Z: a game places the creature, the clip moves it.
    const x = controller.position.x;
    const z = controller.position.z;
    for (let b = 0; b < n; b++) {
      const q = pose.rot[b];
      const p = pose.pos[b];
      if (!q || !p) continue;
      rotations.set([q.x, q.y, q.z, q.w], (f * n + b) * 4);
      const root = pose.parents[b] === -1;
      positions.set([p.x - (root ? x : 0), p.y, p.z - (root ? z : 0)], (f * n + b) * 3);
    }
    blink[f] = pose.blink;
    breath[f] = pose.breath;
  }
  if (extra.loop) closeLoop(rotations, positions, frames, n);
  const duration = (frames - 1) * dt;
  return {
    name,
    duration,
    loop: extra.loop,
    frames,
    rotations,
    positions,
    blink,
    breath,
    speed: extra.speed,
    distance: Math.hypot(controller.position.x - startX, controller.position.z - startZ),
    events,
  };
}

/**
 * Makes a loop seamless: springs and idle glances leave the last frame a little off the first,
 * so the difference is spread over the clip (none at the start, all of it at the end).
 */
function closeLoop(rotations: Float32Array, positions: Float32Array, frames: number, n: number) {
  const last = frames - 1;
  for (let b = 0; b < n; b++) {
    const first = b * 4;
    const end = (last * n + b) * 4;
    // Compare like with like: q and -q are the same rotation.
    let dot = 0;
    for (let j = 0; j < 4; j++)
      dot += (rotations[first + j] as number) * (rotations[end + j] as number);
    const sign = dot < 0 ? -1 : 1;
    const delta = [0, 1, 2, 3].map(
      (j) => (rotations[first + j] as number) * sign - (rotations[end + j] as number),
    );
    const pDelta = [0, 1, 2].map(
      (j) => (positions[b * 3 + j] as number) - (positions[(last * n + b) * 3 + j] as number),
    );
    for (let f = 1; f <= last; f++) {
      const t = f / last;
      const o = (f * n + b) * 4;
      let len = 0;
      for (let j = 0; j < 4; j++) {
        const v = (rotations[o + j] as number) + (delta[j] as number) * t;
        rotations[o + j] = v;
        len += v * v;
      }
      len = Math.sqrt(len) || 1;
      for (let j = 0; j < 4; j++) rotations[o + j] = (rotations[o + j] as number) / len;
      for (let j = 0; j < 3; j++)
        positions[(f * n + b) * 3 + j] =
          (positions[(f * n + b) * 3 + j] as number) + (pDelta[j] as number) * t;
    }
    // The last frame is now the first up to sign; make it identical.
    for (let j = 0; j < 4; j++) rotations[end + j] = (rotations[first + j] as number) * sign;
  }
}

function bakeIdle(
  compiled: CompiledCreature,
  registry: Registry,
  fps: number,
  seconds: number,
): BakedClip {
  const controller = new MotionController(compiled, { registry });
  for (let i = 0; i < 120; i++) controller.update(STEP);
  // With no ambient action (breathing, blinks) the creature just stands: two frames of it.
  const ambient = compiled.motion.actions.some((a) => registry.get('action', a.id)?.hooks?.ambient);
  if (!ambient) return record(controller, 'idle', 2, 1, { loop: true, speed: 0 });
  return record(controller, 'idle', Math.round(seconds * fps) + 1, 1 / fps, {
    loop: true,
    speed: 0,
  });
}

function bakeGait(
  compiled: CompiledCreature,
  registry: Registry,
  fps: number,
  gait: string,
): BakedClip {
  const controller = new MotionController(compiled, { registry });
  controller.lockGait(gait);
  const speed = controller.gaitSpeed(gait);
  controller.drive(speed, 0);
  // Settle into the gait, then start at the top of a cycle.
  for (let i = 0; i < 480; i++) controller.update(STEP);
  let last = controller.phase;
  for (let guard = 0; ; guard++) {
    controller.update(STEP);
    if (controller.phase < last) break;
    last = controller.phase;
    if (guard > 4800) throw new Error(`the ${gait} cycle did not advance`);
  }
  // Measure one cycle on a copy of the run: the controller is deterministic, so a second
  // controller in the same state is not needed; time the next cycle instead and bake the one
  // after it at exactly that length.
  const t0 = controller.time;
  last = controller.phase;
  for (let guard = 0; ; guard++) {
    controller.update(STEP);
    if (controller.phase < last) break;
    last = controller.phase;
    if (guard > 4800) throw new Error(`the ${gait} cycle did not advance`);
  }
  const cycle = controller.time - t0;
  // At least 12 frames a cycle, so quick little steps still read.
  const frames = Math.max(12, Math.round(cycle * fps)) + 1;
  return record(controller, gait, frames, cycle / (frames - 1), {
    loop: true,
    speed,
  });
}

function bakeAction(
  compiled: CompiledCreature,
  registry: Registry,
  fps: number,
  action: string,
): BakedClip {
  const controller = new MotionController(compiled, { registry });
  for (let i = 0; i < 120; i++) controller.update(STEP);
  const head = controller.pose.worldPos[mainHead(compiled.rig).head];
  const target = head
    ? { x: head.x, y: head.y, z: head.z + compiled.scale * 0.6 }
    : { x: 0, y: compiled.scale * 0.5, z: compiled.scale * 2 };
  controller.act(action, { target });
  const duration = controller.actionState?.duration ?? 1;
  // A little after the action ends, so it settles back.
  const frames = Math.round((duration + 0.25) * fps) + 1;
  return record(controller, action, frames, 1 / fps, { loop: false, speed: 0 });
}
