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
    for (const name of [
      'ridgeback-stalker',
      'ember-beetle',
      'reed-viper',
      'bog-troll',
      'grey-wolf',
      'tusk-boar',
      'rust-raptor',
    ]) {
      const a = analyze(example(name));
      // The walking pace on flat and rough ground, then each faster gait at its own speed.
      expect(a.motion.slice(0, 2).map((m) => m.ground)).toEqual(['flat', 'rough']);
      if (a.cadence.length > 0)
        expect(new Set(a.motion.map((m) => m.gait))).toEqual(new Set(a.cadence.map((c) => c.id)));
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
    // Front and hind legs crowded together meet in the stride, and the fix says so.
    const hit = a.warnings.find((w) => w.code === 'limb_intersection');
    expect(hit?.message).toMatch(/segment\)/);
    expect(hit?.fix).toMatch(/stride/);
  });

  it('tells two legs of a pair meeting under the body to attach higher, not splay (gate 8)', () => {
    const a = analyze({
      extends: 'quadruped',
      limbs: [
        { id: 'hindleg', attach: { angle: 175 }, radius: [0.12, 0.08] },
        { id: 'foreleg', attach: { angle: 175 }, radius: [0.12, 0.08] },
      ],
    });
    const hit = a.warnings.find((w) => w.code === 'limb_intersection');
    expect(hit?.message).toMatch(/(fore|hind)leg\.[LR] .* into (fore|hind)leg\.[LR]/);
    expect(hit?.fix).toMatch(/attach both higher/);
  });

  it('says which way an unbalanced body tips, and the fix it names clears it (gate 9)', () => {
    const tip = (blueprint: Record<string, unknown>) =>
      analyze(blueprint).warnings.find((w) => w.code === 'unbalanced');
    // A biped leaning too far forward: stand it more upright, as the fix says.
    const leaning = tip({ extends: 'biped', body: { torso: { pitch: 55 } } });
    expect(leaning?.message).toMatch(/ahead of the front feet, so it would tip forward/);
    expect(leaning?.fix).toMatch(/a higher torso pitch/);
    expect(tip({ extends: 'biped', body: { torso: { pitch: 80 } } })).toBeUndefined();
    // A heavy tail behind a quadruped's hindlegs: lighten it.
    const tail = { length: 2, radius: [0.25, 0.2] };
    const heavy = tip({ extends: 'quadruped', body: { tail } });
    expect(heavy?.message).toMatch(/behind the hind feet, so it would tip backward/);
    expect(heavy?.fix).toMatch(/shorten or slim the tail/);
    expect(tip({ extends: 'quadruped', body: { tail: { ...tail, length: 0.5 } } })).toBeUndefined();
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
    expect(a.cadence.map((c) => c.id)).toEqual(['walk', 'trot', 'bound']);
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

  it('calls a horn on the jaw a tusk and one on the tail a stinger (gate 9)', () => {
    // A pair at the sides; one on the midline (angle 0).
    const description = (on: string, angle = 60) =>
      analyze({
        extends: 'quadruped',
        parts: [{ id: 'h', type: 'horn.curved', attach: { on, at: 0.9, angle } }],
      }).description;
    expect(description('jaw')).toContain('curved tusks on its jaw');
    expect(description('tail', 0)).toContain('a curved stinger on its tail');
    expect(description('head')).toContain('curved horns on its head');
  });
});
