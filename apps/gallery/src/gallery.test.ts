import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry, validateBlueprint } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { launchChromium } from '@spawnforge/render';
import { build, type PreviewServer, preview } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

/**
 * The gallery's smoke test (docs/design/12.2-gallery.md): build the static site, serve it, and
 * open its pages in headless Chromium. Every card is there and thumbnails render; a creature's
 * page shows the live viewer and its contact sheet, links its blueprint and the sandbox, and
 * downloads a `.glb`.
 */
const registry = createRegistry([basicPack]);
const root = fileURLToPath(new URL('../', import.meta.url));
let out: string;
let server: PreviewServer;
let browser: Awaited<ReturnType<typeof launchChromium>>;
let url: string;

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'spawnforge-gallery-'));
  await build({
    root,
    configFile: join(root, 'vite.config.ts'),
    logLevel: 'error',
    build: { outDir: out, emptyOutDir: true },
  });
  server = await preview({
    root,
    configFile: join(root, 'vite.config.ts'),
    logLevel: 'error',
    build: { outDir: out },
    preview: { port: 5194, strictPort: false },
  });
  url = server.resolvedUrls?.local[0] ?? 'http://localhost:5194/';
  browser = await launchChromium();
}, 240_000);

// Closing Chromium and the preview server can take longer than Vitest's default 10 s on a slow
// runner; open keep-alive connections are dropped rather than waited for.
afterAll(async () => {
  await browser?.close();
  (server?.httpServer as { closeAllConnections?: () => void } | undefined)?.closeAllConnections?.();
  await new Promise<void>((resolve) =>
    server ? server.httpServer.close(() => resolve()) : resolve(),
  );
  if (out) rmSync(out, { recursive: true, force: true });
}, 60_000);

const page = async () => {
  const p = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const errors: string[] = [];
  p.on('pageerror', (e) => errors.push(e.message));
  return { p, errors };
};

it('lists every creature by group and renders their thumbnails', async () => {
  const { p, errors } = await page();
  await p.goto(url);
  await p.waitForSelector('.card');
  const counts = await p.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.card')].reduce<Record<string, number>>(
      (all, card) => {
        const group = card.dataset.id?.split('/')[0] ?? '';
        all[group] = (all[group] ?? 0) + 1;
        return all;
      },
      {},
    ),
  );
  expect(counts.example).toBe(32);
  expect(counts.theme).toBe(42);
  expect(counts.eval).toBe(40);
  // The first cards in view render their thumbnails, one after another.
  await p.waitForFunction(
    () => document.querySelectorAll('img[data-rendered="true"]').length >= 4,
    undefined,
    { timeout: 120_000 },
  );
  expect(await p.locator('img[data-rendered="error"]').count()).toBe(0);
  // A group's own page shows that group alone.
  await p.goto(`${url}#/theme`);
  await p.waitForSelector('.card');
  expect(await p.locator('.card').count()).toBe(42);
  expect(errors).toEqual([]);
  await p.close();
}, 240_000);

it("shows a creature's page with its viewer, sheet, blueprint, sandbox link and .glb", async () => {
  const { p, errors } = await page();
  await p.goto(`${url}?webgl#/example/cave-bat`);
  await p.waitForSelector('canvas.viewer[data-ready="true"]', { timeout: 120_000 });
  // The contact sheet loads.
  await p.waitForFunction(
    () => (document.querySelector<HTMLImageElement>('img.sheet')?.naturalWidth ?? 0) > 0,
  );
  // The blueprint download is the example itself, and it validates.
  const json = await p.evaluate(async () => {
    const href = document.querySelector<HTMLAnchorElement>('a.blueprint')?.href ?? '';
    return (await fetch(href)).text();
  });
  const blueprint = JSON.parse(json);
  expect(blueprint.name).toBe('Cave Bat');
  expect(validateBlueprint(blueprint, registry).ok).toBe(true);
  // The sandbox link carries the same blueprint.
  const link = await p.getAttribute('a.sandbox', 'href');
  const encoded = /#blueprint=([\w-]+)$/.exec(link ?? '')?.[1] ?? '';
  const decoded = JSON.parse(
    Buffer.from(encoded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'),
  );
  expect(decoded).toEqual(blueprint);
  // Its actions are buttons, and the viewer draws something.
  expect(await p.locator('.actions button').count()).toBeGreaterThan(0);
  // The canvas read in a frame callback, which runs after the viewer's own in the same frame, while
  // its drawing is still in the buffer. A Playwright screenshot waits for the compositor, which a
  // slow software renderer drawing every frame can keep busy past any timeout.
  const shot = await p.evaluate(
    () =>
      new Promise<number>((resolve) =>
        requestAnimationFrame(() =>
          resolve(
            document.querySelector<HTMLCanvasElement>('canvas.viewer')?.toDataURL().length ?? 0,
          ),
        ),
      ),
  );
  expect(shot).toBeGreaterThan(10_000);
  // The .glb download: a binary glTF with the blueprint in its extras.
  const download = p.waitForEvent('download', { timeout: 180_000 });
  await p.click('button.glb');
  const file = join(out, 'cave-bat.glb');
  await (await download).saveAs(file);
  const bytes = readFileSync(file);
  expect(bytes.subarray(0, 4).toString()).toBe('glTF');
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'));
  const extras = gltf.nodes.find((n: { extras?: { spawnforge?: unknown } }) => n.extras?.spawnforge)
    ?.extras.spawnforge;
  expect(extras.blueprint).toEqual(blueprint);
  expect(gltf.images.length).toBeGreaterThan(0);
  // Theme and agent-written creatures open too.
  for (const id of ['theme/dragon-1', 'eval/b01-dragon']) {
    await p.goto(`${url}?webgl#/${id}`);
    await p.waitForSelector('canvas.viewer[data-ready="true"]', { timeout: 120_000 });
  }
  expect(errors).toEqual([]);
  await p.close();
}, 480_000);
