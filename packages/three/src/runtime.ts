import {
  analyzeCreature,
  type BakedClip,
  bakeClips,
  type CompiledCreature,
  compileCreature,
  computeStats,
  createRegistry,
  FORMAT,
  type Ground,
  MotionController,
  type MotionEvent,
  type Pack,
  pickLevel,
  type Quality,
  type Registry,
  resolveBlueprint,
  type Water,
} from '@spawnforge/core';
import {
  BufferAttribute,
  type Camera,
  Euler,
  Object3D,
  type OrthographicCamera,
  type PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three';
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
  /**
   * Levels of detail for the meshes (docs/design/11.2-lod.md): fewer triangles once the
   * simplification's error projects under one pixel (default true; loads `@spawnforge/bake/lod`
   * the first time a creature is given a camera).
   */
  readonly lods?: boolean;
}

/** A species' levels of detail as index buffers its creatures share. */
export interface LiveLods {
  readonly skin: readonly BufferAttribute[];
  readonly parts: readonly BufferAttribute[];
  /** Each level's error in metres: the larger of skin's and parts'. */
  readonly levels: readonly { readonly error: number }[];
}

export interface SpawnOptions {
  /** Overrides the blueprint's seed: same blueprint, a different individual's details. */
  readonly seed?: number;
  readonly quality?: Quality;
  /** Where to put it, and which way it faces (radians, 0 faces +Z). */
  readonly position?: { readonly x: number; readonly z: number };
  readonly heading?: number;
  readonly ground?: Ground;
  /** Water to spawn in: a swimmer starts afloat where it is deep enough. */
  readonly water?: Water;
  /**
   * Start in the air, at cruise, `height` metres above the ground (default its own cruising
   * height; docs/design/10.4-flight.md). Only for a creature that can fly.
   */
  readonly flying?: boolean;
  readonly height?: number;
}

export interface UpdateInput {
  /** Height (and optionally normal) of the ground at (x, z); flat ground at y = 0 by default. */
  readonly ground?: Ground;
  /**
   * Water at (x, z): its surface height, or null where there is none (the ground is its bed).
   * Creatures that swim take to it where it is deep enough, and walk out where it is not.
   */
  readonly water?: Water;
  /** For level of detail: distant creatures play baked cycles and draw fewer triangles. */
  readonly camera?: Camera;
  /** The viewport's height in pixels, for the meshes' level of detail (default 1080). */
  readonly pixels?: number;
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
const FLAT: Ground = () => ({ height: 0 });

/**
 * A creature in a game: its Three.js object, its motion and its gameplay sockets. Call `update`
 * every frame (or `bestiary.update` for all of them).
 */
export class Creature {
  /** Add this to the scene. */
  readonly object: Object3D;
  /** The blueprint it was spawned from (with the spawn's seed). */
  readonly blueprint: unknown;
  readonly compiled: CompiledCreature;
  readonly controller: MotionController;
  /** Named nodes that follow the body: head, mouth, eyes, claw tips, centre of mass. */
  readonly sockets: Readonly<Record<string, Object3D>>;
  /** "full": procedural motion with foot IK and springs. "baked": cheap cycles for the distance. */
  lod: 'full' | 'baked' = 'full';
  private readonly view: CreatureObject;
  private level = 0;
  private readonly full: {
    readonly skin: BufferAttribute | null;
    readonly parts: BufferAttribute | null;
  };
  private readonly listeners = new Map<string, Set<Listener>>();
  /** The ground from the last update, for placing feet when switching back to full motion. */
  private ground: Ground | undefined;
  private water: Water | undefined;
  private readonly clips: () => readonly BakedClip[];
  private baked = {
    time: 0,
    clip: undefined as BakedClip | undefined,
    target: null as Vector3 | null,
    speed: 0,
  };

  constructor(
    blueprint: unknown,
    compiled: CompiledCreature,
    registry: Registry,
    clips: () => readonly BakedClip[],
    options: SpawnOptions = {},
  ) {
    this.blueprint = blueprint;
    this.compiled = compiled;
    this.view = createCreatureObject(compiled, registry);
    this.object = this.view.object;
    this.full = {
      skin: this.view.meshes.skin.geometry.index,
      parts: this.view.meshes.parts.geometry.index,
    };
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
    const x = options.position?.x ?? 0;
    const z = options.position?.z ?? 0;
    const flying = options.flying === true && this.controller.canFly;
    const floor = flying
      ? Math.max((options.ground ?? FLAT)(x, z).height, options.water?.(x, z)?.surface ?? -Infinity)
      : 0;
    this.controller.place(
      x,
      z,
      options.heading ?? 0,
      options.ground,
      options.water,
      flying
        ? { flying, ...(options.height !== undefined ? { y: floor + options.height } : {}) }
        : {},
    );
    if (flying && options.height !== undefined) this.controller.fly({ height: options.height });
    this.ground = options.ground;
    this.water = options.water;
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
    return this.lod === 'baked' && !this.controller.flying
      ? this.baked.speed
      : this.controller.speed;
  }

  /**
   * Walks to a point, choosing its gait from the speed (m/s; default its natural pace). A `y` is
   * a height to dive or rise to; flying, or for a flyer asked higher than it could reach on
   * foot, it is the height to fly at.
   */
  moveTo(
    target: { x: number; y?: number; z: number } | null,
    options: { speed?: number } = {},
  ): void {
    // A takeoff happens at full detail.
    const c = this.controller;
    if (
      this.lod === 'baked' &&
      target?.y !== undefined &&
      !c.flying &&
      c.canFly &&
      target.y - (this.ground ?? FLAT)(target.x, target.z).height > 1.5 * c.standingHeight
    )
      this.toFull();
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

  /**
   * Takes off (or keeps flying) and holds `height` metres above the ground (default its own
   * cruising height), at `speed` (default its cruise); with nowhere to go it circles, or hovers if
   * it can. Throws for a creature that cannot fly. See docs/design/10.4-flight.md.
   */
  fly(options: { height?: number; speed?: number } = {}): void {
    if (this.lod === 'baked' && !this.controller.flying) this.toFull();
    this.controller.fly(options);
  }

  /** Lands at a point (or the first clear ground ahead), then walks or swims. */
  land(target: { x: number; z: number } | null = null): void {
    if (this.lod === 'baked') this.toFull();
    this.controller.land(target);
  }

  /** In the air: from the takeoff's crouch until its feet touch down. */
  get flying(): boolean {
    return this.controller.flying;
  }

  /**
   * A blow (docs/design/10.5-hits-death.md): `direction` is where it pushes (the attacker to the
   * target), `bone` a bone name as `hitCapsules` gives it, `strength` 0 to 1 (default 0.5). It
   * flinches, and staggers if the blow would knock it over. Nothing happens to a dead creature.
   */
  hit(options: {
    direction: { x: number; y?: number; z: number };
    bone?: string;
    strength?: number;
  }): void {
    if (this.controller.dead) return;
    if (this.lod === 'baked') this.toFull();
    this.controller.hit(options);
  }

  /**
   * Dies: it collapses onto the ground over about a second, falling away from `direction`
   * (where the killing blow pushes), and lies there; `spawn` or `controller.place` brings one back.
   */
  die(options: { direction?: { x: number; y?: number; z: number } } = {}): void {
    if (this.lod === 'baked') this.toFull();
    this.controller.die(options);
  }

  /** Dead (dying or lying still). */
  get dead(): boolean {
    return this.controller.dead;
  }

  /** Collapsing, before it comes to rest. */
  get dying(): boolean {
    return this.controller.dying;
  }

  /**
   * Spreads the wings (1) or folds them (0) when no action asks otherwise; they move there over
   * about 0.4 s. Flying spreads them whatever this says.
   */
  setWings(spread: number): void {
    if (this.lod === 'baked' && spread > 0) this.toFull();
    this.controller.setWings(spread);
  }

  /** How far the wings are spread now, 0 folded to 1. */
  get wingSpread(): number {
    return this.controller.wingSpread;
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
    if (input.ground) this.ground = input.ground;
    if (input.water) this.water = input.water;
    let events: MotionEvent[];
    if (this.lod === 'baked') events = this.updateBaked(dt, input.ground, input.water);
    else {
      events = this.controller.update(dt, {
        ...(input.ground ? { ground: input.ground } : {}),
        ...(input.water ? { water: input.water } : {}),
      });
      applyPose(this.view, this.controller.pose);
    }
    for (const event of events) {
      for (const listener of this.listeners.get(event.type) ?? []) listener(event);
      for (const listener of this.listeners.get('*') ?? []) listener(event);
    }
    return events;
  }

  /** The meshes' level of detail drawn: 0 is every triangle, 1 to 3 the simplified levels. */
  get detail(): number {
    return this.level;
  }

  /**
   * Draws level `k` of a species' levels of detail, 0 for every triangle (`bestiary.update` does
   * it by screen size). Fur shells share the skin's geometry and follow it.
   */
  setDetail(k: number, lods?: LiveLods): void {
    const level = lods ? Math.max(0, Math.min(k, lods.levels.length)) : 0;
    if (level === this.level) return;
    const { skin, parts } = this.view.meshes;
    skin.geometry.setIndex(
      level === 0 ? this.full.skin : (lods?.skin[level - 1] ?? this.full.skin),
    );
    parts.geometry.setIndex(
      level === 0 ? this.full.parts : (lods?.parts[level - 1] ?? this.full.parts),
    );
    this.level = level;
  }

  /** Switches between full and baked motion (`bestiary.update` does it by camera distance). */
  setLod(lod: 'full' | 'baked', ground?: Ground): void {
    if (lod === this.lod) return;
    if (lod === 'full') this.toFull(ground);
    else {
      // Busy with an action, taking off, landing or dying: finish it at full detail first.
      if (this.controller.action || this.controller.dying) return;
      if (this.controller.flying && this.controller.flightStage !== 'flight') return;
      this.lod = 'baked';
      this.baked.speed = this.controller.speed;
      this.baked.time = 0;
      // Fur shells cost fill rate a distant creature does not repay.
      if (this.view.meshes.fur) this.view.meshes.fur.visible = false;
    }
  }

  private toFull(ground?: Ground): void {
    if (this.lod === 'full') return;
    this.lod = 'full';
    if (this.view.meshes.fur) this.view.meshes.fur.visible = true;
    // A flyer has kept flying all along, and a dead one lies where it fell: they carry on in
    // place.
    if (this.controller.flying || this.controller.dead) return;
    const target = this.baked.target;
    this.controller.place(
      this.position.x,
      this.position.z,
      this.heading,
      ground ?? this.ground,
      this.water,
    );
    if (target) this.controller.moveTo({ x: target.x, z: target.z }, { speed: this.desired });
  }

  /** Cheap motion for distant creatures: steer, then play the nearest baked gait cycle. */
  private updateBaked(
    dt: number,
    ground: Ground = () => ({ height: 0 }),
    water?: Water,
  ): MotionEvent[] {
    const b = this.baked;
    const c = this.controller;
    // A distant corpse keeps its last pose.
    if (c.dead) return [];
    if (c.flying) return this.updateBakedAir(dt, ground, water);
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
    // A distant swimmer keeps its depth (clear of the bed); everything else stands on the ground.
    const bed = ground(c.position.x, c.position.z).height;
    const swimming = c.medium === 'water' && water?.(c.position.x, c.position.z);
    c.position.y = swimming ? Math.max(bed, c.position.y) : bed;
    // The gait cycle whose speed is nearest, or idle when standing; in water, a swimming one.
    const medium = swimming ? 'water' : 'land';
    const clips = this.clips().filter(
      (clip) =>
        clip.name === 'idle' ||
        (clip.speed > 0 &&
          (this.compiled.motion.gaits.find((g) => g.id === clip.name)?.medium ?? 'land') ===
            medium),
    );
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
    // Pulsing patterns keep time.
    this.view.signals.time.value += dt;
    if (!clip) return [];
    // Cycles play at the rate the speed calls for; idle plays in real time.
    const rate = clip.speed > 0 ? b.speed / clip.speed : 1;
    b.time = (b.time + dt * rate) % clip.duration;
    this.applyClip(clip, b.time);
    return [];
  }

  /**
   * A distant flyer keeps flying (the controller steps without posing) and plays its air gait's
   * cycle, tilted to its pitch and bank. A landing goes back to full detail.
   */
  private updateBakedAir(dt: number, ground: Ground, water?: Water): MotionEvent[] {
    const c = this.controller;
    const b = this.baked;
    const events = c.update(dt, { ground, ...(water ? { water } : {}), pose: false });
    this.view.signals.time.value += dt;
    if (!c.flying || c.flightStage !== 'flight') {
      this.toFull();
      c.update(0, { ground, ...(water ? { water } : {}) });
      applyPose(this.view, c.pose);
      return events;
    }
    const clip = this.clips().find((k) => k.name === c.gait?.id && k.air);
    if (clip !== b.clip) {
      b.clip = clip;
      b.time = 0;
    }
    if (!clip) return events;
    b.time = (b.time + dt) % clip.duration;
    this.applyClip(clip, b.time);
    return events;
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
      // An air cycle tilts with the flight: its pitch from the one baked, and the bank.
      if (clip.air) {
        const { pitch, roll } = this.controller.attitude;
        root.quaternion.premultiply(
          new Quaternion().setFromEuler(new Euler(clip.air.pitch - pitch, 0, roll, 'YXZ')),
        );
      }
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
    // Its own indices back, so disposing frees nothing the species' other creatures draw.
    this.setDetail(0);
    this.view.dispose();
  }
}

/** A species' levels of detail, from `@spawnforge/bake/lod` (loaded the first time). */
async function liveLods(compiled: CompiledCreature): Promise<LiveLods> {
  const { simplifyChain } = await import('@spawnforge/bake/lod');
  const [skin, parts] = await Promise.all([
    simplifyChain(compiled.skin),
    simplifyChain(compiled.parts),
  ]);
  return {
    skin: skin.map((l) => new BufferAttribute(l.indices, 1)),
    parts: parts.map((l) => new BufferAttribute(l.indices, 1)),
    levels: skin.map((l, i) => ({ error: Math.max(l.error, parts[i]?.error ?? 0) })),
  };
}

/** What the level of detail needs of a camera, at `distance` from it. */
function lodView(
  camera: Camera,
  distance: number,
): { fov: number; distance: number } | { height: number } {
  const ortho = camera as OrthographicCamera;
  if (ortho.isOrthographicCamera) return { height: (ortho.top - ortho.bottom) / ortho.zoom };
  const persp = camera as PerspectiveCamera;
  return { fov: persp.isPerspectiveCamera ? persp.getEffectiveFOV() : 50, distance };
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
  /**
   * A game's numbers for a creature from a stats module (e.g. "rpg"): its body measured and its
   * motion analysed, so it takes a moment; call it once per species or creature, not per frame.
   */
  stats(
    creature: Creature,
    module: string,
    params?: Readonly<Record<string, unknown>>,
  ): Record<string, number>;
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
  // Levels of detail per species: absent until asked for, a promise while they are made.
  const lods = new WeakMap<CompiledCreature, LiveLods | Promise<void>>();
  const lodsOf = (compiled: CompiledCreature): LiveLods | undefined => {
    const known = lods.get(compiled);
    if (known && !(known instanceof Promise)) return known;
    if (!known)
      lods.set(
        compiled,
        liveLods(compiled).then(
          (made) => void lods.set(compiled, made),
          // Without the simplifier (or on any failure), creatures keep every triangle.
          () => {},
        ),
      );
    return undefined;
  };

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
      const creature = new Creature(withSeed, compiled, registry, clips, spawn);
      creatures.add(creature);
      return creature;
    },
    update(dt, input = {}) {
      const eye = input.camera?.getWorldPosition(new Vector3());
      for (const creature of creatures) {
        if (eye) {
          const distance = creature.position.distanceTo(eye);
          const far = distance > lodDistance * creature.compiled.scale;
          creature.setLod(far ? 'baked' : 'full', input.ground);
          const chain = options.lods === false ? undefined : lodsOf(creature.compiled);
          if (chain && input.camera) {
            // From the creature's nearest point: its root less the radius of its bounds.
            const { min, max } = creature.compiled.bounds;
            const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2;
            const view = lodView(input.camera, Math.max(distance - radius, 1e-3));
            creature.setDetail(pickLevel(chain.levels, view, input.pixels ?? 1080), chain);
          }
        }
        creature.update(dt, input);
      }
    },
    stats(creature, module, params = {}) {
      const spec = resolveBlueprint(creature.blueprint, registry);
      return computeStats(spec, analyzeCreature(spec, registry), registry, module, params);
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
