import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Browser, chromium, type Page } from 'playwright-core';
import { createServer, type ViteDevServer } from 'vite';
import type {
  ExportInfo,
  ExportRequest,
  ExportResponse,
  ParityRequest,
  ParityResponse,
  RenderInfo,
  RenderRequest,
  RenderResponse,
  View,
} from './protocol.ts';

export type {
  ExportInfo,
  ExportRequest,
  ParityRequest,
  ParityResponse,
  RenderInfo,
  RenderRequest,
  View,
};

const pageRoot = fileURLToPath(new URL('../page/', import.meta.url));

/** Chromium to use: $SPAWNFORGE_CHROMIUM, Playwright's own, or the sandbox's pre-installed one. */
function executableCandidates(): (string | undefined)[] {
  return [process.env.SPAWNFORGE_CHROMIUM, undefined, '/opt/pw-browsers/chromium'].filter(
    (p, i, all) => all.indexOf(p) === i && (p === undefined || existsSync(p)),
  );
}

/**
 * Headless Chromium with WebGL 2 through SwiftShader, so no GPU is needed: from
 * $SPAWNFORGE_CHROMIUM, Playwright's own, or the sandbox's pre-installed one. The smoke test
 * runs its game in it too.
 */
export async function launchChromium(): Promise<Browser> {
  let lastError: unknown;
  for (const executablePath of executableCandidates()) {
    try {
      return await chromium.launch({
        ...(executablePath ? { executablePath } : {}),
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `could not start Chromium; set SPAWNFORGE_CHROMIUM or run \`pnpm exec playwright-core install chromium\` (${(lastError as Error)?.message ?? ''})`,
  );
}

/**
 * A headless renderer: one Vite server and one Chromium page, reused across renders.
 * Renders run on the WebGL 2 backend through SwiftShader, so no GPU is needed.
 */
export class Renderer {
  private readonly server: ViteDevServer;
  private readonly browser: Browser;
  private readonly page: Page;

  private constructor(server: ViteDevServer, browser: Browser, page: Page) {
    this.server = server;
    this.browser = browser;
    this.page = page;
  }

  static async launch(): Promise<Renderer> {
    const server = await createServer({
      root: pageRoot,
      configFile: false,
      logLevel: 'silent',
      server: { port: 0, strictPort: false, hmr: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    await server.listen();
    const url = server.resolvedUrls?.local[0];
    if (!url) throw new Error('render server did not start');
    let browser: Browser;
    try {
      browser = await launchChromium();
    } catch (error) {
      await server.close();
      throw error;
    }
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    try {
      await page.waitForFunction(() => (globalThis as PageGlobals).spawnforgeReady === true, null, {
        timeout: 60_000,
      });
    } catch (error) {
      await browser.close();
      await server.close();
      throw new Error(
        `render page failed to load: ${errors.join('; ') || (error as Error).message}`,
      );
    }
    return new Renderer(server, browser, page);
  }

  /** Renders a blueprint to a PNG contact sheet. */
  async render(
    request: RenderRequest,
  ): Promise<{ png: Buffer; width: number; height: number; info: RenderInfo }> {
    const response = (await this.page.evaluate(
      (req) =>
        (
          (globalThis as PageGlobals).spawnforgeRender as (
            r: RenderRequest,
          ) => Promise<RenderResponse>
        )(req),
      request,
    )) as RenderResponse;
    const base64 = response.png.slice(response.png.indexOf(',') + 1);
    return {
      png: Buffer.from(base64, 'base64'),
      width: response.width,
      height: response.height,
      info: response.info,
    };
  }

  /**
   * Exports a blueprint as binary glTF (.glb): skinned mesh with baked vertex colours, skeleton,
   * baked clips, sockets as nodes, and `extras` stored in the file.
   */
  async export(request: ExportRequest): Promise<{ glb: Buffer; info: ExportInfo }> {
    const response = (await this.page.evaluate(
      (req) =>
        (
          (globalThis as PageGlobals).spawnforgeExport as (
            r: ExportRequest,
          ) => Promise<ExportResponse>
        )(req),
      request,
    )) as ExportResponse;
    return { glb: Buffer.from(response.glb, 'base64'), info: response.info };
  }

  /**
   * The pattern stack's raw outputs at the given skin vertices, computed on the GPU (WebGL 2) for
   * the CPU–GPU parity test.
   */
  async parity(request: ParityRequest): Promise<ParityResponse> {
    return (await this.page.evaluate(
      (req) =>
        (
          (globalThis as PageGlobals).spawnforgeParity as (
            r: ParityRequest,
          ) => Promise<ParityResponse>
        )(req),
      request,
    )) as ParityResponse;
  }

  /** Compiles a blueprint in Chromium and returns its fingerprint (see core's `fingerprint`). */
  async fingerprint(
    blueprint: unknown,
    quality: 'low' | 'medium' | 'high' = 'low',
  ): Promise<string> {
    return (await this.page.evaluate(
      ([b, q]) =>
        (
          (globalThis as PageGlobals).spawnforgeFingerprint as (
            b: unknown,
            q: 'low' | 'medium' | 'high',
          ) => string
        )(b, q),
      [blueprint, quality] as const,
    )) as string;
  }

  /**
   * Compares two PNGs of the same size: the share of pixels differing by more than `threshold`
   * (0–255) in any channel, and the mean channel difference. For visual regression tests.
   */
  async diff(a: Buffer, b: Buffer, threshold = 32): Promise<{ differing: number; mean: number }> {
    const url = (png: Buffer) => `data:image/png;base64,${png.toString('base64')}`;
    const result = (await this.page.evaluate(
      ([x, y, t]) =>
        (
          (globalThis as PageGlobals).spawnforgeDiff as (
            a: string,
            b: string,
            t: number,
          ) => Promise<{ differing: number; mean: number }>
        )(x, y, t),
      [url(a), url(b), threshold] as const,
    )) as { differing: number; mean: number };
    return { differing: result.differing, mean: result.mean };
  }

  async close(): Promise<void> {
    await this.browser.close();
    await this.server.close();
  }
}

/** One-shot render: launches, renders and closes. Prefer `Renderer` for several renders. */
export async function renderBlueprint(
  request: RenderRequest,
): Promise<{ png: Buffer; width: number; height: number; info: RenderInfo }> {
  const renderer = await Renderer.launch();
  try {
    return await renderer.render(request);
  } finally {
    await renderer.close();
  }
}

/** What the render page puts on its global object. */
interface PageGlobals {
  spawnforgeReady?: boolean;
  spawnforgeRender?: (request: RenderRequest) => Promise<RenderResponse>;
  spawnforgeFingerprint?: (blueprint: unknown, quality: 'low' | 'medium' | 'high') => string;
  spawnforgeExport?: (request: ExportRequest) => Promise<ExportResponse>;
  spawnforgeParity?: (request: ParityRequest) => Promise<ParityResponse>;
  spawnforgeDiff?: (a: string, b: string, threshold: number) => Promise<unknown>;
}

/** One-shot export: launches, exports and closes. */
export async function exportBlueprint(
  request: ExportRequest,
): Promise<{ glb: Buffer; info: ExportInfo }> {
  const renderer = await Renderer.launch();
  try {
    return await renderer.export(request);
  } finally {
    await renderer.close();
  }
}
