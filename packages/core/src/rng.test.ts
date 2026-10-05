import { describe, expect, it } from 'vitest';
import { createRng, deriveSeed } from './rng.ts';

const draw = (seed: number, n: number) => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('createRng', () => {
  it('repeats exactly for the same seed', () => {
    expect(draw(4127, 100)).toEqual(draw(4127, 100));
  });

  it('diverges for neighbouring seeds', () => {
    expect(draw(1, 8)).not.toEqual(draw(2, 8));
  });

  it('keeps its output fixed across releases', () => {
    // Golden values: if these change, every saved creature changes. Bump the format and migrate.
    expect(draw(4127, 3).map((x) => Math.round(x * 2 ** 32))).toEqual([
      1837391187, 2235773899, 3508256870,
    ]);
  });

  it('stays in [0, 1) with a mean near 0.5', () => {
    const xs = draw(7, 20_000);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    const mean = xs.reduce((sum, x) => sum + x, 0) / xs.length;
    expect(mean).toBeCloseTo(0.5, 1);
  });

  it('draws inclusive integers and covers the whole range', () => {
    const rng = createRng(3);
    const seen = new Set(Array.from({ length: 500 }, () => rng.int(-2, 2)));
    expect([...seen].sort()).toEqual([-1, -2, 0, 1, 2].sort());
  });

  it('rejects bad arguments with a clear message', () => {
    expect(() => createRng(1.5)).toThrow(/integer/);
    expect(() => createRng(1).int(3, 2)).toThrow(/min <= max/);
    expect(() => createRng(1).pick([])).toThrow(/non-empty/);
  });
});

describe('streams', () => {
  it('do not depend on how much the parent has drawn', () => {
    const fresh = createRng(99);
    const used = createRng(99);
    for (let i = 0; i < 50; i++) used.next();
    expect(used.stream('horns').next()).toBe(fresh.stream('horns').next());
  });

  it('are independent per key', () => {
    const rng = createRng(99);
    expect(rng.stream('horns').next()).not.toBe(rng.stream('spots').next());
  });

  it('nest deterministically', () => {
    const a = createRng(5).stream('horns.L').stream('ridges');
    const b = createRng(5).stream('horns.L').stream('ridges');
    expect(a.seed).toBe(b.seed);
    expect(a.next()).toBe(b.next());
  });

  it('derive different seeds for different parents', () => {
    expect(deriveSeed(1, 'horns')).not.toBe(deriveSeed(2, 'horns'));
  });
});
