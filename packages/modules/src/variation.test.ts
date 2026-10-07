import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  compileCreature,
  computeStats,
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
    const unknown = generate({ theme: 'unicorn', seed: 1 }, registry);
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

type Doc = {
  body: { neck: { count: number }; tail: { count: number } };
  limbs: { id: string; role?: string; foot?: { type: string } }[];
  parts: { id: string; type: string; params?: Record<string, unknown> }[];
};
const docOf = (blueprint: unknown) => expand(blueprint, registry).doc as unknown as Doc;
const roles = (doc: Doc, role: string) => doc.limbs.filter((l) => (l.role ?? 'leg') === role);

describe('variation of format 0.2 bodies (9.6)', () => {
  it('never changes how many heads, tails or limbs a mutant has', () => {
    for (const name of ['hydra', 'two-tailed-fox', 'griffin', 'kraken', 'reef-shark']) {
      const parent = docOf(example(name));
      for (let seed = 1; seed <= 12; seed++) {
        const child = mutate(example(name), { seed, amount: 1 }, registry);
        expect(child.ok, `${name} #${seed}: ${JSON.stringify(child.errors)}`).toBe(true);
        const doc = docOf(child.blueprint);
        expect(doc.body.neck.count).toBe(parent.body.neck.count);
        expect(doc.body.tail.count).toBe(parent.body.tail.count);
        expect(doc.limbs.map((l) => `${l.id}:${l.role}`)).toEqual(
          parent.limbs.map((l) => `${l.id}:${l.role}`),
        );
      }
    }
  });

  it('lets part counts drift again (rows of spikes, teeth)', () => {
    const changed = Array.from({ length: 20 }, (_, i) =>
      mutate(example('ash-dragon'), { seed: i + 1, amount: 1 }, registry),
    ).some((c) => c.diff.some((d) => d.path === 'parts[id=crest].params.count'));
    expect(changed).toBe(true);
  });

  it('changes feet a whole role at a time, to feet that stand a leg', () => {
    const standing = new Set(['foot.claw', 'foot.hoof', 'foot.pad', 'foot.paw', 'foot.talon']);
    let swapped = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const child = mutate(example('grey-wolf'), { seed, amount: 1 }, registry);
      const legs = roles(docOf(child.blueprint), 'leg').map((l) => l.foot?.type ?? '');
      expect(new Set(legs).size).toBe(1);
      expect(standing.has(legs[0] ?? '')).toBe(true);
      if (legs[0] !== 'foot.paw') swapped++;
    }
    expect(swapped).toBeGreaterThan(0);
  });

  it('keeps lineage parts to their lineage and never flips switches or the material', () => {
    const lineage = ['beak', 'mandible', 'hood', 'antenna'];
    for (const name of ['reed-viper', 'hydra', 'grey-wolf'])
      for (let seed = 1; seed <= 30; seed++) {
        const child = mutate(example(name), { seed, amount: 1 }, registry);
        const parent = docOf(example(name));
        const added = docOf(child.blueprint)
          .parts.map((p) => p.type)
          .filter((t) => lineage.includes(t) && !parent.parts.some((p) => p.type === t));
        // A hooded cobra may gain a hood again; a viper is a snake but wears none yet.
        expect(added, `${name} #${seed}`).toEqual([]);
        expect(
          child.diff.filter((d) => d.path === 'body.head.jaw' || d.path === 'skin.material'),
        ).toEqual([]);
        expect(child.diff.filter((d) => typeof d.from === 'boolean')).toEqual([]);
      }
  });

  it('measures body height without the wings, which rest folded', () => {
    const dragon = validateBlueprint(example('ash-dragon'), registry).creature;
    if (!dragon) throw new Error('dragon');
    const analysis = analyzeCreature(dragon, registry);
    expect(analysis.measurements.bodyHeight).toBeLessThanOrEqual(
      analysis.measurements.height + 1e-6,
    );
    expect(analysis.measurements.counts).toMatchObject({ heads: 1, legs: 4, wings: 2 });
  });

  it('adds fins only to swimmers', () => {
    for (const name of ['ridgeback-stalker', 'plated-stegosaur', 'sail-back'])
      for (let seed = 1; seed <= 30; seed++) {
        const child = mutate(example(name), { seed, amount: 1 }, registry);
        const fins = docOf(child.blueprint).parts.filter((p) => p.type.startsWith('fin.'));
        expect(fins, `${name} #${seed}`).toEqual([]);
      }
  });

  it('takes each section’s count of heads and tails whole from one parent', () => {
    const hydra = example('hydra');
    const wolf = example('grey-wolf');
    const counts = new Set<number>();
    for (let seed = 1; seed <= 16; seed++) {
      const child = crossbreed(hydra, wolf, { seed, base: 'a' }, registry);
      expect(child.ok, JSON.stringify(child.errors)).toBe(true);
      counts.add(docOf(child.blueprint).body.neck.count);
    }
    expect([...counts].sort()).toEqual([1, 5]);
    const fox = example('two-tailed-fox');
    expect(
      docOf(crossbreed(wolf, fox, { seed: 1, mix: 1, base: 'a' }, registry).blueprint).body.tail
        .count,
    ).toBe(2);
    expect(
      docOf(crossbreed(wolf, fox, { seed: 1, mix: 0, base: 'a' }, registry).blueprint).body.tail
        .count,
    ).toBe(1);
  });

  it('pairs wings by role and takes how many from one parent', () => {
    const wolf = example('grey-wolf');
    const griffin = example('griffin');
    const winged = crossbreed(wolf, griffin, { seed: 1, mix: 1, base: 'a' }, registry);
    expect(winged.ok, JSON.stringify(winged.errors)).toBe(true);
    const doc = docOf(winged.blueprint);
    expect(roles(doc, 'wing').length).toBe(roles(docOf(griffin), 'wing').length);
    expect(roles(doc, 'leg').length).toBe(2);
    expect(validateBlueprint(winged.blueprint, registry).creature?.motion.media.air).toBe(true);
    expect(
      roles(
        docOf(crossbreed(wolf, griffin, { seed: 1, mix: 0, base: 'a' }, registry).blueprint),
        'wing',
      ),
    ).toEqual([]);
    // Built on the griffin with all of the wolf's share, the wings go.
    const grounded = crossbreed(griffin, wolf, { seed: 1, mix: 1, base: 'a' }, registry);
    expect(roles(docOf(grounded.blueprint), 'wing')).toEqual([]);
    // Locked limbs stay as the base has them.
    const locked = crossbreed(
      wolf,
      griffin,
      { seed: 1, mix: 1, base: 'a', locked: ['limbs'] },
      registry,
    );
    expect(roles(docOf(locked.blueprint), 'wing')).toEqual([]);
  });

  it('crossbreeds every pair of new-vocabulary examples into valid children', () => {
    const names = ['hydra', 'griffin', 'kraken', 'reef-shark', 'stone-tortoise', 'tomb-spider'];
    for (const a of names)
      for (const b of names) {
        if (a === b) continue;
        const child = crossbreed(example(a), example(b), { seed: 3 }, registry);
        expect(child.ok, `${a} × ${b}: ${JSON.stringify(child.errors)}`).toBe(true);
      }
  }, 60_000);

  it('generates creatures that move where asked', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const fly = generate({ theme: 'dragon', seed, constraints: { requires: ['air'] } }, registry);
      expect(fly.ok).toBe(true);
      expect(validateBlueprint(fly.blueprint, registry).creature?.motion.media.air).toBe(true);
      const swim = generate(
        { theme: 'beast', seed, constraints: { requires: ['water'] } },
        registry,
      );
      expect(swim.ok).toBe(true);
      const media = validateBlueprint(swim.blueprint, registry).creature?.motion.media;
      expect(media).toMatchObject({ land: true, water: true });
    }
    const grounded = generate(
      { theme: 'insect', seed: 1, constraints: { requires: ['air'] } },
      registry,
    );
    expect(grounded.ok).toBe(false);
    expect(grounded.errors[0]?.fix).toContain('dragon');
    const wrong = generate(
      { theme: 'dragon', seed: 1, constraints: { requires: ['space' as 'air'] } },
      registry,
    );
    expect(wrong.errors[0]?.path).toBe('constraints.requires[0]');
  });

  it('shows every optional part and limb of every theme across seeds', () => {
    for (const theme of registry.list('theme')) {
      const seen = new Set<string>();
      for (let seed = 1; seed <= 40; seed++) {
        const made = generate({ theme: theme.id, seed }, registry);
        expect(made.ok, `${theme.id} #${seed}`).toBe(true);
        const doc = docOf(made.blueprint);
        for (const p of doc.parts) seen.add(`part:${p.id}`);
        for (const l of doc.limbs) seen.add(`limb:${l.id}:${l.foot?.type ?? ''}`);
      }
      for (const entry of theme.bias.parts ?? [])
        expect(seen, `${theme.id}: ${String(entry.part.id)}`).toContain(
          `part:${String(entry.part.id)}`,
        );
      for (const entry of theme.bias.limbs ?? [])
        for (const limb of entry.limbs) {
          const foot = (limb.foot as { type?: string } | undefined)?.type;
          const hit = [...seen].some(
            (s) => s.startsWith(`limb:${String(limb.id)}:`) && (!foot || s.endsWith(`:${foot}`)),
          );
          expect(hit, `${theme.id}: limb ${String(limb.id)}`).toBe(true);
        }
    }
  }, 120_000);
});

describe('rpg for format 0.2 bodies (9.6)', () => {
  const stats = (name: string) => {
    const spec = validateBlueprint(example(name), registry).creature;
    if (!spec) throw new Error(name);
    return computeStats(spec, analyzeCreature(spec, registry), registry, 'rpg');
  };

  it('attacks once a turn per head, each hit from one head', () => {
    const hydra = stats('hydra');
    expect(hydra.attacks).toBe(5);
    const one = validateBlueprint(
      {
        ...example('hydra'),
        body: { ...example('hydra').body, neck: { ...example('hydra').body.neck, count: 1 } },
      },
      registry,
    ).creature;
    if (!one) throw new Error('hydra');
    const single = computeStats(one, analyzeCreature(one, registry), registry, 'rpg');
    expect(single.attacks).toBe(1);
    expect(Math.abs((hydra.attack as number) - (single.attack as number))).toBeLessThanOrEqual(2);
    expect(hydra.threat).toBeGreaterThan(single.threat as number);
  });

  it('gives shells and plates armour', () => {
    const tortoise = example('stone-tortoise');
    const bare = {
      ...tortoise,
      parts: tortoise.parts.filter((p: { id: string }) => p.id !== 'shell'),
    };
    const spec = validateBlueprint(bare, registry).creature;
    if (!spec) throw new Error('tortoise');
    const without = computeStats(spec, analyzeCreature(spec, registry), registry, 'rpg');
    expect(stats('stone-tortoise').defence).toBeGreaterThanOrEqual((without.defence as number) + 8);
    expect(stats('plated-stegosaur').defence).toBeGreaterThan(stats('grey-wolf').defence as number);
  });
});
