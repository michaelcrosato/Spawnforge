import { compileCreature, createRegistry, FORMAT, resolveBlueprint } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { describe, expect, it } from 'vitest';
import { bakeTextures } from './bake.ts';
import { simplifyChain } from './lod.ts';

const registry = createRegistry([basicPack]);
const creature = (quality: 'low' | 'medium', field = false) =>
  compileCreature(
    resolveBlueprint({ format: FORMAT, extends: 'quadruped', seed: 3 }, registry),
    registry,
    { quality, field },
  );

/** Edges used by one triangle only, once vertices that share a position are welded. */
function openEdges(positions: Float32Array, indices: Uint32Array): number {
  const id = new Map<string, number>();
  const weld = (v: number) => {
    const key = `${positions[v * 3]},${positions[v * 3 + 1]},${positions[v * 3 + 2]}`;
    let w = id.get(key);
    if (w === undefined) {
      w = id.size;
      id.set(key, w);
    }
    return w;
  };
  const uses = new Map<string, number>();
  for (let t = 0; t < indices.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const a = weld(indices[t + e] as number);
      const b = weld(indices[t + ((e + 1) % 3)] as number);
      if (a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  let open = 0;
  for (const n of uses.values()) if (n === 1) open++;
  return open;
}

describe('level-of-detail chains (docs/design/11.2-lod.md)', () => {
  it('reaches each share of the triangles, with errors rising, over the same vertices', async () => {
    const c = creature('medium');
    for (const mesh of [c.skin, c.parts]) {
      const full = mesh.indices.length / 3;
      const chain = await simplifyChain(mesh);
      expect(chain.map((l) => l.ratio)).toEqual([0.5, 0.25, 0.1]);
      let last = 0;
      for (const level of chain) {
        expect(Math.abs(level.triangles / full - level.ratio)).toBeLessThan(0.05 * level.ratio);
        expect(level.error).toBeGreaterThanOrEqual(last);
        last = level.error;
        const vertices = mesh.positions.length / 3;
        for (const v of level.indices) expect(v).toBeLessThan(vertices);
      }
      // Sub-millimetre at half, and well under a centimetre at a tenth, for a 1 m quadruped.
      expect(chain[0]?.error).toBeLessThan(0.001);
      expect(chain[2]?.error).toBeLessThan(0.01);
    }
  });

  it('is the same twice', async () => {
    const c = creature('low');
    const a = await simplifyChain(c.skin);
    const b = await simplifyChain(c.skin);
    expect(a.map((l) => Array.from(l.indices))).toEqual(b.map((l) => Array.from(l.indices)));
  });

  it('keeps UV seams closed in a textured mesh', async () => {
    const maps = await bakeTextures(creature('low', true), registry, { size: 128 });
    const skin = maps.skin;
    if (!skin) throw new Error('no skin maps');
    const open = openEdges(skin.positions, skin.indices);
    for (const level of await simplifyChain(skin))
      expect(openEdges(skin.positions, level.indices)).toBeLessThanOrEqual(open);
  }, 60_000);
});
