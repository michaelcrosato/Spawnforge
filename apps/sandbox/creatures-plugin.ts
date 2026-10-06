import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Plugin } from 'vite';

/** What the sandbox receives about a file in the creatures folder. */
export interface CreatureFile {
  readonly name: string;
  readonly blueprint?: unknown;
  readonly error?: string;
  readonly removed?: boolean;
}

function read(file: string): CreatureFile {
  const name = basename(file, '.json');
  try {
    return { name, blueprint: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (error) {
    return { name, error: (error as Error).message };
  }
}

/**
 * Serves `<dir>/*.json` at `/__creatures` and pushes changes to the page as
 * `spawnforge:creature` events, so a blueprint saved by an LLM (or anyone) shows up live.
 */
export function creaturesFolder(dir: string): Plugin {
  return {
    name: 'spawnforge-creatures',
    configureServer(server) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      server.watcher.add(dir);
      server.middlewares.use('/__creatures', (_req, res) => {
        const files = readdirSync(dir)
          .filter((f) => f.endsWith('.json'))
          .sort()
          .map((f) => read(join(dir, f)));
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(files));
      });
      const notify = (file: string) => {
        if (!file.startsWith(dir) || !file.endsWith('.json')) return;
        const data: CreatureFile = existsSync(file)
          ? read(file)
          : { name: basename(file, '.json'), removed: true };
        server.ws.send({ type: 'custom', event: 'spawnforge:creature', data });
      };
      server.watcher.on('add', notify);
      server.watcher.on('change', notify);
      server.watcher.on('unlink', notify);
    },
  };
}
