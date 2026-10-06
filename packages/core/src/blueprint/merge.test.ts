import { describe, expect, it } from 'vitest';
import { mergeBlueprint } from './merge.ts';

const preset = {
  body: { torso: { radius: [0.1, 0.2], arch: 0.1 } },
  limbs: [
    { id: 'foreleg', length: 0.5, attach: { at: 0.15 } },
    { id: 'hindleg', length: 0.6, attach: { at: 0.9 } },
  ],
  parts: [{ id: 'eyes', type: 'eye.basic', params: { size: 0.02 } }],
  skin: { layers: [{ type: 'countershade' }] },
};

describe('mergeBlueprint', () => {
  it('merges objects key by key', () => {
    const { merged } = mergeBlueprint(preset, { body: { torso: { arch: 0.3 } } });
    expect(merged.body).toEqual({ torso: { radius: [0.1, 0.2], arch: 0.3 } });
  });

  it('merges limbs and parts by id, field by field', () => {
    const { merged } = mergeBlueprint(preset, {
      limbs: [
        { id: 'hindleg', attach: { at: 0.85 } },
        { id: 'tail-leg', length: 0.3 },
      ],
      parts: [{ id: 'eyes', params: { pupil: 'slit' } }],
    });
    expect(merged.limbs).toEqual([
      { id: 'foreleg', length: 0.5, attach: { at: 0.15 } },
      { id: 'hindleg', length: 0.6, attach: { at: 0.85 } },
      { id: 'tail-leg', length: 0.3 },
    ]);
    expect(merged.parts).toEqual([
      { id: 'eyes', type: 'eye.basic', params: { size: 0.02, pupil: 'slit' } },
    ]);
  });

  it('removes inherited items with remove: true, and warns when there is nothing to remove', () => {
    const { merged, warnings } = mergeBlueprint(preset, {
      parts: [
        { id: 'eyes', remove: true },
        { id: 'horns', remove: true },
      ],
    });
    expect(merged.parts).toEqual([]);
    expect(warnings.map((w) => w.path)).toEqual(['parts[id=horns]']);
  });

  it('replaces other lists', () => {
    const { merged } = mergeBlueprint(preset, { skin: { layers: [{ type: 'stripes' }] } });
    expect(merged.skin).toEqual({ layers: [{ type: 'stripes' }] });
  });

  it('does not modify its inputs', () => {
    const before = JSON.parse(JSON.stringify(preset));
    mergeBlueprint(preset, { limbs: [{ id: 'foreleg', length: 1 }] });
    expect(preset).toEqual(before);
  });
});
