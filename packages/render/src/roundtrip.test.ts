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
    nodes: {
      name?: string;
      mesh?: number;
      skin?: number;
      children?: number[];
      extensions?: { MSFT_lod?: { ids: number[] } };
      extras?: { spawnforge?: Record<string, unknown>; MSFT_screencoverage?: number[] };
    }[];
    scenes: { nodes: number[] }[];
    skins: { joints: number[] }[];
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

    // Levels of detail (docs/design/11.2-lod.md): listed by MSFT_lod on the full mesh, sharing its
    // skin and vertex accessors, and out of the scene's tree.
    expect(gltf.extensionsUsed).toContain('MSFT_lod');
    const skinIndex = gltf.nodes.findIndex((n) => n.name === 'skin');
    const ids = gltf.nodes[skinIndex]?.extensions?.MSFT_lod?.ids ?? [];
    expect(ids.map((i) => gltf.nodes[i]?.name)).toEqual(['skin_LOD1', 'skin_LOD2', 'skin_LOD3']);
    expect(gltf.nodes[skinIndex]?.extras?.MSFT_screencoverage).toHaveLength(4);
    const inTree = new Set<number>();
    const walk = (i: number) => {
      inTree.add(i);
      for (const c of gltf.nodes[i]?.children ?? []) walk(c);
    };
    for (const root of gltf.scenes[0]?.nodes ?? []) walk(root);
    expect(inTree.has(skinIndex)).toBe(true);
    for (const id of ids) {
      expect(inTree.has(id)).toBe(false);
      const lod = gltf.nodes[id];
      expect(gltf.skins[lod?.skin as number]?.joints).toEqual(
        gltf.skins[gltf.nodes[skinIndex]?.skin as number]?.joints,
      );
      const a = gltf.meshes[lod?.mesh as number]?.primitives[0]?.attributes;
      expect(a).toEqual(skin?.attributes);
    }
    expect(Object.keys(info.lods ?? {})).toEqual(['skin', 'parts']);
    const levels = info.lods?.skin ?? [];
    expect(levels.map((l) => l.node)).toEqual(['skin_LOD1', 'skin_LOD2', 'skin_LOD3']);
    for (let k = 1; k < levels.length; k++)
      expect(levels[k]?.triangles).toBeLessThan(levels[k - 1]?.triangles as number);
  }, 120_000);

  it('leaves the levels of detail out with lods: false', async () => {
    const { glb, info } = await renderer.export({
      blueprint: example('grey-wolf'),
      quality: 'low',
      clips: ['idle'],
      textures: 'none',
      lods: false,
    });
    expect(json(glb).nodes.some((n) => n.name?.includes('_LOD'))).toBe(false);
    expect(info.lods).toBeUndefined();
  }, 60_000);

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
