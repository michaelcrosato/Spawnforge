import { readFileSync } from 'node:fs';
import { analyzeCreature, createRegistry, FORMAT, resolveBlueprint } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const analyze = (blueprint: Record<string, unknown>) =>
  analyzeCreature(resolveBlueprint({ format: FORMAT, ...blueprint }, registry), registry);
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));

describe('analyze', () => {
  it('measures a creature, its speeds and balance, and describes it', () => {
    const a = analyze(example('ridgeback-stalker'));
    expect(a.measurements.length).toBeGreaterThan(2.5);
    expect(a.measurements.length).toBeLessThan(3.2);
    // About as heavy as a big cat or a small horse.
    expect(a.measurements.mass).toBeGreaterThan(100);
    expect(a.measurements.mass).toBeLessThan(400);
    expect(a.speed.max).toBeGreaterThan(a.speed.walk);
    expect(a.speed.gaits.map((g) => g.id)).toEqual(['walk', 'trot']);
    expect(a.stability.supported).toBe(true);
    expect(a.reach.bite).toBeGreaterThan(0);
    expect(a.description).toMatch(/^Ridgeback Stalker: a 2\.\d m long, 1\.\d m tall quadruped/);
    expect(a.description).toContain('curved horns on its head');
    expect(a.description).toContain('it can bite and roar');
  });

  it('runs two gait cycles on flat and rough ground with clean motion for the examples', () => {
    for (const name of ['ridgeback-stalker', 'ember-beetle', 'reed-viper', 'bog-troll']) {
      const a = analyze(example(name));
      expect(a.motion.map((m) => m.ground)).toEqual(['flat', 'rough']);
      for (const m of a.motion) {
        expect(m.footSlide.worst, name).toBeLessThan(0.01);
        expect(m.overstretch.worst, name).toBeLessThan(0.1);
      }
      expect(a.warnings, name).toEqual([]);
    }
  });

  it('warns about a tail in the ground and legs that pass through each other', () => {
    const a = analyze({
      extends: 'quadruped',
      scale: 2.2,
      limbs: [
        { id: 'hindleg', length: 0.2, attach: { at: 0.55 } },
        { id: 'foreleg', length: 0.2, attach: { at: 0.45 } },
      ],
      body: { tail: { length: 1.5, pitch: -40 } },
    });
    const codes = a.warnings.map((w) => `${w.path} ${w.code}`);
    expect(codes).toContain('body.tail below_ground');
    expect(codes.some((c) => c.endsWith('limb_intersection'))).toBe(true);
    for (const w of a.warnings) expect(w.fix).toBeTruthy();
  });

  it('warns about a part buried in the body', () => {
    // Leaning flat against the side, the spike runs inside the torso.
    const a = analyze({
      extends: 'quadruped',
      parts: [
        {
          id: 'stub',
          type: 'horn.curved',
          attach: { on: 'torso', at: 0.5, angle: 90 },
          params: { length: 0.3, curve: 0, lean: -90, width: 0.02 },
        },
      ],
    });
    expect(a.warnings.map((w) => `${w.path} ${w.code}`)).toContain('parts[id=stub] part_buried');
  });

  it('warns when a small creature steps fast, and each fix clears it', () => {
    const tiny = { extends: 'quadruped', scale: 0.1 };
    const a = analyze(tiny);
    expect(a.cadence.map((c) => c.id)).toEqual(['walk', 'trot']);
    const warning = a.warnings.find((w) => w.code === 'fast_cadence');
    expect(warning?.path).toBe('scale');
    const scale = Number(/"scale": ([\d.]+)/.exec(warning?.fix ?? '')?.[1]);
    expect(scale).toBeGreaterThan(0.1);
    const codes = (b: Record<string, unknown>) => analyze(b).warnings.map((w) => w.code);
    expect(codes({ ...tiny, scale })).not.toContain('fast_cadence');
    expect(warning?.fix).toContain('"motion.temperament": "skittish"');
    expect(codes({ ...tiny, motion: { temperament: 'skittish' } })).not.toContain('fast_cadence');
    // A creature of ordinary size steps slowly enough.
    expect(analyze(example('ridgeback-stalker')).cadence.every((c) => c.steps < 8)).toBe(true);
  });

  it('describes what it can do without its ambient actions', () => {
    const a = analyze({ extends: 'quadruped', motion: { actions: ['idle', 'bite'] } });
    expect(a.description).toContain('it can bite.');
    expect(a.description).not.toContain('idle');
  });
});
