import { readFileSync } from 'node:fs';
import {
  compileCreature,
  createRegistry,
  crossbreed,
  expand,
  FORMAT,
  generate,
  instantiate,
  isSpecies,
  mutate,
  validateBlueprint,
  validateSpecies,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
const EXAMPLES = ['ridgeback-stalker', 'bog-troll', 'reed-viper', 'ember-beetle'];

const species = {
  format: FORMAT,
  name: 'Marsh Hound',
  extends: 'quadruped',
  scale: { min: 0.8, max: 1.2 },
  body: { neck: { length: { min: 0.2, max: 0.4 } }, torso: { segments: { min: 4, max: 8 } } },
  parts: [
    {
      id: 'horns',
      type: 'horn.curved',
      attach: { on: 'head', at: 0.7, angle: 40 },
      params: { curve: { min: 20, max: 120 } },
    },
  ],
};

describe('species', () => {
  it('resolves every range for a seed, within bounds, integers staying integers', () => {
    expect(isSpecies(species)).toBe(true);
    const one = instantiate(species, 7);
    expect(isSpecies(one)).toBe(false);
    expect(instantiate(species, 7)).toEqual(one);
    expect(one.name).toBe('Marsh Hound #7');
    const scale = one.scale as number;
    expect(scale).toBeGreaterThanOrEqual(0.8);
    expect(scale).toBeLessThanOrEqual(1.2);
    const segments = (one.body as { torso: { segments: number } }).torso.segments;
    expect(Number.isInteger(segments)).toBe(true);
    expect(validateBlueprint(one, registry).ok).toBe(true);
    const others = [1, 2, 3, 4, 5].map((s) => instantiate(species, s).scale);
    expect(new Set(others).size).toBeGreaterThan(3);
  });

  it('keeps other values when one range changes', () => {
    const narrower = structuredClone(species);
    narrower.scale = { min: 1, max: 1.1 };
    const a = instantiate(species, 3);
    const b = instantiate(narrower, 3);
    expect(b.body).toEqual(a.body);
    expect(b.parts).toEqual(a.parts);
  });

  it('reports malformed ranges and ends that make an invalid creature', () => {
    const bad = validateSpecies(
      { ...species, scale: { min: 2, max: 1 }, body: { neck: { length: { min: 0.2 } } } },
      registry,
    );
    expect(bad.ok).toBe(false);
    expect(bad.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(['scale', 'body.neck.length']),
    );
    const tooLong = validateSpecies(
      { ...species, body: { neck: { length: { min: 0.2, max: 9 } } } },
      registry,
    );
    expect(tooLong.ok).toBe(false);
    expect(tooLong.errors[0]?.path).toBe('body.neck.length');
    expect(tooLong.errors[0]?.message).toContain('max');
    expect(validateSpecies(species, registry).ok).toBe(true);
  });
});

describe('species ranges', () => {
  it('gives integer fields whole numbers and number fields anything in between', () => {
    const sp = {
      format: FORMAT,
      extends: 'serpent',
      body: { tail: { length: { min: 2, max: 3 } }, torso: { segments: { min: 6, max: 10 } } },
    };
    const tails = new Set<number>();
    for (let seed = 1; seed <= 12; seed++) {
      const one = instantiate(sp, seed, registry) as {
        body: { tail: { length: number }; torso: { segments: number } };
      };
      tails.add(one.body.tail.length);
      expect(Number.isInteger(one.body.torso.segments)).toBe(true);
    }
    expect([...tails].some((t) => !Number.isInteger(t))).toBe(true);
  });

  it('blends colours between two ends', () => {
    const sp = {
      format: FORMAT,
      extends: 'quadruped',
      skin: { palette: { base: { min: '#202020', max: '#e0e0e0' } } },
    };
    const colors = [1, 2, 3, 4].map(
      (seed) =>
        (instantiate(sp, seed, registry).skin as { palette: { base: string } }).palette.base,
    );
    expect(new Set(colors).size).toBe(4);
    for (const c of colors) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(validateSpecies(sp, registry).ok).toBe(true);
  });
});

describe('mutate', () => {
  it('gives valid, repeatable children for every example', () => {
    for (const name of EXAMPLES)
      for (const seed of [1, 2, 3, 4, 5]) {
        const parent = example(name);
        const child = mutate(parent, { seed, amount: seed === 5 ? 1 : 0.3 }, registry);
        expect(child.ok, `${name} #${seed}: ${JSON.stringify(child.errors)}`).toBe(true);
        expect(child.diff.length).toBeGreaterThan(0);
        expect(mutate(parent, { seed, amount: seed === 5 ? 1 : 0.3 }, registry)).toEqual(child);
      }
  });

  it('keeps numbers in range and locked paths unchanged', () => {
    const parent = example('ridgeback-stalker');
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const child = mutate(parent, { seed, amount: 1, locked: ['skin', 'body.head'] }, registry);
      expect(child.ok).toBe(true);
      expect(child.diff.filter((d) => /^(skin|body\.head)\b/.test(d.path))).toEqual([]);
    }
    expect(mutate(parent, { seed: 1, amount: 0 }, registry).diff).toEqual([]);
    const warned = mutate(parent, { seed: 1, locked: ['body.wings'] }, registry);
    expect(warned.warnings.map((w) => w.code)).toContain('unknown_lock');
  });

  it('locks layers by type or id, as patch addresses them', () => {
    const viper = example('reed-viper');
    for (const lock of ['skin.layers[type=stripes]', 'skin.layers[1]']) {
      for (const seed of [1, 2, 3]) {
        const child = mutate(viper, { seed, amount: 1, locked: [lock] }, registry);
        expect(child.warnings.map((w) => w.code)).not.toContain('unknown_lock');
        expect(child.diff.filter((d) => d.path.startsWith('skin.layers[1]'))).toEqual([]);
      }
    }
  });

  it('keeps pattern colours readable against the skin', () => {
    const viper = example('reed-viper');
    const lightness = (hex: string) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      return (Math.max(...c) + Math.min(...c)) / 510;
    };
    for (let seed = 1; seed <= 30; seed++) {
      const child = mutate(viper, { seed, amount: 1 }, registry);
      const palette = (
        expand(child.blueprint, registry).doc as {
          skin: { palette: Record<string, string> };
        }
      ).skin.palette;
      const gap = Math.abs(lightness(palette.accent as string) - lightness(palette.base as string));
      expect(gap).toBeGreaterThanOrEqual(0.1);
    }
  });

  it('changes parts now and then, never removing eyes', () => {
    const parent = example('ridgeback-stalker');
    let structural = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const child = mutate(parent, { seed, amount: 0.8 }, registry);
      const doc = expand(child.blueprint, registry).doc as { parts: { id: string }[] };
      expect(doc.parts.some((p) => p.id === 'eyes')).toBe(true);
      if (child.diff.some((d) => /^parts\[id=[^\]]+\](\.type)?$/.test(d.path))) structural++;
    }
    expect(structural).toBeGreaterThan(3);
    expect(structural).toBeLessThan(30);
  });
});

describe('crossbreed', () => {
  it('gives valid, repeatable children for every pair of examples', () => {
    for (const a of EXAMPLES)
      for (const b of EXAMPLES) {
        if (a === b) continue;
        const child = crossbreed(example(a), example(b), { seed: 2 }, registry);
        expect(child.ok, `${a} × ${b}: ${JSON.stringify(child.errors)}`).toBe(true);
        expect(crossbreed(example(a), example(b), { seed: 2 }, registry)).toEqual(child);
      }
  });

  it('copies a parent at mix 0 and blends in between', () => {
    const a = example('ridgeback-stalker');
    const b = mutate(a, { seed: 9, amount: 0.6, structure: false }, registry).blueprint;
    const same = crossbreed(a, b, { seed: 1, mix: 0 }, registry);
    expect(same.base).toBe('a');
    expect(same.diff.map((d) => d.path)).toEqual(['name', 'seed']);
    const half = crossbreed(a, b, { seed: 1, mix: 0.5 }, registry);
    const doc = (x: unknown) => expand(x, registry).doc as { scale: number };
    const [sa, sb, sc] = [doc(a).scale, doc(b).scale, doc(half.blueprint).scale];
    if (sa !== sb) {
      expect(sc).toBeGreaterThanOrEqual(Math.min(sa, sb));
      expect(sc).toBeLessThanOrEqual(Math.max(sa, sb));
    }
  });

  it('builds on the parent asked for and keeps locked paths', () => {
    const troll = example('bog-troll');
    const beetle = example('ember-beetle');
    for (const seed of [1, 2, 3, 4]) {
      const child = crossbreed(
        troll,
        beetle,
        { seed, mix: 0.5, base: 'a', locked: ['body.torso', 'limbs'] },
        registry,
      );
      expect(child.ok).toBe(true);
      expect(child.base).toBe('a');
      expect(child.blueprint.extends).toBe('biped');
      expect(child.diff.filter((d) => /^(body\.torso|limbs)/.test(d.path))).toEqual([]);
    }
  });

  it('pairs parts of one type only on the same section', () => {
    const troll = example('bog-troll');
    const beetle = example('ember-beetle');
    // The troll's tusks sit on the jaw and the beetle's horn on the head: at mix 1 the horn
    // comes over as its own part.
    const child = crossbreed(troll, beetle, { seed: 1, mix: 1, base: 'a' }, registry);
    const parts = (expand(child.blueprint, registry).doc as { parts: { id: string }[] }).parts;
    expect(parts.map((p) => p.id)).toContain('horn');
  });

  it('keeps the body plan of the parent mix points to', () => {
    const quad = example('ridgeback-stalker');
    const snake = example('reed-viper');
    expect(crossbreed(quad, snake, { seed: 1, mix: 0 }, registry).blueprint.extends).toBe(
      'quadruped',
    );
    const toSnake = crossbreed(quad, snake, { seed: 1, mix: 1 }, registry);
    expect(toSnake.base).toBe('b');
    expect(toSnake.blueprint.extends).toBe('serpent');
  });
});

describe('generate', () => {
  it('makes valid, repeatable creatures from every theme', () => {
    for (const theme of registry.ids('theme'))
      for (let seed = 1; seed <= 8; seed++) {
        const made = generate({ theme, seed }, registry);
        expect(made.ok, `${theme} #${seed}: ${JSON.stringify(made.errors)}`).toBe(true);
        expect(validateBlueprint(made.blueprint, registry, { minimal: false }).ok).toBe(true);
        if (seed === 1) expect(generate({ theme, seed }, registry)).toEqual(made);
      }
  }, 30_000);

  it('compiles what it makes', () => {
    for (const theme of registry.ids('theme')) {
      const made = generate({ theme, seed: 5 }, registry);
      const spec = validateBlueprint(made.blueprint, registry, { minimal: false }).creature;
      if (!spec) throw new Error(`${theme} did not validate`);
      const compiled = compileCreature(spec, registry, { quality: 'low' });
      expect(compiled.skin.positions.length).toBeGreaterThan(0);
    }
  });

  it('meets constraints: body plan, height, actions and parts', () => {
    const tall = generate(
      { theme: 'reptile', seed: 2, constraints: { bodyPlan: 'serpent', minHeight: 0.5 } },
      registry,
    );
    expect(tall.blueprint.extends).toBe('serpent');
    expect(tall.measurements?.bodyHeight).toBeCloseTo(0.5, 2);
    for (let seed = 1; seed <= 6; seed++) {
      const small = generate(
        {
          theme: 'demon',
          seed,
          constraints: { maxHeight: 0.8, actions: ['bite', 'roar'], parts: ['ear.pointed'] },
        },
        registry,
      );
      expect(small.ok).toBe(true);
      expect(small.measurements?.bodyHeight).toBeLessThanOrEqual(0.8001);
      const spec = validateBlueprint(small.blueprint, registry).creature;
      expect(spec?.motion.actions.map((a) => a.type)).toEqual(
        expect.arrayContaining(['bite', 'roar']),
      );
      expect(spec?.parts.some((p) => p.type === 'ear.pointed')).toBe(true);
    }
  }, 30_000);

  it('explains what it cannot do', () => {
    const unknown = generate({ theme: 'dragon', seed: 1 }, registry);
    expect(unknown.ok).toBe(false);
    expect(unknown.errors[0]?.fix).toContain('reptile');
    const plan = generate(
      { theme: 'insect', seed: 1, constraints: { bodyPlan: 'tripod' } },
      registry,
    );
    expect(plan.errors[0]?.path).toBe('constraints.bodyPlan');
    const range = generate(
      { theme: 'insect', seed: 1, constraints: { minHeight: 2, maxHeight: 1 } },
      registry,
    );
    expect(range.ok).toBe(false);
  });
});
