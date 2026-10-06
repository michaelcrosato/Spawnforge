import { readFileSync } from 'node:fs';
import { FORMAT } from '@spawnforge/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Renderer } from './index.ts';

let renderer: Renderer;

beforeAll(async () => {
  renderer = await Renderer.launch();
}, 120_000);

afterAll(async () => {
  await renderer?.close();
});

const pngSize = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

describe('headless renders', () => {
  it('renders a contact sheet of six views with measurements', async () => {
    const result = await renderer.render({
      blueprint: { format: FORMAT, extends: 'quadruped' },
      size: 200,
      labels: true,
    });
    expect(result.png.subarray(1, 4).toString()).toBe('PNG');
    expect(pngSize(result.png)).toEqual({ width: 600, height: 444 });
    expect(result.info.length).toBeGreaterThan(1);
    expect(result.info.triangles).toBeGreaterThan(1000);
    expect(result.info.backend).toMatch(/WebGPU|WebGL/);
  }, 120_000);

  it('renders a single view', async () => {
    const result = await renderer.render({
      blueprint: { format: FORMAT, extends: 'serpent' },
      size: 160,
      views: ['top'],
    });
    expect(pngSize(result.png)).toEqual({ width: 160, height: 204 });
  }, 120_000);

  it('renders a filmstrip of one gait cycle with its measurements', async () => {
    const result = await renderer.render({
      blueprint: { format: FORMAT, extends: 'quadruped' },
      size: 120,
      filmstrip: { gait: 'trot', frames: 4 },
    });
    // Four frames in a row, a header and a footfall diagram for four legs.
    expect(pngSize(result.png).width).toBe(480);
    const motion = result.info.motion;
    expect(motion?.gait).toBe('trot');
    expect(motion?.cycle).toBeGreaterThan(0.1);
    expect(motion?.stride).toBeGreaterThan(0.1);
    expect(Object.keys(motion?.duty ?? {})).toHaveLength(4);
    for (const duty of Object.values(motion?.duty ?? {})) expect(duty).toBeCloseTo(0.5, 1);
    expect(motion?.footSlide).toBeLessThan(0.01);
  }, 120_000);

  it('renders an action as a filmstrip with its events', async () => {
    const result = await renderer.render({
      blueprint: { format: FORMAT, extends: 'quadruped' },
      size: 100,
      filmstrip: { action: 'bite', frames: 4 },
    });
    const motion = result.info.motion;
    expect(motion?.action).toBe('bite');
    expect(motion?.events?.map((e) => e.type)).toEqual([
      'action-start',
      'bite-contact',
      'action-end',
    ]);
  }, 120_000);

  it('compiles the examples in Chrome to the same meshes as in Node (golden test)', async () => {
    const golden = JSON.parse(
      readFileSync(new URL('../../modules/src/golden.json', import.meta.url), 'utf8'),
    ) as Record<string, { low: string; medium: string }>;
    for (const [name, expected] of Object.entries(golden)) {
      const blueprint = JSON.parse(
        readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'),
      );
      expect(await renderer.fingerprint(blueprint, 'low'), name).toBe(expected.low);
      expect(await renderer.fingerprint(blueprint, 'medium'), name).toBe(expected.medium);
    }
  }, 120_000);

  it('renders the examples like their approved images (visual regression)', async () => {
    // Same settings as `pnpm render:examples`, which writes the approved images.
    for (const name of ['ridgeback-stalker', 'reed-viper']) {
      const blueprint = JSON.parse(
        readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'),
      );
      const approved = readFileSync(new URL(`../../../examples/${name}.png`, import.meta.url));
      const { png } = await renderer.render({ blueprint, labels: true, size: 360 });
      const { differing } = await renderer.diff(png, approved);
      // Rasterizers differ a little between Chromium builds; a real change moves far more.
      expect(differing, name).toBeLessThan(0.03);
    }
  }, 120_000);

  it('exports a .glb with skinned meshes, vertex colours, clips, sockets and extras', async () => {
    const blueprint = JSON.parse(
      readFileSync(new URL('../../../examples/ridgeback-stalker.json', import.meta.url), 'utf8'),
    );
    const { glb, info } = await renderer.export({
      blueprint,
      quality: 'low',
      clips: ['idle', 'walk', 'bite'],
      extras: { blueprint },
    });
    expect(glb.subarray(0, 4).toString()).toBe('glTF');
    expect(glb.readUInt32LE(8)).toBe(glb.length);
    const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
    expect(json.meshes).toHaveLength(3);
    expect(json.skins).toHaveLength(3);
    for (const mesh of json.meshes)
      expect(Object.keys(mesh.primitives[0].attributes)).toEqual(
        expect.arrayContaining(['POSITION', 'NORMAL', 'JOINTS_0', 'WEIGHTS_0', 'COLOR_0']),
      );
    expect(json.animations.map((a: { name: string }) => a.name)).toEqual(['idle', 'walk', 'bite']);
    const names = json.nodes.map((n: { name?: string }) => n.name);
    expect(names).toEqual(expect.arrayContaining(['socket_mouth', 'socket_head']));
    const extras = json.nodes.find((n: { extras?: unknown }) => n.extras).extras.spawnforge;
    expect(extras.blueprint.name).toBe('Ridgeback Stalker');
    expect(extras.clips.find((c: { name: string }) => c.name === 'walk').loop).toBe(true);
    expect(info.clips).toHaveLength(3);
  }, 120_000);

  it('refuses invalid blueprints with the validation errors', async () => {
    await expect(renderer.render({ blueprint: { format: FORMAT, scale: 99 } })).rejects.toThrow(
      /scale/,
    );
  }, 120_000);
});
