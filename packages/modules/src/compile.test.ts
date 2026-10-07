import { readdirSync, readFileSync } from 'node:fs';
import {
  allEyes,
  analyzeCreature,
  type CompiledCreature,
  compileCreature,
  createRegistry,
  FORMAT,
  fingerprint,
  type MeshData,
  mainHead,
  type PartModule,
  resolveBlueprint,
  statsInput,
  validateBlueprint,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const examplesDir = new URL('../../../examples/', import.meta.url);
const examples = readdirSync(examplesDir)
  .filter((f) => f.endsWith('.json'))
  .map(
    (f) =>
      [f.replace('.json', ''), JSON.parse(readFileSync(new URL(f, examplesDir), 'utf8'))] as const,
  );
const compile = (blueprint: unknown, quality: 'low' | 'medium' = 'low') =>
  compileCreature(resolveBlueprint(blueprint, registry), registry, { quality });

function checkMesh(name: string, mesh: MeshData) {
  const vertices = mesh.positions.length / 3;
  for (const v of mesh.positions) expect(Number.isFinite(v), `${name} position`).toBe(true);
  for (const v of mesh.normals) expect(Number.isFinite(v), `${name} normal`).toBe(true);
  for (const i of mesh.indices) expect(i).toBeLessThan(vertices);
  for (let v = 0; v < vertices; v++) {
    const sum = [0, 1, 2, 3].reduce((a, k) => a + (mesh.skinWeight[v * 4 + k] as number), 0);
    expect(Math.abs(sum - 1), `${name} weights of vertex ${v}`).toBeLessThan(1e-4);
  }
}

describe('compiling', () => {
  it.each(registry.ids('bodyPlan'))('%s compiles on the same code', (plan) => {
    const c = compile({ format: FORMAT, extends: plan });
    const preset = registry.get('bodyPlan', plan)?.preset as {
      limbs: { role?: string; splay?: number }[];
      parts: { type: string }[];
    };
    const legs = preset.limbs.filter((l) => (l.role ?? 'leg') === 'leg');
    expect(c.stats.triangles.skin).toBeGreaterThan(500);
    expect(c.rig.posture).toBe(
      legs.length === 0 ? 'legless' : legs.some((l) => (l.splay ?? 0) >= 35) ? 'sprawl' : 'upright',
    );
    expect(c.rig.legs.length).toBe(legs.length * 2);
    expect(allEyes(c.rig).length).toBe(
      preset.parts.filter((p) => p.type === 'eye.basic').length * 2,
    );
    checkMesh(`${plan} skin`, c.skin);
    checkMesh(`${plan} parts`, c.parts);
    // Feet rest on the ground: nothing far below it.
    expect(c.bounds.min[1]).toBeGreaterThan(-0.05 * c.scale);
    // Wings and fins are in the format before they are built (milestone 9.3).
    expect(c.warnings.filter((w) => w.code !== 'not_built')).toEqual([]);
  });

  it.each(examples)('%s compiles within budget at medium quality', (_, blueprint) => {
    const c = compile(blueprint, 'medium');
    expect(c.stats.triangles.skin).toBeLessThanOrEqual(30_000);
    checkMesh('skin', c.skin);
    expect(c.warnings.map((w) => w.message)).toEqual([]);
  });

  it('is deterministic: same blueprint and seed, same mesh and skeleton', () => {
    const [, blueprint] = examples[0] as (typeof examples)[number];
    expect(fingerprint(compile(blueprint))).toBe(fingerprint(compile(blueprint)));
  });

  it('keeps part streams independent: changing the horns leaves the spikes alone', () => {
    const base = examples.find(([n]) => n === 'ridgeback-stalker')?.[1] as Record<string, unknown>;
    const edited = JSON.parse(JSON.stringify(base));
    const horns = (edited.parts as { id: string; params: Record<string, unknown> }[]).find(
      (p) => p.id === 'horns',
    );
    if (!horns) throw new Error('ridgeback-stalker has no horns');
    horns.params.length = 0.4;
    const a = compile({
      ...base,
      parts: [
        ...(base.parts as object[]),
        { id: 'jag', type: 'spikes.row', attach: { on: 'tail', angle: 0 }, params: { jitter: 1 } },
      ],
    });
    const b = compile({
      ...edited,
      parts: [
        ...(edited.parts as object[]),
        { id: 'jag', type: 'spikes.row', attach: { on: 'tail', angle: 0 }, params: { jitter: 1 } },
      ],
    });
    const jag = (c: CompiledCreature) => c.markers.find((m) => m.id === 'jag')?.position;
    expect(jag(a)).toEqual(jag(b));
  });

  it('labels every part and limb for debug renders', () => {
    const c = compile(examples.find(([n]) => n === 'ridgeback-stalker')?.[1]);
    const ids = c.markers.map((m) => m.id);
    for (const id of [
      'horns.L',
      'horns.R',
      'dorsal',
      'eyes.L',
      'foreleg.L',
      'hindleg.R',
      'head',
      'tail',
    ]) {
      expect(ids).toContain(id);
    }
  });

  it('cuts the mouth so the jaw can open', () => {
    const c = compile(examples.find(([n]) => n === 'ridgeback-stalker')?.[1]);
    const { jaw } = mainHead(c.rig);
    let jawOnly = 0;
    for (let v = 0; v < c.skin.positions.length / 3; v++) {
      if (c.skin.skinIndex[v * 4] === jaw && (c.skin.skinWeight[v * 4] as number) > 0.999)
        jawOnly++;
    }
    expect(jawOnly).toBeGreaterThan(20);
    expect(c.sockets.map((s) => s.name)).toContain('mouth');
  });

  it('keeps heads, tails and driven chains in lists, the main head first in what reads them', () => {
    const blueprint = examples.find(([n]) => n === 'ridgeback-stalker')?.[1];
    const c = compile(blueprint);
    expect(c.rig.heads.map((h) => h.id)).toEqual(['head']);
    expect(c.rig.main).toBe(0);
    const head = mainHead(c.rig);
    expect(c.bones.names[head.head]).toBe('head');
    expect(c.bones.names[head.jaw]).toBe('jaw');
    expect(head.neck.map((b) => c.bones.names[b])).toEqual(head.neck.map((_, i) => `neck.${i}`));
    // Every eye hangs from its head, so the head owns them all.
    expect(head.eyes).toEqual(allEyes(c.rig));
    expect(head.eyes.length).toBeGreaterThan(0);
    // The tail is one list entry and the one spring chain, swung by the swish goal.
    const [tail] = c.rig.tails;
    expect(tail?.id).toBe('tail');
    expect(tail?.branch).toBe(0);
    // Each eye's lids are a blink-driven chain of their two bones (8.3).
    const [spring, ...blinks] = c.rig.chains;
    expect(spring).toEqual({
      owner: 'tail',
      bones: tail?.bones,
      drive: 'spring',
      stiffness: 0.35,
      swish: true,
    });
    expect(blinks.map((b) => [b.owner, b.drive, b.bones.map((i) => c.bones.names[i])])).toEqual(
      ['eyes.L', 'eyes.R'].map((id) => [id, 'blink', [`eye.${id}.upper`, `eye.${id}.lower`]]),
    );
    expect([c.rig.wings, c.rig.fins, c.rig.tentacles]).toEqual([[], [], []]);
    // One head reports one reach; stats count heads and only arm limbs as arms.
    const spec = resolveBlueprint(blueprint, registry);
    const analysis = analyzeCreature(spec, registry);
    expect(analysis.reach.heads).toBeUndefined();
    const input = statsInput(spec, analysis, registry);
    expect(input.heads).toBe(1);
    expect(input.arms).toBe(spec.limbs.filter((l) => l.role === 'arm').length);
  });
});

/** The limb role a membrane module covers: fins for fin membranes, else wings. */
const roleFor = (module: PartModule) => (module.tags.includes('fin') ? 'fin' : 'wing');
/** The mesh a part builds into: eyes, membranes (when it made any) or the hard parts. */
const meshOf = (c: CompiledCreature, module: PartModule) =>
  module.material === 'eye' ? c.eyes : c.membranes.indices.length > 0 ? c.membranes : c.parts;

describe('module harness', () => {
  // Stubs have no geometry yet; stubs.test.ts covers them.
  const parts = registry.list('part').filter((m) => !m.planned);

  it.each(parts.map((m) => [m.id, m] as const))(
    '%s builds with its defaults and its example',
    (id, module) => {
      const blueprint =
        module.slot === 'foot'
          ? {
              format: FORMAT,
              extends: 'quadruped',
              limbs: [{ id: 'foreleg', foot: { ...module.example, type: id } }],
            }
          : module.slot === 'membrane'
            ? {
                format: FORMAT,
                extends: 'quadruped',
                limbs: [
                  { id: 'wing', role: roleFor(module), membrane: { ...module.example, type: id } },
                ],
              }
            : {
                format: FORMAT,
                extends: 'quadruped',
                parts: [
                  { ...module.example, type: id },
                  { id: 'plain', type: id },
                ],
              };
      expect(validateBlueprint(blueprint, registry).errors).toEqual([]);
      const c = compile(blueprint);
      const geometry = meshOf(c, module);
      expect(geometry.indices.length).toBeGreaterThan(0);
      checkMesh(id, geometry);
    },
  );

  it.each(parts.map((m) => [m.id, m] as const))(
    '%s builds with random parameters from its schema',
    (id, module) => {
      // Draw each numeric parameter uniformly within its range, deterministically.
      const shape = (
        module.params as unknown as {
          shape: Record<
            string,
            {
              minValue?: number;
              maxValue?: number;
              _zod: { def: { type: string; innerType?: unknown } };
            }
          >;
        }
      ).shape;
      let seed = 7;
      const rand = () => {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        return seed / 2 ** 32;
      };
      for (let trial = 0; trial < 6; trial++) {
        const params: Record<string, unknown> = {};
        for (const [key, field] of Object.entries(shape)) {
          let inner = field as unknown as {
            minValue?: number | null;
            maxValue?: number | null;
            isInt?: boolean;
            _zod: { def: { type: string; innerType?: unknown; checks?: unknown[] } };
          };
          while (inner._zod.def.innerType) inner = inner._zod.def.innerType as typeof inner;
          if (inner._zod.def.type !== 'number') continue;
          const lo = inner.minValue ?? 0;
          const hi = inner.maxValue ?? 1;
          const value = lo + (hi - lo) * rand();
          params[key] = inner.isInt ? Math.round(value) : value;
        }
        const blueprint =
          module.slot === 'foot'
            ? {
                format: FORMAT,
                extends: 'quadruped',
                limbs: [{ id: 'foreleg', foot: { type: id, ...params } }],
              }
            : module.slot === 'membrane'
              ? {
                  format: FORMAT,
                  extends: 'quadruped',
                  limbs: [{ id: 'wing', role: roleFor(module), membrane: { type: id, ...params } }],
                }
              : { format: FORMAT, extends: 'quadruped', parts: [{ id: 'x', type: id, params }] };
        const result = validateBlueprint(blueprint, registry);
        expect(result.errors).toEqual([]);
        const c = compile(blueprint);
        checkMesh(id, meshOf(c, module));
      }
    },
  );
});
