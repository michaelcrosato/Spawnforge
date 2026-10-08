import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Renderer } from './index.ts';

/**
 * The engine guides' scripts (docs/engines.md) against a real export: the plain-Python extras
 * reader everywhere, and Blender's import where a Python with `bpy` is given in
 * $SPAWNFORGE_BPY_PYTHON (CI installs one).
 */
const engines = new URL('../../../engines/', import.meta.url).pathname;
let renderer: Renderer;
let dir: string;
let glb: string;
let extras: Record<string, unknown>;

beforeAll(async () => {
  renderer = await Renderer.launch();
  dir = mkdtempSync(join(tmpdir(), 'spawnforge-engines-'));
  glb = join(dir, 'wolf.glb');
  const blueprint = JSON.parse(
    readFileSync(new URL('../../../examples/grey-wolf.json', import.meta.url), 'utf8'),
  );
  const { glb: bytes } = await renderer.export({
    blueprint,
    quality: 'low',
    textures: 512,
    clips: ['idle', 'walk', 'bite'],
    extras: { blueprint },
  });
  writeFileSync(glb, bytes);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')) as {
    nodes: { extras?: { spawnforge?: Record<string, unknown> } }[];
  };
  extras = json.nodes.find((n) => n.extras?.spawnforge)?.extras?.spawnforge ?? {};
}, 180_000);

afterAll(async () => {
  await renderer?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const python = (bin: string, args: string[]) =>
  execFileSync(bin, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // No __pycache__ beside the scripts.
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });

describe('engine scripts', () => {
  it('reads the extras from the file in plain Python', () => {
    const out = JSON.parse(python('python3', [join(engines, 'python/spawnforge_extras.py'), glb]));
    expect(out).toEqual(extras);
    expect((out.clips as { name: string }[]).map((c) => c.name)).toEqual(['idle', 'walk', 'bite']);
  });

  it.skipIf(!process.env.SPAWNFORGE_BPY_PYTHON)(
    'imports into Blender with every clip, socket, map and the extras',
    () => {
      const out = python(process.env.SPAWNFORGE_BPY_PYTHON as string, [
        join(engines, 'blender/check_blender.py'),
        glb,
      ]);
      const report = JSON.parse(out.trim().split('\n').pop() as string);
      expect(report.actions).toBeGreaterThanOrEqual(3);
      expect(report.sockets).toBe((extras.sockets as unknown[]).length);
      expect(report.levels).toBe(6);
    },
    180_000,
  );
});
