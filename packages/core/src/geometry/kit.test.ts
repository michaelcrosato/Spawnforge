import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { arc, type MeshPiece, mirrorX, plate, sphere, sweep } from './kit.ts';

/** Signed volume of a closed mesh: positive when faces wind outward. */
function signedVolume(piece: MeshPiece): number {
  let v = 0;
  const p = (i: number) =>
    new Vector3(piece.positions[i * 3], piece.positions[i * 3 + 1], piece.positions[i * 3 + 2]);
  for (let t = 0; t < piece.indices.length; t += 3) {
    const a = p(piece.indices[t] as number);
    const b = p(piece.indices[t + 1] as number);
    const c = p(piece.indices[t + 2] as number);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return v;
}

/** Share of triangles whose face normal agrees with their first vertex normal. */
function normalAgreement(piece: MeshPiece): number {
  let agree = 0;
  const p = (i: number) =>
    new Vector3(piece.positions[i * 3], piece.positions[i * 3 + 1], piece.positions[i * 3 + 2]);
  for (let t = 0; t < piece.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((e) => p(piece.indices[t + e] as number)) as [
      Vector3,
      Vector3,
      Vector3,
    ];
    const face = b.clone().sub(a).cross(c.clone().sub(a));
    const i = piece.indices[t] as number;
    const n = new Vector3(piece.normals[i * 3], piece.normals[i * 3 + 1], piece.normals[i * 3 + 2]);
    if (face.dot(n) > 0) agree++;
  }
  return agree / (piece.indices.length / 3);
}

describe('geometry kit', () => {
  const tube = sweep(arc(1, 60, { segments: 10 }), (t) => 0.1 * (1 - 0.5 * t), {
    tip: 'round',
    capRoot: true,
  });
  const horn = sweep(arc(1, 120, { twist: 90, segments: 16 }), (t) => 0.1 * (1 - t), {
    tip: 'point',
    capRoot: true,
    ridges: 4,
  });

  it('winds swept tubes outward, with matching normals', () => {
    expect(signedVolume(tube)).toBeGreaterThan(0);
    expect(signedVolume(horn)).toBeGreaterThan(0);
    // Pointed tips and ridges keep approximate normals, so allow a few disagreeing triangles.
    expect(normalAgreement(tube)).toBeGreaterThan(0.9);
    expect(normalAgreement(horn)).toBeGreaterThan(0.9);
  });

  it('winds spheres and plates outward', () => {
    expect(signedVolume(sphere(1))).toBeCloseTo((4 / 3) * Math.PI, 0);
    expect(
      signedVolume(
        plate(
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
          ],
          0.2,
        ),
      ),
    ).toBeCloseTo(0.2, 5);
  });

  it('keeps outward winding when mirrored', () => {
    expect(
      signedVolume(mirrorX(sweep(arc(1, 60), (t) => 0.1 * (1 - t), { capRoot: true }))),
    ).toBeGreaterThan(0);
  });

  it('bends arcs back toward -Z for positive curve and forward for negative', () => {
    expect((arc(1, 90).at(-1) as Vector3).z).toBeLessThan(-0.3);
    expect((arc(1, -90).at(-1) as Vector3).z).toBeGreaterThan(0.3);
  });

  it('spirals with twist', () => {
    const flat = arc(1, 270);
    const spiral = arc(1, 270, { twist: 360 });
    expect(Math.max(...flat.map((p) => Math.abs(p.x)))).toBeLessThan(1e-9);
    expect(Math.max(...spiral.map((p) => Math.abs(p.x)))).toBeGreaterThan(0.05);
  });
});
