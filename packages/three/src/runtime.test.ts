import { readFileSync } from 'node:fs';
import { basicPack } from '@spawnforge/modules';
import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { createBestiary } from './runtime.ts';

const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));

describe('runtime', () => {
  it('spawns, walks to a target and fires footsteps', async () => {
    const bestiary = await createBestiary({ packs: [basicPack] });
    const stalker = await bestiary.spawn(example('ridgeback-stalker'), {
      quality: 'low',
      position: { x: 2, z: 1 },
    });
    expect(stalker.position.x).toBeCloseTo(2);
    let steps = 0;
    stalker.on('footstep', () => steps++);
    stalker.moveTo({ x: 6, z: 1 });
    for (let i = 0; i < 300; i++) bestiary.update(1 / 60);
    expect(stalker.position.x).toBeGreaterThan(4);
    expect(steps).toBeGreaterThan(4);
    expect(stalker.actions()).toContain('bite');
    bestiary.dispose();
  }, 30_000);

  it('has sockets and hit capsules that follow the body', async () => {
    const bestiary = await createBestiary({ packs: [basicPack] });
    const troll = await bestiary.spawn(example('bog-troll'), { quality: 'low' });
    const mouth = troll.socket('mouth');
    const head = troll.socket('head');
    expect(mouth.distanceTo(head)).toBeLessThan(0.5);
    expect(head.y).toBeGreaterThan(1);
    const capsules = troll.hitCapsules();
    expect(capsules.length).toBeGreaterThan(5);
    for (const c of capsules) expect(c.radius).toBeGreaterThan(0);
    expect(() => troll.socket('wing')).toThrow(/mouth/);
    bestiary.dispose();
  }, 30_000);

  it('caches compiled creatures and lets the seed vary individuals', async () => {
    const bestiary = await createBestiary({ packs: [basicPack] });
    const blueprint = example('reed-viper');
    const a = await bestiary.spawn(blueprint, { quality: 'low' });
    const b = await bestiary.spawn(blueprint, { quality: 'low' });
    const c = await bestiary.spawn(blueprint, { quality: 'low', seed: 99 });
    expect(b.compiled).toBe(a.compiled);
    expect(c.compiled).not.toBe(a.compiled);
    expect(c.compiled.seed).toBe(99);
    bestiary.dispose();
  }, 30_000);

  it('plays baked cycles far from the camera and hands back to full motion near it', async () => {
    const bestiary = await createBestiary({ packs: [basicPack], lodDistance: 10 });
    const stalker = await bestiary.spawn(example('ridgeback-stalker'), { quality: 'low' });
    const camera = new PerspectiveCamera();
    camera.position.set(0, 2, 100);
    stalker.moveTo({ x: 0, z: 8 });
    for (let i = 0; i < 120; i++) bestiary.update(1 / 60, { camera });
    expect(stalker.lod).toBe('baked');
    expect(stalker.position.z).toBeGreaterThan(0.5);
    const z = stalker.position.z;
    camera.position.set(0, 2, z + 3);
    for (let i = 0; i < 120; i++) bestiary.update(1 / 60, { camera });
    expect(stalker.lod).toBe('full');
    expect(stalker.position.z).toBeGreaterThan(z);
    bestiary.dispose();
  }, 30_000);
});
