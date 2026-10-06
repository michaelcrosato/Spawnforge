import { FORMAT } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import {
  analyze,
  CommandError,
  crossbreed,
  generate,
  instantiate,
  listModules,
  mutate,
  patch,
  validate,
} from './commands.ts';

describe('listModules', () => {
  it('reports the format and the catalogue of the default packs', () => {
    const result = listModules();
    expect(result.format).toBe(FORMAT);
    expect(Array.isArray(result.modules)).toBe(true);
  });
});

describe('variation commands', () => {
  it('validates a species at both ends of its ranges', () => {
    const species = { format: FORMAT, extends: 'quadruped', scale: { min: 0.8, max: 30 } };
    const result = validate({ blueprint: species });
    expect(result.species).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.path).toBe('scale');
    const one = instantiate({ species: { ...species, scale: { min: 0.8, max: 1.2 } }, seed: 2 });
    expect(one.ok).toBe(true);
  });

  it('rejects amounts and mixes outside 0 to 1 with a clear error', () => {
    const blueprint = { format: FORMAT, extends: 'quadruped' };
    expect(() => mutate({ blueprint, amount: 2 })).toThrow(CommandError);
    expect(() => crossbreed({ a: blueprint, b: blueprint, mix: -1 })).toThrow(/between 0 and 1/);
  });

  it('asks for an individual when a tool needs one creature', () => {
    const species = { format: FORMAT, extends: 'quadruped', scale: { min: 0.8, max: 1.2 } };
    expect(() => analyze({ blueprint: species })).toThrow(/species/);
    expect(() => mutate({ blueprint: species })).toThrow(/species/);
    const edited = patch({
      blueprint: species,
      ops: [{ op: 'set', path: 'body.neck.length', value: { min: 0.2, max: 0.3 } }],
    });
    expect(edited.ok).toBe(true);
  });

  it('formats diffs as lines', () => {
    const made = generate({ theme: 'insect', seed: 2 });
    const child = mutate({ blueprint: made.blueprint, seed: 1, amount: 0.5 });
    expect(child.ok).toBe(true);
    expect(child.diff.every((line) => /^[~+-] /.test(line))).toBe(true);
  });
});
