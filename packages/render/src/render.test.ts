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

  it('refuses invalid blueprints with the validation errors', async () => {
    await expect(renderer.render({ blueprint: { format: FORMAT, scale: 99 } })).rejects.toThrow(
      /scale/,
    );
  }, 120_000);
});
