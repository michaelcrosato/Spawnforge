import { readdirSync, readFileSync } from 'node:fs';
import {
  createRegistry,
  FORMAT,
  formatIssue,
  type Issue,
  minimalBlueprint,
  validateBlueprint,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const examplesDir = new URL('../../../examples/', import.meta.url);
const examples = readdirSync(examplesDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => [f, JSON.parse(readFileSync(new URL(f, examplesDir), 'utf8'))] as const);

const errorsOf = (blueprint: unknown) =>
  validateBlueprint(blueprint, registry).errors.map(formatIssue);
const find = (issues: readonly Issue[], path: string) => issues.find((i) => i.path === path);

describe('body plans', () => {
  it.each(registry.ids('bodyPlan'))('%s is valid on its own, without warnings', (id) => {
    const result = validateBlueprint({ format: FORMAT, extends: id }, registry);
    expect(result.errors.map(formatIssue)).toEqual([]);
    expect(result.warnings.map(formatIssue)).toEqual([]);
    expect(result.blueprint).toEqual({ format: FORMAT, extends: id });
  });
});

describe('examples', () => {
  it.each(examples)('%s is valid', (_, blueprint) => {
    const result = validateBlueprint(blueprint, registry);
    expect(result.errors.map(formatIssue)).toEqual([]);
    expect(result.warnings.map(formatIssue)).toEqual([]);
  });

  it.each(examples)('%s: the minimal blueprint resolves to the same creature', (_, blueprint) => {
    const full = validateBlueprint(blueprint, registry);
    const minimal = full.blueprint as Record<string, unknown>;
    expect(validateBlueprint(minimal, registry).creature).toEqual(full.creature);
    expect(minimalBlueprint(minimal, registry)).toEqual(minimal);
    expect(JSON.stringify(minimal).length).toBeLessThanOrEqual(JSON.stringify(blueprint).length);
  });
});

describe('defaults', () => {
  it('accepts a blueprint with only a format', () => {
    const result = validateBlueprint({ format: FORMAT }, registry);
    expect(result.ok).toBe(true);
    expect(result.creature?.body.torso.radius).toEqual([0.14, 0.18, 0.16, 0.12]);
    expect(result.creature?.skin.layers.map((l) => l.id)).toEqual(['countershade']);
  });

  it('fills module parameters with their defaults', () => {
    const result = validateBlueprint(
      { format: FORMAT, extends: 'quadruped', parts: [{ id: 'horns', type: 'horn.curved' }] },
      registry,
    );
    const horn = result.creature?.parts.find((p) => p.id === 'horns.L');
    expect(horn?.params).toMatchObject({ length: 0.2, curve: 45, ridges: 0 });
    expect(horn?.on).toBe('head');
    expect(horn?.at).toBe(0.75);
  });
});

describe('mirroring', () => {
  const creature = validateBlueprint(
    examples.find(([f]) => f === 'ridgeback-stalker.json')?.[1],
    registry,
  ).creature;

  it('expands "both" into .L and .R copies on +X and -X', () => {
    const forelegs = creature?.limbs.filter((l) => l.baseId === 'foreleg');
    expect(forelegs?.map((l) => [l.id, l.mirror])).toEqual([
      ['foreleg.L', 1],
      ['foreleg.R', -1],
    ]);
  });

  it('keeps rows on the midline at angle 0', () => {
    const dorsal = creature?.parts.filter((p) => p.baseId === 'dorsal');
    expect(dorsal?.map((p) => [p.id, p.side])).toEqual([['dorsal', 'center']]);
  });

  it('numbers leg pairs from the back', () => {
    expect(creature?.limbs.find((l) => l.id === 'hindleg.L')?.pair).toBe(0);
    expect(creature?.limbs.find((l) => l.id === 'foreleg.L')?.pair).toBe(1);
  });

  it('puts one copy of a part on each side of a mirrored limb', () => {
    const result = validateBlueprint(
      {
        format: FORMAT,
        extends: 'quadruped',
        parts: [
          { id: 'spur', type: 'horn.curved', attach: { on: 'foreleg', at: 0.6, angle: 180 } },
        ],
      },
      registry,
    );
    expect(
      result.creature?.parts.filter((p) => p.baseId === 'spur').map((p) => [p.id, p.on]),
    ).toEqual([
      ['spur.L', 'foreleg.L'],
      ['spur.R', 'foreleg.R'],
    ]);
  });
});

describe('errors written for a model', () => {
  it('gives the range and a fix for numbers out of range, with id-based paths', () => {
    const result = validateBlueprint(
      { format: FORMAT, extends: 'quadruped', limbs: [{ id: 'hindleg', attach: { at: 1.4 } }] },
      registry,
    );
    expect(formatIssue(result.errors[0] as Issue)).toBe(
      'limbs[id=hindleg].attach.at: 1.4 is outside 0–1 — use a value in range, e.g. 1',
    );
  });

  it('suggests the intended key for typos', () => {
    const issue = find(
      validateBlueprint({ format: FORMAT, body: { head: { lenght: 0.3 } } }, registry).errors,
      'body.head.lenght',
    );
    expect(issue?.fix).toBe('did you mean "length"?');
  });

  it('explains keys models tend to guess', () => {
    const issue = find(
      validateBlueprint({ format: FORMAT, body: { torso: { length: 2 } } }, registry).errors,
      'body.torso.length',
    );
    expect(issue?.fix).toMatch(/scale/);
  });

  it('suggests close module ids and preset names', () => {
    const errors = validateBlueprint(
      { format: FORMAT, extends: 'quadrupd', parts: [{ id: 'h', type: 'horn.curvd' }] },
      registry,
    ).errors;
    expect(find(errors, 'extends')?.fix).toBe('did you mean "quadruped"?');
    expect(find(errors, 'parts[id=h].type')?.fix).toBe('did you mean "horn.curved"?');
  });

  it('tells a model to move part parameters into params', () => {
    const issue = find(
      validateBlueprint(
        { format: FORMAT, parts: [{ id: 'horns', type: 'horn.curved', length: 0.3 }] },
        registry,
      ).errors,
      'parts[id=horns].length',
    );
    expect(issue?.fix).toBe('move "length" into "params"');
  });

  it('reports structural and cross-reference errors in one pass', () => {
    const errors = validateBlueprint(
      {
        format: FORMAT,
        extends: 'quadruped',
        scale: 30,
        parts: [{ id: 'teeth', type: 'teeth.row', attach: { on: 'jawz' } }],
        skin: { layers: [{ type: 'stripes', color: 'acent' }] },
        motion: { gaits: ['tripod'] },
      },
      registry,
    ).errors;
    expect(errors.map((e) => e.path)).toEqual([
      'scale',
      'parts[id=teeth].attach.on',
      'skin.layers[0].color',
      'motion.gaits[0]',
    ]);
    expect(find(errors, 'parts[id=teeth].attach.on')?.fix).toBe('did you mean "jaw"?');
    expect(find(errors, 'skin.layers[0].color')?.fix).toBe('did you mean "accent"?');
    expect(find(errors, 'motion.gaits[0]')?.fix).toBe('use "walk"');
  });

  it('checks that actions have the body features they need', () => {
    expect(
      errorsOf({
        format: FORMAT,
        extends: 'quadruped',
        body: { head: { jaw: false } },
        motion: { actions: ['bite'] },
      }),
    ).toEqual(['motion.actions[0]: "bite" needs a jaw — set body.head.jaw to true']);
  });

  it('requires legs in mirrored pairs', () => {
    const errors = errorsOf({
      format: FORMAT,
      limbs: [{ id: 'peg', role: 'leg', attach: { side: 'left' } }],
    });
    expect(errors).toContain(
      'limbs[id=peg].attach.side: legs come in mirrored pairs, but this one is "left" — set "side": "both"',
    );
  });

  it('rejects duplicate ids and ids that name body sections', () => {
    const errors = errorsOf({
      format: FORMAT,
      parts: [
        { id: 'head', type: 'eye.basic' },
        { id: 'x', type: 'eye.basic' },
        { id: 'x', type: 'horn.curved' },
      ],
    });
    expect(errors.some((e) => e.includes('names a body section'))).toBe(true);
    expect(errors.some((e) => e.includes('already used'))).toBe(true);
  });

  it('reports bad colours with a suggestion', () => {
    const issue = find(
      validateBlueprint({ format: FORMAT, skin: { palette: { base: 'darkgren' } } }, registry)
        .errors,
      'skin.palette.base',
    );
    expect(issue?.fix).toBe('did you mean "darkgreen"?');
  });
});

describe('friendly forms', () => {
  it('normalizes colour names and short hex', () => {
    const result = validateBlueprint(
      { format: FORMAT, skin: { palette: { base: 'tan', belly: '#fff' } } },
      registry,
    );
    expect(result.creature?.skin.palette).toMatchObject({ base: '#d2b48c', belly: '#ffffff' });
    expect(result.blueprint).toEqual({
      format: FORMAT,
      skin: { palette: { base: '#d2b48c', belly: '#ffffff' } },
    });
  });

  it('resolves palette names in layers to colours', () => {
    const result = validateBlueprint(
      { format: FORMAT, skin: { palette: { accent: '#112233' }, layers: [{ type: 'stripes' }] } },
      registry,
    );
    expect(result.creature?.skin.layers[0]?.params.color).toBe('#112233');
  });

  it('migrates the plan-era "bestiary/0.1" format with a warning', () => {
    const result = validateBlueprint({ format: 'bestiary/0.1', extends: 'serpent' }, registry);
    expect(result.ok).toBe(true);
    expect(result.warnings[0]?.code).toBe('migrated');
    expect(result.blueprint?.format).toBe(FORMAT);
  });

  it('removes inherited items with "remove": true', () => {
    const result = validateBlueprint(
      { format: FORMAT, extends: 'quadruped', parts: [{ id: 'eyes', remove: true }] },
      registry,
    );
    expect(result.creature?.parts).toEqual([]);
  });
});

describe('docs', () => {
  const guide = readFileSync(new URL('../../../docs/blueprint.md', import.meta.url), 'utf8');
  const blocks = [...guide.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) =>
    JSON.parse(m[1] as string),
  );

  it.each(blocks.filter((b) => b.format !== undefined).map((b, i) => [i, b] as const))(
    'blueprint example %i in docs/blueprint.md is valid',
    (_, blueprint) => {
      expect(validateBlueprint(blueprint, registry).errors.map(formatIssue)).toEqual([]);
    },
  );
});
