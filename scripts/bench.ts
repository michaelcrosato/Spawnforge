/**
 * The GPU benchmark (docs/design/11.3-crowds.md): 50 creatures near the camera at full motion,
 * 500 distant ones, and 500 distant ones drawn as crowds, with frame times, draw calls,
 * triangles and GPU time where the backend has timestamps.
 *
 *   node scripts/bench.ts [--frames 300] [--small] [--out bench.json]   headless (WebGL 2 on the CPU)
 *   node scripts/bench.ts --open                                         in your browser, on your GPU
 *
 * Headless numbers come from SwiftShader, so they are recorded, not judged (CI runs `--small`).
 * With `--open`, open the printed URL in a browser on the machine to measure; the page shows the
 * numbers and saves them as JSON for `docs/poc/`.
 */
import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Renderer, servePage } from '@spawnforge/render';

const { values } = parseArgs({
  options: {
    frames: { type: 'string' },
    small: { type: 'boolean' },
    out: { type: 'string' },
    open: { type: 'boolean' },
  },
});
const frames = values.frames ? Number(values.frames) : values.small ? 20 : 300;

if (values.open) {
  const { url } = await servePage();
  console.log(`Open ${url}?bench&frames=${frames} in a browser on the machine to measure.`);
  console.log('Leave it in front (a background tab is throttled). Ctrl-C stops the server.');
} else {
  const renderer = await Renderer.launch();
  try {
    const result = await renderer.bench({
      frames,
      ...(values.small
        ? { counts: { near: 10, distant: 60, crowd: 60 }, width: 640, height: 360 }
        : {}),
    });
    const json = `${JSON.stringify(result, null, 2)}\n`;
    if (values.out) writeFileSync(values.out, json);
    console.log(json);
  } finally {
    await renderer.close();
  }
}
