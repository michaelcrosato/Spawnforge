/**
 * A theme across seeds on one sheet: each seed's generated creature from three-quarters, with its
 * seed, name and body plan, so a theme can be judged at a glance.
 *
 *   node scripts/theme-sheet.ts <theme> [--seeds 20] [--out sheet.png] [--size 300]
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { createRegistry, generate } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { launchChromium, Renderer } from '@spawnforge/render';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    seeds: { type: 'string', default: '20' },
    out: { type: 'string' },
    size: { type: 'string', default: '300' },
  },
});
const theme = positionals[0];
if (!theme) throw new Error('usage: node scripts/theme-sheet.ts <theme> [--seeds 20] [--out f]');
const registry = createRegistry([basicPack]);
const seeds = Number(values.seeds);
const size = Number(values.size);
const out = values.out ?? `${theme}-themes.png`;

const tiles: { seed: number; label: string; png: string }[] = [];
const renderer = await Renderer.launch();
try {
  for (let seed = 1; seed <= seeds; seed++) {
    const made = generate({ theme, seed }, registry);
    if (!made.ok) {
      tiles.push({ seed, label: `failed: ${made.errors[0]?.message ?? ''}`, png: '' });
      continue;
    }
    const { png } = await renderer.render({
      blueprint: made.blueprint,
      views: ['three-quarter'],
      size,
      quality: 'low',
    });
    tiles.push({
      seed,
      label: `${String(made.blueprint.extends)} · ${made.measurements?.length.toFixed(1)} m`,
      png: png.toString('base64'),
    });
    console.log(`seed ${seed}: ${String(made.blueprint.name)} (${String(made.blueprint.extends)})`);
  }
} finally {
  await renderer.close();
}

const browser = await launchChromium();
try {
  const page = await browser.newPage({ viewport: { width: 5 * (size + 8) + 8, height: 600 } });
  const cells = tiles
    .map(
      (t) =>
        `<figure>${t.png ? `<img src="data:image/png;base64,${t.png}">` : '<div class="none"></div>'}<figcaption>#${t.seed} · ${t.label}</figcaption></figure>`,
    )
    .join('');
  await page.setContent(`<!doctype html><style>
    body { margin: 0; padding: 8px; background: #16181c; color: #d8dce0; font: 13px sans-serif; }
    h1 { font-size: 18px; margin: 4px 0 10px; }
    main { display: grid; grid-template-columns: repeat(5, ${size}px); gap: 8px; }
    figure { margin: 0; } img, .none { width: ${size}px; display: block; }
    .none { height: ${size}px; background: #400; }
    figcaption { padding: 3px 2px; }
  </style><h1>Theme "${theme}", seeds 1–${seeds}</h1><main>${cells}</main>`);
  // setContent waits for the load event, so every image is decoded by now.
  writeFileSync(out, await page.screenshot({ fullPage: true }));
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
