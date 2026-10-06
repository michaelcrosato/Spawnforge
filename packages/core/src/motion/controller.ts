import { Euler, Quaternion, Vector3 } from 'three';
import type { Temperament } from '../blueprint/creature.ts';
import type { CompiledCreature, LegRigData } from '../compile/compile.ts';
import { type PreparedLimb, prepareLimb, solvePrepared } from '../compile/ik.ts';
import type { ActionModule, Registry } from '../registry.ts';
import { createRng, type Rng } from '../rng.ts';
import type { ActionContext, ActionGoals, ActionHooks } from './actions.ts';
import { Pose } from './pose.ts';

const G = 9.81;
const STEP = 1 / 120;
const UP = new Vector3(0, 1, 0);

/** Gait timing resolved for one creature (from the gait modules at compile time). */
export interface GaitInfo {
  readonly id: string;
  /** Phase offset between successive leg pairs, for this creature's pair count. */
  readonly wave: number;
  readonly duty: number;
  /** Speeds the gait suits, as Froude numbers. */
  readonly froude: readonly [number, number];
  /** Foot lift as a share of hip height. */
  readonly stepHeight: number;
  readonly stride: number;
  /** Slither gaits move the spine instead of legs. */
  readonly spine: boolean;
  readonly amplitude: number;
  readonly waves: number;
}

export interface MotionData {
  readonly temperament: Temperament;
  readonly gaits: readonly GaitInfo[];
  /** Actions the creature can perform, with resolved parameters. */
  readonly actions: readonly { readonly id: string; readonly params: Record<string, unknown> }[];
}

export interface GroundSample {
  readonly height: number;
  readonly normal?: readonly [number, number, number];
}
/** Height (and optionally normal) of the ground at (x, z). */
export type Ground = (x: number, z: number) => GroundSample;
const FLAT: Ground = () => ({ height: 0 });

/**
 * Something that happened during `update`: a `footstep` (with `leg` and `position`), a `gait`
 * change, an action's start and end (`action-start`, `action-end`), or an event an action
 * declares, such as `bite-contact` or `roar-peak` (with `action` and the head's `position`).
 */
export interface MotionEvent {
  readonly type: string;
  readonly time: number;
  readonly leg?: string;
  readonly position?: readonly [number, number, number];
  readonly gait?: string;
  readonly action?: string;
}

/** Pace, posture and attitude per temperament. */
const TEMPERAMENTS: Record<
  Temperament,
  { walk: number; turn: number; crouch: number; headDrop: number }
> = {
  calm: { walk: 0.12, turn: 100, crouch: 0, headDrop: 0 },
  stalking: { walk: 0.06, turn: 70, crouch: 0.1, headDrop: 0.25 },
  skittish: { walk: 0.22, turn: 200, crouch: 0, headDrop: 0 },
  aggressive: { walk: 0.3, turn: 150, crouch: 0.05, headDrop: 0.1 },
  lumbering: { walk: 0.08, turn: 55, crouch: 0, headDrop: 0.05 },
};

interface LegState {
  readonly rig: LegRigData;
  readonly limb: PreparedLimb;
  readonly offset: number;
  /** Rest foot position relative to the root, in body space. */
  readonly neutral: Vector3;
  readonly pole: Vector3;
  readonly footLift: number;
  readonly planted: Vector3;
  readonly liftoff: Vector3;
  readonly target: Vector3;
  swinging: boolean;
  /** Ready to lift: set during stance, cleared at lift-off. */
  armed: boolean;
  readonly points: Vector3[];
}

interface Spring {
  readonly bones: readonly number[];
  readonly points: Vector3[];
  readonly previous: Vector3[];
  readonly lengths: number[];
  readonly stiffness: number;
}

export interface MotionOptions {
  /** Module registry, for the action modules' code. Without it the creature only moves. */
  readonly registry?: Registry;
  /** Gait and action data (default: the compiled creature's own). */
  readonly motion?: MotionData;
}

interface RunningAction {
  readonly id: string;
  readonly hooks: ActionHooks;
  readonly params: Record<string, unknown>;
  readonly target: Vector3 | null;
  readonly start: number;
  readonly duration: number;
  readonly events: readonly { at: number; type: string }[];
  readonly rng: Rng;
  progress: number;
}

const damp = (current: number, target: number, rate: number, dt: number) =>
  target + (current - target) * Math.exp(-rate * dt);

/**
 * Procedural locomotion. Motion is body-relative goals fitted to whatever skeleton the creature
 * has: legs step in a gait phase pattern, feet plant on the ground and IK fits the legs, the
 * spine bends into turns, the head stays level and tails swing on springs. Deterministic at a
 * fixed 120 Hz step.
 */
export class MotionController {
  readonly pose: Pose;
  /** Root position on the ground and facing (radians; 0 faces +Z). */
  readonly position = new Vector3();
  heading = 0;
  speed = 0;
  time = 0;
  /** Gait phase, 0 to 1. */
  phase = 0;
  gait: GaitInfo | undefined;

  private readonly compiled: CompiledCreature;
  private readonly motion: MotionData;
  private readonly hipHeight: number;
  private readonly legs: LegState[];
  private readonly springs: Spring[];
  private readonly trail: Vector3[] = [];
  private target: Vector3 | null = null;
  private desiredSpeed = 0;
  private lookTarget: Vector3 | null = null;
  private yawRate = 0;
  private accumulator = 0;
  private pitch = 0;
  private roll = 0;
  private bodyY = 0;
  private bend = 0;
  private events: MotionEvent[] = [];
  private readonly restBodyY: number;
  private readonly halfStride: number;
  /** A legless body whose neck rises well above it in the rest pose. */
  private readonly rearing: boolean;
  /** Per leg (in `compiled.rig.legs` order): how far the foot was out of reach last frame (m). */
  readonly legMiss: number[] = [];
  /** √(hip height / 1 m): actions and springs run slower on big creatures. */
  readonly timeScale: number;
  private readonly actionDefs = new Map<
    string,
    { hooks: ActionHooks; params: Record<string, unknown> }
  >();
  private readonly ambient: {
    id: string;
    hooks: ActionHooks;
    params: Record<string, unknown>;
    rng: Rng;
  }[] = [];
  private current: RunningAction | null = null;
  private actionCount = 0;
  private goals: ActionGoals = {};
  private readonly springRest: Vector3[] = [];
  private readonly slitherJoints: Vector3[] = [];

  constructor(compiled: CompiledCreature, options: MotionOptions = {}) {
    const motion = options.motion ?? compiled.motion;
    this.compiled = compiled;
    this.motion = motion;
    this.pose = new Pose(compiled.bones);
    // Legless bodies have no hips; their pace scales with body length instead.
    this.hipHeight =
      compiled.rig.posture === 'legless'
        ? Math.max(0.05 * compiled.scale, 0.12 * this.spineLength())
        : Math.max(0.05 * compiled.scale, compiled.rig.hipHeight);
    const spine0 = compiled.rig.spine[0] as number;
    this.restBodyY = (this.pose.restPos[spine0] as Vector3).y;
    this.bodyY = this.restBodyY;
    const legGaits = motion.gaits.filter((g) => !g.spine);
    this.gait = legGaits[0] ?? motion.gaits[0];
    this.legs = compiled.rig.legs.map((rig) => {
      const s = rig.side === 'left' ? 0 : 1;
      const wave = this.gait?.wave ?? 0.25;
      const neutral = new Vector3(...rig.restFoot);
      return {
        rig,
        limb: prepareLimb({ lengths: rig.lengths, bends: rig.bends }),
        offset: (((rig.pair * wave + 0.5 * s) % 1) + 1) % 1,
        neutral,
        pole: new Vector3(...rig.pole),
        footLift: neutral.y,
        planted: neutral.clone(),
        liftoff: neutral.clone(),
        target: neutral.clone(),
        swinging: false,
        armed: true,
        points: Array.from({ length: rig.lengths.length + 1 }, () => new Vector3()),
      };
    });
    // How far a foot can travel fore and aft of its neutral spot while planted.
    this.halfStride = Math.max(
      0.05 * compiled.scale,
      Math.min(
        ...this.legs.map((leg) => {
          // Room fore and aft of the rest foot within the leg's reach, allowing for how far the
          // foot sits out to the side and ahead of or behind the hip.
          const hip = this.pose.restWorldPos[leg.rig.bones[0] as number] as Vector3;
          const dx = leg.neutral.x - hip.x;
          const dy = hip.y - leg.neutral.y;
          // Bipeds stand nearly straight-legged and use more of their reach.
          const most = (this.legs.length <= 2 ? 0.97 : 0.93) * leg.rig.reach;
          const across = Math.sqrt(Math.max(0, most * most - dx * dx - dy * dy));
          return Math.max(0, across - Math.abs(leg.neutral.z - hip.z)) * 0.85;
        }),
        Number.POSITIVE_INFINITY,
      ),
    );
    const neckRoot = compiled.rig.neck[0];
    this.rearing =
      compiled.rig.posture === 'legless' &&
      neckRoot !== undefined &&
      (this.pose.restWorldPos[compiled.rig.head] as Vector3).y -
        (this.pose.restWorldPos[neckRoot] as Vector3).y >
        3 * (compiled.bones.radii[neckRoot] ?? 0);
    this.timeScale = Math.sqrt(this.hipHeight / 1);
    const rng = createRng(compiled.seed);
    for (const action of motion.actions) {
      const module = options.registry?.get('action', action.id) as ActionModule | undefined;
      const hooks = module?.hooks;
      if (!hooks) continue;
      this.actionDefs.set(action.id, { hooks, params: action.params });
      if (hooks.ambient)
        this.ambient.push({
          id: action.id,
          hooks,
          params: action.params,
          rng: rng.stream(`action.${action.id}`),
        });
    }
    this.springs = [];
    if (compiled.rig.tail.length > 1) this.springs.push(this.makeSpring(compiled.rig.tail, 0.35));
    this.pose.solve();
  }

  private makeSpring(bones: readonly number[], stiffness: number): Spring {
    const points = [
      ...bones.map((b) => (this.pose.worldPos[b] as Vector3).clone()),
      this.pose.tail(bones.at(-1) as number),
    ];
    return {
      bones,
      points,
      previous: points.map((p) => p.clone()),
      lengths: bones.map((b) => this.pose.lengths[b] as number),
      stiffness,
    };
  }

  /** Walk toward a point on the ground. `speed` in m/s (default: the temperament's pace). */
  moveTo(target: { x: number; z: number } | null, options: { speed?: number } = {}): void {
    if (!target) {
      this.target = null;
      this.desiredSpeed = 0;
      return;
    }
    this.target = new Vector3(target.x, 0, target.z);
    this.desiredSpeed = options.speed ?? this.paceSpeed();
  }

  /** Keep moving at a speed and heading (radians), with no target. */
  drive(speed: number, heading?: number): void {
    this.target = null;
    this.desiredSpeed = Math.max(0, speed);
    if (heading !== undefined) this.driveHeading = heading;
  }
  private driveHeading: number | undefined;

  stop(): void {
    this.moveTo(null);
  }

  /**
   * Starts an action by id (one of the creature's `motion.actions`), aimed at `target` if given.
   * A running action is replaced. Needs the registry passed to the constructor.
   */
  act(id: string, options: { target?: { x: number; y: number; z: number } | null } = {}): void {
    const def = this.actionDefs.get(id);
    if (!def || def.hooks.ambient) {
      const known = this.motion.actions.map((a) => a.id);
      throw new Error(
        !known.includes(id)
          ? `"${id}" is not one of this creature's actions (${known.join(', ') || 'none'})`
          : def
            ? `"${id}" runs by itself and cannot be started`
            : `no code for action "${id}": pass the module registry to the MotionController`,
      );
    }
    if (this.current)
      this.events.push({ type: 'action-end', time: this.time, action: this.current.id });
    const target = options.target
      ? new Vector3(options.target.x, options.target.y, options.target.z)
      : null;
    this.current = {
      id,
      hooks: def.hooks,
      params: def.params,
      target,
      start: this.time,
      duration: Math.max(0.05, def.hooks.duration(def.params) * this.timeScale),
      events: [...(def.hooks.events?.(def.params) ?? [])].sort((a, b) => a.at - b.at),
      rng: createRng(this.compiled.seed).stream(`act.${id}.${this.actionCount++}`),
      progress: -1,
    };
    this.events.push({ type: 'action-start', time: this.time, action: id });
  }

  /** True for bodies without legs (they slither). */
  get legless(): boolean {
    return this.compiled.rig.posture === 'legless';
  }

  /** The main action running now, if any. */
  get action(): string | null {
    return this.current?.id ?? null;
  }

  /** The running action's progress (0 to 1) and length in seconds, if one is running. */
  get actionState(): { id: string; progress: number; duration: number } | null {
    const c = this.current;
    return c ? { id: c.id, progress: Math.max(0, c.progress), duration: c.duration } : null;
  }

  /** Actions `act` can start (ambient ones such as idle run by themselves). */
  actions(): string[] {
    return [...this.actionDefs].filter(([, d]) => !d.hooks.ambient).map(([id]) => id);
  }

  /** Use only this gait (by id) whatever the speed, or `null` to choose by speed again. */
  lockGait(id: string | null): void {
    this.lockedGait = id ? this.motion.gaits.find((g) => g.id === id) : undefined;
    if (id && !this.lockedGait)
      throw new Error(
        `no gait "${id}" for this creature; it has ${this.motion.gaits.map((g) => g.id).join(', ') || 'none'}`,
      );
    if (this.lockedGait && this.lockedGait !== this.gait) {
      this.gait = this.lockedGait;
      this.retimeLegs();
    }
  }
  private lockedGait: GaitInfo | undefined;

  /** Speed (m/s) at which a gait looks typical: mid-range of its Froude numbers, capped at 1. */
  gaitSpeed(id: string): number {
    const gait = this.motion.gaits.find((g) => g.id === id);
    if (!gait)
      throw new Error(
        `no gait "${id}" for this creature; it has ${this.motion.gaits.map((g) => g.id).join(', ') || 'none'}`,
      );
    const [lo, hi] = gait.froude;
    const fr = Math.max(lo + 0.05, Math.min((lo + hi) / 2, 1, hi));
    return Math.sqrt(fr * G * this.hipHeight);
  }

  /** Each leg's foot: where it is and whether it is planted. */
  feet(): { leg: string; planted: boolean; position: Vector3 }[] {
    return this.legs.map((l) => ({ leg: l.rig.id, planted: !l.swinging, position: l.planted }));
  }

  lookAt(point: { x: number; y: number; z: number } | null): void {
    this.lookTarget = point ? new Vector3(point.x, point.y, point.z) : null;
  }

  /** Walking speed for the temperament, from its Froude number. */
  paceSpeed(): number {
    const fr = TEMPERAMENTS[this.motion.temperament].walk;
    return Math.sqrt(fr * G * this.hipHeight);
  }

  /** Fastest speed any of its gaits allows. */
  maxSpeed(): number {
    const fr = Math.max(...this.motion.gaits.map((g) => g.froude[1]), 0.5);
    return Math.sqrt(Math.min(fr, 1.5) * G * this.hipHeight);
  }

  /** Advances by `dt` seconds and poses the skeleton. Returns events since the last update. */
  update(dt: number, input: { ground?: Ground } = {}): MotionEvent[] {
    const ground = input.ground ?? FLAT;
    this.accumulator += Math.min(dt, 0.25);
    let steps = 0;
    while (this.accumulator >= STEP && steps < 30) {
      this.step(STEP, ground);
      this.accumulator -= STEP;
      steps++;
    }
    this.applyPose(ground);
    const events = this.events;
    this.events = [];
    return events;
  }

  private step(dt: number, ground: Ground): void {
    this.time += dt;
    const temperament = TEMPERAMENTS[this.motion.temperament];
    this.updateGoals();

    // Steering.
    let wantSpeed = this.goals.stop ? 0 : this.desiredSpeed;
    let wantHeading = this.driveHeading ?? this.heading;
    if (this.target) {
      const to = new Vector3(this.target.x - this.position.x, 0, this.target.z - this.position.z);
      const distance = to.length();
      const arrive = Math.max(0.3 * this.hipHeight, 0.05);
      if (distance < arrive) {
        this.target = null;
        wantSpeed = 0;
        this.desiredSpeed = 0;
      } else {
        wantHeading = Math.atan2(to.x, to.z);
        wantSpeed = Math.min(wantSpeed, distance * 1.5);
      }
    }
    let turn = wrapAngle(wantHeading - this.heading);
    const maxTurn = ((temperament.turn * Math.PI) / 180) * dt;
    // Slow down for sharp turns.
    if (Math.abs(turn) > 0.6) wantSpeed *= 0.4;
    turn = Math.max(-maxTurn, Math.min(maxTurn, turn));
    this.heading = wrapAngle(this.heading + turn);
    this.yawRate = damp(this.yawRate, turn / dt, 8, dt);
    const accel = 2.5 * Math.sqrt(G * this.hipHeight);
    this.speed += Math.max(-accel * dt, Math.min(accel * dt, wantSpeed - this.speed));
    if (this.speed < 1e-4 && wantSpeed === 0) this.speed = 0;
    const forward = new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.position.addScaledVector(forward, this.speed * dt);
    this.position.y = ground(this.position.x, this.position.z).height;

    // Gait from speed (Froude number), switching walk to trot near 0.5.
    const froude = (this.speed * this.speed) / (G * this.hipHeight);
    const legGaits = this.motion.gaits.filter((g) => !g.spine);
    if (legGaits.length > 1 && !this.lockedGait) {
      const best = legGaits.reduce((a, g) =>
        froude >= g.froude[0] &&
        froude <= g.froude[1] &&
        (a.froude[0] > froude || a.froude[1] < froude || g.froude[0] > a.froude[0])
          ? g
          : a,
      );
      if (best !== this.gait) {
        this.gait = best;
        this.events.push({ type: 'gait', time: this.time, gait: best.id });
        this.retimeLegs();
      }
    }

    if (this.compiled.rig.posture === 'legless') {
      this.stepSlither(dt, ground);
    } else {
      this.stepLegs(dt, ground, froude);
    }
    this.stepSprings(dt);
  }

  /** Ambient goals, then the main action's on top; fires the action's events as it passes them. */
  private updateGoals(): void {
    const goals: ActionGoals = {};
    const rig = this.compiled.rig;
    const head = this.pose.worldPos[rig.head] as Vector3;
    const forward = scratch3.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    const base = {
      timeScale: this.timeScale,
      head,
      forward,
      speed: this.speed,
      busy: this.current !== null,
    };
    for (const a of this.ambient) {
      const ctx: ActionContext = {
        ...base,
        t: 0,
        elapsed: this.time,
        duration: 0,
        params: a.params,
        target: null,
        rng: a.rng,
      };
      a.hooks.goals(ctx, goals);
    }
    const c = this.current;
    if (c) {
      const before = c.progress;
      c.progress = Math.min(1, (this.time - c.start) / c.duration);
      for (const e of c.events) {
        if (e.at > before && e.at <= c.progress)
          this.events.push({
            type: e.type,
            time: this.time,
            action: c.id,
            position: [head.x, head.y, head.z],
          });
      }
      const main: ActionGoals = {};
      c.hooks.goals(
        {
          ...base,
          t: c.progress,
          elapsed: this.time - c.start,
          duration: c.duration,
          params: c.params,
          target: c.target,
          rng: c.rng,
        },
        main,
      );
      Object.assign(goals, main);
      if (c.progress >= 1) {
        this.events.push({ type: 'action-end', time: this.time, action: c.id });
        this.current = null;
      }
    }
    this.goals = goals;
  }

  private retimeLegs(): void {
    const wave = this.gait?.wave ?? 0.25;
    for (const leg of this.legs) {
      const s = leg.rig.side === 'left' ? 0 : 1;
      (leg as { offset: number }).offset = (((leg.rig.pair * wave + 0.5 * s) % 1) + 1) % 1;
    }
  }

  private stepLegs(dt: number, ground: Ground, froude: number): void {
    const gait = this.gait;
    const duty = gait?.duty ?? 0.7;
    const h = this.hipHeight;
    // Stride length from dynamic similarity (Alexander): λ/h = 2.3 Fr^0.3, but never more than
    // the legs can reach: past that the creature steps faster instead.
    const natural =
      Math.max(0.35 * h, 2.3 * h * Math.max(froude, 0.01) ** 0.3) * (gait?.stride ?? 1);
    const stride = Math.min(natural, (2 * this.halfStride) / Math.max(duty, 0.3));
    let frequency = this.speed / stride;
    // Keep stepping while turning on the spot or settling feet after stopping, and finish any
    // swing in progress; once every foot is close to its rest spot the legs stand still.
    const turning = Math.abs(this.yawRate) > 0.15;
    const restless = turning || this.legs.some((l) => l.swinging || this.footError(l) > 0.12 * h);
    const minimum = (0.25 * Math.sqrt(G / h)) / Math.PI;
    if (restless) frequency = Math.max(frequency, minimum);
    // Step faster when a planted foot would fall out of reach before its lift-off (starting
    // off, speeding up): it has `halfStride` behind its rest spot plus however far ahead it is.
    const unhurried = frequency;
    for (const leg of this.legs) {
      if (leg.swinging) continue;
      const local = (((this.phase - leg.offset) % 1) + 1) % 1;
      if (local >= duty) continue;
      const budget = Math.max(0.05 * this.halfStride, this.halfStride + this.footAhead(leg));
      frequency = Math.max(frequency, (this.speed * (duty - local)) / budget);
    }
    frequency = Math.min(frequency, Math.max(unhurried * 3, minimum));
    const previous = this.phase;
    this.phase = (this.phase + frequency * dt) % 1;
    const advanced = frequency > 0;

    for (const leg of this.legs) {
      if (!advanced) break;
      // A leg's cycle starts `offset` after the creature's: φ = (i·w + 0.5·s) mod 1.
      const before = (((previous - leg.offset) % 1) + 1) % 1;
      const now = (((this.phase - leg.offset) % 1) + 1) % 1;
      const crossedLand = now < before;
      // A leg lifts once per cycle, when its phase is in the swing window after a stance.
      if (now < duty) leg.armed = true;
      const needed = this.speed > 0.02 * h || turning || this.footError(leg) > 0.04 * h;
      if (leg.armed && now >= duty && !leg.swinging && needed) {
        leg.armed = false;
        leg.swinging = true;
        leg.liftoff.copy(leg.planted);
      }
      if (leg.swinging) {
        // Swing progress; on the step the phase wraps past 1 the swing is complete.
        const u = crossedLand ? 1 : Math.min(1, Math.max(0, (now - duty) / (1 - duty)));
        // Aim where the hip will be at landing, half a stance ahead.
        const timeToLand = ((1 - u) * (1 - duty)) / Math.max(frequency, 1e-3);
        const stanceTime = duty / Math.max(frequency, 1e-3);
        const futureHeading = this.heading + this.yawRate * timeToLand;
        const ahead = this.speed * (timeToLand + stanceTime * 0.5);
        this.neutralAt(leg, futureHeading, leg.target);
        leg.target.x += Math.sin(this.heading) * ahead;
        leg.target.z += Math.cos(this.heading) * ahead;
        leg.target.y = ground(leg.target.x, leg.target.z).height + leg.footLift;
        if (crossedLand || u >= 1) {
          leg.swinging = false;
          leg.planted.copy(leg.target);
          this.events.push({
            type: 'footstep',
            time: this.time,
            leg: leg.rig.id,
            position: [leg.planted.x, leg.planted.y, leg.planted.z],
          });
        } else {
          const e = u * u * (3 - 2 * u);
          leg.planted.lerpVectors(leg.liftoff, leg.target, e);
          leg.planted.y += Math.sin(Math.PI * u) * (gait?.stepHeight ?? 0.15) * h;
        }
      }
    }

    // Body height, pitch and roll follow the feet.
    let front = 0;
    let back = 0;
    let left = 0;
    let right = 0;
    let nf = 0;
    let nb = 0;
    let nl = 0;
    let nr = 0;
    const maxPair = Math.max(0, ...this.legs.map((l) => l.rig.pair));
    // Swinging feet count at their landing height, not mid-arc.
    const footY = (leg: LegState) => (leg.swinging ? leg.target.y : leg.planted.y);
    for (const leg of this.legs) {
      const lift = footY(leg) - leg.footLift - this.position.y;
      if (leg.rig.pair === maxPair && maxPair > 0) {
        front += lift;
        nf++;
      } else if (leg.rig.pair === 0) {
        back += lift;
        nb++;
      }
      if (leg.rig.side === 'left') {
        left += lift;
        nl++;
      } else {
        right += lift;
        nr++;
      }
    }
    const span = Math.max(
      0.2 * h,
      Math.abs(
        (this.legs.find((l) => l.rig.pair === maxPair)?.neutral.z ?? 0) -
          (this.legs.find((l) => l.rig.pair === 0)?.neutral.z ?? 0),
      ),
    );
    const width = Math.max(
      0.1 * h,
      Math.abs((this.legs.find((l) => l.rig.side === 'left')?.neutral.x ?? 0) * 2),
    );
    const wantPitch = nf && nb ? Math.atan2(front / nf - back / nb, span) : 0;
    const wantRoll = nl && nr ? Math.atan2(right / nr - left / nl, width) * 0.6 : 0;
    this.pitch = damp(this.pitch, Math.max(-0.5, Math.min(0.5, wantPitch)), 10, dt);
    this.roll = damp(this.roll, Math.max(-0.35, Math.min(0.35, wantRoll)), 10, dt);
    const mean =
      this.legs.reduce((a, l) => a + (footY(l) - l.footLift), 0) / Math.max(1, this.legs.length);
    const crouch = TEMPERAMENTS[this.motion.temperament].crouch * this.restBodyY;
    let wantY = this.restBodyY - crouch + (mean - this.position.y) * 0.8;
    // Sink the body where a planted foot (in a dip) would be out of the leg's reach.
    let drop = 0;
    for (const leg of this.legs) {
      if (leg.swinging) continue;
      const hip = this.pose.restWorldPos[leg.rig.bones[0] as number] as Vector3;
      const c = Math.cos(this.heading);
      const s = Math.sin(this.heading);
      const hx = this.position.x + hip.x * c + hip.z * s;
      const hz = this.position.z - hip.x * s + hip.z * c;
      const hy = this.position.y + hip.y + (wantY - this.restBodyY);
      const across = Math.hypot(leg.planted.x - hx, leg.planted.z - hz);
      const reach = 0.97 * leg.rig.reach;
      if (across >= reach) continue;
      const down = hy - leg.planted.y;
      const fits = Math.sqrt(reach * reach - across * across);
      if (down > fits) drop = Math.max(drop, down - fits);
    }
    wantY -= Math.min(drop, 0.5 * this.restBodyY);
    this.bodyY = damp(this.bodyY, wantY, 12, dt);
    this.bend = damp(this.bend, Math.max(-0.5, Math.min(0.5, this.yawRate * 0.25)), 6, dt);
  }

  private footError(leg: LegState): number {
    const n = this.neutralAt(leg, this.heading, scratch1);
    return Math.hypot(leg.planted.x - n.x, leg.planted.z - n.z);
  }

  /** How far a planted foot is ahead of its rest spot, along the heading. */
  private footAhead(leg: LegState): number {
    const n = this.neutralAt(leg, this.heading, scratch1);
    return (
      (leg.planted.x - n.x) * Math.sin(this.heading) +
      (leg.planted.z - n.z) * Math.cos(this.heading)
    );
  }

  /** Where a leg's foot rests relative to the body, for a given heading. */
  private neutralAt(leg: LegState, heading: number, out: Vector3): Vector3 {
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    const x = leg.neutral.x;
    const z = leg.neutral.z;
    return out.set(
      this.position.x + x * c + z * s,
      leg.neutral.y + this.position.y,
      this.position.z - x * s + z * c,
    );
  }

  private stepSlither(dt: number, ground: Ground): void {
    const gait = this.gait ?? this.motion.gaits[0];
    const bodyLength = this.spineLength();
    const wavelength = bodyLength / Math.max(0.5, gait?.waves ?? 1.5);
    const amplitude =
      (gait?.amplitude ?? 0.18) *
      bodyLength *
      Math.min(1, this.speed / Math.max(1e-3, this.paceSpeed()) + 0.15);
    this.phase = (this.phase + (this.speed * dt) / wavelength) % 1;
    // The head weaves around the travel line; the body follows its trail.
    const forward = new Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const side = new Vector3(forward.z, 0, -forward.x);
    const head = this.position
      .clone()
      .addScaledVector(side, Math.sin(this.phase * Math.PI * 2) * amplitude);
    head.y = ground(head.x, head.z).height;
    // The newest point follows the head; a new one is laid down each time the head gets a
    // spacing away from the last fixed point.
    const anchor = this.trail[1];
    if (!anchor || anchor.distanceTo(head) > bodyLength / 100) this.trail.unshift(head);
    else (this.trail[0] as Vector3).copy(head);
    // Keep enough trail for the whole body.
    let acc = 0;
    for (let i = 1; i < this.trail.length; i++) {
      acc += (this.trail[i] as Vector3).distanceTo(this.trail[i - 1] as Vector3);
      if (acc > bodyLength * 1.5) {
        this.trail.length = i + 1;
        break;
      }
    }
  }

  private spineLength(): number {
    const r = this.compiled.rig;
    let len = 0;
    for (const b of [...r.neck, ...r.spine, ...r.tail]) len += this.pose.lengths[b] as number;
    return Math.max(len, 1e-3);
  }

  /**
   * Where a chain's joints would be in its rest pose, hanging off its posed parent and swung
   * sideways by `swish`: the shape a spring pulls toward.
   */
  private restChain(bones: readonly number[], swish: number): Vector3[] {
    const pose = this.pose;
    const first = bones[0] as number;
    const parent = pose.parents[first] as number;
    const rot = scratchQ3.copy(parent >= 0 ? (pose.worldRot[parent] as Quaternion) : IDENTITY);
    if (swish) rot.premultiply(scratchQ.setFromAxisAngle(UP, swish));
    const at = scratch4.copy(pose.worldPos[first] as Vector3);
    bones.forEach((b, i) => {
      if (i > 0) at.add(scratch1.copy(pose.restPos[b] as Vector3).applyQuaternion(rot));
      rot.multiply(pose.restRot[b] as Quaternion);
      const out = this.springRest[i] ?? new Vector3();
      this.springRest[i] = out;
      out
        .set(0, pose.lengths[b] as number, 0)
        .applyQuaternion(rot)
        .add(at);
    });
    return this.springRest;
  }

  private stepSprings(dt: number): void {
    for (const spring of this.springs) {
      const pts = spring.points;
      // The root follows its bone; the rest feel inertia, gravity and a pull toward rest.
      this.pose.solve();
      (pts[0] as Vector3).copy(this.pose.worldPos[spring.bones[0] as number] as Vector3);
      // Sprawlers carry the body's side-to-side wave on into the tail.
      const moving = Math.min(1, this.speed / Math.max(1e-3, this.paceSpeed()));
      const wave =
        this.compiled.rig.posture === 'sprawl'
          ? Math.sin(this.phase * Math.PI * 2 - 1.2) * 0.15 * moving
          : 0;
      const rest = this.restChain(spring.bones, (this.goals.swish ?? 0) + wave);
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i] as Vector3;
        const prev = spring.previous[i] as Vector3;
        const velocity = scratch1.subVectors(p, prev).multiplyScalar(0.92);
        prev.copy(p);
        p.add(velocity);
        p.addScaledVector(UP, -G * 0.15 * dt * dt);
        p.lerp(rest[i - 1] as Vector3, spring.stiffness);
      }
      for (let it = 0; it < 2; it++) {
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1] as Vector3;
          const b = pts[i] as Vector3;
          const len = spring.lengths[i - 1] as number;
          const d = scratch2.subVectors(b, a);
          const l = d.length() || 1;
          b.copy(a).addScaledVector(d, len / l);
        }
      }
    }
  }

  /** Writes the body, legs, head and springs into the pose. */
  private applyPose(ground: Ground): void {
    const pose = this.pose;
    const rig = this.compiled.rig;
    pose.reset();
    const root = rig.root;
    (pose.pos[root] as Vector3).copy(this.position);
    (pose.rot[root] as Quaternion).setFromAxisAngle(UP, this.heading);

    if (rig.posture === 'legless') {
      this.applySlither(ground);
      return;
    }

    // Body: height, bob and sway, pitch and roll, bend into turns, plus the action's crouch,
    // rear and weight shift.
    const g = this.goals;
    const spine0 = rig.spine[0] as number;
    const h = this.hipHeight;
    const moving = Math.min(1, this.speed / Math.max(1e-3, this.paceSpeed()));
    const bob = -Math.cos(this.phase * Math.PI * 4) * 0.025 * h * moving;
    const sway =
      (rig.legs.length <= 2 ? Math.sin(this.phase * Math.PI * 2) * 0.02 * h * moving : 0) +
      (g.shift ?? 0) * h;
    // A lunge throws the whole body forward a little, not just the neck.
    const lunge = (g.reach ?? 0) * 0.12 * this.compiled.scale;
    (pose.pos[spine0] as Vector3).set(
      sway,
      this.bodyY + bob - (g.crouch ?? 0) * h,
      (pose.restPos[spine0] as Vector3).z + lunge,
    );
    const tilt = scratchQ3.setFromEuler(
      scratchEuler.set(-this.pitch - (g.rear ?? 0), 0, this.roll, 'YXZ'),
    );
    (pose.rot[spine0] as Quaternion).premultiply(tilt);
    const sprawl = rig.posture === 'sprawl';
    const bendBones = [...rig.spine.slice(1), ...rig.neck];
    bendBones.forEach((b, k) => {
      const wave = sprawl ? Math.sin(this.phase * Math.PI * 2 - k * 0.6) * 0.06 * moving : 0;
      const yaw = this.bend / Math.max(1, bendBones.length) + wave;
      (pose.rot[b] as Quaternion).multiply(scratchQ.setFromAxisAngle(new Vector3(0, 0, 1), -yaw));
    });
    pose.solve();

    // Head: keep it level, facing the way it walks (or toward a look target); jaw.
    this.applyHead();
    this.applyJaw();

    // Legs: IK from the posed hips to the planted feet.
    for (const [k, leg] of this.legs.entries()) {
      const first = leg.rig.bones[0] as number;
      pose.solveBone(first);
      const hip = pose.worldPos[first] as Vector3;
      const pole = scratch1.copy(leg.pole).applyQuaternion(pose.worldRot[rig.root] as Quaternion);
      this.legMiss[k] = solvePrepared(leg.limb, hip, leg.planted, pole, leg.points);
      leg.rig.bones.forEach((b, k) => {
        pose.aim(b, scratch2.subVectors(leg.points[k + 1] as Vector3, leg.points[k] as Vector3));
      });
      // Toes stay flat, turned with the body.
      for (const toe of leg.rig.toes) {
        for (const b of toe) {
          pose.solveBone(b);
          const restDir = scratch2.set(0, 1, 0).applyQuaternion(pose.restWorldRot[b] as Quaternion);
          restDir.applyAxisAngle(UP, this.heading);
          pose.aim(b, restDir);
        }
      }
    }

    // Arms swing against the legs on bipeds.
    rig.arms.forEach((arm, i) => {
      const first = arm.bones[0] as number;
      const swing =
        Math.sin(this.phase * Math.PI * 2 + (arm.side === 'left' ? Math.PI : 0)) * 0.25 * moving;
      (pose.rot[first] as Quaternion).premultiply(
        scratchQ.setFromAxisAngle(new Vector3(1, 0, 0), swing * (i % 2 ? 1 : 1)),
      );
    });

    this.applySprings();
    this.applyHelpers();
    pose.solve();
  }

  private applyHead(): void {
    const pose = this.pose;
    const rig = this.compiled.rig;
    const g = this.goals;
    const head = rig.head;
    const restDir = scratch1.set(0, 1, 0).applyQuaternion(pose.restWorldRot[head] as Quaternion);
    const desired = scratch5.copy(restDir).applyAxisAngle(UP, this.heading);
    const drop = TEMPERAMENTS[this.motion.temperament].headDrop;
    if (drop) desired.y -= drop;
    desired.normalize();
    // Glances (look-around), then a look target, then raising and shaking.
    const side = scratch6.crossVectors(desired, UP);
    if (side.lengthSq() < 1e-8) side.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
    side.normalize();
    if (g.glance) {
      desired.applyAxisAngle(side, g.glance.pitch).applyAxisAngle(UP, g.glance.yaw);
    }
    const look = g.look ?? this.lookTarget;
    const weight = g.look ? (g.lookWeight ?? 1) : 1;
    const from = pose.worldPos[head] as Vector3;
    if (look && weight > 0) {
      const to = scratch2.subVectors(look, from).normalize();
      // Limit how far the head turns from the body's facing.
      const facing = scratch4.set(Math.sin(this.heading), 0, Math.cos(this.heading));
      const flat = scratch7.set(to.x, 0, to.z);
      const angle = flat.lengthSq() > 1e-8 ? facing.angleTo(flat) : 0;
      const limit = (100 * Math.PI) / 180;
      if (angle > limit) to.lerp(desired, 1 - limit / angle).normalize();
      desired.lerp(to, weight).normalize();
    }
    if (g.raise) desired.applyAxisAngle(side, g.raise);
    if (g.shake)
      desired.applyAxisAngle(UP, Math.sin((this.time * Math.PI * 14) / this.timeScale) * g.shake);
    desired.normalize();
    // Turn the neck by part of the rotation the head needs, keeping its shape (a raised neck
    // stays raised), then aim the head.
    const neck = rig.neck;
    pose.solveBone(head);
    const turn = scratchQ2.setFromUnitVectors(pose.direction(head, scratch1), desired);
    neck.forEach((b, k) => {
      pose.solveBone(b);
      const share = (k + 1) / (neck.length + 1) / neck.length;
      const part = scratchQ.identity().slerp(turn, share);
      pose.aim(b, pose.direction(b, scratch2).applyQuaternion(part));
    });
    pose.solveBone(head);
    pose.aim(head, desired);
    pose.solveSubtree(head);
    if (g.reach && look) this.lunge(look, g.reach, desired);
  }

  /**
   * Stretches the neck (or the front of the spine) so the head moves toward `point` by `amount`
   * of what it can reach, then re-aims the head (cyclic coordinate descent).
   */
  private lunge(point: Vector3, amount: number, facing: Vector3): void {
    const pose = this.pose;
    const rig = this.compiled.rig;
    const chain = rig.neck.length > 0 ? rig.neck : rig.spine.slice(-2);
    let length = 0;
    for (const b of chain) length += pose.lengths[b] as number;
    const start = pose.worldPos[rig.head] as Vector3;
    const toward = scratch2.subVectors(point, start);
    const distance = toward.length();
    if (distance < 1e-6) return;
    const goal = scratch7
      .copy(start)
      .addScaledVector(toward, (Math.min(distance * 0.9, length * 0.6) * amount) / distance);
    for (let iteration = 0; iteration < 3; iteration++) {
      for (let k = chain.length - 1; k >= 0; k--) {
        const b = chain[k] as number;
        const base = pose.worldPos[b] as Vector3;
        const a = scratch1.subVectors(pose.worldPos[rig.head] as Vector3, base).normalize();
        const c = scratch4.subVectors(goal, base).normalize();
        const turn = scratchQ.setFromUnitVectors(a, c);
        scratchQ2.identity().slerp(turn, 0.6);
        pose.aim(b, pose.direction(b, scratch6).applyQuaternion(scratchQ2));
        pose.solveSubtree(b);
      }
    }
    pose.aim(rig.head, facing);
    pose.solveSubtree(rig.head);
  }

  /** Opens the jaw by the action's `jaw` goal, about its hinge. */
  private applyJaw(): void {
    const rig = this.compiled.rig;
    const open = this.goals.jaw ?? 0;
    const pose = this.pose;
    pose.breath = this.goals.breath ?? 0;
    pose.blink = this.goals.blink ?? 0;
    if (rig.jaw < 0 || open <= 0) return;
    (pose.rot[rig.jaw] as Quaternion)
      .copy(pose.restRot[rig.jaw] as Quaternion)
      .multiply(scratchQ.setFromAxisAngle(X_AXIS, -open * 0.65));
    pose.solveSubtree(rig.jaw);
  }

  private applySprings(): void {
    for (const spring of this.springs) {
      spring.bones.forEach((b, i) => {
        this.pose.solveBone(b);
        const dir = scratch1.subVectors(
          spring.points[i + 1] as Vector3,
          spring.points[i] as Vector3,
        );
        if (dir.lengthSq() > 1e-12) this.pose.aim(b, dir);
      });
    }
  }

  private applyHelpers(): void {
    const pose = this.pose;
    for (const [helper, , lower] of this.compiled.rig.helpers) {
      const delta = scratchQ
        .copy(pose.rot[lower] as Quaternion)
        .multiply(scratchQ2.copy(pose.restRot[lower] as Quaternion).invert());
      const half = scratchQ2.identity().slerp(delta, 0.5);
      (pose.rot[helper] as Quaternion).multiplyQuaternions(
        half,
        pose.restRot[helper] as Quaternion,
      );
    }
  }

  private applySlither(ground: Ground): void {
    const pose = this.pose;
    const rig = this.compiled.rig;
    // Bones from the head end back: neck (reversed), torso (reversed), tail. A rearing neck (a
    // cobra) keeps its raised pose on the front of the body instead of following the trail.
    const lead = this.rearing ? [] : [...rig.neck].reverse();
    const chain = [...lead, ...[...rig.spine].reverse(), ...rig.tail];
    if (this.trail.length < 2) {
      pose.solve();
      return;
    }
    // Place each bone joint along the trail, measured from the head.
    // Joints at increasing distances along the trail, in one walk down it.
    const joints = this.slitherJoints;
    while (joints.length < chain.length + 1) joints.push(new Vector3());
    const trail = this.trail;
    let segment = 1;
    let acc = 0;
    let distance = 0;
    for (let j = 0; j <= chain.length; j++) {
      if (j > 0) distance += pose.lengths[chain[j - 1] as number] as number;
      const out = joints[j] as Vector3;
      let placed = false;
      while (segment < trail.length) {
        const a = trail[segment - 1] as Vector3;
        const b = trail[segment] as Vector3;
        const length = a.distanceTo(b);
        if (acc + length >= distance) {
          out.lerpVectors(a, b, (distance - acc) / (length || 1));
          placed = true;
          break;
        }
        acc += length;
        segment++;
      }
      if (!placed) {
        // Past the end of the trail: continue straight back.
        const end = trail.at(-1) as Vector3;
        const before = trail.at(-2) as Vector3;
        out
          .subVectors(end, before)
          .setLength(distance - acc)
          .add(end);
      }
    }
    joints.length = chain.length + 1;
    for (const j of joints)
      j.y = ground(j.x, j.z).height + (pose.restWorldPos[rig.spine[0] as number] as Vector3).y;
    // Torso and neck bones point toward the head; tail bones away from it.
    const spine0 = rig.spine[0] as number;
    const hipIndex = lead.length + rig.spine.length;
    const hip = joints[hipIndex] as Vector3;
    (pose.pos[spine0] as Vector3)
      .copy(hip)
      .sub(this.position)
      .applyQuaternion(scratchQ.copy(pose.rot[rig.root] as Quaternion).invert());
    pose.solve();
    [...rig.spine].forEach((b, k) => {
      const from = joints[hipIndex - k] as Vector3;
      const to = joints[hipIndex - k - 1] as Vector3;
      pose.solveBone(b);
      pose.aim(b, scratch1.subVectors(to, from));
    });
    lead
      .slice()
      .reverse()
      .forEach((b, k) => {
        const from = joints[lead.length - k] as Vector3;
        const to = joints[lead.length - k - 1] as Vector3;
        pose.solveBone(b);
        pose.aim(b, scratch1.subVectors(to, from));
      });
    pose.solveSubtree(rig.head);
    this.applyHead();
    this.applyJaw();
    rig.tail.forEach((b, k) => {
      const from = joints[hipIndex + k] as Vector3;
      const to = joints[hipIndex + k + 1] as Vector3;
      pose.solveBone(b);
      pose.aim(b, scratch1.subVectors(to, from));
    });
    pose.solve();
  }
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

const scratch1 = new Vector3();
const scratch2 = new Vector3();
const scratchQ = new Quaternion();
const scratchQ2 = new Quaternion();
const scratchQ3 = new Quaternion();
const scratch3 = new Vector3();
const scratch4 = new Vector3();
const IDENTITY = new Quaternion();
const scratch5 = new Vector3();
const scratch6 = new Vector3();
const scratch7 = new Vector3();
const scratchEuler = new Euler();
const X_AXIS = new Vector3(1, 0, 0);
