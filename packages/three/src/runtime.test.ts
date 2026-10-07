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
    let arrived = 0;
    stalker.on('arrive', () => arrived++);
    for (let i = 0; i < 600 && arrived === 0; i++) bestiary.update(1 / 60);
    expect(arrived).toBe(1);
    expect(bestiary.stats(stalker, 'rpg').health).toBeGreaterThan(10);
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

  it('gives every head its sockets, and says which head bit', async () => {
    const bestiary = await createBestiary({ packs: [basicPack] });
    const cerberus = await bestiary.spawn(example('cerberus'), { quality: 'low' });
    for (let i = 0; i < 30; i++) bestiary.update(1 / 60);
    const left = cerberus.socket('mouth.L1');
    const right = cerberus.socket('mouth.R1');
    expect(left.distanceTo(cerberus.socket('head.L1'))).toBeLessThan(0.5);
    expect(left.x).toBeGreaterThan(cerberus.socket('mouth').x);
    expect(right.x).toBeLessThan(cerberus.socket('mouth').x);
    const heads: (string | undefined)[] = [];
    cerberus.on('bite-contact', (e) => heads.push(e.head));
    cerberus.act('bite', { target: { x: left.x + 0.3, y: left.y, z: left.z + 0.3 } });
    for (let i = 0; i < 180; i++) bestiary.update(1 / 60);
    expect(heads).toEqual(['head.L1']);
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

  it('flies, keeps flying at a distance on baked cycles, and lands at full detail', async () => {
    const bestiary = await createBestiary({ packs: [basicPack], lodDistance: 10 });
    const bat = await bestiary.spawn(example('cave-bat'), { quality: 'low' });
    const events: string[] = [];
    bat.on('*', (e) => events.push(e.type));
    bat.fly({ height: 4 });
    expect(bat.flying).toBe(true);
    for (let i = 0; i < 360; i++) bestiary.update(1 / 60);
    expect(events).toContain('takeoff');
    expect(events).toContain('flap');
    expect(bat.position.y).toBeGreaterThan(2);
    // Far away it keeps flying on the controller, posed from its baked wingbeat.
    const camera = new PerspectiveCamera();
    camera.position.set(0, 2, 400);
    bat.moveTo({ x: 30, z: 0 });
    for (let i = 0; i < 120; i++) bestiary.update(1 / 60, { camera });
    expect(bat.lod).toBe('baked');
    expect(bat.flying).toBe(true);
    const flaps = events.filter((e) => e === 'flap').length;
    for (let i = 0; i < 120; i++) bestiary.update(1 / 60, { camera });
    expect(events.filter((e) => e === 'flap').length).toBeGreaterThan(flaps);
    // Landing comes back to full detail and puts it on the ground.
    bat.land({ x: bat.position.x + 10, z: bat.position.z });
    expect(bat.lod).toBe('full');
    for (let i = 0; i < 60 * 30 && bat.flying; i++) bestiary.update(1 / 60);
    expect(bat.flying).toBe(false);
    expect(events).toContain('land');
    expect(bat.position.y).toBeCloseTo(0, 3);
    // Spawned in the air, at the height asked for.
    const high = await bestiary.spawn(example('cave-bat'), {
      quality: 'low',
      flying: true,
      height: 6,
    });
    expect(high.flying).toBe(true);
    expect(high.position.y).toBeCloseTo(6, 3);
    bestiary.dispose();
  }, 60_000);
});
