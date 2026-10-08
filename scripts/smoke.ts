/**
 * Smoke test for the published packages: builds every package's dist/, packs the game-facing
 * ones (core, modules, bake, three), installs the tarballs into a copy of scripts/smoke-game/ in a
 * temporary folder outside the workspace, typechecks and builds it with Vite, and runs it in
 * headless Chromium, which must spawn a creature, walk it and draw triangles. The tool packages
 * (cli, mcp, render) are packed too, and must carry their binary, docs and page.
 *
 *   node scripts/smoke.ts [--keep]     # --keep leaves the temporary folder for a look
 */
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchChromium } from '@spawnforge/render';
import { preview } from 'vite';

const root = new URL('..', import.meta.url).pathname;
const keep = process.argv.includes('--keep');
const run = (cmd: string, args: string[], cwd: string) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
};

// Versions the game gets beside the tarballs: the workspace's own.
const catalog = Object.fromEntries(
  [
    ...readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8').matchAll(
      /^\s+'?([@\w/.-]+)'?:\s*(\S+)$/gm,
    ),
  ].map((m) => [m[1] as string, m[2] as string]),
);
const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  packageManager: string;
  devDependencies: Record<string, string>;
};

const tmp = mkdtempSync(join(tmpdir(), 'spawnforge-smoke-'));
let ok = false;
try {
  run('pnpm', ['-r', '--filter', './packages/*', 'run', 'build'], root);

  const tarballs = join(tmp, 'tarballs');
  mkdirSync(tarballs);
  const files: Record<string, string> = {};
  for (const name of ['core', 'modules', 'bake', 'three']) {
    const dir = join(root, 'packages', name);
    const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      version: string;
    };
    run('pnpm', ['pack', '--pack-destination', tarballs], dir);
    const file = join(tarballs, `spawnforge-${name}-${version}.tgz`);
    if (!existsSync(file)) throw new Error(`pnpm pack did not write ${file}`);
    files[`@spawnforge/${name}`] = `file:${file}`;
  }

  // The tool packages are not installed here, but they must carry what they read at run time:
  // the MCP server its docs, the renderer its page, the CLI its binary, three its glb entry.
  const carries: Record<string, string[]> = {
    cli: ['package/dist/bin.js'],
    mcp: ['package/dist/bin.js', 'package/dist/docs/blueprint.md', 'package/dist/docs/catalog.md'],
    render: ['package/dist/index.js', 'package/page/index.html', 'package/page/main.ts'],
  };
  for (const [name, needed] of Object.entries(carries)) {
    const dir = join(root, 'packages', name);
    const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
      version: string;
    };
    run('pnpm', ['pack', '--pack-destination', tarballs], dir);
    const listed = execFileSync(
      'tar',
      ['-tzf', join(tarballs, `spawnforge-${name}-${version}.tgz`)],
      {
        encoding: 'utf8',
      },
    ).split('\n');
    const missing = needed.filter((f) => !listed.includes(f));
    if (missing.length > 0)
      throw new Error(`@spawnforge/${name} is packed without ${missing.join(', ')}`);
  }
  const threeFiles = execFileSync('tar', ['-tzf', (files['@spawnforge/three'] ?? '').slice(5)], {
    encoding: 'utf8',
  });
  if (!threeFiles.includes('package/dist/glb.js'))
    throw new Error('@spawnforge/three is packed without dist/glb.js');

  const game = join(tmp, 'game');
  cpSync(join(root, 'scripts', 'smoke-game'), game, { recursive: true });
  writeFileSync(
    join(game, 'package.json'),
    `${JSON.stringify(
      {
        name: 'spawnforge-smoke-game',
        private: true,
        type: 'module',
        // The workspace's pnpm, so corepack does not reach for whatever version it last saw.
        packageManager: rootPackage.packageManager,
        dependencies: { ...files, three: catalog.three },
        devDependencies: {
          '@types/three': catalog['@types/three'],
          typescript: rootPackage.devDependencies.typescript,
          vite: catalog.vite,
        },
        // The packages name each other by version; point those at the tarballs too.
        pnpm: { overrides: files },
      },
      null,
      2,
    )}\n`,
  );
  run('pnpm', ['install', '--ignore-workspace', '--prefer-offline'], game);
  run(join(game, 'node_modules', '.bin', 'tsc'), ['-p', 'tsconfig.json'], game);
  run(join(game, 'node_modules', '.bin', 'vite'), ['build', '--logLevel', 'warn'], game);

  // Serve the build and run it in the headless Chromium the render package uses.
  const server = await preview({ root: game, logLevel: 'warn', preview: { port: 0, open: false } });
  const url = server.resolvedUrls?.local[0];
  if (!url) throw new Error('vite preview did not start');
  const browser = await launchChromium();
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e: Error) => errors.push(e.message));
    await page.goto(url);
    // These run in the page, where the game sets `smoke` when it is done.
    await page.waitForFunction(
      () => (globalThis as { smoke?: unknown }).smoke !== undefined,
      null,
      {
        timeout: 120_000,
      },
    );
    const smoke = (await page.evaluate(() => (globalThis as { smoke?: unknown }).smoke)) as {
      ok: boolean;
    };
    console.log(JSON.stringify({ ...smoke, pageErrors: errors }, null, 2));
    ok = smoke.ok && errors.length === 0;
  } finally {
    await browser.close();
    await server.close();
  }
} finally {
  if (keep) console.log(`kept ${tmp}`);
  else rmSync(tmp, { recursive: true, force: true });
}
console.log(ok ? 'smoke test passed' : 'smoke test FAILED');
process.exit(ok ? 0 : 1);
