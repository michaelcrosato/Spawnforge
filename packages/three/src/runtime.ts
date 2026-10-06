import {
  type BakedClip,
  bakeClips,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  FORMAT,
  type Ground,
  MotionController,
  type MotionEvent,
  type Pack,
  type Quality,
  type Registry,
  resolveBlueprint,
} from '@spawnforge/core';
import { type Camera, Object3D, Quaternion, Vector3 } from 'three';
import { type CreatureObject, createCreatureObject } from './assemble.ts';
import { applyPose } from './pose-sync.ts';
import { createWorkerCompiler, type WorkerCompiler } from './worker-client.ts';

export interface BestiaryOptions {
  /** Module packs, e.g. `[basicPack]`. Workers must import the same packs. */
  readonly packs: readonly Pack[];
  /**
   * Compile workers. Module code cannot be sent to a worker, so pass a factory for a worker
   * script that calls `serveCompiles(packs)` from `@spawnforge/three/worker`. Without one,
   * creatures compile on the calling thread.
   */
  readonly workers?: number;
  readonly worker?: () => Worker;
  /** Compiled creatures kept for reuse (default 64). */
  readonly cacheSize?: number;
  /**
   * Beyond this many metres from the camera (times the creature's size in torso lengths, default
   * 30), creatures drop foot IK and springs and play baked cycles.
   */
  readonly lodDistance?: number;
}

export interface SpawnOptions {
  /** Overrides the blueprint's seed: same blueprint, a different individual's details. */
  readonly seed?: number;
  readonly quality?: Quality;
  /** Where to put it, and which way it faces (radians, 0 faces +Z). */
  readonly position?: { readonly x: number; readonly z: number };
  readonly heading?: number;
  readonly ground?: Ground;
}

export interface UpdateInput {
  /** Height (and optionally normal) of the ground at (x, z); flat ground at y = 0 by default. */
  readonly ground?: Ground;
  /** For level of detail: distant creatures play baked cycles. */
  readonly camera?: Camera;
}

/** A world-space hit volume: a capsule from `start` to `end`. */
export interface HitCapsule {
  readonly bone: string;
  readonly start: Vector3;
  readonly end: Vector3;
  readonly radius: number;
}

type Listener = (event: MotionEvent) => void;

const scratch = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * A creature in a game: its Three.js object, its motion and its gameplay sockets. Call `update`
 * every frame (or `bestiary.update` for all of them).
 */
export class Creature {
  /** Add this to the scene. */
  readonly object: Object3D;
  readonly compiled: CompiledCreature;
  readonly controller: MotionController;
  /** Named nodes that follow the body: head, mouth, eyes, claw tips, centre of mass. */
  readonly sockets: Readonly<Record<string, Object3D>>;
  /** "full": procedural motion with foot IK and springs. "baked": cheap cycles for the distance. */
  lod: 'full' | 'baked' = 'full';
  private readonly view: CreatureObject;
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly clips: () => readonly BakedClip[];
  private baked = {
    time: 0,
    clip: undefined as BakedClip | undefined,
    target: null as Vector3 | null,
    speed: 0,
  };

  constructor(
    compiled: CompiledCreature,
    registry: Registry,
    clips: () => readonly BakedClip[],
    options: SpawnOptions = {},
  ) {
    this.compiled = compiled;
    this.view = createCreatureObject(compiled, registry);
    this.object = this.view.object;
    this.controller = new MotionController(compiled, { registry });
    this.clips = clips;
    const sockets: Record<string, Object3D> = {};
    for (const socket of compiled.sockets) {
      const node = new Object3D();
      node.name = socket.name;
      node.position.set(...socket.offset);
      this.view.bones[socket.bone]?.add(node);
      sockets[socket.name] = node;
    }
    this.sockets = sockets;
    this.controller.place(
      options.position?.x ?? 0,
      options.position?.z ?? 0,
      options.heading ?? 0,
      options.ground,
    );
    applyPose(this.view, this.controller.pose);
  }

  /** Where it stands (on the ground) and which way it faces. */
  get position(): Vector3 {
    return this.controller.position;
  }
  get heading(): number {
    return this.controller.heading;
  }
  /** Ground speed in m/s. */
  get speed(): number {
    return this.lod === 'baked' ? this.baked.speed : this.controller.speed;
  }

  /** Walks to a point, choosing its gait from the speed (m/s; default its natural pace). */
  moveTo(target: { x: number; z: number } | null, options: { speed?: number } = {}): void {
    this.controller.moveTo(target, options);
    this.baked.target = target ? new Vector3(target.x, 0, target.z) : null;
    this.baked.speed = target ? this.baked.speed : 0;
    this.desired = target ? (options.speed ?? this.controller.paceSpeed()) : 0;
  }
  private desired = 0;

  stop(): void {
    this.moveTo(null);
  }

  /** Turns the head toward a point (or back to straight ahead with null). */
  lookAt(point: { x: number; y: number; z: number } | null): void {
    this.controller.lookAt(point);
  }

  /** Starts an action (bite, roar, look…), aimed at a target object or point. */
  act(id: string, options: { target?: Object3D | { x: number; y: number; z: number } } = {}): void {
    if (this.lod === 'baked') this.toFull();
    const target = options.target;
    const point =
      target instanceof Object3D ? target.getWorldPosition(new Vector3()) : (target ?? null);
    this.controller.act(id, { target: point });
  }

  /** What it can do. */
  actions(): string[] {
    return this.controller.actions();
  }

  /** Listens for motion events: "footstep", "gait", "action-start", "bite-contact", "roar-peak"… */
  on(type: string, listener: Listener): () => void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
    return () => set.delete(listener);
  }

  /** Advances motion by `dt` seconds and poses the meshes; returns the events it fired. */
  update(dt: number, input: UpdateInput = {}): MotionEvent[] {
    let events: MotionEvent[];
    if (this.lod === 'baked') events = this.updateBaked(dt, input.ground);
    else {
      events = this.controller.update(dt, input.ground ? { ground: input.ground } : {});
      applyPose(this.view, this.controller.pose);
    }
    for (const event of events) {
      for (const listener of this.listeners.get(event.type) ?? []) listener(event);
      for (const listener of this.listeners.get('*') ?? []) listener(event);
    }
    return events;
  }

  /** Switches between full and baked motion (`bestiary.update` does it by camera distance). */
  setLod(lod: 'full' | 'baked', ground?: Ground): void {
    if (lod === this.lod) return;
    if (lod === 'full') this.toFull(ground);
    else {
      // Busy with an action: finish it at full detail first.
      if (this.controller.action) return;
      this.lod = 'baked';
      this.baked.speed = this.controller.speed;
      this.baked.time = 0;
    }
  }

  private toFull(ground?: Ground): void {
    if (this.lod === 'full') return;
    this.lod = 'full';
    const target = this.baked.target;
    this.controller.place(this.position.x, this.position.z, this.heading, ground);
    if (target) this.controller.moveTo({ x: target.x, z: target.z }, { speed: this.desired });
  }

  /** Cheap motion for distant creatures: steer, then play the nearest baked gait cycle. */
  private updateBaked(dt: number, ground: Ground = () => ({ height: 0 })): MotionEvent[] {
    const b = this.baked;
    const c = this.controller;
    let want = 0;
    let heading = c.heading;
    if (b.target) {
      const dx = b.target.x - c.position.x;
      const dz = b.target.z - c.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.3 * this.compiled.rig.hipHeight + 0.05) {
        b.target = null;
        c.moveTo(null);
      } else {
        want = Math.min(this.desired, distance * 1.5);
        heading = Math.atan2(dx, dz);
      }
    }
    let turn = heading - c.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    const maxTurn = 2 * dt;
    c.heading += Math.max(-maxTurn, Math.min(maxTurn, turn));
    const accel = 2.5 * Math.sqrt(9.81 * Math.max(0.05, this.compiled.rig.hipHeight)) * dt;
    b.speed += Math.max(-accel, Math.min(accel, want - b.speed));
    if (b.speed < 1e-3 && want === 0) b.speed = 0;
    c.position.x += Math.sin(c.heading) * b.speed * dt;
    c.position.z += Math.cos(c.heading) * b.speed * dt;
    c.position.y = ground(c.position.x, c.position.z).height;
    // The gait cycle whose speed is nearest, or idle when standing.
    const clips = this.clips();
    const moving = clips.filter((clip) => clip.speed > 0);
    const clip =
      b.speed > 0.01 && moving.length > 0
        ? moving.reduce((best, k) =>
            Math.abs(k.speed - b.speed) < Math.abs(best.speed - b.speed) ? k : best,
          )
        : clips.find((k) => k.speed === 0 && k.loop);
    if (clip !== b.clip) {
      b.clip = clip;
      b.time = 0;
    }
    if (!clip) return [];
    // Cycles play at the rate the speed calls for; idle plays in real time.
    const rate = clip.speed > 0 ? b.speed / clip.speed : 1;
    b.time = (b.time + dt * rate) % clip.duration;
    this.applyClip(clip, b.time);
    return [];
  }

  private applyClip(clip: BakedClip, time: number): void {
    const n = this.view.bones.length;
    const f = (time / clip.duration) * (clip.frames - 1);
    const i0 = Math.min(clip.frames - 1, Math.floor(f));
    const i1 = Math.min(clip.frames - 1, i0 + 1);
    const t = f - i0;
    const qa = new Quaternion();
    const qb = new Quaternion();
    for (let bone = 0; bone < n; bone++) {
      const target = this.view.bones[bone];
      if (!target) continue;
      qa.fromArray(clip.rotations, (i0 * n + bone) * 4);
      qb.fromArray(clip.rotations, (i1 * n + bone) * 4);
      target.quaternion.copy(qa.slerp(qb, t));
      const o0 = (i0 * n + bone) * 3;
      const o1 = (i1 * n + bone) * 3;
      target.position.set(
        (clip.positions[o0] as number) * (1 - t) + (clip.positions[o1] as number) * t,
        (clip.positions[o0 + 1] as number) * (1 - t) + (clip.positions[o1 + 1] as number) * t,
        (clip.positions[o0 + 2] as number) * (1 - t) + (clip.positions[o1 + 2] as number) * t,
      );
    }
    // The clip's root sits at the origin facing +Z; move it to the creature.
    const root = this.view.bones[this.compiled.rig.root];
    if (root) {
      root.position.add(this.controller.position);
      root.quaternion.premultiply(new Quaternion().setFromAxisAngle(UP, this.controller.heading));
    }
  }

  /** Hit volumes in world space for the current pose: one capsule per body bone. */
  hitCapsules(): HitCapsule[] {
    this.object.updateMatrixWorld(true);
    return this.compiled.hitCapsules.map((capsule) => {
      const bone = this.view.bones[capsule.bone] as Object3D;
      const start = bone.getWorldPosition(new Vector3());
      const length = this.compiled.bones.lengths[capsule.bone] ?? 0;
      const end = bone.localToWorld(scratch.set(0, length, 0)).clone();
      return { bone: bone.name, start, end, radius: capsule.radius };
    });
  }

  /** World position of a socket ("mouth", "head", "centerOfMass", …). */
  socket(name: string, out = new Vector3()): Vector3 {
    const node = this.sockets[name];
    if (!node)
      throw new Error(`no socket "${name}"; it has ${Object.keys(this.sockets).join(', ')}`);
    this.object.updateMatrixWorld(true);
    return node.getWorldPosition(out);
  }

  dispose(): void {
    this.object.removeFromParent();
    this.view.dispose();
  }
}

/** Stable JSON: object keys sorted, so equal blueprints hash alike. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

export interface Bestiary {
  readonly registry: Registry;
  /** Compiles (or reuses) and places a creature. Add `creature.object` to your scene. */
  spawn(blueprint: unknown, options?: SpawnOptions): Promise<Creature>;
  /** Updates every live creature, switching distant ones to baked cycles when given a camera. */
  update(dt: number, input?: UpdateInput): void;
  readonly creatures: ReadonlySet<Creature>;
  /** Removes a creature from the scene and frees its meshes. */
  remove(creature: Creature): void;
  dispose(): void;
}

/**
 * The game-facing entry point: compile, cache and animate creatures.
 *
 * ```ts
 * const bestiary = await createBestiary({ packs: [basicPack] });
 * const stalker = await bestiary.spawn(blueprint, { seed: 7 });
 * scene.add(stalker.object);
 * stalker.moveTo(target);
 * // every frame
 * bestiary.update(dt, { ground: (x, z) => terrain.sample(x, z), camera });
 * ```
 */
export async function createBestiary(options: BestiaryOptions): Promise<Bestiary> {
  const registry = createRegistry(options.packs);
  const version = `${FORMAT}|${options.packs.map((p) => p.id).join(',')}`;
  const limit = options.cacheSize ?? 64;
  const cache = new Map<string, Promise<CompiledCreature>>();
  const clipCache = new WeakMap<CompiledCreature, readonly BakedClip[]>();
  const workers: WorkerCompiler | undefined =
    options.worker && (options.workers ?? 1) > 0
      ? createWorkerCompiler(
          Array.from({ length: options.workers ?? 1 }, () => (options.worker as () => Worker)()),
        )
      : undefined;
  const creatures = new Set<Creature>();
  const lodDistance = options.lodDistance ?? 30;

  const compile = (blueprint: unknown, quality: Quality): Promise<CompiledCreature> => {
    const key = `${version}|${quality}|${stable(blueprint)}`;
    const hit = cache.get(key);
    if (hit) {
      // Most recently used last.
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const job = workers
      ? workers.compile(blueprint, quality).then((r) => r.compiled)
      : Promise.resolve().then(() =>
          compileCreature(resolveBlueprint(blueprint, registry), registry, { quality }),
        );
    cache.set(key, job);
    job.catch(() => cache.delete(key));
    while (cache.size > limit) cache.delete(cache.keys().next().value as string);
    return job;
  };

  return {
    registry,
    creatures,
    async spawn(blueprint, spawn = {}) {
      const withSeed =
        spawn.seed === undefined || typeof blueprint !== 'object' || blueprint === null
          ? blueprint
          : { ...(blueprint as Record<string, unknown>), seed: spawn.seed };
      const compiled = await compile(withSeed, spawn.quality ?? 'medium');
      // Baked cycles for level of detail, made the first time a creature goes distant.
      const clips = () => {
        let baked = clipCache.get(compiled);
        if (!baked) {
          const names = ['idle', ...compiled.motion.gaits.map((g) => g.id)];
          baked = bakeClips(compiled, registry, { clips: names, idleSeconds: 2 });
          clipCache.set(compiled, baked);
        }
        return baked;
      };
      const creature = new Creature(compiled, registry, clips, spawn);
      creatures.add(creature);
      return creature;
    },
    update(dt, input = {}) {
      const eye = input.camera?.getWorldPosition(new Vector3());
      for (const creature of creatures) {
        if (eye) {
          const far = creature.position.distanceTo(eye) > lodDistance * creature.compiled.scale;
          creature.setLod(far ? 'baked' : 'full', input.ground);
        }
        creature.update(dt, input);
      }
    },
    remove(creature) {
      creatures.delete(creature);
      creature.dispose();
    },
    dispose() {
      for (const creature of creatures) creature.dispose();
      creatures.clear();
      cache.clear();
      workers?.terminate();
    },
  };
}
