import { describe, expect, it } from 'vitest';
import { compactJson } from './json.ts';

describe('compactJson', () => {
  it('keeps short values on one line', () => {
    expect(compactJson({ a: [1, 2], b: { c: 'x' } })).toBe('{ "a": [1, 2], "b": { "c": "x" } }');
  });

  it('breaks long values over lines and stays valid JSON', () => {
    const value = {
      limbs: Array.from({ length: 6 }, (_, i) => ({
        id: `leg${i}`,
        length: 0.5,
        radius: [0.06, 0.03],
      })),
    };
    const text = compactJson(value, 60);
    expect(text.split('\n').length).toBeGreaterThan(3);
    expect(JSON.parse(text)).toEqual(value);
  });

  it('does not touch commas inside strings', () => {
    expect(JSON.parse(compactJson({ s: 'a,"b":1' }))).toEqual({ s: 'a,"b":1' });
  });
});
