import { describe, expect, it } from 'vitest';
import { didYouMean, editDistance } from './suggest.ts';

describe('didYouMean', () => {
  it('counts transpositions as one edit', () => {
    expect(editDistance('lenght', 'length')).toBe(1);
  });

  it('suggests the closest known word', () => {
    expect(didYouMean('lenght', ['length', 'radius', 'segments'])).toBe('length');
    expect(didYouMean('radious', ['length', 'radius'])).toBe('radius');
  });

  it('matches a segment of a dotted id', () => {
    expect(didYouMean('hron', ['trot', 'horn.curved', 'walk'])).toBe('horn.curved');
  });

  it('stays quiet when nothing is close', () => {
    expect(didYouMean('wings', ['length', 'radius'])).toBeUndefined();
  });
});
