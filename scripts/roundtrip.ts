/**
 * The texture round trip for every example (docs/design/11.1-textures.md, decision 13): each is
 * exported with its maps, loaded back in the render page and compared with the live creature,
 * view by view; the probes score relief, roughness and glow on their own, and the mutation test
 * checks the round trip fails for a bake with a deliberate mistake. Every example's file also goes
 * through the Khronos glTF validator, which must report no errors.
 *
 *   node scripts/roundtrip.ts [name …] [--textures 1024] [--size 768] [--mutations] [--out report.json]
 */
/// <reference path="../packages/render/src/gltf-validator.d.ts" />
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  type Mutation,
  PROBES,
  Renderer,
  ROUND_TRIP_BARS,
  type RoundTripResponse,
  roundTripVerdict,
} from '@spawnforge/render';
import { validateBytes } from 'gltf-validator';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    textures: { type: 'string' },
    size: { type: 'string' },
    mutations: { type: 'boolean' },
    out: { type: 'string' },
  },
});
const textures = values.textures ? Number(values.textures) : 1024;
const size = values.size ? { size: Number(values.size) } : {};
const dir = new URL('../examples/', import.meta.url);
const names = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.slice(0, -5))
  .filter((n) => positionals.length === 0 || positionals.includes(n));

const verdict = roundTripVerdict;
/** Each mistake against the probe whose effect it breaks (a flipped v breaks everything). */
const TARGETS: Record<keyof typeof PROBES, readonly Mutation[]> = {
  relief: ['green', 'tangent-sign', 'normal-srgb', 'v-flip'],
  roughness: ['orm-swap'],
  glow: ['glow-clip'],
};
const round = (r: RoundTripResponse) => ({
  bytes: r.bytes,
  exportMs: Math.round(r.exportMs),
  worst: {
    mean: Number(Math.max(...r.views.map((v) => v.mean)).toFixed(4)),
    off: Number(Math.max(...r.views.map((v) => v.off)).toFixed(4)),
    overlap: Number(Math.min(...r.views.map((v) => v.overlap)).toFixed(4)),
  },
  views: r.views.map((v) => ({ ...v, images: undefined })),
  withoutTangents: r.withoutTangents,
  ...(r.probe ? { probe: r.probe } : {}),
});

const renderer = await Renderer.launch();
const save = () => {
  if (values.out) writeFileSync(values.out, `${JSON.stringify(report, null, 2)}\n`);
};
const report: Record<string, unknown> = {
  textures,
  bars: ROUND_TRIP_BARS,
  examples: {},
  probes: {},
};
try {
  for (const name of names) {
    const blueprint = JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));
    const r = await renderer.roundTrip({ blueprint, textures, glb: true, ...size });
    const v = verdict(r);
    const issues = (await validateBytes(Buffer.from(r.glb ?? '', 'base64'), { maxIssues: 100 }))
      .issues;
    const errors = issues.messages.filter((m) => m.severity === 0).map((m) => m.code);
    const pass = v.pass && errors.length === 0;
    (report.examples as Record<string, unknown>)[name] = {
      ...v,
      pass,
      validator: {
        errors,
        warnings: [...new Set(issues.messages.filter((m) => m.severity === 1).map((m) => m.code))],
      },
      ...round(r),
    };
    save();
    console.log(
      `${pass ? 'pass' : 'FAIL'}  ${name}  ${JSON.stringify(round(r).worst)}${errors.length > 0 ? `  validator: ${errors.join(', ')}` : ''}`,
    );
  }
  for (const [effect, blueprint] of Object.entries(PROBES)) {
    const probe = effect as keyof typeof PROBES;
    const mutations: (Mutation | undefined)[] = [
      undefined,
      ...(values.mutations ? TARGETS[probe] : []),
    ];
    for (const mutate of mutations) {
      const r = await renderer.roundTrip({
        blueprint,
        textures,
        ...size,
        probe,
        ...(mutate ? { mutate } : {}),
      });
      const v = verdict(r);
      (report.probes as Record<string, unknown>)[`${effect}${mutate ? `:${mutate}` : ''}`] = {
        ...v,
        ...round(r),
      };
      save();
      console.log(
        `${v.pass === !mutate ? 'ok  ' : 'BAD '}  probe ${effect}${mutate ? ` with ${mutate}` : ''}: ${v.pass ? 'passes' : 'fails'} (correlation ${v.correlation})`,
      );
    }
  }
} finally {
  await renderer.close();
}
save();
