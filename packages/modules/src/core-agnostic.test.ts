import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRegistry, definePack, FORMAT, validateBlueprint } from '@spawnforge/core';
import { describe, expect, it } from 'vitest';
import { basicPack } from './index.ts';

const coreSrc = new URL('../../core/src/', import.meta.url);

function sources(dir: URL): { path: string; text: string }[] {
  return readdirSync(dir).flatMap((name) => {
    const url = new URL(name, dir);
    if (statSync(url).isDirectory()) return sources(new URL(`${name}/`, dir));
    if (!name.endsWith('.ts') || name.endsWith('.test.ts')) return [];
    return [{ path: url.pathname.slice(coreSrc.pathname.length), text: readFileSync(url, 'utf8') }];
  });
}

/** Source without comments, so docs may still give examples. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('the core', () => {
  it('names no module of the basic pack', () => {
    const allowed = new Set([
      // The baked "idle" clip names the ambient motion it holds, not the action module.
      'motion/clips.ts:idle',
      // Words in the description and a skin material that share a name with modules.
      'analysis/analyze.ts:biped',
      'analysis/analyze.ts:quadruped',
      'blueprint/schema.ts:scales',
      'shading/compose.ts:scales',
      // An example of the id format in an error message.
      'registry.ts:horn.curved',
    ]);
    const found: string[] = [];
    for (const { path, text } of sources(coreSrc)) {
      const body = code(text);
      for (const module of basicPack.modules) {
        if (allowed.has(`${path}:${module.id}`)) continue;
        if (body.includes(`'${module.id}'`) || body.includes(`"${module.id}"`))
          found.push(`${path} names ${module.kind} "${module.id}"`);
      }
    }
    expect(found).toEqual([]);
  });

  it('works with a pack that sets no defaults: no foot, no layers', () => {
    const bare = createRegistry([definePack({ id: 'bare', modules: basicPack.modules })]);
    const result = validateBlueprint(
      { format: FORMAT, limbs: [{ id: 'leg', attach: { at: 0.5 } }] },
      bare,
      { minimal: false },
    );
    expect(result.errors).toEqual([]);
    expect(result.creature?.limbs[0]?.foot).toBeNull();
    expect(result.creature?.skin.layers).toEqual([]);
  });

  it('takes the foot and layers a blueprint leaves out from the pack', () => {
    const registry = createRegistry([basicPack]);
    const result = validateBlueprint(
      { format: FORMAT, limbs: [{ id: 'leg', attach: { at: 0.5 } }] },
      registry,
      { minimal: false },
    );
    expect(result.creature?.limbs[0]?.foot?.type).toBe(basicPack.defaults.foot.leg);
    expect(result.creature?.skin.layers.map((l) => l.type)).toEqual(
      basicPack.defaults.layers.map((l) => l.type),
    );
  });
});
