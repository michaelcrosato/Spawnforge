import {
  compileCreature,
  createRegistry,
  defineGait,
  definePack,
  FORMAT,
  type ModuleDefinition,
  validateBlueprint,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { basicPack } from './index.ts';

/**
 * Stub modules (`planned`) hold vocabulary before it is built: each validates from its own
 * example, warns `not_built` with its milestone, never joins the defaults, and compiles without
 * it. 10.4 built the last of format 0.2's, so a test pack holds one to keep the rules checked.
 */
const testPack = definePack({
  id: 'test',
  modules: [
    defineGait({
      id: 'test-crawl',
      summary: 'A stub gait for the tests.',
      tags: ['test'],
      planned: '99.1',
      legPairs: 'any',
      wave: () => 0.5,
      duty: 0.7,
      froude: [0, 0.3],
      params: z.strictObject({}),
    }),
  ],
});
const registry = createRegistry([basicPack, testPack]);
const stubs = registry.list().filter((m) => m.planned);

/** A blueprint that uses the module through its example. */
function using(module: ModuleDefinition): Record<string, unknown> {
  const base = { format: FORMAT, extends: 'quadruped' };
  const example = (module as { example?: Record<string, unknown> }).example ?? {};
  switch (module.kind) {
    case 'pattern':
      return { ...base, skin: { layers: [example] } };
    case 'gait': {
      // A body that suits every stub gait: its legs, bat and insect wings and fins, everywhere.
      const pairs = module.legPairs === 'any' ? 2 : (module.legPairs[0] ?? 2);
      const plan = ['serpent', 'biped', 'quadruped', 'hexapod', 'octopod'][pairs] ?? 'quadruped';
      return {
        ...base,
        extends: plan,
        limbs: [
          { id: 'wing', role: 'wing' },
          { id: 'wing2', role: 'wing', membrane: 'membrane.insect' },
          { id: 'fin', role: 'fin' },
        ],
        motion: { media: { water: true }, gaits: [module.id] },
      };
    }
    case 'action':
      return {
        ...base,
        limbs: [{ id: 'foreleg', foot: 'hand.pincer' }],
        parts: [{ id: 'frill', type: 'frill' }],
        motion: { actions: [module.id] },
      };
    case 'part':
      if (module.slot === 'foot') return { ...base, limbs: [{ id: 'foreleg', foot: example }] };
      if (module.slot === 'membrane')
        return { ...base, limbs: [{ id: 'wing', role: 'wing', membrane: example }] };
      return { ...base, parts: [example] };
    default:
      return base;
  }
}

describe('stub modules', () => {
  it('are all built in the first pack: 10.4 built the last of format 0.2', () => {
    expect(
      createRegistry([basicPack])
        .list()
        .filter((m) => m.planned),
    ).toEqual([]);
    expect(stubs.map((m) => m.id)).toEqual(['test-crawl']);
    for (const m of stubs) expect(m.planned, m.id).toMatch(/^\d+\.\d+$/);
  });

  it.each(stubs.map((m) => [`${m.kind} ${m.id}`, m] as const))(
    '%s validates from its example and compiles without it',
    (_, module) => {
      const result = validateBlueprint(using(module), registry, { minimal: false });
      expect(result.errors).toEqual([]);
      const listed = result.notBuilt?.find((w) => w.message.startsWith(`"${module.id}"`));
      expect(listed?.message).toContain(`plan milestone ${module.planned}`);
      expect(result.warnings.some((w) => w.code === 'not_built')).toBe(false);
      if (!result.creature) return;
      const compiled = compileCreature(result.creature, registry, { quality: 'low' });
      expect(compiled.warnings.some((w) => w.code === 'not_built')).toBe(true);
    },
  );

  it('never join the default gaits or actions', () => {
    const result = validateBlueprint({ format: FORMAT, extends: 'quadruped' }, registry);
    const used = [
      ...(result.creature?.motion.gaits ?? []),
      ...(result.creature?.motion.actions ?? []),
    ];
    for (const ref of used) expect(stubs.map((s) => s.id)).not.toContain(ref.type);
  });
});
