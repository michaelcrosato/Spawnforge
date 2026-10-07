import { readFileSync } from 'node:fs';
import {
  analyzeCreature,
  bakeClips,
  bakeVertexColors,
  type CompiledCreature,
  compileCreature,
  computeStats,
  createRegistry,
  resolveBlueprint,
} from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const registry = createRegistry([basicPack]);
const blueprint = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
const compiled = new Map<string, CompiledCreature>();
const compile = (name: string) => {
  let c = compiled.get(name);
  if (!c) {
    c = compileCreature(resolveBlueprint(blueprint(name), registry), registry, { quality: 'low' });
    compiled.set(name, c);
  }
  return c;
};

describe('vertex colour bake', () => {
  it('colours every vertex in range, the same way every time', () => {
    const c = compile('ridgeback-stalker');
    const a = bakeVertexColors(c, registry);
    const b = bakeVertexColors(c, registry);
    expect(a.skin.color.length).toBe(c.skin.positions.length);
    expect(a.parts.color.length).toBe(c.parts.positions.length);
    expect(a.eyes.color.length).toBe(c.eyes.positions.length);
    for (const v of a.skin.color) expect(v >= 0 && v <= 1).toBe(true);
    expect(a.skin.color).toEqual(b.skin.color);
  });

  it('shows the pattern: a striped back is not one flat colour', () => {
    const { color } = bakeVertexColors(compile('ridgeback-stalker'), registry).skin;
    let min = 1;
    let max = 0;
    for (let i = 1; i < color.length; i += 3) {
      min = Math.min(min, color[i] as number);
      max = Math.max(max, color[i] as number);
    }
    expect(max - min).toBeGreaterThan(0.2);
  });
});

describe('baked clips', () => {
  it('bakes idle, a looping in-place cycle per gait, and each action', () => {
    const c = compile('ridgeback-stalker');
    const clips = bakeClips(c, registry);
    expect(clips.map((k) => k.name)).toEqual(['idle', 'walk', 'trot', 'bite', 'roar']);
    const n = c.bones.names.length;
    for (const clip of clips.filter((k) => k.loop)) {
      const last = (clip.frames - 1) * n;
      for (let b = 0; b < n; b++)
        for (let j = 0; j < 4; j++)
          expect(Math.abs(clip.rotations[b * 4 + j] as number)).toBeCloseTo(
            Math.abs(clip.rotations[(last + b) * 4 + j] as number),
            5,
          );
      // The root stays at the origin.
      expect(Math.abs(clip.positions[c.rig.root * 3] as number)).toBeLessThan(1e-6);
      expect(Math.abs(clip.positions[c.rig.root * 3 + 2] as number)).toBeLessThan(1e-6);
    }
    const walk = clips.find((k) => k.name === 'walk');
    expect(walk?.distance).toBeGreaterThan(0.1);
    expect(walk?.events.filter((e) => e.type === 'footstep').length).toBe(4);
    const bite = clips.find((k) => k.name === 'bite');
    expect(bite?.loop).toBe(false);
    expect(bite?.events.map((e) => e.type)).toContain('bite-contact');
  });

  it('bakes only the clips asked for and names the ones it has', () => {
    const c = compile('reed-viper');
    expect(bakeClips(c, registry, { clips: ['slither'] }).map((k) => k.name)).toEqual(['slither']);
    expect(() => bakeClips(c, registry, { clips: ['trot'] })).toThrow(/slither/);
  });
});

describe('stats', () => {
  it('maps the body to game numbers: bigger means tougher', () => {
    const small = resolveBlueprint({ ...blueprint('ridgeback-stalker'), scale: 0.6 }, registry);
    const big = resolveBlueprint({ ...blueprint('ridgeback-stalker'), scale: 1.8 }, registry);
    const stats = (spec: typeof small) =>
      computeStats(spec, analyzeCreature(spec, registry), registry, 'rpg');
    const [a, b] = [stats(small), stats(big)];
    expect(Object.keys(a)).toEqual([
      'health',
      'speed',
      'swim',
      'fly',
      'attack',
      'attacks',
      'defence',
      'perception',
      'threat',
    ]);
    expect(b.health).toBeGreaterThan(a.health as number);
    expect(b.threat).toBeGreaterThan(a.threat as number);
    expect(() => computeStats(small, analyzeCreature(small, registry), registry, 'dnd')).toThrow(
      /rpg/,
    );
  }, 30_000);
});
