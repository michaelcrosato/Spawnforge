import {
  compileCreature,
  createRegistry,
  FORMAT,
  type MeshData,
  resolveBlueprint,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { describe, expect, it } from 'vitest';
import { bakeTextures } from './bake.ts';
import { dilate } from './dilate.ts';
import { normalMap } from './normal.ts';
import { occlusion } from './occlusion.ts';
import { rasterize } from './raster.ts';
import { tangents } from './tangents.ts';
import { unwrap } from './xatlas.ts';

const registry = createRegistry([basicPack]);
const creature = (blueprint: Record<string, unknown>) =>
  compileCreature(resolveBlueprint({ format: FORMAT, ...blueprint }, registry), registry, {
    quality: 'low',
    field: true,
  });

/** A unit square in the xy plane facing +z, uv u = x and v = 1 − y (glTF's v runs down). */
const square = {
  positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]),
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
  uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
  indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
};

describe('rasterizing UV triangles (decision 4)', () => {
  it('covers every texel once, conservatively, with v 0 at row 0', () => {
    const size = 16;
    const c = rasterize(square.uvs, square.indices, size);
    expect(c.texels.length).toBe(size * size);
    // Row 0 is v near 0, the top of the square (y near 1): its top-left corner is the second
    // triangle's, its bottom-right (the last row) the first's.
    expect(c.triangle[0]).toBe(1);
    expect(c.triangle[size * size - 1]).toBe(0);
    // A small triangle still claims the texels it touches.
    const small = rasterize(
      new Float32Array([0.5, 0.5, 0.52, 0.5, 0.5, 0.52]),
      new Uint32Array([0, 1, 2]),
      size,
    );
    expect(small.texels.length).toBeGreaterThan(0);
  });

  it('puts each value at its texel centre, where a GPU samples it', () => {
    // A ramp over the square, x from 0 to 1, baked texel by texel, then sampled bilinearly at
    // vertex UVs with texel centres at (i + 0.5) / size, as GPUs do: exact for a linear ramp,
    // and half a texel's worth off if the bake's texels were anywhere else.
    const size = 16;
    const c = rasterize(square.uvs, square.indices, size);
    const image = new Float32Array(size * size);
    for (const k of c.texels) {
      const t = c.triangle[k] as number;
      const w1 = c.weights[k * 2] as number;
      const w2 = c.weights[k * 2 + 1] as number;
      const corner = (i: number) =>
        square.positions[(square.indices[t * 3 + i] as number) * 3] as number;
      image[k] = corner(0) * (1 - w1 - w2) + corner(1) * w1 + corner(2) * w2;
    }
    const sample = (u: number, v: number) => {
      const x = Math.min(size - 1.5, Math.max(0.5, u * size)) - 0.5;
      const y = Math.min(size - 1.5, Math.max(0.5, v * size)) - 0.5;
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const at = (i: number, j: number) => image[(y0 + j) * size + x0 + i] as number;
      return (
        (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) +
        (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy
      );
    };
    for (const [u, v] of [
      [0.3, 0.6],
      [0.71, 0.2],
      [0.5, 0.5],
    ] as const)
      expect(sample(u, v)).toBeCloseTo(u, 5);
  });

  it('fills the gutters out to the reach, with neighbours’ values', () => {
    const size = 9;
    const image = new Float32Array(size * size).fill(0);
    const filled = new Uint8Array(size * size);
    const centre = 4 * size + 4;
    image[centre] = 0.75;
    filled[centre] = 1;
    dilate([{ data: image, channels: 1 }], size, filled, 2);
    for (let y = 2; y <= 6; y++)
      for (let x = 2; x <= 6; x++) expect(image[y * size + x]).toBeCloseTo(0.75, 6);
    expect(filled[0]).toBe(0);
  });
});

describe('the normal map (decision 6)', () => {
  /** Bakes a height field over the square and decodes its centre texel. */
  const bakeSlope = async (height: (x: number, y: number) => number) => {
    const size = 32;
    const t = await tangents(square.positions, square.normals, square.uvs, square.indices);
    const pick = <T extends Float32Array>(array: T, n: number) =>
      Float32Array.from({ length: t.remap.length * n }, (_, i) => {
        const v = t.remap[Math.floor(i / n)] as number;
        return array[v * n + (i % n)] as number;
      });
    const positions = pick(square.positions, 3);
    const normals = pick(square.normals, 3);
    const uvs = pick(square.uvs, 2);
    const coverage = rasterize(uvs, t.indices, size);
    const field = new Float32Array(size * size).fill(Number.NaN);
    for (const k of coverage.texels) {
      const x = ((k % size) + 0.5) / size;
      const y = 1 - (Math.floor(k / size) + 0.5) / size;
      field[k] = height(x, y);
    }
    const map = normalMap({
      coverage,
      height: field,
      positions,
      normals,
      uvs,
      indices: t.indices,
      tangents: t.tangents,
      texel: new Float32Array(t.indices.length / 3).fill(1 / size),
    });
    const k = 16 * size + 16;
    return { m: [map[k * 3], map[k * 3 + 1], map[k * 3 + 2]] as number[], tangents: t.tangents };
  };

  it('is flat for a flat height', async () => {
    const { m } = await bakeSlope(() => 0.25);
    expect(m[0]).toBeCloseTo(0, 5);
    expect(m[1]).toBeCloseTo(0, 5);
    expect(m[2]).toBeCloseTo(1, 5);
  });

  it('tilts as glTF decodes it: +X along u, +Y up the image, from UV derivatives alone', async () => {
    // glTF's frame without the shipped tangents: T = ∂P/∂u = +x; +Y points up the image, toward
    // smaller v, which is +y here. A surface rising along +x leans its normal toward −x; one
    // rising along +y, toward −y.
    const slope = 0.3;
    const len = Math.hypot(slope, 1);
    const alongX = await bakeSlope((x) => slope * x);
    expect(alongX.m[0]).toBeCloseTo(-slope / len, 3);
    expect(alongX.m[1]).toBeCloseTo(0, 3);
    const alongY = await bakeSlope((_, y) => slope * y);
    expect(alongY.m[0]).toBeCloseTo(0, 3);
    expect(alongY.m[1]).toBeCloseTo(-slope / len, 3);
    // And the shipped tangent agrees: +x, with the bitangent w · n × t = +y (w = +1).
    expect(Array.from(alongY.tangents.subarray(0, 4))).toEqual([1, 0, 0, 1]);
  });
});

describe('occlusion from the distance field (decision 7)', () => {
  it('leaves open skin at 1 and darkens where the legs meet the body', () => {
    const c = creature({ extends: 'quadruped' });
    const field = c.field;
    if (!field) throw new Error('no field');
    const occ = occlusion(field, c.scale, c.skin.positions, c.skin.normals);
    const { body, region } = c.skin;
    const back: number[] = [];
    let lowest = 1;
    for (let v = 0; v < occ.length; v++) {
      if ((body[v * 4 + 1] as number) > 0.7 && (region[v * 4 + 1] as number) > 0.9)
        back.push(occ[v] as number);
      lowest = Math.min(lowest, occ[v] as number);
    }
    back.sort((a, b) => a - b);
    expect(back[Math.floor(back.length / 2)]).toBeGreaterThan(0.97);
    expect(lowest).toBeLessThan(0.85);
    expect(lowest).toBeGreaterThanOrEqual(0.4);
  });
});

describe('baking a creature', () => {
  it('unwraps every triangle once, in order, inside the map', async () => {
    const c = creature({ extends: 'quadruped' });
    const mesh: MeshData = c.parts;
    const atlas = await unwrap(mesh, 256, 2);
    expect(atlas.indices.length).toBe(mesh.indices.length);
    for (let i = 0; i < atlas.indices.length; i++)
      expect(atlas.remap[atlas.indices[i] as number]).toBe(mesh.indices[i]);
    for (const v of atlas.uvs) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('bakes maps for every mesh, the same twice, with unit tangents', async () => {
    const c = creature({
      extends: 'quadruped',
      skin: {
        layers: [{ type: 'bioluminescence', brightness: 3, pulse: 0 }],
      },
    });
    const a = await bakeTextures(c, registry, { size: 128 });
    const b = await bakeTextures(c, registry, { size: 128 });
    expect(a.notes).toEqual([]);
    for (const kind of ['skin', 'parts', 'eyes'] as const) {
      const m = a[kind];
      if (!m) throw new Error(`no ${kind} maps`);
      expect(m.uvs.length / 2).toBe(m.positions.length / 3);
      expect(Buffer.from(m.albedo.data).equals(Buffer.from(b[kind]?.albedo.data ?? []))).toBe(true);
    }
    const skin = a.skin;
    expect(skin?.normal).toBeDefined();
    expect(skin?.emissive).toBeDefined();
    // The glow keeps its strength above 1 (decision 8).
    expect(skin?.emissiveStrength).toBeGreaterThan(1);
    const t = skin?.tangents as Float32Array;
    for (let i = 0; i < t.length; i += 4) {
      expect(Math.hypot(t[i] as number, t[i + 1] as number, t[i + 2] as number)).toBeCloseTo(1, 3);
      expect(Math.abs(t[i + 3] as number)).toBe(1);
    }
  }, 60_000);
});
