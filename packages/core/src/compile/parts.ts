import { Vector3 } from 'three';
import { hexToRgb, toHex } from '../blueprint/colors.ts';
import type { PartSpec } from '../blueprint/creature.ts';
import { type GeometryKit, geometryKit, type MeshPiece, mirrorX } from '../geometry/kit.ts';
import type { PartMaterial, PartModule, Registry } from '../registry.ts';
import { createRng, type Rng } from '../rng.ts';
import { type MouthLine, mouthPoint } from './mouth.ts';
import { type Sdf, SdfEvaluator } from './sdf.ts';
import { aroundDirection, type PathSegment, samplePath } from './skeleton.ts';
import { type WeightOptions, weightsAt } from './skin.ts';
import type { BoneDef } from './types.ts';

/** A place on the creature where a part sits, with its frame and skin weights. */
export interface Socket {
  readonly position: Vector3;
  /** Out of the skin. */
  readonly normal: Vector3;
  /** Toward the section's `at` = 0 end (snout-ward on the body, toward the root on limbs). */
  readonly forward: Vector3;
  /** normal × forward: the creature's left on the body. */
  readonly side: Vector3;
  /** Section radius here (metres). */
  readonly radius: number;
  /** Skin weights here, so the part moves with the skin. */
  readonly weights: readonly (readonly [number, number])[];
}

export interface EyeOptions {
  readonly iris: string;
  readonly sclera: string;
  readonly pupil: 'round' | 'slit' | 'goat';
  /** Iris size as a share of the visible eye (0.2–1). */
  readonly irisSize: number;
  /** Eyeball radius (metres). */
  readonly radius: number;
}

export interface EmitOptions {
  readonly color?: string;
  /** Colour at the tip (t = 1); blends from `color` along t². */
  readonly tipColor?: string;
  readonly material?: PartMaterial;
  /** How far to sink the piece into the skin along -normal (metres). */
  readonly sink?: number;
  /** Bind rigidly to this bone instead of the socket's weights. */
  readonly bone?: number;
  /** Emit an eye: it goes in the eye mesh, on a bone of its own that looks around. */
  readonly eye?: EyeOptions;
  /** Register this piece's centreline (local points and radii) so other parts can attach to it. */
  readonly path?: { readonly points: readonly Vector3[]; readonly radii: readonly number[] };
}

/** What a part module's `build` hook gets. */
export interface PartBuildContext {
  readonly id: string;
  readonly baseId: string;
  readonly type: string;
  /** Metres per torso length. */
  readonly scale: number;
  readonly mirror: 1 | -1 | 0;
  readonly at: number;
  readonly from: number;
  readonly to: number;
  readonly angle: number;
  readonly rng: Rng;
  readonly geo: GeometryKit;
  /** Resolves a colour parameter: a palette name or a colour, to `#rrggbb`. */
  color(value: unknown, fallback: string): string;
  /** A socket on the part's target (defaults to its own `at` and `angle`). */
  socket(at?: number, angle?: number): Socket;
  /** A socket on the mouth line: t = 0 at the tip, 1 at the corner; side ±1. Mouth parts only. */
  mouth(t: number, row: 'upper' | 'lower', side: number): Socket | undefined;
  /** Toe tips, for foot parts: normal along the toe, forward up. */
  readonly toes: readonly (Socket & {
    readonly bone: number;
    readonly length: number;
    readonly toeRadius: number;
  })[];
  /** Places a piece built in socket space (+Y out of the skin, +Z forward, +X side). */
  emit(piece: MeshPiece, socket: Socket, options?: EmitOptions): void;
}

/** Hooks a part module provides. */
export interface PartHooks {
  toes?(
    ctx: import('./types.ts').ToeContext,
    params: Record<string, unknown>,
  ): import('./types.ts').ToeChain[];
  build?(ctx: PartBuildContext, params: Record<string, unknown>): void;
}

const ROUGHNESS: Record<PartMaterial, number> = {
  bone: 0.55,
  horn: 0.42,
  chitin: 0.3,
  enamel: 0.3,
  eye: 0.08,
  skin: 0.7,
};
const DEFAULT_COLOR: Record<PartMaterial, string> = {
  bone: '#e2d8be',
  horn: '#d4c6a2',
  chitin: '#2b2420',
  enamel: '#efe8d0',
  eye: '#e8e2cc',
  skin: '#7a6a50',
};

/** Something worth telling the blueprint's author about a part. */
export interface PartNote {
  readonly path: string;
  readonly message: string;
  readonly code?: string;
  readonly fix?: string;
}

/** Accumulates part and eye geometry in model space. */
export class PartSink {
  /** Where each part instance sits, for labels on debug renders. */
  readonly markers = new Map<string, [number, number, number]>();
  readonly parts = {
    positions: [] as number[],
    normals: [] as number[],
    indices: [] as number[],
    color: [] as number[],
    info: [] as number[],
    weights: [] as [number, number][][],
  };
  readonly eyes = {
    positions: [] as number[],
    normals: [] as number[],
    indices: [] as number[],
    eye: [] as number[],
    iris: [] as number[],
    sclera: [] as number[],
    weights: [] as [number, number][][],
  };
}

export interface PartsInput {
  readonly bones: BoneDef[];
  readonly paths: Map<string, readonly PathSegment[]>;
  readonly sdf: Sdf;
  readonly weightOptions: WeightOptions;
  readonly mouth: MouthLine | undefined;
  readonly head: number;
  readonly jaw: number;
  readonly palette: Readonly<Record<string, string>>;
  readonly scale: number;
  readonly seed: number;
  readonly registry: Registry;
  /** Toe chains per limb instance id. */
  readonly toes: ReadonlyMap<string, readonly (readonly number[])[]>;
  /** Mirror sign per limb instance id. */
  readonly limbMirror: ReadonlyMap<string, number>;
}

const Y = new Vector3(0, 1, 0);

/** Builds every part and foot, appending eye bones to `input.bones`. Returns eye bone ids. */
export function buildParts(
  parts: readonly PartSpec[],
  feet: readonly {
    readonly limbId: string;
    readonly mirror: 1 | -1 | 0;
    readonly type: string;
    readonly params: Readonly<Record<string, unknown>>;
  }[],
  input: PartsInput,
  sink: PartSink,
): { eyeBones: number[]; notes: PartNote[] } {
  const evaluator = new SdfEvaluator(input.sdf);
  const eyeBones: number[] = [];
  const notes: PartNote[] = [];
  /** Per part instance: sampled vertices, and how many of them are outside the skin. */
  const exposure = new Map<string, { total: number; outside: number }>();
  const rng = createRng(input.seed);
  const partPaths = new Map<
    string,
    {
      points: Vector3[];
      radii: number[];
      normal: Vector3;
      bone: number;
      weights: readonly (readonly [number, number])[];
    }
  >();

  const resolveColor = (value: unknown, fallback: string) => {
    if (typeof value === 'string') return input.palette[value] ?? toHex(value) ?? fallback;
    return fallback;
  };

  /** March from the axis point along `dir` to the skin (or the section radius for thin bones). */
  const toSurface = (point: Vector3, dir: Vector3, radius: number) => {
    const reach = radius * 3 + 1e-4;
    const f = (s: number) =>
      evaluator.eval(point.x + dir.x * s, point.y + dir.y * s, point.z + dir.z * s);
    let lo = 0;
    let hi = -1;
    const steps = 30;
    for (let i = 1; i <= steps; i++) {
      const s = (reach * i) / steps;
      if (f(s) >= 0) {
        hi = s;
        lo = (reach * (i - 1)) / steps;
        break;
      }
    }
    if (hi < 0 || f(0) >= 0) {
      return { position: point.clone().addScaledVector(dir, radius), normal: dir.clone() };
    }
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) >= 0) hi = mid;
      else lo = mid;
    }
    const position = point.clone().addScaledVector(dir, hi);
    const normal = evaluator.gradient(position.x, position.y, position.z, radius * 0.05);
    if (normal.dot(dir) < 0.2) normal.copy(dir);
    return { position, normal };
  };

  const frameOf = (
    position: Vector3,
    normal: Vector3,
    forwardRef: Vector3,
    radius: number,
    weights: readonly (readonly [number, number])[],
  ): Socket => {
    const forward = forwardRef.clone().addScaledVector(normal, -forwardRef.dot(normal));
    if (forward.lengthSq() < 1e-10) forward.set(0, 0, 1).addScaledVector(normal, -normal.z);
    forward.normalize();
    const side = new Vector3().crossVectors(normal, forward).normalize();
    return { position, normal, forward, side, radius, weights };
  };

  const socketOn = (target: string, at: number, angle: number, mirror: number): Socket => {
    const partPath = partPaths.get(target);
    if (partPath) {
      // On another part: around its centreline.
      const n = partPath.points.length;
      const x = Math.min(1, Math.max(0, at)) * (n - 1);
      const i = Math.min(n - 2, Math.floor(x));
      const a = partPath.points[i] as Vector3;
      const b = partPath.points[i + 1] as Vector3;
      const point = new Vector3().lerpVectors(a, b, x - i);
      const along = new Vector3().subVectors(a, b).normalize();
      const up = partPath.normal
        .clone()
        .addScaledVector(along, -partPath.normal.dot(along))
        .normalize();
      const r =
        (partPath.radii[i] as number) +
        ((partPath.radii[i + 1] as number) - (partPath.radii[i] as number)) * (x - i);
      const dir = aroundDirection({ forward: along, up }, angle, mirror || 1);
      return frameOf(point.clone().addScaledVector(dir, r), dir, along, r, partPath.weights);
    }
    const path = input.paths.get(target);
    if (!path) throw new Error(`no attachment target "${target}"`);
    const frame = samplePath(input.bones, path, at);
    // On limbs, make angle 90 point away from the body whichever side the limb is on.
    let m = mirror;
    const limbMirror = input.limbMirror.get(target.replace(/\.toe\d+$/, ''));
    if (limbMirror !== undefined) {
      const left = new Vector3().crossVectors(frame.up, frame.forward);
      m = (mirror || 1) * Math.sign(left.x * (limbMirror || 1) || 1);
    }
    const dir = aroundDirection(frame, angle, m);
    const { position, normal } = toSurface(
      frame.point,
      dir,
      frame.radius * Math.max(frame.cross[0], frame.cross[1]),
    );
    // Parts follow what they attach to: weights come only from that section's bones (the head,
    // not the jaw, which is a section of its own).
    const weights = weightsAt(position, input.weightOptions, new Set(path.map((seg) => seg.bone)));
    return frameOf(position, normal, frame.forward, frame.radius, weights);
  };

  const emitInto = (
    piece: MeshPiece,
    socket: Socket,
    mirror: number,
    options: EmitOptions,
    material: PartMaterial,
    id: string,
  ) => {
    if (!sink.markers.has(id))
      sink.markers.set(id, [socket.position.x, socket.position.y, socket.position.z]);
    const local = mirror < 0 ? mirrorX(clonePiece(piece)) : piece;
    const sinkBy = options.sink ?? 0;
    const origin = socket.position.clone().addScaledVector(socket.normal, -sinkBy);
    const toWorld = (x: number, y: number, z: number, out: Vector3) =>
      out
        .copy(origin)
        .addScaledVector(socket.side, x)
        .addScaledVector(socket.normal, y)
        .addScaledVector(socket.forward, z);
    const dirWorld = (x: number, y: number, z: number, out: Vector3) =>
      out
        .set(0, 0, 0)
        .addScaledVector(socket.side, x)
        .addScaledVector(socket.normal, y)
        .addScaledVector(socket.forward, z)
        .normalize();
    const p = new Vector3();
    const nrm = new Vector3();
    if (options.path) {
      const points = options.path.points.map((q) =>
        toWorld(mirror < 0 ? -q.x : q.x, q.y, q.z, new Vector3()),
      );
      partPaths.set(id, {
        points,
        radii: [...options.path.radii],
        normal: socket.forward.clone(),
        bone: -1,
        weights: socket.weights,
      });
    }
    if (options.eye) {
      const eye = options.eye;
      // The eye looks mostly forward, a little out of the skin.
      const look = socket.normal
        .clone()
        .multiplyScalar(0.45)
        .add(new Vector3(0, 0, 1).multiplyScalar(0.55));
      look.addScaledVector(Y, -look.y * 0.5).normalize();
      const dominant = [...socket.weights].sort((a, b) => b[1] - a[1])[0]?.[0] ?? input.head;
      const centre = origin.clone();
      const eyeUp = Y.clone().addScaledVector(look, -look.y).normalize();
      const eyeSide = new Vector3().crossVectors(eyeUp, look).normalize();
      input.bones.push({
        name: `eye.${id}`,
        parent: dominant,
        section: 'eye',
        owner: id,
        head: centre.clone(),
        tail: centre.clone().addScaledVector(look, eye.radius),
        up: eyeUp,
        r0: eye.radius,
        r1: eye.radius,
        cross: [1, 1],
        t0: 0,
        t1: 1,
        skin: false,
        chain: -1,
      });
      const bone = input.bones.length - 1;
      eyeBones.push(bone);
      const base = sink.eyes.positions.length / 3;
      const iris = hexToRgb(eye.iris);
      const sclera = hexToRgb(eye.sclera);
      const pupil = eye.pupil === 'round' ? 0 : eye.pupil === 'slit' ? 1 : 2;
      for (let v = 0; v < local.positions.length; v += 3) {
        toWorld(
          local.positions[v] as number,
          local.positions[v + 1] as number,
          local.positions[v + 2] as number,
          p,
        );
        dirWorld(
          local.normals[v] as number,
          local.normals[v + 1] as number,
          local.normals[v + 2] as number,
          nrm,
        );
        sink.eyes.positions.push(p.x, p.y, p.z);
        sink.eyes.normals.push(nrm.x, nrm.y, nrm.z);
        const d = p.clone().sub(centre).divideScalar(eye.radius);
        sink.eyes.eye.push(d.dot(eyeSide), d.dot(eyeUp), d.dot(look), pupil);
        sink.eyes.iris.push(iris[0], iris[1], iris[2], eye.irisSize);
        sink.eyes.sclera.push(sclera[0], sclera[1], sclera[2]);
        sink.eyes.weights.push([[bone, 1]]);
      }
      for (const i of local.indices) sink.eyes.indices.push(base + i);
      return;
    }
    const base = sink.parts.positions.length / 3;
    const c0 = hexToRgb(options.color ?? DEFAULT_COLOR[material]);
    const c1 = hexToRgb(options.tipColor ?? options.color ?? DEFAULT_COLOR[material]);
    const weights: [number, number][] =
      options.bone !== undefined ? [[options.bone, 1]] : socket.weights.map(([b, w]) => [b, w]);
    for (let v = 0; v < local.positions.length; v += 3) {
      toWorld(
        local.positions[v] as number,
        local.positions[v + 1] as number,
        local.positions[v + 2] as number,
        p,
      );
      dirWorld(
        local.normals[v] as number,
        local.normals[v + 1] as number,
        local.normals[v + 2] as number,
        nrm,
      );
      sink.parts.positions.push(p.x, p.y, p.z);
      sink.parts.normals.push(nrm.x, nrm.y, nrm.z);
      const t = local.t[v / 3] ?? 0;
      const k = t * t;
      sink.parts.color.push(
        c0[0] + (c1[0] - c0[0]) * k,
        c0[1] + (c1[1] - c0[1]) * k,
        c0[2] + (c1[2] - c0[2]) * k,
      );
      sink.parts.info.push(t, ROUGHNESS[material]);
      sink.parts.weights.push(weights);
    }
    for (const i of local.indices) sink.parts.indices.push(base + i);
    // How much of the piece shows: sample its vertices against the skin.
    const seen = exposure.get(id) ?? { total: 0, outside: 0 };
    exposure.set(id, seen);
    const step = Math.max(3, Math.floor(local.positions.length / 3 / 64) * 3);
    for (let v = base * 3; v < sink.parts.positions.length; v += step) {
      seen.total++;
      const x = sink.parts.positions[v] as number;
      const y = sink.parts.positions[v + 1] as number;
      const z = sink.parts.positions[v + 2] as number;
      if (evaluator.eval(x, y, z) > 0.002 * input.scale) seen.outside++;
    }
  };

  const contextFor = (
    id: string,
    baseId: string,
    type: string,
    module: PartModule,
    mirror: 1 | -1 | 0,
    place: { on: string; at: number; from: number; to: number; angle: number },
    toes: PartBuildContext['toes'],
  ): PartBuildContext => ({
    id,
    baseId,
    type,
    scale: input.scale,
    mirror,
    at: place.at,
    from: place.from,
    to: place.to,
    angle: place.angle,
    rng: rng.stream(`part:${baseId}`),
    geo: geometryKit,
    color: resolveColor,
    socket: (at = place.at, angle = place.angle) => socketOn(place.on, at, angle, mirror),
    mouth: (t, row, side) => {
      if (!input.mouth || input.jaw < 0) return undefined;
      const m = input.mouth;
      const position = mouthPoint(m, Math.min(1, Math.max(0, t)), side);
      // Teeth sit just inside the lips.
      position.addScaledVector(m.side, -side * m.tipHalf * 0.08);
      const normal = row === 'upper' ? m.up.clone().negate() : m.up.clone();
      position.addScaledVector(normal, -m.tipHalf * 0.04);
      return frameOf(position, normal, m.forward, m.tipHalf, [
        [row === 'upper' ? input.head : input.jaw, 1],
      ]);
    },
    toes,
    emit: (piece, socket, options = {}) =>
      emitInto(piece, socket, mirror, options, module.material, id),
  });

  for (const part of parts) {
    const module = input.registry.get('part', part.type) as PartModule | undefined;
    const hooks = module?.hooks as PartHooks | undefined;
    if (!module || !hooks?.build) continue;
    try {
      hooks.build(
        contextFor(
          part.id,
          part.baseId,
          part.type,
          module,
          part.mirror,
          { on: part.on, at: part.at, from: part.from, to: part.to, angle: part.angle },
          [],
        ),
        part.params as Record<string, unknown>,
      );
    } catch (error) {
      notes.push({
        path: `parts[id=${part.baseId}]`,
        message: `could not be built: ${(error as Error).message}`,
      });
    }
  }

  // Parts that barely show above the skin (teeth live inside the mouth, so they don't count).
  for (const part of parts) {
    const seen = exposure.get(part.id);
    if (!seen || seen.total < 6 || part.mirror < 0) continue;
    if (input.registry.get('part', part.type)?.slot === 'mouth') continue;
    const shown = seen.outside / seen.total;
    if (shown < 0.25)
      notes.push({
        path: `parts[id=${part.baseId}]`,
        code: 'part_buried',
        message: `only ${Math.round(shown * 100)}% of the part shows above the skin`,
        fix: 'make it longer or larger, or attach it where the body is thinner',
      });
  }

  for (const foot of feet) {
    const module = input.registry.get('part', foot.type) as PartModule | undefined;
    const hooks = module?.hooks as PartHooks | undefined;
    if (!module || !hooks?.build) continue;
    const chains = input.toes.get(foot.limbId) ?? [];
    const toeSockets = chains.map((chain) => {
      const last = input.bones[chain.at(-1) as number] as BoneDef;
      const first = input.bones[chain[0] as number] as BoneDef;
      const along = new Vector3().subVectors(last.tail, last.head).normalize();
      const s = frameOf(last.tail.clone(), along, Y, last.r1, [[chain.at(-1) as number, 1]]);
      const length = chain.reduce(
        (a, id) =>
          a + (input.bones[id] as BoneDef).head.distanceTo((input.bones[id] as BoneDef).tail),
        0,
      );
      return { ...s, bone: chain.at(-1) as number, length, toeRadius: (first.r0 + last.r1) / 2 };
    });
    hooks.build(
      contextFor(
        `${foot.limbId}.foot`,
        `${foot.limbId}.foot`,
        foot.type,
        module,
        foot.mirror,
        { on: foot.limbId, at: 1, from: 0, to: 1, angle: 0 },
        toeSockets,
      ),
      foot.params as Record<string, unknown>,
    );
  }
  return { eyeBones, notes };
}

function clonePiece(p: MeshPiece): MeshPiece {
  return {
    positions: [...p.positions],
    normals: [...p.normals],
    indices: [...p.indices],
    t: [...p.t],
  };
}
