import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { solveLimb } from './ik.ts';

const lengthsOf = (pts: Vector3[]) => pts.slice(1).map((p, i) => p.distanceTo(pts[i] as Vector3));

describe('solveLimb', () => {
  const twoBone = { lengths: [0.5, 0.5], bends: [-0.9] };
  const threeBone = { lengths: [0.4, 0.35, 0.25], bends: [-1.2, 1.0] };

  it('reaches targets within reach to under 1 mm', () => {
    for (const setup of [twoBone, threeBone]) {
      for (const d of [0.45, 0.6, 0.8, 0.95]) {
        const target = new Vector3(0.1, -d, 0.05).setLength(d);
        const { points, miss } = solveLimb(setup, new Vector3(), target, new Vector3(0, 0, 1));
        expect(miss).toBe(0);
        expect((points.at(-1) as Vector3).distanceTo(target)).toBeLessThan(1e-3);
      }
    }
  });

  it('keeps segment lengths', () => {
    const { points } = solveLimb(
      threeBone,
      new Vector3(),
      new Vector3(0, -0.6, 0.1),
      new Vector3(0, 0, 1),
    );
    expect(lengthsOf(points).map((len) => Number(len.toFixed(9)))).toEqual(threeBone.lengths);
  });

  it('bends toward the pole', () => {
    const { points } = solveLimb(
      twoBone,
      new Vector3(),
      new Vector3(0, -0.7, 0),
      new Vector3(0, 0, 1),
    );
    expect((points[1] as Vector3).z).toBeGreaterThan(0.1);
    const flipped = solveLimb(
      twoBone,
      new Vector3(),
      new Vector3(0, -0.7, 0),
      new Vector3(0, 0, -1),
    );
    expect((flipped.points[1] as Vector3).z).toBeLessThan(-0.1);
  });

  it('reports the miss and points straight at unreachable targets', () => {
    const { points, miss } = solveLimb(
      twoBone,
      new Vector3(),
      new Vector3(0, -2, 0),
      new Vector3(0, 0, 1),
    );
    expect(miss).toBeCloseTo(1, 6);
    expect((points.at(-1) as Vector3).y).toBeCloseTo(-1, 6);
  });
});
