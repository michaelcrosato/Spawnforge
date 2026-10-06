import { readdirSync, readFileSync } from 'node:fs';
import {
  type CompiledCreature,
  compileCreature,
  createRegistry,
  FORMAT,
  fingerprint,
  type MeshData,
  resolveBlueprint,
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
    expect(c.rig.eyes.length).toBe(preset.parts.filter((p) => p.type === 'eye.basic').length * 2);
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
    const jaw = c.rig.jaw;
    let jawOnly = 0;
    for (let v = 0; v < c.skin.positions.length / 3; v++) {
      if (c.skin.skinIndex[v * 4] === jaw && (c.skin.skinWeight[v * 4] as number) > 0.999)
        jawOnly++;
    }
    expect(jawOnly).toBeGreaterThan(20);
    expect(c.sockets.map((s) => s.name)).toContain('mouth');
  });
});

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
      const geometry = module.material === 'eye' ? c.eyes : c.parts;
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
            : { format: FORMAT, extends: 'quadruped', parts: [{ id: 'x', type: id, params }] };
        const result = validateBlueprint(blueprint, registry);
        expect(result.errors).toEqual([]);
        const c = compile(blueprint);
        checkMesh(id, module.material === 'eye' ? c.eyes : c.parts);
      }
    },
  );
});
