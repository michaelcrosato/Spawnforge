/**
 * Checks an export eval run: `node eval/export.ts eval/runs/<run>`. Each task in eval/export.json
 * saves files in the run folder; this reads the .glb files (glTF JSON chunk, images and the
 * `spawnforge` extras) and checks what the task asked for, then writes `export-score.json`.
 * Gate: at least three in four tasks pass.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRegistry, measureBody, validateBlueprint } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';

type Json = Record<string, unknown>;
const registry = createRegistry([basicPack]);
const dir = process.argv[2] ?? '';
if (!dir) throw new Error('usage: node eval/export.ts <run folder>');

const need = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message);
};

/** The glTF JSON of a .glb, its binary chunk and its `spawnforge` extras. */
function glb(file: string): { json: Json; bin: Buffer; extras: Json } {
  const path = join(dir, file);
  need(existsSync(path), `${file} is missing`);
  const bytes = readFileSync(path);
  need(bytes.subarray(0, 4).toString() === 'glTF', `${file} is not a .glb`);
  const length = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8')) as Json;
  const bin = bytes.subarray(28 + length);
  const node = (json.nodes as Json[]).find((n) => (n.extras as Json | undefined)?.spawnforge);
  if (!node) throw new Error(`${file} has no spawnforge extras`);
  return { json, bin, extras: (node.extras as Json).spawnforge as Json };
}
/** The material and attributes of the mesh on the node named `name` (`skin`, `parts`, …). */
const materialOf = (json: Json, name: string) => {
  const node = ((json.nodes as Json[]) ?? []).find((n) => n.name === name);
  const mesh =
    node?.mesh !== undefined ? ((json.meshes as Json[])[node.mesh as number] as Json) : undefined;
  if (!mesh) throw new Error(`no ${name} mesh`);
  const primitive = (mesh.primitives as Json[])[0] as Json;
  return {
    primitive,
    attributes: primitive.attributes as Json,
    material: ((json.materials as Json[]) ?? [])[primitive.material as number] as Json,
  };
};
/** An accessor's floats (a tightly packed float accessor, as the exporter writes them). */
const floats = (json: Json, bin: Buffer, accessor: number) => {
  const a = (json.accessors as Json[])[accessor] as Json;
  const view = (json.bufferViews as Json[])[a.bufferView as number] as Json;
  const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type as string] ?? 1;
  const start = ((view.byteOffset as number | undefined) ?? 0) + ((a.byteOffset as number) ?? 0);
  const out: number[] = [];
  for (let i = 0; i < (a.count as number) * size; i++) out.push(bin.readFloatLE(start + i * 4));
  return out;
};
/** The width of the image a texture index points at: PNG, or JPEG (colour maps of big files). */
const textureWidth = (json: Json, bin: Buffer, texture: number) => {
  const source = ((json.textures as Json[])[texture] as Json).source as number;
  const view = (json.bufferViews as Json[])[
    ((json.images as Json[])[source] as Json).bufferView as number
  ] as Json;
  const start = (view.byteOffset as number | undefined) ?? 0;
  const image = bin.subarray(start, start + (view.byteLength as number));
  if (image[0] === 0x89) return image.readUInt32BE(16);
  // JPEG: walk the segments to the frame header (SOF0 to SOF3), whose width follows its height.
  for (let at = 2; at + 9 < image.length; at += 2 + image.readUInt16BE(at + 2))
    if (
      image[at] === 0xff &&
      (image[at + 1] as number) >= 0xc0 &&
      (image[at + 1] as number) <= 0xc3
    )
      return image.readUInt16BE(at + 7);
  return 0;
};
const clipNames = (json: Json) => ((json.animations as Json[]) ?? []).map((a) => a.name as string);
const specOf = (extras: Json) => {
  const result = validateBlueprint(extras.blueprint, registry, { minimal: false });
  need(result.ok && result.creature !== undefined, 'the blueprint in the extras is invalid');
  return result.creature as NonNullable<typeof result.creature>;
};

const checks: Record<string, () => string> = {
  'x01-clip-subset': () => {
    const { json, extras } = glb('x01.glb');
    const names = clipNames(json).sort();
    need(JSON.stringify(names) === '["bite","tripod"]', `clips: ${names.join(', ')}`);
    need(extras.quality === 'low', `quality ${String(extras.quality)}`);
    return `clips ${names.join(', ')}, low quality`;
  },
  'x02-insect-stats': () => {
    const { extras } = glb('x02.glb');
    const stats = extras.stats as { module?: string; values?: Json } | undefined;
    need(stats?.module === 'rpg', `stats: ${JSON.stringify(stats)}`);
    need(typeof stats?.values?.health === 'number', 'no health value');
    const legs = specOf(extras).limbs.filter((l) => l.role === 'leg').length;
    need(legs === 6, `${legs} legs, not an insect`);
    return `rpg stats, health ${String(stats?.values?.health)}`;
  },
  'x03-small-demon': () => {
    const { json, extras } = glb('x03.glb');
    const names = clipNames(json);
    for (const clip of ['idle', 'walk', 'bite', 'roar'])
      need(names.includes(clip), `no ${clip} clip (has ${names.join(', ')})`);
    const height = measureBody(specOf(extras), registry).height;
    need(height <= 1.2 + 1e-3, `body height ${height.toFixed(2)} m`);
    return `body height ${height.toFixed(2)} m, clips ${names.join(', ')}`;
  },
  'x04-read-export': () => {
    const { json, extras } = glb('x04.glb');
    const answer = JSON.parse(readFileSync(join(dir, 'x04.json'), 'utf8')) as Json;
    const nodes = (json.nodes as Json[]).map((n) => n.name);
    need(
      answer.node === 'socket_mouth',
      `node ${String(answer.node)} (nodes include socket_mouth)`,
    );
    need(nodes.includes(answer.node), 'that node is not in the file');
    const bite = (extras.clips as Json[]).find((c) => c.name === 'bite') as Json;
    const contact = (bite.events as Json[]).find((e) => e.type === 'bite-contact') as Json;
    need(
      Math.abs((answer.biteSeconds as number) - (bite.duration as number)) < 0.02,
      `biteSeconds ${String(answer.biteSeconds)} vs ${String(bite.duration)}`,
    );
    need(
      Math.abs((answer.contactSeconds as number) - (contact.time as number)) < 0.02,
      `contactSeconds ${String(answer.contactSeconds)} vs ${String(contact.time)}`,
    );
    return `${String(answer.node)}, bite ${String(answer.biteSeconds)} s, contact ${String(answer.contactSeconds)} s`;
  },
  'x05-sharp-maps': () => {
    const { json, bin } = glb('x05.glb');
    const { attributes, material } = materialOf(json, 'skin');
    const pbr = material.pbrMetallicRoughness as Json;
    const base = pbr.baseColorTexture as Json | undefined;
    need(base !== undefined, 'the skin has no colour map');
    need(material.normalTexture !== undefined, 'the skin has no normal map');
    need(attributes.TEXCOORD_0 !== undefined, 'the skin has no texture coordinates');
    const width = textureWidth(json, bin, base?.index as number);
    need(width === 2048, `colour map ${width} px, not the largest (2048)`);
    return `skin maps ${width} px, with a normal map`;
  },
  'x06-vertex-colours': () => {
    const { json } = glb('x06.glb');
    const images = ((json.images as Json[]) ?? []).length;
    need(images === 0, `${images} images in the file`);
    const { attributes } = materialOf(json, 'skin');
    need(attributes.COLOR_0 !== undefined, 'the skin has no vertex colours');
    return 'vertex colours, no images';
  },
  'x07-glow': () => {
    const { json, extras } = glb('x07.glb');
    const answer = JSON.parse(readFileSync(join(dir, 'x07.json'), 'utf8')) as Json;
    const { material } = materialOf(json, 'skin');
    need(material.emissiveTexture !== undefined, 'the skin has no emissive map');
    const glow = (extras.glow as { pulse: number }[] | undefined) ?? [];
    need(glow.length > 0, 'no pulsing glow layer in the extras');
    const pulses = glow.map((g) => g.pulse);
    need(
      pulses.some((p) => p > 0 && Math.abs((answer.pulseHz as number) - p) < 1e-3),
      `pulseHz ${String(answer.pulseHz)} vs ${pulses.join(', ')}`,
    );
    return `emissive map, pulse ${String(answer.pulseHz)} Hz`;
  },
  'x08-live-only': () => {
    const { extras } = glb('x08.glb');
    const answer = JSON.parse(readFileSync(join(dir, 'x08.json'), 'utf8')) as Json;
    const differences = (answer.differences as unknown[] | undefined) ?? [];
    need(
      differences.some((d) => typeof d === 'string' && /fur|coat|shell/i.test(d)),
      'the differences leave out the fur',
    );
    need(
      differences.some((d) => typeof d === 'string' && /wrap|light|shad/i.test(d)),
      'the differences leave out the wrapped light',
    );
    const fur = extras.fur as { length: number } | undefined;
    need(fur !== undefined, 'no fur in the extras');
    need(
      Math.abs((answer.furLengthMetres as number) - (fur?.length as number)) < 1e-4,
      `furLengthMetres ${String(answer.furLengthMetres)} vs ${String(fur?.length)}`,
    );
    return `${differences.length} differences, fur ${String(answer.furLengthMetres)} m`;
  },
  'x09-levels-of-detail': () => {
    const { json, extras } = glb('x09.glb');
    const answer = JSON.parse(readFileSync(join(dir, 'x09.json'), 'utf8')) as Json;
    const expected = ['skin', 'skin_LOD1', 'skin_LOD2', 'skin_LOD3'].map((name) => {
      const index = materialOf(json, name).primitive.indices as number;
      return (((json.accessors as Json[])[index] as Json).count as number) / 3;
    });
    need(
      JSON.stringify(answer.skinTriangles) === JSON.stringify(expected),
      `skinTriangles ${JSON.stringify(answer.skinTriangles)} vs ${JSON.stringify(expected)}`,
    );
    // The coarsest level's error under a pixel: error · 1080 / (2 d tan 30°) < 1.
    const error = ((extras.lods as Json).skin as { error: number }[])[2]?.error as number;
    const metres = (error * 1080) / (2 * Math.tan(Math.PI / 6));
    const given = answer.lowestFromMetres as number;
    need(
      Math.abs(given - metres) <= 0.02 * metres + 0.05,
      `lowestFromMetres ${String(given)} vs ${metres.toFixed(2)}`,
    );
    return `skin ${expected.join(' / ')} triangles, coarsest from ${given} m`;
  },
  'x10-root-motion': () => {
    const { json, bin, extras } = glb('x10.glb');
    const answer = JSON.parse(readFileSync(join(dir, 'x10.json'), 'utf8')) as Json;
    const clip = (extras.clips as Json[]).find((c) => c.name === answer.clip);
    need(clip?.rootMotion === true, `${String(answer.clip)} is not a clip with root motion`);
    need(answer.clip === 'pounce', `clip ${String(answer.clip)}, not the pounce`);
    // The root bone's translation track: its last key's z, less its first.
    const root = (((json.skins as Json[])[0] as Json).joints as number[])[0];
    const animation = (json.animations as Json[]).find((a) => a.name === answer.clip) as Json;
    const channel = (animation.channels as Json[]).find(
      (c) => (c.target as Json).node === root && (c.target as Json).path === 'translation',
    );
    need(channel !== undefined, 'the pounce has no root translation track');
    const sampler = (animation.samplers as Json[])[channel?.sampler as number] as Json;
    const z = floats(json, bin, sampler.output as number).filter((_, i) => i % 3 === 2);
    const forward = (z[z.length - 1] as number) - (z[0] as number);
    const given = answer.forwardMetres as number;
    need(
      Math.abs(given - forward) <= 0.05 || Math.abs(given - (z[z.length - 1] as number)) <= 0.05,
      `forwardMetres ${String(given)} vs ${forward.toFixed(2)}`,
    );
    const body = specOf(extras);
    need(body.limbs.filter((l) => l.role === 'leg').length === 4, 'not the cheetah');
    return `${String(answer.clip)} moves the root ${forward.toFixed(2)} m forward`;
  },
  'x11-engine-import': () => {
    const { json, extras } = glb('x11.glb');
    const answer = JSON.parse(readFileSync(join(dir, 'x11.json'), 'utf8')) as Json;
    const loops = (extras.clips as Json[])
      .filter((c) => c.loop === true)
      .map((c) => c.name as string)
      .sort();
    const given = [...((answer.loop as string[] | undefined) ?? [])].sort();
    need(
      JSON.stringify(given) === JSON.stringify(loops),
      `loop ${given.join(', ')} vs ${loops.join(', ')}`,
    );
    need(answer.breathNode === 'socket_mouth', `breathNode ${String(answer.breathNode)}`);
    need(
      (json.nodes as Json[]).some((n) => n.name === answer.breathNode),
      'that node is not in the file',
    );
    return `loop ${given.join(', ')}; breath at ${String(answer.breathNode)}`;
  },
};

const rows = Object.entries(checks).map(([id, check]) => {
  try {
    return { id, pass: true, note: check() };
  } catch (error) {
    return { id, pass: false, note: (error as Error).message };
  }
});
const passed = rows.filter((r) => r.pass).length;
console.log('| Task | Result | Note |\n| --- | --- | --- |');
for (const r of rows) console.log(`| ${r.id} | ${r.pass ? 'pass' : 'FAIL'} | ${r.note} |`);
const bar = Math.ceil(rows.length * 0.75);
console.log(
  `\n${passed}/${rows.length} tasks pass. Gate (≥ ${bar}): ${passed >= bar ? 'PASS' : 'FAIL'}`,
);
writeFileSync(
  join(dir, 'export-score.json'),
  `${JSON.stringify({ passed, total: rows.length, rows }, null, 2)}\n`,
);
