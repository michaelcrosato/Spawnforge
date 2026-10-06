import { applyPatch, createRegistry, FORMAT, formatDiff } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const base = { format: FORMAT, extends: 'quadruped', name: 'Test' };

describe('patch', () => {
  it('edits inherited limbs by id and reports a one-line diff', () => {
    const result = applyPatch(
      base,
      [{ op: 'set', path: 'limbs[id=hindleg].length', value: 0.8 }],
      registry,
    );
    expect(result.ok).toBe(true);
    expect(result.blueprint.limbs).toEqual([{ id: 'hindleg', length: 0.8 }]);
    expect(formatDiff(result.diff)).toEqual(['+ limbs[id=hindleg]: {"id":"hindleg","length":0.8}']);
  });

  it('sets, adds, mirrors and scales', () => {
    const result = applyPatch(
      base,
      [
        { op: 'set', path: 'body.tail.length', value: 1.2 },
        { op: 'add', path: 'parts', value: { id: 'horn', type: 'horn.curved' } },
        { op: 'mirror', path: 'parts[id=horn]' },
        { op: 'scale', path: 'parts[id=horn].params.length', by: 2 },
        { op: 'scale', path: '', by: 1.5 },
      ],
      registry,
    );
    // Scaling a value the blueprint doesn't set yet fails with a fix; everything else applies.
    expect(result.errors.map((e) => e.message)).toEqual([
      'parts[id=horn].params.length has no number to scale',
    ]);
    expect(result.blueprint).toMatchObject({
      scale: 1.5,
      body: { tail: { length: 1.2 } },
      parts: [{ id: 'horn', type: 'horn.curved', attach: { side: 'both' }, params: {} }],
    });
  });

  it('removes inherited parts with "remove": true and own keys outright', () => {
    const own = { ...base, body: { tail: { length: 1 } } };
    const result = applyPatch(
      own,
      [
        { op: 'remove', path: 'parts[id=eyes]' },
        { op: 'remove', path: 'body.tail.length' },
      ],
      registry,
    );
    expect(result.ok).toBe(true);
    expect(result.blueprint.parts).toEqual([{ id: 'eyes', remove: true }]);
    expect(result.blueprint.body).toEqual({ tail: {} });
    expect(formatDiff(result.diff)).toContain('- body.tail.length');
  });

  it('edits a layer by index, copying the inherited layers first', () => {
    const result = applyPatch(
      base,
      [{ op: 'set', path: 'skin.layers[0].strength', value: 0.3 }],
      registry,
    );
    expect(result.ok).toBe(true);
    const layers = (result.blueprint.skin as { layers: { type: string; strength: number }[] })
      .layers;
    expect(layers.length).toBeGreaterThan(0);
    expect(layers[0]?.strength).toBe(0.3);
  });

  it('validates the result and explains operations it cannot apply', () => {
    const result = applyPatch(
      base,
      [
        { op: 'set', path: 'limbs[id=wing].length', value: 1 },
        { op: 'set', path: 'body.torso.pitch', value: 400 },
      ],
      registry,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => `${e.path}: ${e.message}`)).toEqual([
      'ops[0]: nothing with id "wing" in limbs',
      'body.torso.pitch: 400 is outside -30–90',
    ]);
  });
});
