import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { refineRegion, SPLIT } from './refine.ts';
import { WeightTable } from './skin.ts';

/** An icosahedron on a sphere of radius `R`, outward-wound. */
function icosahedron(R: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  const raw = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  const faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  const positions = new Float32Array(
    raw.flatMap((p) => new Vector3(...(p as [number, number, number])).setLength(R).toArray()),
  );
  const normals = new Float32Array(
    raw.flatMap((p) => new Vector3(...(p as [number, number, number])).normalize().toArray()),
  );
  const table = new WeightTable(12);
  for (let v = 0; v < 12; v++) table.set(v, [[v % 2, 1]]);
  return { positions, normals, indices: new Uint32Array(faces.flat()), table };
}

const project = (R: number) => (p: Vector3, n: Vector3) => {
  n.copy(p).normalize();
  p.copy(n).multiplyScalar(R);
};

/** Each undirected edge's triangle count. */
function edgeUse(indices: Uint32Array): Map<string, number> {
  const use = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e] as number;
      const b = indices[t + ((e + 1) % 3)] as number;
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      use.set(key, (use.get(key) ?? 0) + 1);
    }
  return use;
}

describe('refining a region', () => {
  const R = 1;
  const target = R / 6;

  it('splits every long edge, keeps the mesh closed and on the surface, and folds nothing', () => {
    const mesh = icosahedron(R);
    const out = refineRegion({
      ...mesh,
      mask: new Uint8Array(12).fill(1),
      target,
      project: project(R),
    });
    expect(out.long).toBe(0);
    expect(out.indices.length / 3).toBeGreaterThan(20 * 16);
    for (const [, n] of edgeUse(out.indices)) expect(n).toBe(2);
    const p = new Vector3();
    for (let v = 0; v < out.positions.length / 3; v++)
      expect(p.fromArray(out.positions, v * 3).length()).toBeCloseTo(R, 5);
    // Every triangle faces outward, and its edges are at most SPLIT target lengths.
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    for (let t = 0; t < out.indices.length; t += 3) {
      a.fromArray(out.positions, (out.indices[t] as number) * 3);
      b.fromArray(out.positions, (out.indices[t + 1] as number) * 3);
      c.fromArray(out.positions, (out.indices[t + 2] as number) * 3);
      const normal = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
      expect(normal.dot(a)).toBeGreaterThan(0);
      for (const [x, y] of [
        [a, b],
        [b, c],
        [c, a],
      ] as const)
        expect(x.distanceTo(y)).toBeLessThanOrEqual(SPLIT * target * 1.02);
    }
    // New vertices weigh their edge's ends.
    const last = out.positions.length / 3 - 1;
    expect(out.table.entries(last).reduce((s, [, w]) => s + w, 0)).toBeCloseTo(1, 5);
  });

  it('leaves the rest alone and splits finer where asked, the same every time', () => {
    const run = () => {
      const mesh = icosahedron(R);
      // Only the upper half; near the top pole, half the target.
      const mask = new Uint8Array(12).map((_, v) =>
        (mesh.positions[v * 3 + 1] as number) > 0 ? 1 : 0,
      );
      return refineRegion({
        ...mesh,
        mask,
        target,
        limitAt: (_x, y) => (y > 0.8 * R ? target / 2 : target),
        project: project(R),
      });
    };
    const out = run();
    for (const [, n] of edgeUse(out.indices)) expect(n).toBe(2);
    // Below the region, the original lower vertices keep their places and nothing new appears.
    for (let v = 12; v < out.positions.length / 3; v++)
      expect(out.positions[v * 3 + 1] as number).toBeGreaterThan(-0.6 * R);
    // Finer near the top: its edges are short.
    const p = new Vector3();
    const q = new Vector3();
    let topEdge = 0;
    for (let t = 0; t < out.indices.length; t += 3)
      for (let e = 0; e < 3; e++) {
        p.fromArray(out.positions, (out.indices[t + e] as number) * 3);
        q.fromArray(out.positions, (out.indices[t + ((e + 1) % 3)] as number) * 3);
        if (p.y > 0.9 * R && q.y > 0.9 * R) topEdge = Math.max(topEdge, p.distanceTo(q));
      }
    expect(topEdge).toBeLessThanOrEqual(((SPLIT * target) / 2) * 1.05);
    const again = run();
    expect(Array.from(again.positions)).toEqual(Array.from(out.positions));
    expect(Array.from(again.indices)).toEqual(Array.from(out.indices));
  });
});
