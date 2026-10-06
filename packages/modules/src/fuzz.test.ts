import {
  compileCreature,
  createRegistry,
  createRng,
  randomBlueprint,
  TRIANGLE_BUDGET,
  validateBlueprint,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

/**
 * Random blueprints drawn from the schema compile without errors, within the triangle budget.
 * `pnpm fuzz` runs the same check over 1,000 (the PoC gate); this keeps a slice of it in CI.
 */
const registry = createRegistry([basicPack]);

describe('fuzzed blueprints', () => {
  it('are valid and compile cleanly', () => {
    for (let i = 0; i < 25; i++) {
      const blueprint = randomBlueprint(registry, createRng(5000 + i), `Fuzz ${i}`);
      const result = validateBlueprint(blueprint, registry, { minimal: false });
      expect(result.errors, `blueprint ${i}`).toEqual([]);
      const compiled = compileCreature(
        result.creature as NonNullable<typeof result.creature>,
        registry,
        {
          quality: 'low',
        },
      );
      // The budget is for the surface; the mouth and thin-bone tubes come on top of it.
      expect(compiled.stats.triangles.skin).toBeLessThanOrEqual(TRIANGLE_BUDGET.low * 1.3);
      for (const v of compiled.skin.positions) expect(Number.isFinite(v)).toBe(true);
    }
  }, 120_000);

  it('are the same for the same seed', () => {
    expect(randomBlueprint(registry, createRng(7))).toEqual(
      randomBlueprint(registry, createRng(7)),
    );
  });
});
