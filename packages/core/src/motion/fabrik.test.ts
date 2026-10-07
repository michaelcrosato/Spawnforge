import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { fabrik } from './fabrik.ts';

const chain = (n: number) => Array.from({ length: n + 1 }, (_, i) => new Vector3(0, i * 0.1, 0));
const lengthsOf = (pts: Vector3[]) => pts.slice(1).map((p, i) => p.distanceTo(pts[i] as Vector3));

describe('fabrik', () => {
  it('puts the tip on a target in reach, keeping the root and every length', () => {
    const pts = chain(8);
    const lengths = lengthsOf(pts);
    const target = new Vector3(0.4, 0.3, 0.2);
    fabrik(pts, lengths, target);
    expect((pts.at(-1) as Vector3).distanceTo(target)).toBeLessThan(1e-3);
    expect((pts[0] as Vector3).length()).toBe(0);
    for (const [i, l] of lengthsOf(pts).entries()) expect(l).toBeCloseTo(lengths[i] as number, 6);
  });

  it('straightens toward a target out of reach', () => {
    const pts = chain(4);
    const lengths = lengthsOf(pts);
    fabrik(pts, lengths, new Vector3(2, 0, 0));
    pts.forEach((p, i) => {
      expect(p.x).toBeCloseTo(i * 0.1, 6);
      expect(p.y).toBeCloseTo(0, 6);
    });
  });
});
