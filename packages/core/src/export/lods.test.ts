import { describe, expect, it } from 'vitest';
import { pickLevel, projectedError, screenCoverage } from './lods.ts';

const levels = [{ error: 0.0005 }, { error: 0.002 }, { error: 0.008 }];

describe('choosing a level of detail (docs/design/11.2-lod.md, decision 5)', () => {
  it('projects an error to pixels for perspective and orthographic views', () => {
    // 60° vertical: the view is 2·d·tan(30°) = 1.1547 m high at 1 m, so 1080 px over 1.1547 m.
    expect(projectedError(0.001, { fov: 60, distance: 1 }, 1080)).toBeCloseTo(0.9353, 4);
    expect(projectedError(0.001, { fov: 60, distance: 2 }, 1080)).toBeCloseTo(0.4677, 4);
    expect(projectedError(0.001, { height: 2 }, 1000)).toBeCloseTo(0.5, 6);
  });

  it('takes the coarsest level whose error is under a pixel, and full detail up close', () => {
    // Under one pixel once 2·d·tan(30°) > error · 1080: d > 0.935 m per mm of error.
    expect(pickLevel(levels, { fov: 60, distance: 0.4 })).toBe(0);
    expect(pickLevel(levels, { fov: 60, distance: 0.5 })).toBe(1);
    expect(pickLevel(levels, { fov: 60, distance: 2 })).toBe(2);
    expect(pickLevel(levels, { fov: 60, distance: 7.6 })).toBe(3);
    // Each pick keeps its own error under a pixel, and the next finer level would not have to.
    for (const distance of [0.3, 0.7, 1.5, 4, 20]) {
      const k = pickLevel(levels, { fov: 60, distance });
      if (k > 0)
        expect(
          projectedError((levels[k - 1] as { error: number }).error, { fov: 60, distance }, 1080),
        ).toBeLessThan(1);
      if (k < levels.length)
        expect(
          projectedError((levels[k] as { error: number }).error, { fov: 60, distance }, 1080),
        ).toBeGreaterThanOrEqual(1);
    }
    expect(pickLevel(levels, { height: 100 })).toBe(3);
    expect(pickLevel([], { fov: 60, distance: 50 })).toBe(0);
  });

  it('gives the screen coverage below which a level stays under a pixel', () => {
    // A 1 m creature with 2 mm error: 1 m / (0.002 m · 1080 px) = 0.463 of the screen's height.
    expect(screenCoverage(0.002, 1)).toBeCloseTo(0.463, 3);
    expect(screenCoverage(0.0001, 1)).toBe(1);
    expect(screenCoverage(0, 1)).toBe(0);
  });
});
