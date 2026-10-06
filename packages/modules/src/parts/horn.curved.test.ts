import { compileCreature, createRegistry, FORMAT, resolveBlueprint } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from '../index.ts';

const registry = createRegistry([basicPack]);

/** Unit direction from a horn's root marker to the mean of its vertices, in creature space. */
function hornDirection(attach: Record<string, unknown>, params: Record<string, unknown>) {
  const blueprint = {
    format: FORMAT,
    extends: 'quadruped',
    parts: [{ id: 'h', type: 'horn.curved', attach: { ...attach, side: 'left' }, params }],
  };
  const c = compileCreature(resolveBlueprint(blueprint, registry), registry, { quality: 'low' });
  const base = c.markers.find((m) => m.id === 'h')?.position ?? [0, 0, 0];
  const reach = (params.length as number) * 1.3;
  const sum = [0, 0, 0];
  const p = c.parts.positions;
  for (let i = 0; i < p.length; i += 3) {
    const d = [0, 1, 2].map((k) => (p[i + k] as number) - (base[k] as number));
    if (Math.hypot(...d) > reach) continue;
    for (const k of [0, 1, 2]) sum[k] = (sum[k] as number) + (d[k] as number);
  }
  const n = Math.hypot(...sum);
  return { x: (sum[0] as number) / n, y: (sum[1] as number) / n, z: (sum[2] as number) / n };
}

describe('horn.curved aim', () => {
  // Default horns on top of the head, swept horns on its side, mandibles low by the snout.
  const places = [
    { on: 'head', at: 0.75, angle: 40 },
    { on: 'head', at: 0.6, angle: 75 },
    { on: 'head', at: 0.06, angle: 110 },
    { on: 'jaw', at: 0.1, angle: 90 },
  ];

  it.each(places)('points forward, back and out from $on at angle $angle', (attach) => {
    const params = { length: 0.3, curve: 60 };
    expect(hornDirection(attach, { ...params, aim: 'forward' }).z).toBeGreaterThan(0.9);
    expect(hornDirection(attach, { ...params, aim: 'back' }).z).toBeLessThan(-0.9);
    expect(hornDirection(attach, { ...params, aim: 'out' }).x).toBeGreaterThan(0.85);
  });

  it('points up and down from the side of the head', () => {
    const attach = { on: 'head', at: 0.6, angle: 75 };
    expect(hornDirection(attach, { length: 0.4, curve: 120, aim: 'up' }).y).toBeGreaterThan(0.8);
    expect(hornDirection(attach, { length: 0.4, curve: 120, aim: 'down' }).y).toBeLessThan(-0.8);
  });
});
