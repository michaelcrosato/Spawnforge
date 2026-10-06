import { readdirSync, readFileSync } from 'node:fs';
import {
  analyzeCreature,
  bakeVertexColors,
  type CompiledCreature,
  compileCreature,
  computeStats,
  createRegistry,
  FORMAT,
  fingerprint,
  generate,
  type ModuleByKind,
  type ModuleKind,
  MotionController,
  type Quality,
  resolveBlueprint,
  validateBlueprint,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/**
 * The module harness for every kind beside parts (which compile.test.ts covers): each built
 * module runs from its defaults and its example, stays within its time and size budgets, and
 * gives the same result twice. Stubs (`planned`) are stubs.test.ts's. Budgets are a few times
 * the plan's (docs/plan.md), so a slow CI machine passes and a real regression does not.
 */
const registry = createRegistry([basicPack]);
const built = <K extends ModuleKind>(kind: K): ModuleByKind[K][] =>
  registry.list(kind).filter((m) => !m.planned);
const compile = (blueprint: unknown, quality: Quality = 'low') =>
  compileCreature(resolveBlueprint(blueprint, registry), registry, { quality });
const timed = <T>(f: () => T): [T, number] => {
  const t0 = performance.now();
  const value = f();
  return [value, performance.now() - t0];
};
const finite = (values: ArrayLike<number>) => Array.from(values).every(Number.isFinite);

/** Per-frame motion budget: the plan's 0.1 ms per creature, with room for slow machines. */
const MOTION_MS = 0.5;

describe('module harness: body plans', () => {
  it.each(built('bodyPlan').map((m) => [m.id] as const))(
    '%s compiles within budget, the same twice',
    (id) => {
      const blueprint = { format: FORMAT, extends: id };
      const [a, ms] = timed(() => compile(blueprint, 'medium'));
      expect(ms, 'compile ms at medium').toBeLessThan(2000);
      expect(a.stats.triangles.skin, 'skin triangles').toBeLessThanOrEqual(30000);
      expect(finite(a.skin.positions)).toBe(true);
      expect(fingerprint(compile(blueprint, 'medium'))).toBe(fingerprint(a));
    },
  );
});

describe('module harness: parts', () => {
  const plain = compile({ format: FORMAT, extends: 'quadruped' });
  it.each(built('part').map((m) => [m.id, m] as const))(
    '%s stays within its size budget and builds the same twice',
    (id, module) => {
      const blueprint =
        module.slot === 'foot'
          ? {
              format: FORMAT,
              extends: 'quadruped',
              limbs: [{ id: 'foreleg', foot: { ...module.example, type: id } }],
            }
          : { format: FORMAT, extends: 'quadruped', parts: [{ ...module.example, type: id }] };
      const [a, ms] = timed(() => compile(blueprint));
      expect(ms, 'compile ms with the part').toBeLessThan(2000);
      const mesh = (c: CompiledCreature) => (module.material === 'eye' ? c.eyes : c.parts);
      // What the part adds, beyond the preset's own parts (a foot replaces the default one).
      const added = mesh(a).indices.length / 3 - mesh(plain).indices.length / 3;
      expect(added, 'triangles the part adds').toBeLessThan(20000);
      expect(fingerprint(compile(blueprint))).toBe(fingerprint(a));
    },
  );
});

describe('module harness: patterns', () => {
  // The bare skin, with no layers at all.
  const bare = compile({ format: FORMAT, extends: 'quadruped', skin: { layers: [] } });
  const plain = bakeVertexColors(bare, registry).skin;
  it.each(built('pattern').map((m) => [m.id, m] as const))(
    '%s shades from its defaults and its example, the same twice',
    (id, module) => {
      for (const layer of [{ type: id }, { ...module.example, type: id }]) {
        const blueprint = {
          format: FORMAT,
          extends: 'quadruped',
          skin: { layers: [layer] },
        };
        expect(validateBlueprint(blueprint, registry).errors).toEqual([]);
        const compiled = compile(blueprint);
        const [colors, ms] = timed(() => bakeVertexColors(compiled, registry).skin);
        expect(ms, 'CPU shading ms for the skin at low').toBeLessThan(1500);
        expect(finite(colors.color) && finite(colors.roughness)).toBe(true);
        for (const c of colors.color) expect(c >= 0 && c <= 1).toBe(true);
        // The layer changes the bare skin somewhere.
        expect(colors.color).not.toEqual(plain.color);
        expect(bakeVertexColors(compiled, registry).skin.color).toEqual(colors.color);
      }
    },
  );
});

/** The first body plan whose creature has the gait or action by default. */
function bodyWith(kind: 'gaits' | 'actions', id: string): CompiledCreature {
  for (const plan of registry.ids('bodyPlan')) {
    const compiled = compile({ format: FORMAT, extends: plan });
    if (compiled.motion[kind].some((m) => m.id === id)) return compiled;
  }
  throw new Error(`no body plan has ${id}`);
}

/** Runs a controller and returns its final pose and the worst milliseconds per frame. */
function runFor(controller: MotionController, seconds: number) {
  const events: string[] = [];
  let worst = 0;
  let total = 0;
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) {
    const [fired, ms] = timed(() => controller.update(1 / 60));
    total += ms;
    worst = Math.max(worst, ms);
    for (const e of fired) if (e.type !== 'footstep') events.push(e.type);
  }
  const pose = controller.pose.worldPos.flatMap((p) => [p.x, p.y, p.z]);
  return { events, pose, msPerFrame: total / frames, worst };
}

/**
 * A motion's cost per frame: the faster of two identical runs, since the first also pays for
 * compiling the controller's code, and either can catch a pause from tests running beside it.
 */
const warm = (...runs: { msPerFrame: number }[]) => Math.min(...runs.map((r) => r.msPerFrame));

describe('module harness: gaits', () => {
  it.each(built('gait').map((m) => [m.id] as const))(
    '%s moves its body within budget, the same twice',
    (id) => {
      const compiled = bodyWith('gaits', id);
      const go = () => {
        const controller = new MotionController(compiled, { registry });
        controller.lockGait(id);
        controller.drive(controller.gaitSpeed(id), 0);
        const run = runFor(controller, 3);
        return { ...run, z: controller.position.z, gait: controller.gait?.id };
      };
      const a = go();
      const b = go();
      expect(a.gait).toBe(id);
      expect(finite(a.pose)).toBe(true);
      expect(a.z, 'metres moved in 3 s').toBeGreaterThan(0.2 * compiled.scale);
      expect(warm(a, b), 'motion ms per frame').toBeLessThan(MOTION_MS);
      expect(b.pose).toEqual(a.pose);
    },
  );
});

describe('module harness: actions', () => {
  it.each(built('action').map((m) => [m.id, m] as const))(
    '%s runs within budget and fires its events in order, the same twice',
    (id, module) => {
      const compiled = bodyWith('actions', id);
      const ambient = module.hooks?.ambient === true;
      const go = () => {
        const controller = new MotionController(compiled, { registry });
        controller.update(0.5);
        if (!ambient) {
          const head = controller.pose.worldPos[compiled.rig.heads[compiled.rig.main]?.head ?? 0];
          controller.act(id, { target: head?.clone().setZ((head?.z ?? 0) + compiled.scale) });
        }
        return runFor(controller, ambient ? 4 : 3);
      };
      const a = go();
      const b = go();
      expect(finite(a.pose)).toBe(true);
      if (!ambient) {
        expect(a.events[0]).toBe('action-start');
        expect(a.events.at(-1)).toBe('action-end');
      }
      expect(warm(a, b), 'motion ms per frame').toBeLessThan(MOTION_MS);
      expect(b).toMatchObject({ events: a.events, pose: a.pose });
    },
  );
});

describe('module harness: themes', () => {
  it.each(built('theme').map((m) => [m.id] as const))(
    '%s generates valid creatures within budget, the same for the same seed',
    (id) => {
      for (const seed of [1, 2, 3]) {
        const [a, ms] = timed(() => generate({ theme: id, seed }, registry));
        expect(a.ok, `seed ${seed}`).toBe(true);
        expect(ms, 'generate ms').toBeLessThan(3000);
        expect(validateBlueprint(a.blueprint, registry).errors).toEqual([]);
        expect(generate({ theme: id, seed }, registry).blueprint).toEqual(a.blueprint);
      }
    },
  );
});

describe('module harness: stats', () => {
  const examplesDir = new URL('../../../examples/', import.meta.url);
  const examples = readdirSync(examplesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(new URL(f, examplesDir), 'utf8')) as unknown);
  it.each(built('stats').map((m) => [m.id] as const))(
    '%s gives finite numbers for every example, the same twice',
    (id) => {
      for (const blueprint of examples) {
        const spec = resolveBlueprint(blueprint, registry);
        const analysis = analyzeCreature(spec, registry);
        const values = computeStats(spec, analysis, registry, id);
        expect(Object.keys(values).length).toBeGreaterThan(0);
        expect(finite(Object.values(values))).toBe(true);
        expect(computeStats(spec, analysis, registry, id)).toEqual(values);
      }
    },
  );
});
