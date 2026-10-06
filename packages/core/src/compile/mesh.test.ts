import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { buildSdf, SdfEvaluator } from './sdf.ts';
import { fitGrid, surfaceNets } from './surface-nets.ts';
import type { BoneDef, ChainDef } from './types.ts';

const bone = (head: Vector3, tail: Vector3, r0: number, r1: number, chain: number): BoneDef => ({
  name: 'b',
  parent: -1,
  section: 'torso',
  owner: 'x',
  head,
  tail,
  up: new Vector3(0, 1, 0),
  r0,
  r1,
  cross: [1, 1],
  t0: 0,
  t1: 1,
  skin: true,
  chain,
});

/** Every edge shared by exactly two triangles, in opposite directions. */
function edgeReport(indices: Uint32Array) {
  const edges = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e] as number;
      const b = indices[t + ((e + 1) % 3)] as number;
      const key = `${a},${b}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  }
  let unmatched = 0;
  let repeated = 0;
  for (const [key, n] of edges) {
    const [a, b] = key.split(',');
    if (n > 1) repeated++;
    if (!edges.has(`${b},${a}`)) unmatched++;
  }
  return { unmatched, repeated };
}

describe('meshing', () => {
  const bones = [
    bone(new Vector3(0, 0, -0.5), new Vector3(0, 0, 0.5), 0.2, 0.15, 0),
    bone(new Vector3(0, 0, 0.5), new Vector3(0, 0.4, 0.8), 0.08, 0.06, 1),
  ];
  const chains: ChainDef[] = [
    {
      id: 'torso',
      section: 'torso',
      owner: 'torso',
      bones: [0],
      parentBone: -1,
      blend: 0,
      masses: [],
    },
    {
      id: 'neck',
      section: 'neck',
      owner: 'neck',
      bones: [1],
      parentBone: 0,
      blend: 0.04,
      masses: [],
    },
  ];
  const sdf = buildSdf(bones, chains, 0);
  const mesh = surfaceNets(sdf, fitGrid(sdf, 64));

  it('measures distance to a rounded cone exactly on its surface', () => {
    const ev = new SdfEvaluator(sdf);
    expect(ev.eval(0, 0.2, -0.5)).toBeCloseTo(0, 6);
    expect(ev.eval(0, 0.5, -0.5)).toBeCloseTo(0.3, 6);
  });

  it('is watertight, and manifold except at rare ambiguous faces', () => {
    expect(mesh.indices.length).toBeGreaterThan(1000);
    const report = edgeReport(mesh.indices);
    expect(report.unmatched).toBe(0);
    // Surface nets joins four quads at a cell face whose corners alternate in sign.
    expect(report.repeated / mesh.indices.length).toBeLessThan(0.001);
  });

  it('has no NaNs and puts every vertex on the surface', () => {
    const ev = new SdfEvaluator(sdf);
    for (let v = 0; v < mesh.positions.length; v += 3) {
      const [x, y, z] = [mesh.positions[v], mesh.positions[v + 1], mesh.positions[v + 2]] as [
        number,
        number,
        number,
      ];
      expect(Number.isFinite(x + y + z)).toBe(true);
      expect(Math.abs(ev.eval(x, y, z))).toBeLessThan(mesh.grid.cell * 0.05);
    }
  });

  it('points normals outward', () => {
    let outward = 0;
    for (let v = 0; v < mesh.positions.length; v += 3) {
      const p = new Vector3(mesh.positions[v], mesh.positions[v + 1], 0);
      const n = new Vector3(mesh.normals[v], mesh.normals[v + 1], 0);
      if (p.dot(n) >= 0) outward++;
    }
    expect(outward / (mesh.positions.length / 3)).toBeGreaterThan(0.95);
  });

  it('winds triangles to face along their normals', () => {
    let agree = 0;
    const n = mesh.indices.length / 3;
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const [a, b, c] = [0, 1, 2].map((e) => {
        const i = (mesh.indices[t + e] as number) * 3;
        return new Vector3(mesh.positions[i], mesh.positions[i + 1], mesh.positions[i + 2]);
      }) as [Vector3, Vector3, Vector3];
      const face = new Vector3().subVectors(b, a).cross(new Vector3().subVectors(c, a));
      const i = (mesh.indices[t] as number) * 3;
      const normal = new Vector3(mesh.normals[i], mesh.normals[i + 1], mesh.normals[i + 2]);
      if (face.dot(normal) > 0) agree++;
    }
    expect(agree / n).toBeGreaterThan(0.99);
  });
});
