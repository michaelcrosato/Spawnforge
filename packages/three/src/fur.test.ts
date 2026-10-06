import {
  compileCreature,
  createRegistry,
  FORMAT,
  type Quality,
  resolveBlueprint,
} from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { describe, expect, it } from 'vitest';
import { createCreatureObject } from './assemble.ts';
import { FUR_SHELLS } from './materials.ts';
import { createBestiary } from './runtime.ts';

const registry = createRegistry([basicPack]);
const furry = { format: FORMAT, extends: 'quadruped', skin: { fur: { length: 0.04 } } };
const build = (blueprint: unknown, quality: Quality) =>
  createCreatureObject(
    compileCreature(resolveBlueprint(blueprint, registry), registry, { quality }),
    registry,
  );
const drawn = (object: ReturnType<typeof build>['object']) => {
  let meshes = 0;
  object.traverse((o) => {
    if ((o as { isMesh?: boolean }).isMesh) meshes++;
  });
  return meshes;
};

describe('fur (8.4)', () => {
  it('adds one instanced draw call of shells over the skin, and none at low quality', () => {
    const bare = build({ ...furry, skin: {} }, 'medium');
    const coat = build(furry, 'medium');
    expect(drawn(coat.object)).toBe(drawn(bare.object) + 1);
    const fur = coat.meshes.fur;
    expect(fur?.count).toBe(FUR_SHELLS.medium);
    expect(FUR_SHELLS.high).toBeLessThanOrEqual(16);
    // The shells are the skin's own geometry, not a copy.
    expect(fur?.geometry).toBe(coat.meshes.skin.geometry);
    expect(fur?.castShadow).toBe(false);
    const low = build(furry, 'low');
    expect(low.meshes.fur).toBeUndefined();
    expect(drawn(low.object)).toBe(drawn(bare.object));
  });

  it('hides the shells at the baked level of detail', async () => {
    const bestiary = await createBestiary({ packs: [basicPack] });
    const wolf = await bestiary.spawn(furry, { quality: 'medium' });
    const fur = (wolf as unknown as { view: ReturnType<typeof build> }).view.meshes.fur;
    expect(fur?.visible).toBe(true);
    wolf.setLod('baked');
    expect(fur?.visible).toBe(false);
    wolf.setLod('full');
    expect(fur?.visible).toBe(true);
    bestiary.dispose();
  });
});
