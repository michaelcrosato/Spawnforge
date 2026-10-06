import { readFileSync } from 'node:fs';
import { bakeClips, compileCreature, createRegistry, resolveBlueprint } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { describe, expect, it } from 'vitest';
import { buildExportScene } from './export.ts';

const registry = createRegistry([basicPack]);
const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));

describe('export', () => {
  it('blinks with the eyelid bones, never by squashing the eyes (8.3)', () => {
    const compiled = compileCreature(resolveBlueprint(example('grey-wolf'), registry), registry, {
      quality: 'low',
    });
    const clips = bakeClips(compiled, registry, { clips: ['idle'], idleSeconds: 6 });
    const { animations } = buildExportScene(compiled, registry, { clips });
    const tracks = animations[0]?.tracks.map((t) => t.name) ?? [];
    const lids = compiled.bones.names.filter((n) => /\.(upper|lower)$/.test(n));
    expect(lids.length).toBe(4);
    expect(tracks.filter((t) => /(upper|lower)\.quaternion$/.test(t)).length).toBe(4);
    expect(tracks.some((t) => t.endsWith('.scale'))).toBe(false);
  });
});
