/// <reference path="./gltf-validator.d.ts" />
import { readFileSync } from 'node:fs';
import { validateBytes } from 'gltf-validator';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PROBES, Renderer, roundTripVerdict } from './index.ts';

/** Texture maps in exports (docs/design/11.1-textures.md): the validator and the round trip. */
let renderer: Renderer;

beforeAll(async () => {
  renderer = await Renderer.launch();
}, 120_000);

afterAll(async () => {
  await renderer?.close();
});

const example = (name: string) =>
  JSON.parse(readFileSync(new URL(`../../../examples/${name}.json`, import.meta.url), 'utf8'));
const json = (glb: Buffer) =>
  JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')) as {
    materials: Record<string, unknown>[];
    meshes: { primitives: { attributes: Record<string, number>; material: number }[] }[];
    nodes: { name?: string; mesh?: number; extras?: { spawnforge?: Record<string, unknown> } }[];
    images: unknown[];
    extensionsUsed?: string[];
  };

describe('textured exports', () => {
  it('writes maps, tangents and glow that the Khronos validator accepts', async () => {
    const { glb, info } = await renderer.export({
      blueprint: example('ember-beetle'),
      quality: 'low',
      clips: ['idle'],
      textures: 512,
    });
    const report = await validateBytes(new Uint8Array(glb), { maxIssues: 100 });
    expect(
      report.issues.messages.filter((m) => m.severity === 0).map((m) => `${m.code} ${m.pointer}`),
    ).toEqual([]);
    const gltf = json(glb);
    const skinNode = gltf.nodes.find((n) => n.name === 'skin');
    const skin = gltf.meshes[skinNode?.mesh as number]?.primitives[0];
    expect(Object.keys(skin?.attributes ?? {})).toEqual(
      expect.arrayContaining(['TEXCOORD_0', 'TANGENT']),
    );
    expect(Object.keys(skin?.attributes ?? {})).not.toContain('COLOR_0');
    const material = gltf.materials[skin?.material as number] as Record<string, unknown>;
    expect(material).toMatchObject({
      pbrMetallicRoughness: { baseColorTexture: {}, metallicRoughnessTexture: {} },
      normalTexture: {},
      occlusionTexture: {},
      emissiveTexture: {},
    });
    // The beetle's glow is brighter than 1, and its chitin lacquered.
    expect(gltf.extensionsUsed).toEqual(
      expect.arrayContaining(['KHR_materials_emissive_strength', 'KHR_materials_clearcoat']),
    );
    expect(info.textures?.size).toBe(512);
    const extras = gltf.nodes.find((n) => n.extras?.spawnforge)?.extras?.spawnforge;
    expect(extras?.textures).toMatchObject({ size: 512 });
    expect(info.notes.join(' ')).toMatch(/glow is baked/);
  }, 120_000);

  it.each(['grey-wolf', 'ember-beetle', 'cave-bat', 'luna-moth'])(
    'round-trips %s: the loaded .glb looks as the live creature does',
    async (name) => {
      const r = await renderer.roundTrip({ blueprint: example(name), textures: 512 });
      const verdict = roundTripVerdict(r);
      expect(verdict.failed, JSON.stringify(r.views)).toEqual([]);
    },
    180_000,
  );

  it('scores the relief on its own, and catches a flipped green channel', async () => {
    const good = await renderer.roundTrip({
      blueprint: PROBES.relief,
      textures: 512,
      probe: 'relief',
      withoutTangents: false,
    });
    expect(roundTripVerdict(good).pass, JSON.stringify(good.probe)).toBe(true);
    const bad = await renderer.roundTrip({
      blueprint: PROBES.relief,
      textures: 512,
      probe: 'relief',
      withoutTangents: false,
      mutate: 'green',
    });
    expect(roundTripVerdict(bad).pass, JSON.stringify(bad.probe)).toBe(false);
  }, 240_000);
});
