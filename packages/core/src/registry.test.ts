import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRegistry, defineModule, definePack } from './registry.ts';

const horn = defineModule({
  kind: 'part',
  id: 'horn.curved',
  summary: 'Tapered horn bent along an arc; use side "both" for a pair.',
  tags: ['head', 'weapon', 'bone'],
  params: z.strictObject({
    length: z.number().min(0.02).max(1).default(0.2).describe('Length in torso lengths'),
    curve: z.number().min(-270).max(270).default(45).describe('Total bend in degrees'),
  }),
});

const stripes = defineModule({
  kind: 'pattern',
  id: 'stripes',
  summary: 'Bands across the spine.',
  tags: ['skin'],
  params: z.strictObject({ count: z.number().int().min(1).max(64).default(8) }),
});

describe('createRegistry', () => {
  const registry = createRegistry([definePack({ id: 'test', modules: [stripes, horn] })]);

  it('finds modules by kind and id', () => {
    expect(registry.get('part', 'horn.curved')).toBe(horn);
    expect(registry.get('pattern', 'horn.curved')).toBeUndefined();
  });

  it('lists modules in a stable order, optionally by kind', () => {
    expect(registry.list().map((m) => m.id)).toEqual(['horn.curved', 'stripes']);
    expect(registry.list('pattern')).toEqual([stripes]);
  });

  it('describes parameters as input JSON Schema, so defaulted fields are optional', () => {
    const [entry] = registry.catalog();
    expect(entry?.pack).toBe('test');
    expect(entry?.params).toMatchObject({
      type: 'object',
      additionalProperties: false,
      properties: {
        length: { type: 'number', minimum: 0.02, maximum: 1, default: 0.2 },
      },
    });
    expect(entry?.params.required).toBeUndefined();
  });

  it('rejects duplicate ids across packs', () => {
    expect(() =>
      createRegistry([
        definePack({ id: 'a', modules: [horn] }),
        definePack({ id: 'b', modules: [horn] }),
      ]),
    ).toThrow(/both pack "a" and pack "b"/);
  });

  it('rejects malformed ids', () => {
    const bad = { ...horn, id: 'Horn Curved' };
    expect(() => createRegistry([definePack({ id: 'a', modules: [bad] })])).toThrow(/lowercase/);
  });
});
