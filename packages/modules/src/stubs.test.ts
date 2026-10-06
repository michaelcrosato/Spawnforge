import {
  compileCreature,
  createRegistry,
  FORMAT,
  type ModuleDefinition,
  validateBlueprint,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/**
 * Stub modules (`planned`) hold plan 2's vocabulary before it is built: each validates from its
 * own example, warns `not_built` with its milestone, never joins the defaults, and compiles
 * without it.
 */
const registry = createRegistry([basicPack]);
const stubs = registry.list().filter((m) => m.planned);

/** A blueprint that uses the module through its example. */
function using(module: ModuleDefinition): Record<string, unknown> {
  const base = { format: FORMAT, extends: 'quadruped' };
  const example = (module as { example?: Record<string, unknown> }).example ?? {};
  switch (module.kind) {
    case 'pattern':
      return { ...base, skin: { layers: [example] } };
    case 'gait':
      return { ...base, motion: { gaits: [module.id] } };
    case 'action':
      return { ...base, motion: { actions: [module.id] } };
    case 'part':
      return module.slot === 'foot'
        ? { ...base, limbs: [{ id: 'foreleg', foot: example }] }
        : { ...base, parts: [example] };
    default:
      return base;
  }
}

describe('stub modules', () => {
  it('exist for the vocabulary format 0.2 adds', () => {
    expect(stubs.length).toBeGreaterThan(0);
    for (const m of stubs) expect(m.planned, m.id).toMatch(/^\d+\.\d+$/);
  });

  it.each(stubs.map((m) => [`${m.kind} ${m.id}`, m] as const))(
    '%s validates from its example and compiles without it',
    (_, module) => {
      const result = validateBlueprint(using(module), registry, { minimal: false });
      expect(result.errors).toEqual([]);
      const warning = result.warnings.find((w) => w.code === 'not_built');
      expect(warning?.message).toContain(`plan milestone ${module.planned}`);
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
