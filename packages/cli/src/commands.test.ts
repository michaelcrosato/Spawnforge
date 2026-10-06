import { FORMAT } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import {
  analyze,
  CommandError,
  crossbreed,
  diff,
  generate,
  instantiate,
  listModules,
  migrate,
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

describe('diff', () => {
  it('gives the patch operations that turn one blueprint into another', () => {
    const a = { format: FORMAT, extends: 'quadruped', body: { tail: { length: 0.9 } } };
    const b = {
      format: FORMAT,
      extends: 'quadruped',
      body: { tail: { length: 1.4 } },
      parts: [{ id: 'eyes', remove: true }],
    };
    const result = diff({ a, b });
    expect(result).toMatchObject({ ok: true, exact: true });
    expect(result.ops).toEqual([
      { op: 'set', path: 'body.tail.length', value: 1.4 },
      { op: 'remove', path: 'parts[id=eyes]' },
    ]);
    expect(result.changes[0]).toBe('~ body.tail.length: 0.9 → 1.4');
    const patched = patch({ blueprint: a, ops: result.ops });
    expect(patched.ok).toBe(true);
    expect(diff({ a: patched.blueprint, b }).ops).toEqual([]);
  });

  it('reaches a creature with another body plan', () => {
    const a = { format: FORMAT, extends: 'serpent', seed: 3 };
    const b = {
      format: FORMAT,
      extends: 'quadruped',
      seed: 3,
      motion: { temperament: 'stalking' },
    };
    const result = diff({ a, b });
    expect(result.exact).toBe(true);
    expect(result.ops).toContainEqual({ op: 'set', path: 'extends', value: 'quadruped' });
  });

  it('reports invalid blueprints by side', () => {
    const result = diff({ a: { format: FORMAT, scale: 99 }, b: { format: FORMAT } });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.path).toBe('a:scale');
  });
});

describe('migrate', () => {
  const old = { format: 'bestiary/0.1', extends: 'quadruped', scale: 1.2 };

  it('upgrades an older blueprint step by step and validates it', () => {
    const result = migrate({ blueprint: old });
    expect(result).toMatchObject({ ok: true, from: 'bestiary/0.1', to: FORMAT, changed: true });
    expect(result.steps).toHaveLength(2);
    expect(result.blueprint).toEqual({ ...old, format: FORMAT });
    expect(migrate({ blueprint: result.blueprint })).toMatchObject({ changed: false, steps: [] });
  });

  it('reports a format it cannot read', () => {
    const result = migrate({ blueprint: { format: 'monsters/9', extends: 'quadruped' } });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatchObject({ path: 'format', code: 'unknown_format' });
  });

  it('makes every command that writes a blueprint write the current format', () => {
    const edited = patch({ blueprint: old, ops: [{ op: 'set', path: 'scale', value: 1.3 }] });
    expect(edited.blueprint.format).toBe(FORMAT);
    expect(edited.diff).toContain(`~ format: "bestiary/0.1" → "${FORMAT}"`);
    expect(mutate({ blueprint: old, seed: 2 }).blueprint.format).toBe(FORMAT);
    expect(crossbreed({ a: old, b: { ...old, scale: 0.8 } }).blueprint.format).toBe(FORMAT);
    const species = { ...old, scale: { min: 1, max: 1.4 } };
    expect(validate({ blueprint: species }).ok).toBe(true);
    expect(instantiate({ species, seed: 1 }).blueprint.format).toBe(FORMAT);
  });
});

describe('analyze with a scenario', () => {
  const blueprint = { format: FORMAT, extends: 'quadruped' };

  it('runs it and reports what it measured', () => {
    const result = analyze({
      blueprint,
      scenario: {
        duration: 4,
        targets: { post: [0, 0, 1.5] },
        calls: [
          { at: 0, do: 'moveTo', to: 'post' },
          { at: 0.5, do: 'act', action: 'look', target: 'post' },
          { at: 1, do: 'act', action: 'roar' },
        ],
      },
    });
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.scenario?.events.map((e) => e.type)).toContain('arrive');
    expect(result.scenario?.distance).toBeGreaterThan(0.8);
    // The roar replaces the running look, so nothing fails.
    expect(result.scenario?.failed).toEqual([]);
  });

  it('reports scenario mistakes under "scenario", checked against the creature', () => {
    const shape = analyze({ blueprint, scenario: { calls: [{ at: 0, do: 'walk' }] } });
    expect(shape.ok).toBe(false);
    if (shape.ok) return;
    expect(shape.errors.map((e) => e.path)).toEqual(['scenario.calls[0].do']);
    const action = analyze({
      blueprint,
      scenario: { calls: [{ at: 0, do: 'act', action: 'pounce' }] },
    });
    expect(action.ok).toBe(false);
    if (action.ok) return;
    expect(action.errors.map((e) => [e.path, e.code])).toEqual([
      ['scenario.calls[0].action', 'unknown_action'],
    ]);
  });
});
