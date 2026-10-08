import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry, resolveBlueprint, validateBlueprint } from '@spawnforge/core';
import { basicPack } from '@spawnforge/modules';
import { launchChromium } from '@spawnforge/render';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

/**
 * The place tab end to end (docs/design/12.1-placing.md): the sandbox on a temporary creatures
 * folder, driven with real mouse events in headless Chromium. The page says where on screen a
 * point of the skin is (`spawnforgePlace.screenOf`), not what to do.
 */
const registry = createRegistry([basicPack]);
const root = fileURLToPath(new URL('../', import.meta.url));
let folder: string;
let server: ViteDevServer;
let browser: Awaited<ReturnType<typeof launchChromium>>;

beforeAll(async () => {
  folder = mkdtempSync(join(tmpdir(), 'spawnforge-place-'));
  process.env.SPAWNFORGE_CREATURES = folder;
  server = await createServer({
    root,
    configFile: join(root, 'vite.config.ts'),
    logLevel: 'error',
    server: { port: 5193, strictPort: false },
  });
  await server.listen();
  browser = await launchChromium();
}, 120_000);

// Closing Chromium and the dev server (its watcher, sockets and connections) can take longer
// than Vitest's default 10 s on a slow runner.
afterAll(async () => {
  await browser?.close();
  await server?.close();
  delete process.env.SPAWNFORGE_CREATURES;
  if (folder) rmSync(folder, { recursive: true, force: true });
}, 60_000);

type Place = {
  screenOf(section: string, at: number, angle: number, mirror?: number): { x: number; y: number };
  blueprint(): { parts?: { id: string; type: string; attach: Record<string, unknown> }[] };
  idle(): Promise<void>;
};

it('places, moves and removes a horn, and saves a file that validates', async () => {
  const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5193/';
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${url}?creature=grey-wolf&place&webgl&quality=low`);
  await page.waitForFunction(
    () => (globalThis as { spawnforgePlace?: Place }).spawnforgePlace?.blueprint() !== undefined,
    undefined,
    { timeout: 120_000 },
  );
  const place = async () =>
    page.evaluate(() =>
      (globalThis as unknown as { spawnforgePlace: Place }).spawnforgePlace.idle(),
    );
  const screenOf = (at: number, angle: number) =>
    page.evaluate(
      ([a, b]) =>
        (globalThis as unknown as { spawnforgePlace: Place }).spawnforgePlace.screenOf(
          'head',
          a as number,
          b as number,
        ),
      [at, angle],
    );
  const horns = async () =>
    (
      (await page.evaluate(
        () =>
          (globalThis as unknown as { spawnforgePlace: Place }).spawnforgePlace.blueprint().parts,
      )) ?? []
    ).filter((p) => p.type === 'horn.curved');

  // Place: pick the part, click the top of the head.
  await page.selectOption('#place-type', 'horn.curved');
  const first = await screenOf(0.55, 30);
  await page.mouse.click(first.x, first.y);
  await place();
  const placed = await horns();
  expect(placed).toHaveLength(1);
  const placedAttach = placed[0]?.attach as { on: string; at: number; angle: number };
  expect(placedAttach.on).toBe('head');
  expect(placedAttach.at).toBeGreaterThan(0.4);
  expect(placedAttach.at).toBeLessThan(0.7);

  // Move: drag it back along the head, by its root.
  const from = await screenOf(placedAttach.at, placedAttach.angle);
  const to = await screenOf(0.85, 30);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++)
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 10, from.y + ((to.y - from.y) * i) / 10);
  await page.mouse.up();
  await place();
  const moved = await horns();
  expect(moved).toHaveLength(1);
  const movedAttach = moved[0]?.attach as { on: string; at: number };
  expect(movedAttach.on).toBe('head');
  expect(movedAttach.at).toBeGreaterThan(placedAttach.at + 0.1);

  // Remove it (it is selected after the drag), then undo the removal.
  await page.click('#place-remove');
  await place();
  expect(await horns()).toHaveLength(0);
  await page.click('#place-undo');
  await place();
  expect(await horns()).toHaveLength(1);

  // Save: the file is in the creatures folder, validates and has the moved horn.
  await page.fill('#place-name', 'horned-wolf');
  await page.click('#place-save');
  await page.waitForFunction(
    () => document.querySelector('#place-message')?.textContent?.startsWith('saved'),
    undefined,
    { timeout: 30_000 },
  );
  expect(readdirSync(folder)).toContain('horned-wolf.json');
  const saved = JSON.parse(readFileSync(join(folder, 'horned-wolf.json'), 'utf8'));
  expect(validateBlueprint(saved, registry).ok).toBe(true);
  const spec = resolveBlueprint(saved, registry);
  const horn = spec.parts.filter((p) => p.type === 'horn.curved');
  // A mirrored pair on the head, behind where it was first placed.
  expect(horn.length).toBeGreaterThanOrEqual(1);
  expect(horn.every((p) => p.on === 'head' && p.at > placedAttach.at + 0.1)).toBe(true);
  expect(errors).toEqual([]);
  await page.close();
}, 300_000);
